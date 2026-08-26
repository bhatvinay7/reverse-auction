import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { updateAuctionStatus } from '../store/slices/auctionSlice';

export function useTimerWorker() {
  const dispatch = useDispatch();
  const { startTime, endTime, timeSkew, auctionStatus } = useSelector((state: RootState) => state.auction);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !endTime || auctionStatus === 'ended') return;

    // Create a blob worker to calculate time left
    const workerCode = `
      let timerId = null;
      self.onmessage = function(e) {
        if (e.data.type === 'START') {
          if (timerId) clearInterval(timerId);
          const { startTime, endTime, timeSkew, status } = e.data.payload;
          
          timerId = setInterval(() => {
            const currentAccurateTime = Date.now() + timeSkew;
            let remaining = 0;
            let needsUpdate = false;
            
            if (status === 'waiting' && startTime) {
               remaining = Math.max(0, startTime - currentAccurateTime);
               if (remaining <= 0) needsUpdate = true;
            } else if (status === 'active' && endTime) {
               remaining = Math.max(0, endTime - currentAccurateTime);
               if (remaining <= 0) needsUpdate = true;
            }

            self.postMessage({ remaining, needsUpdate });
            
            if (needsUpdate) {
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
      if (e.data.needsUpdate) {
        dispatch(updateAuctionStatus());
      }
    };

    workerRef.current.postMessage({
      type: 'START',
      payload: { startTime, endTime, timeSkew, status: auctionStatus }
    });

    return () => {
      workerRef.current?.postMessage({ type: 'STOP' });
      workerRef.current?.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, [startTime, endTime, timeSkew, auctionStatus, dispatch]);

  return timeLeft;
}
