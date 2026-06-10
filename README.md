# LikeLens — Instagram Analytics & Follow Manager

Dashboard web per analizzare e gestire un profilo Instagram: scopri **chi non ti
segue indietro**, i tuoi **fan**, i **mutual**, fai **unfollow con un click** o in
**bulk** (con delay anti-blocco e whitelist), e analizza i **like dei tuoi post**.

Costruita con **Next.js 16 + React 19 + shadcn/ui + Tailwind v4**.

> ⚠️ Le credenziali (sessionid Instagram) restano **solo nel tuo browser**
> (localStorage). Il server le riceve per-richiesta come header e le inoltra a
> Instagram, senza mai salvarle. Usa un account secondario per le azioni di
> massa: l'automazione viola i ToS di Instagram e può portare a blocchi.

## Funzioni

- 📊 Stat: follower, seguiti, ratio, non-follower, fan
- 🔎 Tab: **Non ti seguono** · Fan · Mutual · Tutti · Whitelist · Like post
- 🧹 Unfollow singolo e **bulk** con slider delay (2–60s), progress e stop
- ⭐ **Whitelist**: account che non vuoi mai rimuovere vengono saltati nei bulk
- 🖼️ Analisi dei **like** di un post + chi di loro segui/ti segue
- 📸 **Snapshot** storici (follower/seguiti nel tempo, diff di chi hai perso)
- ⬇️ Export **CSV**
- 🔐 Account azione opzionale (burner) per le operazioni di follow/unfollow
- 🌗 Dark / light mode

## Come si usa

1. Apri instagram.com loggato → F12 → Application → Cookie → copia `sessionid`.
2. Incollalo nella schermata di login (lo username viene rilevato in automatico).
3. Premi **Analizza follower & seguiti**, poi usa le tab e i filtri.

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm start
```

Deploy su Vercel (zero-config, App Router). Vedi `PROGRESS.md` per lo stato di
lavoro, i limiti noti e i prossimi step. La vecchia versione Flask è in `legacy/`.
