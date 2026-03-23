/**
 * Chandra Jewellery Management App
 * A comprehensive React Native app for jewelry business management
 *
 * @format
 */

import React, { useState, useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation';
import SplashScreen from './src/screens/VideoSplashScreen';
import { AnimatedLogoLoader, ErrorBoundary } from './src/components/common';
import { AlertProvider } from './src/context/AlertContext';
import UsersProvider from './src/components/providers/UsersProvider';
import PushNotificationsInitializer from './src/components/providers/PushNotificationsInitializer';
import SocketConnectionManager from './src/components/providers/SocketConnectionManager';
import ChatListSocketSync from './src/components/providers/ChatListSocketSync';
import { isFirstLaunch } from './src/utils/firstLaunch';

const AppContent = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const { isLoading: authLoading } = useAuth();
  const [splashFinished, setSplashFinished] = useState(false);
  const [checkingFirstLaunch, setCheckingFirstLaunch] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Check first launch after splash finishes
  useEffect(() => {
    const checkFirstLaunch = async () => {
      if (splashFinished && !authLoading) {
        const firstLaunch = await isFirstLaunch();
        setShowOnboarding(firstLaunch);
        setCheckingFirstLaunch(false);
      }
    };
    
    checkFirstLaunch();
  }, [splashFinished, authLoading]);

  // Show splash screen first
  if (!splashFinished) {
    return <SplashScreen onAnimationFinish={() => setSplashFinished(true)} />;
  }

  // Show loader while checking first launch or auth is loading
  if (checkingFirstLaunch || authLoading) {
    return <AnimatedLogoLoader size={50} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <UsersProvider>
          <AlertProvider>
            <PushNotificationsInitializer />
            <SocketConnectionManager />
            <ChatListSocketSync />
            <AppNavigator showOnboarding={showOnboarding} onOnboardingComplete={() => setShowOnboarding(false)} />
          </AlertProvider>
        </UsersProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Provider>
  );
}

export default App;
