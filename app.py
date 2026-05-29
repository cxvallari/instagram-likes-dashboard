import json
import os
import re
import secrets
import time
import requests
from flask import Flask, render_template, request, jsonify, Response, stream_with_context

app = Flask(__name__)

SESSION_FILE        = os.path.join(os.path.dirname(__file__), "session.json")
ACTION_SESSION_FILE = os.path.join(os.path.dirname(__file__), "action_session.json")
CONFIG_FILE         = os.path.join(os.path.dirname(__file__), "config.json")

_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

def shortcode_to_pk(shortcode: str) -> str:
    pk = 0
    for ch in shortcode:
        pk = pk * 64 + _ALPHABET.index(ch)
    return str(pk)

def extract_shortcode(url: str) -> str:
    m = re.search(r'instagram\.com/(?:p|reel|tv|reels)/([A-Za-z0-9_-]+)', url)
    if not m:
        raise ValueError("URL non valido — usa un link a un post Instagram")
    return m.group(1)

# ── File I/O (local dev only — silently ignored on read-only FS) ─────────────

def _read_json(path: str) -> dict:
    try:
        with open(path) as f:
            return json.load(f) or {}
    except Exception:
        return {}

def _write_json(path: str, data: dict):
    try:
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

# ── Credential resolution ────────────────────────────────────────────────────
# Priority: request headers (set by JS from localStorage) > query params (SSE)
# > local files (local dev fallback)

def get_main_session():
    """Returns (sessionid, csrftoken, mid, username)."""
    sid   = (request.headers.get("X-IG-Session-ID", "")  or request.args.get("_sid",   ""))
    csrf  = (request.headers.get("X-IG-CSRF-Token", "")  or request.args.get("_csrf",  ""))
    mid   = (request.headers.get("X-IG-MID", "")         or request.args.get("_mid",   ""))
    uname = (request.headers.get("X-IG-Username", "")    or request.args.get("_uname", ""))
    if not sid:
        sess   = _read_json(SESSION_FILE)
        cookies = sess.get("cookies") or {}
        sid, csrf, mid, uname = (
            cookies.get("sessionid", ""), cookies.get("csrftoken", ""),
            cookies.get("mid", ""), sess.get("username", ""),
        )
    return sid, csrf, mid, uname

def get_action_session():
    """Returns (sessionid, csrftoken, mid, username)."""
    sid   = request.headers.get("X-Act-Session-ID", "")
    csrf  = request.headers.get("X-Act-CSRF-Token", "")
    mid   = request.headers.get("X-Act-MID",        "")
    uname = request.headers.get("X-Act-Username",   "")
    if not sid:
        sess   = _read_json(ACTION_SESSION_FILE)
        cookies = sess.get("cookies") or {}
        sid, csrf, mid, uname = (
            cookies.get("sessionid", ""), cookies.get("csrftoken", ""),
            cookies.get("mid", ""), sess.get("username", ""),
        )
    return sid, csrf, mid, uname

def get_active_session():
    """Action session if set, otherwise main session. Returns (sid, csrf, mid)."""
    sid, csrf, mid, _ = get_action_session()
    if sid:
        return sid, csrf, mid
    sid, csrf, mid, _ = get_main_session()
    return sid, csrf, mid

def get_ai_config():
    """Returns (provider, anthropic_key, openrouter_key, openrouter_model)."""
    provider = request.headers.get("X-AI-Provider",    "")
    ant_key  = request.headers.get("X-Anthropic-Key",  "")
    or_key   = request.headers.get("X-OpenRouter-Key", "")
    or_model = request.headers.get("X-OR-Model",       "")
    if not provider:
        cfg      = _read_json(CONFIG_FILE)
        provider = cfg.get("ai_provider", "anthropic")
        ant_key  = ant_key  or cfg.get("anthropic_api_key",  "")
        or_key   = or_key   or cfg.get("openrouter_api_key", "")
        or_model = or_model or cfg.get("openrouter_model",   "")
    return provider, ant_key, or_key, or_model

