'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Clock, Users, CheckCircle2, MapPin, Package, CalendarDays, Factory, Search, X, Car, Wrench, Laptop, Gem, Building2, Boxes, PackageOpen, LayoutGrid, List, Radio } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuctionSearch } from './auction/AuctionSearch';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

import { Auction } from '../types/api';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toast } from './Toast';
import { Loader2 } from 'lucide-react';

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

function categoryIcon(category: string) {
  const value = category.toLowerCase();
  if (value.includes("vehicle") || value.includes("motor")) return Car;
  if (value.includes("industrial") || value.includes("equipment")) return Wrench;
  if (value.includes("electronic") || value.includes("technology")) return Laptop;
  if (value.includes("collect") || value.includes("art")) return Gem;
  if (value.includes("service") || value.includes("contract")) return Building2;
  if (value.includes("logistic") || value.includes("freight")) return Boxes;
  return PackageOpen;
}

function categoryTone(category: string) {
  const tones = [
    'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
    'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
    'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
    'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
    'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  ];
  return tones[[...category].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length];
}

function DashboardOverview({ auctions, userRole }: { auctions: Auction[], userRole?: string | null }) {
  const [search, setSearch] = useState("");
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
    const needle = search.trim().toLowerCase();
    return auctions.filter((auction) => {
      const category = auction.item_category?.trim() || "General";
      const matchesCategory =
        selectedCategory === "All" || category === selectedCategory;
      const matchesSearch =
        !needle ||
        `${auction.title} ${auction.description} ${category}`
          .toLowerCase()
          .includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory, auctions]);
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
            <Link href="#" className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline">
              View All Open Auctions
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex h-12 w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 shadow-sm focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:ring-indigo-950">
              <Search size={18} className="text-zinc-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search auctions or categories"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
              />
            </label>

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

function ReverseAuctionsView({ auctions }: { auctions: Auction[] }) {
  return (
    <div className="space-y-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Auction Marketplace</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium">Browse items, services, assets, contracts, and logistics events.</p>
        </div>
        
        {/* Marketplace Filters */}
        <div className="w-full mt-6">
          <AuctionSearch />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            suppliers={a.participants_count || 0} 
            auctionStartTime={a.auction_start_time}
            auctionEndTime={a.auction_end_time}
            auctionType={a.auction_type}
            isRegistered={a.is_registered}
          />
        ))}
        {auctions.length === 0 && (
          <p className="text-zinc-500 col-span-2 py-8 text-center">No active auctions right now.</p>
        )}
      </div>
    </div>
  );
}



interface ShippingAuctionCardProps {
  id?: string;
  title: string;
  origin?: string | null;
  destination?: string | null;
  distance: string;
  category: string;
  image: string;
  lowestBid: string;
  suppliers: number;
  auctionStartTime?: string;
  auctionEndTime?: string;
  auctionType?: 'REVERSE' | 'FORWARD';
  isRegistered?: boolean;
  viewMode?: 'grid' | 'strip';
}

