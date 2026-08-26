'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Gavel, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Toast } from '../../components/Toast';

export default function LoginPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);


  const loginMutation = useMutation({
    mutationFn: async (variables: { email: string; password: string }) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variables)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Invalid credentials');
      }
      return await res.json();
    },
    onSuccess: (data: { token: string; user_id: string; role: string; name?: string }) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user_id);
      localStorage.setItem('userRole', data.role);
      if (data.name) localStorage.setItem('userName', data.name);
      window.location.href = data.role === 'ADMIN' ? '/admin' : data.role === 'CUSTOMER' ? '/seller/dashboard' : '/dashboard';
    },
    onError: (err: Error) => {
      setToast({ message: `Login failed: ${err.message}`, type: 'error' });
    }
  });

  return (
    <div className="min-h-screen flex bg-[#f4f5f7] dark:bg-zinc-950 font-sans selection:bg-indigo-500/30">
      <Toast message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />
      
      {/* Left Marketing Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-900 overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80')" }}></div>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-zinc-900/80 to-zinc-950/95"></div>
        <div className="relative z-10 p-12 max-w-xl text-white">
          <Link href="/" className="inline-flex items-center gap-2 mb-12 hover:opacity-80 transition-opacity">
            <Gavel size={36} strokeWidth={2.5} className="text-indigo-400" />
            <span className="font-black text-3xl tracking-tight">ProcureX</span>
          </Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-5xl font-black mb-6 leading-tight">Drive freight costs to their true market bottom.</h2>
            <p className="text-lg text-zinc-300 font-medium leading-relaxed mb-10">
              Log in to your enterprise dashboard to monitor live Reverse Auctions, bid on Forward Auctions, and manage your capacity seamlessly.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-4">
                <div className="w-12 h-12 rounded-full border-2 border-indigo-900 bg-zinc-300 bg-cover bg-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&q=80')"}}></div>
                <div className="w-12 h-12 rounded-full border-2 border-indigo-900 bg-zinc-400 bg-cover bg-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&q=80')"}}></div>
                <div className="w-12 h-12 rounded-full border-2 border-indigo-900 bg-zinc-500 bg-cover bg-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&q=80')"}}></div>
              </div>
              <div>
                <div className="flex gap-1 text-yellow-400 text-sm">
                  ★ ★ ★ ★ ★
                </div>
                <p className="text-sm font-bold text-zinc-300">Trusted by 10,000+ logistics professionals</p>
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
          className="w-full max-w-md printed-card rounded-3xl p-8 sm:p-10 bg-[#fdfbf7] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl shadow-zinc-200/50 dark:shadow-black/40 z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5 border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
              <Gavel size={28} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">Welcome back</h1>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 text-center">Enter your credentials to access your account.</p>
          </div>

          <form className="space-y-5" onSubmit={(e) => {
            e.preventDefault();
            const target = e.target as HTMLFormElement;
            const email = (target.elements[0] as HTMLInputElement).value;
            const password = (target.elements[1] as HTMLInputElement).value;
            loginMutation.mutate({ email, password });
          }}>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-2.5 text-zinc-400" />
                <input 
                  type="email" 
                  required
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none text-sm" 
                  placeholder="name@company.com" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Password</label>
                <Link href="/forgot-password" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-2.5 text-zinc-400" />
                <input 
                  type="password"
                  required
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none text-sm" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loginMutation.isPending}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-md shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-center disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loginMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Signing In...</>
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4">
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Or continue with</span>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
          </div>

          <div className="mt-8">
            <button className="w-full flex items-center justify-center gap-3 bg-[#fdfbf7] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-[#f4f5f7] dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-2.5 px-4 rounded-md transition-colors shadow-sm text-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
          </div>

          <p className="mt-10 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
