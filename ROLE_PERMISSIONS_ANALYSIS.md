# Role-Based Permissions Analysis

## Current Implementation vs Requirements

### ✅ ADMIN - What's Working:
- ✅ Edit enquiry
- ✅ See coral cad versions
- ✅ Pricing edits, calculations
- ✅ Approve, reject
- ✅ Delete versions
- ✅ Share button
- ✅ Comment below images
- ✅ Download images, excel

### ❌ ADMIN - Missing:
- ❌ **Show to Client button** - NOT IMPLEMENTED
  - Need to add a button/toggle to mark versions as visible to clients
  - Should set `ShowToClient: true` or similar flag on version

---

### ✅ CORAL - What's Working:
- ✅ See all uploaded versions
- ✅ Upload coral versions (excel/images, version name, coral code)
- ✅ Download images/excel

### ❌ CORAL - Missing/Incorrect:
- ❌ **NO PRICING** - Pricing button is hidden for designers (✅ Correct)
- ❌ **Delete within 10 mins** - NOT IMPLEMENTED
  - Currently designers can delete anytime
  - Need to check upload timestamp and allow delete only within 10 minutes

---

### ✅ CAD - What's Working:
- ✅ See all uploaded versions
- ✅ Upload cad versions (excel/images, version name, cad code)
- ✅ Download images/excel

### ❌ CAD - Missing/Incorrect:
- ❌ **NO PRICING** - Pricing button is hidden for designers (✅ Correct)
- ❌ **Delete within 10 mins** - NOT IMPLEMENTED
  - Currently designers can delete anytime
  - Need to check upload timestamp and allow delete only within 10 minutes

---

### ✅ CLIENT - What's Working:
- ✅ Approve, Reject - with message
- ✅ See versions (but sees ALL versions, not filtered)

### ❌ CLIENT - Missing/Incorrect:
- ❌ **Edit enquiry** - Currently ALLOWED but should be REMOVED
  - `renderClientActions()` has "Edit Enquiry" button (line 1253-1257)
  - Should be removed per requirements
- ❌ **See versions with ShowToClient=true** - NOT IMPLEMENTED
  - Currently clients see all versions
  - Need to filter versions to only show those marked as `ShowToClient: true` or `IsVisibleToClient: true`

---

## Summary of Required Changes:

1. **Add "Show to Client" button for Admin** (DesignViewerScreen.js)
   - Add toggle/button to mark version as visible to clients
   - Update API to set `ShowToClient: true` flag

2. **Remove "Edit Enquiry" button for Clients** (SingleEnquiryScreen.js)
   - Remove the button from `renderClientActions()`

3. **Filter versions for Clients** (DesignViewerScreen.js, SingleEnquiryScreen.js)
   - Only show versions where `ShowToClient === true` or `IsVisibleToClient === true`

4. **Add 10-minute delete window for Coral/CAD** (DesignViewerScreen.js)
   - Check `UploadDate` or `CreatedAt` timestamp
   - Only allow delete if `(currentTime - uploadTime) < 10 minutes`
   - Disable delete button or show error after 10 minutes

5. **Verify Pricing is hidden for Coral/CAD** (DesignViewerScreen.js)
   - ✅ Already correct - Pricing button only shows for `isAdmin`

