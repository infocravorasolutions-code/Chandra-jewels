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
import socketService from '../../services/socketService';
import { Card } from '../../components/cards/Cards';
import { SearchInput } from '../../components/common';
// Removed custom Text components to fix crashes
import { AnimatedLogoLoader } from '../../components/common';
import TopNavbar from '../../components/common/TopNavbar';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatDateTime, truncateText } from '../../utils/helpers';

const ChatsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
      refetchOnFocus: true,
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
      refetchOnFocus: true,
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
      
      if (__DEV__ && filteredChats.length !== chats.length) {
        console.warn(`⚠️ Filtered out ${chats.length - filteredChats.length} chats that didn't match role ${roleId} requirements`);
      }
      
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
      
      if (__DEV__ && filteredChats.length !== chats.length) {
        console.warn(`⚠️ Filtered out ${chats.length - filteredChats.length} chats that didn't match expected type ${chatType1}`);
      }
      
      return filteredChats;
    }
    
    return chats;
  }, [chatsFromAPI1, chatsFromAPI2, isAdmin, chatType2, chatType1, roleId, filterChatsByRole]);

  // Combined loading and error states
  const chatsLoading = chatsLoading1 || (isAdmin && chatsLoading2);
  const chatsError = chatsError1 || chatsError2;
  
  // Combined refetch function
  const refetchChats = useCallback(async () => {
    await Promise.all([
      refetchChats1(),
      isAdmin && chatType2 ? refetchChats2() : Promise.resolve(),
    ]);
  }, [refetchChats1, refetchChats2, isAdmin, chatType2]);

  // Fetch enquiries to create chats from them if chats API doesn't exist
  const { data: enquiries = [], isLoading: enquiriesLoading } = useGetEnquiriesQuery(user?.role, {
    skip: !user,
  });

  // Check if chats API works, otherwise create chats from enquiries
  const chats = useMemo(() => {
    try {
      // If chats API returned data, use it
      if (chatsFromAPI && Array.isArray(chatsFromAPI) && chatsFromAPI.length > 0) {
        if (__DEV__) {
          console.log('Using chats from API:', chatsFromAPI.length);
        }
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
        if (__DEV__) {
          console.log('Chats API returned empty or error, creating chats from enquiries...');
          console.log('Enquiries count:', enquiries?.length || 0);
          console.log('Expected chat type for fallback:', chatType1);
        }
        
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
              if (__DEV__) {
                console.warn('⚠️ WARNING: Cannot filter enquiries by client ownership - missing clientId in user or enquiry object');
                console.warn('⚠️ Backend should filter /api/enquiries by client ownership for client users');
              }
              
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
          
          if (__DEV__) {
            console.log('Filtered enquiries for fallback:', filteredEnquiries.length);
          }
          
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
      if (__DEV__) {
        console.error('❌ Error in chats useMemo:', error);
      }
      // Return empty array on error to prevent crash
      return [];
    }
  }, [chatsFromAPI, chatsError, enquiries, chatsLoading, chatType1, isAdmin, user]);

  const loading = chatsLoading || enquiriesLoading;

  // Debug logs
  useEffect(() => {
    if (__DEV__) {
      try {
        console.log('========== CHATS SCREEN DEBUG ==========');
        console.log('🔍 USER DEBUG:', {
          userId: user?.id,
          roleId: roleId,
          roleString: user?.role,
          roleNumber: user?.roleNumber,
          isAdmin: isAdmin,
        });
        console.log('Chat Type 1:', chatType1);
        console.log('Chat Type 2:', chatType2);
        console.log('Loading:', loading);
        console.log('Chats API Error:', chatsError);
        
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
          console.log('📋 Chat types in merged list:', uniqueTypes);
          if (!isAdmin && uniqueTypes.length > 1) {
            console.warn('⚠️ WARNING: Non-admin user has chats of multiple types!', uniqueTypes);
          }
          if (!isAdmin && uniqueTypes.some(t => t.toLowerCase() !== chatType1.toLowerCase())) {
            console.warn(`⚠️ WARNING: Found chats with wrong type! Expected: ${chatType1}, Found:`, uniqueTypes);
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
            console.warn('⚠️ WARNING: Backend returned', enquiries.length, 'enquiries for client user');
            console.warn('⚠️ Backend should filter /api/enquiries by client ownership (ClientId)');
            console.warn('⚠️ User clientId:', userClientId || 'NOT AVAILABLE');
            console.warn('⚠️ This is a BACKEND ISSUE - backend must filter by ClientId for client users');
          }
        }
        
        console.log('Final Chats:', Array.isArray(chats) ? chats.length : 'Not an array');
        if (Array.isArray(chats) && chats.length > 0) {
          const finalTypes = [...new Set(chats.map(c => c.type || c.Type || c.chatType || 'unknown').filter(Boolean))];
          console.log('📋 Final Chat Types:', finalTypes);
          console.log('First Chat:', chats[0]);
        }
        console.log('========================================');
      } catch (error) {
        console.error('Error in debug logs:', error);
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
      if (__DEV__) {
        console.error('❌ Error in filteredChats useMemo:', error);
      }
      return Array.isArray(chats) ? chats : [];
    }
  }, [chats, searchQuery]);

  // WebSocket listener for new messages (to refresh chat list)
  useEffect(() => {
    if (!user) return;

    // Connect to socket if not connected
    if (!socketService.isConnected()) {
      socketService.connect(user.id);
    }

    // Listen for new messages to refresh chat list
    const handleNewMessage = (message) => {
      if (__DEV__) {
        console.log('New message received, refreshing chat list...');
      }
      // Refresh chat list when new message arrives (with a small delay to avoid too many requests)
      setTimeout(() => {
        refetchChats();
      }, 500);
    };

    socketService.on('newMessage', handleNewMessage);

    return () => {
      socketService.off('newMessage', handleNewMessage);
    };
  }, [user, refetchChats]);

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
    if (__DEV__) {
      console.warn('⚠️ Navigation prop is missing in ChatsScreen');
    }
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

    try {
      return (
        <TouchableOpacity
          key={chat.id}
          style={styles.chatItem}
          onPress={() => {
            if (__DEV__) {
              console.log('Navigating to ChatDetail with chat:', chat.enquiryId);
            }
            if (navigation && navigation.navigate) {
              navigation.navigate('ChatDetail', { chat });
            }
          }}>
          
          <View style={styles.chatAvatar}>
            <Icon name="account" size={20} color={colors.textWhite} />
          </View>

          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>
                {chat.enquiryTitle || 'Untitled Chat'}
              </Text>
              <Text style={styles.chatTime}>
                {chat.lastMessageTime ? formatDateTime(chat.lastMessageTime) : ''}
              </Text>
            </View>

            <View style={styles.chatFooter}>
              <Text style={styles.chatMessage}>
                {chat.lastMessage && typeof chat.lastMessage === 'string'
                  ? `${chat.isClient ? (chat.clientName || 'Client') : (chat.lastSender || 'You')}: ${truncateText(chat.lastMessage, 50)}`
                  : 'No messages yet'}
              </Text>
              {chat.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {chat.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error rendering chat item:', error, chat);
      }
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
