"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity as ActivityIcon, ArrowDownToLine, ArrowRight, ArrowUpRight, Asterisk,
  AudioLines, BookOpen, BrainCircuit, Check, CheckCheck, ChevronDown, ChevronRight,
  Camera, CircleAlert, CircleCheck, Clock3, Compass, Database, FileText, Files,
  Globe2, History, Link2, LoaderCircle, LockKeyhole, Menu, Mic, MicOff,
  MoreHorizontal, PanelRightClose, Plus, Search, Send, Settings2, ShieldCheck,
  Sparkles, Square, Trash2, Upload, Volume2, VolumeX, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, downloadText, jsonRequest, researchStream } from "@/lib/client";
import { exampleReport } from "@/lib/example";
import { researchInputSchema, safeWebUrl } from "@/lib/research-core";
import { useVoice } from "@/lib/use-voice";
import type { ActionKind, Approval, ResearchInput, ResearchProgress, Source, Workspace } from "@/lib/types";
import { Modal } from "./modal";
import { VisionWorkspace } from "./vision-workspace";
import { ResearchTools } from "./research-tools";

type View = "research" | "vision" | "documents" | "memory" | "approvals" | "history" | "settings";
type Dialog =
  | { kind: "memory" | "voice" | "search" | "clear" }
  | { kind: "delete"; entity: "documents" | "memories" | "reports"; id: string; title: string }
  | { kind: "document"; title: string; text: string }
  | { kind: "source"; source: Source }
  | null;

const navigation: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "research", label: "Ruang riset", icon: Compass },
  { id: "vision", label: "Kamera", icon: Camera },
  { id: "documents", label: "Dokumen", icon: Files },
  { id: "memory", label: "Memori", icon: BrainCircuit },
  { id: "approvals", label: "Persetujuan", icon: ShieldCheck },
  { id: "history", label: "Riwayat", icon: History },
];

const statusLabels: Record<Approval["status"], string> = {
  pending: "Menunggu", running: "Berjalan", completed: "Selesai", rejected: "Ditolak", failed: "Gagal",
};

function dateLabel(value: string, time = false) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(value));
}

