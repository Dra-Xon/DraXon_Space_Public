<template>
  <div ref="pdfContainerRef" class="pdf-viewer-wrapper" data-score-resource="pdf" :data-resource-state="isBroken || pdfLoadFailed || !src.trim() ? 'error' : isPdfReady ? 'ready' : 'pending'">
    <div class="pdf-toolbar">
      <span class="pdf-title">{{ title || 'PDF 预览' }}</span>

      <div class="pdf-actions">
        <button v-if="downloadUrl && !isBroken" type="button" @click="requestDownload"
          :disabled="!isPdfReady || isSaving" class="pdf-btn">
          📥 下载 PDF
        </button>

        <button @click="toggleFullscreen" class="pdf-btn">
          {{ isFullscreen ? '📉 退出全屏' : '⛶ 全屏查看' }}
        </button>
      </div>
    </div>

    <dialog ref="downloadDialogRef" class="pdf-download-dialog" :aria-label="`下载 ${downloadFileName}`" @click="cancelOnBackdrop">
      <div class="pdf-download-header">下载 {{ downloadFileName }}</div>
      <div class="pdf-download-message">
        <p>本网站中的资源PDF文件，采用 CC BY-NC-SA 4.0 许可：</p>
        <ul>
          <li>BY：您对本网站资源文件的转载，需要署名，即注明作者、来源、是否修改以及许可链接。</li>
          <li>NC：本网站中的资源文件，不得进行商用，包括但不限于售卖、倒卖、拍卖等。</li>
          <li>SA：在您对基于本网站资源文件改编或改动的作品进行分享或公开发布时，须采用相同许可。</li>
        </ul>
        <p>点击确认并下载此文件，将默认您已了解并遵循本协议。</p>
      </div>
      <div class="pdf-download-actions">
        <button type="button" class="pdf-btn" @click="confirmDownload">✅ 确认</button>
        <button type="button" class="pdf-btn" autofocus @click="downloadDialogRef.close()">❌ 取消</button>
      </div>
    </dialog>

    <div v-if="isBroken" class="pdf-iframe pdf-placeholder" role="status">资源不可用</div>
    <div v-else-if="!src.trim()" class="pdf-iframe pdf-placeholder" role="status">PDF 尚未发布！</div>
    <div v-else-if="pdfLoadFailed" class="pdf-missing-message" role="status">
      <span v-if="pdfReaderFailed">PDF阅读器启动失败，<br />请刷新页面重试！</span>
      <span v-else>PDF 名称错误！</span>
    </div>
    <iframe
      ref="pdfFrameRef"
      v-if="isMounted && viewerUrl"
      :src="viewerUrl"
      @load="loadPdfInViewer"
      class="pdf-iframe"
      :class="{ 'pdf-iframe--failed': pdfLoadFailed }"
      allow="fullscreen *"
      allowfullscreen
      webkitallowfullscreen
      mozallowfullscreen
    ></iframe>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useData, withBase } from 'vitepress'

const props = defineProps({
  src: { type: String, required: true },
  title: { type: String, default: '' },
  downloadUrl: { type: String, default: '' }
})

