'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface Props {
  hasConflict: boolean;
}

export function ConcurrencyGuardModal({ hasConflict }: Props) {
  return (
    <AnimatePresence>
      {hasConflict && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white/30 dark:bg-black/50 backdrop-blur-md p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-md bg-[#faf9f6] dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} className="text-red-600 dark:text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mb-2 tracking-tight">Duplicate Session Detected</h2>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-6">
              You have another tab or window open for this auction. Bidding across multiple tabs is restricted to prevent race conditions.
            </p>
            <p className="text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">
              Please close all other active tabs for this auction to continue.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
