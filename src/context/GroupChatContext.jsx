import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const GroupChatContext = createContext();

export const useGroupChat = () => useContext(GroupChatContext);

export const GroupChatProvider = ({ children }) => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeGroupMembers, setActiveGroupMembers] = useState([]);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Verificar presencia de tablas en Supabase
  useEffect(() => {
    if (!user) return;

    if (user.id.startsWith('user-local-')) {
      setIsFallbackMode(true);
      return;
    }

    const checkTables = async () => {
      try {
        // Verificar que las 3 tablas de chat existen
        const [r1, r2, r3] = await Promise.all([
          supabase.from('chat_grupos').select('id_grupo').limit(1),
          supabase.from('chat_miembros').select('id_miembro').limit(1),
          supabase.from('chat_mensajes').select('id_mensaje').limit(1)
        ]);

        const tablesMissing = [r1, r2, r3].some(r => 
          r.error && (r.error.code === '42P01' || r.error.message?.includes('does not exist'))
        );

        if (tablesMissing) {
          console.warn("Tablas de chat no detectadas en Supabase:", 
            r1.error ? 'chat_grupos: ' + r1.error.message : 'chat_grupos: OK',
            r2.error ? 'chat_miembros: ' + r2.error.message : 'chat_miembros: OK',
            r3.error ? 'chat_mensajes: ' + r3.error.message : 'chat_mensajes: OK'
          );
          setIsFallbackMode(true);
        } else {
          // Loguear errores no-fatales (RLS, permisos) pero no cambiar a fallback
          [r1, r2, r3].forEach((r, i) => {
            if (r.error) console.warn(`Tabla chat #${i} tiene error (no fatal):`, r.error);
          });
          console.log("✅ Tablas de chat detectadas en Supabase. Usando modo online.");
          setIsFallbackMode(false);
        }
      } catch (e) {
        console.warn("Fallo de conexión con Supabase. Usando respaldo de chat local.", e);
        setIsFallbackMode(true);
      }
    };

    checkTables();
  }, [user]);

  // Cargar datos (Grupos, Mensajes, Solicitudes)
  useEffect(() => {
    if (!user) {
      setGroups([]);
      setMessages([]);
      setPendingRequests([]);
      setActiveGroupId(null);
      return;
    }

    if (isFallbackMode) {
      loadLocalData();
    } else {
      loadSupabaseData();
    }
  }, [user, isFallbackMode, activeGroupId]);

  // Suscripción Realtime para Supabase
  useEffect(() => {
    if (!user || isFallbackMode) return;

    // 1. Suscribirse a mensajes nuevos
    const messagesChannel = supabase
      .channel('schema-db-changes-mensajes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_mensajes' },
        (payload) => {
          const newMsg = payload.new;
          
          // No reaccionar si el mensaje es enviado por el propio usuario
          if (newMsg.user_id === user.id) return;

          // Buscar si el usuario actual pertenece a este grupo
          setGroups((prevGroups) => {
            const group = prevGroups.find(g => g.id_grupo === newMsg.id_grupo);
            if (!group) return prevGroups; // El usuario no está en este grupo

            // Si está en el grupo activo, lo agregamos al chat en tiempo real
            setActiveGroupId((currentActiveId) => {
              if (currentActiveId === newMsg.id_grupo) {
                setMessages((prevMsgs) => {
                  if (prevMsgs.some(m => m.id_mensaje === newMsg.id_mensaje)) return prevMsgs;
                  return [...prevMsgs, newMsg];
                });
              }
              return currentActiveId;
            });

            // Verificar si tiene notificaciones habilitadas
            const notifEnabled = group.membership?.notificaciones_activas !== false;

            // Determinar si está viendo esta pantalla
            setActiveGroupId((currentActiveId) => {
              const isViewingThisGroupChat = currentActiveId === newMsg.id_grupo;
              const isChatsTabOpen = window.location.pathname === '/chats';

              if (notifEnabled && (!isViewingThisGroupChat || !isChatsTabOpen)) {
                addNotification(
                  `Nuevo mensaje en ${group.titulo}`,
                  `${newMsg.user_name}: "${newMsg.texto.substring(0, 45)}${newMsg.texto.length > 45 ? '...' : ''}"`,
                  'chat'
                );
              }
              return currentActiveId;
            });

            return prevGroups;
          });
        }
      )
      .subscribe();

    // 2. Suscribirse a cambios en membresías (para solicitudes aceptadas, etc.)
    const membersChannel = supabase
      .channel('schema-db-changes-miembros')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_miembros' },
        () => {
          loadSupabaseData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [user, isFallbackMode, addNotification]);

  // --- MÉTODOS LOCALES (LOCALSTORAGE FALLBACK) ---

  const loadLocalData = () => {
    const localGroups = JSON.parse(localStorage.getItem(`academic_groups_${user.id}`)) || [];
    const localMembers = JSON.parse(localStorage.getItem(`academic_members_${user.id}`)) || [];
    const localMessages = JSON.parse(localStorage.getItem(`academic_messages_${user.id}`)) || [];

    // Inicializar con datos dummy si está completamente vacío
    if (localGroups.length === 0) {
      const initialGroups = [
        { id_grupo: 'group-1', titulo: 'Estudio de Cálculo I', asignatura: 'Matemáticas', codigo_invitacion: 'CALC11', creador_id: user.id, fecha_creacion: new Date().toISOString() },
        { id_grupo: 'group-2', titulo: 'Física - Mecánica', asignatura: 'Física', codigo_invitacion: 'FIS102', creador_id: 'other-user-123', fecha_creacion: new Date().toISOString() }
      ];
      const initialMembers = [
        { id_miembro: 'memb-1', id_grupo: 'group-1', user_id: user.id, user_name: user.user_metadata?.full_name?.split(' ')[0] || 'Mi Usuario', user_email: user.email, estado: 'aceptado', notificaciones_activas: true },
        { id_miembro: 'memb-2', id_grupo: 'group-2', user_id: user.id, user_name: user.user_metadata?.full_name?.split(' ')[0] || 'Mi Usuario', user_email: user.email, estado: 'aceptado', notificaciones_activas: true },
        { id_miembro: 'memb-3', id_grupo: 'group-1', user_id: 'mock-user-1', user_name: 'Juan Pérez', user_email: 'juan@correo.cl', estado: 'aceptado', notificaciones_activas: true },
        { id_miembro: 'memb-4', id_grupo: 'group-1', user_id: 'mock-user-2', user_name: 'María González', user_email: 'maria@correo.cl', estado: 'pendiente', notificaciones_activas: true }
      ];
      const initialMessages = [
        { id_mensaje: 'msg-1', id_grupo: 'group-1', user_id: 'mock-user-1', user_name: 'Juan Pérez', texto: 'Hola a todos, ¿quién se suma a estudiar mañana para la prueba de Cálculo?', fecha_envio: new Date(Date.now() - 3600000).toISOString() },
        { id_mensaje: 'msg-2', id_grupo: 'group-1', user_id: user.id, user_name: user.user_metadata?.full_name?.split(' ')[0] || 'Mi Usuario', texto: '¡Hola Juan! Yo me anoto. ¿A qué hora?', fecha_envio: new Date(Date.now() - 1800000).toISOString() }
      ];

      localStorage.setItem(`academic_groups_${user.id}`, JSON.stringify(initialGroups));
      localStorage.setItem(`academic_members_${user.id}`, JSON.stringify(initialMembers));
      localStorage.setItem(`academic_messages_${user.id}`, JSON.stringify(initialMessages));

      const initialLibrary = [
        {
          id: 'lib-mock-1',
          group_id: 'group-1',
          user_id: 'mock-user-1',
          user_name: 'Juan Pérez',
          title: 'Resumen completo de Límites',
          description: 'Conceptos fundamentales de límites laterales, indeterminaciones cero sobre cero y límites al infinito.',
          content_type: 'summary',
          content_data: '# Resumen de Límites Académicos\n\nEste es un resumen de la materia de límites para Cálculo I.\n\n## 1. Definición Formal de Límite\nEl límite de $f(x)$ cuando $x$ tiende a $a$ es $L$ si para todo $\\epsilon > 0$ existe un $\\delta > 0$ tal que...\n\n## 2. Indeterminaciones Comunes\n- $0/0$: Se resuelve factorizando o usando L\'Hopital.\n- $\\infty/\\infty$: Se divide por la mayor potencia.',
          file_url: null,
          created_at: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: 'lib-mock-2',
          group_id: 'group-1',
          user_id: 'mock-user-sofia',
          user_name: 'Sofía Rojas',
          title: 'Flashcards de Derivadas Comunes',
          description: 'Reglas de derivación rápidas para repasar antes del control 2.',
          content_type: 'flashcards',
          content_data: JSON.stringify([
            { front: 'Derivada de x^n', back: 'n * x^(n-1)' },
            { front: 'Derivada de ln(x)', back: '1/x' },
            { front: 'Derivada de e^x', back: 'e^x' },
            { front: 'Derivada de sin(x)', back: 'cos(x)' },
            { front: 'Derivada de cos(x)', back: '-sin(x)' }
          ]),
          file_url: null,
          created_at: new Date(Date.now() - 3600000).toISOString()
        }
      ];
      const initialLibraryRatings = [
        { id: 'rate-mock-1', item_id: 'lib-mock-1', user_id: 'mock-user-sofia', rating: 5, created_at: new Date().toISOString() },
        { id: 'rate-mock-2', item_id: 'lib-mock-1', user_id: 'mock-user-carlos', rating: 4, created_at: new Date().toISOString() },
        { id: 'rate-mock-3', item_id: 'lib-mock-2', user_id: 'mock-user-1', rating: 5, created_at: new Date().toISOString() }
      ];

      localStorage.setItem(`academic_library_${user.id}`, JSON.stringify(initialLibrary));
      localStorage.setItem(`academic_library_ratings_${user.id}`, JSON.stringify(initialLibraryRatings));

      setGroups(initialGroups.map(g => {
        const membership = initialMembers.find(m => m.id_grupo === g.id_grupo && m.user_id === user.id);
        return { ...g, membership };
      }));

      if (activeGroupId === 'group-1') {
        setMessages(initialMessages.filter(m => m.id_grupo === 'group-1'));
        setActiveGroupMembers(initialMembers.filter(m => m.id_grupo === 'group-1' && m.estado === 'aceptado'));
      }
      setPendingRequests(initialMembers.filter(m => m.estado === 'pendiente' && initialGroups.find(g => g.id_grupo === m.id_grupo && g.creador_id === user.id)));
      return;
    }

    // Mapear grupos con la membresía del usuario actual
    const userGroups = localGroups.filter(g => 
      g.creador_id === user.id || localMembers.some(m => m.id_grupo === g.id_grupo && m.user_id === user.id)
    ).map(g => {
      const membership = localMembers.find(m => m.id_grupo === g.id_grupo && m.user_id === user.id);
      return { ...g, membership };
    });

    setGroups(userGroups);

    if (activeGroupId) {
      setMessages(localMessages.filter(m => m.id_grupo === activeGroupId).sort((a, b) => new Date(a.fecha_envio) - new Date(b.fecha_envio)));
      setActiveGroupMembers(localMembers.filter(m => m.id_grupo === activeGroupId && m.estado === 'aceptado'));
    }

    // Solicitudes para grupos creados por el usuario activo
    const myGroupIds = localGroups.filter(g => g.creador_id === user.id).map(g => g.id_grupo);
    const pend = localMembers.filter(m => m.estado === 'pendiente' && myGroupIds.includes(m.id_grupo));
    setPendingRequests(pend.map(p => {
      const g = localGroups.find(gr => gr.id_grupo === p.id_grupo);
      return { ...p, grupo_titulo: g ? g.titulo : 'Grupo' };
    }));
  };

  // --- MÉTODOS SUPABASE ---

  const loadSupabaseData = async () => {
    if (!user || user.id.startsWith('user-local-')) {
      setIsFallbackMode(true);
      return;
    }
    try {
      setLoading(true);
      
      // 1. Obtener membresías del usuario
      let memberData = [];
      try {
        const { data, error } = await supabase
          .from('chat_miembros')
          .select('*, chat_grupos(*)')
          .eq('user_id', user.id);
        if (error) {
          console.error("Error en chat_miembros con JOIN:", error);
          // Intentar sin el JOIN como fallback
          const { data: plainData, error: plainErr } = await supabase
            .from('chat_miembros')
            .select('*')
            .eq('user_id', user.id);
          if (plainErr) throw plainErr;
          memberData = plainData || [];
        } else {
          memberData = data || [];
        }
      } catch (e) {
        console.error("Error total en chat_miembros:", e);
        throw e;
      }

      // 2. Obtener grupos creados por el usuario
      let createdData = [];
      try {
        const { data, error } = await supabase
          .from('chat_grupos')
          .select('*')
          .eq('creador_id', user.id);
        if (error) throw error;
        createdData = data || [];
      } catch (e) {
        console.error("Error en chat_grupos:", e);
        throw e;
      }

      // Unificar grupos
      const unifiedGroupsMap = {};
      createdData.forEach(g => {
        unifiedGroupsMap[g.id_grupo] = { ...g, membership: { estado: 'aceptado', notificaciones_activas: true } };
      });
      memberData.forEach(m => {
        const grupo = m.chat_grupos || createdData.find(g => g.id_grupo === m.id_grupo);
        if (grupo) {
          const groupData = m.chat_grupos || grupo;
          unifiedGroupsMap[groupData.id_grupo] = {
            ...groupData,
            membership: { estado: m.estado, notificaciones_activas: m.notificaciones_activas }
          };
        }
      });

      const userGroups = Object.values(unifiedGroupsMap);
      setGroups(userGroups);

      // 3. Si hay un grupo activo, cargar sus mensajes y miembros
      if (activeGroupId) {
        try {
          const { data: msgData, error: msgErr } = await supabase
            .from('chat_mensajes')
            .select('*')
            .eq('id_grupo', activeGroupId)
            .order('fecha_envio', { ascending: true });

          if (msgErr) console.error("Error en chat_mensajes:", msgErr);
          setMessages(msgData || []);
        } catch (e) {
          console.error("Error cargando mensajes:", e);
          setMessages([]);
        }

        try {
          const { data: membersData, error: membersErr } = await supabase
            .from('chat_miembros')
            .select('*')
            .eq('id_grupo', activeGroupId)
            .eq('estado', 'aceptado');

          if (membersErr) console.error("Error en miembros activos:", membersErr);
          setActiveGroupMembers(membersData || []);
        } catch (e) {
          console.error("Error cargando miembros:", e);
          setActiveGroupMembers([]);
        }
      }

      // 4. Cargar solicitudes pendientes para los grupos del creador
      const myCreatedIds = createdData.map(g => g.id_grupo);
      if (myCreatedIds.length > 0) {
        try {
          const { data: pendData, error: pendErr } = await supabase
            .from('chat_miembros')
            .select('*, chat_grupos(titulo)')
            .in('id_grupo', myCreatedIds)
            .eq('estado', 'pendiente');

          if (pendErr) {
            console.error("Error en solicitudes pendientes:", pendErr);
            // Intentar sin JOIN
            const { data: plainPend } = await supabase
              .from('chat_miembros')
              .select('*')
              .in('id_grupo', myCreatedIds)
              .eq('estado', 'pendiente');
            setPendingRequests((plainPend || []).map(p => {
              const g = createdData.find(gr => gr.id_grupo === p.id_grupo);
              return { ...p, grupo_titulo: g ? g.titulo : 'Grupo' };
            }));
          } else {
            setPendingRequests(pendData?.map(p => ({
              ...p,
              grupo_titulo: p.chat_grupos ? p.chat_grupos.titulo : 'Grupo'
            })) || []);
          }
        } catch (e) {
          console.error("Error en pendientes:", e);
          setPendingRequests([]);
        }
      } else {
        setPendingRequests([]);
      }
    } catch (e) {
      console.error("Error cargando datos de Supabase. Cambiando a local. Error:", e?.message || e, "Código:", e?.code || 'N/A');
      setIsFallbackMode(true);
    } finally {
      setLoading(false);
    }
  };

  // --- OPERACIONES ---

  // 1. Crear Grupo
  const createGroup = async (titulo, asignatura) => {
    const inviteCode = (asignatura.substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000));
    
    if (isFallbackMode) {
      const localGroups = JSON.parse(localStorage.getItem(`academic_groups_${user.id}`)) || [];
      const localMembers = JSON.parse(localStorage.getItem(`academic_members_${user.id}`)) || [];

      const newGroup = {
        id_grupo: `group-${Date.now()}`,
        titulo,
        asignatura,
        codigo_invitacion: inviteCode,
        creador_id: user.id,
        fecha_creacion: new Date().toISOString()
      };

      const newMember = {
        id_miembro: `memb-${Date.now()}`,
        id_grupo: newGroup.id_grupo,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || 'Mi Usuario',
        user_email: user.email,
        estado: 'aceptado',
        notificaciones_activas: true,
        user_avatar: user.user_metadata?.avatar_url || null,
        user_carrera: user.user_metadata?.carrera || null,
        user_universidad: user.user_metadata?.universidad || null,
        user_anio: user.user_metadata?.anio_ingreso || null,
        user_bio: user.user_metadata?.bio || null
      };

      localStorage.setItem(`academic_groups_${user.id}`, JSON.stringify([...localGroups, newGroup]));
      localStorage.setItem(`academic_members_${user.id}`, JSON.stringify([...localMembers, newMember]));

      loadLocalData();
      setActiveGroupId(newGroup.id_grupo);
      return newGroup;
    } else {
      try {
        const { data: gData, error: gErr } = await supabase
          .from('chat_grupos')
          .insert([{
            titulo,
            asignatura,
            codigo_invitacion: inviteCode,
            creador_id: user.id
          }])
          .select()
          .single();

        if (gErr) throw gErr;

        // Auto-unirse al grupo como creador
        const { error: mErr } = await supabase
          .from('chat_miembros')
          .insert([{
            id_grupo: gData.id_grupo,
            user_id: user.id,
            user_name: user.user_metadata?.full_name || 'Creador',
            user_email: user.email,
            estado: 'aceptado',
            notificaciones_activas: true,
            user_avatar: user.user_metadata?.avatar_url || null,
            user_carrera: user.user_metadata?.carrera || null,
            user_universidad: user.user_metadata?.universidad || null,
            user_anio: user.user_metadata?.anio_ingreso || null,
            user_bio: user.user_metadata?.bio || null
          }]);

        if (mErr) throw mErr;

        await loadSupabaseData();
        setActiveGroupId(gData.id_grupo);
        return gData;
      } catch (e) {
        alert("Error al crear grupo: " + e.message);
      }
    }
  };

  // 2. Solicitar Unirse a Grupo por Código
  const joinGroup = async (inviteCode) => {
    const cleanedCode = inviteCode.trim().toUpperCase();

    // Siempre intentar Supabase primero para buscar grupos de OTROS usuarios
    try {
      const { data: gData, error: gErr } = await supabase
        .from('chat_grupos')
        .select('*')
        .eq('codigo_invitacion', cleanedCode)
        .maybeSingle();

      if (!gErr && gData) {
        // Grupo encontrado en Supabase — intentar crear membresía
        const { error: mErr } = await supabase
          .from('chat_miembros')
          .insert([{
            id_grupo: gData.id_grupo,
            user_id: user.id,
            user_name: user.user_metadata?.full_name || 'Usuario',
            user_email: user.email,
            estado: 'pendiente',
            notificaciones_activas: true,
            user_avatar: user.user_metadata?.avatar_url || null,
            user_carrera: user.user_metadata?.carrera || null,
            user_universidad: user.user_metadata?.universidad || null,
            user_anio: user.user_metadata?.anio_ingreso || null,
            user_bio: user.user_metadata?.bio || null
          }]);

        if (mErr) {
          if (mErr.code === '23505') {
            throw new Error("Ya eres miembro o tienes una solicitud pendiente para este grupo.");
          }
          console.error("Error al insertar miembro:", mErr);
          throw new Error("Error al enviar la solicitud. Intenta de nuevo.");
        }

        // Recargar datos
        try { await loadSupabaseData(); } catch (_) { /* ignorar si falla el reload */ }
        return gData;
      }

      if (!gErr && !gData) {
        // La consulta fue exitosa pero no encontró nada → el código realmente no existe
        throw new Error("El código de invitación no existe.");
      }

      // Si hubo un error de Supabase, loguear y caer al fallback local
      console.warn("Error de Supabase al buscar grupo, intentando local:", gErr);
    } catch (e) {
      // Si el error es uno que ya lanzamos nosotros, re-lanzar
      if (e.message === "Ya eres miembro o tienes una solicitud pendiente para este grupo." ||
          e.message === "El código de invitación no existe." ||
          e.message === "Error al enviar la solicitud. Intenta de nuevo.") {
        throw e;
      }
      // Error de red/conexión — intentar fallback local
      console.warn("Fallo de red en joinGroup, intentando localStorage:", e.message);
    }

    // Fallback: buscar en localStorage (solo funciona para grupos creados localmente)
    const localGroups = JSON.parse(localStorage.getItem(`academic_groups_${user.id}`)) || [];
    const localMembers = JSON.parse(localStorage.getItem(`academic_members_${user.id}`)) || [];

    const targetGroup = localGroups.find(g => g.codigo_invitacion === cleanedCode);
    if (!targetGroup) {
      throw new Error("El código de invitación no existe.");
    }

    const alreadyMember = localMembers.find(m => m.id_grupo === targetGroup.id_grupo && m.user_id === user.id);
    if (alreadyMember) {
      if (alreadyMember.estado === 'aceptado') {
        setActiveGroupId(targetGroup.id_grupo);
        throw new Error("Ya eres miembro de este grupo.");
      } else {
        throw new Error("Tu solicitud de ingreso ya está pendiente de aprobación.");
      }
    }

    const newMember = {
      id_miembro: `memb-${Date.now()}`,
      id_grupo: targetGroup.id_grupo,
      user_id: user.id,
      user_name: user.user_metadata?.full_name || 'Mi Usuario',
      user_email: user.email,
      estado: 'pendiente',
      notificaciones_activas: true,
      user_avatar: user.user_metadata?.avatar_url || null,
      user_carrera: user.user_metadata?.carrera || null,
      user_universidad: user.user_metadata?.universidad || null,
      user_anio: user.user_metadata?.anio_ingreso || null,
      user_bio: user.user_metadata?.bio || null
    };

    localStorage.setItem(`academic_members_${user.id}`, JSON.stringify([...localMembers, newMember]));
    loadLocalData();
    return targetGroup;
  };

  // 3. Enviar Mensaje
  const sendGroupMessage = async (groupId, texto) => {
    const senderName = user.user_metadata?.full_name?.split(' ')[0] || 'Usuario';
    
    if (isFallbackMode) {
      const localMessages = JSON.parse(localStorage.getItem(`academic_messages_${user.id}`)) || [];
      const newMsg = {
        id_mensaje: `msg-${Date.now()}`,
        id_grupo: groupId,
        user_id: user.id,
        user_name: senderName,
        texto,
        fecha_envio: new Date().toISOString()
      };

      localStorage.setItem(`academic_messages_${user.id}`, JSON.stringify([...localMessages, newMsg]));
      loadLocalData();
      return newMsg;
    } else {
      try {
        const { data: msgData, error: msgErr } = await supabase
          .from('chat_mensajes')
          .insert([{
            id_grupo: groupId,
            user_id: user.id,
            user_name: senderName,
            texto
          }])
          .select()
          .single();

        if (msgErr) throw msgErr;
        await loadSupabaseData();
        return msgData;
      } catch (e) {
        alert("Error al enviar mensaje: " + e.message);
      }
    }
  };

  // 4. Cambiar Notificaciones
  const toggleGroupNotifications = async (groupId, enabled) => {
    // Actualizar estado en UI rápido
    setGroups(prev => prev.map(g => 
      g.id_grupo === groupId 
        ? { ...g, membership: { ...g.membership, notificaciones_activas: enabled } } 
        : g
    ));

    if (isFallbackMode) {
      const localMembers = JSON.parse(localStorage.getItem(`academic_members_${user.id}`)) || [];
      const updated = localMembers.map(m => 
        (m.id_grupo === groupId && m.user_id === user.id) 
          ? { ...m, notificaciones_activas: enabled } 
          : m
      );
      localStorage.setItem(`academic_members_${user.id}`, JSON.stringify(updated));
      loadLocalData();
    } else {
      try {
        const { error } = await supabase
          .from('chat_miembros')
          .update({ notificaciones_activas: enabled })
          .eq('id_grupo', groupId)
          .eq('user_id', user.id);

        if (error) throw error;
        await loadSupabaseData();
      } catch (e) {
        console.error("Error al actualizar notificaciones:", e);
      }
    }
  };

  // 5. Aceptar Miembro
  const approveMemberRequest = async (memberId) => {
    if (isFallbackMode) {
      const localMembers = JSON.parse(localStorage.getItem(`academic_members_${user.id}`)) || [];
      const updated = localMembers.map(m => 
        m.id_miembro === memberId ? { ...m, estado: 'aceptado' } : m
      );
      localStorage.setItem(`academic_members_${user.id}`, JSON.stringify(updated));
      loadLocalData();
    } else {
      try {
        const { error } = await supabase
          .from('chat_miembros')
          .update({ estado: 'aceptado' })
          .eq('id_miembro', memberId);

        if (error) throw error;
        await loadSupabaseData();
      } catch (e) {
        alert("Error al aprobar solicitud: " + e.message);
      }
    }
  };

  // 6. Rechazar Miembro
  const rejectMemberRequest = async (memberId) => {
    if (isFallbackMode) {
      const localMembers = JSON.parse(localStorage.getItem(`academic_members_${user.id}`)) || [];
      const updated = localMembers.filter(m => m.id_miembro !== memberId);
      localStorage.setItem(`academic_members_${user.id}`, JSON.stringify(updated));
      loadLocalData();
    } else {
      try {
        const { error } = await supabase
          .from('chat_miembros')
          .delete()
          .eq('id_miembro', memberId);

        if (error) throw error;
        await loadSupabaseData();
      } catch (e) {
        alert("Error al rechazar solicitud: " + e.message);
      }
    }
  };

  // --- MÉTODOS DE SIMULACIÓN PARA DEMO (WOW FACTOR) ---

  // Simular una solicitud de ingreso de otro alumno
  const simulateRequest = (groupId) => {
    const names = ['Carlos Muñoz', 'Sofía Rojas', 'Sebastián Vera', 'Valentina Silva', 'Diego Torres'];
    const selectedName = names[Math.floor(Math.random() * names.length)];
    const email = `${selectedName.toLowerCase().replace(' ', '.')}@universidad.cl`;
    const randId = `mock-${Math.floor(Math.random() * 10000)}`;

    const careers = ['Medicina', 'Ingeniería Civil Informática', 'Derecho', 'Arquitectura', 'Diseño Gráfico', 'Psicología', 'Kinesiología'];
    const universities = ['Universidad de Chile', 'Pontificia Universidad Católica', 'Universidad de Santiago', 'Universidad de Concepción'];
    const years = ['1er Año', '2do Año', '3er Año', '4to Año', '5to Año'];
    const bios = [
      '¡Hola! Busco compañeros para repasar materia y preparar las pruebas semanales.',
      'Hola, soy bien activo y me gusta compartir resúmenes en PDF.',
      'Quiero colaborar resolviendo guías de ejercicios.',
      'Hola! Busco grupo para repasar y aclarar dudas difíciles.'
    ];
    const presets = [
      'linear-gradient(135deg, #ec4899, #f43f5e)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #f59e0b, #eab308)',
      'linear-gradient(135deg, #ef4444, #f97316)',
      'linear-gradient(135deg, #6366f1, #a855f7)'
    ];

    const randomCareer = careers[Math.floor(Math.random() * careers.length)];
    const randomUni = universities[Math.floor(Math.random() * universities.length)];
    const randomYear = years[Math.floor(Math.random() * years.length)];
    const randomBio = bios[Math.floor(Math.random() * bios.length)];
    const randomAvatar = presets[Math.floor(Math.random() * presets.length)];

    const targetGroup = groups.find(g => g.id_grupo === groupId);
    if (!targetGroup) return;

    if (isFallbackMode) {
      const localMembers = JSON.parse(localStorage.getItem(`academic_members_${user.id}`)) || [];
      
      // Evitar duplicados
      if (localMembers.some(m => m.id_grupo === groupId && m.user_name === selectedName)) return;

      const newRequest = {
        id_miembro: `memb-sim-${randId}`,
        id_grupo: groupId,
        user_id: `user-sim-${randId}`,
        user_name: selectedName,
        user_email: email,
        estado: 'pendiente',
        notificaciones_activas: true,
        user_avatar: randomAvatar,
        user_carrera: randomCareer,
        user_universidad: randomUni,
        user_anio: randomYear,
        user_bio: randomBio
      };

      localStorage.setItem(`academic_members_${user.id}`, JSON.stringify([...localMembers, newRequest]));
      loadLocalData();
      addNotification(
        'Nueva Solicitud de Chat', 
        `${selectedName} quiere unirse a tu grupo de "${targetGroup.titulo}"`, 
        'info'
      );
    } else {
      // Si estamos en Supabase, simulamos insertando en Supabase directamente
      supabase.from('chat_miembros').insert([{
        id_grupo: groupId,
        user_id: null, // Sin ID real de auth para evitar conflictos
        user_name: selectedName,
        user_email: email,
        estado: 'pendiente',
        notificaciones_activas: true,
        user_avatar: randomAvatar,
        user_carrera: randomCareer,
        user_universidad: randomUni,
        user_anio: randomYear,
        user_bio: randomBio
      }]).then(({ error }) => {
        if (!error) {
          loadSupabaseData();
          addNotification(
            'Nueva Solicitud de Chat', 
            `${selectedName} quiere unirse a tu grupo de "${targetGroup.titulo}"`, 
            'info'
          );
        }
      });
    }
  };

  // Simular un mensaje entrante de otro miembro del grupo con opción de retardo
  const simulateIncomingMessage = (groupId, customText = '', delaySeconds = 0) => {
    const trigger = () => {
      setGroups((prevGroups) => {
        const targetGroup = prevGroups.find(g => g.id_grupo === groupId);
        if (!targetGroup) return prevGroups;

        // Verificar si el usuario tiene notificaciones activas para este grupo
        const notificationsEnabled = targetGroup.membership?.notificaciones_activas !== false;

        const senders = [
          { name: 'Juan Pérez', id: 'mock-user-1' },
          { name: 'Sofía Rojas', id: 'mock-user-sofia' },
          { name: 'Carlos Muñoz', id: 'mock-user-carlos' }
        ];
        const sender = senders[Math.floor(Math.random() * senders.length)];
        
        const messagesPool = [
          '¿Qué capítulo entra en la prueba del lunes?',
          'Subí un resumen de la materia en la sección de apuntes.',
          '¿Alguien tiene dudas con la guía 3?',
          '¿Nos juntamos a repasar en la biblioteca más tarde?',
          '¡Ojo que cambiaron la fecha del examen!',
          '¿Alguien resolvió el ejercicio 5?'
        ];
        const text = customText || messagesPool[Math.floor(Math.random() * messagesPool.length)];

        if (isFallbackMode) {
          const localMessages = JSON.parse(localStorage.getItem(`academic_messages_${user.id}`)) || [];
          const newMsg = {
            id_mensaje: `msg-sim-${Date.now()}`,
            id_grupo: groupId,
            user_id: sender.id,
            user_name: sender.name,
            texto: text,
            fecha_envio: new Date().toISOString()
          };

          localStorage.setItem(`academic_messages_${user.id}`, JSON.stringify([...localMessages, newMsg]));
          loadLocalData();

          // Lanzar notificación si está habilitada para el grupo y el usuario no está en esta pantalla/grupo
          setActiveGroupId((currentActiveId) => {
            const isViewingThisGroupChat = currentActiveId === groupId;
            const isChatsTabOpen = window.location.pathname === '/chats';

            if (notificationsEnabled && (!isViewingThisGroupChat || !isChatsTabOpen)) {
              addNotification(
                `Nuevo mensaje en ${targetGroup.titulo}`,
                `${sender.name}: "${text.substring(0, 45)}${text.length > 45 ? '...' : ''}"`,
                'chat'
              );
            }
            return currentActiveId;
          });
        } else {
          // Simular en Supabase
          supabase.from('chat_mensajes').insert([{
            id_grupo: groupId,
            user_name: sender.name,
            texto: text,
            user_id: null // Mensaje externo
          }]).then(({ error }) => {
            if (!error) {
              loadSupabaseData();
              
              setActiveGroupId((currentActiveId) => {
                const isViewingThisGroupChat = currentActiveId === groupId;
                const isChatsTabOpen = window.location.pathname === '/chats';

                if (notificationsEnabled && (!isViewingThisGroupChat || !isChatsTabOpen)) {
                  addNotification(
                    `Nuevo mensaje en ${targetGroup.titulo}`,
                    `${sender.name}: "${text.substring(0, 45)}${text.length > 45 ? '...' : ''}"`,
                    'chat'
                  );
                }
                return currentActiveId;
              });
            }
          });
        }
        return prevGroups;
      });
    };

    if (delaySeconds > 0) {
      setTimeout(trigger, delaySeconds * 1000);
    } else {
      trigger();
    }
  };

  // --- LIBRARY METHODS ---

  const fetchLibraryItems = async (groupId) => {
    if (isFallbackMode) {
      const localItems = JSON.parse(localStorage.getItem(`academic_library_${user.id}`)) || [];
      const groupItems = localItems.filter(item => item.group_id === groupId);
      const localRatings = JSON.parse(localStorage.getItem(`academic_library_ratings_${user.id}`)) || [];

      return groupItems.map(item => {
        const itemRatings = localRatings.filter(r => r.item_id === item.id);
        const avg = itemRatings.length > 0
          ? itemRatings.reduce((sum, r) => sum + r.rating, 0) / itemRatings.length
          : 0;
        const userRatingObj = itemRatings.find(r => r.user_id === user.id);
        return {
          ...item,
          avg_rating: avg,
          total_ratings: itemRatings.length,
          user_rating: userRatingObj ? userRatingObj.rating : 0
        };
      });
    } else {
      try {
        const { data: items, error: itemsErr } = await supabase
          .from('group_library')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });

        if (itemsErr) throw itemsErr;

        if (items && items.length > 0) {
          const itemIds = items.map(item => item.id);
          const { data: ratings, error: ratingsErr } = await supabase
            .from('library_ratings')
            .select('*')
            .in('item_id', itemIds);

          if (ratingsErr) throw ratingsErr;

          return items.map(item => {
            const itemRatings = ratings ? ratings.filter(r => r.item_id === item.id) : [];
            const avg = itemRatings.length > 0
              ? itemRatings.reduce((sum, r) => sum + r.rating, 0) / itemRatings.length
              : 0;
            const userRatingObj = itemRatings.find(r => r.user_id === user.id);
            return {
              ...item,
              avg_rating: avg,
              total_ratings: itemRatings.length,
              user_rating: userRatingObj ? userRatingObj.rating : 0
            };
          });
        }
        return [];
      } catch (err) {
        console.error("Error fetching library items:", err);
        return [];
      }
    }
  };

  const shareItemInLibrary = async (groupId, itemData) => {
    const senderName = user.user_metadata?.full_name?.split(' ')[0] || 'Compañero';
    
    if (isFallbackMode) {
      const localItems = JSON.parse(localStorage.getItem(`academic_library_${user.id}`)) || [];
      const newItem = {
        id: `lib-${Date.now()}`,
        group_id: groupId,
        user_id: user.id,
        user_name: senderName,
        title: itemData.title,
        description: itemData.description,
        content_type: itemData.content_type,
        content_data: itemData.content_data,
        file_url: itemData.file_url || null,
        created_at: new Date().toISOString()
      };
      
      const updated = [newItem, ...localItems];
      localStorage.setItem(`academic_library_${user.id}`, JSON.stringify(updated));
      return newItem;
    } else {
      try {
        const { data, error } = await supabase
          .from('group_library')
          .insert([{
            group_id: groupId,
            user_id: user.id,
            user_name: senderName,
            title: itemData.title,
            description: itemData.description,
            content_type: itemData.content_type,
            content_data: itemData.content_data,
            file_url: itemData.file_url || null
          }])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.error("Error sharing item in library:", err);
        throw err;
      }
    }
  };

  const rateLibraryItem = async (itemId, ratingScore) => {
    if (isFallbackMode) {
      const localRatings = JSON.parse(localStorage.getItem(`academic_library_ratings_${user.id}`)) || [];
      const existingIdx = localRatings.findIndex(r => r.item_id === itemId && r.user_id === user.id);
      
      if (existingIdx > -1) {
        localRatings[existingIdx].rating = ratingScore;
      } else {
        localRatings.push({
          id: `rating-${Date.now()}`,
          item_id: itemId,
          user_id: user.id,
          rating: ratingScore,
          created_at: new Date().toISOString()
        });
      }
      
      localStorage.setItem(`academic_library_ratings_${user.id}`, JSON.stringify(localRatings));
      return { success: true };
    } else {
      try {
        const { data, error } = await supabase
          .from('library_ratings')
          .upsert({
            item_id: itemId,
            user_id: user.id,
            rating: ratingScore
          }, {
            onConflict: 'item_id,user_id'
          })
          .select();
          
        if (error) throw error;
        return data;
      } catch (err) {
        console.error("Error rating library item:", err);
        throw err;
      }
    }
  };

  return (
    <GroupChatContext.Provider value={{
      groups,
      activeGroupId,
      setActiveGroupId,
      messages,
      pendingRequests,
      activeGroupMembers,
      isFallbackMode,
      loading,
      createGroup,
      joinGroup,
      sendGroupMessage,
      toggleGroupNotifications,
      approveMemberRequest,
      rejectMemberRequest,
      simulateRequest,
      simulateIncomingMessage,
      fetchLibraryItems,
      shareItemInLibrary,
      rateLibraryItem
    }}>
      {children}
    </GroupChatContext.Provider>
  );
};
