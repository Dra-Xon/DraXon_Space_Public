<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { effectsEnabled } from '../effects.js'
import EffectsStar from './EffectsStar.vue'
const ready = ref(false)
function sync() { document.documentElement.classList.toggle('effects-disabled', !effectsEnabled.value) }
onMounted(() => { ready.value = true; sync() })
watch(effectsEnabled, () => { if (ready.value) sync() })
onBeforeUnmount(() => document.documentElement.classList.remove('effects-disabled'))
</script>
<template>
  <Teleport v-if="ready" to=".VPNavBar .appearance">
    <button class="effects-toggle" type="button" :aria-pressed="effectsEnabled"
      :title="effectsEnabled ? '关闭特效' : '开启特效'" :aria-label="effectsEnabled ? '关闭特效' : '开启特效'"
      @click="effectsEnabled = !effectsEnabled">
      <EffectsStar :size="22" :filled="effectsEnabled" class="effects-star" />
    </button>
  </Teleport>
</template>
<style>
.VPNavBar .appearance { display: flex; align-items: center; gap: 0; }
.VPNavBar .appearance::before { order: -2; margin-left: 6px !important; margin-right: 0 !important; }
.effects-toggle {
  order: -1;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  /* The final nav link contributes 12px; separator margin adds the other 6px. */
  width: 58px;
  height: 32px;
  padding: 0 18px;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--vp-c-text-1);
  font-family: Arial, sans-serif;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
}
.effects-star { display: block; width: 22px; height: 22px; }
.effects-toggle:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; border-radius: 4px; }
.effects-toggle[aria-pressed="false"] { opacity: 0.55; }
html.effects-disabled .home-profile-avatar-link::after { opacity: 0 !important; }
html.effects-disabled .home-profile:not(.home-profile--about) { cursor: default; touch-action: auto; }
</style>
