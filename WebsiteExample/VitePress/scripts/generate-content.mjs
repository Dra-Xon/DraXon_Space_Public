import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDeployment } from '../deployment.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = path.resolve(projectRoot, '..', 'Contents')
const siteRoot = path.join(projectRoot, 'src')
const publicRoot = path.join(siteRoot, 'public')
const configPath = path.join(siteRoot, '.vitepress', 'config.js')
const siteMetadataPath = path.join(contentRoot, 'site.md')
const footerSourcePath = path.join(contentRoot, 'footer.md')
const footerLines = fs.readFileSync(footerSourcePath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
const siteMetadata = parseSiteMetadata(siteMetadataPath)
updateVitePressConfig(configPath, siteMetadata)
const siteBase = getDeployment().base

const requiredFields = ['TITLE', 'ILLUSTS', 'PDF_TITLE']
// Brackets additionally need escaping as filenames: VitePress treats [x] as a dynamic route.
const fullwidthPunctuation = value => value.replace(/[:/\\?*"<>|\[\]#]/g, char => String.fromCharCode(char.charCodeAt(0) + 0xFEE0))
const pageFilename = value => fullwidthPunctuation(value.replace(/[ \t]*[(（][ \t]*[*＊][ \t]*[)）]/g, ''))
// VitePress matches routes with decodeURI, which deliberately preserves %2C,
// %26 etc. Keep legal reserved path characters literal on both sides.
const encodePagePath = value => encodeURI(value)
  .replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())
const displayFilename = value => value.replace(/[\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF5E]/g,
  char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))

function parseTableRow(line) {
  const cells = []
  let cell = ''
  const body = line.slice(1, -1)
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    if (character === '\\' && body[index + 1] === '|') {
      cell += '|'
      index += 1
    } else if (character === '|') {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += character
    }
  }
  cells.push(cell.trim())
  return cells
}

function parseSiteMetadata(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error('找不到站点信息源文件：' + filePath)
  }

  const source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) throw new Error(filePath + ': 缺少 YAML front matter。')

  const titleField = frontmatter[1].match(/^SITE_TITLE\s*:\s*(.*?)\s*$/im)
  if (!titleField || !titleField[1]) throw new Error(filePath + ': 缺少 SITE_TITLE。')
  let title = titleField[1].trim()
  if (title.startsWith('"')) title = JSON.parse(title)
  else if (title.startsWith("'")) title = title.slice(1, -1).replaceAll("''", "'")

  const navTable = source.slice(frontmatter[0].length)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
  const rows = navTable
    .map(parseTableRow)
    .filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)))

  if (rows.length < 2 || rows[0][0] !== '名称' || rows[0][1] !== '路径') {
    throw new Error(filePath + ': 请提供“名称 | 路径”导航表格及至少一条导航。')
  }
  const nav = rows.slice(1).map((row, index) => {
    if (row.length !== 2 || !row[0] || !row[1]) {
      throw new Error(filePath + ': 导航表第 ' + (index + 2) + ' 行必须包含名称和路径。')
    }
    return { text: row[0], link: row[1] }
  })

  return { title, nav }
}

function escapeJavaScriptSingleQuoted(value) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\r', '\\r').replaceAll('\n', '\\n')
}

