# Privacy

This website uses Google Analytics to count visits. agy-powerline itself, the status line and the CLI, has no analytics and collects nothing about you.

## This website

- **Google Analytics, on this website only.** Every page of agy-powerline.com loads Google Analytics 4 (Google's `gtag.js`) when you open it. It sets Google Analytics cookies and sends Google the page you view, the page you came from, your browser, device, screen size, language and approximate location, so we can see how many people visit and which pages they read. Google handles this data under the [Google Privacy Policy](https://policies.google.com/privacy). The status line and the CLI never load it.
- **Nothing else loads from other sites.** Apart from Google Analytics, every page carries its own scripts and uses the site's own stylesheet, and a Content Security Policy stops it from loading anything from any other domain: no web fonts, no images, no other scripts from elsewhere. Links to GitHub and npm open those sites only when you click them.
- **One setting in your browser, if you choose one.** When you press System, Light or Dark at the top of a page, your browser stores that choice under `agy-powerline-theme` (local storage), so the next page opens the same way. It never leaves your browser. Clear it with your browser's site data.
- **The configurator works in your browser.** The bar you build, and a config you paste or load, stay on the page. A share link keeps your config after the `#` in the address, a part browsers never send to a server. Downloading the config writes a file on your computer and sends nothing.
- **The quota calculator** works in your browser too, and stores nothing.

The site is hosted on GitHub Pages. Like any web host, GitHub receives the usual request details (such as your IP address) when you open a page, under the [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). agy-powerline doesn't receive or read them.

## The status line and the CLI

agy-powerline makes no network requests and has no telemetry or analytics: Google Analytics is only on this website. It reads the session data agy sends it, its own config and your project's `.git` folder, and keeps a local problem log that you can read, clear or turn off. It never prints, logs or saves your email or session and conversation IDs. The [Security](../../../SECURITY.md) page lists every file it reads and writes and every process it starts.

## Questions

Ask in [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues).
