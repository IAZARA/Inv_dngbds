import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo_ministerio.png';

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src={logo} alt="Logo Ministerio de Seguridad Nacional" style={{ height: '50px' }} />
          <div>
            <h1>Ministerio de Seguridad Nacional</h1>
          </div>
        </div>
        <div className="user-box">
          <div>
            <strong>{user?.firstName} {user?.lastName}</strong>
            <span className="role">{user?.role}</span>
          </div>
          <button className="btn" onClick={handleLogout}>Salir</button>
        </div>
      </header>
      <div className="app-body">
        <nav className="side-nav">
          <NavLink to="/cases">Casos</NavLink>
          <NavLink to="/sources">Fuentes</NavLink>
          {user?.role === 'ADMIN' && <NavLink to="/admin/users">Usuarios</NavLink>}
        </nav>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
