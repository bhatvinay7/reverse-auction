'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Gavel, TrendingDown, Clock, ShieldCheck, ArrowRight, Package, MapPin } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 font-sans selection:bg-indigo-500/30">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#faf9f6]/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <Gavel size={28} strokeWidth={2.5} />
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-50">ProcureX</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">How it Works</Link>
            <Link href="/login" className="text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Sign In</Link>
            <Link href="/signup" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-600/20">
              Get Started
            </Link>
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden flex justify-center items-center px-4 md:px-6">
        
        {/* Main Card (Tablet Case) acting as background for hero text */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative w-full max-w-[1400px] aspect-auto min-h-[700px] bg-[#f4f5f7] dark:bg-[#0a0a0a] rounded-[2rem] md:rounded-[3rem] p-3 md:p-4 shadow-2xl shadow-zinc-200/50 dark:shadow-indigo-500/10 border border-zinc-200 dark:border-zinc-800 ring-1 ring-black/5 dark:ring-white/10"
        >
          {/* Inner Screen */}
          <div className="relative w-full h-full min-h-[700px] bg-[#fdfbf7] dark:bg-[#0a0c10] rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden flex flex-col justify-center items-center py-20 px-6 border border-zinc-200 dark:border-transparent">
            
            {/* Mild Glow Effects behind text */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[80%] bg-indigo-500/10 dark:bg-indigo-500/20 blur-[120px] rounded-full dark:mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[70%] bg-emerald-500/5 dark:bg-emerald-500/10 blur-[120px] rounded-full dark:mix-blend-screen pointer-events-none"></div>
            
            {/* Fake UI Header (Top bar of the tablet) */}
            <div className="absolute top-0 left-0 right-0 p-6 md:p-8 flex items-center justify-between opacity-80 z-20 pointer-events-none">
              <div className="flex items-center gap-2">
                 <Gavel size={20} className="text-zinc-900 dark:text-white" />
                 <span className="font-bold text-zinc-900 dark:text-white text-lg tracking-tight">ProcureX Live</span>
              </div>
              <div className="hidden md:flex gap-4">
                 <div className="h-2 w-16 bg-zinc-300 dark:bg-white/20 rounded-full"></div>
                 <div className="h-2 w-16 bg-zinc-300 dark:bg-white/20 rounded-full"></div>
                 <div className="h-2 w-16 bg-zinc-300 dark:bg-white/20 rounded-full"></div>
              </div>
            </div>

            <div className="relative z-10 text-center max-w-5xl mx-auto space-y-8 mt-12">
              <motion.div initial="hidden" animate="show" variants={stagger}>
                <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-bold text-sm mb-8 shadow-sm dark:shadow-none">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                  </span>
                  The Future of Freight Procurement
                </motion.div>
                
                <motion.h1 variants={fadeUp} className="text-5xl md:text-[5.5rem] font-black text-zinc-900 dark:text-white tracking-tight leading-[1.05] mb-8">
                  The Ultimate Marketplace for <br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500 dark:from-indigo-400 dark:via-cyan-400 dark:to-emerald-400">Reverse & Forward Auctions.</span>
                </motion.h1>
                
                <motion.p variants={fadeUp} className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 font-medium max-w-3xl mx-auto leading-relaxed mt-6">
                  ProcureX is the enterprise-grade logistics platform where certified carriers compete in real-time to win your loads, and where you can seamlessly liquidate abandoned freight to the public.
                </motion.p>
                
                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-10">
                  <Link href="/signup" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-bold transition-all active:scale-95 shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2">
                    Start Shipping <ArrowRight size={20} />
                  </Link>
                  <Link href="/dashboard" className="w-full sm:w-auto bg-white dark:bg-white/10 hover:bg-zinc-50 dark:hover:bg-white/15 border-2 border-zinc-200 dark:border-white/20 text-zinc-900 dark:text-white px-8 py-4 rounded-xl text-lg font-bold transition-all shadow-sm">
                    View Live Dashboard
                  </Link>
                </motion.div>
              </motion.div>
            </div>
            
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-[#faf9f6] dark:bg-zinc-900 relative z-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Built for modern logistics</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-4 font-medium text-lg max-w-2xl mx-auto">
              Everything you need to source capacity, manage carriers, and drive down freight costs in one unified platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="printed-card p-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                <TrendingDown size={28} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">Live Reverse Auctions</h3>
              <p className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                Watch rates drop in real-time. Carriers compete against each other to win your load, ensuring you always pay the true market floor.
              </p>
            </div>
            <div className="printed-card p-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6">
                <ShieldCheck size={28} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">Verified Network</h3>
              <p className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                Every carrier is thoroughly vetted for DOT compliance, insurance verification, and safety ratings before they can place a single bid.
              </p>
            </div>
            <div className="printed-card p-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 mb-6">
                <Clock size={28} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">Anti-Sniping Engine</h3>
              <p className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                Smart auction rules automatically extend time by 5 minutes if a bid is placed in the final moments, maximizing competition.
              </p>
            </div>
            <div className="printed-card p-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                <Package size={28} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">Public Forward Auctions</h3>
              <p className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                Effortlessly auction off abandoned cargo, unclaimed freight, and lost items to the highest bidder in our public marketplace.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-50 dark:bg-zinc-900 py-12 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Gavel size={24} />
            <span className="font-bold text-lg text-zinc-900 dark:text-zinc-50">ProcureX</span>
          </div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            © 2026 ProcureX Logistics Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
