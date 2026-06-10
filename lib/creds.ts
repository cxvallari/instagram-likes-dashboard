import { NextRequest } from "next/server";
import type { IgCreds } from "./instagram";

// Credentials arrive as request headers, set client-side from localStorage.
// The "main" session is read-only browsing; the "action" session performs
// follow/unfollow so the user can act from a burner account if they prefer.

export function mainCreds(req: NextRequest): IgCreds {
  return {
    sessionid: req.headers.get("x-ig-session-id") ?? "",
    csrftoken: req.headers.get("x-ig-csrf-token") ?? "",
    mid: req.headers.get("x-ig-mid") ?? "",
    username: req.headers.get("x-ig-username") ?? "",
  };
}

export function actionCreds(req: NextRequest): IgCreds {
  return {
    sessionid: req.headers.get("x-act-session-id") ?? "",
    csrftoken: req.headers.get("x-act-csrf-token") ?? "",
    mid: req.headers.get("x-act-mid") ?? "",
    username: req.headers.get("x-act-username") ?? "",
  };
}

// Action session if present, otherwise fall back to the main session.
export function activeCreds(req: NextRequest): IgCreds {
  const act = actionCreds(req);
  if (act.sessionid) return act;
  return mainCreds(req);
}