function updateVitePressConfig(filePath, metadata) {
  let config = fs.readFileSync(filePath, 'utf8')
  const originalConfig = config
  const hadFinalNewline = config.endsWith('\n')
  const newline = config.includes('\r\n') ? '\r\n' : '\n'
  const titlePattern = /(^  title:\s*)(['"])([^'"\r\n]*)\2/m
  if (!titlePattern.test(config)) throw new Error('无法在 src/.vitepress/config.js 中找到站点 title。')
  config = config.replace(titlePattern, (_match, prefix, quote) => `${prefix}${quote}${metadata.title.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)}${quote}`)

  const navPattern = /(^const navItems = \[\r?\n)[\s\S]*?(^\])/m
  if (!navPattern.test(config)) throw new Error('无法在 src/.vitepress/config.js 中找到 navItems。')
  const navLines = metadata.nav.map(({ text, link }) =>
    `  { text: '${escapeJavaScriptSingleQuoted(text)}', link: '${escapeJavaScriptSingleQuoted(link)}' }`
  )
  config = config.replace(navPattern, (_match, prefix, suffix) => `${prefix}${navLines.join(',' + newline)}${newline}${suffix}`)
  if (!hadFinalNewline) config = config.replace(/(?:\r\n|\n)$/, '')
  if (config !== originalConfig) fs.writeFileSync(filePath, config, 'utf8')
  return config
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function resolveIllusts(value, title) {
  const isImage = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(value)
  if (!isImage) return escapeHtml(value)

  if (/^https?:\/\//i.test(value)) {
    return `<ScoreImage src="${escapeHtml(value)}" title="${escapeHtml(title)}" />`
  }

  // Score variant markers belong to page titles, not illustration filenames.
  const withoutBase = value.replace(/[ \t]*[（(][＊*][）)]/g, '').replace(/^\/+/, '')
  const basePrefix = siteBase.replace(/^\/+/, '')
  const relativeAsset = withoutBase.startsWith(basePrefix)
    ? withoutBase.slice(basePrefix.length)
    : withoutBase
  const normalized = path.posix.normalize(relativeAsset)
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`ILLUSTS 图片路径不能跳出 public 目录：${value}`)
  }

  const diskPath = path.resolve(publicRoot, ...normalized.split('/'))
  const relativeToPublic = path.relative(publicRoot, diskPath)
  if (relativeToPublic.startsWith('..') || path.isAbsolute(relativeToPublic)) {
    throw new Error(`ILLUSTS 图片路径不能跳出 public 目录：${value}`)
  }
  if (!fs.existsSync(diskPath) || !fs.statSync(diskPath).isFile()) {
    console.warn(`找不到 ILLUSTS 图片文件，使用占位提示：${diskPath}`)
    return `<ScoreImage title="${escapeHtml(title)}" />`
  }

  const encodedPath = normalized.split('/').map(encodeURIComponent).join('/')
  return `<ScoreImage src="/${encodedPath}" title="${escapeHtml(title)}" />`
}

function collectMarkdownFiles(directory, excludeAssets = false) {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (excludeAssets && (entry.name === 'public' || entry.name.startsWith('.'))) return []
      return collectMarkdownFiles(entryPath, excludeAssets)
    }
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [entryPath] : []
  })
}

