import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';

// Import screens
import LoginScreen from '../screens/Auth/LoginScreen';
import BottomTabs from './BottomTabs';
import SingleEnquiryScreen from '../screens/Enquiries/SingleEnquiryScreen';
import AddEnquiryStep1Screen from '../screens/AddEnquiry/AddEnquiryStep1Screen';
import AddEnquiryStep2Screen from '../screens/AddEnquiry/AddEnquiryStep2Screen';
import ChatDetailScreen from '../screens/Chats/ChatDetailScreen';
import MetalPricesScreen from '../screens/Admin/MetalPricesScreen';
import ClientsListScreen from '../screens/Admin/ClientsListScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import FontTest from '../components/FontTest';
// import ResponsiveDemoScreen from '../components/ResponsiveDemoScreen';

const Stack = createStackNavigator();

const StackNavigator = ({ isAuthenticated }) => {
  console.log('StackNavigator - isAuthenticated:', isAuthenticated);
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.textWhite,
        headerTitleStyle: {
          fontFamily: fonts.bold,
          fontSize: fonts.lg,
        },
        headerBackTitleVisible: false,
      }}>
      {isAuthenticated ? (
        // Authenticated screens
        <>
          <Stack.Screen
            name="MainTabs"
            component={BottomTabs}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="SingleEnquiry"
            component={SingleEnquiryScreen}
            options={{
              title: 'Enquiry Details',
            }}
          />
          <Stack.Screen
            name="AddEnquiryStep1"
            component={AddEnquiryStep1Screen}
            options={({ route }) => ({
              title: route.params?.enquiry ? 'Edit Enquiry - Step 1' : 'Add Enquiry - Step 1',
            })}
          />
          <Stack.Screen
            name="AddEnquiryStep2"
            component={AddEnquiryStep2Screen}
            options={({ route }) => ({
              title: route.params?.isEditMode ? 'Edit Enquiry - Step 2' : 'Add Enquiry - Step 2',
            })}
          />
          <Stack.Screen
            name="ChatDetail"
            component={ChatDetailScreen}
            options={{
              title: 'Chat',
            }}
          />
          <Stack.Screen
            name="MetalPrices"
            component={MetalPricesScreen}
            options={{
              title: 'Metal Prices',
            }}
          />
          <Stack.Screen
            name="ClientsList"
            component={ClientsListScreen}
            options={{
              title: 'Clients',
            }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="FontTest"
            component={FontTest}
            options={{
              title: 'Font Test',
            }}
          />
          {/* <Stack.Screen
            name="ResponsiveDemo"
            component={ResponsiveDemoScreen}
            options={{
              title: 'Responsive Demo',
            }}
          /> */}
        </>
      ) : (
        // Unauthenticated screens
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            headerShown: false,
          }}
        />
      )}
    </Stack.Navigator>
  );
};

export default StackNavigator;
