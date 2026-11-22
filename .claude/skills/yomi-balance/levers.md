# Levers

## What a tuner needs to know

- A campaign is lost in a single battle at threat 5, mostly the Source's: the Blight Horror's hit points are the lever for it alone.
- Foe counts feed back through experience, so move them first and in small steps: a fifth foe at threat 5 is a cliff, and threat 5 must never give less experience than threat 4.
- `FOE_HP_PER_LEVEL` is the finer lever (now 1.15).
- Gear and several parties change little in the simulator; the game as played runs easier than the tuned figure.
- Trade (stage 8): `ROAD_STRENGTH` (1, `blight.ts`) is how hard open roads push back the blight at Lodge 3; `RAID_RADIUS` (2) and `ABANDON_AFTER` (6 yield days) in `trade.ts` set how often routes are raided and lost, and so how often raiders pull the party and the guards back; the simulator's `CONTACT_DETOUR` (8) and `TOWER_ERRAND_RADIUS` (6) set how far the vanguard walks to contact a partner and a party to guard a road with a tower. The contact detour runs only once the trading post allows routes: ungated, it moved the early game on its own (304 of 500 with one party against 239, and 35 of 50 against 23 in the 50-campaign check), its walks adding days and moving the vanguard before its next nest. Routes barely open in the bands' runs (the post rarely reaches 4 before stage 12's spend-order retune); `--trading-post 4` measures them: at `--ready-level 10` 0.47 routes a campaign, 4% of the gold, never raided or abandoned (stage 8), so the raid levers are not yet exercised by the simulator.

The full text, with every constant: `docs/reference/simulator.md`, "What a tuner needs to know, in full".

## When to retune

The campaign's balance was tuned against today's growth. A change to the budgets of creation, skill points or perk points a level, what a node costs, a node, spell or technique, mana, the ready-made party or the plans moves the simulator's figures; so does a change to the party limit or healing. Re-run the guard and the bands (`bands.md`, `guards.md`), and re-record the refactor guard if play moved.
