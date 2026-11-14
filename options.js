const $ = (id) => document.getElementById(id);

let savedAt = null;
function flashSaved() {
  savedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function update(change) {
  const s = await loadSettings();
  change(s);
  await saveSettings(s);
  flashSaved();
  render();
}

async function render() {
  const [s, icons] = await Promise.all([loadSettings(), loadIcons()]);
  const list = $('list');
  list.replaceChildren();
  $('saved').textContent = plural(s.sites.length, 'site') + (savedAt ? ` · saved ${savedAt}` : '');
  if (!s.sites.length) {
    list.append(el('div', { class: 'empty' }, 'No sites yet. Add the first one above; nothing is deleted until you do.'));
  }
  for (const site of s.sites) {
    list.append(el('div', { class: 'srow' },
      favEl(site, icons[site]),
      el('div', { class: 'domain' }, site),
      el('div', { class: 'inc' }, 'Incognito',
        makeSwitch(`Always open ${site} in incognito`, s.incognitoSites.includes(site), (on) =>
          update((x) => { x.incognitoSites = on ? [...x.incognitoSites, site] : x.incognitoSites.filter((y) => y !== site); }))),
      el('button', { class: 'remove', 'aria-label': `Remove ${site}`, title: `Remove ${site}`,
        onclick: () => update((x) => { x.sites = x.sites.filter((y) => y !== site); }) }, '×')));
  }
  $('sweep').textContent = await lastSweepSentence();
  renderSweeps();
  renderBookmarks(s.sites);
  renderGoogle(s.sites);
  renderPanic();
}

async function renderSweeps() {
  const sweeps = await loadSweeps();
  $('sweeps').replaceChildren(...(sweeps.length ? sweeps.map((w) => {
    const bad = Object.values(w.result || {}).some((r) => r.left);
    const left = describeLeft(w.result);
    return el('div', { class: 'lrow' },
      el('span', {}, SWEEP_KINDS[w.kind] || 'Sweep'),
      el('span', { class: 'when' }, describeWhen(w.at)),
      el('span', { class: 'detail' }, describeResult(w.result).replace(/^./, (c) => c.toUpperCase()) + '. ',
        ...(left ? [el('span', { class: bad ? 'proof bad' : 'proof' }, left + '.')] : [])));
  }) : [el('div', { class: 'empty' }, 'No sweep yet. One runs every time Chrome starts.')]));
}

function openChromePage(url) {
  return (event) => { event.preventDefault(); chrome.tabs.create({ url }); };
}

// Bookmarks keep a site in address-bar suggestions after its history is gone. Shown, never changed.
async function renderBookmarks(sites) {
  const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };
  const found = [];
  for (const site of sites) {
    for (const b of await chrome.bookmarks.search(site)) {
      if (b.url && siteForHost(hostOf(b.url), [site])) found.push(b);
    }
  }
  const settingsLink = el('a', { href: '#', onclick: openChromePage('chrome://settings/syncSetup') }, 'Improve search suggestions');
  $('bookmarks').replaceChildren(
    found.length
      ? el('p', {}, `${plural(found.length, 'bookmark')} still ${found.length === 1 ? 'puts' : 'put'} your sites in address-bar suggestions:`)
      : el('p', {}, 'No bookmark points at your sites.'),
    ...(found.length ? [el('ul', {}, ...found.map((b) => el('li', {}, el('a', { href: '#', onclick: openChromePage(`chrome://bookmarks/?id=${b.parentId}`) }, b.title || b.url), ` · ${hostOf(b.url)}`)))] : []),
    el('p', {}, 'Google can also suggest a site from your account activity. That comes from Chrome\'s ', settingsLink, ' setting, under Sync and Google services.'));
}

// Chrome visits can also land in Web & App Activity, which no extension can reach.
function renderGoogle(sites) {
  // My Activity ignores a search passed in its URL, so the button copies the name to paste there.
  $('google').replaceChildren(
    el('p', {}, 'If Web & App Activity is on, Google keeps its own record of these visits. Each button copies the site\'s name and opens Google My Activity: paste it into the search box there and delete what it finds.'),
    sites.length
      ? el('div', { class: 'actions' }, ...sites.map((site) =>
        el('button', { class: 'btn ghost', onclick: async () => {
          await navigator.clipboard.writeText(site);
          chrome.tabs.create({ url: 'https://myactivity.google.com/myactivity' });
        } }, site)))
      : el('p', { class: 'muted' }, 'Add a site first.'));
}

async function renderPanic() {
  const [command] = (await chrome.commands.getAll()).filter((c) => c.name === 'panic');
  const key = command?.shortcut;
  $('panic').replaceChildren(
    el('p', {}, 'One key combination closes every tab on your sites and deletes their history at once.'),
    el('p', {}, key ? 'Your shortcut: ' : 'No shortcut set yet. ', ...(key ? [el('kbd', {}, key), '. '] : [])),
    el('div', { class: 'actions' }, el('button', { class: 'btn ghost', onclick: () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) }, key ? 'Change shortcut' : 'Set a shortcut')));
}

$('add').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = await addSiteFromText($('domain').value);
  $('error').textContent = error;
  if (error) return;
  $('domain').value = '';
  flashSaved();
  render();
});

$('now').addEventListener('click', async () => {
  const button = $('now');
  button.disabled = true;
  button.textContent = 'Deleting…';
  const result = await chrome.runtime.sendMessage('scrubAll');
  button.disabled = false;
  button.textContent = 'Delete history now';
  $('sweep').textContent = `Just now: ${describeResult(result)}.`;
});

// Another window (the popup) can change the list; keep this page in step.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.sites || changes.incognitoSites || changes.icons || changes.sweeps)) render();
});

render();
