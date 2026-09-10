'use client';
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AUCTION_CATEGORIES, ITEM_CONDITIONS } from '../../../constants/auction';

type Media = { file: File; url: string; kind: 'image' | 'video' };

export default function NewSellerListingPage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState<'FORWARD' | 'REVERSE'>('FORWARD');

  const mutation = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const token = localStorage.getItem('token');
      const uploaded: string[] = [];
      for (const item of media) {
        const body = new FormData(); body.append('file', item.file);
        const response = await fetch(`${apiUrl}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Could not upload ${item.file.name}`);
        if (typeof result.secure_url !== 'string' || !result.secure_url) {
          throw new Error(`Upload did not return a media URL for ${item.file.name}`);
        }
        uploaded.push(result.secure_url);
      }
      const values = new FormData(form);
      const optionalNumber = (name: string) => values.get(name) ? Number(values.get(name)) : null;
      const iso = (name: string) => values.get(name) ? new Date(String(values.get(name))).toISOString() : null;
      const response = await fetch(`${apiUrl}/api/listings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          auction_type: direction, title: values.get('title'), description: values.get('description'),
          item_category: values.get('category'), item_condition: values.get('condition'),
          quantity: optionalNumber('quantity'), quantity_unit: values.get('quantity_unit') || null,
          starting_price: Number(values.get('starting_price')), minimum_bid_step: Number(values.get('minimum_bid_step')),
          reserve_price: optionalNumber('reserve_price'), origin_address: values.get('location') || null,
          pickup_terms: values.get('details') || null, availability_start: iso('availability_start'),
          availability_end: iso('availability_end'), media_urls: uploaded,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not submit listing');
    },
    onSuccess: () => router.push('/seller/dashboard?submitted=1'),
    onError: failure => setError(failure instanceof Error ? failure.message : 'Could not submit listing'),
  });

  return <main className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-8"><p className="text-xs font-bold uppercase text-indigo-600">Seller workspace</p><h1 className="mt-2 text-3xl font-black">Submit an auction listing</h1><p className="mt-2 text-zinc-500">Provide the product details and your availability. An administrator will review and schedule the auction.</p></header>
      <form onSubmit={event => { event.preventDefault(); setError(''); mutation.mutate(event.currentTarget); }} className="space-y-6">
        <section className="grid gap-3 sm:grid-cols-2">
          {(['FORWARD', 'REVERSE'] as const).map(type => <button key={type} type="button" onClick={() => setDirection(type)} className={`border p-5 text-left ${direction === type ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}><span className="mb-3 block text-indigo-600">{type === 'FORWARD' ? <ArrowUp /> : <ArrowDown />}</span><strong>{type === 'FORWARD' ? 'Forward auction' : 'Reverse auction'}</strong><span className="mt-1 block text-sm text-zinc-500">{type === 'FORWARD' ? 'Sell to the highest bidder.' : 'Source from the lowest qualified bidder.'}</span></button>)}
        </section>
        <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><h2 className="mb-5 text-lg font-black">Listing details</h2><div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" name="title" required className="sm:col-span-2" />
          <label className="sm:col-span-2 text-sm font-bold">Description<textarea name="description" required minLength={10} rows={5} className="field" /></label>
          <label className="text-sm font-bold">Category<select name="category" className="field">{AUCTION_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm font-bold">Condition<select name="condition" className="field">{ITEM_CONDITIONS.map(value => <option key={value}>{value}</option>)}</select></label>
          <Field label="Quantity" name="quantity" type="number" /> <Field label="Unit" name="quantity_unit" placeholder="item, lot, tonne" />
          <Field label="Starting price" name="starting_price" type="number" required /> <Field label="Minimum bid step" name="minimum_bid_step" type="number" required defaultValue="1" />
          {direction === 'FORWARD' && <Field label="Reserve price" name="reserve_price" type="number" />}
          <Field label="Product location" name="location" className="sm:col-span-2" />
          <label className="sm:col-span-2 text-sm font-bold">Details and fulfilment terms<textarea name="details" rows={4} className="field" /></label>
        </div></section>
        <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><h2 className="mb-1 text-lg font-black">Availability</h2><p className="mb-5 text-sm text-zinc-500">These are preferences; the administrator sets the final auction time.</p><div className="grid gap-5 sm:grid-cols-2"><Field label="Available from" name="availability_start" type="datetime-local" /><Field label="Available until" name="availability_end" type="datetime-local" /></div></section>
        <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><button type="button" onClick={() => input.current?.click()} className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-zinc-300 py-8 font-bold hover:border-indigo-500 dark:border-zinc-700"><ImagePlus /> Add photos or videos</button><input ref={input} hidden multiple type="file" accept="image/*,video/*" onChange={event => setMedia(current => [...current, ...Array.from(event.target.files || []).map(file => ({ file, url: URL.createObjectURL(file), kind: file.type.startsWith('video/') ? 'video' as const : 'image' as const }))])} />{media.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{media.map((item, index) => <div key={item.url} className="relative"><div className="h-28 bg-zinc-100 dark:bg-zinc-800">{item.kind === 'image' ? <img src={item.url} alt="Listing preview" className="h-full w-full object-cover" /> : <video src={item.url} className="h-full w-full object-cover" />}</div><button type="button" aria-label="Remove media" onClick={() => setMedia(value => value.filter((_, i) => i !== index))} className="absolute right-1 top-1 bg-black/70 p-1 text-white"><X size={14} /></button></div>)}</div>}</section>
        {error && <p className="border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        <button disabled={mutation.isPending} className="flex w-full items-center justify-center gap-2 bg-indigo-600 px-6 py-4 font-black text-white hover:bg-indigo-700 disabled:opacity-50">{mutation.isPending ? <Loader2 className="animate-spin" /> : <Send />} Submit for admin review</button>
      </form>
    </div>
  </main>;
}

function Field({ label, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={`${className} text-sm font-bold`}>{label}<input {...props} min={props.type === 'number' ? '0.01' : undefined} step={props.type === 'number' ? 'any' : undefined} className="field" /></label>;
}
