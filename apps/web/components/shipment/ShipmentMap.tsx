'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { MapPin, Plane } from 'lucide-react';

interface ShipmentMapProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

export function ShipmentMap({ originLat, originLng, destLat, destLng }: ShipmentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pathData, setPathData] = useState<string>('');
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = 300;
    
    // Create a generic map projection centered between the points
    const projection = d3.geoMercator()
      .center([(originLng + destLng) / 2, (originLat + destLat) / 2])
      .scale(width * 1.5)
      .translate([width / 2, height / 2]);

    const originPixel = projection([originLng, originLat]);
    const destPixel = projection([destLng, destLat]);

    if (originPixel && destPixel) {
       // Draw an arched curve between point A and B
       const dx = destPixel[0] - originPixel[0];
       const dy = destPixel[1] - originPixel[1];
       const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // arc radius
       
       setPathData(`M${originPixel[0]},${originPixel[1]} A${dr},${dr} 0 0,1 ${destPixel[0]},${destPixel[1]}`);
    }
  }, [originLat, originLng, destLat, destLng]);

  return (
    <div className="printed-card rounded-xl overflow-hidden p-6 relative bg-zinc-50 dark:bg-zinc-900/20">
      <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Live Route</h3>
      
      <div ref={containerRef} className="w-full h-[300px] relative rounded-lg border border-zinc-200 dark:border-zinc-800/50 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2948&auto=format&fit=crop')] bg-cover bg-center bg-blend-luminosity opacity-90 dark:opacity-70 flex items-center justify-center">
        
        {/* SVG Route overlay */}
        <svg width="100%" height="100%" className="absolute inset-0 z-10 drop-shadow-xl">
           {pathData && (
              <>
                 <path d={pathData} fill="none" stroke="currentColor" className="text-indigo-600/30 dark:text-indigo-400/30" strokeWidth="4" strokeDasharray="8 8" />
                 <motion.path
                    d={pathData}
                    fill="none"
                    stroke="currentColor"
                    className="text-indigo-600 dark:text-indigo-400"
                    strokeWidth="4"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
                 />
              </>
           )}
        </svg>

        {/* Abstract Map overlay to make it look like a logistics tracker */}
        <div className="absolute inset-0 bg-[#faf9f6]/60 dark:bg-zinc-900/80 backdrop-blur-[2px]"></div>

        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#faf9f6]/90 dark:bg-zinc-900/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800/50 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
           <MapPin size={14} className="text-emerald-500" /> Origin: 34.05°N, 118.24°W
        </div>
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-[#faf9f6]/90 dark:bg-zinc-900/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800/50 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
           <MapPin size={14} className="text-indigo-500" /> Dest: 51.50°N, 0.12°W
        </div>
      </div>
    </div>
  );
}
