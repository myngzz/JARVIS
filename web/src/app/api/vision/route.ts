import { analyzeVision, visionInputSchema } from "@/lib/vision";
import { ApiError, apiError, providerConfig, readJson } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;

let running = 0;
const starts: number[] = [];

export async function POST(request: Request) {
  try {
    const input = visionInputSchema.parse(await readJson(request, 2_850_000));
    if (!providerConfig().aiConfigured) throw new ApiError("AI cloud belum dikonfigurasi. Isi OPENAI_API_KEY di server.", 503);
    while (starts.length && starts[0] < Date.now() - 60_000) starts.shift();
    if (running || starts.length >= 6) throw new ApiError("Batas analisis kamera tercapai. Coba kembali sebentar lagi.", 429);
    running++;
    starts.push(Date.now());
    try {
      const result = await analyzeVision(input, AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]));
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } finally { running--; }
  } catch (error) { return apiError(error); }
}