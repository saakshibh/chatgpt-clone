const SR =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// Change to "hi-IN" for Hindi, "en-US" for US English, etc.
export const VOICE_LANG = "en-IN";

export const speechRecognitionSupported = !!SR;
export const ttsSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

// Speech to text. onEnd receives the final text that was heard.
export function createRecognizer({
  lang = VOICE_LANG,
  continuous = false,
  onInterim,
  onError,
  onEnd,
}) {
  const r = new SR();
  r.lang = lang;
  r.continuous = continuous;
  r.interimResults = true;
  r.maxAlternatives = 1;

  let finalText = "";
  r.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t;
      else interim += t;
    }
    onInterim?.(finalText + interim);
  };
  r.onerror = (e) => onError?.(e.error);
  r.onend = () => onEnd?.(finalText.trim());
  return r;
}

// Removes markdown so it sounds natural when read aloud
export function stripMarkdown(md) {
  return md
    .split("**Sources**")[0]
    .replace(/```[\s\S]*?```/g, " (code block omitted) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/(\*\*|__|\*|_)/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

let stopCurrent = null;

export function stopSpeaking() {
  if (stopCurrent) stopCurrent();
}

// Text to speech. Long text is split into chunks because Chrome cuts off
// long utterances. onEnd is NOT called if the speech was stopped early.
export function speak(text, { lang = VOICE_LANG, onEnd } = {}) {
  stopSpeaking();
  if (!ttsSupported) {
    onEnd?.();
    return;
  }

  const clean = stripMarkdown(text);
  const sentences = clean.match(/[^.!?]+[.!?]*\s*/g) || [clean];
  const parts = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > 200 && cur) {
      parts.push(cur);
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) parts.push(cur);
  if (!parts.length) {
    onEnd?.();
    return;
  }

  let i = 0;
  let cancelled = false;
  const synth = window.speechSynthesis;

  const next = () => {
    if (cancelled) return;
    if (i >= parts.length) {
      stopCurrent = null;
      onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(parts[i++]);
    u.lang = lang;
    u.onend = next;
    u.onerror = () => {
      if (cancelled) return;
      cancelled = true;
      stopCurrent = null;
      onEnd?.();
    };
    synth.speak(u);
  };

  stopCurrent = () => {
    cancelled = true;
    stopCurrent = null;
    synth.cancel();
  };
  synth.cancel(); // clear anything queued by the browser
  next();
}