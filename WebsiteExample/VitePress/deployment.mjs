export const deployments = {
  custom: { mode: 'custom', base: '/', domain: 'example.com' },
  github: { mode: 'github', base: '/website-example/', domain: null }
}
export function getDeployment(mode = process.env.SITE_DEPLOY_MODE || 'custom') {
  if (!Object.hasOwn(deployments, mode)) throw new Error('Unknown deployment mode: ' + mode)
  return { ...deployments[mode] }
}
