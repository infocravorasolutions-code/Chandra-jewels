# Redux Migration Summary

## 🎯 Why Migrate?

Based on your requirements:
- ✅ **State Sharing**: Multiple screens share enquiry state → Redux solves this
- ✅ **Performance**: Multiple API calls causing slowness → RTK Query caching solves this
- ✅ **Team Size**: 2-3 developers → Clean structure for maintainability
- ✅ **Future**: Offline support planned → RTK Query ready for this

---

## 📁 Complete File Structure After Migration

```
src/
│
├── store/
│   ├── index.js                    # Redux store configuration
│   └── api.ts                      # RTK Query API (all endpoints)
│
├── features/
│   ├── auth/
│   │   ├── authSlice.js            # Auth state (user, token, isAuthenticated)
│   │   └── authThunks.js           # Async auth actions (optional)
│   │
│   ├── enquiries/
│   │   ├── enquiriesSlice.js       # UI state (filters, search, sorting)
│   │   ├── enquiriesHooks.js       # Custom hooks (useFilteredEnquiries)
│   │   └── enquiriesSelectors.js   # Selectors (optional)
│   │
│   ├── clients/
│   │   ├── clientsSlice.js         # UI state for clients
│   │   └── clientsHooks.js
│   │
│   ├── metalPrices/
│   │   ├── metalPricesSlice.js     # UI state for metal prices
│   │   └── metalPricesHooks.js
│   │
│   └── dashboard/
│       └── dashboardSlice.js       # Dashboard UI state (if needed)
│
├── services/
│   ├── api.js                      # ⚠️ Keep temporarily as backup
│   └── uploadImage.js              # Image upload (can stay as utility)
│
├── context/
│   └── AuthContext.js              # ⚠️ Remove after migration
│
└── screens/
    └── ...                         # All screens using Redux hooks
```

---

## 🔄 Migration Flow Diagram

```
Current Structure:
┌─────────────────┐
│  Components     │
│  (Screens)      │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
┌──────────────┐  ┌─────────────┐
│   api.js     │  │ AuthContext │
│  (Manual)    │  │ (Context)   │
└──────────────┘  └─────────────┘
         │              │
         └──────┬───────┘
                │
                ▼
         [Multiple API Calls]
         [No State Sharing]
         [Manual Loading States]

After Migration:
┌─────────────────┐
│  Components     │
│  (Screens)      │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
┌──────────────┐  ┌─────────────┐
│  Redux Hooks │  │ Redux Store │
│  (useQuery)  │  │ (State)     │
└────────┬─────┘  └──────┬──────┘
         │               │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │  RTK Query    │
         │  (api.ts)     │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │   API Cache   │
         │   (Automatic) │
         └───────────────┘
                 │
                 ▼
         [Single API Call]
         [Shared State]
         [Auto Loading States]
```

---

## 📋 Step-by-Step Migration Checklist

### Phase 1: Foundation Setup ✅
```
Priority: HIGH
Estimated Time: 30 minutes
```

- [ ] Install dependencies: `npm install @reduxjs/toolkit react-redux`
- [ ] Create `src/store/` directory
- [ ] Create `src/store/index.js` (store configuration)
- [ ] Create `src/features/` directory structure
- [ ] Wrap App with `<Provider store={store}>` in `index.js` or `App.js`
- [ ] Test: App should still run (empty Redux store)

---

### Phase 2: RTK Query API Setup ✅
```
Priority: HIGH
Estimated Time: 2-3 hours
```

- [ ] Create `src/store/api.ts`
- [ ] Set up `baseQuery` with auth token injection
- [ ] Convert `login` endpoint to RTK Query mutation
- [ ] Convert `getEnquiries` endpoint to RTK Query query
  - [ ] Copy normalization logic from current `api.js`
  - [ ] Test response transformation
- [ ] Convert `getEnquiryById` endpoint
  - [ ] Copy normalization logic
  - [ ] Test with real enquiry ID
- [ ] Convert `createEnquiry` endpoint
  - [ ] Set up cache invalidation tags
- [ ] Convert `updateEnquiry` endpoint
  - [ ] Set up cache invalidation tags
- [ ] Convert `deleteEnquiry` endpoint
- [ ] Convert `getClients` endpoint
- [ ] Convert all metal prices endpoints
- [ ] Test: Verify all hooks are exported and available

