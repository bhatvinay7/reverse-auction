'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setConnectionStatus } from '../store/slices/auctionSlice';
import { io, Socket } from 'socket.io-client';

// Define strict types for events
export interface BidRequestPayload {
  auction_id: string;
  bidder_id: string;
  username?: string;
  amount: number;
  timestamp: number;
}

export interface BidEventPayload {
  bid: BidRequestPayload;
  is_executed: boolean;
}

export interface AuctionInitPayload {
  auction_id: string;
  auction_type: 'REVERSE' | 'FORWARD';
  minimum_bid_step: number;
  leading_bids: BidEventPayload[];
  lowest_bids: BidEventPayload[];
  recent_events?: BidEventPayload[];
  start_time: number;
  end_time: number;
  initial_price: number | null;
  initial_lowest: number | null;
  is_participant: boolean;
}

export interface AuctionClosedPayload {
  event: string;
  data: BidRequestPayload | null;
}

// Map event names to payload types
export type ServerToClientEvents = {
  auction_init: (data: AuctionInitPayload) => void;
  bid_update: (data: BidEventPayload) => void;
  auction_closed: (data: AuctionClosedPayload) => void;
  error: (msg: string | { message: string; code?: string }) => void;
  info: (msg: string) => void;
};

export type ClientToServerEvents = {
  place_bid: (data: BidRequestPayload) => void;
};

interface SocketContextType {
  subscribeToAuction: (auctionId: string) => void;
  unsubscribeFromAuction: (auctionId: string) => void;
  onEvent: <Ev extends keyof ServerToClientEvents>(
    auctionId: string,
    eventName: Ev,
    callback: ServerToClientEvents[Ev]
  ) => () => void;
  emitEvent: <Ev extends keyof ClientToServerEvents>(
    auctionId: string,
    eventName: Ev,
    data: Parameters<ClientToServerEvents[Ev]>[0]
  ) => void;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  subscribeToAuction: () => { },
  unsubscribeFromAuction: () => { },
  onEvent: () => () => { },
  emitEvent: () => { },
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode, serverUserId?: string }> = ({ children, serverUserId }) => {
  const [isConnected, setIsConnected] = useState(false);
  const dispatch = useDispatch();

  // Map of auctionId -> socket instance
  const sockets = useRef<Map<string, Socket<ServerToClientEvents, ClientToServerEvents>>>(new Map());
  // Track subscription ref-counts so StrictMode double-mount doesn't prematurely disconnect
  const refCounts = useRef<Map<string, number>>(new Map());

  const onEvent = useCallback(<Ev extends keyof ServerToClientEvents>(
    auctionId: string,
    eventName: Ev,
    callback: ServerToClientEvents[Ev]
  ) => {
    const socket = sockets.current.get(auctionId);
    if (socket) {
      // @ts-expect-error - socket.io strict types struggle with generic event names
      socket.on(eventName, callback);
    }

    return () => {
      const currentSocket = sockets.current.get(auctionId);
      if (currentSocket) {
        // @ts-expect-error - socket.io strict types struggle with generic event names
        currentSocket.off(eventName, callback);
      }
    };
  }, []);

  const emitEvent = useCallback(<Ev extends keyof ClientToServerEvents>(
    auctionId: string,
    eventName: Ev,
    data: Parameters<ClientToServerEvents[Ev]>[0]
  ) => {
    const socket = sockets.current.get(auctionId);
    if (socket?.connected) {
      // @ts-expect-error - generic event emission
      socket.emit(eventName, data);
    }
  }, []);

  const subscribeToAuction = useCallback((auctionId: string) => {
    // Increment ref-count
    const count = (refCounts.current.get(auctionId) ?? 0) + 1;
    refCounts.current.set(auctionId, count);

    // Only create a new socket if one doesn't already exist
    if (sockets.current.has(auctionId)) return;

    const gatewayUrl = process.env.NEXT_PUBLIC_SOCKET_URL
      || process.env.NEXT_PUBLIC_API_URL
      || 'http://localhost:8080';
    
    // Fall back to local storage if the server failed to provide a decrypted userId
    const userId = serverUserId || (typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '');
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

    const socket = io(gatewayUrl, {
      autoConnect: false,
      transports: ['websocket'],
      // Gateway tickets are single-use. Reconnect manually after obtaining a
      // fresh ticket instead of replaying the consumed handshake query.
      reconnection: false,
      auth: { auction_id: auctionId, user_id: userId, token },
      query: { ticket: '' },
    });

    const refreshTicket = async () => {
      const response = await fetch(`${gatewayUrl}/api/socket-ticket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ auction_id: auctionId }),
      });
      if (!response.ok) throw new Error(`Socket ticket request failed (${response.status})`);
      const data = await response.json() as { ticket: string };
      socket.io.opts.query = { ticket: data.ticket };
    };

    socket.on('connect', () => {
      console.log(`[Socket] Connected to auction ${auctionId}`);
      setIsConnected(true);
      dispatch(setConnectionStatus(true));
    });

    socket.on('connect_error', (err) => {
      console.error(`[Socket] Connection error for auction ${auctionId}:`, err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected from auction ${auctionId}. Reason: ${reason}`);
      setIsConnected(false);
      dispatch(setConnectionStatus(false));

      if (reason !== 'io client disconnect') {
        setTimeout(() => {
          if ((refCounts.current.get(auctionId) ?? 0) > 0) {
            void refreshTicket()
              .then(() => socket.connect())
              .catch((error: unknown) => {
                console.error(`[Socket] Reauthorization failed for auction ${auctionId}:`, error);
              });
          }
        }, 2000);
      }
    });

    sockets.current.set(auctionId, socket);
    void refreshTicket()
      .then(() => {
        if ((refCounts.current.get(auctionId) ?? 0) > 0) socket.connect();
      })
      .catch((error: unknown) => {
        console.error(`[Socket] Could not authorize auction ${auctionId}:`, error);
        sockets.current.delete(auctionId);
      });
  }, [dispatch, serverUserId]);

  const unsubscribeFromAuction = useCallback((auctionId: string) => {
    // Decrement ref-count; only truly disconnect when no subscriber remains
    const count = (refCounts.current.get(auctionId) ?? 1) - 1;
    refCounts.current.set(auctionId, count);

    if (count > 0) return; // other subscribers still active

    const socket = sockets.current.get(auctionId);
    if (socket) {
      socket.disconnect();
      sockets.current.delete(auctionId);
    }
    refCounts.current.delete(auctionId);
  }, []);

  // Global cleanup on provider unmount
  useEffect(() => {
    const activeSockets = sockets.current;
    const activeRefCounts = refCounts.current;
    return () => {
      activeSockets.forEach((socket) => socket.disconnect());
      activeSockets.clear();
      activeRefCounts.clear();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ subscribeToAuction, unsubscribeFromAuction, onEvent, emitEvent, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
