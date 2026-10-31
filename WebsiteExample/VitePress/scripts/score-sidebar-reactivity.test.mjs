import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

test('changing sort mode updates the derived theme and cached sidebar', async () => {
  const bundle = await build({ stdin: { contents: "export * from './src/.vitepress/theme/score-sort-state.js'; export { computed, shallowRef, watch, nextTick } from 'vue'; export { setHiddenScores, showHiddenScores } from './src/.vitepress/theme/hidden-score-state.js'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'node' })
  const { scoreSortMode, scoreSortReversed, sortedScoreItems, gameScoreRecords, themeWithSortedScores, setHiddenScores, showHiddenScores, computed, shallowRef, watch, nextTick } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
  const original = {sidebar: {'/Scores/': [{text:'Section',items:[{text:'Tracks',collapsed:false,items:[]}]}]}}
  const theme = computed(() => themeWithSortedScores(original, sortedScoreItems.value))
  const sidebar = computed(() => theme.value.sidebar['/Scores/'])
  const rendered = shallowRef(sidebar.value)
  const stop = watch(sidebar, (next, prev) => { if(JSON.stringify(next)!==JSON.stringify(prev)) rendered.value=next })
  const list = () => rendered.value[0].items[0].items
  assert.ok(list().some(item=>item.items))
  const before = theme.value
  scoreSortMode.value='constant'
  await nextTick()
  assert.notEqual(theme.value,before)
  assert.equal(list().length,gameScoreRecords.filter(record => record.visible !== false).length)
  assert.ok(list().every(item=>item.link && !item.items))
  const metadata = JSON.parse(fs.readFileSync(new URL('../src/.vitepress/score-sidebar.json', import.meta.url)))
  const valid = new Set(metadata.filter(item=>item.constant != null).map(item=>item.link))
  const order=list().map(item=>item.link).filter(link=>valid.has(link))
  scoreSortReversed.value=true
  await nextTick()
  assert.deepEqual(list().map(item=>item.link).filter(link=>valid.has(link)),[...order].reverse())
  assert.deepEqual(original.sidebar['/Scores/'][0].items[0].items,[])
  setHiddenScores(true, true)
  await nextTick()
  assert.equal(showHiddenScores.value, true)
  assert.equal(list().length, gameScoreRecords.length)
  setHiddenScores(false)
  await nextTick()
  assert.equal(list().length, gameScoreRecords.filter(record => record.visible !== false).length)
  stop()
})