import { useCallback, useEffect, useRef, useState } from 'react';

import {
  addSpeechListener,
  getSpeechModule,
  voiceModuleAvailable,
  type VoiceErrorEvent,
  type VoiceSubscription,
} from '@/voice/native';

export type VoiceStatus = 'unavailable' | 'idle' | 'starting' | 'listening' | 'processing';

export interface UseVoiceInput {
  status: VoiceStatus;
  /** Foreløbig (interim) transskription mens der lyttes. */
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/** Oversæt native fejlkoder til korte danske beskeder. Tom streng = ingen fejl. */
function mapError(code: VoiceErrorEvent['error']): string {
  switch (code) {
    case 'no-speech':
    case 'speech-timeout':
      return 'Ingen tale genkendt — prøv igen.';
    case 'network':
      return 'Netværksfejl under talegenkendelse.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Mikrofonadgang mangler.';
    case 'aborted':
      return ''; // brugerens eget stop — ikke en fejl
    default:
      return 'Talegenkendelse fejlede. Prøv igen.';
  }
}

/**
 * Beregn starttilstand (kun ved første render). Vi gater KUN på om det native
 * modul findes (Expo Go/web → skjult). Platformens forhåndstjek
 * (isRecognitionAvailable, getSpeechRecognitionServices) er bevidst udeladt:
 * de er OEM-afhængige og kan melde falsk negativt — fejl ved faktisk brug
 * fanges alligevel af error-hændelsen og vises på dansk.
 */
function computeInitialStatus(): VoiceStatus {
  return voiceModuleAvailable() ? 'idle' : 'unavailable';
}

/**
 * Talegenkendelse til hurtig-logning. Kører uden fejl i Expo Go (status 'unavailable').
 *
 * @param onFinal Kaldes med den endelige transskription, når en sætning er færdig.
 */
export function useVoiceInput(onFinal?: (transcript: string) => void): UseVoiceInput {
  const [status, setStatus] = useState<VoiceStatus>(computeInitialStatus);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Hændelser er globale (ikke pr. komponent) — brug refs så callbacks ikke bliver forældede.
  const statusRef = useRef(status);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    statusRef.current = status;
    onFinalRef.current = onFinal;
  });

  // Registrér lyttere én gang; ryd op ved unmount.
  useEffect(() => {
    if (!voiceModuleAvailable()) return;
    const subs: VoiceSubscription[] = [];

    subs.push(
      addSpeechListener('result', (e) => {
        const text = e.results?.[0]?.transcript ?? '';
        if (e.isFinal) {
          setTranscript('');
          setStatus('idle');
          if (text) onFinalRef.current?.(text);
        } else {
          setTranscript(text);
          setStatus('listening');
        }
      }),
    );

    subs.push(
      addSpeechListener('error', (e) => {
        const msg = mapError(e.error);
        setError(msg || null);
        setStatus('idle');
      }),
    );

    subs.push(
      addSpeechListener('nomatch', () => {
        setError('Ingen tale genkendt — prøv igen.');
        setStatus('idle');
      }),
    );

    subs.push(
      addSpeechListener('end', () => {
        // Fald tilbage til idle hvis sessionen sluttede uden et endeligt resultat.
        setStatus((s) => (s === 'idle' || s === 'unavailable' ? s : 'idle'));
      }),
    );

    return () => {
      subs.forEach((s) => s.remove());
      try {
        getSpeechModule()?.abort();
      } catch {
        // ligegyldigt ved oprydning
      }
    };
  }, []);

  const start = useCallback(async () => {
    const mod = getSpeechModule();
    if (!mod) return;
    // Genkenderen er enkelt-instans (ERROR_RECOGNIZER_BUSY) — undgå dobbelt-start.
    // Opdatér ref'en med det samme: to hurtige tryk i samme frame ser ellers begge 'idle'.
    if (statusRef.current !== 'idle') return;
    statusRef.current = 'starting';

    setError(null);
    setTranscript('');
    setStatus('starting');
    try {
      const perm = await mod.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Mikrofonadgang mangler.');
        setStatus('idle');
        return;
      }
      mod.start({ lang: 'da-DK', interimResults: true, continuous: false });
      setStatus('listening');
    } catch {
      setError('Talegenkendelse kunne ikke startes.');
      setStatus('idle');
    }
  }, []);

  const stop = useCallback(() => {
    const mod = getSpeechModule();
    if (!mod) return;
    if (statusRef.current === 'listening' || statusRef.current === 'starting') {
      setStatus('processing');
      try {
        mod.stop();
      } catch {
        setStatus('idle');
      }
    }
  }, []);

  return { status, transcript, error, start, stop };
}
