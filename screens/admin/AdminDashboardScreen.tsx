import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../../services/firebase';
import { useStore } from '../../context/useStore';
import Header from '../../components/common/Header';
import AnimatedCard from '../../components/common/AnimatedCard';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../../utils/theme';
import { PieChart } from 'react-native-gifted-charts';

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const setUser = useStore(state => state.setUser);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    deletedUsers: 0,
    totalVehicles: 0,
    totalExpensesAmount: 0
  });

  useEffect(() => {
    let unsubscribeUsers: () => void;
    let unsubscribeCars: () => void;
    let unsubscribeExpenses: () => void;

    const fetchStats = () => {
      unsubscribeUsers = db.collection('users').onSnapshot((snap) => {
        let activeCount = 0;
        let validUserCount = 0;
        let deletedCount = 0;
        snap.forEach(doc => {
          const data = doc.data();
          if (data.status === 'deleted') {
            deletedCount++;
          } else {
            validUserCount++;
            if (data.status !== 'deactivated') {
              activeCount++;
            }
          }
        });
        setStats(prev => ({ ...prev, totalUsers: validUserCount, activeUsers: activeCount, deletedUsers: deletedCount }));
      });

      unsubscribeCars = db.collection('cars').onSnapshot((snap) => {
        setStats(prev => ({ ...prev, totalVehicles: snap.size }));
      });

      unsubscribeExpenses = db.collection('expenses').onSnapshot((snap) => {
        let totalAmount = 0;
        snap.forEach(doc => {
          totalAmount += (doc.data().amount || 0);
        });
        setStats(prev => ({ ...prev, totalExpensesAmount: totalAmount }));
        setLoading(false);
      });
    };

    fetchStats();

    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeCars) unsubscribeCars();
      if (unsubscribeExpenses) unsubscribeExpenses();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Admin Portal</Text>
          <Text style={styles.subtitle}>Manage Users & App Activity</Text>
          {/* Admin identity badge */}
          <View style={styles.adminEmailBadge}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.primary} />
            <Text style={styles.adminEmailText}>chaudhrysamie@gmail.com</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stats Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Overview</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* Quick Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statsCol}>
                <AnimatedCard delay={100} style={styles.statCard}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="people" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.statValue}>{stats.totalUsers}</Text>
                  <Text style={styles.statLabel}>Total Users</Text>
                </AnimatedCard>

                <AnimatedCard delay={200} style={styles.statCard}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="car-sport" size={20} color={COLORS.success} />
                  </View>
                  <Text style={styles.statValue}>{stats.totalVehicles}</Text>
                  <Text style={styles.statLabel}>Total Vehicles</Text>
                </AnimatedCard>
              </View>

              <View style={styles.statsCol}>
                <AnimatedCard delay={300} style={styles.statCard}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="cash" size={20} color="#F59E0B" />
                  </View>
                  <Text style={[styles.statValue, { fontSize: 18 }]} numberOfLines={1}>
                    Rs {stats.totalExpensesAmount.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Total Expenses</Text>
                </AnimatedCard>

                <AnimatedCard delay={400} style={styles.statCard}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#F3F4F6' }]}>
                    <Ionicons name="trash" size={20} color="#6B7280" />
                  </View>
                  <Text style={styles.statValue}>{stats.deletedUsers}</Text>
                  <Text style={styles.statLabel}>Deleted Accounts</Text>
                </AnimatedCard>
              </View>
            </View>

            {/* Engagement Distribution Chart */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>User Engagement Ratio</Text>
            </View>
            <AnimatedCard delay={400} style={{ ...styles.statCard, marginHorizontal: 20 } as any}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 }}>
                <View style={{ gap: 16 }}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success }} />
                     <Text style={{ fontSize: 14, color: COLORS.text, fontWeight: '700' }}>Active Users</Text>
                     <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' }}>({stats.activeUsers})</Text>
                   </View>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.danger }} />
                     <Text style={{ fontSize: 14, color: COLORS.text, fontWeight: '700' }}>Inactive Users</Text>
                     <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' }}>({stats.totalUsers - stats.activeUsers}) </Text>
                   </View>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#94A3B8' }} />
                     <Text style={{ fontSize: 14, color: COLORS.text, fontWeight: '700' }}>Deleted Users</Text>
                     <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' }}>({stats.deletedUsers})</Text>
                   </View>
                </View>
                
                <View style={{ alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                   {(stats.activeUsers > 0 || (stats.totalUsers - stats.activeUsers) > 0 || stats.deletedUsers > 0) ? (
                     <PieChart
                       data={[
                         ...(stats.activeUsers > 0 ? [{ value: stats.activeUsers, color: COLORS.success }] : []),
                         ...((stats.totalUsers - stats.activeUsers) > 0 ? [{ value: stats.totalUsers - stats.activeUsers, color: COLORS.danger }] : []),
                         ...(stats.deletedUsers > 0 ? [{ value: stats.deletedUsers, color: '#94A3B8' }] : [])
                       ]}
                       donut
                       radius={48}
                       innerRadius={32}
                       centerLabelComponent={() => {
                         const grandTotal = stats.totalUsers + stats.deletedUsers;
                         const activePct = grandTotal > 0 ? ((stats.activeUsers / grandTotal) * 100).toFixed(0) : '0';
                         return <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>{activePct}%</Text>
                       }}
                     />
                   ) : (
                     <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                       <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>0%</Text>
                     </View>
                   )}
                </View>
              </View>
            </AnimatedCard>
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Management</Text>
        </View>

        <AnimatedCard delay={400} style={styles.menuCard}>
          <TouchableOpacity 
            style={styles.menuContent}
            onPress={() => navigation.navigate('AdminUsers')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="people" size={28} color={COLORS.primary} />
            </View>
            <View style={styles.textStack}>
              <Text style={styles.menuTitle}>User Management</Text>
              <Text style={styles.menuDesc}>View users, track logins, deactivate accounts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
          </TouchableOpacity>
        </AnimatedCard>

        <AnimatedCard delay={200} style={styles.menuCard}>
          <TouchableOpacity 
            style={styles.menuContent}
            onPress={() => navigation.navigate('AdminNotifications')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="notifications" size={28} color={COLORS.success} />
            </View>
            <View style={styles.textStack}>
              <Text style={styles.menuTitle}>Global Notifications</Text>
              <Text style={styles.menuDesc}>Send app-wide messages and alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
          </TouchableOpacity>
        </AnimatedCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between',marginTop: 20, alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 },
  title: { ...TYPOGRAPHY.h1, color: COLORS.text, fontSize: 26 },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: 4 },
  adminEmailBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8, alignSelf: 'flex-start' as any, gap: 5 },
  adminEmailText: { ...TYPOGRAPHY.caption, fontSize: 11, color: COLORS.primary, fontWeight: '600' as any },
  logoutBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40 },
  sectionHeader: { marginBottom: 12, marginTop: 10 },
  sectionTitle: { ...TYPOGRAPHY.h3, color: COLORS.text },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statsCol: { flex: 1, marginHorizontal: 4 },
  statCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 8, ...SHADOWS.soft, alignItems: 'center' },
  statCardLarge: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 8, ...SHADOWS.soft, alignItems: 'center', flex: 1, justifyContent: 'center' },
  statIconBadge: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { ...TYPOGRAPHY.h2, fontSize: 22, color: COLORS.text, marginBottom: 2 },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontWeight: '600' as any },
  statSubLabel: { ...TYPOGRAPHY.caption, fontSize: 10, color: '#94A3B8', marginTop: 4 },
  menuCard: { backgroundColor: '#FFF', borderRadius: 24, marginBottom: 16, padding: 0, ...SHADOWS.medium },
  menuContent: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  iconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  textStack: { flex: 1 },
  menuTitle: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.text, marginBottom: 4 },
  menuDesc: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, lineHeight: 18 },
});
