# Migration Examples: Before & After Code Comparison

This document shows detailed before/after code examples for migrating your current structure to Redux + RTK Query.

---

## 🔄 Example 1: Login Flow

### BEFORE (Current - Context API + Manual API)

**AuthContext.js:**
```javascript
const login = async (email, password) => {
  setIsLoading(true);
  try {
    const result = await api.login(email, password);
    
    if (result.success) {
      const userData = {
        id: result.user.id,
        role: result.user.role,
        email: email,
        name: getDisplayName(email, result.user.role),
      };
      
      setUser(userData);
      setIsAuthenticated(true);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('token', result.token);
      return { success: true, user: userData };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    setIsLoading(false);
  }
};
```

**LoginScreen.js:**
```javascript
const LoginScreen = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const result = await login(email, password);
    if (result.success) {
      navigation.navigate('MainTabs');
    } else {
      Alert.alert('Error', result.error);
    }
  };
};
```

### AFTER (Redux + RTK Query)

**store/api.ts:**
```typescript
export const api = createApi({
  // ...
  endpoints: (builder) => ({
    login: builder.mutation({
      query: ({ email, password }) => ({
        url: '/api/login',
        method: 'POST',
        body: { email, password },
      }),
      transformResponse: (response) => {
        const token = typeof response === 'string' 
          ? response 
          : response.token;
        
        if (!token) throw new Error('No token received');
        
        const decodedToken = decodeJWT(token);
        const roleString = mapRoleNumberToString(decodedToken.Role);
        
        return {
          success: true,
          token,
          user: {
            id: decodedToken.Id,
            role: roleString,
            email, // Include email from input
          },
        };
      },
    }),
  }),
});

export const { useLoginMutation } = api;
```

**features/auth/authSlice.js:**
```javascript
import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
  },
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
```

**LoginScreen.js:**
```javascript
import { useDispatch } from 'react-redux';
import { useLoginMutation } from '../../store/api';
import { setCredentials } from '../../features/auth/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = () => {
  const dispatch = useDispatch();
  const [login, { isLoading, error }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const result = await login({ email, password }).unwrap();
      
      if (result.success) {
        // Store in AsyncStorage
        const userData = {
          ...result.user,
          name: getDisplayName(email, result.user.role),
        };
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('token', result.token);
        
        // Update Redux store
        dispatch(setCredentials({ 
          user: userData, 
          token: result.token 
        }));
        
        navigation.navigate('MainTabs');
      }
    } catch (err) {
      Alert.alert('Error', err.data?.error || err.message || 'Login failed');
    }
  };
};
```

---

## 🔄 Example 2: Fetching Enquiries List

### BEFORE (Manual API Call + Local State)

**EnquiryListScreen.js:**
```javascript
const EnquiryListScreen = () => {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    client: 'all',
  });

  useEffect(() => {
    loadEnquiries();
  }, []);

  useEffect(() => {
    navigation.addListener('focus', () => {
      loadEnquiries(); // Reload on focus
    });
  }, []);

  const loadEnquiries = async () => {
    try {
      setLoading(true);
      const data = await api.getEnquiries(user?.role);
      
      // Enrich with client names
      const enriched = await Promise.all(
        data.map(async (enquiry) => {
          if (!enquiry.clientName || enquiry.clientName === 'Unknown Client') {
            const clientName = await api.getClientNameById(enquiry.clientId);
            return { ...enquiry, clientName };
          }
          return enquiry;
        })
      );
      
      setEnquiries(enriched);
    } catch (error) {
      console.error('Error loading enquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEnquiries();
    setRefreshing(false);
  };

  // Filter logic (40+ lines)
  useEffect(() => {
    applyFilters();
  }, [enquiries, filters]);

  const applyFilters = () => {
    let filtered = [...enquiries];
    // ... complex filtering logic
    setFilteredEnquiries(filtered);
  };
};
```

### AFTER (RTK Query + Redux)

**store/api.ts:**
```typescript
getEnquiries: builder.query({
  query: (role) => '/api/enquiries',
  providesTags: ['Enquiry'],
  transformResponse: (response) => {
    // Same normalization as current api.js
    let enquiriesArray = [];
    if (Array.isArray(response)) {
      enquiriesArray = response;
    } else if (response.enquiries) {
      enquiriesArray = response.enquiries;
    }
    
    return enquiriesArray.map(enquiry => {
      // ... normalization logic (same as current)
      return normalizedEnquiry;
    });
  },
}),
```

