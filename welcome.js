const $ = (id) => document.getElementById(id);

async function render() {
  const s = await loadSettings();
  const chips = $('chips');
  chips.replaceChildren(...s.sites.map((site) => el('span', { class: 'chip' }, site,
    el('button', { 'aria-label': `Remove ${site}`, title: `Remove ${site}`, onclick: async () => {
      const x = await loadSettings();
      x.sites = x.sites.filter((y) => y !== site);
      await saveSettings(x);
      render();
    } }, '×'))));
  $('step-sites').classList.toggle('done', s.sites.length > 0);
  $('finish-note').textContent = s.sites.length
    ? `${plural(s.sites.length, 'site')} on your list. You can change it any time in Settings.`
    : 'You can also add sites later from the toolbar button or Settings.';
}

$('add').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = await addSiteFromText($('domain').value);
  $('error').textContent = error;
  if (error) return;
  $('domain').value = '';
  $('domain').focus();
  render();
});

$('done').addEventListener('click', async () => {
  await chrome.storage.local.set({ onboardedAt: new Date().toISOString() });
  // window.close() is ignored for a tab the extension opened, so close it by id.
  const tab = await chrome.tabs.getCurrent();
  if (tab) chrome.tabs.remove(tab.id); else window.close();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.sites) render();
});

render();
$('domain').focus();
