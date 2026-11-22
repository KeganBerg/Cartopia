# Migration rename map (2026-11-22)

`supabase/migrations` moved from `NNNN_name.sql` to Supabase CLI versions (`YYYYMMDDHHMMSS_name.sql`) so the
Supabase GitHub integration can run it. File contents are unchanged (git mv); only names moved.

## How versions were chosen

- **Order** is the old apply order. Duplicate prefixes are ordered by first commit:
  0019 econ_catalog_more_cars, save_limits; 0020 restore_speedster, private_realtime;
  0023 push_notifications, econ_catalog_cars_spooky; 0030 econ_balance, friend_ghosts, car_meet_likes;
  0068 friendly_taunts, chat_delete.
- **9 files reuse the live history version** (marked below), so `supabase migration list` lines up.
- **One swap:** live applied `decor_levels` (03:23:05) before `crate_hats` (03:25:08), so 0073 now runs before
  0072. Safe: 0073 only replaces `econ_catalog()`, 0072 only touches `crate_opens` / `crate_open()`.
- Every other file gets its first-commit time, nudged forward a second where needed to stay strictly increasing
  and inside the live versions around it. Files after 0073 start at 20261013034000, clear of the 5 rows below.
- **4 live files were missing from the repo** (only in project files `supabase/pending/`): 0115, 0116, 0117,
  0120. Added verbatim. 0120's five functions hash to the md5s recorded when it went live (checked).
- A fresh replay of all 122 files on a local Postgres with the Supabase shim applies cleanly (0120 needs
  pgcrypto in `extensions`, which Supabase has by default), so preview branches should build.

## Live history rows with no file (5)

`casual_economy_guard_1` … `_4` (20261013033036 … 20261013033715) and `retire_old_crate_open`
(20261013033946) are **0069_casual_economy.sql applied in five pieces**, not missing SQL:
- `retire_old_crate_open` is 0069's `drop function if exists public.crate_open(text)`.
- The guard pieces are 0069's `econ_guard()` (its main change), split because the file is 122 KB.
- Everything 0069 defines except `econ_xp_to_next()` has since been replaced by 0111 gems_x10, so the live
  versions come from later files anyway. The drift check covers `econ_xp_to_next()`.

`migration repair --status reverted` only deletes those history rows; it runs no SQL. The repair script
reverts them only if they are the sole remote-only rows, and stops on anything else.

## Spot-check before marking applied

Run `scripts/check-migration-drift.sql` (read-only) in the SQL editor first. No rows = live matches the repo.
Things it may show, and what to look at:
- `0071_oddball_cars` has no history row and only rebuilds `econ_catalog()`, which 0073 replaced right after.
  It may never have run on its own; harmless either way.
- `different body` on a function: live has a different version than the newest file. Likely a hotfix run from
  the SQL editor that never got a file (project files hold `econ_guard_next.sql`, `crew_chest_guard_block.sql`,
  `visitors_guard_block.sql`, `rollback_crates_to_live.sql`). Save the live version as a new migration before
  the next change to that function, or it will be overwritten.
- `extra in live`: something applied that no file creates.
- The drift check can't see data-only steps (0004's trophies backfill, 0092's duplicate-like cleanup, 0103's
  leader backfill, 0111's gems x10 rescale). 0111 is guarded by an `econ_private.econ_rescales` row
  (`gems_x10`); if that table has the row, it ran.

## Not safe to re-run (only matters if the integration is switched on before the repair)

Re-running an old file against production would put back an old version of every function it defines, so
**do not switch the integration on until the repair has finished.** Beyond that:
- Errors on re-run: `init`, `game_saves`, `clans_leaderboards` (tables/columns exist), `rescue_rolls`
  (function return type), `chat_delete` (chat_mods insert has no `on conflict`).
- Changes data on re-run: `clans_leaderboards` (rewrites trophies/race_wins from saves), `one_like_per_town`
  (deletes duplicate likes), `crew_ranks` (reassigns crew leaders), `gems_x10` (guarded, see above).
