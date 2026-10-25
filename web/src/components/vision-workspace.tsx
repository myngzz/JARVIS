"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CircleAlert, FilePlus2, LoaderCircle, ScanText, ShieldCheck, Square, Upload, X } from "lucide-react";
import { api, jsonRequest } from "@/lib/client";
import type { VisionResult } from "@/lib/types";

function captureImage(source: CanvasImageSource, width: number, height: number) {
  if (!width || !height) throw new Error("Kamera belum menghasilkan gambar.");
  const scale = Math.min(1, 1280 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Pengolahan gambar tidak tersedia.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function VisionWorkspace({ aiConfigured, onStored, notify }: {
  aiConfigured: boolean;
  onStored: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [facing, setFacing] = useState("environment");
  const [image, setImage] = useState("");
  const [question, setQuestion] = useState("Jelaskan objek dan teks yang terlihat pada gambar ini.");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VisionResult | null>(null);

  useEffect(() => () => {
    generation.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    abortRef.current?.abort();
  }, []);

  function stopCamera() {
    generation.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
    setStarting(false);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Kamera memerlukan browser yang mendukung, melalui localhost atau HTTPS.");
      return;
    }
    const token = ++generation.current;
    setStarting(true); setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 } } });
      if (token !== generation.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      if (token === generation.current) setLive(true);
    } catch {
      if (token === generation.current) { stopCamera(); setError("Kamera tidak tersedia atau izinnya ditolak. Anda tetap dapat mengunggah gambar."); }
    } finally { if (token === generation.current) setStarting(false); }
  }
  function selectImage(value: string) {
    abortRef.current?.abort();
    setImage(value); setConsent(false); setResult(null); setError("");
  }
  function capture() {
    try {
      const video = videoRef.current;
      if (!video) return;
      selectImage(captureImage(video, video.videoWidth, video.videoHeight));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Gambar tidak dapat diambil."); }
  }

  async function uploadImage(file?: File) {
    if (!file) return;
    if (!/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) || file.size > 6 * 1024 * 1024) {
      setError("Gunakan JPEG, PNG, atau WebP maksimal 6 MB."); return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      try { selectImage(captureImage(bitmap, bitmap.width, bitmap.height)); }
      finally { bitmap.close(); }
    } catch { setError("Berkas gambar tidak dapat dibaca."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (!image || !consent || busy) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true); setError(""); setResult(null);
    try {
      const analysis = await api<VisionResult>("/api/vision", { ...jsonRequest("POST", { question, image, cloudConsent: consent }), signal: abort.signal });
      setResult(analysis);
    } catch (caught) {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : "Analisis gambar gagal.");
    } finally { setBusy(false); abortRef.current = null; }
  }

  async function saveResult() {
    if (!result || saving) return;
    setSaving(true);
    try {
      const text = `Analisis gambar AI\nPertanyaan: ${question}\n\n${result.summary}\n\n${result.observations.join("\n")}\n\nTeks terbaca:\n${result.extractedText}\n\nBatasan:\n${result.uncertainties.join("\n")}`;
      const form = new FormData();
      form.set("file", new File([text], `kamera-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`, { type: "text/plain" }));
      await api("/api/documents", { method: "POST", body: form });
      await onStored();
      notify("Hasil analisis disimpan ke dokumen. Gambar tidak disimpan.");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Hasil tidak dapat disimpan.", true); }
    finally { setSaving(false); }
  }

  return <section className="vision-workspace" aria-label="Analisis kamera">
    <div className="vision-toolbar">
      <span className={`vision-status ${live ? "live" : ""}`}><span className="status-dot" />{live ? "Kamera aktif / lokal" : "Kamera tidak aktif"}</span>
      <label className="camera-selector"><span className="sr-only">Pilihan kamera</span><select aria-label="Pilihan kamera" value={facing} disabled={live || starting} onChange={(event) => setFacing(event.target.value)}><option value="environment">Kamera belakang</option><option value="user">Kamera depan</option></select></label>
    </div>
    <div className="vision-stage">
      <video ref={videoRef} autoPlay muted playsInline aria-label="Pratinjau kamera lokal" className={live ? "" : "camera-inactive"} />
      {!live && <div className="camera-placeholder"><CameraOff size={34} strokeWidth={1.4} /><span>{starting ? "Menunggu izin kamera" : "Kamera tidak aktif"}</span></div>}
      <span className="camera-feed-label">JARVIS / CAM 01</span>
    </div>
    <div className="vision-controls">
      {live || starting ? <button className="button button-secondary" onClick={stopCamera}><Square size={15} />Hentikan kamera</button> : <button className="button button-primary" onClick={() => void startCamera()}><Camera size={16} />Mulai kamera</button>}
      <button className="button button-secondary" onClick={capture} disabled={!live || busy}><Camera size={16} />Ambil gambar</button>
      <button className="button button-secondary" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={16} />Unggah gambar</button>
      <input className="sr-only" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Berkas gambar" onChange={(event) => void uploadImage(event.target.files?.[0])} />
    </div>
    {error && <div className="inline-error" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
    {image && <div className="vision-analysis-grid">
      <div className="vision-capture"><Image src={image} alt="Cuplikan gambar terpilih" fill sizes="(max-width: 720px) 90vw, 380px" unoptimized /><button className="icon-button" aria-label="Hapus cuplikan" title="Hapus cuplikan" onClick={() => selectImage("")} disabled={busy}><X size={17} /></button></div>
      <form className="vision-form" onSubmit={analyze}>
        <label htmlFor="vision-question">Pertanyaan tentang gambar</label>
        <textarea id="vision-question" rows={3} maxLength={600} value={question} disabled={busy} onChange={(event) => { setQuestion(event.target.value); setConsent(false); setResult(null); }} />
        <label className="vision-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} /><span>Saya menyetujui pengiriman gambar dan pertanyaan ini ke OpenAI.</span></label>
        {!aiConfigured && <span className="service-badge">AI cloud belum dikonfigurasi</span>}
        <div className="vision-form-actions">{busy ? <button type="button" className="button button-stop" onClick={() => abortRef.current?.abort()}><Square size={14} />Batalkan analisis</button> : <button className="button button-primary" disabled={!aiConfigured || !consent || question.trim().length < 3}><ScanText size={17} />Analisis gambar</button>}<span><ShieldCheck size={14} />Tidak diarsipkan di JARVIS</span></div>
      </form>
    </div>}
    {busy && <div className="research-progress" role="status"><LoaderCircle className="spin" size={16} /><span>Menganalisis gambar terpilih</span></div>}
    {result && <article className="vision-result">
      <div className="section-heading"><h2>Hasil analisis</h2><button className="button button-secondary" onClick={() => void saveResult()} disabled={saving}><FilePlus2 size={16} />Simpan ke dokumen</button></div>
      <p>{result.summary}</p>
      {result.observations.length > 0 && <ul>{result.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {result.extractedText && <><h3>Teks terbaca</h3><pre className="vision-text">{result.extractedText}</pre></>}
      <div className="report-caveat"><CircleAlert size={16} /><div><p>Interpretasi AI, bukan verifikasi identitas atau kepastian fakta.</p>{result.uncertainties.map((uncertainty, index) => <p key={index}>{uncertainty}</p>)}</div></div>
    </article>}
  </section>;
}
