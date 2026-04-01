import React, { useRef, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, useWindowDimensions,
} from 'react-native';
import ProgressBar from './ProgressBar';
import { Gender, Ethnicity } from '../lib/types';

// ─── Tip assets ───────────────────────────────────────────────────────────────

const IMAGES = {
  distance_combined: require('../assets/tips/distance_combined.png'),
  background_good:   require('../assets/tips/background_good.png'),
  background_bad:    require('../assets/tips/background_bad.png'),
  lighting_good:     require('../assets/tips/lighting_good.png'),
  lighting_bad:      require('../assets/tips/lighting_bad.png'),
  accessories_good:  require('../assets/tips/accessories_good.png'),
  accessories_bad:   require('../assets/tips/accessories_bad.png'),
  eyelevel_good:     require('../assets/tips/eyelevel_good.png'),
  eyelevel_bad:      require('../assets/tips/eyelevel_bad.png'),
  rotation_good:     require('../assets/tips/rotation_good.png'),
  rotation_bad:      require('../assets/tips/rotation_bad.png'),
  expression_good:   require('../assets/tips/expression_good.png'),
  expression_bad:    require('../assets/tips/expression_bad.png'),
} as const;

const TIPS = [
  {
    title: 'Distance & Zoom',
    body: ['Stand 2 meters back from the mirror.', 'Use your back camera, not the front.', 'Zoom in 2x so your face fills the frame.'],
    combinedKey: 'distance_combined' as const,
  },
  {
    title: 'Background',
    body: ['Stand in front of a plain, light-colored wall.', 'Remove clutter, shelves, or patterned decor.', 'A clean background helps the AI read your features.'],
    goodLabel: 'Plain wall', badLabel: 'Busy background',
    goodKey: 'background_good' as const, badKey: 'background_bad' as const,
  },
  {
    title: 'Lighting',
    body: ['Face a window or a front-facing light source.', 'Soft, even light — no harsh shadows on your face.', 'Avoid overhead or side-only lighting.'],
    goodLabel: 'Even front light', badLabel: 'Dark / harsh light',
    goodKey: 'lighting_good' as const, badKey: 'lighting_bad' as const,
  },
  {
    title: 'Accessories & Hair',
    body: ['Remove glasses, hats, or anything covering your face.', 'Pull hair fully back — forehead must be visible.', 'Ears should be uncovered if possible.'],
    goodLabel: 'Face clear', badLabel: 'Face covered',
    goodKey: 'accessories_good' as const, badKey: 'accessories_bad' as const,
  },
  {
    title: 'Eye Level',
    body: ['Hold the phone so it points straight at your face.', 'Phone should be at the same height as your eyes.', 'Avoid shooting up or down.'],
    goodLabel: 'Phone at eye level', badLabel: 'Phone too low',
    goodKey: 'eyelevel_good' as const, badKey: 'eyelevel_bad' as const,
  },
  {
    title: 'Head Rotation',
    body: ['Face the mirror directly — no tilting sideways.', 'Keep your chin level, not lifted or dropped.', 'Straight-on gives the most accurate landmark data.'],
    goodLabel: 'Head straight', badLabel: 'Head tilted',
    goodKey: 'rotation_good' as const, badKey: 'rotation_bad' as const,
  },
  {
    title: 'Expression',
    body: ['Keep a natural, neutral expression.', 'Close your mouth and relax your jaw.', 'No smiling — it changes your facial structure.'],
    goodLabel: 'Neutral', badLabel: 'Smiling',
    goodKey: 'expression_good' as const, badKey: 'expression_bad' as const,
  },
];

const ETHNICITY_OPTIONS: { value: Ethnicity; label: string }[] = [
  { value: 'east_asian',       label: 'East Asian' },
  { value: 'south_asian',      label: 'South Asian' },
  { value: 'black_african',    label: 'Black / African' },
  { value: 'hispanic',         label: 'Hispanic' },
  { value: 'middle_eastern',   label: 'Middle Eastern' },
  { value: 'native_american',  label: 'Native American' },
  { value: 'pacific_islander', label: 'Pacific Islander' },
  { value: 'white_caucasian',  label: 'White / Caucasian' },
];

// Slide indices: 0=welcome, 1=gender, 2=ethnicity, 3-9=tips
const TOTAL_SLIDES = 3 + TIPS.length;

