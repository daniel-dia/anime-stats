import QUESTIONS from '../questions.json'

const ANILIST = `query ($s: String) {
  Page(perPage: 8) {
    media(search: $s, type: ANIME, sort: SEARCH_MATCH) {
      title { romaji english }
      description(asHtml: false)
      seasonYear format episodes source popularity
      coverImage { large }
      siteUrl
      studios(isMain: true) { nodes { name } }
    }
  }
}`

export default defineEventHandler(async (event) => {
  const key = process.env.JEV_KEY
  if (!key) throw createError({ statusCode: 500, message: 'JEV_KEY is not set in the environment' })

  const { title } = await readBody<{ title?: string }>(event)
  if (!title?.trim()) throw createError({ statusCode: 400, message: 'Give me an anime title' })

  // AniList provides the synopsis, which becomes Jev's `state`.
  const res = await $fetch.raw<any>('https://graphql.anilist.co', {
    method: 'POST',
    body: { query: ANILIST, variables: { s: title.trim() } },
    ignoreResponseError: true,
  })
  if (res.status === 429) throw createError({ statusCode: 429, message: 'AniList rate limit — try again in a few seconds.' })
  // AniList SEARCH_MATCH sometimes ranks an obscure title first ("Demon Slayer" -> "Onigiri"):
  // prefer titles containing the query, then the most popular among those.
  const q = title.trim().toLowerCase()
  const hit = (x: any) => [x.title?.romaji, x.title?.english].some((t: string) => t?.toLowerCase().includes(q))
  const m = ((res._data as any)?.data?.Page?.media ?? [])
    .sort((a: any, b: any) => (hit(b) ? 1 : 0) - (hit(a) ? 1 : 0) || (b.popularity ?? 0) - (a.popularity ?? 0))[0]
  if (!m) throw createError({ statusCode: 404, message: `Could not find "${title}"` })

  const synopsis = (m.description ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
  const state = [
    `Title: ${m.title.romaji}${m.title.english && m.title.english !== m.title.romaji ? ` (${m.title.english})` : ''}`,
    `Format: ${m.format ?? '?'} · Episodes: ${m.episodes ?? '?'} · Year: ${m.seasonYear ?? '?'}`,
    `Source: ${m.source ?? '?'}`,
    `Studios: ${m.studios?.nodes?.map((s: any) => s.name).join(', ') || '?'}`,
    '',
    `Synopsis: ${synopsis || '(no synopsis)'}`,
  ].join('\n')

  const jev = await $fetch<any>('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: { state, model: 'jev-latest', questions: QUESTIONS },
  })

  return {
    anime: {
      title: m.title.english || m.title.romaji,
      image: m.coverImage?.large,
      year: m.seasonYear,
      type: m.format,
      episodes: m.episodes,
      url: m.siteUrl,
      synopsis,
    },
    answers: jev.answers,
    model: jev.model,
  }
})
