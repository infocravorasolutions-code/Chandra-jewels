# Migration Plan: Current Structure → Redux + RTK Query

## 📋 Migration Overview

This document shows how to migrate from your current structure to Redux Toolkit + RTK Query.

### Current Structure
```
src/
├── context/
│   └── AuthContext.js          # Context API for auth
├── services/
│   └── api.js                  # All API calls (manual)
└── screens/
    └── ...                     # Components with local state
```

### Target Structure
```
src/
├── store/
│   ├── index.js                # Redux store
│   └── api.ts                  # RTK Query API
├── features/
│   ├── auth/
│   │   └── authSlice.js        # Auth state
│   └── enquiries/
│       ├── enquiriesSlice.js   # UI state
│       └── enquiriesHooks.js   # Custom hooks
└── screens/
    └── ...                     # Components using Redux
```

---

## 🚀 Step-by-Step Migration

### STEP 1: Install Dependencies

```bash
npm install @reduxjs/toolkit react-redux
```

---

### STEP 2: Create Base Store Structure

#### 2.1 Create `src/store/index.js`

**NEW FILE** - Store configuration

```javascript
import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import authReducer from '../features/auth/authSlice';
import enquiriesReducer from '../features/enquiries/enquiriesSlice';
import clientsReducer from '../features/clients/clientsSlice';
import metalPricesReducer from '../features/metalPrices/metalPricesSlice';

export const store = configureStore({
  reducer: {
    api: api.reducer, // RTK Query reducer
    auth: authReducer,
    enquiries: enquiriesReducer,
    clients: clientsReducer,
    metalPrices: metalPricesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware), // Required for RTK Query
});

export default store;
```

#### 2.2 Wrap App with Provider

**MODIFY** `src/index.js` or `App.js`

```javascript
// BEFORE
import App from './App';

export default App;

// AFTER
import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';

export default function Root() {
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
}
```

---

### STEP 3: Create RTK Query API (Main Migration)

#### 3.1 Create `src/store/api.ts`

**NEW FILE** - Convert all API calls from `api.js` to RTK Query

This is the BIG migration step. Here's how to convert:

**BEFORE (Current `api.js`):**
```javascript
export const api = {
  login: async (email, password) => {
    const response = await fetch(loginUrl, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return await response.json();
  },
  
  getEnquiries: async (role) => {
    const response = await authenticatedFetch(enquiriesUrl);
    return await response.json();
  },
  // ... more methods
};
```

**AFTER (RTK Query `store/api.ts`):**
```javascript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeJWT, mapRoleNumberToString } from '../utils/helpers';

const getBaseUrl = () => {
  if (__DEV__) {
    return Platform.OS === 'android' 
      ? 'http://10.0.2.2:3000' 
      : 'http://localhost:3000';
  }
  return 'http://localhost:3000';
};

const baseQuery = fetchBaseQuery({
  baseUrl: getBaseUrl(),
  prepareHeaders: async (headers) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Enquiry', 'Client', 'MetalPrice', 'Dashboard'],
  endpoints: (builder) => ({
    // Convert login
    login: builder.mutation({
      query: ({ email, password }) => ({
        url: '/api/login',
        method: 'POST',
        body: { email, password },
      }),
      transformResponse: (response, meta, arg) => {
        // Transform response to match your current format
        const token = typeof response === 'string' 
          ? response 
          : response.token || response.accessToken;
        
        if (!token) {
          throw new Error('No token received');
        }
        
        const decodedToken = decodeJWT(token);
        const roleString = mapRoleNumberToString(decodedToken.Role);
        
        return {
          success: true,
          token: token,
          user: {
            id: decodedToken.Id,
            role: roleString,
            iat: decodedToken.iat,
          },
        };
      },
    }),
    
    // Convert getEnquiries
    getEnquiries: builder.query({
      query: (role) => '/api/enquiries',
      providesTags: ['Enquiry'],
      transformResponse: (response) => {
        // Apply same normalization logic from your current api.js
        let enquiriesArray = [];
        if (Array.isArray(response)) {
          enquiriesArray = response;
        } else if (response.enquiries) {
          enquiriesArray = response.enquiries;
        }
        
        // Normalize each enquiry (copy logic from current api.js)
        return enquiriesArray.map(enquiry => {
          // ... normalization logic (same as current api.js lines 299-393)
        });
      },
    }),
    
    // Convert getEnquiryById
    getEnquiryById: builder.query({
      query: (id) => `/api/enquiries/${id}`,
      providesTags: (result, error, id) => [{ type: 'Enquiry', id }],
      transformResponse: (enquiry) => {
        // Copy normalization logic from current api.js lines 441-635
      },
    }),
    
    // Convert createEnquiry
    createEnquiry: builder.mutation({
      query: (data) => ({
        url: '/api/enquiries',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Enquiry', 'Dashboard'],
    }),
    
    // Convert updateEnquiry
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
    
    // Convert deleteEnquiry
    deleteEnquiry: builder.mutation({
      query: (id) => ({
        url: `/api/enquiries/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Enquiry', 'Dashboard'],
    }),
    
    // Convert getClients
    getClients: builder.query({
      query: () => '/api/clients',
      providesTags: ['Client'],
      transformResponse: (response) => {
        // Copy normalization logic from current api.js
        let clientsArray = [];
        if (Array.isArray(response)) {
          clientsArray = response;
        } else if (response.clients) {
          clientsArray = response.clients;
        }
        
        return clientsArray.map(client => ({
          id: client.Id || client.id,
          name: client.Name || client.name,
          email: client.Email || client.email,
          phone: client.Phone || client.phone,
          totalOrders: client.TotalOrders || 0,
          totalSpent: client.TotalSpent || 0,
        }));
      },
    }),
    
    // Convert getMetalPrices
    getMetalPrices: builder.query({
      query: () => '/api/metal-prices/latest',
      providesTags: ['MetalPrice'],
      transformResponse: (data) => {
        // Copy normalization logic from current api.js lines 1036-1128
      },
    }),
    
    // Convert addMetalPrice
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
    
    // Convert updateMetalPrice
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
    
    // Convert deleteMetalPrice
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
    
    // Convert getDashboardData (or compute from queries)
    // Option 1: Keep as computed (recommended)
    // Option 2: Create separate endpoint if backend has it
  }),
});

