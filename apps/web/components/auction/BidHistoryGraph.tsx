'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { TrendingDown, Users } from 'lucide-react';

interface BidData {
  time: string;
  amount: number;
  bidder: string;
}

interface BidHistoryGraphProps {
  data: BidData[];
}

export function BidHistoryGraph({ data }: BidHistoryGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pathData, setPathData] = useState<string>('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 250 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (!entries[0]) return;
      setDimensions({
        width: entries[0].contentRect.width,
        height: 250
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 30, left: 60 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const xScale = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([0, width]);

    const yMin = d3.min(data, d => d.amount) || 0;
    const yMax = d3.max(data, d => d.amount) || 0;
    
    // Add 10% padding to y-axis
    const yScale = d3.scaleLinear()
      .domain([yMin * 0.9, yMax * 1.1])
      .range([height, 0]);

    const lineGenerator = d3.line<BidData>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d.amount))
      .curve(d3.curveMonotoneX);

    const path = lineGenerator(data);
    if (path) setPathData(path);
  }, [data, dimensions.height, dimensions.width]);

  // Calculate stats
  const startBid = data[0]?.amount || 0;
  const finalBid = data[data.length - 1]?.amount || 0;
  const savings = startBid - finalBid;
  const savingsPercent = startBid > 0 ? ((savings / startBid) * 100).toFixed(1) : '0';

  return (
    <div className="w-full">
      
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        <div className="flex-1">
          <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-1">
            <TrendingDown size={18} className="text-indigo-500" /> Bid Timeline Analysis
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Visualization of competitive bidding driving down the contract price.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-[#faf9f6] dark:bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">Total Savings</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              ${savings.toLocaleString()} ({savingsPercent}%)
            </span>
          </div>
          <div className="bg-[#faf9f6] dark:bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">Total Bids</span>
            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Users size={12} className="text-indigo-500" /> {data.length}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div ref={containerRef} className="w-full relative h-[250px]">
        {dimensions.width > 0 && (
          <svg width={dimensions.width} height={dimensions.height}>
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g transform={`translate(60, 20)`}>
              {/* Grid Lines */}
              {d3.ticks(
                d3.min(data, d => d.amount) || 0,
                d3.max(data, d => d.amount) || 0,
                5
              ).map((tick, i) => (
                <g key={i} transform={`translate(0, ${d3.scaleLinear().domain([d3.min(data, d => d.amount)! * 0.9, d3.max(data, d => d.amount)! * 1.1]).range([dimensions.height - 50, 0])(tick)})`}>
                  <line x1="0" x2={dimensions.width - 80} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeDasharray="4,4" />
                  <text x="-10" y="4" textAnchor="end" className="fill-zinc-400 dark:fill-zinc-500 text-[10px] font-mono">
                    ${tick.toLocaleString()}
                  </text>
                </g>
              ))}

              {pathData && (
                <>
                  <motion.path
                    d={pathData}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth={3}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                  
                  {/* Data Points */}
                  {data.map((d, i) => {
                    const xScale = d3.scaleLinear().domain([0, data.length - 1]).range([0, dimensions.width - 80]);
                    const yScale = d3.scaleLinear().domain([d3.min(data, d => d.amount)! * 0.9, d3.max(data, d => d.amount)! * 1.1]).range([dimensions.height - 50, 0]);
                    
                    return (
                      <motion.circle
                        key={i}
                        cx={xScale(i)}
                        cy={yScale(d.amount)}
                        r={4}
                        className="fill-white dark:fill-zinc-900 stroke-indigo-500"
                        strokeWidth={2}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 1 + (i * 0.1), duration: 0.3 }}
                      />
                    );
                  })}
                </>
              )}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
