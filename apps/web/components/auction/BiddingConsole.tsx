'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { addOptimisticBid } from '../../store/slices/auctionSlice';
import { useSocket } from '../../contexts/SocketContext';
import { CheckCircle2 } from 'lucide-react';

export function BiddingConsole() {
  const dispatch = useDispatch();
  const { currentLowestBid, isConnected, auctionStatus, auctionId, bids } = useSelector((state: RootState) => state.auction);
  const { socket } = useSocket();
  const [bidAmount, setBidAmount] = useState<string>('');
  
  // Track last submission for UI status
  const [lastBidStatus, setLastBidStatus] = useState<'NONE' | 'PENDING' | 'CONFIRMED' | 'REJECTED'>('NONE');

  const myBids = bids.filter(b => b.bidder === 'You (Optimistic)');
  const latestMyBid = myBids.length > 0 ? myBids[0] : null;

  useEffect(() => {
    if (latestMyBid) {
      if (latestMyBid.status === 'confirmed') setLastBidStatus('CONFIRMED');
      else if (latestMyBid.status === 'rejected') setLastBidStatus('REJECTED');
      else setLastBidStatus('PENDING');
    }
  }, [latestMyBid]);

  const handleBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (auctionStatus !== 'active' || !socket || !auctionId) return;

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (currentLowestBid !== null && amount >= currentLowestBid) return;

    const bidId = Math.random().toString(36).substring(7);
    const timestamp = Date.now();
    
    dispatch(addOptimisticBid({
      id: bidId,
      amount,
      bidder: 'You (Optimistic)',
      timestamp,
      status: 'pending'
    }));

    socket.emit('submit_bid', { auctionId, bidId, amount, timestamp });
    setBidAmount('');
  };

  return (
    <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-slate-700/50 rounded-xl flex flex-col h-full shadow-sm dark:shadow-2xl relative overflow-hidden transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-slate-700/50">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-300">Optimistic-Enabled Bidding Console</h3>
      </div>
      
      <div className="flex-1 p-6 flex items-center justify-center gap-8">
        
        {/* Input Box Area */}
        <form onSubmit={handleBidSubmit} className="flex flex-col border border-yellow-500/50 rounded-xl p-4 bg-zinc-50 dark:bg-slate-800/30 w-[300px] transition-colors">
          <label className="text-[10px] uppercase font-bold text-zinc-500 dark:text-slate-400 mb-1">YOUR BID</label>
          <input 
            type="number" 
            step="0.01"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            disabled={auctionStatus !== 'active' || !isConnected}
            className="w-full bg-[#faf9f6] dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-md py-2 px-3 text-zinc-900 dark:text-slate-200 font-mono focus:outline-none focus:border-yellow-500 mb-3 transition-colors"
          />
          <button 
            type="submit" 
            disabled={auctionStatus !== 'active' || !isConnected}
            className="w-full bg-zinc-900 dark:bg-slate-200 hover:bg-zinc-800 dark:hover:bg-[#faf9f6] text-white dark:text-slate-900 font-bold py-2 rounded-md transition-colors text-xs"
          >
            SUBMIT LOWER BID
          </button>
          <div className="mt-3 text-center text-xs font-medium text-zinc-500 dark:text-slate-400">
            Current Lowest: <span className="text-zinc-900 dark:text-slate-200">${currentLowestBid ? currentLowestBid.toLocaleString(undefined, {minimumFractionDigits: 2}) : '---'}</span>
          </div>
        </form>

        {/* Status Indicator Area */}
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="text-xs text-zinc-500 dark:text-slate-400 font-semibold mb-1">Bid Status</div>
          <div className="bg-emerald-50 dark:bg-slate-800/50 border border-emerald-200 dark:border-emerald-900/50 rounded text-emerald-600 dark:text-emerald-500 font-bold text-xs py-1.5 px-3 w-max transition-colors">
            {lastBidStatus === 'NONE' ? 'NO ACTIVE BID' : lastBidStatus}
          </div>
          
          {lastBidStatus === 'CONFIRMED' && (
            <div className="flex items-center gap-1.5 mt-2 text-emerald-600 dark:text-emerald-500 text-xs font-semibold">
              <CheckCircle2 size={14} />
              Optimistic-Reconciliation: SUCCESS
            </div>
          )}
        </div>

      </div>

      <div className="bg-zinc-50 dark:bg-zinc-900 p-3 text-center border-t border-zinc-200 dark:border-slate-700/50 text-[10px] font-mono text-zinc-500 dark:text-slate-400 uppercase tracking-widest transition-colors">
        GLOBAL AUCTION UPDATE: NEW LOWEST BID RECEIVED!
      </div>
    </div>
  );
}
