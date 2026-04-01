import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props { feature: string; score: number; observation: string; tip: string; }

export default function FeatureCard({ feature, score, observation, tip }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{feature}</Text>
        <Text style={styles.score}>{score.toFixed(1)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(score / 10) * 100}%` }]} />
      </View>
      <Text style={styles.obs}>{observation}</Text>
      <Text style={styles.tip}>{tip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 14, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { color: '#111', fontWeight: '600', fontSize: 14 },
  score: { fontWeight: '700', fontSize: 14, color: '#111' },
  track: { height: 3, backgroundColor: '#e5e7eb', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 4, backgroundColor: '#111' },
  obs: { color: '#6b7280', fontSize: 12, marginBottom: 4 },
  tip: { color: '#9ca3af', fontSize: 12 },
});