# ── Instagram request helpers ─────────────────────────────────────────────────

def _ds_user_id(sessionid: str) -> str:
    try:
        import urllib.parse
        return urllib.parse.unquote(sessionid).split(":")[0]
    except Exception:
        return ""

def _ig_cookies(sessionid: str, csrftoken: str = "", mid: str = "") -> dict:
    c: dict = {}
    if sessionid:
        c["sessionid"] = sessionid
        ds = _ds_user_id(sessionid)
        if ds:
            c["ds_user_id"] = ds
    if csrftoken:
        c["csrftoken"] = csrftoken
    if mid:
        c["mid"] = mid
    return c

def _ig_hdrs(csrftoken: str = "") -> dict:
    h = {
        "User-Agent":      "Instagram 278.0.0.19.115 Android (26/8.0.0; 480dpi; 1080x1920; OnePlus; ONEPLUS A3010; OnePlus3T; qcom; en_US; 314665256)",
        "X-IG-App-ID":     "936619743392459",
        "Accept":          "*/*",
        "Accept-Language": "it-IT,it;q=0.9",
        "Origin":          "https://www.instagram.com",
        "Referer":         "https://www.instagram.com/",
        "X-IG-Capabilities": "3brTvwE=",
        "X-IG-Connection-Type": "WIFI",
    }
    if csrftoken:
        h["X-CSRFToken"] = csrftoken
    return h

def _ig_get(path: str, sessionid: str, csrftoken: str = "", mid: str = "",
            params: dict | None = None, timeout: int = 12) -> dict:
    resp = requests.get(
        f"https://i.instagram.com/api/v1/{path}",
        params=params or {},
        headers=_ig_hdrs(csrftoken),
        cookies=_ig_cookies(sessionid, csrftoken, mid),
        timeout=timeout,
    )
    if not resp.ok:
        raise Exception(f"{resp.status_code} — {resp.text[:200]}")
    if not resp.text.strip():
        raise Exception(f"Risposta vuota (status {resp.status_code}) — riprova il login")
    try:
        data = resp.json()
    except Exception:
        raise Exception(f"Risposta non JSON (HTTP {resp.status_code}) — riprova")
    if data.get("status") == "fail":
        raise Exception(data.get("message") or "API Instagram: status fail")
    return data

def _ig_profile_info(username: str, sessionid: str, csrftoken: str, mid: str) -> dict:
    profile_referer = f"https://www.instagram.com/{username}/"
    mobile_hdrs = {**_ig_hdrs(csrftoken), "Referer": profile_referer}

    # Try mobile API first (i.instagram.com)
    try:
        resp = requests.get(
            f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}",
            headers=mobile_hdrs,
            cookies=_ig_cookies(sessionid, csrftoken, mid),
            timeout=10,
        )
        if resp.ok and resp.text.strip():
            data = resp.json()
            if "user" in data and "data" not in data:
                data = {"data": {"user": data["user"]}}
            if (data.get("data") or {}).get("user"):
                return data
    except Exception:
        pass

    # Fallback: web API (www.instagram.com) — works even when mobile API returns 400
    web_hdrs = {
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "X-IG-App-ID":     "936619743392459",
        "Accept":          "*/*",
        "Accept-Language": "it-IT,it;q=0.9",
        "Referer":         profile_referer,
        "Origin":          "https://www.instagram.com",
    }
    if csrftoken:
        web_hdrs["X-CSRFToken"] = csrftoken
    resp2 = requests.get(
        f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}",
        headers=web_hdrs,
        cookies=_ig_cookies(sessionid, csrftoken, mid),
        timeout=10,
    )
    if not resp2.ok:
        raise Exception(f"Profilo non trovato (HTTP {resp2.status_code})")
    if not resp2.text.strip():
        raise Exception("Risposta vuota dalla ricerca profilo — riprova il login")
    data2 = resp2.json()
    if data2.get("status") == "fail":
        raise Exception(data2.get("message") or "Profilo non trovato")
    if "user" in data2 and "data" not in data2:
        data2 = {"data": {"user": data2["user"]}}
    return data2

