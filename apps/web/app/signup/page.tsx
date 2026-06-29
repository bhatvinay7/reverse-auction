'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Gavel, Mail, Lock, User, ArrowRight, Building2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '../../components/ThemeToggle';

export default function SignupPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen flex bg-[#f4f5f7] dark:bg-zinc-900 font-sans selection:bg-indigo-500/30">
      
      {/* Left Marketing Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-900 overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1200&q=80')" }}></div>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-zinc-900/80 to-zinc-950/95"></div>
        <div className="relative z-10 p-12 max-w-xl text-white">
          <Link href="/" className="inline-flex items-center gap-2 mb-12 hover:opacity-80 transition-opacity">
            <Gavel size={36} strokeWidth={2.5} className="text-emerald-400" />
            <span className="font-black text-3xl tracking-tight">ProcureX</span>
          </Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-5xl font-black mb-6 leading-tight">Your gateway to the global logistics market.</h2>
            <p className="text-lg text-zinc-300 font-medium leading-relaxed mb-10">
              Create your free account today. Shippers save up to 20% on freight costs via Reverse Auctions, and brokers can effortlessly liquidate lost cargo via Forward Auctions.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-2xl font-black text-emerald-400 mb-1">$50M+</h4>
                <p className="text-sm font-bold text-zinc-400">In processed freight</p>
              </div>
              <div>
                <h4 className="text-2xl font-black text-emerald-400 mb-1">99.9%</h4>
                <p className="text-sm font-bold text-zinc-400">Platform uptime</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Auth Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute top-6 right-6 z-50">
          <ThemeToggle />
        </div>
        
        {/* Background Ornaments for mobile */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none lg:hidden" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none lg:hidden" />

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-lg printed-card rounded-3xl p-8 sm:p-10 bg-[#fdfbf7] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl shadow-zinc-200/50 dark:shadow-black/40 z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5 border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
              <Gavel size={28} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">Create an account</h1>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 text-center">Join the premier logistics marketplace.</p>
          </div>

          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-3.5 text-zinc-400" />
                  <input 
                    type="text" 
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none" 
                    placeholder="John Doe" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Company Name</label>
                <div className="relative">
                  <Building2 size={18} className="absolute left-3.5 top-3.5 text-zinc-400" />
                  <input 
                    type="text" 
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none" 
                    placeholder="Global Freight" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-3.5 text-zinc-400" />
                <input 
                  type="email" 
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none" 
                  placeholder="name@company.com" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-3.5 text-zinc-400" />
                <input 
                  type="password" 
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <Link href="/verify-email" className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-xl shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 block text-center">
              Create Account <ArrowRight size={20} />
            </Link>
          </form>

          <p className="mt-10 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
