import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Bid {
  id: string;
  amount: number;
  bidder: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'rejected';
}

export interface AuctionState {
  auctionId: string | null;
  bids: Bid[];
  currentPrice: number | null;
  startingPrice: number | null;
  auctionType: 'REVERSE' | 'FORWARD';
  minimumBidStep: number;
  isConnected: boolean;
  timeSkew: number;
  startTime: number | null;
  endTime: number | null;
  auctionStatus: 'waiting' | 'active' | 'ended';
  isParticipant: boolean;
}

const initialState: AuctionState = {
  auctionId: null,
  bids: [],
  currentPrice: null,
  startingPrice: null,
  auctionType: 'REVERSE',
  minimumBidStep: 1,
  isConnected: false,
  timeSkew: 0,
  startTime: null,
  endTime: null,
  auctionStatus: 'waiting',
  isParticipant: false,
};

export const auctionSlice = createSlice({
  name: 'auction',
  initialState,
  reducers: {
    initAuction: (state, action: PayloadAction<{ auctionId: string; auctionType: 'REVERSE' | 'FORWARD'; minimumBidStep: number; startTime: number; endTime: number; initialPrice: number | null; isParticipant: boolean }>) => {
      state.auctionId = action.payload.auctionId;
      state.startTime = action.payload.startTime;
      state.endTime = action.payload.endTime;
      state.currentPrice = action.payload.initialPrice;
      state.startingPrice = action.payload.initialPrice;
      state.auctionType = action.payload.auctionType;
      state.minimumBidStep = action.payload.minimumBidStep;
      state.isParticipant = action.payload.isParticipant;
      
      const now = Date.now() + state.timeSkew;
      if (now > action.payload.endTime) {
        state.auctionStatus = 'ended';
      } else if (now >= action.payload.startTime) {
        state.auctionStatus = 'active';
      } else {
        state.auctionStatus = 'waiting';
      }
      
      state.bids = [];
    },
    updateAuctionStatus: (state) => {
      if (state.startTime && state.endTime) {
        const now = Date.now() + state.timeSkew;
        if (now > state.endTime) {
          state.auctionStatus = 'ended';
        } else if (now >= state.startTime) {
          state.auctionStatus = 'active';
        } else {
          state.auctionStatus = 'waiting';
        }
      }
    },
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setTimeSkew: (state, action: PayloadAction<number>) => {
      state.timeSkew = action.payload;
    },
    addOptimisticBid: (state, action: PayloadAction<Bid>) => {
      state.bids.unshift(action.payload);
      const improvesPrice = state.currentPrice === null
        || (state.auctionType === 'REVERSE'
          ? action.payload.amount < state.currentPrice
          : action.payload.amount > state.currentPrice);
      if (improvesPrice) {
        state.currentPrice = action.payload.amount;
      }
    },
    reconcileBid: (state, action: PayloadAction<{ id?: string; status: 'confirmed' | 'rejected'; amount: number; bidder: string; timestamp: number }>) => {
      let bidIndex = -1;
      if (action.payload.id) {
        bidIndex = state.bids.findIndex(b => b.id === action.payload.id);
      }
      
      if (bidIndex === -1) {
        // Find optimistic match based on amount for current user
        bidIndex = state.bids.findIndex(b => b.status === 'pending' && b.amount === action.payload.amount);
      }

      if (bidIndex >= 0) {
        state.bids[bidIndex] = { ...state.bids[bidIndex], ...action.payload, id: state.bids[bidIndex]!.id }; // preserve original id
      } else {
        state.bids.unshift({ ...action.payload, id: action.payload.id || Math.random().toString(36).substring(7) });
      }
      
      // Sort bids newest first
      state.bids.sort((a, b) => b.timestamp - a.timestamp);

      // Re-calculate the leading price using the authoritative auction direction.
      const validBids = state.bids.filter(b => b.status !== 'rejected');
      if (validBids.length > 0) {
        const amounts = validBids.map(b => b.amount);
        state.currentPrice = state.auctionType === 'REVERSE'
          ? Math.min(...amounts)
          : Math.max(...amounts);
      } else {
        state.currentPrice = state.startingPrice;
      }
    },
    endAuction: (state) => {
      state.auctionStatus = 'ended';
    }
  },
});

export const { initAuction, updateAuctionStatus, setConnectionStatus, setTimeSkew, addOptimisticBid, reconcileBid, endAuction } = auctionSlice.actions;
export default auctionSlice.reducer;
