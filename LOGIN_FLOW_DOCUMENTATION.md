# Login System Flow Documentation

## Overview
This document explains how the login system works in the Chandra Jewels app, including the recent changes for Client users (Role 4).

---

## 🔐 Complete Login Flow

### Step 1: User Enters Credentials
- **File**: `src/screens/Auth/LoginScreen.js`
- User enters email and password
- Form validation occurs (email format, password length)

### Step 2: API Login Request
- **File**: `src/store/api.js` (login mutation)
- **Endpoint**: `POST /api/login`
- **Payload**: `{ email, password }`
- **Response**: JWT token string

### Step 3: Token Decoding & User Data Extraction
- **File**: `src/store/api.js` (transformResponse in login mutation)
- **Process**:
  1. Decode JWT token using `decodeJWT()` helper
  2. Extract user information from token:
     - `Id` or `id` → `userId`
     - `Role` or `role` → `roleNumber` (1-4)
     - `Name` or `name` → `userName`
     - **NEW**: `ClientId` or `clientId` → `clientId` (for Role 4 users)
  3. Map role number to role string:
     - `1` → `'admin'`
     - `2` → `'coral'`
     - `3` → `'cad'`
     - `4` → `'client'`

### Step 4: Fetch Additional User Details
- **File**: `src/screens/Auth/LoginScreen.js` (handleLogin function)
- **Process**:
  1. If user ID is available, fetch full user details from API:
     - `GET /api/users/{userId}`
     - This provides name, phone, and other details from database
  2. Priority for user name:
     - Database name (from API) → Token name → Generated from email

### Step 5: Store User Data
- **File**: `src/screens/Auth/LoginScreen.js`
- **Storage**:
  1. **AsyncStorage**:
     - `AsyncStorage.setItem('user', JSON.stringify(userData))`
     - `AsyncStorage.setItem('token', token)`
  2. **Redux Store**:
     - `dispatch(setCredentials({ user: userData, token }))`
  3. **User Data Structure**:
     ```javascript
     {
       id: userId,
       role: roleString,        // 'admin', 'coral', 'cad', 'client'
       roleNumber: roleNumber,  // 1, 2, 3, 4
       roleId: roleNumber,      // Alias
       name: userName,
       email: email,
       clientId: clientId,      // NEW: Only for Role 4 users
       phone: phone,           // Optional
       iat: tokenIssuedAt
     }
     ```

### Step 6: Navigation
- **File**: `src/navigation/StackNavigator.js`
- Navigation automatically updates based on `isAuthenticated` state
- If authenticated → Shows main app screens (Dashboard, Enquiries, etc.)
- If not authenticated → Shows Login screen

---

## 🆕 Changes for Client Users (Role 4)

### What Changed?

#### 1. Token Decoding (Login API)
**File**: `src/store/api.js` (line ~180)

**Before**:
```javascript
return {
  success: true,
  token,
  user: {
    id: userId,
    role: roleString,
    roleNumber: roleNumber,
    roleId: roleNumber,
    name: userName,
    iat: decodedToken.iat,
  },
};
```

**After**:
```javascript
// Extract ClientId from token (for role 4 - Client users)
const clientId = decodedToken.ClientId || decodedToken.clientId || 
                 decodedToken.ClientID || decodedToken.clientID;

return {
  success: true,
  token,
  user: {
    id: userId,
    role: roleString,
    roleNumber: roleNumber,
    roleId: roleNumber,
    name: userName,
    clientId: clientId,  // NEW: Stored for Role 4 users
    iat: decodedToken.iat,
  },
};
```

#### 2. Persisted Session Check
**File**: `src/features/auth/authThunks.js` (checkAuthState)

**Added**:
```javascript
// Extract ClientId from token for role 4 (Client users)
if (decodedToken && (userData.roleId === 4 || userData.roleNumber === 4)) {
  const clientId = decodedToken.ClientId || decodedToken.clientId || 
                   decodedToken.ClientID || decodedToken.clientID;
  if (clientId && userData.clientId !== clientId) {
    userData.clientId = clientId;
    userDataUpdated = true;
  }
}
```

#### 3. Dashboard API Filtering
**File**: `src/store/api.js` (getDashboardData query)

**Before**:
```javascript
} else if (isClient) {
  statusAggregateUrl = `/api/enquiries/aggregate?groupBy=status&clientId=${encodeURIComponent(userId)}`;
}
```

**After**:
```javascript
const clientId = typeof arg === 'object' ? arg?.clientId : undefined;
const isClientRole = isClient || roleNumber === 4;
const clientFilterId = isClientRole && clientId ? clientId : (isClientRole ? userId : undefined);

if (isClientRole && clientFilterId) {
  statusAggregateUrl = `/api/enquiries/aggregate?groupBy=status&clientId=${encodeURIComponent(clientFilterId)}`;
}
```

