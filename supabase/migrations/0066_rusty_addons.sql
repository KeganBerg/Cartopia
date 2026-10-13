-- Rusty's Rescue add-ons (2026-10-13, thread "Rusty's Rescue overhaul"; Kegan picked all four):
--   * Spot sets: econ_catalog() gains a "rusty-<spot>" set per search spot (RUSTY_SETS in
--     src/game/data.ts), claimed and paid like the collection book sets.
--   * Hot tip: rescue_roll() makes rare cars hot.rare times as likely at one open spot a UTC day.
--   * Tow truck: the save's `truck` level sets the spots per search (truck pins); econ_progress()
--     lets it go up one level at a time at its player level, paid for in parts.
--   * Bay 2: `restoring2`, open from player level bay2.level, checked like bay 1 by econ_progress()
--     (econ 'bay2') and paid out by econ_guard() (econ 'restore2_at').
--   * Rusty's top spot (Old Race Track) rolls a resto-mod piece through
--     econ_private.resto_piece_roll(me, 'rusty_track') from 0065: at most once per real search
--     (piece.gap seconds apart, piece.day a UTC day).
-- Copies: rescue_roll() from 0038, econ_progress() from 0052, econ_guard() from 0041 (the live
-- copies), each changed only as above. econ_catalog() is rebuilt from econCatalog().
-- Run after 0065, and before the client with Rusty's add-ons ships.

