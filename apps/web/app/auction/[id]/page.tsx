'use client';

import { useEffect, useState, use } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { useConcurrencyGuard } from '../../../hooks/useConcurrencyGuard';
import { useServerTimeSync } from '../../../hooks/useServerTimeSync';
import { ConcurrencyGuardModal } from '../../../components/auction/ConcurrencyGuardModal';
import { CountdownTimer } from '../../../components/auction/CountdownTimer';
import { BiddingConsole } from '../../../components/auction/BiddingConsole';
import { Leaderboard } from '../../../components/auction/Leaderboard';
import { AuditLedger } from '../../../components/auction/AuditLedger';
import { User, Bell, Loader2, Clock, CalendarDays, CheckCircle2, Radio, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toast } from '../../../components/Toast';
import { useAuctionSocket } from '../../../hooks/useAuctionSocket';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Auction } from '../../../types/api';

const AuctionDetailsView = dynamic(
  () => import('../../../components/auction/AuctionDetailsView').then((module) => module.AuctionDetailsView),
  {
    loading: () => <div className="min-h-[620px] animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />,
    ssr: false,
  },
);

export default function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const auctionStatus = useSelector((state: RootState) => state.auction.auctionStatus);
  const startTime = useSelector((state: RootState) => state.auction.startTime);
  const router = useRouter();
  const queryClient = useQueryClient();

  const hasConflict = useConcurrencyGuard(resolvedParams.id);
  useServerTimeSync(); // Keep it mounted to run sync, but we don't need isSyncing here

  // Auction state is now dynamically initialized via WebSocket 'auction_init' event

    const [hasJoined, setHasJoined] = useState(false);
    const [now, setNow] = useState(0);
    const { data: auction, isLoading: membershipLoading } = useQuery({
      queryKey: ['auction-membership', resolvedParams.id],
      queryFn: async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/auction`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not verify registration');
        return (body.auctions as Auction[]).find(item => item.id === resolvedParams.id) || null;
      },
    });
    useEffect(() => {
      setNow(Date.now());
      const timer = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(timer);
    }, []);
    
    // Connect to WebSocket ONLY after the user has successfully joined
    useAuctionSocket(hasJoined ? resolvedParams.id : '');
    
    const joinMutation = useMutation({
        mutationFn: async () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
            const res = await fetch(`${apiUrl}/api/auction/${resolvedParams.id}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    router.push('/login');
                    throw new Error('Authentication required. Redirecting...');
                }
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to join auction');
            }
            return res;
        },
        onSuccess: () => {
            setHasJoined(true);
            queryClient.invalidateQueries({ queryKey: ['auction-membership', resolvedParams.id] });
        },
        onError: (err: Error) => {
            if (err.message === 'You have already joined this auction') {
                setHasJoined(true);
            } else {
                setJoinError(err.message);
            }
        }
    });

    // Rehydrate the Redis authorization bit for users already registered in
    // Postgres (for example, after a Redis restart) before opening the socket.
    useEffect(() => {
      if (auction?.is_registered && !hasJoined && !joinMutation.isPending) {
        joinMutation.mutate();
      }
    }, [auction?.is_registered, hasJoined, joinMutation]);

    const leaveMutation = useMutation({
      mutationFn: async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/auction/${resolvedParams.id}/leave`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Could not unregister');
      },
      onSuccess: () => { setHasJoined(false); queryClient.invalidateQueries({ queryKey: ['auction-membership', resolvedParams.id] }); },
      onError: (error: Error) => setJoinError(error.message),
    });

    const [joinError, setJoinError] = useState('');

    const handleJoinAuction = () => {
        joinMutation.mutate();
    };

    // Join is automatic via socket connection auth

    if (membershipLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

    const startsAt = auction ? new Date(auction.auction_start_time).getTime() : 0;
    const endsAt = auction ? new Date(auction.auction_end_time).getTime() : 0;
    const joinDeadline = startsAt - 5 * 60_000;
    const phase = now >= endsAt ? 'completed' : now >= startsAt ? 'live' : 'upcoming';

    if (!auction) return <div className="grid min-h-[calc(100dvh-4rem)] place-items-center p-6 text-center"><div><h1 className="text-2xl font-black">Auction not found</h1><button onClick={() => router.push('/dashboard')} className="mt-4 font-bold text-blue-600">Return to dashboard</button></div></div>;

    if (phase === 'live' && auction?.is_registered && !hasJoined) {
      return (
        <div className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-slate-50 p-6 dark:bg-zinc-950">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-5 font-bold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            <Loader2 className="animate-spin text-indigo-600" size={20} />
            Opening live auction…
          </div>
        </div>
      );
    }

    if (!hasJoined || phase !== 'live') {
        const canRegister = phase !== 'completed' && now < joinDeadline;
        return (
            <div className="min-h-[calc(100dvh-4rem)] bg-slate-50 px-4 py-8 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 sm:px-8">
              <Toast message={joinError} type="error" onClose={() => setJoinError('')} />
              <div className="mx-auto max-w-6xl space-y-6">
                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white ${phase === 'live' ? 'bg-rose-600' : phase === 'upcoming' ? 'bg-blue-600' : 'bg-slate-600'}`}>
                          {phase === 'live' ? <Radio size={14} className="animate-pulse" /> : phase === 'upcoming' ? <Clock size={14} /> : <CheckCircle2 size={14} />}{phase}
                        </span>
                        {hasJoined && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Registered</span>}
                      </div>
                      <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{auction.title}</h1>
                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-500 dark:text-zinc-400">
                        <span className="flex items-center gap-2"><CalendarDays size={16} /> Starts {new Date(auction.auction_start_time).toLocaleString()}</span>
                        <span className="flex items-center gap-2"><Clock size={16} /> Ends {new Date(auction.auction_end_time).toLocaleString()}</span>
                        <span className="flex items-center gap-2"><Clock size={16} /> Register by {new Date(joinDeadline).toLocaleString()}</span>
                        <span className="flex items-center gap-2"><Users size={16} /> {auction.participants_count || 0} registered</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                      {hasJoined && phase === 'upcoming' && <button onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 font-extrabold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{leaveMutation.isPending ? 'Unregistering…' : 'Unregister'}</button>}
                      {!hasJoined && canRegister && <button onClick={handleJoinAuction} disabled={joinMutation.isPending} className={`rounded-xl px-6 py-3 font-extrabold text-white shadow-lg disabled:opacity-50 ${phase === 'live' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{joinMutation.isPending ? 'Joining…' : phase === 'live' ? 'Join live auction' : 'Register for auction'}</button>}
                      {!hasJoined && !canRegister && phase !== 'completed' && <span className="rounded-xl bg-amber-100 px-5 py-3 font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Registration closed</span>}
                      {phase === 'completed' && <span className="rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-500 dark:bg-zinc-800">Auction completed</span>}
                    </div>
                  </div>
                </section>
                <div className="min-h-[620px]"><AuctionDetailsView auction={auction} initialTab={auction.media_urls?.length ? 'photos' : 'details'} /></div>
              </div>
                </div>
        );
    }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex overflow-hidden selection:bg-indigo-500/30 transition-colors duration-300">
      <ConcurrencyGuardModal hasConflict={hasConflict} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {auctionStatus === 'waiting' && startTime ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-100/50 to-transparent dark:from-indigo-900/20 dark:to-transparent pointer-events-none transition-colors" />
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-12 rounded-3xl flex flex-col items-center max-w-lg w-full text-center relative overflow-hidden transition-colors">
               <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 dark:bg-indigo-500/10 blur-3xl rounded-full" />
               <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-400/20 dark:bg-sky-400/10 blur-3xl rounded-full" />
               <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full flex items-center justify-center mb-6 shadow-inner relative z-10 transition-colors">
                 <Clock size={32} className="text-indigo-600 dark:text-indigo-400" />
               </div>
               <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 mb-4 relative z-10 tracking-tight transition-colors">Auction Starts Soon</h2>
               <p className="text-zinc-600 dark:text-zinc-400 mb-8 relative z-10 font-medium transition-colors">You are registered and in the waiting room. The live auction console will open automatically once the countdown reaches zero.</p>
               <div className="w-full bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 relative z-10 transition-colors">
                  <CountdownTimer />
               </div>
               <button onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} className="relative z-10 mt-4 inline-flex items-center gap-2 border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                 {leaveMutation.isPending && <Loader2 size={16} className="animate-spin" />} Unregister from auction
               </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header matching image */}
            <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md z-10 transition-colors">
              <div>
                <h1 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 transition-colors">
                  Auction ID: <span className="text-indigo-600 dark:text-indigo-400">#{resolvedParams.id}</span>
                </h1>
              </div>
              
              <div className="flex items-center gap-4">
                 <button className="relative text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
                    <Bell size={18} />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-zinc-900 transition-colors"></div>
                 </button>
                 <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors">
                    <div className="w-5 h-5 rounded-full bg-zinc-300 dark:bg-zinc-600 overflow-hidden flex items-center justify-center transition-colors">
                       <User size={12} className="text-zinc-500 dark:text-zinc-400" />
                    </div>
                    Participant
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] ml-1" />
                 </div>
              </div>
            </header>

            {/* Dashboard Grid */}
            <div className="flex-1 overflow-auto p-6 z-10 flex items-center justify-center relative">
              {/* Subtle background glow for premium feel */}
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-400/10 dark:bg-sky-400/5 blur-[100px] rounded-full pointer-events-none" />

              <div className="w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
                
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
          </>
        )}
      </main>
    </div>
  );
}
