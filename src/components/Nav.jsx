import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, ListTodo, Sun, Moon, Bell, Trash2, CheckCircle, 
  BookOpenText, GraduationCap, Bot, Send, MessageCircle, Sparkles, MessageSquare, X,
  ChevronLeft, ChevronRight
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
  const { user, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications();
  const { effectiveSchedule } = useSchedule();
  const { tasks } = useTasks();
  
  const notifRef = useRef();
  const chatbotRef = useRef();
  const chatbotBodyRef = useRef();
  const profileRef = useRef();
  const navLinksRef = useRef();

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
              {user.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="Avatar" 
                  style={{ 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    objectFit: 'cover', 
                    border: '2px solid var(--primary)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                />
              ) : (
                <div 
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    border: '2px solid var(--primary)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                >
                  {(user.user_metadata?.full_name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
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
                  {user.user_metadata?.avatar_url ? (
                    <img 
                      src={user.user_metadata.avatar_url} 
                      alt="Avatar" 
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '1.1rem'
                    }}>
                      {(user.user_metadata?.full_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ overflow: 'hidden', textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                      {user.user_metadata?.full_name || 'Alumno'}
                    </p>
                    {user.user_metadata?.carrera && (
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {user.user_metadata.carrera}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
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
                    transition: 'all 0.2s'
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
    </nav>
  );
}
