import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Wrench, MessageSquare, ListTodo, Sun, Moon, Menu, X, Bell, Trash2, CheckCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export default function Nav({ isDarkMode, toggleTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications();
  const notifRefDesktop = useRef();
  const notifRefMobile = useRef();

  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedDesktop = notifRefDesktop.current && notifRefDesktop.current.contains(event.target);
      const clickedMobile = notifRefMobile.current && notifRefMobile.current.contains(event.target);
      if (!clickedDesktop && !clickedMobile) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIconForType = (type) => {
    switch(type) {
      case 'clase': return '📚';
      case 'urgente': return '⚠️';
      case 'tarea': return '📝';
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
    <>
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <div className="logo"><h2>Academic<span>AI</span></h2></div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
          <div className="notification-bell-container" ref={notifRefMobile}>
            <button className="notification-bell" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell size={24} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            {/* Solo se muestra si estamos en resolucion movil */}
            <div className="mobile-only-panel">
              {showNotifications && renderNotificationPanel()}
            </div>
          </div>

          <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && <div className="mobile-overlay" onClick={closeMenu}></div>}

      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="logo desktop-only"><h2>Academic<span>AI</span></h2></div>
        
        {/* Desktop Bell */}
        <div className="sidebar-top-actions desktop-only">
          <div className="notification-bell-container desktop-bell" ref={notifRefDesktop}>
            <button className="notification-bell" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell size={24} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            {showNotifications && renderNotificationPanel()}
          </div>
        </div>

        <ul className="nav-links">
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <LayoutDashboard /> <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/horario" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <Calendar /> <span>Mi Horario</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/herramientas" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <Wrench /> <span>Herramientas</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/asistente" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <MessageSquare /> <span>Asistente IA</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/tareas" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
              <ListTodo /> <span>Gestor de Tareas</span>
            </NavLink>
          </li>
        </ul>

        <div className="theme-toggle" onClick={() => { toggleTheme(); closeMenu(); }}>
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          <span>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </div>

        {user && (
          <div className="user-profile" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src={user.user_metadata?.avatar_url || 'https://via.placeholder.com/40'} 
                alt="Avatar" 
                style={{ width: '40px', height: '40px', borderRadius: '50%' }}
              />
              <div className="user-info">
                <p className="name" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{user.user_metadata?.full_name?.split(' ')[0] || 'Alumno'}</p>
                <p className="status" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Conectado</p>
              </div>
            </div>
            <button 
              onClick={signOut} 
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                width: '100%',
                transition: '0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255,0,0,0.1)'}
              onMouseOut={(e) => e.target.style.background = 'transparent'}
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
