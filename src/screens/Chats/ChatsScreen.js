import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useGetChatsQuery, useGetEnquiriesQuery, useGetChatMessagesQuery, api } from '../../store/api';
import { useSelector, useDispatch } from 'react-redux';
import { Card } from '../../components/cards/Cards';
import { SearchInput } from '../../components/common';
// Removed custom Text components to fix crashes
import { AnimatedLogoLoader } from '../../components/common';
import TopNavbar from '../../components/common/TopNavbar';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatDateTime, truncateText } from '../../utils/helpers';
import { getUserName } from '../../utils/userUtils';
import { useUsers } from '../../features/users/usersHooks';
import socketService from '../../services/socketService';

const ChatsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0); // Force re-render when cache updates
  
  // Load users to enable name lookup by ID
  const { users: usersList } = useUsers();
  const usersMap = useSelector(state => state.users?.usersMap || {});

  // Get role ID (preferred) or fallback to role string
  const roleId = user?.roleId || user?.roleNumber;
  const roleString = user?.role?.toLowerCase();
  
  // Determine chat types based on role ID (following the specification)
  // Role ID 1 (Admin/AD) → See both admin-client and admin-designer
  // Role ID 2 (Coral/CO) → See only admin-designer
  // Role ID 3 (CAD/CD) → See only admin-designer
  // Role ID 4 (Client/CL) → See only admin-client
  const getChatTypes = () => {
    // Use role ID if available (preferred method)
    if (roleId !== undefined && roleId !== null) {
      if (roleId === 1) {
        // Admin: see both types
        return { chatType1: 'admin-client', chatType2: 'admin-designer', isAdmin: true };
      } else if (roleId === 4) {
        // Client: see only admin-client
        return { chatType1: 'admin-client', chatType2: null, isAdmin: false };
      } else if (roleId === 2 || roleId === 3) {
        // Worker/Designer (Coral/CAD): see only admin-designer
        return { chatType1: 'admin-designer', chatType2: null, isAdmin: false };
      }
    }
    
    // Fallback to role string (for backward compatibility)
    if (roleString === 'admin') {
      return { chatType1: 'admin-client', chatType2: 'admin-designer', isAdmin: true };
    } else if (roleString === 'client') {
      return { chatType1: 'admin-client', chatType2: null, isAdmin: false };
    } else if (roleString === 'coral' || roleString === 'cad' || roleString === 'worker' || roleString === 'designer') {
      return { chatType1: 'admin-designer', chatType2: null, isAdmin: false };
    }
    
    // Default: assume client
    return { chatType1: 'admin-client', chatType2: null, isAdmin: false };
  };

  const { chatType1, chatType2, isAdmin } = getChatTypes();

  // Log component mount and initial state
  useEffect(() => {
    console.log('🚀 [ChatsScreen] Component mounted/updated', {
      timestamp: new Date().toISOString(),
      userId: user?.id,
      chatType1,
      chatType2,
      isAdmin,
      roleId,
      roleString,
      isConnected: socketService.isConnected(),
    });
  }, []);

  // Fetch first chat type (or only type for non-admins)
  // Hybrid approach: WebSocket for instant updates + shorter polling as safety net
  const { 
    data: chatsFromAPI1 = [], 
    isLoading: chatsLoading1, 
    error: chatsError1, 
    refetch: refetchChats1 
  } = useGetChatsQuery(
    { page: 1, limit: 50, search: searchQuery, type: chatType1 },
    {
      skip: !user,
      refetchOnFocus: true, // Refetch when screen comes into focus
      pollingInterval: 5000, // Poll every 5 seconds as safety net (WebSocket handles instant updates)
    }
  );

  // Fetch second chat type (only for admins)
  const { 
    data: chatsFromAPI2 = [], 
    isLoading: chatsLoading2, 
    error: chatsError2, 
    refetch: refetchChats2 
  } = useGetChatsQuery(
    { page: 1, limit: 50, search: searchQuery, type: chatType2 },
    {
      skip: !user || !isAdmin || !chatType2,
      refetchOnFocus: true, // Refetch when screen comes into focus
      pollingInterval: 5000, // Poll every 5 seconds as safety net (WebSocket handles instant updates)
    }
  );

  // Log when chat data changes
  useEffect(() => {
    console.log('📊 [ChatsScreen] Chat data updated', {
      timestamp: new Date().toISOString(),
      chatsFromAPI1Count: chatsFromAPI1?.length || 0,
      chatsFromAPI2Count: chatsFromAPI2?.length || 0,
      chatsLoading1,
      chatsLoading2,
      chatsError1: !!chatsError1,
      chatsError2: !!chatsError2,
      firstFewChatIds1: chatsFromAPI1?.slice(0, 3).map(c => ({
        id: c.id || c._id,
        enquiryId: c.enquiryId || c.EnquiryId,
        unreadCount: c.unreadCount || c.UnreadCount,
      })) || [],
      firstFewChatIds2: chatsFromAPI2?.slice(0, 3).map(c => ({
        id: c.id || c._id,
        enquiryId: c.enquiryId || c.EnquiryId,
        unreadCount: c.unreadCount || c.UnreadCount,
      })) || [],
    });
  }, [chatsFromAPI1, chatsFromAPI2, chatsLoading1, chatsLoading2, chatsError1, chatsError2]);

  // Helper function to filter chats by role (as per specification)
  const filterChatsByRole = useCallback((chats, userRoleId) => {
    if (!Array.isArray(chats)) return [];
    
    // Role ID 1 (Admin) → return all chats
    if (userRoleId === 1) return chats;
    
    // Role ID 4 (Client) → filter to only admin-client
    if (userRoleId === 4) {
      return chats.filter(chat => {
        const chatType = (chat.type || chat.Type || '').toLowerCase();
        return chatType === 'admin-client';
      });
    }
    
    // Role ID 2 or 3 (Worker/Designer) → filter to only admin-designer
    if (userRoleId === 2 || userRoleId === 3) {
      return chats.filter(chat => {
        const chatType = (chat.type || chat.Type || '').toLowerCase();
        return chatType === 'admin-designer';
      });
    }
    
    // Unknown role → return empty array
    return [];
  }, []);

  // Merge both chat types for admins, and filter by type for non-admins
  // Include forceUpdate in dependencies to trigger re-computation when cache updates
  const chatsFromAPI = useMemo(() => {
    console.log('🔄 [ChatsScreen] Computing chatsFromAPI', {
      timestamp: new Date().toISOString(),
      isAdmin,
      chatType2,
      chatsFromAPI1Count: chatsFromAPI1?.length || 0,
      chatsFromAPI2Count: chatsFromAPI2?.length || 0,
      forceUpdate,
    });

    if (isAdmin && chatType2) {
      // Merge both arrays and remove duplicates by chat ID
      const allChats = [...(chatsFromAPI1 || []), ...(chatsFromAPI2 || [])];
      const uniqueChats = Array.from(
        new Map(allChats.map(chat => [chat.id || chat._id, chat])).values()
      );
      // Apply role-based filtering (for admin, this returns all chats)
      const result = filterChatsByRole(uniqueChats, roleId);
      console.log('✅ [ChatsScreen] Combined chats (admin)', {
        allChatsCount: allChats.length,
        uniqueChatsCount: uniqueChats.length,
        resultCount: result.length,
        firstFewChats: result.slice(0, 3).map(c => ({
          id: c.id || c._id,
          enquiryId: c.enquiryId || c.EnquiryId,
          unreadCount: c.unreadCount || c.UnreadCount,
          lastMessage: (c.lastMessage || c.LastMessage || '').substring(0, 30),
        })),
      });
      return result;
    }
    
    // For non-admins, filter chats by role
    const chats = chatsFromAPI1 || [];
    if (chats.length > 0 && roleId) {
      const filteredChats = filterChatsByRole(chats, roleId);
      console.log('✅ [ChatsScreen] Combined chats (non-admin, role-based)', {
        inputCount: chats.length,
        resultCount: filteredChats.length,
        firstFewChats: filteredChats.slice(0, 3).map(c => ({
          id: c.id || c._id,
          enquiryId: c.enquiryId || c.EnquiryId,
          unreadCount: c.unreadCount || c.UnreadCount,
          lastMessage: (c.lastMessage || c.LastMessage || '').substring(0, 30),
        })),
      });
      return filteredChats;
    }
    
    // If no role ID, fallback to type-based filtering
    if (!isAdmin && chats.length > 0) {
      const filteredChats = chats.filter(chat => {
        if (chat.type || chat.Type) {
          const chatType = (chat.type || chat.Type).toLowerCase();
          return chatType === chatType1.toLowerCase();
        }
        return true; // Assume backend filtered correctly
      });
      console.log('✅ [ChatsScreen] Combined chats (non-admin, type-based)', {
        inputCount: chats.length,
        resultCount: filteredChats.length,
        firstFewChats: filteredChats.slice(0, 3).map(c => ({
          id: c.id || c._id,
          enquiryId: c.enquiryId || c.EnquiryId,
          unreadCount: c.unreadCount || c.UnreadCount,
          lastMessage: (c.lastMessage || c.LastMessage || '').substring(0, 30),
        })),
      });
      return filteredChats;
    }
    
    console.log('✅ [ChatsScreen] Combined chats (fallback)', {
      resultCount: chats.length,
      firstFewChats: chats.slice(0, 3).map(c => ({
        id: c.id || c._id,
        enquiryId: c.enquiryId || c.EnquiryId,
        unreadCount: c.unreadCount || c.UnreadCount,
        lastMessage: (c.lastMessage || c.LastMessage || '').substring(0, 30),
      })),
    });
    return chats;
  }, [chatsFromAPI1, chatsFromAPI2, isAdmin, chatType2, chatType1, roleId, filterChatsByRole, forceUpdate]);

  // Combined loading and error states
  const chatsLoading = chatsLoading1 || (isAdmin && chatsLoading2);
  const chatsError = chatsError1 || chatsError2;
  
  // Combined refetch function
  const refetchChats = useCallback(async () => {
    if (__DEV__) {
      console.log('🔄 [ChatsScreen] Refetching chats...', {
        isAdmin,
        chatType1,
        chatType2,
        timestamp: new Date().toISOString(),
      });
    }
    try {
      const results = await Promise.all([
        refetchChats1(),
        isAdmin && chatType2 ? refetchChats2() : Promise.resolve(),
      ]);
      if (__DEV__) {
        console.log('✅ [ChatsScreen] Chats refetched successfully', {
          result1Count: results[0]?.data?.length || 'N/A',
          result2Count: results[1]?.data?.length || 'N/A',
        });
      }
      return results;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ChatsScreen] Error refetching chats:', error);
      }
      throw error;
    }
  }, [refetchChats1, refetchChats2, isAdmin, chatType2, chatType1]);

  // Refetch chats when screen comes into focus (e.g., when returning from ChatDetailScreen)
  // This ensures unread counts are updated immediately after viewing messages
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      
      let timer1, timer2;
      
      // Delay to allow backend to process mark-as-read and update unread counts
      // The backend needs time to:
      // 1. Receive mark-as-read WebSocket event
      // 2. Update database (mark messages as read)
      // 3. Recalculate unread count for the chat
      // 4. Return updated count in API response
      timer1 = setTimeout(() => {
        if (__DEV__) {
          console.log('🔄 [ChatsScreen] Screen focused - invalidating cache and refetching chats');
        }
        // Invalidate Chat cache to force fresh fetch (bypasses RTK Query cache)
        dispatch(api.util.invalidateTags(['Chat']));
        // Then refetch with a delay to ensure cache invalidation is processed
        timer2 = setTimeout(() => {
          refetchChats().then(() => {
            if (__DEV__) {
              console.log('✅ [ChatsScreen] Chats refetched after focus');
            }
          }).catch((error) => {
            if (__DEV__) {
              console.error('❌ [ChatsScreen] Error refetching chats:', error);
            }
          });
        }, 300);
      }, 1200); // 1.2 second delay to allow backend to fully process mark-as-read
      
      return () => {
        if (timer1) clearTimeout(timer1);
        if (timer2) clearTimeout(timer2);
      };
    }, [refetchChats, user, dispatch])
  );

  // Fetch enquiries to create chats from them if chats API doesn't exist
  const { data: enquiriesResponse, isLoading: enquiriesLoading } = useGetEnquiriesQuery(user?.role, {
    skip: !user,
  });
  
  // Extract enquiries array from response (new API returns { data, pagination })
  const enquiries = enquiriesResponse?.data || [];

  // Check if chats API works, otherwise create chats from enquiries
  const chats = useMemo(() => {
    try {
      // If chats API returned data, use it
      if (chatsFromAPI && Array.isArray(chatsFromAPI) && chatsFromAPI.length > 0) {
        
        return chatsFromAPI;
      }

      // If chats API returned 404 or empty array, create chats from enquiries
      // Also check if there's an error (but not a network error)
      const hasError = chatsError && (
        chatsError.status === 404 || 
        chatsError.originalStatus === 404 ||
        chatsError.status === 'FETCH_ERROR' // Network error
      );

      // IMPORTANT: Only use fallback if API explicitly returns empty AND we're not still loading
      // If API is working but just has no chats, that's fine - show empty list
      // Only fallback if there's an actual error (404) or if we're sure API returned empty after loading completes
      const shouldUseFallback = (
        (!chatsFromAPI || !Array.isArray(chatsFromAPI) || chatsFromAPI.length === 0) && 
        (hasError || (!chatsLoading && chatsFromAPI !== undefined)) && // Only if loading is done and we got a response
        enquiries && Array.isArray(enquiries) && enquiries.length > 0 // Only if we have enquiries to fallback to
      );

      // If API returned empty or error, fall back to enquiries
      if (shouldUseFallback) {
        
        
        // Create chat summaries from enquiries
        // IMPORTANT: Filter by chat type to ensure users only see their allowed chats
        // Note: Last messages will be fetched on-demand when user opens ChatDetailScreen
        if (enquiries && Array.isArray(enquiries) && enquiries.length > 0) {
          // Filter enquiries by chat type based on role ID
          // Role ID 1 (Admin) → include all enquiries
          // Role ID 4 (Client) → only admin-client enquiries
          // Role ID 2/3 (Worker/Designer) → only admin-designer enquiries
          const filteredEnquiries = enquiries.filter(enquiry => {
            if (!enquiry || !(enquiry.id || enquiry._id)) return false;
            
            // If admin (Role ID 1), include all enquiries
            if (roleId === 1 || isAdmin) return true;
            
            // For non-admins, we need to determine which enquiries belong to which chat type
            // Since enquiries don't have a direct "chatType" field, we'll use the enquiry's status/type
            // or check if it's a client enquiry vs designer enquiry
            
            // Role ID 4 (Client) → should only see admin-client enquiries
            // NOTE: Enquiries don't have a chat type field, so we rely on backend filtering
            // The backend should already filter enquiries by user role (clients see only their enquiries)
            // For clients, the enquiries API should only return enquiries where they are the client
            if (roleId === 4) {
              // CRITICAL: Backend should filter by client ownership, but if it doesn't,
              // we need to filter on frontend as a safety measure
              // Check if enquiry's ClientId matches user's clientId (if available)
              const userClientId = user?.clientId || user?.ClientId;
              const enquiryClientId = enquiry?.ClientId || enquiry?.clientId;
              
              // If we have both IDs, filter by matching client ownership
              if (userClientId && enquiryClientId) {
                const matches = String(userClientId).trim() === String(enquiryClientId).trim();
                if (!matches) {
                  if (__DEV__) {
                    console.log(`🔍 Filtering out enquiry ${enquiry.id || enquiry._id}: ClientId mismatch (user: ${userClientId}, enquiry: ${enquiryClientId})`);
                  }
                  return false; // Filter out enquiries that don't belong to this client
                }
                return true; // Include enquiries that belong to this client
              }
              
              // If we don't have clientId, we can't filter properly
              // This is a backend issue - backend should filter by client ownership
              
              
              // For now, include all (backend should filter, but if it doesn't, we show all)
              // This is not ideal, but better than showing nothing
              return true;
            }
            
            // Role ID 2 or 3 (Worker/Designer) → should only see admin-designer enquiries
            // NOTE: Enquiries don't have a chat type field, so we rely on backend filtering
            // The backend should already filter enquiries by user role (designers see only their workflow enquiries)
            if (roleId === 2 || roleId === 3) {
              // Backend should filter, but we can't do much here since enquiries don't have Type field
              // The enquiries API is called with user.role, so backend should handle filtering
              return true; // Trust backend to filter correctly
            }
            
            // Fallback to role string if role ID not available
            if (roleString === 'client') {
              return true; // Backend should filter
            }
            if (roleString === 'coral' || roleString === 'cad' || roleString === 'designer') {
              return true; // Backend should filter
            }
            
            return true; // Default: include all (shouldn't reach here)
          });
          
          
          
          return filteredEnquiries
            .map(enquiry => ({
              id: enquiry.id || enquiry._id,
              enquiryId: enquiry.id || enquiry._id,
              enquiryTitle: enquiry.title || enquiry.Name || 'Untitled Chat',
              clientName: enquiry.clientName || enquiry.client || 'Unknown Client',
              lastMessage: '', // Will be populated when backend adds /api/chats endpoint with last message
              lastMessageTime: enquiry.updatedAt || enquiry.createdAt || new Date().toISOString(),
              unreadCount: 0,
              isGroup: true,
              participants: [],
              lastSender: '',
              status: enquiry.status || 'active',
              isClient: false,
              // Add chat type to help with filtering
              chatType: chatType1, // Mark which type this chat belongs to
            }))
            .sort((a, b) => {
              // Sort by last message time (newest first)
              try {
                return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
              } catch (e) {
                return 0; // If date parsing fails, maintain order
              }
            });
        }
      }

      // Default: empty array
      return [];
    } catch (error) {
      
      // Return empty array on error to prevent crash
      return [];
    }
  }, [chatsFromAPI, chatsError, enquiries, chatsLoading, chatType1, isAdmin, user]);

  const loading = chatsLoading || enquiriesLoading;

  // Debug logs
  useEffect(() => {
    if (__DEV__) {
      try {
        console.log('🔍 USER DEBUG:', {
          userId: user?.id,
          roleId: roleId,
          roleString: user?.role,
          roleNumber: user?.roleNumber,
          isAdmin: isAdmin,
        });
        
        // Detailed API response debug
        if (chatsFromAPI1 && Array.isArray(chatsFromAPI1)) {
          console.log('🔍 CHATS API RESPONSE DEBUG (Type 1):', {
            count: chatsFromAPI1.length,
            chats: chatsFromAPI1.slice(0, 3).map(c => ({
              id: c.id || c._id,
              enquiryId: c.enquiryId || c.EnquiryId,
              type: c.type || c.Type,
              enquiryName: c.enquiryTitle || c.EnquiryName,
            })),
            allTypes: chatsFromAPI1.map(c => c.type || c.Type || 'unknown'),
          });
        } else {
          console.log('Chats from API (Type 1):', chatsFromAPI1 ? 'Not an array' : 'null/undefined');
        }
        
        if (chatsError1) {
          console.log('❌ Chats API Error (Type 1):', {
            status: chatsError1.status,
            originalStatus: chatsError1.originalStatus,
            message: chatsError1.message || chatsError1.data?.message,
          });
        }
        
        if (isAdmin) {
          console.log('Chats from API (Type 2):', Array.isArray(chatsFromAPI2) ? chatsFromAPI2.length : 'Not an array');
          if (chatsError2) {
            console.log('Chats API Error (Type 2):', {
              status: chatsError2.status,
              originalStatus: chatsError2.originalStatus,
              message: chatsError2.message || chatsError2.data?.message,
            });
          }
        }
        
        console.log('Merged Chats from API:', Array.isArray(chatsFromAPI) ? chatsFromAPI.length : 'Not an array');
        
        // Show chat types for debugging
        if (Array.isArray(chatsFromAPI) && chatsFromAPI.length > 0) {
          const chatTypes = chatsFromAPI.map(c => c.type || c.Type || 'unknown').filter(Boolean);
          const uniqueTypes = [...new Set(chatTypes)];
          if (!isAdmin && uniqueTypes.length > 1) {
          }
          if (!isAdmin && uniqueTypes.some(t => t.toLowerCase() !== chatType1.toLowerCase())) {
          }
        }
        
        // Enquiries debug
        if (enquiries && Array.isArray(enquiries)) {
          const userClientId = user?.clientId || user?.ClientId;
          console.log('🔍 ENQUIRIES DEBUG:', {
            count: enquiries.length,
            userClientId: userClientId || 'NOT AVAILABLE',
            sample: enquiries.slice(0, 3).map(e => ({
              id: e.id || e._id,
              enquiryClientId: e.clientId || e.ClientId,
              title: e.title || e.Name,
              matchesUser: userClientId ? (String(e.clientId || e.ClientId || '').trim() === String(userClientId).trim()) : 'unknown',
            })),
            allClientIds: [...new Set(enquiries.map(e => e.clientId || e.ClientId).filter(Boolean))],
          });
          
          // Warn if backend returned all enquiries for a client user
          if (roleId === 4 && enquiries.length > 10) {
            console.warn('⚠️ Backend should filter /api/enquiries by client ownership (ClientId)');
          }
        }
        
        console.log('Final Chats:', Array.isArray(chats) ? chats.length : 'Not an array');
        if (Array.isArray(chats) && chats.length > 0) {
          const finalTypes = [...new Set(chats.map(c => c.type || c.Type || c.chatType || 'unknown').filter(Boolean))];
        }
      } catch (error) {
      }
    }
  }, [chats, loading, chatsError, chatsFromAPI, chatsFromAPI1, chatsFromAPI2, enquiries, user, isAdmin, chatType1, chatType2, roleId, chatsError1, chatsError2]);

  // Apply search filter
  const filteredChats = useMemo(() => {
    try {
      // Ensure chats is an array
      if (!Array.isArray(chats)) {
        return [];
      }

      if (!searchQuery) {
        return chats;
      }

      const query = searchQuery.toLowerCase();
      return chats.filter(chat => {
        if (!chat) return false;
        return (
          chat.enquiryTitle?.toLowerCase().includes(query) ||
          chat.clientName?.toLowerCase().includes(query) ||
          chat.lastMessage?.toLowerCase().includes(query)
        );
      });
    } catch (error) {
      
      return Array.isArray(chats) ? chats : [];
    }
  }, [chats, searchQuery]);

  // WebSocket listener for real-time unread count updates
  // When messages are marked as read, backend sends 'messagesRead' event
  // This updates the chat list immediately without needing to refetch (like old version)
  useEffect(() => {
    if (!user) {
      console.log('⚠️ [ChatsScreen] messagesRead listener skipped - no user');
      return;
    }

    console.log('🔌 [ChatsScreen] Setting up messagesRead WebSocket listener', {
      timestamp: new Date().toISOString(),
      userId: user?.id,
      chatType1,
      chatType2,
      isAdmin,
      searchQuery,
      isConnected: socketService.isConnected(),
    });

    const handleMessagesRead = (data) => {
      console.log('📖 [ChatsScreen] ⚡⚡⚡ messagesRead WebSocket event received ⚡⚡⚡', {
        timestamp: new Date().toISOString(),
        data,
        chatId: data?.chatId,
        userId: data?.userId,
        unreadCount: data?.unreadCount,
        hasChatId: !!data?.chatId,
      });
      
      // Data should contain: { chatId, userId, unreadCount }
      // Update cache directly for instant UI update (like old version)
      if (data?.chatId) {
        const chatId = data.chatId;
        const newUnreadCount = data.unreadCount !== undefined ? Number(data.unreadCount) : 0;
        
        console.log('🔄 [ChatsScreen] Processing messagesRead update', {
          chatId,
          newUnreadCount,
          chatType1,
          chatType2,
        });
        
        // Update both chat type queries optimistically
        // This updates the UI instantly without refetch
        try {
          let foundInType1 = false;
          let foundInType2 = false;

          // Update chatType1 query cache
          console.log('🔍 [ChatsScreen] Searching for chat in type1 cache', { chatId, chatType1 });
          dispatch(
            api.util.updateQueryData('getChats', { page: 1, limit: 50, search: searchQuery, type: chatType1 }, (draft) => {
              if (!Array.isArray(draft)) {
                console.warn('⚠️ [ChatsScreen] Draft is not an array (type1):', typeof draft);
                return;
              }
              
              console.log('🔍 [ChatsScreen] Type1 cache state', {
                draftLength: draft.length,
                searchingForChatId: chatId,
                firstFewChatIds: draft.slice(0, 3).map(c => ({
                  id: c.id,
                  _id: c._id,
                  chatId: c.chatId,
                })),
              });

              const chat = draft.find(c => {
                const cId = c.id || c._id;
                const matches = cId && String(cId).trim() === String(chatId).trim();
                if (matches) {
                  console.log('✅ [ChatsScreen] Found chat in type1 cache', {
                    chatId: cId,
                    currentUnreadCount: c.unreadCount || c.UnreadCount,
                    newUnreadCount,
                  });
                }
                return matches;
              });
              
              if (chat) {
                foundInType1 = true;
                const oldUnreadCount = chat.unreadCount || chat.UnreadCount || 0;
                chat.unreadCount = newUnreadCount;
                chat.UnreadCount = newUnreadCount;
                if (chat._originalData) {
                  chat._originalData.UnreadCount = newUnreadCount;
                  chat._originalData.unreadCount = newUnreadCount;
                }
                console.log('✅ [ChatsScreen] Updated unread count in type1 cache', {
                  chatId,
                  oldUnreadCount,
                  newUnreadCount,
                  chatTitle: chat.enquiryTitle || chat.EnquiryName,
                });
              } else {
                console.warn('⚠️ [ChatsScreen] Chat not found in type1 cache', {
                  chatId,
                  draftLength: draft.length,
                });
              }
            })
          );
          
          // Update chatType2 query cache (if admin)
          if (isAdmin && chatType2) {
            console.log('🔍 [ChatsScreen] Searching for chat in type2 cache', { chatId, chatType2 });
            dispatch(
              api.util.updateQueryData('getChats', { page: 1, limit: 50, search: searchQuery, type: chatType2 }, (draft) => {
                if (!Array.isArray(draft)) {
                  console.warn('⚠️ [ChatsScreen] Draft is not an array (type2):', typeof draft);
                  return;
                }

                const chat = draft.find(c => {
                  const cId = c.id || c._id;
                  const matches = cId && String(cId).trim() === String(chatId).trim();
                  if (matches) {
                    console.log('✅ [ChatsScreen] Found chat in type2 cache', {
                      chatId: cId,
                      currentUnreadCount: c.unreadCount || c.UnreadCount,
                      newUnreadCount,
                    });
                  }
                  return matches;
                });
                
                if (chat) {
                  foundInType2 = true;
                  const oldUnreadCount = chat.unreadCount || chat.UnreadCount || 0;
                  chat.unreadCount = newUnreadCount;
                  chat.UnreadCount = newUnreadCount;
                  if (chat._originalData) {
                    chat._originalData.UnreadCount = newUnreadCount;
                    chat._originalData.unreadCount = newUnreadCount;
                  }
                  console.log('✅ [ChatsScreen] Updated unread count in type2 cache', {
                    chatId,
                    oldUnreadCount,
                    newUnreadCount,
                    chatTitle: chat.enquiryTitle || chat.EnquiryName,
                  });
                } else {
                  console.warn('⚠️ [ChatsScreen] Chat not found in type2 cache', {
                    chatId,
                    draftLength: draft.length,
                  });
                }
              })
            );
          }

          // Force re-render
          setTimeout(() => {
            setForceUpdate(prev => {
              const next = prev + 1;
              console.log('🔄 [ChatsScreen] Force update triggered (messagesRead)', {
                prev,
                next,
                foundInType1,
                foundInType2,
              });
              return next;
            });
          }, 0);

          // Hybrid approach: Cache update provides instant UI, delayed refetch ensures consistency
          if (!foundInType1 && (!isAdmin || !chatType2 || !foundInType2)) {
            console.warn('⚠️ [ChatsScreen] Chat not found in any cache - invalidating and refetching');
            dispatch(api.util.invalidateTags(['Chat']));
            refetchChats();
          } else {
            // Chat found - cache update provides instant UI update
            // But also refetch after delay to ensure backend consistency
            console.log('✅ [ChatsScreen] Chat updated via cache - scheduling delayed refetch for consistency');
            setTimeout(() => {
              console.log('🔄 [ChatsScreen] Delayed refetch for consistency after messagesRead');
              refetchChats().then(() => {
                console.log('✅ [ChatsScreen] Chats refetched for consistency (messagesRead)');
              }).catch((error) => {
                console.error('❌ [ChatsScreen] Error in delayed refetch (messagesRead):', error);
              });
            }, 800); // 800ms delay - allows cache update to show first, then syncs with backend
          }
        } catch (error) {
          console.error('❌ [ChatsScreen] Error updating cache for messagesRead:', error);
          // Fallback: invalidate and refetch if cache update fails
          dispatch(api.util.invalidateTags(['Chat']));
          refetchChats();
        }
      } else {
        console.warn('⚠️ [ChatsScreen] messagesRead event missing chatId', { data });
      }
    };

    // Subscribe to messagesRead event
    const unsubscribeMessagesRead = socketService.on('messagesRead', handleMessagesRead);
    console.log('✅ [ChatsScreen] Subscribed to messagesRead WebSocket event');

    return () => {
      // Cleanup: unsubscribe when component unmounts
      if (unsubscribeMessagesRead) {
        unsubscribeMessagesRead();
        console.log('🔌 [ChatsScreen] Unsubscribed from messagesRead event');
      }
    };
  }, [user, dispatch, chatType1, chatType2, isAdmin, searchQuery, refetchChats]);

  // WebSocket listener for real-time chat list updates when new messages arrive
  // When sender sends message, receiver's chat list should update instantly:
  // - Move chat to top (most recent first)
  // - Update unread count badge
  // - Update last message preview
  // - Update timestamp
  useEffect(() => {
    if (!user) return;

    const handleNewMessage = (message) => {
      // ALWAYS log this - critical for debugging real-time updates
      console.log('📨 [ChatsScreen] ⚡⚡⚡ newMessage WebSocket event received ⚡⚡⚡', {
        timestamp: new Date().toISOString(),
        hasMessage: !!message,
        messageKeys: message ? Object.keys(message) : [],
        chatId: message?.ChatId || message?.chatId,
        enquiryId: message?.EnquiryId || message?.enquiryId,
        senderId: message?.SenderId || message?.senderId,
        messageText: message?.Message || message?.message || '',
      });

      // Get chat ID from message - try multiple fields
      const messageChatId = message.ChatId || message.chatId || message.Chat?._id || message.Chat?.id;
      const messageEnquiryId = message.EnquiryId || message.enquiryId || message.Enquiry?.id || message.Enquiry?._id;
      
      console.log('🔍 [ChatsScreen] Extracted IDs from message:', {
        messageChatId,
        messageEnquiryId,
        messageKeys: Object.keys(message),
        fullMessage: JSON.stringify(message, null, 2).substring(0, 500),
      });

      if (!messageChatId && !messageEnquiryId) {
        console.error('❌ [ChatsScreen] newMessage missing both chatId and enquiryId:', {
          message,
          messageKeys: Object.keys(message),
        });
        return;
      }

      // Check if message is from current user (we don't increment unread count for our own messages)
      const senderId = message.SenderId || message.senderId;
      const isMyMessage = user && senderId && String(senderId).trim() === String(user.id).trim();

      // Get message text and timestamp
      const messageText = message.Message || message.message || message.Text || message.text || '';
      const messageTimestamp = message.Timestamp || message.timestamp || message.CreatedAt || message.createdAt || new Date().toISOString();

      console.log('📝 [ChatsScreen] Processing newMessage:', {
        messageChatId,
        messageEnquiryId,
        messageText: messageText.substring(0, 50),
        messageTimestamp,
        isMyMessage,
        senderId,
        userId: user?.id,
        senderMatchesUser: senderId && user?.id ? String(senderId).trim() === String(user.id).trim() : false,
      });

      // Update cache directly for instant UI update (WebSocket-driven, no refetch needed)
      try {
        let chatFoundInCache = false;
        let foundInType1 = false;
        let foundInType2 = false;

        console.log('🔄 [ChatsScreen] Starting cache update for newMessage', {
          messageChatId,
          messageEnquiryId,
          chatType1,
          chatType2,
          isAdmin,
        });

        const updateChatCache = (queryParams, typeLabel) => {
          console.log(`🔍 [ChatsScreen] Updating cache for ${typeLabel}`, queryParams);
          
          const updateDraft = (draft) => {
              if (!Array.isArray(draft)) {
                console.warn(`⚠️ [ChatsScreen] Draft is not an array (${typeLabel}):`, typeof draft);
                return false;
              }

              console.log(`🔍 [ChatsScreen] Searching in ${typeLabel} cache`, {
                draftLength: draft.length,
                searchingForChatId: messageChatId,
                searchingForEnquiryId: messageEnquiryId,
                firstFewChats: draft.slice(0, 3).map(c => ({
                  id: c.id,
                  _id: c._id,
                  chatId: c.chatId,
                  ChatId: c.ChatId,
                  enquiryId: c.enquiryId,
                  EnquiryId: c.EnquiryId,
                  title: c.enquiryTitle || c.EnquiryName,
                })),
              });

              // Try to find chat by chatId first, then by enquiryId
              const chatIndex = draft.findIndex(c => {
                const chatId = c.id || c._id || c.chatId || c.ChatId;
                const enquiryId = c.enquiryId || c.EnquiryId;
                
                // Match by chatId
                if (messageChatId && chatId) {
                  const matches = String(chatId).trim() === String(messageChatId).trim();
                  if (matches) {
                    console.log(`✅ [ChatsScreen] Found chat by chatId in ${typeLabel}`, {
                      chatId,
                      messageChatId,
                      chatTitle: c.enquiryTitle || c.EnquiryName,
                    });
                    return true;
                  }
                }
                
                // Match by enquiryId (fallback)
                if (messageEnquiryId && enquiryId) {
                  const matches = String(enquiryId).trim() === String(messageEnquiryId).trim();
                  if (matches) {
                    console.log(`✅ [ChatsScreen] Found chat by enquiryId in ${typeLabel}`, {
                      enquiryId,
                      messageEnquiryId,
                      chatTitle: c.enquiryTitle || c.EnquiryName,
                    });
                    return true;
                  }
                }
                
                return false;
              });

              if (chatIndex !== -1) {
                const chat = draft[chatIndex];
                const oldUnreadCount = Number(chat.unreadCount || chat.UnreadCount || 0);
                const oldLastMessage = chat.lastMessage || chat.LastMessage;
                
                console.log(`📝 [ChatsScreen] Updating chat in ${typeLabel} cache`, {
                  chatId: chat.id || chat._id,
                  enquiryId: chat.enquiryId || chat.EnquiryId,
                  oldUnreadCount,
                  oldLastMessage: oldLastMessage?.substring(0, 30),
                  newMessageText: messageText.substring(0, 30),
                  isMyMessage,
                });
                
                // Update last message
                chat.lastMessage = messageText;
                chat.LastMessage = messageText;
                
                // Update last message time (this will move chat to top when sorted)
                chat.lastMessageTime = messageTimestamp;
                chat.LastMessageTime = messageTimestamp;
                
                // Update last sender info
                chat.lastMessageSenderId = senderId;
                chat.lastSenderId = senderId;
                
                // Update unread count (only if message is not from current user)
                if (!isMyMessage) {
                  const newUnreadCount = oldUnreadCount + 1;
                  chat.unreadCount = newUnreadCount;
                  chat.UnreadCount = newUnreadCount;
                  if (chat._originalData) {
                    chat._originalData.UnreadCount = newUnreadCount;
                    chat._originalData.unreadCount = newUnreadCount;
                  }
                  console.log(`📊 [ChatsScreen] Unread count updated in ${typeLabel}`, {
                    oldUnreadCount,
                    newUnreadCount,
                  });
                } else {
                  console.log(`ℹ️ [ChatsScreen] Message from current user - not incrementing unread count in ${typeLabel}`);
                }
                
                // Update _originalData if it exists
                if (chat._originalData) {
                  if (chat._originalData.LastMessage) {
                    chat._originalData.LastMessage.Message = messageText;
                    chat._originalData.LastMessage.Timestamp = messageTimestamp;
                    chat._originalData.LastMessage.SenderId = senderId;
                  } else {
                    chat._originalData.LastMessage = {
                      Message: messageText,
                      Timestamp: messageTimestamp,
                      SenderId: senderId,
                    };
                  }
                  chat._originalData.LastMessageTime = messageTimestamp;
                }

                // Move chat to top of array (most recent first)
                draft.splice(chatIndex, 1);
                draft.unshift(chat);

                // Sort entire array by lastMessageTime to ensure correct order
                // Most recent messages first (descending order)
                draft.sort((a, b) => {
                  try {
                    const timeA = new Date(a.lastMessageTime || a.LastMessageTime || 0);
                    const timeB = new Date(b.lastMessageTime || b.LastMessageTime || 0);
                    return timeB - timeA; // Descending: newest first
                  } catch (e) {
                    return 0;
                  }
                });

                console.log(`✅ [ChatsScreen] Chat updated in ${typeLabel} cache via WebSocket`, {
                  chatId: messageChatId,
                  enquiryId: messageEnquiryId,
                  unreadCount: chat.unreadCount,
                  movedToTop: true,
                  sorted: true,
                  chatTitle: chat.enquiryTitle || chat.EnquiryName,
                });
                
                return true; // Chat found and updated
              } else {
                console.warn(`⚠️ [ChatsScreen] Chat not found in ${typeLabel} cache`, {
                  messageChatId,
                  messageEnquiryId,
                  draftLength: draft.length,
                });
                return false; // Chat not found
              }
          };
          
          const result = dispatch(
            api.util.updateQueryData('getChats', queryParams, updateDraft)
          );
          
          // Force re-render by updating state AFTER cache update completes
          setTimeout(() => {
            setForceUpdate(prev => {
              const next = prev + 1;
              console.log(`🔄 [ChatsScreen] Force update triggered (${typeLabel})`, {
                prev,
                next,
              });
              return next;
            });
          }, 0);
          
          return result;
        };

        // Update both chat type queries
        console.log('🔄 [ChatsScreen] Updating type1 cache', { chatType1 });
        const result1 = updateChatCache({ page: 1, limit: 50, search: searchQuery, type: chatType1 }, 'type1');
        foundInType1 = !!result1;
        
        if (isAdmin && chatType2) {
          console.log('🔄 [ChatsScreen] Updating type2 cache', { chatType2 });
          const result2 = updateChatCache({ page: 1, limit: 50, search: searchQuery, type: chatType2 }, 'type2');
          foundInType2 = !!result2;
          chatFoundInCache = foundInType1 || foundInType2;
        } else {
          chatFoundInCache = foundInType1;
        }

        console.log('📊 [ChatsScreen] Cache update summary', {
          chatFoundInCache,
          foundInType1,
          foundInType2,
          messageChatId,
          messageEnquiryId,
        });

        // Hybrid approach: Update cache instantly, then refetch after delay for consistency
        // This ensures UI updates immediately AND stays in sync with backend
        if (!chatFoundInCache) {
          console.log('🔄 [ChatsScreen] Chat not in cache - refetching to get new chat', {
            messageChatId,
            messageEnquiryId,
          });
          // Chat not found - might be a new chat, refetch to get it
          setTimeout(() => {
            refetchChats().then(() => {
              console.log('✅ [ChatsScreen] Chats refetched - new chat added');
            }).catch((error) => {
              console.error('❌ [ChatsScreen] Error refetching after new message:', error);
            });
          }, 300); // Small delay to allow backend to process
        } else {
          console.log('✅ [ChatsScreen] Chat updated via WebSocket cache - scheduling delayed refetch for consistency', {
            foundInType1,
            foundInType2,
          });
          // Chat found in cache - cache update provides instant UI update
          // But also refetch after a delay to ensure backend consistency
          // This handles cases where WebSocket event arrives before backend fully processes
          setTimeout(() => {
            console.log('🔄 [ChatsScreen] Delayed refetch for consistency after cache update');
            refetchChats().then(() => {
              console.log('✅ [ChatsScreen] Chats refetched for consistency');
            }).catch((error) => {
              console.error('❌ [ChatsScreen] Error in delayed refetch:', error);
            });
          }, 1000); // 1 second delay - allows cache update to show first, then syncs with backend
        }
      } catch (error) {
        console.error('❌ [ChatsScreen] Error updating cache for newMessage:', error);
        // Fallback: invalidate and refetch if cache update fails
        dispatch(api.util.invalidateTags(['Chat']));
        refetchChats();
      }
    };

    // Ensure WebSocket is connected before subscribing
    if (!socketService.isConnected()) {
      console.warn('⚠️ [ChatsScreen] ⚡⚡⚡ WebSocket NOT connected, attempting to connect...');
      if (user?.id) {
        socketService.connect(user.id).then(() => {
          console.log('✅ [ChatsScreen] ⚡⚡⚡ WebSocket connected successfully');
        }).catch(err => {
          console.error('❌ [ChatsScreen] Failed to connect WebSocket:', err);
        });
      }
    } else {
      console.log('✅ [ChatsScreen] ⚡⚡⚡ WebSocket already connected');
    }

    // Subscribe to newMessage event immediately
    // Even if socket isn't connected yet, the listener will be active once it connects
    const unsubscribeNewMessage = socketService.on('newMessage', handleNewMessage);

    // ALWAYS log subscription - critical for debugging real-time updates
    console.log('✅ [ChatsScreen] ⚡⚡⚡ Subscribed to newMessage WebSocket event ⚡⚡⚡', {
      timestamp: new Date().toISOString(),
      isConnected: socketService.isConnected(),
      userId: user?.id,
      socketUrl: socketService.getSocket()?.io?.uri || 'unknown',
    });

    // Monitor WebSocket connection status periodically
    // This helps debug if WebSocket disconnects
    const connectionMonitor = setInterval(() => {
      const isConnected = socketService.isConnected();
      if (!isConnected) {
        console.warn('⚠️ [ChatsScreen] WebSocket disconnected - will rely on polling');
        // Try to reconnect
        if (user?.id) {
          socketService.connect(user.id).catch(() => {
            // Silent fail - polling will handle updates
          });
        }
      }
    }, 10000); // Check every 10 seconds

    return () => {
      // Cleanup: unsubscribe when component unmounts
      if (unsubscribeNewMessage) {
        unsubscribeNewMessage();
        console.log('🔌 [ChatsScreen] Unsubscribed from newMessage event');
      }
      // Clear connection monitor
      if (connectionMonitor) {
        clearInterval(connectionMonitor);
      }
    };
  }, [user, dispatch, chatType1, chatType2, isAdmin, searchQuery, refetchChats]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Invalidate cache before refreshing
    dispatch(api.util.invalidateTags(['Chat']));
    await refetchChats();
    setRefreshing(false);
  };

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }

  // Safety check for navigation
  if (!navigation) {
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textPrimary }}>Navigation not available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderChatItem = (chat) => {
    if (!chat || !chat.id) {
      return null; // Skip invalid chat items
    }

    // Get unread count - check multiple sources
    const getUnreadCount = () => {
      let count = 0;
      let source = 'none';
      
      if (chat.unreadCount !== undefined && chat.unreadCount !== null) {
        count = Number(chat.unreadCount) || 0;
        source = 'chat.unreadCount';
      } else if (chat.UnreadCount !== undefined && chat.UnreadCount !== null) {
        count = Number(chat.UnreadCount) || 0;
        source = 'chat.UnreadCount';
      } else if (chat._originalData?.UnreadCount !== undefined && chat._originalData?.UnreadCount !== null) {
        count = Number(chat._originalData.UnreadCount) || 0;
        source = '_originalData.UnreadCount';
      } else if (chat._originalData?.unreadCount !== undefined && chat._originalData?.unreadCount !== null) {
        count = Number(chat._originalData.unreadCount) || 0;
        source = '_originalData.unreadCount';
      }
      
      // Debug logging to help diagnose missing unread counts
      if (__DEV__) {
        if (count > 0) {
          console.log('[ChatsScreen] ✅ Unread count found:', {
            chatId: chat.id,
            enquiryTitle: chat.enquiryTitle,
            unreadCount: count,
            source,
          });
        } else {
          // Log first few chats with 0 unread to see what's available
          const chatIndex = filteredChats.findIndex(c => c?.id === chat.id);
          if (chatIndex < 3) {
            console.log('[ChatsScreen] ⚠️ Unread count is 0:', {
              chatId: chat.id,
              enquiryTitle: chat.enquiryTitle,
              source,
              'chat.unreadCount': chat.unreadCount,
              'chat.UnreadCount': chat.UnreadCount,
              '_originalData.UnreadCount': chat._originalData?.UnreadCount,
              '_originalData.unreadCount': chat._originalData?.unreadCount,
              '_originalData keys': chat._originalData ? Object.keys(chat._originalData).slice(0, 10) : 'no _originalData',
            });
          }
        }
      }
      
      return count;
    };
    
    const unreadCount = getUnreadCount();

    const senderLabel = (() => {
      // Get last sender ID from multiple possible fields
      // Priority: Use normalized fields first (most reliable), then fall back to _originalData
      const lastSenderId = chat.lastMessageSenderId ||  // ✅ From API normalization (LastMessage.SenderId)
                          chat.lastSenderId || 
                          chat.LastSenderId || 
                          chat._originalData?.LastMessage?.SenderId ||  // ✅ Direct from backend response
                          chat._originalData?.LastMessage?.senderId ||
                          chat._originalData?.LastSenderId || 
                          chat._originalData?.lastSenderId ||
                          (chat._originalData?.LastMessage?.Sender && typeof chat._originalData.LastMessage.Sender === 'object'
                            ? (chat._originalData.LastMessage.Sender._id || chat._originalData.LastMessage.Sender.Id || chat._originalData.LastMessage.Sender.id)
                            : null) ||
                          (chat._originalData?.LastSender && typeof chat._originalData.LastSender === 'object' 
                            ? (chat._originalData.LastSender.Id || chat._originalData.LastSender._id || chat._originalData.LastSender.id || chat._originalData.LastSender.SenderId || chat._originalData.LastSender.senderId)
                            : null);

              const chatType = chat.type || chat.Type || chat._originalData?.Type || chat._originalData?.type || '';

      console.log('chatloggggggggg', chat);
      
      // Debug: Log LastMessage data to see what backend sent
      if (__DEV__ && chat._originalData?.LastMessage) {
        console.log('[ChatList] 📋 LastMessage data:', {
          chatId: chat.id,
          Sender: chat._originalData.LastMessage.Sender,
          SenderId: chat._originalData.LastMessage.SenderId,
          senderId: chat._originalData.LastMessage.senderId,
          lastMessageSenderName: chat.lastMessageSenderName,
          lastMessageSenderId: chat.lastMessageSenderId,
          lastSenderId: lastSenderId,
          userId: user?.id,
        });
      }
      
      // Check if last sender is the current user
      if (lastSenderId && user?.id && String(lastSenderId).trim() === String(user.id).trim()) {
        return 'You';
      }
      
      // Try to get sender name from multiple sources
      // Priority 1: Use normalized fields from API (already extracted from LastMessage.Sender)
      // Check for truthy values (not empty strings)
      let senderName = (chat.lastMessageSenderName && chat.lastMessageSenderName.trim()) || 
                      (chat.lastSender && chat.lastSender.trim()) || 
                      (chat.lastSenderName && chat.lastSenderName.trim()) ||
                      '';
      
      // Debug: Log what we have at the start
      if (__DEV__ && lastSenderId && String(lastSenderId) !== String(user?.id)) {
        console.log('[ChatList] 🔍 Sender name lookup START:', {
          chatId: chat.id,
          enquiryTitle: chat.enquiryTitle,
          lastSenderId,
          userId: user?.id,
          'chat.lastMessageSenderName': chat.lastMessageSenderName,
          'chat.lastSender': chat.lastSender,
          'chat.lastSenderName': chat.lastSenderName,
          'currentSenderName (after priority 1)': senderName,
        });
      }
      
      // CRITICAL: If we have SenderId but no name, try to look it up immediately
      // This handles the case where backend sends SenderId but Sender is null
      if (!senderName && lastSenderId && String(lastSenderId) !== String(user?.id)) {
        const lookedUpName = getUserName(lastSenderId);
        if (lookedUpName && lookedUpName !== '-' && lookedUpName !== lastSenderId && !lookedUpName.startsWith('User ')) {
          senderName = lookedUpName;
          if (__DEV__) {
            console.log('[ChatList] ✅ Found name via getUserName (early lookup):', { senderId: lastSenderId, name: senderName });
          }
        }
      }
      
      // Priority 2: Try to get directly from LastMessage.Sender (backend sends this as string or object)
      if (!senderName && chat._originalData?.LastMessage) {
        if (typeof chat._originalData.LastMessage === 'object') {
          // Backend sends LastMessage.Sender as string (the name) or as object { _id: ..., name: ... }
          if (chat._originalData.LastMessage.Sender) {
            if (typeof chat._originalData.LastMessage.Sender === 'string' && chat._originalData.LastMessage.Sender.trim()) {
              // Sender is a string (the name)
              senderName = chat._originalData.LastMessage.Sender.trim();
            } else if (typeof chat._originalData.LastMessage.Sender === 'object') {
              // Sender is an object
              senderName = (chat._originalData.LastMessage.Sender.name || 
                           chat._originalData.LastMessage.Sender.Name || '').trim();
            }
          }
          // Also check SenderName field (backend might send this separately)
          if (!senderName) {
            senderName = (chat._originalData.LastMessage.SenderName || 
                         chat._originalData.LastMessage.senderName || '').trim();
          }
        }
      }
      
      // Priority 3: Try LastSender object
      if (!senderName && chat._originalData?.LastSender) {
        if (typeof chat._originalData.LastSender === 'object') {
          senderName = chat._originalData.LastSender.Name ||
                      chat._originalData.LastSender.name ||
                      chat._originalData.LastSender.SenderName ||
                      chat._originalData.LastSender.senderName;
        } else if (typeof chat._originalData.LastSender === 'string') {
          senderName = chat._originalData.LastSender;
        }
      }
      
      // If still no name and we have lastSenderId, try to find in participants
      if (!senderName && lastSenderId && Array.isArray(chat.participants || chat.Participants)) {
        const participants = chat.participants || chat.Participants || [];
        const found = participants.find(p => {
          const pid = p._id || p.id || p.Id;
          return pid && String(pid).trim() === String(lastSenderId).trim();
        });
        if (found) {
          senderName = found.Name || found.name || '';
        }
      }
      
      // Try to look up user name from Redux store by ID (CRITICAL FALLBACK)
      // This is needed when backend doesn't send Sender name for messages from others
      if (!senderName && lastSenderId && String(lastSenderId) !== String(user?.id)) {
        // First try getUserName utility (uses Redux usersMap)
        const lookedUpName = getUserName(lastSenderId);
        if (lookedUpName && lookedUpName !== '-' && lookedUpName !== lastSenderId && !lookedUpName.startsWith('User ')) {
          senderName = lookedUpName;
          if (__DEV__) {
            console.log('[ChatList] ✅ Found name via getUserName:', { senderId: lastSenderId, name: senderName });
          }
        } else if (Array.isArray(usersList) && usersList.length > 0) {
          // Fallback: search users array directly
          const idStr = String(lastSenderId).trim();
          const foundUser = usersList.find(u => {
            const uid = String(u.id || u._id || u.Id || '').trim();
            const cleanId = idStr.replace(/\s/g, '');
            const cleanUid = uid.replace(/\s/g, '');
            return uid === idStr || cleanUid === cleanId || 
                   uid.toLowerCase() === idStr.toLowerCase() ||
                   cleanUid.toLowerCase() === cleanId.toLowerCase();
          });
          if (foundUser) {
            senderName = (foundUser.name || foundUser.Name || foundUser.email || foundUser.Email || '').trim();
            if (__DEV__ && senderName) {
              console.log('[ChatList] ✅ Found name from users array:', {
                senderId: lastSenderId,
                foundName: senderName,
                foundUserId: foundUser.id || foundUser._id,
              });
            }
          }
        }
        
        // If still no name, log warning
        if (__DEV__ && !senderName) {
          console.warn('[ChatList] ⚠️ Cannot find name for sender:', {
            senderId: lastSenderId,
            usersListLength: usersList?.length || 0,
            usersMapSize: Object.keys(usersMap).length,
          });
        }
      }
      
      // Last resort: use clientName if available (for client chats)
      if (!senderName && chat.clientName) {
        senderName = chat.clientName;
      }
      
      // Debug logging - show final result
      if (__DEV__ && lastSenderId && String(lastSenderId) !== String(user?.id)) {
        if (!senderName) {
          const lookedUpName = getUserName(lastSenderId);
          console.log('[ChatList] ❌ FINAL: No sender name found:', {
            chatId: chat.id,
            enquiryTitle: chat.enquiryTitle,
            lastSenderId,
            'chat.lastMessageSenderName': chat.lastMessageSenderName,
            'chat.lastSender': chat.lastSender,
            'chat.lastSenderName': chat.lastSenderName,
            'finalSenderName': senderName,
            lookedUpName,
            usersListLength: usersList?.length || 0,
            usersMapSize: Object.keys(usersMap).length,
          });
        } else {
          console.log('[ChatList] ✅ FINAL: Sender name found:', {
            chatId: chat.id,
            senderId: lastSenderId,
            senderName,
            source: 'will display',
          });
        }
      }
      
      return senderName || 'Someone';
    })();

    try {
      return (
        <TouchableOpacity
          key={chat.id}
          style={styles.chatItem}
          onPress={() => {
            
            if (navigation && navigation.navigate) {
              navigation.navigate('ChatDetail', {
                chatId: chat._id || chat.id, // Pass the specific chat ID
                chat: chat, // Pass the full chat object
                enquiryId: chat.enquiryId || chat.EnquiryId,
                chatType: chat.type || chat.Type
              });
            }
          }}>
          
          <View style={styles.chatAvatar}>
            <Icon name="account" size={20} color={colors.textWhite} />
          </View>

          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>
                {chat.enquiryTitle || 'Untitled Chat'} - <Text style={{ fontSize: fonts.sm, fontFamily: fonts.regular }}>{(chat.Type || chat.type).split('-')[1]}</Text>
              </Text>
              <Text style={styles.chatTime}>
                {chat.lastMessageTime ? formatDateTime(chat.lastMessageTime) : ''}
              </Text>
            </View>

            <View style={styles.chatFooter}>
              <Text style={styles.chatMessage}>
                {chat.lastMessage && typeof chat.lastMessage === 'string'
                  ? `${senderLabel}: ${truncateText(chat.lastMessage, 50)}`
                  : 'No messages yet'}
              </Text>
              {/* Unread count badge on the right */}
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    } catch (error) {
      
      return null; // Return null on error to prevent crash
    }
  };

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNavbar navigation={navigation} />
      <View style={styles.header}>
        <SearchInput
          placeholder="Search chats..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {filteredChats.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="chat" size={40} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
              {searchQuery ? 'No chats found' : 'No chats available'}
            </Text>
            <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
              {searchQuery ? 'Try adjusting your search' : 'Start a conversation from an enquiry'}
            </Text>
          </Card>
        ) : (
          <View style={styles.chatsList}>
            {filteredChats
              .filter(chat => chat && chat.id) // Filter out invalid chats
              .map(renderChatItem)
              .filter(item => item !== null) // Remove null items
            }
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scrollView: {
    flex: 1,
  },
  chatsList: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 16, // standardized header size
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  chatTime: {
    color: colors.textLight,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chatMessage: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: colors.textWhite,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  emptyCard: {
    margin: 16,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
  },
});

export default ChatsScreen;
