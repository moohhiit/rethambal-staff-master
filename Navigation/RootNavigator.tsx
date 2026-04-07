import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import your screens
import NativeBottomTabsNavigator from './NativeBottomTabsNavigator';
import StaffLoginScreen from '../screens/auth/LoginScreen';
import ExamManagement from '../screens/Exam/ExamManagment';
import MyAttendanceScreen from '../screens/Attendance/MyAttendance';
import StaffProfile from '../screens/profile/StaffProfile';

export type RootStackParamList = {
  StaffLogin: undefined;
  Main: undefined;
  Exam : undefined
  MyAttendance : undefined
  Profile: undefined
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const StackNavigation: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setError(null);
      
      // Check for authentication token and user data
      const [authToken, userData, tokenExpiry] = await AsyncStorage.multiGet([
        'authToken',
        'userData',
        'tokenExpiry',
      ]);

      const token = authToken[1];
      const user = userData[1];
      const expiry = tokenExpiry[1];

      console.log('Auth Check:', {
        hasToken: !!token,
        hasUserData: !!user,
        hasExpiry: !!expiry,
      });

      // Validate that all required data exists
      if (token && user && expiry) {
        // Check if token is not expired
        const currentTime = new Date().getTime();
        const expiryTime = parseInt(expiry);

        if (currentTime < expiryTime) {
          // Parse user data to verify it's valid
          try {
            const parsedUser = JSON.parse(user);
            if (parsedUser && parsedUser.id) {
              console.log('User authenticated:', parsedUser.first_name);
              setIsAuthenticated(true);
            } else {
              console.log('Invalid user data structure');
              await clearAuthData();
              setIsAuthenticated(false);
            }
          } catch (parseError) {
            console.error('Error parsing user data:', parseError);
            await clearAuthData();
            setIsAuthenticated(false);
          }
        } else {
          // Token expired
          console.log('Token expired');
          await clearAuthData();
          setIsAuthenticated(false);
        }
      } else {
        // No auth data found
        console.log('No authentication data found');
        setIsAuthenticated(false);
      }
    } catch (error: any) {
      console.error('Error checking auth status:', error);
      setError('Failed to check authentication status');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthData = async () => {
    try {
      const keys = [
        'authToken',
        'tokenExpiry',
        'userData',
        'userRole',
        'staffId',
        'userId',
        'employeeId',
        'mobileNumber',
        'fcmToken',
        'selectedOption',
        'deviceInfo',
        'loginTime',
      ];
      await AsyncStorage.multiRemove(keys);
      console.log('Auth data cleared');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show error screen if there's an error
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubText}>Please restart the app</Text>
      </View>
    );
  }

  return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
        initialRouteName={isAuthenticated ? 'Main' : 'StaffLogin'}
      >
        <Stack.Screen 
          name="StaffLogin" 
          component={StaffLoginScreen}
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen 
          name="Main" 
          component={NativeBottomTabsNavigator}
          options={{
            headerShown: false,
            gestureEnabled: false, // Prevent swipe back to login
          }}
        />
        <Stack.Screen 
          name="Exam" 
          component={ExamManagement}
          options={{
            headerShown: false,
            gestureEnabled: false, // Prevent swipe back to login
          }}
        />
        <Stack.Screen 
          name="MyAttendance" 
          component={MyAttendanceScreen}
          options={{
            headerShown: false,
            gestureEnabled: false, // Prevent swipe back to login
          }}
        />
        <Stack.Screen 
          name="Profile" 
          component={StaffProfile}
          options={{
            headerShown: false,
            gestureEnabled: false, // Prevent swipe back to login
          }}
        />
      </Stack.Navigator>
    
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#dc2626',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default StackNavigation;