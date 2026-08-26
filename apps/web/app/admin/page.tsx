'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowDown, ArrowUp, CalendarClock, Gavel, Plus, ShieldAlert, Users } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { Auction } from '../../types/api';
import { ListingReviewQueue } from '../../components/admin/ListingReviewQueue';
import { useAuth } from '../../contexts/AuthContext';

function auctionStatus(auction: Auction) {
  const now = Date.now();
  const start = new Date(auction.auction_start_time).getTime();
  const end = new Date(auction.auction_end_time).getTime();
  if (now < start) return 'Scheduled';
  if (now <= end) return 'Live';
  return 'Closed';
}

export default function AdminPage() {
  const { session, isLoading: sessionLoading } = useAuth();
  const role = session?.role;

  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ['auctions', 'admin'],
    enabled: role === 'ADMIN',
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/auction`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Could not load auction operations');
      const body = await response.json();
      return (body.auctions || []) as Auction[];
    },
  });

  const metrics = useMemo(() => ({
    live: auctions.filter(auction => auctionStatus(auction) === 'Live').length,
    scheduled: auctions.filter(auction => auctionStatus(auction) === 'Scheduled').length,
    forward: auctions.filter(auction => auction.auction_type === 'FORWARD').length,
    reverse: auctions.filter(auction => auction.auction_type === 'REVERSE').length,
    participants: auctions.reduce((total, auction) => total + (auction.participants_count || 0), 0),
  }), [auctions]);

  if (!sessionLoading && role !== 'ADMIN') {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950"><div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900"><ShieldAlert className="mx-auto mb-4 text-amber-500" size={42} /><h1 className="text-2xl font-black">Admin access required</h1><p className="mt-2 text-zinc-500">This operations console is available only to platform administrators.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-zinc-950 px-5 py-3 font-bold text-white dark:bg-white dark:text-zinc-950">Return to dashboard</Link></div></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <main className="ml-0 px-4 pb-16 pt-24 md:ml-64 md:px-10 md:pt-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Operations</p><h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Auction control center</h1><p className="mt-2 text-zinc-500">Monitor marketplace direction, participation, and event readiness.</p></div>
            <Link href="/auction/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white shadow-lg shadow-indigo-600/20"><Plus size={18} /> Create auction</Link>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Live now" value={metrics.live} icon={Activity} tone="emerald" />
            <Metric label="Scheduled" value={metrics.scheduled} icon={CalendarClock} tone="indigo" />
            <Metric label="Forward" value={metrics.forward} icon={ArrowUp} tone="sky" />
            <Metric label="Reverse" value={metrics.reverse} icon={ArrowDown} tone="violet" />
            <Metric label="Participants" value={metrics.participants} icon={Users} tone="amber" />
          </section>

          <ListingReviewQueue />

          <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800"><div><h2 className="font-black">Auction operations</h2><p className="text-sm text-zinc-500">Current and upcoming events</p></div><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black dark:bg-zinc-800">{auctions.length} total</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-950"><tr><th className="px-5 py-3">Auction</th><th className="px-5 py-3">Direction</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Starts</th><th className="px-5 py-3">Participants</th><th className="px-5 py-3">Status</th></tr></thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {auctions.map(auction => { const status = auctionStatus(auction); return <tr key={auction.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"><td className="px-5 py-4"><Link href={`/shipment/${auction.id}`} className="font-black hover:text-indigo-600">{auction.title}</Link><p className="mt-1 font-mono text-xs text-zinc-400">{auction.id.slice(0, 8)}</p></td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${auction.auction_type === 'FORWARD' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'}`}>{auction.auction_type === 'FORWARD' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{auction.auction_type}</span></td><td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{auction.item_category || 'General'}</td><td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{new Date(auction.auction_start_time).toLocaleString()}</td><td className="px-5 py-4 font-black">{auction.participants_count || 0}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${status === 'Live' ? 'bg-emerald-100 text-emerald-700' : status === 'Scheduled' ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-600'}`}>{status}</span></td></tr>; })}
                  {!isLoading && auctions.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-zinc-500">No auctions available.</td></tr>}
                  {isLoading && <tr><td colSpan={6} className="px-5 py-12 text-center text-zinc-500">Loading operations…</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Gavel; tone: 'emerald' | 'indigo' | 'sky' | 'violet' | 'amber' }) {
  const tones = { emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300', sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
  return <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className={`mb-4 inline-flex rounded-xl p-2.5 ${tones[tone]}`}><Icon size={20} /></div><p className="text-3xl font-black">{value}</p><p className="mt-1 text-sm font-bold text-zinc-500">{label}</p></div>;
}
