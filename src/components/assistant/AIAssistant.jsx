import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Trash2, Mic, Volume2, VolumeX, Square, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useProject } from '@/lib/ProjectContext';

const SUGGESTED = [
  'How can I reduce waste?',
  'Why was this piece rotated?',
  'How much material am I saving?',
  'Can these pieces fit on one sheet?',
  'What does kerf mean?',
  'Which sheet size should I choose?',
  'Explain this layout.',
];

// code -> label + BCP-47 tag for the browser speech APIs.
// ElevenLabs (flash v2.5 / scribe) supports all of these.
const LANGUAGES = [
  { code: 'en', label: 'English', bcp47: 'en-US' },
  { code: 'es', label: 'Spanish', bcp47: 'es-ES' },
  { code: 'fr', label: 'French', bcp47: 'fr-FR' },
  { code: 'de', label: 'German', bcp47: 'de-DE' },
  { code: 'hi', label: 'Hindi', bcp47: 'hi-IN' },
  { code: 'pt', label: 'Portuguese', bcp47: 'pt-BR' },
  { code: 'it', label: 'Italian', bcp47: 'it-IT' },
  { code: 'ar', label: 'Arabic', bcp47: 'ar-SA' },
  { code: 'zh', label: 'Chinese', bcp47: 'zh-CN' },
  { code: 'ja', label: 'Japanese', bcp47: 'ja-JP' },
];
const bcp47 = (code) => LANGUAGES.find((l) => l.code === code)?.bcp47 || 'en-US';

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    text: "Hi! I'm CutWise AI. What would you like to know about your layout?",
  },
];

function RobotMascot({ size = 40, className = '' }) {
  return (
    <svg
      viewBox="0 0 220 220"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id="robotHalo" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#143F5E" />
          <stop offset="100%" stopColor="#0B2537" />
        </linearGradient>
        <linearGradient id="robotShell" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#D9E7F0" />
        </linearGradient>
        <linearGradient id="robotAccent" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#6FE3EE" />
          <stop offset="100%" stopColor="#38C9D8" />
        </linearGradient>
      </defs>

      <circle cx="110" cy="110" r="92" fill="url(#robotHalo)" stroke="#4ACFEA" strokeWidth="7" />
      <circle cx="110" cy="110" r="72" fill="rgba(255,255,255,0.05)" />

      <g transform="translate(0 6)">
        <path d="M67 52 L86 18 L95 52 Z" fill="#75E3EE" />
        <path d="M153 52 L134 18 L125 52 Z" fill="#75E3EE" />
        <rect x="78" y="18" width="12" height="24" rx="6" fill="#7FE5F1" />
        <rect x="130" y="18" width="12" height="24" rx="6" fill="#7FE5F1" />

        <rect x="52" y="48" width="116" height="68" rx="28" fill="url(#robotShell)" stroke="#DBEAF2" strokeWidth="3" />
        <rect x="70" y="64" width="80" height="36" rx="16" fill="#0B4052" opacity="0.15" />
        <circle cx="88" cy="84" r="10" fill="#67E4F4" />
        <circle cx="133" cy="84" r="10" fill="#67E4F4" />
        <circle cx="88" cy="84" r="4" fill="#EAFBFF" />
        <circle cx="133" cy="84" r="4" fill="#EAFBFF" />
        <path d="M95 104 Q110 116 125 104" fill="none" stroke="#4BD3EA" strokeWidth="5" strokeLinecap="round" />

        <ellipse cx="110" cy="146" rx="62" ry="52" fill="#DDECF4" />
        <ellipse cx="110" cy="148" rx="50" ry="40" fill="url(#robotAccent)" opacity="0.95" />
        <circle cx="78" cy="149" r="12" fill="#BDEAF5" />
        <circle cx="142" cy="149" r="12" fill="#BDEAF5" />

        <path d="M101 170 C92 186, 103 196, 110 196 C117 196, 128 186, 119 170" fill="#7FE5F1" stroke="#4ACFEA" strokeWidth="3" />
        <path d="M82 167 Q76 186 50 178" fill="none" stroke="#7FE5F1" strokeWidth="9" strokeLinecap="round" />
        <path d="M138 167 Q144 186 170 178" fill="none" stroke="#7FE5F1" strokeWidth="9" strokeLinecap="round" />

        <circle cx="80" cy="170" r="12" fill="#78DAEE" />
        <circle cx="140" cy="170" r="12" fill="#78DAEE" />
        <circle cx="79" cy="170" r="6" fill="#EAFBFF" />
        <circle cx="141" cy="170" r="6" fill="#EAFBFF" />
      </g>
    </svg>
  );
}

