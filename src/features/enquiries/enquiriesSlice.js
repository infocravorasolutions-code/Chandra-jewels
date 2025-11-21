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
  sortBy: 'createdAt',
  sortOrder: 'asc',
  selectedEnquiryId: null,
  selectedStatus: 'All',
  selectedClient: 'All',
  pagination: {
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 25, // Increased to 25 for better initial display (admins get 50)
  },
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
      state.pagination.currentPage = 1;
    },
    setPage: (state, action) => {
      state.pagination.currentPage = action.payload;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
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
  setPage,
  setPagination,
} = enquiriesSlice.actions;

export default enquiriesSlice.reducer;

