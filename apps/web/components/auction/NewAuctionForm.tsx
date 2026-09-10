'use client';

/* eslint-disable @next/next/no-img-element -- local object URLs are previewed before upload */

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarClock, ImagePlus, Loader2, Package, Settings2, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUCTION_CATEGORIES, ITEM_CONDITIONS } from '../../constants/auction';
import { AuctionFormData, MediaPreview } from '../../schemas/auction';
import { Toast } from '../Toast';

const INITIAL_FORM: AuctionFormData = {
  title: '',
  description: '',
  auctionType: 'REVERSE',
  category: AUCTION_CATEGORIES[0],
  itemCondition: ITEM_CONDITIONS[0],
  quantity: 1,
  quantityUnit: 'item',
  startingPrice: '',
  minimumBidStep: 1,
  reservePrice: '',
  auctionStartTime: '',
  auctionEndTime: '',
  detailedInformation: '',
  location: '',
  destination: '',
  length: '',
  width: '',
  height: '',
  weight: '',
};

function optionalNumber(value: string | number) {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function NewAuctionForm() {
  const [form, setForm] = useState<AuctionFormData>(INITIAL_FORM);
  const [media, setMedia] = useState<MediaPreview[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => () => media.forEach(item => URL.revokeObjectURL(item.url)), [media]);

  const mutation = useMutation({
    mutationFn: async (data: AuctionFormData) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const token = localStorage.getItem('token');
      const mediaUrls: string[] = [];

      for (const item of media) {
        const upload = new FormData();
        upload.append('file', item.file);
        const response = await fetch(`${apiUrl}/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: upload,
        });
        if (!response.ok) throw new Error(`Could not upload ${item.file.name}`);
        const body = await response.json() as { secure_url: string };
        mediaUrls.push(body.secure_url);
      }

      const payload = {
        title: data.title.trim(),
        description: data.description.trim(),
        auction_type: data.auctionType,
        item_category: data.category,
        item_condition: data.itemCondition,
        quantity: optionalNumber(data.quantity),
        quantity_unit: data.quantityUnit.trim() || null,
        starting_price: optionalNumber(data.startingPrice),
        minimum_bid_step: optionalNumber(data.minimumBidStep),
        reserve_price: data.auctionType === 'FORWARD' ? optionalNumber(data.reservePrice) : null,
        auction_start_time: new Date(data.auctionStartTime).toISOString(),
        auction_end_time: new Date(data.auctionEndTime).toISOString(),
        pickup_terms: data.detailedInformation.trim() || null,
        origin_address: data.location.trim() || null,
        dest_address: data.destination.trim() || null,
        origin_lat: null,
        origin_lng: null,
        dest_lat: null,
        dest_lng: null,
        pickup_date_start: null,
        pickup_date_end: null,
        freight_type: null,
        weight: optionalNumber(data.weight),
        length: optionalNumber(data.length),
        width: optionalNumber(data.width),
        height: optionalNumber(data.height),
        media_urls: mediaUrls.length ? mediaUrls : null,
      };

      const response = await fetch(`${apiUrl}/api/auction/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; auction_id?: string };
      if (!response.ok) throw new Error(body.error || 'Could not create auction');
      return body;
    },
    onSuccess: body => {
      setMessage(`Auction ${body.auction_id?.slice(0, 8) || ''} created successfully.`);
      setError('');
      setForm(INITIAL_FORM);
      setMedia([]);
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: failure => {
      setError(failure instanceof Error ? failure.message : 'Could not create auction');
      setMessage('');
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const start = new Date(form.auctionStartTime).getTime();
    const end = new Date(form.auctionEndTime).getTime();
    const startingPrice = Number(form.startingPrice);
    const step = Number(form.minimumBidStep);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return setError('Choose valid start and end times.');
    if (end <= start) return setError('Auction end time must be after its start time.');
    if (end - start < 5 * 60_000) return setError('Live bidding must run for at least 5 minutes.');
    if (!Number.isFinite(startingPrice) || startingPrice <= 0) return setError('Starting price must be greater than zero.');
    if (!Number.isFinite(step) || step <= 0) return setError('Minimum bid step must be greater than zero.');
    if (form.auctionType === 'FORWARD' && form.reservePrice !== '' && Number(form.reservePrice) < startingPrice) {
      return setError('A forward-auction reserve cannot be below the starting price.');
    }
    setError('');
    mutation.mutate(form);
  };

  const field = (name: keyof AuctionFormData, value: string) => setForm(current => ({ ...current, [name]: value }));

  return (
    <form onSubmit={submit} className="space-y-6">
      <Toast message={message} type="success" onClose={() => setMessage('')} />
      <Toast message={error} type="error" onClose={() => setError('')} />

      <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2">
        <button type="button" onClick={() => field('auctionType', 'REVERSE')} className={`rounded-xl border p-5 text-left transition ${form.auctionType === 'REVERSE' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/15 dark:bg-indigo-950/30' : 'border-zinc-200 dark:border-zinc-800'}`}>
          <ArrowDown className="mb-4 text-indigo-600" />
          <span className="block font-black text-zinc-950 dark:text-white">Reverse auction</span>
          <span className="mt-1 block text-sm text-zinc-500">Bids move down. Use it to buy any item, service, capacity, or contract.</span>
        </button>
        <button type="button" onClick={() => field('auctionType', 'FORWARD')} className={`rounded-xl border p-5 text-left transition ${form.auctionType === 'FORWARD' ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/15 dark:bg-sky-950/30' : 'border-zinc-200 dark:border-zinc-800'}`}>
          <ArrowUp className="mb-4 text-sky-600" />
          <span className="block font-black text-zinc-950 dark:text-white">Forward auction</span>
          <span className="mt-1 block text-sm text-zinc-500">Bids move up. Use it to sell any item, service, right, or asset.</span>
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-7">
        <h2 className="mb-5 flex items-center gap-2 font-black"><Package size={19} className="text-indigo-600" /> Auction subject</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="md:col-span-2 text-sm font-bold">Title<input required minLength={3} value={form.title} onChange={e => field('title', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950" /></label>
          <label className="md:col-span-2 text-sm font-bold">Description<textarea required minLength={5} rows={4} value={form.description} onChange={e => field('description', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950" /></label>
          <label className="text-sm font-bold">Category<select value={form.category} onChange={e => field('category', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">{AUCTION_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
          <label className="text-sm font-bold">Condition<select value={form.itemCondition} onChange={e => field('itemCondition', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">{ITEM_CONDITIONS.map(condition => <option key={condition}>{condition}</option>)}</select></label>
          <label className="text-sm font-bold">Quantity<input type="number" min="0.01" step="any" value={form.quantity} onChange={e => field('quantity', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" /></label>
          <label className="text-sm font-bold">Quantity unit<input value={form.quantityUnit} onChange={e => field('quantityUnit', e.target.value)} placeholder="item, lot, hour, tonne…" className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-7">
        <h2 className="mb-5 flex items-center gap-2 font-black"><Settings2 size={19} className="text-indigo-600" /> Price rules</h2>
        <div className="grid gap-5 md:grid-cols-3">
          <label className="text-sm font-bold">Starting price<input required type="number" min="0.01" step="any" value={form.startingPrice} onChange={e => field('startingPrice', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" /></label>
          <label className="text-sm font-bold">Minimum bid step<input required type="number" min="0.01" step="any" value={form.minimumBidStep} onChange={e => field('minimumBidStep', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" /></label>
          <label className="text-sm font-bold">Reserve price {form.auctionType === 'REVERSE' && <span className="font-medium text-zinc-400">(forward only)</span>}<input type="number" min="0" step="any" disabled={form.auctionType === 'REVERSE'} value={form.reservePrice} onChange={e => field('reservePrice', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-7">
        <h2 className="mb-5 flex items-center gap-2 font-black"><CalendarClock size={19} className="text-indigo-600" /> Schedule and fulfilment</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-bold">Starts<input required type="datetime-local" value={form.auctionStartTime} onChange={e => field('auctionStartTime', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" /></label>
          <label className="text-sm font-bold">Ends<input required type="datetime-local" value={form.auctionEndTime} onChange={e => field('auctionEndTime', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" /></label>
          <label className="text-sm font-bold">Location / origin <span className="font-medium text-zinc-400">(optional)</span><input value={form.location} onChange={e => field('location', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" /></label>
          <label className="text-sm font-bold">Destination <span className="font-medium text-zinc-400">(optional)</span><input value={form.destination} onChange={e => field('destination', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" /></label>
          <label className="md:col-span-2 text-sm font-bold">Terms and detailed information<textarea rows={3} value={form.detailedInformation} onChange={e => field('detailedInformation', e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-7">
        <button type="button" onClick={() => fileInput.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-5 py-8 font-bold text-zinc-600 hover:border-indigo-500 hover:text-indigo-600 dark:border-zinc-700"><ImagePlus /> Add unique item images or video</button>
        <input ref={fileInput} hidden multiple type="file" accept="image/*,video/*" onChange={event => {
          const files = Array.from(event.target.files || []);
          setMedia(current => [...current, ...files.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'video' as const : 'image' as const }))]);
        }} />
        {media.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{media.map(item => <div key={item.id} className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">{item.type === 'video' ? <video src={item.url} className="h-28 w-full object-cover" /> : <img src={item.url} alt="Auction media preview" className="h-28 w-full object-cover" />}<button type="button" onClick={() => setMedia(current => current.filter(entry => entry.id !== item.id))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X size={14} /></button></div>)}</div>}
      </section>

      <button disabled={mutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-4 font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50">{mutation.isPending ? <Loader2 className="animate-spin" /> : form.auctionType === 'FORWARD' ? <ArrowUp /> : <ArrowDown />} Create {form.auctionType.toLowerCase()} auction</button>
    </form>
  );
}
