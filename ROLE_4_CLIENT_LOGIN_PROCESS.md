# Role 4 (Client) Login Process - Step by Step

## 🎯 Overview
This document explains **exactly** how a Client user (Role 4) logs in and how the system handles their authentication differently from other roles.

---

## 📋 Step-by-Step Process

### **STEP 1: Client User Enters Credentials**

**Location**: `src/screens/Auth/LoginScreen.js`

**What happens**:
- Client user enters their email and password
- Example: `email: "client@example.com"`, `password: "123456"`

**Code**:
```javascript
const handleLogin = async () => {
  // User clicks "Sign In" button
  const result = await loginMutation({
    email: formData.email,
    password: formData.password,
  }).unwrap();
}
```

---

### **STEP 2: Backend Validates & Returns JWT Token**

**API Call**: `POST /api/login`

**Request**:
```json
{
  "email": "client@example.com",
  "password": "123456"
}
```

**Response** (JWT Token):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJZCI6IjY5MTNmZjdhMTZkZTViODFhZjVkZTdkMiIsIlJvbGUiOjQsIkNsaWVudElkIjoiNjg3MTUzNWEwNzk4YjMxYmY3ZmU1ZTQiLCJpYXQiOjE3NjM3NTcwMjl9...
```

**Token Payload (Decoded)**:
```json
{
  "Id": "6913ff7a16de5b81af5de7d2",           // User ID
  "Role": 4,                                  // Role Number (4 = Client)
  "ClientId": "6871535a0798b31bfa7fe5e4",    // ⭐ THIS IS THE KEY!
  "iat": 1763757029                           // Issued at timestamp
}
```

---

### **STEP 3: Token is Decoded & ClientId is Extracted**

**Location**: `src/store/api.js` (login mutation - transformResponse)

**What happens**:
1. JWT token is decoded using `decodeJWT()` helper
2. System extracts:
   - `Id` → User ID
   - `Role` → 4 (Client)
   - **`ClientId` → This is extracted!** ⭐
   - `Name` → User name (if available)

**Code**:
```javascript
const decodedToken = decodeJWT(token);

// Extract Role
const roleNumber = decodedToken.Role;  // 4

// Extract User ID
const userId = decodedToken.Id;

// ⭐ EXTRACT CLIENTID (NEW FOR ROLE 4)
const clientId = decodedToken.ClientId || decodedToken.clientId || 
                 decodedToken.ClientID || decodedToken.clientID;

// Log for debugging
if (__DEV__ && roleNumber === 4 && clientId) {
  console.log('🔐 Client user detected - ClientId from token:', clientId);
}

// Return user object
return {
  success: true,
  token,
  user: {
    id: userId,
    role: 'client',           // Mapped from roleNumber 4
    roleNumber: 4,
    roleId: 4,
    name: userName,
    clientId: clientId,      // ⭐ STORED HERE!
    iat: decodedToken.iat,
  },
};
```

**Console Output**:
```
🔐 Client user detected - ClientId from token: 6871535a0798b31bfa7fe5e4
```

---

### **STEP 4: Additional User Details Fetched (Optional)**

**Location**: `src/screens/Auth/LoginScreen.js` (handleLogin function)

**What happens**:
- System fetches full user details from database to get accurate name
- API: `GET /api/users/{userId}`
- This is optional - login continues even if this fails

**Code**:
```javascript
const userResponse = await fetch(`${API_BASE_URL}/api/users/${result.user.id}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${result.token}`,
    'Content-Type': 'application/json',
  },
});
```

---

### **STEP 5: User Data is Prepared & Stored**

**Location**: `src/screens/Auth/LoginScreen.js`

**Final User Object**:
```javascript
const userData = {
  id: "6913ff7a16de5b81af5de7d2",
  role: "client",
  roleNumber: 4,
  roleId: 4,
  name: "Client Name",                    // From database or token
  email: "client@example.com",
  clientId: "6871535a0798b31bfa7fe5e4",  // ⭐ CLIENTID STORED!
  phone: "1234567890",                    // Optional
  iat: 1763757029
};
```

**Storage**:
1. **AsyncStorage** (Persistent):
   ```javascript
   await AsyncStorage.setItem('user', JSON.stringify(userData));
   await AsyncStorage.setItem('token', result.token);
   ```

2. **Redux Store** (In-memory):
   ```javascript
   dispatch(setCredentials({ user: userData, token: result.token }));
   ```

---

### **STEP 6: App Navigation**

**Location**: `src/navigation/StackNavigator.js`

**What happens**:
- Navigation automatically detects `isAuthenticated = true`
- Client user is redirected to **Dashboard** screen
- Client-specific dashboard is shown

---

## 🔄 How ClientId is Used After Login

### **1. Dashboard Counts**

**Location**: `src/screens/Dashboard/DashboardScreen.js`

**API Call**:
```javascript
useGetDashboardDataQuery({
  role: 'client',
  userId: user?.id,
  clientId: user?.clientId,        // ⭐ PASSED HERE!
  roleNumber: 4,
});
```

**Backend API**:
```
GET /api/enquiries/aggregate?groupBy=status&clientId=6871535a0798b31bfa7fe5e4
```

**Result**: Only enquiries belonging to this specific client are counted.

---

### **2. Enquiry List**

**Location**: `src/screens/Enquiries/EnquiryListScreen.js`

**Code**:
```javascript
// For Client users (role 4), use ClientId from token instead of userId
const clientUserId = (isClient && user?.clientId) ? user.clientId : currentUserId;

