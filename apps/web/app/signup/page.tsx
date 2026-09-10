'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Gavel, Mail, Lock, User, ArrowRight, Building2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Toast } from '../../components/Toast';

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({ name: '', company_name: '', email: '', password: '', role_type: 'CARRIER' });
  const [otp, setOtp] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const sendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send OTP');
      }
      return res;
    },
    onSuccess: () => {
      setStep(2);
    },
    onError: (err: Error) => {
      setToast({ message: `Error: ${err.message}`, type: 'error' });
    }
  });

  const signupMutation = useMutation({
    mutationFn: async (variables: typeof formData & { otp: string }) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variables)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Unknown error');
      }
      return await res.json();
    },
    onSuccess: (data: { token: string; user_id: string; role: string; name?: string }) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user_id);
      localStorage.setItem('userRole', data.role);
      if (data.name) localStorage.setItem('userName', data.name);
      window.location.href = data.role === 'CUSTOMER' ? '/seller/dashboard' : '/dashboard';
    },
    onError: (err: Error) => {
      setToast({ message: `Signup failed: ${err.message}`, type: 'error' });
    }
  });

  return (
    <div className="min-h-screen flex bg-[#f4f5f7] dark:bg-zinc-950 font-sans selection:bg-indigo-500/30">
      <Toast message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />
      
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
              {step === 1 ? <Gavel size={28} strokeWidth={2.5} /> : <Mail size={28} strokeWidth={2.5} />}
            </div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">
              {step === 1 ? 'Create an account' : 'Verify Email'}
            </h1>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 text-center">
              {step === 1 ? 'Join the premier logistics marketplace.' : `Enter the 6-digit code sent to ${formData.email}`}
            </p>
          </div>

          {step === 1 ? (
          <form className="space-y-5" onSubmit={(e) => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget);
            const name = String(fields.get('name') || '').trim();
            const company_name = String(fields.get('company_name') || '').trim();
            const email = String(fields.get('email') || '').trim().toLowerCase();
            const password = String(fields.get('password') || '');
            const role_type = String(fields.get('role_type') || 'CARRIER');
            
            setFormData({ name, company_name, email, password, role_type });
            sendOtpMutation.mutate(email);
          }}>
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-2.5 text-zinc-400" />
                  <input 
                    name="name"
                    type="text" 
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none text-sm" 
                    placeholder="Enter your full name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Company Name</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-2.5 text-zinc-400" />
                  <input 
                    name="company_name"
                    type="text" 
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none text-sm" 
                    placeholder="Enter your business name"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Account Type</label>
              <div className="relative">
                <select 
                  name="role_type"
                  required
                  defaultValue="CARRIER"
                  className="w-full pl-3 pr-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none text-sm appearance-none"
                >
                  <option value="CARRIER">Bidder - browse and bid in auctions</option>
                  <option value="CUSTOMER">Seller - submit products for auction</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-zinc-400">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-2.5 text-zinc-400" />
                <input 
                  name="email"
                  type="email" 
                  required
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none text-sm" 
                  placeholder="name@company.com" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-2.5 text-zinc-400" />
                <input 
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none text-sm" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={sendOtpMutation.isPending}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-md shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-center disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {sendOtpMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Sending...</>
              ) : (
                <>Continue <ArrowRight size={16} /></>
              )}
            </button>
          </form>
          ) : (
          <form className="space-y-5" onSubmit={(e) => {
            e.preventDefault();
            signupMutation.mutate({ ...formData, otp });
          }}>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Verification Code</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-2.5 text-zinc-400" />
                <input 
                  type="text" 
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#f4f5f7] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:border-indigo-500 transition-colors outline-none tracking-widest text-lg" 
                  placeholder="123456" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={signupMutation.isPending}
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-md shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-center disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {signupMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Verifying...</>
              ) : (
                <>Verify & Complete Signup <ArrowRight size={16} /></>
              )}
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full mt-4 bg-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-bold py-2 text-sm transition-colors">
              Back to edit details
            </button>
          </form>
          )}

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
