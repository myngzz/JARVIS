import { apiError, getStore } from "@/lib/server";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    getStore().deleteReport(id);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}