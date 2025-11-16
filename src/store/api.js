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
        if (__DEV__) {
          console.warn('API Request - No token found in AsyncStorage');
        }
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
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
          console.log('📥 ========== ROLES API RESPONSE RECEIVED ==========');
          console.log('📥 Roles count:', roles.length);
          console.log('📥 Raw roles data:', roles);
          setRolesCache(roles);
          console.log('📥 ================================================');
        } else {
          console.warn('⚠️ Roles API returned empty array');
        }
        
        return roles;
      },
    }),

    // ==================== AUTH ====================
    login: builder.mutation({
      query: ({ email, password }) => {
        if (__DEV__) {
          console.log('========== LOGIN REQUEST ==========');
          console.log('Email:', email);
          console.log('Password length:', password?.length || 0);
          console.log('URL:', '/api/login');
          console.log('===================================');
        }
        return {
          url: '/api/login',
          method: 'POST',
          body: { email, password },
        };
      },
      transformResponse: async (response, meta, arg) => {
        try {
          if (__DEV__) {
            console.log('========== LOGIN RESPONSE DEBUG ==========');
            console.log('Raw response:', response);
            console.log('Response type:', typeof response);
          }
          
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
            if (__DEV__) {
              console.error('No token in response. Full response:', data);
            }
            throw new Error('No token received from server');
          }
          
          if (__DEV__) {
            console.log('Token received, length:', token.length);
            console.log('Token preview:', token.substring(0, 50) + '...');
          }
          
          const decodedToken = decodeJWT(token);
          if (!decodedToken) {
            if (__DEV__) {
              console.error('Failed to decode JWT token');
            }
            throw new Error('Failed to decode authentication token');
          }
          
          if (__DEV__) {
            console.log('Decoded token:', decodedToken);
            console.log('Token Role field:', decodedToken.Role);
            console.log('Token Id field:', decodedToken.Id);
            console.log('All token fields:', Object.keys(decodedToken));
          }
          
          // Try different case variations for role
          const roleNumber = decodedToken.Role || decodedToken.role || decodedToken.RoleNumber || decodedToken.roleNumber;
          console.log('🔐 ========== LOGIN - ROLE EXTRACTION ==========');
          console.log('🔐 Extracted role number from token:', roleNumber);
          console.log('🔐 Token fields:', Object.keys(decodedToken));
          
          if (roleNumber === undefined || roleNumber === null) {
            console.error('❌ Role not found in token');
            throw new Error(`Role not found in token. Available fields: ${Object.keys(decodedToken).join(', ')}`);
          }
          
          console.log('🔐 Calling mapRoleNumberToString with role number:', roleNumber);
          const roleString = mapRoleNumberToString(roleNumber);
          
          if (!roleString) {
            console.error('❌ ========== ROLE MAPPING FAILED ==========');
            console.error('❌ Unknown role number:', roleNumber);
            console.error('❌ Available role mappings: 1=admin, 2=coral, 3=cad, 4=client');
            console.error('❌ ===========================================');
            throw new Error(`Unknown role: ${roleNumber}. Expected 1-4.`);
          }
          
          console.log('✅ ========== LOGIN - ROLE MAPPING SUCCESS ==========');
          console.log('✅ Role Number:', roleNumber);
          console.log('✅ Mapped Role String:', roleString);
          console.log('✅ ===================================================');
          
          // Try different case variations for ID
          const userId = decodedToken.Id || decodedToken.id || decodedToken.userId || decodedToken.UserId;
          
          // Try different case variations for name
          const userName = decodedToken.Name || decodedToken.name || decodedToken.username || decodedToken.Username || 
                          decodedToken.fullName || decodedToken.FullName || decodedToken.firstName || decodedToken.FirstName;
          
          if (__DEV__) {
            console.log('Mapped role:', roleString);
            console.log('User ID:', userId);
            console.log('User Name:', userName);
            console.log('All token fields:', Object.keys(decodedToken));
            console.log('==========================================');
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
              iat: decodedToken.iat,
            },
          };
        } catch (error) {
          if (__DEV__) {
            console.error('Login transform error:', error);
            console.error('Error message:', error.message);
            console.error('Full error:', error);
          }
          throw new Error(error.message || 'Login failed');
        }
      },
      transformErrorResponse: (response) => {
        if (__DEV__) {
          console.error('========== LOGIN ERROR RESPONSE ==========');
          console.error('Status:', response.status);
          console.error('Status text:', response.statusText);
          console.error('Error data:', response.data);
          console.error('Error:', response.error);
          console.error('Full response:', response);
          console.error('Base URL used:', API_BASE_URL);
          console.error('===========================================');
        }
        
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
          console.warn('Unexpected response format from /api/users:', data);
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
        // Add assignedTo filter for non-admin users (or when explicitly provided)
        if (assignedTo) {
          queryString += `&assignedTo=${encodeURIComponent(assignedTo)}`;
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
            console.log('🔐 ========== API CLIENT FILTER ==========');
            console.log('🔐 Adding clientId filter to API:', filters.clientId);
            console.log('🔐 Role:', role);
            console.log('🔐 User ID from token:', argUserId);
            console.log('🔐 Full filters:', filters);
            queryString += `&clientId=${encodeURIComponent(filters.clientId)}`;
            console.log('🔐 Final query string includes clientId filter');
            console.log('🔐 Expected: Backend should return enquiries where ClientId =', filters.clientId);
            console.log('🔐 =========================================');
          } else if (isClientRole && argUserId && (!filters.clientId || filters.clientId === 'all')) {
            // Fallback: For client users without a clientId filter, use userId as clientId
            console.log('🔐 ========== API CLIENT FILTER (FALLBACK) ==========');
            console.log('🔐 No clientId filter found, using userId as fallback:', argUserId);
            console.log('🔐 Role:', role);
            queryString += `&clientId=${encodeURIComponent(argUserId)}`;
            console.log('🔐 Final query string includes userId as clientId filter');
            console.log('🔐 Expected: Backend should return enquiries where ClientId =', argUserId);
            console.log('🔐 ===================================================');
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
        }
        
        const finalUrl = `/api/enquiries/search?${queryString}`;
        console.log('🌐 ========== ENQUIRIES API REQUEST ==========');
        console.log('🌐 URL:', finalUrl);
        console.log('🌐 Role:', role);
        console.log('🌐 AssignedTo:', assignedTo);
        console.log('🌐 Filters:', filters);
        console.log('🌐 ===========================================');
        return finalUrl;
      },
      providesTags: ['Enquiry'],
      transformResponse: (data, meta, arg) => {
        console.log('📥 ========== ENQUIRIES API RESPONSE ==========');
        console.log('📥 Raw response:', data);
        console.log('📥 Request args:', arg);
        const role = typeof arg === 'object' ? arg?.role : arg;
        const argUserId = typeof arg === 'object' ? arg?.userId : undefined;
        const isClientRole = role === 'client' || role === 'CL';
        if (isClientRole) {
          console.log('📥 Client user - backend should have filtered enquiries');
          console.log('📥 User ID:', argUserId);
          console.log('📥 If backend filtered correctly, these are the user\'s enquiries');
        }
        console.log('📥 ===========================================');
        
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
              console.log('📥 Enquiries received:', enquiriesArray.length);
              console.log('📥 Expected ClientId:', argUserId);
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
                  console.warn('📥 ⚠️ WARNING: No enquiries match user ID!');
                  console.warn('📥 ⚠️ This means enquiries were created with different ClientIds');
                  console.warn('📥 ⚠️ All enquiry ClientIds:', enquiriesArray.map(e => e.clientId || e.ClientId).filter(Boolean).slice(0, 10));
                }
              } else {
                console.log('📥 ⚠️ No enquiries returned - check backend filtering');
              }
            }
          } else if (Array.isArray(data)) {
            enquiriesArray = data;
          } else if (data.enquiries && Array.isArray(data.enquiries)) {
            enquiriesArray = data.enquiries;
          } else {
            console.warn('Unexpected response format from /api/enquiries/search:', data);
            return { data: [], pagination };
          }
        } else if (Array.isArray(data)) {
          enquiriesArray = data;
        } else {
          console.warn('Unexpected response format from /api/enquiries/search:', data);
          return { data: [], pagination };
        }
        
        // Normalize enquiry data from aggregated endpoint
        const normalizedEnquiries = enquiriesArray.map(enquiry => {
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
          } else if (status.includes('progress') || status === 'coral' || status === 'cad' || status === 'design approval pending') {
            normalizedStatus = 'in_progress';
          } else if (status.includes('completed') || status.includes('approved')) {
            normalizedStatus = 'completed';
          } else if (status.includes('rejected')) {
            normalizedStatus = 'rejected';
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
          
          return {
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
          if (__DEV__) {
            console.warn('getEnquiryById: Received null, undefined, or invalid enquiry for ID:', arg, 'Response:', enquiry);
          }
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
        } else if (status.includes('progress') || status === 'coral' || status === 'cad') {
          normalizedStatus = 'in_progress';
        } else if (status.includes('completed') || status.includes('approved')) {
          normalizedStatus = 'completed';
        } else if (status.includes('rejected')) {
          normalizedStatus = 'rejected';
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
          console.error('Error transforming enquiry data:', transformError);
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
        if (__DEV__) {
          console.warn('getEnquiryById: API error for ID:', arg, 'Status:', response.status, 'Data:', response.data);
        }
        return {
          error: true,
          message: response.data?.error || response.data?.message || 'Failed to load enquiry',
          status: response.status,
        };
      },
    }),

    createEnquiry: builder.mutation({
      queryFn: async (data, { dispatch }, extraOptions, baseQuery) => {
        console.log('🌐 ========== CREATE ENQUIRY API REQUEST ==========');
        console.log('🌐 Endpoint: POST /api/enquiries');
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
            console.error('❌ ===========================================');
            return result;
          }
          
          console.log('✅ API Success Response:', JSON.stringify(result.data, null, 2));
          console.log('✅ Response Summary:', {
            'Status': 'Success',
            'Enquiry ID': result.data?.id || result.data?._id || 'Not returned',
            'Name': result.data?.Name || result.data?.name || data.Name,
          });
          console.log('🌐 ===========================================');
          
          return result;
        } catch (error) {
          console.error('❌ API Request Exception:', error);
          console.error('❌ ===========================================');
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
          console.warn('Unexpected response format from /api/clients:', data);
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

    // ==================== STATUS STATISTICS ====================
    getStatusStatistics: builder.query({
      queryFn: async (arg, { dispatch }, extraOptions, baseQuery) => {
        try {
          // Fetch all status counts using aggregate endpoint without assignedTo filter
          const aggregateUrl = '/api/enquiries/aggregate?groupBy=status';
          
          if (__DEV__) {
            console.log('📊 [STATUS STATS API] Fetching from:', aggregateUrl);
          }
          
          const response = await baseQuery(aggregateUrl);
          
          if (__DEV__) {
            console.log('📊 [STATUS STATS API] Response:', JSON.stringify(response, null, 2));
          }
          
          if (response.error) {
            if (__DEV__) {
              console.error('📊 [STATUS STATS API] Error:', response.error);
            }
            return {
              error: {
                status: response.error.status || 'FETCH_ERROR',
                data: response.error.data || 'Failed to fetch status statistics',
              },
            };
          }

          const statusStats = Array.isArray(response.data) ? response.data : [];
          
          if (__DEV__) {
            console.log('📊 [STATUS STATS API] Parsed Status Stats:', statusStats);
            console.log('📊 [STATUS STATS API] Total Count:', statusStats.reduce((sum, item) => sum + (item.count || 0), 0));
          }
          
          return {
            data: {
              statusStats,
              total: statusStats.reduce((sum, item) => sum + (item.count || 0), 0),
            },
          };
        } catch (error) {
          if (__DEV__) {
            console.error('📊 [STATUS STATS API] Exception:', error);
          }
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
    // Dashboard data is computed from enquiries and clients
    // This uses queryFn to aggregate data from multiple endpoints
    getDashboardData: builder.query({
      queryFn: async (arg, { dispatch, getState }, extraOptions, baseQuery) => {
        try {
          // Extract role and userId from argument
          const role = typeof arg === 'object' ? arg?.role : arg;
          const userId = typeof arg === 'object' ? arg?.userId : undefined;
          
          // Determine if we should use aggregate endpoint
          // Admin: Use regular enquiries data (no aggregate)
          // Coral/CAD: Use aggregate endpoint with assignedTo filter
          // Client: Use aggregate endpoint with clientId filter (clientId = userId)
          const isAdmin = role === 'admin' || role === 'AD';
          const isClient = role === 'client' || role === 'CL';
          const shouldUseAggregate = !isAdmin && userId; // Only for non-admin users
          
          // Build aggregate URL - only for non-admin users
          // Client users: Filter by clientId (which equals userId)
          // Coral/CAD users: Filter by assignedTo (which equals userId)
          let aggregateUrl = null;
          if (shouldUseAggregate) {
            if (isClient) {
              // For client users, filter by clientId (not assignedTo)
              aggregateUrl = `/api/enquiries/aggregate?groupBy=status&clientId=${encodeURIComponent(userId)}`;
            } else {
              // For coral/cad users, filter by assignedTo
            aggregateUrl = `/api/enquiries/aggregate?groupBy=status&assignedTo=${encodeURIComponent(userId)}`;
            }
          }
          
          // Fetch data in parallel
          // Admin: Fetch ALL enquiries (use large limit to get all data for accurate counts)
          // Client: Fetch enquiries filtered by clientId (clientId = userId)
          // Coral/CAD: Fetch enquiries filtered by assignedTo (assignedTo = userId)
          let enquiriesSearchUrl;
          if (isAdmin) {
            enquiriesSearchUrl = '/api/enquiries/search?page=1&limit=10000'; // Fetch all enquiries for admin
          } else if (isClient) {
            // For client users, filter by clientId
            enquiriesSearchUrl = `/api/enquiries/search?page=1&clientId=${encodeURIComponent(userId)}`;
          } else {
            // For coral/cad users, filter by assignedTo
            enquiriesSearchUrl = `/api/enquiries/search?page=1&assignedTo=${encodeURIComponent(userId)}`;
          }
          
          const fetchPromises = [
            baseQuery(enquiriesSearchUrl),
            role === 'admin' ? baseQuery('/api/clients') : Promise.resolve({ data: [] }),
          ];
          
          // Only fetch aggregate for non-admin users
          if (shouldUseAggregate && aggregateUrl) {
            fetchPromises.unshift(baseQuery(aggregateUrl));
          } else {
            // For admin, add a resolved promise to maintain array structure
            fetchPromises.unshift(Promise.resolve({ data: null }));
          }
          
          const [statusAggregateResult, enquiriesResult, clientsResult] = await Promise.all(fetchPromises);

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
            in_progress: 0,
            rejected: 0,
            total: 0,
          };
          
          // Only process aggregate data for non-admin users (coral, cad, client)
          if (shouldUseAggregate && statusAggregateResult.data && !statusAggregateResult.error) {
            const aggregateData = statusAggregateResult.data;
            
            console.log('🔍 [DASHBOARD DEBUG] ============================================');
            console.log('🔍 [DASHBOARD DEBUG] Role:', role);
            console.log('🔍 [DASHBOARD DEBUG] UserId:', userId);
            console.log('🔍 [DASHBOARD DEBUG] Is Admin:', isAdmin);
            console.log('🔍 [DASHBOARD DEBUG] Is Client:', isClient);
            console.log('🔍 [DASHBOARD DEBUG] Should Use Aggregate:', shouldUseAggregate, '(boolean)');
            console.log('🔍 [DASHBOARD DEBUG] Aggregate URL:', aggregateUrl);
            console.log('🔍 [DASHBOARD DEBUG] Enquiries Search URL:', enquiriesSearchUrl);
            console.log('🔍 [DASHBOARD DEBUG] Status Aggregate API Response:', JSON.stringify(aggregateData, null, 2));
            
            // Handle different response formats
            if (Array.isArray(aggregateData)) {
              console.log('🔍 [DASHBOARD DEBUG] Aggregate data is an array with', aggregateData.length, 'items');
              
              aggregateData.forEach((item, index) => {
                const statusName = (item.name || item.status || item.Status || item._id || item.group || '').toUpperCase();
                const count = item.count || item.Count || item.value || item.total || 0;
                
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
                const status = statusName.toLowerCase();
                if (status === 'pending' || status === 'enquiry created' || status.includes('pending') || status === 'design approval pending') {
                  statusCounts.pending += count;
                } else if (status === 'completed' || status.includes('completed') || status.includes('approved')) {
                  statusCounts.completed += count;
                } else if (status === 'in_progress' || status.includes('progress') || status === 'coral' || status === 'cad') {
                  statusCounts.in_progress += count;
                } else if (status === 'rejected' || status.includes('rejected')) {
                  statusCounts.rejected += count;
                }
                statusCounts.total += count;
              });
            } else if (typeof aggregateData === 'object') {
              // Handle object format { pending: 10, completed: 5, ... }
              Object.keys(aggregateData).forEach(key => {
                const normalizedKey = key.toUpperCase();
                const value = aggregateData[key];
                
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
                const keyLower = normalizedKey.toLowerCase();
                if (keyLower === 'pending' || keyLower.includes('pending')) {
                  statusCounts.pending = value || 0;
                } else if (keyLower === 'completed' || keyLower.includes('completed')) {
                  statusCounts.completed = value || 0;
                } else if (keyLower === 'in_progress' || keyLower.includes('progress')) {
                  statusCounts.in_progress = value || 0;
                } else if (keyLower === 'rejected' || keyLower.includes('rejected')) {
                  statusCounts.rejected = value || 0;
                } else if (keyLower === 'total') {
                  statusCounts.total = value || 0;
                }
              });
            }
            
            console.log('🔍 [DASHBOARD DEBUG] Final Categorized Counts:', categorizedCounts);
            console.log('🔍 [DASHBOARD DEBUG] Final Status Counts (legacy):', statusCounts);
            console.log('🔍 [DASHBOARD DEBUG] Total from categorized counts:', categorizedCounts['All']);
            console.log('🔍 [DASHBOARD DEBUG] Total from status counts:', statusCounts.total);
          } else if (shouldUseAggregate && statusAggregateResult.error) {
            console.warn('🔍 [DASHBOARD DEBUG] Status aggregate API error, falling back to counting from enquiries:', statusAggregateResult.error);
          } else if (isAdmin) {
            console.log('🔍 [DASHBOARD DEBUG] Admin user - Using regular enquiries data (no aggregate endpoint)');
          }

          // Handle paginated response from new aggregated endpoint
          const enquiries = Array.isArray(enquiriesResult.data) 
            ? enquiriesResult.data 
            : (enquiriesResult.data?.data || enquiriesResult.data?.enquiries || []);
          
          // For admin, also check pagination total if available (more accurate than array length)
          const paginationTotal = enquiriesResult.data?.pagination?.total || enquiriesResult.data?.total || null;
          
          console.log('🔍 [DASHBOARD DEBUG] Enquiries from search API:', enquiries.length, 'enquiries');
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
            } else if (status.includes('progress') || status === 'coral' || status === 'cad' || status === 'design approval pending') {
              normalizedStatus = 'in_progress';
            } else if (status.includes('completed') || status.includes('approved')) {
              normalizedStatus = 'completed';
            } else if (status.includes('rejected')) {
              normalizedStatus = 'rejected';
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
          // Admin: Use regular enquiries data (count from normalizedEnquiries)
          // Non-admin (coral/cad/client): Use categorized counts from aggregate API
          if (role === 'admin') {
            // Admin: Count from normalizedEnquiries (all enquiries, no aggregate)
            // Use pagination total if available (more accurate), otherwise use array length
            const totalEnquiries = paginationTotal !== null ? paginationTotal : normalizedEnquiries.length;
            const pendingEnquiries = normalizedEnquiries.filter(e => e.status === 'pending').length;
            const approvalPendingEnquiries = normalizedEnquiries.filter(e => {
              const status = (e.status || '').toLowerCase();
              return status.includes('approval') && !status.includes('approved');
            }).length;
            const completedEnquiries = normalizedEnquiries.filter(e => {
              const status = (e.status || '').toLowerCase();
              return status.includes('completed') || status.includes('approved');
            }).length;
            const totalClients = clients.length;
            const revenue = normalizedEnquiries
              .filter(e => e.status === 'completed')
              .reduce((sum, e) => sum + (parseFloat(e.budget || e.estimatedPrice || 0)), 0);
            
            console.log('🔍 [DASHBOARD DEBUG] ============================================');
            console.log('🔍 [DASHBOARD DEBUG] ADMIN DASHBOARD CALCULATIONS (from enquiries data, NO aggregate):');
            console.log('🔍 [DASHBOARD DEBUG] - Total Enquiries:', totalEnquiries, '(from pagination.total:', paginationTotal, '| normalizedEnquiries.length:', normalizedEnquiries.length, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Pending Enquiries:', pendingEnquiries, '(counted from', normalizedEnquiries.length, 'enquiries)');
            console.log('🔍 [DASHBOARD DEBUG] - Approval Pending Enquiries:', approvalPendingEnquiries, '(counted from', normalizedEnquiries.length, 'enquiries)');
            console.log('🔍 [DASHBOARD DEBUG] - Completed Enquiries:', completedEnquiries, '(counted from', normalizedEnquiries.length, 'enquiries)');
            console.log('🔍 [DASHBOARD DEBUG] - Total Clients:', totalClients);
            console.log('🔍 [DASHBOARD DEBUG] - Revenue:', revenue);
            console.log('🔍 [DASHBOARD DEBUG] - Sum Check (Pending + Approval Pending + Completed):', pendingEnquiries + approvalPendingEnquiries + completedEnquiries);
            console.log('🔍 [DASHBOARD DEBUG] - Note: Status counts are from fetched enquiries array, total uses pagination.total if available');
            console.log('🔍 [DASHBOARD DEBUG] ============================================');
            
            return {
              data: {
                totalEnquiries,
                pendingEnquiries,
                approvalPendingEnquiries,
                completedEnquiries,
                totalClients,
                revenue,
                // Include categorized counts for direct access (empty for admin)
                categorizedCounts,
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
            
            console.log('🔍 [DASHBOARD DEBUG] ============================================');
            console.log('🔍 [DASHBOARD DEBUG] CLIENT DASHBOARD CALCULATIONS:');
            console.log('🔍 [DASHBOARD DEBUG] - My Enquiries:', myEnquiries, '(from categorizedCounts.All:', categorizedCounts['All'], '| statusCounts.total:', statusCounts.total, '| normalizedEnquiries.length:', normalizedEnquiries.length, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Pending:', pendingApprovals, '(from categorizedCounts.Pending:', categorizedCounts['Pending'], '| statusCounts.pending:', statusCounts.pending, '| counted:', pendingCount, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Approval Pending:', approvalPending, '(from categorizedCounts["Approval Pending"]:', categorizedCounts['Approval Pending'], '| counted:', approvalPendingCount, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Completed Orders:', completedOrders, '(from categorizedCounts.Completed:', categorizedCounts['Completed'], '| statusCounts.completed:', statusCounts.completed, '| counted:', completedCount, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Total Spent:', totalSpent);
            console.log('🔍 [DASHBOARD DEBUG] - Enquiries filtered by clientId:', normalizedEnquiries.length);
            console.log('🔍 [DASHBOARD DEBUG] ============================================');
            
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
            const pendingDesigns = categorizedCounts['Pending'] || statusCounts.pending || normalizedEnquiries.filter(e => e.status === 'pending').length;
            const approvalPendingDesigns = categorizedCounts['Approval Pending'] || 0;
            const averageRating = 4.8; // TODO: Fetch from API when available
            
            console.log('🔍 [DASHBOARD DEBUG] ============================================');
            console.log('🔍 [DASHBOARD DEBUG] DESIGNER DASHBOARD CALCULATIONS (from aggregate API):');
            console.log('🔍 [DASHBOARD DEBUG] - Role:', role, '(should use aggregate endpoint)');
            console.log('🔍 [DASHBOARD DEBUG] - Assigned Enquiries:', assignedEnquiries, '(from categorizedCounts.All:', categorizedCounts['All'], '| statusCounts.total:', statusCounts.total, '| normalizedEnquiries.length:', normalizedEnquiries.length, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Pending Designs:', pendingDesigns, '(from categorizedCounts.Pending:', categorizedCounts['Pending'], '| statusCounts.pending:', statusCounts.pending, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Approval Pending Designs:', approvalPendingDesigns, '(from categorizedCounts["Approval Pending"]:', categorizedCounts['Approval Pending'], ')');
            console.log('🔍 [DASHBOARD DEBUG] - Completed Designs:', completedDesigns, '(from categorizedCounts.Completed:', categorizedCounts['Completed'], '| statusCounts.completed:', statusCounts.completed, ')');
            console.log('🔍 [DASHBOARD DEBUG] - Sum Check (Pending + Approval Pending + Completed):', pendingDesigns + approvalPendingDesigns + completedDesigns);
            console.log('🔍 [DASHBOARD DEBUG] - Does sum match assigned?', (pendingDesigns + approvalPendingDesigns + completedDesigns) === assignedEnquiries);
            console.log('🔍 [DASHBOARD DEBUG] ============================================');
            
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
          console.error('Error loading dashboard data:', error);
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
      queryFn: async ({ enquiryId, designType, version, images, excel }, { dispatch }, extraOptions, baseQuery) => {
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
          
          if (__DEV__) {
            console.log(`Uploading ${designType} design for enquiry ${enquiryId}`);
            console.log(`Version: ${version}`);
            console.log(`Images: ${images?.length || 0}`);
            console.log(`Excel: ${excel ? 'Yes' : 'No'}`);
          }

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
            if (__DEV__) {
              console.log(`Design upload successful:`, data);
            }
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
              console.error(`❌ Design upload failed: Status ${response.status}`, errorData);
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
          if (__DEV__) {
            console.error('Design upload error:', error);
          }
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
        if (__DEV__) {
          console.log('Asset description updated:', response);
        }
        return response;
      },
      transformErrorResponse: (response) => {
        if (__DEV__) {
          console.error('Failed to update asset description:', response);
        }
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
        
        if (__DEV__) {
          console.log('========== APPROVE DESIGN VERSION API REQUEST ==========');
          console.log('URL:', `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`);
          console.log('Method: PUT');
          console.log('Body:', { IsApprovedVersion: true });
          console.log('========================================================');
        }
        
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
        if (__DEV__) {
          console.log('Design version approved:', response);
        }
        return response;
      },
      transformErrorResponse: (response) => {
        if (__DEV__) {
          console.error('Failed to approve design version:', response);
        }
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
        
        if (__DEV__) {
          console.log('========== SAVE PRICING API REQUEST ==========');
          console.log('URL:', `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`);
          console.log('Method: PUT');
          console.log('Body (pricing array):', JSON.stringify(pricingData, null, 2));
          console.log('=============================================');
        }
        
        return {
          url: `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`,
          method: 'PUT',
          body: pricingData, // Array of pricing objects
        };
      },
      invalidatesTags: (result, error, { enquiryId }) => [
        { type: 'Enquiry', id: enquiryId },
        'Enquiry',
        'Dashboard',
      ],
      transformResponse: (response) => {
        if (__DEV__) {
          console.log('✅ Pricing saved successfully:', response);
        }
        return response;
      },
      transformErrorResponse: (response) => {
        if (__DEV__) {
          console.error('❌ Failed to save pricing:', response);
        }
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
        if (__DEV__) {
          console.log('Design version rejected:', response);
        }
        return response;
      },
      transformErrorResponse: (response) => {
        if (__DEV__) {
          console.error('Failed to reject design version:', response);
        }
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
        
        if (__DEV__) {
          console.log('========== UPDATE SHOW TO CLIENT API REQUEST ==========');
          console.log('URL:', `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`);
          console.log('Method: PUT');
          console.log('Body:', { ShowToClient: showToClient });
          console.log('========================================================');
        }
        
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
        if (__DEV__) {
          console.log('ShowToClient updated:', response);
        }
        return response;
      },
      transformErrorResponse: (response) => {
        if (__DEV__) {
          console.error('Failed to update ShowToClient:', response);
        }
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
        
        if (__DEV__) {
          console.log('🗑️ ========== DELETE VERSION API ==========');
          console.log('🗑️ URL:', `/api/enquiries/${enquiryId}/upload/${designType}${versionParam}`);
          console.log('🗑️ Method: DELETE');
          console.log('🗑️ =========================================');
        }
        
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
        if (__DEV__) {
          console.log('✅ Version deleted successfully:', response);
        }
        return response;
      },
      transformErrorResponse: (response) => {
        if (__DEV__) {
          console.error('❌ Failed to delete version:', response);
        }
        return {
          status: response.status,
          data: response.data,
          error: response.data?.message || response.data?.error || 'Failed to delete version',
        };
      },
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
              if (__DEV__) {
                console.log(`Trying upload to: ${endpoint} with field: ${fieldName}`);
              }
              
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
                if (__DEV__) {
                  console.log(`Image upload successful to ${endpoint} with field ${fieldName}:`, data);
                }
                return { data };
              } else {
                if (__DEV__) {
                  const errorText = await response.text().catch(() => '');
                  console.log(`Upload failed at ${endpoint} with field ${fieldName}: Status ${response.status}`);
                }
              }
            } catch (error) {
              if (__DEV__) {
                console.log(`Upload error at ${endpoint} with field ${fieldName}:`, error.message);
              }
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
      query: (useCache = false) => {
        const cacheBuster = useCache ? '' : `?t=${Date.now()}`;
        return `/api/metal-prices/latest${cacheBuster}`;
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
      query: (data) => ({
        url: '/api/metal-prices',
        method: 'POST',
        body: {
          metal: data.metal || data.metalType,
          price: data.price,
          date: data.date || new Date().toISOString().split('T')[0],
        },
      }),
      invalidatesTags: ['MetalPrice'],
    }),

    updateMetalPrice: builder.mutation({
      query: ({ metal, ...data }) => ({
        url: `/api/metal-prices/${metal}`,
        method: 'PUT',
        body: {
          date: data.date || new Date().toISOString().split('T')[0],
          price: data.price,
        },
      }),
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
          console.log('========== PRICING CALCULATION REQUEST ==========');
          console.log('URL: /api/enquiries/pricingCalculate');
          console.log('Payload:', JSON.stringify(data, null, 2));
          console.log('================================================');
        }
        return {
          url: '/api/enquiries/pricingCalculate',
          method: 'POST',
          body: data,
        };
      },
      transformResponse: (response) => {
        if (__DEV__) {
          console.log('========== PRICING CALCULATION RESPONSE ==========');
          console.log('Response:', response);
          console.log('==================================================');
        }
        return response;
      },
      transformErrorResponse: (response) => {
        if (__DEV__) {
          console.error('========== PRICING CALCULATION ERROR ==========');
          console.error('Status:', response.status);
          console.error('Status text:', response.statusText);
          console.error('Error data:', response.data);
          console.error('Error status:', response.status);
          console.error('Full response:', JSON.stringify(response, null, 2));
          
          // Try to extract more details from error response
          if (response.data) {
            console.error('Error data details:');
            if (typeof response.data === 'string') {
              console.error('Error message (string):', response.data);
            } else if (typeof response.data === 'object') {
              console.error('Error object keys:', Object.keys(response.data));
              console.error('Error message:', response.data.message);
              console.error('Error error:', response.data.error);
              console.error('Error stack:', response.data.stack);
              console.error('Error details:', response.data.details);
            }
          }
          
          // Check for specific backend error pattern
          if (response.status === 500) {
            console.error('⚠️ 500 Internal Server Error detected');
            console.error('This is likely the "Cannot read properties of null (reading \'Pricing\')" error');
            console.error('Backend location: enquiry.service.js:933');
            console.error('Solution: Backend needs to add null check for client before accessing client.Pricing');
          }
          
          console.error('===============================================');
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
          console.log('Response type:', typeof data);
          console.log('Is Array?', Array.isArray(data));
          console.log('Request params:', arg);
          if (meta?.response) {
            console.log('Response status:', meta.response.status);
            console.log('Response URL:', meta.response.url);
          }
        }

        // Handle different response formats
        // According to the guide, response format is: { Total, page, limit, TotalPages, Data }
        let chatsArray = [];
        if (Array.isArray(data)) {
          // Check if this is an array of messages (need to aggregate) or chats
          if (data.length > 0 && data[0].message && data[0].enquiryId) {
            // This looks like messages - aggregate into chats by enquiryId
            if (__DEV__) {
              console.log('API returned messages, aggregating into chats...');
            }
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
            if (__DEV__) {
              console.warn('Unexpected response format from /api/chats:', data);
              console.warn('Expected format: { Total, page, limit, TotalPages, Data } or array');
            }
            return [];
          }
        } else {
          if (__DEV__) {
            console.warn('Unexpected response format from /api/chats:', data);
          }
          return [];
        }
        
        if (__DEV__) {
          console.log('Chats Array Length:', chatsArray.length);
          console.log('First Chat Item:', chatsArray[0]);
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
        
        if (__DEV__) {
          console.log('Normalized Chats:', normalizedChats);
          console.log('Normalized Chats Count:', normalizedChats.length);
        }
        
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
          if (__DEV__) {
            console.log(`getChatMessages API Request: ${API_BASE_URL}${url}`);
            console.log('For chatId:', chatId);
          }

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
            if (__DEV__) {
              console.error('❌ Backend returned HTML instead of JSON. This usually means the endpoint does not exist.');
              console.error('Expected endpoint: /api/message/:chatId/messages');
              console.error('ChatId:', chatId);
              console.error('Response preview:', responseText.substring(0, 200));
            }
            // Return empty array - messages will be empty but app won't crash
            return { data: [] };
          }

          // Try to parse as JSON
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            if (__DEV__) {
              console.error('❌ Failed to parse response as JSON:', parseError);
              console.error('Response text:', responseText.substring(0, 500));
            }
            // Return empty array if JSON parsing fails
            return { data: [] };
          }

          // Handle different response formats
          let messagesArray = [];
          let nextCursor = null;
          
          if (data && data.Data && Array.isArray(data.Data)) {
            // New format from guide
            messagesArray = data.Data;
            nextCursor = data.NextCursor || null;
          } else if (Array.isArray(data)) {
            messagesArray = data;
          } else if (data && data.messages && Array.isArray(data.messages)) {
            messagesArray = data.messages;
          } else if (data && data.data && Array.isArray(data.data)) {
            messagesArray = data.data;
          } else {
            if (__DEV__) {
              console.warn('Unexpected response format from /api/message/:chatId/messages:', data);
            }
            messagesArray = [];
          }

          if (__DEV__) {
            console.log('Messages Array Length after processing:', messagesArray.length);
            if (messagesArray.length > 0) {
              console.log('First message sample:', messagesArray[0]);
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
              console.error('❌ Error in getChatMessages queryFn:', error);
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

          if (__DEV__) {
            console.log(`Uploading chat media: ${file.name || 'unnamed'}`);
          }

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
            if (__DEV__) {
              console.log(`Chat media upload successful:`, data);
            }
            return { data };
          } else {
            const errorText = await response.text().catch(() => '');
            const errorData = errorText ? JSON.parse(errorText) : { message: 'Upload failed' };
            if (__DEV__) {
              console.error(`Chat media upload failed: Status ${response.status}`, errorData);
            }
            return {
              error: {
                status: response.status,
                data: errorData,
              },
            };
          }
        } catch (error) {
          if (__DEV__) {
            console.error('Chat media upload error:', error);
          }
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
  useCreateClientMutation,
  
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
  useUploadDesignMutation,
  useUpdateAssetDescriptionMutation,
  useApproveDesignVersionMutation,
  useRejectDesignVersionMutation,
  useUpdateShowToClientMutation,
  useDeleteDesignVersionMutation,
  
  // Chats
  useGetChatsQuery,
  useGetChatByEnquiryQuery,
  useGetChatMessagesQuery,
  useUploadChatMediaMutation,
  
  // Code Lists
  useGetRolesQuery,
} = api;

