import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { addCarToDb, updateCarInDb } from '../services/db';
import { useStore, Car } from '../context/useStore';
import { RootStackParamList } from '../App';

// Premium Components
import Header from '../components/common/Header';
import AnimatedButton from '../components/common/AnimatedButton';
import CustomStatusModal from '../components/common/CustomStatusModal';
import { COLORS, SHADOWS, SPACING } from '../utils/theme';

export default function AddCarScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddCar'>>();
  const editCar = route.params?.car;
  const isEdit = !!editCar;

  const user = useStore(state => state.user);
  const setSelectedCar = useStore(state => state.setSelectedCar);

  const [form, setForm] = useState({
    name: editCar?.name || '',
    model: editCar?.model || '',
    year: editCar?.year || '',
   plate: editCar?.plate || '',
    engineCC: editCar?.engineCC || '',
    mileage: editCar?.mileage || '',
    purchasePrice: editCar?.purchasePrice || '',
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
      Alert.alert('Validation Error', 'Please fill the required fields: Name, Model, Year.');
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      if (isEdit && editCar) {
        const updatedCar = await updateCarInDb(editCar.id, {
          userId: user.uid,
          ...form
        });
        setSelectedCar(updatedCar as Car);
      } else {
        const newCar = await addCarToDb({
          userId: user.uid,
          ...form,
        });
        setSelectedCar(newCar as Car);
      }

      setStatusModal({
        visible: true,
        type: 'success',
        title: 'Success!',
        message: isEdit ? 'Vehicle profile updated.' : 'New vehicle added to your garage.'
      });
      
      setTimeout(() => {
        navigation.goBack();
      }, 1500);

    } catch (error: any) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: 'Error',
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={isEdit ? 'Edit Vehicle' : 'Add Vehicle'} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vehicle Details</Text>
            <Text style={styles.sectionSubtitle}>Enter the basic information of your car</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Car Name *</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Honda Civic" 
              placeholderTextColor="#94A3B8"
              value={form.name} 
              onChangeText={(t) => updateForm('name', t)} 
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.label}>Model *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. Oriel" 
                placeholderTextColor="#94A3B8"
                value={form.model} 
                onChangeText={(t) => updateForm('model', t)} 
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Year *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 2022" 
                placeholderTextColor="#94A3B8"
                keyboardType="numeric" 
                value={form.year} 
                onChangeText={(t) => updateForm('year', t)} 
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Number Plate</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. ABC 123" 
              placeholderTextColor="#94A3B8"
              value={form.plate} 
              onChangeText={(t) => updateForm('plate', t)} 
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Technical Info</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.label}>Engine CC</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 1800" 
                placeholderTextColor="#94A3B8"
                keyboardType="numeric" 
                value={form.engineCC} 
                onChangeText={(t) => updateForm('engineCC', t)} 
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Current Mileage</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 15000" 
                placeholderTextColor="#94A3B8"
                keyboardType="numeric" 
                value={form.mileage} 
                onChangeText={(t) => updateForm('mileage', t)} 
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Purchase Price</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 25000" 
              placeholderTextColor="#94A3B8"
              keyboardType="numeric" 
              value={form.purchasePrice} 
              onChangeText={(t) => updateForm('purchasePrice', t)} 
            />
          </View>

          <AnimatedButton 
            title={isEdit ? "Update Vehicle Profile" : "Save Vehicle Profile"}
            onPress={handleSave}
            loading={loading}
            style={{ marginTop: 20 }}
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
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  sectionHeader: {
    marginBottom: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    color: COLORS.text,
  },
});
