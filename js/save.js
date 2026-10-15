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

  return { load, get, set, save, newGame, hasSave, clear, defaultState, calcMaxHp, KEY };
})();
