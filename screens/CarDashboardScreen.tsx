import React, { useEffect, useState } from 'react';
import {  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,  Platform, Alert  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';

import { RootStackParamList } from '../App';
import { useStore, Car } from '../context/useStore';
import { getCarById, subscribeToExpensesByCar } from '../services/db';
import { exportVehicleReport } from '../utils/exportReport';
import { getOrGenerateMonthlySummary, forceRegenerateMonthlySummary } from '../utils/monthlyAiSummary';
import { calculateHealthScore, HealthScoreResult } from '../utils/vehicleHealthScore';

// Premium Components
import Header from '../components/common/Header';
import AnimatedCard from '../components/common/AnimatedCard';
import AnimatedProgressBar from '../components/common/AnimatedProgressBar';
import CustomStatusModal from '../components/common/CustomStatusModal';
import { SHADOWS, TYPOGRAPHY } from '../utils/theme';
import { useThemeColors } from '../hooks/useThemeColors';

type CarDashboardRouteProp = RouteProp<RootStackParamList, 'CarDashboard'>;

export default function CarDashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<CarDashboardRouteProp>();
  const { carId } = route.params;
   const { t } = useTranslation();
   const { selectedCar, currency } = useStore();
   const { colors, isDarkMode } = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [financials, setFinancials] = useState({
    totalPaid: 0,
    upcoming: 0,
    overallTotal: 0,
    breakdown: [] as any[]
  });
  
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [healthScore, setHealthScore] = useState<HealthScoreResult | null>(null);

  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });
  // Session guard: only fetch AI once per screen open, not on every expense update
  const hasFetchedAiRef = React.useRef(false);
  // Keep latest expenses accessible to the AI effect without re-running it
  const latestExpensesRef = React.useRef<any[]>([]);

  useEffect(() => {
    let unsubscribeExpenses: () => void;

    const setupSubscriptions = async () => {
      setLoading(true);
      const freshCar = await getCarById(carId);
      if (freshCar) {
        useStore.getState().setSelectedCar(freshCar as Car);
      }

      unsubscribeExpenses = subscribeToExpensesByCar(carId, (expenses) => {
        const setup = expenses.find(e => e.workName === 'Finance_Setup');
        const financePayments = expenses.filter(e => e.category === 'Finance' && e.workName !== 'Finance_Setup');
        const paymentsTotal = financePayments.reduce((sum, e) => sum + (e.amount || 0), 0);

        let downPayment = 0;
        let initialPaidValue = 0;
        let principal = 0;
        let totalPrice = 0;

        if (setup) {
          try {
            const data = JSON.parse(setup.purpose || '{}');
            totalPrice = data.totalPrice || 0;
            downPayment = data.downPayment || 0;
            principal = data.principal || 0;
            initialPaidValue = (data.initialPaidMonths || 0) * (data.installment || 0);
          } catch (e) {
            principal = setup.amount || 0;
          }
        }

        const totalPaidFinance = setup ? (downPayment + initialPaidValue + paymentsTotal) : 0;
        const upcomingFinance = setup ? Math.max(0, principal - initialPaidValue - paymentsTotal) : 0;

        const others = expenses.filter(e => e.category !== 'Finance');
        const totalPaidOthers = others.reduce((sum, e) => sum + (e.amount || 0), 0);

        const totalPaidSoFar = totalPaidOthers + totalPaidFinance;
        const overallLifecycleTotal = totalPaidSoFar;

        const catMap: Record<string, number> = {};
        if (totalPaidFinance > 0 || upcomingFinance > 0) {
          catMap['Finance'] = totalPaidFinance;
        }
        others.forEach(exp => {
          catMap[exp.category] = (catMap[exp.category] || 0) + (exp.amount || 0);
        });

        const breakdownArray = Object.keys(catMap).map(cat => ({
          label: cat,
          amount: catMap[cat],
          percentage: overallLifecycleTotal > 0 ? (catMap[cat] / overallLifecycleTotal) * 100 : 0
        })).sort((a, b) => b.amount - a.amount);

        setFinancials({
          totalPaid: totalPaidSoFar,
          upcoming: upcomingFinance,
          overallTotal: overallLifecycleTotal,
          breakdown: breakdownArray
        });

        // ── Vehicle Health Score (read-only, derived from already-fetched expenses) ──
        try {
          const oilChangeLogs = expenses.filter((e: any) => e.category === 'OilChange');
          const lastOilChange = oilChangeLogs.length > 0
            ? oilChangeLogs.sort((a: any, b: any) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                return dateB - dateA;
              })[0]
            : null;
          const lastOilChangeOdometer = lastOilChange
            ? (Number(lastOilChange.odometer || lastOilChange.currentMileage || lastOilChange.mileage || 0) || null)
            : null;

          const car = useStore.getState().selectedCar as any;
          const currentOdometer = Number(car?.mileage || 0);

          const financeIsActive = !!setup;
          const financePaymentsList = expenses.filter((e: any) => e.category === 'Finance' && e.workName !== 'Finance_Setup');
          const missedOrLateEmiCount = financePaymentsList.filter((e: any) => e.status === 'Overdue').length;

          const hasFuelLogs = expenses.some((e: any) => e.category === 'Fuel');
          const hasExpenseLogs = expenses.some((e: any) =>
            !['Finance', 'Fuel', 'OilChange'].includes(e.category) && e.workName !== 'Finance_Setup'
          );
          const hasServiceLogs = expenses.some((e: any) => e.category === 'OilChange');

          const now = new Date();
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          const activeMonths = new Set<string>();
          expenses.forEach((exp: any) => {
            if (!exp.date) return;
            const d = new Date(exp.date);
            if (d >= threeMonthsAgo) {
              activeMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
            }
          });
          const monthsWithActivityInLast3 = Math.min(3, activeMonths.size);

          const result = calculateHealthScore({
            lastOilChangeOdometer,
            currentOdometer,
            oilChangeIntervalKm: 5000,
            documents: [],
            financeIsActive,
            missedOrLateEmiCount,
            hasFuelLogs,
            hasExpenseLogs,
            hasServiceLogs,
            monthsWithActivityInLast3,
          });
          setHealthScore(result);
        } catch (e) {
          // silently skip — health score failure must never affect the rest of the dashboard
        }

        // Always keep the latest expenses available for the AI effect
        latestExpensesRef.current = expenses;
        setLoading(false);
      });
    };

    setupSubscriptions();
    return () => { if (unsubscribeExpenses) unsubscribeExpenses(); };
  }, [carId]);

  // Separate effect: fetch AI summary ONCE per screen open, never on expense updates
  useEffect(() => {
    if (hasFetchedAiRef.current) return; // already fetched this session
    hasFetchedAiRef.current = true;

    const userId = useStore.getState().user?.uid || '';
    const carName = (selectedCar as any)?.name || '';
    if (!userId || !carName) return;

    setAiLoading(true);
    // Wait briefly so the subscription has time to populate latestExpensesRef
    const timer = setTimeout(() => {
      getOrGenerateMonthlySummary(
        userId,
        carId,
        carName,
        latestExpensesRef.current,
        currency,
        t('common.currency'),
        (cur, total, mol) => t('dashboard.fallback_summary', { currency: cur, totalSpent: total, moreOrLess: mol }),
        t('dashboard.more'),
        t('dashboard.less')
      ).then(res => setAiSummary(res))
       .catch(err => console.error('AI Summary Error:', err))
       .finally(() => setAiLoading(false));
    }, 1500);

    return () => clearTimeout(timer);
  }, [carId]); // only re-runs if you navigate to a different car

   const categories = [
     { id: 'Mechanical', label: t('categories.Mechanical'), icon: 'construct-outline', color: '#6366F1', screen: 'ExpenseList' },
     { id: 'Electrical', label: t('categories.Electrical'), icon: 'flash-outline', color: '#F59E0B', screen: 'ExpenseList' },
     { id: 'BodyWork', label: t('categories.BodyWork'), icon: 'brush-outline', color: '#EC4899', screen: 'ExpenseList' },
     { id: 'Fuel', label: t('categories.Fuel'), icon: 'speedometer-outline', color: '#F97316', screen: 'Fuel' },
     { id: 'OilChange', label: t('categories.OilChange'), icon: 'water-outline', color: '#10B981', screen: 'OilChange' },
     { id: 'Finance', label: t('categories.Finance'), icon: 'cash-outline', color: '#8B5CF6', screen: 'Finance' },
     { id: 'Tax', label: t('categories.Tax'), icon: 'document-text-outline', color: '#EF4444', screen: 'ExpenseList' },
     { id: 'Other', label: t('categories.Other'), icon: 'ellipsis-horizontal-circle-outline', color: '#64748B', screen: 'ExpenseList' },
   ];

  const handleCategoryPress = (category: any) => {
    navigation.navigate(category.screen, { carId, category: category.id });
  };

  const handleExportReport = async () => {
    if (!selectedCar) return;
    setExporting(true);
    try {
      await exportVehicleReport(selectedCar, currency);
    } catch (err: any) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('dashboard.export_failed') || 'Export Failed',
        message: err?.message || t('dashboard.export_failed_msg') || 'Something went wrong.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleRegenerateSummary = async () => {
    if (isRegenerating || !aiSummary) return;
    
    // Cooldown check
    if (aiSummary.generatedAt) {
      const now = new Date();
      const generatedTime = new Date(aiSummary.generatedAt);
      const diffMinutes = Math.floor((now.getTime() - generatedTime.getTime()) / (1000 * 60));
      if (diffMinutes < 60) {
        setStatusModal({
          visible: true,
          type: 'info',
          title: 'Cooldown Active',
          message: `You can regenerate this summary again in ${60 - diffMinutes} minutes.`,
        });
        return;
      }
    }

    const userId = useStore.getState().user?.uid || '';
    const carName = (selectedCar as any)?.name || '';
    if (!userId || !carName) return;

    setIsRegenerating(true);
    try {
      const newSummary = await forceRegenerateMonthlySummary(
        userId,
        carId,
        carName,
        latestExpensesRef.current,
        currency,
        t('common.currency'),
        (cur, total, mol) => t('dashboard.fallback_summary', { currency: cur, totalSpent: total, moreOrLess: mol }),
        t('dashboard.more'),
        t('dashboard.less')
      );
      if (newSummary) {
        setAiSummary(newSummary);
      }
    } catch (err: any) {
      console.error('Manual regenerate failed:', err);
      setStatusModal({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to regenerate summary. Please try again later.',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!selectedCar) return null;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
       <Header title={t('dashboard.title', { name: selectedCar?.name || 'Car' })} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedCard style={[styles.carInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.carHeaderRow}>
            <View style={styles.carImageContainer}>
              <View style={[styles.carIconBadge, { backgroundColor: isDarkMode ? colors.background : '#F0F9FF', borderColor: colors.border }]}>
                {selectedCar.type === 'bike' ? (
                  <MaterialIcons name="motorcycle" size={32} color={colors.primary} />
                ) : (
                  <Ionicons name="car-sport" size={32} color={colors.primary} />
                )}
              </View>
            </View>
            <View style={styles.carDetailsHeader}>
              <Text style={[styles.carNameCombined, { color: colors.text }]}>{selectedCar.name} {selectedCar.model}</Text>
              <View style={styles.carSpecRow}>
                <Text style={[styles.carSpecText, { color: colors.textSecondary }]}>{selectedCar.year}</Text>
                <View style={[styles.specDot, { backgroundColor: colors.border }]} />
                <Text style={[styles.carSpecText, { color: colors.textSecondary }]}>{selectedCar.plate}</Text>
                {selectedCar.engineCC && (
                  <>
                    <View style={[styles.specDot, { backgroundColor: colors.border }]} />
                    <Text style={[styles.carSpecText, { color: colors.textSecondary }]}>{selectedCar.engineCC} cc</Text>
                  </>
                )}
              </View>
              
              {selectedCar.purchasePrice && (
                 <View style={[styles.assetValueBadge, { backgroundColor: isDarkMode ? '#064e3b' : '#F0FDF4', borderColor: isDarkMode ? '#065f46' : '#DCFCE7' }]}>
                   <Ionicons name="checkmark-circle-outline" size={12} color={colors.success} />
                   <Text style={[styles.assetValueText, { color: colors.success }]}>{currency} {Number(selectedCar.purchasePrice).toLocaleString()} {t('common.valuation')}</Text>
                 </View>
              )}
            </View>
          </View>
        </AnimatedCard>

        {/* ── Vehicle Health Score Card ───────────────────────────── */}
        {!loading && healthScore && (() => {
          const scoreColor =
            healthScore.color === 'green' ? colors.success
            : healthScore.color === 'yellow' ? colors.warning
            : healthScore.color === 'orange' ? '#F97316'
            : colors.danger;
          const scoreBg =
            healthScore.color === 'green' ? (isDarkMode ? '#052e16' : '#F0FDF4')
            : healthScore.color === 'yellow' ? (isDarkMode ? '#431407' : '#FFFBEB')
            : healthScore.color === 'orange' ? (isDarkMode ? '#431407' : '#FFF7ED')
            : (isDarkMode ? '#450a0a' : '#FEF2F2');
          const scoreBorder =
            healthScore.color === 'green' ? (isDarkMode ? '#14532d' : '#DCFCE7')
            : healthScore.color === 'yellow' ? (isDarkMode ? '#78350f' : '#FEF08A')
            : healthScore.color === 'orange' ? (isDarkMode ? '#7c2d12' : '#FED7AA')
            : (isDarkMode ? '#7f1d1d' : '#FECACA');
          return (
            <AnimatedCard
              delay={50}
              style={[
                styles.healthCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.healthHeader}>
                <Ionicons name="heart-circle-outline" size={20} color={scoreColor} />
                <Text style={[styles.healthTitle, { color: colors.text }]}>{t('healthScore.title', 'Vehicle Health Score')}</Text>
              </View>

              <View style={styles.healthBody}>
                {/* Score circle */}
                <View style={[styles.scoreCircle, { backgroundColor: scoreBg, borderColor: scoreBorder }]}>
                  <Text style={[styles.scoreNumber, { color: scoreColor }]}>{healthScore.score}</Text>
                </View>

                {/* Label & issue */}
                <View style={styles.healthRight}>
                  <View style={[styles.labelBadge, { backgroundColor: scoreBg, borderColor: scoreBorder }]}>
                    <Text style={[styles.labelBadgeText, { color: scoreColor }]}>{t(healthScore.labelKey)}</Text>
                  </View>
                  <Text style={[styles.healthIssueText, { color: colors.textSecondary }]} numberOfLines={2}>
                    {healthScore.topIssueKey 
                      ? t(healthScore.topIssueKey, healthScore.topIssueParams || {}) as string
                      : t('healthScore.everything_great', 'Everything looks great!') as string}
                  </Text>
                </View>
              </View>
            </AnimatedCard>
          );
        })()}

        <View style={[styles.wealthContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
           <Text style={[styles.wealthLabel, { color: colors.textSecondary }]}>{t('dashboard.total_cost')}</Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} size="small" style={{ marginVertical: 10 }} />
            ) : (
              <Text
                style={[styles.wealthAmount, { color: colors.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.58}
              >
                {currency} {financials.overallTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
            )}

            <View style={[styles.wealthDivider, { backgroundColor: colors.border }]} />

            {/* AI Insight & Visual Chart */}
            {financials.breakdown.length > 0 && financials.overallTotal > 0 && (
              <View style={styles.chartSection}>
                 <View style={[styles.insightBadge, { backgroundColor: isDarkMode ? '#1e1b4b' : '#EEF2FF', borderColor: isDarkMode ? '#312e81' : '#C7D2FE' }]}>
                   <Ionicons name="sparkles" size={16} color={colors.primary} />
                   <Text style={[styles.insightText, { color: colors.primary }]}>
                     {t('dashboard.insight', { category: t(`categories.${financials.breakdown[0].label}`), percentage: financials.breakdown[0].percentage.toFixed(0) })}
                   </Text>
                 </View>

                <View style={styles.chartContainer}>
                  <PieChart
                    data={financials.breakdown.map(item => ({
                      value: item.amount,
                      color: categories.find(c => c.id === item.label)?.color || colors.primary,
                    }))}
                    donut
                    radius={70}
                    innerRadius={45}
                    innerCircleColor={colors.background}
                    backgroundColor="transparent"
                  />
                  <View style={styles.chartCenterOverlay}>
                    <Ionicons name="analytics" size={24} color={colors.textSecondary} />
                  </View>
                </View>
              </View>
            )}

            <View style={styles.wealthSplit}>
               <View style={styles.wealthHalf}>
                 <Text style={[styles.splitLabel, { color: colors.textSecondary }]}>{t('dashboard.paid_so_far')}</Text>
                 <Text
                   style={[styles.splitAmount, { color: colors.success }]}
                   numberOfLines={1}
                   adjustsFontSizeToFit
                   minimumFontScale={0.62}
                 >
                  {financials.totalPaid.toLocaleString()}
                 </Text>
               </View>
               <View style={[styles.splitDivider, { backgroundColor: colors.border }]} />
               <View style={styles.wealthHalf}>
                 <Text style={[styles.splitLabel, { color: colors.textSecondary }]}>{t('dashboard.remaining_balance')}</Text>
                 <Text
                   style={[styles.splitAmountUpcoming, { color: colors.warning }]}
                   numberOfLines={1}
                   adjustsFontSizeToFit
                   minimumFontScale={0.62}
                 >
                   {financials.upcoming.toLocaleString()}
                 </Text>
               </View>
            </View>
          </View>

        {/* Monthly AI Summary Card */}
        <AnimatedCard style={[styles.aiSummaryCard, { backgroundColor: colors.surface, borderColor: colors.border ,marginBottom:12}]} delay={100}>
          <View style={styles.aiSummaryHeader}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={[styles.aiSummaryTitle, { color: colors.text }]}>{t('dashboard.ai_summary_title')}</Text>
            <View style={[styles.aiBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.aiBadgeText, { color: colors.primary }]}>AI</Text>
            </View>
            <TouchableOpacity 
              style={{ marginLeft: 'auto', padding: 4 }}
              onPress={handleRegenerateSummary}
              disabled={isRegenerating || aiLoading}
            >
              {isRegenerating ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Ionicons name="refresh" size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
          {aiLoading ? (
            <ActivityIndicator color={colors.primary} size="small" style={{ marginVertical: 10 }} />
          ) : aiSummary ? (
            <View>
              <Text style={[styles.aiSummaryText, { color: colors.textSecondary }]}>
                {aiSummary.summaryText}
              </Text>
              <Text style={[styles.aiGeneratedDate, { color: colors.textSecondary + '80' }]}>
                {t('dashboard.generated_on', { date: aiSummary.generatedAt?.toLocaleDateString() || '' })}
              </Text>
            </View>
          ) : null}
        </AnimatedCard>

        {financials.breakdown.length > 0 && (
           <View style={styles.section}>
             <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.expense_distribution')}</Text>
            <AnimatedCard style={styles.breakdownCard} delay={100}>
              {financials.breakdown.map((item, idx) => (
                <View key={idx} style={styles.breakdownItem}>
                   <View style={styles.breakdownHeader}>
                     <Text style={[styles.breakdownLabel, { color: colors.text }]}>{t(`categories.${item.label}`)}</Text>
                     <Text style={[styles.breakdownValue, { color: colors.textSecondary }]}>{currency} {item.amount.toLocaleString()} ({item.percentage.toFixed(0)}%)</Text>
                   </View>
                  <AnimatedProgressBar
                    percentage={item.percentage}
                    color={categories.find(c => c.id === item.label)?.color || colors.primary}
                    delay={300 + (idx * 50)}
                  />
                </View>
              ))}
            </AnimatedCard>
          </View>
        )}

         <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.management_hub')}</Text>
        <View style={styles.gridContainer}>
          {categories.map((cat, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.gridItem,
                { backgroundColor: colors.surface },
                (index + 1) % 3 !== 0 && { marginRight: '3.5%' }
              ]}
              onPress={() => handleCategoryPress(cat)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: cat.color + '15' }]}>
                <Ionicons name={cat.icon as any} size={28} color={cat.color} />
              </View>
              <Text style={[styles.gridItemText, { color: colors.text }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Export Report Button ──────────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.exportButton,
            { backgroundColor: colors.surface, borderColor: colors.primary },
            exporting && { opacity: 0.7 },
          ]}
          onPress={handleExportReport}
          activeOpacity={0.75}
          disabled={exporting}
          accessibilityLabel="Export vehicle report as PDF"
          accessibilityRole="button"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 10 }} />
          ) : (
            <Ionicons name="document-text-outline" size={20} color={colors.primary} style={{ marginRight: 10 }} />
          )}
          <Text style={[styles.exportButtonText, { color: colors.primary }]}>
            {exporting ? t('dashboard.generating_pdf') : t('dashboard.export_report')}
          </Text>
          {!exporting && (
            <Ionicons name="share-outline" size={18} color={colors.primary} style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>

      </ScrollView>

      <CustomStatusModal
        {...statusModal}
        onClose={() => setStatusModal({ ...statusModal, visible: false })}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 100 },
  carInfoCard: { borderRadius: 32, padding: 24, marginBottom: 32, backgroundColor: '#FFF', ...SHADOWS.medium },
  carHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  carImageContainer: { marginRight: 16 },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    marginHorizontal: 4,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    ...SHADOWS.soft,
  },
  exportButtonText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700' as any,
    fontSize: 15,
  },
  carIconBadge: {
    width: 64, height: 74, borderRadius: 20, backgroundColor: '#F0F9FF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE'
  },
  carDetailsHeader: { flex: 1 },
  carNameCombined: { ...TYPOGRAPHY.h2, fontSize: 20, fontWeight: '800' },
  carSpecRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  carSpecText: { ...TYPOGRAPHY.caption, fontWeight: '600' },
  specDot: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 8 },
  assetValueBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4',
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    marginTop: 10, borderWidth: 1, borderColor: '#DCFCE7'
  },
  assetValueText: { ...TYPOGRAPHY.caption, fontSize: 11, fontWeight: '700', marginLeft: 6 },


  wealthContainer: {
    borderRadius: 24, padding: 20,
    borderWidth: 1.5,
  },
  wealthLabel: {
    ...TYPOGRAPHY.label, textAlign: 'center', marginBottom: 8
  },
  wealthAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  aiSummaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    ...SHADOWS.soft,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  aiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  aiSummaryText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  aiGeneratedDate: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'right',
  },
  wealthDivider: { height: 1.5, marginBottom: 20 },
  wealthSplit: { flexDirection: 'row', alignItems: 'center' },
  wealthHalf: { flex: 1, minWidth: 0, alignItems: 'center' },
  splitDivider: { width: 1.5, height: 30 },
  splitLabel: { ...TYPOGRAPHY.caption, fontSize: 11, marginBottom: 4 },
  splitAmount: { ...TYPOGRAPHY.h3, fontSize: 17, lineHeight: 22, width: '100%', textAlign: 'center' },
  splitAmountUpcoming: { ...TYPOGRAPHY.h3, fontSize: 17, lineHeight: 22, width: '100%', textAlign: 'center' },

  chartSection: { alignItems: 'center', marginBottom: 20 },
  insightBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#C7D2FE'
  },
  insightText: { ...TYPOGRAPHY.caption, marginLeft: 6 },
  chartContainer: { position: 'relative', justifyContent: 'center', alignItems: 'center', height: 150 },
  chartCenterOverlay: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },

  section: { marginBottom: 32 },
  sectionTitle: { ...TYPOGRAPHY.h3, marginBottom: 16, marginLeft: 4 },
  breakdownCard: { borderRadius: 28, padding: 24, ...SHADOWS.soft },
  breakdownItem: { marginBottom: 16 },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  breakdownLabel: { ...TYPOGRAPHY.body, fontWeight: '700' },
  breakdownValue: { ...TYPOGRAPHY.caption, fontWeight: '600' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  gridItem: {
    width: '31%', borderRadius: 20, padding: 16,
    alignItems: 'center', marginBottom: 15, ...SHADOWS.soft
  },

  iconContainer: {
    width: 52, height: 52, borderRadius: 16, justifyContent: 'center',
    alignItems: 'center', marginBottom: 10
  },
  gridItemText: { ...TYPOGRAPHY.caption, fontWeight: '700', textAlign: 'center', fontSize: 11 },

  // ── Vehicle Health Score Card ──────────────────────────────────────────
  healthCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    ...SHADOWS.soft,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    marginLeft: 8,
  },
  healthBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  scoreNumber: {
    fontSize: 30,
    fontWeight: '800' as any,
    lineHeight: 36,
  },
  healthRight: {
    flex: 1,
  },
  labelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  labelBadgeText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700' as any,
    fontSize: 13,
  },
  healthIssueText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    lineHeight: 18,
  },
});