create or replace function public.econ_catalog() returns jsonb
language sql immutable set search_path = '' as $$
-- catalog:begin
select $catalog${"cars":{"pip":{"name":"Kipper Pocket","body":"compact","price":800,"bucks":0,"power":18,"grip":36,"weight":24,"unlock":1},"civic":{"name":"Kazumi Commuter","body":"sedan","price":1500,"bucks":0,"power":24,"grip":34,"weight":36,"unlock":1},"trail":{"name":"Ironside Workhorse","body":"truck","price":3500,"bucks":0,"power":38,"grip":26,"weight":74,"unlock":3},"miata":{"name":"Kazumi Zephyr","body":"roadster","price":7000,"bucks":0,"power":32,"grip":54,"weight":22,"unlock":5},"stallion":{"name":"Liberty Bore Horse '68","body":"muscle","price":14000,"bucks":0,"power":52,"grip":34,"weight":54,"unlock":7},"rally":{"name":"Kodiak Gravel Rex","body":"rally","price":26000,"bucks":0,"power":52,"grip":64,"weight":40,"unlock":10},"vette":{"name":"Liberty Sidewinder","body":"sports","price":55000,"bucks":0,"power":66,"grip":54,"weight":38,"unlock":15},"charger":{"name":"Liberty Brawler","body":"muscle","price":42000,"bucks":0,"power":70,"grip":40,"weight":60,"unlock":13},"hellcat":{"name":"Liberty Hellhound 707","body":"widebody","price":80000,"bucks":0,"power":80,"grip":46,"weight":62,"unlock":18},"gtr":{"name":"Kazumi Ronin GT","body":"coupe","price":115000,"bucks":0,"power":78,"grip":70,"weight":46,"unlock":22},"tomahawk":{"name":"Ironside Tomahawk","body":"tank","price":420000,"bucks":0,"power":100,"grip":94,"weight":60,"unlock":36},"zippy":{"name":"Kipper Zip 50","body":"scooter","price":2100,"bucks":0,"power":14,"grip":30,"weight":8,"unlock":2},"baron":{"name":"Liberty Road Baron","body":"chopper","price":16000,"bucks":0,"power":46,"grip":36,"weight":30,"unlock":7},"shinden":{"name":"Kazumi Shinden RR","body":"sportbike","price":135000,"bucks":0,"power":80,"grip":60,"weight":14,"unlock":24},"camper":{"name":"Lakeside Sunrise Camper","body":"van","price":2800,"bucks":0,"power":20,"grip":28,"weight":64,"unlock":2},"hotshot":{"name":"Kazumi Hot Shot RS","body":"hatch","price":7000,"bucks":0,"power":36,"grip":50,"weight":26,"unlock":5},"ridgeback":{"name":"Kodiak Ridgeback 4x4","body":"suv","price":10000,"bucks":0,"power":44,"grip":46,"weight":62,"unlock":6},"kitsune":{"name":"Kazumi Kitsune Drift","body":"coupe","price":20000,"bucks":0,"power":48,"grip":58,"weight":30,"unlock":9},"current":{"name":"Sparkline Current","body":"ev","price":62000,"bucks":0,"power":72,"grip":52,"weight":50,"unlock":16},"salon":{"name":"Regent Grand Salon","body":"luxury","price":0,"bucks":45,"power":64,"grip":50,"weight":70,"unlock":11},"stomper":{"name":"Ironside Dune Stomper","body":"truck","price":36000,"bucks":0,"power":66,"grip":44,"weight":72,"unlock":12},"monoposto":{"name":"Veloce Monoposto 1","body":"formula","price":220000,"bucks":0,"power":90,"grip":90,"weight":20,"unlock":30},"zenith":{"name":"Aether Zenith R","body":"super","price":550000,"bucks":0,"power":100,"grip":96,"weight":26,"unlock":40},"schoolbus":{"name":"Ironside Scholar 72","body":"bus","price":6500,"bucks":0,"power":30,"grip":26,"weight":90,"unlock":4},"shaggy":{"name":"Lakeside Shaggy Hound","body":"dogvan","price":8000,"bucks":0,"power":26,"grip":30,"weight":66,"unlock":5},"tusker":{"name":"Kodiak Tusker Scout","body":"tusker","price":95000,"bucks":0,"power":70,"grip":72,"weight":58,"unlock":20},"lambo":{"name":"Veloce Corrida V12","body":"wedge","price":0,"bucks":90,"power":86,"grip":70,"weight":34,"unlock":26},"hyper":{"name":"Veloce Hyperion","body":"super","price":300000,"bucks":0,"power":98,"grip":86,"weight":32,"unlock":33},"kreis":{"name":"Brandt Kreis S","body":"sedan","price":48000,"bucks":0,"power":62,"grip":58,"weight":44,"unlock":14},"bergmeister":{"name":"Falke Bergmeister RS","body":"rearengine","price":70000,"bucks":0,"power":66,"grip":64,"weight":34,"unlock":17},"rattler":{"name":"Liberty Rattler GT","body":"muscle","price":105000,"bucks":0,"power":84,"grip":54,"weight":56,"unlock":21},"cottonmouth":{"name":"Liberty Cottonmouth ACR","body":"longnose","price":150000,"bucks":0,"power":88,"grip":62,"weight":46,"unlock":25},"ringmeister":{"name":"Nordwerk Ring V10","body":"super","price":190000,"bucks":0,"power":88,"grip":82,"weight":40,"unlock":28},"raiden":{"name":"Kazumi Raiden R26","body":"prototype","price":260000,"bucks":0,"power":92,"grip":92,"weight":24,"unlock":32},"sovereign":{"name":"Moreau Sovereign 16","body":"super","price":0,"bucks":140,"power":100,"grip":88,"weight":44,"unlock":34},"wraith":{"name":"Nordvik Wraith","body":"wedge","price":480000,"bucks":0,"power":100,"grip":90,"weight":30,"unlock":38},"fulmine":{"name":"Veloce Fulmine V12","body":"scissor","price":0,"bucks":220,"power":100,"grip":92,"weight":30,"unlock":40},"eclat":{"name":"Moreau Eclat W16","body":"horseshoe","price":650000,"bucks":0,"power":100,"grip":94,"weight":40,"unlock":42},"orafo":{"name":"Aurelio Orafo V12","body":"teardrop","price":0,"bucks":180,"power":98,"grip":94,"weight":28,"unlock":39},"sprint":{"name":"Valtorre Sprint 65","body":"stepnose","price":70000,"bucks":0,"power":110,"grip":104,"weight":30,"unlock":999},"revenant":{"name":"Liberty Revenant '69","body":"restomuscle","price":110000,"bucks":0,"power":130,"grip":92,"weight":56,"unlock":999},"pontone":{"name":"Corvara Pontone 58","body":"pontoon","price":170000,"bucks":0,"power":122,"grip":118,"weight":26,"unlock":999},"bug":{"name":"Bumble Bubble","body":"bubble","price":1200,"bucks":0,"power":14,"grip":28,"weight":28,"unlock":1},"woodie":{"name":"Lakeside Woodie Wagon","body":"wagon","price":2200,"bucks":0,"power":22,"grip":28,"weight":56,"unlock":1},"hauler":{"name":"Old Faithful Hauler","body":"truck","price":3000,"bucks":0,"power":26,"grip":26,"weight":70,"unlock":1},"cruiser":{"name":"Sunset Cruiser '57","body":"classic","price":5000,"bucks":0,"power":38,"grip":34,"weight":58,"unlock":1},"buggy":{"name":"Dune Skipper Buggy","body":"offroad","price":6000,"bucks":0,"power":34,"grip":56,"weight":18,"unlock":1},"bandit":{"name":"Night Bandit","body":"muscle","price":8000,"bucks":0,"power":56,"grip":38,"weight":54,"unlock":1},"lemans":{"name":"Liberty Endurance GT","body":"super","price":16000,"bucks":0,"power":72,"grip":62,"weight":32,"unlock":1},"gullwing":{"name":"Silver Wing 300","body":"coupe","price":30000,"bucks":0,"power":64,"grip":58,"weight":36,"unlock":1},"speedster":{"name":"Fairhaven Speedster","body":"roadster","price":12000,"bucks":0,"power":58,"grip":46,"weight":26,"unlock":1},"nightfall":{"name":"Aether Nightfall","body":"wedge","price":24000,"bucks":0,"power":78,"grip":72,"weight":30,"unlock":0}},"buildings":{"showroom":{"price":0,"obstacle":false,"fuelCap":0},"garage":{"price":0,"obstacle":false,"fuelCap":0},"rescue":{"price":1000,"obstacle":false,"fuelCap":0},"crew":{"price":2500,"obstacle":false,"fuelCap":0},"gas":{"price":1500,"obstacle":false,"fuelCap":10,"up":{"spend":[0,1150,2850,5400,9400,15400,24350,37650,57450,87000],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[10,12,14,16,18,20,22,24,26,28]}},"pizza":{"price":400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2650,4450,7150,11050,16800,25200],"coins":[120,132,172.8,187.2,252,270,288,408,432,456],"xp":[10,10,14.4,14.4,18,18,21,28,28,28],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"donut":{"price":1000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,750,1900,3600,6350,10450,16550,25600,39000,58900],"coins":[100,116.47,144,167.14,193.85,225,261.82,306,360,427.5],"xp":[8,9.18,10.4,12,12.92,15,17.45,19.2,22.67,25.5],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"burger":{"price":1400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1050,2650,5000,8750,14350,22700,35150,53700,81300],"coins":[100,120,144,164.21,197.65,225,256,313.85,360,414.55],"xp":[7.5,8.73,10.2,10.74,12.71,14.25,16,18.46,21,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"icecream":{"price":2000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1500,3750,7150,12400,20300,32100,49700,75950,115100],"coins":[92,108.43,132.48,156,184,207,245.33,276,331.2,374.57],"xp":[7.2,8.14,9.6,10.96,12.57,13.8,15.33,16.94,20,22.29],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"carwash":{"price":2300,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1750,4350,8250,14250,23300,36800,56950,87000,131900],"coins":[113.33,136,163.2,189.43,219.69,255,296.73,346.8,408,456],"xp":[8.33,9.45,11.2,12.43,13.85,15.5,18,20.4,23.33,25.41],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"diner":{"price":4600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,3450,8650,16400,28250,46000,72600,112400,171950,261050],"coins":[120,144,169.41,199.15,234.42,270,320,370.91,418.06,488.57],"xp":[8,9.16,10.35,11.74,13.4,15,17.33,19.64,21.68,24.86],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tires":{"price":2300,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1750,4350,8250,14250,23300,36800,56950,87000,131900],"coins":[100,125.45,137.56,171.89,190.59,225,273.1,297.78,350.4,386.09],"xp":[5,5.73,6.44,7.46,8.47,9.38,10.76,12,13.44,15.13],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bowling":{"price":6700,"obstacle":false,"fuelCap":0,"up":{"spend":[0,5050,12600,23900,41050,66800,105350,163100,249550,379050],"coins":[108.57,130.29,154.14,182.4,212.8,248.73,286.12,329.87,381.77,433.2],"xp":[7.86,9.04,10.31,11.63,13.2,15.05,16.94,18.89,21.49,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"motel":{"price":9600,"obstacle":false,"fuelCap":0,"up":{"spend":[0,7200,18000,34200,58700,95450,150550,233050,356650,541900],"coins":[87.5,105,123.93,146.25,171.26,198.95,231.72,267.75,306.49,352.06],"xp":[5.83,6.73,7.57,8.68,9.79,11.12,12.55,14.25,15.89,18],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tuner":{"price":15200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,11400,28500,54150,92850,150850,237800,368150,563550,856400],"coins":[153,186.33,216,259.87,298.88,352.41,402.41,470.33,533.03,617.26],"xp":[7,8.07,9.06,10.45,11.72,13.37,14.96,17.01,18.97,21.47],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"stadium":{"price":40000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,30000,75000,142500,243950,396150,624350,966550,1479750,2249300],"coins":[140,167.49,198.3,234,273.49,318.99,369.91,426.27,490.38,563.29],"xp":[10,11.42,12.98,14.79,16.74,18.99,21.47,24.18,27.24,30.71],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"cinema":{"price":10500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,7900,19700,37400,64200,104350,164550,254750,389900,592450],"coins":[112,134.4,158.12,187.87,218.79,255.19,294.58,341.01,390.19,448],"xp":[8,9.16,10.35,11.87,13.4,15.19,17.1,19.34,21.68,24.42],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"coffee":{"price":800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,600,1500,2850,5100,8450,13400,20750,31600,47700],"coins":[100,120,144,173.33,186.67,225,274.29,291.43,360,380],"xp":[8,8.73,10.8,12,13.33,15,17.14,18.86,22,24],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"tacos":{"price":1700,"obstacle":false,"fuelCap":0,"up":{"spend":[0,1300,3200,6050,10550,17300,27400,42400,64800,98200],"coins":[105,126,151.2,172.42,207.53,236.25,268.8,329.54,378,435.27],"xp":[8,9.27,10.8,11.37,13.41,15,16.8,20.31,22,25.09],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"lube":{"price":3800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,2850,7150,13550,23350,38100,60150,93100,142400,216150],"coins":[100,122.18,145.88,160.85,192.56,225,270,316.36,340.65,402.86],"xp":[5,5.67,6.59,7.4,8.37,9.3,11,12.36,13.55,15.43],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"arcade":{"price":5800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,4350,10900,20700,35600,57900,91350,141400,216300,328500],"coins":[106.67,128,151.08,178.29,206.77,245.11,279.27,326.4,373.62,429.18],"xp":[7.5,8.55,9.84,11.14,12.46,14.3,16.09,18.3,20.43,22.94],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bodyshop":{"price":11400,"obstacle":false,"fuelCap":0,"up":{"spend":[0,8550,21400,40650,69700,113300,178650,276550,423250,643100],"coins":[101,121.2,142.59,169.42,197.3,230.13,265.64,307.52,351.87,404],"xp":[7.5,8.62,9.76,11.1,12.56,14.28,16.11,18.09,20.32,22.95],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"market":{"price":19000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,14250,35650,67700,116000,188450,297050,459850,703900,1069800],"coins":[112,133.59,159.16,187.2,218.79,254.12,295.93,342.72,394.43,450.64],"xp":[7.33,8.39,9.55,10.8,12.28,13.92,15.74,17.88,20.09,22.59],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"firehouse":{"price":24000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,18000,45000,85500,146450,237900,375000,580550,888700,1350700],"coins":[119,142.15,168.83,198.55,232.47,271.14,312.99,362.33,417.95,480.21],"xp":[7.5,8.58,9.75,11.1,12.56,14.28,16.03,18.18,20.49,23.15],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"police":{"price":32000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,24000,60000,114000,195200,317000,499650,773550,1184200,1800000],"coins":[126,150.65,178.58,210,246.14,286.36,332.31,384.79,441.82,505.77],"xp":[8,9.13,10.39,11.79,13.4,15.15,17.14,19.4,21.82,24.51],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"parkade":{"price":60000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,45000,112500,213750,365850,593950,936050,1449150,2218600,3372600],"coins":[154,183.96,218.48,256.94,300.84,350.89,406.43,468.9,540.88,618.71],"xp":[9.5,10.83,12.35,14.02,15.91,18.04,20.37,22.97,25.95,29.13],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"club":{"price":8800,"obstacle":false,"fuelCap":0,"up":{"spend":[0,6600,16500,31350,53850,87550,138050,213750,327100,496950],"coins":[150,180,211.76,248.94,293.02,337.5,400,463.64,522.58,610.71],"xp":[12,13.75,15.53,17.62,20.09,22.5,26,29.45,32.52,37.29],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"parts":{"price":8000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,6000,15000,28500,48950,79650,125600,194450,297550,452000],"coins":[113.75,139.91,161.78,193.28,221.57,264.76,301.24,349.33,401.14,467.73],"xp":[5.63,6.41,7.41,8.32,9.39,10.67,12.21,13.56,15.43,17.33],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"offices":{"price":16500,"obstacle":false,"fuelCap":0,"up":{"spend":[0,12400,30950,58800,100750,163700,258050,399500,611550,929400],"coins":[100,119.28,142.11,167.14,195.35,226.89,264.22,306,352.17,402.35],"xp":[6.67,7.59,8.68,9.86,11.16,12.61,14.31,16.2,18.26,20.47],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"hospital":{"price":48000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,36000,90000,171000,292700,475250,749050,1159600,1775300,2698650],"coins":[133.33,159.52,188.85,222.86,260.47,303.8,352.29,405.97,467.03,536.47],"xp":[9.33,10.66,12.12,13.8,15.63,17.72,20.04,22.57,25.43,28.66],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"hq":{"price":82000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,61500,153750,292150,499900,811550,1278950,1979950,3031350,4608250],"coins":[138.89,166,196.94,232.14,271.32,316.01,366.97,423.59,487.36,558.82],"xp":[9.78,11.15,12.71,14.46,16.37,18.54,20.99,23.68,26.69,30.02],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"helipad":{"price":115000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,86250,215650,409700,701000,1137950,1793300,2776250,4250500,6461700],"coins":[157,187.72,222.52,262.23,306.7,357.72,414.07,478.03,550.52,632.44],"xp":[10.4,11.87,13.51,15.37,17.41,19.75,22.29,25.15,28.36,31.97],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"glasstower":{"price":185000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,138750,346900,659100,1127600,1830300,2884350,4465300,6836550,10393250],"coins":[160,191.42,227,266.95,312.56,363.79,421.78,487.16,560.43,643.76],"xp":[11.67,13.32,15.17,17.22,19.53,22.11,24.99,28.21,31.78,35.82],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"academy":{"price":16000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,12000,30000,57000,97700,158750,250300,387500,593150,901400],"coins":[92,109.73,130.74,153.77,179.72,208.74,243.08,281.52,324,370.16],"xp":[9.33,10.63,12.16,13.8,15.63,17.65,20.04,22.68,25.57,28.66],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"school":{"price":48000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,36000,90000,171000,292700,475250,749050,1159600,1775300,2698650],"coins":[122.86,147.05,174.42,205.14,240,279.42,323.76,374.87,430,495.15],"xp":[8.57,9.79,11.15,12.66,14.35,16.25,18.35,20.77,23.33,26.36],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"highschool":{"price":110000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,82500,206250,391900,670550,1088500,1715400,2655650,4065850,6180950],"coins":[164.44,196.54,233.17,274.86,321.24,374.16,434.5,501.53,577.04,661.65],"xp":[9.56,10.91,12.42,14.11,16,18.13,20.51,23.16,26.08,29.36],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"university":{"price":240000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,180000,450000,855000,1462700,2374250,3741550,5792350,8868400,13482300],"coins":[183.33,219.34,260.1,305.88,358.14,416.84,483.3,558.21,642.16,737.65],"xp":[9.33,10.66,12.14,13.78,15.63,17.68,19.99,22.57,25.43,28.66],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"bush":{"price":150,"obstacle":true,"fuelCap":0},"rock":{"price":400,"obstacle":true,"fuelCap":0},"cactus":{"price":1500,"obstacle":true,"fuelCap":0},"house":{"price":250,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2750,4800,7900,12550,19600,30300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,1,2,3,4,5,6,7,8,9]}},"tree":{"price":50,"obstacle":false,"fuelCap":0},"palm":{"price":120,"obstacle":false,"fuelCap":0},"fountain":{"price":800,"obstacle":false,"fuelCap":0},"flowers":{"price":80,"obstacle":false,"fuelCap":0},"lamp":{"price":60,"obstacle":false,"fuelCap":0},"bench":{"price":70,"obstacle":false,"fuelCap":0},"billboard":{"price":600,"obstacle":false,"fuelCap":0},"statue":{"price":0,"obstacle":false,"fuelCap":0},"pond":{"price":1500,"obstacle":false,"fuelCap":0},"pine":{"price":60,"obstacle":false,"fuelCap":0},"hedge":{"price":40,"obstacle":false,"fuelCap":0},"fence":{"price":30,"obstacle":false,"fuelCap":0},"picnic":{"price":90,"obstacle":false,"fuelCap":0},"busstop":{"price":200,"obstacle":false,"fuelCap":0},"hotdog":{"price":350,"obstacle":false,"fuelCap":0},"flagpole":{"price":300,"obstacle":false,"fuelCap":0},"arch":{"price":0,"obstacle":false,"fuelCap":0},"playground":{"price":1800,"obstacle":false,"fuelCap":0},"gazebo":{"price":1200,"obstacle":false,"fuelCap":0},"clocktower":{"price":3500,"obstacle":false,"fuelCap":0},"trailer":{"price":200,"obstacle":false,"fuelCap":0,"up":{"spend":[0,300,750,1450,2750,4800,7900,12550,19600,30300],"coins":[0,0,0,0,0,0,0,0,0,0],"xp":[0,0,0,0,0,0,0,0,0,0],"fuel":[0,1,2,3,4,5,6,7,8,9]}},"junkyard":{"price":21000,"obstacle":false,"fuelCap":0,"up":{"spend":[0,15750,39400,74850,128200,208250,328250,508150,777850,1182200],"coins":[126.67,150.36,178.42,213.43,248.37,287.39,333.58,385.2,448.7,511.06],"xp":[7,7.95,9.16,10.37,11.72,13.21,15.08,17.04,19.17,21.46],"fuel":[0,0,0,0,0,0,0,0,0,0]}},"dogpark":{"price":1600,"obstacle":false,"fuelCap":0},"skatepark":{"price":2400,"obstacle":false,"fuelCap":0},"koi":{"price":3000,"obstacle":false,"fuelCap":0},"garden":{"price":4800,"obstacle":false,"fuelCap":0},"pumpkins":{"price":250,"obstacle":false,"fuelCap":0},"scarecrow":{"price":450,"obstacle":false,"fuelCap":0},"graves":{"price":700,"obstacle":false,"fuelCap":0},"deadtree":{"price":1200,"obstacle":false,"fuelCap":0}},"goals":{"g0":{"coins":200,"xp":20,"bucks":0},"r1":{"coins":150,"xp":15,"bucks":0},"r2":{"coins":300,"xp":25,"bucks":1},"g1":{"coins":150,"xp":15,"bucks":0},"g2":{"coins":100,"xp":10,"bucks":0},"g3":{"coins":300,"xp":25,"bucks":0},"g4":{"coins":250,"xp":20,"bucks":0},"q1":{"coins":250,"xp":20,"bucks":0},"g5":{"coins":200,"xp":20,"bucks":0},"q2":{"coins":200,"xp":15,"bucks":0},"g6":{"coins":300,"xp":25,"bucks":0},"g7":{"coins":150,"xp":15,"bucks":0},"q3":{"coins":300,"xp":25,"bucks":0},"g8":{"coins":500,"xp":40,"bucks":1},"q4":{"coins":400,"xp":0,"bucks":0},"q5":{"coins":600,"xp":50,"bucks":0},"g9":{"coins":600,"xp":50,"bucks":0},"q6":{"coins":500,"xp":40,"bucks":0},"q7":{"coins":500,"xp":40,"bucks":0},"q8":{"coins":500,"xp":40,"bucks":0},"g10":{"coins":800,"xp":60,"bucks":1},"q9":{"coins":800,"xp":60,"bucks":0},"q10":{"coins":800,"xp":60,"bucks":0},"g11":{"coins":1000,"xp":70,"bucks":0},"q11":{"coins":1000,"xp":70,"bucks":0},"q12":{"coins":1000,"xp":0,"bucks":1},"gp1":{"coins":2000,"xp":150,"bucks":2},"q13":{"coins":1200,"xp":80,"bucks":0},"r3":{"coins":3000,"xp":200,"bucks":2},"q14":{"coins":1500,"xp":100,"bucks":0},"g12":{"coins":1200,"xp":80,"bucks":2},"q15":{"coins":2000,"xp":120,"bucks":0},"q16":{"coins":2000,"xp":120,"bucks":0},"q17":{"coins":2500,"xp":150,"bucks":1},"g13":{"coins":1500,"xp":100,"bucks":0},"q18":{"coins":2500,"xp":150,"bucks":0},"q19":{"coins":2500,"xp":150,"bucks":0},"g14":{"coins":2500,"xp":150,"bucks":2},"q20":{"coins":3000,"xp":0,"bucks":1},"q21":{"coins":3000,"xp":200,"bucks":0},"q22":{"coins":3000,"xp":200,"bucks":0},"g15":{"coins":5000,"xp":250,"bucks":3},"g16":{"coins":5000,"xp":250,"bucks":3},"q23":{"coins":6000,"xp":300,"bucks":2},"q24":{"coins":6000,"xp":300,"bucks":2},"q25":{"coins":6000,"xp":0,"bucks":2},"q26":{"coins":8000,"xp":400,"bucks":0},"q27":{"coins":8000,"xp":400,"bucks":2},"q28":{"coins":8000,"xp":400,"bucks":0},"q29":{"coins":10000,"xp":500,"bucks":2},"q30":{"coins":12000,"xp":600,"bucks":3},"q31":{"coins":12000,"xp":600,"bucks":2},"q32":{"coins":20000,"xp":800,"bucks":5},"q33":{"coins":20000,"xp":800,"bucks":3},"q34":{"coins":20000,"xp":0,"bucks":3},"q35":{"coins":30000,"xp":1000,"bucks":5},"q36":{"coins":30000,"xp":1000,"bucks":3},"q37":{"coins":30000,"xp":1000,"bucks":3},"q38":{"coins":50000,"xp":0,"bucks":5},"sp1":{"coins":300,"xp":25,"bucks":0},"sp2":{"coins":1000,"xp":60,"bucks":1},"sp3":{"coins":1500,"xp":80,"bucks":0},"sp4":{"coins":3000,"xp":150,"bucks":3}},"gp":{"rookie":{"unlock":2,"box":["trail","miata","woodie","cruiser"]},"street":{"unlock":8,"box":["stallion","rally","buggy","bandit"]},"pro":{"unlock":15,"box":["vette","charger","lemans"]},"legends":{"unlock":26,"box":["gtr","gullwing","shinden","lambo"]}},"rescue":{"pip":1,"civic":1,"bug":1,"woodie":1,"trail":1,"miata":1,"hauler":4,"buggy":4,"stallion":4,"cruiser":9,"rally":9,"bandit":9,"vette":9,"charger":15,"lemans":15,"gtr":15,"speedster":15,"gullwing":24,"hyper":24},"upgradeXpTo":[0,15,35,60,90,125,165,210,260,315],"mods":{"ducktail":{"slot":"spoiler","coins":1200,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":16,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"gtwing":{"slot":"spoiler","coins":4000,"parts":10,"bucks":0,"power":0,"grip":4,"weight":0,"xp":25,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"attackwing":{"slot":"spoiler","coins":0,"parts":0,"bucks":12,"power":0,"grip":6,"weight":0,"xp":46,"notOn":["bus","tank","dogvan","tusker","scooter","chopper","sportbike"]},"twintips":{"slot":"exhaust","coins":1000,"parts":0,"bucks":0,"power":2,"grip":0,"weight":0,"xp":16},"sidepipes":{"slot":"exhaust","coins":3500,"parts":8,"bucks":0,"power":4,"grip":0,"weight":0,"xp":22},"flamepipes":{"slot":"exhaust","coins":0,"parts":0,"bucks":10,"power":6,"grip":0,"weight":0,"xp":46},"streetkit":{"slot":"kit","coins":1500,"parts":0,"bucks":0,"power":0,"grip":1,"weight":-2,"xp":19,"notOn":["scooter","chopper","sportbike"]},"widebody":{"slot":"kit","coins":6000,"parts":15,"bucks":0,"power":0,"grip":3,"weight":-3,"xp":28,"notOn":["scooter","chopper","sportbike"]},"carbonkit":{"slot":"kit","coins":0,"parts":0,"bucks":15,"power":0,"grip":3,"weight":-6,"xp":58,"notOn":["scooter","chopper","sportbike"]},"vented":{"slot":"hood","coins":800,"parts":0,"bucks":0,"power":1,"grip":0,"weight":-1,"xp":16,"notOn":["scooter","chopper","sportbike","formula"]},"ramscoop":{"slot":"hood","coins":3000,"parts":6,"bucks":0,"power":3,"grip":0,"weight":0,"xp":22,"notOn":["scooter","chopper","sportbike","formula"]},"blower":{"slot":"hood","coins":8000,"parts":20,"bucks":0,"power":5,"grip":0,"weight":0,"xp":31,"notOn":["scooter","chopper","sportbike","formula"]},"chrome":{"slot":"rims","coins":600,"parts":0,"bucks":0,"power":0,"grip":0,"weight":-1,"xp":13},"goldmesh":{"slot":"rims","coins":2500,"parts":5,"bucks":0,"power":0,"grip":1,"weight":-2,"xp":22},"luggage":{"slot":"spoiler","coins":2500,"parts":0,"bucks":0,"power":0,"grip":2,"weight":1,"xp":19,"only":["bus"]},"stacks":{"slot":"exhaust","coins":3000,"parts":5,"bucks":0,"power":3,"grip":0,"weight":0,"xp":19,"only":["bus"]},"cowcatcher":{"slot":"kit","coins":3500,"parts":8,"bucks":0,"power":0,"grip":2,"weight":0,"xp":22,"only":["bus"]},"disco":{"slot":"hood","coins":0,"parts":0,"bucks":6,"power":2,"grip":0,"weight":0,"xp":25,"only":["bus"]},"flag":{"slot":"spoiler","coins":6000,"parts":10,"bucks":0,"power":0,"grip":3,"weight":0,"xp":40,"only":["tank"]},"smoke":{"slot":"exhaust","coins":0,"parts":0,"bucks":8,"power":5,"grip":0,"weight":0,"xp":40,"only":["tank"]},"reactive":{"slot":"kit","coins":9000,"parts":20,"bucks":0,"power":0,"grip":4,"weight":1,"xp":40,"only":["tank"]},"watercannon":{"slot":"hood","coins":0,"parts":0,"bucks":12,"power":4,"grip":0,"weight":0,"xp":40,"only":["tank"]},"bigtail":{"slot":"spoiler","coins":1500,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":22,"only":["dogvan"]},"bubbles":{"slot":"exhaust","coins":0,"parts":0,"bucks":5,"power":2,"grip":0,"weight":0,"xp":22,"only":["dogvan"]},"collar":{"slot":"kit","coins":2000,"parts":4,"bucks":0,"power":0,"grip":1,"weight":-1,"xp":22,"only":["dogvan"]},"bone":{"slot":"hood","coins":1200,"parts":0,"bucks":0,"power":1,"grip":0,"weight":0,"xp":22,"only":["dogvan"]},"radar":{"slot":"spoiler","coins":4500,"parts":10,"bucks":0,"power":0,"grip":3,"weight":0,"xp":37,"only":["tusker"]},"snorkel":{"slot":"exhaust","coins":3000,"parts":6,"bucks":0,"power":3,"grip":0,"weight":0,"xp":37,"only":["tusker"]},"plating":{"slot":"kit","coins":7000,"parts":15,"bucks":0,"power":0,"grip":4,"weight":1,"xp":37,"only":["tusker"]},"lightbar":{"slot":"hood","coins":3500,"parts":6,"bucks":0,"power":2,"grip":0,"weight":0,"xp":37,"only":["tusker"]},"tailfairing":{"slot":"spoiler","coins":1500,"parts":0,"bucks":0,"power":0,"grip":2,"weight":0,"xp":16,"only":["scooter","chopper","sportbike"]},"saddlebags":{"slot":"kit","coins":1800,"parts":0,"bucks":0,"power":0,"grip":1,"weight":-1,"xp":16,"only":["scooter","chopper","sportbike"]},"windscreen":{"slot":"hood","coins":1200,"parts":0,"bucks":0,"power":1,"grip":0,"weight":0,"xp":16,"only":["scooter","chopper","sportbike"]},"campod":{"slot":"hood","coins":2000,"parts":4,"bucks":0,"power":1,"grip":0,"weight":0,"xp":43,"only":["formula"]},"bargeboards":{"slot":"kit","coins":0,"parts":0,"bucks":10,"power":0,"grip":3,"weight":-3,"xp":43,"only":["formula"]},"raintires":{"slot":"tires","coins":2500,"parts":4,"bucks":0,"power":0,"grip":0,"weight":0,"xp":19},"sandtires":{"slot":"tires","coins":3000,"parts":5,"bucks":0,"power":0,"grip":0,"weight":0,"xp":22},"snowstuds":{"slot":"tires","coins":3500,"parts":6,"bucks":0,"power":0,"grip":0,"weight":0,"xp":22},"allweather":{"slot":"tires","coins":0,"parts":0,"bucks":12,"power":0,"grip":0,"weight":0,"xp":31},"forged":{"slot":"rims","coins":7000,"parts":12,"bucks":0,"power":0,"grip":2,"weight":-3,"xp":31}},"driverBonus":0.25,"campaign":{"c1":{"unlock":1,"races":["c1-0","c1-1","c1-2","c1-3","c1-4"],"coins":1000,"bucks":1,"trophies":3,"starBucks":1},"c2":{"unlock":4,"races":["c2-0","c2-1","c2-2","c2-3","c2-4"],"coins":2000,"bucks":1,"trophies":3,"starBucks":1},"c3":{"unlock":8,"races":["c3-0","c3-1","c3-2","c3-3","c3-4"],"coins":3500,"bucks":2,"trophies":4,"starBucks":1},"c4":{"unlock":13,"races":["c4-0","c4-1","c4-2","c4-3","c4-4"],"coins":5500,"bucks":2,"trophies":5,"starBucks":2},"c5":{"unlock":19,"races":["c5-0","c5-1","c5-2","c5-3","c5-4"],"coins":8000,"bucks":3,"trophies":6,"starBucks":2},"c6":{"unlock":26,"races":["c6-0","c6-1","c6-2","c6-3","c6-4"],"coins":12000,"bucks":3,"trophies":8,"starBucks":2},"c7":{"unlock":33,"races":["c7-0","c7-1","c7-2","c7-3","c7-4"],"coins":20000,"bucks":5,"trophies":10,"starBucks":3}},"sets":{"daily":{"cars":["pip","civic","trail","miata"],"coins":1500,"bucks":2,"trophies":5,"xp":60},"bikes":{"cars":["zippy","baron","shinden"],"coins":4000,"bucks":3,"trophies":10,"xp":120},"classics":{"cars":["bug","woodie","hauler","cruiser","buggy"],"coins":5000,"bucks":5,"trophies":15,"xp":150},"muscle":{"cars":["stallion","charger","hellcat","bandit"],"coins":8000,"bucks":5,"trophies":15,"xp":200},"track":{"cars":["rally","vette","gtr","lemans","gullwing"],"coins":15000,"bucks":8,"trophies":25,"xp":300},"roadtrip":{"cars":["camper","ridgeback","stomper","shaggy"],"coins":6000,"bucks":4,"trophies":12,"xp":160},"tuners":{"cars":["hotshot","kitsune","current"],"coins":7000,"bucks":4,"trophies":12,"xp":180},"grandtour":{"cars":["salon","speedster","monoposto"],"coins":20000,"bucks":10,"trophies":30,"xp":350},"heavy":{"cars":["schoolbus","tusker"],"coins":6000,"bucks":3,"trophies":10,"xp":150},"dream":{"cars":["lambo","hyper","tomahawk","zenith"],"coins":30000,"bucks":15,"trophies":40,"xp":500},"autobahn":{"cars":["kreis","bergmeister","ringmeister","sovereign"],"coins":20000,"bucks":10,"trophies":30,"xp":350},"apex":{"cars":["rattler","cottonmouth","raiden","wraith"],"coins":30000,"bucks":15,"trophies":40,"xp":500},"restomods":{"cars":["sprint","revenant","pontone"],"coins":30000,"bucks":15,"trophies":40,"xp":500},"exotica":{"cars":["fulmine","eclat","orafo"],"coins":40000,"bucks":20,"trophies":50,"xp":600},"seasons":{"cars":["nightfall"],"coins":5000,"bucks":3,"trophies":10,"xp":150},"rusty-suburbs":{"cars":["pip","civic","bug","woodie","trail","miata"],"coins":2500,"bucks":2,"trophies":5,"xp":80},"rusty-farm":{"cars":["bug","trail","hauler","woodie","buggy","stallion"],"coins":5000,"bucks":3,"trophies":8,"xp":120},"rusty-downtown":{"cars":["civic","cruiser","rally","bandit","stallion","vette"],"coins":10000,"bucks":4,"trophies":12,"xp":180},"rusty-desert":{"cars":["buggy","bandit","stallion","charger","lemans","gtr","speedster"],"coins":20000,"bucks":6,"trophies":20,"xp":260},"rusty-track":{"cars":["vette","lemans","charger","gullwing","gtr","hyper"],"coins":40000,"bucks":10,"trophies":30,"xp":400}},"quests":{"daily":{"count":3,"task":{"coins":150,"coinsPerLevel":50,"xp":20,"xpPerLevel":5},"chest":{"coins":300,"coinsPerLevel":100,"xp":0,"xpPerLevel":0,"parts":5,"bucks":0,"fuel":10}},"weekly":{"count":3,"task":{"coins":500,"coinsPerLevel":150,"xp":100,"xpPerLevel":20},"chest":{"coins":1000,"coinsPerLevel":250,"xp":0,"xpPerLevel":0,"parts":20,"bucks":3,"fuel":0}}},"season":{"start":"2026-10-05","days":42,"perTier":8,"stars":{"dailyTask":1,"dailyChest":3,"weeklyTask":3,"weeklyChest":6},"tiers":[{"coins":650,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":5,"bucks":0,"car":false},{"coins":950,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":7,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":2,"car":false},{"coins":0,"parts":9,"bucks":0,"car":false},{"coins":1550,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":9,"bucks":0,"car":false},{"coins":1850,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":3,"car":false},{"coins":2150,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":13,"bucks":0,"car":false},{"coins":2450,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":13,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":4,"car":false},{"coins":0,"parts":15,"bucks":0,"car":false},{"coins":3050,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":17,"bucks":0,"car":false},{"coins":3350,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":5,"car":false},{"coins":3650,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":19,"bucks":0,"car":false},{"coins":3950,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":21,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":6,"car":false},{"coins":0,"parts":21,"bucks":0,"car":false},{"coins":4550,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":23,"bucks":0,"car":false},{"coins":4850,"parts":0,"bucks":0,"car":false},{"coins":0,"parts":0,"bucks":0,"car":true}],"carBucks":15,"cars":{"1":"nightfall"}},"deals":{"slots":[["parts10","fuel","parts25","parts50"],["mod-chrome","mod-twintips","mod-vented","mod-ducktail","mod-streetkit","paint-matte","mod-goldmesh","mod-ramscoop","mod-sidepipes","mod-gtwing","mod-widebody","mod-blower","mod-forged","paint-chrome"],["decor-fountain","decor-pond","decor-playground","decor-gazebo","decor-clocktower","decor-billboard","decor-hotdog","decor-statue"]],"step":[3,5,3],"save":{"parts10":200,"fuel":0,"parts25":500,"parts50":1000,"mod-chrome":240,"mod-twintips":400,"mod-vented":320,"mod-ducktail":480,"mod-streetkit":600,"paint-matte":0,"mod-goldmesh":750,"mod-ramscoop":900,"mod-sidepipes":1050,"mod-gtwing":1200,"mod-widebody":1800,"mod-blower":2400,"mod-forged":2100,"paint-chrome":0,"decor-fountain":320,"decor-pond":600,"decor-playground":720,"decor-gazebo":480,"decor-clocktower":1400,"decor-billboard":240,"decor-hotdog":140,"decor-statue":0}},"crew":{"chest":{"coins":1500,"coinsPerLevel":300,"xp":0,"xpPerLevel":0,"parts":25,"bucks":5,"fuel":0}},"rivals":{"vinnie":{"unlock":2,"coins":1500,"bucks":1,"trophies":3},"polly":{"unlock":5,"coins":2500,"bucks":1,"trophies":3},"duke":{"unlock":9,"coins":4000,"bucks":2,"trophies":4},"roxy":{"unlock":14,"coins":6500,"bucks":2,"trophies":5},"clutchula":{"unlock":20,"coins":10000,"bucks":3,"trophies":6},"nova":{"unlock":27,"coins":15000,"bucks":3,"trophies":8}}}$catalog$::jsonb
-- catalog:end
$$;

create or replace function public.rescue_roll(spot text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  -- rescue:begin
  spots jsonb := $spots${"suburbs":{"unlock":1,"cars":[["pip","common"],["civic","common"],["bug","common"],["woodie","scarce"],["trail","scarce"],["miata","rare"]]},"farm":{"unlock":4,"cars":[["bug","common"],["trail","common"],["hauler","common"],["woodie","scarce"],["buggy","scarce"],["stallion","rare"]]},"downtown":{"unlock":9,"cars":[["civic","common"],["cruiser","common"],["rally","scarce"],["bandit","scarce"],["stallion","scarce"],["vette","rare"]]},"desert":{"unlock":15,"cars":[["buggy","common"],["bandit","common"],["stallion","scarce"],["charger","scarce"],["lemans","rare"],["gtr","rare"],["speedster","rare"]]},"track":{"unlock":24,"cars":[["vette","common"],["lemans","common"],["charger","scarce"],["gullwing","scarce"],["gtr","rare"],["hyper","rare"]]}}$spots$::jsonb;
  rar jsonb := $rarity${"common":{"weight":60,"minutes":5},"scarce":{"weight":30,"minutes":30},"rare":{"weight":10,"minutes":120}}$rarity$::jsonb;
  roll jsonb := $roll${"pins":8,"car":0.1}$roll$::jsonb;
  -- rescue:end
  -- What a search at each spot costs (RESCUE_SPOTS in src/game/data.ts).
  -- spotcost:begin
  costs jsonb := $spotcost${"suburbs":500,"farm":1500,"downtown":3500,"desert":7000,"track":15000}$spotcost$::jsonb;
  -- spotcost:end
  -- Rusty's add-ons (hotTable(), truckTable() in src/game/guardTables.ts).
  -- rusty:begin
  hot jsonb := $hot${"rare":3}$hot$::jsonb;
  truck jsonb := $truck$[{"pins":8,"parts":0,"level":1},{"pins":9,"parts":25,"level":4},{"pins":10,"parts":60,"level":9},{"pins":11,"parts":120,"level":15}]$truck$::jsonb;
  pz jsonb := $piece${"gap":90,"day":12}$piece$::jsonb;
  -- rusty:end
  last_at timestamptz;
  n_today int;
  st jsonb;
  tl int;
  npins int;
  hot_spot text;
  piece jsonb;
  sp jsonb := spots -> spot;
  lvl int;
  pins int[] := '{}';
  cars jsonb := '[]';
  total numeric;
  r numeric;
  c jsonb;
  u text;
  i int;
begin
  if me is null then
    raise exception 'sign in to search' using errcode = 'insufficient_privilege';
  end if;
  if sp is null then
    raise exception 'no such spot' using errcode = 'invalid_parameter_value';
  end if;
  select g.level, g.state into lvl, st from public.game_saves g where g.owner_id = me;
  if coalesce(lvl, 0) < (sp ->> 'unlock')::int then
    raise exception 'spot not open yet' using errcode = 'insufficient_privilege';
  end if;
  -- The tow truck's level (the save's `truck`, which econ_progress() checks) sets the spots per search.
  tl := least(greatest(coalesce(floor(public.econ_num(st, 'truck')), 0), 0), jsonb_array_length(truck) - 1)::int;
  npins := (truck -> tl ->> 'pins')::int;
  -- Rusty's hot tip: one open spot a UTC day, in unlock order (hotSpot() in src/game/data.ts),
  -- where rare cars turn up `hot.rare` times as often.
  select x.key into hot_spot from (
    select k.key, row_number() over (order by (k.value ->> 'unlock')::int) - 1 as n, count(*) over () as cnt
    from jsonb_each(spots) k where (k.value ->> 'unlock')::int <= coalesce(lvl, 0)) x
    where x.n = floor(extract(epoch from now()) / 86400)::bigint % x.cnt;
  perform pg_advisory_xact_lock(hashtext('rescue:' || me::text));
  if exists (select 1 from econ_private.rescue_finds f where f.owner_id = me and f.created_at > now() - interval '10 seconds') then
    raise exception 'Rusty is still out' using errcode = 'P0001';
  end if;
  -- This player's searches here before this one: the latest, and how many today (UTC).
  select max(f.created_at), count(distinct f.created_at) filter (where f.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')
    into last_at, n_today from econ_private.rescue_finds f where f.owner_id = me and f.spot = rescue_roll.spot;
  for i in 0 .. npins - 1 loop
    if random() < (roll ->> 'car')::numeric then pins := pins || i; end if;
  end loop;
  if cardinality(pins) = 0 then
    pins := array[floor(random() * npins)::int];
  end if;
  select sum((rar -> (x ->> 1) ->> 'weight')::numeric * case when spot = hot_spot and x ->> 1 = 'rare' then (hot ->> 'rare')::numeric else 1 end)
    into total from jsonb_array_elements(sp -> 'cars') x;
  foreach i in array pins loop
    r := random() * total;
    for c in select x from jsonb_array_elements(sp -> 'cars') x loop
      r := r - (rar -> (c ->> 1) ->> 'weight')::numeric * case when spot = hot_spot and c ->> 1 = 'rare' then (hot ->> 'rare')::numeric else 1 end;
      exit when r <= 0;
    end loop;
    u := 'r' || substr(md5(random()::text || clock_timestamp()::text || me::text), 1, 14);
    insert into econ_private.rescue_finds (uid, owner_id, spot, model, rarity, cost)
      values (u, me, spot, c ->> 0, c ->> 1, round(coalesce((costs ->> spot)::numeric, 0) / cardinality(pins)));
    cars := cars || jsonb_build_object('i', i, 'uid', u, 'model', c ->> 0, 'rarity', c ->> 1);
  end loop;
  -- Rusty's top spot can turn up a resto-mod piece (econ_private.resto_piece_roll(), from the
  -- resto-mod migration; skipped until that has run). It comes back as a crate_opens row.
  -- One roll per real search: none if the last search here was under `piece.gap` seconds ago,
  -- and at most `piece.day` a UTC day (counted from Rusty's finds, so quick searches use them up).
  if spot = 'track' and to_regprocedure('econ_private.resto_piece_roll(uuid,text)') is not null
     and coalesce(last_at, '-infinity') < now() - make_interval(secs => (pz ->> 'gap')::int) and n_today < (pz ->> 'day')::int then
    execute 'select econ_private.resto_piece_roll($1, $2)' into piece using me, 'rusty_track';
  end if;
  return jsonb_build_object('cars', cars) || case when piece is not null then jsonb_build_object('piece', piece) else '{}' end;
end $$;

create or replace function econ_private.econ_progress() returns trigger
language plpgsql set search_path = '' as $$
declare
  o jsonb := old.state;
  s jsonb := new.state;
  e jsonb := coalesce(new.econ, '{}');
  bay jsonb; -- the server's record of the car in a restore bay (econ 'bay' and 'bay2')
  -- Rusty's add-ons (truckTable(), bay2Table() in src/game/guardTables.ts).
  -- rusty:begin
  truck jsonb := $truck$[{"pins":8,"parts":0,"level":1},{"pins":9,"parts":25,"level":4},{"pins":10,"parts":60,"level":9},{"pins":11,"parts":120,"level":15}]$truck$::jsonb;
  bay2 jsonb := $bay2${"level":12}$bay2$::jsonb;
  -- rusty:end
  bk text;
  ek text;
  fk text;
  need numeric;
  t_o int;
  t_n int;
  keep boolean := false;
  fixes jsonb := '{}';
  now_s numeric := extract(epoch from now());
  -- Shortest restore minutes per car (src/game/guardTables.ts, restoreMinutes()).
  -- restore:begin
  rmins jsonb := $restoremin${"pip":5,"civic":5,"bug":5,"woodie":30,"trail":5,"miata":120,"hauler":5,"buggy":5,"stallion":30,"cruiser":5,"rally":30,"bandit":5,"vette":5,"charger":30,"lemans":5,"gtr":120,"speedster":120,"gullwing":30,"hyper":120}$restoremin$::jsonb;
  -- restore:end
  -- Restore minutes for each rarity (guardTables.ts, rarities()).
  rar jsonb := $rarity${"common":{"weight":60,"minutes":5},"scarce":{"weight":30,"minutes":30},"rare":{"weight":10,"minutes":120}}$rarity$::jsonb;
  o_junk text[];
  junk jsonb;
  f record;
  ok boolean;
  -- Each series' last rival PI before any clears, and for each rival PI the lowest car PI that
  -- can beat it (guardTables.ts, gpSeries() and gpBeatTable()).
  -- gp:begin
  gp_last jsonb := $gpseries${"rookie":{"last":37},"street":{"last":55},"pro":{"last":71},"legends":{"last":87}}$gpseries$::jsonb;
  beat jsonb := $gpbeat$[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,3,3,4,5,6,6,7,8,8,9,10,11,11,12,13,13,14,15,15,16,17,18,18,19,20,20,21,22,23,23,24,25,25,26,27,28,28,29,30,30,31,32,33,33,34,35,35,36,37,37,38,39,40,40,41,42,42,43,44,44,45,46,46,47,48,49,49,50,51,51,52,53,54,54,55,56,56,57,58,58,59,60,60,61,62,63,63,64,65,65,66,67,67,68,69,69,70,71,72,72,73,73,74,75,76,76,77,78,78,79,80,80,81,82,82,84,84,85,86,86,87,88,89,89,90,91,91,92,93,93,94,95,95,96,97,98,99,99,100,100,101,102,102,103,104,104,105,106,107,107,108,108,109,110,110,111,112,112,113,114,114,115,116,116,117,118,118,119,119,120,121,121,122,123,123,124,125,125,126,126,127,128,128,129,130,130,131,132,132,133,134,134,135,135,136,137,138,138,139,139,140,141,141,142,143,143,144,144,145,146,146,147,148,148,149,149,150,151,151,152,153,153,154,155,155,156,156,157,158,158,158,159,160,161,161,162,163,163,164,164,165,166,166,167,168,168,169,169,170,171,171,172,173,173,174,174,175,175,176,177,177,178,179,179,180,181,181,181,182,183,184,184,185,185,186,186,187,188,188,189,190,190,191,192,192,193,193,194,194,195,196,196,197,197,198,199,200,200,201,201,202,202,203,203,204,205,205,206,207,207,208,209,209,210,210,211,211,212,213,214,214,215,215,216,216,217,217,218,219,220,220,221,221,222,222,223,224,224,225,225,226,226,228,228,228,229,230,230,231,232,232,232,233,234]$gpbeat$::jsonb;
  -- gp:end
  cat jsonb;
  cars jsonb;
  o_uids text[];
  orr jsonb;
  sr jsonb;
  out_uid text;
  paid numeric;
  left_s numeric;
  done boolean;
  removed boolean := false;
  k text;
  v jsonb;
  oc numeric;
  sc numeric;
  rival int;
  my_pi int;
  prize text;
begin
  if tg_op <> 'UPDATE' or current_user not in ('authenticated', 'anon') or jsonb_typeof(o) is distinct from 'object' then
    return new;
  end if;
  cat := public.econ_catalog();
  cars := case when jsonb_typeof(s -> 'cars') = 'array' then s -> 'cars' else '[]' end;
  o_uids := array(select x ->> 'uid' from jsonb_array_elements(case when jsonb_typeof(o -> 'cars') = 'array' then o -> 'cars' else '[]' end) x);
  -- Bucks spent this save, less what new bucks-only parts and cars cost, plus a buck per level gained.
  paid := public.econ_num(o, 'bucks') - public.econ_num(s, 'bucks')
    + greatest(public.econ_num(s, 'level') - public.econ_num(o, 'level'), 0)
    - coalesce((select sum(n.bucks) from public.econ_new_bucks_mods(cars, o, cat) n), 0)
    - coalesce((select sum((cat -> 'cars' -> (x ->> 'model') ->> 'bucks')::numeric) from jsonb_array_elements(cars) x
                where not (x ->> 'uid') = any(o_uids) and cat -> 'cars' ? (x ->> 'model')), 0);

  -- 1. Rusty's storage -----------------------------------------------------------------------
  -- A car new to storage must be one the server rolled for this player (rescue_roll()) and not
  -- yet restored. It keeps the rarity the server gave it.
  o_junk := array(select x ->> 'uid' from jsonb_array_elements(case when jsonb_typeof(o -> 'junkyard') = 'array' then o -> 'junkyard' else '[]' end) x);
  if jsonb_typeof(s -> 'junkyard') = 'array' then
    junk := '[]';
    for v in select x from jsonb_array_elements(s -> 'junkyard') x loop
      if (v ->> 'uid') = any(o_junk) then
        junk := junk || jsonb_build_array(v);
        continue;
      end if;
      select * into f from econ_private.rescue_find(v ->> 'uid');
      if f.model is not null and f.model = v ->> 'model' and not f.bayed then
        junk := junk || jsonb_build_array(v || jsonb_build_object('rarity', f.rarity));
      else
        fixes := fixes || '{"junkyard":"not found by Rusty"}';
      end if;
    end loop;
    s := jsonb_set(s, '{junkyard}', junk);
  end if;

  -- 2. Restore bays --------------------------------------------------------------------------
  -- Bay 1 (`restoring`, econ 'bay') and bay 2 (`restoring2`, econ 'bay2', open from bay2.level)
  -- run the same checks. Bucks paid this save pay for one bay's rush, not both.
  foreach bk in array array['restoring', 'restoring2'] loop
    ek := case bk when 'restoring' then 'bay' else 'bay2' end;
    fk := case bk when 'restoring' then 'restore' else 'restore2' end;
    bay := old.econ -> ek;
    orr := case when jsonb_typeof(o -> bk) = 'object' then o -> bk end;
    sr := case when jsonb_typeof(s -> bk) = 'object' then s -> bk end;
    out_uid := null;
    if bk = 'restoring2' and sr is not null and sr ->> 'uid' is distinct from orr ->> 'uid'
       and (public.econ_num(s, 'level') < (bay2 ->> 'level')::numeric or sr ->> 'uid' is not distinct from s -> 'restoring' ->> 'uid') then
      -- Bay 2 opens at its level, and one car can't be in both bays.
      fixes := fixes || '{"restore2":"bay 2 not open"}';
      s := jsonb_set(s, '{restoring2}', coalesce(orr, 'null'));
      sr := orr;
    end if;
    if bay is null and orr is not null then
      -- In the bay before this check existed: let it finish.
      bay := jsonb_build_object('uid', orr ->> 'uid', 'model', orr ->> 'model', 'at', 0, 'mins', 0, 'rushed', true);
    end if;
    -- The car leaving the bay this save, if any.
    select x ->> 'uid' into out_uid from jsonb_array_elements(cars) x
      where bay is not null and x ->> 'uid' = bay ->> 'uid' and x ->> 'model' = bay ->> 'model' and not (x ->> 'uid') = any(o_uids)
      limit 1;
    if out_uid is not null then
      left_s := (bay ->> 'at')::numeric + (bay ->> 'mins')::numeric * 60 - now_s - 60;
      need := greatest(1, ceil(left_s / 1800));
      done := (bay ->> 'rushed')::boolean or left_s <= 0 or paid >= need;
      if done then
        if not (bay ->> 'rushed')::boolean and left_s > 0 then paid := paid - need; end if;
        bay := null;
      else
        fixes := fixes || jsonb_build_object(fk, 'still in the bay');
        cars := (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(cars) x where x ->> 'uid' is distinct from out_uid);
        s := jsonb_set(s, '{cars}', cars);
        s := jsonb_set(s, array[bk], case when orr ->> 'uid' = out_uid then orr
          else jsonb_build_object('uid', out_uid, 'model', bay ->> 'model', 'rarity', 'rare', 'minutes', (bay ->> 'mins')::numeric,
                                  'endsAt', ((bay ->> 'at')::numeric + (bay ->> 'mins')::numeric * 60) * 1000) end);
        removed := true;
      end if;
    elsif sr is not null then
      if bay is null or bay ->> 'uid' is distinct from sr ->> 'uid' or bay ->> 'model' is distinct from sr ->> 'model' then
        -- A car goes into the bay: one Rusty found and that hasn't been restored, or one already in
        -- storage from before the server rolled searches. Its timer starts now, at its rarity's pace.
        select * into f from econ_private.rescue_find(sr ->> 'uid');
        ok := case when f.model is not null then f.model = sr ->> 'model' and not f.bayed
          else exists (select 1 from jsonb_array_elements(case when jsonb_typeof(o -> 'junkyard') = 'array' then o -> 'junkyard' else '[]' end) x
                       where x ->> 'uid' = sr ->> 'uid' and x ->> 'model' = sr ->> 'model') end;
        if ok then
          bay := jsonb_build_object('uid', sr ->> 'uid', 'model', sr ->> 'model', 'at', now_s,
                                    'mins', coalesce((rar -> (f.rarity) ->> 'minutes')::numeric, (rmins ->> (sr ->> 'model'))::numeric, 120), 'rushed', false);
          if f.model is not null then
            perform econ_private.rescue_bayed(sr ->> 'uid');
          end if;
        else
          fixes := fixes || jsonb_build_object(fk, 'not in storage');
          s := jsonb_set(s, array[bk], coalesce(orr, 'null'));
          bay := case when orr is not null then bay end;
        end if;
      -- (endsAt is in milliseconds, past econ_num()'s 1e12 cap since 2001, so it's read as is.)
      elsif not (bay ->> 'rushed')::boolean and jsonb_typeof(sr -> 'endsAt') = 'number' and jsonb_typeof(orr -> 'endsAt') = 'number'
            and (sr ->> 'endsAt')::numeric < (orr ->> 'endsAt')::numeric - 1000 then
        -- Rushed: paid for if this save's bucks cover the time left (with a minute to spare).
        left_s := (bay ->> 'at')::numeric + (bay ->> 'mins')::numeric * 60 - now_s - 60;
        need := greatest(1, ceil(left_s / 1800));
        if left_s <= 0 or paid >= need then
          if left_s > 0 then paid := paid - need; end if;
          bay := bay || '{"rushed":true}';
        else
          fixes := fixes || jsonb_build_object(fk, 'rush not paid');
          s := jsonb_set(s, array[bk], orr);
        end if;
      end if;
    else
      bay := null;
    end if;
    e := case when bay is null then e - ek else e || jsonb_build_object(ek, bay) end;
  end loop;

  -- Tow truck: up one level at a time, at the player level it needs, paid for in parts this
  -- save. A save with a lower level (an old tab) keeps the truck without a flag.
  t_o := greatest(coalesce(floor(public.econ_num(o, 'truck')), 0), 0)::int;
  t_n := coalesce(floor(public.econ_num(s, 'truck')), 0)::int;
  if t_n < t_o then
    s := jsonb_set(s, '{truck}', to_jsonb(t_o));
    keep := true;
  elsif t_n > t_o and (t_n <> t_o + 1 or t_n >= jsonb_array_length(truck)
        or public.econ_num(s, 'level') < (truck -> t_n ->> 'level')::numeric
        or public.econ_num(o, 'parts') - public.econ_num(s, 'parts') < (truck -> t_n ->> 'parts')::numeric) then
    fixes := fixes || jsonb_build_object('truck', t_o);
    s := jsonb_set(s, '{truck}', to_jsonb(t_o));
  end if;

  -- 3. Grand Prix ---------------------------------------------------------------------------
  my_pi := coalesce((old.best_car ->> 'pi')::int, 0); -- the best car from before this save
  for k, v in select g.key, g.value from jsonb_each(coalesce(cat -> 'gp', '{}')) g loop
    oc := public.econ_num(o -> 'gp' -> k, 'clears');
    sc := public.econ_num(s -> 'gp' -> k, 'clears');
    if sc < oc then
      fixes := fixes || jsonb_build_object('gp_' || k, 'clears kept');
      s := jsonb_set(s, '{gp}', coalesce(case when jsonb_typeof(s -> 'gp') = 'object' then s -> 'gp' end, '{}')
                                || jsonb_build_object(k, o -> 'gp' -> k));
    elsif sc > oc and gp_last ? k then
      rival := round((gp_last -> k ->> 'last')::numeric * (1 + oc * 0.08));
      if rival > jsonb_array_length(beat) or my_pi < (beat ->> (rival - 1))::int then
        fixes := fixes || jsonb_build_object('gp_' || k, 'rival too fast');
        s := jsonb_set(s, '{gp}', s -> 'gp' || jsonb_build_object(k, coalesce(o -> 'gp' -> k, jsonb_build_object('round', 0, 'clears', oc))));
        select x ->> 'uid' into prize from jsonb_array_elements(cars) x
          where not (x ->> 'uid') = any(o_uids) and v -> 'box' ? (x ->> 'model') limit 1;
        if prize is not null then
          cars := (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(cars) x where x ->> 'uid' is distinct from prize);
          s := jsonb_set(s, '{cars}', cars);
          removed := true;
        end if;
        s := jsonb_set(s, '{trophies}', to_jsonb(greatest(public.econ_num(o, 'trophies'), public.econ_num(s, 'trophies') - 5)));
      end if;
    end if;
  end loop;

  new.econ := e;
  if keep and fixes = '{}' then
    new.state := s;
  end if;
  if fixes <> '{}' then
    new.state := s;
    new.corrections := coalesce(new.corrections, '{}') || fixes;
    perform econ_private.econ_flag(new.owner_id, fixes);
  end if;
  if removed then
    -- Public columns, as the guard works them out, without the car taken back.
    select coalesce(sum(pi), 0) into new.power from (
      select public.econ_car_pi(x, cat) pi from jsonb_array_elements(cars) x
      where cat -> 'cars' ? (x ->> 'model') order by 1 desc limit 5) top;
    select jsonb_build_object('name', cat -> 'cars' -> (x ->> 'model') ->> 'name', 'color', x ->> 'color',
                              'pi', public.econ_car_pi(x, cat), 'body', cat -> 'cars' -> (x ->> 'model') ->> 'body',
                              'mods', (select coalesce(jsonb_agg(fm.id), '[]') from public.econ_fitted_mods(x, cat) fm))
      into new.best_car
      from jsonb_array_elements(cars) x
      where cat -> 'cars' ? (x ->> 'model') order by public.econ_car_pi(x, cat) desc limit 1;
  end if;
  return new;
end $$;

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
    goal_xp := goal_xp + q_xp;

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
        if rb_n >= 3 and rb_o < 3 and n_lvl >= (r.v ->> 'unlock')::int then
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
         and n_lvl >= coalesce((cat -> 'rescue' ->> (o -> bk ->> 'model'))::int, 999) then
        select x ->> 'uid' into out_car from jsonb_array_elements(cars) x
          where x ->> 'uid' = o -> bk ->> 'uid' and x ->> 'model' = o -> bk ->> 'model' and not (x ->> 'uid') = any(o_uids)
          limit 1;
        if out_car is not null then
          rc := cat -> 'cars' -> (o -> bk ->> 'model');
          owed := greatest(200, round(((rc ->> 'price')::numeric + coalesce((rc ->> 'bucks')::numeric, 0) * 1000) * 0.25 / 10) * 10)
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
               and coalesce((cat -> 'cars' -> (x ->> 'model') ->> 'unlock')::int, 0) > n_lvl loop
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

    -- Bucks: only what levels, goals, the daily bonus, campaign bonuses, collection sets, task chests and season tiers pay, less any bucks-only car bought.
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
    max_bucks := greatest(public.econ_num(o, 'bucks'), 0) + (n_lvl - o_lvl) + goal_bucks + daily_bucks + camp_bucks + set_bucks + q_bucks + sea_bucks + tr_bucks - bucks_cost - cr_bucks;
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
             + sea_coins + sea_parts * 50 + sea_value + cr_net;
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
    allow := case when gp_series is not null then 5 else 0 end + camp_trophies + set_trophies + tr_trophies;
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
