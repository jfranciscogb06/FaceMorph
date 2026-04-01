import React, { useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import ProgressBar from '../ProgressBar';

const IMAGES = {
  distance_combined: require('../../assets/tips/distance_combined.png'),
  background_good:   require('../../assets/tips/background_good.png'),
  background_bad:    require('../../assets/tips/background_bad.png'),
  lighting_good:     require('../../assets/tips/lighting_good.png'),
  lighting_bad:      require('../../assets/tips/lighting_bad.png'),
  accessories_good:  require('../../assets/tips/accessories_good.png'),
  accessories_bad:   require('../../assets/tips/accessories_bad.png'),
  eyelevel_good:     require('../../assets/tips/eyelevel_good.png'),
  eyelevel_bad:      require('../../assets/tips/eyelevel_bad.png'),
  rotation_good:     require('../../assets/tips/rotation_good.png'),
  rotation_bad:      require('../../assets/tips/rotation_bad.png'),
  expression_good:   require('../../assets/tips/expression_good.png'),
  expression_bad:    require('../../assets/tips/expression_bad.png'),
} as const;

const TIPS = [
  {
    title: 'Distance & Zoom',
    body: [
      'Stand 2 meters back from the mirror.',
      'Use your back camera, not the front.',
      'Zoom in 2x so your face fills the frame.',
    ],
    combinedKey: 'distance_combined' as const,
  },
  {
    title: 'Background',
    body: [
      'Stand in front of a plain, light-colored wall.',
      'Remove clutter, shelves, or patterned decor.',
      'A clean background helps the AI read your features.',
    ],
    goodLabel: 'Plain wall',
    badLabel: 'Busy background',
    goodKey: 'background_good' as const,
    badKey: 'background_bad' as const,
  },
  {
    title: 'Lighting',
    body: [
      'Face a window or a front-facing light source.',
      'Soft, even light — no harsh shadows on your face.',
      'Avoid overhead or side-only lighting.',
    ],
    goodLabel: 'Even front light',
    badLabel: 'Dark / harsh light',
    goodKey: 'lighting_good' as const,
    badKey: 'lighting_bad' as const,
  },
  {
    title: 'Accessories & Hair',
    body: [
      'Remove glasses, hats, or anything covering your face.',
      'Pull hair fully back — forehead must be visible.',
      'Ears should be uncovered if possible.',
    ],
    goodLabel: 'Face clear',
    badLabel: 'Face covered',
    goodKey: 'accessories_good' as const,
    badKey: 'accessories_bad' as const,
  },
  {
    title: 'Eye Level',
    body: [
      'Hold the phone so it points straight at your face.',
      'Phone should be at the same height as your eyes.',
      'Avoid shooting up or down.',
    ],
    goodLabel: 'Phone at eye level',
    badLabel: 'Phone too low',
    goodKey: 'eyelevel_good' as const,
    badKey: 'eyelevel_bad' as const,
  },
  {
    title: 'Head Rotation',
    body: [
      'Face the mirror directly — no tilting sideways.',
      'Keep your chin level, not lifted or dropped.',
      'Straight-on gives the most accurate landmark data.',
    ],
    goodLabel: 'Head straight',
    badLabel: 'Head tilted',
    goodKey: 'rotation_good' as const,
    badKey: 'rotation_bad' as const,
  },
  {
    title: 'Expression',
    body: [
      'Keep a natural, neutral expression.',
      'Close your mouth and relax your jaw.',
      'No smiling — it changes your facial structure.',
    ],
    goodLabel: 'Neutral',
    badLabel: 'Smiling',
    goodKey: 'expression_good' as const,
    badKey: 'expression_bad' as const,
  },
];

interface Props { onNext: () => void; onBack: () => void; }

export default function PhotoTipsStep({ onNext, onBack }: Props) {
  const { width } = useWindowDimensions();
  const [tipIdx, setTipIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = tipIdx === TIPS.length - 1;

  function goTo(idx: number) {
    setTipIdx(idx);
    scrollRef.current?.scrollTo({ x: idx * width, animated: true });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.outer}>
        <View style={styles.header}>
          <ProgressBar pct={50 + (tipIdx / (TIPS.length - 1)) * 50} />
        </View>

        {/* Paged slides — all pre-rendered, no remount */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ width: width * TIPS.length }}
        >
          {TIPS.map((tip, i) => {
            const isCombined = 'combinedKey' in tip;
            return (
              <View key={i} style={[styles.slide, { width }]}>
                <Text style={styles.title}>{tip.title}</Text>

                {isCombined ? (
                  <Image
                    source={IMAGES[(tip as { combinedKey: keyof typeof IMAGES }).combinedKey]}
                    style={styles.combinedImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.illustrationRow}>
                    <View style={styles.panel}>
                      <Image
                        source={IMAGES[(tip as { goodKey: keyof typeof IMAGES }).goodKey]}
                        style={styles.panelImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.goodLabel}>✓  {(tip as { goodLabel: string }).goodLabel}</Text>
                    </View>
                    <View style={styles.panel}>
                      <Image
                        source={IMAGES[(tip as { badKey: keyof typeof IMAGES }).badKey]}
                        style={styles.panelImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.badLabel}>✗  {(tip as { badLabel: string }).badLabel}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.bodyBox}>
                  {tip.body.map((line, j) => (
                    <Text key={j} style={styles.bodyLine}>• {line}</Text>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Dots + buttons — fixed at bottom */}
        <View style={styles.footer}>
          <View style={styles.dots}>
            {TIPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === tipIdx && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.row}>
            <TouchableOpacity
              onPress={() => tipIdx > 0 ? goTo(tipIdx - 1) : onBack()}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => isLast ? onNext() : goTo(tipIdx + 1)}
              style={styles.nextBtn}
            >
              <Text style={styles.nextText}>{isLast ? 'Got it' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  outer: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16 },
  slide: { paddingHorizontal: 24, flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 16 },
  combinedImage: { width: '100%', height: 180, borderRadius: 14, marginBottom: 16 },
  illustrationRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  panel: { flex: 1, alignItems: 'center' },
  panelImage: { width: '100%', height: 200, borderRadius: 14 },
  goodLabel: { marginTop: 6, color: '#111', fontWeight: '600', fontSize: 12 },
  badLabel: { marginTop: 6, color: '#6b7280', fontWeight: '600', fontSize: 12 },
  bodyBox: { paddingTop: 4 },
  bodyLine: { fontSize: 16, color: '#374151', lineHeight: 26, marginBottom: 6 },
  footer: { paddingHorizontal: 24, paddingBottom: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e5e7eb' },
  dotActive: { backgroundColor: '#000', width: 18 },
  row: { flexDirection: 'row', gap: 12 },
  backBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  backText: { color: '#111', fontWeight: '600', fontSize: 15 },
  nextBtn: { flex: 1, backgroundColor: '#111', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  nextText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
