import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando sesión...</div>;
  }

  if (!user) {
    const params = new URLSearchParams(window.location.search);
    const eventParam = params.get('event');
    if (eventParam) {
      sessionStorage.setItem('pending_event_uri', eventParam);
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
