/**
 * Chandra Jewellery Management App
 * A comprehensive React Native app for jewelry business management
 *
 * @format
 */

import React, { useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation';
import SplashScreen from './src/screens/VideoSplashScreen';
import { AnimatedLogoLoader } from './src/components/common';

const AppContent = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const { isLoading: authLoading } = useAuth();
  const [splashFinished, setSplashFinished] = useState(false);

  // Show splash screen first
  if (!splashFinished) {
    return <SplashScreen onAnimationFinish={() => setSplashFinished(true)} />;
  }

  // Show loader while auth is loading
  if (authLoading) {
    return <AnimatedLogoLoader size={50} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppNavigator />
    </SafeAreaProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
