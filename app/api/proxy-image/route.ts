import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Instagram CDN images 403 when hot-linked from another origin; proxy them.
export async function GET(req: NextRequest) {
  const url = (new URL(req.url).searchParams.get("url") ?? "").trim();
  if (!url) return new Response(null, { status: 400 });
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://www.instagram.com/",
      },
      cache: "no-store",
    });
    if (!resp.ok) return new Response(null, { status: resp.status });
    const ct = resp.headers.get("Content-Type") ?? "image/jpeg";
    if (!ct.startsWith("image/")) return new Response(null, { status: 502 });
    const buf = await resp.arrayBuffer();
    return new Response(buf, {
      headers: { "Content-Type": ct, "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
