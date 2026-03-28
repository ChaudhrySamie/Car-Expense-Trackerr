import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

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
import AboutScreen from './screens/AboutScreen';

// Navigation Types
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  AddCar: { car?: Car } | undefined;
  CarDashboard: { carId: string };
  ExpenseList: { carId: string; category: string };
  OilChange: { carId: string };
  Finance: { carId: string };
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { user, setUser } = useStore();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: any) => {
      if (firebaseUser) {
        let name = firebaseUser.displayName || undefined;
        
        try {
          const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
          const userData = userDoc.data();
          if (userDoc.exists && userData?.name) {
            name = userData.name;
          }
        } catch (error) {
          console.error("Error fetching profile: ", error);
        }

        setUser({ uid: firebaseUser.uid, email: firebaseUser.email, name });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator 
          id="root" 
          screenOptions={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }}
        >
          {!user ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="AddCar" component={AddCarScreen} />
              <Stack.Screen name="CarDashboard" component={CarDashboardScreen} />
              <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
              <Stack.Screen name="OilChange" component={OilChangeScreen} />
              <Stack.Screen name="Finance" component={FinanceScreen} />
              <Stack.Screen name="About" component={AboutScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
