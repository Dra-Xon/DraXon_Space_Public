// Reveal the toolbar on interaction and collapse it after a short idle period.
const container = document.getElementById('outerContainer')
const toolbar = document.getElementById('toolbarContainer')
let idleTimer
let menuActive = false
let toolbarPinned = false
const pinButton = document.getElementById('siteToolbarPin')
const scheduleHide = () => {
  clearTimeout(idleTimer)
  if (toolbarPinned) return
  idleTimer = setTimeout(() => {
    if (menuActive || toolbar.contains(document.activeElement)) {
      scheduleHide()
      return
    }
    container.classList.add('site-toolbar-idle')
  }, 1000)
}
const reveal = () => {
  container.classList.remove('site-toolbar-idle')
  scheduleHide()
}
pinButton.addEventListener('click', () => {
  toolbarPinned = !toolbarPinned
  pinButton.setAttribute('aria-pressed', String(toolbarPinned))
  pinButton.classList.toggle('toggled', toolbarPinned)
  pinButton.title = toolbarPinned ? '取消固定工具栏' : '固定工具栏'
  pinButton.setAttribute('aria-label', pinButton.title)
  // Mouse clicks should not leave focus preventing the restored idle timer.
  if (pinButton.matches(':focus') && !pinButton.matches(':focus-visible')) pinButton.blur()
  reveal()
})
const revealNearTop = event => {
  // The toolbar remains measurable while translated out of view.
  const activationHeight = toolbar.getBoundingClientRect().height + 12
  if (event.clientY >= 0 && event.clientY <= activationHeight) reveal()
}
for (const event of ['pointermove', 'pointerdown']) {
  document.addEventListener(event, revealNearTop, { passive: true })
}
toolbar.addEventListener('focusin', reveal)
toolbar.addEventListener('focusout', scheduleHide)
toolbar.querySelectorAll('select').forEach(select => {
  select.addEventListener('pointerdown', () => { menuActive = true })
  for (const event of ['change', 'blur', 'keydown']) {
    select.addEventListener(event, () => { menuActive = false; reveal() })
  }
})
scheduleHide()

// Scale the entire toolbar from its non-fullscreen container width.
let normalContainerWidth = window.innerWidth
let lastToolbarScale = ''
const syncToolbarScale = () => {
  const fullscreenElement = window.parent.document.fullscreenElement ||
    window.parent.document.webkitFullscreenElement
  const isContainerFullscreen = fullscreenElement?.contains(window.frameElement)
  if (!isContainerFullscreen) normalContainerWidth = window.innerWidth
  const scale = isContainerFullscreen && normalContainerWidth > 0
    ? window.innerWidth / normalContainerWidth : 1
  const baseHeight = normalContainerWidth <= 700 ? 64 : 32
  const key = `${scale}:${baseHeight}`
  if (key === lastToolbarScale) return
  lastToolbarScale = key
  document.documentElement.style.setProperty('--toolbar-height', `${baseHeight * scale}px`)
  toolbar.style.setProperty('--toolbar-height', `${baseHeight}px`)
  toolbar.style.zoom = String(scale)
  // CSS zoom already adjusts percentage sizing against the containing block.
  // Dividing a percentage width by scale would shrink the toolbar a second time.
  toolbar.style.width = '100%'
}
let toolbarScaleFrame = 0
const scheduleToolbarScale = () => {
  if (toolbarScaleFrame) return
  toolbarScaleFrame = requestAnimationFrame(() => {
    toolbarScaleFrame = 0
    syncToolbarScale()
  })
}
window.addEventListener('resize', scheduleToolbarScale)
window.parent.document.addEventListener('fullscreenchange', scheduleToolbarScale)
window.parent.document.addEventListener('webkitfullscreenchange', scheduleToolbarScale)
syncToolbarScale()
