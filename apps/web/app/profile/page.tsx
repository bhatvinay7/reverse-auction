'use client';

import { Sidebar } from '../../components/Sidebar';
import { UserProfile } from '../../components/profile/UserProfile';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

export default function ProfilePage() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 selection:bg-indigo-500/30">
      <Sidebar />
      
      <main className="min-h-[calc(100dvh-4rem)] flex-1 md:ml-64">
        
        {/* Simple Header */}
        <div className="bg-[#faf9f6] dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-8 py-6 z-10 flex-shrink-0">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Account Settings</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm font-medium">Manage your personal and business profile details.</p>
        </div>

        {/* Scrollable Content */}
        <div className="relative p-4 sm:p-8">
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="w-full">
            <UserProfile />
          </motion.div>
        </div>

      </main>
    </div>
  );
}
