import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import ProgressBar from '../ProgressBar';
import { Gender } from '../../lib/types';

interface Props { selected: Gender | null; onSelect: (g: Gender) => void; onNext: () => void; }

export default function GenderStep({ selected, onSelect, onNext }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressBar pct={100 / 6} />
        <Text style={styles.title}>Select your gender</Text>
        <Text style={styles.subtitle}>This helps us provide more accurate analysis</Text>

        <View style={styles.options}>
          {(['male', 'female'] as Gender[]).map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => onSelect(g)}
              style={[styles.option, selected === g && styles.optionSelected]}
            >
              <Text style={[styles.optionText, selected === g && styles.optionTextSelected]}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={onNext}
          disabled={!selected}
          style={[styles.btn, !selected && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 32 },
  options: { gap: 12, marginBottom: 24 },
  option: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  optionSelected: { borderColor: '#000', backgroundColor: '#000' },
  optionText: { fontSize: 15, fontWeight: '500', color: '#111' },
  optionTextSelected: { color: '#fff' },
  btn: { backgroundColor: '#000', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
