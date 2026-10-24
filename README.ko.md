# agy-powerline

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Español](README.es.md) | **한국어**

[![Version](https://img.shields.io/npm/v/agy-powerline.svg)](https://www.npmjs.com/package/agy-powerline)
[![Downloads](https://img.shields.io/npm/d18m/agy-powerline.svg?cacheSeconds=86400)](https://www.npmjs.com/package/agy-powerline)
[![Stars](https://img.shields.io/github/stars/wassim-azi/agy-powerline?style=flat&color=gold&cacheSeconds=86400)](https://github.com/wassim-azi/agy-powerline/stargazers)
[![CI](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml/badge.svg)](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml)
[![CodeQL](https://github.com/wassim-azi/agy-powerline/actions/workflows/codeql.yml/badge.svg)](https://github.com/wassim-azi/agy-powerline/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/wassim-azi/agy-powerline/badge)](https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15655/badge)](https://www.bestpractices.dev/projects/15655)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#개인정보-및-보안)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0078D6.svg)](docs/install.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open in GitHub Codespaces](https://img.shields.io/badge/open%20in-Codespaces-24292f.svg?logo=github&logoColor=white)](https://codespaces.new/wassim-azi/agy-powerline?quickstart=1)
[![Web Configurator](https://img.shields.io/badge/web%20configurator-live-00dc82.svg)](https://agy-powerline.com/configure/)
[![Mentioned in Awesome Gemini CLI](https://img.shields.io/badge/mentioned%20in-awesome-fc60a8.svg?logo=awesomelists&logoColor=white)](https://github.com/Piebald-AI/awesome-gemini-cli)

**Google Antigravity CLI를 위한 빠르고 자유롭게 설정 가능한 agy 스테이터스라인.**

> 이 문서는 영어 원본 [README](README.md)의 번역이며, 원본보다 오래된 내용일 수 있습니다. 내용이 다를 경우 영어 원본이 우선합니다. 상세 문서([`docs/`](docs/))는 영어로만 제공됩니다.

사용 중인 모델, Gemini 5시간/7일 할당량, Claude/GPT 및 Argon 할당량, 컨텍스트 창, git 브랜치 등을 한눈에 확인하세요. 인터랙티브 에디터에서 위젯, 테마, 레이아웃을 선택하세요. 명령 한 번으로 설치되며, 의존성은 없습니다.

<p align="center">
  <img src="assets/demo.gif" alt="agy-powerline configure: argon을 입력해 Argon의 주간 할당량을 추가한 뒤, 프리셋·테마·레이아웃을 살펴보며 바의 실시간 미리보기를 확인하고, Powerline 탭을 여는 모습" width="850">
</p>

## 설치

[Node.js](https://nodejs.org/) 20 이상과 [Antigravity CLI](https://antigravity.google/docs/cli/overview)가 필요합니다. Windows, macOS, Linux, WSL에서 동작합니다([WSL 관련 참고](docs/install.md#wsl)).

```bash
npx agy-powerline init        # 스테이터스라인을 agy에 설치
npx agy-powerline configure   # 선택 사항: 위젯, 테마, 레이아웃 선택
agy                           # Antigravity 시작
```

처음 설치하면 `init`이 각각의 미리보기와 함께 프리셋, 레이아웃, 테마를 물어봅니다. 질문을 건너뛰려면 `--yes`를 붙이세요. 무언가를 교체하기 전에 확인을 받고, Antigravity의 `settings.json`을 먼저 백업합니다. `init` 후에 `agy`를 한 번 재시작하세요. 자세한 내용: [`init`이 하는 일](docs/install.md).

<details>
<summary>스크린샷: 실제 agy 세션의 바 (Windows Terminal)</summary>

<p align="center">
  <img src="assets/screenshots/windows.png" alt="Windows Terminal의 agy 입력창 아래에 표시되는 agy-powerline: 위쪽에 짧은 대화, 아래쪽에 3행 Pills 바" width="850">
</p>

</details>

### agy 안에서 설치하기

agy-powerline은 agy 플러그인이기도 합니다. 플러그인으로 추가한 뒤 `agy` 세션에서 설치 스킬을 실행하면, `init`과 `doctor`를 대신 실행해 줍니다:

```text
agy plugin install https://github.com/wassim-azi/agy-powerline
/agy-powerline-setup
```

이후 `agy`를 한 번 재시작하세요. 자세한 내용: [플러그인 설치 경로](docs/install.md#install-from-inside-agy-plugin).

또는 `agy` 세션에 이렇게 붙여넣으세요.

```text
Install the agy-powerline statusline: run `npx agy-powerline init --yes`, then tell me to restart agy.
```

`--yes`는 agy가 답할 수 없는 프롬프트를 건너뛰고, `settings.json`을 백업한 뒤 기존 `statusLine`을 교체합니다.

Nerd Font가 없는 터미널에서는 ASCII 모드를 켜세요(`configure`에서 `i`).

## 커스터마이즈

`npx agy-powerline configure`를 실행하면 바의 실시간 미리보기가 있는 에디터가 열립니다. `←` `→`로 Widgets, Presets, Themes, Layout, Powerline 탭을 전환하고, `↑` `↓`로 이동, Enter로 선택, `q`로 저장하고 종료합니다. 각 화면의 키는 하단에 표시되며, 전체 목록은 [Configuration](docs/configuration.md#configurator-keys)에 있습니다.

브라우저를 선호하나요? [브라우저에서 바 만들기](https://agy-powerline.com/configure/)에서 실시간 미리보기로 구성한 뒤 다운로드하거나 가져올 수 있습니다.

변경 사항은 실행 중인 `agy`의 다음 갱신 시점에 적용됩니다.

### 프리셋

프리셋에서 시작한 뒤 조정하세요:

| 프리셋    | 표시 내용                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------- |
| `default` | 모델, 컨텍스트, git; 두 번째 행에 리셋 시간이 있는 5시간/7일 할당량                                  |
| `compact` | 한 줄: 짧은 모델명, 가장 여유 있는 할당량, 컨텍스트 %, git                                           |
| `agent`   | 에이전트 상태, 서브에이전트, 제목, 모드, 샌드박스; 모델, 컨텍스트 %, 아티팩트, 가장 여유 있는 할당량 |
| `git`     | 프로젝트, 브랜치, 워크트리, 스태시; 파일 수, 변경 줄 수, 커밋                                        |
| `tokens`  | 컨텍스트 토큰, 세션 토큰 입/출력, 캐시 적중; 오늘 및 최근 7일간 토큰                                 |
| `quotas`  | 요금제와 모델; 5시간/7일 할당량 나란히; 세 번째 행에 서드파티와 Argon                                |
| `full`    | 전부: 세션, 프로젝트, git; 컨텍스트, 토큰, 캐시; 양쪽 할당량                                         |

### 테마

| 터미널 배경 | 테마                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 다크        | `dark-aurora` (기본값), `dark-ocean`, `dark-ember`, `dark-forest`, `dark-neon`, `dark-mono`, `dark-nocturne`, `dark-onyx`, `dark-metro`, `dark-macchiato`, `dark-nord`, `dark-rose-pine` |
| 라이트      | `light-paper`, `light-sky`, `light-sunset`, `light-cream`, `light-gruvbox`, `light-tokyo-night`                                                                                          |
| 색약 친화   | `colorblind-dark`, `colorblind-light`                                                                                                                                                    |
| 직접 지정   | `custom` ([방법](docs/configuration.md#custom-theme))                                                                                                                                    |

모든 테마는 [테마 갤러리](https://agy-powerline.com/themes/) 또는 `npx agy-powerline theme --gallery`에서 미리 볼 수 있습니다. 각 행에 걸쳐 색이 이어지는 그라데이션을 넣으려면 `npx agy-powerline gradient <이름>`을 사용하세요. `aurora`, `sunset`, `ocean`, `forest`, `neon`, `candy`, `rainbow`, `mono` 또는 직접 지정한 색을 쓸 수 있습니다([방법](docs/configuration.md#gradients)).

### 레이아웃

**Pills** (기본값): 파워라인 스타일 캡슐. 둥근(round), 각진(angled), 기울어진(slanted), 평평한(flat) 모양을 고를 수 있고, 행 사이에 빈 줄을 넣을 수도 있습니다.

<p align="center">
  <img src="assets/screenshots/pills-dark.png" alt="dark-aurora 테마의 agy-powerline Pills 레이아웃: 모델, 컨텍스트, 프로젝트, git; 페이스 마커와 리셋 시간이 있는 Gemini 5시간/7일 할당량; Claude/GPT와 Argon 주간 할당량" width="850">
</p>

<details>
<summary>라이트 터미널에서</summary>

<p align="center">
  <img src="assets/screenshots/pills-light.png" alt="라이트 터미널에서 light-paper 테마의 agy-powerline Pills 레이아웃" width="850">
</p>

</details>

**Lines**: 같은 정보를 단순한 색 텍스트로 표시합니다.

<p align="center">
  <img src="assets/screenshots/lines-dark.png" alt="다크 터미널에서 dark-aurora 테마의 agy-powerline Lines 레이아웃" width="850">
</p>

<details>
<summary>라이트 터미널에서</summary>

<p align="center">
  <img src="assets/screenshots/lines-light.png" alt="라이트 터미널에서 light-paper 테마의 agy-powerline Lines 레이아웃" width="850">
</p>

</details>

**Classic**: `|` 구분자와 `███░│░░░░░` 같은 블록 미터가 있는 단순 색 텍스트입니다.

<p align="center">
  <img src="assets/screenshots/classic-dark.png" alt="다크 터미널에서 dark-aurora 테마의 agy-powerline Classic 레이아웃, 블록 미터 포함" width="850">
</p>

<details>
<summary>라이트 터미널에서</summary>

<p align="center">
  <img src="assets/screenshots/classic-light.png" alt="라이트 터미널에서 light-paper 테마의 agy-powerline Classic 레이아웃" width="850">
</p>

</details>

## 위젯

| 위젯                                                          | 표시 내용                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `model`                                                       | 사용 중인 모델                                                                                   |
| `clock`                                                       | 현재 현지 시각(12/24시간 형식은 `clock`에서 설정)                                                |
| `fiveHourBar`, `weeklyBar`                                    | 남은 5시간/7일 할당량을 미터로 표시, [페이스 마커](docs/configuration.md#quota-pace-marker) 포함 |
| `fiveHourPct`, `weeklyPct`                                    | 남은 5시간/7일 할당량을 백분율로 표시                                                            |
| `fiveHourReset`, `weeklyReset`                                | 할당량이 리셋되기까지 남은 시간 또는 리셋 시각                                                   |
| `quota`                                                       | 가장 먼저 소진될 가능성이 높은 할당량과 리셋 시각                                                |
| `thirdPartyFiveHour`, `thirdPartyWeekly`                      | 서드파티 모델 할당량                                                                             |
| `argonWeekly`, `argonReset`                                   | Gemini 4 Argon 자체 주간 할당량(Google AI Pro)과 리셋                                            |
| `context`, `contextPct`, `contextTokens`                      | 사용 중인 컨텍스트 창: 미터, 백분율 또는 토큰 수                                                 |
| `git`                                                         | 브랜치, 커밋되지 않은 변경, ahead/behind                                                         |
| `gitChanges`, `gitFiles`, `gitSha`, `gitStash`, `gitWorktree` | 추가/삭제된 줄, 스테이지/수정/추적 안 됨/충돌 파일 수, 커밋 ID, 스태시, 연결된 워크트리          |
| `project`, `cwd`                                              | 프로젝트 폴더, 현재 폴더                                                                         |
| `agentState`, `plan`, `sandbox`, `artifacts`, `version`       | 에이전트가 하는 일, 요금제, 샌드박스, 아티팩트, CLI 버전                                         |
| `tasks`                                                       | 실행 중인 서브에이전트와 백그라운드 작업                                                         |
| `mode`                                                        | 승인 모드(예: accept-edits)와 Vim 모드                                                           |
| `title`                                                       | 대화 제목                                                                                        |
| `sessionTime`                                                 | 활성 대화가 시작된 이후 경과 시간                                                                |
| `totalTokens`, `cacheHit`, `cacheRead`, `cacheCreate`         | 세션 토큰과 프롬프트 캐시 사용량                                                                 |
| `tokensToday`, `tokensWeek`                                   | 오늘 및 최근 7일간 사용한 토큰, 모든 대화 포함(Node 22.13+)                                      |
| `ram`                                                         | 시스템 메모리 사용량                                                                             |
| `os`                                                          | agy가 동작하는 시스템: Windows, macOS, Linux 또는 WSL                                            |
| `host`                                                        | OS의 현재 사용자와 짧은 호스트명(`alex@devbox`)                                                  |
| `customText`, `exec`                                          | 직접 입력한 텍스트 또는 [셸 명령](docs/configuration.md#shell-command-widget-exec)의 출력        |

표시할 내용이 없는 위젯은 스스로 숨습니다. 위젯은 색, 이름, 아이콘을 바꾸고 라벨을 없애거나 자체 알림 임계값을 지정할 수 있습니다. [Configuration](docs/configuration.md)을 참고하세요.

## 명령

| 명령                                               | 하는 일                                            |
| -------------------------------------------------- | -------------------------------------------------- |
| `npx agy-powerline init [--yes]`                   | 스테이터스라인 설치 또는 업데이트                  |
| `npx agy-powerline configure`                      | 에디터 열기(`config` 별칭)                         |
| `npx agy-powerline preset <이름>`                  | 프리셋 적용(`--list`로 목록 확인)                  |
| `npx agy-powerline theme <이름>`                   | 테마 전환(`--list`, `--gallery`)                   |
| `npx agy-powerline gradient <이름>`                | 각 행을 그라데이션으로 색칠(`--list`, `off`)       |
| `npx agy-powerline layout <pills\|lines\|classic>` | 레이아웃 전환                                      |
| `npx agy-powerline caps <스타일>`                  | 필 모양 전환: `round`, `angled`, `slanted`, `flat` |
| `npx agy-powerline export [파일]`                  | 구성을 파일로 저장, 백업하거나 공유할 때 사용      |
| `npx agy-powerline import <파일>`                  | 변경 내용을 보여준 뒤 구성 불러오기(`--merge`)     |
| `npx agy-powerline doctor`                         | 설치 상태 확인과 문제 설명                         |
| `npx agy-powerline report`                         | 개인정보를 포함하지 않는 버그 리포트 작성          |
| `npx agy-powerline uninstall [--delete]`           | agy에서 제거(`--delete`는 파일도 삭제)             |
| `npx agy-powerline render --demo`                  | 샘플 데이터로 바 출력                              |

모든 명령은 `--help`로 옵션을 확인할 수 있습니다.

## 업데이트

```bash
npx agy-powerline init --yes   # 새 버전의 스크립트 설치
npx agy-powerline doctor       # 모든 것이 최신인지 확인
```

설정은 유지됩니다. 이후 `agy`를 재시작하세요.

## 문제 해결

먼저 `npx agy-powerline doctor`를 실행하세요. 설치를 점검하고 해결 방법을 알려줍니다. 일반적인 문제와 버그 신고 방법: [Troubleshooting](docs/troubleshooting.md).

## 개인정보 및 보안

- **네트워크 요청 없음, 텔레메트리 없음.** 모든 정보는 agy가 바에 넘겨주는 데이터, `.git`, OS에서 옵니다. 외부 링크는 `configure`의 `g` 하나뿐이며, 브라우저에서 GitHub 페이지를 엽니다.
- **설정은 안전합니다.** `init`과 `uninstall`은 `settings.json`을 백업하고, 해석할 수 없는 파일은 편집하지 않습니다.
- **직접 추가하지 않는 한 아무것도 실행되지 않습니다.** ahead/behind 개수와 git 위젯의 파일/줄 수를 세는 짧은 `git` 호출 외에, 바가 실행하는 명령은 직접 설정한 `exec` 위젯뿐입니다.
- **런타임 의존성 0**, CI에서 [npm provenance](https://docs.npmjs.com/generating-provenance-statements)와 함께 게시됩니다.

자세한 내용: [SECURITY.md](SECURITY.md).

## 기여

기여를 환영합니다. [CONTRIBUTING.md](CONTRIBUTING.md)(설정, 아키텍처, 위젯/테마 추가)와 [Code of Conduct](CODE_OF_CONDUCT.md)부터 읽어보세요. 풀 리퀘스트는 `develop` 브랜치로 보내주세요. 버그는 [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues)에, 아이디어와 피드백은 [Discussions](https://github.com/wassim-azi/agy-powerline/discussions)에 남겨주세요.

기여해 주신 모든 분들께 감사드립니다:

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
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

agy-powerline이 유용했다면 ⭐를 눌러 주세요. 다른 agy 사용자가 찾는 데 도움이 됩니다.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=wassim-azi/agy-powerline&type=Date)](https://star-history.com/#wassim-azi/agy-powerline&Date)

## 라이선스

[MIT](LICENSE) © Wassim AZI
