import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reflectAxis } from '../src/.vitepress/theme/card-collision.js'

test('only outward nonzero normal velocities rebound at the boundary', () => {
  assert.deepEqual(reflectAxis(-2, -100, 0, 400), { position: 0, velocity: 100, side: 'min' })
  assert.deepEqual(reflectAxis(400, 0.01, 0, 400), { position: 400, velocity: -0.01, side: 'max' })
  assert.equal(reflectAxis(0, 0, 0, 400).side, null)
  assert.equal(reflectAxis(0, 100, 0, 400).side, null)
  assert.equal(reflectAxis(200, -100, 0, 400).side, null)
  assert.deepEqual(reflectAxis(500, -100, 0, 400), { position: 400, velocity: -100, side: null })
  assert.deepEqual(reflectAxis(2, 100, 0, 0), { position: 0, velocity: 0, side: null })
})
