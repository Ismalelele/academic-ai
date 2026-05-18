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
  const { schedule } = useSchedule();
  const { tasks } = useTasks();

  // 1. Cargar notificaciones de Supabase
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('user_id', user.id)
        .order('fecha_creacion', { ascending: false });

      if (!error && data) {
        setNotifications(data.map(n => ({
          id: n.id_notificacion,
          title: n.titulo,
          message: n.mensaje,
          type: n.tipo,
          read: n.leida,
          createdAt: n.fecha_creacion
        })));
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

    if (!error && data) {
      const newNotif = {
        id: data.id_notificacion,
        title: data.titulo,
        message: data.mensaje,
        type: data.tipo,
        read: data.leida,
        createdAt: data.fecha_creacion
      };
      setNotifications(prev => [newNotif, ...prev]);
      return newNotif;
    }
    return null;
  };

  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from('notificaciones').update({ leida: true }).eq('id_notificacion', id).eq('user_id', user?.id);
  };

  const deleteNotification = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notificaciones').delete().eq('id_notificacion', id).eq('user_id', user?.id);
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
      if (schedule && schedule.length > 0) {
        schedule.forEach(cls => {
          if (cls.day === currentDay) {
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
  }, [schedule, tasks, notifications, user, dailyAlertTime]);

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
