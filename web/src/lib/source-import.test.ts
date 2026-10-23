import assert from "node:assert/strict";
import test from "node:test";
import { importSources, parseSourcePage } from "./source-import.ts";

const html = "<html><head><title>Riset energi</title></head><body><nav>Navigasi tidak relevan</nav><main><h1>Energi surya</h1><p>Panel surya mengubah cahaya menjadi energi listrik untuk rumah dan bangunan. Penyimpanan baterai dapat digunakan pada malam hari.</p><script>sendPrivateData()</script></main></body></html>";

test("direct import extracts readable article text without scripts or navigation", () => {
  const source = parseSourcePage(html, "https://example.org/energy#facts");
  assert.equal(source.title, "Riset energi");
  assert.equal(source.url, "https://example.org/energy");
  assert.match(source.content, /Panel surya/);
  assert.doesNotMatch(source.content, /sendPrivateData|Navigasi/);
  assert.throws(() => parseSourcePage("<title>Just a moment...</title><p>Wait</p>", source.url), /verifikasi/);
  assert.throws(() => parseSourcePage("<body><form id='challenge-form'>Check</form></body>", source.url), /verifikasi/);
  assert.throws(() => parseSourcePage("<p>Short</p>", source.url), /terlalu sedikit/);
});

test("direct import deduplicates links and keeps successful pages when another fails", async () => {
  let calls = 0;
  const result = await importSources([
    "https://example.org/energy#one", "https://example.org/energy#two", "https://example.net/blocked",
  ], new AbortController().signal, async (url) => {
    calls++;
    if (url.includes("blocked")) throw new Error("Unavailable");
    return { url, html };
  });
  assert.equal(calls, 2);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].host, "example.org");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Tautan 2/);
});

test("direct import blocks private addresses and cancellation before loading pages", async () => {
  const neverRead = async () => { assert.fail("Unexpected network request"); };
  for (const url of ["http://localhost", "http://127.0.0.1", "http://169.254.169.254", "https://user:secret@example.org"]) {
    await assert.rejects(importSources([url], new AbortController().signal, neverRead));
  }
  await assert.rejects(importSources(Array(4).fill("https://example.org"), new AbortController().signal, neverRead));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(importSources(["https://example.org"], abort.signal, neverRead));
});