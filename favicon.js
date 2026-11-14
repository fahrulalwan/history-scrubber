// Site icons come from Chrome's own favicon store (the "favicon" permission), so showing one
// makes no network request. Chrome drops a site's icon together with its history, so each
// listed site's icon is copied to local storage before its history is deleted.

function faviconUrl(pageUrl) {
  return `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
}

async function faviconBytes(pageUrl) {
  return new Uint8Array(await (await fetch(faviconUrl(pageUrl))).arrayBuffer());
}

// Chrome answers a site it has no icon for with its generic globe, so that answer means "none".
let globeBytes = null;
async function realFavicon(pageUrls) {
  globeBytes ??= await faviconBytes('https://unknown.invalid/');
  for (const pageUrl of pageUrls) {
    const bytes = await faviconBytes(pageUrl);
    if (bytes.length === globeBytes.length && bytes.every((b, i) => b === globeBytes[i])) continue;
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return 'data:image/png;base64,' + btoa(binary);
  }
  return null;
}

// Looks up an icon only for listed sites that don't have one saved yet. `pageUrls` maps a site
// to pages of it to try first; Chrome also falls back from any page to the host's icon.
async function saveSiteIcons(sites, pageUrls = {}) {
  const { icons = {} } = await chrome.storage.local.get('icons');
  let changed = false;
  for (const site of sites) {
    if (icons[site]) continue;
    const icon = await realFavicon([...(pageUrls[site] || []), `https://${site}/`, `https://www.${site}/`]);
    if (icon) { icons[site] = icon; changed = true; }
  }
  if (changed) await chrome.storage.local.set({ icons });
}
