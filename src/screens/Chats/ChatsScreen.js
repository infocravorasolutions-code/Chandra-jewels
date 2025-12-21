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
import { useAuth } from '../../context/AuthContext';
import { useGetChatsQuery, useGetEnquiriesQuery, useGetChatMessagesQuery } from '../../store/api';
import { useSelector } from 'react-redux';
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

const ChatsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
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

  // Fetch first chat type (or only type for non-admins)
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
    }
  );

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
  const chatsFromAPI = useMemo(() => {
    if (isAdmin && chatType2) {
      // Merge both arrays and remove duplicates by chat ID
      const allChats = [...(chatsFromAPI1 || []), ...(chatsFromAPI2 || [])];
      const uniqueChats = Array.from(
        new Map(allChats.map(chat => [chat.id || chat._id, chat])).values()
      );
      // Apply role-based filtering (for admin, this returns all chats)
      return filterChatsByRole(uniqueChats, roleId);
    }
    
    // For non-admins, filter chats by role
    const chats = chatsFromAPI1 || [];
    if (chats.length > 0 && roleId) {
      const filteredChats = filterChatsByRole(chats, roleId);
      
      
      
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
      
      
      
      return filteredChats;
    }
    
    return chats;
  }, [chatsFromAPI1, chatsFromAPI2, isAdmin, chatType2, chatType1, roleId, filterChatsByRole]);

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

  // Removed WebSocket listener - chat list will update via pull-to-refresh or when screen comes into focus
  // Real-time updates are handled in ChatDetailScreen for individual chats

  const onRefresh = async () => {
    setRefreshing(true);
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
      if (chat.unreadCount !== undefined && chat.unreadCount !== null) {
        return Number(chat.unreadCount) || 0;
      }
      if (chat.UnreadCount !== undefined && chat.UnreadCount !== null) {
        return Number(chat.UnreadCount) || 0;
      }
      if (chat._originalData?.UnreadCount !== undefined && chat._originalData?.UnreadCount !== null) {
        return Number(chat._originalData.UnreadCount) || 0;
      }
      if (chat._originalData?.unreadCount !== undefined && chat._originalData?.unreadCount !== null) {
        return Number(chat._originalData.unreadCount) || 0;
      }
      return 0;
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
              {/* Unread count badge on the left */}
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              )}
              <Text style={styles.chatMessage}>
                {chat.lastMessage && typeof chat.lastMessage === 'string'
                  ? `${senderLabel}: ${truncateText(chat.lastMessage, 50)}`
                  : 'No messages yet'}
              </Text>
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
    justifyContent: 'flex-start',
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
    marginRight: 4,
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
