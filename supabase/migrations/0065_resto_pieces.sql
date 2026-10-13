-- 0065 Resto-mod pieces (2026-10-12, thread "Resto-mod cars from crate parts"): three secret cars
-- (sprint Valtorre Sprint 65, revenant Liberty Revenant '69, pontone Corvara Pontone 58) that are
-- never sold. Garage, Gold and Diamond crates drop one of four pieces of a car the level has
-- unlocked and the player hasn't built; the fourth piece builds it. A piece already won pays
-- coins. Pieces are counted from crate_opens, so the save's restoParts is only a mirror.
--   * crate_opens takes kinds 'piece' and 'piecedupe' and a piece number (0-3).
--   * crate_json() hands pieces to the game ({kind:'piece', model, piece, uid?, color?}).
--   * crate_pay() counts a building piece's car with the crate cars, so the guard pays for it.
--   * car_granted() keeps a car a piece built. The catalog lists resto-mods at unlock 999, so the
--     guard's car level lock refunds any copy the server didn't build.
--   * econ_catalog() rebuilt from econCatalog() (adds the three cars and the Resto Garage set).
--   * piece_grant() rolls a piece from resto_tables() into crate_opens; crate_open() is 0062's
--     with the crate tables regenerated from crateTables() and a 0.1% piece slice that calls it.
--     resto_piece_roll(me, source) rolls a non-crate source's chance (Rusty's Rescue top zone,
--     wired by its own thread) and grants through piece_grant(). econ_guard() is
--     unchanged (0041).
-- Run it only AFTER the client with these cars ships, and after 0062 (ORDER RULE: it writes new
-- car ids). 0064's wheel reads this crate_open()'s table and still finds the street crate.
-- Economy review: secret cars have no home crate, so the car slice never gives one; the only way to
-- keep one is car_granted() on a server-built piece row. A reset (0063) deletes the pieces with the
-- other crate opens.

alter table public.crate_opens add column if not exists piece int;
alter table public.crate_opens drop constraint if exists crate_opens_kind_check;
alter table public.crate_opens add constraint crate_opens_kind_check
  check (kind in ('coins', 'jackpot', 'car', 'dupe', 'mod', 'skin', 'skindupe', 'piece', 'piecedupe'));
create index if not exists crate_opens_pieces on public.crate_opens (owner_id, model) where kind = 'piece';

create or replace function econ_private.crate_json(o public.crate_opens) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('seq', o.seq, 'crate', o.crate, 'cost', jsonb_build_object('coins', o.cost_coins, 'bucks', o.cost_bucks),
    'drop', case o.kind
      when 'car' then jsonb_build_object('kind', 'car', 'model', o.model, 'uid', o.car_uid, 'color', o.color)
      when 'dupe' then jsonb_build_object('kind', 'dupe', 'model', o.model, 'coins', o.coins)
      when 'mod' then jsonb_build_object('kind', 'mod', 'car', o.car_uid, 'mod', o.mod)
      when 'skin' then jsonb_build_object('kind', 'skin', 'skin', o.skin, 'part', o.part)
      when 'skindupe' then jsonb_build_object('kind', 'skindupe', 'skin', o.skin, 'part', o.part, 'coins', o.coins)
      when 'piece' then jsonb_strip_nulls(jsonb_build_object('kind', 'piece', 'model', o.model, 'piece', o.piece, 'uid', o.car_uid, 'color', o.color))
      when 'piecedupe' then jsonb_build_object('kind', 'piecedupe', 'model', o.model, 'piece', o.piece, 'coins', o.coins)
      else jsonb_build_object('kind', 'coins', 'coins', o.coins, 'jackpot', o.kind = 'jackpot') end)
$$;
revoke all on function econ_private.crate_json(public.crate_opens) from public, anon, authenticated;

-- For the save guard: as 0043, with the car a fourth piece built counted among the crate cars.
create or replace function econ_private.crate_pay(p_from int, p_to int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'n', coalesce((select max(x.seq) from public.crate_opens x where x.owner_id = auth.uid()), 0),
    'cost_coins', coalesce(sum(o.cost_coins), 0), 'cost_bucks', coalesce(sum(o.cost_bucks), 0),
    'coins', coalesce(sum(o.coins), 0),
    'cars', coalesce(jsonb_agg(jsonb_build_object('uid', o.car_uid, 'model', o.model)) filter (where o.kind = 'car' or (o.kind = 'piece' and o.car_uid is not null)), '[]'),
    'mods', coalesce(jsonb_agg(jsonb_build_object('car', o.car_uid, 'mod', o.mod)) filter (where o.kind = 'mod'), '[]'),
    'skins', coalesce(jsonb_agg(o.skin) filter (where o.kind = 'skin' and not o.part), '[]'),
    'modSkins', coalesce(jsonb_agg(o.skin) filter (where o.kind = 'skin' and o.part), '[]'))
  from public.crate_opens o
  where o.owner_id = auth.uid() and o.seq > p_from and o.seq <= p_to
$$;

-- The car level lock keeps a car a crate gave this player, or one its pieces built.
create or replace function econ_private.car_granted(u text, m text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.crate_opens o where o.owner_id = auth.uid() and o.car_uid = u and o.model = m
                 and (o.kind = 'car' or o.kind = 'piece'))
$$;
revoke all on function econ_private.car_granted(text, text) from public, anon;
grant execute on function econ_private.car_granted(text, text) to authenticated;

