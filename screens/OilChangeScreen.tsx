import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Modal, ScrollView, TouchableWithoutFeedback, Keyboard, Dimensions } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../context/useStore';
import { RootStackParamList } from '../App';
import { addExpenseToDb, subscribeToExpensesByCategory, updateExpenseInDb, deleteExpenseFromDb, Expense } from '../services/db';

// Premium Components
import Header from '../components/common/Header';
import AnimatedCard from '../components/common/AnimatedCard';
import AnimatedButton from '../components/common/AnimatedButton';
import CustomStatusModal from '../components/common/CustomStatusModal';
import CustomConfirmModal from '../components/common/CustomConfirmModal';
import CustomDatePicker from '../components/common/CustomDatePicker';

import { SHADOWS, TYPOGRAPHY } from '../utils/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import { formatDisplayDate, formatDateToISO } from '../utils/dateHelpers';
import { getFriendlyDataErrorMessage } from '../utils/authErrors';
type OilChangeRouteProp = RouteProp<RootStackParamList, 'OilChange'>;

export default function OilChangeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<OilChangeRouteProp>();
  const { t } = useTranslation();
  const { currency } = useStore();
  const { colors, isDarkMode } = useThemeColors();
  const { carId } = route.params;
  const category = 'OilChange';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    id: '',
  });

  // Form State
  const [date, setDate] = useState(formatDateToISO(new Date()));
  const [oilType, setOilType] = useState('Engine');
  const [oilGrade, setOilGrade] = useState('');
  const [company, setCompany] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [amount, setAmount] = useState('');
  const [brand, setBrand] = useState('');
  const [viscosity, setViscosity] = useState('');
  const [odometer, setOdometer] = useState('');
  const [filterBrand, setFilterBrand] = useState('');

  const resetForm = () => {
    setOilGrade('');
    setCompany('');
    setCurrentMileage('');
    setAmount('');
    setBrand('');
    setViscosity('');
    setOdometer('');
    setFilterBrand('');
    setDate(formatDateToISO(new Date()));
  };

  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    const unsubscribe = subscribeToExpensesByCategory(carId, category, (data) => {
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [carId]);

  const handleSaveExpense = async () => {
    const isBasicInfoComplete = date && currentMileage && amount;

    if (!isBasicInfoComplete) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('common.error'),
        message: t('oil.missing_info')
      });
      return;
    }

    setSaving(true);
    try {
      const expenseData: any = {
        carId,
        category,
        date,
        oilType,
        oilGrade,
        company,
        currentMileage,
        workName: `${oilType} Oil Change`,
        amount: parseFloat(amount),
        brand,
        viscosity,
        odometer,
        filterBrand
      };

      if (isEditing && editingId) {
        await updateExpenseInDb(editingId, expenseData);
        setStatusModal({ visible: true, type: 'success', title: t('common.success'), message: t('oil.log_updated') });
      } else {
        await addExpenseToDb(expenseData);
        setStatusModal({ visible: true, type: 'success', title: t('common.success'), message: t('oil.log_saved') });
      }

      setModalVisible(false);
      resetForm();
    } catch (error: any) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: getFriendlyDataErrorMessage(error, isEditing ? 'update' : 'save') });
    } finally {
      setSaving(false);
    }
  };

  const handleEditPress = (item: Expense) => {
    setIsEditing(true);
    setEditingId(item.id || null);
    setDate(item.date);
    setOilType(item.oilType || 'Engine');
    setOilGrade(item.oilGrade || '');
    setCompany(item.company || '');
    setCurrentMileage(item.currentMileage || '');
    setAmount(item.amount?.toString() || '');
    setBrand(item.brand || '');
    setViscosity(item.viscosity || '');
    setOdometer(item.odometer?.toString() || '');
    setFilterBrand(item.filterBrand || '');
    setModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (confirmModal.id) {
        await deleteExpenseFromDb(confirmModal.id);
        setConfirmModal({ visible: false, id: '' });
      }
    } catch (error: any) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: getFriendlyDataErrorMessage(error, 'delete') });
    }
  };

  const totalExpense = expenses.reduce((sum, current) => sum + (current.amount || 0), 0);

  const parseMileageNum = (val?: string) => {
    if (!val) return 0;
    const clean = val.replace(/[^0-9]/g, '');
    return parseInt(clean) || 0;
  };

  const engineOils = expenses.filter(e => e.oilType === 'Engine');
  const latestEngineOil = engineOils.length > 0 ? engineOils[0] : null;
  const previousEngineOil = engineOils.length > 1 ? engineOils[1] : null;

  const mileageDiff = (latestEngineOil && previousEngineOil)
    ? parseMileageNum(latestEngineOil.currentMileage) - parseMileageNum(previousEngineOil.currentMileage)
    : 0;

  const getOilColor = (type?: string) => {
    switch (type) {
      case 'Engine': return '#F59E0B';
      case 'Gear': return '#3B82F6';
      case 'Brake': return '#EF4444';
      default: return '#64748B';
    }
  };

  const renderExpenseItem = ({ item, index }: { item: Expense; index: number }) => {
    const nextOfSameType = expenses.slice(index + 1).find(e => e.oilType === item.oilType);
    const interval = nextOfSameType
      ? `${(parseMileageNum(item.currentMileage) - parseMileageNum(nextOfSameType.currentMileage)).toLocaleString()} km`
      : null;

    return (
      <AnimatedCard delay={index * 50} key={item.id || index} style={[styles.expenseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.oilColorTag, { backgroundColor: getOilColor(item.oilType) }]} />
        <View style={styles.expenseInfo}>
          <View style={styles.logHeader}>
            <View style={styles.logMainInfo}>
              <Text style={[styles.logTitle, { color: colors.text }]}>{item.oilType} Oil</Text>
              <View style={styles.logMeta}>
                <Ionicons name="location-outline" size={10} color={colors.textSecondary} />
                <Text style={[styles.logMetaText, { color: colors.textSecondary }]} numberOfLines={1}>{item.brand || item.company || '---'} ({item.viscosity || item.oilGrade || '---'})</Text>
                <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
                <Ionicons name="speedometer-outline" size={10} color={colors.textSecondary} />
                <Text style={[styles.logMetaText, { color: colors.textSecondary }]}>{item.currentMileage?.toLocaleString() || '---'} km</Text>
              </View>
            </View>
            <View style={styles.logPriceSection}>
              <Text style={[styles.logAmount, { color: colors.primary }]}>{currency} {item.amount?.toLocaleString()}</Text>
              <View style={styles.logActions}>
                <TouchableOpacity onPress={() => handleEditPress(item)} style={styles.logActionBtn}>
                  <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmModal({ visible: true, id: item.id || '' })} style={[styles.logActionBtn, { marginLeft: 14 }]}>
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.logFooter}>
            <Text style={[styles.logDate, { color: colors.textSecondary }]}>{formatDisplayDate(item.date)}</Text>
            {interval && (
              <View style={[styles.logIntervalBadge, { backgroundColor: isDarkMode ? '#064e3b' : '#F0FDF4', borderColor: isDarkMode ? '#065f46' : '#DCFCE7' }]}>
                <Ionicons name="trending-up" size={10} color={colors.success} />
                <Text style={[styles.logIntervalText, { color: colors.success }]}>{interval}</Text>
              </View>
            )}
          </View>
        </View>
      </AnimatedCard>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header title={t('oil.title')} onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsContainer}>
          <AnimatedCard style={[styles.statsBox, { backgroundColor: colors.surface, borderColor: colors.border }]} delay={0}>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('oil.total_spent')}</Text>
            <Text style={[styles.statsValue, { color: colors.primary }]}>{currency} {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 0 })} </Text>
          </AnimatedCard>
          <AnimatedCard style={[styles.statsBox, { backgroundColor: colors.surface, borderColor: colors.border }]} delay={100}>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('oil.last_interval')}</Text>
            <Text style={[styles.statsValue, { color: colors.success }]}>{mileageDiff > 0 ? `${mileageDiff.toLocaleString()} km` : '---'}</Text>
          </AnimatedCard>
        </View>

        {latestEngineOil && (
          <AnimatedCard style={[styles.prevOilBox, { backgroundColor: colors.surface, borderColor: colors.border }]} delay={200}>
            <View style={styles.prevHeader}>
              <Ionicons name="water-outline" size={24} color={colors.primary} />
              <Text style={[styles.prevOilTitle, { color: colors.text }]}>{t('oil.current_engine_oil')}</Text>
            </View>
            <View style={styles.prevRow}>
              <View style={styles.prevItem}>
                <Text style={[styles.prevLabel, { color: colors.textSecondary }]}>{t('oil.viscosity')}</Text>
                <Text style={[styles.prevVal, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{latestEngineOil.viscosity || latestEngineOil.oilGrade || '---'}</Text>
              </View>
              <View style={styles.prevItem}>
                <Text style={[styles.prevLabel, { color: colors.textSecondary }]}>{t('oil.brand')}</Text>
                <Text style={[styles.prevVal, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{latestEngineOil.brand || latestEngineOil.company || '---'}</Text>
              </View>
              <View style={styles.prevItem}>
                <Text style={[styles.prevLabel, { color: colors.textSecondary }]}>{t('oil.current_mileage')}</Text>
                <Text style={[styles.prevVal, { color: colors.text }]}>{latestEngineOil.currentMileage?.toLocaleString() || '---'} km</Text>
              </View>
            </View>
          </AnimatedCard>
        )}

        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: colors.text }]}>{t('oil.history')}</Text>
          <TouchableOpacity
            style={styles.addBtnSmall}
            onPress={() => {
              resetForm();
              setIsEditing(false);
              setEditingId(null);
              setModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addBtnText}> {t('oil.add_record')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={expenses}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={renderExpenseItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="water-outline" size={80} color="#CBD5E1" />
                <Text style={styles.emptyText}>{t('oil.no_history')}</Text>
              </View>
            }
          />
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent={true} statusBarTranslucent navigationBarTranslucent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>

            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{isEditing ? t('oil.edit_record') : t('oil.add_log')}</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{t('oil.modal_subtitle')}</Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={styles.formGroup}>
                  <CustomDatePicker label={t('oil.date')} value={date} onChange={setDate} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('oil.type')}</Text>
                  <View style={styles.typeButtons}>
                    {['Engine', 'Gear', 'Brake'].map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.typeBtn, { backgroundColor: colors.background, borderColor: colors.border }, oilType === type && { backgroundColor: getOilColor(type), borderColor: getOilColor(type) }]}
                        onPress={() => setOilType(type)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.typeBtnText, { color: colors.textSecondary }, oilType === type && { color: '#FFF' }]}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('oil.brand')} *</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} maxLength={50} value={brand} onChangeText={setBrand} placeholder="e.g. Shell, Liqui Moly" placeholderTextColor={colors.textSecondary} />
                </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                    <Text style={[styles.label, { color: colors.text }]}>{t('oil.viscosity')}</Text>
                    <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} maxLength={20} value={viscosity} onChangeText={setViscosity} placeholder="5W-30" placeholderTextColor={colors.textSecondary} />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.text }]}>{t('oil.current_mileage')} *</Text>
                    <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" maxLength={8} value={currentMileage} onChangeText={setCurrentMileage} placeholder="0" placeholderTextColor={colors.textSecondary} />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('oil.total_price')}</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" maxLength={9} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.textSecondary} />
                </View>

                <AnimatedButton title={isEditing ? t('oil.update_log') : t('oil.save_log')} onPress={handleSaveExpense} loading={saving} style={{ marginTop: 12 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <CustomStatusModal {...statusModal} onClose={() => setStatusModal({ ...statusModal, visible: false })} />
      <CustomConfirmModal
        visible={confirmModal.visible}
        title={t('oil.delete_title')}
        message={t('oil.delete_msg')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmModal({ visible: false, id: '' })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statsBox: { width: '48%', alignItems: 'center', padding: 20, ...SHADOWS.soft },
  statsLabel: { ...TYPOGRAPHY.label, marginBottom: 8 },
  statsValue: { ...TYPOGRAPHY.h2, fontSize: 22 },
  prevOilBox: { backgroundColor: '#F0FDF4', borderRadius: 28, borderColor: '#DCFCE7', borderWidth: 1.5, padding: 24, marginBottom: 32, ...SHADOWS.soft },
  prevHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  prevOilTitle: { ...TYPOGRAPHY.h3, color: '#166534', marginLeft: 10 },
  prevRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  prevItem: { flex: 1, alignItems: 'flex-start', marginRight: 8, minWidth: '28%' },
  prevLabel: { ...TYPOGRAPHY.caption, color: '#4ADE80', fontWeight: '700', marginBottom: 4 },
  prevVal: { ...TYPOGRAPHY.body, fontWeight: '700', color: '#14532D', fontSize: 13 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  listTitle: { ...TYPOGRAPHY.h2 },
  addBtnSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, ...SHADOWS.soft },
  addBtnText: { color: '#FFF', ...TYPOGRAPHY.h3, fontSize: 13, marginLeft: 6 },
  expenseCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 24, marginBottom: 12, overflow: 'hidden', ...SHADOWS.soft },
  oilColorTag: { width: 6 },
  expenseInfo: { flex: 1, padding: 20 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  logMainInfo: { flex: 1 },
  logTitle: { ...TYPOGRAPHY.h3, fontSize: 16, marginBottom: 4 },
  logMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  logMetaText: { ...TYPOGRAPHY.caption, marginLeft: 3, fontSize: 11, flexShrink: 1 },
  metaDivider: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 8 },
  logPriceSection: { alignItems: 'flex-end', marginLeft: 12 },
  logAmount: { ...TYPOGRAPHY.h3, fontSize: 16 },
  logActions: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  logActionBtn: { padding: 2 },
  logFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  logDate: { ...TYPOGRAPHY.caption },
  logIntervalBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  logIntervalText: { ...TYPOGRAPHY.h3, fontSize: 11, marginLeft: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },


  emptyText: { marginTop: 16, ...TYPOGRAPHY.body, color: '#94A3B8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalContainerWrapper: { width: '100%' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, maxHeight: Dimensions.get('window').height * 0.9, ...SHADOWS.medium },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { ...TYPOGRAPHY.h2 },
  modalSubtitle: { ...TYPOGRAPHY.caption },
  formGroup: { marginBottom: 20 },
  row: { flexDirection: 'row' },
  label: { ...TYPOGRAPHY.label, marginBottom: 10, marginLeft: 4 },
  input: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, height: 56, ...TYPOGRAPHY.body },
  typeButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  typeBtn: { flex: 1, height: 48, borderWidth: 1.5, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  typeBtnText: { ...TYPOGRAPHY.h3, fontSize: 13 },
});
