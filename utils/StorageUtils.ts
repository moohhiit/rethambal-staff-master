// StorageUtils.ts
// Utility functions to retrieve stored user and device information

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Interface for stored user data
 */
interface StoredUserData {
  id: string;
  user_id: string;
  employee_id: string;
  staff_type: string;
  designation: string;
  department: string;
  status: string;
  user: {
    id: string;
    role: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    photo_url: string;
    fcm_token?: string;
  };
}

/**
 * Interface for device information
 */
interface DeviceInfo {
  platform: string;
  version: string | number;
  loginTime: string;
  selectedPurpose: string;
}

/**
 * Get all stored user data
 */
export const getUserData = async (): Promise<StoredUserData | null> => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

/**
 * Get device information
 */
export const getDeviceInfo = async (): Promise<DeviceInfo | null> => {
  try {
    const deviceInfo = await AsyncStorage.getItem('deviceInfo');
    return deviceInfo ? JSON.parse(deviceInfo) : null;
  } catch (error) {
    console.error('Error getting device info:', error);
    return null;
  }
};

// Hello Here I add somthing New
//  I am Addng New Line for testing purpose git
/**
 * Get selected login purpose
 */
export const getSelectedPurpose = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('selectedOption');
  } catch (error) {
    console.error('Error getting selected purpose:', error);
    return null;
  }
};

/**
 * Get FCM token
 */
export const getFCMTokenFromStorage = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('fcmToken');
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Get user role
 */
export const getUserRole = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('userRole');
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

/**
 * Get staff ID
 */
export const getStaffId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('staffId');
  } catch (error) {
    console.error('Error getting staff ID:', error);
    return null;
  }
};

/**
 * Get user ID
 */
export const getUserId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('userId');
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
};

/**
 * Get employee ID
 */
export const getEmployeeId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('employeeId');
  } catch (error) {
    console.error('Error getting employee ID:', error);
    return null;
  }
};

/**
 * Get mobile number
 */
export const getMobileNumber = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('mobileNumber');
  } catch (error) {
    console.error('Error getting mobile number:', error);
    return null;
  }
};

/**
 * Get auth token
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('authToken');
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Get login time
 */
export const getLoginTime = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('loginTime');
  } catch (error) {
    console.error('Error getting login time:', error);
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = async (): Promise<boolean> => {
  try {
    const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
    if (!tokenExpiry) return true;
    
    return new Date().getTime() >= parseInt(tokenExpiry);
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true;
  }
};

/**
 * Get all stored data at once
 */
export const getAllStoredData = async () => {
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

    const values = await AsyncStorage.multiGet(keys);
    
    const data: { [key: string]: any } = {};
    values.forEach(([key, value]) => {
      if (value) {
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    });

    return data;
  } catch (error) {
    console.error('Error getting all stored data:', error);
    return null;
  }
};

/**
 * Clear all user data (logout)
 */
export const clearUserData = async (): Promise<boolean> => {
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
    return true;
  } catch (error) {
    console.error('Error clearing user data:', error);
    return false;
  }
};

/**
 * Update FCM token in storage
 */
export const updateStoredFCMToken = async (newToken: string): Promise<boolean> => {
  try {
    await AsyncStorage.setItem('fcmToken', newToken);
    
    // Also update in userData
    const userData = await getUserData();
    if (userData) {
      userData.user.fcm_token = newToken;
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
    }
    
    return true;
  } catch (error) {
    console.error('Error updating FCM token:', error);
    return false;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await getAuthToken();
    const isExpired = await isTokenExpired();
    
    return !!token && !isExpired;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

/**
 * Get user display name
 */
export const getUserDisplayName = async (): Promise<string> => {
  try {
    const userData = await getUserData();
    if (userData) {
      return `${userData.user.first_name} ${userData.user.last_name}`;
    }
    return 'Unknown User';
  } catch (error) {
    console.error('Error getting user display name:', error);
    return 'Unknown User';
  }
};