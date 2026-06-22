import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useSchedule } from './ScheduleContext';
import { useTasks } from './TaskContext';
import { scheduleAiNotifications } from '../utils/aiProcessor';
import { getSafeLocalStorage } from '../utils/storageSecurity';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const notificationsRef = useRef(notifications);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const { user } = useAuth();
  const { effectiveSchedule, studyBlocks } = useSchedule();
  const { tasks } = useTasks();

  const tasksRef = useRef(tasks);
  const effectiveScheduleRef = useRef(effectiveSchedule);
  const studyBlocksRef = useRef(studyBlocks);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { effectiveScheduleRef.current = effectiveSchedule; }, [effectiveSchedule]);
  useEffect(() => { studyBlocksRef.current = studyBlocks; }, [studyBlocks]);

  // 1. Cargar notificaciones de Supabase
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      if (user.id.startsWith('user-local-')) {
        const saved = localStorage.getItem(`academic_notifications_${user.id}`);
        setNotifications(saved ? JSON.parse(saved) : []);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('notificaciones')
          .select('*')
          .eq('user_id', user.id)
          .order('fecha_creacion', { ascending: false });

        if (error) throw error;

        if (data) {
          const formatted = data.map(n => ({
            id: n.id_notificacion,
            title: n.titulo,
            message: n.mensaje,
            type: n.tipo,
            read: n.leida,
            createdAt: n.fecha_creacion
          }));
          setNotifications(formatted);
          localStorage.setItem(`academic_notifications_${user.id}`, JSON.stringify(formatted));
        }
      } catch (error) {
        console.warn("Fallo al conectar con Supabase para notificaciones. Usando respaldo local. Error:", error?.message || error, "Código:", error?.code || 'N/A');
        const saved = localStorage.getItem(`academic_notifications_${user.id}`);
        if (saved) {
          setNotifications(JSON.parse(saved));
        } else {
          setNotifications([]);
        }
      }
    };

    fetchNotifications();
  }, [user?.id]);

  // Helper to convert VAPID public key
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const registerPushSubscription = useCallback(async () => {
    if (!user || user.id.startsWith('user-local-')) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn("Push notifications are not supported in this browser.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Si el permiso ya está denegado/bloqueado, salimos para evitar spam en consola
      if (Notification.permission === 'denied') {
        console.warn("Notification permission is denied/blocked in browser settings.");
        return;
      }
      
      // Solicitar permiso dinámicamente si está en estado predeterminado ('default')
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn("Notification permission was denied.");
          return;
        }
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn("VITE_VAPID_PUBLIC_KEY is missing in env variables.");
        return;
      }

      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      // Send subscription to Supabase
      const dispositivoString = navigator.userAgent;
      
      // Upsert subscription into database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          subscription_json: subscription.toJSON(),
          dispositivo: dispositivoString,
          fecha_creacion: new Date().toISOString()
        }, {
          onConflict: 'user_id, subscription_json'
        });

      if (error) {
        console.error("Error saving push subscription to Supabase:", error);
      }
      // Suscripción registrada y guardada exitosamente
    } catch (err) {
      console.warn("Error setting up Web Push subscription (browser/network environment issue):", err?.message || err);
    }
  }, [user?.id]);

  // Hook to register push on login or mount when user exists
  useEffect(() => {
    if (user && !user.id.startsWith('user-local-')) {
      registerPushSubscription();
    }
  }, [user?.id, registerPushSubscription]);

  // Escuchar notificaciones globales de Administrador (Pruebas) en tiempo real
  useEffect(() => {
    if (!user || user.id.startsWith('user-local-')) return;
    
    const adminChannel = supabase.channel('admin_broadcast')
      .on('broadcast', { event: 'admin_notification' }, (payload) => {
        if (payload.payload) {
          const { titulo, mensaje, tipo } = payload.payload;
          addNotificationRef.current(titulo, mensaje, tipo);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(adminChannel);
    };
  }, [user?.id]);

  // Función interna para lanzar la notificación al Sistema Operativo
  const triggerOSNotification = (title, message) => {
    if ("Notification" in window && Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body: message,
          icon: '/icon-192x192.png', // Reemplaza con el ícono de la app si lo tienes
          vibrate: [200, 100, 200],
          requireInteraction: true // Evita que la notificación desaparezca sola
        });
      }).catch(err => {
        console.error("Error lanzando Push a través de Service Worker:", err);
        // Fallback si falla el SW
        new Notification(title, { body: message });
      });
    }
  };

  // 2. Función para añadir notificación manual o automática
  const addNotification = useCallback(async (title, message, type = 'info') => {
    if (!user) return null;

    const isChat = type && type.startsWith('chat:');
    
    if (isChat) {
      const activeChatId = type.split(':')[1];
      const currentActiveChatId = localStorage.getItem('academic_active_chat_id');
      const isChatsTabOpen = window.location.pathname === '/chats';
      
      // Si el mensaje es del chat activo actual, ignorar por completo
      if (activeChatId === currentActiveChatId) {
        return null;
      }
      
      // Si estamos en la pestaña de chats, pero es otro chat, NO lanzar Push (solo acumular en DB/Local)
      if (!isChatsTabOpen) {
        triggerOSNotification(title, message);
      }
    } else {
      // Lanzar Push Notification nativa al Windows/Mac/Android del usuario
      triggerOSNotification(title, message);
    }

    const existing = isChat ? notificationsRef.current.find(n => n.type === type && !n.read) : null;

    if (existing) {
      const updatedMessage = `${existing.message}\n${message}`;
      
      // Actualizar localmente de inmediato
      setNotifications(prev => {
        const updated = prev.map(n => n.id === existing.id ? { ...n, message: updatedMessage, createdAt: new Date().toISOString() } : n);
        localStorage.setItem(`academic_notifications_${user.id}`, JSON.stringify(updated));
        return updated;
      });

      try {
        if (typeof existing.id === 'string' && existing.id.startsWith('notif-local-')) {
          return existing;
        }
        await supabase
          .from('notificaciones')
          .update({
            mensaje: updatedMessage,
            fecha_creacion: new Date().toISOString()
          })
          .eq('id_notificacion', existing.id);
      } catch (err) {
        console.warn("Fallo al actualizar notificación en Supabase:", err);
      }

      return { ...existing, message: updatedMessage };
    }

    const localNewNotif = {
      id: `notif-local-${Date.now()}`,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString()
    };

    // Actualizar localmente de inmediato
    setNotifications(prev => {
      const updated = [localNewNotif, ...prev];
      localStorage.setItem(`academic_notifications_${user.id}`, JSON.stringify(updated));
      return updated;
    });

    try {
      // Insertar en Supabase
      const { data, error } = await supabase
        .from('notificaciones')
        .insert([{
          user_id: user.id,
          titulo: title,
          mensaje: message,
          tipo: type,
          leida: false
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const dbNotif = {
          id: data.id_notificacion,
          title: data.titulo,
          message: data.mensaje,
          type: data.tipo,
          read: data.leida,
          createdAt: data.fecha_creacion
        };
        // Reemplazar la notificacion local temporal con la real de base de datos
        setNotifications(prev => {
          const replaced = prev.map(n => n.id === localNewNotif.id ? dbNotif : n);
          localStorage.setItem(`academic_notifications_${user.id}`, JSON.stringify(replaced));
          return replaced;
        });
        return dbNotif;
      }
    } catch (err) {
      console.warn("Fallo al crear notificación en Supabase. Guardada localmente de respaldo.", err);
    }

    return localNewNotif;
  }, [user]);

  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  const markAsRead = async (id) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem(`academic_notifications_${user.id}`, JSON.stringify(updated));
      return updated;
    });

    try {
      if (typeof id === 'string' && id.startsWith('notif-local-')) {
        return;
      }
      const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id_notificacion', id).eq('user_id', user?.id);
      if (error) throw error;
    } catch (err) {
      console.warn("Fallo al marcar notificación como leída en Supabase.", err);
    }
  };

  const deleteNotification = async (id) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      localStorage.setItem(`academic_notifications_${user.id}`, JSON.stringify(updated));
      return updated;
    });

    try {
      if (typeof id === 'string' && id.startsWith('notif-local-')) {
        return;
      }
      const { error } = await supabase.from('notificaciones').delete().eq('id_notificacion', id).eq('user_id', user?.id);
      if (error) throw error;
    } catch (err) {
      console.warn("Fallo al eliminar notificación en Supabase.", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const [dailyAlertTime, setDailyAlertTime] = useState(localStorage.getItem('alertTime') || '09:00');

  useEffect(() => {
    localStorage.setItem('alertTime', dailyAlertTime);
  }, [dailyAlertTime]);

  const dailyAlertTimeRef = useRef(dailyAlertTime);
  useEffect(() => {
    dailyAlertTimeRef.current = dailyAlertTime;
  }, [dailyAlertTime]);

  const lastAlertTimeRef = useRef(null);

  // 3. Lógica automática (Comprobar horario y tareas cada minuto)
  useEffect(() => {
    if (!user) return;

    const checkAlerts = async () => {
      const now = new Date();
      const currentMinuteString = `${now.getHours()}:${now.getMinutes()}`;
      
      // Evitar que se dispare dos veces en el mismo minuto por re-renders de React
      if (lastAlertTimeRef.current === currentMinuteString) return;
      lastAlertTimeRef.current = currentMinuteString;

      const jsDay = now.getDay();
      const currentDay = jsDay === 0 ? 6 : jsDay - 1; 
      const currentMins = now.getHours() * 60 + now.getMinutes();

      const currentSchedule = effectiveScheduleRef.current;
      const currentTasks = tasksRef.current;
      const currentStudyBlocks = studyBlocksRef.current;
      const currentDailyAlertTime = dailyAlertTimeRef.current;

      // 1. Clases: Avisar 15 minutos antes
      if (currentSchedule && currentSchedule.length > 0) {
        currentSchedule.forEach(cls => {
          if (cls.day === currentDay && !cls.isSuspended) {
            const startMins = cls.startH * 60 + cls.startM;
            if (startMins - currentMins === 15) {
              const msg = `Tu clase de ${cls.title} empieza en 15 minutos en ${cls.room || 'el Aula'}.`;
              const alreadyAlerted = notificationsRef.current.some(n => 
                n.title === 'Clase Próxima' && 
                n.message === msg && 
                (new Date(n.createdAt).toDateString() === now.toDateString())
              );
              if (!alreadyAlerted) {
                addNotificationRef.current('Clase Próxima', msg, 'clase');
              }
            }
          }
        });
      }

      // 2. Tareas: Avisar 15 minutos antes de la hora establecida (dailyAlertTime)
      if (currentDailyAlertTime) {
        const [alertH, alertM] = currentDailyAlertTime.split(':').map(Number);
        const alertMins = alertH * 60 + alertM;
        if (alertMins - currentMins === 15) {
          const pendientes = currentTasks ? currentTasks.filter(t => t.status !== 'done') : [];
          pendientes.forEach(task => {
            const msg = `Tienes la tarea pendiente "${task.title}" del ramo "${task.tag || 'General'}".`;
            const alreadyAlerted = notificationsRef.current.some(n => 
              n.title === 'Recordatorio de Tarea' && 
              n.message === msg &&
              (new Date(n.createdAt).toDateString() === now.toDateString())
            );
            if (!alreadyAlerted) {
              addNotificationRef.current('Recordatorio de Tarea', msg, 'urgente');
            }
          });
        }
      }

      // 3. Bloques de Estudio (IA): Avisar 15 minutos antes
      if (currentStudyBlocks && currentStudyBlocks.length > 0) {
        currentStudyBlocks.forEach(block => {
          if (block.day === currentDay) {
            const startMins = block.startH * 60 + block.startM;
            if (startMins - currentMins === 15) {
              const taskTitle = block.taskTitle || block.title || 'Estudio';
              const msg = `Tu bloque de estudio para '${taskTitle}' empieza en 15 minutos.`;
              const alreadyAlerted = notificationsRef.current.some(n => 
                n.title === 'Bloque de Estudio' && 
                n.message === msg &&
                (new Date(n.createdAt).toDateString() === now.toDateString())
              );
              if (!alreadyAlerted) {
                addNotificationRef.current('Bloque de Estudio', msg, 'estudio');
              }
            }
          }
        });
      }

      // 4. Alertas calendarizadas por la IA
      const savedAiAlerts = getSafeLocalStorage(`academic_${user.id}_ai_scheduled_alerts`, user.id, null);
      if (savedAiAlerts) {
        try {
          let alerts = savedAiAlerts;
          let updated = false;
          
          alerts.forEach(alert => {
            if (alert.fired) return;

            const triggerTime = new Date(alert.triggerTime);
            if (triggerTime <= now) {
              const ageInMs = now.getTime() - triggerTime.getTime();
              
              // 1. Si la alerta es vieja (más de 10 min), descártala automáticamente.
              if (ageInMs > 10 * 60 * 1000) { 
                 alert.fired = true; 
                 updated = true;
                 return;
              }

              // 3. Solo dispara si estamos en horario diurno (08:00 - 20:00)
              if (now.getHours() >= 8 && now.getHours() < 20) {
                  addNotificationRef.current(alert.title || '💡 Asistente Académico', alert.message, 'info');
              }
              
              alert.fired = true;
              updated = true;
            }
          });
          
          if (updated) {
            localStorage.setItem(`academic_${user.id}_ai_scheduled_alerts`, JSON.stringify(alerts));
          }
        } catch (e) {
          console.error("Error checking AI scheduled alerts:", e);
        }
      }
    };

    // Ejecutar inmediatamente y luego cada 1 minuto
    checkAlerts();
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // 3.5 Programar notificaciones de IA una vez al día o al iniciar la app
  useEffect(() => {
    if (!user) return;

    const runAiScheduling = async () => {
      const todayStr = new Date().toDateString();
      const lastScheduledDay = localStorage.getItem(`academic_ai_last_schedule_date_${user.id}`);

      if (lastScheduledDay !== todayStr) {
        try {
          await scheduleAiNotifications(user.id, effectiveScheduleRef.current, tasksRef.current, studyBlocksRef.current);
          localStorage.setItem(`academic_ai_last_schedule_date_${user.id}`, todayStr);
        } catch (e) {
          console.error("Error scheduling AI notifications:", e);
        }
      }
    };

    // Ejecutar con un pequeño delay para asegurar la carga del horario y tareas
    const timer = setTimeout(runAiScheduling, 4000);
    return () => clearTimeout(timer);
  }, [user?.id]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      deleteNotification,
      dailyAlertTime,
      setDailyAlertTime
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
