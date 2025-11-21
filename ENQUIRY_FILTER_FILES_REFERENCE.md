# Files Related to Enquiries and Filters

## 📁 Complete File Reference

This document lists all files related to enquiry fetching, filtering, and management.

---

## 🎯 **Core Files (Most Important)**

### 1. **State Management (Redux)**

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/features/enquiries/enquiriesSlice.js` | Redux slice for enquiry state | `setFilters`, `setSearchQuery`, `setSorting`, `clearFilters`, `setPage` |
| `src/features/enquiries/enquiriesHooks.js` | Custom hooks for fetching enquiries | `useFilteredEnquiries`, `useEnquiry` |

### 2. **API Layer**

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/store/api.js` | RTK Query API definitions | `useGetEnquiriesQuery`, `useGetEnquiryByIdQuery`, `useCreateEnquiryMutation`, `useUpdateEnquiryMutation` |

### 3. **UI Components**

| File | Purpose | Key Features |
|------|---------|--------------|
| `src/screens/Enquiries/EnquiryListScreen.js` | Main enquiry list screen | Filter chips, search, sort, pagination, FlatList rendering |
| `src/components/filters/EnquiryFiltersModal.js` | Filter modal component | All filter options, date pickers, dropdowns |

---

## 📂 **File Structure by Category**

### **A. Screen Components**

```
src/screens/Enquiries/
├── EnquiryListScreen.js          ⭐ Main list screen with filters
└── SingleEnquiryScreen.js        📄 Individual enquiry view

src/screens/AddEnquiry/
├── AddEnquiryStep1Screen.js      ➕ Create enquiry step 1
└── AddEnquiryStep2Screen.js       ➕ Create enquiry step 2

src/screens/EditEnquiry/
├── EditEnquiryStep1Screen.js      ✏️ Edit enquiry step 1
└── EditEnquiryStep2Screen.js      ✏️ Edit enquiry step 2
```

### **B. Feature Modules (Redux)**

```
src/features/enquiries/
├── enquiriesSlice.js              🔄 Redux state & actions
└── enquiriesHooks.js              🎣 Custom hooks for data fetching

src/features/clients/
├── clientsSlice.js                🔄 Client state
└── clientsHooks.js                🎣 Client data hooks

src/features/statuses/
├── statusesSlice.js                🔄 Status state
└── statusesHooks.js                🎣 Status options hook
```

### **C. Components**

```
src/components/
├── filters/
│   └── EnquiryFiltersModal.js     🎛️ Filter modal UI
├── cards/
│   └── Cards.js                    🃏 Enquiry card components
└── modals/
    └── EnquiryHistoryModal.js      📜 Enquiry history modal
```

### **D. Store & API**

```
src/store/
└── api.js                          🌐 RTK Query API definitions
```

---

## 📋 **Detailed File Descriptions**

### **1. Core Filtering Files**

#### `src/features/enquiries/enquiriesSlice.js`
- **Purpose:** Redux state management for enquiries
- **Key State:**
  - `filters` - All filter values (status, priority, category, etc.)
  - `searchQuery` - Search text
  - `sortBy`, `sortOrder` - Sorting configuration
  - `selectedStatus`, `selectedClient` - UI state for chips
  - `pagination` - Page, total, limit
- **Key Actions:**
  - `setFilters(payload)` - Update filters
  - `setSearchQuery(text)` - Update search
  - `setSorting({ sortBy, sortOrder })` - Update sorting
  - `clearFilters()` - Reset all filters
  - `setPage(number)` - Change page

#### `src/features/enquiries/enquiriesHooks.js`
- **Purpose:** Custom hook that combines API calls with filtering
- **Key Functions:**
  - `useFilteredEnquiries(role, userId)` - Main hook for fetching filtered enquiries
  - `useEnquiry(id)` - Fetch single enquiry by ID
- **What it does:**
  - Reads filters from Redux
  - Calls RTK Query API
  - Applies role-based filtering
  - Handles pagination
  - Applies client-side filtering if needed

#### `src/store/api.js`
- **Purpose:** RTK Query API endpoint definitions
- **Key Endpoints:**
  - `getEnquiries` - Fetch enquiries with filters (Line 286-537)
  - `getEnquiryById` - Fetch single enquiry (Line 539+)
  - `createEnquiry` - Create new enquiry
  - `updateEnquiry` - Update enquiry
  - `deleteEnquiry` - Delete enquiry
- **API URL:** `/api/enquiries/search?page=1&limit=10&status=...&sortBy=...`

---

### **2. UI Component Files**

#### `src/screens/Enquiries/EnquiryListScreen.js`
- **Purpose:** Main screen displaying enquiry list
- **Key Features:**
  - Filter chips (status, client)
  - Search input
  - Sort button
  - Filter button (opens modal)
  - FlatList with 2-column grid
  - Infinite scroll
  - Pull to refresh
- **Key Functions:**
  - `renderStatusChips()` - Status filter chips (Line 1318)
  - `renderClientChips()` - Client filter chips (Line 1378)
  - `handleApplyFilters()` - Apply filters from modal (Line 1134)
  - `handleSortChange()` - Change sorting (Line 1301)
  - `onRefresh()` - Pull to refresh (Line 1110)

#### `src/components/filters/EnquiryFiltersModal.js`
- **Purpose:** Modal for advanced filtering
- **Key Features:**
  - Status dropdown (from API)
  - Priority dropdown
  - Category dropdown
  - Client dropdown
  - Assigned To dropdown
  - Stone Type dropdown
  - Metal Color & Quality dropdowns
  - Date range pickers (Shipping, Assigned, Created)
  - Apply & Clear buttons
