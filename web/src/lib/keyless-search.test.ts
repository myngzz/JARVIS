import assert from "node:assert/strict";
import test from "node:test";
import { KeylessSearchError, parseSearchPage, searchWithoutKey } from "./keyless-search.ts";

const results = `<html><body>
  <div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.edu%2Fresearch">Riset &amp; energi</a><p class="result__snippet">Bukti dari kampus.</p></div>
  <div class="result"><a class="result__a" href="https://energy.example.gov/solar">Energi surya</a><p class="result__snippet">Data energi pemerintah.</p></div>
  <div class="result result--ad"><a class="result__a" href="https://ads.example/product">Iklan</a><p class="result__snippet">Promosi.</p></div>
  <div class="result"><a class="result__a" href="javascript:alert(1)">Tidak aman</a><p class="result__snippet">Abaikan.</p></div>
</body></html>`;

test("keyless search parses public HTML results and decodes destination links", () => {
  const hits = parseSearchPage(results);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].title, "Riset & energi");
  assert.equal(hits[0].url, "https://example.edu/research");
  assert.equal(hits[1].content, "Data energi pemerintah.");
});

test("challenge pages and unknown markup cannot become empty or fabricated search results", () => {
  assert.throws(() => parseSearchPage('<form id="challenge-form">Verify you are human</form>'), KeylessSearchError);
  assert.throws(() => parseSearchPage("<html><body>CAPTCHA required</body></html>"), KeylessSearchError);
  assert.throws(() => parseSearchPage("<html><body>Different search markup</body></html>"), KeylessSearchError);
  assert.deepEqual(parseSearchPage('<div class="no-results">No results</div>'), []);
});

test("keyless requests never carry API credentials or call paid search endpoints", async (context) => {
  context.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    assert.equal(url.hostname, "html.duckduckgo.com");
    assert.equal(url.searchParams.get("q"), "energi surya");
    assert.equal(new Headers(options.headers).has("authorization"), false);
    assert.equal(new Headers(options.headers).has("x-subscription-token"), false);
    return new Response(results, { headers: { "Content-Type": "text/html" } });
  });
  assert.equal((await searchWithoutKey("energi surya", new AbortController().signal)).length, 2);
});

test("HTTP challenges are reported immediately without retries", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { calls++; return new Response("challenge", { status: 202 }); });
  await assert.rejects(searchWithoutKey("energi", new AbortController().signal), (error: unknown) => error instanceof KeylessSearchError && error.status === 429);
  assert.equal(calls, 1);
});

test("oversized pages and cancellation are bounded", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response("x".repeat(2_000_001), { headers: { "Content-Type": "text/html" } }));
  await assert.rejects(searchWithoutKey("energi", new AbortController().signal), /batas ukuran/);
  context.mock.restoreAll();
  context.mock.method(globalThis, "fetch", () => assert.fail("Cancelled request reached the network"));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(searchWithoutKey("energi", abort.signal));
});