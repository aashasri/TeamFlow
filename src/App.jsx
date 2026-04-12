import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import api from './services/api';

import Sidebar       from './components/layout/Sidebar';
import Topbar        from './components/layout/Topbar';
import LoadingSpinner from './components/common/LoadingSpinner';
import LoginPage     from './pages/Login/LoginPage';

// ⚡ LAZY LOADING: Split the bundle so we only load what's needed
const EmployeePage = lazy(() => import('./pages/Employee/EmployeePage'));
const ManagerPage  = lazy(() => import('./pages/Manager/ManagerPage'));
const ClientPage   = lazy(() => import('./pages/Client/ClientPage'));

import './index.css';

/* ── Layout wrapper (requires auth) ── */
const DashboardLayout = ({ children, title, activePage, onQuickAdd, timeTrack }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} timeTrack={timeTrack} />
      <main className="main">
        <Topbar title={title} onAddClick={onQuickAdd} />
        {children}
      </main>
    </div>
  );
};

/* ── Dashboard Router Wrapper ── */
const DashboardRouter = ({ isAssignModalOpen, setIsAssignModal, secondsToday }) => {
  const { user } = useAuth();
  const { role, page } = useParams();

  // If role in URL doesn't match User's role, enforce redirect to their correct root
  if (user?.role && role !== user.role) {
    const defaultPage = user.role === 'employee' ? 'tasks' : 'overview';
    return <Navigate to={`/${user.role}/${defaultPage}`} replace />;
  }

  // Fallback to a default page if `page` parameter is undefined
  const activePage = page || (user?.role === 'employee' ? 'tasks' : 'overview');
  const roleName  = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';
  const pageLabel = activePage.replace('-', ' ').replace(/^\w/, c => c.toUpperCase());

  const h = Math.floor(secondsToday / 3600);
  const m = Math.floor((secondsToday % 3600) / 60);
  const s = secondsToday % 60;
  const timeStr = `${h}h ${m}m ${s}s`;

  return (
    <DashboardLayout
      title={user ? `${roleName} Dashboard — ${pageLabel}` : ''}
      activePage={activePage}
      onQuickAdd={() => user?.role === 'manager' && setIsAssignModal(true)}
      timeTrack={timeStr}
    >
      <Suspense fallback={<LoadingSpinner message="Loading Page..." />}>
        {user?.role === 'employee' && <EmployeePage activePage={activePage} />}
        {user?.role === 'manager'  && (
          <ManagerPage
            activePage={activePage}
            isAssignModalOpen={isAssignModalOpen}
            onCloseModal={() => setIsAssignModal(false)}
          />
        )}
        {user?.role === 'client'   && <ClientPage activePage={activePage} />}
      </Suspense>
    </DashboardLayout>
  );
};

/* ── Main app content ── */
const AppContent = () => {
  const { user, loading } = useAuth();
  const [isAssignModalOpen, setIsAssignModal] = useState(false);
  const [secondsToday, setSecondsToday] = useState(() => {
    try {
      const cached = localStorage.getItem('tf_timer_cache');
      if (cached) {
        const { date, seconds } = JSON.parse(cached);
        if (date === new Date().toISOString().split('T')[0]) {
          return seconds;
        }
      }
    } catch (e) {}
    return 0;
  });

  /* ── ⏱ Daily Login Timer Logic ── */
  useEffect(() => {
    if (!user) return; // Only track if logged in

    const today = new Date().toISOString().split('T')[0];
    let interval;

    // 1. Initial load of today's seconds
    api.tracking.getDailySeconds(user.userId, today).then(({ data }) => {
      if (data) setSecondsToday(data.total_seconds);
    });

    // 2. Increment every second locally & check for day rollover
    interval = setInterval(() => {
      const now = new Date().toISOString().split('T')[0];
      if (now !== today) {
        setSecondsToday(0);
        window.location.reload(); 
      } else {
        setSecondsToday(prev => {
          const next = prev + 1;
          // Synchronize to localStorage for "Instant Resume" on refresh
          localStorage.setItem('tf_timer_cache', JSON.stringify({
            date: today,
            seconds: next
          }));
          return next;
        });
      }
    }, 1000);

    // 3. Sync to DB every 60 seconds
    const syncInterval = setInterval(() => {
      setSecondsToday(current => {
        api.tracking.updateDailySeconds(user.userId, today, current);
        return current;
      });
    }, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [user]);

  /* ⚡ OPTIMIZATION: Show spinner ONLY if we have NO cached user AND we are still loading */
  const isLoginPage = window.location.pathname === '/login';
  if (loading && !user && !isLoginPage) {
    return <LoadingSpinner fullScreen message="Resuming your TeamFlow session…" />;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={
        loading ? <LoadingSpinner fullScreen message="Verifying session…" /> :
        user ? <Navigate to={`/${user.role}/${user.role === 'employee' ? 'tasks' : 'overview'}`} replace /> 
             : <Navigate to="/login" replace />
      } />
      <Route path="/:role/:page?" element={
        user ? (
          <DashboardRouter 
            isAssignModalOpen={isAssignModalOpen} 
            setIsAssignModal={setIsAssignModal}
            secondsToday={secondsToday} 
          />
        ) : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

/* ── Provider order: Auth wraps Data (Data reads user from Auth) ── */
function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Router basename={import.meta.env.BASE_URL}>
          <AppContent />
        </Router>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
