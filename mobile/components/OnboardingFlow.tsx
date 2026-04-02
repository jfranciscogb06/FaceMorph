import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, useWindowDimensions,
  PanResponder, Animated,
} from 'react-native';
import ProgressBar from './ProgressBar';
import { Gender, Ethnicity } from '../lib/types';

const IMG_BEFORE = require('../assets/before.jpg');
const IMG_AFTER  = require('../assets/after.jpg');

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

// Slide indices: 0=welcome, 1=ethnicity, 2-8=tips
const TOTAL_SLIDES = 2 + TIPS.length;

function getProgressPct(slide: number): number | null {
  if (slide === 0) return null; // welcome — hide bar
  if (slide === 1) return 100 / 5;
  const tipIdx = slide - 2;
  return 40 + (tipIdx / (TIPS.length - 1)) * 50;
}

// ─── Before/After Slider ──────────────────────────────────────────────────────

const SCORE_BEFORE = 4.9;
const SCORE_AFTER  = 9.1;

function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }
function gradientColor(s: number) {
  const t = Math.max(0, Math.min(1, s / 10));
  const r = t < 0.5 ? lerp(220, 250, t * 2) : lerp(250, 34, (t - 0.5) * 2);
  const g = t < 0.5 ? lerp(60, 200, t * 2)  : lerp(200, 197, (t - 0.5) * 2);
  const b = t < 0.5 ? lerp(60, 40, t * 2)   : lerp(40, 94, (t - 0.5) * 2);
  return `rgb(${r},${g},${b})`;
}

const HANDLE_SIZE = 52;
const THRESHOLD = 0.35;

