<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
defineProps({ text: { type: String, required: true }, hintId: { type: String, required: true } })
const visible = ref(false)
const left = ref(0)
const top = ref(0)
const hide = () => { visible.value = false }
const position = (x, y) => {
  left.value = Math.max(8, Math.min(x + 14, window.innerWidth - 188))
  top.value = y + 52 > window.innerHeight ? Math.max(8, y - 48) : y + 14
}
const move = event => position(event.clientX, event.clientY)
const enter = event => { move(event); visible.value = true }
const focus = event => {
  const bounds = event.currentTarget.getBoundingClientRect()
  position(bounds.left, bounds.bottom)
  visible.value = true
}
onMounted(() => {
  window.addEventListener('scroll', hide, true)
  window.addEventListener('resize', hide)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', hide, true)
  window.removeEventListener('resize', hide)
})
</script>

<template>
  <span class="inline-hint" tabindex="0" :aria-describedby="visible ? hintId : undefined"
    @pointerenter="enter" @pointermove="move" @pointerleave="hide" @focus="focus" @blur="hide" @keydown.esc="hide"><slot /></span>
  <Teleport to="body">
    <Transition name="inline-hint-fade">
      <span v-if="visible" :id="hintId" role="tooltip" class="inline-hint-popup" :style="{ left: left + 'px', top: top + 'px' }">{{ text }}</span>
    </Transition>
  </Teleport>
</template>

<style>
.inline-hint { text-decoration: underline; text-underline-offset: 0.2em; text-shadow: 0 2px 4px rgba(0,0,0,.65), 0 4px 10px rgba(0,0,0,.45); cursor: help; }
.inline-hint:focus-visible { outline: 1px solid currentColor; outline-offset: 3px; border-radius: 3px; }
.inline-hint-popup { position: fixed; z-index: 1000; box-sizing: border-box; max-width: 180px; padding: 8px 12px; border: 1px solid rgba(30,45,65,.25); border-radius: 8px; background: rgba(255,255,255,.55); color: #222; backdrop-filter: blur(14px) saturate(1.15); -webkit-backdrop-filter: blur(14px) saturate(1.15); font-size: 14px; line-height: 1.5; box-shadow: 0 4px 16px rgba(0,0,0,.2); pointer-events: none; }
html.dark .inline-hint-popup { background: rgba(25,25,28,.55); color: #e5e7eb; border-color: rgba(220,230,245,.22); }
.inline-hint-fade-enter-active, .inline-hint-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.inline-hint-fade-enter-from, .inline-hint-fade-leave-to { opacity: 0; transform: translateY(3px); }
@media (prefers-reduced-motion: reduce) { .inline-hint-fade-enter-active, .inline-hint-fade-leave-active { transition: none; } }
</style>
