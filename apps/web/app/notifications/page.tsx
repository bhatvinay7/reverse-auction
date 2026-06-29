'use client';

import { motion } from 'framer-motion';
import { Sidebar } from '../../components/Sidebar';
import { Bell, CheckCircle2, TrendingDown, Clock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

const MOCK_NOTIFS = [
  { id: 1, type: 'alert', title: 'Outbid on SHP-9021', desc: 'Apex Hauling placed a lower bid of $2,425. You are no longer the leading carrier.', time: '2 mins ago', read: false },
  { id: 2, type: 'success', title: 'Auction Won: SHP-8711', desc: 'Congratulations! You won the contract for Structural Steel Beams at $820.', time: '1 hour ago', read: false },
  { id: 3, type: 'info', title: 'New Load Matches Profile', desc: 'A new FCL freight from Shanghai to LA was just posted with a target of $1,300.', time: '5 hours ago', read: true },
  { id: 4, type: 'system', title: 'Account Verified', desc: 'Your carrier identity has been verified. You can now bid on premium loads.', time: '1 day ago', read: true },
];

export default function NotificationsPage() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-64 pt-20 md:pt-8 p-8 max-w-[1000px] mx-auto animate-in fade-in duration-500">
        
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
              <Bell size={28} className="text-indigo-600 dark:text-indigo-400" /> Notifications
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Stay updated on your bids and marketplace activity.</p>
          </div>
          <button className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            Mark all as read
          </button>
        </div>

        <div className="space-y-4">
          {MOCK_NOTIFS.map((notif, idx) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={notif.id} 
              className={`printed-card rounded-xl p-5 border flex gap-4 transition-all ${
                notif.read ? 'bg-[#faf9f6] dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800' : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900 shadow-sm'
              }`}
            >
              <div className="mt-1">
                {notif.type === 'alert' && <TrendingDown size={24} className="text-red-500" />}
                {notif.type === 'success' && <CheckCircle2 size={24} className="text-emerald-500" />}
                {notif.type === 'info' && <Bell size={24} className="text-indigo-500" />}
                {notif.type === 'system' && <ShieldAlert size={24} className="text-zinc-500" />}
              </div>
              <div className="flex-1">
                 <div className="flex justify-between items-start mb-1">
                   <h4 className={`font-bold ${notif.read ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-900 dark:text-zinc-100'}`}>{notif.title}</h4>
                   <span className="text-xs font-medium text-zinc-500 flex items-center gap-1"><Clock size={12}/> {notif.time}</span>
                 </div>
                 <p className={`text-sm ${notif.read ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-700 dark:text-zinc-300 font-medium'}`}>{notif.desc}</p>
                 
                 {notif.type === 'alert' && (
                   <Link href="/shipment/1" className="inline-block mt-3 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors">
                     Re-enter Auction
                   </Link>
                 )}
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
