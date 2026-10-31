<script setup>
import { onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { effectsEnabled } from '../effects.js'

const waves = ref([])
const navTarget = shallowRef(null)
let frame = 0
let previousTime = 0
let windowGain = 0
let active = false
let pointer = null
let states = []
let media
let touchMedia
let frameObserver
const frameBindings = new Map()

function attachBiliProbe(element) {
  const origin = 'https://player.bilibili.com'
  const enabled = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ||
    new URLSearchParams(location.search).get('biliProbe') === '1'
  if (!enabled ||
      new URL(element.src, location.href).origin !== origin) return () => {}
  let messages = 0
  let coordinates = 0
  const receive = event => {
    if (event.origin !== origin || event.source !== element.contentWindow) return
    messages++
    let data = event.data
    if (typeof data === 'string') {
      try { data = JSON.parse(data.replace(/^playerOperation-/, '')) } catch { data = null }
    }
    const value = data?.value ?? data?.data ?? data
    const hasCoordinates = value && ((Number.isFinite(value.clientX) && Number.isFinite(value.clientY)) ||
      (Number.isFinite(value.x) && Number.isFinite(value.y)))
    if (hasCoordinates) coordinates++
    console.info('[BiliProbe] received', JSON.stringify({ type: data?.type ?? typeof event.data, hasCoordinates: !!hasCoordinates }))
  }
  const send = () => {
    // Experimental names modeled on the live player's envelope, not documented APIs.
    for (const type of ['enableMouseMove', 'subscribeMouseMove']) {
      element.contentWindow?.postMessage('setPlayer-' + JSON.stringify({ type, value: true }), origin)
      console.info('[BiliProbe] sent speculative request', type)
    }
  }
  window.addEventListener('message', receive)
  element.addEventListener('load', send)
  const timers = [setTimeout(send, 1500), setTimeout(send, 4000),
    setTimeout(() => console.info('[BiliProbe] summary', JSON.stringify({ messages, coordinates })), 15000)]
  return () => {
    timers.forEach(clearTimeout)
    window.removeEventListener('message', receive)
    element.removeEventListener('load', send)
  }
}

function syncFrameBindings() {
  for (const [element, binding] of frameBindings) {
    if (!element.isConnected) {
      binding.cleanup()
      frameBindings.delete(element)
    }
  }
  for (const element of document.querySelectorAll('iframe')) {
    if (frameBindings.has(element)) continue
    let frameDocument = null
    const relay = event => {
      const rect = element.getBoundingClientRect()
      move({ pointerType: event.pointerType,
        clientX: rect.left + element.clientLeft + event.clientX,
        clientY: rect.top + element.clientTop + event.clientY })
    }
    const detach = () => {
      frameDocument?.removeEventListener('pointermove', relay, true)
      frameDocument?.removeEventListener('pointerover', relay, true)
      frameDocument = null
    }
    const bind = () => {
      detach()
      try {
        frameDocument = element.contentDocument
        frameDocument?.addEventListener('pointermove', relay, { passive: true, capture: true })
        frameDocument?.addEventListener('pointerover', relay, { passive: true, capture: true })
      } catch {
        // Cross-origin players cannot expose their pointer events to this page.
      }
    }
    element.addEventListener('load', bind)
    const cleanupProbe = attachBiliProbe(element)
    frameBindings.set(element, { cleanup() { detach(); cleanupProbe(); element.removeEventListener('load', bind) } })
    bind()
  }
}

// Rounded rectangle sampled radially: every bump stays on the ray to the mouse.
function boundary(angle, halfWidth, halfHeight, radius) {
  const x = Math.cos(angle)
  const y = Math.sin(angle)
  const inside = distance => {
    const qx = Math.max(Math.abs(x * distance) - (halfWidth - radius), 0)
    const qy = Math.max(Math.abs(y * distance) - (halfHeight - radius), 0)
    return qx * qx + qy * qy <= radius * radius
  }
  let low = 0
  let high = Math.hypot(halfWidth, halfHeight)
  for (let index = 0; index < 14; index++) {
    const middle = (low + high) / 2
    if (inside(middle)) low = middle
    else high = middle
  }
  return low
}

function tick(time) {
  if (!effectsEnabled.value) { frame = 0; waves.value = []; return }
  navTarget.value = document.querySelector('.VPNavBar')
  const dt = Math.min((time - previousTime) / 1000 || 0.016, 0.05)
  previousTime = time
  const touchDevice = touchMedia.matches
  const homeCards = touchDevice ? [...document.querySelectorAll('.VPHomeFeatures .VPFeature .box')] : []
  const homeProfile = touchDevice ? document.querySelector('.VPHome .home-profile:not(.home-profile--about)') : null
  if (touchDevice) {
    const target = homeProfile?.getBoundingClientRect()
    pointer = target ? { x: target.left + target.width / 2, y: target.top + target.height / 2 } : null
    active = !!target && !document.hidden
  }
  const enabled = !media.matches && (!touchDevice || !!homeProfile)
  const targetGain = enabled && active ? 1 : 0
  windowGain += (targetGain - windowGain) * (1 - Math.exp(-dt / 0.25))
  const targets = !enabled ? [] : touchDevice
    ? [...homeCards, homeProfile, ...document.querySelectorAll('.VPNavBar')]
    : [...document.querySelectorAll('.VPHomeFeatures .VPFeature .box, .VPHome .home-profile:not(.home-profile--about), .home-profile .home-profile-avatar, .VPNavBar, .VPSidebar, .VPDocFooter .pager-link, .title-pager-link')]
  states = targets.map(element => states.find(state => state.element === element) || { element, strength: 0, angle: 0, initialized: false })
  const output = []
  for (const [index, state] of states.entries()) {
    const isAvatar = state.element.matches('.home-profile-avatar')

    const isPager = state.element.matches('.VPDocFooter .pager-link, .title-pager-link')
    const elementRect = state.element.getBoundingClientRect()
    // The avatar outline is offset 4px with a 1px stroke: follow its centerline.
    const rect = isAvatar ? { left: elementRect.left - 4.5, top: elementRect.top - 4.5,
      width: elementRect.width + 9, height: elementRect.height + 9 } : elementRect
    if (!rect.width || !rect.height || !pointer) continue
    if (isPager) {
      // 24px peak + 12px half stroke + 3 * 13px blur, rounded up.
      const haloMargin = 80
      const warmupMargin = haloMargin + 40
      const nearViewport = rect.right >= -warmupMargin && rect.left <= window.innerWidth + warmupMargin &&
        rect.bottom >= -warmupMargin && rect.top <= window.innerHeight + warmupMargin
      state.viewportGain ??= 0
      if (!nearViewport) {
        state.viewportGain = 0
        state.initialized = false
        continue
      }
      state.viewportGain += (1 - state.viewportGain) * (1 - Math.exp(-dt / 0.12))
      const haloVisible = rect.right >= -haloMargin && rect.left <= window.innerWidth + haloMargin &&
        rect.bottom >= -haloMargin && rect.top <= window.innerHeight + haloMargin
      if (!haloVisible) continue
    }
    const isTopBar = state.element.matches('.VPNavBar')
    const isSidebar = state.element.matches('.VPSidebar')
    if (isTopBar || isSidebar) {
      const style = getComputedStyle(state.element)
      const expanded = !isSidebar || (!document.body.classList.contains('sidebar-collapsed') &&
        (window.innerWidth >= 960 || state.element.classList.contains('open')))
      // A collapsed sidebar, or a pointer inside it, transfers the wave to the viewport left border.
      // Page sidebar presence, rather than the body class, controls inheritance.
      const pointerInsideSidebar = isSidebar && expanded &&
        pointer.x >= Math.max(0, rect.left) && pointer.x <= rect.right &&
        pointer.y >= rect.top && pointer.y <= rect.bottom
      const inherited = isSidebar && !!document.querySelector('.VPContent.has-sidebar') &&
        (!expanded || pointerInsideSidebar)
      if (!inherited && (!expanded || style.visibility === 'hidden' || Number(style.opacity) === 0 || rect.right <= 0)) continue
      const navBottom = document.querySelector('.VPNavBar')?.getBoundingClientRect().bottom ?? 0
      const borderX = inherited ? 0 : rect.right
      const edgeTop = isSidebar ? Math.max(inherited ? 0 : rect.top, navBottom) : rect.bottom
      const edgeBottom = inherited ? window.innerHeight : rect.bottom
      const distance = isTopBar ? pointer.y - rect.bottom : pointer.x - borderX
      const withinSpan = isTopBar
        ? pointer.x >= rect.left && pointer.x <= rect.right
        : pointer.y >= 0 && pointer.y <= edgeBottom
      const maxDistance = Math.max(1, isTopBar ? window.innerHeight - rect.bottom
        : pointerInsideSidebar ? rect.right * 0.75 : window.innerWidth - borderX)
      const d = Math.min(maxDistance, Math.max(0, distance))
      // Continuous near-edge lift, then an almost linear middle; S(0)=0, S(L)=1.
      const nearEdge = (1 - Math.exp(-Math.sqrt(d / 12))) /
        (1 - Math.exp(-Math.sqrt(maxDistance / 12)))
      const desired = withinSpan ? 0.78 * d / maxDistance + 0.22 * nearEdge : 0
      state.strength += (desired - state.strength) * (1 - Math.exp(-dt / 0.065))
      state.strength = Math.min(state.strength, desired)
      // Match the video's 0.25s fade envelope when switching sidebar edges.
      if (isSidebar && state.edgeInherited !== inherited) {
        if (state.lastEdgeWave) state.outgoingEdge = { ...state.lastEdgeWave, fade: 1 }
        state.edgeInherited = inherited
        state.edgeGain = 0
      }
      if (isSidebar) state.edgeGain += (1 - state.edgeGain) * (1 - Math.exp(-dt / 0.25))
      const strength = state.strength * windowGain * (isSidebar ? state.edgeGain : 1)
      const amplitude = 12 * strength
      const sigma = (32 + 15 * strength) * 0.5
      const center = isTopBar ? pointer.x - rect.left : Math.max(0, pointer.y - edgeTop)
      const points = []
      // Orthogonal projection makes the Gaussian's normal point at the mouse.
      for (let sample = 0; sample <= 120; sample++) {
        const offset = (sample / 120 * 2 - 1) * 155
        const bump = amplitude * Math.exp(-0.5 * (offset / sigma) ** 2)
        const along = center + offset
        points.push(`${sample ? 'L' : 'M'}${isTopBar ? along.toFixed(2) : bump.toFixed(2)},${isTopBar ? bump.toFixed(2) : along.toFixed(2)}`)
      }
      output.push({ id: index, kind: isTopBar ? 'top' : 'side', left: isTopBar ? 0 : borderX, top: isTopBar ? rect.height : edgeTop,
        width: isTopBar ? rect.width : 1, height: isTopBar ? 1 : Math.max(1, edgeBottom - edgeTop),
        path: points.join(' '), strength,
        gx: isTopBar ? center : 0, gy: isTopBar ? 0 : center })
      if (isSidebar) {
        state.lastEdgeWave = { ...output[output.length - 1] }
        if (state.outgoingEdge) {
          state.outgoingEdge.fade *= Math.exp(-dt / 0.25)
          if (state.outgoingEdge.fade < 0.005) state.outgoingEdge = null
          else output.push({ ...state.outgoingEdge, id: `edge-fade-${index}`,
            glowOpacity: state.outgoingEdge.strength * state.outgoingEdge.fade * windowGain })
        }
      }
      continue
    }
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = pointer.x - cx
    const dy = pointer.y - cy
    const angle = Math.atan2(dy, dx)
    const hw = rect.width / 2
    const hh = rect.height / 2
    const radius = isAvatar ? Math.min(hw, hh) : Math.min(isPager ? parseFloat(getComputedStyle(state.element).borderTopLeftRadius) || 0 : 14, hw, hh)
    const edge = boundary(angle, hw, hh, radius)
    // Signed distance to the rounded rectangle, in absolute CSS pixels.
    const qx = Math.abs(dx) - (hw - radius)
    const qy = Math.abs(dy) - (hh - radius)
    const borderDistance = Math.max(0,
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius)
    const ownerRect = isAvatar ? state.element.closest('.home-profile').getBoundingClientRect() : null
    const insideOwner = !isAvatar || !!state.element.closest('.home-profile--about') || (pointer.x >= ownerRect.left && pointer.x <= ownerRect.right &&
      pointer.y >= ownerRect.top && pointer.y <= ownerRect.bottom)
    const isTitlePager = state.element.matches('.title-pager-link, .score-secret-button')
    const insideTitlePager = isTitlePager && pointer.x >= rect.left && pointer.x <= rect.right &&
      pointer.y >= rect.top && pointer.y <= rect.bottom && state.element.contains(document.elementFromPoint(pointer.x, pointer.y))
    const desired = isTitlePager ? (insideTitlePager ? 0.75 : 0) : 1 - Math.exp(-Math.sqrt(borderDistance / 180))
    if (isAvatar) {
      state.ownerGain ??= 0
      state.ownerGain += ((insideOwner ? 1 : 0) - state.ownerGain) * (1 - Math.exp(-dt / 0.25))
      // Crossing into the ring fades the existing wave rather than cutting it off.
      state.ringGain ??= 0
      state.ringGain += ((borderDistance > 0 ? 1 : 0) - state.ringGain) * (1 - Math.exp(-dt / 0.25))
      if (borderDistance > 0) state.lastOutsideStrength = desired
    }
    const targetStrength = isAvatar && borderDistance === 0 ? (state.lastOutsideStrength ?? 0) : desired
    state.strength += (targetStrength - state.strength) * (1 - Math.exp(-dt / (isTitlePager ? 0.18 : isAvatar ? 0.25 : 0.065)))
    // Bound the smoothed value so it also tends to zero at the border.
    if (!isAvatar && !isTitlePager) state.strength = Math.min(state.strength, desired)
    if (active && !(isAvatar && borderDistance === 0)) {
      if (!state.initialized || windowGain < 0.02) state.angle = angle
      else state.angle += Math.atan2(Math.sin(angle - state.angle), Math.cos(angle - state.angle)) * (1 - Math.exp(-dt / 0.045))
      state.initialized = true
    }
    const fadingInsideAvatar = isAvatar && borderDistance === 0 && !!state.frozenWave
    const strength = state.strength * windowGain * (isAvatar ? state.ownerGain * state.ringGain : 1)
    if (fadingInsideAvatar) {
      const frozen = state.frozenWave
      output.push({ ...frozen, id: index, left: rect.left, top: rect.top,
        glowOpacity: frozen.glowOpacity * state.ringGain * windowGain * state.ownerGain })
      continue
    }
    const maxAmplitude = state.element.matches('.title-pager-link, .score-secret-button') ? 0 : isAvatar ? 12 : isPager ? 24 : state.element.matches('.home-profile') ? 48 : 12
    const amplitude = maxAmplitude * strength
    const points = []
    // Keep the original grid, adding a finer grid only on corners and near the peak.
    const sigma = (32 + 15 * strength) * (isAvatar ? 0.45 : isPager ? 0.65 : state.element.matches('.home-profile') ? 1 : 0.5)
    const angles = []
    const geometryKey = `${hw}:${hh}:${radius}`
    if (state.geometryKey !== geometryKey) {
      state.geometryKey = geometryKey
      state.geometry = Array.from({ length: 1920 }, (_, sample) => {
        const theta = sample / 1920 * Math.PI * 2
        const cosine = Math.cos(theta)
        const sine = Math.sin(theta)
        const base = boundary(theta, hw, hh, radius)
        return { sample, theta, cosine, sine, base,
          onCorner: Math.abs(cosine * base) > hw - radius && Math.abs(sine * base) > hh - radius }
      })
    }
    for (const point of state.geometry) {
      const { sample, theta, onCorner } = point
      const delta = Math.atan2(Math.sin(theta - state.angle), Math.cos(theta - state.angle))
      if (sample % 8 === 0 || onCorner || Math.abs(delta * edge) <= 3 * sigma) angles.push(point)
    }
    for (const { theta, base, cosine, sine } of angles) {
      const delta = Math.atan2(Math.sin(theta - state.angle), Math.cos(theta - state.angle))
      const offset = delta * edge
      const gaussian = Math.exp(-0.5 * (offset / sigma) ** 2)
      const r = base + amplitude * gaussian
      points.push(`${points.length ? 'L' : 'M'}${(hw + cosine * r).toFixed(2)},${(hh + sine * r).toFixed(2)}`)
    }
    const kind = isAvatar ? (state.element.closest('.home-profile--about') ? 'avatar-about' : 'avatar')
      : state.element.matches('.home-profile') ? 'profile' : 'card'
    const glowRadius = isPager ? 120 : 155
    const glowScale = 1
    output.push({ id: index, kind, glowRadius, haloBlur: 13 * glowScale, bandBlur: 3 * glowScale, glowOpacity: isAvatar ? Math.min(1, strength * 2) : strength * (isPager ? state.viewportGain : 1),
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      path: points.join(' ') + 'Z', strength, radius,
      gx: hw + Math.cos(state.angle) * edge, gy: hh + Math.sin(state.angle) * edge })
    if (isAvatar && borderDistance > 0) {
      // Preserve geometry independently of the fade envelope at the crossing.
      state.frozenWave = { ...output[output.length - 1] }
      state.frozenWave.glowOpacity /= Math.max(0.000001, state.ringGain * windowGain * state.ownerGain)
    }
  }
  waves.value = output.map(wave => touchDevice && !['top', 'side'].includes(wave.kind)
    ? { ...wave, documentPosition: true, left: wave.left + window.scrollX, top: wave.top + window.scrollY }
    : wave)
  frame = requestAnimationFrame(tick)
}

function move(event) {
  if (touchMedia?.matches) return
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
  if (isVideoPlayer(event.target)) {
    leave()
    return
  }
  pointer = { x: event.clientX, y: event.clientY }
  active = true
}
function isVideoPlayer(element) {
  return element instanceof HTMLIFrameElement &&
    new URL(element.src, location.href).hostname === 'player.bilibili.com'
}
function leave() { active = false }
function out(event) {
  if (!event.relatedTarget || isVideoPlayer(event.relatedTarget)) leave()
}
function visibility() { if (document.hidden) leave() }
watch(effectsEnabled, enabled => {
  if (!media) return
  cancelAnimationFrame(frame)
  frame = 0
  windowGain = 0
  states = []
  waves.value = []
  if (enabled) { previousTime = 0; frame = requestAnimationFrame(tick) }
})

onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)')
  touchMedia = matchMedia('(hover: none), (pointer: coarse)')
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerover', move, { passive: true })
  window.addEventListener('pointerout', out)
  window.addEventListener('blur', leave)
  document.documentElement.addEventListener('pointerleave', leave)
  document.addEventListener('visibilitychange', visibility)
  syncFrameBindings()
  frameObserver = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
      node.nodeType === 1 && (node.matches('iframe') || node.querySelector('iframe'))))) syncFrameBindings()
  })
  frameObserver.observe(document.body, { childList: true, subtree: true })
  frame = requestAnimationFrame(tick)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  frameObserver?.disconnect()
  for (const binding of frameBindings.values()) binding.cleanup()
  frameBindings.clear()
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerover', move)
  window.removeEventListener('pointerout', out)
  window.removeEventListener('blur', leave)
  document.documentElement.removeEventListener('pointerleave', leave)
  document.removeEventListener('visibilitychange', visibility)
})
</script>