- **`roblox_link_hardening` rotates the Roblox server key** (its last line calls `roblox_new_secret()`):
  re-running it breaks the Roblox link until the new key is pasted into Roblox Secrets.
- If the integration ran before the repair, its first pending files would be `save_guard` (a no-op re-run)
  then `clans_leaderboards`, which errors on its first line, so the deploy should stop there. Don't count on it.

## Rename map

| Old | New | Note |
|---|---|---|
| `0001_init.sql` | `20261010180022_init.sql` | live history |
| `0002_game_saves.sql` | `20261010181153_game_saves.sql` | live history |
| `0003_save_guard.sql` | `20261010222022_save_guard.sql` |  |
| `0004_clans_leaderboards.sql` | `20261010222023_clans_leaderboards.sql` |  |
| `0005_economy_guard.sql` | `20261010234915_economy_guard.sql` |  |
| `0006_econ_catalog_crew.sql` | `20261011003157_econ_catalog_crew.sql` | live history |
| `0007_econ_building_upgrades.sql` | `20261011003944_econ_building_upgrades.sql` | live history |
| `0008_econ_catalog_new_buildings.sql` | `20261011010931_econ_catalog_new_buildings.sql` | live history |
| `0009_live_race_referee.sql` | `20261011011419_live_race_referee.sql` |  |
| `0010_econ_mods_drivers.sql` | `20261011011955_econ_mods_drivers.sql` |  |
| `0011_econ_owned_mods.sql` | `20261011013218_econ_owned_mods.sql` |  |
| `0012_econ_catalog_new_cars.sql` | `20261011020231_econ_catalog_new_cars.sql` |  |
| `0013_campaign.sql` | `20261011025109_campaign.sql` |  |
| `0014_econ_catalog_club.sql` | `20261011030814_econ_catalog_club.sql` |  |
| `0015_security_hardening.sql` | `20261011033522_security_hardening.sql` |  |
| `0016_econ_restore_gp.sql` | `20261011034856_econ_restore_gp.sql` |  |
| `0017_collection_sets.sql` | `20261011034857_collection_sets.sql` |  |
| `0018_goals_tasks.sql` | `20261011034858_goals_tasks.sql` |  |
| `0019_econ_catalog_more_cars.sql` | `20261011040158_econ_catalog_more_cars.sql` |  |
| `0019_save_limits.sql` | `20261011041322_save_limits.sql` |  |
| `0020_restore_speedster.sql` | `20261011041834_restore_speedster.sql` |  |
| `0020_private_realtime.sql` | `20261011041915_private_realtime.sql` |  |
| `0021_econ_catalog_house.sql` | `20261011042109_econ_catalog_house.sql` |  |
| `0022_rescue_rolls.sql` | `20261011043827_rescue_rolls.sql` |  |
| `0023_push_notifications.sql` | `20261011045400_push_notifications.sql` |  |
| `0023_econ_catalog_cars_spooky.sql` | `20261011050340_econ_catalog_cars_spooky.sql` |  |
| `0024_season_track.sql` | `20261011050341_season_track.sql` |  |
| `0025_friend_gifts.sql` | `20261011050342_friend_gifts.sql` |  |
| `0026_time_trials.sql` | `20261011050343_time_trials.sql` |  |
| `0027_crew_weekly_goal.sql` | `20261011050344_crew_weekly_goal.sql` |  |
| `0028_econ_crew_chest.sql` | `20261011050345_econ_crew_chest.sql` |  |
| `0029_econ_season_old_pages.sql` | `20261011051533_econ_season_old_pages.sql` |  |
| `0030_econ_balance.sql` | `20261011052602_econ_balance.sql` |  |
| `0030_friend_ghosts.sql` | `20261011053105_friend_ghosts.sql` |  |
| `0030_car_meet_likes.sql` | `20261011053420_car_meet_likes.sql` |  |
| `0031_econ_tire_mods.sql` | `20261011055554_econ_tire_mods.sql` |  |
| `0032_town_visitors.sql` | `20261011055555_town_visitors.sql` |  |
| `0033_econ_town_visitors.sql` | `20261011055556_econ_town_visitors.sql` |  |
| `0034_econ_rivals.sql` | `20261011055557_econ_rivals.sql` |  |
| `0035_race_boost.sql` | `20261011055558_race_boost.sql` |  |
| `0036_econ_rescue_track.sql` | `20261011114103_econ_rescue_track.sql` |  |
| `0037_econ_rescue_desert.sql` | `20261011114836_econ_rescue_desert.sql` |  |
| `0038_econ_long_progression.sql` | `20261011132752_econ_long_progression.sql` |  |
| `0039_econ_car_level_lock.sql` | `20261011135226_econ_car_level_lock.sql` |  |
| `0040_crates.sql` | `20261011141305_crates.sql` |  |
| `0041_econ_crates_guard.sql` | `20261011142443_econ_crates_guard.sql` |  |
| `0042_econ_office_buildings.sql` | `20261011151220_econ_office_buildings.sql` |  |
| `0043_crate_skins.sql` | `20261011151221_crate_skins.sql` |  |
| `0044_econ_school_buildings.sql` | `20261011151652_econ_school_buildings.sql` |  |
| `0045_econ_trailer_park_buildings.sql` | `20261011162527_econ_trailer_park_buildings.sql` |  |
| `0046_crate_skin_tables.sql` | `20261011162528_crate_skin_tables.sql` |  |
| `0047_town_helps.sql` | `20261011194135_town_helps.sql` |  |
| `0048_chat.sql` | `20261011201519_chat.sql` |  |
| `0049_friends_usernames.sql` | `20261011201520_friends_usernames.sql` |  |
| `0050_crew_battles.sql` | `20261011201521_crew_battles.sql` |  |
| `0051_friend_cap_both.sql` | `20261011202841_friend_cap_both.sql` |  |
| `0052_race_gearbox.sql` | `20261011215106_race_gearbox.sql` |  |
| `0053_crate_all_cars_mods.sql` | `20261012004255_crate_all_cars_mods.sql` |  |
| `0054_more_cars.sql` | `20261012005222_more_cars.sql` |  |
| `0055_live_events.sql` | `20261012010136_live_events.sql` |  |
| `0056_delete_account.sql` | `20261012032433_delete_account.sql` |  |
| `0057_wager_matches.sql` | `20261012083027_wager_matches.sql` |  |
| `0058_kart_parties.sql` | `20261012153557_kart_parties.sql` |  |
| `0059_economy_followups.sql` | `20261012164801_economy_followups.sql` |  |
| `0060_kart_floor_by_pi.sql` | `20261012165328_kart_floor_by_pi.sql` |  |
| `0061_wager_void.sql` | `20261012172930_wager_void.sql` |  |
| `0062_exotic_cars.sql` | `20261012183131_exotic_cars.sql` |  |
| `0063_reset_account.sql` | `20261012224535_reset_account.sql` |  |
| `0064_wheel_spin.sql` | `20261012230611_wheel_spin.sql` |  |
| `0066_restore_bay_fix.sql` | `20261013021608_restore_bay_fix.sql` |  |
| `0068_friendly_taunts.sql` | `20261013031644_friendly_taunts.sql` | live history |
| `0068_chat_delete.sql` | `20261013031645_chat_delete.sql` |  |
| `0069_casual_economy.sql` | `20261013031646_casual_economy.sql` |  |
| `0070_postcards_crew_parts.sql` | `20261013031938_postcards_crew_parts.sql` | live history |
| `0071_oddball_cars.sql` | `20261013031939_oddball_cars.sql` |  |
| `0073_decor_levels.sql` | `20261013032305_decor_levels.sql` | live history |
| `0072_crate_hats.sql` | `20261013032508_crate_hats.sql` | live history |
| `0074_resto_pieces.sql` | `20261013034000_resto_pieces.sql` |  |
| `0075_rusty_addons.sql` | `20261013034001_rusty_addons.sql` |  |
| `0076_pi_curve.sql` | `20261013120414_pi_curve.sql` |  |
| `0077_building_identity.sql` | `20261013123821_building_identity.sql` |  |
| `0078_live_events_private.sql` | `20261013160051_live_events_private.sql` |  |
| `0079_gem_purchases.sql` | `20261013160334_gem_purchases.sql` |  |
| `0080_purchase_reverse.sql` | `20261014023630_purchase_reverse.sql` |  |
| `0081_custom_paint.sql` | `20261014023850_custom_paint.sql` |  |
| `0082_crate_open_many.sql` | `20261014035121_crate_open_many.sql` |  |
| `0083_rave_button.sql` | `20261014035122_rave_button.sql` |  |
| `0084_more_car_mods.sql` | `20261014042112_more_car_mods.sql` |  |
| `0085_crate_value_fixes.sql` | `20261014042113_crate_value_fixes.sql` |  |
| `0086_arcade_boards.sql` | `20261014042114_arcade_boards.sql` |  |
| `0087_arcade_prizes.sql` | `20261014051422_arcade_prizes.sql` |  |
| `0088_merge_bonus.sql` | `20261014234044_merge_bonus.sql` |  |
| `0089_car_value_pass.sql` | `20261014234822_car_value_pass.sql` |  |
| `0090_car_packs.sql` | `20261015004001_car_packs.sql` |  |
| `0091_buildings.sql` | `20261015005000_buildings.sql` |  |
| `0092_one_like_per_town.sql` | `20261015022452_one_like_per_town.sql` |  |
| `0093_mod_stats.sql` | `20261015042052_mod_stats.sql` |  |
| `0094_kberg_lockdown.sql` | `20261015042053_kberg_lockdown.sql` |  |
| `0095_admin_panel.sql` | `20261015042054_admin_panel.sql` |  |
| `0096_admin_grant_any_amount.sql` | `20261015163753_admin_grant_any_amount.sql` |  |
| `0097_admin_grant_parts.sql` | `20261015170454_admin_grant_parts.sql` |  |
| `0098_more_homes.sql` | `20261015224727_more_homes.sql` |  |
| `0099_admin_level_bypass_and_xp.sql` | `20261016001442_admin_level_bypass_and_xp.sql` |  |
| `0100_admin_rusty_bypass.sql` | `20261016004837_admin_rusty_bypass.sql` |  |
| `0101_pack_only_cars.sql` | `20261016005604_pack_only_cars.sql` |  |
| `0102_bigger_trophy_road.sql` | `20261016012518_bigger_trophy_road.sql` |  |
| `0103_crew_ranks.sql` | `20261016013608_crew_ranks.sql` |  |
| `0104_race_modes_no_level_walls.sql` | `20261016021620_race_modes_no_level_walls.sql` |  |
| `0105_call_cards.sql` | `20261016021621_call_cards.sql` |  |
| `0107_merge_2x4.sql` | `20261016024237_merge_2x4.sql` |  |
| `0108_endless_goals.sql` | `20261016025403_endless_goals.sql` |  |
| `0110_season_skins_out_of_crates.sql` | `20261016033911_season_skins_out_of_crates.sql` |  |
| `0111_gems_x10.sql` | `20261016033912_gems_x10.sql` |  |
| `0112_invite_rewards.sql` | `20261017200711_invite_rewards.sql` |  |
| `0113_crew_war_chests_log.sql` | `20261017204805_crew_war_chests_log.sql` |  |
| `0114_crew_war_map.sql` | `20261017225612_crew_war_map.sql` |  |
| `0115_war_race_lock.sql` | `20261018151544_war_race_lock.sql` | **added**: was only in project files |
| `0116_client_errors.sql` | `20261018153855_client_errors.sql` | **added**: was only in project files |
| `0117_invite_rewards_tighter.sql` | `20261018202743_invite_rewards_tighter.sql` | **added**: was only in project files |
| `0118_chat_reports.sql` | `20261018205440_chat_reports.sql` |  |
| `0119_roblox_link.sql` | `20261019025009_roblox_link.sql` |  |
| `0120_roblox_link_hardening.sql` | `20261019122042_roblox_link_hardening.sql` | **added**: was only in project files |
