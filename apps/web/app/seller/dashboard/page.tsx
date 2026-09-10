'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Clock3, FilePlus2, Gavel, MessageSquareWarning, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Auction, AuctionListing, ListingHistoryEvent } from '../../../types/api';
import { useAuth } from '../../../contexts/AuthContext';

export default function SellerDashboard() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuth();
  useEffect(() => { if (!sessionLoading && session?.role !== 'CUSTOMER') router.replace('/dashboard'); }, [router, session?.role, sessionLoading]);
  const { data = [], isLoading } = useQuery({ queryKey: ['seller-listings'], queryFn: async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const response = await fetch(`${apiUrl}/api/listings/mine`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load listings');
    return body.listings as AuctionListing[];
  }});
  const { data: auctions = [] } = useQuery({ queryKey: ['seller-auctions'], queryFn: async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const response = await fetch(`${apiUrl}/api/auction`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load auction status');
    return body.auctions as Auction[];
  }});
  const pending = data.filter(item => ['SUBMITTED','UNDER_REVIEW'].includes(item.status)).length;
  return <main className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:px-8"><div className="mx-auto max-w-6xl">
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase text-indigo-600">Seller workspace</p><h1 className="mt-2 text-3xl font-black">Your auction listings</h1><p className="mt-2 text-zinc-500">Track review feedback, scheduling, and live auction status.</p></div><Link href="/sell/new" className="inline-flex items-center justify-center gap-2 bg-indigo-600 px-5 py-3 font-bold text-white"><FilePlus2 size={18} /> New listing</Link></header>
    <section className="mb-8 grid gap-4 sm:grid-cols-3"><Metric icon={Gavel} label="Total listings" value={data.length} /><Metric icon={Clock3} label="In review" value={pending} /><Metric icon={MessageSquareWarning} label="Changes requested" value={data.filter(item => item.status === 'CHANGES_REQUESTED').length} /></section>
    <section className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"><div className="divide-y divide-zinc-100 dark:divide-zinc-800">{data.map(item => <SellerListingRow key={item.id} item={item} auction={auctions.find(auction => auction.id === item.auction_id)} />)}{!isLoading && data.length === 0 && <p className="p-12 text-center text-zinc-500">No listings yet. Submit your first product for review.</p>}{isLoading && <p className="p-12 text-center text-zinc-500">Loading listings...</p>}</div></section>
  </div></main>;
}

function SellerListingRow({ item, auction }: { item: AuctionListing; auction?: Auction }) {
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey:['listing-history',item.id], enabled:open, queryFn:async () => {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const response = await fetch(`${api}/api/listings/${item.id}/history`, { headers:{ Authorization:`Bearer ${localStorage.getItem('token')}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load history');
    return body.history as ListingHistoryEvent[];
  }});
  const operationalStatus = auction ? Date.now() < new Date(auction.auction_start_time).getTime() ? 'UPCOMING' : Date.now() <= new Date(auction.auction_end_time).getTime() ? 'LIVE' : 'COMPLETED' : item.status;
  return <article className="p-5"><div className="grid items-center gap-4 md:grid-cols-[1fr_120px_160px_1fr_auto]"><div><strong>{item.title}</strong><p className="text-xs text-zinc-500">{item.item_category || 'General'} · submitted {new Date(item.submitted_at).toLocaleDateString()}</p>{auction && <p className="mt-1 text-xs font-bold text-indigo-600">{operationalStatus === 'COMPLETED' ? auction.winner_id ? `Winner ${auction.winner_id.slice(0,8)}` : 'Completed without a winner' : operationalStatus === 'LIVE' ? `Bidding is live · ends ${new Date(auction.auction_end_time).toLocaleString()}` : `Final schedule: ${new Date(auction.auction_start_time).toLocaleString()} – ${new Date(auction.auction_end_time).toLocaleString()}`}</p>}{auction && <p className="mt-1 text-xs text-zinc-500">Registration closes {new Date(new Date(auction.auction_end_time).getTime() - 5 * 60_000).toLocaleString()}</p>}</div><span className="text-sm">{item.auction_type}</span><Status value={operationalStatus} /><p className="text-sm text-zinc-500">{item.admin_feedback || 'No feedback yet'}</p><div className="flex gap-2">{auction && <Link href={operationalStatus === 'COMPLETED' ? `/auction/bidinfo/${auction.id}` : `/shipment/${auction.id}`} className="border border-zinc-200 px-3 py-2 text-xs font-bold text-indigo-600 dark:border-zinc-700">View</Link>}{['DRAFT','CHANGES_REQUESTED'].includes(item.status) && <Link href={`/sell/${item.id}/edit`} aria-label={`Edit ${item.title}`} className="border border-zinc-200 p-2 text-indigo-600 dark:border-zinc-700"><Pencil size={17} /></Link>}<button onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={`Show status history for ${item.title}`} className="border border-zinc-200 p-2 dark:border-zinc-700"><ChevronDown size={17} className={open ? 'rotate-180' : ''} /></button></div></div>{open && <ol className="mt-5 border-l-2 border-zinc-200 pl-5 dark:border-zinc-700">{data.map(event => <li key={event.id} className="relative pb-4 text-sm before:absolute before:-left-[25px] before:top-1 before:h-2 before:w-2 before:bg-indigo-600"><strong>{event.to_status.replaceAll('_',' ')}</strong><span className="ml-2 text-zinc-500">{new Date(event.created_at).toLocaleString()}</span>{event.note && <p className="text-zinc-500">{event.note}</p>}</li>)}</ol>}</article>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gavel; label: string; value: number }) { return <div className="border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><Icon className="mb-4 text-indigo-600" /><p className="text-3xl font-black">{value}</p><p className="text-sm text-zinc-500">{label}</p></div>; }
function Status({ value }: { value: string }) { const tone = value === 'LIVE' ? 'bg-rose-100 text-rose-700' : value === 'SCHEDULED' || value === 'UPCOMING' || value === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : value === 'CHANGES_REQUESTED' || value === 'REJECTED' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'; return <span className={`${tone} px-2 py-1 text-xs font-bold`}>{value.replaceAll('_',' ')}</span>; }
