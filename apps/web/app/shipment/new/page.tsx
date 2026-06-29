'use client';

import { Sidebar } from '../../../components/Sidebar';
import { NewShipmentForm } from '../../../components/shipment/NewShipmentForm';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

export default function NewShipmentPage() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900 selection:bg-indigo-500/30">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden">
        
        {/* Simple Header */}
        <div className="bg-[#faf9f6] dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-8 py-6 z-10 flex-shrink-0">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Post New Shipment</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm font-medium">Create a new reverse auction and invite carriers to bid.</p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-8 relative">
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="w-full">
            <NewShipmentForm />
          </motion.div>
        </div>

      </main>
    </div>
  );
}