// Pull a readable message out of whatever the function call threw.
const errorText = (e) =>
  e?.response?.data?.error || e?.data?.error || e?.message || 'Unknown error';

// ───────── Offline / demo mode ─────────
// The assistant switches itself between online (Base44 AI + ElevenLabs voice) and offline
// (answers from your project data + the browser's voice):
//  - if the AI service fails for any reason (out of credits, network, 404...), it goes offline,
//  - while offline it makes no backend calls, and every RETRY_MS it tries the service again,
//  - as soon as the service answers again, it goes back online by itself.
// Optional: VITE_AI_OFFLINE=true in .env.local forces offline mode (never calls the backend).
const OFFLINE = import.meta.env.VITE_AI_OFFLINE === 'true';
const RETRY_MS = 30000;

function localAnswer(question, ctx, language) {
  const q = question.toLowerCase().trim();
  const m = ctx.material || {};
  const s = ctx.stats;
  const b = ctx.baselineStats;
  const pieces = ctx.pieces || [];
  const has = (...w) => w.some((x) => q.includes(x));
  const n1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '?');
  const money = (v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : '?');
  const needRun = 'Run the optimizer first and I can use your real numbers for this.';
  const totalPieces = pieces.reduce((total, piece) => total + (Number(piece.quantity) || 0), 0);
  const pieceList = pieces.slice(0, 4).map((piece) => `${piece.quantity || 1} × ${piece.name} (${piece.width}×${piece.height} mm)`).join(', ');
  const projectDetails = [
    m.name || m.type ? `Material: ${m.name || m.type}.` : '',
    m.sheetWidth && m.sheetHeight ? `Sheet size: ${m.sheetWidth}×${m.sheetHeight} mm.` : '',
    pieces.length ? `Cut list: ${pieces.length} piece type(s), ${totalPieces} parts${pieceList ? ` (${pieceList}${pieces.length > 4 ? ', and more' : ''})` : ''}.` : '',
    s ? `Current layout: ${s.sheetsUsed} sheet(s), ${s.placedCount} placed, ${s.unplacedCount} unplaced, ${n1(s.utilization)}% utilization, ${n1(s.waste)}% waste, estimated material cost ${money(s.totalCost)}.` : 'I do not have optimizer results for this project yet.',
  ].filter(Boolean).join(' ');
  let out;

  if (/^(hi|hello|hey|hola|bonjour|hallo|ciao|namaste)(?: there)?[!.?\s]*$/.test(q)) {
    out = s
      ? `Hi! I can see your layout uses ${s.sheetsUsed} sheet(s) at ${n1(s.utilization)}% utilization. What are you working on?`
      : 'Hi! What are you working on? I can help you think through the cut list or material.';
  } else if (/\b(can|do)\s+(you|u)\s+(see|access)\b|\b(?:do|would)\s+(?:you|u)\s+want\s+to\s+see\b|\bsee (my|the) (project|layout)\b/.test(q)) {
    out = `I can see the project details shared by the app. ${projectDetails} I can't view a photo or drawing here, but describe it or add its dimensions to the cut list and we can work through it.`;
  } else if (has('logistic', 'workflow', 'production', 'manufactur', 'shop plan', 'next step', 'organize', 'organise')) {
    out = `${projectDetails} I'd start by checking the quantities and material, then review the layout for unplaced parts before staging sheets. Use the layout as a placement guide; it isn't a validated saw-by-saw cutting sequence. I don't have your delivery dates or shop schedule, but I can help plan around them if you share those details.`;
  } else if (/\b(can|could|would)\s+(you|u)\s+(?:(?:please|pls)\s+)?(help|assist)\b|\bhelp me (with|plan|understand)\b|\bneed help with\b/.test(q)) {
    out = `Sure. I can help you plan the cut list, choose material, or make sense of the layout. ${projectDetails} What are you working on?`;
  } else if (has('kerf')) {
    out = `Kerf is the width of material the saw blade removes with each cut. CutWise reserves ${m.kerf ?? 0} mm between pieces for it, so parts come out the right size instead of slightly small.`;
  } else if (has('rotat')) {
    const sp = ctx.selectedPiece;
    out = sp
      ? `${sp.name} ${sp.rotated ? 'was rotated 90 degrees' : 'was not rotated'} on sheet ${sp.sheet}. The optimizer rotates a piece when that lets it sit tighter against its neighbours and wastes less of the sheet. Rotation is ${m.rotationAllowed === false ? 'off' : 'allowed'} for this project.`
      : 'The optimizer rotates a piece 90 degrees when that packs the sheet tighter. Click a piece in the layout and ask again to hear about that specific piece.';
  } else if (has('sav', 'cost', 'cheap', 'price', 'money', 'lower')) {
    if (s && b && typeof b.totalCost === 'number') {
      const diff = Math.max(0, b.totalCost - s.totalCost);
      out = `Your optimized layout costs ${money(s.totalCost)} on ${s.sheetsUsed} sheet(s). The baseline layout costs ${money(b.totalCost)} on ${b.sheetsUsed}, so you save about ${money(diff)}.`;
    } else if (s) {
      out = `Your layout costs ${money(s.totalCost)} on ${s.sheetsUsed} sheet(s) at ${money(m.pricePerSheet)} per sheet. To spend less, pack more pieces per sheet, since cost depends on how many sheets you need.`;
    } else out = needRun;
  } else if (has('waste', 'scrap', 'reduce', 'utiliz', 'efficien')) {
    if (s) {
      out = `Your layout wastes ${n1(s.waste)}% of the sheet area (${n1(s.utilization)}% is used). To cut waste: allow 90 degree rotation, combine pieces into fewer sheets, use sheet sizes that match your parts, and keep kerf and edge margin as small as is safe.`;
    } else out = `${needRun} Common ways to cut waste: allow rotation, group pieces by size, and pick a sheet size that suits your parts.`;
  } else if (has('fit', 'one sheet', 'single sheet', 'enough')) {
    const W = Number(m.sheetWidth), H = Number(m.sheetHeight), e = Number(m.edgeMargin) || 0;
    const usable = (W - 2 * e) * (H - 2 * e);
    const total = pieces.reduce((a, p) => a + (p.width * p.height * (p.quantity || 1)), 0);
    if (W && H && total) {
      const pct = (total / usable) * 100;
      out = `Your pieces add up to about ${Math.round(total)} mm squared, which is ${pct.toFixed(1)}% of the usable sheet area. ${pct > 100 ? 'That is more than one sheet holds, so you will need more than one.' : 'By area alone they can fit on one sheet, though the real fit also depends on piece shapes and kerf. Run the optimizer to confirm.'} (This is an area estimate, not an optimizer result.)`;
    } else out = 'Add your pieces and sheet size first, then I can estimate whether they fit on one sheet.';
  } else if (has('sheet size', 'which sheet', 'size should')) {
    out = `You are using ${m.sheetWidth ?? '?'} by ${m.sheetHeight ?? '?'} mm sheets${s ? ` and need ${s.sheetsUsed}` : ''}. Pick the size that leaves the least leftover for your pieces, and weigh it against price per sheet (${money(m.pricePerSheet)} now).`;
  } else if (has('explain', 'layout', 'summary', 'overview', 'logistic')) {
    out = s
      ? `Your layout uses ${s.sheetsUsed} sheet(s) of ${m.sheetWidth} by ${m.sheetHeight} mm. ${s.placedCount} pieces are placed and ${s.unplacedCount} are not. Utilization is ${n1(s.utilization)}%, waste is ${n1(s.waste)}%, and the material cost is ${money(s.totalCost)}. Kerf is ${m.kerf ?? 0} mm and the edge margin is ${m.edgeMargin ?? 0} mm.`
      : needRun;
  } else {
    out = `I can help you work through this. ${projectDetails} What are you trying to figure out?`;
  }
  return out;
}