**features/enquiries/enquiriesSlice.js:**
```javascript
const initialState = {
  filters: {
    status: 'all',
    priority: 'all',
    client: 'all',
  },
  searchQuery: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
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
  },
});
```

**features/enquiries/enquiriesHooks.js:**
```javascript
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useGetEnquiriesQuery } from '../../store/api';

export const useFilteredEnquiries = (role) => {
  const { data: enquiries = [], isLoading, refetch } = 
    useGetEnquiriesQuery(role, {
      // ✅ Refetch when screen comes into focus
      refetchOnFocus: true,
    });
  
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
    // ... other filters
    
    // Apply search
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
    refetch,
  };
};
```

**EnquiryListScreen.js:**
```javascript
import { useSelector, useDispatch } from 'react-redux';
import { useFilteredEnquiries } from '../../features/enquiries/enquiriesHooks';
import { setFilters, setSearchQuery } from '../../features/enquiries/enquiriesSlice';
import { RefreshControl } from 'react-native';

const EnquiryListScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  
  // ✅ One hook handles everything!
  const { enquiries, isLoading, refetch } = useFilteredEnquiries(user?.role);
  const filters = useSelector(state => state.enquiries.filters);

  const handleFilterChange = (newFilters) => {
    dispatch(setFilters(newFilters));
    // ✅ No API call - uses cached data + filters
  };

  const onRefresh = () => {
    refetch(); // ✅ Simple refetch
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
      }
    >
      {/* Render enquiries */}
    </ScrollView>
  );
};
```

**Benefits:**
- ✅ No duplicate API calls (automatic caching)
- ✅ Shared state across screens
- ✅ Automatic refetch on focus
- ✅ Cleaner component code

---

## 🔄 Example 3: Dashboard with Multiple API Calls

### BEFORE

**DashboardScreen.js:**
```javascript
const DashboardScreen = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // ❌ Multiple API calls
      const data = await api.getDashboardData(user?.role);
      setDashboardData(data);
      
      if (user?.role === 'admin') {
        // ❌ Duplicate call - also called in EnquiryListScreen
        const clientsData = await api.getClients();
        
        // ❌ Duplicate call - also called in EnquiryListScreen
        const enquiriesData = await api.getEnquiries(user?.role);
        
        // Count enquiries per client
        const clientsWithCounts = clientsData.map(client => ({
          ...client,
          enquiryCount: enquiriesData.filter(
            e => e.clientId === client.id
          ).length,
        }));
        
        setClients(clientsWithCounts);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
};
```

**Problem:** If user opens Dashboard, then EnquiryListScreen:
1. Dashboard calls `api.getEnquiries(role)` 
2. EnquiryListScreen calls `api.getEnquiries(role)` again ❌
3. Two identical API calls = slow performance

### AFTER

**DashboardScreen.js:**
```javascript
import { useSelector } from 'react-redux';
import { useGetEnquiriesQuery, useGetClientsQuery } from '../../store/api';
import { useMemo } from 'react';

const DashboardScreen = () => {
  const user = useSelector(state => state.auth.user);
  
  // ✅ Uses cache if already fetched by EnquiryListScreen!
  const { data: enquiries = [], isLoading: enquiriesLoading } = 
    useGetEnquiriesQuery(user?.role, { skip: !user });
    
  const { data: clients = [], isLoading: clientsLoading } = 
    useGetClientsQuery(undefined, { 
      skip: user?.role !== 'admin' 
    });

  // Compute dashboard stats from cached data
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

  return (
    // Render dashboard
  );
};
```

**Benefits:**
- ✅ If EnquiryListScreen already fetched enquiries → Dashboard uses cache (0 API calls)
- ✅ If Dashboard loads first → EnquiryListScreen uses cache (0 extra calls)
- ✅ Automatic cache invalidation when data changes
- ✅ Background refetching for fresh data

---

## 🔄 Example 4: Creating/Updating Enquiry

### BEFORE

**AddEnquiryStep2Screen.js:**
```javascript
const AddEnquiryStep2Screen = ({ route }) => {
  const { formData, enquiry: enquiryToEdit, isEditMode } = route.params;
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Upload images
      let uploadedImages = [];
      if (selectedImages.length > 0) {
        for (const image of selectedImages) {
          const uploaded = await api.uploadImage(image);
          uploadedImages.push(uploaded);
        }
      }
      
      const enquiryData = {
        ...formData,
        ReferenceImages: uploadedImages,
      };
      
      let response;
      if (isEditMode) {
        response = await api.updateEnquiry(enquiryToEdit.id, enquiryData);
      } else {
        response = await api.createEnquiry(enquiryData);
      }
      
      // Manually refresh lists
      navigation.navigate('Enquiries');
      // But EnquiryListScreen still has old data!
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
};
```

