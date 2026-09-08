'use client';

import { ThemeToggle } from './ThemeToggle';
import { Gavel } from 'lucide-react';
import Link from 'next/link';
import { UserMenu } from './UserMenu';
import { SearchBar } from './SearchBar';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 z-[60] flex items-center justify-between px-6 shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-opacity">
          <Gavel size={24} strokeWidth={2.5} />
          <span className="font-extrabold text-xl text-zinc-900 dark:text-zinc-50 tracking-tight">AquaBid</span>
        </Link>
        <SearchBar />
      </div>
      
      <div className="flex items-center gap-4">
        <ThemeToggle />
        
        <UserMenu />
      </div>
    </header>
  );
}
