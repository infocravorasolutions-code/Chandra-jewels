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
      unsubscribe();
    };
  }, []);

  return null;
};

export default PushNotificationsInitializer;

