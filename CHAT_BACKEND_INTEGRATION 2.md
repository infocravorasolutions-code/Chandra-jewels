# Chat Backend Integration - Implementation Summary

## Overview
This document summarizes the changes made to align the React Native chat implementation with the backend API structure.

## Backend Chat Architecture

### Chat Model
- **Two Chat Types**: `admin-client` and `admin-designer`
- **One Chat Per Enquiry Per Type**: Each enquiry can have two chats (one for client communication, one for designer communication)
- **Unique Index**: `{ EnquiryId: 1, Type: 1 }` ensures uniqueness

### API Endpoints

#### 1. Get Chats
- **Endpoint**: `GET /api/chats`
- **Query Parameters**:
  - `type` (optional): `'admin-client'` or `'admin-designer'`
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 10)
  - `search` (optional): Search by enquiry name or ID
- **Response Format**:
  ```json
  {
    "Total": 15,
    "page": 1,
    "limit": 10,
    "TotalPages": 2,
    "Data": [
      {
        "_id": "chat_id",
        "EnquiryId": "enquiry_id",
        "EnquiryName": "Enquiry Name",
        "Type": "admin-client",
        "LastMessage": {
          "Text": "Message text",
          "Timestamp": "2024-01-15T10:30:00.000Z",
          "Sender": "Sender Name"
        },
        "UnreadCount": 2,
        "UpdatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
  ```

#### 2. Get Messages
- **Endpoint**: `GET /api/message/:chatId/messages`
- **Query Parameters**:
  - `before` (optional): Timestamp cursor for pagination
  - `limit` (optional): Number of messages (default: 20)
- **Response Format**:
  ```json
  {
    "ChatId": "chat_id",
    "Limit": 20,
    "Data": [...messages],
    "NextCursor": "2024-01-15T09:00:00.000Z" // null if no more messages
  }
  ```

#### 3. Upload Media
- **Endpoint**: `POST /api/message/upload`
- **Method**: Multipart form data
- **Response**: Returns media key, URL, name, size

#### 4. Send Message
- **Method**: WebSocket only (no HTTP endpoint)
- **Event**: `sendMessage`
- **Data**:
  ```json
  {
    "chatId": "chat_id",
    "userId": "user_id",
    "message": "Message text",
    "messageType": "text" | "image" | "video" | "file",
    "parentMessageId": null,
    "mediaKey": "...",
    "mediaName": "...",
    "mediaUrl": "...",
    "mediaSize": 0
  }
  ```

## Changes Made to App

### 1. Chat Fetching (`src/hooks/useChat.js`)
- **Before**: Tried to fetch chat from non-existent endpoint `/api/chats/enquiry/:enquiryId`
- **After**: Searches for chat in `/api/chats` list by enquiryId and type
- **Virtual Chat**: If chat doesn't exist, creates virtual chat object (backend creates real chat on first message)

### 2. Message Sending
- **Before**: Had HTTP POST fallback when WebSocket failed
- **After**: Removed HTTP fallback - messages only sent via WebSocket (matches backend)
- **Chat Creation**: If chat doesn't exist, tries to find it before sending first message

### 3. Socket Connection
- **Updated**: Handles virtual chats (chat._id = null) gracefully
- **Join Chat**: Only joins socket room if chat._id exists

### 4. Chat Type Handling
- **Admin**: Can see both `admin-client` and `admin-designer` chats
- **Client**: Only sees `admin-client` chats
- **Designer/Coral/Cad**: Only sees `admin-designer` chats

## Known Issues & Limitations

### 1. Chat Creation
**Issue**: Backend requires chat to exist before sending messages, but there's no endpoint to create a chat.

**Current Workaround**: 
- App searches for chat in the list
- If not found, creates virtual chat
- When first message is sent, tries to find chat again
- If still not found, message fails

**Recommended Solution**:
Add backend endpoint to create/get chat by enquiryId and type:
```javascript
// Backend route needed:
GET /api/chats/enquiry/:enquiryId?type=admin-client
// or
POST /api/chats (with EnquiryId and Type)
```

### 2. WebSocket Dependency
**Issue**: Messages can only be sent when WebSocket is connected.

**Current Behavior**:
- If WebSocket not connected, message fails
- User sees error message
- Message marked as "failed" in UI

**Future Enhancement**:
- Queue messages when offline
- Send queued messages when connection restored

## Testing Checklist

- [x] Chat list loads correctly with type filter
- [x] Chat fetching searches by enquiryId
- [x] Virtual chat created when chat doesn't exist
- [x] Messages sent via WebSocket only
- [x] Socket connection handles virtual chats
- [ ] Chat creation endpoint (needs backend)
- [ ] Offline message queue (future enhancement)

## Files Modified

1. `src/hooks/useChat.js`
   - Updated `fetchChat` to use `/api/chats` endpoint
   - Removed HTTP POST fallback for messages
   - Added virtual chat handling
   - Updated socket connection logic

2. `src/screens/Chats/ChatDetailScreen.js`
   - Updated to await async `sendMessage`

## Backend Requirements

To fully support the app, the backend should:

1. **Add Chat Creation Endpoint** (Recommended):
   ```javascript
   // Option 1: Get or create chat
   GET /api/chats/enquiry/:enquiryId?type=admin-client
   
   // Option 2: Create chat explicitly
   POST /api/chats
   {
     "EnquiryId": "...",
     "Type": "admin-client"
   }
   ```

2. **Auto-Create Chat on First Message** (Alternative):
   - Modify socket handler to create chat if it doesn't exist
   - Use enquiryId to find/create chat before saving message

## Next Steps

1. **Backend**: Add endpoint to create/get chat by enquiryId and type
2. **Frontend**: Update to use new endpoint for chat creation
3. **Testing**: Test chat creation flow end-to-end
4. **Enhancement**: Add offline message queue for better UX

## Summary

The app has been updated to match the backend API structure:
- ✅ Uses correct endpoints (`/api/chats`, `/api/message/:chatId/messages`)
- ✅ Handles chat types correctly (`admin-client`, `admin-designer`)
- ✅ Sends messages via WebSocket only (matches backend)
- ✅ Handles virtual chats until real chat is created
- ⚠️ Needs backend endpoint for chat creation to fully work

The main remaining issue is chat creation - the app needs a way to create the chat before sending the first message, or the backend needs to auto-create it.



