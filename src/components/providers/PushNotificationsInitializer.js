import { useEffect } from 'react';
import notifee from '@notifee/react-native';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { navigationRef } from '../../navigation/navigationRef';

const PushNotificationsInitializer = () => {
  usePushNotifications();

  // Handle background notification taps
  useEffect(() => {
    const unsubscribe = notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === 1) { // PRESS event
        const link = detail.notification?.data?.link || detail.notification?.data?.Link;
        if (navigationRef.isReady()) {
          if (link) {
            const normalizedLink = link.replace(/^\//, '');
            if (normalizedLink.startsWith('notifications')) {
              navigationRef.navigate('Notifications');
            } else if (normalizedLink.startsWith('enquiries/')) {
              const enquiryId = normalizedLink.split('/')[1];
              navigationRef.navigate('SingleEnquiry', { enquiryId });
              } else if (normalizedLink.startsWith('chats/')) {
                // Handle chat notification: chats/{chatId}
                const parts = normalizedLink.split('/');
                const chatId = parts[1];
                const enquiryId = detail.notification?.data?.enquiryId || detail.notification?.data?.EnquiryId;
                const chatType = detail.notification?.data?.chatType || detail.notification?.data?.ChatType;
                
                if (chatId) {
                  navigationRef.navigate('ChatDetail', {
                    chatId: chatId,
                    enquiryId: enquiryId,
                    chatType: chatType,
                  });
                } else {
                  navigationRef.navigate('Notifications');
                }
            } else {
              navigationRef.navigate('Notifications');
            }
          } else {
            navigationRef.navigate('Notifications');
          }
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  return null;
};

export default PushNotificationsInitializer;

