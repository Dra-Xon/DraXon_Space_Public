<script setup>
import { withBase, useRoute, useData } from 'vitepress'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import bilibiliIconSvg from '../../../public/images/bilibili-line.svg?raw'
import { effectsEnabled } from '../effects.js'
import { reflectAxis } from '../card-collision.js'
const props = defineProps({ placement: { type: String, default: 'home' } })
const route = useRoute()
const card = ref(null)
const impacts = ref([])
let impactId = 0
function clearImpacts() { impacts.value = [] }
function finishImpact(id) { impacts.value = impacts.value.filter(impact => impact.id !== id) }
function glowImpact(side, normalSpeed) {
  if (!effectsEnabled.value || props.placement !== 'home' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const strength = (isDark.value ? 0.1 : 0.2) + 0.8 * Math.min(Math.abs(normalSpeed) / 1800, 1)
  // A new DOM node restarts the pulse; separate edges can flash at a corner.
  impacts.value = [...impacts.value.filter(impact => impact.side !== side),
    { id: ++impactId, side, strength }]
}
const position = ref(null)
const origin = ref(null)
const dragging = ref(false)
const moving = ref(false)
const textSelectable = ref(false)
const avatarLinkReady = ref(false)
let avatarHoverTimer = null
function leaveAvatar() {
  clearTimeout(avatarHoverTimer)
  avatarLinkReady.value = false
}
function enterAvatar() {
  if (props.placement !== 'home' || dragging.value) return
  leaveAvatar()
  avatarHoverTimer = setTimeout(() => { avatarLinkReady.value = true }, 300)
}
function moveAvatar(event) {
  if (props.placement !== 'home' || dragging.value || avatarLinkReady.value || event.buttons) return
  enterAvatar()
}
let textHoverTimer = null
function enterText() {
  if (props.placement !== 'home' || dragging.value) return
  clearTimeout(textHoverTimer)
  textHoverTimer = setTimeout(() => { textSelectable.value = true }, 600)
}
function leaveText() {
  clearTimeout(textHoverTimer)
  textSelectable.value = false
}
const cardStyle = computed(() => props.placement === 'home' && position.value
  ? { left: origin.value.x + 'px', top: origin.value.y + 'px', right: 'auto', bottom: 'auto',
      transform: `translate3d(${position.value.x - origin.value.x}px, ${position.value.y - origin.value.y}px, 0)` } : {})
let motion = 0
let dragFrame = 0
let pendingPosition = null
let cachedBounds = null
let drag = null
let vx = 0
let vy = 0
function bounds() {
  const rect = card.value.getBoundingClientRect()
  const top = Math.max(0, document.querySelector('.VPNavBar')?.getBoundingClientRect().bottom ?? 64)
  return { top, right: Math.max(0, innerWidth - rect.width), bottom: Math.max(top, innerHeight - rect.height) }
}
function constrain() {
  if (props.placement !== 'home' || !card.value) return
  const rect = card.value.getBoundingClientRect()
  const b = bounds()
  cachedBounds = b
  if (!origin.value) origin.value = { x: rect.left, y: rect.top }
  position.value = { x: Math.max(0, Math.min(b.right, position.value?.x ?? rect.left)),
    y: Math.max(b.top, Math.min(b.bottom, position.value?.y ?? rect.top)) }
}
function reset() {
  clearImpacts()
  leaveAvatar()
  leaveText()
  cancelAnimationFrame(motion)
  cancelAnimationFrame(dragFrame)
  dragFrame = 0
  pendingPosition = null
  cachedBounds = null
  if (drag && card.value?.hasPointerCapture(drag.id)) card.value.releasePointerCapture(drag.id)
  drag = null
  dragging.value = false
  moving.value = false
  position.value = null
  origin.value = null
  vx = vy = 0
}
watch(() => route.path, reset)
watch(effectsEnabled, enabled => { if (!enabled) reset() })
function start(event) {
  const avatarTarget = event.target.closest('.home-profile-avatar-link')
  if (!effectsEnabled.value || props.placement !== 'home' || event.button !== 0 ||
    (event.target.closest('a,button,input') && !(avatarTarget && !avatarLinkReady.value))) return
  if (textSelectable.value && event.target.closest('.home-profile-name')) return
  clearImpacts()
  leaveText()
  leaveAvatar()
  cancelAnimationFrame(motion)
  cancelAnimationFrame(dragFrame)
  dragFrame = 0
  pendingPosition = null
  constrain()
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() }
  vx = vy = 0
  dragging.value = true
  moving.value = true
  card.value.setPointerCapture(event.pointerId)
  event.preventDefault()
}
function move(event) {
  if (!drag || event.pointerId !== drag.id) return
  const now = performance.now()
  const dt = Math.max(0.008, (now - drag.time) / 1000)
  const dx = event.clientX - drag.x
  const dy = event.clientY - drag.y
  const current = pendingPosition || position.value
  const b = cachedBounds
  pendingPosition = { x: Math.max(0, Math.min(b.right, current.x + dx)),
    y: Math.max(b.top, Math.min(b.bottom, current.y + dy)) }
  if (!dragFrame) dragFrame = requestAnimationFrame(() => {
    dragFrame = 0
    position.value = pendingPosition
    pendingPosition = null
  })
  vx = Math.max(-1800, Math.min(1800, dx / dt))
  vy = Math.max(-1800, Math.min(1800, dy / dt))
  drag = { id: drag.id, x: event.clientX, y: event.clientY, time: now }
}
function end(event) {
  if (!drag || event.pointerId !== drag.id) return
  cancelAnimationFrame(dragFrame)
  dragFrame = 0
  if (pendingPosition) position.value = pendingPosition
  pendingPosition = null
  const age = performance.now() - drag.time
  const cancelled = event.type !== 'pointerup'
  drag = null
  dragging.value = false
  if (card.value.hasPointerCapture(event.pointerId)) card.value.releasePointerCapture(event.pointerId)
  if (cancelled || age > 100) vx = vy = 0
  let previous = performance.now()
  function step(now) {
    if (!position.value) return
    const dt = Math.min(0.032, (now - previous) / 1000)
    previous = now
    const b = cachedBounds
    let { x, y } = position.value
    x += vx * dt; y += vy * dt
    const horizontal = reflectAxis(x, vx, 0, b.right)
    const vertical = reflectAxis(y, vy, b.top, b.bottom)
    if (horizontal.side) glowImpact(horizontal.side === 'min' ? 'left' : 'right', vx)
    if (vertical.side) glowImpact(vertical.side === 'min' ? 'top' : 'bottom', vy)
    x = horizontal.position; vx = horizontal.velocity
    y = vertical.position; vy = vertical.velocity
    vx *= Math.exp(-1.6 * dt); vy *= Math.exp(-1.6 * dt)
    position.value = { x, y }
    if (Math.hypot(vx, vy) > 8) motion = requestAnimationFrame(step)
    else moving.value = false
  }
  if (!cancelled && !matchMedia('(prefers-reduced-motion: reduce)').matches) motion = requestAnimationFrame(step)
  else moving.value = false
}
function blur() {
  clearImpacts()
  if (drag) end({ pointerId: drag.id, type: 'pointercancel' })
  cancelAnimationFrame(motion)
  moving.value = false
}
onMounted(() => { window.addEventListener('resize', constrain); window.addEventListener('blur', blur) })
onBeforeUnmount(() => { reset(); window.removeEventListener('resize', constrain); window.removeEventListener('blur', blur) })

// Replace this public asset to update the avatar without changing the layout.
const { isDark } = useData()
const avatarSrc = computed(() => withBase(isDark.value ? '/images/Avatar_Dark.svg' : '/images/Avatar_Light.svg'))
const aboutHref = withBase('/about.html')
const homeHref = withBase('/')
</script>

<template>
  <aside ref="card" class="home-profile" :style="cardStyle"
    :class="{ 'home-profile--about': placement === 'about', 'home-profile--dragging': dragging, 'home-profile--moving': moving }"
    @pointerdown="start" @pointermove="move" @pointerup="end" @pointercancel="end" @lostpointercapture="end"
    aria-label="个人介绍">
    <div v-if="placement === 'home'" class="card-impact-layer" aria-hidden="true">
      <span v-for="impact in impacts" :key="impact.id" :data-edge="impact.side" class="card-impact-edge"
        :style="{ '--impact-strength': impact.strength }" @animationend="finishImpact(impact.id)"></span>
    </div>
    <a v-if="placement === 'about'" class="home-profile-avatar-link" :href="homeHref" aria-label="返回首页" title="首页" draggable="false" @dragstart.prevent>
      <img class="home-profile-avatar" :src="avatarSrc" alt="头像" width="128" height="128" draggable="false" />
    </a>
    <a v-else class="home-profile-avatar-link" :class="{ 'home-profile-avatar-link--ready': avatarLinkReady || !effectsEnabled }"
      draggable="false" @dragstart.prevent
      :href="avatarLinkReady || !effectsEnabled ? aboutHref : undefined" aria-label="关于示意信息" title="关于"
      @pointerenter="enterAvatar" @pointermove="moveAvatar" @pointerleave="leaveAvatar"
      @focus="avatarLinkReady = true" @blur="leaveAvatar" tabindex="0"
      @click="event => { if (!avatarLinkReady && effectsEnabled) event.preventDefault() }">
      <img class="home-profile-avatar" :src="avatarSrc" alt="头像" width="128" height="128" draggable="false" />
    </a>
    <div class="home-profile-info">
    <div class="home-profile-identity">
    <span class="home-profile-name" :class="{ 'home-profile-name--selectable': textSelectable }"
      @pointerenter="enterText" @pointerleave="leaveText">{{ placement === 'home' ? '示意信息' : 'Item' }}</span>
    <span v-if="placement === 'about'" class="home-profile-location"><span aria-hidden="true">📍</span> &nbsp;示意信息</span>
    </div>
    <div class="home-profile-socials" aria-label="社交链接">
      <a href="https://www.bilibili.com/" target="_blank"
        rel="noopener noreferrer" class="social-link" title="链接1" aria-label="链接1">
        <span class="bilibili-icon" aria-hidden="true" v-html="bilibiliIconSvg"></span>
      </a>
      <a href="https://github.com/" target="_blank"
        rel="noopener noreferrer" class="social-link" title="链接2" aria-label="链接2">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.22-3.37-1.22-.46-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.58 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.2 9.2 0 0 1 12 7.06c.85 0 1.7.12 2.5.36 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.35 4.8-4.58 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.27 10.27 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
        </svg>
      </a>
    </div>
    </div>
  </aside>
</template>

<style scoped>
.card-impact-layer { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; z-index: 1; }
.card-impact-edge { display: block; position: absolute; opacity: 0; pointer-events: none; animation: card-impact-pulse 420ms ease-out both; }
@keyframes card-impact-pulse {
  0%, 16% { opacity: var(--impact-strength); }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) { .card-impact-edge { display: none; } }
.card-impact-edge[data-edge="left"] { inset: 0 auto 0 0; width: 24px; background: radial-gradient(ellipse 24px 70% at left center, #fff 0%, rgba(255,255,255,.88) 16%, rgba(255,255,255,.61) 32%, rgba(255,255,255,.32) 48%, rgba(255,255,255,.14) 64%, rgba(255,255,255,.04) 80%, transparent 100%); }
.card-impact-edge[data-edge="right"] { inset: 0 0 0 auto; width: 24px; background: radial-gradient(ellipse 24px 70% at right center, #fff 0%, rgba(255,255,255,.88) 16%, rgba(255,255,255,.61) 32%, rgba(255,255,255,.32) 48%, rgba(255,255,255,.14) 64%, rgba(255,255,255,.04) 80%, transparent 100%); }
.card-impact-edge[data-edge="top"] { inset: 0 0 auto 0; height: 24px; background: radial-gradient(ellipse 70% 24px at center top, #fff 0%, rgba(255,255,255,.88) 16%, rgba(255,255,255,.61) 32%, rgba(255,255,255,.32) 48%, rgba(255,255,255,.14) 64%, rgba(255,255,255,.04) 80%, transparent 100%); }
.card-impact-edge[data-edge="bottom"] { inset: auto 0 0 0; height: 24px; background: radial-gradient(ellipse 70% 24px at center bottom, #fff 0%, rgba(255,255,255,.88) 16%, rgba(255,255,255,.61) 32%, rgba(255,255,255,.32) 48%, rgba(255,255,255,.14) 64%, rgba(255,255,255,.04) 80%, transparent 100%); }
.home-profile {
  position: fixed;
  /* Keep the right inset aligned with the home hero. */
  right: 64px;
  bottom: 88px;
  width: 420px;
  max-width: calc(100% - 128px);
  padding: 24px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 14px;
  outline: 1px solid var(--home-glass-outline);
  outline-offset: 0;
  background: rgba(255, 255, 255, 0.20);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  z-index: 2000;
}
.home-profile:not(.home-profile--about) { cursor: move; touch-action: none; }
.home-profile--dragging { cursor: move !important; user-select: none; }
@media (hover: none), (pointer: coarse) {
  .home-profile--moving {
    will-change: transform;
  }
}
.home-profile a { cursor: pointer; }
.home-profile:not(.home-profile--about) .home-profile-avatar-link { cursor: move; }
.home-profile:not(.home-profile--about) .home-profile-avatar-link--ready { cursor: pointer; }
.home-profile:not(.home-profile--about) .home-profile-name { user-select: none; }
.home-profile:not(.home-profile--about) .home-profile-name--selectable {
  cursor: text;
  user-select: text;
}
.home-profile:not(.home-profile--about) {
  width: 360px;
  padding: 24px;
  gap: 12px;
}

.home-profile-avatar-link {
  flex-shrink: 0;
  display: block;
  width: 128px;
  height: 128px;
  border-radius: 50%;
}

.home-profile-avatar-link:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 8px;
}

.home-profile-avatar {
  -webkit-user-drag: none;
  display: block;
  width: 128px;
  height: 128px;
  object-fit: cover;
  border-radius: 50%;
  background: #fff;
  outline: 1px solid var(--home-glass-outline);
  outline-offset: 4px;
}

.home-profile-avatar-link {
  position: relative;
  --avatar-highlight-blur: 3.25px;
  --avatar-highlight-core-opacity: 0.6;
  --avatar-highlight-middle-opacity: 0.4;
  --avatar-highlight-outer-opacity: 0.08;
}
.home-profile-avatar-link::after {
  content: '';
  position: absolute;
  inset: -40px;
  border-radius: 50%;
  pointer-events: none;
  /* Gaussian-like outward falloff: no solid band to thicken the ring. */
  background: radial-gradient(circle,
    rgb(255 255 255 / var(--avatar-highlight-core-opacity)) 0 68.5px,
    rgb(255 255 255 / var(--avatar-highlight-middle-opacity)) calc(68.5px + var(--avatar-highlight-blur)),
    rgb(255 255 255 / var(--avatar-highlight-outer-opacity)) calc(68.5px + var(--avatar-highlight-blur) * 2),
    transparent calc(68.5px + var(--avatar-highlight-blur) * 3));
  mask-image: radial-gradient(circle, transparent 0 66.5px, black 68px);
  -webkit-mask-image: radial-gradient(circle, transparent 0 66.5px, black 68px);
  opacity: 0;
}
.home-profile-avatar-link:has(.home-profile-avatar:hover)::after { opacity: 1; }
:global(html:not(.dark) .home-profile-avatar-link) {
  --avatar-highlight-core-opacity: 0.8;
  --avatar-highlight-middle-opacity: 0.5;
  --avatar-highlight-outer-opacity: 0.12;
}

.home-profile-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.home-profile-name {
  color: var(--site-bright-text);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.5;
  text-align: center;
  white-space: nowrap;
  letter-spacing: 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.home-profile-socials {
  display: flex;
  align-items: center;
  gap: 10px;
}

:global(html.dark) {
  --home-profile-background: rgba(25, 25, 28, 0.62);
}

.home-profile {
  background: var(--home-profile-background, rgba(255, 255, 255, 0.20));
}

@media (max-width: 959px) {
  .home-profile:not(.home-profile--about) {
    padding: 24px;
    gap: 12px;
  }
  .home-profile {
    right: 48px;
    padding: 16px;
    gap: 16px;
    max-width: calc(100% - 96px);
  }
}

@media (max-width: 639px) {
  .home-profile {
    right: 24px;
    max-width: calc(100% - 48px);
  }
  .home-profile-name {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
/* Keep the moved card in document flow, ahead of the about heading. */
.home-profile.home-profile--about {
  position: static;
  max-width: 100%;
  margin-bottom: 32px;
  border-color: transparent;
  outline: none;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.home-profile--about .home-profile-name {
  font-size: 32px;
  font-weight: 1000;
}

@media (min-width: 768px) {
  .home-profile--about .home-profile-name {
    font-size: 36px;
  }
}

.home-profile-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.home-profile--about .home-profile-identity {
  align-items: flex-start;
}

.home-profile-location {
  color: var(--site-bright-text);
  font-size: 20px;
  line-height: 1.5;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.home-profile.home-profile--about {
  width: 660px;
  gap: 48px;
}

.home-profile--about .home-profile-info {
  flex-direction: row;
  justify-content: space-between;
  gap: 24px;
}

.home-profile--about .home-profile-socials {
  flex-shrink: 0;
  align-self: flex-start;
  /* Match the center of the first identity line, excluding the location below. */
  margin-top: calc(32px * 1.5 / 2 - 60px / 2);
}

@media (min-width: 768px) {
  .home-profile--about .home-profile-socials {
    margin-top: calc(36px * 1.5 / 2 - 60px / 2);
  }
}

@media (max-width: 639px) {
  .home-profile--about .home-profile-info {
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 16px;
  }
}
</style>
