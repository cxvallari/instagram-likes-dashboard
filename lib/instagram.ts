// Core Instagram private-API client. Ported from the legacy Flask app.
// All calls are server-side (Next.js route handlers) so IG cookies never hit the browser network tab directly.

export interface IgCreds {
  sessionid: string;
  csrftoken?: string;
  mid?: string;
  username?: string;
}

export interface IgUser {
  pk: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
}

export interface IgProfile extends IgUser {
  biography: string;
  follower_count: number;
  following_count: number;
  media_count: number;
}

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function shortcodeToPk(shortcode: string): string {
  let pk = 0n;
  for (const ch of shortcode) {
    pk = pk * 64n + BigInt(ALPHABET.indexOf(ch));
  }
  return pk.toString();
}

export function extractShortcode(url: string): string {
  const m = url.match(/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("URL non valido — usa un link a un post Instagram");
  return m[1];
}

function dsUserId(sessionid: string): string {
  try {
    return decodeURIComponent(sessionid).split(":")[0];
  } catch {
    return "";
  }
}

function igCookieHeader(c: IgCreds): string {
  const parts: string[] = [];
  if (c.sessionid) {
    parts.push(`sessionid=${c.sessionid}`);
    const ds = dsUserId(c.sessionid);
    if (ds) parts.push(`ds_user_id=${ds}`);
  }
  if (c.csrftoken) parts.push(`csrftoken=${c.csrftoken}`);
  if (c.mid) parts.push(`mid=${c.mid}`);
  return parts.join("; ");
}

function igHeaders(c: IgCreds, extra: Record<string, string> = {}): HeadersInit {
  const h: Record<string, string> = {
    "User-Agent":
      "Instagram 278.0.0.19.115 Android (26/8.0.0; 480dpi; 1080x1920; OnePlus; ONEPLUS A3010; OnePlus3T; qcom; en_US; 314665256)",
    "X-IG-App-ID": "936619743392459",
    Accept: "*/*",
    "Accept-Language": "it-IT,it;q=0.9",
    Origin: "https://www.instagram.com",
    Referer: "https://www.instagram.com/",
    "X-IG-Capabilities": "3brTvwE=",
    "X-IG-Connection-Type": "WIFI",
    Cookie: igCookieHeader(c),
    ...extra,
  };
  if (c.csrftoken) h["X-CSRFToken"] = c.csrftoken;
  return h;
}

async function igGet(
  path: string,
  creds: IgCreds,
  params: Record<string, string | number> = {},
  timeoutMs = 12000
): Promise<any> {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  ).toString();
  const url = `https://i.instagram.com/api/v1/${path}${qs ? `?${qs}` : ""}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: igHeaders(creds),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`${resp.status} — ${text.slice(0, 200)}`);
    if (!text.trim())
      throw new Error(`Risposta vuota (status ${resp.status}) — riprova il login`);
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Risposta non JSON (HTTP ${resp.status}) — riprova`);
    }
    if (data.status === "fail")
      throw new Error(data.message || "API Instagram: status fail");
    return data;
  } finally {
    clearTimeout(t);
  }
}

async function igPost(
  path: string,
  creds: IgCreds,
  body: string,
  timeoutMs = 12000
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`https://i.instagram.com/api/v1/${path}`, {
      method: "POST",
      headers: igHeaders(creds, {
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body,
      signal: ctrl.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

function mapUser(u: any): IgUser {
  return {
    pk: String(u.pk ?? u.pk_id ?? u.id ?? ""),
    username: u.username ?? "",
    full_name: u.full_name ?? "",
    profile_pic_url: u.profile_pic_url ?? "",
    is_private: Boolean(u.is_private),
    is_verified: Boolean(u.is_verified),
  };
}

// ── Profile (3-tier lookup: mobile API → web API → user search) ────────────────

export async function profileInfo(
  username: string,
  creds: IgCreds
): Promise<IgProfile> {
  const referer = `https://www.instagram.com/${username}/`;

  // Tier 1: mobile API
  try {
    const resp = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      { headers: igHeaders(creds, { Referer: referer }), cache: "no-store" }
    );
    if (resp.ok) {
      const text = await resp.text();
      if (text.trim()) {
        const data = JSON.parse(text);
        const user = data?.data?.user ?? data?.user;
        if (user) return mapProfile(user);
      }
    }
  } catch {
    /* fall through */
  }

  // Tier 2: web API (Chrome UA)
  try {
    const resp = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "X-IG-App-ID": "936619743392459",
          Accept: "*/*",
          "Accept-Language": "it-IT,it;q=0.9",
          Referer: referer,
          Origin: "https://www.instagram.com",
          Cookie: igCookieHeader(creds),
        },
        cache: "no-store",
      }
    );
    if (resp.ok) {
      const text = await resp.text();
      if (text.trim()) {
        const data = JSON.parse(text);
        if (data.status !== "fail") {
          const user = data?.data?.user ?? data?.user;
          if (user) return mapProfile(user);
        }
      }
    }
  } catch {
    /* fall through */
  }

  // Tier 3: user search
  try {
    const sr = await igGet(
      `users/search/`,
      creds,
      { q: username, count: 10, search_surface: "user_search_page" }
    );
    for (const u of sr.users ?? []) {
      if ((u.username ?? "").toLowerCase() === username.toLowerCase()) {
        return {
          pk: String(u.pk ?? u.pk_id ?? ""),
          username: u.username ?? "",
          full_name: u.full_name ?? "",
          biography: u.biography ?? "",
          is_private: Boolean(u.is_private),
          is_verified: Boolean(u.is_verified),
          profile_pic_url: u.profile_pic_url ?? "",
          follower_count: u.follower_count ?? 0,
          following_count: u.following_count ?? 0,
          media_count: u.media_count ?? 0,
        };
      }
    }
  } catch {
    /* fall through */
  }

  throw new Error(`Profilo @${username} non trovato su Instagram`);
}

