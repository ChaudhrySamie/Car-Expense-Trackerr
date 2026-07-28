import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, TouchableWithoutFeedback, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOWS, TYPOGRAPHY } from '../../utils/theme';
import { useThemeColors } from '../../hooks/useThemeColors';

interface Option {
  label: string;
  onPress: () => void;
  icon?: string;
  destructive?: boolean;
}

interface SelectionModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: Option[];
  onClose: () => void;
}

export default function SelectionModal({ visible, title, subtitle, options, onClose }: SelectionModalProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { colors, isDarkMode } = useThemeColors();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>
        
        <Animated.View style={[
          styles.content,
          {
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
            transform: [{ translateY: slideAnim }],
          },
        ]}>
          <View style={[styles.indicator, { backgroundColor: colors.border }]} />
          
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
          
          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.optionItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  option.onPress();
                  onClose();
                }}
                activeOpacity={0.6}
              >
                <View style={[
                  styles.iconContainer, 
                  { backgroundColor: option.destructive ? (isDarkMode ? '#450a0a' : '#FEF2F2') : colors.accentLight }
                ]}>
                  <Ionicons 
                    name={option.icon as any || 'ellipse-outline'} 
                    size={22} 
                    color={option.destructive ? colors.danger : colors.primary} 
                  />
                </View>
                <Text style={[
                  styles.optionLabel, 
                  { color: colors.text },
                  option.destructive && { color: colors.danger }
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: isDarkMode ? colors.border : '#F1F5F9' }]} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  content: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...SHADOWS.medium,
  },
  indicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    marginTop: 4,
  },
  optionsContainer: {
    marginTop: 24,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionLabel: {
    ...TYPOGRAPHY.body,
    fontWeight: '600' as any,
  },
  cancelBtn: {
    marginTop: 16,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700' as any,
  },
});
