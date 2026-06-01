import { NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  LayoutDashboard, Calendar, ListTodo, Sun, Moon, Bell, Trash2, CheckCircle, 
  BookOpenText, GraduationCap, Bot, Send, MessageCircle, Sparkles, MessageSquare, X,
  ChevronLeft, ChevronRight, Settings, Camera, User, Check, Mic
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';
import { askDashboardGroq } from '../utils/aiProcessor';

export default function Nav({ isDarkMode, toggleTheme }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const { user, signOut, updateProfile } = useAuth();
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications();
  const { effectiveSchedule } = useSchedule();
  const { tasks } = useTasks();
  
  const notifRef = useRef();
  const chatbotRef = useRef();
  const chatbotBodyRef = useRef();
  const profileRef = useRef();
  const navLinksRef = useRef();

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

  const activeTasks = tasks.filter(t => t.status !== 'done');
  const completedTasksCount = tasks.filter(t => t.status === 'done').length;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (chatbotRef.current && !chatbotRef.current.contains(event.target)) {
        setShowChatbot(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfilePopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    switch(type) {
      case 'clase': return '📚';
      case 'urgente': return '⚠️';
      case 'tarea': return '📝';
      case 'chat': return '💬';
      default: return '💡';
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ' - ' + d.toLocaleDateString();
  };

  const renderNotificationPanel = () => (
    <div className="notification-panel">
      <div className="notification-header">
        <h3>Notificaciones</h3>
        <span className="badge">{unreadCount} nuevas</span>
      </div>
      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">No tienes notificaciones</div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`notification-item ${n.read ? 'read' : 'unread'}`}>
              <div className="notification-icon">{getIconForType(n.type)}</div>
              <div className="notification-content">
                <h4>{n.title}</h4>
                <p>{n.message}</p>
                <span className="notification-time">{formatDate(n.createdAt)}</span>
              </div>
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
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <nav className="sidebar">
      {/* Logo (Desktop only) */}
      <div className="logo desktop-only">
        <h2>Academic<span>AI</span></h2>
      </div>

      {/* Navigation Scroll Wrap */}
      <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, overflow: 'hidden', margin: '0 10px' }}>
        
        {/* Left Scroll Button */}
        <button 
          onClick={() => scrollNav('left')} 
          className="nav-scroll-btn left"
          title="Ver opciones anteriores"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Links Navigation */}
        <ul className="nav-links" ref={navLinksRef}>
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <LayoutDashboard size={18} /> <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/horario" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <Calendar size={18} /> <span>Horario</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/clases" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <Mic size={18} /> <span>Clases Grabadas</span>
            </NavLink>
          </li>
          {effectiveSchedule && effectiveSchedule.length > 0 && (
            <>
              <li>
                <NavLink to="/apuntes" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                  <BookOpenText size={18} /> <span>Apuntes</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/calificaciones" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                  <GraduationCap size={18} /> <span>Notas</span>
                </NavLink>
              </li>
            </>
          )}
          <li>
            <NavLink to="/asistente" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <MessageSquare size={18} /> <span>Asistente IA</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/analisis" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <Sparkles size={18} /> <span>Análisis</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/chats" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <MessageCircle size={18} /> <span>Chats</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/tareas" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <ListTodo size={18} /> <span>Tareas</span>
            </NavLink>
          </li>
        </ul>

        {/* Right Scroll Button */}
        <button 
          onClick={() => scrollNav('right')} 
          className="nav-scroll-btn right"
          title="Ver más opciones"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Bottom Bar Actions (Right side) */}
      <div className="dock-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        
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
          {showNotifications && renderNotificationPanel()}
        </div>

        {/* AI Chatbot Button */}
        <div className="dock-chatbot-container" ref={chatbotRef} style={{ position: 'relative' }}>
          {showChatTooltip && !showProfilePopover && !showNotifications && !showChatbot && (
            <div className="chatbot-tooltip" style={{
              position: 'absolute',
              bottom: '50px',
              right: '0',
              background: 'var(--primary)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10002,
              animation: 'fadeUp 0.3s ease'
            }}>
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
          {showChatbot && (
            <div className="chatbot-window">
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
            </div>
          )}
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

            {showProfilePopover && (
              <div style={{
                position: 'absolute',
                bottom: '55px',
                right: 0,
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '16px',
                width: '240px',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                zIndex: 10001,
                backdropFilter: 'var(--glass-blur)',
                WebkitBackdropFilter: 'var(--glass-blur)',
                animation: 'fadeUp 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
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
                <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
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
              </div>
            )}
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
    </nav>
  );
}
