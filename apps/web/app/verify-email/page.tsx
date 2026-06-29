'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { MailCheck, ArrowRight } from 'lucide-react';

import { ThemeToggle } from '../../components/ThemeToggle';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4 relative overflow-hidden">
      
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <div className="absolute top-[10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md printed-card rounded-2xl p-10 bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/20 dark:shadow-black/40 z-10 text-center"
      >
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 mx-auto border-4 border-white dark:border-zinc-900 shadow-lg">
          <MailCheck size={40} strokeWidth={2.5} />
        </div>
        
        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight mb-3">Verify your email</h1>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
          We've sent a verification link to your email address. Please click the link to activate your ProcureX account.
        </p>

        <button className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold py-3 px-4 rounded-lg transition-colors mb-4">
          Resend Verification Email
        </button>
        
        <Link href="/login" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
          Proceed to Login <ArrowRight size={18} />
        </Link>
      </motion.div>
    </div>
  );
}
