import { basename } from "node:path";
import { extractText } from "unpdf";
import { ApiError, apiError, getStore } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 7 * 1024 * 1024) throw new ApiError("Ukuran dokumen maksimal 6 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("Pilih dokumen terlebih dahulu.");
    if (file.size > 6 * 1024 * 1024) throw new ApiError("Ukuran dokumen maksimal 6 MB.", 413);
    if (!file.size) throw new ApiError("Dokumen kosong.");
    if (getStore().documents().length >= 100) throw new ApiError("Batas 100 dokumen tercapai. Hapus dokumen yang tidak diperlukan.");
    const name = basename(file.name).slice(0, 160);
    const extension = name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "md", "markdown"].includes(extension ?? "")) throw new ApiError("Format yang didukung: PDF, TXT, dan Markdown.");
    const data = new Uint8Array(await file.arrayBuffer());
    let text: string;
    if (extension === "pdf") {
      try {
        const result = await extractText(data, { mergePages: true });
        if (result.totalPages > 200) throw new ApiError("PDF maksimal 200 halaman.");
        text = result.text;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError("PDF tidak dapat dibaca. Gunakan PDF tanpa kata sandi dengan lapisan teks.");
      }
    } else {
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(data); }
      catch { throw new ApiError("Dokumen teks harus menggunakan encoding UTF-8."); }
    }
    if (text.trim().length < 20) throw new ApiError("Teks terlalu sedikit. PDF hasil scan memerlukan OCR terlebih dahulu.");
    if (text.length > 500_000) throw new ApiError("Teks dokumen maksimal 500.000 karakter.");
    return Response.json(getStore().addDocument(name, text, file.size), { status: 201 });
  } catch (error) { return apiError(error); }
}