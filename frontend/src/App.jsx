/**
 * src/App.jsx - Root application with React Router, QueryClient, and layout.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore, useUIStore } from './store';

// Pages
import LoginPage       from './pages/LoginPage';
import RegisterPage    from './pages/RegisterPage';
import DashboardPage   from './pages/DashboardPage';
import PapersPage      from './pages/PapersPage';
import PaperDetailPage from './pages/PaperDetailPage';
import ProjectsPage    from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import CollabPage      from './pages/CollabPage';
import ConferencesPage from './pages/ConferencesPage';
import ProfilePage     from './pages/ProfilePage';
import TrendsPage      from './pages/TrendsPage';
import SavedPage       from './pages/SavedPage';
import JoinProjectPage from './pages/JoinProjectPage';
import JoinPaperPage   from './pages/JoinPaperPage';

// Layout
import AppLayout from './components/Shared/AppLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

/** Guard: redirect to /login if not authenticated */
function PrivateRoute({ children }) {
  const { user } = useAuthStore();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { darkMode } = useUIStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected – wrapped in AppLayout (sidebar + topbar) */}
          <Route path="/" element={
            <PrivateRoute><AppLayout /></PrivateRoute>
          }>
            <Route index                        element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"             element={<DashboardPage />} />
            <Route path="papers"                element={<PapersPage />} />
            <Route path="papers/:id"            element={<PaperDetailPage />} />
            <Route path="projects"              element={<ProjectsPage />} />
            <Route path="projects/:id"          element={<ProjectDetailPage />} />
            <Route path="saved"                 element={<SavedPage />} />
            <Route path="collaborations"        element={<CollabPage />} />
            <Route path="conferences"           element={<ConferencesPage />} />
            <Route path="trends"               element={<TrendsPage />} />
            <Route path="profile"              element={<ProfilePage />} />
            <Route path="profile/:id"          element={<ProfilePage />} />
            <Route path="join/:id"             element={<JoinProjectPage />} />
            <Route path="join-paper/:id"       element={<JoinPaperPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
