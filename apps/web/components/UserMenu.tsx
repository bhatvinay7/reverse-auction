'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User, LogIn, UserPlus, LogOut, LayoutDashboard, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setIsAuthenticated(!!token);
    setUserName(localStorage.getItem('userName')?.trim() || 'Your account');

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    setIsAuthenticated(false);
    setIsOpen(false);
    window.location.href = '/login';
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Open account menu"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white"><User size={15} /></span>
        <span className="hidden max-w-32 truncate text-sm font-bold sm:block">{isAuthenticated ? userName : 'Account'}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl shadow-slate-900/10 dark:border-zinc-800 dark:bg-zinc-900"
            role="menu"
          >
            {isAuthenticated ? (
              <>
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                  <p className="truncate text-sm font-extrabold text-zinc-900 dark:text-white">{userName}</p>
                  <p className="mt-0.5 text-xs font-medium text-zinc-500">Manage your AquaBid account</p>
                </div>
                <Link 
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>
                <Link href="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-blue-400">
                  <User size={16} /> Update profile
                </Link>
                <Link href="/settings" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-blue-400">
                  <Settings size={16} /> Account settings
                </Link>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <LogIn size={16} />
                  Sign In
                </Link>
                <Link 
                  href="/signup"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <UserPlus size={16} />
                  Create Account
                </Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
