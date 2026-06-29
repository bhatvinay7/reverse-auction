'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '../../components/Sidebar';
import { Settings as SettingsIcon, User, BellRing, Shield, CreditCard, Save } from 'lucide-react';
import { useTheme } from 'next-themes';
import clsx from 'clsx';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [role, setRole] = useState<'seller' | 'bidder'>('seller');

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-64 pt-20 md:pt-8 p-8 max-w-[1000px] mx-auto animate-in fade-in duration-500">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
              <SettingsIcon size={28} className="text-indigo-600 dark:text-indigo-400" /> Platform Settings
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Manage your {role === 'seller' ? 'Shipper' : 'Carrier'} preferences and security.</p>
          </div>
          
          <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 flex shadow-sm">
            <button
              onClick={() => setRole('seller')}
              className={clsx(
                "px-4 py-1.5 rounded-md text-sm font-semibold transition-colors",
                role === 'seller' ? "bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              )}
            >
              View as Seller
            </button>
            <button
              onClick={() => setRole('bidder')}
              className={clsx(
                "px-4 py-1.5 rounded-md text-sm font-semibold transition-colors",
                role === 'bidder' ? "bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              )}
            >
              View as Bidder
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Sidebar Nav */}
          <div className="md:col-span-3 space-y-2">
            <button className="w-full text-left px-4 py-2.5 rounded-lg font-bold text-sm bg-indigo-50 dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-zinc-800 flex items-center gap-2">
              <BellRing size={16} /> Notification Preferences
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-lg font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 flex items-center gap-2">
              <Shield size={16} /> Security & Privacy
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-lg font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 flex items-center gap-2">
              <CreditCard size={16} /> Billing & Escrow
            </button>
          </div>

          {/* Settings Content */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="md:col-span-9 space-y-6">
             <div className="printed-card rounded-xl p-8 bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
               <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                 Notification Preferences
               </h3>
               
               <form className="space-y-6">
                 
                 {role === 'seller' ? (
                   <div className="space-y-4">
                     <label className="flex items-center gap-3">
                       <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600" />
                       <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email me when a new bid is placed on my auction</span>
                     </label>
                     <label className="flex items-center gap-3">
                       <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600" />
                       <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Alert me when a carrier asks a question in the Q&A thread</span>
                     </label>
                     <label className="flex items-center gap-3">
                       <input type="checkbox" className="w-4 h-4 text-indigo-600" />
                       <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Daily summary of active auctions</span>
                     </label>
                   </div>
                 ) : (
                   <div className="space-y-4">
                     <label className="flex items-center gap-3">
                       <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600" />
                       <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">SMS Alert when I am outbid (Reverse Auction)</span>
                     </label>
                     <label className="flex items-center gap-3">
                       <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600" />
                       <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Alert me 15 minutes before an auction I bid on ends</span>
                     </label>
                     <label className="flex items-center gap-3">
                       <input type="checkbox" className="w-4 h-4 text-indigo-600" />
                       <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notify me of new auctions matching my Service Areas</span>
                     </label>
                   </div>
                 )}

                 <div className="space-y-1.5 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                   <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Interface Theme</label>
                   <select 
                     value={theme}
                     onChange={(e) => setTheme(e.target.value)}
                     className="w-full px-4 py-2.5 rounded-lg border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-medium focus:border-indigo-500"
                   >
                     <option value="light">Light Mode</option>
                     <option value="dark">Dark Mode</option>
                     <option value="system">System Preference</option>
                   </select>
                 </div>

                 <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                    <button type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                      <Save size={16} /> Save Preferences
                    </button>
                 </div>
               </form>
             </div>
          </motion.div>
        </div>

      </main>
    </div>
  );
}
