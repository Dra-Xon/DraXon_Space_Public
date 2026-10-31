<script setup>
const props = defineProps({ category: { type: String, required: true } })
const expandCategory = () => document.dispatchEvent(new CustomEvent('site-score-category', { detail: props.category }))
</script>

<template>
  <button type="button" class="score-category-link" @click="expandCategory">{{ category }}</button>
</template>

<style scoped>
.score-category-link { font: inherit; color: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 0.2em; transition: text-shadow 0.2s ease; }
.score-category-link:is(:hover, :focus-visible) { text-shadow: 0 2px 4px rgba(0,0,0,.65), 0 4px 10px rgba(0,0,0,.45); }
.score-category-link:focus-visible { outline: 1px solid currentColor; outline-offset: 3px; border-radius: 3px; }
</style>
