import React, { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { AppState, Gender, Ethnicity, LandmarkPoint, ScanHistoryItem } from './lib/types';
import { analyzePhoto, detectLandmarks } from './lib/api';
import OnboardingFlow from './components/OnboardingFlow';
import UploadStep from './components/steps/UploadStep';
import LandmarkStep from './components/steps/LandmarkStep';
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
  const [landmarksLoading, setLandmarksLoading] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);

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
          const gender = (await AsyncStorage.getItem(STORAGE_GENDER)) as Gender | null;
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

  const goToLandmarks = useCallback(async () => {
    if (!state.photoBase64) return;
    setLandmarksLoading(true);
    update({ step: 'landmarks', landmarks: [] });
    try {
      const imageDataUrl = `data:image/jpeg;base64,${state.photoBase64}`;
      const detected = await detectLandmarks(imageDataUrl);
      update({ landmarks: detected });
    } catch (e) {
      console.error('Landmark detection error:', e);
      update({ landmarks: [] });
    } finally {
      setLandmarksLoading(false);
    }
  }, [state.photoBase64, update]);

  function isToday(iso: string) {
    const d = new Date(iso), now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }

  const runAnalysis = useCallback(async (lm: LandmarkPoint[], replaceId: string | null) => {
    if (!state.photoBase64 || !state.gender) return;
    update({ step: 'analyzing', error: null, landmarks: lm });
    try {
      const imageDataUrl = `data:image/jpeg;base64,${state.photoBase64}`;
      const result = await analyzePhoto(imageDataUrl, state.gender, state.ethnicity, lm);
      update({ result, step: 'home' });
      const scanId = Date.now().toString();
      let savedPhotoUri: string | undefined;
      try {
        const dir = FileSystem.documentDirectory + 'scans/';
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const dest = dir + scanId + '.jpg';
        await FileSystem.copyAsync({ from: state.photoUri!, to: dest });
        savedPhotoUri = dest;
      } catch {}

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
    } catch (e) {
      console.error('Analysis failed:', (e as Error).message);
      update({ step: 'home', error: (e as Error).message });
    }
  }, [state.photoBase64, state.gender, state.ethnicity, scanHistory, update]);

  const startAnalysis = useCallback(async (finalLandmarks?: LandmarkPoint[]) => {
    if (!state.photoBase64 || !state.gender) return;
    const lm = finalLandmarks ?? state.landmarks;
    const todayScan = scanHistory.find(h => isToday(h.date));
    if (todayScan) {
      Alert.alert(
        'Daily scan used',
        "You've already scanned today. Replace it with this new scan?",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', onPress: () => runAnalysis(lm, todayScan.id) },
        ]
      );
      return;
    }
    runAnalysis(lm, null);
  }, [state.photoBase64, state.gender, state.landmarks, scanHistory, runAnalysis]);

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
            onNext={goToLandmarks}
            onBack={() => update({ step: scanHistory.length > 0 ? 'home' : 'gender' })}
          />
        </FadeView>
      )}

      {state.step === 'landmarks' && state.photoUri && (
        <FadeView>
          <LandmarkStep
            photoUri={state.photoUri}
            photoWidth={state.photoWidth}
            photoHeight={state.photoHeight}
            landmarks={state.landmarks}
            onLandmarksChange={(lm: LandmarkPoint[]) => update({ landmarks: lm })}
            onNext={(finalLandmarks) => startAnalysis(finalLandmarks)}
            onBack={() => update({ step: 'upload' })}
            loading={landmarksLoading}
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
          />
        </FadeView>
      )}
    </SafeAreaProvider>
  );
}
