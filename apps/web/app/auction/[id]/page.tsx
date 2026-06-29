'use client';

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { initAuction } from '../../../store/slices/auctionSlice';
import { useConcurrencyGuard } from '../../../hooks/useConcurrencyGuard';
import { useServerTimeSync } from '../../../hooks/useServerTimeSync';
import { ConcurrencyGuardModal } from '../../../components/auction/ConcurrencyGuardModal';
import { CountdownTimer } from '../../../components/auction/CountdownTimer';
import { BiddingConsole } from '../../../components/auction/BiddingConsole';
import { Leaderboard } from '../../../components/auction/Leaderboard';
import { AuditLedger } from '../../../components/auction/AuditLedger';
import { useSocket } from '../../../contexts/SocketContext';
import { Gavel, History, Settings, LogOut, Activity, ShieldCheck, User, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AuctionPage({ params }: { params: { id: string } }) {
  const dispatch = useDispatch();
  const { socket, isConnected } = useSocket();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Collapsed by default

  const hasConflict = useConcurrencyGuard(params.id);
  useServerTimeSync(); // Keep it mounted to run sync, but we don't need isSyncing here

  useEffect(() => {
    // Mock initializing the auction. In reality, you'd fetch initial state.
    dispatch(initAuction({
      auctionId: params.id,
      endTime: Date.now() + 4500000, // 1h 15m from now
      initialLowest: 10850.00,
    }));
  }, [dispatch, params.id]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join auction room
    socket.emit('join_auction', { auctionId: params.id });

    // Listen to real-time events
    socket.on('bid_reconciled', () => {
      // Reconciled by global store action (usually you dispatch from a generic socket listener or here)
      // dispatch(reconcileBid(payload));
    });

    return () => {
      socket.emit('leave_auction', { auctionId: params.id });
      socket.off('bid_reconciled');
    };
  }, [socket, isConnected, params.id]);

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-300 flex overflow-hidden selection:bg-indigo-500/30">
      <ConcurrencyGuardModal hasConflict={hasConflict} />
      
      {/* Collapsed Sidebar */}
      <motion.aside 
        initial={{ width: 64 }}
        animate={{ width: sidebarOpen ? 240 : 64 }}
        className="h-screen bg-[#111827] border-r border-slate-800 flex flex-col items-center py-6 shadow-2xl z-20 flex-shrink-0 transition-all duration-300"
      >
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#1e293b] text-[#38bdf8] mb-8 hover:bg-[#334155] transition-colors"
        >
          <Gavel size={20} strokeWidth={2.5} />
        </button>

        <nav className="flex-1 w-full px-2 space-y-2 flex flex-col items-center">
          {[
            { icon: Activity, label: 'Live Auction', active: true },
            { icon: History, label: 'Past Bids', active: false },
            { icon: ShieldCheck, label: 'Audit', active: false },
            { icon: Settings, label: 'Settings', active: false },
          ].map((item, i) => (
            <button 
              key={i}
              className={`w-full h-10 flex items-center ${sidebarOpen ? 'justify-start px-4' : 'justify-center'} rounded-lg transition-all group ${
                item.active 
                  ? 'bg-[#1e293b] text-[#38bdf8] font-bold shadow-sm border border-slate-700' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#1e293b]/50 border border-transparent'
              }`}
            >
              <item.icon size={18} className={item.active ? 'text-[#38bdf8]' : ''} />
              {sidebarOpen && <span className="ml-3 truncate text-xs">{item.label}</span>}
            </button>
          ))}
        </nav>

        <button className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors mt-auto">
          <LogOut size={18} />
        </button>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden relative">
        {/* Header matching image */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-slate-800 bg-[#111827] z-10">
          <div>
            <h1 className="text-sm font-semibold text-slate-300">
              Auction ID: <span className="text-[#38bdf8]">#RVA-8812</span> - &quot;Enterprise Cloud Storage Contract&quot;
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             <button className="relative text-slate-400 hover:text-slate-200">
                <Bell size={18} />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#111827]"></div>
             </button>
             <button className="flex items-center gap-2 bg-[#1e293b] hover:bg-[#334155] border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 transition-colors">
                <div className="w-5 h-5 rounded-full bg-slate-600 overflow-hidden flex items-center justify-center">
                   <User size={12} className="text-slate-400" />
                </div>
                User_Delta
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] ml-1" />
             </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="flex-1 overflow-auto p-6 z-10 flex items-center justify-center">
          <div className="w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-6">
                 {/* Top Left: Timer */}
                 <div className="h-[200px]">
                   <CountdownTimer />
                 </div>
                 {/* Top Right (Inside Left Col): Leaderboard */}
                 <div className="h-[200px]">
                   <Leaderboard />
                 </div>
              </div>
              
              {/* Bottom Left: Bidding Console */}
              <div className="h-[250px] relative">
                 <BiddingConsole />
              </div>
            </div>
            
            {/* Right Column (Audit Ledger) */}
            <div className="lg:col-span-4 flex flex-col h-full min-h-[470px]">
              <AuditLedger />
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
