import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useSchedule } from './ScheduleContext';
import { useTasks } from './TaskContext';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();
  const { effectiveSchedule } = useSchedule();
  const { tasks } = useTasks();

  // 1. Cargar notificaciones de Supabase
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
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

  // 1.5 Solicitar permisos para Push Notifications del Sistema Operativo
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

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
  const addNotification = async (title, message, type = 'info') => {
    if (!user) return null;

    // Lanzar Push Notification nativa al Windows/Mac/Android del usuario
    triggerOSNotification(title, message);

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
  };

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

      // Revisar Horario (Avisar si hay una clase en exactamente 15 minutos)
      if (effectiveSchedule && effectiveSchedule.length > 0) {
        effectiveSchedule.forEach(cls => {
          if (cls.day === currentDay && !cls.isSuspended) {
            const startMins = cls.startH * 60 + cls.startM;
            // Si la clase empieza en exactamente 15 minutos (para no spamear)
            if (startMins - currentMins === 15) {
              const msg = `Tu clase de ${cls.title} empieza en 15 minutos en ${cls.room || 'el Aula'}.`;
              // Comprobar si ya existe una alerta similar hoy
              const alreadyAlerted = notifications.some(n => 
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

      const [alertH, alertM] = dailyAlertTime.split(':').map(Number);

      // Revisar Tareas (Avisar a la hora configurada si hay tareas urgentes)
      if (tasks && tasks.length > 0 && now.getHours() === alertH && now.getMinutes() === alertM) {
        const urgentes = tasks.filter(t => t.priority === 'high' && t.status !== 'done');
        if (urgentes.length > 0) {
          const msg = `Tienes ${urgentes.length} tarea(s) urgente(s) pendiente(s) para hoy.`;
          const alreadyAlerted = notifications.some(n => 
            n.title === 'Recordatorio de Tareas' && 
            n.message === msg &&
            (new Date(n.createdAt).toDateString() === now.toDateString())
          );
          if (!alreadyAlerted) {
            addNotification('Recordatorio de Tareas', msg, 'urgente');
            firedAlert = true;
          }
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
  }, [effectiveSchedule, tasks, notifications, user, dailyAlertTime]);

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
