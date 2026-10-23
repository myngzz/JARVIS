import { createHash } from "node:crypto";
import { z } from "zod";
import { safeWebUrl } from "./research-core.ts";
import { KeylessSearchError, searchWithoutKey } from "./keyless-search.ts";
import type { Source } from "./types.ts";

export type SearchProviderName = "DuckDuckGo HTML" | "Tavily" | "Brave" | "Belum dikonfigurasi";

export class WebSearchError extends Error {
  status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

export function searchConfiguration(environment: Readonly<Record<string, string | undefined>> = process.env): {
  provider: "duckduckgo" | "tavily" | "brave" | null;
  name: SearchProviderName;
  configured: boolean;
  error?: string;
} {
  const selected = (environment.JARVIS_SEARCH_PROVIDER || "auto").trim().toLowerCase();
  if (!["auto", "duckduckgo", "tavily", "brave"].includes(selected)) {
    return { provider: null, name: "Belum dikonfigurasi", configured: false, error: "JARVIS_SEARCH_PROVIDER harus auto, duckduckgo, tavily, atau brave." };
  }
  const provider = selected === "auto" ? "duckduckgo" : selected as "duckduckgo" | "tavily" | "brave";
  const configured = provider === "duckduckgo" || (provider === "tavily" ? Boolean(environment.TAVILY_API_KEY?.trim()) : Boolean(environment.BRAVE_SEARCH_API_KEY?.trim()));
  return {
    provider, name: provider === "duckduckgo" ? "DuckDuckGo HTML" : provider === "tavily" ? "Tavily" : "Brave", configured,
    ...(!configured ? { error: provider === "tavily" ? "Pencarian web Tavily memerlukan TAVILY_API_KEY di konfigurasi server."
      : provider === "brave" ? "Pencarian web Brave memerlukan BRAVE_SEARCH_API_KEY di konfigurasi server."
        : "Pencarian web umum belum dikonfigurasi. Isi TAVILY_API_KEY atau BRAVE_SEARCH_API_KEY di server, lalu mulai ulang. Dokumen dan memori lokal tetap dapat digunakan." } : {}),
  };
}

export function searchSources(hits: { title: string; url: string; content: string }[], limit: number): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const hit of hits) {
    const safe = safeWebUrl(hit.url);
    if (!safe || !hit.title.trim() || !hit.content.trim()) continue;
    const url = new URL(safe);
    url.hash = "";
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    sources.push({
      id: `web-${createHash("sha256").update(url.href).digest("hex").slice(0, 20)}`,
      title: hit.title.slice(0, 300), kind: "web", excerpt: hit.content.slice(0, 3000),
      url: url.href, host: url.hostname, accessedAt: new Date().toISOString(),
    });
    if (sources.length >= limit) break;
  }
  return sources;
}

export async function searchWeb(query: string, limit: number, signal: AbortSignal) {
  const config = searchConfiguration();
  if (!config.configured) throw new WebSearchError(config.error!, 503);
  signal.throwIfAborted();
  const count = Math.min(10, Math.max(1, Math.floor(limit)));
  if (config.provider === "duckduckgo") {
    try {
      const hits = await searchWithoutKey(query, signal);
      return {
        sources: searchSources(hits, count), provider: config.name,
        warnings: ["Pencarian memakai halaman HTML publik DuckDuckGo tanpa API key. Cuplikan hasil bukan verifikasi fakta; akses otomatis dapat dibatasi penyedia dan tidak mencakup seluruh web."],
      };
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof KeylessSearchError) throw new WebSearchError(error.message, error.status);
      throw new WebSearchError("Pencarian tanpa API tidak dapat dihubungi. Buka pencarian di browser dan masukkan tautan sumber manual.");
    }
  }
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
  let response: Response;
  if (config.provider === "tavily") {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: count, topic: "general", search_depth: "basic", include_answer: false }),
      signal: requestSignal, cache: "no-store", redirect: "error",
    });
  } else {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.search = new URLSearchParams({ q: query, count: String(count), text_decorations: "false", safesearch: "moderate" }).toString();
    response = await fetch(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY! },
      signal: requestSignal, cache: "no-store", redirect: "error",
    });
  }
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? `Kunci API ${config.name} tidak valid atau tidak memiliki akses pencarian.`
      : response.status === 429 ? `Kuota atau batas permintaan ${config.name} tercapai. Periksa akun layanan.`
        : `Layanan pencarian ${config.name} sedang tidak tersedia. Coba kembali nanti.`;
    throw new WebSearchError(message, response.status === 429 ? 429 : 502);
  }
  let hits: { title: string; url: string; content: string }[];
  try {
    const value: unknown = await response.json();
    if (config.provider === "tavily") {
      hits = z.object({ results: z.array(z.object({ title: z.string(), url: z.string(), content: z.string() })) }).parse(value).results;
    } else {
      const data = z.object({ web: z.object({ results: z.array(z.object({
        title: z.string(), url: z.string(), description: z.string().optional(), extra_snippets: z.array(z.string()).optional(),
      })).default([]) }).optional() }).parse(value);
      hits = (data.web?.results ?? []).map((hit) => ({ ...hit, content: [hit.description, ...(hit.extra_snippets ?? [])].filter(Boolean).join("\n") }));
    }
  } catch { throw new WebSearchError(`Respons pencarian ${config.name} tidak valid. Tidak ada hasil pengganti yang dibuat.`); }
  return {
    sources: searchSources(hits, count), provider: config.name,
    warnings: [`Pencarian memakai indeks web umum ${config.name}, bukan hanya Wikipedia. Hasil berupa cuplikan mesin pencari; buka sumber asli untuk verifikasi. Tidak semua situs atau halaman privat tercakup.`],
  };
}