import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";
import { z } from "zod";

type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;

export function publicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === "unicast"; }
  catch { return false; }
}

export function publicBrowserUrl(value: string): URL {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) {
    throw new Error("Browser hanya menerima URL HTTP/HTTPS publik pada port standar tanpa kredensial.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|metadata\.google\.internal)$|\.(localhost|local|internal)$/i.test(hostname)) {
    throw new Error("Alamat jaringan lokal tidak diizinkan.");
  }
  if (ipaddr.isValid(hostname) ? !publicAddress(hostname) : !hostname.includes(".")) {
    throw new Error("Alamat bukan tujuan publik.");
  }
  url.hash = "";
  return url;
}

export const browserPlanSchema = z.object({
  urls: z.array(z.string().max(2000).refine((value) => {
    try { publicBrowserUrl(value); return true; } catch { return false; }
  }, "Sumber browser harus berupa URL publik tanpa kredensial.")).min(1).max(3),
}).strict();

export async function publicTarget(value: string, resolve: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true })) {
  const url = publicBrowserUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = ipaddr.isValid(hostname)
    ? [{ address: hostname, family: ipaddr.parse(hostname).kind() === "ipv4" ? 4 : 6 }]
    : await resolve(hostname);
  if (!addresses.length || addresses.some((entry) => !publicAddress(entry.address))) {
    throw new Error("DNS tujuan mengarah ke jaringan yang tidak diizinkan.");
  }
  return { url, address: addresses.find((entry) => entry.family === 4) ?? addresses[0] };
}

export function browserRedirect(current: URL, location: string): URL {
  const next = publicBrowserUrl(new URL(location, current).href);
  if (next.hostname !== current.hostname || (current.protocol === "https:" && next.protocol !== "https:")) {
    throw new Error("Redirect ke host lain atau koneksi kurang aman tidak diizinkan.");
  }
  return next;
}

export async function fetchPublicPage(value: string, signal: AbortSignal) {
  let target = value;
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    const { url, address } = await publicTarget(target);
    const result = await new Promise<{ status: number; location?: string; text: string }>((resolve, reject) => {
      const send = url.protocol === "https:" ? httpsRequest : httpRequest;
      const request = send(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        agent: false,
        family: address.family,
        lookup: (_hostname, options, done) => {
          if (options.all) done(null, [address]);
          else done(null, address.address, address.family);
        },
        headers: {
          "User-Agent": "JarvisWorkspace/1.0 (user-approved read-only research)",
          Accept: "text/html, application/xhtml+xml, text/plain",
          "Accept-Encoding": "identity",
        },
      }, (response) => {
        const status = response.statusCode ?? 500;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.destroy();
          resolve({ status, location: response.headers.location, text: "" });
          return;
        }
        if (status < 200 || status >= 300) {
          response.destroy(); reject(new Error("Halaman tidak dapat diakses tanpa autentikasi.")); return;
        }
        if (!/^(text\/html|application\/xhtml\+xml|text\/plain)\b/i.test(response.headers["content-type"] ?? "")) {
          response.destroy(); reject(new Error("Hanya halaman HTML atau teks yang didukung.")); return;
        }
        if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
          response.destroy(); reject(new Error("Format kompresi halaman tidak didukung.")); return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2_000_000) {
            response.destroy(); reject(new Error("Halaman melebihi batas 2 MB.")); return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ status, text: Buffer.concat(chunks).toString("utf8") }));
        response.on("error", reject);
      });
      request.on("error", reject);
      request.end();
    });
    if (!result.location) return { url: url.href, html: result.text };
    target = browserRedirect(url, result.location).href;
  }
  throw new Error("Terlalu banyak redirect.");
}