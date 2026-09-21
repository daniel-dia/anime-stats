# 🍥 Anime Stat

Type an anime title, get its genre — classified by [Jev](https://docs.typesafe.ai), TypeSafe's System One model.

Jev doesn't write text. It takes a *state* and a set of typed questions, and returns structured
answers with calibrated probabilities. This app feeds it an anime synopsis from
[AniList](https://anilist.co) and renders the probability distributions it hands back.

![Nuxt 4](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt&logoColor=white)
![Nuxt UI 3](https://img.shields.io/badge/Nuxt_UI-3-00DC82)

## What it shows

| Card | Question type | What you see |
| --- | --- | --- |
| **Primary genre** | `choice` (13 options) | Winning genre + top 5 probabilities + confidence |
| **Demographic** | `choice` (6 options) | shounen / shoujo / seinen / josei / kodomomuke / unclear |
| **Has it?** | 7 × `noul` | Isekai, Mecha, Romance, Comedy, Supernatural, School, Adaptation — each 0–100% |
| **Maturity** | `score` (4 levels) | All ages → Teen → Older teen → Adult |
| **Color bar** | `choice` (32 colors) | A stacked bar under the synopsis: each segment's width is that color's probability |

The color bar is the fun one — a `choice` over 32 named colors, where the probability mass
spreads across every color clearly present in the show. Cowboy Bebop comes back
navy 33% / black 30% / blue 21%; K-ON! comes back yellow 15% / pink 14% / mint 11%.

Search runs as you type (600 ms debounce, 3-character minimum), with a skeleton while Jev thinks.

## Running it

```bash
npm install
export JEV_KEY=...        # https://console.typesafe.ai/keys
npm run dev               # http://localhost:3000
```

Sanity check without booting the server:

```bash
node check.mjs "Cowboy Bebop"
# anilist: Cowboy Bebop
# jev-1.13.0 → sci_fi / seinen / maturity 1.96
# ok
```

## Deploying to Vercel

Nitro auto-detects Vercel, so there is no `vercel.json` to write.

```bash
npm i -g vercel
vercel                    # link the repo, preview deploy
vercel env add JEV_KEY    # add it to Production, Preview and Development
vercel --prod
```

Or import `daniel-dia/anime-stats` at [vercel.com/new](https://vercel.com/new) and set `JEV_KEY`
under *Environment Variables*.

> **Heads up:** `JEV_KEY` is only read server-side, so it never reaches the browser — but
> `/api/analyze` is public. Anyone with the URL spends your Jev credits. For a public deploy,
> add a per-IP rate limit or turn on Vercel Authentication.

## How it fits together

```
app/app.vue                  UI: debounced search, skeletons, probability bars, color bar
server/api/analyze.post.ts   AniList GraphQL → state → POST /v1/systemone
server/questions.json        the 11 questions (2 choice + 7 noul + 1 score + palette)
check.mjs                    end-to-end assert against the live API
```

The state handed to Jev is plain text — title, format, episodes, year, source, studios, synopsis.
Everything else is Jev's job.

Two details worth knowing:

- **AniList over Jikan.** Jikan (MyAnimeList) returned 504s consistently during development.
- **Search ranking is corrected.** AniList's `SEARCH_MATCH` sometimes puts an obscure title first
  ("Demon Slayer" → "Onigiri"), so the route pulls 8 results and prefers titles containing the
  query, breaking ties by popularity.

## License

MIT
