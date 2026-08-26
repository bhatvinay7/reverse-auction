'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '../../components/Sidebar';
import { History as HistoryIcon, Clock, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Auction } from '../../types/api';

import { useQuery } from '@tanstack/react-query';

function useAuctions() {
  const { data } = useQuery({
    queryKey: ['auctions', 'history'],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auction/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch auctions');
      const json = await res.json();
      return (json.auctions || []) as Auction[];
    },
  });
  
  return data || [];
}

export default function HistoryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'won'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMyUserId(localStorage.getItem('userId'));
    }
  }, []);

  const auctions = useAuctions();
  
  // Filter for 'won' tab
  const filteredAuctions = activeTab === 'all' 
    ? auctions 
    : auctions.filter(a => a.is_closed && a.winner_id === myUserId);
  
  const totalPages = Math.ceil(filteredAuctions.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAuctions = filteredAuctions.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-64 pt-20 md:pt-8 p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
              <HistoryIcon size={28} className="text-indigo-600 dark:text-indigo-400" /> Bidding History
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Review every auction you joined, across both bid directions.</p>
          </div>
          <div className="flex bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-lg">
            <button
              onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'all' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              All Participated
            </button>
            <button
              onClick={() => { setActiveTab('won'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'won' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Won Bids
            </button>
          </div>
        </div>

        <div className="printed-card rounded-xl bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                <th className="p-4 pl-6">Ref ID</th>
                <th className="p-4">Auction item</th>
                <th className="p-4">Date</th>
                <th className="p-4">Final Bid</th>
                <th className="p-4 pr-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAuctions.map((item: Auction, idx: number) => {
                const now = new Date();
                const endTime = new Date(item.auction_end_time.replace(' ', 'T') + 'Z');
                const isClosed = now > endTime;
                return (
                <motion.tr 
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => router.push(isClosed ? `/auction/bidinfo/${item.id}` : `/auction/${item.id}`)}
                  className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <td className="p-4 pl-6 font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {item.id.substring(0, 8)}...
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1 font-medium"><MapPin size={12} /> {item.item_category || item.origin_address || 'General item'}{item.dest_address ? ` → ${item.dest_address}` : ''}</p>
                  </td>
                  <td className="p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2 mt-2">
                    <Clock size={14} className="text-zinc-400" /> {(item.pickup_date || item.auction_end_time).split(/[ T]/)[0]}
                  </td>
                  <td className="p-4 font-black text-zinc-900 dark:text-zinc-100">
                    {/* Display actual lowest bid logic if possible, else pending */}
                    {item.starting_price ? `$${item.starting_price}` : 'Pending'}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    {(() => {
                      if (!isClosed) {
                        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</span>;
                      }
                      
                      if (item.winner_id === myUserId) {
                        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Won</span>;
                      } else if (item.winner_id) {
                        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Lost</span>;
                      }
                      
                      return <span className="px-2.5 py-1 rounded text-xs font-bold bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">Closed</span>;
                    })()}
                  </td>
                </motion.tr>
                );
              })}
              {paginatedAuctions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    {activeTab === 'won' ? 'You have not won any auctions yet.' : 'You have not participated in any auctions yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {filteredAuctions.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                Showing <span className="font-bold text-zinc-900 dark:text-zinc-100">{startIndex + 1}</span> to <span className="font-bold text-zinc-900 dark:text-zinc-100">{Math.min(startIndex + itemsPerPage, filteredAuctions.length)}</span> of <span className="font-bold text-zinc-900 dark:text-zinc-100">{filteredAuctions.length}</span> results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
