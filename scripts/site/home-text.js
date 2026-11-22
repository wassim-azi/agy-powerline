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
      "agy statusline for Google Antigravity CLI: Gemini (Hydrogen, Neon, Argon, Carbon, Flash) and Anthropic (Claude/Sonnet) quotas, pace markers, git.",
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
        "Needs Node.js 20 or newer and Antigravity CLI. Backs up agy's <code>settings.json</code> before changing it, then opens the live editor.",
        "npx agy-powerline",
      ],
      [
        "Pick a look",
        "Browse presets, layouts, themes and widgets with a live preview during setup, or reopen the editor any time.",
        "npx agy-powerline",
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
        "Quota pace and forecasts",
        "Pace markers show where you are in each 5h or 7d window, and run-out forecasts estimate when quota runs out at your current rate. Caution at 30%, danger at 10%.",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes} themes`,
        "Dark, light and color-blind safe palettes checked for WCAG AA contrast, plus 8 row gradients and 9 meter styles.",
        "/themes/",
      ],
      [
        "layouts",
        "3 layouts and 16 settings",
        "Pills, Lines and Classic across any number of rows, with quotas as left or used, alignment, max width, and fit or wrap overflow.",
        "/settings/",
      ],
      [
        "widgets",
        `${n.widgets} widgets`,
        "Context with compaction limits, 30-day tokens and spend with budget alerts, agent state, tasks and queue, clickable git links, fish paths, env and shell commands.",
        "/widgets/",
      ],
      [
        "configure",
        "Configure your way",
        "A terminal editor with sample scenarios and terminal-width previews, a browser configurator with full Settings parity, presets, or JSON with a schema.",
        "/configure/",
      ],
      [
        "platforms",
        "Windows, macOS, Linux, WSL",
        "Runs locally with Node.js 20+, zero runtime dependencies, no network calls, no telemetry, and 7 bar languages.",
        "/install/",
      ],
    ],
    shotsEyebrow: "Real screenshots",
    shotsTitle: "In a real terminal",
    shotsLead: "Taken in agy sessions and in the editor, not mock-ups.",
    shots: {
      editor: [
        "Editor",
        "The agy-powerline editor in a terminal: adding Argon's reset timer, previewing presets, filtering themes, switching between Classic, Pills and Lines, and the Settings tab",
      ],
      windows: [
        "agy session",
        "agy-powerline under agy's input box in Windows Terminal: a short conversation above, the three-row Pills bar below",
      ],
      "pills-dark": [
        "Pills",
        "agy-powerline Pills layout with the dark-aurora theme: model, context, cache hit, 30-day tokens, clock, RAM and OS; Gemini 5h quota with pace marker and reset, Anthropic (Claude/Sonnet) 5h quota, project and git; Gemini 7d quota and reset, Anthropic and Argon weekly quotas",
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
        'Yes: Windows, macOS, Linux and WSL. On Windows agy runs the bar through <code>cmd /c</code>, which the installer sets up for you. For WSL, install it with a Linux Node.js inside WSL (<a href="/install/#wsl">WSL notes</a>).',
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
        'The Google Gemini (Hydrogen, Neon, Carbon, Flash) 5-hour and 7-day quotas, the Anthropic (Claude and Sonnet) 5-hour and 7-day quotas, and Gemini 4 Argon\'s weekly quota on Google AI Pro, each with its reset time. The <a href="/guides/antigravity-quota/">quota guide</a> explains the meters.',
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
      "agy-powerline pour Google Antigravity CLI : quotas Gemini (Hydrogen, Neon, Argon, Carbon, Flash) et Anthropic (Claude/Sonnet), rythme, contexte, git.",
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
        "La branche, les modifications non commitées et les commits en avance ou en retard sur l'upstream.",
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
        "Il faut Node.js 20 ou plus récent et Antigravity CLI. Sauvegarde le <code>settings.json</code> d'agy avant de le modifier, puis ouvre l'éditeur avec aperçu en direct.",
        "npx agy-powerline",
      ],
      [
        "Choisir un style",
        "Parcourez préréglages, dispositions, thèmes et widgets avec un aperçu en direct lors de l'installation, ou rouvrez l'éditeur à tout moment.",
        "npx agy-powerline",
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
        "Rythme et prévisions",
        "Des repères indiquent où vous en êtes dans chaque fenêtre 5h ou 7j, et les prévisions d'épuisement estiment quand votre quota sera vide à ce rythme. Attention à 30 %, danger à 10 %.",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes} thèmes`,
        "Des palettes sombres, claires et adaptées au daltonisme vérifiées pour le contraste WCAG AA, avec 8 dégradés de ligne et 9 styles de jauge.",
        "/themes/",
      ],
      [
        "layouts",
        "3 dispositions et 16 réglages",
        "Pills, Lines et Classic sur autant de lignes que vous voulez, avec quotas restants ou utilisés, alignement, largeur maximale et ajustement ou retour à la ligne.",
        "/settings/",
      ],
      [
        "widgets",
        `${n.widgets} widgets`,
        "Contexte avec limite de compaction, jetons sur 30 jours et dépense avec alertes de budget, état de l'agent, tâches et file d'attente, liens git cliquables, chemins fish, env et commandes shell.",
        "/widgets/",
      ],
      [
        "configure",
        "Configurez à votre façon",
        "Un éditeur dans le terminal avec aperçu par scénario et largeur, un configurateur web avec tous les réglages, des préréglages ou du JSON avec schéma.",
        "/configure/",
      ],
      [
        "platforms",
        "Windows, macOS, Linux, WSL",
        "Fonctionne localement avec Node.js 20+, aucune dépendance à l'exécution, aucun appel réseau, aucune télémétrie et 7 langues pour la barre.",
        "/install/",
      ],
    ],
    shotsEyebrow: "Vraies captures",
    shotsTitle: "Dans un vrai terminal",
    shotsLead: "Prises dans de vraies sessions agy et dans l'éditeur, pas des maquettes.",
    shots: {
      editor: [
        "Éditeur",
        "L'éditeur d'agy-powerline dans un terminal : ajout du compte à rebours d'Argon, aperçu des préréglages, filtre des thèmes, passage de Classic à Pills et Lines, et l'onglet Settings",
      ],
      windows: [
        "Session agy",
        "agy-powerline sous la zone de saisie d'agy dans Windows Terminal : une courte conversation au-dessus, la barre Pills sur trois lignes en dessous",
      ],
      "pills-dark": [
        "Pills",
        "Disposition Pills d'agy-powerline avec le thème dark-aurora : modèle, contexte, cache, jetons sur 30 jours, heure, RAM et OS ; quota Gemini sur 5h avec repère de rythme et réinitialisation, quota Anthropic (Claude/Sonnet) sur 5h, projet et Git ; quota Gemini sur 7j et réinitialisation, quotas hebdomadaires Anthropic et Argon",
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
        'Oui : Windows, macOS, Linux et WSL. Sous Windows, agy lance la barre via <code>cmd /c</code>, ce que le programme d\'installation configure pour vous. Pour WSL, installez-la avec un Node.js Linux dans WSL (<a href="/install/#wsl">notes WSL</a>, en anglais).',
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
        'Les quotas Google Gemini (Hydrogen, Neon, Carbon, Flash) sur 5 heures et 7 jours, les quotas Anthropic (Claude et Sonnet) sur 5 heures et 7 jours, et le quota hebdomadaire de Gemini 4 Argon sur Google AI Pro, chacun avec sa remise à zéro. Le <a href="/guides/antigravity-quota/">guide des quotas</a> (en anglais) explique les jauges.',
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
      "agy-powerline para Google Antigravity CLI: cuotas Gemini (Hydrogen, Neon, Argon, Carbon, Flash) y Anthropic (Claude/Sonnet), ritmo, contexto y git.",
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
        "Necesita Node.js 20 o más reciente y Antigravity CLI. Guarda una copia del <code>settings.json</code> de agy antes de cambiarlo y abre el editor con vista previa en vivo.",
        "npx agy-powerline",
      ],
      [
        "Elegir un estilo",
        "Explora preajustes, diseños, temas y widgets con vista previa en vivo al instalar, o vuelve a abrir el editor cuando quieras.",
        "npx agy-powerline",
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
        "Ritmo y previsiones",
        "Los marcadores indican en qué punto estás de cada ventana de 5h o 7d, y las previsiones estiman cuándo se agotará la cuota a tu ritmo actual. Aviso al 30 %, peligro al 10 %.",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes} temas`,
        "Paletas oscuras, claras y aptas para daltónicos comprobadas para el contraste WCAG AA, más 8 degradados por fila y 9 estilos de medidor.",
        "/themes/",
      ],
      [
        "layouts",
        "3 diseños y 16 ajustes",
        "Pills, Lines y Classic en las filas que quieras, con cuotas restantes o usadas, alineación, ancho máximo y ajuste o salto de línea.",
        "/settings/",
      ],
      [
        "widgets",
        `${n.widgets} widgets`,
        "Contexto con límite de compactación, tokens de 30 días y gasto con alertas de presupuesto, estado del agente, tareas y cola, enlaces git clicables, rutas fish, env y comandos de shell.",
        "/widgets/",
      ],
      [
        "configure",
        "Configúrala a tu manera",
        "Un editor en el terminal con vista previa por escenario y ancho, un configurador web con todos los ajustes, preajustes o JSON con esquema.",
        "/configure/",
      ],
      [
        "platforms",
        "Windows, macOS, Linux, WSL",
        "Se ejecuta en local con Node.js 20+, cero dependencias en ejecución, sin llamadas de red, sin telemetría y 7 idiomas para la barra.",
        "/install/",
      ],
    ],
    shotsEyebrow: "Capturas reales",
    shotsTitle: "En un terminal real",
    shotsLead: "Tomadas en sesiones de agy y en el editor, no son maquetas.",
    shots: {
      editor: [
        "Editor",
        "El editor de agy-powerline en una terminal: añade el reinicio de Argon, previsualiza ajustes predefinidos, filtra temas, cambia entre Classic, Pills y Lines, y muestra la pestaña Settings",
      ],
      windows: [
        "Sesión de agy",
        "agy-powerline bajo el cuadro de texto de agy en Windows Terminal: una conversación corta arriba, la barra Pills de tres filas abajo",
      ],
      "pills-dark": [
        "Pills",
        "Diseño Pills de agy-powerline con el tema dark-aurora: modelo, contexto, caché, tokens de 30 días, hora, RAM y SO; cuota de Gemini de 5h con marcador de ritmo y reinicio, cuota de Anthropic (Claude/Sonnet) de 5h, proyecto y git; cuota de Gemini de 7d y reinicio, cuotas semanales de Anthropic y Argon",
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
        'Sí: Windows, macOS, Linux y WSL. En Windows, agy ejecuta la barra con <code>cmd /c</code>, y el instalador lo configura por ti. Para WSL, instálala con un Node.js de Linux dentro de WSL (<a href="/install/#wsl">notas sobre WSL</a>, en inglés).',
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
        'Las cuotas de Google Gemini (Hydrogen, Neon, Carbon, Flash) de 5 horas y 7 días, las cuotas de Anthropic (Claude y Sonnet) de 5 horas y 7 días, y la cuota semanal de Gemini 4 Argon en Google AI Pro, cada una con su hora de reinicio. La <a href="/guides/antigravity-quota/">guía de cuotas</a> (en inglés) explica los medidores.',
      ],
    ],
    allQuestions: "Todas las preguntas (en inglés) →",
    ctaTitle: "Entérate antes de quedarte sin cuota",
    ctaLead: "Instálala con un solo comando, o crea primero tu barra en el navegador.",
    viewOnGithub: "Ver en GitHub",
  },
  ja: {
    lang: "ja",
    title: "Google Antigravity CLI 向け agy ステータスライン - agy-powerline",
    description:
      "agy-powerline は Google Antigravity CLI 用ステータスライン。Gemini（Hydrogen、Neon、Argon、Carbon、Flash）や Anthropic（Claude/Sonnet）のクォータ、git を表示。",
    imageAlt:
      "agy-powerline：クォータが最後までもつかがわかる agy のステータスラインと、デフォルトのバー",
    eyebrow: "Google Antigravity CLI 向けステータスライン",
    heroTitle:
      'クォータが<span class="grad-text">最後までもつか</span>がわかる agy のステータスライン',
    heroLead:
      "モデル、コンテキストウィンドウ、git、そして Antigravity のすべてのクォータをペースマーカー付きで、agy の入力欄の下の powerline バーに表示します。セットアップは<strong>コマンドひとつ</strong>です。",
    copy: "コピー",
    copyCommand: "コピー：",
    copyInstall: "インストールコマンドをコピー",
    buildInBrowser: "ブラウザでバーを作る",
    heroFacts: ["Node.js 20+", "依存パッケージ 0", "テレメトリなし", "MIT ライセンス"],
    askAgy: "agy に何でも質問…",
    heroBarCaption:
      "agy の入力欄の下に表示される agy-powerline のライブプレビューです。テーマとレイアウトを選ぶと切り替わります。このページのバーはすべて、実際のステータスラインのコードで描画しています。",
    demoThemes: "テーマ",
    demoLayouts: "レイアウト",
    allThemes: (n) => `全 ${n} 種 →`,
    anatomyEyebrow: "ひと目でわかる",
    anatomyTitle: "agy のステータスラインを 10 秒で読む",
    anatomyLead:
      "デフォルトのバーは 2 行です。上の行は今使っているもの、下の行はクォータの残りを示します。",
    anatomy: [
      ["model", "モデル", "agy が今使っているモデル。"],
      [
        "context",
        "コンテキストウィンドウ",
        "agy が会話を圧縮しなければならなくなるまでに、会話がどれだけ埋まっているか。",
      ],
      ["git", "Git", "ブランチ、未コミットの変更、upstream より進んでいる・遅れているコミット数。"],
      [
        "fiveHour",
        "5 時間クォータ",
        "Gemini の 5 時間クォータの残りと、それがいつリセットされるか。",
      ],
      [
        "pace",
        "ペースマーカー",
        "クォータの期間のうち、今どこにいるかを示します。メーターがマーカーを越えていれば、時間の経過より速くクォータを使っていて、リセットの前に使い切ることになります。",
      ],
      ["weekly", "7 日間クォータ", "週間クォータ。専用のペースマーカーとリセット時刻が付きます。"],
    ],
    paceGuide: "ペースマーカーの仕組み（英語）→",
    stepsEyebrow: "はじめる",
    stepsTitle: "1 分で使い始められます",
    steps: [
      [
        "インストール",
        "Node.js 20 以上と Antigravity CLI が必要です。agy の <code>settings.json</code> を変更する前にバックアップし、ライブエディターを開きます。",
        "npx agy-powerline",
      ],
      [
        "見た目を選ぶ",
        "セットアップ中にプリセット、レイアウト、テーマ、ウィジェットをプレビューしながら選べます。あとからいつでも開き直せます。",
        "npx agy-powerline",
      ],
      [
        "agy を一度再起動",
        "バーが入力欄の下に表示され、agy に合わせて更新されます。その後の変更は再起動なしで反映されます。",
        "agy",
      ],
    ],
    installGuide: "インストールの詳細（英語）→",
    featuresEyebrow: "機能",
    featuresTitle: "Antigravity CLI のステータスバーで見たいものすべて",
    featuresLead:
      "Antigravity CLI の実際のステータスラインのデータをもとに作られていて、一日中動かしたままでも安全です。",
    features: (n) => [
      [
        "pace",
        "ペース表示と枯渇予測",
        "ペースマーカーが 5h・7d 期間内の現在位置を示し、枯渇予測が今のペースでいつ尽きるかを見積もります。残り 30% で注意、10% で危険を示します。",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes} 種類のテーマ`,
        "ダーク、ライト、色覚多様性に配慮した配色を WCAG AA のコントラストで確認済み。8 種の行グラデーションと 9 種のメータースタイルも選べます。",
        "/themes/",
      ],
      [
        "layouts",
        "3 レイアウトと 16 の設定",
        "Pills、Lines、Classic を好きな行数で配置でき、残量/使用量表示、配置、最大幅、縮小または折り返しを設定できます。",
        "/settings/",
      ],
      [
        "widgets",
        `${n.widgets} 種類のウィジェット`,
        "圧縮上限付きコンテキスト、予算アラート付きの 30 日トークンとコスト、エージェント状態・タスク・キュー、クリックできる git リンク、fish 風パス、環境変数、シェルコマンドに対応。",
        "/widgets/",
      ],
      [
        "configure",
        "好きな方法で設定",
        "シナリオや端末幅を切り替えられるターミナルエディター、同じ設定を備えたブラウザコンフィギュレーター、プリセット、スキーマ付き JSON から選べます。",
        "/configure/",
      ],
      [
        "platforms",
        "Windows, macOS, Linux, WSL",
        "Node.js 20 以上でローカル動作し、ランタイム依存ゼロ・ネットワーク通信なし・テレメトリなし。7 言語のバー表示に対応。",
        "/install/",
      ],
    ],
    shotsEyebrow: "実際のスクリーンショット",
    shotsTitle: "実際のターミナルで",
    shotsLead: "agy のセッションとエディターで撮影したもので、モックアップではありません。",
    shots: {
      editor: [
        "エディター",
        "ターミナルで動く agy-powerline のエディター：Argon のリセットタイマーを追加し、プリセットをプレビューし、テーマを絞り込み、Classic・Pills・Lines を切り替え、Settings タブを表示",
      ],
      windows: [
        "agy のセッション",
        "Windows Terminal で agy の入力欄の下に表示された agy-powerline：上に短い会話、下に 3 行の Pills バー",
      ],
      "pills-dark": [
        "Pills",
        "dark-aurora テーマの agy-powerline Pills レイアウト：モデル、コンテキスト、キャッシュヒット率、30 日間のトークン、時刻、RAM、OS；ペースマーカーとリセットまでの時間付きの Gemini 5h クォータ、Anthropic（Claude/Sonnet）の 5h クォータ、プロジェクト、git；Gemini 7d クォータとリセット、Anthropic と Argon の週間クォータ",
      ],
      "lines-light": [
        "Lines",
        "明るいターミナルでの light-paper テーマの agy-powerline Lines レイアウト",
      ],
      "classic-dark": [
        "Classic",
        "暗いターミナルでの dark-aurora テーマの agy-powerline Classic レイアウト、ブロックメーター付き",
      ],
    },
    themesEyebrow: "テーマ",
    themesTitle: (n) => `ダーク、ライト、色覚多様性に配慮した ${n} 種類のテーマ`,
    themesLead:
      "テーマのページ（英語）では、すべてのテーマを想定するターミナル背景の上に描画し、色覚のシミュレーションも見られます。",
    seeAllThemes: (n) => `全 ${n} テーマを見る`,
    trustEyebrow: "安心して実行できる",
    trustTitle: "更新のたびに実行されるので、小さく保っています",
    trustBody:
      '実行時の依存パッケージなし、ネットワーク通信なし。設定は自分のインストールフォルダーからのみ読み込むので、クローンしたリポジトリがバーを変えたりコマンドを実行したりすることはできません。<a href="/security/">マシン上で何をするか</a>（英語）。',
    trust: [
      [
        "https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline",
        "OpenSSF Scorecard",
      ],
      ["https://www.npmjs.com/package/agy-powerline", "npm provenance"],
      ["/security/", "依存パッケージ 0"],
      ["/privacy/", "テレメトリなし"],
      ["https://github.com/wassim-azi/agy-powerline/blob/main/LICENSE", "MIT ライセンス"],
    ],
    faqEyebrow: "よくある質問",
    faqTitle: "最初によく聞かれること",
    faq: [
      [
        "Windows で動きますか？",
        'はい。Windows、macOS、Linux、WSL で動作します。Windows では agy がバーを <code>cmd /c</code> 経由で実行し、その設定はインストーラーが行います。WSL では、WSL 内の Linux 版 Node.js でインストールしてください（<a href="/install/#wsl">WSL についての注意</a>、英語）。',
      ],
      [
        "データをどこかに送信しますか？",
        'いいえ。agy-powerline はネットワークリクエストを一切行わず、テレメトリもアナリティクスもありません。問題はローカルのログに記録され、そのログは読むことも、消去することも、無効にすることもできます。<a href="/security/">セキュリティとプライバシー</a>（英語）に、読み書きするすべてのファイルを記載しています。Google Analytics を使うのはこのウェブサイトだけで、訪問数を数えるためです（<a href="/privacy/">プライバシー</a>、英語）。',
      ],
      [
        "agy が遅くなりますか？",
        "Windows 11 のノート PC では、1 回の更新にかかる agy-powerline 自体の処理は約 0.1 秒です。Windows では <code>cmd</code> と Node の起動に約 0.1～0.25 秒が加わりますが、これはどのステータスラインコマンドでも同じです。",
      ],
      [
        "どのクォータを表示しますか？",
        'Google Gemini（Hydrogen、Neon、Carbon、Flash）の 5 時間と 7 日間のクォータ、Anthropic（Claude と Sonnet）の 5 時間と 7 日間のクォータ、Google AI Pro での Gemini 4 Argon の週間クォータを、それぞれのリセット時刻とともに表示します。メーターの見方は<a href="/guides/antigravity-quota/">クォータのガイド</a>（英語）で説明しています。',
      ],
    ],
    allQuestions: "すべての質問（英語）→",
    ctaTitle: "クォータが尽きる前に気づく",
    ctaLead: "コマンドひとつでインストールするか、先にブラウザでバーを作ってみてください。",
    viewOnGithub: "GitHub で見る",
  },
  "zh-CN": {
    lang: "zh-CN",
    title: "Google Antigravity CLI 的 agy 状态栏 - agy-powerline",
    description:
      "agy-powerline 是专为 Google Antigravity CLI（agy）打造的状态栏：展示 Gemini（Hydrogen、Neon、Argon、Carbon、Flash）和 Anthropic（Claude/Sonnet）配额、节奏标记与 Git。",
    imageAlt: "agy-powerline：提前预判配额是否够用的 agy 状态栏及默认外观",
    eyebrow: "Google Antigravity CLI 状态栏",
    heroTitle: '提前看出<span class="grad-text">配额是否够用</span>的 agy 状态栏',
    heroLead:
      "在 agy 输入框下方用一条 powerline 状态栏展示当前模型、上下文窗口、Git 以及带有消耗节奏标记的各项 Antigravity 配额。<strong>一条命令</strong>即可完成配置。",
    copy: "复制",
    copyCommand: "复制：",
    copyInstall: "复制安装命令",
    buildInBrowser: "在浏览器中定制状态栏",
    heroFacts: ["Node.js 20+", "0 依赖", "无遥测", "MIT 许可证"],
    askAgy: "向 agy 提任何问题…",
    heroBarCaption:
      "agy 输入框下方 agy-powerline 的实时预览。切换主题和布局即可查看效果；本页所有状态栏均由真实状态栏代码渲染。",
    demoThemes: "主题",
    demoLayouts: "布局",
    allThemes: (n) => `全部 ${n} 个 →`,
    anatomyEyebrow: "一目了然",
    anatomyTitle: "十秒看懂 agy 状态栏",
    anatomyLead: "默认状态栏分为两行：上方显示当前工作环境，下方显示各项配额剩余情况。",
    anatomy: [
      ["model", "模型", "agy 当前正在使用的模型。"],
      ["context", "上下文窗口", "在 agy 需要压缩对话前，当前上下文已占用的比例。"],
      ["git", "Git", "当前分支、未提交更改，以及领先或落后上游的提交数。"],
      ["fiveHour", "5 小时配额", "Gemini 5 小时配额的剩余量及重置时间。"],
      [
        "pace",
        "消耗节奏标记",
        "标示当前在配额周期中所处的时间进度。若进度条超过该标记，说明消耗速度高于时间流逝速度，会在重置前用尽。",
      ],
      ["weekly", "7 天配额", "每周配额，附带独立的消耗节奏标记与重置时间。"],
    ],
    paceGuide: "了解节奏标记原理（英文）→",
    stepsEyebrow: "快速上手",
    stepsTitle: "一分钟完成部署",
    steps: [
      [
        "安装",
        "需要 Node.js 20 或更新版本以及 Antigravity CLI。修改前会自动备份 agy 的 <code>settings.json</code>，并打开实时预览编辑器。",
        "npx agy-powerline",
      ],
      [
        "挑选外观",
        "安装过程中可带实时预览浏览预设、布局、主题与组件，也可随时重新打开编辑器调整。",
        "npx agy-powerline",
      ],
      [
        "重启一次 agy",
        "状态栏会出现在输入框下方并随 agy 刷新。之后的任何修改都无需再次重启。",
        "agy",
      ],
    ],
    installGuide: "查看安装详情（英文）→",
    featuresEyebrow: "功能特性",
    featuresTitle: "Antigravity CLI 状态栏中你想看的一切信息",
    featuresLead: "基于 Antigravity CLI 真实状态栏数据构建，安全稳定，适合全天运行。",
    features: (n) => [
      [
        "pace",
        "配额节奏与耗尽预测",
        "节奏标记标出 5h 与 7d 周期内的当前位置，耗尽预测估算按当前消耗速度何时会用完。剩余 30% 转为警戒色，10% 转为危险色。",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes} 款主题`,
        "涵盖深色、浅色与色盲友好配色，均经过 WCAG AA 对比度检验，并附带 8 款行渐变和 9 种进度条样式。",
        "/themes/",
      ],
      [
        "layouts",
        "3 种布局与 16 项设置",
        "Pills、Lines 与 Classic 自由编排多行，支持按剩余或已用显示配额、行对齐、最大宽度以及压缩或换行溢出。",
        "/settings/",
      ],
      [
        "widgets",
        `${n.widgets} 个组件`,
        "支持按压缩上限衡量的上下文、带预算提醒的 30 天 token 与花费、智能体状态与任务队列、可点击 git 链接、fish 风格路径、环境变量和 shell 命令。",
        "/widgets/",
      ],
      [
        "configure",
        "自由定制配置",
        "终端交互编辑器支持切换示例场景与终端宽度预览，网页配置器具备完整 Settings 同步能力，也可直接使用预设或带 Schema 的 JSON。",
        "/configure/",
      ],
      [
        "platforms",
        "Windows、macOS、Linux、WSL",
        "基于 Node.js 20+ 本地运行，零运行时依赖、无网络请求、无遥测，支持 7 种状态栏语言。",
        "/install/",
      ],
    ],
    shotsEyebrow: "真实截图",
    shotsTitle: "运行在真实终端中",
    shotsLead: "均截自真实 agy 会话和编辑器，而非设计效果图。",
    shots: {
      editor: [
        "编辑器",
        "终端中的 agy-powerline 编辑器：添加 Argon 重置计时器、预览预设、筛选主题、在 Classic、Pills 和 Lines 之间切换，以及 Settings 选项卡",
      ],
      windows: [
        "agy 会话",
        "Windows Terminal 中位于 agy 输入框下方的 agy-powerline：上方是一段简短对话，下方是三行 Pills 状态栏",
      ],
      "pills-dark": [
        "Pills",
        "agy-powerline 的 Pills 布局，dark-aurora 主题：模型、上下文、缓存命中率、30 天 token、时钟、内存和操作系统；Gemini 5h 配额（带节奏标记和重置时间）、Anthropic（Claude/Sonnet）5h 配额、项目和 git；Gemini 7d 配额和重置时间、Anthropic 和 Argon 每周配额",
      ],
      "lines-light": ["Lines", "浅色终端上搭配 light-paper 主题的 agy-powerline Lines 布局"],
      "classic-dark": [
        "Classic",
        "深色终端上搭配 dark-aurora 主题及方块进度条的 agy-powerline Classic 布局",
      ],
    },
    themesEyebrow: "主题配色",
    themesTitle: (n) => `共 ${n} 款适配深色、浅色及色盲友好终端的主题`,
    themesLead: "主题库页面（英文）在各主题对应的终端背景上直接绘制预览，并提供色觉模拟对比。",
    seeAllThemes: (n) => `查看全部 ${n} 款主题`,
    trustEyebrow: "运行安全",
    trustTitle: "每次刷新都会运行，因此力求极简小巧",
    trustBody:
      '零运行时依赖、无网络请求，且只读取你本机安装目录中的配置：克隆下来的外部仓库无法更改你的状态栏或执行命令。<a href="/security/">了解它在本机上的行为</a>（英文）。',
    trust: [
      [
        "https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline",
        "OpenSSF Scorecard",
      ],
      ["https://www.npmjs.com/package/agy-powerline", "npm provenance"],
      ["/security/", "0 依赖"],
      ["/privacy/", "无遥测"],
      ["https://github.com/wassim-azi/agy-powerline/blob/main/LICENSE", "MIT 许可证"],
    ],
    faqEyebrow: "常见问题",
    faqTitle: "大家最常先问的问题",
    faq: [
      [
        "支持 Windows 吗？",
        '支持 Windows、macOS、Linux 和 WSL。在 Windows 上 agy 通过 <code>cmd /c</code> 运行状态栏，安装程序会自动为你配置好；在 WSL 中请使用 WSL 内的 Linux 版 Node.js 安装（<a href="/install/#wsl">WSL 注意事项</a>，英文）。',
      ],
      [
        "会向外部发送数据吗？",
        '不会。agy-powerline 不发起任何网络请求，也不包含任何遥测或统计代码。异常问题只写入本地日志文件，你可以随时查看、清空或关闭。<a href="/security/">安全与隐私说明</a>（英文）列出了它读写的所有文件。只有本网站本身使用了 Google Analytics 统计访问量（<a href="/privacy/">隐私说明</a>，英文）。',
      ],
      [
        "会拖慢 agy 的响应吗？",
        "在 Windows 11 笔记本上，每次刷新中 agy-powerline 本身仅耗时约 0.1 秒。Windows 下启动 <code>cmd</code> 与 Node 会额外增加约 0.1–0.25 秒，所有外部状态栏命令均如此。",
      ],
      [
        "会显示哪些配额？",
        '涵盖 Google Gemini（Hydrogen、Neon、Carbon、Flash）的 5 小时与 7 天配额、Anthropic（Claude 与 Sonnet）的 5 小时与 7 天配额，以及 Google AI Pro 下 Gemini 4 Argon 的每周配额，每一项都带有重置时间。进度条说明见<a href="/guides/antigravity-quota/">配额指南</a>（英文）。',
      ],
    ],
    allQuestions: "查看全部问题（英文）→",
    ctaTitle: "在配额耗尽前提前掌握余量",
    ctaLead: "一条命令即可安装，也可以先在浏览器里搭好你的状态栏。",
    viewOnGithub: "在 GitHub 上查看",
  },
  ko: {
    lang: "ko",
    title: "Google Antigravity CLI용 agy 상태바 - agy-powerline",
    description:
      "agy-powerline은 Google Antigravity CLI용 상태바입니다. Gemini(Hydrogen, Neon, Argon, Carbon, Flash) 및 Anthropic(Claude/Sonnet) 할당량과 속도 마커, Git을 표시합니다.",
    imageAlt: "agy-powerline: 할당량이 리셋 전까지 남을지 미리 알려주는 agy 상태바와 기본 스타일",
    eyebrow: "Google Antigravity CLI 상태바",
    heroTitle: '리셋 전에 <span class="grad-text">할당량이 남는지</span> 미리 보는 agy 상태바',
    heroLead:
      "agy 입력창 아래의 powerline 상태바에서 모델, 컨텍스트 창, Git, 그리고 소비 속도 마커가 포함된 모든 Antigravity 할당량을 확인하세요. <strong>명령어 하나</strong>로 설치됩니다.",
    copy: "복사",
    copyCommand: "복사:",
    copyInstall: "설치 명령어 복사",
    buildInBrowser: "브라우저에서 직접 꾸미기",
    heroFacts: ["Node.js 20+", "의존성 0개", "텔레메트리 없음", "MIT 라이선스"],
    askAgy: "agy에게 무엇이든 물어보세요…",
    heroBarCaption:
      "agy 입력창 아래에 표시되는 agy-powerline의 실제 모습입니다. 테마와 레이아웃을 바꿔 확인해 보세요. 이 페이지의 모든 상태바는 실제 상태바 코드로 렌더링됩니다.",
    demoThemes: "테마",
    demoLayouts: "레이아웃",
    allThemes: (n) => `전체 ${n}개 →`,
    anatomyEyebrow: "구성 살펴보기",
    anatomyTitle: "10초 만에 읽는 agy 상태바",
    anatomyLead:
      "기본 상태바는 위 줄에 현재 작업 상태를, 아래 줄에 각 할당량의 잔여량을 표시합니다.",
    anatomy: [
      ["model", "모델", "agy가 현재 사용 중인 모델입니다."],
      [
        "context",
        "컨텍스트 창",
        "agy가 대화를 압축하기 전까지 현재 대화가 얼마나 찼는지 보여주는 컨텍스트 사용 비율입니다.",
      ],
      ["git", "Git", "현재 브랜치, 커밋되지 않은 변경 사항, 업스트림과의 앞/뒤 커밋 수입니다."],
      ["fiveHour", "5시간 할당량", "Gemini 5시간 할당량의 잔여량과 리셋 시간입니다."],
      [
        "pace",
        "소비 속도 마커",
        "할당량 주기에서 현재 경과한 시간 위치입니다. 막대가 이 마커를 넘으면 시간보다 빠르게 소비 중이므로 리셋 전에 소진됩니다.",
      ],
      ["weekly", "7일 할당량", "독립적인 소비 속도 마커와 리셋 시간을 갖춘 주간 할당량입니다."],
    ],
    paceGuide: "속도 마커 원리 보기 (영어) →",
    stepsEyebrow: "시작하기",
    stepsTitle: "1분 만에 설치 완료",
    steps: [
      [
        "설치",
        "Node.js 20 이상과 Antigravity CLI가 필요합니다. 변경 전 agy의 <code>settings.json</code>을 백업하고 실시간 미리보기 편집기를 엽니다.",
        "npx agy-powerline",
      ],
      [
        "스타일 고르기",
        "설치 과정이나 언제든 다시 열어 실시간 미리보기를 보며 프리셋, 레이아웃, 테마, 위젯을 선택할 수 있습니다.",
        "npx agy-powerline",
      ],
      [
        "agy 한 번 재시작",
        "입력창 아래에 상태바가 나타나며 agy와 함께 갱신됩니다. 이후 설정 변경에는 재시작이 필요 없습니다.",
        "agy",
      ],
    ],
    installGuide: "설치 가이드 자세히 보기 (영어) →",
    featuresEyebrow: "주요 기능",
    featuresTitle: "Antigravity CLI 상태바에서 보고 싶던 모든 정보",
    featuresLead:
      "Antigravity CLI의 실제 상태바 데이터를 기반으로 하루 종일 가볍고 안전하게 동작합니다.",
    features: (n) => [
      [
        "pace",
        "할당량 속도와 소진 예측",
        "속도 마커로 5시간·7일 주기 내 현재 위치를 보고, 소진 예측으로 지금 속도로 언제 바닥나는지 가늠할 수 있습니다. 잔여 30%에서 주의, 10%에서 경고 색상으로 바뀝니다.",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes}가지 테마`,
        "다크, 라이트, 색각 이상 친화 팔레트를 WCAG AA 대비 기준으로 검증했으며, 8가지 행 그라데이션과 9가지 미터 스타일을 제공합니다.",
        "/themes/",
      ],
      [
        "layouts",
        "3가지 레이아웃과 16가지 설정",
        "Pills, Lines, Classic을 원하는 줄 수로 배치하고, 할당량 남은 양/사용량 표시, 정렬, 최대 너비, 축소 또는 줄바꿈을 설정합니다.",
        "/settings/",
      ],
      [
        "widgets",
        `${n.widgets}가지 위젯`,
        "압축 한도 기준 컨텍스트, 예산 알림이 있는 30일 토큰과 비용, 에이전트 상태·작업·대기열, 클릭 가능한 git 링크, fish 스타일 경로, 환경 변수, 셸 명령어를 지원합니다.",
        "/widgets/",
      ],
      [
        "configure",
        "원하는 대로 커스터마이즈",
        "샘플 시나리오와 터미널 너비를 바꿔 보는 터미널 편집기, 모든 설정을 똑같이 제공하는 브라우저 설정기, 프리셋, JSON 스키마를 지원합니다.",
        "/configure/",
      ],
      [
        "platforms",
        "Windows, macOS, Linux, WSL",
        "Node.js 20+에서 로컬로 동작하며 런타임 의존성, 네트워크 호출, 텔레메트리가 없고 7개 상태바 언어를 지원합니다.",
        "/install/",
      ],
    ],
    shotsEyebrow: "실제 화면",
    shotsTitle: "실제 터미널에서 동작하는 모습",
    shotsLead: "디자인 시안이 아닌 실제 agy 세션과 에디터에서 촬영한 화면입니다.",
    shots: {
      editor: [
        "에디터",
        "터미널에서 실행되는 agy-powerline 에디터: Argon 리셋 타이머 추가, 프리셋 미리보기, 테마 필터, Classic·Pills·Lines 전환, Settings 탭",
      ],
      windows: [
        "agy 세션",
        "Windows Terminal의 agy 입력창 아래 agy-powerline: 위에는 짧은 대화, 아래에는 3줄 Pills 상태바",
      ],
      "pills-dark": [
        "Pills",
        "dark-aurora 테마의 agy-powerline Pills 레이아웃: 모델, 컨텍스트, 캐시 적중률, 30일 토큰, 시계, RAM, OS; 페이스 마커와 리셋 시간이 있는 Gemini 5시간 할당량, Anthropic(Claude/Sonnet) 5시간 할당량, 프로젝트, git; Gemini 7일 할당량과 리셋 시간, Anthropic 및 Argon 주간 할당량",
      ],
      "lines-light": ["Lines", "밝은 터미널 위의 light-paper 테마 agy-powerline Lines 레이아웃"],
      "classic-dark": [
        "Classic",
        "어두운 터미널 위 dark-aurora 테마와 블록 진행 막대를 사용한 agy-powerline Classic 레이아웃",
      ],
    },
    themesEyebrow: "테마",
    themesTitle: (n) => `다크, 라이트, 색각 친화 터미널을 위한 ${n}가지 테마`,
    themesLead:
      "전체 테마 갤러리(영어)에서 각 터미널 배경에 직접 렌더링된 모습과 색각 시뮬레이션을 비교해 보세요.",
    seeAllThemes: (n) => `전체 ${n}개 테마 보기`,
    trustEyebrow: "안전한 설계",
    trustTitle: "매 갱신마다 실행되므로 작고 단순하게",
    trustBody:
      '런타임 의존성도, 네트워크 요청도 없으며 로컬 설치 디렉터리의 설정만 읽습니다. 복제한 외부 저장소가 상태바를 바꾸거나 명령을 실행할 수 없습니다. <a href="/security/">로컬 동작 방식 보기</a> (영어).',
    trust: [
      [
        "https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline",
        "OpenSSF Scorecard",
      ],
      ["https://www.npmjs.com/package/agy-powerline", "npm provenance"],
      ["/security/", "의존성 0개"],
      ["/privacy/", "텔레메트리 없음"],
      ["https://github.com/wassim-azi/agy-powerline/blob/main/LICENSE", "MIT 라이선스"],
    ],
    faqEyebrow: "자주 묻는 질문",
    faqTitle: "사용자들이 가장 먼저 묻는 질문",
    faq: [
      [
        "Windows에서도 동작하나요?",
        '네, Windows, macOS, Linux, WSL을 모두 지원합니다. Windows에서는 agy가 <code>cmd /c</code>를 통해 상태바를 실행하며 설치 프로그램이 이를 자동으로 설정합니다. WSL에서는 WSL 내부의 Linux용 Node.js로 설치하세요 (<a href="/install/#wsl">WSL 안내</a>, 영어).',
      ],
      [
        "외부로 데이터를 전송하나요?",
        '아니요. agy-powerline은 네트워크 요청을 전혀 하지 않으며 텔레메트리나 분석 코드가 없습니다. 오류는 로컬 로그 파일에만 기록되며 언제든 확인하거나 비우고 끌 수 있습니다. 읽고 쓰는 모든 파일 목록은 <a href="/security/">보안 페이지</a> (영어)에서 확인할 수 있습니다. 이 웹사이트 자체만 방문 통계용으로 Google Analytics를 사용합니다 (<a href="/privacy/">개인정보 처리방침</a>, 영어).',
      ],
      [
        "agy가 느려지지는 않나요?",
        "Windows 11 노트북 기준 매 갱신 시 agy-powerline 실행 자체는 약 0.1초 걸립니다. Windows에서는 <code>cmd</code>와 Node 시작에 약 0.1–0.25초가 추가되며 이는 모든 외부 상태바 명령에 동일합니다.",
      ],
      [
        "어떤 할당량이 표시되나요?",
        'Google Gemini(Hydrogen, Neon, Carbon, Flash) 5시간 및 7일 할당량, Anthropic(Claude 및 Sonnet) 5시간 및 7일 할당량, Google AI Pro의 Gemini 4 Argon 주간 할당량을 각각 리셋 시간과 함께 표시합니다. 막대 읽는 법은 <a href="/guides/antigravity-quota/">할당량 가이드</a> (영어)를 참고하세요.',
      ],
    ],
    allQuestions: "모든 질문 보기 (영어) →",
    ctaTitle: "할당량이 바닥나기 전에 미리 확인하세요",
    ctaLead: "명령어 하나로 설치하거나 브라우저에서 나만의 상태바를 구성해 보세요.",
    viewOnGithub: "GitHub에서 보기",
  },
  de: {
    lang: "de",
    title: "agy-Statuszeile für Google Antigravity CLI - agy-powerline",
    description:
      "agy-powerline für Google Antigravity CLI: Gemini (Hydrogen, Neon, Argon, Carbon, Flash) und Anthropic (Claude/Sonnet) Kontingente mit Tempomarkierung.",
    imageAlt:
      "agy-powerline: die agy-Statuszeile, die dir zeigt, ob dein Kontingent bis zum Reset reicht, mit der Standardleiste",
    eyebrow: "Statuszeile für Google Antigravity CLI",
    heroTitle:
      'Die agy-Statuszeile, die dir zeigt, <span class="grad-text">ob dein Kontingent reicht</span>',
    heroLead:
      "Dein Modell, das Kontextfenster, Git und jedes Antigravity-Kontingent mit Tempomarkierung in einer Powerline-Leiste unter dem Eingabefeld von agy. Mit <strong>einem Befehl</strong> eingerichtet.",
    copy: "Kopieren",
    copyCommand: "Kopieren:",
    copyInstall: "Installationsbefehl kopieren",
    buildInBrowser: "Leiste im Browser zusammenstellen",
    heroFacts: ["Node.js 20+", "0 Abhängigkeiten", "Keine Telemetrie", "MIT-Lizenz"],
    askAgy: "Frag agy irgendetwas…",
    heroBarCaption:
      "Eine Live-Vorschau von agy-powerline unter dem Eingabefeld von agy. Wähle ein Theme und ein Layout zum Umschalten; jede Leiste auf dieser Seite wird vom echten Statuszeilen-Code gezeichnet.",
    demoThemes: "Theme",
    demoLayouts: "Layout",
    allThemes: (n) => `Alle ${n} →`,
    anatomyEyebrow: "Auf einen Blick",
    anatomyTitle: "Die agy-Statuszeile in zehn Sekunden lesen",
    anatomyLead:
      "Die Standardleiste hat zwei Zeilen: oben, womit du gerade arbeitest; unten, wie viel Kontingent noch übrig ist.",
    anatomy: [
      ["model", "Modell", "Das Modell, das agy gerade verwendet."],
      [
        "context",
        "Kontextfenster",
        "Wie voll die Unterhaltung ist, bevor agy den Kontext komprimieren muss.",
      ],
      [
        "git",
        "Git",
        "Branch, nicht committete Änderungen sowie Commits vor oder hinter dem Upstream.",
      ],
      [
        "fiveHour",
        "5-Stunden-Kontingent",
        "Was von deinem Gemini-5-Stunden-Kontingent übrig ist und wann es zurückgesetzt wird.",
      ],
      [
        "pace",
        "Tempomarkierung",
        "Wo du dich im Zeitfenster des Kontingents befindest. Reicht der Füllstand über die Markierung hinaus, verbrauchst du das Kontingent schneller als die Zeit vergeht, und es ist vor dem Reset erschöpft.",
      ],
      [
        "weekly",
        "7-Tage-Kontingent",
        "Dein Wochenkontingent mit eigener Tempomarkierung und Reset-Zeit.",
      ],
    ],
    paceGuide: "So funktioniert die Tempomarkierung (auf Englisch) →",
    stepsEyebrow: "Loslegen",
    stepsTitle: "In einer Minute einsatzbereit",
    steps: [
      [
        "Installieren",
        "Benötigt Node.js 20 oder neuer und die Antigravity CLI. Sichert die <code>settings.json</code> von agy vor dem Ändern und öffnet dann den Editor mit Live-Vorschau.",
        "npx agy-powerline",
      ],
      [
        "Stil auswählen",
        "Durchsuche Vorlagen, Layouts, Themes und Widgets mit Live-Vorschau bei der Einrichtung oder öffne den Editor jederzeit erneut.",
        "npx agy-powerline",
      ],
      [
        "agy einmal neu starten",
        "Die Leiste erscheint unter dem Eingabefeld und aktualisiert sich mit agy. Spätere Änderungen sind sofort ohne Neustart sichtbar.",
        "agy",
      ],
    ],
    installGuide: "Details zur Installation (auf Englisch) →",
    featuresEyebrow: "Funktionen",
    featuresTitle: "Alles, was du in der Statusleiste der Antigravity CLI sehen möchtest",
    featuresLead:
      "Für die Antigravity CLI aus ihren echten Statuszeilen-Daten gebaut und sicher den ganzen Tag ausführbar.",
    features: (n) => [
      [
        "pace",
        "Kontingent-Tempo und Prognosen",
        "Tempomarkierungen zeigen deinen Stand im 5h- oder 7T-Fenster, und Verbrauchsprognosen schätzen, wann das Kontingent bei deinem Tempo erschöpft ist. Warnung bei 30 %, kritisch bei 10 %.",
        "/guides/antigravity-quota/",
      ],
      [
        "themes",
        `${n.themes} Themes`,
        "Dunkle, helle und farbenblindfreundliche Paletten mit WCAG-AA-Kontrastprüfung, plus 8 Zeilenverläufe und 9 Meter-Stile.",
        "/themes/",
      ],
      [
        "layouts",
        "3 Layouts und 16 Einstellungen",
        "Pills, Lines und Classic auf beliebig vielen Zeilen, mit Anzeige als Rest oder Verbrauch, Ausrichtung, maximaler Breite und Fit- oder Wrap-Überlauf.",
        "/settings/",
      ],
      [
        "widgets",
        `${n.widgets} Widgets`,
        "Kontext mit Komprimierungslimit, 30-Tage-Tokens und Kosten mit Budgetwarnungen, Agentenstatus, Aufgaben und Warteschlange, klickbare Git-Links, Fish-Pfade, Umgebungsvariablen und Shell-Befehle.",
        "/widgets/",
      ],
      [
        "configure",
        "Konfiguriere auf deine Weise",
        "Ein Terminal-Editor mit Beispielszenarien und Terminalbreiten-Vorschau, ein Browser-Konfigurator mit vollem Settings-Umfang, Vorlagen oder JSON mit Schema.",
        "/configure/",
      ],
      [
        "platforms",
        "Windows, macOS, Linux, WSL",
        "Läuft lokal mit Node.js 20+, null Laufzeitabhängigkeiten, ohne Netzwerkaufrufe und Telemetrie, in 7 Sprachen für die Leiste.",
        "/install/",
      ],
    ],
    shotsEyebrow: "Echte Screenshots",
    shotsTitle: "In einem echten Terminal",
    shotsLead: "In echten agy-Sitzungen und im Editor aufgenommen, keine Mock-ups.",
    shots: {
      editor: [
        "Editor",
        "Der agy-powerline-Editor im Terminal: Argons Reset-Timer hinzufügen, Presets ansehen, Themes filtern, zwischen Classic, Pills und Lines wechseln und der Settings-Tab",
      ],
      windows: [
        "agy-Sitzung",
        "agy-powerline unter dem Eingabefeld von agy in Windows Terminal: oben ein kurzes Gespräch, darunter die dreizeilige Pills-Leiste",
      ],
      "pills-dark": [
        "Pills",
        "agy-powerline Pills-Layout mit dem Theme dark-aurora: Modell, Kontext, Cache-Trefferquote, Tokens der letzten 30 Tage, Uhrzeit, RAM und Betriebssystem; Gemini-5h-Kontingent mit Tempomarkierung und Reset, Anthropic-5h-Kontingent (Claude/Sonnet), Projekt und Git; Gemini-7T-Kontingent mit Reset, wöchentliche Anthropic- und Argon-Kontingente",
      ],
      "lines-light": [
        "Lines",
        "agy-powerline Lines-Layout mit dem Theme light-paper auf einem hellen Terminal",
      ],
      "classic-dark": [
        "Classic",
        "agy-powerline Classic-Layout mit dem Theme dark-aurora auf einem dunklen Terminal mit Blockanzeigen",
      ],
    },
    themesEyebrow: "Themes",
    themesTitle: (n) => `${n} Themes für dunkle, helle und farbenblindfreundliche Terminals`,
    themesLead:
      "Jedes Theme wird auf der Themes-Seite (auf Englisch) auf seinem vorgesehenen Terminal-Hintergrund mit einer Farbseh-Simulation dargestellt.",
    seeAllThemes: (n) => `Alle ${n} Themes ansehen`,
    trustEyebrow: "Sicher ausführbar",
    trustTitle: "Läuft bei jeder Aktualisierung – deshalb bleibt es schlank",
    trustBody:
      'Keine Laufzeitabhängigkeiten, keine Netzwerkaufrufe und eine Konfiguration, die nur aus deinem eigenen Installationsordner gelesen wird: Ein geklontes Repository kann weder deine Leiste ändern noch Befehle ausführen. <a href="/security/">Was auf deinem Rechner passiert</a> (auf Englisch).',
    trust: [
      [
        "https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline",
        "OpenSSF Scorecard",
      ],
      ["https://www.npmjs.com/package/agy-powerline", "npm-Provenance"],
      ["/security/", "0 Abhängigkeiten"],
      ["/privacy/", "Keine Telemetrie"],
      ["https://github.com/wassim-azi/agy-powerline/blob/main/LICENSE", "MIT-Lizenz"],
    ],
    faqEyebrow: "FAQ",
    faqTitle: "Häufig gestellte Fragen",
    faq: [
      [
        "Funktioniert es unter Windows?",
        'Ja: Windows, macOS, Linux und WSL. Unter Windows führt agy die Leiste über <code>cmd /c</code> aus, was das Installationsprogramm automatisch einrichtet. Für WSL installiere es mit einem Linux-Node.js innerhalb von WSL (<a href="/install/#wsl">WSL-Hinweise</a>, auf Englisch).',
      ],
      [
        "Sendet es irgendwelche Daten nach außen?",
        'Nein. agy-powerline führt keine Netzwerkanfragen durch und enthält weder Telemetrie noch Analytics. Probleme werden in ein lokales Log geschrieben, das du lesen, leeren oder deaktivieren kannst. <a href="/security/">Sicherheit &amp; Datenschutz</a> (auf Englisch) listet jede gelesene und geschriebene Datei auf. Nur diese Website nutzt Google Analytics zum Zählen von Besuchen (<a href="/privacy/">Datenschutz</a>, auf Englisch).',
      ],
      [
        "Macht es agy langsamer?",
        "Eine Aktualisierung benötigt auf einem Windows-11-Laptop etwa 0,1 s eigener Arbeit von agy-powerline. Unter Windows kommen für den Start von <code>cmd</code> und Node etwa 0,1–0,25 s hinzu, wie bei jedem Statuszeilen-Befehl.",
      ],
      [
        "Welche Kontingente werden angezeigt?",
        'Die 5-Stunden- und 7-Tage-Kontingente von Google Gemini (Hydrogen, Neon, Carbon, Flash), die 5-Stunden- und 7-Tage-Kontingente von Anthropic (Claude und Sonnet) sowie das Wochenkontingent von Gemini 4 Argon in Google AI Pro, jeweils mit Reset-Zeit. Der <a href="/guides/antigravity-quota/">Kontingent-Guide</a> (auf Englisch) erklärt die Anzeigen.',
      ],
    ],
    allQuestions: "Alle Fragen (auf Englisch) →",
    ctaTitle: "Wisse Bescheid, bevor dein Kontingent aufgebraucht ist",
    ctaLead: "Installiere die Leiste mit einem Befehl oder stelle sie zuerst im Browser zusammen.",
    viewOnGithub: "Auf GitHub ansehen",
  },
};

module.exports = { HOME_TEXT };
