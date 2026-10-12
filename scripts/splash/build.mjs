// Builds the loading screen and writes it into index.html between the
// <!-- splash --> markers. The page itself carries the sunburst, wordmark and
// loading pill, so they paint the instant the page opens; the town and the car
// are renders of the real game (public/splash/, made by town.mjs and shoot.mjs)
// that fade in as soon as they arrive, over a blurred thumbnail of the same town
// that is inlined here. src/lib/splash.ts fades the whole thing out once the
// town has drawn. Run: node scripts/splash/build.mjs
//
// The scene matches the link-preview cards: a sunburst panel with the logo, and
// the player's own race car (in their paint, centred in the space under the
// loading pill and sized to fit it) parked in front of a busy town
// that slowly pans, in the real season and the game's 20-minute day/night clock
// (src/game/clock.ts), or a live night/day event cached by src/game/liveEvents.ts.
// When the game is ready the car drives off screen and the splash fades away.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const here = (f) => new URL(f, import.meta.url)
const root = (f) => new URL(`../../${f}`, import.meta.url)
const N = '#14213d'
// Width of the Hot Shot's hero render; other cars scale against it.
const HERO_W = 572

// "Cartopia" set in Fredoka Bold, as outlines so no font has to load first.
const WM_PATH = readFileSync(here('wordmark.path'), 'utf8').trim()
const WORDMARK = `<svg class="wm" viewBox="-70 170 4070 1150" role="img" aria-label="Cartopia"><defs><linearGradient id="sp-wmg" x1="0" y1="246" x2="0" y2="1195" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff8d6"/><stop offset=".45" stop-color="#ffe066"/><stop offset="1" stop-color="#ffaa1a"/></linearGradient><path id="sp-wm" d="${WM_PATH}"/></defs><use href="#sp-wm" y="60" fill="${N}" stroke="${N}" stroke-width="120" stroke-linejoin="round"/><use href="#sp-wm" fill="url(#sp-wmg)" stroke="${N}" stroke-width="120" stroke-linejoin="round" paint-order="stroke"/></svg>`

// Tiny blurred copies of every town render (town.mjs writes them), so the town
// shows from the first frame and sharpens when the real picture lands.
const lqipUrl = here('lqip.json')
const LQIP = existsSync(lqipUrl) ? JSON.parse(readFileSync(lqipUrl, 'utf8')) : {}

