import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeJWT, mapRoleNumberToString } from '../utils/helpers';

// API Configuration - same as current api.js
const getBaseUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000';
    } else {
      return 'http://localhost:3000';
    }
  }
  return 'http://localhost:3000';
};

const BASE_URL = getBaseUrl();

if (__DEV__) {
  console.log(`RTK Query API Base URL: ${BASE_URL}`);
}

// Base query with auth token injection
const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
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
  tagTypes: ['Enquiry', 'Client', 'MetalPrice', 'Dashboard', 'Chat'],
  endpoints: (builder) => ({
    // ==================== AUTH ====================
    login: builder.mutation({
      query: ({ email, password }) => ({
        url: '/api/login',
        method: 'POST',
        body: { email, password },
      }),
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
            throw new Error('No token received');
          }
          
          const decodedToken = decodeJWT(token);
          if (!decodedToken) {
            throw new Error('Failed to decode authentication token');
          }
          
          const roleString = mapRoleNumberToString(decodedToken.Role);
          if (!roleString) {
            throw new Error(`Unknown role: ${decodedToken.Role}`);
          }
          
          return {
            success: true,
            token,
            user: {
              id: decodedToken.Id,
              role: roleString,
              iat: decodedToken.iat,
            },
          };
        } catch (error) {
          throw new Error(error.message || 'Login failed');
        }
      },
      transformErrorResponse: (response) => {
        return {
          success: false,
          error: response.data?.message || response.data?.error || 'Login failed',
        };
      },
    }),

    // ==================== ENQUIRIES ====================
    getEnquiries: builder.query({
      query: (role) => '/api/enquiries',
      providesTags: ['Enquiry'],
      transformResponse: (data) => {
        // Handle different response formats
        let enquiriesArray = [];
        if (Array.isArray(data)) {
          enquiriesArray = data;
        } else if (data.enquiries && Array.isArray(data.enquiries)) {
          enquiriesArray = data.enquiries;
        } else if (data.data && Array.isArray(data.data)) {
          enquiriesArray = data.data;
        } else {
          console.warn('Unexpected response format from /api/enquiries:', data);
          return [];
        }
        
        // Normalize enquiry data (exact logic from current api.js)
        return enquiriesArray.map(enquiry => {
          // Extract current status from StatusHistory
          let currentStatus = 'pending';
          let createdAt = new Date().toISOString();
          let updatedAt = new Date().toISOString();
          
          if (enquiry.StatusHistory && Array.isArray(enquiry.StatusHistory) && enquiry.StatusHistory.length > 0) {
            const sortedHistory = [...enquiry.StatusHistory].sort((a, b) => 
              new Date(b.Timestamp || b.timestamp || 0) - new Date(a.Timestamp || a.timestamp || 0)
            );
            const latestStatus = sortedHistory[0];
            currentStatus = latestStatus.Status || latestStatus.status || 'pending';
            updatedAt = latestStatus.Timestamp || latestStatus.timestamp || updatedAt;
            
            const firstStatus = sortedHistory[sortedHistory.length - 1];
            createdAt = firstStatus.Timestamp || firstStatus.timestamp || createdAt;
          }
          
          // Normalize priority
          let normalizedPriority = 'medium';
          const priority = (enquiry.Priority || enquiry.priority || '').toLowerCase();
          if (priority.includes('urgent') || priority === 'high') {
            normalizedPriority = 'high';
          } else if (priority === 'low') {
            normalizedPriority = 'low';
          } else {
            normalizedPriority = 'medium';
          }
          
          // Normalize status
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
          
          // Extract metal type info
          const metalColor = enquiry.Metal?.Color || enquiry.metal?.color || '';
          const metalQuality = enquiry.Metal?.Quality || enquiry.metal?.quality || '';
          const metalType = metalColor ? `${metalColor}${metalQuality ? ` (${metalQuality})` : ''}` : 'N/A';
          
          // Get budget from Coral pricing
          let budget = 0;
          if (enquiry.Coral && Array.isArray(enquiry.Coral) && enquiry.Coral.length > 0) {
            const latestCoral = enquiry.Coral[enquiry.Coral.length - 1];
            if (latestCoral.Pricing?.TotalPrice) {
              budget = latestCoral.Pricing.TotalPrice;
            }
          }
          
          return {
            id: enquiry._id || enquiry.id,
            title: enquiry.Name || enquiry.name || enquiry.title || 'Untitled Enquiry',
            clientId: enquiry.ClientId || enquiry.clientId || '',
            clientName: enquiry.ClientName || enquiry.clientName || 'Unknown Client',
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
            CoralCode: enquiry.CoralCode,
            CadCode: enquiry.CadCode,
            _originalData: enquiry,
          };
        });
      },
    }),

    getEnquiryById: builder.query({
      query: (id) => `/api/enquiries/${id}`,
      providesTags: (result, error, id) => {
        // Only provide tags if result is not null/error
        if (result && result.id && !result.error) {
          return [{ type: 'Enquiry', id }];
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
      query: (data) => ({
        url: '/api/enquiries',
        method: 'POST',
        body: data,
      }),
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
          id: client.Id || client.id,
          name: client.Name || client.name || 'Unknown Client',
          email: client.Email || client.email || 'N/A',
          phone: client.Phone || client.phone || 'N/A',
          totalOrders: client.TotalOrders || client.totalOrders || 0,
          totalSpent: client.TotalSpent || client.totalSpent || 0,
          lastOrder: client.LastOrder || client.lastOrder || null,
        }));
      },
    }),

    // ==================== DASHBOARD ====================
    // Dashboard data is computed from enquiries and clients
    // This uses queryFn to aggregate data from multiple endpoints
    getDashboardData: builder.query({
      queryFn: async (role, { dispatch, getState }, extraOptions, baseQuery) => {
        try {
          // Fetch enquiries and clients in parallel
          const [enquiriesResult, clientsResult] = await Promise.all([
            baseQuery('/api/enquiries'),
            role === 'admin' ? baseQuery('/api/clients') : Promise.resolve({ data: [] }),
          ]);

          const enquiries = Array.isArray(enquiriesResult.data) 
            ? enquiriesResult.data 
            : (enquiriesResult.data?.enquiries || enquiriesResult.data?.data || []);

          const clients = role === 'admin' && clientsResult.data
            ? (Array.isArray(clientsResult.data) 
                ? clientsResult.data 
                : (clientsResult.data?.clients || clientsResult.data?.data || []))
            : [];

          // Normalize enquiries (same logic as getEnquiries)
          const normalizedEnquiries = enquiries.map(enquiry => {
            let currentStatus = 'pending';
            let createdAt = new Date().toISOString();
            let updatedAt = new Date().toISOString();
            
            if (enquiry.StatusHistory && Array.isArray(enquiry.StatusHistory) && enquiry.StatusHistory.length > 0) {
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
            const priority = (enquiry.Priority || enquiry.priority || '').toLowerCase();
            if (priority.includes('urgent') || priority === 'high') {
              normalizedPriority = 'high';
            } else if (priority === 'low') {
              normalizedPriority = 'low';
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
          if (role === 'admin') {
            const totalEnquiries = normalizedEnquiries.length;
            const pendingEnquiries = normalizedEnquiries.filter(e => e.status === 'pending').length;
            const completedEnquiries = normalizedEnquiries.filter(e => e.status === 'completed').length;
            const totalClients = clients.length;
            const revenue = normalizedEnquiries
              .filter(e => e.status === 'completed')
              .reduce((sum, e) => sum + (parseFloat(e.budget || e.estimatedPrice || 0)), 0);
            
            return {
              data: {
                totalEnquiries,
                pendingEnquiries,
                completedEnquiries,
                totalClients,
                revenue,
              },
            };
          } else if (role === 'client') {
            const myEnquiries = normalizedEnquiries.length;
            const pendingApprovals = normalizedEnquiries.filter(e => e.status === 'pending').length;
            const completedOrders = normalizedEnquiries.filter(e => e.status === 'completed').length;
            const totalSpent = normalizedEnquiries
              .filter(e => e.status === 'completed')
              .reduce((sum, e) => sum + (parseFloat(e.budget || e.estimatedPrice || 0)), 0);
            
            return {
              data: {
                myEnquiries,
                pendingApprovals,
                completedOrders,
                totalSpent,
              },
            };
          } else if (role === 'coral' || role === 'cad') {
            const assignedEnquiries = normalizedEnquiries.length;
            const completedDesigns = normalizedEnquiries.filter(e => e.status === 'completed').length;
            const pendingDesigns = normalizedEnquiries.filter(e => e.status === 'pending' || e.status === 'in_progress').length;
            const averageRating = 4.8; // TODO: Fetch from API when available
            
            return {
              data: {
                assignedEnquiries,
                completedDesigns,
                pendingDesigns,
                averageRating,
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
    uploadImage: builder.mutation({
      queryFn: async (image, { dispatch }, extraOptions, baseQuery) => {
        // Try multiple possible upload endpoints
        const uploadEndpoints = [
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
              
              const response = await fetch(`${BASE_URL}${endpoint}`, {
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

    // ==================== CHATS ====================
    getChats: builder.query({
      query: () => '/api/chats',
      providesTags: ['Chat'],
      transformResponse: (data) => {
        if (__DEV__) {
          console.log('getChats API Response (raw):', data);
          console.log('Response type:', typeof data);
          console.log('Is Array?', Array.isArray(data));
        }

        // Handle different response formats
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
        } else if (data.chats && Array.isArray(data.chats)) {
          chatsArray = data.chats;
        } else if (data.data && Array.isArray(data.data)) {
          chatsArray = data.data;
        } else {
          console.warn('Unexpected response format from /api/chats:', data);
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
          
          return {
            id: chatId,
            enquiryId: enquiryId || chat.Enquiry?.id || chat.enquiry?.id,
            enquiryTitle: chat.EnquiryTitle || chat.enquiryTitle || chat.Enquiry?.Name || chat.Enquiry?.title || 'Untitled Chat',
            clientName: chat.ClientName || chat.clientName || chat.Client?.Name || chat.client?.name || 'Unknown Client',
            lastMessage: chat.LastMessage || chat.lastMessage || chat.message || '',
            lastMessageTime: lastMessageTime || new Date().toISOString(),
            unreadCount: chat.UnreadCount || chat.unreadCount || chat.unread || 0,
            isGroup: chat.IsGroup || chat.isGroup || false,
            participants: chat.Participants || chat.participants || [],
            lastSender: chat.LastSender || chat.lastSender || chat.sender || '',
            status: chat.Status || chat.status || 'active',
            isClient: chat.IsClient || chat.isClient || false,
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
      query: (enquiryId) => {
        const url = `/api/chats/${enquiryId}`;
        if (__DEV__) {
          console.log(`getChatMessages API Request: ${BASE_URL}${url}`);
          console.log('For enquiryId:', enquiryId);
        }
        return url;
      },
      providesTags: (result, error, enquiryId) => [{ type: 'Chat', id: enquiryId }],
      transformResponse: (data, meta, enquiryId) => {
        if (__DEV__) {
          console.log('========== getChatMessages API Response ==========');
          console.log('Full Response:', JSON.stringify(data, null, 2));
          console.log('Response type:', typeof data);
          console.log('Is Array?', Array.isArray(data));
          console.log('Response length:', Array.isArray(data) ? data.length : 'N/A');
          console.log('EnquiryId requested:', enquiryId);
          console.log('Response keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A');
          console.log('==============================================');
        }

        // Handle different response formats
        let messagesArray = [];
        if (Array.isArray(data)) {
          messagesArray = data;
        } else if (data && data.messages && Array.isArray(data.messages)) {
          messagesArray = data.messages;
        } else if (data && data.data && Array.isArray(data.data)) {
          messagesArray = data.data;
        } else if (data && typeof data === 'object' && !Array.isArray(data)) {
          // If it's an object but not an array, check for common message fields
          console.warn('Response is object but not in expected format:', data);
          messagesArray = [];
        } else {
          console.warn('Unexpected response format from /api/chats/:enquiryId:', data);
          messagesArray = [];
        }
        
        if (__DEV__) {
          console.log('Messages Array Length after processing:', messagesArray.length);
          if (messagesArray.length > 0) {
            console.log('First message sample:', messagesArray[0]);
          }
        }
        
        return messagesArray.map((message, index) => {
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
            id: messageId || `msg-${index}`,
            text: text,
            senderId: senderId,
            senderName: message.senderName || message.SenderName || message.sender?.name || 'Unknown',
            senderRole: message.senderRole || message.SenderRole || message.sender?.role || 'user',
            timestamp: timestamp,
            messageType: messageType,
            mediaKey: mediaKey,
            mediaName: mediaName,
            status: message.status || message.Status || 'sent',
            isGroup: message.isGroup || message.IsGroup || false,
            // Preserve original data
            _originalData: message,
          };
        }).sort((a, b) => {
          // Sort by timestamp ascending (oldest first)
          return new Date(a.timestamp) - new Date(b.timestamp);
        });
      },
    }),
  }),
});

// Export hooks for usage in components
export const {
  // Auth
  useLoginMutation,
  
  // Enquiries
  useGetEnquiriesQuery,
  useGetEnquiryByIdQuery,
  useCreateEnquiryMutation,
  useUpdateEnquiryMutation,
  useDeleteEnquiryMutation,
  
  // Clients
  useGetClientsQuery,
  
  // Dashboard
  useGetDashboardDataQuery,
  
  // Metal Prices
  useGetMetalPricesQuery,
  useAddMetalPriceMutation,
  useUpdateMetalPriceMutation,
  useDeleteMetalPriceMutation,
  
  // File Upload
  useUploadImageMutation,
  
  // Chats
  useGetChatsQuery,
  useGetChatMessagesQuery,
} = api;

