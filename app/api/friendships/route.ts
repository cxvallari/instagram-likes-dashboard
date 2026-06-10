import { NextRequest, NextResponse } from "next/server";
import { checkFriendships } from "@/lib/instagram";
import { activeCreds } from "@/lib/creds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Batch friendship status (followed_by / following / outgoing_request) for up to
// thousands of user ids. Used to compute who follows you back.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userIds = (body.user_ids ?? []).map((x: any) => String(x)).filter(Boolean);
  if (!userIds.length)
    return NextResponse.json({ success: false, error: "Nessun user_id fornito" });

  const creds = activeCreds(req);
  if (!creds.sessionid)
    return NextResponse.json({ success: false, error: "Non sei loggato" });

  try {
    const statuses = await checkFriendships(userIds, creds);
    return NextResponse.json({ success: true, statuses });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message ?? e) });
  }
}