function mapProfile(user: any): IgProfile {
  return {
    pk: String(user.id ?? user.pk ?? ""),
    username: user.username ?? "",
    full_name: user.full_name ?? "",
    biography: user.biography ?? "",
    is_private: Boolean(user.is_private),
    is_verified: Boolean(user.is_verified),
    profile_pic_url: user.profile_pic_url_hd ?? user.profile_pic_url ?? "",
    follower_count:
      user.edge_followed_by?.count ?? user.follower_count ?? 0,
    following_count: user.edge_follow?.count ?? user.following_count ?? 0,
    media_count: user.edge_owner_to_timeline_media?.count ?? user.media_count ?? 0,
  };
}

// ── Connections (followers / following), one page per call ─────────────────────

export interface ConnectionsPage {
  users: IgUser[];
  next_max_id: string;
}

export async function connectionsPage(
  userId: string,
  type: "followers" | "following",
  creds: IgCreds,
  maxId = "",
  count = 200
): Promise<ConnectionsPage> {
  const endpoint = type === "followers" ? "followers" : "following";
  const params: Record<string, string | number> = {
    count,
    search_surface: "follow_list_page",
  };
  if (maxId) params.max_id = maxId;
  const result = await igGet(
    `friendships/${userId}/${endpoint}/`,
    creds,
    params
  );
  const users = (result.users ?? []).map(mapUser);
  const rawNext = result.next_max_id;
  return { users, next_max_id: rawNext ? String(rawNext) : "" };
}

// ── Likers of a post ───────────────────────────────────────────────────────────

export interface LikersPage {
  users: IgUser[];
  next_min_id: string;
  user_count: number;
}

export async function likersPage(
  mediaPk: string,
  creds: IgCreds,
  minId = ""
): Promise<LikersPage> {
  const params: Record<string, string | number> = { count: 100 };
  if (minId) params.min_id = minId;
  const result = await igGet(`media/${mediaPk}/likers/`, creds, params);
  return {
    users: (result.users ?? []).map(mapUser),
    next_min_id: result.next_min_id ? String(result.next_min_id) : "",
    user_count: result.user_count ?? 0,
  };
}

// ── Follow / unfollow ──────────────────────────────────────────────────────────

export async function followUser(
  userId: string,
  creds: IgCreds
): Promise<{ ok: boolean; following?: boolean; pending?: boolean; error?: string }> {
  const resp = await igPost(
    `friendships/create/${userId}/`,
    creds,
    `user_id=${userId}`
  );
  if (!resp.ok) return { ok: false, error: `Instagram: ${resp.status}` };
  let rj: any = {};
  try {
    rj = await resp.json();
  } catch {
    /* ignore */
  }
  if (rj.status && rj.status !== "ok")
    return { ok: false, error: rj.message || `status=${rj.status}` };
  const fs = rj.friendship_status ?? {};
  return {
    ok: true,
    following: fs.following ?? true,
    pending: fs.outgoing_request ?? false,
  };
}

export async function unfollowUser(
  userId: string,
  creds: IgCreds
): Promise<{ ok: boolean; error?: string }> {
  const resp = await igPost(
    `friendships/destroy/${userId}/`,
    creds,
    `user_id=${userId}`
  );
  if (!resp.ok) return { ok: false, error: `Instagram: ${resp.status}` };
  return { ok: true };
}

// ── Friendship batch check ─────────────────────────────────────────────────────

export async function checkFriendships(
  userIds: string[],
  creds: IgCreds
): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    try {
      const resp = await igPost(
        `friendships/show_many/`,
        creds,
        "user_ids=" + batch.map(encodeURIComponent).join("%2C")
      );
      if (resp.ok) {
        const rj = await resp.json();
        Object.assign(results, rj.friendship_statuses ?? {});
      }
    } catch {
      /* skip batch */
    }
  }
  return results;
}

// ── Validate a sessionid ───────────────────────────────────────────────────────
// Instagram serves degraded/empty responses to datacenter IPs, so we can't rely
// on any single rich endpoint. We confirm the cookie is logged-in via several
// cheap signals and derive the pk from the sessionid itself (ds_user_id).

export async function whoAmI(
  creds: IgCreds
): Promise<{ pk: string; username: string } | null> {
  const pk = dsUserId(creds.sessionid);

  // Signal 1: own user info endpoint — returns status ok when the cookie works,
  // even if the user object is throttled to empty.
  if (pk) {
    try {
      const data = await igGet(`users/${pk}/info/`, creds);
      if (data?.status === "ok") {
        const u = data.user ?? {};
        return { pk, username: u.username ?? "" };
      }
    } catch {
      /* fall through */
    }
  }

  // Signal 2: the web app marks the html as "logged-in" for a valid session.
  try {
    const resp = await fetch("https://www.instagram.com/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Cookie: igCookieHeader(creds),
      },
      cache: "no-store",
    });
    const text = await resp.text();
    if (/class="[^"]*logged-in/.test(text) || (pk && text.includes(`"${pk}"`))) {
      const m = /"username":"([^"]+)"/.exec(text);
      return { pk, username: m?.[1] ?? "" };
    }
  } catch {
    /* fall through */
  }

  return null;
}
