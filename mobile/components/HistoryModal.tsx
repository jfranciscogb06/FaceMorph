import React from 'react';
import {
  View, Text, ScrollView, Modal, TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { ScanHistoryItem } from '../lib/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  history: ScanHistoryItem[];
  onDelete: (id: string) => void;
  onViewScan: (item: ScanHistoryItem) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreColor(s: number) {
  if (s >= 8) return '#22c55e';
  if (s >= 6.5) return '#f0b040';
  if (s >= 5) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(s: number) {
  if (s >= 8.5) return 'Exceptional';
  if (s >= 7.5) return 'Above Average';
  if (s >= 6) return 'Average';
  return 'Below Average';
}

const SCORE_KEYS: { key: keyof ScanHistoryItem['scores']; label: string }[] = [
  { key: 'symmetry', label: 'Sym' },
  { key: 'jawline', label: 'Jaw' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'skinClarity', label: 'Skin' },
];

export default function HistoryModal({ visible, onClose, history, onDelete, onViewScan }: Props) {
  const confirmDelete = (id: string) => {
    Alert.alert('Delete scan', 'Remove this scan from your history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
    ]);
  };
  const chartItems = [...history].reverse().slice(-8);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Progress</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {history.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptySub}>
                Complete your first scan to start tracking progress over time.
              </Text>
            </View>
          ) : (
            <>
              {/* Summary stat */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryVal}>{history.length}</Text>
                  <Text style={styles.summaryLabel}>Total Scans</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryVal, { color: scoreColor(history[0].overallScore) }]}>
                    {history[0].overallScore.toFixed(1)}
                  </Text>
                  <Text style={styles.summaryLabel}>Latest Score</Text>
                </View>
                {history.length > 1 && (
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryVal}>
                      {history[0].overallScore > history[history.length - 1].overallScore ? '+' : ''}
                      {(history[0].overallScore - history[history.length - 1].overallScore).toFixed(1)}
                    </Text>
                    <Text style={styles.summaryLabel}>vs First</Text>
                  </View>
                )}
              </View>

              {/* Bar chart */}
              {chartItems.length > 1 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Overall Score Trend</Text>
                  <View style={styles.chart}>
                    {chartItems.map((item) => {
                      const h = (item.overallScore / 10) * 100;
                      return (
                        <View key={item.id} style={styles.bar}>
                          <Text style={styles.barVal}>{item.overallScore.toFixed(1)}</Text>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { height: `${h}%`, backgroundColor: scoreColor(item.overallScore) }]} />
                          </View>
                          <Text style={styles.barDate}>
                            {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* History list */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Scan History</Text>
                {history.map((item, i) => (
                  <TouchableOpacity key={item.id} style={[styles.card, i === 0 && styles.cardLatest]} onPress={() => { onClose(); onViewScan(item); }} activeOpacity={0.7}>
                    <TouchableOpacity style={styles.deleteBtn} onPress={(e) => { e.stopPropagation?.(); confirmDelete(item.id); }}>
                      <Text style={styles.deleteBtnText}>×</Text>
                    </TouchableOpacity>
                    <View style={styles.cardLeft}>
                      {i === 0 && <Text style={styles.latestTag}>Latest</Text>}
                      <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                      <Text style={styles.cardMeta}>{item.faceShape} · {item.styleCategory}</Text>
                      <View style={styles.miniScores}>
                        {SCORE_KEYS.map(({ key, label }) => (
                          <View key={key} style={styles.miniScore}>
                            <Text style={styles.miniScoreLabel}>{label}</Text>
                            <Text style={[styles.miniScoreVal, { color: scoreColor(item.scores[key]) }]}>
                              {item.scores[key].toFixed(0)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.cardRight}>
                      <Text style={[styles.cardScore, { color: scoreColor(item.overallScore) }]}>
                        {item.overallScore.toFixed(1)}
                      </Text>
                      <Text style={styles.cardScoreSub}>{scoreLabel(item.overallScore)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { color: '#111', fontWeight: '700', fontSize: 17 },
  doneText: { color: '#6b7280', fontSize: 15, fontWeight: '500' },
  content: { padding: 20, paddingBottom: 40, gap: 20 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 10 },
  emptyTitle: { color: '#111', fontWeight: '700', fontSize: 20 },
  emptySub: { color: '#6b7280', fontSize: 13, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 4,
  },
  summaryVal: { color: '#111', fontWeight: '800', fontSize: 22 },
  summaryLabel: { color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
  section: { gap: 12 },
  sectionTitle: { color: '#111', fontWeight: '600', fontSize: 15 },
  chart: { flexDirection: 'row', height: 110, alignItems: 'flex-end', gap: 6 },
  bar: { flex: 1, alignItems: 'center', gap: 3 },
  barVal: { fontSize: 9, color: '#6b7280', fontWeight: '600' },
  barBg: {
    width: '100%', flex: 1, backgroundColor: '#f3f4f6',
    borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: 4 },
  barDate: { fontSize: 8, color: '#9ca3af', textAlign: 'center' },
  card: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 16, padding: 14, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  cardLatest: { borderColor: '#111', backgroundColor: '#fff' },
  cardLeft: { gap: 3, flex: 1 },
  latestTag: {
    color: '#111', fontWeight: '700', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  cardDate: { color: '#111', fontWeight: '600', fontSize: 14 },
  cardMeta: { color: '#9ca3af', fontSize: 12 },
  miniScores: { flexDirection: 'row', gap: 10, marginTop: 6 },
  miniScore: { alignItems: 'center', gap: 1 },
  miniScoreLabel: { color: '#9ca3af', fontSize: 9, textTransform: 'uppercase' },
  miniScoreVal: { fontWeight: '700', fontSize: 12 },
  cardRight: { alignItems: 'flex-end', gap: 3 },
  cardScore: { fontSize: 28, fontWeight: '800' },
  cardScoreSub: { color: '#9ca3af', fontSize: 10 },
  deleteBtn: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#9ca3af', fontSize: 18, fontWeight: '400', lineHeight: 22 },
});
