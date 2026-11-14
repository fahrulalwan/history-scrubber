const $ = (id) => document.getElementById(id);

async function currentHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const url = new URL(tab?.url || '');
    return /^https?:$/.test(url.protocol) ? url.hostname.toLowerCase() : null;
  } catch { return null; }
}

async function render() {
  const [settings, host, sweep] = await Promise.all([loadSettings(), currentHost(), lastSweepSentence()]);
  const listed = host ? siteForHost(host, settings.sites) : null;
  const shown = listed || (host ? normalizeDomain(host) : null);

  const n = settings.sites.length;
  $('count').textContent = plural(n, 'site');
  $('now').disabled = n === 0;
  $('now').hidden = n === 0;
  $('now-note').textContent = n === 0 ? '' : `Deletes the history of ${n === 1 ? 'the site' : `all ${n} sites`} on your list right away. Otherwise it happens the next time you close a tab.`;
  $('sweep').textContent = n === 0 ? 'Nothing is deleted until you add a site.' : sweep;

  const site = $('site');
  site.replaceChildren();
  const controls = $('controls');
  controls.replaceChildren();

  if (!shown) {
    site.append(el('div', { class: 'fav' }, '–'),
      el('div', {}, el('div', { class: 'domain' }, 'Not a website'),
        el('div', { class: 'state' }, 'Open a site to add it here, or add sites in Settings.')));
    controls.hidden = true;
    return;
  }
  controls.hidden = false;

  const state = listed
    ? el('div', { class: 'state' }, el('span', { class: 'signal' }, 'On your list. '), 'History goes when this tab closes.')
    : el('div', { class: 'state' }, 'Not on your list. Its history is kept.');
  site.append(el('div', { class: 'fav' }, shown[0]), el('div', {}, el('div', { class: 'domain' }, shown), state));

  controls.append(el('div', { class: 'row' }, el('span', {}, listed ? 'Keep on list' : 'Add to list'),
    makeSwitch('Keep this site on the list', !!listed, async (on) => {
      const s = await loadSettings();
      s.sites = on ? [...s.sites, shown] : s.sites.filter((x) => x !== shown);
      await saveSettings(s);
      render();
    })));

  if (listed) {
    controls.append(el('div', { class: 'row' }, el('span', {}, 'Open in incognito'),
      makeSwitch('Always open this site in incognito', settings.incognitoSites.includes(listed), async (on) => {
        const s = await loadSettings();
        s.incognitoSites = on ? [...s.incognitoSites, listed] : s.incognitoSites.filter((x) => x !== listed);
        await saveSettings(s);
        render();
      })));
    if (settings.incognitoSites.includes(listed)) {
      controls.append(el('p', { class: 'note' }, 'From the next link on, this site opens in incognito, where you are logged out.'));
    }
  }
}

$('now').addEventListener('click', async () => {
  const button = $('now');
  button.disabled = true;
  button.textContent = 'Deleting…';
  const result = await chrome.runtime.sendMessage('scrubAll');
  $('result').textContent = describeResult(result).replace(/^./, (c) => c.toUpperCase()) + '.';
  button.textContent = 'Delete history now';
  button.disabled = false;
  render();
});

$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

render().finally(() => document.body.classList.add('ready'));
