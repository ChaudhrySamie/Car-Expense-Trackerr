import React, { useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Animated, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { SHADOWS } from '../utils/theme';
import { useTranslation } from 'react-i18next';

interface CarDoctorButtonProps {
  onPress: () => void;
  bottom?: number;
  showLabel?: boolean;
  compact?: boolean;
  inline?: boolean;
  style?: any;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function CarDoctorButton({
  onPress,
  bottom = 120,
  showLabel = true,
  compact = false,
  inline = false,
  style,
}: CarDoctorButtonProps) {
  const { colors, isDarkMode } = useThemeColors();
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const accent = '#8B5CF6';
  const buttonSize = compact ? 46 : 52;
  const iconSize = compact ? 20 : 24;
  const glowSize = compact ? 48 : 58;
  const glowOffset = compact ? 0 : -3;

  // When used inline (non-floating), render without absolute positioning and without aura label
  if (inline) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.inlineWrapper, style]}
        accessibilityRole="button"
        accessibilityLabel={`${t('car_doctor.label')} — AI`}
      >
        <View
          style={[
            styles.fab,
            compact && styles.compactFab,
            {
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              backgroundColor: compact ? (isDarkMode ? colors.surface : '#FFF') : accent,
              borderColor: accent,
              ...SHADOWS.medium,
            },
          ]}
        >
          <Ionicons
            name="medkit"
            size={iconSize}
            color={compact ? accent : '#FFF'}
          />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.wrapper,
        { bottom, transform: [{ scale }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${t('car_doctor.label')} — AI`}
    >
      {/* Glassmorphic Label Tag on the Left */}
      {showLabel && !compact && (
        <View
          style={[
            styles.labelContainer,
            {
              backgroundColor: isDarkMode ? 'rgba(30, 27, 75, 0.85)' : 'rgba(255, 255, 255, 0.92)',
              borderColor: isDarkMode ? 'rgba(139, 92, 246, 0.35)' : 'rgba(139, 92, 246, 0.25)',
            },
          ]}
        >
          <Text style={[styles.labelText, { color: isDarkMode ? '#E0E7FF' : '#4C1D95' }]}>
            {t('car_doctor.label')}
          </Text>
          <View style={styles.aiChip}>
            <Ionicons name="sparkles" size={9} color="#FFF" style={{ marginRight: 2 }} />
            <Text style={styles.aiChipText}>AI</Text>
          </View>
        </View>
      )}

      {/* Pulse Aura behind FAB */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            borderColor: accent + (isDarkMode ? '77' : '44'),
            transform: [{ scale: pulse }],
            width: glowSize,
            height: glowSize,
            right: glowOffset,
            top: glowOffset,
          },
        ]}
        pointerEvents="none"
      />

      {/* Circular FAB */}
      <View
        style={[
          styles.fab,
          compact && styles.compactFab,
          {
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            backgroundColor: compact ? (isDarkMode ? colors.surface : '#FFF') : accent,
            borderColor: accent,
            ...SHADOWS.medium,
          },
        ]}
      >
        <Ionicons
          name="medkit"
          size={iconSize}
          color={compact ? accent : '#FFF'}
        />
      </View>
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 22,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
    ...SHADOWS.soft,
  },
  labelText: {
    fontWeight: '700',
    fontSize: 12.5,
    letterSpacing: 0.2,
    marginRight: 6,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  aiChipText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  glowRing: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactFab: {
    borderWidth: 1.5,
  },
});