// Auto-generated hooks
export const {
  useLoginMutation,
  useGetEnquiriesQuery,
  useGetEnquiryByIdQuery,
  useCreateEnquiryMutation,
  useUpdateEnquiryMutation,
  useDeleteEnquiryMutation,
  useGetClientsQuery,
  useGetMetalPricesQuery,
  useAddMetalPriceMutation,
  useUpdateMetalPriceMutation,
  useDeleteMetalPriceMutation,
} = api;
```

---

### STEP 4: Migrate Auth from Context to Redux

#### 4.1 Create `src/features/auth/authSlice.js`

**NEW FILE** - Replace AuthContext

**BEFORE (Context):**
```javascript
// AuthContext.js
const [user, setUser] = useState(null);
const [isLoading, setIsLoading] = useState(true);

const login = async (email, password) => {
  const result = await api.login(email, password);
  if (result.success) {
    setUser(result.user);
    await AsyncStorage.setItem('token', result.token);
  }
};
```

**AFTER (Redux Slice):**
```javascript
import { createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLoginMutation } from '../../store/api';

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setUser, setLoading, logout } = authSlice.actions;
export default authSlice.reducer;
```

#### 4.2 Create `src/features/auth/authThunks.js` (Optional)

**NEW FILE** - Async auth actions

```javascript
import { createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setUser, logout } from './authSlice';

// Check auth state on app start
export const checkAuthState = createAsyncThunk(
  'auth/checkAuthState',
  async (_, { dispatch }) => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const storedToken = await AsyncStorage.getItem('token');
      
      if (storedUser && storedToken) {
        const userData = JSON.parse(storedUser);
        dispatch(setUser(userData));
        return { user: userData, token: storedToken };
      }
      return null;
    } catch (error) {
      console.error('Error checking auth state:', error);
      return null;
    }
  }
);

// Handle logout
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
    dispatch(logout());
  }
);
```

#### 4.3 Update components to use Redux

**BEFORE:**
```javascript
import { useAuth } from '../../context/AuthContext';

const MyComponent = () => {
  const { user, login } = useAuth();
};
```

**AFTER:**
```javascript
import { useSelector, useDispatch } from 'react-redux';
import { useLoginMutation } from '../../store/api';
import { setUser } from '../../features/auth/authSlice';

const MyComponent = () => {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const [loginMutation, { isLoading }] = useLoginMutation();
  
  const handleLogin = async (email, password) => {
    try {
      const result = await loginMutation({ email, password }).unwrap();
      if (result.success) {
        dispatch(setUser(result.user));
        await AsyncStorage.setItem('token', result.token);
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
};
```

---

### STEP 5: Create Feature Slices for UI State

#### 5.1 Create `src/features/enquiries/enquiriesSlice.js`

**NEW FILE** - Move UI state from components

**BEFORE (Component state):**
```javascript
// EnquiryListScreen.js
const [filters, setFilters] = useState({
  status: 'all',
  priority: 'all',
  client: 'all',
});
const [searchQuery, setSearchQuery] = useState('');
const [sortBy, setSortBy] = useState('createdAt');
```

**AFTER (Redux slice):**
```javascript
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  filters: {
    status: 'all',
    priority: 'all',
    client: 'all',
  },
  searchQuery: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  selectedEnquiryId: null,
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
    clearFilters: (state) => {
      state.filters = initialState.filters;
      state.searchQuery = '';
    },
  },
});

