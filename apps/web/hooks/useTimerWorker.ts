import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

export function useTimerWorker() {
  const { endTime, timeSkew, auctionStatus } = useSelector((state: RootState) => state.auction);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !endTime || auctionStatus !== 'active') return;

    // Create a blob worker to calculate time left
    const workerCode = `
      let timerId = null;
      self.onmessage = function(e) {
        if (e.data.type === 'START') {
          if (timerId) clearInterval(timerId);
          const { endTime, timeSkew } = e.data.payload;
          
          timerId = setInterval(() => {
            const currentAccurateTime = Date.now() + timeSkew;
            const remaining = Math.max(0, endTime - currentAccurateTime);
            self.postMessage({ remaining });
            
            if (remaining <= 0) {
              clearInterval(timerId);
            }
          }, 100); // High frequency tick
        } else if (e.data.type === 'STOP') {
          if (timerId) clearInterval(timerId);
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    workerRef.current = new Worker(workerUrl);
    
    workerRef.current.onmessage = (e) => {
      setTimeLeft(e.data.remaining);
    };

    workerRef.current.postMessage({
      type: 'START',
      payload: { endTime, timeSkew }
    });

    return () => {
      workerRef.current?.postMessage({ type: 'STOP' });
      workerRef.current?.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, [endTime, timeSkew, auctionStatus]);

  return timeLeft;
}
