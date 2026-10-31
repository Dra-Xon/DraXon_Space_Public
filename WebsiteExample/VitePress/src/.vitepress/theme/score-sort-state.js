import { computed, ref } from 'vue'
import records from '../score-sidebar.json'
import { isScoreVisible } from './hidden-score-state.js'
import { sortScoreSidebar } from '../score-sidebar.mjs'

export const gameScoreRecords = records.filter(record => !['pop', 'acg'].includes(record.category))
export const scoreSortMode = ref('title')
export const scoreSortReversed = ref(false)
export const sortedScoreItems = computed(() => sortScoreSidebar(gameScoreRecords.filter(isScoreVisible), scoreSortMode.value, scoreSortReversed.value))

export const otherSortMode = ref('title')
export const otherSortReversed = ref(false)
export const otherScoreRecords = records.filter(record => record.category === 'pop')
export const sortedOtherScoreItems = computed(() => sortScoreSidebar(otherScoreRecords.filter(isScoreVisible), otherSortMode.value, otherSortReversed.value))

export const animeSortMode = ref('title')
export const animeSortReversed = ref(false)
export const animeScoreRecords = records.filter(record => record.category === 'acg')
export const sortedAnimeScoreItems = computed(() => sortScoreSidebar(animeScoreRecords.filter(isScoreVisible), animeSortMode.value, animeSortReversed.value))

export function themeWithSortedScores(theme, items, otherItems = null, animeItems = null) {
  const sections = theme.sidebar?.['/Scores/']
  if (!sections?.[0]?.items?.[0]) return theme
  const section = sections[0]
  const groups = section.items.map((group, index) => index === 0 ? { ...group, items }
    : group.text === '分类2' && animeItems ? { ...group, items: animeItems.length ? animeItems : [{ text: '暂无项' }] }
    : group.text === '分类3' && otherItems ? { ...group, items: otherItems.length ? otherItems : [{ text: '暂无项' }] } : group)
  return {
    ...theme,
    sidebar: {
      ...theme.sidebar,
      '/Scores/': [{ ...section, items: groups }, ...sections.slice(1)]
    }
  }
}