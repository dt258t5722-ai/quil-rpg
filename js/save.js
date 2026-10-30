/* localStorage autosave */
window.QuilSave = (() => {
  const KEY = 'quil-rpg-save-v1';
  let state = null;

  function defaultState() {
    return {
      version: QuilData.version,
      created: Date.now(),
      updated: Date.now(),
      settings: { diceMode: 'physical' },
      flags: { prologueDone: false, mission1Done: false, introCoach: false },
      hero: {
        name: 'Quil Ashby',
        level: 1, xp: 0,
        might: 1, edge: 1, grit: 1, wits: 0, charm: 1,
        freePointsSpent: false,
        hp: 25, maxHp: 25,
        corruption: 0,
        feats: [],
        gold: 0,
        jewels: {},
      },
      inventory: {
        mainHand: 'tomas_hatchet',
        offHand: null,
        bow: 'hunting_bow',
        armour: null,
        quiver: { broadhead: 12, bodkin: 0, fire: 0, barbed: 0, blunt: 2, whistler: 1 },
        pack: [],
        selectedArrow: 'broadhead',
      },
      romance: {},
      allies: [],
      intel: [],
      captives: [],
      mapUnlocks: ['hollowmere', 'ashby_farm', 'hollowmere_mill', 'm1'],
      rollLog: [],
      scene: 'title',
    };
  }

  function calcMaxHp(h) {
    return 20 + 5 * h.grit + 4 * (h.level - 1);
  }

  /* ---- Weight & encumbrance (lb). Gold and jewels are weightless. Load is always computed from inventory, so old saves need no migration. ---- */
  const WT = {
    weapons: { tomas_hatchet: 3, hunting_bow: 3, short_sword: 4, spear: 6, skinning_knife: 1, woodsman_axe: 7, goblin_shiv: 1, goblin_shortbow: 2, wolf_fangs: 0.5 },
    arrow: 0.1,
    items: { minor_potion: 0.5, potion: 1, bandage: 0.2, rope: 4, ration: 1, torch: 1 },
  };
  const r1 = n => Math.round(n * 10) / 10;
  const weaponWt = id => id ? (WT.weapons[id] ?? 3) : 0;
  const itemWt = k => WT.items[k] ?? 1;
  function capacity(st) { st = st || state; return 30 + 5 * (st?.hero?.might || 0); }
  function load_(st) {
    st = st || state; if (!st) return 0; const inv = st.inventory || {};
    let w = weaponWt(inv.mainHand) + weaponWt(inv.offHand) + weaponWt(inv.bow);
    (inv.pack || []).forEach(id => { w += weaponWt(id); });
    Object.values(inv.quiver || {}).forEach(n => { w += (n || 0) * WT.arrow; });
    Object.entries(st.items || {}).forEach(([k, n]) => { w += (n || 0) * itemWt(k); });
    return r1(w);
  }
  const overloaded = st => load_(st) > capacity(st);
  const encMods = () => overloaded() ? [{ label: 'Over-encumbered', value: -1 }] : [];
  const fmtLb = n => `${r1(n)} lb`;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { state = null; return null; }
      state = JSON.parse(raw);
      return state;
    } catch (e) {
      console.warn('save load failed', e);
      state = null;
      return null;
    }
  }

  function get() { return state; }

  function set(s) { state = s; }

  function save() {
    if (!state) return;
    state.updated = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('save failed', e);
    }
  }

  function newGame(stats, diceMode) {
    state = defaultState();
    state.settings.diceMode = diceMode || 'physical';
    Object.assign(state.hero, stats);
    state.hero.maxHp = calcMaxHp(state.hero);
    state.hero.hp = state.hero.maxHp;
    state.hero.freePointsSpent = true;
    save();
    return state;
  }

  function hasSave() {
    return !!localStorage.getItem(KEY);
  }

  function clear() {
    localStorage.removeItem(KEY);
    state = null;
  }

  // Autosave on background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });

  return { WT, weaponWt, itemWt, capacity, carried: load_, overloaded, encMods, fmtLb, load, get, set, save, newGame, hasSave, clear, defaultState, calcMaxHp, KEY };
})();
