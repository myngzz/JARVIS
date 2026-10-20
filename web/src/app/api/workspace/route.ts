import { z } from "zod";
import { apiError, getStore, providerConfig, readJson } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = getStore();
    return Response.json({
      reports: store.reports(), documents: store.documents(), memories: store.memories(),
      approvals: store.approvals(), activities: store.activities(), config: providerConfig(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    z.object({ confirmation: z.literal("HAPUS SEMUA") }).parse(await readJson(request));
    getStore().clearAll();
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}