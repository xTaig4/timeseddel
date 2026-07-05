/**
 * Ren, afhængighedsfri parser af danske stemmekommandoer til en timeregistrering.
 * Ingen import af native-/expo-moduler — så den kan testes som ren logik (jest-expo).
 *
 * Tolerant over for typiske STT-kvirks: store/små bogstaver, "kl.", ekstra ord.
 * Talord ("halv ni") håndteres bevidst ikke — talegenkendelse leverer cifre.
 */

export type VoiceEntryType = 'work' | 'vacation' | 'feriefridag' | 'sick' | 'holiday';

export interface VoiceCommand {
  type?: VoiceEntryType;
  startMin?: number; // minutter efter midnat
  endMin?: number;
  breakMin?: number;
  dayOffset?: -1 | 0 | 1; // i går / i dag / i morgen
  matched: boolean; // true hvis mindst ét felt blev genkendt
}

/** 'HH', 'H.MM' eller 'H:MM' → minutter efter midnat, eller null hvis ugyldig. */
function parseTimeToken(token: string): number | null {
  const match = /^(\d{1,2})(?:[.:](\d{2}))?$/.exec(token);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] != null ? Number(match[2]) : 0;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function parseVoiceCommand(transcript: string): VoiceCommand {
  const text = transcript.toLowerCase();
  const result: VoiceCommand = { matched: false };

  // --- Type (matchér længste nøgleord først: feriefridag før ferie) ---
  if (text.includes('feriefridag')) result.type = 'feriefridag';
  else if (text.includes('ferie')) result.type = 'vacation';
  else if (text.includes('arbejd') || text.includes('job')) result.type = 'work';
  else if (text.includes('syg')) result.type = 'sick';
  else if (text.includes('helligdag')) result.type = 'holiday';

  // --- Tidsinterval "… X til Y …" (H, H.MM, H:MM) ---
  const range = /(\d{1,2}(?:[.:]\d{2})?)\s*til\s*(\d{1,2}(?:[.:]\d{2})?)/.exec(text);
  if (range) {
    const start = parseTimeToken(range[1]);
    const end = parseTimeToken(range[2]);
    // Kun gyldigt hvis begge ender kan parses (ellers ignorér hele intervallet)
    if (start != null && end != null) {
      result.startMin = start;
      result.endMin = end;
    }
  }

  // --- Pause ---
  if (/uden pause|ingen pause/.test(text)) {
    result.breakMin = 0;
  } else if (/halv time/.test(text)) {
    // "en halv times pause"
    result.breakMin = 30;
  } else if (/en time/.test(text)) {
    // "en times pause"
    result.breakMin = 60;
  } else {
    const breakMatch = /(\d{1,3})\s*minut/.exec(text);
    if (breakMatch) result.breakMin = Number(breakMatch[1]);
  }

  // --- Dag (dayOffset er altid sat; standard 0) ---
  let dayPhrase = false;
  if (/i ?går/.test(text)) {
    result.dayOffset = -1;
    dayPhrase = true;
  } else if (/i ?morgen/.test(text)) {
    result.dayOffset = 1;
    dayPhrase = true;
  } else {
    if (/i ?dag/.test(text)) dayPhrase = true;
    result.dayOffset = 0;
  }

  result.matched =
    result.type != null ||
    (result.startMin != null && result.endMin != null) ||
    result.breakMin != null ||
    dayPhrase;

  return result;
}
