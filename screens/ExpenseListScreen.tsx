import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { fetchExpensesByCategory, addExpenseToDb, updateExpenseInDb, deleteExpenseFromDb, Expense } from '../services/db';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../context/useStore';
import AnimatedCard from '../components/common/AnimatedCard';
import AnimatedButton from '../components/common/AnimatedButton';
import Header from '../components/common/Header';
import CustomStatusModal from '../components/common/CustomStatusModal';
import CustomConfirmModal from '../components/common/CustomConfirmModal';
import CustomDatePicker from '../components/common/CustomDatePicker';

import { SHADOWS, TYPOGRAPHY } from '../utils/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import { formatDisplayDate, formatDateToISO } from '../utils/dateHelpers';
type ExpenseListRouteProp = RouteProp<RootStackParamList, 'ExpenseList'>;

export default function ExpenseListScreen() {
  const { t } = useTranslation();
  const { currency } = useStore();
  const navigation = useNavigation<any>();
  const route = useRoute<ExpenseListRouteProp>();
  const { colors, isDarkMode } = useThemeColors();
  const { carId, category } = route.params;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
   const [date, setDate] = useState(formatDateToISO(new Date()));
  const [workName, setWorkName] = useState('');
  const [amount, setAmount] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    id: ''
  });

  useEffect(() => {
    loadExpenses();
  }, [carId, category]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await fetchExpensesByCategory(carId, category);
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
       setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('common.fill_fields') });
       return;
     }

    setSaving(true);
    try {
      const expenseData: any = {
        carId,
        category,
        date,
        workName,
        amount: parseFloat(amount),
      };

      if (editingExpenseId) {
        await updateExpenseInDb(editingExpenseId, expenseData);
        setExpenses(expenses.map(exp => exp.id === editingExpenseId ? { ...exp, ...expenseData } : exp));
      } else {
        const saved = await addExpenseToDb(expenseData);
        setExpenses([saved, ...expenses]);
      }

      setModalVisible(false);
      resetForm();
       setStatusModal({
         visible: true,
         type: 'success',
         title: t('common.success'),
         message: editingExpenseId ? t('expense_list.expense_updated') : t('expense_list.expense_logged')
       });
    } catch (error: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setWorkName('');
    setAmount('');
     setDate(formatDateToISO(new Date()));
    setEditingExpenseId(null);
  };

  const handleEditPress = (expense: Expense) => {
    setEditingExpenseId(expense.id || null);
    setWorkName(expense.workName || '');
    setAmount(expense.amount?.toString() || '');
    setDate(expense.date || '');
    setModalVisible(true);
  };

  const handleDeleteExpense = (id: string) => {
    setConfirmModal({ visible: true, id });
  };

  const handleConfirmDelete = async () => {
    const id = confirmModal.id;
    setConfirmModal({ visible: false, id: '' });

    try {
       await deleteExpenseFromDb(id);
       setExpenses(expenses.filter(e => e.id !== id));
       setStatusModal({ visible: true, type: 'success', title: t('common.success'), message: t('common.deleted') });
     } catch (error: any) {
       setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('common.delete_failed') });
     }
  };

  const totalExpense = expenses.reduce((sum, current) => sum + (current.amount || 0), 0);

  const getCategoryTitle = () => {
     switch (category) {
       case 'Mechanical': return t('expense_list.mechanical_title');
       case 'Electrical': return t('expense_list.electrical_title');
       case 'Tax': return t('expense_list.tax_title');
       case 'Other': return t('expense_list.other_title');
       default: return category;
     }
  };

  const renderExpenseItem = ({ item, index }: { item: Expense, index: number }) => (
    <AnimatedCard delay={index * 50} style={[styles.expenseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.expenseIcon, { backgroundColor: isDarkMode ? '#1e293b' : colors.background }]}>
        <Ionicons name="receipt-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.expenseInfo}>
        <Text style={[styles.expenseTitle, { color: colors.text }]} numberOfLines={1}>{item.workName}</Text>
        <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>{formatDisplayDate(item.date)}</Text>
      </View>
      <View style={styles.expenseRight}>
        <Text style={[styles.expenseAmount, { color: colors.text }]}>{currency} {item.amount?.toLocaleString(undefined, { minimumFractionDigits: 0 })}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={() => handleEditPress(item)} style={styles.actionIcon}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => item.id && handleDeleteExpense(item.id)} style={styles.actionIcon}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedCard>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={getCategoryTitle()} />

       <View style={[styles.totalSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
         <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>{t('expense_list.total_label', { category: getCategoryTitle() })}</Text>
         <Text style={[styles.totalAmount, { color: colors.primary }]}>{currency} {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
       </View>

      <View style={styles.listContainer}>
         <View style={styles.listHeader}>
           <Text style={styles.listTitle}>{t('expense_list.recent_history')}</Text>
           <TouchableOpacity
             style={styles.addBtnSmall}
             onPress={() => { resetForm(); setModalVisible(true); }}
             activeOpacity={0.7}
           >
             <Ionicons name="add" size={18} color="#FFF" />
             <Text style={styles.addBtnText}> {t('expense_list.add_record')}</Text>
           </TouchableOpacity>
         </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={expenses}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={renderExpenseItem}
            contentContainerStyle={styles.flatListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={56} color="#CBD5E1" />
                <Text style={styles.emptyText}>{t('expense_list.no_expenses')}</Text>
              </View>
            }
          />
        )}
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent={true} statusBarTranslucent navigationBarTranslucent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
            style={{ flex: 1, justifyContent: 'flex-end' }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>

            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{editingExpenseId ? t('expense_list.edit_expense') : t('expense_list.add_expense')}</Text>
                  <Text style={styles.modalSubtitle}>{getCategoryTitle()}</Text>
                </View>
                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                  <View style={styles.formGroup}>
                    <CustomDatePicker 
                      label={t('common.date')} 
                      value={date} 
                      onChange={setDate} 
                    />
                  </View>
 
                 <View style={styles.formGroup}>
                   <Text style={styles.label}>{category === 'Tax' ? t('expense_list.purpose') : t('expense_list.description')}</Text>
                   <TextInput style={styles.input} placeholder={t('common.placeholder_desc')} value={workName} onChangeText={setWorkName} />
                 </View>
 
                 <View style={styles.formGroup}>
                   <Text style={styles.label}>{t('expense_list.amount_label').replace('(PKR)', `(${currency})`)}</Text>
                   <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={amount} onChangeText={setAmount} />
                 </View>

                <AnimatedButton
                  title={t('expense_list.save_expense')}
                  onPress={handleSaveExpense}
                  loading={saving}
                  style={{ marginTop: 12 }}
                />
              </ScrollView>
              
              {/* Filler to prevent gaps on Android during keyboard transition */}
              <View style={{ height: 600, backgroundColor: '#FFF', position: 'absolute', bottom: -600, left: 0, right: 0 }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <CustomStatusModal
        {...statusModal}
        onClose={() => setStatusModal({ ...statusModal, visible: false })}
      />

      <CustomConfirmModal
        visible={confirmModal.visible}
        title={t('expense_list.delete_title')}
        message={t('expense_list.delete_msg')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmModal({ visible: false, id: '' })}
        confirmText={t('common.delete')}
        type="danger"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  totalSection: {
    padding: 32,
    alignItems: 'center',
    borderBottomWidth: 1,
    ...SHADOWS.soft,
  },
  totalLabel: {
    ...TYPOGRAPHY.label,
    marginBottom: 8
  },
  totalAmount: {
    ...TYPOGRAPHY.h1,
    fontSize: 40,
  },
  listContainer: { flex: 1, padding: 20 },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  listTitle: { ...TYPOGRAPHY.h2 },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    ...SHADOWS.soft,
  },
  addBtnText: { color: '#FFF', ...TYPOGRAPHY.h3, fontSize: 13, marginLeft: 4 },
  flatListContent: { paddingBottom: 40 },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    ...SHADOWS.soft,
  },
  expenseIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  expenseInfo: { flex: 1 },
  expenseTitle: { ...TYPOGRAPHY.h3, fontSize: 16, marginBottom: 4 },
  expenseDate: { ...TYPOGRAPHY.caption },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { ...TYPOGRAPHY.h3 },
  actionRow: { flexDirection: 'row', marginTop: 4 },
  actionIcon: { padding: 4, marginLeft: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { marginTop: 16, ...TYPOGRAPHY.body },

  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '85%',
    ...SHADOWS.medium,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { ...TYPOGRAPHY.h2 },
  modalSubtitle: { ...TYPOGRAPHY.caption, marginTop: 2 },
  formGroup: { marginBottom: 20 },
  label: { ...TYPOGRAPHY.label, marginBottom: 10, marginLeft: 4 },
  input: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    ...TYPOGRAPHY.body,
  },
});
