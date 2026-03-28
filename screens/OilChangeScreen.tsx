import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Modal, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../App';
import { addExpenseToDb, subscribeToExpensesByCategory, Expense } from '../services/db';

// Premium Components
import Header from '../components/common/Header';
import AnimatedCard from '../components/common/AnimatedCard';
import AnimatedButton from '../components/common/AnimatedButton';
import CustomStatusModal from '../components/common/CustomStatusModal';
import { COLORS, SHADOWS, SPACING } from '../utils/theme';

type OilChangeRouteProp = RouteProp<RootStackParamList, 'OilChange'>;

export default function OilChangeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<OilChangeRouteProp>();
  const { carId } = route.params;
  const category = 'OilChange';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [oilType, setOilType] = useState('Engine'); // Engine, Gear, Brake
  const [oilGrade, setOilGrade] = useState('');
  const [company, setCompany] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [amount, setAmount] = useState('');

  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    const unsubscribe = subscribeToExpensesByCategory(carId, category, (data) => {
      // Sort by date descending
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [carId]);

  const handleSaveExpense = async () => {
    if (!date || !oilType || !oilGrade || !company || !currentMileage || !amount) {
      setStatusModal({ visible: true, type: 'error', title: 'Missing Info', message: 'Please fill all fields to log the change.' });
      return;
    }

    setSaving(true);
    try {
      const newExpense: Expense = {
        carId,
        category,
        date,
        oilType,
        oilGrade,
        company,
        currentMileage,
        workName: `${oilType} Oil Change`,
        amount: parseFloat(amount),
      };
      
      await addExpenseToDb(newExpense);
      setModalVisible(false);
      
      // Reset form
      setOilGrade('');
      setCompany('');
      setCurrentMileage('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);

      setStatusModal({ visible: true, type: 'success', title: 'Logger Updated', message: 'Oil change has been recorded.' });
      
    } catch (error: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const totalExpense = expenses.reduce((sum, current) => sum + (current.amount || 0), 0);

  // Helper to parse mileage safely (handles commas/spaces)
  const parseMileageNum = (val?: string) => {
    if (!val) return 0;
    const clean = val.replace(/[^0-9]/g, '');
    return parseInt(clean) || 0;
  };

  // Previous oil logic (assume expenses are sorted by latest date first)
  const engineOils = expenses.filter(e => e.oilType === 'Engine');
  const latestEngineOil = engineOils.length > 0 ? engineOils[0] : null;
  const previousEngineOil = engineOils.length > 1 ? engineOils[1] : null;

  const mileageDiff = (latestEngineOil && previousEngineOil) 
    ? parseMileageNum(latestEngineOil.currentMileage) - parseMileageNum(previousEngineOil.currentMileage) 
    : 0;

  // Function to get interval for a specific item in the list
  const getInterval = (item: Expense, index: number) => {
    if (item.oilType !== 'Engine') return null;
    
    // Find the next older engine oil change
    const olderEngineOils = expenses.slice(index + 1).filter(e => e.oilType === 'Engine');
    if (olderEngineOils.length > 0) {
      const diff = parseMileageNum(item.currentMileage) - parseMileageNum(olderEngineOils[0].currentMileage);
      return diff > 0 ? `+${diff.toLocaleString()} km` : null;
    }
    return null;
  };

  const getOilColor = (type?: string) => {
    switch(type) {
      case 'Engine': return '#F59E0B'; // Amber
      case 'Gear': return '#3B82F6';   // Blue
      case 'Brake': return '#EF4444';  // Red
      default: return '#64748B';
    }
  };

  const renderExpenseItem = ({ item, index }: { item: Expense, index: number }) => (
    <AnimatedCard delay={index * 100} style={styles.expenseCard}>
      <View style={[styles.oilColorTag, { backgroundColor: getOilColor(item.oilType) }]} />
      <View style={styles.expenseInfo}>
        <View style={styles.rowBetween}>
          <Text style={styles.expenseTitle}>{item.oilType} Oil ({item.oilGrade})</Text>
          <Text style={[styles.expenseAmount, { color: COLORS.text }]}>${item.amount?.toFixed(2)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.companyText}>{item.company} • {item.currentMileage} km</Text>
          {item.oilType === 'Engine' && (
            <Text style={styles.intervalText}>{getInterval(item, expenses.indexOf(item))}</Text>
          )}
        </View>
        <Text style={styles.expenseDate}>{item.date}</Text>
      </View>
    </AnimatedCard>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Oil Change Log" />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsContainer}>
          <AnimatedCard style={styles.totalBox}>
            <Text style={styles.statsLabel}>Total Spent</Text>
            <Text style={[styles.totalAmount, { color: COLORS.secondary }]}>${totalExpense.toFixed(2)}</Text>
          </AnimatedCard>
          
          <AnimatedCard style={styles.diffBox}>
            <Text style={styles.statsLabel}>Mileage Driven</Text>
            <Text style={[styles.diffAmount, { color: COLORS.success }]}>
              {mileageDiff > 0 ? `${mileageDiff.toLocaleString()} km` : '0 km'}
            </Text>
            <Text style={styles.statsSubLabel}>
              {engineOils.length < 2 ? 'Add 2nd log to see diff' : 'since last Engine oil'}
            </Text>
          </AnimatedCard>
        </View>

        {previousEngineOil && (
          <AnimatedCard style={styles.prevOilBox} delay={200}>
            <Text style={styles.prevOilTitle}>Previous Engine Oil Details</Text>
            <View style={styles.prevRow}>
              <View style={styles.prevItem}>
                <Text style={styles.prevLabel}>Grade</Text>
                <Text style={styles.prevVal}>{previousEngineOil.oilGrade}</Text>
              </View>
              <View style={styles.prevItem}>
                <Text style={styles.prevLabel}>Company</Text>
                <Text style={styles.prevVal}>{previousEngineOil.company}</Text>
              </View>
              <View style={styles.prevItem}>
                <Text style={styles.prevLabel}>At Mileage</Text>
                <Text style={styles.prevVal}>{previousEngineOil.currentMileage} km</Text>
              </View>
            </View>
          </AnimatedCard>
        )}

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Service History</Text>
          <TouchableOpacity style={styles.addBtnSmall} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.addBtnText}>Log Service</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={expenses}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={renderExpenseItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="water-outline" size={80} color="#CBD5E1" />
                <Text style={styles.emptyText}>No changes logged yet</Text>
              </View>
            }
          />
        )}
      </ScrollView>

      <CustomStatusModal 
        {...statusModal} 
        onClose={() => setStatusModal({ ...statusModal, visible: false })} 
      />

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Log Service</Text>
                <Text style={styles.modalSubtitle}>Enter oil change details</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color="#64748B"/></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={date} onChangeText={setDate} />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Oil Type</Text>
                <View style={styles.typeButtons}>
                  {['Engine', 'Gear', 'Brake'].map(type => (
                    <TouchableOpacity 
                      key={type} 
                      style={[styles.typeBtn, oilType === type && { backgroundColor: getOilColor(type), borderColor: getOilColor(type) }]}
                      onPress={() => setOilType(type)}
                    >
                      <Text style={[styles.typeBtnText, oilType === type && { color: '#FFF' }]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                  <Text style={styles.label}>Oil Grade</Text>
                  <TextInput style={styles.input} placeholder="e.g. 10W-40" value={oilGrade} onChangeText={setOilGrade} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Company</Text>
                  <TextInput style={styles.input} placeholder="e.g. Shell" value={company} onChangeText={setCompany} />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                  <Text style={styles.label}>Mileage (km)</Text>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={currentMileage} onChangeText={setCurrentMileage} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Price ($)</Text>
                  <TextInput style={styles.input} placeholder="0.00" keyboardType="numeric" value={amount} onChangeText={setAmount} />
                </View>
              </View>

              <AnimatedButton 
                title="Save Log" 
                onPress={handleSaveExpense} 
                loading={saving}
                type="primary"
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20, paddingBottom: 60 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  totalBox: { flex: 1, marginRight: 10, alignItems: 'center' },
  diffBox: { flex: 1, alignItems: 'center' },
  statsLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalAmount: { fontSize: 24, fontWeight: '800' },
  diffAmount: { fontSize: 24, fontWeight: '800' },
  statsSubLabel: { fontSize: 10, color: '#94A3B8', marginTop: 4, textAlign: 'center', fontWeight: '500' },
  prevOilBox: { backgroundColor: '#F0FDF4', borderRadius: 24, borderColor: '#DCFCE7', borderWidth: 1, padding: 20, marginBottom: 24 },
  prevOilTitle: { fontSize: 15, fontWeight: '800', color: '#166534', marginBottom: 16 },
  prevRow: { flexDirection: 'row', justifyContent: 'space-between' },
  prevItem: { alignItems: 'flex-start' },
  prevLabel: { fontSize: 11, color: '#4ADE80', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  prevVal: { fontSize: 14, fontWeight: '700', color: '#14532D' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  listTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  addBtnSmall: { backgroundColor: COLORS.success, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, ...SHADOWS.soft, shadowColor: COLORS.success },
  addBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
  expenseCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, marginBottom: 12, overflow: 'hidden', ...SHADOWS.soft },
  oilColorTag: { width: 6 },
  expenseInfo: { flex: 1, padding: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  expenseTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  companyText: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 },
  expenseAmount: { fontSize: 18, fontWeight: '800' },
  expenseDate: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  intervalText: { fontSize: 12, fontWeight: '800', color: COLORS.success },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 16, fontSize: 18, color: '#94A3B8', fontWeight: '600' },
  
  // Modal
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  modalSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  formGroup: { marginBottom: 20 },
  row: { flexDirection: 'row' },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginLeft: 4 },
  input: { backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 16, height: 56, fontSize: 16, color: COLORS.text },
  typeButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  typeBtn: { flex: 1, height: 44, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  typeBtnText: { color: COLORS.textSecondary, fontWeight: '700' },
});
