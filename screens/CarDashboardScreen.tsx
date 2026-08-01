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

// Premium Components
import Header from '../components/common/Header';
import AnimatedCard from '../components/common/AnimatedCard';
import AnimatedProgressBar from '../components/common/AnimatedProgressBar';
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
        setLoading(false);
      });
    };

    setupSubscriptions();
    return () => { if (unsubscribeExpenses) unsubscribeExpenses(); };
  }, [carId]);

   const categories = [
     { id: 'Mechanical', label: t('categories.Mechanical'), icon: 'construct-outline', color: '#6366F1', screen: 'ExpenseList' },
     { id: 'Electrical', label: t('categories.Electrical'), icon: 'flash-outline', color: '#F59E0B', screen: 'ExpenseList' },
     { id: 'BodyWork', label: t('categories.BodyWork'), icon: 'brush-outline', color: '#EC4899', screen: 'ExpenseList' },
     { id: 'Fuel', label: t('categories.Fuel'), icon: 'speedometer-outline', color: '#F97316', screen: 'Fuel' },
     { id: 'OilChange', label: t('categories.OilChange'), icon: 'water-outline', color: '#10B981', screen: 'OilChange' },
     { id: 'Finance', label: t('categories.Finance'), icon: 'cash-outline', color: '#8B5CF6', screen: 'Finance' },
     { id: 'Tax', label: t('dashboard.tax_and_fines', { defaultValue: 'Tax & Fines' }), icon: 'document-text-outline', color: '#EF4444', screen: 'ExpenseList' },
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
      Alert.alert(
        'Export Failed',
        err?.message || 'Something went wrong while generating the PDF. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setExporting(false);
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
            {exporting ? 'Generating PDF…' : 'Export Report'}
          </Text>
          {!exporting && (
            <Ionicons name="share-outline" size={18} color={colors.primary} style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>

      </ScrollView>
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
    ...TYPOGRAPHY.h1, fontSize: 34, lineHeight: 40, textAlign: 'center', marginBottom: 20
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
});
