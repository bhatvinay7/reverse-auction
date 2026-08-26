'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Gavel, Mail, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Toast } from '../../components/Toast';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const resetMutation = useMutation({
    mutationFn: async (email: string) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send reset link');
      }
      return res;
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: Error) => {
      setToast({ message: `Error: ${err.message}`, type: 'error' });
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 relative overflow-hidden">
      <Toast message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />
      
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md printed-card rounded-2xl p-8 bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/20 dark:shadow-black/40 z-10"
      >
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
            <Gavel size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Reset Password</h1>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Enter your email address and we&apos;ll send you a link to reset your password.</p>
        </div>

        {!submitted ? (
          <form className="space-y-6" onSubmit={(e) => {
            e.preventDefault();
            const target = e.target as HTMLFormElement;
            const email = (target.elements[0] as HTMLInputElement).value;
            resetMutation.mutate(email);
          }}>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-zinc-400" />
                <input 
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors" 
                  placeholder="name@company.com" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={resetMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 h-12 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Sending...</>
              ) : (
                <>Send Reset Link <Send size={16} /></>
              )}
            </button>
          </form>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg">
             <p className="text-emerald-700 dark:text-emerald-400 font-bold">Check your email!</p>
             <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 mt-1">If an account exists with that email, a reset link has been sent.</p>
          </motion.div>
        )}

        <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <Link href="/login" className="flex items-center justify-center gap-2 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            <ArrowLeft size={16} /> Back to Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
