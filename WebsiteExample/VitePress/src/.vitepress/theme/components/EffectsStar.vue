<script setup>
defineProps({
  size: { type: [Number, String], default: 20 },
  filled: { type: Boolean, default: true }
})
</script>

<template>
  <svg viewBox="0 0 32 32" :width="size" :height="size" aria-hidden="true" class="effects-star-icon">
    <path d="M16 1C18 10 22 14 31 16C22 18 18 22 16 31C14 22 10 18 1 16C10 14 14 10 16 1Z"
      :fill="filled ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5" />
  </svg>
</template>

<style scoped>
.effects-star-icon { display: inline-block; vertical-align: -0.15em; flex-shrink: 0; }
</style>
