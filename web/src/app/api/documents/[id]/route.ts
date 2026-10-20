import { ApiError, apiError, getStore } from "@/lib/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const text = getStore().documentText(id);
    if (text === null) throw new ApiError("Dokumen tidak ditemukan.", 404);
    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    getStore().deleteDocument(id);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}