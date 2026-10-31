<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
const props = defineProps({ image: Boolean, video: Boolean, pdf: Boolean })
const root = ref(null)
const kinds = ['image', 'video', 'pdf']
const names = ['图片', '视频', '资源']
const states = ref(['pending', 'pending', 'pending'])
let observer
const update = () => {
  const page = root.value?.closest('.vp-doc')
  states.value = kinds.map(kind => !props[kind] ? 'missing'
    : page?.querySelector(`[data-score-resource="${kind}"]`)?.dataset.resourceState || 'error')
}
const label = (index) => `${names[index]}：${({ missing: index === 0 ? 'Contents 未配置资源' : '尚未发布', pending: '未正确挂载', error: '未正确挂载', ready: '已挂载' })[states.value[index]]}`
onMounted(() => {
  observer = new MutationObserver(update)
  const page = root.value.closest('.vp-doc')
  if (page) observer.observe(page, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-resource-state'] })
  update()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="root" class="score-resource-status" role="group" aria-label="资源状态，依次为图片、视频、PDF">
    <span v-for="(kind, index) in kinds" :key="kind" class="resource-light" :class="states[index]" :title="label(index)" :aria-label="label(index)" role="img" tabindex="0"></span>
  </div>
</template>

<style scoped>
.score-resource-status { display: flex; justify-content: flex-start; gap: 8px; margin: 22px 0 2px; }
.resource-light { display: block; width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: #ef5350; box-shadow: inset 0 1px 2px #ffffff55, 0 0 5px #ef535044; }
.resource-light.pending, .resource-light.error { background: #f5c542; box-shadow: inset 0 1px 2px #ffffff55, 0 0 5px #f5c54244; }
.resource-light.ready { background: #44c776; box-shadow: inset 0 1px 2px #ffffff55, 0 0 5px #44c77644; }
.resource-light:focus-visible { outline: 2px solid var(--vp-c-text-1); outline-offset: 3px; }
</style>
