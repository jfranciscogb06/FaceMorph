import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  SafeAreaView, Dimensions, ActivityIndicator, Animated,
} from 'react-native';
import { LandmarkPoint } from '../../lib/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ZOOM = 2.5;
// Height of the image area (roughly half the screen)
const IMG_H_FRAC = 0.52;

interface Props {
  photoUri: string;
  photoWidth: number | null;
  photoHeight: number | null;
  landmarks: LandmarkPoint[];
  onLandmarksChange: (lm: LandmarkPoint[]) => void;
  onNext: (finalLandmarks: LandmarkPoint[]) => void;
  onBack: () => void;
  loading: boolean;
}

export default function LandmarkStep({
  photoUri, photoWidth, photoHeight, landmarks, onLandmarksChange, onNext, onBack, loading,
}: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);

  const aspect = photoWidth && photoHeight ? photoHeight / photoWidth : 1.25;
  const displayW = SCREEN_W;
  const displayH = displayW * aspect;

  // Pan offset — translates the zoomed image so the active landmark is centered
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  // Non-animated copies for reading current values during gesture
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const lastTouch = useRef({ x: 0, y: 0 });

  // Center the image on the given landmark (in normalized coords)
  const centerOn = (nx: number, ny: number, animated: boolean) => {
    const tx = (displayW / 2 - nx * displayW) * ZOOM;
    const ty = (displayH / 2 - ny * displayH) * ZOOM;
    txRef.current = tx;
    tyRef.current = ty;
    if (animated) {
      Animated.spring(panX, { toValue: tx, useNativeDriver: true, tension: 180, friction: 14 }).start();
      Animated.spring(panY, { toValue: ty, useNativeDriver: true, tension: 180, friction: 14 }).start();
    } else {
      panX.setValue(tx);
      panY.setValue(ty);
    }
  };

  // When landmark index changes, fly to that landmark
  useEffect(() => {
    if (!landmarks.length) return;
    const lm = landmarks[currentIdx];
    centerOn(lm.x, lm.y, true);
  }, [currentIdx, landmarks.length]);

  // Derive landmark position from current pan offset
  const landmarkFromPan = (tx: number, ty: number) => ({
    x: Math.max(0.01, Math.min(0.99, (displayW / 2 - tx / ZOOM) / displayW)),
    y: Math.max(0.01, Math.min(0.99, (displayH / 2 - ty / ZOOM) / displayH)),
  });

  const isLast = currentIdx === landmarks.length - 1;
  const progressPct = landmarks.length > 0 ? ((currentIdx + 1) / landmarks.length) * 100 : 0;

  const goNext = () => {
    if (isLast) onNext(landmarks);
    else setCurrentIdx(i => i + 1);
  };

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(i => i - 1);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <View style={styles.loadingRing}>
          <ActivityIndicator size="large" color="#111" />
        </View>
        <Text style={styles.loadingTitle}>Detecting landmarks...</Text>
        <Text style={styles.loadingSub}>Analyzing face with AI</Text>
      </View>
    );
  }

  if (!landmarks.length) return null;

  const lm = landmarks[currentIdx];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{lm.label}</Text>
        <Text style={styles.topCount}>{currentIdx + 1} / {landmarks.length}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      {/* Panning area — fixed size, clips zoomed image */}
      <View
        style={[styles.imgClip, { height: displayH }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          lastTouch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        }}
        onResponderMove={(e) => {
          const dx = e.nativeEvent.pageX - lastTouch.current.x;
          const dy = e.nativeEvent.pageY - lastTouch.current.y;
          lastTouch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          const newTx = txRef.current + dx;
          const newTy = tyRef.current + dy;
          txRef.current = newTx;
          tyRef.current = newTy;
          panX.setValue(newTx);
          panY.setValue(newTy);
          // Update landmark to wherever the center crosshair sits on the image
          const { x, y } = landmarkFromPan(newTx, newTy);
          const updated = landmarks.map((l, i) =>
            i === currentIdx ? { ...l, x, y } : l
          );
          onLandmarksChange(updated);
        }}
      >
        <Animated.View
          style={[styles.imgContainer, { height: displayH, transform: [
            { translateX: panX },
            { translateY: panY },
            { scale: ZOOM },
          ]}]}
        >
          <Image
            source={{ uri: photoUri }}
            style={{ width: displayW, height: displayH }}
            resizeMode="cover"
          />
          {/* Inactive dots rendered on image */}
          {landmarks.map((l, i) => {
            if (i === currentIdx) return null;
            const size = 8;
            return (
              <View
                key={l.id}
                pointerEvents="none"
                style={[styles.dot, styles.dotInactive, {
                  width: size, height: size, borderRadius: size / 2,
                  left: l.x * displayW - size / 2,
                  top: l.y * displayH - size / 2,
                }]}
              />
            );
          })}
        </Animated.View>

        {/* Fixed crosshair at the center — this IS the active dot */}
        <View style={styles.crosshairWrap} pointerEvents="none">
          <View style={styles.crosshairH} />
          <View style={styles.crosshairV} />
          <View style={styles.crosshairDot} />
        </View>

        <View style={styles.hintBadge} pointerEvents="none">
          <Text style={styles.hintText}>Drag the image to position the dot</Text>
        </View>
      </View>

      {/* Bottom */}
      <View style={styles.bottom}>
        <View>
          <Text style={styles.landmarkName}>{lm.label}</Text>
          <Text style={styles.landmarkInstr}>{lm.instruction}</Text>
        </View>
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.prevBtn, currentIdx === 0 && styles.btnOff]}
            onPress={goPrev}
            disabled={currentIdx === 0}
          >
            <Text style={styles.prevBtnText}>← Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
            <Text style={styles.nextBtnText}>
              {isLast ? 'Analyze Face →' : 'Next →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#111', alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { color: '#111', fontSize: 20, fontWeight: '700' },
  loadingSub: { color: '#6b7280', fontSize: 14 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backText: { color: '#6b7280', fontSize: 13 },
  topTitle: { color: '#111', fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  topCount: { color: '#111', fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 2, backgroundColor: '#e5e7eb' },
  progressFill: { height: 2, backgroundColor: '#111' },
  imgClip: { width: SCREEN_W, overflow: 'hidden', position: 'relative' },
  imgContainer: { width: SCREEN_W, position: 'relative' },
  dot: { position: 'absolute', borderWidth: 1.5 },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.8)' },
  crosshairWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  crosshairH: { position: 'absolute', left: SCREEN_W / 2 - 18, width: 36, height: 1.5, backgroundColor: 'rgba(255,255,255,0.9)' },
  crosshairV: { position: 'absolute', top: '50%', marginTop: -18, width: 1.5, height: 36, backgroundColor: 'rgba(255,255,255,0.9)' },
  crosshairDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 2, borderColor: '#111' },
  hintBadge: {
    position: 'absolute', bottom: 10,
    alignSelf: 'center', left: SCREEN_W / 2 - 120,
    width: 240, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  hintText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  bottom: { flex: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, justifyContent: 'space-between' },
  landmarkName: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 4 },
  landmarkInstr: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  navRow: { flexDirection: 'row', gap: 10 },
  prevBtn: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 13, paddingVertical: 15, alignItems: 'center' },
  prevBtnText: { color: '#111', fontWeight: '600', fontSize: 14 },
  btnOff: { opacity: 0.3 },
  nextBtn: { flex: 2, backgroundColor: '#111', borderRadius: 13, paddingVertical: 15, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
