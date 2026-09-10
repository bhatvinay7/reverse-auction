'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShippingAuctionCard } from './dashboard/ShippingAuctionCard';
import { Auction } from '../types/api';

export function SearchResults({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [results, setResults] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = searchParams.q as string;

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        // `/api/search` is served by gateway-keeper, which proxies it to
        // search-server. Never query http-server for search results.
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const res = await fetch(`${apiUrl}/api/search?q=${encodeURIComponent(q || '')}`);
        if (!res.ok) throw new Error('Failed to fetch search results');
        const data = await res.json();
        setResults(data.results || []);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [q]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse bg-zinc-200 dark:bg-zinc-800 h-80 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-20">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No results found</h3>
        <p className="text-zinc-500 mt-2">Try adjusting your search terms</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {results.map((auction) => (
        <Link key={auction.id} href={`/auction/${auction.id}`}>
          <ShippingAuctionCard 
            id={auction.id}
            title={auction.title} 
            origin={auction.origin_address} 
            destination={auction.dest_address} 
            distance="Calculating..." 
            category={auction.item_category || 'General'} 
            image={auction.media_urls?.[0] || ''} 
            lowestBid={`$${auction.starting_price || 0}`} 
            suppliers={auction.participants_count || 0} 
            auctionStartTime={auction.auction_start_time}
            auctionEndTime={auction.auction_end_time}
            auctionType={auction.auction_type as 'REVERSE' | 'FORWARD'}
            isRegistered={auction.is_registered}
          />
        </Link>
      ))}
    </div>
  );
}
