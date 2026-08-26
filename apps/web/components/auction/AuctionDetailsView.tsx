'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, Image as ImageIcon, FileText } from 'lucide-react';
import { ShipmentMap } from '../shipment/ShipmentMap';
import { MediaGallery } from '../shipment/MediaGallery';
import { Media, Auction } from '../../types/api';

export function AuctionDetailsView({ initialTab = 'details', auction }: { initialTab?: 'details' | 'photos' | 'map', auction?: Auction }) {
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'map'>(initialTab);

  const media: Media[] = (auction?.media_urls || []).map(url => ({
    url,
    type: (/\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(url) || url.includes('/video/upload/')) ? 'VIDEO' : 'IMAGE',
  }));

  return (
    <div className="bg-[#faf9f6]/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
         <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Auction Details</h3>
         <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1">
           <button 
             onClick={() => setActiveTab('details')}
             className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'details' ? 'bg-[#faf9f6] dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
           >
             <FileText size={16} /> Details
           </button>
           <button 
             onClick={() => setActiveTab('photos')}
             className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'photos' ? 'bg-[#faf9f6] dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
           >
             <ImageIcon size={16} /> Media ({media.length})
           </button>
           <button 
             onClick={() => setActiveTab('map')}
             className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'map' ? 'bg-[#faf9f6] dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
           >
             <Map size={16} /> Map
           </button>
         </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 relative">
         <AnimatePresence mode="wait">
            {activeTab === 'details' && (
               <motion.div 
                 key="details"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 transition={{ duration: 0.2 }}
                 className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 font-medium h-full"
               >
                 <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-[#faf9f6] dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                       <span className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">Category</span>
                       <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{auction?.item_category || 'General'}</span>
                    </div>
                    <div className="bg-[#faf9f6] dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                       <span className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">Direction</span>
                       <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{auction?.auction_type === 'FORWARD' ? 'Forward · bids increase' : 'Reverse · bids decrease'}</span>
                    </div>
                 </div>
                 <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">Description</h4>
                 <p>
                    {auction?.description || 'No description provided.'}
                 </p>
                 <ul className="list-disc pl-5 space-y-2 mt-4 text-zinc-500 dark:text-zinc-400">
                    <li>Condition: {auction?.item_condition || 'Not specified'}</li>
                    <li>Quantity: {auction?.quantity ? `${auction.quantity} ${auction.quantity_unit || ''}` : 'Not specified'}</li>
                    <li>Starting price: {auction?.starting_price != null ? `$${auction.starting_price.toLocaleString()}` : 'Not specified'}</li>
                    <li>Origin: {auction?.origin_address || 'N/A'}</li>
                    <li>Destination: {auction?.dest_address || 'N/A'}</li>
                    <li>Pickup Date: {auction?.pickup_date ? new Date(auction.pickup_date).toLocaleDateString() : 'N/A'}</li>
                 </ul>
               </motion.div>
            )}

            {activeTab === 'photos' && (
               <motion.div 
                 key="photos"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 transition={{ duration: 0.2 }}
                 className="h-full w-full"
               >
                 {media.length ? <MediaGallery media={media} /> : <div className="grid min-h-48 place-items-center text-sm font-semibold text-zinc-400">No images or videos were added.</div>}
               </motion.div>
            )}

            {activeTab === 'map' && (
               <motion.div 
                 key="map"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 transition={{ duration: 0.2 }}
                 className="h-full w-full -mt-4 -ml-4" // slight offset to counteract container padding since map has its own
                 style={{ width: 'calc(100% + 2rem)', height: 'calc(100% + 2rem)' }}
               >
                 <ShipmentMap 
                   originLat={auction?.origin_lat || 34.05} 
                   originLng={auction?.origin_lng || -118.24} 
                   destLat={auction?.dest_lat || 51.50} 
                   destLng={auction?.dest_lng || -0.12} 
                   originAddress={auction?.origin_address || undefined}
                   destAddress={auction?.dest_address || undefined}
                 />
               </motion.div>
            )}
         </AnimatePresence>
      </div>
    </div>
  );
}
