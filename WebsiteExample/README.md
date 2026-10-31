# 网站基本框架示例

基于正式网站工作区整理的独立示例。保留 VitePress 主题组件、导航书签、毛玻璃、光效、拖动卡片、内容生成、排序、隐藏条目、资源状态灯、PDF.js 阅读器和资源加密构建流程。

## 运行

需要 Node.js 20.19+ 或 22.12+（建议 Node.js 24 LTS），以及 npm。

在此文件夹下执行：

~~~sh
cd VitePress
npm ci
npm run docs:dev -- --host 127.0.0.1
~~~

生产构建及预览：

~~~sh
npm run docs:build
npm run docs:preview -- --port 4176
~~~

默认构建根路径模式，预览入口 http://localhost:4176/ 。示例预览使用 4176，避免占用正式项目的 4174。Web/ 为生成结果，不是源码输入。

测试：在 VitePress/ 执行 npm test；构建后执行 npm run docs:check（临时使用 4175 端口）。

## 目录

- Contents/：站点标题、导航、页脚、Markdown 和三类示例资源状态。
- VitePress/src/.vitepress/：主题组件、CSS、导航及搜索配置。
- VitePress/src/public/：SVG 占位图、示例 PDF、音符图标、PDF.js 运行资源和许可。
- VitePress/scripts/：生成、构建、加密、预览及测试。
- VitePress/resource-runtime/：初始化与 Service Worker 解密源码。
- VitePress/vendor/、viewer/：PDF.js 基础源码及自定义阅读器源码。
- VitePress/CONTENT_FORMAT.md：内容字段格式参考。

## 配置与正式网站的区别

编辑 Contents/site.md、index.md、footer.md、about.md 和 Scores/ 中的示例条目；资源路径相对于 VitePress/src/public/。

VitePress/deployment.mjs 中的域名 example.com 和 GitHub 路径 /website-example/ 都是占位配置，发布前需改为自己的域名及仓库路径。npm run docs:build:github 用于子路径构建。

未复制真实作品、曲绘、背景照片、头像、个人社交链接、字体文件、工作簿、DOCS、凭据、Git 历史、node_modules 或正式 Web 产物。示例使用系统字体，不含字体分包与预加载实际文件；相关构建代码会在不存在字体包时自动跳过预加载。

视频字段留空以避免访问真实作品；可自行填写有效 BV 号测试跨域播放器。Example 展示正常 PDF，Example Anime 展示未发布，Example Lost 展示 broken，Example Hidden 展示隐藏项。

生产预览依赖 JavaScript、Service Worker 和安全上下文（HTTPS 或 localhost）。加密密钥在客户端公开，只是增加直接下载门槛，不是鉴权。示例使用独立演示密钥。

本文件夹是经过素材替换的示例工程，不声明为正式线上网站完整、逐版本对应的源码发布。源码与 Web/ 编译产物一并保存到公开仓库的 WebsiteExample/ 目录；依赖目录 node_modules 和本地缓存不纳入版本控制。父项目的公开发布工作流同步此目录。

## 许可

沿用已有授权，不变更为 MIT：原创框架代码 AGPL-3.0-only（LICENSE），示例内容与占位图 CC BY-NC-SA 4.0（LICENSE-CONTENT.txt）；第三方文件保持各自许可。PDF.js 为 Apache-2.0，VitePress/Vue 等 npm 依赖按各自发行包许可。请保留源码内版权头、public/pdfjs/ 中的许可文件和 symbols/、images/ 图标中的原始声明。详细清单见 THIRD_PARTY_NOTICES.md。

网站入口：<a href="https://example.com/">点我进入网站</a>
