<script setup>
import { nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, withBase } from 'vitepress'
import { revealCurrentScore, sidebarRevealPadding } from '../scroll-current-score.js'
const collapsedStates = new WeakMap()
const route = useRoute()
let mounted = false
watch(() => route.path, path => {
  if (mounted && path.startsWith(withBase('/Scores/'))) revealSearchResult({ detail: path })
}, { flush: 'post' })
let observer
let preferred = null
let queued = false
let restoringFolds = false
let foldSnapshot = new Map()
const foldSelector = '.VPSidebar .VPSidebarItem.collapsible'
function foldKey(group) {
  const parts = []
  for (let node = group; node; node = node.parentElement?.closest('.VPSidebarItem')) {
    const heading = node.querySelector(':scope > .item')
    parts.unshift(heading?.querySelector('.text')?.textContent.trim() || '')
  }
  return JSON.stringify(parts)
}
function snapshotFolds() {
  restoringFolds = true
  foldSnapshot = new Map([...document.querySelectorAll(foldSelector)].map(group => [foldKey(group), group.classList.contains('collapsed')]))
}
async function restoreFolds() {
  await nextTick()
  for (const group of document.querySelectorAll(foldSelector)) {
    const collapsed = foldSnapshot.get(foldKey(group))
    if (collapsed !== undefined && collapsed !== group.classList.contains('collapsed')) group.querySelector(':scope > .item')?.click()
  }
  await nextTick()
  restoringFolds = false
  foldSnapshot.clear()
  schedule()
}
const selector = '.VPSidebar .level-0.is-link > .items > .level-1.collapsible:not(.is-link)'
function schedule() {
  if (queued || restoringFolds) return
  queued = true
  nextTick(() => {
    queued = false
    if (restoringFolds) return
    const groups = [...document.querySelectorAll(selector)]
    for (const group of groups) {
      const collapsed = group.classList.contains('collapsed')
      if (collapsedStates.get(group) === true && !collapsed) {
        nextTick(() => {
          if (group.isConnected && !group.classList.contains('collapsed')) {
            revealCurrentScore(group.querySelector(':scope > .items'))
          }
        })
      }
      collapsedStates.set(group, collapsed)
    }
    const expanded = groups.filter(group => !group.classList.contains('collapsed'))
    if (expanded.length < 2) return
    const keep = expanded.includes(preferred) ? preferred : expanded.find(group => group.classList.contains('has-active')) || expanded[0]
    for (const group of expanded) {
      if (group !== keep) group.querySelector(':scope > .item')?.click()
    }
  })
}
function remember(event) {
  if (!event.isTrusted) return
  const group = event.target instanceof Element ? event.target.closest('.VPSidebarItem.level-1.collapsible:not(.is-link)') : null
  if (!group?.matches(selector)) return
  const heading = group.querySelector(':scope > .item')
  if (heading?.contains(event.target)) preferred = group
}
async function revealSearchResult(event) {
  await nextTick()
  const normalize = path => decodeURIComponent(path).replace(/\.html$/, '').replace(/\/$/, '')
  const link = [...document.querySelectorAll('.VPSidebar a[href]')].find(anchor =>
    normalize(new URL(anchor.href, location.href).pathname) === normalize(event.detail))
  if (!link) return
  preferred = link.closest('.VPSidebarItem.level-1.collapsible:not(.is-link)')
  const ancestors = []
  for (let item = link.closest('.VPSidebarItem'); item; item = item.parentElement?.closest('.VPSidebarItem')) {
    if (item.classList.contains('collapsed')) ancestors.unshift(item)
  }
  for (const item of ancestors) {
    item.querySelector(':scope > .item')?.click()
    await nextTick()
  }
  await new Promise(resolve => requestAnimationFrame(resolve))
  const list = preferred?.querySelector(':scope > .items')
  revealCurrentScore(list)
  // Scroll a sidebar container only, so the page keeps its restored position.
  const row = link.closest('.item') || link
  for (let container = row.parentElement; container && container.closest('.VPSidebar'); container = container.parentElement) {
    if (container.scrollHeight <= container.clientHeight || !/auto|scroll/.test(getComputedStyle(container).overflowY)) continue
    const bounds = row.getBoundingClientRect()
    const viewport = container.getBoundingClientRect()
    if (bounds.top < viewport.top || bounds.bottom > viewport.bottom) {
      container.scrollTop += bounds.top < viewport.top
        ? bounds.top - viewport.top - sidebarRevealPadding
        : bounds.bottom - viewport.bottom + sidebarRevealPadding
    }
  }
}
async function expandCategory(event) {
  await nextTick()
  const groups = [...document.querySelectorAll(selector)]
  const target = groups.find(group => group.querySelector(':scope > .item .text')?.textContent.trim() === event.detail)
  if (!target) return
  preferred = target
  for (const group of groups) {
    if (group !== target && !group.classList.contains('collapsed')) group.querySelector(':scope > .item')?.click()
  }
  if (target.classList.contains('collapsed')) target.querySelector(':scope > .item')?.click()
  const mobileMenu = document.querySelector('.VPLocalNav .menu')
  if (window.matchMedia('(max-width: 959px)').matches && mobileMenu?.getAttribute('aria-expanded') === 'false') mobileMenu.click()
}
onMounted(() => {
  mounted = true
  document.addEventListener('click', remember, true)
  document.addEventListener('site-search-navigate', revealSearchResult)
  document.addEventListener('site-score-category', expandCategory)
  document.addEventListener('site-score-fold-snapshot', snapshotFolds)
  document.addEventListener('site-score-fold-restore', restoreFolds)
  observer = new MutationObserver(schedule)
  observer.observe(document.querySelector('.Layout') || document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['class']})
  schedule()
})
onBeforeUnmount(() => {
  mounted = false
  observer?.disconnect()
  document.removeEventListener('click', remember, true)
  document.removeEventListener('site-search-navigate', revealSearchResult)
  document.removeEventListener('site-score-category', expandCategory)
  document.removeEventListener('site-score-fold-snapshot', snapshotFolds)
  document.removeEventListener('site-score-fold-restore', restoreFolds)
})
</script>