- **Key Functions:**
  - `handleApply()` - Apply selected filters (Line 66)
  - `handleClear()` - Clear all filters (Line 71)
  - `handleFilterChange()` - Update local filter state (Line 61)

---

### **3. Supporting Files**

#### `src/features/clients/clientsHooks.js`
- **Purpose:** Fetch clients for filter dropdowns
- **Exports:** `useClients()` hook
- **Used by:** EnquiryListScreen, EnquiryFiltersModal

#### `src/features/statuses/statusesHooks.js`
- **Purpose:** Fetch status options for filters
- **Exports:** `useStatusOptions()` hook
- **Used by:** EnquiryListScreen, EnquiryFiltersModal

#### `src/components/cards/Cards.js`
- **Purpose:** Enquiry card components
- **Exports:** `CompactEnquiryCard`, `CompactEnquiryCardMemo`, `EnquiryCard`
- **Used by:** EnquiryListScreen (renders each enquiry)

---

### **4. Related Screen Files**

#### `src/screens/Enquiries/SingleEnquiryScreen.js`
- **Purpose:** View/edit individual enquiry
- **Uses:** `useEnquiry(id)` hook from enquiriesHooks

#### `src/screens/AddEnquiry/AddEnquiryStep1Screen.js`
- **Purpose:** Create new enquiry (step 1)
- **Uses:** `useCreateEnquiryMutation` from api.js

#### `src/screens/EditEnquiry/EditEnquiryStep1Screen.js`
- **Purpose:** Edit existing enquiry (step 1)
- **Uses:** `useUpdateEnquiryMutation` from api.js

#### `src/screens/Dashboard/DashboardScreen.js`
- **Purpose:** Dashboard with enquiry statistics
- **Uses:** `useGetEnquiriesQuery` for dashboard data

---

### **5. Utility Files**

#### `src/utils/pdfGenerator.js`
- **Purpose:** Generate PDF from enquiries
- **Used by:** EnquiryListScreen (download button)

#### `src/components/modals/EnquiryHistoryModal.js`
- **Purpose:** Show enquiry status history
- **Used by:** SingleEnquiryScreen

---

## 🔗 **File Dependencies**

```
EnquiryListScreen.js
├── enquiriesHooks.js
│   ├── api.js (useGetEnquiriesQuery)
│   └── enquiriesSlice.js (Redux state)
├── EnquiryFiltersModal.js
│   ├── clientsHooks.js (for client dropdown)
│   ├── statusesHooks.js (for status dropdown)
│   └── api.js (useGetUsersQuery for assignedTo)
└── Cards.js (rendering components)
```

---

## 📊 **Data Flow Between Files**

```
User clicks filter chip
    ↓
EnquiryListScreen.js (Line 1365)
    ↓
dispatch(setFilters({ status: 'value' }))
    ↓
enquiriesSlice.js (Redux state updated)
    ↓
enquiriesHooks.js (detects filter change)
    ↓
api.js (builds query string)
    ↓
GET /api/enquiries/search?status=...
    ↓
Backend response
    ↓
api.js (normalize data)
    ↓
enquiriesHooks.js (apply client-side filters)
    ↓
EnquiryListScreen.js (enrich with client names)
    ↓
FlatList renders updated data
```

---

## 🧪 **Test Files**

```
src/__tests__/
├── screens/
│   └── EnquiryListScreen.test.js
├── components/
│   └── Filters.test.js
└── integration/
    └── enquiryFlow.test.js
```

---

## 📝 **Quick Reference: Which File Does What?**

| Task | File | Function/Line |
|------|------|---------------|
| **Update filter** | `enquiriesSlice.js` | `setFilters()` action |
| **Fetch enquiries** | `enquiriesHooks.js` | `useFilteredEnquiries()` hook |
| **API call** | `api.js` | `getEnquiries` endpoint (Line 286) |
| **Show filter modal** | `EnquiryFiltersModal.js` | Modal component |
| **Status chip click** | `EnquiryListScreen.js` | `renderStatusChips()` (Line 1318) |
| **Client chip click** | `EnquiryListScreen.js` | `renderClientChips()` (Line 1378) |
| **Apply filters** | `EnquiryListScreen.js` | `handleApplyFilters()` (Line 1134) |
| **Search** | `EnquiryListScreen.js` | `setSearchQuery()` (Line 1508) |
| **Sort** | `EnquiryListScreen.js` | `handleSortChange()` (Line 1301) |
| **Clear filters** | `EnquiryListScreen.js` | `handleClearFilters()` (Line 1130) |

---

## 🎯 **Most Important Files for Filtering**

1. **`src/features/enquiries/enquiriesSlice.js`** - Filter state
2. **`src/features/enquiries/enquiriesHooks.js`** - Data fetching logic
3. **`src/store/api.js`** - API endpoint definition
4. **`src/screens/Enquiries/EnquiryListScreen.js`** - UI & filter chips
5. **`src/components/filters/EnquiryFiltersModal.js`** - Filter modal

---

## 📚 **Additional Resources**

- **Documentation:** `ENQUIRY_FILTERING_FLOW.md` - Complete flow explanation
- **API Config:** `src/config/apiConfig.js` - API base URL configuration

---

## 🔍 **Finding Specific Code**

### To find where filters are applied:
- Search: `setFilters` in `enquiriesSlice.js` and `EnquiryListScreen.js`

### To find API query building:
- File: `src/store/api.js`, Line 286-386

### To find client-side filtering:
- File: `src/features/enquiries/enquiriesHooks.js`, Line 289-523

### To find filter modal UI:
- File: `src/components/filters/EnquiryFiltersModal.js`

### To find chip rendering:
- File: `src/screens/Enquiries/EnquiryListScreen.js`, Line 1318-1458


