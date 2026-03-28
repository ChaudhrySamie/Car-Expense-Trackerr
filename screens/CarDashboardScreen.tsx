import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../App';
import { useStore, Car } from '../context/useStore';
import { getCarById, subscribeToExpensesByCar } from '../services/db';

// Premium Components
import Header from '../components/common/Header';
import AnimatedCard from '../components/common/AnimatedCard';
import AnimatedProgressBar from '../components/common/AnimatedProgressBar';
import FloatingActionButton from '../components/common/FloatingActionButton';
import { COLORS, SHADOWS, SPACING } from '../utils/theme';

type CarDashboardRouteProp = RouteProp<RootStackParamList, 'CarDashboard'>;

export default function CarDashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<CarDashboardRouteProp>();
  const { carId } = route.params;
  const { selectedCar } = useStore();
  
  const [loading, setLoading] = useState(true);
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
      
      // 1. Refresh car details (one-time fetch is fine here as AddCar also updates store)
      const freshCar = await getCarById(carId);
      if (freshCar) {
        useStore.getState().setSelectedCar(freshCar as Car);
      }

      // 2. Subscribe to expenses for full financial analysis
      unsubscribeExpenses = subscribeToExpensesByCar(carId, (expenses) => {
        // A. Find Finance Setup
        const setup = expenses.find(e => e.workName === 'Finance_Setup');
        
        // B. Calculate Finance (Paid vs Future)
        const financePayments = expenses.filter(e => e.category === 'Finance' && e.workName !== 'Finance_Setup');
        const paymentsTotal = financePayments.reduce((sum, e) => sum + (e.amount || 0), 0);
        
        let initialPaidAmount = 0;
        let totalFinanced = 0;
        if (setup) {
           totalFinanced = setup.amount || 0;
           try {
             const data = JSON.parse(setup.purpose);
             initialPaidAmount = (data.paidInitially || 0) * (data.installment || 0);
           } catch(e) {}
        }
        
        const totalPaidFinance = paymentsTotal + initialPaidAmount;
        const upcomingFinance = Math.max(0, totalFinanced - totalPaidFinance);

        // C. Calculate Other (Maintenance, etc.)
        const others = expenses.filter(e => e.category !== 'Finance');
        const totalPaidOthers = others.reduce((sum, e) => sum + (e.amount || 0), 0);

        // D. Grand Totals
        const totalPaidSoFar = totalPaidOthers + totalPaidFinance;
        const overallLifecycleTotal = totalPaidSoFar + upcomingFinance;

        // E. Breakdown logic
        const catMap: Record<string, number> = {};
        
        // Add Paid Finance to breakdown
        catMap['Finance'] = totalPaidFinance;
        
        // Add others to breakdown
        others.forEach(exp => {
          catMap[exp.category] = (catMap[exp.category] || 0) + (exp.amount || 0);
        });

        const breakdownArray = Object.keys(catMap).map(cat => ({
          label: cat,
          amount: catMap[cat],
          percentage: overallLifecycleTotal > 0 ? (catMap[cat] / overallLifecycleTotal) * 100 : 0
        })).sort((a,b) => b.amount - a.amount);

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

    return () => {
      if (unsubscribeExpenses) unsubscribeExpenses();
    };
  }, [carId]);

  const categories = [
    { id: 'Mechanical', label: 'Mechanical Work', icon: 'construct-outline', color: '#F59E0B', screen: 'ExpenseList' },
    { id: 'Electrical', label: 'Electrical Work', icon: 'flash-outline', color: '#3B82F6', screen: 'ExpenseList' },
    { id: 'OilChange', label: 'Oil Change', icon: 'water-outline', color: '#10B981', screen: 'OilChange' },
    { id: 'Finance', label: 'Finance', icon: 'cash-outline', color: '#8B5CF6', screen: 'Finance' },
    { id: 'Tax', label: 'Tax', icon: 'document-text-outline', color: '#EF4444', screen: 'ExpenseList' },
    { id: 'Other', label: 'Other Expenses', icon: 'ellipsis-horizontal-circle-outline', color: '#64748B', screen: 'ExpenseList' },
  ];

  const handleCategoryPress = (category: any) => {
    navigation.navigate(category.screen, { carId, category: category.id });
  };

  if (!selectedCar) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={`${selectedCar?.name || 'Car'} Dashboard`} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Car Info Card */}
        <AnimatedCard style={styles.carInfoCard}>
          <View style={styles.carImageContainer}>
            <Ionicons name="car-sport" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.carName}>{selectedCar.name} {selectedCar.model}</Text>
          <Text style={styles.carDetailText}>{selectedCar.year} • {selectedCar.plate}</Text>
          
          <View style={styles.wealthContainer}>
            <Text style={styles.wealthLabel}>Total Lifecycle Cost</Text>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.wealthAmount}>${financials.overallTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            )}
            
            <View style={styles.wealthDivider} />
            
            <View style={styles.wealthSplit}>
              <View style={styles.wealthHalf}>
                <Text style={styles.splitLabel}>Paid so far</Text>
                <Text style={styles.splitAmount}>${financials.totalPaid.toLocaleString()}</Text>
              </View>
              <View style={[styles.wealthHalf, { borderLeftWidth: 1, borderLeftColor: COLORS.border }]}>
                <Text style={styles.splitLabel}>Upcoming</Text>
                <Text style={styles.splitAmountUpcoming}>${financials.upcoming.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        </AnimatedCard>

        {/* Cost Breakdown */}
        {financials.breakdown.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Expense Breakdown</Text>
            <AnimatedCard style={styles.breakdownCard} delay={200}>
              {financials.breakdown.map((item, idx) => (
                <View key={idx} style={styles.breakdownItem}>
                  <View style={styles.breakdownHeader}>
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                    <Text style={styles.breakdownValue}>${item.amount.toLocaleString()} ({item.percentage.toFixed(0)}%)</Text>
                  </View>
                  <AnimatedProgressBar 
                    percentage={item.percentage} 
                    color={categories.find(c => c.id === item.label)?.color || COLORS.primary}
                    delay={400 + (idx * 100)}
                  />
                </View>
              ))}
            </AnimatedCard>
          </>
        )}

        {/* Categories Grid */}
        <Text style={styles.sectionTitle}>Manage Expenses</Text>
        <View style={styles.gridContainer}>
          {categories.map((cat, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.gridItem} 
              onPress={() => handleCategoryPress(cat)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: cat.color + '15' }]}>
                <Ionicons name={cat.icon as any} size={28} color={cat.color} />
              </View>
              <Text style={styles.gridItemText}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      <FloatingActionButton 
        icon="add" 
        onPress={() => handleCategoryPress(categories[0])} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  carInfoCard: {
    alignItems: 'center',
    marginBottom: 24,
    borderRadius: 32,
  },
  carImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  carName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  carDetailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  wealthContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    width: '100%',
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wealthLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  wealthAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  wealthDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 20,
  },
  wealthSplit: {
    flexDirection: 'row',
  },
  wealthHalf: {
    flex: 1,
    alignItems: 'center',
  },
  splitLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  splitAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.success,
  },
  splitAmountUpcoming: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.warning,
  },
  breakdownCard: {
    marginBottom: 24,
    borderRadius: 24,
  },
  breakdownItem: {
    marginBottom: 16,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    ...SHADOWS.soft,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
});
