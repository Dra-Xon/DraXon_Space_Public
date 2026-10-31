import fs from 'node:fs/promises'
import { build } from 'esbuild'
const editorExports = ['AnnotationEditorLayer', 'AnnotationEditorUIManager', 'ColorPicker', 'SignatureExtractor']
let core = await fs.readFile(new URL('../vendor/pdf-core.mjs', import.meta.url), 'utf8')
for (const name of editorExports) {
  core = core.replace(new RegExp(`^  ${name}: ${name},\\r?\\n`, 'm'), '')
  core = core.replace(/export \{[^}]+\};/, exports => exports.replace(new RegExp(`\\b${name}, `), ''))
}
core = core.replace(/\/\/# sourceMappingURL=.*$/m, '')
const coreResult = await build({ stdin: { contents: core, loader: 'js' }, write: false,
  bundle: true, treeShaking: true, minify: true, format: 'esm', target: 'es2022', legalComments: 'inline' })
const coreOutput = new URL('../src/public/pdfjs/build/pdf.mjs', import.meta.url)
const coreTemporary = new URL('../src/public/pdfjs/build/pdf.mjs.tmp', import.meta.url)
await fs.writeFile(coreTemporary, coreResult.outputFiles[0].contents)
await fs.rename(coreTemporary, coreOutput)
await fs.rm(new URL('../src/public/pdfjs/build/pdf.mjs.map', import.meta.url), { force: true })
const source = await fs.readFile(new URL('../vendor/pdfjs-viewer.mjs', import.meta.url), 'utf8')
let prefix = source.slice(0, source.indexOf('const PDFViewerApplication = {'))
// Remove the editor creation branch before bundling, rather than hiding its UI.
const editorStart = prefix.indexOf('      if (annotationEditorMode !== AnnotationEditorType.DISABLE) {', prefix.indexOf('class PDFViewer {'))
const editorEnd = prefix.indexOf('      const viewerElement =', editorStart)
if (editorStart < 0 || editorEnd < 0) throw new Error('PDF.js editor boundary changed')
prefix = prefix.slice(0, editorStart) + prefix.slice(editorEnd)
prefix = prefix.replace(/  AnnotationEditorUIManager,\r?\n/, '')
const result = await build({
  stdin: {
    contents: prefix + '\n' + await fs.readFile(new URL('../viewer/application.mjs', import.meta.url), 'utf8'),
    resolveDir: process.cwd(), sourcefile: 'site-pdf-viewer.mjs', loader: 'js'
  },
  outfile: new URL('../src/public/pdfjs/web/viewer.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
  write: false,
  bundle: true, treeShaking: true, minify: true, format: 'esm', target: 'es2022',
  legalComments: 'inline'
})
const output = new URL('../src/public/pdfjs/web/viewer.mjs', import.meta.url)
const bundle = result.outputFiles[0].text
for (const removed of ['AnnotationEditorUIManager', 'PDFFindController',
  'PDFScriptingManager', 'PDFPrintService', 'PDFDocumentProperties', 'SecondaryToolbar']) {
  if (bundle.includes(removed)) throw new Error(`Removed PDF controller reintroduced: ${removed}`)
}
const temporary = new URL('../src/public/pdfjs/web/viewer.mjs.tmp', import.meta.url)
await fs.writeFile(temporary, result.outputFiles[0].contents)
await fs.rename(temporary, output)
const html = await fs.readFile(new URL('../src/public/pdfjs/web/viewer.html', import.meta.url), 'utf8')
for (const id of ['viewsManager', 'viewFindButton', 'editorModeButtons', 'printButton',
  'downloadButton', 'secondaryToolbarToggle', 'dialogContainer']) {
  if (html.includes(`id="${id}"`)) throw new Error(`Removed PDF control reintroduced: ${id}`)
}
