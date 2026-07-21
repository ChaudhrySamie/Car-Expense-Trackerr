import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '../hooks/useThemeColors';

export default function AboutScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors, isDarkMode } = useThemeColors();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('about.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.logoCircle, { backgroundColor: colors.surface, shadowColor: colors.primary }]}>
          <Ionicons name="car-sport" size={80} color={colors.primary} />
        </View>
        
        <Text style={[styles.appName, { color: colors.text }]}>Car Expense Tracker</Text>
        <Text style={[styles.version, { color: colors.textSecondary }]}>Version 1.0.0</Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('about.description')}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.builtBy, { color: colors.textSecondary }]}>{t('about.built_by')}</Text>
          <Text style={[styles.authorName, { color: colors.primary }]}>Chaudhry Samie</Text>
          
          <TouchableOpacity 
            style={[styles.contactBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#E0F2FE' }]} 
            onPress={() => Alert.alert(t('about.title'), t('auth.developed_by'))}
          >
            <Text style={[styles.contactText, { color: colors.primary }]}>{t('about.view_profile')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { padding: 30, alignItems: 'center' },
  logoCircle: {
    width: 150, height: 150, borderRadius: 75,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 5
  },
  appName: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  version: { fontSize: 14, marginBottom: 30 },
  card: {
    borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    marginBottom: 40
  },
  description: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  footer: { alignItems: 'center' },
  builtBy: { fontSize: 14 },
  authorName: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  contactBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  contactText: { fontWeight: 'bold' }
});
