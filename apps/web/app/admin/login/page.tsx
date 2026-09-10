'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { Toast } from '../../../components/Toast';

type SignInResponse = {
  token: string;
  user_id: string;
  role: string;
  name?: string;
};

export default function AdminLoginPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Invalid credentials');
      }

      return response.json() as Promise<SignInResponse>;
    },
    onSuccess: (data) => {
      if (data.role !== 'ADMIN') {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        setToast({ message: 'This account does not have administrator access.', type: 'error' });
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user_id);
      localStorage.setItem('userRole', data.role);
      if (data.name) localStorage.setItem('userName', data.name);
      window.location.href = '/admin';
    },
    onError: (error: Error) => {
      setToast({ message: `Login failed: ${error.message}`, type: 'error' });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 dark:bg-zinc-950">
      <Toast message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />
      <div className="absolute right-6 top-6"><ThemeToggle /></div>

      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <ShieldCheck size={30} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Restricted area</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Admin sign in</h1>
          <p className="mt-2 text-sm text-zinc-500">Use your platform administrator account to open the operations console.</p>
        </div>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            loginMutation.mutate({
              email: String(form.get('email') || ''),
              password: String(form.get('password') || ''),
            });
          }}
        >
          <label className="block space-y-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
            <span>Email address</span>
            <span className="relative block">
              <Mail size={16} className="absolute left-3 top-3 text-zinc-400" />
              <input name="email" type="email" required autoComplete="email" placeholder="admin@company.com" className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 font-medium outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950" />
            </span>
          </label>

          <label className="block space-y-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
            <span>Password</span>
            <span className="relative block">
              <Lock size={16} className="absolute left-3 top-3 text-zinc-400" />
              <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 font-medium outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950" />
            </span>
          </label>

          <button type="submit" disabled={loginMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loginMutation.isPending ? 'Signing in…' : <>Open admin console <ArrowRight size={17} /></>}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-zinc-500">Not an administrator? <Link href="/login" className="font-bold text-indigo-600 hover:underline">Use the standard sign in</Link>.</p>
      </section>
    </main>
  );
}