export const { setFilters, setSearchQuery, setSorting, clearFilters } = 
  enquiriesSlice.actions;
export default enquiriesSlice.reducer;
```

---

### STEP 6: Create Custom Hooks

#### 6.1 Create `src/features/enquiries/enquiriesHooks.js`

**NEW FILE** - Combine RTK Query + UI state

```javascript
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useGetEnquiriesQuery } from '../../store/api';

export const useFilteredEnquiries = (role) => {
  const { data: enquiries = [], isLoading, error, refetch } = 
    useGetEnquiriesQuery(role);
  
  const filters = useSelector(state => state.enquiries.filters);
  const searchQuery = useSelector(state => state.enquiries.searchQuery);
  const sortBy = useSelector(state => state.enquiries.sortBy);
  const sortOrder = useSelector(state => state.enquiries.sortOrder);

  const filteredEnquiries = useMemo(() => {
    let filtered = [...enquiries];
    
    // Apply filters
    if (filters.status !== 'all') {
      filtered = filtered.filter(e => e.status === filters.status);
    }
    if (filters.client !== 'all') {
      filtered = filtered.filter(e => e.clientName === filters.client);
    }
    if (searchQuery) {
      filtered = filtered.filter(e => 
        e.title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortBy] || '';
      const bValue = b[sortBy] || '';
      return sortOrder === 'asc' 
        ? (aValue > bValue ? 1 : -1)
        : (aValue < bValue ? 1 : -1);
    });
    
    return filtered;
  }, [enquiries, filters, searchQuery, sortBy, sortOrder]);

  return {
    enquiries: filteredEnquiries,
    allEnquiries: enquiries,
    isLoading,
    error,
    refetch,
  };
};
```

---

### STEP 7: Migrate Components

#### 7.1 Migrate `DashboardScreen.js`

**BEFORE:**
```javascript
const DashboardScreen = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const data = await api.getDashboardData(user?.role);
    setDashboardData(data);
    
    if (user?.role === 'admin') {
      const clientsData = await api.getClients();
      const enquiriesData = await api.getEnquiries(user?.role);
      // ... process data
    }
    setLoading(false);
  };
};
```

**AFTER:**
```javascript
import { useSelector } from 'react-redux';
import { useGetEnquiriesQuery, useGetClientsQuery } from '../../store/api';
import { useMemo } from 'react';

const DashboardScreen = () => {
  const user = useSelector(state => state.auth.user);
  
  // ✅ Automatic caching - no duplicate calls!
  const { data: enquiries = [], isLoading: enquiriesLoading } = 
    useGetEnquiriesQuery(user?.role, { skip: !user });
  const { data: clients = [], isLoading: clientsLoading } = 
    useGetClientsQuery(undefined, { skip: user?.role !== 'admin' });

  // Compute dashboard data from cached enquiries/clients
  const dashboardData = useMemo(() => {
    if (!enquiries.length) return null;
    
    return {
      totalEnquiries: enquiries.length,
      pendingEnquiries: enquiries.filter(e => e.status === 'pending').length,
      completedEnquiries: enquiries.filter(e => e.status === 'completed').length,
      totalClients: clients.length,
      revenue: enquiries
        .filter(e => e.status === 'completed')
        .reduce((sum, e) => sum + (e.budget || 0), 0),
    };
  }, [enquiries, clients]);

  const clientsWithCounts = useMemo(() => {
    return clients.map(client => ({
      ...client,
      enquiryCount: enquiries.filter(
        e => e.clientId === client.id || e.clientName === client.name
      ).length,
    }));
  }, [clients, enquiries]);

  const loading = enquiriesLoading || clientsLoading;
};
```

#### 7.2 Migrate `EnquiryListScreen.js`

**BEFORE:**
```javascript
const EnquiryListScreen = () => {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'all' });

  useEffect(() => {
    loadEnquiries();
  }, []);

  const loadEnquiries = async () => {
    setLoading(true);
    const data = await api.getEnquiries(user?.role);
    setEnquiries(data);
    setLoading(false);
  };

  useEffect(() => {
    applyFilters();
  }, [enquiries, filters]);
};
```

**AFTER:**
```javascript
import { useSelector, useDispatch } from 'react-redux';
import { useFilteredEnquiries } from '../../features/enquiries/enquiriesHooks';
import { setFilters, setSearchQuery } from '../../features/enquiries/enquiriesSlice';

const EnquiryListScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  
  // ✅ One hook handles everything!
  const { enquiries, isLoading, refetch } = useFilteredEnquiries(user?.role);
  
  // ✅ Filters are in Redux - shared across screens
  const filters = useSelector(state => state.enquiries.filters);

  const handleFilterChange = (newFilters) => {
    dispatch(setFilters(newFilters));
    // No API call needed - uses cached data!
  };

  const onRefresh = () => {
    refetch(); // Refetch from RTK Query
  };
};
```

#### 7.3 Migrate `SingleEnquiryScreen.js`

**BEFORE:**
```javascript
const SingleEnquiryScreen = ({ route }) => {
  const [enquiry, setEnquiry] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEnquiry();
  }, []);

  const loadEnquiry = async () => {
    setLoading(true);
    const data = await api.getEnquiryById(enquiryId);
    setEnquiry(data);
    setLoading(false);
  };
};
```

**AFTER:**
```javascript
import { useGetEnquiryByIdQuery } from '../../store/api';

const SingleEnquiryScreen = ({ route }) => {
  const { enquiryId } = route.params;
  
  // ✅ Automatically uses cache if already fetched!
  const { data: enquiry, isLoading, error } = 
    useGetEnquiryByIdQuery(enquiryId, { skip: !enquiryId });
};
```

---

## 📝 Migration Checklist

### Phase 1: Setup (Do First)
- [ ] Install dependencies (`@reduxjs/toolkit`, `react-redux`)
- [ ] Create `src/store/index.js`
- [ ] Wrap app with `<Provider store={store}>`
- [ ] Create `src/store/api.ts` structure

### Phase 2: API Migration (Biggest Step)
- [ ] Convert `login` to RTK Query mutation
- [ ] Convert `getEnquiries` to RTK Query query
- [ ] Convert `getEnquiryById` to RTK Query query
- [ ] Convert `createEnquiry` to RTK Query mutation
- [ ] Convert `updateEnquiry` to RTK Query mutation
- [ ] Convert `deleteEnquiry` to RTK Query mutation
- [ ] Convert `getClients` to RTK Query query
- [ ] Convert metal prices endpoints
- [ ] Test each endpoint conversion

### Phase 3: Auth Migration
- [ ] Create `src/features/auth/authSlice.js`
- [ ] Create `src/features/auth/authThunks.js`
- [ ] Update `LoginScreen.js` to use Redux
- [ ] Update all components using `useAuth()` hook
- [ ] Remove `AuthContext.js` (or keep temporarily)

### Phase 4: UI State Migration
- [ ] Create `src/features/enquiries/enquiriesSlice.js`
- [ ] Create `src/features/clients/clientsSlice.js`
- [ ] Create `src/features/metalPrices/metalPricesSlice.js`
- [ ] Create custom hooks for each feature

### Phase 5: Component Migration (One by One)
- [ ] Migrate `DashboardScreen.js`
- [ ] Migrate `EnquiryListScreen.js`
- [ ] Migrate `SingleEnquiryScreen.js`
- [ ] Migrate `AddEnquiryStep1Screen.js`
- [ ] Migrate `AddEnquiryStep2Screen.js`
- [ ] Migrate `ClientsListScreen.js`
- [ ] Migrate `MetalPricesScreen.js`
- [ ] Test each screen thoroughly

### Phase 6: Cleanup
- [ ] Remove old `AuthContext.js`
- [ ] Keep `api.js` temporarily as backup
- [ ] Remove unused imports
- [ ] Test entire app flow
- [ ] Delete `api.js` when confident

---

## ⚠️ Important Notes

1. **Gradual Migration**: Migrate one feature at a time. Don't do everything at once.

2. **Keep Old Code**: Keep `api.js` and `AuthContext.js` until migration is complete and tested.

3. **Test Frequently**: Test each migrated screen before moving to the next.

4. **Normalization Logic**: Copy the exact normalization logic from your current `api.js` to `transformResponse` in RTK Query.

5. **Error Handling**: RTK Query has built-in error handling, but you may need to customize error messages.

---

## 🎯 Benefits After Migration

- ✅ **Performance**: No duplicate API calls (automatic caching)
- ✅ **State Sharing**: Easy state sharing across screens
- ✅ **Less Code**: Hooks are 3 lines instead of 20+
- ✅ **Auto-loading States**: Built-in `isLoading`, `isFetching`, `error`
- ✅ **Background Refetching**: Automatic data refresh
- ✅ **Offline Support**: Ready for future implementation

