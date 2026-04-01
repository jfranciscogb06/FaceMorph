import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScoreRing from '../ScoreRing';
import FeatureCard from '../FeatureCard';
import ChatModal from '../ChatModal';
import HistoryModal from '../HistoryModal';
import { AnalysisResult, ScanHistoryItem } from '../../lib/types';

interface Props {
  result: AnalysisResult;
  photoUri: string;
  onRetry: () => void;
  onDeleteScan: () => void;
  history: ScanHistoryItem[];
  onDeleteHistoryScan: (id: string) => void;
}

const SCORE_LABELS: Record<string, string> = {
  symmetry: 'Symmetry', goldenRatio: 'Golden Ratio', jawline: 'Jawline',
  eyes: 'Eyes', nose: 'Nose', lips: 'Lips', skinClarity: 'Skin', facialThirds: 'Face Thirds',
};

const CAT_LABELS: Record<string, string> = {
  skincare: 'Skincare', grooming: 'Grooming', hairstyle: 'Hairstyle',
  exercise: 'Exercise', lifestyle: 'Lifestyle',
};

function scoreLabel(s: number) {
  if (s >= 8.5) return 'Exceptional';
  if (s >= 7.5) return 'Above Average';
  if (s >= 6) return 'Average';
  return 'Below Average';
}

