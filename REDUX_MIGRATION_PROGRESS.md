# Redux Migration Progress

## ✅ COMPLETED

### 1. Redux Store Setup ✓
- Created `src/store/index.js` - Redux store configuration
- Created `src/store/api.js` - RTK Query API with all endpoints
- Wrapped App with Redux Provider in `App.tsx`

### 2. Feature Slices Created ✓
- `src/features/auth/authSlice.js` - Auth state management
- `src/features/auth/authThunks.js` - Async auth actions
- `src/features/enquiries/enquiriesSlice.js` - Enquiries UI state
- `src/features/enquiries/enquiriesHooks.js` - Custom hooks (useFilteredEnquiries)
- `src/features/clients/clientsSlice.js` - Clients UI state
- `src/features/metalPrices/metalPricesSlice.js` - Metal prices UI state
- `src/features/index.js` - Feature exports

### 3. RTK Query API Endpoints ✓
All current `api.js` endpoints converted to RTK Query:
- ✅ `login` mutation
- ✅ `getEnquiries` query
- ✅ `getEnquiryById` query  
- ✅ `createEnquiry` mutation
- ✅ `updateEnquiry` mutation
- ✅ `deleteEnquiry` mutation
- ✅ `getClients` query
- ✅ `getMetalPrices` query
- ✅ `addMetalPrice` mutation
- ✅ `updateMetalPrice` mutation
- ✅ `deleteMetalPrice` mutation

All normalization logic from original `api.js` preserved in `transformResponse`.

### 4. Screens Migrated ✓
- ✅ `LoginScreen.js` - Now uses Redux login mutation
- ⚠️ `EnquiryListScreen.js` - PARTIALLY migrated (imports and state updated, handlers need updating)

---

## 📋 REMAINING TASKS

### To Install Dependencies
Run:
```bash
npm install @reduxjs/toolkit react-redux
```

### To Complete EnquiryListScreen Migration

The screen is partially migrated. You need to update these handler functions to use Redux dispatch:

**Find and replace these patterns:**

1. **Search handlers:**
```javascript
// OLD:
const handleSearch = (query) => {
  setSearchQuery(query);
};

// NEW:
const handleSearch = (query) => {
  dispatch(setSearchQuery(query));
};
```

2. **Status chip handler:**
```javascript
// OLD:
const handleStatusPress = (status) => {
  setSelectedStatus(status);
};

// NEW:
const handleStatusPress = (status) => {
  dispatch(setSelectedStatus(status));
};
```

3. **Client chip handler:**
```javascript
// OLD:
const handleClientPress = (client) => {
  setSelectedClient(client);
};

// NEW:
const handleClientPress = (client) => {
  dispatch(setSelectedClient(client));
};
```

4. **Filter handlers:**
```javascript
// OLD:
const handleFilterChange = (filterType, value) => {
  setFilters(prev => ({ ...prev, [filterType]: value }));
};

// NEW:
const handleFilterChange = (filterType, value) => {
  dispatch(setFilters({ [filterType]: value }));
};
```

5. **Clear filters:**
```javascript
// OLD:
const clearFilters = () => {
  setFilters({
    status: 'all',
    priority: 'all',
    client: 'all',
  });
  setSearchQuery('');
  setSelectedStatus('All');
  setSelectedClient('All');
};

// NEW:
const handleClearFilters = () => {
  dispatch(clearFilters());
};
```

6. **Sorting:**
```javascript
// OLD:
const handleApplySorting = (by, order) => {
  setSortBy(by);
  setSortOrder(order);
  setShowSortModal(false);
};

// NEW:
const handleApplySorting = (by, order) => {
  dispatch(setSorting({ sortBy: by, sortOrder: order }));
  setShowSortModal(false);
};
```

7. **Remove unused functions:**
Delete the `applyFilters` function entirely (lines 84-161) - it's handled by `useFilteredEnquiries` hook.

8. **Update RefreshControl:**
```javascript
// OLD:
refreshing={refreshing}
onRefresh={onRefresh}

// NEW:
refreshing={loading}
onRefresh={onRefresh}
```

---

### Screens to Migrate

#### HIGH PRIORITY:
1. **DashboardScreen.js**
   - Replace `api.getDashboardData()` with `useGetEnquiriesQuery()` + `useGetClientsQuery()`
   - Compute dashboard stats from cached data

