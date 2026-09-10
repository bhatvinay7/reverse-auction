'use client';

import { AuctionSearch } from '../auction/AuctionSearch';
import { Auction } from '../../types/api';
import { ShippingAuctionCard } from './ShippingAuctionCard';

export function ReverseAuctionsView({ auctions }: { auctions: Auction[] }) {
  return (
    <div className="space-y-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Auction Marketplace</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium">Browse items, services, assets, contracts, and logistics events.</p>
        </div>
        <div className="mt-6 w-full">
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
