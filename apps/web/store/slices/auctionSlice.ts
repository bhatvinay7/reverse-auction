import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Bid {
  id: string;
  amount: number;
  bidder: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'rejected';
}

interface AuctionState {
  auctionId: string | null;
  bids: Bid[];
  currentLowestBid: number | null;
  isConnected: boolean;
  timeSkew: number;
  endTime: number | null;
  auctionStatus: 'waiting' | 'active' | 'ended';
}

const initialState: AuctionState = {
  auctionId: null,
  bids: [],
  currentLowestBid: null,
  isConnected: false,
  timeSkew: 0,
  endTime: null,
  auctionStatus: 'waiting',
};

export const auctionSlice = createSlice({
  name: 'auction',
  initialState,
  reducers: {
    initAuction: (state, action: PayloadAction<{ auctionId: string; endTime: number; initialLowest: number }>) => {
      state.auctionId = action.payload.auctionId;
      state.endTime = action.payload.endTime;
      state.currentLowestBid = action.payload.initialLowest;
      state.auctionStatus = 'active';
      state.bids = [];
    },
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setTimeSkew: (state, action: PayloadAction<number>) => {
      state.timeSkew = action.payload;
    },
    addOptimisticBid: (state, action: PayloadAction<Bid>) => {
      state.bids.unshift(action.payload);
      if (state.currentLowestBid === null || action.payload.amount < state.currentLowestBid) {
        state.currentLowestBid = action.payload.amount;
      }
    },
    reconcileBid: (state, action: PayloadAction<{ id: string; status: 'confirmed' | 'rejected'; amount: number; bidder: string; timestamp: number }>) => {
      const bidIndex = state.bids.findIndex(b => b.id === action.payload.id);
      if (bidIndex >= 0) {
        state.bids[bidIndex] = { ...state.bids[bidIndex], ...action.payload };
      } else {
        state.bids.unshift({ ...action.payload });
      }
      
      // Sort bids newest first
      state.bids.sort((a, b) => b.timestamp - a.timestamp);

      // Re-calculate lowest bid based on non-rejected bids
      const validBids = state.bids.filter(b => b.status !== 'rejected');
      if (validBids.length > 0) {
        state.currentLowestBid = Math.min(...validBids.map(b => b.amount));
      }
    },
    endAuction: (state) => {
      state.auctionStatus = 'ended';
    }
  },
});

export const { initAuction, setConnectionStatus, setTimeSkew, addOptimisticBid, reconcileBid, endAuction } = auctionSlice.actions;
export default auctionSlice.reducer;
