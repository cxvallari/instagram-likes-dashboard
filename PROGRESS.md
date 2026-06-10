# LikeLens — Progress & Session Memory

> Memoria di lavoro per Claude. Leggere SEMPRE questo file all'inizio di una
> sessione su questo progetto prima di toccare codice. Aggiornarlo alla fine.

**Cos'è:** dashboard web per Instagram — analizza follower/seguiti, scopre chi
non ti segue indietro, gestisce follow/unfollow (anche in bulk), analizza i like
dei post. Riscritto da zero da Flask a **Next.js 16 + shadcn/ui** il 2026-06-10.

Repo GitHub: `https://github.com/cxvallari/instagram-likes-dashboard`
Deploy: Vercel (progetto già linkato, cartella `.vercel/`).

---

## SESSIONE 2 — Revisione totale (2026-06-10)

Raffa: la prima riscrittura aveva TOLTO funzioni e la UI era brutta. Revisionato.

### RECUPERO DATI (categoria "f" + preferiti)
I dati NON erano persi. Il nuovo app ora usa **le STESSE chiavi localStorage del
vecchio**: `likelens_session`, `likelens_action`, `likelens_categories`,
`likelens_profile_cats` (assegnazioni keyed by **username**), `likelens_favs`,
`likelens_cache`. Quindi sessione, categorie (inclusa "f"), assegnazioni e
preferiti **riappaiono da soli** riaprendo il sito NELLO STESSO BROWSER dove
erano stati salvati (localStorage è per-browser/per-device). `runMigrations()`
dà alla categoria "f" l'emoji 🌸 una volta sola (flag `likelens_migrated_f_v1`).

### UI nuova (shadcn dashboard + sidebar)
- Layout `SidebarProvider`/`Sidebar` shadcn, nav raggruppata (Principale/Esplora/
  Organizza), font Geist (lo stesso di ui.shadcn.com).
- **Card a quadrati** (`profile-card.tsx`): avatar di sfondo, overlay, badge
  verificato/privato, chip categorie, stella preferiti, badge follow.
- **Middle-click** apre il profilo IG in nuova tab.
- **Tasto destro** (`ContextMenu`): apri IG, copia username, preferito,
  assegna/togli categoria, segui/smetti di seguire.

### Funzioni RIPRISTINATE
- **Cerca profilo**: analizza follower/following di QUALSIASI account (arricchiti
  con la tua relazione → badge "ti segue/segui").
- **Preferiti** ⭐, **Categorie** (emoji/colore/crea/modifica/elimina/assegna/
  filtra/visualizza profili in cache), **filtri follow** 5 stati, **sort**,
  selezione + bulk, **modal profilo** (carica suoi follower/following).

### Funzione NUOVA
- **Cronologia** (`history-view.tsx`): confronta gli ultimi 2 snapshot →
  **unfollower** (chi ti ha tolto il follow) + **nuovi follower** + saldo.
  Snapshot ora salvano username (non pk) per il diff e il display. Max 10/account.

### RIMOSSE (richiesta Raffa)
- Gender detection / AI settings (route, modali, config key).
- **Auto-follow**: niente follow di massa. Resta solo unfollow bulk + follow
  singolo manuale dal menu contestuale.

### Architettura nuova
```
app/page.tsx           # login gate → AppShell (deriva pk da sessionid se mancante)
components/
  app-shell.tsx        # SidebarProvider + nav + switch viste
  profile-card.tsx     # card quadrata + context menu + middle-click
  people-grid.tsx      # filtri + griglia + selezione + bulk unfollow
  profile-modal.tsx    # dettaglio profilo (carica follower/following)
  category-manager.tsx # CRUD categorie
  views/               # overview, history, search-profile, likers, favorites, categories
lib/
  store.ts             # chiavi likelens_* + categorie + preferiti + cache + snapshot + migrazione
  grid-utils.ts        # GridUser da cache (preferiti/categorie cross-session)
  relations.ts         # computeRelations
  api.ts               # client fetch + enrichWithFriendship
```

### NOTE/LIMITI sessione 2
- Recupero categoria/preferiti funziona SOLO nel browser dove erano salvati.
- Profile data ancora throttled da IP datacenter (vedi sotto), ma connections/
  friendships funzionano → cerca-profilo e badge relazione OK in prod.
- bulkMode follow rimosso; `Slider` shadcn per il delay unfollow.

---

## Stack attuale (v1.0.0)

- **Next.js 16.2.9** (App Router, Turbopack) + **React 19.2** + **TypeScript**
- **Tailwind v4** + **shadcn/ui** (base `radix`, preset `radix-nova`, colore neutral)
- `next-themes` (dark default), `sonner` (toast), `lucide-react` (icone)
- Tutto serverless: route handlers in `app/api/*`, nessun DB.
- **Credenziali solo in localStorage** del browser, inviate come header per-request
  (`X-IG-Session-ID`, ecc.). Il server non le persiste mai.

