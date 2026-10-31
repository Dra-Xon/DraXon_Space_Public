<script setup>
import { ref } from 'vue'
import VPSwitch from '../../../../node_modules/vitepress/dist/client/theme-default/components/VPSwitch.vue'
import { backgroundRotationUnlocked as hiddenUnlocked, backgroundRotationEnabled as showHiddenScores } from '../background-state.js'
const numbers = ref([])
let numberId = 0
let clicks = 0
let lastClick = 0
function activate() {
  const now = Date.now()
  clicks = now - lastClick <= 1000 ? clicks + 1 : 1
  lastClick = now
  numbers.value.push({ id: ++numberId, value: 6 - clicks })
  if (clicks >= 5) {
    hiddenUnlocked.value = true
    showHiddenScores.value = true
    clicks = 0
  }
}
function toggleUnpublished() {
  showHiddenScores.value = !showHiddenScores.value
}
function removeNumber(id) { numbers.value = numbers.value.filter(number => number.id !== id) }
</script>
<template>
    <div class="pager-link prev background-secret-control background-secret-button">
      <button v-if="!hiddenUnlocked" type="button" class="background-secret-trigger" title="5, 4, 3, 2, 1" @click="activate">这是什么？</button>
      <div v-else class="background-secret-switch-row">
        <span>开启背景轮换&nbsp;</span>
        <div class="background-secret-switch-line">
        <VPSwitch class="background-secret-switch" :aria-checked="showHiddenScores" aria-label="开启背景轮换"
          :title="showHiddenScores ? '关闭背景轮换' : '开启背景轮换'" @click="toggleUnpublished" />
        <span class="background-secret-switch-state" aria-hidden="true">{{ showHiddenScores ? 'ON' : 'OFF' }}</span>
        </div>
      </div>
      <span v-for="number in numbers" :key="number.id" class="background-secret-number" aria-hidden="true" @animationend="removeNumber(number.id)">{{ number.value }}</span>
    </div>
</template>
<style>
.background-secret-control { position: relative; box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 220px; max-width: 100%; min-height: 74px; margin-top: 24px; padding: 0; border: 1px solid transparent; border-radius: 8px; background: transparent; backdrop-filter: blur(14px) saturate(1.15); -webkit-backdrop-filter: blur(14px) saturate(1.15); color: var(--vp-c-text-1); font-size: 14px; transition: border-color .2s; }
.background-secret-control:hover { border-color: var(--vp-c-divider); }
html:not(.dark) .background-secret-control,
html:not(.dark) .background-secret-switch-state { color: #fff; }
.background-secret-trigger { display: flex; align-items: center; justify-content: center; width: 100%; align-self: stretch; min-height: 72px; padding: 10px; border: 0; border-radius: inherit; background: transparent; color: inherit; cursor: pointer; font-family: inherit; font-size: 16px; line-height: 1.5; }
.background-secret-trigger:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.background-secret-switch-row { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 72px; padding: 10px; box-sizing: border-box; font-size: 14px; white-space: nowrap; }
.background-secret-switch[aria-checked="true"] .check { transform: translateX(18px); }
.background-secret-switch-state { width: 26px; font-size: 12px; color: var(--vp-c-text-2); }
.background-secret-number { position: absolute; top: 0; left: 50%; z-index: 5; pointer-events: none; color: var(--vp-c-brand-1); font-size: 26px; font-weight: 600; line-height: 1; animation: background-secret-float 700ms ease-out both; }
@keyframes background-secret-float { from { opacity: 1; transform: translate(-50%, -10px); } to { opacity: 0; transform: translate(-50%, -65px); } }
@media (prefers-reduced-motion: reduce) { .background-secret-number { animation-name: background-secret-fade; animation-duration: 300ms; } }
@keyframes background-secret-fade { from { opacity: 1; } to { opacity: 0; } }
.background-secret-switch-line { display: flex; align-items: center; justify-content: center; gap: 8px; }
html:not(.dark) .background-secret-number { color: #fff; }
</style>
