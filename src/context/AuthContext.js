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

  // Dummy user data for different roles
  const dummyUsers = {
    admin: {
      id: '1',
      name: 'Admin User',
      email: 'admin@chandrajewels.com',
      role: 'admin',
      password: 'admin123',
    },
    client: {
      id: '2',
      name: 'John Smith',
      email: 'john@example.com',
      role: 'client',
      password: 'client123',
    },
    coral: {
      id: '3',
      name: 'Coral Designer',
      email: 'coral@chandrajewels.com',
      role: 'coral',
      password: 'coral123',
    },
    cad: {
      id: '4',
      name: 'CAD Designer',
      email: 'cad@chandrajewels.com',
      role: 'cad',
      password: 'cad123',
    },
  };

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Check auth state quickly, let video splash screen handle timing
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
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

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      // Simulate API call with dummy data
      const userData = Object.values(dummyUsers).find(
        user => user.email === email && user.password === password
      );

      if (userData) {
        const { password: _, ...userWithoutPassword } = userData;
        setUser(userWithoutPassword);
        setIsAuthenticated(true);
        await AsyncStorage.setItem('user', JSON.stringify(userWithoutPassword));
        return { success: true, user: userWithoutPassword };
      } else {
        return { success: false, error: 'Invalid credentials' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
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