<template>
  <div class="home-wave-layer" aria-hidden="true">
    <Teleport v-for="wave in waves" :key="wave.id" :to="wave.kind === 'top' && navTarget ? navTarget : 'body'">
    <svg aria-hidden="true" class="home-wave" :class="wave.kind ? `home-wave--${wave.kind}` : 'home-wave--card'"
      :style="{ position: wave.kind === 'top' || wave.documentPosition ? 'absolute' : 'fixed', left: wave.left + 'px', top: wave.top + 'px', width: wave.width + 'px', height: wave.height + 'px', opacity: wave.glowOpacity ?? wave.strength }"
      :viewBox="`0 0 ${wave.width} ${wave.height}`">
      <defs>
        <filter :id="`wave-halo-${wave.id}`" filterUnits="userSpaceOnUse"
          x="-150" y="-150" :width="wave.width + 300" :height="wave.height + 300" color-interpolation-filters="sRGB">
          <feGaussianBlur :stdDeviation="wave.haloBlur ?? 13" />
        </filter>
        <filter :id="`wave-band-${wave.id}`" filterUnits="userSpaceOnUse"
          x="-150" y="-150" :width="wave.width + 300" :height="wave.height + 300" color-interpolation-filters="sRGB">
          <feGaussianBlur :stdDeviation="wave.bandBlur ?? 3" />
        </filter>
        <radialGradient :id="`wave-color-${wave.id}`" gradientUnits="userSpaceOnUse" :cx="wave.gx" :cy="wave.gy" :r="wave.glowRadius ?? 155">
          <stop offset="0" class="wave-color-core" />
          <stop offset="0.18" class="wave-color-inner" />
          <stop offset="0.48" class="wave-color-middle" stop-opacity="0.85" />
          <stop offset="0.82" class="wave-color-outer" stop-opacity="0.2" />
          <stop offset="1" class="wave-color-middle" stop-opacity="0" />
        </radialGradient>
        <mask v-if="wave.kind === 'avatar' || wave.kind === 'avatar-about'"
          :id="`avatar-outside-${wave.id}`" maskUnits="userSpaceOnUse"
          x="-100" y="-100" :width="wave.width + 200" :height="wave.height + 200">
          <rect x="-100" y="-100" :width="wave.width + 200" :height="wave.height + 200" fill="white" />
          <ellipse :cx="wave.width / 2" :cy="wave.height / 2"
            :rx="wave.width / 2" :ry="wave.height / 2" fill="black" />
        </mask>
      </defs>
      <g :mask="wave.kind === 'avatar' || wave.kind === 'avatar-about' ? `url(#avatar-outside-${wave.id})` : undefined">
      <path :d="wave.path" :stroke="`url(#wave-color-${wave.id})`" stroke-width="24" :filter="`url(#wave-halo-${wave.id})`" />
      <path :d="wave.path" :stroke="`url(#wave-color-${wave.id})`" stroke-width="7" :filter="`url(#wave-band-${wave.id})`" />
      <path :d="wave.path" :stroke="`url(#wave-color-${wave.id})`" stroke-width="1.5" />
      </g>
    </svg>
    </Teleport>
  </div>
