# Cartopia on Roblox: handoff brief

You are porting **Cartopia**, a live web game (cartopia.lol), to the Roblox experience
"Cartopia" by KeganBergeron (still Private). The web game's code is in
**github.com/KeganBerg/Cartopia** (Vite + React + TypeScript + React Three Fiber, Supabase
backend, Stripe). This brief and the kit next to it come from the web project. Read the
web repo whenever you need the exact rule behind something; the kit saves you re-typing data.

## The game in one paragraph

A cozy car-town builder in the spirit of Car Town Streets. Players build a town on a grid
(businesses, homes, gas stations, decor), send cars on timed jobs that cost fuel and pay
coins and XP, level up to unlock buildings and cars, buy and restore cars (Rusty's Rescue
tows junkers and restores them), tune and mod them, and race: drag races with timed shifting
(the core race), kart circuits (Grand Prix), Pro Tour, Campaign, World Tour, Time Trials,
Speedway, arcade mini-games. Social: friends, crews with weekly crew wars, chat, car meets,
leaderboards. Currencies: Coins (earned), Gems (premium), Parts (upgrades). Crates drop
cars, mods, skins, hats and Call Cards with published odds.

## What is in the kit

| Path | What it is |
|---|---|
| `Data/*.luau` | One ModuleScript per web rule module: every plain-data export (tables, constants). `Data.luau` is the big one: `CARS`, `BUILDINGS`, `MODS`, `PAINTS`, `GOALS`, `CAMPAIGN`, `GP_SERIES`, `RESCUE_SPOTS`, `FUEL_RATE_STEPS`, `QUEST_PAY`... |
| `Data/ServerCatalog.luau` | The tables the web server checks every save against (prices, rewards, unlock levels, upgrade costs per level) plus `crateTables` (what a crate rolls from). Treat these as the source of truth for the economy. |
| `Data/Curves.luau` | Formulas sampled at levels 1-100: `xpToNext`, `levelXpBoost`, `playXpMult`, `townXpMult`, `fuelPerMin`, `baseFuelCap`, `gemCoins`, plot prices, crate odds and cost by level. Use them as **expected values** for tests of your Luau versions of the formulas. |
| `Data/CarShapes.luau` | Every car body's proportions (length, width, cabin, hood, wheel size, spoiler, fins...). The web cars are procedural boxes and tapers, so these build the same cars from Parts/Wedges/MeshParts. Per-car tweaks are in `CarLooks.luau`. |
| `Data/UIMotion.luau` | Menu and button motion, ported from the web game: panels rise in and drop away (a bottom sheet on phones), instant swaps between menus, button press and hover, reward pops, number bumps, error shakes, each with its sound. See Menu motion below. |
| `Data/BuildingBuilder.luau` + `Data/Buildings/` + `Data/ModelAssets.luau` + `Models/` | Every building's 3D model at every level, exported from the web game's own models, and the module that builds them as Parts and swaps in the new detail on level up. See Building models below. |
| `Audio/` + `Data/Audio.luau` | All the game's music, club tracks, ambience, sound effects and tutorial voice as MP3s, with a map of where each plays (see Audio below). |
| `json/` | The same data as JSON, if you prefer `HttpService:JSONDecode`. |
| `index.json` | Which module holds which exports, and the web source file of each. |

Drop `Data/` into `ReplicatedStorage/CartopiaData` (or `src/shared/Data` with Rojo). Each
file is `return { ... }`, already compiled clean with `luau-compile`. Do not edit them by
hand: when the web game changes, re-export (below) and replace the folder.

Functions are **not** exported (only data). Port the formulas by reading the TypeScript;
they are short pure functions. Where to find them:

