// Only the site's retained controls are bound. Viewer internals stay module-private.
document.addEventListener('dragstart', event => {
  if (event.target instanceof Element && event.target.closest('img,a')) event.preventDefault()
}, true)
const element = id => document.getElementById(id)
const bus = new EventBus()
const l10n = new genericl10n_GenericL10n('zh-CN')
const link = new PDFLinkService({ eventBus: bus })
const downloads = new DownloadManager()
GlobalWorkerOptions.workerSrc = '../build/pdf.worker.mjs?type3-fix=3'
const viewer = new PDFViewer({
  container: element('viewerContainer'), viewer: element('viewer'),
  eventBus: bus, linkService: link, downloadManager: downloads, l10n,
  annotationEditorMode: AnnotationEditorType.DISABLE,
  imageResourcesPath: './images/',
  maxCanvasPixels: 33554432, maxCanvasDim: 32767,
})
link.setViewer(viewer)
const presentation = new PDFPresentationMode({
  container: element('viewerContainer'), pdfViewer: viewer, eventBus: bus
})
bus.on('presentationmodechanged', event => { viewer.presentationModeState = event.state })
const select = element('scaleSelect')
const scaleInput = element('siteScalePercent')
const scrollModes = { scrollPage: ScrollMode.PAGE, scrollVertical: ScrollMode.VERTICAL,
  scrollHorizontal: ScrollMode.HORIZONTAL, scrollWrapped: ScrollMode.WRAPPED }
