/* v10: Mission 2 · The Charcoal Track (travel checks → waystation fight → loot/cache → Ysolde → town) */
window.QuilM2 = (() => {
  const $ = id => document.getElementById(id);
  const G = () => QuilGame, S = () => QuilSave.get(), D = () => QuilData.mission2;
  const OK = r => ['success', 'strong', 'critical'].includes(r.outcome);
  const save = () => QuilSave.save();
  const stage = st => { S().flags.m2Stage = st; save(); };
  const hasIntel = re => (S().intel || []).some(i => re.test(i.text));
  const addIntel = idx => { const it = D().intel[idx]; if (!S().intel.some(i => i.text === it.text)) S().intel.push(Object.assign({ m: 2 }, it)); };
  const mech = (label, r, t, extra) => `<p class="beat-mech dark">${label} · ${r.total} vs ${t} · ${r.outcome}${extra ? ' · ' + extra : ''}</p>`;
  const gritRoll = (title, target, extra) => QuilDice.promptRoll({ title, target, modifiers: [{ label: 'Grit', value: S().hero.grit }].concat(extra || []) });
  const hurt = n => { const h = S().hero; h.hp = Math.max(1, h.hp - n); save(); return n; };

  /* ---- entry points ---- */
  function fromMap() {
    const s = S();
    if (!s.flags.mission1Done) return G().toast('The Charcoal Track · finish Mission 1 first');
    if (s.flags.mission2Done) {
      return G().showPlace('scene.charcoal_track', `<p><strong>M2 · The Charcoal Track</strong></p><p>The waystation is cold ash and gnawed bones now. Three sets of ruts run on into Thornwood.</p>${hasIntel(/Elder Oak/) ? '<p><em>S1 · The Elder Oak: a rumour for another road. (Coming in a later build.)</em></p>' : ''}`);
    }
    s.flags.m2Stage ? resume() : start();
  }
  function start() {
    const s = S(); QuilEnsure(s);
    s.flags.m2Stage = 'brief'; s.flags.m2Prep = {}; s.flags.m2Looted = false; s.flags.m2Cache = false; s.flags.m2Wind = ['N', 'E', 'S', 'W'][Math.floor(Math.random() * 4)]; save();
    brief();
  }
  function resume() {
    const st = S().flags.m2Stage || 'brief';
    ({ brief, travel: brief, combat: brief, loot, cache, cage, romance: cage })[st]();
  }

  /* ---- brief ---- */
  function brief() {
    stage('brief');
    const m = D(), s = S();
    G().beat('scene.charcoal_track', `<p><strong class="cinzel" style="color:var(--gold)">M2 · ${m.name}</strong></p>
      <p style="color:#b8a88a;font-size:14px">${m.location}</p>
      <p>The wagon ruts run east into Thornwood along the charcoal-burners' track, two days old and deep with the weight of people. Somewhere ahead the raiders left a rear guard to watch the road.</p>
      <p><strong>Objective:</strong> ${m.objective}</p>
      <p><strong>Enemies:</strong> 5 Goblin Cutters, 2 Goblin Archers on watch platforms, 1 Wolf-Rider</p>
      <p style="font-size:14px;color:#9a8a70">Lv ${s.hero.level} · HP ${s.hero.hp}/${s.hero.maxHp} · ${QuilData.weapons[s.inventory.mainHand].name}</p>`, [
      { label: 'Take the charcoal track', fn: deadfall },
      { label: 'Visit the Waypost first', cls: 'ghost', fn: () => QuilExtras.showTown() },
    ]);
  }

  /* ---- travel check 1: deadfall (Wits 7, fail −3 HP) ---- */
  function deadfall() {
    stage('travel');
    G().beat('scene.charcoal_track', `<p>A mile in, the track narrows between two blackened oaks. Every bird has gone quiet. Overhead, a lattice of cut logs hangs wedged in the branches, held up by something you can't see.</p>`, [
      { label: 'Look for the trigger  [Wits vs 7]', fn: async () => {
        const r = await G().witsRoll('Wits · The deadfall', 7);
        const ok = OK(r), s = S(); s.flags.m2Prep.trap = ok ? 'spotted' : 'sprung';
        if (!ok) hurt(3); save();
        G().beat('scene.charcoal_track', `<p class="beat-narr dark">${ok
          ? 'A gut-string trip, dusted with ash so it vanishes against the track. You step over it, then follow the cut marks to a hunter\'s path the goblins use themselves: the back way into their camp.'
          : 'The string parts against your shin. You throw yourself flat and a log the size of a man comes down across your back, knocking the wind out of you and tearing your coat open on the bark.'}</p>`
          + G().witsCard('The deadfall', r, 7, ok ? 'Spotted. You take the hunter\'s path and start the fight in cover at the forest edge.' : `Sprung. −3 HP (now ${s.hero.hp}/${s.hero.maxHp}).`),
          [{ label: 'Follow the ruts', fn: ruts }]);
      } },
    ]);
  }

  /* ---- travel check 2: cart ruts (Wits 6 → [Captive]) ---- */
  function ruts() {
    G().beat('scene.charcoal_track', `<p>Where the track forks round a burnt-out kiln, the ruts multiply. Wheel marks cross and recross in the soft black earth.</p>`, [
      { label: 'Read the ruts  [Wits vs 6]', fn: async () => {
        const r = await G().witsRoll('Wits · Cart ruts', 6, [{ label: 'Farm-raised', value: 1 }]);
        const ok = OK(r); if (ok) addIntel(0); S().flags.m2Prep.ruts = ok; save();
        G().beat('scene.charcoal_track', `<p class="beat-narr dark">${ok
          ? 'Three wagons, not one. Iron tyres, each loaded different: one heavy, one light, one with a wheel that wobbles. Beyond the waystation they split: east, south toward the coast, and north to the mountains. Caught on a splinter of the light wagon\'s track is a single red hair.'
          : 'Ruts over ruts over ruts. Every one of them goes somewhere. You can\'t tell which.'}</p>`
          + G().witsCard('Cart ruts', r, 6, ok ? '+1 intel: [Captive] three wagons, east, coast and mountain.' : 'No intel.'),
          [{ label: 'Push on through the night', fn: march }]);
      } },
    ]);
  }

  /* ---- travel check 3: forced march (Grit 6, fail −2 HP at fight start) ---- */
  function march() {
    G().beat('scene.camp', `<p>Smoke on the ${({ N: 'north', E: 'east', S: 'south', W: 'west' })[S().flags.m2Wind] || 'east'} wind: the waystation is close, but the rear guard will move at first light. No camp tonight. You walk on blistered feet through the dark.</p>`, [
      { label: 'March through the night  [Grit vs 6]', fn: async () => {
        const r = await gritRoll('Grit · Forced march', 6, QuilSave.overloaded() ? [{ label: 'Over-encumbered', value: -2 }] : []);
        const ok = OK(r), s = S(); s.flags.m2Prep.march = ok;
        if (!ok) hurt(2); save();
        G().beat('scene.camp', `<p class="beat-narr dark">${ok
          ? 'You walk until your legs stop arguing. By the grey hour you are lying in the bracken above the waystation, breath slow, hatchet across your knees, watching the goblins piss on their own fire.'
          : 'Somewhere around midnight you stop feeling your feet. You stumble in the dark, wrench a knee, and arrive at the waystation shaking with cold and fatigue.'}</p>`
          + mech('Grit · Forced march', r, 6, ok ? 'fresh' : `you start the fight at −2 HP (${s.hero.hp}/${s.hero.maxHp})`),
          [{ label: 'Into the waystation', fn: fight }]);
      } },
    ]);
  }

  /* ---- the fight ---- */
  function fight() {
    stage('combat');
    QuilCombat.start(async res => {
      const s = S();
      if (!res.won) {
        const lost = Math.floor((s.hero.gold || 0) * 0.25);
        s.hero.gold -= lost; s.hero.hp = 1; s.flags.m2Stage = 'brief'; save();
        return G().beat('place.inn', `<p class="beat-narr dark">Charcoal-burners find you face down in the ash at the edge of the track, cut and bitten, and haul you back to the Waypost on a sledge. You wake in the Crooked Mile with a dog-bite you do not remember getting and a lighter purse.</p>
          <div class="wits-card"><b>Defeat</b> · HP 1/${s.hero.maxHp} · lost ${lost} gold (25%) · rest and try again</div>`,
          [{ label: 'Get up', fn: () => QuilExtras.inn() }]);
      }
      s.flags.m2Key = !!(res.battle && res.battle.wolfKey); save();
      loot();
    }, 2);
  }

  /* ---- loot ---- */
  function loot() {
    stage('loot');
    const s = S(), m = D();
    if (!s.flags.m2Looted) {
      s.flags.m2Looted = true;
      s.hero.gold += m.loot.gold;
      Object.entries(m.loot.jewels).forEach(([k, v]) => s.hero.jewels[k] = (s.hero.jewels[k] || 0) + v);
      Object.entries(m.loot.arrows).forEach(([k, v]) => s.inventory.quiver[k] = (s.inventory.quiver[k] || 0) + v);
      s.hero.xp += m.xp; G().checkLevel(s);
    }
    save();
    const axe = QuilData.weapons.woodsman_axe, inv = s.inventory;
    const wielding = inv.mainHand === 'woodsman_axe';
    G().beat('item.loot', `<h2 class="cinzel" style="color:var(--gold)">Loot</h2>
      <p class="beat-narr dark">${QuilNarrate.pick('m2_victory')}</p>
      <ul class="loot-list">
        <li class="loot-art-row"><span class="thumb" data-art="item.loot"></span>+${m.loot.gold} gold · +2 garnets</li>
        <li class="loot-art-row"><span class="thumb" data-art="item.hatchet"></span>${axe.name} · damage ${axe.dmg[0]}–${axe.dmg[1]} · Acc +${axe.acc}</li>
        <li class="loot-art-row"><span class="thumb" data-art="item.arrows"></span>+${m.loot.arrows.broadhead} broadhead arrows</li>
        <li>+${m.xp} XP · Lv ${s.hero.level}</li>
      </ul>
      <p style="color:#b8a88a">${wielding ? 'The woodsman\'s axe is in your hand.' : 'A woodcutter\'s axe, taken off a dead charcoal-burner. Heavier than your father\'s hatchet, and it bites deeper.'}</p>`, [
      { label: wielding ? 'Done' : 'Take up the Woodsman\'s Axe', fn: () => { equip('woodsman_axe'); cache(); } },
      { label: 'Keep Tomas\'s hatchet (axe to pack)', cls: 'ghost', fn: () => { equip('tomas_hatchet'); cache(); } },
    ]);
    G().mountThumbs($('narrative'));
  }
  function equip(id) {
    const inv = S().inventory;
    [inv.mainHand, 'woodsman_axe'].forEach(w => { if (w && w !== id && !inv.pack.includes(w)) inv.pack.push(w); });
    const wasOver = QuilSave.overloaded();
    inv.pack = inv.pack.filter(w => w !== id); inv.mainHand = id; save(); G().warnIfOver(wasOver);
  }

  /* ---- bonus cache under the hollow stump ---- */
  function cache() {
    stage('cache');
    const s = S();
    if (s.flags.m2Cache) return cage();
    const take = async (txt, card) => {
      const c = D().cache, st = S(); st.flags.m2Cache = true;
      const addLb = txt ? c.items.reduce((a, k) => a + QuilSave.itemWt(k), 0) + Object.values(c.arrows).reduce((a, v) => a + v * QuilSave.WT.arrow, 0) : 0;
      if (txt && !(await G().overflowPrompt(addLb, 'The stump cache'))) { st.hero.gold += c.gold; txt = 'You pocket the silver and leave the rest in the stump. Your pack is heavy enough.'; save(); return G().beat('scene.charcoal_track', `<p class="beat-narr dark">${txt}</p>${card}`, [{ label: 'The wolf pen', fn: cage }]); }
      if (txt) { st.hero.gold += c.gold; c.items.forEach(k => st.items[k] = (st.items[k] || 0) + 1);
        Object.entries(c.arrows).forEach(([k, v]) => st.inventory.quiver[k] = (st.inventory.quiver[k] || 0) + v); }
      save();
      G().beat('scene.charcoal_track', `<p class="beat-narr dark">${txt || 'You kick at the stump\'s roots and find only beetles. Whatever the goblins hid, it stays hidden.'}</p>${card}`, [{ label: 'The wolf pen', fn: cage }]);
    };
    const found = 'You get your fingers under the rotten lip of the stump and heave. Inside, wrapped in a goblin\'s greasy cloak: a fistful of silver, a sealed healing draught, and four wicked barbed arrows.';
    if (hasIntel(/hollow stump/)) {
      return G().beat('scene.charcoal_track', `<p>The captive's words come back: <em>under the hollow stump by the wolf pen.</em></p>`, [
        { label: 'Dig under the stump', fn: () => take(found, `<div class="wits-card"><b>[Loot] intel</b> · cache found: +20 gold, +1 Healing Potion, +4 barbed arrows</div>`) }]);
    }
    G().beat('scene.charcoal_track', `<p>The waystation is quiet but for the flies. By the wolf pen, an old hollow stump has fresh claw-marks and boot scuffs around its roots, too many for a stump nobody cares about.</p>`, [
      { label: 'Search the stump  [Wits vs 7]', fn: async () => {
        const r = await G().witsRoll('Wits · The hollow stump', 7);
        take(OK(r) ? found : null, G().witsCard('The hollow stump', r, 7, OK(r) ? 'Bonus cache: +20 gold, +1 Healing Potion, +4 barbed arrows.' : 'Nothing found.'));
      } },
      { label: 'Leave it', cls: 'ghost', fn: () => { S().flags.m2Cache = true; save(); cage(); } },
    ]);
  }

  /* ---- the cage: key or Grit 7 ---- */
  function cage() {
    stage('cage');
    const s = S();
    const btns = [];
    if (s.flags.m2Key) btns.push({ label: 'Use the Wolf-Rider\'s key', fn: () => opened('key') });
    btns.push({ label: 'Break the lock  [Grit vs 7]', cls: s.flags.m2Key ? '' : 'primary', fn: async () => {
      const r = await gritRoll('Grit · Break the lock', 7, [{ label: QuilData.weapons[S().inventory.mainHand].name, value: S().inventory.mainHand === 'woodsman_axe' ? 1 : 0 }]);
      if (OK(r)) return opened('grit', mech('Grit · Break the lock', r, 7));
      hurt(2);
      G().beat('scene.charcoal_track', `<p class="beat-narr dark">The haft slips and skins your knuckles to the bone. The padlock just laughs at you, iron and ugly.</p>` + mech('Grit · Break the lock', r, 7, `−2 HP (${S().hero.hp}/${S().hero.maxHp}) · try again`), [{ label: 'Again', fn: cage }]);
    } });
    G().beat('scene.charcoal_track', `<p>Behind the wolf pen stands a lean-to, its door chained shut with a heavy goblin padlock. Someone inside is swearing, inventively, in a voice that is not a goblin's.</p>
      <p>"If that's another one of you lot," the voice calls, "I bite too."</p>`, btns);
  }
  function opened(how, extra) {
    stage('romance');
    const txt = how === 'key' ? 'The Wolf-Rider\'s key turns stiff and gritty in the lock.' : 'The hasp tears out of the old wood with a shriek of nails.';
    rescue(txt, extra || '');
  }

  /* ---- Ysolde: rescue → spark/recruit → flirt → kiss → fade ---- */
  const setY = (aff, status, loc) => {
    const s = S(); s.romance.ysolde = Object.assign(s.romance.ysolde || {}, { affection: Math.min(100, aff), status, location: loc });
    s.flags.poultice = true; save();
  };
  function rescue(txt, extra) {
    G().beat('romance.y_rescue', `<p class="beat-narr dark">${txt}</p>${extra}
      <p>The door swings out and <strong>Ysolde Fane</strong> steps into the daylight on her own two feet: copper braids, herb-stained fingers, a satchel still slung on her shoulder. A hedge-witch's apprentice from the Thornwood fringe.</p>
      <p>She looks at the dead goblins, then at you, then at the cut on your arm. "You're bleeding on my yarrow," she says. "Sit down before you fall down."</p>`, [
      { label: 'Offer your hand (Romance spark)', fn: () => spark('romance') },
      { label: 'Ask her to come with you (Recruit / ally-style)', fn: () => spark('recruit') },
      { label: 'Point her toward the Waypost', cls: 'ghost', fn: () => { setY(5, 'acquainted', 'waypost'); G().toast('Ysolde heads for the Waypost'); finish(); } },
    ]);
  }
  async function spark(kind) {
    const d = QuilData.damsel.ysolde, h = S().hero;
    const r = await QuilDice.promptRoll({ title: kind === 'romance' ? 'Stage 1 · Spark: Ysolde' : 'Recruit: Ysolde', target: d.heart, modifiers: [{ label: 'Charm', value: h.charm }, { label: 'Freed her', value: 1 }] });
    const perk = `<p class="beat-mech dark">🌿 Perk · Herbal Poultices: potions heal +3, bandages +2</p>`;
    if (kind === 'recruit') {
      const ok = OK(r); setY(ok ? 20 : 8, ok ? 'fond' : 'acquainted', ok ? 'with you' : 'waypost');
      return G().beat('romance.y_rescue', `<p class="beat-narr dark">${ok ? '"Someone has to keep you alive," she says, already re-stoppering your potions with something green. "Might as well be me."' : '"I\'ve my own road," she says, but she presses a pouch of herbs into your hand before she goes.'}</p>` + perk + mech('Recruit', r, d.heart), [{ label: 'Continue', fn: finish }]);
    }
    if (!OK(r)) {
      setY(r.outcome === 'fumble' ? 3 : 8, 'acquainted', 'waypost');
      return G().beat('romance.y_rescue', `<p class="beat-narr dark">You say something meant to be gallant. She raises one eyebrow so high it nearly leaves her face. "Charming. Here, for the arm." She hands you a poultice and walks toward the Waypost.</p>` + perk + mech('Spark', r, d.heart), [{ label: 'Continue', fn: finish }]);
    }
    const aff = r.outcome === 'critical' ? 35 : 20;
    setY(aff, 'fond', 'with you'); S().flags.ySpark = ['critical', 'strong'].includes(r.outcome) ? 1 : 0; save();
    G().beat('romance.y_rescue', `<p class="beat-narr dark">She takes your hand, and turns it over, and frowns at your split knuckles like they've personally offended her. "Fine. You can stay. I'll need someone to carry the satchel."</p>` + perk + mech('Stage 1 · Spark', r, d.heart, 'affection ' + aff), [
      { label: 'Make camp in the Thornwood with her', fn: camp },
      { label: 'Not tonight. Walk her to the Waypost', cls: 'ghost', fn: finish },
    ]);
  }
  function camp() {
    G().beat('scene.camp', `<p>A small fire under the old oaks, well off the track. Ysolde grinds yarrow and woundwort in a cup of bark and paints it on your arm with two fingers. It stings like a wasp.</p>
      <p>"Hold still. If you whimper I'm telling everyone."</p>`, [
      { label: 'Ask her to teach you the herbs  [Charm vs 6, +1 cleverness]', fn: () => flirt('clever') },
      { label: 'Tell her how you took the Wolf-Rider  [Charm vs 6, −1 boasting]', fn: () => flirt('boast') },
    ]);
  }
  async function flirt(style) {
    const s = S(), mods = [{ label: 'Charm', value: s.hero.charm }];
    if (s.flags.ySpark) mods.push({ label: 'Strong spark', value: 1 });
    mods.push(style === 'clever' ? { label: 'Cleverness (she likes)', value: 1 } : { label: 'Boasting (she dislikes)', value: -1 });
    const r = await QuilDice.promptRoll({ title: 'Stage 2 · Flirt: Ysolde', target: 6, modifiers: mods });
    const y = s.romance.ysolde;
    if (!OK(r)) {
      setY(y.affection + 3, 'fond', 'with you');
      return G().beat('scene.camp', `<p class="beat-narr dark">${style === 'boast' ? '"And then you were very brave," she says flatly, tying off the bandage hard enough to make you wince.' : 'You mix up woundwort and wolfsbane twice. She sighs and takes the cup back.'} She sleeps with her back to the fire.</p>` + mech('Stage 2 · Flirt', r, 6, 'affection ' + S().romance.ysolde.affection), [{ label: 'Sleep', fn: finish }]);
    }
    setY(y.affection + 12, 'smitten', 'with you');
    const line = style === 'clever' ? 'She guides your fingers through the leaves: yarrow, feverfew, self-heal. She doesn\'t let go when the lesson ends.' : '"You took a wolf off its feet with a hatchet," she says. "That\'s either brave or stupid." Her fingers stay on your wrist. "I haven\'t decided which I like."';
    await QuilExtras.cine('romance.y_flirt', line, 'Ysolde · Smitten', 3200);
    G().beat('romance.y_flirt', `<p class="beat-narr dark">${line}</p><p>The fire settles. Above you, the Thornwood canopy is full of stars.</p>` + mech('Stage 2 · Flirt', r, 6, 'affection ' + S().romance.ysolde.affection), [
      { label: 'Lean closer  [Charm vs 7]', fn: final },
      { label: 'Bank the fire and sleep', cls: 'ghost', fn: finish },
    ]);
  }
  async function final() {
    const s = S();
    const r = await QuilDice.promptRoll({ title: 'Stage 3 · Heart: Ysolde', target: 7, modifiers: [{ label: 'Charm', value: s.hero.charm }, { label: 'Smitten', value: 1 }] });
    const y = s.romance.ysolde;
    if (!OK(r)) {
      setY(y.affection + 2, 'smitten', 'with you');
      return G().beat('romance.y_flirt', `<p class="beat-narr dark">She puts one herb-green finger on your lips. "Not in a goblin camp, Quil Ashby. Ask me somewhere that smells better."</p>` + mech('Stage 3 · Heart', r, 7), [{ label: 'Sleep', fn: finish }]);
    }
    setY(y.affection + 15, 'devoted', 'with you');
    G().beat('romance.y_kiss', `<p class="beat-narr dark">She tastes of mint and woodsmoke. Under the Thornwood canopy, with the whole burning world a long way off, she kisses you slowly, like she's making sure of something.</p>` + mech('Stage 3 · Heart', r, 7, 'affection ' + S().romance.ysolde.affection), [{ label: 'Let the night take you', fn: fade }]);
  }
  function fade() {
    const f = $('fade-black'); f.classList.add('show');
    f.innerHTML = `<div style="font-size:40px;margin-bottom:16px">🌿</div><p class="cinzel" style="color:#C8A24A">Under the Oaks</p>
      <p style="max-width:280px;line-height:1.5;color:#8a7a60">Her braids loose across your chest. Crushed mint and the warm smell of her skin. The fire burns down to embers and the story, as promised, <em>fades to black</em>.</p>
      <p style="margin-top:24px;color:#6a5a48;font-size:14px">Dawn. Birdsong. The ruts still lead away.</p>
      <button class="btn primary" style="margin-top:28px" id="btn-dawn">At dawn</button>`;
    $('btn-dawn').onclick = () => { f.classList.remove('show'); finish(); };
  }

  /* ---- finish ---- */
  function finish() {
    const s = S();
    s.flags.mission2Done = true; s.flags.m2Stage = 'done';
    ['waypost', 's1'].forEach(k => { if (k === 's1' && !hasIntel(/Elder Oak/)) return; if (!s.mapUnlocks.includes(k)) s.mapUnlocks.push(k); });
    save();
    QuilExtras.missionComplete(2);
  }

  /* ---- ?dev=m2: a level-2 post-M1 save, straight to the brief ---- */
  function devJump() {
    let s = QuilSave.get();
    if (!s || !s.flags.mission1Done) {
      s = QuilSave.newGame({ might: 2, edge: 2, grit: 1, wits: 1, charm: 2 }, 'auto');
      Object.assign(s.flags, { prologueDone: true, mission1Done: true, m1Stage: 'done', introCoach: true });
      s.hero.level = 2; s.hero.gold = 25; s.hero.jewels = { garnet: 1 };
      s.hero.maxHp = QuilSave.calcMaxHp(s.hero); s.hero.hp = s.hero.maxHp;
      s.mapUnlocks.push('m2', 'waypost'); s.romance.tamsin = { affection: 40, status: 'smitten', location: 'hearth' };
    }
    QuilEnsure(s); QuilSave.save();
    $('bottom-nav').classList.add('visible');
    start();
  }

  return { start, resume, fromMap, devJump };
})();
