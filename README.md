# History scrubber

A Chrome extension that keeps the sites you choose out of your browser history, without logging you out of them. You list the sites. Their history is deleted and their cookies stay.

## What gets deleted

- Every page you visited on a listed site, subdomains included, and the redirect pages in between.
- Searches on Google, Bing, DuckDuckGo or Yahoo that contain the site's name.
- The site's entries in the downloads list. The downloaded files stay on disk.
- With Chrome history sync on, your Google account's copy of that history too.

Chrome also drops the matching "Recently closed" entries and address-bar shortcuts by itself once the pages are gone.

## What stays

- Cookies, so you stay logged in.
- Downloaded files.
- Bookmarks and saved passwords.

## When it runs

- When you add a site, the history it already has is deleted right away.
- After that, each visit is deleted the next time you close a tab.
- Every time Chrome starts, a full sweep catches anything left behind by a crash.
- "Delete history now" in the toolbar popup runs that full sweep on demand.

Each site can also be set to open in an incognito window instead, so no history is written at all. You are logged out there, because incognito has its own cookies.

## Proof, and the places it can't reach

- **Every run is checked.** Right after deleting, each page is looked up again. Settings keeps the last 10 runs with how many pages they deleted and "Checked again: 0 left", or how many could not be deleted. The log holds counts only, never site names, so a glance at the popup doesn't show which site you visited.
- **Address bar.** A bookmark of a listed site keeps it in address-bar suggestions. Settings lists any such bookmark and changes nothing.
- **Google account.** With Web & App Activity on, Google keeps its own record of your visits, which no extension can reach. Settings has a button per site that copies its name and opens Google My Activity, where you paste it into the search box.
- **Panic shortcut.** One key combination closes every tab on a listed site and deletes their history at once. No key is set by default; pick one at `chrome://extensions/shortcuts`.

## Why another history extension

In November 2026 I read the code of five Chrome Web Store extensions that delete history by site. All five find pages with `chrome.history.search`. That call never returns a page that redirected somewhere else, so login redirects and tracking hops stay in your history. In my own profile that was 3,126 of 12,452 pages.

History scrubber records every visit to a listed site as it happens, through `chrome.history.onVisited`, and deletes those pages too.

## Privacy

- It reads your browsing history, because that is how it finds what to delete. Nothing leaves your computer: no server, no analytics, no network requests. The fonts are bundled.
- Your site list stays on this computer (`chrome.storage.local`). It never syncs to your Google account, so it won't follow you to another computer either.
- Site icons come from Chrome's local icon store, not the network. Chrome deletes a site's icon along with its history, so the extension keeps a copy of each listed site's icon in its local storage, and drops it when you take the site off the list.
- There is no build step and no dependency. What you read in this repo is what runs.

## Install

It is not on the Chrome Web Store.

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on Developer mode.
3. Click "Load unpacked" and pick the folder.
4. Add your sites on the welcome page that opens, then pin the toolbar button.

Tested in Chrome 157 on macOS.

## Permissions

| Permission | Used for |
|---|---|
| `history` | Finding and deleting pages |
| `tabs` | Showing the current tab's site in the popup, and the incognito option |
| `storage` | Your site list, the visits waiting to be deleted, saved icons and the last 10 runs |
| `downloads` | Erasing download-list entries |
| `webNavigation` | The per-site incognito option |
| `favicon` | Showing each site's icon, read from Chrome's own icon store |
| `bookmarks` | Listing bookmarks that point at your sites. Read only |

## Cost to your machine

- The background worker sleeps between events. It reads your list once each time it wakes, so a page load on a site that isn't listed costs a string comparison and nothing else.
- A full sweep takes about half a second on 9,000 history entries. A tab close only deletes the visits already recorded, so it doesn't scan.
- The popup is ready about 50 ms after you click.
- The whole extension is 86 KB, fonts included.

## Limits

- Google's Web & App Activity (myactivity.google.com) is separate from Chrome history, and this extension doesn't touch it.
- A link to an incognito-listed site, clicked from a normal page, reloads that page, and each such link opens its own incognito window.
- The extension is not allowed in incognito on purpose: incognito writes no history, and the incognito option relies on the extension not seeing that window.

## License

MIT, see [LICENSE](LICENSE). The bundled fonts, Newsreader and Noto Sans, are under the SIL Open Font License 1.1, see [fonts/OFL.txt](fonts/OFL.txt).
