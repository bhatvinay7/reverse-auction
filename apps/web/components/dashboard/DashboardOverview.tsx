'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Factory, LayoutGrid, List, PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { Auction } from '../../types/api';
import { ShippingAuctionCard } from './ShippingAuctionCard';
import { categoryIcon, categoryTone } from './utils';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

export function DashboardOverview({ auctions, userRole }: { auctions: Auction[], userRole?: string | null }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState<'grid' | 'strip'>('grid');

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    auctions.forEach((auction) => {
      const category = auction.item_category?.trim() || "General";
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [auctions]);

  const filteredAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      const category = auction.item_category?.trim() || "General";
      return selectedCategory === "All" || category === selectedCategory;
    });
  }, [selectedCategory, auctions]);
  return (
    <>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Executive Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end mt-4 md:mt-0">
          <Link href="/notifications" className="relative p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-[#faf9f6] dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm">
            <div className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white dark:border-zinc-900"></div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </Link>
          {userRole === 'ADMIN' && (
            <Link href="/auction/new" className="w-full sm:w-auto flex-1 sm:flex-none justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2">
               <Factory size={16} /> Create Auction
            </Link>
          )}
        </div>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 gap-8">
        <motion.div variants={fadeUp} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Live Auction Marketplace</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Bid up in forward auctions or bid down in reverse auctions.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between w-full">
              <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] flex-1 w-full sm:w-auto">
                {["All", ...categories.map(([category]) => category)].map(
                  (category) => {
                    const Icon = category === "All" ? PackageOpen : categoryIcon(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={`shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-extrabold transition flex items-center gap-3 ${selectedCategory === category ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20 dark:border-indigo-500 dark:bg-indigo-500" : `${categoryTone(category)} dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white`}`}
                      >
                        <span className={`grid h-9 w-9 place-items-center rounded-xl ${selectedCategory === category ? 'bg-white/15' : 'bg-white/75 shadow-sm dark:bg-zinc-800'}`}><Icon size={22} strokeWidth={2.2} /></span>
                        {category}
                      </button>
                    );
                  }
                )}
              </div>
              
              <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 shrink-0">
                <button 
                  onClick={() => setViewMode('grid')} 
                  className={clsx("p-2 rounded-md transition-colors", viewMode === 'grid' ? "bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                  title="Grid View"
                >
                  <LayoutGrid size={16} />
                </button>
                <button 
                  onClick={() => setViewMode('strip')} 
                  className={clsx("p-2 rounded-md transition-colors", viewMode === 'strip' ? "bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                  title="List View"
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className={clsx("grid gap-6", viewMode === 'grid' ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
            {filteredAuctions.slice(0, 8).map((a: Auction) => (
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
                suppliers={a.participants_count || 0} 
                auctionStartTime={a.auction_start_time}
                auctionEndTime={a.auction_end_time}
                auctionType={a.auction_type}
                isRegistered={a.is_registered}
                viewMode={viewMode}
              />
            ))}
            {filteredAuctions.length === 0 && (
              <p className="text-zinc-500 col-span-2 py-8 text-center">No active auctions right now.</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