create or replace function public.econ_catalog() returns jsonb
language sql immutable set search_path = '' as $$
-- catalog:begin
select $catalog${"cars":{"pip":{"name":"Kipper Pocket","body":"compact","price":800,"bucks":0,"power":18,"grip":36,"weight":24,"unlock":1},"civic":{"name":"Kazumi Commuter","body":"sedan","price":1500,"bucks":0,"power":24,"grip":34,"weight":36,"unlock":1},"trail":{"name":"Ironside Workhorse","body":"truck","price":3500,"bucks":0,"power":38,"grip":26,"weight":74,"unlock":3},"miata":{"name":"Kazumi Zephyr","body":"roadster","price":7000,"bucks":0,"power":32,"grip":54,"weight":22,"unlock":5},"stallion":{"name":"Liberty Bore Horse '68","body":"muscle","price":14000,"bucks":0,"power":52,"grip":34,"weight":54,"unlock":7},"rally":{"name":"Kodiak Gravel Rex","body":"rally","price":26000,"bucks":0,"power":52,"grip":64,"weight":40,"unlock":10},"vette":{"name":"Liberty Sidewinder","body":"sports","price":55000,"bucks":0,"power":66,"grip":54,"weight":38,"unlock":15},"charger":{"name":"Liberty Brawler","body":"muscle","price":42000,"bucks":0,"power":70,"grip":40,"weight":60,"unlock":13},"hellcat":{"name":"Liberty Hellhound 707","body":"widebody","price":80000,"bucks":0,"power":80,"grip":46,"weight":62,"unlock":18},"gtr":{"name":"Kazumi Ronin GT","body":"coupe","price":115000,"bucks":0,"power":78,"grip":70,"weight":46,"unlock":22},"tomahawk":{"name":"Ironside Tomahawk","body":"tank","price":420000,"bucks":0,"power":100,"grip":94,"weight":60,"unlock":36},"zippy":{"name":"Kipper Zip 50","body":"scooter","price":2100,"bucks":0,"power":14,"grip":30,"weight":8,"unlock":2},"baron":{"name":"Liberty Road Baron","body":"chopper","price":16000,"bucks":0,"power":46,"grip":36,"weight":30,"unlock":7},"shinden":{"name":"Kazumi Shinden RR","body":"sportbike","price":135000,"bucks":0,"power":80,"grip":60,"weight":14,"unlock":24},"camper":{"name":"Lakeside Sunrise Camper","body":"van","price":2800,"bucks":0,"power":20,"grip":28,"weight":64,"unlock":2},"hotshot":{"name":"Kazumi Hot Shot RS","body":"hatch","price":7000,"bucks":0,"power":36,"grip":50,"weight":26,"unlock":5},"ridgeback":{"name":"Kodiak Ridgeback 4x4","body":"suv","price":10000,"bucks":0,"power":44,"grip":46,"weight":62,"unlock":6},"kitsune":{"name":"Kazumi Kitsune Drift","body":"coupe","price":20000,"bucks":0,"power":48,"grip":58,"weight":30,"unlock":9},"current":{"name":"Sparkline Current","body":"ev","price":62000,"bucks":0,"power":72,"grip":52,"weight":50,"unlock":16},"salon":{"name":"Regent Grand Salon","body":"luxury","price":0,"bucks":45,"power":64,"grip":50,"weight":70,"unlock":11},"stomper":{"name":"Ironside Dune Stomper","body":"truck","price":36000,"bucks":0,"power":66,"grip":44,"weight":72,"unlock":12},"monoposto":{"name":"Veloce Monoposto 1","body":"formula","price":220000,"bucks":0,"power":90,"grip":90,"weight":20,"unlock":30},"zenith":{"name":"Aether Zenith R","body":"super","price":550000,"bucks":0,"power":100,"grip":96,"weight":26,"unlock":40},"schoolbus":{"name":"Ironside Scholar 72","body":"bus","price":6500,"bucks":0,"power":30,"grip":26,"weight":90,"unlock":4},"shaggy":{"name":"Lakeside Shaggy Hound","body":"dogvan","price":8000,"bucks":0,"power":26,"grip":30,"weight":66,"unlock":5},"tusker":{"name":"Kodiak Tusker Scout","body":"tusker","price":95000,"bucks":0,"power":70,"grip":72,"weight":58,"unlock":20},"lambo":{"name":"Veloce Corrida V12","body":"wedge","price":0,"bucks":90,"power":86,"grip":70,"weight":34,"unlock":26},"hyper":{"name":"Veloce Hyperion","body":"super","price":300000,"bucks":0,"power":98,"grip":86,"weight":32,"unlock":33},"kreis":{"name":"Brandt Kreis S","body":"sedan","price":48000,"bucks":0,"power":62,"grip":58,"weight":44,"unlock":14},"bergmeister":{"name":"Falke Bergmeister RS","body":"rearengine","price":70000,"bucks":0,"power":66,"grip":64,"weight":34,"unlock":17},"rattler":{"name":"Liberty Rattler GT","body":"muscle","price":105000,"bucks":0,"power":84,"grip":54,"weight":56,"unlock":21},"cottonmouth":{"name":"Liberty Cottonmouth ACR","body":"longnose","price":150000,"bucks":0,"power":88,"grip":62,"weight":46,"unlock":25},"ringmeister":{"name":"Nordwerk Ring V10","body":"super","price":190000,"bucks":0,"power":88,"grip":82,"weight":40,"unlock":28},"raiden":{"name":"Kazumi Raiden R26","body":"prototype","price":260000,"bucks":0,"power":92,"grip":92,"weight":24,"unlock":32},"sovereign":{"name":"Moreau Sovereign 16","body":"super","price":0,"bucks":140,"power":100,"grip":88,"weight":44,"unlock":34},"wraith":{"name":"Nordvik Wraith","body":"wedge","price":480000,"bucks":0,"power":100,"grip":90,"weight":30,"unlock":38},"fulmine":{"name":"Veloce Fulmine V12","body":"scissor","price":0,"bucks":220,"power":100,"grip":92,"weight":30,"unlock":40},"eclat":{"name":"Moreau Eclat W16","body":"horseshoe","price":650000,"bucks":0,"power":100,"grip":94,"weight":40,"unlock":42},"orafo":{"name":"Aurelio Orafo V12","body":"teardrop","price":0,"bucks":180,"power":98,"grip":94,"weight":28,"unlock":39},"sprint":{"name":"Valtorre Sprint 65","body":"stepnose","price":70000,"bucks":0,"power":110,"grip":104,"weight":30,"unlock":999},"revenant":{"name":"Liberty Revenant '69","body":"restomuscle","price":110000,"bucks":0,"power":130,"grip":92,"weight":56,"unlock":999},"pontone":{"name":"Corvara Pontone 58","body":"pontoon","price":170000,"bucks":0,"power":122,"grip":118,"weight":26,"unlock":999},"bug":{"name":"Bumble Bubble","body":"bubble","price":1200,"bucks":0,"power":14,"grip":28,"weight":28,"unlock":1},"woodie":{"name":"Lakeside Woodie Wagon","body":"wagon","price":2200,"bucks":0,"power":22,"grip":28,"weight":56,"unlock":1},"hauler":{"name":"Old Faithful Hauler","body":"truck","price":3000,"bucks":0,"power":26,"grip":26,"weight":70,"unlock":1},"cruiser":{"name":"Sunset Cruiser '57","body":"classic","price":5000,"bucks":0,"power":38,"grip":34,"weight":58,"unlock":1},"buggy":{"name":"Dune Skipper Buggy","body":"offroad","price":6000,"bucks":0,"power":34,"grip":56,"weight":18,"unlock":1},"bandit":{"name":"Night Bandit","body":"muscle","price":8000,"bucks":0,"power":56,"grip":38,"weight":54,"unlock":1},"lemans":{"name":"Liberty Endurance GT","body":"super","price":16000,"bucks":0,"power":72,"grip":62,"weight":32,"unlock":1},"gullwing":{"name":"Silver Wing 300","body":"coupe","price":30000,"bucks":0,"power":64,"grip":58,"weight":36,"unlock":1},"speedster":{"name":"Fairhaven Speedster","body":"roadster","price":12000,"bucks":0,"power":58,"grip":46,"weight":26,"unlock":1},"nightfall":{"name":"Aether Nightfall","body":"wedge","price":24000,"bucks":0,"power":78,"grip":72,"weight":30,"unlock":0}},"buildings":{"showroom":{"price":0,"obstacle":false,"fuelCap":0},"garage":{"price":0,"obstacle":false,"fuelCap":0},"rescue":{"price":1000,"obstacle":false,"fuelCap":0},"crew":{"price":2500,"obstacle":false,"fuelCap":0},"gas":{"price":1500,"obstacle":false,"fuelCap":10,"up":{"spend":[0,1150,2850,5400,9400,15400,24350,37650,57450,87000],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[10,12,14,16,18,20,22,24,26,28]}},"pizza":{"price":400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2650,4450,7150,11050,16800,25200],"coins":[120,132,172.8,187.2,252,270,288,408,432,456],"xp":[10,10,14.4,14.4,18,18,21,28,28,28],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"donut":{"price":1000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,750,1900,3600,6350,10450,16550,25600,39000,58900],"coins":[100,116.47,144,167.14,193.85,225,261.82,306,360,427.5],"xp":[8,9.18,10.4,12,12.92,15,17.45,19.2,22.67,25.5],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"burger":{"price":1400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1050,2650,5000,8750,14350,22700,35150,53700,81300],"coins":[100,120,144,164.21,197.65,225,256,313.85,360,414.55],"xp":[7.5,8.73,10.2,10.74,12.71,14.25,16,18.46,21,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"icecream":{"price":2000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1500,3750,7150,12400,20300,32100,49700,75950,115100],"coins":[92,108.43,132.48,156,184,207,245.33,276,331.2,374.57],"xp":[7.2,8.14,9.6,10.96,12.57,13.8,15.33,16.94,20,22.29],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"carwash":{"price":2300,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1750,4350,8250,14250,23300,36800,56950,87000,131900],"coins":[113.33,136,163.2,189.43,219.69,255,296.73,346.8,408,456],"xp":[8.33,9.45,11.2,12.43,13.85,15.5,18,20.4,23.33,25.41],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"diner":{"price":4600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3450,8650,16400,28250,46000,72600,112400,171950,261050],"coins":[120,144,169.41,199.15,234.42,270,320,370.91,418.06,488.57],"xp":[8,9.16,10.35,11.74,13.4,15,17.33,19.64,21.68,24.86],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tires":{"price":2300,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1750,4350,8250,14250,23300,36800,56950,87000,131900],"coins":[100,125.45,137.56,171.89,190.59,225,273.1,297.78,350.4,386.09],"xp":[5,5.73,6.44,7.46,8.47,9.38,10.76,12,13.44,15.13],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bowling":{"price":6700,"obstacle":false,"fuelCap":0,"up":{"spend":[0,5050,12600,23900,41050,66800,105350,163100,249550,379050],"coins":[108.57,130.29,154.14,182.4,212.8,248.73,286.12,329.87,381.77,433.2],"xp":[7.86,9.04,10.31,11.63,13.2,15.05,16.94,18.89,21.49,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"motel":{"price":9600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,7200,18000,34200,58700,95450,150550,233050,356650,541900],"coins":[87.5,105,123.93,146.25,171.26,198.95,231.72,267.75,306.49,352.06],"xp":[5.83,6.73,7.57,8.68,9.79,11.12,12.55,14.25,15.89,18],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tuner":{"price":15200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,11400,28500,54150,92850,150850,237800,368150,563550,856400],"coins":[153,186.33,216,259.87,298.88,352.41,402.41,470.33,533.03,617.26],"xp":[7,8.07,9.06,10.45,11.72,13.37,14.96,17.01,18.97,21.47],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"stadium":{"price":40000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,30000,75000,142500,243950,396150,624350,966550,1479750,2249300],"coins":[140,167.49,198.3,234,273.49,318.99,369.91,426.27,490.38,563.29],"xp":[10,11.42,12.98,14.79,16.74,18.99,21.47,24.18,27.24,30.71],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"cinema":{"price":10500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,7900,19700,37400,64200,104350,164550,254750,389900,592450],"coins":[112,134.4,158.12,187.87,218.79,255.19,294.58,341.01,390.19,448],"xp":[8,9.16,10.35,11.87,13.4,15.19,17.1,19.34,21.68,24.42],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"coffee":{"price":800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,600,1500,2850,5100,8450,13400,20750,31600,47700],"coins":[100,120,144,173.33,186.67,225,274.29,291.43,360,380],"xp":[8,8.73,10.8,12,13.33,15,17.14,18.86,22,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tacos":{"price":1700,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1300,3200,6050,10550,17300,27400,42400,64800,98200],"coins":[105,126,151.2,172.42,207.53,236.25,268.8,329.54,378,435.27],"xp":[8,9.27,10.8,11.37,13.41,15,16.8,20.31,22,25.09],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"lube":{"price":3800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,2850,7150,13550,23350,38100,60150,93100,142400,216150],"coins":[100,122.18,145.88,160.85,192.56,225,270,316.36,340.65,402.86],"xp":[5,5.67,6.59,7.4,8.37,9.3,11,12.36,13.55,15.43],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"arcade":{"price":5800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,4350,10900,20700,35600,57900,91350,141400,216300,328500],"coins":[106.67,128,151.08,178.29,206.77,245.11,279.27,326.4,373.62,429.18],"xp":[7.5,8.55,9.84,11.14,12.46,14.3,16.09,18.3,20.43,22.94],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bodyshop":{"price":11400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,8550,21400,40650,69700,113300,178650,276550,423250,643100],"coins":[101,121.2,142.59,169.42,197.3,230.13,265.64,307.52,351.87,404],"xp":[7.5,8.62,9.76,11.1,12.56,14.28,16.11,18.09,20.32,22.95],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"market":{"price":19000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,14250,35650,67700,116000,188450,297050,459850,703900,1069800],"coins":[112,133.59,159.16,187.2,218.79,254.12,295.93,342.72,394.43,450.64],"xp":[7.33,8.39,9.55,10.8,12.28,13.92,15.74,17.88,20.09,22.59],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"firehouse":{"price":24000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,18000,45000,85500,146450,237900,375000,580550,888700,1350700],"coins":[119,142.15,168.83,198.55,232.47,271.14,312.99,362.33,417.95,480.21],"xp":[7.5,8.58,9.75,11.1,12.56,14.28,16.03,18.18,20.49,23.15],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"police":{"price":32000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,24000,60000,114000,195200,317000,499650,773550,1184200,1800000],"coins":[126,150.65,178.58,210,246.14,286.36,332.31,384.79,441.82,505.77],"xp":[8,9.13,10.39,11.79,13.4,15.15,17.14,19.4,21.82,24.51],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"parkade":{"price":60000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,45000,112500,213750,365850,593950,936050,1449150,2218600,3372600],"coins":[154,183.96,218.48,256.94,300.84,350.89,406.43,468.9,540.88,618.71],"xp":[9.5,10.83,12.35,14.02,15.91,18.04,20.37,22.97,25.95,29.13],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"club":{"price":8800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,6600,16500,31350,53850,87550,138050,213750,327100,496950],"coins":[150,180,211.76,248.94,293.02,337.5,400,463.64,522.58,610.71],"xp":[12,13.75,15.53,17.62,20.09,22.5,26,29.45,32.52,37.29],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"parts":{"price":8000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,6000,15000,28500,48950,79650,125600,194450,297550,452000],"coins":[113.75,139.91,161.78,193.28,221.57,264.76,301.24,349.33,401.14,467.73],"xp":[5.63,6.41,7.41,8.32,9.39,10.67,12.21,13.56,15.43,17.33],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"offices":{"price":16500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,12400,30950,58800,100750,163700,258050,399500,611550,929400],"coins":[100,119.28,142.11,167.14,195.35,226.89,264.22,306,352.17,402.35],"xp":[6.67,7.59,8.68,9.86,11.16,12.61,14.31,16.2,18.26,20.47],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"hospital":{"price":48000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,36000,90000,171000,292700,475250,749050,1159600,1775300,2698650],"coins":[133.33,159.52,188.85,222.86,260.47,303.8,352.29,405.97,467.03,536.47],"xp":[9.33,10.66,12.12,13.8,15.63,17.72,20.04,22.57,25.43,28.66],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"hq":{"price":82000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,61500,153750,292150,499900,811550,1278950,1979950,3031350,4608250],"coins":[138.89,166,196.94,232.14,271.32,316.01,366.97,423.59,487.36,558.82],"xp":[9.78,11.15,12.71,14.46,16.37,18.54,20.99,23.68,26.69,30.02],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"helipad":{"price":115000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,86250,215650,409700,701000,1137950,1793300,2776250,4250500,6461700],"coins":[157,187.72,222.52,262.23,306.7,357.72,414.07,478.03,550.52,632.44],"xp":[10.4,11.87,13.51,15.37,17.41,19.75,22.29,25.15,28.36,31.97],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"glasstower":{"price":185000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,138750,346900,659100,1127600,1830300,2884350,4465300,6836550,10393250],"coins":[160,191.42,227,266.95,312.56,363.79,421.78,487.16,560.43,643.76],"xp":[11.67,13.32,15.17,17.22,19.53,22.11,24.99,28.21,31.78,35.82],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"academy":{"price":16000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,12000,30000,57000,97700,158750,250300,387500,593150,901400],"coins":[92,109.73,130.74,153.77,179.72,208.74,243.08,281.52,324,370.16],"xp":[9.33,10.63,12.16,13.8,15.63,17.65,20.04,22.68,25.57,28.66],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"school":{"price":48000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,36000,90000,171000,292700,475250,749050,1159600,1775300,2698650],"coins":[122.86,147.05,174.42,205.14,240,279.42,323.76,374.87,430,495.15],"xp":[8.57,9.79,11.15,12.66,14.35,16.25,18.35,20.77,23.33,26.36],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"highschool":{"price":110000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,82500,206250,391900,670550,1088500,1715400,2655650,4065850,6180950],"coins":[164.44,196.54,233.17,274.86,321.24,374.16,434.5,501.53,577.04,661.65],"xp":[9.56,10.91,12.42,14.11,16,18.13,20.51,23.16,26.08,29.36],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"university":{"price":240000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,180000,450000,855000,1462700,2374250,3741550,5792350,8868400,13482300],"coins":[183.33,219.34,260.1,305.88,358.14,416.84,483.3,558.21,642.16,737.65],"xp":[9.33,10.66,12.14,13.78,15.63,17.68,19.99,22.57,25.43,28.66],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bush":{"price":150,"obstacle":true,"fuelCap":0},"rock":{"price":400,"obstacle":true,"fuelCap":0},"cactus":{"price":1500,"obstacle":true,"fuelCap":0},"house":{"price":250,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2750,4800,7900,12550,19600,30300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,1,2,3,4,5,6,7,8,9]}},"tree":{"price":50,"obstacle":false,"fuelCap":0},"palm":{"price":120,"obstacle":false,"fuelCap":0},"fountain":{"price":800,"obstacle":false,"fuelCap":0},"flowers":{"price":80,"obstacle":false,"fuelCap":0},"lamp":{"price":60,"obstacle":false,"fuelCap":0},"bench":{"price":70,"obstacle":false,"fuelCap":0},"billboard":{"price":600,"obstacle":false,"fuelCap":0},"statue":{"price":0,"obstacle":false,"fuelCap":0},"pond":{"price":1500,"obstacle":false,"fuelCap":0},"pine":{"price":60,"obstacle":false,"fuelCap":0},"hedge":{"price":40,"obstacle":false,"fuelCap":0},"fence":{"price":30,"obstacle":false,"fuelCap":0},"picnic":{"price":90,"obstacle":false,"fuelCap":0},"busstop":{"price":200,"obstacle":false,"fuelCap":0},"hotdog":{"price":350,"obstacle":false,"fuelCap":0},"flagpole":{"price":300,"obstacle":false,"fuelCap":0},"arch":{"price":0,"obstacle":false,"fuelCap":0},"playground":{"price":1800,"obstacle":false,"fuelCap":0},"gazebo":{"price":1200,"obstacle":false,"fuelCap":0},"clocktower":{"price":3500,"obstacle":false,"fuelCap":0},"trailer":{"price":200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2750,4800,7900,12550,19600,30300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,1,2,3,4,5,6,7,8,9]}},"junkyard":{"price":21000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,15750,39400,74850,128200,208250,328250,508150,777850,1182200],"coins":[126.67,150.36,178.42,213.43,248.37,287.39,333.58,385.2,448.7,511.06],"xp":[7,7.95,9.16,10.37,11.72,13.21,15.08,17.04,19.17,21.46],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"dogpark":{"price":1600,"obstacle":false,"fuelCap":0},"skatepark":{"price":2400,"obstacle":false,"fuelCap":0},"koi":{"price":3000,"obstacle":false,"fuelCap":0},"garden":{"price":4800,"obstacle":false,"fuelCap":0},"pumpkins":{"price":250,"obstacle":false,"fuelCap":0},"scarecrow":{"price":450,"obstacle":false,"fuelCap":0},"graves":{"price":700,"obstacle":false,"fuelCap":0},"deadtree":{"price":1200,"obstacle":false,"fuelCap":0}},"goals":{"g0":{"coins":200,"xp":20,"bucks":0},"r1":{"coins":150,"xp":15,"bucks":0},"r2":{"coins":300,"xp":25,"bucks":1},"g1":{"coins":150,"xp":15,"bucks":0},"g2":{"coins":100,"xp":10,"bucks":0},"g3":{"coins":300,"xp":25,"bucks":0},"g4":{"coins":250,"xp":20,"bucks":0},"q1":{"coins":250,"xp":20,"bucks":0},"g5":{"coins":200,"xp":20,"bucks":0},"q2":{"coins":200,"xp":15,"bucks":0},"g6":{"coins":300,"xp":25,"bucks":0},"g7":{"coins":150,"xp":15,"bucks":0},"q3":{"coins":300,"xp":25,"bucks":0},"g8":{"coins":500,"xp":40,"bucks":1},"q4":{"coins":400,"xp":0,"bucks":0},"q5":{"coins":600,"xp":50,"bucks":0},"g9":{"coins":600,"xp":50,"bucks":0},"q6":{"coins":500,"xp":40,"bucks":0},"q7":{"coins":500,"xp":40,"bucks":0},"q8":{"coins":500,"xp":40,"bucks":0},"g10":{"coins":800,"xp":60,"bucks":1},"q9":{"coins":800,"xp":60,"bucks":0},"q10":{"coins":800,"xp":60,"bucks":0},"g11":{"coins":1000,"xp":70,"bucks":0},"q11":{"coins":1000,"xp":70,"bucks":0},"q12":{"coins":1000,"xp":0,"bucks":1},"gp1":{"coins":2000,"xp":150,"bucks":2},"q13":{"coins":1200,"xp":80,"bucks":0},"r3":{"coins":3000,"xp":200,"bucks":2},"q14":{"coins":1500,"xp":100,"bucks":0},"g12":{"coins":1200,"xp":80,"bucks":2},"q15":{"coins":2000,"xp":120,"bucks":0},"q16":{"coins":2000,"xp":120,"bucks":0},"q17":{"coins":2500,"xp":150,"bucks":1},"g13":{"coins":1500,"xp":100,"bucks":0},"q18":{"coins":2500,"xp":150,"bucks":0},"q19":{"coins":2500,"xp":150,"bucks":0},"g14":{"coins":2500,"xp":150,"bucks":2},"q20":{"coins":3000,"xp":0,"bucks":1},"q21":{"coins":3000,"xp":200,"bucks":0},"q22":{"coins":3000,"xp":200,"bucks":0},"g15":{"coins":5000,"xp":250,"bucks":3},"g16":{"coins":5000,"xp":250,"bucks":3},"q23":{"coins":6000,"xp":300,"bucks":2},"q24":{"coins":6000,"xp":300,"bucks":2},"q25":{"coins":6000,"xp":0,"bucks":2},"q26":{"coins":8000,"xp":400,"bucks":0},"q27":{"coins":8000,"xp":400,"bucks":2},"q28":{"coins":8000,"xp":400,"bucks":0},"q29":{"coins":10000,"xp":500,"bucks":2},"q30":{"coins":12000,"xp":600,"bucks":3},"q31":{"coins":12000,"xp":600,"bucks":2},"q32":{"coins":20000,"xp":800,"bucks":5},"q33":{"coins":20000,"xp":800,"bucks":3},"q34":{"coins":20000,"xp":0,"bucks":3},"q35":{"coins":30000,"xp":1000,"bucks":5},"q36":{"coins":30000,"xp":1000,"bucks":3},"q37":{"coins":30000,"xp":1000,"bucks":3},"q38":{"coins":50000,"xp":0,"bucks":5},"sp1":{"coins":300,"xp":25,"bucks":0},"sp2":{"coins":1000,"xp":60,"bucks":1},"sp3":{"coins":1500,"xp":80,"bucks":0},"sp4":{"coins":3000,"xp":150,"bucks":3}},"gp":{"rookie":{"unlock":2,"box":["trail","miata","woodie","cruiser"]},"street":{"unlock":8,"box":["stallion","rally","buggy","bandit"]},"pro":{"unlock":15,"box":["vette","charger","lemans"]},"legends":{"unlock":26,"box":["gtr","gullwing","shinden","lambo"]}},"rescue":{"pip":1,"civic":1,"bug":1,"woodie":1,"trail":1,"miata":1,"hauler":4,"buggy":4,"stallion":4,"cruiser":9,"rally":9,"bandit":9,"vette":9,"charger":15,"lemans":15,"gtr":15,"speedster":15,"gullwing":24,"hyper":24},"upgradeXpTo":[0,15,35,60,90,125,165,210,260,315],"mods":{"ducktail":{"slot":"spoiler","coins":1200,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":16,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"gtwing":{"slot":"spoiler","coins":4000,"parts":10,"bucks":0,"power":0,"grip":4,"weight":0,"xp":25,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"attackwing":{"slot":"spoiler","coins":0,"parts":0,"bucks":12,"power":0,"grip":6,"weight":0,"xp":46,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"twintips":{"slot":"exhaust","coins":1000,"parts":0,"bucks":0,"power":2,"grip":0,"weight":0,"xp":16},"sidepipes":{"slot":"exhaust","coins":3500,"parts":8,"bucks":0,"power":4,"grip":0,"weight":0,"xp":22},"flamepipes":{"slot":"exhaust","coins":0,"parts":0,"bucks":10,"power":6,"grip":0,"weight":0,"xp":46},"streetkit":{"slot":"kit","coins":1500,"parts":0,"bucks":0,"power":0,"grip":1,"weight":-2,"xp":19,"notOn":["scooter","chopper","sportbike"]},"widebody":{"slot":"kit","coins":6000,"parts":15,"bucks":0,"power":0,"grip":3,"weight":-3,"xp":28,"notOn":["scooter","chopper","sportbike"]},"carbonkit":{"slot":"kit","coins":0,"parts":0,"bucks":15,"power":0,"grip":3,"weight":-6,"xp":58,"notOn":["scooter","chopper","sportbike"]},"vented":{"slot":"hood","coins":800,"parts":0,"bucks":0,"power":1,"grip":0,"weight":-1,"xp":16,"notOn":["scooter","chopper","sportbike","formula"]},"ramscoop":{"slot":"hood","coins":3000,"parts":6,"bucks":0,"power":3,"grip":0,"weight":0,"xp":22,"notOn":["scooter","chopper","sportbike","formula"]},"blower":{"slot":"hood","coins":8000,"parts":20,"bucks":0,"power":5,"grip":0,"weight":0,"xp":31,"notOn":["scooter","chopper","sportbike","formula"]},"chrome":{"slot":"rims","coins":600,"parts":0,"bucks":0,"power":0,"grip":0,"weight":-1,"xp":13},"goldmesh":{"slot":"rims","coins":2500,"parts":5,"bucks":0,"power":0,"grip":1,"weight":-2,"xp":22},"luggage":{"slot":"spoiler","coins":2500,"parts":0,"bucks":0,"power":0,"grip":2,"weight":1,"xp":19,"only":["bus"]},"stacks":{"slot":"exhaust","coins":3000,"parts":5,"bucks":0,"power":3,"grip":0,"weight":0,"xp":19,"only":["bus"]},"cowcatcher":{"slot":"kit","coins":3500,"parts":8,"bucks":0,"power":0,"grip":2,"weight":0,"xp":22,"only":["bus"]},"disco":{"slot":"hood","coins":0,"parts":0,"bucks":6,"power":2,"grip":0,"weight":0,"xp":25,"only":["bus"]},"flag":{"slot":"spoiler","coins":6000,"parts":10,"bucks":0,"power":0,"grip":3,"weight":0,"xp":40,"only":["tank"]},"smoke":{"slot":"exhaust","coins":0,"parts":0,"bucks":8,"power":5,"grip":0,"weight":0,"xp":40,"only":["tank"]},"reactive":{"slot":"kit","coins":9000,"parts":20,"bucks":0,"power":0,"grip":4,"weight":1,"xp":40,"only":["tank"]},"watercannon":{"slot":"hood","coins":0,"parts":0,"bucks":12,"power":4,"grip":0,"weight":0,"xp":40,"only":["tank"]},"bigtail":{"slot":"spoiler","coins":1500,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":22,"only":["dogvan"]},"bubbles":{"slot":"exhaust","coins":0,"parts":0,"bucks":5,"power":2,"grip":0,"weight":0,"xp":22,"only":["dogvan"]},"collar":{"slot":"kit","coins":2000,"parts":4,"bucks":0,"power":0,"grip":1,"weight":-1,"xp":22,"only":["dogvan"]},"bone":{"slot":"hood","coins":1200,"parts":0,"bucks":0,"power":1,"grip":0,"weight":0,"xp":22,"only":["dogvan"]},"radar":{"slot":"spoiler","coins":4500,"parts":10,"bucks":0,"power":0,"grip":3,"weight":0,"xp":37,"only":["tusker"]},"snorkel":{"slot":"exhaust","coins":3000,"parts":6,"bucks":0,"power":3,"grip":0,"weight":0,"xp":37,"only":["tusker"]},"plating":{"slot":"kit","coins":7000,"parts":15,"bucks":0,"power":0,"grip":4,"weight":1,"xp":37,"only":["tusker"]},"lightbar":{"slot":"hood","coins":3500,"parts":6,"bucks":0,"power":2,"grip":0,"weight":0,"xp":37,"only":["tusker"]},"tailfairing":{"slot":"spoiler","coins":1500,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":16,"only":["scooter","chopper","sportbike"]},"saddlebags":{"slot":"kit","coins":1800,"parts":0,"bucks":0,"power":0,"grip":1,"weight":-1,"xp":16,"only":["scooter","chopper","sportbike"]},"windscreen":{"slot":"hood","coins":1200,"parts":0,"bucks":0,"power":1,"grip":0,"weight":0,"xp":16,"only":["scooter","chopper","sportbike"]},"campod":{"slot":"hood","coins":2000,"parts":4,"bucks":0,"power":1,"grip":0,"weight":0,"xp":43,"only":["formula"]},"bargeboards":{"slot":"kit","coins":0,"parts":0,"bucks":10,"power":0,"grip":3,"weight":-3,"xp":43,"only":["formula"]},"raintires":{"slot":"tires","coins":2500,"parts":4,"bucks":0,"power":0,"grip":0,"weight":0,"xp":19},"sandtires":{"slot":"tires","coins":3000,"parts":5,"bucks":0,"power":0,"grip":0,"weight":0,"xp":22},"snowstuds":{"slot":"tires","coins":3500,"parts":6,"bucks":0,"power":0,"grip":0,"weight":0,"xp":22},"allweather":{"slot":"tires","coins":0,"parts":0,"bucks":12,"power":0,"grip":0,"weight":0,"xp":31},"forged":{"slot":"rims","coins":7000,"parts":12,"bucks":0,"power":0,"grip":2,"weight":-3,"xp":31}},"driverBonus":0.25,"campaign":{"c1":{"unlock":1,"races":["c1-0","c1-1","c1-2","c1-3","c1-4"],"coins":1000,"bucks":1,"trophies":3,"starBucks":1},"c2":{"unlock":4,"races":["c2-0","c2-1","c2-2","c2-3","c2-4"],"coins":2000,"bucks":1,"trophies":3,"starBucks":1},"c3":{"unlock":8,"races":["c3-0","c3-1","c3-2","c3-3","c3-4"],"coins":3500,"bucks":2,"trophies":4,"starBucks":1},"c4":{"unlock":13,"races":["c4-0","c4-1","c4-2","c4-3","c4-4"],"coins":5500,"bucks":2,"trophies":5,"starBucks":2},"c5":{"unlock":19,"races":["c5-0","c5-1","c5-2","c5-3","c5-4"],"coins":8000,"bucks":3,"trophies":6,"starBucks":2},"c6":{"unlock":26,"races":["c6-0","c6-1","c6-2","c6-3","c6-4"],"coins":12000,"bucks":3,"trophies":8,"starBucks":2},"c7":{"unlock":33,"races":["c7-0","c7-1","c7-2","c7-3","c7-4"],"coins":20000,"bucks":5,"trophies":10,"starBucks":3}},"sets":{"daily":{"cars":["pip","civic","trail","miata"],"coins":1500,"bucks":2,"trophies":5,"xp":60},"bikes":{"cars":["zippy","baron","shinden"],"coins":4000,"bucks":3,"trophies":10,"xp":120},"classics":{"cars":["bug","woodie","hauler","cruiser","buggy"],"coins":5000,"bucks":5,"trophies":15,"xp":150},"muscle":{"cars":["stallion","charger","hellcat","bandit"],"coins":8000,"bucks":5,"trophies":15,"xp":200},"track":{"cars":["rally","vette","gtr","lemans","gullwing"],"coins":15000,"bucks":8,"trophies":25,"xp":300},"roadtrip":{"cars":["camper","ridgeback","stomper","shaggy"],"coins":6000,"bucks":4,"trophies":12,"xp":160},"tuners":{"cars":["hotshot","kitsune","current"],"coins":7000,"bucks":4,"trophies":12,"xp":180},"grandtour":{"cars":["salon","speedster","monoposto"],"coins":20000,"bucks":10,"trophies":30,"xp":350},"heavy":{"cars":["schoolbus","tusker"],"coins":6000,"bucks":3,"trophies":10,"xp":150},"dream":{"cars":["lambo","hyper","tomahawk","zenith"],"coins":30000,"bucks":15,"trophies":40,"xp":500},"autobahn":{"cars":["kreis","bergmeister","ringmeister","sovereign"],"coins":20000,"bucks":10,"trophies":30,"xp":350},"apex":{"cars":["rattler","cottonmouth","raiden","wraith"],"coins":30000,"bucks":15,"trophies":40,"xp":500},"restomods":{"cars":["sprint","revenant","pontone"],"coins":30000,"bucks":15,"trophies":40,"xp":500},"exotica":{"cars":["fulmine","eclat","orafo"],"coins":40000,"bucks":20,"trophies":50,"xp":600},"seasons":{"cars":["nightfall"],"coins":5000,"bucks":3,"trophies":10,"xp":150}},"quests":{"daily":{"count":3,"task":{"coins":150,"coinsPerLevel":50,"xp":20,"xpPerLevel":5},"chest":{"coins":300,"coinsPerLevel":100,"xp":0,"xpPerLevel":0,"parts":5,"bucks":0,"fuel":10}},"weekly":{"count":3,"task":{"coins":500,"coinsPerLevel":150,"xp":100,"xpPerLevel":20},"chest":{"coins":1000,"coinsPerLevel":250,"xp":0,"xpPerLevel":0,"parts":20,"bucks":3,"fuel":0}}},"season":{"start":"2026-10-05","days":42,"perTier":8,"stars":{"dailyTask":1,"dailyChest":3,"weeklyTask":3,"weeklyChest":6},"tiers":[{"coins":650,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":5,"bucks":0,"car":false},{"coins":950,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":7,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":2,"car":false},{"coins":0,"parts":9,"bucks":0,"car":false},{"coins":1550,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":9,"bucks":0,"car":false},{"coins":1850,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":3,"car":false},{"coins":2150,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":13,"bucks":0,"car":false},{"coins":2450,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":13,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":4,"car":false},{"coins":0,"parts":15,"bucks":0,"car":false},{"coins":3050,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":17,"bucks":0,"car":false},{"coins":3350,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":5,"car":false},{"coins":3650,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":19,"bucks":0,"car":false},{"coins":3950,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":21,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":6,"car":false},{"coins":0,"parts":21,"bucks":0,"car":false},{"coins":4550,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":23,"bucks":0,"car":false},{"coins":4850,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":0,"car":true}],"carBucks":15,"cars":{"1":"nightfall"}},"deals":{"slots":[["parts10","fuel","parts25","parts50"],["mod-chrome","mod-twintips","mod-vented","mod-ducktail","mod-streetkit","paint-matte","mod-goldmesh","mod-ramscoop","mod-sidepipes","mod-gtwing","mod-widebody","mod-blower","mod-forged","paint-chrome"],["decor-fountain","decor-pond","decor-playground","decor-gazebo","decor-clocktower","decor-billboard","decor-hotdog","decor-statue"]],"step":[3,5,3],"save":{"parts10":200,"fuel":0,"parts25":500,"parts50":1000,"mod-chrome":240,"mod-twintips":400,"mod-vented":320,"mod-ducktail":480,"mod-streetkit":600,"paint-matte":0,"mod-goldmesh":750,"mod-ramscoop":900,"mod-sidepipes":1050,"mod-gtwing":1200,"mod-widebody":1800,"mod-blower":2400,"mod-forged":2100,"paint-chrome":0,"decor-fountain":320,"decor-pond":600,"decor-playground":720,"decor-gazebo":480,"decor-clocktower":1400,"decor-billboard":240,"decor-hotdog":140,"decor-statue":0}},"crew":{"chest":{"coins":1500,"coinsPerLevel":300,"xp":0,"xpPerLevel":0,"parts":25,"bucks":5,"fuel":0}},"rivals":{"vinnie":{"unlock":2,"coins":1500,"bucks":1,"trophies":3},"polly":{"unlock":5,"coins":2500,"bucks":1,"trophies":3},"duke":{"unlock":9,"coins":4000,"bucks":2,"trophies":4},"roxy":{"unlock":14,"coins":6500,"bucks":2,"trophies":5},"clutchula":{"unlock":20,"coins":10000,"bucks":3,"trophies":6},"nova":{"unlock":27,"coins":15000,"bucks":3,"trophies":8}}}$catalog$::jsonb
-- catalog:end
$$;

