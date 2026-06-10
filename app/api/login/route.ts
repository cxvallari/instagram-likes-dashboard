import { NextRequest, NextResponse } from "next/server";
import { whoAmI } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validate a sessionid + resolve csrftoken/mid from Instagram's set-cookie.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionid = String(body.sessionid ?? "").trim();
  let username = String(body.username ?? "").trim().replace(/^@/, "");
  if (!sessionid)
    return NextResponse.json({ success: false, error: "Inserisci il sessionid." });

  let csrftoken = "";
  let mid = "";
  try {
    const r = await fetch("https://www.instagram.com/", {
      headers: { Cookie: `sessionid=${sessionid}` },
      cache: "no-store",
    });
    const setCookie = r.headers.get("set-cookie") ?? "";
    csrftoken = /csrftoken=([^;]+)/.exec(setCookie)?.[1] ?? "";
    mid = /mid=([^;]+)/.exec(setCookie)?.[1] ?? "";
  } catch {
    /* ignore */
  }

  // Confirm the session actually works and auto-fill the username if missing.
  const me = await whoAmI({ sessionid, csrftoken, mid });
  if (!me)
    return NextResponse.json({
      success: false,
      error: "Sessionid non valido o scaduto. Riprendilo dai cookie di instagram.com.",
    });
  if (!username) username = me.username;

  return NextResponse.json({
    success: true,
    username,
    pk: me.pk,
    sessionid,
    csrftoken,
    mid,
  });
}
