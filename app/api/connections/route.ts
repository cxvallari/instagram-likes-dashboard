import { NextRequest, NextResponse } from "next/server";
import { connectionsPage } from "@/lib/instagram";
import { mainCreds } from "@/lib/creds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One page of followers/following per call. Client loops on next_max_id so the
// UI can render progressively and stay within serverless time limits.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("user_id") ?? "").trim();
  const type = (searchParams.get("type") ?? "followers").trim();
  const maxId = searchParams.get("max_id") ?? "";
  const count = Math.min(Number(searchParams.get("count") ?? 200), 200);

  if (!userId)
    return NextResponse.json({ error: "user_id mancante" }, { status: 400 });
  if (type !== "followers" && type !== "following")
    return NextResponse.json({ error: "type non valido" }, { status: 400 });

  const creds = mainCreds(req);
  if (!creds.sessionid)
    return NextResponse.json({ error: "Non sei loggato" }, { status: 401 });

  try {
    const page = await connectionsPage(userId, type, creds, maxId, count);
    return NextResponse.json({ success: true, ...page });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
