<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useData, useRoute, useRouter } from 'vitepress'
import localSearchIndex from '@localSearchIndex'
import MiniSearch from 'minisearch'
import records from '../../score-sidebar.json'
import { showHiddenScores, temporaryHiddenLink, isScoreVisible } from '../hidden-score-state.js'
import { decodeHTML } from 'entities'

const { localeIndex, theme } = useData()
const router = useRouter()
const route = useRoute()
const root = ref(null)
const input = ref(null)
const query = ref('')
const open = ref(false)
const results = ref([])
const active = ref(-1)
const loading = ref(false)
const failed = ref(false)
const expanded = computed(() => open.value && !!query.value.trim())
let index = null
let indexLocale = null
let timer
let generation = 0

async function search(ticket) {
  loading.value = true
  failed.value = false
  try {
    const locale = localeIndex.value
    if (!index || indexLocale !== locale) {
      const data = await localSearchIndex[locale]?.()
      const options = theme.value.search?.options?.miniSearch
      const loaded = MiniSearch.loadJSON(data.default, {
        fields: ['title', 'titles', 'text'], storeFields: ['title', 'titles'],
        searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 4, text: 2, titles: 1 }, ...options?.searchOptions },
        ...options?.options
      })
      if (ticket !== generation) return
      index = loaded
      indexLocale = locale
    }
    if (ticket !== generation) return
    results.value = index.search(query.value.trim(), { fields: ['title'] }).filter(result => !records.some(record => !isScoreVisible(record) && decodeURI(result.id.split('#')[0]).endsWith(record.link + '.html'))).slice(0, 16).map(result => ({
      ...result,
      title: decodeHTML(result.title || ''),
      titles: (result.titles || []).map(title => decodeHTML(title))
    }))
  } catch (error) {
    if (ticket !== generation) return
    failed.value = true
    console.error('Search index failed to load:', error)
  } finally {
    if (ticket === generation) loading.value = false
  }
}

watch([query, localeIndex, showHiddenScores, temporaryHiddenLink], () => {
  clearTimeout(timer)
  const ticket = ++generation
  active.value = -1
  results.value = []
  failed.value = false
  loading.value = !!query.value.trim()
  if (loading.value) timer = setTimeout(() => search(ticket), 120)
})

function close() { open.value = false; active.value = -1 }
watch(() => route.path, close)
async function select(result) {
  close()
  input.value?.blur()
  await router.go(result.id)
  await nextTick()
  const target = new URL(result.id, location.href)
  if (target.pathname === route.path) {
    document.dispatchEvent(new CustomEvent('site-search-navigate', { detail: target.pathname }))
  }
}
async function move(direction) {
  open.value = true
  if (!results.value.length) return
  active.value = (active.value + direction + results.value.length) % results.value.length
  await nextTick()
  root.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
}
function keyboard(event) {
  const editing = event.target instanceof Element && (event.target.closest('input, textarea, select') || event.target.isContentEditable)
  if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') ||
      (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey)) {
    event.preventDefault()
    event.stopImmediatePropagation()
    open.value = true
    input.value?.focus()
  }
}
function outside(event) { if (!root.value?.contains(event.target)) close() }
onMounted(() => {
  document.addEventListener('keydown', keyboard, true)
  document.addEventListener('pointerdown', outside)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  generation++
  document.removeEventListener('keydown', keyboard, true)
  document.removeEventListener('pointerdown', outside)
})
</script>

<template>
  <div ref="root" class="VPNavBarSearch site-nav-search">
    <div class="site-search-anchor">
      <div class="DocSearch-Button site-search-field">
        <span class="vp-icon DocSearch-Search-Icon" aria-hidden="true"></span>
        <input ref="input" v-model="query" type="search" placeholder="搜索页面" aria-label="搜索页面"
          role="combobox" aria-autocomplete="list" :aria-expanded="expanded" aria-controls="site-search-results"
          :aria-activedescendant="expanded && active >= 0 ? `site-search-result-${active}` : undefined"
          autocomplete="off" @focus="open = true" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="!$event.isComposing && results.length && select(results[active >= 0 ? active : 0])"
          @keydown.esc.prevent="close" @keydown.tab="close" />
      </div>
      <div v-if="expanded" class="site-search-dropdown">
        <div v-if="loading" class="site-search-status" role="status">正在搜索…</div>
        <div v-else-if="failed" class="site-search-status" role="status">搜索加载失败，请重新输入。</div>
        <div v-else-if="!results.length" class="site-search-status" role="status">无法找到相关结果</div>
        <ul id="site-search-results" role="listbox" aria-label="搜索结果">
          <li v-for="(result, i) in results" :id="`site-search-result-${i}`" :key="result.id"
            role="option" :aria-selected="active === i" @pointermove="active = i" @mousedown.prevent @click="select(result)">
            <span class="site-search-title">{{ result.title }}</span>
            <span v-if="result.titles?.length" class="site-search-path">{{ result.titles.join(' › ') }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style>
.site-nav-search { display: flex; align-items: center; flex-grow: 1; min-width: 0; padding-left: 32px; }
.site-search-anchor { position: relative; }
.VPNav:has(.site-search-dropdown) { z-index: 102 !important; }
.site-search-field { display: flex; align-items: center; height: 40px; margin: 0; padding: 0 12px; gap: 10px; cursor: text; }
.site-search-field .DocSearch-Search-Icon { flex-shrink: 0; width: 16px; height: 16px; --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='currentColor' stroke-width='2' d='M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'/%3E%3C/svg%3E"); }
.site-search-field:focus-within { border-color: var(--vp-c-brand-1); }
.site-search-field input { width: 100%; min-width: 0; height: 100%; background: transparent; outline: none; color: var(--vp-c-text-1); font: inherit; font-size: 16px; }
.site-search-field input::placeholder { color: var(--vp-c-text-2); }
.site-search-dropdown { position: absolute; top: calc(100% + 8px); left: 0; width: 100%; max-height: min(480px, calc(100dvh - 100px)); overflow-y: auto; white-space: normal; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg); box-shadow: 0 12px 32px rgba(0,0,0,.2); }
.site-search-dropdown ul { margin: 0; padding: 6px; list-style: none; }
.site-search-dropdown li { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 6px; cursor: pointer; }
.site-search-dropdown li[aria-selected="true"] { background: var(--vp-c-default-soft); }
.site-search-title { font-size: 16px; color: var(--vp-c-text-1); }
.site-search-path { font-size: 12px; color: var(--vp-c-text-2); }
.site-search-status { padding: 16px; font-size: 14px; color: var(--vp-c-text-2); }
@media (min-width: 960px) {
  /* Anchor to the navbar instead of its sidebar-dependent content inset. */
  .VPNavBar .container > .content,
  .VPNavBar .content-body { position: static !important; }
  .VPNavBar .site-nav-search {
    position: absolute;
    left: calc(var(--vp-sidebar-width) + 32px);
    top: 0;
    height: var(--vp-nav-height);
    padding-left: 0;
    z-index: 3;
  }
}
@media (max-width: 959px) {
  .site-nav-search { padding-left: 12px; }
  .site-nav-search .DocSearch-Button { width: 140px !important; padding: 0 8px !important; }
  .site-nav-search .site-search-field input { font-size: 16px; }
  .site-search-dropdown { width: min(320px, calc(100vw - 32px)); left: auto; right: 0; }
}
</style>
