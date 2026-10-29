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
    imageAlt:
      "agy-powerline: the agy statusline that tells you if your quota will last, with the default bar",
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
        'No. agy-powerline makes no network requests and has no telemetry or analytics. Problems go to a local log you can read, clear or turn off. <a href="/security/">Security &amp; Privacy</a> lists every file it reads and writes. Only this website uses Google Analytics, to count visits (<a href="/privacy/">Privacy</a>).',
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
    imageAlt:
      "agy-powerline : la statusline agy qui vous dit si votre quota va tenir, avec la barre par défaut",
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
    themesTitle: (n) => `${n} thèmes pour terminaux sombres, clairs et adaptés au daltonisme`,
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
        'Non. agy-powerline ne fait aucune requête réseau et n\'a ni télémétrie ni analytics. Les problèmes vont dans un journal local que vous pouvez lire, vider ou désactiver. <a href="/security/">Sécurité et confidentialité</a> (en anglais) liste chaque fichier lu et écrit. Seul ce site utilise Google Analytics, pour compter les visites (<a href="/privacy/">Confidentialité</a>, en anglais).',
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
  es: {
    lang: "es",
    title: "Statusline agy para Google Antigravity CLI - agy-powerline",
    description:
      "agy-powerline, la statusline de Google Antigravity CLI (agy): cuotas de Gemini, Claude/GPT y Argon con marcador de ritmo, contexto y git en la barra de agy.",
    imageAlt:
      "agy-powerline: la statusline de agy que te dice si tu cuota va a durar, con la barra por defecto",
    eyebrow: "Statusline para Google Antigravity CLI",
    heroTitle:
      'La statusline de agy que te dice <span class="grad-text">si tu cuota va a durar</span>',
    heroLead:
      "Tu modelo, la ventana de contexto, git y cada cuota de Antigravity con un marcador de ritmo, en una barra powerline bajo el cuadro de texto de agy. <strong>Un solo comando</strong> para instalarla.",
    copy: "Copiar",
    copyCommand: "Copiar:",
    copyInstall: "Copiar el comando de instalación",
    buildInBrowser: "Crea tu barra en el navegador",
    heroFacts: ["Node.js 20+", "0 dependencias", "Sin telemetría", "Licencia MIT"],
    askAgy: "Pregúntale a agy…",
    heroBarCaption:
      "Una vista previa en vivo de agy-powerline bajo el cuadro de texto de agy. Elige un tema y un diseño para cambiarla; cada barra de esta página la dibuja el código real de la statusline.",
    demoThemes: "Tema",
    demoLayouts: "Diseño",
    allThemes: (n) => `Los ${n} →`,
    anatomyEyebrow: "De un vistazo",
    anatomyTitle: "Lee la statusline de agy en diez segundos",
    anatomyLead:
      "La barra por defecto tiene dos filas: arriba, con qué estás trabajando; abajo, cuánta cuota te queda.",
    anatomy: [
      ["model", "Modelo", "El modelo que agy usa en este momento."],
      [
        "context",
        "Ventana de contexto",
        "Cuánto se ha llenado la conversación, antes de que agy tenga que compactarla.",
      ],
      [
        "git",
        "Git",
        "La rama, los cambios sin commit y los commits por delante o por detrás del upstream.",
      ],
      [
        "fiveHour",
        "Cuota de 5 horas",
        "Lo que queda de tu cuota de Gemini de 5 horas, y cuándo se reinicia.",
      ],
      [
        "pace",
        "Marcador de ritmo",
        "Dónde estás dentro de la ventana de la cuota. Si el relleno pasa el marcador, gastas cuota más rápido de lo que pasa el tiempo y se agotará antes del reinicio.",
      ],
      [
        "weekly",
        "Cuota de 7 días",
        "Tu cuota semanal, con su propio marcador de ritmo y su hora de reinicio.",
      ],
    ],
    paceGuide: "Cómo funciona el marcador de ritmo (en inglés) →",
    stepsEyebrow: "Empezar",
    stepsTitle: "Lista en un minuto",
    steps: [
      [
        "Instalar",
        "Necesita Node.js 20 o más reciente y Antigravity CLI. <code>init</code> guarda una copia del <code>settings.json</code> de agy antes de cambiarlo.",
        "npx agy-powerline init",
      ],
      [
        "Elegir un estilo",
        "Elige un preajuste, un diseño y un tema cuando <code>init</code> te lo pida, con una vista previa de cada uno. Puedes cambiarlos cuando quieras.",
        "npx agy-powerline configure",
      ],
      [
        "Reiniciar agy una vez",
        "La barra aparece bajo el cuadro de texto y se actualiza con agy. Los cambios posteriores se ven sin reiniciar.",
        "agy",
      ],
    ],
    installGuide: "Detalles de la instalación (en inglés) →",
    featuresEyebrow: "Funciones",
    featuresTitle: "Todo lo que quieres ver en la barra de estado de Antigravity CLI",
    featuresLead:
      "Hecha para Antigravity CLI a partir de sus datos reales de statusline, y segura para dejarla funcionando todo el día.",
    features: (n) => [
      [
        "pace",
        "Marcadores de ritmo",
        "Cada medidor de cuota muestra dónde estás dentro de su ventana, así ves que una cuota se va a agotar antes de que pase. Aviso al 30 % restante, peligro al 10 %.",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes} temas`,
        "Paletas oscuras, claras y aptas para daltónicos, cada una comprobada para el contraste WCAG AA sobre su terminal.",
        "/themes/",
      ],
      [
        "layouts",
        "3 diseños",
        "Pills, Lines y Classic, en tantas filas como quieras. Las filas se ajustan al ancho del terminal.",
        "/docs/configuration/",
      ],
      [
        "widgets",
        `${n.widgets} widgets`,
        "Modelo, contexto, git, cuotas, tokens, duración de la sesión, estado del agente, tus propios comandos de shell y más.",
        "/widgets/",
      ],
      [
        "configure",
        "Configúrala a tu manera",
        "Un editor en el terminal con vista previa en vivo, un configurador en el navegador, preajustes o JSON con un esquema.",
        "/configure/",
      ],
      [
        "platforms",
        "Windows, macOS, Linux, WSL",
        "Ninguna dependencia en tiempo de ejecución, Node.js 20 o más reciente. Sin llamadas de red y sin telemetría.",
        "/install/",
      ],
    ],
    shotsEyebrow: "Capturas reales",
    shotsTitle: "En un terminal real",
    shotsLead: "Tomadas en sesiones de agy, no son maquetas.",
    shots: {
      windows: [
        "Sesión de agy",
        "agy-powerline bajo el cuadro de texto de agy en Windows Terminal: una conversación corta arriba, la barra Pills de tres filas abajo",
      ],
      "pills-dark": [
        "Pills",
        "Diseño Pills de agy-powerline con el tema dark-aurora: modelo, contexto, proyecto y git; cuotas de Gemini de 5 h y 7 d con marcadores de ritmo y reinicios; cuotas semanales de Claude/GPT y Argon",
      ],
      "lines-light": [
        "Lines",
        "Diseño Lines de agy-powerline con el tema light-paper en un terminal claro",
      ],
      "classic-dark": [
        "Classic",
        "Diseño Classic de agy-powerline con el tema dark-aurora en un terminal oscuro, con medidores de bloques",
      ],
    },
    themesEyebrow: "Temas",
    themesTitle: (n) => `${n} temas para terminales oscuros, claros y para daltónicos`,
    themesLead:
      "Cada tema se dibuja sobre el fondo de terminal previsto, con una simulación de la visión de los colores, en la página de temas (en inglés).",
    seeAllThemes: (n) => `Ver los ${n} temas`,
    trustEyebrow: "Segura de ejecutar",
    trustTitle: "Se ejecuta en cada refresco, así que se mantiene ligera",
    trustBody:
      'Ninguna dependencia en tiempo de ejecución, ninguna llamada de red y una configuración que solo se lee de tu propia carpeta de instalación: un repositorio que clones no puede cambiar tu barra ni ejecutar comandos. <a href="/security/">Qué hace en tu equipo</a> (en inglés).',
    trust: [
      [
        "https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline",
        "OpenSSF Scorecard",
      ],
      ["https://www.bestpractices.dev/projects/15655", "OpenSSF Best Practices"],
      ["https://www.npmjs.com/package/agy-powerline", "Procedencia npm"],
      ["/security/", "0 dependencias"],
      ["/privacy/", "Sin telemetría"],
      ["https://github.com/wassim-azi/agy-powerline/blob/main/LICENSE", "Licencia MIT"],
    ],
    faqEyebrow: "Preguntas frecuentes",
    faqTitle: "Lo primero que se pregunta",
    faq: [
      [
        "¿Funciona en Windows?",
        'Sí: Windows, macOS, Linux y WSL. En Windows, agy ejecuta la barra con <code>cmd /c</code>, y <code>init</code> lo configura por ti. Para WSL, instálala con un Node.js de Linux dentro de WSL (<a href="/install/#wsl">notas sobre WSL</a>, en inglés).',
      ],
      [
        "¿Envía datos a algún sitio?",
        'No. agy-powerline no hace ninguna petición de red y no tiene telemetría ni analíticas. Los problemas van a un registro local que puedes leer, vaciar o desactivar. <a href="/security/">Seguridad y privacidad</a> (en inglés) enumera cada archivo que lee y escribe. Solo este sitio usa Google Analytics, para contar las visitas (<a href="/privacy/">Privacidad</a>, en inglés).',
      ],
      [
        "¿Hace más lento a agy?",
        "Un refresco le cuesta unos 0,1 s de trabajo a agy-powerline en un portátil con Windows 11. En Windows, arrancar <code>cmd</code> y Node añade unos 0,1–0,25 s, como para cualquier comando de statusline.",
      ],
      [
        "¿Qué cuotas muestra?",
        'Las cuotas de Gemini de 5 horas y 7 días, las cuotas de terceros (Claude y GPT) de 5 horas y 7 días, y la cuota semanal de Gemini 4 Argon en Google AI Pro, cada una con su hora de reinicio. La <a href="/guides/antigravity-quota/">guía de cuotas</a> (en inglés) explica los medidores.',
      ],
    ],
    allQuestions: "Todas las preguntas (en inglés) →",
    ctaTitle: "Entérate antes de quedarte sin cuota",
    ctaLead: "Instálala con un solo comando, o crea primero tu barra en el navegador.",
    viewOnGithub: "Ver en GitHub",
  },
};

module.exports = { HOME_TEXT };
