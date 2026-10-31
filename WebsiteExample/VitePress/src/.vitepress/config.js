import { defineConfig } from 'vitepress'
import { splitSearchSections } from './search-sections.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { buildScoreSidebar } from './score-sidebar.mjs'
import { getDeployment } from '../../deployment.mjs'

const deployment = getDeployment()

const navItems = [
  { text: '首页', link: '/' },
  { text: '栏目1', link: '/Scores/' },
  { text: '栏目2', link: '/PdTS/' },
  { text: '栏目3', link: '/about' }
].map(item => item.link !== '/' && item.link.endsWith('/')
  ? { ...item, activeMatch: '^' + item.link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
  : item)

function getSidebarTitleForDir(dirName) {
  const navItem = navItems.find(({ link }) => {
    const firstPathSegment = link.split(/[?#]/, 1)[0].split('/').filter(Boolean)[0]
    return firstPathSegment?.toLocaleLowerCase() === dirName.toLocaleLowerCase()
  })
  return navItem?.text ?? dirName
}

// 动态自动读取目录并生成 VitePress 侧边栏菜单
function getSidebarForDir(dirPath, titlePrefix = '') {
  const absolutePath = path.resolve(__dirname, '../', dirPath)
  if (!fs.existsSync(absolutePath)) return []

  const files = fs.readdirSync(absolutePath)
  const items = []
  const metadataPath = path.join(__dirname, 'score-sidebar.json')
  const groupedScores = dirPath.toLowerCase() === 'scores' && fs.existsSync(metadataPath)
  const records = groupedScores ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')).filter(record => record.visible !== false) : []
  const animeItems = buildScoreSidebar(records.filter(record => record.category === 'acg'))
  const otherItems = buildScoreSidebar(records.filter(record => record.category === 'pop'))
  if (groupedScores) items.push(...buildScoreSidebar(records.filter(record => !['pop', 'acg'].includes(record.category))))

  files.sort().forEach((file) => {
    if (groupedScores) return
    // 过滤非 md 文件以及首页 index.md
    if (file.endsWith('.md') && file.toLowerCase() !== 'index.md') {
      const fileNameWithoutExt = file.replace(/\.md$/, '')
      items.push({
        text: fileNameWithoutExt.replace(/[\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF5E]/g,
          char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0)),
        link: `/${dirPath}/${encodeURI(fileNameWithoutExt)}`
      })
    }
  })

  return [
    {
      text: dirPath.toLowerCase() === 'scores' ? '说明' : titlePrefix,
      ...(fs.existsSync(path.join(absolutePath, 'index.md'))
        ? { link: `/${dirPath}/` }
        : {}),
      items: dirPath.toLowerCase() === 'scores'
        ? [{ text: '分类1', collapsed: false, items }, { text: '分类2', collapsed: false, items: animeItems.length ? animeItems : [{ text: '暂无项' }] }, { text: '分类3', collapsed: false, items: otherItems.length ? otherItems : [{ text: '暂无项' }] }]
        : items
    }
  ]
}

function getSidebars() {
  const pagesRoot = path.resolve(__dirname, '../')
  const sidebar = {}
  const directories = fs.readdirSync(pagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'public' && !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const directory of directories) {
    const items = getSidebarForDir(directory.name, getSidebarTitleForDir(directory.name))
    if (items.length && items[0].items.length) {
      sidebar[`/${directory.name}/`] = items
    }
  }

  return sidebar
}

export default defineConfig({
  markdown: {
    math: true,
    anchor: { permalink: false },
    config(md) {
      const open = md.renderer.rules.heading_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))
      const close = md.renderer.rules.heading_close || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))
      md.renderer.rules.heading_open = (tokens, index, ...args) =>
        (tokens[index].tag === 'h1' ? '<div class="page-title-row"><TitlePager side="prev" />' : '') + open(tokens, index, ...args)
      md.renderer.rules.heading_close = (tokens, index, ...args) =>
        close(tokens, index, ...args) + (tokens[index].tag === 'h1' ? '<TitlePager side="next" /></div>' : '')
    }
  },
  vite: {
    plugins: [{
      name: 'remove-default-search-modal',
      enforce: 'pre',
      transform(_source, id) {
        if (id.replaceAll('\\', '/').endsWith('/theme-default/components/VPNavBarSearch.vue')) {
          return '<script>export default { render() { return null } }</script>'
        }
      }
    }]
  },
  title: "示例网站",
  description: "企划合集",
  base: deployment.base,
  outDir: '../../Web',
  
  head: [
    ['link', {
      rel: 'icon',
      type: 'image/svg+xml',
      href: deployment.base + 'images/avatar-favicon-light.svg'
    }]
  ],

  // 1. 内置本地全文搜索 (Ctrl + K 或点击搜索框)
  themeConfig: {
    notFound: {
      code: '404',
      title: '页面未找到',
      quote: '你暂时掉出了这个世界',
      linkText: '返回首页',
      linkLabel: '返回首页'
    },
    logo: {
      light: '/images/avatar-favicon-light.svg',
      dark: '/images/avatar-favicon-dark.svg'
    },
    search: {
      provider: 'local',
      options: {
        miniSearch: { _splitIntoSections: splitSearchSections },
        locales: {
          root: {
            translations: {
              button: {
                buttonText: '搜索页面',
                buttonAriaLabel: '搜索页面'
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭'
                }
              }
            }
          }
        }
      }
    },

    // 2. 顶部导航栏
    nav: navItems,

    // 3. 原生自动读取文件目录生成侧边栏 (按照文件名自动升序)
    sidebar: getSidebars(),

    // 文档页底部翻页提示
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    
    darkModeSwitchLabel: '外观切换',
    lightModeSwitchTitle: '切换到明亮模式',
    darkModeSwitchTitle: '切换到暗夜模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '返回顶部'
  },

  // 5. 多语言 / i18n 基础架构配置
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN'
    }
  }
})
