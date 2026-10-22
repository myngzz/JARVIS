import { chromium } from "playwright";
import { fetchPublicPage } from "./browser-security.ts";

export async function inspectSources(urls: string[], signal: AbortSignal) {
  if (!urls.length || urls.length > 3) throw new Error("Browser dibatasi tiga halaman per persetujuan.");
  signal.throwIfAborted();
  const browser = await chromium.launch({ headless: true });
  const stop = () => { void browser.close().catch(() => undefined); };
  signal.addEventListener("abort", stop, { once: true });
  const results: { url: string; title: string; text: string }[] = [];
  const failures: string[] = [];
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block", acceptDownloads: false });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    for (const url of urls) {
      signal.throwIfAborted();
      try {
        const source = await fetchPublicPage(url, signal);
        await page.setContent(source.html, { waitUntil: "domcontentloaded", timeout: 10_000 });
        const content = await page.evaluate(() => {
          document.querySelectorAll("script,style,nav,header,footer,form,iframe,object,embed").forEach((element) => element.remove());
          return { title: document.title.slice(0, 180), text: document.body.innerText.slice(0, 24_000) };
        });
        if (content.text.trim().length < 30) throw new Error("Teks halaman tidak cukup.");
        results.push({ url: source.url, title: content.title || new URL(url).hostname, text: content.text });
      } catch {
        signal.throwIfAborted();
        failures.push(url);
      }
    }
    return { results, failures };
  } finally {
    signal.removeEventListener("abort", stop);
    await browser.close();
  }
}