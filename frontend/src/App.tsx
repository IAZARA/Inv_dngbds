import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import AdminUsersPage from './pages/AdminUsers';
import LoginPage from './pages/Login';
import PersonDetailPage from './pages/PersonDetail';
import SourcesPage from './pages/Sources';
import CasesPage from './pages/Cases';
import SettingsPage from './pages/Settings';

const ProtectedLayout = () => (
  <ProtectedRoute>
    <DashboardLayout />
  </ProtectedRoute>
);

const App = () => {
  const { user, initializing } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          initializing ? (
            <div className="centered">Cargando...</div>
          ) : user ? (
            <Navigate to="/cases" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route path="/" element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/cases" replace />} />
        <Route path="persons/:id" element={<PersonDetailPage />} />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sources"
          element={
            <ProtectedRoute roles={['ADMIN', 'OPERATOR']}>
              <SourcesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="cases"
          element={
            <ProtectedRoute>
              <CasesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/cases" replace />} />
    </Routes>
  );
};

export default App;
