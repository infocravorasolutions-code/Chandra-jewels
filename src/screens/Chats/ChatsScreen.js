import React, { useState, useMemo, useEffect } from 'react';
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

  // Try to fetch chats - if 404, we'll create from enquiries
  const { data: chatsFromAPI = [], isLoading: chatsLoading, error: chatsError } = useGetChatsQuery(undefined, {
    skip: !user,
    refetchOnFocus: true,
  });

  // Fetch enquiries to create chats from them if chats API doesn't exist
  const { data: enquiries = [], isLoading: enquiriesLoading } = useGetEnquiriesQuery(user?.role, {
    skip: !user,
  });

  // Check if chats API works, otherwise create chats from enquiries
  const chats = useMemo(() => {
    // If chats API returned data, use it
    if (chatsFromAPI && chatsFromAPI.length > 0) {
      if (__DEV__) {
        console.log('Using chats from API:', chatsFromAPI.length);
      }
      return chatsFromAPI;
    }

    // If chats API returned 404, create chats from enquiries
    if (chatsError?.status === 404 || chatsError?.originalStatus === 404) {
      if (__DEV__) {
        console.log('Chats API not found (404), creating chats from enquiries...');
      }
      
      // Create chat summaries from enquiries
      // Note: Last messages will be fetched on-demand when user opens ChatDetailScreen
      return enquiries.map(enquiry => ({
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
      })).sort((a, b) => {
        // Sort by last message time (newest first)
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      });
    }

    // Default: empty array
    return [];
  }, [chatsFromAPI, chatsError, enquiries]);

  const loading = chatsLoading || enquiriesLoading;

  // Debug logs
  useEffect(() => {
    if (__DEV__) {
      console.log('========== CHATS SCREEN DEBUG ==========');
      console.log('Loading:', loading);
      console.log('Chats API Error:', chatsError);
      console.log('Chats from API:', chatsFromAPI.length);
      console.log('Enquiries:', enquiries.length);
      console.log('Final Chats:', chats.length);
      console.log('First Chat:', chats[0]);
      console.log('========================================');
    }
  }, [chats, loading, chatsError, chatsFromAPI, enquiries]);

  // Apply search filter
  const filteredChats = useMemo(() => {
    if (!searchQuery) {
      return chats;
    }

    const query = searchQuery.toLowerCase();
    return chats.filter(chat =>
      chat.enquiryTitle?.toLowerCase().includes(query) ||
      chat.clientName?.toLowerCase().includes(query) ||
      chat.lastMessage?.toLowerCase().includes(query)
    );
  }, [chats, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Note: RTK Query will auto-refetch on focus, this is just manual trigger
    setRefreshing(false);
  };

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }

  const renderChatItem = (chat) => (
    <TouchableOpacity
      key={chat.id}
      style={styles.chatItem}
      onPress={() => {
        if (__DEV__) {
          console.log('Navigating to ChatDetail with chat:', chat.enquiryId);
        }
        navigation.navigate('ChatDetail', { chat });
      }}>
      
      <View style={styles.chatAvatar}>
        <Icon name="account" size={20} color={colors.textWhite} />
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>
            {chat.enquiryTitle}
          </Text>
          <Text style={styles.chatTime}>
            {formatDateTime(chat.lastMessageTime)}
          </Text>
        </View>

        <View style={styles.chatFooter}>
          <Text style={styles.chatMessage}>
            {chat.lastMessage 
              ? `${chat.isClient ? chat.clientName : 'You'}: ${truncateText(chat.lastMessage, 50)}`
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
            {filteredChats.map(renderChatItem)}
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
