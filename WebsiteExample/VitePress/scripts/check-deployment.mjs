import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { getDeployment } from '../deployment.mjs'

// Check the built files over HTTP, including a directly loaded nested page.
const metadata = JSON.parse(fs.readFileSync(new URL('../../Web/deployment.json', import.meta.url), 'utf8'))
assert.deepEqual(metadata, getDeployment(metadata.mode))
const cname = new URL('../../Web/CNAME', import.meta.url)
if (metadata.domain) assert.equal(fs.readFileSync(cname, 'utf8'), metadata.domain + '\n')
else assert.equal(fs.existsSync(cname), false)
const port = process.argv[2] || '4175'
const server = spawn(process.execPath, ['scripts/preview-docs.mjs', '--port', port], { stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
server.stdout.on('data', data => { output += data })
server.stderr.on('data', data => { output += data })
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview timeout: ' + output)), 15000)
    server.once('exit', code => { clearTimeout(timer); reject(new Error('Preview exited: ' + code + ' ' + output)) })
    server.stdout.on('data', () => { if (output.includes('Local:')) { clearTimeout(timer); resolve() } })
  })
  const root = 'http://localhost:' + port
  const workerResponse = await fetch(root + metadata.base + 'resource-sw.js')
  assert.equal(workerResponse.status, 200)
  const workerSource = await workerResponse.text()
  const configLine = workerSource.split('\n', 1)[0]
  assert.ok(configLine.startsWith('const resourceConfig = ') && configLine.endsWith(';'))
  const manifest = JSON.parse(configLine.slice('const resourceConfig = '.length, -1))
  // HTTP checks have no worker; verify encrypted responses separately from HTML shells.
  async function resource(url) {
    const relative = decodeURIComponent(new URL(url, root).pathname.slice(metadata.base.length))
    const asset = manifest.assets[relative]
    if (!asset) return fetch(new URL(url, root))
    const response = await fetch(root + metadata.base + asset.file)
    assert.equal(response.status, 200, asset.file)
    return new Response(await response.arrayBuffer(), { headers: { 'Content-Type': 'application/octet-stream' } })
  }
  const urls = new Set()
  for (const page of ['', 'Scores/', 'Scores/YY/Example_Master.html', 'Scores/ACG/Example%20Anime.html', 'about.html']) {
    const response = await fetch(root + metadata.base + page)
    assert.equal(response.status, 200, page)
    assert.ok((await response.text()).includes('resource-bootstrap.js'), 'Initialization shell: ' + page)
    const filename = page === '' ? 'index.html' : page.endsWith('/') ? page + 'index.html' : page
    const content = await fetch(root + metadata.base + manifest.pages[decodeURIComponent(filename).toLowerCase()])
    assert.equal(content.status, 200, filename)
    const html = await content.text()
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = match[1]
      if (!url.startsWith('/') || url.startsWith('//')) continue
      assert.ok(url.startsWith(metadata.base), 'Wrong base: ' + url)
      if (/assets|images|backgrounds|vp-icons/.test(url)) urls.add(url)
    }
    if (page === 'Scores/') assert.ok(html.includes('href="' + metadata.base + 'about.html"'), 'Score introduction author link')
  }
  for (const resource of ['pdfjs/web/viewer.html', 'scores/YY/Example_Master.pdf']) urls.add(metadata.base + resource)
  for (const url of urls) {
    const response = await resource(url)
    assert.equal(response.status, 200, url)
    if (/\.(js|css|jpg|pdf)$/.test(url)) assert.ok(!response.headers.get('content-type').includes('text/html'), url)
  }
  const css = [...urls].find(url => /assets\/style.*\.css/.test(url))
  const text = await (await fetch(root + css)).text()
  for (const match of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    if (/^(?:data:|#|%23)/i.test(match[1])) continue
    const response = await resource(new URL(match[1], root + css).href)
    assert.equal(response.status, 200, match[1])
  }
  console.log(metadata.mode + ': pages, ' + urls.size + ' resources, CSS fonts/symbols, and CNAME checks passed')
} finally {
  server.kill()
}
