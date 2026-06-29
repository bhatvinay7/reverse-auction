'use client';

import { useRef } from 'react';
import { useSelector } from 'react-redux';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RootState } from '../../store/store';
import { format } from 'date-fns';

export function AuditLedger() {
  const { bids } = useSelector((state: RootState) => state.auction);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: bids.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  return (
    <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-slate-700/50 rounded-xl flex flex-col h-full shadow-sm dark:shadow-2xl relative overflow-hidden transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-slate-700/50">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-300">Virtualized Stream Audit Ledger</h3>
      </div>
      
      <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-zinc-900 p-4 transition-colors" ref={parentRef}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const bid = bids[virtualRow.index];
            const isRejected = bid.status === 'rejected';
            const isConfirmed = bid.status === 'confirmed';
            
            const timeStr = `[${format(new Date(bid.timestamp), 'HH:mm:ss')}]`;
            let statusText = '';
            let textColor = 'text-zinc-800 dark:text-slate-300';

            if (isRejected) {
              statusText = '(REJECTED: Conflict)';
              textColor = 'text-red-600 dark:text-red-500';
            } else if (isConfirmed) {
              statusText = `($${bid.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}) [CONFIRMED]`;
              textColor = 'text-emerald-600 dark:text-emerald-500';
            } else {
              statusText = `($${bid.amount.toLocaleString(undefined, {minimumFractionDigits: 2})})`;
            }

            return (
              <div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`text-xs font-mono flex items-center leading-relaxed ${textColor}`}
              >
                <span className="opacity-70 mr-2">{timeStr}</span> 
                - {bid.bidder === 'You (Optimistic)' ? 'User_Lambda' : bid.bidder} Bid 
                <span className="ml-1">{statusText}</span>
              </div>
            );
          })}
          {bids.length === 0 && (
            <div className="text-zinc-500 dark:text-slate-500 text-xs font-mono italic">No events in the ledger yet...</div>
          )}
        </div>
      </div>
    </div>
  );
}
