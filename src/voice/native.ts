/**
 * Native-sikker indpakning af expo-speech-recognition.
 *
 * Vi pinner bevidst 56.0.1 (`--save-exact`): der findes endnu ingen SDK 57-udgivelse
 * af pakken. Modulet findes ikke i Expo Go — selve importen kører internt
 * `requireNativeModule('ExpoSpeechRecognition')`, som kaster "Cannot find native
 * module 'ExpoSpeechRecognition'" allerede ved import. Derfor lazy-`require()` i
 * try/catch, så hele appen kan køre i Expo Go med stemme blot utilgængelig.
 *
 * Kun `import type` fra pakken (fjernes ved kompilering — ingen runtime-import).
 */
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionNativeEventMap,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

export type { ExpoSpeechRecognitionErrorEvent, ExpoSpeechRecognitionResultEvent };

/** Typen af det native modul, uden at importere værdien. */
type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

/** Abonnement der altid kan fjernes — også no-op-varianten når modulet mangler. */
export type VoiceSubscription = { remove(): void };

let cached: SpeechModule | null = null;
let attempted = false;
let loadError: string | null = null;

/** Indlæs modulet én gang; returnér null hvis det ikke findes (Expo Go). */
function load(): SpeechModule | null {
  if (attempted) return cached;
  attempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule: SpeechModule;
    };
    cached = mod.ExpoSpeechRecognitionModule ?? null;
  } catch (e) {
    // Native modul mangler (Expo Go / web) — stemme er simpelthen utilgængelig.
    // Beskeden gemmes til diagnostik: importen kan også fejle af andre grunde.
    loadError = e instanceof Error ? e.message : String(e);
    cached = null;
  }
  return cached;
}

/** True hvis det native talegenkendelsesmodul er tilgængeligt. */
export function voiceModuleAvailable(): boolean {
  return load() != null;
}

/** Det native modul, eller null når det er utilgængeligt. */
export function getSpeechModule(): SpeechModule | null {
  return load();
}

/**
 * Rå diagnostik af talegenkendelsen — vises ved langt tryk på mikrofonknappen.
 * Platformens forhåndstjek kan lyve i begge retninger (OEM-afhængigt), så vi
 * gater ikke UI'et på dem; men de er uvurderlige til fejlsøgning på en enhed.
 */
export function voiceProbe(): string {
  const mod = load();
  if (!mod) return loadError ? `modul: import fejlede — ${loadError}` : 'modul: mangler (Expo Go/web)';
  const parts: string[] = ['modul: ok'];
  try {
    parts.push(`isRecognitionAvailable: ${String(mod.isRecognitionAvailable())}`);
  } catch (e) {
    parts.push(`isRecognitionAvailable: kastede (${e instanceof Error ? e.message : e})`);
  }
  try {
    parts.push(`services: ${JSON.stringify(mod.getSpeechRecognitionServices())}`);
  } catch (e) {
    parts.push(`services: kastede (${e instanceof Error ? e.message : e})`);
  }
  try {
    parts.push(`onDevice: ${String(mod.supportsOnDeviceRecognition())}`);
  } catch {
    parts.push('onDevice: kastede');
  }
  return parts.join(' · ');
}

/**
 * Abonnér på en native talegenkendelseshændelse. Returnerer et no-op-abonnement,
 * hvis modulet mangler, så kaldere aldrig skal gætte på tilgængelighed.
 */
export function addSpeechListener<K extends keyof ExpoSpeechRecognitionNativeEventMap>(
  event: K,
  listener: (payload: ExpoSpeechRecognitionNativeEventMap[K]) => void,
): VoiceSubscription {
  const mod = load();
  if (!mod) return { remove() {} };
  // Modulet er en Expo NativeModule (EventEmitter) med addListener → EventSubscription.
  // Generisk index-type kan ikke verificeres af TS; cast til ikke-generisk signatur.
  const add = mod.addListener as unknown as (
    event: string,
    handler: (payload: ExpoSpeechRecognitionNativeEventMap[K]) => void,
  ) => VoiceSubscription;
  return add(event, listener);
}
