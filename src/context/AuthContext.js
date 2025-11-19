import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeJWT } from '../utils/helpers';
import { checkAuthState, logoutUser } from '../features/auth/authThunks';
import { useRemovePushTokenMutation } from '../store/api';
import { getStoredPushToken, clearStoredPushToken } from '../services/pushNotificationService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [removePushToken] = useRemovePushTokenMutation();
  // Get auth state from Redux (single source of truth)
  const { user: reduxUser, token: reduxToken, isAuthenticated: reduxIsAuthenticated, isLoading: reduxIsLoading } = useSelector((state) => state.auth);
  
  // Local state for backward compatibility
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check auth state on mount
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAuth = async () => {
    try {
      // Dispatch Redux checkAuthState which will handle validation
      await dispatch(checkAuthState()).unwrap();
    } catch (error) {
      console.error('Error initializing auth:', error);
      // If checkAuthState fails, clear invalid tokens
      await clearInvalidAuth();
    } finally {
      setIsInitialized(true);
    }
  };

  const clearInvalidAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (storedToken) {
        // Check if token is expired
        const decodedToken = decodeJWT(storedToken);
        if (decodedToken) {
          const exp = decodedToken.exp || decodedToken.Exp;
          if (exp) {
            const currentTime = Math.floor(Date.now() / 1000);
            if (exp < currentTime) {
              // Token is expired, clear it
              console.log('Token expired, clearing auth state');
              await dispatch(logoutUser()).unwrap();
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error clearing invalid auth:', error);
      // If we can't decode token, it's invalid - clear it
      await dispatch(logoutUser()).unwrap();
    }
  };

  // Note: Login is now handled by Redux in LoginScreen
  // This function is kept for backward compatibility but should not be used
  // LoginScreen uses useLoginMutation from Redux directly
  const login = async (email, password) => {
    console.warn('AuthContext.login is deprecated. Use Redux login mutation in LoginScreen instead.');
    return { success: false, error: 'Please use Redux login' };
  };

  const logout = async () => {
    try {
      const storedPushToken = await getStoredPushToken();
      if (storedPushToken) {
        try {
          await removePushToken({ token: storedPushToken }).unwrap();
        } catch (error) {
          console.warn('Failed to unregister push token:', error?.message || error);
        }
      }
      await clearStoredPushToken();
    } catch (err) {
      console.warn('Error cleaning up push token on logout:', err?.message || err);
    } finally {
      try {
        await dispatch(logoutUser()).unwrap();
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  // Use Redux state as single source of truth
  // Show loading until Redux state is initialized
  const isLoading = !isInitialized || reduxIsLoading;
  const isAuthenticated = reduxIsAuthenticated && !!reduxUser && !!reduxToken;
  const user = reduxUser;

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
