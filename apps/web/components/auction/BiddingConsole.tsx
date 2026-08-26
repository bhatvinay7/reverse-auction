'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, CircleAlert, Loader2, Minus, Plus, Signal, SignalZero } from 'lucide-react';
import { RootState } from '../../store/store';
import { addOptimisticBid } from '../../store/slices/auctionSlice';
import { useSocket } from '../../contexts/SocketContext';
import { Toast } from '../Toast';

export function BiddingConsole() {
  const dispatch = useDispatch();
  const { currentPrice, auctionType, minimumBidStep, isConnected, auctionStatus, auctionId, bids, isParticipant } = useSelector((state: RootState) => state.auction);
  const { emitEvent, onEvent } = useSocket();
  const [bidAmount, setBidAmount] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const latest = bids.find(bid => bid.bidder === 'You (Optimistic)');
  const nextValid = useMemo(() => currentPrice === null ? null : auctionType === 'REVERSE' ? Math.max(0.01, currentPrice - minimumBidStep) : currentPrice + minimumBidStep, [auctionType, currentPrice, minimumBidStep]);
  const canBid = auctionStatus === 'active' && isConnected && isParticipant;

  useEffect(() => {
    if (!auctionId) return;
    return onEvent(auctionId, 'error', value => setToast({ message: typeof value === 'string' ? value : 'The bid could not be processed.', type: 'error' }));
  }, [auctionId, onEvent]);

  const adjust = (direction: 1 | -1) => {
    const base = Number(bidAmount) || nextValid || minimumBidStep;
    setBidAmount(Math.max(0.01, base + direction * minimumBidStep).toFixed(2));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canBid || !auctionId) return;
    const amount = Number(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) return setToast({ message:'Enter a valid amount greater than zero.', type:'error' });
    if (nextValid !== null && (auctionType === 'REVERSE' ? amount > nextValid : amount < nextValid)) return setToast({ message:`Your bid must be ${auctionType === 'REVERSE' ? 'at most' : 'at least'} $${nextValid.toFixed(2)}.`, type:'error' });
    dispatch(addOptimisticBid({ id:crypto.randomUUID(), amount, bidder:'You (Optimistic)', timestamp:Date.now(), status:'pending' }));
    emitEvent(auctionId, 'place_bid', { auction_id:auctionId, bidder_id:localStorage.getItem('userId') || 'AnonymousUser', username:localStorage.getItem('userName') || undefined, amount, timestamp:Date.now() });
    setBidAmount('');
  };
  const state = !isConnected ? { icon:SignalZero, label:'Reconnecting', tone:'text-amber-700 bg-amber-50 border-amber-200' } : !isParticipant ? { icon:CircleAlert, label:'Registration required', tone:'text-rose-700 bg-rose-50 border-rose-200' } : auctionStatus === 'waiting' ? { icon:Loader2, label:'Waiting to start', tone:'text-blue-700 bg-blue-50 border-blue-200' } : auctionStatus === 'ended' ? { icon:CheckCircle2, label:'Auction ended', tone:'text-zinc-600 bg-zinc-100 border-zinc-200' } : { icon:Signal, label:'Live and connected', tone:'text-emerald-700 bg-emerald-50 border-emerald-200' };
  const StateIcon = state.icon;

  return <section className="flex h-full min-h-[320px] flex-col border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby="bid-console-title">
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800"><div><h2 id="bid-console-title" className="font-black">Place a bid</h2><p className="text-xs text-zinc-500">{auctionType === 'REVERSE' ? 'Lower bids lead' : 'Higher bids lead'} · minimum step ${minimumBidStep.toFixed(2)}</p></div><div className={`flex items-center gap-2 border px-3 py-1.5 text-xs font-bold ${state.tone}`}><StateIcon size={14} className={state.label === 'Waiting to start' ? 'animate-spin' : ''} />{state.label}</div></header>
    <div className="grid flex-1 items-center gap-6 p-5 sm:grid-cols-[0.8fr_1.2fr] sm:p-6"><div><p className="text-xs font-bold uppercase text-zinc-500">Current {auctionType === 'REVERSE' ? 'lowest' : 'highest'} bid</p><p className="mt-2 break-all text-4xl font-black tabular-nums sm:text-5xl">{currentPrice === null ? 'Open' : `$${currentPrice.toLocaleString(undefined,{minimumFractionDigits:2})}`}</p>{nextValid !== null && <p className="mt-3 text-sm text-zinc-500">Next valid bid: <strong className="text-zinc-900 dark:text-white">{auctionType === 'REVERSE' ? '≤' : '≥'} ${nextValid.toFixed(2)}</strong></p>}</div>
      <form onSubmit={submit}><label htmlFor="bid-amount" className="text-sm font-bold">Your bid (USD)</label><div className="mt-2 grid grid-cols-[44px_1fr_44px] border border-zinc-300 dark:border-zinc-700"><button type="button" onClick={() => adjust(-1)} disabled={!canBid} aria-label={`Reduce bid by ${minimumBidStep}`} className="grid h-12 place-items-center border-r border-zinc-300 disabled:opacity-40 dark:border-zinc-700"><Minus size={18} /></button><input id="bid-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={bidAmount} onChange={event => setBidAmount(event.target.value)} disabled={!canBid} placeholder={nextValid?.toFixed(2) || 'Enter amount'} className="min-w-0 bg-transparent px-3 text-center text-xl font-black outline-none disabled:opacity-40" /><button type="button" onClick={() => adjust(1)} disabled={!canBid} aria-label={`Increase bid by ${minimumBidStep}`} className="grid h-12 place-items-center border-l border-zinc-300 disabled:opacity-40 dark:border-zinc-700"><Plus size={18} /></button></div><button disabled={!canBid} className="mt-3 h-12 w-full bg-indigo-600 px-5 font-black text-white hover:bg-indigo-700 disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800">{auctionStatus === 'ended' ? 'Auction ended' : !isConnected ? 'Reconnecting…' : 'Submit bid'}</button><div aria-live="polite" className="mt-3 min-h-5 text-center text-xs font-bold text-zinc-500">{latest?.status === 'pending' && 'Bid submitted, awaiting confirmation…'}{latest?.status === 'confirmed' && <span className="text-emerald-700">Bid accepted and synchronized.</span>}{latest?.status === 'rejected' && <span className="text-rose-700">Bid rejected. Review the valid bid amount.</span>}</div></form>
    </div>
  </section>;
}
