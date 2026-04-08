import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  CalibrationExample,
  getCalibrationExamples,
  addCalibrationExample,
  deleteCalibrationExample,
} from '../lib/calibration';

const FEATURES: (keyof CalibrationExample['scores'])[] = ['jawline', 'eyes', 'nose', 'lips', 'skinClarity'];
const FEATURE_LABELS: Record<string, string> = {
  jawline: 'Jawline', eyes: 'Eyes', nose: 'Nose', lips: 'Lips', skinClarity: 'Skin',
};

interface Props {
  onClose: () => void;
}

function ScoreInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <TextInput
        style={styles.scoreInput}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="5.0"
        maxLength={4}
      />
    </View>
  );
}

export default function CalibrationScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [examples, setExamples] = useState<CalibrationExample[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add form state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [gender, setGender] = useState('male');
  const [ethnicity, setEthnicity] = useState('white');
  const [overall, setOverall] = useState('');
  const [featureScores, setFeatureScores] = useState<Record<string, string>>({
    jawline: '', eyes: '', nose: '', lips: '', skinClarity: '',
  });

  const load = useCallback(async () => {
    const data = await getCalibrationExamples();
    setExamples(data.sort((a, b) => a.overallScore - b.overallScore));
  }, []);

  useEffect(() => { load(); }, [load]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 512 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    setImageUri(compressed.uri);
    setImageBase64(compressed.base64 || null);
  };

  const save = async () => {
    if (!imageBase64) { Alert.alert('Pick an image first'); return; }
    if (!label.trim()) { Alert.alert('Add a label (e.g. "Average white male")'); return; }
    const ov = parseFloat(overall);
    if (isNaN(ov) || ov < 1 || ov > 10) { Alert.alert('Overall score must be 1–10'); return; }

    const scores: CalibrationExample['scores'] = {
      jawline: parseFloat(featureScores.jawline) || ov,
      eyes: parseFloat(featureScores.eyes) || ov,
      nose: parseFloat(featureScores.nose) || ov,
      lips: parseFloat(featureScores.lips) || ov,
      skinClarity: parseFloat(featureScores.skinClarity) || ov,
    };

    setSaving(true);
    try {
      await addCalibrationExample({ label: label.trim(), gender, ethnicity, overallScore: ov, scores, imageBase64 });
      await load();
      setAdding(false);
      resetForm();
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setImageUri(null); setImageBase64(null); setLabel('');
    setGender('male'); setEthnicity('white'); setOverall('');
    setFeatureScores({ jawline: '', eyes: '', nose: '', lips: '', skinClarity: '' });
  };

  const remove = (id: string) => {
    Alert.alert('Delete example', 'Remove this calibration example?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteCalibrationExample(id);
        await load();
      }},
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calibration Examples</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>
        Rate real faces to teach the AI accurate scoring. These examples are sent with every analysis.
      </Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Example list */}
        {examples.length === 0 ? (
          <Text style={styles.empty}>No examples yet. Add some to improve AI accuracy.</Text>
        ) : (
          examples.map(ex => (
            <View key={ex.id} style={styles.exampleCard}>
              <Image source={{ uri: `data:image/jpeg;base64,${ex.imageBase64}` }} style={styles.thumb} />
              <View style={styles.exampleInfo}>
                <Text style={styles.exampleLabel}>{ex.label}</Text>
                <Text style={styles.exampleMeta}>{ex.gender} · {ex.ethnicity}</Text>
                <Text style={styles.exampleScore}>Overall: <Text style={{ fontWeight: '700' }}>{ex.overallScore.toFixed(1)}</Text></Text>
                <Text style={styles.exampleFeatures}>
                  J:{ex.scores.jawline} E:{ex.scores.eyes} N:{ex.scores.nose} L:{ex.scores.lips} S:{ex.scores.skinClarity}
                </Text>
              </View>
              <TouchableOpacity onPress={() => remove(ex.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Add button */}
        {!adding && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)}>
            <Text style={styles.addBtnText}>+ Add Example</Text>
          </TouchableOpacity>
        )}

        {/* Add form */}
        {adding && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New Calibration Example</Text>

            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {imageUri
                ? <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                : <Text style={styles.imagePickerText}>Tap to pick face photo</Text>
              }
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Label (e.g. Average white male 5.0)"
              value={label}
              onChangeText={setLabel}
            />

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.toggle, gender === 'male' && styles.toggleActive]}
                onPress={() => setGender('male')}>
                <Text style={[styles.toggleText, gender === 'male' && styles.toggleTextActive]}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggle, gender === 'female' && styles.toggleActive]}
                onPress={() => setGender('female')}>
                <Text style={[styles.toggleText, gender === 'female' && styles.toggleTextActive]}>Female</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              placeholder="Ethnicity (e.g. white, east_asian, black)"
              value={ethnicity}
              onChangeText={setEthnicity}
            />

            <ScoreInput label="Overall (1–10)" value={overall} onChange={setOverall} />
            <Text style={styles.featureNote}>Feature scores (leave blank to use overall):</Text>
            {FEATURES.map(f => (
              <ScoreInput
                key={f}
                label={FEATURE_LABELS[f]}
                value={featureScores[f]}
                onChange={v => setFeatureScores(s => ({ ...s, [f]: v }))}
              />
            ))}

            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAdding(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  closeBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#111', borderRadius: 8 },
  closeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  subtitle: { fontSize: 12, color: '#6b7280', paddingHorizontal: 20, paddingVertical: 10 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 13 },
  exampleCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 6, backgroundColor: '#f9fafb', borderRadius: 12, padding: 10 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#e5e7eb' },
  exampleInfo: { flex: 1, marginLeft: 12 },
  exampleLabel: { fontSize: 13, fontWeight: '600', color: '#111' },
  exampleMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  exampleScore: { fontSize: 13, color: '#111', marginTop: 4 },
  exampleFeatures: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  addBtn: { margin: 16, backgroundColor: '#111', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  form: { margin: 16, backgroundColor: '#f9fafb', borderRadius: 16, padding: 16 },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 14 },
  imagePicker: { backgroundColor: '#e5e7eb', borderRadius: 12, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerText: { color: '#6b7280', fontSize: 13 },
  textInput: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  toggle: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  toggleActive: { backgroundColor: '#111', borderColor: '#111' },
  toggleText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  featureNote: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  scoreLabel: { fontSize: 13, color: '#374151', flex: 1 },
  scoreInput: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, width: 70, textAlign: 'center' },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#111', alignItems: 'center' },
  saveBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});
