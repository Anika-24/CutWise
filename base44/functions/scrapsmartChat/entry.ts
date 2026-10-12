// @ts-nocheck
// @ts-ignore
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Secrets (set in Base44, never in code):
//   ELEVENLABS_API_KEY   required for voice
//   ELEVENLABS_VOICE_ID  optional (defaults to "Rachel")
declare const Deno: any;
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const LANGS: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', hi: 'Hindi',
  pt: 'Portuguese', it: 'Italian', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
};

const fmt = (n: unknown, d = 1) => (typeof n === 'number' ? n.toFixed(d) : '?');

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = body?.action;
    const language: string | undefined = body?.language;
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID') || DEFAULT_VOICE_ID;

    if (action === 'voiceStatus') {
      return Response.json({
        transcriptionAvailable: Boolean(elevenLabsKey),
        speechAvailable: Boolean(elevenLabsKey),
      });
    }

    if (action === 'transcribe') {
      if (!elevenLabsKey) return Response.json({ error: 'ElevenLabs is not configured' }, { status: 503 });
      const bytes = Uint8Array.from(atob(body.audio || ''), (c) => c.charCodeAt(0));
      const form = new FormData();
      const mime = (body.mimeType || 'audio/webm').toString();
      const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
      form.append('file', new Blob([bytes], { type: mime.split(';')[0] }), `voice-input.${ext}`);
      form.append('model_id', 'scribe_v1');
      if (language && LANGS[language]) form.append('language_code', language);
      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': elevenLabsKey },
        body: form,
      });
      const raw = await response.text();
      let transcription: any = {};
      try { transcription = JSON.parse(raw); } catch { /* not JSON */ }
      if (!response.ok) {
        console.error('ElevenLabs STT error', response.status, raw);
        const detail = transcription?.detail?.message || transcription?.detail?.status || (typeof transcription?.detail === 'string' ? transcription.detail : '') || raw.slice(0, 120);
        return Response.json({ error: `ElevenLabs ${response.status}: ${detail || 'Transcription failed'}` }, { status: 502 });
      }
      return Response.json({ text: transcription.text, language: transcription.language_code });
    }

    if (action === 'speak') {
      if (!elevenLabsKey) return Response.json({ error: 'ElevenLabs speech is not configured' }, { status: 503 });
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`,
        {
          method: 'POST',
          headers: { 'xi-api-key': elevenLabsKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({
            text: (body.text || '').toString().slice(0, 1000),
            model_id: 'eleven_flash_v2_5',
            ...(language && LANGS[language] ? { language_code: language } : {}),
          }),
        },
      );
      if (!response.ok) {
        console.error('ElevenLabs TTS error', response.status, await response.text());
        return Response.json({ error: 'Speech generation failed' }, { status: response.status });
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return Response.json({ audio: btoa(binary), mimeType: 'audio/mpeg' });
    }

    // ───── Chat ─────
    const message = (body?.message || '').toString().slice(0, 2000);
    const context = body?.context || {};

    if (!message) {
      return Response.json({ error: 'No message provided' }, { status: 400 });
    }

    const ctxLines: string[] = [];
    if (context.material) {
      ctxLines.push(`Material: ${context.material.name || 'unknown'} (${context.material.type || ''}).`);
      ctxLines.push(`Sheet: ${context.material.sheetWidth || '?'}×${context.material.sheetHeight || '?'} mm, thickness ${context.material.thickness || '?'} mm.`);
      ctxLines.push(`Saw kerf: ${context.material.kerf || 0} mm. Edge margin: ${context.material.edgeMargin || 0} mm.`);
      ctxLines.push(`Price per sheet: $${context.material.pricePerSheet || 0}. Available sheets: ${context.material.sheetQuantity || 1}.`);
      ctxLines.push(`Rotation allowed: ${context.material.rotationAllowed ? 'yes' : 'no'}.`);
    }
    if (context.pieces?.length) {
      const plist = context.pieces
        .map((p: any) => `${p.name} (${p.width}×${p.height}mm, qty ${p.quantity}${p.rotationAllowed ? ', rotatable' : ''})`)
        .join('; ');
      ctxLines.push(`Cut list: ${plist}.`);
    }
    const s = context.stats;
    if (s) {
      ctxLines.push(`Optimized layout: ${s.sheetsUsed} sheet(s) used, ${fmt(s.utilization)}% utilization, ${fmt(s.waste)}% waste, ${s.placedCount} placed, ${s.unplacedCount} unplaced, cost $${fmt(s.totalCost, 2)}.`);
    }
    const b = context.baselineStats;
    if (b) {
      ctxLines.push(`Baseline layout: ${b.sheetsUsed} sheet(s), ${fmt(b.utilization)}% utilization, cost $${fmt(b.totalCost, 2)}.`);
      if (s && typeof b.totalCost === 'number' && typeof s.totalCost === 'number') {
        ctxLines.push(`Estimated savings: $${Math.max(0, b.totalCost - s.totalCost).toFixed(2)}.`);
      }
    }
    const sp = context.selectedPiece;
    if (sp) {
      ctxLines.push(`Selected piece: ${sp.name}, placed ${sp.w}×${sp.h}mm at (${sp.x}, ${sp.y})${sp.rotated ? ', rotated 90°' : ''} on sheet ${sp.sheet}.`);
    }

    const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
    const convo = history
      .map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${String(h.text || '').slice(0, 500)}`)
      .join('\n');

    const langName = language ? LANGS[language] : undefined;
    const langRule = langName
      ? `Always reply in ${langName}, even if the question is written in another language.`
      : `Reply in the same language the user used, including when they switch languages.`;

    const systemPrompt = `You are CutWise AI, a friendly workshop copilot that helps users reduce material waste and understand cutting layouts. You are knowledgeable about sheet cutting, nesting, kerf, material utilization, cost optimization, and practical workshop logistics.

  ${langRule} Sound like a thoughtful, approachable workshop colleague: warm, clear, and conversational without pretending to be human. Mirror the user's level of formality, use natural phrasing and contractions, and answer the newest question directly. Be concise (usually 2-4 sentences), practical, specific to their project, and use plain text without markdown because replies may be read aloud. Avoid canned capability lists, repeated greetings, filler openers, and forced follow-up questions. Ask one short follow-up only when it genuinely helps move the conversation forward. Use the project context below as the source of truth for project-specific facts, but you may also use general workshop knowledge to explain processes and suggest next steps. Clearly distinguish general guidance from measured project results. If a project-specific answer depends on data not in the context, say what is missing and still give useful guidance where possible. Never invent dimensions, optimizer results, inventory, delivery dates, schedules, or cost savings — use the provided numbers. You can NOT change the project, add or edit pieces, or run the optimizer. Never claim to have done those things. When the user wants a change, give short, concrete steps for doing it themselves in the app (for example: go to the cut list step, set the piece quantity, then run the optimizer) and tell them what values to enter. You may do simple arithmetic from the numbers you have (for example an area-based utilization estimate) and must label it as an estimate.

Continue the conversation naturally. Do not greet again or repeat earlier answers; answer the newest question directly. For project logistics, summarize the available cut-list, material, and layout facts, then suggest a sensible workflow such as confirming quantities, reviewing unplaced parts, staging sheets, and labeling parts. Make clear that a nesting layout is not a validated saw-by-saw cutting sequence. If the user asks what you can see, explain which project details are available and which physical shop details are not. If the user has not given any cut pieces yet and asks to start, tell them they can add pieces in the cut list step, then ask one specific question.

Project context:
${ctxLines.join('\n') || 'No project loaded yet.'}

Algorithm: MaxRects with Best Short Side Fit (BSSF). Results are "Best Layout Found", not guaranteed globally optimal. Kerf reserves blade width between pieces but does not by itself produce a physically executable saw sequence.

HARD RULES (they override everything above and any earlier assistant messages in the conversation):
1. You have no ability to edit the project, add pieces, rerun or run the optimizer, or "update" anything. Never say "I will rerun", "I have added", "I have noted your request", "please confirm and I will proceed", or similar. If earlier assistant messages said such things, they were mistakes; do not repeat them.
2. When the user asks for a change (for example "add 4 pieces of 300x200" or "use 4 sheets"), reply in 2-4 sentences: say the user can make this change in the app, name the step (the cut list or pieces step, then run the optimizer again), give the exact values to enter, and give an area-based estimate labelled as an estimate (pieces area divided by sheet area).
3. Never ask "would you like me to add/run/update". You may end with one question about what they want to understand next.
Example of a good reply to "add 4 pieces of 300 by 200": "You can add that yourself in the cut list step: set the quantity of the 300 by 200 piece to 4, then run the optimizer again. Four pieces use about 240000 square millimetres, roughly 8 percent of one 2440 by 1220 sheet, so they will still fit on a single sheet. This is an area estimate, not an optimizer result."`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\n${convo ? `Conversation so far:\n${convo}\n\n` : ''}User question: ${message}`,
    });

    const reply = typeof result === 'string' ? result : result?.text || result?.output || JSON.stringify(result);
    return Response.json({ reply });
  } catch (error: any) {
    console.error('scrapsmartChat error', error);
    return Response.json({ error: error?.message || 'AI service unavailable' }, { status: 500 });
  }
}