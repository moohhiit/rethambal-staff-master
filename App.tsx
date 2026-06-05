import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import RootNavigator from './Navigation/RootNavigator';
import { AuthProvider } from './Contexts/AuthContext';
// import { AppProvider } from './Contexts/AppContext';


const App: React.FC = () => {
  useEffect(() => {
    requestUserPermission();
    setupNotificationListeners();
  }, []);

  const requestUserPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      console.log('Notification permission:', granted);
    }

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status:', authStatus);
    }
  };

  const setupNotificationListeners = () => {
    // Handle foreground notifications
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('Foreground notification:', remoteMessage);
      // You can show a custom notification or alert here
    });

    // Handle notification tap when app is in background
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app from background:', remoteMessage);
      // Navigate to specific screen based on notification data
    });

    // Handle notification tap when app is closed/killed
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Notification opened app from quit state:', remoteMessage);
          // Navigate to specific screen based on notification data
        }
      });

    return unsubscribe;
  };
 

  return (
    <SafeAreaProvider>
      <AuthProvider>
        
        {/* <AppProvider> */}
          <NavigationContainer>
            <StatusBar
              barStyle="light-content"
              backgroundColor="#1e3a8a"
              translucent={false}
            />
            <RootNavigator />
          </NavigationContainer>
        {/* </AppProvider> */}
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;