import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkText, deduplicateSources, extractiveBrief, ftsQuery,
  researchInputSchema, safeWebUrl, validateCloudBrief,
} from "./research-core.ts";
import type { Source } from "./types.ts";

const source: Source = {
  id: "web-1", title: "Energi", kind: "web", excerpt: "Isi sumber yang dapat ditelusuri.",
  host: "id.wikipedia.org", url: "https://id.wikipedia.org/wiki/Energi", accessedAt: "2026-10-20",
};

test("input requires a query and at least one source", () => {
  assert.equal(researchInputSchema.safeParse({ query: "a" }).success, false);
  assert.equal(researchInputSchema.safeParse({ query: "energi", web: false }).success, false);
  assert.equal(researchInputSchema.parse({ query: "  energi  " }).query, "energi");
});

test("FTS input cannot introduce operators or SQL syntax", () => {
  assert.equal(ftsQuery('energi" OR 1=1 --'), '"energi" OR "or"');
  assert.equal(ftsQuery("yang dan di"), "");
});

test("chunks retain overlapping context and terminate", () => {
  assert.deepEqual(chunkText("abcdefghij", 6, 2), ["abcdef", "efghij"]);
  assert.deepEqual(chunkText("   "), []);
  assert.throws(() => chunkText("text", 5, 5));
});

test("unsafe source URLs are rejected", () => {
  assert.equal(safeWebUrl("javascript:alert(1)"), undefined);
  assert.equal(safeWebUrl("https://name:secret@example.com"), undefined);
  assert.equal(safeWebUrl(source.url), source.url);
});

test("extractive results preserve excerpts and their actual citations", () => {
  const brief = extractiveBrief("energi", [source]);
  assert.equal(brief.findings[0].text, source.excerpt);
  assert.deepEqual(brief.findings[0].sourceIds, [source.id]);
  assert.throws(() => extractiveBrief("energi", []));
  assert.equal(deduplicateSources([source, { ...source, id: "duplicate" }]).length, 1);
});

test("cloud reports with fabricated citation IDs are rejected", () => {
  const brief = { title: "Energi", summary: "Ringkasan", findings: [
    { heading: "Temuan", text: "Petikan", kind: "source", sourceIds: ["invented"] },
  ] };
  assert.throws(() => validateCloudBrief(brief, [source]), /referensi/);
  brief.findings[0].sourceIds = [source.id];
  assert.equal(validateCloudBrief(brief, [source]).findings.length, 1);
});