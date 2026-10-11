// Builds the loading screen and writes it into index.html between the
// <!-- splash --> markers. The page itself carries the sky, road, skyline,
// wordmark and loading bar, so they paint the instant the page opens; the
// street and the car are renders of the real game models (public/splash/,
// made by shoot.mjs) that fade in as soon as they arrive. src/lib/splash.ts
// fades the whole thing out once the town has drawn. Run: node scripts/splash/build.mjs
//
// The scene: the player's own race car (in their paint) drives down a scrolling
// Main Street of game shops, under a sky that follows the game's 20-minute
// day/night clock (src/game/clock.ts) and the season.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const here = (f) => new URL(f, import.meta.url)
const root = (f) => new URL(`../../${f}`, import.meta.url)
const N = '#14213d'

// "Cartopia" set in Fredoka Bold, as outlines so no font has to load first.
const WM_PATH = readFileSync(here('wordmark.path'), 'utf8').trim()
const WORDMARK = `<svg class="wm" viewBox="-70 170 4070 1150" role="img" aria-label="Cartopia"><defs><linearGradient id="sp-wmg" x1="0" y1="246" x2="0" y2="1195" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff8d6"/><stop offset=".45" stop-color="#ffe066"/><stop offset="1" stop-color="#ffaa1a"/></linearGradient><path id="sp-wm" d="${WM_PATH}"/></defs><use href="#sp-wm" y="60" fill="${N}" stroke="${N}" stroke-width="120" stroke-linejoin="round"/><use href="#sp-wm" fill="url(#sp-wmg)" stroke="${N}" stroke-width="120" stroke-linejoin="round" paint-order="stroke"/></svg>`

// Distant skyline, seeded so every build draws the same city.
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1))
let SKY = ''
for (let x = 0; x < 1200;) {
  const w = ri(60, 130), h = ri(90, 240)
  SKY += `<rect x="${x}" y="${340 - h}" width="${w}" height="${h + 10}"/>`
  for (let r = 0; r < Math.floor(h / 34); r++) for (let c = 0; c < Math.floor(w / 28); c++) if (rnd() < 0.35) SKY += `<rect class="fw" x="${x + 10 + c * 28}" y="${340 - h + 14 + r * 34}" width="10" height="14"/>`
  x += w + ri(4, 30)
}
const strip = (id, w, h) => {
  const one = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMinYMax meet"><use href="#${id}"/></svg>`
  return one + one
}

