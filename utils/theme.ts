import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  primary: '#0EA5E9',    // Sky Blue
  secondary: '#8B5CF6',  // Violet
  success: '#10B981',    // Emerald
  danger: '#EF4444',     // Red
  warning: '#F59E0B',    // Amber
  background: '#F8FAFC', // Slate 50
  surface: '#FFFFFF',
  text: '#0F172A',       // Slate 900
  textSecondary: '#64748B', // Slate 500
  border: '#E2E8F0',     // Slate 200
  cardShadow: 'rgba(0, 0, 0, 0.05)',
  accentLight: '#E0F2FE',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const SIZES = {
  width,
  height,
  radius: 20,
  btnHeight: 56,
  padding: 20,
};

export const SHADOWS = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
};

export const ANIMATIONS = {
  pressScale: 0.97,
  duration: 300,
  spring: {
    damping: 15,
    stiffness: 150,
  },
};
