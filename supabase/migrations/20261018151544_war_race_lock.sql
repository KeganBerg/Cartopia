-- 0115 War race lock (2026-10-18; Security audit re-check, report security/report-2026-10-18.md). Needs 0114.
-- war_attack_start and war_attack_submit are 0114's, plus one advisory lock per player as their first step, so two
-- starts (or a start and a submit) sent at once run one after the other. Before, two parallel starts found no run
-- row to lock and the second overwrote the first, skipping 0114's unfinished-run check. Nothing else changes.
-- Running this file again changes nothing.

-- Returns the time to beat and the attacks left after this one.
create or replace function public.war_attack_start(p_target text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  rules jsonb := public.crew_war_rules();
  cid uuid;
  x public.crew_battles;
  rival uuid;
  my_pi int;
  their numeric;
  w numeric;
  i int;
  old public.war_runs;
begin
  if me is null then raise exception 'Sign in to race in the crew war' using errcode = 'insufficient_privilege'; end if;
  perform pg_advisory_xact_lock(hashtext('war:' || me::text));
  select clan_id into cid from public.clan_members where owner_id = me;
  if cid is null then raise exception 'Join a crew to race in the crew war'; end if;
  select (g.best_car ->> 'pi')::int into my_pi from public.game_saves g where g.owner_id = me and g.best_car ? 'pi';
  if my_pi is null then raise exception 'no saved car' using errcode = 'no_data_found'; end if;
  -- An attack started and never finished counts as a lost one, so a bad run can't be dropped and raced again.
  select * into old from public.war_runs where owner_id = me for update;
  if old.owner_id is not null then
    if old.started_at > now() - interval '3 seconds' then raise exception 'slow down' using errcode = 'check_violation'; end if;
    insert into public.war_attacks (battle_id, attacker, attacker_clan, target, won, t, their, stars, points, at)
      values (old.battle_id, me, old.clan_id, old.target, false, old.their, old.their, 0, 0, old.started_at);
    delete from public.war_runs where owner_id = me;
  end if;
  if econ_private.war_attacks_today(me) >= (rules ->> 'attacksPerDay')::int then
    raise exception 'No war races left today' using errcode = 'check_violation';
  end if;
  x := public.crew_battle_of(cid);
  if x.id is null then raise exception 'No crew war this week'; end if;
  if x.bot is not null then
    if p_target !~ '^bot[0-9]+$' then raise exception 'Not in the rival crew'; end if;
    i := substr(p_target, 4)::int;
    if i < 1 or i > jsonb_array_length(x.bot -> 'members') then raise exception 'Not in the rival crew'; end if;
    -- A par for the attacker's own car (1.3x the floor, as ghost pars), tighter for the crew's stronger drivers.
    w := ((x.bot -> 'members' -> (i - 1)) ->> 'w')::numeric;
    their := round(public.race_floor(my_pi) * (1.34 - 0.05 * least(greatest(w, 0.4), 1.6)), 2);
  else
    rival := case when cid = x.a then x.b else x.a end;
    if p_target !~ '^[0-9a-f-]{36}$' or not exists (select 1 from public.clan_members m where m.clan_id = rival and m.owner_id = p_target::uuid) then
      raise exception 'Not in the rival crew';
    end if;
    their := public.ghost_target(p_target::uuid);
    if their is null then raise exception 'They have no car to race yet'; end if;
  end if;
  insert into public.war_runs as r (owner_id, battle_id, clan_id, target, their, started_at)
    values (me, x.id, cid, p_target, their, now())
    on conflict (owner_id) do update set battle_id = excluded.battle_id, clan_id = excluded.clan_id,
      target = excluded.target, their = excluded.their, started_at = now();
  return jsonb_build_object('their', their,
    'left', (rules ->> 'attacksPerDay')::int - econ_private.war_attacks_today(me) - 1);
end $$;

-- Finishes the attack in progress: stars and war points for a win. Counts as one of the day's attacks either way.
create or replace function public.war_attack_submit(t numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  rules jsonb := public.crew_war_rules();
  r public.war_runs;
  my_pi int;
  kept numeric;
  won boolean;
  stars int := 0;
  pts int := 0;
begin
  if me is null then raise exception 'Sign in to race in the crew war' using errcode = 'insufficient_privilege'; end if;
  perform pg_advisory_xact_lock(hashtext('war:' || me::text));
  if t is null or t <= 0 or t > 120 then raise exception 'bad time' using errcode = 'check_violation'; end if;
  select * into r from public.war_runs where owner_id = me for update;
  if r.owner_id is null or now() - r.started_at < make_interval(secs => t::double precision) or now() - r.started_at > interval '3 minutes' then
    raise exception 'no run to finish' using errcode = 'check_violation';
  end if;
  delete from public.war_runs where owner_id = me;
  select (g.best_car ->> 'pi')::int into my_pi from public.game_saves g where g.owner_id = me;
  kept := round(greatest(t, public.race_floor(coalesce(my_pi, 0))), 3);
  won := kept < r.their;
  if won then
    stars := 1
      + case when kept <= r.their * (1 - (rules ->> 'star2')::numeric) then 1 else 0 end
      + case when kept <= r.their * (1 - (rules ->> 'star3')::numeric) then 1 else 0 end;
    pts := stars * (rules ->> 'starPoints')::int;
  end if;
  insert into public.war_attacks (battle_id, attacker, attacker_clan, target, won, t, their, stars, points)
    values (r.battle_id, me, r.clan_id, r.target, won, kept, r.their, stars, pts);
  -- Points go to the crew the attack started for, while that crew still has this player.
  if pts > 0 and exists (select 1 from public.clan_members m where m.owner_id = me and m.clan_id = r.clan_id) then
    perform econ_private.battle_add(me, r.clan_id, 0, 0, 0, 0, pts);
  end if;
  return jsonb_build_object('kept', kept, 'their', r.their, 'won', won, 'stars', stars, 'points', pts,
    'left', greatest(0, (rules ->> 'attacksPerDay')::int - econ_private.war_attacks_today(me)));
end $$;

revoke execute on function public.war_attack_start(text), public.war_attack_submit(numeric) from public, anon;
grant execute on function public.war_attack_start(text), public.war_attack_submit(numeric) to authenticated;