def _sse_headers():
    return {"Cache-Control": "no-cache,no-transform",
            "X-Accel-Buffering": "no", "Connection": "keep-alive"}

# ── Pages ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

# ── Auth ──────────────────────────────────────────────────────────────────────

@app.route("/api/session-status")
def session_status():
    _, _, _, username = get_main_session()
    return jsonify({"logged_in": bool(username), "username": username})

@app.route("/api/login", methods=["POST"])
def login():
    return jsonify({"success": False,
                    "error": "Il login con password non è supportato. Usa il tab 🍪 Cookie."})

@app.route("/api/login-sessionid", methods=["POST"])
def login_sessionid():
    body      = request.json or {}
    sessionid = (body.get("sessionid") or "").strip()
    username  = (body.get("username")  or "").strip().lstrip("@")
    if not sessionid or not username:
        return jsonify({"success": False, "error": "Inserisci username e sessionid."})

    csrftoken = mid = ""
    try:
        r = requests.get("https://www.instagram.com/",
                         cookies={"sessionid": sessionid}, timeout=10)
        csrftoken = r.cookies.get("csrftoken", "")
        mid       = r.cookies.get("mid", "")
    except Exception:
        pass

    _write_json(SESSION_FILE, {
        "username": username,
        "cookies":  {"sessionid": sessionid, "csrftoken": csrftoken, "mid": mid},
    })
    return jsonify({"success": True, "username": username,
                    "sessionid": sessionid, "csrftoken": csrftoken, "mid": mid})

@app.route("/api/logout", methods=["POST"])
def logout():
    _write_json(SESSION_FILE, {})
    return jsonify({"success": True})

# ── Bio ───────────────────────────────────────────────────────────────────────

@app.route("/api/bio/<username>")
def get_bio(username: str):
    sessionid, csrftoken, mid, _ = get_main_session()
    try:
        data = _ig_profile_info(username, sessionid, csrftoken, mid)
        user = (data.get("data") or {}).get("user")
        if not user:
            return jsonify({"success": False, "error": "Profilo non trovato o privato"})
        follower_count  = (user.get("edge_followed_by") or {}).get("count") or user.get("follower_count") or 0
        following_count = (user.get("edge_follow") or {}).get("count") or user.get("following_count") or 0
        return jsonify({
            "success":         True,
            "pk":              str(user.get("id") or user.get("pk") or ""),
            "full_name":       user.get("full_name") or "",
            "biography":       user.get("biography") or "",
            "follower_count":  follower_count,
            "following_count": following_count,
            "profile_pic_url": user.get("profile_pic_url_hd") or user.get("profile_pic_url") or "",
            "is_private":      user.get("is_private", False),
            "is_verified":     user.get("is_verified", False),
        })
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)})

# ── Likers ────────────────────────────────────────────────────────────────────

@app.route("/api/stream-likers")
def stream_likers():
    post_url = (request.args.get("post_url") or "").strip()
    if not post_url:
        return jsonify({"error": "post_url mancante"}), 400
    sessionid, csrftoken, mid, _ = get_main_session()
    if not sessionid:
        return jsonify({"error": "Non sei loggato"}), 401
    try:
        media_pk = shortcode_to_pk(extract_shortcode(post_url))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    def generate():
        try:
            yield f"data: {json.dumps({'type':'status','message':'Recupero like…'})}\n\n"
            next_min_id = ""
            user_count  = None
            total_sent  = 0
            seen_pks    = set()
            while True:
                params = {"count": 100}
                if next_min_id:
                    params["min_id"] = next_min_id
                result = _ig_get(f"media/{media_pk}/likers/", sessionid, csrftoken, mid, params)
                if user_count is None:
                    user_count = result.get("user_count", 0)
                    yield f"data: {json.dumps({'type':'total','count':user_count})}\n\n"
                for u in result.get("users", []):
                    pk = u.get("pk")
                    if pk in seen_pks:
                        continue
                    seen_pks.add(pk)
                    yield f"data: {json.dumps({'type':'user','data':{'pk':str(u.get('pk') or ''),'username':u.get('username',''),'full_name':u.get('full_name') or '','profile_pic_url':u.get('profile_pic_url') or '','is_private':u.get('is_private',False),'is_verified':u.get('is_verified',False)}})}\n\n"
                    total_sent += 1
                next_min_id = result.get("next_min_id", "")
                if not next_min_id:
                    break
            yield f"data: {json.dumps({'type':'done','fetched':total_sent,'total':user_count})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type':'error','message':str(exc)})}\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream",
                    headers=_sse_headers())

