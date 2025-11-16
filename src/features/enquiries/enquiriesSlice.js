import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  filters: {
    status: 'all',
    category: 'all',
    priority: 'all',
    clientId: 'all',
    assignedTo: 'all',
    stoneType: 'all',
    metalColor: 'all',
    metalQuality: 'all',
    shippingDateFrom: null,
    shippingDateTo: null,
    assignedDateFrom: null,
    assignedDateTo: null,
    createdDateFrom: null,
    createdDateTo: null,
  },
  searchQuery: '',
  sortBy: 'assignedDate', // Default: AssignedDate
  sortOrder: 'desc',
  selectedEnquiryId: null,
  selectedStatus: 'All',
  selectedClient: 'All',
  pagination: {
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 25,
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
      state.filters.clientId = action.payload === 'All' ? 'all' : action.payload;
    },
    clearFilters: (state) => {
      state.filters = { ...initialState.filters };
      state.searchQuery = '';
      state.selectedStatus = 'All';
      state.selectedClient = 'All';
      state.sortBy = 'assignedDate';
      state.sortOrder = 'desc';
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

