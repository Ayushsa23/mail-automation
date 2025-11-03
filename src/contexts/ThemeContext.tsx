import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      const root = document.documentElement;
      const body = document.body;
      
      if (stored === 'light' || stored === 'dark') {
        root.classList.remove('dark', 'light');
        if (stored === 'dark') {
          root.classList.add('dark');
          root.style.setProperty('--bg-primary', '#111827');
          root.style.setProperty('--bg-header', '#111827');
          root.style.setProperty('--card-bg', '#1f2937');
          root.style.setProperty('--card-text', '#f3f4f6');
          body.style.backgroundColor = '#111827';
        } else {
          root.style.setProperty('--bg-primary', '#f0f4f8');
          root.style.setProperty('--bg-header', '#f0f4f8');
          root.style.setProperty('--card-bg', '#ffffff');
          root.style.setProperty('--card-text', '#000000');
          body.style.backgroundColor = '#f0f4f8';
        }
        return stored as Theme;
      }
      
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
        root.style.setProperty('--bg-primary', '#111827');
        root.style.setProperty('--bg-header', '#111827');
        root.style.setProperty('--card-bg', '#1f2937');
        root.style.setProperty('--card-text', '#f3f4f6');
        body.style.backgroundColor = '#111827';
        return 'dark';
      } else {
        root.style.setProperty('--bg-primary', '#f0f4f8');
        root.style.setProperty('--bg-header', '#f0f4f8');
        root.style.setProperty('--card-bg', '#ffffff');
        root.style.setProperty('--card-text', '#000000');
        body.style.backgroundColor = '#f0f4f8';
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    root.classList.remove('dark');
    
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.setProperty('--bg-primary', '#111827');
      root.style.setProperty('--bg-header', '#111827');
      root.style.setProperty('--card-bg', '#1f2937');
      root.style.setProperty('--card-text', '#f3f4f6');
      body.style.backgroundColor = '#111827';
    } else {
      root.style.setProperty('--bg-primary', '#f0f4f8');
      root.style.setProperty('--bg-header', '#f0f4f8');
      root.style.setProperty('--card-bg', '#ffffff');
      root.style.setProperty('--card-text', '#000000');
      body.style.backgroundColor = '#f0f4f8';
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      const root = document.documentElement;
      const body = document.body;
      root.classList.remove('dark');
      if (newTheme === 'dark') {
        root.classList.add('dark');
        root.style.setProperty('--bg-primary', '#111827');
        root.style.setProperty('--bg-header', '#111827');
        root.style.setProperty('--card-bg', '#1f2937');
        root.style.setProperty('--card-text', '#f3f4f6');
        body.style.backgroundColor = '#111827';
      } else {
        root.style.setProperty('--bg-primary', '#f0f4f8');
        root.style.setProperty('--bg-header', '#f0f4f8');
        root.style.setProperty('--card-bg', '#ffffff');
        root.style.setProperty('--card-text', '#000000');
        body.style.backgroundColor = '#f0f4f8';
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
      }
      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
