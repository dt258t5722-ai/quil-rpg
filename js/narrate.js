/* Narration pools: gritty dark-fantasy lines keyed by action + outcome.
   Tokens: {e} enemy, {w} weapon, {a} arrow, {d} damage, {t} thrown weapon. No back-to-back repeats per key. */
window.QuilNarrate = (() => {
  const P = {
    intro: [
      "Smoke rolls across Hollowmere square. Goblins pick through the dead like crows, laughing in their gutter-tongue, and none of them have seen you yet.",
      "The square stinks of burnt thatch and opened bellies. Five goblin shapes move through the ember-light, stripping rings from cold fingers.",
    ],
    sneak_begin: [
      "You drop low behind a toppled cart, breath held, letting the roar of the fire cover your boots.",
      "Ash and shadow. You move between them like your father taught you in the deer woods, one heel at a time.",
    ],
    sneak_fail: [
      "A charred beam cracks under your heel. Heads snap round, yellow eyes catching the firelight. They shriek and come for you.",
      "A goblin sniffs the air, grins, and points straight at your hiding place. So much for surprise.",
    ],
    sneak_kill: [
      "You clamp a hand over {e}'s mouth and drive {w} into the soft place under its jaw. It kicks twice against your chest and goes still.",
      "{e} never turns around. {w} splits the back of its skull with a wet crunch, and you ease the body down into the ash.",
      "You open {e}'s throat from behind. Hot blood sheets over your knuckles, and it dies trying to scream through the hole.",
    ],
    sneak_ko: [
      "The flat of {w} meets {e}'s temple with a hollow knock. It folds without a sound, and you drag it into the dark for later.",
      "You choke {e} with your forearm until its claws stop scrabbling. It'll wake with a headache and a lot of questions to answer.",
    ],
    assault: [
      "No more hiding. You step into the firelight, bow already drawn, and the goblins turn to see death coming for them.",
      "You roar your father's name and loose before the echo dies. Every head in the square swings toward you.",
    ],
    melee_fumble: [
      "Your foot skids in someone's spilled guts and {w} bites nothing but air. {e} cackles and lunges into the opening.",
      "You swing wild and wide. {w} glances off a cart wheel, the shock numbs your arm to the shoulder, and {e} sees it all.",
    ],
    melee_miss: [
      "{e} jerks back and {w} hisses past its nose, close enough to stir the hair in its ears.",
      "You chop at {e} but it scuttles sideways, quick as a rat, and spits at your boots.",
      "{w} thunks into a doorframe where {e}'s head was a heartbeat ago. You wrench it free.",
    ],
    melee_graze: [
      "{w} catches {e} across the forearm and opens a shallow red mouth in the green hide. It hisses and backs off a step.",
      "You clip {e}'s ear and a ragged chunk of it spins away into the dark. It howls, more furious than hurt.",
    ],
    melee_hit: [
      "{w} bites deep into {e}'s shoulder with a sound like an axe in green wood. Black blood spatters the cobbles.",
      "You hack {e} across the ribs. Something cracks, and it staggers, clutching the wound with both claws.",
      "{w} lands square in {e}'s gut. It doubles over, spitting dark blood and curses.",
      "You split {e}'s cheek to the teeth. It reels away, gurgling, one hand pressed to its ruined face.",
    ],
    melee_crit: [
      "Everything slows. You put your whole back into it and {w} cleaves {e} from collarbone to breastbone. Ribs part like kindling.",
      "Your father's strength moves your arm. {w} comes down on {e}'s skull and the head opens like a dropped melon.",
    ],
    melee_kill: [
      "{w} buries itself in {e}'s neck. Its head lolls on a hinge of gristle and it drops, twitching, into the ash.",
      "{e} takes the blow through the chest and slides off your blade, already dead before it hits the stones.",
      "You finish {e} with a chop that nearly takes the arm off. It sits down hard, looks at you with surprise, and dies.",
    ],
    melee_crit_kill: [
      "A killing stroke. {w} takes {e}'s head clean from its shoulders. The body stands a moment longer than it should, then pitches forward into the fire.",
      "You hit {e} so hard it lifts off its feet. It lands in two uneven pieces, and the nearest goblin stops laughing.",
    ],
    subdue_hit: [
      "You crack the butt of {w} against {e}'s jaw. Teeth skitter across the cobbles and its eyes roll loose.",
      "A pommel blow to {e}'s temple. It sways, drooling, still upright but barely.",
    ],
    subdue_miss: [
      "You reach to club {e} senseless, but it ducks under the blow and rakes your wrist with its claws.",
      "You swing the haft at {e}'s skull and catch only a fistful of greasy hair. It tears free, snarling.",
      "{e} squirms out from under your pommel blow like an eel and bares its yellow teeth at you.",
    ],
    subdue_ko: [
      "One more knock and {e} drops like a sack of wet grain, out cold. It's alive, and it will talk.",
      "{e}'s eyes cross and it topples face-first into the mud, snoring through a broken nose.",
    ],
    arrow_miss: [
      "The {a} arrow hisses past {e} and buries itself in a smouldering wall.",
      "{e} ducks at the last instant and your {a} shaft skips off the cobbles in a spray of sparks.",
    ],
    arrow_fumble: [
      "The nock slips off the string and the arrow flops uselessly at your feet. {e} laughs, a wet gurgling sound.",
      "The bowstring slaps your wrist raw, and the arrow tumbles end over end into the dirt. {e} jeers.",
    ],
    arrow_hit_broadhead: [
      "The broadhead punches into {e}'s chest and stays there, quivering. It paws at the shaft, coughing red.",
      "Your broadhead takes {e} in the thigh and tears through meat and tendon. It drops to one knee, shrieking.",
    ],
    arrow_hit_bodkin: [
      "The bodkin needles through {e}'s scrap armour as if it were linen and sinks deep.",
    ],
    arrow_hit_fire: [
      "The fire arrow strikes {e} and its rags go up. It dances and slaps at itself, its skin blistering.",
    ],
    arrow_hit_barbed: [
      "The barbed head hooks deep into {e}. Every move it makes tears the wound wider, and it leaves a trail of blood behind it.",
    ],
    arrow_hit_blunt: [
      "The blunt arrow cracks {e} between the eyes like a thrown stone. It reels, dazed and blinking.",
    ],
    arrow_ko: [
      "The blunt shaft knocks {e} flat on its back. It lies there gasping and drooling, out of the fight.",
    ],
    arrow_crit: [
      "A perfect shot. The {a} arrow takes {e} through the eye and bursts out the back of its skull in a black spray.",
      "You loose on the exhale. The {a} shaft pins {e} to a burning doorpost, and it hangs there, screaming.",
    ],
    arrow_kill: [
      "The {a} arrow takes {e} in the throat. It claws at the fletching, drowning on its feet, then folds.",
      "{e} is spun around by the impact and dies face-down in a puddle of its own blood.",
    ],
    whistler: [
      "The whistler shrieks across the square like a dying hawk. Every goblin head turns toward the sound, away from you.",
    ],
    grab: [
      "You wrench {t} from a dead goblin's fingers, still sticky with its owner's blood.",
      "You kick a corpse aside and snatch up {t}. It's crude and notched, and it'll do.",
    ],
    throw_begin: [
      "Nobody's in your face. You scoop {t} from a corpse and set your feet.",
    ],
    throw_miss: [
      "{t} spins end over end past {e} and clatters into the burning wreckage, gone for good.",
    ],
    throw_hit: [
      "{t} whirls across the square and chops into {e} with a meaty thunk. It staggers, the weapon jutting from its body.",
      "You hurl {t} overhand. It catches {e} in the face, and teeth and blood go flying.",
    ],
    throw_crit: [
      "{t} turns once in the air and splits {e}'s breastbone. The force throws it backward off its feet.",
    ],
    throw_kill: [
      "{t} buries itself in {e}'s forehead. It sways, crosses its eyes up at the handle, and falls flat.",
    ],
    item: [
      "You tear a strip from your shirt and cinch it tight over the worst cut, teeth gritted against the burn.",
      "You press your father's rag of yarrow paste into the wound. It stings like fire, and the bleeding slows.",
    ],
    flee_ok: [
      "You duck into the smoke and run, lungs burning, until the goblin howls fade behind you.",
    ],
    flee_fail: [
      "You turn to bolt, but a goblin cuts you off, grinning, blade low. There's no way out but through.",
    ],
    bleed: [
      "{e} is leaking badly, blood pattering onto the stones with every step.",
    ],
    burn: [
      "Flames still gnaw at {e}. It smells like scorched pork.",
    ],
    stagger: [
      "{e} is still reeling from the blow, shaking its head, and can't press the attack.",
    ],
    def_ok: [
      "{e} lunges and you catch its {w} on the haft of your hatchet. Steel shrieks against steel.",
      "You twist aside and {e}'s blow whistles past your ribs.",
      "{e} slashes low. You hop back and the edge kisses empty air.",
    ],
    def_ok_ranged: [
      "{e}'s arrow thuds into the cart beside your head, quivering.",
      "You throw yourself down and {e}'s shaft hums overhead.",
    ],
    def_riposte: [
      "You turn {e}'s blade aside and punish it at once, driving your hatchet back into its face.",
      "You let {e} overreach, then crack it across the jaw on the backswing.",
    ],
    def_graze: [
      "{e}'s {w} skins your forearm. It's not deep, but the blood runs hot down to your fingers.",
      "A glancing blow from {e} rakes your cheek. You taste copper.",
    ],
    def_graze_ranged: [
      "{e}'s arrow scores a bloody line across your shoulder before skittering away.",
    ],
    def_hit: [
      "{e}'s {w} punches into your side. White-hot pain, then the warm spread of blood under your shirt.",
      "{e} slips inside your guard and carves a gash across your thigh. You stagger but stay up.",
      "{e} hacks your shoulder. You feel the edge grate on bone.",
    ],
    def_hit_ranged: [
      "{e}'s arrow takes you high in the arm and sticks there. You snap the shaft and keep moving.",
    ],
    def_fumble: [
      "Your guard drops at the worst moment. {e}'s {w} punches in under your ribs and twists, and you hear yourself scream.",
      "You misjudge it badly. {e}'s {w} opens you from hip to ribs, and for a moment the world tilts and goes grey.",
    ],
    quil_fall: [
      "Your legs go. You hit the ash, the sky full of embers, and the goblin laughter is the last thing you hear.",
    ],
    tempo: [
      "The throw leaves you off balance and open, and they swarm in before you can recover.",
    ],
    victory: [
      "The last goblin stops twitching. In the sudden quiet you can hear the fire breathing and your own heart hammering.",
      "Hollowmere square is still. Corpses steam in the ash. You are alive, and that will have to do.",
    ],
    defeat: [
      "Darkness, and the smell of smoke. Somewhere far away, a woman is calling your name.",
    ],
    int_crit: [
      "{e} cracks completely. It babbles every route, every name, every buried stash, snot and blood bubbling from its nose.",
    ],
    int_strong: [
      "{e} spits, then sags. Two secrets come out in a sullen, frightened rush.",
    ],
    int_ok: [
      "{e} glares, then mutters what it knows, eyes darting to the trees.",
    ],
    int_lie: [
      "{e} grins with bloody teeth and tells you a story. Something in its eyes says it's a lie.",
    ],
    int_silent: [
      "{e} just stares, jaw clamped, and says nothing.",
    ],
    fate_execute: [
      "You open {e}'s throat while it is still begging. It is quick, and it is ugly, and it stays with you.",
    ],
    fate_bind: [
      "You lash {e} to a fence post with its own belt and leave it for the crows to argue over.",
    ],
    loot: [
      "You go through the dead by firelight. Goblin pouches, sticky with blood, give up a few coins and a garnet. You pull your father's hatchet from the ash and keep it.",
    ],
    spark_crit: [
      "Her fingers lace through yours and hold on. For a moment the burning town falls away, and there is only the two of you in the flour-dust light.",
    ],
    spark_ok: [
      "Tamsin's sharp mouth softens into something almost like a smile. She squeezes your hand, once, hard.",
    ],
    spark_fail: [
      "She thanks you, but her eyes are already somewhere else, on the road, on the dead. The moment slips away.",
    ],
    spark_fumble: [
      "The words come out wrong. Tamsin pulls her hand back, kind but final.",
    ],
  };
  const last = {};
  function fill(str, ctx) {
    const out = str.replace(/\{(\w)\}/g, (_, k) => (ctx && ctx[k] != null ? String(ctx[k]) : ''));
    // sentence-case: capitalise the start and after . ! ?
    return out.replace(/(^|[.!?]\s+)([a-z])/g, (_, a, c) => a + c.toUpperCase());
  }
  function pick(key, ctx) {
    const pool = P[key];
    if (!pool || !pool.length) return '';
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === last[key]) i = (i + 1) % pool.length;
    last[key] = i;
    return fill(pool[i], ctx);
  }

  /* ---- End-of-round recap ---- */
  const R = {
    unhurt: [
      "{e} is unhurt. It circles with its blade low, grinning and eager.",
      "{e} hasn't been touched. It hops from foot to foot, eager for blood.",
    ],
    unhurt_ranged: [
      "{e} crouches on the rubble, untouched, nocking another arrow and squinting down the shaft.",
    ],
    bloodied: [
      "{e} is bloodied. Black ichor drips from a gash, and it hisses through clenched teeth, more careful now.",
      "{e} is cut and angry, favouring one side, its grin gone.",
    ],
    staggering: [
      "{e} is staggering, half its blood on the cobbles. It sways and its sword-arm trembles.",
      "{e} barely stands, breath bubbling through a ruined chest.",
    ],
    fleeing: [
      "{e} has seen enough. It is backing away toward the smoke, glancing over its shoulder, ready to bolt.",
    ],
    down: [
      "{e} lies dead in the ash, eyes open, blood pooling black under it.",
      "What's left of {e} is still twitching in the embers.",
    ],
    ko: [
      "{e} lies senseless where it fell, chest rising and falling. It's a prisoner now, for questioning.",
    ],
  };
  const lastR = {};
  function pickR(key, ctx) {
    const pool = R[key]; const k = key + ctx.e;
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === lastR[k]) i = (i + 1) % pool.length;
    lastR[k] = i;
    return fill(pool[i], ctx);
  }
  function enemyState(e, living, total) {
    if (e.ko) return 'ko';
    if (e.dead) return 'down';
    const r = e.hp / e.maxHp;
    if (r >= 0.999) return e.ranged ? 'unhurt_ranged' : 'unhurt';
    if (r > 0.5) return 'bloodied';
    if (living <= Math.ceil(total / 3)) return 'fleeing';
    return 'staggering';
  }
  function quilLine(h, round, engaged, archers) {
    const r = h.hp / h.maxHp;
    let hp = r >= 0.95 ? "Quil is unmarked so far, hatchet steady, breath coming even."
      : r > 0.6 ? "Quil bleeds from a few shallow cuts, but his grip is firm and his eyes are hard."
      : r > 0.3 ? "Quil is hurt badly. His shirt is dark with blood and every swing costs him."
      : "Quil is barely on his feet, vision swimming, held up by grief and stubbornness.";
    const fat = round <= 2 ? "" : round <= 4 ? " Sweat and soot sting his eyes, and his arms are starting to burn."
      : " Exhaustion drags at him, and every breath scrapes his throat raw with smoke.";
    const pos = engaged > 1 ? ` ${["","One","Two","Three","Four","Five","Six"][engaged] || "Many"} blades press him at close quarters.`
      : engaged === 1 ? " One goblin is locked with him, toe to toe."
      : " For a moment no one is in his face, a gap he could use.";
    const arc = archers ? " An archer still has a line on him from the rubble." : "";
    return hp + fat + pos + arc;
  }
  function recap(battle, hero, others) {
    const living = battle.enemies.filter(e => !e.dead && !e.ko).length;
    const total = battle.enemies.length;
    const AW = {
      unaware: ['{e} has no idea Quil is here and is still picking through the ruins.', '{e} hums tunelessly over its loot, back turned to the smoke.'],
      suspicious: ['{e} has stopped looting and is peering into the smoke, ears twitching.', '{e} sniffs the air, blade half-raised, unsure what it heard.'],
    };
    const enemies = battle.enemies.map(e => {
      const st = enemyState(e, living, total);
      const aw = !e.dead && !e.ko && e.aware && e.aware !== 'alerted' ? e.aware : null;
      return { name: e.name, state: aw || st.replace('_ranged', ''),
        text: aw ? fill(AW[aw][battle.round % 2], { e: e.name }) : pickR(st, { e: e.name }) };
    });
    const engaged = battle.enemies.filter(e => !e.dead && !e.ko && e.engaged && !e.ranged).length;
    const archers = battle.enemies.filter(e => !e.dead && !e.ko && e.ranged).length;
    return { enemies, quil: quilLine(hero, battle.round, engaged, archers), others: others || [] };
  }
  return { pick, recap, pools: P };
})();