function IconButton({ label, children, onClick, disabled, className = "" }: {
  label: string; children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

function SourceList({ sources, onSelect }: { sources: Source[]; onSelect: (source: Source) => void }) {
  return <div className="source-list">{sources.map((source, index) => (
    <button key={source.id} className="source-card" onClick={() => onSelect(source)} aria-label={`Periksa sumber ${source.title}`}>
      <span className="source-card-top"><span className={`source-icon ${source.kind}`}>{source.kind === "web" ? <Globe2 size={16} /> : source.kind === "document" ? <FileText size={16} /> : <BrainCircuit size={16} />}</span><span className="source-host">{source.host}</span><ArrowUpRight size={14} /></span>
      {source.image && <span className="source-image"><Image src={source.image} alt={source.id === "example-1" ? "Pembangkit listrik tenaga surya Andasol, Spanyol" : source.title} fill sizes="(max-width: 600px) 85vw, 280px" unoptimized /></span>}
      <span className="source-title">{source.title}</span>
      <span className="source-excerpt">{source.excerpt}</span>
      <span className="source-card-bottom"><span className="source-number">{String(index + 1).padStart(2, "0")}</span><span>{source.kind === "web" ? "Sumber terbuka" : "Sumber pribadi"}</span><Link2 size={12} /></span>
    </button>
  ))}{!sources.length && <div className="empty-state compact"><Search size={28} /><h3>Belum ada sumber</h3></div>}</div>;
}

export default function JarvisWorkspace() {
  const [data, setData] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<View>("research");
  const [selectedReport, setSelectedReport] = useState("example");
  const [query, setQuery] = useState("");
  const [sourceLinks, setSourceLinks] = useState("");
  const [options, setOptions] = useState<Omit<ResearchInput, "query">>({ web: true, documents: false, memory: false, depth: "quick", useAi: false, cloudConsent: false });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ResearchProgress | null>(null);
  const [researchError, setResearchError] = useState("");
  const [reportTab, setReportTab] = useState<"brief" | "sources" | "activity">("brief");
  const [sourceFilter, setSourceFilter] = useState<"all" | "web" | "local">("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [mutating, setMutating] = useState(false);
  const [runningAction, setRunningAction] = useState<ActionKind | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryContent, setMemoryContent] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<"pending" | "all">("pending");
  const [clearText, setClearText] = useState("");
  const [moreActions, setMoreActions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const actionAbortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const report = selectedReport === "blank" ? null : data?.reports.find((item) => item.id === selectedReport) ?? exampleReport;
  const pendingCount = data?.approvals.filter((approval) => approval.status === "pending").length ?? 0;
  const sources = report?.sources ?? [];
  const filteredSources = sources.filter((source) => sourceFilter === "all" || (sourceFilter === "web" ? source.kind === "web" : source.kind !== "web"));
  const progressStages = options.useAi && options.depth === "deep" ? ["plan", "search", "sources", "compose", "review", "save"] : ["search", "sources", "compose", "save"];
  const sourceUrls = [...new Set(sourceLinks.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
  const keylessSearch = data?.config.webProvider === "DuckDuckGo HTML";

  function notify(message: string, error = false) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ message, error });
    noticeTimer.current = setTimeout(() => setNotice(null), 6500);
  }

  function navigate(next: View) {
    setView(next);
    setSidebarOpen(false);
    setListSearch("");
    setMoreActions(false);
  }

  const voice = useVoice((text, controls) => {
    const command = text.toLocaleLowerCase().replace(/[.!?]/g, "");
    if (command === "buka dokumen") navigate("documents");
    else if (command === "buka kamera") navigate("vision");
    else if (command === "buka memori") navigate("memory");
    else if (command === "buka persetujuan") navigate("approvals");
    else if (command === "baca laporan" && report) controls.speak(`${report.title}. ${report.summary}. ${report.findings.map((finding) => finding.text).join(" ")}`);
    else { setQuery(text); navigate("research"); inputRef.current?.focus(); }
  }, (message) => notify(message, true));

  useEffect(() => {
    const controller = new AbortController();
    api<Workspace>("/api/workspace", { signal: controller.signal }).then((workspace) => {
      setData(workspace);
      if (workspace.reports.length) setSelectedReport(workspace.reports[0].id);
    }).catch((error) => {
      if (!controller.signal.aborted) { setLoadError(true); setNotice({ message: error.message, error: true }); }
    });
    return () => { controller.abort(); abortRef.current?.abort(); actionAbortRef.current?.abort(); if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); setDialog({ kind: "search" }); }
      if (event.key === "Escape") { setSidebarOpen(false); setMoreActions(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function refresh() {
    const workspace = await api<Workspace>("/api/workspace");
    setData(workspace);
    setLoadError(false);
    setSelectedReport((current) => current === "blank" ? current : workspace.reports.some((item) => item.id === current) ? current : "example");
    return workspace;
  }

  function newResearch() {
    navigate("research"); setQuery(""); setSourceLinks(""); setSelectedReport("blank"); setResearchError(""); setReportTab("brief");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function submitResearch(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const input = researchInputSchema.safeParse({ query, ...options, urls: sourceUrls });
    if (!input.success) { setResearchError(input.error.issues[0]?.message ?? "Input riset tidak valid."); return; }
    if (options.useAi && !options.cloudConsent) { setResearchError("Persetujuan pengiriman ke AI cloud belum diberikan."); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true); setResearchError(""); setProgress(null); setReportTab("brief"); voice.stopSpeaking();
    try {
      const result = await researchStream(input.data, controller.signal, setProgress);
      await refresh();
      setSelectedReport(result.id);
      setSourceFilter("all");
      notify(`${result.sources.length} sumber tersimpan. Laporan selesai.`);
    } catch (error) {
      if (controller.signal.aborted) notify("Riset dibatalkan.");
      else setResearchError(error instanceof Error ? error.message : "Riset gagal.");
    } finally { setBusy(false); setProgress(null); abortRef.current = null; }
  }

  async function upload(files: FileList | File[] | null) {
    if (!files?.length || uploading) return;
    setUploading(true);
    let completed = 0;
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const form = new FormData(); form.set("file", file);
        await api("/api/documents", { method: "POST", body: form }); completed++;
      }
      notify(`${completed} dokumen ditambahkan.`);
    } catch (error) { notify(error instanceof Error ? error.message : "Unggahan gagal.", true); }
    finally {
      await refresh().catch(() => notify("Workspace belum dapat dimuat ulang.", true));
      setUploading(false); if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function createApproval(action: ActionKind) {
    if (!report || report.mode === "example" || mutating) return;
    setMutating(true); setMoreActions(false);
    try {
      await api("/api/approvals", jsonRequest("POST", { reportId: report.id, action }));
      await refresh(); setApprovalFilter("pending"); navigate("approvals");
      notify("Tindakan menunggu persetujuan Anda.");
    } catch (error) { notify(error instanceof Error ? error.message : "Permintaan gagal.", true); }
    finally { setMutating(false); }
  }

  async function decide(approval: Approval, decision: "approve" | "reject") {
    if (mutating) return;
    setMutating(true);
    const abort = new AbortController();
    actionAbortRef.current = abort;
    if (decision === "approve") setRunningAction(approval.action);
    try {
      const result = await api<{ download?: { filename: string; content: string }; message?: string }>(`/api/approvals/${approval.id}`, { ...jsonRequest("POST", { decision }), signal: abort.signal });
      if (result.download) downloadText(result.download.filename, result.download.content);
      notify(decision === "approve" ? result.message ?? "Tindakan selesai." : "Tindakan ditolak.");
    } catch (error) { notify(error instanceof Error ? error.message : "Tindakan gagal.", true); }
    finally { await refresh().catch(() => undefined); setMutating(false); setRunningAction(null); actionAbortRef.current = null; }
  }

  async function saveMemory(event: React.FormEvent) {
    event.preventDefault(); if (mutating) return; setMutating(true);
    try {
      await api("/api/memories", jsonRequest("POST", { title: memoryTitle, content: memoryContent }));
      await refresh(); setDialog(null); setMemoryTitle(""); setMemoryContent(""); notify("Memori disimpan.");
    } catch (error) { notify(error instanceof Error ? error.message : "Memori gagal disimpan.", true); }
    finally { setMutating(false); }
  }

  async function deleteItem() {
    if (dialog?.kind !== "delete" || mutating) return; setMutating(true);
    try {
      await api(`/api/${dialog.entity}/${dialog.id}`, { method: "DELETE" });
      await refresh(); setDialog(null); notify("Data dihapus dari workspace.");
    } catch (error) { notify(error instanceof Error ? error.message : "Penghapusan gagal.", true); }
    finally { setMutating(false); }
  }

  async function openDocument(id: string, title: string) {
    try {
      const result = await api<{ text: string }>(`/api/documents/${id}`);
      setDialog({ kind: "document", title, text: result.text });
    } catch (error) { notify(error instanceof Error ? error.message : "Dokumen gagal dibaca.", true); }
  }

  function startVoice() {
    if (voice.listening) { voice.listen(); return; }
    if (!voice.supported) { notify("Pengenalan suara tidak tersedia di browser ini.", true); return; }
    try { if (localStorage.getItem("jarvis:voice-consent") === "yes") { voice.listen(); return; } } catch { setDialog({ kind: "voice" }); return; }
    setDialog({ kind: "voice" });
  }

  function selectReport(id: string) { setSelectedReport(id); setReportTab("brief"); navigate("research"); }
  const pageTitle = view === "research" ? "Ruang riset" : view === "vision" ? "Kamera & analisis" : view === "documents" ? "Pustaka dokumen" : view === "memory" ? "Memori pribadi" : view === "approvals" ? "Persetujuan tindakan" : view === "history" ? "Riwayat riset" : "Pengaturan workspace";
  const matches = (text: string) => text.toLocaleLowerCase().includes(listSearch.toLocaleLowerCase());

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Tutup navigasi" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <Link className="brand" href="/" aria-label="JARVIS beranda"><span className="brand-symbol"><Asterisk size={29} strokeWidth={1.6} /></span><span>JARVIS<span className="brand-version">WORKSPACE / 01</span></span></Link>
        <button className="new-research" onClick={newResearch}><Plus size={18} /><span>Riset baru</span><ArrowUpRight size={16} /></button>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Navigasi utama">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => navigate(id)} aria-current={view === id ? "page" : undefined}><Icon size={18} /><span>{label}</span>{id === "approvals" && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}{id === "documents" && Boolean(data?.documents.length) && <span className="nav-count muted">{data?.documents.length}</span>}</button>)}</nav>
        <div className="recent-section"><div className="nav-caption">RISET TERAKHIR</div>{data?.reports.slice(0, 4).map((item) => <button key={item.id} className={`recent-item ${selectedReport === item.id && view === "research" ? "selected" : ""}`} onClick={() => selectReport(item.id)}><span className="recent-dot" /><span>{item.query}</span></button>)}{!data?.reports.length && <button className="recent-item" onClick={() => selectReport("example")}><span className="recent-dot example-dot" /><span>Energi terbarukan</span><span className="mini-label">contoh</span></button>}</div>
        <div className="sidebar-bottom"><div className="local-status"><span className="local-status-icon"><Database size={17} /></span><div><strong>Workspace pribadi</strong><span>{data?.documents.length ?? 0} dokumen / {data?.memories.length ?? 0} memori</span></div><LockKeyhole size={13} /></div><button className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Settings2 size={18} /><span>Pengaturan</span></button><div className="profile"><span className="avatar">ME</span><div><strong>Personal workspace</strong><span>Penyimpanan lokal server</span></div><span className="status-dot" /></div></div>
      </aside>

      <div className="workspace-shell">
        <header className="topbar"><div className="topbar-left"><IconButton label="Buka navigasi" className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></IconButton><span className="breadcrumb-root">Workspace</span><ChevronRight size={13} /><span>{navigation.find((item) => item.id === view)?.label ?? "Pengaturan"}</span></div><div className="topbar-right"><span className={`connection-status ${loadError ? "offline" : ""}`}><span className="status-dot" />{loadError ? "Offline" : data ? "Terhubung" : "Menghubungkan"}</span><span className="topbar-divider" /><IconButton label="Cari di workspace" onClick={() => { setQuickSearch(""); setDialog({ kind: "search" }); }}><Search size={18} /></IconButton><IconButton label={voice.listening ? "Hentikan mikrofon" : voice.supported ? "Mulai input suara" : "Suara tidak didukung browser"} onClick={startVoice} disabled={!voice.supported} className={voice.listening ? "listening" : ""}><AudioLines size={19} /></IconButton><span className="header-avatar">ME</span></div></header>

        <div className={`workspace-body ${view === "research" && evidenceOpen ? "with-evidence" : ""}`}>
          <main className="main-content" id="main-content">
            <div className="page-heading"><div><div className="eyebrow"><span className="tiny-square" />PERSONAL INTELLIGENCE</div><h1>{pageTitle}</h1></div><span className="workspace-tag"><LockKeyhole size={12} />Pribadi</span></div>

            {view === "research" && <>
              <div className="web-search-status" role="status"><Globe2 size={15} /><span>{keylessSearch ? "Web tanpa API" : "Web umum"}</span><strong>{data?.config.webProvider ?? "Memuat"}</strong>{data && !data.config.webConfigured && <IconButton label="Pengaturan pencarian web" onClick={() => navigate("settings")}><Settings2 size={16} /></IconButton>}{query.trim().length >= 3 && <a className="text-button external-search" href={`https://duckduckgo.com/?q=${encodeURIComponent(query.trim())}`} target="_blank" rel="noreferrer">Buka pencarian di browser<ArrowUpRight size={14} /></a>}</div>
              <form className={`research-composer ${busy ? "is-busy" : ""}`} onSubmit={submitResearch}>
                <div className="composer-input"><Sparkles size={21} className="composer-spark" /><label className="sr-only" htmlFor="research-query">Topik atau pertanyaan</label><textarea id="research-query" ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Apa yang ingin Anda telusuri?" rows={2} maxLength={500} disabled={busy} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void submitResearch(); } }} /><IconButton label={voice.listening ? "Hentikan input suara" : "Input pertanyaan dengan suara"} onClick={startVoice} disabled={!voice.supported || busy} className={voice.listening ? "listening" : ""}>{voice.listening ? <MicOff size={19} /> : <Mic size={19} />}</IconButton></div>
                <div className="composer-options"><div className="source-options">{([{ key: "web", label: "Web", icon: Globe2 }, { key: "documents", label: "Dokumen", icon: FileText }, { key: "memory", label: "Memori", icon: BrainCircuit }] as const).map(({ key, label, icon: Icon }) => <label key={key} className={`source-check ${options[key] ? "checked" : ""}`}><input type="checkbox" checked={options[key]} disabled={busy} onChange={(event) => setOptions({ ...options, [key]: event.target.checked })} /><Icon size={14} /><span>{label}</span></label>)}</div><div className="segmented depth-toggle" aria-label="Kedalaman riset"><button type="button" aria-pressed={options.depth === "quick"} onClick={() => setOptions({ ...options, depth: "quick" })} disabled={busy}>Ringkas</button><button type="button" aria-pressed={options.depth === "deep"} onClick={() => setOptions({ ...options, depth: "deep" })} disabled={busy}>Mendalam</button></div></div>
                <details className="direct-sources"><summary><Link2 size={15} /><span>Tautan sumber</span><span>{sourceUrls.length} / 3</span><ChevronDown size={14} /></summary><label className="sr-only" htmlFor="source-links">URL sumber, satu per baris</label><textarea id="source-links" rows={3} maxLength={6100} value={sourceLinks} disabled={busy} onChange={(event) => setSourceLinks(event.target.value)} placeholder={"https://example.org/artikel\nhttps://example.com/riset"} spellCheck={false} /></details>
                <div className="composer-footer"><label className={`ai-switch ${!data?.config.aiConfigured ? "unavailable" : ""}`} title={!data?.config.aiConfigured ? "AI cloud belum dikonfigurasi" : "Gunakan AI cloud"}><input type="checkbox" checked={options.useAi} disabled={!data?.config.aiConfigured || busy} onChange={(event) => setOptions({ ...options, useAi: event.target.checked, cloudConsent: false })} /><span className="switch-track" /><Sparkles size={13} /><span>{options.useAi ? data?.config.model : "Ekstraktif lokal"}</span></label>{busy ? <button className="button button-stop" type="button" onClick={() => abortRef.current?.abort()}><Square size={13} fill="currentColor" />Batalkan</button> : <button className="button button-primary research-submit" type="submit" disabled={!data || query.trim().length < 3}><span>Mulai riset</span><ArrowRight size={16} /></button>}</div>
                {options.useAi && <label className="cloud-consent"><input type="checkbox" checked={options.cloudConsent} onChange={(event) => setOptions({ ...options, cloudConsent: event.target.checked })} />Saya menyetujui pengiriman pertanyaan dan petikan sumber terpilih, termasuk data pribadi, ke OpenAI.</label>}
              </form>
              {busy && <div className="research-progress" role="status"><LoaderCircle size={16} className="spin" /><span>{progress?.message ?? "Menghubungkan sumber"}</span><span className="progress-steps">{progressStages.map((stage, index) => <span key={stage} className={index <= progressStages.indexOf(progress?.stage ?? "search") ? "reached" : ""} />)}</span></div>}
              {researchError && <div className="inline-error" role="alert"><CircleAlert size={16} /><span>{researchError}</span></div>}
              {!busy && !query && <div className="suggestions"><span>Jelajahi</span>{["Energi terbarukan", "Kecerdasan buatan", "Ekonomi sirkular"].map((topic) => <button key={topic} onClick={() => { setQuery(topic); inputRef.current?.focus(); }}>{topic}<ArrowUpRight size={12} /></button>)}</div>}

              {report && <ResearchTools report={report} disabled={busy || mutating} browserConfigured={Boolean(data?.config.browserConfigured)} onAction={(action) => void createApproval(action)} />}
              {report ? <section className="report-section" aria-label="Laporan riset">
                <div className="report-tabs"><div role="tablist" aria-label="Tampilan laporan">{([{ id: "brief", label: "Laporan", icon: BookOpen }, { id: "sources", label: "Sumber", icon: Link2 }, { id: "activity", label: "Aktivitas", icon: ActivityIcon }] as const).map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={reportTab === id} onClick={() => setReportTab(id)}><Icon size={15} />{label}{id === "sources" && <span className="tab-count">{sources.length}</span>}</button>)}</div><IconButton label="Tampilkan atau sembunyikan panel sumber" onClick={() => { if (window.innerWidth < 1180) setReportTab("sources"); else setEvidenceOpen(!evidenceOpen); }}><PanelRightClose size={17} /></IconButton></div>
                {reportTab === "brief" && <article className="report-paper"><div className="report-kicker"><span className={`mode-badge ${report.mode}`}><span />{report.mode === "example" ? "Laporan contoh" : report.mode === "cloud" ? "Analisis AI" : "Laporan ekstraktif"}</span><div className="report-actions"><IconButton label={voice.speaking ? "Hentikan pembacaan" : "Bacakan laporan"} disabled={!voice.synthesisSupported} onClick={() => voice.speak(`${report.title}. ${report.summary}. ${report.findings.map((finding) => `${finding.heading}. ${finding.text}`).join(" ")}`)}>{voice.speaking ? <VolumeX size={17} /> : <Volume2 size={17} />}</IconButton><IconButton label="Ajukan ekspor Markdown" disabled={report.mode === "example" || mutating} onClick={() => void createApproval("export_markdown")}><ArrowDownToLine size={17} /></IconButton><div className="action-menu-anchor"><IconButton label="Tindakan laporan lainnya" disabled={report.mode === "example"} onClick={() => setMoreActions(!moreActions)}><MoreHorizontal size={19} /></IconButton>{moreActions && <div className="action-menu"><button onClick={() => void createApproval("save_memory")}><BrainCircuit size={15} />Simpan ke memori</button><button disabled={!data?.config.webhookConfigured} onClick={() => void createApproval("send_webhook")} title={!data?.config.webhookConfigured ? "Webhook belum dikonfigurasi" : "Ajukan pengiriman"}><Send size={15} />Kirim ke webhook</button><button className="danger-text" onClick={() => { setMoreActions(false); setDialog({ kind: "delete", entity: "reports", id: report.id, title: report.title }); }}><Trash2 size={15} />Hapus laporan</button></div>}</div></div></div>
                  <h2 className="report-title">{report.title}</h2><div className="report-meta"><span><Globe2 size={13} />{report.sources.length} sumber</span><span><Clock3 size={13} />{report.mode === "example" ? "Contoh terkurasi" : dateLabel(report.createdAt, true)}</span><span>{report.provider}</span></div>
                  <p className="report-summary">{report.summary}</p>
                  <div className="findings">{report.findings.map((finding, index) => <section className="finding" key={`${report.id}-${index}`}><div className="finding-number">{String(index + 1).padStart(2, "0")}</div><div className="finding-content"><div className="finding-heading"><h3>{finding.heading}</h3>{finding.kind === "analysis" && <span className="analysis-tag">Analisis</span>}</div><p>{finding.text}</p><div className="citation-row">{finding.sourceIds.map((sourceId) => { const source = sources.find((item) => item.id === sourceId); return source ? <button key={sourceId} className="citation" title={source.title} aria-label={`Lihat sumber ${sources.indexOf(source) + 1}`} onClick={() => setDialog({ kind: "source", source })}><Link2 size={11} />{sources.indexOf(source) + 1}</button> : null; })}</div></div></section>)}</div>
                  {report.warnings.length > 0 && <div className="report-caveat"><CircleAlert size={15} /><div>{report.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></div>}
                  <div className="report-end"><Asterisk size={18} /><span>JARVIS / {report.mode === "example" ? "CONTOH" : "RESEARCH BRIEF"}</span><span>{report.mode === "example" ? "02 SUMBER" : `${report.sources.length.toString().padStart(2, "0")} SUMBER`}</span></div>
                </article>}
                {reportTab === "sources" && <div className="sources-tab"><div className="section-heading"><h2>Sumber laporan</h2><span>{sources.length} referensi</span></div><SourceList sources={sources} onSelect={(source) => setDialog({ kind: "source", source })} /></div>}
                {reportTab === "activity" && <div className="activity-tab"><div className="section-heading"><h2>Aktivitas workspace</h2><span>Terbaru</span></div>{data?.activities.length ? <div className="activity-list">{data.activities.map((activity) => <div className="activity-item" key={activity.id}><span className="activity-marker" /><div><p>{activity.text}</p><time dateTime={activity.createdAt}>{dateLabel(activity.createdAt, true)}</time></div><Check size={14} /></div>)}</div> : <div className="empty-state"><ActivityIcon size={30} /><h3>Belum ada aktivitas</h3></div>}</div>}
              </section> : <div className="research-empty"><div className="empty-grid"><Compass size={36} strokeWidth={1.25} /></div><h2>Riset berikutnya dimulai di sini.</h2><div className="empty-facts"><span><Globe2 size={14} />Sumber terbuka</span><span><LockKeyhole size={14} />Memori pribadi</span><span><ShieldCheck size={14} />Kendali Anda</span></div></div>}
            </>}

            {view === "documents" && <section className="library-view"><div className={`upload-area ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files); }}><span className="upload-icon">{uploading ? <LoaderCircle size={24} className="spin" /> : <Upload size={24} />}</span><div><h2>{uploading ? "Memproses dokumen" : "Tambahkan dokumen"}</h2><p>PDF, TXT, Markdown / maks. 6 MB</p></div><button className="button button-primary" onClick={() => fileRef.current?.click()} disabled={uploading}><Plus size={16} /><span>Pilih berkas</span></button><input type="file" ref={fileRef} className="sr-only" accept=".pdf,.txt,.md,.markdown" multiple aria-label="Unggah dokumen" onChange={(event) => void upload(event.target.files)} /></div><div className="list-toolbar"><h2>Semua dokumen <span>{data?.documents.length ?? 0}</span></h2><label className="search-field"><Search size={15} /><input aria-label="Cari dokumen" placeholder="Cari dokumen" value={listSearch} onChange={(event) => setListSearch(event.target.value)} /></label></div><div className="document-table">{data?.documents.filter((document) => matches(document.name)).map((document) => <div className="document-row" key={document.id}><span className="document-icon"><FileText size={22} /></span><button className="document-name" onClick={() => void openDocument(document.id, document.name)}><strong>{document.name}</strong><span>{document.chunks} potongan / {(document.bytes / 1024).toFixed(1)} KB</span></button><time dateTime={document.createdAt}>{dateLabel(document.createdAt)}</time><span className="ready-label"><CircleCheck size={13} />Siap</span><IconButton label={`Hapus dokumen ${document.name}`} onClick={() => setDialog({ kind: "delete", entity: "documents", id: document.id, title: document.name })}><Trash2 size={16} /></IconButton></div>)}</div>{!data?.documents.filter((document) => matches(document.name)).length && <div className="empty-state"><Files size={36} strokeWidth={1.4} /><h3>{listSearch ? "Dokumen tidak ditemukan" : "Belum ada dokumen"}</h3></div>}</section>}

            {view === "memory" && <section><div className="list-toolbar"><h2>Catatan tersimpan <span>{data?.memories.length ?? 0}</span></h2><button className="button button-primary" onClick={() => { setMemoryTitle(""); setMemoryContent(""); setDialog({ kind: "memory" }); }}><Plus size={16} />Tambah memori</button></div><label className="search-field library-search"><Search size={15} /><input placeholder="Cari memori" aria-label="Cari memori" value={listSearch} onChange={(event) => setListSearch(event.target.value)} /></label><div className="memory-grid">{data?.memories.filter((memory) => matches(`${memory.title} ${memory.content}`)).map((memory) => <article className="memory-card" key={memory.id}><div className="memory-card-top"><BrainCircuit size={19} /><time dateTime={memory.createdAt}>{dateLabel(memory.createdAt)}</time><IconButton label={`Hapus memori ${memory.title}`} onClick={() => setDialog({ kind: "delete", entity: "memories", id: memory.id, title: memory.title })}><Trash2 size={15} /></IconButton></div><h3>{memory.title}</h3><p>{memory.content}</p><button className="text-button" onClick={() => setDialog({ kind: "document", title: memory.title, text: memory.content })}>Buka catatan<ArrowUpRight size={14} /></button></article>)}</div>{!data?.memories.filter((memory) => matches(`${memory.title} ${memory.content}`)).length && <div className="empty-state"><BrainCircuit size={36} strokeWidth={1.4} /><h3>{listSearch ? "Memori tidak ditemukan" : "Belum ada memori"}</h3></div>}</section>}

            {view === "approvals" && <section><div className="approvals-intro"><span className="approval-shield"><ShieldCheck size={25} /></span><div><h2>{pendingCount} tindakan menunggu</h2><p>Belum dieksekusi</p></div><span className="status-label">Persetujuan manual</span></div><div className="list-toolbar"><div className="segmented"><button aria-pressed={approvalFilter === "pending"} onClick={() => setApprovalFilter("pending")}>Menunggu <span>{pendingCount}</span></button><button aria-pressed={approvalFilter === "all"} onClick={() => setApprovalFilter("all")}>Semua tindakan</button></div></div><div className="approval-list">{data?.approvals.filter((approval) => approvalFilter === "all" || approval.status === "pending").map((approval) => <article className="approval-card" key={approval.id}><div className="approval-top"><span className="action-type-icon">{approval.action === "save_memory" ? <BrainCircuit size={20} /> : approval.action === "export_markdown" ? <ArrowDownToLine size={20} /> : <Send size={20} />}</span><div><h3>{approval.title}</h3><time dateTime={approval.createdAt}>{dateLabel(approval.createdAt, true)}</time></div><span className={`approval-status ${approval.status}`}>{statusLabels[approval.status]}</span></div><div className="action-destination"><ArrowRight size={13} /><span>Tujuan</span><strong>{approval.destination}</strong></div><details className="approval-preview"><summary>Pratinjau data<ChevronDown size={15} /></summary><pre>{approval.preview}</pre></details>{approval.error && <p className="inline-error"><CircleAlert size={15} />{approval.error}</p>}{approval.status === "pending" && <div className="approval-buttons"><button className="button button-secondary" disabled={mutating} onClick={() => void decide(approval, "reject")}><X size={15} />Tolak</button><button className="button button-primary" disabled={mutating} onClick={() => void decide(approval, "approve")}><Check size={16} />Setujui & jalankan</button></div>}</article>)}</div>{!data?.approvals.filter((approval) => approvalFilter === "all" || approval.status === "pending").length && <div className="empty-state"><CheckCheck size={36} strokeWidth={1.4} /><h3>{approvalFilter === "pending" ? "Tidak ada tindakan tertunda" : "Belum ada tindakan"}</h3></div>}</section>}

            {view === "history" && <section><div className="list-toolbar"><h2>Laporan tersimpan <span>{data?.reports.length ?? 0}</span></h2><label className="search-field"><Search size={15} /><input aria-label="Cari riwayat" placeholder="Cari laporan" value={listSearch} onChange={(event) => setListSearch(event.target.value)} /></label></div><div className="history-list">{data?.reports.filter((item) => matches(`${item.title} ${item.query}`)).map((item) => <article className="history-row" key={item.id}><span className="history-icon"><BookOpen size={21} /></span><button onClick={() => selectReport(item.id)}><h3>{item.title}</h3><span>{item.sources.length} sumber / {item.mode === "cloud" ? "Analisis AI" : "Ekstraktif"} / {dateLabel(item.createdAt, true)}</span></button><IconButton label={`Hapus laporan ${item.title}`} onClick={() => setDialog({ kind: "delete", entity: "reports", id: item.id, title: item.title })}><Trash2 size={16} /></IconButton><IconButton label={`Buka laporan ${item.title}`} onClick={() => selectReport(item.id)}><ArrowUpRight size={18} /></IconButton></article>)}</div>{!data?.reports.filter((item) => matches(`${item.title} ${item.query}`)).length && <div className="empty-state"><History size={36} strokeWidth={1.4} /><h3>{listSearch ? "Laporan tidak ditemukan" : "Belum ada riwayat riset"}</h3><button className="button button-secondary" onClick={newResearch}><Plus size={15} />Riset baru</button></div>}</section>}

            {view === "settings" && <section className="settings-view"><div className="settings-section"><h2>Layanan</h2><div className="setting-row"><Globe2 size={20} /><div><strong>Pencarian web umum</strong><span>{data?.config.webConfigured ? data.config.webProvider : "Tavily / Brave"}</span></div><span className={`service-badge ${data?.config.webConfigured ? "ready" : ""}`}>{data?.config.webConfigured ? "Dikonfigurasi" : "Belum dikonfigurasi"}</span></div><div className="setting-row"><Sparkles size={20} /><div><strong>AI cloud</strong><span>{data?.config.aiConfigured ? data.config.model : "OpenAI"}</span></div><span className={`service-badge ${data?.config.aiConfigured ? "ready" : ""}`}>{data?.config.aiConfigured ? "Terhubung" : "Belum dikonfigurasi"}</span></div><div className="setting-row"><Send size={20} /><div><strong>Webhook</strong><span>{data?.config.webhookDestination ?? "Tidak ada tujuan"}</span></div><span className={`service-badge ${data?.config.webhookConfigured ? "ready" : ""}`}>{data?.config.webhookConfigured ? "Terhubung" : "Nonaktif"}</span></div></div><div className="settings-section"><h2>Suara</h2><div className="setting-row"><Mic size={20} /><div><strong>Pengenalan suara</strong><span>Bahasa Indonesia / layanan browser</span></div><span className={`service-badge ${voice.supported ? "ready" : ""}`}>{voice.supported ? "Tersedia" : "Tidak didukung"}</span></div><div className="setting-row"><Volume2 size={20} /><div><strong>Pembacaan laporan</strong><span>Bahasa Indonesia / suara perangkat</span></div><span className={`service-badge ${voice.synthesisSupported ? "ready" : ""}`}>{voice.synthesisSupported ? "Tersedia" : "Tidak didukung"}</span></div></div><div className="settings-section"><h2>Data & privasi</h2><div className="setting-row"><Database size={20} /><div><strong>Penyimpanan lokal server</strong><span>{data?.documents.length ?? 0} dokumen / {data?.memories.length ?? 0} memori / {data?.reports.length ?? 0} laporan</span></div><LockKeyhole size={17} /></div><div className="privacy-note"><ShieldCheck size={17} /><p>Dokumen dan memori hanya dikirim ke AI cloud setelah persetujuan. Kueri web dikirim ke penyedia pencarian yang aktif.</p></div><div className="danger-zone"><div><h3>Hapus seluruh data workspace</h3><p>Termasuk dokumen, memori, riwayat, dan persetujuan.</p></div><button className="button button-danger" onClick={() => { setClearText(""); setDialog({ kind: "clear" }); }}><Trash2 size={15} />Hapus data</button></div></div></section>}
            {view === "vision" && <VisionWorkspace aiConfigured={Boolean(data?.config.aiConfigured)} onStored={async () => { await refresh(); }} notify={notify} />}
            {runningAction && <div className="research-progress" role="status"><LoaderCircle size={16} className="spin" /><span>Menjalankan tindakan yang disetujui</span>{runningAction === "browser_read" && <button className="button button-stop" onClick={() => actionAbortRef.current?.abort()}><Square size={13} />Hentikan tindakan</button>}</div>}
            <footer className="workspace-footer"><span><span className="status-dot" />JARVIS WORKSPACE</span><span>Anda memegang kendali.</span></footer>
          </main>

          {view === "research" && evidenceOpen && <aside className="evidence-panel" aria-label="Panel sumber"><div className="evidence-header"><div><Link2 size={17} /><h2>Jejak sumber</h2><span>{sources.length}</span></div><IconButton label="Tutup panel sumber" onClick={() => setEvidenceOpen(false)}><PanelRightClose size={16} /></IconButton></div><div className="evidence-subtitle"><span className="status-dot" />{report?.mode === "example" ? "Referensi laporan contoh" : `${sources.length} sumber dalam laporan`}</div><div className="segmented evidence-filters">{([{ key: "all", text: "Semua" }, { key: "web", text: "Web" }, { key: "local", text: "Lokal" }] as const).map(({ key, text }) => <button key={key} aria-pressed={sourceFilter === key} onClick={() => setSourceFilter(key)}>{text}</button>)}</div><SourceList sources={filteredSources} onSelect={(source) => setDialog({ kind: "source", source })} />{report?.mode === "example" && <a className="image-credit" href="https://commons.wikimedia.org/wiki/File:Andasol_Guadix_4.jpg" target="_blank" rel="noreferrer">Foto Andasol: kallerna / CC BY-SA 4.0<ArrowUpRight size={11} /></a>}<div className="evidence-footer"><ShieldCheck size={17} /><div><strong>Sumber bukan kepastian</strong><span>Verifikasi sebelum mengambil keputusan.</span></div></div></aside>}
        </div>
      </div>

      {notice && <div className={`toast ${notice.error ? "toast-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.error ? <CircleAlert size={18} /> : <CircleCheck size={18} />}<span>{notice.message}</span><IconButton label="Tutup notifikasi" onClick={() => setNotice(null)}><X size={15} /></IconButton></div>}

      {dialog?.kind === "source" && <Modal title="Detail sumber" onClose={() => setDialog(null)}><div className="source-detail"><span className="detail-domain"><Globe2 size={15} />{dialog.source.host}</span><h3>{dialog.source.title}</h3><p>{dialog.source.excerpt}</p><div className="detail-date">Diakses {dateLabel(dialog.source.accessedAt, true)}</div>{safeWebUrl(dialog.source.url) ? <a className="button button-primary" href={safeWebUrl(dialog.source.url)} target="_blank" rel="noreferrer">Buka sumber asli<ArrowUpRight size={16} /></a> : <span className="service-badge ready">Sumber lokal</span>}</div></Modal>}
      {dialog?.kind === "document" && <Modal title={dialog.title} onClose={() => setDialog(null)} wide><pre className="document-preview">{dialog.text}</pre></Modal>}
      {dialog?.kind === "memory" && <Modal title="Memori baru" onClose={() => !mutating && setDialog(null)}><form className="modal-form" onSubmit={saveMemory}><label>Judul<input value={memoryTitle} onChange={(event) => setMemoryTitle(event.target.value)} maxLength={160} required autoFocus placeholder="Misalnya, preferensi riset" /></label><label>Catatan<textarea value={memoryContent} onChange={(event) => setMemoryContent(event.target.value)} rows={7} maxLength={20_000} required placeholder="Tulis catatan Anda" /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setDialog(null)} disabled={mutating}>Batal</button><button className="button button-primary" disabled={mutating || !memoryTitle.trim() || !memoryContent.trim()}><Check size={16} />Simpan memori</button></div></form></Modal>}
      {dialog?.kind === "delete" && <Modal title="Hapus data ini?" onClose={() => !mutating && setDialog(null)}><div className="confirmation-content"><p className="confirmation-name">{dialog.title}</p><p>{dialog.entity === "reports" ? "Laporan dan tindakan terkait akan dihapus." : "Data dan laporan yang mengutipnya akan dihapus. Salinan yang sudah diekspor atau disimpan terpisah sebagai memori tidak ikut terhapus."}</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDialog(null)} disabled={mutating}>Batal</button><button className="button button-danger" onClick={() => void deleteItem()} disabled={mutating}><Trash2 size={15} />Hapus permanen</button></div></div></Modal>}
      {dialog?.kind === "voice" && <Modal title="Izin input suara" onClose={() => setDialog(null)}><div className="confirmation-content"><div className="voice-permission-icon"><Mic size={28} /></div><p>Audio dapat diproses oleh layanan pengenalan suara penyedia browser, bukan hanya perangkat ini. JARVIS tidak menyimpan rekaman audio.</p><p>Anda dapat menghentikan mikrofon kapan saja. Hindari mengucapkan kata sandi atau informasi rahasia.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDialog(null)}>Batal</button><button className="button button-primary" onClick={() => { try { localStorage.setItem("jarvis:voice-consent", "yes"); } catch { notify("Izin suara hanya berlaku untuk sesi ini."); } setDialog(null); voice.listen(); }}><Mic size={16} />Setuju & mulai</button></div></div></Modal>}
      {dialog?.kind === "search" && <Modal title="Cari di workspace" onClose={() => setDialog(null)}><div className="quick-search"><label className="search-field"><Search size={18} /><input autoFocus placeholder="Laporan, dokumen, atau memori" aria-label="Pencarian workspace" value={quickSearch} onChange={(event) => setQuickSearch(event.target.value)} /></label><div className="quick-results">{data?.reports.filter((item) => item.title.toLocaleLowerCase().includes(quickSearch.toLocaleLowerCase())).slice(0, 5).map((item) => <button key={item.id} onClick={() => { setDialog(null); selectReport(item.id); }}><BookOpen size={17} /><span>{item.title}<small>Laporan</small></span><ArrowUpRight size={14} /></button>)}{data?.documents.filter((item) => item.name.toLocaleLowerCase().includes(quickSearch.toLocaleLowerCase())).slice(0, 5).map((item) => <button key={item.id} onClick={() => void openDocument(item.id, item.name)}><FileText size={17} /><span>{item.name}<small>Dokumen</small></span><ArrowUpRight size={14} /></button>)}{data?.memories.filter((item) => item.title.toLocaleLowerCase().includes(quickSearch.toLocaleLowerCase())).slice(0, 5).map((item) => <button key={item.id} onClick={() => setDialog({ kind: "document", title: item.title, text: item.content })}><BrainCircuit size={17} /><span>{item.title}<small>Memori</small></span><ArrowUpRight size={14} /></button>)}{!data?.reports.length && !data?.documents.length && !data?.memories.length && <div className="empty-state compact"><Search size={26} /><h3>Workspace masih kosong</h3></div>}</div></div></Modal>}
      {dialog?.kind === "clear" && <Modal title="Hapus seluruh workspace?" onClose={() => !mutating && setDialog(null)}><div className="confirmation-content"><p>Penghapusan ini tidak dapat dibatalkan. Berkas yang sudah diekspor dan data yang sudah terkirim ke pihak lain tidak ikut dihapus.</p><label className="confirm-clear-label">Ketik HAPUS SEMUA<input value={clearText} onChange={(event) => setClearText(event.target.value)} autoComplete="off" /></label><div className="modal-actions"><button className="button button-secondary" onClick={() => setDialog(null)} disabled={mutating}>Batal</button><button className="button button-danger" disabled={mutating || clearText !== "HAPUS SEMUA"} onClick={async () => { setMutating(true); try { await api("/api/workspace", jsonRequest("DELETE", { confirmation: clearText })); await refresh(); setSelectedReport("example"); setDialog(null); notify("Seluruh data workspace telah dihapus."); } catch (error) { notify(error instanceof Error ? error.message : "Penghapusan gagal.", true); } finally { setMutating(false); } }}><Trash2 size={15} />Hapus seluruh data</button></div></div></Modal>}
    </div>
  );
}