| Rule | Web file |
|---|---|
| Levels, XP, fuel, job payouts, building upgrades, car performance (PI), campaign | `src/game/data.ts` |
| Every player action (build, collect, upgrade, buy, restore, race payouts) and the save shape `SaveState` | `src/game/store.ts` |
| Drag race physics (gears, shift bands, launch, boost, AI rival) | `src/game/race.ts`, `raceSim.ts`, `grip.ts`, `distance.ts` |
| Kart circuits (Grand Prix) | `src/game/kart.ts`, `obstacles.ts` |
| Crates: odds, rolls, pity, dupes | `src/game/crates.ts` |
| Merged buildings | `src/game/merge.ts` |
| Endless goals, daily tasks, quests | `src/game/endless.ts`, `daily.ts`, data.ts `QUEST_PAY` |
| Pro Tour, World Tour, rivals, tuner trials, mastery, trophy road | `tour.ts`, `worldTour.ts`, `rivals.ts`, `tuner.ts`, `mastery.ts`, `trophyRoad.ts` |
| Gem packs and car packs | `src/game/bucksPacks.ts` |
| Server rules (anti-cheat, crews, crew wars, wagers, trials) | `supabase/migrations/*.sql` (numbered; later ones replace earlier functions) |
| UI rules | `docs/ui-rules.md` |

## What carries over, what gets rebuilt