const pdfContainerRef = ref(null)
const isBroken = computed(() => props.src.trim().toLowerCase() === 'broken')
const pdfFrameRef = ref(null)
const { isDark } = useData()
const syncPdfPageTheme = () => {
  const viewerRoot = pdfFrameRef.value?.contentDocument?.documentElement
  if (!viewerRoot) return
  viewerRoot.classList.toggle('site-pdf-inverted', isDark.value)
  // PDF.js uses light-dark() for the viewer surface and native scrollbars.
  viewerRoot.style.colorScheme = isDark.value ? 'dark' : 'light'
}
watch(isDark, syncPdfPageTheme)
const isFullscreen = ref(false)
const isMounted = ref(false)
const isPdfReady = ref(false)
const pdfLoadFailed = ref(false)
const pdfReaderFailed = ref(false)
let viewerStartupTimer = null
const clearViewerStartupTimer = () => {
  clearTimeout(viewerStartupTimer)
  viewerStartupTimer = null
}
const isSaving = ref(false)
const downloadDialogRef = ref(null)
const downloadFileName = computed(() => {
  const fileName = props.src.split(/[?#]/, 1)[0].split('/').pop() || 'PDF'
  try {
    return decodeURIComponent(fileName)
  } catch {
    return fileName
  }
})
let viewerApplication = null

const requestDownload = () => {
  if (!isPdfReady.value || isSaving.value || !viewerApplication) return
  downloadDialogRef.value?.showModal()
}

const cancelOnBackdrop = (event) => {
  const dialog = event.currentTarget
  if (event.target !== dialog) return
  const bounds = dialog.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) {
    dialog.close()
  }
}

const confirmDownload = () => {
  downloadDialogRef.value?.close()
  return savePdf()
}

const savePdf = async () => {
  if (!isPdfReady.value || isSaving.value || !viewerApplication) return
  isSaving.value = true
  try {
    await viewerApplication.downloadOrSave()
  } catch (error) {
    console.error('PDF viewer failed to save document:', error)
  } finally {
    isSaving.value = false
  }
}

const viewerUrl = computed(() => {
  if (!props.src.trim() || isBroken.value) return ''

  const pdfJsViewer = withBase('/pdfjs/web/viewer.html')

  return `${pdfJsViewer}?site-toolbar=27#page=1&zoom=page-width&pagemode=none`
})

const loadPdfInViewer = async (event) => {
  isPdfReady.value = false
  viewerApplication = null
  let readerInitialized = false
  try {
    syncPdfPageTheme()
    const frameWindow = event.currentTarget?.contentWindow
    const pdfViewerApplication = frameWindow?.PDFViewerApplication
    if (!pdfViewerApplication) throw new Error('PDF reader application is unavailable')
    await pdfViewerApplication.initializedPromise
    clearViewerStartupTimer()
    readerInitialized = true
    pdfLoadFailed.value = false
    pdfReaderFailed.value = false
    viewerApplication = pdfViewerApplication
    if (pdfViewerApplication.pdfDocument) {
      isPdfReady.value = true
      return
    }
    const cleanPdfPath = props.src.startsWith('/') ? props.src : '/' + props.src
    const pdfUrl = withBase(cleanPdfPath)
    await pdfViewerApplication.open({ url: pdfUrl })
    await pdfViewerApplication.pdfLoadingTask.promise
    isPdfReady.value = !!pdfViewerApplication.pdfDocument
  } catch (error) {
    clearViewerStartupTimer()
    pdfReaderFailed.value = !readerInitialized
    pdfLoadFailed.value = true
    console.error('PDF viewer failed to open document:', error)
  }
}

const getFullscreenElement = () =>
  document.fullscreenElement ||
  document.webkitFullscreenElement ||
  document.mozFullScreenElement

// 兼容 Windows、iPad、Mac 的全屏切换
const toggleFullscreen = () => {
  const target = pdfContainerRef.value

  if (!target) return

  if (!getFullscreenElement()) {
    if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {})
    } else if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen()
    } else if (target.mozRequestFullScreen) {
      target.mozRequestFullScreen()
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen()
    }
  }
}

const handleFsChange = () => {
  isFullscreen.value = !!getFullscreenElement()
}

onMounted(() => {
  // Cover iframe requests and reader initialization that never finish.
  if (viewerUrl.value) {
    viewerStartupTimer = setTimeout(() => {
      pdfReaderFailed.value = true
      pdfLoadFailed.value = true
      viewerStartupTimer = null
    }, 20000)
  }
  isMounted.value = true

  document.addEventListener('fullscreenchange', handleFsChange)
  document.addEventListener('webkitfullscreenchange', handleFsChange)
  document.addEventListener('mozfullscreenchange', handleFsChange)
})

