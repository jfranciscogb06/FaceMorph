import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  Dimensions, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScoreRing from './ScoreRing';
import FeatureCard from './FeatureCard';
import ChatModal from './ChatModal';
import { ScanHistoryItem } from '../lib/types';

const SCREEN_W = Dimensions.get('window').width;
const CALENDAR_DAYS = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 7.5) return '#111';
  if (s >= 5.5) return '#6b7280';
  return '#9ca3af';
}

function tier(s: number): { label: string } {
  if (s >= 9.0) return { label: 'Elite' };
  if (s >= 8.0) return { label: 'High Value' };
  if (s >= 7.0) return { label: 'Above Average' };
  if (s >= 6.0) return { label: 'Average' };
  if (s >= 5.0) return { label: 'Developing' };
  return               { label: 'Early Stage' };
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function calendarDays(): Date[] {
  const today = new Date();
  return Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (CALENDAR_DAYS - 1 - i));
    return d;
  });
}

function computeStreak(history: ScanHistoryItem[]): number {
  if (!history.length) return 0;
  const scanDates = new Set(history.map(h => h.date.split('T')[0]));
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (scanDates.has(d.toISOString().split('T')[0])) {
      streak++;
    } else {
      if (i === 0) continue; // allow today to be empty (might scan later)
      break;
    }
  }
  return streak;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const CAT_LABELS: Record<string, string> = {
  skincare: 'Skincare', grooming: 'Grooming', hairstyle: 'Hairstyle',
  exercise: 'Exercise', lifestyle: 'Lifestyle',
};

const SCORE_LABELS: Record<string, string> = {
  symmetry: 'Symmetry', goldenRatio: 'Golden Ratio', jawline: 'Jawline',
  eyes: 'Eyes', nose: 'Nose', lips: 'Lips', skinClarity: 'Skin', facialThirds: 'Face Thirds',
};

const MINI_KEYS: { key: keyof ScanHistoryItem['scores']; label: string }[] = [
  { key: 'jawline', label: 'Jaw' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'nose', label: 'Nose' },
  { key: 'skinClarity', label: 'Skin' },
  { key: 'symmetry', label: 'Sym' },
];

// ─── Calendar Strip ───────────────────────────────────────────────────────────

