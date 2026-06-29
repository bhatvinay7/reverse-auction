'use client';

import { useState } from 'react';
import { Search, Filter, Calendar, DollarSign, Tag, ArrowDownUp } from 'lucide-react';
import { SHIPMENT_CATEGORIES } from '../../constants/shipment';
import clsx from 'clsx';

export function AuctionSearch() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm transition-colors mb-6">
      <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search by ID, Origin, Destination, or Description..." 
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-11 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className={clsx(
            "flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors border",
            isExpanded 
              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800" 
              : "bg-[#faf9f6] dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          )}
        >
          <Filter size={18} />
          Advanced Filters
        </button>
      </div>

      {isExpanded && (
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-b-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Auction Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <ArrowDownUp size={14} /> Auction Type
              </label>
              <select className="w-full bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="all">All Types</option>
                <option value="reverse">Reverse (Bid Down)</option>
                <option value="forward">Forward (Bid Up)</option>
              </select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Tag size={14} /> Category
              </label>
              <select className="w-full bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="all">All Categories</option>
                {SHIPMENT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={14} /> Pickup Date Range
              </label>
              <div className="flex items-center gap-2">
                <input type="date" className="w-full bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-2.5 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-zinc-400">-</span>
                <input type="date" className="w-full bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-2.5 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <DollarSign size={14} /> Price Range ($)
              </label>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="Min" className="w-full bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-zinc-400">-</span>
                <input type="number" placeholder="Max" className="w-full bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <button className="px-6 py-2.5 rounded-lg font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
              Reset Filters
            </button>
            <button className="px-6 py-2.5 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all">
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
