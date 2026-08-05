import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './i18n';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import firebase, { auth, db } from './services/firebase';
import { useStore, Car } from './context/useStore';

// Screens
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import AddCarScreen from './screens/AddCarScreen';
import CarDashboardScreen from './screens/CarDashboardScreen';
import ExpenseListScreen from './screens/ExpenseListScreen';
import OilChangeScreen from './screens/OilChangeScreen';
import FinanceScreen from './screens/FinanceScreen';
import FuelScreen from './screens/FuelScreen';
import SignupScreen from './screens/SignupScreen';
import AboutScreen from './screens/AboutScreen';
import OnboardingScreen from './screens/OnboardingScreen';

// Admin Screens
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import AdminUsersScreen from './screens/admin/AdminUsersScreen';
import AdminNotificationScreen from './screens/admin/AdminNotificationScreen';

import CustomLoader from './components/common/CustomLoader';
import AppSplashScreen from './components/common/AppSplashScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Navigation Types
export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Home: undefined;
  AddCar: { car?: Car } | undefined;
  CarDashboard: { carId: string };
  ExpenseList: { carId: string; category: string };
  OilChange: { carId: string };
  Finance: { carId: string };
  Fuel: { carId: string };
  Signup: undefined;
  About: undefined;
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminNotifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

async function setupAnnouncementNotifications() {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;

    if (status !== 'granted') {
      const permission = await Notifications.requestPermissionsAsync();
      finalStatus = permission.status;
    }

    if (finalStatus !== 'granted') {
      return;
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    
    if (isExpoGo) {
      console.log('Skipping remote push setup — not supported in Expo Go. Use a development build to test this.');
      return;
    }

    const messagingService = (firebase as any).messaging?.();
    if (!messagingService?.subscribeToTopic || !messagingService?.onMessage) {
      return;
    }

    await messagingService.subscribeToTopic('announcements');

    messagingService.onMessage(async (remoteMessage: any) => {
      const title = remoteMessage?.notification?.title || 'Announcement';
      const body = remoteMessage?.notification?.body || 'A new announcement is available.';

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'announcement', remoteMessage },
        },
        trigger: null,
      });
    });
  } catch (error) {
    console.error('Failed to configure announcement notifications:', error);
  }
}

 export default function App() {
  const { user, setUser, setLanguage, setCurrency, isDarkMode, toggleDarkMode, isDeleting, deletingMessage, hasSeenOnboarding, setHasSeenOnboarding } = useStore();
  const { i18n } = useTranslation();
  const [settingsReady, setSettingsReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const loadSavedSettings = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('user_language');
        if (savedLang) {
          setLanguage(savedLang);
          if (i18n.language !== savedLang) {
            await i18n.changeLanguage(savedLang);
          }
        } else {
          setLanguage(i18n.language);
        }

        const savedCurrency = await AsyncStorage.getItem('user_currency');
        if (savedCurrency) {
          setCurrency(savedCurrency);
        }

        const savedDarkMode = await AsyncStorage.getItem('user_dark_mode');
        if (savedDarkMode !== null) {
          const isDark = savedDarkMode === 'true';
          if (isDark !== isDarkMode) {
            toggleDarkMode();
          }
        }

        const seenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        setHasSeenOnboarding(seenOnboarding === 'true');
      } catch (error) {
        console.error("Failed to load settings:", error);
        // Default to true on error so we don't block the user out
        setHasSeenOnboarding(true);
      } finally {
        setSettingsReady(true);
      }
    };
    loadSavedSettings();
  }, []);

  useEffect(() => {
    let unsubscribeUserDoc: () => void;

    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser: any) => {
      if (firebaseUser) {
        let name = firebaseUser.displayName || undefined;
        
        try {
          unsubscribeUserDoc = db.collection('users').doc(firebaseUser.uid).onSnapshot(async (userDoc) => {
            const userData = userDoc.data();

            // If deactivated or deleted, sign out immediately
            if (userDoc.exists && (userData?.status === 'deactivated' || userData?.status === 'deleted')) {
              if (unsubscribeUserDoc) unsubscribeUserDoc();
              await auth.signOut();
              return;
            }

            if (userDoc.exists) {
              const newName = userData?.name || name;
              setUser({ 
                uid: firebaseUser.uid, 
                email: firebaseUser.email, 
                name: newName,
                maxVehicles: userData?.maxVehicles || 5
              });
            } else {
              setUser({ uid: firebaseUser.uid, email: firebaseUser.email, name });
            }
          });
        } catch (error) {
          console.error("Error setting up user listener: ", error);
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, name });
        }
      } else {
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        setUser(null);
      }
      setAuthReady(true);
    });
    
    return () => {
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (authReady && settingsReady) {
      setupAnnouncementNotifications();
    }
  }, [authReady, settingsReady]);

  if (!settingsReady || !authReady) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="light" />
          <AppSplashScreen />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <NavigationContainer>
        <Stack.Navigator 
          id="root" 
          screenOptions={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }}
        >
          {!hasSeenOnboarding ? (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          ) : !user ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="AddCar" component={AddCarScreen} />
              <Stack.Screen name="CarDashboard" component={CarDashboardScreen} />
              <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
              <Stack.Screen name="OilChange" component={OilChangeScreen} />
              <Stack.Screen name="Finance" component={FinanceScreen} />
              <Stack.Screen name="Fuel" component={FuelScreen} />
              <Stack.Screen name="About" component={AboutScreen} />

              {/* Admin Area */}
              {user?.email?.toLowerCase() === 'chaudhrysamie@gmail.com' && (
                <>
                  <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                  <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
                  <Stack.Screen name="AdminNotifications" component={AdminNotificationScreen} />
                </>
              )}
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <CustomLoader visible={isDeleting} message={deletingMessage} />
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
