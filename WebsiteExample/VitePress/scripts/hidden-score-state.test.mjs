import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

test('refresh resets the egg, retaining only the initial hidden route until leaving', async () => {
  const bundle = await build({ stdin: { contents: "export * from './src/.vitepress/theme/hidden-score-state.js'; export { default as records } from './src/.vitepress/score-sidebar.json'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'node' })
  const state = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
  const hidden = state.records.find(record => record.visible === false)
  assert.ok(hidden)
  state.setHiddenScores(true, true)
  state.restoreHiddenScores('/DraXon_Space_Public/Scores/')
  assert.equal(state.hiddenUnlocked.value, false)
  assert.equal(state.showHiddenScores.value, false)
  assert.equal(state.isScoreVisible(hidden), false)
  const url = '/DraXon_Space_Public' + hidden.link.split('/').map(encodeURIComponent).join('/') + '.html'
  state.restoreHiddenScores(url)
  assert.equal(state.hiddenUnlocked.value, false)
  assert.equal(state.isScoreVisible(hidden), true)
  assert.equal(state.isScoreVisible({ visible: false, link: '/Scores/YY/another-hidden' }), false)
  state.updateHiddenScoreRoute(url + '#section')
  assert.equal(state.isScoreVisible(hidden), true)
  state.updateHiddenScoreRoute('/DraXon_Space_Public/Scores/')
  assert.equal(state.isScoreVisible(hidden), false)
  state.updateHiddenScoreRoute(url)
  assert.equal(state.isScoreVisible(hidden), false)
  state.setHiddenScores(true, true)
  assert.equal(state.isScoreVisible(hidden), true)
})
