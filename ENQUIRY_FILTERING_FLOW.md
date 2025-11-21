# Enquiry Fetching and Filtering Flow

## 📋 Overview

This document explains how enquiries are fetched, how filters work (from both filter modal and chips), which API is called, and how data flows through the application.

---

## 🔄 Complete Data Flow

```
User Interaction
    ↓
Redux State Update (filters/search/sort)
    ↓
useFilteredEnquiries Hook
    ↓
RTK Query (useGetEnquiriesQuery)
    ↓
API Request: GET /api/enquiries/search
    ↓
Backend Response
    ↓
Data Normalization & Transformation
    ↓
Client-side Filtering (if needed)
    ↓
Enrichment (add client names)
    ↓
Display in FlatList
```

---

## 1️⃣ **Initial Data Fetch**

### Entry Point: `EnquiryListScreen.js`

```javascript
// Line 87-96: Main hook that fetches enquiries
const { 
  enquiries: filteredEnquiries, 
  allEnquiries: enquiries, 
  isLoading: loading, 
  refetch, 
  pagination,
  loadMore,
  hasMore
} = useFilteredEnquiries(user?.role, currentUserId);
```

### Hook: `useFilteredEnquiries` (`enquiriesHooks.js`)

**Location:** `src/features/enquiries/enquiriesHooks.js`

**What it does:**
1. Reads filters from Redux state
2. Determines role-based filtering (admin/client/designer)
3. Calls RTK Query hook
4. Handles pagination and infinite scroll
5. Applies client-side filtering if needed

**Key Code:**
```javascript
// Line 85-97: Get filters from Redux
const filters = useSelector(state => state.enquiries.filters);
const sortBy = useSelector(state => state.enquiries.sortBy);
const sortOrder = useSelector(state => state.enquiries.sortOrder);

// Line 91-97: Build API filters object
const apiFilters = {
  ...filters,
  sortBy: sortBy === 'assignedDate' ? 'assignedDate' : sortBy,
  sortOrder,
};

// Line 123-141: Call RTK Query
const { data, isLoading, error, refetch } = useGetEnquiriesQuery(
  { 
    role, 
    page: pageToFetch,
    limit: limitToFetch,
    search: searchQuery || undefined,
    assignedTo: assignedTo,
    filters: apiFilters,
    userId: userId || user?.id,
  }
);
```

---

## 2️⃣ **API Call**

### Endpoint Definition: `api.js`

**Location:** `src/store/api.js` (Line 286-386)

**API Endpoint:** `GET /api/enquiries/search`

**Query Parameters Built:**
```javascript
// Base query
let queryString = `page=${page}&limit=${limit}`;

// Search
if (search) queryString += `&search=${encodeURIComponent(search)}`;

// Role-based assignedTo (only for non-admins)
if (assignedTo && !isAdminRole) {
  queryString += `&assignedTo=${encodeURIComponent(assignedTo)}`;
}

// Filters from Redux
if (filters.status && filters.status !== 'all') {
  queryString += `&status=${encodeURIComponent(filters.status)}`;
}
if (filters.priority && filters.priority !== 'all') {
  queryString += `&priority=${encodeURIComponent(filters.priority)}`;
}
if (filters.category && filters.category !== 'all') {
  queryString += `&category=${encodeURIComponent(filters.category)}`;
}
if (filters.clientId && filters.clientId !== 'all') {
  queryString += `&clientId=${encodeURIComponent(filters.clientId)}`;
}
// ... and more filters (stoneType, metalColor, dates, etc.)

// Sorting
queryString += `&sortBy=${sortBy}&sortOrder=${sortOrder}`;
```

**Final URL Example:**
```
GET /api/enquiries/search?page=1&limit=10&status=Design%20Approval%20Pending&sortBy=createdAt&sortOrder=desc
```

---

## 3️⃣ **Filter Sources**

### A. **Filter Modal** (`EnquiryFiltersModal.js`)

**Location:** `src/components/filters/EnquiryFiltersModal.js`

**How it works:**
1. User clicks filter button (tune icon) → Opens modal
2. User selects filters in modal
3. User clicks "Apply Filters" → `handleApply` called
4. `onApplyFilters(localFilters)` called
5. Modal closes

**Code Flow:**
```javascript
// Line 66-69: Apply button handler
const handleApply = () => {
  onApplyFilters(localFilters);  // Passes filters to parent
  onClose();
};

// In EnquiryListScreen.js (Line 1134-1137)
const handleApplyFilters = (newFilters) => {
  dispatch(setFilters(newFilters));  // Update Redux
  dispatch(setPage(1));              // Reset to page 1
};
```

