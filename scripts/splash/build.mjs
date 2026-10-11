// Builds the loading screen and writes it into index.html between the
// <!-- splash --> markers. It lives in the page itself (no images, no bundle)
// so it paints the instant the page opens, then src/lib/splash.ts fades it
// out once the town has drawn. Run: node scripts/splash/build.mjs
//
// The scene: the red hero car drives down a scrolling Main Street (Donuts,
// Rusty's Rescue, apartments, diner, fuel stop) under a sky that follows the
// game's own 20-minute day/night clock (src/game/clock.ts).
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const here = (f) => new URL(f, import.meta.url)
const root = (f) => new URL(`../../${f}`, import.meta.url)
const N = '#14213d'

// "Cartopia" set in Fredoka Bold, as outlines so no font has to load first.
const WM_PATH = readFileSync(here('wordmark.path'), 'utf8').trim()
const WORDMARK = `<svg class="wm" viewBox="-70 170 4070 1150" role="img" aria-label="Cartopia"><defs><linearGradient id="sp-wmg" x1="0" y1="246" x2="0" y2="1195" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff8d6"/><stop offset=".45" stop-color="#ffe066"/><stop offset="1" stop-color="#ffaa1a"/></linearGradient><path id="sp-wm" d="${WM_PATH}"/></defs><use href="#sp-wm" y="60" fill="${N}" stroke="${N}" stroke-width="120" stroke-linejoin="round"/><use href="#sp-wm" fill="url(#sp-wmg)" stroke="${N}" stroke-width="120" stroke-linejoin="round" paint-order="stroke"/></svg>`

const wheel = (cx) => {
  let spokes = ''
  for (let a = 0; a < 360; a += 72) spokes += `<rect x="-3.5" y="-17" width="7" height="17" rx="3" fill="#8c98ab" transform="rotate(${a})"/>`
  return `<g transform="translate(${cx} 124)"><circle r="31" fill="${N}"/><circle r="27" fill="#2a3550"/><g class="spin"><circle r="17" fill="#dfe6ee" stroke="${N}" stroke-width="3"/>${spokes}<circle r="5" fill="${N}"/></g></g>`
}

// The Hot Shot from the Discord art, side on.
const CAR = `<svg class="car" viewBox="0 0 340 170" aria-hidden="true"><defs><linearGradient id="sp-beam" x1="0" x2="1"><stop offset="0" stop-color="#fff6c0" stop-opacity=".6"/><stop offset="1" stop-color="#fff6c0" stop-opacity="0"/></linearGradient></defs>
<ellipse cx="170" cy="156" rx="150" ry="10" fill="#0b1226" opacity=".3"/>
<g class="body">
<path d="M58 42 L84 18 Q90 12 100 12 L214 12 Q226 12 234 20 L262 52 Z" fill="#c92a24" stroke="${N}" stroke-width="5" stroke-linejoin="round"/>
<path d="M84 50 L100 24 L156 24 L156 52 Z" fill="#9fd3f0" stroke="${N}" stroke-width="4" stroke-linejoin="round"/>
<path d="M166 24 L210 24 Q218 24 222 30 L238 52 L166 52 Z" fill="#9fd3f0" stroke="${N}" stroke-width="4" stroke-linejoin="round"/>
<path d="M92 44 L104 28 L118 28 L104 44 Z" fill="#fff" opacity=".55"/><path d="M174 44 L184 28 L192 28 L182 44 Z" fill="#fff" opacity=".5"/>
<path d="M14 82 Q14 54 46 52 L292 50 Q322 52 326 84 L328 116 Q328 128 316 128 L24 128 Q12 128 12 116 Z" fill="#e8382e" stroke="${N}" stroke-width="5" stroke-linejoin="round"/>
<path d="M20 70 Q30 60 48 60 L292 58 Q312 60 318 72" fill="none" stroke="#ff8a7a" stroke-width="5" stroke-linecap="round"/>
<path d="M14 104 L326 104 L328 116 Q328 128 316 128 L24 128 Q12 128 12 116 Z" fill="#b8241f"/>
<line x1="161" y1="54" x2="161" y2="112" stroke="${N}" stroke-width="3" opacity=".6"/>
<circle cx="206" cy="82" r="17" fill="#fff" stroke="${N}" stroke-width="3"/><path d="M203 74 L209 70 L209 94 M203 94 L215 94" fill="none" stroke="${N}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="128" y="68" width="18" height="5" rx="2.5" fill="${N}" opacity=".7"/>
<path d="M300 70 L322 72 L324 88 L304 86 Z" fill="#fff6a8" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
<path d="M14 74 L26 72 L26 90 L14 92 Z" fill="#ff5b52" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
<rect x="296" y="108" width="36" height="10" rx="5" fill="#dfe6ee" stroke="${N}" stroke-width="3"/>
<rect x="6" y="108" width="34" height="10" rx="5" fill="#dfe6ee" stroke="${N}" stroke-width="3"/>
<path d="M10 40 L58 40 L58 48 L14 50 Z" fill="#c92a24" stroke="${N}" stroke-width="4" stroke-linejoin="round"/><rect x="40" y="46" width="6" height="12" fill="${N}"/>
<path d="M70 104 Q86 70 118 72 Q146 74 150 104" fill="${N}"/><path d="M226 104 Q240 70 272 72 Q300 74 304 104" fill="${N}"/>
</g>${wheel(110)}${wheel(266)}
<path class="beam" d="M326 80 L600 40 L600 140 Z" fill="url(#sp-beam)"/></svg>`

