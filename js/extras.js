/* v6: cinematic cards, gallery + fullscreen viewer, town hub & economy, mission-complete recap */
(() => {
  const $ = id => document.getElementById(id);
  const S = () => QuilSave.get();
  const toast = m => QuilGame.toast(m);

  /* ---------- save migration ---------- */
  function ensure(s) {
    if (!s) return s;
    s.items = Object.assign({ minor_potion: 1, potion: 0, bandage: 1, rope: 1, ration: 1, torch: 0 }, s.items || {});
    s.gallery = s.gallery || {};
    s.flags.cineSeen = s.flags.cineSeen || {};
    s.allies = s.allies || [];
    return s;
  }
  window.QuilEnsure = ensure;

  /* ---------- Gallery data ---------- */
  const G = [
    { cat: 'People', ids: ['char.quil', 'scene.quil_hatchet'], art: 'char.quil', cap: 'Quilliam "Quil" Ashby, nineteen, with his father\'s hatchet.' },
    { cat: 'People', ids: ['char.tamsin', 'scene.mill_loft'], art: 'char.tamsin', cap: 'Tamsin Reed, the miller\'s daughter, sharp-tongued and unbowed.' },
    { cat: 'People', ids: ['ally.pact'], art: 'ally.pact', cap: 'A pact sealed: Old Bram of the Hollowmere militia joins the hunt.' },
    { cat: 'People', ids: ['char.mawrot'], art: 'char.mawrot', cap: 'Mawrot, the Goblin King, one-eyed and patient.' },
    { cat: 'Places', ids: ['scene.title', 'scene.hollowmere_dusk', 'scene.farmhouse_fire', 'scene.town_square', 'scene.ashby_farm'], art: 'scene.title', cap: 'Hollowmere burning, the night of the Tithe.' },
    { cat: 'Places', ids: ['scene.mill'], art: 'scene.mill', cap: 'Hollowmere Mill, its wheel still turning.' },
    { cat: 'Places', ids: ['scene.camp', 'scene.road_east', 'scene.fade_romance'], art: 'scene.camp', cap: 'A cold camp in the woods, the hatchet close at hand.' },
    { cat: 'Places', ids: ['map.world'], art: 'map.world', cap: 'The Vale of Embers.' },
    { cat: 'Places', ids: ['place.inn'], art: 'place.inn', cap: 'The Crooked Mile inn at the King\'s Road Waypost.' },
    { cat: 'Places', ids: ['place.market'], art: 'place.market', cap: 'The waypost market at dusk.' },
    { cat: 'Battle', ids: ['enemy.goblin_cutter'], art: 'enemy.goblin_cutter', cap: 'Goblin Cutter: quick, cruel, and never alone.' },
    { cat: 'Battle', ids: ['enemy.goblin_archer'], art: 'enemy.goblin_archer', cap: 'Goblin Archer, perched where the arrows come from.' },
    { cat: 'Battle', ids: ['battle.kill_melee'], art: 'battle.kill_melee', cap: 'The hatchet does its work.' },
    { cat: 'Battle', ids: ['battle.kill_arrow'], art: 'battle.kill_arrow', cap: 'An archer shot off his beam.' },
    { cat: 'Battle', ids: ['battle.kill_throw'], art: 'battle.kill_throw', cap: 'An improvised throw finds its mark.' },
    { cat: 'Battle', ids: ['battle.interrogate'], art: 'battle.interrogate', cap: 'A captive, and a question.' },
    { cat: 'Battle', ids: ['battle.takedown'], art: 'battle.takedown', cap: 'A hand over the mouth, a blade under the jaw. Silent.' },
    { cat: 'Battle', ids: ['battle.alarm'], art: 'battle.alarm', cap: 'A body found, and the bone horn sounds.' },
    { cat: 'Battle', ids: ['battle.wounded'], art: 'battle.wounded', cap: 'Bleeding, ringed in, still holding the hatchet.' },
    { cat: 'Battle', ids: ['item.banner', 'item.hatchet', 'item.bow', 'item.arrows', 'item.loot'], art: 'item.banner', cap: 'Hatchet, bow, arrows and a dead goblin\'s purse.' },
    { cat: 'Romance', ids: ['romance.rescue'], art: 'romance.rescue', cap: 'A hand offered on the mill-loft ladder.' },
    { cat: 'Romance', ids: ['romance.flirt'], art: 'romance.flirt', cap: 'Firelight, and her fingers on the cut on your cheek.' },
    { cat: 'Romance', ids: ['romance.kiss'], art: 'romance.kiss', cap: 'Moonlight in the hayloft.' },
  ];
  const CATS = ['People', 'Places', 'Battle', 'Romance'];
  function unlock(id) {
    const s = S(); if (!s) return;
    ensure(s);
    G.forEach((g, i) => {
      if (g.ids.includes(id) && !s.gallery[g.art]) {
        s.gallery[g.art] = { t: Date.now(), m: s.flags.mission1Done && s.flags.m1Stage === 'done' ? 'post1' : 'm1' };
        QuilSave.save();
      }
    });
  }
  function unlockedList(filter) {
    const s = S(); ensure(s);
    return G.filter(g => s.gallery[g.art] && (!filter || filter(s.gallery[g.art])));
  }

  function showGallery() {
    QuilGame.showScreen('screen-gallery');
    const list = unlockedList();
    const root = $('gallery-root');
    root.innerHTML = `<p class="gal-count">${list.length} of ${G.length} images unlocked</p>` + CATS.map(cat => {
      const items = G.filter(g => g.cat === cat);
      return `<h3 class="cinzel gal-h">${cat}</h3><div class="gal-grid">${items.map(g => {
        const on = list.includes(g);
        return on ? `<button class="gal-th" data-gi="${list.indexOf(g)}" data-art="${g.art}" aria-label="${g.cap}"></button>`
                  : `<div class="gal-th locked"><span>?</span></div>`;
      }).join('')}</div>`;
    }).join('');
    root.querySelectorAll('.gal-th[data-art]').forEach(el => {
      el.appendChild(QuilArt.placeholderEl(el.dataset.art));
      el.onclick = () => openViewer(list, +el.dataset.gi);
    });
  }

  /* ---------- Fullscreen viewer: pinch-zoom, pan, swipe, double-tap ---------- */
  function openViewer(list, idx) {
    let v = $('viewer');
    if (!v) { v = document.createElement('div'); v.id = 'viewer'; $('app').appendChild(v); }
    v.innerHTML = `<div class="vw-stage"><img class="vw-img" draggable="false"></div>
      <div class="vw-top"><span class="vw-n"></span><button class="vw-close" aria-label="Close">✕</button></div>
      <button class="vw-nav prev" aria-label="Previous">‹</button><button class="vw-nav next" aria-label="Next">›</button>
      <div class="vw-cap"></div>`;
    v.classList.add('open');
    const img = v.querySelector('.vw-img'), stage = v.querySelector('.vw-stage');
    let scale = 1, tx = 0, ty = 0;
    const apply = (anim) => { img.style.transition = anim ? 'transform .2s' : 'none'; img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; };
    function show(i) {
      idx = (i + list.length) % list.length;
      const g = list[idx];
      img.src = QuilArt.file(g.art)[0];
      v.querySelector('.vw-cap').textContent = g.cap;
      v.querySelector('.vw-n').textContent = `${g.cat} · ${idx + 1} / ${list.length}`;
      scale = 1; tx = 0; ty = 0; apply(false);
    }
    const close = () => { v.classList.remove('open'); v.innerHTML = ''; document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(idx + 1); if (e.key === 'ArrowLeft') show(idx - 1); };
    document.addEventListener('keydown', key);
    v.querySelector('.vw-close').onclick = close;
    v.querySelector('.prev').onclick = () => show(idx - 1);
    v.querySelector('.next').onclick = () => show(idx + 1);
    const pts = new Map(); let start = null, lastTap = 0;
    stage.onpointerdown = e => {
      try { stage.setPointerCapture(e.pointerId); } catch (_) {} pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) start = { x: e.clientX, y: e.clientY, tx, ty, t: Date.now() };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; start = { d: Math.hypot(a.x - b.x, a.y - b.y), scale }; }
    };
    stage.onpointermove = e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && start.d) { const [a, b] = [...pts.values()]; scale = Math.min(5, Math.max(1, start.scale * Math.hypot(a.x - b.x, a.y - b.y) / start.d)); apply(false); }
      else if (pts.size === 1 && start && start.x != null) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (scale > 1) { tx = start.tx + dx; ty = start.ty + dy; } else { tx = dx; }
        apply(false);
      }
    };
    stage.onpointerup = stage.onpointercancel = e => {
      pts.delete(e.pointerId);
      if (pts.size === 0 && start) {
        const dx = e.clientX - (start.x ?? e.clientX);
        if (scale <= 1.02) {
          if (Math.abs(dx) > 60) return show(idx + (dx < 0 ? 1 : -1));
          scale = 1; tx = 0; ty = 0; apply(true);
          const now = Date.now();
          if (Math.abs(dx) < 8 && now - lastTap < 300) { scale = 2.5; apply(true); }
          lastTap = now;
        } else if (Math.abs(dx) < 8 && Date.now() - lastTap < 300) { scale = 1; tx = 0; ty = 0; apply(true); }
        else lastTap = Date.now();
        start = null;
      } else if (pts.size === 1) { const p = [...pts.values()][0]; start = { x: p.x, y: p.y, tx, ty }; }
    };
    show(idx);
  }

  /* ---------- Cinematic scene card ---------- */
  /* Cinematic card: stays until the player taps Continue (no auto-dismiss) */
  function cine(artId, narr, caption) {
    return new Promise(res => {
      let c = $('cine'); if (!c) { c = document.createElement('div'); c.id = 'cine'; $('app').appendChild(c); }
      c.innerHTML = `<div class="cine-card"><div class="cine-art"></div><div class="cine-txt">
        ${caption ? `<div class="cine-cap cinzel">${caption}</div>` : ''}<div class="cine-narr">${narr || ''}</div>
        <button class="btn primary cine-go" id="cine-continue">Continue ▸</button></div></div>`;
      QuilArt.mount(c.querySelector('.cine-art'), artId);
      c.classList.add('open');
      c.onclick = null;
      c.querySelector('#cine-continue').onclick = ev => { ev.stopPropagation(); c.classList.remove('open'); setTimeout(() => { c.innerHTML = ''; res(); }, 150); };
    });
  }

  /* ---------- Economy ---------- */
  const PRICES = {
    room: 8, meal: 2,
    minor_potion: 6, potion: 14, bandage: 3,
    rope: 2, ration: 2, torch: 2,
    repair: 2,
    arrows: { broadhead: [5, 5], blunt: [5, 5], bodkin: [5, 10], barbed: [3, 9], fire: [3, 12], whistler: [2, 4] },
    weapons: { short_sword: 40, spear: 50 },
    jewelBuy: { garnet: 8, amethyst: 16, sapphire: 24, emerald: 32, ruby: 48, diamond: 80 },
  };
  const ITEM = {
    minor_potion: { name: 'Minor Healing Potion', heal: 8, icon: '🧪' },
    potion: { name: 'Healing Potion', heal: 15, icon: '⚗️' },
    bandage: { name: 'Bandage', heal: 3, icon: '🩹', note: 'stops bleeding' },
    rope: { name: 'Rope', icon: '🪢', note: 'binds a captive' },
    ration: { name: 'Ration', icon: '🍖', note: 'needed to rest at camp' },
    torch: { name: 'Torch', icon: '🔥', note: 'light for dark places' },
  };
  function heal(n) { const h = S().hero; const before = h.hp; h.hp = Math.min(h.maxHp, h.hp + n); return h.hp - before; }
  function spend(n) { const h = S().hero; if (h.gold < n) { toast(`Not enough gold (need ${n}g)`); return false; } h.gold -= n; QuilSave.save(); return true; }
  const goldChip = () => `<span class="gold-chip">⚜ ${S().hero.gold}g</span>`;
  const hpChip = () => `<span class="hp-chip">♥ ${S().hero.hp}/${S().hero.maxHp}</span>`;

  /* ---------- Town hub ---------- */
  const TOWN = { id: 'waypost', name: "King's Road Waypost",
    blurb: "A palisaded waystation where the King's Road leaves the Vale. Hollowmere's survivors trade here now: a smoky inn, a few stalls, and a smith who works by lantern-light." };
  function townScreen(art, title, bodyHtml, back) {
    QuilGame.showScreen('screen-town');
    $('town-title').innerHTML = title;
    $('town-chips').innerHTML = goldChip() + hpChip();
    QuilArt.mount($('town-art'), art);
    $('town-body').innerHTML = bodyHtml;
    $('town-back').textContent = back ? '⟵ Back' : '⟵ Leave town';
    $('town-back').onclick = back || (() => { toast('You take the road back to the Vale.'); QuilGame.showMap(); });
  }
  const refresh = () => { $('town-chips').innerHTML = goldChip() + hpChip(); };
  function showTown() {
    const s = ensure(S());
    if (!s.mapUnlocks.includes('waypost')) s.mapUnlocks.push('waypost');
    s.flags.lastTown = 'waypost'; QuilSave.save();
    townScreen('place.market', TOWN.name, `<p class="town-blurb">${TOWN.blurb}</p>
      <div class="shop-grid">
        <button class="shop-tile" data-go="inn"><b>🍺 The Crooked Mile</b><span>Inn · rooms, meals, rumours</span></button>
        <button class="shop-tile" data-go="apoth"><b>⚗️ Apothecary</b><span>Potions & bandages</span></button>
        <button class="shop-tile" data-go="smith"><b>⚒️ Smith & Fletcher</b><span>Weapons, arrows, repairs, buys loot</span></button>
        <button class="shop-tile" data-go="general"><b>🪢 General Store</b><span>Rope, rations, torches</span></button>
      </div>`);
    $('town-body').querySelectorAll('[data-go]').forEach(b => b.onclick = () => ({ inn, apoth, smith, general })[b.dataset.go]());
  }
  const back = () => showTown();
  function row(label, sub, price, id, disabled) {
    return `<div class="shop-row"><div><b>${label}</b><small>${sub || ''}</small></div>
      <button class="btn small ${disabled ? '' : 'primary'}" data-buy="${id}" ${disabled ? 'disabled' : ''}>${price}</button></div>`;
  }
  function inn() {
    const s = S();
    const bram = s.allies.find(a => a.id === 'bram');
    townScreen('place.inn', 'The Crooked Mile', `
      <p class="town-blurb">Pipe smoke, wet wool, and a fire that never quite warms the corners. The innkeeper, a widow with forearms like a smith's, eyes your bloody sleeves and says nothing.</p>
      ${row('A room for the night', 'Full heal · saves the game', PRICES.room + 'g', 'room')}
      ${row('Hot meal & ale', '+4 HP', PRICES.meal + 'g', 'meal')}
      ${row('Buy a round, listen', 'A rumour', '1g', 'rumour')}
      ${bram ? `<p class="town-note">Old Bram nods at you from his corner, his pack already on his shoulder.</p>`
             : s.flags.bramTried ? `<p class="town-note">The grizzled veteran has gone back to his ale.</p>`
             : `<div class="shop-row"><div><b>The grizzled veteran</b><small>A one-eared militiaman nursing his ale. Recruit roll · Charm vs 6</small></div><button class="btn small" data-buy="bram">Talk</button></div>`}
      <div id="inn-out" class="town-out"></div>`, back);
    const out = t => { $('inn-out').innerHTML = t; refresh(); };
    $('town-body').querySelectorAll('[data-buy]').forEach(b => b.onclick = async () => {
      const k = b.dataset.buy;
      if (k === 'room') { if (!spend(PRICES.room)) return; heal(999); QuilSave.save();
        out(`<p class="beat-narr">You sleep like the dead in a straw bed that smells of other men's sweat, and wake whole. <em>(Fully healed · game saved)</em></p>`); }
      if (k === 'meal') { if (!spend(PRICES.meal)) return; const n = heal(4); QuilSave.save();
        out(`<p class="beat-narr">Mutton stew, black bread, and ale that tastes of the barrel. Some warmth comes back into your hands. <em>(+${n} HP)</em></p>`); }
      if (k === 'rumour') { if (!spend(1)) return;
        const R = ["A drover swears the raiders' wagons split three ways at the charcoal track: east, coast, and mountain.",
          "The serving girl winks as she pours. \"Briarwatch walls are thick, but their gate captain drinks.\"",
          "An old woman mutters that an ogre has started taxing Rillwater Bridge in flesh.",
          "The innkeeper leans close. \"You've your father's jaw, lad. He drank here, years back, before he was a farmer.\""];
        out(`<p class="beat-narr">${R[Math.floor(Math.random() * R.length)]}</p>`); }
      if (k === 'bram') {
        s.flags.bramTried = true;
        const roll = await QuilDice.promptRoll({ title: 'Recruit: Old Bram', target: 6, modifiers: [{ label: 'Charm', value: s.hero.charm }, { label: 'Hollowmere son', value: 1 }] });
        const ok = ['success', 'strong', 'critical'].includes(roll.outcome);
        if (ok) {
          s.allies.push({ id: 'bram', name: 'Old Bram', perk: 'Old Guard: +1 Defence' }); QuilSave.save();
          await cine('ally.pact', 'Bram drains his cup, stands, and clasps your forearm in a grip like a vice. "Tomas taught me to string a bow. Least I can do is watch his boy\'s back."', 'Ally won · Old Bram');
          inn(); $('inn-out').innerHTML = `<p class="beat-narr">Old Bram joins you. <em>(Perk: Old Guard, +1 Defence · roll ${roll.total} vs 6)</em></p>`;
        } else {
          s.items.ration++; QuilSave.save();
          inn(); $('inn-out').innerHTML = `<p class="beat-narr">"Too old, lad. Too slow." He presses a ration into your hand anyway. <em>(Recruit failed · ${roll.total} vs 6 · +1 ration)</em></p>`;
        }
        refresh();
      }
    });
  }
  function apoth() {
    townScreen('place.market', 'Apothecary', `
      <p class="town-blurb">A hunched herb-wife behind a counter of stoppered bottles. Everything smells of yarrow and vinegar.</p>
      ${['minor_potion', 'potion', 'bandage'].map(k => row(ITEM[k].icon + ' ' + ITEM[k].name, (ITEM[k].heal ? `+${ITEM[k].heal} HP` : '') + (ITEM[k].note ? ' · ' + ITEM[k].note : '') + ` · you have ${S().items[k]}`, PRICES[k] + 'g', k)).join('')}`, back);
    $('town-body').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const k = b.dataset.buy; if (!spend(PRICES[k])) return; S().items[k]++; QuilSave.save(); toast(`Bought ${ITEM[k].name}`); apoth(); });
  }
  function general() {
    townScreen('place.market', 'General Store', `
      <p class="town-blurb">Coils of rope, sacks of hard biscuit, and a boy who counts your coins twice.</p>
      ${['rope', 'ration', 'torch'].map(k => row(ITEM[k].icon + ' ' + ITEM[k].name, ITEM[k].note + ` · you have ${S().items[k]}`, PRICES[k] + 'g', k)).join('')}`, back);
    $('town-body').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const k = b.dataset.buy; if (!spend(PRICES[k])) return; S().items[k]++; QuilSave.save(); toast(`Bought ${ITEM[k].name}`); general(); });
  }
  function smith() {
    const s = S(), inv = s.inventory;
    const arrows = Object.entries(PRICES.arrows).map(([k, [n, p]]) => row(`${n} × ${QuilData.arrows[k].name}`, `quiver: ${inv.quiver[k] || 0}`, p + 'g', 'arrow:' + k)).join('');
    const weapons = Object.entries(PRICES.weapons).map(([k, p]) => row(QuilData.weapons[k].name, `Base ${QuilData.weapons[k].base} · Acc +${QuilData.weapons[k].acc}`, p + 'g', 'wpn:' + k, inv.mainHand === k || inv.pack.includes(k))).join('');
    const jewels = Object.entries(s.hero.jewels).filter(([, n]) => n > 0).map(([k, n]) => row(`Sell ${k} (×${n})`, 'fair price', '+' + (PRICES.jewelBuy[k] || 5) + 'g', 'jewel:' + k)).join('');
    const human = inv.pack.filter(id => QuilData.weapons[id] && !QuilData.weapons[id].enemy && id !== 'tomas_hatchet');
    const sellW = human.map(id => row(`Sell ${QuilData.weapons[id].name}`, 'half price', '+' + Math.floor((PRICES.weapons[id] || 20) / 2) + 'g', 'sellw:' + id)).join('');
    const worn = inv.pack.filter(id => QuilData.weapons[id]?.enemy);
    const rep = worn.length ? row(`Repair ${worn.length} goblin weapon${worn.length > 1 ? 's' : ''}`, '+1 durability each · goblin junk isn\'t bought here', PRICES.repair * worn.length + 'g', 'repair') : '';
    townScreen('place.market', 'Smith & Fletcher', `
      <p class="town-blurb">Sparks, a hammer, and a fletcher's bench under the same leaky roof. "Tomas's hatchet," the smith grunts. "Keep it sharp. It's done better work than mine."</p>
      <h4 class="shop-h">Arrows</h4>${arrows}
      <h4 class="shop-h">Weapons</h4>${weapons}
      <h4 class="shop-h">Sell loot</h4>${jewels || sellW ? jewels + sellW : '<p class="town-note">Nothing they want to buy.</p>'}
      ${rep ? '<h4 class="shop-h">Repairs</h4>' + rep : ''}`, back);
    $('town-body').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const [t, k] = b.dataset.buy.split(':');
      if (t === 'arrow') { const [n, p] = PRICES.arrows[k]; if (!spend(p)) return; inv.quiver[k] = (inv.quiver[k] || 0) + n; toast(`+${n} ${k} arrows`); }
      if (t === 'wpn') { if (!spend(PRICES.weapons[k])) return; inv.pack.push(k); toast(`Bought ${QuilData.weapons[k].name}`); }
      if (t === 'jewel') { s.hero.jewels[k]--; s.hero.gold += PRICES.jewelBuy[k] || 5; toast(`Sold a ${k}`); }
      if (t === 'sellw') { inv.pack.splice(inv.pack.indexOf(k), 1); s.hero.gold += Math.floor((PRICES.weapons[k] || 20) / 2); toast('Sold'); }
      if (t === 'repair') { if (!spend(PRICES.repair * worn.length)) return; toast('Repaired'); }
      QuilSave.save(); smith();
    });
  }

  /* ---------- Camp rest ---------- */
  async function campRest() {
    const s = ensure(S());
    if (s.items.ration <= 0) return toast('No rations: buy some in town');
    if (s.hero.hp >= s.hero.maxHp) return toast('You are already whole');
    s.items.ration--; const n = heal(5); QuilSave.save();
    await cine('scene.camp', `You eat cold biscuit by a small fire and sleep with the hatchet across your knees. It isn't much, but the bleeding stops. (+${n} HP · −1 ration)`, 'Camp', 3000);
    QuilGame.showMap();
  }

  /* ---------- In-combat item picker ---------- */
  function pickItem() {
    return new Promise(res => {
      const s = ensure(S());
      const opts = ['minor_potion', 'potion', 'bandage'].filter(k => s.items[k] > 0);
      const ov = document.createElement('div'); ov.className = 'item-ov';
      ov.innerHTML = `<div class="dice-sheet"><h3>Use an item</h3>
        ${opts.map(k => `<button class="btn" data-k="${k}">${ITEM[k].icon} ${ITEM[k].name} ×${s.items[k]} · +${ITEM[k].heal} HP</button>`).join('') || '<p style="color:#9a8a70">Your pack holds nothing useful.</p>'}
        <button class="btn ghost" data-k="">Cancel</button></div>`;
      $('app').appendChild(ov);
      ov.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { ov.remove(); res(b.dataset.k || null); });
    });
  }
  function useItem(k) { const s = S(); s.items[k]--; const n = heal(ITEM[k].heal); QuilSave.save(); return n; }

  /* ---------- Mission complete ---------- */
  function missionComplete() {
    QuilGame.showScreen('screen-complete');
    const s = S();
    const imgs = unlockedList(u => u.m === 'm1');
    const t = s.romance.tamsin;
    $('complete-root').innerHTML = `
      <div class="art-banner tall" data-art="scene.road_east"><div class="shade"></div>
        <div class="cap"><span class="cinzel" style="font-size:22px">Mission Complete</span><small>M1 · Ashes of Hollowmere</small></div></div>
      <p class="beat-narr">Hollowmere is ash and your father is in the ground, but the trail is fresh. Wagons, east, into Thornwood.</p>
      <div class="purse">${goldChip()} ${hpChip()} <span class="tag">Lv ${s.hero.level}</span>
        ${t ? `<span class="tag">Tamsin · ${t.status} (${t.affection})</span>` : ''}${s.allies.map(a => `<span class="tag">${a.name}</span>`).join('')}</div>
      <h3 class="cinzel gal-h">Images unlocked (${imgs.length})</h3>
      <div class="gal-grid">${imgs.map((g, i) => `<button class="gal-th" data-gi="${i}" data-art="${g.art}"></button>`).join('')}</div>
      <div class="choices" style="padding:14px 0">
        <button class="btn primary" id="mc-town">Go to town · King's Road Waypost</button>
        <button class="btn" id="mc-gallery">Open Gallery</button>
        <button class="btn ghost" id="mc-map">World Map</button></div>`;
    $('complete-root').querySelectorAll('.gal-th').forEach(el => { el.appendChild(QuilArt.placeholderEl(el.dataset.art)); el.onclick = () => openViewer(imgs, +el.dataset.gi); });
    QuilArt.mount($('complete-root').querySelector('.art-banner'), 'scene.road_east');
    $('mc-town').onclick = showTown; $('mc-gallery').onclick = showGallery; $('mc-map').onclick = QuilGame.showMap;
  }

  window.QuilExtras = { cine, unlock, showGallery, openViewer, showTown, campRest, pickItem, useItem, missionComplete, PRICES, ITEM, ensure, goldChip };
})();
