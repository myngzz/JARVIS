import { z } from "zod";
import { ApiError, apiError, getStore, providerConfig, readJson } from "@/lib/server";

export const runtime = "nodejs";

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
    if (!store.claimApproval(id)) throw new ApiError("Tindakan ini sudah diproses.", 409);
    try {
      let download: { filename: string; content: string } | undefined;
      if (approval.action === "save_memory") {
        store.addMemory(report.title.slice(0, 160), approval.preview);
      } else if (approval.action === "export_markdown") {
        download = { filename: `jarvis-${report.id.slice(0, 8)}.md`, content: approval.preview };
      } else {
        const config = providerConfig();
        if (!config.webhookConfigured || config.webhookDestination !== approval.destination) throw new Error("Destination changed");
        const response = await fetch(process.env.JARVIS_WEBHOOK_URL!, {
          method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": approval.id },
          body: approval.preview, redirect: "error", signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) throw new Error("Webhook rejected request");
      }
      store.finishApproval(id);
      return Response.json({ approval: store.approval(id), download });
    } catch {
      store.finishApproval(id, "Eksekusi gagal. Pengiriman eksternal mungkin sudah diterima; periksa tujuan sebelum membuat permintaan baru.");
      throw new ApiError("Tindakan gagal dan tidak diulang otomatis. Periksa detail pada antrean.", 502);
    }
  } catch (error) { return apiError(error); }
}