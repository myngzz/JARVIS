import { randomUUID } from "node:crypto";
import { z } from "zod";
import { reportMarkdown } from "@/lib/research-core";
import { ApiError, apiError, getStore, providerConfig, readJson } from "@/lib/server";
import type { Approval } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = z.object({ reportId: z.string().uuid(), action: z.enum(["save_memory", "export_markdown", "send_webhook"]) })
      .parse(await readJson(request));
    const store = getStore();
    const report = store.report(input.reportId);
    if (!report) throw new ApiError("Laporan tidak ditemukan.", 404);
    const config = providerConfig();
    if (input.action === "send_webhook" && !config.webhookConfigured) throw new ApiError("Webhook belum dikonfigurasi.");
    const approval: Approval = {
      id: randomUUID(), reportId: report.id, action: input.action, status: "pending",
      title: input.action === "save_memory" ? "Simpan laporan ke memori" : input.action === "export_markdown" ? "Ekspor laporan Markdown" : "Kirim laporan ke webhook",
      destination: input.action === "send_webhook" ? config.webhookDestination! : input.action === "save_memory" ? "Memori lokal" : "Unduhan perangkat ini",
      preview: input.action === "send_webhook" ? JSON.stringify({ type: "jarvis.report", report }, null, 2) : reportMarkdown(report).slice(0, input.action === "save_memory" ? 20_000 : undefined),
      createdAt: new Date().toISOString(), resolvedAt: null, error: null,
    };
    store.createApproval(approval);
    return Response.json(approval, { status: 201 });
  } catch (error) { return apiError(error); }
}