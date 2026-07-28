import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';

interface CustomLoaderProps {
  visible?: boolean;
  message?: string;
  size?: number;
}

export default function CustomLoader({
  visible = true,
  message = 'Deleting...',
  size = 50,
}: CustomLoaderProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { colors, isDarkMode } = useThemeColors();

  useEffect(() => {
    if (visible) {
      rotateAnim.setValue(0);
      fadeAnim.setValue(0);
      const rotation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      const fadeIn = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      const animation = Animated.parallel(
        [rotation, fadeIn]
      );
      animation.start();
      return () => {
        animation.stop();
      };
    }
  }, [fadeAnim, visible, rotateAnim]);

  if (!visible) return null;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const cardScale = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent>
      <View
        style={[styles.overlay, { backgroundColor: isDarkMode ? 'rgba(2, 6, 23, 0.82)' : 'rgba(15, 23, 42, 0.52)' }]}
        accessibilityViewIsModal
      >
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: isDarkMode ? '#000000' : colors.primary,
              opacity: fadeAnim,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <View style={[styles.spinnerArea, { width: size, height: size }]}>
            <View style={[styles.spinnerTrack, { width: size, height: size, borderRadius: size / 2, borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />
            <Animated.View
              style={[
                styles.loaderRing,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderTopColor: colors.danger,
                  borderRightColor: colors.danger,
                  borderBottomColor: 'transparent',
                  borderLeftColor: 'transparent',
                  transform: [{ rotate: spin }],
                },
              ]}
            />
          </View>
          <View style={styles.titleRow}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.title, { color: colors.text }]}>Removing item</Text>
          </View>
          {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>Please wait a moment</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  container: {
    width: 250,
    paddingVertical: 28,
    paddingHorizontal: 30,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 18,
  },
  spinnerArea: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerTrack: {
    position: 'absolute',
    borderWidth: 4,
  },
  loaderRing: {
    position: 'absolute',
    borderWidth: 4,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
  },
});
