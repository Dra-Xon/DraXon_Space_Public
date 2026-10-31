import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { encryptResources } from './encrypt-resources.mjs'

test('hard refresh with an unchanged active worker explicitly claims and renders without reloading', async () => {
  const bootstrap = fs.readFileSync(new URL('../resource-runtime/bootstrap.js', import.meta.url), 'utf8')
  const workerUrl = 'https://site.test/site/resource-sw.js'
  const status = { textContent: '' }
  let written = ''
  let claims = 0
  let versionChecks = 0
  const timers = new Set()
  const serviceWorker = { controller: null, register: async () => ({ active: {
    postMessage(message, ports) {
      assert.equal(message.type, 'resource-claim')
      claims++
      serviceWorker.controller = { scriptURL: workerUrl }
      // An old controller must not authorize entry to the new resource set.
      ports[0].receive({ data: { version: ++versionChecks === 1 ? 'old' : 'current' } })
    }
  } }) }
  class Channel {
    constructor() {
      this.port1 = { close() {}, onmessage: null }
      this.port2 = { receive: event => this.port1.onmessage(event) }
    }
  }
  try {
    await vm.runInNewContext(bootstrap, {
      navigator: { serviceWorker }, window: { isSecureContext: true }, URL, Date, MessageChannel: Channel, AbortSignal,
      setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timers.add(timer); return timer }, clearTimeout,
      fetch: async url => { assert.equal(url, '/site/index.html.page'); return new Response('<h1>Ready</h1>') },
      document: {
        currentScript: { src: 'https://site.test/site/resource-bootstrap.js', dataset: { resourceVersion: 'current', resourcePage: '/site/index.html.page' } },
        getElementById: () => status, open() {}, write(html) { written = html }, close() {}
      },
      location: { reload() { assert.fail('Must not reload after forced refresh') } }
    })
    assert.equal(claims, 2)
    assert.equal(written, '<h1>Ready</h1>')
    assert.equal(status.textContent, '')
  } finally { for (const timer of timers) clearTimeout(timer) }
})

for (const base of ['/', '/DraXon_Space_Public/']) test(`encrypted resources and worker round trip at ${base}`, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'encrypted-site-'))
  const publicRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'encrypted-public-'))
  try {
    const originals = { 'scores/YY/中文 space.pdf': Buffer.from('%PDF-1.7\nTest document'), 'images/a.jpg': Buffer.from([255, 216, 255, 10]), 'images/a.png': Buffer.from([137, 80, 78, 71]), 'images/a.svg': Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') }
    Object.assign(originals, { 'backgrounds/custom.webp': Buffer.from('webp'), 'illusts/data.unusual': Buffer.from('unknown type'), 'symbols/no-extension': Buffer.from('no extension'), 'images/example.html': Buffer.from('<p>Asset HTML</p>') })
    function populate() {
      for (const [name, data] of Object.entries(originals)) {
        fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
        fs.writeFileSync(path.join(root, name), data)
        fs.mkdirSync(path.dirname(path.join(publicRoot, name)), { recursive: true })
        fs.writeFileSync(path.join(publicRoot, name), data)
      }
      fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><h1>Original page</h1>')
      fs.mkdirSync(path.join(root, 'scores'), { recursive: true })
      fs.writeFileSync(path.join(root, 'scores/index.html'), '<h1>Score introduction</h1>')
      for (const name of ['pdfjs/web/viewer.html', 'pdfjs/icon.svg', 'fonts/sample.png', 'fonts/subsets/jiangcheng-jiexing-latin.woff2', 'fonts/subsets/jiangcheng-jiexing-site.woff2', 'fonts/subsets/jiangcheng-jiexing-extra-00.woff2']) {
        fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
        fs.writeFileSync(path.join(root, name), 'Must remain unchanged')
      }
    }
    populate()
    const config = encryptResources(root, base, publicRoot)
    assert.equal(fs.existsSync(path.join(root, 'resource-manifest.json')), false)
    for (const name of ['pdfjs/web/viewer.html', 'pdfjs/icon.svg', 'fonts/sample.png']) {
      assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), 'Must remain unchanged')
      assert.equal(config.assets[name], undefined)
      assert.equal(fs.existsSync(path.join(root, name + '.page')), false)
    }
    assert.equal(config.assets['illusts/data.unusual'].type, 'application/octet-stream')
    for (const name of Object.keys(originals)) assert.equal(fs.existsSync(path.join(root, name)), false)
    assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /resource-bootstrap/)
    const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    assert.equal((shell.match(/rel="preload"/g) || []).length, 2)
    for (const name of ['latin', 'site']) {
      assert.ok(shell.includes(`<link rel="preload" href="${base}fonts/subsets/jiangcheng-jiexing-${name}.woff2" as="font" type="font/woff2" crossorigin>`))
    }
    assert.ok(!shell.includes('extra-00.woff2'))
    assert.ok(shell.indexOf('rel="preload"') < shell.indexOf('<script'))
    const handlers = {}
    let downloads = 0
    const context = vm.createContext({
      crypto: webcrypto, Uint8Array, atob, URL, Headers, Response,
      fetch: async url => {
        downloads++
        const filename = path.join(root, decodeURIComponent(new URL(url).pathname.slice(base.length)))
        return fs.existsSync(filename) ? new Response(fs.readFileSync(filename)) : new Response('', { status: 404 })
      },
      self: { registration: { scope: 'https://site.test' + base }, location: { origin: 'https://site.test' }, addEventListener: (name, callback) => { handlers[name] = callback } }
    })
    vm.runInContext(fs.readFileSync(path.join(root, 'resource-sw.js'), 'utf8'), context)
    const request = async (name, range, mode = 'cors') => {
      let result
      handlers.fetch({ request: { method: 'GET', url: 'https://site.test' + base + encodeURI(name), mode, headers: new Headers(range ? { Range: range } : {}) }, respondWith: promise => { result = promise } })
      return result
    }
    for (const [name, data] of Object.entries(originals)) {
      const response = await request(name)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), data)
    }
    const partial = await request('scores/YY/中文 space.pdf', 'bytes=0-4')
    assert.equal(partial.status, 206)
    assert.equal(await partial.text(), '%PDF-')
    assert.equal((await request('scores/YY/中文 space.pdf', 'bytes=900-')).status, 416)
    const page = await request('', null, 'navigate')
    assert.match(page.headers.get('Content-Type'), /text\/html/)
    assert.match(await page.text(), /Original page/)
    assert.match(await (await request('Scores/', null, 'navigate')).text(), /Score introduction/)
    const asset = config.assets['images/a.png']
    const filename = path.join(root, asset.file)
    const corrupt = fs.readFileSync(filename)
    corrupt[0] ^= 1
    fs.writeFileSync(filename, corrupt)
    assert.equal((await request('images/a.png')).status, 502)
    populate()
    assert.deepEqual(encryptResources(root, base, publicRoot).assets, config.assets)
    assert.ok(downloads >= 7)
  } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(publicRoot, { recursive: true, force: true }) }
})
