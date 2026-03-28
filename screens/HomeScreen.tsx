import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { useStore, Car } from '../context/useStore';
import { auth } from '../services/firebase';
import { subscribeToUserCars, deleteCarFromDb } from '../services/db';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';

// Premium Components
import Header from '../components/common/Header';
import AnimatedCard from '../components/common/AnimatedCard';
import AnimatedButton from '../components/common/AnimatedButton';
import FloatingActionButton from '../components/common/FloatingActionButton';
import CustomStatusModal from '../components/common/CustomStatusModal';
import { COLORS, SPACING, SHADOWS } from '../utils/theme';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, cars, setCars, setSelectedCar } = useStore();
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      setLoading(true);
      unsubscribe = subscribeToUserCars(user.uid, (fetchedCars) => {
        setCars(fetchedCars);
        setLoading(false);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const handleCarPress = (car: Car) => {
    setSelectedCar(car);
    navigation.navigate('CarDashboard', { carId: car.id });
  };

  const handleCarOptions = (car: Car) => {
    Alert.alert(
      "Car Options",
      `Manage ${car.name}`,
      [
        {
          text: "Edit",
          onPress: () => navigation.navigate('AddCar', { car })
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmDelete(car)
        },
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  };

  const confirmDelete = (car: Car) => {
    Alert.alert(
      "Delete Car",
      `Are you sure you want to delete ${car.name}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteCarFromDb(car.id);
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Failed to delete car.");
            }
          } 
        }
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      // App state will be cleared by the listener in App.tsx
    } catch (error) {
      console.error("Logout error: ", error);
    }
  };

  const renderCarCard = ({ item, index }: { item: Car; index: number }) => (
    <AnimatedCard 
      delay={index * 100}
      style={styles.carCardContainer}
    >
      <TouchableOpacity 
        style={styles.carCardInner} 
        onPress={() => handleCarPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.carImageContainer}>
          <Ionicons name="car-sport" size={32} color={COLORS.primary} />
        </View>
        <View style={styles.carInfo}>
          <Text style={styles.carName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.carModel}>{item.model} • {item.year}</Text>
        </View>
        <TouchableOpacity 
          style={styles.optionsButton} 
          onPress={() => handleCarOptions(item)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      </TouchableOpacity>
    </AnimatedCard>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="My Garage" 
        showBack={false}
        rightElement={
          <TouchableOpacity 
            onPress={() => setShowProfileMenu(!showProfileMenu)}
            style={styles.avatarBtn}
          >
            <Ionicons name="person-circle" size={36} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      {showProfileMenu && (
        <View style={styles.profilePopup}>
           <Text style={styles.popupName}>{user?.name || 'User'}</Text>
           <Text style={styles.popupEmail}>{user?.email}</Text>
           <View style={styles.popupDivider} />
           <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
              <Text style={styles.logoutText}>Sign Out</Text>
           </TouchableOpacity>
        </View>
      )}

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={cars}
            keyExtractor={(item) => item.id}
            renderItem={renderCarCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="car-outline" size={80} color="#CBD5E1" />
                <Text style={styles.emptyStateText}>Garage is empty</Text>
                <Text style={styles.emptyStateSubText}>Add a car to start tracking costs</Text>
                <AnimatedButton 
                  title="Add Your First Car" 
                  onPress={() => navigation.navigate('AddCar')}
                  style={{ width: 200, marginTop: 24 }}
                />
              </View>
            }
          />
        )}
      </View>

      {cars.length < 3 && (
        <FloatingActionButton onPress={() => navigation.navigate('AddCar')} />
      )}

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('About')} style={styles.aboutBtn}>
          <Text style={styles.aboutText}>Developed by Chaudhry Samie</Text>
        </TouchableOpacity>
      </View>

      <CustomStatusModal 
        {...statusModal} 
        onClose={() => setStatusModal({ ...statusModal, visible: false })} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  avatarBtn: {
    padding: 2,
  },
  profilePopup: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    width: 200,
    zIndex: 2000,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  popupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  popupEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  popupDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    marginLeft: 8,
    color: COLORS.danger,
    fontWeight: '600',
  },
  listContainer: {
    paddingTop: 10,
    paddingBottom: 100,
  },
  carCardContainer: {
    padding: 0,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  carCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  carImageContainer: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  carInfo: {
    flex: 1,
  },
  carName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  carModel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  optionsButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
  },
  emptyStateSubText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  aboutBtn: {
    padding: 10,
  },
  aboutText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