function parseMarkdownContent(filePath) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) throw new Error(filePath + ': 缺少 YAML front matter。')

  const fields = new Map()
  for (const [index, rawLine] of frontmatter[1].split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line) continue
    const field = line.match(/^([A-Z_]+)\s*:\s*(.*)$/i)
    if (!field) throw new Error(filePath + ':' + (index + 2) + ': 无法识别 front matter 字段。')

    const key = field[1].toUpperCase()
    if (fields.has(key)) throw new Error(filePath + ': front matter 字段 ' + key + ' 重复。')
    let value = field[2].trim()
    if (value.startsWith('"')) value = JSON.parse(value)
    else if (value.startsWith("'")) value = value.slice(1, -1).replaceAll("''", "'")
    fields.set(key, value)
  }

  for (const key of requiredFields) {
    if (!fields.get(key)) throw new Error(filePath + ': 缺少必填字段 ' + key + ': ...')
  }

  const tables = []
  let currentTable = null
  let nextTableIsPair = false
  const flushTable = () => {
    if (!currentTable) return
    const columns = currentTable.cells[0]?.length ?? 0
    for (const [index, row] of currentTable.cells.entries()) {
      if (row.length !== columns) {
        throw new Error(filePath + ':' + currentTable.line + ': Markdown 表格第 ' + (index + 1) + ' 行列数不一致。')
      }
    }
    tables.push({
      rows: currentTable.cells.length,
      columns,
      pair: currentTable.pair,
      cells: currentTable.cells,
      line: currentTable.line
    })
    currentTable = null
  }

  const body = source.slice(frontmatter[0].length)
  for (const [index, rawLine] of body.split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line) {
      flushTable()
      continue
    }

    if (/^<!--\s*pair\s*-->$/i.test(line)) {
      flushTable()
      nextTableIsPair = true
      continue
    }
    if (line.startsWith('<!--')) {
      flushTable()
      continue
    }

    if (!line.startsWith('|') || !line.endsWith('|')) {
      flushTable()
      throw new Error(filePath + ':' + (index + 1) + ': 内容区只接受 Markdown 表格或 <!-- pair --> 标记。')
    }

    const cells = parseTableRow(line)
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue

    if (!currentTable) {
      currentTable = { cells: [], pair: nextTableIsPair, line: index + 1 }
      nextTableIsPair = false
    }
    currentTable.cells.push(cells)
  }
  flushTable()

  if (!tables.length) throw new Error(filePath + ': 至少需要一个 Markdown 表格。')
  const video = fields.get('VIDEO') || ''
  const bvidMatch = video.match(/\bBV[0-9A-Za-z]{10}(?![0-9A-Za-z])/i)
  const partMatch = video.match(/[?&](?:p|page)=([^&#]*)/i)
  const videoPage = partMatch ? partMatch[1] : '1'
  const validVideo = !!bvidMatch && /^[1-9][0-9]*$/.test(videoPage)
  return { fields, tables, bvid: validVideo ? bvidMatch[0] : null, videoPage }
}

function renderTables(tables) {
  const groups = []
  let index = 0

  while (index < tables.length) {
    const table = tables[index]
    if (table.pair) {
      const next = tables[index + 1]
      if (!next?.pair) throw new Error('pair 表格必须连续成对出现。')
      if (table.rows !== next.rows) throw new Error('并排表格必须有相同的行数。')

      groups.push({ pair: true, tables: [table, next] })
      index += 2
      continue
    }

    groups.push({ pair: false, tables: [table] })
    index += 1
  }

  const encodedGroups = encodeURIComponent(JSON.stringify(groups)).replaceAll("'", '%27')
  return `<ScoreTables groups="${encodedGroups}" />`
}

function renderPage({ fields, tables, bvid, videoPage }, { centeredScorePage = false, updatedAt = null } = {}) {
  const title = escapeHtml(fields.get('TITLE'))
  const subtitle = escapeHtml(fields.get('SUBTITLE') ?? '')
  const illusts = resolveIllusts(fields.get('ILLUSTS'), fields.get('TITLE'))
  const pdf = escapeHtml(fields.get('PDF') || '')
  const pdfTitle = escapeHtml(fields.get('PDF_TITLE'))
  const videoSrc = bvid ? `//player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=${videoPage}&high_quality=1&danmaku=1` : ''
  const tableMarkup = renderTables(tables)
  const dateParts = updatedAt ? Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(updatedAt).map(({ type, value }) => [type, value])) : null
  const updateLabel = dateParts
    ? `${dateParts.year}-${dateParts.month}-${dateParts.day} ${dateParts.hour}:${dateParts.minute}:${dateParts.second}` : ''

  return `---
outline: false
title: ${JSON.stringify(fields.get('TITLE'))}
---

# ${title}

${centeredScorePage ? `<p class="score-page-subtitle">${subtitle}</p>` : ''}

${centeredScorePage ? `<ScoreResourceStatus :image="${!!fields.get('ILLUSTS')?.trim()}" :video="${!!fields.get('VIDEO')?.trim()}" :pdf="${!!fields.get('PDF')?.trim()}" />` : ''}

${centeredScorePage && updatedAt ? `<div class="score-update-divider"><time datetime="${updatedAt.toISOString()}">更新时间：${updateLabel}</time></div>` : ''}

<div class="video-layout-row">
  <div class="video-square-slot">
    ${illusts.startsWith('<ScoreImage ') ? illusts : `<table class="video-square-table" aria-label="正方形图片占位表格"><tbody><tr><td>${illusts}</td></tr></tbody></table>`}
  </div>
  <div class="bilibili-container">
    <ScoreVideo src="${videoSrc}" />
  </div>
</div>

<ScoreSection title="【版面1】" sectionId="score-basic-information">

${tableMarkup}

</ScoreSection>

<ScoreSection title="【版面2】" sectionId="score-preview">

<PdfViewer src="${pdf}" title="${pdfTitle}" downloadUrl="${pdf}" />

</ScoreSection>

<hr class="pdf-bottom-divider" />
`
}

function markSectionIndexPage(content) {
  const marker = '<div class="section-index-marker" aria-hidden="true"></div>'
  if (content.includes(marker)) return content
  const frontmatter = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)
  if (frontmatter) {
    return content.slice(0, frontmatter[0].length) + '\n' + marker + '\n\n' + content.slice(frontmatter[0].length)
  }
  return marker + '\n\n' + content
}

