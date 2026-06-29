import { useEffect, useState } from 'react';

export function useConcurrencyGuard(auctionId: string) {
  const [hasConflict, setHasConflict] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !auctionId) return;

    const channelName = `auction-guard-${auctionId}`;
    const channel = new BroadcastChannel(channelName);
    const instanceId = Math.random().toString(36).substring(7);

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'PING' && event.data.instanceId !== instanceId) {
        // Someone else is here. We tell them we are here too.
        channel.postMessage({ type: 'PONG', instanceId });
        setHasConflict(true);
      } else if (event.data.type === 'PONG' && event.data.instanceId !== instanceId) {
        // We pinged and someone responded.
        setHasConflict(true);
      }
    };

    channel.onmessage = handleMessage;
    
    // Announce ourselves
    channel.postMessage({ type: 'PING', instanceId });

    return () => {
      channel.close();
    };
  }, [auctionId]);

  return hasConflict;
}