-- The resto-mods pieces build, from restoTables() in src/game/resto.ts (crates.test.ts checks it).
create or replace function econ_private.resto_tables() returns jsonb language sql immutable as $$
  select $resto${"pieces":4,"sources":{"rusty_track":{"odds":0.02,"dupe":2000}},"cars":{"sprint":{"unlock":10,"colors":["#1b4d3e","#efe7d2","#6d1b2b"]},"revenant":{"unlock":14,"colors":["#8d9094","#1c1c1c","#0d2a5c"]},"pontone":{"unlock":18,"colors":["#b71c1c","#cfd8dc","#1b5e20"]}}}$resto$::jsonb
$$;
revoke all on function econ_private.resto_tables() from public, anon, authenticated;

-- One resto-mod piece for `me`, written as crate_opens row p_seq: one of the four pieces of a
-- secret car the level has unlocked and the save hasn't built. Pieces are counted from this
-- ledger, not the save. A piece already won pays p_dupe coins; the last missing one builds the
-- car (a new uid and colour). Returns null when no car is in reach. crate_open() calls it for a
-- crate's piece slice; other rewards (Rusty's top zone) call it with their own p_crate source
-- (e.g. 'rescue') and no cost. The caller holds the player's crate lock and picks p_seq as the
-- next seq, and the game applies the row like a crate open (crate_json(), applyCrate()).
create or replace function econ_private.piece_grant(me uuid, st jsonb, lvl int, p_seq int, p_crate text, p_cost_c int, p_cost_b int, p_dupe int)
returns public.crate_opens language plpgsql security definer set search_path = public as $$
declare
  r jsonb := econ_private.resto_tables();
  pool jsonb;
  pick jsonb;
  pc int;
  held int;
  o public.crate_opens;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', e.key, 'colors', e.value -> 'colors') order by e.key), '[]')
    into pool from jsonb_each(r -> 'cars') e
    where (e.value ->> 'unlock')::int <= lvl
      and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(st -> 'cars') = 'array' then st -> 'cars' else '[]' end) x
                      where jsonb_typeof(x) = 'object' and x ->> 'model' = e.key);
  if jsonb_array_length(pool) = 0 then
    return null;
  end if;
  pick := pool -> floor(random()::numeric * jsonb_array_length(pool))::int;
  pc := floor(random()::numeric * (r ->> 'pieces')::int)::int;
  if exists (select 1 from public.crate_opens x where x.owner_id = me and x.kind = 'piece' and x.model = pick ->> 'id' and x.piece = pc) then
    insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, coins, model, piece)
      values (me, p_seq, p_crate, p_cost_c, p_cost_b, 'piecedupe', p_dupe, pick ->> 'id', pc)
      returning * into o;
    return o;
  end if;
  select count(distinct x.piece) into held from public.crate_opens x where x.owner_id = me and x.kind = 'piece' and x.model = pick ->> 'id';
  if held + 1 >= (r ->> 'pieces')::int then
    insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, model, piece, car_uid, color)
      values (me, p_seq, p_crate, p_cost_c, p_cost_b, 'piece', pick ->> 'id', pc,
        'k' || substr(md5(random()::text || clock_timestamp()::text || me::text), 1, 14),
        (pick -> 'colors') ->> floor(random()::numeric * jsonb_array_length(pick -> 'colors'))::int)
      returning * into o;
  else
    insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, model, piece)
      values (me, p_seq, p_crate, p_cost_c, p_cost_b, 'piece', pick ->> 'id', pc)
      returning * into o;
  end if;
  return o;
