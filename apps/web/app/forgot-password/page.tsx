'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Gavel, Mail, ArrowLeft, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '../../components/ThemeToggle';

export default function ForgotPasswordPage() {
  const [mounted, setMounted] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4 relative overflow-hidden">
      
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
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Enter your email address and we'll send you a link to reset your password.</p>
        </div>

        {!submitted ? (
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-zinc-400" />
                <input 
                  type="email" 
                  className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors" 
                  placeholder="name@company.com" 
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              Send Reset Link <Send size={16} />
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
