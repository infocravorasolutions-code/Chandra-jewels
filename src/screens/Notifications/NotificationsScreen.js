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
import { Card } from '../../components/cards/Cards';
import { AnimatedLogoLoader } from '../../components/common';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatDateTime } from '../../utils/helpers';

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      // Mock notifications data - replace with actual API call
      const mockNotifications = [
        {
          id: '1',
          type: 'enquiry',
          title: 'New Enquiry Received',
          message: 'John Smith has submitted a new enquiry for Diamond Ring',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          isRead: false,
        },
        {
          id: '2',
          type: 'approval',
          title: 'Design Approved',
          message: 'Your design for Gold Necklace has been approved by the client',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
          isRead: false,
        },
        {
          id: '3',
          type: 'payment',
          title: 'Payment Received',
          message: 'Payment of ₹25,000 has been received for Order #1234',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          isRead: true,
        },
        {
          id: '4',
          type: 'chat',
          title: 'New Message',
          message: 'Sarah Johnson sent you a message about her enquiry',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          isRead: true,
        },
        {
          id: '5',
          type: 'system',
          title: 'System Update',
          message: 'New features have been added to the app. Check them out!',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          isRead: true,
        },
      ];
      
      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  };

  const getNotificationIcon = (type) => {
    const icons = {
      enquiry: 'assignment',
      approval: 'check-circle',
      payment: 'attach-money',
      chat: 'chat',
      system: 'info',
    };
    return icons[type] || 'notifications';
  };

  const renderNotificationItem = (notification) => (
    <TouchableOpacity
      key={notification.id}
      style={[
        styles.notificationItem,
        !notification.isRead && styles.unreadNotification,
      ]}
      onPress={() => markAsRead(notification.id)}>
      
      <View style={styles.notificationIcon}>
        <Icon 
          name={getNotificationIcon(notification.type)} 
          size={20} 
          color={colors.primary} 
        />
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={styles.notificationTitle}>
            {notification.title}
          </Text>
          <Text style={styles.notificationDate}>
            {formatDateTime(notification.timestamp)}
          </Text>
        </View>
        <Text
          numberOfLines={3}
          ellipsizeMode="tail"
          style={styles.notificationMessage}>
          {notification.message}
        </Text>
      </View>

      {!notification.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="back" size={24} color={colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Notifications
        </Text>
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={markAllAsRead}>
          <Text style={styles.markAllText} numberOfLines={1}>
            Mark All Read
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {notifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="notification" size={40} color={colors.textLight} />
            <Text style={styles.emptyText}>
              No notifications yet
            </Text>
            <Text style={styles.emptySubtext}>
              You'll see notifications here when you receive them
            </Text>
          </Card>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map(renderNotificationItem)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryDark,
    minHeight: 56,
  },
  backButton: {
    padding: 8,
    minWidth: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    color: colors.textWhite,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
  },
  markAllButton: {
    padding: 8,
    minWidth: 80,
    alignItems: 'flex-end',
  },
  markAllText: {
    textAlign: 'right',
    color: colors.textWhite,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
  },
  scrollView: {
    flex: 1,
  },
  notificationsList: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: colors.textWhite,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'flex-start',
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0, // Prevents overflow
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notificationTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    lineHeight: fonts.base * 1.4,
    minWidth: 0, // Prevents overflow
  },
  notificationDate: {
    color: colors.textLight,
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    flexShrink: 0,
    marginTop: 2,
  },
  notificationMessage: {
    color: colors.textSecondary,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    lineHeight: fonts.sm * 1.4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 8,
    marginLeft: 8,
    flexShrink: 0,
  },
  emptyCard: {
    margin: 16,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
    color: colors.textSecondary,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
  },
  emptySubtext: {
    color: colors.textLight,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
});

export default NotificationsScreen;
