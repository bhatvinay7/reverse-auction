'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const role = session?.role;

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-500">Checking administrator access…</div>;
  }

  if (role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <ShieldAlert className="mx-auto mb-4 text-amber-500" size={42} />
          <h1 className="text-2xl font-black">Admin access required</h1>
          <p className="mt-2 text-zinc-500">Only platform administrators can create auctions.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-zinc-950 px-5 py-3 font-bold text-white dark:bg-white dark:text-zinc-950">Return to dashboard</Link>
        </div>
      </div>
    );
  }

  return children;
}
