import * as Application from 'expo-application';
import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Sættes efter deploy af edge-funktionen (offentlig URL, ingen hemmelighed)
const CHAT_URL = process.env.EXPO_PUBLIC_CHAT_URL;

export function chatConfigured(): boolean {
  return !!CHAT_URL;
}

/** Anonymt enheds-id — gater kun rate limiting, ikke sikkerhed. */
export function getDeviceToken(): string {
  if (Platform.OS === 'android') return Application.getAndroidId() ?? 'ukendt-android';
  return 'ikke-android';
}

/**
 * Streamer et svar fra edge-proxyen (Mistral SSE-format).
 * Kalder onDelta for hver tekstbid; kaster ved fejl (dansk besked).
 */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!CHAT_URL) throw new Error('Assistenten er ikke konfigureret i denne build.');

  const res = await expoFetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ deviceToken: getDeviceToken(), messages }),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      // ikke JSON — behold statusbaseret besked
    }
    if (res.status === 429) throw new Error('Dagens grænse for spørgsmål er nået. Prøv igen i morgen.');
    throw new Error(detail ? `Assistenten fejlede: ${detail}` : `Assistenten fejlede (${res.status}).`);
  }
  if (!res.body) throw new Error('Assistenten svarede uden indhold.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  for (;;) {
    if (signal?.aborted) {
      await reader.cancel();
      break;
    }
    const { done, value } = await reader.read();
    if (done) break;
    // normalisér CRLF så event-separatoren altid er '\n\n'
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let sep: number;
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const rawEvent = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      for (const line of rawEvent.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) onDelta(delta);
        } catch {
          // ufuldstændig frame — vent på næste chunk
        }
      }
    }
  }
}
