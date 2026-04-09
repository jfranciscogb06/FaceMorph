import React, { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Superwall, { SuperwallOptions, LogLevel, LogScope, PaywallPresentationHandler } from '@superwall/react-native-superwall';
import * as FileSystem from 'expo-file-system';
import { AppState, Gender, Ethnicity, ScanHistoryItem } from './lib/types';
import { analyzePhoto } from './lib/api';
import OnboardingFlow from './components/OnboardingFlow';
import UploadStep from './components/steps/UploadStep';
import AnalyzingStep from './components/steps/AnalyzingStep';
import HomeScreen from './components/HomeScreen';
import FadeView from './components/FadeView';

const STORAGE_ONBOARDED = 'fm_onboarded_v6';
const STORAGE_GENDER = 'fm_gender';
const STORAGE_ETHNICITY = 'fm_ethnicity';
const STORAGE_HISTORY = 'fm_scan_history';

const initial: AppState = {
  step: 'gender', gender: null, ethnicity: [],
  photoUri: null, photoBase64: null, photoWidth: null, photoHeight: null,
  landmarks: [], result: null, error: null,
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(initial);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [freshScan, setFreshScan] = useState(false);
  const [swReady, setSwReady] = useState(false);
const paywallShowing = React.useRef(false);

  useEffect(() => {
    const options = new SuperwallOptions();
    options.logging.level = LogLevel.Debug;
    options.logging.scopes = [LogScope.All];
    Superwall.configure({ apiKey: 'pk_SDqCAYiCDeygrOMKwLelu', options })
      .then(() => {
        console.log('[SW] configured successfully');
        setSwReady(true);
      })
      .catch((e: Error) => {
        console.log('[SW] configure FAILED:', e.message);
      });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [onboarded, historyRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_ONBOARDED),
          AsyncStorage.getItem(STORAGE_HISTORY),
        ]);
        const loadedHistory: ScanHistoryItem[] = historyRaw ? JSON.parse(historyRaw) : [];
        setScanHistory(loadedHistory);
        if (onboarded === 'true') {
          const gender = ((await AsyncStorage.getItem(STORAGE_GENDER)) ?? 'male') as Gender;
          const ethnicityRaw = await AsyncStorage.getItem(STORAGE_ETHNICITY);
          const ethnicity: Ethnicity[] = ethnicityRaw ? JSON.parse(ethnicityRaw) : [];
          setState((s) => ({ ...s, step: 'home', gender, ethnicity }));
        }
      } catch {}
      finally {
        setReady(true);
      }
    })();
  }, []);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const finishOnboarding = useCallback(async (gender: Gender, ethnicity: Ethnicity[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_ONBOARDED, 'true');
      await AsyncStorage.setItem(STORAGE_GENDER, gender);
      await AsyncStorage.setItem(STORAGE_ETHNICITY, JSON.stringify(ethnicity));
    } catch {}
    update({ step: 'upload', gender, ethnicity });
  }, [update]);

  const goToAnalyzing = useCallback(() => {
    if (!state.photoBase64) return;
    startAnalysis();
  }, [state.photoBase64, startAnalysis]);

  function isToday(iso: string) {
    const d = new Date(iso), now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }

  const runAnalysis = useCallback(async (replaceId: string | null) => {
    if (!state.photoBase64) return;
    update({ step: 'analyzing', error: null });
    try {
      const imageDataUrl = `data:image/jpeg;base64,${state.photoBase64}`;
      const result = await analyzePhoto(imageDataUrl, state.gender ?? 'male', state.ethnicity);
      // Save photo first, then update history, then navigate — so HomeScreen
      // always mounts with the new scan already in the history prop.
      const scanId = Date.now().toString();
      let savedPhotoUri: string | undefined;
      try {
        const dir = FileSystem.documentDirectory + 'scans/';
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const dest = dir + scanId + '.jpg';
        // Write from base64 — more reliable than copyAsync from camera roll URIs (ph:// / content://)
        await FileSystem.writeAsStringAsync(dest, state.photoBase64!, { encoding: FileSystem.EncodingType.Base64 });
        savedPhotoUri = dest;
      } catch (e) {
        console.warn('[App] photo save failed:', (e as Error).message);
      }

      const newItem: ScanHistoryItem = {
        id: scanId,
        date: new Date().toISOString(),
        overallScore: result.overallScore,
        scores: result.scores,
        faceShape: result.faceShape,
        styleCategory: result.styleCategory,
        result,
        photoUri: savedPhotoUri,
      };
      const base = replaceId ? scanHistory.filter(h => h.id !== replaceId) : scanHistory;
      const updated = [newItem, ...base].slice(0, 20);
      setScanHistory(updated);
      AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify(updated)).catch(() => {});

      // Navigate after history is set so the scan is visible immediately
      update({ result, step: 'home' });
      setFreshScan(true);
    } catch (e) {
      console.error('Analysis failed:', (e as Error).message);
      update({ step: 'home', error: (e as Error).message });
    }
  }, [state.photoBase64, state.gender, state.ethnicity, scanHistory, update]);

  const startAnalysis = useCallback(async () => {
    if (!state.photoBase64) return;

    const todayScan = scanHistory.find(h => isToday(h.date));
    if (todayScan) {
      Alert.alert(
        'Daily scan used',
        "You've already scanned today. Replace it with this new scan?",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', onPress: () => runAnalysis(todayScan.id) },
        ]
      );
      return;
    }
    runAnalysis(null);
  }, [state.photoBase64, scanHistory, runAnalysis]);

  const deleteScan = useCallback(async (id: string) => {
    const updated = scanHistory.filter(h => h.id !== id);
    setScanHistory(updated);
    AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify(updated)).catch(() => {});
  }, [scanHistory]);

  const deleteCurrentScan = useCallback(() => {
    Alert.alert(
      'Delete scan',
      'Remove this scan from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: () => {
            const latest = scanHistory[0];
            if (latest && isToday(latest.date)) deleteScan(latest.id);
            newScan();
          },
        },
      ]
    );
  }, [scanHistory, deleteScan]);

  const newScan = useCallback(() => {
    setState((s) => ({
      ...initial,
      step: 'upload',
      gender: s.gender,
      ethnicity: s.ethnicity,
    }));
  }, []);

  const onUnlock = useCallback(async () => {
    if (!swReady || paywallShowing.current) return;
    paywallShowing.current = true;
    try {
      const handler = new PaywallPresentationHandler();
      handler.onPresent((info) => console.log('[SW] paywall presented:', info.name));
      handler.onSkip((reason) => console.log('[SW] paywall skipped:', JSON.stringify(reason)));
      handler.onError((err) => console.log('[SW] paywall error:', err));
      await Superwall.shared.register({ placement: 'analysis_gate', handler });
    } catch (e) {
      console.log('[SW] register error:', (e as Error).message);
    } finally {
      paywallShowing.current = false;
    }
  }, [swReady]);

  const resetApp = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_ONBOARDED, STORAGE_GENDER, STORAGE_ETHNICITY, STORAGE_HISTORY]);
    setScanHistory([]);
    setState(initial);
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />

{state.step === 'gender' && (
        <OnboardingFlow onComplete={finishOnboarding} />
      )}

      {state.step === 'upload' && (
        <FadeView>
          <UploadStep
            photoUri={state.photoUri}
            onPhoto={(uri, base64, w, h) => update({ photoUri: uri, photoBase64: base64, photoWidth: w, photoHeight: h })}
            onNext={goToAnalyzing}
            onBack={() => update({ step: scanHistory.length > 0 ? 'home' : 'gender' })}
          />
        </FadeView>
      )}

      {state.step === 'analyzing' && (
        <FadeView><AnalyzingStep /></FadeView>
      )}

      {state.step === 'home' && (
        <FadeView>
          <HomeScreen
            history={scanHistory}
            latestPhotoUri={state.photoUri}
            onNewScan={newScan}
            onDeleteScan={deleteScan}
            onResetApp={resetApp}
            onUnlock={onUnlock}
            autoShowLatest={freshScan}
            onAutoShowConsumed={() => setFreshScan(false)}
          />
        </FadeView>
      )}
    </SafeAreaProvider>
  );
}