**Files to Create:**
- `src/store/api.ts` (main file)

**Files to Reference:**
- `src/services/api.js` (copy normalization logic from here)

---

### Phase 3: Auth Migration ✅
```
Priority: HIGH
Estimated Time: 1 hour
```

- [ ] Create `src/features/auth/authSlice.js`
  - [ ] Define initial state
  - [ ] Create reducers: `setCredentials`, `logout`
- [ ] Create `src/features/auth/authThunks.js` (optional)
  - [ ] `checkAuthState` thunk
  - [ ] `logoutUser` thunk
- [ ] Update `store/index.js` to include `authReducer`
- [ ] Migrate `LoginScreen.js`:
  - [ ] Replace `useAuth()` with Redux hooks
  - [ ] Use `useLoginMutation()` from RTK Query
  - [ ] Dispatch `setCredentials` on success
- [ ] Update all components using `useAuth()`:
  - [ ] Find all files: `grep -r "useAuth" src/screens/`
  - [ ] Replace with `useSelector(state => state.auth.user)`
  - [ ] Update logout calls
- [ ] Test: Login/logout flow works
- [ ] Remove or comment out `AuthContext.js` (keep as backup)

**Files to Create:**
- `src/features/auth/authSlice.js`
- `src/features/auth/authThunks.js` (optional)

**Files to Modify:**
- `src/screens/Auth/LoginScreen.js`
- All screens using `useAuth()` hook

**Files to Remove (after testing):**
- `src/context/AuthContext.js` (keep as backup first)

---

### Phase 4: Enquiries Feature Migration ✅
```
Priority: HIGH
Estimated Time: 2 hours
```

- [ ] Create `src/features/enquiries/enquiriesSlice.js`
  - [ ] Define initial state (filters, search, sorting)
  - [ ] Create reducers: `setFilters`, `setSearchQuery`, `setSorting`, `clearFilters`
- [ ] Update `store/index.js` to include `enquiriesReducer`
- [ ] Create `src/features/enquiries/enquiriesHooks.js`
  - [ ] `useFilteredEnquiries` hook
  - [ ] Combines RTK Query data with Redux filters
- [ ] Migrate `EnquiryListScreen.js`:
  - [ ] Replace `api.getEnquiries()` with `useFilteredEnquiries()`
  - [ ] Replace local state with Redux actions
  - [ ] Remove manual filtering logic (moved to hook)
- [ ] Migrate `SingleEnquiryScreen.js`:
  - [ ] Replace `api.getEnquiryById()` with `useGetEnquiryByIdQuery()`
  - [ ] Remove local loading state (RTK Query provides it)
- [ ] Migrate `AddEnquiryStep2Screen.js`:
  - [ ] Replace `api.createEnquiry()` with `useCreateEnquiryMutation()`
  - [ ] Replace `api.updateEnquiry()` with `useUpdateEnquiryMutation()`
  - [ ] Verify cache invalidation works (lists refresh automatically)
- [ ] Test: All enquiry screens work correctly

**Files to Create:**
- `src/features/enquiries/enquiriesSlice.js`
- `src/features/enquiries/enquiriesHooks.js`

**Files to Modify:**
- `src/screens/Enquiries/EnquiryListScreen.js`
- `src/screens/Enquiries/SingleEnquiryScreen.js`
- `src/screens/AddEnquiry/AddEnquiryStep2Screen.js`

---

### Phase 5: Dashboard Migration ✅
```
Priority: MEDIUM
Estimated Time: 1 hour
```

- [ ] Migrate `DashboardScreen.js`:
  - [ ] Replace `api.getDashboardData()` with `useGetEnquiriesQuery()` + `useGetClientsQuery()`
  - [ ] Compute dashboard stats from cached data (useMemo)
  - [ ] Remove `api.getEnquiries()` call (use cache from EnquiryListScreen)
- [ ] Test: Dashboard shows correct data
- [ ] Test: Opening Dashboard then EnquiryListScreen = 0 duplicate API calls

**Files to Modify:**
- `src/screens/Dashboard/DashboardScreen.js`

---

### Phase 6: Clients & Metal Prices Migration ✅
```
Priority: MEDIUM
Estimated Time: 1.5 hours
```

- [ ] Create `src/features/clients/clientsSlice.js` (if UI state needed)
- [ ] Create `src/features/metalPrices/metalPricesSlice.js` (if UI state needed)
- [ ] Migrate `ClientsListScreen.js`:
  - [ ] Replace `api.getClients()` with `useGetClientsQuery()`
