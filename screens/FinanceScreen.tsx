import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Modal, ScrollView, Dimensions, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../App';
import { addExpenseToDb, subscribeToExpensesByCategory, updateExpenseInDb, deleteExpenseFromDb, deleteExpensesByCategory, Expense } from '../services/db';

import { useStore } from '../context/useStore';

// Premium Components
import Header from '../components/common/Header';
import AnimatedCard from '../components/common/AnimatedCard';
import AnimatedButton from '../components/common/AnimatedButton';
import AnimatedProgressBar from '../components/common/AnimatedProgressBar';
import CustomStatusModal from '../components/common/CustomStatusModal';
import CustomConfirmModal from '../components/common/CustomConfirmModal';
import CustomDatePicker from '../components/common/CustomDatePicker';

import { SHADOWS, TYPOGRAPHY } from '../utils/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import { formatDisplayDate, formatDateToISO } from '../utils/dateHelpers';
import { getFriendlyDataErrorMessage } from '../utils/authErrors';
const { width } = Dimensions.get('window');
const MAX_LOAN_TENURE_MONTHS = 600;

type FinanceRouteProp = RouteProp<RootStackParamList, 'Finance'>;

export default function FinanceScreen() {
  const { t } = useTranslation();
  const { currency } = useStore();
  const navigation = useNavigation<any>();
  const route = useRoute<FinanceRouteProp>();
  const { carId } = route.params;
  const { colors, isDarkMode } = useThemeColors();

  const [setupDetails, setSetupDetails] = useState<any>(null);
  const [payments, setPayments] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [paymentDeleteConfirmVisible, setPaymentDeleteConfirmVisible] = useState(false);
  const [paymentToDeleteId, setPaymentToDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Setup Flow State
  const [setupStep, setSetupStep] = useState(1); // 1 = Choice, 2 = Details, 3 = Timeline
  const [scenario, setScenario] = useState<'new' | 'existing' | null>(null);

   // Setup Form
   const [totalPrice, setTotalPrice] = useState('');
   const [downPayment, setDownPayment] = useState('');
   const [monthlyInstallment, setMonthlyInstallment] = useState('');
   const [tenureMonths, setTenureMonths] = useState('');
   const [startDate, setStartDate] = useState(formatDateToISO(new Date()));
   const [alreadyPaidMonths, setAlreadyPaidMonths] = useState('0');
 
   // Payment Form
   const [payDate, setPayDate] = useState(formatDateToISO(new Date()));
  const [payAmount, setPayAmount] = useState('');
  const [payType, setPayType] = useState('Monthly Installment');

  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    const unsubscribe = subscribeToExpensesByCategory(carId, 'Finance', (allFinance) => {
      const setup = allFinance.find(e => e.workName === 'Finance_Setup');
      if (setup) {
        setSetupDetails(setup);
        try {
          const config = JSON.parse(setup.purpose || '{}');
          setTotalPrice(config.totalPrice?.toString() || '');
          setDownPayment(config.downPayment?.toString() || '');
          setMonthlyInstallment(config.installment?.toString() || '');
          setTenureMonths(config.tenure?.toString() || '');
           setStartDate(config.startDate || formatDateToISO(new Date()));
          setAlreadyPaidMonths(config.initialPaidMonths?.toString() || '0');
          // FIX: previously `scenario` was never restored from the saved config.
          // This meant re-opening an "existing loan" plan for editing would lose
          // the scenario flag (the "Already Paid Months" field would vanish, and
          // saving again would silently overwrite scenario with null).
          setScenario(config.scenario === 'existing' ? 'existing' : config.scenario === 'new' ? 'new' : null);
        } catch (e) { }
      }

      const history = allFinance.filter(e => e.workName !== 'Finance_Setup');
      history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(history);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [carId]);

  const handleSaveSetup = async () => {
     if (!totalPrice || !downPayment || !monthlyInstallment || !tenureMonths || !startDate) {
       setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('finance.details_required') });
       return;
     }

    const totalPriceNum = parseFloat(totalPrice);
    const downPaymentNum = parseFloat(downPayment);
    const installmentNum = parseFloat(monthlyInstallment);
    const tenureNum = Number(tenureMonths);
    const alreadyPaidMonthsNum = Number(alreadyPaidMonths);

    // FIX: guard against NaN / non-positive values that previously slipped through
    // and could corrupt the stats math (e.g. divide-by-zero, invalid dates).
    if ([totalPriceNum, downPaymentNum, installmentNum, tenureNum, alreadyPaidMonthsNum].some(n => !Number.isFinite(n))) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('finance.details_required') });
      return;
    }
    if (totalPriceNum <= 0 || installmentNum <= 0 || !Number.isInteger(tenureNum) || tenureNum > MAX_LOAN_TENURE_MONTHS) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: `Loan period must be between 1 and ${MAX_LOAN_TENURE_MONTHS} months.` });
      return;
    }
    if (!Number.isInteger(alreadyPaidMonthsNum) || alreadyPaidMonthsNum < 0 || alreadyPaidMonthsNum > tenureNum) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: 'Already paid months cannot be greater than the loan period.' });
      return;
    }
    if (downPaymentNum >= totalPriceNum) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('finance.details_required') });
      return;
    }
    if (isNaN(new Date(startDate).getTime())) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('finance.details_required') });
      return;
    }

    setSaving(true);
    try {
      const principal = totalPriceNum - downPaymentNum;
      const setupPkg = {
        totalPrice: totalPriceNum,
        downPayment: downPaymentNum,
        principal,
        installment: installmentNum,
        tenure: tenureNum,
        startDate,
        initialPaidMonths: alreadyPaidMonthsNum,
        scenario
      };

      const setupExp: Expense = {
        carId,
        category: 'Finance',
         date: formatDateToISO(new Date()),
        workName: 'Finance_Setup',
        amount: principal,
        purpose: JSON.stringify(setupPkg)
      };

      if (setupDetails?.id) {
        await updateExpenseInDb(setupDetails.id, setupExp);
      } else {
        await addExpenseToDb(setupExp);
      }

       setSetupModalVisible(false);
       setStatusModal({ visible: true, type: 'success', title: t('finance.plan_active'), message: t('finance.plan_success_msg') });
    } catch (error: any) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: getFriendlyDataErrorMessage(error, setupDetails?.id ? 'update' : 'save') });
    } finally {
      setSaving(false);
    }
  };

  const [editingPayment, setEditingPayment] = useState<Expense | null>(null);

  const handleLogPayment = async () => {
     if (!payAmount || !payDate) {
       setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('finance.enter_amount_date') });
       return;
     }
    const amountNum = parseFloat(payAmount);
    // FIX: guard against NaN / non-positive payment amounts.
    if (isNaN(amountNum) || amountNum <= 0) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('finance.enter_amount_date') });
      return;
    }
    setSaving(true);
    try {
      const p: Expense = {
        carId,
        category: 'Finance',
        date: payDate,
        workName: payType,
        amount: amountNum
      };

      if (editingPayment?.id) {
        await updateExpenseInDb(editingPayment.id, p);
      } else {
        await addExpenseToDb(p);
      }

      setPaymentModalVisible(false);
      setEditingPayment(null);
      setPayAmount('');
      setStatusModal({
         visible: true,
         type: 'success',
         title: editingPayment ? t('finance.payment_updated') : t('finance.payment_saved'),
         message: t('finance.transaction_processed')
       });
    } catch (err: any) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: getFriendlyDataErrorMessage(err, editingPayment?.id ? 'update' : 'save') });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = (id?: string) => {
    if (!id) return;
    setPaymentToDeleteId(id);
    setPaymentDeleteConfirmVisible(true);
  };

  const handleConfirmDeletePayment = async () => {
    if (!paymentToDeleteId) return;
    const id = paymentToDeleteId;
    setPaymentDeleteConfirmVisible(false);
    setPaymentToDeleteId(null);
    setSaving(true);
    try {
       await deleteExpenseFromDb(id);
       setStatusModal({ visible: true, type: 'success', title: t('common.success'), message: t('finance.transaction_removed') });
    } catch (e: any) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: getFriendlyDataErrorMessage(e, 'delete') });
    } finally {
      setSaving(false);
    }
  };


  const handleReset = () => {
    if (!setupDetails?.id) return;
    setResetConfirmVisible(true);
  };

  const handleConfirmReset = async () => {
    setResetConfirmVisible(false);
    setSaving(true);
    try {
      await deleteExpensesByCategory(carId, 'Finance');
      setSetupDetails(null);
      setSetupModalVisible(false);
      setScenario(null);
       setSetupStep(1);
       setStatusModal({ visible: true, type: 'success', title: t('finance.plan_terminated'), message: t('finance.plan_cleared') });
    } catch (e: any) {
      setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: getFriendlyDataErrorMessage(e, 'delete') });
    } finally {
      setSaving(false);
    }
  };

  // Derived Values
  let stats = {
    totalLoan: 0,
    paidAmount: 0,
    remainingAmount: 0,
    paidMonths: 0,
    totalMonths: 0,
    progress: 0,
    nextPaymentDate: '---',
    expectedEndDate: '---',
    isOverdue: false,
    status: 'Active'
  };

  if (setupDetails) {
    try {
      const cfg = JSON.parse(setupDetails.purpose);
      const manualPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const initialPaidValue = (cfg.initialPaidMonths || 0) * (cfg.installment || 0);
      const installmentAmt = cfg.installment || 1;

      stats.totalLoan = cfg.principal || 0;
      stats.paidAmount = initialPaidValue + manualPaid;
      stats.remainingAmount = Math.max(0, stats.totalLoan - stats.paidAmount);

      const manualMonths = Math.floor(manualPaid / installmentAmt);
      stats.paidMonths = (cfg.initialPaidMonths || 0) + manualMonths;
      stats.totalMonths = cfg.tenure || 0;
      // FIX: guard divide-by-zero when totalLoan is 0 (e.g. down payment == total price)
      stats.progress = stats.totalLoan > 0 ? Math.min(100, (stats.paidAmount / stats.totalLoan) * 100) : 100;

      // Dates
      const startD = new Date(cfg.startDate);
      if (!isNaN(startD.getTime())) {
        const endD = new Date(startD);
        endD.setMonth(endD.getMonth() + stats.totalMonths);
        stats.expectedEndDate = endD.toISOString().split('T')[0];

        const nextD = new Date(startD);
        nextD.setMonth(nextD.getMonth() + stats.paidMonths);
        stats.nextPaymentDate = nextD.toISOString().split('T')[0];

        const now = new Date();
        stats.isOverdue = now > nextD && stats.remainingAmount > 0;
      }

      if (stats.remainingAmount <= 0) stats.status = t('finance.status_completed');
      else if (stats.isOverdue) stats.status = t('finance.status_due');
      else stats.status = t('finance.status_active');

    } catch (e) { }
  }

  const renderHistory = ({ item, index }: { item: Expense, index: number }) => {
    const isExtra = item.workName === 'Extra Payment';

    return (
      <AnimatedCard delay={index * 50} style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]} >
        <TouchableOpacity
          style={styles.historyMain}
          activeOpacity={0.7}
          onPress={() => {
            setEditingPayment(item);
            setPayAmount(item.amount?.toString() || '');
            setPayDate(item.date);
            setPayType(item.workName || 'Monthly Installment');
            setPaymentModalVisible(true);
          }}
        >
           <View style={[styles.historyIcon, { backgroundColor: isExtra ? (isDarkMode ? '#064e3b' : '#ECFDF5') : colors.background }]}>
             <Ionicons
               name={isExtra ? "star" : "receipt"}
               size={20}
               color={isExtra ? colors.success : colors.primary}
             />
           </View>
 
           <View style={styles.historyContent}>
             <Text style={[styles.historyTitle, { color: colors.text }]}>{isExtra ? t('finance.extra_credit') : t('finance.installment')}</Text>
             <View style={styles.historyMeta}>
              <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.historyDate, { color: colors.textSecondary }]}>{formatDisplayDate(item.date)}</Text>
            </View>
          </View>

          <View style={styles.historyRight}>
            <Text style={[styles.historyAmount, { color: colors.text }, isExtra && { color: colors.success }]}>
              {isExtra ? '+' : ''}{currency} {item.amount?.toLocaleString()}
            </Text>
            <View style={styles.historyActions}>
              <TouchableOpacity style={[styles.miniActionBtn, { backgroundColor: colors.background }]} onPress={() => {
                setEditingPayment(item);
                setPayAmount(item.amount?.toString() || '');
                setPayDate(item.date);
                setPayType(item.workName || 'Monthly Installment');
                setPaymentModalVisible(true);
              }}>
                <Ionicons name="pencil" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.miniActionBtn, { marginLeft: 10, backgroundColor: colors.background }]} onPress={() => handleDeletePayment(item.id)}>
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </AnimatedCard>
    );
  };




  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={t('finance.title')} onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : !setupDetails ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: isDarkMode ? '#1e293b' : '#F0F9FF', borderColor: colors.border, borderWidth: 1 }]}>
              <Ionicons name="stats-chart" size={50} color={colors.primary} />
            </View>
             <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('finance.premium_title')}</Text>
             <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{t('finance.premium_subtitle')}</Text>
             <AnimatedButton
               title={t('finance.get_started')}
              onPress={() => {
                setSetupStep(1);
                setSetupModalVisible(true);
              }}
              style={{ width: '80%', marginTop: 20 }}
            />
          </View>
        ) : (
          <>
            {/* Market Level Overview Card */}
            <AnimatedCard style={[styles.premiumCard, { backgroundColor: colors.primary, shadowColor: colors.primary }, stats.status === 'Completed' && { backgroundColor: colors.success, shadowColor: colors.success }] as any}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{stats.status.toUpperCase()}</Text>
                </View>
                <TouchableOpacity style={styles.settingsBtn} onPress={() => { setSetupStep(2); setSetupModalVisible(true); }}>
                  <Ionicons name="options-outline" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>

               <Text style={styles.labelWhite}>{t('finance.remaining_balance')}</Text>
              <Text style={styles.mainValue}>{currency} {stats.remainingAmount.toLocaleString()}</Text>

              <View style={styles.progressBox}>
                 <View style={styles.progressInfo}>
                   <Text style={styles.progText}>{t('finance.loan_repaid')}</Text>
                   <Text style={styles.progVal}>{stats.progress.toFixed(0)}%</Text>
                 </View>
                <AnimatedProgressBar percentage={stats.progress} color="#c8c8c8ff" />
              </View>

              <View style={styles.cardFooter}>
                 <View>
                   <Text style={styles.labelWhiteSmall}>{t('finance.total_loan')}</Text>
                   <Text style={styles.footerVal}>{currency} {stats.totalLoan.toLocaleString()}</Text>
                 </View>
                 <View style={{ alignItems: 'flex-end' }}>
                   <Text style={styles.labelWhiteSmall}>{t('finance.paid_so_far')}</Text>
                   <Text style={styles.footerVal}>{currency} {stats.paidAmount.toLocaleString()}</Text>
                 </View>
              </View>
            </AnimatedCard>

            <View style={styles.statsGrid}>
               <AnimatedCard style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]} delay={100}>
                 <Ionicons name="time-outline" size={22} color={colors.primary} />
                 <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('finance.next_payment')}</Text>
                 <Text style={[styles.statValue, { color: colors.text }, stats.isOverdue && { color: colors.danger }]}>{stats.status === t('finance.status_completed') ? 'None' : stats.nextPaymentDate}</Text>
               </AnimatedCard>
               <AnimatedCard style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]} delay={200}>
                 <Ionicons name="flag-outline" size={22} color={colors.secondary} />
                 <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('finance.completion')}</Text>
                 <Text style={[styles.statValue, { color: colors.text }]}>{stats.expectedEndDate}</Text>
               </AnimatedCard>
            </View>

            <View style={[styles.installmentSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <View style={styles.summaryItem}>
                 <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('finance.monthly_commitment')}</Text>
                 <Text style={[styles.summaryVal, { color: colors.text }]}>
                   {setupDetails ? JSON.parse(setupDetails.purpose).installment.toLocaleString() : '0'}
                 </Text>
               </View>
               <View style={[styles.dividerV, { backgroundColor: colors.border }]} />
               <View style={styles.summaryItem}>
                 <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('finance.months_tracked')}</Text>
                 <Text style={[styles.summaryVal, { color: colors.text }]}>{stats.paidMonths} / {stats.totalMonths}</Text>
               </View>
            </View>

             <View style={styles.sectionHeader}>
               <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('finance.payment_history')}</Text>
               {stats.status !== t('finance.status_completed') && (
                 <TouchableOpacity
                   style={[styles.addLogBtn, { backgroundColor: colors.primary }]}
                   onPress={() => {
                      setPayDate(formatDateToISO(new Date()));
                     setPayType('Monthly Installment');
                     try {
                       setPayAmount(JSON.parse(setupDetails.purpose).installment.toString());
                     } catch (e) { }
                     setPaymentModalVisible(true);
                   }}
                 >
                   <Ionicons name="add" size={18} color="#FFF" />
                   <Text style={styles.addLogText}> {t('finance.add_record')}</Text>
                 </TouchableOpacity>
               )}
             </View>

            <FlatList
              data={payments}
              keyExtractor={(item, idx) => item.id || idx.toString()}
              renderItem={renderHistory}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.innerEmpty}>
                  <Text style={styles.innerEmptyText}>No transactions recorded yet.</Text>
                </View>
              }
              ListFooterComponent={
                 setupDetails ? (
                   <TouchableOpacity style={[styles.footerDeleteBtn, { borderTopColor: colors.border }]} onPress={handleReset}>
                     <Ionicons name="trash-outline" size={16} color={colors.danger} />
                     <Text style={[styles.footerDeleteText, { color: colors.danger }]}>{t('finance.terminate_plan')}</Text>
                   </TouchableOpacity>
                 ) : null
              }
            />
          </>
        )}
      </ScrollView>

      {/* SETUP MODAL (GUIDED) */}
      <Modal visible={setupModalVisible} animationType="slide" transparent={true} statusBarTranslucent navigationBarTranslucent>
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
                   <Text style={[styles.modalTitle, { color: colors.text }]}>{setupDetails ? t('finance.adjust_plan') : t('finance.setup_title')}</Text>
                   <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{setupStep === 1 ? t('finance.step_label') : `Step ${setupStep - 1} of 2`}</Text>
                 </View>
                <TouchableOpacity onPress={() => setSetupModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {setupStep === 1 && (
                  <View style={styles.stepOne}>
                    <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>Welcome! How would you like to start?</Text>
                    <TouchableOpacity
                      style={[styles.scenarioCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                      onPress={() => { setScenario('new'); setSetupStep(2); setAlreadyPaidMonths('0'); }}
                    >
                      <View style={[styles.scenarioIcon, { backgroundColor: isDarkMode ? '#064e3b' : '#F0FDF4' }]}>
                        <Ionicons name="sparkles-outline" size={24} color="#16A34A" />
                      </View>
                       <View style={{ flex: 1 }}>
                         <Text style={[styles.scenarioTitle, { color: colors.text }]}>{t('finance.new_loan')}</Text>
                         <Text style={[styles.scenarioDesc, { color: colors.textSecondary }]}>Brand new finance plan for your car.</Text>
                       </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.border} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.scenarioCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                      onPress={() => { setScenario('existing'); setSetupStep(2); }}
                    >
                      <View style={[styles.scenarioIcon, { backgroundColor: isDarkMode ? '#1e3a8a' : '#EFF6FF' }]}>
                        <Ionicons name="sync-outline" size={24} color="#2563EB" />
                      </View>
                       <View style={{ flex: 1 }}>
                         <Text style={[styles.scenarioTitle, { color: colors.text }]}>{t('finance.existing_loan')}</Text>
                         <Text style={[styles.scenarioDesc, { color: colors.textSecondary }]}>Migrate your current payment history.</Text>
                       </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.border} />
                    </TouchableOpacity>
                  </View>
                )}

                {setupStep === 2 && (
                   <View style={styles.stepDetails}>
                     <View style={styles.formGroup}>
                       <Text style={[styles.inputLabel, { color: colors.text }]}>{t('finance.total_price')}</Text>
                       <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" maxLength={9} value={totalPrice} onChangeText={setTotalPrice} placeholder="Market Price" placeholderTextColor={colors.textSecondary} />
                     </View>
                     <View style={styles.row}>
                       <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                         <Text style={[styles.inputLabel, { color: colors.text }]}>{t('finance.down_payment')}</Text>
                         <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" maxLength={9} value={downPayment} onChangeText={setDownPayment} placeholder="Amount Paid" placeholderTextColor={colors.textSecondary} />
                       </View>
                       <View style={[styles.formGroup, { flex: 1 }]}>
                         <Text style={[styles.inputLabel, { color: colors.text }]}>{t('finance.monthly_emi')}</Text>
                         <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" maxLength={9} value={monthlyInstallment} onChangeText={setMonthlyInstallment} placeholder="Monthly Dues" placeholderTextColor={colors.textSecondary} />
                       </View>
                     </View>
                     <AnimatedButton
                       title="Continue to Timeline"
                       onPress={() => {
                         // FIX: previously this jumped to Step 3 with zero validation,
                         // letting users reach "Finalize" with an invalid down payment
                         // (e.g. down payment >= total price) before ever seeing an error.
                         const tp = parseFloat(totalPrice);
                         const dp = parseFloat(downPayment);
                         const inst = parseFloat(monthlyInstallment);
                         if (!totalPrice || !downPayment || !monthlyInstallment || isNaN(tp) || isNaN(dp) || isNaN(inst)) {
                           setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('finance.details_required') });
                           return;
                         }
                         if (dp >= tp) {
                           setStatusModal({ visible: true, type: 'error', title: t('common.error'), message: t('finance.details_required') });
                           return;
                         }
                         setSetupStep(3);
                       }}
                     />
                    <TouchableOpacity onPress={() => setSetupStep(1)} style={[styles.secondaryBtn, { borderColor: colors.primary }]}>
                      <Ionicons name="arrow-back" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Change Scenario</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {setupStep === 3 && (
                  <View style={styles.stepTimeline}>
                     <View style={styles.row}>
                       <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                         <Text style={[styles.inputLabel, { color: colors.text }]}>{t('finance.loan_period')}</Text>
                         <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" maxLength={3} value={tenureMonths} onChangeText={setTenureMonths} placeholder="Up to 600 months" placeholderTextColor={colors.textSecondary} />
                       </View>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                          <CustomDatePicker 
                            label={t('finance.start_date')} 
                            value={startDate} 
                            onChange={setStartDate} 
                          />
                        </View>
                     </View>

                     {scenario === 'existing' && (
                       <View style={[styles.historyHighlight, { backgroundColor: isDarkMode ? '#172554' : '#EFF6FF', borderColor: isDarkMode ? '#1D4ED8' : '#BFDBFE' }]}>
                         <Text style={[styles.inputLabel, { color: colors.text }]}>{t('finance.already_paid_months')}</Text>
                         <TextInput
                           style={[styles.inputLarge, { backgroundColor: colors.surface, borderColor: colors.primary, color: colors.text }]}
                           keyboardType="numeric"
                           maxLength={3}
                           value={alreadyPaidMonths}
                           onChangeText={setAlreadyPaidMonths}
                           placeholder="0"
                           placeholderTextColor={colors.textSecondary}
                           selectionColor={colors.primary}
                         />
                       </View>
                     )}

                    <View style={styles.setupActionWrapper}>
                      <TouchableOpacity onPress={() => setSetupStep(2)} style={[styles.secondaryBtnSmall, { borderColor: colors.primary }]}>
                        <Ionicons name="arrow-back" size={16} color={colors.primary} />
                      </TouchableOpacity>
                       <AnimatedButton title={t('finance.finalize')} onPress={handleSaveSetup} loading={saving} style={{ flex: 1, marginLeft: 12 }} />
                    </View>

                    {setupDetails && (
                       <TouchableOpacity style={styles.resetPlanBtn} onPress={handleReset} disabled={saving}>
                         <Text style={styles.resetTextLink}>{t('finance.reset_plan')}</Text>
                       </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
              <View style={{ height: 600, backgroundColor: colors.surface, position: 'absolute', bottom: -600, left: 0, right: 0 }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* LOG PAYMENT MODAL */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent={true} statusBarTranslucent navigationBarTranslucent>
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
                   <Text style={[styles.modalTitle, { color: colors.text }]}>{editingPayment ? t('finance.edit_transaction') : t('finance.log_transaction')}</Text>
                   <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{editingPayment ? 'Modify existing record' : 'Monthly payment or extra credit'}</Text>
                 </View>
                <TouchableOpacity onPress={() => { setPaymentModalVisible(false); setEditingPayment(null); }}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                 <View style={[styles.typeSelector, { backgroundColor: colors.background }]}>
                   <TouchableOpacity
                     style={[styles.typeBtn, payType === 'Monthly Installment' && [styles.typeBtnActive, { backgroundColor: colors.primary }]]}
                     onPress={() => setPayType('Monthly Installment')}
                   >
                     <Text style={[styles.typeText, { color: colors.textSecondary }, payType === 'Monthly Installment' && { color: '#FFF' }]}>{t('finance.installment')}</Text>
                   </TouchableOpacity>
                   <TouchableOpacity
                     style={[styles.typeBtn, payType === 'Extra Payment' && [styles.typeBtnActive, { backgroundColor: colors.primary }]]}
                     onPress={() => setPayType('Extra Payment')}
                   >
                     <Text style={[styles.typeText, { color: colors.textSecondary }, payType === 'Extra Payment' && { color: '#FFF' }]}>{t('finance.extra_credit')}</Text>
                   </TouchableOpacity>
                 </View>

                 <View style={styles.formGroup}>
                   <CustomDatePicker 
                     label="Date" 
                     value={payDate} 
                     onChange={setPayDate} 
                   />
                 </View>
                 <View style={styles.formGroup}>
                   <Text style={[styles.inputLabel, { color: colors.text }]}>{t('finance.amount_paid')}</Text>
                   <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" maxLength={9} value={payAmount} onChangeText={setPayAmount} placeholderTextColor={colors.textSecondary} />
                 </View>

                 <AnimatedButton
                   title={editingPayment ? t('finance.update_record') : t('finance.record_payment')}
                   onPress={handleLogPayment}
                   loading={saving}
                   style={{ marginTop: 10 }}
                 />
              </ScrollView>
              <View style={{ height: 600, backgroundColor: colors.surface, position: 'absolute', bottom: -600, left: 0, right: 0 }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <CustomStatusModal {...statusModal} onClose={() => setStatusModal({ ...statusModal, visible: false })} />
       <CustomConfirmModal
         visible={resetConfirmVisible}
         title={t('finance.terminate_confirm_title')}
         message={t('finance.terminate_confirm_msg')}
         onConfirm={handleConfirmReset}
         onCancel={() => setResetConfirmVisible(false)}
       />
       <CustomConfirmModal
         visible={paymentDeleteConfirmVisible}
         title={t('finance.delete_title')}
         message={t('finance.delete_msg')}
         onConfirm={handleConfirmDeletePayment}
         onCancel={() => { setPaymentDeleteConfirmVisible(false); setPaymentToDeleteId(null); }}
       />
    </SafeAreaView>


  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  premiumCard: {
    borderRadius: 32,
    padding: 28,
    marginBottom: 24,
    ...SHADOWS.medium,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  settingsBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  labelWhite: { ...TYPOGRAPHY.label, color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  labelWhiteSmall: { ...TYPOGRAPHY.label, color: 'rgba(255,255,255,0.6)', fontSize: 10, marginBottom: 4 },
  mainValue: { ...TYPOGRAPHY.h1, color: '#FFF', fontSize: 34, marginVertical: 4 },
  progressBox: { marginVertical: 24 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  progVal: { color: '#FFF', fontWeight: '800' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 20 },
  footerVal: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statBox: { width: '48%', borderRadius: 24, padding: 20, alignItems: 'center' },
  statLabel: { ...TYPOGRAPHY.caption, marginTop: 8 },
  statValue: { ...TYPOGRAPHY.h3, fontSize: 15, marginTop: 4 },
  installmentSummary: { flexDirection: 'row', borderRadius: 24, padding: 20, marginBottom: 32, ...SHADOWS.soft, alignItems: 'center', borderWidth: 1.5 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { ...TYPOGRAPHY.caption, marginBottom: 4, textAlign: 'center' },
  summaryVal: { ...TYPOGRAPHY.h3, fontSize: 18 },
  dividerV: { width: 1, height: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { ...TYPOGRAPHY.h2 },
  addLogBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  addLogText: { color: '#FFF', fontWeight: '700', fontSize: 13, marginLeft: 6 },
  historyCard: { borderRadius: 20, marginBottom: 12, ...SHADOWS.soft, padding: 0, borderWidth: 1 },
  historyMain: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  historyIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  historyContent: { flex: 1, marginLeft: 12 },
  historyTitle: { ...TYPOGRAPHY.h3, fontSize: 14, fontWeight: '700' },
  historyMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  historyDate: { ...TYPOGRAPHY.caption, marginLeft: 4, fontSize: 11 },
  historyRight: { alignItems: 'flex-end' },
  historyAmount: { ...TYPOGRAPHY.h3, fontWeight: '800', fontSize: 14 },
  historyActions: { flexDirection: 'row', marginTop: 6 },
  miniActionBtn: { padding: 4, borderRadius: 8 },
  actionLogBtn: { padding: 8, marginLeft: 2 },
  footerDeleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 24, marginTop: 12, borderTopWidth: 1 },
  footerDeleteText: { fontWeight: '700', fontSize: 13, marginLeft: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100, padding: 30 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { ...TYPOGRAPHY.h2, textAlign: 'center' },
  emptySubtitle: { ...TYPOGRAPHY.body, textAlign: 'center', marginTop: 12, paddingHorizontal: 20 },
  innerEmpty: { paddingVertical: 40, alignItems: 'center' },
  innerEmptyText: { color: '#94A3B8', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalContainerWrapper: { width: '100%' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, maxHeight: Dimensions.get('window').height * 0.9, ...SHADOWS.medium },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  modalTitle: { ...TYPOGRAPHY.h1, fontSize: 24 },
  modalSubtitle: { ...TYPOGRAPHY.caption, marginTop: 2 },
  stepOne: { paddingBottom: 20 },
  stepLabel: { ...TYPOGRAPHY.body, marginBottom: 24 },
  scenarioCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1 },
  scenarioIcon: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  scenarioTitle: { ...TYPOGRAPHY.h3, fontSize: 16 },
  scenarioDesc: { ...TYPOGRAPHY.caption, marginTop: 2 },
  stepDetails: { paddingBottom: 20 },
  formGroup: { marginBottom: 24 },
  inputLabel: { ...TYPOGRAPHY.label, fontSize: 12, marginBottom: 10, marginLeft: 4 },
  input: { paddingHorizontal: 16, height: 56, borderRadius: 16, borderWidth: 1.5, ...TYPOGRAPHY.body },
  inputLarge: { paddingHorizontal: 16, height: 64, borderRadius: 16, borderWidth: 2, ...TYPOGRAPHY.h2, textAlign: 'center' },
  row: { flexDirection: 'row' },
  backBtnModal: { padding: 16, alignItems: 'center' },
  backBtnText: { fontWeight: '600', textDecorationLine: 'underline' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 8, borderRadius: 16, borderWidth: 1 },
  secondaryBtnSmall: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontWeight: '700', fontSize: 14 },
  historyHighlight: { padding: 24, borderRadius: 24, marginBottom: 24, borderWidth: 1 },
  setupActionWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  resetPlanBtn: { padding: 20, borderTopWidth: 1, marginTop: 20, alignItems: 'center' },
  resetTextLink: { fontWeight: '700', fontSize: 13 },
  stepTimeline: { paddingBottom: 20 },
  typeSelector: { flexDirection: 'row', borderRadius: 16, padding: 6, marginBottom: 24 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  typeBtnActive: { ...SHADOWS.soft },
  typeText: { fontWeight: '700', fontSize: 13 }
});
