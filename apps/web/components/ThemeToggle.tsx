'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 transition-colors">
        <div className="w-5 h-5 opacity-0" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm"
      aria-label="Toggle Theme"
    >
      {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
