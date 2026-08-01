import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TYPOGRAPHY } from '../../utils/theme';
import { useThemeColors } from '../../hooks/useThemeColors';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  alignLeft?: boolean;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  onBackPress?: () => void;
}

export default function Header({ 
  title, 
  subtitle, 
  showBack = true, 
  alignLeft = false,
  leftElement,
  rightElement, 
  onBackPress 
}: HeaderProps) {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top }]}>
      <View style={styles.content}>
        {(showBack || leftElement) && (
          <View style={styles.sideColumn}>
            {showBack ? (
              <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.6}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            ) : leftElement}
          </View>
        )}
        
        <View style={[
          styles.titleContainer, 
          alignLeft && styles.titleContainerLeft,
          !(showBack || leftElement) && { marginLeft: 0 }
        ]}>
          <Text style={[styles.title, { color: colors.text }, alignLeft && styles.textLeft]} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }, alignLeft && styles.textLeft]} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          )}
        </View>

        <View style={[styles.sideColumn, { alignItems: 'flex-end' }]}>
          {rightElement || <View style={{ width: 40 }} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    zIndex: 10    
  },
  content: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sideColumn: {
    width: 48,
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  titleContainerLeft: {
    alignItems: 'flex-start',
    marginLeft: 0,
  },
  title: {
    ...TYPOGRAPHY.h3,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    marginTop: -2,
  },
  textLeft: {
    textAlign: 'left',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
});
