import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, SafeAreaView, ScrollView, Modal, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import Header from '../../components/common/Header';
import AnimatedCard from '../../components/common/AnimatedCard';
import CustomStatusModal from '../../components/common/CustomStatusModal';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../../utils/theme';
import { formatDisplayDate } from '../../utils/dateHelpers';
import { useStore } from '../../context/useStore';

const ADMIN_EMAIL = 'chaudhrysamie@gmail.com';

interface UserData {
  id: string;
  name?: string;
  email?: string;
  maxVehicles?: number;
  createdAt?: string;
  lastLogin?: string;
  lastActivityTime?: any;
  lastActivity?: string;
  status?: string;
}

export default function AdminUsersScreen() {
  const { startDeleting, stopDeleting } = useStore();
  const [users, setUsers] = useState<UserData[]>([]);
  const [filtered, setFiltered] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'deactivated'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'activity'>('recent');
  const [loading, setLoading] = useState(true);
  const [userCarCounts, setUserCarCounts] = useState<Record<string, number>>({});

  const [statusModal, setStatusModal] = useState<{ visible: boolean, type: 'success' | 'error' | 'info', title: string, message: string }>({ visible: false, type: 'info', title: '', message: '' });

  // User detail modal
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userStats, setUserStats] = useState<{ vehicles: number, expenses: number, amount: number, loading: boolean }>({ vehicles: 0, expenses: 0, amount: 0, loading: false });
  const [limitInput, setLimitInput] = useState('');
  const [messageInput, setMessageInput] = useState('');

  // Deactivate confirm
  const [deactivateModal, setDeactivateModal] = useState<{ visible: boolean, user: UserData | null, action: 'deactivate' | 'activate' }>({ visible: false, user: null, action: 'deactivate' });

  // Delete confirm (2-step)
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean, user: UserData | null, step: 1 | 2 }>({ visible: false, user: null, step: 1 });
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ── Fetch Users & Vehicles ──────────────────────────────────────────
  useEffect(() => {
    const unsubUsers = db.collection('users').onSnapshot(snap => {
      const list: UserData[] = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .filter(u => u.status !== 'deleted'); // Hide soft-deleted users
      setUsers(list);
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    
    const unsubCars = db.collection('cars').onSnapshot(snap => {
      const counts: Record<string, number> = {};
      snap.forEach(doc => {
        const uid = doc.data().userId;
        if (uid) counts[uid] = (counts[uid] || 0) + 1;
      });
      setUserCarCounts(counts);
    }, err => console.error(err));
    
    return () => {
      unsubUsers();
      unsubCars();
    };
  }, []);

  // ── Filter / Sort ─────────────────────────────────────────────────
  useEffect(() => {
    let result = [...users];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') {
      result = result.filter(u => (u.status || 'active') === filterStatus);
    }
    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      result.sort((a, b) => {
        const at = a.lastActivityTime?.toMillis?.() || new Date(a.lastLogin || a.createdAt || 0).getTime();
        const bt = b.lastActivityTime?.toMillis?.() || new Date(b.lastLogin || b.createdAt || 0).getTime();
        return bt - at;
      });
    }
    setFiltered(result);
  }, [searchQuery, filterStatus, sortBy, users]);

  // ── Open User Summary ─────────────────────────────────────────────
  const openSummary = async (user: UserData) => {
    setSelectedUser(user);
    setLimitInput(String(user.maxVehicles || 5));
    setMessageInput('');
    setUserStats({ vehicles: 0, expenses: 0, amount: 0, loading: true });
    try {
      const carsSnap = await db.collection('cars').where('userId', '==', user.id).get();
      const carIds = carsSnap.docs.map(d => d.id);
      let expCount = 0, expAmount = 0;
      if (carIds.length > 0) {
        for (let i = 0; i < carIds.length; i += 10) {
          const chunk = carIds.slice(i, i + 10);
          const expSnap = await db.collection('expenses').where('carId', 'in', chunk).get();
          expCount += expSnap.size;
          expSnap.forEach(e => { expAmount += (e.data().amount || 0); });
        }
      }
      setUserStats({ vehicles: carsSnap.size, expenses: expCount, amount: expAmount, loading: false });
    } catch (e) {
      console.error(e);
      setUserStats({ vehicles: 0, expenses: 0, amount: 0, loading: false });
    }
  };

  // ── Update Limit ──────────────────────────────────────────────────
  const handleUpdateLimit = async () => {
    if (!selectedUser) return;
    const limit = parseInt(limitInput, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      setStatusModal({ visible: true, type: 'error', title: 'Invalid', message: 'Enter a number between 1 and 100.' });
      return;
    }
    try {
      await db.collection('users').doc(selectedUser.id).update({ maxVehicles: limit });
      setSelectedUser({ ...selectedUser, maxVehicles: limit });
      setStatusModal({ visible: true, type: 'success', title: 'Limit Updated', message: `Vehicle limit set to ${limit} for ${selectedUser.name || 'this user'}.` });
    } catch (e: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', message: e.message });
    }
  };

  // ── Send Message ──────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!selectedUser || !messageInput.trim()) return;
    try {
      await db.collection('user_notifications').add({
        userId: selectedUser.id,
        message: messageInput.trim(),
        active: true,
        createdAt: new Date().toISOString()
      });
      setMessageInput('');
      setStatusModal({ visible: true, type: 'success', title: 'Sent!', message: 'Notification delivered to user dashboard.' });
    } catch (e: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', message: e.message });
    }
  };

  // ── Deactivate / Activate ─────────────────────────────────────────
  const handleDeactivateAction = async () => {
    const { user, action } = deactivateModal;
    if (!user) return;
    setDeactivateModal({ visible: false, user: null, action: 'deactivate' });
    try {
      await db.collection('users').doc(user.id).update({ status: action === 'deactivate' ? 'deactivated' : 'active' });
      setStatusModal({
        visible: true, type: 'success',
        title: action === 'deactivate' ? 'Account Deactivated' : 'Account Activated',
        message: action === 'deactivate'
          ? `${user.name || 'User'} can no longer sign in. Data is preserved.`
          : `${user.name || 'User'} can sign in again.`,
      });
    } catch (e: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', message: e.message });
    }
  };

  // ── Cascade Delete ────────────────────────────────────────────────
  const handleDeleteUser = async () => {
    const { user } = deleteModal;
    if (!user) return;
    setDeleting(true);
    startDeleting('Deleting account and related data...');
    try {
      const carsSnap = await db.collection('cars').where('userId', '==', user.id).get();
      const carIds = carsSnap.docs.map(d => d.id);

      // Delete expenses by carId chunks
      for (let i = 0; i < carIds.length; i += 10) {
        const chunk = carIds.slice(i, i + 10);
        const expSnap = await db.collection('expenses').where('carId', 'in', chunk).get();
        const batch = db.batch();
        expSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      // Delete cars
      const carBatch = db.batch();
      carsSnap.docs.forEach(d => carBatch.delete(d.ref));
      await carBatch.commit();
      // Delete notifications
      const notifSnap = await db.collection('user_notifications').where('userId', '==', user.id).get();
      if (!notifSnap.empty) {
        const nb = db.batch();
        notifSnap.docs.forEach(d => nb.delete(d.ref));
        await nb.commit();
      }
      // Leave a tombstone so they can never log back in
      await db.collection('users').doc(user.id).set({
        email: user.email,
        status: 'deleted',
        deletedAt: new Date().toISOString()
      });

      setDeleteModal({ visible: false, user: null, step: 1 });
      setDeleteConfirmText('');
      setSelectedUser(null);
      setStatusModal({ visible: true, type: 'success', title: 'Deleted', message: `${user.name || 'User'} and all data permanently removed.` });
    } catch (e: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Delete Failed', message: e.message });
    } finally {
      setDeleting(false);
      stopDeleting();
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────
  const isAdmin = (u?: UserData | null) => u?.email?.toLowerCase() === ADMIN_EMAIL;
  const getStatusColor = (s?: string) => s === 'deactivated' ? COLORS.danger : COLORS.success;
  const getStatusLabel = (s?: string) => s === 'deactivated' ? 'Inactive' : 'Active';

  // ── Render Card ───────────────────────────────────────────────────
  const renderUser = ({ item, index }: { item: UserData, index: number }) => {
    const admin = isAdmin(item);
    return (
      <AnimatedCard delay={index * 40} style={{ ...styles.userCard, ...(admin ? styles.adminCard : {}) }}>
        <TouchableOpacity onPress={() => openSummary(item)} activeOpacity={0.85}>
          <View style={styles.cardTop}>
            <View style={[styles.avatar, { backgroundColor: getStatusColor(item.status) + '22' }]}>
              <Text style={[styles.avatarText, { color: getStatusColor(item.status) }]}>
                {item.name ? item.name[0].toUpperCase() : '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.userName} numberOfLines={1}>{item.name || 'Unknown'}</Text>
                {admin && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={10} color="#FFF" />
                    <Text style={styles.adminBadgeText}>ADMIN</Text>
                  </View>
                )}
              </View>
              <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusPillText}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={11} color="#94A3B8" />
              <Text style={styles.metaText}>Joined {item.createdAt ? formatDisplayDate(item.createdAt.split('T')[0]) : 'N/A'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="log-in-outline" size={11} color="#94A3B8" />
              <Text style={styles.metaText}>Login {item.lastLogin ? formatDisplayDate(item.lastLogin.split('T')[0]) : 'Never'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="car-outline" size={11} color="#94A3B8" />
              <Text style={styles.metaText}>{userCarCounts[item.id] || 0} / {item.maxVehicles || 5} Cars</Text>
            </View>
          </View>

          {item.lastActivity && (
            <View style={styles.activityBadge}>
              <Ionicons name="pulse-outline" size={11} color={COLORS.primary} />
              <Text style={styles.activityText} numberOfLines={1}>{item.lastActivity}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Quick Actions — hidden for admin */}
        {!admin && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: item.status === 'deactivated' ? COLORS.success : '#F59E0B' }]}
              onPress={() => setDeactivateModal({ visible: true, user: item, action: item.status === 'deactivated' ? 'activate' : 'deactivate' })}
            >
              <Ionicons name={item.status === 'deactivated' ? 'checkmark-circle' : 'pause-circle'} size={14} color="#FFF" />
              <Text style={styles.actionBtnText}>{item.status === 'deactivated' ? 'Activate' : 'Deactivate'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.danger }]}
              onPress={() => { setDeleteModal({ visible: true, user: item, step: 1 }); setDeleteConfirmText(''); }}
            >
              <Ionicons name="trash" size={14} color="#FFF" />
              <Text style={styles.actionBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        {admin && (
          <View style={styles.adminProtectedBadge}>
            <Ionicons name="lock-closed" size={12} color={COLORS.primary} />
            <Text style={styles.adminProtectedText}>Protected — Admin account cannot be modified</Text>
          </View>
        )}
      </AnimatedCard>
    );
  };

  // ── Main JSX ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="User Management" />

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or email..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {!!searchQuery && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['all', 'active', 'deactivated'] as const).map(f => (
            <TouchableOpacity key={f} style={[styles.chip, filterStatus === f && styles.chipActive]} onPress={() => setFilterStatus(f)}>
              <Text style={[styles.chipText, filterStatus === f && styles.chipTextActive]}>
                {f === 'deactivated' ? 'Inactive' : f === 'all' ? 'All Users' : 'Active'}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.chipDivider} />
          <TouchableOpacity style={[styles.chip, sortBy === 'recent' && styles.chipSortActive]} onPress={() => setSortBy('recent')}>
            <Ionicons name="time-outline" size={12} color={sortBy === 'recent' ? COLORS.primary : '#94A3B8'} />
            <Text style={[styles.chipText, sortBy === 'recent' && styles.chipTextSortActive]}> Recent</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, sortBy === 'activity' && styles.chipSortActive]} onPress={() => setSortBy('activity')}>
            <Ionicons name="trending-up-outline" size={12} color={sortBy === 'activity' ? COLORS.primary : '#94A3B8'} />
            <Text style={[styles.chipText, sortBy === 'activity' && styles.chipTextSortActive]}> Active</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}><Text style={{ color: COLORS.primary, fontWeight: '700' }}>{filtered.length}</Text> / {users.length} users</Text>
      </View>

      {/* Users List */}
      {loading
        ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={u => u.id}
            renderItem={renderUser}
            contentContainerStyle={styles.listPad}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={56} color="#CBD5E1" />
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            }
          />
        )}

      {/* ── Deactivate Modal ───────────────── */}
      {deactivateModal.visible && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 10 }]}>
          <View style={styles.overlay}>
            <View style={styles.confirmBox}>
              <View style={[styles.confirmIcon, { backgroundColor: deactivateModal.action === 'deactivate' ? '#FEF3C7' : '#DCFCE7' }]}>
                <Ionicons name={deactivateModal.action === 'deactivate' ? 'pause-circle' : 'checkmark-circle'} size={34} color={deactivateModal.action === 'deactivate' ? '#F59E0B' : COLORS.success} />
              </View>
              <Text style={styles.confirmTitle}>{deactivateModal.action === 'deactivate' ? 'Deactivate Account?' : 'Activate Account?'}</Text>
              <Text style={styles.confirmMsg}>
                {deactivateModal.action === 'deactivate'
                  ? `${deactivateModal.user?.name || 'This user'} won't be able to sign in. All data is safe and you can reactivate anytime.`
                  : `${deactivateModal.user?.name || 'This user'} will regain full access.`}
              </Text>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setDeactivateModal({ visible: false, user: null, action: 'deactivate' })}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnConfirm, { backgroundColor: deactivateModal.action === 'deactivate' ? '#F59E0B' : COLORS.success }]} onPress={handleDeactivateAction}>
                  <Text style={styles.btnConfirmText}>{deactivateModal.action === 'deactivate' ? 'Deactivate' : 'Activate'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── Delete Modal ─────────── */}
      {deleteModal.visible && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 10 }]}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15,23,42,0.65)' }]} />
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }} pointerEvents="box-none">
            <View style={styles.confirmBox}>
              <View style={[styles.confirmIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="warning" size={34} color={COLORS.danger} />
              </View>
              <Text style={styles.confirmTitle}>Delete User?</Text>
              <Text style={styles.confirmMsg}>
                <Text style={{ fontWeight: '700' }}>{deleteModal.user?.name || 'This user'}</Text> and <Text style={{ color: COLORS.danger, fontWeight: '700' }}>ALL</Text> related data will be permanently removed:{'\n\n'}
                • All vehicles{'\n'}• All expense records{'\n'}• All finance logs{'\n'}• Notifications{'\n\n'}
                <Text style={{ fontWeight: '700' }}>This cannot be undone.</Text>
              </Text>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setDeleteModal({ visible: false, user: null, step: 1 })}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnConfirm, { backgroundColor: COLORS.danger }]}
                  onPress={handleDeleteUser}
                  disabled={deleting}
                >
                  {deleting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnConfirmText}>Delete Forever</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ── User Summary Sheet ─────────────── */}
      {!!selectedUser && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 10 }]}>
          <TouchableOpacity style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15, 23, 42, 0.65)' }]} activeOpacity={1} onPress={() => setSelectedUser(null)} />
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              {/* User identity */}
              <View style={styles.sheetHeader}>
                <View style={[styles.avatar, { backgroundColor: getStatusColor(selectedUser?.status) + '22', width: 50, height: 50, borderRadius: 25 }]}>
                  <Text style={[styles.avatarText, { color: getStatusColor(selectedUser?.status), fontSize: 20 }]}>
                    {selectedUser?.name ? selectedUser.name[0].toUpperCase() : '?'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.sheetName}>{selectedUser?.name || 'Unknown'}</Text>
                    {isAdmin(selectedUser) && (
                      <View style={styles.adminBadge}>
                        <Ionicons name="shield-checkmark" size={10} color="#FFF" />
                        <Text style={styles.adminBadgeText}>ADMIN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sheetEmail}>{selectedUser?.email}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.statusPill, { backgroundColor: getStatusColor(selectedUser?.status) }]}>
                    <Text style={styles.statusPillText}>{getStatusLabel(selectedUser?.status)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedUser(null)} style={{ padding: 6, backgroundColor: '#F1F5F9', borderRadius: 16 }}>
                    <Ionicons name="close" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dates */}
              <View style={styles.sheetDates}>
                <Text style={styles.sheetDateText}>
                  <Ionicons name="calendar-outline" size={12} color="#94A3B8" /> Joined: {selectedUser?.createdAt ? formatDisplayDate(selectedUser.createdAt.split('T')[0]) : 'N/A'}
                </Text>
                <Text style={styles.sheetDateText}>
                  <Ionicons name="log-in-outline" size={12} color="#94A3B8" /> Last login: {selectedUser?.lastLogin ? formatDisplayDate(selectedUser.lastLogin.split('T')[0]) : 'Never'}
                </Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Stats boxes */}
                {userStats.loading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 16 }} />
                ) : (
                  <View style={styles.statRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>{userStats.vehicles}</Text>
                      <Text style={styles.statLbl}>Vehicles</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>{userStats.expenses}</Text>
                      <Text style={styles.statLbl}>Records</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={[styles.statVal, { fontSize: 14 }]}>{userStats.amount.toLocaleString()}</Text>
                      <Text style={styles.statLbl}>Expenses</Text>
                    </View>
                  </View>
                )}

                {/* Vehicle Limit */}
                <Text style={styles.fieldLabel}>Vehicle Limit (current: {selectedUser?.maxVehicles || 5})</Text>
                <View style={styles.fieldRow}>
                  <TextInput
                    style={styles.fieldInput}
                    keyboardType="numeric"
                    value={limitInput}
                    onChangeText={setLimitInput}
                    placeholder="e.g. 10"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity style={styles.fieldBtn} onPress={handleUpdateLimit}>
                    <Text style={styles.fieldBtnText}>Update</Text>
                  </TouchableOpacity>
                </View>

                {/* Direct Message */}
                <Text style={styles.fieldLabel}>Send Notification</Text>
                <View style={styles.fieldRow}>
                  <TextInput
                    style={[styles.fieldInput, { flex: 1 }]}
                    placeholder="Type a message..."
                    placeholderTextColor="#94A3B8"
                    value={messageInput}
                    onChangeText={setMessageInput}
                  />
                  <TouchableOpacity style={[styles.fieldBtn, { backgroundColor: COLORS.success }]} onPress={handleSendMessage}>
                    <Ionicons name="send" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {/* Actions (hidden for admin) */}
                {!isAdmin(selectedUser) && (
                  <View style={[styles.actionRow, { marginTop: 16 }]}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: selectedUser?.status === 'deactivated' ? COLORS.success : '#F59E0B' }]}
                      onPress={() => { setSelectedUser(null); setTimeout(() => setDeactivateModal({ visible: true, user: selectedUser, action: selectedUser?.status === 'deactivated' ? 'activate' : 'deactivate' }), 250); }}
                    >
                      <Ionicons name={selectedUser?.status === 'deactivated' ? 'checkmark-circle' : 'pause-circle'} size={14} color="#FFF" />
                      <Text style={styles.actionBtnText}>{selectedUser?.status === 'deactivated' ? 'Activate' : 'Deactivate'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.danger }]}
                      onPress={() => { setSelectedUser(null); setTimeout(() => { setDeleteModal({ visible: true, user: selectedUser, step: 1 }); setDeleteConfirmText(''); }, 250); }}
                    >
                      <Ionicons name="trash" size={14} color="#FFF" />
                      <Text style={styles.actionBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {isAdmin(selectedUser) && (
                  <View style={styles.adminProtectedBadge}>
                    <Ionicons name="lock-closed" size={13} color={COLORS.primary} />
                    <Text style={styles.adminProtectedText}>Admin account is protected from modification</Text>
                  </View>
                )}
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      <CustomStatusModal {...statusModal} onClose={() => setStatusModal({ ...statusModal, visible: false })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 20, marginTop: 12, paddingHorizontal: 14, height: 48, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  searchInput: { flex: 1, ...TYPOGRAPHY.body, color: COLORS.text, height: '100%' as any },

  filtersWrap: { paddingHorizontal: 20, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: '#FFF', marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { ...TYPOGRAPHY.caption, color: '#64748B', fontWeight: '600' as any },
  chipTextActive: { color: '#FFF' },
  chipSortActive: { backgroundColor: '#EFF6FF', borderColor: COLORS.primary },
  chipTextSortActive: { color: COLORS.primary, fontWeight: '700' as any },
  chipDivider: { width: 1, height: 20, backgroundColor: COLORS.border, marginRight: 8, alignSelf: 'center' as any },

  countRow: { paddingHorizontal: 24, paddingBottom: 6 },
  countText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },

  listPad: { paddingHorizontal: 20, paddingBottom: 40 },

  userCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 14, ...SHADOWS.soft },
  adminCard: { borderWidth: 1.5, borderColor: COLORS.primary + '40' },

  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { fontSize: 16, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userName: { ...TYPOGRAPHY.h3, color: COLORS.text, fontSize: 14, flex: 1 },
  userEmail: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontSize: 11 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, gap: 3 },
  adminBadgeText: { color: '#FFF', fontSize: 8, fontWeight: '800' as any },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginLeft: 6 },
  statusPillText: { color: '#FFF', fontSize: 9, fontWeight: '700' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { ...TYPOGRAPHY.caption, fontSize: 10, color: '#94A3B8' },

  activityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, gap: 5, marginTop: 4, marginBottom: 12 },
  activityText: { ...TYPOGRAPHY.caption, fontSize: 10, color: COLORS.primary, flex: 1 },

  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: 12, gap: 5 },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },

  adminProtectedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 10, borderRadius: 10, gap: 6, marginTop: 8 },
  adminProtectedText: { ...TYPOGRAPHY.caption, fontSize: 11, color: COLORS.primary, flex: 1 },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: 12 },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmBox: { backgroundColor: '#FFF', borderRadius: 28, padding: 28, width: '100%', alignItems: 'center', ...SHADOWS.medium },
  confirmIcon: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  confirmTitle: { ...TYPOGRAPHY.h2, fontSize: 19, color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  confirmMsg: { ...TYPOGRAPHY.body, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btnCancel: { flex: 1, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: COLORS.border },
  btnCancelText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' as any },
  btnConfirm: { flex: 1, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  btnConfirmText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  deleteInput: { width: '100%', height: 50, borderWidth: 2, borderColor: COLORS.danger, borderRadius: 14, textAlign: 'center', ...TYPOGRAPHY.h2, fontSize: 20, color: COLORS.danger, letterSpacing: 6, marginBottom: 18 },

  // Bottom Sheet
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 12, maxHeight: Dimensions.get('window').height * 0.85, ...SHADOWS.medium },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sheetName: { ...TYPOGRAPHY.h2, color: COLORS.text, fontSize: 17 },
  sheetEmail: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 1 },
  sheetDates: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  sheetDateText: { ...TYPOGRAPHY.caption, fontSize: 11, color: '#94A3B8' },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  statBox: { flex: 1, backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statVal: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.primary, marginBottom: 2 },
  statLbl: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontSize: 10 },
  fieldLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontWeight: '700' as any, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fieldRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  fieldInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, height: 44, ...TYPOGRAPHY.body, fontSize: 14 },
  fieldBtn: { backgroundColor: COLORS.primary, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, height: 44 },
  fieldBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
