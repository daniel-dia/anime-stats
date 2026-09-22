<script setup lang="ts">
import { VisSingleContainer, VisTooltip, VisTreemap } from '@unovis/vue'
import { Treemap } from '@unovis/ts'
import QUESTIONS from '../server/questions.json'

const title = ref('')
const pending = ref(false)
const error = ref('')
const result = ref<any>(null)

const MATURITY = ['All ages', 'Teen', 'Older teen', 'Adult']

let timer: any
let lastQuery = ''

watch(title, (v) => {
  clearTimeout(timer)
  const q = v.trim()
  if (q.length < 3 || q === lastQuery) return
  timer = setTimeout(analyze, 600) // ponytail: plain debounce, no in-flight cancellation
})

async function analyze(explicit = false) {
  const q = title.value.trim()
  if (!q) return
  clearTimeout(timer)
  lastQuery = q
  pending.value = true
  error.value = ''
  try {
    const r = await $fetch('/api/analyze', { method: 'POST', body: { title: q } })
    if (lastQuery === q) { result.value = r; error.value = '' }
  } catch (e: any) {
    // a 404 while typing is normal: only complain on an explicit search
    if (lastQuery !== q || (e?.statusCode === 404 && !explicit)) return
    error.value = e?.data?.message || e?.message || 'Something went wrong'
    result.value = null
  } finally {
    if (lastQuery === q) pending.value = false
  }
}

const nouls = computed(() => {
  const a = result.value?.answers ?? {}
  return [
    ['Isekai', a.has_isekai], ['Mecha', a.has_mecha], ['Romance', a.has_romance],
    ['Comedy', a.has_comedy], ['Supernatural', a.has_supernatural],
    ['School', a.has_school], ['Adaptation', a.is_adaptation],
  ].filter(([, v]) => v).map(([label, v]: any) => ({ label, value: v.noul })).sort((a, b) => b.value - a.value)
})

const ranked = (probs: Record<string, number> = {}, n = 5) =>
  Object.entries(probs).filter(([, p]) => p > 0.01).sort((a, b) => b[1] - a[1]).slice(0, n)

const COLORS: Record<string, string> = {
  black: '#111827',
  rich_black: '#0d0d0d',
  charcoal: '#374151',
  gray: '#6b7280',
  silver: '#cbd5e1',
  white: '#f8fafc',
  ivory: '#edeae3',
  cream: '#fef3c7',
  beige: '#e7d6b8',
  brown: '#8b5e3c',
  chestnut: '#6b3f2a',
  sepia: '#a97142',
  rust: '#b7410e',
  orange: '#f97316',
  tangerine: '#f28c28',
  amber: '#f59e0b',
  gold: '#d4af37',
  yellow: '#facc15',
  lime: '#a3e635',
  lime_green: '#8bea3a',
  green: '#22c55e',
  forest_green: '#166534',
  mint: '#6ee7b7',
  teal: '#14b8a6',
  cyan: '#22d3ee',
  sky_blue: '#7dd3fc',
  baby_blue: '#9ec9e2',
  blue: '#3b82f6',
  navy: '#1e3a8a',
  indigo: '#4f46e5',
  violet: '#8b5cf6',
  purple: '#a21caf',
  royal_purple: '#5b2a86',
  lavender: '#c4b5fd',
  magenta: '#ec4899',
  pink: '#f9a8d4',
  baby_pink: '#ffd1dc',
  maroon: '#7f1d1d',
  red: '#ef4444',
  crimson: '#c8102e',
}

// fallback mono ramp, usada até o Jev devolver a paleta do anime
const STEPS = ['#171717', '#525252', '#737373', '#a3a3a3', '#d4d4d4']
const tiles = (entries: [string, number][]) =>
  entries.map(([name, value], i) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value,
    color: tileColors.value[i % tileColors.value.length],
  }))

const NOUL_KEYS = ['has_isekai', 'has_mecha', 'has_romance', 'has_comedy', 'has_supernatural', 'has_school', 'is_adaptation']
const openSpec = ref('')
const spec = (keys: string[]) =>
  JSON.stringify(Object.fromEntries(keys.map(k => [k, (QUESTIONS as any)[k]])), null, 2)

// tooltip instantâneo do Unovis, no lugar do <title> nativo
const tileTooltip = {
  [Treemap.selectors.tile]: (n: any) =>
    `<span class="font-medium">${n.data?.key ?? ''}</span> · ${Math.round((n.value ?? 0) * 100)}%`,
}

