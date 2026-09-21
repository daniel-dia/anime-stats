// Check: hits AniList and Jev with the same payload as the route. `node check.mjs "naruto"`
import assert from 'node:assert'
import QUESTIONS from './server/questions.json' with { type: 'json' }

const title = process.argv[2] || 'naruto'
const q = `query ($s: String) { Media(search: $s, type: ANIME) { title { romaji english } description(asHtml: false) seasonYear format episodes source } }`
const r0 = await fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: q, variables: { s: title } }),
})
const m = (await r0.json()).data?.Media
assert.ok(m, `anilist found nothing for "${title}" (HTTP ${r0.status})`)
const synopsis = (m.description ?? '').replace(/<[^>]+>/g, ' ').trim()
console.log('anilist:', m.title.romaji)

const state = `Title: ${m.title.romaji}\nFormat: ${m.format}\nSource: ${m.source}\n\nSynopsis: ${synopsis}`

const res = await fetch('https://api.typesafe.ai/v1/systemone', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.JEV_KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify({ state, model: 'jev-latest', questions: QUESTIONS }),
})
const raw = await res.text()
assert.equal(res.status, 200, `jev returned ${res.status}: ${raw}`)
const { answers, model } = JSON.parse(raw)
assert.ok(answers.primary_genre.choice && answers.demographic.choice)
assert.ok(typeof answers.maturity.score === 'number')
assert.ok(typeof answers.has_isekai.noul === 'number')
console.log(model, '→', answers.primary_genre.choice, '/', answers.demographic.choice, '/ maturity', answers.maturity.score)
console.log('ok')
