"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

interface RecognitionResult { results: ArrayLike<ArrayLike<{ transcript: string }>> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

function subscribe() { return () => undefined; }
function recognitionAvailable() {
  const browser = window as VoiceWindow;
  return Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition);
}

export function useVoice(onTranscript: (text: string, controls: { speak: (text: string) => void }) => void, onError: (message: string) => void) {
  const supported = useSyncExternalStore(subscribe, recognitionAvailable, () => false);
  const synthesisSupported = useSyncExternalStore(subscribe, () => "speechSynthesis" in window, () => false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function listen() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const browser = window as VoiceWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) { onError("Pengenalan suara tidak tersedia di browser ini."); return; }
    stopSpeaking();
    const recognition = new Constructor();
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      onTranscript(text.trim(), { speak });
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error !== "aborted") onError(event.error === "not-allowed" ? "Izin mikrofon ditolak. Periksa izin browser." : "Suara belum terbaca. Coba kembali atau ketik pertanyaan.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); }
    catch { setListening(false); onError("Mikrofon belum dapat dimulai."); }
  }

  function speak(text: string) {
    if (!synthesisSupported) { onError("Pembacaan suara tidak tersedia di browser ini."); return; }
    if (speaking) { stopSpeaking(); return; }
    recognitionRef.current?.stop();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 6000));
    utterance.lang = "id-ID";
    const indonesian = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("id"));
    if (indonesian) utterance.voice = indonesian;
    utterance.rate = 0.96;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); onError("Pembacaan suara berhenti atau tidak tersedia."); };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  return { supported, synthesisSupported, listening, speaking, listen, speak, stopSpeaking };
}