export default function ResultsStep({ result, photoUri, onRetry, onDeleteScan, history, onDeleteHistoryScan }: Props) {
  const insets = useSafeAreaInsets();
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingItem, setViewingItem] = useState<ScanHistoryItem | null>(null);

  const displayed = viewingItem ? viewingItem.result : result;
  const isHistory = viewingItem !== null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isHistory && styles.containerHistory]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isHistory
            ? new Date(viewingItem!.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : 'Analysis'}
        </Text>
        <View style={styles.headerActions}>
          {isHistory ? (
            <TouchableOpacity onPress={() => setViewingItem(null)} style={[styles.headerBtn, styles.headerBtnPrimary]}>
              <Text style={[styles.headerBtnText, styles.headerBtnPrimaryText]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDeleteScan} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onRetry} style={[styles.headerBtn, styles.headerBtnPrimary]}>
                <Text style={[styles.headerBtnText, styles.headerBtnPrimaryText]}>New Scan</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroCard}>
          {(isHistory ? (viewingItem!.photoUri || photoUri) : photoUri) ? (
            <Image
              source={{ uri: isHistory ? (viewingItem!.photoUri || photoUri) : photoUri }}
              style={[styles.heroPhoto, { transform: [{ scaleX: -1 }] }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.heroPhoto, styles.heroPhotoPlaceholder]} />
          )}
          <View style={styles.heroBottom}>
            <ScoreRing score={displayed.overallScore} />
            <View style={styles.heroInfo}>
              <Text style={styles.heroLabel}>Overall Score</Text>
              <Text style={styles.heroScore}>{displayed.overallScore.toFixed(1)} / 10</Text>
              <Text style={styles.heroCategory}>{scoreLabel(displayed.overallScore)}</Text>
              <Text style={styles.heroFaceShape}>{displayed.faceShape} · {displayed.styleCategory}</Text>
            </View>
          </View>
        </View>

        {/* Score breakdown */}
        <Text style={styles.sectionTitle}>Score Breakdown</Text>
        <View style={styles.scoreGrid}>
          {Object.entries(displayed.scores).map(([key, val]) => (
            <View key={key} style={styles.scoreCell}>
              <View style={styles.scoreCellTop}>
                <Text style={styles.scoreCellLabel}>{SCORE_LABELS[key] || key}</Text>
                <Text style={styles.scoreCellVal}>{(val as number).toFixed(1)}</Text>
              </View>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreBarFill, { width: `${((val as number) / 10) * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Strengths */}
        {displayed.strengths.length > 0 && (
          <View style={styles.strengthCard}>
            <Text style={styles.strengthTitle}>Strengths</Text>
            {displayed.strengths.map((s, i) => (
              <Text key={i} style={styles.strengthItem}>{s}</Text>
            ))}
          </View>
        )}

        {/* Improvements */}
        {displayed.improvements.length > 0 && (
          <View style={styles.improvCard}>
            <Text style={styles.improvTitle}>Areas to Improve</Text>
            {displayed.improvements.map((s, i) => (
              <Text key={i} style={styles.improvItem}>{s}</Text>
            ))}
          </View>
        )}

        {/* Feature analysis */}
        <Text style={styles.sectionTitle}>Feature Analysis</Text>
        {displayed.detailedAnalysis.map((item, i) => (
          <FeatureCard key={i} feature={item.feature} score={item.score} observation={item.observation} tip={item.tip} />
        ))}

        {/* Recommendations */}
        {displayed.recommendations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {displayed.recommendations.map((rec, i) => (
              <View key={i} style={styles.recCard}>
                <View style={styles.recCatBadge}>
                  <Text style={styles.recCatText}>
                    {CAT_LABELS[rec.category] || rec.category}
                  </Text>
                </View>
                <Text style={styles.recTitle}>{rec.title}</Text>
                <Text style={styles.recDesc}>{rec.description}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Chat FAB */}
      {!isHistory && (
        <TouchableOpacity style={styles.chatFab} onPress={() => setShowChat(true)}>
          <Text style={styles.chatFabText}>Ask AI</Text>
        </TouchableOpacity>
      )}

      <ChatModal visible={showChat} onClose={() => setShowChat(false)} analysisContext={displayed} />
      <HistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        onDelete={onDeleteHistoryScan}
        onViewScan={(item) => { setShowHistory(false); setViewingItem(item); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  containerHistory: { backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { color: '#111', fontWeight: '700', fontSize: 18 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  headerBtnPrimary: { backgroundColor: '#111', borderColor: '#111' },
  headerBtnText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  headerBtnPrimaryText: { color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  heroCard: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 24, overflow: 'hidden', marginBottom: 20,
  },
  heroPhoto: { width: '100%', height: 260 },
  heroPhotoPlaceholder: { backgroundColor: '#f3f4f6' },
  heroBottom: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  heroInfo: { flex: 1 },
  heroLabel: { color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  heroScore: { color: '#111', fontSize: 22, fontWeight: '700', marginBottom: 2 },
  heroCategory: { fontWeight: '600', fontSize: 13, marginBottom: 2, color: '#6b7280' },
  heroFaceShape: { color: '#6b7280', fontSize: 12 },
  sectionTitle: { color: '#111', fontWeight: '600', fontSize: 16, marginBottom: 12, marginTop: 4 },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  scoreCell: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 10, width: '47%',
  },
  scoreCellTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  scoreCellLabel: { color: '#6b7280', fontSize: 11 },
  scoreCellVal: { fontWeight: '700', fontSize: 11, color: '#111' },
  scoreBar: { height: 3, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: 3, borderRadius: 4, backgroundColor: '#111' },
  strengthCard: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16,
    padding: 14, marginBottom: 12,
  },
  strengthTitle: { color: '#111', fontWeight: '600', marginBottom: 8, fontSize: 14 },
  strengthItem: { color: '#374151', fontSize: 13, marginBottom: 4 },
  improvCard: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16,
    padding: 14, marginBottom: 20,
  },
  improvTitle: { color: '#111', fontWeight: '600', marginBottom: 8, fontSize: 14 },
  improvItem: { color: '#374151', fontSize: 13, marginBottom: 4 },
  recCard: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 16, padding: 14, marginBottom: 10,
  },
  recCatBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6, backgroundColor: '#f3f4f6' },
  recCatText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, color: '#6b7280' },
  recTitle: { color: '#111', fontWeight: '600', fontSize: 14, marginBottom: 4 },
  recDesc: { color: '#6b7280', fontSize: 12, lineHeight: 18 },
  chatFab: {
    position: 'absolute', bottom: 24, right: 20,
    backgroundColor: '#111', borderRadius: 26,
    paddingHorizontal: 20, paddingVertical: 13,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  chatFabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
