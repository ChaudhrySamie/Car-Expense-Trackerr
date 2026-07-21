import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';

interface AnimatedProgressBarProps {
  percentage: number;
  color?: string;
  delay?: number;
}

export default function AnimatedProgressBar({ percentage, color, delay = 0 }: AnimatedProgressBarProps) {
  const { colors, isDarkMode } = useThemeColors();
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(widthAnim, {
        toValue: percentage,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start();
  }, [percentage, widthAnim, delay]);

  const width = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const barColor = color || colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? colors.border : '#F1F5F9' }]}>
      <Animated.View style={[styles.bar, { backgroundColor: barColor, width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
});
