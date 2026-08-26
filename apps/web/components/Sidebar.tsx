'use client';

import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebarCollapsed } from '../store/slices/uiSlice';
import { RootState } from '../store/store';
import { 
  LayoutDashboard, 
  Users, 
  History,
  Settings,
  PlusCircle,
  Package,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import { Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Sidebar() {
  const dispatch = useDispatch();
  const isCollapsed = useSelector((state: RootState) => state.ui.isSidebarCollapsed);
  const [isOpen, setIsOpen] = useState(false);
  const { session } = useAuth();
  const userRole = session?.role;

  return (
    <div className="app-sidebar-instance">
      {/* Mobile Floating Hamburger */}
      <button 
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-[12px] right-[100px] z-[65] p-2 rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors backdrop-blur-md"
      >
        <Menu size={20} />
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
        "fixed top-16 left-0 h-[calc(100vh-4rem)] border-r-[1px] border-zinc-200 dark:border-zinc-800 bg-[#faf9f6] dark:bg-zinc-950 flex flex-col transition-all duration-300 z-[50]",
        isOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0",
        isCollapsed ? "md:w-20" : "md:w-64"
      )}>
        <div className="hidden md:flex h-4 items-center" />
        <button onClick={() => setIsOpen(false)} className="md:hidden absolute top-4 right-4 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 p-1">
          <X size={20} />
        </button>

        {/* Desktop Collapse Toggle */}
        <button 
          onClick={() => dispatch(toggleSidebarCollapsed())} 
          className="hidden md:flex absolute -right-3 top-4 w-6 h-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full items-center justify-center text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 z-10 shadow-sm"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto overflow-x-hidden">
          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              isCollapsed ? "px-0 justify-center" : "px-4",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
            title={isCollapsed ? "Executive Dashboard" : undefined}
          >
            <LayoutDashboard size={18} strokeWidth={2} className="shrink-0" />
            {!isCollapsed && <span>Executive Dashboard</span>}
          </Link>
          {userRole === 'CUSTOMER' && <>
            <Link href="/seller/dashboard" onClick={() => setIsOpen(false)} className={clsx("w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium", isCollapsed ? "justify-center" : "px-4", "text-zinc-600 dark:text-zinc-400")}><Package size={18} />{!isCollapsed && <span>Seller dashboard</span>}</Link>
            <Link href="/sell/new" onClick={() => setIsOpen(false)} className={clsx("w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium", isCollapsed ? "justify-center" : "px-4", "text-zinc-600 dark:text-zinc-400")}><PlusCircle size={18} />{!isCollapsed && <span>Submit listing</span>}</Link>
          </>}
          <Link
            href="/history"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              isCollapsed ? "px-0 justify-center" : "px-4",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
            title={isCollapsed ? "Bidding History" : undefined}
          >
            <History size={18} strokeWidth={2} className="shrink-0" />
            {!isCollapsed && <span>Bidding History</span>}
          </Link>
          <Link
            href="/profile"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              isCollapsed ? "px-0 justify-center" : "px-4",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
            title={isCollapsed ? "User Profile" : undefined}
          >
            <Users size={18} strokeWidth={2} className="shrink-0" />
            {!isCollapsed && <span>User Profile</span>}
          </Link>
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className={clsx(
              "w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              isCollapsed ? "px-0 justify-center" : "px-4",
              "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
            title={isCollapsed ? "Platform Settings" : undefined}
          >
            <Settings size={18} strokeWidth={2} className="shrink-0" />
            {!isCollapsed && <span>Platform Settings</span>}
          </Link>

          {userRole === 'ADMIN' && (
            <>
              <Link href="/auction/new" onClick={() => setIsOpen(false)} title={isCollapsed ? "Create Auction" : undefined} className={clsx("w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-200", isCollapsed ? "px-0 justify-center" : "px-4", "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100")}>
                <PlusCircle size={18} strokeWidth={2} className="shrink-0" />
                {!isCollapsed && <span>Create Auction</span>}
              </Link>
              <Link href="/admin" onClick={() => setIsOpen(false)} title={isCollapsed ? "Admin Console" : undefined} className={clsx("w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-200", isCollapsed ? "px-0 justify-center" : "px-4", "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100")}>
                <ShieldCheck size={18} strokeWidth={2} className="shrink-0" />
                {!isCollapsed && <span>Admin Console</span>}
              </Link>
            </>
          )}
        </nav>
      </aside>
    </div>
  );
}
