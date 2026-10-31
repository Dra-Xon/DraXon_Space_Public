<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
const route = useRoute()
const present = ref(false)
const width = ref(280)
const handle = ref(null)
let drag = null
let frame = 0
let pendingWidth = 0
let originalWidth = ''
function clampWidth(value) {
  return Math.max(240, Math.min(Math.min(420, innerWidth * 0.45), value))
}
function apply(value) {
  width.value = clampWidth(value)
  document.documentElement.style.setProperty('--vp-sidebar-width', width.value + 'px')
}
function stop(commit = true) {
  cancelAnimationFrame(frame); frame = 0
  const previousDrag = drag
  drag = null
  if (previousDrag) {
    if (commit !== false) apply(pendingWidth)
    else width.value = previousDrag.width
    if (handle.value?.hasPointerCapture(previousDrag.id)) handle.value.releasePointerCapture(previousDrag.id)
  }
  document.documentElement.classList.remove('sidebar-resizing')
}
async function reset() {
  stop(false)
  if (originalWidth) document.documentElement.style.setProperty('--vp-sidebar-width', originalWidth)
  else document.documentElement.style.removeProperty('--vp-sidebar-width')
  await nextTick()
  const sidebar = document.querySelector('.VPSidebar')
  present.value = !!sidebar
  if (sidebar) width.value = sidebar.getBoundingClientRect().width
}
function start(event) {
  if (event.button !== 0) return
  drag = { id: event.pointerId, x: event.clientX, width: width.value }
  pendingWidth = width.value
  handle.value.setPointerCapture(event.pointerId)
  document.documentElement.classList.add('sidebar-resizing')
  event.preventDefault()
}
function move(event) {
  if (!drag || event.pointerId !== drag.id) return
  pendingWidth = drag.width + event.clientX - drag.x
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; width.value = clampWidth(pendingWidth) })
}
function end(event) {
  if (!drag || event.pointerId !== drag.id) return
  stop(event.type !== 'pointercancel')
}
function resize() { if (document.documentElement.style.getPropertyValue('--vp-sidebar-width') !== originalWidth) apply(width.value) }
watch(() => route.path, reset, { flush: 'post' })
onMounted(() => {
  originalWidth = document.documentElement.style.getPropertyValue('--vp-sidebar-width')
  reset()
  window.addEventListener('resize', resize)
  window.addEventListener('blur', stop)
})
onBeforeUnmount(() => {
  stop(false)
  if (originalWidth) document.documentElement.style.setProperty('--vp-sidebar-width', originalWidth)
  else document.documentElement.style.removeProperty('--vp-sidebar-width')
  window.removeEventListener('resize', resize)
  window.removeEventListener('blur', stop)
})
</script>
<template>
  <Teleport to="body">
    <div v-if="present" ref="handle" class="sidebar-resize-handle" :style="{ left: width - 4 + 'px' }"
      role="separator" aria-label="调整侧边栏宽度" aria-orientation="vertical" :aria-valuenow="Math.round(width)"
      aria-valuemin="240" aria-valuemax="420" tabindex="0" title="拖动调整侧栏宽度，双击恢复默认"
      @pointerdown="start" @pointermove="move" @pointerup="end" @pointercancel="end" @lostpointercapture="end"
      @dblclick="reset" @keydown.left.prevent="apply(width - 16)" @keydown.right.prevent="apply(width + 16)" />
  </Teleport>
</template>
<style>
.sidebar-resize-handle { display: none; }
@media (min-width: 960px) {
  .sidebar-resize-handle { display: block; position: fixed; top: var(--vp-nav-height, 64px); bottom: 0; width: 8px; z-index: 96; cursor: col-resize; touch-action: none; }
  body.sidebar-collapsed .sidebar-resize-handle { display: none; }
  .VPContent.has-sidebar { padding-left: var(--vp-sidebar-width) !important; }
}
html.sidebar-resizing .sidebar-resize-handle { background: var(--vp-c-brand-1); width: 3px; margin-left: 3px; box-shadow: 0 0 0 1px var(--vp-c-bg); }
html.sidebar-resizing, html.sidebar-resizing * { cursor: col-resize !important; user-select: none !important; }
.sidebar-resize-handle:hover, .sidebar-resize-handle:focus-visible { background: rgb(128 128 128 / 0.16); outline: none; }
.VPSidebarItem:not(.level-0) > .item > .link > .text { line-height: 1.3; padding-top: 7px; padding-bottom: 7px; }
.VPSidebarItem.level-1 + .VPSidebarItem.level-1::before {
  content: '';
  display: block;
  width: 60%;
  max-width: 150px;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(to right, var(--vp-c-text-3), transparent);
  opacity: 0.55;
  pointer-events: none;
}
</style>

