# Installing socket.io-client

There's an issue with your `node_modules` directory that's preventing installation. Here's how to fix it:

## Option 1: Clean Install (Recommended)

1. **Stop the Metro bundler** if it's running (Ctrl+C)

2. **Clean node_modules and reinstall:**
   ```bash
   cd /Users/mohitrathod/Documents/cravora/Projects/Chandra-jewels
   rm -rf node_modules
   npm install
   ```

3. **Install socket.io-client:**
   ```bash
   npm install socket.io-client --save
   ```

4. **Restart Metro bundler:**
   ```bash
   npm start -- --reset-cache
   ```

5. **Rebuild the app:**
   ```bash
   # For Android
   npm run android
   
   # For iOS
   npm run ios
   ```

## Option 2: Fix Corrupted Directories

If you see errors about directories like "eslint 2" or "metro 2", these are corrupted:

1. **Remove the corrupted directories:**
   ```bash
   cd /Users/mohitrathod/Documents/cravora/Projects/Chandra-jewels
   rm -rf "node_modules/eslint 2"
   rm -rf "node_modules/metro 2"
   ```

2. **Install socket.io-client:**
   ```bash
   npm install socket.io-client --save
   ```

3. **Restart Metro bundler with cache reset:**
   ```bash
   npm start -- --reset-cache
   ```

## Current Status

✅ **Chats are now displaying!** (167 chats from enquiries)

⚠️ **WebSocket is disabled** until socket.io-client is installed

The app will work without WebSocket, but:
- Messages won't appear in real-time
- You'll need to refresh to see new messages
- Typing indicators won't work
- Read receipts won't work

Once you install socket.io-client, all real-time features will work automatically.

## Verify Installation

After installing, check if it worked:

```bash
ls node_modules | grep socket.io-client
```

You should see `socket.io-client` in the list.

Then restart your app and check the console - you should see:
```
✅ Connected to chat server
```

Instead of:
```
Error: Cannot find module 'socket.io-client'
```

