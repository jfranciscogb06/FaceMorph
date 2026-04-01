import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const STAGES = [
  'Mapping 68 landmark points across your face...',
  'Computing bilateral symmetry across 6 paired features...',
  'Measuring inter-pupillary to cheekbone ratio...',
  'Scoring jawline angularity and definition...',
  'Evaluating facial thirds against ideal proportions...',
  'Cross-referencing 4,000+ facial structure data points...',
  'Drafting your personalized improvement report...',
];

export default function AnalyzingStep() {
  const [stageIdx, setStageIdx] = useState(0);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const MAX_PROGRESS = 0.85;

  useEffect(() => {
    // Start bar immediately at first step
    Animated.timing(progressAnim, {
      toValue: (1 / STAGES.length) * MAX_PROGRESS,
      duration: 600,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setStageIdx((i) => {
        const next = i < STAGES.length - 1 ? i + 1 : i;
        Animated.timing(progressAnim, {
          toValue: Math.min(((next + 1) / STAGES.length) * MAX_PROGRESS, MAX_PROGRESS),
          duration: 800,
          useNativeDriver: false,
        }).start();
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const METRICS = ['Symmetry', 'Proportions', 'Structure', 'Jawline', 'Skin', 'Ratios'];

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, { opacity: pulseAnim }]}>
        <View style={styles.ringInner}>
          <View style={styles.reticleH} />
          <View style={styles.reticleV} />
          <View style={styles.reticleDot} />
        </View>
      </Animated.View>

      <Text style={styles.title}>Analyzing your face</Text>
      <Text style={styles.subtitle}>Running deep facial structure analysis</Text>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <Text style={styles.stage}>{STAGES[stageIdx]}</Text>

      <View style={styles.grid}>
        {METRICS.map((m) => (
          <View key={m} style={styles.metricCard}>
            <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
            <Text style={styles.metricLabel}>{m}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  ring: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#111', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  ringInner: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(17,17,17,0.2)', alignItems: 'center', justifyContent: 'center' },
  reticleH: { position: 'absolute', left: 8, right: 8, height: 1, backgroundColor: 'rgba(17,17,17,0.35)' },
  reticleV: { position: 'absolute', top: 8, bottom: 8, width: 1, backgroundColor: 'rgba(17,17,17,0.35)' },
  reticleDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#111' },
  title: { color: '#111', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280', fontSize: 13, marginBottom: 28, textAlign: 'center' },
  progressTrack: { width: '100%', height: 3, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: 3, backgroundColor: '#111', borderRadius: 4 },
  stage: { color: '#111', fontSize: 13, fontWeight: '500', marginBottom: 32, textAlign: 'center', minHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  metricCard: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', gap: 4, width: '28%' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#111' },
  metricLabel: { color: '#6b7280', fontSize: 10 },
});