export default function AIAssistant({ open, onToggle, showLauncher = true }) {
  const { material, pieces, layout, baseline, selectedInstanceId, matDef } = useProject();

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lang, setLang] = useState('en');
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recogRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const speakIdRef = useRef(0); // lets us ignore stale TTS responses
  const sendRef = useRef(null); // always points at the latest send()
  const loadingRef = useRef(false);
  const chatDownUntil = useRef(0);  // chat backend considered down until this time
  const voiceDownUntil = useRef(0); // ElevenLabs voice considered down until this time
  const isChatOffline = () => OFFLINE || Date.now() < chatDownUntil.current;
  const isVoiceOffline = () => OFFLINE || Date.now() < voiceDownUntil.current;

  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, transcribing]);

  useEffect(() => {
    if (!showLauncher) return undefined;

    setShowWelcomePopup(true);
    const timer = window.setTimeout(() => setShowWelcomePopup(false), 10000);

    if (!open) {
      return () => clearTimeout(timer);
    }

    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => { if (e.key === 'Escape') onToggle?.(); };
    window.addEventListener('keydown', onKey);

    return () => {
      clearTimeout(timer);
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onToggle, showLauncher]);

  useEffect(() => {
    if (!showLauncher) return undefined;

    const hideTimer = window.setTimeout(() => setShowWelcomePopup(false), 10000);
    return () => clearTimeout(hideTimer);
  }, [showLauncher]);

  const buildContext = useCallback(() => {
    let selectedPiece = null;
    if (selectedInstanceId && layout?.sheets) {
      for (const s of layout.sheets) {
        const p = s.placements.find((pl) => pl.instanceId === selectedInstanceId);
        if (p) { selectedPiece = { ...p, sheet: s.index + 1 }; break; }
      }
    }
    return {
      material: { ...material, name: matDef?.name },
      pieces: (pieces || []).map((p) => ({
        name: p.name, width: p.width, height: p.height,
        quantity: p.quantity, rotationAllowed: p.rotationAllowed,
      })),
      stats: layout?.stats || null,
      baselineStats: baseline?.stats || null,
      selectedPiece,
    };
  }, [material, pieces, layout, baseline, selectedInstanceId, matDef]);

  /* ───────────── Voice output (ElevenLabs, browser fallback) ───────────── */

  const stopSpeaking = useCallback(() => {
    speakIdRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text, language) => {
    if (muted || !text) return;
    stopSpeaking();
    const id = speakIdRef.current;

    const speakWithBrowser = () => {
      if (id !== speakIdRef.current || !('speechSynthesis' in window)) { setSpeaking(false); return; }
      const u = new SpeechSynthesisUtterance(text.slice(0, 500));
      u.lang = bcp47(language);
      u.onend = () => id === speakIdRef.current && setSpeaking(false);
      u.onerror = () => id === speakIdRef.current && setSpeaking(false);
      setSpeaking(true);
      speechSynthesis.speak(u);
    };

    if (isVoiceOffline()) { speakWithBrowser(); return; }

    base44.functions
      .invoke('scrapsmartChat', { action: 'speak', text: text.slice(0, 1000), language })
      .then((res) => {
        if (id !== speakIdRef.current) return; // user muted / sent something newer
        const audio = res?.data?.audio;
        if (!audio) {
          voiceDownUntil.current = Date.now() + RETRY_MS;
          speakWithBrowser();
          return;
        }
        voiceDownUntil.current = 0; // ElevenLabs is working
        const el = new Audio(`data:${res.data.mimeType || 'audio/mpeg'};base64,${audio}`);
        el.onended = () => id === speakIdRef.current && setSpeaking(false);
        el.onerror = () => speakWithBrowser();
        audioRef.current = el;
        setSpeaking(true);
        el.play().catch(speakWithBrowser);
      })
      .catch((e) => {
        console.warn('[CutWise AI] ElevenLabs voice unavailable, using browser voice:', errorText(e));
        voiceDownUntil.current = Date.now() + RETRY_MS;
        speakWithBrowser();
      });
  }, [muted, stopSpeaking]);

  const toggleMute = () => {
    setMuted((m) => {
      if (!m) stopSpeaking(); // muting also silences current playback
      return !m;
    });
  };

  /* ───────────── Sending ───────────── */

  const send = async (text, language = lang) => {
    const msg = (text ?? input).trim();
    if (!msg || loadingRef.current) return;
    stopSpeaking();
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      // Recent conversation (skip the greeting and error bubbles) so replies have memory
      const history = messages
        .slice(1)
        .filter((m) => !m.error)
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 500) }));
      if (isChatOffline()) {
        await new Promise((r) => setTimeout(r, 400));
        const local = localAnswer(msg, buildContext(), language);
        setMessages((m) => [...m, { role: 'assistant', text: local }]);
        speak(local, language);
        return;
      }
      const res = await base44.functions.invoke('scrapsmartChat', {
        message: msg,
        language,
        history,
        context: buildContext(),
      });
      const reply = typeof res?.data?.reply === 'string' ? res.data.reply.trim() : '';
      if (!reply) {
        chatDownUntil.current = Date.now() + RETRY_MS;
        console.warn('[CutWise AI] Chat service returned no reply; switching to offline answers:', res?.data?.error || 'empty reply');
        const local = localAnswer(msg, buildContext(), language);
        setMessages((m) => [...m, { role: 'assistant', text: local }]);
        speak(local, language);
        return;
      }
      chatDownUntil.current = 0; // a valid reply means the service is online again
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
      speak(reply, language);
    } catch (e) {
      console.error('[CutWise AI] chat failed:', e);
      console.warn('[CutWise AI] AI service unavailable, answering offline:', errorText(e));
      chatDownUntil.current = Date.now() + RETRY_MS;
      const local = localAnswer(msg, buildContext(), language);
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: local },
      ]);
      speak(local, language);
    } finally {
      setLoading(false);
    }
  };
  sendRef.current = send;

  /* ───────────── Voice input ───────────── */

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startBrowserRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setListening(false);
      setMessages((c) => [...c, { role: 'assistant', text: 'Voice input is not available in this browser. You can still type your question.', error: true }]);
      return;
    }
    const r = new SR();
    r.lang = bcp47(lang);
    r.interimResults = false;
    r.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript;
      if (t) sendRef.current?.(t, lang);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recogRef.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  };

  const transcribeBlob = async (blob) => {
    setTranscribing(true);
    try {
      const audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const result = await base44.functions.invoke('scrapsmartChat', {
        action: 'transcribe', audio, mimeType: blob.type, language: lang,
      });
      const transcript = result?.data?.text?.trim();
      if (!transcript) throw new Error('No transcript returned');
      setTranscribing(false);
      sendRef.current?.(transcript, lang);
    } catch (e) {
      console.warn('[CutWise AI] transcription unavailable, using browser recognition:', errorText(e));
      voiceDownUntil.current = Date.now() + RETRY_MS;
      setTranscribing(false);
      setMessages((c) => [...c, { role: 'assistant', text: 'Sorry, please say that once more.' }]);
      startBrowserRecognition();
    }
  };

  const toggleMic = async () => {
    // Stop whatever is running
    if (listening) {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      else recogRef.current?.stop();
      setListening(false);
      return;
    }
    stopSpeaking();
    if (isVoiceOffline()) { startBrowserRecognition(); return; }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      startBrowserRecognition();
      return;
    }

    try {
      const status = await base44.functions.invoke('scrapsmartChat', { action: 'voiceStatus' });
      if (!status?.data?.transcriptionAvailable) { startBrowserRecognition(); return; }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      recorder.onstop = () => {
        releaseMic();
        setListening(false);
        if (!chunks.length) return;
        transcribeBlob(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      recorder.start();
      setListening(true);
    } catch (e) {
      console.warn('[CutWise AI] mic setup failed, using browser recognition:', e);
      voiceDownUntil.current = Date.now() + RETRY_MS;
      releaseMic();
      startBrowserRecognition();
    }
  };

  // Cleanup on unmount
  useEffect(() => () => {
    recogRef.current?.stop();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseMic();
    audioRef.current?.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }, []);

  // Stop mic/audio when the panel closes
  useEffect(() => {
    if (open) return;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.onstop = releaseMic; // discard the clip
      recorderRef.current.stop();
    }
    recogRef.current?.stop();
    setListening(false);
    stopSpeaking();
  }, [open, stopSpeaking]);

  const micBusy = loading || transcribing;

  return (
    <>
      {!open && showLauncher && (
        <>
          {showWelcomePopup && (
            <div className="fixed bottom-20 left-4 sm:bottom-24 sm:left-5 z-[60] max-w-[260px] rounded-2xl border border-[#b9891a] bg-[#d4a63a] px-4 py-3 text-sm text-black shadow-[0_20px_55px_rgba(76,58,15,0.35)] animate-[fadeIn_0.25s_ease-out] dark:border-[#e3bd58] dark:bg-[#d4a63a] dark:text-black">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-full bg-[#f5de9a] ring-2 ring-[#8a6415]/80 p-1">
                  <RobotMascot size={24} className="block" />
                </div>
                <p className="leading-snug">
                  Hey, I am your AI Assistant! If you need any help or have questions, let me know!
                </p>
              </div>
            </div>
          )}

          <button
            onClick={onToggle}
            aria-label="Open CutWise AI"
            aria-expanded={false}
            className="fixed bottom-4 left-4 sm:bottom-5 sm:left-5 z-50 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-[#d4a63a] text-black shadow-[0_18px_40px_rgba(127,98,22,0.35)] transition hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#b9891a] dark:bg-[#d4a63a] dark:text-black"
          >
            <div className="flex items-center justify-center rounded-full bg-[#f5de9a] ring-2 ring-[#8a6415]/80 shadow-inner">
              <RobotMascot size={44} className="block" />
            </div>
            <span className="font-semibold text-sm tracking-wide">CutWise AI</span>
          </button>
        </>
      )}

      {open && (
        <>
          {showWelcomePopup && (
            <div className="fixed z-[60] left-1/2 top-6 -translate-x-1/2 sm:left-[22rem] sm:top-8 sm:translate-x-0 rounded-2xl border border-[#b9891a] bg-[#d4a63a] px-4 py-3 text-sm text-black shadow-[0_20px_55px_rgba(76,58,15,0.35)] animate-[fadeIn_0.25s_ease-out] dark:border-[#e3bd58] dark:bg-[#d4a63a] dark:text-black">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-full bg-[#f5de9a] ring-2 ring-[#8a6415]/80 p-1">
                  <RobotMascot size={24} className="block" />
                </div>
                <p className="max-w-[260px] leading-snug">
                  Hey, I am your AI Assistant! If you need any help or have questions, let me know!
                </p>
              </div>
            </div>
          )}

          <div
            role="dialog"
            aria-label="CutWise AI chat"
            className="fixed z-50 inset-0 sm:inset-auto sm:bottom-5 sm:left-5 sm:w-[24rem] sm:h-[min(38rem,calc(100dvh-2.5rem))] bg-[#fffdf9] text-black dark:bg-[#060606] dark:text-black sm:rounded-2xl sm:border border-[#d4a63a]/80 dark:border-[#d4a63a] shadow-[0_22px_60px_rgba(90,70,18,0.25)] flex flex-col overflow-hidden"
          >
            <div className="bg-gradient-to-r from-[#d4a63a] via-[#f3ca68] to-[#b9891a] text-black px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-3 shrink-0 dark:text-black">
              <div className="w-10 h-10 rounded-full bg-[#f5de9a] border border-[#8a6415]/60 flex items-center justify-center shadow-[0_0_0_3px_rgba(138,100,21,0.15)]">
                <RobotMascot size={28} className="block" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm">CutWise AI</div>
                <div className="text-[11px] text-black/75">Your workshop copilot</div>
              </div>
              <button
                onClick={() => { stopSpeaking(); setMessages(INITIAL_MESSAGES); }}
                className="p-1.5 text-black/75 hover:text-black" title="Clear chat" aria-label="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={onToggle} className="p-1.5 text-black/75 hover:text-black" title="Close chat" aria-label="Close chat">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#f5f1ea] dark:bg-[#070707]" aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-[#d4a63a] text-black rounded-br-sm' : m.error ? 'bg-[#f4e3a5] text-black border border-[#c39a2d] rounded-bl-sm' : 'bg-[#fffdf8] text-black border border-[#d4a63a]/60 rounded-bl-sm dark:bg-[#111111] dark:text-white'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {(loading || transcribing) && (
                <div className="flex justify-start">
                  <div className="bg-[#fffdf8] border border-[#d4a63a]/60 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 dark:bg-[#111111]">
                    {transcribing && <span className="text-xs text-black dark:text-white">Transcribing…</span>}
                    <span className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#d4a63a] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#d4a63a] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#d4a63a] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="px-3 pb-2 pt-2 flex flex-wrap gap-1.5 bg-[#f5f1ea] max-h-32 overflow-y-auto shrink-0 dark:bg-[#070707]">
                {SUGGESTED.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-[11px] px-2.5 py-1.5 rounded-full border border-[#d4a63a] bg-[#fff8df] text-black hover:bg-[#f1d57d] transition text-left dark:bg-[#d4a63a] dark:text-black">
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#d4a63a]/60 bg-[#fffdf9] dark:bg-[#0d0d0d] shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                <button
                  onClick={toggleMic}
                  disabled={micBusy}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition disabled:opacity-40 ${listening ? 'bg-[#f4e3a5] text-black animate-pulse' : 'text-black hover:bg-[#f6ebc9] dark:text-white dark:hover:bg-white/10'}`}
                  title={listening ? 'Stop and send' : 'Speak your question'}
                  aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                  aria-pressed={listening}
                >
                  {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  onClick={toggleMute}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${muted ? 'text-black hover:bg-[#f6ebc9] dark:text-white dark:hover:bg-white/10' : 'text-black bg-[#f1d57d]'}`}
                  title={muted ? 'Turn on spoken replies' : 'Turn off spoken replies'}
                  aria-label={muted ? 'Turn on spoken replies' : 'Turn off spoken replies'}
                  aria-pressed={!muted}
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {speaking && (
                  <button
                    onClick={stopSpeaking}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-black hover:bg-[#f6ebc9] transition dark:text-white dark:hover:bg-white/10"
                    title="Stop speaking" aria-label="Stop speaking"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}

                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  aria-label="Chat language"
                  title="Language for questions and answers"
                  className="ml-auto text-xs border border-[#d4a63a]/80 rounded-lg px-2 py-1.5 text-black bg-[#fffaf0] focus:outline-none focus:ring-2 focus:ring-[#d4a63a]/60 dark:bg-[#171717] dark:text-white"
                >
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={listening ? 'Listening…' : 'Ask about your layout…'}
                  aria-label="Ask CutWise AI"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#d4a63a]/70 bg-[#fffaf0] text-black placeholder:text-black/70 focus:outline-none focus:ring-2 focus:ring-[#d4a63a]/50 dark:bg-[#171717] dark:text-white dark:placeholder:text-white/75"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                  className="w-10 h-10 shrink-0 rounded-xl bg-[#d4a63a] text-black flex items-center justify-center hover:bg-[#c99a2b] disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}