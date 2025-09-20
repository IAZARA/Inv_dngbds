import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaSignOutAlt, FaFolder, FaUsers, FaCog } from 'react-icons/fa';
import { useState } from 'react';
import logo from '../assets/logo_ministerio.png';

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="app-shell">
      <div className="app-body">
        <nav className={`side-nav ${sidebarOpen ? 'expanded' : 'collapsed'}`}>
          <div className="sidebar-header">
            <button className="logo-toggle-btn" onClick={toggleSidebar}>
              <img
                src={logo}
                alt="Logo Ministerio de Seguridad Nacional"
                className="sidebar-logo"
              />
            </button>
          </div>
          
          <div className="nav-links">
            <NavLink to="/cases" className={({ isActive }) => isActive ? "active" : ""}>
              <div className="nav-item">
                <FaFolder className="nav-icon" />
                {sidebarOpen && <span>Casos</span>}
              </div>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? "active" : ""}>
              <div className="nav-item">
                <FaCog className="nav-icon" />
                {sidebarOpen && <span>Configuración</span>}
              </div>
            </NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin/users" className={({ isActive }) => isActive ? "active" : ""}>
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
        <main className={`main-content ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