const windows = (x0, y0, cols, rows, w, h, gx, gy) => {
  let s = ''
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s += `<rect class="w" x="${x0 + c * gx}" y="${y0 + r * gy}" width="${w}" height="${h}" rx="3" stroke="${N}" stroke-width="3"/>`
  return s
}
const awning = (x, y, w, a, b) => {
  const n = Math.floor(w / 24), seg = w / n
  let s = '', sc = ''
  for (let i = 0; i < n; i++) {
    const c = i % 2 ? b : a, x1 = (x + i * seg).toFixed(1)
    s += `<rect x="${x1}" y="${y}" width="${seg.toFixed(1)}" height="26" fill="${c}"/>`
    sc += `<path d="M${x1} ${y + 26} q${(seg / 2).toFixed(1)} 14 ${seg.toFixed(1)} 0" fill="${c}" stroke="${N}" stroke-width="3"/>`
  }
  return `<g>${s}${sc}<rect x="${x}" y="${y}" width="${w}" height="26" fill="none" stroke="${N}" stroke-width="3"/></g>`
}
const tree = (x, s = 1) => `<g transform="translate(${x} 600) scale(${s})"><rect x="-6" y="-60" width="12" height="60" rx="4" fill="#7a4a2e" stroke="${N}" stroke-width="3"/><g class="leaf" stroke="${N}" stroke-width="4"><circle cy="-92" r="40"/><circle cx="-26" cy="-70" r="24"/><circle cx="26" cy="-72" r="26"/></g><circle class="leaf2" cx="-10" cy="-104" r="14"/></g>`
const lamp = (x) => `<g transform="translate(${x} 600)"><rect x="-4" y="-150" width="8" height="150" fill="#3b4b6b" stroke="${N}" stroke-width="2"/><path d="M0 -150 Q0 -168 22 -168" fill="none" stroke="#3b4b6b" stroke-width="7"/><path d="M12 -170 L34 -170 L30 -158 L16 -158Z" fill="#3b4b6b" stroke="${N}" stroke-width="2"/><ellipse class="glow" cx="23" cy="-150" rx="44" ry="26"/><rect class="bulb" x="17" y="-160" width="12" height="5" rx="2"/><rect x="-10" y="-8" width="20" height="8" rx="2" fill="#3b4b6b"/></g>`
const txt = (x, y, size, fill, s) => `<text x="${x}" y="${y}" font-family="Lilita One,Arial Black,Arial,sans-serif" font-size="${size}" text-anchor="middle" fill="${fill}">${s}</text>`

