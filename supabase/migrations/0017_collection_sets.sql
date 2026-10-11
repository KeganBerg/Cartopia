-- Collection book (src/game/data.ts, CAR_SETS): every car belongs to one set.
--   * Saves carry `claimedSets`, the ids of sets whose reward was claimed. Claimed sets stay claimed.
--   * Claiming a set pays its listed coins, bucks, trophies and XP once, only when every car in it
--     is owned. Claims for incomplete or unknown sets are dropped.
--   * econ_catalog() gains the set list (everything else unchanged from 0014: club, campaign,
--     new cars). Built by src/game/econCatalog.ts; economy.test.ts keeps it in step.
create or replace function public.econ_catalog() returns jsonb
language sql immutable set search_path = '' as $$
-- catalog:begin
select $catalog${"cars":{"pip":{"name":"Kipper Pocket","body":"compact","price":800,"bucks":0,"power":18,"grip":36,"weight":24},"civic":{"name":"Kazumi Commuter","body":"sedan","price":1500,"bucks":0,"power":24,"grip":34,"weight":36},"trail":{"name":"Ironside Workhorse","body":"truck","price":2600,"bucks":0,"power":38,"grip":26,"weight":74},"miata":{"name":"Kazumi Zephyr","body":"roadster","price":4200,"bucks":0,"power":32,"grip":54,"weight":22},"stallion":{"name":"Liberty Bore Horse '68","body":"muscle","price":7000,"bucks":0,"power":52,"grip":34,"weight":54},"rally":{"name":"Kodiak Gravel Rex","body":"rally","price":9500,"bucks":0,"power":52,"grip":64,"weight":40},"vette":{"name":"Liberty Sidewinder","body":"sports","price":14000,"bucks":0,"power":66,"grip":54,"weight":38},"charger":{"name":"Liberty Brawler","body":"muscle","price":18000,"bucks":0,"power":70,"grip":40,"weight":60},"hellcat":{"name":"Liberty Hellhound 707","body":"widebody","price":22000,"bucks":0,"power":80,"grip":46,"weight":62},"gtr":{"name":"Kazumi Ronin GT","body":"coupe","price":26000,"bucks":0,"power":78,"grip":70,"weight":46},"tomahawk":{"name":"Ironside Tomahawk","body":"tank","price":90000,"bucks":0,"power":100,"grip":94,"weight":60},"zippy":{"name":"Kipper Zip 50","body":"scooter","price":1800,"bucks":0,"power":14,"grip":30,"weight":8},"baron":{"name":"Liberty Road Baron","body":"chopper","price":8500,"bucks":0,"power":46,"grip":36,"weight":30},"shinden":{"name":"Kazumi Shinden RR","body":"sportbike","price":30000,"bucks":0,"power":80,"grip":60,"weight":14},"lambo":{"name":"Veloce Corrida V12","body":"wedge","price":0,"bucks":40,"power":86,"grip":70,"weight":34},"hyper":{"name":"Veloce Hyperion","body":"super","price":60000,"bucks":0,"power":98,"grip":86,"weight":32},"bug":{"name":"Bumble Bubble","body":"bubble","price":1200,"bucks":0,"power":14,"grip":28,"weight":28},"woodie":{"name":"Lakeside Woodie Wagon","body":"wagon","price":2200,"bucks":0,"power":22,"grip":28,"weight":56},"hauler":{"name":"Old Faithful Hauler","body":"truck","price":3000,"bucks":0,"power":26,"grip":26,"weight":70},"cruiser":{"name":"Sunset Cruiser '57","body":"classic","price":5000,"bucks":0,"power":38,"grip":34,"weight":58},"buggy":{"name":"Dune Skipper Buggy","body":"offroad","price":6000,"bucks":0,"power":34,"grip":56,"weight":18},"bandit":{"name":"Night Bandit","body":"muscle","price":8000,"bucks":0,"power":56,"grip":38,"weight":54},"lemans":{"name":"Liberty Endurance GT","body":"super","price":16000,"bucks":0,"power":72,"grip":62,"weight":32},"gullwing":{"name":"Silver Wing 300","body":"coupe","price":30000,"bucks":0,"power":64,"grip":58,"weight":36}},"buildings":{"showroom":{"price":0,"obstacle":false,"fuelCap":0},"garage":{"price":0,"obstacle":false,"fuelCap":0},"rescue":{"price":1000,"obstacle":false,"fuelCap":0},"crew":{"price":2500,"obstacle":false,"fuelCap":0},"gas":{"price":1500,"obstacle":false,"fuelCap":10,"up":{"spend":[0,900,2150,3900,6550,10300,15550,22850,32950,46950],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[10,12,14,16,18,20,22,24,26,28]}},"pizza":{"price":400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,250,600,1050,1900,3100,4800,7100,10250,14500],"coins":[120,138,187.2,208.8,288,315,342,492,528,564],"xp":[10,12,14.4,16.8,21,24,24,36,36,40],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"donut":{"price":900,"obstacle":false,"fuelCap":0,"up":{"spend":[0,550,1300,2350,4050,6400,9700,14250,20550,29200],"coins":[106.67,129.88,166.4,198.86,236.31,280,331.64,393.6,469.33,564],"xp":[8,9.18,11.2,13.71,15.69,18,20.73,24,29.33,34.5],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"burger":{"price":1200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,700,1700,3100,5300,8350,12600,18500,26700,38050],"coins":[105,131.45,163.8,192.63,237.18,276,319.2,396.92,462,537.82],"xp":[7.5,9.27,10.8,12.63,14.82,17.25,19.2,24,27,31.64],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"icecream":{"price":1500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,900,2150,3900,6550,10300,15550,22850,32950,46950],"coins":[104,128.14,162.24,196.7,237.71,273,329.33,376.24,457.6,523.71],"xp":[7.2,8.57,10.56,12,14.29,16.2,19.33,21.88,25.6,29.14],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"carwash":{"price":1800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1100,2600,4700,7850,12300,18500,27150,39150,55800],"coins":[126.67,158.91,197.6,236.14,280.62,332.5,393.82,467.4,557.33,630.35],"xp":[8.33,10.18,12,14.14,16.15,19,21.82,25.8,30,33.88],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"diner":{"price":3200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1900,4600,8350,13800,21500,32250,47200,68050,97100],"coins":[140,175.64,214.12,259.15,312.56,367.5,443.33,521.82,596.13,705],"xp":[8,9.6,11.29,13.28,15.63,18,21.33,24.73,27.87,32.57],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tires":{"price":2000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1200,2900,5250,8750,13650,20500,30050,43300,61700],"coins":[100,126.82,155.12,192.97,232.94,271.88,306.21,357.78,417.6,487.83],"xp":[5,6,7.02,8.43,9.88,11.25,13.24,15.11,17.28,19.83],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bowling":{"price":4200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,2500,6050,11000,18100,28100,42050,61500,88650,126550],"coins":[135.71,170.34,208.73,254.4,304,362.84,424.71,497.11,583.26,669.6],"xp":[7.86,9.51,11.15,13.29,15.4,18.11,20.71,24,27.63,31.5],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"motel":{"price":5500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3300,7900,14350,23600,36600,54750,80100,115500,164900],"coins":[116.67,146.36,179.02,217.5,260.97,309.47,366.9,430.5,499.46,580.59],"xp":[5.83,7,8.26,9.75,11.42,13.26,15.45,17.85,20.43,23.47],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tuner":{"price":8000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,4800,11500,20900,34250,53000,79200,115850,167050,238600],"coins":[165,208.36,255.29,307.1,368.37,440.51,519.45,603.58,702.58,818.95],"xp":[7,8.4,9.88,11.74,13.67,15.95,18.41,21.31,24.39,28],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"stadium":{"price":20000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,12000,28800,52300,85450,131850,196800,287650,414750,592550],"coins":[200,250.15,306.89,372.86,446.51,531.65,627.52,734.33,856.22,995.29],"xp":[10,11.96,14.16,16.71,19.53,22.78,26.42,30.45,35.03,40.24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"cinema":{"price":6000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3600,8650,15700,25800,39950,59700,87300,125850,179700],"coins":[150,188.18,229.41,280.65,334.88,398.73,468.49,550.75,638.71,742.11],"xp":[8,9.6,11.29,13.42,15.63,18.23,21.04,24.36,27.87,32],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"coffee":{"price":700,"obstacle":false,"fuelCap":0,"up":{"spend":[0,400,1000,1800,3150,5050,7700,11350,16400,23300],"coins":[110,137.45,171.6,213.33,234.67,289.5,358.29,385.71,484,516],"xp":[8,9.82,12,13.33,14.67,18,22.29,24,28,30],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tacos":{"price":1300,"obstacle":false,"fuelCap":0,"up":{"spend":[0,800,1900,3450,5800,9100,13700,20050,28850,41050],"coins":[115,144.55,179.4,210.95,259.76,302.25,349.6,434.77,506,589.09],"xp":[8,9.82,11.4,13.26,15.53,18,20.8,24.92,29,32.73],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"lube":{"price":2600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1550,3750,6800,11300,17600,26400,38650,55700,79400],"coins":[104,128.29,154.35,197.62,234.98,273,326,380.36,450.58,528],"xp":[5,6.11,7.06,8.43,9.77,11.4,13.33,15.64,17.42,20.57],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"arcade":{"price":3600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,2150,5150,9400,15550,24150,36150,52900,76250,108850],"coins":[133.33,167.27,204.59,248.57,295.38,357.45,414.55,492,570.81,663.53],"xp":[7.5,9.09,10.62,12.64,14.54,17.36,19.64,23.1,26.27,30.35],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bodyshop":{"price":6500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3900,9350,17000,27900,43200,64600,94450,136150,194400],"coins":[135,169.31,206.47,252.65,301.4,358.94,421.64,495.58,574.84,667.79],"xp":[7.5,9.05,10.59,12.65,14.65,17.16,19.73,22.93,26.13,30.11],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"market":{"price":9500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,5700,13700,24850,40700,62900,93950,137350,198050,282850],"coins":[160,199.52,246.32,298.29,357.21,423.53,502.02,590.4,688.7,796.24],"xp":[7.33,8.75,10.42,12.26,14.33,16.64,19.38,22.44,25.83,29.51],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"firehouse":{"price":12000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,7200,17300,31400,51350,79300,118400,173100,249600,356550],"coins":[170,212.31,261.28,316.36,379.53,451.9,530.96,624.18,729.76,848.5],"xp":[7.5,8.96,10.64,12.51,14.65,17.09,19.73,22.84,26.34,30.27],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"police":{"price":16000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,9600,23050,41850,68400,105600,157650,230450,332250,474650],"coins":[180,225,276.38,334.62,401.86,477.27,563.74,662.87,771.43,893.66],"xp":[8,9.57,11.34,13.33,15.63,18.18,21.1,24.43,28.05,32.11],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"parkade":{"price":30000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,18000,43200,78500,128100,197550,294750,430800,621150,887500],"coins":[220,274.75,338.13,409.41,491.16,584.81,689.48,807.76,944.39,1093.22],"xp":[9.5,11.35,13.48,15.85,18.56,21.65,25.07,28.93,33.37,38.17],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"club":{"price":5000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3000,7200,13100,21550,33350,49900,73000,105200,150150],"coins":[200,250.91,305.88,370.21,446.51,525,633.33,745.45,851.61,1007.14],"xp":[12,14.4,16.94,19.91,23.44,27,32,37.09,41.81,48.86],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"parts":{"price":5000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3000,7200,13100,21550,33350,49900,73000,105200,150150],"coins":[118.75,147.27,186.67,222.4,264.35,314.29,378.62,435.56,511.84,592],"xp":[5.63,6.82,8,9.44,10.96,12.95,14.9,17.11,19.84,22.93],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bush":{"price":150,"obstacle":true,"fuelCap":0},"rock":{"price":400,"obstacle":true,"fuelCap":0},"cactus":{"price":1500,"obstacle":true,"fuelCap":0},"house":{"price":250,"obstacle":false,"fuelCap":0},"tree":{"price":50,"obstacle":false,"fuelCap":0},"palm":{"price":120,"obstacle":false,"fuelCap":0},"fountain":{"price":800,"obstacle":false,"fuelCap":0},"flowers":{"price":80,"obstacle":false,"fuelCap":0},"lamp":{"price":60,"obstacle":false,"fuelCap":0},"bench":{"price":70,"obstacle":false,"fuelCap":0},"billboard":{"price":600,"obstacle":false,"fuelCap":0},"statue":{"price":0,"obstacle":false,"fuelCap":0},"pond":{"price":1500,"obstacle":false,"fuelCap":0},"pine":{"price":60,"obstacle":false,"fuelCap":0},"hedge":{"price":40,"obstacle":false,"fuelCap":0},"fence":{"price":30,"obstacle":false,"fuelCap":0},"picnic":{"price":90,"obstacle":false,"fuelCap":0},"busstop":{"price":200,"obstacle":false,"fuelCap":0},"hotdog":{"price":350,"obstacle":false,"fuelCap":0},"flagpole":{"price":300,"obstacle":false,"fuelCap":0},"arch":{"price":0,"obstacle":false,"fuelCap":0},"playground":{"price":1800,"obstacle":false,"fuelCap":0},"gazebo":{"price":1200,"obstacle":false,"fuelCap":0},"clocktower":{"price":3500,"obstacle":false,"fuelCap":0}},"goals":{"g0":{"coins":200,"xp":20,"bucks":0},"r1":{"coins":150,"xp":15,"bucks":0},"r2":{"coins":300,"xp":25,"bucks":1},"g1":{"coins":150,"xp":15,"bucks":0},"g2":{"coins":100,"xp":10,"bucks":0},"g3":{"coins":300,"xp":25,"bucks":0},"g4":{"coins":250,"xp":20,"bucks":0},"g5":{"coins":200,"xp":20,"bucks":0},"g6":{"coins":300,"xp":25,"bucks":0},"g7":{"coins":150,"xp":15,"bucks":0},"g8":{"coins":500,"xp":40,"bucks":1},"g9":{"coins":600,"xp":50,"bucks":0},"g10":{"coins":800,"xp":60,"bucks":1},"g11":{"coins":1000,"xp":70,"bucks":0},"r3":{"coins":3000,"xp":200,"bucks":2},"gp1":{"coins":2000,"xp":150,"bucks":2},"g12":{"coins":1200,"xp":80,"bucks":2},"g13":{"coins":1500,"xp":100,"bucks":0},"g14":{"coins":2500,"xp":150,"bucks":2},"g15":{"coins":5000,"xp":250,"bucks":3},"g16":{"coins":5000,"xp":250,"bucks":3}},"gp":{"rookie":{"unlock":2,"box":["trail","miata","woodie","cruiser"]},"street":{"unlock":5,"box":["stallion","rally","buggy","bandit"]},"pro":{"unlock":8,"box":["vette","charger","lemans"]},"legends":{"unlock":12,"box":["gtr","gullwing","hyper","lambo"]}},"rescue":{"pip":1,"civic":1,"bug":1,"woodie":1,"trail":1,"miata":1,"hauler":3,"buggy":3,"stallion":3,"cruiser":5,"rally":5,"bandit":5,"vette":5,"charger":7,"lemans":7,"gtr":7,"gullwing":10,"hyper":10},"upgradeXpTo":[0,15,35,60,90,125,165,210,260,315],"mods":{"ducktail":{"slot":"spoiler","coins":1200,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":16},"gtwing":{"slot":"spoiler","coins":4000,"parts":10,"bucks":0,"power":0,"grip":4,"weight":0,"xp":25},"attackwing":{"slot":"spoiler","coins":0,"parts":0,"bucks":12,"power":0,"grip":6,"weight":0,"xp":34},"twintips":{"slot":"exhaust","coins":1000,"parts":0,"bucks":0,"power":2,"grip":0,"weight":0,"xp":16},"sidepipes":{"slot":"exhaust","coins":3500,"parts":8,"bucks":0,"power":4,"grip":0,"weight":0,"xp":22},"flamepipes":{"slot":"exhaust","coins":0,"parts":0,"bucks":10,"power":6,"grip":0,"weight":0,"xp":34},"streetkit":{"slot":"kit","coins":1500,"parts":0,"bucks":0,"power":0,"grip":1,"weight":-2,"xp":19},"widebody":{"slot":"kit","coins":6000,"parts":15,"bucks":0,"power":0,"grip":3,"weight":-3,"xp":28},"carbonkit":{"slot":"kit","coins":0,"parts":0,"bucks":15,"power":0,"grip":3,"weight":-6,"xp":40},"vented":{"slot":"hood","coins":800,"parts":0,"bucks":0,"power":1,"grip":0,"weight":-1,"xp":16},"ramscoop":{"slot":"hood","coins":3000,"parts":6,"bucks":0,"power":3,"grip":0,"weight":0,"xp":22},"blower":{"slot":"hood","coins":8000,"parts":20,"bucks":0,"power":5,"grip":0,"weight":0,"xp":31},"chrome":{"slot":"rims","coins":600,"parts":0,"bucks":0,"power":0,"grip":0,"weight":-1,"xp":13},"goldmesh":{"slot":"rims","coins":2500,"parts":5,"bucks":0,"power":0,"grip":1,"weight":-2,"xp":22},"forged":{"slot":"rims","coins":7000,"parts":12,"bucks":0,"power":0,"grip":2,"weight":-3,"xp":31}},"driverBonus":0.25,"campaign":{"c1":{"unlock":1,"races":["c1-0","c1-1","c1-2","c1-3","c1-4"],"coins":1000,"bucks":1,"trophies":3,"starBucks":1},"c2":{"unlock":3,"races":["c2-0","c2-1","c2-2","c2-3","c2-4"],"coins":2000,"bucks":1,"trophies":3,"starBucks":1},"c3":{"unlock":5,"races":["c3-0","c3-1","c3-2","c3-3","c3-4"],"coins":3500,"bucks":2,"trophies":4,"starBucks":1},"c4":{"unlock":7,"races":["c4-0","c4-1","c4-2","c4-3","c4-4"],"coins":5500,"bucks":2,"trophies":5,"starBucks":2},"c5":{"unlock":9,"races":["c5-0","c5-1","c5-2","c5-3","c5-4"],"coins":8000,"bucks":3,"trophies":6,"starBucks":2},"c6":{"unlock":12,"races":["c6-0","c6-1","c6-2","c6-3","c6-4"],"coins":12000,"bucks":3,"trophies":8,"starBucks":2},"c7":{"unlock":15,"races":["c7-0","c7-1","c7-2","c7-3","c7-4"],"coins":20000,"bucks":5,"trophies":10,"starBucks":3}},"sets":{"daily":{"cars":["pip","civic","trail","miata"],"coins":1500,"bucks":2,"trophies":5,"xp":60},"bikes":{"cars":["zippy","baron","shinden"],"coins":4000,"bucks":3,"trophies":10,"xp":120},"classics":{"cars":["bug","woodie","hauler","cruiser","buggy"],"coins":5000,"bucks":5,"trophies":15,"xp":150},"muscle":{"cars":["stallion","charger","hellcat","bandit"],"coins":8000,"bucks":5,"trophies":15,"xp":200},"track":{"cars":["rally","vette","gtr","lemans","gullwing"],"coins":15000,"bucks":8,"trophies":25,"xp":300},"dream":{"cars":["lambo","hyper","tomahawk"],"coins":30000,"bucks":15,"trophies":40,"xp":500}}}$catalog$::jsonb
-- catalog:end
$$;

-- The guard from 0013, plus collection set rewards.
create or replace function public.econ_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  cat jsonb := public.econ_catalog();
  player boolean := current_user in ('authenticated', 'anon');
  now_s numeric := extract(epoch from now());
  o jsonb;
  s jsonb := new.state;
  e jsonb;
  fixes jsonb := '{}';
  dt numeric;
  o_lvl int;
  n_lvl int;
  lvl_rate numeric;
  xp_bank numeric;
  val_bank numeric;
  win_bank numeric;
  trophy_bank numeric;
  o_total numeric;
  n_total numeric;
  gain numeric;
  allow numeric;
  excess numeric;
  take numeric;
  r record;
  c jsonb;
  cars jsonb;
  o_uids text[];
  o_claimed jsonb;
  claimed jsonb;
  new_goals text[];
  goal_coins numeric := 0;
  goal_xp numeric := 0;
  goal_bucks numeric := 0;
  daily_coins numeric := 0;
  daily_bucks numeric := 0;
  od text;
  nd text;
  streak int;
  levelup_coins numeric := 0;
  gp_series text;
  gp_box jsonb;
  gp_value numeric := 0;
  o_camp jsonb;
  camp jsonb;
  camp_coins numeric := 0;
  camp_bucks numeric := 0;
  camp_trophies numeric := 0;
  o_sets jsonb;
  new_sets text[];
  asked_sets int;
  set_coins numeric := 0;
  set_bucks numeric := 0;
  set_trophies numeric := 0;
  set_xp numeric := 0;
  restored text;
  restore_value numeric := 0;
  bucks_cost numeric := 0;
  max_bucks numeric;
  cap numeric;
  o_value numeric;
  limit_value numeric;
  n_xp numeric;
  fld text;
  inc_coins numeric;
  inc_xp numeric;
  up_xp numeric := 0;
  mod_xp numeric := 0;
  r2 record;
begin
  -- Columns only the server writes.
  new.corrections := null;
  if tg_op = 'UPDATE' then
    new.previous_state := old.previous_state;
    new.previous_updated_at := old.previous_updated_at;
  else
    new.previous_state := null;
    new.previous_updated_at := null;
  end if;

  if jsonb_typeof(s) <> 'object' then
    raise exception 'save must be an object' using errcode = 'check_violation';
  end if;

  if not player then
    -- Trusted write (SQL editor, service role): keep it as is and start the banks full.
    new.econ := jsonb_build_object('at', now_s);
  else
    if tg_op = 'UPDATE' then
      o := old.state;
      e := coalesce(old.econ, '{}');
      dt := greatest(now_s - coalesce((e ->> 'at')::numeric, now_s), 0);
    else
      -- First cloud save: measured from a fresh town, with an hour of guest play allowed
      -- on top of the time since the account was made (up to a day).
      o := public.econ_starter();
      e := '{}';
      dt := 3600 + least(econ_private.econ_account_age(new.owner_id), 86400);
    end if;

    o_lvl := least(greatest(floor(public.econ_num(o, 'level')), 1), 200)::int;
    lvl_rate := greatest(public.econ_xp_to_next(o_lvl), 400);
    -- Upgraded buildings earn faster, so the banks refill faster (per minute, over level 1).
    select u.coins, u.xp into inc_coins, inc_xp from public.econ_upgrade_rate(o, cat) u;
    if tg_op = 'UPDATE' then
      -- Banks refill with time. A missing bank (a save from before this guard) starts full.
      xp_bank := least(coalesce((e ->> 'xp')::numeric, 1e15) + dt * (lvl_rate / 1200 + inc_xp / 60), 3 * lvl_rate + 60 * inc_xp);
      val_bank := least(coalesce((e ->> 'value')::numeric, 1e15) + dt * (500 + 200 * o_lvl + inc_coins) / 60, 30 * (500 + 200 * o_lvl + inc_coins));
      win_bank := least(coalesce((e ->> 'wins')::numeric, 1e15) + dt / 20, 30);
      trophy_bank := least(coalesce((e ->> 'trophies')::numeric, 1e15) + dt / 20, 40);
    else
      xp_bank := dt * (lvl_rate / 1200 + inc_xp / 60);
      val_bank := dt * (500 + 200 * o_lvl + inc_coins) / 60;
      win_bank := dt / 20;
      trophy_bank := dt / 20;
    end if;

    -- Fields of the wrong type keep their last good value.
    for fld in select unnest(array['level', 'xp', 'coins', 'bucks', 'parts', 'fuel', 'trophies', 'racesWon', 'dailyStreak']) loop
      if jsonb_typeof(s -> fld) is distinct from 'number' then
        s := jsonb_set(s, array[fld], coalesce(case when jsonb_typeof(o -> fld) = 'number' then o -> fld end, '0'));
        fixes := fixes || jsonb_build_object(fld, 'not a number');
      end if;
    end loop;
    for fld in select unnest(array['cars', 'buildings', 'roads', 'land', 'claimedGoals', 'junkyard']) loop
      if jsonb_typeof(s -> fld) is distinct from 'array' then
        s := jsonb_set(s, array[fld], coalesce(case when jsonb_typeof(o -> fld) = 'array' then o -> fld end, '[]'));
        fixes := fixes || jsonb_build_object(fld, 'not a list');
      end if;
    end loop;

    -- Cars: upgrades stay within 0-5. Models the catalog doesn't know yet are kept but count for nothing.
    cars := '[]';
    for c in select x from jsonb_array_elements(case when jsonb_typeof(s -> 'cars') = 'array' then s -> 'cars' else '[]' end) x loop
      if jsonb_typeof(c) = 'object' and c ->> 'uid' is not null then
        cars := cars || jsonb_build_array(c || jsonb_build_object('upgrades', jsonb_build_object(
          'engine', public.econ_upgrade(c, 'engine'), 'turbo', public.econ_upgrade(c, 'turbo'),
          'tires', public.econ_upgrade(c, 'tires'), 'weight', public.econ_upgrade(c, 'weight'))));
      end if;
    end loop;
    if cars is distinct from s -> 'cars' then
      fixes := fixes || '{"cars":"bad cars or upgrades"}';
    end if;
    s := jsonb_set(s, '{cars}', cars);
    select coalesce(array_agg(x ->> 'uid'), '{}') into o_uids
      from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) x;

    -- Goals stay claimed; newly claimed ones pay their listed reward once.
    o_claimed := case when jsonb_typeof(o -> 'claimedGoals') = 'array' then o -> 'claimedGoals' else '[]' end;
    select coalesce(array_agg(distinct g), '{}') into new_goals
      from jsonb_array_elements_text(case when jsonb_typeof(s -> 'claimedGoals') = 'array' then s -> 'claimedGoals' else '[]' end) g
      where not o_claimed ? g;
    claimed := o_claimed || coalesce(to_jsonb(new_goals), '[]');
    if exists (select 1 from jsonb_array_elements_text(o_claimed) g
               where not coalesce(case when jsonb_typeof(s -> 'claimedGoals') = 'array' then s -> 'claimedGoals' end, '[]') ? g) then
      fixes := fixes || '{"claimedGoals":"kept claimed goals"}';
    end if;
    s := jsonb_set(s, '{claimedGoals}', claimed);
    select coalesce(sum((cat -> 'goals' -> g ->> 'coins')::numeric), 0), coalesce(sum((cat -> 'goals' -> g ->> 'xp')::numeric), 0),
           coalesce(sum((cat -> 'goals' -> g ->> 'bucks')::numeric), 0)
      into goal_coins, goal_xp, goal_bucks from unnest(new_goals) g;

    -- Collection book: claimed sets stay claimed. A newly claimed set pays its listed coins, bucks,
    -- trophies and XP once, if every car in it is owned (in this save or the last one). Claims for
    -- sets this catalog doesn't know, or that aren't complete, are dropped so they can be claimed later.
    -- (A save with no claimedSets is from a client older than the book, so the old list comes back quietly.)
    o_sets := case when jsonb_typeof(o -> 'claimedSets') = 'array' then o -> 'claimedSets' else '[]' end;
    select coalesce(array_agg(distinct g), '{}') into new_sets
      from jsonb_array_elements_text(case when jsonb_typeof(s -> 'claimedSets') = 'array' then s -> 'claimedSets' else '[]' end) g
      where not o_sets ? g;
    asked_sets := cardinality(new_sets);
    select coalesce(array_agg(g), '{}') into new_sets from unnest(new_sets) g
      where coalesce(cat -> 'sets', '{}') ? g
        and not exists (
          select 1 from jsonb_array_elements_text(cat -> 'sets' -> g -> 'cars') m
          where not exists (select 1 from jsonb_array_elements(cars) x where x ->> 'model' = m)
            and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) x
                            where x ->> 'model' = m));
    if cardinality(new_sets) < asked_sets then
      fixes := fixes || '{"sets":"set not complete"}';
    end if;
    if jsonb_typeof(s -> 'claimedSets') = 'array'
       and exists (select 1 from jsonb_array_elements_text(o_sets) g where not (s -> 'claimedSets') ? g) then
      fixes := fixes || '{"claimedSets":"kept claimed sets"}';
    end if;
    s := jsonb_set(s, '{claimedSets}', o_sets || coalesce(to_jsonb(new_sets), '[]'));
    select coalesce(sum((cat -> 'sets' -> g ->> 'coins')::numeric), 0), coalesce(sum((cat -> 'sets' -> g ->> 'bucks')::numeric), 0),
           coalesce(sum((cat -> 'sets' -> g ->> 'trophies')::numeric), 0), coalesce(sum((cat -> 'sets' -> g ->> 'xp')::numeric), 0)
      into set_coins, set_bucks, set_trophies, set_xp from unnest(new_sets) g;
    goal_xp := goal_xp + set_xp;

    -- Building upgrades pay their listed XP once per level gained (the coins are checked with town worth).
    select coalesce(sum(greatest((cat -> 'upgradeXpTo' ->> (public.econ_blvl(x) - 1))::numeric
                                 - (cat -> 'upgradeXpTo' ->> (public.econ_old_blvl(o, x) - 1))::numeric, 0)), 0)
      into up_xp
      from jsonb_array_elements(case when jsonb_typeof(s -> 'buildings') = 'array' then s -> 'buildings' else '[]' end) x
      where cat -> 'buildings' -> (x ->> 'def') ? 'up';
    -- Newly bought car mods pay their listed XP once each.
    select coalesce(sum((cat -> 'mods' -> f.id ->> 'xp')::numeric), 0) into mod_xp
      from jsonb_array_elements(cars) x, public.econ_owned_mods(x, cat) f
      where not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) z,
                               public.econ_owned_mods(z, cat) g
                        where z ->> 'uid' = x ->> 'uid' and g.id = f.id);
    goal_xp := goal_xp + up_xp + mod_xp;

    -- XP and level.
    o_total := public.econ_total_xp(o_lvl, public.econ_num(o, 'xp'));
    n_total := public.econ_total_xp(least(greatest(floor(public.econ_num(s, 'level')), 1), 200)::int, public.econ_num(s, 'xp'));
    gain := n_total - o_total;
    if gain > xp_bank + goal_xp then
      fixes := fixes || jsonb_build_object('xp', jsonb_build_object('sent', gain, 'kept', floor(xp_bank + goal_xp)));
      n_total := o_total + floor(xp_bank + goal_xp);
      xp_bank := 0;
    else
      xp_bank := xp_bank - greatest(gain - goal_xp, 0);
    end if;
    select l.lvl, l.xp into n_lvl, n_xp from public.econ_level_for(n_total) l;
    -- Never below the level already saved (the save guard refuses level drops).
    if n_lvl < o_lvl then
      n_lvl := o_lvl;
      n_xp := greatest(public.econ_num(s, 'xp'), 0);
    end if;
    s := s || jsonb_build_object('level', n_lvl, 'xp', n_xp);
    select coalesce(sum(l * 100), 0) into levelup_coins from generate_series(o_lvl + 1, n_lvl) l;

    -- Daily bonus: once per UTC day, streak up by one at most.
    od := o ->> 'lastDaily';
    nd := s ->> 'lastDaily';
    if nd is distinct from od then
      if nd ~ '^\d{4}-\d{2}-\d{2}$' and (od is null or nd > od) and nd::date <= (now() at time zone 'utc')::date + 1 then
        streak := case when od ~ '^\d{4}-\d{2}-\d{2}$' and od::date = nd::date - 1 then floor(public.econ_num(o, 'dailyStreak'))::int + 1 else 1 end;
        if public.econ_num(s, 'dailyStreak') > streak then
          s := jsonb_set(s, '{dailyStreak}', to_jsonb(streak));
          fixes := fixes || '{"dailyStreak":"too long"}';
        end if;
        streak := least(greatest(floor(public.econ_num(s, 'dailyStreak'))::int, 1), 5);
        daily_coins := (array[200, 400, 600, 800 + 5 * 50, 1200])[streak];
        daily_bucks := case when streak = 5 then 1 else 0 end;
      else
        s := s || jsonb_build_object('lastDaily', o -> 'lastDaily', 'dailyStreak', coalesce(o -> 'dailyStreak', '0'));
        fixes := fixes || '{"lastDaily":"already claimed"}';
      end if;
    end if;

    -- A finished Grand Prix series pays a mystery box car and 5 trophies, at most once every two minutes.
    if n_lvl >= 2 and now_s - coalesce((e ->> 'gp_at')::numeric, 0) >= 120 then
      select k into gp_series from jsonb_each(cat -> 'gp') g(k, v)
        where n_lvl >= (v ->> 'unlock')::int
          and public.econ_num(s -> 'gp' -> k, 'clears') > public.econ_num(o -> 'gp' -> k, 'clears')
        limit 1;
      if gp_series is not null then
        gp_box := cat -> 'gp' -> gp_series -> 'box';
        select max((cat -> 'cars' -> b ->> 'price')::numeric) into gp_value from jsonb_array_elements_text(gp_box) b;
        e := e || jsonb_build_object('gp_at', now_s);
      end if;
    end if;

    -- Campaign: races stay won with their best stars (whole numbers 1-3). Each chapter pays its clear
    -- bonus (coins, bucks, trophies) once when its last race is first won, and its star bucks once
    -- when every race in it has three stars. Chapters above the player's level pay nothing.
    o_camp := case when jsonb_typeof(o -> 'campaign') = 'object' then o -> 'campaign' else '{}' end;
    -- (A save with no campaign at all is from a client older than it, so the wins come back quietly.)
    if jsonb_typeof(s -> 'campaign') = 'object'
       and exists (select 1 from jsonb_each(o_camp) x where public.econ_num(s -> 'campaign', x.key) < public.econ_num(o_camp, x.key)) then
      fixes := fixes || '{"campaign":"kept races won"}';
    end if;
    select coalesce(jsonb_object_agg(k, n), '{}') into camp from (
      select k, max(n)::int n from (
        select x.key k, least(floor(public.econ_num(s -> 'campaign', x.key)), 3) n
          from jsonb_each(case when jsonb_typeof(s -> 'campaign') = 'object' then s -> 'campaign' else '{}' end) x
        union all
        select x.key, least(floor(public.econ_num(o_camp, x.key)), 3) from jsonb_each(o_camp) x
      ) t where n >= 1 group by k) q;
    s := jsonb_set(s, '{campaign}', camp);
    for r in select v, (select min(public.econ_num(o_camp, x)) from jsonb_array_elements_text(v -> 'races') x) o_min,
                       (select min(public.econ_num(camp, x)) from jsonb_array_elements_text(v -> 'races') x) n_min
             from jsonb_each(coalesce(cat -> 'campaign', '{}')) g(k, v) where n_lvl >= (v ->> 'unlock')::int loop
      if r.n_min >= 1 and r.o_min < 1 then
        camp_coins := camp_coins + (r.v ->> 'coins')::numeric;
        camp_bucks := camp_bucks + (r.v ->> 'bucks')::numeric;
        camp_trophies := camp_trophies + (r.v ->> 'trophies')::numeric;
      end if;
      if r.n_min >= 3 and r.o_min < 3 then
        camp_bucks := camp_bucks + (r.v ->> 'starBucks')::numeric;
      end if;
    end loop;

    -- A restored car (the one in the bay, by uid) is worth its price, at most once a minute.
    if jsonb_typeof(o -> 'restoring') = 'object' and now_s - coalesce((e ->> 'restore_at')::numeric, 0) >= 60
       and n_lvl >= coalesce((cat -> 'rescue' ->> (o -> 'restoring' ->> 'model'))::int, 999) then
      select x ->> 'uid' into restored from jsonb_array_elements(cars) x
        where x ->> 'uid' = o -> 'restoring' ->> 'uid' and x ->> 'model' = o -> 'restoring' ->> 'model' and not (x ->> 'uid') = any(o_uids)
        limit 1;
      if restored is not null then
        restore_value := (cat -> 'cars' -> (o -> 'restoring' ->> 'model') ->> 'price')::numeric;
        e := e || jsonb_build_object('restore_at', now_s);
      end if;
    end if;

    -- Bucks: only what levels, goals, the daily bonus, campaign bonuses and collection sets pay, less any bucks-only car bought.
    for r in select x from jsonb_array_elements(cars) x loop
      if not (r.x ->> 'uid') = any(o_uids) and (cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric > 0
         and r.x ->> 'uid' is distinct from restored then
        if gp_box is not null and gp_box ? (r.x ->> 'model') then
          gp_box := null; -- the prize car is free
        else
          bucks_cost := bucks_cost + (cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric;
        end if;
      end if;
    end loop;
    -- Bucks-only mods bought since the last save are paid for too.
    bucks_cost := bucks_cost + coalesce((select sum(n.bucks) from public.econ_new_bucks_mods(cars, o, cat) n), 0);
    max_bucks := greatest(public.econ_num(o, 'bucks'), 0) + (n_lvl - o_lvl) + goal_bucks + daily_bucks + camp_bucks + set_bucks - bucks_cost;
    if max_bucks < 0 then
      -- Unpaid bucks-only mods come off first, then unpaid bucks-only cars.
      for r2 in select * from public.econ_new_bucks_mods(cars, o, cat) order by bucks desc loop
        exit when max_bucks >= 0;
        cars := (select coalesce(jsonb_agg(case when y ->> 'uid' = r2.uid
                   then y || jsonb_build_object(
                     'mods', coalesce((select jsonb_agg(m) from jsonb_array_elements(case when jsonb_typeof(y -> 'mods') = 'array' then y -> 'mods' else '[]' end) m where m #>> '{}' is distinct from r2.id), '[]'),
                     'ownedMods', coalesce((select jsonb_agg(m) from jsonb_array_elements(case when jsonb_typeof(y -> 'ownedMods') = 'array' then y -> 'ownedMods' else '[]' end) m where m #>> '{}' is distinct from r2.id), '[]'))
                   else y end order by ord), '[]')
                 from jsonb_array_elements(cars) with ordinality t(y, ord));
        max_bucks := max_bucks + r2.bucks;
        fixes := fixes || jsonb_build_object('unpaid_mod', r2.id);
      end loop;
      s := jsonb_set(s, '{cars}', cars);
    end if;
    if max_bucks < 0 then
      -- Bucks-only cars that weren't paid for go back.
      for r in select x from jsonb_array_elements(cars) x
               where not (x ->> 'uid') = any(o_uids) and (cat -> 'cars' -> (x ->> 'model') ->> 'bucks')::numeric > 0
               order by (cat -> 'cars' -> (x ->> 'model') ->> 'bucks')::numeric desc loop
        exit when max_bucks >= 0;
        cars := (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(cars) y where y ->> 'uid' <> r.x ->> 'uid');
        max_bucks := max_bucks + (cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric;
        fixes := fixes || jsonb_build_object('unpaid_car', r.x ->> 'model');
      end loop;
      s := jsonb_set(s, '{cars}', cars);
      max_bucks := greatest(max_bucks, 0);
    end if;
    if public.econ_num(s, 'bucks') > max_bucks or public.econ_num(s, 'bucks') < 0 then
      fixes := fixes || jsonb_build_object('bucks', jsonb_build_object('sent', public.econ_num(s, 'bucks'), 'kept', least(greatest(public.econ_num(s, 'bucks'), 0), max_bucks)));
      s := jsonb_set(s, '{bucks}', to_jsonb(least(greatest(public.econ_num(s, 'bucks'), 0), max_bucks)));
    end if;

    -- Town worth: grows only as fast as play allows, plus the exact payouts above.
    if public.econ_num(s, 'coins') < 0 then s := jsonb_set(s, '{coins}', '0'); end if;
    if public.econ_num(s, 'parts') < 0 then s := jsonb_set(s, '{parts}', '0'); end if;
    o_value := public.econ_value(o, cat);
    gain := public.econ_value(s, cat) - o_value;
    allow := levelup_coins + goal_coins + daily_coins + gp_value + restore_value + camp_coins + set_coins;
    if gain > val_bank + allow then
      fixes := fixes || jsonb_build_object('worth', jsonb_build_object('sent', round(gain), 'kept', floor(val_bank + allow)));
      limit_value := o_value + val_bank + allow;
      val_bank := 0;
      -- Take it back from coins first, then new cars, parts, car upgrades, car mods, building upgrades and new buildings.
      excess := public.econ_value(s, cat) - limit_value;
      take := least(ceil(excess), public.econ_num(s, 'coins'));
      s := jsonb_set(s, '{coins}', to_jsonb(floor(public.econ_num(s, 'coins') - take)));
      excess := public.econ_value(s, cat) - limit_value;
      for r in select x from jsonb_array_elements(s -> 'cars') x
               where not (x ->> 'uid') = any(o_uids) and cat -> 'cars' ? (x ->> 'model')
               order by public.econ_car_value(x, cat) desc loop
        exit when excess <= 0;
        s := jsonb_set(s, '{cars}', (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(s -> 'cars') y where y ->> 'uid' <> r.x ->> 'uid'));
        excess := public.econ_value(s, cat) - limit_value;
      end loop;
      if excess > 0 then
        take := least(ceil(excess / 50), public.econ_num(s, 'parts'));
        s := jsonb_set(s, '{parts}', to_jsonb(floor(public.econ_num(s, 'parts') - take)));
        excess := public.econ_value(s, cat) - limit_value;
      end if;
      if excess > 0 then
        s := jsonb_set(s, '{cars}', (
          select coalesce(jsonb_agg(case when oc is null then y else y || jsonb_build_object('upgrades', jsonb_build_object(
            'engine', least(public.econ_upgrade(y, 'engine'), public.econ_upgrade(oc, 'engine')),
            'turbo', least(public.econ_upgrade(y, 'turbo'), public.econ_upgrade(oc, 'turbo')),
            'tires', least(public.econ_upgrade(y, 'tires'), public.econ_upgrade(oc, 'tires')),
            'weight', least(public.econ_upgrade(y, 'weight'), public.econ_upgrade(oc, 'weight')))) end order by ord), '[]')
          from jsonb_array_elements(s -> 'cars') with ordinality t(y, ord)
          left join lateral (select z as oc from jsonb_array_elements(o -> 'cars') z where z ->> 'uid' = y ->> 'uid' limit 1) old_car on true));
        excess := public.econ_value(s, cat) - limit_value;
      end if;
      if excess > 0 then
        -- Car mods go back to what each car had bought and fitted in the last save.
        s := jsonb_set(s, '{cars}', (
          select coalesce(jsonb_agg(case when oc is null then y
                                         else y || jsonb_build_object('mods', coalesce(oc -> 'mods', '[]'), 'ownedMods', coalesce(oc -> 'ownedMods', '[]')) end order by ord), '[]')
          from jsonb_array_elements(s -> 'cars') with ordinality t(y, ord)
          left join lateral (select z as oc from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) z
                             where z ->> 'uid' = y ->> 'uid' limit 1) old_car on true));
        excess := public.econ_value(s, cat) - limit_value;
      end if;
      if excess > 0 and jsonb_typeof(s -> 'buildings') = 'array' then
        -- Building upgrades go back to their last saved level.
        for r in select x, public.econ_old_blvl(o, x) ol from jsonb_array_elements(s -> 'buildings') x
                 where public.econ_blvl(x) > public.econ_old_blvl(o, x) and cat -> 'buildings' -> (x ->> 'def') ? 'up'
                 order by (cat -> 'buildings' -> (x ->> 'def') -> 'up' -> 'spend' ->> (public.econ_blvl(x) - 1))::numeric desc loop
          exit when excess <= 0;
          s := jsonb_set(s, '{buildings}', (
            select coalesce(jsonb_agg(case when y ->> 'uid' = r.x ->> 'uid' then y || jsonb_build_object('level', r.ol) else y end order by ord), '[]')
            from jsonb_array_elements(s -> 'buildings') with ordinality t(y, ord)));
          excess := public.econ_value(s, cat) - limit_value;
        end loop;
      end if;
      if excess > 0 and jsonb_typeof(s -> 'buildings') = 'array' then
        for r in select x from jsonb_array_elements(s -> 'buildings') x
                 where not coalesce((cat -> 'buildings' -> (x ->> 'def') ->> 'obstacle')::boolean, true)
                   and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(o -> 'buildings') = 'array' then o -> 'buildings' else '[]' end) z
                                   where z ->> 'uid' = x ->> 'uid')
                 order by (cat -> 'buildings' -> (x ->> 'def') ->> 'price')::numeric desc loop
          exit when excess <= 0;
          s := jsonb_set(s, '{buildings}', (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(s -> 'buildings') y where y ->> 'uid' <> r.x ->> 'uid'));
          excess := public.econ_value(s, cat) - limit_value;
        end loop;
      end if;
    else
      val_bank := val_bank - greatest(gain - allow, 0);
    end if;

    -- Race wins and trophies: about one race every 20 seconds at most.
    gain := public.econ_num(s, 'racesWon') - public.econ_num(o, 'racesWon');
    if gain > win_bank then
      fixes := fixes || jsonb_build_object('racesWon', jsonb_build_object('sent', gain, 'kept', floor(win_bank)));
      s := jsonb_set(s, '{racesWon}', to_jsonb(public.econ_num(o, 'racesWon') + floor(win_bank)));
      win_bank := 0;
    else
      win_bank := win_bank - greatest(gain, 0);
    end if;
    gain := public.econ_num(s, 'trophies') - public.econ_num(o, 'trophies');
    allow := case when gp_series is not null then 5 else 0 end + camp_trophies + set_trophies;
    if gain > trophy_bank + allow then
      fixes := fixes || jsonb_build_object('trophies', jsonb_build_object('sent', gain, 'kept', floor(trophy_bank + allow)));
      s := jsonb_set(s, '{trophies}', to_jsonb(public.econ_num(o, 'trophies') + floor(trophy_bank + allow)));
      trophy_bank := 0;
    else
      trophy_bank := trophy_bank - greatest(gain - allow, 0);
    end if;

    -- Fuel stays near its cap (loot and the daily bonus can top it over).
    cap := 15 + n_lvl * 2 + coalesce((select sum(coalesce((cat -> 'buildings' -> (b ->> 'def') -> 'up' -> 'fuel' ->> (public.econ_blvl(b) - 1))::numeric,
                                                       (cat -> 'buildings' -> (b ->> 'def') ->> 'fuelCap')::numeric))
            from jsonb_array_elements(case when jsonb_typeof(s -> 'buildings') = 'array' then s -> 'buildings' else '[]' end) b), 0);
    if public.econ_num(s, 'fuel') > cap + 200 or public.econ_num(s, 'fuel') < 0 then
      fixes := fixes || jsonb_build_object('fuel', jsonb_build_object('sent', public.econ_num(s, 'fuel'), 'kept', least(greatest(public.econ_num(s, 'fuel'), 0), cap + 200)));
      s := jsonb_set(s, '{fuel}', to_jsonb(least(greatest(public.econ_num(s, 'fuel'), 0), cap + 200)));
    end if;

    new.econ := e || jsonb_build_object('at', now_s, 'xp', round(xp_bank, 2), 'value', round(val_bank, 2),
      'wins', round(win_bank, 3), 'trophies', round(trophy_bank, 3));
    if fixes <> '{}' then
      new.corrections := fixes;
      perform econ_private.econ_flag(new.owner_id, fixes);
    end if;
    new.state := s;
  end if;

  -- Public columns come from the checked save.
  new.level := least(greatest(floor(public.econ_num(s, 'level')), 1), 200)::int;
  new.town_name := coalesce(nullif(left(trim(s ->> 'townName'), 24), ''), 'My Town');
  new.trophies := least(greatest(floor(public.econ_num(s, 'trophies')), 0), 2e9)::int;
  new.race_wins := least(greatest(floor(public.econ_num(s, 'racesWon')), 0), 2e9)::int;
  select coalesce(sum(pi), 0) into new.power from (
    select public.econ_car_pi(x, cat) pi from jsonb_array_elements(case when jsonb_typeof(s -> 'cars') = 'array' then s -> 'cars' else '[]' end) x
    where cat -> 'cars' ? (x ->> 'model') order by 1 desc limit 5) top;
  select jsonb_build_object('name', cat -> 'cars' -> (x ->> 'model') ->> 'name', 'color', x ->> 'color',
                            'pi', public.econ_car_pi(x, cat), 'body', cat -> 'cars' -> (x ->> 'model') ->> 'body',
                            'mods', (select coalesce(jsonb_agg(f.id), '[]') from public.econ_fitted_mods(x, cat) f))
    into new.best_car
    from jsonb_array_elements(case when jsonb_typeof(s -> 'cars') = 'array' then s -> 'cars' else '[]' end) x
    where cat -> 'cars' ? (x ->> 'model') order by public.econ_car_pi(x, cat) desc limit 1;
  return new;
end $$;
