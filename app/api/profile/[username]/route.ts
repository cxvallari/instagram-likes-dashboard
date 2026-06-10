import { NextRequest, NextResponse } from "next/server";
import { profileInfo } from "@/lib/instagram";
import { mainCreds } from "@/lib/creds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const creds = mainCreds(req);
  if (!creds.sessionid)
    return NextResponse.json({ success: false, error: "Non sei loggato" }, { status: 401 });
  try {
    const p = await profileInfo(username, creds);
    return NextResponse.json({ success: true, profile: p });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message ?? e) });
  }
}
