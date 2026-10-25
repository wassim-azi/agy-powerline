# Privacy

This site collects nothing about you, and neither does agy-powerline itself.

## This website

- **No cookies, no analytics, no tracking.** The site has no analytics script and sets no cookies.
- **Nothing loads from other sites.** Every page carries its own scripts and uses the site's own stylesheet, and a Content Security Policy stops it from loading anything from another domain: no web fonts, no images, no scripts from elsewhere. Links to GitHub and npm open those sites only when you click them.
- **One setting in your browser, if you choose one.** When you press System, Light or Dark at the top of a page, your browser stores that choice under `agy-powerline-theme` (local storage), so the next page opens the same way. It never leaves your browser. Clear it with your browser's site data.
- **The configurator works in your browser.** The bar you build, and a config you paste or load, stay on the page. A share link keeps your config after the `#` in the address, a part browsers never send to a server. Downloading the config writes a file on your computer and sends nothing.
- **The quota calculator** works in your browser too, and stores nothing.

The site is hosted on GitHub Pages. Like any web host, GitHub receives the usual request details (such as your IP address) when you open a page, under the [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). agy-powerline doesn't receive or read them.

## The status line and the CLI

agy-powerline makes no network requests and has no telemetry. It reads the session data agy sends it, its own config and your project's `.git` folder, and keeps a local problem log that you can read, clear or turn off. It never prints, logs or saves your email or session and conversation IDs. The [Security](../../../SECURITY.md) page lists every file it reads and writes and every process it starts.

## Questions

Ask in [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues).
