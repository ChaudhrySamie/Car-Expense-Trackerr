import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList,ScrollView, TextInput, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../App';
import { fetchExpensesByCategory, addExpenseToDb, Expense } from '../services/db';

type ExpenseListRouteProp = RouteProp<RootStackParamList, 'ExpenseList'>;

export default function ExpenseListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ExpenseListRouteProp>();
  const { carId, category } = route.params;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [workName, setWorkName] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    loadExpenses();
  }, [carId, category]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await fetchExpensesByCategory(carId, category);
      // Sort by date descending
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!date || !workName || !amount) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setSaving(true);
    try {
      const newExpense: Expense = {
        carId,
        category,
        date,
        workName,
        amount: parseFloat(amount),
      };
      
      const saved = await addExpenseToDb(newExpense);
      setExpenses([saved, ...expenses]);
      setModalVisible(false);
      
      // Reset form
      setWorkName('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      
    } catch (error: any) {
      Alert.alert('Error saving expense', error.message);
    } finally {
      setSaving(false);
    }
  };

  const totalExpense = expenses.reduce((sum, current) => sum + (current.amount || 0), 0);

  const getCategoryTitle = () => {
    switch (category) {
      case 'Mechanical': return 'Mechanical Work';
      case 'Electrical': return 'Electrical Work';
      case 'Tax': return 'Tax & Document';
      case 'Other': return 'Other Expenses';
      default: return category;
    }
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <View style={styles.expenseCard}>
      <View style={styles.expenseIcon}>
        <Ionicons name="receipt-outline" size={24} color="#0EA5E9" />
      </View>
      <View style={styles.expenseInfo}>
        <Text style={styles.expenseTitle}>{item.workName}</Text>
        <Text style={styles.expenseDate}>{item.date}</Text>
      </View>
      <Text style={styles.expenseAmount}>${item.amount?.toFixed(2)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getCategoryTitle()}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total {getCategoryTitle()}</Text>
        <Text style={styles.totalAmount}>${totalExpense.toFixed(2)}</Text>
      </View>

      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Recent Expenses</Text>
          <TouchableOpacity style={styles.addBtnSmall} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={expenses}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={renderExpenseItem}
            contentContainerStyle={styles.flatListContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No expenses logged yet</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Add Expense Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add {getCategoryTitle()}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={date} onChangeText={setDate} />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>{category === 'Tax' ? 'Purpose' : 'Work / Product Name'}</Text>
                <TextInput style={styles.input} placeholder="e.g. Battery Replacement" value={workName} onChangeText={setWorkName} />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Price ($)</Text>
                <TextInput style={styles.input} placeholder="0.00" keyboardType="numeric" value={amount} onChangeText={setAmount} />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveExpense} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Expense</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  totalSection: {
    backgroundColor: '#FFF', padding: 24, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  totalLabel: { fontSize: 14, color: '#64748B', fontWeight: '500', marginBottom: 8 },
  totalAmount: { fontSize: 36, fontWeight: 'bold', color: '#0EA5E9' },
  listContainer: { flex: 1, padding: 20 },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  listTitle: { fontSize: 18, fontWeight: '600', color: '#1E293B' },
  addBtnSmall: {
    backgroundColor: '#0EA5E9', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  addBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 4, fontSize: 14 },
  flatListContent: { paddingBottom: 40 },
  expenseCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    padding: 16, borderRadius: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  expenseIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0F9FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  expenseInfo: { flex: 1 },
  expenseTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 4 },
  expenseDate: { fontSize: 12, color: '#64748B' },
  expenseAmount: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#94A3B8' },
  // Modal Styles
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 8 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 16, color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#0EA5E9', borderRadius: 12, height: 54,
    justifyContent: 'center', alignItems: 'center', marginTop: 16, marginBottom: 40,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
