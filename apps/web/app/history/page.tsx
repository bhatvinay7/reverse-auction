'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '../../components/Sidebar';
import { History as HistoryIcon, Clock, Package, MapPin, Download, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { BidHistoryGraph } from '../../components/auction/BidHistoryGraph';

// Mock detailed bid data for the graph
const MOCK_BIDS = [
  { time: '10:00 AM', amount: 3500, bidder: 'Carrier A' },
  { time: '10:15 AM', amount: 3350, bidder: 'Carrier B' },
  { time: '10:45 AM', amount: 3200, bidder: 'Carrier A' },
  { time: '11:10 AM', amount: 2900, bidder: 'Carrier C' },
  { time: '11:35 AM', amount: 2750, bidder: 'Carrier B' },
  { time: '11:55 AM', amount: 2500, bidder: 'Carrier A' },
  { time: '12:05 PM', amount: 2450, bidder: 'You' }, // winning bid
];

const MOCK_HISTORY = [
  { id: 'SHP-9021', title: 'Heavy Machinery Relocation', date: '2026-06-25', status: 'Completed', amount: '$2,450', route: 'Detroit, MI → Atlanta, GA', bids: MOCK_BIDS },
  { id: 'SHP-8834', title: '1x 40\' High Cube Container', date: '2026-06-20', status: 'Lost Bid', amount: '$1,350', route: 'Shanghai Port, CN → Los Angeles, US', bids: MOCK_BIDS.map(b => ({ ...b, amount: b.amount * 0.5 })) },
  { id: 'SHP-8711', title: 'Structural Steel Beams', date: '2026-06-15', status: 'Completed', amount: '$820', route: 'Pittsburgh, PA → Austin, TX', bids: MOCK_BIDS.map(b => ({ ...b, amount: b.amount * 0.3 })) },
  { id: 'SHP-8502', title: 'Medical Supplies Transport', date: '2026-06-02', status: 'Completed', amount: '$3,400', route: 'Berlin, DE → London, UK', bids: MOCK_BIDS.map(b => ({ ...b, amount: b.amount * 1.3 })) },
];

export default function HistoryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-64 pt-20 md:pt-8 p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
              <HistoryIcon size={28} className="text-indigo-600 dark:text-indigo-400" /> Bidding History
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Review your past won and lost logistics contracts.</p>
          </div>
          <button className="flex items-center gap-2 bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm text-sm">
            <Download size={16} /> Export CSV
          </button>
        </div>

        <div className="printed-card rounded-xl bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                <th className="p-4 pl-6">Ref ID</th>
                <th className="p-4">Shipment / Route</th>
                <th className="p-4">Date</th>
                <th className="p-4">Final Bid</th>
                <th className="p-4 pr-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_HISTORY.map((item, idx) => (
                <motion.tr 
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => toggleExpand(item.id)}
                  className={`border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${expandedId === item.id ? 'bg-zinc-50 dark:bg-zinc-800/30' : ''}`}
                >
                  <td className="p-4 pl-6 font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {item.id}
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1 font-medium"><MapPin size={12} /> {item.route}</p>
                  </td>
                  <td className="p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2 mt-2">
                    <Clock size={14} className="text-zinc-400" /> {item.date}
                  </td>
                  <td className="p-4 font-black text-zinc-900 dark:text-zinc-100">{item.amount}</td>
                  <td className="p-4 pr-6 text-right">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                      item.status === 'Completed' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Glassmorphism Modal for Graph */}
      <AnimatePresence>
        {expandedId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/30 dark:bg-black/50 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-[95vw] max-w-[1600px] bg-[#faf9f6]/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl relative flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Bid Timeline Analysis</h3>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{expandedId}</span> 
                    &bull; {MOCK_HISTORY.find(h => h.id === expandedId)?.title}
                  </p>
                </div>
                <button 
                  onClick={() => setExpandedId(null)} 
                  className="w-10 h-10 flex items-center justify-center bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50 rounded-full text-zinc-600 dark:text-zinc-300 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="p-6">
                <BidHistoryGraph data={MOCK_HISTORY.find(h => h.id === expandedId)?.bids || []} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
