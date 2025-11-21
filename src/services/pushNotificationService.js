import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

export const PUSH_TOKEN_STORAGE_KEY = '@chandra/pushToken';

export const isPermissionGranted = (status) =>
  status === messaging.AuthorizationStatus.AUTHORIZED ||
  status === messaging.AuthorizationStatus.PROVISIONAL;

export const requestPushPermission = async () => {
  const currentStatus = await messaging().hasPermission();
  if (isPermissionGranted(currentStatus)) {
    return true;
  }
  const newStatus = await messaging().requestPermission({
    alert: true,
    announcement: false,
    badge: true,
    sound: true,
    carPlay: false,
    provisional: true,
  });
  return isPermissionGranted(newStatus);
};

export const registerForRemoteMessages = async () => {
  try {
    await messaging().registerDeviceForRemoteMessages();
    return true;
  } catch (error) {
    return false;
  }
};

export const getStoredPushToken = () => AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);

export const savePushTokenLocally = (token) =>
  AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);

export const clearStoredPushToken = async () => {
  try {
    await messaging().deleteToken();
  } catch (error) {
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
};

export const getDeviceMetadata = () => ({
  platform: Platform.OS,
  osVersion: Platform.Version?.toString() || 'unknown',
});

