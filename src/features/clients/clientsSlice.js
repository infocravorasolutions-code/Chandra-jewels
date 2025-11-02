import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedClientId: null,
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
};

const clientsSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    setSelectedClient: (state, action) => {
      state.selectedClientId = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setSorting: (state, action) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    clearFilters: (state) => {
      state.searchQuery = '';
      state.sortBy = 'name';
      state.sortOrder = 'asc';
    },
  },
});

export const {
  setSelectedClient,
  setSearchQuery,
  setSorting,
  clearFilters,
} = clientsSlice.actions;

export default clientsSlice.reducer;

