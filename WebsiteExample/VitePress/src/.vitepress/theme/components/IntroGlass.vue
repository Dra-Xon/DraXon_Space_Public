<script setup>
import { ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const rect = ref(null)
const glass = ref(null)
let target
let observer
let animation
let revision = 0
function sync() {
  if (!target) return
  const bounds = target.getBoundingClientRect()
  rect.value = { left: `${bounds.left + window.scrollX}px`, top: `${bounds.top + window.scrollY}px`, width: `${bounds.width}px`, height: `${bounds.height}px` }
}
async function locate() {
  const ticket = ++revision
  await nextTick()
  if (ticket !== revision) return
  observer?.disconnect()
  target?.classList.remove('intro-glass-external')
  // VitePress wraps rendered Markdown in an extra div inside .vp-doc.
  // Only the introduction lives outside the independently layered sections.
  target = [...document.querySelectorAll('.vp-doc .score-explanation')]
    .find(element => !element.closest('.score-section'))
  rect.value = null
  if (!target) return
  sync()
  observer = new ResizeObserver(sync)
  observer.observe(target)
  observer.observe(document.querySelector('.VPContent'))
  await nextTick()
  if (ticket === revision) target?.classList.add('intro-glass-external')
}
function fade(event) {
  event.detail.ready = prepareFade(event)
}
async function prepareFade(event) {
  if (event.detail.enter) await locate()
  if (!glass.value) return
  animation?.cancel()
  const { enter, duration } = event.detail
  const clear = { backdropFilter: 'blur(0px) saturate(1)', webkitBackdropFilter: 'blur(0px) saturate(1)' }
  const blurred = { backdropFilter: 'blur(14px) saturate(1.15)', webkitBackdropFilter: 'blur(14px) saturate(1.15)' }
  animation = glass.value.animate(enter ? [clear, blurred] : [blurred, clear],
    { duration, easing: enter ? 'ease-out' : 'ease-in', fill: 'forwards' })
}
onMounted(() => {
  locate()
  document.addEventListener('site-content-fade', fade)
  window.addEventListener('resize', sync)
})
watch(() => route.path, locate)
onBeforeUnmount(() => {
  ++revision
  observer?.disconnect()
  animation?.cancel()
  target?.classList.remove('intro-glass-external')
  document.removeEventListener('site-content-fade', fade)
  window.removeEventListener('resize', sync)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="rect" ref="glass" class="intro-glass" :style="rect" aria-hidden="true" />
  </Teleport>
</template>

<style>
.intro-glass { position: absolute; z-index: -1; pointer-events: none; border-radius: 12px; background: transparent; backdrop-filter: blur(14px) saturate(1.15); -webkit-backdrop-filter: blur(14px) saturate(1.15); }
.VPDoc .vp-doc .score-explanation.intro-glass-external { backdrop-filter: none; -webkit-backdrop-filter: none; }
</style>
