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
 * 
 * @param {string} role - User role (admin, client, coral, cad, etc.)
 * @param {string} userId - User ID for filtering assigned enquiries (optional, required for non-admin users)
 */
export const useFilteredEnquiries = (role, userId = undefined) => {
  const dispatch = useDispatch();
  const currentPage = useSelector(state => state.enquiries.pagination.currentPage);
  const searchQuery = useSelector(state => state.enquiries.searchQuery);
  
  // Determine if we should filter by assignedTo
  // Non-admin users (designers, clients, etc.) should only see their assigned enquiries
  // Admins can see all enquiries (unless explicitly filtering)
  const isAdmin = role === 'admin' || role === 'AD';
  const assignedTo = isAdmin ? undefined : userId; // Only filter by userId for non-admins
  
  // When searching, fetch ALL enquiries (use large limit) to search across all pages
  // Otherwise use current page for normal pagination
  const pageToFetch = searchQuery ? 1 : currentPage;
  const limitToFetch = searchQuery ? 10000 : undefined; // Fetch all when searching
  
  const { data, isLoading, error, refetch } = useGetEnquiriesQuery(
    { 
      role, 
      page: pageToFetch,
      limit: limitToFetch, // Fetch all enquiries when searching
      search: searchQuery || undefined, // Pass search query to backend (if supported)
      assignedTo: assignedTo, // Filter by assigned user for non-admin roles
    },
    {
      skip: !role || (!isAdmin && !userId), // Skip if no role, or if non-admin without userId
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
  
  const filters = useSelector(state => state.enquiries.filters);
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
    
    // Apply search query - ALWAYS apply client-side when searching
    // This ensures search works across all fetched enquiries
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(e => 
        e.title?.toLowerCase().includes(query) ||
        e.clientName?.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        (e.Name && e.Name.toLowerCase().includes(query))
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
  
  // Calculate pagination for filtered results
  const limit = 25;
  const filteredTotal = filteredEnquiries.length;
  const filteredTotalPages = Math.ceil(filteredTotal / limit);
  
  // Get paginated results based on current page
  const paginatedEnquiries = useMemo(() => {
    if (searchQuery) {
      // When searching, paginate the filtered results client-side
      const startIndex = (currentPage - 1) * limit;
      const endIndex = startIndex + limit;
      return filteredEnquiries.slice(startIndex, endIndex);
    } else {
      // When not searching, return all filtered (already paginated by backend)
      return filteredEnquiries;
    }
  }, [filteredEnquiries, currentPage, limit, searchQuery]);
  
  // Update Redux pagination state
  useEffect(() => {
    if (searchQuery) {
      // When searching, use filtered count for pagination
      dispatch(setPagination({
        total: filteredTotal,
        totalPages: filteredTotalPages,
        limit: limit,
      }));
    } else {
      // Normal pagination from API
      if (pagination && pagination.total > 0) {
        dispatch(setPagination({
          total: pagination.total,
          totalPages: pagination.totalPages,
          limit: pagination.limit,
        }));
      }
    }
  }, [pagination, dispatch, searchQuery, filteredTotal, filteredTotalPages, limit, currentPage]);

  return {
    enquiries: paginatedEnquiries, // Return paginated results
    allEnquiries: enquiries, // Keep all enquiries for reference
    filteredEnquiries: filteredEnquiries, // All filtered results (for reference)
    isLoading,
    error,
    refetch,
    pagination: searchQuery ? {
      total: filteredTotal,
      page: currentPage,
      limit: limit,
      totalPages: filteredTotalPages,
    } : pagination,
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

