'use client';

import { ThemeToggle } from './ThemeToggle';
import { Gavel } from 'lucide-react';
import Link from 'next/link';
import { UserMenu } from './UserMenu';
import { SearchBar } from './SearchBar';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 grid h-16 grid-cols-[1fr_auto_1fr] items-center bg-white/80 px-6 shadow-sm backdrop-blur-xl transition-colors duration-300 border-b border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950/80 z-[60]">
      <Link
        href="/dashboard"
        className="justify-self-start flex items-center gap-2 text-indigo-600 transition-opacity hover:opacity-80 dark:text-indigo-400"
      >
        <Gavel size={24} strokeWidth={2.5} />
        <span className="font-extrabold text-xl text-zinc-900 dark:text-zinc-50 tracking-tight">AquaBid</span>
      </Link>

      <SearchBar />
      
      <div className="justify-self-end flex items-center gap-4">
        <ThemeToggle />
        
        <UserMenu />
      </div>
    </header>
  );
}
