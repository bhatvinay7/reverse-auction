'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Save, Send } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import type { AuctionListing } from '../../../../types/api';
import { AUCTION_CATEGORIES, ITEM_CONDITIONS } from '../../../../constants/auction';

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<AuctionListing | null>(null);
  const [error, setError] = useState('');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });
  const query = useQuery({ queryKey: ['seller-listings'], queryFn: async () => {
    const response = await fetch(`${apiUrl}/api/listings/mine`, { headers: headers() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load listing');
    return body.listings as AuctionListing[];
  }});
  useEffect(() => { const found = query.data?.find(item => item.id === id); if (found) setListing(found); }, [id, query.data]);
  const save = useMutation({ mutationFn: async ({ resubmit }: { resubmit: boolean }) => {
    if (!listing) return;
    const response = await fetch(`${apiUrl}/api/listings/${id}`, { method:'PUT', headers:headers(), body:JSON.stringify({ ...listing, media_urls:listing.media_urls.filter(Boolean), availability_start:listing.availability_start ? new Date(listing.availability_start).toISOString() : null, availability_end:listing.availability_end ? new Date(listing.availability_end).toISOString() : null }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not update listing');
    if (resubmit) {
      const submit = await fetch(`${apiUrl}/api/listings/${id}/resubmit`, { method:'POST', headers:headers() });
      const submitBody = await submit.json();
      if (!submit.ok) throw new Error(submitBody.error || 'Could not resubmit listing');
    }
  }, onSuccess: () => router.push('/seller/dashboard'), onError: failure => setError(failure instanceof Error ? failure.message : 'Could not update listing') });
  if (query.isLoading || !listing) return <main className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-indigo-600" /></main>;
  if (!['DRAFT','CHANGES_REQUESTED'].includes(listing.status)) return <main className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-2xl font-black">This listing cannot be edited</h1><p className="mt-2 text-zinc-500">Only drafts and change-requested listings are editable.</p></div></main>;
  const set = <K extends keyof AuctionListing>(key: K, value: AuctionListing[K]) => setListing(current => current ? { ...current, [key]:value } : current);
  return <main className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950"><form className="mx-auto max-w-4xl space-y-6" onSubmit={event => { event.preventDefault(); save.mutate({ resubmit:true }); }}><header><p className="text-xs font-bold uppercase text-indigo-600">Seller workspace</p><h1 className="mt-2 text-3xl font-black">Revise listing</h1><p className="mt-2 text-zinc-500">Address the review feedback, save your changes, and send it back to the queue.</p>{listing.admin_feedback && <p className="mt-4 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Admin feedback: {listing.admin_feedback}</p>}</header>
    <section className="grid gap-5 border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2"><label className="text-sm font-bold sm:col-span-2">Title<input className="field" required value={listing.title} onChange={e => set('title',e.target.value)} /></label><label className="text-sm font-bold sm:col-span-2">Description<textarea className="field" required minLength={10} rows={5} value={listing.description} onChange={e => set('description',e.target.value)} /></label><label className="text-sm font-bold">Auction type<select className="field" value={listing.auction_type} onChange={e => set('auction_type',e.target.value as AuctionListing['auction_type'])}><option value="FORWARD">Forward</option><option value="REVERSE">Reverse</option></select></label><label className="text-sm font-bold">Category<select className="field" value={listing.item_category || ''} onChange={e => set('item_category',e.target.value)}>{AUCTION_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-bold">Condition<select className="field" value={listing.item_condition || ''} onChange={e => set('item_condition',e.target.value)}>{ITEM_CONDITIONS.map(value => <option key={value}>{value}</option>)}</select></label><EditNumber label="Quantity" value={listing.quantity} onChange={value => set('quantity',value)} /><label className="text-sm font-bold">Unit<input className="field" value={listing.quantity_unit || ''} onChange={e => set('quantity_unit',e.target.value)} /></label><EditNumber label="Starting price" value={listing.starting_price} required onChange={value => set('starting_price',value || 0)} /><EditNumber label="Minimum bid step" value={listing.minimum_bid_step} required onChange={value => set('minimum_bid_step',value || 0)} /><EditNumber label="Reserve price" value={listing.reserve_price} onChange={value => set('reserve_price',value)} /><label className="text-sm font-bold sm:col-span-2">Location<input className="field" value={listing.origin_address || ''} onChange={e => set('origin_address',e.target.value)} /></label><label className="text-sm font-bold sm:col-span-2">Terms<textarea className="field" rows={4} value={listing.pickup_terms || ''} onChange={e => set('pickup_terms',e.target.value)} /></label></section>
    {error && <p className="bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>}<div className="grid gap-3 sm:grid-cols-2"><button type="button" disabled={save.isPending} onClick={() => save.mutate({ resubmit:false })} className="flex items-center justify-center gap-2 border border-zinc-300 bg-white px-5 py-3 font-bold dark:border-zinc-700 dark:bg-zinc-900"><Save size={18} /> Save changes</button><button disabled={save.isPending} className="flex items-center justify-center gap-2 bg-indigo-600 px-5 py-3 font-bold text-white">{save.isPending ? <Loader2 className="animate-spin" /> : <Send size={18} />} Save and resubmit</button></div></form></main>;
}
function EditNumber({ label, value, onChange, required=false }: { label:string; value?:number|null; onChange:(value:number|null)=>void; required?:boolean }) { return <label className="text-sm font-bold">{label}<input className="field" type="number" min="0.01" step="any" required={required} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)} /></label>; }