function WelcomeSlider({ containerWidth, onComplete }: { containerWidth: number; onComplete: () => void }) {
  const maxX = containerWidth - HANDLE_SIZE;
  const posX = useRef(new Animated.Value(0)).current;
  const lastX = useRef(0);
  const [score, setScore] = useState(SCORE_BEFORE);
  const completed = useRef(false);

  // t: 0 → 1 as handle moves left → right
  // drives both the image divider AND the score
  const imgDivider = posX.interpolate({ inputRange: [0, maxX], outputRange: [0, containerWidth], extrapolate: 'clamp' });
  const fillWidth  = posX.interpolate({ inputRange: [0, maxX], outputRange: [HANDLE_SIZE, containerWidth], extrapolate: 'clamp' });
  const textOpacity = posX.interpolate({ inputRange: [0, maxX * 0.25], outputRange: [1, 0], extrapolate: 'clamp' });

  useEffect(() => {
    const id = posX.addListener(({ value }) => {
      const t = Math.max(0, Math.min(1, value / maxX));
      setScore(Math.round((SCORE_BEFORE + t * (SCORE_AFTER - SCORE_BEFORE)) * 10) / 10);
    });
    return () => posX.removeListener(id);
  }, []);

  // Tease animation — nudges right then springs back
  const teasing = useRef(false);
  useEffect(() => {
    const tease = () => {
      if (completed.current || teasing.current) return;
      teasing.current = true;
      Animated.sequence([
        Animated.timing(posX, { toValue: maxX * 0.42, duration: 500, useNativeDriver: false }),
        Animated.timing(posX, { toValue: maxX * 0.18, duration: 300, useNativeDriver: false }),
        Animated.timing(posX, { toValue: maxX * 0.32, duration: 250, useNativeDriver: false }),
        Animated.timing(posX, { toValue: 0, duration: 400, useNativeDriver: false }),
      ]).start(() => { teasing.current = false; lastX.current = 0; });
    };
    const first = setTimeout(tease, 1200);
    const interval = setInterval(tease, 4000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      if (completed.current) return;
      teasing.current = false;
      posX.stopAnimation(v => { lastX.current = v; });
    },
    onPanResponderMove: (_, gs) => {
      if (completed.current) return;
      posX.setValue(Math.max(0, Math.min(maxX, lastX.current + gs.dx)));
    },
    onPanResponderRelease: (_, gs) => {
      if (completed.current) return;
      const next = Math.max(0, Math.min(maxX, lastX.current + gs.dx));
      lastX.current = next;
      if (next / maxX >= THRESHOLD) {
        completed.current = true;
        Animated.timing(posX, { toValue: maxX, duration: 180, useNativeDriver: false }).start(() => onComplete());
      } else {
        Animated.spring(posX, { toValue: 0, useNativeDriver: false, friction: 5 }).start();
        lastX.current = 0;
      }
    },
  })).current;

  const imgH = containerWidth * 1.1;

  return (
    <View style={{ width: containerWidth, gap: 12 }}>
      {/* Before/after image — divider controlled by slider below */}
      <View style={{ width: containerWidth, height: imgH, borderRadius: 16, overflow: 'hidden' }}>
        <Image source={IMG_BEFORE} style={{ position: 'absolute', width: containerWidth, height: imgH }} resizeMode="cover" />
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, width: imgDivider, height: imgH, overflow: 'hidden' }}>
          <Image source={IMG_AFTER} style={{ width: containerWidth, height: imgH }} resizeMode="cover" />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: imgDivider, width: 2, backgroundColor: '#fff', transform: [{ translateX: -1 }] }} />
      </View>

      {/* Score */}
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: gradientColor(score) }}>
          {score.toFixed(1)}<Text style={{ fontSize: 17, fontWeight: '500', color: '#6b7280' }}> / 10</Text>
        </Text>
      </View>

      {/* Swipe-to-start track */}
      <View style={{ width: containerWidth, height: HANDLE_SIZE, borderRadius: HANDLE_SIZE / 2, backgroundColor: '#f0f0f0', justifyContent: 'center', overflow: 'hidden' }}>
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: fillWidth, backgroundColor: '#111', borderRadius: HANDLE_SIZE / 2 }} />
        <Animated.Text style={{ position: 'absolute', alignSelf: 'center', fontSize: 15, fontWeight: '600', color: '#9ca3af', opacity: textOpacity }}>
          Start my transformation
        </Animated.Text>
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            position: 'absolute', left: posX,
            width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_SIZE / 2,
            backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
          }}
        >
          <Text style={{ fontSize: 18, color: '#111' }}>›</Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (gender: Gender, ethnicity: Ethnicity[]) => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [slide, setSlide] = useState(0);
  const [ethnicity, setEthnicity] = useState<Ethnicity[]>([]);
  const [sliderKey, setSliderKey] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  function goTo(idx: number) {
    const fromEthnicity = (slide === 1 && idx === 2) || (slide === 0 && idx === 1);
    if (fromEthnicity) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start(() => {
        setSlide(idx);
        scrollRef.current?.scrollTo({ x: idx * width, animated: false });
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      });
    } else {
      if (idx === 0) setSliderKey(k => k + 1);
      setSlide(idx);
      scrollRef.current?.scrollTo({ x: idx * width, animated: false });
    }
  }

  const pct = getProgressPct(slide);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ width: width * TOTAL_SLIDES, height: '100%' }}
      >

        {/* ── Slide 0: Welcome ─────────────────────────────────────────── */}
        <View style={[styles.slide, { width }]}>
          <View style={styles.welcomeTop}>
            <Text style={styles.appName}>FaceMorph</Text>
            <Text style={[styles.welcomeHeadline, { marginBottom: 8 }]}>
              <Text style={{ fontWeight: '400' }}>Your face has potential.{'\n'}</Text>unlock it.
            </Text>
            <WelcomeSlider key={sliderKey} containerWidth={width - 48} onComplete={() => goTo(1)} />
            <Text style={styles.disclaimer}>Free to start · Takes 2 minutes</Text>
          </View>
        </View>

        {/* ── Slide 1: Ethnicity ───────────────────────────────────────── */}
        <View style={[styles.slide, { width }]}>
          <Text style={[styles.title, { paddingTop: 16 }]}>Select your ethnicity</Text>
          <Text style={[styles.subtitle, { marginBottom: 12 }]}>You can select multiple options</Text>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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

        {/* ── Slides 2-8: Tips ─────────────────────────────────────────── */}
        {TIPS.map((tip, tipIdx) => {
          const slideIdx = 2 + tipIdx;
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

            </View>
          );
        })}

      </ScrollView>
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', opacity: fadeAnim }}
      />

      {/* Progress bar above fade */}
      {pct !== null && (
        <View style={styles.barWrap}>
          <ProgressBar pct={pct} />
        </View>
      )}

      {/* Footer lives outside the ScrollView so it renders above the fade overlay */}
      {slide === 1 && (
        <View style={styles.outerFooter}>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => goTo(0)} style={styles.backBtn}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => goTo(2)}
              disabled={ethnicity.length === 0}
              style={[styles.primaryBtn, { flex: 1 }, ethnicity.length === 0 && styles.btnDisabled]}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {slide >= 2 && (() => {
        const tipIdx = slide - 2;
        const isLast = tipIdx === TIPS.length - 1;
        return (
          <View style={styles.outerFooter}>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => goTo(slide - 1)} style={styles.backBtn}>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => isLast ? onComplete('male', ethnicity) : goTo(slide + 1)}
                style={[styles.primaryBtn, { flex: 1 }]}
              >
                <Text style={styles.primaryBtnText}>{isLast ? 'Got it' : 'Next'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  barWrap: { position: 'absolute', top: 16, left: 0, right: 0, paddingHorizontal: 0 },
  slide: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, paddingTop: 16 },
  footer: { paddingBottom: 8, paddingTop: 8 },
  outerFooter: { paddingHorizontal: 24, paddingBottom: 8, paddingTop: 8 },

  // Welcome
  welcomeTop: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 16, gap: 14 },
  appName: { fontSize: 14, fontWeight: '700', color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase' },
  welcomeHeadline: { fontSize: 30, fontWeight: '800', color: '#111', textAlign: 'center', lineHeight: 38, letterSpacing: -0.5 },
  disclaimer: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 8 },

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
