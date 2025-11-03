import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Home, { type HomeRef } from './pages/Home';
import Login from './pages/Login';
import { ThemeProvider } from './contexts/ThemeContext';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const homeRef = useRef<HomeRef>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (token: string, email: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('email', email);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('password');
    setIsAuthenticated(false);
  };

  const handleRefresh = () => {
    if (homeRef.current) {
      homeRef.current.refresh();
    }
  };

  // Sync refreshing state from Home component
  useEffect(() => {
    const checkRefreshing = () => {
      if (homeRef.current) {
        setRefreshing(homeRef.current.isRefreshing);
      }
    };

    // Check immediately
    checkRefreshing();

    // Check periodically to sync state
    const interval = setInterval(checkRefreshing, 50);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen font-sans transition-colors duration-200" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header onRefresh={handleRefresh} onLogout={handleLogout} refreshing={refreshing} />
      <Home ref={homeRef} />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