function getProgressPct(slide: number): number | null {
  if (slide === 0) return null; // welcome — hide bar
  if (slide === 1) return 100 / 6;
  if (slide === 2) return 200 / 6;
  const tipIdx = slide - 3;
  return 50 + (tipIdx / (TIPS.length - 1)) * 50;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (gender: Gender, ethnicity: Ethnicity[]) => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [slide, setSlide] = useState(0);
  const [gender, setGender] = useState<Gender | null>(null);
  const [ethnicity, setEthnicity] = useState<Ethnicity[]>([]);

  function goTo(idx: number) {
    setSlide(idx);
    scrollRef.current?.scrollTo({ x: idx * width, animated: true });
  }

  const pct = getProgressPct(slide);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress bar — hidden on welcome slide */}
      <View style={styles.barWrap}>
        {pct !== null && <ProgressBar pct={pct} />}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ width: width * TOTAL_SLIDES }}
      >

        {/* ── Slide 0: Welcome ─────────────────────────────────────────── */}
        <View style={[styles.slide, { width }]}>
          <View style={styles.welcomeTop}>
            <View style={styles.iconBox}>
              <Text style={styles.iconSymbol}>◉</Text>
            </View>
            <Text style={styles.appName}>FaceMorph</Text>
            <Text style={styles.tagline}>
              AI-powered facial analysis.{'\n'}
              Understand your features.{'\n'}
              Track your progress.
            </Text>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => goTo(1)}>
              <Text style={styles.primaryBtnText}>Get started</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Slide 1: Gender ──────────────────────────────────────────── */}
        <View style={[styles.slide, { width }]}>
          <View style={styles.content}>
            <Text style={styles.title}>Select your gender</Text>
            <Text style={styles.subtitle}>This helps us provide more accurate analysis</Text>
            <View style={styles.options}>
              {(['male', 'female'] as Gender[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGender(g)}
                  style={[styles.option, gender === g && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, gender === g && styles.optionTextSelected]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => goTo(2)}
              disabled={!gender}
              style={[styles.primaryBtn, !gender && styles.btnDisabled]}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Slide 2: Ethnicity ───────────────────────────────────────── */}
        <View style={[styles.slide, { width }]}>
          <View style={styles.content}>
            <Text style={styles.title}>Select your ethnicity</Text>
            <Text style={styles.subtitle}>You can select multiple options</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.options}>
                {ETHNICITY_OPTIONS.map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => {
                      setEthnicity(prev =>
                        prev.includes(value) ? prev.filter(e => e !== value) : [...prev, value]
                      );
                    }}
                    style={[styles.option, ethnicity.includes(value) && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, ethnicity.includes(value) && styles.optionTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={styles.footer}>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => goTo(1)} style={styles.backBtn}>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => goTo(3)}
                disabled={ethnicity.length === 0}
                style={[styles.primaryBtn, { flex: 1 }, ethnicity.length === 0 && styles.btnDisabled]}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Slides 3-9: Tips ─────────────────────────────────────────── */}
        {TIPS.map((tip, tipIdx) => {
          const slideIdx = 3 + tipIdx;
          const isCombined = 'combinedKey' in tip;
          const isLast = tipIdx === TIPS.length - 1;

          return (
            <View key={tipIdx} style={[styles.slide, { width }]}>
              <View style={styles.content}>
                <Text style={styles.title}>{tip.title}</Text>

                {isCombined ? (
                  <Image
                    source={IMAGES[(tip as { combinedKey: keyof typeof IMAGES }).combinedKey]}
                    style={styles.combinedImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.panelRow}>
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

              <View style={styles.footer}>
                {/* Dots */}
                <View style={styles.dots}>
                  {TIPS.map((_, i) => (
                    <View key={i} style={[styles.dot, i === tipIdx && styles.dotActive]} />
                  ))}
                </View>
                <View style={styles.row}>
                  <TouchableOpacity
                    onPress={() => goTo(slideIdx - 1)}
                    style={styles.backBtn}
                  >
                    <Text style={styles.backText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => isLast ? onComplete(gender!, ethnicity) : goTo(slideIdx + 1)}
                    style={[styles.primaryBtn, { flex: 1 }]}
                  >
                    <Text style={styles.primaryBtnText}>{isLast ? 'Got it' : 'Next'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  barWrap: { paddingTop: 16, height: 19 },
  slide: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, paddingTop: 16 },
  footer: { paddingBottom: 8, paddingTop: 8 },

  // Welcome
  welcomeTop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  iconBox: { width: 100, height: 100, borderRadius: 24, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconSymbol: { fontSize: 48, color: '#fff' },
  appName: { fontSize: 36, fontWeight: '800', color: '#111', letterSpacing: -0.5 },
  tagline: { fontSize: 17, color: '#6b7280', textAlign: 'center', lineHeight: 26 },

  // Shared
  title: { fontSize: 26, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 24 },
  options: { gap: 10, paddingBottom: 16 },
  option: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center' },
  optionSelected: { borderColor: '#000', backgroundColor: '#000' },
  optionText: { fontSize: 15, fontWeight: '500', color: '#111' },
  optionTextSelected: { color: '#fff' },

  // Buttons
  row: { flexDirection: 'row', gap: 12 },
  primaryBtn: { backgroundColor: '#111', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnDisabled: { opacity: 0.3 },
  backBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  backText: { color: '#111', fontWeight: '600', fontSize: 15 },

  // Tips
  combinedImage: { width: '100%', height: 180, borderRadius: 14, marginBottom: 16 },
  panelRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  panel: { flex: 1, alignItems: 'center' },
  panelImage: { width: '100%', height: 200, borderRadius: 14 },
  goodLabel: { marginTop: 6, color: '#111', fontWeight: '600', fontSize: 12 },
  badLabel: { marginTop: 6, color: '#6b7280', fontWeight: '600', fontSize: 12 },
  bodyBox: { paddingTop: 4 },
  bodyLine: { fontSize: 16, color: '#374151', lineHeight: 26, marginBottom: 6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e5e7eb' },
  dotActive: { backgroundColor: '#000', width: 18 },
});
