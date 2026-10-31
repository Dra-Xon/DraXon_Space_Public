<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import VPSwitch from '../../../../node_modules/vitepress/dist/client/theme-default/components/VPSwitch.vue'
import { hiddenUnlocked, showHiddenScores, setHiddenScores } from '../hidden-score-state.js'
const target = ref(null)
const numbers = ref([])
let numberId = 0
let observer
let clicks = 0
let lastClick = 0
function activate() {
  const now = Date.now()
  clicks = now - lastClick <= 1000 ? clicks + 1 : 1
  lastClick = now
  numbers.value.push({ id: ++numberId, value: 6 - clicks })
  if (clicks >= 5) {
    setHiddenScores(true, true)
    clicks = 0
    nextTick(() => document.dispatchEvent(new CustomEvent('site-score-category', { detail: '分类1' })))
  }
}
async function toggleUnpublished() {
  document.dispatchEvent(new CustomEvent('site-score-fold-snapshot'))
  setHiddenScores(!showHiddenScores.value)
  await nextTick()
  document.dispatchEvent(new CustomEvent('site-score-fold-restore'))
}
function removeNumber(id) { numbers.value = numbers.value.filter(number => number.id !== id) }
onMounted(() => {
  const locate = () => {
    const pager = document.querySelector('.VPDocFooter .prev-next .pager')
    if (target.value !== pager) target.value = pager
  }
  observer = new MutationObserver(locate)
  observer.observe(document.querySelector('.VPDoc') || document.body, { childList: true, subtree: true })
  locate()
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <Teleport v-if="target" :to="target">
    <div class="pager-link prev score-secret-control score-secret-button">
      <button v-if="!hiddenUnlocked" type="button" class="score-secret-trigger" title="5, 4, 3, 2, 1" @click="activate">这是什么？</button>
      <div v-else class="score-secret-switch-row">
        <span>你正在偷看未发布项！</span>
        <div class="score-secret-switch-line">
        <VPSwitch class="score-secret-switch" :aria-checked="showHiddenScores" aria-label="显示未发布项"
          :title="showHiddenScores ? '隐藏所有未发布项' : '显示所有未发布项'" @click="toggleUnpublished" />
        <span class="score-secret-switch-state" aria-hidden="true">{{ showHiddenScores ? 'ON' : 'OFF' }}</span>
        </div>
      </div>
      <span v-for="number in numbers" :key="number.id" class="score-secret-number" aria-hidden="true" @animationend="removeNumber(number.id)">{{ number.value }}</span>
    </div>
  </Teleport>
</template>
<style>
.VPDocFooter .score-secret-control { position: relative; box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 50%; height: 100%; min-height: 74px; padding: 0; border: 1px solid var(--vp-c-divider); border-radius: 8px; color: var(--vp-c-text-1); font-size: 14px; }
.score-secret-trigger { display: flex; align-items: center; justify-content: center; width: 100%; align-self: stretch; min-height: 72px; padding: 10px; border: 0; border-radius: inherit; background: transparent; color: inherit; cursor: pointer; font-family: inherit; font-size: 16px; line-height: 1.5; }
.score-secret-trigger:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.score-secret-switch-row { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 72px; padding: 10px; box-sizing: border-box; font-size: 14px; white-space: nowrap; }
.score-secret-switch[aria-checked="true"] .check { transform: translateX(18px); }
.score-secret-switch-state { width: 26px; font-size: 12px; color: var(--vp-c-text-2); }
.score-secret-number { position: absolute; top: 0; left: 50%; z-index: 5; pointer-events: none; color: var(--vp-c-brand-1); font-size: 26px; font-weight: 600; line-height: 1; animation: score-secret-float 700ms ease-out both; }
@keyframes score-secret-float { from { opacity: 1; transform: translate(-50%, -10px); } to { opacity: 0; transform: translate(-50%, -65px); } }
@media (prefers-reduced-motion: reduce) { .score-secret-number { animation-name: score-secret-fade; animation-duration: 300ms; } }
@keyframes score-secret-fade { from { opacity: 1; } to { opacity: 0; } }
.score-secret-switch-line { display: flex; align-items: center; justify-content: center; gap: 8px; }
html:not(.dark) .score-secret-number { color: #fff; }
</style>
