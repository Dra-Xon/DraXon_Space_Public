import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { getDeployment } from '../deployment.mjs'
import { encryptResources } from './encrypt-resources.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const deployment = getDeployment(process.argv[2])
const env = { ...process.env, SITE_DEPLOY_MODE: deployment.mode }
console.log('Building ' + deployment.mode + ' deployment at ' + deployment.base)
for (const args of [
  ['scripts/generate-content.mjs'],
  ['scripts/build-pdf-viewer.mjs'],
  ['node_modules/vitepress/bin/vitepress.js', 'build', 'src', '--outDir', '../Web']
]) {
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
const output = path.resolve(projectRoot, '../Web')
encryptResources(output, deployment.base)
// Encryption removes public originals; prune their empty directories bottom-up.
// rmdirSync only removes empty directories, never files or the output root.
function removeEmptyDirectories(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const child = path.join(directory, entry.name)
    removeEmptyDirectories(child)
    if (fs.readdirSync(child).length === 0) fs.rmdirSync(child)
  }
}
removeEmptyDirectories(output)
fs.writeFileSync(path.join(output, 'deployment.json'), JSON.stringify(deployment, null, 2) + '\n')
const cname = path.join(output, 'CNAME')
if (deployment.domain) fs.writeFileSync(cname, deployment.domain + '\n')
else fs.rmSync(cname, { force: true })

// Update only the website entry link after a successful build.
const readmePath = path.resolve(projectRoot, '../README.md')
const readme = fs.readFileSync(readmePath, 'utf8').replaceAll('\r\n', '\n')
const entryLink = /(<a\b[^>]*\bhref=")[^"]*("[^>]*>点我进入网站<\/a>)/g
if ([...readme.matchAll(entryLink)].length !== 1) {
  throw new Error('README must contain exactly one website entry link.')
}
const siteUrl = deployment.domain
  ? 'https://' + deployment.domain + deployment.base
  : 'https://example.github.io' + deployment.base
fs.writeFileSync(readmePath, readme.replace(entryLink, (_match, before, after) => before + siteUrl + after))
console.log('README website link updated: ' + siteUrl)
