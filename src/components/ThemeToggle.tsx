'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setMounted(true);
    // Read initial theme from localStorage or system preference
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved ?? (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) {
        const newTheme = e.newValue as 'light' | 'dark';
        setTheme(newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('theme');
      if (!saved) {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [mounted]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    try {
      localStorage.setItem('theme', newTheme);
    } catch {
      // Ignore private mode / quota errors
    }
  };

  if (!mounted) {
    // Render placeholder with same dimensions to prevent layout shift
    return (
      <div className={`${className} inline-flex items-center justify-center p-2.5 rounded-xl bg-surface border border-ink-200`} style={{ minWidth: '40px', minHeight: '40px' }}>
        <Sun className="w-5 h-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`${className} inline-flex items-center justify-center p-2.5 rounded-xl bg-surface border border-ink-200 text-ink-600 hover:bg-ink-100 transition-colors-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2`}
      aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      style={{ minWidth: '40px', minHeight: '40px' }}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 transition-opacity" aria-hidden="true" />
      ) : (
        <Sun className="w-5 h-5 transition-opacity" aria-hidden="true" />
      )}
    </button>
  );
}