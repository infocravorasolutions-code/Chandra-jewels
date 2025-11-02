import { createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Async thunk to check auth state on app start
export const checkAuthState = createAsyncThunk(
  'auth/checkAuthState',
  async () => {
    try {
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
          await AsyncStorage.setItem('user', JSON.stringify(userData));
        }
        
        return { user: userData, token: storedToken };
      }
      return null;
    } catch (error) {
      console.error('Error checking auth state:', error);
      return null;
    }
  }
);

// Async thunk for logout
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
);

