'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendChart } from './TrendChart';
import { Clock, Users, CheckCircle2, TrendingDown, MapPin, Package, CalendarDays, Truck, Factory, Search, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import Link from 'next/link';
import { AuctionSearch } from './auction/AuctionSearch';

const REVERSE_IMAGES = [
  "https://images.unsplash.com/photo-1494412651409-8963ce7935a7?q=80&w=2940&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1587293852726-70cdb56c28ea?q=80&w=2940&auto=format&fit=crop"
];

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

export function Dashboard() {
  const activeTab = useSelector((state: RootState) => state.ui.activeTab);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500 relative">
      {activeTab === 'dashboard' && <DashboardOverview onSearchClick={() => setSearchModalOpen(true)} />}
      {activeTab === 'reverse' && <ReverseAuctionsView />}

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
                     <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">Top Search Results</h4>
                     <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                       <ShippingAuctionCard title="1x 40' High Cube Shipping Container" origin="Shanghai Port, CN" destination="Los Angeles Port, US" distance="6,482 NM" pickupDate="Oct 12 - Oct 15" category="FCL Freight" image={REVERSE_IMAGES[0]} lowestBid="$1,250" suppliers={8} timeLeft="4h 12m" trendData={[1500, 1450, 1400, 1320, 1280, 1250]} />
                       <ShippingAuctionCard title="Structural Steel Beams (500 MT)" origin="Pittsburgh, PA" destination="Austin, TX" distance="1,245 mi" pickupDate="Oct 14" category="Flatbed LTL" image={REVERSE_IMAGES[1]} lowestBid="$820" suppliers={12} timeLeft="1d 6h" trendData={[950, 920, 890, 850, 835, 820]} />
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

function DashboardOverview({ onSearchClick }: { onSearchClick?: () => void }) {
  return (
    <>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Executive Dashboard
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium">
            Overview of active freight procurement events and market dynamics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end mt-4 md:mt-0">
          <button 
            onClick={onSearchClick}
            className="w-full sm:w-auto flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-[#faf9f6] dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm text-sm font-semibold"
          >
            <Search size={16} /> Advanced Search
          </button>
          <Link href="/notifications" className="relative p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-[#faf9f6] dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm">
            <div className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white dark:border-zinc-900"></div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </Link>
          <Link href="/shipment/new" className="w-full sm:w-auto flex-1 sm:flex-none justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2">
             <Factory size={16} /> Post New Shipment
          </Link>
          <Link href="/forward-auction/new" className="w-full sm:w-auto flex-1 sm:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2">
             <Package size={16} /> Sell Product
          </Link>
        </div>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 gap-8">
        <motion.div variants={fadeUp}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="Active Shipments" value="124" trend="+12%" icon={CheckCircle2} />
            <StatCard label="Total Spend Saved" value="$4.2M" trend="+8%" icon={TrendingDown} />
            <StatCard label="Live Bidders" value="892" trend="+24%" icon={Users} />
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Logistics & Freight Marketplace</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Reverse Auction Hub - Lowest bid secures the contract</p>
            </div>
            <Link href="#" className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline">
              View All Open Loads
            </Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ShippingAuctionCard title="1x 40' High Cube Shipping Container" origin="Shanghai Port, CN" destination="Los Angeles Port, US" distance="6,482 NM" pickupDate="Oct 12 - Oct 15" category="FCL Freight" image={REVERSE_IMAGES[0]} lowestBid="$1,250" suppliers={8} timeLeft="4h 12m" trendData={[1500, 1450, 1400, 1320, 1280, 1250]} />
            <ShippingAuctionCard title="Structural Steel Beams (500 MT)" origin="Pittsburgh, PA" destination="Austin, TX" distance="1,245 mi" pickupDate="Oct 14" category="Flatbed LTL" image={REVERSE_IMAGES[1]} lowestBid="$820" suppliers={12} timeLeft="1d 6h" trendData={[950, 920, 890, 850, 835, 820]} />
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

function ReverseAuctionsView() {
  return (
    <div className="space-y-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Load Marketplace</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium">Browse active freight listings. Place your lowest bid to win.</p>
        </div>
        
        {/* Marketplace Filters */}
        <div className="w-full mt-6">
          <AuctionSearch />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShippingAuctionCard title="1x 40' High Cube Shipping Container" origin="Shanghai Port, CN" destination="Los Angeles Port, US" distance="6,482 NM" pickupDate="Oct 12 - Oct 15" category="FCL Freight" image={REVERSE_IMAGES[0]} lowestBid="$1,250" suppliers={8} timeLeft="4h 12m" trendData={[1500, 1450, 1400, 1320, 1280, 1250]} />
        <ShippingAuctionCard title="Structural Steel Beams (500 MT)" origin="Pittsburgh, PA" destination="Austin, TX" distance="1,245 mi" pickupDate="Oct 14" category="Flatbed LTL" image={REVERSE_IMAGES[1]} lowestBid="$820" suppliers={12} timeLeft="1d 6h" trendData={[950, 920, 890, 850, 835, 820]} />
        <ShippingAuctionCard title="Temperature Controlled Pharmaceuticals" origin="Berlin, DE" destination="London, UK" distance="580 mi" pickupDate="Nov 02" category="Reefer FTL" image="https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=2944&auto=format&fit=crop" lowestBid="$3,400" suppliers={4} timeLeft="2h 30m" trendData={[4000, 3800, 3600, 3500, 3450, 3400]} />
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, icon: Icon }: any) {
  return (
    <div className="printed-card rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-zinc-900/50 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon size={64} />
      </div>
      <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <div className="flex items-end gap-3">
        <h3 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{value}</h3>
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">{trend}</span>
      </div>
    </div>
  );
}

function ShippingAuctionCard({ title, origin, destination, distance, pickupDate, category, image, lowestBid, suppliers, timeLeft, trendData }: any) {
  return (
    <Link href="/shipment/1" className="block printed-card rounded-xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-zinc-900/50 group bg-[#faf9f6] dark:bg-zinc-900 h-full">
      <div className="flex flex-col">
        {/* Top Header Section */}
        <div className="h-40 relative overflow-hidden">
          <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute inset-0 bg-black/20 dark:bg-black/50 transition-colors" />
          <div className="absolute top-3 left-3 bg-[#faf9f6]/95 dark:bg-zinc-900/95 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 shadow-sm">
             <Clock size={12} className="text-orange-600 dark:text-orange-500" />
             {timeLeft} left
          </div>
          <div className="absolute bottom-3 left-3 bg-indigo-600 dark:bg-indigo-500 text-white px-2.5 py-1 rounded-md text-xs font-bold shadow-sm flex items-center gap-1.5 uppercase tracking-wider">
             <Package size={12} /> {category}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
             <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg leading-tight mb-5 line-clamp-2">{title}</h4>
             
             {/* Route Display */}
             <div className="flex items-start gap-4 mb-4">
                <div className="flex flex-col items-center mt-1">
                  <div className="w-3 h-3 rounded-full border-[3px] border-indigo-600 dark:border-indigo-400 bg-[#faf9f6] dark:bg-zinc-900 z-10"></div>
                  <div className="w-0.5 h-10 bg-zinc-200 dark:bg-zinc-700 -my-1"></div>
                  <MapPin size={16} className="text-emerald-600 dark:text-emerald-500 z-10" />
                </div>
                <div className="flex flex-col justify-between h-[60px] text-sm flex-1">
                  <div className="text-zinc-700 dark:text-zinc-300 font-medium">{origin}</div>
                  <div className="text-zinc-900 dark:text-zinc-100 font-bold border-t border-zinc-100 dark:border-zinc-800 pt-2 w-full">
                    {destination} <span className="text-zinc-400 font-normal ml-1">({distance})</span>
                  </div>
                </div>
             </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-end">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-bold mb-1">Current Lowest</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500">{lowestBid}</p>
              <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
                 <Users size={12} /> {suppliers} active bids
              </p>
            </div>
            <div className="bg-zinc-900 dark:bg-zinc-100 group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 text-white dark:text-zinc-900 px-6 py-3 rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap">
              Place Bid
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