# Browser-mode endpoint not available in cloud (no headless browser)
@app.route("/api/stream-likers-browser")
def stream_likers_browser():
    return jsonify({"error": "Modalità browser non disponibile. Usa la modalità API (deseleziona il toggle Modalità Browser)."}), 501

# ── Connections ───────────────────────────────────────────────────────────────

def _stream_connections_gen(username: str, conn_type: str,
                            sessionid: str, csrftoken: str, mid: str,
                            limit: int = 5000):
    try:
        yield f"data: {json.dumps({'type':'status','message':'Ricerca profilo…'})}\n\n"
        data    = _ig_profile_info(username, sessionid, csrftoken, mid)
        user    = (data.get("data") or {}).get("user")
        if not user:
            yield f"data: {json.dumps({'type':'error','message':'Profilo non trovato o privato'})}\n\n"
            return
        user_id  = str(user.get("id") or user.get("pk") or "")
        if not user_id:
            yield f"data: {json.dumps({'type':'error','message':'ID utente non trovato nel profilo'})}\n\n"
            return
        endpoint = "followers" if conn_type == "followers" else "following"
        total_count = (
            (user.get("edge_followed_by") or {}).get("count") if conn_type == "followers"
            else (user.get("edge_follow") or {}).get("count")
        ) or user.get("follower_count" if conn_type == "followers" else "following_count") or 0
        if total_count:
            yield f"data: {json.dumps({'type':'total','count':total_count})}\n\n"
        yield f"data: {json.dumps({'type':'status','message':f'Caricamento {endpoint}…'})}\n\n"
        sent = 0
        seen: set = set()
        next_max_id = ""
        while sent < limit:
            params: dict = {
                "count": 200,
                "search_surface": "follow_list_page",
            }
            if next_max_id:
                params["max_id"] = next_max_id
            result = _ig_get(f"friendships/{user_id}/{endpoint}/", sessionid, csrftoken, mid, params)
            users_batch = result.get("users") or []
            for u in users_batch:
                pk = str(u.get("pk") or "")
                if not pk or pk in seen:
                    continue
                seen.add(pk)
                yield f"data: {json.dumps({'type':'user','data':{'pk':pk,'username':u.get('username',''),'full_name':u.get('full_name') or '','profile_pic_url':u.get('profile_pic_url') or '','is_private':u.get('is_private',False),'is_verified':u.get('is_verified',False)}})}\n\n"
                sent += 1
                if sent >= limit:
                    break
            raw_next = result.get("next_max_id")
            next_max_id = str(raw_next) if raw_next else ""
            if not next_max_id or not users_batch:
                break
        yield f"data: {json.dumps({'type':'done','count':sent})}\n\n"
    except Exception as exc:
        yield f"data: {json.dumps({'type':'error','message':str(exc)})}\n\n"

@app.route("/api/connections/<username>")
def get_connections(username: str):
    conn_type = (request.args.get("type") or "followers").strip()
    limit     = min(int(request.args.get("limit") or 2000), 5000)
    if conn_type not in ("followers", "following"):
        return jsonify({"error": "type must be followers or following"}), 400
    sessionid, csrftoken, mid, _ = get_main_session()
    if not sessionid:
        return jsonify({"error": "Non sei loggato"}), 401
    return Response(
        stream_with_context(_stream_connections_gen(username, conn_type, sessionid, csrftoken, mid, limit)),
        mimetype="text/event-stream", headers=_sse_headers())

