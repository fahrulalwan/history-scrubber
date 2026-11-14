// Settings helpers shared by the popup, the settings page and the welcome page.

function normalizeDomain(text) {
  return (text || '').trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[/?#:].*$/, '');
}

function looksLikeDomain(domain) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain);
}

async function loadSettings() {
  const { sites, incognitoSites } = await chrome.storage.sync.get(['sites', 'incognitoSites']);
  return {
    sites: Array.isArray(sites) ? sites : [],
    incognitoSites: Array.isArray(incognitoSites) ? incognitoSites : [],
  };
}

async function saveSettings({ sites, incognitoSites }) {
  const unique = [...new Set(sites)];
  // Incognito is a per-site option, so it can't outlive the site.
  const incognito = [...new Set(incognitoSites)].filter((s) => unique.includes(s));
  await chrome.storage.sync.set({ sites: unique, incognitoSites: incognito });
}

function siteForHost(host, sites) {
  return sites.find((s) => host === s || host.endsWith('.' + s)) || null;
}

function describeResult(result) {
  const parts = Object.entries(result || {})
    .filter(([, n]) => n.history || n.downloads)
    .map(([site, n]) => {
      const bits = [];
      if (n.history) bits.push(`${n.history} ${n.history === 1 ? 'page' : 'pages'}`);
      if (n.downloads) bits.push(`${n.downloads} ${n.downloads === 1 ? 'download' : 'downloads'}`);
      return `${site} (${bits.join(', ')})`;
    });
  return parts.length ? `deleted ${parts.join(', ')}` : 'nothing left to delete';
}

function describeWhen(iso) {
  const at = new Date(iso);
  const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sameDay = at.toDateString() === new Date().toDateString();
  return sameDay ? `today at ${time}` : `${at.toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${time}`;
}

async function lastSweepSentence() {
  const { lastSweep } = await chrome.storage.local.get('lastSweep');
  if (!lastSweep) return 'No sweep yet. One runs every time Chrome starts.';
  return `Last sweep ${describeWhen(lastSweep.at)}: ${describeResult(lastSweep.result)}.`;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

// The site's own icon when one was saved, else its first letter.
function favEl(site, icon) {
  return el('div', { class: 'fav' }, icon ? el('img', { src: icon, alt: '' }) : site[0]);
}

async function loadIcons() {
  return (await chrome.storage.local.get('icons')).icons || {};
}

function plural(n, word) {
  return `${n} ${n === 1 ? word : word + 's'}`;
}

// Adds a site from free text; returns an error sentence, or '' when it was added.
async function addSiteFromText(text) {
  const domain = normalizeDomain(text);
  if (!looksLikeDomain(domain)) return 'That doesn\'t look like a site. Try something like example.com.';
  const s = await loadSettings();
  if (s.sites.includes(domain)) return `${domain} is already on the list.`;
  s.sites = [...s.sites, domain];
  await saveSettings(s);
  return '';
}

function makeSwitch(label, checked, onChange) {
  const sw = el('button', { class: 'switch', role: 'switch', 'aria-checked': String(checked), 'aria-label': label });
  sw.addEventListener('click', async () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(next));
    await onChange(next);
  });
  return sw;
}
