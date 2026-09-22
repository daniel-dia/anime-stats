# 🍥 Anime Stats

**Live: [anime-stat.vercel.app](https://anime-stat.vercel.app)**

Type an anime title, get its genre — classified by [Jev](https://docs.typesafe.ai), TypeSafe's System One model.

Jev doesn't write text. It takes a *state* and a set of typed questions, and returns structured
answers with calibrated probabilities. This app feeds it an anime synopsis from
[AniList](https://anilist.co) and renders the probability distributions it hands back.

[![Live](https://img.shields.io/badge/live-anime--stat.vercel.app-000?logo=vercel)](https://anime-stat.vercel.app)
![Nuxt 4](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt&logoColor=white)
![Nuxt UI 3](https://img.shields.io/badge/Nuxt_UI-3-00DC82)

## What it shows

| Card | Question type | What you see |
| --- | --- | --- |
| **Primary genre** | `choice` (13 options) | A treemap of the probabilities + confidence |
| **Demographic** | `choice` (6 options) | shounen / shoujo / seinen / josei / kodomomuke / unclear |
| **Has it?** | 7 × `noul` | Isekai, Mecha, Romance, Comedy, Supernatural, School, Adaptation — each 0–100% |
| **Maturity** | `score` (4 levels) | All ages → Teen → Older teen → Adult |
| **Color bar** | `choice` (32 colors) | A stacked bar under the synopsis: each segment's width is that color's probability. It also tints the page background and the titles. |

The color bar is the fun one — a `choice` over 32 named colors, where the probability mass
spreads across every color clearly present in the show. Cowboy Bebop comes back
navy 33% / black 30% / blue 21%; K-ON! comes back yellow 15% / pink 14% / mint 11%.

Search runs as you type (600 ms debounce, 3-character minimum), with a skeleton while Jev thinks.
The treemaps are [Unovis](https://unovis.dev); every tile is hoverable for its exact percentage.

## The questions

Everything Jev answers is declared in [`server/questions.json`](server/questions.json) and sent in a
**single** request. Three primitives cover all of it:

| Primitive | You give it | It returns |
| --- | --- | --- |
| `choice` | a `criteria` **object**: option name → what that option means | the winning option, a probability per option, and a confidence |
| `score` | a `criteria` **array**: ordered levels, low to high | a float score on that scale, per-level probabilities, confidence |
| `noul` | just `instructions` — a yes/no statement | `noul`: the probability the statement is true, 0–1 |

Nothing is a free-text prompt. The option names in `criteria` *are* the output values, so the answer
is typed by construction — there is no JSON to parse and no invalid value to guard against.

### A choice

```json
"demographic": {
  "type": "choice",
  "instructions": "Which demographic was this anime primarily made for, based on `state`?",
  "criteria": {
    "shounen": "Teen boys. Action, rivalry, tournaments, power progression.",
    "seinen": "Adult men. Darker themes, complex plots, graphic violence or psychology.",
    "unclear": "Not enough information to tell."
  }
}
```

An `unclear` option matters: without it the model has to pick a real demographic for a show that
never signals one, and the probabilities lie. Give it somewhere honest to put the mass.

### A score

```json
"maturity": {
  "type": "score",
  "instructions": "How mature is the content of this anime?",
  "criteria": [
    "All ages: no violence or suggestive content.",
    "Teen: mild violence, some suggestive humor.",
    "Older teen: serious violence, dark themes.",
    "Adult: graphic violence, explicit sexual content."
  ]
}
```

Levels are an ordered rubric, not labels. The answer comes back as a float (`1.37`), so you can
threshold it in code instead of mapping a string back to a number.

### A noul

```json
"has_isekai": {
  "type": "noul",
  "instructions": "Is a character transported to, reborn in, or summoned into another world?"
}
```

Seven of these ride along in the same call. A noul is not a boolean — `0.54` for *romance* means the
model genuinely is unsure, which is information a `true` would have thrown away.

### Two-step instructions

The `palette` question asks for something Jev cannot name out loud, so the instruction makes it
decide first and answer second:

> First pick the single most iconic element of this anime — its main character or duo, a signature
> object, a vehicle, or the defining environment; whichever fans picture first. Then, based on
> `state`, spread the probability across the colors that element actually is, strongest color first.

The 32 color options are the only thing it can return, but the reasoning that picks them is steered
by the instruction. Cowboy Bebop comes back black/navy/blue; Demon Slayer comes back
forest green/green/red.

### What comes back

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "primary_genre": { "type": "choice", "choice": "sci_fi", "confidence": 0.81,
                       "probabilities": { "sci_fi": 0.83, "action": 0.12, "adventure": 0.05 } },
    "maturity":      { "type": "score", "score": 1.96, "confidence": 0.92,
                       "legend": { "0": "All ages", "1": "Teen", "2": "Older teen", "3": "Adult" } },
    "has_isekai":    { "type": "noul", "noul": 0.05 }
  },
  "usage": { "input_tokens": 1701, "output_tokens": 599 }
}
```

The UI renders those numbers directly — the treemap tiles are `probabilities`, the maturity bar is
`score / 3`, and the color bar is the `palette` distribution. Nothing is post-processed by another
model.

### Cost shape

All 11 questions travel in one request: ~1.7k input tokens, ~600 output tokens, ~870 ms. Adding a
question makes the input longer; it does not add a round trip. The 32-color `palette` criteria are
the single biggest chunk of that input.

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
under *Environment Variables*. This repo's deployment lives at
[anime-stat.vercel.app](https://anime-stat.vercel.app).

> **Heads up:** `JEV_KEY` is only read server-side, so it never reaches the browser — but
> `/api/analyze` is public. Anyone with the URL spends your Jev credits. For a public deploy,
> add a per-IP rate limit or turn on Vercel Authentication.

## How it fits together

```
app/app.vue                  UI: debounced search, Unovis treemaps, palette theming
app/assets/css/main.css      treemap/tooltip CSS vars, tinted background
server/api/analyze.post.ts   AniList GraphQL → state → POST /v1/systemone
server/questions.json        the 11 questions (3 choice + 7 noul + 1 score)
check.mjs                    end-to-end assert against the live API
```

The state handed to Jev is plain text — title, format, episodes, year, source, studios, synopsis.
Everything else is Jev's job.

Two details worth knowing:

- **AniList over Jikan.** Jikan (MyAnimeList) returned 504s consistently during development.
- **Search ranking is corrected.** AniList's `SEARCH_MATCH` sometimes puts an obscure title first
  ("Demon Slayer" → "Onigiri"), so the route pulls 8 results and prefers titles containing the
  query, breaking ties by popularity.

## Credits

Built by [Daniel Santos](https://github.com/daniel-dia). Classification by [Jev](https://typesafe.ai),
metadata from [AniList](https://anilist.co).

## License

MIT
