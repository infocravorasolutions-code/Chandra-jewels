import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  filters: {
    status: 'all',
    priority: 'all',
    client: 'all',
  },
  searchQuery: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  selectedEnquiryId: null,
  selectedStatus: 'All',
  selectedClient: 'All',
};

const enquiriesSlice = createSlice({
  name: 'enquiries',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setSorting: (state, action) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    setSelectedEnquiry: (state, action) => {
      state.selectedEnquiryId = action.payload;
    },
    setSelectedStatus: (state, action) => {
      state.selectedStatus = action.payload;
      // Update filters.status to match
      const statusMap = {
        'All': 'all',
        'Pending': 'pending',
        'In Progress': 'in_progress',
        'Completed': 'completed',
        'Rejected': 'rejected',
      };
      state.filters.status = statusMap[action.payload] || 'all';
    },
    setSelectedClient: (state, action) => {
      state.selectedClient = action.payload;
      state.filters.client = action.payload === 'All' ? 'all' : action.payload;
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
      state.searchQuery = '';
      state.selectedStatus = 'All';
      state.selectedClient = 'All';
    },
  },
});

export const {
  setFilters,
  setSearchQuery,
  setSorting,
  setSelectedEnquiry,
  setSelectedStatus,
  setSelectedClient,
  clearFilters,
} = enquiriesSlice.actions;

export default enquiriesSlice.reducer;