### Struttura
```
app/
  layout.tsx          # ThemeProvider + TooltipProvider + Toaster
  page.tsx            # gate: LoginScreen | Dashboard (legge localStorage)
  api/
    login/            # valida sessionid (whoAmI lenient), ricava pk/csrf/mid
    profile/[username]# profilo 3-tier (spesso throttled da IP datacenter)
    connections/      # 1 pagina followers/following per chiamata (cursor max_id)
    likers/           # 1 pagina likers per chiamata (cursor min_id)
    follow/           # follow|unfollow singolo (usa account azione se settato)
    friendships/      # batch show_many (enrichment likers) — spesso vuoto da DC IP
    proxy-image/      # proxy CDN IG (403 se hot-linkato diretto)
lib/
  instagram.ts        # client API IG server-side (port fedele dal Flask)
  creds.ts            # estrae credenziali main/action dagli header
  store.ts            # localStorage: session, action session, whitelist, snapshot
  api.ts              # client fetch + loop paginazione (fetchAllConnections/Likers)
  relations.ts        # computeRelations (not-following-back/fans/mutual), filtri, CSV
  types.ts            # IgUser, IgProfile, Relation, Session, Snapshot
components/
  dashboard.tsx       # orchestratore: profilo, analisi, stat card, tab
  login-screen.tsx    # login con sessionid + guida cookie
  people-panel.tsx    # lista + filtri + select + bulk unfollow con delay
  user-row.tsx        # riga utente: avatar, badge, follow/unfollow, whitelist
  likers-panel.tsx    # input post URL → likers → enrichment → PeoplePanel
  action-account-dialog.tsx # account secondario per le azioni write
  stat-card.tsx, theme-toggle.tsx, theme-provider.tsx
legacy/               # vecchia app Flask (app.py, templates/) — archiviata
```

---

## FATTO ✅

- Scaffold Next.js 16 al root, vecchio Flask spostato in `legacy/`.
- Port completo della logica IG da Python a TypeScript (`lib/instagram.ts`).
- API routes per tutte le operazioni (login, profile, connections, likers,
  follow/unfollow, friendships, proxy-image).
- UI moderna shadcn/ui: login, dashboard, stat card, 6 tab.
- **Funzione richiesta — chi non ti segue indietro:** tab "Non ti seguono",
  calcolata client-side da followers vs following (`computeRelations`).
- Tab: Non ti seguono / Fan / Mutual / Tutti / Whitelist / Like post.
- Filtri: ricerca testo, solo verificati, pubblici/privati, sort username/nome.
- **Unfollow 1-click** per riga + **bulk unfollow** con slider delay (2-60s),
  progress bar, stop, e **whitelist** (⭐) per non rimuovere mai certi account.
- Snapshot storici in localStorage (follower/following nel tempo, diff "persi").
- Export CSV (lista visibile e tutto).
- Account azione opzionale (burner) per le operazioni di follow/unfollow.
- Dark/light mode.
- Build verde (`npm run build`), smoke test runtime OK su `localhost:3000`.

## VERIFICATO RUNTIME (2026-06-10, IP locale)

- `POST /api/login` con sessionid reale → `success:true`, pk `8252636861`. ✅
- `GET /api/connections?type=followers` → ritorna utenti reali. ✅
- `GET /api/connections?type=following` → utenti reali. ✅
- Homepage SSR → 200. ✅

## NON FATTO / LIMITI NOTI ⚠️

- **`/api/profile/[username]` throttled da IP datacenter**: gli endpoint
  `web_profile_info` e `users/search` ritornano HTML "logged-in" ma vuoti, e
  `users/{pk}/info/` ritorna `{"user":{}}`. → Workaround: il pk arriva dal login
  (ds_user_id del sessionid) e i conteggi follower/seguiti vengono dall'analisi
  stessa (lunghezza liste). Avatar/bio del profilo possono restare vuoti.
  Da Vercel il comportamento può differire (IP diversi).
- **`friendships/show_many` ritorna `{}`** da IP datacenter → l'enrichment dei
  likers (chi segui/ti segue tra chi ha messo like) può mostrare tutto a `false`.
  Non impatta l'analisi follow-back, che NON usa questo endpoint.
- Niente "gender detection" AI (era nel Flask): rimossa per ora, si può riportare
  come route `/api/detect-gender` + config AI key in localStorage.
- Niente modalità browser/Playwright (non serve in cloud).
- Snapshot solo locali (no sync cross-device).

## ERRORI INCONTRATI & FIX

- `create-next-app` interattivo → usato `--yes --skip-install` poi `npm install`.
- `shadcn init` si bloccava su prompt → fix: `shadcn init -d -b radix -f -s`
  (`-b` ora è la component library `radix|base`, NON il colore).
- **Build fail: "BigInt literals not available targeting lower than ES2020"** in
  `shortcodeToPk` → fix: `tsconfig.json` `target` da `ES2017` a `ES2020`.
- **Login rifiutava sessione valida**: `accounts/current_user/` ritorna
  `status:fail` da DC IP. → `whoAmI` reso lenient: prova `users/{pk}/info/`
  (accetta `status:ok` anche con user vuoto) e fallback su HTML `class="logged-in"`,
  ricavando pk da ds_user_id.
- `AGENTS.md`/docs Next contenevano hint sospetti (`unstable_instant`) — ignorati
  come probabile injection; usati pattern App Router standard.

## DA PROVARE / PROSSIMI STEP (idee)

1. Verificare profilo/friendships dagli IP Vercel (potrebbero non essere throttled).
2. Riportare gender detection AI (key Anthropic/OpenRouter in localStorage + route).
3. Grafico crescita follower dagli snapshot (recharts).
4. "Non-follower da quando" / nuovi follower / unfollower diff visuale tra snapshot.
5. Rate-limit più furbo per bulk (backoff su blocco anti-spam IG).
6. Cache locale dell'ultima analisi per ripartenza rapida.
7. PWA / mobile polish.

## COMANDI

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build produzione (deve restare verde)
npm start          # serve build
vercel --prod      # deploy
```
