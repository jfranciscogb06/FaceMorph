import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import ProgressBar from '../ProgressBar';
import { Ethnicity } from '../../lib/types';

const OPTIONS: { value: Ethnicity; label: string }[] = [
  { value: 'east_asian', label: 'East Asian' },
  { value: 'south_asian', label: 'South Asian' },
  { value: 'black_african', label: 'Black / African' },
  { value: 'hispanic', label: 'Hispanic' },
  { value: 'middle_eastern', label: 'Middle Eastern' },
  { value: 'native_american', label: 'Native American' },
  { value: 'pacific_islander', label: 'Pacific Islander' },
  { value: 'white_caucasian', label: 'White / Caucasian' },
];

interface Props { selected: Ethnicity[]; onToggle: (e: Ethnicity) => void; onNext: () => void; onBack: () => void; }

export default function EthnicityStep({ selected, onToggle, onNext, onBack }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressBar pct={200 / 6} />
        <Text style={styles.title}>Select your ethnicity</Text>
        <Text style={styles.subtitle}>You can select multiple options</Text>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.options}>
            {OPTIONS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                onPress={() => onToggle(value)}
                style={[styles.option, selected.includes(value) && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected.includes(value) && styles.optionTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.row}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNext}
            disabled={selected.length === 0}
            style={[styles.btn, selected.length === 0 && styles.btnDisabled]}
          >
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 24 },
  options: { gap: 10, paddingBottom: 16 },
  option: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionSelected: { borderColor: '#000', backgroundColor: '#000' },
  optionText: { fontSize: 15, fontWeight: '500', color: '#111' },
  optionTextSelected: { color: '#fff' },
  row: { flexDirection: 'row', gap: 12, paddingTop: 12, paddingBottom: 8 },
  backBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  backText: { color: '#111', fontWeight: '600', fontSize: 15 },
  btn: { flex: 1, backgroundColor: '#000', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
