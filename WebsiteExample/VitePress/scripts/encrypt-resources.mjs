import fs from 'node:fs'
import path from 'node:path'
import { createCipheriv, createHash, createHmac } from 'node:crypto'
import { fileURLToPath } from 'node:url'

// Public client key: this raises the direct-download barrier, not access control.
const key = Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex')
const types = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' }
const encryptedFolders = new Set(['backgrounds', 'illusts', 'images', 'scores', 'symbols'])
function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(root, entry.name)
    return entry.isDirectory() ? walk(filename) : [filename]
  })
}
export function encryptResources(output, base, publicRoot = fileURLToPath(new URL('../src/public/', import.meta.url))) {
  const files = walk(output)
  // Select by public source ownership, not output directory: on Windows the
  // generated Scores pages share a directory with public/scores PDF assets.
  const sourceResources = new Set(walk(publicRoot).map(file => path.relative(publicRoot, file).split(path.sep).join('/'))
    .filter(relative => encryptedFolders.has(relative.split('/')[0])))
  const pageFiles = files.filter(file => {
    const relative = path.relative(output, file).split(path.sep).join('/')
    return file.endsWith('.html') && !relative.startsWith('pdfjs/') && !sourceResources.has(relative)
  })
  const assets = {}
  const encryptedDir = path.join(output, 'bin')
  fs.mkdirSync(encryptedDir, { recursive: true })
  for (const filename of files) {
    const relative = path.relative(output, filename).split(path.sep).join('/')
    if (!sourceResources.has(relative)) continue
    const type = types[path.extname(filename).toLowerCase()] || 'application/octet-stream'
    const plaintext = fs.readFileSync(filename)
    const digest = createHash('sha256').update(relative).update('\0').update(plaintext).digest()
    // Stable nonce for identical path/content; any content change changes it.
    const iv = createHmac('sha256', key).update(digest).digest().subarray(0, 12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])
    const name = createHash('sha256').update(ciphertext).digest('hex') + '.bin'
    fs.writeFileSync(path.join(encryptedDir, name), ciphertext)
    assets[relative] = { file: 'bin/' + name, iv: iv.toString('base64'), type, size: plaintext.length }
    fs.unlinkSync(filename)
  }
  const templateDir = new URL('../resource-runtime/', import.meta.url)
  const pages = Object.fromEntries(pageFiles.map(file => {
    const relative = path.relative(output, file).split(path.sep).join('/')
    return [relative.toLowerCase(), relative + '.page']
  }))
  const version = createHash('sha256').update(JSON.stringify({ base, assets, pages }))
    .update(fs.readFileSync(new URL('worker.js', templateDir)))
    .update(fs.readFileSync(new URL('bootstrap.js', templateDir))).digest('hex')
  const config = { base, key: key.toString('base64'), assets, pages, version }
  fs.writeFileSync(path.join(output, 'resource-sw.js'), 'const resourceConfig = ' + JSON.stringify(config) + ';\n' + fs.readFileSync(new URL('worker.js', templateDir), 'utf8'))
  fs.copyFileSync(new URL('bootstrap.js', templateDir), path.join(output, 'resource-bootstrap.js'))
  fs.rmSync(path.join(output, 'resource-manifest.json'), { force: true })
  // Start only the two commonly used subsets while the worker initializes.
  const fontPreloads = ['latin', 'site'].map(name => `fonts/subsets/jiangcheng-jiexing-${name}.woff2`)
    .filter(relative => fs.existsSync(path.join(output, relative)))
    .map(relative => `<link rel="preload" href="${base}${relative}" as="font" type="font/woff2" crossorigin>`).join('')
  for (const filename of pageFiles) {
    const html = fs.readFileSync(filename, 'utf8')
    const pageUrl = base + path.relative(output, filename).split(path.sep).map(encodeURIComponent).join('/') + '.page'
    fs.writeFileSync(filename + '.page', html)
    fs.writeFileSync(filename, `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正在初始化 · 示例网站</title>${fontPreloads}<script defer src="${base}resource-bootstrap.js" data-resource-version="${version}" data-resource-page="${pageUrl}"></script></head><body style="margin:0;background:#090e1a;color:#fff;font:16px system-ui;display:grid;place-content:center;min-height:100vh"><p id="resource-status" role="status">正在初始化资源，请稍候……</p><noscript>请启用 JavaScript 后访问本站。</noscript></body></html>\n`)
  }
  console.log(`Encrypted ${Object.keys(assets).length} individual resources; original public files removed.`)
  return config
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  encryptResources(path.resolve(process.argv[2]), process.argv[3] || '/')
}