</template>

<style scoped>
.home-wave-layer {
  /* No shared stacking context: sidebar waves sit between sidebar and navbar. */
  display: contents;
  pointer-events: none;
}
.home-wave {
  position: fixed;
  overflow: visible;
  fill: none;
  pointer-events: none;
}
.home-wave--card { z-index: 12; }
.home-wave--profile { z-index: 2001; }
.home-wave--avatar { z-index: 2002; }
.home-wave--avatar-about { z-index: 12; }
.home-wave--top {
  z-index: 101;
  /* The local origin is the navbar's bottom edge; discard its inner half. */
  clip-path: inset(0 -200px -200px -200px);
}
.home-wave--side {
  z-index: 95;
  /* Keep only the right/outside half, below the navbar and within its span. */
  clip-path: inset(0 -200px 0 0);
}
.wave-color-core { stop-color: #edffff; }
.wave-color-inner { stop-color: #72efff; }
.wave-color-middle { stop-color: #a48aff; }
.wave-color-outer { stop-color: #ea7bff; }
:global(html:not(.dark) .wave-color-core) { stop-color: #ffffff; }
:global(html:not(.dark) .wave-color-inner) { stop-color: #edc88d; }
:global(html:not(.dark) .wave-color-middle) { stop-color: #78adf2; }
:global(html:not(.dark) .wave-color-outer) { stop-color: #4385d8; }
</style>
