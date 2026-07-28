import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import './i18n';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import { auth, db } from './services/firebase';
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

// Admin Screens
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import AdminUsersScreen from './screens/admin/AdminUsersScreen';
import AdminNotificationScreen from './screens/admin/AdminNotificationScreen';

import CustomLoader from './components/common/CustomLoader';
import AppSplashScreen from './components/common/AppSplashScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Navigation Types
export type RootStackParamList = {
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

 export default function App() {
  const { user, setUser, setLanguage, setCurrency, isDarkMode, toggleDarkMode, isDeleting, deletingMessage } = useStore();
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
      } catch (error) {
        console.error("Failed to load settings:", error);
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

  if (!settingsReady || !authReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <AppSplashScreen />
      </GestureHandlerRootView>
    );
  }

  return (
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
          {!user ? (
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
  );
}