// One 1600-wide block of Main Street; it repeats to scroll forever.
let STREET = `
<g><rect x="20" y="410" width="250" height="190" fill="#ffc7dc" stroke="${N}" stroke-width="4"/>
<rect x="10" y="398" width="270" height="18" rx="4" fill="#e85d8f" stroke="${N}" stroke-width="4"/>
<g transform="translate(145 352)"><circle r="44" fill="#e9a35a" stroke="${N}" stroke-width="4"/><circle r="40" fill="#ff8fc0"/><circle r="14" fill="#ffc7dc" stroke="${N}" stroke-width="4"/>
<g fill="#fff"><rect x="-26" y="-20" width="9" height="4" rx="2" transform="rotate(30)"/><rect x="12" y="-26" width="9" height="4" rx="2" transform="rotate(-20)"/><rect x="18" y="12" width="9" height="4" rx="2" transform="rotate(60)"/><rect x="-28" y="12" width="9" height="4" rx="2" fill="#ffe066"/><rect x="-4" y="22" width="9" height="4" rx="2" fill="#7fd6ff"/></g></g>
<rect x="58" y="420" width="174" height="30" rx="6" fill="#fff" stroke="${N}" stroke-width="3"/>${txt(145, 444, 24, '#e85d8f', 'DONUTS')}
${awning(30, 462, 230, '#ff8fc0', '#fff')}
<rect class="w" x="42" y="506" width="110" height="70" stroke="${N}" stroke-width="3"/><rect x="176" y="510" width="62" height="90" fill="#9a5b3c" stroke="${N}" stroke-width="3"/><circle cx="226" cy="556" r="4" fill="#ffe066"/></g>
<g><rect x="310" y="380" width="320" height="220" fill="#c96a44" stroke="${N}" stroke-width="4"/>
<path d="M310 410 h320 M310 440 h320 M310 470 h320" stroke="#a9502f" stroke-width="3"/>
<rect x="300" y="368" width="340" height="18" rx="4" fill="#7a4a2e" stroke="${N}" stroke-width="4"/>
<rect x="520" y="340" width="48" height="30" fill="#9aa7bd" stroke="${N}" stroke-width="3"/>
<rect x="356" y="394" width="228" height="40" rx="8" fill="#ffd84a" stroke="${N}" stroke-width="4"/>${txt(470, 424, 28, N, "RUSTY'S RESCUE")}
<rect x="338" y="456" width="180" height="144" fill="#dfe6ee" stroke="${N}" stroke-width="4"/>
<path d="${Array.from({ length: 8 }, (_, i) => `M338 ${470 + i * 16}h180`).join('')}" stroke="#9aa7bd" stroke-width="3"/>
<rect class="w" x="540" y="470" width="70" height="56" stroke="${N}" stroke-width="3"/><rect x="546" y="540" width="58" height="60" fill="#5b6f91" stroke="${N}" stroke-width="3"/></g>
${tree(672, 0.9)}
<g><rect x="710" y="250" width="210" height="350" fill="#5fb8b0" stroke="${N}" stroke-width="4"/><rect x="700" y="240" width="230" height="16" rx="4" fill="#3f8f88" stroke="${N}" stroke-width="4"/>
<g transform="translate(860 196)"><rect x="-20" y="0" width="40" height="44" rx="6" fill="#c96a44" stroke="${N}" stroke-width="3"/><path d="M-24 2 L0 -18 L24 2Z" fill="#7a4a2e" stroke="${N}" stroke-width="3"/><path d="M-14 44 L-18 58 M14 44 L18 58" stroke="${N}" stroke-width="4"/></g>
${windows(732, 276, 3, 5, 40, 44, 62, 62)}
<rect x="790" y="548" width="50" height="52" fill="#3f8f88" stroke="${N}" stroke-width="3"/></g>
<g><rect x="980" y="430" width="270" height="170" rx="26" fill="#bfe9d9" stroke="${N}" stroke-width="4"/>
<rect x="980" y="560" width="270" height="18" fill="#e14b4b" stroke="${N}" stroke-width="3"/>
<rect class="w" x="1000" y="470" width="230" height="70" rx="10" stroke="${N}" stroke-width="3"/>
<path d="M1057 470 v70 M1115 470 v70 M1173 470 v70" stroke="${N}" stroke-width="3"/>
<path d="M1090 432 v-8 M1140 432 v-8" stroke="${N}" stroke-width="4"/></g>
${tree(1290, 1.05)}
<g><rect x="1330" y="470" width="250" height="20" fill="#fff" stroke="${N}" stroke-width="4"/><rect x="1330" y="488" width="250" height="12" fill="#e14b4b" stroke="${N}" stroke-width="3"/>
<rect x="1350" y="500" width="12" height="100" fill="#dfe6ee" stroke="${N}" stroke-width="3"/><rect x="1548" y="500" width="12" height="100" fill="#dfe6ee" stroke="${N}" stroke-width="3"/>
<g transform="translate(1420 540)"><rect width="34" height="60" rx="5" fill="#e14b4b" stroke="${N}" stroke-width="3"/><rect x="6" y="8" width="22" height="14" fill="#bfe7ff" stroke="${N}" stroke-width="2"/><path d="M34 20 q14 0 14 20 v14" fill="none" stroke="${N}" stroke-width="4"/></g>
<g transform="translate(1476 540)"><rect width="34" height="60" rx="5" fill="#e14b4b" stroke="${N}" stroke-width="3"/><rect x="6" y="8" width="22" height="14" fill="#bfe7ff" stroke="${N}" stroke-width="2"/></g></g>`
// Signs and windows go on top of the night tint so they glow in the dark.
const NEON = `<g class="neon"><rect x="1050" y="386" width="130" height="46" rx="23" fill="${N}"/>${txt(1115, 419, 30, '#ff6f91', 'DINER')}</g><g class="neon"><rect x="1395" y="430" width="120" height="36" rx="8" fill="#fff" stroke="${N}" stroke-width="3"/>${txt(1455, 458, 26, '#e14b4b', 'FUEL')}</g>`
// The tint only darkens the buildings, not the sky between them.
const TINT_CLIP = `<clipPath id="sp-bldg"><rect x="8" y="396" width="276" height="204"/><circle cx="145" cy="352" r="46"/><rect x="298" y="338" width="344" height="262"/><rect x="698" y="194" width="234" height="406"/><rect x="976" y="428" width="278" height="172"/><rect x="1328" y="468" width="254" height="132"/><circle cx="672" cy="517" r="50"/><circle cx="1290" cy="503" r="56"/></clipPath>`
STREET += `${TINT_CLIP}<rect class="tint" width="1600" height="600" clip-path="url(#sp-bldg)"/>${(STREET.match(/<rect class="w"[^>]*\/>/g) || []).join('')}${NEON}${lamp(950)}`

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
const FRONT = `${lamp(120)}${lamp(520)}<g transform="translate(330 600)"><rect x="-16" y="-34" width="32" height="34" rx="6" fill="#e14b4b" stroke="${N}" stroke-width="3"/><rect x="-12" y="-44" width="24" height="12" rx="5" fill="#e14b4b" stroke="${N}" stroke-width="3"/></g><g transform="translate(700 600)"><rect x="-26" y="-30" width="52" height="8" rx="3" fill="#a46b3c" stroke="${N}" stroke-width="3"/><rect x="-26" y="-18" width="52" height="8" rx="3" fill="#a46b3c" stroke="${N}" stroke-width="3"/><path d="M-20 -10 v10 M20 -10 v10" stroke="${N}" stroke-width="4"/></g>`

