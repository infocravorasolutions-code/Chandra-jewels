import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  filters: {
    status: 'all',
    priority: 'all',
    category: 'all',
    clientId: 'all',
    assignedTo: 'all',
    stoneType: 'all',
    metalColor: 'all',
    metalQuality: 'all',
    shippingDateFrom: '',
    shippingDateTo: '',
    assignedDateFrom: '',
    assignedDateTo: '',
    createdDateFrom: '',
    createdDateTo: '',
  },
  searchQuery: '',
  sortBy: 'CreatedDate',
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
      // Legacy support - no longer updates filters
    },
    setSelectedClient: (state, action) => {
      state.selectedClient = action.payload;
      // Legacy support - no longer updates filters
    },
    clearFilters: (state) => {
      state.filters = {
        status: 'all',
        priority: 'all',
        category: 'all',
        clientId: 'all',
        assignedTo: 'all',
        stoneType: 'all',
        metalColor: 'all',
        metalQuality: 'all',
        shippingDateFrom: '',
        shippingDateTo: '',
        assignedDateFrom: '',
        assignedDateTo: '',
        createdDateFrom: '',
        createdDateTo: '',
      };
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

