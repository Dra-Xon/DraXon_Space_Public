import fs from 'node:fs';
import { getDeployment } from '../deployment.mjs';
import { preview } from 'vite';
import { resolveConfig } from 'vitepress';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
// Preview the last completed build, independent of the default build mode.
const metadata = JSON.parse(fs.readFileSync(new URL('../../Web/deployment.json', import.meta.url), 'utf8'));
const deployment = getDeployment(metadata.mode);
if (metadata.base !== deployment.base || metadata.domain !== deployment.domain) {
  throw new Error('Deployment metadata does not match configuration; rebuild the site.');
}
process.env.SITE_DEPLOY_MODE = deployment.mode;
const config = await resolveConfig('src', 'serve', 'production');

// Resolve files through the filesystem so Windows directory casing is respected.
const server = await preview({
  configFile: false,
  root: config.root,
  base: config.site.base,
  appType: 'mpa',
  build: { outDir: config.outDir },
  preview: {
    port: Number(option('--port', 4174)),
    strictPort: true,
    host: option('--host', 'localhost'),
  },
});
server.printUrls();