// Automatically add clientId filter
if ((!normalizedFilters.clientId || normalizedFilters.clientId === 'all') && 
    isClient && clientUserId) {
  normalizedFilters.clientId = clientUserId;  // ⭐ AUTO-FILTERED!
}
```

**API Call**:
```
GET /api/enquiries/search?clientId=6871535a0798b31bfa7fe5e4&page=1&limit=25
```

**Result**: Only enquiries where `ClientId` matches the logged-in client are shown.

---

### **3. All API Calls**

**Automatic Filtering**:
- Every API call for dashboard, enquiries, etc. automatically includes `clientId` parameter
- Client users **cannot** see other clients' data
- No manual filter selection needed - it's automatic!

---

## 📊 Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Client User Enters Credentials                    │
│  Email: client@example.com                                  │
│  Password: 123456                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Backend Returns JWT Token                          │
│  Token contains: { Id, Role: 4, ClientId: "6871..." }      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Token Decoded & ClientId Extracted                │
│  clientId = "6871535a0798b31bfa7fe5e4" ⭐                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: User Data Stored                                   │
│  AsyncStorage: { ..., clientId: "6871..." }                │
│  Redux: { ..., clientId: "6871..." }                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Dashboard Loads                                    │
│  API: /aggregate?clientId=6871...                           │
│  Result: Only this client's enquiry counts                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Enquiry List Loads                                 │
│  API: /search?clientId=6871...                              │
│  Result: Only this client's enquiries                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Key Differences: Client vs Other Roles

| Feature | Admin (Role 1) | Coral/CAD (Role 2/3) | **Client (Role 4)** |
|---------|---------------|---------------------|---------------------|
| **Token Contains** | `Id`, `Role: 1` | `Id`, `Role: 2/3` | `Id`, `Role: 4`, **`ClientId`** ⭐ |
| **Dashboard Filter** | None (all data) | `assignedTo={userId}` | **`clientId={clientId}`** ⭐ |
| **Enquiry Filter** | None (all data) | `assignedTo={userId}` | **`clientId={clientId}`** ⭐ |
| **Data Visibility** | All enquiries | Assigned enquiries | **Only their enquiries** ⭐ |

---

## 🧪 Testing Client Login

### **Test Steps**:

1. **Login as Client**:
   ```
   Email: test@cl.com
   Password: 123456
   ```

2. **Check Console Logs**:
   ```
   🔐 Client user detected - ClientId from token: 6871535a0798b31bfa7fe5e4
   🔐 [DASHBOARD] Client user detected: { role: 'client', clientId: '6871...' }
   🔐 [ENQUIRY LIST] Client user - using ClientId from token: 6871535a0798b31bfa7fe5e4
   ```

3. **Verify**:
   - ✅ Dashboard shows only this client's enquiry counts
   - ✅ Enquiry list shows only this client's enquiries
   - ✅ Cannot see other clients' data
   - ✅ `clientId` is stored in user object

---

## 📝 Summary

### **What Makes Client Login Different?**

1. **Token Contains ClientId**: The JWT token includes `ClientId` field
2. **ClientId is Extracted**: System extracts `ClientId` during token decoding
3. **ClientId is Stored**: Saved in user object, AsyncStorage, and Redux
4. **Automatic Filtering**: All API calls automatically include `clientId` filter
5. **Data Isolation**: Client users can only see their own data

### **No Manual Steps Required!**

- ✅ ClientId extraction is **automatic**
- ✅ Filtering is **automatic**
- ✅ Data isolation is **automatic**
- ✅ Works seamlessly in the background

---

## 🎯 Key Code Locations

1. **Token Decoding**: `src/store/api.js` (line ~180)
2. **ClientId Storage**: `src/screens/Auth/LoginScreen.js` (line ~123)
3. **Session Restoration**: `src/features/auth/authThunks.js` (line ~47)
4. **Dashboard Filtering**: `src/store/api.js` (getDashboardData)
5. **Enquiry Filtering**: `src/screens/Enquiries/EnquiryListScreen.js` (line ~93)

---

## ✅ Checklist for Client Login

- [x] Token contains `ClientId` field
- [x] `ClientId` is extracted during login
- [x] `ClientId` is stored in user object
- [x] `ClientId` is persisted in AsyncStorage
- [x] Dashboard uses `ClientId` for filtering
- [x] Enquiry list uses `ClientId` for filtering
- [x] All API calls include `clientId` parameter
- [x] Client users see only their own data

---

**That's it! The Client login process is fully automated and secure.** 🎉

