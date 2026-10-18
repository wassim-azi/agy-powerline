# agy-powerline

[English](README.md) | [简体中文](README.zh-CN.md) | **日本語** | [Français](README.fr.md)

[![CI](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml/badge.svg)](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml)
[![Version](https://img.shields.io/npm/v/agy-powerline.svg)](https://www.npmjs.com/package/agy-powerline)
[![Downloads](https://img.shields.io/npm/dt/agy-powerline.svg)](https://www.npmjs.com/package/agy-powerline)
[![Node](https://img.shields.io/badge/node-%3E%3D20-informational.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational.svg)](docs/install.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#プライバシーとセキュリティ)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/wassim-azi/agy-powerline/badge)](https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline)
[![Mentioned in Awesome Gemini CLI](https://img.shields.io/badge/mentioned%20in-awesome-fc60a8.svg?logo=awesomelists&logoColor=white)](https://github.com/Piebald-AI/awesome-gemini-cli)

> この文書は英語版 [README](README.md) の翻訳で、最新の内容に追いついていない場合があります。内容が異なる場合は英語版が優先されます。詳しいドキュメント（[`docs/`](docs/)）は英語版のみです。

**Google Antigravity の CLI（`agy`）向けの、高速でカスタマイズ可能なステータスライン。**

使用中のモデル、Gemini の 5h/7d・Claude/GPT・Argon のクォータ、コンテキストウィンドウ、git ブランチなどがひと目でわかります。ウィジェット、テーマ、レイアウトは対話式のエディターで選べます。インストールはコマンドひとつ、依存パッケージはありません。

<p align="center">
  <img src="assets/screenshots/pills-dark.png" alt="dark-ocean テーマの agy-powerline Pills レイアウト：エージェントの状態、モデル、プラン、プロジェクト、git；コンテキスト；5h と 7d のクォータとリセットまでの時間" width="850">
</p>

## インストール

[Node.js](https://nodejs.org/) 20 以上と [Antigravity CLI](https://antigravity.google/docs/cli/overview) が必要です。Windows、macOS、Linux、WSL で動作します（[WSL についての注意](docs/install.md#wsl)）。

```bash
npx agy-powerline init        # agy にステータスラインをインストール
npx agy-powerline configure   # 任意：ウィジェット、テーマ、レイアウトを選ぶ
agy                           # Antigravity を起動
```

`init` は何かを置き換える前に確認し、先に Antigravity の `settings.json` をバックアップします。`init` の後に `agy` を一度再起動してください。詳細：[`init` が行うこと](docs/install.md)。

agy にインストールしてもらうこともできます。次の文を `agy` のセッションに貼り付けてください。

```text
Install the agy-powerline statusline: run `npx agy-powerline init --yes`, then tell me to restart agy.
```

`--yes` は agy が答えられない確認をスキップし、`settings.json` をバックアップしたうえで既存の `statusLine` を置き換えます。

Nerd Font のないターミナルでは、ASCII モードをオンにしてください（`configure` で `i`）。

## カスタマイズ

`npx agy-powerline configure` を実行すると、バーのライブプレビュー付きのエディターが開きます。`←` `→` で Widgets、Presets、Themes、Layout、Powerline を切り替え、`↑` `↓` で移動、Enter で選択、`q` で保存して終了します。各画面のキーは画面下部に表示されます。キーの一覧は [Configuration](docs/configuration.md#configurator-keys) にあります。

変更は、実行中の `agy` の次回の更新時に反映されます。

### プリセット

プリセットから始めて、好みに合わせて調整します：

| プリセット  | 表示内容                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------- |
| `default`   | モデル、コンテキスト、git；2 行目に 5h と 7d のクォータとリセットまでの時間                   |
| `compact`   | 1 行：短いモデル名、最も残りの少ないクォータ、コンテキスト %、git                             |
| `workspace` | プロジェクト、git、エージェントの状態、モデル；コンテキスト、最も残りの少ないクォータ、モード |
| `limits`    | すべてのクォータ（5h、7d、サードパーティ、Argon）を 1 行にひとつずつ                          |
| `full`      | すべて：セッション、プロジェクト、git；コンテキスト、トークン、キャッシュ；両方のクォータ     |

### テーマ

| ターミナルの背景 | テーマ                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ダーク           | `dark-aurora`（デフォルト）、`dark-ocean`、`dark-ember`、`dark-forest`、`dark-neon`、`dark-mono`、`dark-nocturne`、`dark-onyx`、`dark-metro`、`dark-macchiato` |
| ライト           | `light-paper`、`light-sky`、`light-sunset`、`light-cream`                                                                                                      |
| 色覚多様性に配慮 | `colorblind-dark`、`colorblind-light`                                                                                                                          |
| 独自の配色       | `custom`（[方法](docs/configuration.md#custom-theme)）                                                                                                         |

すべてのテーマは `npx agy-powerline theme --gallery` でプレビューできます。

### レイアウト

**Pills**（デフォルト）：powerline 風のカプセル。形は丸型、山型、斜め、フラットから選べ、行の間に空行を入れることもできます。

<p align="center">
  <img src="assets/screenshots/pills-light.png" alt="明るいターミナルでの light-sky テーマの agy-powerline Pills レイアウト、行間あり" width="850">
</p>

**Lines**：同じ情報を色付きのプレーンテキストで表示します。

<p align="center">
  <img src="assets/screenshots/lines-dark.png" alt="暗いターミナルでの dark-ocean テーマの agy-powerline Lines レイアウト" width="850">
  <img src="assets/screenshots/lines-light.png" alt="明るいターミナルでの light-sky テーマの agy-powerline Lines レイアウト" width="850">
</p>

## ウィジェット

| ウィジェット                                            | 表示内容                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `model`                                                 | 使用中のモデル                                                                                          |
| `fiveHourBar`、`weeklyBar`                              | 5h / 7d クォータの残りをメーターで表示（[ペースマーカー](docs/configuration.md#quota-pace-marker)付き） |
| `fiveHourPct`、`weeklyPct`                              | 5h / 7d クォータの残りをパーセントで表示                                                                |
| `fiveHourReset`、`weeklyReset`                          | クォータがリセットされるまでの時間、またはリセット時刻                                                  |
| `quota`                                                 | 最も早く尽きそうなクォータとそのリセット                                                                |
| `thirdPartyFiveHour`、`thirdPartyWeekly`                | サードパーティモデルのクォータ                                                                          |
| `argonWeekly`、`argonReset`                             | Gemini 4 Argon 専用の週間クォータ（Google AI Pro）とそのリセット                                        |
| `context`、`contextPct`、`contextTokens`                | 使用中のコンテキストウィンドウ：メーター、パーセント、またはトークン数                                  |
| `git`                                                   | ブランチ、未コミットの変更、ahead/behind                                                                |
| `project`、`cwd`                                        | プロジェクトのフォルダー、現在のフォルダー                                                              |
| `agentState`、`plan`、`sandbox`、`artifacts`、`version` | エージェントの動作状況、プラン、サンドボックス、アーティファクト、CLI のバージョン                      |
| `tasks`                                                 | 実行中のサブエージェントとバックグラウンドタスク                                                        |
| `mode`                                                  | 承認モード（例：accept-edits）と Vim モード                                                             |
| `title`                                                 | 会話のタイトル                                                                                          |
| `totalTokens`、`cacheHit`、`cacheRead`、`cacheCreate`   | セッションのトークン数とプロンプトキャッシュの使用状況                                                  |
| `ram`                                                   | マシンのメモリ使用量                                                                                    |
| `customText`、`exec`                                    | 任意のテキスト、または [シェルコマンド](docs/configuration.md#shell-command-widget-exec)の出力          |

表示する内容のないウィジェットは自動的に隠れます。ウィジェットごとに色を変えたり、ラベルを外したり、独自の警告しきい値を設定したりできます。詳しくは [Configuration](docs/configuration.md) を参照してください。

## コマンド

| コマンド                                  | 内容                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| `npx agy-powerline init [--yes]`          | ステータスラインをインストールまたは更新                     |
| `npx agy-powerline configure`             | エディターを開く（別名 `config`）                            |
| `npx agy-powerline preset <name>`         | プリセットを適用（一覧は `--list`）                          |
| `npx agy-powerline theme <name>`          | テーマを切り替え（`--list`、`--gallery`）                    |
| `npx agy-powerline gradient <name>`       | Color each row with a gradient (`--list`, `off`)             |
| `npx agy-powerline layout <pills\|lines>` | レイアウトを切り替え                                         |
| `npx agy-powerline caps <style>`          | カプセルの形を切り替え：`round`、`angled`、`slanted`、`flat` |
| `npx agy-powerline doctor`                | インストールを確認し、問題を説明                             |
| `npx agy-powerline report`                | プライバシーに配慮したバグレポートを作成                     |
| `npx agy-powerline uninstall [--delete]`  | agy から削除（`--delete` でファイルも削除）                  |
| `npx agy-powerline render --demo`         | サンプルデータでバーを表示                                   |

各コマンドのオプションは `--help` で確認できます。

## 更新

```bash
npx agy-powerline init --yes   # 新しいバージョンのスクリプトをインストール
npx agy-powerline doctor       # すべてが最新か確認
```

設定はそのまま残ります。更新後に `agy` を再起動してください。

## トラブルシューティング

まず `npx agy-powerline doctor` を実行してください。インストールを確認し、見つかった問題の直し方を教えてくれます。よくある問題とバグの報告方法：[Troubleshooting](docs/troubleshooting.md)。

## プライバシーとセキュリティ

- **ネットワーク通信なし、テレメトリなし。** 表示する情報はすべて、agy がバーに渡すデータ、`.git`、OS から取得します。外部へのリンクは `configure` の `g` だけで、ブラウザーで GitHub のページを開きます。
- **設定は安全です。** `init` と `uninstall` は `settings.json` をバックアップし、解析できないファイルは編集しません。
- **追加しない限り何も実行されません。** ahead/behind を数えるための短い `git` の呼び出しを除き、バーが実行するコマンドは自分で設定した `exec` ウィジェットだけです。
- **ランタイム依存パッケージはゼロ**で、CI から [npm provenance](https://docs.npmjs.com/generating-provenance-statements) 付きで公開されています。

詳細：[SECURITY.md](SECURITY.md)。

## コントリビュート

コントリビュートを歓迎します。まず [CONTRIBUTING.md](CONTRIBUTING.md)（セットアップ、アーキテクチャ、ウィジェットやテーマの追加）と [Code of Conduct](CODE_OF_CONDUCT.md) をお読みください。プルリクエストは `develop` に向けて作成してください。バグは [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues) で報告し、アイデアやフィードバックは [Discussions](https://github.com/wassim-azi/agy-powerline/discussions) で共有してください。

コントリビューターの皆さんに感謝します：

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yatharth2soni"><img src="https://avatars.githubusercontent.com/u/238868599?v=4&s=160" width="80" height="80" alt="Yatharth Soni"/><br /><sub><b>Yatharth Soni</b></sub></a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dannyward630"><img src="https://avatars.githubusercontent.com/u/71604164?v=4&s=160" width="80" height="80" alt="Danny Ward"/><br /><sub><b>Danny Ward</b></sub></a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

agy-powerline が役に立ったら、⭐ を付けていただけると他の agy ユーザーにも見つけてもらいやすくなります。

## ライセンス

[MIT](LICENSE) © Wassim AZI
