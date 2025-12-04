import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeJWT, mapRoleNumberToString, setRolesCache } from '../utils/helpers';
import { API_BASE_URL } from '../config/apiConfig';

// Base query with auth token injection
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: async (headers, { getState }) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
        if (__DEV__) {
          console.log('API Request Headers - Authorization token set:', token.substring(0, 20) + '...');
        }
      } else {
        
      }
    } catch (error) {
    }
    return headers;
  },
});

// Export the main API
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    'Enquiry',
    'Client',
    'Dashboard',
    'MetalPrice',
    'Chat',
    'Message',
    'StatusStatistics',
    'Roles',
    'Statuses',
    'StoneTypes',
    'Notification',
    'DeviceToken',
  ],
  // Prevent memory buildup by removing unused data after 60 seconds
  keepUnusedDataFor: 60,
  endpoints: (builder) => ({
    // ==================== CODE LISTS ====================
    getRoles: builder.query({
      query: () => '/api/codelists/Roles',
      providesTags: ['Roles'],
      transformResponse: (data) => {
        let roles = [];
        
        // Handle array response
        if (Array.isArray(data)) {
          roles = data.map(role => ({
            id: role.Id || role.id,
            code: role.Code || role.code,
            name: role.Name || role.name,
          }));
        }
        // Handle object response with data property
        else if (data?.data && Array.isArray(data.data)) {
          roles = data.data.map(role => ({
            id: role.Id || role.id,
            code: role.Code || role.code,
            name: role.Name || role.name,
          }));
        }
        
        // Update cache for role mapping
        if (roles.length > 0) {
          setRolesCache(roles);
        } else {
        }
        
        return roles;
      },
    }),

    // Get Status list from API
    getStatuses: builder.query({
      query: () => '/api/codelists/Status',
      providesTags: ['Statuses'],
      transformResponse: (data) => {
        let statuses = [];
        console.log('🔍 Data:', data);
        // Handle array response
        if (Array.isArray(data)) {
          statuses = data.map(status => ({
            name: status.name || status.Name || status.code || status.Code,
            label: status.label || status.Label || status.name || status.Name || status.code || status.Code,
          }));
        }
        // Handle object response with data property
        else if (data?.data && Array.isArray(data.data)) {
          statuses = data.data.map(status => ({
            name: status.name || status.Name || status.code || status.Code,
            label: status.label || status.Label || status.name || status.Name || status.code || status.Code,
          }));
        }
        
        return statuses;
      },
    }),

    // Get Stone Types list from API
    getStoneTypes: builder.query({
      query: () => '/api/codelists/StoneTypes',
      providesTags: ['StoneTypes'],
      transformResponse: (data) => {
        let stoneTypes = [];
        
        // Handle array response
        if (Array.isArray(data)) {
          stoneTypes = data.map(stoneType => ({
            label: stoneType.label || stoneType.Label || stoneType.name || stoneType.Name || stoneType.code || stoneType.Code || stoneType.value || stoneType.Value,
            value: stoneType.value || stoneType.Value || stoneType.code || stoneType.Code || stoneType.name || stoneType.Name,
          }));
        }
        // Handle object response with data property
        else if (data?.data && Array.isArray(data.data)) {
          stoneTypes = data.data.map(stoneType => ({
            label: stoneType.label || stoneType.Label || stoneType.name || stoneType.Name || stoneType.code || stoneType.Code || stoneType.value || stoneType.Value,
            value: stoneType.value || stoneType.Value || stoneType.code || stoneType.Code || stoneType.name || stoneType.Name,
          }));
        }
        
        return stoneTypes;
      },
    }),

    // ==================== AUTH ====================
    login: builder.mutation({
      query: ({ email, password }) => {
        
        return {
          url: '/api/login',
          method: 'POST',
          body: { email, password },
        };
      },
      transformResponse: async (response, meta, arg) => {
        try {
          
          
          // Handle different response formats
          let data = response;
          if (typeof response === 'string') {
            try {
              data = JSON.parse(response);
            } catch (e) {
              data = response; // It's just the token string
            }
          }
          
          const token = typeof data === 'string' 
            ? data 
            : data.token || data.accessToken || data.access_token;
          
          if (!token) {
            
            throw new Error('No token received from server');
          }
          
          if (__DEV__) {
            console.log('Token preview:', token.substring(0, 50) + '...');
          }
          
          const decodedToken = decodeJWT(token);
          if (!decodedToken) {
            
            throw new Error('Failed to decode authentication token');
          }
          
          if (__DEV__) {
            console.log('All token fields:', Object.keys(decodedToken));
          }
          
          // Try different case variations for role
          const roleNumber = decodedToken.Role || decodedToken.role || decodedToken.RoleNumber || decodedToken.roleNumber;
          console.log('🔐 Token fields:', Object.keys(decodedToken));
          
          if (roleNumber === undefined || roleNumber === null) {
            throw new Error(`Role not found in token. Available fields: ${Object.keys(decodedToken).join(', ')}`);
          }
          
          const roleString = mapRoleNumberToString(roleNumber);
          
          if (!roleString) {
            throw new Error(`Unknown role: ${roleNumber}. Expected 1-4.`);
          }
          
          
          // Try different case variations for ID
          const userId = decodedToken.Id || decodedToken.id || decodedToken.userId || decodedToken.UserId;
          
          // Try different case variations for name
          const userName = decodedToken.Name || decodedToken.name || decodedToken.username || decodedToken.Username || 
                          decodedToken.fullName || decodedToken.FullName || decodedToken.firstName || decodedToken.FirstName;
          
          // Extract ClientId from token (for role 4 - Client users)
          const clientId = decodedToken.ClientId || decodedToken.clientId || decodedToken.ClientID || decodedToken.clientID;
          
          if (__DEV__) {
            console.log('🔐 [LOGIN] All token fields:', Object.keys(decodedToken));
            console.log('🔐 [LOGIN] Decoded token:', JSON.stringify(decodedToken, null, 2));
            if (roleNumber === 4) {
              console.log('🔐 [LOGIN] Client user (Role 4) detected');
              console.log('🔐 [LOGIN] ClientId from token:', clientId);
              if (!clientId) {
                console.warn('⚠️ [LOGIN] WARNING: ClientId not found in token for Role 4 user!');
                console.warn('⚠️ [LOGIN] Token fields available:', Object.keys(decodedToken));
              }
            }
          }
          
          return {
            success: true,
            token,
            user: {
              id: userId,
              role: roleString,
              roleNumber: roleNumber, // Store role ID for filtering
              roleId: roleNumber, // Alias for consistency
              name: userName, // Extract name from token
              clientId: clientId, // Store ClientId for role 4 users
              iat: decodedToken.iat,
            },
          };
        } catch (error) {
          
          throw new Error(error.message || 'Login failed');
        }
      },
      transformErrorResponse: (response) => {
        
        
        // Provide helpful error messages for common network issues
        let errorMessage = 'Login failed';
        if (response.status === 'FETCH_ERROR' || response.error?.includes('Network request failed')) {
          errorMessage = `Cannot connect to server at ${API_BASE_URL}. Please check:\n\n1. Backend server is running\n2. Server is on port 3000\n3. For Android emulator, use 10.0.2.2:3000\n4. For physical device, use your computer's IP address`;
        } else {
          errorMessage = response.data?.message || response.data?.error || response.error || `Login failed (${response.status || 'Unknown error'})`;
        }
        
        return {
          success: false,
          error: errorMessage,
        };
      },
    }),

    // Create user/register endpoint
    createUser: builder.mutation({
      query: ({ email, password, roleNumber, name }) => ({
        url: '/api/users',
        method: 'POST',
        body: { email, password, roleNumber, name },
      }),
      transformResponse: (response) => {
        return {
          success: true,
          user: response.user || response,
          message: response.message || 'User created successfully',
        };
      },
      transformErrorResponse: (response) => {
        return {
          success: false,
          error: response.data?.message || response.data?.error || 'Failed to create user',
        };
      },
    }),

    // Get user by ID endpoint
    getUserById: builder.query({
      query: (userId) => `/api/users/${userId}`,
      transformResponse: (response) => {
        // Handle different response formats
        const user = response.user || response;
        return {
          id: user._id || user.id,
          name: user.name || user.Name,
          email: user.email || user.Email,
          phone: user.phone || user.Phone,
          role: user.role || user.Role,
          ...user,
        };
      },
      transformErrorResponse: (response) => {
        return {
          error: response.data?.message || response.data?.error || 'Failed to fetch user',
        };
      },
    }),

    // Get users list endpoint
    getUsers: builder.query({
      query: () => '/api/users',
      transformResponse: (data) => {
        let usersArray = [];
        if (Array.isArray(data)) {
          usersArray = data;
        } else if (data.users && Array.isArray(data.users)) {
          usersArray = data.users;
        } else if (data.data && Array.isArray(data.data)) {
          usersArray = data.data;
        } else {
          return [];
        }

        return usersArray.map(user => ({
          id: user._id || user.id || user.Id,
          name: user.name || user.Name || 'Unnamed User',
          email: user.email || user.Email || 'N/A',
          phone: user.phone || user.Phone || 'N/A',
          role: user.role || user.Role || 'user',
          ...user,
        }));
      },
    }),

    // ==================== ENQUIRIES ====================
    getEnquiries: builder.query({
      query: (arg) => {
        // Support both object format { role, page, search, limit, assignedTo } and simple role string
        const role = typeof arg === 'object' ? arg?.role : arg;
        const page = typeof arg === 'object' ? (arg?.page || 1) : 1;
        const search = typeof arg === 'object' ? arg?.search : undefined;
        const limit = typeof arg === 'object' ? arg?.limit : undefined;
        const assignedTo = typeof arg === 'object' ? arg?.assignedTo : undefined;
        const filters = typeof arg === 'object' ? arg?.filters : undefined;
        
        // Build query string
        let queryString = `page=${page}`;
        if (limit) {
          queryString += `&limit=${limit}`;
        }
        if (search && search.trim()) {
          queryString += `&search=${encodeURIComponent(search.trim())}`;
        }
        // Add assignedTo filter ONLY for non-admin users
        // CRITICAL: Never add assignedTo for admins - they must see ALL enquiries
        // Check if role is admin (case-insensitive) to ensure no assignedTo filter
        const isAdminRole = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'ad';
        if (assignedTo && !isAdminRole) {
          queryString += `&assignedTo=${encodeURIComponent(assignedTo)}`;
        } else if (isAdminRole && assignedTo) {
          // Safety check: if somehow assignedTo is set for admin, log warning and don't add it
          if (__DEV__) {
            console.warn('⚠️ WARNING: assignedTo was set for admin user, ignoring it to show all enquiries');
            console.warn('⚠️ Role:', role, 'AssignedTo:', assignedTo);
          }
        }
        
        // For client users, backend should filter enquiries automatically
        // If no clientId filter is provided, backend should filter by user role
        const isClientRole = role === 'client' || role === 'CL';
        const argUserId = typeof arg === 'object' ? arg?.userId : undefined;
        
        // For client users without a clientId, backend should filter by:
        // 1. Enquiries where clientId matches any client record
        // 2. OR enquiries created by this user (if createdBy field exists)
        // 3. OR backend should handle client filtering based on user role
        
        // Add filter parameters
        if (filters) {
          if (filters.status && filters.status !== 'all') {
            queryString += `&status=${encodeURIComponent(filters.status)}`;
          }
          if (filters.category && filters.category !== 'all') {
            queryString += `&category=${encodeURIComponent(filters.category)}`;
          }
          if (filters.priority && filters.priority !== 'all') {
            queryString += `&priority=${encodeURIComponent(filters.priority)}`;
          }
          if (filters.clientId && filters.clientId !== 'all') {
            queryString += `&clientId=${encodeURIComponent(filters.clientId)}`;
          } else if (isClientRole && argUserId && (!filters.clientId || filters.clientId === 'all')) {
            // Fallback: For client users without a clientId filter, use userId as clientId
            console.log('🔐 ========== API CLIENT FILTER (FALLBACK) ==========');
            queryString += `&clientId=${encodeURIComponent(argUserId)}`;
          }
          if (filters.assignedTo && filters.assignedTo !== 'all') {
            queryString += `&assignedTo=${encodeURIComponent(filters.assignedTo)}`;
          }
          if (filters.stoneType && filters.stoneType !== 'all') {
            queryString += `&stoneType=${encodeURIComponent(filters.stoneType)}`;
          }
          if (filters.metalColor && filters.metalColor !== 'all') {
            queryString += `&metalColor=${encodeURIComponent(filters.metalColor)}`;
          }
          if (filters.metalQuality && filters.metalQuality !== 'all') {
            queryString += `&metalQuality=${encodeURIComponent(filters.metalQuality)}`;
          }
          if (filters.shippingDateFrom) {
            queryString += `&shippingDateFrom=${encodeURIComponent(filters.shippingDateFrom)}`;
          }
          if (filters.shippingDateTo) {
            queryString += `&shippingDateTo=${encodeURIComponent(filters.shippingDateTo)}`;
          }
          if (filters.assignedDateFrom) {
            queryString += `&assignedDateFrom=${encodeURIComponent(filters.assignedDateFrom)}`;
          }
          if (filters.assignedDateTo) {
            queryString += `&assignedDateTo=${encodeURIComponent(filters.assignedDateTo)}`;
          }
          if (filters.createdDateFrom) {
            queryString += `&createdDateFrom=${encodeURIComponent(filters.createdDateFrom)}`;
          }
          if (filters.createdDateTo) {
            queryString += `&createdDateTo=${encodeURIComponent(filters.createdDateTo)}`;
          }
          if (filters.sortBy) {
            queryString += `&sortBy=${encodeURIComponent(filters.sortBy)}`;
          }
          if (filters.sortOrder) {
            queryString += `&sortOrder=${encodeURIComponent(filters.sortOrder)}`;
          }
        } else {
          // Even if no filters, ensure default sort is applied for consistent ordering
          queryString += `&sortBy=createdAt&sortOrder=asc`;
        }
        
        const finalUrl = `/api/enquiries/search?${queryString}`;
        return finalUrl;
      },
      providesTags: ['Enquiry'],
      transformResponse: (data, meta, arg) => {
        const role = typeof arg === 'object' ? arg?.role : arg;
        const argUserId = typeof arg === 'object' ? arg?.userId : undefined;
        const isClientRole = role === 'client' || role === 'CL';
        if (isClientRole) {
        }
        
        // Handle paginated response format from new aggregated endpoint
        // Response structure: { data: [...], total: number, page: number, limit: number }
        let enquiriesArray = [];
        let pagination = {
          total: 0,
          page: 1,
          limit: 25,
          totalPages: 1,
        };
        
        if (data && typeof data === 'object') {
          if (data.data && Array.isArray(data.data)) {
            enquiriesArray = data.data;
            pagination = {
              total: data.total || data.Total || 0,
              page: data.page || data.Page || 1,
              limit: data.limit || data.Limit || 25,
              totalPages: Math.ceil((data.total || data.Total || 0) / (data.limit || data.Limit || 25)),
            };
            // Log for client users
            if (isClientRole && argUserId) {
              if (enquiriesArray.length > 0) {
                console.log('📥 Sample enquiry ClientIds:', enquiriesArray.slice(0, 5).map(e => ({
                  id: e.id || e._id,
                  clientId: e.clientId || e.ClientId,
                  name: e.Name || e.name
                })));
                // Check if any enquiries match the expected ClientId
                const matchingCount = enquiriesArray.filter(e => {
                  const enquiryClientId = e.clientId || e.ClientId || '';
                  return String(enquiryClientId).trim() === String(argUserId).trim();
                }).length;
                console.log('📥 Matching enquiries (ClientId = user.id):', matchingCount, 'out of', enquiriesArray.length);
                if (matchingCount === 0 && enquiriesArray.length > 0) {
                  console.warn('📥 ⚠️ All enquiry ClientIds:', enquiriesArray.map(e => e.clientId || e.ClientId).filter(Boolean).slice(0, 10));
                }
              } else {
              }
            }
          } else if (Array.isArray(data)) {
            enquiriesArray = data;
          } else if (data.enquiries && Array.isArray(data.enquiries)) {
            enquiriesArray = data.enquiries;
          } else {
            return { data: [], pagination };
          }
        } else if (Array.isArray(data)) {
          enquiriesArray = data;
        } else {
          return { data: [], pagination };
        }
        
        // Normalize enquiry data from aggregated endpoint
        const normalizedEnquiries = enquiriesArray.map((enquiry, index) => {
          // Debug: Log first enquiry before normalization
          if (__DEV__ && index === 0) {
            console.log('🔍 ========== API NORMALIZATION DEBUG ==========');
            console.log('🔍 Raw first enquiry _id:', enquiry._id);
            console.log('🔍 Raw first enquiry Name:', enquiry.Name);
            console.log('🔍 Raw first enquiry AssignedTo:', enquiry.AssignedTo);
            console.log('🔍 Raw first enquiry ClientId:', enquiry.ClientId);
            console.log('🔍 Raw first enquiry CurrentStatus:', enquiry.CurrentStatus);
            console.log('🔍 ==============================================');
          }
          
          // Use CurrentStatus directly from aggregated response
          const currentStatus = enquiry.CurrentStatus || enquiry.Status || 'pending';
          const createdAt = enquiry.CreatedDate || enquiry.CreatedAt || new Date().toISOString();
          const updatedAt = enquiry.AssignedDate || enquiry.UpdatedAt || createdAt;
          
          // Normalize priority
          let normalizedPriority = 'medium';
          const priority = (enquiry.Priority || enquiry.priority || '').toLowerCase();
          if (priority.includes('urgent') || priority === 'high' || priority === 'super high') {
            normalizedPriority = 'high';
          } else if (priority === 'low') {
            normalizedPriority = 'low';
          } else {
            normalizedPriority = 'medium';
          }
          
          // Normalize status from CurrentStatus field
          let normalizedStatus = 'pending';
          const status = currentStatus.toLowerCase();
          if (status === 'enquiry created' || status === 'pending' || status.includes('pending')) {
            normalizedStatus = 'pending';
          } else if (status.includes('completed') || status.includes('approved')) {
            normalizedStatus = 'completed';
          } else if (status.includes('rejected')) {
            normalizedStatus = 'rejected';
          } else {
            // For statuses like coral, cad, progress, etc., normalize to pending
            normalizedStatus = 'pending';
          }
          
          // Extract metal type info
          const metalColor = enquiry.Metal?.Color || enquiry.metal?.color || '';
          const metalQuality = enquiry.Metal?.Quality || enquiry.metal?.quality || '';
          const metalType = metalColor ? `${metalColor}${metalQuality ? ` (${metalQuality})` : ''}` : 'N/A';
          
          // Get budget from Coral pricing (if available in aggregated response)
          let budget = 0;
          if (enquiry.Coral && Array.isArray(enquiry.Coral) && enquiry.Coral.length > 0) {
            const latestCoral = enquiry.Coral[enquiry.Coral.length - 1];
            if (latestCoral.Pricing?.TotalPrice) {
              budget = latestCoral.Pricing.TotalPrice;
            }
          }
          
          // Extract client name if available (may need to be enriched from clients API)
          const clientName = enquiry.ClientName || enquiry.clientName || 'Unknown Client';
          
          const normalized = {
            id: enquiry._id || enquiry.id,
            title: enquiry.Name || enquiry.name || enquiry.title || 'Untitled Enquiry',
            clientId: enquiry.ClientId || enquiry.clientId || '',
            clientName: clientName,
            status: normalizedStatus,
            priority: normalizedPriority,
            description: enquiry.Remarks || enquiry.remarks || enquiry.description || '',
            createdAt: createdAt,
            updatedAt: updatedAt,
            deadline: enquiry.ShippingDate || enquiry.deadline || enquiry.Deadline || null,
            budget: budget,
            category: enquiry.Category || enquiry.category || 'Other',
            metalType: metalType,
            stoneType: enquiry.StoneType || enquiry.stoneType || 'N/A',
            // Preserve original API fields for editing
            Name: enquiry.Name,
            Remarks: enquiry.Remarks,
            Priority: enquiry.Priority,
            Quantity: enquiry.Quantity,
            Metal: enquiry.Metal,
            MetalWeight: enquiry.MetalWeight,
            DiamondWeight: enquiry.DiamondWeight,
            Stamping: enquiry.Stamping,
            StyleNumber: enquiry.StyleNumber,
            GatiOrderNumber: enquiry.GatiOrderNumber,
            Category: enquiry.Category,
            StoneType: enquiry.StoneType,
            ShippingDate: enquiry.ShippingDate,
            ClientId: enquiry.ClientId,
            AssignedTo: enquiry.AssignedTo,
            AssignedDate: enquiry.AssignedDate,
            CurrentStatus: enquiry.CurrentStatus,
            CreatedDate: enquiry.CreatedDate,
            ReferenceImages: enquiry.ReferenceImages || [],
            CoralCode: enquiry.CoralCode,
            CadCode: enquiry.CadCode,
            _originalData: enquiry,
          };
          
          // Debug: Log first enquiry after normalization
          if (__DEV__ && index === 0) {
            console.log('🔍 ========== AFTER NORMALIZATION ==========');
            console.log('🔍 Normalized first enquiry id:', normalized.id);
            console.log('🔍 Normalized first enquiry title:', normalized.title);
            console.log('🔍 Normalized first enquiry AssignedTo:', normalized.AssignedTo);
            console.log('🔍 Has valid id?', !!normalized.id);
            console.log('🔍 =========================================');
          }
          
          return normalized;
        });
        
        // Return both data and pagination metadata
        return {
          data: normalizedEnquiries,
          pagination,
        };
      },
    }),

    getEnquiryById: builder.query({
      query: (id) => `/api/enquiries/${id}`,
      providesTags: (result, error, id) => {
        // Only provide tags if result is not null/error
        if (result && result.id && !result.error) {
          // Provide both specific tag (for this enquiry) and general tag (for all enquiries)
          // This ensures cache invalidation works when updateEnquiry invalidates 'Enquiry' tag
          return [
            { type: 'Enquiry', id },
            'Enquiry', // General tag so that any Enquiry invalidation triggers refetch
          ];
        }
        return [];
      },
      transformResponse: async (enquiry, meta, arg) => {
        // Handle null/undefined enquiry or error responses
        if (!enquiry || enquiry === null || typeof enquiry !== 'object') {
          
          // Return a minimal object structure to prevent crashes
          return {
            id: null,
            title: 'Enquiry not found',
            clientName: 'Unknown Client',
            status: 'pending',
            priority: 'medium',
            description: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            error: true,
          };
        }

        // Additional safety check - ensure enquiry has expected structure
        try {
        // Same normalization logic as getEnquiries for single enquiry
        let currentStatus = 'pending';
        let createdAt = new Date().toISOString();
        let updatedAt = new Date().toISOString();
        
        // Use optional chaining for safe property access
        if (enquiry?.StatusHistory && Array.isArray(enquiry.StatusHistory) && enquiry.StatusHistory.length > 0) {
          const sortedHistory = [...enquiry.StatusHistory].sort((a, b) => 
            new Date(b.Timestamp || b.timestamp || 0) - new Date(a.Timestamp || a.timestamp || 0)
          );
          const latestStatus = sortedHistory[0];
          currentStatus = latestStatus.Status || latestStatus.status || 'pending';
          updatedAt = latestStatus.Timestamp || latestStatus.timestamp || updatedAt;
          
          const firstStatus = sortedHistory[sortedHistory.length - 1];
          createdAt = firstStatus.Timestamp || firstStatus.timestamp || createdAt;
        }
        
        let normalizedPriority = 'medium';
        const priority = ((enquiry?.Priority || enquiry?.priority || '')).toLowerCase();
        if (priority.includes('urgent') || priority === 'high') {
          normalizedPriority = 'high';
        } else if (priority === 'low') {
          normalizedPriority = 'low';
        } else {
          normalizedPriority = 'medium';
        }
        
        let normalizedStatus = 'pending';
        const status = currentStatus.toLowerCase();
        if (status === 'enquiry created' || status === 'pending') {
          normalizedStatus = 'pending';
        } else if (status.includes('completed') || status.includes('approved')) {
          normalizedStatus = 'completed';
        } else if (status.includes('rejected')) {
          normalizedStatus = 'rejected';
          } else {
            // For statuses like coral, cad, progress, etc., normalize to pending
            normalizedStatus = 'pending';
        }
        
        const metalColor = enquiry?.Metal?.Color || enquiry?.metal?.color || '';
        const metalQuality = enquiry?.Metal?.Quality || enquiry?.metal?.quality || '';
        const metalType = metalColor ? `${metalColor}${metalQuality ? ` (${metalQuality})` : ''}` : 'N/A';
        
        let budget = 0;
        if (enquiry?.Coral && Array.isArray(enquiry.Coral) && enquiry.Coral.length > 0) {
          const latestCoral = enquiry.Coral[enquiry.Coral.length - 1];
          if (latestCoral?.Pricing?.TotalPrice) {
            budget = latestCoral.Pricing.TotalPrice;
          }
        }
        
        // Get client name
        let clientName = 'Unknown Client';
        if (enquiry?.ClientName || enquiry?.clientName) {
          clientName = enquiry.ClientName || enquiry.clientName;
        }
        
        // Normalize images
        const normalizeImages = (imageArray) => {
          if (!Array.isArray(imageArray)) return [];
          
          return imageArray.map((img) => {
            if (typeof img === 'string') return img;
            if (typeof img === 'object' && img !== null) {
              if (img.Url || img.url || img.URI || img.uri) {
                return img.Url || img.url || img.URI || img.uri;
              }
              return img;
            }
            return null;
          }).filter(img => img !== null && img !== '');
        };
        
        let images = [];
        if (enquiry?.ReferenceImages && Array.isArray(enquiry.ReferenceImages) && enquiry.ReferenceImages.length > 0) {
          images = normalizeImages(enquiry.ReferenceImages);
        } else if (enquiry?.Images && Array.isArray(enquiry.Images) && enquiry.Images.length > 0) {
          images = normalizeImages(enquiry.Images);
        } else if (enquiry?.images && Array.isArray(enquiry.images) && enquiry.images.length > 0) {
          images = normalizeImages(enquiry.images);
        }
        
        if (images.length === 0 && enquiry?.Coral && Array.isArray(enquiry.Coral) && enquiry.Coral.length > 0) {
          const latestCoral = enquiry.Coral[enquiry.Coral.length - 1];
          if (latestCoral?.Images && Array.isArray(latestCoral.Images) && latestCoral.Images.length > 0) {
            images = normalizeImages(latestCoral.Images);
          }
        }
        
        if (images.length === 0 && enquiry?.Cad && Array.isArray(enquiry.Cad) && enquiry.Cad.length > 0) {
          const latestCad = enquiry.Cad[enquiry.Cad.length - 1];
          if (latestCad?.Images && Array.isArray(latestCad.Images) && latestCad.Images.length > 0) {
            images = normalizeImages(latestCad.Images);
          }
        }
        
        return {
          id: enquiry?._id || enquiry?.id || null,
          title: enquiry?.Name || enquiry?.name || enquiry?.title || 'Untitled Enquiry',
          clientId: enquiry?.ClientId || enquiry?.clientId || '',
          clientName: clientName,
          client: clientName,
          status: normalizedStatus,
          priority: normalizedPriority,
          description: enquiry?.Remarks || enquiry?.remarks || enquiry?.description || '',
          createdAt: createdAt,
          updatedAt: updatedAt,
          deadline: enquiry?.ShippingDate || enquiry?.deadline || enquiry?.Deadline || null,
          budget: budget,
          estimatedPrice: budget,
          category: enquiry?.Category || enquiry?.category || 'Other',
          metalType: metalType,
          stoneType: enquiry?.StoneType || enquiry?.stoneType || 'N/A',
          images: images,
          coralVersion: enquiry?.CoralCode || enquiry?.coralCode || (enquiry?.Coral?.length > 0 ? enquiry.Coral[enquiry.Coral.length - 1]?.Code : null),
          cadVersion: enquiry?.CadCode || enquiry?.cadCode || (enquiry?.Cad?.length > 0 ? enquiry.Cad[enquiry.Cad.length - 1]?.Code : null),
          // Preserve original API fields
          Name: enquiry?.Name,
          Remarks: enquiry?.Remarks,
          Priority: enquiry?.Priority,
          Quantity: enquiry?.Quantity,
          Metal: enquiry?.Metal,
          MetalWeight: enquiry?.MetalWeight,
          DiamondWeight: enquiry?.DiamondWeight,
          Stamping: enquiry?.Stamping,
          StyleNumber: enquiry?.StyleNumber,
          GatiOrderNumber: enquiry?.GatiOrderNumber,
          Category: enquiry?.Category,
          StoneType: enquiry?.StoneType,
          ShippingDate: enquiry?.ShippingDate,
          ClientId: enquiry?.ClientId,
          AssignedTo: enquiry?.AssignedTo,
          CoralCode: enquiry?.CoralCode,
          CadCode: enquiry?.CadCode,
          // CRITICAL: Preserve Coral and Cad arrays with Pricing data
          Coral: enquiry?.Coral || [],
          Cad: enquiry?.Cad || [],
          _originalData: enquiry,
        };
        } catch (transformError) {
          // Return fallback object if transformation fails
          return {
            id: enquiry._id || enquiry.id || null,
            title: enquiry.Name || enquiry.name || enquiry.title || 'Untitled Enquiry',
            clientName: enquiry.ClientName || enquiry.clientName || 'Unknown Client',
            status: 'pending',
            priority: 'medium',
            description: enquiry.Remarks || enquiry.remarks || enquiry.description || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            error: true,
            // CRITICAL: Preserve Coral and Cad arrays with Pricing data even in error case
            Coral: enquiry?.Coral || [],
            Cad: enquiry?.Cad || [],
            _originalData: enquiry,
          };
        }
      },
      transformErrorResponse: (response, meta, arg) => {
        // Handle API errors (404, 500, etc.)
        
        return {
          error: true,
          message: response.data?.error || response.data?.message || 'Failed to load enquiry',
          status: response.status,
        };
      },
    }),

    createEnquiry: builder.mutation({
      queryFn: async (data, { dispatch }, extraOptions, baseQuery) => {
        console.log('🌐 Timestamp:', new Date().toISOString());
        console.log('🌐 Request Payload:', JSON.stringify(data, null, 2));
        console.log('🌐 Payload Size:', JSON.stringify(data).length, 'bytes');
        console.log('🌐 Payload Summary:', {
          'Name': data.Name,
          'ClientId': data.ClientId,
          'Priority': data.Priority,
          'Category': data.Category,
          'StoneType': data.StoneType,
          'Quantity': data.Quantity,
          'Has Reference Images': !!data.ReferenceImages,
          'Reference Images Count': data.ReferenceImages?.length || 0,
          'Has Metal Weight': !!(data.MetalWeight?.From || data.MetalWeight?.To || data.MetalWeight?.Exact),
          'Has Diamond Weight': !!(data.DiamondWeight?.From || data.DiamondWeight?.To || data.DiamondWeight?.Exact),
        });
        
        try {
          const result = await baseQuery({
            url: '/api/enquiries',
            method: 'POST',
            body: data,
          });
          
          if (result.error) {
            console.error('❌ API Error Response:', JSON.stringify(result.error, null, 2));
            return result;
          }
          
          console.log('✅ API Success Response:', JSON.stringify(result.data, null, 2));
          console.log('✅ Response Summary:', {
            'Status': 'Success',
            'Enquiry ID': result.data?.id || result.data?._id || 'Not returned',
            'Name': result.data?.Name || result.data?.name || data.Name,
          });
          
          return result;
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', data: error.message } };
        }
      },
      invalidatesTags: ['Enquiry', 'Dashboard'],
    }),

    updateEnquiry: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/api/enquiries/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Enquiry', id },
        'Enquiry',
        'Dashboard',
      ],
    }),

    deleteEnquiry: builder.mutation({
      query: (id) => ({
        url: `/api/enquiries/${id}`,
        method: 'DELETE',
      }),
      // Optimistic update: Remove enquiry from cache immediately
      onQueryStarted: async (id, { dispatch, queryFulfilled, getState }) => {
        // Optimistically remove from enquiries list cache
        const patchResult = dispatch(
          api.util.updateQueryData('getEnquiries', undefined, (draft) => {
            if (Array.isArray(draft)) {
              const index = draft.findIndex(e => (e.id || e._id) === id);
              if (index !== -1) {
                draft.splice(index, 1);
              }
            }
          })
        );

        // Also try to update role-specific queries
        try {
          const state = getState();
          const authState = state.auth;
          const role = authState?.user?.role || 'admin';
          
          // Update role-specific query cache
          dispatch(
            api.util.updateQueryData('getEnquiries', role, (draft) => {
              if (Array.isArray(draft)) {
                const index = draft.findIndex(e => (e.id || e._id) === id);
                if (index !== -1) {
                  draft.splice(index, 1);
                }
              }
            })
          );
        } catch (e) {
          // Ignore if role-specific query doesn't exist in cache
        }

        try {
          await queryFulfilled;
          // Success - only invalidate dashboard to refresh stats
          dispatch(api.util.invalidateTags(['Dashboard']));
        } catch (error) {
          // Rollback on error
          patchResult.undo();
          // Still invalidate tags to ensure consistency
          dispatch(api.util.invalidateTags(['Enquiry', 'Dashboard']));
        }
      },
      // Fallback invalidation (only if optimistic update fails)
      invalidatesTags: (result, error, id) => {
        // Only invalidate if mutation failed (optimistic update will handle success)
        if (error) {
          return [{ type: 'Enquiry', id }, 'Enquiry', 'Dashboard'];
        }
        return ['Dashboard']; // Only refresh dashboard stats
      },
    }),

    // ==================== CLIENTS ====================
    getClients: builder.query({
      query: () => '/api/clients',
      providesTags: ['Client'],
      transformResponse: (data) => {
        let clientsArray = [];
        if (Array.isArray(data)) {
          clientsArray = data;
        } else if (data.clients && Array.isArray(data.clients)) {
          clientsArray = data.clients;
        } else if (data.data && Array.isArray(data.data)) {
          clientsArray = data.data;
        } else {
          return [];
        }
        
        return clientsArray.map(client => ({
          id: client.Id || client.id || client._id,
          _id: client._id || client.Id || client.id, // Also store _id for compatibility
          name: client.Name || client.name || 'Unknown Client',
          email: client.Email || client.email || 'N/A',
          phone: client.Phone || client.phone || 'N/A',
          totalOrders: client.TotalOrders || client.totalOrders || 0,
          totalSpent: client.TotalSpent || client.totalSpent || 0,
          lastOrder: client.LastOrder || client.lastOrder || null,
          imageUrl: client.ImageUrl || client.imageUrl || client.Image || client.image || client.Logo || client.logo || null,
        }));
      },
    }),

    createClient: builder.mutation({
      query: ({ Name, ImageUrl, Pricing }) => ({
        url: '/api/clients',
        method: 'POST',
        body: { 
          Name,
          ...(ImageUrl && { ImageUrl }),
          ...(Pricing && { Pricing }),
        },
      }),
      invalidatesTags: ['Client'],
      transformResponse: (response) => {
        return {
          success: true,
          client: response.client || response,
          message: response.message || 'Client created successfully',
        };
      },
      transformErrorResponse: (response) => {
        return {
          success: false,
          error: response.data?.message || response.data?.error || 'Failed to create client',
        };
      },
    }),

    getClientById: builder.query({
      query: (clientId) => `/api/clients/${clientId}`,
      providesTags: (result, error, clientId) => [{ type: 'Client', id: clientId }],
    }),

    updateClientPricing: builder.mutation({
      query: ({ clientId, ...data }) => ({
        url: `/api/clients/${clientId}`,
        method: 'PUT',
        body: {
          Id: clientId,
          ...data,
        },
      }),
      invalidatesTags: (result, error, { clientId }) => [
        { type: 'Client', id: clientId },
        'Client',
        // Also invalidate all Enquiry caches since pricing affects enquiry pricing calculations
        'Enquiry',
        // Invalidate Dashboard cache as it may show pricing-related data
        'Dashboard',
      ],
    }),

    // ==================== STATUS STATISTICS ====================
    getStatusStatistics: builder.query({
      queryFn: async (arg, { dispatch }, extraOptions, baseQuery) => {
        try {
          // Fetch all status counts using aggregate endpoint without assignedTo filter
          const aggregateUrl = '/api/enquiries/aggregate?groupBy=status';
          
          
          
          const response = await baseQuery(aggregateUrl);
          
          if (__DEV__) {
            console.log('📊 [STATUS STATS API] Response:', JSON.stringify(response, null, 2));
          }
          
          if (response.error) {
            
            return {
              error: {
                status: response.error.status || 'FETCH_ERROR',
                data: response.error.data || 'Failed to fetch status statistics',
              },
            };
          }

          const statusStats = Array.isArray(response.data) ? response.data : [];
          
          if (__DEV__) {
            console.log('📊 [STATUS STATS API] Total Count:', statusStats.reduce((sum, item) => sum + (item.count || 0), 0));
          }
          
          return {
            data: {
              statusStats,
              total: statusStats.reduce((sum, item) => sum + (item.count || 0), 0),
            },
          };
        } catch (error) {
          
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: error.message || 'Failed to fetch status statistics',
            },
          };
        }
      },
      providesTags: ['StatusStatistics'],
    }),

    // ==================== DASHBOARD ====================
    // Dashboard data is computed from aggregate endpoints
    // Uses /api/enquiries/aggregate?groupBy=status and groupBy=client
    getDashboardData: builder.query({
      queryFn: async (arg, { dispatch, getState }, extraOptions, baseQuery) => {
        try {
          // Extract role, userId, and clientId from argument
          const role = typeof arg === 'object' ? arg?.role : arg;
          const userId = typeof arg === 'object' ? arg?.userId : undefined;
          const clientId = typeof arg === 'object' ? arg?.clientId : undefined;
          
          const isAdmin = role === 'admin' || role === 'AD';
          const isClient = role === 'client' || role === 'CL' || role === 4;
          const roleNumber = typeof arg === 'object' ? arg?.roleNumber || arg?.roleId : undefined;
          const isClientRole = isClient || roleNumber === 4;
          
          // For Client users (role 4), use ClientId from token, not userId
          const clientFilterId = isClientRole && clientId ? clientId : (isClientRole ? userId : undefined);
          
          if (__DEV__ && isClientRole) {
            console.log('🔐 [DASHBOARD] Client user detected:', {
              role,
              roleNumber,
              userId,
              clientId,
              clientFilterId,
            });
            if (!clientFilterId) {
              console.error('❌ [DASHBOARD] ERROR: clientFilterId is missing!');
              console.error('❌ [DASHBOARD] clientId from arg:', clientId);
              console.error('❌ [DASHBOARD] userId from arg:', userId);
            }
          }
          
          // Build aggregate URLs
          // For status counts: use aggregate endpoint with appropriate filters
          let statusAggregateUrl;
          if (isAdmin) {
            // Admin: Get all status counts
            statusAggregateUrl = '/api/enquiries/aggregate?groupBy=status';
          } else if (isClientRole && clientFilterId) {
            // Client: Filter by ClientId from token
            statusAggregateUrl = `/api/enquiries/aggregate?groupBy=status&clientId=${encodeURIComponent(clientFilterId)}`;
            if (__DEV__) {
              console.log('🔐 [DASHBOARD] Using ClientId filter:', clientFilterId);
              console.log('🔐 [DASHBOARD] Full API URL:', statusAggregateUrl);
            }
          } else {
            // Coral/CAD: Filter by assignedTo
            statusAggregateUrl = `/api/enquiries/aggregate?groupBy=status&assignedTo=${encodeURIComponent(userId)}`;
          }
          
          // For client counts: only for admin users
          const clientAggregateUrl = isAdmin ? '/api/enquiries/aggregate?groupBy=client' : null;
          
          // Fetch data in parallel
          const fetchPromises = [
            baseQuery(statusAggregateUrl),
            clientAggregateUrl ? baseQuery(clientAggregateUrl) : Promise.resolve({ data: null }),
            role === 'admin' ? baseQuery('/api/clients') : Promise.resolve({ data: [] }),
          ];
          
          // For revenue calculation, we still need some enquiry data
          // Fetch a reasonable limit of enquiries and filter client-side for completed ones
          let enquiriesSearchUrl;
          if (isAdmin) {
            // For admin, fetch a reasonable number of enquiries for revenue calculation
            enquiriesSearchUrl = '/api/enquiries/search?page=1&limit=1000';
          } else if (isClientRole && clientFilterId) {
            // Client: Use ClientId from token
            enquiriesSearchUrl = `/api/enquiries/search?page=1&limit=100&clientId=${encodeURIComponent(clientFilterId)}`;
            if (__DEV__) {
              console.log('🔐 [DASHBOARD] Enquiries search using ClientId:', clientFilterId);
            }
          } else {
            enquiriesSearchUrl = `/api/enquiries/search?page=1&limit=100&assignedTo=${encodeURIComponent(userId)}`;
          }
          
          fetchPromises.push(baseQuery(enquiriesSearchUrl));
          
          const [statusAggregateResult, clientAggregateResult, clientsResult, enquiriesResult] = await Promise.all(fetchPromises);

          // Handle status aggregate response and categorize
          let categorizedCounts = {
            'Pending': 0,
            'Approval Pending': 0,
            'Completed': 0,
            'All': 0,
          };
          
          // Legacy status counts for backward compatibility
          let statusCounts = {
            pending: 0,
            completed: 0,
            rejected: 0,
            total: 0,
          };
          
          // Process status aggregate data for ALL users (including admin)
          // Also track specific status counts for designers (Coral, CAD, etc.)
          const specificStatusCounts = {};
          
          if (statusAggregateResult.data && !statusAggregateResult.error) {
            const aggregateData = statusAggregateResult.data;
            
            console.log('🔍 [DASHBOARD DEBUG] Status Aggregate API Response:', JSON.stringify(aggregateData, null, 2));
            
            // Handle different response formats
            if (Array.isArray(aggregateData)) {
              
              aggregateData.forEach((item, index) => {
                const statusName = (item.name || item.status || item.Status || item._id || item.group || '').toUpperCase();
                const statusNameLower = statusName.toLowerCase();
                const count = item.count || item.Count || item.value || item.total || 0;
                
                // Store specific status counts for designers
                specificStatusCounts[statusNameLower] = count;
                
                console.log(`🔍 [DASHBOARD DEBUG] Item ${index + 1}:`, {
                  rawItem: item,
                  statusName,
                  count,
                  itemKeys: Object.keys(item)
                });
                
                // Categorize status into Pending, Approval Pending, or Completed
                let category = 'Pending';
                if (statusName.includes('APPROVAL') && !statusName.includes('APPROVED')) {
                  category = 'Approval Pending';
                } else if (statusName.includes('APPROVED') || statusName.includes('COMPLETED')) {
                  category = 'Completed';
                }
                
                console.log(`🔍 [DASHBOARD DEBUG] Categorized "${statusName}" (count: ${count}) → "${category}"`);
                
                categorizedCounts[category] += count;
                categorizedCounts['All'] += count;
                
                // Also populate legacy status counts for backward compatibility
                const status = statusNameLower;
                if (status === 'pending' || status === 'enquiry created' || status.includes('pending') || status === 'design approval pending') {
                  statusCounts.pending += count;
                } else if (status === 'completed' || status.includes('completed') || status.includes('approved')) {
                  statusCounts.completed += count;
                } else if (status === 'rejected' || status.includes('rejected')) {
                  statusCounts.rejected += count;
                } else {
                  // For statuses like coral, cad, progress, etc., count them as pending
                  statusCounts.pending += count;
                }
                statusCounts.total += count;
              });
            } else if (typeof aggregateData === 'object') {
              // Handle object format { pending: 10, completed: 5, ... }
              Object.keys(aggregateData).forEach(key => {
                const normalizedKey = key.toUpperCase();
                const keyLower = key.toLowerCase();
                const value = aggregateData[key];
                
                // Store specific status counts for designers
                specificStatusCounts[keyLower] = value || 0;
                
                // Categorize
                let category = 'Pending';
                if (normalizedKey.includes('APPROVAL') && !normalizedKey.includes('APPROVED')) {
                  category = 'Approval Pending';
                } else if (normalizedKey.includes('APPROVED') || normalizedKey.includes('COMPLETED')) {
                  category = 'Completed';
                }
                
                categorizedCounts[category] += value || 0;
                categorizedCounts['All'] += value || 0;
                
                // Legacy mapping
                if (keyLower === 'pending' || keyLower.includes('pending')) {
                  statusCounts.pending = value || 0;
                } else if (keyLower === 'completed' || keyLower.includes('completed')) {
                  statusCounts.completed = value || 0;
                } else if (keyLower === 'rejected' || keyLower.includes('rejected')) {
                  statusCounts.rejected = value || 0;
                } else if (keyLower === 'total') {
                  statusCounts.total = value || 0;
                } else {
                  // For statuses like coral, cad, progress, etc., count them as pending
                  statusCounts.pending = (statusCounts.pending || 0) + (value || 0);
                }
              });
            }
            
            console.log('🔍 [DASHBOARD DEBUG] Final Status Counts (legacy):', statusCounts);
          } else if (statusAggregateResult.error) {
          }
          
          // Process client aggregate data for admin users
          let totalClientsFromAggregate = 0;
          let clientAggregateData = null;
          if (isAdmin && clientAggregateResult.data && !clientAggregateResult.error) {
            clientAggregateData = clientAggregateResult.data;
            console.log('🔍 [DASHBOARD DEBUG] Client Aggregate API Response:', JSON.stringify(clientAggregateData, null, 2));
            
            if (Array.isArray(clientAggregateData)) {
              // Count unique clients from aggregate
              totalClientsFromAggregate = clientAggregateData.length;
            }
          }

          // Handle paginated response from new aggregated endpoint
          const enquiries = Array.isArray(enquiriesResult.data) 
            ? enquiriesResult.data 
            : (enquiriesResult.data?.data || enquiriesResult.data?.enquiries || []);
          
          // For admin, also check pagination total if available (more accurate than array length)
          const paginationTotal = enquiriesResult.data?.pagination?.total || enquiriesResult.data?.total || null;
          
          console.log('🔍 [DASHBOARD DEBUG] Enquiries result structure:', {
            isArray: Array.isArray(enquiriesResult.data),
            hasData: !!enquiriesResult.data?.data,
            hasEnquiries: !!enquiriesResult.data?.enquiries,
            totalFromPagination: paginationTotal,
            enquiriesArrayLength: enquiries.length,
            fullResult: enquiriesResult.data,
          });

          const clients = role === 'admin' && clientsResult.data
            ? (Array.isArray(clientsResult.data) 
                ? clientsResult.data 
                : (clientsResult.data?.clients || clientsResult.data?.data || []))
            : [];

          // Normalize enquiries (updated for aggregated endpoint response)
          const normalizedEnquiries = enquiries.map(enquiry => {
            // Use CurrentStatus directly from aggregated response
            const currentStatus = enquiry.CurrentStatus || enquiry.Status || 'pending';
            const createdAt = enquiry.CreatedDate || enquiry.CreatedAt || new Date().toISOString();
            const updatedAt = enquiry.AssignedDate || enquiry.UpdatedAt || createdAt;
            
            let normalizedPriority = 'medium';
            const priority = (enquiry.Priority || enquiry.priority || '').toLowerCase();
            if (priority.includes('urgent') || priority === 'high' || priority === 'super high') {
              normalizedPriority = 'high';
            } else if (priority === 'low') {
              normalizedPriority = 'low';
            }
            
            let normalizedStatus = 'pending';
            const status = currentStatus.toLowerCase();
            if (status === 'enquiry created' || status === 'pending' || status.includes('pending')) {
              normalizedStatus = 'pending';
            } else if (status.includes('completed') || status.includes('approved')) {
              normalizedStatus = 'completed';
            } else if (status.includes('rejected')) {
              normalizedStatus = 'rejected';
            } else {
              // For statuses like coral, cad, progress, etc., normalize to pending
              normalizedStatus = 'pending';
            }
            
            let budget = 0;
            if (enquiry.Coral && Array.isArray(enquiry.Coral) && enquiry.Coral.length > 0) {
              const latestCoral = enquiry.Coral[enquiry.Coral.length - 1];
              if (latestCoral.Pricing?.TotalPrice) {
                budget = latestCoral.Pricing.TotalPrice;
              }
            }
            
            return {
              status: normalizedStatus,
              budget: budget,
              estimatedPrice: budget,
            };
          });

          // Calculate dashboard stats based on role
          // All users now use aggregate endpoints for counts
          if (role === 'admin') {
            // Admin: Use aggregate endpoints for counts
            const totalEnquiries = categorizedCounts['All'] || statusCounts.total || 0;
            const pendingEnquiries = categorizedCounts['Pending'] || statusCounts.pending || 0;
            const approvalPendingEnquiries = categorizedCounts['Approval Pending'] || 0;
            const completedEnquiries = categorizedCounts['Completed'] || statusCounts.completed || 0;
            
            // Prefer total count from clients API (includes clients without enquiries)
            // Fallback to aggregate length only when clients API fails/empty
            const totalClients = clients.length > 0 ? clients.length : totalClientsFromAggregate;
            
            // Revenue calculation still needs enquiry data (limited fetch for completed enquiries)
            const revenue = normalizedEnquiries
              .filter(e => {
              const status = (e.status || '').toLowerCase();
              return status.includes('completed') || status.includes('approved');
              })
              .reduce((sum, e) => sum + (parseFloat(e.budget || e.estimatedPrice || 0)), 0);
            
            console.log('🔍 [DASHBOARD DEBUG] ADMIN DASHBOARD CALCULATIONS (from aggregate endpoints):');
            console.log('🔍 [DASHBOARD DEBUG] - Total Enquiries:', totalEnquiries, '(from categorizedCounts.All:', categorizedCounts['All'], ')');
            console.log('🔍 [DASHBOARD DEBUG] - Pending Enquiries:', pendingEnquiries, '(from categorizedCounts.Pending:', categorizedCounts['Pending'], ')');
            console.log('🔍 [DASHBOARD DEBUG] - Approval Pending Enquiries:', approvalPendingEnquiries, '(from categorizedCounts["Approval Pending"]:', categorizedCounts['Approval Pending'], ')');
            console.log('🔍 [DASHBOARD DEBUG] - Completed Enquiries:', completedEnquiries, '(from categorizedCounts.Completed:', categorizedCounts['Completed'], ')');
            console.log('🔍 [DASHBOARD DEBUG] - Total Clients:', totalClients, '(from aggregate:', totalClientsFromAggregate, '| from clients API:', clients.length, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Revenue:', revenue, '(calculated from', normalizedEnquiries.length, 'completed enquiries)');
            const sumOfStatuses = pendingEnquiries + approvalPendingEnquiries + completedEnquiries;
            console.log('🔍 [DASHBOARD DEBUG] - Sum Check (Pending + Approval Pending + Completed):', sumOfStatuses);
            console.log('🔍 [DASHBOARD DEBUG] - Does sum match Total?', sumOfStatuses === totalEnquiries, '(Total:', totalEnquiries, '| Sum:', sumOfStatuses, ')');
            
            return {
              data: {
                totalEnquiries,
                pendingEnquiries,
                approvalPendingEnquiries,
                completedEnquiries,
                totalClients,
                revenue,
                categorizedCounts,
                clientAggregateData, // Include client aggregate data for mapping counts
              },
            };
          } else if (role === 'client') {
            // For client users, prioritize aggregate API counts, but fallback to counting from filtered enquiries
            // The enquiries array is already filtered by clientId, so we can count from it
            const myEnquiries = categorizedCounts['All'] || statusCounts.total || normalizedEnquiries.length;
            
            // Count from normalizedEnquiries (already filtered by clientId) if aggregate is empty
            const pendingCount = normalizedEnquiries.filter(e => {
              const status = (e.status || '').toLowerCase();
              return status === 'pending' || status === 'enquiry created' || (status.includes('pending') && !status.includes('approval'));
            }).length;
            const approvalPendingCount = normalizedEnquiries.filter(e => {
              const status = (e.status || '').toLowerCase();
              return status.includes('approval') && !status.includes('approved');
            }).length;
            const completedCount = normalizedEnquiries.filter(e => {
              const status = (e.status || '').toLowerCase();
              return status.includes('completed') || status.includes('approved');
            }).length;
            
            // Use aggregate counts if available, otherwise use counted values
            const pendingApprovals = categorizedCounts['Pending'] || statusCounts.pending || pendingCount;
            const approvalPending = categorizedCounts['Approval Pending'] || approvalPendingCount;
            const completedOrders = categorizedCounts['Completed'] || statusCounts.completed || completedCount;
            
            const totalSpent = normalizedEnquiries
              .filter(e => {
                const status = (e.status || '').toLowerCase();
                return status.includes('completed') || status.includes('approved');
              })
              .reduce((sum, e) => sum + (parseFloat(e.budget || e.estimatedPrice || 0)), 0);
            
            console.log('🔍 [DASHBOARD DEBUG] - My Enquiries:', myEnquiries, '(from categorizedCounts.All:', categorizedCounts['All'], '| statusCounts.total:', statusCounts.total, '| normalizedEnquiries.length:', normalizedEnquiries.length, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Pending:', pendingApprovals, '(from categorizedCounts.Pending:', categorizedCounts['Pending'], '| statusCounts.pending:', statusCounts.pending, '| counted:', pendingCount, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Approval Pending:', approvalPending, '(from categorizedCounts["Approval Pending"]:', categorizedCounts['Approval Pending'], '| counted:', approvalPendingCount, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Completed Orders:', completedOrders, '(from categorizedCounts.Completed:', categorizedCounts['Completed'], '| statusCounts.completed:', statusCounts.completed, '| counted:', completedCount, ')');
            const clientSum = pendingApprovals + approvalPending + completedOrders;
            console.log('🔍 [DASHBOARD DEBUG] - Sum Check (Pending + Approval Pending + Completed):', clientSum);
            console.log('🔍 [DASHBOARD DEBUG] - Does sum match My Enquiries?', clientSum === myEnquiries, '(My Enquiries:', myEnquiries, '| Sum:', clientSum, ')');
            
            return {
              data: {
                myEnquiries,
                pendingApprovals,
                approvalPending,
                completedOrders,
                totalSpent,
                categorizedCounts,
              },
            };
          } else if (role === 'coral' || role === 'cad') {
            const assignedEnquiries = categorizedCounts['All'] || statusCounts.total || normalizedEnquiries.length;
            const completedDesigns = categorizedCounts['Completed'] || statusCounts.completed || normalizedEnquiries.filter(e => e.status === 'completed').length;
            // For "Pending Designs", count "CAD" status (but clicking will filter by "Coral")
            const pendingDesigns = specificStatusCounts['cad'] || 0;
            const approvalPendingDesigns = categorizedCounts['Approval Pending'] || 0;
            const averageRating = 4.8; // TODO: Fetch from API when available
            
            console.log('🔍 [DASHBOARD DEBUG] DESIGNER DASHBOARD CALCULATIONS (from aggregate API):');
            console.log('🔍 [DASHBOARD DEBUG] - Role:', role, '(should use aggregate endpoint)');
            console.log('🔍 [DASHBOARD DEBUG] - Assigned Enquiries:', assignedEnquiries, '(from categorizedCounts.All:', categorizedCounts['All'], '| statusCounts.total:', statusCounts.total, '| normalizedEnquiries.length:', normalizedEnquiries.length, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Pending Designs (CAD status count):', pendingDesigns, '(from specificStatusCounts["cad"]:', specificStatusCounts['cad'], '| categorizedCounts.Pending:', categorizedCounts['Pending'], ')');
            console.log('🔍 [DASHBOARD DEBUG] - Approval Pending Designs:', approvalPendingDesigns, '(from categorizedCounts["Approval Pending"]:', categorizedCounts['Approval Pending'], ')');
            console.log('🔍 [DASHBOARD DEBUG] - Completed Designs:', completedDesigns, '(from categorizedCounts.Completed:', categorizedCounts['Completed'], '| statusCounts.completed:', statusCounts.completed, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Sum Check (CAD + Approval Pending + Completed):', pendingDesigns + approvalPendingDesigns + completedDesigns);
            console.log('🔍 [DASHBOARD DEBUG] - Note: Sum may not match assigned if there are other statuses (Coral, Enquiry Created, etc.)');
            console.log('🔍 [DASHBOARD DEBUG] - All status counts:', JSON.stringify(specificStatusCounts, null, 2));
            
            return {
              data: {
                assignedEnquiries,
                completedDesigns,
                pendingDesigns,
                approvalPendingDesigns,
                averageRating,
                categorizedCounts,
              },
            };
          }
          
          return { data: {} };
        } catch (error) {
          // Return empty data structure on error
          if (role === 'admin') {
            return {
              data: {
                totalEnquiries: 0,
                pendingEnquiries: 0,
                completedEnquiries: 0,
                totalClients: 0,
                revenue: 0,
              },
            };
          } else if (role === 'client') {
            return {
              data: {
                myEnquiries: 0,
                pendingApprovals: 0,
                completedOrders: 0,
                totalSpent: 0,
              },
            };
          } else if (role === 'coral' || role === 'cad') {
            return {
              data: {
                assignedEnquiries: 0,
                completedDesigns: 0,
                pendingDesigns: 0,
                averageRating: 0,
              },
            };
          }
          return { data: {} };
        }
      },
      providesTags: ['Dashboard'],
    }),

    // ==================== FILE UPLOAD ====================
    uploadDesign: builder.mutation({
      queryFn: async ({ enquiryId, designType, version, images, excel, designCode }, { dispatch }, extraOptions, baseQuery) => {
        // Note: invalidatesTags is set in the mutation definition below
        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: 'Authentication token not found',
              },
            };
          }

          // Create FormData
          const formData = new FormData();
          
          // Add version as text
          formData.append('version', version.toString());
          
          // Add design code (CoralCode or CadCode) if provided
          if (designCode && designCode.trim()) {
            if (designType === 'coral') {
              formData.append('CoralCode', designCode.trim());
            } else if (designType === 'cad') {
              formData.append('CadCode', designCode.trim());
            }
          }
          
          // Add images as files
          if (images && images.length > 0) {
            images.forEach((image, index) => {
              formData.append('images', {
                uri: image.uri,
                type: image.type || 'image/jpeg',
                name: image.name || `image_${index}_${Date.now()}.jpg`,
              });
            });
          }
          
          // Add Excel file if provided
          if (excel) {
            formData.append('excel', {
              uri: excel.uri,
              type: excel.type || 'application/vnd.ms-excel',
              name: excel.name || `excel_${Date.now()}.xlsx`,
            });
          }

          const endpoint = `/api/enquiries/${enquiryId}/upload/${designType}`;
          
          

          const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              // Don't set Content-Type - let fetch set it with boundary for FormData
            },
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            
            return { data };
          } else {
            let errorData;
            try {
              const errorText = await response.text();
              errorData = errorText ? JSON.parse(errorText) : { message: 'Upload failed' };
            } catch (parseError) {
              errorData = { message: `Upload failed with status ${response.status}` };
            }
            
            if (__DEV__) {
              console.error(`❌ Error details:`, {
                enquiryId,
                designType,
                version,
                hasImages: !!(images && images.length > 0),
                imagesCount: images?.length || 0,
                hasExcel: !!excel,
                excelFileName: excel?.name || 'N/A',
                errorMessage: errorData?.message || errorData?.error || 'Unknown error',
              });
            }
            
            // Provide more helpful error message for common backend errors
            let userFriendlyMessage = errorData?.message || errorData?.error || 'Upload failed';
            if (errorData?.error && typeof errorData.error === 'string') {
              if (errorData.error.includes('Pricing')) {
                userFriendlyMessage = 'Excel file processing error: Pricing data is missing or invalid. Please ensure your Excel file contains the required pricing columns and try again.';
              } else if (errorData.error.includes('null')) {
                userFriendlyMessage = 'Server error: Missing data. Please check that all required fields are provided and try again.';
              }
            }
            
            return {
              error: {
                status: response.status,
                data: {
                  ...errorData,
                  message: userFriendlyMessage,
                },
              },
            };
          }
        } catch (error) {
          
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: error.message || 'Failed to upload design',
            },
          };
        }
      },
      invalidatesTags: (result, error, { enquiryId }) => [
        { type: 'Enquiry', id: enquiryId },
        'Enquiry',
        'Dashboard',
      ],
    }),

    // Update asset image description
    updateAssetDescription: builder.mutation({
      query: ({ enquiryId, designType, version, assetId, description }) => {
        const versionParam = version ? `?version=${encodeURIComponent(version)}` : '';
        return {
          url: `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`,
          method: 'PUT',
          body: {
            Id: assetId,
            Description: description,
          },
        };
      },
      invalidatesTags: (result, error, { enquiryId }) => [
        { type: 'Enquiry', id: enquiryId },
        'Enquiry',
      ],
      transformResponse: (response) => {
        
        return response;
      },
      transformErrorResponse: (response) => {
        
        return {
          status: response.status,
          data: response.data,
          error: response.data?.message || response.data?.error || 'Failed to update asset description',
        };
      },
    }),

    // Approve design version
    approveDesignVersion: builder.mutation({
      query: ({ enquiryId, designType, version }) => {
        const versionParam = version ? `?version=${encodeURIComponent(version)}` : '';
        
        
        
        return {
          url: `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`,
          method: 'PUT',
          body: {
            IsApprovedVersion: true,
          },
        };
      },
      invalidatesTags: (result, error, { enquiryId }) => [
        { type: 'Enquiry', id: enquiryId },
        'Enquiry',
      ],
      transformResponse: (response) => {
        
        return response;
      },
      transformErrorResponse: (response) => {
        
        return {
          status: response.status,
          data: response.data,
          error: response.data?.message || response.data?.error || 'Failed to approve design version',
        };
      },
    }),

    // Save pricing for coral/CAD design
    savePricing: builder.mutation({
      query: ({ enquiryId, designType, version, pricingData }) => {
        const versionParam = version ? `?version=${encodeURIComponent(version)}` : '';
        
        // Wrap pricing array in Pricing key as per API specification
        const requestBody = {
          Pricing: Array.isArray(pricingData) ? pricingData : [pricingData]
        };
        
        if (__DEV__) {
          console.log('Body (wrapped in Pricing key):', JSON.stringify(requestBody, null, 2));
        }
        
        return {
          url: `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`,
          method: 'PUT',
          body: requestBody, // { Pricing: [...] }
        };
      },
      invalidatesTags: (result, error, { enquiryId }) => [
        { type: 'Enquiry', id: enquiryId },
        'Enquiry',
        'Dashboard',
      ],
      transformResponse: (response) => {
        
        return response;
      },
      transformErrorResponse: (response) => {
        
        return {
          status: response.status,
          data: response.data,
          error: response.data?.message || response.data?.error || 'Failed to save pricing',
        };
      },
    }),

    // Reject design version
    rejectDesignVersion: builder.mutation({
      query: ({ enquiryId, designType, version, reason }) => {
        const versionParam = version ? `?version=${encodeURIComponent(version)}` : '';
        return {
          url: `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`,
          method: 'PUT',
          body: {
            IsApprovedVersion: false,
            ReasonForRejection: reason || '',
          },
        };
      },
      invalidatesTags: (result, error, { enquiryId }) => [
        { type: 'Enquiry', id: enquiryId },
        'Enquiry',
      ],
      transformResponse: (response) => {
        
        return response;
      },
      transformErrorResponse: (response) => {
        
        return {
          status: response.status,
          data: response.data,
          error: response.data?.message || response.data?.error || 'Failed to reject design version',
        };
      },
    }),

    // Show to Client - Toggle visibility for clients
    updateShowToClient: builder.mutation({
      query: ({ enquiryId, designType, version, showToClient }) => {
        const versionParam = version ? `?version=${encodeURIComponent(version)}` : '';
        
        
        
        return {
          url: `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`,
          method: 'PUT',
          body: {
            ShowToClient: showToClient,
          },
        };
      },
      invalidatesTags: (result, error, { enquiryId }) => [
        { type: 'Enquiry', id: enquiryId },
        'Enquiry',
      ],
      transformResponse: (response) => {
        
        return response;
      },
      transformErrorResponse: (response) => {
        
        return {
          status: response.status,
          data: response.data,
          error: response.data?.message || response.data?.error || 'Failed to update ShowToClient',
        };
      },
    }),

    // Delete design version (within 10 minutes of upload)
    deleteDesignVersion: builder.mutation({
      query: ({ enquiryId, designType, version }) => {
        const versionParam = version ? `?version=${encodeURIComponent(version)}` : '';
        
        
        
        return {
          url: `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: (result, error, { enquiryId }) => [
        { type: 'Enquiry', id: enquiryId },
        'Enquiry',
      ],
      transformResponse: (response) => {
        
        return response;
      },
      transformErrorResponse: (response) => {
        
        return {
          status: response.status,
          data: response.data,
          error: response.data?.message || response.data?.error || 'Failed to delete version',
        };
      },
    }),

    // Upload reference images to an enquiry
    uploadReferenceImages: builder.mutation({
      queryFn: async ({ enquiryId, images }, { dispatch }, extraOptions, baseQuery) => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: 'Authentication token not found',
              },
            };
          }

          // Create FormData
          const formData = new FormData();
          
          // Add images as files - use 'images' field name as per client requirement
          if (images && images.length > 0) {
            images.forEach((image, index) => {
              formData.append('images', {
                uri: image.uri,
                type: image.type || 'image/jpeg',
                name: image.name || `image_${index}_${Date.now()}.jpg`,
              });
            });
          }

          const endpoint = `/api/enquiries/${enquiryId}/upload/reference`;
          
          const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              // Don't set Content-Type - let fetch set it with boundary for FormData
            },
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            return { data };
          } else {
            let errorData;
            try {
              const errorText = await response.text();
              errorData = errorText ? JSON.parse(errorText) : { message: 'Upload failed' };
            } catch (parseError) {
              errorData = { message: `Upload failed with status ${response.status}` };
            }
            
            return {
              error: {
                status: response.status,
                data: errorData,
              },
            };
          }
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: error.message || 'Failed to upload reference images',
            },
          };
        }
      },
      invalidatesTags: (result, error, { enquiryId }) => [
        { type: 'Enquiry', id: enquiryId },
        'Enquiry',
        'Dashboard',
      ],
    }),

    uploadImage: builder.mutation({
      queryFn: async (image, { dispatch }, extraOptions, baseQuery) => {
        // Try multiple possible upload endpoints (including client-specific)
        const uploadEndpoints = [
          '/api/clients/upload',
          '/api/clients/image/upload',
          '/api/upload',
          '/api/files/upload',
          '/api/images/upload',
          '/api/upload/file',
        ];
        
        // Try different field names
        const fieldNames = ['file', 'image', 'upload', 'files'];
        
        const fileName = image.name || `image_${Date.now()}.jpg`;
        const fileType = image.type || 'image/jpeg';
        
        // Try each endpoint with each field name
        for (const endpoint of uploadEndpoints) {
          for (const fieldName of fieldNames) {
            try {
              
              
              // Create FormData
              const formData = new FormData();
              formData.append(fieldName, {
                uri: image.uri,
                type: fileType,
                name: fileName,
              });
              
              // Get auth token
              const token = await AsyncStorage.getItem('token');
              const headers = {};
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }
              
              const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: headers,
                body: formData,
              });

              if (response.ok) {
                const data = await response.json();
                
                return { data };
              } else {
                if (__DEV__) {
                  const errorText = await response.text().catch(() => '');
                }
              }
            } catch (error) {
              
            }
          }
        }
        
        // If all attempts failed, return error
        return {
          error: {
            status: 'CUSTOM_ERROR',
            data: `Failed to upload image. Tried ${uploadEndpoints.length * fieldNames.length} different endpoint/field combinations.`,
          },
        };
      },
    }),

    // ==================== METAL PRICES ====================
    getMetalPrices: builder.query({
      query: (useCache = false, useFullEndpoint = false) => {
        const cacheBuster = useCache ? '' : `?t=${Date.now()}`;
        // Option to use full endpoint instead of /latest (for debugging)
        const endpoint = useFullEndpoint ? `/api/metal-prices${cacheBuster}` : `/api/metal-prices/latest${cacheBuster}`;
        if (__DEV__ && useFullEndpoint) {
          console.log('📥 Using full endpoint instead of /latest');
        }
        return endpoint;
      },
      providesTags: ['MetalPrice'],
      transformResponse: (data) => {
        let pricesData = {};
        let ids = {};
        
        if (Array.isArray(data)) {
          data.forEach(item => {
            const metalType = (item.MetalType || item.metalType || item.type || '').toLowerCase();
            const itemId = item.Id || item.id || item._id;
            if (metalType) {
              pricesData[metalType] = {
                price: item.Price || item.price || item.PricePerGram || item.pricePerGram || 0,
                unit: item.Unit || item.unit || 'per gram',
                lastUpdated: item.LastUpdated || item.lastUpdated || item.UpdatedAt || item.updatedAt || new Date().toISOString(),
              };
              if (itemId) ids[metalType] = itemId;
            }
          });
        } else if (data && typeof data === 'object') {
          if (data.gold || data.silver || data.platinum) {
            const metals = ['gold', 'silver', 'platinum'];
            metals.forEach(metal => {
              const metalData = data[metal];
              if (!metalData) return;
              
              if (Array.isArray(metalData)) {
                if (metalData.length === 0) return;
                const sortedByDate = [...metalData].sort((a, b) => {
                  const dateA = new Date(a.date || a.Date || 0);
                  const dateB = new Date(b.date || b.Date || 0);
                  return dateB - dateA;
                });
                const latestEntry = sortedByDate[0];
                pricesData[metal] = {
                  price: latestEntry.price || latestEntry.Price || 0,
                  unit: 'per gram',
                  lastUpdated: latestEntry.date || latestEntry.Date || new Date().toISOString(),
                };
              } else if (typeof metalData === 'object') {
                const itemId = metalData.Id || metalData.id || metalData._id;
                pricesData[metal] = {
                  price: metalData.Price || metalData.price || metalData.PricePerGram || metalData.pricePerGram || 0,
                  unit: metalData.Unit || metalData.unit || 'per gram',
                  lastUpdated: metalData.LastUpdated || metalData.lastUpdated || metalData.UpdatedAt || metalData.updatedAt || new Date().toISOString(),
                };
                if (itemId) ids[metal] = itemId;
              }
            });
          } else if (data.prices && typeof data.prices === 'object') {
            pricesData = data.prices;
            if (data.ids && typeof data.ids === 'object') ids = data.ids;
          } else if (data.data && typeof data.data === 'object') {
            pricesData = data.data;
            if (data.ids && typeof data.ids === 'object') ids = data.ids;
          } else {
            Object.keys(data).forEach(key => {
              const item = data[key];
              if (item && typeof item === 'object' && (item.price || item.Price)) {
                const itemId = item.Id || item.id || item._id;
                pricesData[key] = {
                  price: item.Price || item.price || item.PricePerGram || item.pricePerGram || 0,
                  unit: item.Unit || item.unit || 'per gram',
                  lastUpdated: item.LastUpdated || item.lastUpdated || item.UpdatedAt || item.updatedAt || new Date().toISOString(),
                };
                if (itemId) ids[key] = itemId;
              }
            });
          }
        }
        
        return { prices: pricesData, ids: ids };
      },
    }),

    addMetalPrice: builder.mutation({
      query: (data) => {
        // Convert date to ISO format with time (backend expects: "2025-11-08T00:00:00.000Z")
        let dateValue = data.date || new Date().toISOString().split('T')[0];
        
        // If date is just YYYY-MM-DD, convert to exact format: "YYYY-MM-DDTHH:mm:ss.sssZ"
        if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateValue = `${dateValue}T00:00:00.000Z`;
        } else if (!dateValue.includes('T')) {
          try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              dateValue = date.toISOString();
            }
          } catch (e) {
            const today = new Date().toISOString().split('T')[0];
            dateValue = `${today}T00:00:00.000Z`;
          }
        }
        
        return {
        url: '/api/metal-prices',
        method: 'POST',
        body: {
          metal: data.metal || data.metalType,
          price: data.price,
            date: dateValue,
        },
        };
      },
      invalidatesTags: ['MetalPrice'],
    }),

    updateMetalPrice: builder.mutation({
      query: ({ metal, ...data }) => {
        // Convert date to ISO format with time (backend expects: "2025-11-08T00:00:00.000Z")
        let dateValue = data.date || new Date().toISOString().split('T')[0];
        
        // If date is just YYYY-MM-DD, convert to exact format: "YYYY-MM-DDTHH:mm:ss.sssZ"
        if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Create date string in exact format without timezone conversion
          dateValue = `${dateValue}T00:00:00.000Z`;
        } else if (!dateValue.includes('T')) {
          // If it's not in the right format, try to convert it
          try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              dateValue = date.toISOString();
            }
          } catch (e) {
            // Fallback: use today's date in correct format
            const today = new Date().toISOString().split('T')[0];
            dateValue = `${today}T00:00:00.000Z`;
          }
        }
        
        const payload = {
          date: dateValue,
          price: data.price,
        };
        if (__DEV__) {
          console.log(`📤 API: Updating ${metal} price:`, payload);
          console.log(`📤 API: Date format: "${dateValue}"`);
          console.log(`📤 API: Full URL: /api/metal-prices/${metal}`);
        }
        return {
        url: `/api/metal-prices/${metal}`,
        method: 'PUT',
          body: payload,
        };
      },
      transformResponse: (response, meta, arg) => {
        if (__DEV__) {
          console.log(`📥 API: ${arg.metal} update raw response:`, JSON.stringify(response, null, 2));
          console.log(`📥 API: Response type:`, typeof response);
          console.log(`📥 API: Response is null:`, response === null);
          
          // Check HTTP status from meta
          const status = meta?.response?.status;
          console.log(`📥 API: HTTP Status Code:`, status);
          
          if (status === 200) {
            console.log(`✅ PUT Request SUCCEEDED (200 OK)`);
          } else if (status === 204) {
            console.log(`✅ PUT Request SUCCEEDED (204 No Content - normal for PUT)`);
          } else if (status >= 400) {
            console.error(`❌ PUT Request FAILED with status:`, status);
          } else {
            console.log(`⚠️ PUT Request status:`, status);
          }
          
          console.log(`📥 API: Response Headers:`, meta?.response?.headers);
          console.log(`📥 API: Full Meta:`, JSON.stringify(meta, null, 2));
        }
        
        // Backend returns full document with arrays: { gold: [{date, price}, ...], silver: [...], platinum: [...] }
        // Process it the same way as GET endpoint to extract latest prices
        if (response && typeof response === 'object' && (response.gold || response.silver || response.platinum)) {
          const processedResponse = {};
          const metals = ['gold', 'silver', 'platinum'];
          
          metals.forEach(metalKey => {
            const metalArray = response[metalKey];
            if (Array.isArray(metalArray) && metalArray.length > 0) {
              // Sort by date (newest first) and get the latest entry
              const sortedByDate = [...metalArray].sort((a, b) => {
                const dateA = new Date(a.date || a.Date || 0);
                const dateB = new Date(b.date || b.Date || 0);
                return dateB - dateA; // Descending order (latest first)
              });
              const latestEntry = sortedByDate[0];
              
              processedResponse[metalKey] = {
                price: latestEntry.price || latestEntry.Price || 0,
                unit: 'per gram',
                lastUpdated: latestEntry.date || latestEntry.Date || new Date().toISOString(),
              };
              
              if (__DEV__) {
                console.log(`💰 Processed ${metalKey}:`, processedResponse[metalKey]);
              }
            }
          });
          
          if (__DEV__) {
            console.log(`📊 Processed Response:`, JSON.stringify(processedResponse, null, 2));
          }
          
          // Return the full response so frontend can access all metals
          return response;
        }
        
        return response;
      },
      invalidatesTags: ['MetalPrice'],
    }),

    deleteMetalPrice: builder.mutation({
      query: ({ metal, date }) => ({
        url: `/api/metal-prices/${metal}`,
        method: 'DELETE',
        body: {
          date: date || new Date().toISOString().split('T')[0],
        },
      }),
      invalidatesTags: ['MetalPrice'],
    }),

    // ==================== PRICING CALCULATION ====================
    calculatePricing: builder.mutation({
      query: (data) => {
        if (__DEV__) {
          console.log('Payload:', JSON.stringify(data, null, 2));
        }
        return {
          url: '/api/enquiries/pricingCalculate',
          method: 'POST',
          body: data,
        };
      },
      transformResponse: (response) => {
        
        return response;
      },
      transformErrorResponse: (response) => {
        if (__DEV__) {
          console.error('Full response:', JSON.stringify(response, null, 2));
          
          // Try to extract more details from error response
          if (response.data) {
            if (typeof response.data === 'string') {
              console.error('Error message (string):', response.data);
            } else if (typeof response.data === 'object') {
              console.error('Error object keys:', Object.keys(response.data));
            }
          }
          
          // Check for specific backend error pattern
          if (response.status === 500) {
            console.error('This is likely the "Cannot read properties of null (reading \'Pricing\')" error');
          }
          
        }
        
        // Enhance error message for 500 errors (likely the client.Pricing null error)
        let errorMessage = response.data?.message || response.data?.error || `Pricing calculation failed (${response.status || 'Unknown error'})`;
        
        if (response.status === 500 && (!response.data?.message || response.data?.message === 'Internal server error')) {
          // Backend is returning generic 500 error, but we know from logs it's likely the client.Pricing null error
          errorMessage = 'Internal server error: Client configuration issue. The client may not exist or may be missing pricing configuration.';
        }
        
        return {
          status: response.status,
          data: response.data,
          error: errorMessage,
        };
      },
    }),

    // ==================== CHATS ====================
    // Get chat by enquiry ID with type
    getChatByEnquiry: builder.query({
      query: ({ enquiryId, type }) => {
        if (!enquiryId) {
          throw new Error('enquiryId is required');
        }
        // Determine type based on user role if not provided
        const chatType = type || 'admin-client';
        return `/api/chats/enquiry/${enquiryId}?type=${chatType}`;
      },
      providesTags: (result, error, { enquiryId }) => [{ type: 'Chat', id: enquiryId }],
    }),

    // Get all chats for an enquiry (both admin-client and admin-designer)
    // Uses /api/chats with search parameter and filters client-side
    // Renamed from getChatsByEnquiry to getChatsByEnquiryV2 to bypass old cached queries
    getChatsByEnquiryV2: builder.query({
      query: ({ enquiryId }) => {
        if (!enquiryId) {
          throw new Error('enquiryId is required');
        }
        // Use /api/chats with search parameter (searches by enquiry name or ID)
        // Fetch with high limit to get all chats, then filter client-side
        const enquiryIdStr = String(enquiryId).trim();
        const params = new URLSearchParams();
        params.append('search', enquiryIdStr);
        params.append('limit', '100'); // High limit to get all matching chats
        params.append('page', '1');
        const url = `/api/chats?${params.toString()}`;
        if (__DEV__) {
          console.log('✅✅✅ getChatsByEnquiryV2 (NEW CODE) ✅✅✅');
        }
        return url;
      },
      providesTags: (result, error, { enquiryId }) => [{ type: 'Chat', id: enquiryId }],
      transformResponse: (data, meta, arg) => {
        try {
          const { enquiryId } = arg;
          const enquiryIdStr = String(enquiryId).trim();
          
          // Handle different response formats
          if (!data) {
            
            return [];
          }
          
          let chatsArray = [];
          if (Array.isArray(data)) {
            chatsArray = data;
          } else if (data.Data && Array.isArray(data.Data)) {
            chatsArray = data.Data;
          } else if (data.data && Array.isArray(data.data)) {
            chatsArray = data.data;
          } else if (data.chats && Array.isArray(data.chats)) {
            chatsArray = data.chats;
          } else {
            
            return [];
          }
          
          
          
          // Normalize chat objects and filter by enquiryId
          const normalizedChats = chatsArray.map((chat, index) => {
            try {
          // Handle MongoDB ObjectId format
          let chatId = chat._id;
          if (chatId?.$oid) {
            chatId = chatId.$oid;
          } else if (chatId?._id) {
            chatId = chatId._id;
          } else {
            chatId = chatId || chat.id;
          }
          
          let enquiryId = chat.EnquiryId || chat.enquiryId;
          if (enquiryId?.$oid) {
            enquiryId = enquiryId.$oid;
          } else if (enquiryId?._id) {
            enquiryId = enquiryId._id;
          }
          
          // Handle last message
          let lastMessage = '';
          let lastMessageTime = null;
          if (chat.LastMessage) {
            if (typeof chat.LastMessage === 'object') {
              lastMessage = chat.LastMessage.Message || chat.LastMessage.message || chat.LastMessage.text || '';
              lastMessageTime = chat.LastMessage.Timestamp || chat.LastMessage.timestamp || chat.LastMessage.updatedAt;
            } else {
              lastMessage = chat.LastMessage;
            }
          } else if (chat.lastMessage) {
            lastMessage = chat.lastMessage;
          }
          
          if (lastMessageTime?.$date) {
            lastMessageTime = lastMessageTime.$date;
          }
          
          return {
            _id: chatId,
            id: chatId,
            _originalData: chat,
            EnquiryId: enquiryId,
            enquiryId: enquiryId,
            EnquiryName: chat.EnquiryName || chat.enquiryTitle || chat.EnquiryTitle || 'Untitled Chat',
            enquiryTitle: chat.EnquiryName || chat.enquiryTitle || chat.EnquiryTitle || 'Untitled Chat',
            Type: chat.Type || chat.type,
            type: chat.Type || chat.type,
            LastMessage: chat.LastMessage,
            lastMessage: lastMessage,
            lastMessageTime: lastMessageTime,
            UnreadCount: chat.UnreadCount || chat.unreadCount || 0,
            unreadCount: chat.UnreadCount || chat.unreadCount || 0,
            IsGroup: chat.IsGroup || chat.isGroup || false,
            isGroup: chat.IsGroup || chat.isGroup || false,
          };
            } catch (chatError) {
              
              // Return a minimal valid chat object
              return {
                _id: chat?._id || chat?.id || `error-${index}`,
                id: chat?._id || chat?.id || `error-${index}`,
                _originalData: chat,
                EnquiryId: chat?.EnquiryId || chat?.enquiryId || null,
                enquiryId: chat?.EnquiryId || chat?.enquiryId || null,
                EnquiryName: 'Error loading chat',
                enquiryTitle: 'Error loading chat',
                Type: chat?.Type || chat?.type || null,
                type: chat?.Type || chat?.type || null,
                LastMessage: null,
                lastMessage: 'Error loading message',
                lastMessageTime: null,
                UnreadCount: 0,
                unreadCount: 0,
                IsGroup: false,
                isGroup: false,
              };
            }
          }).filter(chat => chat && (chat._id || chat.id)); // Filter out any null/undefined chats
          
          // Filter to only include chats matching the enquiryId
          const filteredChats = normalizedChats.filter(chat => {
            const chatEnquiryId = String(chat.enquiryId || chat.EnquiryId || '').trim();
            return chatEnquiryId === enquiryIdStr;
          });
          
          
          
          return filteredChats;
        } catch (error) {
          
          return [];
        }
      },
      transformErrorResponse: (response, meta, arg) => {
        if (__DEV__) {
          const { enquiryId } = arg || {};
          console.error('❌ getChatsByEnquiryV2 API Error:', {
            enquiryId,
            status: response.status,
            originalStatus: response.originalStatus,
            data: response.data,
            message: response.data?.message || response.data?.error || 'Unknown error',
            url: meta?.request?.url || meta?.request?.endpoint || 'unknown',
            endpointName: 'getChatsByEnquiryV2',
          });
          // Check if error is from old endpoint
          if (response.data && typeof response.data === 'string' && response.data.includes('/api/chats/enquiry/')) {
          }
        }
        return {
          status: response.status,
          data: response.data,
          error: response.data?.message || response.data?.error || 'Failed to load chats',
        };
      },
    }),

    // Get all chats (for chat list)
    getChats: builder.query({
      query: ({ page = 1, limit = 10, search = '', type } = {}) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (search) {
          params.append('search', search);
        }
        // Add type parameter if provided (admin-client or admin-designer)
        if (type) {
          params.append('type', type);
        }
        return `/api/chats?${params.toString()}`;
      },
      providesTags: ['Chat'],
      transformResponse: (data, meta, arg) => {
        if (__DEV__) {
          console.log('getChats API Response (raw):', data);
          console.log('Is Array?', Array.isArray(data));
          if (meta?.response) {
          }
        }

        // Handle different response formats
        // According to the guide, response format is: { Total, page, limit, TotalPages, Data }
        let chatsArray = [];
        if (Array.isArray(data)) {
          // Check if this is an array of messages (need to aggregate) or chats
          if (data.length > 0 && data[0].message && data[0].enquiryId) {
            // This looks like messages - aggregate into chats by enquiryId
            
            const chatMap = new Map();
            
            data.forEach(msg => {
              // Extract enquiryId
              let enquiryId = msg.enquiryId?.$oid || msg.enquiryId || msg.EnquiryId;
              if (!enquiryId) return;
              
              // Extract timestamp
              let timestamp = msg.timestamp?.$date || msg.timestamp || msg.Timestamp;
              
              // Get or create chat
              if (!chatMap.has(enquiryId)) {
                chatMap.set(enquiryId, {
                  _id: enquiryId,
                  enquiryId: enquiryId,
                  enquiryTitle: msg.enquiryTitle || 'Untitled Chat',
                  clientName: msg.clientName || 'Unknown Client',
                  lastMessage: '',
                  lastMessageTime: timestamp || new Date().toISOString(),
                  unreadCount: 0,
                  messages: [],
                });
              }
              
              const chat = chatMap.get(enquiryId);
              chat.messages.push(msg);
              
              // Update last message if this is newer
              const msgTime = timestamp ? new Date(timestamp) : new Date(0);
              const chatTime = chat.lastMessageTime ? new Date(chat.lastMessageTime) : new Date(0);
              
              if (msgTime > chatTime) {
                chat.lastMessage = msg.message || msg.text || '';
                chat.lastMessageTime = timestamp || new Date().toISOString();
              }
            });
            
            // Convert map to array
            chatsArray = Array.from(chatMap.values());
          } else {
            // This looks like chats array
            chatsArray = data;
          }
        } else if (data && typeof data === 'object') {
          // Handle paginated response format from guide: { Total, page, limit, TotalPages, Data }
          if (data.Data && Array.isArray(data.Data)) {
            chatsArray = data.Data;
          } else if (data.chats && Array.isArray(data.chats)) {
            chatsArray = data.chats;
          } else if (data.data && Array.isArray(data.data)) {
            chatsArray = data.data;
          } else {
            
            return [];
          }
        } else {
          
          return [];
        }
        
        
        
        const normalizedChats = chatsArray.map(chat => {
          // Handle MongoDB ObjectId format for enquiryId
          let enquiryId = chat.EnquiryId || chat.enquiryId;
          if (enquiryId?.$oid) {
            enquiryId = enquiryId.$oid;
          } else if (enquiryId?._id) {
            enquiryId = enquiryId._id;
          }
          
          // Handle MongoDB ObjectId format for chat ID
          let chatId = chat._id;
          if (chatId?.$oid) {
            chatId = chatId.$oid;
          } else if (chatId?._id) {
            chatId = chatId._id;
          } else {
            chatId = chatId || chat.id;
          }
          
          // Handle timestamp
          let lastMessageTime = chat.LastMessageTime || chat.lastMessageTime || chat.updatedAt || chat.UpdatedAt;
          if (lastMessageTime?.$date) {
            lastMessageTime = lastMessageTime.$date;
          } else if (lastMessageTime?.Timestamp) {
            lastMessageTime = lastMessageTime.Timestamp;
          }
          
          // Handle LastMessage - it can be an object or a string
          let lastMessageText = '';
          const lastMessageObj = chat.LastMessage || chat.lastMessage;
          if (lastMessageObj) {
            if (typeof lastMessageObj === 'string') {
              lastMessageText = lastMessageObj;
            } else if (typeof lastMessageObj === 'object') {
              // Extract text from message object
              lastMessageText = lastMessageObj.Message || 
                               lastMessageObj.message || 
                               lastMessageObj.text || 
                               lastMessageObj.Text || 
                               '';
            }
          } else {
            lastMessageText = chat.message || '';
          }
          
          // Handle LastSender - it can be an object or a string
          let lastSenderName = '';
          const lastSenderObj = chat.LastSender || chat.lastSender;
          if (lastSenderObj) {
            if (typeof lastSenderObj === 'string') {
              lastSenderName = lastSenderObj;
            } else if (typeof lastSenderObj === 'object') {
              lastSenderName = lastSenderObj.Name || 
                              lastSenderObj.name || 
                              lastSenderObj.SenderName || 
                              lastSenderObj.senderName || 
                              '';
            }
          } else {
            lastSenderName = chat.sender || '';
          }
          
          return {
            id: chatId,
            enquiryId: enquiryId || chat.Enquiry?.id || chat.enquiry?.id,
            enquiryTitle: chat.EnquiryTitle || chat.enquiryTitle || chat.Enquiry?.Name || chat.Enquiry?.title || 'Untitled Chat',
            clientName: chat.ClientName || chat.clientName || chat.Client?.Name || chat.client?.name || 'Unknown Client',
            lastMessage: lastMessageText,
            lastMessageTime: lastMessageTime || new Date().toISOString(),
            unreadCount: chat.UnreadCount || chat.unreadCount || chat.unread || 0,
            isGroup: chat.IsGroup || chat.isGroup || false,
            participants: chat.Participants || chat.participants || [],
            lastSender: lastSenderName,
            status: chat.Status || chat.status || 'active',
            isClient: chat.IsClient || chat.isClient || false,
            // Preserve chat type for filtering (important for role-based chat visibility)
            type: chat.Type || chat.type || null,
            Type: chat.Type || chat.type || null,
            // Preserve original data
            _originalData: chat,
          };
        });
        
        
        
        return normalizedChats;
      },
    }),

    getChatMessages: builder.query({
      queryFn: async ({ chatId, before, limit = 20 } = {}, { getState }, extraOptions, baseQuery) => {
        if (!chatId) {
          return { error: { status: 'CUSTOM_ERROR', data: 'chatId is required' } };
        }

        try {
          const token = await AsyncStorage.getItem('token');
          const params = new URLSearchParams();
          params.append('limit', limit.toString());
          if (before) {
            params.append('before', before);
          }

          const url = `/api/message/${chatId}/messages?${params.toString()}`;
          

          const response = await fetch(`${API_BASE_URL}${url}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          // Get response as text first to check if it's HTML
          const responseText = await response.text();
          
          // Check if response is HTML (404 page or error page)
          if (responseText.includes('<!DOCTYPE') || responseText.includes('<html') || responseText.includes('Cannot GET')) {
            // Backend endpoint /api/message/:chatId/messages doesn't exist yet
            // This is expected - messages work via WebSocket, historical messages will be empty
            // Only log once per chat to reduce noise
            if (__DEV__ && !global._loggedMissingMessagesEndpoint) {
              global._loggedMissingMessagesEndpoint = true;
            }
            // Return empty array - messages will be empty but app won't crash
            // WebSocket messages will still work fine
            return { data: [] };
          }

          // Try to parse as JSON
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            if (__DEV__) {
              console.error('Response text:', responseText.substring(0, 500));
            }
            // Return empty array if JSON parsing fails
            return { data: [] };
          }

          // Log the raw response for debugging
          if (__DEV__) {
            console.log('📥 Raw API Response:', {
              hasData: !!data,
              dataKeys: data ? Object.keys(data) : [],
              isArray: Array.isArray(data),
              dataType: typeof data,
              sample: data ? JSON.stringify(data).substring(0, 200) : null,
            });
          }

          // Handle different response formats
          let messagesArray = [];
          let nextCursor = null;
          
          // Check for various response formats
          if (data && data.Data && Array.isArray(data.Data)) {
            // Format: { Data: [...], NextCursor: "..." }
            messagesArray = data.Data;
            nextCursor = data.NextCursor || data.nextCursor || null;
            if (__DEV__) {
              console.log('✅ Using format: data.Data (capital D)');
            }
          } else if (data && data.data && Array.isArray(data.data)) {
            // Format: { data: [...], nextCursor: "..." }
            messagesArray = data.data;
            nextCursor = data.nextCursor || data.NextCursor || null;
            if (__DEV__) {
              console.log('✅ Using format: data.data (lowercase d)');
            }
          } else if (data && data.messages && Array.isArray(data.messages)) {
            // Format: { messages: [...], nextCursor: "..." }
            messagesArray = data.messages;
            nextCursor = data.nextCursor || data.NextCursor || null;
            
          } else if (Array.isArray(data)) {
            // Format: direct array [...]
            messagesArray = data;
            
          } else if (data && data.result && Array.isArray(data.result)) {
            // Format: { result: [...] }
            messagesArray = data.result;
            nextCursor = data.nextCursor || data.NextCursor || null;
            
          } else {
            if (__DEV__) {
              console.warn('Response structure:', {
                type: typeof data,
                isArray: Array.isArray(data),
                keys: data ? Object.keys(data) : [],
                sample: data ? JSON.stringify(data).substring(0, 300) : null,
              });
            }
            messagesArray = [];
          }

          if (__DEV__) {
            if (messagesArray.length > 0) {
            }
          }

          // Transform messages to consistent format
          const transformedMessages = messagesArray.map((message, index) => {
            // Handle MongoDB ObjectId format
            const messageId = message._id?.$oid || message._id || message.id;
            const senderId = message.senderId?.$oid || message.senderId || message.SenderId;
            
            // Handle timestamp format (MongoDB $date or ISO string)
            let timestamp = message.timestamp;
            if (timestamp?.$date) {
              timestamp = timestamp.$date;
            } else if (timestamp?.Timestamp) {
              timestamp = timestamp.Timestamp;
            } else if (typeof timestamp === 'string') {
              timestamp = timestamp;
            } else {
              timestamp = new Date().toISOString();
            }

            // Handle message type and content
            const messageType = message.messageType || message.MessageType || message.type || 'text';
            let text = message.message || message.Message || message.text || '';
            let mediaKey = message.mediaKey || message.mediaUrl || '';
            let mediaName = message.mediaName || message.filename || '';
            
            // For image/file messages, set appropriate text
            if (messageType === 'image' && !text) {
              text = '📷 Image';
            } else if (messageType === 'file' && !text) {
              text = mediaName || '📎 File';
            }
            
            return {
              _id: messageId || `msg-${index}`,
              id: messageId || `msg-${index}`,
              Message: text,
              message: text,
              text: text,
              SenderId: senderId,
              senderId: senderId,
              SenderName: message.senderName || message.SenderName || message.sender?.name || 'Unknown',
              senderName: message.senderName || message.SenderName || message.sender?.name || 'Unknown',
              SenderRole: message.senderRole || message.SenderRole || message.sender?.role || 'user',
              senderRole: message.senderRole || message.SenderRole || message.sender?.role || 'user',
              Timestamp: timestamp,
              timestamp: timestamp,
              MessageType: messageType,
              messageType: messageType,
              Media: message.Media || (message.mediaUrl ? { Url: message.mediaUrl, Size: message.mediaSize } : null),
              media: message.Media || (message.mediaUrl ? { url: message.mediaUrl, size: message.mediaSize } : null),
              mediaUrl: message.Media?.Url || message.media?.url || message.mediaUrl,
              mediaSize: message.Media?.Size || message.media?.size || message.mediaSize,
              IsRead: message.IsRead || message.isRead || false,
              isRead: message.IsRead || message.isRead || false,
              ReplyTo: message.ReplyTo || message.replyTo || null,
              replyTo: message.ReplyTo || message.replyTo || null,
              ChatId: message.ChatId || message.chatId || chatId,
              chatId: message.ChatId || message.chatId || chatId,
              status: message.status || message.Status || 'sent',
              isGroup: message.isGroup || message.IsGroup || false,
              // Preserve original data
              _originalData: message,
            };
          }).sort((a, b) => {
            // Sort by timestamp ascending (oldest first)
            return new Date(a.Timestamp || a.timestamp || 0) - new Date(b.Timestamp || b.timestamp || 0);
          });

          // Return messages with pagination info
          // RTK Query doesn't support returning extra metadata directly,
          // so we'll attach it to the first message for now
          // The hook will extract it
          const result = transformedMessages.length > 0 
            ? transformedMessages.map((msg, index) => ({
                ...msg,
                _nextCursor: index === 0 ? nextCursor : undefined, // Attach to first message
                _hasMore: nextCursor !== null && nextCursor !== undefined,
              }))
            : [];

          return { 
            data: result,
            // Also return metadata separately (though RTK Query will ignore this)
            meta: { nextCursor, hasMore: nextCursor !== null && nextCursor !== undefined }
          };
        } catch (error) {
          // Handle different types of errors
          const errorMessage = error.message || error.toString();
          const isNetworkError = 
            errorMessage.includes('Network request failed') ||
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('network') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('timeout');
          
          if (__DEV__) {
            if (isNetworkError) {
              console.warn('⚠️ Network error fetching messages (server may be unreachable):', errorMessage);
            } else {
            }
          }
          
          // Return empty array on any error - app continues to work
          // WebSocket messages will still be received if connection is active
          return { data: [] };
        }
      },
      providesTags: (result, error, args) => {
        const chatId = args?.chatId || args;
        return [{ type: 'Chat', id: chatId }];
      },
    }),

    // ==================== PUSH NOTIFICATION TOKENS ====================
    registerPushToken: builder.mutation({
      query: ({ token, device }) => {
        const payload = {
          token,
          platform: device?.platform || Platform.OS,
          osVersion: device?.osVersion || Platform.Version?.toString(),
        };
        
        // Log the exact payload being sent (for debugging)
        if (__DEV__) {
          console.log('[API] registerPushToken - Sending payload:', {
            tokenLength: token?.length,
            tokenPreview: token?.substring(0, 30) + '...',
            platform: payload.platform,
            osVersion: payload.osVersion,
          });
        }
        
        return {
          url: '/api/users/registerPushToken',
          method: 'POST',
          body: payload,
        };
      },
      invalidatesTags: [{ type: 'DeviceToken', id: 'CURRENT' }],
    }),

    removePushToken: builder.mutation({
      query: ({ token }) => ({
        url: '/api/users/registerPushToken',
        method: 'DELETE',
        body: { token },
      }),
      invalidatesTags: [{ type: 'DeviceToken', id: 'CURRENT' }],
    }),

    // ==================== NOTIFICATIONS ====================
    getNotifications: builder.query({
      query: () => '/api/notifications',
      transformResponse: (response) => {
        const notificationsArray = Array.isArray(response)
          ? response
          : response?.data && Array.isArray(response.data)
            ? response.data
            : [];

        return notificationsArray.map((notification, index) => {
          const notificationId =
            notification._id?.$oid ||
            notification._id ||
            notification.id ||
            `notification-${index}`;

          const createdAt =
            notification.createdAt ||
            notification.CreatedAt ||
            notification.timestamp ||
            notification.Timestamp ||
            notification.updatedAt ||
            notification.UpdatedAt ||
            new Date().toISOString();

          return {
            id: notificationId,
            _id: notificationId,
            title: notification.Title || notification.title || 'Notification',
            message: notification.Body || notification.body || '',
            type: notification.Type || notification.type || 'system_alert',
            link: notification.Link || notification.link || '',
            isRead:
              notification.Read ??
              notification.read ??
              notification.IsRead ??
              notification.isRead ??
              false,
            timestamp: createdAt,
            createdAt,
            raw: notification,
          };
        });
      },
      providesTags: (result) =>
        result && result.length
          ? [
              ...result.map((notification) => ({
                type: 'Notification',
                id: notification.id,
              })),
              { type: 'Notification', id: 'LIST' },
            ]
          : [{ type: 'Notification', id: 'LIST' }],
    }),

    getUnreadNotificationsCount: builder.query({
      query: () => '/api/notifications/unread-count',
      transformResponse: (response) => {
        if (typeof response === 'number') {
          return response;
        }
        if (response?.count !== undefined) {
          return response.count;
        }
        return 0;
      },
      providesTags: [{ type: 'Notification', id: 'UNREAD_COUNT' }],
    }),

    markNotificationRead: builder.mutation({
      query: (notificationId) => ({
        url: `/api/notifications/${notificationId}/read`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, notificationId) => [
        { type: 'Notification', id: notificationId },
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'UNREAD_COUNT' },
      ],
    }),

    markAllNotificationsRead: builder.mutation({
      query: () => ({
        url: '/api/notifications/mark-all-read',
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'UNREAD_COUNT' },
      ],
    }),

    // Upload media for chat messages
    uploadChatMedia: builder.mutation({
      queryFn: async (file, { dispatch }, extraOptions, baseQuery) => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: 'Authentication token not found',
              },
            };
          }

          // Create FormData
          const formData = new FormData();
          formData.append('file', {
            uri: file.uri,
            type: file.type || 'image/jpeg',
            name: file.name || `file_${Date.now()}.jpg`,
          });

          const endpoint = '/api/message/upload';

          

          const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              // Don't set Content-Type - let fetch set it with boundary for FormData
            },
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            
            return { data };
          } else {
            const errorText = await response.text().catch(() => '');
            const errorData = errorText ? JSON.parse(errorText) : { message: 'Upload failed' };
            
            return {
              error: {
                status: response.status,
                data: errorData,
              },
            };
          }
        } catch (error) {
          
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: error.message || 'Failed to upload media',
            },
          };
        }
      },
    }),
  }),
});

