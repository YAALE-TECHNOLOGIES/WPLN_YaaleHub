import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import api from './api/api';
import Login from './pages/Login';
import CandidateDashboard from './pages/CandidateDashboard';
import TestPlayer from './pages/TestPlayer';
import AdminDashboard from './pages/AdminDashboard';
import EvaluatorDashboard from './pages/EvaluatorDashboard';
import ResultPage from './pages/ResultPage';
import PublicHome from './pages/PublicHome';
import Register from './pages/Register';
import SyllabusUserView from './pages/SyllabusUserView';

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return <div>Loading...</div>;
  if (!user) {
    const isAdminPath = location.pathname.startsWith('/WPLNadmin');
    return <Navigate to={isAdminPath ? "/WPLNadmin/login" : "/login"} state={{ from: location }} replace />;
  }
  
  if (roles.length > 0 && !roles.includes(user.role?.name)) {
    // Admin can preview candidate pages
    if (user.role?.name === 'ADMIN' && !location.pathname.startsWith('/WPLNadmin')) {
      return children;
    }
    if (user.role?.name === 'ADMIN') return <Navigate to="/WPLNadmin" />;
    if (user.role?.name === 'EVALUATOR') return <Navigate to="/WPLNadmin" />;
    return <Navigate to="/" />;
  }
  
  return children;
};

function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Website Routes */}
            <Route path="/" element={<PublicHome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Candidate Routes (Protected) */}
            <Route path="/dashboard" element={
              <ProtectedRoute roles={['CANDIDATE', 'ADMIN']}>
                <CandidateDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/test/:moduleId/:attemptId" element={
              <ProtectedRoute roles={['CANDIDATE', 'ADMIN']}>
                <TestPlayer />
              </ProtectedRoute>
            } />

            <Route path="/test-start/:moduleId" element={
              <ProtectedRoute roles={['CANDIDATE', 'ADMIN']}>
                <TestInitiator />
              </ProtectedRoute>
            } />

            <Route path="/results/:attemptId" element={
              <ProtectedRoute roles={['CANDIDATE', 'ADMIN']}>
                <ResultPage />
              </ProtectedRoute>
            } />

            <Route path="/syllabus" element={
              <ProtectedRoute roles={['CANDIDATE', 'ADMIN']}>
                <SyllabusUserView />
              </ProtectedRoute>
            } />

            {/* Admin + Evaluator Routes */}
            <Route path="/WPLNadmin/login" element={<Login />} />
            <Route path="/WPLNadmin" element={
              <ProtectedRoute roles={['ADMIN', 'EVALUATOR']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Legacy evaluator route — redirect to admin dashboard */}
            <Route path="/evaluator" element={<Navigate to="/WPLNadmin" replace />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

// Helper to start a test after redirection
const TestInitiator = () => {
    const { moduleId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    
    useEffect(() => {
        const init = async () => {
            try {
                const res = await api.post(`/candidate/start-test/${moduleId}`);
                navigate(`/test/${moduleId}/${res.data.id}`);
            } catch (err) {
                showToast(err.response?.data?.detail || 'Failed to start test', 'error');
                navigate('/');
            }
        };
        init();
    }, [moduleId]);

    return <div className="loader">Preparing your assessment...</div>;
};

export default App;
