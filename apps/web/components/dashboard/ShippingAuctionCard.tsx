'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Clock, Users, CheckCircle2, MapPin, Package, PackageOpen, Radio, CalendarDays, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Toast } from '../Toast';

export interface ShippingAuctionCardProps {
  id?: string;
  title: string;
  origin?: string | null;
  destination?: string | null;
  distance: string;
  category: string;
  image: string;
  lowestBid: string;
  suppliers: number;
  auctionStartTime?: string;
  auctionEndTime?: string;
  auctionType?: 'REVERSE' | 'FORWARD';
  isRegistered?: boolean;
  viewMode?: 'grid' | 'strip';
}

export function ShippingAuctionCard({ id, title, origin, destination, distance, category, image, lowestBid, suppliers, auctionStartTime, auctionEndTime, auctionType = 'REVERSE', isRegistered, viewMode = 'grid' }: ShippingAuctionCardProps) {
  const [now, setNow] = useState(0);
  const queryClient = useQueryClient();
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const router = useRouter();

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No auction ID');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auction/${id}/join`, {
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
        throw new Error(data.error || 'Failed to register');
      }
      return res;
    },
    onSuccess: () => {
      setToastMsg('Successfully registered for auction!');
      setToastType('success');
      setShowJoinModal(false);
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (err: Error) => {
      if (err.message === 'You have already joined this auction') {
        setToastMsg('You are already registered!');
        setToastType('info');
        queryClient.invalidateQueries({ queryKey: ['auctions'] });
      } else {
        setToastMsg(err.message);
        setToastType('error');
      }
      setShowJoinModal(false);
    }
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No auction ID');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auction/${id}/leave`, {
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
        throw new Error(data.error || 'Failed to unregister');
      }
      return res;
    },
    onSuccess: () => {
      setToastMsg('Successfully unregistered from auction.');
      setToastType('info');
      setShowLeaveModal(false);
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (err: Error) => {
      setToastMsg(err.message);
      setToastType('error');
      setShowLeaveModal(false);
    }
  });

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const parseUtcDate = (dateStr: string) => {
    if (dateStr.includes(' ') && !dateStr.includes('Z')) {
      return new Date(dateStr.replace(' ', 'T') + 'Z');
    }
    return new Date(dateStr);
  };

  const startTime = auctionStartTime ? parseUtcDate(auctionStartTime) : new Date(now);
  const endTime = auctionEndTime ? parseUtcDate(auctionEndTime) : new Date(now + 86400000);
  // The API enforces this same deadline. Keeping it here makes the final
  // administrator schedule and registration cut-off clear before a user acts.
  const joinTime = new Date(endTime.getTime() - 5 * 60_000);
  const isVideo = /\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(image) || image.includes('/video/upload/');
  
  let actionText = 'Place Bid';
  let isClosed = false;
  let timeLabel = '';
  let timeDiff = 0;

  if (now === 0) {
    actionText = 'Loading…';
    timeLabel = 'Checking schedule';
  } else if (now > endTime.getTime()) {
    actionText = 'Closed';
    isClosed = true;
    timeLabel = 'Ended';
    timeDiff = 0;
  } else if (now >= startTime.getTime() && now <= endTime.getTime()) {
    actionText = isRegistered ? 'Enter Console' : now < joinTime.getTime() ? 'Join Live' : 'Registration closed';
    isClosed = !isRegistered && now >= joinTime.getTime();
    timeLabel = 'Ends in';
    timeDiff = endTime.getTime() - now;
  } else if (now < startTime.getTime()) {
    actionText = isRegistered ? 'Unregister' : now < joinTime.getTime() ? 'Register' : 'Registration closed';
    isClosed = !isRegistered && now >= joinTime.getTime();
    timeLabel = 'Time left to register';
    timeDiff = joinTime.getTime() - now;
  }

  const phase = now > endTime.getTime() ? 'completed' : now >= startTime.getTime() ? 'live' : 'upcoming';
  const phaseStyle = phase === 'live' ? 'bg-rose-600 text-white' : phase === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white';

  const timeDiffSecs = Math.floor(timeDiff / 1000);
  const diffDays = Math.floor(timeDiffSecs / 86400);
  const diffHours = Math.floor((timeDiffSecs % 86400) / 3600);
  const diffMinutes = Math.floor((timeDiffSecs % 3600) / 60);
  const displayTime = timeDiff > 0 ? (diffDays > 0 ? `${diffDays}d ${diffHours}h ${diffMinutes}m` : `${diffHours}h ${diffMinutes}m`) : '';

  const startDiff = startTime.getTime() - now;
  const joinDiff = joinTime.getTime() - now;
  
  const formatDate = (d: Date) => {
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatCountdown = (diff: number) => {
    if (diff <= 0) return '00:00:00';
    const totalSeconds = Math.floor(diff / 1000);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return d > 0 ? `${d}d ${timeStr}` : timeStr;
  };

  const startTimer = startDiff > 0 ? `${formatDate(startTime)} (in ${formatCountdown(startDiff)})` : 'Started';
  const joinTimer = joinDiff > 0 ? `${formatDate(joinTime)} (in ${formatCountdown(joinDiff)})` : 'Closed';

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (actionText === 'Register') {
      setShowJoinModal(true);
    } else if (actionText === 'Unregister') {
      setShowLeaveModal(true);
    } else if (actionText === 'Enter Console') {
      router.push(`/auction/${id}`);
    } else if (actionText === 'Join Live') {
      setShowJoinModal(true);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.action-button')) {
      return;
    }
    router.push(`/auction/${id}`);
  };


  return (
    <>
    <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    <div 
      onClick={handleCardClick}
      className={clsx(
      "cursor-pointer block rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl dark:hover:shadow-indigo-900/30 group bg-gradient-to-br from-white via-blue-50/35 to-cyan-50/50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 backdrop-blur-xl border border-blue-100 dark:border-zinc-800 flex relative before:absolute before:inset-0 before:bg-gradient-to-br before:from-indigo-500/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
      viewMode === 'strip' ? "flex-col md:flex-row" : "flex-col h-full"
    )}>
      <div className={clsx(
        "relative overflow-hidden shrink-0",
        viewMode === 'strip' ? "w-full md:w-72 h-48 md:h-auto border-b md:border-b-0 md:border-r border-zinc-200/50 dark:border-zinc-800/50" : "h-48 w-full border-b border-zinc-200/50 dark:border-zinc-800/50"
      )}>
        {image ? (isVideo ? <video src={image} muted playsInline preload="metadata" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />) : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-100 to-blue-100 text-blue-500 dark:from-zinc-800 dark:to-slate-900"><PackageOpen size={46} /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className={`absolute left-3 top-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-lg ${phaseStyle}`}>
           {phase === 'live' ? <Radio size={14} className="animate-pulse" /> : phase === 'upcoming' ? <Clock size={14} /> : <CheckCircle2 size={14} />}
           {phase}
        </div>
        <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
          {timeLabel}{displayTime ? ` · ${displayTime}` : ''}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
          <div className="bg-indigo-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-lg flex items-center gap-2 uppercase tracking-wider border border-indigo-400/30">
             <Package size={14} /> {category}
          </div>
        </div>
      </div>

      <div className={clsx(
        "p-6 flex-1 flex flex-col justify-between",
        viewMode === 'strip' && "md:py-5 md:px-8"
      )}>
        <div className={clsx(viewMode === 'strip' && "flex flex-col md:flex-row gap-6 md:gap-12 w-full justify-between")}>
          <div className="flex-1">
             <h4 className="font-extrabold text-zinc-900 dark:text-zinc-50 text-xl leading-tight mb-5 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{title}</h4>
             
             {origin || destination ? (
               <div className="flex items-start gap-4 mb-4">
                  <div className="flex flex-col items-center mt-1.5">
                    <div className="w-3 h-3 rounded-full bg-indigo-600 dark:bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)] z-10 ring-4 ring-indigo-50 dark:ring-indigo-900/30"></div>
                    <div className="w-0.5 h-10 bg-gradient-to-b from-indigo-200 to-emerald-200 dark:from-indigo-800 dark:to-emerald-800 -my-1"></div>
                    <MapPin size={18} className="text-emerald-600 dark:text-emerald-500 z-10 drop-shadow-md" />
                  </div>
                  <div className="flex flex-col justify-between h-[64px] text-sm flex-1">
                    <div className="text-zinc-600 dark:text-zinc-300 font-semibold">{origin || 'Location not specified'}</div>
                    <div className="text-zinc-900 dark:text-zinc-100 font-bold border-t border-zinc-100 dark:border-zinc-800/60 pt-2 w-full flex items-center gap-2">
                      {destination || 'Destination not specified'} 
                      {destination && <span className="text-xs font-bold text-indigo-600/70 dark:text-indigo-400/70 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{distance}</span>}
                    </div>
                  </div>
               </div>
             ) : (
               <div className="mb-4 rounded-xl border border-zinc-200/60 bg-zinc-50/50 backdrop-blur-sm px-4 py-3 text-sm font-semibold text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-300 flex items-center gap-3">
                 <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                   <PackageOpen size={16} />
                 </div>
                 General auction item · no route required
               </div>
             )}
          </div>

          <div className={clsx(
            "flex flex-col gap-3 shrink-0",
            viewMode === 'strip' ? "w-full lg:w-[320px]" : "mt-2"
          )}>
               <div className="bg-indigo-50/80 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-3 py-2.5 rounded-lg border border-indigo-100/50 dark:border-indigo-800/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                     <CalendarDays size={16} className="shrink-0" />
                     <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-800/80 dark:text-indigo-300/80">Starts</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums font-bold text-indigo-900 dark:text-indigo-200 text-right leading-tight">{startTimer}</span>
               </div>
               <div className="bg-orange-50/80 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-3 py-2.5 rounded-lg border border-orange-100/50 dark:border-orange-800/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                     <Clock size={16} className="shrink-0" />
                     <span className="text-[11px] font-extrabold uppercase tracking-widest text-orange-800/80 dark:text-orange-300/80">Join By</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums font-bold text-orange-900 dark:text-orange-200 text-right leading-tight">{joinTimer}</span>
               </div>
          </div>
        </div>

        <div className={clsx(
          "mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-end justify-between",
          viewMode === 'strip' && "mt-auto"
        )}>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-extrabold mb-1.5">{auctionType === 'FORWARD' ? 'Current highest' : 'Current lowest'}</p>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-500 tracking-tight">{lowestBid}</p>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-1.5">
               <Users size={14} className="text-zinc-400" /> {suppliers} active bids
            </p>
          </div>
          <div 
            onClick={handleActionClick}
            className={`action-button px-8 py-3.5 rounded-xl text-sm font-black shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] whitespace-nowrap transition-all flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0 ${isClosed ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500 shadow-none' : 'bg-zinc-900 dark:bg-zinc-50 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white dark:text-zinc-900 hover:shadow-[0_6px_20px_rgba(79,70,229,0.4)] cursor-pointer'} ${actionText === 'Unregister' ? 'bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700' : ''}`}
          >
            {(joinMutation.isPending && (actionText === 'Register' || actionText === 'Join Live')) || (leaveMutation.isPending && actionText === 'Unregister') ? <Loader2 size={16} className="animate-spin" /> : null}
            {actionText}
          </div>
        </div>
      </div>
    </div>

    {/* Registration Modal */}
    <AnimatePresence>
      {showJoinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowJoinModal(false); }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Confirm Registration</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                Are you sure you want to register for this auction? By registering, you agree to the terms and conditions.
              </p>
              
              <div className="flex items-center gap-3 justify-end">
                <button 
                  onClick={() => setShowJoinModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {joinMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Confirm Registration
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowLeaveModal(false); }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-zinc-200 dark:border-zinc-800 relative z-[201]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 mx-auto border-4 border-red-50 dark:border-red-900/10">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-xl font-black text-center text-zinc-900 dark:text-zinc-50 mb-2">Unregister from Auction</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
              Are you sure you want to unregister from this auction? You can register again before the deadline.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                disabled={leaveMutation.isPending}
              >
                Cancel
              </button>
              <button 
                onClick={() => leaveMutation.mutate()}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Unregister
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowSuccessModal(false); }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col items-center p-8 text-center"
          >
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Registration Successful</h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-8">
              You are now registered for <strong>{title}</strong>. You will be able to enter the live auction console when the event starts.
            </p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all"
            >
              Done
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