const CSS = `
html,body{background:#7fcdf5}
#splash{position:fixed;inset:0;z-index:2147483000;overflow:hidden;user-select:none;-webkit-user-select:none;font-family:'Lilita One',system-ui,sans-serif;transition:opacity .5s ease,transform .6s ease;
--sky1:#7fcdf5;--sky2:#d8f1ff;--far:#a8c6dc;--fw:transparent;--asph:#555c6e;--pave:#d8d3c6;--seam:#bdb7a8;--curb:#9a9486;--road:30%;--lit:none;
background:linear-gradient(var(--sky1),var(--sky2) 62%)}
#splash.dusk{--sky1:#5b4b9a;--sky2:#ffb37a;--far:#7b6a9c;--fw:#ffd98a;--asph:#454b62;--pave:#b9b2b8;--seam:#a29aa4;--lit:brightness(.82) saturate(1.1) sepia(.12)}
#splash.night{--sky1:#0d1838;--sky2:#2b3d72;--far:#22305a;--fw:#ffd36b;--asph:#2c3246;--pave:#6f7690;--seam:#606781;--curb:#4e5570;--lit:brightness(.72) saturate(.9)}
#splash.out{opacity:0;transform:scale(1.04);pointer-events:none}
#splash .orb{position:absolute;right:16%;top:30%;width:15vmin;height:15vmin;border-radius:50%;background:#fff6c2;box-shadow:0 0 0 2.4vmin rgba(255,246,194,.35),0 0 60px 20px rgba(255,240,170,.5)}
#splash.dusk .orb{top:44%;background:#ffd27a;box-shadow:0 0 80px 30px rgba(255,170,90,.6)}
#splash.night .orb{width:11vmin;height:11vmin;background:#eef2ff;box-shadow:inset -3vmin -1vmin 0 #c9d2f2,0 0 50px 10px rgba(200,215,255,.35)}
#splash .stars{position:absolute;inset:0 0 40% 0;display:none;background-image:radial-gradient(2px 2px at 12% 20%,#fff,transparent),radial-gradient(2px 2px at 30% 8%,#fff,transparent),radial-gradient(1.5px 1.5px at 48% 26%,#fff,transparent),radial-gradient(2px 2px at 66% 14%,#fff,transparent),radial-gradient(1.5px 1.5px at 84% 30%,#fff,transparent),radial-gradient(2px 2px at 92% 6%,#fff,transparent),radial-gradient(1.5px 1.5px at 6% 40%,#fff,transparent),radial-gradient(1.5px 1.5px at 56% 40%,#fff,transparent)}
#splash.night .stars{display:block}
#splash .cl{position:absolute;left:0;height:7vmin;width:22vmin;background:#fff;border-radius:99px;opacity:var(--o,.85);box-shadow:5vmin -3vmin 0 -1vmin #fff,-4vmin -2vmin 0 -1.3vmin #fff;animation:sp-drift var(--d,50s) linear infinite}
#splash.dusk .cl{background:#ffd9c4;box-shadow:5vmin -3vmin 0 -1vmin #ffd9c4,-4vmin -2vmin 0 -1.3vmin #ffd9c4}
#splash.night .cl{opacity:calc(var(--o,.85) * .15)}
@keyframes sp-drift{from{transform:translateX(110vw)}to{transform:translateX(-40vw)}}
#splash .layer{position:absolute;left:0;bottom:var(--b);height:var(--h);display:flex;width:max-content;animation:sp-scroll var(--t) linear infinite;will-change:transform}
#splash .layer svg,#splash .layer img{height:100%;width:auto;flex:none;display:block}
#splash .layer img{opacity:0;transition:opacity .4s ease;filter:var(--lit)}
#splash.night .layer img{filter:none}
#splash .layer img.on{opacity:1}
@keyframes sp-scroll{to{transform:translateX(-50%)}}
#splash .l1{--b:calc(var(--road) - 1%);--h:42%;--t:120s}
#splash .l2{--b:calc(var(--road) - 2.2%);--h:30%;--t:40s}
#splash .sky1{fill:var(--far)}#splash .fw{fill:var(--fw)}
#splash .street{position:absolute;left:0;right:0;bottom:0;height:var(--road);overflow:hidden}
#splash .walk,#splash .dash{position:absolute;left:0;width:calc(100% + 260px);animation:sp-roll var(--rt) linear infinite;will-change:transform}
#splash .walk{--rt:1.4s;top:0;height:20%;background:repeating-linear-gradient(90deg,var(--pave) 0 63px,var(--seam) 63px 65px);border-bottom:7px solid var(--curb)}
#splash .asph{position:absolute;left:0;right:0;top:20%;bottom:0;background:var(--asph)}
#splash .dash{--rt:.7s;top:calc(20% + 80% * .36);height:6px;border-radius:3px;background:repeating-linear-gradient(90deg,#f4f1e6 0 60px,transparent 60px 130px)}
@keyframes sp-roll{to{transform:translateX(-130px)}}
#splash .car{position:absolute;left:50%;bottom:calc(var(--road) * .4);width:calc(min(58vw,300px) * var(--k,1));transform:translateX(-50%);z-index:3;opacity:0;transition:opacity .3s ease}
#splash .car.on{opacity:1}
#splash .car .body{position:relative;isolation:isolate;animation:sp-bob .3s ease-in-out infinite alternate}
#splash .car img{display:block;width:100%;height:auto}
#splash .paint{position:absolute;inset:0;mix-blend-mode:multiply;background:var(--paint,#d32f2f);-webkit-mask-size:100% 100%;mask-size:100% 100%}
#splash.night .car .body{filter:brightness(.78)}
#splash .car::after{content:"";position:absolute;left:4%;right:4%;bottom:-4%;height:12%;border-radius:50%;background:rgba(10,14,30,.35);z-index:-1}
@keyframes sp-bob{to{transform:translateY(2px)}}
#splash .beam{position:absolute;left:96%;top:38%;width:90%;height:44%;background:linear-gradient(90deg,rgba(255,246,192,.55),rgba(255,246,192,0));clip-path:polygon(0 40%,100% 0,100% 100%,0 60%);display:none}
#splash.night .beam,#splash.dusk .beam{display:block}
#splash .wm{position:absolute;left:50%;top:calc(9% + env(safe-area-inset-top));width:min(84vw,620px);transform:translateX(-50%);filter:drop-shadow(0 6px 14px rgba(20,33,61,.25));z-index:5;animation:sp-in .7s cubic-bezier(.2,1.6,.4,1) both}
@keyframes sp-in{from{transform:translateX(-50%) scale(.6);opacity:0}}
#splash .ld{position:absolute;left:50%;bottom:calc(5% + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:6;background:none;border:0;padding:0;font:inherit;color:inherit}
#splash .bar{width:min(64vw,300px);height:20px;border-radius:99px;background:#1f3358;border:3px solid ${N};box-shadow:inset 0 3px 0 rgba(0,0,0,.35),0 3px 0 rgba(0,0,0,.25);overflow:hidden;padding:2px}
#splash .bar i{display:block;height:100%;width:100%;border-radius:99px;background:linear-gradient(#ffe98a,#ffb21a);box-shadow:inset 0 2px 0 rgba(255,255,255,.6);transform-origin:0 50%;transform:scaleX(.06);transition:transform .35s ease}
#splash .ld b{font-weight:400;font-size:17px;color:#fff;letter-spacing:.5px;text-shadow:0 2px 0 ${N},0 0 2px ${N}}
@media (min-aspect-ratio:1/1){#splash{--road:26%}#splash .l1{--h:40%}#splash .l2{--h:36%}#splash .wm{width:min(50vw,600px);top:6%}#splash .car{width:calc(min(24vw,300px) * var(--k,1))}}
@media (prefers-reduced-motion:reduce){#splash *{animation:none!important}}
`

