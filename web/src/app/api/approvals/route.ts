import { randomUUID } from "node:crypto";
import { z } from "zod";
import { reportMarkdown } from "@/lib/research-core";
import { browserPlanSchema } from "@/lib/browser-security";
import { ApiError, apiError, getStore, providerConfig, readJson } from "@/lib/server";
import type { Approval } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = z.object({ reportId: z.string().uuid(), action: z.enum(["save_memory", "export_markdown", "send_webhook", "browser_read", "archive_report"]) })
      .parse(await readJson(request));
    const store = getStore();
    const report = store.report(input.reportId);
    if (!report) throw new ApiError("Laporan tidak ditemukan.", 404);
    const config = providerConfig();
    if (input.action === "send_webhook" && !config.webhookConfigured) throw new ApiError("Webhook belum dikonfigurasi.");
    if (input.action === "browser_read" && !config.browserConfigured) throw new ApiError("Browser dinonaktifkan oleh konfigurasi server.");
    const browserPlan = input.action === "browser_read" ? browserPlanSchema.parse({
      urls: [...new Set(report.sources.filter((source) => source.kind === "web" && source.url).map((source) => source.url!))].slice(0, 3),
    }) : null;
    const descriptions = {
      save_memory: ["Simpan laporan ke memori", "Memori lokal"],
      export_markdown: ["Ekspor laporan Markdown", "Unduhan perangkat ini"],
      send_webhook: ["Kirim laporan ke webhook", config.webhookDestination ?? ""],
      browser_read: ["Baca sumber dengan browser", "Browser tanpa login / hasil ke dokumen workspace"],
      archive_report: ["Arsipkan laporan sebagai dokumen", "Pustaka dokumen workspace"],
    };
    const approval: Approval = {
      id: randomUUID(), reportId: report.id, action: input.action, status: "pending",
      title: descriptions[input.action][0], destination: descriptions[input.action][1],
      preview: browserPlan ? JSON.stringify(browserPlan, null, 2) : input.action === "send_webhook" ? JSON.stringify({ type: "jarvis.report", report }, null, 2) : reportMarkdown(report).slice(0, input.action === "save_memory" ? 20_000 : undefined),
      createdAt: new Date().toISOString(), resolvedAt: null, error: null,
    };
    store.createApproval(approval);
    return Response.json(approval, { status: 201 });
  } catch (error) { return apiError(error); }
}