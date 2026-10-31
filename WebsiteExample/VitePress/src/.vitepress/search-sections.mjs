// Search headings by their IDs without requiring visible permalink links.
export function* splitSearchSections(_file, html) {
  const headings = [...html.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)]
  const plain = value => value.replace(/<[^>]*>/g, '').trim()
  const parents = []
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]
    const anchor = heading[2].match(/\bid="([^"]+)"/)?.[1]
    const title = plain(heading[3])
    if (!anchor || !title) continue
    const level = Number(heading[1]) - 1
    parents.length = level
    parents[level] = title
    const text = plain(html.slice(heading.index + heading[0].length, headings[i + 1]?.index ?? html.length))
    yield { anchor, titles: parents.filter(Boolean), text }
  }
}
