import type { ResearchInput, ResearchProgress, ResearchReport } from "./types";

export async function api<Result>(path: string, options?: RequestInit): Promise<Result> {
  const response = await fetch(path, { ...options, cache: "no-store" });
  const data = await response.json().catch(() => ({ error: "Server tidak dapat dihubungi atau akses ditolak." }));
  if (!response.ok) throw new Error(data.error || `Permintaan gagal (${response.status}).`);
  return data as Result;
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export async function researchStream(
  input: ResearchInput, signal: AbortSignal,
  onProgress: (progress: ResearchProgress) => void,
): Promise<ResearchReport> {
  const response = await fetch("/api/research", { ...jsonRequest("POST", input), signal });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Riset gagal dimulai.");
  }
  if (!response.body) throw new Error("Streaming tidak tersedia.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let report: ResearchReport | undefined;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = block.split("\n").find((line) => line.startsWith("event: "))?.slice(7);
        const payload = block.split("\n").filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n");
        if (!payload) continue;
        const data = JSON.parse(payload);
        if (event === "progress") onProgress(data as ResearchProgress);
        else if (event === "report") report = data as ResearchReport;
        else if (event === "error") throw new Error(data.message || "Riset gagal.");
      }
    }
  } finally { reader.releaseLock(); }
  if (!report) throw new Error("Koneksi terputus sebelum laporan selesai.");
  return report;
}

export function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}