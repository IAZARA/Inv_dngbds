import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaSignOutAlt, FaFolder, FaUsers, FaCog, FaBars, FaTimes } from 'react-icons/fa';
import { useEffect, useState } from 'react';
import logo from '../assets/logo_ministerio.png';

const DESKTOP_QUERY = '(min-width: 1024px)';

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(DESKTOP_QUERY);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    const listener = (event: MediaQueryListEvent) => handleChange(event);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
    } else {
      mediaQuery.addListener(listener);
    }

    setIsDesktop(mediaQuery.matches);

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', listener);
      } else {
        mediaQuery.removeListener(listener);
      }
    };
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setMobileMenuOpen(false);
      setSidebarOpen(true);
    } else {
      setSidebarOpen(true);
    }
  }, [isDesktop]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    if (isDesktop) {
      setSidebarOpen((current) => !current);
    } else {
      setMobileMenuOpen((current) => !current);
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleNavLinkClick = () => {
    if (!isDesktop) {
      closeMobileMenu();
    }
  };

  const navClassName = [
    'side-nav',
    sidebarOpen ? 'expanded' : 'collapsed',
    !isDesktop ? 'mobile' : '',
    !isDesktop && mobileMenuOpen ? 'is-mobile-open' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const mainClassName = [
    'main-content',
    sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed',
    !isDesktop ? 'mobile' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const appShellClassName = ['app-shell', !isDesktop && mobileMenuOpen ? 'menu-open' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={appShellClassName}>
      {!isDesktop && (
        <header className="mobile-topbar">
          <button
            type="button"
            className="icon-button"
            aria-label="Abrir menú de navegación"
            onClick={toggleSidebar}
          >
            <FaBars />
          </button>
          <img src={logo} alt="Ministerio de Seguridad Nacional" className="mobile-topbar__logo" />
          <button type="button" className="icon-button" aria-label="Cerrar sesión" onClick={handleLogout}>
            <FaSignOutAlt />
          </button>
        </header>
      )}
      <div className="app-body">
        <nav className={navClassName}>
          <div className="sidebar-header">
            {isDesktop ? (
              <button className="logo-toggle-btn" onClick={toggleSidebar} aria-label="Alternar tamaño del menú">
                <img
                  src={logo}
                  alt="Logo Ministerio de Seguridad Nacional"
                  className="sidebar-logo"
                />
              </button>
            ) : (
              <>
                <img src={logo} alt="Logo Ministerio de Seguridad Nacional" className="sidebar-logo" />
                <button
                  type="button"
                  className="icon-button close-nav"
                  aria-label="Cerrar menú de navegación"
                  onClick={closeMobileMenu}
                >
                  <FaTimes />
                </button>
              </>
            )}
          </div>
          
          <div className="nav-links">
            <NavLink to="/cases" className={({ isActive }) => (isActive ? 'active' : '')} onClick={handleNavLinkClick}>
              <div className="nav-item">
                <FaFolder className="nav-icon" />
                {sidebarOpen && <span>Casos</span>}
              </div>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')} onClick={handleNavLinkClick}>
              <div className="nav-item">
                <FaCog className="nav-icon" />
                {sidebarOpen && <span>Configuración</span>}
              </div>
            </NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink
                to="/admin/users"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={handleNavLinkClick}
              >
                <div className="nav-item">
                  <FaUsers className="nav-icon" />
                  {sidebarOpen && <span>Usuarios</span>}
                </div>
              </NavLink>
            )}
          </div>
          
          <div className="user-footer">
            {sidebarOpen && (
              <div className="user-name">{user?.firstName} {user?.lastName}</div>
            )}
            <button className="btn-logout" onClick={handleLogout}>
              {sidebarOpen ? <><FaSignOutAlt /> Salir</> : <FaSignOutAlt />}
            </button>
          </div>
        </nav>
        <main className={mainClassName}>
          <Outlet />
        </main>
      </div>
      {!isDesktop && mobileMenuOpen && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Cerrar menú de navegación"
          onClick={closeMobileMenu}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
