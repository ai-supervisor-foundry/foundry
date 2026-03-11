import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { AuthProvider, useAuth } from './services/authContext';
import { setOnUnauthorized, setOnForbidden, setOnApiError, setOnNetworkError } from './services/apiClient';
import { ToastProvider, useToast } from './services/toastContext';
import { ToastContainer } from './components/ToastContainer';

const ApiClientAuthSync: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
      navigate('/login', { replace: true });
    });
    setOnForbidden((msg) => addToast('error', msg ?? 'Access Denied'));
    setOnApiError((message) => addToast('error', message));
    setOnNetworkError((retry) => addToast('error', 'Connection failed. Please check your network.', { onRetry: () => retry() }));
  }, [logout, navigate, addToast]);
  return null;
};

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <ApiClientAuthSync />
          <ToastContainer />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
