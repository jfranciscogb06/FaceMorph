import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props { score: number; size?: number; }

function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }
function scoreColor(s: number) {
  const t = Math.max(0, Math.min(1, s / 10));
  // red(0) → yellow(0.5) → green(1)
  const r = t < 0.5 ? lerp(220, 250, t * 2) : lerp(250, 34, (t - 0.5) * 2);
  const g = t < 0.5 ? lerp(60, 200, t * 2)  : lerp(200, 197, (t - 0.5) * 2);
  const b = t < 0.5 ? lerp(60, 40, t * 2)   : lerp(40, 94, (t - 0.5) * 2);
  return `rgb(${r},${g},${b})`;
}

export default function ScoreRing({ score, size = 110 }: Props) {
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 10) * circumference;
  const color = scoreColor(score);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1e1e1e" strokeWidth={strokeWidth} />
        <Circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={[styles.score, { color, fontSize: size * 0.24 }]}>{score.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  score: { fontSize: 26, fontWeight: '700' },
});