const indexSource = path.join(contentRoot, 'index.md')
if (!fs.existsSync(indexSource) || !fs.statSync(indexSource).isFile()) {
  throw new Error('找不到首页 Markdown 源文件：' + indexSource)
}

const sources = collectMarkdownFiles(contentRoot).filter((sourcePath) =>
  path.resolve(sourcePath) !== path.resolve(indexSource) && path.resolve(sourcePath) !== path.resolve(siteMetadataPath) && path.resolve(sourcePath) !== path.resolve(footerSourcePath)
)
if (!sources.length) console.warn('没有找到页面内容 Markdown 文件：' + contentRoot)

// Validate all pages before writing output or removing obsolete pages.
const pages = [{ destination: path.join(siteRoot, 'index.md'), page: fs.readFileSync(indexSource, 'utf8') }]
const scoreRecords = []
for (const sourcePath of sources) {
  const sourceRelativePath = path.relative(contentRoot, sourcePath)
  const segments = sourceRelativePath.split(path.sep)
  const isSectionSource = segments[0] === 'Sections'
  const scoreCategory = segments[0]?.toLowerCase() === 'scores' && ['pop', 'acg'].includes(segments[1]?.toLowerCase()) ? segments[1].toLowerCase() : 'game'
  const outputSegments = segments
  if (isSectionSource && segments.length !== 2) {
    throw new Error('Sections 目录仅接受栏目首页文件：' + sourcePath)
  }
  const relativePath = isSectionSource
    ? path.join(path.basename(sourceRelativePath, path.extname(sourceRelativePath)), 'index.md')
    : path.join(...outputSegments.slice(0, -1), pageFilename(path.basename(sourceRelativePath, path.extname(sourceRelativePath))) + '.md')
  if (isSectionSource && ['public', 'Sections'].includes(relativePath.split(path.sep)[0])) {
    throw new Error('栏目名称使用了保留目录：' + sourcePath)
  }
  const destination = path.resolve(siteRoot, relativePath)
  const relativeToSite = path.relative(siteRoot, destination)
  if (relativeToSite.startsWith('..') || path.isAbsolute(relativeToSite)) {
    throw new Error('输出路径超出站点目录：' + sourcePath)
  }
  if (relativeToSite.split(path.sep).some(segment => segment.startsWith('.'))) {
    throw new Error('页面不能输出到隐藏目录：' + sourcePath)
  }
  if (pages.some(({ destination: existing }) => existing.toLowerCase() === destination.toLowerCase())) {
    throw new Error('页面输出路径冲突：' + sourcePath + ' → ' + destination)
  }

  const sourceContent = fs.readFileSync(sourcePath, 'utf8')
  const isScorePage = relativePath.split(path.sep)[0]?.toLocaleLowerCase() === 'scores' &&
    path.basename(relativePath).toLocaleLowerCase() !== 'index.md'
  // Ordinary pages may use VitePress front matter without score metadata.
  const pageFrontmatter = sourceContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
  let visible = true
  if (isScorePage && pageFrontmatter) {
    const values = pageFrontmatter.split(/\r?\n/).filter(line => /^VISIBLE\s*:/i.test(line))
    if (values.length > 1) throw new Error(sourcePath + ': VISIBLE 字段重复。')
    const visibility = values[0]?.replace(/^VISIBLE\s*:\s*/i, '').trim().toLowerCase() ?? 'true'
    if (!['true', 'false'].includes(visibility)) throw new Error(sourcePath + ': VISIBLE 必须为 true 或 false。')
    visible = visibility !== 'false'
  }
  let page = pageFrontmatter && /^TITLE\s*:/im.test(pageFrontmatter)
    ? (() => {
        const data = parseMarkdownContent(sourcePath)
        data.fields.set('TITLE', displayFilename(data.fields.get('TITLE')))
        if (isScorePage) {
          const cells = data.tables.flatMap(table => table.cells)
          const field = label => cells.find(row => row[0]?.includes(label))?.[1]?.trim() || ''
          const rawConstant = field('参数3')
          const constant = Number(rawConstant)
          const rawBpm = field('参数6').normalize('NFKC')
          const bpmMatches = rawBpm.match(/[0-9]+(?:\.[0-9]+)?/g)
          const bpm = bpmMatches ? (/[~〜～]/.test(rawBpm)
            ? Math.max(...bpmMatches.map(Number)) : Number(bpmMatches[0])) : null
          const notesTable = data.tables.find(table => table.cells.some(row => row.some(cell => /(?:子项3|Total\s*\[Tt\])/i.test(cell))))
          const totalColumn = notesTable?.cells.find(row => row.some(cell => /(?:子项3|Total\s*\[Tt\])/i.test(cell)))?.findIndex(cell => /(?:子项3|Total\s*\[Tt\])/i.test(cell))
          const rawTotal = notesTable?.cells.find(row => /参数8|\[Notes\]/i.test(row[0]))?.[totalColumn]?.trim() || ''
          const totalNotes = Number(rawTotal)
          scoreRecords.push({ visible, category: scoreCategory, title: data.fields.get('TITLE').trim(), subtitle: (data.fields.get('SUBTITLE') || '').trim(),
            difficulty: field('参数1'), level: field('参数2'),
            constant: rawConstant && Number.isFinite(constant) ? constant : null,
            constantText: rawConstant && Number.isFinite(constant) ? rawConstant : '/',
            totalNotes: rawTotal && Number.isFinite(totalNotes) ? totalNotes : null,
            bpm,
            link: encodePagePath('/' + relativePath.replaceAll(path.sep, '/').replace(/\.md$/i, '')) })
        }
        return renderPage(data, { centeredScorePage: isScorePage, updatedAt: isScorePage ? fs.statSync(sourcePath).mtime : null })
      })()
    : sourceContent
  const isSectionIndexPage = path.basename(relativePath).toLocaleLowerCase() === 'index.md' &&
    relativePath.split(path.sep).length > 1
  if (isSectionIndexPage) page = markSectionIndexPage(page)
  pages.push({ destination, page })
}

