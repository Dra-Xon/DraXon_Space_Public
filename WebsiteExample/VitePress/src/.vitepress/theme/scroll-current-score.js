// Scroll only the track list; never scroll the document or its fixed headings.
export const sidebarRevealPadding = 8
export function revealCurrentScore(list) {
  const row = list?.querySelector('.VPSidebarItem.is-active > .item')
  if (!row || !list.clientHeight || !row.getClientRects().length) return false
  const viewport = list.getBoundingClientRect()
  const bounds = row.getBoundingClientRect()
  const top = viewport.top + list.clientTop
  const bottom = top + list.clientHeight
  if (bounds.top >= top && bounds.bottom <= bottom) return false
  const offset = bounds.top < top
    ? bounds.top - top - sidebarRevealPadding
    : bounds.bottom - bottom + sidebarRevealPadding
  list.scrollTop = Math.max(0, Math.min(list.scrollHeight - list.clientHeight, list.scrollTop + offset))
  return true
}
