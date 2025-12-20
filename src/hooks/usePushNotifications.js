import { useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import messaging, { AuthorizationStatus } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
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
import { isFirstLaunch, markFirstLaunchComplete } from '../utils/firstLaunch';

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
          if (__DEV__) {
            console.warn('[PushNotification] Failed to register device for remote messages');
          }
          return;
        }

        let token = incomingToken;
        if (!token) {
          try {
            token = await messaging().getToken();
          } catch (tokenError) {
            const isServiceUnavailable = tokenError?.message?.includes('SERVICE_NOT_AVAILABLE') || 
                                        tokenError?.code === 'messaging/unknown';
            
            if (isServiceUnavailable) {
              if (__DEV__) {
                console.warn('[PushNotification] Google Play Services not available. Check:', {
                  error: tokenError?.message,
                  hint: '1) Google Play Services installed/updated, 2) Network connection, 3) Device has GMS',
                });
              }
              const storedToken = await getStoredPushToken();
              if (storedToken) {
                token = storedToken;
              } else {
                if (__DEV__) {
                  console.error('[PushNotification] No stored token available');
                }
                return;
              }
            } else {
              if (__DEV__) {
                console.error('[PushNotification] Failed to get FCM token:', tokenError?.message);
              }
              return;
            }
          }
        }
        
        if (!token) {
          if (__DEV__) {
            console.error('[PushNotification] Failed to get FCM token');
          }
          return;
        }

        const storedToken = await getStoredPushToken();
        if (token !== storedToken) {
          await savePushTokenLocally(token);
        }

        const deviceMetadata = getDeviceMetadata();
        
        try {
          await registerPushToken({
            token,
            device: deviceMetadata,
          }).unwrap();
        } catch (apiError) {
          const isNetworkError = 
            apiError?.status === 'FETCH_ERROR' ||
            apiError?.error?.includes('Network') ||
            apiError?.error?.includes('Failed to fetch') ||
            apiError?.error?.includes('ECONNREFUSED') ||
            apiError?.error?.includes('timeout');
          
          const isBackendError = apiError?.status && apiError?.status >= 400;
          
          if (__DEV__) {
            console.error('[PushNotification] Backend API error details:', {
              status: apiError?.status,
              error: apiError?.error,
              data: apiError?.data,
              originalStatus: apiError?.originalStatus,
              message: apiError?.message || apiError?.error,
              fullError: JSON.stringify(apiError, null, 2),
            });
            
            if (isNetworkError) {
              console.warn('[PushNotification] Network error - backend unreachable:', {
                hint: 'Check: 1) Backend server is running, 2) Network connection, 3) API URL is correct',
                apiUrl: 'Check apiConfig.js',
              });
            } else if (isBackendError) {
              console.warn('[PushNotification] Backend returned error:', {
                status: apiError?.status,
                message: apiError?.data?.message || apiError?.error,
                hint: 'Backend rejected the token registration. Check backend logs.',
              });
            } else {
              console.error('[PushNotification] Unknown error syncing token:', apiError);
            }
          }
        }
      } catch (error) {
        const isServiceUnavailable = error?.message?.includes('SERVICE_NOT_AVAILABLE') || 
                                     error?.code === 'messaging/unknown';
        
        if (__DEV__) {
          if (isServiceUnavailable) {
            console.warn('[PushNotification] Google Play Services not available or network issue:', {
              message: error?.message,
              code: error?.code,
              hint: 'This might be temporary. Check: 1) Google Play Services is installed/updated, 2) Network connection, 3) Device has GMS (not Chinese ROM)',
            });
          } else {
            console.error('[PushNotification] Error in syncTokenWithBackend:', {
              message: error?.message,
              code: error?.code,
              data: error?.data,
              stack: error?.stack,
              fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
            });
          }
        }
      }
    },
    [registerPushToken]
  );

  const createNotificationChannel = useCallback(async () => {
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
    }
  }, []);

  const displayNotification = useCallback(async (title, body, data = {}) => {
    try {
      if (Platform.OS === 'android') {
        await createNotificationChannel();
      }

      await notifee.displayNotification({
        title: title || 'New Notification',
        body: body || '',
        data: data,
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          sound: 'default',
          smallIcon: 'ic_launcher',
          largeIcon: 'ic_launcher',
          color: '#FF6B35',
        },
        ios: {
          sound: 'default',
          badge: true,
        },
      });
    } catch (error) {
      if (__DEV__) {
        console.error('Error displaying notification:', error);
      }
    }
  }, [createNotificationChannel]);

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
    } else if (normalizedLink.startsWith('chats/')) {
      // Handle chat notification: chats/{chatId}
      const parts = normalizedLink.split('/');
      const chatId = parts[1];
      const enquiryId = remoteMessage?.data?.enquiryId || remoteMessage?.data?.EnquiryId;
      const chatType = remoteMessage?.data?.chatType || remoteMessage?.data?.ChatType;
      
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
  }, []);


  // Request permission on first launch with alert
  useEffect(() => {
    const requestPermissionOnFirstLaunch = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const firstLaunch = await isFirstLaunch();
        
        try {
          await messaging().hasPermission();
        } catch (firebaseError) {
          if (__DEV__) {
            console.error('[PushNotification] Firebase messaging not ready:', firebaseError);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const currentStatus = await messaging().hasPermission();
        const isPermissionGranted = currentStatus === AuthorizationStatus.AUTHORIZED || 
                                   currentStatus === AuthorizationStatus.PROVISIONAL;
        
        if (firstLaunch) {
          if (isPermissionGranted) {
            await markFirstLaunchComplete();
          } else {
            // Directly request system notification permission (no custom alert)
            const permissionGranted = await requestPushPermission();
            
            // Mark first launch as complete regardless of result
            await markFirstLaunchComplete();
            
            if (__DEV__ && !permissionGranted) {
              console.warn('[PushNotification] Permission not granted on first launch');
            }
          }
        } else {
          const isNotDetermined = currentStatus === AuthorizationStatus.NOT_DETERMINED;
          
          if (isNotDetermined) {
            await requestPushPermission();
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[PushNotification] ERROR in requestPermissionOnFirstLaunch:', {
            message: error?.message,
            code: error?.code,
            name: error?.name,
            stack: error?.stack,
          });
        }
        try {
          await markFirstLaunchComplete();
        } catch (markError) {
          if (__DEV__) {
            console.error('[PushNotification] Error marking first launch complete:', markError);
          }
        }
      }
    };

    const timeoutId = setTimeout(() => {
      requestPermissionOnFirstLaunch();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []); // No dependencies - run only once on mount

  // Initialize notification handlers and sync token (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let unsubscribeOnMessage;
    let unsubscribeOnTokenRefresh;
    let unsubscribeOnOpenedApp;
    let unsubscribeNotifee;

    const initialize = async () => {
      try {
        const currentStatus = await messaging().hasPermission();
        const isGranted = currentStatus === AuthorizationStatus.AUTHORIZED || 
                         currentStatus === AuthorizationStatus.PROVISIONAL;
        
        if (!isGranted) {
          return;
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[PushNotification] Error checking permission:', error);
        }
      }

      try {
        await syncTokenWithBackend();
      } catch (error) {
        if (__DEV__) {
          console.error('[PushNotification] Error during initialization:', {
            message: error?.message,
            code: error?.code,
          });
        }
      }

      unsubscribeOnTokenRefresh = messaging().onTokenRefresh(syncTokenWithBackend);

      unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
        invalidateNotificationTags(dispatch);
        const title =
          remoteMessage?.notification?.title ||
          remoteMessage?.data?.Title ||
          remoteMessage?.data?.title ||
          'New Notification';
        const body =
          remoteMessage?.notification?.body ||
          remoteMessage?.data?.Body ||
          remoteMessage?.data?.body ||
          remoteMessage?.data?.message ||
          '';
        
        if (title || body) {
          try {
            await displayNotification(title, body, remoteMessage?.data || {});
          } catch (error) {
            if (__DEV__) {
              console.error('[PushNotification] Error displaying foreground notification:', error);
            }
          }
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

      unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
        if (type === 1) {
          invalidateNotificationTags(dispatch);
          const link = detail.notification?.data?.link || detail.notification?.data?.Link;
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
      });
    };

    initialize();

    return () => {
      unsubscribeOnMessage?.();
      unsubscribeOnTokenRefresh?.();
      unsubscribeOnOpenedApp?.();
      unsubscribeNotifee?.();
    };
  }, [dispatch, isAuthenticated, navigateFromNotification, syncTokenWithBackend, displayNotification]);
};