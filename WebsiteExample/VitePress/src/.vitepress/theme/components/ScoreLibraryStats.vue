<script setup>
import { computed } from 'vue'
import { isScoreVisible } from '../hidden-score-state.js'
import records from '../../score-sidebar.json'
const game = computed(() => records.filter(record => !['pop', 'acg'].includes(record.category)).filter(isScoreVisible).length)
const anime = computed(() => records.filter(record => record.category === 'acg').filter(isScoreVisible).length)
const pop = computed(() => records.filter(record => record.category === 'pop').filter(isScoreVisible).length)
</script>
<template>
  <p class="score-library-stats">分类统计：分类1 {{ game }} 项，分类2 {{ anime }} 项，分类3 {{ pop }} 项，共计 {{ game + anime + pop }} 项</p>
</template>
