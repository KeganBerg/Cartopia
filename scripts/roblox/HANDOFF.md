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
| React Three Fiber scenes | Rebuild with Parts/MeshParts. Town grid: `Data.GRID` (24) tiles of `Data.TILE` (2) units; pick a stud scale (e.g. 1 web unit = 4 studs) and keep it everywhere. Reuse instancing ideas: clone templates, never one-off unions per frame. |
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
| Music, voiceover, sound effects | Upload as Roblox audio assets (only audio Kegan owns the rights to). |

## House rules that carry over

- **Names are invented**, never real brands, people, tragedies or wars (the web repo has a banned-names test; car names in `CARS` are already safe).
- **No walls of text.** Show with renders, icons and numbers. Status as icons.
- **Phone first.** Every screen and control must work on a phone; Roblox mobile is a big share of players.
- **Earned progression.** No XP for money; Gems buy convenience and cosmetics. Game-balance changes (prices, rewards, odds, XP pace) are Kegan's call: ask him before changing any number from the kit.
- **The first ten minutes unlock one thing at a time**, with a hand-holding tutorial a non-gamer can follow.
- **Performance budget:** must stay smooth on a phone. Reuse parts, stream the town, keep part counts low.

## A suggested build order

1. **Town core:** grid, roads, place/move buildings from `BUILDINGS`, jobs that cost fuel and pay coins and XP, fuel regen, levels from `Curves.xpToNext`, ProfileStore save.
2. **Cars:** showroom buying from `CARS`, garage, procedural car models from `CarShapes`, paints.
3. **Drag race:** port `race.ts` (shift timing, launch, boost) and an AI rival from `raceSim.ts`; campaign races.
4. **Rusty's Rescue and restores**, building upgrades and merges, goals and daily tasks.
5. **Shop:** Developer Products for gems, crates with shown odds and the policy check.
6. **Social:** crews, leaderboards, live races in the same server, then crew wars.
7. Everything else (kart GP, World Tour, Pro Tour, arcade, Speedway) one mode at a time.

For each step: port the rule, write a test against the kit's numbers (e.g. your `xpToNext(10)` must equal `Curves.xpToNext[10]` = 14125), then build the screen.

## Re-exporting the kit

In the web repo: `npm ci && node scripts/roblox/export.mjs` writes a fresh kit to
`roblox-export/`. Ask Kegan for a new kit from the web project whenever a number there changes.
