import assert from "node:assert/strict";
import test from "node:test";
import OpenAI from "openai";
import { analyzeVision, visionInputSchema } from "./vision.ts";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3sAAAAASUVORK5CYII=";
const input = { question: "Apa teks yang terlihat?", image, cloudConsent: true };

test("vision requires consent and actual supported image signatures", () => {
  assert.equal(visionInputSchema.safeParse(input).success, true);
  assert.equal(visionInputSchema.safeParse({ ...input, cloudConsent: false }).success, false);
  assert.equal(visionInputSchema.safeParse({ ...input, image: "https://example.com/photo.jpg" }).success, false);
  assert.equal(visionInputSchema.safeParse({ ...input, image: "data:image/png;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" }).success, false);
});

test("vision submits one image and validates a bounded non-identification response", async () => {
  let calls = 0;
  const result = { summary: "Contoh gambar", observations: ["Satu objek"], extractedText: "", uncertainties: ["Resolusi terbatas"] };
  const client = new OpenAI({ apiKey: "test-placeholder", maxRetries: 0, fetch: async (_url, options) => {
    calls++;
    const body = JSON.parse(String(options?.body));
    assert.match(body.messages[0].content, /Jangan mengidentifikasi orang/);
    assert.equal(body.messages[1].content[1].image_url.url, image);
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  } });
  await assert.rejects(analyzeVision({ ...input, cloudConsent: false }, new AbortController().signal, client));
  assert.equal(calls, 0);
  assert.deepEqual(await analyzeVision(input, new AbortController().signal, client), result);
  assert.equal(calls, 1);
});