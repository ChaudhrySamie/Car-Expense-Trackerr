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
import AnimatedProgressBar from '../components/common/AnimatedProgressBar';
import CustomStatusModal from '../components/common/CustomStatusModal';
import { COLORS, SHADOWS, SPACING } from '../utils/theme';

type FinanceRouteProp = RouteProp<RootStackParamList, 'Finance'>;

export default function FinanceScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<FinanceRouteProp>();
  const { carId } = route.params;

  const [setupDetails, setSetupDetails] = useState<any>(null);
  const [payments, setPayments] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Setup Form
  const [totalAmount, setTotalAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() + 3)).toISOString().split('T')[0]);
  const [paidInitially, setPaidInitially] = useState('0');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');

  // Payment Form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState('Monthly Installment');
  const [amount, setAmount] = useState('');

  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    const unsubscribe = subscribeToExpensesByCategory(carId, 'Finance', (allFinance) => {
      const setups = allFinance.filter(e => e.workName === 'Finance_Setup');
      if (setups.length > 0) {
        setSetupDetails(setups[0]); // Take the latest setup
      }
      
      const p = allFinance.filter(e => e.workName !== 'Finance_Setup');
      p.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(p);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [carId]);

  const handleSaveSetup = async () => {
    if (!totalAmount || !startDate || !endDate || !monthlyInstallment) {
      Alert.alert('Error', 'Please fill all required setup fields');
      return;
    }
    
    // Calculate duration in months
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

    if (diffMonths <= 0) {
      setStatusModal({ visible: true, type: 'error', title: 'Invalid Dates', message: 'End date must be after Start date' });
      return;
    }

    setSaving(true);
    try {
      const setupExp: Expense = {
        carId,
        category: 'Finance',
        date: new Date().toISOString().split('T')[0],
        workName: 'Finance_Setup',
        amount: parseFloat(totalAmount),
        purpose: JSON.stringify({
          startDate,
          endDate,
          duration: diffMonths,
          paidInitially: parseInt(paidInitially) || 0,
          installment: parseFloat(monthlyInstallment)
        })
      };
      await addExpenseToDb(setupExp);
      setSetupModalVisible(false);
      setStatusModal({ visible: true, type: 'success', title: 'Setup Saved', message: 'Your finance plan has been configured.' });
    } catch (error: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    if (!amount || !date || !purpose) {
      Alert.alert('Error', 'Please fill all payment fields');
      return;
    }
    setSaving(true);
    try {
      const p: Expense = {
        carId,
        category: 'Finance',
        date,
        workName: purpose,
        amount: parseFloat(amount)
      };
      await addExpenseToDb(p);
      setPaymentModalVisible(false);
      setAmount('');
      setStatusModal({ visible: true, type: 'success', title: 'Payment Logged', message: 'Transaction recorded successfully.' });
    } catch(err: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Calculations
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  let estimatedEndDate = 'N/A';
  let remainingAmount = 0;
  let remainingInstallments = 0;
  let currentMonthIndex = 0;
  let totalMonths = 0;

  let isCompleted = false;

  if (setupDetails && setupDetails.purpose) {
    try {
      const data = JSON.parse(setupDetails.purpose);
      totalMonths = data.duration;
      const initialPaidValue = (data.paidInitially || 0) * data.installment;
      const actualTotalPaid = totalPaid + initialPaidValue;
      remainingAmount = setupDetails.amount - actualTotalPaid;
      
      currentMonthIndex = (data.paidInitially || 0) + payments.length;
      remainingInstallments = data.duration - currentMonthIndex;
      estimatedEndDate = data.endDate || 'N/A';
      isCompleted = actualTotalPaid >= setupDetails.amount || currentMonthIndex >= totalMonths;
      
      // Store this for display
      (setupDetails as any).actualTotalPaid = actualTotalPaid;
    } catch(e) {}
  }

  const renderPayment = ({ item, index }: { item: Expense, index: number }) => (
    <AnimatedCard delay={index * 100} style={styles.paymentCard}>
      <View style={[styles.paymentIcon, { backgroundColor: COLORS.accentLight }]}>
        <Ionicons name="checkmark-circle" size={24} color={COLORS.secondary} />
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.paymentTitle}>{item.workName}</Text>
        <Text style={styles.paymentDate}>{item.date}</Text>
      </View>
      <Text style={[styles.paymentAmount, { color: COLORS.text }]}>${item.amount?.toFixed(2)}</Text>
    </AnimatedCard>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Finance Tracking" />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.secondary} style={{ marginTop: 40 }} />
        ) : !setupDetails ? (
           <View style={styles.emptyState}>
             <Ionicons name="cash-outline" size={80} color="#CBD5E1" />
             <Text style={styles.emptyText}>No finance plan found</Text>
             <AnimatedButton 
               title="Setup Finance Plan" 
               onPress={() => setSetupModalVisible(true)}
               style={{ width: 220, marginTop: 24 }}
               type="secondary"
             />
           </View>
        ) : (
          <>
            {/* Overview Card */}
            <AnimatedCard style={[styles.overviewCard, isCompleted ? { backgroundColor: COLORS.success } : null] as any}>
              <View style={styles.rowBetween}>
                <Text style={styles.overviewLabel}>{isCompleted ? '🎊 Goal Achieved!' : 'Total Financed'}</Text>
                <Text style={styles.overviewVal}>${setupDetails.amount?.toLocaleString()}</Text>
              </View>
              
              <View style={styles.progressSection}>
                <AnimatedProgressBar 
                  percentage={Math.min(100, (((setupDetails as any).actualTotalPaid || 0) / setupDetails.amount) * 100)}
                  color={isCompleted ? '#FFF' : COLORS.success}
                />
              </View>

              <View style={styles.rowBetween}>
                 <Text style={[styles.paidText, isCompleted && { color: '#FFF', opacity: 0.9 }]}>Paid: ${((setupDetails as any).actualTotalPaid || 0).toLocaleString()}</Text>
                 <Text style={[styles.remText, isCompleted && { color: '#FFF' }]}>{isCompleted ? 'NO DUES' : `Rem: $${remainingAmount.toLocaleString()}`}</Text>
              </View>
            </AnimatedCard>

            {/* Details Grid */}
            <View style={styles.gridContainer}>
               <AnimatedCard style={styles.gridBox} delay={200}>
                 <Text style={styles.gridLabel}>Month Snapshot</Text>
                 <Text style={styles.gridVal}>{currentMonthIndex} / {totalMonths}</Text>
                 <Text style={styles.gridSubVal}>months completed</Text>
               </AnimatedCard>
               <AnimatedCard style={styles.gridBox} delay={300}>
                 <Text style={styles.gridLabel}>End Date</Text>
                 <Text style={styles.gridVal}>{estimatedEndDate}</Text>
                 <Text style={styles.gridSubVal}>estimated</Text>
               </AnimatedCard>
            </View>

            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Payment History</Text>
              {!isCompleted && (
                <TouchableOpacity style={styles.addBtnSmall} onPress={() => setPaymentModalVisible(true)}>
                  <Ionicons name="add" size={20} color="#FFF" />
                  <Text style={styles.addBtnText}>Log New</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={payments}
              keyExtractor={(item, idx) => item.id || idx.toString()}
              renderItem={renderPayment}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: COLORS.textSecondary, marginTop: 20 }}>No payments logged yet</Text>
              }
            />
          </>
        )}
      </ScrollView>

      {/* Modals and Alert */}
      <CustomStatusModal 
        {...statusModal} 
        onClose={() => setStatusModal({ ...statusModal, visible: false })} 
      />

      {/* Setup Finance Modal */}
      <Modal visible={setupModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Finance Setup</Text>
              <TouchableOpacity onPress={() => setSetupModalVisible(false)}><Ionicons name="close" size={24} color="#64748B"/></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2024-01-01" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="2027-01-01" />
              </View>
              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                   <Text style={styles.label}>Total Finance ($)</Text>
                   <TextInput style={styles.input} keyboardType="numeric" value={totalAmount} onChangeText={setTotalAmount} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                   <Text style={styles.label}>Already Paid</Text>
                   <TextInput style={styles.input} keyboardType="numeric" value={paidInitially} onChangeText={setPaidInitially} />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Monthly Installment ($)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={monthlyInstallment} onChangeText={setMonthlyInstallment} />
              </View>
              <AnimatedButton 
                title="Save Plan" 
                onPress={handleSaveSetup} 
                loading={saving}
                type="secondary"
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Log Payment</Text>
                <Text style={styles.modalSubtitle}>Record a new installment</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}><Ionicons name="close" size={24} color="#64748B"/></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Date</Text>
                <TextInput style={styles.input} value={date} onChangeText={setDate} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Purpose</Text>
                <TextInput style={styles.input} value={purpose} onChangeText={setPurpose} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Amount ($)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} />
              </View>
              <AnimatedButton 
                title="Confirm Payment" 
                onPress={handleSavePayment} 
                loading={saving}
                type="secondary"
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
  overviewCard: { backgroundColor: COLORS.secondary, padding: 24, borderRadius: 32, marginBottom: 20, ...SHADOWS.medium, shadowColor: COLORS.secondary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overviewLabel: { color: '#EBE0FF', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  overviewVal: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  progressSection: { marginVertical: 20 },
  paidText: { color: '#D8B4FE', fontSize: 14, fontWeight: '600' },
  remText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  gridContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  gridBox: { width: '48%', borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  gridLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: '600' },
  gridVal: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  gridSubVal: { fontSize: 10, color: '#94A3B8', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '600', marginTop: 16 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  listTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  addBtnSmall: { backgroundColor: COLORS.secondary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, ...SHADOWS.soft, shadowColor: COLORS.secondary },
  addBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
  paymentCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 12, alignItems: 'center', ...SHADOWS.soft },
  paymentIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  paymentInfo: { flex: 1 },
  paymentTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  paymentDate: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  paymentAmount: { fontSize: 18, fontWeight: '800' },
  // Modal Styles
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  modalSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginLeft: 4 },
  input: { backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 16, height: 56, fontSize: 16, color: COLORS.text },
  row: { flexDirection: 'row' },
});
