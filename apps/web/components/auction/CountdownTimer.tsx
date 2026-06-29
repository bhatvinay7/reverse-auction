'use client';

import { useTimerWorker } from '../../hooks/useTimerWorker';
import { Activity } from 'lucide-react';

export function CountdownTimer() {
  const timeLeft = useTimerWorker();
  
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
  const milliseconds = timeLeft % 1000;
  
  return (
    <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-slate-700/50 rounded-xl p-6 shadow-sm dark:shadow-2xl flex flex-col h-full relative overflow-hidden transition-colors">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-300 mb-6">Clock-Skew Corrected Server-Time</h3>
      
      <div className="flex-1 flex flex-col items-center justify-center">
        <span className="text-[10px] text-zinc-500 dark:text-slate-400 mb-2 uppercase tracking-[0.2em] font-bold">Time Remaining:</span>
        
        <div className="flex items-center gap-6">
          <Activity className="text-emerald-600 dark:text-emerald-500 opacity-80" size={36} />
          
          <div className="font-mono text-5xl font-normal text-zinc-900 dark:text-white tracking-wider tabular-nums flex items-baseline">
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}.<span className="text-3xl text-zinc-500 dark:text-slate-300">{milliseconds.toString().padStart(3, '0')}</span>
          </div>

          <Activity className="text-emerald-600 dark:text-emerald-500 opacity-80" size={36} />
        </div>
      </div>
    </div>
  );
}
