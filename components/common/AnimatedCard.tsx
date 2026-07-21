import React, { useEffect, useRef } from 'react';
import { StyleSheet, ViewStyle, Animated, StyleProp } from 'react-native';
import { SHADOWS } from '../../utils/theme';
import { useThemeColors } from '../../hooks/useThemeColors';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export default function AnimatedCard({ children, style, delay = 0 }: AnimatedCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(opacity, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [opacity, translateY, delay]);

  const { colors } = useThemeColors();

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.surface, opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.soft,
  },
});