- [ ] Migrate `MetalPricesScreen.js`:
  - [ ] Replace metal price API calls with RTK Query hooks
  - [ ] Test: Add/Update/Delete metal prices works
- [ ] Update `store/index.js` with new reducers

**Files to Create (if needed):**
- `src/features/clients/clientsSlice.js`
- `src/features/metalPrices/metalPricesSlice.js`

**Files to Modify:**
- `src/screens/Admin/ClientsListScreen.js`
- `src/screens/Admin/MetalPricesScreen.js`

---

### Phase 7: Cleanup & Testing ✅
```
Priority: HIGH
Estimated Time: 1 hour
```

- [ ] Remove unused imports from all files
- [ ] Search for any remaining `api.` calls:
  ```bash
  grep -r "api\." src/screens/
  ```
- [ ] Remove `api.js` from imports where RTK Query is used
- [ ] Keep `src/services/api.js` as backup (rename to `api.js.backup`)
- [ ] Test entire app flow:
  - [ ] Login
  - [ ] View dashboard
  - [ ] View enquiries list
  - [ ] View single enquiry
  - [ ] Create enquiry
  - [ ] Edit enquiry
  - [ ] Delete enquiry
  - [ ] View clients
  - [ ] Manage metal prices
- [ ] Verify no duplicate API calls in network tab
- [ ] Test cache invalidation (create enquiry → lists refresh automatically)

---

## 🎯 Quick Reference: What Goes Where?

### Redux Store (`store/`)
- **Global state** shared across multiple screens
- **Server data cache** (RTK Query)

### Feature Slices (`features/`)
- **UI state** (filters, selected items, form state)
- **Computed state** (derived from server data)

### RTK Query (`store/api.ts`)
- **All API calls** centralized
- **Automatic caching** and invalidation

### Components (`screens/`)
- **Presentation only** - use hooks from Redux
- **No API calls** - use RTK Query hooks
- **No complex state** - use Redux slices

---

## ⚠️ Common Pitfalls & Solutions

### Pitfall 1: Forgetting to add reducer to store
```javascript
// ❌ Missing reducer
export const store = configureStore({
  reducer: {
    api: api.reducer,
    // auth reducer missing!
  },
});

// ✅ Include all reducers
export const store = configureStore({
  reducer: {
    api: api.reducer,
    auth: authReducer,
    enquiries: enquiriesReducer,
  },
});
```

### Pitfall 2: Not copying normalization logic
```javascript
// ❌ Missing normalization
getEnquiries: builder.query({
  query: () => '/api/enquiries',
  // Missing transformResponse!
}),

// ✅ Include normalization
getEnquiries: builder.query({
  query: () => '/api/enquiries',
  transformResponse: (response) => {
    // Copy exact logic from current api.js
  },
}),
```

### Pitfall 3: Not setting cache invalidation
```javascript
// ❌ Lists won't refresh after create
createEnquiry: builder.mutation({
  query: (data) => ({ url: '/api/enquiries', method: 'POST', body: data }),
  // Missing invalidatesTags!
}),

// ✅ Automatic refresh
createEnquiry: builder.mutation({
  query: (data) => ({ url: '/api/enquiries', method: 'POST', body: data }),
  invalidatesTags: ['Enquiry', 'Dashboard'],
}),
```

---

## 📊 Success Metrics

After migration, you should see:

- ✅ **50%+ reduction in API calls** (check network tab)
- ✅ **Faster screen transitions** (using cached data)
- ✅ **Automatic list refresh** (after create/update/delete)
- ✅ **Shared state across screens** (filters, selected items)
- ✅ **Less code in components** (hooks replace manual logic)

---

## 🚀 Ready to Start?

1. **Review** `MIGRATION_PLAN.md` for detailed steps
2. **Review** `MIGRATION_EXAMPLES.md` for before/after code
3. **Follow** this checklist phase by phase
4. **Test** after each phase
5. **Ask questions** if stuck!

---

## 📞 Need Help?

If you encounter issues during migration:
1. Check the error message
2. Verify reducer is added to store
3. Check RTK Query endpoint configuration
4. Ensure hooks are imported correctly
5. Test with console logs to debug

Good luck with the migration! 🎉

