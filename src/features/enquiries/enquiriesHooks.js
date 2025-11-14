import { useMemo, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  useGetEnquiriesQuery,
  useGetEnquiryByIdQuery,
} from '../../store/api';
import { setPagination } from './enquiriesSlice';

/**
 * Custom hook that combines RTK Query data with UI filters
 * Replaces the manual filtering logic in components
 */
export const useFilteredEnquiries = (role) => {
  const dispatch = useDispatch();
  const currentPage = useSelector(state => state.enquiries.pagination.currentPage);
  
  const { data, isLoading, error, refetch } = useGetEnquiriesQuery(
    { role, page: currentPage },
    {
      skip: !role,
      refetchOnFocus: true, // Refetch when screen comes into focus
    }
  );
  
  // Extract enquiries and pagination from response
  const enquiries = data?.data || [];
  const pagination = data?.pagination || {
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  };
  
  // Update Redux pagination state when API response changes
  useEffect(() => {
    if (pagination && pagination.total > 0) {
      dispatch(setPagination({
        total: pagination.total,
        totalPages: pagination.totalPages,
        limit: pagination.limit,
      }));
    }
  }, [pagination, dispatch]);
  
  const filters = useSelector(state => state.enquiries.filters);
  const searchQuery = useSelector(state => state.enquiries.searchQuery);
  const sortBy = useSelector(state => state.enquiries.sortBy);
  const sortOrder = useSelector(state => state.enquiries.sortOrder);

  const filteredEnquiries = useMemo(() => {
    let filtered = [...enquiries];
    
    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(e => e.status === filters.status);
    }
    
    // Apply priority filter
    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(e => e.priority === filters.priority);
    }
    
    // Apply client filter
    if (filters.client && filters.client !== 'all') {
      filtered = filtered.filter(e => e.clientName === filters.client);
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.title?.toLowerCase().includes(query) ||
        e.clientName?.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      // Handle date sorting
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } 
      // Handle number sorting
      else if (sortBy === 'budget') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }
      // Handle string sorting
      else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      // Apply sort order
      if (sortOrder === 'asc') {
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
      } else {
        if (aValue > bValue) return -1;
        if (aValue < bValue) return 1;
        return 0;
      }
    });
    
    return filtered;
  }, [enquiries, filters, searchQuery, sortBy, sortOrder]);

  return {
    enquiries: filteredEnquiries,
    allEnquiries: enquiries,
    isLoading,
    error,
    refetch,
    pagination,
  };
};

/**
 * Custom hook for fetching a single enquiry by ID
 * Automatically uses cache if available
 */
export const useEnquiry = (id) => {
  return useGetEnquiryByIdQuery(id, {
    skip: !id,
  });
};

