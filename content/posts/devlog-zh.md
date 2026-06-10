---
title: "博客开发日志（中文）：改动记录与前端原理"
date: 2026-06-09
draft: false
tags: ["devlog", "前端", "hugo", "blog", "学习笔记"]
ShowToc: true
TocOpen: true
description: "按日期累积记录这个博客的每次改动，以及背后的前端原理。给自己留的学习笔记，以后每次改动继续往里加。"
---

这是一篇**按日期累积**的开发日志。每次改动博客，我都把"做了什么"和"学到的前端原理"记在这里，方便以后翻查。最新的改动放在最上面。

> 维护约定：下次改动时，在 [改动模板](#改动模板) 上面新增一个 `## 日期 — 标题` 小节即可。

---

## 2026-06-09 — 接入自定义域名 + 翻译按钮升级

### 这次做了什么

1. **自定义域名上线**：把 GoDaddy 买的 `xungirl.com` 接到 GitHub Pages，配置了 DNS（4 条 A 记录指向 GitHub IP + 1 条 `www` 的 CNAME），清掉了 GoDaddy 默认的停放记录，最后开启了自动 HTTPS（Let's Encrypt 证书）。
2. **新增文章**：一篇讲 A 记录 vs CNAME 记录的英文文章。
3. **翻译按钮：保护代码与公式**：点翻译时，代码块、行内代码、数学公式**保持原样不被翻译**。
4. **翻译按钮：升级为双向**：自动判断当前文章是中文还是英文，翻成"另一种"——英文文章翻中文、中文文章翻英文。

涉及文件：`layouts/partials/extend_head.html`（翻译逻辑）、`content/posts/`（文章）。

---

### 前端原理

这次最值得记的是几个**前端基础概念**，比具体代码更重要。

#### 1. 构建期 vs 运行期（最核心的一条线）

| | 构建期（Hugo） | 运行期（浏览器 JS） |
|---|---|---|
| 谁在做 | push 后 GitHub Actions **构建一次**，生成静态 HTML | 访客**打开页面时**，浏览器实时执行 |
| 适合 | 文章内容、菜单、固定文案（可走 Hugo 的 `{{ i18n }}` 翻译） | **会动的东西**：计时器、实时翻译、交互 |
| 特点 | 生成完就定死，之后不变 | 每次访问都重新跑，可以随时变 |

**为什么重要**：博客底部那个"已运行 X 天 X 时"的计时器，必须用运行期 JS（因为每秒都在变，Hugo 构建一次没法让它跳动）；而它显示的英文字是写死在 JS 里的，**脱离了 Hugo 的翻译体系**，所以切语言不会变——这不是 bug，是它本来就在另一套系统里。

计时器原理（纯客户端 JS）：

```js
function updateTimer() {
  const start = new Date("2026-02-10");   // 上线日（固定起点）
  const now = new Date();                  // 此刻（访客浏览器时间）
  const days = Math.floor((now - start) / 86400000);  // 毫秒差 → 天
  document.getElementById("site-timer").innerHTML =
    "Blog has been running for " + days + " days ...";
}
updateTimer();
setInterval(updateTimer, 1000);   // 每 1 秒重跑 → 数字跳动
```

#### 2. 机器翻译的"保护"机制：`translate="no"` / `notranslate`

这个博客的"中英切换"**不是真双语**（真双语要每篇手写两份），而是嵌了 **Google 翻译**组件做**机器实时翻译**。机器翻译的默认行为是：**把页面上所有可见文字全翻一遍**。

要让某块"别翻"，标准做法是给元素打两个标记之一，翻译器会**整块跳过**它和它的所有子元素：

```html
<element translate="no">        <!-- HTML 标准属性 -->
<element class="notranslate">    <!-- Google 专用 class -->
```

所以"代码/公式不被翻译"的实现，就是**在触发翻译之前**，用 CSS 选择器批量选中这些元素、打上标记：

```js
function protectCode() {
  document.querySelectorAll('pre, code, .highlight, .chroma')
    .forEach(el => {
      el.setAttribute('translate', 'no');
      el.classList.add('notranslate');
    });
}
```

> 要点：① 用 `querySelectorAll(选择器)` 一次性选中一类元素；② 顺序很重要，**必须在翻译前**打标记。
>
> 想保护正文里某个散落的术语？两招：写成 `` `行内代码` ``（已自动保护），或手写 `<span class="notranslate">Transformer</span>`（Hugo 开了 `unsafe: true`，Markdown 里能直接写 HTML）。

#### 3. 用"字符统计"检测语言 + 翻译方向

双向翻译的关键，是先知道"当前这篇是什么语言"。最朴素也最有效的办法：**数正文里中文字符多还是英文字母多**。

```js
function detectPageLang() {
  const body = document.querySelector('.post-content') || document.body;
  const text = (body.innerText || '').slice(0, 3000);
  const cjk   = (text.match(/[一-鿿]/g) || []).length;  // 中文 Unicode 区间
  const latin = (text.match(/[A-Za-z]/g) || []).length;          // 英文字母
  return cjk > latin ? 'zh-CN' : 'en';
}
```

- `/[一-鿿]/g`：正则按 **Unicode 区间**匹配汉字（U+4E00 到 U+9FFF）。
- `.match(...) || []`：没匹配到时返回 `[]`，避免报错；`.length` 数个数。
- 比多少 → 判断主语言。

然后**方向 = 翻成"另一种"**，UI 跟着这个状态走：

```js
target = (pageLang === 'en') ? 'zh-CN' : 'en';   // 翻到另一种语言
```

#### 4. DOM 时机：`DOMContentLoaded`

这段脚本写在 `<head>` 里，执行时 `<body>` **还没解析出来**，`.post-content` 还不存在。所以语言检测不能在脚本一加载就跑，要放进绑定了 `DOMContentLoaded`（文档解析完成）的函数里再执行：

```js
document.addEventListener('DOMContentLoaded', injectButton);  // 这时才数得到正文
```

> "DOM 准备好了没" 是前端最常见的坑——顺序错了就拿到空内容。

---

## 改动模板

> 复制下面这块到本节**上方**，填好日期即可：

```markdown
## YYYY-MM-DD — 标题

### 这次做了什么
- ...

### 前端原理
- ...
```
