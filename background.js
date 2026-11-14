// Deletes history (not cookies) for listed sites. Every visit to a listed site is
// recorded as it happens and deleted at the next tab close; a full scan runs at
// browser start, on "Delete now" and when a site is added.
// Chrome itself drops the matching "Recently closed" entries and address-bar shortcuts
// when a URL is deleted, and with history sync on, deleteUrl also deletes server-side.

const SEARCH_HOSTS = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/;

// Every page load in every tab wakes this worker, so settings are read from storage
// once per wake and an unrelated visit costs a string compare, not a storage read.
let cached = null;
async function getSettings() {
  if (!cached) {
    const { sites, incognitoSites } = await chrome.storage.sync.get(['sites', 'incognitoSites']);
    cached = {
      sites: Array.isArray(sites) ? sites : [],
      incognitoSites: Array.isArray(incognitoSites) ? incognitoSites : [],
    };
  }
  return cached;
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function matchHost(host, sites) {
  for (const site of sites) {
    if (host === site || host.endsWith('.' + site)) return site;
  }
  return null;
}

function matchSite(url, sites) {
  const host = hostOf(url);
  if (!host) return null;
  const direct = matchHost(host, sites);
  if (direct) return direct;
  // A search for the site's name ("example login") counts as history about it.
  if (SEARCH_HOSTS.test(host)) {
    const lower = url.toLowerCase();
    for (const site of sites) {
      if (lower.includes(site.split('.')[0])) return site;
    }
  }
  return null;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// history.search never returns a page that redirected elsewhere (a visit without the
// chain-end flag), so every matching visit is recorded here as it happens and kept
// until deleted. Local storage, so a crash or quit doesn't lose them.
async function getPending() {
  return (await chrome.storage.local.get('pending')).pending || {};
}

// A redirect chain fires several visits at once; without a queue their
// read-modify-write of `pending` overwrites each other.
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

chrome.history.onVisited.addListener(async (item) => {
  const { sites } = await getSettings();
  const site = sites.length ? matchSite(item.url, sites) : null;
  if (!site) return;
  await serial(async () => {
    const pending = await getPending();
    const urls = pending[site] || [];
    if (urls.includes(item.url)) return;
    pending[site] = [...urls, item.url];
    await chrome.storage.local.set({ pending });
  });
});

// `scan` adds a pass over all history (about 0.6 s on 9,000 pages), needed for visits
// made before a site was listed or synced from another device. A tab close skips it.
function scrub(sites, scan) {
  return serial(() => scrubNow(sites, scan));
}

async function scrubNow(sites, scan) {
  const result = Object.fromEntries(sites.map((s) => [s, { history: 0, downloads: 0 }]));
  if (!sites.length) return result;
  const pending = await getPending();
  const targets = new Map(); // url -> [site, known to be in history]
  for (const site of sites) for (const url of pending[site] || []) targets.set(url, [site, false]);
  if (scan) {
    for (const item of await chrome.history.search({ text: '', startTime: 0, maxResults: 0 })) {
      const site = matchSite(item.url, sites);
      if (site) targets.set(item.url, [site, true]);
    }
  }
  for (const [url, [site, known]] of targets) {
    if (known || (await chrome.history.getVisits({ url })).length) result[site].history++;
    await chrome.history.deleteUrl({ url });
  }
  // Download-list entries only; the downloaded files stay on disk.
  const pattern = `^[a-z]+://([^/]*\\.)?(${sites.map(escapeRegex).join('|')})([:/?#]|$)`;
  const erased = new Map();
  for (const query of [{ urlRegex: pattern }, { finalUrlRegex: pattern }]) {
    const before = await chrome.downloads.search(query);
    await chrome.downloads.erase(query);
    for (const d of before) erased.set(d.id, matchHost(hostOf(d.finalUrl || d.url), sites) || matchHost(hostOf(d.url), sites));
  }
  for (const site of erased.values()) if (site) result[site].downloads++;
  if (targets.size || Object.keys(pending).some((s) => sites.includes(s))) {
    for (const site of sites) delete pending[site];
    await chrome.storage.local.set({ pending });
  }
  return result;
}

async function scrubAll() {
  const result = await scrub((await getSettings()).sites, true);
  await chrome.storage.local.set({ lastSweep: { at: new Date().toISOString(), result } });
  return result;
}

// Any tab close deletes what was recorded so far, so no per-tab bookkeeping runs on
// every page load. A listed site still open in another tab loses its history early,
// which is the point of listing it.
chrome.tabs.onRemoved.addListener(async () => {
  const pending = await getPending();
  const sites = Object.keys(pending).filter((s) => pending[s].length);
  if (sites.length) await scrub(sites, false);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !(changes.sites || changes.incognitoSites)) return;
  cached = null;
  if (!changes.sites) return;
  const before = changes.sites.oldValue || [];
  const after = changes.sites.newValue || [];
  // A newly listed site loses the history it already has right away.
  const added = after.filter((s) => !before.includes(s));
  if (added.length) scrub(added, true);
  // A site taken off the list keeps its history, recorded visits included.
  const removed = before.filter((s) => !after.includes(s));
  if (removed.length) {
    serial(async () => {
      const pending = await getPending();
      if (!removed.some((s) => s in pending)) return;
      for (const s of removed) delete pending[s];
      await chrome.storage.local.set({ pending });
    });
  }
});

// Sites set to open in incognito are moved before the page commits, so no visit is written.
// The extension is not allowed in incognito, so it never sees the new window and can't loop.
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const { incognitoSites } = await getSettings();
  if (!incognitoSites.length || !matchHost(hostOf(details.url), incognitoSites)) return;
  let tab;
  try { tab = await chrome.tabs.get(details.tabId); } catch { return; } // prerender or already gone
  if (tab.incognito) return;
  await chrome.windows.create({ url: details.url, incognito: true });
  const committed = tab.url || '';
  const blank = !committed || committed === details.url || /^(chrome|about|edge):/.test(committed);
  if (blank) await chrome.tabs.remove(tab.id);
  else await chrome.tabs.update(tab.id, { url: committed }); // cancel the navigation, stay put
}, { url: [{ schemes: ['http', 'https'] }] });

chrome.runtime.onStartup.addListener(scrubAll);
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg === 'scrubAll') { scrubAll().then(reply); return true; }
});
