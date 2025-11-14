# Sentry Testing Guide

This guide explains how to test Sentry error tracking and crash reporting in your app, and how to view errors in the Sentry dashboard.

## 🧪 Testing in Your App

### Method 1: Using the Test Panel (Development Mode Only)

1. **Open your app** in development mode (`npm start` and `npm run android` or `npm run ios`)

2. **Navigate to Dashboard** - The Sentry test panel will automatically appear on the Dashboard screen (only visible in development mode)

3. **Click any test button** to trigger different types of errors:
   - **Simple Error** - Basic error message
   - **Exception** - Exception with stack trace
   - **Crash** - Simulates an app crash
   - **Error + Context** - Error with additional context and tags
   - **Warning** - Warning level message
   - **Info** - Info level message
   - **Network Error** - Simulated network error
   - **With Breadcrumbs** - Error with breadcrumb trail
   - **With User** - Error with user context
   - **Performance** - Performance monitoring test

4. **Check console** - You'll see a confirmation message: `✅ Test error sent to Sentry`

### Method 2: Programmatic Testing

You can also import and use the test functions directly in your code:

```javascript
import {
  testSimpleError,
  testException,
  testCrash,
  testErrorWithContext,
} from './src/utils/sentryTest';

// Call any test function
testSimpleError();
```

### Method 3: Manual Error Testing

Add Sentry error tracking to your existing error handlers:

```javascript
import * as Sentry from '@sentry/react-native';

try {
  // Your code that might throw an error
  someFunction();
} catch (error) {
  // Capture the error in Sentry
  Sentry.captureException(error);
  
  // Your existing error handling
  console.error('Error:', error);
}
```

## 📊 Viewing Errors in Sentry Dashboard

### Step 1: Log in to Sentry

1. Go to **https://sentry.io**
2. Log in with your account
3. Select your organization: **chandra-jewels**
4. Select your project: **react-native**

### Step 2: View Issues

1. **Navigate to Issues** - Click "Issues" in the left sidebar
2. **See all errors** - You'll see a list of all captured errors
3. **Click an issue** to see details:
   - Error message and stack trace
   - When it occurred
   - How many times it happened
   - User information (if set)
   - Device information
   - Breadcrumbs (user actions before error)
   - Context data

### Step 3: Understanding Issue Details

When you click on an issue, you'll see:

#### **Overview Tab**
- Error message and type
- Stack trace showing where the error occurred
- Release information
- Environment (development/production)

#### **Tags Tab**
- Custom tags you've set (like `test-type`, `error-type`)
- Device information
- OS version
- App version

#### **Context Tab**
- User information (if set)
- Device information
- App context
- Custom context data

#### **Breadcrumbs Tab**
- Timeline of events before the error
- User actions
- Network requests
- Console logs
- Navigation events

#### **Events Tab**
- All occurrences of this error
- Timeline of when errors happened
- Frequency graph

### Step 4: Filter and Search

Use the filters at the top to:
- **Search** - Search for specific error messages
- **Filter by environment** - Show only development or production errors
- **Filter by date** - Show errors from specific time periods
- **Filter by user** - Show errors from specific users
- **Filter by tags** - Show errors with specific tags

### Step 5: Set Up Alerts (Optional)

1. Go to **Alerts** → **Create Alert Rule**
2. Set conditions:
   - When error count exceeds a threshold
   - When a new error type appears
   - When error rate increases
3. Add notification channels:
   - Email
   - Slack
   - Discord
   - PagerDuty
   - etc.

## 🎯 Common Test Scenarios

### Test 1: Simple Error
- **What it tests**: Basic error message capture
- **Expected in Sentry**: Error message appears in Issues list
- **Use case**: Testing basic integration

### Test 2: Exception with Stack Trace
- **What it tests**: Full stack trace capture
- **Expected in Sentry**: Detailed stack trace showing file names and line numbers
- **Use case**: Debugging where errors occur

### Test 3: Crash Simulation
- **What it tests**: Unhandled error capture
- **Expected in Sentry**: Crash report with full app state
- **Use case**: Testing crash reporting

### Test 4: Error with Context
- **What it tests**: Custom context and tags
- **Expected in Sentry**: Error with custom tags and context data
- **Use case**: Adding metadata to errors for better debugging

### Test 5: Network Error
- **What it tests**: Network error tracking
- **Expected in Sentry**: Error with network context (URL, method, status)
- **Use case**: Tracking API failures

### Test 6: Error with Breadcrumbs
- **What it tests**: User action tracking
- **Expected in Sentry**: Timeline of actions before error
- **Use case**: Understanding what user did before error

### Test 7: Error with User Context
- **What it tests**: User identification
- **Expected in Sentry**: Error associated with specific user
- **Use case**: Tracking errors per user

### Test 8: Performance Monitoring
- **What it tests**: Performance transaction tracking
- **Expected in Sentry**: Performance data in Performance tab
- **Use case**: Monitoring app performance

## 🔍 Troubleshooting

### Errors not appearing in Sentry?

1. **Check DSN** - Make sure your DSN is correct in `index.js`
2. **Check network** - Ensure device has internet connection
3. **Check Sentry initialization** - Look for warnings in console
4. **Wait a few seconds** - Sentry batches errors, may take 5-10 seconds
5. **Check Sentry dashboard** - Refresh the Issues page

### Test panel not showing?

- Make sure you're running in **development mode** (`__DEV__ === true`)
- The test panel only appears in dev builds, not production builds

### Want to test in production build?

You can still trigger errors programmatically, but the test panel won't show. Use the test functions directly in your code.

## 📱 Testing on Real Devices

1. **Build release version**:
   ```bash
   # Android
   npm run build:android:release
   
   # iOS
   npm run build:ios:release
   ```

2. **Install on device** and test real scenarios

3. **Check Sentry dashboard** - Errors will appear with device information

## 🎓 Best Practices

1. **Test regularly** - Run tests after major updates
2. **Monitor production** - Set up alerts for production errors
3. **Add context** - Include user info, device info, and custom tags
4. **Use breadcrumbs** - They help understand what led to errors
5. **Review regularly** - Check Sentry dashboard weekly for new issues

## 📚 Additional Resources

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [Sentry Dashboard Guide](https://docs.sentry.io/product/issues/)
- [Error Tracking Best Practices](https://docs.sentry.io/product/issues/issue-details/)

---

**Note**: The test panel is only visible in development mode for security reasons. It will not appear in production builds.

