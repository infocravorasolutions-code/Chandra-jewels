import { useMemo, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  useGetEnquiriesQuery,
  useGetEnquiryByIdQuery,
  useGetClientsQuery,
} from '../../store/api';
import { setPagination } from './enquiriesSlice';
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
  
  // Fetch clients to find client ID for client users
  const { data: clientsData = [] } = useGetClientsQuery(undefined, {
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
  
  // When searching, fetch ALL enquiries (use large limit) to search across all pages
  // Otherwise use current page for normal pagination
  const pageToFetch = searchQuery ? 1 : currentPage;
  const limitToFetch = searchQuery ? 10000 : undefined; // Fetch all when searching
  
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
    limit: 25,
    totalPages: 1,
  };

  const filteredEnquiries = useMemo(() => {
    let filtered = [...enquiries];
    
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
      filtered = filtered.filter(e => e.status === filters.status);
    }
    
    // Apply category filter
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(e => {
        const category = e.category || e.Category || '';
        return category === filters.category;
      });
    }
    
    // Apply priority filter
    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(e => e.priority === filters.priority);
    }
    
    // Apply client filter (by ID or name)
    if (filters.clientId && filters.clientId !== 'all') {
      filtered = filtered.filter(e => {
        const clientId = e.clientId || e.ClientId || '';
        const clientName = e.clientName || e.ClientName || '';
        return String(clientId) === String(filters.clientId) || clientName === filters.clientId;
      });
    }
    
    // Apply assignedTo filter
    if (filters.assignedTo && filters.assignedTo !== 'all') {
      filtered = filtered.filter(e => {
        const assignedTo = e.assignedTo || e.AssignedTo || '';
        return String(assignedTo) === String(filters.assignedTo);
      });
    }
    
    // Apply stoneType filter
    if (filters.stoneType && filters.stoneType !== 'all') {
      filtered = filtered.filter(e => {
        const stoneType = e.stoneType || e.StoneType || '';
        return stoneType === filters.stoneType;
      });
    }
    
    // Apply metalColor filter
    if (filters.metalColor && filters.metalColor !== 'all') {
      filtered = filtered.filter(e => {
        const metalColor = e.Metal?.Color || e.metal?.color || e.metalColor || '';
        return metalColor === filters.metalColor;
      });
    }
    
    // Apply metalQuality filter
    if (filters.metalQuality && filters.metalQuality !== 'all') {
      filtered = filtered.filter(e => {
        const metalQuality = e.Metal?.Quality || e.metal?.quality || e.metalQuality || '';
        return metalQuality === filters.metalQuality;
      });
    }
    
    // Apply date range filters
    if (filters.shippingDateFrom) {
      filtered = filtered.filter(e => {
        const shippingDate = e.ShippingDate || e.shippingDate || e.deadline;
        if (!shippingDate) return false;
        return new Date(shippingDate) >= new Date(filters.shippingDateFrom);
      });
    }
    if (filters.shippingDateTo) {
      filtered = filtered.filter(e => {
        const shippingDate = e.ShippingDate || e.shippingDate || e.deadline;
        if (!shippingDate) return false;
        return new Date(shippingDate) <= new Date(filters.shippingDateTo);
      });
    }
    if (filters.assignedDateFrom) {
      filtered = filtered.filter(e => {
        const assignedDate = e.AssignedDate || e.assignedDate || e.updatedAt;
        if (!assignedDate) return false;
        return new Date(assignedDate) >= new Date(filters.assignedDateFrom);
      });
    }
    if (filters.assignedDateTo) {
      filtered = filtered.filter(e => {
        const assignedDate = e.AssignedDate || e.assignedDate || e.updatedAt;
        if (!assignedDate) return false;
        return new Date(assignedDate) <= new Date(filters.assignedDateTo);
      });
    }
    if (filters.createdDateFrom) {
      filtered = filtered.filter(e => {
        const createdDate = e.CreatedDate || e.createdDate || e.createdAt;
        if (!createdDate) return false;
        return new Date(createdDate) >= new Date(filters.createdDateFrom);
      });
    }
    if (filters.createdDateTo) {
      filtered = filtered.filter(e => {
        const createdDate = e.CreatedDate || e.createdDate || e.createdAt;
        if (!createdDate) return false;
        return new Date(createdDate) <= new Date(filters.createdDateTo);
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
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      // Handle assignedDate specifically
      if (sortBy === 'assignedDate') {
        aValue = a.AssignedDate || a.assignedDate || a.updatedAt || a.createdAt || '';
        bValue = b.AssignedDate || b.assignedDate || b.updatedAt || b.createdAt || '';
      }
      
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
  }, [enquiries, filters, searchQuery, sortBy, sortOrder, isClient, clientIdForFilter]);
  
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

