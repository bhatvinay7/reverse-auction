'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Factory, Search, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Auction } from '../types/api';
import { AuctionSearch } from './auction/AuctionSearch';
import { DashboardOverview } from './dashboard/DashboardOverview';
import { ReverseAuctionsView } from './dashboard/ReverseAuctionsView';
import { ShippingAuctionCard } from './dashboard/ShippingAuctionCard';

function useAuctions() {
  const { data } = useQuery({
    queryKey: ['auctions'],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auction`, {
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

export function Dashboard() {
  const activeTab = useSelector((state: RootState) => state.ui.activeTab);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const auctions = useAuctions();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    setUserRole(localStorage.getItem('userRole'));
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500 relative pb-24">
      {activeTab === 'dashboard' && <DashboardOverview auctions={auctions} userRole={userRole} />}
      {activeTab === 'reverse' && <ReverseAuctionsView auctions={auctions} />}

      {/* Floating Action Button for Shippers */}
      {userRole === 'ADMIN' && (
        <div className="fixed bottom-8 right-8 z-40">
          <Link href="/auction/new" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-full shadow-2xl hover:scale-105 transition-transform font-bold tracking-wide">
             <Factory size={20} />
             Create New Auction
          </Link>
        </div>
      )}

      <AnimatePresence>
        {searchModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/30 dark:bg-black/50 backdrop-blur-md p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="w-[95vw] max-w-[1400px] h-[90vh] bg-[#faf9f6]/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl relative flex flex-col overflow-hidden transition-colors"
             >
                <div className="flex items-center justify-between p-6 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <h3 className="text-zinc-900 dark:text-zinc-50 font-bold text-xl flex items-center gap-2">
                    <Search size={20} className="text-indigo-500" /> Advanced Global Search
                  </h3>
                  <button onClick={() => setSearchModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50 rounded-full text-zinc-600 dark:text-zinc-300 transition-colors">
                     <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-6 flex flex-col gap-8">
                   <div className="w-full">
                     <AuctionSearch />
                   </div>
                   
                   <div>
                     <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">Search Results</h4>
                     <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                       {auctions.map((a: Auction) => (
                         <ShippingAuctionCard 
                           key={a.id}
                           id={a.id}
                           title={a.title} 
                           origin={a.origin_address} 
                           destination={a.dest_address} 
                           distance="Calculating..." 
                           category={a.item_category || 'General'} 
                           image={a.media_urls?.[0] || ''} 
                           lowestBid={`$${a.starting_price || 0}`} 
                           suppliers={0} 
                           auctionStartTime={a.auction_start_time}
                           auctionEndTime={a.auction_end_time}
                           auctionType={a.auction_type}
                           isRegistered={a.is_registered}
                         />
                       ))}
                       {auctions.length === 0 && (
                         <p className="text-zinc-500 col-span-full py-8 text-center">No active auctions match your search.</p>
                       )}
                     </div>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ShippingAuctionCard };
