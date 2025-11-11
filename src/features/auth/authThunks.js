import { createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeJWT, mapRoleNumberToString } from '../../utils/helpers';

// Async thunk to check auth state on app start
export const checkAuthState = createAsyncThunk(
  'auth/checkAuthState',
  async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const storedToken = await AsyncStorage.getItem('token');
      
      if (storedUser && storedToken) {
        // Validate token expiration
        const decodedToken = decodeJWT(storedToken);
        if (decodedToken) {
          const exp = decodedToken.exp || decodedToken.Exp;
          if (exp) {
            const currentTime = Math.floor(Date.now() / 1000);
            if (exp < currentTime) {
              // Token is expired, clear it
              console.log('Token expired, clearing auth state');
              await AsyncStorage.removeItem('user');
              await AsyncStorage.removeItem('token');
              return null;
            }
          }
        } else {
          // Invalid token format, clear it
          console.log('Invalid token format, clearing auth state');
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('token');
          return null;
        }
        
        const userData = JSON.parse(storedUser);
        let userDataUpdated = false;
        
        // Extract roleId from token if not already in userData (for backward compatibility)
        if (!userData.roleId && !userData.roleNumber && decodedToken) {
          const roleNumber = decodedToken.Role || decodedToken.role || decodedToken.RoleNumber || decodedToken.roleNumber;
          if (roleNumber !== undefined && roleNumber !== null) {
            userData.roleId = roleNumber;
            userData.roleNumber = roleNumber; // Alias
            userDataUpdated = true;
          }
        }
        
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
          userDataUpdated = true;
        }
        
        // Save updated userData if any changes were made
        if (userDataUpdated) {
          await AsyncStorage.setItem('user', JSON.stringify(userData));
        }
        
        return { user: userData, token: storedToken };
      }
      return null;
    } catch (error) {
      console.error('Error checking auth state:', error);
      // Clear potentially corrupted data
      try {
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('token');
      } catch (clearError) {
        console.error('Error clearing auth data:', clearError);
      }
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