const palette = computed(() => {
  const top = ranked(result.value?.answers?.palette?.probabilities, 10)
  const sum = top.reduce((a, [, p]) => a + p, 0) || 1
  return top.map(([name, p]) => [name, p, p / sum] as [string, number, number])
})

// fundo da página: a 2ª cor do anime, bem lavada
const tint = computed(() => COLORS[palette.value[1]?.[0] as string] ?? null)
// cor primária do anime, usada no título
const primary = computed(() => COLORS[palette.value[0]?.[0] as string] ?? null)

// os tiles usam as cores que o Jev viu no anime
const tileColors = computed(() => {
  const c = palette.value.map(([name]) => COLORS[name]).filter(Boolean)
  return c.length ? c : STEPS
})

</script>

<template>
  <UApp>
    <div class="tinted min-h-screen text-neutral-900 dark:text-neutral-100 transition-colors duration-700"
      :style="{ ...(tint ? { '--tint': tint } : {}), ...(primary ? { '--primary': primary } : {}) }">
      <div class="max-w-4xl mx-auto px-6 py-20 space-y-16">
        <header class="space-y-6">
          <h1 class="title-tint text-center text-4xl sm:text-5xl font-bold tracking-tighter transition-colors duration-700">
            JEV Anime Stats
          </h1>
          <form @submit.prevent="analyze(true)">
            <UInput
              v-model="title" variant="none" size="xl" autofocus
              :loading="pending" placeholder="Type an anime title…"
              class="w-full"
              :ui="{ base: 'px-0 text-3xl sm:text-4xl font-light placeholder:text-neutral-300 dark:placeholder:text-neutral-700' }"
            />
            <div class="h-px bg-neutral-200 dark:bg-neutral-800 mt-2" />
          </form>
          <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        </header>

        <!-- skeleton while Jev thinks -->
        <div v-if="pending && !result" class="space-y-16">
          <div class="space-y-3">
            <USkeleton class="h-6 w-1/3" />
            <USkeleton class="h-3 w-2/3" />
            <USkeleton class="h-2 w-full mt-6" />
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-12">
            <div v-for="i in 3" :key="i" class="space-y-3">
              <USkeleton class="h-3 w-20" />
              <USkeleton class="h-7 w-2/3" />
              <USkeleton class="aspect-4/3 w-full" />
            </div>
          </div>
        </div>

        <Transition name="pop">
          <div v-if="result" :key="result.anime.title" class="space-y-16" :class="pending && 'opacity-40'">
            <section class="space-y-5">
              <div class="flex gap-6 items-start">
                <img v-if="result.anime.image" :src="result.anime.image" :alt="result.anime.title"
                  class="w-20 rounded-sm object-cover shrink-0">
                <div class="space-y-2 min-w-0">
                  <a :href="result.anime.url" target="_blank"
                    class="title-tint text-2xl font-semibold tracking-tight hover:underline underline-offset-4 transition-colors duration-700">
                    {{ result.anime.title }}
                  </a>
                  <p class="text-xs uppercase tracking-widest text-neutral-400">
                    {{ [result.anime.type, result.anime.year, result.anime.episodes ? `${result.anime.episodes} eps` : null].filter(Boolean).join(' · ') }}
                  </p>
                  <p class="text-sm leading-relaxed text-neutral-500 line-clamp-3">{{ result.anime.synopsis }}</p>
                </div>
              </div>

              <div class="flex h-3 rounded-full overflow-hidden">
                <div
                  v-for="[name, p, share] in palette" :key="name"
                  class="transition-all duration-700 ease-out"
                  :title="`${name.replace(/_/g, ' ')} ${Math.round(p * 100)}%`"
                  :style="{ flex: `${share} 0 0`, background: COLORS[name] }"
                />
              </div>
            </section>

            <section class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 sm:gap-x-12 gap-y-12">
              <div v-for="q in ['primary_genre', 'demographic']" :key="q" class="space-y-4">
                <div class="flex items-center gap-2">
                  <p class="text-xs uppercase tracking-widest text-neutral-400">
                    {{ q === 'primary_genre' ? 'Primary genre' : 'Demographic' }}
                  </p>
                  <button type="button" class="font-mono text-xs text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                    :title="`Show the ${q} question`" @click="openSpec = openSpec === q ? '' : q">&lt;/&gt;</button>
                </div>
                <pre v-if="openSpec === q" class="text-[10px] leading-relaxed font-mono bg-neutral-50 dark:bg-neutral-900 p-3 rounded-sm overflow-auto max-h-64 text-neutral-500">{{ spec([q]) }}</pre>
                <ClientOnly>
                  <div class="treemap">
                  <VisSingleContainer :data="tiles(ranked(result.answers[q].probabilities))" :height="170">
                    <VisTreemap
                      :value="(d: any) => d.value"
                      :layers="[(d: any) => d.name]"
                      :tile-color="(n: any) => n.data?.datum?.color ?? '#171717'"
                      :tile-label="(n: any) => `${n.data?.key ?? ''}`"
                      :label-fit="'wrap'"
                      :label-offset-x="6"
                      :label-offset-y="6"
                      :tile-padding="2"
                      :tile-border-radius="3"
                      :enable-tile-label-font-size-variation="true"
                      :tile-label-small-font-size="11"
                      :tile-label-medium-font-size="11"
                      :tile-label-large-font-size="26"
                    />
                    <VisTooltip :triggers="tileTooltip" />
                  </VisSingleContainer>
                  </div>
                  <template #fallback><div class="h-[170px]" /></template>
                </ClientOnly>
                <p class="text-xs text-neutral-400 font-mono">{{ Math.round(result.answers[q].confidence * 100) }}% confidence</p>
              </div>

              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <p class="text-xs uppercase tracking-widest text-neutral-400">Has it?</p>
                  <button type="button" class="font-mono text-xs text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                    title="Show the noul questions" @click="openSpec = openSpec === 'nouls' ? '' : 'nouls'">&lt;/&gt;</button>
                </div>
                <pre v-if="openSpec === 'nouls'" class="text-[10px] leading-relaxed font-mono bg-neutral-50 dark:bg-neutral-900 p-3 rounded-sm overflow-auto max-h-64 text-neutral-500">{{ spec(NOUL_KEYS) }}</pre>
                <ClientOnly>
                  <div class="treemap">
                  <VisSingleContainer :data="tiles(nouls.map(n => [n.label, n.value]))" :height="170">
                    <VisTreemap
                      :value="(d: any) => d.value"
                      :layers="[(d: any) => d.name]"
                      :tile-color="(n: any) => n.data?.datum?.color ?? '#171717'"
                      :tile-label="(n: any) => `${n.data?.key ?? ''}`"
                      :label-fit="'wrap'"
                      :label-offset-x="6"
                      :label-offset-y="6"
                      :tile-padding="2"
                      :tile-border-radius="3"
                      :enable-tile-label-font-size-variation="true"
                      :tile-label-small-font-size="11"
                      :tile-label-medium-font-size="11"
                      :tile-label-large-font-size="26"
                    />
                    <VisTooltip :triggers="tileTooltip" />
                  </VisSingleContainer>
                  </div>
                  <template #fallback><div class="h-[170px]" /></template>
                </ClientOnly>
              </div>
            </section>

            <section class="space-y-4">
              <div class="flex items-center gap-2">
                <p class="text-xs uppercase tracking-widest text-neutral-400">Maturity</p>
                <button type="button" class="font-mono text-xs text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                  title="Show the maturity question" @click="openSpec = openSpec === 'maturity' ? '' : 'maturity'">&lt;/&gt;</button>
              </div>
              <pre v-if="openSpec === 'maturity'" class="text-[10px] leading-relaxed font-mono bg-neutral-50 dark:bg-neutral-900 p-3 rounded-sm overflow-auto max-h-64 text-neutral-500">{{ spec(['maturity']) }}</pre>
              <p class="text-2xl sm:text-3xl font-semibold tracking-tight">{{ MATURITY[Math.round(result.answers.maturity.score)] }}</p>
              <div class="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div class="h-2 rounded-full bg-neutral-900 dark:bg-neutral-100 transition-all duration-700 ease-out"
                  :style="{ width: `${(result.answers.maturity.score / 3) * 100}%` }" />
              </div>
              <div class="flex justify-between text-xs text-neutral-400">
                <span v-for="m in MATURITY" :key="m">{{ m }}</span>
              </div>
            </section>

          </div>
        </Transition>
        <footer class="pt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400 dark:text-neutral-600">
          <span>Built by <a href="https://github.com/daniel-dia" target="_blank" class="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100">Daniel Santos</a></span>
          <a href="https://github.com/daniel-dia/jev-anime-stats" target="_blank"
            class="inline-flex items-center gap-1.5 underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100">
            <UIcon name="i-simple-icons-github" class="size-3.5" />
            Source on GitHub
          </a>
          <span>Classified by <a href="https://typesafe.ai" target="_blank" class="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100">Jev</a> · data from <a href="https://anilist.co" target="_blank" class="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100">AniList</a></span>
        </footer>
      </div>
    </div>
  </UApp>
</template>