// Export hooks for usage in components
export const {
  // Auth
  useLoginMutation,
  useCreateUserMutation,
  useGetUserByIdQuery,
  useGetUsersQuery,
  
  // Enquiries
  useGetEnquiriesQuery,
  useGetEnquiryByIdQuery,
  useCreateEnquiryMutation,
  useUpdateEnquiryMutation,
  useDeleteEnquiryMutation,
  
  // Clients
  useGetClientsQuery,
  useGetClientByIdQuery,
  useCreateClientMutation,
  useUpdateClientPricingMutation,
  
  // Dashboard
  useGetDashboardDataQuery,
  
  // Status Statistics
  useGetStatusStatisticsQuery,
  
  // Metal Prices
  useGetMetalPricesQuery,
  useAddMetalPriceMutation,
  useUpdateMetalPriceMutation,
  useDeleteMetalPriceMutation,
  
  // Pricing
  useCalculatePricingMutation,
  useSavePricingMutation,
  
  // File Upload
  useUploadImageMutation,
  useUploadReferenceImagesMutation,
  useUploadDesignMutation,
  useUpdateAssetDescriptionMutation,
  useApproveDesignVersionMutation,
  useRejectDesignVersionMutation,
  useUpdateShowToClientMutation,
  useDeleteDesignVersionMutation,
  
  // Notifications
  useGetNotificationsQuery,
  useGetUnreadNotificationsCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useRegisterPushTokenMutation,
  useRemovePushTokenMutation,
  
  // Chats
  useGetChatsQuery,
  useGetChatByEnquiryQuery,
  useGetChatsByEnquiryV2Query,
  useGetChatMessagesQuery,
  useUploadChatMediaMutation,
  
  // Code Lists
  useGetRolesQuery,
  useGetStatusesQuery,
  useGetStoneTypesQuery,
} = api;

