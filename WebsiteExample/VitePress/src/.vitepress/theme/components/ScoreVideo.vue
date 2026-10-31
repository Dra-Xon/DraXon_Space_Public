<script setup>
import { ref, watch } from 'vue'
const props = defineProps({ src: { type: String, default: '' } })
const failed = ref(false)
const loaded = ref(false)
watch(() => props.src, () => { failed.value = false; loaded.value = false })
</script>
<template>
  <iframe v-if="src && !failed" :src="src" data-score-resource="video" :data-resource-state="loaded ? 'ready' : 'pending'" title="项视频" scrolling="no" frameborder="0" allowfullscreen @load="loaded = true" @error="failed = true"></iframe>
  <div v-else class="score-video-missing" role="status">视频尚未发布！</div>
</template>
<style>
.bilibili-container { position: relative; }
.score-video-missing { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--vp-c-text-1); background: var(--content-glass-surface); backdrop-filter: blur(14px) saturate(1.15); border-radius: 8px; font-size: 18px; }
html:not(.dark) .score-video-missing { color: #fff; }
</style>