@app.route("/api/stream-connections")
def stream_connections():
    username  = (request.args.get("username") or "").strip()
    conn_type = (request.args.get("type") or "followers").strip()
    if not username:
        return jsonify({"error": "username mancante"}), 400
    if conn_type not in ("followers", "following"):
        return jsonify({"error": "type non valido"}), 400
    sessionid, csrftoken, mid, _ = get_main_session()
    if not sessionid:
        return jsonify({"error": "Non sei loggato"}), 401
    return Response(
        stream_with_context(_stream_connections_gen(username, conn_type, sessionid, csrftoken, mid)),
        mimetype="text/event-stream", headers=_sse_headers())

# ── Action account ────────────────────────────────────────────────────────────

@app.route("/api/set-action-session", methods=["POST"])
def set_action_session():
    body      = request.json or {}
    sessionid = (body.get("sessionid") or "").strip()
    username  = (body.get("username")  or "").strip().lstrip("@")
    if not sessionid or not username:
        return jsonify({"success": False, "error": "Inserisci username e sessionid."})
    csrftoken = mid = ""
    try:
        r = requests.get("https://www.instagram.com/",
                         cookies={"sessionid": sessionid}, timeout=10)
        csrftoken = r.cookies.get("csrftoken", "")
        mid       = r.cookies.get("mid", "")
    except Exception:
        pass
    _write_json(ACTION_SESSION_FILE, {
        "username": username,
        "cookies":  {"sessionid": sessionid, "csrftoken": csrftoken, "mid": mid},
    })
    return jsonify({"success": True, "username": username,
                    "sessionid": sessionid, "csrftoken": csrftoken, "mid": mid})

@app.route("/api/action-session-status")
def action_session_status():
    _, _, _, username = get_action_session()
    return jsonify({"set": bool(username), "username": username})

@app.route("/api/remove-action-session", methods=["POST"])
def remove_action_session():
    _write_json(ACTION_SESSION_FILE, {})
    return jsonify({"success": True})

# ── Follow / Unfollow ─────────────────────────────────────────────────────────

@app.route("/api/follow/<user_id>", methods=["POST"])
def follow_user(user_id: str):
    sessionid, csrftoken, mid = get_active_session()
    if not sessionid:
        return jsonify({"success": False, "error": "Account azione non configurato"})
    try:
        resp = requests.post(
            f"https://i.instagram.com/api/v1/friendships/create/{user_id}/",
            headers={**_ig_hdrs(csrftoken), "Content-Type": "application/x-www-form-urlencoded"},
            cookies=_ig_cookies(sessionid, csrftoken, mid),
            data=f"user_id={user_id}", timeout=12,
        )
        if not resp.ok:
            return jsonify({"success": False, "error": f"Instagram: {resp.status_code}"})
        fs = (resp.json().get("friendship_status") or {})
        return jsonify({"success": True, "following": fs.get("following", True)})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)})

@app.route("/api/unfollow/<user_id>", methods=["POST"])
def unfollow_user(user_id: str):
    sessionid, csrftoken, mid = get_active_session()
    if not sessionid:
        return jsonify({"success": False, "error": "Account azione non configurato"})
    try:
        resp = requests.post(
            f"https://i.instagram.com/api/v1/friendships/destroy/{user_id}/",
            headers={**_ig_hdrs(csrftoken), "Content-Type": "application/x-www-form-urlencoded"},
            cookies=_ig_cookies(sessionid, csrftoken, mid),
            data=f"user_id={user_id}", timeout=12,
        )
        if not resp.ok:
            return jsonify({"success": False, "error": f"Instagram: {resp.status_code}"})
        return jsonify({"success": True, "following": False})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)})

# ── Friendship check ──────────────────────────────────────────────────────────

