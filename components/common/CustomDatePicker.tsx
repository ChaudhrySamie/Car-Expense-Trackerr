import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY } from '../../utils/theme';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatDisplayDate } from '../../utils/dateHelpers';

interface CustomDatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ label, value, onChange, placeholder = 'Select Date' }) => {
  const { colors } = useThemeColors();
  const [show, setShow] = useState(false);

  const dateValue = value ? new Date(value) : new Date();

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <TouchableOpacity 
        style={[styles.inputContainer, { backgroundColor: colors.background, borderColor: colors.border }]} 
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.primary} style={styles.icon} />
        <Text style={[styles.dateText, { color: colors.text }, !value && { color: colors.textSecondary }]}>
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()} // Prevent future dates for logs
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    ...TYPOGRAPHY.label,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  icon: {
    marginRight: 12,
  },
  dateText: {
    ...TYPOGRAPHY.body,
    flex: 1,
  },
});

export default CustomDatePicker;
