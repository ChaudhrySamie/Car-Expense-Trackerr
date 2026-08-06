import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, View } from 'react-native';

export default function AppSplashScreen() {
  const progress = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 0.86, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0.12, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <ImageBackground source={require('../../assets/splash.png')} style={styles.background} resizeMode="cover">
      <View style={styles.loadingArea}>
        <View style={styles.loadingPill}>
          <View style={styles.track}>
            <Animated.View style={[styles.progress, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%', backgroundColor: '#020B1E' },
  loadingArea: { position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center' },
  loadingPill: { width: 124, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18, backgroundColor: 'rgba(2, 11, 30, 0.58)', borderWidth: 1, borderColor: 'rgba(125, 244, 219, 0.3)' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  progress: { height: '100%', borderRadius: 3, backgroundColor: '#63E6CF' },
});
