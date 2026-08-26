import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { initAuction, reconcileBid } from '../store/slices/auctionSlice';
import { useSocket, BidEventPayload, AuctionInitPayload } from '../contexts/SocketContext';

export interface Competitor {
  bidder_id: string;
  username?: string;
  amount: number;
  timestamp: number;
}

export const useAuctionSocket = (auctionId: string) => {
  const { subscribeToAuction, unsubscribeFromAuction, onEvent, emitEvent, isConnected } = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!auctionId) return;

    subscribeToAuction(auctionId);

    // Subscribe to initialization event (ReloadState)
    const unsubscribeInit = onEvent(auctionId, 'auction_init', (event: AuctionInitPayload) => {
      dispatch(initAuction({
        auctionId: event.auction_id,
        auctionType: event.auction_type || 'REVERSE',
        minimumBidStep: event.minimum_bid_step || 1,
        startTime: event.start_time,
        endTime: event.end_time,
        initialPrice: event.initial_price ?? event.initial_lowest,
        isParticipant: event.is_participant
      }));

      if (event.recent_events && Array.isArray(event.recent_events)) {
        event.recent_events
          .filter(item => item && item.bid)
          .forEach((item) => {
            dispatch(reconcileBid({
              id: item.bid.bidder_id + item.bid.timestamp,
              status: item.is_executed ? 'confirmed' : 'rejected',
              amount: Number(item.bid.amount),
              bidder: item.bid.username || item.bid.bidder_id,
              timestamp: item.bid.timestamp
            }));
          });
      }

      const leadingBids = event.leading_bids || event.lowest_bids;
      if (leadingBids && Array.isArray(leadingBids)) {
        // Process the direction-aware leading bids returned by the server.
        leadingBids
          .filter(item => item && item.bid)
          .forEach((item) => {
            dispatch(reconcileBid({
              id: item.bid.bidder_id + item.bid.timestamp,
              status: item.is_executed ? 'confirmed' : 'rejected',
              amount: Number(item.bid.amount),
              bidder: item.bid.username || item.bid.bidder_id,
              timestamp: item.bid.timestamp
            }));
          });
      }
    });

    // Subscribe to real-time bid updates
    const unsubscribeBid = onEvent(auctionId, 'bid_update', (bidEvent: BidEventPayload) => {
      dispatch(reconcileBid({
        id: bidEvent.bid.bidder_id + bidEvent.bid.timestamp, // pseudo unique ID for mapping
        status: bidEvent.is_executed ? 'confirmed' : 'rejected',
        amount: Number(bidEvent.bid.amount),
        bidder: bidEvent.bid.username || bidEvent.bid.bidder_id,
        timestamp: bidEvent.bid.timestamp
      }));
    });

    // Subscribe to auction closure
    const unsubscribeClose = onEvent(auctionId, 'auction_closed', (payload) => {
      console.log(`Auction ${auctionId} is now closed. Winner:`, payload.data);
      // Could set some state here like setIsClosed(true)
    });

    const unsubscribeError = onEvent(auctionId, 'error', (errorMsg) => {
      console.error(`[ws-server error] Auction ${auctionId}:`, errorMsg);
    });

    const unsubscribeInfo = onEvent(auctionId, 'info', (infoMsg: string) => {
      console.log(`[ws-server info] Auction ${auctionId}:`, infoMsg);
    });

    return () => {
      unsubscribeInit();
      unsubscribeBid();
      unsubscribeClose();
      unsubscribeError();
      unsubscribeInfo();
      unsubscribeFromAuction(auctionId);
    };
  }, [auctionId, dispatch, subscribeToAuction, unsubscribeFromAuction, onEvent]);

  return {
    isConnected,
    emitEvent,
  };
};
