import { load } from "cheerio";
import { browserPlanSchema, fetchPublicPage, publicBrowserUrl } from "./browser-security.ts";
import { searchSources, WebSearchError } from "./search.ts";

export function parseSourcePage(html: string, sourceUrl: string) {
  const url = publicBrowserUrl(sourceUrl);
  const document = load(html);
  const title = document("title").first().text().replace(/\s+/g, " ").trim() || url.hostname;
  if (document("#challenge-form, .anomaly-modal, #challenge-running, #cf-challenge-running, #challenge-stage").length
    || /^(just a moment|access denied|verify (you are|your identity)|security verification)/i.test(title)) {
    throw new WebSearchError("Halaman sumber meminta verifikasi atau menolak akses otomatis; tidak diimpor sebagai bukti.", 429);
  }
  document("script,style,noscript,template,nav,header,footer,form,button,iframe,object,embed,svg").remove();
  document("p,li,h1,h2,h3,h4,blockquote,pre").append("\n");
  const main = document("main,article,[role='main']").first();
  const content = (main.length ? main : document("body")).text().replace(/\s+/g, " ").trim();
  if (content.length < 80) throw new WebSearchError("Teks halaman terlalu sedikit. Pilih halaman artikel publik yang dapat dibaca tanpa login.");
  return { title, url: url.href, content };
}

export async function importSources(urls: string[], signal: AbortSignal, readPage: typeof fetchPublicPage = fetchPublicPage) {
  signal.throwIfAborted();
  const plan = browserPlanSchema.parse({ urls });
  const unique = [...new Set(plan.urls.map((url) => publicBrowserUrl(url).href))];
  const results = await Promise.allSettled(unique.map(async (url) => {
    signal.throwIfAborted();
    const page = await readPage(url, signal);
    signal.throwIfAborted();
    return parseSourcePage(page.html, page.url);
  }));
  signal.throwIfAborted();
  const hits: ReturnType<typeof parseSourcePage>[] = [];
  const warnings: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") hits.push(result.value);
    else warnings.push(`Tautan ${index + 1}: ${result.reason instanceof WebSearchError ? result.reason.message : "tidak dapat diambil. Periksa koneksi, akses publik, dan tujuan pengalihannya."}`);
  }
  return { sources: searchSources(hits, 3), warnings };
}