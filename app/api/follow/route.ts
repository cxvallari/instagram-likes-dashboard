import { NextRequest, NextResponse } from "next/server";
import { followUser, unfollowUser } from "@/lib/instagram";
import { activeCreds } from "@/lib/creds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single follow or unfollow. action: "follow" | "unfollow".
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body.user_id ?? "").trim();
  const action = String(body.action ?? "unfollow").trim();
  if (!userId)
    return NextResponse.json({ success: false, error: "user_id mancante" });

  const creds = activeCreds(req);
  if (!creds.sessionid)
    return NextResponse.json({ success: false, error: "Account azione non configurato" });

  try {
    if (action === "follow") {
      const r = await followUser(userId, creds);
      return NextResponse.json({ success: r.ok, ...r });
    }
    const r = await unfollowUser(userId, creds);
    return NextResponse.json({ success: r.ok, ...r });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message ?? e) });
  }
}
