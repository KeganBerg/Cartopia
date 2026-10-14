# python3 scripts/crate10/make_batch_sql.py <source migration with the newest crate_open> <out.sql> <number>
# Writes the Open ×10 migration: that crate_open() with the five batch:begin/batch:end blocks,
# plus crate_batch_state() and crate_open_many(), whose price line follows the crate's priceCap.
import re, sys
src, out, num = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(src).read()
m = re.search(r"^create or replace function public\.crate_open\(p_crate text.*?^grant execute on function public\.crate_open\(text, text\) to authenticated;\n", text, re.S | re.M)
co = m.group(0)
def rep(a, b):
    global co
    assert co.count(a) == 1, (a, co.count(a))
    co = co.replace(a, b)
rep("\nbegin\n  if me is null then", """
  -- crate_open_many() rolling one of its batch (batch:begin ... batch:end marks each change).
  -- batch:begin
  batch boolean := coalesce(current_setting('econ.crate_batch', true), '') = coalesce(me::text, '-');
  spent_c bigint;
  spent_b bigint;
  -- batch:end
begin
  if me is null then""")
rep("""  saved := floor(public.econ_num(st, 'crates'))::int;
  -- Opens the save hasn't counted yet go back to the game first.
  if saved < last_seq then""", """  saved := floor(public.econ_num(st, 'crates'))::int;
  -- batch:begin
  -- In a batch, what its earlier rolls gave counts as the player's already.
  if batch then
    st := econ_private.crate_batch_state(me, st, saved);
  end if;
  -- batch:end
  -- Opens the save hasn't counted yet go back to the game first (in a batch: its own earlier rolls).
  if saved < last_seq and not batch then""")
rep("""  if exists (select 1 from public.crate_opens x where x.owner_id = me and x.created_at > now() - interval '1.5 seconds') then""",
    """  if not batch and exists (select 1 from public.crate_opens x where x.owner_id = me and x.created_at > now() - interval '1.5 seconds') then""")
rep("""  if p_free is not null then
    cost_c := 0;
    cost_b := 0;
  end if;
""", """  if p_free is not null then
    cost_c := 0;
    cost_b := 0;
  end if;
  -- batch:begin
  -- A batch pays for every roll in it out of the saved coins or gems.
  if batch then
    select coalesce(sum(x.cost_coins), 0), coalesce(sum(x.cost_bucks), 0) into spent_c, spent_b
      from public.crate_opens x where x.owner_id = me and x.seq > saved;
    if public.econ_num(st, 'coins') < spent_c + cost_c or public.econ_num(st, 'bucks') < spent_b + cost_b then
      raise exception 'not enough for the batch' using errcode = 'P0001';
    end if;
  end if;
  -- batch:end
""")
pending = open('supabase/pending/crate_open_many.sql').read() if len(sys.argv) < 5 else open(sys.argv[4]).read()
state = re.search(r"^-- The save as a batch's next roll.*?^revoke all on function econ_private\.crate_batch_state\(uuid, jsonb, int\) from public, anon, authenticated;\n", pending, re.S | re.M).group(0)
many = re.search(r"^-- Opens p_count .*?^grant execute on function public\.crate_open_many\(text, int\) to authenticated;\n", pending, re.S | re.M).group(0)
old = "price := ((c ->> 'base')::bigint + (c ->> 'perLevel')::bigint * lvl) * p_count;"
assert many.count(old) == 1
many = many.replace(old, "-- A coin crate stops getting dearer at its priceCap level, as in crate_open().\n  price := ((c ->> 'base')::bigint + (c ->> 'perLevel')::bigint * least(lvl, coalesce((c ->> 'priceCap')::int, lvl))) * p_count;")
srcname = src.split('/')[-1]
head = f"""-- {num}: Open ×10 (2026-10-14, thread "Open 10x crates", client PR #437). Runs after {srcname};
-- it adds an RPC the client calls (ORDER RULE: run it before the ship that carries #437, or
-- signed-in ×10 shows "coming very soon"). It writes no new ids and leaves crate tables and odds alone.
--
--   * crate_open_many(p_crate, p_count): 2 to 10 opens of one crate in one call, each one rolled
--     by crate_open() itself, so odds, pity, pieces and hats stay the single open's. Checks once:
--     signed in, the save is up to date (else the pending opens come back, as crate_open does),
--     one call per 1.5 s, the level, and coins or gems for all of them at the single price
--     (priceCap included, no discount). Returns {{opens: [crate_json...]}} in seq order.
--   * crate_open(text, text) is {srcname}'s with five small changes, each between "batch:begin"
--     and "batch:end" (scripts/crate10/make_batch_sql.py carries them onto a newer copy). While
--     crate_open_many runs (the transaction-local setting econ.crate_batch holds the player's id)
--     it skips the pending check and the 1.5 s wait, treats what the batch already rolled as owned
--     (crate_batch_state: new cars, parts, paints, hats) and checks the whole batch's cost against
--     the save. Outside a batch it behaves exactly as before.
--   * crate_open_many reads the crate table from crate_open()'s own source, as wheel_spin() does.

"""
open(out, 'w').write(head + state + "\n" + co + "\n" + many)
print('wrote', out)
