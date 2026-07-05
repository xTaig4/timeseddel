/**
 * Native-sikker indpakning af expo-speech-recognition.
 *
 * STATUS (2026-07-05): Pakken er FJERNET fra dependencies, og stemme-input er
 * derfor bevidst i dvale. Nyeste udgivelse (56.0.1) er bygget mod Expo SDK 56,
 * og mod denne apps SDK 57 segfaulter dens native del ved opstart
 * (SIGSEGV i jsi::Value::~Value på JS-tråden, reproducerbart i to EAS-builds).
 * Parser, hook og UI beholdes — geninstallér pakken og genindsæt config-plugin
 * i app.json, når vedligeholderen udgiver en SDK 57-version:
 * https://github.com/jamsch/expo-speech-recognition/releases
 *
 * Typerne herunder er lokale kopier af det lille API-udsnit vi bruger, så
 * appen typechecker uden pakken installeret.
 */

export interface VoiceResultEvent {
  isFinal: boolean;
  results: { transcript: string; confidence: number }[];
}

export interface VoiceErrorEvent {
  error: string;
  message: string;
}

interface VoiceEventMap {
  result: VoiceResultEvent;
  error: VoiceErrorEvent;
  start: unknown;
  end: unknown;
  nomatch: unknown;
}

interface SpeechModule {
  start(options: {
    lang: string;
    interimResults?: boolean;
    continuous?: boolean;
  }): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  isRecognitionAvailable(): boolean;
  getSpeechRecognitionServices(): string[];
  supportsOnDeviceRecognition(): boolean;
  addListener(event: string, handler: (payload: unknown) => void): VoiceSubscription;
}

/** Abonnement der altid kan fjernes — også no-op-varianten når modulet mangler. */
export type VoiceSubscription = { remove(): void };

let cached: SpeechModule | null = null;
let attempted = false;
let loadError: string | null = null;

/** Indlæs modulet én gang; returnér null hvis det ikke findes (pt. altid null). */
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
    // Pakken er ikke installeret (se status-notat øverst) — stemme utilgængelig.
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
 * Rå diagnostik af talegenkendelsen — vises ved langt tryk på mikrofonknappen
 * eller gem-knappen. Platformens forhåndstjek kan lyve i begge retninger
 * (OEM-afhængigt), så vi gater ikke UI'et på dem; men de er uvurderlige til
 * fejlsøgning på en enhed.
 */
export function voiceProbe(): string {
  const mod = load();
  if (!mod) return loadError ? `modul: import fejlede — ${loadError}` : 'modul: mangler';
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
export function addSpeechListener<K extends keyof VoiceEventMap>(
  event: K,
  listener: (payload: VoiceEventMap[K]) => void,
): VoiceSubscription {
  const mod = load();
  if (!mod) return { remove() {} };
  return mod.addListener(event, listener as (payload: unknown) => void);
}
