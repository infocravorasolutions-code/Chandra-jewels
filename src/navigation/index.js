import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import StackNavigator from './StackNavigator';
import { AnimatedLogoLoader } from '../components/common';
import { navigationRef } from './navigationRef';
import { processPendingNotification } from '../utils/notificationNavigation';

const AppNavigator = ({ showOnboarding, onOnboardingComplete }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Process pending notification when both navigation and auth are ready
  useEffect(() => {
    if (!isLoading && isAuthenticated && navigationRef.isReady()) {
      console.log('[Navigation] ========================================');
      console.log('[Navigation] ✅ Auth and navigation ready, processing pending notification');
      console.log('[Navigation] Auth state - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);
      console.log('[Navigation] Navigation ready:', navigationRef.isReady());
      console.log('[Navigation] ========================================');
      // Delay to ensure navigation stack is fully initialized and screens are mounted
      const timer = setTimeout(() => {
        console.log('[Navigation] 🚀 Processing pending notification now...');
        processPendingNotification();
      }, 1500); // Increased delay to ensure everything is ready
      return () => clearTimeout(timer);
    } else {
      console.log('[Navigation] ⏳ Waiting for conditions:', {
        isLoading,
        isAuthenticated,
        navigationReady: navigationRef.isReady(),
      });
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return <AnimatedLogoLoader size={50} />;
  }

  return (
    <NavigationContainer 
      ref={navigationRef}
      onReady={() => {
        console.log('[Navigation] ========================================');
        console.log('[Navigation] 🎯 Navigation container is ready');
        console.log('[Navigation] Auth state - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);
        console.log('[Navigation] ========================================');
        // Process any pending notification when navigation becomes ready AND user is authenticated
        if (isAuthenticated) {
          // Increased delay to ensure navigation stack and screens are fully initialized
          setTimeout(() => {
            console.log('[Navigation] 🚀 Processing pending notification after navigation ready (delayed)');
            processPendingNotification();
          }, 2000); // Increased to 2 seconds to ensure full initialization
        } else {
          console.log('[Navigation] ⏳ Waiting for authentication before processing notification');
        }
      }}
    >
      <StackNavigator 
        isAuthenticated={isAuthenticated}
        showOnboarding={showOnboarding}
        onOnboardingComplete={onOnboardingComplete}
      />
    </NavigationContainer>
  );
};

export default AppNavigator;
