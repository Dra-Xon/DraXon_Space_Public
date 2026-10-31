import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDeployment } from '../deployment.mjs'

test('deployment modes keep public base and custom domain consistent', () => {
  assert.deepEqual(getDeployment('custom'), { mode: 'custom', base: '/', domain: 'example.com' })
  assert.deepEqual(getDeployment('github'), { mode: 'github', base: '/website-example/', domain: null })
  assert.throws(() => getDeployment('unknown'), /Unknown deployment mode/)
  const copy = getDeployment('custom')
  copy.base = '/changed/'
  assert.equal(getDeployment('custom').base, '/')
})