onUnmounted(() => {
  clearViewerStartupTimer()
  document.removeEventListener('fullscreenchange', handleFsChange)
  document.removeEventListener('webkitfullscreenchange', handleFsChange)
  document.removeEventListener('mozfullscreenchange', handleFsChange)
})
</script>

<style scoped>
.pdf-missing-message { position: absolute; inset: var(--pdf-toolbar-height) 0 0; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 16px; line-height: 1.8; color: var(--vp-c-text-2); }
.pdf-iframe--failed { visibility: hidden; }
:global(html:not(.dark) .pdf-missing-message),
:global(html:not(.dark) .pdf-placeholder) { color: #fff; }
.pdf-iframe.pdf-placeholder { display: flex; align-items: center; justify-content: center; text-align: center; font-size: 16px; line-height: 1.8; color: var(--vp-c-text-2); }
.pdf-download-dialog {
  margin: auto;
  width: min(960px, calc(100vw - 32px));
  padding: 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--pdf-dialog-surface);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  color: var(--vp-c-text-1);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.pdf-download-dialog::backdrop {
  background: rgba(0, 0, 0, 0.45);
}

.pdf-download-header {
  color: var(--pdf-dialog-text);
  text-shadow: var(--pdf-dialog-text-shadow);
  margin: -24px -24px 24px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: transparent;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.pdf-download-message {
  padding-left: 16px;
  padding-right: 16px;
  padding-bottom: 1.6em;
  font-size: 18px;
  line-height: 1.6;
}

.pdf-download-dialog .pdf-download-message :is(p, li) {
  color: var(--pdf-dialog-text) !important;
  text-shadow: var(--pdf-dialog-text-shadow);
}

.pdf-download-message p {
  margin: 0;
}

.pdf-download-message ul {
  margin: 16px 0;
  padding-left: 24px;
  list-style: disc;
}

.pdf-download-message li + li {
  margin-top: 8px;
}

.pdf-download-actions {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 24px;
}

.pdf-download-actions .pdf-btn {
  border-width: 2px;
  min-height: 48px;
  padding: 10px 24px;
  font-size: 20px;
  line-height: 26px;
}

.pdf-viewer-wrapper {
  position: relative;
  --pdf-toolbar-height: 52px;

  width: 100%;
  margin: 0;
  border: 1px solid var(--vp-c-divider);
  border-bottom: 0;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--content-glass-surface);
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
}

.pdf-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--content-glass-surface);
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  border-bottom: 1px solid var(--vp-c-divider);
}

.pdf-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--vp-c-text-1);
}

.pdf-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.pdf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 32px;
  padding: 4px 10px;
  font-size: 14px;
  line-height: 22px;
  white-space: nowrap;
  border-radius: 4px;
  border: 1px solid var(--vp-c-divider);
  background-color: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.pdf-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.pdf-iframe {
  width: 100%;
  height: 80vh;
  border: none;
  display: block;
}

@media (max-width: 959px) {
  .pdf-iframe {
    height: 70vh;
  }
}

/* 全屏模式 */
.pdf-viewer-wrapper:fullscreen,
.pdf-viewer-wrapper:-webkit-full-screen {
  width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 0 !important;

  display: flex !important;
  flex-direction: column !important;
}

/* 全屏时只保留 iframe 内的 PDF.js 工具栏。 */
.pdf-viewer-wrapper:fullscreen .pdf-toolbar,
.pdf-viewer-wrapper:-webkit-full-screen .pdf-toolbar {
  display: none !important;
}

.pdf-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* 全屏时 iframe 占满剩余空间 */
.pdf-viewer-wrapper:fullscreen .pdf-iframe,
.pdf-viewer-wrapper:-webkit-full-screen .pdf-iframe {
  width: 100% !important;
  height: 100% !important;
  flex: 1 1 auto;
  min-height: 0 !important;
  border: none !important;
}
:global(html:not(.dark)) .pdf-iframe.pdf-placeholder { color: #fff; }
</style>
