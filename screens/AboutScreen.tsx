import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About App</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoCircle}>
          <Ionicons name="car-sport" size={80} color="#0EA5E9" />
        </View>
        
        <Text style={styles.appName}>Car Expense Tracker</Text>
        <Text style={styles.version}>Version 1.0.0</Text>

        <View style={styles.card}>
          <Text style={styles.description}>
            This application is designed to help car owners track their vehicle expenses efficiently. 
            Manage multiple car profiles, log mechanical and electrical repairs, track oil changes 
            with mileage calculations, and keep an eye on your finance installments.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.builtBy}>Built by</Text>
          <Text style={styles.authorName}>Chaudhry Samie</Text>
          
          <TouchableOpacity style={styles.contactBtn} onPress={() => Alert.alert("Contact", "Link to profile or portfolio could go here.")}>
            <Text style={styles.contactText}>View Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  content: { padding: 30, alignItems: 'center' },
  logoCircle: {
    width: 150, height: 150, borderRadius: 75, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: '#0EA5E9', shadowOpacity: 0.1, shadowRadius: 20, elevation: 5
  },
  appName: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', marginBottom: 5 },
  version: { fontSize: 14, color: '#94A3B8', marginBottom: 30 },
  card: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    marginBottom: 40
  },
  description: { fontSize: 16, lineHeight: 24, color: '#475569', textAlign: 'center' },
  footer: { alignItems: 'center' },
  builtBy: { fontSize: 14, color: '#64748B' },
  authorName: { fontSize: 20, fontWeight: 'bold', color: '#0EA5E9', marginTop: 4 },
  contactBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: '#E0F2FE' },
  contactText: { color: '#0EA5E9', fontWeight: 'bold' }
});
