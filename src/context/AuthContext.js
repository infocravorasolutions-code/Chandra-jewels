import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Check auth state quickly, let video splash screen handle timing
      const storedUser = await AsyncStorage.getItem('user');
      const storedToken = await AsyncStorage.getItem('token');
      
      if (storedUser && storedToken) {
        const userData = JSON.parse(storedUser);
        
        // Add name if missing (for backward compatibility)
        if (!userData.name) {
          const getDisplayName = (email, role) => {
            if (email) {
              const emailPart = email.split('@')[0];
              return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
            }
            const roleNames = {
              admin: 'Administrator',
              client: 'Client',
              coral: 'Coral Designer',
              cad: 'CAD Designer',
            };
            return roleNames[role] || 'User';
          };
          userData.name = getDisplayName(userData.email, userData.role);
          // Update stored user with name
          await AsyncStorage.setItem('user', JSON.stringify(userData));
        }
        
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      // Set loading to false immediately - let video splash screen control timing
      setIsLoading(false);
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
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