const strip = (id, w, h) => {
  const one = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMinYMax meet"><use href="#${id}"/></svg>`
  return one + one
}

const CSS = `
html,body{background:#7fcdf5}
#splash{position:fixed;inset:0;z-index:2147483000;overflow:hidden;user-select:none;-webkit-user-select:none;font-family:'Lilita One',system-ui,sans-serif;transition:opacity .5s ease,transform .6s ease;
--sky1:#7fcdf5;--sky2:#d8f1ff;--far:#a8c6dc;--fw:transparent;--win:#bfe7ff;--glow:transparent;--bulb:#fff;--asph:#4a5571;--tint:transparent;--leaf:#5fae4a;--leaf2:#86cf63;--road:30%;--pave:#cfd6e2;--seam:#b9c2d2;
background:linear-gradient(var(--sky1),var(--sky2) 62%)}
#splash.dusk{--sky1:#5b4b9a;--sky2:#ffb37a;--far:#7b6a9c;--fw:#ffd98a;--win:#ffe7a8;--glow:rgba(255,220,140,.35);--bulb:#fff3b0;--asph:#3e4763;--tint:rgba(40,20,80,.22);--pave:#b7b4cc;--seam:#a19db8}
#splash.night{--sky1:#0d1838;--sky2:#2b3d72;--far:#22305a;--fw:#ffd36b;--win:#ffd36b;--glow:rgba(255,214,120,.45);--bulb:#fff3b0;--asph:#2a3149;--tint:rgba(8,16,48,.5);--pave:#7d87a3;--seam:#6c7592}
#splash.fall{--leaf:#f08a2c;--leaf2:#ffc078}#splash.winter{--leaf:#e9f1f7;--leaf2:#fff}#splash.spring{--leaf:#ff9fc4;--leaf2:#ffd1e3}
#splash.out{opacity:0;transform:scale(1.04);pointer-events:none}
#splash .orb{position:absolute;right:16%;top:30%;width:15vmin;height:15vmin;border-radius:50%;background:#fff6c2;box-shadow:0 0 0 2.4vmin rgba(255,246,194,.35),0 0 60px 20px rgba(255,240,170,.5)}
#splash.dusk .orb{top:52%;background:#ffd27a;box-shadow:0 0 80px 30px rgba(255,170,90,.6)}
#splash.night .orb{width:11vmin;height:11vmin;background:#eef2ff;box-shadow:inset -3vmin -1vmin 0 #c9d2f2,0 0 50px 10px rgba(200,215,255,.35)}
#splash .stars{position:absolute;inset:0 0 40% 0;display:none;background-image:radial-gradient(2px 2px at 12% 20%,#fff,transparent),radial-gradient(2px 2px at 30% 8%,#fff,transparent),radial-gradient(1.5px 1.5px at 48% 26%,#fff,transparent),radial-gradient(2px 2px at 66% 14%,#fff,transparent),radial-gradient(1.5px 1.5px at 84% 30%,#fff,transparent),radial-gradient(2px 2px at 92% 6%,#fff,transparent),radial-gradient(1.5px 1.5px at 6% 40%,#fff,transparent),radial-gradient(1.5px 1.5px at 56% 40%,#fff,transparent)}
#splash.night .stars{display:block}
#splash .cl{position:absolute;left:0;height:7vmin;width:22vmin;background:#fff;border-radius:99px;opacity:var(--o,.85);box-shadow:5vmin -3vmin 0 -1vmin #fff,-4vmin -2vmin 0 -1.3vmin #fff;animation:sp-drift var(--d,50s) linear infinite}
#splash.dusk .cl{background:#ffd9c4;box-shadow:5vmin -3vmin 0 -1vmin #ffd9c4,-4vmin -2vmin 0 -1.3vmin #ffd9c4}
#splash.night .cl{opacity:calc(var(--o,.85) * .15)}
@keyframes sp-drift{from{transform:translateX(110vw)}to{transform:translateX(-40vw)}}
#splash .layer{position:absolute;left:0;bottom:var(--b);height:var(--h);display:flex;width:max-content;animation:sp-scroll var(--t) linear infinite;will-change:transform}
#splash .layer svg{height:100%;width:auto;flex:none;display:block}
@keyframes sp-scroll{to{transform:translateX(-50%)}}
#splash .l1{--b:calc(var(--road) - 1%);--h:44%;--t:90s}
#splash .l2{--b:calc(var(--road) - .5%);--h:40%;--t:34s}
#splash .l3{--b:calc(var(--road) - .6%);--h:34%;--t:16s}
#splash .sky1{fill:var(--far)}#splash .fw{fill:var(--fw)}#splash .w{fill:var(--win)}#splash .glow{fill:var(--glow)}#splash .bulb{fill:var(--bulb)}#splash .tint{fill:var(--tint)}#splash .leaf{fill:var(--leaf)}#splash .leaf2{fill:var(--leaf2)}
#splash.night .neon{filter:drop-shadow(0 0 6px #ff6f91)}
#splash .street{position:absolute;left:0;right:0;bottom:0;height:var(--road);overflow:hidden}
#splash .walk,#splash .dash{position:absolute;left:0;width:calc(100% + 260px);animation:sp-roll var(--rt) linear infinite;will-change:transform}
#splash .walk{--rt:.92s;top:0;height:22%;background:repeating-linear-gradient(90deg,var(--pave) 0 128px,var(--seam) 128px 130px);border-top:4px solid ${N};border-bottom:6px solid #8e9ab0}
#splash .asph{position:absolute;left:0;right:0;top:22%;bottom:0;background:var(--asph)}
#splash .dash{--rt:.5s;top:calc(22% + 78% * .34);height:6px;border-radius:3px;background:repeating-linear-gradient(90deg,#ffe066 0 60px,transparent 60px 130px)}
@keyframes sp-roll{to{transform:translateX(-130px)}}
#splash .car{position:absolute;left:50%;bottom:calc(var(--road) * .42);width:min(62vw,300px);transform:translateX(-50%);overflow:visible;z-index:3}
#splash .car .body{animation:sp-bob .3s ease-in-out infinite alternate}
@keyframes sp-bob{to{transform:translateY(2px)}}
#splash .spin{animation:sp-spin .45s linear infinite}
@keyframes sp-spin{to{transform:rotate(360deg)}}
#splash .beam{opacity:0}#splash.night .beam,#splash.dusk .beam{opacity:1}
#splash .wm{position:absolute;left:50%;top:calc(9% + env(safe-area-inset-top));width:min(84vw,620px);transform:translateX(-50%);filter:drop-shadow(0 6px 14px rgba(20,33,61,.25));z-index:5;animation:sp-in .7s cubic-bezier(.2,1.6,.4,1) both}
@keyframes sp-in{from{transform:translateX(-50%) scale(.6);opacity:0}}
#splash .ld{position:absolute;left:50%;bottom:calc(5% + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:6;background:none;border:0;padding:0;font:inherit;color:inherit}
#splash .bar{width:min(64vw,300px);height:20px;border-radius:99px;background:#1f3358;border:3px solid ${N};box-shadow:inset 0 3px 0 rgba(0,0,0,.35),0 3px 0 rgba(0,0,0,.25);overflow:hidden;padding:2px}
#splash .bar i{display:block;height:100%;width:100%;border-radius:99px;background:linear-gradient(#ffe98a,#ffb21a);box-shadow:inset 0 2px 0 rgba(255,255,255,.6);transform-origin:0 50%;transform:scaleX(.06);transition:transform .35s ease}
#splash .ld b{font-weight:400;font-size:17px;color:#fff;letter-spacing:.5px;text-shadow:0 2px 0 ${N},0 0 2px ${N}}
@media (min-aspect-ratio:1/1){#splash{--road:26%}#splash .l1{--h:40%}#splash .l2{--h:46%}#splash .l3{--h:40%}#splash .wm{width:min(50vw,600px);top:6%}#splash .car{width:min(26vw,320px)}}
@media (prefers-reduced-motion:reduce){#splash *{animation:none!important}}
`

