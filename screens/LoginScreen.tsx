import React, { useState } from 'react';
import {  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,  KeyboardAvoidingView, Platform, ScrollView, Modal, Linking, Image  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../services/firebase';
import { useStore } from '../context/useStore';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CustomStatusModal from '../components/common/CustomStatusModal';
import { SHADOWS, TYPOGRAPHY } from '../utils/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import { getFriendlyErrorMessage } from '../utils/authErrors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigation = useNavigation<any>();
  const setUser = useStore(state => state.setUser);
  const { colors, isDarkMode } = useThemeColors();
  const insets = useSafeAreaInsets();

  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  const [deactivatedVisible, setDeactivatedVisible] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('auth.email_required'),
        message: t('common.fill_fields')
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) throw new Error('No user returned from Firebase');

      const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
      let name = firebaseUser.displayName || 'User';

      const userData = userDoc.data();
      if (userDoc.exists && userData) {
        if (userData.status === 'deactivated') {
          await auth.signOut();
          setLoading(false);
          setDeactivatedVisible(true);
          return;
        }
        if (userData.status === 'deleted') {
          await auth.signOut();
          setLoading(false);
          setStatusModal({
            visible: true,
            type: 'error',
            title: t('auth.deleted_title'),
            message: t('auth.deleted_msg')
          });
          return;
        }
        if (userData.name) {
          name = userData.name;
        }
      }

      const lastLogin = new Date().toISOString();
      await db.collection('users').doc(firebaseUser.uid).set({
        lastLogin
      }, { merge: true });

      setUser({ 
        uid: firebaseUser.uid, 
        email: firebaseUser.email, 
        name,
        maxVehicles: userData?.maxVehicles || 5
      });

      if (firebaseUser.email?.toLowerCase() === 'chaudhrysamie@gmail.com') {
        navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
      }

    } catch (error: any) {
      console.error(error);
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('auth.login_failed'),
        message: getFriendlyErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleForgotPassword = async () => {
    if (!email) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('auth.email_required'),
        message: t('auth.email_req_msg')
      });
      return;
    }
    
    setResetLoading(true);
    try {
      await auth.sendPasswordResetEmail(email);
      setStatusModal({
        visible: true,
        type: 'success',
        title: t('auth.reset_sent'),
        message: `${t('auth.reset_sent_msg', { email })}\n\n${t('auth.reset_spam_reminder')}`
      });
    } catch (error: any) {
      console.error(error);
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('auth.reset_failed'),
        message: getFriendlyErrorMessage(error)
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.backgroundShapes}>
            <View style={[styles.circleTopRight, { backgroundColor: isDarkMode ? '#1e293b' : '#E0F2FE' }]} />
            <View style={[styles.circleBottomLeft, { backgroundColor: isDarkMode ? '#1e293b' : '#E0F2FE' }]} />
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#1e293b' : colors.accentLight }]}>
              <Ionicons name="car-sport" size={48} color={colors.primary} />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>Mile Mint</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('auth.login_subtitle')}</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>{t('auth.email')}</Text>

                <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t('auth.email_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>{t('auth.password')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t('auth.password_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((visible) => !visible)}
                    style={styles.passwordVisibilityButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={21}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  onPress={handleForgotPassword} 
                  style={styles.forgotPasswordContainer}
                  disabled={resetLoading}
                >
                  <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
                    {resetLoading ? t('common.please_wait') : t('auth.forgot_password')}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>{t('auth.login_btn')}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.signupLinkContainer}>
                <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>{t('auth.no_account')} </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                  <Text style={[styles.signupLink, { color: colors.primary }]}>{t('auth.signup_btn')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('auth.developed_by')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomStatusModal
        {...statusModal}
        onClose={() => setStatusModal({ ...statusModal, visible: false })}
      />

      {/* Deactivated Account Modal */}
      <Modal visible={deactivatedVisible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent>
        <View style={styles.deactivatedOverlay}>
          <View style={[styles.deactivatedCard, { backgroundColor: colors.surface }]}>
            <View style={styles.deactivatedIconCircle}>
              <Ionicons name="lock-closed" size={40} color="#DC2626" />
            </View>
            <Text style={[styles.deactivatedTitle, { color: colors.text }]}>{t('auth.deactivated_title')}</Text>
            <Text style={[styles.deactivatedMessage, { color: colors.textSecondary }]}>
              {t('auth.deactivated_msg')}
            </Text>
            <View style={styles.contactCard}>
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>{t('auth.contact_admin')}</Text>
            </View>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:chaudhrysamie@gmail.com')} activeOpacity={0.7}>
              <Text style={[styles.contactEmail, { color: colors.primary }]}>chaudhrysamie@gmail.com</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.deactivatedCloseBtn, { backgroundColor: colors.primary }]} onPress={() => setDeactivatedVisible(false)} activeOpacity={0.8}>
              <Text style={styles.deactivatedCloseBtnText}>{t('auth.understood')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
  },
  backgroundShapes: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: -1,
  },
  circleTopRight: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  circleBottomLeft: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  card: {
    borderRadius: 32,
    padding: 32,
    ...SHADOWS.medium,
    marginTop: 80,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    ...TYPOGRAPHY.h1,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    ...TYPOGRAPHY.label,
    marginBottom: 8,
    fontSize: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  passwordVisibilityButton: {
    padding: 4,
    marginLeft: 8,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600' as any,
    marginBottom: -12
  },
  loginButton: {
    borderRadius: 16,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    ...SHADOWS.soft,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    ...TYPOGRAPHY.h3,
    fontSize: 17,
  },
  footerText: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    marginTop: 32,
    opacity: 0.7,
  },
  signupLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  signupLink: {
    ...TYPOGRAPHY.h3,
    fontSize: 14,
    fontWeight: '700',
  },
  deactivatedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  deactivatedCard: {
    borderRadius: 28,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  deactivatedIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  deactivatedTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  deactivatedMessage: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontSize: 14,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactLabel: {
    ...TYPOGRAPHY.caption,
    marginLeft: 6,
    fontWeight: '600' as any,
  },
  contactEmail: {
    ...TYPOGRAPHY.h3,
    fontSize: 15,
    marginBottom: 28,
    textDecorationLine: 'underline',
  },
  deactivatedCloseBtn: {
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    ...SHADOWS.soft,
  },
  deactivatedCloseBtnText: {
    color: '#FFF',
    ...TYPOGRAPHY.h3,
    fontSize: 16,
  },
});
