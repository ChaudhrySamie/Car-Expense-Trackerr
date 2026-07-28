import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard, Dimensions } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { subscribeToExpensesByCategory, addExpenseToDb, updateExpenseInDb, deleteExpenseFromDb, Expense } from '../services/db';
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
import { getFriendlyDataErrorMessage } from '../utils/authErrors';
type FuelRouteProp = RouteProp<RootStackParamList, 'Fuel'>;

export default function FuelScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<FuelRouteProp>();
  const { t } = useTranslation();
  const { currency } = useStore();
  const { colors, isDarkMode } = useThemeColors();
  const { carId } = route.params;

  const [fuelLogs, setFuelLogs] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
   const [date, setDate] = useState(formatDateToISO(new Date()));
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [odometer, setOdometer] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

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
    const unsubscribe = subscribeToExpensesByCategory(carId, 'Fuel', (data) => {
      const sorted = data.sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (b.odometer || 0) - (a.odometer || 0);
      });
      setFuelLogs(sorted);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [carId]);

  const handlePriceCalc = (l: string, p: string) => {
    setLiters(l);
    setPricePerLiter(p);
    if (l && p) {
      const total = parseFloat(l) * parseFloat(p);
      setTotalPrice(total.toFixed(0));
    }
  };

  const handleSaveFuel = async () => {
     if (!date || !liters || !totalPrice || !odometer) {
       setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: 'Please fill all mandatory fields (*)' });
       return;
     }

    setSaving(true);
    try {
      const fuelData: Expense = {
        carId,
        category: 'Fuel',
        date,
        workName: `Fuel Fill-up (${liters}L)`,
        amount: parseFloat(totalPrice),
        liters: parseFloat(liters),
        pricePerLiter: pricePerLiter ? parseFloat(pricePerLiter) : undefined,
        odometer: parseFloat(odometer),
        isFullTank: isFullTank,
      };

      if (editingLogId) {
        await updateExpenseInDb(editingLogId, fuelData);
      } else {
        await addExpenseToDb(fuelData);
      }

      setModalVisible(false);
      resetForm();
       setStatusModal({
         visible: true,
         type: 'success',
         title: t('common.success'),
         message: editingLogId ? t('fuel.log_updated') : t('fuel.log_saved')
       });
    } catch (error: any) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: getFriendlyDataErrorMessage(error, editingLogId ? 'update' : 'save') });
    } finally {
      setSaving(false);
    }
  };

  const handleEditPress = (item: Expense) => {
    setEditingLogId(item.id!);
    setDate(item.date);
    setLiters(item.liters?.toString() || '');
    setPricePerLiter(item.pricePerLiter?.toString() || '');
    setTotalPrice(item.amount.toString());
    setOdometer(item.odometer?.toString() || '');
    setIsFullTank(!!item.isFullTank);
    setModalVisible(true);
  };

  const resetForm = () => {
     setDate(formatDateToISO(new Date()));
    setLiters('');
    setPricePerLiter('');
    setTotalPrice('');
    setOdometer('');
    setIsFullTank(true);
    setEditingLogId(null);
  };

  const handleDeleteLog = (id: string) => {
    setConfirmModal({ visible: true, id });
  };

  const handleConfirmDelete = async () => {
    const id = confirmModal.id;
    setConfirmModal({ visible: false, id: '' });
    try {
       await deleteExpenseFromDb(id);
       setStatusModal({ visible: true, type: 'success', title: 'Deleted', message: 'Log removed' });
    } catch (error) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', message: 'Failed to delete' });
    }
  };

  /**
   * FIXED: calculateStats
   * ---------------------
   * Bug (original): mileage/efficiency used ONLY `current.liters` — the liters
   * of the current full-tank entry — while ignoring any PARTIAL fills that
   * happened between the current full tank and the previous full tank.
   * This overstated mileage whenever a partial top-off occurred in between.
   *
   * Fix: accumulate liters (and cost) across every entry from the current
   * full-tank fill back to (and including) the previous full-tank fill,
   * including any partial fills sandwiched in between. That total represents
   * everything actually burned to cover the distance travelled.
   */
  const calculateStats = (index: number) => {
    const current = fuelLogs[index];
    if (!current.isFullTank) return null;

    let previous: Expense | null = null;
    let litersSinceLastFull = current.liters || 0;
    let amountSinceLastFull = current.amount || 0;

    for (let i = index + 1; i < fuelLogs.length; i++) {
      if (fuelLogs[i].isFullTank) {
        previous = fuelLogs[i];
        break;
      }
      // Accumulate any partial fill-ups that happened between the two full tanks
      litersSinceLastFull += fuelLogs[i].liters || 0;
      amountSinceLastFull += fuelLogs[i].amount || 0;
    }

    if (!previous || !current.odometer || !previous.odometer || litersSinceLastFull <= 0) return null;

    const kmTravelled = current.odometer - previous.odometer;
    if (kmTravelled <= 0) return null;

    const mileage = kmTravelled / litersSinceLastFull; // km/l (now includes partial-fill liters)
    const efficiency = (litersSinceLastFull / kmTravelled) * 100; // l/100km
    const costPerKm = amountSinceLastFull / kmTravelled; // now includes partial-fill cost too

    return { mileage, efficiency, costPerKm, kmTravelled, litersSinceLastFull };
  };

  const hasLogs = fuelLogs.length > 0;
  const firstLog = hasLogs ? fuelLogs[fuelLogs.length - 1] : null;
  const lastLog = hasLogs ? fuelLogs[0] : null;
  // Note: the oldest log's liters are intentionally excluded here — that fill
  // only established the starting odometer/tank baseline and wasn't "consumed"
  // within the totalKm window being measured. This part was already correct.
  const totalLiters = fuelLogs.reduce((acc, curr, idx) => idx === fuelLogs.length - 1 ? acc : acc + (curr.liters || 0), 0);
  const totalKm = (lastLog?.odometer && firstLog?.odometer) ? lastLog.odometer - firstLog.odometer : 0;
  const avgMileage = (totalKm > 0 && totalLiters > 0) ? totalKm / totalLiters : 0;
  const totalSpend = fuelLogs.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
       <Header title={t('fuel.title')} onBackPress={() => navigation.goBack()} />

      <FlatList
        data={fuelLogs}
        renderItem={({ item, index }) => {
          const stats = calculateStats(index);
          return (
            <AnimatedCard delay={index * 50} style={[styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <View style={styles.logHeader}>
                 <View style={{ flex: 1 }}>
                    <Text style={[styles.logDate, { color: colors.textSecondary }]}>
                      {formatDisplayDate(item.date)} {item.isFullTank && <Text style={{ color: colors.success, fontWeight: '700' }}>• {t('fuel.full_tank')}</Text>}
                    </Text>
                    <Text style={[styles.logTitle, { color: colors.text }]}>{t('fuel.liters_count', { count: item.liters })}</Text>
                 </View>
                 <View style={styles.priceContainer}>
                   <Text style={[styles.logAmount, { color: colors.primary }]}>{currency} {item.amount.toLocaleString()}</Text>
                   <View style={styles.actionRow}>
                     <TouchableOpacity onPress={() => handleEditPress(item)} style={styles.actionBtn}>
                       <Ionicons name="pencil-sharp" size={18} color={colors.primary} />
                     </TouchableOpacity>
                     <TouchableOpacity onPress={() => handleDeleteLog(item.id!)} style={[styles.actionBtn, { marginLeft: 12 }]}>
                       <Ionicons name="trash-outline" size={18} color={colors.danger} />
                     </TouchableOpacity>
                   </View>
                 </View>
               </View>

               <View style={[styles.divider, { backgroundColor: colors.border }]} />

               <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('fuel.odometer')}</Text>
                    <Text style={[styles.detailVal, { color: colors.text }]}>{item.odometer?.toLocaleString()} km</Text>
                  </View>
                  {item.pricePerLiter && (
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('fuel.rate_per_liter')}</Text>
                      <Text style={[styles.detailVal, { color: colors.text }]}>{currency} {item.pricePerLiter}</Text>
                    </View>
                  )}
               </View>

               {stats && (
                 <View style={[styles.statsContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#F8FAFC' }]}>
                   <View style={styles.statBox}>
                     <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
                     <Text style={[styles.statVal, { color: colors.text }]}>{stats.mileage.toFixed(1)} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>km/l</Text></Text>
                   </View>
                   <View style={styles.statBox}>
                     <Ionicons name="leaf-outline" size={16} color={colors.success} />
                     <Text style={[styles.statVal, { color: colors.text }]}>{stats.efficiency.toFixed(1)} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>l/100k</Text></Text>
                   </View>
                   <View style={styles.statBox}>
                     <Ionicons name="cash-outline" size={16} color={colors.warning} />
                     <Text style={[styles.statVal, { color: colors.text }]}>{stats.costPerKm.toFixed(1)} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>/km</Text></Text>
                   </View>
                 </View>
               )}
            </AnimatedCard>
          );
        }}
        keyExtractor={(item) => item.id!}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
             <View style={[styles.totalSection, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]}>
               <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>{t('fuel.total_spend')}</Text>
               <Text style={[styles.totalAmount, { color: colors.text }]}>{currency} {totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
             </View>

             <View style={styles.summaryGrid}>
               <AnimatedCard style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]}>
                 <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('fuel.avg_mileage')}</Text>
                 <Text style={[styles.summaryVal, { color: colors.text }]}>{avgMileage.toFixed(1)} <Text style={[styles.summaryUnit, { color: colors.textSecondary }]}>km/l</Text></Text>
               </AnimatedCard>
               <AnimatedCard style={[styles.summaryCard, { backgroundColor: colors.primary }] as any}>
                 <Text style={[styles.summaryLabel, { color: '#FFF' }]}>{t('fuel.total_km')}</Text>
                 <Text style={[styles.summaryVal, { color: '#FFF' }]}>{totalKm.toLocaleString()}</Text>
               </AnimatedCard>
             </View>

             <View style={styles.listHeader}>
               <Text style={[styles.listTitle, { color: colors.text }]}>{t('fuel.history')}</Text>
               <TouchableOpacity
                 style={[styles.addBtnSmall, { backgroundColor: colors.primary }]}
                 onPress={() => { resetForm(); setModalVisible(true); }}
                 activeOpacity={0.7}
               >
                 <Ionicons name="add" size={20} color="#FFF" />
                 <Text style={styles.addBtnText}> {t('fuel.add_record')}</Text>
               </TouchableOpacity>
             </View>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="speedometer-outline" size={80} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No fuel logs yet</Text>
            </View>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          )
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>

            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                 <View>
                   <Text style={[styles.modalTitle, { color: colors.text }]}>{editingLogId ? t('fuel.edit_refuel') : t('fuel.refuel_log')}</Text>
                   <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Update your fuel records</Text>
                 </View>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                 <View style={styles.formGroup}>
                   <CustomDatePicker 
                     label="Date *" 
                     value={date} 
                     onChange={setDate} 
                   />
                 </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>{t('fuel.refill_type')} *</Text>
                    <View style={[styles.refillTypeRow, { backgroundColor: colors.background, padding: 4, borderRadius: 18 }]}>
                      <TouchableOpacity
                        onPress={() => setIsFullTank(false)}
                        style={[styles.refillOpt, !isFullTank ? { backgroundColor: colors.primary } : { backgroundColor: 'transparent' }]}
                      >
                        <Ionicons name="water-outline" size={18} color={!isFullTank ? '#FFF' : colors.textSecondary} />
                        <Text style={[styles.refillOptText, { color: !isFullTank ? '#FFF' : colors.textSecondary }]}>{t('fuel.partial')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setIsFullTank(true)}
                        style={[styles.refillOpt, isFullTank ? { backgroundColor: colors.primary } : { backgroundColor: 'transparent' }]}
                      >
                        <Ionicons name="color-fill-outline" size={18} color={isFullTank ? '#FFF' : colors.textSecondary} />
                        <Text style={[styles.refillOptText, { color: isFullTank ? '#FFF' : colors.textSecondary }]}>{t('fuel.full_tank')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                    <Text style={[styles.label, { color: colors.text }]}>Liters *</Text>
                    <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} keyboardType="numeric" maxLength={6} value={liters} onChangeText={(val) => handlePriceCalc(val, pricePerLiter)} placeholder="0.0" placeholderTextColor={colors.textSecondary} />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.text }]}>Rate/Ltr</Text>
                    <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} keyboardType="numeric" maxLength={6} value={pricePerLiter} onChangeText={(val) => handlePriceCalc(liters, val)} placeholder="Optional" placeholderTextColor={colors.textSecondary} />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Total Price ({currency}) *</Text>
                  <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} keyboardType="numeric" maxLength={9} value={totalPrice} onChangeText={setTotalPrice} placeholder="Auto or Manual" placeholderTextColor={colors.textSecondary} />
                </View>

                 <View style={styles.formGroup}>
                   <Text style={[styles.label, { color: colors.text }]}>{t('fuel.odometer')} (km) *</Text>
                   <View style={[styles.inputWithIcon, { backgroundColor: colors.background, borderColor: colors.border }]}>
                     <Ionicons name="speedometer-outline" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                     <TextInput style={[styles.inputFlex, { color: colors.text }]} keyboardType="numeric" maxLength={8} value={odometer} onChangeText={setOdometer} placeholder="Current reading" placeholderTextColor={colors.textSecondary} />
                   </View>
                 </View>

                  <AnimatedButton
                    title={editingLogId ? t('fuel.update_log') : t('fuel.save_log')}
                    onPress={handleSaveFuel}
                    loading={saving}
                    style={{ marginTop: 12 }}
                  />
               </ScrollView>
               <View style={{ height: 600, backgroundColor: colors.surface, position: 'absolute', bottom: -600, left: 0, right: 0 }} />
             </View>
           </KeyboardAvoidingView>
         </View>
       </Modal>

      <CustomStatusModal {...statusModal} onClose={() => setStatusModal({ ...statusModal, visible: false })} />
       <CustomConfirmModal
         visible={confirmModal.visible}
         title={t('fuel.delete_title')}
         message={t('fuel.delete_msg')}
         onConfirm={handleConfirmDelete}
         onCancel={() => setConfirmModal({ visible: false, id: '' })}
       />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  listContent: { padding: 20 },
  totalSection: { borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 20, ...SHADOWS.soft },
  totalLabel: { ...TYPOGRAPHY.label, marginBottom: 8 },
  totalAmount: { ...TYPOGRAPHY.h1, fontSize: 32 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  summaryCard: { flex: 1, padding: 16, borderRadius: 24, marginHorizontal: 6, alignItems: 'center', ...SHADOWS.soft },
  summaryLabel: { ...TYPOGRAPHY.caption, marginBottom: 4 },
  summaryVal: { ...TYPOGRAPHY.h2 },
  summaryUnit: { fontSize: 12, fontWeight: '400' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  listTitle: { ...TYPOGRAPHY.h3 },
  addBtnSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, ...SHADOWS.soft },
  addBtnText: { color: '#FFF', fontWeight: '700', marginLeft: 6 },
  logCard: { borderRadius: 24, padding: 20, marginBottom: 16, ...SHADOWS.soft },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logDate: { ...TYPOGRAPHY.caption },
  logTitle: { ...TYPOGRAPHY.h3, marginTop: 2 },
  priceContainer: { alignItems: 'flex-end' },
  logAmount: { ...TYPOGRAPHY.h3 },
  actionRow: { flexDirection: 'row', marginTop: 8 },
  actionBtn: { padding: 4 },
  divider: { height: 1, marginVertical: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailItem: { flex: 1 },
  detailLabel: { ...TYPOGRAPHY.caption },
  detailVal: { ...TYPOGRAPHY.body, fontWeight: '700', marginTop: 2 },
  statsContainer: { flexDirection: 'row', marginTop: 16, borderRadius: 12, padding: 12, justifyContent: 'space-around' },
  statBox: { alignItems: 'center', flexDirection: 'row' },
  statVal: { ...TYPOGRAPHY.caption, fontWeight: '700', marginLeft: 6 },
  statUnit: { fontWeight: '400', fontSize: 11 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { marginTop: 16, ...TYPOGRAPHY.body },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalContainerWrapper: { width: '100%' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: Dimensions.get('window').height * 0.9, ...SHADOWS.medium },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { ...TYPOGRAPHY.h2 },
  modalSubtitle: { ...TYPOGRAPHY.body, fontSize: 14 },
  formGroup: { marginBottom: 20 },
  label: { ...TYPOGRAPHY.label, marginBottom: 10, marginLeft: 4 },
  input: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, height: 56, ...TYPOGRAPHY.body },
  row: { flexDirection: 'row' },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, height: 56 },
  inputFlex: { flex: 1, ...TYPOGRAPHY.body },
  refillTypeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  refillOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 16, marginHorizontal: 4 },
  refillOptActive: {},
  refillOptText: { fontWeight: '700', marginLeft: 8 },
});