#### 4. Enquiry List Filtering
**File**: `src/screens/Enquiries/EnquiryListScreen.js`

**Before**:
```javascript
const currentUserId = user?.id || user?._id || user?.userId;

if ((!normalizedFilters.clientId || normalizedFilters.clientId === 'all') && isClient && currentUserId) {
  normalizedFilters.clientId = currentUserId;
}
```

**After**:
```javascript
const currentUserId = user?.id || user?._id || user?.userId;
// For Client users (role 4), use ClientId from token instead of userId
const clientUserId = (isClient && user?.clientId) ? user.clientId : currentUserId;

if ((!normalizedFilters.clientId || normalizedFilters.clientId === 'all') && isClient && clientUserId) {
  normalizedFilters.clientId = clientUserId;
}
```

#### 5. Dashboard Screen Update
**File**: `src/screens/Dashboard/DashboardScreen.js`

**Before**:
```javascript
useGetDashboardDataQuery(
  { 
    role: user?.role || 'client',
    userId: user?.id || user?._id || user?.userId,
  },
  { skip: !user }
);
```

**After**:
```javascript
useGetDashboardDataQuery(
  { 
    role: user?.role || 'client',
    userId: user?.id || user?._id || user?.userId,
    clientId: user?.clientId,        // NEW: Pass ClientId for Role 4
    roleNumber: user?.roleNumber || user?.roleId,  // NEW: Pass role number
  },
  { skip: !user }
);
```

---

## 📋 Token Structure

### Example Token Payload (Role 4 - Client User)
```json
{
  "Id": "6913ff7a16de5b81af5de7d2",
  "Role": 4,
  "ClientId": "6871535a0798b31bfa7fe5e4",
  "iat": 1763757029
}
```

### User Data After Login (Role 4)
```javascript
{
  id: "6913ff7a16de5b81af5de7d2",
  role: "client",
  roleNumber: 4,
  roleId: 4,
  name: "Client Name",
  email: "client@example.com",
  clientId: "6871535a0798b31bfa7fe5e4",  // Used for filtering
  iat: 1763757029
}
```

---

## 🔄 How ClientId is Used

### 1. Dashboard Counts
- **API**: `/api/enquiries/aggregate?groupBy=status&clientId={clientId}`
- Only enquiries belonging to that specific client are counted
- Dashboard shows counts specific to the logged-in client

### 2. Enquiry List
- **API**: `/api/enquiries/search?clientId={clientId}&page=1&limit=25`
- Only enquiries where `ClientId` matches the user's `clientId` are shown
- Client users cannot see other clients' enquiries

### 3. Automatic Filtering
- No manual filter selection needed
- `clientId` is automatically added to all API requests for Role 4 users
- Works seamlessly in the background

---

## 🎯 Key Points

1. **ClientId is extracted from JWT token** - Not from a separate API call
2. **ClientId is stored in user object** - Available throughout the app
3. **Automatic filtering** - All dashboard and enquiry APIs automatically include `clientId` filter
4. **Backward compatible** - Other roles (Admin, Coral, CAD) work exactly as before
5. **Persistent** - ClientId is saved in AsyncStorage and restored on app restart

---

## 🧪 Testing the Flow

### Test Client User Login:
1. Login with Role 4 credentials
2. Check console logs for:
   - `🔐 Client user detected - ClientId from token: {clientId}`
   - `🔐 [DASHBOARD] Client user detected`
   - `🔐 [ENQUIRY LIST] Client user - using ClientId from token`
3. Verify:
   - Dashboard shows only that client's enquiry counts
   - Enquiry list shows only that client's enquiries
   - No other clients' data is visible

---

## 📝 Files Modified

1. `src/store/api.js` - Login mutation, Dashboard API, Enquiry API
2. `src/features/auth/authThunks.js` - checkAuthState
3. `src/screens/Auth/LoginScreen.js` - User data storage
4. `src/screens/Dashboard/DashboardScreen.js` - Dashboard API call
5. `src/screens/Enquiries/EnquiryListScreen.js` - Enquiry filtering

---

## ✅ Summary

The login system now:
- ✅ Extracts `ClientId` from JWT token for Role 4 users
- ✅ Stores `ClientId` in user object and AsyncStorage
- ✅ Automatically filters dashboard counts by `ClientId`
- ✅ Automatically filters enquiry list by `ClientId`
- ✅ Works seamlessly without manual intervention
- ✅ Maintains backward compatibility for other roles

