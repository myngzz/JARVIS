import { load } from "cheerio";
import { safeWebUrl } from "./research-core.ts";

export class KeylessSearchError extends Error {
  status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

export function parseSearchPage(html: string) {
  const document = load(html);
  document("script,style,noscript,template").remove();
  if (document("#challenge-form, #anomaly-modal, .anomaly-modal, [data-testid='anomaly-modal']").length) {
    throw new KeylessSearchError("Penyedia pencarian meminta verifikasi manusia. Buka pencarian di browser Anda, lalu masukkan tautan sumber secara manual.", 429);
  }
  const hits: { title: string; url: string; content: string }[] = [];
  document(".result").each((_index, element) => {
    const item = document(element);
    if (item.hasClass("result--ad") || item.find(".result__badge--ad, .result__ad").length) return;
    const anchor = item.find("a.result__a").first();
    const href = anchor.attr("href");
    if (!href) return;
    let destination: string | undefined;
    try {
      const link = new URL(href, "https://html.duckduckgo.com");
      const internal = link.hostname === "duckduckgo.com" || link.hostname.endsWith(".duckduckgo.com");
      destination = internal ? safeWebUrl(link.searchParams.get("uddg") ?? undefined) : safeWebUrl(link.href);
    } catch { return; }
    const title = anchor.text().replace(/\s+/g, " ").trim();
    const content = item.find(".result__snippet").first().text().replace(/\s+/g, " ").trim();
    if (destination && title && content) hits.push({ title, url: destination, content });
  });
  if (!hits.length && !document(".no-results, .no-results__message").length) {
    const text = document("body").text();
    if (/captcha|verify.{0,30}human|automated requests|unusual traffic|access denied/i.test(text)) {
      throw new KeylessSearchError("Akses pencarian otomatis sedang dibatasi. Gunakan pencarian di browser dan tautan sumber manual; tidak ada upaya melewati verifikasi.", 429);
    }
    throw new KeylessSearchError("Halaman hasil pencarian tidak dapat dibaca. Gunakan pencarian di browser dan masukkan tautan sumber yang dipilih.");
  }
  return hits;
}

export async function searchWithoutKey(query: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const url = new URL("https://html.duckduckgo.com/html/");
  url.search = new URLSearchParams({ q: query, kl: "id-id" }).toString();
  const response = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": "JarvisWorkspace/1.0 (personal research; no challenge bypass)" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), cache: "no-store", redirect: "error",
  });
  if ([202, 403, 429].includes(response.status)) {
    await response.body?.cancel();
    throw new KeylessSearchError("Penyedia membatasi pencarian otomatis dari server ini. Buka pencarian di browser Anda dan masukkan tautan sumber manual. API key tidak diperlukan.", 429);
  }
  if (!response.ok || !/text\/html/i.test(response.headers.get("content-type") ?? "")) {
    await response.body?.cancel();
    throw new KeylessSearchError("Layanan pencarian HTML sedang tidak tersedia. Gunakan tautan sumber manual.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new KeylessSearchError("Layanan pencarian mengembalikan halaman kosong.");
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) {
        await reader.cancel();
        throw new KeylessSearchError("Halaman pencarian melebihi batas ukuran. Gunakan tautan sumber manual.");
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
  } finally { reader.releaseLock(); }
  return parseSearchPage(html);
}