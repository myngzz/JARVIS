import { z } from "zod";
import type { ResearchReport, Source } from "./types.ts";

export const researchInputSchema = z.object({
  query: z.string().trim().min(3, "Topik minimal 3 karakter.").max(500),
  web: z.boolean().default(true),
  documents: z.boolean().default(false),
  memory: z.boolean().default(false),
  depth: z.enum(["quick", "deep"]).default("quick"),
  useAi: z.boolean().default(false),
  cloudConsent: z.boolean().default(false),
  urls: z.array(z.string().trim().max(2000).refine((value) => Boolean(safeWebUrl(value)), "Tautan sumber harus HTTP/HTTPS tanpa kredensial.")).max(3, "Maksimal tiga tautan sumber per riset.").default([]),
}).refine((input) => input.web || input.documents || input.memory || input.urls.length > 0, {
  message: "Pilih setidaknya satu sumber.",
});

const stopWords = new Set([
  "yang", "dan", "atau", "dari", "untuk", "dengan", "pada", "dalam", "tentang",
  "adalah", "apa", "bagaimana", "jelaskan", "cari", "riset", "the", "and", "for",
  "about", "what", "how", "with", "this", "that", "di", "ke", "of", "in", "to",
]);

export function queryTerms(query: string): string[] {
  const words = query.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  return [...new Set(words.filter((word) => !stopWords.has(word)))].slice(0, 14);
}

export function ftsQuery(query: string): string {
  return queryTerms(query).map((word) => `"${word}"`).join(" OR ");
}

export function chunkText(text: string, size = 1800, overlap = 180): string[] {
  if (size <= overlap || overlap < 0) throw new Error("Ukuran potongan tidak valid.");
  const normalized = text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  const chunks: string[] = [];
  for (let offset = 0; offset < normalized.length; offset += size - overlap) {
    const chunk = normalized.slice(offset, offset + size).trim();
    if (chunk) chunks.push(chunk);
    if (offset + size >= normalized.length) break;
  }
  return chunks;
}

export function safeWebUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url ?? `${source.kind}:${source.documentId ?? source.id}:${source.excerpt}`;
    if (seen.has(key) || !source.excerpt.trim()) return false;
    seen.add(key);
    return true;
  });
}

export function extractiveBrief(query: string, sources: Source[]) {
  if (!sources.length) throw new Error("Tidak ada sumber yang dapat dirangkum.");
  return {
    title: query,
    summary: `Terkumpul ${sources.length} sumber untuk "${query}". Temuan berikut merupakan petikan sumber, bukan kesimpulan atau verifikasi independen oleh AI.`,
    findings: sources.slice(0, 8).map((source) => ({
      heading: source.title,
      text: source.excerpt.slice(0, 1100),
      sourceIds: [source.id],
      kind: "source" as const,
    })),
  };
}

const cloudBriefSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(4000),
  findings: z.array(z.object({
    heading: z.string().min(1).max(200),
    text: z.string().min(1).max(4000),
    sourceIds: z.array(z.string()).min(1).max(12),
    kind: z.enum(["source", "analysis"]),
  })).min(1).max(8),
});

export function validateCloudBrief(value: unknown, sources: Source[]) {
  const brief = cloudBriefSchema.parse(value);
  const sourceIds = new Set(sources.map((source) => source.id));
  if (brief.findings.some((finding) => finding.sourceIds.some((sourceId) => !sourceIds.has(sourceId)))) {
    throw new Error("Model mengembalikan referensi sumber yang tidak dikenal.");
  }
  return brief;
}

export function validateResearchPlan(value: unknown, query: string) {
  const plan = z.object({
    objective: z.string().trim().min(1).max(800),
    queries: z.array(z.string().trim().min(3).max(180)).min(1).max(3),
    checks: z.array(z.string().trim().min(1).max(240)).min(1).max(4),
  }).strict().parse(value);
  const queries = new Map<string, string>();
  for (const term of [query, ...plan.queries]) {
    if (!queries.has(term.toLocaleLowerCase())) queries.set(term.toLocaleLowerCase(), term);
  }
  return { ...plan, queries: [...queries.values()].slice(0, 3) };
}

export function validateEvidenceReview(value: unknown, brief: ReturnType<typeof validateCloudBrief>) {
  const review = z.object({
    summary: z.string().trim().min(1).max(4000),
    keep: z.array(z.number().int().min(0)).min(1).max(8),
    caveats: z.array(z.string().trim().min(1).max(600)).max(5),
  }).strict().parse(value);
  if (review.keep.some((index) => index >= brief.findings.length)) {
    throw new Error("Pemeriksaan model merujuk temuan yang tidak dikenal.");
  }
  const findings = [...new Set(review.keep)].map((index) => brief.findings[index]);
  return {
    brief: { ...brief, summary: review.summary, findings },
    caveats: review.caveats,
    removedFindings: brief.findings.length - findings.length,
  };
}

export function reportMarkdown(report: ResearchReport): string {
  const sourceNumber = new Map(report.sources.map((source, index) => [source.id, index + 1]));
  const findings = report.findings.map((finding) => {
    const citations = finding.sourceIds.map((sourceId) => `[${sourceNumber.get(sourceId)}]`).join(" ");
    return `## ${finding.heading}\n\n${finding.text}\n\n${citations}`;
  }).join("\n\n");
  const sources = report.sources.map((source, index) =>
    `${index + 1}. ${source.title}${source.url ? ` - ${safeWebUrl(source.url) ?? ""}` : " (sumber lokal)"}`,
  ).join("\n");
  const warnings = report.warnings.length ? `\n\n## Batasan\n\n${report.warnings.map((warning) => `- ${warning}`).join("\n")}` : "";
  return `# ${report.title}\n\nMode: ${report.mode} | ${report.createdAt}\n\n${report.summary}\n\n${findings}\n\n## Sumber\n\n${sources}${warnings}\n`;
}