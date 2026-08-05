import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../context/useStore';
import { useThemeColors } from '../hooks/useThemeColors';
import { TYPOGRAPHY } from '../utils/theme';
import AnimatedButton from '../components/common/AnimatedButton';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Welcome to Mile Mint',
    subtitle: "Track your vehicle's fuel, expenses, and maintenance — all in one place.",
    isFirst: true,
  },
  {
    id: '2',
    title: 'Everything About Your Vehicle',
    isFeatures: true,
  },
  {
    id: '3',
    title: '100% Free — No Ads, No Charges',
    subtitle: 'Get started by adding your first vehicle.',
    isLast: true,
  }
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { setHasSeenOnboarding } = useStore();
  const { colors } = useThemeColors();
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== currentIndex && roundIndex >= 0 && roundIndex < SLIDES.length) {
      setCurrentIndex(roundIndex);
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error('Failed to save onboarding flag', error);
      // Failsafe: don't lock out the user
      setHasSeenOnboarding(true);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      
      <View style={styles.header}>
        {currentIndex < SLIDES.length - 1 ? (
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={completeOnboarding}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, index) => (
          <View key={slide.id} style={styles.slide}>
            
            {slide.isFirst && (
              <View style={styles.iconContainer}>
                <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
              </View>
            )}

            {slide.isFeatures && (
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
                    <Ionicons name="water-outline" size={24} color="#0EA5E9" />
                  </View>
                  <Text style={[styles.featureText, { color: colors.text }]}>Log fuel fill-ups and track mileage</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Ionicons name="cash-outline" size={24} color="#EF4444" />
                  </View>
                  <Text style={[styles.featureText, { color: colors.text }]}>Record expenses and service history</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <Ionicons name="notifications-outline" size={24} color="#F59E0B" />
                  </View>
                  <Text style={[styles.featureText, { color: colors.text }]}>Get reminders before payments or documents are due</Text>
                </View>
              </View>
            )}

            {slide.isLast && (
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 100, width: 140, height: 140, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="shield-checkmark-outline" size={64} color="#10B981" />
              </View>
            )}

            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
              {slide.subtitle && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{slide.subtitle}</Text>
              )}
            </View>

            {slide.isLast && (
              <AnimatedButton
                title="Get Started"
                onPress={completeOnboarding}
                style={styles.startButton}
              />
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dotContainer}>
          {SLIDES.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                i === currentIndex ? [styles.activeDot, { backgroundColor: colors.primary }] : [styles.inactiveDot, { backgroundColor: colors.border }]
              ]} 
            />
          ))}
        </View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipPlaceholder: {
    width: 60,
  },
  skipText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  iconContainer: {
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresList: {
    width: '100%',
    marginBottom: 40,
    alignItems: 'flex-start',
    paddingHorizontal: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureText: {
    ...TYPOGRAPHY.body,
    flex: 1,
    fontWeight: '500',
  },
  startButton: {
    width: '100%',
    maxWidth: 300,
    marginTop: 10,
  },
  footer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
  },
  inactiveDot: {
    width: 8,
  }
});
