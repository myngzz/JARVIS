import { z } from "zod";
import { apiError, getStore, readJson } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = z.object({ title: z.string().trim().min(1).max(160), content: z.string().trim().min(1).max(20_000) })
      .parse(await readJson(request));
    return Response.json(getStore().addMemory(input.title, input.content), { status: 201 });
  } catch (error) { return apiError(error); }
}