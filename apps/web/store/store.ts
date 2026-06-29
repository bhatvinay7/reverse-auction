import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import auctionReducer from './slices/auctionSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auction: auctionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
