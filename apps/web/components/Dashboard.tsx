'use client';

import { useEffect, useState } from 'react';
import { Factory } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Auction } from '../types/api';
import { DashboardOverview } from './dashboard/DashboardOverview';
import { ReverseAuctionsView } from './dashboard/ReverseAuctionsView';

function useAuctions() {
  const { data } = useQuery({
    queryKey: ['search-auctions', 'dashboard'],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      // Legacy catalog fetch intentionally disabled: `${apiUrl}/api/auction`.
      // Search-server is the single catalog/search source, reached via
      // gateway-keeper at the public API origin.
      const res = await fetch(`${apiUrl}/api/search`);
      if (!res.ok) throw new Error('Failed to fetch search catalog');
      const json = await res.json();
      return (json.results || []) as Auction[];
    },
  });
  
  return data || [];
}

export function Dashboard() {
  const activeTab = useSelector((state: RootState) => state.ui.activeTab);
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
    </div>
  );
}
