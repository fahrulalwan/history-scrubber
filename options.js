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
  const s = await loadSettings();
  const list = $('list');
  list.replaceChildren();
  $('saved').textContent = plural(s.sites.length, 'site') + (savedAt ? ` · saved ${savedAt}` : '');
  if (!s.sites.length) {
    list.append(el('div', { class: 'empty' }, 'No sites yet. Add the first one above; nothing is deleted until you do.'));
  }
  for (const site of s.sites) {
    list.append(el('div', { class: 'srow' },
      el('div', { class: 'fav' }, site[0]),
      el('div', { class: 'domain' }, site),
      el('div', { class: 'inc' }, 'Incognito',
        makeSwitch(`Always open ${site} in incognito`, s.incognitoSites.includes(site), (on) =>
          update((x) => { x.incognitoSites = on ? [...x.incognitoSites, site] : x.incognitoSites.filter((y) => y !== site); }))),
      el('button', { class: 'remove', 'aria-label': `Remove ${site}`, title: `Remove ${site}`,
        onclick: () => update((x) => { x.sites = x.sites.filter((y) => y !== site); }) }, '×')));
  }
  $('sweep').textContent = await lastSweepSentence();
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
  if (area === 'sync' && (changes.sites || changes.incognitoSites)) render();
});

render();