end $$;
revoke all on function econ_private.piece_grant(uuid, jsonb, int, int, text, int, int, int) from public, anon, authenticated;

-- A piece from a reward outside crates (Rusty's Rescue): rolls `source`'s chance from
-- resto_tables() 'sources' and, on a hit, grants a piece (piece_grant(), crate_opens kind 'piece'
-- with crate = source and no cost) as the player's next crate_opens seq. Returns the row as
-- crate_json() (the game hands it to applyCrate()), or null on a miss, an unknown source or no car
-- in reach. Callers are server functions such as rescue_roll(); players can't call it.
create or replace function econ_private.resto_piece_roll(me uuid, source text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  src jsonb := econ_private.resto_tables() -> 'sources' -> source;
  st jsonb;
  lvl int;
  last_seq int;
  o public.crate_opens;
begin
  if me is null or src is null or random() >= (src ->> 'odds')::numeric then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext('crate:' || me::text));
  select g.state, g.level into st, lvl from public.game_saves g where g.owner_id = me;
  if jsonb_typeof(st) is distinct from 'object' then
    return null;
  end if;
  select coalesce(max(x.seq), 0) into last_seq from public.crate_opens x where x.owner_id = me;
  o := econ_private.piece_grant(me, st, greatest(coalesce(lvl, 1), 1), last_seq + 1, source, 0, 0, (src ->> 'dupe')::int);
  if o.seq is null then
    return null;
  end if;
  return econ_private.crate_json(o);
end $$;
revoke all on function econ_private.resto_piece_roll(uuid, text) from public, anon, authenticated;

create or replace function public.crate_open(p_crate text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- crates:begin
  t jsonb := $crates${"crates":{"street":{"pay":"coins","unlock":2,"base":300,"perLevel":120,"odds":{"coins":56,"jackpot":6,"mod":28,"car":10,"skin":0,"piece":0},"carShare":0.12,"coinMult":[0.5,1],"jackpotMult":[2,3],"skins":[],"below":null},"garage":{"pay":"coins","unlock":6,"base":1500,"perLevel":500,"odds":{"coins":40.9,"jackpot":8,"mod":31,"car":16,"skin":4,"piece":0.1},"carShare":0.15,"coinMult":[0.45,0.85],"jackpotMult":[2,3],"skins":["rare","epic"],"below":"street"},"gold":{"pay":"bucks","unlock":3,"base":8,"perLevel":0,"odds":{"coins":33.9,"jackpot":6,"mod":30,"car":20,"skin":10,"piece":0.1},"carShare":0.15,"coinMult":[0.45,0.85],"jackpotMult":[2,3],"skins":["rare","epic","legendary"],"below":"garage"},"diamond":{"pay":"bucks","unlock":8,"base":25,"perLevel":0,"odds":{"coins":23.9,"jackpot":6,"mod":24,"car":32,"skin":14,"piece":0.1},"carShare":0.2,"coinMult":[0.4,0.8],"jackpotMult":[2,3],"skins":["epic","legendary"],"below":"gold"}},"skinWeight":{"rare":6,"epic":3,"legendary":1},"skinDupe":{"rare":0.6,"epic":1,"legendary":1.5},"skins":{"hexcore":{"tier":"rare","level":3},"riptide":{"tier":"rare","set":"daily"},"overclock":{"tier":"rare","level":10},"static":{"tier":"rare"},"contour":{"tier":"rare","set":"roadtrip"},"cascade":{"tier":"rare","level":15},"ghostcamo":{"tier":"rare","set":"heavy"},"deepspace":{"tier":"epic"},"faultline":{"tier":"epic","set":"muscle"},"aurora":{"tier":"epic"},"thunderhead":{"tier":"epic"},"biolume":{"tier":"epic"},"nightdrive":{"tier":"epic"},"petalstorm":{"tier":"epic"},"prismatic":{"tier":"legendary"},"horizon":{"tier":"legendary"},"coldsnap":{"tier":"legendary"},"quicksilver":{"tier":"legendary"},"wyrmscale":{"tier":"legendary"},"kaleido":{"tier":"legendary"}},"modSkins":{"ember":{"tier":"rare","level":5},"hexplate":{"tier":"rare","level":7},"neonpulse":{"tier":"rare","set":"tuners"},"tracer":{"tier":"rare","level":12},"checkered":{"tier":"rare","set":"track"},"goldleaf":{"tier":"epic"},"carbonprism":{"tier":"epic"},"starlight":{"tier":"epic"},"toxic":{"tier":"epic"},"stormcell":{"tier":"epic"},"biobloom":{"tier":"epic"},"holofoil":{"tier":"legendary"},"rime":{"tier":"legendary"},"mercury":{"tier":"legendary"},"dragonhide":{"tier":"legendary"}},"gem":{"base":300,"perLevel":100},"pieceDupe":1,"pieces":4,"cars":{"pip":{"body":"compact","crate":"street","unlock":1,"price":800,"bucks":0,"colors":["#c62828","#1b5e20","#fafafa"]},"civic":{"body":"sedan","crate":"street","unlock":1,"price":1500,"bucks":0,"colors":["#1e88e5","#eeeeee","#424242"]},"trail":{"body":"truck","crate":"street","unlock":3,"price":3500,"bucks":0,"colors":["#0d47a1","#c62828","#eceff1"]},"miata":{"body":"roadster","crate":"street","unlock":5,"price":7000,"bucks":0,"colors":["#d32f2f","#1e88e5","#fafafa"]},"stallion":{"body":"muscle","crate":"garage","unlock":7,"price":14000,"bucks":0,"colors":["#1b5e20","#ff6f00","#212121"]},"rally":{"body":"rally","crate":"garage","unlock":10,"price":26000,"bucks":0,"colors":["#0d47a1","#fafafa","#ffd600"]},"vette":{"body":"sports","crate":"gold","unlock":15,"price":55000,"bucks":0,"colors":["#b71c1c","#bdbdbd","#ffd600"]},"charger":{"body":"muscle","crate":"gold","unlock":13,"price":42000,"bucks":0,"colors":["#212121","#ff5722","#6a1b9a"]},"hellcat":{"body":"widebody","crate":"gold","unlock":18,"price":80000,"bucks":0,"colors":["#c62828","#7b1fa2","#9ccc65"]},"gtr":{"body":"coupe","crate":"gold","unlock":22,"price":115000,"bucks":0,"colors":["#eceff1","#263238","#ff6d00"]},"tomahawk":{"body":"tank","crate":"diamond","unlock":36,"price":420000,"bucks":0,"colors":["#556b2f","#37474f","#c9a227"]},"zippy":{"body":"scooter","crate":"street","unlock":2,"price":2100,"bucks":0,"colors":["#4dd0e1","#fdd835","#f48fb1"]},"baron":{"body":"chopper","crate":"garage","unlock":7,"price":16000,"bucks":0,"colors":["#212121","#b71c1c","#1565c0"]},"shinden":{"body":"sportbike","crate":"diamond","unlock":24,"price":135000,"bucks":0,"colors":["#1565c0","#eceff1","#76ff03"]},"camper":{"body":"van","crate":"street","unlock":2,"price":2800,"bucks":0,"colors":["#ff8a65","#4db6ac","#fff59d"]},"hotshot":{"body":"hatch","crate":"street","unlock":5,"price":7000,"bucks":0,"colors":["#eceff1","#d32f2f","#1e88e5"]},"ridgeback":{"body":"suv","crate":"street","unlock":6,"price":10000,"bucks":0,"colors":["#ff6f00","#33691e","#eceff1"]},"kitsune":{"body":"coupe","crate":"garage","unlock":9,"price":20000,"bucks":0,"colors":["#fafafa","#212121","#ff4081"]},"current":{"body":"ev","crate":"gold","unlock":16,"price":62000,"bucks":0,"colors":["#eceff1","#b71c1c","#263238"]},"salon":{"body":"luxury","crate":"gold","unlock":11,"price":0,"bucks":45,"colors":["#1a1a2e","#eceff1","#6d1b1b"]},"stomper":{"body":"truck","crate":"garage","unlock":12,"price":36000,"bucks":0,"colors":["#424242","#1565c0","#ff6d00"]},"monoposto":{"body":"formula","crate":"diamond","unlock":30,"price":220000,"bucks":0,"colors":["#d50000","#eceff1","#00897b"]},"zenith":{"body":"super","crate":"diamond","unlock":40,"price":550000,"bucks":0,"colors":["#212121","#1e88e5","#ff6d00"]},"schoolbus":{"body":"bus","crate":"street","unlock":4,"price":6500,"bucks":0,"colors":["#fbc02d","#ff8f00","#eceff1"]},"shaggy":{"body":"dogvan","crate":"street","unlock":5,"price":8000,"bucks":0,"colors":["#d7ccc8","#a1887f","#9e9e9e"]},"tusker":{"body":"tusker","crate":"gold","unlock":20,"price":95000,"bucks":0,"colors":["#6b7a3a","#c2a36b","#eceff1"]},"lambo":{"body":"wedge","crate":"diamond","unlock":26,"price":0,"bucks":90,"colors":["#fdd835","#d50000","#fafafa"]},"hyper":{"body":"super","crate":"diamond","unlock":33,"price":300000,"bucks":0,"colors":["#1a237e","#212121","#d50000"]},"kreis":{"body":"sedan","crate":"gold","unlock":14,"price":48000,"bucks":0,"colors":["#eceff1","#0d47a1","#212121"]},"bergmeister":{"body":"rearengine","crate":"gold","unlock":17,"price":70000,"bucks":0,"colors":["#fafafa","#2e7d32","#ff6f00"]},"rattler":{"body":"muscle","crate":"gold","unlock":21,"price":105000,"bucks":0,"colors":["#1565c0","#fafafa","#b71c1c"]},"cottonmouth":{"body":"longnose","crate":"diamond","unlock":25,"price":150000,"bucks":0,"colors":["#0d47a1","#b71c1c","#fdd835"]},"ringmeister":{"body":"super","crate":"diamond","unlock":28,"price":190000,"bucks":0,"colors":["#9e9e9e","#d32f2f","#212121"]},"raiden":{"body":"prototype","crate":"diamond","unlock":32,"price":260000,"bucks":0,"colors":["#00897b","#ff6d00","#eceff1"]},"sovereign":{"body":"super","crate":"diamond","unlock":34,"price":0,"bucks":140,"colors":["#1a237e","#90a4ae","#b71c1c"]},"wraith":{"body":"wedge","crate":"diamond","unlock":38,"price":480000,"bucks":0,"colors":["#eceff1","#ff6f00","#212121"]},"fulmine":{"body":"scissor","crate":"diamond","unlock":40,"price":0,"bucks":220,"colors":["#c6ff00","#ff6d00","#eceff1"]},"eclat":{"body":"horseshoe","crate":"diamond","unlock":42,"price":650000,"bucks":0,"colors":["#0d47a1","#212121","#b0bec5"]},"orafo":{"body":"teardrop","crate":"diamond","unlock":39,"price":0,"bucks":180,"colors":["#eceff1","#bf360c","#37474f"]},"sprint":{"body":"stepnose","crate":null,"unlock":10,"price":70000,"bucks":0,"colors":["#1b4d3e","#efe7d2","#6d1b2b"],"secret":true},"revenant":{"body":"restomuscle","crate":null,"unlock":14,"price":110000,"bucks":0,"colors":["#8d9094","#1c1c1c","#0d2a5c"],"secret":true},"pontone":{"body":"pontoon","crate":null,"unlock":18,"price":170000,"bucks":0,"colors":["#b71c1c","#cfd8dc","#1b5e20"],"secret":true},"bug":{"body":"bubble","crate":"street","unlock":1,"price":1200,"bucks":0,"colors":["#80cbc4","#ffcc80","#ef9a9a"]},"woodie":{"body":"wagon","crate":"street","unlock":1,"price":2200,"bucks":0,"colors":["#fafafa","#fff59d","#4db6ac"]},"hauler":{"body":"truck","crate":"street","unlock":1,"price":3000,"bucks":0,"colors":["#558b2f","#e65100","#1565c0"]},"cruiser":{"body":"classic","crate":"street","unlock":1,"price":5000,"bucks":0,"colors":["#4dd0e1","#f06292","#fafafa"]},"buggy":{"body":"offroad","crate":"street","unlock":1,"price":6000,"bucks":0,"colors":["#ff9800","#cddc39","#29b6f6"]},"bandit":{"body":"muscle","crate":"street","unlock":1,"price":8000,"bucks":0,"colors":["#212121","#ffd54f","#b71c1c"]},"lemans":{"body":"super","crate":"garage","unlock":1,"price":16000,"bucks":0,"colors":["#1565c0","#fafafa","#c62828"]},"gullwing":{"body":"coupe","crate":"garage","unlock":1,"price":30000,"bucks":0,"colors":["#cfd8dc","#b71c1c","#263238"]},"speedster":{"body":"roadster","crate":"garage","unlock":1,"price":12000,"bucks":0,"colors":["#1565c0","#eceff1","#b71c1c"]},"nightfall":{"body":"wedge","crate":null,"unlock":1,"price":24000,"bucks":0,"colors":["#311b92","#00e5ff","#212121"]}},"mods":{"ducktail":{"crate":"street","unlock":2,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"gtwing":{"crate":"garage","unlock":5,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"attackwing":{"crate":"diamond","unlock":12,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"twintips":{"crate":"street","unlock":2},"sidepipes":{"crate":"garage","unlock":4},"flamepipes":{"crate":"gold","unlock":12},"streetkit":{"crate":"street","unlock":3,"notOn":["scooter","chopper","sportbike"]},"widebody":{"crate":"garage","unlock":6,"notOn":["scooter","chopper","sportbike"]},"carbonkit":{"crate":"diamond","unlock":16,"notOn":["scooter","chopper","sportbike"]},"vented":{"crate":"street","unlock":2,"notOn":["scooter","chopper","sportbike","formula"]},"ramscoop":{"crate":"garage","unlock":4,"notOn":["scooter","chopper","sportbike","formula"]},"blower":{"crate":"garage","unlock":7,"notOn":["scooter","chopper","sportbike","formula"]},"chrome":{"crate":"street","unlock":1},"goldmesh":{"crate":"garage","unlock":4},"luggage":{"crate":"street","unlock":3,"only":["bus"]},"stacks":{"crate":"garage","unlock":3,"only":["bus"]},"cowcatcher":{"crate":"garage","unlock":4,"only":["bus"]},"disco":{"crate":"gold","unlock":5,"only":["bus"]},"flag":{"crate":"garage","unlock":10,"only":["tank"]},"smoke":{"crate":"gold","unlock":10,"only":["tank"]},"reactive":{"crate":"garage","unlock":10,"only":["tank"]},"watercannon":{"crate":"diamond","unlock":10,"only":["tank"]},"bigtail":{"crate":"street","unlock":4,"only":["dogvan"]},"bubbles":{"crate":"gold","unlock":4,"only":["dogvan"]},"collar":{"crate":"street","unlock":4,"only":["dogvan"]},"bone":{"crate":"street","unlock":4,"only":["dogvan"]},"radar":{"crate":"garage","unlock":9,"only":["tusker"]},"snorkel":{"crate":"garage","unlock":9,"only":["tusker"]},"plating":{"crate":"garage","unlock":9,"only":["tusker"]},"lightbar":{"crate":"garage","unlock":9,"only":["tusker"]},"tailfairing":{"crate":"street","unlock":2,"only":["scooter","chopper","sportbike"]},"saddlebags":{"crate":"street","unlock":2,"only":["scooter","chopper","sportbike"]},"windscreen":{"crate":"street","unlock":2,"only":["scooter","chopper","sportbike"]},"campod":{"crate":"street","unlock":11,"only":["formula"]},"bargeboards":{"crate":"gold","unlock":11,"only":["formula"]},"raintires":{"crate":"garage","unlock":3},"sandtires":{"crate":"garage","unlock":4},"snowstuds":{"crate":"garage","unlock":4},"allweather":{"crate":"gold","unlock":7},"forged":{"crate":"garage","unlock":7}}}$crates$::jsonb;
  -- crates:end
  c jsonb := t -> 'crates' -> p_crate;
  st jsonb;
  lvl int;
  saved int;
  last_seq int;
  pend jsonb;
  price int;
  gemc numeric;
  v numeric;
  cost_c int := 0;
  cost_b int := 0;
  kind text;
  r numeric;
  total numeric;
  k record;
  car jsonb;
  cdef jsonb;
  have jsonb;
  mods jsonb;
  choices jsonb := '[]';
  pick jsonb;
  m record;
  pool jsonb := '[]';
  cv numeric;
  lo numeric;
  hi numeric;
  o public.crate_opens;
  cars_pool jsonb;
  cc text;
  odds jsonb;
  avg float8;
  car_w numeric;
  owned boolean;
begin
  if me is null then
    raise exception 'sign in to open crates' using errcode = 'insufficient_privilege';
  end if;
  if c is null then
    raise exception 'no such crate' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('crate:' || me::text));
  select g.state, g.level into st, lvl from public.game_saves g where g.owner_id = me;
  if jsonb_typeof(st) is distinct from 'object' then
    raise exception 'no saved town yet' using errcode = 'P0001';
  end if;
  lvl := greatest(coalesce(lvl, 1), 1);
  select coalesce(max(x.seq), 0) into last_seq from public.crate_opens x where x.owner_id = me;
  saved := floor(public.econ_num(st, 'crates'))::int;
  -- Opens the save hasn't counted yet go back to the game first.
  if saved < last_seq then
    select coalesce(jsonb_agg(econ_private.crate_json(x) order by x.seq), '[]') into pend
      from public.crate_opens x where x.owner_id = me and x.seq > saved;
    return jsonb_build_object('pending', pend);
  end if;
  if exists (select 1 from public.crate_opens x where x.owner_id = me and x.created_at > now() - interval '1.5 seconds') then
    raise exception 'one crate at a time' using errcode = 'P0001';
  end if;
  if lvl < (c ->> 'unlock')::int then
    raise exception 'crate not open yet' using errcode = 'insufficient_privilege';
  end if;
  price := (c ->> 'base')::int + (c ->> 'perLevel')::int * lvl;
  gemc := (t -> 'gem' ->> 'base')::numeric + (t -> 'gem' ->> 'perLevel')::numeric * lvl;
  if c ->> 'pay' = 'coins' then
    cost_c := price;
    v := price;
    if public.econ_num(st, 'coins') < price then
      raise exception 'not enough coins' using errcode = 'P0001';
    end if;
  else
    cost_b := price;
    v := price * gemc;
    if public.econ_num(st, 'bucks') < price then
      raise exception 'not enough gems' using errcode = 'P0001';
    end if;
  end if;

  -- The cars it can give: its own cars (by home crate) the level has unlocked, or the crate
  -- below's when none of its own are in reach yet.
  cc := p_crate;
  loop
    select coalesce(jsonb_agg(jsonb_build_object('id', e.key, 'v', (e.value ->> 'price')::numeric + (e.value ->> 'bucks')::numeric * gemc, 'colors', e.value -> 'colors') order by e.key), '[]')
      into pool from jsonb_each(t -> 'cars') e
      where e.value ->> 'crate' = cc and (e.value ->> 'unlock')::int <= lvl;
    exit when jsonb_array_length(pool) > 0 or jsonb_typeof(t -> 'crates' -> cc -> 'below') is distinct from 'string';
    cc := t -> 'crates' -> cc ->> 'below';
  end loop;
  cars_pool := pool;

  -- The odds (crateOdds()): the car slice shrinks until its average car (weighed 1 / value) is
  -- worth no more than carShare of the crate, and what it loses goes to coins.
  odds := c -> 'odds';
  if jsonb_array_length(pool) > 0 then
    select count(*)::float8 / sum(1 / (x ->> 'v')::float8) into avg from jsonb_array_elements(pool) x;
    car_w := least((odds ->> 'car')::numeric, floor(1000 * (c ->> 'carShare')::float8 * v::float8 / avg)::numeric / 10);
    odds := odds || jsonb_build_object('coins', (odds ->> 'coins')::numeric + (odds ->> 'car')::numeric - car_w, 'car', car_w);
  end if;

  -- What kind of prize.
  select sum(value::numeric) into total from jsonb_each_text(odds);
  r := random()::numeric * total;
  for k in select key, value::numeric as w from jsonb_each_text(odds) order by array_position(array['coins', 'jackpot', 'mod', 'car', 'skin', 'piece'], key) loop
    kind := k.key;
    r := r - k.w;
    exit when r <= 0;
  end loop;

  -- A part: for one of the player's cars, one of the crate's own parts (by home crate), unlocked
  -- and not already owned; the crate below's when none of its own fit any car.
  if kind = 'mod' then
    cc := p_crate;
    loop
    for car in select x from jsonb_array_elements(case when jsonb_typeof(st -> 'cars') = 'array' then st -> 'cars' else '[]' end) x
               where jsonb_typeof(x) = 'object' and coalesce(x ->> 'uid', '') <> '' loop
      cdef := t -> 'cars' -> (car ->> 'model');
      continue when cdef is null;
      have := (case when jsonb_typeof(car -> 'ownedMods') = 'array' then car -> 'ownedMods' else '[]' end)
           || (case when jsonb_typeof(car -> 'mods') = 'array' then car -> 'mods' else '[]' end);
      select coalesce(jsonb_agg(e.key order by e.key), '[]') into mods from jsonb_each(t -> 'mods') e
        where e.value ->> 'crate' = cc
          and (e.value ->> 'unlock')::int <= lvl
          and case when e.value ? 'only' then (e.value -> 'only') ? (cdef ->> 'body') else not coalesce((e.value -> 'notOn') ? (cdef ->> 'body'), false) end
          and not have ? e.key;
      if jsonb_array_length(mods) > 0 then
        choices := choices || jsonb_build_array(jsonb_build_object('car', car ->> 'uid', 'mods', mods));
      end if;
    end loop;
    exit when jsonb_array_length(choices) > 0 or jsonb_typeof(t -> 'crates' -> cc -> 'below') is distinct from 'string';
    cc := t -> 'crates' -> cc ->> 'below';
    end loop;
    if jsonb_array_length(choices) > 0 then
      pick := choices -> floor(random()::numeric * jsonb_array_length(choices))::int;
      insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, car_uid, mod)
        values (me, last_seq + 1, p_crate, cost_c, cost_b, 'mod', pick ->> 'car', (pick -> 'mods') ->> floor(random()::numeric * jsonb_array_length(pick -> 'mods'))::int)
        returning * into o;
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- A resto-mod piece (econ_private.piece_grant()); coins when no car is in reach.
  if kind = 'piece' then
    o := econ_private.piece_grant(me, st, lvl, last_seq + 1, p_crate, cost_c, cost_b, econ_private.crate_round(v * (t ->> 'pieceDupe')::numeric));
    if o.seq is not null then
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- A skin: a body or part skin of the crate's tiers (rarer tiers less likely). One the player
  -- already has (bought, won, or unlocked by level or collection set) pays coins instead.
  if kind = 'skin' then
    select coalesce(jsonb_agg(jsonb_build_object('id', e.key, 'part', e.part, 'tier', e.value ->> 'tier', 'level', e.value -> 'level', 'set', e.value -> 'set') order by e.part, e.key), '[]')
      into pool from (select false as part, x.key, x.value from jsonb_each(t -> 'skins') x
                      union all select true, y.key, y.value from jsonb_each(t -> 'modSkins') y) e
      where (c -> 'skins') ? (e.value ->> 'tier');
    if jsonb_array_length(pool) > 0 then
      select sum((t -> 'skinWeight' ->> (x ->> 'tier'))::numeric) into total from jsonb_array_elements(pool) x;
      r := random()::numeric * total;
      for pick in select x from jsonb_array_elements(pool) x loop
        r := r - (t -> 'skinWeight' ->> (pick ->> 'tier'))::numeric;
        exit when r <= 0;
      end loop;
      have := case when (pick ->> 'part')::boolean then st -> 'modSkins' else st -> 'skins' end;
      owned := (jsonb_typeof(have) = 'array' and have ? (pick ->> 'id'))
        or (jsonb_typeof(pick -> 'level') = 'number' and lvl >= (pick ->> 'level')::int)
        or (jsonb_typeof(pick -> 'set') = 'string' and jsonb_typeof(st -> 'claimedSets') = 'array' and (st -> 'claimedSets') ? (pick ->> 'set'));
      insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, coins, skin, part)
        values (me, last_seq + 1, p_crate, cost_c, cost_b, case when owned then 'skindupe' else 'skin' end,
          case when owned then econ_private.crate_round(v * (t -> 'skinDupe' ->> (pick ->> 'tier'))::numeric) else 0 end,
          pick ->> 'id', (pick ->> 'part')::boolean)
        returning * into o;
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- A car: from the pool above; cheaper is likelier (weight 1 / value).
  if kind = 'car' then
    pool := cars_pool;
    if jsonb_array_length(pool) > 0 then
      select sum(1 / (x ->> 'v')::numeric) into total from jsonb_array_elements(pool) x;
      r := random()::numeric * total;
      for pick in select x from jsonb_array_elements(pool) x loop
        r := r - 1 / (pick ->> 'v')::numeric;
        exit when r <= 0;
      end loop;
      cv := (pick ->> 'v')::numeric;
      if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(st -> 'cars') = 'array' then st -> 'cars' else '[]' end) x
                 where jsonb_typeof(x) = 'object' and x ->> 'model' = pick ->> 'id') then
        insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, coins, model)
          values (me, last_seq + 1, p_crate, cost_c, cost_b, 'dupe', econ_private.crate_round(least(v * 1.5, greatest(v * 0.5, cv * 0.4))), pick ->> 'id')
          returning * into o;
      else
        insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, model, car_uid, color)
          values (me, last_seq + 1, p_crate, cost_c, cost_b, 'car', pick ->> 'id',
            'k' || substr(md5(random()::text || clock_timestamp()::text || me::text), 1, 14),
            (pick -> 'colors') ->> floor(random()::numeric * jsonb_array_length(pick -> 'colors'))::int)
          returning * into o;
      end if;
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- Coins: a share of what the crate is worth (a jackpot pays two to three times it or more).
  lo := ((c -> case when kind = 'jackpot' then 'jackpotMult' else 'coinMult' end) ->> 0)::numeric;
  hi := ((c -> case when kind = 'jackpot' then 'jackpotMult' else 'coinMult' end) ->> 1)::numeric;
  insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, kind, coins)
    values (me, last_seq + 1, p_crate, cost_c, cost_b, kind, econ_private.crate_round(v * (lo + (hi - lo) * random()::numeric)))
    returning * into o;
  return econ_private.crate_json(o);
end $$;

revoke execute on function public.crate_open(text), econ_private.crate_pay(int, int) from public, anon;
grant execute on function public.crate_open(text), econ_private.crate_pay(int, int) to authenticated;
