import React, { useState, useEffect } from 'react';
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
import { api } from '../../services/api';
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
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    applySearchFilter();
  }, [chats, searchQuery]);

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }

  const loadChats = async () => {
    try {
      setLoading(true);
      // Enhanced dummy data for group chats
      const dummyChats = [
        {
          id: '1',
          enquiryTitle: 'Custom Diamond Ring Design',
          clientName: 'John Smith',
          lastMessage: 'Perfect! I love the vintage elements you added.',
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
          unreadCount: 3,
          isGroup: true,
          participants: [
            { id: 'client1', name: 'John Smith', role: 'client' },
            { id: 'admin1', name: 'Sarah Johnson', role: 'admin' },
            { id: 'designer1', name: 'Mike Designer', role: 'coral' },
          ],
          lastSender: 'John Smith',
          status: 'active',
        },
        {
          id: '2',
          enquiryTitle: 'Emerald Necklace Collection',
          clientName: 'Sarah Johnson',
          lastMessage: 'The CAD design is ready for review.',
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          unreadCount: 1,
          isGroup: true,
          participants: [
            { id: 'client2', name: 'Sarah Johnson', role: 'client' },
            { id: 'admin1', name: 'Sarah Johnson', role: 'admin' },
            { id: 'designer2', name: 'Lisa CAD', role: 'cad' },
          ],
          lastSender: 'Lisa CAD',
          status: 'active',
        },
        {
          id: '3',
          enquiryTitle: 'Gold Bracelet Set',
          clientName: 'Michael Brown',
          lastMessage: 'Thank you for the beautiful design!',
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          unreadCount: 0,
          isGroup: true,
          participants: [
            { id: 'client3', name: 'Michael Brown', role: 'client' },
            { id: 'admin1', name: 'Sarah Johnson', role: 'admin' },
            { id: 'designer1', name: 'Mike Designer', role: 'coral' },
          ],
          lastSender: 'Michael Brown',
          status: 'completed',
        },
        {
          id: '4',
          enquiryTitle: 'Sapphire Earrings',
          clientName: 'Emily Davis',
          lastMessage: 'I need some changes to the design.',
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
          unreadCount: 2,
          isGroup: true,
          participants: [
            { id: 'client4', name: 'Emily Davis', role: 'client' },
            { id: 'admin1', name: 'Sarah Johnson', role: 'admin' },
            { id: 'designer1', name: 'Mike Designer', role: 'coral' },
          ],
          lastSender: 'Emily Davis',
          status: 'active',
        },
        {
          id: '5',
          enquiryTitle: 'Pearl Necklace',
          clientName: 'Robert Wilson',
          lastMessage: 'The design is approved. Moving to production.',
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
          unreadCount: 0,
          isGroup: true,
          participants: [
            { id: 'client5', name: 'Robert Wilson', role: 'client' },
            { id: 'admin1', name: 'Sarah Johnson', role: 'admin' },
            { id: 'designer2', name: 'Lisa CAD', role: 'cad' },
          ],
          lastSender: 'Sarah Johnson',
          status: 'approved',
        },
      ];
      setChats(dummyChats);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  };

  const applySearchFilter = () => {
    if (!searchQuery) {
      setFilteredChats(chats);
      return;
    }

    const filtered = chats.filter(chat =>
      chat.enquiryTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredChats(filtered);
  };

  const renderChatItem = (chat) => (
    <TouchableOpacity
      key={chat.id}
      style={styles.chatItem}
      onPress={() => {
        console.log('Navigating to ChatDetail with chat:', chat);
        navigation.navigate('ChatDetail', { chat });
      }}>
      
      <View style={styles.chatAvatar}>
        <Icon name="account" size={20} color={colors.textWhite} />
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={[styles.chatTitle, { color: colors.textPrimary, fontSize: fonts.base, fontFamily: fonts.bold }]}>
            {chat.enquiryTitle}
          </Text>
          <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
            {formatDateTime(chat.lastMessageTime)}
          </Text>
        </View>

        <View style={styles.chatFooter}>
          <Text style={[styles.chatMessage, { color: colors.textSecondary, fontSize: fonts.sm }]}>
            {chat.isClient ? chat.clientName : 'You'}: {truncateText(chat.lastMessage, 50)}
          </Text>
          {chat.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
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
    fontWeight: fonts.medium,
    flex: 1,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatMessage: {
    flex: 1,
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
