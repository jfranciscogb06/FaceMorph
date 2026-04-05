import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

interface Props {
  onDone: () => void;
}

export default function OnboardingStep({ onDone }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.top}>
          <View style={styles.iconBox}>
            <Text style={styles.iconEmoji}>◉</Text>
          </View>
          <Text style={styles.appName}>Mogify</Text>
          <Text style={styles.tagline}>
            AI-powered facial analysis.{'\n'}
            Understand your features.{'\n'}
            Track your progress.
          </Text>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity style={styles.btn} onPress={onDone}>
            <Text style={styles.btnText}>Get started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between', paddingBottom: 40 },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  iconBox: {
    width: 100, height: 100, borderRadius: 24,
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  iconEmoji: { fontSize: 48, color: '#fff' },
  appName: { fontSize: 36, fontWeight: '800', color: '#111', letterSpacing: -0.5 },
  tagline: {
    fontSize: 17, color: '#6b7280', textAlign: 'center',
    lineHeight: 26,
  },
  bottom: { gap: 14 },
  btn: {
    backgroundColor: '#111', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
