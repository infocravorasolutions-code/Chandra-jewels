/**
 * @format
 */

import 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Initialize Sentry with error handling
try {
  Sentry.init({
    dsn: 'https://3fd29e70ba7c23d9c9b6b246a292bf67@o4510333890920448.ingest.us.sentry.io/4510359398449152',
    enableInExpoDevelopment: false,
    debug: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
    // Set tracesSampleRate to 1.0 to capture 100% of the transactions for performance monitoring.
    // We recommend adjusting this value in production.
    tracesSampleRate: 1.0,
  });
} catch (error) {
  // If Sentry fails to initialize, log but don't crash the app
  console.warn('Sentry initialization failed (app will continue without error tracking):', error?.message || error);
}

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📩 Push message handled in the background:', remoteMessage?.messageId || 'unknown');
});

AppRegistry.registerComponent(appName, () => App);