@app.route("/api/check-friendships", methods=["POST"])
def check_friendships():
    body     = request.json or {}
    user_ids = [str(x) for x in (body.get("user_ids") or []) if x]
    if not user_ids:
        return jsonify({"success": False, "error": "Nessun user_id fornito"})
    sessionid, csrftoken, mid = get_active_session()
    if not sessionid:
        return jsonify({"success": False, "error": "Non sei loggato"})
    results: dict = {}
    for i in range(0, len(user_ids), 100):
        batch = user_ids[i:i + 100]
        try:
            resp = requests.post(
                "https://i.instagram.com/api/v1/friendships/show_many/",
                headers={**_ig_hdrs(csrftoken), "Content-Type": "application/x-www-form-urlencoded"},
                cookies=_ig_cookies(sessionid, csrftoken, mid),
                data="user_ids=" + "%2C".join(batch), timeout=15,
            )
            if resp.ok:
                results.update(resp.json().get("friendship_statuses", {}))
        except Exception:
            pass
    return jsonify({"success": True, "statuses": results})

# ── App config ────────────────────────────────────────────────────────────────

@app.route("/api/config", methods=["GET", "POST"])
def api_config():
    if request.method == "GET":
        provider, ant_key, or_key, or_model = get_ai_config()
        return jsonify({
            "has_anthropic_key":  bool(ant_key),
            "has_openrouter_key": bool(or_key),
            "ai_provider":        provider or "anthropic",
            "openrouter_model":   or_model or "",
        })
    body = request.json or {}
    cfg  = _read_json(CONFIG_FILE)
    for k in ("anthropic_api_key", "openrouter_api_key", "ai_provider", "openrouter_model"):
        if k in body:
            cfg[k] = (body[k] or "").strip()
    _write_json(CONFIG_FILE, cfg)
    return jsonify({"success": True})

# ── AI test ───────────────────────────────────────────────────────────────────

@app.route("/api/test-ai", methods=["POST"])
def test_ai():
    provider, ant_key, or_key, or_model = get_ai_config()
    if provider == "openrouter":
        if not or_key:
            return jsonify({"success": False, "error": "API key OpenRouter non configurata"})
        model = or_model or "meta-llama/llama-4-scout:free"
        try:
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {or_key}",
                         "HTTP-Referer": "https://likelens.vercel.app", "X-Title": "Like Lens"},
                json={"model": model, "max_tokens": 10,
                      "messages": [{"role": "user", "content": "Reply with just: ok"}]},
                timeout=20,
            )
            if not resp.ok:
                return jsonify({"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:300]}"})
            text = resp.json()["choices"][0]["message"]["content"].strip()
            return jsonify({"success": True, "model": model, "response": text[:80]})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)})
    else:
        if not ant_key:
            return jsonify({"success": False, "error": "API key Anthropic non configurata"})
        try:
            import anthropic as _ant
            client = _ant.Anthropic(api_key=ant_key)
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001", max_tokens=10,
                messages=[{"role": "user", "content": "Reply with just: ok"}])
            return jsonify({"success": True, "response": msg.content[0].text.strip()[:80]})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)})

# ── Gender detection ──────────────────────────────────────────────────────────

_gender_jobs: dict = {}

@app.route("/api/prepare-gender-detection", methods=["POST"])
def prepare_gender_detection():
    body     = request.json or {}
    token    = secrets.token_hex(16)
    provider, ant_key, or_key, or_model = get_ai_config()
    _gender_jobs[token] = {
        "profiles": body.get("profiles", []),
        "provider": provider,
        "ant_key":  ant_key,
        "or_key":   or_key,
        "or_model": or_model,
    }
    return jsonify({"success": True, "token": token})

_GENDER_PROMPT = (
    "This is a social media profile picture. "
    "Does it show a male or female person? "
    "Includes anime/cartoon/illustrated characters. "
    "Reply with exactly one word: female, male, or unknown."
)

