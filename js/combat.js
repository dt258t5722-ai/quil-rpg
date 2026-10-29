/* Combat: melee, sneak, archery, knockout, interrogate, improvised throw */
window.QuilCombat = (() => {
  let battle = null;
  let onEnd = null;

  function toast(msg) { window.QuilGame?.toast(msg); }

  let MID = 1;
  const MIS = () => QuilData['mission' + MID];
  function mkEnemy(e, i, m) {
      const proto = QuilData.enemies[e.type];
      return {
        uid: e.id,
        type: e.type,
        name: proto.name + (e.type === 'goblin_cutter' ? ` ${i + 1}` : MID === 2 && e.type === 'goblin_archer' ? ` ${i - 4}` : ''), horn: proto.traits.includes('horn'), percep: proto.percep || 0,
        artId: proto.artId,
        emoji: proto.emoji,
        hp: proto.hp, maxHp: proto.hp,
        guard: proto.guard, attack: proto.attack, dmg: proto.dmg,
        traits: [...proto.traits],
        weapon: proto.weapon,
        resolve: proto.resolve,
        stun: 0, bleed: 0, burn: 0,
        dead: false, ko: false,
        engaged: false,
        ranged: proto.traits.includes('ranged'),
        pos: (m.map.pos[e.id] || [0, 0]).slice(0, 2), facing: (m.map.pos[e.id] || [])[2] || 'W', aware: 'unaware', unseen: false,
        patrol: (m.map.patrol || {})[e.id] || null, pi: 0, pdir: 1,
        fast: proto.traits.includes('fast'), nose: proto.traits.includes('nose'), charge: proto.traits.includes('charge'), mounted: proto.traits.includes('mounted'), beast: proto.traits.includes('beast'), token: proto.token || null,
      };
  }
  function spawnMission(id) {
    MID = id || 1;
    const m = MIS();
    const enemies = m.enemies.map((e, i) => mkEnemy(e, i, m));
    const prep = (QuilSave.get().flags[MID === 2 ? 'm2Prep' : 'm1Prep'] || {});
    if (MID === 1 && prep.tracks === false) enemies.filter(e => e.ranged).forEach(e => { e.unseen = true; });
    if (MID === 1 && prep.trap === 'sprung') enemies.filter(e => ['gc1', 'gc2'].includes(e.uid)).forEach(e => { e.aware = 'suspicious'; e.facing = 'S'; });
    return {
      missionId: MID,
      round: 1,
      phase: 'approach', // approach | player | enemy | over
      approach: null,
      enemies,
      selected: null,
      log: [],
      stolenTempo: false, // after improvised throw
      fallenWeapons: [],
      stealthChain: 0,
      alerted: false,
      captives: [],
      done: false,
      quil: ((MID === 1 ? prep.tracks : prep.trap === 'spotted') ? m.map.quilCover : m.map.quil).slice(),
    };
  }

  /* ================= Tactical map & perception ================= */
  /* Balance knobs (tuned by sim/sim.js) */
  const TUNE = { range: 4, cone: 120, distDiv: 2, alertAt: 10, bodyBonus: 3, bodyRange: 1.5, beamRange: 1, beamCone: 60 };
  const DIRV = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const NOISE = { quiet: { r: 1.5, b: 0, label: 'quiet' }, loud: { r: 4, b: 2, label: 'loud' }, fire: { r: 6, b: 3, label: 'fire' } };
  const SUMP = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]; // 2d6 with 6 = 0 → sums 0..10, out of 36
  const pAtLeast = need => need <= 0 ? 1 : need > 10 ? 0 : SUMP.slice(need).reduce((a, b) => a + b, 0) / 36;
  const roll2d6z = () => { const d = () => { const v = 1 + Math.floor(Math.random() * 6); return v === 6 ? 0 : v; }; const a = d(), b = d(); return { a, b, n: a + b }; };
  const M = () => MIS().map;
  const terrainAt = (x, y) => M().terrain.find(t => t.cells.some(c => c[0] === x && c[1] === y));
  const isBlock = (x, y) => { const t = terrainAt(x, y)?.type; return t === 'building' || t === 'mound'; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const nearMound = c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => terrainAt(c[0] + dx, c[1] + dy)?.type === 'mound');
  const cellCover = c => terrainAt(...c)?.type === 'cover' || nearMound(c);
  const quilInCover = () => cellCover(battle.quil);
  const coverLabel = () => terrainAt(...battle.quil)?.type === 'cover' ? terrainAt(...battle.quil).label : 'in the lee of a charcoal mound';
  function lineClear(a, b) {
    const n = Math.ceil(dist(a, b) * 3);
    for (let i = 1; i < n; i++) {
      const x = Math.round(a[0] + (b[0] - a[0]) * i / n), y = Math.round(a[1] + (b[1] - a[1]) * i / n);
      if ((x !== a[0] || y !== a[1]) && (x !== b[0] || y !== b[1]) && isBlock(x, y)) return false;
    }
    return true;
  }
  /* Line of sight: in range (5, archer on the beam 7), inside the facing cone (120°, beam 220°), no building between */
  function canSee(e, cell) {
    const d = dist(e.pos, cell);
    if (d < 0.1) return true;
    const high = terrainAt(...e.pos)?.type === 'beam';
    if (d > (high ? TUNE.range + TUNE.beamRange : TUNE.range)) return false;
    if (d > 1.5) {
      const f = DIRV[e.facing], v = [cell[0] - e.pos[0], cell[1] - e.pos[1]];
      const cos = (f[0] * v[0] + f[1] * v[1]) / d;
      if (cos < Math.cos(((high ? TUNE.cone + TUNE.beamCone : TUNE.cone) / 2) * Math.PI / 180)) return false;
    }
    return lineClear(e.pos, cell);
  }
  function seesQuil(e) { return canSee(e, battle.quil) && !(quilInCover() && dist(e.pos, battle.quil) > 2); }
  /* Notice bonus for one witness of an event at `at` with a noise level. Null = cannot perceive it at all */
  function noticeBonus(e, at, noise) {
    const N = NOISE[noise], sE = canSee(e, at), sQ = seesQuil(e), hears = dist(e.pos, at) <= N.r;
    if (!sE && !sQ && !hears) return null;
    return (sE || sQ ? 2 : 0) + (sE && sQ ? 1 : 0) + (hears ? N.b : 0) + percOf(e) + (e.aware === 'suspicious' ? 2 : 0) + Math.min(3, Math.max(0, tension() - (battle._victimDown ? 1 : 0))) - Math.floor(dist(e.pos, at) / TUNE.distDiv);
  }
  /* Keen nose: wolves (and the wolf-rider's mount) are +2 to notice a Quil within 3 squares, sight or no sight */
  /* M2: charcoal smoke hangs over the waystation; goblin eyes are worse in it (noses are not) */
  const percOf = e => (e.percep || 0) - (e.nose ? 0 : (M().smoke || 0)) + (e.nose && battle && dist(e.pos, battle.quil) <= 3 ? 2 : 0);
  const pAlert = (e, at, noise) => { const b = noticeBonus(e, at, noise); return b === null ? 0 : pAtLeast(TUNE.alertAt - b); };
  /* Tension: after the first body drops, every unalerted goblin is +1 to notice, +1 per fallen, max +3 */
  const tension = () => Math.min(3, battle.enemies.filter(e => e.dead || e.ko).length);
  /* Horn / whistle: everyone within 6 squares becomes suspicious (a suspicious one becomes alerted) */
  function soundHorn(src, why) {
    const hit = living().filter(e => e !== src && dist(e.pos, src.pos) <= 6);
    hit.forEach(e => setAware(e, e.aware === 'unaware' ? 'suspicious' : 'alerted', true));
    log(`${src.name} ${src.horn ? 'blows its horn' : 'shrieks on a bone whistle'}${why ? ' (' + why + ')' : ''} · ${hit.length} goblin${hit.length === 1 ? '' : 's'} within 6 squares roused`, 'fail',
      src.horn ? 'A long, wet bray of a horn rolls across the square. Every goblin head comes up.' : 'A thin, ear-splitting whistle cuts through the roar of the fires.');
    if (!battle._alarmCine) { battle._alarmCine = true; battle._pendingCine = ['battle.alarm', (battle.log.slice(-1)[0] || {}).narr, `Alarm · ${src.name}${why === 'body found' ? ' found a body' : ' sounds the horn'}`]; }
  }
  async function flushCine() { const c = battle._pendingCine; if (!c) return; battle._pendingCine = null; await QuilExtras.cine(...c); }
  function setAware(e, lvl, quietly) {
    const order = { unaware: 0, suspicious: 1, alerted: 2 };
    if (order[lvl] <= order[e.aware]) return;
    e.aware = lvl; e.unseen = false;
    if (lvl === 'suspicious') e.facing = faceTo(e.pos, battle.quil);
    if (lvl === 'alerted') { e.facing = faceTo(e.pos, battle.quil); if (e.horn && !e._horned && !quietly) { e._horned = true; battle._pendingHorn = e; } }
  }
  function faceTo(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'S' : 'N'); }
  /* Everyone (except the victim) who can see or hear the event rolls 2d6* + bonus: 8+ alerted, 5–7 suspicious */
  function perceive(at, noise, exclude, why) {
    const res = [];
    battle._victimDown = !!(exclude && (exclude.dead || exclude.ko)); // the body just dropped doesn't add tension to its own witnesses
    living().forEach(e => {
      if (e === exclude || e.aware === 'alerted') return;
      const b = noticeBonus(e, at, noise);
      if (b === null) return;
      const r = roll2d6z(), tot = r.n + b;
      const before = e.aware;
      if (tot >= TUNE.alertAt) setAware(e, 'alerted'); else if (tot >= TUNE.alertAt - 3) setAware(e, 'suspicious');
      res.push(`${e.name} ${r.a}+${r.b}${b >= 0 ? '+' : ''}${b}=${tot}${e.aware !== before ? ' → ' + e.aware : ''}`);
    });
    battle._victimDown = false;
    if (res.length) log(`Perception (${NOISE[noise].label}${why ? ', ' + why : ''}) · ${res.join(' · ')}`, res.some(x => /alerted/.test(x)) ? 'fail' : '',
      res.some(x => /alerted/.test(x)) ? 'Heads snap round. Someone shrieks a warning into the smoke.' : res.some(x => /suspicious/.test(x)) ? 'A goblin stops, listening, its ears turning toward you.' : null);
    renderMap();
  }
  const anyAlerted = () => living().some(e => e.aware === 'alerted');
  function freeCell(x, y) {
    return x >= 0 && y >= 0 && x < M().cols && y < M().rows && !isBlock(x, y) && terrainAt(x, y)?.type !== 'fire' && terrainAt(x, y)?.type !== 'beam'
      && !living().some(e => e.pos[0] === x && e.pos[1] === y) && !(battle.quil[0] === x && battle.quil[1] === y);
  }
  function quilStepTo(target) {
    if (dist(battle.quil, target.pos) <= 1.5) return;
    let best = null;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const c = [target.pos[0] + dx, target.pos[1] + dy];
      if ((dx || dy) && freeCell(...c) && (!best || dist(c, battle.quil) < dist(best, battle.quil))) best = c;
    }
    if (best) battle.quil = best;
  }
  function enemyAdvance(e, steps) {
    for (let step = 0; step < (steps || 2) && dist(e.pos, battle.quil) > 1.5; step++) {
      let best = null;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const c = [e.pos[0] + dx, e.pos[1] + dy];
        if ((dx || dy) && freeCell(...c) && (!best || dist(c, battle.quil) < dist(best, battle.quil))) best = c;
      }
      if (!best || dist(best, battle.quil) >= dist(e.pos, battle.quil)) break;
      e.pos = best;
    }
    e.facing = faceTo(e.pos, battle.quil);
    e.engaged = dist(e.pos, battle.quil) <= 1.5;
  }

  /* Painted battle map (1024×576 art, 9×6 grid) with miniature tokens */
  const TOK = { quil: 'assets/art/tokens/quil.webp', cutter: 'assets/art/tokens/cutter.webp', archer: 'assets/art/tokens/archer.webp',
    troll: 'assets/art/tokens/troll.webp', wolfrider: 'assets/art/tokens/wolfrider.webp', archer2: 'assets/art/tokens/archer2.webp', cutter2: 'assets/art/tokens/cutter2.webp', ko: 'assets/art/tokens/ko.webp', dead: 'assets/art/tokens/dead.webp' };
  let mapGrid = false, mapZoom = 1;
  function mapSVG(full) {
    const m = M(), W = 1024, H = 576, CW = W / m.cols, CH = H / m.rows;
    const sel = selectedEnemy();
    const ctr = p => [p[0] * CW + CW / 2, p[1] * CH + CH / 2];
    const grid = mapGrid ? `<g class="t-grid">${Array.from({ length: m.cols + 1 }, (_, i) => `<line x1="${i * CW}" y1="0" x2="${i * CW}" y2="${H}"/>`).join('')
      + Array.from({ length: m.rows + 1 }, (_, i) => `<line x1="0" y1="${i * CH}" x2="${W}" y2="${i * CH}"/>`).join('')}
      ${m.terrain.map(t => t.cells.map(([x, y]) => `<rect class="t-hl t-${t.type}" x="${x * CW + 3}" y="${y * CH + 3}" width="${CW - 6}" height="${CH - 6}"/>`).join('')).join('')}</g>` : '';
    const cones = living().filter(e => !e.unseen).map(e => {
      const high = terrainAt(...e.pos)?.type === 'beam', R = (high ? 2.4 : 1.7) * CH, half = (high ? 110 : 60) * Math.PI / 180;
      const f = DIRV[e.facing], a0 = Math.atan2(f[1], f[0]);
      const [cx, cy] = ctr(e.pos);
      const p1 = [cx + R * Math.cos(a0 - half), cy + R * Math.sin(a0 - half)], p2 = [cx + R * Math.cos(a0 + half), cy + R * Math.sin(a0 + half)];
      return `<path class="cone cone-${e.aware}" d="M${cx} ${cy}L${p1[0]} ${p1[1]}A${R} ${R} 0 ${half * 2 > Math.PI ? 1 : 0} 1 ${p2[0]} ${p2[1]}Z"/>`;
    }).join('');
    const S = 112; // token size in map units (~40px at 360px wide)
    const token = (cx, cy, img, ring, extra, k = 1) => `<ellipse cx="${cx}" cy="${cy + S * 0.36}" rx="${S * 0.42}" ry="${S * 0.15}" class="ring ${ring}"/>
      <image href="${img}" x="${cx - S * k / 2}" y="${cy + S * 0.38 - S * k}" width="${S * k}" height="${S * k}" class="tok-img"/>${extra || ''}`;
    // draw back-to-front so lower tokens overlap upper ones
    const units = battle.enemies.slice().sort((a, b) => a.pos[1] - b.pos[1]);
    const toks = units.map(e => {
      const [cx, cy] = ctr(e.pos), down = e.dead || e.ko;
      if (e.unseen && !down) return `<g class="tok unseen"><ellipse cx="${cx}" cy="${cy + 30}" rx="40" ry="16" class="ring r-unseen"/><text x="${cx}" y="${cy + 10}" class="unseen-q">?</text></g>`;
      const v2 = MID === 2 && e.uid.endsWith('2') ? '2' : ''; // M2 mixes the new sculpts in
      const img = e.dead ? TOK.dead : e.ko ? TOK.ko : e.token ? TOK[e.token] : e.ranged ? TOK['archer' + v2] : e.type === 'goblin_brute' ? (TOK.brute || TOK.troll) : TOK['cutter' + (MID === 2 && /[246]$/.test(e.uid) ? '2' : '')];
      const ring = down ? 'r-down' : 'r-' + e.aware;
      const mark = down ? '' : e.aware === 'alerted' ? '❗' : e.aware === 'suspicious' ? '❓' : '💤';
      const pa = sel && !down && e !== sel && e.aware !== 'alerted' ? Math.round(pAlert(e, sel.pos, 'loud') * 100) : 0;
      const lab = e.type === 'wolf' ? 'Wf' : e.type === 'wolf_rider' ? (e.mounted ? 'WR' : 'R') : e.ranged ? 'A' + (MID === 2 ? e.uid.slice(-1) : '') : e.type === 'goblin_brute' ? 'B' : e.name.replace(/\D/g, '') || 'G';
      const pips = down ? '' : `<g class="pips">${Array.from({ length: e.maxHp }, (_, i) => `<rect x="${cx - e.maxHp * Math.min(10, 100 / e.maxHp) / 2 + i * Math.min(10, 100 / e.maxHp)}" y="${cy + S * 0.5}" width="${Math.min(10, 100 / e.maxHp) - 2}" height="8" class="${i < e.hp ? 'pip-on' : 'pip-off'}"/>`).join('')}</g>`;
      return `<g class="tok ${down ? 'down' : ''}${sel === e ? ' sel' : ''}" data-uid="${e.uid}">
        ${sel === e ? `<ellipse cx="${cx}" cy="${cy + S * 0.36}" rx="${S * 0.5}" ry="${S * 0.2}" class="sel-glow"/>` : ''}
        ${token(cx, cy, img, ring, '', e.type === 'goblin_brute' && !down ? 0.85 : 1)}${pips}
        ${mark ? `<text x="${cx + 34}" y="${cy - 38}" class="aw-mark">${mark}</text>` : ''}
        ${down ? '' : `<text x="${cx - 38}" y="${cy - 40}" class="tok-lab">${lab}</text>`}
        ${pa > 0 ? `<text x="${cx}" y="${cy - S * 0.66}" class="risk-t">👁 ${pa}%</text>` : ''}
        <rect x="${cx - CW / 2}" y="${cy - CH / 2 - 20}" width="${CW}" height="${CH + 20}" class="hit"/></g>`;
    }).join('');
    const [qx, qy] = ctr(battle.quil);
    const q = `<g class="tok quil">${token(qx, qy, TOK.quil, 'r-quil' + (quilInCover() ? ' covered' : ''))}</g>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="tac-svg${full ? ' full' : ''}" preserveAspectRatio="xMidYMid meet">
      <image href="${m.art || 'assets/art/battlemap_m1.webp'}" x="0" y="0" width="${W}" height="${H}"/>
      <rect class="t-bg-hit" x="0" y="0" width="${W}" height="${H}"/>${grid}${cones}${toks}${q}</svg>`;
  }
  function bindMap(host) {
    const m = M();
    host.querySelectorAll('.tok[data-uid]').forEach(g => g.onclick = ev => {
      ev.stopPropagation();
      const e = battle.enemies.find(x => x.uid === g.dataset.uid);
      if (!e) return;
      if (e.dead || e.ko) return toast(`${e.name} · ${e.dead ? 'dead' : 'knocked out'}`);
      if (e.unseen) return toast('Something moves up there…');
      battle.selected = e.uid; renderEnemies(); renderMap(); renderActions();
      toast(`${e.name} · ${e.aware} · HP ${e.hp}/${e.maxHp}`);
    });
    const qt = host.querySelector('.tok.quil'); if (qt) qt.onclick = ev => { ev.stopPropagation(); toast(`Quil${quilInCover() ? ' · in cover (' + coverLabel() + ')' : ''}`); };
    const svg = host.querySelector('svg');
    svg.querySelector('.t-bg-hit').onclick = ev => {
      const r = svg.getBoundingClientRect(), x = Math.floor((ev.clientX - r.left) / r.width * m.cols), y = Math.floor((ev.clientY - r.top) / r.height * m.rows);
      const t = terrainAt(x, y);
      toast(t ? `${t.label} · ${({ building: 'blocks movement & sight', fire: 'impassable, burning', cover: 'cover: hides you beyond 2 squares, +1 Def vs arrows', beam: 'high ground: wide, long sight', mound: 'smouldering: blocks sight & movement; next to it counts as cover' })[t.type]}${t.stump ? ' · something is wedged under its roots' : ''}` : (m.ground || 'Open cobbles'));
    };
  }
  function renderMap() {
    const wrap = document.getElementById('tac-map'); if (!wrap || !battle) return;
    wrap.innerHTML = mapSVG(false) + `<div class="tac-tools"><button class="tac-btn" id="tac-grid">${mapGrid ? '▦ Grid on' : '▦ Grid'}</button><button class="tac-btn" id="tac-expand">⤢ Expand</button></div>`;
    bindMap(wrap);
    wrap.querySelector('#tac-grid').onclick = () => { mapGrid = !mapGrid; renderMap(); };
    wrap.querySelector('#tac-expand').onclick = () => openFullMap();
    const fm = document.getElementById('tac-full');
    if (fm) { fm.querySelector('.tf-stage').innerHTML = mapSVG(true); bindMap(fm.querySelector('.tf-stage')); fm.querySelector('.tf-stage').style.width = Math.round(mapZoom * fm.clientWidth) + 'px'; }
    const sel = selectedEnemy();
    const lg = document.getElementById('tac-legend');
    if (lg) {
      const rows = sel ? living().filter(e => e !== sel && !e.unseen && e.aware !== 'alerted').map(e => {
        const q = Math.round(pAlert(e, sel.pos, 'quiet') * 100), l = Math.round(pAlert(e, sel.pos, 'loud') * 100);
        return `<span class="lg-row${l >= 50 ? ' hi' : ''}">${e.name.replace('Goblin ', '')}: quiet ${q}% · loud ${l}%</span>`;
      }).join('') : '';
      lg.innerHTML = sel ? `<b>Target: ${sel.name}</b> · ${sel.aware}${sel.aware === 'unaware' ? ' (ambush +1 hit/+1 dmg; takedown from behind −2)' : ''}${quilInCover() ? ' · Quil in cover' : ''}<br><span class="lg-h">Chance to raise the alarm if you attack it:</span> ${rows || '<span class="lg-row">nobody else can notice</span>'}` : '';
    }
    const sum = document.querySelector('#tac-wrap summary .tac-sum');
    if (sum) sum.textContent = `${living().filter(e => e.aware === 'alerted').length} alerted · ${living().filter(e => e.aware === 'suspicious').length} suspicious · ${living().filter(e => e.aware === 'unaware').length} unaware`;
  }
  function openFullMap() {
    let fm = document.getElementById('tac-full');
    if (!fm) {
      fm = document.createElement('div'); fm.id = 'tac-full';
      fm.innerHTML = `<div class="tf-top"><span class="cinzel">${M().title || 'Hollowmere Square'}</span><span><button class="tac-btn" data-z="-1">−</button><button class="tac-btn" data-z="1">+</button><button class="vw-close" id="tf-close">✕</button></span></div>
        <div class="tf-scroll"><div class="tf-stage"></div></div><div class="tf-hint">Tap a goblin to target it, or tap the ground to identify terrain. Use + and − to zoom, then drag to pan.</div>`;
      document.getElementById('app').appendChild(fm);
      fm.querySelector('#tf-close').onclick = () => fm.remove();
      fm.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { mapZoom = Math.max(1, Math.min(3, mapZoom + (+b.dataset.z) * 0.5)); renderMap(); });
    }
    renderMap();
  }

  function living() { return battle.enemies.filter(e => !e.dead && !e.ko); }
  function fallen() { return battle.enemies.filter(e => e.dead || e.ko); }
  function meleeEngagers() {
    return living().filter(e => e.engaged && !e.ranged);
  }
  function anyMeleeEngaging() {
    return meleeEngagers().length > 0;
  }

  /* log(mechanical, cls, narration). Narration is shown large; numbers go in a small line beneath. */
  function log(msg, cls, narr) {
    battle.log.push({ msg, cls, narr, t: Date.now() });
    renderLog();
  }
  const wName = () => QuilData.weapons[QuilSave.get().inventory.mainHand].name.replace(/^Tomas's /, 'your father\'s ').toLowerCase().replace(/^goblin/, 'the goblin');
  const wCap = () => { const w = wName(); return w.charAt(0).toUpperCase() + w.slice(1); };
  function rollTxt(r) { return r ? ` · roll ${r.natural}${r.modTotal ? '+' + r.modTotal : ''}=${r.total} vs ${r.target}` : ''; }

  /* Cinematic kill card: first of each type, criticals, the final kill, else ~35% */
  const KILL_ART = { wolfrider: ['battle.kill_wolfrider', 'Kill · The Wolf-Rider'], takedown: ['battle.takedown', 'Silent Takedown'], melee: ['battle.kill_melee', 'Kill · Hatchet'], arrow: ['battle.kill_arrow', 'Kill · Arrow'], throw: ['battle.kill_throw', 'Kill · Improvised Throw'] };
  async function killCine(kind, crit) {
    const s = QuilSave.get(); s.flags.cineSeen = s.flags.cineSeen || {};
    if (battle._lastKill && battle._lastKill.type === 'wolf_rider' && !battle._wrCine) { kind = 'wolfrider'; battle._wrCine = true; }
    const first = !s.flags.cineSeen[kind], final = living().length === 0;
    if (!(first || crit || final || kind === 'wolfrider' || Math.random() < 0.35)) return;
    s.flags.cineSeen[kind] = 1; QuilSave.save();
    const narr = (battle.log.filter(l => l.narr).slice(-1)[0] || {}).narr || '';
    const [art, cap] = KILL_ART[kind];
    await QuilExtras.cine(art, narr, (crit ? 'Critical ' : '') + cap + (final ? ' · Last foe' : ''));
  }

  function roundRecap() {
    const h = QuilSave.get().hero;
    const others = [];
    if (battle.missionId === 1) {
      const lines = [
        "Above the square, in the dark of the mill loft, someone is holding very still and listening to every scream.",
        "A flour-white face shows at the mill-loft shutter for half a heartbeat, then vanishes. Someone up there is still alive.",
      ];
      others.push({ name: 'The Mill Loft', text: lines[battle.round % lines.length] });
    } else if (battle.missionId === 2) {
      const lines = [
        "Behind the wolf pen someone is swearing, low and steady and astonishingly inventive, at a padlock.",
        "From the pen comes a woman's voice, dry as old bark: \"Whoever you are, do try not to die before you reach the key.\"",
        "The wolves in the pen pace and whine at the smell of blood. A woman's voice hushes them, as if they were hers.",
      ];
      others.push({ name: 'The Wolf Pen', text: lines[battle.round % lines.length] });
    }
    const r = QuilNarrate.recap(battle, h, others);
    battle.log.push({ recap: true, round: battle.round, data: r, t: Date.now() });
    renderLog();
  }

  function esc(t) { return String(t); }
  function renderLog() {
    const el = document.getElementById('combat-log');
    if (!el) return;
    const items = battle.log.slice(-60);
    const lastRecap = items.map(l => !!l.recap).lastIndexOf(true);
    el.innerHTML = items.map((l, i) => {
      if (l.recap) {
        const d = l.data;
        const ent = d.enemies.map(e => `<p class="rc-ent rc-${e.state}"><b>${e.name}</b> ${e.text.replace(e.name, '').trim()}</p>`).join('');
        const oth = d.others.map(o => `<p class="rc-ent rc-other"><b>${o.name}</b> ${o.text}</p>`).join('');
        return `<details class="recap"${i === lastRecap ? ' open' : ''}><summary>Round ${l.round} · the field</summary>
          <p class="rc-ent rc-quil"><b>Quil</b> ${d.quil.replace(/^Quil /, '')}</p>${ent}${oth}</details>`;
      }
      if (l.narr) return `<div class="entry ${l.cls || ''}"><div class="narr">${esc(l.narr)}</div><div class="mech">${esc(l.msg)}</div></div>`;
      return `<div class="entry mech-only ${l.cls || ''}">${esc(l.msg)}</div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  function renderEnemies() {
    const box = document.getElementById('combat-enemies');
    box.innerHTML = '';
    battle.enemies.forEach(e => {
      const card = document.createElement('div');
      card.className = 'enemy-card'
        + (e.dead || e.ko ? ' dead' : '')
        + (e.engaged ? ' engaged' : '')
        + (battle.selected === e.uid ? ' selected' : '') + (e.unseen && !e.dead && !e.ko ? ' unseen' : '');
      card.dataset.uid = e.uid;
      const pct = Math.max(0, (e.hp / e.maxHp) * 100);
      const status = [];
      if (e.ko) status.push('KO');
      if (e.dead) status.push('Dead');
      if (e.bleed) status.push(`Bleed ${e.bleed}`);
      if (e.burn) status.push(`Burn ${e.burn}`);
      if (e.stun) status.push(`Stun ${e.stun}`);
      if (e.engaged) status.push('Melee');
      if (!e.dead && !e.ko) status.push(e.aware === 'alerted' ? '❗ Alerted' : e.aware === 'suspicious' ? '❓ Suspicious' : '💤 Unaware');
      card.innerHTML = `
        <div class="enemy-art" data-art="${e.artId}"></div>
        <div class="enemy-info">
          <div class="ename">${e.name}</div>
          <div class="hp-bar"><i style="width:${pct}%"></i></div>
          <div class="enemy-stats"><span>HP ${Math.max(0,e.hp)}/${e.maxHp}</span>
            <span>Guard ${e.guard}</span><span>Atk ${e.attack}</span></div>
          <div class="status-pips">${status.join(' · ')}</div>
        </div>`;
      card.onclick = () => {
        if (e.dead || e.ko) return;
        if (e.unseen) return;
        battle.selected = e.uid;
        renderEnemies(); renderMap(); renderActions();
      };
      box.appendChild(card);
      QuilArt.mount(card.querySelector('.enemy-art'), e.artId);
    });
  }

  function renderHero() {
    const s = QuilSave.get();
    const h = s.hero;
    const q = s.inventory.quiver;
    const arrow = s.inventory.selectedArrow;
    const totalArrows = Object.values(q).reduce((a, b) => a + b, 0);
    document.getElementById('combat-hero').innerHTML = `
      <div class="hp">Quil · HP <strong>${h.hp}/${h.maxHp}</strong></div>
      <div class="arrows">🏹 ${totalArrows} · ${arrow} ×${q[arrow] || 0}
        ${battle.stolenTempo ? ' · <span style="color:var(--ember)">Tempo lost</span>' : ''}
        · R${battle.round}</div>`;
  }

  function renderActions() {
    const wheel = document.getElementById('action-wheel');
    const sel = battle.phase !== 'over' && living().length ? selectedEnemy() : null;
    const tn = sel ? sel.name.replace('Goblin ', '') : '';
    if (battle.phase === 'approach') {
      wheel.innerHTML = `
        <div class="opener-h">Choose your opener · tap a token on the map to pick the target (${tn})</div>
        <button class="btn danger opener" data-act="assault" style="grid-column:span 4">⚔️ Open Assault <small>free volley, then every goblin is alerted</small></button>
        <button class="btn primary opener" data-act="sneak" style="grid-column:span 2">🤫 Melee Stealth <small>takedown ${tn} · Edge vs ${stealthTarget(sel)}</small></button>
        <button class="btn moss opener" data-act="hidden" style="grid-column:span 2">🏹 Ranged Stealth <small>hidden shot ${tn} · Edge vs ${sel ? sel.guard : '-'}, +1</small></button>
        <button class="btn ghost" data-act="watch" style="grid-column:span 4;min-height:34px">🕯 Wait and watch the patrols (${3 - (battle._watched || 0)} left)</button>`;
    } else if (battle.phase === 'player') {
      const canThrow = !anyMeleeEngaging() && fallen().length > 0 && living().length > 0;
      const stealthy = sel && sel.aware !== 'alerted';
      wheel.innerHTML = `
        <button class="btn ${stealthy ? 'primary' : ''}" data-act="sneak" ${stealthy ? '' : 'disabled'}>🤫 Takedown</button>
        <button class="btn" data-act="strike">⚔️ Strike</button>
        <button class="btn ${stealthy ? 'moss' : ''}" data-act="shoot">🏹 ${stealthy ? 'Hidden shot' : 'Shoot'}</button>
        <button class="btn" data-act="subdue">💤 ${stealthy ? 'Choke out' : 'Subdue'}</button>
        <button class="btn ${canThrow ? 'primary' : ''}" data-act="throw" ${canThrow ? '' : 'disabled'}>🎯 Throw</button>
        <button class="btn" data-act="grab">✊ Grab</button>
        <button class="btn" data-act="arrow">⇄ Arrow</button>
        <button class="btn" data-act="item">🧪 Item</button>
        <button class="btn ghost" data-act="wait" style="min-height:34px" ${anyAlerted() ? 'disabled' : ''}>🕯 Wait</button>
        <button class="btn ghost" data-act="slip" style="grid-column:span 2;min-height:34px" ${anyAlerted() ? 'disabled' : ''}>🫥 Slip into cover</button>
        <button class="btn ghost" data-act="flee" style="min-height:34px">Flee</button>`;
    } else {
      wheel.innerHTML = `<button class="btn" disabled style="grid-column:span 4">…</button>`;
    }
    wheel.querySelectorAll('[data-act]').forEach(b => {
      b.onclick = () => handleAction(b.dataset.act);
    });
  }
  function stealthTarget(t) {
    if (!t) return 6;
    const crowded = living().some(o => o !== t && dist(o.pos, t.pos) <= 1.5);
    // Edge vs 7 · +2 suspicious · +2 next to another goblin · −2 from behind (it can't see you) · −2 after a Whistler
    return 7 + (t.aware === 'suspicious' ? 2 : 0) + (crowded ? 2 : 0) - (seesQuil(t) ? 0 : 2) - (battle._sneakBonus ? 2 : 0);
  }

  function selectedEnemy() {
    return battle.enemies.find(e => e.uid === battle.selected && !e.dead && !e.ko && !e.unseen)
      || living().filter(e => !e.unseen).sort((a, b) => dist(a.pos, battle.quil) - dist(b.pos, battle.quil))[0] || living()[0];
  }

  function modsFor(kind) {
    const h = QuilSave.get().hero;
    const inv = QuilSave.get().inventory;
    if (kind === 'melee') {
      const w = QuilData.weapons[inv.mainHand];
      return [
        { label: 'Might', value: h.might },
        { label: w.name + ' Acc', value: w.acc || 0 },
      ];
    }
    if (kind === 'ranged') {
      const w = QuilData.weapons[inv.bow];
      const arrow = QuilData.arrows[inv.selectedArrow];
      const mods = [
        { label: 'Edge', value: h.edge },
        { label: (w?.name || 'Bow') + ' Acc', value: w?.acc || 0 },
      ];
      return mods;
    }
    if (kind === 'defence') {
      return [
        { label: 'Grit', value: h.grit },
        ...((QuilSave.get().allies || []).some(a => a.id === 'bram') ? [{ label: 'Old Bram', value: 1 }] : []),
        { label: 'Armour', value: 0 },
      ];
    }
    if (kind === 'sneak') {
      return [{ label: 'Edge', value: h.edge }];
    }
    if (kind === 'throw') {
      return [{ label: 'Might', value: h.might }];
    }
    return [];
  }

  /* Variable damage: each weapon has a band [lo, hi]; roll uniformly inside it (+ arrow shift, + Might/2 in melee).
     Tiers: graze < 30% max HP ≤ embedded < 60% ≤ deep; vital = a natural-10 crit or damage ≥ remaining HP (a kill). */
  function weaponDamage(weaponId, natural, melee, arrowId) {
    const w = QuilData.weapons[weaponId];
    const [lo, hi] = w.dmg || [w.base, w.base + 4];
    const shift = arrowId ? (QuilData.arrows[arrowId].dmgShift || 0) : 0;
    const mightPart = melee ? Math.floor(QuilSave.get().hero.might / 2) : 0;
    return lo + Math.floor(Math.random() * (hi - lo + 1)) + shift + mightPart;
  }
  function hitTier(dmg, t, crit) {
    if (crit || dmg >= t.hp) return 'vital';
    const f = dmg / t.maxHp;
    return f >= 0.6 ? 'deep' : f >= 0.3 ? 'embedded' : 'graze';
  }
  const TIER_LABEL = { graze: 'Graze', embedded: 'Embedded', deep: 'Deep wound', vital: 'VITAL' };
  const TIERN = {
    arrow: {
      graze: ['The arrow skins {e} along the ribs and skips away across the cobbles, leaving a red line and a furious goblin.', 'Your shaft clips {e}\'s ear and pins it a moment to the dark. It yelps and tears free.', 'The arrow scores {e}\'s shoulder, a shallow, stinging cut that only makes it angrier.'],
      embedded: ['The arrow buries itself in the meat of {e}\'s thigh with a wet thock. It staggers, snarling at the fletching.', 'Your shaft sinks into {e}\'s shoulder and sticks there, quivering, deep in the muscle.', '{e} jerks as the arrow lodges in its hip, half the shaft swallowed by green flesh.'],
      deep: ['The broad head punches deep into {e}\'s gut. It folds around the shaft, black blood spilling over its fingers.', 'Your arrow goes in under {e}\'s collarbone and nearly out the back. It reels, gasping, barely standing.', 'The shaft drives through {e}\'s side and grates on bone. It sways, grey-faced, one breath from falling.'],
      vital: ['The arrow takes {e} through the throat. It drops without a sound, fingers scrabbling at the shaft, and goes still.', 'Your shaft finds {e}\'s eye. Its head snaps back and it is dead before it hits the stones.', 'The arrow opens the great vein in {e}\'s neck. A dark fan of blood, a gurgle, and nothing more.'],
    },
    blade: {
      graze: ['Your {w} glances off {e}\'s scrap armour and opens a thin line across its forearm.', 'You catch {e} with the edge of the {w}, a nick across the cheek that spits blood but stops nothing.', 'The {w} slaps {e} on the flat. It reels, more insulted than hurt.'],
      embedded: ['The {w} bites into {e}\'s shoulder and sticks. You wrench it free with a sucking sound.', 'You chop into {e}\'s thigh. It howls and hops back on one leg.', 'The blow sinks into {e}\'s side between the ribs and comes out red to the haft.'],
      deep: ['The {w} splits {e}\'s collarbone. Its arm hangs useless and it screams through its needle teeth.', 'You hack deep into {e}\'s belly. It doubles over, holding itself together with both hands.', 'The {w} opens {e} from hip to ribs. It is still standing, somehow, but only just.'],
      vital: ['The {w} comes down where neck meets shoulder. {e} drops like a cut sack of grain.', 'You bury the {w} in {e}\'s skull with a crack like splitting kindling. It is dead on its feet.', 'One stroke opens {e}\'s throat to the spine. It folds, and the square is one goblin quieter.'],
    },
  };
  const tierNarr = (kind, tier, ctx) => { const pool = TIERN[kind][tier]; return pool[Math.floor(Math.random() * pool.length)].replace(/\{e\}/g, ctx.e).replace(/\{w\}/g, ctx.w || 'blade'); };

  async function handleAction(act) {
    if (battle.phase === 'approach') {
      if (act === 'watch') {
        if ((battle._watched || 0) >= 3) return toast('Waiting any longer would be a risk');
        battle._watched = (battle._watched || 0) + 1;
        log('Wait and watch', '', MID === 2 ? 'You lie flat in the bracken at the forest edge and count them: the platforms, the fire, the wolf that lifts its head and tastes the wind.' : 'You crouch in the smoke at the edge of the square and watch the goblins walk their loot-rounds.');
        battle.phase = 'enemy'; await enemyTurn();
        if (battle.phase === 'player' && !anyAlerted()) battle.phase = 'approach';
        renderAll(); return;
      }
      if (!['sneak', 'hidden', 'assault'].includes(act)) return;
      battle.phase = 'player';
      if (act === 'sneak') { battle.approach = 'melee-stealth'; log('Opener · Melee Stealth', '', QuilNarrate.pick(MID === 2 ? 'sneak_begin_m2' : 'sneak_begin')); await doSneak(); }
      else if (act === 'hidden') { battle.approach = 'ranged-stealth'; log('Opener · Ranged Stealth', '', MID === 2 ? 'You nock an arrow in the bracken at the treeline and wait for the charcoal smoke to thin across your mark.' : 'You nock an arrow behind the chapel corner and pick your mark through the smoke.'); await doShoot(); }
      else await doAssault();
      return;
    }
    if (battle.phase !== 'player') return;

    switch (act) {
      case 'strike': await doStrike(false); break;
      case 'shoot': await doShoot(); break;
      case 'subdue': if (selectedEnemy()?.aware !== 'alerted') await doSneak(true); else await doStrike(true); break;
      case 'sneak': await doSneak(); break;
      case 'grab': await doGrab(); break;
      case 'throw': await doImprovisedThrow(); break;
      case 'arrow': cycleArrow(); break;
      case 'item': await doItem(); break;
      case 'flee': await doFlee(); break;
      case 'slip': await doSlip(); break;
      case 'wait': if (!anyAlerted()) { log('You hold still in the smoke and let them move', '', 'You press your back to the stones and breathe through your mouth, waiting for the patrols to turn away.'); await afterPlayerAction(); } break;
    }
  }

  /* Stealth takedown: Edge vs 6 (+2 suspicious, +1 if it can see you coming). Success auto-hits: a silent kill (or a
     choke-out KO). Failure: the target is alerted and the scuffle is a loud event for everyone else. */
  async function doSneak(choke) {
    const prey = selectedEnemy();
    if (!prey) return;
    if (prey.aware === 'alerted') return toast('It has seen you. No takedown');
    battle.selected = prey.uid;
    const target = stealthTarget(prey);
    battle._sneakBonus = 0;
    const roll = await QuilDice.promptRoll({ title: `${choke ? 'Choke out' : 'Takedown'}: ${prey.name}`, target, modifiers: modsFor('sneak') });
    quilStepTo(prey);
    if (roll.outcome === 'fumble' || roll.outcome === 'fail') {
      setAware(prey, 'alerted'); prey.engaged = true;
      log(`Takedown failed${rollTxt(roll)} · loud grapple · ${prey.name} alerted`, 'fail', QuilNarrate.pick('sneak_fail'));
      perceive(prey.pos, 'loud', prey, 'grapple');
      renderAll();
      return afterPlayerAction();
    }
    if (choke) {
      prey.ko = true; prey.hp = 0; prey.engaged = false;
      if (prey.beast) { prey.dead = true; prey.ko = false; }
      log(`Choke-out · ${prey.name} ${prey.beast ? 'throttled' : 'KO'}${rollTxt(roll)}`, 'ok', QuilNarrate.pick('sneak_ko', { e: prey.name, w: wName() }));
      if (!prey.beast) battle.captives.push(prey.uid); if (prey.weapon) battle.fallenWeapons.push(prey.weapon);
    } else {
      const inv = QuilSave.get().inventory;
      const dmg = weaponDamage(inv.mainHand, roll.natural, true) + 4 + (prey.aware === 'unaware' ? 1 : 0);
      // A strong or critical takedown is a vital strike (throat, spine): it kills anything short of a boss
      if (roll.outcome !== 'critical' && roll.outcome !== 'strong' && dmg < prey.hp) {
        prey.hp -= dmg; setAware(prey, 'alerted'); prey.engaged = true;
        log(`Takedown · ${dmg} dmg but ${prey.name} survives (${prey.hp}/${prey.maxHp}) · loud grapple${rollTxt(roll)}`, 'fail',
          `You get the ${wName()} into ${prey.name} from behind, but it is too big to drop. It bellows and twists in your grip.`);
        perceive(prey.pos, 'loud', prey, 'grapple');
        renderAll();
        return afterPlayerAction();
      }
      prey.dead = true; prey.hp = 0; prey.engaged = false; battle._lastKill = prey;
      log(`Silent kill · ${prey.name} · ${dmg >= prey.maxHp ? dmg : 'vital'} dmg${rollTxt(roll)}`, 'crit', QuilNarrate.pick('sneak_kill', { e: prey.name, w: wName() }));
      if (prey.weapon) battle.fallenWeapons.push(prey.weapon);
      await killCine(prey.type === 'wolf_rider' ? 'wolfrider' : 'takedown', roll.outcome === 'critical');
    }
    perceive(prey.pos, 'quiet', prey, 'takedown');
    checkWolf(); await flushCine();
    renderAll();
    if (living().length === 0) return endCombat(true);
    await afterPlayerAction();
  }

  async function doAssault() {
    battle.approach = 'assault';
    log('Opener · Open Assault · free volley · all alerted', 'ok', QuilNarrate.pick(MID === 2 ? 'assault_m2' : 'assault'));
    living().forEach(e => setAware(e, 'alerted'));
    // Free volley at archer preference or first
    const inv = QuilSave.get().inventory;
    if ((inv.quiver[inv.selectedArrow] || 0) > 0) {
      battle.selected = (living().find(e => e.ranged) || living()[0]).uid;
      await doShoot(true);
    }
    living().filter(e => !e.ranged).forEach(enemyAdvance);
    if (living().length === 0) return endCombat(true);
    battle.phase = 'player';
    renderAll();
  }

  async function doStrike(subdue) {
    const target = selectedEnemy();
    if (!target) return toast('No target');
    battle.selected = target.uid;
    quilStepTo(target);
    const amb = target.aware === 'unaware' ? 1 : 0;
    const inv = QuilSave.get().inventory;
    const w = QuilData.weapons[inv.mainHand];
    const mods = modsFor('melee');
    if (subdue) mods.push({ label: 'Subdue', value: -1 });
    if (amb) mods.push({ label: 'Ambush (unaware)', value: amb });
    const wasAware = target.aware;
    setAware(target, 'alerted'); target.engaged = true;
    const roll = await QuilDice.promptRoll({
      title: subdue ? `Subdue ${target.name}` : `Strike ${target.name}`,
      target: target.guard,
      modifiers: mods,
    });
    const ctx = { e: target.name, w: wName() };
    if (roll.outcome === 'fumble') {
      log(`Gravedice${rollTxt(roll)} · ${target.name} counters`, 'fail', QuilNarrate.pick('melee_fumble', ctx));
      await hitQuil(target, 1.5);
    } else if (roll.outcome === 'fail') {
      log(`Miss${rollTxt(roll)}`, 'fail', QuilNarrate.pick(subdue ? 'subdue_miss' : 'melee_miss', ctx));
    } else {
      let dmg = weaponDamage(inv.mainHand, roll.natural, true) + (wasAware === 'unaware' ? 1 : 0);
      if (roll.outcome === 'critical' && subdue) dmg *= 2;
      if (subdue) {
        target.stun += dmg;
        const ko = target.stun >= target.hp;
        log(`Subdue · ${dmg} Stun (total ${target.stun}/${target.hp})${rollTxt(roll)}${ko ? ' · KO' : ''}`, ko ? 'crit' : 'ok', QuilNarrate.pick(ko ? 'subdue_ko' : 'subdue_hit', ctx));
        if (ko) {
          target.ko = true; target.hp = 0;
          if (target.beast) { target.ko = false; target.dead = true; } else battle.captives.push(target.uid);
          if (target.weapon) battle.fallenWeapons.push(target.weapon);
          checkWolf();
        }
      } else {
        const crit = roll.outcome === 'critical';
        const tier = hitTier(dmg, target, crit);
        if (tier === 'vital') dmg = Math.max(dmg, target.hp);
        const kill = target.hp - dmg <= 0;
        log(`${TIER_LABEL[tier]} · ${dmg} dmg${kill ? ' · kill' : ` · ${target.name} ${Math.max(0, target.hp - dmg)}/${target.maxHp}`}${rollTxt(roll)}`, kill ? 'crit' : 'ok', tierNarr('blade', tier, ctx));
        applyDamage(target, dmg);
        if (target.dead) await killCine('melee', crit);
      }
    }
    perceive(target.pos, 'loud', target, 'open melee');
    renderAll(); await flushCine();
    if (living().length === 0) return endCombat(true);
    await afterPlayerAction();
  }

  function applyDamage(target, dmg) {
    target.hp -= dmg;
    if (target.hp <= 0) {
      target.hp = 0; target.dead = true; target.engaged = false;
      if (target.weapon) battle.fallenWeapons.push(target.weapon);
    }
    battle._lastKill = target.dead ? target : null;
    checkWolf();
  }
  /* The Wolf-Rider: below half HP (or dropped outright) it is unhorsed and the wolf fights on as its own 10 HP enemy.
     Whoever brings the rider down (dead or senseless) gets the cage key off its belt. */
  function checkWolf() {
    battle.enemies.filter(e => e.type === 'wolf_rider').forEach(r => {
      if ((r.dead || r.ko) && !battle.wolfKey) { battle.wolfKey = true; log('The cage key hangs from the Wolf-Rider\'s belt', 'ok', QuilNarrate.pick('wr_key', { e: r.name })); }
      if (!r.mounted || !(r.dead || r.ko || r.hp < r.maxHp / 2)) return;
      r.mounted = false; r.fast = false; r.nose = false; r.charge = false;
      if (!r.dead && !r.ko) { r.name = 'Unhorsed Wolf-Rider'; r.guard = 5; r.attack = 6; r.dmg = 4; }
      const m = MIS(), wolf = mkEnemy({ type: 'wolf', id: 'wf1' }, 0, m);
      let spot = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0]]) { const c = [r.pos[0] + dx, r.pos[1] + dy]; if (freeCell(...c)) { spot = c; break; } }
      wolf.pos = spot || r.pos.slice(); wolf.facing = faceTo(wolf.pos, battle.quil);
      const silent = (r.dead || r.ko) && r.aware !== 'alerted' && !anyAlerted();
      wolf.aware = silent ? 'unaware' : 'alerted'; if (silent) wolf.facing = ({ N: 'S', S: 'N', E: 'W', W: 'E' })[wolf.facing]; wolf.engaged = dist(wolf.pos, battle.quil) <= 1.5;
      battle.enemies.push(wolf);
      log(r.dead || r.ko ? `The wolf throws its fallen rider · Grey Wolf (10 HP) fights on${silent ? ' · it bolts, nose to the ash' : ''}` : `Unhorsed! ${r.name} is thrown · Grey Wolf (10 HP) fights on`, 'fail',
        QuilNarrate.pick(r.dead || r.ko ? 'wr_rider_down' : 'wr_unhorse', { e: r.name }));
      if (!battle._wolfCine) { battle._wolfCine = true; battle._pendingCine = ['enemy.wolf_rider', (battle.log.slice(-1)[0] || {}).narr, r.dead || r.ko ? 'The wolf fights on' : 'Unhorsed · the wolf fights on']; }
    });
  }

  async function doShoot(freeVolley) {
    const inv = QuilSave.get().inventory;
    const arrowId = inv.selectedArrow;
    const arrow = QuilData.arrows[arrowId];
    if ((inv.quiver[arrowId] || 0) <= 0) {
      toast('No arrows of that type');
      return;
    }
    const target = selectedEnemy();
    if (!target) return toast('No target');
    battle.selected = target.uid;

    if (arrow.noDamage) {
      inv.quiver[arrowId]--;
      QuilSave.save();
      log('Whistler · next Sneak +2', 'ok', QuilNarrate.pick('whistler', { e: target.name }));
      battle._sneakBonus = (battle._sneakBonus || 0) + 2;
      if (!freeVolley) await afterPlayerAction();
      renderAll();
      return;
    }

    const mods = modsFor('ranged');
    const hidden = target.aware !== 'alerted';
    const wasAware = target.aware;
    if (wasAware === 'unaware') mods.push({ label: 'Unaware', value: 1 });
    const noise = arrowId === 'fire' ? 'fire' : 'quiet';
    const roll = await QuilDice.promptRoll({
      title: `${hidden ? 'Hidden shot' : 'Shoot'} ${target.name} (${arrow.name})`,
      target: target.guard,
      modifiers: mods,
    });
    inv.quiver[arrowId]--;
    QuilSave.save();

    const actx = { e: target.name, a: arrow.name.toLowerCase() };
    if (roll.outcome === 'fumble' || roll.outcome === 'fail') {
      log(`${arrow.name} · miss${rollTxt(roll)}`, 'fail', QuilNarrate.pick(roll.outcome === 'fumble' ? 'arrow_fumble' : 'arrow_miss', actx));
    } else {
      let dmg = weaponDamage(inv.bow, roll.natural, false, arrowId) + (wasAware === 'unaware' ? 1 : 0);
      if (arrow.stun) {
        target.stun += dmg;
        const ko = target.stun >= target.hp;
        log(`Blunt · ${dmg} Stun (total ${target.stun}/${target.hp})${rollTxt(roll)}${ko ? ' · KO' : ''}`, ko ? 'crit' : 'ok', QuilNarrate.pick(ko ? 'arrow_ko' : 'arrow_hit_blunt', actx));
        if (ko) {
          target.ko = true; target.hp = 0;
          if (target.beast) { target.ko = false; target.dead = true; } else battle.captives.push(target.uid);
          if (target.weapon) battle.fallenWeapons.push(target.weapon);
          checkWolf();
        }
      } else {
        if (arrow.bleed) { target.bleed = (target.bleed || 0) + arrow.bleed; }
        if (arrow.burn) { target.burn = arrow.burn; target._burnRounds = arrow.burnRounds; }
        if (arrow.guardDrop) target.guard = Math.max(1, target.guard - arrow.guardDrop);
        const crit = roll.outcome === 'critical';
        const tier = hitTier(dmg, target, crit);
        if (tier === 'vital') dmg = Math.max(dmg, target.hp);
        const kill = target.hp - dmg <= 0;
        const extra = arrow.bleed ? ` · bleed ${arrow.bleed}` : arrow.burn ? ` · burn ${arrow.burn}×${arrow.burnRounds}` : '';
        log(`${arrow.name} · ${TIER_LABEL[tier]} · ${dmg} dmg${kill ? (hidden ? ' · silent kill' : ' · kill') : ` · ${target.name} ${Math.max(0, target.hp - dmg)}/${target.maxHp}`}${extra}${rollTxt(roll)}`, kill ? 'crit' : 'ok', tierNarr('arrow', tier, actx));
        applyDamage(target, dmg);
        if (target.dead) await killCine('arrow', crit);
      }
    }
    await flushCine();
    if (target.dead || target.ko) perceive(target.pos, noise, target, hidden ? 'hidden kill' : 'arrow kill');
    else {
      if (target.aware !== 'alerted') log(roll.outcome === 'fail' || roll.outcome === 'fumble' ? `${target.name} sees where the arrow came from` : `${target.name} screams · wounded, alerted`, 'fail',
        roll.outcome === 'fail' || roll.outcome === 'fumble' ? null : `${target.name} shrieks and claws at the shaft in its side, pointing straight at your hiding place.`);
      setAware(target, 'alerted');
      perceive(target.pos, noise === 'fire' ? 'fire' : 'loud', target, roll.outcome === 'fail' || roll.outcome === 'fumble' ? 'miss' : 'wounded');
    }
    renderAll();
    if (living().length === 0) return endCombat(true);
    if (!freeVolley) await afterPlayerAction();
  }

  async function doGrab() {
    if (fallen().length === 0) return toast('No fallen enemies');
    const wpn = battle.fallenWeapons.pop();
    if (!wpn) return toast('No weapon to grab');
    const w = QuilData.weapons[wpn];
    const inv = QuilSave.get().inventory;
    inv.pack.push(wpn);
    // Optionally equip
    if (w.type === 'melee' && confirm(`Equip ${w.name}? (replaces ${QuilData.weapons[inv.mainHand].name})`)) {
      inv.pack.push(inv.mainHand);
      inv.mainHand = wpn;
      inv.pack = inv.pack.filter(x => x !== wpn);
    }
    QuilSave.save();
    log(`Grabbed ${w.name}`, 'ok', QuilNarrate.pick('grab', { t: w.name.toLowerCase().replace(/^goblin/, 'a goblin') }));
    await afterPlayerAction();
  }

  async function doImprovisedThrow() {
    if (anyMeleeEngaging()) {
      toast('An enemy engages you in melee — no open tempo');
      return;
    }
    if (fallen().length === 0 || battle.fallenWeapons.length === 0) {
      toast('Need a fallen enemy\'s weapon');
      return;
    }
    const target = selectedEnemy();
    if (!target) return toast('No target');
    const wpnId = battle.fallenWeapons.pop();
    const w = QuilData.weapons[wpnId];
    const mods = modsFor('throw');
    if (w.acc < 0) mods.push({ label: 'Heavy throw', value: -1 });

    const tctx = { e: target.name, t: 'the ' + w.name.toLowerCase() };
    log(`Improvised Throw · ${w.name} (costs tempo)`, '', QuilNarrate.pick('throw_begin', { t: 'a ' + w.name.toLowerCase() }));
    const roll = await QuilDice.promptRoll({
      title: `Throw ${w.name} at ${target.name}`,
      target: target.guard,
      modifiers: mods,
    });

    if (roll.outcome === 'fumble' || roll.outcome === 'fail') {
      log(`Throw · miss · weapon lost${rollTxt(roll)}`, 'fail', QuilNarrate.pick('throw_miss', tctx));
    } else {
      // Base + floor(nat*scale) + floor(Might/2) + 2
      const h = QuilSave.get().hero;
      let dmg = w.base + Math.floor(roll.natural * w.scale) + Math.floor(h.might / 2) + 2;
      if (roll.outcome === 'critical') {
        dmg *= 2;
        target._skipNext = true;
      }
      const crit = roll.outcome === 'critical', kill = target.hp - dmg <= 0;
      log(`Throw · ${crit ? 'CRITICAL · knocked back · ' : ''}${dmg} dmg${kill ? ' · kill' : ''} · weapon spent${rollTxt(roll)}`, crit || kill ? 'crit' : 'ok',
        QuilNarrate.pick(kill ? 'throw_kill' : crit ? 'throw_crit' : 'throw_hit', tctx));
      applyDamage(target, dmg);
      if (target.dead) await killCine('throw', crit);
      if (!target.dead) setAware(target, 'alerted');
      perceive(target.pos, 'loud', target, 'thrown weapon');
    }
    battle.stolenTempo = true;
    renderAll();
    if (living().length === 0) return endCombat(true);
    await afterPlayerAction();
  }

  function cycleArrow() {
    const inv = QuilSave.get().inventory;
    const types = Object.keys(inv.quiver).filter(k => inv.quiver[k] > 0);
    if (!types.length) return toast('Quiver empty');
    const i = types.indexOf(inv.selectedArrow);
    inv.selectedArrow = types[(i + 1) % types.length];
    QuilSave.save();
    toast(`Arrow: ${inv.selectedArrow}`);
    renderHero();
  }

  async function doItem() {
    const k = await QuilExtras.pickItem();
    if (!k) return;
    const n = QuilExtras.useItem(k);
    const it = QuilExtras.ITEM[k];
    log(`${it.name} · +${n} HP${k === 'bandage' ? ' · bleeding stopped' : ''}`, 'ok',
      k === 'bandage' ? QuilNarrate.pick('item') : 'You bite the cork out and drain it. It tastes of copper and bitter moss, and warmth floods the wounds, knitting the edges.');
    renderHero();
    await afterPlayerAction();
  }

  /* Slip into cover: move up to 3 squares to the best hidden cell (cover first, then out of every unalerted goblin's sight) */
  async function doSlip() {
    if (anyAlerted()) return toast('Too late to hide');
    const m = M(), here = battle.quil;
    let best = null, bestScore = 1e9;
    for (let x = 0; x < m.cols; x++) for (let y = 0; y < m.rows; y++) {
      if (dist([x, y], here) > 3 || !(freeCell(x, y) || (x === here[0] && y === here[1]))) continue;
      const cov = cellCover([x, y]);
      const seen = living().filter(e => canSee(e, [x, y]) && !(cov && dist(e.pos, [x, y]) > 2)).length;
      const sc = seen * 10 + (cov ? 0 : 3) + dist([x, y], here) * 0.1;
      if (sc < bestScore) { bestScore = sc; best = [x, y]; }
    }
    if (best) battle.quil = best;
    log(`Slip into cover${quilInCover() ? ' · ' + coverLabel() : ''}`, 'ok', 'You ease back through the smoke, keeping low, and fold yourself into the nearest shadow.');
    renderMap();
    await afterPlayerAction();
  }

  async function doFlee() {
    const roll = await QuilDice.promptRoll({
      title: 'Flee',
      target: 7,
      modifiers: [{ label: 'Edge', value: QuilSave.get().hero.edge }],
    });
    if (roll.outcome === 'success' || roll.outcome === 'strong' || roll.outcome === 'critical') {
      log(`Fled${rollTxt(roll)}`, 'ok', QuilNarrate.pick('flee_ok'));
      endCombat(false);
    } else {
      log(`Flee failed${rollTxt(roll)}`, 'fail', QuilNarrate.pick('flee_fail'));
      await afterPlayerAction();
    }
  }

  async function afterPlayerAction() {
    // Tick DoTs on enemies
    living().forEach(e => {
      if (e.bleed) { log(`Bleed · ${e.bleed} dmg`, 'ok', QuilNarrate.pick('bleed', { e: e.name })); applyDamage(e, e.bleed); }
      if (e.burn && e._burnRounds > 0 && !e.dead) { e._burnRounds--; log(`Burn · ${e.burn} dmg`, 'ok', QuilNarrate.pick('burn', { e: e.name })); applyDamage(e, e.burn); }
    });
    await flushCine();
    renderAll();
    if (living().length === 0) return endCombat(true);
    battle.phase = 'enemy';
    renderActions();
    await enemyTurn();
  }

  async function enemyTurn() {
    const foes = living();
    // Patrols: unaware goblins walk 1 square along their route and turn at the ends
    foes.filter(e => e.aware === 'unaware' && e.patrol && e.patrol.length > 1).forEach(e => {
      let ni = e.pi + e.pdir;
      if (ni < 0 || ni >= e.patrol.length) { e.pdir *= -1; ni = e.pi + e.pdir; }
      const nx = e.patrol[ni];
      if (freeCell(...nx)) { e.facing = faceTo(e.pos, nx); e.pos = nx.slice(); e.pi = ni; }
      else e.facing = ({ N: 'S', S: 'N', E: 'W', W: 'E' })[e.facing];
    });
    // Bodies are discovered: anyone unalerted with line of sight to a fallen goblin rolls 2d6* +3 (+tension, +2 suspicious) vs 8
    const bodies = battle.enemies.filter(b => (b.dead || b.ko) && !b._found);
    for (const e of foes) {
      if (e.aware === 'alerted') continue;
      const seen = bodies.find(b => !(e.beast && b.type === 'wolf_rider') && canSee(e, b.pos) && dist(e.pos, b.pos) <= TUNE.bodyRange); // smoke and dark hide bodies further off
      if (!seen) continue;
      const r = roll2d6z(), b = TUNE.bodyBonus - (M().smoke || 0) + percOf(e) + tension() + (e.aware === 'suspicious' ? 2 : 0) - Math.floor(dist(e.pos, seen.pos) / TUNE.distDiv), tot = r.n + b;
      if (tot >= TUNE.alertAt) {
        seen._found = true; setAware(e, 'alerted', true);
        log(`${e.name} finds ${seen.name}'s body · ${r.a}+${r.b}+${b}=${tot} → alerted`, 'fail', `${e.name} stumbles over ${seen.name}, sprawled in the ash, and goes rigid.`);
        soundHorn(e, 'body found');
      } else log(`${e.name} glances toward ${seen.name} · ${r.a}+${r.b}+${b}=${tot} · misses it in the smoke`, '');
    }
    if (battle._pendingHorn) { const h = battle._pendingHorn; battle._pendingHorn = null; if (!h.dead && !h.ko) soundHorn(h, 'alerted'); }
    renderMap();
    await flushCine();
    // Searchers: suspicious goblins turn toward Quil and look (quiet check, only if they can see him)
    foes.filter(e => e.aware === 'suspicious').forEach(e => {
      e.facing = faceTo(e.pos, battle.quil);
      const sniff = e.nose && dist(e.pos, battle.quil) <= 3;
      if (!seesQuil(e) && !sniff) return;
      if (sniff && !seesQuil(e)) log(`${e.name} has your scent`, '', QuilNarrate.pick('wolf_sniff', { e: e.name }));
      const r = roll2d6z(), b = 2 + 2 + percOf(e) + tension() - Math.floor(dist(e.pos, battle.quil) / TUNE.distDiv), tot = r.n + b;
      if (tot >= TUNE.alertAt) { setAware(e, 'alerted'); log(`${e.name} searches · ${r.a}+${r.b}+${b}=${tot} → alerted`, 'fail', `${e.name} squints into the smoke, and finds you.`); }
      else log(`${e.name} searches · ${r.a}+${r.b}+${b}=${tot} · nothing`, '');
    });
    const attackers = living().filter(e => e.aware === 'alerted').sort((a, b) => (b.fast ? 1 : 0) - (a.fast ? 1 : 0));
    if (!attackers.length) log('No one has found you yet', 'ok');
    const cutters = attackers.filter(e => e.type === 'goblin_cutter').length;
    let clash = false;
    for (const e of attackers) {
      if (e.dead || e.ko) continue;
      if (e._skipNext) { e._skipNext = false; log(`${e.name} loses its turn`, '', QuilNarrate.pick('stagger', { e: e.name })); continue; }
      let charged = false;
      if (!e.ranged) {
        const d0 = dist(e.pos, battle.quil);
        // Charge: a mounted wolf-rider covers up to 4 squares in a rush and hits harder for it
        enemyAdvance(e, e.charge && d0 > 1.5 && d0 <= 5 ? 4 : 2); renderMap();
        if (!e.engaged) { log(`${e.name} closes in`, '', e.fast ? QuilNarrate.pick(e.type === 'wolf' ? 'wolf_close' : 'wr_close', { e: e.name }) : null); continue; }
        clash = true;
        if (e.charge && d0 > 1.5) { charged = true; log(`${e.name} charges · +1 Attack, +2 damage`, 'fail', QuilNarrate.pick('wr_charge', { e: e.name })); }
      }
      else if (!canSee(Object.assign({}, e, { facing: faceTo(e.pos, battle.quil) }), battle.quil)) { log(`${e.name} has no line on you`, 'ok'); continue; }
      await hitQuil(e, 1, (cutters >= 3 && e.type === 'goblin_cutter' ? 1 : 0) + (charged ? 1 : 0), charged ? 2 : 0);
      await flushCine();
      if (living().length === 0) return endCombat(true);
      if (QuilSave.get().hero.hp <= 0) {
        QuilSave.get().hero.hp = 0;
        QuilSave.save();
        log('Quil falls', 'fail', QuilNarrate.pick('quil_fall'));
        return endCombat(false);
      }
    }
    if (clash) perceive(battle.quil, 'loud', null, 'the fight');
    roundRecap();
    battle.round++;
    const lostTempo = battle.stolenTempo;
    battle.stolenTempo = false;
    if (lostTempo) {
      log('Tempo lost · enemies act first', 'fail', QuilNarrate.pick('tempo'));
      battle.phase = 'enemy';
      renderAll();
      QuilSave.save();
      await enemyTurn();
      return;
    }
    if (living().length === 0) return endCombat(true);
    battle.phase = 'player';
    renderAll();
    QuilSave.save();
  }

  async function hitQuil(enemy, mult, swarmBonus, plusDmg) {
    const atk = enemy.attack + (swarmBonus || 0);
    const roll = await QuilDice.promptRoll({
      title: `Defend vs ${enemy.name}`,
      target: atk,
      modifiers: modsFor('defence').concat(enemy.ranged && quilInCover() ? [{ label: 'Cover', value: 1 }] : []),
    });
    const s = QuilSave.get();
    let dmg = Math.floor(enemy.dmg * (mult || 1)) + (plusDmg || 0);
    const ew = enemy.ranged ? 'arrow' : enemy.beast ? 'fangs' : enemy.mounted ? 'spear' : 'shiv';
    const ectx = { e: enemy.name, w: ew };
    const R = enemy.ranged ? '_ranged' : (enemy.beast || enemy.mounted) ? '_beast' : '';
    const pk = k => QuilNarrate.pools[k + R] ? k + R : k;
    if (roll.outcome === 'critical' || roll.outcome === 'strong') {
      const rip = 2 + s.hero.might;
      if (!enemy.dead && !enemy.ko && !enemy.ranged) {
        const kill = enemy.hp - rip <= 0;
        log(`Defence · strong · riposte ${rip} dmg${kill ? ' · kill' : ''}${rollTxt(roll)}`, kill ? 'crit' : 'ok',
          QuilNarrate.pick(kill ? 'melee_kill' : 'def_riposte', { e: enemy.name, w: wName() }));
        applyDamage(enemy, rip);
        if (enemy.dead) await killCine('melee', false);
      } else {
        log(`Defence · strong${rollTxt(roll)}`, 'ok', QuilNarrate.pick(pk('def_ok'), ectx));
      }
      renderEnemies();
    } else if (roll.outcome === 'success') {
      log(`Defence · no damage${rollTxt(roll)}`, 'ok', QuilNarrate.pick(pk('def_ok'), ectx));
    } else if (roll.outcome === 'fumble') {
      dmg = Math.floor(dmg * 1.5);
      log(`Gravedice · ${enemy.name} crits · −${dmg} HP${rollTxt(roll)}`, 'fail', QuilNarrate.pick('def_fumble', ectx));
      s.hero.hp -= dmg;
    } else if (roll.margin >= -2) {
      dmg = Math.ceil(dmg / 2);
      log(`Graze · −${dmg} HP${rollTxt(roll)}`, 'fail', QuilNarrate.pick(pk('def_graze'), ectx));
      s.hero.hp -= dmg;
    } else {
      log(`Hit · −${dmg} HP${rollTxt(roll)}`, 'fail', QuilNarrate.pick(pk('def_hit'), ectx));
      s.hero.hp -= dmg;
    }
    QuilSave.save();
    renderHero();
    if (!battle._woundCine && s.hero.hp > 0 && s.hero.hp < s.hero.maxHp * 0.3) {
      battle._woundCine = true;
      await QuilExtras.cine('battle.wounded', `Blood runs hot down your side and the ${MID === 2 ? 'clearing' : 'square'} tilts. They can smell it. ${enemy.name} grins and closes in, and so do the others. Get up, Quil.`, `Badly wounded · HP ${s.hero.hp}/${s.hero.maxHp}`);
    }
  }

  function renderAll() {
    checkWolf();
    if (living().length && living().every(e => e.unseen)) living().forEach(e => { e.unseen = false; });
    renderMap();
    renderEnemies();
    renderHero();
    renderActions();
    renderLog();
  }

  function start(cb, missionId) {
    onEnd = cb;
    battle = spawnMission(missionId || 1);
    // Seed fallen weapons empty; engage none yet
    document.getElementById('screen-combat').classList.add('active');
    hideOthers('screen-combat');
    document.getElementById('bottom-nav').classList.remove('visible');
    QuilArt.mount(document.querySelector('#combat-scene-art'), MID === 2 ? 'scene.charcoal_track' : 'scene.town_square');
    if (MID === 2) window.QuilExtras?.unlock?.('map.battle_m2');
    log('Choose your opener: Open Assault, Melee Stealth or Ranged Stealth', '', QuilNarrate.pick(MID === 2 ? 'intro_m2' : 'intro'));
    battle.selected = 'gc1';
    renderAll();
    QuilSave.save();
  }

  function hideOthers(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  async function endCombat(won) {
    battle.done = true;
    battle.phase = 'over';
    renderActions();
    if (!won) {
      log('Defeat', 'fail', QuilNarrate.pick('defeat'));
      toast('Defeated');
      setTimeout(() => {
        document.getElementById('screen-combat').classList.remove('active');
        if (onEnd) onEnd({ won: false });
      }, 1200);
      return;
    }
    roundRecap();
    log('Victory', 'crit', QuilNarrate.pick('victory'));
    QuilSave.save();
    await new Promise(r => setTimeout(r, 900));
    // Interrogation if captives
    const kos = battle.enemies.filter(e => e.ko && !e.beast);
    if (kos.length) {
      await doInterrogation(kos[0]);
    }
    setTimeout(() => {
      document.getElementById('screen-combat').classList.remove('active');
      if (onEnd) onEnd({ won: true, captives: battle.captives, battle });
    }, 600);
  }

  async function doInterrogation(captive) {
    return new Promise(async resolve => {
      const overlay = document.createElement('div');
      overlay.id = 'interrogate-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;z-index:120;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;justify-content:flex-end';
      overlay.innerHTML = `
        <div class="dice-sheet">
          <div class="int-banner" data-art="battle.interrogate"></div>
          <h3>Interrogate ${captive.name}</h3>
          <p style="color:#b8a88a;font-size:14px">Resolve ${captive.resolve}. Choose your approach.</p>
          <div class="choices" id="int-choices">
            <button class="btn" data-m="intimidate">Intimidate (Might)</button>
            <button class="btn danger" data-m="brutal">Brutal Intimidate (+2, +3 corruption)</button>
            <button class="btn moss" data-m="persuade">Persuade (Charm)</button>
            <button class="btn ghost" data-m="skip">Leave them</button>
          </div>
        </div>`;
      document.getElementById('app').appendChild(overlay);
      QuilArt.mount(overlay.querySelector('.int-banner'), 'battle.interrogate');
      const done = async (method) => {
        if (method === 'skip') { overlay.remove(); resolve(); return; }
        const h = QuilSave.get().hero;
        let mods = [];
        let target = captive.resolve;
        if (method === 'intimidate' || method === 'brutal') {
          mods = [{ label: 'Might', value: h.might }];
          if (method === 'brutal') {
            mods.push({ label: 'Brutal', value: 2 });
            h.corruption = Math.min(100, h.corruption + 3);
          }
        } else {
          mods = [{ label: 'Charm', value: h.charm }];
        }
        const roll = await QuilDice.promptRoll({
          title: `Interrogate (${method})`,
          target,
          modifiers: mods,
        });
        const s = QuilSave.get();
        const c = { e: captive.name };
        let key, mech, gained = [];
        const have = t => (s.intel || []).some(i => i.text === t.text);
        const pool = MIS().intel.filter(i => !have(i));
        if (roll.outcome === 'critical') { gained = pool.slice(); key = 'int_crit'; mech = 'Critical · all intel'; }
        else if (roll.outcome === 'strong') { gained = pool.slice(0, 2); key = 'int_strong'; mech = 'Strong · 2 intel cards'; }
        else if (roll.outcome === 'success') { gained = pool.slice(0, 1); key = 'int_ok'; mech = 'Success · 1 intel card'; }
        else if (roll.margin <= -3 || roll.outcome === 'fumble') { gained = [{ type: '?', text: 'False: "They fled north."', false: true }]; key = 'int_lie'; mech = 'Failed badly · a lie (marked ?)'; }
        else { key = 'int_silent'; mech = 'Fail · nothing'; }
        let narr = QuilNarrate.pick(key, c);
        if (key === 'int_lie') {
          // Wits: see through the goblin's lie
          const w = await QuilDice.promptRoll({ title: 'Wits · Is it lying?', target: 6, modifiers: [{ label: 'Wits', value: h.wits }] });
          const seen = ['success', 'strong', 'critical'].includes(w.outcome);
          if (seen) { gained = pool.slice(0, 1); mech += ` · Wits ${w.total} vs 6: lie exposed, the truth beaten out of it`; narr += ' But its eyes flick east as it says "north", and you know. You lean in until it tells you the truth.'; }
          else mech += ` · Wits ${w.total} vs 6: you believe it`;
        }
        gained.forEach(i => s.intel.push(Object.assign({ m: MID }, i)));
        log(mech + rollTxt(roll), gained.length ? 'ok' : 'fail', narr);
        QuilSave.save();
        const sheet = overlay.querySelector('.dice-sheet');
        sheet.innerHTML = `<h3>${captive.name}</h3>
          <div class="beat-narr">${narr}</div><div class="beat-mech">${mech}${rollTxt(roll)}</div>
          ${gained.map(i => `<div class="intel-card" style="margin:6px 0">[${i.type}] ${i.text}</div>`).join('')}
          <p style="color:#b8a88a;font-size:14px;margin-top:12px">And the prisoner?</p>
          <div class="choices"><button class="btn danger" data-f="execute">Execute (+1 corruption)</button>
          ${(s.items || {}).rope > 0 ? `<button class="btn" data-f="bind">Bind &amp; leave · uses 1 rope (${s.items.rope})</button>`
            : `<button class="btn" data-f="release">Let it crawl away · no rope</button>`}</div>`;
        sheet.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
          const ex = b.dataset.f === 'execute', rel = b.dataset.f === 'release';
          if (ex) h.corruption = Math.min(100, h.corruption + 1);
          if (b.dataset.f === 'bind') s.items.rope--;
          const fn = rel ? `${captive.name} scrambles off into the smoke, clutching its head. It will tell its friends about you.` : QuilNarrate.pick(ex ? 'fate_execute' : 'fate_bind', c);
          log(ex ? 'Executed · +1 corruption' : rel ? 'Released (no rope)' : 'Bound & left · −1 rope', ex ? 'fail' : 'ok', fn);
          QuilSave.save();
          sheet.innerHTML = `<div class="beat-narr">${fn}</div><div class="choices"><button class="btn primary" id="int-done">Continue</button></div>`;
          sheet.querySelector('#int-done').onclick = () => { overlay.remove(); resolve(); };
        });
      };
      overlay.querySelectorAll('[data-m]').forEach(b => b.onclick = () => done(b.dataset.m));
    });
  }

    function forceThrowSetup() {
    if (!battle) return false;
    battle.phase = 'player';
    battle.fallenWeapons = [];
    let killed = 0;
    battle.enemies.forEach(e => {
      e.ko = false; e.stun = 0; e.bleed = 0; e.burn = 0; e._skipNext = false;
      if (e.type === 'goblin_cutter' && killed < 3) {
        e.dead = true; e.hp = 0; e.engaged = false;
        battle.fallenWeapons.push(e.weapon); killed++;
      } else {
        e.dead = false; e.hp = e.maxHp; e.engaged = false;
      }
    });
    const live = battle.enemies.find(e => !e.dead);
    battle.selected = live ? live.uid : null;
    battle.stolenTempo = false;
    renderAll();
    return true;
  }
  return { start, getBattle: () => battle, forceThrowSetup, TUNE, _ai: { pAlert, stealthTarget, seesQuil, canSee } };
})();
