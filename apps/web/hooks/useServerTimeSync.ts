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

    const syncTime = () => {
      setIsSyncing(true);
      if (mounted) {
        dispatch(setTimeSkew(0));
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
