import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS } from '../../utils/theme';
import { useThemeColors } from '../../hooks/useThemeColors';

interface CustomStatusModalProps {
  visible: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  btnText?: string;
  onClose: () => void;
}

export default function CustomStatusModal({ visible, type, title, message, btnText = 'Dismiss', onClose }: CustomStatusModalProps) {
  const { colors } = useThemeColors();
  const scale = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 12,
      }).start();

      if (type === 'error') {
        const createShake = () => Animated.sequence([
          Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 10, duration: 100, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 10, duration: 100, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true })
        ]);
        createShake().start();
      }
    } else {
      scale.setValue(0);
      shake.setValue(0);
    }
  }, [visible, scale, shake, type]);

  const getIcon = () => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle' as any, color: colors.success };
      case 'error': return { name: 'close-circle' as any, color: colors.danger };
      case 'info': return { name: 'information-circle' as any, color: colors.primary };
    }
  };

  const icon = getIcon();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.content, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale }, { translateX: shake }] }]}>
          <Ionicons name={icon.name} size={80} color={icon.color} style={styles.icon} />
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: icon.color }]}>
            <Text style={styles.btnText}>{btnText}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.82)', // Deep, premium slate backdrop
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F1F5F9', // Subtle border for definition
    ...SHADOWS.medium,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
