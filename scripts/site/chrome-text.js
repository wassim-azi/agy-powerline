// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// The languages the home page is published in, each named in itself. Every
// page's footer links to the home page in each of the others.
const SITE_LANGUAGES = [
  { lang: "en", href: "/", label: "English", locale: "en_US" },
  { lang: "fr", href: "/fr/", label: "Français", locale: "fr_FR" },
  { lang: "es", href: "/es/", label: "Español", locale: "es_ES" },
  { lang: "ja", href: "/ja/", label: "日本語", locale: "ja_JP" },
  { lang: "zh-CN", href: "/zh-cn/", label: "简体中文", locale: "zh_CN" },
  { lang: "ko", href: "/ko/", label: "한국어", locale: "ko_KR" },
  { lang: "de", href: "/de/", label: "Deutsch", locale: "de_DE" },
];
const siteLanguage = (lang) => SITE_LANGUAGES.find((l) => l.lang === lang) || SITE_LANGUAGES[0];

// The site's text that isn't page content, per language. The bar's own text
// stays in English (AGENTS.md); only the page around it is translated.
const CHROME_TEXT = {
  en: {
    skip: "Skip to content",
    pageTheme: "Page theme",
    language: "Language",
    system: "System",
    light: "Light",
    dark: "Dark",
    menu: "Menu",
    nav: { install: "Install", docs: "Docs", themes: "Themes", configurator: "Configurator" },
    getStarted: "Get started",
    github: "agy-powerline on GitHub",
    tagline:
      "The agy statusline for Google Antigravity CLI. Free and open source, with no telemetry.",
    product: "Product",
    docs: "Docs",
    project: "Project",
    footerNote: "MIT License · Every bar on this site is drawn by the real statusline code",
    copy: "Copy",
    copied: "Copied",
    copiedStatus: "Copied to the clipboard",
    copyCode: "Copy the code",
  },
  fr: {
    skip: "Aller au contenu",
    pageTheme: "Thème de la page",
    language: "Langue",
    system: "Système",
    light: "Clair",
    dark: "Sombre",
    menu: "Menu",
    nav: {
      install: "Installation",
      docs: "Docs",
      themes: "Thèmes",
      configurator: "Configurateur",
    },
    getStarted: "Commencer",
    github: "agy-powerline sur GitHub",
    tagline: "La statusline agy pour Google Antigravity CLI. Libre et gratuite, sans télémétrie.",
    product: "Produit",
    docs: "Docs",
    project: "Projet",
    footerNote:
      "Licence MIT · Chaque barre de ce site est dessinée par le vrai code de la statusline",
    copy: "Copier",
    copied: "Copié",
    copiedStatus: "Copié dans le presse-papiers",
    copyCode: "Copier le code",
  },
  es: {
    skip: "Ir al contenido",
    pageTheme: "Tema de la página",
    language: "Idioma",
    system: "Sistema",
    light: "Claro",
    dark: "Oscuro",
    menu: "Menú",
    nav: {
      install: "Instalación",
      docs: "Docs",
      themes: "Temas",
      configurator: "Configurador",
    },
    getStarted: "Empezar",
    github: "agy-powerline en GitHub",
    tagline: "La statusline de agy para Google Antigravity CLI. Libre y gratuita, sin telemetría.",
    product: "Producto",
    docs: "Docs",
    project: "Proyecto",
    footerNote: "Licencia MIT · Cada barra de este sitio la dibuja el código real de la statusline",
    copy: "Copiar",
    copied: "Copiado",
    copiedStatus: "Copiado al portapapeles",
    copyCode: "Copiar el código",
  },
  ja: {
    skip: "本文へスキップ",
    pageTheme: "ページのテーマ",
    language: "言語",
    system: "システム",
    light: "ライト",
    dark: "ダーク",
    menu: "メニュー",
    nav: {
      install: "インストール",
      docs: "ドキュメント",
      themes: "テーマ",
      configurator: "設定",
    },
    getStarted: "はじめる",
    github: "GitHub の agy-powerline",
    tagline:
      "Google Antigravity CLI 向けの agy ステータスライン。無料のオープンソースで、テレメトリはありません。",
    product: "プロダクト",
    docs: "ドキュメント",
    project: "プロジェクト",
    footerNote:
      "MIT ライセンス · このサイトのバーはすべて実際のステータスラインのコードで描画しています",
    copy: "コピー",
    copied: "コピーしました",
    copiedStatus: "クリップボードにコピーしました",
    copyCode: "コードをコピー",
  },
  "zh-CN": {
    skip: "跳转到正文",
    pageTheme: "页面主题",
    language: "语言",
    system: "跟随系统",
    light: "浅色",
    dark: "深色",
    menu: "菜单",
    nav: {
      install: "安装",
      docs: "文档",
      themes: "主题",
      configurator: "配置",
    },
    getStarted: "开始使用",
    github: "GitHub 上的 agy-powerline",
    tagline: "Google Antigravity CLI 的 agy 状态栏。免费开源，无任何遥测。",
    product: "产品",
    docs: "文档",
    project: "项目",
    footerNote: "MIT 许可证 · 本站展示的所有状态栏均由真实状态栏代码渲染",
    copy: "复制",
    copied: "已复制",
    copiedStatus: "已复制到剪贴板",
    copyCode: "复制代码",
  },
  ko: {
    skip: "본문으로 건너뛰기",
    pageTheme: "페이지 테마",
    language: "언어",
    system: "시스템",
    light: "라이트",
    dark: "다크",
    menu: "메뉴",
    nav: {
      install: "설치",
      docs: "문서",
      themes: "테마",
      configurator: "설정",
    },
    getStarted: "시작하기",
    github: "GitHub의 agy-powerline",
    tagline: "Google Antigravity CLI용 agy 상태바. 텔레메트리 없는 무료 오픈소스.",
    product: "제품",
    docs: "문서",
    project: "프로젝트",
    footerNote: "MIT 라이선스 · 이 사이트의 모든 상태바는 실제 상태바 코드로 렌더링됩니다",
    copy: "복사",
    copied: "복사됨",
    copiedStatus: "클립보드에 복사되었습니다",
    copyCode: "코드 복사",
  },
  de: {
    skip: "Zum Inhalt springen",
    pageTheme: "Seitendesign",
    language: "Sprache",
    system: "System",
    light: "Hell",
    dark: "Dunkel",
    menu: "Menü",
    nav: {
      install: "Installation",
      docs: "Docs",
      themes: "Themes",
      configurator: "Konfigurator",
    },
    getStarted: "Loslegen",
    github: "agy-powerline auf GitHub",
    tagline:
      "Die agy-Statuszeile für Google Antigravity CLI. Kostenlos, Open Source und ohne Telemetrie.",
    product: "Produkt",
    docs: "Docs",
    project: "Projekt",
    footerNote:
      "MIT-Lizenz · Jede Leiste auf dieser Website wird vom echten Statuszeilen-Code gezeichnet",
    copy: "Kopieren",
    copied: "Kopiert",
    copiedStatus: "In die Zwischenablage kopiert",
    copyCode: "Code kopieren",
  },
};