function ShippingAuctionCard({ id, title, origin, destination, distance, category, image, lowestBid, suppliers, auctionStartTime, auctionEndTime, auctionType = 'REVERSE', isRegistered, viewMode = 'grid' }: ShippingAuctionCardProps) {
  const [now, setNow] = useState(0);
  const queryClient = useQueryClient();
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const router = useRouter();

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No auction ID');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auction/${id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          throw new Error('Authentication required. Redirecting...');
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to register');
      }
      return res;
    },
    onSuccess: () => {
      setToastMsg('Successfully registered for auction!');
      setToastType('success');
      setShowJoinModal(false);
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (err: Error) => {
      if (err.message === 'You have already joined this auction') {
        setToastMsg('You are already registered!');
        setToastType('info');
        queryClient.invalidateQueries({ queryKey: ['auctions'] });
      } else {
        setToastMsg(err.message);
        setToastType('error');
      }
      setShowJoinModal(false);
    }
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No auction ID');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auction/${id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          throw new Error('Authentication required. Redirecting...');
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to unregister');
      }
      return res;
    },
    onSuccess: () => {
      setToastMsg('Successfully unregistered from auction.');
      setToastType('info');
      setShowLeaveModal(false);
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (err: Error) => {
      setToastMsg(err.message);
      setToastType('error');
      setShowLeaveModal(false);
    }
  });

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const parseUtcDate = (dateStr: string) => {
    if (dateStr.includes(' ') && !dateStr.includes('Z')) {
      return new Date(dateStr.replace(' ', 'T') + 'Z');
    }
    return new Date(dateStr);
  };

  const startTime = auctionStartTime ? parseUtcDate(auctionStartTime) : new Date(now);
  const endTime = auctionEndTime ? parseUtcDate(auctionEndTime) : new Date(now + 86400000);
  const joinTime = endTime;
  const isVideo = /\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(image) || image.includes('/video/upload/');
  
  let actionText = 'Place Bid';
  let isClosed = false;
  let timeLabel = '';
  let timeDiff = 0;

  if (now === 0) {
    actionText = 'Loading…';
    timeLabel = 'Checking schedule';
  } else if (now > endTime.getTime()) {
    actionText = 'Closed';
    isClosed = true;
    timeLabel = 'Ended';
    timeDiff = 0;
  } else if (now >= startTime.getTime() && now <= endTime.getTime()) {
    actionText = isRegistered ? 'Enter Console' : 'Join Live';
    timeLabel = 'Ends in';
    timeDiff = endTime.getTime() - now;
  } else if (now < startTime.getTime()) {
    actionText = isRegistered ? 'Unregister' : 'Register';
    timeLabel = 'Time left to register';
    timeDiff = joinTime.getTime() - now;
  }

  const phase = now > endTime.getTime() ? 'completed' : now >= startTime.getTime() ? 'live' : 'upcoming';
  const phaseStyle = phase === 'live' ? 'bg-rose-600 text-white' : phase === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white';

  const timeDiffSecs = Math.floor(timeDiff / 1000);
  const diffDays = Math.floor(timeDiffSecs / 86400);
  const diffHours = Math.floor((timeDiffSecs % 86400) / 3600);
  const diffMinutes = Math.floor((timeDiffSecs % 3600) / 60);
  const displayTime = timeDiff > 0 ? (diffDays > 0 ? `${diffDays}d ${diffHours}h ${diffMinutes}m` : `${diffHours}h ${diffMinutes}m`) : '';

  const startDiff = startTime.getTime() - now;
  const joinDiff = joinTime.getTime() - now;
  
  const formatDate = (d: Date) => {
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatCountdown = (diff: number) => {
    if (diff <= 0) return '00:00:00';
    const totalSeconds = Math.floor(diff / 1000);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return d > 0 ? `${d}d ${timeStr}` : timeStr;
  };

  const startTimer = startDiff > 0 ? `${formatDate(startTime)} (in ${formatCountdown(startDiff)})` : 'Started';
  const joinTimer = joinDiff > 0 ? `${formatDate(joinTime)} (in ${formatCountdown(joinDiff)})` : 'Closed';

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (actionText === 'Register') {
      setShowJoinModal(true);
    } else if (actionText === 'Unregister') {
      setShowLeaveModal(true);
    } else if (actionText === 'Enter Console') {
      router.push(`/auction/${id}`);
    } else if (actionText === 'Join Live') {
      setShowJoinModal(true);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Explicitly ignore clicks that originated from the action button
    if ((e.target as HTMLElement).closest('.action-button')) {
      return;
    }

    // Always allow navigation. If they haven't joined, they will see the join screen.
    // If they have joined, they will see the countdown.
    router.push(`/auction/${id}`);
  };


  return (
    <>
    <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    <div 
      onClick={handleCardClick}
      className={clsx(
      "cursor-pointer block rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl dark:hover:shadow-indigo-900/30 group bg-gradient-to-br from-white via-blue-50/35 to-cyan-50/50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 backdrop-blur-xl border border-blue-100 dark:border-zinc-800 flex relative before:absolute before:inset-0 before:bg-gradient-to-br before:from-indigo-500/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
      viewMode === 'strip' ? "flex-col md:flex-row" : "flex-col h-full"
    )}>
      <div className={clsx(
        "relative overflow-hidden shrink-0",
        viewMode === 'strip' ? "w-full md:w-72 h-48 md:h-auto border-b md:border-b-0 md:border-r border-zinc-200/50 dark:border-zinc-800/50" : "h-48 w-full border-b border-zinc-200/50 dark:border-zinc-800/50"
      )}>
        {image ? (isVideo ? <video src={image} muted playsInline preload="metadata" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />) : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-100 to-blue-100 text-blue-500 dark:from-zinc-800 dark:to-slate-900"><PackageOpen size={46} /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className={`absolute left-3 top-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-lg ${phaseStyle}`}>
           {phase === 'live' ? <Radio size={14} className="animate-pulse" /> : phase === 'upcoming' ? <Clock size={14} /> : <CheckCircle2 size={14} />}
           {phase}
        </div>
        <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
          {timeLabel}{displayTime ? ` · ${displayTime}` : ''}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
          <div className="bg-indigo-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-lg flex items-center gap-2 uppercase tracking-wider border border-indigo-400/30">
             <Package size={14} /> {category}
          </div>
        </div>
      </div>

      <div className={clsx(
        "p-6 flex-1 flex flex-col justify-between",
        viewMode === 'strip' && "md:py-5 md:px-8"
      )}>
        <div className={clsx(viewMode === 'strip' && "flex flex-col md:flex-row gap-6 md:gap-12 w-full justify-between")}>
          <div className="flex-1">
             <h4 className="font-extrabold text-zinc-900 dark:text-zinc-50 text-xl leading-tight mb-5 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{title}</h4>
             
             {origin || destination ? (
               <div className="flex items-start gap-4 mb-4">
                  <div className="flex flex-col items-center mt-1.5">
                    <div className="w-3 h-3 rounded-full bg-indigo-600 dark:bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)] z-10 ring-4 ring-indigo-50 dark:ring-indigo-900/30"></div>
                    <div className="w-0.5 h-10 bg-gradient-to-b from-indigo-200 to-emerald-200 dark:from-indigo-800 dark:to-emerald-800 -my-1"></div>
                    <MapPin size={18} className="text-emerald-600 dark:text-emerald-500 z-10 drop-shadow-md" />
                  </div>
                  <div className="flex flex-col justify-between h-[64px] text-sm flex-1">
                    <div className="text-zinc-600 dark:text-zinc-300 font-semibold">{origin || 'Location not specified'}</div>
                    <div className="text-zinc-900 dark:text-zinc-100 font-bold border-t border-zinc-100 dark:border-zinc-800/60 pt-2 w-full flex items-center gap-2">
                      {destination || 'Destination not specified'} 
                      {destination && <span className="text-xs font-bold text-indigo-600/70 dark:text-indigo-400/70 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{distance}</span>}
                    </div>
                  </div>
               </div>
             ) : (
               <div className="mb-4 rounded-xl border border-zinc-200/60 bg-zinc-50/50 backdrop-blur-sm px-4 py-3 text-sm font-semibold text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-300 flex items-center gap-3">
                 <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                   <PackageOpen size={16} />
                 </div>
                 General auction item · no route required
               </div>
             )}
          </div>

          <div className={clsx(
            "flex flex-col gap-3 shrink-0",
            viewMode === 'strip' ? "w-full lg:w-[320px]" : "mt-2"
          )}>
               <div className="bg-indigo-50/80 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-3 py-2.5 rounded-lg border border-indigo-100/50 dark:border-indigo-800/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                     <CalendarDays size={16} className="shrink-0" />
                     <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-800/80 dark:text-indigo-300/80">Starts</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums font-bold text-indigo-900 dark:text-indigo-200 text-right leading-tight">{startTimer}</span>
               </div>
               <div className="bg-orange-50/80 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-3 py-2.5 rounded-lg border border-orange-100/50 dark:border-orange-800/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                     <Clock size={16} className="shrink-0" />
                     <span className="text-[11px] font-extrabold uppercase tracking-widest text-orange-800/80 dark:text-orange-300/80">Join By</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums font-bold text-orange-900 dark:text-orange-200 text-right leading-tight">{joinTimer}</span>
               </div>
          </div>
        </div>

        <div className={clsx(
          "mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-end justify-between",
          viewMode === 'strip' && "mt-auto"
        )}>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-extrabold mb-1.5">{auctionType === 'FORWARD' ? 'Current highest' : 'Current lowest'}</p>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-500 tracking-tight">{lowestBid}</p>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-1.5">
               <Users size={14} className="text-zinc-400" /> {suppliers} active bids
            </p>
          </div>
          <div 
            onClick={handleActionClick}
            className={`action-button px-8 py-3.5 rounded-xl text-sm font-black shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] whitespace-nowrap transition-all flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0 ${isClosed ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500 shadow-none' : 'bg-zinc-900 dark:bg-zinc-50 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white dark:text-zinc-900 hover:shadow-[0_6px_20px_rgba(79,70,229,0.4)] cursor-pointer'} ${actionText === 'Unregister' ? 'bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700' : ''}`}
          >
            {(joinMutation.isPending && (actionText === 'Register' || actionText === 'Join Live')) || (leaveMutation.isPending && actionText === 'Unregister') ? <Loader2 size={16} className="animate-spin" /> : null}
            {actionText}
          </div>
        </div>
      </div>
    </div>

    {/* Registration Modal */}
    <AnimatePresence>
      {showJoinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowJoinModal(false); }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Confirm Registration</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                Are you sure you want to register for this auction? By registering, you agree to the terms and conditions.
              </p>
              
              <div className="flex items-center gap-3 justify-end">
                <button 
                  onClick={() => setShowJoinModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {joinMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Confirm Registration
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowLeaveModal(false); }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-zinc-200 dark:border-zinc-800 relative z-[201]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 mx-auto border-4 border-red-50 dark:border-red-900/10">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-xl font-black text-center text-zinc-900 dark:text-zinc-50 mb-2">Unregister from Auction</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
              Are you sure you want to unregister from this auction? You can register again before the deadline.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                disabled={leaveMutation.isPending}
              >
                Cancel
              </button>
              <button 
                onClick={() => leaveMutation.mutate()}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Unregister
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowSuccessModal(false); }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col items-center p-8 text-center"
          >
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Registration Successful</h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-8">
              You are now registered for <strong>{title}</strong>. You will be able to enter the live auction console when the event starts.
            </p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all"
            >
              Done
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
