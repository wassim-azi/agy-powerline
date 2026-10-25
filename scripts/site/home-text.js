// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// The home page's text in each language it is published in. The bar itself,
// theme names and descriptions, widget ids and commands stay in English
// (AGENTS.md): only the page around them is translated. A translation is
// reviewed line by line by a fluent speaker before it ships.
// Values are HTML: escape <, > and & in plain text. Functions take the counts
// the page reads from the code ({ themes, widgets }).

const HOME_TEXT = {
  en: {
    lang: "en",
    title: "agy statusline for Google Antigravity CLI - agy-powerline",
    description:
      "agy-powerline is an agy statusline for Google Antigravity CLI: Gemini, Claude/GPT and Argon quotas with pace markers, context and git in agy's status bar.",
    eyebrow: "Statusline for Google Antigravity CLI",
    heroTitle:
      'The agy statusline that tells you <span class="grad-text">if your quota will last</span>',
    heroLead:
      "Your model, context window, git and every Antigravity quota with a pace marker, in a powerline bar under agy's input box. <strong>One command</strong> to set up.",
    copy: "Copy",
    copyCommand: "Copy:",
    copyInstall: "Copy the install command",
    buildInBrowser: "Build your bar in the browser",
    heroFacts: ["Node.js 20+", "0 dependencies", "No telemetry", "MIT license"],
    askAgy: "Ask agy anything…",
    heroBarCaption:
      "A live preview of agy-powerline under agy's input box. Pick a theme and a layout to change it; every bar on this page is drawn by the real statusline code.",
    demoThemes: "Theme",
    demoLayouts: "Layout",
    allThemes: (n) => `All ${n} →`,
    anatomyEyebrow: "At a glance",
    anatomyTitle: "Read the agy statusline in ten seconds",
    anatomyLead:
      "The default bar has two rows: what you are working with on top, how much quota you have left below.",
    anatomy: [
      ["model", "Model", "The model agy is using right now."],
      ["context", "Context window", "How full the conversation is, before agy has to compact it."],
      ["git", "Git", "Branch, uncommitted changes, and commits ahead of or behind upstream."],
      ["fiveHour", "5-hour quota", "What's left of your Gemini 5-hour quota, and when it resets."],
      [
        "pace",
        "Pace marker",
        "Where you are in the quota's window. Fill past the marker means you're using quota faster than time passes, and it runs out before the reset.",
      ],
      ["weekly", "7-day quota", "Your weekly quota, with its own pace marker and reset time."],
    ],
    paceGuide: "How the pace marker works →",
    stepsEyebrow: "Get started",
    stepsTitle: "Up and running in a minute",
    steps: [
      [
        "Install",
        "Needs Node.js 20 or newer and Antigravity CLI. <code>init</code> backs up agy's <code>settings.json</code> before changing it.",
        "npx agy-powerline init",
      ],
      [
        "Pick a look",
        "Choose a preset, a layout and a theme when <code>init</code> asks, with a preview of each. Change them any time.",
        "npx agy-powerline configure",
      ],
      [
        "Restart agy once",
        "The bar appears under the input box and refreshes with agy. Later changes show without a restart.",
        "agy",
      ],
    ],
    installGuide: "Installation details →",
    featuresEyebrow: "Features",
    featuresTitle: "Everything you want to see in Antigravity CLI's status bar",
    featuresLead:
      "Built for Antigravity CLI from its real status line data, and safe to leave running all day.",
    features: (n) => [
      [
        "pace",
        "Quota pace markers",
        "Every quota meter shows where you are in its window, so you see a quota running out before it does. Caution at 30% left, danger at 10%.",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes} themes`,
        "Dark, light and color-blind safe palettes, each checked for WCAG AA contrast on its terminal.",
        "/themes/",
      ],
      [
        "layouts",
        "3 layouts",
        "Pills, Lines and Classic, on as many rows as you like. Rows shrink to fit the terminal's width.",
        "/docs/configuration/",
      ],
      [
        "widgets",
        `${n.widgets} widgets`,
        "Model, context, git, quotas, tokens, session time, agent state, your own shell commands and more.",
        "/widgets/",
      ],
      [
        "configure",
        "Configure your way",
        "A terminal editor with a live preview, a browser configurator, presets, or plain JSON with a schema.",
        "/configure/",
      ],
      [
        "platforms",
        "Windows, macOS, Linux, WSL",
        "Zero runtime dependencies, Node.js 20 or newer. No network calls and no telemetry.",
        "/install/",
      ],
    ],
    shotsEyebrow: "Real screenshots",
    shotsTitle: "In a real terminal",
    shotsLead: "Taken in agy sessions, not mock-ups.",
    shots: {
      windows: [
        "agy session",
        "agy-powerline under agy's input box in Windows Terminal: a short conversation above, the three-row Pills bar below",
      ],
      "pills-dark": [
        "Pills",
        "agy-powerline Pills layout with the dark-aurora theme: model, context, project and git; Gemini 5h and 7d quotas with pace markers and resets; Claude/GPT and Argon weekly quotas",
      ],
      "lines-light": [
        "Lines",
        "agy-powerline Lines layout with the light-paper theme on a light terminal",
      ],
      "classic-dark": [
        "Classic",
        "agy-powerline Classic layout with the dark-aurora theme on a dark terminal, with block meters",
      ],
    },
    themesEyebrow: "Themes",
    themesTitle: (n) => `${n} themes for dark, light and color-blind terminals`,
    themesLead:
      "Every theme is drawn on its intended terminal background, with a color-vision simulation, on the themes page.",
    seeAllThemes: (n) => `See all ${n} themes`,
    trustEyebrow: "Safe to run",
    trustTitle: "It runs on every refresh, so it stays small",
    trustBody:
      'No runtime dependencies, no network calls, and a config read only from your own install folder: a repository you clone can\'t change your bar or run commands. <a href="/security/">What it does on your machine</a>.',
    trust: [
      [
        "https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline",
        "OpenSSF Scorecard",
      ],
      ["https://www.bestpractices.dev/projects/15655", "OpenSSF Best Practices"],
      ["https://www.npmjs.com/package/agy-powerline", "npm provenance"],
      ["/security/", "0 dependencies"],
      ["/privacy/", "No telemetry"],
      ["https://github.com/wassim-azi/agy-powerline/blob/main/LICENSE", "MIT license"],
    ],
    faqEyebrow: "FAQ",
    faqTitle: "Questions people ask first",
    faq: [
      [
        "Does it work on Windows?",
        'Yes: Windows, macOS, Linux and WSL. On Windows agy runs the bar through <code>cmd /c</code>, which <code>init</code> sets up for you. For WSL, install it with a Linux Node.js inside WSL (<a href="/install/#wsl">WSL notes</a>).',
      ],
      [
        "Does it send any data anywhere?",
        'No. agy-powerline makes no network requests and has no telemetry or analytics. Problems go to a local log you can read, clear or turn off. <a href="/security/">Security &amp; Privacy</a> lists every file it reads and writes.',
      ],
      [
        "Does it slow agy down?",
        "A refresh takes about 0.1 s of agy-powerline's own work on a Windows 11 laptop. On Windows, starting <code>cmd</code> and Node adds about 0.1–0.25 s, as for any status line command.",
      ],
      [
        "Which quotas does it show?",
        'The Gemini 5-hour and 7-day quotas, the third-party (Claude and GPT) 5-hour and 7-day quotas, and Gemini 4 Argon\'s weekly quota on Google AI Pro, each with its reset time. The <a href="/guides/antigravity-quota/">quota guide</a> explains the meters.',
      ],
    ],
    allQuestions: "All questions →",
    ctaTitle: "Know before you run out",
    ctaLead: "Install it in one command, or build your bar in the browser first.",
    viewOnGithub: "View on GitHub",
  },
  fr: {
    lang: "fr",
    title: "Statusline agy pour Google Antigravity CLI - agy-powerline",
    description:
      "agy-powerline, la statusline de Google Antigravity CLI (agy) : quotas Gemini, Claude/GPT et Argon avec repère de rythme, contexte et git dans la barre d'agy.",
    eyebrow: "Statusline pour Google Antigravity CLI",
    heroTitle:
      'La statusline agy qui vous dit <span class="grad-text">si votre quota va tenir</span>',
    heroLead:
      "Votre modèle, la fenêtre de contexte, git et chaque quota Antigravity avec un repère de rythme, dans une barre powerline sous la zone de saisie d'agy. <strong>Une seule commande</strong> pour l'installer.",
    copy: "Copier",
    copyCommand: "Copier :",
    copyInstall: "Copier la commande d'installation",
    buildInBrowser: "Composer votre barre dans le navigateur",
    heroFacts: ["Node.js 20+", "0 dépendance", "Aucune télémétrie", "Licence MIT"],
    askAgy: "Demandez à agy…",
    heroBarCaption:
      "Un aperçu en direct d'agy-powerline sous la zone de saisie d'agy. Choisissez un thème et une disposition pour le modifier ; chaque barre de cette page est dessinée par le vrai code de la statusline.",
    demoThemes: "Thème",
    demoLayouts: "Disposition",
    allThemes: (n) => `Les ${n} →`,
    anatomyEyebrow: "En un coup d'œil",
    anatomyTitle: "Lire la statusline agy en dix secondes",
    anatomyLead:
      "La barre par défaut a deux lignes : ce avec quoi vous travaillez en haut, le quota qu'il vous reste en bas.",
    anatomy: [
      ["model", "Modèle", "Le modèle qu'agy utilise en ce moment."],
      [
        "context",
        "Fenêtre de contexte",
        "Le remplissage de la conversation, avant qu'agy doive la compacter.",
      ],
      [
        "git",
        "Git",
        "La branche, les modifications non commitées et les commits d'avance ou de retard.",
      ],
      [
        "fiveHour",
        "Quota 5 heures",
        "Ce qu'il reste de votre quota Gemini sur 5 heures, et quand il se remet à zéro.",
      ],
      [
        "pace",
        "Repère de rythme",
        "Où vous en êtes dans la fenêtre du quota. Si le remplissage dépasse le repère, vous consommez plus vite que le temps ne passe et le quota s'épuisera avant sa remise à zéro.",
      ],
      [
        "weekly",
        "Quota 7 jours",
        "Votre quota hebdomadaire, avec son propre repère de rythme et sa remise à zéro.",
      ],
    ],
    paceGuide: "Comment fonctionne le repère de rythme (en anglais) →",
    stepsEyebrow: "Démarrer",
    stepsTitle: "Prête en une minute",
    steps: [
      [
        "Installer",
        "Il faut Node.js 20 ou plus récent et Antigravity CLI. <code>init</code> sauvegarde le <code>settings.json</code> d'agy avant de le modifier.",
        "npx agy-powerline init",
      ],
      [
        "Choisir un style",
        "Choisissez un préréglage, une disposition et un thème quand <code>init</code> le demande, avec un aperçu de chacun. Modifiables à tout moment.",
        "npx agy-powerline configure",
      ],
      [
        "Redémarrer agy une fois",
        "La barre apparaît sous la zone de saisie et se rafraîchit avec agy. Les modifications suivantes s'affichent sans redémarrage.",
        "agy",
      ],
    ],
    installGuide: "Détails de l'installation (en anglais) →",
    featuresEyebrow: "Fonctionnalités",
    featuresTitle: "Tout ce que vous voulez voir dans la barre d'état d'Antigravity CLI",
    featuresLead:
      "Conçue pour Antigravity CLI à partir de ses vraies données de statusline, et sûre à laisser tourner toute la journée.",
    features: (n) => [
      [
        "pace",
        "Repères de rythme",
        "Chaque jauge de quota montre où vous en êtes dans sa fenêtre : vous voyez un quota s'épuiser avant qu'il ne soit vide. Attention à 30 % restants, danger à 10 %.",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes} thèmes`,
        "Des palettes sombres, claires et adaptées au daltonisme, chacune vérifiée pour le contraste WCAG AA sur son terminal.",
        "/themes/",
      ],
      [
        "layouts",
        "3 dispositions",
        "Pills, Lines et Classic, sur autant de lignes que vous voulez. Les lignes se resserrent pour tenir dans la largeur du terminal.",
        "/docs/configuration/",
      ],
      [
        "widgets",
        `${n.widgets} widgets`,
        "Modèle, contexte, git, quotas, tokens, durée de session, état de l'agent, vos propres commandes shell et plus encore.",
        "/widgets/",
      ],
      [
        "configure",
        "Configurez à votre façon",
        "Un éditeur dans le terminal avec aperçu en direct, un configurateur dans le navigateur, des préréglages, ou du JSON avec un schéma.",
        "/configure/",
      ],
      [
        "platforms",
        "Windows, macOS, Linux, WSL",
        "Aucune dépendance à l'exécution, Node.js 20 ou plus récent. Aucun appel réseau et aucune télémétrie.",
        "/install/",
      ],
    ],
    shotsEyebrow: "Vraies captures",
    shotsTitle: "Dans un vrai terminal",
    shotsLead: "Prises dans de vraies sessions agy, pas des maquettes.",
    shots: {
      windows: [
        "Session agy",
        "agy-powerline sous la zone de saisie d'agy dans Windows Terminal : une courte conversation au-dessus, la barre Pills sur trois lignes en dessous",
      ],
      "pills-dark": [
        "Pills",
        "Disposition Pills d'agy-powerline avec le thème dark-aurora : modèle, contexte, projet et git ; quotas Gemini 5 h et 7 j avec repères de rythme et remises à zéro ; quotas hebdomadaires Claude/GPT et Argon",
      ],
      "lines-light": [
        "Lines",
        "Disposition Lines d'agy-powerline avec le thème light-paper sur un terminal clair",
      ],
      "classic-dark": [
        "Classic",
        "Disposition Classic d'agy-powerline avec le thème dark-aurora sur un terminal sombre, avec des jauges en blocs",
      ],
    },
    themesEyebrow: "Thèmes",
    themesTitle: (n) => `${n} thèmes pour terminaux sombres, clairs et daltoniens`,
    themesLead:
      "Chaque thème est dessiné sur le fond de terminal prévu, avec une simulation de la vision des couleurs, sur la page des thèmes (en anglais).",
    seeAllThemes: (n) => `Voir les ${n} thèmes`,
    trustEyebrow: "Sûre à exécuter",
    trustTitle: "Elle tourne à chaque rafraîchissement, alors elle reste légère",
    trustBody:
      "Aucune dépendance à l'exécution, aucun appel réseau, et une configuration lue uniquement dans votre propre dossier d'installation : un dépôt que vous clonez ne peut ni changer votre barre ni lancer de commandes. <a href=\"/security/\">Ce qu'elle fait sur votre machine</a> (en anglais).",
    trust: [
      [
        "https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline",
        "OpenSSF Scorecard",
      ],
      ["https://www.bestpractices.dev/projects/15655", "OpenSSF Best Practices"],
      ["https://www.npmjs.com/package/agy-powerline", "Provenance npm"],
      ["/security/", "0 dépendance"],
      ["/privacy/", "Aucune télémétrie"],
      ["https://github.com/wassim-azi/agy-powerline/blob/main/LICENSE", "Licence MIT"],
    ],
    faqEyebrow: "FAQ",
    faqTitle: "Les premières questions",
    faq: [
      [
        "Fonctionne-t-elle sous Windows ?",
        'Oui : Windows, macOS, Linux et WSL. Sous Windows, agy lance la barre via <code>cmd /c</code>, ce que <code>init</code> configure pour vous. Pour WSL, installez-la avec un Node.js Linux dans WSL (<a href="/install/#wsl">notes WSL</a>, en anglais).',
      ],
      [
        "Envoie-t-elle des données quelque part ?",
        'Non. agy-powerline ne fait aucune requête réseau et n\'a ni télémétrie ni analytics. Les problèmes vont dans un journal local que vous pouvez lire, vider ou désactiver. <a href="/security/">Sécurité et confidentialité</a> (en anglais) liste chaque fichier lu et écrit.',
      ],
      [
        "Ralentit-elle agy ?",
        "Un rafraîchissement demande environ 0,1 s de travail à agy-powerline sur un portable Windows 11. Sous Windows, le démarrage de <code>cmd</code> et de Node ajoute environ 0,1 à 0,25 s, comme pour toute commande de statusline.",
      ],
      [
        "Quels quotas affiche-t-elle ?",
        'Les quotas Gemini sur 5 heures et 7 jours, les quotas tiers (Claude et GPT) sur 5 heures et 7 jours, et le quota hebdomadaire de Gemini 4 Argon sur Google AI Pro, chacun avec sa remise à zéro. Le <a href="/guides/antigravity-quota/">guide des quotas</a> (en anglais) explique les jauges.',
      ],
    ],
    allQuestions: "Toutes les questions (en anglais) →",
    ctaTitle: "Sachez-le avant d'être à court",
    ctaLead: "Installez-la en une commande, ou composez d'abord votre barre dans le navigateur.",
    viewOnGithub: "Voir sur GitHub",
  },
};

module.exports = { HOME_TEXT };
