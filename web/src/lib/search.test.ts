import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { searchConfiguration, searchWeb, WebSearchError } from "./search.ts";

function configure(context: TestContext, values: Record<string, string>) {
  const names = ["TAVILY_API_KEY", "BRAVE_SEARCH_API_KEY", "JARVIS_SEARCH_PROVIDER"];
  const previous = names.map((name) => [name, process.env[name]] as const);
  for (const name of names) delete process.env[name];
  Object.assign(process.env, values);
  context.after(() => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
}

test("general web selection uses configured providers without a Wikipedia fallback", () => {
  assert.equal(searchConfiguration({}).configured, true);
  assert.equal(searchConfiguration({}).provider, "duckduckgo");
  assert.equal(searchConfiguration({ TAVILY_API_KEY: "test" }).provider, "duckduckgo");
  assert.equal(searchConfiguration({ BRAVE_SEARCH_API_KEY: "test" }).provider, "duckduckgo");
  assert.equal(searchConfiguration({ TAVILY_API_KEY: "test", BRAVE_SEARCH_API_KEY: "test", JARVIS_SEARCH_PROVIDER: "brave" }).provider, "brave");
  assert.equal(searchConfiguration({ TAVILY_API_KEY: "test", JARVIS_SEARCH_PROVIDER: "brave" }).configured, false);
  assert.equal(searchConfiguration({ JARVIS_SEARCH_PROVIDER: "wikipedia" }).configured, false);
});

test("Tavily searches general web domains and removes unsafe and duplicate results", async (context) => {
  configure(context, { TAVILY_API_KEY: "test-key", JARVIS_SEARCH_PROVIDER: "tavily" });
  context.mock.method(globalThis, "fetch", async (target: string, options: RequestInit) => {
    assert.equal(target, "https://api.tavily.com/search");
    const body = JSON.parse(String(options.body));
    assert.equal(body.topic, "general");
    assert.equal(body.query, "energi surya");
    assert.equal("include_domains" in body, false);
    return Response.json({ results: [
      { title: "Riset universitas", url: "https://example.edu/solar#summary", content: "Sumber akademik tentang tenaga surya." },
      { title: "Duplikat", url: "https://example.edu/solar", content: "Konten duplikat" },
      { title: "Lembaga pemerintah", url: "https://energy.example.gov/report", content: "Data energi terbarukan." },
      { title: "Unsafe", url: "javascript:alert(1)", content: "Tidak boleh ditampilkan" },
    ] });
  });
  const result = await searchWeb("energi surya", 5, new AbortController().signal);
  assert.equal(result.provider, "Tavily");
  assert.deepEqual(result.sources.map((source) => source.host), ["example.edu", "energy.example.gov"]);
  assert.equal(new Set(result.sources.map((source) => source.id)).size, 2);
  assert.match(result.warnings[0], /indeks web umum/);
});

test("Brave uses the search API token and returns multi-domain web snippets", async (context) => {
  configure(context, { BRAVE_SEARCH_API_KEY: "test-key", JARVIS_SEARCH_PROVIDER: "brave" });
  context.mock.method(globalThis, "fetch", async (target: URL, options: RequestInit) => {
    assert.equal(target.hostname, "api.search.brave.com");
    assert.equal(target.searchParams.get("q"), "battery research");
    assert.equal(new Headers(options.headers).get("X-Subscription-Token"), "test-key");
    assert.equal(target.href.includes("test-key"), false);
    return Response.json({ web: { results: [
      { title: "Journal", url: "https://journal.example/article", description: "Battery research.", extra_snippets: ["Additional evidence."] },
      { title: "News", url: "https://news.example/story", description: "Industry news." },
    ] } });
  });
  const result = await searchWeb("battery research", 5, new AbortController().signal);
  assert.equal(result.sources.length, 2);
  assert.equal(result.provider, "Brave");
  assert.match(result.sources[0].excerpt, /Additional evidence/);
});

test("missing keys and cancellation never cause a hidden fallback request", async (context) => {
  configure(context, { JARVIS_SEARCH_PROVIDER: "tavily" });
  context.mock.method(globalThis, "fetch", () => assert.fail("Unexpected search request"));
  await assert.rejects(searchWeb("energi", 5, new AbortController().signal), (error: unknown) => error instanceof WebSearchError && error.status === 503);
  process.env.TAVILY_API_KEY = "test-key";
  const abort = new AbortController(); abort.abort();
  await assert.rejects(searchWeb("energi", 5, abort.signal));
});

test("authentication and quota errors remain visible instead of being called empty results", async (context) => {
  configure(context, { TAVILY_API_KEY: "test-key", JARVIS_SEARCH_PROVIDER: "tavily" });
  context.mock.method(globalThis, "fetch", async () => new Response("private provider error", { status: 401 }));
  await assert.rejects(searchWeb("energi", 5, new AbortController().signal), /Kunci API Tavily/);
  context.mock.restoreAll();
  context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 }));
  await assert.rejects(searchWeb("energi", 5, new AbortController().signal), /Kuota/);
});

test("auto mode uses HTML even when paid provider keys exist and does not retry challenges", async (context) => {
  configure(context, { TAVILY_API_KEY: "unused", BRAVE_SEARCH_API_KEY: "unused" });
  let calls = 0;
  context.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    calls++;
    assert.equal(url.hostname, "html.duckduckgo.com");
    assert.equal(options.body, undefined);
    assert.equal(new Headers(options.headers).has("X-Subscription-Token"), false);
    return new Response("verification required", { status: 202 });
  });
  await assert.rejects(searchWeb("energi surya", 5, new AbortController().signal), (error: unknown) => error instanceof WebSearchError && error.status === 429);
  assert.equal(calls, 1);
});