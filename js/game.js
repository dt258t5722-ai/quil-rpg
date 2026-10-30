/* Main game flow: title, prologue, mission 1, map, inventory, hero, hearth */
window.QuilGame = (() => {
  let prologueIdx = 0;

  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id);
    if (el) el.classList.add('active');
    if (QuilSave.get() && window.QuilEnsure) QuilEnsure(QuilSave.get());
    const hub = ['screen-map', 'screen-pack', 'screen-hero', 'screen-hearth', 'screen-journal', 'screen-gallery'].includes(id);
    $('bottom-nav').classList.toggle('visible', hub);
    if (hub) {
      document.querySelectorAll('#bottom-nav button').forEach(b => {
        b.classList.toggle('active', b.dataset.screen === (id === 'screen-gallery' ? 'screen-journal' : id));
      });
    }
    const s = QuilSave.get();
    if (s) { s.scene = id; QuilSave.save(); }
    if (hub) renderResumeBar(id);
  }

  /* ---- Way back: every hub screen gets a Resume button ---- */
  function m1Stage(s) {
    if (!s.flags.prologueDone) return 'prologue';
    if (s.flags.mission1Done && s.flags.m2Stage && !s.flags.mission2Done) return 'm2';
    if (s.flags.mission1Done) return 'done';
    return s.flags.m1Stage || 'brief';
  }
  function resumeLabel() {
    const s = QuilSave.get(); if (!s) return 'Resume';
    return ({ prologue: 'Resume Prologue', brief: 'Resume Mission 1', combat: 'Resume Mission 1',
      loot: 'Resume: Loot', rescue: 'Resume: Mill Loft', done: s.flags.mission2Done ? 'Town' : 'Start Mission 2', m2: 'Resume Mission 2' })[m1Stage(s)];
  }
  function resumeCurrent() {
    const s = QuilSave.get(); if (!s) return initTitle();
    const st = m1Stage(s);
    if (st === 'prologue') { prologueIdx = s.flags.prologueIdx || 0; showScreen('screen-scene'); renderPrologue(); }
    else if (st === 'loot') afterCombatVictory();
    else if (st === 'rescue') startRescue();
    else if (st === 'm2') QuilM2.resume();
    else if (st === 'done') s.flags.mission2Done ? QuilExtras.showTown() : QuilM2.start();
    else showMissionBrief();
  }
  const s2done = () => !!QuilSave.get().flags.mission2Done;
  function renderResumeBar(id) {
    const header = document.querySelector('#' + id + ' .panel-header');
    if (!header) return;
    if (id === 'screen-gallery' || (m1Stage(QuilSave.get()) === 'done' && s2done() && id === 'screen-map')) { header.querySelectorAll('.btn-resume').forEach(x => x.remove()); return; }
    let b = header.querySelector('#btn-resume');
    if (!b) {
      header.querySelectorAll('.btn-resume').forEach(x => x.remove());
      b = document.createElement('button');
      b.className = 'btn small primary btn-resume';
      header.appendChild(b);
    }
    // only one element with id at a time
    document.querySelectorAll('#btn-resume').forEach(x => { if (x !== b) x.removeAttribute('id'); });
    b.id = 'btn-resume';
    b.textContent = '▶ ' + resumeLabel();
    b.onclick = resumeCurrent;
  }

  /* Simple place/teaser scene with a guaranteed way back to the map */
  function showPlace(artId, html, extra) {
    showScreen('screen-scene');
    QuilArt.mount($('scene-art'), artId);
    $('narrative').innerHTML = html;
    $('choices').innerHTML = (extra || '') + '<button class="btn ghost" data-back-map>⟵ Back to World Map</button>';
    $('choices').querySelector('[data-back-map]').onclick = showMap;
    return $('choices');
  }
  function showSliceEnd() {
    showPlace('scene.road_east', `<p><strong>M2 · The Charcoal Track</strong></p>
      <p>The trail of iron-shod boots leads into Thornwood along the old charcoal track. The rear guard is still out there.</p>
      <p><em>This is the end of the vertical slice — Mission 2 arrives in the next build.</em></p>`,
      '<button class="btn" id="btn-replay-m1">Replay Mission 1</button>');
    $('btn-replay-m1').onclick = replayMission1;
  }
  function replayMission1() {
    const s = QuilSave.get();
    s.flags.mission1Done = false; s.flags.m1Stage = 'brief'; s.flags.m1Looted = false;
    QuilSave.save(); // HP does not regenerate: rest at the inn, camp or drink a potion first
    showMissionBrief();
  }

  function initTitle() {
    showScreen('screen-title');
    $('bottom-nav').classList.remove('visible');
    QuilArt.mount($('title-art'), 'scene.title');
    const has = QuilSave.hasSave();
    $('btn-continue').style.display = has ? '' : 'none';
    $('btn-continue').onclick = () => {
      QuilSave.load();
      resume();
    };
    $('btn-new').onclick = () => showNewGame();
    $('btn-load').onclick = () => {
      if (!QuilSave.hasSave()) return toast('No save found');
      QuilSave.load();
      resume();
    };
    const sel = $('title-dice-mode');
    if (QuilSave.hasSave()) {
      const s = QuilSave.load();
      sel.value = s?.settings?.diceMode || 'physical';
    }
    sel.onchange = () => {
      const st = QuilSave.get() || QuilSave.load();
      if (st) { st.settings.diceMode = sel.value; QuilSave.set(st); QuilSave.save(); }
    };
  }

  function showNewGame() {
    showScreen('screen-new');
    const base = { might: 1, edge: 1, grit: 1, wits: 0, charm: 1 };
    let pool = 2;
    const stats = { ...base };

    function render() {
      $('points-left').textContent = `${pool} free point${pool === 1 ? '' : 's'} remaining (max 2 in any stat at Lv1)`;
      ['might', 'edge', 'grit', 'wits', 'charm'].forEach(k => {
        $(`stat-${k}`).textContent = stats[k];
        $(`dec-${k}`).disabled = stats[k] <= base[k];
        $(`inc-${k}`).disabled = pool <= 0 || stats[k] >= base[k] + 2 || stats[k] >= 2 && k !== 'wits' ? (stats[k] >= 2) : false;
        // At level 1 max 2 in any stat; start wits 0 so can go to 2
        const max = 2;
        $(`inc-${k}`).disabled = pool <= 0 || stats[k] >= max;
        $(`dec-${k}`).disabled = stats[k] <= base[k];
      });
    }

    ['might', 'edge', 'grit', 'wits', 'charm'].forEach(k => {
      $(`inc-${k}`).onclick = () => {
        if (pool <= 0 || stats[k] >= 2) return;
        stats[k]++; pool--; render();
      };
      $(`dec-${k}`).onclick = () => {
        if (stats[k] <= base[k]) return;
        stats[k]--; pool++; render();
      };
    });

    $('btn-start-game').onclick = () => {
      if (pool > 0) return toast('Spend all free points');
      const diceMode = $('new-dice-mode').value;
      QuilSave.newGame(stats, diceMode);
      // Sync title toggle
      $('title-dice-mode').value = diceMode;
      $('auto-roll-toggle').classList.toggle('on', diceMode === 'auto');
      startPrologue();
    };
    $('btn-new-back').onclick = () => initTitle();
    render();
  }

  function startPrologue() {
    prologueIdx = 0;
    showScreen('screen-scene');
    renderPrologue();
  }

  function renderPrologue() {
    const beat = QuilData.prologue[prologueIdx];
    QuilArt.mount($('scene-art'), beat.artId);
    $('narrative').innerHTML = `<p>${beat.text}</p>`;
    const box = $('choices');
    box.innerHTML = '';
    beat.choices.forEach(c => {
      const b = document.createElement('button');
      b.className = 'btn primary';
      b.textContent = c.label;
      b.onclick = () => {
        if (c.next === 'mission1') {
          const s = QuilSave.get();
          s.flags.prologueDone = true;
          QuilSave.save();
          showMissionBrief();
        } else {
          prologueIdx = c.next;
          QuilSave.get().flags.prologueIdx = prologueIdx; QuilSave.save();
          renderPrologue();
        }
      };
      box.appendChild(b);
    });
  }

  function showMissionBrief() {
    showScreen('screen-brief');
    { const st = QuilSave.get(); if (!st.flags.mission1Done && st.flags.m1Stage !== 'loot' && st.flags.m1Stage !== 'rescue') { st.flags.m1Stage = 'brief'; QuilSave.save(); } }
    const m = QuilData.mission1;
    QuilArt.mount($('brief-art'), 'scene.town_square');
    $('brief-body').innerHTML = `
      <h2 class="cinzel" style="color:var(--gold);margin:0 0 8px">${m.name}</h2>
      <p style="color:#b8a88a;font-size:14px">${m.location}</p>
      <p><strong>Objective:</strong> ${m.objective}</p>
      <p><strong>Enemies:</strong> 4 Goblin Cutters, 1 Goblin Archer, 1 Goblin Brute (carries a war-horn)</p>
      <div class="intel-cards">${(QuilSave.get().intel || []).map(i =>
        `<span class="intel-card">[${i.type}] ${i.text}</span>`).join('') || '<span style="color:#8a7a60">No intel yet</span>'}</div>
      <p style="font-size:14px;color:#9a8a70">Loadout: ${QuilData.weapons[QuilSave.get().inventory.mainHand].name}, ${QuilData.weapons[QuilSave.get().inventory.bow].name}, arrows ready.</p>`;
    $('btn-brief-sneak').onclick = () => witsTracks();
    $('btn-brief-assault').onclick = () => witsTracks();
    $('btn-brief-map').onclick = () => { showMap(); };
  }

  /* ---- Wits checks (non-combat skill rolls) ---- */
  const witsCard = (title, roll, target, txt) => `<div class="wits-card"><b>${title}</b> · Wits vs ${target} · roll ${roll.natural}${roll.modTotal ? '+' + roll.modTotal : ''}=${roll.total} · ${roll.outcome}<br>${txt}</div>`;
  async function witsRoll(title, target, extra) {
    const h = QuilSave.get().hero;
    return QuilDice.promptRoll({ title, target, modifiers: [{ label: 'Wits', value: h.wits }].concat(extra || []) });
  }
  function witsTracks() {
    const s = QuilSave.get(); s.flags.m1Prep = {}; QuilSave.save();
    beat('scene.town_square', `<p>The lane into the square is churned to black mud. Before you go in, you crouch and look: boot-prints, claw-prints, the drag-marks of something heavy.</p>
      <p>Your father taught you to read a deer trail. This is the same, only uglier.</p>`, [
      { label: 'Read the tracks  [Wits vs 6]', fn: async () => {
        const r = await witsRoll('Wits · Read the tracks', 6, [{ label: 'Farm-raised', value: 1 }]);
        const ok = OK(r); const st = QuilSave.get(); st.flags.m1Prep.tracks = ok;
        if (ok && !st.intel.some(i => /gallows beam/.test(i.text))) st.intel.push({ type: 'Enemy', text: 'Five sets of tracks: four cutters, and one archer up on the gallows beam.' });
        QuilSave.save();
        beat('scene.town_square', `<p class="beat-narr dark">${ok
          ? 'Four sets of small splayed feet circling the well, and one set that stops dead beneath the gallows beam and never comes back down. An archer, up high. You slip round to the barrels on the chapel side, where its line is worst.'
          : 'The prints blur into one trampled mess of mud and ash. You count four goblins, maybe. You can\'t be sure there aren\'t more.'}</p>`
          + witsCard('Read the tracks', r, 6, ok ? 'The archer is marked on the battle map. You start in cover behind the barrels. +1 intel card.' : 'One enemy stays hidden (?) on the map until it shows itself.'),
          [{ label: 'Creep up the lane', fn: witsTrap }]);
      } },
    ]);
  }
  function witsTrap() {
    beat('scene.town_square', `<p>Halfway up the lane, something about the ash looks wrong: too smooth, too even, right where a man would step.</p>`, [
      { label: 'Study the ground ahead  [Wits vs 7]', fn: async () => {
        const r = await witsRoll('Wits · Spot the trap', 7);
        const ok = OK(r), st = QuilSave.get(); st.flags.m1Prep.trap = ok ? 'avoided' : 'sprung'; QuilSave.save();
        beat('scene.town_square', `<p class="beat-narr dark">${ok
          ? 'A tripwire, strung ankle-high between two posts, threaded with a goblin\'s string of stolen bells. You step over it so carefully your knees ache.'
          : 'Your boot catches something taut. Bells jangle in the dark, a thin bright sound, and somewhere ahead two goblins stop talking.'}</p>`
          + witsCard('Spot the trap', r, 7, ok ? 'Ambush avoided. Every goblin starts unaware.' : 'The bell-wire rings. Cutters 1 and 2 start suspicious and facing your way.'),
          [{ label: 'Into the square', fn: beginCombat }]);
      } },
    ]);
  }
  async function witsCache() {
    const s = QuilSave.get();
    if (s.flags.m1Cache) return startRescue();
    beat('scene.hollowmere_dusk', `<p>On the way to the mill you pass what is left of your own hearth. Scratched into the stone, low down where only family would look, is one of your mother's acorns: three notches, the cap pointing down.</p>`, [
      { label: 'Work out what she meant  [Wits vs 6, lore]', fn: async () => {
        const r = await witsRoll('Wits · Maren\'s acorn', 6, [{ label: 'You know her marks', value: 1 }]);
        const ok = OK(r), st = QuilSave.get(); st.flags.m1Cache = true;
        if (ok) { st.hero.gold += 6; QuilEnsure(st); st.items.minor_potion++; st.intel.push({ type: 'Lore', text: 'Maren\'s acorn code: notches count the wagons; cap down means "under".' }); }
        QuilSave.save();
        beat('scene.hollowmere_dusk', `<p class="beat-narr dark">${ok
          ? 'Three notches, cap down: three stones under. You lever up the third hearthstone and find her rainy-day tin. Six silver pennies, a stoppered healing draught, and a scrap of cloth that still smells of her.'
          : 'You stare at the acorn until your eyes burn. Whatever she meant, it is gone with her. For now.'}</p>`
          + witsCard('Maren\'s acorn', r, 6, ok ? 'Hidden cache: +6 gold, +1 Minor Healing Potion, +1 Lore intel.' : 'Nothing found.'),
          [{ label: 'On to the mill loft', fn: startRescue }]);
      } },
      { label: 'No time. To the mill', cls: 'ghost', fn: () => { QuilSave.get().flags.m1Cache = true; QuilSave.save(); startRescue(); } },
    ]);
  }

  function beginCombat() {
    QuilSave.save();
    QuilCombat.start(async (result) => {
      if (!result.won) {
        const s = QuilSave.get();
        const lost = Math.floor((s.hero.gold || 0) * 0.25);
        s.hero.gold -= lost; s.hero.hp = 1;
        if (!s.mapUnlocks.includes('waypost')) s.mapUnlocks.push('waypost');
        s.flags.m1Stage = 'brief';
        QuilSave.save();
        beat('place.inn', `<p class="beat-narr dark">You wake on a straw pallet that smells of beer and horse. A carter found you in the ash and threw you in the back of his wagon. Your purse is lighter than it was.</p>
          <p>The King's Road Waypost. You are alive, barely.</p><div class="wits-card"><b>Defeat</b> · HP 1/${s.hero.maxHp} · lost ${lost} gold (25%)</div>`,
          [{ label: 'Get up', fn: () => QuilExtras.showTown() }]);
        return;
      }
      await afterCombatVictory();
    });
  }

  async function afterCombatVictory() {
    const s = QuilSave.get();
    const m = QuilData.mission1;
    s.flags.m1Stage = 'loot';
    if (!s.flags.m1Looted) {
    const wasOver = QuilSave.overloaded(); setTimeout(() => warnIfOver(wasOver), 400);
    s.flags.m1Looted = true;
    s.hero.gold += m.loot.gold;
    Object.entries(m.loot.jewels || {}).forEach(([k, v]) => {
      s.hero.jewels[k] = (s.hero.jewels[k] || 0) + v;
    });
    Object.entries(m.loot.arrows || {}).forEach(([k, v]) => {
      s.inventory.quiver[k] = (s.inventory.quiver[k] || 0) + v;
    });
    // XP + level
    s.hero.xp += m.xp;
    checkLevel(s);
    }
    QuilSave.save();

    showScreen('screen-loot');
    QuilArt.mount($('loot-art'), 'item.banner');
    $('loot-body').innerHTML = `
      <h2 class="cinzel" style="color:var(--gold)">Loot</h2>
      <p class="beat-narr dark">${QuilNarrate.pick('loot')}</p>
      <ul class="loot-list">
        <li class="loot-art-row"><span class="thumb" data-art="item.loot"></span>+${m.loot.gold} gold · +1 garnet</li>
        <li class="loot-art-row"><span class="thumb" data-art="item.hatchet"></span>Tomas's Hatchet (kept)</li>
        <li class="loot-art-row"><span class="thumb" data-art="item.arrows"></span>Hunting Bow + 12 broadhead arrows</li>
        <li>+${m.xp} XP</li>
      </ul>
      <p style="color:#b8a88a">A sound from the mill loft — someone still hides.</p>`;
    mountThumbs($('loot-body'));
    $('btn-loot-continue').onclick = () => witsCache();
  }

  function checkLevel(s) {
    const need = 100 * s.hero.level;
    if (s.hero.xp >= need && s.hero.level < 15) {
      s.hero.xp -= need;
      s.hero.level++;
      s.hero.maxHp = QuilSave.calcMaxHp(s.hero);
      s.hero.hp = s.hero.maxHp;
      toast(`Level ${s.hero.level}!`);
      if (s.hero.level % 2 === 0) {
        // Grant a free stat — Charm for romance beat in slice
        s.hero.charm = Math.min(5, s.hero.charm + 1);
        toast('+1 Charm (even level)');
      }
    }
  }

  function startRescue() {
    QuilSave.get().flags.m1Stage = 'rescue'; QuilSave.save();
    showScreen('screen-scene');
    QuilArt.mount($('scene-art'), 'romance.rescue');
    $('narrative').innerHTML = `
      <p>In the mill loft, flour dust hangs in the torchlight. <strong>Tamsin Reed</strong> — freckled, sharp-tongued, the miller's daughter and your childhood friend — lowers a grain sack from her fist.</p>
      <p>"Quil. Took you long enough." Her voice cracks on the joke. "They took everyone who couldn't run. I heard wagons. East."</p>
      <p>She is free. Unharmed enough to stand. The rest stays unspoken.</p>`;
    $('choices').innerHTML = `
      <button class="btn primary" id="btn-romance">Offer your hand (Romance spark)</button>
      <button class="btn" id="btn-recruit">Ask her to stay close (Recruit / ally-style)</button>
      <button class="btn ghost" id="btn-send-town">Send her to safety alone</button>`;
    $('btn-romance').onclick = () => doSpark('romance');
    $('btn-recruit').onclick = () => doSpark('recruit');
    $('btn-send-town').onclick = () => {
      const s = QuilSave.get();
      s.romance.tamsin = { affection: 5, status: 'acquainted', location: 'hollowmere' };
      s.flags.mission1Done = true;
      QuilSave.save();
      toast('Tamsin heads for the chapel cellar.');
      finishMission1();
    };
  }

  const OK = r => ['success', 'strong', 'critical'].includes(r.outcome);
  function setTamsin(aff, status, loc) {
    const s = QuilSave.get();
    s.romance.tamsin = Object.assign(s.romance.tamsin || {}, { affection: Math.min(100, aff), status, location: loc });
    s.flags.mission1Done = true; QuilSave.save();
  }
  function beat(art, html, buttons) {
    showScreen('screen-scene');
    QuilArt.mount($('scene-art'), art);
    $('narrative').innerHTML = html;
    $('choices').innerHTML = buttons.map((b, i) => `<button class="btn ${b.cls || (i ? '' : 'primary')}" data-i="${i}">${b.label}</button>`).join('');
    $('choices').querySelectorAll('[data-i]').forEach(el => el.onclick = buttons[+el.dataset.i].fn);
  }
  const mechP = (label, roll, target, aff) => `<p class="beat-mech dark">${label} · ${roll.total} vs ${target} · ${roll.outcome}${aff != null ? ' · affection ' + aff : ''}</p>`;

  /* Stage 1: the rescue spark (or a recruit request) */
  async function doSpark(kind) {
    const d = QuilData.damsel.tamsin;
    const h = QuilSave.get().hero;
    const roll = await QuilDice.promptRoll({
      title: kind === 'romance' ? `Stage 1 · Spark: ${d.name}` : `Recruit: ${d.name}`,
      target: d.heart, modifiers: [{ label: 'Charm', value: h.charm }, { label: 'Quiet rescue', value: 1 }],
    });
    const key = roll.outcome === 'critical' ? 'spark_crit' : OK(roll) ? 'spark_ok' : roll.outcome === 'fumble' ? 'spark_fumble' : 'spark_fail';
    const narr = `<p class="beat-narr dark">${QuilNarrate.pick(key)}</p>`;
    if (kind === 'recruit') {
      const aff = OK(roll) ? 20 : 5;
      setTamsin(aff, OK(roll) ? 'fond' : 'acquainted', OK(roll) ? 'hearth' : 'town');
      return beat('romance.rescue', narr + `<p>${OK(roll) ? 'She nods. "I\'m not sitting this out. I\'ll keep the Hearth until you bring them home."' : 'She shakes her head. "Someone has to bury the rest of them, Quil."'}</p>` + mechP('Recruit', roll, d.heart, aff),
        [{ label: 'Continue', fn: finishMission1 }]);
    }
    if (!OK(roll)) {
      const aff = roll.outcome === 'fumble' ? 0 : 5;
      setTamsin(aff, aff ? 'acquainted' : 'gone', 'town');
      return beat('romance.rescue', narr + `<p>${aff ? 'She thanks you, eyes elsewhere. Maybe another day, with a gift.' : 'A polite thank-you. She leaves for Briarwatch. No romance.'}</p>` + mechP('Spark', roll, d.heart, aff),
        [{ label: 'Continue', fn: finishMission1 }]);
    }
    const aff = roll.outcome === 'critical' ? 35 : 20;
    setTamsin(aff, 'fond', 'hearth');
    QuilSave.get().flags.sparkBonus = roll.outcome === 'critical' || roll.outcome === 'strong' ? 1 : 0;
    beat('romance.rescue', narr + `<p>She takes your hand and climbs down the ladder. She doesn't let go at the bottom.</p>` + mechP('Stage 1 · Spark', roll, d.heart, aff), [
      { label: 'Make camp together at the edge of the woods', fn: romanceCamp },
      { label: 'Not tonight. See her to the chapel cellar', cls: 'ghost', fn: finishMission1 },
    ]);
  }

  /* Stage 2: a flirt / charm roll at camp */
  function romanceCamp() {
    beat('scene.camp', `<p>You make a small fire where the charcoal track meets the trees. Tamsin sits close enough that your shoulders touch. She notices the cut on your cheek before you do.</p>
      <p>"Hold still, you fool." She wets a rag from her flask.</p>`, [
      { label: 'Let her tend the cut, and tease her back  [Charm vs 6]', fn: () => romanceFlirt('tease') },
      { label: 'Tell her about your father  [Charm vs 6, +1 honesty]', fn: () => romanceFlirt('honest') },
    ]);
  }
  async function romanceFlirt(style) {
    const s = QuilSave.get(), h = s.hero;
    const mods = [{ label: 'Charm', value: h.charm }];
    if (s.flags.sparkBonus) mods.push({ label: 'Strong spark', value: 1 });
    if (style === 'honest') mods.push({ label: 'Honesty (she likes)', value: 1 });
    const roll = await QuilDice.promptRoll({ title: 'Stage 2 · Flirt: Tamsin', target: 6, modifiers: mods });
    const t = s.romance.tamsin;
    if (!OK(roll)) {
      setTamsin(t.affection + 3, 'fond', 'hearth');
      return beat('scene.camp', `<p class="beat-narr dark">The joke lands wrong, or the words don't come. She finishes cleaning the cut in silence, then curls up on the far side of the fire.</p><p>Still fond. Still here. Another night, maybe.</p>` + mechP('Stage 2 · Flirt', roll, 6, t.affection),
        [{ label: 'Sleep', fn: finishMission1 }]);
    }
    setTamsin(t.affection + 12, 'smitten', 'hearth');
    const line = style === 'honest'
      ? 'She listens to all of it: the doorway, the hatchet, the acorn stone. When you finish, her thumb is still resting on your cheek.'
      : '"You look terrible," she says, and doesn\'t take her hand away. "Suits you, a little."';
    await QuilExtras.cine('romance.flirt', line, 'Tamsin · Smitten', 3200);
    beat('romance.flirt', `<p class="beat-narr dark">${line}</p><p>The fire burns low. Above the camp, the old hay barn's loft door hangs open to the moon.</p>` + mechP('Stage 2 · Flirt', roll, 6, QuilSave.get().romance.tamsin.affection), [
      { label: 'Offer to keep watch from the hayloft with her  [Charm vs 7]', fn: romanceFinal },
      { label: 'Bank the fire and sleep', cls: 'ghost', fn: finishMission1 },
    ]);
  }

  /* Stage 3: the final roll, then a kiss and the fade to black */
  async function romanceFinal() {
    const s = QuilSave.get(), h = s.hero;
    const roll = await QuilDice.promptRoll({ title: 'Stage 3 · Heart: Tamsin', target: 7, modifiers: [{ label: 'Charm', value: h.charm }, { label: 'Smitten', value: 1 }] });
    const t = s.romance.tamsin;
    if (!OK(roll)) {
      setTamsin(t.affection + 2, 'smitten', 'hearth');
      return beat('romance.flirt', `<p class="beat-narr dark">She smiles, and shakes her head, and kisses your forehead instead. "When this is over, Quil Ashby. Ask me again then."</p>` + mechP('Stage 3 · Heart', roll, 7, t.affection + 2),
        [{ label: 'Sleep', fn: finishMission1 }]);
    }
    setTamsin(t.affection + 15, 'devoted', 'hearth');
    s.gallery = s.gallery || {};
    beat('romance.kiss', `<p class="beat-narr dark">Moonlight through the loft door, straw in her hair, the whole burning world very far away. She pulls you down by the collar and kisses you like she has been meaning to for years.</p>` + mechP('Stage 3 · Heart', roll, 7, QuilSave.get().romance.tamsin.affection),
      [{ label: 'Let the night take you', fn: romanceFade }]);
  }

  function romanceFade() {
    const fade = $('fade-black');
    fade.classList.add('show');
    fade.innerHTML = `
      <div style="font-size:40px;margin-bottom:16px">🕯️</div>
      <p class="cinzel" style="color:#C8A24A">Moonlight</p>
      <p style="max-width:280px;line-height:1.5;color:#8a7a60">
        Her laugh, low against your neck. Straw and woodsmoke and the warmth of her.
        The night closes in around the two of you, and the story, as promised,
        <em>fades to black</em>.
      </p>
      <p style="margin-top:24px;color:#6a5a48;font-size:14px">Dawn. Embers. The road east still waits.</p>
      <button class="btn primary" style="margin-top:28px" id="btn-dawn">At dawn</button>`;
    $('btn-dawn').onclick = () => {
      fade.classList.remove('show');
      finishMission1();
    };
  }

  function finishMission1() {
    // Unlock M2 tease
    const s = QuilSave.get();
    s.flags.m1Stage = 'done';
    if (!s.mapUnlocks.includes('m2')) s.mapUnlocks.push('m2');
    if (!s.mapUnlocks.includes('waypost')) s.mapUnlocks.push('waypost');
    QuilSave.save();
    QuilExtras.missionComplete();
  }

  /* Pin coordinates as % of map.webp (landscape 16:9) */
  const PINS = {
    waypost: [58, 75], hollowmere: [45, 79], ashby_farm: [33, 83], hollowmere_mill: [52, 86], m1: [39, 85],
    m2: [27, 56], m3: [51, 68], s1: [80, 56],
    briarwatch: [60, 40], m4: [67, 45], m5: [86, 42],
    m6: [25, 31],
    saltmarrow: [12, 44], m10: [9, 30],
    kettlewick: [27, 17], m15: [76, 16],
    last_lantern: [44, 19], m20: [53, 9],
  };

  function locAction(loc, s, unlocked) {
    const placeText = {
      hollowmere: ['scene.town_square', '<p><strong>Hollowmere</strong></p><p>Smoke still curls from the square. The chapel cellar holds the few who hid. One day this will be rebuilt.</p>'],
      ashby_farm: ['scene.ashby_farm', "<p><strong>Ashby Farm</strong></p><p>An acorn stone marks your father's grave behind the smokehouse. The hearth is cold.</p>"],
      hollowmere_mill: ['scene.mill', '<p><strong>Hollowmere Mill</strong></p><p>Flour dust and silence. The wheel turns slowly in the millrace.</p>'],
    };
    if (!unlocked) return () => toast(`${loc.name} — locked`);
    if (loc.mission === 1) return () => {
      if (!s.flags.mission1Done) return resumeCurrent();
      showPlace('scene.town_square', '<p><strong>M1 · Ashes of Hollowmere</strong></p><p>Cleared. The square is quiet now.</p>',
        '<button class="btn" id="btn-replay-m1">Replay Mission 1</button>');
      $('btn-replay-m1').onclick = replayMission1;
    };
    if (loc.id === 'm2') return () => QuilM2.fromMap();
    if (loc.id === 'waypost') return QuilExtras.showTown;
    if (loc.id === 's1') return () => showPlace('scene.camp', '<p><strong>S1 · The Elder Oak</strong></p><p>The goblins whisper of it: something old and green deep in Thornwood that even the warband fears. A rumour, for now, and a road for another day.</p><p><em>Side quest coming in a later build.</em></p>');
    if (placeText[loc.id]) return () => showPlace(...placeText[loc.id]);
    return () => toast(loc.name);
  }

  function showMap() {
    showScreen('screen-map');
    const s = QuilSave.get();
    const root = $('map-root');
    root.innerHTML = '';
    const currentId = s.flags.mission1Done ? 'm2' : 'm1';
    const cur = document.createElement('button');
    cur.className = 'map-resume loc current';
    cur.innerHTML = `<span class="seal">▶</span><span class="meta"><span class="name">${resumeLabel()}</span><span class="desc">Return to where you left off</span></span>`;
    cur.onclick = resumeCurrent;
    const vp = document.createElement('div');
    vp.className = 'map-viewport';
    const canvas = document.createElement('div');
    canvas.className = 'map-canvas';
    canvas.innerHTML = `<img class="map-img" src="${QuilArt.file('map.world')[0]}" alt="The Vale of Embers" draggable="false">`;
    QuilData.mapRegions.forEach(region => region.locs.forEach(loc => {
      const xy = PINS[loc.id]; if (!xy) return;
      const unlocked = s.mapUnlocks.includes(loc.id) || loc.unlocked;
      const pin = document.createElement('button');
      pin.className = 'map-pin loc ' + (unlocked ? 'unlocked' : 'locked') + (loc.boss ? ' boss' : '') +
        (loc.id === currentId ? ' objective' : '') + ' kind-' + loc.kind;
      pin.dataset.loc = loc.id;
      pin.style.left = xy[0] + '%'; pin.style.top = xy[1] + '%';
      const seal = loc.boss ? '☠' : loc.kind === 'town' ? '⌂' : loc.kind === 'side' ? '✦' : loc.kind === 'mission' ? '⚔' : '•';
      let label = loc.name.replace(/^([MS]\d+) · /, '$1 · ');
      if (loc.id === 'm1' && s.flags.mission1Done) label += ' ✓';
      pin.innerHTML = `<span class="pin-dot">${seal}</span><span class="pin-label name">${label}</span>`;
      pin.onclick = locAction(loc, s, unlocked);
      canvas.appendChild(pin);
    }));
    vp.appendChild(canvas);
    root.appendChild(vp);
    const bar = document.createElement('div');
    bar.className = 'map-bar';
    bar.innerHTML = `${QuilExtras.goldChip()}<span class="hp-chip">♥ ${s.hero.hp}/${s.hero.maxHp}</span>
      <button class="btn small" id="map-camp">⛺ Camp · −1 ration (${(s.items || {}).ration || 0})</button>
      ${s.mapUnlocks.includes('waypost') ? '<button class="btn small" id="map-town">⌂ Town</button>' : ''}`;
    root.appendChild(bar);
    root.appendChild(cur);
    bar.querySelector('#map-camp').onclick = QuilExtras.campRest;
    if (bar.querySelector('#map-town')) bar.querySelector('#map-town').onclick = QuilExtras.showTown;
    QuilExtras.unlock('map.world');
    // centre the viewport on the current objective
    requestAnimationFrame(() => {
      const xy = PINS[currentId];
      vp.scrollLeft = Math.max(0, canvas.scrollWidth * xy[0] / 100 - vp.clientWidth / 2);
    });
    // mouse drag-pan (touch uses native scrolling)
    let drag = null;
    vp.onmousedown = e => { drag = { x: e.clientX, l: vp.scrollLeft, moved: false }; };
    window.onmousemove = e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true; vp.scrollLeft = drag.l - dx; };
    window.onmouseup = () => { drag = null; };
  }

  function mountThumbs(root) {
    root.querySelectorAll('[data-art]').forEach(el => QuilArt.mount(el, el.dataset.art));
  }

  function showPack() {
    showScreen('screen-pack');
    const s = QuilSave.get();
    const inv = s.inventory;
    const w = (id) => id ? QuilData.weapons[id]?.name || id : '—';
    $('pack-root').innerHTML = `
      <div class="art-banner" data-art="item.banner"><div class="shade"></div><div class="cap cinzel">Quil's Pack</div></div>
      <div class="purse"><span>⚜ ${s.hero.gold}g</span>
        <span>${Object.entries(s.hero.jewels).map(([k,v]) => `${v} ${k}`).join(', ') || 'no jewels'}</span></div>
      <div class="equip-doll">
        <div class="slot-card"><span class="thumb" data-art="item.hatchet"></span><div class="lab">Main hand</div><div class="item">${w(inv.mainHand)}</div><div class="wt">${lb(QuilSave.weaponWt(inv.mainHand))}</div></div>
        <div class="slot-card"><span class="thumb" data-art="item.bow"></span><div class="lab">Bow</div><div class="item">${w(inv.bow)}</div><div class="wt">${lb(QuilSave.weaponWt(inv.bow))}</div></div>
        <div class="slot-card"><div class="lab">Armour</div><div class="item">${inv.armour || 'None'}</div></div>
        <div class="slot-card"><span class="thumb" data-art="item.arrows"></span><div class="lab">Quiver</div><div class="item">${Object.entries(inv.quiver).filter(([,n])=>n>0).map(([k,n])=>`${k}×${n}`).join(', ')||'empty'}</div><div class="wt">${lb(Object.values(inv.quiver).reduce((a, n) => a + (n || 0), 0) * QuilSave.WT.arrow)}</div></div>
      </div>
      ${loadBar()}
      <h3 class="cinzel" style="color:var(--gold);font-size:14px">Pack <small class="pack-hint">tap an item to drop it</small></h3>
      <div class="pack-grid" id="pack-grid"></div>`;
    mountThumbs($('pack-root'));
    renderPackGrid($('pack-grid'), () => showPack());
  }

  /* ---- Weight & encumbrance UI ---- */
  const lb = n => QuilSave.fmtLb(n);
  function loadBar() {
    const c = QuilSave.carried(), cap = QuilSave.capacity(), over = c > cap;
    return `<div class="load-bar${over ? ' over' : ''}"><div class="lb-row"><span>Load ${lb(c).replace(' lb', '')} / ${cap} lb</span><span class="lb-cap">Might ${QuilSave.get().hero.might} · 30 + 5×Might</span></div>
      <div class="lb-track"><i style="width:${Math.min(100, c / cap * 100)}%"></i></div>
      ${over ? `<div class="lb-warn">⚠ Over-encumbered: −1 to Edge rolls (stealth, bow, flee) and −2 on the forced march. Drop something.</div>` : ''}</div>`;
  }
  // Pack cells: weapons in pack, then supply stacks. Tap a cell to drop it (equipped kit lives in the slots above and can't be dropped).
  function packEntries() {
    const s = QuilSave.get(), inv = s.inventory;
    return inv.pack.map((id, i) => ({ kind: 'w', id, i, ico: QuilData.weapons[id]?.type === 'bow' ? '🏹' : '⚔️', name: QuilData.weapons[id]?.name || id, wt: QuilSave.weaponWt(id) }))
      .concat(Object.entries(s.items || {}).filter(([, n]) => n > 0).map(([k, n]) => ({ kind: 'i', id: k, n, ico: QuilExtras.ITEM[k]?.icon || '🎒', name: `${QuilExtras.ITEM[k]?.name || k} ×${n}`, wt: n * QuilSave.itemWt(k) })));
  }
  function dropEntry(e) {
    const s = QuilSave.get();
    if (e.kind === 'w') s.inventory.pack.splice(s.inventory.pack.indexOf(e.id), 1);
    else s.items[e.id] = Math.max(0, (s.items[e.id] || 0) - 1);
    QuilSave.save();
  }
  function renderPackGrid(grid, after) {
    const entries = packEntries();
    const slots = Math.max(12, Math.ceil(entries.length / 4) * 4);
    grid.innerHTML = '';
    for (let i = 0; i < slots; i++) {
      const e = entries[i], cell = document.createElement('div');
      cell.className = 'pack-cell' + (e ? ' has' : '');
      cell.innerHTML = e ? `<div class="ico">${e.ico}</div>${e.name}<div class="wt">${lb(e.wt)}</div>` : `<div class="ico">·</div>`;
      if (e) cell.onclick = () => {
        const what = e.kind === 'w' ? e.name : `1 × ${QuilExtras.ITEM[e.id]?.name || e.id} (${lb(QuilSave.itemWt(e.id))})`;
        if (!confirm(`Drop ${what}? It will be left behind for good.`)) return;
        dropEntry(e); toast(`Dropped ${e.kind === 'w' ? e.name : QuilExtras.ITEM[e.id]?.name || e.id}`); after();
      };
      grid.appendChild(cell);
    }
  }
  // Loot/purchase that would push Quil over: Take anyway / Leave it / Drop something. Resolves true to take.
  function overflowPrompt(addLb, label) {
    if (QuilSave.carried() + addLb <= QuilSave.capacity()) return Promise.resolve(true);
    return new Promise(res => {
      const ov = document.createElement('div'); ov.className = 'weight-overlay';
      const draw = () => {
        const fits = QuilSave.carried() + addLb <= QuilSave.capacity();
        ov.innerHTML = `<div class="weight-sheet"><h3 class="cinzel">Too heavy?</h3>
          <p>${label} weighs ${lb(addLb)}. You carry ${lb(QuilSave.carried())} of ${QuilSave.capacity()} lb.${fits ? ' It fits now.' : ' Taking it leaves you over-encumbered.'}</p>
          ${loadBar()}<div class="pack-grid wo-grid"></div>
          <div class="choices"><button class="btn primary" data-k="take">${fits ? 'Take it' : 'Take anyway'}</button><button class="btn ghost" data-k="leave">Leave it</button>${fits ? '' : '<button class="btn ghost" data-k="drop">Drop something…</button>'}</div></div>`;
        ov.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
          if (b.dataset.k === 'drop') { ov.querySelector('.wo-grid').classList.add('open'); renderPackGrid(ov.querySelector('.wo-grid'), draw); return; }
          ov.remove(); const take = b.dataset.k === 'take';
          if (take && QuilSave.carried() + addLb > QuilSave.capacity()) setTimeout(() => toast('Over-encumbered: −1 to Edge rolls until you drop something'), 50);
          res(take);
        });
      };
      document.body.appendChild(ov); draw();
    });
  }
  function warnIfOver(wasOver) { if (!wasOver && QuilSave.overloaded()) toast(`Over-encumbered (${lb(QuilSave.carried())} / ${QuilSave.capacity()} lb): −1 to Edge rolls`); }

  function showHero() {
    showScreen('screen-hero');
    const h = QuilSave.get().hero;
    const need = 100 * h.level;
    QuilArt.mount($('hero-portrait'), 'char.quil');
    $('hero-root').querySelector('.hero-stats-fill').innerHTML = `
      <div><strong class="cinzel" style="color:var(--gold)">${h.name}</strong>
        <div style="font-size:14px;color:#9a8a70">Level ${h.level} · XP ${h.xp}/${need}</div>
        <div class="xp-bar"><i style="width:${Math.min(100,(h.xp/need)*100)}%"></i></div>
        <div style="margin-top:6px">HP ${h.hp}/${h.maxHp}</div>
      </div>
      <div class="stat-grid" style="margin-top:12px">
        ${['might','edge','grit','wits','charm'].map(k =>
          `<div class="stat-row"><span class="name">${k}</span><span class="val">${h[k]}</span></div>`).join('')}
      </div>
      <div class="corruption-gauge">
        <div class="cinzel" style="font-size:12px;color:#a07070">Corruption · ${h.corruption}/100</div>
        <div class="bar"><i style="width:${h.corruption}%"></i></div>
      </div>
      <p style="font-size:13px;color:#8a7a60">Feats unlock at levels 3, 6, 9, 12, 15. Missions 1–2 playable.</p>`;
  }

  function showHearth() {
    showScreen('screen-hearth');
    const s = QuilSave.get();
    const t = s.romance.tamsin;
    let html = `<div class="art-banner" data-art="scene.camp"><div class="shade"></div><div class="cap cinzel">Hearth &amp; Camp</div></div>`;
    if (!t) {
      html += `<p style="color:#8a7a60">No one at the Hearth yet. Rescue Tamsin in Mission 1.</p>`;
    } else {
      const hearts = Math.min(5, Math.ceil(t.affection / 20));
      html += `<div class="damsel-card">
        <div class="hero-portrait" id="tamsin-art" style="width:64px;height:64px"></div>
        <div>
          <div class="cinzel" style="color:var(--gold)">Tamsin Reed</div>
          <div class="hearts">${'♥'.repeat(hearts)}${'♡'.repeat(5-hearts)} · Aff ${t.affection}</div>
          <div style="font-size:13px;color:#9a8a70">${t.status} · ${t.location}</div>
          <div style="font-size:13px;margin-top:4px">Likes honesty & home · Dislikes cruelty · Heart 5 · Low tolerance</div>
        </div>
      </div>`;
    }
    const y = s.romance.ysolde;
    if (y) {
      const yh = Math.min(5, Math.ceil(y.affection / 20));
      html += `<div class="damsel-card">
        <div class="hero-portrait" id="ysolde-art" style="width:64px;height:64px"></div>
        <div>
          <div class="cinzel" style="color:var(--gold)">Ysolde Fane</div>
          <div class="hearts">${'♥'.repeat(yh)}${'♡'.repeat(5-yh)} · Aff ${y.affection}</div>
          <div style="font-size:13px;color:#9a8a70">${y.status} · ${y.location}</div>
          <div style="font-size:13px;margin-top:4px">Likes cleverness & herbs · Dislikes boasting · Heart 6${s.flags.poultice ? ' · Perk: Herbal Poultices (potions +3, bandages +2)' : ''}</div>
        </div>
      </div>`;
    }
    html += `<h3 class="cinzel" style="color:var(--gold);font-size:14px;margin-top:16px">Family</h3>
      <p style="color:#8a7a60;font-size:14px">Maren, Wren and Elsie are on the Tithe road. Their captivity is implied only — find the acorn marks. Elsie awaits M5; Wren M10; Maren M20.</p>`;
    $('hearth-root').innerHTML = html;
    mountThumbs($('hearth-root'));
    if (t) QuilArt.mount($('tamsin-art'), 'char.tamsin');
    if (y) QuilArt.mount($('ysolde-art'), 'char.ysolde');
  }

  function showJournal() {
    showScreen('screen-journal');
    const s = QuilSave.get();
    const rolls = QuilDice.getLog().slice(-15).reverse();
    $('journal-root').innerHTML = `
      <div class="art-banner tall" data-art="char.mawrot"><div class="shade"></div>
        <div class="cap"><span class="cinzel">Mawrot, the Goblin King</span><small>He took the eye of Sir Tomas's blade. He wants the son.</small></div></div>
      <button class="btn primary gal-open" id="btn-gallery" style="width:100%;margin-bottom:12px">🖼 Gallery · ${Object.keys(s.gallery || {}).length} images unlocked</button>
      <h3 class="cinzel" style="color:var(--gold);font-size:14px">Mission Log</h3>
      <p>${s.flags.prologueDone ? '✓ Prologue' : '○ Prologue'} · ${s.flags.mission1Done ? '✓ M1 Ashes of Hollowmere' : '○ M1 Ashes of Hollowmere'} · ${s.flags.mission2Done ? '✓' : '○'} M2 The Charcoal Track</p>
      <h3 class="cinzel" style="color:var(--gold);font-size:14px;margin-top:14px">Intel</h3>
      <div class="intel-cards">${(s.intel||[]).map(i=>`<span class="intel-card ${i.false?'':''}">[${i.type}] ${i.text}</span>`).join('') || '<span style="color:#8a7a60">None</span>'}</div>
      <h3 class="cinzel" style="color:var(--gold);font-size:14px;margin-top:14px">Roll Log</h3>
      <div style="font-size:13px;color:#9a8a70">${rolls.map(r =>
        `${r.total} vs ${r.target} → ${r.outcome} (nat ${r.natural})`).join('<br>') || 'No rolls yet'}</div>`;
    mountThumbs($('journal-root'));
    $('btn-gallery').onclick = QuilExtras.showGallery;
  }

  function resume() {
    const s = QuilSave.get();
    if (!s) return initTitle();
    $('auto-roll-toggle').classList.toggle('on', s.settings.diceMode === 'auto');
    if (window.QuilEnsure) QuilEnsure(s);
    if (s.flags.mission1Done && !s.mapUnlocks.includes('m2')) { s.mapUnlocks.push('m2'); QuilSave.save(); }
    if (s.flags.mission1Done && !s.mapUnlocks.includes('waypost')) { s.mapUnlocks.push('waypost'); QuilSave.save(); }
    if (!s.flags.prologueDone && !s.flags.prologueIdx) startPrologue();
    else if (s.flags.mission1Done && s.flags.m2Stage && !s.flags.mission2Done) QuilM2.resume();
    else if (s.flags.mission1Done) showMap();
    else resumeCurrent();
  }

  function bindNav() {
    document.querySelectorAll('#bottom-nav button').forEach(b => {
      b.onclick = () => {
        const map = {
          'screen-map': showMap,
          'screen-pack': showPack,
          'screen-hero': showHero,
          'screen-hearth': showHearth,
          'screen-journal': showJournal,
        };
        map[b.dataset.screen]?.();
      };
    });
    $('auto-roll-toggle').onclick = () => {
      $('auto-roll-toggle').classList.toggle('on');
      const s = QuilSave.get();
      if (s) {
        s.settings.diceMode = $('auto-roll-toggle').classList.contains('on') ? 'auto' : 'physical';
        QuilSave.save();
        const sel = $('title-dice-mode');
        if (sel) sel.value = s.settings.diceMode;
      }
    };
  }

  function boot() {
    bindNav();
    QuilSave.load();
    if (/[?&]dev=m2\b/.test(location.search) && window.QuilM2) return QuilM2.devJump();
    initTitle();
  }

  return { overflowPrompt, warnIfOver, loadBar, beat, witsRoll, witsCard, checkLevel, mountThumbs, showPlace, initTitle, boot, resumeCurrent, toast, showScreen, showMap, showPack, showHero, showHearth, showJournal, resume };
})();
