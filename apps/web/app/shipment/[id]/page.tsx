'use client';

import { useState, use } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Sidebar } from '../../../components/Sidebar';
import { CountdownTimer } from '../../../components/auction/CountdownTimer';
import { BiddingConsole } from '../../../components/auction/BiddingConsole';
import { Leaderboard } from '../../../components/auction/Leaderboard';
import { AuditLedger } from '../../../components/auction/AuditLedger';
import { AuctionDetailsView } from '../../../components/auction/AuctionDetailsView';
import { AuctionQnA } from '../../../components/auction/AuctionQnA';
import { WinnerModal } from '../../../components/auction/WinnerModal';
import { useAuctionSocket } from '../../../hooks/useAuctionSocket';
import { useServerTimeSync } from '../../../hooks/useServerTimeSync';
import { ArrowLeft, Share2, Map, Image as ImageIcon, FileText, X, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Auction } from '../../../types/api';

export default function AuctionDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'details' | 'photos' | 'map'>('details');
  const [qnaModalOpen, setQnaModalOpen] = useState(false);

  const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  useServerTimeSync();

  // useAuctionSocket handles: subscribe/unsubscribe, auction_init (sets isParticipant),
  // bid_update, auction_closed — all via the global SocketContext.
  useAuctionSocket(resolvedParams.id);

  const { data: auctions } = useQuery({
    queryKey: ['auctions'],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auction`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch auctions');
      const json = await res.json();
      return (json.auctions || []) as Auction[];
    },
  });

  const auction = auctions?.find(a => a.id === resolvedParams.id);

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-slate-300 selection:bg-indigo-500/30">
      <WinnerModal />
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        
        {/* Header Strip */}
        <div className="bg-[#faf9f6] dark:bg-zinc-900 border-b border-zinc-200 dark:border-slate-800 px-8 py-4 flex flex-col md:flex-row justify-between items-center shadow-sm dark:shadow-md relative z-50 gap-4 transition-colors">
          <div className="flex items-center gap-4 w-full md:w-auto">
             <Link href="/" className="text-zinc-500 hover:text-zinc-900 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
               <ArrowLeft size={20} />
             </Link>
             <div>
                <h2 className="font-semibold text-sm leading-tight text-zinc-900 dark:text-slate-300">
                  {auction?.auction_type === 'FORWARD' ? 'Forward' : 'Reverse'} Auction: <span className="text-indigo-600 dark:text-[#38bdf8]">#{resolvedParams.id}</span>
                </h2>
                <p className="text-zinc-500 dark:text-slate-500 text-xs">{auction?.title || 'Loading...'}</p>
             </div>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
             <button 
                onClick={() => setQnaModalOpen(true)}
                className="w-full sm:w-auto flex-1 sm:flex-none justify-center bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors border border-purple-200 dark:border-purple-800 text-xs flex items-center gap-2"
             >
                <MessageSquare size={14} /> Pre-Auction Discussion
             </button>
             <div className="relative group w-full sm:w-auto flex-1 sm:flex-none z-50">
               <button 
                  onClick={() => { setDetailsTab('details'); setDetailsModalOpen(true); }}
                  className="w-full justify-center bg-indigo-50 dark:bg-[#1e293b] text-indigo-700 dark:text-[#38bdf8] hover:bg-indigo-100 dark:hover:bg-[#334155] px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors border border-indigo-200 dark:border-slate-700 text-xs flex items-center gap-2"
               >
                  <Map size={14} /> View Auction Details
               </button>
               
               {/* Dropdown Menu on Hover */}
               <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[60] flex flex-col p-1.5 translate-y-1 group-hover:translate-y-0">
                  <button onClick={() => { setDetailsTab('details'); setDetailsModalOpen(true); }} className="text-left px-3 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors flex items-center gap-2">
                     <FileText size={14} /> Text Details
                  </button>
                  <button onClick={() => { setDetailsTab('photos'); setDetailsModalOpen(true); }} className="text-left px-3 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors flex items-center gap-2">
                     <ImageIcon size={14} /> Item Media
                  </button>
                  <button onClick={() => { setDetailsTab('map'); setDetailsModalOpen(true); }} className="text-left px-3 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors flex items-center gap-2">
                     <Map size={14} /> Live Route Map
                  </button>
               </div>
             </div>
             <button className="w-full sm:w-auto flex-1 sm:flex-none justify-center bg-emerald-50 dark:bg-emerald-600/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-600/20 px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors border border-emerald-200 dark:border-emerald-900 text-xs flex items-center gap-2">
                <Share2 size={14} /> Share
             </button>
          </div>
        </div>

        {/* Main Content Area: Re-designed Modular Auction UI */}
        <div className="flex-1 overflow-auto p-4 md:p-6 z-10 flex flex-col items-center">
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="w-full max-w-[1400px] flex flex-col gap-6 h-full"
          >
            
            {/* Top Row: Timer & Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-shrink-0">
               <motion.div variants={fadeUp} className="lg:col-span-5 flex flex-col gap-6">
                 <div className="h-[160px] md:h-[200px]">
                   <CountdownTimer />
                 </div>
               </motion.div>
               <motion.div variants={fadeUp} className="lg:col-span-7 h-full">
                 <Leaderboard />
               </motion.div>
            </div>

            {/* Bottom Row: Console & Ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[400px]">
               <motion.div variants={fadeUp} className="lg:col-span-5 flex flex-col gap-6 relative">
                 <div className="flex-1 min-h-[400px]">
                    <BiddingConsole />
                 </div>
               </motion.div>

               <motion.div variants={fadeUp} className="lg:col-span-7 h-full">
                 <AuditLedger />
               </motion.div>
            </div>

          </motion.div>
        </div>
      </main>

      {/* Details Popup / Modal - Pixabay Style (Wider with dark transparent bg) */}
      <AnimatePresence>
        {detailsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/30 dark:bg-black/50 backdrop-blur-md p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="w-[95vw] max-w-[1600px] h-[90vh] bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-slate-700/50 rounded-2xl shadow-2xl relative flex flex-col overflow-hidden transition-colors"
             >
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-zinc-900">
                  <h3 className="text-zinc-900 dark:text-slate-300 font-semibold text-sm">Auction Information & Media</h3>
                  <button onClick={() => setDetailsModalOpen(false)} className="p-2 bg-zinc-200 dark:bg-slate-800 hover:bg-zinc-300 dark:hover:bg-slate-700 rounded-full text-zinc-600 dark:text-slate-300 transition-colors">
                     <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-[#faf9f6] dark:bg-zinc-900">
                   <AuctionDetailsView initialTab={detailsTab} auction={auction} />
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QnA Glassmorphism Modal */}
      <AnimatePresence>
        {qnaModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/30 dark:bg-black/50 backdrop-blur-md p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="w-[95vw] max-w-[1600px] h-[85vh] bg-[#faf9f6]/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl relative flex flex-col overflow-hidden transition-colors"
             >
                <div className="flex items-center justify-between p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <h3 className="text-zinc-900 dark:text-zinc-50 font-bold text-lg flex items-center gap-2">
                    <MessageSquare size={18} className="text-indigo-500" /> Pre-Auction Discussion
                  </h3>
                  <button onClick={() => setQnaModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50 rounded-full text-zinc-600 dark:text-zinc-300 transition-colors">
                     <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden p-6 bg-transparent">
                   {/* Remove the border/bg from AuctionQnA since it's already in a modal with its own style */}
                   <AuctionQnA />
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
