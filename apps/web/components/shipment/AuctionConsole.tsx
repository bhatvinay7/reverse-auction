'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, TrendingDown, ShieldCheck, DollarSign, Star, AlertCircle } from 'lucide-react';
import { socket } from '../../lib/socket';

interface Bid {
  id: string;
  amount: number;
  vendor: string;
  rating: number;
  isCurrentUser: boolean;
  timestamp: string;
}

export function AuctionConsole() {
  const [bids, setBids] = useState<Bid[]>([
    {
      id: 'bid-initial-2',
      amount: 2500,
      vendor: 'FastTrack Logistics',
      rating: 4.5,
      isCurrentUser: false,
      timestamp: new Date().toISOString()
    },
    {
      id: 'bid-initial-1',
      amount: 2450,
      vendor: 'Apex Hauling',
      rating: 4.9,
      isCurrentUser: false,
      timestamp: new Date().toISOString()
    }
  ]);

  const [inputAmount, setInputAmount] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(7200); // 2 hours in seconds

  const currentLowest = Math.min(...bids.map(b => b.amount));
  const minDecrement = 25; // Minimum $25 drop
  const requiredBid = currentLowest - minDecrement;

  // Simulate Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to socket events
  useEffect(() => {
    const handleNewBid = (newBid: Bid) => {
      setBids(prev => {
        // If a new bid comes in last 5 minutes (300s), simulate extension
        if (timeLeft < 300) {
          setTimeLeft(prevTime => prevTime + 300);
        }
        return [newBid, ...prev].slice(0, 50); // Keep last 50 bids
      });
    };

    socket.on('new_bid', handleNewBid);
    return () => {
      socket.off('new_bid', handleNewBid);
    };
  }, [timeLeft]);

  const handlePlaceBid = () => {
    const val = parseFloat(inputAmount);
    
    if (isNaN(val)) {
      setError('Enter a valid amount');
      return;
    }
    
    if (val > requiredBid) {
      setError(`Bid must be $${requiredBid} or lower (Min decrement: $${minDecrement})`);
      return;
    }

    setError('');
    // Emit to our mock socket
    socket.emit('place_bid', { amount: val });
    setInputAmount('');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isExtended = timeLeft > 0 && timeLeft < 300;

  return (
    <div className="printed-card rounded-xl flex flex-col h-[700px] border-2 border-indigo-500/20 shadow-xl shadow-indigo-900/5 bg-[#faf9f6] dark:bg-zinc-900">
      
      {/* Top Banner */}
      <div className="p-6 pb-4 border-b border-zinc-200 dark:border-zinc-800 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <DollarSign size={120} />
        </div>
        
        <div className="relative z-10 flex justify-between items-start">
           <div>
             <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-2 tracking-wide uppercase text-sm">
               <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></div>
               Live Auction
             </div>
             <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Bidding Console</h3>
           </div>
           
           <div className={`text-right ${isExtended ? 'animate-pulse text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
             <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-zinc-500">Time Remaining</p>
             <div className="flex items-center justify-end gap-1.5 text-2xl font-black font-mono">
               <Clock size={20} />
               {formatTime(timeLeft)}
             </div>
             {isExtended && <p className="text-[10px] font-bold mt-1 uppercase">Auto-Extended (+5m)</p>}
           </div>
        </div>

        <div className="mt-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 flex justify-between items-end">
           <div>
             <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-1">Current Lowest Bid</p>
             <AnimatePresence mode="popLayout">
               <motion.div
                 key={currentLowest}
                 initial={{ opacity: 0, y: -20, color: '#10B981' }}
                 animate={{ opacity: 1, y: 0, color: 'inherit' }}
                 className="text-4xl font-black text-emerald-600 dark:text-emerald-500"
               >
                 ${currentLowest.toLocaleString()}
               </motion.div>
             </AnimatePresence>
           </div>
           <div className="text-right">
             <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-500 justify-end">
               <TrendingDown size={14} /> Down 23%
             </div>
             <p className="text-xs text-zinc-400 line-through mt-1">Start: $3,200</p>
           </div>
        </div>
      </div>

      {/* Live Feed List (Flex-1 for scrolling) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/20">
        <div className="flex justify-between items-center px-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
          <span>Rank & Vendor</span>
          <span>Bid Amount</span>
        </div>
        
        <AnimatePresence initial={false}>
          {bids.map((bid, index) => {
            const isLowest = index === 0;
            return (
              <motion.div
                key={bid.id}
                initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(79, 70, 229, 0.2)' }}
                animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                transition={{ duration: 0.5 }}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  isLowest 
                    ? 'bg-[#faf9f6] dark:bg-zinc-900 border-indigo-200 dark:border-indigo-900/50 shadow-sm' 
                    : 'bg-transparent border-zinc-200 dark:border-zinc-800/50 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isLowest ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${bid.isCurrentUser ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                      {bid.vendor}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5 font-medium">
                       <Star size={10} className="text-yellow-500 fill-yellow-500" /> {bid.rating}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black ${isLowest ? 'text-emerald-600 dark:text-emerald-500 text-lg' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    ${bid.amount.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {new Date(bid.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Bid Placement Controls */}
      <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-[#faf9f6] dark:bg-zinc-900 shrink-0">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Place Your Bid (USD)</label>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Target: $\le {requiredBid.toLocaleString()}</span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-zinc-500 font-bold">$</span>
            </div>
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className={`block w-full pl-7 pr-12 py-3.5 rounded-lg border-2 bg-[#faf9f6] dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold text-lg transition-colors ${
                error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:ring-indigo-600 focus:border-indigo-600'
              }`}
              placeholder={requiredBid.toString()}
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 font-bold mt-1.5 flex items-center gap-1">
              <AlertCircle size={12} /> {error}
            </p>
          )}
        </div>
        
        <button 
          onClick={handlePlaceBid}
          disabled={timeLeft === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-4 px-4 rounded-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {timeLeft === 0 ? 'Auction Closed' : 'Submit Binding Bid'}
        </button>

        <div className="mt-4 flex items-start gap-2">
          <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 leading-tight">
            Binding contract. Escrow protection enabled. Auto-extends by 5 minutes if a bid is placed in the final moments.
          </p>
        </div>
      </div>
    </div>
  );
}
