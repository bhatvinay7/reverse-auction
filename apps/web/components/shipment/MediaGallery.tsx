'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayCircle } from 'lucide-react';

interface MediaGalleryProps {
  media: { url: string; type: 'IMAGE' | 'VIDEO' }[];
}

export function MediaGallery({ media }: MediaGalleryProps) {
  const [activeMedia, setActiveMedia] = useState(media[0]);

  if (!activeMedia) return null;

  return (
    <div className="space-y-4">
      {/* Main Image View */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 group">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMedia.url}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {activeMedia.type === 'IMAGE' ? (
              <img src={activeMedia.url} alt="Shipment item" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/5 relative">
                <img src={activeMedia.url} alt="Video thumbnail" className="w-full h-full object-cover opacity-80" />
                <PlayCircle size={64} className="text-white drop-shadow-lg absolute" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {media.map((item, idx) => (
          <button
            key={idx}
            onClick={() => setActiveMedia(item)}
            className={`relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-colors ${
              activeMedia.url === item.url 
                ? 'border-indigo-600 dark:border-indigo-400' 
                : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <img src={item.url} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
            {item.type === 'VIDEO' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <PlayCircle size={24} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
