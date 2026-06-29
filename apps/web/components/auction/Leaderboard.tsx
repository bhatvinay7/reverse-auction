'use client';

import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { ArrowDownUp, ArrowDown } from 'lucide-react';

export function Leaderboard() {
  const { bids } = useSelector((state: RootState) => state.auction);

  const bestBids = Object.values(bids.reduce((acc, bid) => {
    if (bid.status !== 'rejected') {
      if (!acc[bid.bidder] || acc[bid.bidder].amount > bid.amount) {
        acc[bid.bidder] = bid;
      }
    }
    return acc;
  }, {} as Record<string, typeof bids[0]>))
  .sort((a, b) => a.amount - b.amount)
  .slice(0, 5);

  return (
    <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-slate-700/50 rounded-xl flex flex-col h-full shadow-sm dark:shadow-2xl relative overflow-hidden transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-slate-700/50">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-300 uppercase tracking-wider">TOP COMPETITORS (Virtual Rank)</h3>
      </div>
      
      <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-zinc-900 transition-colors">
        <table className="w-full text-left text-xs text-zinc-800 dark:text-slate-300">
          <thead className="bg-[#faf9f6] dark:bg-zinc-900 text-zinc-500 dark:text-slate-400 border-b border-zinc-200 dark:border-slate-700/50 uppercase">
            <tr>
              <th className="px-6 py-3 font-semibold flex items-center gap-1">RANK <ArrowDown size={12} /></th>
              <th className="px-6 py-3 font-semibold">TOP COMPETITORS</th>
              <th className="px-6 py-3 font-semibold text-right flex items-center justify-end gap-1">SORTED <ArrowDownUp size={12} /></th>
            </tr>
          </thead>
          <tbody>
            {bestBids.map((bid, index) => {
              const isYou = bid.bidder === 'You (Optimistic)';
              return (
                <tr key={bid.bidder} className={`border-b border-zinc-200 dark:border-slate-700/50 ${index % 2 === 0 ? 'bg-zinc-100 dark:bg-slate-800/20' : 'bg-[#faf9f6] dark:bg-zinc-900'} hover:bg-zinc-200 dark:hover:bg-slate-700/30 transition-colors`}>
                  <td className="px-6 py-3 font-bold text-yellow-600 dark:text-yellow-500">{index + 1}</td>
                  <td className="px-6 py-3 font-medium">
                    {isYou ? 'User_Lambda' : bid.bidder} 
                    {isYou && <span className="text-yellow-600 dark:text-yellow-500 ml-1">(You)</span>}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-zinc-900 dark:text-slate-200">
                    {bid.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                </tr>
              );
            })}
            {bestBids.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-zinc-500 dark:text-slate-500 font-medium">No active competitors yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
