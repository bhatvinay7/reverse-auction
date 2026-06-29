import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { setTimeSkew } from '../store/slices/auctionSlice';

export function useServerTimeSync() {
  const dispatch = useDispatch();
  const timeSkew = useSelector((state: RootState) => state.auction.timeSkew);
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    let mounted = true;

    const syncTime = async () => {
      setIsSyncing(true);
      // Simulate network request to get server time
      const start = Date.now();

      // In a real app, this would be an actual API call returning { serverTime: number }
      const mockNetworkDelay = 50;
      await new Promise(res => setTimeout(res, mockNetworkDelay));

      const serverTime = Date.now() + 1500; // Mock server is 1.5 seconds ahead
      const end = Date.now();

      const rtt = end - start;
      const estimatedServerTime = serverTime + rtt / 2;
      const skew = estimatedServerTime - end;

      if (mounted) {
        dispatch(setTimeSkew(skew));
        setIsSyncing(false);
      }
    };

    syncTime();

    return () => {
      mounted = false;
    };
  }, [dispatch]);

  return { timeSkew, isSyncing };
}
