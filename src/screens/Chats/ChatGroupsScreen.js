import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useGetChatsByEnquiryQuery } from '../../store/api';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatChatDate, formatDateTime, truncateText } from '../../utils/helpers';

const ChatGroupsScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { enquiry, enquiryId } = route.params || {};
  const [refreshing, setRefreshing] = useState(false);
  const [focusedChat, setFocusedChat] = useState(null); 
  // Get enquiry ID from route params
  const currentEnquiryId = enquiryId || enquiry?.id || enquiry?._id;
  console.log('currentEnquiryId', enquiry, enquiryId);
  // Fetch all chats for this enquiry (both admin-client and admin-designer)
  const { 
    data: chats = [], 
    isLoading, 
    error, 
    refetch 
  } = useGetChatsByEnquiryQuery(
    { enquiryId: currentEnquiryId },
    {
      skip: !currentEnquiryId,
      refetchOnFocus: true,
    }
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleChatPress = (chat) => {
    // Get the actual chat ID from multiple possible sources and normalize to string
    const chatId = String(chat._id || chat.id || chat._originalData?._id || '').trim();
    const chatType = chat?.Type || chat?.type || chat?._originalData?.Type;
    
    console.log('Navigating to chat:', { chatId, chatType, chat });
    
    navigation.navigate('ChatDetail', {
      chatId: chatId, // Pass the specific chat ID
      chat: chat, // Pass the full chat object
      enquiry: enquiry,
      enquiryId: currentEnquiryId,
      chatType: chatType
    });
  };
  

  const renderChatGroup = (chat) => {
    if (!chat) return null;
  
    // Normalize chat object (support both original + wrapped)
    const chatDataOriginal = chat?._originalData || chat;
  
    // -------------------------------
    // Fix: Chat ID extraction
    // -------------------------------
    const chatId = String(
      chatDataOriginal?._id ||
      chatDataOriginal?.id ||
      chat?._originalData?._id ||
      ''
    ).trim();
  
    // -------------------------------
    // Fix: Enquiry Name (your dataset uses EnquiryName)
    // -------------------------------
    const enquiryName =
      chatDataOriginal?.EnquiryName ||
      chatDataOriginal?.enquiryTitle ||
      chat?.enquiryTitle ||
      chat?._originalData?.EnquiryName ||
      'Untitled Chat';
  
    // -------------------------------
    // Fix: Chat Type
    // -------------------------------
    const chatType =
      chatDataOriginal?.Type ||
      chat?.type ||
      chat?._originalData?.Type ||
      '';
  
    // -------------------------------
    // Build chat title
    // -------------------------------
    const chatTitle = `${enquiryName} - ${
      chatType === 'admin-client' ? 'Client' : 'Designer'
    }`;
  
    // -------------------------------
    // Fix: Last Message
    // -------------------------------
    let lastMessage = 'No messages yet';
  
    if (chat?.LastMessage) {
      const senderId =
        chat.LastMessage?.SenderId?._id ||
        chat.LastMessage?.SenderId ||
        chat.LastMessage?.senderId;
  
      const messageText =
        chat.LastMessage?.Message ||
        chat.LastMessage?.message ||
        chat.LastMessage?.text ||
        '';
  
      const senderName =
        chat.LastMessage?.SenderId?.name ||
        chat.LastMessage?.senderName ||
        '';
  
      lastMessage =
        String(senderId).trim() === String(user?.id).trim()
          ? `You: ${messageText}`
          : senderName
          ? `${senderName}: ${messageText}`
          : messageText;
    } else if (chat?.lastMessage) {
      lastMessage = chat.lastMessage; // fallback for string messages
    }
  
    // -------------------------------
    // Fix: Last Message Time
    // -------------------------------
    const lastMessageTime =
      chat?.LastMessage?.updatedAt
        ? formatChatDate(chat.LastMessage.updatedAt)
        : chat?.LastMessage?.Timestamp
        ? formatChatDate(chat.LastMessage.Timestamp)
        : chat?.lastMessageTime
        ? formatChatDate(chat.lastMessageTime)
        : '';
  
    // -------------------------------
    // Unread count + group flag
    // -------------------------------
    const unreadCount = chat.unreadCount || chat.UnreadCount || 0;
    const isGroup = chat.isGroup || chat.IsGroup || false;
  
    // -------------------------------
    // Focused Chat Handling
    // -------------------------------
    const normalizedFocusedChat = focusedChat ? String(focusedChat).trim() : null;
    const isFocused = normalizedFocusedChat === chatId;
  
    // -------------------------------
    // Render component
    // -------------------------------
    return (
      <TouchableOpacity
        style={[styles.chatItem, isFocused && styles.chatItemFocused]}
        onPress={() => handleChatPress(chat)}
        activeOpacity={0.7}
        onPressIn={() => setFocusedChat(chatId)}
        onPressOut={() => setFocusedChat(null)}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Icon name="group" size={24} color={colors.textWhite} />
          </View>
        </View>
  
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {chatTitle}
            </Text>
            {lastMessageTime ? (
              <Text style={styles.chatTime}>{lastMessageTime}</Text>
            ) : null}
          </View>
  
          <View style={styles.chatFooter}>
            <Text style={styles.chatMessage} numberOfLines={1}>
              {lastMessage}
            </Text>
  
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  

  if (isLoading && chats.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <AnimatedLogoLoader size={80} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>Failed to load chat groups</Text>
          <Text style={styles.errorSubtext}>
            {error?.data?.message || error?.message || 'Please try again'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat Groups</Text>
        <View style={styles.headerRight} />
      </View> */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {chats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="chat-bubble-outline" size={64} color={colors.textLight} />
            <Text style={styles.emptyText}>No chat groups found</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation to see chat groups here
            </Text>
          </View>
        ) : (
          <>
            {chats.map((chat, index) => {
              // Ensure each chat has a unique key - normalize to string
              const chatId = String(chat.id || chat._id || chat._originalData?._id || `chat-${index}`).trim();
              return (
                <View key={chatId}>
                  {renderChatGroup(chat)}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    textAlign: 'center',
    marginLeft: -40, // Compensate for back button width
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    flex: 1,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  chatTime: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginLeft: 8,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatMessage: {
    flex: 1,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    fontSize: fonts.xs,
    fontFamily: fonts.bold,
    color: colors.textWhite,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textWhite,
  },
  chatItemFocused: {
    backgroundColor: '#b7c2c2',
  },
});

export default ChatGroupsScreen;

