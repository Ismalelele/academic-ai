import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Wrench, Sun, Moon, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Nav({ isDarkMode, toggleTheme }) {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <div className="logo"><h2>Academic<span>AI</span></h2></div>
        <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Overlay */}
      {isOpen && <div className="mobile-overlay" onClick={closeMenu}></div>}

      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="logo desktop-only"><h2>Academic<span>AI</span></h2></div>
        <ul className="nav-links">
          <li>
            <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end onClick={closeMenu}>
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
        </ul>

        <div className="theme-toggle" onClick={() => { toggleTheme(); closeMenu(); }}>
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          <span>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </div>

        <div className="user-profile">
          <div className="avatar">IA</div>
          <div className="user-info">
            <p className="name">Ismael Acosta</p>
            <p className="status">Ing. Informática VII</p>
          </div>
        </div>
      </nav>
    </>
  );
}
