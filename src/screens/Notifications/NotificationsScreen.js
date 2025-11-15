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

// Helper function to format relative time
const formatRelativeTime = (date) => {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // For older dates, show formatted date
  return formatDateTime(date);
};

// Get notification type color
const getNotificationTypeColor = (type) => {
  const typeColors = {
    enquiry: colors.info,
    approval: colors.success,
    payment: colors.accent,
    chat: colors.primary,
    system: colors.textSecondary,
  };
  return typeColors[type] || colors.primary;
};

// Helper to add opacity to hex color
const addOpacityToHex = (hex, opacity) => {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Return rgba string
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

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

  const renderNotificationItem = (notification) => {
    const iconBgColor = addOpacityToHex(colors.primary, 0.15);
    const unreadBgColor = addOpacityToHex(colors.primary, 0.05);
    
    return (
      <TouchableOpacity
        key={notification.id}
        style={[
          styles.notificationItem,
          !notification.isRead && [styles.unreadNotification, { backgroundColor: unreadBgColor }],
        ]}
        activeOpacity={0.7}
        onPress={() => markAsRead(notification.id)}>
        
        <View style={[styles.notificationIconContainer, { backgroundColor: iconBgColor }]}>
          <View style={[styles.notificationIcon, { backgroundColor: colors.primary }]}>
            <Icon 
              name={getNotificationIcon(notification.type)} 
              size={16} 
              color={colors.textWhite} 
            />
          </View>
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.titleContainer}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.notificationTitle,
                  !notification.isRead && styles.unreadTitle,
                ]}>
                {notification.title}
              </Text>
              {!notification.isRead && <View style={styles.unreadBadge} />}
            </View>
            <Text 
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.notificationDate}>
              {formatRelativeTime(notification.timestamp)}
            </Text>
          </View>
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={styles.notificationMessage}>
            {notification.message}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Icon name="back" size={22} color={colors.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllAsRead}
            activeOpacity={0.7}>
            <Text style={styles.markAllText} numberOfLines={1}>
              Mark All
            </Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={styles.markAllButton} />}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Icon name="notification" size={64} color={colors.textLight} />
            </View>
            <Text style={styles.emptyText}>
              No Notifications
            </Text>
            <Text style={styles.emptySubtext}>
              You're all caught up!{'\n'}New notifications will appear here.
            </Text>
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    padding: 6,
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    color: colors.textWhite,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  unreadCountBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCountText: {
    color: colors.textWhite,
    fontSize: 11,
    fontFamily: fonts.bold,
    fontWeight: '700',
  },
  markAllButton: {
    padding: 6,
    minWidth: 70,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  markAllText: {
    textAlign: 'right',
    color: colors.textWhite,
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
  },
  scrollView: {
    flex: 1,
  },
  notificationsList: {
    padding: 16,
    paddingTop: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: colors.textWhite,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    minWidth: 0,
  },
  notificationTitle: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    lineHeight: fonts.xs * fonts.lineHeight.normal,
    minWidth: 0,
  },
  unreadTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 6,
    flexShrink: 0,
  },
  notificationDate: {
    color: colors.textLight,
    fontSize: 10,
    fontFamily: fonts.regular,
    flexShrink: 0,
    marginTop: 1,
  },
  notificationMessage: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.regular,
    lineHeight: 11 * fonts.lineHeight.relaxed,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    marginBottom: 8,
    color: colors.textPrimary,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  emptySubtext: {
    color: colors.textLight,
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: fonts.xs * fonts.lineHeight.relaxed,
  },
});

export default NotificationsScreen;
