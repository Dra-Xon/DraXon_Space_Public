<script setup>
import { computed, ref, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { withBase } from 'vitepress'
const props = defineProps({ src: { type: String, default: '' }, title: { type: String, default: '' } })
const failed = ref(false)
const loaded = ref(false)
const image = ref(null)
const checkImage = () => {
  // Cached images may finish before hydration attaches the load listener.
  if (image.value?.complete) {
    loaded.value = image.value.naturalWidth > 0
    failed.value = !loaded.value
  }
}
onMounted(checkImage)
const dialog = ref(null)
const imageUrl = computed(() => /^https?:\/\//i.test(props.src) ? props.src : withBase(props.src))
watch(() => props.src, async () => {
  failed.value = false
  loaded.value = false
  dialog.value?.close()
  await nextTick()
  checkImage()
})
onBeforeUnmount(() => dialog.value?.close())
const open = () => dialog.value?.showModal()
const backdrop = event => {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.value.close()
}
</script>
<template>
  <button type="button" class="score-image-trigger" data-score-resource="image" :data-resource-state="failed || !src ? 'error' : loaded ? 'ready' : 'pending'" :aria-label="`放大查看：${title || '曲绘'}`" @click="open">
    <span v-if="failed || !src" class="score-image-fallback">图片尚未挂载，<br />或名称错误！</span>
    <img v-else ref="image" class="video-square-image" :src="imageUrl" :alt="`${title}图片`" @load="loaded = true" @error="failed = true" />
    <span class="score-image-zoom" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6M10 7v6M7 10h6" /></svg>
    </span>
  </button>
  <Teleport to="body">
    <dialog ref="dialog" class="score-image-dialog" :aria-label="`${title || '曲绘'}大图`" @click="backdrop">
      <button type="button" class="score-image-close" aria-label="关闭大图" autofocus @click="dialog.close()">×</button>
      <div v-if="failed || !src" class="score-image-dialog-fallback">图片尚未挂载，<br />或名称错误！</div>
      <img v-else class="score-image-large" :src="imageUrl" :alt="`${title}曲绘大图`" @error="failed = true" />
    </dialog>
  </Teleport>
</template>
<style scoped>
.score-image-trigger { position: relative; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; cursor: zoom-in; color: inherit; }
.score-image-trigger:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.score-image-fallback { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 120px; text-align: center; font-size: 14px; line-height: 1.7; color: var(--vp-c-text-2); }
:global(html:not(.dark) .score-image-fallback) { color: #fff; }
.score-image-zoom { position: absolute; top: 10px; left: 10px; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 7px; background: rgb(0 0 0 / 55%); color: white; opacity: 0; transition: opacity .18s ease; pointer-events: none; }
.score-image-zoom svg { width: 20px; height: 20px; }
.score-image-trigger:hover .score-image-zoom, .score-image-trigger:focus-visible .score-image-zoom { opacity: 1; }
.score-image-dialog { position: fixed; inset: 0; margin: auto; padding: 0; border: 0; border-radius: 12px; max-width: 92vw; max-height: 90dvh; overflow: auto; background: var(--vp-c-bg); color: var(--vp-c-text-1); box-shadow: 0 12px 60px rgb(0 0 0 / 40%); }
.score-image-dialog::backdrop { background: rgb(0 0 0 / 70%); }
.score-image-large { display: block; width: auto; height: auto; max-width: 92vw; max-height: 90dvh; object-fit: contain; }
.score-image-dialog-fallback { display: grid; place-content: center; width: min(70vw, 600px); height: min(70vw, 600px); min-width: 200px; min-height: 200px; text-align: center; line-height: 1.8; }
.score-image-close { position: absolute; z-index: 1; right: 10px; top: 10px; width: 34px; height: 34px; border-radius: 50%; background: rgb(0 0 0 / 65%); color: white; font-size: 26px; line-height: 1; cursor: pointer; }
@media (hover: none) { .score-image-zoom { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .score-image-zoom { transition: none; } }
</style>
