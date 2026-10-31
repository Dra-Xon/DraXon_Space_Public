<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, withBase } from 'vitepress'
import { revealCurrentScore } from '../scroll-current-score.js'
import { sortedScoreItems as gameItems, scoreSortMode, scoreSortReversed, sortedOtherScoreItems, otherSortMode, otherSortReversed, otherScoreRecords, gameScoreRecords, animeSortMode, animeSortReversed, animeScoreRecords, sortedAnimeScoreItems } from '../score-sort-state.js'
const props = defineProps({ groupIndex: { type: Number, default: 0 } })
const mode = [scoreSortMode, animeSortMode, otherSortMode][props.groupIndex]
const reversed = [scoreSortReversed, animeSortReversed, otherSortReversed][props.groupIndex]
const sortedScoreItems = [gameItems, sortedAnimeScoreItems, sortedOtherScoreItems][props.groupIndex]
const records = [gameScoreRecords, animeScoreRecords, otherScoreRecords][props.groupIndex]
const menuId = 'score-sort-popup-' + props.groupIndex
const route = useRoute()
const target = ref(null)
const open = ref(false)
const control = ref(null)
const popup = ref(null)
const popupStyle = ref({})
function isAscending() { return mode.value === 'title' ? !reversed.value : reversed.value }
function toggleMenu() {
  const rect = control.value.getBoundingClientRect()
  popupStyle.value = { left: rect.left + 'px', top: rect.bottom + 4 + 'px' }
  open.value = !open.value
}
const options = [{ id: 'title', label: '首字排序' }, props.groupIndex === 0 ? { id: 'constant', label: '参数3排序' } : { id: 'level', label: '参数2排序' }, { id: 'total', label: '参数8排序' }, { id: 'bpm', label: '参数6排序' }]
let observer
function locate() {
  target.value = document.querySelectorAll('.VPSidebar .level-0.is-link > .items > .level-1.collapsible:not(.is-link)')[props.groupIndex] || null
  const sidebar = target.value?.closest('.VPSidebar')
  for (const previous of document.querySelectorAll('.VPSidebar.score-sidebar')) {
    if (previous !== sidebar) previous.classList.remove('score-sidebar')
  }
  if (sidebar && !sidebar.classList.contains('score-sidebar')) sidebar.classList.add('score-sidebar')
  const trackList = target.value?.querySelector(':scope > .items')
  if (trackList && !trackList.classList.contains('score-track-scroll')) trackList.classList.add('score-track-scroll')
  if (target.value?.classList.contains('collapsed')) open.value = false
  if (target.value && target.value.classList.contains('empty-track-group') !== (records.length === 0)) target.value.classList.toggle('empty-track-group', records.length === 0)
  const heading = target.value?.querySelector(':scope > .item')
  const links = target.value?.querySelectorAll(':scope > .items .VPSidebarItem > .item > a.link') || []
  if (heading) heading.title = `当前项数量：${links.length}`
  const numericFields = { constant: ['参数3', 'constantText'], level: ['参数2', 'level'], total: ['参数8', 'totalNotes'], bpm: ['BPM', 'bpm'] }
  for (const [index, link] of [...links].entries()) {
    let tooltip = `No.${String(index + 1).padStart(3, '0')}`
    const field = numericFields[mode.value]
    const record = records.find(record => {
      const path = new URL(withBase(record.link), location.origin).pathname
      return decodeURIComponent(path).replace(/\.html$/, '') === decodeURIComponent(new URL(link.href).pathname).replace(/\.html$/, '')
    })
    const item = link.closest('.VPSidebarItem')
    const hidden = record?.visible === false
    if (item && item.classList.contains('score-hidden-item') !== hidden) item.classList.toggle('score-hidden-item', hidden)
    if (hidden) tooltip += ' | 未发布项'
    if (field) {
      tooltip += ` | ${field[0]}：${record?.[field[1]] ?? (mode.value === 'constant' ? '/' : '未标注')}`
    }
    link.title = tooltip
  }
  for (const group of target.value?.querySelectorAll(':scope > .items .VPSidebarItem.collapsible') || []) {
    const children = [...group.querySelectorAll('a.link')]
    const allHidden = children.length > 0 && children.every(link => link.closest('.VPSidebarItem')?.classList.contains('score-hidden-item'))
    if (group.classList.contains('score-hidden-group') !== allHidden) group.classList.toggle('score-hidden-group', allHidden)
  }
}
let sortTicket = 0
let listAnimation = null
let animatedList = null
let requestedMode = mode.value
let requestedReversed = reversed.value
function cancelSortAnimation() {
  listAnimation?.cancel()
  listAnimation = null
  animatedList?.style.removeProperty('opacity')
  animatedList = null
}
async function choose(id) {
  if (requestedMode === id) requestedReversed = !requestedReversed
  else { requestedMode = id; requestedReversed = false }
  const nextMode = requestedMode
  const nextReversed = requestedReversed
  const ticket = ++sortTicket
  const currentList = target.value?.querySelector(':scope > .items')
  const opacity = currentList ? getComputedStyle(currentList).opacity : '1'
  cancelSortAnimation()
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (currentList && !reducedMotion) {
    animatedList = currentList
    listAnimation = currentList.animate([{ opacity }, { opacity: 0 }],
      { duration: 100, easing: 'ease-in', fill: 'forwards' })
    try { await listAnimation.finished } catch { return }
  }
  if (ticket !== sortTicket) return
  mode.value = nextMode
  reversed.value = nextReversed
  await nextTick()
  if (ticket !== sortTicket) return
  locate()
  cancelSortAnimation()
  const nextList = target.value?.querySelector(':scope > .items')
  revealCurrentScore(nextList)
  if (nextList && !reducedMotion) {
    animatedList = nextList
    listAnimation = nextList.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 100, easing: 'ease-out' })
    try { await listAnimation.finished } catch { return }
    if (ticket === sortTicket) cancelSortAnimation()
  }
}
watch(sortedScoreItems, () => nextTick(locate))
function dismiss(event) {
  if (control.value?.contains(event.target) || popup.value?.contains(event.target)) return
  const list = target.value?.querySelector(':scope > .items')
  if (list && (event.target === list || list.contains(event.target))) {
    const rect = list.getBoundingClientRect()
    const gutter = list.offsetWidth - list.clientWidth - list.clientLeft
    // Native scrollbar pointer events target the scrolling element.
    if (gutter > 0 && event.clientX >= rect.right - gutter && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom) return
  }
  open.value = false
}
function escape(event) {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    control.value?.querySelector('button')?.focus()
  }
}
watch(() => route.path, () => {
  ++sortTicket
  cancelSortAnimation()
  requestedMode = mode.value
  requestedReversed = reversed.value
  open.value = false
  nextTick(locate)
})
onMounted(() => {
  locate()
  observer = new MutationObserver(locate)
  observer.observe(document.querySelector('.Layout') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
  document.addEventListener('pointerdown', dismiss)
  document.addEventListener('keydown', escape)
})
onBeforeUnmount(() => {
  ++sortTicket
  cancelSortAnimation()
  observer?.disconnect()
  document.removeEventListener('pointerdown', dismiss)
  document.removeEventListener('keydown', escape)
})
</script>

<template>
  <Teleport v-if="target" :to="target">
    <div ref="control" class="score-sort-control" @click.stop>
      <button class="score-sort-button" type="button" :aria-expanded="open" :aria-controls="menuId"
        title="项排序"
        aria-label="项排序" @click="toggleMenu"><svg class="score-sort-icon" viewBox="0 0 30 24" aria-hidden="true"><path d="M3 5h13M3 12h10M3 19h7M23 3v18M19 7l4-4 4 4M19 17l4 4 4-4" /></svg></button>
      <Teleport to="body"><Transition name="score-sort-fade"><div v-if="open" ref="popup" :style="popupStyle" :id="menuId" class="score-sort-popup" role="group" aria-label="选择排序方式">
        <button v-for="option in options" :key="option.id" type="button" :aria-pressed="mode === option.id"
          @click="choose(option.id)">
          <span>{{ mode === option.id ? option.label.replace('排序', isAscending() ? '升序' : '降序') : option.label }}</span>
          <span v-if="mode === option.id" aria-hidden="true">{{ isAscending() ? '▲' : '▼' }}</span>
        </button>
      </div></Transition></Teleport>
    </div>
  </Teleport>
</template>

<style>
.VPSidebar .level-0.is-link > .items > .level-1.collapsible:not(.is-link) { position: relative; }
.score-sort-control { position: absolute; right: 4px; top: 3px; width: 52px; z-index: 5; }
.score-sort-button { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 38px; box-sizing: border-box; border: 1px solid #222; border-radius: 6px; color: var(--vp-c-text-1); cursor: pointer; }
html.dark .score-sort-button { border-color: #ddd; }
.score-sort-icon { display: block; width: 30px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.score-sort-button:hover { background: var(--vp-c-default-soft); }
.score-sort-button:focus-visible, .score-sort-popup button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.score-sort-popup { position: fixed; z-index: 3001; width: 148px; padding: 6px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg); box-shadow: 0 8px 24px #0003; }
.score-sort-popup button { display: flex; justify-content: space-between; width: 100%; padding: 5px 8px; border-radius: 5px; color: var(--vp-c-text-1); font-size: 14px; cursor: pointer; }
.score-sort-popup button:hover { background: var(--vp-c-default-soft); }
.score-sort-popup button[aria-pressed="true"] { background: var(--vp-c-brand-soft); }

.score-sort-fade-enter-active { transition: opacity 100ms ease-out; }
.score-sort-fade-leave-active { transition: none; pointer-events: none; }
.score-sort-fade-enter-from,
.score-sort-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .score-sort-fade-enter-active,
  .score-sort-fade-leave-active { transition: none; }
}

.VPSidebar .VPSidebarItem.collapsed > .score-sort-control {
  display: none;
}

.score-sort-popup button + button { margin-top: 6px; }
</style>
