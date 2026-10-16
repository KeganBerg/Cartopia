-- 0111 Gems x10 (2026-10-16; Kegan picked "Gems x10" with existing balances x10 on the gem audit card in
-- "What to finish, build out or optimize"; SQL by "Cheat-proof economy"). Needs 0104 (race modes), 0105 (Call Cards)
-- 0108 (endless goals) and 0110 (season skins out of crates).
-- Every gem amount is now ten times what it was (free gem payouts fifteen times), matching the game
-- update on claude/project-thread-1djp4h (7e92b2c), and everyone's gems are multiplied by ten once.
--  1. econ_catalog(): 0104's (Trophy Road and race mode unlocks kept) regenerated from the gem update: gem prices x10 (cars,
--     mods), gem rewards x15 (goals, campaign, rivals, sets, mastery, season, crew and task chests).
--  2. econ_guard(): 0108's (endless goals) with three changes: a level-up allows 15 gems (LEVEL_GEMS, was 1); the
--     old log-in bonus gem is gone (the daily wheel replaced it, the game no longer pays it); a restored
--     car's cost counts a gem as 100 coins (GEM_BUILD_COINS, was 1,000; gem prices are ten times higher).
--  3. econ_car_value(): upgrades count a gem as 100 coins too (was 1,000).
--  4. econ_starter(): a new town starts with 100 gems (was 10).
--  5. crate_open(): 0105's (Call Cards), crate tables regenerated: Gold Crate 80 gems, Diamond 250, a gem is worth 30 + 10 per
--     level in coins (was 300 + 100), gem car prices x10. crate_open_many and wheel_spin read this table.
--  6. wheel_spin(): the gem slices pay 15 / 45 / 250 (was 1 / 3 / 15), same slice ids and weights.
--  7. trial_prize_table(): weekly time trial gems 150 / 105 / 75 / 30 (was 10 / 7 / 5 / 2).
--  8. visitor_next(): a visitor's gem prize is 15 (VISITOR_BUCKS, was 1).
--  9. econ_private.endless_pay(): 10 gems every 10th endless goal (was 1).
-- 10. Gems already earned, once: every save's gems x10, and the gems still on their
--     way x10: pack purchases (so a refund takes back the right amount) and what they still owe, crate
--     opens and wheel spins past the save's crate count, and visitor prizes not yet counted. Marked done in
--     econ_private.econ_rescales, so running this file again changes nothing. Saves get a new updated_at,
--     so an open game reloads the new balance instead of saving over it.
-- Pack amounts come from bucksPacks.ts through the payment webhook (purchase_record has no amounts of its
-- own). admin_grant's 1e12 ceiling stays.
-- RUN ORDER: right after the gem update is live (cartopia.lol/version.json), not before: before it, the old
-- game would spend x10 gems at old prices. In the minutes between, the new game just shows the old balance.

