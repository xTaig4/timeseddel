// Edge-proxy til Mistral: nøglen bor her, aldrig i appen.
// Klienten sender kun samtalehistorik; systemprompten er serverens.
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

const DAILY_LIMIT = 30;
const MAX_TURNS = 12; // begræns historik → begrænser tokenforbrug
const MAX_CONTENT_LENGTH = 2000;

const SYSTEM_PROMPT = `Du er Timeseddels assistent for danske arbejdstagerrettigheder: ferie (ferieloven), arbejdstid, overarbejde, sygdom, opsigelse og lignende emner.

Fakta du SKAL lægge til grund (nuværende ferielov, LBK nr. 152 af 20/02/2024 — samtidighedsferie):
- Optjening: 2,08 feriedage pr. måneds ansættelse; 25 dage (5 uger) pr. ferieår.
- Ferieåret (optjeningsår) løber 1. september – 31. august. Ferien kan afholdes i ferieafholdelsesperioden 1. september – 31. december året efter (16 måneder). Datoerne 1. maj – 30. april er den GAMLE ferielov før 2020 og må aldrig bruges.
- Feriedage kan bruges allerede måneden efter, de er optjent (samtidighedsferie).
- Den 6. ferieuge/feriefridage er IKKE lovbestemt — den følger af overenskomst.
- Overarbejde: ingen lovregler om sats/afspadsering — kun overenskomst/kontrakt. Dog arbejdstidsloven: højst 48 t/uge i gennemsnit over 4 måneder, 11 timers hviletid.

Regler:
- Svar altid på dansk, kort og præcist. Brug punktopstilling ved flere trin.
- Svar i ren tekst uden markdown-formatering — ingen **fed**, overskrifter eller tabeller. Punktopstilling med "-" er tilladt.
- Skeln tydeligt mellem hvad der er lovbestemt (fx ferielovens 2,08 dage pr. måned) og hvad der afhænger af overenskomst eller kontrakt (fx overarbejdssatser og feriefridage).
- Du giver vejledende information, ikke juridisk rådgivning. Ved konkrete sager: henvis til brugerens fagforening (fx HK) eller a-kasse.
- Er du usikker, så sig det ærligt frem for at gætte.
- Spørgsmål uden for emnet arbejdsliv og ansættelsesforhold (fx programmering, madopskrifter, generel viden) afviser du med én venlig sætning og INTET andet. Du må aldrig besvare selve det spørgsmål, heller ikke delvist eller "for en sikkerheds skyld".`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonError('POST only', 405);
  }

  let body: { deviceToken?: unknown; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('invalid JSON', 400);
  }

  const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken.slice(0, 128) : '';
  if (!deviceToken) return jsonError('deviceToken required', 400);

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError('messages required', 400);
  }
  const messages: ChatMessage[] = body.messages
    .filter(
      (m): m is ChatMessage =>
        typeof m === 'object' &&
        m !== null &&
        ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') &&
        typeof (m as ChatMessage).content === 'string',
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_LENGTH) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return jsonError('last message must be from user', 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: allowed, error: rateError } = await admin.rpc('check_rate_limit', {
    p_device: deviceToken,
    p_limit: DAILY_LIMIT,
  });
  if (rateError) return jsonError('rate check failed', 500);
  if (!allowed) return jsonError('daily limit reached', 429);

  const upstream = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('MISTRAL_API_KEY')}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      temperature: 0.3,
      max_tokens: 1024,
      stream: true,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();
    console.error('mistral error', upstream.status, detail);
    return jsonError('upstream error', 502);
  }

  // Send upstream-SSE direkte videre — text/event-stream forhindrer buffering
  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});
