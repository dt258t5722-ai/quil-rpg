const CACHE = 'quil-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/data.js',
  './js/dice.js',
  './js/save.js',
  './js/art.js',
  './js/narrate.js',
  './js/combat.js',
  './js/game.js',
  './js/extras.js',
  './js/main.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/Cinzel.ttf',
  './fonts/EBGaramond.ttf',
  './fonts/EBGaramond-Italic.ttf',
  './assets/art/map.webp',
  './assets/art/quil.webp',
  './assets/art/tamsin.webp',
  './assets/art/goblin_king.webp',
  './assets/art/goblin_cutter.webp',
  './assets/art/goblin_archer.webp',
  './assets/art/hollowmere_burning.webp',
  './assets/art/mill.webp',
  './assets/art/camp.webp',
  './assets/art/items.webp',
  './assets/art/item_hatchet.webp',
  './assets/art/item_bow.webp',
  './assets/art/item_arrows.webp',
  './assets/art/item_loot.webp',
  './assets/art/kill_cutter_hatchet.webp',
  './assets/art/kill_archer_arrow.webp',
  './assets/art/kill_throw.webp',
  './assets/art/interrogate.webp',
  './assets/art/tamsin_rescue.webp',
  './assets/art/tamsin_flirt.webp',
  './assets/art/tamsin_kiss.webp',
  './assets/art/ally_pact.webp',
  './assets/art/inn.webp',
  './assets/art/market.webp',
  './assets/art/battlemap_m1.webp',
  './assets/art/stealth_takedown.webp',
  './assets/art/alarm_horn.webp',
  './assets/art/quil_wounded.webp',
  './assets/art/tokens/quil.webp',
  './assets/art/tokens/cutter.webp',
  './assets/art/tokens/archer.webp',
  './assets/art/tokens/troll.webp',
  './assets/art/tokens/ko.webp',
  './assets/art/tokens/dead.webp'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Network-first so new deploys are never shadowed by stale cache; cache is the offline fallback.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
