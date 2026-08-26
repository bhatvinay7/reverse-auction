'use client';

import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { ArrowDownUp, ArrowDown } from 'lucide-react';

export function Leaderboard() {
  const { bids, auctionType } = useSelector((state: RootState) => state.auction);

  const bestBids = Object.values(bids.reduce((acc, bid) => {
    if (bid.status !== 'rejected') {
      const existing = acc[bid.bidder];
      if (!existing || (auctionType === 'REVERSE' ? existing.amount > bid.amount : existing.amount < bid.amount)) {
        acc[bid.bidder] = bid;
      }
    }
    return acc;
  }, {} as Record<string, typeof bids[0]>))
  .sort((a, b) => auctionType === 'REVERSE' ? a.amount - b.amount : b.amount - a.amount)
  .slice(0, 5);

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col h-full shadow-sm dark:shadow-2xl relative overflow-hidden transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-300">Leaderboard</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors
        [&::-webkit-scrollbar]:w-2
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:bg-zinc-300
        dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700
        [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full text-left text-xs text-zinc-800 dark:text-zinc-300">
          <thead className="bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 uppercase">
            <tr>
              <th className="px-6 py-3 font-semibold flex items-center gap-1">RANK <ArrowDown size={12} /></th>
              <th className="px-6 py-3 font-semibold">Bidder</th>
              <th className="px-6 py-3 font-semibold text-right flex items-center justify-end gap-1">Best bid <ArrowDownUp size={12} /></th>
            </tr>
          </thead>
          <tbody>
            {bestBids.map((bid, index) => {
              const isYou = bid.bidder === 'You (Optimistic)';
              return (
                <tr key={bid.bidder} className={`border-b border-zinc-200 dark:border-zinc-800 ${index % 2 === 0 ? 'bg-zinc-100 dark:bg-zinc-800/20' : 'bg-white dark:bg-zinc-900/50'} hover:bg-zinc-200 dark:hover:bg-zinc-800/40 transition-colors`}>
                  <td className="px-6 py-3 font-bold text-yellow-600 dark:text-yellow-500">{index + 1}</td>
                  <td className="px-6 py-3 font-medium">
                    {isYou ? 'You' : bid.bidder}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-zinc-900 dark:text-zinc-200">
                    {bid.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                </tr>
              );
            })}
            {bestBids.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-500 font-medium">No active competitors yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