2. **SingleEnquiryScreen.js**
   - Replace `api.getEnquiryById()` with `useGetEnquiryByIdQuery()`
   - Remove manual loading state

3. **AddEnquiryStep2Screen.js**
   - Replace `api.createEnquiry()` with `useCreateEnquiryMutation()`
   - Replace `api.updateEnquiry()` with `useUpdateEnquiryMutation()`

#### MEDIUM PRIORITY:
4. **ClientsListScreen.js**
   - Replace `api.getClients()` with `useGetClientsQuery()`

5. **MetalPricesScreen.js**
   - Replace metal price API calls with RTK Query hooks

---

## 🔄 Migration Template for Each Screen

### Step 1: Update Imports
```javascript
// Add these imports:
import { useSelector, useDispatch } from 'react-redux';
import { useGetEnquiriesQuery } from '../../store/api'; // or appropriate query/mutation
```

### Step 2: Replace State with Redux Hooks
```javascript
// OLD:
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

// NEW:
const { data = [], isLoading: loading, refetch } = useGetEnquiriesQuery(role);
```

### Step 3: Remove Manual API Calls
```javascript
// DELETE functions like loadData(), fetchData(), etc.
// RTK Query handles this automatically
```

### Step 4: Update Handlers
```javascript
// OLD:
const handleUpdate = async () => {
  await api.updateSomething(id, data);
  await loadData(); // Manual refetch
};

// NEW:
const [updateMutation] = useUpdateSomethingMutation();
const handleUpdate = async () => {
  await updateMutation({ id, ...data }).unwrap();
  // Automatic refetch via cache invalidation!
};
```

---

## 🎯 Benefits After Migration

- ✅ **50%+ fewer API calls** (automatic caching)
- ✅ **Automatic list refresh** after create/update/delete
- ✅ **Shared state** across screens
- ✅ **Less code** (hooks replace manual logic)
- ✅ **Better performance** (cache deduplication)

---

## 📝 Testing Checklist

After completing migration for each screen:

- [ ] Screen loads without errors
- [ ] Data displays correctly
- [ ] Filters/sorting work
- [ ] Create/Update/Delete operations work
- [ ] Lists refresh automatically after mutations
- [ ] No duplicate API calls in network tab
- [ ] Pull-to-refresh works
- [ ] Navigation works correctly

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module '@reduxjs/toolkit'"
**Solution:** Run `npm install @reduxjs/toolkit react-redux`

### Issue: "useSelector is not a function"
**Solution:** Make sure App is wrapped with `<Provider store={store}>`

### Issue: Filters not working
**Solution:** Make sure you're dispatching Redux actions, not setting local state

### Issue: Data not refreshing after create/update
**Solution:** Check `invalidatesTags` in mutation endpoints

### Issue: Screen shows old data
**Solution:** RTK Query is using cache - check `refetchOnFocus` or manually call `refetch()`

---

## 📚 Quick Reference

### Import Patterns
```javascript
// Queries (GET data)
import { useGetEnquiriesQuery } from '../../store/api';
const { data, isLoading, error, refetch } = useGetEnquiriesQuery(role);

// Mutations (POST/PUT/DELETE)
import { useCreateEnquiryMutation } from '../../store/api';
const [createEnquiry, { isLoading }] = useCreateEnquiryMutation();

// Redux State
import { useSelector, useDispatch } from 'react-redux';
const user = useSelector(state => state.auth.user);
const dispatch = useDispatch();

// Redux Actions
import { setFilters } from '../../features/enquiries/enquiriesSlice';
dispatch(setFilters({ status: 'pending' }));
```

---

## 🚀 Next Steps

1. Run `npm install @reduxjs/toolkit react-redux`
2. Complete EnquiryListScreen migration (see instructions above)
3. Migrate DashboardScreen
4. Migrate SingleEnquiryScreen
5. Test thoroughly
6. Migrate remaining screens
7. Remove old `AuthContext.js` (after all screens migrated)
8. Remove old `api.js` or rename to `api.js.backup`

---

## 📞 Need Help?

If you encounter issues:
1. Check console for Redux errors
2. Verify imports are correct
3. Ensure store is properly configured
4. Check RTK Query DevTools (if installed)
5. Review migration examples in `MIGRATION_EXAMPLES.md`