create or replace function public.econ_catalog() returns jsonb
language sql immutable set search_path = '' as $$
-- catalog:begin
select $catalog${"cars":{"pip":{"name":"Kipper Pocket","body":"compact","price":800,"bucks":0,"power":18,"grip":36,"weight":24,"unlock":1},"civic":{"name":"Kazumi Commuter","body":"sedan","price":1500,"bucks":0,"power":24,"grip":34,"weight":36,"unlock":1},"trail":{"name":"Ironside Workhorse","body":"truck","price":3900,"bucks":0,"power":42,"grip":30,"weight":74,"unlock":3},"miata":{"name":"Kazumi Zephyr","body":"roadster","price":8100,"bucks":0,"power":33,"grip":55,"weight":22,"unlock":5},"stallion":{"name":"Liberty Bore Horse '68","body":"muscle","price":13000,"bucks":0,"power":55,"grip":37,"weight":54,"unlock":7},"rally":{"name":"Kodiak Gravel Rex","body":"rally","price":22000,"bucks":0,"power":52,"grip":64,"weight":40,"unlock":10},"vette":{"name":"Liberty Sidewinder","body":"sports","price":44000,"bucks":0,"power":67,"grip":55,"weight":38,"unlock":15},"charger":{"name":"Liberty Brawler","body":"muscle","price":33000,"bucks":0,"power":72,"grip":42,"weight":60,"unlock":13},"hellcat":{"name":"Liberty Hellhound 707","body":"widebody","price":68000,"bucks":0,"power":81,"grip":47,"weight":62,"unlock":18},"gtr":{"name":"Kazumi Ronin GT","body":"coupe","price":110000,"bucks":0,"power":79,"grip":71,"weight":46,"unlock":22},"tomahawk":{"name":"Ironside Tomahawk","body":"tank","price":315000,"bucks":0,"power":100,"grip":95,"weight":60,"unlock":36},"zippy":{"name":"Kipper Zip 50","body":"scooter","price":2100,"bucks":0,"power":21,"grip":37,"weight":8,"unlock":2},"baron":{"name":"Liberty Road Baron","body":"chopper","price":13000,"bucks":0,"power":50,"grip":40,"weight":30,"unlock":7},"shinden":{"name":"Kazumi Shinden RR","body":"sportbike","price":135000,"bucks":0,"power":84,"grip":63,"weight":14,"unlock":24},"camper":{"name":"Lakeside Sunrise Camper","body":"van","price":2100,"bucks":0,"power":30,"grip":38,"weight":64,"unlock":2},"hotshot":{"name":"Kazumi Hot Shot RS","body":"hatch","price":8100,"bucks":0,"power":36,"grip":50,"weight":26,"unlock":5},"ridgeback":{"name":"Kodiak Ridgeback 4x4","body":"suv","price":10000,"bucks":0,"power":46,"grip":48,"weight":62,"unlock":6},"kitsune":{"name":"Kazumi Kitsune Drift","body":"coupe","price":19000,"bucks":0,"power":51,"grip":59,"weight":30,"unlock":9},"current":{"name":"Sparkline Current","body":"ev","price":49000,"bucks":0,"power":72,"grip":52,"weight":50,"unlock":16},"salon":{"name":"Regent Grand Salon","body":"luxury","price":0,"bucks":400,"power":65,"grip":51,"weight":70,"unlock":11},"stomper":{"name":"Ironside Dune Stomper","body":"truck","price":30000,"bucks":0,"power":70,"grip":47,"weight":72,"unlock":12},"monoposto":{"name":"Veloce Monoposto 1","body":"formula","price":200000,"bucks":0,"power":90,"grip":90,"weight":20,"unlock":30},"zenith":{"name":"Aether Zenith R","body":"super","price":440000,"bucks":0,"power":100,"grip":96,"weight":26,"unlock":40},"schoolbus":{"name":"Ironside Scholar 72","body":"bus","price":5300,"bucks":0,"power":45,"grip":40,"weight":90,"unlock":4},"shaggy":{"name":"Lakeside Shaggy Hound","body":"dogvan","price":8100,"bucks":0,"power":44,"grip":47,"weight":66,"unlock":5},"tusker":{"name":"Kodiak Tusker Scout","body":"tusker","price":85000,"bucks":0,"power":72,"grip":74,"weight":58,"unlock":20},"lambo":{"name":"Veloce Corrida V12","body":"wedge","price":0,"bucks":700,"power":92,"grip":72,"weight":34,"unlock":26},"hyper":{"name":"Veloce Hyperion","body":"super","price":250000,"bucks":0,"power":98,"grip":86,"weight":32,"unlock":33},"kreis":{"name":"Brandt Kreis S","body":"sedan","price":40000,"bucks":0,"power":64,"grip":60,"weight":44,"unlock":14},"bergmeister":{"name":"Falke Bergmeister RS","body":"rearengine","price":61000,"bucks":0,"power":67,"grip":65,"weight":34,"unlock":17},"rattler":{"name":"Liberty Rattler GT","body":"muscle","price":96000,"bucks":0,"power":85,"grip":55,"weight":56,"unlock":21},"cottonmouth":{"name":"Liberty Cottonmouth ACR","body":"longnose","price":145000,"bucks":0,"power":91,"grip":65,"weight":46,"unlock":25},"ringmeister":{"name":"Nordwerk Ring V10","body":"super","price":175000,"bucks":0,"power":90,"grip":84,"weight":40,"unlock":28},"raiden":{"name":"Kazumi Raiden R26","body":"prototype","price":225000,"bucks":0,"power":92,"grip":92,"weight":24,"unlock":32},"sovereign":{"name":"Moreau Sovereign 16","body":"super","price":0,"bucks":1000,"power":100,"grip":88,"weight":44,"unlock":34},"wraith":{"name":"Nordvik Wraith","body":"wedge","price":395000,"bucks":0,"power":100,"grip":92,"weight":30,"unlock":38},"fulmine":{"name":"Veloce Fulmine V12","body":"scissor","price":0,"bucks":2200,"power":100,"grip":95,"weight":30,"unlock":40},"eclat":{"name":"Moreau Eclat W16","body":"horseshoe","price":650000,"bucks":0,"power":100,"grip":99,"weight":40,"unlock":42},"orafo":{"name":"Aurelio Orafo V12","body":"teardrop","price":0,"bucks":1800,"power":100,"grip":96,"weight":28,"unlock":39},"scoops":{"name":"Lakeside Sundae Wagon","body":"icecream","price":5300,"bucks":0,"power":39,"grip":45,"weight":70,"unlock":4},"courier":{"name":"Ironside Doorstep Express","body":"parcel","price":3900,"bucks":0,"power":37,"grip":39,"weight":74,"unlock":3},"crusher":{"name":"Kodiak Mud Crusher","body":"monster","price":15000,"bucks":0,"power":58,"grip":50,"weight":88,"unlock":8},"sprint":{"name":"Valtorre Sprint 65","body":"stepnose","price":70000,"bucks":0,"power":110,"grip":104,"weight":30,"unlock":999},"revenant":{"name":"Liberty Revenant '69","body":"restomuscle","price":110000,"bucks":0,"power":130,"grip":92,"weight":56,"unlock":999},"pontone":{"name":"Corvara Pontone 58","body":"pontoon","price":170000,"bucks":0,"power":122,"grip":118,"weight":26,"unlock":999},"stinger":{"name":"Liberty Stinger SS","body":"ponycar","price":0,"bucks":0,"power":78,"grip":48,"weight":52,"unlock":999},"sora":{"name":"Kazumi Sora GT","body":"gtcoupe","price":0,"bucks":0,"power":84,"grip":72,"weight":40,"unlock":999},"scatto":{"name":"Vetta Scatto HF","body":"hothatch","price":0,"bucks":0,"power":61,"grip":58,"weight":40,"unlock":999},"thunderjet":{"name":"Liberty Thunderjet 440","body":"musclecoupe","price":0,"bucks":0,"power":90,"grip":52,"weight":56,"unlock":999},"hayate":{"name":"Kazumi Hayate RS","body":"popup","price":0,"bucks":0,"power":96,"grip":72,"weight":44,"unlock":999},"kestrel":{"name":"Nordwerk Kestrel GT","body":"midship","price":0,"bucks":0,"power":100,"grip":82,"weight":40,"unlock":999},"firebolt":{"name":"Liberty Firebolt Highboy","body":"highboy","price":0,"bucks":0,"power":122,"grip":70,"weight":40,"unlock":999},"kaze":{"name":"Kazumi Kaze TA-R","body":"timeattack","price":0,"bucks":0,"power":114,"grip":96,"weight":36,"unlock":999},"sturm":{"name":"Falke Sturm S1","body":"groupb","price":0,"bucks":0,"power":120,"grip":100,"weight":40,"unlock":999},"vanta":{"name":"Aether Vanta LT","body":"longtail","price":0,"bucks":0,"power":130,"grip":110,"weight":30,"unlock":999},"bug":{"name":"Bumble Bubble","body":"bubble","price":1200,"bucks":0,"power":20,"grip":34,"weight":28,"unlock":1},"woodie":{"name":"Lakeside Woodie Wagon","body":"wagon","price":2200,"bucks":0,"power":25,"grip":31,"weight":56,"unlock":1},"hauler":{"name":"Old Faithful Hauler","body":"truck","price":3000,"bucks":0,"power":40,"grip":40,"weight":70,"unlock":1},"cruiser":{"name":"Sunset Cruiser '57","body":"classic","price":5000,"bucks":0,"power":53,"grip":49,"weight":58,"unlock":1},"buggy":{"name":"Dune Skipper Buggy","body":"offroad","price":6000,"bucks":0,"power":34,"grip":56,"weight":18,"unlock":1},"bandit":{"name":"Night Bandit","body":"muscle","price":8000,"bucks":0,"power":58,"grip":39,"weight":54,"unlock":1},"lemans":{"name":"Liberty Endurance GT","body":"super","price":16000,"bucks":0,"power":72,"grip":62,"weight":32,"unlock":1},"gullwing":{"name":"Silver Wing 300","body":"coupe","price":30000,"bucks":0,"power":77,"grip":71,"weight":36,"unlock":1},"speedster":{"name":"Fairhaven Speedster","body":"roadster","price":12000,"bucks":0,"power":65,"grip":53,"weight":26,"unlock":1},"nightfall":{"name":"Aether Nightfall","body":"wedge","price":24000,"bucks":0,"power":78,"grip":72,"weight":30,"unlock":0}},"buildings":{"showroom":{"price":0,"obstacle":false,"fuelCap":0},"garage":{"price":0,"obstacle":false,"fuelCap":0},"rescue":{"price":1000,"obstacle":false,"fuelCap":0},"crew":{"price":2500,"obstacle":false,"fuelCap":0},"gas":{"price":1500,"obstacle":false,"fuelCap":10,"up":{"spend":[0,1150,2850,5400,9400,15400,24350,37650,57450,87000],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[10,12,14,16,18,20,22,24,26,28]}},"pizza":{"price":400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2650,4450,7150,11050,16800,25200],"coins":[120,132,172.8,187.2,252,270,288,408,432,456],"xp":[10,10,14.4,14.4,18,18,21,28,28,28],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"donut":{"price":1000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,750,1900,3600,6350,10450,16550,25600,39000,58900],"coins":[100,116.47,144,167.14,193.85,225,261.82,306,360,427.5],"xp":[8,9.18,10.4,12,12.92,15,17.45,19.2,22.67,25.5],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"burger":{"price":1400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1050,2650,5000,8750,14350,22700,35150,53700,81300],"coins":[100,120,144,164.21,197.65,225,256,313.85,360,414.55],"xp":[7.5,8.73,10.2,10.74,12.71,14.25,16,18.46,21,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"icecream":{"price":2000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1500,3750,7150,12400,20300,32100,49700,75950,115100],"coins":[92,108.43,132.48,156,184,207,245.33,276,331.2,374.57],"xp":[7.2,8.14,9.6,10.96,12.57,13.8,15.33,16.94,20,22.29],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"carwash":{"price":2300,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1750,4350,8250,14250,23300,36800,56950,87000,131900],"coins":[113.33,136,163.2,189.43,219.69,255,296.73,346.8,408,456],"xp":[8.33,9.45,11.2,12.43,13.85,15.5,18,20.4,23.33,25.41],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"diner":{"price":4600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3450,8650,16400,28250,46000,72600,112400,171950,261050],"coins":[120,144,169.41,199.15,234.42,270,320,370.91,418.06,488.57],"xp":[8,9.16,10.35,11.74,13.4,15,17.33,19.64,21.68,24.86],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tires":{"price":2300,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1750,4350,8250,14250,23300,36800,56950,87000,131900],"coins":[100,125.45,137.56,171.89,190.59,225,273.1,297.78,350.4,386.09],"xp":[5,5.73,6.44,7.46,8.47,9.38,10.76,12,13.44,15.13],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bowling":{"price":6700,"obstacle":false,"fuelCap":0,"up":{"spend":[0,5050,12600,23900,41050,66800,105350,163100,249550,379050],"coins":[108.57,130.29,154.14,182.4,212.8,248.73,286.12,329.87,381.77,433.2],"xp":[7.86,9.04,10.31,11.63,13.2,15.05,16.94,18.89,21.49,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"motel":{"price":9600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,7200,18000,34200,58700,95450,150550,233050,356650,541900],"coins":[87.5,105,123.93,146.25,171.26,198.95,231.72,267.75,306.49,352.06],"xp":[5.83,6.73,7.57,8.68,9.79,11.12,12.55,14.25,15.89,18],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tuner":{"price":15200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,11400,28500,54150,92850,150850,237800,368150,563550,856400],"coins":[153,186.33,216,259.87,298.88,352.41,402.41,470.33,533.03,617.26],"xp":[7,8.07,9.06,10.45,11.72,13.37,14.96,17.01,18.97,21.47],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"stadium":{"price":40000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,30000,75000,142500,243950,396150,624350,966550,1479750,2249300],"coins":[140,167.49,198.3,234,273.49,318.99,369.91,426.27,490.38,563.29],"xp":[10,11.42,12.98,14.79,16.74,18.99,21.47,24.18,27.24,30.71],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"cinema":{"price":10500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,7900,19700,37400,64200,104350,164550,254750,389900,592450],"coins":[112,134.4,158.12,187.87,218.79,255.19,294.58,341.01,390.19,448],"xp":[8,9.16,10.35,11.87,13.4,15.19,17.1,19.34,21.68,24.42],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"coffee":{"price":800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,600,1500,2850,5100,8450,13400,20750,31600,47700],"coins":[100,120,144,173.33,186.67,225,274.29,291.43,360,380],"xp":[8,8.73,10.8,12,13.33,15,17.14,18.86,22,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tacos":{"price":1700,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1300,3200,6050,10550,17300,27400,42400,64800,98200],"coins":[105,126,151.2,172.42,207.53,236.25,268.8,329.54,378,435.27],"xp":[8,9.27,10.8,11.37,13.41,15,16.8,20.31,22,25.09],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"lube":{"price":3800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,2850,7150,13550,23350,38100,60150,93100,142400,216150],"coins":[100,122.18,145.88,160.85,192.56,225,270,316.36,340.65,402.86],"xp":[5,5.67,6.59,7.4,8.37,9.3,11,12.36,13.55,15.43],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"arcade":{"price":5800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,4350,10900,20700,35600,57900,91350,141400,216300,328500],"coins":[106.67,128,151.08,178.29,206.77,245.11,279.27,326.4,373.62,429.18],"xp":[7.5,8.55,9.84,11.14,12.46,14.3,16.09,18.3,20.43,22.94],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bodyshop":{"price":11400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,8550,21400,40650,69700,113300,178650,276550,423250,643100],"coins":[101,121.2,142.59,169.42,197.3,230.13,265.64,307.52,351.87,404],"xp":[7.5,8.62,9.76,11.1,12.56,14.28,16.11,18.09,20.32,22.95],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"market":{"price":19000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,14250,35650,67700,116000,188450,297050,459850,703900,1069800],"coins":[112,133.59,159.16,187.2,218.79,254.12,295.93,342.72,394.43,450.64],"xp":[7.33,8.39,9.55,10.8,12.28,13.92,15.74,17.88,20.09,22.59],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"firehouse":{"price":24000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,18000,45000,85500,146450,237900,375000,580550,888700,1350700],"coins":[119,142.15,168.83,198.55,232.47,271.14,312.99,362.33,417.95,480.21],"xp":[7.5,8.58,9.75,11.1,12.56,14.28,16.03,18.18,20.49,23.15],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"police":{"price":32000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,24000,60000,114000,195200,317000,499650,773550,1184200,1800000],"coins":[126,150.65,178.58,210,246.14,286.36,332.31,384.79,441.82,505.77],"xp":[8,9.13,10.39,11.79,13.4,15.15,17.14,19.4,21.82,24.51],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"parkade":{"price":60000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,45000,112500,213750,365850,593950,936050,1449150,2218600,3372600],"coins":[154,183.96,218.48,256.94,300.84,350.89,406.43,468.9,540.88,618.71],"xp":[9.5,10.83,12.35,14.02,15.91,18.04,20.37,22.97,25.95,29.13],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"club":{"price":8800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,6600,16500,31350,53850,87550,138050,213750,327100,496950],"coins":[150,180,211.76,248.94,293.02,337.5,400,463.64,522.58,610.71],"xp":[12,13.75,15.53,17.62,20.09,22.5,26,29.45,32.52,37.29],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"parts":{"price":8000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,6000,15000,28500,48950,79650,125600,194450,297550,452000],"coins":[113.75,139.91,161.78,193.28,221.57,264.76,301.24,349.33,401.14,467.73],"xp":[5.63,6.41,7.41,8.32,9.39,10.67,12.21,13.56,15.43,17.33],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"offices":{"price":16500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,12400,30950,58800,100750,163700,258050,399500,611550,929400],"coins":[100,119.28,142.11,167.14,195.35,226.89,264.22,306,352.17,402.35],"xp":[6.67,7.59,8.68,9.86,11.16,12.61,14.31,16.2,18.26,20.47],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"hospital":{"price":48000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,36000,90000,171000,292700,475250,749050,1159600,1775300,2698650],"coins":[133.33,159.52,188.85,222.86,260.47,303.8,352.29,405.97,467.03,536.47],"xp":[9.33,10.66,12.12,13.8,15.63,17.72,20.04,22.57,25.43,28.66],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"hq":{"price":82000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,61500,153750,292150,499900,811550,1278950,1979950,3031350,4608250],"coins":[138.89,166,196.94,232.14,271.32,316.01,366.97,423.59,487.36,558.82],"xp":[9.78,11.15,12.71,14.46,16.37,18.54,20.99,23.68,26.69,30.02],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"helipad":{"price":115000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,86250,215650,409700,701000,1137950,1793300,2776250,4250500,6461700],"coins":[157,187.72,222.52,262.23,306.7,357.72,414.07,478.03,550.52,632.44],"xp":[10.4,11.87,13.51,15.37,17.41,19.75,22.29,25.15,28.36,31.97],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"glasstower":{"price":185000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,138750,346900,659100,1127600,1830300,2884350,4465300,6836550,10393250],"coins":[160,191.42,227,266.95,312.56,363.79,421.78,487.16,560.43,643.76],"xp":[11.67,13.32,15.17,17.22,19.53,22.11,24.99,28.21,31.78,35.82],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"academy":{"price":16000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,12000,30000,57000,97700,158750,250300,387500,593150,901400],"coins":[92,109.73,130.74,153.77,179.72,208.74,243.08,281.52,324,370.16],"xp":[9.33,10.63,12.16,13.8,15.63,17.65,20.04,22.68,25.57,28.66],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"school":{"price":48000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,36000,90000,171000,292700,475250,749050,1159600,1775300,2698650],"coins":[122.86,147.05,174.42,205.14,240,279.42,323.76,374.87,430,495.15],"xp":[8.57,9.79,11.15,12.66,14.35,16.25,18.35,20.77,23.33,26.36],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"highschool":{"price":110000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,82500,206250,391900,670550,1088500,1715400,2655650,4065850,6180950],"coins":[164.44,196.54,233.17,274.86,321.24,374.16,434.5,501.53,577.04,661.65],"xp":[9.56,10.91,12.42,14.11,16,18.13,20.51,23.16,26.08,29.36],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"university":{"price":240000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,180000,450000,855000,1462700,2374250,3741550,5792350,8868400,13482300],"coins":[183.33,219.34,260.1,305.88,358.14,416.84,483.3,558.21,642.16,737.65],"xp":[9.33,10.66,12.14,13.78,15.63,17.68,19.99,22.57,25.43,28.66],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"muffler":{"price":3000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,2250,5650,10700,18500,30200,47700,73850,112900,171250],"coins":[102.22,125.04,138.78,169.43,201.23,238.33,264,314.8,363.43,412.32],"xp":[4.89,5.52,6.26,7.14,8,9.33,10.55,12,13.29,15.36],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"brakes":{"price":11000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,8250,20650,39200,67250,109300,172350,266800,408350,620500],"coins":[112.22,137.09,158.51,189,217.25,256.06,302.03,341.4,398.84,446.82],"xp":[6.11,7.03,8.04,9,10.29,11.66,13.29,14.8,16.8,18.82],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"wraps":{"price":19000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,14250,35650,67700,116000,188450,297050,459850,703900,1069800],"coins":[126.67,151.09,177.44,213.86,249.09,288,334.07,384.6,446.92,511.41],"xp":[7.33,8.36,9.54,10.82,12.35,13.89,15.72,17.85,19.95,22.59],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"dynolab":{"price":27000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,20250,50650,96200,164750,267550,421700,652850,999450,1519150],"coins":[134.67,160.63,191.37,225.09,263.07,305.55,355.82,412.08,474.26,541.84],"xp":[7.87,8.96,10.26,11.66,13.21,14.92,16.84,19.08,21.52,24.14],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"engines":{"price":66000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,49500,123750,235150,402400,653300,1029600,1593950,2440300,3709650],"coins":[140,166.96,197.48,234.36,274.05,318.18,368.57,426.11,492.47,562.82],"xp":[8.6,9.83,11.2,12.67,14.4,16.3,18.46,20.84,23.45,26.37],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"racefab":{"price":112000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,84000,210000,399000,682700,1108250,1746550,2703850,4139650,6293200],"coins":[145,173.76,205.42,242.25,282.56,330.38,383.51,441.04,509.76,581.5],"xp":[9.25,10.56,12.03,13.64,15.49,17.58,19.84,22.39,25.27,28.39],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"laundry":{"price":2200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1650,4150,7850,13600,22250,35200,54500,83300,126300],"coins":[100,117.86,144,169.57,200,225,266.67,300,360,407.14],"xp":[7.6,8.57,10.08,11.48,13.14,14.4,16.67,18.35,21.6,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"vet":{"price":9000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,6750,16900,32100,55100,89550,141200,218600,334550,508250],"coins":[112.5,135,160,187.2,219.13,257.14,297.93,340,396.73,456],"xp":[7.75,8.86,10.07,11.36,12.87,14.86,16.76,18.67,21.31,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"postoffice":{"price":23000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,17250,43150,81950,140350,228000,359400,556400,851750,1294550],"coins":[114.71,136.91,162.31,191.32,224.38,261.94,301.94,348.95,401.14,463.13],"xp":[7.53,8.55,9.78,11.09,12.66,14.33,16.06,18.21,20.46,23.25],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"library":{"price":31000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,23250,58150,110450,189100,307100,484050,749400,1147250,1743800],"coins":[126,150.52,178.76,210.22,246.14,287.09,331.4,383.64,442.54,508.46],"xp":[8.25,9.39,10.76,12.19,13.81,15.65,17.67,19.97,22.54,25.38],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"busdepot":{"price":58000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,43500,108750,206650,353650,574150,904900,1400900,2144750,3260300],"coins":[145.71,174.4,206.87,243.3,284.65,331.41,384,444.62,510,587.27],"xp":[9.71,11.1,12.64,14.35,16.27,18.41,20.8,23.54,26.44,29.88],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"cityhall":{"price":165000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,123750,309400,587850,1005700,1632500,2572650,3982750,6097750,9270050],"coins":[155,185.44,219.9,258.61,302.79,352.42,408.6,471.94,542.92,623.65],"xp":[10.67,12.18,13.87,15.74,17.86,20.21,22.85,25.79,29.06,32.75],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"minigolf":{"price":6200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,4650,11650,22100,38000,61850,97550,151000,231050,350900],"coins":[107.69,128.33,152.73,179.02,210,247.06,285.96,324.55,378,431.35],"xp":[7.69,8.83,10,11.21,12.86,14.82,16.6,18.55,21,23.68],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"pool":{"price":15000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,11250,28150,53450,91600,148850,234700,363350,556150,845200],"coins":[115,138,162.89,192.21,225.09,261.47,304.55,351.9,402.81,462.71],"xp":[7.67,8.82,9.93,11.36,12.82,14.53,16.55,18.6,20.92,23.47],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"funfair":{"price":50000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,37500,93750,178150,304900,495050,780200,1207850,1849150,2810950],"coins":[145,173.47,205.38,242.36,283.26,330.38,383.12,441.49,507.89,583.41],"xp":[10,11.42,12.98,14.79,16.74,18.99,21.47,24.18,27.24,30.71],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"waterpark":{"price":118000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,88500,221250,420400,719300,1167650,1840100,2848650,4361350,6630200],"coins":[157.78,188.57,223.72,263.71,308.22,358.99,416.88,481.2,553.65,634.82],"xp":[10.44,11.93,13.58,15.46,17.49,19.82,22.42,25.32,28.51,32.09],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"court":{"price":500,"obstacle":false,"fuelCap":0},"tennis":{"price":2800,"obstacle":false,"fuelCap":0},"haunted":{"price":2600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1950,4900,9300,16100,26250,41450,64150,98050,148750],"coins":[100,120,144,167.14,193.85,225,261.82,306,360,402.35],"xp":[8,9.09,10.4,12,13.38,15,16.91,19.2,22.67,24.71],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"cornmaze":{"price":900,"obstacle":false,"fuelCap":0},"cauldron":{"price":300,"obstacle":false,"fuelCap":0},"jacklamp":{"price":120,"obstacle":false,"fuelCap":0},"bush":{"price":150,"obstacle":true,"fuelCap":0},"rock":{"price":400,"obstacle":true,"fuelCap":0},"cactus":{"price":1500,"obstacle":true,"fuelCap":0},"house":{"price":250,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2750,4800,7900,12550,19600,30300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,1,2,3,4,5,6,7,8,9]}},"tree":{"price":50,"obstacle":false,"fuelCap":0},"palm":{"price":120,"obstacle":false,"fuelCap":0},"fountain":{"price":800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,600,1500,2850,5100,8450,13400,20750,31600,47700],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"flowers":{"price":80,"obstacle":false,"fuelCap":0},"lamp":{"price":60,"obstacle":false,"fuelCap":0},"bench":{"price":70,"obstacle":false,"fuelCap":0},"billboard":{"price":600,"obstacle":false,"fuelCap":0},"statue":{"price":0,"obstacle":false,"fuelCap":0,"up":{"spend":[0,2250,5650,10700,18500,30200,47700,73850,112900,171250],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"pond":{"price":1500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1150,2850,5400,9400,15400,24350,37650,57450,87000],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"pine":{"price":60,"obstacle":false,"fuelCap":0},"hedge":{"price":40,"obstacle":false,"fuelCap":0},"fence":{"price":30,"obstacle":false,"fuelCap":0},"picnic":{"price":90,"obstacle":false,"fuelCap":0},"busstop":{"price":200,"obstacle":false,"fuelCap":0},"hotdog":{"price":350,"obstacle":false,"fuelCap":0},"flagpole":{"price":300,"obstacle":false,"fuelCap":0},"arch":{"price":0,"obstacle":false,"fuelCap":0},"playground":{"price":1800,"obstacle":false,"fuelCap":0},"gazebo":{"price":1200,"obstacle":false,"fuelCap":0},"clocktower":{"price":3500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,2650,6600,12500,21550,35150,55500,85900,131350,199350],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"trailer":{"price":200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2750,4800,7900,12550,19600,30300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,1,2,3,4,5,6,7,8,9]}},"cottage":{"price":500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2750,4800,7900,12550,19600,30300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[1,2,3,4,5,6,7,8,9,10]}},"bungalow":{"price":1200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2750,4800,7900,12550,19600,30300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[1,2,3,4,5,6,7,8,9,10]}},"townhouse":{"price":2500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,650,1600,3100,5650,9550,15550,24700,38750,60250],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[2,3,4,5,6,7,8,9,10,11]}},"cabin":{"price":4000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1000,2550,4950,8850,14900,24250,38600,60700,94700],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[2,3,4,5,6,7,8,9,10,11]}},"duplex":{"price":7000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1750,4450,8650,15350,25750,41800,66550,104750,163750],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[3,4,5,6,7,8,9,10,11,12]}},"victorian":{"price":12000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3000,7650,14850,26200,43800,71050,113150,178250,278900],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[3,4,5,6,7,8,9,10,11,12]}},"condos":{"price":20000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,5000,12750,24750,43550,72700,117850,187700,295750,463050],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[4,5,6,7,8,9,10,11,12,13]}},"villa":{"price":35000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,8750,22300,43300,76100,126900,205600,327450,516100,808300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[5,6,7,8,9,10,11,12,13,14]}},"mansion":{"price":60000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,15000,38250,74300,130350,217250,351850,560350,883350,1383800],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[6,7,8,9,10,11,12,13,14,15]}},"junkyard":{"price":21000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,15750,39400,74850,128200,208250,328250,508150,777850,1182200],"coins":[126.67,150.36,178.42,213.43,248.37,287.39,333.58,385.2,448.7,511.06],"xp":[7,7.95,9.16,10.37,11.72,13.21,15.08,17.04,19.17,21.46],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"dogpark":{"price":1600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1200,3000,5700,9950,16350,25850,40000,61100,92550],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"skatepark":{"price":2400,"obstacle":false,"fuelCap":0},"koi":{"price":3000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,2250,5650,10700,18500,30200,47700,73850,112900,171250],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"garden":{"price":4800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3600,9000,17100,29450,48000,75750,117250,179350,272300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"pumpkins":{"price":250,"obstacle":false,"fuelCap":0},"scarecrow":{"price":450,"obstacle":false,"fuelCap":0},"graves":{"price":700,"obstacle":false,"fuelCap":0},"deadtree":{"price":1200,"obstacle":false,"fuelCap":0}},"goals":{"g0":{"coins":200,"xp":20,"bucks":0},"r1":{"coins":150,"xp":15,"bucks":0},"r2":{"coins":300,"xp":25,"bucks":15},"g1":{"coins":150,"xp":15,"bucks":0},"g2":{"coins":100,"xp":10,"bucks":0},"g3":{"coins":300,"xp":25,"bucks":0},"g4":{"coins":250,"xp":20,"bucks":0},"q1":{"coins":250,"xp":20,"bucks":0},"g5":{"coins":200,"xp":20,"bucks":0},"q2":{"coins":200,"xp":15,"bucks":0},"g6":{"coins":300,"xp":25,"bucks":0},"g7":{"coins":150,"xp":15,"bucks":0},"q3":{"coins":300,"xp":25,"bucks":0},"g8":{"coins":500,"xp":40,"bucks":15},"q4":{"coins":400,"xp":0,"bucks":0},"q5":{"coins":600,"xp":50,"bucks":0},"g9":{"coins":600,"xp":50,"bucks":0},"q6":{"coins":500,"xp":40,"bucks":0},"q7":{"coins":500,"xp":40,"bucks":0},"q8":{"coins":500,"xp":40,"bucks":0},"g10":{"coins":800,"xp":60,"bucks":15},"q9":{"coins":800,"xp":60,"bucks":0},"q10":{"coins":800,"xp":60,"bucks":0},"g11":{"coins":1000,"xp":70,"bucks":0},"q11":{"coins":1000,"xp":70,"bucks":0},"q12":{"coins":1000,"xp":0,"bucks":15},"gp1":{"coins":2000,"xp":150,"bucks":30},"q13":{"coins":1200,"xp":80,"bucks":0},"r3":{"coins":3000,"xp":200,"bucks":30},"q14":{"coins":1500,"xp":100,"bucks":0},"g12":{"coins":1200,"xp":80,"bucks":30},"q15":{"coins":2000,"xp":120,"bucks":0},"q16":{"coins":2000,"xp":120,"bucks":0},"q17":{"coins":2500,"xp":150,"bucks":15},"g13":{"coins":1500,"xp":100,"bucks":0},"q18":{"coins":2500,"xp":150,"bucks":0},"q19":{"coins":2500,"xp":150,"bucks":0},"g14":{"coins":2500,"xp":150,"bucks":30},"q20":{"coins":3000,"xp":0,"bucks":15},"q21":{"coins":3000,"xp":200,"bucks":0},"q22":{"coins":3000,"xp":200,"bucks":0},"g15":{"coins":5000,"xp":250,"bucks":45},"g16":{"coins":5000,"xp":250,"bucks":45},"q23":{"coins":6000,"xp":300,"bucks":30},"q24":{"coins":6000,"xp":300,"bucks":30},"q25":{"coins":6000,"xp":0,"bucks":30},"q26":{"coins":8000,"xp":400,"bucks":0},"q27":{"coins":8000,"xp":400,"bucks":30},"q28":{"coins":8000,"xp":400,"bucks":0},"q29":{"coins":10000,"xp":500,"bucks":30},"q30":{"coins":12000,"xp":600,"bucks":45},"q31":{"coins":12000,"xp":600,"bucks":30},"q32":{"coins":20000,"xp":800,"bucks":75},"q33":{"coins":20000,"xp":800,"bucks":45},"q34":{"coins":20000,"xp":0,"bucks":45},"q35":{"coins":30000,"xp":1000,"bucks":75},"q36":{"coins":30000,"xp":1000,"bucks":45},"q37":{"coins":30000,"xp":1000,"bucks":45},"q38":{"coins":50000,"xp":0,"bucks":75},"sp1":{"coins":300,"xp":25,"bucks":0},"sp2":{"coins":1000,"xp":60,"bucks":15},"sp3":{"coins":1500,"xp":80,"bucks":0},"sp4":{"coins":3000,"xp":150,"bucks":45}},"gp":{"rookie":{"unlock":2,"box":["trail","miata","woodie","cruiser"]},"street":{"unlock":2,"box":["stallion","rally","buggy","bandit"]},"pro":{"unlock":2,"box":["vette","charger","lemans"]},"legends":{"unlock":2,"box":["gtr","gullwing","shinden","lambo"]}},"rescue":{"pip":1,"civic":1,"bug":1,"woodie":1,"trail":1,"miata":1,"hauler":4,"buggy":4,"stallion":4,"cruiser":9,"rally":9,"bandit":9,"vette":9,"charger":15,"lemans":15,"gtr":15,"speedster":15,"gullwing":24,"hyper":24},"upgradeXpTo":[0,15,35,60,90,125,165,210,260,315],"mods":{"ducktail":{"slot":"spoiler","coins":1200,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":16,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"gtwing":{"slot":"spoiler","coins":4000,"parts":10,"bucks":0,"power":0,"grip":4,"weight":0,"xp":25,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"attackwing":{"slot":"spoiler","coins":0,"parts":0,"bucks":120,"power":0,"grip":6,"weight":0,"xp":46,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"twintips":{"slot":"exhaust","coins":1000,"parts":0,"bucks":0,"power":2,"grip":0,"weight":0,"xp":16},"sidepipes":{"slot":"exhaust","coins":3500,"parts":8,"bucks":0,"power":4,"grip":0,"weight":0,"xp":22},"flamepipes":{"slot":"exhaust","coins":0,"parts":0,"bucks":100,"power":6,"grip":0,"weight":0,"xp":46},"streetkit":{"slot":"kit","coins":1500,"parts":0,"bucks":0,"power":0,"grip":1,"weight":-2,"xp":19,"notOn":["scooter","chopper","sportbike"]},"widebody":{"slot":"kit","coins":6000,"parts":15,"bucks":0,"power":0,"grip":3,"weight":-3,"xp":28,"notOn":["scooter","chopper","sportbike"]},"carbonkit":{"slot":"kit","coins":0,"parts":0,"bucks":150,"power":0,"grip":3,"weight":-7,"xp":58,"notOn":["scooter","chopper","sportbike"]},"vented":{"slot":"hood","coins":800,"parts":0,"bucks":0,"power":1,"grip":0,"weight":-1,"xp":16,"notOn":["scooter","chopper","sportbike","formula"]},"ramscoop":{"slot":"hood","coins":3000,"parts":6,"bucks":0,"power":3,"grip":0,"weight":0,"xp":22,"notOn":["scooter","chopper","sportbike","formula"]},"blower":{"slot":"hood","coins":8000,"parts":20,"bucks":0,"power":5,"grip":0,"weight":0,"xp":31,"notOn":["scooter","chopper","sportbike","formula"]},"chrome":{"slot":"rims","coins":600,"parts":0,"bucks":0,"power":0,"grip":0,"weight":-1,"xp":13},"goldmesh":{"slot":"rims","coins":2500,"parts":5,"bucks":0,"power":0,"grip":1,"weight":-2,"xp":22},"luggage":{"slot":"spoiler","coins":2500,"parts":0,"bucks":0,"power":0,"grip":2,"weight":1,"xp":19,"only":["bus"]},"stacks":{"slot":"exhaust","coins":3000,"parts":5,"bucks":0,"power":3,"grip":0,"weight":-1,"xp":19,"only":["bus"]},"cowcatcher":{"slot":"kit","coins":3500,"parts":8,"bucks":0,"power":0,"grip":3,"weight":0,"xp":22,"only":["bus"]},"disco":{"slot":"hood","coins":0,"parts":0,"bucks":60,"power":4,"grip":0,"weight":0,"xp":25,"only":["bus"]},"flag":{"slot":"spoiler","coins":6000,"parts":10,"bucks":0,"power":0,"grip":3,"weight":0,"xp":40,"only":["tank"]},"smoke":{"slot":"exhaust","coins":0,"parts":0,"bucks":80,"power":5,"grip":0,"weight":0,"xp":40,"only":["tank"]},"reactive":{"slot":"kit","coins":9000,"parts":20,"bucks":0,"power":0,"grip":4,"weight":-1,"xp":40,"only":["tank"]},"watercannon":{"slot":"hood","coins":0,"parts":0,"bucks":120,"power":5,"grip":1,"weight":0,"xp":40,"only":["tank"]},"bigtail":{"slot":"spoiler","coins":1500,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":22,"only":["dogvan"]},"bubbles":{"slot":"exhaust","coins":0,"parts":0,"bucks":50,"power":4,"grip":0,"weight":0,"xp":22,"only":["dogvan"]},"collar":{"slot":"kit","coins":2000,"parts":4,"bucks":0,"power":0,"grip":2,"weight":0,"xp":22,"only":["dogvan"]},"bone":{"slot":"hood","coins":1200,"parts":0,"bucks":0,"power":1,"grip":0,"weight":-2,"xp":22,"only":["dogvan"]},"radar":{"slot":"spoiler","coins":4500,"parts":10,"bucks":0,"power":0,"grip":3,"weight":0,"xp":37,"only":["tusker"]},"snorkel":{"slot":"exhaust","coins":3000,"parts":6,"bucks":0,"power":3,"grip":0,"weight":-1,"xp":37,"only":["tusker"]},"plating":{"slot":"kit","coins":7000,"parts":15,"bucks":0,"power":0,"grip":4,"weight":-1,"xp":37,"only":["tusker"]},"lightbar":{"slot":"hood","coins":3500,"parts":6,"bucks":0,"power":4,"grip":0,"weight":0,"xp":37,"only":["tusker"]},"tailfairing":{"slot":"spoiler","coins":1500,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":16,"only":["scooter","chopper","sportbike"]},"saddlebags":{"slot":"kit","coins":1800,"parts":0,"bucks":0,"power":0,"grip":1,"weight":-1,"xp":16,"only":["scooter","chopper","sportbike"]},"windscreen":{"slot":"hood","coins":1200,"parts":0,"bucks":0,"power":1,"grip":0,"weight":0,"xp":16,"only":["scooter","chopper","sportbike"]},"campod":{"slot":"hood","coins":2000,"parts":4,"bucks":0,"power":1,"grip":0,"weight":0,"xp":43,"only":["formula"]},"bargeboards":{"slot":"kit","coins":0,"parts":0,"bucks":100,"power":0,"grip":4,"weight":-1,"xp":43,"only":["formula"]},"raintires":{"slot":"tires","coins":2500,"parts":4,"bucks":0,"power":0,"grip":0,"weight":0,"xp":19},"sandtires":{"slot":"tires","coins":3000,"parts":5,"bucks":0,"power":0,"grip":0,"weight":0,"xp":22},"snowstuds":{"slot":"tires","coins":3500,"parts":6,"bucks":0,"power":0,"grip":0,"weight":0,"xp":22},"allweather":{"slot":"tires","coins":0,"parts":0,"bucks":120,"power":0,"grip":0,"weight":0,"xp":31},"forged":{"slot":"rims","coins":7000,"parts":12,"bucks":0,"power":0,"grip":2,"weight":-3,"xp":31},"swanneck":{"slot":"spoiler","coins":12000,"parts":25,"bucks":0,"power":0,"grip":5,"weight":0,"xp":52,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"skydeck":{"slot":"spoiler","coins":0,"parts":0,"bucks":160,"power":0,"grip":7,"weight":0,"xp":64,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"roofrack":{"slot":"spoiler","coins":2500,"parts":4,"bucks":0,"power":0,"grip":3,"weight":1,"xp":25,"only":["truck","suv","van","wagon"]},"quadtips":{"slot":"exhaust","coins":2200,"parts":4,"bucks":0,"power":3,"grip":0,"weight":0,"xp":25},"zoomies":{"slot":"exhaust","coins":10000,"parts":20,"bucks":0,"power":5,"grip":0,"weight":0,"xp":43,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike","formula"]},"titan":{"slot":"exhaust","coins":0,"parts":0,"bucks":140,"power":6,"grip":0,"weight":-1,"xp":55},"rallykit":{"slot":"kit","coins":2800,"parts":5,"bucks":0,"power":0,"grip":2,"weight":-1,"xp":25,"notOn":["scooter","chopper","sportbike","formula"]},"boxflares":{"slot":"kit","coins":11000,"parts":22,"bucks":0,"power":0,"grip":4,"weight":-3,"xp":43,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike","formula","icecream","parcel","monster"]},"aerokit":{"slot":"kit","coins":0,"parts":0,"bucks":200,"power":0,"grip":4,"weight":-5,"xp":70,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike","formula","icecream","parcel","monster"]},"bullbar":{"slot":"kit","coins":2000,"parts":3,"bucks":0,"power":0,"grip":2,"weight":0,"xp":22,"only":["truck","suv","van","wagon","offroad"]},"cowl":{"slot":"hood","coins":1800,"parts":2,"bucks":0,"power":2,"grip":0,"weight":0,"xp":19,"notOn":["scooter","chopper","sportbike","formula"]},"louvres":{"slot":"hood","coins":9000,"parts":18,"bucks":0,"power":5,"grip":0,"weight":-1,"xp":37,"notOn":["scooter","chopper","sportbike","formula"]},"twinturbo":{"slot":"hood","coins":0,"parts":0,"bucks":160,"power":6,"grip":0,"weight":-1,"xp":58,"notOn":["scooter","chopper","sportbike","formula"]},"candy":{"slot":"rims","coins":1500,"parts":2,"bucks":0,"power":0,"grip":0,"weight":-2,"xp":19},"beadlock":{"slot":"rims","coins":4000,"parts":6,"bucks":0,"power":0,"grip":2,"weight":-1,"xp":28},"turbine":{"slot":"rims","coins":9000,"parts":15,"bucks":0,"power":0,"grip":2,"weight":-4,"xp":40},"goldwire":{"slot":"rims","coins":0,"parts":0,"bucks":100,"power":0,"grip":2,"weight":-5,"xp":52},"foglamps":{"slot":"lights","coins":1500,"parts":2,"bucks":0,"power":0,"grip":1,"weight":0,"xp":19,"notOn":["scooter","chopper","sportbike","formula"]},"roofbar":{"slot":"lights","coins":6000,"parts":10,"bucks":0,"power":0,"grip":2,"weight":0,"xp":31,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike","roadster","offroad","tusker","pontoon","bubble","formula"]},"underglow":{"slot":"lights","coins":0,"parts":0,"bucks":120,"power":1,"grip":1,"weight":0,"xp":40,"notOn":["scooter","chopper","sportbike","formula","tank"]},"lowered":{"slot":"stance","coins":2500,"parts":4,"bucks":0,"power":0,"grip":1,"weight":0,"xp":22,"notOn":["scooter","chopper","sportbike","formula","tank"]},"lifted":{"slot":"stance","coins":4500,"parts":8,"bucks":0,"power":0,"grip":2,"weight":1,"xp":28,"notOn":["scooter","chopper","sportbike","formula","tank"]},"slammed":{"slot":"stance","coins":0,"parts":0,"bucks":120,"power":0,"grip":2,"weight":-1,"xp":46,"notOn":["scooter","chopper","sportbike","formula","tank"]}},"driverBonus":0.25,"campaign":{"c1":{"unlock":1,"races":["c1-0","c1-1","c1-2","c1-3","c1-4"],"coins":1000,"bucks":15,"trophies":3,"starBucks":15},"c2":{"unlock":1,"races":["c2-0","c2-1","c2-2","c2-3","c2-4"],"coins":2000,"bucks":15,"trophies":3,"starBucks":15},"c3":{"unlock":1,"races":["c3-0","c3-1","c3-2","c3-3","c3-4"],"coins":3500,"bucks":30,"trophies":4,"starBucks":15},"c4":{"unlock":1,"races":["c4-0","c4-1","c4-2","c4-3","c4-4"],"coins":5500,"bucks":30,"trophies":5,"starBucks":30},"c5":{"unlock":1,"races":["c5-0","c5-1","c5-2","c5-3","c5-4"],"coins":8000,"bucks":45,"trophies":6,"starBucks":30},"c6":{"unlock":1,"races":["c6-0","c6-1","c6-2","c6-3","c6-4"],"coins":12000,"bucks":45,"trophies":8,"starBucks":30},"c7":{"unlock":1,"races":["c7-0","c7-1","c7-2","c7-3","c7-4"],"coins":20000,"bucks":75,"trophies":10,"starBucks":45}},"sets":{"daily":{"cars":["pip","civic","trail","miata"],"coins":1500,"bucks":30,"trophies":5,"xp":60},"bikes":{"cars":["zippy","baron","shinden"],"coins":4000,"bucks":45,"trophies":10,"xp":120},"classics":{"cars":["bug","woodie","hauler","cruiser","buggy"],"coins":5000,"bucks":75,"trophies":15,"xp":150},"muscle":{"cars":["stallion","charger","hellcat","bandit"],"coins":8000,"bucks":75,"trophies":15,"xp":200},"track":{"cars":["rally","vette","gtr","lemans","gullwing"],"coins":15000,"bucks":120,"trophies":25,"xp":300},"roadtrip":{"cars":["camper","ridgeback","stomper","shaggy"],"coins":6000,"bucks":60,"trophies":12,"xp":160},"tuners":{"cars":["hotshot","kitsune","current"],"coins":7000,"bucks":60,"trophies":12,"xp":180},"grandtour":{"cars":["salon","speedster","monoposto"],"coins":20000,"bucks":150,"trophies":30,"xp":350},"heavy":{"cars":["schoolbus","tusker"],"coins":6000,"bucks":45,"trophies":10,"xp":150},"dream":{"cars":["lambo","hyper","tomahawk","zenith"],"coins":30000,"bucks":225,"trophies":40,"xp":500},"autobahn":{"cars":["kreis","bergmeister","ringmeister","sovereign"],"coins":20000,"bucks":150,"trophies":30,"xp":350},"apex":{"cars":["rattler","cottonmouth","raiden","wraith"],"coins":30000,"bucks":225,"trophies":40,"xp":500},"oddballs":{"cars":["scoops","courier","crusher"],"coins":4000,"bucks":45,"trophies":8,"xp":120},"restomods":{"cars":["sprint","revenant","pontone"],"coins":30000,"bucks":225,"trophies":40,"xp":500},"exotica":{"cars":["fulmine","eclat","orafo"],"coins":40000,"bucks":300,"trophies":50,"xp":600},"carpacks":{"cars":["scatto","stinger","thunderjet","sora","hayate","kestrel","firebolt","kaze","sturm","vanta"],"coins":40000,"bucks":300,"trophies":50,"xp":600},"seasons":{"cars":["nightfall"],"coins":5000,"bucks":45,"trophies":10,"xp":150},"rusty-suburbs":{"cars":["pip","civic","bug","woodie","trail","miata"],"coins":2500,"bucks":30,"trophies":5,"xp":80},"rusty-farm":{"cars":["bug","trail","hauler","woodie","buggy","stallion"],"coins":5000,"bucks":45,"trophies":8,"xp":120},"rusty-downtown":{"cars":["civic","cruiser","rally","bandit","stallion","vette"],"coins":10000,"bucks":60,"trophies":12,"xp":180},"rusty-desert":{"cars":["buggy","bandit","stallion","charger","lemans","gtr","speedster"],"coins":20000,"bucks":90,"trophies":20,"xp":260},"rusty-track":{"cars":["vette","lemans","charger","gullwing","gtr","hyper"],"coins":40000,"bucks":150,"trophies":30,"xp":400}},"quests":{"daily":{"count":3,"task":{"coins":150,"coinsPerLevel":50,"xp":20,"xpPerLevel":5},"chest":{"coins":300,"coinsPerLevel":100,"xp":0,"xpPerLevel":0,"parts":5,"bucks":10,"fuel":10}},"weekly":{"count":3,"task":{"coins":500,"coinsPerLevel":150,"xp":100,"xpPerLevel":20},"chest":{"coins":1000,"coinsPerLevel":250,"xp":0,"xpPerLevel":0,"parts":20,"bucks":45,"fuel":0}}},"season":{"start":"2026-10-05","days":42,"perTier":8,"stars":{"dailyTask":1,"dailyChest":3,"weeklyTask":3,"weeklyChest":6},"tiers":[{"coins":650,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":5,"bucks":0,"car":false},{"coins":950,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":7,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":30,"car":false},{"coins":0,"parts":9,"bucks":0,"car":false},{"coins":1550,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":9,"bucks":0,"car":false},{"coins":1850,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":45,"car":false},{"coins":2150,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":13,"bucks":0,"car":false},{"coins":2450,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":13,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":60,"car":false},{"coins":0,"parts":15,"bucks":0,"car":false},{"coins":3050,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":17,"bucks":0,"car":false},{"coins":3350,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":75,"car":false},{"coins":3650,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":19,"bucks":0,"car":false},{"coins":3950,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":21,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":90,"car":false},{"coins":0,"parts":21,"bucks":0,"car":false},{"coins":4550,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":23,"bucks":0,"car":false},{"coins":4850,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":0,"car":true}],"carBucks":225,"cars":{"1":"nightfall"}},"deals":{"slots":[["parts10","fuel","parts25","parts50"],["mod-chrome","mod-twintips","mod-vented","mod-ducktail","mod-streetkit","paint-matte","mod-goldmesh","mod-ramscoop","mod-sidepipes","mod-gtwing","mod-widebody","mod-blower","mod-forged","paint-chrome"],["decor-fountain","decor-pond","decor-playground","decor-gazebo","decor-clocktower","decor-billboard","decor-hotdog","decor-statue"]],"step":[3,5,3],"save":{"parts10":200,"fuel":0,"parts25":500,"parts50":1000,"mod-chrome":240,"mod-twintips":400,"mod-vented":320,"mod-ducktail":480,"mod-streetkit":600,"paint-matte":0,"mod-goldmesh":750,"mod-ramscoop":900,"mod-sidepipes":1050,"mod-gtwing":1200,"mod-widebody":1800,"mod-blower":2400,"mod-forged":2100,"paint-chrome":0,"decor-fountain":320,"decor-pond":600,"decor-playground":720,"decor-gazebo":480,"decor-clocktower":1400,"decor-billboard":240,"decor-hotdog":140,"decor-statue":0}},"crew":{"chest":{"coins":1500,"coinsPerLevel":300,"xp":0,"xpPerLevel":0,"parts":25,"bucks":75,"fuel":0}},"rivals":{"vinnie":{"unlock":2,"coins":1500,"bucks":15,"trophies":3},"polly":{"unlock":2,"coins":2500,"bucks":15,"trophies":3},"duke":{"unlock":2,"coins":4000,"bucks":30,"trophies":4},"roxy":{"unlock":2,"coins":6500,"bucks":30,"trophies":5},"clutchula":{"unlock":2,"coins":10000,"bucks":45,"trophies":6},"nova":{"unlock":2,"coins":15000,"bucks":45,"trophies":8}},"mastery":{"tiers":[{"bucks":15,"trophies":0,"races":10,"wins":0,"modes":0,"upsets":0},{"bucks":15,"trophies":0,"races":0,"wins":10,"modes":0,"upsets":0},{"bucks":15,"trophies":0,"races":0,"wins":0,"modes":3,"upsets":0},{"bucks":30,"trophies":5,"races":0,"wins":0,"modes":0,"upsets":5}]},"road":{"step":25,"stops":[{"coins":2000,"parts":5},{"coins":3500,"parts":7},{"coins":5200,"parts":8},{"coins":6900,"parts":10},{"coins":8600,"parts":11},{"coins":10500,"parts":13},{"coins":12400,"parts":14},{"coins":14500,"parts":16},{"coins":16600,"parts":17},{"coins":18700,"parts":19},{"coins":21000,"parts":20},{"coins":23300,"parts":22},{"coins":25800,"parts":23},{"coins":28300,"parts":25},{"coins":30800,"parts":26},{"coins":33500,"parts":28},{"coins":36200,"parts":29},{"coins":39100,"parts":31},{"coins":42000,"parts":32},{"coins":44900,"parts":34},{"coins":48000,"parts":35},{"coins":51100,"parts":37},{"coins":54400,"parts":38},{"coins":57700,"parts":40},{"coins":61000,"parts":41},{"coins":64500,"parts":43},{"coins":68000,"parts":44},{"coins":71700,"parts":46},{"coins":75400,"parts":47},{"coins":79100,"parts":49},{"coins":83000,"parts":50},{"coins":86900,"parts":52},{"coins":91000,"parts":53},{"coins":95100,"parts":55},{"coins":99200,"parts":56},{"coins":103500,"parts":58},{"coins":107800,"parts":59},{"coins":112300,"parts":61},{"coins":116800,"parts":62},{"coins":121300,"parts":64},{"coins":126000,"parts":65},{"coins":130700,"parts":67},{"coins":135600,"parts":68},{"coins":140500,"parts":70},{"coins":145400,"parts":71},{"coins":150500,"parts":73},{"coins":155600,"parts":74},{"coins":160900,"parts":76},{"coins":166200,"parts":77},{"coins":171500,"parts":79},{"coins":177000,"parts":80},{"coins":182500,"parts":82},{"coins":188200,"parts":83},{"coins":193900,"parts":85},{"coins":199600,"parts":86},{"coins":205500,"parts":88},{"coins":211400,"parts":89},{"coins":217500,"parts":91},{"coins":223600,"parts":92},{"coins":229700,"parts":94}],"after":{"coins":236000,"parts":95}}}$catalog$::jsonb
-- catalog:end
$$;

CREATE OR REPLACE FUNCTION public.econ_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  g_lvl int;
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
  restored2 text; -- the car leaving bay 2
  out_car text;
  bk text;
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
  o_q jsonb;
  s_q jsonb;
  qc jsonb;
  q_lvl int;
  q_key text;
  q_okey text;
  q_same boolean;
  q_n int;
  q_on int;
  q_coins numeric := 0;
  q_xp numeric := 0;
  q_parts numeric := 0;
  q_bucks numeric := 0;
  en_o jsonb;
  en_s jsonb;
  en_pay jsonb;
  en_day text;
  en_oday text;
  en_n int;
  en_on int;
  en_t int;
  en_ot int;
  en_lvl int;
  pur_o int;
  pur_n int;
  pur_p jsonb;
  pay_bucks numeric := 0;
  pay_coins numeric := 0;
  pay_parts numeric := 0;
  per record;
  sc jsonb;
  sea_n int;
  sea_earn numeric := 0;
  sea_same boolean;
  o_sea jsonb;
  s_sea jsonb;
  sea_stars numeric;
  o_tiers jsonb;
  new_tiers int[];
  sea_coins numeric := 0;
  sea_parts numeric := 0;
  sea_bucks numeric := 0;
  sea_car text;
  sea_car_uid text;
  sea_value numeric := 0;
  owed numeric;
  rc jsonb;
  spent numeric;
  d_day text;
  d_old jsonb;
  d_ids text[];
  d_n bigint;
  deal_save numeric := 0;
  o_tr jsonb;
  tr jsonb;
  tr_place int;
  tr_prize jsonb;
  tr_coins numeric := 0;
  tr_bucks numeric := 0;
  tr_trophies numeric := 0;
  cc_o numeric;
  cc_n numeric;
  cc_max numeric;
  cc_lvl int;
  ccp jsonb;
  v_o numeric;
  v_n numeric;
  v_max numeric;
  vp jsonb;
  o_riv jsonb;
  riv jsonb;
  rb_o numeric;
  rb_n numeric;
  rb_sent numeric;
  gp_free boolean := false;
  lock_price numeric;
  lock_bucks numeric;
  cr_o int;
  cr_n int;
  cr_p jsonb;
  cr_uids text[] := '{}';
  cr_mods jsonb := '[]';
  cr_net numeric := 0;
  cr_bucks numeric := 0;
  o_mas jsonb;
  mas jsonb;
  mo jsonb;
  mt jsonb;
  m_races numeric;
  m_wins numeric;
  m_modes jsonb;
  m_upsets numeric;
  m_old int;
  m_tier int;
  m_ok int;
  ms_wins numeric := 0;
  ms_bucks numeric := 0;
  ms_trophies numeric := 0;
  rd_o numeric;
  rd_n numeric;
  rd_max numeric;
  rd_i int;
  rd_p jsonb;
  rd_coins numeric := 0;
  rd_parts numeric := 0;
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

    -- Daily and weekly tasks: each UTC day and each ISO week pays at most `count` task rewards, plus one
    -- chest once all of them are collected. Rewards scale with level. A period can only move forward
    -- (to tomorrow at most, for clocks ahead of UTC), and collected tasks and opened chests stay that way.
    -- A save without tasks (a client older than them) keeps the saved ones.
    o_q := case when jsonb_typeof(o -> 'quests') = 'object' then o -> 'quests' else '{}' end;
    if jsonb_typeof(s -> 'quests') is distinct from 'object' then
      if o_q <> '{}' then s := jsonb_set(s, '{quests}', o_q); end if;
    else
      s_q := s -> 'quests';
      q_lvl := least(greatest(floor(public.econ_num(s, 'level'))::int, o_lvl), o_lvl + 2);
      for per in select * from (values
          ('daily', 'day', 'dayDone', 'dayChest', '^\d{4}-\d{2}-\d{2}$', to_char((now() at time zone 'utc') + interval '1 day', 'YYYY-MM-DD')),
          ('weekly', 'week', 'weekDone', 'weekChest', '^\d{4}-W\d{2}$', to_char((now() at time zone 'utc') + interval '1 day', 'IYYY-"W"IW'))
        ) v(cat_key, k, done, chest, pat, max_key) loop
        qc := cat -> 'quests' -> per.cat_key;
        q_key := s_q ->> per.k;
        q_okey := o_q ->> per.k;
        q_same := q_key is not distinct from q_okey;
        q_n := case when jsonb_typeof(s_q -> per.done) = 'array' then jsonb_array_length(s_q -> per.done) else 0 end;
        q_on := case when q_same and jsonb_typeof(o_q -> per.done) = 'array' then jsonb_array_length(o_q -> per.done) else 0 end;
        if qc is null or q_key is null or q_key !~ per.pat or q_key > per.max_key or (q_okey is not null and q_key < q_okey) or q_n < q_on then
          -- A bad or backdated period keeps the last saved one.
          if not q_same or q_n <> q_on or (s_q -> per.chest) is distinct from (o_q -> per.chest) then
            s_q := s_q || jsonb_build_object(per.k, o_q -> per.k, per.done, coalesce(o_q -> per.done, '[]'), per.chest, coalesce(o_q -> per.chest, 'false'));
            fixes := fixes || jsonb_build_object(per.k, 'kept saved tasks');
          end if;
        else
          q_n := least(q_n, (qc ->> 'count')::int);
          q_on := least(q_on, (qc ->> 'count')::int);
          q_coins := q_coins + (q_n - q_on) * ((qc -> 'task' ->> 'coins')::numeric + (qc -> 'task' ->> 'coinsPerLevel')::numeric * q_lvl);
          sea_earn := sea_earn + greatest(q_n - q_on, 0) * coalesce((cat -> 'season' -> 'stars' ->> (per.cat_key || 'Task'))::numeric, 0);
          q_xp := q_xp + (q_n - q_on) * ((qc -> 'task' ->> 'xp')::numeric + (qc -> 'task' ->> 'xpPerLevel')::numeric * q_lvl);
          if q_same and o_q -> per.chest = 'true'::jsonb then
            if s_q -> per.chest is distinct from 'true'::jsonb then
              s_q := jsonb_set(s_q, array[per.chest], 'true');
            end if;
          elsif s_q -> per.chest = 'true'::jsonb then
            if q_n >= (qc ->> 'count')::int then
              q_coins := q_coins + (qc -> 'chest' ->> 'coins')::numeric + (qc -> 'chest' ->> 'coinsPerLevel')::numeric * q_lvl;
              q_xp := q_xp + (qc -> 'chest' ->> 'xp')::numeric + (qc -> 'chest' ->> 'xpPerLevel')::numeric * q_lvl;
              q_parts := q_parts + (qc -> 'chest' ->> 'parts')::numeric;
              q_bucks := q_bucks + (qc -> 'chest' ->> 'bucks')::numeric;
              sea_earn := sea_earn + coalesce((cat -> 'season' -> 'stars' ->> (per.cat_key || 'Chest'))::numeric, 0);
            else
              s_q := jsonb_set(s_q, array[per.chest], 'false');
              fixes := fixes || jsonb_build_object(per.chest, 'tasks not done');
            end if;
          end if;
        end if;
      end loop;
      s := jsonb_set(s, '{quests}', s_q);
    end if;
    -- Crew chests: `crewChests` counts the crew chests this save has opened. Each one needs a row in
    -- public.crew_chests (open_crew_chest writes it after checking the crew's weekly goal) and pays
    -- catalog crew.chest at the player's level. The count never goes down; a save without it keeps the old one.
    cc_o := greatest(floor(public.econ_num(o, 'crewChests')), 0);
    if jsonb_typeof(s -> 'crewChests') is distinct from 'number' then
      if o ? 'crewChests' then s := jsonb_set(s, '{crewChests}', to_jsonb(cc_o)); end if;
    else
      cc_n := floor(public.econ_num(s, 'crewChests'));
      -- (Until crew_weekly_goal.sql has run there's no table, so no new chests.)
      cc_max := cc_o;
      if to_regclass('public.crew_chests') is not null then
        cc_max := greatest((select count(*) from public.crew_chests where owner_id = new.owner_id), cc_o);
      end if;
      if cc_n < cc_o or cc_n > cc_max then
        fixes := fixes || jsonb_build_object('crewChests', jsonb_build_object('sent', cc_n, 'kept', least(greatest(cc_n, cc_o), cc_max)));
        cc_n := least(greatest(cc_n, cc_o), cc_max);
        s := jsonb_set(s, '{crewChests}', to_jsonb(cc_n));
      end if;
      ccp := cat -> 'crew' -> 'chest';
      if cc_n > cc_o and ccp is not null then
        cc_lvl := least(greatest(floor(public.econ_num(s, 'level'))::int, o_lvl), o_lvl + 2);
        q_coins := q_coins + (cc_n - cc_o) * ((ccp ->> 'coins')::numeric + (ccp ->> 'coinsPerLevel')::numeric * cc_lvl);
        q_xp := q_xp + (cc_n - cc_o) * ((ccp ->> 'xp')::numeric + (ccp ->> 'xpPerLevel')::numeric * cc_lvl);
        q_parts := q_parts + (cc_n - cc_o) * (ccp ->> 'parts')::numeric;
        q_bucks := q_bucks + (cc_n - cc_o) * (ccp ->> 'bucks')::numeric;
      end if;
    end if;
    -- Town visitors: `visits` is the claim number (visitor_claim() in town_visitors.sql) of the latest
    -- visitor prize this save collected. Each claim it newly counts pays that claim's prize, from
    -- econ_private.visit_pay(). It never goes down or past the claims made; a save without it keeps the old one.
    v_o := greatest(floor(public.econ_num(o, 'visits')), 0);
    if jsonb_typeof(s -> 'visits') is distinct from 'number' then
      if o ? 'visits' then s := jsonb_set(s, '{visits}', to_jsonb(v_o)); end if;
    else
      v_n := floor(public.econ_num(s, 'visits'));
      -- (Until town_visitors.sql has run there are no claims.)
      v_max := v_o;
      if to_regprocedure('econ_private.visit_pay(integer,integer)') is not null then
        v_max := greatest((econ_private.visit_pay(0, 0) ->> 'n')::numeric, v_o);
      end if;
      if v_n < v_o or v_n > v_max then
        fixes := fixes || jsonb_build_object('visits', jsonb_build_object('sent', v_n, 'kept', least(greatest(v_n, v_o), v_max)));
        v_n := least(greatest(v_n, v_o), v_max);
        s := jsonb_set(s, '{visits}', to_jsonb(v_n));
      end if;
      if v_n > v_o then
        vp := econ_private.visit_pay(v_o::int, v_n::int);
        q_coins := q_coins + (vp ->> 'coins')::numeric;
        q_xp := q_xp + (vp ->> 'xp')::numeric;
        q_parts := q_parts + (vp ->> 'parts')::numeric;
        q_bucks := q_bucks + (vp ->> 'bucks')::numeric;
      end if;
    end if;
    -- Endless goals (0108): `endless` is {day, today, n, goals}. n counts the endless goals this town has
    -- collected and today those collected on `day` (UTC). Each one newly counted pays
    -- econ_private.endless_pay() at the save's level: coins and XP, parts every partsEvery-th and gems
    -- every bucksEvery-th. At most perDay a day; n and today only go up within a day, the day only moves
    -- forward (to tomorrow at most), and a new day may also carry the last day's unsaved ones (up to that day's perDay).
    -- A save without it (a client older than endless goals) keeps the saved one.
    en_o := case when jsonb_typeof(o -> 'endless') = 'object' then o -> 'endless' else '{}' end;
    if jsonb_typeof(s -> 'endless') is distinct from 'object' then
      if en_o <> '{}' then s := jsonb_set(s, '{endless}', en_o); end if;
    elsif to_regprocedure('econ_private.endless_pay()') is not null then
      en_s := s -> 'endless';
      en_pay := econ_private.endless_pay();
      en_day := en_s ->> 'day';
      en_oday := nullif(en_o ->> 'day', '');
      en_n := floor(public.econ_num(en_s, 'n'))::int;
      en_on := greatest(floor(public.econ_num(en_o, 'n')), 0)::int;
      en_t := floor(public.econ_num(en_s, 'today'))::int;
      en_ot := case when en_day is not distinct from en_oday then greatest(floor(public.econ_num(en_o, 'today')), 0)::int else 0 end;
      if en_n = en_on and en_day is not distinct from (en_o ->> 'day') and en_t = floor(public.econ_num(en_o, 'today')) then
        null; -- nothing collected
      elsif en_day is null or en_day !~ '^\d{4}-\d{2}-\d{2}$' or en_day > to_char((now() at time zone 'utc') + interval '1 day', 'YYYY-MM-DD')
         or (en_oday is not null and en_day < en_oday) or en_n < en_on or en_t < en_ot or en_t > (en_pay ->> 'perDay')::int
         or en_n - en_on > en_t - en_ot + (case when en_day is distinct from en_oday then greatest((en_pay ->> 'perDay')::int - floor(public.econ_num(en_o, 'today'))::int, 0) else 0 end) then
        -- A bad count or day keeps the saved count and day (the goals on the board stay as sent).
        s := jsonb_set(s, '{endless}', en_s || jsonb_build_object('n', en_on, 'day', coalesce(en_o -> 'day', '""'), 'today', coalesce(en_o -> 'today', '0')));
        fixes := fixes || '{"endless":"kept saved endless goals"}';
      else
        en_lvl := least(greatest(floor(public.econ_num(s, 'level'))::int, o_lvl), o_lvl + 2);
        for k in en_on + 1 .. en_n loop
          q_coins := q_coins + (en_pay ->> 'coins')::numeric + (en_pay ->> 'coinsPerLevel')::numeric * en_lvl;
          q_xp := q_xp + (en_pay ->> 'xp')::numeric + (en_pay ->> 'xpPerLevel')::numeric * en_lvl;
          if k % (en_pay ->> 'partsEvery')::int = 0 then q_parts := q_parts + (en_pay ->> 'parts')::numeric; end if;
          if k % (en_pay ->> 'bucksEvery')::int = 0 then q_bucks := q_bucks + (en_pay ->> 'bucks')::numeric; end if;
        end loop;
      end if;
    end if;
    goal_xp := goal_xp + q_xp;

    -- Gem packs (0078): `purchases` is the seq of the last paid pack (public.purchases, written by the
    -- Stripe webhook through purchase_record()) this save added. It never goes down or past the packs
    -- paid, and packs it newly counts pay their gems, coins and parts. A town started after a reset
    -- begins after the packs bought before the reset, so a reset never pays a pack twice.
    pur_o := greatest(floor(public.econ_num(o, 'purchases')), 0)::int;
    if jsonb_typeof(s -> 'purchases') = 'number' or o ? 'purchases' or tg_op = 'INSERT' then
      pur_p := econ_private.purchase_pay(pur_o, pur_o);
      if tg_op = 'INSERT' then pur_o := greatest(pur_o, (pur_p ->> 'reset')::int); end if;
      pur_n := least(greatest(floor(public.econ_num(s, 'purchases'))::int, pur_o), greatest((pur_p ->> 'n')::int, pur_o));
      if s ? 'purchases' and pur_n is distinct from public.econ_num(s, 'purchases') then
        fixes := fixes || jsonb_build_object('purchases', jsonb_build_object('sent', s -> 'purchases', 'kept', pur_n));
      end if;
      if pur_n > 0 or s ? 'purchases' or o ? 'purchases' then
        s := jsonb_set(s, '{purchases}', to_jsonb(pur_n));
      end if;
      if pur_n > pur_o then
        pur_p := econ_private.purchase_pay(pur_o, pur_n);
        pay_bucks := (pur_p ->> 'bucks')::numeric;
        pay_coins := (pur_p ->> 'coins')::numeric;
        pay_parts := (pur_p ->> 'parts')::numeric;
      end if;
    end if;

    -- Season track: stars come only from the task rewards and chests collected in this save (counted
    -- above), and a new season starts from zero. A newly collected tier must have its stars and pays
    -- its prize once. The last tier gives the season's car, the only way to get one (or bucks when the
    -- season has no car). A save without a season (a client older than it) keeps the saved one.
    sc := cat -> 'season';
    o_sea := case when jsonb_typeof(o -> 'season') = 'object' then o -> 'season' else '{}' end;
    if sc is not null then
      sea_n := greatest(floor((now_s - extract(epoch from (sc ->> 'start')::date)) / ((sc ->> 'days')::numeric * 86400)) + 1, 1)::int;
      if jsonb_typeof(s -> 'season') is distinct from 'object' and sea_earn = 0 then
        if o_sea <> '{}' then s := jsonb_set(s, '{season}', o_sea); end if;
      else
        -- (A page from before the season track sends no season: it gets the stars it earned.)
        s_sea := case when jsonb_typeof(s -> 'season') = 'object' then s -> 'season'
                      when public.econ_num(o_sea, 'n') = sea_n then o_sea || jsonb_build_object('stars', public.econ_num(o_sea, 'stars') + sea_earn)
                      else jsonb_build_object('n', sea_n, 'stars', sea_earn, 'claimed', '[]'::jsonb) end;
        sea_same := public.econ_num(o_sea, 'n') = sea_n;
        sea_stars := least(greatest(floor(public.econ_num(s_sea, 'stars')), 0),
                           case when sea_same then public.econ_num(o_sea, 'stars') else 0 end + sea_earn);
        o_tiers := case when sea_same and jsonb_typeof(o_sea -> 'claimed') = 'array' then o_sea -> 'claimed' else '[]' end;
        select coalesce(array_agg(distinct t), '{}') into new_tiers from (
          select (x #>> '{}')::int t from jsonb_array_elements(case when jsonb_typeof(s_sea -> 'claimed') = 'array' then s_sea -> 'claimed' else '[]' end) x
          where jsonb_typeof(x) = 'number' and (x #>> '{}') ~ '^\d+$') q
          where t < jsonb_array_length(sc -> 'tiers') and not o_tiers @> to_jsonb(t) and (t + 1) * (sc ->> 'perTier')::numeric <= sea_stars;
        select coalesce(sum((sc -> 'tiers' -> t ->> 'coins')::numeric), 0), coalesce(sum((sc -> 'tiers' -> t ->> 'parts')::numeric), 0),
               coalesce(sum((sc -> 'tiers' -> t ->> 'bucks')::numeric), 0)
          into sea_coins, sea_parts, sea_bucks from unnest(new_tiers) t;
        if exists (select 1 from unnest(new_tiers) t where (sc -> 'tiers' -> t ->> 'car')::boolean) then
          sea_car := sc -> 'cars' ->> sea_n::text;
          if sea_car is null then sea_bucks := sea_bucks + (sc ->> 'carBucks')::numeric; end if;
        end if;
        if public.econ_num(s_sea, 'n') <> sea_n or public.econ_num(s_sea, 'stars') <> sea_stars
           or jsonb_array_length(case when jsonb_typeof(s_sea -> 'claimed') = 'array' then s_sea -> 'claimed' else '[]' end)
              <> jsonb_array_length(o_tiers) + cardinality(new_tiers) then
          fixes := fixes || jsonb_build_object('season', jsonb_build_object('stars', sea_stars));
        end if;
        s := jsonb_set(s, '{season}', jsonb_build_object('n', sea_n, 'stars', sea_stars,
          'claimed', o_tiers || coalesce((select jsonb_agg(t order by t) from unnest(new_tiers) t), '[]')));
      end if;
      -- New season cars: only this season's, one, and only with its tier collected in this save.
      for r in select x from jsonb_array_elements(cars) x
               where not (x ->> 'uid') = any(o_uids)
                 and exists (select 1 from jsonb_each_text(coalesce(sc -> 'cars', '{}')) k where k.value = x ->> 'model') loop
        if sea_car_uid is null and r.x ->> 'model' = sea_car then
          sea_car_uid := r.x ->> 'uid';
          sea_value := (cat -> 'cars' -> sea_car ->> 'price')::numeric;
        else
          cars := (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(cars) y where y ->> 'uid' <> r.x ->> 'uid');
          fixes := fixes || jsonb_build_object('season_car', r.x ->> 'model');
        end if;
      end loop;
      s := jsonb_set(s, '{cars}', cars);
    end if;

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
    -- The level locks below (race series, campaign, rivals, Rusty's finds, cars) read g_lvl: the
    -- player's level, or past every lock for an admin saving their own town (0099). is_admin() is
    -- only asked for signed-in players (anon can't run it).
    g_lvl := n_lvl;
    if current_user = 'authenticated' then
      if new.owner_id = auth.uid() and public.is_admin() then g_lvl := 999; end if;
    end if;
    select coalesce(sum(l * 100), 0) into levelup_coins from generate_series(o_lvl + 1, n_lvl) l;

    -- Daily check-in (0069): once per UTC day, one day along whether or not yesterday was
    -- collected; dailyStreak counts days collected and the calendar loops after day 5.
    od := o ->> 'lastDaily';
    nd := s ->> 'lastDaily';
    if nd is distinct from od then
      if nd ~ '^\d{4}-\d{2}-\d{2}$' and (od is null or nd > od) and nd::date <= (now() at time zone 'utc')::date + 1 then
        streak := greatest(floor(public.econ_num(o, 'dailyStreak'))::int, 0) + 1;
        if public.econ_num(s, 'dailyStreak') > streak then
          s := jsonb_set(s, '{dailyStreak}', to_jsonb(streak));
          fixes := fixes || '{"dailyStreak":"too long"}';
        end if;
        streak := mod(greatest(floor(public.econ_num(s, 'dailyStreak'))::int, 1) - 1, 5) + 1;
        daily_coins := (array[200, 400, 600, 800 + 5 * 50, 1200])[streak];
      else
        s := s || jsonb_build_object('lastDaily', o -> 'lastDaily', 'dailyStreak', coalesce(o -> 'dailyStreak', '0'));
        fixes := fixes || '{"lastDaily":"already claimed"}';
      end if;
    end if;

    -- A finished Grand Prix series pays a mystery box car and 5 trophies, at most once every two minutes.
    if g_lvl >= 2 and now_s - coalesce((e ->> 'gp_at')::numeric, 0) >= 120 then
      select k into gp_series from jsonb_each(cat -> 'gp') g(k, v)
        where g_lvl >= (v ->> 'unlock')::int
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
             from jsonb_each(coalesce(cat -> 'campaign', '{}')) g(k, v) where g_lvl >= (v ->> 'unlock')::int loop
      if r.n_min >= 1 and r.o_min < 1 then
        camp_coins := camp_coins + (r.v ->> 'coins')::numeric;
        camp_bucks := camp_bucks + (r.v ->> 'bucks')::numeric;
        camp_trophies := camp_trophies + (r.v ->> 'trophies')::numeric;
      end if;
      if r.n_min >= 3 and r.o_min < 3 then
        camp_bucks := camp_bucks + (r.v ->> 'starBucks')::numeric;
      end if;
    end loop;

    -- Town rivals: each rival's `beaten` count (0-3) never drops and goes up by at most one per visit
    -- (a beaten rival is back in 30 minutes, so 25 apart by the server clock). Ids the catalog doesn't
    -- know are dropped; `back` (the game's cooldown) passes through. The third win pays the rival's
    -- one-time bonus, if the level has unlocked it. A save with no rivals (an older page) keeps the old.
    o_riv := case when jsonb_typeof(o -> 'rivals') = 'object' then o -> 'rivals' else '{}' end;
    if jsonb_typeof(s -> 'rivals') is distinct from 'object' then
      if o_riv <> '{}' then s := jsonb_set(s, '{rivals}', o_riv); end if;
    else
      riv := '{}';
      for r in select e2.key k, e2.value v from jsonb_each(case when jsonb_typeof(cat -> 'rivals') = 'object' then cat -> 'rivals' else '{}' end) e2 loop
        rb_o := least(greatest(floor(public.econ_num(o_riv -> r.k, 'beaten')), 0), 3);
        rb_sent := least(greatest(floor(public.econ_num(s -> 'rivals' -> r.k, 'beaten')), 0), 3);
        rb_n := rb_sent;
        if rb_n < rb_o then
          rb_n := rb_o;
          fixes := fixes || '{"rivals":"kept rivals beaten"}';
        elsif rb_n > rb_o then
          if now_s - coalesce((e -> 'riv' ->> r.k)::numeric, 0) < 1500 then
            rb_n := rb_o;
          else
            rb_n := rb_o + 1;
            e := jsonb_set(e, '{riv}', coalesce(e -> 'riv', '{}') || jsonb_build_object(r.k, now_s));
          end if;
          if rb_n <> rb_sent then
            fixes := fixes || jsonb_build_object('rivals', jsonb_build_object(r.k, rb_n));
          end if;
        end if;
        if jsonb_typeof(s -> 'rivals' -> r.k) = 'object' or o_riv ? r.k then
          riv := riv || jsonb_build_object(r.k, coalesce(case when jsonb_typeof(s -> 'rivals' -> r.k) = 'object' then s -> 'rivals' -> r.k end,
                                                         case when jsonb_typeof(o_riv -> r.k) = 'object' then o_riv -> r.k end, '{}')
                                                || jsonb_build_object('beaten', rb_n));
        end if;
        if rb_n >= 3 and rb_o < 3 and g_lvl >= (r.v ->> 'unlock')::int then
          camp_coins := camp_coins + (r.v ->> 'coins')::numeric;
          camp_bucks := camp_bucks + (r.v ->> 'bucks')::numeric;
          camp_trophies := camp_trophies + (r.v ->> 'trophies')::numeric;
        end if;
      end loop;
      s := jsonb_set(s, '{rivals}', riv);
    end if;

    -- Daily deals: each UTC day has three, the same for everyone (dealsFor() in data.ts). A deal sells
    -- for less than the worth it adds, so each one newly used today or yesterday allows its `save` once.
    -- The deals day can't go back.
    if jsonb_typeof(s -> 'deals') = 'object' and jsonb_typeof(cat -> 'deals') = 'object' then
      d_day := s -> 'deals' ->> 'day';
      if d_day ~ '^\d{4}-\d{2}-\d{2}$'
         and d_day::date between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date
         and d_day >= coalesce(case when jsonb_typeof(o -> 'deals') = 'object' then o -> 'deals' ->> 'day' end, '') then
        d_old := case when jsonb_typeof(o -> 'deals') = 'object' and o -> 'deals' ->> 'day' = d_day
                        and jsonb_typeof(o -> 'deals' -> 'used') = 'array' then o -> 'deals' -> 'used' else '[]' end;
        d_n := floor(extract(epoch from d_day::date) / 86400)::bigint;
        select coalesce(array_agg(cat -> 'deals' -> 'slots' -> i ->> ((d_n * (cat -> 'deals' -> 'step' ->> i)::bigint + i)
                                     % jsonb_array_length(cat -> 'deals' -> 'slots' -> i))::int), '{}')
          into d_ids from generate_series(0, jsonb_array_length(cat -> 'deals' -> 'slots') - 1) i;
        select coalesce(sum(coalesce((cat -> 'deals' -> 'save' ->> u)::numeric, 0)), 0) into deal_save
          from (select distinct u from jsonb_array_elements_text(case when jsonb_typeof(s -> 'deals' -> 'used') = 'array' then s -> 'deals' -> 'used' else '[]' end) u
                where u = any(d_ids) and not d_old ? u) q;
      end if;
    end if;

    -- Weekly time trials: a week's prize is claimed once, for the place the server has for that
    -- finished week (trial_place(), from time_trials.sql). Claims for weeks with no place are dropped,
    -- and claimed weeks stay claimed.
    o_tr := case when jsonb_typeof(o -> 'trials' -> 'claimed') = 'object' then o -> 'trials' -> 'claimed' else '{}' end;
    if jsonb_typeof(s -> 'trials') = 'object' or o_tr <> '{}' then
      tr := o_tr;
      if jsonb_typeof(s -> 'trials' -> 'claimed') = 'object' then
        for r in select k from jsonb_object_keys(s -> 'trials' -> 'claimed') k where not o_tr ? k loop
          tr_place := null;
          if r.k ~ '^\d{4}-\d{2}-\d{2}$' and to_regprocedure('public.trial_place(uuid,date)') is not null then
            begin
              tr_place := public.trial_place(new.owner_id, r.k::date);
            exception when others then
              tr_place := null;
            end;
          end if;
          if tr_place is null then
            fixes := fixes || jsonb_build_object('trial', r.k);
          else
            tr := tr || jsonb_build_object(r.k, tr_place);
            tr_prize := public.trial_prize(tr_place);
            tr_coins := tr_coins + coalesce((tr_prize ->> 'coins')::numeric, 0);
            tr_bucks := tr_bucks + coalesce((tr_prize ->> 'bucks')::numeric, 0);
            tr_trophies := tr_trophies + coalesce((tr_prize ->> 'trophies')::numeric, 0);
          end if;
        end loop;
      end if;
      if jsonb_typeof(s -> 'trials') = 'object'
         and exists (select 1 from jsonb_object_keys(o_tr) k where not coalesce(s -> 'trials' -> 'claimed', '{}') ? k) then
        fixes := fixes || '{"trials":"kept claimed weeks"}';
      end if;
      s := jsonb_set(s, '{trials}', case when jsonb_typeof(s -> 'trials') = 'object' then s -> 'trials' else '{}' end || jsonb_build_object('claimed', tr));
    end if;

    -- A restored car (the one in the bay, by uid) is worth its price, at most once a minute, less
    -- what the restore and its share of Rusty's search cost (restoreCost() in data.ts, and the cost
    -- rescue_roll() noted on the find). That must already have been spent: worth the town lost since
    -- (econ.spent) pays for it, and the rest comes off the car's allowance. Towns from before this
    -- check start with 50,000 spent, so a restore already paid for isn't charged twice.
    -- Both of Rusty's bays (`restoring`, and `restoring2` once the second bay is open).
    foreach bk in array array['restoring', 'restoring2'] loop
      out_car := null;
      if jsonb_typeof(o -> bk) = 'object' and now_s - coalesce((e ->> (case bk when 'restoring' then 'restore_at' else 'restore2_at' end))::numeric, 0) >= 60
         and g_lvl >= coalesce((cat -> 'rescue' ->> (o -> bk ->> 'model'))::int, 999) then
        select x ->> 'uid' into out_car from jsonb_array_elements(cars) x
          where x ->> 'uid' = o -> bk ->> 'uid' and x ->> 'model' = o -> bk ->> 'model' and not (x ->> 'uid') = any(o_uids)
          limit 1;
        if out_car is not null then
          rc := cat -> 'cars' -> (o -> bk ->> 'model');
          owed := greatest(200, round(((rc ->> 'price')::numeric + coalesce((rc ->> 'bucks')::numeric, 0) * 100) * 0.25 / 10) * 10)
                + coalesce((select f.cost from econ_private.rescue_find(out_car) f), 0);
          spent := coalesce((e ->> 'spent')::numeric, 50000);
          restore_value := restore_value + greatest((rc ->> 'price')::numeric - greatest(owed - spent, 0), 0);
          if bk = 'restoring' then restored := out_car; else restored2 := out_car; end if;
          e := e || jsonb_build_object(case bk when 'restoring' then 'restore_at' else 'restore2_at' end, now_s, 'spent', greatest(spent - owed, 0));
        end if;
      end if;
    end loop;

    -- Crates: the save counts the opens it has added (`crates`: never less than before, never more
    -- than crate_open() has made). Opens added in this save pay the coins they won and the cars
    -- (at catalog price) and parts they gave, less the coins and gems they cost.
    cr_o := greatest(floor(public.econ_num(o, 'crates')), 0)::int;
    cr_n := greatest(floor(public.econ_num(s, 'crates')), 0)::int;
    if cr_n < cr_o then
      if s ? 'crates' then fixes := fixes || jsonb_build_object('crates', cr_o); end if;
      cr_n := cr_o;
    end if;
    if cr_n > cr_o then
      cr_p := econ_private.crate_pay(cr_o, cr_n);
      if cr_n > (cr_p ->> 'n')::int then
        cr_n := greatest((cr_p ->> 'n')::int, cr_o);
        fixes := fixes || jsonb_build_object('crates', cr_n);
        cr_p := econ_private.crate_pay(cr_o, cr_n);
      end if;
      select coalesce(array_agg(x ->> 'uid'), '{}') into cr_uids from jsonb_array_elements(cr_p -> 'cars') x;
      cr_mods := cr_p -> 'mods';
      cr_bucks := (cr_p ->> 'cost_bucks')::numeric;
      cr_net := (cr_p ->> 'coins')::numeric - (cr_p ->> 'cost_coins')::numeric
        + coalesce((select sum((cat -> 'cars' -> (x ->> 'model') ->> 'price')::numeric) from jsonb_array_elements(cr_p -> 'cars') x), 0)
        + coalesce((select sum(coalesce((cat -> 'mods' -> (x ->> 'mod') ->> 'coins')::numeric, 0) + coalesce((cat -> 'mods' -> (x ->> 'mod') ->> 'parts')::numeric, 0) * 50)
                    from jsonb_array_elements(cr_mods) x), 0);
    end if;
    s := jsonb_set(s, '{crates}', to_jsonb(cr_n));

    -- Cars come at their level: a new car above the player's level goes back and its coins and bucks
    -- are refunded. Rusty's cars (the restored car or any rescue find), one Grand Prix prize from the
    -- box, season cars (unlock 0) and cars a server grant noted (econ_private.car_granted) are kept.
    for r in select x from jsonb_array_elements(cars) x
             where not (x ->> 'uid') = any(o_uids)
               and coalesce((cat -> 'cars' -> (x ->> 'model') ->> 'unlock')::int, 0) > g_lvl loop
      continue when r.x ->> 'uid' is not distinct from restored or r.x ->> 'uid' is not distinct from restored2;
      continue when exists (select 1 from econ_private.rescue_find(r.x ->> 'uid') f where f.model = r.x ->> 'model');
      continue when econ_private.car_granted(r.x ->> 'uid', r.x ->> 'model');
      if gp_box is not null and not gp_free and gp_box ? (r.x ->> 'model') then
        gp_free := true;
        continue;
      end if;
      lock_price := coalesce((cat -> 'cars' -> (r.x ->> 'model') ->> 'price')::numeric, 0);
      lock_bucks := coalesce((cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric, 0);
      cars := (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(cars) y where y ->> 'uid' <> r.x ->> 'uid');
      s := s || jsonb_build_object('coins', public.econ_num(s, 'coins') + lock_price, 'bucks', public.econ_num(s, 'bucks') + lock_bucks);
      fixes := fixes || jsonb_build_object('locked_car', r.x ->> 'model');
    end loop;
    s := jsonb_set(s, '{cars}', cars);

    -- Car mastery (game/mastery.ts), per car model: races, wins, the modes won in, upsets (wins over
    -- a higher PI) and the tier reached. Counts never drop; wins can't pass races, upsets can't pass
    -- wins, and every model's wins together can't pass the town's race wins (else the last save's
    -- mastery stays). A tier newly reached pays its gems and trophies once, if the counts meet every
    -- tier's needs up to it and the model is in the garage. A save with no mastery keeps the old.
    o_mas := case when jsonb_typeof(o -> 'mastery') = 'object' then o -> 'mastery' else '{}' end;
    if jsonb_typeof(s -> 'mastery') is distinct from 'object' then
      if o_mas <> '{}' then s := jsonb_set(s, '{mastery}', o_mas); end if;
    elsif jsonb_typeof(cat -> 'mastery' -> 'tiers') = 'array' then
      mas := o_mas;
      for r in select x.key k, x.value v from jsonb_each(s -> 'mastery') x where jsonb_typeof(x.value) = 'object' loop
        mo := case when jsonb_typeof(o_mas -> r.k) = 'object' then o_mas -> r.k else '{}' end;
        m_races := greatest(floor(public.econ_num(r.v, 'races')), floor(public.econ_num(mo, 'races')), 0);
        m_wins := least(greatest(floor(public.econ_num(r.v, 'wins')), floor(public.econ_num(mo, 'wins')), 0), m_races);
        m_upsets := least(greatest(floor(public.econ_num(r.v, 'upsets')), floor(public.econ_num(mo, 'upsets')), 0), m_wins);
        m_modes := (select coalesce(jsonb_agg(distinct x2), '[]') from jsonb_array_elements(
                      case when jsonb_typeof(r.v -> 'modes') = 'array' then r.v -> 'modes' else '[]' end
                      || case when jsonb_typeof(mo -> 'modes') = 'array' then mo -> 'modes' else '[]' end) x2
                    where jsonb_typeof(x2) = 'string');
        if jsonb_array_length(m_modes) > 12 then m_modes := case when jsonb_typeof(mo -> 'modes') = 'array' then mo -> 'modes' else '[]' end; end if;
        m_old := least(greatest(floor(public.econ_num(mo, 'tier')), 0), jsonb_array_length(cat -> 'mastery' -> 'tiers'))::int;
        m_ok := 0;
        for mt in select t from jsonb_array_elements(cat -> 'mastery' -> 'tiers') t loop
          exit when m_races < (mt ->> 'races')::numeric or m_wins < (mt ->> 'wins')::numeric
                 or jsonb_array_length(m_modes) < (mt ->> 'modes')::numeric or m_upsets < (mt ->> 'upsets')::numeric;
          m_ok := m_ok + 1;
        end loop;
        m_tier := least(greatest(floor(public.econ_num(r.v, 'tier')), m_old), greatest(m_ok, m_old))::int;
        if m_tier > m_old and not exists (select 1 from jsonb_array_elements(cars) x3 where x3 ->> 'model' = r.k) then
          m_tier := m_old;
        end if;
        if m_tier < floor(public.econ_num(r.v, 'tier')) then
          fixes := fixes || jsonb_build_object('mastery', r.k);
        end if;
        for rd_i in m_old + 1 .. m_tier loop
          ms_bucks := ms_bucks + (cat -> 'mastery' -> 'tiers' -> (rd_i - 1) ->> 'bucks')::numeric;
          ms_trophies := ms_trophies + (cat -> 'mastery' -> 'tiers' -> (rd_i - 1) ->> 'trophies')::numeric;
        end loop;
        mas := mas || jsonb_build_object(r.k, jsonb_build_object('races', m_races, 'wins', m_wins, 'modes', m_modes, 'upsets', m_upsets, 'tier', m_tier));
      end loop;
      select coalesce(sum(public.econ_num(x.value, 'wins')), 0) into ms_wins from jsonb_each(mas) x where jsonb_typeof(x.value) = 'object';
      if ms_wins > least(public.econ_num(s, 'racesWon'), public.econ_num(o, 'racesWon') + floor(win_bank)) and mas is distinct from o_mas then
        fixes := fixes || '{"mastery":"more wins than races won"}';
        mas := o_mas;
        ms_bucks := 0;
        ms_trophies := 0;
      end if;
      s := jsonb_set(s, '{mastery}', mas);
    end if;

    -- Trophy Road (game/trophyRoad.ts): stops claimed never go down and can't pass the stops the
    -- trophies reach (at most what this save may add). Each newly claimed stop pays its coins and
    -- parts once. A save with no road keeps the old.
    if jsonb_typeof(cat -> 'road') = 'object' then
      rd_o := greatest(floor(public.econ_num(o, 'road')), 0);
      if jsonb_typeof(s -> 'road') is distinct from 'number' then
        if o ? 'road' then s := jsonb_set(s, '{road}', to_jsonb(rd_o)); end if;
      else
        rd_max := floor(least(public.econ_num(s, 'trophies'),
                              public.econ_num(o, 'trophies') + trophy_bank + case when gp_series is not null then 5 else 0 end
                              + camp_trophies + set_trophies + tr_trophies + ms_trophies) / (cat -> 'road' ->> 'step')::numeric);
        rd_n := least(greatest(floor(public.econ_num(s, 'road')), rd_o), greatest(rd_max, rd_o));
        if rd_n <> public.econ_num(s, 'road') then
          fixes := fixes || jsonb_build_object('road', jsonb_build_object('sent', public.econ_num(s, 'road'), 'kept', rd_n));
        end if;
        for rd_i in rd_o::int .. (rd_n - 1)::int loop
          rd_p := coalesce(cat -> 'road' -> 'stops' -> rd_i, cat -> 'road' -> 'after');
          rd_coins := rd_coins + (rd_p ->> 'coins')::numeric;
          rd_parts := rd_parts + (rd_p ->> 'parts')::numeric;
        end loop;
        s := jsonb_set(s, '{road}', to_jsonb(rd_n));
      end if;
    end if;

    -- Bucks: only what levels, goals, the daily bonus, campaign bonuses, collection sets, task chests, season tiers and car mastery pay, less any bucks-only car bought.
    for r in select x from jsonb_array_elements(cars) x loop
      if not (r.x ->> 'uid') = any(o_uids) and (cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric > 0
         and r.x ->> 'uid' is distinct from restored and r.x ->> 'uid' is distinct from restored2 and not (r.x ->> 'uid') = any(cr_uids) then
        if gp_box is not null and gp_box ? (r.x ->> 'model') then
          gp_box := null; -- the prize car is free
        else
          bucks_cost := bucks_cost + (cat -> 'cars' -> (r.x ->> 'model') ->> 'bucks')::numeric;
        end if;
      end if;
    end loop;
    -- Bucks-only mods bought since the last save are paid for too.
    bucks_cost := bucks_cost + coalesce((select sum(n.bucks) from public.econ_new_bucks_mods(cars, o, cat) n
                                           where not cr_mods @> jsonb_build_array(jsonb_build_object('car', n.uid, 'mod', n.id))), 0);
    max_bucks := greatest(public.econ_num(o, 'bucks'), 0) + (n_lvl - o_lvl) * 15 + goal_bucks + daily_bucks + camp_bucks + set_bucks + q_bucks + sea_bucks + tr_bucks + ms_bucks + pay_bucks - bucks_cost - cr_bucks;
    if max_bucks < 0 then
      -- Unpaid bucks-only mods come off first, then unpaid bucks-only cars.
      for r2 in select * from public.econ_new_bucks_mods(cars, o, cat) n
                 where not cr_mods @> jsonb_build_array(jsonb_build_object('car', n.uid, 'mod', n.id)) order by bucks desc loop
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
               where not (x ->> 'uid') = any(o_uids) and not (x ->> 'uid') = any(cr_uids) and (cat -> 'cars' -> (x ->> 'model') ->> 'bucks')::numeric > 0
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
    if gain - cr_net < 0 then -- (crate costs don't pay for restores)
      e := e || jsonb_build_object('spent', least(coalesce((e ->> 'spent')::numeric, 50000) - (gain - cr_net), 1e6));
    end if;
    allow := deal_save + tr_coins + levelup_coins + goal_coins + daily_coins + gp_value + restore_value + camp_coins + set_coins + q_coins + q_parts * 50
             + sea_coins + sea_parts * 50 + sea_value + cr_net + rd_coins + rd_parts * 50 + pay_coins + pay_parts * 50;
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
    allow := case when gp_series is not null then 5 else 0 end + camp_trophies + set_trophies + tr_trophies + ms_trophies;
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
end $function$;

CREATE OR REPLACE FUNCTION public.econ_car_value(c jsonb, cat jsonb)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  with d as (select cat -> 'cars' -> (c ->> 'model') as m)
  select (d.m ->> 'price')::numeric + coalesce((
    select sum(round(((d.m ->> 'price')::numeric + (d.m ->> 'bucks')::numeric * 100) * 0.15 * (k + 1) + 200))
    from unnest(array['engine','turbo','tires','weight']) slot, generate_series(0, public.econ_upgrade(c, slot) - 1) k), 0)
    + coalesce((select sum((f.m ->> 'coins')::numeric + (f.m ->> 'parts')::numeric * 50) from public.econ_owned_mods(c, cat) f), 0)
  from d
$function$;

CREATE OR REPLACE FUNCTION public.econ_starter()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'level', 1, 'xp', 0, 'coins', 2500, 'bucks', 100, 'parts', 10, 'fuel', 25, 'trophies', 0, 'racesWon', 0,
    'cars', '[{"uid":"","model":"pip","upgrades":{}},{"uid":"","model":"civic","upgrades":{}}]'::jsonb,
    'buildings', (select jsonb_agg(jsonb_build_object('uid', '', 'def', d))
                  from unnest(array['showroom','garage','gas','pizza','pizza','pizza','house','house','house','house',
                                    'house','house','house','tree','tree','tree','tree','tree','tree','tree','tree',
                                    'tree','tree','tree','tree']) d),
    'land', '["0,0","0,1","0,2","1,0","1,1","1,2","2,0","2,1","2,2"]'::jsonb,
    'claimedGoals', '[]'::jsonb, 'lastDaily', null, 'dailyStreak', 0, 'gp', '{}'::jsonb, 'restoring', null)
$function$;

create or replace function public.crate_open(p_crate text, p_free text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- crates:begin
  t jsonb := $crates${"crates":{"street":{"pay":"coins","unlock":1,"base":300,"perLevel":120,"priceCap":15,"odds":{"coins":56,"jackpot":6,"mod":28,"car":10,"skin":0,"piece":0},"carShare":0.12,"coinMult":[0.5,1],"jackpotMult":[2,3],"skins":[],"below":null,"hat":3,"hats":["party","sombrero"],"call":2,"callTiers":["rare"]},"garage":{"pay":"coins","unlock":1,"base":1500,"perLevel":500,"priceCap":30,"odds":{"coins":40.9,"jackpot":8,"mod":31,"car":16,"skin":4,"piece":0.1},"carShare":0.15,"coinMult":[0.45,0.85],"jackpotMult":[2,3],"skins":["rare","epic"],"below":"street","hat":4,"hats":["party","propeller","pinkcowboy","sombrero"],"call":3,"callTiers":["rare","epic"]},"gold":{"pay":"bucks","unlock":1,"base":80,"perLevel":0,"odds":{"coins":33.95,"jackpot":6,"mod":30,"car":20,"skin":10,"piece":0.05},"carShare":0.15,"coinMult":[0.45,0.85],"jackpotMult":[2,3],"skins":["rare","epic","legendary"],"below":"garage","pity":{"every":8},"hat":6,"hats":["propeller","pinkcowboy","pirate","tophat"],"call":4,"callTiers":["rare","epic","legendary"]},"diamond":{"pay":"bucks","unlock":1,"base":250,"perLevel":0,"odds":{"coins":23.9,"jackpot":6,"mod":24,"car":32,"skin":14,"piece":0.1},"carShare":0.2,"coinMult":[0.7,1.1],"jackpotMult":[2.5,3.5],"skins":["epic","legendary"],"below":"gold","pity":{"every":10,"tier":"legendary"},"hat":8,"hats":["pirate","viking","crown","tophat"],"call":5,"callTiers":["epic","legendary"]}},"callCards":{"neonalley":"rare","raincheck":"rare","sunsetstrip":"rare","checkerrush":"rare","tiresmoke":"rare","hazard":"rare","oceandrive":"rare","snowday":"rare","autumnlane":"rare","dragtree":"rare","bubblepop":"rare","pixelpark":"rare","ravelights":"epic","warpspeed":"epic","polarglow":"epic","midnightgrid":"epic","plasma":"epic","lasergrid":"epic","circuitry":"epic","deepsea":"epic","fireworks":"epic","comettrail":"epic","discoball":"epic","sakura":"epic","thunderroad":"legendary","inferno":"legendary","starwarp":"legendary","goldrush":"legendary","blackhole":"legendary","magmacore":"legendary","diamondrain":"legendary","championlap":"legendary"},"callWeight":{"rare":6,"epic":3,"legendary":1},"skinWeight":{"rare":6,"epic":3,"legendary":1},"skinDupe":{"rare":0.6,"epic":1,"legendary":1.5},"skins":{"riptide":{"tier":"rare","set":"daily"},"static":{"tier":"rare"},"contour":{"tier":"rare","set":"roadtrip"},"ghostcamo":{"tier":"rare","set":"heavy"},"faultline":{"tier":"epic","set":"muscle"},"aurora":{"tier":"epic"},"thunderhead":{"tier":"epic"},"biolume":{"tier":"epic"},"nightdrive":{"tier":"epic"},"petalstorm":{"tier":"epic"},"horizon":{"tier":"legendary"},"coldsnap":{"tier":"legendary"},"quicksilver":{"tier":"legendary"},"wyrmscale":{"tier":"legendary"},"kaleido":{"tier":"legendary"},"custompaint":{"tier":"legendary","only":"diamond"}},"modSkins":{"neonpulse":{"tier":"rare","set":"tuners"},"checkered":{"tier":"rare","set":"track"},"goldleaf":{"tier":"epic"},"starlight":{"tier":"epic"},"toxic":{"tier":"epic"},"stormcell":{"tier":"epic"},"biobloom":{"tier":"epic"},"holofoil":{"tier":"legendary"},"rime":{"tier":"legendary"},"mercury":{"tier":"legendary"},"dragonhide":{"tier":"legendary"}},"gem":{"base":30,"perLevel":10},"pieceDupe":1,"pieces":4,"cars":{"pip":{"body":"compact","crate":"street","unlock":1,"price":800,"bucks":0,"colors":["#c62828","#1b5e20","#fafafa"]},"civic":{"body":"sedan","crate":"street","unlock":1,"price":1500,"bucks":0,"colors":["#1e88e5","#eeeeee","#424242"]},"trail":{"body":"truck","crate":"street","unlock":3,"price":3900,"bucks":0,"colors":["#0d47a1","#c62828","#eceff1"]},"miata":{"body":"roadster","crate":"street","unlock":5,"price":8100,"bucks":0,"colors":["#d32f2f","#1e88e5","#fafafa"]},"stallion":{"body":"muscle","crate":"garage","unlock":7,"price":13000,"bucks":0,"colors":["#1b5e20","#ff6f00","#212121"]},"rally":{"body":"rally","crate":"garage","unlock":10,"price":22000,"bucks":0,"colors":["#0d47a1","#fafafa","#ffd600"]},"vette":{"body":"sports","crate":"gold","unlock":15,"price":44000,"bucks":0,"colors":["#b71c1c","#bdbdbd","#ffd600"]},"charger":{"body":"muscle","crate":"garage","unlock":13,"price":33000,"bucks":0,"colors":["#212121","#ff5722","#6a1b9a"]},"hellcat":{"body":"widebody","crate":"gold","unlock":18,"price":68000,"bucks":0,"colors":["#c62828","#7b1fa2","#9ccc65"]},"gtr":{"body":"coupe","crate":"gold","unlock":22,"price":110000,"bucks":0,"colors":["#eceff1","#263238","#ff6d00"]},"tomahawk":{"body":"tank","crate":"diamond","unlock":36,"price":315000,"bucks":0,"colors":["#556b2f","#37474f","#c9a227"]},"zippy":{"body":"scooter","crate":"street","unlock":2,"price":2100,"bucks":0,"colors":["#4dd0e1","#fdd835","#f48fb1"]},"baron":{"body":"chopper","crate":"garage","unlock":7,"price":13000,"bucks":0,"colors":["#212121","#b71c1c","#1565c0"]},"shinden":{"body":"sportbike","crate":"diamond","unlock":24,"price":135000,"bucks":0,"colors":["#1565c0","#eceff1","#76ff03"]},"camper":{"body":"van","crate":"street","unlock":2,"price":2100,"bucks":0,"colors":["#ff8a65","#4db6ac","#fff59d"]},"hotshot":{"body":"hatch","crate":"street","unlock":5,"price":8100,"bucks":0,"colors":["#eceff1","#d32f2f","#1e88e5"]},"ridgeback":{"body":"suv","crate":"street","unlock":6,"price":10000,"bucks":0,"colors":["#ff6f00","#33691e","#eceff1"]},"kitsune":{"body":"coupe","crate":"garage","unlock":9,"price":19000,"bucks":0,"colors":["#fafafa","#212121","#ff4081"]},"current":{"body":"ev","crate":"gold","unlock":16,"price":49000,"bucks":0,"colors":["#eceff1","#b71c1c","#263238"]},"salon":{"body":"luxury","crate":"gold","unlock":11,"price":0,"bucks":400,"colors":["#1a1a2e","#eceff1","#6d1b1b"]},"stomper":{"body":"truck","crate":"garage","unlock":12,"price":30000,"bucks":0,"colors":["#424242","#1565c0","#ff6d00"]},"monoposto":{"body":"formula","crate":"diamond","unlock":30,"price":200000,"bucks":0,"colors":["#d50000","#eceff1","#00897b"]},"zenith":{"body":"super","crate":"diamond","unlock":40,"price":440000,"bucks":0,"colors":["#212121","#1e88e5","#ff6d00"]},"schoolbus":{"body":"bus","crate":"street","unlock":4,"price":5300,"bucks":0,"colors":["#fbc02d","#ff8f00","#eceff1"]},"shaggy":{"body":"dogvan","crate":"street","unlock":5,"price":8100,"bucks":0,"colors":["#d7ccc8","#a1887f","#9e9e9e"]},"tusker":{"body":"tusker","crate":"gold","unlock":20,"price":85000,"bucks":0,"colors":["#6b7a3a","#c2a36b","#eceff1"]},"lambo":{"body":"wedge","crate":"diamond","unlock":26,"price":0,"bucks":700,"colors":["#fdd835","#d50000","#fafafa"]},"hyper":{"body":"super","crate":"diamond","unlock":33,"price":250000,"bucks":0,"colors":["#1a237e","#212121","#d50000"]},"kreis":{"body":"sedan","crate":"garage","unlock":14,"price":40000,"bucks":0,"colors":["#eceff1","#0d47a1","#212121"]},"bergmeister":{"body":"rearengine","crate":"gold","unlock":17,"price":61000,"bucks":0,"colors":["#fafafa","#2e7d32","#ff6f00"]},"rattler":{"body":"muscle","crate":"gold","unlock":21,"price":96000,"bucks":0,"colors":["#1565c0","#fafafa","#b71c1c"]},"cottonmouth":{"body":"longnose","crate":"diamond","unlock":25,"price":145000,"bucks":0,"colors":["#0d47a1","#b71c1c","#fdd835"]},"ringmeister":{"body":"super","crate":"diamond","unlock":28,"price":175000,"bucks":0,"colors":["#9e9e9e","#d32f2f","#212121"]},"raiden":{"body":"prototype","crate":"diamond","unlock":32,"price":225000,"bucks":0,"colors":["#00897b","#ff6d00","#eceff1"]},"sovereign":{"body":"super","crate":"diamond","unlock":34,"price":0,"bucks":1000,"colors":["#1a237e","#90a4ae","#b71c1c"]},"wraith":{"body":"wedge","crate":"diamond","unlock":38,"price":395000,"bucks":0,"colors":["#eceff1","#ff6f00","#212121"]},"fulmine":{"body":"scissor","crate":"diamond","unlock":40,"price":0,"bucks":2200,"colors":["#c6ff00","#ff6d00","#eceff1"]},"eclat":{"body":"horseshoe","crate":"diamond","unlock":42,"price":650000,"bucks":0,"colors":["#0d47a1","#212121","#b0bec5"]},"orafo":{"body":"teardrop","crate":"diamond","unlock":39,"price":0,"bucks":1800,"colors":["#eceff1","#bf360c","#37474f"]},"scoops":{"body":"icecream","crate":"street","unlock":4,"price":5300,"bucks":0,"colors":["#fafafa","#f8bbd0","#b2ebf2"]},"courier":{"body":"parcel","crate":"street","unlock":3,"price":3900,"bucks":0,"colors":["#5d4037","#eceff1","#1b5e20"]},"crusher":{"body":"monster","crate":"garage","unlock":8,"price":15000,"bucks":0,"colors":["#d50000","#1565c0","#ffd600"]},"sprint":{"body":"stepnose","crate":null,"unlock":10,"price":70000,"bucks":0,"colors":["#1b4d3e","#efe7d2","#6d1b2b"],"secret":true},"revenant":{"body":"restomuscle","crate":null,"unlock":14,"price":110000,"bucks":0,"colors":["#8d9094","#1c1c1c","#0d2a5c"],"secret":true},"pontone":{"body":"pontoon","crate":null,"unlock":18,"price":170000,"bucks":0,"colors":["#b71c1c","#cfd8dc","#1b5e20"],"secret":true},"stinger":{"body":"ponycar","crate":null,"unlock":12,"price":0,"bucks":0,"colors":["#ffb300","#212121","#c62828"]},"sora":{"body":"gtcoupe","crate":null,"unlock":20,"price":0,"bucks":0,"colors":["#c62828","#eceff1","#1565c0"]},"scatto":{"body":"hothatch","crate":null,"unlock":13,"price":0,"bucks":0,"colors":["#d32f2f","#fafafa","#1e88e5"]},"thunderjet":{"body":"musclecoupe","crate":null,"unlock":22,"price":0,"bucks":0,"colors":["#2e7d32","#ff8f00","#212121"]},"hayate":{"body":"popup","crate":null,"unlock":28,"price":0,"bucks":0,"colors":["#6a1b9a","#eceff1","#212121"]},"kestrel":{"body":"midship","crate":null,"unlock":33,"price":0,"bucks":0,"colors":["#00897b","#eceff1","#212121"]},"firebolt":{"body":"highboy","crate":null,"unlock":8,"price":0,"bucks":0,"colors":["#b71c1c","#212121","#ffb300"]},"kaze":{"body":"timeattack","crate":null,"unlock":15,"price":0,"bucks":0,"colors":["#eceff1","#0d47a1","#ff6d00"]},"sturm":{"body":"groupb","crate":null,"unlock":25,"price":0,"bucks":0,"colors":["#fafafa","#c62828","#1b5e20"]},"vanta":{"body":"longtail","crate":null,"unlock":40,"price":0,"bucks":0,"colors":["#263238","#00e5ff","#e0e0e0"]},"bug":{"body":"bubble","crate":"street","unlock":1,"price":1200,"bucks":0,"colors":["#80cbc4","#ffcc80","#ef9a9a"]},"woodie":{"body":"wagon","crate":"street","unlock":1,"price":2200,"bucks":0,"colors":["#fafafa","#fff59d","#4db6ac"]},"hauler":{"body":"truck","crate":"street","unlock":4,"price":3000,"bucks":0,"colors":["#558b2f","#e65100","#1565c0"]},"cruiser":{"body":"classic","crate":"street","unlock":9,"price":5000,"bucks":0,"colors":["#4dd0e1","#f06292","#fafafa"]},"buggy":{"body":"offroad","crate":"street","unlock":4,"price":6000,"bucks":0,"colors":["#ff9800","#cddc39","#29b6f6"]},"bandit":{"body":"muscle","crate":"street","unlock":9,"price":8000,"bucks":0,"colors":["#212121","#ffd54f","#b71c1c"]},"lemans":{"body":"super","crate":"garage","unlock":15,"price":16000,"bucks":0,"colors":["#1565c0","#fafafa","#c62828"]},"gullwing":{"body":"coupe","crate":"garage","unlock":24,"price":30000,"bucks":0,"colors":["#cfd8dc","#b71c1c","#263238"]},"speedster":{"body":"roadster","crate":"garage","unlock":15,"price":12000,"bucks":0,"colors":["#1565c0","#eceff1","#b71c1c"]},"nightfall":{"body":"wedge","crate":null,"unlock":1,"price":24000,"bucks":0,"colors":["#311b92","#00e5ff","#212121"]}},"mods":{"ducktail":{"crate":"street","unlock":2,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"gtwing":{"crate":"garage","unlock":5,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"attackwing":{"crate":"diamond","unlock":12,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"twintips":{"crate":"street","unlock":2},"sidepipes":{"crate":"garage","unlock":4},"flamepipes":{"crate":"gold","unlock":12},"streetkit":{"crate":"street","unlock":3,"notOn":["scooter","chopper","sportbike"]},"widebody":{"crate":"garage","unlock":6,"notOn":["scooter","chopper","sportbike"]},"carbonkit":{"crate":"diamond","unlock":16,"notOn":["scooter","chopper","sportbike"]},"vented":{"crate":"street","unlock":2,"notOn":["scooter","chopper","sportbike","formula"]},"ramscoop":{"crate":"garage","unlock":4,"notOn":["scooter","chopper","sportbike","formula"]},"blower":{"crate":"garage","unlock":7,"notOn":["scooter","chopper","sportbike","formula"]},"chrome":{"crate":"street","unlock":1},"goldmesh":{"crate":"garage","unlock":4},"luggage":{"crate":"street","unlock":3,"only":["bus"]},"stacks":{"crate":"garage","unlock":3,"only":["bus"]},"cowcatcher":{"crate":"garage","unlock":4,"only":["bus"]},"disco":{"crate":"gold","unlock":5,"only":["bus"]},"flag":{"crate":"garage","unlock":10,"only":["tank"]},"smoke":{"crate":"gold","unlock":10,"only":["tank"]},"reactive":{"crate":"garage","unlock":10,"only":["tank"]},"watercannon":{"crate":"diamond","unlock":10,"only":["tank"]},"bigtail":{"crate":"street","unlock":4,"only":["dogvan"]},"bubbles":{"crate":"gold","unlock":4,"only":["dogvan"]},"collar":{"crate":"street","unlock":4,"only":["dogvan"]},"bone":{"crate":"street","unlock":4,"only":["dogvan"]},"radar":{"crate":"garage","unlock":9,"only":["tusker"]},"snorkel":{"crate":"garage","unlock":9,"only":["tusker"]},"plating":{"crate":"garage","unlock":9,"only":["tusker"]},"lightbar":{"crate":"garage","unlock":9,"only":["tusker"]},"tailfairing":{"crate":"street","unlock":2,"only":["scooter","chopper","sportbike"]},"saddlebags":{"crate":"street","unlock":2,"only":["scooter","chopper","sportbike"]},"windscreen":{"crate":"street","unlock":2,"only":["scooter","chopper","sportbike"]},"campod":{"crate":"street","unlock":11,"only":["formula"]},"bargeboards":{"crate":"gold","unlock":11,"only":["formula"]},"raintires":{"crate":"garage","unlock":3},"sandtires":{"crate":"garage","unlock":4},"snowstuds":{"crate":"garage","unlock":4},"allweather":{"crate":"gold","unlock":7},"forged":{"crate":"garage","unlock":7},"swanneck":{"crate":"gold","unlock":14,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"skydeck":{"crate":"diamond","unlock":18,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"roofrack":{"crate":"garage","unlock":5,"only":["truck","suv","van","wagon"]},"quadtips":{"crate":"street","unlock":5},"zoomies":{"crate":"gold","unlock":11,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike","formula"]},"titan":{"crate":"diamond","unlock":15},"rallykit":{"crate":"garage","unlock":5,"notOn":["scooter","chopper","sportbike","formula"]},"boxflares":{"crate":"gold","unlock":11,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike","formula","icecream","parcel","monster"]},"aerokit":{"crate":"diamond","unlock":20,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike","formula","icecream","parcel","monster"]},"bullbar":{"crate":"street","unlock":4,"only":["truck","suv","van","wagon","offroad"]},"cowl":{"crate":"street","unlock":3,"notOn":["scooter","chopper","sportbike","formula"]},"louvres":{"crate":"garage","unlock":9,"notOn":["scooter","chopper","sportbike","formula"]},"twinturbo":{"crate":"diamond","unlock":16,"notOn":["scooter","chopper","sportbike","formula"]},"candy":{"crate":"street","unlock":3},"beadlock":{"crate":"garage","unlock":6},"turbine":{"crate":"garage","unlock":10},"goldwire":{"crate":"diamond","unlock":14},"foglamps":{"crate":"street","unlock":3,"notOn":["scooter","chopper","sportbike","formula"]},"roofbar":{"crate":"garage","unlock":7,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike","roadster","offroad","tusker","pontoon","bubble","formula"]},"underglow":{"crate":"diamond","unlock":10,"notOn":["scooter","chopper","sportbike","formula","tank"]},"lowered":{"crate":"garage","unlock":4,"notOn":["scooter","chopper","sportbike","formula","tank"]},"lifted":{"crate":"garage","unlock":6,"notOn":["scooter","chopper","sportbike","formula","tank"]},"slammed":{"crate":"diamond","unlock":12,"notOn":["scooter","chopper","sportbike","formula","tank"]}}}$crates$::jsonb;
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
  pity jsonb := c -> 'pity';
  dry int;
  forced boolean := false;
  hats jsonb;
  cards jsonb;
  -- crate_open_many() rolling one of its batch (batch:begin ... batch:end marks each change).
  -- batch:begin
  batch boolean := coalesce(current_setting('econ.crate_batch', true), '') = coalesce(me::text, '-');
  spent_c bigint;
  spent_b bigint;
  -- batch:end
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
  -- batch:begin
  -- In a batch, what its earlier rolls gave counts as the player's already.
  if batch then
    st := econ_private.crate_batch_state(me, st, saved);
  end if;
  -- batch:end
  -- Opens the save hasn't counted yet go back to the game first (in a batch: its own earlier rolls).
  if saved < last_seq and not batch then
    select coalesce(jsonb_agg(econ_private.crate_json(x) order by x.seq), '[]') into pend
      from public.crate_opens x where x.owner_id = me and x.seq > saved;
    return jsonb_build_object('pending', pend);
  end if;
  if not batch and exists (select 1 from public.crate_opens x where x.owner_id = me and x.created_at > now() - interval '1.5 seconds') then
    raise exception 'one crate at a time' using errcode = 'P0001';
  end if;
  if p_free is not null then
    -- A free crate: a cup race (cups.ts cupCrateSource) the save has won, not opened before.
    -- The guard doesn't check cup wins, so a forged save could claim at most one Garage crate per cup race.
    -- Or a Gold crate for a top-3 finish on a finished arcade week (arcade:<week>:<game>, 0087).
    if p_free ~ '^arcade:' then
      if p_crate <> 'gold' or not econ_private.arcade_prize_ok(me, p_free) then
        raise exception 'no such free crate' using errcode = 'invalid_parameter_value';
      end if;
    elsif p_crate <> 'garage' or p_free !~ '^cup:[a-z]+-[123]$' or public.econ_num(st -> 'cups', substr(p_free, 5)) < 1 then
      raise exception 'no such free crate' using errcode = 'invalid_parameter_value';
    end if;
    if exists (select 1 from public.crate_opens x where x.owner_id = me and x.source = p_free) then
      raise exception 'crate already opened' using errcode = 'P0001';
    end if;
  elsif lvl < (c ->> 'unlock')::int then
    raise exception 'crate not open yet' using errcode = 'insufficient_privilege';
  end if;
  -- A coin crate stops getting dearer at its priceCap level (CrateDef.priceCap).
  price := (c ->> 'base')::int + (c ->> 'perLevel')::int * least(lvl, coalesce((c ->> 'priceCap')::int, lvl));
  gemc := (t -> 'gem' ->> 'base')::numeric + (t -> 'gem' ->> 'perLevel')::numeric * lvl;
  if c ->> 'pay' = 'coins' then
    cost_c := price;
    v := price;
    if p_free is null and public.econ_num(st, 'coins') < price then
      raise exception 'not enough coins' using errcode = 'P0001';
    end if;
  else
    cost_b := price;
    v := price * gemc;
    if p_free is null and public.econ_num(st, 'bucks') < price then
      raise exception 'not enough gems' using errcode = 'P0001';
    end if;
  end if;
  -- A free crate is worth what it would cost, and costs nothing.
  if p_free is not null then
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

  -- Bad-luck protection (CrateDef.pity in src/game/crates.ts): after every - 1 opens of this crate
  -- in a row without a skin (of the pity tier, when it has one), this open is a skin of that tier.
  if jsonb_typeof(pity) = 'object' then
    select count(*) into dry from public.crate_opens x
      where x.owner_id = me and x.crate = p_crate
        and x.seq > coalesce((select max(y.seq) from public.crate_opens y
          where y.owner_id = me and y.crate = p_crate and y.kind in ('skin', 'skindupe')
            and (pity ->> 'tier' is null
              or t -> (case when y.part then 'modSkins' else 'skins' end) -> y.skin ->> 'tier' = pity ->> 'tier')), 0);
    if dry >= (pity ->> 'every')::int - 1 then
      kind := 'skin';
      forced := true;
    end if;
  end if;

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
      insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, source, kind, car_uid, mod)
        values (me, last_seq + 1, p_crate, cost_c, cost_b, p_free, 'mod', pick ->> 'car', (pick -> 'mods') ->> floor(random()::numeric * jsonb_array_length(pick -> 'mods'))::int)
        returning * into o;
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- A resto-mod piece (econ_private.piece_grant()); coins when no car is in reach.
  if kind = 'piece' then
    o := econ_private.piece_grant(me, st, lvl, last_seq + 1, p_crate, cost_c, cost_b, econ_private.crate_round(v * (t ->> 'pieceDupe')::numeric), p_free);
    if o.seq is not null then
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- A skin: a body or part skin of the crate's tiers (rarer tiers less likely), and a skin row
  -- with `only` (Custom Colour) just in that crate. One the player
  -- already has (bought, won, or unlocked by level or collection set) pays coins instead.
  if kind = 'skin' then
    select coalesce(jsonb_agg(jsonb_build_object('id', e.key, 'part', e.part, 'tier', e.value ->> 'tier', 'level', e.value -> 'level', 'set', e.value -> 'set') order by e.part, e.key), '[]')
      into pool from (select false as part, x.key, x.value from jsonb_each(t -> 'skins') x
                      union all select true, y.key, y.value from jsonb_each(t -> 'modSkins') y) e
      where (c -> 'skins') ? (e.value ->> 'tier')
        and (e.value ->> 'only' is null or e.value ->> 'only' = p_crate)
        and (not forced or pity ->> 'tier' is null or e.value ->> 'tier' = pity ->> 'tier');
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
      insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, source, kind, coins, skin, part)
        values (me, last_seq + 1, p_crate, cost_c, cost_b, p_free, case when owned then 'skindupe' else 'skin' end,
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
        insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, source, kind, coins, model)
          values (me, last_seq + 1, p_crate, cost_c, cost_b, p_free, 'dupe', econ_private.crate_round(least(v * 1.5, greatest(v * 0.5, cv * 0.4))), pick ->> 'id')
          returning * into o;
      else
        insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, source, kind, model, car_uid, color)
          values (me, last_seq + 1, p_crate, cost_c, cost_b, p_free, 'car', pick ->> 'id',
            'k' || substr(md5(random()::text || clock_timestamp()::text || me::text), 1, 14),
            (pick -> 'colors') ->> floor(random()::numeric * jsonb_array_length(pick -> 'colors'))::int)
          returning * into o;
      end if;
      return econ_private.crate_json(o);
    end if;
    kind := 'coins';
  end if;

  -- A hat (rollCrate()): a slice of the coin prizes, out of the coin weight, for a hat from the
  -- crate's pool (HATS order) the save doesn't have yet. With none left it stays coins.
  if kind = 'coins' then
    select coalesce(jsonb_agg(h.value order by h.n), '[]') into hats
      from jsonb_array_elements_text(coalesce(c -> 'hats', '[]')) with ordinality h(value, n)
      where not (jsonb_typeof(st -> 'hats') = 'array' and (st -> 'hats') ? h.value);
    if jsonb_array_length(hats) > 0 and random()::numeric * (odds ->> 'coins')::numeric < (c ->> 'hat')::numeric then
      insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, source, kind, hat)
        values (me, last_seq + 1, p_crate, cost_c, cost_b, p_free, 'hat', hats ->> floor(random()::numeric * jsonb_array_length(hats))::int)
        returning * into o;
      return econ_private.crate_json(o);
    end if;
    -- A Call Card (rollCrate()): the same, rolled after the hat slice misses: the crate's `call`
    -- slice, for a card of its tiers (callTiers) the save doesn't have yet, rarer tiers less likely
    -- (callWeight). With none left it stays coins.
    select coalesce(jsonb_agg(jsonb_build_object('id', e.key, 'w', (t -> 'callWeight' ->> (e.value #>> '{}'))::numeric) order by e.key), '[]') into cards
      from jsonb_each(coalesce(t -> 'callCards', '{}')) e
      where (c -> 'callTiers') ? (e.value #>> '{}')
        and not coalesce(jsonb_typeof(st -> 'callCards') = 'array' and (st -> 'callCards') ? e.key, false);
    if jsonb_array_length(cards) > 0 and random()::numeric * (odds ->> 'coins')::numeric < (c ->> 'call')::numeric then
      select sum((x ->> 'w')::numeric) into total from jsonb_array_elements(cards) x;
      r := random()::numeric * total;
      for pick in select x from jsonb_array_elements(cards) x loop
        r := r - (pick ->> 'w')::numeric;
        exit when r <= 0;
      end loop;
      insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, source, kind, call_card)
        values (me, last_seq + 1, p_crate, cost_c, cost_b, p_free, 'callcard', pick ->> 'id')
        returning * into o;
      return econ_private.crate_json(o);
    end if;
  end if;

  -- Coins: a share of what the crate is worth (a jackpot pays two to three times it or more).
  lo := ((c -> case when kind = 'jackpot' then 'jackpotMult' else 'coinMult' end) ->> 0)::numeric;
  hi := ((c -> case when kind = 'jackpot' then 'jackpotMult' else 'coinMult' end) ->> 1)::numeric;
  insert into public.crate_opens (owner_id, seq, crate, cost_coins, cost_bucks, source, kind, coins)
    values (me, last_seq + 1, p_crate, cost_c, cost_b, p_free, kind, econ_private.crate_round(v * (lo + (hi - lo) * random()::numeric)))
    returning * into o;
  return econ_private.crate_json(o);
end $$;

CREATE OR REPLACE FUNCTION public.wheel_spin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := auth.uid();
  -- wheel:begin
  w jsonb := $wheel${"slices":[{"id":"coins-s","kind":"coins","weight":31,"mult":0.3},{"id":"part","kind":"part","weight":14},{"id":"coins-m","kind":"coins","weight":22,"mult":0.7},{"id":"gems-1","kind":"gems","weight":12,"gems":15},{"id":"coins-l","kind":"coins","weight":9,"mult":2},{"id":"skin","kind":"skin","weight":4},{"id":"gems-3","kind":"gems","weight":7,"gems":45},{"id":"jackpot","kind":"jackpot","weight":1,"gems":250}],"fallback":"coins-m","dupe":"coins-l"}$wheel$::jsonb;
  -- wheel:end
  t jsonb;
  st jsonb;
  lvl int;
  saved int;
  last_seq int;
  pend jsonb;
  day date := (now() at time zone 'utc')::date;
  price numeric;
  sl jsonb;
  total numeric;
  r numeric;
  cc text;
  car jsonb;
  cdef jsonb;
  have jsonb;
  mods jsonb;
  choices jsonb := '[]';
  pick jsonb;
  pool jsonb;
  owned boolean;
  o public.crate_opens;
begin
  if me is null then
    raise exception 'sign in to spin' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('crate:' || me::text));
  select g.state, g.level into st, lvl from public.game_saves g where g.owner_id = me;
  if jsonb_typeof(st) is distinct from 'object' then
    raise exception 'no saved town yet' using errcode = 'P0001';
  end if;
  lvl := greatest(coalesce(lvl, 1), 1);
  select coalesce(max(x.seq), 0) into last_seq from public.crate_opens x where x.owner_id = me;
  saved := floor(public.econ_num(st, 'crates'))::int;
  if saved < last_seq then
    select coalesce(jsonb_agg(econ_private.crate_json(x) order by x.seq), '[]') into pend
      from public.crate_opens x where x.owner_id = me and x.seq > saved;
    return jsonb_build_object('pending', pend);
  end if;
  if exists (select 1 from public.crate_opens x where x.owner_id = me and x.crate = 'wheel'
             and (x.created_at at time zone 'utc')::date = day) then
    raise exception 'spun today' using errcode = 'P0001';
  end if;

  -- The crate tables, straight from crate_open() (its dollar-quoted crates table).
  t := substring(pg_get_functiondef('public.crate_open(text, text)'::regprocedure) from '\$crates\$(.*?)\$crates\$')::jsonb;
  if jsonb_typeof(t -> 'crates' -> 'street') is distinct from 'object' then
    raise exception 'wheel is off' using errcode = 'P0001'; -- crate_open() lost its crates table
  end if;
  price := (t -> 'crates' -> 'street' ->> 'base')::numeric + (t -> 'crates' -> 'street' ->> 'perLevel')::numeric * lvl;

  -- Which slice.
  select sum((x ->> 'weight')::numeric) into total from jsonb_array_elements(w -> 'slices') x;
  r := random()::numeric * total;
  for sl in select x from jsonb_array_elements(w -> 'slices') x loop
    r := r - (sl ->> 'weight')::numeric;
    exit when r <= 0;
  end loop;

  -- A part: for one of the player's cars, a Garage Crate part (Street when none fit) that's
  -- unlocked and not owned yet. None at all pays the fallback coins.
  if sl ->> 'kind' = 'part' then
    cc := 'garage';
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
      insert into public.crate_opens (owner_id, seq, crate, kind, car_uid, mod)
        values (me, last_seq + 1, 'wheel', 'mod', pick ->> 'car', (pick -> 'mods') ->> floor(random()::numeric * jsonb_array_length(pick -> 'mods'))::int)
        returning * into o;
      return jsonb_build_object('slice', sl ->> 'id', 'day', day, 'open', econ_private.crate_json(o));
    end if;
    select x into sl from jsonb_array_elements(w -> 'slices') x where x ->> 'id' = w ->> 'fallback';
  end if;

  -- A skin: a Garage Crate tier skin, rarer tiers less likely. One the player has pays the dupe coins.
  if sl ->> 'kind' = 'skin' then
    select coalesce(jsonb_agg(jsonb_build_object('id', e.key, 'part', e.part, 'tier', e.value ->> 'tier', 'level', e.value -> 'level', 'set', e.value -> 'set') order by e.part, e.key), '[]')
      into pool from (select false as part, x.key, x.value from jsonb_each(t -> 'skins') x
                      union all select true, y.key, y.value from jsonb_each(t -> 'modSkins') y) e
      where (t -> 'crates' -> 'garage' -> 'skins') ? (e.value ->> 'tier');
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
      insert into public.crate_opens (owner_id, seq, crate, kind, coins, skin, part)
        values (me, last_seq + 1, 'wheel', case when owned then 'skindupe' else 'skin' end,
          case when owned then econ_private.crate_round(price * (select (x ->> 'mult')::numeric from jsonb_array_elements(w -> 'slices') x where x ->> 'id' = w ->> 'dupe')) else 0 end,
          pick ->> 'id', (pick ->> 'part')::boolean)
        returning * into o;
      return jsonb_build_object('slice', sl ->> 'id', 'day', day, 'open', econ_private.crate_json(o));
    end if;
    select x into sl from jsonb_array_elements(w -> 'slices') x where x ->> 'id' = w ->> 'fallback';
  end if;

  -- Gems (and the jackpot): no coins, a negative gem cost.
  if sl ->> 'kind' in ('gems', 'jackpot') then
    insert into public.crate_opens (owner_id, seq, crate, cost_bucks, kind, coins)
      values (me, last_seq + 1, 'wheel', -(sl ->> 'gems')::int, case when sl ->> 'kind' = 'jackpot' then 'jackpot' else 'coins' end, 0)
      returning * into o;
    return jsonb_build_object('slice', sl ->> 'id', 'day', day, 'open', econ_private.crate_json(o));
  end if;

  -- Coins: a share of a Street Crate's price.
  insert into public.crate_opens (owner_id, seq, crate, kind, coins)
    values (me, last_seq + 1, 'wheel', 'coins', econ_private.crate_round(price * (sl ->> 'mult')::numeric))
    returning * into o;
  return jsonb_build_object('slice', sl ->> 'id', 'day', day, 'open', econ_private.crate_json(o));
end $function$;

CREATE OR REPLACE FUNCTION public.trial_prize_table()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
-- prizes:begin
select $prizes$[{"upTo":1,"bucks":150,"coins":10000,"trophies":5},{"upTo":2,"bucks":105,"coins":6000,"trophies":4},{"upTo":3,"bucks":75,"coins":4000,"trophies":3},{"upTo":10,"bucks":30,"coins":2000,"trophies":2},{"upTo":null,"bucks":0,"coins":500,"trophies":1}]$prizes$::jsonb
-- prizes:end
$function$;

CREATE OR REPLACE FUNCTION public.visitor_next(p_barn boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := auth.uid();
  -- visitors:begin
  t jsonb := $visitors${"kinds":{"racer":{"weight":30,"minutes":5,"coins":60,"coinsPerLevel":15,"xp":0,"xpPerLevel":0,"parts":3,"bucksChance":0.05},"tourist":{"weight":40,"minutes":5,"coins":30,"coinsPerLevel":6,"xp":3,"xpPerLevel":1,"parts":0,"bucksChance":0},"mystery":{"weight":25,"minutes":0.5,"coins":60,"coinsPerLevel":12,"xp":10,"xpPerLevel":2,"parts":2,"bucksChance":0.1},"barn":{"weight":5,"minutes":10,"coins":0,"coinsPerLevel":0,"xp":0,"xpPerLevel":0,"parts":0,"bucksChance":0}},"gap":4,"perDay":30,"barn":{"common":70,"scarce":25,"rare":5},"barnPerDay":1}$visitors$::jsonb;
  -- visitors:end
  cur public.town_visits;
  last_at timestamptz;
  today_n int;
  lvl int;
  st jsonb;
  rusty boolean;
  total numeric := 0;
  r numeric;
  k text;
  pick text;
  p jsonb;
begin
  if me is null then
    raise exception 'sign in for visitors' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('visitors:' || me::text));
  select * into cur from public.town_visits v
    where v.owner_id = me and v.kind <> 'help' and v.claimed_at is null and v.expires_at > now()
    order by v.created_at desc limit 1;
  if cur.id is not null then
    return econ_private.visit_json(cur);
  end if;
  select max(v.created_at) into last_at from public.town_visits v where v.owner_id = me and v.kind <> 'help';
  if last_at > now() - make_interval(mins => (t ->> 'gap')::int) then
    return jsonb_build_object('wait', ceil(extract(epoch from last_at + make_interval(mins => (t ->> 'gap')::int) - now())));
  end if;
  select count(*) into today_n from public.town_visits v
    where v.owner_id = me and v.kind <> 'help' and v.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if today_n >= (t ->> 'perDay')::int then
    return jsonb_build_object('wait', ceil(extract(epoch from date_trunc('day', now() at time zone 'utc') at time zone 'utc' + interval '1 day' - now())));
  end if;
  select g.level, g.state into lvl, st from public.game_saves g where g.owner_id = me;
  if lvl is null then
    return jsonb_build_object('wait', 60);
  end if;
  rusty := coalesce(p_barn, false) and jsonb_typeof(st -> 'buildings') = 'array'
    and exists (select 1 from jsonb_array_elements(st -> 'buildings') b where b ->> 'def' = 'rescue')
    and (select count(*) from public.town_visits v where v.owner_id = me and v.kind = 'barn'
         and v.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc') < (t ->> 'barnPerDay')::int;
  for k, p in select e.key, e.value from jsonb_each(t -> 'kinds') e loop
    if k <> 'barn' or rusty then total := total + (p ->> 'weight')::numeric; end if;
  end loop;
  r := random() * total;
  for k, p in select e.key, e.value from jsonb_each(t -> 'kinds') e loop
    continue when k = 'barn' and not rusty;
    pick := k;
    r := r - (p ->> 'weight')::numeric;
    exit when r <= 0;
  end loop;
  p := t -> 'kinds' -> pick;
  insert into public.town_visits (owner_id, kind, coins, xp, parts, bucks, expires_at)
  values (me, pick,
    round((p ->> 'coins')::numeric + (p ->> 'coinsPerLevel')::numeric * lvl),
    round((p ->> 'xp')::numeric + (p ->> 'xpPerLevel')::numeric * lvl),
    (p ->> 'parts')::int,
    case when random() < (p ->> 'bucksChance')::numeric then 15 else 0 end,
    now() + make_interval(secs => (p ->> 'minutes')::numeric * 60))
  returning * into cur;
  return econ_private.visit_json(cur);
end $function$;

create or replace function econ_private.endless_pay() returns jsonb
language sql immutable set search_path = '' as $endless$
  select '{"coins":200,"coinsPerLevel":60,"xp":25,"xpPerLevel":6,"parts":5,"partsEvery":5,"bucks":10,"bucksEvery":10,"perDay":12}'::jsonb
$endless$;

create table if not exists econ_private.econ_rescales (
  id text primary key,
  at timestamptz not null default now()
);
revoke all on econ_private.econ_rescales from public, anon, authenticated;

do $$
begin
  insert into econ_private.econ_rescales (id) values ('gems_x10') on conflict (id) do nothing;
  if not found then
    raise notice 'Gems x10 already done: balances left as they are';
    return;
  end if;

  -- Rows still to be counted, read against each save's cursors before the saves change.
  update public.crate_opens o set cost_bucks = o.cost_bucks * 10
  from public.game_saves s
  where s.owner_id = o.owner_id and o.cost_bucks <> 0
    and o.seq > greatest(floor(public.econ_num(s.state, 'crates')), 0);
  update public.town_visits v set bucks = v.bucks * 10
  where v.bucks > 0 and (v.seq is null or v.seq > coalesce((select greatest(floor(public.econ_num(s.state, 'visits')), 0)
                                                              from public.game_saves s where s.owner_id = v.owner_id), 0));
  -- Every pack keeps its gems x10, counted or not, so a later refund takes back what it gave.
  update public.purchases set bucks = bucks * 10, short = coalesce(short, 0) * 10 where bucks > 0 or short > 0;

  -- Balances. The guard leaves SQL editor writes alone (and refills its banks, as for any such write);
  -- a new updated_at makes open games reload. previous_state keeps the save as it was just before.
  update public.game_saves
     set state = jsonb_set(state, '{bucks}', to_jsonb(least(floor(greatest(public.econ_num(state, 'bucks'), 0)) * 10, 1e12))),
         updated_at = now()
   where jsonb_typeof(state) = 'object';
end $$;
