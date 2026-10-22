import { z } from "zod";
import { browserPlanSchema } from "@/lib/browser-security";
import { ApiError, apiError, getStore, providerConfig, readJson } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 90;

let browserRunning = false;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { decision } = z.object({ decision: z.enum(["approve", "reject"]) }).parse(await readJson(request));
    const store = getStore();
    const approval = store.approval(id);
    if (!approval) throw new ApiError("Tindakan tidak ditemukan.", 404);
    if (decision === "reject") {
      if (!store.rejectApproval(id)) throw new ApiError("Tindakan ini sudah diproses.", 409);
      return Response.json({ approval: store.approval(id) });
    }
    const report = store.report(approval.reportId);
    if (!report) throw new ApiError("Laporan sumber sudah dihapus.", 404);
    if (approval.action === "browser_read" && browserRunning) throw new ApiError("Browser masih menjalankan tindakan lain.", 429);
    if (!store.claimApproval(id)) throw new ApiError("Tindakan ini sudah diproses.", 409);
    try {
      let download: { filename: string; content: string } | undefined;
      let message = "Tindakan selesai.";
      if (approval.action === "save_memory") {
        store.addMemory(report.title.slice(0, 160), approval.preview);
      } else if (approval.action === "export_markdown") {
        download = { filename: `jarvis-${report.id.slice(0, 8)}.md`, content: approval.preview };
      } else if (approval.action === "archive_report") {
        if (store.documents().length >= 100) throw new Error("Document limit reached");
        store.addDocument(`arsip-${report.id.slice(0, 8)}.md`, approval.preview, Buffer.byteLength(approval.preview));
        message = "Laporan diarsipkan ke pustaka dokumen.";
      } else if (approval.action === "browser_read") {
        if (!providerConfig().browserConfigured) throw new Error("Browser disabled");
        const plan = browserPlanSchema.parse(JSON.parse(approval.preview));
        if (store.documents().length + plan.urls.length > 100) throw new Error("Document limit reached");
        browserRunning = true;
        try {
          const { inspectSources } = await import("@/lib/browser");
          const result = await inspectSources(plan.urls, AbortSignal.any([request.signal, AbortSignal.timeout(70_000)]));
          if (!result.results.length) throw new Error("No accessible public sources");
          if (store.approval(id)?.status !== "running") throw new Error("Approval removed during execution");
          if (store.documents().length + result.results.length > 100) throw new Error("Document limit reached");
          for (const [index, source] of result.results.entries()) {
            const text = `${source.title}\nSumber: ${source.url}\nDiakses: ${new Date().toISOString()}\n\n${source.text}`;
            store.addDocument(`web-${approval.id.slice(0, 8)}-${index + 1}.txt`, text, Buffer.byteLength(text));
          }
          message = `${result.results.length} halaman disimpan ke dokumen${result.failures.length ? `; ${result.failures.length} halaman tidak dapat diakses` : ""}.`;
          store.addActivity(message, "approval");
        } finally { browserRunning = false; }
      } else if (approval.action === "send_webhook") {
        const config = providerConfig();
        if (!config.webhookConfigured || config.webhookDestination !== approval.destination) throw new Error("Destination changed");
        const response = await fetch(process.env.JARVIS_WEBHOOK_URL!, {
          method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": approval.id },
          body: approval.preview, redirect: "error", signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) throw new Error("Webhook rejected request");
      } else { throw new Error("Unknown action"); }
      store.finishApproval(id);
      return Response.json({ approval: store.approval(id), download, message });
    } catch {
      store.finishApproval(id, approval.action === "send_webhook"
        ? "Pengiriman gagal atau tidak terkonfirmasi. Periksa tujuan sebelum membuat permintaan baru."
        : "Eksekusi gagal. Untuk browser, periksa instalasi Chromium, koneksi, URL publik, dan kapasitas dokumen. Tidak diulang otomatis.");
      throw new ApiError("Tindakan gagal dan tidak diulang otomatis. Periksa detail pada antrean.", 502);
    }
  } catch (error) { return apiError(error); }
}