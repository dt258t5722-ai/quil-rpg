/* Quil RPG — static data for prologue + Mission 1 vertical slice */
window.QuilData = {
  version: '1.1-slice',

  weapons: {
    tomas_hatchet: { id: 'tomas_hatchet', name: "Tomas's Hatchet", type: 'melee', dmg: [4, 8], base: 3, scale: 0.5, acc: 1, notes: 'Sentimental' },
    hunting_bow: { id: 'hunting_bow', name: 'Hunting Bow', type: 'bow', dmg: [3, 9], base: 2, scale: 0.5, acc: 1 },
    short_sword: { id: 'short_sword', name: 'Short Sword', type: 'melee', dmg: [4, 9], base: 3, scale: 1.0, acc: 1 },
    spear: { id: 'spear', name: 'Spear', type: 'melee', dmg: [5, 10], base: 4, scale: 1.0, acc: 1, notes: 'Reach' },
    skinning_knife: { id: 'skinning_knife', name: 'Skinning Knife', type: 'melee', dmg: [2, 6], base: 2, scale: 0.5, acc: 1, notes: '+4 damage on takedowns' },
    goblin_shiv: { id: 'goblin_shiv', name: 'Goblin Shiv', type: 'melee', dmg: [2, 6], base: 2, scale: 0.5, acc: 2, durability: 3, enemy: true },
    goblin_shortbow: { id: 'goblin_shortbow', name: 'Goblin Shortbow', type: 'bow', dmg: [2, 6], base: 2, scale: 0.5, acc: 0, durability: 2, enemy: true },
  },

  arrows: {
    broadhead: { id: 'broadhead', name: 'Broadhead', cost: 1, dmgShift: 1, unarmouredOnly: true },
    bodkin: { id: 'bodkin', name: 'Bodkin', cost: 2, ignoreArmour: 2 },
    fire: { id: 'fire', name: 'Fire', cost: 4, dmgShift: 1, burn: 2, burnRounds: 3, stopRegen: true },
    barbed: { id: 'barbed', name: 'Barbed', cost: 3, bleed: 2, guardDrop: 1 },
    blunt: { id: 'blunt', name: 'Blunt', cost: 1, stun: true },
    whistler: { id: 'whistler', name: 'Whistler', cost: 2, noDamage: true, sneakBonus: 2 },
  },

  enemies: {
    goblin_cutter: {
      id: 'goblin_cutter', name: 'Goblin Cutter', artId: 'enemy.goblin_cutter',
      hp: 10, guard: 5, attack: 5, dmg: 3, traits: ['swarm'],
      weapon: 'goblin_shiv', resolve: 5, emoji: '🗡️'
    },
    goblin_archer: {
      id: 'goblin_archer', name: 'Goblin Archer', artId: 'enemy.goblin_archer',
      hp: 12, guard: 6, attack: 6, dmg: 3, traits: ['ranged'],
      weapon: 'goblin_shortbow', resolve: 5, emoji: '🏹'
    },
    goblin_brute: {
      id: 'goblin_brute', name: 'Goblin Brute', artId: 'enemy.goblin_brute',
      hp: 16, guard: 5, attack: 6, dmg: 4, traits: ['horn'], percep: -2, // strong, slow-witted
      weapon: 'goblin_shiv', resolve: 6, emoji: '🪓'
    },
  },

  damsel: {
    tamsin: {
      id: 'tamsin', name: 'Tamsin Reed', artId: 'char.tamsin',
      brief: "Freckled miller's daughter, sharp-tongued, Quil's childhood friend.",
      likes: 'Honesty, home', dislikes: 'Cruelty',
      tolerance: 'Low', heart: 5, emoji: '👩'
    }
  },

  mapRegions: [
    {
      id: 'hollowmere_vale', name: 'Hollowmere Vale',
      locs: [
        { id: 'hollowmere', name: 'Hollowmere', kind: 'town', desc: 'Hub town — in ruins', unlocked: true },
        { id: 'ashby_farm', name: 'Ashby Farm', kind: 'place', desc: 'Home. Smoke on the wind.', unlocked: true },
        { id: 'hollowmere_mill', name: 'Hollowmere Mill', kind: 'place', desc: 'Tamsin may hide here', unlocked: true },
        { id: 'waypost', name: "King's Road Waypost", kind: 'town', desc: 'Inn, market & smithy', unlocked: false },
        { id: 'm1', name: 'M1 · Ashes of Hollowmere', kind: 'mission', desc: 'Clear the stragglers', unlocked: true, mission: 1 },
      ]
    },
    {
      id: 'thornwood', name: 'Thornwood',
      locs: [
        { id: 'm2', name: 'M2 · The Charcoal Track', kind: 'mission', desc: 'Locked', unlocked: false, mission: 2 },
        { id: 'm3', name: 'M3 · Old Toll\'s Bridge', kind: 'mission', desc: 'Locked', unlocked: false, mission: 3 },
        { id: 's1', name: 'S1 · Elder Oak', kind: 'side', desc: 'Locked', unlocked: false },
      ]
    },
    {
      id: 'briarwatch', name: 'Briarwatch March',
      locs: [
        { id: 'briarwatch', name: 'Briarwatch', kind: 'town', desc: 'Locked', unlocked: false },
        { id: 'm4', name: 'M4 · Siege of Briarwatch', kind: 'mission', desc: 'Locked', unlocked: false },
        { id: 'm5', name: 'M5 · Redstone Quarry', kind: 'mission', desc: 'Boss · Locked', unlocked: false, boss: true },
      ]
    },
    {
      id: 'fenmire', name: 'Fenmire',
      locs: [
        { id: 'm6', name: 'M6 · Fenmire Crossing', kind: 'mission', desc: 'Locked', unlocked: false },
      ]
    },
    {
      id: 'saltmarrow', name: 'Saltmarrow Coast',
      locs: [
        { id: 'saltmarrow', name: 'Saltmarrow', kind: 'town', desc: 'Locked', unlocked: false },
        { id: 'm10', name: 'M10 · The Brinewidow', kind: 'mission', desc: 'Boss · Locked', unlocked: false, boss: true },
      ]
    },
    {
      id: 'grimspire', name: 'Grimspire Mountains',
      locs: [
        { id: 'kettlewick', name: 'Kettlewick', kind: 'town', desc: 'Locked', unlocked: false },
        { id: 'm15', name: 'M15 · Cinder Forge', kind: 'mission', desc: 'Boss · Locked', unlocked: false, boss: true },
      ]
    },
    {
      id: 'gloamfang', name: 'Gloamfang Underkingdom',
      locs: [
        { id: 'last_lantern', name: 'Last Lantern', kind: 'town', desc: 'Locked', unlocked: false },
        { id: 'm20', name: 'M20 · Throne of Teeth', kind: 'mission', desc: 'Final Boss · Locked', unlocked: false, boss: true },
      ]
    },
  ],

  mission1: {
    id: 1,
    name: 'Ashes of Hollowmere',
    location: 'Hollowmere farms and town square (burning)',
    objective: 'Bury your father, then clear the stragglers looting the town.',
    enemies: [
      { type: 'goblin_cutter', id: 'gc1' },
      { type: 'goblin_cutter', id: 'gc2' },
      { type: 'goblin_cutter', id: 'gc3' },
      { type: 'goblin_cutter', id: 'gc4' },
      { type: 'goblin_archer', id: 'ga1' },
      { type: 'goblin_brute', id: 'gb1' },
    ],
    alertness: 5,
    /* Tactical map: 8×6 grid, x right, y down. Facing: N E S W. */
    map: {
      // 9×6 grid over battlemap_m1 (1024×576): each cell is ~114×96 px of the painting
      cols: 9, rows: 6, quil: [2, 4], quilCover: [2, 5],
      terrain: [
        { type: 'building', label: 'The smithy', cells: [[1, 0], [2, 0], [3, 0], [1, 1], [2, 1]] },
        { type: 'building', label: 'The mill & waterwheel', cells: [[5, 0], [6, 0], [5, 1], [6, 1], [7, 1]] },
        { type: 'building', label: 'The chapel house', cells: [[0, 3], [1, 3], [0, 4], [1, 4]] },
        { type: 'cover', label: 'The stone well', cells: [[4, 2]] },
        { type: 'fire', label: 'Burning cart', cells: [[6, 3]] },
        { type: 'fire', label: 'Burning thatched house', cells: [[7, 2], [8, 2], [7, 3], [8, 3]] },
        { type: 'beam', label: 'The gallows beam', cells: [[5, 4]] },
        { type: 'cover', label: 'Low stone wall', cells: [[1, 5], [2, 5], [3, 5], [6, 5], [7, 5]] },
        { type: 'cover', label: 'Barrels', cells: [[5, 5]] },
      ],
      pos: { gc1: [2, 2, 'E'], gc2: [4, 0, 'S'], gc3: [6, 2, 'W'], gc4: [8, 5, 'N'], ga1: [5, 4, 'N'], gb1: [7, 4, 'W'] },
      // Patrols: unaware goblins walk 1 square a round along these, turning at each end (cones sweep)
      patrol: { gc1: [[2, 2], [3, 2], [3, 3]], gc2: [[4, 0], [4, 1]], gc3: [[6, 2], [5, 2]], gc4: [[8, 5], [8, 4]], gb1: [[7, 4], [6, 4]] },
    },
    loot: { gold: 15, jewels: { garnet: 1 }, items: ['tomas_hatchet', 'hunting_bow'], arrows: { broadhead: 12 } },
    rescue: 'tamsin',
    intel: [
      { type: 'Route', text: 'The raiders went into Thornwood by the old charcoal track.' },
      { type: 'Captive', text: '"The red-haired one bit Grukk." (Wren is alive.)' },
    ],
    xp: 120,
  },

  prologue: [
    {
      artId: 'scene.hollowmere_dusk',
      text: "Dusk settles over Hollowmere Vale. You, Quilliam Ashby — Quil to anyone who knows you — walk the path from the far pastures with a sack of late wool. Smoke rises where the town should be. Too much smoke.",
      choices: [{ label: 'Run toward home', next: 1 }]
    },
    {
      artId: 'scene.farmhouse_fire',
      text: "The Ashby farmhouse is burning. Your father Tomas fills the doorway, still gripping his hatchet, blood dark on the linen of his shirt. Orcs and goblins howl in the yard. He sees you. He tries to speak. He does not finish.",
      choices: [
        { label: 'Take his hatchet', next: 2 },
        { label: 'Kneel beside him', next: 2 }
      ]
    },
    {
      artId: 'scene.quil_hatchet',
      text: "Tomas's hatchet fits your hand like it always belonged there. Inside, the hearth is cold ash. Mother Maren's shawl is gone. Wren's skinning knife lies in the dust. Elsie's carved bird is crushed under a boot-print. Chains rattle somewhere east — the Goblin King's Tithe has taken them.",
      choices: [{ label: 'Take the hunting bow and go', next: 3 }]
    },
    {
      artId: 'scene.road_east',
      text: "You bury what you can of your father behind the smokehouse, mark the grave with an acorn stone, and turn toward the burning square. Stragglers still loot Hollowmere. Clear them. Then follow the trail into Thornwood.",
      choices: [{ label: 'Enter Hollowmere square', next: 'mission1' }]
    }
  ],

  feats: [
    { id: 'cleave', name: 'Cleave', desc: 'A kill gives a free attack on another enemy' },
    { id: 'quickdraw', name: 'Quickdraw', desc: 'Shoot and Strike same round, 1/combat' },
    { id: 'silent_step', name: 'Silent Step', desc: '+2 Sneak; failed takedown does not alert all' },
    { id: 'iron_jaw', name: 'Iron Jaw', desc: 'Grazes deal 0 damage' },
    { id: 'silver_tongue', name: 'Silver Tongue', desc: 'Reroll one failed Persuade/Romance per mission' },
  ],
};
