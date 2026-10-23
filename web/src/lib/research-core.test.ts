import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkText, deduplicateSources, extractiveBrief, ftsQuery,
  researchInputSchema, safeWebUrl, validateCloudBrief, validateResearchPlan, validateEvidenceReview,
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

test("direct source links work without search and reject unsafe or excessive input", () => {
  const input = { query: "energi", web: false, urls: [" https://example.org/research "] };
  assert.deepEqual(researchInputSchema.parse(input).urls, ["https://example.org/research"]);
  assert.deepEqual(researchInputSchema.parse({ query: "energi" }).urls, []);
  assert.equal(researchInputSchema.safeParse({ ...input, urls: ["file:///etc/passwd"] }).success, false);
  assert.equal(researchInputSchema.safeParse({ ...input, urls: ["https://user:secret@example.org"] }).success, false);
  assert.equal(researchInputSchema.safeParse({ ...input, urls: Array(4).fill("https://example.org") }).success, false);
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

test("research plans retain the original query and bound model-generated searches", () => {
  const plan = validateResearchPlan({
    objective: "Bandingkan pilihan energi", queries: ["Energi surya", "biaya energi", "risiko energi"],
    checks: ["Periksa tanggal sumber"],
  }, "energi surya");
  assert.equal(plan.queries.length, 3);
  assert.equal(plan.queries[0].toLowerCase(), "energi surya");
  assert.throws(() => validateResearchPlan({ ...plan, command: "execute" }, "energi"));
  assert.throws(() => validateResearchPlan({ ...plan, queries: Array(10).fill("energi") }, "energi"));
});

test("evidence review can remove findings but cannot invent indexes or citations", () => {
  const brief = validateCloudBrief({ title: "Energi", summary: "Awal", findings: [
    { heading: "Fakta", text: "Petikan", kind: "source", sourceIds: [source.id] },
    { heading: "Dugaan", text: "Analisis", kind: "analysis", sourceIds: [source.id] },
  ] }, [source]);
  const review = validateEvidenceReview({ summary: "Ringkasan diperiksa", keep: [0, 0], caveats: ["Bukti terbatas"] }, brief);
  assert.equal(review.brief.findings.length, 1);
  assert.deepEqual(review.brief.findings[0].sourceIds, [source.id]);
  assert.equal(review.removedFindings, 1);
  assert.throws(() => validateEvidenceReview({ summary: "Tidak valid", keep: [5], caveats: [] }, brief));
  assert.throws(() => validateEvidenceReview({ summary: "Tanpa bukti", keep: [], caveats: [] }, brief));
});