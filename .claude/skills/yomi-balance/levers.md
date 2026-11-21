# Levers

## What a tuner needs to know

- A campaign is lost in a single battle at threat 5, mostly the Source's: the Blight Horror's hit points are the lever for it alone.
- Foe counts feed back through experience, so move them first and in small steps: a fifth foe at threat 5 is a cliff, and threat 5 must never give less experience than threat 4.
- `FOE_HP_PER_LEVEL` is the finer lever (now 1.15).
- Gear and several parties change little in the simulator; the game as played runs easier than the tuned figure.

The full text, with every constant: `docs/reference/simulator.md`, "What a tuner needs to know, in full".

## When to retune

The campaign's balance was tuned against today's growth. A change to the budgets of creation, skill points or perk points a level, what a node costs, a node, spell or technique, mana, the ready-made party or the plans moves the simulator's figures; so does a change to the party limit or healing. Re-run the guard and the bands (`bands.md`, `guards.md`), and re-record the refactor guard if play moved.
