import { researchInputSchema } from "@/lib/research-core";
import { runResearch } from "@/lib/research";
import { searchConfiguration } from "@/lib/search";
import { ApiError, apiError, readJson } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

let running = 0;
const starts: number[] = [];

export async function POST(request: Request) {
  try {
    const input = researchInputSchema.parse(await readJson(request));
    if (input.web && !input.documents && !input.memory && !input.urls.length) {
      const search = searchConfiguration();
      if (!search.configured) throw new ApiError(search.error!, 503);
    }
    while (starts.length && starts[0] < Date.now() - 60_000) starts.shift();
    if (running >= 2 || starts.length >= 8) throw new ApiError("Batas riset tercapai. Coba kembali sebentar lagi.", 429);
    running++;
    starts.push(Date.now());
    const encoder = new TextEncoder();
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    request.signal.addEventListener("abort", onAbort, { once: true });
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: string, data: unknown) => {
          if (!abort.signal.aborted) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          const report = await runResearch(input, (event) => emit("progress", event), abort.signal);
          emit("report", report);
        } catch (error) {
          emit("error", { message: error instanceof ApiError ? error.message : "Riset gagal. Periksa koneksi dan coba kembali." });
        } finally {
          running--;
          request.signal.removeEventListener("abort", onAbort);
          if (!abort.signal.aborted) controller.close();
        }
      },
      cancel() { abort.abort(); },
    });
    return new Response(stream, { headers: {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
    } });
  } catch (error) { return apiError(error); }
}