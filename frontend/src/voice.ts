const NATURAL_VOICE_NAMES = [
  /samantha|ava|zoe|karen|moira|daniel/i, // macOS enhanced voices
  /microsoft (aria|jenny|guy|sonia|ryan|libby)/i, // Edge neural voices
  /google (us|uk) english/i,
];
const VOICE_KEY = "sdi_voice_uri";

export type VoiceOption = { id: string; label: string };

export function getStoredVoice() {
  return localStorage.getItem(VOICE_KEY) ?? "auto";
}

export function setStoredVoice(voiceId: string) {
  localStorage.setItem(VOICE_KEY, voiceId);
}

export function getVoiceOptions(): VoiceOption[] {
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => /^en([_-]|$)/i.test(voice.lang))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name))
    .map((voice) => ({ id: voice.voiceURI, label: `${voice.name} · ${voice.lang}${voice.localService ? "" : " · online"}` }));
}

export function subscribeToVoices(listener: (voices: VoiceOption[]) => void) {
  const publish = () => listener(getVoiceOptions());
  publish();
  window.speechSynthesis.addEventListener("voiceschanged", publish);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", publish);
}

function chooseVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((voice) => /^en([_-]|$)/i.test(voice.lang));
  return english.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

function scoreVoice(voice: SpeechSynthesisVoice) {
  const identity = `${voice.name} ${voice.lang}`;
  const namedVoice = NATURAL_VOICE_NAMES.findIndex((pattern) => pattern.test(identity));
  return (voice.localService ? 10 : 0) + (namedVoice === -1 ? 0 : 100 - namedVoice * 10) + (/en-US|en-GB/i.test(voice.lang) ? 5 : 0);
}

function makeSpeakable(text: string) {
  return text
    .replace(/\*\*|`|#/g, "")
    .replace(/[–—]/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

export function speak(text: string, attempt = 0) {
  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();

  // Chrome may populate voices just after the first interaction. A tiny single
  // retry avoids falling back to the noticeably robotic browser default.
  if (!voices.length && attempt === 0) {
    window.setTimeout(() => speak(text, 1), 120);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(makeSpeakable(text));
  utterance.rate = 0.96;
  utterance.pitch = 1.01;
  utterance.volume = 0.92;
  const requested = getStoredVoice();
  const preferred = voices.find((voice) => voice.voiceURI === requested) ?? chooseVoice(voices);
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}

export function createRecognizer() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  return rec;
}
