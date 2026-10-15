# Quil — vertical slice (PWA)

Prologue + Mission 1 playable slice of *Quil: The Goblin King's Tithe*.

## Run locally

```bash
cd /workspace/quil-rpg/app
python3 -m http.server 8642
# or: npx --yes serve -l 8642
```

Open `http://localhost:8642/` on a phone or desktop. On iPhone Safari: Share → Add to Home Screen.

## Features in this slice

- Title, New Game (2 free stat points), Ashdice pad (6=0) + auto-roll
- Prologue → Mission 1 combat (sneak/assault, melee, archery, subdue, grab, **Improvised Throw**, interrogate)
- Loot, Tamsin rescue (romance/recruit spark, fade-to-black)
- World map, pack, hero, hearth, journal · localStorage autosave
- Art placeholders via `QuilArt` (`setGenerator` / Cache Storage per entity id)

## Design doc

See `/workspace/quil-rpg/design.md` (v1.1) and `design.pdf`.
