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

  // Try to confirm the session, but don't hard-fail: Instagram throttles these
  // endpoints, so we always derive the pk from the sessionid (ds_user_id) and
  // save the credentials regardless. The connections endpoints work even when
  // the profile lookup is throttled.
  const me = await whoAmI({ sessionid, csrftoken, mid });
  let pk = "";
  try {
    pk = decodeURIComponent(sessionid).split(":")[0];
  } catch {
    pk = "";
  }
  if (me) {
    pk = me.pk || pk;
    if (!username) username = me.username;
  }

  if (!pk) {
    return NextResponse.json({
      success: false,
      error: "Sessionid in un formato non valido. Ricopialo intero dai cookie di instagram.com.",
    });
  }
  if (!username) {
    return NextResponse.json({
      success: false,
      error: "Inserisci anche lo username (non sono riuscito a rilevarlo da Instagram).",
    });
  }

  return NextResponse.json({
    success: true,
    confirmed: !!me,
    username,
    pk,
    sessionid,
    csrftoken,
    mid,
  });
}
