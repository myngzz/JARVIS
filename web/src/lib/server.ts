import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ZodError } from "zod";
import { WorkspaceStore } from "./store.ts";
import { searchConfiguration } from "./search.ts";
import type { ProviderConfig } from "./types.ts";

const serverState = globalThis as typeof globalThis & { jarvisStore?: WorkspaceStore };

export function getStore(): WorkspaceStore {
  if (!serverState.jarvisStore) {
    const directory = process.env.JARVIS_DATA_DIR || join(process.cwd(), ".data");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    serverState.jarvisStore = new WorkspaceStore(join(directory, "jarvis.sqlite"));
  }
  return serverState.jarvisStore;
}

export function providerConfig(): ProviderConfig {
  const search = searchConfiguration();
  let webhookDestination: string | null = null;
  try {
    const url = new URL(process.env.JARVIS_WEBHOOK_URL || "");
    if (url.protocol === "https:" && !url.username && !url.password) webhookDestination = url.host;
  } catch { webhookDestination = null; }
  return {
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    webProvider: search.name,
    webConfigured: search.configured,
    webhookConfigured: webhookDestination !== null,
    webhookDestination,
    browserConfigured: process.env.JARVIS_BROWSER_ENABLED !== "false",
  };
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function apiError(error: unknown): Response {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message || "Input tidak valid." }, { status: 400 });
  if (error instanceof SyntaxError) return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  console.error("JARVIS request failed:", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "Permintaan gagal diproses. Silakan coba kembali." }, { status: 500 });
}

export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Permintaan kosong.");
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new ApiError("Permintaan terlalu besar.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}