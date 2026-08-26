import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UiState {
  activeTab: string;
  isSidebarCollapsed: boolean;
}

const initialState: UiState = {
  activeTab: 'dashboard',
  isSidebarCollapsed: false,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTab = action.payload;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.isSidebarCollapsed = action.payload;
    },
    toggleSidebarCollapsed: (state) => {
      state.isSidebarCollapsed = !state.isSidebarCollapsed;
    },
  },
});

export const { setActiveTab, setSidebarCollapsed, toggleSidebarCollapsed } = uiSlice.actions;
export default uiSlice.reducer;
