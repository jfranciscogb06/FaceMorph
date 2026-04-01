import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props { current?: number; total?: number; pct?: number; }

export default function ProgressBar({ current, total, pct: pctProp }: Props) {
  const pct = pctProp !== undefined ? pctProp : ((current! / total!) * 100);
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 4, marginBottom: 32 },
  fill: { height: 6, backgroundColor: '#000', borderRadius: 4 },
});
