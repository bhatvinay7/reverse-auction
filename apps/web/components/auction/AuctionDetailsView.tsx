'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, Image as ImageIcon, FileText } from 'lucide-react';
import { ShipmentMap } from '../shipment/ShipmentMap';
import { MediaGallery } from '../shipment/MediaGallery';

export function AuctionDetailsView({ initialTab = 'details' }: { initialTab?: 'details' | 'photos' | 'map' }) {
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'map'>(initialTab);

  const mockMedia = [
    { url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80', type: 'IMAGE' as const },
    { url: 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=800&q=80', type: 'IMAGE' as const },
    { url: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800&q=80', type: 'IMAGE' as const },
  ];

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
             <ImageIcon size={16} /> Photos
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
                       <span className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">Cargo Type</span>
                       <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">Industrial Machinery</span>
                    </div>
                    <div className="bg-[#faf9f6] dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                       <span className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Weight</span>
                       <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">14,500 lbs</span>
                    </div>
                 </div>
                 <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">Description</h4>
                 <p>
                    Full truckload (FTL) required for the transportation of sensitive industrial equipment. 
                    Must have air-ride suspension to prevent transit damage. Loading dock available at origin. 
                    Destination requires liftgate or forklift (recipient will provide forklift).
                 </p>
                 <ul className="list-disc pl-5 space-y-2 mt-4 text-zinc-500 dark:text-zinc-400">
                    <li>Requires specialized strapping (minimum 8 tie-downs).</li>
                    <li>Tarping is absolutely mandatory if using flatbed.</li>
                    <li>Delivery appointment must be scheduled 24 hours in advance.</li>
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
                 <MediaGallery media={mockMedia} />
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
                 <ShipmentMap originLat={34.05} originLng={-118.24} destLat={51.50} destLng={-0.12} />
               </motion.div>
            )}
         </AnimatePresence>
      </div>
    </div>
  );
}
