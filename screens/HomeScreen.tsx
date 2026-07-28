import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform, Switch, Alert, I18nManager, DevSettings, Modal } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { useStore, Car } from '../context/useStore';
import { auth, db } from '../services/firebase';
import { subscribeToUserCars, deleteCarFromDb } from '../services/db';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../hooks/useThemeColors';

// Premium Components
import Header from '../components/common/Header';
import AnimatedCard from '../components/common/AnimatedCard';
import AnimatedButton from '../components/common/AnimatedButton';
import FloatingActionButton from '../components/common/FloatingActionButton';
import CustomStatusModal from '../components/common/CustomStatusModal';
import SelectionModal from '../components/common/SelectionModal';
import { SHADOWS, TYPOGRAPHY } from '../utils/theme';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, cars, setCars, setSelectedCar, setLanguage, currency, setCurrency, isDarkMode, toggleDarkMode } = useStore();
  const { colors } = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedCarForMenu, setSelectedCarForMenu] = useState<Car | null>(null);
  const [showCarMenu, setShowCarMenu] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const { t, i18n } = useTranslation();
  
  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  const [confirmDeleteModal, setConfirmDeleteModal] = useState({
    visible: false,
    car: null as Car | null
  });

  const [globalNotifs, setGlobalNotifs] = useState<any[]>([]);
  const [userNotifs, setUserNotifs] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      setShowProfileMenu(false);
      return () => {};
    }, [])
  );


  useEffect(() => {
    const unsubNotifs = db.collection('global_notifications')
      .where('active', '==', true)
      .onSnapshot(
        (snap) => {
          const list = snap.docs.map(doc => doc.data());
          setGlobalNotifs(list);
        },
        (err) => console.log('Notif error:', err)
      );
    return () => unsubNotifs();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubUserNotifs = db.collection('user_notifications')
      .where('userId', '==', user.uid)
      .where('active', '==', true)
      .onSnapshot(
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUserNotifs(list);
        },
        (err) => console.log('User notif error:', err)
      );
    return () => unsubUserNotifs();
  }, [user]);

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
    setShowProfileMenu(false);
    setSelectedCar(car);
    navigation.navigate('CarDashboard', { carId: car.id });
  };


  const handleCarOptions = (car: Car) => {
    setSelectedCarForMenu(car);
    setShowCarMenu(true);
  };

  const confirmDelete = (car: Car) => {
    setConfirmDeleteModal({ visible: true, car });
  };

  const handleDelete = async () => {
    if (!confirmDeleteModal.car) return;
    try {
      await deleteCarFromDb(confirmDeleteModal.car.id);
      setConfirmDeleteModal({ visible: false, car: null });
      setStatusModal({
        visible: true,
        type: 'success',
        title: 'Deleted',
        message: 'Vehicle removed successfully'
      });
    } catch (error) {
      console.error(error);
      setStatusModal({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to delete car'
      });
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Logout error: ", error);
    }
  };

  const dismissUserNotif = async (notifId: string) => {
    try {
      await db.collection('user_notifications').doc(notifId).update({ active: false });
    } catch (error) {
      console.error("Failed to dismiss: ", error);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    setShowLanguageModal(false);
    setShowProfileMenu(false);
    
    const isRTL = lang === 'ar' || lang === 'ur';
    const currentRTL = I18nManager.isRTL;
    
    await i18n.changeLanguage(lang);
    setLanguage(lang);
    await AsyncStorage.setItem('user_language', lang);
    
    if (isRTL !== currentRTL) {
      I18nManager.forceRTL(isRTL);
      Alert.alert(
        'Restart Required',
        'The layout change requires an app restart to apply correctly.',
        [{ text: 'OK', onPress: () => Platform.OS === 'android' ? DevSettings.reload() : null }]
      );
    }
  };

  const handleCurrencyChange = async (curr: string) => {
    setShowCurrencyModal(false);
    setShowProfileMenu(false);
    setCurrency(curr);
    await AsyncStorage.setItem('user_currency', curr);
  };

  const handleThemeToggle = async () => {
    const newVal = !isDarkMode;
    toggleDarkMode();
    await AsyncStorage.setItem('user_dark_mode', newVal.toString());
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
        <View style={[styles.carImageContainer, { backgroundColor: isDarkMode ? '#1e293b' : colors.accentLight }]}>
          {item.type === 'bike' ? (
            <MaterialIcons name="motorcycle" size={28} color={colors.primary} />
          ) : (
            <Ionicons name="car-sport" size={28} color={colors.primary} />
          )}
        </View>
        <View style={styles.carInfo}>
          <View style={styles.carTitleRow}>
            <Text style={[styles.carName, { color: colors.text }]} numberOfLines={1}>{item.name} {item.model}</Text>
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#064e3b' : '#F0FDF4' }]}>
               <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
               <Text style={[styles.statusText, { color: colors.success }]}>{t('common.active')}</Text>
             </View>
           </View>
          <Text style={[styles.carModel, { color: colors.textSecondary }]}> {item.year} • {item.plate} </Text>
          <View style={styles.carSpecsRow}>
            <View style={[styles.specItem, { backgroundColor: isDarkMode ? '#1e293b' : '#F8FAFC' }]}>
              <Ionicons name="speedometer-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.specText, { color: colors.textSecondary }]}>{item.mileage} km</Text>
            </View>
            <View style={[styles.specDivider, { backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' }]} />
            <View style={[styles.specItem, { backgroundColor: isDarkMode ? '#1e293b' : '#F8FAFC' }]}>
              <Ionicons name="flash-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.specText, { color: colors.textSecondary }]}>{item.engineCC} cc</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.optionsButton} 
          onPress={() => handleCarOptions(item)}
          activeOpacity={0.5}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </AnimatedCard>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.bgDecor1, { backgroundColor: colors.accentLight }]} />
      <View style={[styles.bgDecor2, { backgroundColor: colors.accentLight }]} />
      
       <Header 
         title={user ? t('home.welcome', { name: user.name || user.email?.split('@')[0] || 'User' }) : t('common.garage')} 
         subtitle={t('home.subtitle')}
        showBack={false}
        alignLeft={true}
        rightElement={
          <TouchableOpacity 
            onPress={() => setShowProfileMenu((visible) => !visible)}
            style={styles.avatarBtn}
            activeOpacity={0.7}
          >
            <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
              <Ionicons name="person" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>
        }
      />

      <Modal
        visible={showProfileMenu}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <View style={styles.profileModalOverlay}>
          <TouchableOpacity
            style={styles.profileBackdrop}
            onPress={() => setShowProfileMenu(false)}
            activeOpacity={1}
            accessibilityLabel="Close profile menu"
          />
          <View style={[styles.profilePopup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.profileHeader}>
              <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
                <Ionicons name="person" size={20} color="#FFF" />
              </View>
              <View style={styles.profileIdentity}>
                <Text style={[styles.popupName, { color: colors.text }]} numberOfLines={1}>{user?.name || 'User'}</Text>
                <Text style={[styles.popupEmail, { color: colors.textSecondary }]} numberOfLines={1}>{user?.email}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowProfileMenu(false)}
                style={[styles.closeProfileButton, { backgroundColor: isDarkMode ? colors.border : '#F1F5F9' }]}
                accessibilityRole="button"
                accessibilityLabel="Close profile menu"
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.popupDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => { setShowProfileMenu(false); setShowLanguageModal(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="language-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuText, { color: colors.text }]}>{t('common.language')}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={styles.menuChevron} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => { setShowProfileMenu(false); setShowCurrencyModal(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="cash-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuText, { color: colors.text }]}>{t('common.currency')} ({currency})</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={styles.menuChevron} />
            </TouchableOpacity>

            <View style={[styles.menuRow, styles.themeRow]}>
              <Ionicons name="moon-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuText, { color: colors.text }]}>{t('common.dark_mode')}</Text>
              <Switch
                value={isDarkMode}
                onValueChange={handleThemeToggle}
                thumbColor={colors.primary}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
                style={styles.themeSwitch}
              />
            </View>

            <View style={[styles.popupDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.logoutRow}
              onPress={() => { setShowProfileMenu(false); handleLogout(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={[styles.logoutText, { color: colors.danger }]}>{t('common.sign_out')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={cars}
            keyExtractor={(item) => item.id}
            renderItem={renderCarCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                {globalNotifs.map((notif, index) => (
                  <AnimatedCard
                    key={`global-${index}`}
                    style={[
                      styles.notifBanner,
                      {
                        backgroundColor: isDarkMode ? '#1e293b' : '#F0F9FF',
                        borderColor: isDarkMode ? colors.primary : '#BAE6FD',
                      },
                    ]}
                  >
                    <View style={[styles.notifIconWrapper, { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.12)' }]}>
                      <Ionicons name="megaphone-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.notifTextContainer}>
                      <Text style={[styles.notifTag, { color: colors.primary }]}>{t('home.announcement') || 'Announcement'}</Text>
                      <Text style={[styles.notifMessageText, { color: colors.text }]}>{notif.message}</Text>
                    </View>
                  </AnimatedCard>
                ))}

                {userNotifs.map((notif) => (
                  <AnimatedCard
                    key={notif.id}
                    style={[
                      styles.notifBanner,
                      {
                        backgroundColor: isDarkMode ? '#064e3b' : '#F0FDF4',
                        borderColor: isDarkMode ? colors.success : '#BBF7D0',
                      },
                    ]}
                  >
                    <View style={[styles.notifIconWrapper, { backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.2)' : 'rgba(16, 185, 129, 0.15)' }]}>
                      <Ionicons name="mail-unread-outline" size={20} color={colors.success} />
                    </View>
                    <View style={styles.notifTextContainer}>
                      <Text style={[styles.notifTag, { color: colors.success }]}>{t('home.message') || 'Message'}</Text>
                      <Text style={[styles.notifMessageText, { color: colors.text }]}>{notif.message}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => dismissUserNotif(notif.id)}
                      style={[styles.dismissBtn, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(16, 185, 129, 0.15)' }]}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={16} color={colors.success} />
                    </TouchableOpacity>
                  </AnimatedCard>
                ))}
                
                {cars.length > 0 && (
                  <View style={styles.listHeader}>
                    <View style={styles.summaryContainer}>
                      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.summaryItem}>
                          <Text style={[styles.summaryValue, { color: colors.primary }]}>{cars.length}</Text>
                          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('common.vehicles')}</Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.summaryItem}>
                          <Text style={[styles.summaryValue, { color: colors.primary }]}>{t('common.active')}</Text>
                          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('common.status')}</Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.summaryItem}>
                          <Ionicons name="shield-checkmark-outline" size={24} color={colors.success} />
                          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Secure</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.listTitle, { color: colors.text }]}>{t('home.recent_history')}</Text>
                    <Text style={[styles.listSubtitle, { color: colors.textSecondary }]}>{t('home.manage_garage')}</Text>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconContainer, { backgroundColor: isDarkMode ? '#1e293b' : colors.accentLight }]}>
                  <Ionicons name="car-outline" size={60} color={colors.primary} />
                </View>
                <Text style={[styles.emptyStateText, { color: colors.text }]}>{t('home.empty_title')}</Text>
                <Text style={[styles.emptyStateSubText, { color: colors.textSecondary }]}>{t('home.empty_subtitle')}</Text>
                <AnimatedButton 
                  title={t('common.add_vehicle')} 
                  onPress={() => navigation.navigate('AddCar')}
                  style={{ width: 180, marginTop: 32 }}
                />
              </View>
            }
          />
        )}
      </View>

      {cars.length > 0 && cars.length < (user?.maxVehicles || 5) && (
        <FloatingActionButton onPress={() => navigation.navigate('AddCar')} />
      )}

      <View style={styles.footer}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('About')} 
          style={styles.brandingContainer} 
          activeOpacity={0.7}
        >
          <Text style={[styles.brandingText, { color: colors.textSecondary }]}>⚡ Developed By </Text>
          <Text style={[styles.brandingName, { color: colors.primary }]}>Chaudhry Samie</Text>
        </TouchableOpacity>
        <Text style={[styles.versionText, { color: colors.textSecondary, opacity: 0.5 }]}>v1.0.0</Text>
      </View>

      <SelectionModal
        visible={showCarMenu}
         title={selectedCarForMenu ? t('car_menu.manage_car', { model: selectedCarForMenu.model }) : t('car_menu.dashboard')}
         subtitle={selectedCarForMenu?.name}
         onClose={() => setShowCarMenu(false)}
         options={[
           { 
             label: t('car_menu.dashboard'), 
             icon: 'speedometer-outline', 
             onPress: () => selectedCarForMenu && handleCarPress(selectedCarForMenu) 
           },
           { 
             label: t('car_menu.edit_info'), 
             icon: 'create-outline', 
             onPress: () => selectedCarForMenu && navigation.navigate('AddCar', { car: selectedCarForMenu }) 
           },
           { 
             label: t('car_menu.delete_vehicle'), 
             icon: 'trash-outline', 
             destructive: true, 
             onPress: () => selectedCarForMenu && confirmDelete(selectedCarForMenu) 
           },
         ]}
       />

       <SelectionModal
         visible={confirmDeleteModal.visible}
         title={t('car_menu.are_you_sure')}
         subtitle={t('car_menu.permanent_remove', { name: confirmDeleteModal.car?.name })}
         onClose={() => setConfirmDeleteModal({ visible: false, car: null })}
         options={[
           { 
             label: t('car_menu.confirm_delete'), 
             icon: 'trash', 
             destructive: true, 
             onPress: handleDelete 
           },
         ]}
       />

       <SelectionModal
         visible={showLanguageModal}
         title={t('common.language')}
         subtitle="Select your preferred language"
         onClose={() => setShowLanguageModal(false)}
         options={[
           { label: 'English', icon: 'language-outline', onPress: () => handleLanguageChange('en') },
           { label: 'اردو', icon: 'language-outline', onPress: () => handleLanguageChange('ur') },
           { label: 'العربية (Beta)', icon: 'language-outline', onPress: () => handleLanguageChange('ar') },
           { label: '中文 (Beta)', icon: 'language-outline', onPress: () => handleLanguageChange('zh') },
           { label: '한국어 (Beta)', icon: 'language-outline', onPress: () => handleLanguageChange('ko') },
         ]}
       />

       <SelectionModal
         visible={showCurrencyModal}
         title={t('common.currency') || 'Currency'}
         subtitle={`Current: ${currency}`}
         onClose={() => setShowCurrencyModal(false)}
         options={[
           { label: 'PKR 🇵🇰 (Default)', icon: 'cash-outline', onPress: () => handleCurrencyChange('PKR') },
           { label: 'USD 🇺🇸', icon: 'cash-outline', onPress: () => handleCurrencyChange('USD') },
           { label: 'AED 🇦🇪', icon: 'cash-outline', onPress: () => handleCurrencyChange('AED') },
           { label: 'SAR 🇸🇦', icon: 'cash-outline', onPress: () => handleCurrencyChange('SAR') },
           { label: 'EUR 🇪🇺', icon: 'cash-outline', onPress: () => handleCurrencyChange('EUR') },
           { label: 'Won (₩) 🇰🇷', icon: 'cash-outline', onPress: () => handleCurrencyChange('KRW') },
           { label: 'CNY (¥) 🇨🇳', icon: 'cash-outline', onPress: () => handleCurrencyChange('CNY') },
         ]}
       />

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
  },
  bgDecor1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.4,
    zIndex: -1,
  },
  bgDecor2: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.3,
    zIndex: -1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBtn: {
    padding: 4,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  profilePopup: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : 86,
    right: 16,
    borderRadius: 22,
    padding: 16,
    width: 280,
    ...SHADOWS.medium,
    borderWidth: 1,
  },
  profileModalOverlay: {
    flex: 1,
  },
  profileBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIdentity: {
    flex: 1,
    marginLeft: 12,
  },
  closeProfileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  popupName: {
    ...TYPOGRAPHY.h3,
  },
  popupEmail: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  popupDivider: {
    height: 1,
    marginVertical: 10,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 6,
  },
   logoutText: {
    marginLeft: 12,
    ...TYPOGRAPHY.body,
    fontWeight: '700' as any,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 6,
  },
  menuText: {
    marginLeft: 12,
    ...TYPOGRAPHY.body,
    fontWeight: '600' as any,
  },
  menuChevron: {
    marginLeft: 'auto',
  },
  themeRow: {
    paddingRight: 0,
  },
  themeSwitch: {
    marginLeft: 'auto',
  },
  listHeader: {
    marginTop: 20,
    marginBottom: 16,
    paddingLeft: 4,
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.medium,
    borderWidth: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
  },
  summaryLabel: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
    fontWeight: '600' as any,
  },
  summaryDivider: {
    width: 1,
    height: 30,
  },
  listTitle: {
    ...TYPOGRAPHY.h2,
  },
  listSubtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  listContainer: {
    paddingBottom: 110,
  },
  notifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1.5,
    ...SHADOWS.soft,
  },
  userNotifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1.5,
    ...SHADOWS.soft,
  },
  notifIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifTextContainer: {
    flex: 1,
    paddingRight: 6,
  },
  notifTag: {
    fontSize: 11,
    fontWeight: '700' as any,
    textTransform: 'uppercase' as any,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  notifMessageText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as any,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  carCardContainer: {
    padding: 0,
    marginBottom: 16,
    borderRadius: 24,
  },
  carCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  carImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  carInfo: {
    flex: 1,
  },
  carTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  carName: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700' as any,
  },
  carModel: {
    ...TYPOGRAPHY.caption,
  },
  carSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  specText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    marginLeft: 4,
  },
  specDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  optionsButton: {
    padding: 10,
    marginRight: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateText: {
    ...TYPOGRAPHY.h2,
  },
  emptyStateSubText: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12
  },
  brandingText: {
    ...TYPOGRAPHY.caption,
    marginRight: 4,
  },
  brandingName: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
  },
  versionText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
  },
});
