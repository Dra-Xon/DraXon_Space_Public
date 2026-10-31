<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { usePrevNext } from '../../../../node_modules/vitepress/dist/client/theme-default/composables/prev-next.js'
import VPLink from '../../../../node_modules/vitepress/dist/client/theme-default/components/VPLink.vue'
defineProps({ side: { type: String, required: true } })
const control = usePrevNext()
const slot = ref(null)
const glassRect = ref(null)
let observer
let stopped = false
const syncGlass = () => {
  const link = slot.value?.querySelector('.title-pager-link')
  if (!link) { glassRect.value = null; return }
  const box = link.getBoundingClientRect()
  glassRect.value = { left: `${box.left + window.scrollX}px`, top: `${box.top + window.scrollY}px`, width: `${box.width}px`, height: `${box.height}px` }
}
watch(control, async () => { await nextTick(); if (!stopped) syncGlass() }, { deep: true, flush: 'post' })
onMounted(() => {
  const row = slot.value?.closest('.page-title-row')
  const heading = row?.querySelector('h1')
  if (!heading) return
  const sync = () => {
    row.style.setProperty('--title-card-size', heading.getBoundingClientRect().height + 'px')
    syncGlass()
  }
  observer = new ResizeObserver(sync)
  observer.observe(heading)
  observer.observe(row)
  window.addEventListener('resize', syncGlass)
  sync()
})
onBeforeUnmount(() => { stopped = true; observer?.disconnect(); window.removeEventListener('resize', syncGlass) })
</script>
<template>
  <span ref="slot" class="title-pager-slot" :class="side">
    <VPLink :no-icon="true" v-if="control[side]?.link" class="title-pager-link no-icon" :class="{ 'title-pager-glass-ready': glassRect }"
      :href="control[side].link" :title="control[side].text"
      :aria-label="`${side === 'prev' ? '上一页' : '下一页'}：${control[side].text || ''}`">
      <svg class="title-pager-arrow" :class="side" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg>
    </VPLink>
  </span>
  <Teleport to="body"><div v-if="glassRect" class="title-pager-glass" :style="glassRect" aria-hidden="true" /></Teleport>
</template>
<style scoped>
.title-pager-slot { display: flex; align-items: center; }
.title-pager-glass { position: absolute; z-index: -1; pointer-events: none; border-radius: 8px; backdrop-filter: blur(14px) saturate(1.15); -webkit-backdrop-filter: blur(14px) saturate(1.15); }
.title-pager-link.title-pager-glass-ready { backdrop-filter: none; -webkit-backdrop-filter: none; }
.title-pager-slot.next { justify-content: flex-end; }
.title-pager-link { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: var(--title-card-size, 42px); height: var(--title-card-size, 42px); flex-shrink: 0; padding: 0; border: 1px solid var(--vp-c-divider); border-radius: 8px; font-size: 22px; line-height: 1; text-decoration: none !important; color: var(--vp-c-brand-1) !important; }
.title-pager-link:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.title-pager-arrow { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.title-pager-arrow.prev { transform: rotate(90deg); }
.title-pager-arrow.next { transform: rotate(-90deg); }
</style>
