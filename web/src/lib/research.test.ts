import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ResearchProgress } from "./types.ts";

test("deep research executes bounded stages and falls back when review is invalid", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "jarvis-research-test-"));
  const previous = { key: process.env.OPENAI_API_KEY, data: process.env.JARVIS_DATA_DIR, search: process.env.TAVILY_API_KEY, provider: process.env.JARVIS_SEARCH_PROVIDER };
  process.env.OPENAI_API_KEY = "test-placeholder";
  process.env.JARVIS_DATA_DIR = directory;
  process.env.TAVILY_API_KEY = "search-test-placeholder";
  process.env.JARVIS_SEARCH_PROVIDER = "tavily";
  const { runResearch } = await import("./research.ts");
  const { getStore } = await import("./server.ts");
  context.after(() => {
    getStore().close();
    delete (globalThis as typeof globalThis & { jarvisStore?: unknown }).jarvisStore;
    for (const [key, value] of Object.entries({ OPENAI_API_KEY: previous.key, JARVIS_DATA_DIR: previous.data, TAVILY_API_KEY: previous.search, JARVIS_SEARCH_PROVIDER: previous.provider })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  });

  let aiCalls = 0;
  let webCalls = 0;
  let badReview = false;
  let searchUnavailable = false;
  context.mock.method(globalThis, "fetch", async (target: string | URL | Request, options?: RequestInit) => {
    const url = new URL(target instanceof Request ? target.url : String(target));
    if (url.hostname === "api.tavily.com") {
      webCalls++;
      if (searchUnavailable) return new Response(null, { status: 429 });
      return Response.json({ results: [
        { title: "Energi surya", content: "Panel surya mengubah cahaya matahari menjadi listrik.", url: "https://energy.example.gov/solar" },
        { title: "Biaya energi", content: "Biaya energi bergantung pada lokasi proyek.", url: "https://university.example.edu/energy" },
      ] });
    }
    assert.equal(url.hostname, "api.openai.com");
    aiCalls++;
    const body = JSON.parse(String(options?.body));
    const instructions = body.messages[0].content as string;
    const payload = JSON.parse(body.messages[1].content);
    const content = instructions.includes("Buat rencana")
      ? { objective: "Bandingkan energi", queries: ["biaya panel surya", "risiko panel surya"], checks: ["Periksa sumber"] }
      : instructions.includes("Tinjau draft")
        ? { summary: "Ringkasan berdasarkan sumber", keep: [badReview ? 99 : 0], caveats: ["Bukti terbatas pada petikan"] }
        : { title: "Energi surya", summary: "Draft analisis", findings: [
          { heading: "Konversi energi", text: "Panel mengubah cahaya menjadi listrik.", kind: "source", sourceIds: [payload.sources[0].id] },
        ] };
    return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
  });

  const input = { query: "energi surya", web: true, documents: false, memory: false, depth: "deep" as const, useAi: true, cloudConsent: true };
  const stages: ResearchProgress["stage"][] = [];
  const report = await runResearch(input, (event) => stages.push(event.stage), new AbortController().signal);
  assert.deepEqual(stages, ["plan", "search", "sources", "compose", "review", "save"]);
  assert.equal(report.mode, "cloud");
  assert.equal(report.plan?.queries.length, 3);
  assert.equal(report.review?.removedFindings, 0);
  assert.equal(report.summary, "Ringkasan berdasarkan sumber");
  assert.equal(aiCalls, 3);
  assert.equal(webCalls, 3);
  assert.equal(report.searchProvider, "Tavily");
  assert.equal(new Set(report.sources.map((source) => source.host)).size, 2);
  assert.equal(getStore().reports().length, 1);

  badReview = true;
  const fallback = await runResearch(input, () => undefined, new AbortController().signal);
  assert.equal(fallback.mode, "extractive");
  assert.equal(fallback.review, undefined);
  assert.match(fallback.warnings.join(" "), /dialihkan/);
  const calls = aiCalls + webCalls;
  await assert.rejects(runResearch({ ...input, cloudConsent: false }, () => undefined, new AbortController().signal), /Persetujuan/);
  assert.equal(aiCalls + webCalls, calls);

  searchUnavailable = true;
  await assert.rejects(runResearch({ ...input, useAi: false }, () => undefined, new AbortController().signal), /Kuota/);
  getStore().addDocument("Energi.txt", "Energi surya di proyek lokal membutuhkan baterai untuk malam hari.", 100);
  const local = await runResearch({ ...input, useAi: false, documents: true }, () => undefined, new AbortController().signal);
  assert.equal(local.sources[0].kind, "document");
  assert.match(local.warnings.join(" "), /Kuota/);
  assert.equal(local.searchProvider, undefined);
});