**Filters Available in Modal:**
- Status (from API)
- Priority (Super High, High, Normal)
- Category (Necklace, Ring, etc.)
- Client (from clients API)
- Assigned To (from users API)
- Stone Type
- Metal Color & Quality
- Date Ranges (Shipping, Assigned, Created)

---

### B. **Status Chips** (Quick Filter)

**Location:** `EnquiryListScreen.js` (Line 1318-1376)

**How it works:**
1. Status chips displayed above enquiry list
2. User clicks a status chip
3. Redux state updated immediately
4. API called with new filter

**Code Flow:**
```javascript
// Line 1359-1368: Status chip click handler
onPress={() => {
  const filterStatus = status === 'All' ? 'all' : status;
  dispatch(setSelectedStatus(status));        // Update UI state
  dispatch(setFilters({ status: filterStatus })); // Update Redux filters
  dispatch(setPage(1));                      // Reset pagination
}}
```

**Status Options:**
- Fetched from API via `useStatusOptions()` hook
- Role-based (designers see different statuses than admins)

---

### C. **Client Chips** (Admin Only)

**Location:** `EnquiryListScreen.js` (Line 1378-1458)

**How it works:**
1. Only shown for admin users
2. Lists all clients from clients API
3. Clicking a client chip filters by that client

**Code Flow:**
```javascript
// Line 1432-1444: Client chip click handler
onPress={() => {
  dispatch(setSelectedClient(clientName));
  
  if (client.id === 'all') {
    dispatch(setFilters({ clientId: 'all', client: 'all' }));
  } else {
    dispatch(setFilters({ 
      clientId: String(client.id).trim(),
      client: clientName 
    }));
  }
  dispatch(setPage(1));
}}
```

---

## 4️⃣ **Redux State Management**

### Slice: `enquiriesSlice.js`

**Location:** `src/features/enquiries/enquiriesSlice.js`

**State Structure:**
```javascript
{
  filters: {
    status: 'all',
    priority: 'all',
    category: 'all',
    clientId: 'all',
    assignedTo: 'all',
    stoneType: 'all',
    metalColor: 'all',
    metalQuality: 'all',
    shippingDateFrom: '',
    shippingDateTo: '',
    assignedDateFrom: '',
    assignedDateTo: '',
    createdDateFrom: '',
    createdDateTo: '',
  },
  searchQuery: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  selectedStatus: 'All',      // UI state for chips
  selectedClient: 'All',      // UI state for chips
  pagination: {
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 10,
  }
}
```

**Actions:**
- `setFilters(payload)` - Update filter values
- `setSearchQuery(text)` - Update search query
- `setSorting({ sortBy, sortOrder })` - Update sorting
- `clearFilters()` - Reset all filters
- `setPage(number)` - Change current page

---

## 5️⃣ **Data Processing Pipeline**

### Step 1: API Response Normalization

**Location:** `api.js` (Line 442-529)

**What happens:**
```javascript
// Transform API response to normalized format
const normalizedEnquiries = enquiriesArray.map(enquiry => ({
  id: enquiry._id || enquiry.id,
  title: enquiry.Name || enquiry.name,
  clientId: enquiry.ClientId,
  status: normalizedStatus,      // Normalized from CurrentStatus
  priority: normalizedPriority,  // Normalized from Priority
  createdAt: enquiry.CreatedDate,
  // ... preserve original fields
  CurrentStatus: enquiry.CurrentStatus,
  AssignedTo: enquiry.AssignedTo,
  // ...
}));
```

### Step 2: Client-side Filtering (if needed)

**Location:** `enquiriesHooks.js` (Line 289-523)

**Applied when:**
- Client users (additional security check)
- Status filter variations need matching
- Search query needs client-side filtering

### Step 3: Enrichment (Add Client Names)

**Location:** `EnquiryListScreen.js` (Line 162-210)

**What happens:**
```javascript
// Fetch clients from API
const { clients } = useClients();

// Create lookup map
const clientNameMap = new Map();
clients.forEach(client => {
  map.set(client.id, client.name);
});

// Enrich enquiries with client names
const enrichedEnquiries = enquiries.map(enquiry => ({
  ...enquiry,
  clientName: clientNameMap.get(enquiry.clientId) || 'Unknown Client'
}));
```

### Step 4: Final Filtering & Sorting

**Location:** `EnquiryListScreen.js` (Line 213-623)

**What happens:**
1. Sort enriched enquiries
2. Apply status filter (with fuzzy matching)
3. Apply priority filter
4. Apply client filter
5. Apply category filter
6. Apply date range filters
7. Apply search query

---

## 6️⃣ **Display**

