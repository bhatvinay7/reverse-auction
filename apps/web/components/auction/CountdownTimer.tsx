'use client';

import { useTimerWorker } from '../../hooks/useTimerWorker';
import { Activity } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

export function CountdownTimer() {
  const timeLeft = useTimerWorker();
  const { auctionStatus } = useSelector((state: RootState) => state.auction);

  const safeTime = Math.max(0, Math.floor(timeLeft));
  const hours = Math.floor(safeTime / (1000 * 60 * 60));
  const minutes = Math.floor((safeTime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((safeTime % (1000 * 60)) / 1000);
  const milliseconds = safeTime % 1000;
  
  const isUrgent = auctionStatus === 'active' && safeTime > 0 && safeTime <= 20000;
  const textColor = isUrgent ? 'text-red-600 dark:text-red-500 animate-pulse' : 'text-zinc-900 dark:text-white';
  const milliColor = isUrgent ? 'text-red-400 dark:text-red-400' : 'text-zinc-500 dark:text-slate-300';
  const iconColor = isUrgent ? 'text-red-600 dark:text-red-500 animate-ping' : 'text-emerald-600 dark:text-emerald-500 opacity-80';
  
  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm dark:shadow-2xl flex flex-col h-full relative overflow-hidden transition-colors">
      <h3 className="mb-6 text-sm font-semibold text-zinc-900 dark:text-slate-300">Auction countdown</h3>
      
      <div className="flex-1 flex flex-col items-center justify-center">
        <span className="text-[10px] text-zinc-500 dark:text-slate-400 mb-2 uppercase tracking-[0.2em] font-bold">
          {auctionStatus === 'waiting' ? 'Starts In:' : auctionStatus === 'active' ? 'Ends In:' : 'Auction Ended'}
        </span>
        
        <div className="flex min-w-0 items-center gap-3 sm:gap-6" aria-live="off" aria-label={`${hours} hours ${minutes} minutes ${seconds} seconds remaining`}>
          <Activity className={`${iconColor} hidden sm:block`} size={28} />
          
          <div className={`flex items-baseline font-mono text-3xl font-normal tabular-nums sm:text-5xl ${textColor}`}>
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}<span className={`hidden text-2xl sm:inline ${milliColor}`}>.{milliseconds.toString().padStart(3, '0')}</span>
          </div>

          <Activity className={`${iconColor} hidden sm:block`} size={28} />
        </div>
      </div>
    </div>
  );
}