for (const { destination, page } of pages) {
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  // Windows writes preserve an existing filename's casing. Rename explicitly
  // so case-only title changes agree with generated links and cleanup paths.
  const existingName = fs.readdirSync(path.dirname(destination)).find(name =>
    name.toLowerCase() === path.basename(destination).toLowerCase())
  if (existingName && existingName !== path.basename(destination)) {
    const temporary = destination + `.case-${process.pid}.tmp`
    fs.renameSync(path.join(path.dirname(destination), existingName), temporary)
    fs.renameSync(temporary, destination)
  }
  fs.writeFileSync(destination, page, 'utf8')
  console.log('生成 ' + path.relative(projectRoot, destination))
}

// Contents owns the page Markdown tree; public assets and .vitepress stay intact.
const generatedPaths = new Set(pages.map(({ destination }) => path.resolve(destination)))
for (const existingPage of collectMarkdownFiles(siteRoot, true)) {
  if (!generatedPaths.has(path.resolve(existingPage))) {
    fs.unlinkSync(existingPage)
    console.log('移除过期页面 ' + path.relative(projectRoot, existingPage))
  }
}

fs.writeFileSync(path.join(siteRoot, '.vitepress', 'score-sidebar.json'), JSON.stringify(scoreRecords, null, 2) + '\n', 'utf8')

fs.writeFileSync(path.join(siteRoot, '.vitepress', 'footer.json'), JSON.stringify(footerLines, null, 2) + '\n', 'utf8')