function CalendarStrip({ history, onSelectDay }: {
  history: ScanHistoryItem[];
  onSelectDay: (item: ScanHistoryItem) => void;
}) {
  const days = calendarDays();
  const today = new Date();
  const [selected, setSelected] = useState<string>(today.toISOString().split('T')[0]);

  // Build map: dateStr → best scan for that day
  const scanMap = new Map<string, ScanHistoryItem>();
  for (const item of history) {
    const d = item.date.split('T')[0];
    if (!scanMap.has(d) || item.overallScore > scanMap.get(d)!.overallScore) {
      scanMap.set(d, item);
    }
  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.calStrip}>
      {days.map((day) => {
        const dateStr = day.toISOString().split('T')[0];
        const scan = scanMap.get(dateStr);
        const isToday = isSameDay(day, today);
        const isSel = dateStr === selected;
        const isFuture = day > today;

        return (
          <TouchableOpacity
            key={dateStr}
            style={styles.calDay}
            onPress={() => {
              setSelected(dateStr);
              if (scan) onSelectDay(scan);
            }}
            activeOpacity={0.7}
            disabled={isFuture}
          >
            <Text style={[styles.calDayName, isFuture && { color: '#d1d5db' }]}>
              {DAY_NAMES[day.getDay()].slice(0, 3)}
            </Text>
            <View style={[
              styles.calCircle,
              isToday && styles.calCircleToday,
              isSel && scan && { borderColor: scoreColor(scan.overallScore), borderWidth: 2 },
              isFuture && styles.calCircleFuture,
            ]}>
              {scan ? (
                <View style={[styles.calCircleFill, { backgroundColor: scoreColor(scan.overallScore) }]}>
                  <Text style={[styles.calDayNum, { color: '#fff' }]}>{day.getDate()}</Text>
                </View>
              ) : (
                <Text style={[styles.calDayNum, isFuture && { color: '#d1d5db' }, isToday && { fontWeight: '700' }]}>
                  {day.getDate()}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Results Detail ───────────────────────────────────────────────────────────

function ResultsDetail({ item, fallbackPhotoUri, onBack, onDelete }: {
  item: ScanHistoryItem;
  fallbackPhotoUri: string | null;
  onBack: () => void;
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [showChat, setShowChat] = useState(false);
  const r = item.result;
  const photo = item.photoUri || fallbackPhotoUri;
  const t = tier(r.overallScore);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.detailBack}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle}>
          {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.detailDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        {/* Hero */}
        <View style={styles.heroCard}>
          {photo
            ? <Image source={{ uri: photo }} style={styles.heroPhoto} resizeMode="cover" />
            : <View style={[styles.heroPhoto, { backgroundColor: '#f3f4f6' }]} />
          }
          <View style={styles.heroBottom}>
            <ScoreRing score={r.overallScore} size={90} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>{t.label}</Text>
              </View>
              <Text style={styles.heroScore}>{r.overallScore.toFixed(1)}<Text style={styles.heroScoreMax}> / 10</Text></Text>
              <Text style={styles.heroMeta}>{r.faceShape} · {r.styleCategory}</Text>
            </View>
          </View>
        </View>

        {/* Score grid */}
        <Text style={styles.sectionTitle}>Score Breakdown</Text>
        <View style={styles.scoreGrid}>
          {Object.entries(r.scores).map(([key, val]) => (
            <View key={key} style={styles.scoreCell}>
              <View style={styles.scoreCellTop}>
                <Text style={styles.scoreCellLabel}>{SCORE_LABELS[key] || key}</Text>
                <Text style={[styles.scoreCellVal, { color: scoreColor(val as number) }]}>{(val as number).toFixed(1)}</Text>
              </View>
              <View style={styles.scoreBarBg}>
                <View style={[styles.scoreBarFill, { width: `${((val as number) / 10) * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>

        {r.strengths.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>✓ Strengths</Text>
            {r.strengths.map((s, i) => <Text key={i} style={styles.infoItem}>• {s}</Text>)}
          </View>
        )}
        {r.improvements.length > 0 && (
          <View style={[styles.infoCard, { marginTop: 10, borderColor: '#fde68a' }]}>
            <Text style={styles.infoCardTitle}>↑ Areas to Improve</Text>
            {r.improvements.map((s, i) => <Text key={i} style={styles.infoItem}>• {s}</Text>)}
          </View>
        )}

        <Text style={styles.sectionTitle}>Feature Analysis</Text>
        {r.detailedAnalysis.map((d, i) => (
          <FeatureCard key={i} feature={d.feature} score={d.score} observation={d.observation} tip={d.tip} />
        ))}

        {r.recommendations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {r.recommendations.map((rec, i) => (
              <View key={i} style={styles.recCard}>
                <View style={styles.recBadge}>
                  <Text style={styles.recBadgeText}>{CAT_LABELS[rec.category] || rec.category}</Text>
                </View>
                <Text style={styles.recTitle}>{rec.title}</Text>
                <Text style={styles.recDesc}>{rec.description}</Text>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={[styles.chatFab, { bottom: insets.bottom + 16 }]} onPress={() => setShowChat(true)} activeOpacity={0.88}>
        <Text style={styles.chatFabText}>Ask AI</Text>
      </TouchableOpacity>
      <ChatModal visible={showChat} onClose={() => setShowChat(false)} analysisContext={r} />
    </View>
  );
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────

function HomeTab({ history, latestPhotoUri, onSelectScan, onNewScan }: {
  history: ScanHistoryItem[];
  latestPhotoUri: string | null;
  onSelectScan: (item: ScanHistoryItem) => void;
  onNewScan: () => void;
}) {
  const streak = computeStreak(history);
  const latest = history[0] ?? null;
  const photo = latest?.photoUri || latestPhotoUri;
  const t = latest ? tier(latest.overallScore) : null;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {/* Header */}
      <View style={styles.homeHeader}>
        <Text style={styles.appTitle}>FaceMorph</Text>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakCount}>{streak}</Text>
          </View>
        )}
      </View>

      {/* Calendar strip */}
      <CalendarStrip history={history} onSelectDay={onSelectScan} />

      {!latest ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptySub}>Tap + to take your first scan and start tracking your progress over time.</Text>
        </View>
      ) : (
        <>
          {/* Latest scan hero */}
          <TouchableOpacity style={styles.latestCard} onPress={() => onSelectScan(latest)} activeOpacity={0.92}>
            <View>
              {photo
                ? <Image source={{ uri: photo }} style={styles.latestPhoto} resizeMode="cover" />
                : <View style={[styles.latestPhoto, { backgroundColor: '#f3f4f6' }]} />
              }
            </View>

            <View style={styles.latestBottom}>
              <View>
                <Text style={[styles.latestScore, { color: scoreColor(latest.overallScore) }]}>
                  {latest.overallScore.toFixed(1)}
                </Text>
                <Text style={styles.latestScoreSub}>out of 10</Text>
                <Text style={styles.latestMeta}>{latest.result.faceShape} · {latest.result.styleCategory}</Text>
              </View>
              <ScoreRing score={latest.overallScore} size={72} />
            </View>

            {/* Metric chips */}
            <View style={styles.chips}>
              {MINI_KEYS.map(({ key, label }) => (
                <View key={key} style={styles.chip}>
                  <Text style={styles.chipLabel}>{label}</Text>
                  <Text style={[styles.chipVal, { color: scoreColor(latest.scores[key]) }]}>
                    {latest.scores[key].toFixed(1)}
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>

          {/* Motivational nudge */}
          {(() => {
            const next = tier(latest.overallScore + 1);
            const gap = (Math.ceil(latest.overallScore) - latest.overallScore + 0.1);
            if (gap < 1 && next.label !== t!.label) {
              return (
                <View style={styles.nudgeCard}>
                  <Text style={styles.nudgeText}>
                    You're only <Text style={{ fontWeight: '700' }}>{gap.toFixed(1)} pts</Text> away from <Text style={{ fontWeight: '700' }}>{next.label}</Text>
                  </Text>
                </View>
              );
            }
            return null;
          })()}
        </>
      )}
    </ScrollView>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────

function ProgressTab({ history, latestPhotoUri, onSelectScan, onDeleteScan }: {
  history: ScanHistoryItem[];
  latestPhotoUri: string | null;
  onSelectScan: (item: ScanHistoryItem) => void;
  onDeleteScan: (id: string) => void;
}) {
  const chartItems = [...history].reverse().slice(-10);

  const confirmDelete = (id: string) => {
    Alert.alert('Delete scan', 'Remove this scan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteScan(id) },
    ]);
  };

  if (!history.length) {
    return (
      <View style={styles.tabEmpty}>
        <Ionicons name="bar-chart-outline" size={48} color="#d1d5db" />
        <Text style={styles.tabEmptyTitle}>No data yet</Text>
        <Text style={styles.tabEmptySub}>Complete your first scan to see your progress.</Text>
      </View>
    );
  }

  const best = Math.max(...history.map(h => h.overallScore));
  const first = history[history.length - 1].overallScore;
  const latest = history[0].overallScore;
  const delta = latest - first;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{history.length}</Text>
          <Text style={styles.statLabel}>Scans</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{best.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Best</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>Progress</Text>
        </View>
      </View>

      {/* Chart */}
      {chartItems.length > 1 && (
        <>
          <Text style={styles.sectionTitle}>Score Trend</Text>
          <View style={styles.chartCard}>
            <View style={styles.chart}>
              {chartItems.map((item) => (
                <TouchableOpacity key={item.id} style={styles.bar} onPress={() => onSelectScan(item)} activeOpacity={0.7}>
                  <Text style={styles.barVal}>{item.overallScore.toFixed(1)}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { height: `${(item.overallScore / 10) * 100}%` }]} />
                  </View>
                  <Text style={styles.barDate}>
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      {/* History list */}
      <Text style={styles.sectionTitle}>All Scans</Text>
      {history.map((item, i) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.histRow, i === 0 && styles.histRowLatest]}
          onPress={() => onSelectScan(item)}
          activeOpacity={0.7}
        >
          {item.photoUri
            ? <Image source={{ uri: item.photoUri }} style={styles.histThumb} />
            : <View style={[styles.histThumb, { backgroundColor: '#f3f4f6' }]} />
          }
          <View style={{ flex: 1, gap: 2 }}>
            {i === 0 && <Text style={styles.histLatestTag}>Latest</Text>}
            <Text style={styles.histDate}>{formatDate(item.date)}</Text>
            <Text style={styles.histMeta}>{item.faceShape} · {item.styleCategory}</Text>
          </View>
          <Text style={[styles.histScore, { color: scoreColor(item.overallScore) }]}>
            {item.overallScore.toFixed(1)}
          </Text>
          <TouchableOpacity
            onPress={() => confirmDelete(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ paddingLeft: 12 }}
          >
            <Ionicons name="trash-outline" size={16} color="#d1d5db" />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ─── Tips Tab ─────────────────────────────────────────────────────────────────

const GENERIC_TIPS = [
  { category: 'skincare', title: 'Daily Cleanse & Moisturize', description: 'Wash your face twice daily with a gentle cleanser. Follow with a non-comedogenic moisturizer with SPF in the morning to prevent premature aging.' },
  { category: 'grooming', title: 'Eyebrow Maintenance', description: 'Clean, well-shaped eyebrows frame the face significantly. Visit a professional for shaping every 4–6 weeks, then maintain with tweezers.' },
  { category: 'exercise', title: 'Mewing & Posture', description: 'Rest your tongue flat on the roof of your mouth consistently. Combined with good posture, this supports jawline development over time.' },
  { category: 'hairstyle', title: 'Find Your Face Shape Style', description: 'Different hairstyles complement different face shapes. Research styles that create visual balance for your specific proportions.' },
  { category: 'lifestyle', title: 'Sleep & Hydration', description: 'Aim for 8 hours of quality sleep — this is when skin repairs itself. Drink 2–3L of water daily to maintain skin elasticity and clarity.' },
  { category: 'exercise', title: 'Body Fat & Definition', description: 'Lowering body fat percentage enhances facial definition and jawline visibility significantly. Aim for 10–15% for males, 18–24% for females.' },
];

function TipsTab({ history }: { history: ScanHistoryItem[] }) {
  const [showChat, setShowChat] = useState(false);
  const latest = history[0];
  const recs = latest?.result.recommendations ?? [];
  const tips = recs.length >= 3 ? recs : GENERIC_TIPS;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {latest && (
        <Text style={styles.tipsSourceText}>Based on your latest scan</Text>
      )}

      {tips.map((rec, i) => (
        <View key={i} style={styles.tipCard}>
          <Text style={styles.tipBadgeText}>{CAT_LABELS[rec.category] || rec.category}</Text>
          <Text style={styles.tipTitle}>{rec.title}</Text>
          <Text style={styles.tipDesc}>{rec.description}</Text>
        </View>
      ))}

      {latest && (
        <TouchableOpacity style={styles.askAiBtn} onPress={() => setShowChat(true)} activeOpacity={0.85}>
          <Ionicons name="chatbubble-outline" size={18} color="#fff" />
          <Text style={styles.askAiBtnText}>Ask AI about your results</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 20 }} />
      {latest && (
        <ChatModal visible={showChat} onClose={() => setShowChat(false)} analysisContext={latest.result} />
      )}
    </ScrollView>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ history, onResetApp }: {
  history: ScanHistoryItem[];
  onResetApp: () => void;
}) {
  const latest = history[0];
  const streak = computeStreak(history);
  const best = history.length ? Math.max(...history.map(h => h.overallScore)) : null;

  const confirmReset = () => {
    Alert.alert(
      'Reset App',
      'This will delete all your scans and reset onboarding. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: onResetApp },
      ]
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {/* Avatar */}
      <View style={styles.profileAvatar}>
        <Ionicons name="person" size={40} color="#9ca3af" />
      </View>
      {latest && (
        <View style={[styles.tierPill, { alignSelf: 'center', marginTop: 10, marginBottom: 4 }]}>
          <Text style={styles.tierPillText}>{tier(latest.overallScore).label}</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{history.length}</Text>
          <Text style={styles.statLabel}>Total Scans</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{streak > 0 ? `🔥 ${streak}` : '—'}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        {best !== null && (
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: scoreColor(best) }]}>{best.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Best Score</Text>
          </View>
        )}
      </View>

      {/* Settings */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <TouchableOpacity style={styles.settingRow} onPress={confirmReset}>
        <Ionicons name="refresh-outline" size={20} color="#ef4444" />
        <Text style={[styles.settingLabel, { color: '#ef4444' }]}>Reset App & Clear Data</Text>
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      </TouchableOpacity>

      <Text style={styles.profileVersion}>FaceMorph v1.0.0</Text>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

type Tab = 'home' | 'progress' | 'tips' | 'profile';

const TABS: { id: Tab; label: string; icon: string; iconActive: string }[] = [
  { id: 'home',     label: 'Home',     icon: 'home-outline',      iconActive: 'home' },
  { id: 'progress', label: 'Progress', icon: 'bar-chart-outline',  iconActive: 'bar-chart' },
  { id: 'tips',     label: 'Tips',     icon: 'bulb-outline',       iconActive: 'bulb' },
  { id: 'profile',  label: 'Profile',  icon: 'person-outline',     iconActive: 'person' },
];

// ─── HomeScreen (root) ────────────────────────────────────────────────────────

interface Props {
  history: ScanHistoryItem[];
  latestPhotoUri: string | null;
  onNewScan: () => void;
  onDeleteScan: (id: string) => void;
  onResetApp: () => void;
}

export default function HomeScreen({ history, latestPhotoUri, onNewScan, onDeleteScan, onResetApp }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [viewing, setViewing] = useState<ScanHistoryItem | null>(null);

  const confirmDelete = (id: string) => {
    Alert.alert('Delete scan', 'Remove this scan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        onDeleteScan(id);
        if (viewing?.id === id) setViewing(null);
      }},
    ]);
  };

  if (viewing) {
    return (
      <ResultsDetail
        item={viewing}
        fallbackPhotoUri={latestPhotoUri}
        onBack={() => setViewing(null)}
        onDelete={() => confirmDelete(viewing.id)}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'home' && (
          <HomeTab
            history={history}
            latestPhotoUri={latestPhotoUri}
            onSelectScan={setViewing}
            onNewScan={onNewScan}
          />
        )}
        {tab === 'progress' && (
          <ProgressTab
            history={history}
            latestPhotoUri={latestPhotoUri}
            onSelectScan={setViewing}
            onDeleteScan={onDeleteScan}
          />
        )}
        {tab === 'tips' && <TipsTab history={history} />}
        {tab === 'profile' && <ProfileTab history={history} onResetApp={onResetApp} />}
      </View>

      {/* Bottom tab bar — matches Cal AI layout */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={styles.tabBtn}
              onPress={() => setTab(t.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabBtnInner, active && styles.tabBtnActive]}>
                <Ionicons
                  name={(active ? t.iconActive : t.icon) as any}
                  size={22}
                  color={active ? '#111' : '#9ca3af'}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {/* Spacer for the + button column */}
        <View style={styles.tabPlusSpacer} />
      </View>

      {/* Plus button floats above tab bar, far right — Cal AI style */}
      <TouchableOpacity
        style={[styles.plusBtn, { bottom: insets.bottom + 10 }]}
        onPress={onNewScan}
        activeOpacity={0.88}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Calendar — 7 days fills full width
  calStrip: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  calDay: { flex: 1, alignItems: 'center', gap: 4 },
  calDayName: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  calCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  calCircleToday: { borderColor: '#111' },
  calCircleFuture: { opacity: 0.3 },
  calCircleFill: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  calDayNum: { fontSize: 15, color: '#374151', fontWeight: '500' },

  // Home tab
  tabContent: { paddingBottom: 20 },
  homeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  appTitle: { fontSize: 22, fontWeight: '800', color: '#111', letterSpacing: -0.5 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  streakFire: { fontSize: 16 },
  streakCount: { fontSize: 16, fontWeight: '800', color: '#ea580c' },

  emptyCard: { margin: 16, padding: 28, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', borderStyle: 'dashed', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  emptySub: { fontSize: 15, color: '#9ca3af', textAlign: 'center', lineHeight: 22 },

  latestCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  latestPhoto: { width: '100%', height: 230 },
  latestPhotoOverlay: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  latestBadge: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  latestBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tierPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  tierPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  latestBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  latestScore: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  latestScoreSub: { fontSize: 14, color: '#9ca3af', marginTop: -2 },
  latestMeta: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
  chips: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
  chip: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 7, alignItems: 'center', gap: 2 },
  chipLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.3 },
  chipVal: { fontSize: 15, fontWeight: '700' },

  nudgeCard: { marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 14, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e5e7eb' },
  nudgeText: { fontSize: 15, color: '#374151', lineHeight: 21 },

  // Progress tab
  tabEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  tabEmptyTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  tabEmptySub: { fontSize: 15, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 40 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, alignItems: 'center', gap: 3 },
  statVal: { fontSize: 22, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.3 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111', paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },

  chartCard: { marginHorizontal: 16, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 14 },
  chart: { flexDirection: 'row', height: 100, alignItems: 'flex-end', gap: 8 },
  bar: { flex: 1, alignItems: 'center', gap: 3 },
  barVal: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  barBg: { width: '100%', flex: 1, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, backgroundColor: '#111' },
  barDate: { fontSize: 10, color: '#9ca3af', textAlign: 'center' },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  histRowLatest: { backgroundColor: '#fafafa' },
  histThumb: { width: 48, height: 48, borderRadius: 10 },
  histLatestTag: { fontSize: 11, fontWeight: '800', color: '#111', textTransform: 'uppercase', letterSpacing: 0.5 },
  histDate: { fontSize: 16, fontWeight: '600', color: '#111' },
  histMeta: { fontSize: 13, color: '#9ca3af' },
  histScore: { fontSize: 22, fontWeight: '800' },

  // Tips tab
  tipsSourceText: { fontSize: 14, color: '#9ca3af', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  tipCard: { marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  tipBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: '#9ca3af', marginBottom: 6 },
  tipTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  tipDesc: { fontSize: 15, color: '#6b7280', lineHeight: 21 },
  askAiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 6, marginBottom: 10, backgroundColor: '#111', borderRadius: 14, paddingVertical: 14 },
  askAiBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  // Profile tab
  profileAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f3f4f6', alignSelf: 'center', marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  settingLabel: { flex: 1, fontSize: 17, fontWeight: '500' },
  profileVersion: { textAlign: 'center', color: '#d1d5db', fontSize: 12, marginTop: 24 },

  // Tier badge (detail view)
  tierBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4, backgroundColor: '#f3f4f6' },
  tierBadgeText: { fontSize: 14, fontWeight: '700', color: '#374151' },

  // Tab bar — Cal AI style
  tabBar: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } } }),
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingBottom: 4 },
  tabBtnInner: { alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  tabBtnActive: { backgroundColor: '#f0f0f0' },
  tabLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  tabLabelActive: { color: '#111', fontWeight: '700' },
  tabPlusSpacer: { width: 68 }, // reserves space for the floating + button
  plusBtn: {
    position: 'absolute', right: 12,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },

  // Results detail
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  detailTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  detailBack: { color: '#6b7280', fontSize: 16, fontWeight: '500' },
  detailDeleteText: { color: '#ef4444', fontSize: 15, fontWeight: '500' },
  detailContent: { padding: 16, gap: 16 },

  heroCard: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 24, overflow: 'hidden' },
  heroPhoto: { width: '100%', height: 250 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  heroScore: { fontSize: 26, fontWeight: '800', color: '#111' },
  heroScoreMax: { fontSize: 17, fontWeight: '400', color: '#9ca3af' },
  heroMeta: { fontSize: 14, color: '#9ca3af', marginTop: 2 },

  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 0 },
  scoreCell: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 10, width: '47%' },
  scoreCellTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  scoreCellLabel: { color: '#6b7280', fontSize: 13 },
  scoreCellVal: { fontWeight: '700', fontSize: 13 },
  scoreBarBg: { height: 3, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: 3, borderRadius: 4, backgroundColor: '#111' },

  infoCard: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 14 },
  infoCardTitle: { color: '#111', fontWeight: '600', fontSize: 16, marginBottom: 8 },
  infoItem: { color: '#374151', fontSize: 15, marginBottom: 4, lineHeight: 21 },

  recCard: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 14 },
  recBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6, backgroundColor: '#f3f4f6' },
  recBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, color: '#6b7280' },
  recTitle: { color: '#111', fontWeight: '600', fontSize: 16, marginBottom: 4 },
  recDesc: { color: '#6b7280', fontSize: 14, lineHeight: 20 },

  chatFab: { position: 'absolute', right: 20, backgroundColor: '#111', borderRadius: 26, paddingHorizontal: 20, paddingVertical: 13, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  chatFabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
