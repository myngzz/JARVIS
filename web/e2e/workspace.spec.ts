import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Workspace } from "../src/lib/types";

declare global {
  interface Window {
    __jarvisVoiceTest?: {
      starts: number;
      transcript: ((text: string) => void) | null;
    };
  }
}

async function workspace(request: APIRequestContext): Promise<Workspace> {
  const response = await request.get("/api/workspace");
  expect(response.ok()).toBe(true);
  return response.json();
}

async function navigate(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Buka navigasi", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("button", { name: new RegExp(`^${label}`) }).click();
}

async function researchLocally(page: Page, source: "Dokumen" | "Memori") {
  await navigate(page, "Ruang riset");
  await page.getByRole("checkbox", { name: "Web", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: source, exact: true }).check();
  await page.getByRole("textbox", { name: "Topik atau pertanyaan" }).fill("energi surya");
  await page.getByRole("button", { name: "Mulai riset", exact: true }).click();
  await expect(page.locator(".mode-badge")).toHaveText("Laporan ekstraktif");
  await expect(page.getByRole("button", { name: "Lihat sumber 1", exact: true }).first()).toBeVisible();
}

test.beforeEach(async ({ page, request }) => {
  const response = await request.delete("/api/workspace", { data: { confirmation: "HAPUS SEMUA" } });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await expect(page.locator(".connection-status")).toHaveText("Terhubung");
});