function syncControls() {
  element('pageNumber').value = viewer.currentPageNumber
  element('pageNumber').max = viewer.pagesCount
  element('numPages').textContent = `/ ${viewer.pagesCount}`
  for (const id of ['firstPage', 'previous']) element(id).disabled = viewer.currentPageNumber <= 1
  for (const id of ['lastPage', 'next']) element(id).disabled = viewer.currentPageNumber >= viewer.pagesCount
  element('zoomOutButton').disabled = viewer.currentScale <= 0.2
  element('zoomInButton').disabled = viewer.currentScale >= 3
  const value = String(viewer.currentScaleValue)
  select.value = [...select.options].some(option => option.value === value) ? value : 'custom'
  scaleInput.value = String(Math.round(viewer.currentScale * 100))
  element('siteScrollSelect').value = Object.keys(scrollModes).find(key => scrollModes[key] === viewer.scrollMode)
  element('siteSpreadSelect').value = ['spreadNone', 'spreadOdd', 'spreadEven'][viewer.spreadMode]
  element('siteSpreadSelect').disabled = viewer.scrollMode === ScrollMode.HORIZONTAL
}
for (const event of ['pagechanging', 'scalechanging', 'scrollmodechanged', 'spreadmodechanged']) bus.on(event, syncControls)
function zoomBy(direction) {
  if (direction > 0) viewer.increaseScale()
  else viewer.decreaseScale()
  const scale = Math.min(3, Math.max(0.2, viewer.currentScale))
  if (scale !== viewer.currentScale) viewer.currentScaleValue = scale
}
const actions = {
  firstPage: () => { viewer.currentPageNumber = 1 },
  previous: () => viewer.previousPage(), next: () => viewer.nextPage(),
  lastPage: () => { viewer.currentPageNumber = viewer.pagesCount },
  zoomInButton: () => zoomBy(1), zoomOutButton: () => zoomBy(-1),
  presentationMode: () => presentation.request()
}
for (const [id, action] of Object.entries(actions)) element(id).addEventListener('click', action)
element('siteAutoInvert').addEventListener('click', event => {
  const button = event.currentTarget
  const enabled = button.getAttribute('aria-pressed') !== 'true'
  button.setAttribute('aria-pressed', String(enabled))
  button.classList.toggle('toggled', enabled)
  document.documentElement.classList.toggle('site-pdf-invert-disabled', !enabled)
})
element('pageNumber').addEventListener('click', event => event.target.select())
element('pageNumber').addEventListener('change', event => {
  const page = Number(event.target.value)
  if (Number.isInteger(page) && page >= 1 && page <= viewer.pagesCount) viewer.currentPageNumber = page
  syncControls()
})
select.addEventListener('change', () => { if (select.value && select.value !== 'custom') viewer.currentScaleValue = select.value })
function applyScalePercent() {
  const percent = Number(scaleInput.value.trim())
  if (Number.isFinite(percent) && percent > 0) viewer.currentScaleValue = Math.min(300, Math.max(20, percent)) / 100
  syncControls()
}
scaleInput.addEventListener('change', applyScalePercent)
scaleInput.addEventListener('focus', () => scaleInput.select())
scaleInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); applyScalePercent(); scaleInput.blur() }
  if (event.key === 'Escape') { event.preventDefault(); syncControls(); scaleInput.blur() }
})
element('siteScrollSelect').addEventListener('change', event => {
  viewer.scrollMode = scrollModes[event.target.value]
})
element('siteSpreadSelect').addEventListener('change', event => {
  viewer.spreadMode = ['spreadNone', 'spreadOdd', 'spreadEven'].indexOf(event.target.value)
})
let resizeFrame = 0
let lastViewerSize = ''
const scheduleViewerResize = () => {
  // Fit before the next paint, without a visible fullscreen debounce delay.
  if (resizeFrame) return
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0
    const container = element('viewerContainer')
    const size = `${container.clientWidth}:${container.clientHeight}`
    if (size === lastViewerSize || !viewer.pdfDocument) return
    lastViewerSize = size
    if (!presentation.active && ['auto', 'page-width', 'page-fit'].includes(viewer.currentScaleValue)) {
      viewer.currentScaleValue = viewer.currentScaleValue
    }
    viewer.update()
  })
}
window.addEventListener('resize', scheduleViewerResize)
const viewerResizeObserver = new ResizeObserver(scheduleViewerResize)
viewerResizeObserver.observe(element('viewerContainer'))
document.addEventListener('keydown', event => {
  if (presentation.active || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return
  if (event.ctrlKey || event.metaKey) {
    if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault()
      zoomBy(event.key === '-' ? -1 : 1)
    }
    return
  }
  if (event.key === 'Home') { viewer.currentPageNumber = 1; event.preventDefault() }
  if (event.key === 'End') { viewer.currentPageNumber = viewer.pagesCount; event.preventDefault() }
})
window.addEventListener('wheel', event => {
  if (!event.ctrlKey || presentation.active) return
  event.preventDefault()
  zoomBy(event.deltaY < 0 ? 1 : -1)
}, { passive: false })
const PDFViewerApplication = {
  initializedPromise: l10n.translate(document.documentElement),
  pdfDocument: null, pdfLoadingTask: null,
  async open({ url }) {
    const task = this.pdfLoadingTask = getDocument({
      url, cMapUrl: new URL('./cmaps/', location.href).href, cMapPacked: true,
      standardFontDataUrl: new URL('./standard_fonts/', location.href).href,
      wasmUrl: new URL('./wasm/', location.href).href
    })
    const document = await task.promise
    this.pdfDocument = document
    this.url = url
    viewer.setDocument(document)
    link.setDocument(document)
    await viewer.firstPagePromise
    viewer.currentScaleValue = 'page-width'
    const page = Number(new URLSearchParams(location.hash.slice(1)).get('page'))
    if (page >= 1 && page <= document.numPages) viewer.currentPageNumber = page
    syncControls()
    viewer.update()
  },
  async downloadOrSave() {
    if (!this.pdfDocument) return
    let data
    try {
      data = this.pdfDocument.annotationStorage.size > 0
        ? await this.pdfDocument.saveDocument() : await this.pdfDocument.getData()
    } catch { data = await this.pdfDocument.getData() }
    const metadata = await this.pdfDocument.getMetadata()
    downloads.download(data, this.url, metadata.contentDispositionFilename || getPdfFilenameFromUrl(this.url))
  }
}
window.PDFViewerApplication = PDFViewerApplication
export { PDFViewerApplication }
