import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import StackNavigator from './StackNavigator';
import { Loader } from '../components/common/Loader';

const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('AppNavigator - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <NavigationContainer>
      <StackNavigator isAuthenticated={isAuthenticated} />
    </NavigationContainer>
  );
};

export default AppNavigator;