### FlatList Rendering

**Location:** `EnquiryListScreen.js` (Line 1538-1577)

```javascript
<FlatList
  data={enrichedFilteredEnquiries.filter(enquiry => enquiry && enquiry.id)}
  renderItem={renderEnquiryItem}  // Renders CompactEnquiryCardMemo
  keyExtractor={(item) => String(item.id)}
  onEndReached={handleLoadMore}  // Infinite scroll
  numColumns={2}                 // 2-column grid
  refreshControl={...}           // Pull to refresh
/>
```

---

## 7️⃣ **Role-Based Filtering**

### Admin Users
- **assignedTo:** `undefined` (see ALL enquiries)
- **clientId:** Can filter by any client
- **Status:** See all statuses

### Client Users
- **assignedTo:** `undefined`
- **clientId:** Automatically set to `user.id` (only see their enquiries)
- **Status:** Limited status options

### Designer/Worker Users (coral, cad)
- **assignedTo:** Set to `userId` (only see assigned enquiries)
- **clientId:** `undefined`
- **Status:** Limited status options

---

## 8️⃣ **Pagination & Infinite Scroll**

### How it works:
1. Initial load: Fetch page 1 with limit 10
2. User scrolls to bottom → `onEndReached` triggered
3. `handleLoadMore()` called
4. Increment `currentPage` in Redux
5. Fetch next page
6. Accumulate enquiries across pages
7. Display all accumulated enquiries

**Code:**
```javascript
// Line 801-819: Load more handler
const handleLoadMore = () => {
  if (!hasMore || isLoadingMore || loading) return;
  
  const nextPage = currentPage + 1;
  if (nextPage <= totalPages) {
    dispatch(setPage(nextPage));
    loadMore();
  }
};
```

---

## 9️⃣ **Search Functionality**

### How it works:
1. User types in search box
2. `setSearchQuery(text)` dispatched
3. When searching: Fetch ALL enquiries (limit 10000)
4. Client-side filtering by search query
5. Search across: Name, StyleNumber, CoralCode, CadCode, GatiOrderNumber, ClientName, Description

**Code:**
```javascript
// Line 409-428: Search filter
if (searchQuery && searchQuery.trim()) {
  const query = searchQuery.toLowerCase().trim();
  filtered = filtered.filter(e => {
    const name = (e.Name || e.name || '').toLowerCase();
    const styleNumber = (e.StyleNumber || '').toLowerCase();
    // ... check multiple fields
    return name.includes(query) || styleNumber.includes(query) || ...;
  });
}
```

---

## 🔟 **Summary: Complete Flow Example**

### User clicks "Design Approval Pending" status chip:

1. **User Action:** Click status chip
2. **Redux Update:** 
   ```javascript
   dispatch(setSelectedStatus('Design Approval Pending'));
   dispatch(setFilters({ status: 'Design Approval Pending' }));
   dispatch(setPage(1));
   ```
3. **Hook Re-runs:** `useFilteredEnquiries` detects filter change
4. **API Call:**
   ```
   GET /api/enquiries/search?page=1&limit=10&status=Design%20Approval%20Pending&sortBy=createdAt&sortOrder=desc
   ```
5. **Backend:** Returns filtered enquiries
6. **Normalization:** Data transformed to app format
7. **Enrichment:** Client names added
8. **Client-side Filter:** Additional status matching (fuzzy)
9. **Display:** FlatList re-renders with filtered data

---

## 📝 Key Files Reference

| File | Purpose |
|------|---------|
| `EnquiryListScreen.js` | Main screen component, UI rendering |
| `enquiriesHooks.js` | Custom hook for fetching & filtering |
| `api.js` | RTK Query API definitions |
| `enquiriesSlice.js` | Redux state management |
| `EnquiryFiltersModal.js` | Filter modal component |

---

## 🐛 Debugging Tips

1. **Check Redux State:**
   ```javascript
   console.log('Filters:', useSelector(state => state.enquiries.filters));
   ```

2. **Check API Call:**
   - Look for "ENQUIRY FILTERING STRATEGY" logs
   - Check network tab for actual API URL

3. **Check Data Flow:**
   - "FIRST ENQUIRY DEBUG" - Shows if data received
   - "BEFORE ENRICHED FILTERING" - Shows before client-side filtering
   - "AFTER ENRICHED FILTERING" - Shows final filtered data

---

## ✅ Best Practices

1. **Always reset page to 1 when filters change**
2. **Use Redux for filter state (not local state)**
3. **Let backend do most filtering (more efficient)**
4. **Client-side filtering only for complex matching**
5. **Cache client names to avoid repeated API calls**


