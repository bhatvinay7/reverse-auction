'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';

interface TrendChartProps {
  data: number[];
  color: string;
}

export function TrendChart({ data, color }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pathData, setPathData] = useState<string>('');
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const width = 100;
    const height = 40;
    
    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([0, width]);
      
    const yScale = d3.scaleLinear()
      .domain([Math.min(...data) * 0.9, Math.max(...data) * 1.1])
      .range([height, 0]);
      
    // Create line generator
    const lineGenerator = d3.line<number>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveMonotoneX); // Smooth curve
      
    const path = lineGenerator(data);
    if (path) {
      setPathData(path);
    }
  }, [data]);

  return (
    <div ref={containerRef} className="w-[100px] h-[40px] opacity-80">
      <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
        {pathData && (
          <motion.path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth={2}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" as const }}
          />
        )}
      </svg>
    </div>
  );
}