def _detect_gender_anthropic(api_key: str, img_b64: str, ctype: str) -> str:
    import anthropic as _ant
    client = _ant.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001", max_tokens=5,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": ctype, "data": img_b64}},
            {"type": "text",  "text": _GENDER_PROMPT},
        ]}],
    )
    ans = msg.content[0].text.strip().lower()
    return "female" if "female" in ans else "male" if "male" in ans else "unknown"

def _detect_gender_openrouter(api_key: str, model: str, img_b64: str, ctype: str) -> str:
    model = model or "anthropic/claude-haiku-4-5-20251001"
    resp  = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}",
                 "HTTP-Referer": "https://likelens.vercel.app", "X-Title": "Like Lens"},
        json={"model": model, "max_tokens": 5,
              "messages": [{"role": "user", "content": [
                  {"type": "image_url", "image_url": {"url": f"data:{ctype};base64,{img_b64}"}},
                  {"type": "text", "text": _GENDER_PROMPT},
              ]}]},
        timeout=20,
    )
    if not resp.ok:
        raise Exception(f"OpenRouter {resp.status_code}: {resp.text[:120]}")
    ans = resp.json()["choices"][0]["message"]["content"].strip().lower()
    return "female" if "female" in ans else "male" if "male" in ans else "unknown"

@app.route("/api/stream-detect-genders/<token>")
def stream_detect_genders(token: str):
    job = _gender_jobs.pop(token, None)
    if not job:
        return jsonify({"error": "Job scaduto, riprova"}), 404
    profiles = job["profiles"]
    provider = job.get("provider", "anthropic")
    ant_key  = job.get("ant_key", "")
    or_key   = job.get("or_key", "")
    or_model = job.get("or_model", "")

    if provider == "openrouter" and not or_key:
        return jsonify({"error": "Configura la tua API key OpenRouter nelle Impostazioni (⚙ AI)"}), 400
    if provider != "openrouter" and not ant_key:
        return jsonify({"error": "Configura la tua API key Anthropic nelle Impostazioni (⚙ AI)"}), 400

    def generate():
        import base64
        try:
            yield f"data: {json.dumps({'type':'status','message':f'Analisi di {len(profiles)} foto profilo…'})}\n\n"
            for i, profile in enumerate(profiles):
                username  = profile.get("username", "")
                pic_url   = profile.get("pic_url", "")
                gender    = "unknown"
                api_error = None
                if pic_url:
                    try:
                        img_r = requests.get(pic_url, timeout=8, headers={
                            "User-Agent": "Mozilla/5.0",
                            "Referer":    "https://www.instagram.com/",
                        })
                        if img_r.ok and len(img_r.content) > 500:
                            img_b64 = base64.standard_b64encode(img_r.content).decode()
                            ctype   = img_r.headers.get("Content-Type", "image/jpeg").split(";")[0]
                            try:
                                if provider == "openrouter":
                                    gender = _detect_gender_openrouter(or_key, or_model, img_b64, ctype)
                                else:
                                    gender = _detect_gender_anthropic(ant_key, img_b64, ctype)
                            except Exception as exc:
                                api_error = str(exc)
                        else:
                            api_error = f"Immagine non scaricabile (HTTP {img_r.status_code})"
                    except Exception as exc:
                        api_error = f"Download immagine fallito: {exc}"
                else:
                    api_error = "Nessuna URL immagine profilo"

                if api_error:
                    yield f"data: {json.dumps({'type':'gender_error','username':username,'message':api_error,'done':i+1,'total':len(profiles)})}\n\n"
                    continue
                yield f"data: {json.dumps({'type':'gender','username':username,'gender':gender,'done':i+1,'total':len(profiles)})}\n\n"
                time.sleep(0.1)
            yield f"data: {json.dumps({'type':'done','total':len(profiles)})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type':'error','message':f'Errore interno: {exc}'})}\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream",
                    headers=_sse_headers())

# ── Auto-follow ───────────────────────────────────────────────────────────────

_auto_follow_jobs: dict = {}

