import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet,
  ActivityIndicator, SafeAreaView, Keyboard,
} from 'react-native';
import { AnalysisResult } from '../lib/types';

const BASE_URL = 'http://172.31.86.101:3000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  analysisContext?: AnalysisResult | null;
}

const SUGGESTIONS = [
  'What hairstyle suits my face shape?',
  'Best skincare routine for my skin?',
  'How can I improve my jawline?',
  'What grooming habits should I start?',
];

export default function ChatModal({ visible, onClose, analysisContext }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Message = { role: 'user', content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          analysisContext: analysisContext ? {
            overallScore: analysisContext.overallScore,
            faceShape: analysisContext.faceShape,
            styleCategory: analysisContext.styleCategory,
            strengths: analysisContext.strengths,
            improvements: analysisContext.improvements,
          } : null,
        }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: 'assistant', content: data.message || 'Something went wrong, try again.' }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Connection error. Check your network.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Advisor</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Ask me anything</Text>
              <Text style={styles.emptySub}>
                {analysisContext
                  ? 'I have your facial analysis. Ask for personalized advice.'
                  : 'Ask me about grooming, skincare, hairstyle, and more.'}
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map(q => (
                  <TouchableOpacity key={q} style={styles.suggestion} onPress={() => send(q)}>
                    <Text style={styles.suggestionText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            messages.map((m, i) => (
              <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.bubbleText, m.role === 'user' ? styles.userText : styles.aiText]}>
                  {m.content}
                </Text>
              </View>
            ))
          )}
          {loading && (
            <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
              <ActivityIndicator size="small" color="#9ca3af" />
            </View>
          )}
        </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about your results..."
              placeholderTextColor="#9ca3af"
              multiline
              returnKeyType="send"
              onSubmitEditing={() => send()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
              onPress={() => send()}
              disabled={!input.trim() || loading}
            >
              <Text style={styles.sendText}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8, gap: 10 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle: { color: '#111', fontWeight: '700', fontSize: 20 },
  emptySub: { color: '#6b7280', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  suggestions: { width: '100%', gap: 8 },
  suggestion: {
    backgroundColor: '#f3f4f6', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  suggestionText: { color: '#374151', fontSize: 13, fontWeight: '500' },
  bubble: { maxWidth: '82%', borderRadius: 18, padding: 12 },
  userBubble: { backgroundColor: '#111', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#f3f4f6', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  loadingBubble: { paddingHorizontal: 18, paddingVertical: 14 },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  userText: { color: '#fff' },
  aiText: { color: '#111' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 10,
  },
  input: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#111', maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#111', width: 42, height: 42,
    borderRadius: 21, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: '#e5e7eb' },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
