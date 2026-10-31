<script setup>
import { ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
const props = defineProps({ title: { type: String, required: true }, sectionId: { type: String, required: true }, defaultExpanded: { type: Boolean, default: true } })
const expanded = ref(props.defaultExpanded)
const button = ref(null)
const hovered = ref(false)
const section = ref(null)
const content = ref(null)
const glassRects = ref([])
const glassReady = ref(false)
let glassObserver
let disclosureObserver
const glassSelector = 'mjx-container[display="true"], .score-explanation, table:not(.video-info-table):not(.video-square-table)'
function syncGlass() {
  if (!section.value || !content.value) return
  if (content.value.style.display === 'none') {
    glassRects.value = []
    return
  }
  const origin = section.value.getBoundingClientRect()
  glassRects.value = [...content.value.querySelectorAll(glassSelector)].flatMap(element => {
    // Closed native details can retain descendant layout measurements.
    // Only draw glass for content whose disclosure ancestors are open.
    for (let ancestor = element.parentElement; ancestor && ancestor !== content.value; ancestor = ancestor.parentElement) {
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open) return []
    }
    const bounds = element.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return []
    return [{ left: `${bounds.left - origin.left}px`, top: `${bounds.top - origin.top}px`,
      width: `${bounds.width}px`, height: `${bounds.height}px` }]
  })
  glassReady.value = true
}
function clearGlass() {
  if (!expanded.value) glassRects.value = []
}
watch(expanded, async value => {
  if (value) { await nextTick(); syncGlass() }
})
let pointer = null
let hoverFrame = 0
function updateHover() {
  hoverFrame = 0
  if (!pointer || !button.value) { hovered.value = false; return }
  const rect = button.value.getBoundingClientRect()
  const inside = pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom
  const hit = inside ? document.elementFromPoint(pointer.x, pointer.y) : null
  hovered.value = !!hit && button.value.contains(hit)
}
function scheduleHover() {
  if (!hoverFrame) hoverFrame = requestAnimationFrame(updateHover)
}
function movePointer(event) {
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
  pointer = { x: event.clientX, y: event.clientY }
  scheduleHover()
}
function clearHover() { pointer = null; hovered.value = false }
async function openFromLink(event) {
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  const url = new URL(link.href, location.href)
  if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || url.hash !== '#' + props.sectionId) return
  event.preventDefault()
  event.stopPropagation()
  expanded.value = true
  await nextTick()
  // Let Vue apply v-show and the router finish its synchronous anchor handling.
  await new Promise(resolve => requestAnimationFrame(resolve))
  history.replaceState(history.state, '', url.hash)
  section.value?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
}
onMounted(() => {
  document.addEventListener('click', openFromLink, true)
  if (location.hash === '#' + props.sectionId) expanded.value = true
  glassObserver = new ResizeObserver(syncGlass)
  glassObserver.observe(section.value)
  glassObserver.observe(content.value)
  for (const element of content.value.querySelectorAll(glassSelector)) glassObserver.observe(element)
  disclosureObserver = new MutationObserver(syncGlass)
  disclosureObserver.observe(content.value, { subtree: true, attributes: true, attributeFilter: ['open'] })
  syncGlass()
  window.addEventListener('pointermove', movePointer, { passive: true })
  window.addEventListener('scroll', scheduleHover, { passive: true, capture: true })
  window.addEventListener('resize', scheduleHover, { passive: true })
  window.addEventListener('blur', clearHover)
  document.documentElement.addEventListener('pointerleave', clearHover)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', openFromLink, true)
  glassObserver?.disconnect()
  disclosureObserver?.disconnect()
  cancelAnimationFrame(hoverFrame)
  window.removeEventListener('pointermove', movePointer)
  window.removeEventListener('scroll', scheduleHover, true)
  window.removeEventListener('resize', scheduleHover)
  window.removeEventListener('blur', clearHover)
  document.documentElement.removeEventListener('pointerleave', clearHover)
})
</script>
<template>
  <section ref="section" class="score-section" :class="{ 'score-section-glass-ready': glassReady }">
    <div v-for="(rect, index) in glassRects" :key="index" class="score-section-glass" :style="rect" aria-hidden="true"></div>
    <h2 class="score-section-heading">
      <button ref="button" type="button" class="score-section-toggle" :class="{ hovered }" @pointerenter="movePointer" @pointerleave="clearHover" :aria-expanded="expanded" :aria-controls="sectionId" @click="expanded = !expanded">
        <span>{{ title }}</span>
        <svg class="score-section-caret" :class="{ collapsed: !expanded }" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg>
      </button>
    </h2>
    <Transition name="score-content-fade" @enter="syncGlass" @after-leave="clearGlass"><div ref="content" :id="sectionId" v-show="expanded" class="score-section-content"><slot /></div></Transition>
  </section>
</template>
<style scoped>
.score-section { position: relative; isolation: isolate; scroll-margin-top: 90px; }
.score-section-heading, .score-section-content { position: relative; z-index: 1; }
.score-section-glass { position: absolute; z-index: 0; border-radius: 12px; background: transparent; backdrop-filter: blur(14px) saturate(1.15); -webkit-backdrop-filter: blur(14px) saturate(1.15); pointer-events: none; }
.score-section-toggle { position: relative; isolation: isolate; display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: inherit; font: inherit; cursor: pointer; text-align: left; transition: box-shadow 100ms ease, border-color 100ms ease; }
.score-section-toggle::before { content: ''; position: absolute; inset: -1px; z-index: -1; pointer-events: none; border-radius: inherit; border: 1px solid rgba(255, 255, 255, 0.18); background: transparent; backdrop-filter: blur(14px) saturate(1.15); -webkit-backdrop-filter: blur(14px) saturate(1.15); box-shadow: 0 5px 22px rgba(0, 0, 0, 0.10), 0 0 8px rgba(255, 255, 255, 0.06); opacity: 0; transition: opacity 140ms ease-in; }
.score-section-toggle.hovered::before,
.score-section-toggle:focus-visible::before { opacity: 1; transition: opacity 160ms ease-out; }
@media (hover: none), (pointer: coarse) {
  .score-section-toggle::before { opacity: 1; }
}
.score-content-fade-enter-active { transition: opacity 160ms ease-out; }
.score-content-fade-leave-active { transition: opacity 140ms ease-in; pointer-events: none; }
.score-content-fade-enter-from,
.score-content-fade-leave-to { opacity: 0; }
.score-section-toggle:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 4px; border-radius: 4px; }
.score-section-caret { margin-left: auto; width: 20px; height: 20px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: transform 100ms ease; }
.score-section-caret.collapsed { transform: rotate(-90deg); }
@media (prefers-reduced-motion: reduce) { .score-section-caret, .score-section-toggle::before, .score-content-fade-enter-active, .score-content-fade-leave-active { transition: none !important; } }
</style>
