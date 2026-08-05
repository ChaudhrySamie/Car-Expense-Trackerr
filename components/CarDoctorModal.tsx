/**
 * CarDoctorModal.tsx
 *
 * Single-turn AI car-troubleshooting modal with 3 views:
 *   'disclaimer' → 'input' → 'response'
 *
 * NO question or answer text is stored anywhere.
 * Closing the modal resets state completely.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../hooks/useThemeColors';
import { SHADOWS, TYPOGRAPHY } from '../utils/theme';
import { useTranslation } from 'react-i18next';
import {
  checkUsage,
  incrementUsage,
  askCarDoctor,
  DAILY_LIMIT,
  UsageStatus,
} from '../utils/carDoctorApi';

type ActiveView = 'disclaimer' | 'input' | 'response';

interface CarDoctorModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
}

const ACCENT = '#8B5CF6';

function cleanAiResponse(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s+/g, '')
    .trim();
}

function parseCarDoctorResponse(text: string, disclaimerText: string): { points: string[]; disclaimer: string } {
  const cleaned = cleanAiResponse(text);
  const normalized = cleaned.replace(/\r\n/g, '\n').trim();
  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const points: string[] = [];
  let disclaimer = '';

  for (const line of lines) {
    if (line === disclaimerText) {
      disclaimer = disclaimerText;
      continue;
    }

    const numberedMatch = line.match(/^(?:\d+\.|\d+\))\s*(.*)$/);
    if (numberedMatch?.[1]) {
      points.push(numberedMatch[1].trim());
      continue;
    }

    const stripped = line.replace(/^[\-•*\s]+/, '').trim();
    points.push(stripped || line);
  }

  if (!disclaimer && cleaned.includes(disclaimerText)) {
    disclaimer = disclaimerText;
  }

  return {
    points: points.length > 0 ? points : [cleaned.replace(disclaimerText, '').trim()].filter(Boolean) as string[],
    disclaimer: disclaimer || disclaimerText,
  };
}

export default function CarDoctorModal({
  visible,
  onClose,
  userId,
}: CarDoctorModalProps) {
  const { colors, isDarkMode } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [activeView, setActiveView] = useState<ActiveView>('disclaimer');
  const [inputText, setInputText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const disclaimerText = t('car_doctor.disclaimer_text');

  const parsedAnswer = useMemo(
    () => parseCarDoctorResponse(answerText, disclaimerText),
    [answerText, disclaimerText]
  );

  // Quick symptom chips — labels come from translations, texts stay in English for the AI
  const QUICK_SYMPTOMS = useMemo(() => [
    { label: t('car_doctor.symptom_brakes'), text: 'My car brakes are making a squeaking sound when I press the brake pedal.' },
    { label: t('car_doctor.symptom_fuel'),   text: 'My car is consuming way more fuel than usual lately.' },
    { label: t('car_doctor.symptom_engine_light'), text: 'The check engine light came on on my dashboard.' },
    { label: t('car_doctor.symptom_ac'),     text: 'The car air conditioner is blowing warm air instead of cold.' },
    { label: t('car_doctor.symptom_crank'),  text: 'Engine cranks very slowly when starting up.' },
  ], [t]);

  const scale = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.9);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          bounciness: 8,
          speed: 16,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    setActiveView('disclaimer');
    setInputText('');
    setAnswerText('');
    setIsLoading(false);
    setUsageStatus(null);
    onClose();
  }, [onClose]);

  const handleContinue = useCallback(async () => {
    if (!userId) {
      handleClose();
      return;
    }
    setUsageLoading(true);
    try {
      const status = await checkUsage(userId);
      setUsageStatus(status);
    } catch {
      setUsageStatus({ allowed: true, remaining: DAILY_LIMIT, current: 0 });
    } finally {
      setUsageLoading(false);
      setActiveView('input');
    }
  }, [userId, handleClose]);

  const handleAsk = useCallback(async () => {
    if (!userId || !inputText.trim() || isLoading) return;

    let latestStatus: UsageStatus;
    try {
      latestStatus = await checkUsage(userId);
    } catch {
      latestStatus = usageStatus ?? { allowed: true, remaining: 1, current: 0 };
    }

    if (!latestStatus.allowed) {
      setUsageStatus(latestStatus);
      return;
    }

    setIsLoading(true);
    try {
      const answer = await askCarDoctor(inputText.trim());
      await incrementUsage(userId);

      const newRemaining = Math.max(0, latestStatus.remaining - 1);
      const updatedStatus: UsageStatus = {
        allowed: newRemaining > 0,
        remaining: newRemaining,
        current: latestStatus.current + 1,
      };
      setUsageStatus(updatedStatus);
      setAnswerText(answer);
      setActiveView('response');

      if (newRemaining === 0) {
        setTimeout(() => {
          Alert.alert(
            t('car_doctor.limit_reached_alert_title'),
            t('car_doctor.limit_reached_alert_msg'),
            [{ text: t('car_doctor.limit_reached_alert_btn') }]
          );
        }, 400);
      }
    } catch {
      Alert.alert(
        t('car_doctor.busy_title'),
        t('car_doctor.busy_msg'),
        [{ text: t('car_doctor.busy_btn') }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId, inputText, isLoading, usageStatus, t]);

  const handleAskAnother = useCallback(() => {
    setInputText('');
    setAnswerText('');
    setActiveView('input');
  }, []);

  if (!visible) return null;

  const remaining = usageStatus?.remaining ?? DAILY_LIMIT;
  const isLimitReached = usageStatus !== null && !usageStatus.allowed;
  const charCount = inputText.length;
  const bodyContentStyle = [styles.body, { paddingBottom: Math.max(insets.bottom, 12) }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 0}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityLabel={t('car_doctor.close')}
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              transform: [{ scale }],
              opacity: fadeAnim,
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          {/* ── Drag Indicator / Header Notch ─────────────────────────── */}
          <View style={[styles.sheetHandleRow, { paddingTop: Math.max(10, insets.top + 6) }]}> 
            <View style={[styles.sheetHandle, { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' }]} />
          </View>

          {/* ── Header ────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={[styles.iconBadge, { backgroundColor: ACCENT + '1C' }]}>
              <Ionicons name="medkit" size={24} color={ACCENT} />
            </View>
            <View style={styles.headerText}>
              <View style={styles.headerTitleRow}>
                <Text style={[styles.title, { color: colors.text }]}>{t('car_doctor.title')}</Text>
                <View style={styles.headerAiTag}>
                  <Ionicons name="sparkles" size={10} color="#FFF" style={{ marginRight: 2 }} />
                  <Text style={styles.headerAiTagText}>{t('car_doctor.ai_tag')}</Text>
                </View>
              </View>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('car_doctor.subtitle')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: isDarkMode ? colors.border : '#F1F5F9' }]}
              accessibilityRole="button"
              accessibilityLabel={t('car_doctor.close')}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* ── View: Disclaimer ────────────────────────────────────────── */}
          {activeView === 'disclaimer' && (
            <ScrollView
              contentContainerStyle={bodyContentStyle}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.disclaimerBox, { backgroundColor: isDarkMode ? '#1e1b4b' : '#EEF2FF', borderColor: isDarkMode ? '#312e81' : '#C7D2FE' }]}>
                <View style={styles.disclaimerHeader}>
                  <Ionicons name="shield-checkmark" size={20} color={ACCENT} />
                  <Text style={[styles.disclaimerTitle, { color: ACCENT }]}>{t('car_doctor.safe_guidance_title')}</Text>
                </View>
                <Text style={[styles.disclaimerText, { color: colors.text }]}>
                  {t('car_doctor.disclaimer_body')}{'\n\n'}
                  {'• '}<Text style={styles.bold}>{t('car_doctor.general_guidance')}</Text>{' — '}{t('car_doctor.general_guidance_note')}{'\n'}
                  {'• '}<Text style={styles.bold}>{t('car_doctor.privacy_note')}</Text>{' — '}{t('car_doctor.privacy_note_detail')}{'\n'}
                  {'• '}{t('car_doctor.daily_reset')}
                </Text>
              </View>

              <View style={[styles.limitPill, { backgroundColor: isDarkMode ? '#1e293b' : '#F8FAFC', borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                <Text style={[styles.limitPillText, { color: colors.textSecondary }]}>
                  {t('car_doctor.daily_limit_pill', { limit: DAILY_LIMIT })}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border, backgroundColor: isDarkMode ? colors.border : '#F1F5F9' }]}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                    {t('car_doctor.cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
                  onPress={handleContinue}
                  activeOpacity={0.8}
                  disabled={usageLoading}
                >
                  {usageLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>{t('car_doctor.start_diagnosis')}</Text>
                      <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── View: Input ─────────────────────────────────────────────── */}
          {activeView === 'input' && (
            <ScrollView
              contentContainerStyle={bodyContentStyle}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {isLimitReached ? (
                <View style={[styles.limitReachedBox, { backgroundColor: isDarkMode ? '#1c1917' : '#FFF7ED', borderColor: isDarkMode ? '#78350f' : '#FED7AA' }]}>
                  <Ionicons name="hourglass-outline" size={26} color="#F97316" style={{ marginBottom: 8 }} />
                  <Text style={[styles.limitReachedTitle, { color: '#F97316' }]}>
                    {t('car_doctor.daily_limit_title')}
                  </Text>
                  <Text style={[styles.limitReachedMsg, { color: colors.textSecondary }]}>
                    {t('car_doctor.daily_limit_msg', { limit: DAILY_LIMIT })}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={[styles.remainingBadge, { backgroundColor: isDarkMode ? '#1e1b4b' : '#EEF2FF', borderColor: isDarkMode ? '#312e81' : '#C7D2FE' }]}>
                    <Ionicons name="checkmark-circle" size={15} color={ACCENT} />
                    <Text style={[styles.remainingText, { color: ACCENT }]}>
                      {t('car_doctor.questions_left', { remaining, limit: DAILY_LIMIT })}
                    </Text>
                  </View>

                  {/* Quick Symptom Suggestion Chips */}
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('car_doctor.common_issues')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContainer}
                  >
                    {QUICK_SYMPTOMS.map((chip, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.chip, { backgroundColor: isDarkMode ? '#1e293b' : '#F1F5F9', borderColor: colors.border }]}
                        onPress={() => setInputText(chip.text)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, { color: colors.text }]}>{chip.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: isDarkMode ? colors.background : '#F8FAFC',
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder={t('car_doctor.input_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      maxLength={200}
                      value={inputText}
                      onChangeText={setInputText}
                      textAlignVertical="top"
                      editable={!isLoading}
                    />
                    <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                      {charCount}/200
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      styles.fullWidthBtn,
                      { backgroundColor: ACCENT },
                      (!inputText.trim() || isLoading) && styles.disabledBtn,
                    ]}
                    onPress={handleAsk}
                    activeOpacity={0.8}
                    disabled={!inputText.trim() || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.primaryBtnText}>{t('car_doctor.analyzing')}</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="sparkles" size={18} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.primaryBtnText}>{t('car_doctor.ask_btn')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.textBtn}
                onPress={handleClose}
                activeOpacity={0.6}
              >
                <Text style={[styles.textBtnLabel, { color: colors.textSecondary }]}>{t('car_doctor.close')}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── View: Response ──────────────────────────────────────────── */}
          {activeView === 'response' && (
            <ScrollView
              contentContainerStyle={bodyContentStyle}
              showsVerticalScrollIndicator={false}
            >
              <View style={[
                styles.remainingBadge,
                {
                  backgroundColor: isLimitReached
                    ? (isDarkMode ? '#1c1917' : '#FFF7ED')
                    : (isDarkMode ? '#1e1b4b' : '#EEF2FF'),
                  borderColor: isLimitReached
                    ? (isDarkMode ? '#78350f' : '#FED7AA')
                    : (isDarkMode ? '#312e81' : '#C7D2FE'),
                },
              ]}>
                <Ionicons
                  name={isLimitReached ? 'hourglass-outline' : 'checkmark-circle'}
                  size={15}
                  color={isLimitReached ? '#F97316' : ACCENT}
                />
                <Text style={[styles.remainingText, { color: isLimitReached ? '#F97316' : ACCENT }]}>
                  {isLimitReached
                    ? t('car_doctor.used_all_today', { limit: DAILY_LIMIT })
                    : t('car_doctor.remaining_today', { remaining, limit: DAILY_LIMIT })
                  }
                </Text>
              </View>

              {/* AI Answer card */}
              <View style={[
                styles.answerCard,
                {
                  backgroundColor: isDarkMode ? colors.background : '#F8FAFC',
                  borderColor: isDarkMode ? '#312e81' : '#C7D2FE',
                },
              ]}>
                <View style={styles.answerHeader}>
                  <View style={[styles.answerHeaderBadge, { backgroundColor: ACCENT + '20' }]}>
                    <Ionicons name="sparkles" size={14} color={ACCENT} />
                  </View>
                  <Text style={[styles.answerLabel, { color: ACCENT }]}>{t('car_doctor.diagnosis_label')}</Text>
                </View>
                {parsedAnswer.points.map((point, index) => (
                  <View key={index} style={styles.responsePointRow}>
                    <View style={[styles.responsePointNumber, { backgroundColor: ACCENT + '22' }]}> 
                      <Text style={[styles.responsePointNumberText, { color: ACCENT }]}>{index + 1}</Text>
                    </View>
                    <Text style={[styles.responsePointText, { color: colors.text }]}>{point}</Text>
                  </View>
                ))}
                <Text style={[styles.responseDisclaimer, { color: colors.textSecondary }]}> 
                  {parsedAnswer.disclaimer}
                </Text>
              </View>

              {!isLimitReached && (
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.fullWidthBtn, { backgroundColor: ACCENT }]}
                  onPress={handleAskAnother}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>{t('car_doctor.ask_another')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.outlineBtn,
                  { borderColor: colors.border, backgroundColor: isDarkMode ? colors.border : '#F1F5F9' },
                  !isLimitReached && { marginTop: 12 },
                  isLimitReached && styles.fullWidthBtn,
                ]}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.outlineBtnText, { color: colors.textSecondary }]}>{t('car_doctor.close')}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '88%',
    paddingBottom: 0,
    flex: 1,
    ...SHADOWS.medium,
  },
  sheetHandleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 38,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.h3,
    fontSize: 19,
    fontWeight: '800',
    marginRight: 8,
  },
  headerAiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  headerAiTagText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
    fontWeight: '500',
    fontSize: 12.5,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
  body: {
    padding: 20,
    paddingBottom: 30,
    flexGrow: 1,
  },
  disclaimerBox: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  disclaimerTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 15,
    fontWeight: '700',
  },
  disclaimerText: {
    ...TYPOGRAPHY.body,
    fontSize: 13.5,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  limitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 24,
    gap: 8,
  },
  limitPillText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12.5,
    fontWeight: '600',
  },
  remainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
    marginBottom: 16,
    gap: 8,
  },
  remainingText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
  },
  sectionLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 8,
  },
  chipsContainer: {
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  inputWrapper: {
    marginTop: 4,
  },
  textInput: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    minHeight: 110,
    ...TYPOGRAPHY.body,
    fontSize: 15,
    lineHeight: 22,
  },
  charCount: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 16,
  },
  limitReachedBox: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: 16,
  },
  limitReachedTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: 8,
  },
  limitReachedMsg: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  answerCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 20,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  answerHeaderBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  answerText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    lineHeight: 24,
  },
  responsePointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  responsePointNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  responsePointNumberText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    fontSize: 13,
  },
  responsePointText: {
    ...TYPOGRAPHY.body,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  responseDisclaimer: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  cancelBtnText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    fontSize: 15,
  },
  primaryBtn: {
    flex: 2,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  fullWidthBtn: {
    flex: 0,
    width: '100%',
  },
  primaryBtnText: {
    ...TYPOGRAPHY.body,
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  outlineBtn: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  outlineBtnText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    fontSize: 14,
  },
  textBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  textBtnLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 14,
    fontWeight: '600',
  },
});