const CSS = `
html,body{background:#3f8f3a}
#splash{position:fixed;inset:0;z-index:2147483000;overflow:hidden;user-select:none;-webkit-user-select:none;font-family:'Lilita One',system-ui,sans-serif;color:#fff;transition:opacity .5s ease,transform .6s ease;background:#3f8f3a;
--s1:#fff4c9;--s2:#ffc46b;--s3:#ff9b5c;--s4:#ef6f8e;--ray:rgba(255,255,255,.2);--rim:rgba(255,255,255,.55)}
#splash.dusk{--s1:#ffd9a3;--s2:#ff9d6c;--s3:#d4618f;--s4:#6c4aa1;--ray:rgba(255,236,200,.16)}
#splash.night{background:#18213a;--s1:#5a5fc0;--s2:#3a3f96;--s3:#262b6c;--s4:#151a45;--ray:rgba(170,180,255,.1);--rim:rgba(160,175,255,.35)}
#splash.out{opacity:0;transform:scale(1.04);pointer-events:none}
#splash .town{position:absolute;inset:-4%;background-size:cover;background-position:50% 50%;filter:blur(14px);transform:scale(1.06)}
#splash .town img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s ease;animation:sp-pan 40s ease-in-out infinite alternate;will-change:transform}
#splash .town.on{filter:none;transform:none}
#splash .town.on img{opacity:1}
#splash .town::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 18vmin rgba(10,16,40,.45);pointer-events:none}
@keyframes sp-pan{from{transform:scale(1.1) translate(-3%,1.5%)}to{transform:scale(1.1) translate(3%,-1.5%)}}
#splash .sun{position:absolute;overflow:hidden;border-radius:50%;background:radial-gradient(circle at var(--cx) var(--cy),var(--s1),var(--s2) 30%,var(--s3) 62%,var(--s4));box-shadow:0 0 0 .9vmin var(--rim),0 0 6vmin rgba(10,16,40,.45);
left:-30%;width:160%;top:-24%;height:70%;--cx:50%;--cy:52%}
#splash .sun::before{content:"";position:absolute;left:calc(var(--cx) - 100vmax);top:calc(var(--cy) - 100vmax);width:200vmax;height:200vmax;background:repeating-conic-gradient(var(--ray) 0 6deg,transparent 6deg 15deg);animation:sp-spin 90s linear infinite}
#splash .stars{position:absolute;inset:0;display:none;background-image:radial-gradient(2px 2px at 22% 70%,#fff,transparent),radial-gradient(2px 2px at 34% 58%,#fff,transparent),radial-gradient(1.5px 1.5px at 48% 80%,#fff,transparent),radial-gradient(2px 2px at 64% 62%,#fff,transparent),radial-gradient(1.5px 1.5px at 76% 76%,#fff,transparent),radial-gradient(2px 2px at 58% 88%,#fff,transparent);animation:sp-tw 3s ease-in-out infinite alternate}
#splash.night .stars{display:block}
@keyframes sp-tw{to{opacity:.4}}
@keyframes sp-spin{to{transform:rotate(1turn)}}
#splash .wm{position:absolute;left:50%;top:calc(6% + env(safe-area-inset-top));width:min(80vw,560px);transform:translateX(-50%);filter:drop-shadow(0 6px 14px rgba(20,33,61,.3));z-index:5;animation:sp-in .7s cubic-bezier(.2,1.6,.4,1) both}
@keyframes sp-in{from{transform:translateX(-50%) scale(.6);opacity:0}}
#splash .tag{position:absolute;left:0;right:0;top:calc(6% + env(safe-area-inset-top) + min(80vw,560px) * .3);margin:0;text-align:center;font-size:clamp(15px,4.6vw,24px);line-height:1.25;letter-spacing:.3px;-webkit-text-stroke:4px ${N};paint-order:stroke fill;text-shadow:0 3px 0 ${N};z-index:5;animation:sp-up .6s .15s ease-out both}
@keyframes sp-up{from{transform:translateY(10px);opacity:0}}
#splash .car{position:absolute;left:50%;top:37%;width:calc(min(76vw,340px) * var(--k,1));transform:translateX(-50%);z-index:4;opacity:0;transition:opacity .35s ease}
#splash .car.on{opacity:1;animation:sp-park .7s cubic-bezier(.2,1.3,.4,1) both}
@keyframes sp-park{from{transform:translate(-20%,-14%) scale(.9)}}
#splash .car.go{animation:sp-go .9s cubic-bezier(.5,0,.9,.6) forwards}
#splash .car.go .body{animation:none}
@keyframes sp-go{0%{transform:translateX(-50%)}18%{transform:translate(-44%,-3%) rotate(-1.5deg)}100%{transform:translate(calc(-50% - 95vmax),42vmax) rotate(2deg)}}
#splash .car .body{position:relative;isolation:isolate;animation:sp-bob 1.6s ease-in-out infinite alternate}
#splash .car img{display:block;width:100%;height:auto}
#splash .paint{position:absolute;inset:0;mix-blend-mode:multiply;background:var(--paint,#d32f2f);-webkit-mask-size:100% 100%;mask-size:100% 100%}
#splash .car::after{content:"";position:absolute;left:2%;right:2%;bottom:-3%;height:28%;border-radius:50%;background:radial-gradient(closest-side,rgba(10,14,30,.6),rgba(10,14,30,0));z-index:-1}
#splash.night .car .body{filter:brightness(.85)}
@keyframes sp-bob{to{transform:translateY(-1.5%)}}
#splash .ld{position:absolute;left:50%;bottom:calc(6% + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:10px;z-index:6;overflow:hidden;isolation:isolate;padding:12px 26px 12px 16px;border-radius:99px;border:3px solid ${N};background:#c9790e;box-shadow:inset 0 -4px 0 rgba(0,0,0,.18),0 5px 0 ${N},0 10px 22px rgba(10,16,40,.4);font:inherit;font-size:20px;color:${N};white-space:nowrap}
#splash .ld .fill{position:absolute;inset:0;z-index:-1;background:linear-gradient(#ffe98a,#ffb21a);box-shadow:inset 0 3px 0 rgba(255,255,255,.6);transform-origin:0 50%;transform:scaleX(.06);transition:transform .35s ease}
#splash .tire{width:26px;height:26px;flex:none;border-radius:50%;background:radial-gradient(circle,#e8ecf4 0 22%,${N} 23% 30%,transparent 31%),conic-gradient(#c3cad8 0 12.5%,#e8ecf4 0 25%,#c3cad8 0 37.5%,#e8ecf4 0 50%,#c3cad8 0 62.5%,#e8ecf4 0 75%,#c3cad8 0 87.5%,#e8ecf4 0);border:5px solid ${N};animation:sp-spin .8s linear infinite}
#splash .ld b{font-weight:400;letter-spacing:.3px}
@media (min-aspect-ratio:1/1){
#splash .sun{left:-24%;width:70%;top:-30%;height:160%;--cx:62%;--cy:42%}
#splash .stars{inset:0 50% 0 0}
#splash .wm{left:23%;top:15%;width:min(36vw,520px)}
#splash .tag{left:0;right:auto;width:46%;top:calc(15% + min(36vw,520px) * .32);font-size:clamp(18px,2.1vw,30px)}
#splash .ld{left:23%;bottom:auto;top:calc(15% + min(36vw,520px) * .32 + clamp(18px,2.1vw,30px) * 4.6)}
#splash .car{--vh:1vh;--ldb:calc(15 * var(--vh) + min(36vw,520px) * .32 + clamp(18px,2.1vw,30px) * 4.6 + 64px);--cmax:min(30vw,460px)}
@supports (height:1dvh){#splash .car{--vh:1dvh}}
#splash .car{left:24%;--cw:min(calc(var(--cmax) * var(--k,1)),calc((100 * var(--vh) - var(--ldb) - 8 * var(--vh)) / var(--ar,.75)));width:var(--cw);top:calc(var(--ldb) + (100 * var(--vh) - var(--ldb) - var(--cw) * var(--ar,.75)) / 2)}
}
@media (min-aspect-ratio:1/1) and (max-height:520px){#splash .tag{display:none}#splash .ld{top:calc(15% + min(36vw,520px) * .32 + 12px)}#splash .car{--ldb:calc(15 * var(--vh) + min(36vw,520px) * .32 + 76px);--cmax:min(22vw,300px)}}
@media (max-aspect-ratio:1/1) and (max-height:640px){#splash .tag{display:none}#splash .car{top:30%}}
@media (prefers-reduced-motion:reduce){#splash *,#splash *::before{animation:none!important}#splash .car.go{opacity:0}}
`

