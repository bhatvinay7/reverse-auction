'use client';

import { motion } from 'framer-motion';
import { Sidebar } from '../../components/Sidebar';
import { Bell, CheckCircle2, TrendingDown, Clock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { Notification } from '../../types/api';

export default function NotificationsPage() {
  const notifs: Notification[] = []; // Fetch from backend when ready

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
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
          {notifs.length === 0 ? (
            <div className="text-center p-12 printed-card rounded-xl border border-zinc-200 dark:border-zinc-800 bg-[#faf9f6] dark:bg-zinc-900">
              <Bell size={32} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
              <p className="text-zinc-500 font-medium">You have no new notifications.</p>
            </div>
          ) : (
            notifs.map((notif, idx) => (
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
            ))
          )}
        </div>
      </main>
    </div>
  );
}
