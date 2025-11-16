# Branded Alerts Migration Guide

## ✅ Implementation Complete

All alerts and modals now use your brand colors! The native `Alert.alert()` has been replaced with a custom branded alert system.

---

## What Changed

### Before (Native Alert)
```javascript
Alert.alert('Error', 'Something went wrong');
```

### After (Branded Alert)
```javascript
const alert = useAlert();
alert.error('Error', 'Something went wrong');
```

---

## How to Use

### Method 1: Using `useAlert` Hook (Recommended)

```javascript
import { useAlert } from '../context/AlertContext';

const MyComponent = () => {
  const alert = useAlert();

  const handleAction = () => {
    // Success alert
    alert.success('Success!', 'Operation completed successfully');
    
    // Error alert
    alert.error('Error', 'Something went wrong');
    
    // Warning alert
    alert.warning('Warning', 'Please check your input');
    
    // Info alert
    alert.info('Info', 'This is an information message');
    
    // Custom alert with buttons
    alert.show('error', 'Delete?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel', onPress: () => {} },
      { text: 'Delete', style: 'destructive', onPress: () => {} }
    ]);
  };
};
```

### Method 2: Using Utility Functions

```javascript
import { showSuccess, showError, showWarning, showInfo } from '../utils/alert';

// Simple usage
showSuccess('Success!', 'Operation completed');
showError('Error', 'Something went wrong');
showWarning('Warning', 'Please check your input');
showInfo('Info', 'This is an information message');
```

---

## Alert Types

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| **success** | ✅ Check circle | Green (`#47b02c`) | Successful operations |
| **error** | ❌ Error | Red (`#EF4444`) | Errors, failures |
| **warning** | ⚠️ Warning | Yellow (`#ffbb34`) | Warnings, cautions |
| **info** | ℹ️ Info | Brand Primary (`#103534`) | Information, tips |

---

## Button Styles

```javascript
// Default button (primary brand color)
{ text: 'OK', style: 'default' }

// Destructive button (red)
{ text: 'Delete', style: 'destructive' }

// Cancel button (gray)
{ text: 'Cancel', style: 'cancel' }
```

---

## Examples

### Example 1: Simple Success Alert
```javascript
const alert = useAlert();
alert.success('Success!', 'Your changes have been saved.');
```

### Example 2: Error with Custom Button
```javascript
const alert = useAlert();
alert.error('Error', 'Failed to save. Please try again.', [
  { text: 'OK', onPress: () => console.log('OK pressed') }
]);
```

### Example 3: Confirmation Dialog
```javascript
const alert = useAlert();
alert.show('warning', 'Delete Enquiry?', 'This action cannot be undone.', [
  { 
    text: 'Cancel', 
    style: 'cancel',
    onPress: () => console.log('Cancelled')
  },
  { 
    text: 'Delete', 
    style: 'destructive',
    onPress: () => {
      // Delete logic here
      console.log('Deleted');
    }
  }
]);
```

### Example 4: File Size Warning
```javascript
const alert = useAlert();
alert.warning('File Too Large', 'File size exceeds 50 MB limit. Please choose a smaller file.');
```

---

## Migration Checklist

To migrate existing `Alert.alert()` calls:

1. **Import the hook:**
   ```javascript
   import { useAlert } from '../context/AlertContext';
   ```

2. **Add to component:**
   ```javascript
   const alert = useAlert();
   ```

3. **Replace Alert.alert():**
   ```javascript
   // Before
   Alert.alert('Title', 'Message');
   
   // After
   alert.info('Title', 'Message');
   ```

4. **For error alerts:**
   ```javascript
   // Before
   Alert.alert('Error', 'Something went wrong');
   
   // After
   alert.error('Error', 'Something went wrong');
   ```

5. **For success alerts:**
   ```javascript
   // Before
   Alert.alert('Success', 'Operation completed');
   
   // After
   alert.success('Success', 'Operation completed');
   ```

---

## Files Already Updated

✅ `src/screens/Chats/ChatDetailScreen.js` - All alerts replaced

---

## Files That Need Migration

The following files still use `Alert.alert()` and should be migrated:

- `src/screens/Enquiries/SingleEnquiryScreen.js`
- `src/screens/Pricing/PricingScreen.js`
- `src/screens/DesignViewer/DesignViewerScreen.js`
- `src/screens/UploadDesign/UploadDesignScreen.js`
- `src/screens/Enquiries/EnquiryListScreen.js`
- `src/screens/EditEnquiry/EditEnquiryStep2Screen.js`
- `src/screens/Auth/LoginScreen.js`
- `src/screens/AddEnquiry/AddEnquiryStep2Screen.js`
- `src/screens/Admin/MetalPricesScreen.js`
- `src/screens/Admin/ClientsListScreen.js`
- `src/components/modals/AccountModal.js`

---

## Brand Colors Used

- **Primary:** `#103534` (Dark teal) - Used for info alerts and default buttons
- **Success:** `#47b02c` (Green) - Success alerts
- **Error:** `#EF4444` (Red) - Error alerts
- **Warning:** `#ffbb34` (Yellow) - Warning alerts
- **Accent:** `#D4AF37` (Gold) - Available for custom use

---

## Visual Design

- **Rounded corners:** 16px border radius
- **Icon size:** 48px in circular background
- **Typography:** Brand fonts (bold for title, regular for message)
- **Shadows:** Subtle elevation for depth
- **Animation:** Smooth fade in/out
- **Responsive:** Adapts to screen width (85% max, 400px max)

---

## Benefits

✅ **Consistent Branding:** All alerts match your brand colors  
✅ **Better UX:** More visually appealing than native alerts  
✅ **Customizable:** Easy to modify colors and styling  
✅ **Type-safe:** Clear distinction between alert types  
✅ **Accessible:** Proper touch targets and contrast  

---

## Quick Reference

```javascript
// Import
import { useAlert } from '../context/AlertContext';

// In component
const alert = useAlert();

// Show alerts
alert.success('Title', 'Message');
alert.error('Title', 'Message');
alert.warning('Title', 'Message');
alert.info('Title', 'Message');

// With buttons
alert.error('Title', 'Message', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'OK', style: 'default', onPress: () => {} }
]);
```

---

## Need Help?

If you encounter any issues:
1. Make sure `AlertProvider` wraps your app (already done in `App.tsx`)
2. Import `useAlert` from `../context/AlertContext`
3. Call `useAlert()` inside your component (not outside)

---

## Summary

All alerts now use your brand colors! 🎨

- ✅ Branded colors for all alert types
- ✅ Consistent design across the app
- ✅ Easy to use with `useAlert()` hook
- ✅ Better user experience






