import { motion, AnimatePresence } from 'framer-motion';
import { Info, CheckCircle2, XCircle, X } from 'lucide-react';
import { useEffect } from 'react';

export function Toast({
  message,
  type = 'info',
  onClose,
  duration = 5000
}: {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 shadow-2xl rounded-xl p-4 pr-12 min-w-[300px] border"
          style={{
            backgroundColor: type === 'error' ? '#7f1d1d' : type === 'success' ? '#064e3b' : '#1e3a8a',
            color: '#fff',
            borderColor: type === 'error' ? '#991b1b' : type === 'success' ? '#065f46' : '#1e40af'
          }}
        >
          {type === 'error' && <XCircle size={24} className="text-red-400 flex-shrink-0" />}
          {type === 'success' && <CheckCircle2 size={24} className="text-emerald-400 flex-shrink-0" />}
          {type === 'info' && <Info size={24} className="text-blue-400 flex-shrink-0" />}
          
          <p className="font-medium text-sm">{message}</p>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
