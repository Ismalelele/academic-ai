import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, Calendar, ListTodo, Sun, Moon, Bell, Trash2, CheckCircle, BellRing,
  BookOpenText, GraduationCap, Bot, Send, MessageCircle, Sparkles, MessageSquare, X,
  ChevronLeft, ChevronRight, Settings, Camera, User, Check, Mic, ChevronUp, ChevronDown,
  AlertTriangle
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';
import { useGroupChat } from '../context/GroupChatContext';
import { askDashboardGroq } from '../utils/aiProcessor';
import { addStudyMinutes } from '../utils/studyTracker';
import { supabase } from '../lib/supabase';

export default function Nav({ isDarkMode, toggleTheme }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const navigate = useNavigate();
  const { setActiveGroupId } = useGroupChat();

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const { user, signOut, updateProfile } = useAuth();
  const { notifications, unreadCount, markAsRead, deleteNotification, dailyAlertTime, setDailyAlertTime } = useNotifications();
  const [toasts, setToasts] = useState([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [notifFilter, setNotifFilter] = useState('all');
  const showToast = (message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const markAllAsRead = () => {
    notifications.forEach(n => {
      if (!n.read) markAsRead(n.id);
    });
  };

  useEffect(() => {
    if (showNotifications && unreadCount > 0) {
      markAllAsRead();
    }
  }, [showNotifications, unreadCount]);

  const toggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
    setSelectedIds(new Set());
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  const performDelete = () => {
    selectedIds.forEach(id => deleteNotification(id));
    setIsDeleteMode(false);
    setSelectedIds(new Set());
  };
  const { effectiveSchedule } = useSchedule();
  const { tasks } = useTasks();

  const notifRef = useRef();
  const chatbotRef = useRef();
  const chatbotBodyRef = useRef();
  const profileRef = useRef();
  const navLinksRef = useRef();
  const academicoRef = useRef();
  const iaRef = useRef();
  const comunidadRef = useRef();
  const notifPanelRef = useRef();
  const chatbotPanelRef = useRef();
  const profilePopoverRef = useRef();
  const sidebarRef = useRef();

  const isAcademicoActive = ['/horario', '/clases', '/apuntes', '/calificaciones'].includes(currentPath);
  const isIaActive = ['/asistente', '/analisis'].includes(currentPath);
  const isComunidadActive = ['/chats'].includes(currentPath);

  const handleDropdownToggle = (menuName) => {
    setActiveDropdown(prev => prev === menuName ? null : menuName);
    setShowNotifications(false);
    setShowChatbot(false);
    setShowProfilePopover(false);
  };

  // Profile settings states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileCarrera, setProfileCarrera] = useState('');
  const [profileUniversidad, setProfileUniversidad] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileAnio, setProfileAnio] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState(null);

  // Admin testing states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminNotifTitle, setAdminNotifTitle] = useState('Prueba del Sistema');
  const [adminNotifMessage, setAdminNotifMessage] = useState('Esta es una notificación de prueba.');
  const [adminNotifType, setAdminNotifType] = useState('info');
  const [adminStatus, setAdminStatus] = useState('');

  const handleAdminSend = async (e) => {
    e.preventDefault();
    setAdminStatus('Enviando...');
    try {
      let userIds = [];
      const { data: subs } = await supabase.from('push_subscriptions').select('user_id');
      if (subs && subs.length > 0) {
         userIds = [...new Set(subs.map(s => s.user_id))];
      } else {
         const { data: members } = await supabase.from('chat_miembros').select('user_id');
         if (members) userIds = [...new Set(members.map(m => m.user_id))];
      }
      
      if (!userIds.length) {
         setAdminStatus('Error: no se encontraron usuarios.');
         return;
      }
      
      const insertData = userIds.map(id => ({
         user_id: id,
         titulo: adminNotifTitle,
         mensaje: adminNotifMessage,
         tipo: adminNotifType,
         leida: false
      }));
      
      const { error: insErr } = await supabase.from('notificaciones').insert(insertData);
      if (insErr) throw insErr;
      
      setAdminStatus('¡Enviado a ' + userIds.length + ' usuarios!');
      setTimeout(() => setShowAdminModal(false), 2000);
    } catch (err) {
      setAdminStatus('Error: ' + err.message);
    }
  };

  const presetGradients = [
    'linear-gradient(135deg, #8b5cf6, #38bdf8)', // Violet-Blue
    'linear-gradient(135deg, #ec4899, #f43f5e)', // Pink-Rose
    'linear-gradient(135deg, #10b981, #059669)', // Green-DarkGreen
    'linear-gradient(135deg, #f59e0b, #eab308)', // Amber-Yellow
    'linear-gradient(135deg, #ef4444, #f97316)', // Red-Orange
    'linear-gradient(135deg, #6366f1, #a855f7)'  // Indigo-Purple
  ];

  const renderAvatar = (avatarUrl, name, size = '38px', fontSize = '1.1rem') => {
    const isGradient = avatarUrl && avatarUrl.startsWith('linear-gradient');
    const hasAvatar = avatarUrl && !isGradient;

    if (hasAvatar) {
      return (
        <img
          src={avatarUrl}
          alt="Avatar"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid var(--primary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
        />
      );
    }

    const gradient = isGradient ? avatarUrl : 'linear-gradient(135deg, #8b5cf6, #38bdf8)';
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: fontSize,
          border: '2px solid var(--primary)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
      >
        {(name || 'U').charAt(0).toUpperCase()}
      </div>
    );
  };

  const openSettingsModal = () => {
    setProfileName(user?.user_metadata?.full_name || '');
    setProfileCarrera(user?.user_metadata?.carrera || '');
    setProfileUniversidad(user?.user_metadata?.universidad || '');
    setProfileAvatar(user?.user_metadata?.avatar_url || '');
    setProfileAnio(user?.user_metadata?.anio_ingreso || '1er Año');
    setProfileBio(user?.user_metadata?.bio || '');
    setProfileStatus(null);
    setShowSettingsModal(true);
    setShowProfilePopover(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setProfileStatus({ text: "El nombre no puede estar vacío", type: "error" });
      return;
    }

    setIsSavingProfile(true);
    setProfileStatus(null);

    const { data, error } = await updateProfile({
      full_name: profileName,
      carrera: profileCarrera,
      universidad: profileUniversidad,
      avatar_url: profileAvatar,
      anio_ingreso: profileAnio,
      bio: profileBio
    });

    setIsSavingProfile(false);

    if (error) {
      setProfileStatus({ text: "Error al guardar: " + error.message, type: "error" });
    } else {
      setProfileStatus({ text: "¡Perfil actualizado con éxito!", type: "success" });
      setTimeout(() => {
        setShowSettingsModal(false);
      }, 1500);
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      setProfileStatus({ text: "La imagen es muy grande (máx 200KB)", type: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const closeMenu = () => {
    setShowProfilePopover(false);
    setShowNotifications(false);
    setShowChatbot(false);
    setActiveDropdown(null);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  const scrollNav = (direction) => {
    if (navLinksRef.current) {
      const scrollAmount = 200;
      navLinksRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = sessionStorage.getItem('global_chatbot_chat');
    return saved ? JSON.parse(saved) : [
      { sender: 'ai', text: `¡Hola! Soy tu asistente de AcademicAI. ¿Tienes alguna pregunta sobre tus tareas o asignaturas?` }
    ];
  });
  const [showChatTooltip, setShowChatTooltip] = useState(() => {
    return sessionStorage.getItem('global_chatbot_tooltip_dismissed') !== 'true';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsSidebarOpen(true);
        document.body.classList.remove('sidebar-collapsed');
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [isSidebarOpen]);

  const activeTasks = tasks.filter(t => t.status !== 'done');
  const completedTasksCount = tasks.filter(t => t.status === 'done').length;
  const unreadChatCount = (notifications || []).filter(n => n.type && n.type.startsWith('chat:') && !n.read).length;
  const unreadRequestCount = (notifications || []).filter(n => n.type && n.type.startsWith('request:') && !n.read).length;
  const totalComunidadCount = unreadChatCount + unreadRequestCount;

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ocultar sidebar si está abierto en móvil y hacemos clic fuera
      if (
        window.innerWidth <= 768 &&
        isSidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        !event.target.closest('.open-btn')
      ) {
        setIsSidebarOpen(false);
      }

      if (
        notifRef.current && !notifRef.current.contains(event.target) &&
        (!notifPanelRef.current || !notifPanelRef.current.contains(event.target))
      ) {
        setShowNotifications(false);
      }
      if (
        chatbotRef.current && !chatbotRef.current.contains(event.target) &&
        (!chatbotPanelRef.current || !chatbotPanelRef.current.contains(event.target))
      ) {
        setShowChatbot(false);
      }
      if (
        profileRef.current && !profileRef.current.contains(event.target) &&
        (!profilePopoverRef.current || !profilePopoverRef.current.contains(event.target))
      ) {
        setShowProfilePopover(false);
      }
      if (
        !academicoRef.current?.contains(event.target) &&
        !iaRef.current?.contains(event.target) &&
        !comunidadRef.current?.contains(event.target)
      ) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSidebarOpen]);

  useEffect(() => {
    if (chatbotBodyRef.current) {
      chatbotBodyRef.current.scrollTop = chatbotBodyRef.current.scrollHeight;
    }
    sessionStorage.setItem('global_chatbot_chat', JSON.stringify(chatHistory));
  }, [chatHistory, showChatbot]);

  const handleToggleChatbot = () => {
    setShowChatbot(!showChatbot);
    setShowChatTooltip(false);
    sessionStorage.setItem('global_chatbot_tooltip_dismissed', 'true');
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userText = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userText }]);
    setIsChatting(true);
    addStudyMinutes(user?.id, 2); // 2 active cognitive minutes per chat interaction

    try {
      const taskNames = activeTasks.length > 0 ? activeTasks.map(t => t.title).join(', ') : 'Ninguna';
      const context = `El usuario tiene ${activeTasks.length} tareas pendientes (${taskNames}) y ${completedTasksCount} completadas.`;
      const response = await askDashboardGroq(userText, context);
      setChatHistory(prev => [...prev, { sender: 'ai', text: response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: 'Error al conectar con la IA.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  const getIconForType = (type) => {
    if (!type) return '💡';
    const prefix = type.split(':')[0];
    switch (prefix) {
      case 'clase': return '📚';
      case 'urgente': return '⚠️';
      case 'tarea': return '📝';
      case 'chat': return '💬';
      case 'pizarra': return '🎨';
      case 'request': return '👤';
      default: return '💡';
    }
  };

  const handleNotificationClick = (n) => {
    if (!n.read) {
      markAsRead(n.id);
    }
    if (n.type) {
      const parts = n.type.split(':');
      const prefix = parts[0];
      const groupId = parts[1];
      if (groupId) {
        if (prefix === 'pizarra') {
          localStorage.setItem('academic_group_pending_subtab', 'board');
          setActiveGroupId(groupId);
          navigate('/chats');
          setShowNotifications(false);
        } else if (prefix === 'chat') {
          localStorage.setItem('academic_group_pending_subtab', 'chat');
          setActiveGroupId(groupId);
          navigate('/chats');
          setShowNotifications(false);
        } else if (prefix === 'request') {
          localStorage.setItem('academic_group_pending_activetab', 'solicitudes');
          setActiveGroupId(groupId);
          navigate('/chats');
          setShowNotifications(false);
        }
      }
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString();
  };

  const renderNotificationPanel = () => {
    const displayedNotifications = notifications.filter(n => {
      if (notifFilter === 'all') return true;
      const isChat = n.type && n.type.startsWith('chat:');
      if (notifFilter === 'chat') return isChat;
      if (notifFilter === 'warning') return !isChat;
      return true;
    });

    return (
      <div className="notification-panel" ref={notifPanelRef}>
        <div className="notification-header">
          <h3>Notificaciones</h3>
          <span className="badge">{unreadCount} nuevas</span>
        </div>

        <div className="notif-filter-tabs">
          <button
            className={`notif-filter-tab ${notifFilter === 'all' ? 'active' : ''}`}
            onClick={() => setNotifFilter('all')}
            title="Todas las notificaciones"
          >
            <Bell size={16} />
          </button>
          <button
            className={`notif-filter-tab ${notifFilter === 'chat' ? 'active' : ''}`}
            onClick={() => setNotifFilter('chat')}
            title="Chats"
          >
            <MessageCircle size={16} />
          </button>
          <button
            className={`notif-filter-tab ${notifFilter === 'warning' ? 'active' : ''}`}
            onClick={() => setNotifFilter('warning')}
            title="Alertas y Sistema"
          >
            <AlertTriangle size={16} />
          </button>
        </div>

        {notifications.length > 0 && (
          <div className="notification-panel-actions" style={{ padding: '8px 16px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', justifyContent: 'space-between', alignItems: 'center' }}>
            {isDeleteMode ? (
              <button
                onClick={() => {
                  const visibleIds = displayedNotifications.map(n => n.id);
                  const allVisibleSelected = visibleIds.every(id => selectedIds.has(id));
                  if (allVisibleSelected) {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      visibleIds.forEach(id => next.delete(id));
                      return next;
                    });
                  } else {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      visibleIds.forEach(id => next.add(id));
                      return next;
                    });
                  }
                }}
                className="premium-action-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {displayedNotifications.map(n => n.id).every(id => selectedIds.has(id)) ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
            ) : (
              <button
                onClick={markAllAsRead}
                className="premium-action-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Marcar todas leídas
              </button>
            )}

            <button
              onClick={isDeleteMode ? (selectedIds.size > 0 ? performDelete : toggleDeleteMode) : toggleDeleteMode}
              className={selectedIds.size > 0 ? "delete-btn-active" : "delete-btn-inactive"}
              style={{
                background: isDeleteMode ? (selectedIds.size > 0 ? '#ef4444' : 'rgba(239,68,68,0.1)') : 'rgba(255,255,255,0.05)',
                border: isDeleteMode ? (selectedIds.size > 0 ? 'none' : '1px solid rgba(239,68,68,0.2)') : '1px solid var(--border-color)',
                color: isDeleteMode ? (selectedIds.size > 0 ? 'white' : '#ef4444') : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: '700',
                padding: '4px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {isDeleteMode ? (selectedIds.size > 0 ? `Eliminar (${selectedIds.size})` : "Cancelar") : "Eliminar"}
            </button>
          </div>
        )}

        <div className="notification-list">
          {displayedNotifications.length === 0 ? (
            <div className="notification-empty-state">
              {notifFilter === 'chat' ? <MessageCircle size={40} /> : notifFilter === 'warning' ? <AlertTriangle size={40} /> : <Bell size={40} />}
              <p>{notifFilter === 'chat' ? 'No hay chats nuevos' : notifFilter === 'warning' ? 'No hay alertas' : 'Sin notificaciones'}</p>
              <span>{notifFilter === 'chat' ? 'Aquí verás los mensajes de tus grupos de estudio.' : notifFilter === 'warning' ? 'Aquí se muestran tus avisos de clases y recordatorios.' : 'Te mantendremos al tanto de tus clases y tareas.'}</span>
            </div>
          ) : (
            displayedNotifications.map(n => {
              const isClickable = n.type && (n.type.startsWith('pizarra:') || n.type.startsWith('chat:') || n.type.startsWith('request:'));
              const isSelected = selectedIds.has(n.id);
              
              // Determinar color bar
              const prefix = n.type ? n.type.split(':')[0] : 'info';
              let typeClass = 'info';
              if (prefix === 'chat') typeClass = 'chat';
              else if (prefix === 'urgente' || prefix === 'tarea') typeClass = 'urgente';
              else if (prefix === 'clase') typeClass = 'clase';
              else if (prefix === 'estudio') typeClass = 'estudio';

              return (
                <div key={n.id} className={`notification-item ${n.read ? 'read' : 'unread'} ${isSelected ? 'selected' : ''}`} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div className={`notification-type-bar ${typeClass}`} />
                  {isDeleteMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const newSet = new Set(selectedIds);
                        if (newSet.has(n.id)) {
                          newSet.delete(n.id);
                        } else {
                          newSet.add(n.id);
                        }
                        setSelectedIds(newSet);
                      }}
                      style={{
                        cursor: 'pointer',
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: '2px solid var(--border-color)',
                        flexShrink: 0
                      }}
                    />
                  )}
                  <div className="notification-icon">{getIconForType(n.type)}</div>
                  <div
                    className="notification-content"
                    style={{ cursor: isClickable ? 'pointer' : 'default', flexGrow: 1 }}
                    onClick={() => isClickable && handleNotificationClick(n)}
                  >
                    <h4>{n.title}</h4>
                    <p style={{ whiteSpace: 'pre-line' }}>{n.message}</p>
                    <span className="notification-time">{formatDate(n.createdAt)}</span>
                  </div>
                  {!isDeleteMode && (
                    <div className="notification-actions">
                      {!n.read && (
                        <button onClick={() => markAsRead(n.id)} title="Marcar como leída">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button onClick={() => deleteNotification(n.id)} title="Eliminar" className="btn-delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {!isSidebarOpen && createPortal(
        <button
          className="sidebar-toggle-btn open-btn mobile-only"
          onClick={() => setIsSidebarOpen(true)}
          title="Mostrar menú"
          style={{
            position: 'fixed',
            top: '12px',
            left: '12px',
            zIndex: 9999,
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            cursor: 'pointer'
          }}
        >
          <ChevronRight size={20} />
        </button>,
        document.body
      )}

      <nav ref={sidebarRef} className={`sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
        {/* Botón para cerrar (solo móvil) */}
        <button
          className="sidebar-toggle-btn close-btn mobile-only"
          onClick={() => setIsSidebarOpen(false)}
          title="Ocultar menú"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            marginBottom: '10px',
            marginTop: '5px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <ChevronLeft size={20} />
        </button>

        {/* Logo (Desktop only) */}
        <div className="logo desktop-only">
          <h2>Academic<span>AI</span></h2>
        </div>

        {/* Navigation Scroll Wrap */}
        <div className="nav-scroll-wrap">

          {/* Links Navigation */}
          <ul className="nav-links" ref={navLinksRef} style={{ overflow: 'visible' }}>
            {/* Dashboard */}
            <li>
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                <LayoutDashboard size={18} /> <span>Dashboard</span>
              </NavLink>
            </li>

            {/* Académico */}
            <li className="nav-dropdown-container" ref={academicoRef} style={{ position: 'relative' }}>
              <button
                className={`nav-dropdown-trigger ${isAcademicoActive ? 'active' : ''} ${activeDropdown === 'academico' ? 'open' : ''}`}
                onClick={() => handleDropdownToggle('academico')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <GraduationCap size={18} /> <span>Académico</span>
                <ChevronDown size={14} className="chevron-icon" />
              </button>
              {activeDropdown === 'academico' && (
                <ul className="nav-submenu">
                  <li>
                    <NavLink to="/horario" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                      <Calendar size={16} /> <span>Horario</span>
                      <ChevronRight size={12} className="submenu-arrow" style={{ marginLeft: 'auto', opacity: 0.4 }} />
                    </NavLink>
                  </li>

                  {effectiveSchedule && effectiveSchedule.length > 0 && (
                    <>
                      <li>
                        <NavLink to="/clases" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                          <Mic size={16} /> <span>Clases Grabadas</span>
                          <ChevronRight size={12} className="submenu-arrow" style={{ marginLeft: 'auto', opacity: 0.4 }} />
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/apuntes" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                          <BookOpenText size={16} /> <span>Apuntes</span>
                          <ChevronRight size={12} className="submenu-arrow" style={{ marginLeft: 'auto', opacity: 0.4 }} />
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/calificaciones" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                          <GraduationCap size={16} /> <span>Promedio</span>
                          <ChevronRight size={12} className="submenu-arrow" style={{ marginLeft: 'auto', opacity: 0.4 }} />
                        </NavLink>
                      </li>
                    </>
                  )}
                </ul>
              )}
            </li>

            {/* IA */}
            <li className="nav-dropdown-container" ref={iaRef} style={{ position: 'relative' }}>
              <button
                className={`nav-dropdown-trigger ${isIaActive ? 'active' : ''} ${activeDropdown === 'ia' ? 'open' : ''}`}
                onClick={() => handleDropdownToggle('ia')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Bot size={18} /> <span>IA</span>
                <ChevronDown size={14} className="chevron-icon" />
              </button>
              {activeDropdown === 'ia' && (
                <ul className="nav-submenu">
                  <li>
                    <NavLink to="/asistente" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                      <MessageSquare size={16} /> <span>Asistente IA</span>
                      <ChevronRight size={12} className="submenu-arrow" style={{ marginLeft: 'auto', opacity: 0.4 }} />
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/analisis" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                      <Sparkles size={16} /> <span>Análisis</span>
                      <ChevronRight size={12} className="submenu-arrow" style={{ marginLeft: 'auto', opacity: 0.4 }} />
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>

            {/* Comunidad */}
            <li className="nav-dropdown-container" ref={comunidadRef} style={{ position: 'relative' }}>
              <button
                className={`nav-dropdown-trigger ${isComunidadActive ? 'active' : ''} ${activeDropdown === 'comunidad' ? 'open' : ''}`}
                onClick={() => handleDropdownToggle('comunidad')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <MessageCircle size={18} /> <span>Comunidad</span>
                {totalComunidadCount > 0 && (
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'inline-block',
                    marginLeft: '4px',
                    boxShadow: '0 0 6px #ef4444'
                  }} />
                )}
                <ChevronDown size={14} className="chevron-icon" />
              </button>
              {activeDropdown === 'comunidad' && (
                <ul className="nav-submenu">
                  <li>
                    <NavLink to="/chats" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <MessageCircle size={16} /> <span>Chats</span>
                      {unreadChatCount > 0 && (
                        <span style={{
                          background: '#ef4444',
                          color: 'white',
                          borderRadius: '50%',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: '8px',
                          boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)'
                        }}>
                          {unreadChatCount}
                        </span>
                      )}
                      <ChevronRight size={12} className="submenu-arrow" style={{ marginLeft: 'auto', opacity: 0.4 }} />
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>

            {/* Tareas */}
            <li>
              <NavLink to="/tareas" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                <ListTodo size={18} /> <span>Tareas</span>
              </NavLink>
            </li>
          </ul>
        </div>

        {/* Bottom Bar Actions (Right side) */}
        <div className="dock-actions">

          {/* Theme Toggle */}
          <div className="theme-toggle" onClick={() => { toggleTheme(); closeMenu(); }} title={isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}>
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </div>

          {/* Notifications Bell */}
          <div className="dock-notification-container" ref={notifRef} style={{ position: 'relative' }}>
            <button
              className={`dock-action-btn ${unreadCount > 0 ? 'pulse-alert' : ''}`}
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowChatbot(false);
                setShowProfilePopover(false);
              }}
              title="Notificaciones"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: showNotifications ? 'var(--primary-light)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                color: showNotifications ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                outline: 'none',
                position: 'relative'
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: '14px',
                  height: '14px',
                  fontSize: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  padding: '2px',
                  border: '1px solid var(--card-bg)'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* AI Chatbot Button */}
          <div className="dock-chatbot-container" ref={chatbotRef} style={{ position: 'relative' }}>
            {showChatTooltip && !showProfilePopover && !showNotifications && !showChatbot && (
              <div className="chatbot-tooltip">
                ¿Preguntas? ¡Escríbeme!
              </div>
            )}
            <button
              className={`dock-action-btn ${showChatbot ? 'active' : ''}`}
              onClick={() => {
                handleToggleChatbot();
                setShowNotifications(false);
                setShowProfilePopover(false);
              }}
              title="Asistente de Inteligencia Artificial"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: showChatbot ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                color: showChatbot ? 'white' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {showChatbot ? <X size={18} /> : <Bot size={18} />}
            </button>
          </div>

          {/* User Profile popover trigger */}
          {user && (
            <div className="user-profile-dock" ref={profileRef} style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setShowProfilePopover(!showProfilePopover);
                  setShowNotifications(false);
                  setShowChatbot(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  outline: 'none',
                  borderRadius: '50%'
                }}
                title={user.user_metadata?.full_name || 'Perfil'}
              >
                <div
                  style={{
                    borderRadius: '50%',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {renderAvatar(user.user_metadata?.avatar_url, user.user_metadata?.full_name, '38px', '1.1rem')}
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Profile Settings Modal */}
        {showSettingsModal && createPortal(
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)'
          }}>
            <div className="premium-modal" style={{ maxWidth: '480px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>

              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color="var(--primary)" /> Configuración de Perfil
              </h3>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px', marginBottom: '15px' }}>

                  {/* Avatar Picker */}
                  <div className="form-group-premium" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <label style={{ width: '100%', textAlign: 'left' }}>Foto de Perfil</label>
                    <div style={{ position: 'relative' }}>
                      {renderAvatar(profileAvatar, profileName || user?.user_metadata?.full_name, '80px', '2.2rem')}
                      <label style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        background: 'var(--primary)',
                        color: '#fff',
                        borderRadius: '50%',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}>
                        <Camera size={14} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selecciona un degradado premium:</span>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {presetGradients.map((grad, i) => (
                          <div
                            key={i}
                            onClick={() => setProfileAvatar(grad)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: grad,
                              cursor: 'pointer',
                              border: profileAvatar === grad ? '2px solid #fff' : '2px solid transparent',
                              boxShadow: profileAvatar === grad ? '0 0 0 2px var(--primary)' : '0 2px 4px rgba(0,0,0,0.1)',
                              transform: profileAvatar === grad ? 'scale(1.1)' : 'none',
                              transition: 'all 0.2s'
                            }}
                          />
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>O ingresa una URL de imagen externa:</span>
                        <input
                          type="text"
                          className="premium-input"
                          style={{ paddingLeft: '10px', fontSize: '0.8rem' }}
                          placeholder="https://ejemplo.com/tu-foto.jpg"
                          value={profileAvatar && !profileAvatar.startsWith('linear-gradient') && !profileAvatar.startsWith('data:image') ? profileAvatar : ''}
                          onChange={(e) => setProfileAvatar(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Nombre Completo */}
                  <div className="form-group-premium">
                    <label>Nombre Completo</label>
                    <input
                      type="text"
                      className="premium-input"
                      style={{ paddingLeft: '15px' }}
                      placeholder="Ej: Ismael Pérez"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Carrera */}
                  <div className="form-group-premium">
                    <label>Carrera / Especialidad</label>
                    <input
                      type="text"
                      className="premium-input"
                      style={{ paddingLeft: '15px' }}
                      placeholder="Ej: Ingeniería Civil Informática"
                      value={profileCarrera}
                      onChange={(e) => setProfileCarrera(e.target.value)}
                    />
                  </div>

                  {/* Universidad */}
                  <div className="form-group-premium">
                    <label>Universidad / Institución</label>
                    <input
                      type="text"
                      className="premium-input"
                      style={{ paddingLeft: '15px' }}
                      placeholder="Ej: Universidad de Chile"
                      value={profileUniversidad}
                      onChange={(e) => setProfileUniversidad(e.target.value)}
                    />
                  </div>

                  {/* Año de Ingreso / Semestre */}
                  <div className="form-group-premium">
                    <label>Nivel de Estudios / Año</label>
                    <select
                      className="premium-input"
                      style={{ paddingLeft: '15px', background: 'var(--bg)', color: 'var(--text-main)' }}
                      value={profileAnio}
                      onChange={(e) => setProfileAnio(e.target.value)}
                    >
                      <option value="1er Año">1er Año (Mechón)</option>
                      <option value="2do Año">2do Año</option>
                      <option value="3er Año">3er Año</option>
                      <option value="4to Año">4to Año</option>
                      <option value="5to Año">5to Año o más</option>
                      <option value="Egresado / Graduado">Egresado / Graduado</option>
                    </select>
                  </div>

                  {/* Biografía Académica */}
                  <div className="form-group-premium">
                    <label>Biografía o Nota de Estudio (Opcional)</label>
                    <textarea
                      className="premium-input"
                      style={{ padding: '10px 15px', minHeight: '60px', resize: 'vertical' }}
                      placeholder="Escribe algo sobre ti o tus objetivos académicos..."
                      value={profileBio}
                      onChange={(e) => setProfileBio(e.target.value)}
                    />
                  </div>

                  {/* Alarma de Tareas Urgentes */}
                  <div className="form-group-premium" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 'bold' }}>
                      <BellRing size={16} /> Alarma de Tareas Urgentes
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px', marginTop: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Notificar tareas urgentes a las:</span>
                      <input
                        type="time"
                        value={dailyAlertTime}
                        onChange={(e) => {
                          setDailyAlertTime(e.target.value);
                          showToast(`Alarma programada para las ${e.target.value}`);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '2px solid var(--primary)',
                          background: 'transparent',
                          color: 'var(--text-main)',
                          fontFamily: 'inherit',
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                        title="Configurar hora de alerta automática"
                      />
                    </div>
                  </div>

                  {/* Mensaje de Estado */}
                  {profileStatus && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      marginTop: '12px',
                      textAlign: 'center',
                      background: profileStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: profileStatus.type === 'success' ? '#10b981' : '#ef4444',
                      border: profileStatus.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                      {profileStatus.text}
                    </div>
                  )}

                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSavingProfile}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      background: 'var(--primary)',
                      border: 'none',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isSavingProfile ? 'Guardando...' : (
                      <>
                        <Check size={16} /> Guardar Cambios
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Admin Testing Modal */}
        {showAdminModal && createPortal(
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)'
          }}>
            <div className="premium-modal" style={{ maxWidth: '400px', width: '90%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <button
                onClick={() => setShowAdminModal(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>

              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} color="#eab308" /> Pruebas Globales
              </h3>

              <form onSubmit={handleAdminSend} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="form-group-premium">
                  <label>Título de Notificación</label>
                  <input
                    type="text"
                    className="premium-input"
                    value={adminNotifTitle}
                    onChange={(e) => setAdminNotifTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group-premium">
                  <label>Mensaje</label>
                  <textarea
                    className="premium-input"
                    value={adminNotifMessage}
                    onChange={(e) => setAdminNotifMessage(e.target.value)}
                    rows={3}
                    required
                  />
                </div>

                <div className="form-group-premium">
                  <label>Tipo (simulación)</label>
                  <select
                    className="premium-input"
                    value={adminNotifType}
                    onChange={(e) => setAdminNotifType(e.target.value)}
                  >
                    <option value="info">Información General</option>
                    <option value="chat:test">Chat (Mensaje Nuevo)</option>
                    <option value="urgente">Urgente / Alerta</option>
                    <option value="clase">Clase Grabada</option>
                    <option value="tarea">Tarea Pendiente</option>
                    <option value="request:test">Solicitud de Grupo</option>
                  </select>
                </div>

                {adminStatus && (
                  <div style={{
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    textAlign: 'center',
                    background: adminStatus.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    color: adminStatus.includes('Error') ? '#ef4444' : '#10b981'
                  }}>
                    {adminStatus}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: '#eab308',
                    border: 'none',
                    color: '#000',
                    marginTop: '10px'
                  }}
                >
                  Enviar a Todos
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}

        {showNotifications && createPortal(renderNotificationPanel(), document.body)}

        {showChatbot && createPortal(
          <div className="chatbot-window" ref={chatbotPanelRef}>
            <div className="chatbot-header">
              <div className="chatbot-header-info">
                <div className="chatbot-avatar">
                  <Bot size={18} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Asistente AI</h4>
                  <span className="chatbot-status" style={{ fontSize: '0.7rem' }}>En línea</span>
                </div>
              </div>
              <button className="chatbot-close-btn" onClick={() => setShowChatbot(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="chatbot-body" ref={chatbotBodyRef}>
              {chatHistory.map((msg, i) => (
                <div key={i} className={`chatbot-bubble ${msg.sender === 'user' ? 'user' : 'ai'}`}>
                  {msg.text}
                </div>
              ))}
              {isChatting && (
                <div className="chatbot-bubble ai loading">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              )}
            </div>

            <form className="chatbot-footer" onSubmit={handleChatSubmit}>
              <input
                type="text"
                placeholder="Pregúntame algo..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={isChatting}
              />
              <button type="submit" disabled={!chatInput.trim() || isChatting} className="chatbot-send-btn">
                <Send size={16} />
              </button>
            </form>
          </div>,
          document.body
        )}

        {showProfilePopover && createPortal(
          <div className="profile-popover" ref={profilePopoverRef}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {renderAvatar(user.user_metadata?.avatar_url, user.user_metadata?.full_name, '40px', '1.1rem')}
              <div style={{ overflow: 'hidden', textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                  {user.user_metadata?.full_name || 'Alumno'}
                </p>
                {(user.user_metadata?.carrera || user.user_metadata?.universidad) && (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {user.user_metadata.carrera || 'Estudiante'} {user.user_metadata.universidad ? `| ${user.user_metadata.universidad}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div style={{ height: '1px', background: 'var(--border-color)', margin: '10px 0' }}></div>
            
            {user?.email === 'jeshuacosta48@gmail.com' && (
              <button
                onClick={() => {
                  setShowProfilePopover(false);
                  setShowAdminModal(true);
                }}
                style={{
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.2)',
                  color: '#eab308',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  width: '100%',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '10px'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(234, 179, 8, 0.15)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(234, 179, 8, 0.08)'}
              >
                <AlertTriangle size={14} /> Pruebas Globales
              </button>
            )}

            <button
              onClick={openSettingsModal}
              style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                color: 'var(--primary)',
                padding: '10px 12px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
                width: '100%',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.15)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.08)'}
            >
              <Settings size={14} /> Configurar Perfil
            </button>
            <button
              onClick={signOut}
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                padding: '10px 12px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
                width: '100%',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.15)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.08)'}
            >
              Cerrar Sesión
            </button>
          </div>,
          document.body
        )}

        {createPortal(
          <div className="toast-container" style={{ zIndex: 1000000 }}>
            {toasts.map(toast => (
              <div key={toast.id} className="toast-notification">
                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                  <CheckCircle size={18} />
                </span>
                <span>{toast.message}</span>
              </div>
            ))}
          </div>,
          document.body
        )}
      </nav>
    </>
  );
}

