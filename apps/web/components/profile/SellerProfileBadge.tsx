'use client';

import { Star, ShieldCheck, MapPin } from 'lucide-react';

export function SellerProfileBadge() {
  return (
    <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl border border-indigo-100 dark:border-indigo-800/50">
            GF
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              Global Freight Co.
              <ShieldCheck size={16} className="text-emerald-500" />
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
              <MapPin size={12} /> Established 2018
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-yellow-500 justify-end mb-1">
            <Star size={16} fill="currentColor" />
            <span className="font-bold text-zinc-900 dark:text-zinc-50">4.9</span>
          </div>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 underline decoration-dotted cursor-pointer">
            124 Reviews
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-6 border-t border-zinc-100 dark:border-zinc-800 pt-4">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider mb-1">Total Auctions</p>
          <p className="font-bold text-zinc-900 dark:text-zinc-50 text-lg">342</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider mb-1">Response Rate</p>
          <p className="font-bold text-zinc-900 dark:text-zinc-50 text-lg">98%</p>
        </div>
      </div>
    </div>
  );
}