### AFTER

**AddEnquiryStep2Screen.js:**
```javascript
import { useCreateEnquiryMutation, useUpdateEnquiryMutation } from '../../store/api';

const AddEnquiryStep2Screen = ({ route }) => {
  const { formData, enquiry: enquiryToEdit, isEditMode } = route.params;
  
  const [createEnquiry, { isLoading: isCreating }] = useCreateEnquiryMutation();
  const [updateEnquiry, { isLoading: isUpdating }] = useUpdateEnquiryMutation();
  
  const isLoading = isCreating || isUpdating;

  const handleSubmit = async () => {
    try {
      // Upload images (same as before)
      let uploadedImages = [];
      if (selectedImages.length > 0) {
        for (const image of selectedImages) {
          const uploaded = await api.uploadImage(image);
          uploadedImages.push(uploaded);
        }
      }
      
      const enquiryData = {
        ...formData,
        ReferenceImages: uploadedImages,
      };
      
      if (isEditMode) {
        await updateEnquiry({ 
          id: enquiryToEdit.id, 
          ...enquiryData 
        }).unwrap();
      } else {
        await createEnquiry(enquiryData).unwrap();
      }
      
      // ✅ Automatic cache invalidation!
      // RTK Query automatically refetches:
      // - Enquiry list (invalidates 'Enquiry' tag)
      // - Dashboard data (invalidates 'Dashboard' tag)
      // - Current enquiry if viewing it
      
      navigation.navigate('Enquiries');
      // ✅ EnquiryListScreen now has fresh data automatically!
      
    } catch (error) {
      Alert.alert('Error', error.data?.message || error.message);
    }
  };
};
```

**store/api.ts:**
```typescript
createEnquiry: builder.mutation({
  query: (data) => ({
    url: '/api/enquiries',
    method: 'POST',
    body: data,
  }),
  // ✅ Automatically refetches these when mutation succeeds
  invalidatesTags: ['Enquiry', 'Dashboard'],
}),

updateEnquiry: builder.mutation({
  query: ({ id, ...data }) => ({
    url: `/api/enquiries/${id}`,
    method: 'PUT',
    body: data,
  }),
  invalidatesTags: (result, error, { id }) => [
    { type: 'Enquiry', id }, // Invalidate specific enquiry
    'Enquiry',                // Invalidate enquiry list
    'Dashboard',              // Invalidate dashboard
  ],
}),
```

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ No manual refetch needed
- ✅ All screens update automatically

---

## 📊 Performance Comparison

### Scenario: User opens Dashboard → EnquiryListScreen → SingleEnquiryScreen

**BEFORE (Current):**
```
Dashboard:          [API Call] getEnquiries
                   [API Call] getClients
                   [API Call] getDashboardData
                   
EnquiryListScreen:  [API Call] getEnquiries  ❌ DUPLICATE!
                   
SingleEnquiry:      [API Call] getEnquiryById(id: 123)
                   [API Call] getEnquiryById(id: 123) ❌ DUPLICATE if navigated back
                   
Total: 6+ API calls
```

**AFTER (RTK Query):**
```
Dashboard:          [API Call] getEnquiries
                   [API Call] getClients
                   [CACHE] getDashboardData (computed)
                   
EnquiryListScreen:  [CACHE] getEnquiries ✅
                   
SingleEnquiry:      [API Call] getEnquiryById(id: 123)
                   [CACHE] getEnquiryById(id: 123) ✅
                   
Total: 3 API calls (50% reduction!)
```

---

## 🎯 Key Takeaways

1. **RTK Query handles caching automatically** - No duplicate API calls
2. **Cache invalidation is automatic** - When you create/update, lists refresh automatically
3. **Less code in components** - Hooks replace 20+ lines with 3 lines
4. **Shared state across screens** - Filters, selected items, etc.
5. **Better performance** - Significantly fewer API calls

---

## 📝 Next Steps

1. Start with one feature (recommend: Enquiries)
2. Convert API endpoints to RTK Query
3. Create feature slice for UI state
4. Migrate one screen at a time
5. Test thoroughly before moving to next feature

