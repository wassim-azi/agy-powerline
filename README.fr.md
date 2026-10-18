# agy-powerline

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | **Français**

[![CI](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml/badge.svg)](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml)
[![Version](https://img.shields.io/npm/v/agy-powerline.svg)](https://www.npmjs.com/package/agy-powerline)
[![Downloads](https://img.shields.io/npm/dt/agy-powerline.svg)](https://www.npmjs.com/package/agy-powerline)
[![Node](https://img.shields.io/badge/node-%3E%3D20-informational.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational.svg)](docs/install.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#confidentialité-et-sécurité)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/wassim-azi/agy-powerline/badge)](https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline)
[![Mentioned in Awesome Gemini CLI](https://img.shields.io/badge/mentioned%20in-awesome-fc60a8.svg?logo=awesomelists&logoColor=white)](https://github.com/Piebald-AI/awesome-gemini-cli)

> > **Remarque :** cette traduction peut ne pas être à jour. En cas de divergence, la [version anglaise](README.md) fait foi. La documentation détaillée ([`docs/`](docs/)) n’existe qu’en anglais.

**Une barre d’état rapide et configurable pour la CLI de Google Antigravity (`agy`).**

Consultez d’un coup d’œil le modèle utilisé, les quotas Gemini sur 5h/7d, ceux de Claude/GPT et d’Argon, la fenêtre de contexte, la branche Git et bien plus encore. Choisissez les widgets, les thèmes et la disposition dans un éditeur interactif. Une seule commande suffit pour l’installation, sans aucune dépendance.

<p align="center">
  <img src="assets/screenshots/pills-dark.png" alt="Disposition Pills d’agy-powerline avec le thème dark-ocean : état de l’agent, modèle, plan, projet et Git ; contexte ; quotas sur 5h et 7d avec leurs réinitialisations" width="850">
</p>

## Installation

Vous avez besoin de [Node.js](https://nodejs.org/) 20 ou d’une version ultérieure, ainsi que de l’[interface en ligne de commande Antigravity](https://antigravity.google/docs/cli/overview). Compatible avec Windows, macOS, Linux et WSL ([remarques sur WSL](docs/install.md#wsl)).

```bash
npx agy-powerline init        # install the statusline into agy
npx agy-powerline configure   # optional: pick widgets, theme and layout
agy                           # start Antigravity
```

Avant de remplacer quoi que ce soit, `init` demande confirmation et sauvegarde le fichier `settings.json` d’Antigravity. Redémarrez `agy` une fois après l’exécution de `init`. Pour en savoir plus, consultez [le fonctionnement de `init`](docs/install.md).

Vous pouvez aussi laisser agy effectuer l’installation : collez cette instruction dans une session `agy`.

```text
Install the agy-powerline statusline: run `npx agy-powerline init --yes`, then tell me to restart agy.
```

L’option `--yes` évite les questions auxquelles agy ne peut pas répondre et remplace toute configuration `statusLine` existante, après sauvegarde de `settings.json`.

Pour un terminal sans police Nerd Font, activez le mode ASCII (touche `i` dans `configure`).

## Personnalisation

`npx agy-powerline configure` ouvre un éditeur qui affiche un aperçu en temps réel de votre barre d’état. Utilisez `←` et `→` pour passer d’un onglet à l’autre (Widgets, Presets, Themes, Layout, Powerline) ; `↑` et `↓` pour vous déplacer ; Entrée pour sélectionner ; et `q` pour enregistrer et quitter. Les touches disponibles sont affichées en bas de chaque écran. La liste complète figure dans la [documentation de configuration](docs/configuration.md#configurator-keys).

Les modifications s’appliquent à une session `agy` en cours lors de l’actualisation suivante.

### Préréglages

Choisissez un préréglage comme point de départ, puis personnalisez-le :

| Préréglage  | Informations affichées                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `default`   | Modèle, contexte et Git ; quotas sur 5h et 7d avec leurs réinitialisations sur une deuxième ligne         |
| `compact`   | Une seule ligne : nom abrégé du modèle, quota le plus proche de sa limite, pourcentage du contexte et Git |
| `workspace` | Projet, Git, état de l’agent et modèle ; contexte, quota le plus proche de sa limite et mode              |
| `limits`    | Tous les quotas (5h, 7d, modèles tiers, Argon), un par ligne                                              |
| `full`      | Toutes les informations : session, projet et Git ; contexte, tokens et cache ; les deux quotas            |

### Thèmes

| Fond du terminal        | Thèmes                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sombre                  | `dark-aurora` (par défaut), `dark-ocean`, `dark-ember`, `dark-forest`, `dark-neon`, `dark-mono`, `dark-nocturne`, `dark-onyx`, `dark-metro`, `dark-macchiato` |
| Clair                   | `light-paper`, `light-sky`, `light-sunset`, `light-cream`                                                                                                     |
| Adapté au daltonisme    | `colorblind-dark`, `colorblind-light`                                                                                                                         |
| Couleurs personnalisées | `custom` ([mode d’emploi](docs/configuration.md#custom-theme))                                                                                                |

Prévisualisez tous les thèmes avec `npx agy-powerline theme --gallery`.

### Dispositions

**Pills** (par défaut) : capsules de style powerline. Choisissez des formes arrondies, anguleuses, inclinées ou plates, et ajoutez éventuellement une ligne vide entre les lignes de la barre.

<p align="center">
  <img src="assets/screenshots/pills-light.png" alt="Disposition Pills d’agy-powerline avec le thème light-sky sur un terminal clair et un espace entre les lignes" width="850">
</p>

**Lines** : les mêmes informations sous forme de texte coloré classique.

<p align="center">
  <img src="assets/screenshots/lines-dark.png" alt="Disposition Lines d’agy-powerline avec le thème dark-ocean sur un terminal sombre" width="850">
  <img src="assets/screenshots/lines-light.png" alt="Disposition Lines d’agy-powerline avec le thème light-sky sur un terminal clair" width="850">
</p>

## Widgets

| Widget                                                  | Informations affichées                                                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `model`                                                 | Modèle utilisé                                                                                                       |
| `fiveHourBar`, `weeklyBar`                              | Quota restant sur 5h/7d sous forme de jauge, avec un [indicateur de rythme](docs/configuration.md#quota-pace-marker) |
| `fiveHourPct`, `weeklyPct`                              | Pourcentage de quota restant sur 5h/7d                                                                               |
| `fiveHourReset`, `weeklyReset`                          | Temps restant avant la réinitialisation du quota, ou heure de réinitialisation                                       |
| `quota`                                                 | Quota le plus proche de sa limite, avec son heure de réinitialisation                                                |
| `thirdPartyFiveHour`, `thirdPartyWeekly`                | Quotas des modèles tiers                                                                                             |
| `argonWeekly`, `argonReset`                             | Quota hebdomadaire propre à Gemini 4 Argon (Google AI Pro) et sa réinitialisation                                    |
| `context`, `contextPct`, `contextTokens`                | Fenêtre de contexte utilisée : jauge, pourcentage ou nombre de tokens                                                |
| `git`                                                   | Branche, modifications non validées et commits en avance ou en retard                                                |
| `project`, `cwd`                                        | Dossier du projet et dossier courant                                                                                 |
| `agentState`, `plan`, `sandbox`, `artifacts`, `version` | Activité de l’agent, abonnement Antigravity, bac à sable, artefacts et version de la CLI                             |
| `tasks`                                                 | Sous-agents actifs et tâches en arrière-plan                                                                         |
| `mode`                                                  | Mode d’approbation (par exemple `accept-edits`) et mode Vim                                                          |
| `title`                                                 | Titre de la conversation                                                                                             |
| `totalTokens`, `cacheHit`, `cacheRead`, `cacheCreate`   | Tokens de la session et utilisation du cache des prompts                                                             |
| `ram`                                                   | Mémoire utilisée sur votre machine                                                                                   |
| `customText`, `exec`                                    | Texte personnalisé ou résultat d’une [commande shell](docs/configuration.md#shell-command-widget-exec)               |

Un widget qui n’a rien à afficher se masque automatiquement. Vous pouvez personnaliser sa couleur, masquer son libellé ou définir ses propres seuils d’alerte : consultez la [documentation de configuration](docs/configuration.md).

## Commandes

| Commande                                  | Fonction                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `npx agy-powerline init [--yes]`          | Installer ou mettre à jour la barre d’état                             |
| `npx agy-powerline configure`             | Ouvrir l’éditeur (alias `config`)                                      |
| `npx agy-powerline preset <name>`         | Appliquer un préréglage (`--list` pour afficher la liste)              |
| `npx agy-powerline theme <name>`          | Changer de thème (`--list`, `--gallery`)                               |
| `npx agy-powerline gradient <name>`       | Color each row with a gradient (`--list`, `off`)                       |
| `npx agy-powerline layout <pills\|lines>` | Changer de disposition                                                 |
| `npx agy-powerline caps <style>`          | Changer la forme des capsules : `round`, `angled`, `slanted`, `flat`   |
| `npx agy-powerline doctor`                | Vérifier l’installation et expliquer les éventuels problèmes           |
| `npx agy-powerline report`                | Générer un rapport de bogue respectueux de la vie privée               |
| `npx agy-powerline uninstall [--delete]`  | Retirer la barre d’état d’agy (`--delete` supprime aussi ses fichiers) |
| `npx agy-powerline render --demo`         | Afficher la barre avec des données d’exemple                           |

Utilisez l’option `--help` avec n’importe quelle commande pour afficher les options disponibles.

## Mise à jour

```bash
npx agy-powerline init --yes   # install the new version's scripts
npx agy-powerline doctor       # check everything is up to date
```

Vos paramètres sont conservés. Redémarrez ensuite `agy`.

## Dépannage

Commencez par exécuter `npx agy-powerline doctor` : cette commande vérifie l’installation et explique comment corriger les problèmes détectés. Retrouvez les problèmes courants et la procédure pour signaler un bogue dans le [guide de dépannage](docs/troubleshooting.md).

## Confidentialité et sécurité

- **Aucun appel réseau, aucune télémétrie.** Toutes les informations proviennent des données transmises par agy à la barre d’état, de `.git` et de votre système d’exploitation. Le seul lien externe est accessible avec la touche `g` dans `configure`, qui ouvre la page GitHub dans votre navigateur.
- **Vos paramètres sont protégés.** `init` et `uninstall` sauvegardent `settings.json` et refusent de modifier un fichier qu’ils ne parviennent pas à analyser.
- **Rien ne s’exécute sans que vous l’ayez ajouté.** À l’exception d’une brève commande `git` pour compter les commits en avance ou en retard, les seules commandes exécutées par la barre sont celles des widgets `exec` que vous configurez vous-même.
- **Aucune dépendance à l’exécution**, avec une publication depuis la CI et une [attestation de provenance npm](https://docs.npmjs.com/generating-provenance-statements).

Pour plus de détails, consultez [SECURITY.md](SECURITY.md).

## Contribution

Les contributions sont les bienvenues. Commencez par lire [CONTRIBUTING.md](CONTRIBUTING.md) (installation de l’environnement de développement, architecture, ajout d’un widget ou d’un thème) et le [Code de conduite](CODE_OF_CONDUCT.md). Ouvrez vos pull requests vers la branche `develop`. Signalez les bogues dans les [issues GitHub](https://github.com/wassim-azi/agy-powerline/issues) ou partagez vos idées et commentaires dans les [discussions](https://github.com/wassim-azi/agy-powerline/discussions).

Merci à toutes les personnes ayant contribué au projet :

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

Si agy-powerline vous est utile, une ⭐ permet à d’autres utilisateurs d’agy de le découvrir.

## Licence

[MIT](LICENSE) © Wassim AZI
