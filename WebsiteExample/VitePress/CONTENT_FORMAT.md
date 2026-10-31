# Contents 内容格式

## 站点信息与顶部导航

`Contents/site.md` 控制 VitePress 站点名称和顶部导航。生成脚本会把 `SITE_TITLE` 写入 `src/.vitepress/config.js` 的 `title`，并根据下方“名称 / 路径”表格更新 `navItems`。侧栏会根据导航链接所属目录，自动采用对应的导航名称。修改导航名称或链接时，只需编辑此文件。

```markdown
---
SITE_TITLE: 耀之界历
---

| 名称 | 路径 |
| --- | --- |
| 首页 | / |
| 谱面合集 | /TestA/doc1 |
```

路径通常使用 VitePress 页面路由，例如 `/TestA/doc1`。生成只更新配置中的标题值和导航数组，不改动其余配置。

`Contents/index.md` 是首页源文件。运行 `npm run content:generate` 时，脚本会将它原样复制到 `src/index.md`。

其余页面数据以 Markdown 文件保存在 `Contents/` 中，路径与目标页面相同。例如 `Contents/TestA/doc1.md` 会生成 `src/TestA/doc1.md`。包含页面字段 front matter 的文件会按下文的页面格式渲染；不包含 front matter 的普通 Markdown 页面会原样复制到 `src/`。生成后的目标文件继续由脚本维护。

## 栏目首页与批量内容

栏目首页统一放在 `Contents/Sections/`：`Sections/Scores.md` 生成
`src/Scores/index.md`，`Sections/PdTS.md` 生成 `src/PdTS/index.md`。
栏目首页地址保持不变。`Contents/Scores/YY/` 存放音游/核类，生成到 `src/Scores/YY/`，页面地址为 `/Scores/YY/曲目`；`Contents/Scores/POP/` 存放影视/流行，生成到 `src/Scores/POP/`。两类使用相同页面字段和排序规则，分别自动进入对应侧栏栏目。空目录通过 `.gitkeep` 保留。
`Sections/` 不接受子目录；同一输出路径存在多个源文件时，生成脚本会报错。

## 页面元数据

页面 Markdown 文件以 YAML front matter 保存字段：

```yaml
---
VISIBLE: true
TITLE: 页面标题
SUBTITLE: 页面副标题（可选；Scores 下非首页会显示在标题下方）
VIDEO: BV号或包含BV号的B站视频链接
ILLUSTS: /illusts/YY/Titania_0_HD.jpg
PDF: /Test1.pdf
PDF_TITLE: PDF预览标题
---
```

字段名不区分大小写，TITLE、ILLUSTS、PDF_TITLE 必填。PDF 可留空或省略，此时显示“PDF 尚未发布！”，非空链接加载失败时显示“PDF 名称错误！”。VIDEO 可留空或省略；缺失、BV 格式错误或分 P 无效时，视频区域显示居中的“视频尚未发布！”。跨域播放器内部的失效提示无法可靠检测。`ILLUSTS` 可以是文字，也可以是站点根路径下的图片路径。曲绘统一放在 `VitePress/src/public/illusts/`，按分区放入 `ACG/`、`POP/`、`YY/` 子目录，使用 `/illusts/分区/文件名` 引用；头像、图标等其余资源继续放在 `images/`。同曲不同谱面可共用一张曲绘，文件名必须与实际图片一致。

## 信息表格

表格使用标准 Markdown 管道表格。表头分隔行用于 Markdown 编辑器预览，生成时会被忽略。每行列数必须一致。

需要并排的两张表格时，在每张表格前加 `<!-- pair -->` 标记。两表须连续出现且数据行数相同；没有标记的表格会单独占一行。

```markdown
<!-- pair -->
| 曲包 [Package] | Pack O.N.G.E.K.I. |
| --- | --- |
| 谱师 [Noter] | DraXon as "Chromoe" |
| 速度 [BPM] | ♩= 212 |

<!-- pair -->
| 难度 [Difficulty] | Re:Master |
| --- | --- |
| 等级 [Level] | Lv.16 |
| 定数 [Const.] | 16.55 |

| 分轨 [Tracks] | L | R | Tt |
| --- | --- | --- | --- |
| 物量 [Notes] | 1028 | 1488 | 2516 |
```

内容数据转换脚本会把 front matter 和表格渲染为 VitePress 页面布局。首页则直接复制，不经转换。运行 `npm run content:generate` 可单独生成；`npm run docs:build` 和 `npm run docs:dev` 会先自动生成内容。

动漫/游戏源文件放在 `Contents/Scores/ACG/`，生成到 `src/Scores/ACG/` 并归入动漫/游戏。三个曲目栏目各自排序，遵循互斥展开规则。
## 页脚版权声明

`Contents/footer.md` 控制所有页面底部的版权声明。每个非空行显示为独立一行纯文本，空行忽略；不解析 Markdown 或 HTML。修改后运行构建即可更新。此文件只用于页脚，不生成独立页面。

## 谱面显隐

`Contents/Scores/` 下每条谱面使用 `VISIBLE: true`（显示）或 `VISIBLE: false`（隐藏）。省略时默认显示，字段名不区分大小写。修改后重新构建；隐藏条目也生成网页，但默认从侧栏、搜索、统计与翻页导航中排除。说明页底部左侧的“这是什么？”连续点击五次可解锁（相邻点击不超过 1 秒），随后替换为隐藏项开关；解锁和开关状态仅在内存中保存，每次刷新重置。刷新隐藏页时，仅当前隐藏页临时保留在侧栏、搜索、统计与翻页导航中，切走后取消保留，后退不会重新解锁。隐藏为彩蛋机制，非权限控制，直接链接仍可访问。源文件和公共资源保留，可随时改回 true 恢复显示。

曲绘路径中的谱面版本标记 `（＊）`、`（*）` 或 `(*)`（以及其前方空格）会在查找本地图片时自动去掉，页面标题保持不变。例如 `/illusts/YY/ANiMA （＊）_0_HD.jpg` 对应 `ANiMA_0_HD.jpg`。

谱面 PDF 按分区存放在 `VitePress/src/public/scores/ACG/`、`POP/`、`YY/`，页面 PDF 字段使用 `/scores/分区/文件名.pdf`，例如 `/scores/YY/Titania.pdf`。
