import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Durable avatar cache. Instagram CDN URLs are signed and expire, so once an
// avatar is fetched successfully we store the actual BYTES on disk keyed by
// username. After that the image always loads — it never disappears when the
// original URL expires, survives reloads and even a server restart.

const CACHE_DIR = path.join(os.tmpdir(), "likelens-avatars");

const IG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.instagram.com/",
};

function keyFor(username: string): string {
  return createHash("sha1").update(username.toLowerCase()).digest("hex");
}

async function readCache(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(CACHE_DIR, key + ".jpg"));
  } catch {
    return null;
  }
}

async function writeCache(key: string, buf: Buffer) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(CACHE_DIR, key + ".jpg"), buf);
  } catch {
    /* best effort */
  }
}

function serve(buf: Buffer) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get("u") || "").trim();
  const url = (searchParams.get("url") || "").trim();
  if (!username && !url) return new Response(null, { status: 400 });

  const key = keyFor(username || url);

  // 1) Serve cached bytes if we already have them.
  const cached = await readCache(key);
  if (cached) return serve(cached);

  // 2) Otherwise fetch the provided URL, cache its bytes, serve.
  if (!url) return new Response(null, { status: 404 });
  try {
    const resp = await fetch(url, { headers: IG_HEADERS, cache: "no-store" });
    if (!resp.ok) return new Response(null, { status: resp.status });
    const ct = resp.headers.get("Content-Type") || "image/jpeg";
    if (!ct.startsWith("image/")) return new Response(null, { status: 502 });
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 200) return new Response(null, { status: 502 });
    await writeCache(key, buf);
    return serve(buf);
  } catch {
    return new Response(null, { status: 502 });
  }
}
