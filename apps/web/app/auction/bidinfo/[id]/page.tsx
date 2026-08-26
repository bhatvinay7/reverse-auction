'use client';

import React, { use, useEffect, useState } from 'react';
import { Sidebar } from '../../../../components/Sidebar';
import { ArrowLeft, Map as MapIcon, Download, Info, CheckCircle, Package, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Auction } from '../../../../types/api';
import { BidHistoryGraph } from '../../../../components/auction/BidHistoryGraph';
import { ShipmentMap } from '../../../../components/shipment/ShipmentMap';

function useAuction(id: string) {
  const { data } = useQuery({
    queryKey: ['auctions', 'history'],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auction/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch auctions');
      const json = await res.json();
      return (json.auctions || []) as Auction[];
    },
  });
  
  return data?.find(a => a.id === id);
}

interface BidAuditEvent {
  request_id: string;
  bidder_id: string;
  username?: string | null;
  amount: number;
  accepted: boolean;
  rejection_reason?: string | null;
  previous_price: number;
  resulting_price: number;
  submitted_at: string;
  processed_at: string;
  source_partition: number;
  source_offset: number;
}

function useAuctionAudit(auctionId: string | null) {
  const { data } = useQuery({
    queryKey: ['auction-bid-audit', auctionId],
    queryFn: async () => {
      if (!auctionId) return [];
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/auction/${auctionId}/audit?limit=500&offset=0`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch bid audit');
      const json = await res.json();
      return (json.events || []) as BidAuditEvent[];
    },
    enabled: !!auctionId
  });
  return data || [];
}

export default function BidInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const auction = useAuction(resolvedParams.id);
  const auditEvents = useAuctionAudit(resolvedParams.id);
  const acceptedEvents = auditEvents.filter((event) => event.accepted);
  const graphData = acceptedEvents.map((event) => ({
    time: event.submitted_at,
    amount: event.amount,
    bidder: event.bidder_id,
  }));
  const winningAmount = acceptedEvents[acceptedEvents.length - 1]?.amount;
  
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMyUserId(localStorage.getItem('userId'));
      setGeneratedAt(new Date().toLocaleString());
    }
  }, []);

  if (!auction) {
    return (
      <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
         <p className="text-zinc-500">Loading auction details...</p>
      </div>
    );
  }

  const isWinner = auction.is_closed && auction.winner_id === myUserId;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="print:hidden">
        <Sidebar />
      </div>
      
      <main className="flex-1 ml-0 md:ml-64 p-8 max-w-[1200px] mx-auto print:ml-0 print:p-0 print:max-w-none w-full animate-in fade-in duration-500">
        
        {/* Header - Hidden in Print */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
          <div>
            <Link href="/history" className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-2 mb-4 hover:underline">
              <ArrowLeft size={16} /> Back to History
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Auction Audit Report
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
              Ref ID: <span className="font-mono">{auction.id}</span>
            </p>
          </div>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm"
          >
            <Download size={18} /> Download PDF Report
          </button>
        </div>

        {/* Print Only Header */}
        <div className="hidden print:block mb-8 border-b-2 border-zinc-900 pb-4">
          <h1 className="text-3xl font-black uppercase tracking-wider">Auction Audit Report</h1>
          <p className="text-zinc-600 font-mono mt-2">ID: {auction.id}</p>
          <p className="text-zinc-600 mt-1">Generated: {generatedAt}</p>
        </div>

        {/* Winner Banner */}
        {isWinner && (
          <div className="mb-8 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-4 text-emerald-800 dark:text-emerald-300 print:border-black print:text-black">
            <CheckCircle className="text-emerald-500" size={24} />
            <div>
              <h3 className="font-bold text-lg">Congratulations, you won this auction!</h3>
              <p className="text-sm opacity-90">You are the confirmed winner for this auction.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Shipment Details */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm print:border-black print:shadow-none">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4 print:border-black">
              <Package className="text-indigo-500" /> Auction Item Details
            </h2>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Title</span>
                <span className="font-medium">{auction.title}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Origin</span>
                  <span className="font-medium">{auction.origin_address || 'Not specified'}</span>
                </div>
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Destination</span>
                  <span className="font-medium">{auction.dest_address || 'Not specified'}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Pickup Date</span>
                  <span className="font-medium">{auction.pickup_date?.split('T')[0] || 'Not specified'}</span>
                </div>
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Total Weight</span>
                  <span className="font-medium">{auction.weight || 'N/A'} lbs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Auction Summary */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm print:border-black print:shadow-none">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4 print:border-black">
              <Info className="text-indigo-500" /> Auction Summary
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Status</span>
                  <span className="font-medium">{auction.is_closed ? 'Completed' : 'Active'}</span>
                </div>
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Total Bids</span>
                  <span className="font-medium">{auditEvents.length} attempts · {acceptedEvents.length} accepted</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Winning Bid</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-xl">
                    {winningAmount !== undefined ? `$${winningAmount}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Winner ID</span>
                  <span className="font-mono text-sm">{auction.winner_id || 'Pending'}</span>
                </div>
              </div>
              <div>
                <span className="block text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Seller ID</span>
                <span className="font-mono text-sm text-zinc-500">System Verified Corporate</span>
              </div>
            </div>
          </div>
        </div>

        {/* Durable processed-decision audit */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm mb-8 print:border-black print:shadow-none">
          <h2 className="text-xl font-bold mb-2">Processed Bid Audit</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
            Accepted and rejected decisions archived from Kafka to the append-only PostgreSQL audit ledger.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="py-3 pr-4">Processed</th>
                  <th className="py-3 pr-4">Bidder</th>
                  <th className="py-3 pr-4 text-right">Amount</th>
                  <th className="py-3 pr-4 text-right">Price after</th>
                  <th className="py-3 pr-4">Decision</th>
                  <th className="py-3">Kafka position</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((event) => (
                  <tr key={event.request_id} className="border-b border-zinc-100 dark:border-zinc-800/70 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap">{new Date(event.processed_at).toLocaleString()}</td>
                    <td className="py-3 pr-4">
                      <span className="block font-medium">{event.username || 'Bidder'}</span>
                      <span className="font-mono text-xs text-zinc-500">{event.bidder_id}</span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">${event.amount.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right font-mono">${event.resulting_price.toLocaleString()}</td>
                    <td className="py-3 pr-4">
                      {event.accepted ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"><CheckCircle size={15} /> Accepted</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold"><XCircle size={15} /> {event.rejection_reason || 'Rejected'}</span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-xs text-zinc-500">p{event.source_partition} · o{event.source_offset}</td>
                  </tr>
                ))}
                {auditEvents.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-zinc-500">No processed bid decisions were recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bid Graph - Visible to all */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm mb-8 print:border-black print:shadow-none">
          <h2 className="text-xl font-bold mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4 print:border-black">Bid Timeline</h2>
          <div className="h-[300px]">
            {graphData.length > 0 ? (
              <BidHistoryGraph data={graphData} />
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500">
                No bids recorded.
              </div>
            )}
          </div>
        </div>

        {/* Map - Visible ONLY if user is winner */}
        {isWinner && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm print:hidden">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <MapIcon className="text-indigo-500" /> Live Route Trace
            </h2>
            <div className="h-[400px] -mx-2">
              <ShipmentMap 
                originLat={auction.origin_lat || 34.05} 
                originLng={auction.origin_lng || -118.24} 
                destLat={auction.dest_lat || 51.50} 
                destLng={auction.dest_lng || -0.12} 
                originAddress={auction.origin_address || undefined}
                destAddress={auction.dest_address || undefined}
              />
            </div>
          </div>
        )}

      </main>
      
      {/* Global Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          * { text-shadow: none !important; box-shadow: none !important; }
          @page { margin: 1cm; size: auto; }
        }
      `}} />
    </div>
  );
}
