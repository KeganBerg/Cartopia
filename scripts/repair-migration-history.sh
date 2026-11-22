#!/usr/bin/env bash
# One-time repair of the live migration history (project pagxmjtkatpofidqkdto), so the Supabase
# GitHub integration sees every file in supabase/migrations as already applied and runs only new ones.
#
# What it changes: rows in supabase_migrations.schema_migrations ONLY. `migration repair` never runs
# any migration SQL, so no table, function or player data is touched.
#
# Before running:
#   1. Paste scripts/check-migration-drift.sql into the SQL editor and run it. Read any rows it returns
#      (see supabase/MIGRATION_RENAME_MAP.md, "Spot-check before marking applied").
#   2. Keep the GitHub integration OFF until this script has finished and the final list looks right.
#      If it is switched on first, it would re-run the old files against production.
#
# Run from the repo root, with the Supabase CLI installed (or `npx supabase`), signed in (`supabase login`).
# `supabase link` asks for the database password.
set -euo pipefail
cd "$(dirname "$0")/.."
SB="${SUPABASE_BIN:-supabase}"
supabase() { "$SB" "$@"; }

supabase link --project-ref pagxmjtkatpofidqkdto

# 1. Mark every file in supabase/migrations as applied (122 versions; the 9 that are already in
#    the live history are re-marked, which changes nothing).
supabase migration repair --status applied 20261010180022   # init
supabase migration repair --status applied 20261010181153   # game_saves
supabase migration repair --status applied 20261010222022   # save_guard
supabase migration repair --status applied 20261010222023   # clans_leaderboards
supabase migration repair --status applied 20261010234915   # economy_guard
supabase migration repair --status applied 20261011003157   # econ_catalog_crew
supabase migration repair --status applied 20261011003944   # econ_building_upgrades
supabase migration repair --status applied 20261011010931   # econ_catalog_new_buildings
supabase migration repair --status applied 20261011011419   # live_race_referee
supabase migration repair --status applied 20261011011955   # econ_mods_drivers
supabase migration repair --status applied 20261011013218   # econ_owned_mods
supabase migration repair --status applied 20261011020231   # econ_catalog_new_cars
supabase migration repair --status applied 20261011025109   # campaign
supabase migration repair --status applied 20261011030814   # econ_catalog_club
supabase migration repair --status applied 20261011033522   # security_hardening
supabase migration repair --status applied 20261011034856   # econ_restore_gp
supabase migration repair --status applied 20261011034857   # collection_sets
supabase migration repair --status applied 20261011034858   # goals_tasks
supabase migration repair --status applied 20261011040158   # econ_catalog_more_cars
supabase migration repair --status applied 20261011041322   # save_limits
supabase migration repair --status applied 20261011041834   # restore_speedster
supabase migration repair --status applied 20261011041915   # private_realtime
supabase migration repair --status applied 20261011042109   # econ_catalog_house
supabase migration repair --status applied 20261011043827   # rescue_rolls
supabase migration repair --status applied 20261011045400   # push_notifications
supabase migration repair --status applied 20261011050340   # econ_catalog_cars_spooky
supabase migration repair --status applied 20261011050341   # season_track
supabase migration repair --status applied 20261011050342   # friend_gifts
supabase migration repair --status applied 20261011050343   # time_trials
supabase migration repair --status applied 20261011050344   # crew_weekly_goal
supabase migration repair --status applied 20261011050345   # econ_crew_chest
supabase migration repair --status applied 20261011051533   # econ_season_old_pages
supabase migration repair --status applied 20261011052602   # econ_balance
supabase migration repair --status applied 20261011053105   # friend_ghosts
supabase migration repair --status applied 20261011053420   # car_meet_likes
supabase migration repair --status applied 20261011055554   # econ_tire_mods
supabase migration repair --status applied 20261011055555   # town_visitors
supabase migration repair --status applied 20261011055556   # econ_town_visitors
supabase migration repair --status applied 20261011055557   # econ_rivals
supabase migration repair --status applied 20261011055558   # race_boost
supabase migration repair --status applied 20261011114103   # econ_rescue_track
supabase migration repair --status applied 20261011114836   # econ_rescue_desert
supabase migration repair --status applied 20261011132752   # econ_long_progression
supabase migration repair --status applied 20261011135226   # econ_car_level_lock
supabase migration repair --status applied 20261011141305   # crates
supabase migration repair --status applied 20261011142443   # econ_crates_guard
supabase migration repair --status applied 20261011151220   # econ_office_buildings
supabase migration repair --status applied 20261011151221   # crate_skins
supabase migration repair --status applied 20261011151652   # econ_school_buildings
supabase migration repair --status applied 20261011162527   # econ_trailer_park_buildings
supabase migration repair --status applied 20261011162528   # crate_skin_tables
supabase migration repair --status applied 20261011194135   # town_helps
supabase migration repair --status applied 20261011201519   # chat
supabase migration repair --status applied 20261011201520   # friends_usernames
supabase migration repair --status applied 20261011201521   # crew_battles
supabase migration repair --status applied 20261011202841   # friend_cap_both
supabase migration repair --status applied 20261011215106   # race_gearbox
supabase migration repair --status applied 20261012004255   # crate_all_cars_mods
supabase migration repair --status applied 20261012005222   # more_cars
supabase migration repair --status applied 20261012010136   # live_events
supabase migration repair --status applied 20261012032433   # delete_account
supabase migration repair --status applied 20261012083027   # wager_matches
supabase migration repair --status applied 20261012153557   # kart_parties
supabase migration repair --status applied 20261012164801   # economy_followups
supabase migration repair --status applied 20261012165328   # kart_floor_by_pi
supabase migration repair --status applied 20261012172930   # wager_void
supabase migration repair --status applied 20261012183131   # exotic_cars
supabase migration repair --status applied 20261012224535   # reset_account
supabase migration repair --status applied 20261012230611   # wheel_spin
supabase migration repair --status applied 20261013021608   # restore_bay_fix
supabase migration repair --status applied 20261013031644   # friendly_taunts
supabase migration repair --status applied 20261013031645   # chat_delete
supabase migration repair --status applied 20261013031646   # casual_economy
supabase migration repair --status applied 20261013031938   # postcards_crew_parts
supabase migration repair --status applied 20261013031939   # oddball_cars
supabase migration repair --status applied 20261013032305   # decor_levels
supabase migration repair --status applied 20261013032508   # crate_hats
supabase migration repair --status applied 20261013034000   # resto_pieces
supabase migration repair --status applied 20261013034001   # rusty_addons
supabase migration repair --status applied 20261013120414   # pi_curve
supabase migration repair --status applied 20261013123821   # building_identity
supabase migration repair --status applied 20261013160051   # live_events_private
supabase migration repair --status applied 20261013160334   # gem_purchases
supabase migration repair --status applied 20261014023630   # purchase_reverse
supabase migration repair --status applied 20261014023850   # custom_paint
supabase migration repair --status applied 20261014035121   # crate_open_many
supabase migration repair --status applied 20261014035122   # rave_button
supabase migration repair --status applied 20261014042112   # more_car_mods
supabase migration repair --status applied 20261014042113   # crate_value_fixes
supabase migration repair --status applied 20261014042114   # arcade_boards
supabase migration repair --status applied 20261014051422   # arcade_prizes
supabase migration repair --status applied 20261014234044   # merge_bonus
supabase migration repair --status applied 20261014234822   # car_value_pass
supabase migration repair --status applied 20261015004001   # car_packs
supabase migration repair --status applied 20261015005000   # buildings
supabase migration repair --status applied 20261015022452   # one_like_per_town
supabase migration repair --status applied 20261015042052   # mod_stats
supabase migration repair --status applied 20261015042053   # kberg_lockdown
supabase migration repair --status applied 20261015042054   # admin_panel
supabase migration repair --status applied 20261015163753   # admin_grant_any_amount
supabase migration repair --status applied 20261015170454   # admin_grant_parts
supabase migration repair --status applied 20261015224727   # more_homes
supabase migration repair --status applied 20261016001442   # admin_level_bypass_and_xp
supabase migration repair --status applied 20261016004837   # admin_rusty_bypass
supabase migration repair --status applied 20261016005604   # pack_only_cars
supabase migration repair --status applied 20261016012518   # bigger_trophy_road
supabase migration repair --status applied 20261016013608   # crew_ranks
supabase migration repair --status applied 20261016021620   # race_modes_no_level_walls
supabase migration repair --status applied 20261016021621   # call_cards
supabase migration repair --status applied 20261016024237   # merge_2x4
supabase migration repair --status applied 20261016025403   # endless_goals
supabase migration repair --status applied 20261016033911   # season_skins_out_of_crates
supabase migration repair --status applied 20261016033912   # gems_x10
supabase migration repair --status applied 20261017200711   # invite_rewards
supabase migration repair --status applied 20261017204805   # crew_war_chests_log
supabase migration repair --status applied 20261017225612   # crew_war_map
supabase migration repair --status applied 20261018151544   # war_race_lock
supabase migration repair --status applied 20261018153855   # client_errors
supabase migration repair --status applied 20261018202743   # invite_rewards_tighter
supabase migration repair --status applied 20261018205440   # chat_reports
supabase migration repair --status applied 20261019025009   # roblox_link
supabase migration repair --status applied 20261019122042   # roblox_link_hardening

# 2. Live history rows with no file. The 10-13 run applied 0069_casual_economy (now
#    20261013031646_casual_economy.sql) in five pieces: casual_economy_guard_1..4 and
#    retire_old_crate_open (the file's `drop function if exists public.crate_open(text)`). That file is
#    marked applied above, so these five rows are history only and are removed. Only remote-only rows
#    in that 10-13 03:30:36 to 03:39:46 window are touched; anything else stops the script.
remote_only=$(supabase migration list | awk -F'|' 'NF>=3 { l=$1; r=$2; gsub(/ /,"",l); gsub(/ /,"",r); if (l=="" && r ~ /^[0-9]{14}$/) print r }')
for v in $remote_only; do
  if [[ "$v" -lt 20261013033036 || "$v" -gt 20261013033946 ]]; then
    echo "STOP: live history has $v with no file in supabase/migrations. Nothing reverted; ask before going on." >&2
    exit 1
  fi
done
for v in $remote_only; do
  supabase migration repair --status reverted "$v"
done

# 3. Verify: every row should show the same version under Local and Remote, with no blanks.
supabase migration list
