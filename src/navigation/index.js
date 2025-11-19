import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import StackNavigator from './StackNavigator';
import { AnimatedLogoLoader } from '../components/common';
import { navigationRef } from './navigationRef';

const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('AppNavigator - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  if (isLoading) {
    return <AnimatedLogoLoader size={50} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StackNavigator isAuthenticated={isAuthenticated} />
    </NavigationContainer>
  );
};

export default AppNavigator;