// Picks the sky and season, eases the bar forward while the game downloads,
// and gives src/lib/splash.ts its handle. Kept tiny: it runs before anything else.
const JS = `(function(){
var q=new URLSearchParams(location.search),el=document.getElementById('splash');
var f=document.createElement('link');f.rel='stylesheet';f.href='https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;800&display=swap';document.head.appendChild(f);
if(q.has('nosplash')){el.remove();return}
var t=q.get('time'),p=t===null?(Date.now()%12e5)/12e5:+t,d=Math.abs(p-.5),n=d<.14?1:d>.26?0:1-(d-.14)/.12;
var m=new Date().getMonth();
el.className=(n>.7?'night':n>.08?'dusk':'day')+' '+(q.get('season')||(m<2||m>10?'winter':m<5?'spring':m<8?'summer':'fall'));
var bar=el.querySelector('.bar i'),lab=el.querySelector('.ld b'),v=.06,cap=.6,end=0;
function draw(){bar.style.transform='scaleX('+v+')'}
var tick=setInterval(function(){v+=(cap-v)*.04;draw()},120);
var slow=setTimeout(function(){lab.textContent='Still loading\\u2026 tap to retry';el.querySelector('.ld').onclick=function(){location.reload()}},30000);
window.cartopiaSplash={set:function(x){if(x>v)v=x;cap=Math.max(cap,Math.min(.97,x+.08));draw()},done:function(){if(end)return;end=1;clearInterval(tick);clearTimeout(slow);v=1;draw();setTimeout(function(){el.classList.add('out');setTimeout(function(){el.remove()},650)},250)}};
})()`

const BODY = `<div id="splash">
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><g id="sp-sky" class="sky1">${SKY}</g><g id="sp-street">${STREET}</g><g id="sp-front">${FRONT}</g></defs></svg>
<div class="stars"></div><div class="orb"></div><div class="cl" style="top:34%"></div><div class="cl" style="top:46%;--d:70s;animation-delay:-30s;--o:.7"></div>
<div class="layer l1">${strip('sp-sky', 1200, 350)}</div>
<div class="layer l2">${strip('sp-street', 1600, 600)}</div>
<div class="street"><div class="walk"></div><div class="asph"></div><div class="dash"></div></div>
<div class="layer l3">${strip('sp-front', 800, 600)}</div>
${CAR}${WORDMARK}
<button class="ld" type="button" tabindex="-1"><span class="bar"><i></i></span><b>Loading your town…</b></button>
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