// Picks the sky, season and the player's car, eases the bar forward while the
// game downloads, and gives src/lib/splash.ts its handle. Runs before anything else.
const JS = `(function(){
var q=new URLSearchParams(location.search),el=document.getElementById('splash');
var f=document.createElement('link');f.rel='stylesheet';f.href='https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;800&display=swap';document.head.appendChild(f);
if(q.has('nosplash')){el.remove();return}
var t=q.get('time'),p=t===null?(Date.now()%12e5)/12e5:+t,d=Math.abs(p-.5),n=d<.14?1:d>.26?0:1-(d-.14)/.12;
var m=new Date().getMonth(),tod=n>.7?'night':n>.08?'dusk':'day',season=q.get('season')||(m<2||m>10?'winter':m<5?'spring':m<8?'summer':'fall');
el.className=tod;
function show(i){i.onload=function(){i.classList.add('on')};if(i.complete&&i.naturalWidth)i.classList.add('on')}
el.querySelectorAll('.l2 img').forEach(function(i){i.src='/splash/street-'+season+'-'+(tod=='night'?'night':'day')+'.webp';show(i)});
var c={};try{c=JSON.parse(localStorage.getItem('cartopia-splash-car'))||{}}catch(e){}
var model=/^[a-z0-9]+$/.test(c.model)?c.model:'hotshot',car=el.querySelector('.car'),img=car.querySelector('img'),paint=car.querySelector('.paint');
paint.style.setProperty('--paint',/^#[0-9a-f]{3,8}$/i.test(c.color)?c.color:'#d32f2f');
function useCar(id){var mk='url(/splash/car-'+id+'-mask.webp)';paint.style.webkitMaskImage=mk;paint.style.maskImage=mk;img.src='/splash/car-'+id+'.webp'}
img.onload=function(){car.style.setProperty('--k',Math.min(1.35,img.naturalWidth/464));car.classList.add('on')};img.onerror=function(){if(model!='hotshot'){model='hotshot';useCar(model)}};useCar(model);
var bar=el.querySelector('.bar i'),lab=el.querySelector('.ld b'),v=.06,cap=.6,end=0;
function draw(){bar.style.transform='scaleX('+v+')'}
var tick=setInterval(function(){v+=(cap-v)*.04;draw()},120);
var slow=setTimeout(function(){lab.textContent='Still loading\\u2026 tap to retry';el.querySelector('.ld').onclick=function(){location.reload()}},30000);
window.cartopiaSplash={set:function(x){if(x>v)v=x;cap=Math.max(cap,Math.min(.97,x+.08));draw()},done:function(){if(end)return;end=1;clearInterval(tick);clearTimeout(slow);v=1;draw();setTimeout(function(){el.classList.add('out');setTimeout(function(){el.remove()},650)},250)}};
})()`

const BODY = `<div id="splash">
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><g id="sp-sky" class="sky1">${SKY}</g></defs></svg>
<div class="stars"></div><div class="orb"></div><div class="cl" style="top:34%"></div><div class="cl" style="top:46%;--d:70s;animation-delay:-30s;--o:.7"></div>
<div class="layer l1">${strip('sp-sky', 1200, 350)}</div>
<div class="layer l2"><img alt=""><img alt=""></div>
<div class="street"><div class="walk"></div><div class="asph"></div><div class="dash"></div></div>
<div class="car"><div class="body"><img alt=""><div class="paint"></div><div class="beam"></div></div></div>
${WORDMARK}
<button class="ld" type="button" tabindex="-1"><span class="bar"><i></i></span><b>Loading your town\u2026</b></button>
</div>`

const min = (s) => s.replace(/\n\s*/g, '').replace(/>\s+</g, '><')
const block = `<!-- splash:start (generated by scripts/splash/build.mjs) -->
    <style>${min(CSS)}</style>
    ${min(BODY)}
    <script>${min(JS)}</script>
    <!-- splash:end -->`

const indexUrl = root('index.html')
const html = readFileSync(indexUrl, 'utf8')
const next = html.replace(/<!-- splash:start[\s\S]*?<!-- splash:end -->/, block)
if (next === html && !html.includes(block)) throw new Error('index.html has no splash markers')
writeFileSync(indexUrl, next)

// The site's CSP only runs inline scripts it knows by hash.
const hash = `'sha256-${createHash('sha256').update(min(JS)).digest('base64')}'`
const tomlUrl = root('netlify.toml')
const toml = readFileSync(tomlUrl, 'utf8')
writeFileSync(tomlUrl, toml.replace(/script-src 'self'( 'sha256-[^']+')?/, `script-src 'self' ${hash}`))
console.log(`splash: ${block.length} bytes, script ${hash}`)
