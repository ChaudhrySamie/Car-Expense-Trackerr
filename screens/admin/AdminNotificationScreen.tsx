import React, { useEffect, useState } from 'react';
import {  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,  KeyboardAvoidingView, Platform, ScrollView  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import Header from '../../components/common/Header';
import AnimatedCard from '../../components/common/AnimatedCard';
import AnimatedButton from '../../components/common/AnimatedButton';
import CustomStatusModal from '../../components/common/CustomStatusModal';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../../utils/theme';
import { formatDisplayDate } from '../../utils/dateHelpers';
import { useStore } from '../../context/useStore';

interface GlobalNotif {
  id?: string;
  message: string;
  targetVersion?: string;
  active: boolean;
  createdAt: string;
}

export default function AdminNotificationScreen() {
  const { startDeleting, stopDeleting } = useStore();
  const [notifications, setNotifications] = useState<GlobalNotif[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form Create
  const [message, setMessage] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const [saving, setSaving] = useState(false);

  const [statusModal, setStatusModal] = useState<{ visible: boolean, type: 'success' | 'error' | 'info', title: string, msg: string }>({ visible: false, type: 'info', title: '', msg: '' });

  useEffect(() => {
    const unsubscribe = db.collection('global_notifications')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          const list: GlobalNotif[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<GlobalNotif, 'id'> }));
          setNotifications(list);
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching notifications: ", error);
          setLoading(false);
        }
      );
    return () => unsubscribe();
  }, []);

  const handleCreate = async () => {
    if (!message.trim()) {
      setStatusModal({ visible: true, type: 'error', title: 'Empty Message', msg: 'Please enter a notification message.' });
      return;
    }
    setSaving(true);
    try {
      // ─── STEP 6: Send real push notifications via Expo Push API ───
      // Fetch all registered user tokens from Firestore
      const usersSnap = await db.collection('users')
        .where('expoPushToken', '!=', null)
        .get();

      const tokens: string[] = usersSnap.docs
        .map(doc => doc.data().expoPushToken)
        .filter((t: any) => typeof t === 'string' && t.startsWith('ExponentPushToken'));

      console.log(`[Push Broadcast] Sending to ${tokens.length} device(s)`);

      // Expo Push API accepts up to 100 messages per request
      const BATCH_SIZE = 100;
      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const messages = batch.map(token => ({
          to: token,
          sound: 'default',
          title: 'Mile Mint',
          body: message.trim(),
          data: { type: 'broadcast', targetVersion: targetVersion.trim() || null },
          channelId: 'default',
        }));

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });

        const result = await response.json();
        console.log('[Push Broadcast] Expo API response:', JSON.stringify(result));
      }

      // Save the broadcast record to Firestore for in-app display
      await db.collection('global_notifications').add({
        message: message.trim(),
        targetVersion: targetVersion.trim() || null,
        active: true,
        createdAt: new Date().toISOString(),
        recipientCount: tokens.length,
      });

      setMessage('');
      setTargetVersion('');
      setStatusModal({
        visible: true,
        type: 'success',
        title: 'Sent Broadcast',
        msg: `Push sent to ${tokens.length} device(s) and notification is now live.`,
      });
    } catch (e: any) {
      console.error('[Push Broadcast] Error:', e);
      setStatusModal({ visible: true, type: 'error', title: 'Error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await db.collection('global_notifications').doc(id).update({ active: !currentStatus });
    } catch (e: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', msg: e.message });
    }
  };
  
  const deleteNotif = async (id: string) => {
    startDeleting();
    try {
      await db.collection('global_notifications').doc(id).delete();
    } catch (e: any) {
      setStatusModal({ visible: true, type: 'error', title: 'Error', msg: e.message });
    } finally {
      stopDeleting();
    }
  };

  const renderNotif = ({ item, index }: { item: GlobalNotif, index: number }) => (
    <AnimatedCard delay={index * 50} style={styles.notifCard} >
      <View style={styles.notifHeader}>
        <View style={[styles.badge, { backgroundColor: item.active ? COLORS.success : COLORS.textSecondary }]}>
          <Text style={styles.badgeText}>{item.active ? 'ACTIVE' : 'INACTIVE'}</Text>
        </View>
        <Text style={styles.notifDate}>{formatDisplayDate(item.createdAt.split('T')[0])}</Text>
      </View>
      
      <Text style={styles.notifMsg}>{item.message}</Text>
      
      {item.targetVersion && (
        <View style={styles.versionPill}>
          <Ionicons name="code-working" size={12} color={COLORS.primary} />
          <Text style={styles.versionText}>Target: v{item.targetVersion}</Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.smallBtn, { borderColor: item.active ? COLORS.warning : COLORS.success }]}
          onPress={() => toggleStatus(item.id!, item.active)}
        >
          <Text style={[styles.smallBtnText, { color: item.active ? COLORS.warning : COLORS.success }]}>
            {item.active ? 'Deactivate' : 'Publish'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.smallBtn, { borderColor: COLORS.danger, marginLeft: 12 }]}
          onPress={() => deleteNotif(item.id!)}
        >
          <Text style={[styles.smallBtnText, { color: COLORS.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </AnimatedCard>
  );

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <Header title="App Notifications" />
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          <AnimatedCard style={styles.composeCard}>
            <Text style={styles.composeTitle}>New Broadcast</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Message Body</Text>
              <TextInput 
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                placeholder="Important updates or news..."
                multiline
                value={message}
                onChangeText={setMessage}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target Version (Optional)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 1.0.0"
                value={targetVersion}
                onChangeText={setTargetVersion}
              />
            </View>

            <AnimatedButton title="Deploy Broadcast" onPress={handleCreate} loading={saving} style={{ marginTop: 10 }} />
          </AnimatedCard>

          <Text style={styles.sectionTitle}>Broadcast History</Text>
          
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={item => item.id!}
              renderItem={renderNotif}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No notifications broadcasted yet.</Text>
                </View>
              }
            />
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <CustomStatusModal 
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.msg}
        onClose={() => setStatusModal({ ...statusModal, visible: false })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, paddingBottom: 60 },
  composeCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, ...SHADOWS.medium, marginBottom: 32 },
  composeTitle: { ...TYPOGRAPHY.h2, color: COLORS.primary, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { ...TYPOGRAPHY.label, color: COLORS.text, marginBottom: 8, fontSize: 12 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border, padding: 16, ...TYPOGRAPHY.body, color: COLORS.text, height: 56 },
  sectionTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginBottom: 16 },
  notifCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', ...SHADOWS.soft },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  notifDate: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  notifMsg: { ...TYPOGRAPHY.body, color: COLORS.text, lineHeight: 22 },
  versionPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  versionText: { color: COLORS.primary, fontSize: 12, fontWeight: '600', marginLeft: 4 },
  actionRow: { flexDirection: 'row', marginTop: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 },
  smallBtn: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  smallBtnText: { fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary }
});
