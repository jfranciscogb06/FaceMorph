import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '../../lib/api';

interface Props {
  photoUri: string | null;
  onPhoto: (uri: string, base64: string, width: number, height: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function UploadStep({ photoUri, onPhoto, onNext, onBack }: Props) {
  const [processing, setProcessing] = useState(false);

  const pick = async (useCamera: boolean) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 1,
          allowsEditing: false,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo library access is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 1,
          allowsEditing: true,
          aspect: [3, 4],
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setProcessing(true);
        try {
          const { uri, base64, width, height } = await compressImage(result.assets[0].uri);
          onPhoto(uri, base64, width, height);
        } finally {
          setProcessing(false);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not load photo. Try again.');
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Upload front photo</Text>
        <Text style={styles.subtitle}>Take or upload a clear front-facing photo</Text>

        {photoUri ? (
          <View style={styles.previewWrapper}>
            <Image source={{ uri: photoUri }} style={[styles.preview, styles.mirrored]} resizeMode="cover" />
            <View style={styles.detectedBanner}>
              <Text style={styles.detectedText}>✓  Photo ready</Text>
            </View>
            <TouchableOpacity onPress={() => pick(false)} style={styles.changeBtn} disabled={processing}>
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.uploadBox}>
              {processing ? (
                <>
                  <ActivityIndicator size="large" color="#111" />
                  <Text style={styles.processingText}>Processing photo...</Text>
                </>
              ) : (
                <>
                  <View style={styles.uploadIconBox}>
                    <View style={styles.uploadIconLens} />
                  </View>
                  <Text style={styles.uploadLabel}>Add a photo to get started</Text>
                </>
              )}
            </View>

            {!processing && (
              <View style={styles.uploadBtns}>
                <TouchableOpacity onPress={() => pick(true)} style={styles.uploadBtn}>
                  <Text style={styles.uploadBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => pick(false)} style={[styles.uploadBtn, styles.uploadBtnSecondary]}>
                  <Text style={[styles.uploadBtnText, { color: '#111' }]}>Choose from Library</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={styles.spacer} />

        <View style={styles.tips}>
          <Text style={styles.tip}>• Face camera directly, neutral expression</Text>
          <Text style={styles.tip}>• Soft, even lighting — no harsh shadows</Text>
          <Text style={styles.tip}>• Remove glasses, hats, hair covering face</Text>
        </View>

        <View style={styles.row}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} disabled={processing}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNext}
            disabled={!photoUri || processing}
            style={[styles.btn, (!photoUri || processing) && styles.btnDisabled]}
          >
            <Text style={styles.btnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 20 },
  previewWrapper: { flex: 1, borderRadius: 20, overflow: 'hidden', marginBottom: 12, position: 'relative' },
  preview: { width: '100%', height: '100%' },
  mirrored: { transform: [{ scaleX: -1 }] },
  detectedBanner: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#22c55e', paddingVertical: 10, paddingHorizontal: 14 },
  detectedText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  changeBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  changeBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  uploadBox: { height: 180, borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 12 },
  uploadIconBox: { width: 54, height: 40, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  uploadIconLens: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db' },
  uploadLabel: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  uploadBtns: { gap: 10, marginBottom: 12 },
  uploadBtn: { backgroundColor: '#111', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  uploadBtnSecondary: { backgroundColor: '#f3f4f6' },
  uploadBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  processingText: { color: '#6b7280', fontSize: 14 },
  spacer: { flex: 1 },
  tips: { gap: 4, marginBottom: 12 },
  tip: { fontSize: 12, color: '#9ca3af' },
  row: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  backBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  backText: { color: '#111', fontWeight: '600', fontSize: 15 },
  btn: { flex: 1, backgroundColor: '#111', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
