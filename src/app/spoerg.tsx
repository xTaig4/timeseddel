import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { chatConfigured, streamChat, type ChatMessage } from '@/ai/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  deltaReceived,
  sendFailed,
  sendFinished,
  sendStarted,
} from '@/store/chatSlice';

const SUGGESTIONS = [
  'Hvor meget ferie optjener jeg om måneden?',
  'Kan min chef pålægge mig overarbejde?',
  'Hvor længe må jeg arbejde om ugen?',
];

export default function SpoergScreen() {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { messages, status, error } = useAppSelector((s) => s.chat);
  const [input, setInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || status === 'streaming') return;
    setInput('');
    const history = [...messages, { role: 'user' as const, content: question }];
    dispatch(sendStarted(question));

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamChat(history, (delta) => dispatch(deltaReceived(delta)), ac.signal);
      dispatch(sendFinished());
    } catch (e) {
      dispatch(sendFailed(e instanceof Error ? e.message : 'Ukendt fejl.'));
    }
  };

  if (!chatConfigured()) {
    return (
      <ThemedView style={styles.screen}>
        <View style={styles.centered}>
          <ThemedText type="smallBold">Assistenten er ikke sat op</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            Denne build mangler EXPO_PUBLIC_CHAT_URL. Se README for opsætning af edge-proxyen.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText style={styles.screenTitle}>Spørg</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Om ferie, arbejdstid og dine rettigheder — vejledende, ikke juridisk rådgivning
              </ThemedText>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((q) => (
                <Pressable key={q} onPress={() => send(q)}>
                  <View style={[styles.suggestion, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    <ThemedText type="small">{q}</ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item, index }) => (
            <Bubble
              message={item}
              streaming={
                status === 'streaming' && index === messages.length - 1 && item.role === 'assistant'
              }
            />
          )}
          ListFooterComponent={
            error ? (
              <ThemedText type="small" style={{ color: theme.negative, paddingVertical: Spacing.two }}>
                {error}
              </ThemedText>
            ) : null
          }
        />
        <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            value={input}
            onChangeText={setInput}
            placeholder="Stil et spørgsmål …"
            placeholderTextColor={theme.textSecondary}
            multiline
            editable={status !== 'streaming'}
            onSubmitEditing={() => send(input)}
          />
          <Pressable
            onPress={() => send(input)}
            disabled={status === 'streaming' || !input.trim()}
            style={({ pressed }) => pressed && styles.pressed}>
            <View
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    status === 'streaming' || !input.trim() ? theme.backgroundSelected : theme.accent,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{
                  color: status === 'streaming' || !input.trim() ? theme.textSecondary : theme.onAccent,
                }}>
                {status === 'streaming' ? '…' : 'Send'}
              </ThemedText>
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function Bubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : null]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: theme.accentSoft }
            : { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
        ]}>
        <ThemedText type="small">
          {message.content}
          {streaming ? ' ▍' : ''}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four, gap: Spacing.one },
  centeredText: { textAlign: 'center' },
  list: { padding: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
  header: { marginTop: Spacing.five, marginBottom: Spacing.three, gap: 2 },
  screenTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  suggestions: { gap: Spacing.two },
  suggestion: { borderRadius: 12, borderWidth: 1, padding: Spacing.three },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: 12, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  pressed: { opacity: 0.85 },
});
