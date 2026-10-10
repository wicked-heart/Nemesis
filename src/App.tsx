import { useState, useEffect, useCallback } from 'react';
import Landing from '@/components/Landing';
import Entry from '@/components/Entry';
import Dashboard from '@/components/Dashboard';
import Completion from '@/components/Completion';
import AdminLogin from '@/components/AdminLogin';
import AdminDashboard from '@/components/AdminDashboard';
import { getSessionToken, getGameState } from '@/lib/api';

type View = 'landing' | 'entry' | 'dashboard' | 'completion' | 'admin-login' | 'admin';

function getHashRoute(): string {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  return hash || '';
}

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [adminPassword, setAdminPassword] = useState('');

  // Initialize view based on hash route and session state
  useEffect(() => {
    const init = async () => {
      const route = getHashRoute();
      if (route === 'admin') {
        setView('admin-login');
        return;
      }

      const token = getSessionToken();
      if (token) {
        try {
          const state = await getGameState();
          if (state && !state.error) {
            if (state.round_status === 'COMPLETED' || state.round_status === 'FAILED') {
              setView('completion');
            } else {
              setView('dashboard');
            }
            return;
          }
        } catch {
          // invalid session, fall through to landing
        }
      }
      setView('landing');
    };
    init();
  }, []);

  // Listen for hash changes (admin navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const route = getHashRoute();
      if (route === 'admin' && view !== 'admin-login' && view !== 'admin') {
        setView('admin-login');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [view]);

  const navigateToLanding = useCallback(() => {
    window.location.hash = '';
    setView('landing');
  }, []);

  const navigateToEntry = useCallback(() => {
    window.location.hash = '';
    setView('entry');
  }, []);

  const navigateToDashboard = useCallback(() => {
    window.location.hash = '';
    setView('dashboard');
  }, []);

  const navigateToCompletion = useCallback(() => {
    window.location.hash = '';
    setView('completion');
  }, []);

  const handleAdminSuccess = useCallback((password: string) => {
    setAdminPassword(password);
    setView('admin');
  }, []);

  const handleAdminLogout = useCallback(() => {
    setAdminPassword('');
    window.location.hash = '';
    setView('landing');
  }, []);

  switch (view) {
    case 'landing':
      return <Landing onEnter={navigateToEntry} />;
    case 'entry':
      return <Entry onStarted={navigateToDashboard} onBack={navigateToLanding} />;
    case 'dashboard':
      return <Dashboard onComplete={navigateToCompletion} onExit={navigateToLanding} />;
    case 'completion':
      return <Completion onExit={navigateToLanding} />;
    case 'admin-login':
      return <AdminLogin onSuccess={handleAdminSuccess} onBack={navigateToLanding} />;
    case 'admin':
      return <AdminDashboard password={adminPassword} onLogout={handleAdminLogout} />;
    default:
      return <Landing onEnter={navigateToEntry} />;
  }
}
