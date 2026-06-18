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
  }, [user]);

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
      
      // Request permission dynamically if not yet granted
      if (Notification.permission !== 'granted') {
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
      } else {
        console.log("Successfully registered and saved Push Subscription to Supabase.");
      }
    } catch (err) {
      console.error("Error setting up Web Push subscription:", err);
    }
  }, [user]);

  // Hook to register push on login or mount when user exists
  useEffect(() => {
    if (user && !user.id.startsWith('user-local-')) {
      registerPushSubscription();
    }
  }, [user, registerPushSubscription]);

  // Función interna para lanzar la notificación al Sistema Operativo
  const triggerOSNotification = (title, message) => {
    if ("Notification" in window && Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body: message,
          icon: '/favicon.ico', // Reemplaza con el ícono de la app si lo tienes
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

    // Lanzar Push Notification nativa al Windows/Mac/Android del usuario
    triggerOSNotification(title, message);

    const isChat = type && type.startsWith('chat:');
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

  const lastAlertTimeRef = useRef(null);

  // 3. Lógica automática (Comprobar horario y tareas cada minuto)
  useEffect(() => {
    if (!user) return;

    const checkAlerts = async () => {
      const now = new Date();
      const currentMinuteString = `${now.getHours()}:${now.getMinutes()}`;
      
      // Evitar que se dispare dos veces en el mismo minuto por re-renders de React
      if (lastAlertTimeRef.current === currentMinuteString) return;

      const jsDay = now.getDay();
      const currentDay = jsDay === 0 ? 6 : jsDay - 1; 
      const currentMins = now.getHours() * 60 + now.getMinutes();

      let firedAlert = false;

      // 1. Clases: Avisar 15 minutos antes
      if (effectiveSchedule && effectiveSchedule.length > 0) {
        effectiveSchedule.forEach(cls => {
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
                addNotification('Clase Próxima', msg, 'clase');
                firedAlert = true;
              }
            }
          }
        });
      }

      // 2. Tareas: Avisar 15 minutos antes de la hora establecida (dailyAlertTime)
      const [alertH, alertM] = dailyAlertTime.split(':').map(Number);
      const alertMins = alertH * 60 + alertM;
      if (alertMins - currentMins === 15) {
        const pendientes = tasks ? tasks.filter(t => t.status !== 'done') : [];
        pendientes.forEach(task => {
          const msg = `Tienes la tarea pendiente "${task.title}" del ramo "${task.tag || 'General'}".`;
          const alreadyAlerted = notificationsRef.current.some(n => 
            n.title === 'Recordatorio de Tarea' && 
            n.message === msg &&
            (new Date(n.createdAt).toDateString() === now.toDateString())
          );
          if (!alreadyAlerted) {
            addNotification('Recordatorio de Tarea', msg, 'urgente');
            firedAlert = true;
          }
        });
      }

      // 3. Bloques de Estudio (IA): Avisar 15 minutos antes
      if (studyBlocks && studyBlocks.length > 0) {
        studyBlocks.forEach(block => {
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
                addNotification('Bloque de Estudio', msg, 'estudio');
                firedAlert = true;
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
            if (!alert.fired && new Date(alert.triggerTime) <= now) {
              addNotification(alert.title || '💡 Asistente Académico', alert.message, 'info');
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

      if (firedAlert) {
        lastAlertTimeRef.current = currentMinuteString;
      }
    };

    // Ejecutar inmediatamente y luego cada 1 minuto
    checkAlerts();
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, [effectiveSchedule, tasks, user, dailyAlertTime, studyBlocks]);

  // 3.5 Programar notificaciones de IA una vez al día o al iniciar la app
  useEffect(() => {
    if (!user) return;

    const runAiScheduling = async () => {
      const todayStr = new Date().toDateString();
      const lastScheduledDay = localStorage.getItem(`academic_ai_last_schedule_date_${user.id}`);

      if (lastScheduledDay !== todayStr) {
        try {
          console.log("Scheduling AI notifications for today...");
          await scheduleAiNotifications(user.id, effectiveSchedule, tasks, studyBlocks);
          localStorage.setItem(`academic_ai_last_schedule_date_${user.id}`, todayStr);
        } catch (e) {
          console.error("Error scheduling AI notifications:", e);
        }
      }
    };

    // Ejecutar con un pequeño delay para asegurar la carga del horario y tareas
    const timer = setTimeout(runAiScheduling, 4000);
    return () => clearTimeout(timer);
  }, [user, effectiveSchedule, tasks, studyBlocks]);

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
