import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const LIGHT_COLORS = {
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

export const DARK_COLORS = {
  primary: '#38BDF8',    // Brighter Sky Blue for dark
  secondary: '#A78BFA',  // Lighter Violet
  success: '#34D399',    // Lighter Emerald
  danger: '#F87171',     // Lighter Red
  warning: '#FBBF24',    // Lighter Amber
  background: '#0F172A', // Slate 900
  surface: '#1E293B',    // Slate 800
  text: '#F8FAFC',       // Slate 50
  textSecondary: '#94A3B8', // Slate 400
  border: '#334155',     // Slate 700
  cardShadow: 'rgba(0, 0, 0, 0.3)',
  accentLight: '#0C4A6E', // Darker Sky Blue
};

// Default export for backward compatibility where possible, 
// but screens should ideally call getColors(isDarkMode)
export const COLORS = LIGHT_COLORS;

export const getThemeColors = (isDarkMode: boolean) => isDarkMode ? DARK_COLORS : LIGHT_COLORS;

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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  medium: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 12,
  },
};

export const TYPOGRAPHY = {
  h1: { fontSize: 28, fontWeight: '800' as any, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as any, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '700' as any, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as any, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500' as any, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600' as any, textTransform: 'uppercase' as any, letterSpacing: 0.5 },
};

export const ANIMATIONS = {
  pressScale: 0.96,
  duration: 250,
  spring: {
    damping: 18,
    stiffness: 160,
  },
};
