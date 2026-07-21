import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, Animated } from 'react-native';
import { COLORS, SHADOWS, ANIMATIONS } from '../../utils/theme';
import { useThemeColors } from '../../hooks/useThemeColors';

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
  disabled?: boolean;
  type?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function AnimatedButton({ 
  title, 
  onPress, 
  style, 
  textStyle, 
  loading, 
  disabled, 
  type = 'primary' 
}: AnimatedButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const { colors, isDarkMode } = useThemeColors();

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: ANIMATIONS.pressScale || 0.95,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getBgColor = () => {
    if (disabled) return isDarkMode ? '#1e293b' : '#CBD5E1';
    switch (type) {
      case 'primary': return colors.primary;
      case 'secondary': return colors.secondary;
      case 'danger': return colors.danger;
      case 'ghost': return 'transparent';
      default: return colors.primary;
    }
  };

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
      style={[
        styles.btn, 
        { backgroundColor: getBgColor(), transform: [{ scale }] },
        type !== 'ghost' && SHADOWS.soft,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={type === 'ghost' ? colors.primary : (disabled ? colors.textSecondary : "#FFF")} />
      ) : (
        <Text style={[
          styles.text, 
          { color: type === 'ghost' ? colors.primary : (disabled ? colors.textSecondary : "#FFF") },
          textStyle
        ]}>
          {title}
        </Text>
      )}
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
