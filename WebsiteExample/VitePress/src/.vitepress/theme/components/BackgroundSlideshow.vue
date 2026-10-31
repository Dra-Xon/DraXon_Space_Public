<template>
  <Teleport to="body">
    <div class="background-slideshow" aria-hidden="true">
      <img
        v-for="(image, index) in images"
        :key="image"
        class="background-slide"
        :class="{ active: index === currentIndex }"
        :src="image"
        alt=""
      />
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { backgroundRotationEnabled } from '../background-state.js'

const base = import.meta.env.BASE_URL
const { isDark } = useData()

const images = computed(() => backgroundRotationEnabled.value ? [
  `${base}backgrounds/PdTS_01.svg`,
  `${base}backgrounds/PdTS_02.svg`,
  `${base}backgrounds/PdTS_03.svg`
] : [`${base}backgrounds/Example_${isDark.value ? 'Dark' : 'Light'}_HD.svg`])

const interval = 10000
const currentIndex = ref(0)

let timer = null

function syncTimer() {
  clearInterval(timer)
  timer = null
  currentIndex.value = 0
  if (!backgroundRotationEnabled.value) return

  timer = setInterval(() => {
    currentIndex.value =
      (currentIndex.value + 1) % images.value.length
  }, interval)
}
onMounted(syncTimer)
watch(backgroundRotationEnabled, syncTimer, { flush: 'sync' })

onUnmounted(() => {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped>
.background-slideshow {
  position: fixed;
  inset: 0;

  width: 100vw;
  height: 100vh;

  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.background-slide {
  position: absolute;
  inset: 0;

  display: block;

  width: 100%;
  height: 100%;

  object-fit: cover;
  object-position: center center;
  filter: blur(1px);
  transform: scale(1.01);

  opacity: 0;
  transition: opacity 1500ms ease-in-out;
}

.background-slide.active {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .background-slide {
    transition: none;
  }
}
</style>
