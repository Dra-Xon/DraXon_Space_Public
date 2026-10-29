;(async () => {
  const status = document.getElementById('resource-status')
  const script = document.currentScript
  try {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      throw new Error('此浏览器无法初始化资源，请使用支持 Service Worker 的浏览器并通过 HTTPS 访问。')
    }
    const base = new URL('./', document.currentScript?.src || [...document.scripts].find(script => script.src.endsWith('/resource-bootstrap.js')).src)
    const workerUrl = new URL('resource-sw.js', base).href
    const registration = await Promise.race([
      navigator.serviceWorker.register(workerUrl, { scope: base.pathname, updateViaCache: 'none' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('注册超时')), 20000))
    ])
    const deadline = Date.now() + 20000
    let ready = false
    while (Date.now() < deadline) {
      const worker = registration.active
      if (worker) {
        const version = await new Promise(resolve => {
          const channel = new MessageChannel()
          const timer = setTimeout(() => { channel.port1.close(); resolve(null) }, 500)
          channel.port1.onmessage = event => {
            clearTimeout(timer)
            channel.port1.close()
            resolve(event.data?.version)
          }
          worker.postMessage({ type: 'resource-claim' }, [channel.port2])
        })
        if (version === script.dataset.resourceVersion && navigator.serviceWorker.controller?.scriptURL === workerUrl) { ready = true; break }
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!ready) throw new Error('资源接管超时')
    const response = await fetch(script.dataset.resourcePage, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('页面加载失败：' + response.status)
    const html = await response.text()
    // Parse after explicit claim instead of repeating a forced reload.
    document.open()
    document.write(html)
    document.close()
  } catch (error) {
    status.textContent = '资源初始化失败：' + error.message + ' 请刷新重试。'
  }
})()
