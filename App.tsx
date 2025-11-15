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
import { AnimatedLogoLoader } from './src/components/common';
import { AlertProvider } from './src/context/AlertContext';
import UsersProvider from './src/components/providers/UsersProvider';
import { useGetRolesQuery } from './src/store/api';

const AppContent = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const { isLoading: authLoading } = useAuth();
  const [splashFinished, setSplashFinished] = useState(false);
  
  // Fetch roles on app startup to populate role mappings
  // This doesn't require authentication, so we can fetch it early
  const { data: roles, isLoading: rolesLoading, error: rolesError } = useGetRolesQuery(undefined, {
    skip: false, // Always fetch roles
  });
  
  useEffect(() => {
    console.log('🚀 ========== APP STARTUP - ROLES FETCH ==========');
    console.log('🚀 Roles loading:', rolesLoading);
    console.log('🚀 Roles error:', rolesError);
    
    if (roles && roles.length > 0) {
      console.log('✅ Roles loaded on app startup:', roles.length, 'roles');
      console.log('✅ Roles data:', roles);
    } else if (rolesError) {
      console.error('❌ Failed to load roles on startup:', rolesError);
      console.warn('⚠️ App will use fallback hardcoded role mappings');
    }
    console.log('🚀 ===============================================');
  }, [roles, rolesLoading, rolesError]);
  
  // Auth state is now checked by AuthContext on mount
  // No need to dispatch checkAuthState here

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
      <UsersProvider>
        <AlertProvider>
          <AppNavigator />
        </AlertProvider>
      </UsersProvider>
    </SafeAreaProvider>
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
