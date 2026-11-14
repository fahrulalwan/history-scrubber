# CLAUDE.md

A Chrome MV3 extension with no build step and no dependencies: the files here are what Chrome loads.

- Solo repo: conventional commits straight to `main`, no attribution. Push only on the owner's word.
- The owner's Chrome loads this folder unpacked. After a change, bump `version` in `manifest.json` and reload the extension (chrome-devtools MCP `reload_extension`), then test in Chrome: history left behind, console errors, popup timing.
- Keep it light: no storage reads on events for sites that aren't listed, no full history scan on tab close, nothing that keeps the service worker awake.
- No network calls of any kind. Fonts stay bundled and subset (`fonts/OFL.txt` lists the changes).
- Never commit a real site list or anyone's browsing data; tests use httpbin.org or example.org.
- A listed site's name appears only where the user manages the list (Settings, and the popup's card for the site that tab is on). Logs, results and status lines carry counts, never names: a name next to a page count tells anyone glancing at the screen which site was visited.
- Design notes, test history and Chrome API findings live in the owner's vault note for this extension, not here.
