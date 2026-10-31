// Natural name ordering: Chinese pinyin, numeric runs, and case-insensitive names.
const nameCollator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base', ignorePunctuation: false })
export const compareScoreNames = (a, b) => {
  const left = a.normalize('NFKC')
  const right = b.normalize('NFKC')
  // Windows-style name groups: Latin names precede Chinese names.
  const startsWithChinese = name => /^\p{Script=Han}/u.test(name.trimStart())
  return Number(startsWithChinese(left)) - Number(startsWithChinese(right)) || nameCollator.compare(left, right)
}

export function buildScoreSidebar(records) {
  const groups = new Map()
  for (const record of records) {
    const key = JSON.stringify([record.title.trim(), (record.subtitle || '').trim()])
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  }
  return [...groups.values()].sort((a, b) => compareScoreNames(a[0].title, b[0].title)).map(group => {
    if (group.length === 1) return { text: group[0].title, link: group[0].link }
    group.sort((a, b) => (b.totalNotes ?? -1) - (a.totalNotes ?? -1) || a.link.localeCompare(b.link))
    const counts = new Map()
    for (const record of group) counts.set(record.difficulty, (counts.get(record.difficulty) || 0) + 1)
    const used = new Map()
    return { text: group[0].title, collapsed: true, items: group.map(record => {
      let label = record.difficulty || '未标注参数1'
      if (counts.get(record.difficulty) > 1 && record.level) label += ` · ${record.level}`
      const occurrence = (used.get(label) || 0) + 1
      used.set(label, occurrence)
      if (occurrence > 1) label += ` (${occurrence})`
      return { text: label, link: record.link, docFooterText: `${record.title} · ${label}` }
    }) }
  })
}
export function sortScoreSidebar(records, mode = 'title', reversed = false) {
  if (mode === 'level') {
    const parseLevel = record => {
      const match = String(record.level ?? '').normalize('NFKC').match(/^(?:Lv\.?\s*)?(\d+(?:\.\d+)?)\s*(\+)?$/i)
      return match ? [Number(match[1]), match[2] ? 1 : 0] : null
    }
    const direction = reversed ? 1 : -1
    return [...records].sort((a, b) => {
      const left = parseLevel(a)
      const right = parseLevel(b)
      if (!left && right) return 1
      if (left && !right) return -1
      return (left && right ? direction * (left[0] - right[0] || left[1] - right[1]) : 0) ||
        (a.totalNotes == null ? (b.totalNotes == null ? 0 : 1) : b.totalNotes == null ? -1 : b.totalNotes - a.totalNotes) ||
        a.title.localeCompare(b.title, 'zh-CN') || a.link.localeCompare(b.link)
    }).map(record => ({ text: record.title, link: record.link }))
  }
  if (mode === 'title') {
    const groups = buildScoreSidebar(records)
    if (reversed) {
      groups.reverse()
    }
    return groups
  }
  const keys = { constant: ['constant', 'totalNotes'], total: ['totalNotes', 'bpm'], bpm: ['bpm', 'totalNotes'] }[mode]
  if (!keys) throw new Error('Unknown score sort mode')
  const direction = reversed ? -1 : 1
  const compareNumber = (a, b) => {
    if (a == null) return b == null ? 0 : 1
    if (b == null) return -1
    return direction * (b - a)
  }
  const levelValue = record => {
    const match = record.level?.match(/Lv\.\s*(\d+(?:\.\d+)?)(\+)?/i)
    return match ? Number(match[1]) + (match[2] ? 0.5 : 0) : null
  }
  const compareMissingConstants = (a, b) => {
    if (mode !== 'constant') return 0
    const aMissing = a.constant == null
    const bMissing = b.constant == null
    if (aMissing !== bMissing) return direction * (aMissing ? -1 : 1)
    if (aMissing) return compareNumber(levelValue(a), levelValue(b))
    return 0
  }
  return [...records].sort((a, b) => compareMissingConstants(a, b) || compareNumber(a[keys[0]], b[keys[0]]) ||
    compareNumber(a[keys[1]], b[keys[1]]) || direction * (a.title.localeCompare(b.title, 'zh-CN') || a.link.localeCompare(b.link)))
    .map(record => ({ text: record.title, link: record.link }))
}
