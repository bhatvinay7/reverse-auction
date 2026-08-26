'use client';
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, Loader2, MessageSquareText, X } from 'lucide-react';
import type { AuctionListing } from '../../types/api';

export function ListingReviewQueue() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<Record<string, { start: string; end: string }>>({});
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-listings'], queryFn: async () => {
    const response = await fetch(`${apiUrl}/api/listings/admin`, { headers: headers() }); const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load listing queue'); return body.listings as AuctionListing[];
  }});
  const review = useMutation({ mutationFn: async ({ id, decision }: { id: string; decision: string }) => {
    const response = await fetch(`${apiUrl}/api/listings/${id}/review`, { method: 'POST', headers: headers(), body: JSON.stringify({ decision, feedback: feedback[id] || null }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not save review');
  }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-listings'] }) });
  const scheduleAuction = useMutation({ mutationFn: async (id: string) => {
    const dates = schedule[id]; if (!dates?.start || !dates?.end) throw new Error('Choose the auction start and end times');
    const response = await fetch(`${apiUrl}/api/listings/${id}/schedule`, { method: 'POST', headers: headers(), body: JSON.stringify({ auction_start_time: new Date(dates.start).toISOString(), auction_end_time: new Date(dates.end).toISOString() }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not schedule auction');
  }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-listings'] }); queryClient.invalidateQueries({ queryKey: ['auctions'] }); } });

  return <section className="mt-8 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
    <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800"><h2 className="font-black">Seller review queue</h2><p className="text-sm text-zinc-500">Review full listing details, provide feedback, and schedule approved auctions.</p></div>
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {data.map(item => <article key={item.id} className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{item.title}</h3><span className="bg-zinc-100 px-2 py-1 text-xs font-bold dark:bg-zinc-800">{item.status.replaceAll('_',' ')}</span><span className="bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700">{item.auction_type}</span></div><p className="mt-1 text-sm font-bold">{item.seller_name} {item.seller_company ? `· ${item.seller_company}` : ''}</p><p className="text-xs text-zinc-500">{item.seller_email}</p><p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.description}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><Detail name="Category" value={item.item_category || 'General'} /><Detail name="Condition" value={item.item_condition || 'Not specified'} /><Detail name="Starting price" value={`$${item.starting_price.toLocaleString()}`} /><Detail name="Bid step" value={`$${item.minimum_bid_step.toLocaleString()}`} /></dl>{item.media_urls.some(Boolean) && <div className="mt-4 flex gap-2 overflow-x-auto">{item.media_urls.filter(Boolean).map(url => isVideo(url!) ? <video key={url!} src={url!} controls className="h-24 w-40 bg-black object-contain" /> : <img key={url!} src={url!} alt="Seller listing" className="h-24 w-32 object-cover" />)}</div>}</div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 border border-zinc-200 p-3 text-sm dark:border-zinc-700"><Detail name="Quantity" value={item.quantity ? `${item.quantity} ${item.quantity_unit || ''}` : 'Not specified'} /><Detail name="Location" value={item.origin_address || 'Not specified'} /><Detail name="Reserve" value={item.reserve_price ? `$${item.reserve_price.toLocaleString()}` : 'None'} /><Detail name="Availability" value={item.availability_start ? `${new Date(item.availability_start).toLocaleDateString()}${item.availability_end ? ` – ${new Date(item.availability_end).toLocaleDateString()}` : ''}` : 'Flexible'} /></div>
          {item.pickup_terms && <p className="border-l-2 border-zinc-300 pl-3 text-sm text-zinc-500"><strong>Terms:</strong> {item.pickup_terms}</p>}
          {['SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED'].includes(item.status) && <><textarea value={feedback[item.id] || ''} onChange={e => setFeedback(value => ({ ...value, [item.id]: e.target.value }))} placeholder="Feedback for the seller" rows={3} className="field" /><div className="grid grid-cols-3 gap-2"><Action icon={Check} label="Approve" onClick={() => review.mutate({ id:item.id, decision:'APPROVE' })} /><Action icon={MessageSquareText} label="Changes" onClick={() => review.mutate({ id:item.id, decision:'REQUEST_CHANGES' })} /><Action icon={X} label="Reject" onClick={() => review.mutate({ id:item.id, decision:'REJECT' })} danger /></div></>}
          {item.status === 'APPROVED' && <div className="space-y-3 border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"><p className="text-sm font-black text-emerald-800 dark:text-emerald-300">Approved and ready to schedule</p><label className="block text-xs font-bold">Starts<input type="datetime-local" className="field" onChange={e => setSchedule(value => ({ ...value, [item.id]: { start:e.target.value, end:value[item.id]?.end || '' } }))} /></label><label className="block text-xs font-bold">Ends<input type="datetime-local" className="field" onChange={e => setSchedule(value => ({ ...value, [item.id]: { start:value[item.id]?.start || '', end:e.target.value } }))} /></label><button onClick={() => scheduleAuction.mutate(item.id)} className="flex w-full items-center justify-center gap-2 bg-emerald-700 px-3 py-2 text-sm font-bold text-white"><CalendarClock size={16} /> Schedule auction</button></div>}
          {item.admin_feedback && <p className="text-xs text-zinc-500"><strong>Latest feedback:</strong> {item.admin_feedback}</p>}
        </div>
      </article>)}
      {isLoading && <p className="p-10 text-center text-zinc-500"><Loader2 className="mx-auto mb-2 animate-spin" /> Loading review queue...</p>}
      {!isLoading && data.length === 0 && <p className="p-10 text-center text-zinc-500">No seller submissions yet.</p>}
    </div>
    {(review.error || scheduleAuction.error) && <p className="border-t border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{(review.error || scheduleAuction.error)?.message}</p>}
  </section>;
}
function Detail({ name, value }: { name: string; value: string }) { return <div><dt className="text-xs text-zinc-500">{name}</dt><dd className="mt-1 font-bold">{value}</dd></div>; }
function isVideo(url: string) { return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url); }
function Action({ icon: Icon, label, onClick, danger = false }: { icon: typeof Check; label: string; onClick: () => void; danger?: boolean }) { return <button onClick={onClick} className={`flex flex-col items-center gap-1 px-2 py-2 text-xs font-bold ${danger ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'}`}><Icon size={15} />{label}</button>; }
