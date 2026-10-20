import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const expected = process.env.JARVIS_ACCESS_TOKEN;
  const host = request.headers.get("host") || "";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (!expected && !local) {
    return new NextResponse("Akses jarak jauh memerlukan JARVIS_ACCESS_TOKEN di konfigurasi server.", { status: 403 });
  }
  if (expected) {
    let supplied = "";
    const authorization = request.headers.get("authorization") || "";
    if (authorization.startsWith("Basic ")) {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString();
      supplied = decoded.slice(decoded.indexOf(":") + 1);
    }
    const actualBytes = Buffer.from(supplied);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
      return new NextResponse("Autentikasi diperlukan.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="JARVIS", charset="UTF-8"' } });
    }
  }
  if (request.nextUrl.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const forwardedHost = request.headers.get("x-forwarded-host");
    if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Permintaan lintas situs ditolak." }, { status: 403 });
    if (origin) {
      let originHost = "";
      try { originHost = new URL(origin).host; } catch { return NextResponse.json({ error: "Origin tidak valid." }, { status: 403 }); }
      if (originHost !== host && originHost !== forwardedHost) return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403 });
    }
  }
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  if (request.nextUrl.pathname.startsWith("/api/")) response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };