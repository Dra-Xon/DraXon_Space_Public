import DefaultTheme from 'vitepress/theme'
import HiddenScoreToggle from './components/HiddenScoreToggle.vue'
import { restoreHiddenScores, updateHiddenScoreRoute } from './hidden-score-state.js'
import VPNavBarHamburger from '../../../node_modules/vitepress/dist/client/theme-default/components/VPNavBarHamburger.vue'
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useData, withBase, dataSymbol } from 'vitepress'
import './custom.css'
import footerLines from '../footer.json'
import PdfViewer from './components/PdfViewer.vue'
import ScoreTables from './components/ScoreTables.vue'
import ScoreSection from './components/ScoreSection.vue'
import ScoreVideo from './components/ScoreVideo.vue'
import BackgroundSlideshow from './components/BackgroundSlideshow.vue'
import IntroGlass from './components/IntroGlass.vue'
import BackgroundToggle from './components/BackgroundToggle.vue'
import HomeProfile from './components/HomeProfile.vue'
import HomeWaveGlow from './components/HomeWaveGlow.vue'
import EffectsToggle from './components/EffectsToggle.vue'
import EffectsStar from './components/EffectsStar.vue'
import ScoreImage from './components/ScoreImage.vue'
import ScoreResourceStatus from './components/ScoreResourceStatus.vue'
import SidebarResize from './components/SidebarResize.vue'
import ScoreSort from './components/ScoreSort.vue'
import ScoreAccordion from './components/ScoreAccordion.vue'
import NavSearch from './components/NavSearch.vue'
import InlineHint from './components/InlineHint.vue'
import TitlePager from './components/TitlePager.vue'
import ScoreLibraryStats from './components/ScoreLibraryStats.vue'
import ScoreCategoryLink from './components/ScoreCategoryLink.vue'
import { effectsEnabled } from './effects.js'
import { sortedScoreItems, sortedOtherScoreItems, sortedAnimeScoreItems, themeWithSortedScores } from './score-sort-state.js'

export default {
  extends: DefaultTheme,

  enhanceApp({ app, router }) {
    // 全局注册 PDF 组件
    app.component('PdfViewer', PdfViewer)
    app.component('BackgroundToggle', BackgroundToggle)
    app.component('ScoreTables', ScoreTables)
    app.component('ScoreSection', ScoreSection)
    app.component('ScoreVideo', ScoreVideo)
    app.component('ScoreImage', ScoreImage)
    app.component('ScoreResourceStatus', ScoreResourceStatus)
    app.component('InlineHint', InlineHint)
    app.component('TitlePager', TitlePager)
    app.component('ScoreLibraryStats', ScoreLibraryStats)
    app.component('ScoreCategoryLink', ScoreCategoryLink)
    app.component('EffectsStar', EffectsStar)
    if (typeof document !== 'undefined') {
      let animation = null
      let navigation = 0
      let transitioning = false
      const previousBefore = router.onBeforePageLoad
      const previousAfter = router.onAfterRouteChange ?? router.onAfterRouteChanged
      // Both link navigation and browser history pass through page loading.
      router.onBeforePageLoad = async href => {
        const ticket = ++navigation
        if (await previousBefore?.(href) === false) return false
        if (ticket !== navigation) return false
        const target = new URL(href, location.href)
        if (target.pathname === router.route.path) return
        animation?.cancel()
        transitioning = false
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const content = document.querySelector('.VPContent')
        if (!content) return
        transitioning = true
        document.dispatchEvent(new CustomEvent('site-content-fade', { detail: { enter: false, duration: 140 } }))
        animation = content.animate([{ opacity: getComputedStyle(content).opacity }, { opacity: 0 }],
          { duration: 140, easing: 'ease-in', fill: 'forwards' })
        try { await animation.finished } catch { /* Superseded navigation. */ }
        if (ticket !== navigation) return false
      }
      router.onAfterRouteChange = async href => {
        const ticket = navigation
        await previousAfter?.(href)
        await nextTick()
        if (!transitioning) return
        transitioning = false
        const content = document.querySelector('.VPContent')
        if (content && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const detail = { enter: true, duration: 160, ready: null }
          document.dispatchEvent(new CustomEvent('site-content-fade', { detail }))
          await detail.ready
          if (ticket !== navigation) return
          animation?.cancel()
          animation = content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' })
        } else {
          animation?.cancel()
          animation = null
        }
      }
    }
  },

  Layout: defineComponent({
    setup() {
    onMounted(() => restoreHiddenScores(route.path))
    const route = useRoute()
    let bookmarkMaskSvg
    let bookmarkMask
    const syncBookmarkGlass = (settled = false) => {
      const nav = document.querySelector('.VPNav')
      if (!nav) return
      const bounds = nav.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      if (!bookmarkMask) {
        const ns = 'http://www.w3.org/2000/svg'
        bookmarkMaskSvg = document.createElementNS(ns, 'svg')
        bookmarkMaskSvg.setAttribute('width', '0')
        bookmarkMaskSvg.setAttribute('height', '0')
        bookmarkMaskSvg.style.position = 'absolute'
        bookmarkMaskSvg.setAttribute('aria-hidden', 'true')
        bookmarkMask = document.createElementNS(ns, 'mask')
        bookmarkMask.id = 'site-nav-bookmark-mask'
        bookmarkMask.setAttribute('maskUnits', 'userSpaceOnUse')
        bookmarkMask.setAttribute('maskContentUnits', 'userSpaceOnUse')
        bookmarkMask.style.maskType = 'luminance'
        bookmarkMaskSvg.append(bookmarkMask)
        nav.append(bookmarkMaskSvg)
      }
      bookmarkMask.setAttribute('x', '0')
      bookmarkMask.setAttribute('y', '0')
      bookmarkMask.setAttribute('width', String(bounds.width))
      bookmarkMask.setAttribute('height', String(bounds.height))
      // Sample the actual CSS transition, including outgoing tabs and interruptions.
      const shapes = [...nav.querySelectorAll('.VPNavBarMenuLink')].map(link => {
        if (settled === true && !link.classList.contains('active')) return ''
        const style = getComputedStyle(link, '::before')
        if (style.visibility === 'hidden') return ''
        const opacity = settled === true ? 1 : Number(style.opacity)
        if (!opacity) return ''
        const tab = link.getBoundingClientRect()
        const offset = settled === true || style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m42
        return `<path opacity="${opacity}" transform="translate(${tab.left - bounds.left - 12} ${tab.top - bounds.top + 4 + offset}) scale(${(tab.width + 24) / 120} ${(tab.height - 4) / 54})" d="M0 54Q14 54 14 40V14Q14 2 28 2H92Q106 2 106 14V40Q106 54 120 54Z"/>`
      }).join('')
      // Update vector nodes directly; data-URL images decode asynchronously and
      // can leave the preceding animation frame visible after the tab settles.
      bookmarkMask.innerHTML = `<rect width="${bounds.width}" height="${bounds.height}" fill="white"/>${shapes}`
      nav.setAttribute('data-bookmark-ready', '')
    }
    let bookmarkObserver
    let bookmarkFrame
    let bookmarkUnmounted = false
    const animateBookmarkGlass = () => {
      if (bookmarkUnmounted) return
      cancelAnimationFrame(bookmarkFrame)
      const until = performance.now() + 250
      const tick = () => {
        syncBookmarkGlass()
        if (performance.now() < until) bookmarkFrame = requestAnimationFrame(tick)
        else syncBookmarkGlass(true)
      }
      tick()
    }
    onMounted(() => {
      bookmarkObserver = new ResizeObserver(syncBookmarkGlass)
      const nav = document.querySelector('.VPNav')
      if (nav) bookmarkObserver.observe(nav)
      nav?.querySelectorAll('.VPNavBarMenuLink').forEach(link => bookmarkObserver.observe(link))
      nav?.querySelectorAll('.VPNavBarMenu, .content-body').forEach(element => bookmarkObserver.observe(element))
      window.addEventListener('resize', syncBookmarkGlass)
      document.fonts.ready.then(syncBookmarkGlass)
      animateBookmarkGlass()
    })
    watch(() => route.path, async () => { await nextTick(); animateBookmarkGlass() })
    onBeforeUnmount(() => {
      bookmarkUnmounted = true
      cancelAnimationFrame(bookmarkFrame)
      bookmarkObserver?.disconnect()
      bookmarkMaskSvg?.remove()
      document.querySelector('.VPNav')?.removeAttribute('data-bookmark-ready')
      window.removeEventListener('resize', syncBookmarkGlass)
    })
    const layoutData = useData()
    const { frontmatter, isDark } = layoutData
    // Theme changes can move the menu without resizing its individual links.
    // Re-sample after Vue applies the theme so the cutout and glass stay aligned.
    watch(isDark, async () => {
      await nextTick()
      animateBookmarkGlass()
    }, { flush: 'post' })
    const preserveIndexFolds = ref(false)
    const preserveOnScoreReturn = event => {
      const link = event.target instanceof Element
        ? event.target.closest('a[href]') : null
      if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return
      const url = new URL(link.href, location.href)
      const indexPath = withBase('/Scores/')
      const indexPaths = [indexPath, indexPath + 'index.html', indexPath.slice(0, -1)]
      const fromScore = route.path.startsWith(indexPath) && !indexPaths.includes(route.path)
      if (fromScore && url.origin === location.origin && indexPaths.includes(url.pathname)) {
        document.dispatchEvent(new CustomEvent('site-score-fold-snapshot'))
        preserveIndexFolds.value = true
      }
    }
    onMounted(() => document.addEventListener('click', preserveOnScoreReturn, true))
    onBeforeUnmount(() => document.removeEventListener('click', preserveOnScoreReturn, true))
    watch(() => frontmatter.value.scoreIndex, async scoreIndex => {
      if (scoreIndex && preserveIndexFolds.value) {
        await nextTick()
        document.dispatchEvent(new CustomEvent('site-score-fold-restore'))
      }
    }, { flush: 'post' })
    watch(() => route.path, path => {
      if (![withBase('/Scores/'), withBase('/Scores/index.html'), withBase('/Scores')].includes(path)) preserveIndexFolds.value = false
    }, { flush: 'sync' })
    provide(dataSymbol, { ...layoutData, theme: computed(() => {
      let theme = themeWithSortedScores(layoutData.theme.value, sortedScoreItems.value, sortedOtherScoreItems.value, sortedAnimeScoreItems.value)
      if (frontmatter.value.scoreIndex && !preserveIndexFolds.value) {
        theme = { ...theme, sidebar: { ...theme.sidebar, '/Scores/': theme.sidebar['/Scores/'].map(section => ({
          ...section, items: section.items?.map(group => ({ ...group, collapsed: true }))
        })) } }
      }
      return effectsEnabled.value ? {
        ...theme,
        lightModeSwitchTitle: '切换至明净天光',
        darkModeSwitchTitle: '切换至暗夜虹光'
      } : theme
    }) })
    const preventNativeDrag = event => {
      if (event.target instanceof Element && event.target.closest('img,a')) event.preventDefault()
    }
    onMounted(() => document.addEventListener('dragstart', preventNativeDrag, true))
    onBeforeUnmount(() => document.removeEventListener('dragstart', preventNativeDrag, true))
    const syncFavicon = () => {
      if (typeof document === 'undefined') return
      const icon = document.querySelector('link[rel="icon"]')
      if (icon) icon.href = withBase(`/images/avatar-favicon-${isDark.value ? 'dark' : 'light'}.svg`)
    }
    onMounted(() => {
      syncFavicon()
      for (const name of ['Avatar_Light.svg', 'Avatar_Dark.svg']) {
        const image = new Image()
        image.src = withBase('/images/' + name)
      }
    })
    watch(isDark, syncFavicon)
    const isCollapsed = ref(false)

    const isHomePage = computed(() => route.path === withBase('/'))

    const resetSidebar = () => {
      isCollapsed.value = false
      if (typeof document !== 'undefined') document.body.classList.remove('sidebar-collapsed')
    }
    onMounted(() => document.addEventListener('site-score-category', resetSidebar))
    onBeforeUnmount(() => document.removeEventListener('site-score-category', resetSidebar))
    watch(() => route.path, resetSidebar, { immediate: true, flush: 'sync' })
    watch(() => route.path, updateHiddenScoreRoute, { flush: 'sync' })
    onBeforeUnmount(resetSidebar)

    const toggleSidebar = () => {
      isCollapsed.value = !isCollapsed.value

      if (isCollapsed.value) {
        document.body.classList.add('sidebar-collapsed')
      } else {
        document.body.classList.remove('sidebar-collapsed')
      }
    }

    return () => h(DefaultTheme.Layout, null, {
      'nav-bar-content-before': () => h(NavSearch),
      'nav-bar-content-after': () => h(EffectsToggle),
      'layout-top': () => [
        h(BackgroundSlideshow),
        h(IntroGlass),
        h(HomeWaveGlow),
        h(SidebarResize),
        h(ScoreAccordion),
        h(ScoreSort, { groupIndex: 0 }),
        h(ScoreSort, { groupIndex: 1 }),
        h(ScoreSort, { groupIndex: 2 }),
        
        !isHomePage.value && frontmatter.value.sidebar !== false ? h(
		  VPNavBarHamburger,
		  {
			class: [
			  'fixed-toggle-btn',
			  'desktop-only',
			  {
				'home-page': isHomePage.value
			  }
			],
			type: 'button',
            title: '切换侧边栏',
            'aria-label': '切换侧边栏',
            'aria-expanded': !isCollapsed.value,
            'aria-controls': 'VPSidebarNav',
			active: !isCollapsed.value,
			onClick: toggleSidebar
		  },
		  []
		) : null,
      ],
      'doc-after': () => frontmatter.value.scoreIndex ? h(HiddenScoreToggle) : null,
      'doc-before': () => frontmatter.value.profileCard ? h(HomeProfile, { placement: 'about' }) : null,
      'home-features-after': () => h(HomeProfile, { placement: 'home' }),
      'layout-bottom': () => h('footer', { class: 'site-copyright', 'aria-label': '版权声明' }, footerLines.map(line => h('div', line)))
    })
    }
  })
}
