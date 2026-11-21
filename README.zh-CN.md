# agy-powerline

[English](README.md) | **简体中文** | [日本語](README.ja.md) | [Français](README.fr.md) | [Español](README.es.md) | [한국어](README.ko.md) | [Deutsch](README.de.md)

[![Version](https://img.shields.io/npm/v/agy-powerline.svg)](https://www.npmjs.com/package/agy-powerline)
[![Downloads](https://img.shields.io/npm/d18m/agy-powerline.svg?cacheSeconds=86400)](https://www.npmjs.com/package/agy-powerline)
[![Stars](https://img.shields.io/github/stars/wassim-azi/agy-powerline?style=flat&color=gold&cacheSeconds=86400)](https://github.com/wassim-azi/agy-powerline/stargazers)
[![CI](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml/badge.svg)](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml)
[![CodeQL](https://github.com/wassim-azi/agy-powerline/actions/workflows/codeql.yml/badge.svg)](https://github.com/wassim-azi/agy-powerline/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/wassim-azi/agy-powerline/badge)](https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15655/badge)](https://www.bestpractices.dev/projects/15655)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#隐私与安全)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0078D6.svg)](docs/install.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open in GitHub Codespaces](https://img.shields.io/badge/open%20in-Codespaces-24292f.svg?logo=github&logoColor=white)](https://codespaces.new/wassim-azi/agy-powerline?quickstart=1)
[![Web Configurator](https://img.shields.io/badge/web%20configurator-live-00dc82.svg)](https://agy-powerline.com/configure/)
[![Mentioned in Awesome Gemini CLI](https://img.shields.io/badge/mentioned%20in-awesome-fc60a8.svg?logo=awesomelists&logoColor=white)](https://github.com/Piebald-AI/awesome-gemini-cli)

> 本文译自英文版 [README](README.md)，可能落后于英文版；如有出入，以英文版为准。详细文档（[`docs/`](docs/)）仅提供英文版。

**为 Google Antigravity CLI（`agy`）打造的快速、可配置的状态栏。**

一眼看到当前模型、Gemini 5h/7d、Claude/GPT 和 Argon 配额、上下文窗口、git 分支等信息。在交互式编辑器中挑选组件、主题和布局。一条命令即可安装，零依赖。

<p align="center">
  <img src="assets/demo.gif" alt="agy-powerline 的 configure：输入 argon 添加 Argon 每周配额，然后浏览预设、主题和布局并实时预览状态栏，最后打开 Powerline 标签页" width="850">
</p>

## 为什么选择 agy-powerline？

| 特性         | 你能获得什么                                                                                   | 了解更多                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 配额节奏标记 | 配额进度条上的节奏标记让你一眼看出 5h 或 7d 配额能否撑到重置                                   | [配额指南](docs/guides/antigravity-quota.md) · [计算器](https://agy-powerline.com/quota-calculator/) |
| 多模型方配额 | 并排追踪 Gemini 5h/7d、第三方（Claude/GPT）以及 Gemini 4 Argon 配额                            | [Payload 参考](docs/payload.md#quota-buckets)                                                        |
| 主题与布局   | 涵盖 `pills`、`lines` 和 `classic` 三种布局的 22 款 WCAG AA 主题（含深色、浅色及色盲友好配色） | [主题画廊](https://agy-powerline.com/themes/)                                                        |
| 交互式配置器 | 在终端（`npx agy-powerline configure`）或浏览器中使用带实时预览的编辑器定制                    | [网页配置器](https://agy-powerline.com/configure/)                                                   |
| 安全与隐私   | 零运行时依赖、无网络请求、无遥测，自动备份 `settings.json`                                     | [安全说明](SECURITY.md)                                                                              |
| 跨平台支持   | 支持 Windows、macOS、Linux 和 WSL，内置诊断工具（`doctor`）                                    | [安装说明](docs/install.md) · [故障排查](docs/troubleshooting.md)                                    |

## 安装

需要 [Node.js](https://nodejs.org/) 20+ 和 [Antigravity CLI](https://antigravity.google/docs/cli/overview)。支持 Windows、macOS、Linux 和 WSL（[WSL 说明](docs/install.md#wsl)）。

```bash
npx agy-powerline             # 安装状态栏并打开编辑器
agy                           # 启动 Antigravity
```

在终端中运行 `npx agy-powerline` 会自动安装脚本（或在保留现有配置的同时更新旧版本脚本）、在备份后写入 `settings.json`，并立即打开带实时预览的编辑器。完成后请重启一次 `agy`。用于脚本或自动化安装时，可使用 `npx agy-powerline init --yes`。详情：[安装说明](docs/install.md)。

<details>
<summary>截图：真实 agy 会话中的状态栏（Windows Terminal）</summary>

<p align="center">
  <img src="assets/screenshots/windows.png" alt="Windows Terminal 中 agy 输入框下方的 agy-powerline：上方是一段简短对话，下方是三行的 Pills 状态栏" width="850">
</p>

</details>

### 在 agy 内部安装

agy-powerline 也是一个 agy 插件。添加插件后，在 `agy` 会话中运行其安装技能，它会自动为你运行 `init` 和 `doctor`：

```text
agy plugin install https://github.com/wassim-azi/agy-powerline
/agy-powerline-setup
```

完成后请重启一次 `agy`。详情：[插件安装方式](docs/install.md#install-from-inside-agy-plugin)。

或者把下面这段话粘贴到 `agy` 会话中：

```text
Install the agy-powerline statusline: run `npx agy-powerline init --yes`, then tell me to restart agy.
```

`--yes` 会跳过 agy 无法回答的确认提示，并在备份 `settings.json` 后替换已有的 `statusLine`。

如果终端没有 Nerd Font，可以开启 ASCII 模式（在 `configure` 中按 `i` 打开 `Settings`）。

## 自定义

`npx agy-powerline configure` 会打开一个带有状态栏实时预览的编辑器。用 `←` `→` 在 Widgets、Presets、Themes、Layout、Powerline 和 Settings 之间切换，`↑` `↓` 移动，Enter 选择，`q` 保存并退出。每个界面的按键都显示在底部；完整列表见 [Configuration](docs/configuration.md#configurator-keys)。

更喜欢浏览器？可以[在浏览器中定制状态栏](https://agy-powerline.com/configure/)并实时预览，然后下载或导入配置。

正在运行的 `agy` 会在下次刷新时应用更改。

### 预设

从一个预设开始，再按需调整：

| 预设      | 显示内容                                                               |
| --------- | ---------------------------------------------------------------------- |
| `default` | 模型、上下文、git；第二行显示 5h 和 7d 配额及重置时间                  |
| `compact` | 单行：简短模型名、最紧张的配额、上下文 %、git                          |
| `agent`   | 代理状态、子代理、标题、模式、沙箱；模型、上下文 %、产物、最紧张的配额 |
| `git`     | 项目、分支、worktree、stash；文件数、改动行数、提交                    |
| `tokens`  | 上下文 token、会话输入/输出 token、缓存命中率；今天和 7 天的 token     |
| `quotas`  | 套餐和模型；5h 和 7d 配额并排显示，下方显示第三方和 Argon 配额         |
| `full`    | 全部：会话、项目和 git；上下文、token 和缓存；两组配额                 |

### 主题

| 终端背景   | 主题                                                                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 深色       | `dark-aurora`（默认）、`dark-ocean`、`dark-ember`、`dark-forest`、`dark-neon`、`dark-mono`、`dark-dracula`、`dark-onyx`、`dark-tokyo-night`、`dark-catppuccin-macchiato`、`dark-catppuccin-frappe`、`dark-catppuccin-mocha`、`dark-nord`、`dark-rose-pine` |
| 浅色       | `light-paper`、`light-sky`、`light-sunset`、`light-cream`、`light-gruvbox`、`light-tokyo-night`                                                                                                                                                            |
| 色盲友好   | `colorblind-dark`、`colorblind-light`                                                                                                                                                                                                                      |
| 自定义颜色 | `custom`（[方法](docs/configuration.md#custom-theme)）                                                                                                                                                                                                     |

可在[主题画廊](https://agy-powerline.com/themes/)中或用 `npx agy-powerline theme --gallery` 预览所有主题。若想让每行呈现平滑渐变色，可添加渐变：`npx agy-powerline gradient <name>`，支持 `aurora`、`sunset`、`ocean`、`forest`、`neon`、`candy`、`rainbow`、`mono` 或自定义颜色（[方法](docs/configuration.md#gradients)）。

### 布局

**Pills**（默认）：powerline 风格的胶囊。可选圆角、尖角、斜角或平直形状，也可以在行与行之间留一个空行。

<p align="center">
  <img src="assets/screenshots/pills-dark.png" alt="agy-powerline 的 Pills 布局，dark-aurora 主题：模型、上下文、项目和 git；Gemini 5h 和 7d 配额，带节奏标记和重置时间；Claude/GPT 和 Argon 每周配额" width="850">
</p>

<details>
<summary>浅色终端</summary>

<p align="center">
  <img src="assets/screenshots/pills-light.png" alt="agy-powerline 的 Pills 布局，浅色终端上的 light-paper 主题" width="850">
</p>

</details>

**Lines**：以纯彩色文本显示相同的信息。

<p align="center">
  <img src="assets/screenshots/lines-dark.png" alt="agy-powerline 的 Lines 布局，深色终端上的 dark-aurora 主题" width="850">
</p>

<details>
<summary>浅色终端</summary>

<p align="center">
  <img src="assets/screenshots/lines-light.png" alt="agy-powerline 的 Lines 布局，浅色终端上的 light-paper 主题" width="850">
</p>

</details>

**Classic**：用 `|` 分隔的纯彩色文本，进度条为方块，例如 `███░│░░░░░`。

<p align="center">
  <img src="assets/screenshots/classic-dark.png" alt="agy-powerline 的 Classic 布局，深色终端上的 dark-aurora 主题，方块进度条" width="850">
</p>

<details>
<summary>浅色终端</summary>

<p align="center">
  <img src="assets/screenshots/classic-light.png" alt="agy-powerline 的 Classic 布局，浅色终端上的 light-paper 主题" width="850">
</p>

</details>

### 状态栏语言

状态栏自身的文字（`重置`、`剩余`、`上下文` 等标签）可以显示为简体中文：

```sh
npx agy-powerline init --language zh-CN
```

也可以在 `statusline.config.json` 中设置 `"language": "zh-CN"`（或在 `configure` 中按 `i` 打开 `Settings`）。模型名、分支名等来自 agy 的内容会按原文显示，`2h 47m` 的时间单位保持英文缩写以控制宽度。命令行输出与 `configure` 界面保持英文。详情见[语言设置文档](docs/configuration.md#language)。

## 组件

| 组件                                                             | 显示内容                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `model`                                                          | 当前使用的模型                                                                       |
| `clock`                                                          | 当前本地时间（12/24 小时制在 `clock` 下设置）                                        |
| `fiveHourBar`、`weeklyBar`                                       | 以进度条显示 5h / 7d 剩余配额，带[节奏标记](docs/configuration.md#quota-pace-marker) |
| `fiveHourPct`、`weeklyPct`                                       | 以百分比显示 5h / 7d 剩余配额                                                        |
| `fiveHourReset`、`weeklyReset`                                   | 距配额重置的时间，或重置时刻                                                         |
| `quota`                                                          | 最接近用完的配额及其重置时间                                                         |
| `thirdPartyFiveHour`、`thirdPartyWeekly`                         | 第三方模型的配额                                                                     |
| `argonWeekly`、`argonReset`                                      | Gemini 4 Argon 独立的每周配额（Google AI Pro）及其重置时间                           |
| `context`、`contextPct`、`contextTokens`                         | 已用的上下文窗口：进度条、百分比或 token 数                                          |
| `git`                                                            | 分支、未提交的更改以及领先/落后的提交数                                              |
| `gitChanges`、`gitFiles`、`gitSha`、`gitStash`、`gitWorktree`    | 新增与删除的行数、暂存/修改/未跟踪/冲突的文件数、提交 ID、stash 数、关联的 worktree  |
| `project`、`cwd`                                                 | 项目文件夹、当前文件夹                                                               |
| `agent`、`agentState`、`plan`、`sandbox`、`artifacts`、`version` | 当前代理、代理状态（含确认标志）、套餐、沙箱、产物、CLI 版本                         |
| `tasks`、`queue`                                                 | 正在运行的子代理、后台任务和排队等待的用户消息                                       |
| `mode`                                                           | 审批模式（如 accept-edits）和 Vim 模式                                               |
| `title`                                                          | 对话标题                                                                             |
| `sessionTime`                                                    | 当前活跃对话开始以来的时长                                                           |
| `totalTokens`、`cost`、`cacheHit`、`cacheRead`、`cacheCreate`    | 会话 token 数、估算费用（USD）和提示缓存使用情况                                     |
| `tokensToday`、`tokensWeek`、`tokensMonth`                       | 今天、过去 7 天和过去 30 天的 token 用量（所有对话，Node 22.13+）                    |
| `ram`                                                            | 本机已用内存                                                                         |
| `os`                                                             | agy 运行的操作系统：Windows、macOS、Linux 或 WSL                                     |
| `host`                                                           | 来自操作系统的当前用户与短主机名（`alex@devbox`）                                    |
| `customText`、`exec`                                             | 你自己的文本，或 [shell 命令](docs/configuration.md#shell-command-widget-exec)的输出 |

没有内容可显示的组件会自动隐藏。组件可以更改颜色、重命名、更换图标、去掉标签，或设置自己的告警阈值：见 [Configuration](docs/configuration.md)。

## 命令

| 命令                                               | 作用                                               |
| -------------------------------------------------- | -------------------------------------------------- |
| `npx agy-powerline`                                | 安装（如有需要）、更新旧脚本并打开编辑器           |
| `npx agy-powerline init [--yes]`                   | 安装或更新状态栏（支持 `--preset`、`--yes` 等）    |
| `npx agy-powerline configure`                      | 打开编辑器（别名 `config`）                        |
| `npx agy-powerline preset <name>`                  | 应用预设（`--list` 查看全部）                      |
| `npx agy-powerline theme <name>`                   | 切换主题（`--list`、`--gallery`）                  |
| `npx agy-powerline gradient <name>`                | 为每行应用渐变配色（`--list`、`off`）              |
| `npx agy-powerline layout <pills\|lines\|classic>` | 切换布局                                           |
| `npx agy-powerline caps <style>`                   | 切换胶囊形状：`round`、`angled`、`slanted`、`flat` |
| `npx agy-powerline export [file]`                  | 将配置保存到文件，方便备份或分享                   |
| `npx agy-powerline import <file>`                  | 显示变更内容后加载配置（`--merge`）                |
| `npx agy-powerline doctor`                         | 检查安装并说明问题所在                             |
| `npx agy-powerline report`                         | 生成保护隐私的错误报告                             |
| `npx agy-powerline uninstall [--delete]`           | 从 agy 中移除（`--delete` 会同时删除其文件）       |
| `npx agy-powerline render --demo`                  | 用示例数据打印状态栏                               |

任何命令加上 `--help` 即可查看其选项。

## 更新

```bash
npx agy-powerline init --yes   # 安装新版本的脚本
npx agy-powerline doctor       # 检查一切是否为最新
```

你的设置会被保留。更新后请重启 `agy`。

## 故障排查

请先运行 `npx agy-powerline doctor`：它会检查安装，并告诉你如何修复发现的问题。常见问题以及如何报告错误：[Troubleshooting](docs/troubleshooting.md)。

## 隐私与安全

- **无网络请求，无遥测。** 所有信息都来自 agy 传给状态栏的数据、`.git` 和你的操作系统。唯一的对外链接是 `configure` 中的 `g`，它会在浏览器中打开 GitHub 页面。
- **你的设置是安全的。** `init` 和 `uninstall` 会备份 `settings.json`，并拒绝编辑无法解析的文件。
- **你不添加，就不会运行任何命令。** 除了用于统计领先/落后提交数以及所添加 git 组件的文件和行数的快速 `git` 调用外，状态栏只会运行你自己配置的 `exec` 组件。
- **零运行时依赖**，通过 CI 发布并附带 [npm provenance](https://docs.npmjs.com/generating-provenance-statements)。

完整说明：[SECURITY.md](SECURITY.md)。

## 参与贡献

欢迎贡献。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)（环境搭建、架构、添加组件或主题）和 [Code of Conduct](CODE_OF_CONDUCT.md)。Pull request 请提交到 `main` 分支。在 [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues) 中报告错误，或在 [Discussions](https://github.com/wassim-azi/agy-powerline/discussions) 中分享想法和反馈。

感谢所有贡献者：

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="20%"><a href="https://github.com/yatharth2soni"><img src="https://avatars.githubusercontent.com/u/238868599?v=4&s=128" width="64" height="64" alt="Yatharth Soni"/><br /><sub><b>Yatharth&nbsp;Soni</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/dannyward630"><img src="https://avatars.githubusercontent.com/u/71604164?v=4&s=128" width="64" height="64" alt="Danny Ward"/><br /><sub><b>Danny&nbsp;Ward</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/yoreva-01"><img src="https://avatars.githubusercontent.com/u/195282707?v=4&s=128" width="64" height="64" alt="Yusuf Orçan"/><br /><sub><b>Yusuf&nbsp;Orçan</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/yuefdev"><img src="https://avatars.githubusercontent.com/u/120668197?v=4&s=128" width="64" height="64" alt="Yusuf Efe"/><br /><sub><b>Yusuf&nbsp;Efe</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/hiyouwhatsapp"><img src="https://avatars.githubusercontent.com/u/89997383?v=4&s=128" width="64" height="64" alt="hiyouwhatsapp"/><br /><sub><b>hiyouwhatsapp</b></sub></a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="20%"><a href="https://github.com/dharamdan01"><img src="https://avatars.githubusercontent.com/u/188893946?v=4&s=128" width="64" height="64" alt="dharamdan01"/><br /><sub><b>dharamdan01</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/Ashuge11"><img src="https://avatars.githubusercontent.com/u/210247942?v=4&s=128" width="64" height="64" alt="Ashvini Sundge"/><br /><sub><b>Ashvini&nbsp;Sundge</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://www.unkletayo.dev/"><img src="https://avatars.githubusercontent.com/u/48031746?v=4&s=128" width="64" height="64" alt="Adetayo Akinsanya"/><br /><sub><b>Adetayo&nbsp;Akinsanya</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/rahul05ranjan"><img src="https://avatars.githubusercontent.com/u/11793455?v=4&s=128" width="64" height="64" alt="Rahul"/><br /><sub><b>Rahul</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/Logic769"><img src="https://avatars.githubusercontent.com/u/78853392?v=4&s=128" width="64" height="64" alt="Logic769"/><br /><sub><b>Logic769</b></sub></a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

如果 agy-powerline 对你有用，点个 ⭐ 能帮助更多 agy 用户发现它。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=wassim-azi/agy-powerline&type=Date)](https://star-history.com/#wassim-azi/agy-powerline&Date)

## 许可证

[MIT](LICENSE) © Wassim AZI
