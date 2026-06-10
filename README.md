<div align="center">

# 👁️ LikeLens

**Instagram analytics & follow manager — locale, privato, veloce.**

Scopri chi non ti segue indietro, i tuoi fan e i mutual. Gestisci unfollow,
organizza i profili in categorie, analizza i like dei post — tutto in una
dashboard moderna che gira sul tuo computer.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-neutral-000)

</div>

---

## ✨ Funzioni

- 📊 **Dashboard** — follower, seguiti, ratio, non-follower, fan a colpo d'occhio
- 🔍 **Chi non ti segue** — calcolato dalle tue liste follower/following, affidabile
- 🏷️ **Categorie** — organizza i profili con emoji e colori, assegna in bulk
- ⭐ **Preferiti** — salva i profili che ti interessano
- 🧭 **Cerca profilo** — analizza follower/following di **qualsiasi** account
- ❤️ **Like di un post** — chi ha messo like, con stato follow relativo a te
- 🕓 **Cronologia** — chi ti ha tolto il follow e i nuovi follower (via snapshot)
- 🧹 **Unfollow** — singolo con un click o in bulk con delay anti-blocco
- 🎛️ **Filtri** — Mutual / Unmutual, pubblici / privati / verificati, ordina, cerca
- 🖱️ **UX** — griglia a card, middle-click apre il profilo IG, menu tasto destro
- 🌗 **Tema** — chiaro / scuro, stile shadcn `dashboard` neutral

## 🔒 Privacy

Le credenziali (sessionid Instagram) restano **solo nel tuo browser**
(`localStorage`). Il server gira in locale sul tuo PC, riceve le credenziali
per-richiesta e le inoltra a Instagram — **non vengono mai salvate altrove**.

## 🚀 Avvio (in locale)

```bash
npm install
npm run dev        # http://localhost:5000
```

Per la build di produzione:

```bash
npm run build
npm start          # http://localhost:5000
```

### Login

1. Apri instagram.com loggato → `F12` → **Application → Cookie**
2. Copia il valore del cookie `sessionid`
3. Incollalo in LikeLens (in basso a sinistra → **Accedi**) con il tuo username
4. **Dashboard → Analizza** una volta: carica le tue liste e popola tutto il resto

## 🧱 Stack

| Layer    | Tech |
|----------|------|
| Framework| Next.js 16 (App Router, Turbopack) + React 19 |
| UI       | shadcn/ui · Tailwind v4 · lucide-react · Geist font |
| Stato    | localStorage (sessione, categorie, preferiti, analisi, cache foto) |
| Backend  | Route handlers Next.js verso la private API di Instagram |

## 🏗️ Come funziona

- **Follow-back** dalle liste follower/following (l'API friendship di IG è bloccata
  ed è inaffidabile, quindi non viene usata).
- **Foto profilo** con cache dei byte su disco (`/api/avatar`): gli URL CDN di
  Instagram scadono, i byte cachati no → le immagini non spariscono.
- **Persistenza** dell'analisi e delle foto in `localStorage` + cache disco, con
  fallback compatto se si supera la quota.

## ⚠️ Disclaimer

Strumento per uso personale. L'automazione (follow/unfollow di massa) viola i
Termini di Servizio di Instagram e può portare a limitazioni dell'account. Usa
delay alti e, se vuoi, un account secondario per le azioni. Usalo con criterio.

---

<div align="center">
La versione storica in Flask è archiviata in <code>legacy/</code>.
</div>
