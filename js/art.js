/**
 * Art placeholders + hook for generated images cached per entity id.
 *
 * Integration point for an image-generation API:
 *   QuilArt.requestGenerated(entityId, promptExtras) → Promise<blobUrl|null>
 * Cached in Cache Storage under 'quil-art-v1' keyed by entityId + styleVersion.
 * Until a generator is wired, getArt() returns a CSS parchment placeholder.
 */
window.QuilArt = (() => {
  const STYLE_VERSION = '1';
  const CACHE_NAME = 'quil-art-v1';
  /** Optional: set to a function (entityId, meta) => Promise<Blob> */
  let generator = null;

  const META = {
    'char.quil': { label: 'Quil Ashby', emoji: '⚔️', hue: 25 },
    'char.tomas': { label: 'Tomas', emoji: '🪓', hue: 20 },
    'char.tamsin': { label: 'Tamsin Reed', emoji: '👩', hue: 35 },
    'char.maren': { label: 'Maren', emoji: '🧣', hue: 90 },
    'enemy.goblin_cutter': { label: 'Goblin Cutter', emoji: '🗡️', hue: 100 },
    'enemy.goblin_archer': { label: 'Goblin Archer', emoji: '🏹', hue: 85 },
    'scene.hollowmere_dusk': { label: 'Hollowmere at dusk', emoji: '🌅', hue: 15 },
    'scene.farmhouse_fire': { label: 'Burning farmhouse', emoji: '🔥', hue: 10 },
    'scene.quil_hatchet': { label: "Father's hatchet", emoji: '🪓', hue: 20 },
    'scene.road_east': { label: 'Road east', emoji: '🛤️', hue: 30 },
    'scene.mill_loft': { label: 'Mill loft', emoji: '🏚️', hue: 40 },
    'scene.town_square': { label: 'Burning square', emoji: '🔥', hue: 8 },
    'char.ysolde': { label: 'Ysolde Fane', emoji: '🌿', hue: 110 },
    'enemy.wolf_rider': { label: 'Wolf-Rider', emoji: '🐺', hue: 60 },
    'scene.fade_romance': { label: 'Firelight', emoji: '🕯️', hue: 18 },
  };

  /* Shipped art (assets/art/*.webp), keyed by entity id. pos = CSS object-position keeping the subject visible. */
  const A = 'assets/art/';
  const FILES = {
    'char.quil': [A+'quil.webp', '45% 22%'],
    'char.tamsin': [A+'tamsin.webp', '52% 22%'],
    'char.mawrot': [A+'goblin_king.webp', '45% 30%'],
    'enemy.goblin_cutter': [A+'goblin_cutter.webp', '41% 22%'],
    'enemy.goblin_archer': [A+'goblin_archer.webp', '45% 20%'],
    'scene.title': [A+'hollowmere_burning.webp', '50% 45%'],
    'scene.hollowmere_dusk': [A+'hollowmere_burning.webp', '35% 50%'],
    'scene.farmhouse_fire': [A+'hollowmere_burning.webp', '75% 50%'],
    'scene.town_square': [A+'hollowmere_burning.webp', '50% 55%'],
    'scene.ashby_farm': [A+'hollowmere_burning.webp', '85% 50%'],
    'scene.quil_hatchet': [A+'quil.webp', '45% 30%'],
    'scene.road_east': [A+'camp.webp', '45% 55%'],
    'scene.mill': [A+'mill.webp', '25% 50%'],
    'scene.mill_loft': [A+'tamsin.webp', '52% 25%'],
    'scene.camp': [A+'camp.webp', '45% 60%'],
    'scene.fade_romance': [A+'camp.webp', '45% 60%'],
    'item.banner': [A+'items.webp', '50% 50%'],
    'item.hatchet': [A+'item_hatchet.webp', '50% 40%'],
    'item.bow': [A+'item_bow.webp', '50% 50%'],
    'item.arrows': [A+'item_arrows.webp', '50% 50%'],
    'item.loot': [A+'item_loot.webp', '50% 50%'],
    'map.world': [A+'map.webp', '50% 50%'],
    'battle.kill_melee': [A+'kill_cutter_hatchet.webp', '45% 40%'],
    'battle.kill_arrow': [A+'kill_archer_arrow.webp', '60% 35%'],
    'battle.kill_throw': [A+'kill_throw.webp', '55% 30%'],
    'battle.interrogate': [A+'interrogate.webp', '60% 40%'],
    'battle.takedown': [A+'stealth_takedown.webp', '45% 35%'],
    'battle.alarm': [A+'alarm_horn.webp', '40% 35%'],
    'battle.wounded': [A+'quil_wounded.webp', '50% 35%'],
    'romance.rescue': [A+'tamsin_rescue.webp', '50% 40%'],
    'romance.flirt': [A+'tamsin_flirt.webp', '50% 35%'],
    'romance.kiss': [A+'tamsin_kiss.webp', '40% 40%'],
    'ally.pact': [A+'ally_pact.webp', '55% 40%'],
    'place.inn': [A+'inn.webp', '50% 50%'],
    'place.market': [A+'market.webp', '50% 50%'],
    'scene.charcoal_track': [A+'charcoal_track.webp', '50% 50%'],
    'map.battle_m2': [A+'battlemap_m2.webp', '50% 50%'],
    'enemy.wolf_rider': [A+'wolf_rider.webp', '50% 35%'],
    'enemy.wolf': [A+'wolf_rider.webp', '50% 60%'],
    'battle.kill_wolfrider': [A+'kill_wolfrider.webp', '50% 40%'],
    'char.ysolde': [A+'ysolde.webp', '50% 25%'],
    'romance.y_rescue': [A+'ysolde_rescue.webp', '45% 40%'],
    'romance.y_flirt': [A+'ysolde_flirt.webp', '50% 35%'],
    'romance.y_kiss': [A+'ysolde_kiss.webp', '50% 40%'],
  };
  function file(entityId) { return FILES[entityId] || null; }

  function meta(entityId) {
    return META[entityId] || { label: entityId, emoji: '📜', hue: 30 };
  }

  function placeholderEl(entityId, className) {
    const m = meta(entityId);
    const el = document.createElement('div');
    el.className = (className || '') + ' art-placeholder';
    el.dataset.entityId = entityId;
    el.style.cssText = `
      width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;
      background: linear-gradient(160deg, hsl(${m.hue},30%,18%), hsl(${m.hue},20%,8%));
      color:#8a7a60; text-align:center; padding:8px;`;
    const f = FILES[entityId];
    if (f) {
      if (window.QuilExtras) QuilExtras.unlock(entityId);
      el.className = (className || '') + ' art-img';
      el.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;background:#0e0b0a';
      el.innerHTML = `<img src="${f[0]}" alt="${m.label}" decoding="async" style="width:100%;height:100%;object-fit:cover;object-position:${f[1]};display:block">`;
      // A generated/cached override (same entity id) still wins if present
      resolveCached(entityId).then(url => { if (url && el.isConnected) el.querySelector('img').src = url; });
      return el;
    }
    el.innerHTML = `<div style="font-size:2em">${m.emoji}</div>
      <div style="font-family:Cinzel,Georgia,serif;font-size:11px;color:#C8A24A;margin-top:4px">${m.label}</div>
      <div style="font-size:10px;opacity:0.6;margin-top:2px">art pending</div>`;
    // Try cache async
    resolveCached(entityId).then(url => {
      if (!url || !el.isConnected) return;
      const img = document.createElement('img');
      img.src = url;
      img.alt = m.label;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover';
      el.innerHTML = '';
      el.appendChild(img);
    });
    return el;
  }

  function mount(container, entityId) {
    if (!container) return;
    if (container.classList.contains('art-banner')) {
      container.querySelectorAll(':scope > .art-img, :scope > .art-placeholder').forEach(n => n.remove());
      container.prepend(placeholderEl(entityId));
      return;
    }
    container.innerHTML = '';
    container.appendChild(placeholderEl(entityId));
  }

  async function cacheKey(entityId) {
    return `${entityId}::${STYLE_VERSION}`;
  }

  async function resolveCached(entityId) {
    try {
      if (!('caches' in window)) return null;
      const cache = await caches.open(CACHE_NAME);
      const key = await cacheKey(entityId);
      const res = await cache.match(key);
      if (!res) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (_) { return null; }
  }

  async function storeGenerated(entityId, blob) {
    if (!('caches' in window)) return;
    const cache = await caches.open(CACHE_NAME);
    const key = await cacheKey(entityId);
    await cache.put(key, new Response(blob, { headers: { 'Content-Type': blob.type || 'image/webp' } }));
  }

  /**
   * Hook for generated images. Wire a generator with QuilArt.setGenerator(fn).
   * fn(entityId, meta) should return a Promise<Blob>.
   */
  function setGenerator(fn) { generator = fn; }

  async function requestGenerated(entityId, promptExtras) {
    const existing = await resolveCached(entityId);
    if (existing) return existing;
    if (!generator) return null;
    const blob = await generator(entityId, { ...meta(entityId), promptExtras, styleVersion: STYLE_VERSION });
    if (!blob) return null;
    await storeGenerated(entityId, blob);
    return URL.createObjectURL(blob);
  }

  return { mount, placeholderEl, meta, file, setGenerator, requestGenerated, resolveCached, storeGenerated, STYLE_VERSION };
})();