// Every page links to every other page from the footer: it helps crawling and
// tells search engines which pages matter (sitelinks). Column titles aren't
// headings, so a page's own headings are the only ones in its outline.
function buildFooterColumns(repoUrl, npmUrl) {
  return [
    {
      key: "product",
      links: [
        ["Themes", "/themes/"],
        ["Configurator", "/configure/"],
        ["Install", "/install/"],
        ["Quota calculator", "/quota-calculator/"],
        ["Changelog", "/changelog/"],
      ],
    },
    {
      key: "docs",
      links: [
        ["Docs", "/docs/"],
        ["Configuration", "/docs/configuration/"],
        ["Widgets", "/widgets/"],
        ["Troubleshooting", "/troubleshooting/"],
        ["Payload reference", "/docs/payload/"],
        ["Guides", "/guides/"],
        ["FAQ", "/faq/"],
        ["llms.txt", "/llms.txt"],
      ],
    },
    {
      key: "project",
      links: [
        ["About", "/about/"],
        ["Security", "/security/"],
        ["Privacy", "/privacy/"],
        ["License (MIT)", `${repoUrl}/blob/main/LICENSE`],
        ["npm", npmUrl],
        ["Report an issue", `${repoUrl}/issues`],
      ],
    },
  ];
}

module.exports = {
  SITE_LANGUAGES,
  siteLanguage,
  CHROME_TEXT,
  buildFooterColumns,
};
