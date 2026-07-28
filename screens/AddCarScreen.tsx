import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { addCarToDb, updateCarInDb, updateUserActivity } from '../services/db';
import { db } from '../services/firebase';
import { useStore, Car } from '../context/useStore';
import { RootStackParamList } from '../App';

// Premium Components
import Header from '../components/common/Header';
import AnimatedButton from '../components/common/AnimatedButton';
import CustomStatusModal from '../components/common/CustomStatusModal';
import { SHADOWS, TYPOGRAPHY } from '../utils/theme';
import { useThemeColors } from '../hooks/useThemeColors';

const MAX_MILEAGE_KM = 10_000_000;
const MAX_PURCHASE_PRICE = 100_000_000;
const MAX_ENGINE_CC = 20_000;

export default function AddCarScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddCar'>>();
  const editCar = route.params?.car;
  const isEdit = !!editCar;

  const { user, cars, setSelectedCar, currency } = useStore();
  const { colors } = useThemeColors();

  const [form, setForm] = useState({
    name: editCar?.name || '',
    model: editCar?.model || '',
    year: editCar?.year || '',
    plate: editCar?.plate || '',
    engineCC: editCar?.engineCC || '',
    mileage: editCar?.mileage || '',
    purchasePrice: editCar?.purchasePrice || '',
    type: editCar?.type || 'car',
  });

  const [loading, setLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  const updateForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name || !form.model || !form.year) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('common.error'),
        message: t('common.fill_fields', { defaultValue: 'Please complete the vehicle name, model, and year.' })
      });
      return;
    }

    const year = Number(form.year);
    const engineCC = form.engineCC ? Number(form.engineCC) : 0;
    const mileage = form.mileage ? Number(form.mileage) : 0;
    const purchasePrice = form.purchasePrice ? Number(form.purchasePrice) : 0;

    if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: 'Enter a valid 4-digit manufacturing year.' });
      return;
    }
    if (form.engineCC && (!Number.isFinite(engineCC) || engineCC <= 0 || engineCC > MAX_ENGINE_CC)) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: `Engine capacity must be between 1 and ${MAX_ENGINE_CC.toLocaleString()} cc.` });
      return;
    }
    if (form.mileage && (!Number.isFinite(mileage) || mileage < 0 || mileage > MAX_MILEAGE_KM)) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: `Mileage must be between 0 and ${MAX_MILEAGE_KM.toLocaleString()} km.` });
      return;
    }
    if (form.purchasePrice && (!Number.isFinite(purchasePrice) || purchasePrice <= 0 || purchasePrice > MAX_PURCHASE_PRICE)) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: `Purchase price must be between 1 and ${MAX_PURCHASE_PRICE.toLocaleString()}.` });
      return;
    }

    if (!user) return;

    // Always read the limit live from DB so admin changes take effect immediately
    if (!isEdit) {
      let vehicleLimit = 5;
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        vehicleLimit = userDoc.data()?.maxVehicles || 5;
      } catch (_) {}
      if (cars.length >= vehicleLimit) {
        setStatusModal({
          visible: true,
          type: 'error',
          title: t('add_car.limit_reached'),
          message: t('add_car.limit_msg', { limit: vehicleLimit }),
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (isEdit && editCar) {
        const updatedCar = await updateCarInDb(editCar.id, {
          userId: user.uid,
          ...form
        });
        setSelectedCar(updatedCar as Car);
        updateUserActivity(user.uid, `Edited Vehicle: ${form.name}`);
      } else {
        const newCar = await addCarToDb({
          userId: user.uid,
          ...form,
        });
        setSelectedCar(newCar as Car);
        updateUserActivity(user.uid, `Added Vehicle: ${form.name}`);
      }

      setStatusModal({
        visible: true,
        type: 'success',
        title: t('common.success'),
        message: isEdit ? t('add_car.success_update') : t('add_car.success_add')
      });
      
      setTimeout(() => {
        navigation.goBack();
      }, 1500);

    } catch (error: any) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('common.error'),
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label: string, value: string, key: string, placeholder: string, keyboardType: any = 'default', half: boolean = false, maxLength?: number) => (
    <View style={[styles.formGroup, half && { flex: 1 }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput 
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} 
        placeholder={placeholder} 
        placeholderTextColor={colors.textSecondary}
        value={value} 
        onChangeText={(t) => updateForm(key, t)} 
        keyboardType={keyboardType}
        maxLength={maxLength}
        selectionColor={colors.primary}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header title={isEdit ? t('add_car.edit_title') : t('add_car.add_title')} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={[styles.container, { backgroundColor: colors.background }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('add_car.section_details')}</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('add_car.details_subtitle')}</Text>
          </View>

          <View style={styles.typeSelectorContainer}>
            <Text style={[styles.label, { color: colors.text }]}>{t('add_car.type_label')}</Text>
            <View style={styles.typeButtonsRow}>
              <TouchableOpacity
                style={[styles.typeButton, { backgroundColor: colors.surface, borderColor: colors.border }, form.type === 'car' && [styles.typeButtonActive, { borderColor: colors.primary, backgroundColor: colors.accentLight }]]}
                onPress={() => updateForm('type', 'car')}
              >
                <Text style={[styles.typeButtonText, { color: colors.textSecondary }, form.type === 'car' && [styles.typeButtonTextActive, { color: colors.primary }]]}>{t('add_car.type_car')} 🚗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, { backgroundColor: colors.surface, borderColor: colors.border }, form.type === 'bike' && [styles.typeButtonActive, { borderColor: colors.primary, backgroundColor: colors.accentLight }], { marginRight: 0 }]}
                onPress={() => updateForm('type', 'bike')}
              >
                <Text style={[styles.typeButtonText, { color: colors.textSecondary }, form.type === 'bike' && [styles.typeButtonTextActive, { color: colors.primary }]]}>{t('add_car.type_bike')} 🏍️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {renderInput(t('add_car.name_label'), form.name, 'name', 'e.g. Honda Civic', 'default', false, 40)}
          
          <View style={styles.row}>
            {renderInput(t('add_car.model_label'), form.model, 'model', 'e.g. Oriel', 'default', true, 30)}
            <View style={{ width: 16 }} />
            {renderInput(t('add_car.year_label'), form.year, 'year', 'e.g. 2022', 'numeric', true, 4)}
          </View>

          {renderInput(t('add_car.plate_label'), form.plate, 'plate', 'e.g. ABC 123', 'default', false, 15)}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('add_car.section_technical')}</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('add_car.technical_subtitle')}</Text>
          </View>

          <View style={styles.row}>
            {renderInput(t('add_car.engine_cc'), form.engineCC, 'engineCC', 'e.g. 1800', 'numeric', true, 5)}
            <View style={{ width: 16 }} />
            {renderInput(t('add_car.mileage_label'), form.mileage, 'mileage', 'e.g. 15000 km', 'numeric', true, 8)}
          </View>

          {renderInput(t('add_car.price_label').replace('(PKR)', `(${currency})`), form.purchasePrice, 'purchasePrice', 'e.g. 2500000', 'numeric', false, 9)}

          <AnimatedButton 
            title={isEdit ? t('add_car.update_btn') : t('add_car.add_btn')}
            onPress={handleSave}
            loading={loading}
            style={{ marginTop: 24, marginBottom: 40 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomStatusModal 
        {...statusModal} 
        onClose={() => setStatusModal({ ...statusModal, visible: false })} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  typeSelectorContainer: {
    marginBottom: 24,
  },
  typeButtonsRow: {
    flexDirection: 'row',
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 12,
    ...SHADOWS.soft,
  },
  typeButtonActive: {
  },
  typeButtonText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    fontWeight: '700',
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  sectionHeader: {
    marginBottom: 20,
    marginTop: 8,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    ...TYPOGRAPHY.label,
    marginBottom: 10,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 58,
    ...TYPOGRAPHY.body,
    ...SHADOWS.soft,
  },
});
