import { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { useDispatch } from 'react-redux';
import { useRegisterPushTokenMutation, api } from '../store/api';
import { useAuth } from '../context/AuthContext';
import {
  requestPushPermission,
  registerForRemoteMessages,
  getStoredPushToken,
  savePushTokenLocally,
  getDeviceMetadata,
} from '../services/pushNotificationService';
import { navigationRef } from '../navigation/navigationRef';

const invalidateNotificationTags = (dispatch) => {
  dispatch(
    api.util.invalidateTags([
      { type: 'Notification', id: 'LIST' },
      { type: 'Notification', id: 'UNREAD_COUNT' },
    ])
  );
};

export const usePushNotifications = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useAuth();
  const [registerPushToken] = useRegisterPushTokenMutation();

  const syncTokenWithBackend = useCallback(
    async (incomingToken) => {
      try {
        const registered = await registerForRemoteMessages();
        if (!registered) {
          return;
        }

        const token = incomingToken || (await messaging().getToken());
        if (!token) {
          return;
        }

        const storedToken = await getStoredPushToken();
        if (token !== storedToken) {
          await savePushTokenLocally(token);
        }


        await registerPushToken({
          token,
          device: getDeviceMetadata(),
        }).unwrap();

      } catch (error) {
      }
    },
    [registerPushToken]
  );

  const navigateFromNotification = useCallback((remoteMessage) => {
    const link = remoteMessage?.data?.link || remoteMessage?.data?.Link;
    if (!navigationRef.isReady()) {
      return;
    }

    if (!link) {
      navigationRef.navigate('Notifications');
      return;
    }

    const normalizedLink = link.replace(/^\//, '');
    if (normalizedLink.startsWith('notifications')) {
      navigationRef.navigate('Notifications');
    } else if (normalizedLink.startsWith('enquiries/')) {
      const enquiryId = normalizedLink.split('/')[1];
      navigationRef.navigate('SingleEnquiry', { enquiryId });
    } else {
      navigationRef.navigate('Notifications');
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let unsubscribeOnMessage;
    let unsubscribeOnTokenRefresh;
    let unsubscribeOnOpenedApp;

    const initialize = async () => {
      const permissionGranted = await requestPushPermission();
      if (!permissionGranted) {
        return;
      }

      await syncTokenWithBackend();

      unsubscribeOnTokenRefresh = messaging().onTokenRefresh(syncTokenWithBackend);

      unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
        invalidateNotificationTags(dispatch);
        const title =
          remoteMessage?.notification?.title ||
          remoteMessage?.data?.Title ||
          'New Notification';
        const body =
          remoteMessage?.notification?.body ||
          remoteMessage?.data?.Body ||
          remoteMessage?.data?.message ||
          '';
        if (title || body) {
          Alert.alert(title, body);
        }
      });

      unsubscribeOnOpenedApp = messaging().onNotificationOpenedApp((remoteMessage) => {
        invalidateNotificationTags(dispatch);
        navigateFromNotification(remoteMessage);
      });

      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        navigateFromNotification(initialNotification);
      }
    };

    initialize();

    return () => {
      unsubscribeOnMessage?.();
      unsubscribeOnTokenRefresh?.();
      unsubscribeOnOpenedApp?.();
    };
  }, [dispatch, isAuthenticated, navigateFromNotification, syncTokenWithBackend]);
};

