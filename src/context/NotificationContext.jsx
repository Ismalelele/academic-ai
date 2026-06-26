// src/context/NotificationContext.jsx
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

      // Saneamiento preventivo de tokens huérfanos
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      if (Notification.permission === 'denied') return;
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) return;

      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      const dispositivoString = navigator.userAgent;
      const subscriptionJson = subscription.toJSON();

      // DETECCIÓN DE TIMEZONE: Captura la zona horaria real del sistema operativo/navegador
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santiago';

      // Persistencia en Supabase con el nuevo campo mapeado
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint,
          subscription_json: subscriptionJson,
          dispositivo: dispositivoString,
          timezone: userTimezone, // <-- Columna Nueva
          fecha_creacion: new Date().toISOString()
        }, {
          onConflict: 'endpoint'
        });

      if (error) console.error("Error saving push subscription:", error);
    } catch (err) {
      console.warn("Error setting up Web Push subscription:", err?.message || err);
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
    const permission = "Notification" in window ? Notification.permission : 'unsupported';
    console.log(`[AURA Notif] Intentando enviar: "${title}" | Permiso: ${permission} | SW: ${'serviceWorker' in navigator}`);
    if (permission !== 'granted') {
      console.warn(`[AURA Notif] Bloqueada — permiso actual: ${permission}. Solicita permiso manualmente.`);
      return;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('[AURA Notif] Service Worker no disponible en este contexto.');
      return;
    }

    navigator.serviceWorker.ready.then((registration) => {
      console.log(`[AURA Notif] Mostrando via SW registration:`, registration.scope);
      return registration.showNotification(title, {
        body: message,
        icon: new URL('/logo.png', window.location.origin).toString(),
        badge: new URL('/badge.svg', window.location.origin).toString(),
        vibrate: [200, 100, 200],
        requireInteraction: true
      });
    }).catch(err => {
      console.error('[AURA Notif] Error al mostrar via SW, intentando Notification directa:', err);
      try {
        new Notification(title, { body: message });
      } catch (e2) {
        console.error('[AURA Notif] Notification directa también falló:', e2);
      }
    });
  };

  // 2. Función para añadir notificación manual o automática
  const addNotification = useCallback(async (title, message, type = 'info') => {
    if (!user) return null;

    const isChat = type && type.startsWith('chat:');

    if (isChat) {
      const activeChatId = type.split(':')[1];
      const currentActiveChatId = localStorage.getItem('academic_active_chat_id');
      const isChatsTabOpen = window.location.pathname === '/chats';

      if (activeChatId === currentActiveChatId) {
        return null;
      }

      if (!isChatsTabOpen) {
        triggerOSNotification(title, message);
      }
    } else {
      triggerOSNotification(title, message);
    }

    const existing = isChat ? notificationsRef.current.find(n => n.type === type && !n.read) : null;
    if (existing) {
      const updatedMessage = `${existing.message}\n${message}`;
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
    setNotifications(prev => {
      const updated = [localNewNotif, ...prev];
      localStorage.setItem(`academic_notifications_${user.id}`, JSON.stringify(updated));
      return updated;
    });
    try {
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

    const timer = setTimeout(runAiScheduling, 4000);
    return () => clearTimeout(timer);
  }, [user?.id]);

  // 3.6 DISPATCHER DETERMINISTA DE ALERTAS
  const firedAlertsRef = useRef(new Set());
  useEffect(() => {
    if (!user) return;

    const todayTag = new Date().toDateString();
    const firedKey = `academic_${user.id}_fired_alerts_${todayTag}`;
    try {
      const saved = JSON.parse(localStorage.getItem(firedKey) || '[]');
      firedAlertsRef.current = new Set(saved);
    } catch {
      firedAlertsRef.current = new Set();
    }

    const persistFired = (key) => {
      firedAlertsRef.current.add(key);
      try {
        localStorage.setItem(firedKey, JSON.stringify([...firedAlertsRef.current]));
      } catch { /* storage lleno – ignorar */ }
    };

    const dispatch = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();

      // ── A) ALERTAS DETERMINISTAS DE CLASES ───────────────────────────────────
      const sched = effectiveScheduleRef.current;
      if (Array.isArray(sched)) {
        const todayDow = now.getDay() === 0 ? 6 : now.getDay() - 1;

        for (const cls of sched) {
          if (cls.day !== todayDow) continue;
          if (cls.isSuspended) continue;

          const classStartMins = cls.startH * 60 + cls.startM;
          const classEndMins = cls.endH * 60 + cls.endM;

          // 15 minutos ANTES del inicio
          const alertBeforeKey = `class-before-${cls.id || cls.title}-${now.toDateString()}`;
          if (
            !firedAlertsRef.current.has(alertBeforeKey) &&
            nowMins >= classStartMins - 15 &&
            nowMins < classStartMins - 14
          ) {
            triggerOSNotification(
              '📚 Clase próxima',
              `"${cls.title}" comienza en 15 minutos (${cls.startH.toString().padStart(2, '0')}:${cls.startM.toString().padStart(2, '0')}). ¡Prepara tus materiales!`
            );
            addNotificationRef.current(
              '📚 Clase próxima',
              `"${cls.title}" comienza en 15 minutos.`,
              'schedule'
            );
            persistFired(alertBeforeKey);
          }

          // 5 minutos DESPUÉS del fin
          const alertAfterKey = `class-after-${cls.id || cls.title}-${now.toDateString()}`;
          if (
            !firedAlertsRef.current.has(alertAfterKey) &&
            nowMins >= classEndMins + 5 &&
            nowMins < classEndMins + 6
          ) {
            triggerOSNotification(
              '✅ Clase finalizada',
              `"${cls.title}" terminó hace 5 minutos. Repasa tus apuntes mientras están frescos.`
            );
            addNotificationRef.current(
              '✅ Clase finalizada',
              `"${cls.title}" terminó. Revisa tus apuntes.`,
              'schedule'
            );
            persistFired(alertAfterKey);
          }
        }
      }

      // ── B) ALERTAS DE BLOQUES DE ESTUDIO ─────────────────────────────────────
      const blocks = studyBlocksRef.current;
      if (Array.isArray(blocks)) {
        const todayDow = now.getDay() === 0 ? 6 : now.getDay() - 1;

        for (const block of blocks) {
          if (block.day !== todayDow) continue;
          const blockStartMins = block.startH * 60 + block.startM;
          const alertBlockKey = `study-block-${block.id || block.title}-${now.toDateString()}`;

          // 5 minutos ANTES del inicio del bloque
          if (
            !firedAlertsRef.current.has(alertBlockKey) &&
            nowMins >= blockStartMins - 5 &&
            nowMins < blockStartMins - 4
          ) {
            const blockTitle = block.title || 'Sesión de estudio';
            triggerOSNotification(
              '📖 Bloque de estudio',
              `Tu sesión de estudio para "${blockTitle}" comienza en 5 minutos (${block.startH.toString().padStart(2, '0')}:${block.startM.toString().padStart(2, '0')}). ¡Prepárate!`
            );
            addNotificationRef.current(
              '📖 Bloque de estudio',
              `Sesión para "${blockTitle}" comienza en 5 min.`,
              'study'
            );
            persistFired(alertBlockKey);
          }
        }
      }

      // ── C) ALERTAS IA / MOTIVACIONALES ──────────────────────
      const aiKey = `academic_${user.id}_ai_scheduled_alerts`;
      try {
        const aiAlerts = JSON.parse(localStorage.getItem(aiKey) || '[]');
        let changed = false;
        const updated = aiAlerts.map(alert => {
          if (alert.fired) return alert;
          const trigger = new Date(alert.triggerTime);
          if (now >= trigger && (now - trigger) < 120_000) {
            const alertAiKey = alert.id;
            if (!firedAlertsRef.current.has(alertAiKey)) {
              triggerOSNotification(alert.title, alert.message);
              addNotificationRef.current(alert.title, alert.message, 'ai');
              persistFired(alertAiKey);
            }
            changed = true;
            return { ...alert, fired: true };
          }
          return alert;
        });
        if (changed) {
          localStorage.setItem(aiKey, JSON.stringify(updated));
        }
      } catch { /* ignorar errores */ }
    };

    dispatch();
    const intervalId = setInterval(dispatch, 60_000);
    return () => clearInterval(intervalId);
  }, [user?.id]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      deleteNotification,
      dailyAlertTime,
      setDailyAlertTime,
      registerPushSubscription
    }}>
      {children}
    </NotificationContext.Provider>
  );
};