test("renders the workspace, images, source dialogs, and responsive navigation", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.getByRole("heading", { name: "Ruang riset", exact: true })).toBeVisible();
  await expect(page.locator(".mode-badge")).toHaveText("Laporan contoh");
  await expect(page.getByRole("button", { name: "Ajukan ekspor Markdown" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Ekstraktif lokal" })).toBeDisabled();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("workspace.png"), fullPage: true, animations: "disabled", scale: "css" });

  await page.getByRole("tab", { name: /^Sumber/ }).click();
  const image = page.locator(".sources-tab .source-image img").first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  await page.locator(".sources-tab").getByRole("button", { name: /^Periksa sumber/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Detail sumber" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Buka sumber asli" })).toHaveAttribute("href", /^https:\/\//);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  for (const label of ["Dokumen", "Memori", "Persetujuan", "Riwayat", "Ruang riset"]) {
    await navigate(page, label);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  for (const width of [320, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("uploads a document, researches its contents, and executes approved actions only once", async ({ page, request }) => {
  await navigate(page, "Dokumen");
  await page.getByLabel("Unggah dokumen").setInputFiles({
    name: "rencana-energi.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Rencana energi\n\nPanel surya menghasilkan energi listrik dari cahaya matahari. Proyek energi surya ini memakai penyimpanan baterai untuk kebutuhan malam hari. Sumber data harus diperiksa sebelum mengambil keputusan.\n"),
  });
  await expect(page.getByRole("button", { name: /^rencana-energi.md/ })).toBeVisible();
  await page.getByRole("button", { name: /^rencana-energi.md/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Panel surya menghasilkan energi listrik");
  await page.keyboard.press("Escape");

  await researchLocally(page, "Dokumen");
  await expect(page.locator(".findings")).toContainText("Panel surya");
  const researched = await workspace(request);
  expect(researched.reports).toHaveLength(1);
  expect(researched.reports[0].sources[0].kind).toBe("document");

  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await page.getByRole("button", { name: "Ajukan ekspor Markdown" }).click();
  await expect(page.getByRole("heading", { name: "Persetujuan tindakan" })).toBeVisible();
  await expect(page.locator(".approval-status")).toHaveText("Menunggu");
  await page.getByText("Pratinjau data", { exact: true }).click();
  await expect(page.locator(".approval-preview pre")).toContainText("Panel surya");
  expect(downloads).toHaveLength(0);
  expect((await workspace(request)).approvals[0].status).toBe("pending");

  const downloadReady = page.waitForEvent("download");
  await page.getByRole("button", { name: "Setujui & jalankan" }).click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toContain("rencana-energi.md");
  const approved = (await workspace(request)).approvals[0];
  expect(approved.status).toBe("completed");
  const replay = await request.post(`/api/approvals/${approved.id}`, { data: { decision: "approve" } });
  expect(replay.status()).toBe(409);

  await navigate(page, "Ruang riset");
  await page.getByRole("button", { name: "Tindakan laporan lainnya" }).click();
  await page.getByRole("button", { name: "Simpan ke memori", exact: true }).click();
  await expect(page.locator(".approval-status")).toHaveText("Menunggu");
  expect((await workspace(request)).memories).toHaveLength(0);
  await page.getByRole("button", { name: "Tolak", exact: true }).click();
  await expect(page.locator(".approval-card")).toHaveCount(0);
  expect((await workspace(request)).memories).toHaveLength(0);

  await navigate(page, "Ruang riset");
  await page.getByRole("button", { name: "Tindakan laporan lainnya" }).click();
  await page.getByRole("button", { name: "Simpan ke memori", exact: true }).click();
  await page.getByRole("button", { name: "Setujui & jalankan" }).click();
  await expect(page.locator(".approval-card")).toHaveCount(0);
  expect((await workspace(request)).memories).toHaveLength(1);

  await page.reload();
  await expect(page.locator(".connection-status")).toHaveText("Terhubung");
  await navigate(page, "Memori");
  await expect(page.locator(".memory-card")).toHaveCount(1);
  await navigate(page, "Dokumen");
  await page.getByRole("button", { name: "Hapus dokumen rencana-energi.md", exact: true }).click();
  await page.getByRole("button", { name: "Hapus permanen", exact: true }).click();
  await expect(page.locator(".document-row")).toHaveCount(0);
  const deleted = await workspace(request);
  expect(deleted.documents).toHaveLength(0);
  expect(deleted.reports).toHaveLength(0);
  expect(deleted.approvals).toHaveLength(0);
  expect(deleted.memories).toHaveLength(1);
});

test("persists personal memory and removes reports derived from a deleted memory", async ({ page, request }) => {
  await navigate(page, "Memori");
  await page.getByRole("button", { name: "Tambah memori", exact: true }).click();
  await page.getByRole("textbox", { name: "Judul", exact: true }).fill("Preferensi energi");
  await page.getByRole("textbox", { name: "Catatan", exact: true }).fill("Saya memilih energi surya untuk proyek kantor. Selalu sertakan sumber dan biaya operasional saat membandingkan pilihan energi.");
  await page.getByRole("button", { name: "Simpan memori", exact: true }).click();
  await expect(page.locator(".memory-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".connection-status")).toHaveText("Terhubung");
  expect((await workspace(request)).memories[0].title).toBe("Preferensi energi");
  await researchLocally(page, "Memori");
  expect((await workspace(request)).reports[0].sources[0].kind).toBe("memory");
  await navigate(page, "Memori");
  await page.getByRole("button", { name: "Hapus memori Preferensi energi", exact: true }).click();
  await page.getByRole("button", { name: "Hapus permanen", exact: true }).click();
  await expect(page.locator(".memory-card")).toHaveCount(0);
  const deleted = await workspace(request);
  expect(deleted.memories).toHaveLength(0);
  expect(deleted.reports).toHaveLength(0);
});

test("requires voice consent before starting recognition and accepts an Indonesian command", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { starts: 0, transcript: null as ((text: string) => void) | null };
    class TestRecognition {
      onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        state.starts++;
        state.transcript = (text) => {
          this.onresult?.({ results: [[{ transcript: text }]] });
          this.onend?.();
        };
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: TestRecognition, configurable: true });
    Object.defineProperty(window, "__jarvisVoiceTest", { value: state });
  });
  await page.reload();
  await expect(page.locator(".connection-status")).toHaveText("Terhubung");
  await page.getByRole("button", { name: "Mulai input suara", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Izin input suara" })).toBeVisible();
  expect(await page.evaluate(() => window.__jarvisVoiceTest?.starts)).toBe(0);
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("jarvis:voice-consent"))).toBeNull();

  await page.getByRole("button", { name: "Mulai input suara", exact: true }).click();
  await page.getByRole("button", { name: "Setuju & mulai", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hentikan mikrofon", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__jarvisVoiceTest?.starts)).toBe(1);
  await page.evaluate(() => window.__jarvisVoiceTest?.transcript?.("buka dokumen"));
  await expect(page.getByRole("heading", { name: "Pustaka dokumen", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mulai input suara", exact: true })).toBeVisible();
});

test("researches live public web sources", async ({ page, request }) => {
  test.skip(process.env.JARVIS_LIVE_TESTS !== "1", "Set JARVIS_LIVE_TESTS=1 to contact Wikipedia.");
  test.setTimeout(60_000);
  await page.getByRole("textbox", { name: "Topik atau pertanyaan" }).fill("energi terbarukan");
  await page.getByRole("button", { name: "Mulai riset", exact: true }).click();
  await expect(page.locator(".mode-badge")).toHaveText("Laporan ekstraktif", { timeout: 35_000 });
  const report = (await workspace(request)).reports[0];
  expect(report.sources.length).toBeGreaterThan(0);
  expect(report.sources.every((source) => source.kind === "web" && source.url?.startsWith("https://"))).toBe(true);
  expect(report.warnings.join(" ")).toContain("Wikipedia ID/EN");
  await page.getByRole("button", { name: "Lihat sumber 1", exact: true }).first().click();
  await expect(page.getByRole("link", { name: "Buka sumber asli" })).toHaveAttribute("href", /^https:\/\/(id|en)\.wikipedia\.org\//);
});