| Web | Roblox |
|---|---|
| Rules and data (`src/game`) | Port to ModuleScripts in ReplicatedStorage. Keep the same names and numbers so both versions stay comparable. |
| React Three Fiber scenes | Rebuild with Parts/MeshParts. Town grid: `Data.GRID` (24) tiles of `Data.TILE` (2) units; use 1 web unit = 5.5 studs everywhere (`BuildingBuilder.studsPerUnit`: a web townsperson is 0.9 units, a Roblox avatar about 5 studs, so a lot tile is 11 studs). Reuse instancing ideas: clone templates, never one-off unions per frame. |
| React UI panels | ScreenGui (or React-Luau / Fusion). Same rules: phone first, icons and numbers, at most one short line of text per card, one primary action, yellow back arrow, X closes to town. |
| Supabase `game_saves` + `guard_game_save` / `econ_guard` anti-cheat | **ProfileStore (or DataStoreService) on the server.** On Roblox the server owns state, so the whole save-guard layer goes away: clients send intents over RemoteEvents ("collect building 12"), the server checks and applies them. Never trust a client number. Rate-limit every remote. |
| Supabase RPCs (crate_open, race_finish, trial_submit...) | Server-side ModuleScripts behind RemoteFunctions. Their SQL is the spec for what to check. |
| Stripe gem packs (`BUCKS_PACKS`) | **Developer Products** with `MarketplaceService.ProcessReceipt`, idempotent on `PurchaseId` (record it in the profile before granting). One-per-account car packs fit **Game Passes** or a once-only Developer Product. |
| Crates bought with Gems | Roblox's paid random items rules apply: show the odds in-game (they are in `Curves.crateOddsByLevel`) and check `PolicyService:GetPolicyInfoForPlayerAsync(player).ArePaidRandomItemsRestricted`; where true, hide Gem-bought crates. |
| Chat, usernames, town names | `TextChatService` for chat; every player-typed string shown to others (town names, crew names, notes) goes through `TextService:FilterStringAsync`. Use Roblox display names instead of the web username system. |
| Friends | Roblox friends (`Players:GetFriendsAsync`). |
| Crews, crew wars, weekly boards | DataStores for crew records, `MessagingService` for live updates, `OrderedDataStore` for leaderboards, `MemoryStoreService` for matchmaking and weekly counters. |
| Live races, wagers, kart parties | Players in the same server race directly; for cross-server use MemoryStore queues + `TeleportService` reserved servers. The web "referee" (`race_floor`) becomes the server simulating with `race.ts` rules. |
| Time Trial ghosts | Store the run's input timeline in a DataStore, best times in an OrderedDataStore. |
| Admin (KBerg, `is_admin()`) | An allowlist of Roblox UserIds checked on the server (KeganBergeron's own account). |
| Push notifications | Roblox experience notifications (opt-in) for "your job is done" style alerts. |
| Clock (UTC days, fuel regen) | `os.time()` on the server only. |
| Music, voiceover, sound effects | Rendered in `Audio/`: upload as Roblox audio assets (see Audio below). |

## Audio

The web game synthesises all its music and sounds live in code (Web Audio), which Roblox
can't do, so the kit has them **rendered to MP3 from the current game code** under `Audio/`:

| Folder | What | Plays |
|---|---|---|
| `music/` | 24 town songs, 6 per season (3 day, 3 night), about 2 minutes each | One at a time, shuffled from the songs for the season and time of day, a short gap between songs |
| `club/` | 18 nightclub tracks, one 64-bar pass each, made to loop | One track all night, a different one every night (`trackOf(night)` in `src/lib/clubSet.ts`), louder near the club |
| `rave/` | Rave Mode build-up (10 s) and drop loop | Build-up once over the warning, then the loop |
| `ambience/` | 20 one-minute seamless loops: season x day/night x weather (calm, rain, storm, wind, snow), plus 2 thunder claps | Under everything, crossfaded when season, time or weather changes |
| `sfx/` + `sfx-sprite.mp3` | 77 sound effects (taps, coins, level up, crates, Rusty, wheel, races, arcade) | On their action |
| `voice/` | 12 tutorial voice lines | Once on their tutorial step |

`Data/Audio.luau` lists every file with where it plays, its length and an empty `assetId`
to fill in after upload, plus starting volumes (`Volume`) and the play rules (`Rules`).

Roblox audio rules to plan around (check the Creator Hub, they change):
- Formats MP3, OGG, WAV or FLAC; at most **7 minutes** and **20 MB** per file. Every file here fits.
- Uploads are free but capped per 30 days: about **100 with a verified ID**, about **10 without**. Upload from the account or group that owns the experience, or grant the experience permission to use each asset.
- New audio is checked by moderation before it plays.
- To stay inside the cap, upload `sfx-sprite.mp3` once instead of the 77 effect files and play each effect as a region of it: `Sound.PlaybackRegionsEnabled = true`, `Sound.PlaybackRegion = NumberRange.new(start, stop)` from `Sfx[name].sprite`. That makes the whole set **79 uploads**: 24 songs, 18 club tracks, 2 rave, 20 ambience loops, 2 thunder claps, 1 sprite and 12 voice lines.
- Car engines are not in the kit: the web game synthesises them per car as you drive. On Roblox, use a short engine loop per body type with `PlaybackSpeed` following RPM.

## Menu motion

The web game never lets a menu or button sit still: menus rise in and drop away, presses push
down and spring back, rewards pop, and each has a sound. `Data/UIMotion.luau` does the same
with TweenService, with the web game's own timings and easing. Use it on **every** screen:

1. In one LocalScript: `UIMotion.init(require(CartopiaData.Audio))`, then `UIMotion.bindAll(playerGui)`. Every button, now and later, gets press, hover (mouse only) and a tap sound. A button with its own sound sets the attribute `Sfx` (e.g. `"buy"`, `"equip"`, `"reward"`); `NoMotion = true` opts one out.
2. Build each menu as a **CanvasGroup** (so it fades as a whole) with a dim Frame named `Overlay` beside it. Never set `Visible` by hand: open with `UIMotion.open(panel)` and close with `UIMotion.close(panel)`. They play the menu sounds.
3. Going from one menu straight to another (a tab row, a button that jumps to Cars) uses `UIMotion.swap(from, to)`: instant, with the tab tick, like the web game.
4. Rewards, unlocks and new badges appear with `UIMotion.pop(gui, "reward")`. A coin, gem or fuel number that changes calls `UIMotion.bump(label)`. A refused action calls `UIMotion.shake(button)`.
5. Keep the timings in `UIMotion.Timing`. They are the web game's (panel in 0.26 s, out 0.17 s, sheet 0.3 s), and anything slower feels sluggish.

Buttons inside a UIListLayout or UIGridLayout can't move (the layout owns their position), so they only scale on press. That's fine. The module respects Roblox's Reduced Motion setting.

## Building models

Every building in the web game looks different at each level (a house becomes a tower, a pizza
place grows floors, signs and a fire escape). That look lives in the web game's 3D code, not in
its data, so it is exported separately: `scripts/roblox/models.mjs` renders every building at
every level with the game's own code and writes each piece as a Roblox part.

- `Data/Buildings/<id>.luau`: one module per building (`BUILDINGS` ids). Each part is listed once with the levels it shows at, so a level up only adds and removes what changed.
- `Data/BuildingBuilder.luau`: builds them. Call `Builder.init({ buildings = CartopiaData.Buildings, assets = require(CartopiaData.ModelAssets) })` once, then:
  - `Builder.build(id, level, lotCFrame)` returns a Model (parent it yourself; the pivot is the middle of the lot at ground level).
  - `Builder.setLevel(model, level)` on every upgrade: the new detail rises in, staggered, and old pieces go.
  - `Builder.setNight(model, on)` lights windows and signs after dark.
  - `Builder.count(id, level)` gives the part count, for a budget check.
- All parts are Anchored with CanCollide, CanTouch and CanQuery off; one invisible `Hitbox` part per building handles walking into it and tapping it. Keep it that way: it is what keeps a full town cheap.
- **Upload once, on a computer:** `Models/meshes/*.obj` (shapes that aren't blocks, balls or cylinders: roofs, cones, rings) and `Models/images/*.png` (brick, siding, shingles, windows, awnings) through Studio's Asset Manager bulk import, then paste each asset id into `Data/ModelAssets.luau`. Import meshes at 1 unit = 1 stud with no rescaling; the builder sizes them. Until an id is filled in, a mesh shows as a block of the same size and a texture as the matching Roblox material in its average colour, so buildings look right in shape from day one.
- Signs are SurfaceGui text, so they need no uploads. Textured round shapes (striped canopies, balloons) are meshes whose image rides on `SpecialMesh.TextureId`.
- Left out on purpose: things the web game animates around a building, its crowds (Speedway stands, Funfair, Nightclub) and the Speedway's race cars. Each module's `crowd` says how many people the web game shows at each level; spawn that many of your own NPCs (cheap rigs or R15 dummies) so they can move.
- Merged buildings (two or more of the same side by side) use `Builder.build(id, level, cf, { scale = n })` for now; the web game's merged looks are in `src/game/merge.ts` and `src/scene/mergeScale.tsx`.
- Re-export after any building changes on the web: `node scripts/roblox/models.mjs` (all buildings) or `node scripts/roblox/models.mjs roblox-export pizza,house` (some). `node scripts/roblox/check.mjs roblox-export pizza 1,10` runs this builder on the data and saves pictures of each level beside the web model.

## House rules that carry over

- **Names are invented**, never real brands, people, tragedies or wars (the web repo has a banned-names test; car names in `CARS` are already safe).
- **No walls of text.** Show with renders, icons and numbers. Status as icons.
- **Phone first.** Every screen and control must work on a phone; Roblox mobile is a big share of players.
- **Earned progression.** No XP for money; Gems buy convenience and cosmetics. Game-balance changes (prices, rewards, odds, XP pace) are Kegan's call: ask him before changing any number from the kit.
- **The first ten minutes unlock one thing at a time**, with a hand-holding tutorial a non-gamer can follow.
- **Performance budget:** must stay smooth on a phone. Reuse parts, stream the town, keep part counts low.

## A suggested build order

1. **Town core:** grid, roads, place/move buildings from `BUILDINGS` (models from `BuildingBuilder`, `setLevel` on every upgrade), jobs that cost fuel and pay coins and XP, fuel regen, levels from `Curves.xpToNext`, ProfileStore save.
2. **Cars:** showroom buying from `CARS`, garage, procedural car models from `CarShapes`, paints.
3. **Drag race:** port `race.ts` (shift timing, launch, boost) and an AI rival from `raceSim.ts`; campaign races.
4. **Rusty's Rescue and restores**, building upgrades and merges, goals and daily tasks.
5. **Shop:** Developer Products for gems, crates with shown odds and the policy check.
6. **Social:** crews, leaderboards, live races in the same server, then crew wars.
7. Everything else (kart GP, World Tour, Pro Tour, arcade, Speedway) one mode at a time.

For each step: port the rule, write a test against the kit's numbers (e.g. your `xpToNext(10)` must equal `Curves.xpToNext[10]` = 14125), then build the screen.

## Re-exporting the kit

In the web repo: `npm ci && node scripts/roblox/export.mjs` writes a fresh kit to
`roblox-export/`, `node scripts/roblox/audio.mjs` re-renders the audio and `node scripts/roblox/models.mjs` re-exports the building models into the same folder (run export.mjs first: it clears the folder).
Ask Kegan for a new kit from the web project whenever a number or a sound there changes.
