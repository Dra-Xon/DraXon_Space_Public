import { ref } from 'vue'
import records from '../score-sidebar.json'
export const hiddenUnlocked = ref(false)
export const showHiddenScores = ref(false)
export const temporaryHiddenLink = ref(null)
const matchesRoute = (link, path) => {
  try {
    const pathname = decodeURIComponent(path.split(/[?#]/)[0]).replace(/\.html$/, '')
    return pathname.endsWith(link)
  } catch { return false }
}
export function restoreHiddenScores(path = '') {
  hiddenUnlocked.value = false
  showHiddenScores.value = false
  temporaryHiddenLink.value = records.find(record => record.visible === false && matchesRoute(record.link, path))?.link ?? null
  try { sessionStorage.removeItem('score-easter-egg') } catch {}
}
export function updateHiddenScoreRoute(path) {
  if (temporaryHiddenLink.value && !matchesRoute(temporaryHiddenLink.value, path)) temporaryHiddenLink.value = null
}
export function setHiddenScores(show, unlock = false) {
  if (unlock) hiddenUnlocked.value = true
  showHiddenScores.value = hiddenUnlocked.value && show
}
export const isScoreVisible = record => record.visible !== false || showHiddenScores.value || record.link === temporaryHiddenLink.value
