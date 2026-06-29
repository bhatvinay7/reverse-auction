'use client';

import { useDispatch, useSelector } from 'react-redux';
import { setActiveTab } from '../store/slices/uiSlice';
import { RootState } from '../store/store';
import { 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownRight, 
  Users, 
  BarChart3, 
  Gavel,
  History,
  Settings,
  PlusCircle,
  Package,
  Sun,
  Moon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';

import { Menu, X } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
  { id: 'reverse', label: 'Load Marketplace', icon: ArrowDownRight },
];

export function Sidebar() {
  const dispatch = useDispatch();
  const activeTab = useSelector((state: RootState) => state.ui.activeTab);
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Mobile Hamburger Toggle */}
      <button 
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-[40] p-2 bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm text-zinc-600 dark:text-zinc-400"
      >
        <Menu size={24} />
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-white/30 dark:bg-black/50 backdrop-blur-md z-[45] md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={clsx(
        "fixed top-0 left-0 h-screen w-64 border-r-[1px] border-zinc-200 dark:border-zinc-800 bg-[#faf9f6] dark:bg-zinc-900 flex flex-col transition-transform duration-300 z-[50]",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b-[1px] border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <Gavel size={28} strokeWidth={2} />
            <span className="font-semibold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">
              ProcureX
            </span>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 p-1">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            <LayoutDashboard size={18} strokeWidth={2} />
            Executive Dashboard
          </Link>
          <Link
            href="/history"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            <History size={18} strokeWidth={2} />
            Bidding History
          </Link>
          <Link
            href="/profile"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            <Users size={18} strokeWidth={2} />
            User Profile
          </Link>
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            <Settings size={18} strokeWidth={2} />
            Platform Settings
          </Link>

          <Link
            href="/shipment/new"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            <PlusCircle size={18} strokeWidth={2} />
            Post New Shipment
          </Link>
          <Link
            href="/forward-auction/new"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            <Package size={18} strokeWidth={2} />
            Sell Product (Forward)
          </Link>
        </nav>
        <div className="p-4 border-t-[1px] border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            {theme === 'dark' ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>
    </>
  );
}