@app.route("/api/prepare-auto-follow", methods=["POST"])
def prepare_auto_follow():
    body  = request.json or {}
    token = secrets.token_hex(16)
    sid, csrf, mid = get_active_session()
    _auto_follow_jobs[token] = {
        "user_ids":  [str(x) for x in (body.get("user_ids") or []) if x],
        "delay":     max(1, min(7200, int(body.get("delay") or 5))),
        "sessionid": sid,
        "csrftoken": csrf,
        "mid":       mid,
    }
    return jsonify({"success": True, "token": token})

@app.route("/api/stream-auto-follow/<token>")
def stream_auto_follow(token: str):
    job = _auto_follow_jobs.pop(token, None)
    if not job:
        return jsonify({"error": "Job scaduto, riprova"}), 404
    user_ids  = job["user_ids"]
    delay     = job["delay"]
    sessionid = job["sessionid"]
    csrftoken = job["csrftoken"]
    mid       = job["mid"]
    if not sessionid:
        return jsonify({"error": "Account azione non configurato"}), 400

    def generate():
        yield f"data: {json.dumps({'type':'status','message':f'Avvio auto-follow di {len(user_ids)} utenti…'})}\n\n"
        followed = errors = 0
        for i, user_id in enumerate(user_ids):
            try:
                resp = requests.post(
                    f"https://i.instagram.com/api/v1/friendships/create/{user_id}/",
                    headers={**_ig_hdrs(csrftoken), "Content-Type": "application/x-www-form-urlencoded"},
                    cookies=_ig_cookies(sessionid, csrftoken, mid),
                    data=f"user_id={user_id}", timeout=12,
                )
                if not resp.ok:
                    errors += 1
                    yield f"data: {json.dumps({'type':'error_item','user_id':user_id,'status':resp.status_code,'error':resp.text[:120]})}\n\n"
                    continue
                try:
                    rj = resp.json()
                except Exception:
                    rj = {}
                ig_status  = rj.get("status", "ok")
                fs         = rj.get("friendship_status", {})
                if ig_status != "ok":
                    errors += 1
                    yield f"data: {json.dumps({'type':'error_item','user_id':user_id,'status':resp.status_code,'error':rj.get('message',f'status={ig_status}')})}\n\n"
                    continue
                is_following = fs.get("following", None)
                is_pending   = fs.get("outgoing_request", False)
                if fs and is_following is False and not is_pending:
                    errors += 1
                    yield f"data: {json.dumps({'type':'error_item','user_id':user_id,'status':resp.status_code,'error':'Instagram ha bloccato il follow (anti-spam). Aumenta il delay.'})}\n\n"
                    continue
                followed += 1
                yield f"data: {json.dumps({'type':'followed','user_id':user_id,'count':followed,'total':len(user_ids),'pending':is_pending})}\n\n"
            except Exception as exc:
                errors += 1
                yield f"data: {json.dumps({'type':'error_item','user_id':user_id,'error':str(exc)})}\n\n"
            if i < len(user_ids) - 1:
                yield f"data: {json.dumps({'type':'wait','seconds':delay,'done':i+1,'total':len(user_ids)})}\n\n"
                time.sleep(delay)
        yield f"data: {json.dumps({'type':'done','followed':followed,'errors':errors})}\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream",
                    headers=_sse_headers())

# ── Image proxy ───────────────────────────────────────────────────────────────

@app.route("/api/proxy-image")
def proxy_image():
    url = (request.args.get("url") or "").strip()
    if not url:
        return Response(status=400)
    try:
        resp = requests.get(url, timeout=8, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer":    "https://www.instagram.com/",
        })
        if not resp.ok:
            return Response(status=resp.status_code)
        ct = resp.headers.get("Content-Type", "image/jpeg")
        if not ct.startswith("image/"):
            return Response(status=502)
        return Response(resp.content, content_type=ct)
    except Exception:
        return Response(status=502)

if __name__ == "__main__":
    app.run(debug=False, port=5000, threaded=True)
