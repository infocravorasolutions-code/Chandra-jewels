import { useMemo, useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  useGetEnquiriesQuery,
  useGetEnquiryByIdQuery,
} from '../../store/api';
import { useClients } from '../clients/clientsHooks';
import { setPagination, setPage } from './enquiriesSlice';
import { useAuth } from '../../context/AuthContext';

/**
 * Custom hook that combines RTK Query data with UI filters
 * Replaces the manual filtering logic in components
 * 
 * @param {string} role - User role (admin, client, coral, cad, etc.)
 * @param {string} userId - User ID for filtering assigned enquiries (optional, required for non-admin users)
 */
export const useFilteredEnquiries = (role, userId = undefined) => {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const currentPage = useSelector(state => state.enquiries.pagination.currentPage);
  const searchQuery = useSelector(state => state.enquiries.searchQuery);
  
  // Determine if user is a client
  const isClient = role === 'client' || user?.role === 'client' || user?.roleId === 4 || user?.roleNumber === 4;
  const isAdmin = role === 'admin' || role === 'AD';
  
  // Fetch clients to find client ID for client users (using cached hook)
  const { clients: clientsData = [] } = useClients({
    skip: !isClient, // Only fetch if user is a client
  });
  const clients = Array.isArray(clientsData) ? clientsData : [];
  
  // Find the client ID for client users
  // IMPORTANT: For client users, enquiries are created with USER ID as ClientId
  // So we need to filter enquiries where ClientId = user.id
  const clientIdForFilter = useMemo(() => {
    if (!isClient || !user) {
      if (__DEV__ && isClient) {
        console.log('🔍 Client user but no user:', {
          isClient,
          hasUser: !!user,
        });
      }
      return null;
    }
    
    // For client users, enquiries are created with USER ID as ClientId
    // So we filter enquiries where ClientId matches the user's ID
    console.log('✅ ========== CLIENT USER FILTERING ==========');
    console.log('✅ Client user detected');
    console.log('✅ Enquiries are created with USER ID as ClientId');
    console.log('✅ Using USER ID for filtering:', user.id);
    console.log('✅ User:', { id: user?.id, email: user?.email, name: user?.name, role: user?.role });
    console.log('✅ ===========================================');
    
    return user.id; // Use user ID as clientId for filtering
  }, [isClient, user]);
  
  // Determine filtering strategy:
  // - Admin: No filter (see all enquiries)
  // - Client: Filter by clientId (enquiries where they are the client)
  // - Designer/Worker: Filter by assignedTo (enquiries assigned to them)
  const assignedTo = (isAdmin || isClient) ? undefined : userId; // Only filter by assignedTo for designers/workers
  const clientIdFilter = isClient ? clientIdForFilter : undefined; // Filter by clientId for client users
  
  // Log filtering strategy for debugging
  console.log('🔐 ========== ENQUIRY FILTERING STRATEGY ==========');
  console.log('🔐 User Role:', role);
  console.log('🔐 Is Admin:', isAdmin);
  console.log('🔐 Is Client:', isClient);
  console.log('🔐 User ID:', userId);
  console.log('🔐 Client ID For Filter:', clientIdForFilter);
  console.log('🔐 Client ID Filter (final):', clientIdFilter);
  console.log('🔐 AssignedTo Filter:', assignedTo);
  console.log('🔐 User Object:', { id: user?.id, email: user?.email, name: user?.name, role: user?.role, roleId: user?.roleId });
  console.log('🔐 Clients Count:', clients.length);
  console.log('🔐 ===============================================');
  
  // For infinite scroll: always fetch page 1 initially, then load more pages as needed
  // When searching, fetch ALL enquiries (use large limit) to search across all pages
  // Otherwise use lazy loading with limit 10
  const pageToFetch = searchQuery ? 1 : currentPage;
  const limitToFetch = searchQuery ? 10000 : 10; // Use 10 for lazy loading, 10000 when searching
  
  const filters = useSelector(state => state.enquiries.filters);
  const sortBy = useSelector(state => state.enquiries.sortBy);
  const sortOrder = useSelector(state => state.enquiries.sortOrder);

  // Pass filters to API query
  // For client users, add clientId filter to ensure they only see their own enquiries
  const apiFilters = {
    ...filters,
    sortBy: sortBy === 'assignedDate' ? 'assignedDate' : sortBy,
    sortOrder,
    // Override clientId filter for client users to ensure they only see their own enquiries
    ...(isClient && clientIdFilter ? { clientId: clientIdFilter } : {}),
  };
  
  console.log('🔐 API Filters being sent:', apiFilters);
  console.log('🔐 Will clientId be sent?', !!(isClient && clientIdFilter));
  console.log('🔐 ClientId value:', clientIdFilter);

  const { data, isLoading, error, refetch } = useGetEnquiriesQuery(
    { 
      role, 
      page: pageToFetch,
      limit: limitToFetch,
      search: searchQuery || undefined,
      assignedTo: assignedTo,
      filters: apiFilters,
      userId: userId || user?.id, // Pass userId for client fallback filtering
    },
    {
      // Skip if:
      // - No role
      // - Non-admin, non-client user without userId (designers/workers need userId)
      // For client users: Don't skip - we use user.id as clientId, don't need clients list
      skip: !role || (!isAdmin && !isClient && !userId),
      refetchOnFocus: true,
    }
  );
  
  // Extract enquiries and pagination from response
  const enquiries = data?.data || [];
  const pagination = data?.pagination || {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  };
  
  // State to accumulate enquiries across pages for infinite scroll
  const [accumulatedEnquiries, setAccumulatedEnquiries] = useState([]);
  const [loadedPages, setLoadedPages] = useState(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Reset accumulated data when filters/search/sort change (but not when page changes)
  useEffect(() => {
    setAccumulatedEnquiries([]);
    setLoadedPages(new Set());
    // Reset to page 1 when filters change
    if (currentPage !== 1) {
      dispatch(setPage(1));
    }
  }, [searchQuery, filters.status, filters.priority, sortBy, sortOrder, dispatch]);
  
  // Accumulate enquiries when new data arrives
  useEffect(() => {
    if (!searchQuery && enquiries.length > 0 && !isLoading) {
      if (currentPage === 1) {
        // First page - replace accumulated data
        setAccumulatedEnquiries(enquiries);
        setLoadedPages(new Set([1]));
        setIsLoadingMore(false); // Reset loading state
      } else if (!loadedPages.has(currentPage)) {
        // New page - append to accumulated data
        setAccumulatedEnquiries(prev => {
          // Avoid duplicates by checking IDs
          const existingIds = new Set(prev.map(e => e.id || e._id));
          const newEnquiries = enquiries.filter(e => !existingIds.has(e.id || e._id));
          return [...prev, ...newEnquiries];
        });
        setLoadedPages(prev => new Set([...prev, currentPage]));
        setIsLoadingMore(false); // Reset loading state when new data arrives
      }
    } else if (searchQuery) {
      // When searching, use all enquiries directly
      setAccumulatedEnquiries(enquiries);
      setIsLoadingMore(false);
    }
  }, [enquiries, currentPage, searchQuery, isLoading, loadedPages]);
  
  // Set loading more state when page changes (for pages > 1)
  useEffect(() => {
    if (!searchQuery && currentPage > 1 && !loadedPages.has(currentPage)) {
      setIsLoadingMore(true);
    }
  }, [currentPage, searchQuery, loadedPages]);
  
  // Use accumulated enquiries for infinite scroll, or all enquiries when searching
  const enquiriesToUse = searchQuery ? enquiries : accumulatedEnquiries;

  const filteredEnquiries = useMemo(() => {
    let filtered = [...enquiriesToUse];
    
    // CRITICAL: For client users, ensure we only show their enquiries
    // This is a safety measure in case backend doesn't filter properly
    if (isClient) {
      console.log('🔐 ========== CLIENT FILTERING APPLIED ==========');
      console.log('🔐 Total enquiries before filtering:', filtered.length);
      console.log('🔐 Client ID for filter:', clientIdForFilter);
      console.log('🔐 User:', { id: user?.id, email: user?.email, name: user?.name, role: user?.role });
      
      if (clientIdForFilter) {
        const beforeCount = filtered.length;
        const matchingEnquiries = [];
        const nonMatchingEnquiries = [];
        
        filtered = filtered.filter(e => {
          const enquiryClientId = e.clientId || e.ClientId || '';
          const matches = String(enquiryClientId).trim() === String(clientIdForFilter).trim();
          
          if (matches) {
            matchingEnquiries.push({ id: e.id || e._id, clientId: enquiryClientId });
          } else {
            nonMatchingEnquiries.push({ id: e.id || e._id, clientId: enquiryClientId });
          }
          
          return matches;
        });
        
        const afterCount = filtered.length;
        console.log(`🔐 Filtering result: ${beforeCount} → ${afterCount} enquiries`);
        console.log(`🔐 Matching enquiries (${matchingEnquiries.length}):`, matchingEnquiries.slice(0, 5));
        console.log(`🔐 Non-matching enquiries (${nonMatchingEnquiries.length}):`, nonMatchingEnquiries.slice(0, 5));
        console.log('🔐 ===========================================');
      } else {
        // This shouldn't happen since we now use user.id as clientIdForFilter
        // But if it does, hide all enquiries for security
        console.warn('⚠️ ========== CLIENT FILTERING FAILED ==========');
        console.warn('⚠️ Client user but clientId not found - hiding all enquiries for security');
        console.warn('⚠️ User:', { id: user?.id, email: user?.email, name: user?.name });
        console.warn('⚠️ This should not happen - user.id should be used as clientId');
        console.warn('⚠️ ===========================================');
        filtered = [];
      }
    }
    
    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(e => {
        const enquiryStatus = (e.status || e.Status || e.CurrentStatus || '').toString();
        const filterStatus = filters.status.toString();
        
        // Normalize both statuses for comparison (remove spaces, lowercase)
        const normalizedEnquiryStatus = enquiryStatus.toLowerCase().replace(/\s+/g, '');
        const normalizedFilterStatus = filterStatus.toLowerCase().replace(/\s+/g, '');
        
        // Exact match (case insensitive, space insensitive)
        if (normalizedEnquiryStatus === normalizedFilterStatus) {
          return true;
        }
        
        // Handle "Design Approval Pending" variations
        if (normalizedFilterStatus.includes('designapprovalpending') || 
            normalizedFilterStatus.includes('approvalpending')) {
          return normalizedEnquiryStatus.includes('approval') && 
                 !normalizedEnquiryStatus.includes('approved');
        }
        
        // Handle "Approved Cad" variations
        if (normalizedFilterStatus.includes('approvedcad') || normalizedFilterStatus === 'approvedcad') {
          return normalizedEnquiryStatus.includes('approvedcad') || 
                 (normalizedEnquiryStatus.includes('approved') && normalizedEnquiryStatus.includes('cad'));
        }
        
        // Handle "Order Placement" variations
        if (normalizedFilterStatus.includes('orderplacement')) {
          return normalizedEnquiryStatus.includes('orderplacement') ||
                 (normalizedEnquiryStatus.includes('order') && normalizedEnquiryStatus.includes('placement'));
        }
        
        // Handle "CAM Pending" variations
        if (normalizedFilterStatus.includes('campending')) {
          return normalizedEnquiryStatus.includes('campending') ||
                 (normalizedEnquiryStatus.includes('cam') && normalizedEnquiryStatus.includes('pending'));
        }
        
        // Handle "Production" status
        if (normalizedFilterStatus === 'production') {
          return normalizedEnquiryStatus === 'production';
        }
        
        // Handle "Coral" status
        if (normalizedFilterStatus === 'coral') {
          return normalizedEnquiryStatus.includes('coral');
        }
        
        // Handle "CAD" status (must be exact, not part of "Approved Cad")
        if (normalizedFilterStatus === 'cad' && normalizedEnquiryStatus === 'cad') {
          return true;
        }
        
        // Fallback: partial match for other statuses
        if (normalizedEnquiryStatus.includes(normalizedFilterStatus) || 
            normalizedFilterStatus.includes(normalizedEnquiryStatus)) {
          return true;
        }
        
        return false;
      });
    }
    
    // Apply priority filter
    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(e => {
        const priority = e.priority || e.Priority || '';
        return priority === filters.priority || priority.toLowerCase() === filters.priority.toLowerCase();
      });
    }
    
    // Apply search query - search across Name, StyleNumber, CoralCode, CadCode, GatiOrderNumber
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(e => {
        const name = (e.Name || e.name || e.title || '').toLowerCase();
        const styleNumber = (e.StyleNumber || e.styleNumber || '').toLowerCase();
        const coralCode = (e.CoralCode || e.coralCode || '').toLowerCase();
        const cadCode = (e.CadCode || e.cadCode || '').toLowerCase();
        const gatiOrderNumber = (e.GatiOrderNumber || e.gatiOrderNumber || '').toLowerCase();
        const clientName = (e.clientName || e.ClientName || '').toLowerCase();
        const description = (e.description || e.Remarks || e.remarks || '').toLowerCase();
        
        return name.includes(query) ||
               styleNumber.includes(query) ||
               coralCode.includes(query) ||
               cadCode.includes(query) ||
               gatiOrderNumber.includes(query) ||
               clientName.includes(query) ||
               description.includes(query);
      });
    }
    
    // Apply sorting - handle field name variations
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      // Get values based on sortBy field, handling multiple possible field names
      switch (sortBy) {
        case 'title':
          aValue = a.title || a.Name || a.name || '';
          bValue = b.title || b.Name || b.name || '';
          break;
        case 'clientName':
          aValue = a.clientName || a.ClientName || a.client || '';
          bValue = b.clientName || b.ClientName || b.client || '';
          break;
        case 'budget':
          aValue = a.budget || a.Budget || a.estimatedPrice || 0;
          bValue = b.budget || b.Budget || b.estimatedPrice || 0;
          break;
        case 'status':
          aValue = a.status || a.Status || a.CurrentStatus || '';
          bValue = b.status || b.Status || b.CurrentStatus || '';
          break;
        case 'createdAt':
          aValue = a.createdAt || a.CreatedDate || a.createdDate || a.CreatedAt || '';
          bValue = b.createdAt || b.CreatedDate || b.createdDate || b.CreatedAt || '';
          break;
        case 'updatedAt':
          aValue = a.updatedAt || a.UpdatedDate || a.updatedDate || a.UpdatedAt || '';
          bValue = b.updatedAt || b.UpdatedDate || b.updatedDate || b.UpdatedAt || '';
          break;
        case 'assignedDate':
          aValue = a.AssignedDate || a.assignedDate || a.updatedAt || a.createdAt || '';
          bValue = b.AssignedDate || b.assignedDate || b.updatedAt || b.createdAt || '';
          break;
        default:
          // Fallback to direct property access
          aValue = a[sortBy] || '';
          bValue = b[sortBy] || '';
      }
      
      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      // Handle date sorting
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'assignedDate') {
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
  }, [enquiriesToUse, filters, searchQuery, sortBy, sortOrder, isClient, clientIdForFilter]);
  
  // Function to load more data (for infinite scroll)
  const loadMore = useCallback(() => {
    if (searchQuery || isLoading || isLoadingMore) return;
    
    const hasMore = currentPage < pagination.totalPages;
    if (!hasMore) return;
    
    setIsLoadingMore(true);
    // The component will handle incrementing currentPage
  }, [searchQuery, isLoading, isLoadingMore, currentPage, pagination.totalPages]);
  
  // Reset loading more state when data arrives
  useEffect(() => {
    if (!isLoading && isLoadingMore) {
      setIsLoadingMore(false);
    }
  }, [isLoading, isLoadingMore]);
  
  // Update Redux pagination state
  useEffect(() => {
    if (searchQuery) {
      // When searching, use filtered count for pagination
      const filteredTotal = filteredEnquiries.length;
      const limit = 10;
      const filteredTotalPages = Math.ceil(filteredTotal / limit);
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
  }, [pagination, dispatch, searchQuery, filteredEnquiries.length, currentPage]);

  return {
    enquiries: filteredEnquiries, // Return all filtered/accumulated enquiries for infinite scroll
    allEnquiries: enquiriesToUse, // Keep all enquiries for reference
    filteredEnquiries: filteredEnquiries, // All filtered results
    isLoading,
    isLoadingMore,
    error,
    refetch,
    loadMore, // Function to load more data
    hasMore: searchQuery ? false : currentPage < pagination.totalPages, // Whether more data is available
    pagination: searchQuery ? {
      total: filteredEnquiries.length,
      page: currentPage,
      limit: 10,
      totalPages: Math.ceil(filteredEnquiries.length / 10),
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

