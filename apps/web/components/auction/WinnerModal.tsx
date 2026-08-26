'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Trophy, CheckCircle } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { useEffect, useState } from 'react';

export function WinnerModal() {
  const { auctionStatus, bids, auctionType } = useSelector((state: RootState) => state.auction);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (auctionStatus === 'ended') {
      // Delay slightly for effect
      const timer = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [auctionStatus]);

  if (!show) return null;

  // Find the winner using the server-provided auction direction.
  const validBids = bids.filter(b => b.status !== 'rejected');
  let winner = null;
  if (validBids.length > 0) {
    winner = validBids.reduce((prev, curr) => (
      auctionType === 'REVERSE'
        ? (prev.amount < curr.amount ? prev : curr)
        : (prev.amount > curr.amount ? prev : curr)
    ));
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
          className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-1 shadow-[0_0_50px_rgba(16,185,129,0.5)] max-w-md w-full relative overflow-hidden"
        >
          {/* Confetti / background effects could go here */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik00MCAwaC0xTTAgNDB2LTFMMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-30 pointer-events-none"></div>
          
          <div className="bg-zinc-950 rounded-[22px] p-8 relative flex flex-col items-center text-center">
            
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", bounce: 0.6 }}
              className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 border-4 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]"
            >
              <Crown size={48} className="text-emerald-400" />
            </motion.div>

            <h2 className="text-sm font-black text-emerald-500 tracking-[0.2em] uppercase mb-2">Auction Ended</h2>
            <h3 className="text-3xl font-black text-white mb-6">We have a Winner!</h3>

            {winner ? (
              <div className="w-full bg-zinc-900 border border-emerald-500/30 rounded-xl p-6 shadow-inner">
                <p className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-1">Winning Bidder</p>
                <p className="text-2xl font-bold text-emerald-400 mb-4 flex items-center justify-center gap-2">
                  <Trophy size={20} className="text-yellow-500" /> 
                  {winner.bidder === 'You (Optimistic)' ? 'You' : winner.bidder}
                </p>
                
                <p className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-1">Winning Amount</p>
                <p className="text-4xl font-black text-white font-mono">
                  ${winner.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
              </div>
            ) : (
              <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-inner">
                <p className="text-zinc-400 font-bold text-lg">No bids were placed.</p>
              </div>
            )}

            <button 
              onClick={() => setShow(false)}
              className="mt-8 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} /> Acknowledge
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