// Picks the time of day, season and the player's car, eases the pill forward
// while the game downloads, and gives src/lib/splash.ts its handle. Runs before
// anything else.
const JS = `(function(){
var q=new URLSearchParams(location.search),el=document.getElementById('splash');
var f=document.createElement('link');f.rel='stylesheet';f.href='https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;800&display=swap';document.head.appendChild(f);
if(q.has('nosplash')){el.remove();return}
var t=q.get('time'),p=t===null?(Date.now()%12e5)/12e5:+t,lv=[];
try{lv=JSON.parse(localStorage.getItem('cartopia-live-events'))||[]}catch(e){}
lv.forEach(function(e){var k={night:.5,day:0}[e.kind],now=Date.now();if(t===null&&k!==undefined&&e.from<=now&&now<e.to)p=k});
var d=Math.abs(p-.5),n=d<.14?1:d>.26?0:1-(d-.14)/.12;
var m=new Date().getMonth(),tod=n>.7?'night':n>.08?'dusk':'day',season=q.get('season')||(m<2||m>10?'winter':m<5?'spring':m<8?'summer':'fall');
el.className=tod;
var key=season+'-'+tod,lq=${JSON.stringify(LQIP)},town=el.querySelector('.town'),ti=town.querySelector('img');
if(lq[key])town.style.backgroundImage='url('+lq[key]+')';
ti.onload=function(){town.classList.add('on')};ti.src='/splash/town-'+key+'.webp';
var c={};try{c=JSON.parse(localStorage.getItem('cartopia-splash-car'))||{}}catch(e){}
var model=/^[a-z0-9]+$/.test(c.model)?c.model:'hotshot',car=el.querySelector('.car'),img=car.querySelector('img'),paint=car.querySelector('.paint');
paint.style.setProperty('--paint',/^#[0-9a-f]{3,8}$/i.test(c.color)?c.color:'#d32f2f');
function useCar(id){var mk='url(/splash/hero-'+id+'-mask.webp)';paint.style.webkitMaskImage=mk;paint.style.maskImage=mk;img.src='/splash/hero-'+id+'.webp'}
img.onload=function(){car.style.setProperty('--k',Math.max(.8,Math.min(1.25,img.naturalWidth/${HERO_W})));car.style.setProperty('--ar',img.naturalHeight/img.naturalWidth);car.classList.add('on')};img.onerror=function(){if(model!='hotshot'){model='hotshot';useCar(model)}};useCar(model);
var bar=el.querySelector('.ld .fill'),lab=el.querySelector('.ld b'),v=.06,cap=.6,end=0;
function draw(){bar.style.transform='scaleX('+v+')'}
var tick=setInterval(function(){v+=(cap-v)*.04;draw()},120);
var slow=setTimeout(function(){lab.textContent='Still loading\\u2026 tap to retry';el.querySelector('.ld').onclick=function(){location.reload()}},30000);
window.cartopiaSplash={set:function(x){if(x>v)v=x;cap=Math.max(cap,Math.min(.97,x+.08));draw()},done:function(){if(end)return;end=1;clearInterval(tick);clearTimeout(slow);v=1;draw();lab.textContent='Let\\u2019s go!';setTimeout(function(){car.classList.add('go');setTimeout(function(){el.classList.add('out');setTimeout(function(){el.remove()},650)},750)},250)}};
})()`

const BODY = `<div id="splash">
<div class="town"><img alt=""></div>
<div class="sun"><div class="stars"></div></div>
${WORDMARK}
<p class="tag">Build your town<br>Collect cars<br>Race your friends</p>
<div class="car"><div class="body"><img alt=""><div class="paint"></div></div></div>
<button class="ld" type="button" tabindex="-1"><i class="fill"></i><span class="tire"></span><b>Loading your town\u2026</b></button>
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
