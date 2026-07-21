import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../services/firebase';
import { useStore } from '../context/useStore';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CustomStatusModal from '../components/common/CustomStatusModal';
import { SHADOWS, TYPOGRAPHY } from '../utils/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import { getFriendlyErrorMessage } from '../utils/authErrors';

export default function SignupScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const setUser = useStore(state => state.setUser);
  const { colors, isDarkMode } = useThemeColors();

  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('auth.email_required'),
        message: t('common.fill_fields')
      });
      return;
    }

    if (password !== confirmPassword) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('auth.pass_mismatch_title'),
        message: t('auth.pass_mismatch_msg')
      });
      return;
    }

    if (password.length < 6) {
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('auth.weak_pass_title'),
        message: t('auth.weak_pass_msg')
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) throw new Error('Failed to create account.');

      await firebaseUser.updateProfile({ displayName: name });

      await db.collection('users').doc(firebaseUser.uid).set({
        name,
        email,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        status: 'active'
      });

      setUser({ 
        uid: firebaseUser.uid, 
        email: firebaseUser.email, 
        name,
        maxVehicles: 5
      });

      if (email.toLowerCase() === 'chaudhrysamie@gmail.com') {
        navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
      }

    } catch (error: any) {
      console.error(error);
      setStatusModal({
        visible: true,
        type: 'error',
        title: t('auth.registration_failed'),
        message: getFriendlyErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.backgroundShapes}>
            <View style={[styles.circleTopRight, { backgroundColor: isDarkMode ? '#1e293b' : '#E0F2FE' }]} />
            <View style={[styles.circleBottomLeft, { backgroundColor: isDarkMode ? '#1e293b' : '#E0F2FE' }]} />
          </View>

          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#1e293b' : colors.accentLight }]}>
              <Ionicons name="person-add" size={48} color={colors.primary} />
            </View>
            
            <Text style={[styles.title, { color: colors.text }]}>{t('auth.create_account')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('auth.signup_subtitle')}</Text>

            <View style={[styles.infoNote, { backgroundColor: isDarkMode ? '#1e293b' : '#EFF6FF', borderColor: isDarkMode ? colors.primary : '#DBEAFE' }]}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={[styles.noteText, { color: colors.primary }]}>{t('auth.signup_note')}</Text>

            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>{t('auth.full_name')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t('auth.name_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>

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
                    placeholder={t('auth.pass_placeholder_new')}
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
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>{t('auth.confirm_password')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t('auth.pass_placeholder_confirm')}
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword((visible) => !visible)}
                    style={styles.passwordVisibilityButton}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.signupButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]} 
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.signupButtonText}>{t('auth.signup_btn')}</Text>
                )}
              </TouchableOpacity>
            </View>
            
            <View style={styles.loginLinkContainer}>
              <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>{t('auth.have_account')} </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.loginLink, { color: colors.primary }]}>{t('auth.login_btn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomStatusModal 
        {...statusModal} 
        onClose={() => setStatusModal({ ...statusModal, visible: false })} 
      />
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
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 60,
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
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 0 : 10,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  card: {
    borderRadius: 32,
    padding: 28,
    ...SHADOWS.medium,
    marginTop: 80,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  noteText: {
    ...TYPOGRAPHY.caption,
    marginLeft: 10,
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 16,
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
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  passwordVisibilityButton: {
    padding: 4,
    marginLeft: 8,
  },
  signupButton: {
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    ...SHADOWS.soft,
  },
  disabledButton: {
    opacity: 0.7,
  },
  signupButtonText: {
    color: '#FFFFFF',
    ...TYPOGRAPHY.h3,
    fontSize: 16,
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  loginLink: {
    ...TYPOGRAPHY.h3,
    fontSize: 14,
    fontWeight: '700',
  },
});
