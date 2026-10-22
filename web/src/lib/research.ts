import { randomUUID } from "node:crypto";
import { planResearch, reviewResearch, synthesizeResearch } from "./ai.ts";
import { deduplicateSources, extractiveBrief } from "./research-core.ts";
import { searchConfiguration, searchWeb, WebSearchError } from "./search.ts";
import { ApiError, getStore, providerConfig } from "./server.ts";
import type { ResearchInput, ResearchPlan, ResearchProgress, ResearchReport, Source } from "./types.ts";

export async function runResearch(input: ResearchInput, progress: (event: ResearchProgress) => void, signal: AbortSignal): Promise<ResearchReport> {
  const started = Date.now();
  signal = AbortSignal.any([signal, AbortSignal.timeout(150_000)]);
  const config = providerConfig();
  if (input.useAi && !config.aiConfigured) throw new ApiError("AI cloud belum dikonfigurasi. Gunakan mode ekstraktif.");
  if (input.useAi && !input.cloudConsent) throw new ApiError("Persetujuan pengiriman pertanyaan dan petikan sumber ke AI cloud diperlukan.");
  if (input.web && !config.webConfigured && !input.documents && !input.memory) {
    throw new ApiError(searchConfiguration().error!, 503);
  }
  const limit = input.depth === "deep" ? 10 : 5;
  const warnings: string[] = [];
  let plan: ResearchPlan | undefined;
  if (input.useAi && input.depth === "deep") {
    progress({ stage: "plan", message: "Menyusun rencana dan sudut pandang pembanding" });
    try { plan = await planResearch(input.query, signal); }
    catch {
      signal.throwIfAborted();
      warnings.push("Perencanaan AI gagal. Pencarian tetap memakai pertanyaan asli.");
    }
  }
  const queries = plan?.queries ?? [input.query];
  progress({ stage: "search", message: "Menelusuri sumber yang dipilih" });
  const localSources = deduplicateSources(queries.flatMap((query) => getStore().search(query, { documents: input.documents, memory: input.memory, limit })));
  let webSources: Source[] = [];
  const searchErrors: WebSearchError[] = [];
  if (input.web) {
    const searches = await Promise.allSettled(queries.map((query) => searchWeb(query, limit, signal)));
    for (const search of searches) {
      if (search.status === "fulfilled") {
        webSources.push(...search.value.sources);
        warnings.push(...search.value.warnings);
      } else {
        const error = search.reason instanceof WebSearchError ? search.reason
          : new WebSearchError(`Layanan pencarian ${config.webProvider} tidak dapat dihubungi atau melewati batas waktu.`);
        searchErrors.push(error);
        warnings.push(`${error.message} Laporan hanya menggunakan sumber yang berhasil diambil.`);
      }
    }
    webSources = deduplicateSources(webSources);
  }
  signal.throwIfAborted();
  const sources = deduplicateSources([...localSources.slice(0, webSources.length ? 8 : 16), ...webSources]).slice(0, 16);
  if (!sources.length && searchErrors.length) throw new ApiError(searchErrors[0].message, searchErrors[0].status);
  if (!sources.length) throw new ApiError("Tidak ada sumber yang cocok. Coba kata kunci lebih spesifik atau tambahkan dokumen.", 404);
  if ((input.documents || input.memory) && !localSources.length) warnings.push("Tidak ada dokumen atau memori lokal yang cocok dengan kata kunci.");
  progress({ stage: "sources", message: `${sources.length} sumber ditemukan`, count: sources.length });
  progress({ stage: "compose", message: input.useAi ? "Menyusun analisis AI bersumber" : "Menyusun petikan sumber" });
  let brief: Pick<ResearchReport, "title" | "summary" | "findings"> = extractiveBrief(input.query, sources);
  let mode: ResearchReport["mode"] = "extractive";
  let review: ResearchReport["review"];
  if (input.useAi) {
    try {
      const draft = await synthesizeResearch(input.query, sources, signal);
      if (input.depth === "deep") {
        progress({ stage: "review", message: "Meninjau temuan terhadap petikan sumber" });
        const checked = await reviewResearch(input.query, draft, sources, signal);
        brief = checked.brief;
        review = { removedFindings: checked.removedFindings };
        warnings.push(...checked.caveats, "Peninjauan dilakukan model AI yang sama terhadap petikan, bukan verifikasi independen.");
      } else { brief = draft; }
      mode = "cloud";
      warnings.push("Sitasi AI merujuk sumber yang tersedia, tetapi kebenaran klaim tetap harus diperiksa pada sumber aslinya.");
    } catch {
      signal.throwIfAborted();
      warnings.push("Sintesis AI gagal atau sitasinya tidak valid. Laporan dialihkan ke petikan ekstraktif; pemakaian API mungkin tetap dikenakan biaya.");
    }
  }
  const report: ResearchReport = {
    id: randomUUID(), query: input.query, ...brief, sources, mode,
    provider: mode === "cloud" ? config.model : "Ekstraktif lokal",
    warnings: [...new Set(warnings)], createdAt: new Date().toISOString(), durationMs: Date.now() - started,
    plan, review,
    searchProvider: webSources.length ? config.webProvider : undefined,
  };
  signal.throwIfAborted();
  progress({ stage: "save", message: "Menyimpan laporan di workspace lokal" });
  getStore().saveReport(report);
  return report;
}