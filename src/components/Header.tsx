import { RefreshCw, LogOut, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  onRefresh?: () => void;
  onLogout?: () => void;
  refreshing?: boolean;
}

export default function Header({ onRefresh, onLogout, refreshing }: HeaderProps) {
  const userEmail = localStorage.getItem('email') || '';
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 px-6 py-4"
      style={{ backgroundColor: 'var(--bg-header)' }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-gray-100" style={{ color: 'var(--card-text, black)' }}>
          Mailautomation
        </h1>

        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="text-sm dark:text-gray-400 hidden md:block" style={{ color: 'var(--card-text, black)' }}>{userEmail}</span>
          )}
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30 rounded-lg transition disabled:opacity-50"
              style={{ color: 'var(--card-text, black)' }}
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              <span className="font-medium">Refresh</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="p-2 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30 rounded-lg transition"
            style={{ color: 'var(--card-text, black)' }}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/30 rounded-lg transition"
              style={{ color: 'var(--card-text, black)' }}
            >
              <LogOut size={18} />
              <span className="font-medium hidden md:block">Logout</span>
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
}
