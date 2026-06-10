import { NextRequest, NextResponse } from "next/server";
import { likersPage, shortcodeToPk, extractShortcode } from "@/lib/instagram";
import { mainCreds } from "@/lib/creds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postUrl = (searchParams.get("post_url") ?? "").trim();
  const minId = searchParams.get("min_id") ?? "";
  if (!postUrl)
    return NextResponse.json({ error: "post_url mancante" }, { status: 400 });

  const creds = mainCreds(req);
  if (!creds.sessionid)
    return NextResponse.json({ error: "Non sei loggato" }, { status: 401 });

  let mediaPk: string;
  try {
    mediaPk = shortcodeToPk(extractShortcode(postUrl));
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }

  try {
    const page = await likersPage(mediaPk, creds, minId);
    return NextResponse.json({ success: true, ...page });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
