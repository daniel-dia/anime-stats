<script setup lang="ts">
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
  charcoal: '#374151',
  gray: '#6b7280',
  silver: '#cbd5e1',
  white: '#f8fafc',
  cream: '#fef3c7',
  beige: '#e7d6b8',
  brown: '#8b5e3c',
  chestnut: '#6b3f2a',
  sepia: '#a97142',
  rust: '#b7410e',
  orange: '#f97316',
  amber: '#f59e0b',
  gold: '#d4af37',
  yellow: '#facc15',
  lime: '#a3e635',
  green: '#22c55e',
  forest_green: '#166534',
  mint: '#6ee7b7',
  teal: '#14b8a6',
  cyan: '#22d3ee',
  sky_blue: '#7dd3fc',
  blue: '#3b82f6',
  navy: '#1e3a8a',
  indigo: '#4f46e5',
  violet: '#8b5cf6',
  purple: '#a21caf',
  lavender: '#c4b5fd',
  magenta: '#ec4899',
  pink: '#f9a8d4',
  maroon: '#7f1d1d',
  red: '#ef4444',
}

const palette = computed(() => ranked(result.value?.answers?.palette?.probabilities, 10))
</script>

<template>
  <UApp>
    <div class="min-h-screen bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/30 dark:to-neutral-950">
      <div class="max-w-5xl mx-auto px-4 py-12 space-y-8">
        <header class="text-center space-y-2">
          <h1 class="text-4xl font-bold tracking-tight">🍥 Anime Stat</h1>
          <p class="text-neutral-500">Start typing an anime title — Jev figures out the genre.</p>
        </header>

        <form class="flex gap-2 max-w-2xl mx-auto" @submit.prevent="analyze(true)">
          <UInput
            v-model="title" size="xl" class="flex-1" icon="i-lucide-search"
            :loading="pending" placeholder="Cowboy Bebop, Frieren, Evangelion..."
          />
          <UButton type="submit" size="xl" :loading="pending" :disabled="title.trim().length < 3">
            Analyze
          </UButton>
        </form>

        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" />

        <!-- skeleton while Jev thinks -->
        <div v-if="pending && !result" class="space-y-6">
          <UCard>
            <div class="flex gap-4">
              <USkeleton class="w-28 h-40 shrink-0 rounded-lg" />
              <div class="space-y-2 flex-1 py-1">
                <USkeleton class="h-6 w-1/2" />
                <USkeleton class="h-4 w-1/3" />
                <USkeleton class="h-3 w-full" />
                <USkeleton class="h-3 w-5/6" />
              </div>
            </div>
          </UCard>
          <div class="grid md:grid-cols-3 gap-4">
            <UCard v-for="i in 3" :key="i">
              <div class="space-y-3">
                <USkeleton class="h-8 w-2/3" />
                <USkeleton v-for="j in 4" :key="j" class="h-3 w-full" />
              </div>
            </UCard>
          </div>
        </div>

        <Transition name="pop">
          <div v-if="result" :key="result.anime.title" class="space-y-6" :class="pending && 'opacity-50'">
            <UCard>
              <div class="flex gap-4">
                <img v-if="result.anime.image" :src="result.anime.image" :alt="result.anime.title"
                  class="w-28 rounded-lg object-cover shrink-0">
                <div class="space-y-1 min-w-0">
                  <a :href="result.anime.url" target="_blank" class="text-xl font-semibold hover:underline">
                    {{ result.anime.title }}
                  </a>
                  <p class="text-sm text-neutral-500">
                    {{ [result.anime.type, result.anime.year, result.anime.episodes ? `${result.anime.episodes} eps` : null].filter(Boolean).join(' · ') }}
                  </p>
                  <p class="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-4">{{ result.anime.synopsis }}</p>
                </div>
              </div>
              <template #footer>
                <div class="flex h-4 rounded-full overflow-hidden ring-1 ring-black/5">
                  <div
                    v-for="[name, p] in palette" :key="name"
                    class="transition-all duration-700 ease-out" :title="`${name} ${Math.round(p * 100)}%`"
                    :style="{ width: `${p * 100}%`, background: COLORS[name] }"
                  />
                </div>
                <p class="mt-2 text-xs text-neutral-500 capitalize">
                  {{ palette.map(([n, p]) => `${n} ${Math.round(p * 100)}%`).join(' · ') }}
                </p>
              </template>
            </UCard>

            <div class="grid md:grid-cols-3 gap-4">
              <UCard v-for="q in ['primary_genre', 'demographic']" :key="q">
                <template #header>
                  <span class="text-sm text-neutral-500">{{ q === 'primary_genre' ? 'Primary genre' : 'Demographic' }}</span>
                </template>
                <p class="text-2xl font-bold capitalize mb-3">{{ result.answers[q].choice.replace('_', ' ') }}</p>
                <div class="space-y-1.5">
                  <div v-for="[name, p] in ranked(result.answers[q].probabilities)" :key="name" class="text-xs">
                    <div class="flex justify-between capitalize">
                      <span>{{ name.replace('_', ' ') }}</span><span class="tabular-nums text-neutral-500">{{ Math.round(p * 100) }}%</span>
                    </div>
                    <UProgress :model-value="p * 100" size="xs" :ui="{ indicator: 'transition-all duration-700 ease-out' }" />
                  </div>
                </div>
                <template #footer>
                  <span class="text-xs text-neutral-500">confidence {{ Math.round(result.answers[q].confidence * 100) }}%</span>
                </template>
              </UCard>

              <UCard>
                <template #header><span class="text-sm text-neutral-500">Has it?</span></template>
                <div class="space-y-1.5">
                  <div v-for="n in nouls" :key="n.label" class="text-xs">
                    <div class="flex justify-between">
                      <span>{{ n.value >= 0.5 ? '✓' : '✗' }} {{ n.label }}</span>
                      <span class="tabular-nums text-neutral-500">{{ Math.round(n.value * 100) }}%</span>
                    </div>
                    <UProgress :model-value="n.value * 100" size="xs"
                      :color="n.value >= 0.5 ? 'primary' : 'neutral'"
                      :ui="{ indicator: 'transition-all duration-700 ease-out' }" />
                  </div>
                </div>
              </UCard>
            </div>

            <UCard>
              <template #header><span class="text-sm text-neutral-500">Maturity</span></template>
              <p class="text-2xl font-bold mb-3">{{ MATURITY[Math.round(result.answers.maturity.score)] }}</p>
              <UProgress :model-value="(result.answers.maturity.score / 3) * 100"
                :ui="{ indicator: 'transition-all duration-700 ease-out' }" />
            </UCard>

            <p class="text-center text-xs text-neutral-400">{{ result.model }} · data from AniList</p>
          </div>
        </Transition>
      </div>
    </div>
  </UApp>
</template>
