// COZY VINLAND (27 Nov, Dev OK'd): /map/?cozy
// The map builds the whole country from the live sheet as always. This file then copies what it built (every home, shop,
// fence, tree, road and the plaza) and draws it in the cozy low-poly style on its own screen: flat colours, soft light,
// day and night by the clock, glowing windows. The country is cut into 128 m squares; only the squares near you are built,
// each one as a handful of merged meshes, so a phone draws ~20-60 things a frame instead of ~1,200.
// The layout is never touched: positions, shapes and colours come straight from the map.
(async () => {
if (window.VCOZY) return;
const CZ = window.VCOZY = { phase: 'start' };
const T = THREE, wait = ms => new Promise(r => setTimeout(r, ms));
const QS = new URLSearchParams(location.search);

// ---------- 0. a screen of our own on top of the map ----------
const css = document.createElement('style'); css.textContent = `
#cozy { position: fixed; inset: 0; z-index: 200; background: #b6d8ef; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; font: 600 15px/1.3 Poppins, system-ui, sans-serif; color: #fff; }
#cozy canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#cozy .chip { position: absolute; z-index: 3; background: rgba(20,26,44,.72); color: #fff; border-radius: 14px; padding: 6px 12px; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
#cozy { --cr: rgba(251,246,236,.96); --ink: #2B2420; --gold: #FFC446; --goldD: #D9961C; --sh: 0 2px 8px rgba(43,36,32,.22); --t: env(safe-area-inset-top); --l: env(safe-area-inset-left); --r: env(safe-area-inset-right); --b: env(safe-area-inset-bottom); }
#cozy .pill { position: absolute; z-index: 3; display: flex; align-items: center; gap: 8px; height: 40px; box-sizing: border-box; padding: 0 14px; border: 0; border-radius: 999px; background: var(--cr); color: var(--ink); box-shadow: var(--sh); font: 700 14px Poppins, system-ui, sans-serif; white-space: nowrap; }
#czMe { top: calc(12px + var(--t)); left: calc(16px + var(--l)); padding-left: 5px !important; cursor: pointer; max-width: 40vw; }
@media (orientation: portrait) { #czMe { max-width: calc(100vw - 140px); } }
#czMe .av { flex: none; width: 30px; height: 30px; border-radius: 50%; background: #2e9c8a; color: #fff; display: grid; place-items: center; }
#czMe span:last-of-type { overflow: hidden; text-overflow: ellipsis; }
#czClock { top: calc(12px + var(--t)); left: 50%; transform: translateX(-50%); }
#czMap { position: absolute; z-index: 3; top: calc(12px + var(--t)); right: calc(16px + var(--r)); width: 92px; height: 92px; pointer-events: none; }
#czMapC { width: 100%; height: 100%; border-radius: 50%; display: block; background: #dde6c4; box-shadow: var(--sh), 0 0 0 3px rgba(251,246,236,.96); }
#czN { position: absolute; left: 0; top: 0; width: 18px; height: 18px; border-radius: 50%; background: var(--ink); color: #FBF6EC; font: 700 10px/18px Poppins, system-ui, sans-serif; text-align: center; }
#czWhere { position: absolute; right: 0; top: calc(100% + 9px); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: var(--cr); color: var(--ink); border-radius: 999px; padding: 2px 10px; font: 700 12px/1.5 Poppins, system-ui, sans-serif; box-shadow: var(--sh); }
#czWhere:empty { display: none; }
#czToday { position: absolute; z-index: 3; top: calc(64px + var(--t)); left: calc(16px + var(--l)); width: 214px; box-sizing: border-box; background: var(--cr); color: var(--ink); border-radius: 16px; box-shadow: var(--sh); padding: 2px 12px 10px; }
#czTodayH { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; min-height: 34px; cursor: pointer; font: 800 14px Poppins, system-ui, sans-serif; }
#czTodayH small { margin-left: auto; font-weight: 600; font-size: 12px; opacity: .65; }
#czTodayH i { font-style: normal; font-size: 12px; transition: transform .2s; }
#czToday.fold { padding-bottom: 2px; } #czToday.fold ol { display: none; } #czToday.fold #czTodayH i { transform: rotate(-90deg); }
#czTasks { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
#czTasks li { cursor: pointer; display: flex; gap: 8px; align-items: center; font: 600 13px/1.25 Poppins, system-ui, sans-serif; }
#czTasks li::before { content: ''; flex: none; width: 17px; height: 17px; box-sizing: border-box; border-radius: 50%; border: 2px solid #b9ad97; }
#czTasks li.ok { opacity: .6; } #czTasks li.ok span { text-decoration: line-through; }
#czTasks li.ok::before { border: 0; background: #2e9c8a url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E") center/12px no-repeat; }
#czTasks li.new::before { animation: czPop .5s ease-out; } @keyframes czPop { 0% { transform: scale(.3); } 60% { transform: scale(1.35); } 100% { transform: scale(1); } }
#czFps { bottom: calc(4px + var(--b)); left: 50%; transform: translateX(-50%); font-size: 10px; padding: 1px 8px !important; opacity: .7; white-space: nowrap; }
#czStick { position: absolute; left: calc(40px + var(--l)); bottom: calc(26px + var(--b)); width: 112px; height: 112px; box-sizing: border-box; border-radius: 50%; background: rgba(43,36,32,.22); border: 3px solid rgba(251,246,236,.9); z-index: 3; touch-action: none; }
#czKnob { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; background: rgba(251,246,236,.95); box-shadow: 0 2px 6px rgba(43,36,32,.3); }
#cozy:not(.touch) #czStick { display: none; } #cozy.touch #czKeys, #cozy.touch kbd { display: none; }
#czKeys { left: calc(16px + var(--l)); bottom: calc(22px + var(--b)); height: 32px !important; font-size: 12px !important; font-weight: 600 !important; }
#cozy .rb { position: absolute; z-index: 3; width: 50px; height: 50px; padding: 0; border: 0; border-radius: 50%; background: var(--cr); color: var(--ink); box-shadow: var(--sh); display: grid; place-items: center; cursor: pointer; }
#cozy .rb[aria-pressed=true] { background: var(--gold); box-shadow: 0 3px 0 var(--goldD); }
#cozy .rb[hidden] { display: none; }
#czRun { right: calc(128px + var(--r)); bottom: calc(26px + var(--b)); } #czJump { right: calc(196px + var(--r)); bottom: calc(26px + var(--b)); }
@media (max-height: 500px) { #czTasks li.ok { display: none; } #czTasks li:nth-child(n+5) { display: none; } } #czCarB { right: calc(120px + var(--r)); bottom: calc(98px + var(--b)); } #czPhoto { right: calc(42px + var(--r)); bottom: calc(124px + var(--b)); }
#czAct { position: absolute; z-index: 3; right: calc(26px + var(--r)); bottom: calc(22px + var(--b)); width: 88px; height: 88px; padding: 0; border: 0; border-radius: 50%; background: var(--gold); color: var(--ink); box-shadow: 0 5px 0 var(--goldD), 0 0 0 6px rgba(255,196,70,.35); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer; font: 800 17px/1.1 Poppins, system-ui, sans-serif; }
#czAct small { font: 600 10px/1.2 Poppins, system-ui, sans-serif; max-width: 74px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } #czAct small:empty { display: none; }
#czAct:active, #cozy .rb:active, #czMe:active { transform: translateY(2px); }
#cozy kbd { position: absolute; top: -3px; right: -3px; min-width: 18px; height: 18px; box-sizing: border-box; padding: 0 4px; border-radius: 6px; background: var(--ink); color: #FBF6EC; font: 700 10px/18px Poppins, system-ui, sans-serif; text-align: center; }
#czMe kbd { position: static; margin-left: 2px; }
#czMenu { position: absolute; inset: 0; z-index: 6; display: flex; background: rgba(43,36,32,.35); color: var(--ink); }
#czMenu[hidden] { display: none; }
#czMenu .sh { width: min(340px, 88vw); height: 100%; overflow-y: auto; box-sizing: border-box; padding: calc(12px + var(--t)) 16px calc(16px + var(--b)) calc(16px + var(--l)); background: #FBF6EC; box-shadow: 4px 0 16px rgba(43,36,32,.25); }
#czMenu .mh { display: flex; align-items: center; justify-content: space-between; font: 800 18px Poppins, system-ui, sans-serif; }
#czMenu .x { width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(43,36,32,.08); color: var(--ink); font: 700 16px Poppins, system-ui, sans-serif; cursor: pointer; }
#czMenu h3 { margin: 14px 0 6px; font: 700 11px Poppins, system-ui, sans-serif; text-transform: uppercase; letter-spacing: .07em; opacity: .6; }
#czFind { display: flex; gap: 6px; margin: 0; }
#czFind input { flex: 1; min-width: 0; height: 42px; box-sizing: border-box; border: 2px solid #e2d8c4; border-radius: 12px; padding: 0 12px; background: #fff; color: var(--ink); font: 600 15px Poppins, system-ui, sans-serif; }
#czFind button { height: 42px; padding: 0 16px; border: 0; border-radius: 12px; background: var(--gold); box-shadow: 0 3px 0 var(--goldD); color: var(--ink); font: 800 15px Poppins, system-ui, sans-serif; cursor: pointer; }
#czFindMsg { display: block; margin-top: 6px; min-height: 1em; font: 600 12px/1.4 Poppins, system-ui, sans-serif; opacity: .8; }
#czBus { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
#czBus button, #czTimes button { min-height: 40px; border: 0; border-radius: 12px; background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(43,36,32,.18); font: 700 13px/1.2 Poppins, system-ui, sans-serif; cursor: pointer; text-align: left; padding: 6px 10px; }
#czTimes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; } #czTimes button { text-align: center; padding: 6px 2px; }
#czTimes button[aria-pressed=true] { background: var(--gold); box-shadow: 0 2px 0 var(--goldD); }
#czFade { position: absolute; inset: 0; z-index: 7; background: #FBF6EC; opacity: 0; pointer-events: none; transition: opacity .35s; } #czFade.on { opacity: 1; }
#czFlash { position: absolute; inset: 0; z-index: 7; background: #fff; opacity: 0; pointer-events: none; transition: opacity .5s; } #czFlash.on { opacity: .85; transition: none; }
#czTurn { left: 50%; bottom: calc(160px + var(--b)); transform: translateX(-50%); transition: opacity .4s; } #czTurn.off { opacity: 0; pointer-events: none; }
@media (orientation: portrait) { #czClock { top: calc(60px + var(--t)); left: calc(16px + var(--l)); transform: none; height: 32px; padding: 0 10px; font-size: 12px; } #czToday { top: calc(100px + var(--t)); width: 200px; } #czMap { width: 80px; height: 80px; } }
@media (max-height: 360px) and (orientation: landscape) { #czToday { width: 200px; } #czTasks { gap: 5px; } #czTasks li { font-size: 12px; } #czStick { width: 100px; height: 100px; bottom: calc(14px + var(--b)); } }
@media (prefers-reduced-motion: reduce) { #czFade, #czFlash, #czTurn, #czTodayH i { transition: none; } #czTasks li.new::before { animation: none; } }
#czLoad { position: absolute; inset: 0; z-index: 9; display: grid; place-items: center; background: linear-gradient(#b6d8ef, #f1f4ee); color: #1c2238; font-size: 22px; font-weight: 800; text-align: center; transition: opacity .4s; }
#czLoad small { display: block; font-size: 14px; font-weight: 600; opacity: .7; }
@media (prefers-reduced-motion: reduce) { #czLoad { transition: none; } }`;
document.head.appendChild(css);
const root = document.createElement('div'); root.id = 'cozy';
const SVG = d => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const IC = { jump: SVG('M12 19V6M6.5 11.5L12 6l5.5 5.5M7 21h10'), menu: SVG('M5 7h14M5 12h14M5 17h14'), run: SVG('M14 3.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M6 20l3.5-5 3 2.5V22M9.5 15l1.5-6.5 4 3.5h3.5M11 8.5L7 10l-2 3'), car: SVG('M3 16v-4l2.2-5h13.6l2.2 5v4zM3 16v2.5h3V16M18 16v2.5h3V16M6.5 12.5h.01M17.5 12.5h.01'),
  walk: SVG('M11 3.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M9 21l2.5-6 2.5 2v4M11.5 15l1-6 3 3h3M12.5 9L9 10.5 7.5 14'), cam: SVG('M4 8h3l2-3h6l2 3h3v11H4zM8.5 13a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0'), home: SVG('M4 11l8-6 8 6v9H4zM10 20v-5h4v5') };
root.innerHTML = `<div id="czLoad"><div>Building cozy Vinland…<small id="czLt">copying our homes, plaza and streets</small></div></div>
<button class="pill" id="czMe" type="button" aria-label="Menu"><span class="av">${IC.menu}</span><span id="czMeName">Find your home</span><kbd>M</kbd></button>
<div class="pill" id="czClock"><span id="czIco">☀️</span><span id="czCt">…</span></div>
<div id="czMap" aria-hidden="true"><canvas id="czMapC"></canvas><b id="czN">N</b><span id="czWhere"></span></div>
<div id="czToday"><button type="button" id="czTodayH" aria-expanded="true"><span>Today</span><small id="czTodayN"></small><i aria-hidden="true">▾</i></button><ol id="czTasks"></ol></div>
<div class="chip" id="czFps">…</div><div id="czStick"><div id="czKnob"></div></div><div class="pill" id="czKeys">WASD walk · drag to look</div>
<button class="rb" id="czJump" type="button" aria-label="Jump">${IC.jump}<kbd>␣</kbd></button><button class="rb" id="czRun" type="button" aria-pressed="false" aria-label="Run">${IC.run}<kbd>⇧</kbd></button>
<button class="rb" id="czCarB" type="button" aria-pressed="false" aria-label="Drive a car">${IC.car}<kbd>C</kbd></button>
<button class="rb" id="czPhoto" type="button" aria-label="Take a photo">${IC.cam}<kbd>P</kbd></button>
<button id="czAct" type="button"><b id="czActL">Wave</b><small id="czActS"></small><kbd>E</kbd></button>
<div class="pill off" id="czTurn" aria-live="polite">Turn your phone sideways to play</div>
<div id="czMenu" hidden><div class="sh" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="mh">Life in Vinland<button type="button" class="x" id="czMenuX" aria-label="Close menu">✕</button></div>
  <h3 id="czFindT">Find your home</h3>
  <form id="czFind" autocomplete="off"><input id="czFindI" aria-labelledby="czFindT" placeholder="Instagram name" autocapitalize="off" spellcheck="false" enterkeyhint="go"><button type="submit">Go</button></form>
  <small id="czFindMsg"></small>
  <h3>Free bus to</h3><div id="czBus"></div>
  <h3>Time of day</h3>
  <div id="czTimes" role="group" aria-label="Time of day"><button type="button" data-h="live" aria-pressed="true">Live</button><button type="button" data-h="12" aria-pressed="false">Noon</button><button type="button" data-h="17.4" aria-pressed="false">Sunset</button><button type="button" data-h="21" aria-pressed="false">Night</button></div>
</div></div><div id="czFade"></div><div id="czFlash"></div>`;
document.body.appendChild(root); { const cv = document.getElementById('czCover'); if (cv) cv.remove(); } /* 28 Nov: one loading screen only */
const $ = id => document.getElementById(id), lt = $('czLt');

// ---------- 1. wait until the map has built everything (homes, street life, downtown, looks) ----------
const t0 = performance.now();
while (!(LIFE.on || performance.now() - t0 > 9000)) await wait(250);
await wait(1200);
const skip = new Set();   // things the game does not draw: walkers, moving and parked cars, scooters, buses, the train, the ferry
try { const wb = walkers.batches || {}; Object.values(wb).forEach(list => (list || []).forEach(x => skip.add(x.im || x))); } catch (e) {}
try { LIFE.cars.forEach(c => (c.meshes || []).forEach(m => { skip.add(m); if (m.parent) skip.add(m.parent); })); ['carHatch', 'carSedan', 'carSUV', 'carTaxi', 'carVan', 'carPickup', 'carSports', 'scooter', 'autoRickshaw'].forEach(k => LIFE.inst && LIFE.inst[k] && skip.add(LIFE.inst[k])); } catch (e) {}
try { TRANSIT.list.forEach(l => l.cars.forEach(c => skip.add(c.m))); } catch (e) {}
try { peopleObjs.forEach(x => skip.add(x.im || x)); } catch (e) {}   // shop owners, staff, police: Kenney citizens take their places (section 6d)
const hidW = []; skip.forEach(o => { if (o && o.isObject3D && o.visible) { o.visible = false; hidW.push(o); } });   // 27 Nov: the game does not draw these, so they are not walls either (a bus waiting at the Market stop when the game loaded left an invisible wall on the pavement)
try { const t0 = performance.now(); buildWalkGrid({ step: 0.85, slopes: true }); console.log('cozy: walk grid ' + Math.round(performance.now() - t0) + ' ms'); } catch (e) { console.warn('cozy: walk grid', e); }   // the map's own "where can you walk" rule, built before we take its meshes away. 27 Nov: plus grid2 for walking, where bridge ramps, pier decks and canal bridges (up to 0.85 m) are not walls
hidW.forEach(o => { o.visible = true; });
const G2 = WALK.grid2, blocked2 = (x, z) => { if (x < BUILT.x0 || x > BUILT.x1 || z < COAST.shore + 6 || z > BUILT.z1) return true; if (!G2) return blockedAt(x, z); const i = Math.floor((x - WG.x0) / WG.s), j = Math.floor((z - WG.z0) / WG.s); return i < 0 || j < 0 || i >= WG.w || j >= WG.h || G2[j * WG.w + i] === 1; };
const walkFree = (x, z) => !blocked2(x - RAD, z - RAD) && !blocked2(x + RAD, z - RAD) && !blocked2(x - RAD, z + RAD) && !blocked2(x + RAD, z + RAD) && !blocked2(x, z);   // you (the player) walk by grid2; trees, flowers and walkers keep the old grid   // the map's own "where can you walk" rule, built before we take its meshes away
renderer.render = () => {};   // the map stops drawing: everything below is drawn by the cozy screen
renderer.domElement.style.visibility = 'hidden';
lt.textContent = 'cutting the country into squares';
await wait(30);

// test link ?cozy&far (27 Nov): see far, a game camera that looks ahead (landscape) and the map-walk fixes. Normal players keep the old game until Dev says OK.
const FARV = /[?&]far(=|&|$)/.test(location.search) || !PHONE;   // far view + look-ahead camera: laptops for everyone (Dev, 27 Nov), phones only on the test link (?far) until tested sideways
// ---------- 2. copy the map: each shape once, each place it stands, cut into squares ----------
const TILE = 128, KOFF = 1000, kOf = (ix, iz) => (ix + KOFF) * 10000 + (iz + KOFF), tkey = (x, z) => kOf(Math.floor(x / TILE), Math.floor(z / TILE)), kX = k => Math.floor(k / 10000) - KOFF, kZ = k => k % 10000 - KOFF;   // square numbers are always positive
const B_MAIN = 0, B_MAIND = 1, B_GLASS = 2, B_WARM = 3, B_LAMP = 4, B_WATER = 5, B_TEX = 16;
const GLASS = 0x3f5866, WARM = 0xf0c36a, LAMPS = new Set([0xf6d27a, 0xffd98a]), WATERS = new Set([0x3fa3c4, 0x4aa3cf, 0x3a8fc2, 0x2f7db3, 0x7fd0de, 0x3f9cc2, 0x4ab3dc, 0x5fb3c8]);   // 27 Nov: canal + pools (kept their colour), river + lake (3 depths), sea, beach pools, tanks: all water now (it moves, and you can't walk on it)
const REMAP = { 0x5ab4d0: 0x3fa3c4, 0x86ab5c: 0x8fc25a, 0x76a052: 0x84b74f, 0x93b865: 0x9ccb63, 0x3f6f3a: 0x3f7a45, 0x45474d: 0x55585f };
const shapes = [], shapeOf = new Map(), textures = [], texOf = new Map();
const pS = [], pB = [], pC = [], pM = [];   // each place: shape, bucket, colour, and where it stands (12 numbers); packed into typed arrays below
const chimTops = [];   // the real top of every chimney, found in the copied shapes (the small highest part of a home's stone-coloured piece)
function chimOf(S) { if (S.chim !== undefined) return S.chim; let my = -1e9; for (let i = 0; i < S.n; i++) my = Math.max(my, S.P[i * 3 + 1]);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0; for (let i = 0; i < S.n; i++) if (S.P[i * 3 + 1] > my - 0.02) { x0 = Math.min(x0, S.P[i * 3]); x1 = Math.max(x1, S.P[i * 3]); z0 = Math.min(z0, S.P[i * 3 + 2]); z1 = Math.max(z1, S.P[i * 3 + 2]); n++; }
  return (S.chim = n && x1 - x0 < 1.2 && z1 - z0 < 1.2 && my > 6 ? [(x0 + x1) / 2, my, (z0 + z1) / 2] : null); }
const addPlace = (sid, b, rgb, e) => { if (rgb === 0xd9c49a && b === B_MAIN) { const c = chimOf(shapes[sid]); if (c) chimTops.push(e[0] * c[0] + e[4] * c[1] + e[8] * c[2] + e[12], e[1] * c[0] + e[5] * c[1] + e[9] * c[2] + e[13] + 0.1, e[2] * c[0] + e[6] * c[1] + e[10] * c[2] + e[14]); } pS.push(sid); pB.push(b); pC.push(rgb); pM.push(e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10], e[12], e[13], e[14]); };
const chunks = new Map();   // tile -> list of world-space pieces {b, P(Float32), C(Uint8 sRGB), U}
const huge = [];   // giant triangles (ground, sea): drawn always
const hex = c => (Math.round(c.r * 255) << 16) | (Math.round(c.g * 255) << 8) | Math.round(c.b * 255);
const bucketOf = (rgb, m) => m.map ? B_TEX + texId(m) : rgb === GLASS ? B_GLASS : rgb === WARM ? B_WARM : LAMPS.has(rgb) ? B_LAMP : WATERS.has(rgb) ? B_WATER : m.side === T.DoubleSide ? B_MAIND : B_MAIN;
function texId(m) { const k = m.map.uuid + (m.transparent ? 't' : '') + (m.type === 'MeshBasicMaterial' ? 'b' : '') + (m.side === T.DoubleSide ? 'd' : ''); if (texOf.has(k)) return texOf.get(k);
  const id = textures.length; textures.push({ image: m.map.image, flipY: m.map.flipY, wrapS: m.map.wrapS, wrapT: m.map.wrapT, repeat: m.map.repeat.clone(), offset: m.map.offset.clone(), tr: m.transparent, op: m.opacity, basic: m.type === 'MeshBasicMaterial', ds: m.side === T.DoubleSide }); texOf.set(k, id); return id; }
function shapeId(g, gi, start, count, withUv) { const k = g.uuid + ':' + gi + ':' + (withUv ? 1 : 0); if (shapeOf.has(k)) return shapeOf.get(k);
  const pos = g.attributes.position, idx = g.index, col = g.attributes.color, uv = g.attributes.uv, P = new Float32Array(count * 3), C = col ? new Uint8Array(count * 3) : null, U = withUv && uv ? new Float32Array(count * 2) : null; const cs = colScale(col);
  for (let i = 0; i < count; i++) { const v = idx ? idx.getX(start + i) : start + i; P[i * 3] = pos.getX(v); P[i * 3 + 1] = pos.getY(v); P[i * 3 + 2] = pos.getZ(v);
    if (C) { C[i * 3] = Math.round(Math.min(1, col.getX(v) * cs) * 255); C[i * 3 + 1] = Math.round(Math.min(1, col.getY(v) * cs) * 255); C[i * 3 + 2] = Math.round(Math.min(1, col.getZ(v) * cs) * 255); }
    if (U) { U[i * 2] = uv.getX(v); U[i * 2 + 1] = uv.getY(v); } }
  let r2 = 0; for (let i = 0; i < count; i++) r2 = Math.max(r2, P[i * 3] ** 2 + P[i * 3 + 1] ** 2 + P[i * 3 + 2] ** 2);
  const id = shapes.length; shapes.push({ P, C, U, n: count, r: Math.sqrt(r2) }); shapeOf.set(k, id); return id; }
const V = new T.Vector3(), CEN = new T.Vector3(), M4 = new T.Matrix4(), CL = new T.Color();
const colScale = a => !a ? 1 : a.normalized ? (a.array instanceof Uint8Array || a.array instanceof Uint8ClampedArray ? 1 / 255 : a.array instanceof Uint16Array ? 1 / 65535 : a.array instanceof Int8Array ? 1 / 127 : 1) : 1;   // colours stored as small whole numbers (0-255) are read as 0-1
function worldPieces(g, start, count, mw, rgb, b, withUv) {   // a mesh that covers a big area: its triangles go to the squares they sit in
  const pos = g.attributes.position, idx = g.index, col = g.attributes.color, uv = g.attributes.uv, n = count / 3; const cs = colScale(col);
  const P = new Float32Array(count * 3); for (let i = 0; i < count; i++) { const v = idx ? idx.getX(start + i) : start + i; V.fromBufferAttribute(pos, v).applyMatrix4(mw); P[i * 3] = V.x; P[i * 3 + 1] = V.y; P[i * 3 + 2] = V.z; }
  const byTile = new Map();
  for (let t = 0; t < n; t++) { const o = t * 9; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let j = 0; j < 3; j++) { x0 = Math.min(x0, P[o + j * 3]); x1 = Math.max(x1, P[o + j * 3]); z0 = Math.min(z0, P[o + j * 3 + 2]); z1 = Math.max(z1, P[o + j * 3 + 2]); }
    const k = (x1 - x0 > 260 || z1 - z0 > 260) ? 'huge' : tkey((x0 + x1) / 2, (z0 + z1) / 2); (byTile.get(k) || byTile.set(k, []).get(k)).push(t); }
  for (const [k, list] of byTile) { const m = list.length * 3, Pp = new Float32Array(m * 3), Cc = new Uint8Array(m * 3), Uu = withUv && uv ? new Float32Array(m * 2) : null;
    const r = (rgb >> 16 & 255) / 255, gg = (rgb >> 8 & 255) / 255, bb = (rgb & 255) / 255;
    list.forEach((t, q) => { for (let j = 0; j < 3; j++) { const s = t * 3 + j, d = q * 3 + j, v = idx ? idx.getX(start + s) : start + s; Pp[d * 3] = P[s * 3]; Pp[d * 3 + 1] = P[s * 3 + 1]; Pp[d * 3 + 2] = P[s * 3 + 2];
      const cr = col ? col.getX(v) * cs : 1, cg = col ? col.getY(v) * cs : 1, cb = col ? col.getZ(v) * cs : 1; Cc[d * 3] = Math.round(Math.min(1, r * cr) * 255); Cc[d * 3 + 1] = Math.round(Math.min(1, gg * cg) * 255); Cc[d * 3 + 2] = Math.round(Math.min(1, bb * cb) * 255);
      if (Uu) { Uu[d * 2] = uv.getX(v); Uu[d * 2 + 1] = uv.getY(v); } } });
    const piece = { b, P: Pp, C: Cc, U: Uu }; if (k === 'huge') huge.push(piece); else (chunks.get(k) || chunks.set(k, []).get(k)).push(piece); }
}
scene.updateMatrixWorld(true);
const keep = [];
scene.traverseVisible(o => { if (skip.has(o)) return; let p = o.parent; while (p) { if (skip.has(p)) return; p = p.parent; } keep.push(o); });
for (const o of keep) {
  if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position) continue;
  const g = o.geometry, mats = Array.isArray(o.material) ? o.material : [o.material], total = g.index ? g.index.count : g.attributes.position.count;
  const groups = Array.isArray(o.material) && g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
  if (o.isInstancedMesh) {
    const extra = Object.values(g.attributes).some(a => a.isInstancedBufferAttribute);
    for (const gr of groups) { const m = mats[gr.materialIndex] || mats[0]; if (!m || m.visible === false) continue; const cnt = Math.min(gr.count, total - gr.start); if (cnt < 3) continue;
      const tex = !!m.map && !extra, base = m.color || CL.setRGB(1, 1, 1); let sid = -1;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M4); const e = M4.elements; if (e[0] === 0 && e[5] === 0 && e[10] === 0) continue; M4.premultiply(o.matrixWorld);
        if (sid < 0) sid = shapeId(g, gr.materialIndex, gr.start, cnt, tex);
        CL.copy(base); if (o.instanceColor) { const ic = colScale(o.instanceColor); CL.multiply(new T.Color(o.instanceColor.getX(i) * ic, o.instanceColor.getY(i) * ic, o.instanceColor.getZ(i) * ic)); }
        let rgb = hex(CL); rgb = REMAP[rgb] || rgb; addPlace(sid, tex ? B_TEX + texId(m) : bucketOf(rgb, m.map && !tex ? Object.assign({}, m, { map: null }) : m), rgb, M4.elements); } }
    continue;
  }
  if (!g.boundingSphere) g.computeBoundingSphere(); const rad = g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis();
  const bc = CEN.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld), mw = o.matrixWorld.elements, baked = Math.hypot(bc.x - mw[12], bc.z - mw[14]) > 20;   // a baked group: shapes far from the mesh's own centre go to the squares they cover, not all to the plaza's square (Dev OK 27 Nov)
  for (const gr of groups) { const m = mats[gr.materialIndex] || mats[0]; if (!m || m.visible === false) continue; const cnt = Math.min(gr.count, total - gr.start); if (cnt < 3) continue;
    let rgb = m.color ? hex(m.color) : 0xffffff; rgb = REMAP[rgb] || rgb; const b = bucketOf(rgb, m);
    if (rad > 30 || baked) worldPieces(g, gr.start, cnt, o.matrixWorld, rgb, b, !!m.map);
    else addPlace(shapeId(g, gr.materialIndex, gr.start, cnt, !!m.map), b, rgb, o.matrixWorld.elements); }
}
// places grouped by square
const tilePlaces = new Map();
const PL = { s: Int32Array.from(pS), b: Uint8Array.from(pB), c: Uint32Array.from(pC), m: Float32Array.from(pM), n: pS.length }; pS.length = pB.length = pC.length = pM.length = 0;
for (let i = 0; i < PL.n; i++) { const k = tkey(PL.m[i * 12 + 9], PL.m[i * 12 + 11]); (tilePlaces.get(k) || tilePlaces.set(k, []).get(k)).push(i); }
for (const [k, l] of tilePlaces) tilePlaces.set(k, Int32Array.from(l));
CZ.stats = { shapes: shapes.length, places: PL.n, squares: new Set([...tilePlaces.keys(), ...chunks.keys()]).size, huge: huge.length, textures: textures.length };
console.log('cozy: copied', JSON.stringify(CZ.stats));
// the map's own meshes are no longer drawn: take them out of its scene and free them
keep.forEach(o => { if (!o.isMesh || o.isSkinnedMesh) return; if (o.geometry && o.geometry.dispose) o.geometry.dispose(); if (o.parent) o.parent.remove(o); });
keep.length = 0;
CZ.phase = 'copied';

// ---------- 3. our renderer, light, sky ----------
const PH = PHONE;
let LFOV = 50, LDIST = 22;   // landscape camera on the test link: wider view, a bit closer
const camFov = () => innerWidth > innerHeight ? (FARV ? LFOV : 40) : 46;
// haze by real distance, not by depth on screen: with a wide, low camera the edge of the built world would show at the sides
// (worked out per pixel, because the ground and the sea are giant triangles and a per-corner distance would wash them out)
if (FARV) { const SC = T.ShaderChunk, V = 'varying float fogDepth;', ch = {
    fog_pars_vertex: SC.fog_pars_vertex.replace(V, V + ' varying vec3 vFogPos;'), fog_vertex: SC.fog_vertex.replace('fogDepth = - mvPosition.z;', 'fogDepth = - mvPosition.z; vFogPos = mvPosition.xyz;'),
    fog_pars_fragment: SC.fog_pars_fragment.replace(V, V + ' varying vec3 vFogPos;'), fog_fragment: SC.fog_fragment.replace(/fogDepth/g, 'length( vFogPos )') };
  if (Object.keys(ch).every(k => ch[k] !== SC[k])) Object.assign(SC, ch); }
const R3 = new T.WebGLRenderer({ antialias: !PH, powerPreference: 'high-performance' });
const fitR3 = () => { const pr = Math.min(devicePixelRatio || 1, PH ? (FARV ? 1.25 : 1.5) : 2); if (R3.getPixelRatio() !== pr) R3.setPixelRatio(pr); R3.setSize(innerWidth, innerHeight); };   // test link: phones draw a little less sharp (fewer pixels to fill). 27 Nov: real screen size again after every resize or browser zoom (a hidden setSize made laptops blurry)
fitR3();
R3.outputEncoding = T.sRGBEncoding; R3.toneMapping = T.NoToneMapping;
R3.shadowMap.enabled = !PH; R3.shadowMap.type = T.PCFSoftShadowMap;
root.prepend(R3.domElement);
const S3 = new T.Scene(), CAM = new T.PerspectiveCamera(camFov(), innerWidth / innerHeight, 0.5, 900);
addEventListener('resize', () => { fitR3(); CAM.aspect = innerWidth / innerHeight; CAM.fov = camFov(); CAM.updateProjectionMatrix(); });
const lin = h => new T.Color(h).convertSRGBToLinear();
// far view (Dev, 27 Nov: the old 165 m haze felt like a "gas chamber"). Squares out to VIEW are built in full;
// from VIEW out to FAR they are built as cheap outlines (big shapes only, corners snapped, one mesh per square).
const VIEW = PH ? 165 : 215;   // squares within this distance are built in full
const FAR = FARV ? (PH ? 380 : 560) : VIEW;    // far squares out to here (test link only for now)
S3.fog = FARV ? new T.Fog(0xb6d8ef, PH ? 140 : 190, FAR + 10) : new T.Fog(0xb6d8ef, PH ? 85 : 110, PH ? 165 : 205);
// one material for everything solid; vertex colours are stored as small sRGB bytes and made linear in the shader
const srgbColors = m => { m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb = pow(color.rgb, vec3(2.2));\n#endif'); }; return m; };
// moving water (Dev, 27 Nov: "soothing water movement"): small ripples drift with the flow (the river and the canal run to the sea, the sea rolls in, lakes and pools just breathe).
// Only the shine and shade move, in the water's own shader: a few sums per pixel, nothing extra to draw, so phones stay fast. Ripples fade out by 140 m.
const WT = { value: 0 }, WNIGHT = new T.Color(0.3, 0.19, 0.34);   // water clock; night tint (the same deep blue as before)
const RIPPLE = `{ vec3 nw = (vec4(normal, 0.0) * viewMatrix).xyz; float fd = (1.0 - smoothstep(45.0, 140.0, distance(vWP, cameraPosition))) * step(0.6, nw.y);
  if (fd > 0.0) { vec2 fl = vec2(0.0);
    if (vWP.x > 395.0 && vWP.x < 545.0) fl = vec2(0.0, -0.7); else if (abs(vWP.x) < 10.0 && vWP.z > -582.0 && vWP.z < -286.0) fl = vec2(0.0, -0.35); else if (vWP.z < -800.0) fl = vec2(0.0, 0.45);
    vec2 q = vWP.xz - fl * uWT; float a1 = dot(q, vec2(0.8, 0.6)) * 1.3 + uWT * 1.1, a2 = dot(q, vec2(-0.5, 0.86)) * 2.1 + uWT * 1.6, a3 = dot(q, vec2(0.2, -0.98)) * 3.4 - uWT * 2.0, a4 = dot(q, vec2(-0.9, -0.44)) * 5.0 + uWT * 2.6;
    vec2 gr = vec2(0.8, 0.6) * (0.65 * cos(a1)) + vec2(-0.5, 0.86) * (0.63 * cos(a2)) + vec2(0.2, -0.98) * (0.51 * cos(a3)) + vec2(-0.9, -0.44) * (0.3 * cos(a4));
    normal = normalize((viewMatrix * vec4(normalize(vec3(-gr.x * 0.08 * fd, 1.0, -gr.y * 0.08 * fd)), 0.0)).xyz);
    diffuseColor.rgb *= 1.0 + 0.09 * fd * (0.45 * sin(a1) + 0.3 * sin(a2) + 0.15 * sin(a3) + 0.1 * sin(a4)); } }`;
const waterMat = m => { m.onBeforeCompile = s => { s.uniforms.uWT = WT;
  s.vertexShader = 'varying vec3 vWP;\n' + s.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb = pow(color.rgb, vec3(2.2));\n#endif').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  s.fragmentShader = 'uniform float uWT;\nvarying vec3 vWP;\n' + s.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + RIPPLE); }; return m; };
const MAT = o => srgbColors(PH ? new T.MeshLambertMaterial(o) : new T.MeshStandardMaterial(Object.assign({ roughness: 0.86, metalness: 0, flatShading: true }, o)));
const MS = { [B_MAIN]: MAT({ vertexColors: true }), [B_MAIND]: MAT({ vertexColors: true, side: T.DoubleSide }),
  [B_GLASS]: new T.MeshBasicMaterial({ color: lin('#2c3644') }), glassLow: new T.MeshBasicMaterial({ color: lin('#3f5866') }), [B_WARM]: new T.MeshBasicMaterial({ color: lin('#e8b45e') }), [B_LAMP]: new T.MeshBasicMaterial({ color: lin('#f6d27a') }),
  [B_WATER]: waterMat(PH ? new T.MeshPhongMaterial({ vertexColors: true, specular: 0x5a5a5a, shininess: 46, transparent: true, opacity: 0.95 }) : new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.05, transparent: true, opacity: 0.95 })) };   // phones: the lighter shine (same look, less work per pixel)
textures.forEach((t, i) => { const tx = new T.Texture(t.image); tx.needsUpdate = true; tx.encoding = T.sRGBEncoding; tx.flipY = t.flipY; tx.wrapS = t.wrapS; tx.wrapT = t.wrapT; tx.repeat.copy(t.repeat); tx.offset.copy(t.offset); tx.anisotropy = 4;
  const side = t.ds ? T.DoubleSide : T.FrontSide, m = t.basic ? new T.MeshBasicMaterial({ map: tx, transparent: t.tr, opacity: t.op, side, vertexColors: true }) : MAT({ map: tx, vertexColors: true, transparent: t.tr, opacity: t.op, side });
  if (t.basic) srgbColors(m); if (t.tr) { m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; } MS[B_TEX + i] = m; });
const skyU = { top: { value: lin('#76a9dc') }, mid: { value: lin('#b3d6ee') }, bot: { value: lin('#f1f4ee') } };
const sky = new T.Mesh(new T.SphereGeometry(700, 32, 16), new T.ShaderMaterial({ uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying float h; void main(){ vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, h)) : mix(bot, mid, smoothstep(-0.05, 0.18, h)); gl_FragColor = vec4(c, 1.0);\n#include <encodings_fragment>\n}' }));
sky.renderOrder = -1; S3.add(sky);
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); }
const GT = glowTex();
const disc = new T.Sprite(new T.SpriteMaterial({ map: GT, color: 0xfff3d0, fog: false, depthWrite: false, transparent: true, blending: T.AdditiveBlending })); S3.add(disc);
const sp = []; for (let i = 0; i < 700; i++) { const u = Math.random() * Math.PI * 2, v = 0.12 + Math.random() * 0.88, r = 650; sp.push(Math.cos(u) * Math.sqrt(1 - v * v) * r, v * r, Math.sin(u) * Math.sqrt(1 - v * v) * r); }
const stG = new T.BufferGeometry(); stG.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
const stars = new T.Points(stG, new T.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false })); S3.add(stars);
const glowMat = new T.PointsMaterial({ map: GT, color: lin('#ffcc73'), size: 2.6, sizeAttenuation: true, transparent: true, opacity: 0.1, depthWrite: false, blending: T.AdditiveBlending, fog: false });
const hemi = new T.HemisphereLight(0xdcecff, 0x6f7a55, 0.64); S3.add(hemi);
const sun = new T.DirectionalLight(0xffffff, 1.4); S3.add(sun); S3.add(sun.target);
if (!PH) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; const s = sun.shadow.camera; s.left = -80; s.right = 80; s.top = 80; s.bottom = -80; s.near = 1; s.far = 420; }

// ---------- 4. building a square: everything in it merged, a few meshes per square ----------
const tiles = new Map(); let built = 0;
const LOWGLASS = 1.75;
const PA = new T.Vector3(), PB = new T.Vector3(), PC = new T.Vector3(), NA = new T.Vector3(), NB = new T.Vector3(), MM = new T.Matrix4();
// far squares leave out small details (pots, fence bits, small props): you cannot see them from there, and it halves the work.
// Windows and lamps always stay, so the night still glows.
const NEAR = PHONE ? 75 : 135, SMALL = 0.95, TINY = 0.5;
const keepFar = b => b === B_GLASS || b === B_WARM || b === B_LAMP || b === B_WATER || b >= B_TEX;
const LOCELL = 0.7;
const BIG = 1.6, FARCELL = 1.4, TINY2 = 1.6;   // far squares: only shapes this big (m), corners on a 1.4 m grid, no triangles smaller than 1.6 m
const L2C = { [B_GLASS]: [44, 54, 68], [B_WARM]: [232, 180, 94], [B_LAMP]: [246, 210, 122] };   // far squares use one material, so these get their colour baked in
function lowShape(S, cell = LOCELL, key = 'lo') {   // the same shape with its corners snapped to a grid (70 cm near, 1.4 m far): details melt away, the outline and colours stay
  if (S[key]) return S[key]; const P = S.P, keep = [], q = v => Math.round(v / cell) * cell;
  for (let t = 0; t < S.n; t += 3) { const a = [q(P[t * 3]), q(P[t * 3 + 1]), q(P[t * 3 + 2])], b = [q(P[t * 3 + 3]), q(P[t * 3 + 4]), q(P[t * 3 + 5])], c = [q(P[t * 3 + 6]), q(P[t * 3 + 7]), q(P[t * 3 + 8])];
    const same = (u, v) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2]; if (same(a, b) || same(b, c) || same(a, c)) continue;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-4) continue;
    keep.push(t, a, b, c); }
  const n = keep.length / 4 * 3, P2 = new Float32Array(n * 3), C2 = S.C ? new Uint8Array(n * 3) : null; const seen = new Set(); let o = 0;
  for (let i = 0; i < keep.length; i += 4) { const t = keep[i], key = [keep[i + 1], keep[i + 2], keep[i + 3]].map(v => v.join(',')).sort().join('|'); if (seen.has(key)) continue; seen.add(key);
    for (let j = 0; j < 3; j++) { P2.set(keep[i + 1 + j], (o + j) * 3); if (C2) C2.set(S.C.subarray((t + j) * 3, (t + j) * 3 + 3), (o + j) * 3); } o += 3; }
  return (S[key] = { P: P2.subarray(0, o * 3), C: C2 ? C2.subarray(0, o * 3) : null, U: null, n: o, r: S.r }); }
// what the ground is, metre by metre, in each square: 1 = grass (green), 2 = anything else (sand, paving, plaza, water). Nature only grows on 1.
const ground = new Map();
const floors = new Map(), FNO = -32768, GND = 0.22, FM = 16, FW = TILE + 2 * FM;   // 27 Nov: per square, per 1 m: [highest floor up to 3.5 m, highest floor up to 0.6 m, water surface] in cm, so people walk ON bridges and piers (GND = normal ground)
function rasterFloor(F, ox, oz, ax, ay, az, bx, by, bz, cx, cy, cz, water) {
  if (Math.min(ay, by, cy) > 3.5) return; const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az, den = ux * vz - uz * vx;
  if (Math.abs(den) < 1e-6 || Math.abs(den) / Math.hypot(uy * vz - uz * vy, den, ux * vy - uy * vx) < 0.8) return;   // only floors: walls and steep slopes don't count
  const i0 = Math.max(-FM, Math.floor(Math.min(ax, bx, cx) - ox)), i1 = Math.min(TILE + FM - 1, Math.floor(Math.max(ax, bx, cx) - ox)), j0 = Math.max(-FM, Math.floor(Math.min(az, bz, cz) - oz)), j1 = Math.min(TILE + FM - 1, Math.floor(Math.max(az, bz, cz) - oz));   // 16 m past the square's edge: a bridge owned by the next square still counts here
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const px = ox + i + 0.5 - ax, pz = oz + j + 0.5 - az, s1 = (px * vz - pz * vx) / den, s2 = (ux * pz - uz * px) / den; if (s1 < -0.01 || s2 < -0.01 || s1 + s2 > 1.01) continue;
    const y = ay + s1 * uy + s2 * vy; if (y > 3.5) continue; const h = Math.round(y * 100), c = ((j + FM) * FW + i + FM) * 3;
    if (water) { if (y <= 0.7 && h > F[c + 2]) F[c + 2] = h; } else { if (h > F[c]) F[c] = h; if (y <= 0.6 && h > F[c + 1]) F[c + 1] = h; } } }
function rasterGround(Gr, Hy, ox, oz, ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b, wet) {
  if (Math.max(ay, by, cy) > 0.7) return; const ux = bx - ax, uz = bz - az, vx = cx - ax, vz = cz - az, den = ux * vz - uz * vx; if (Math.abs(den) < 1e-6) return;
  const ny = ((by - ay) * vz - (bz - az) * (cy - ay)); // only roughly flat faces matter; steep ones are walls
  if (Math.abs((by - ay)) > 0.3 || Math.abs(cy - ay) > 0.3) return;
  const grassy = wet ? 3 : g > r * 1.04 && g > b * 1.15 ? 1 : 2, y = (ay + by + cy) / 3;   // 3 = water: you can't walk on it (Dev, 27 Nov)
  const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - ox)), i1 = Math.min(TILE - 1, Math.floor(Math.max(ax, bx, cx) - ox)), j0 = Math.max(0, Math.floor(Math.min(az, bz, cz) - oz)), j1 = Math.min(TILE - 1, Math.floor(Math.max(az, bz, cz) - oz));
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const px = ox + i + 0.5 - ax, pz = oz + j + 0.5 - az, s1 = (px * vz - pz * vx) / den, s2 = (ux * pz - uz * px) / den; if (s1 < -0.01 || s2 < -0.01 || s1 + s2 > 1.01) continue;
    const c = j * TILE + i; if (y >= Hy[c]) { Hy[c] = y; Gr[c] = grassy; } } }
const onRoadW = (x, z) => ROADS.some(([w, d, rx, rz]) => Math.abs(x - rx) <= w / 2 + 0.6 && Math.abs(z - rz) <= d / 2 + 0.6);   // a road over water is a bridge
const FLV = [0, 0, 0];
const fget = (x, z) => { const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE), lx = x - tx * TILE, lz = z - tz * TILE; let any = false; FLV[0] = FLV[1] = FLV[2] = FNO;   // floors here, from this square and any next square whose edge strip covers it
  for (let dx = lx < FM ? -1 : 0; dx <= (lx >= TILE - FM ? 1 : 0); dx++) for (let dz = lz < FM ? -1 : 0; dz <= (lz >= TILE - FM ? 1 : 0); dz++) { const F = floors.get(kOf(tx + dx, tz + dz)); if (!F) continue; any = true;
    const c = ((Math.floor(lz - dz * TILE) + FM) * FW + Math.floor(lx - dx * TILE) + FM) * 3; if (F[c] > FLV[0]) FLV[0] = F[c]; if (F[c + 1] > FLV[1]) FLV[1] = F[c + 1]; if (F[c + 2] > FLV[2]) FLV[2] = F[c + 2]; }
  return any ? FLV : null; };
const decked = (x, z) => { const f = fget(x, z); return !!f && f[0] > f[2] + 20; };   // a bridge or pier deck above the water: you can walk there
const floor1 = (x, z, foot) => { const f = fget(x, z); if (!f) return GND; return f[0] !== FNO && f[0] <= (foot + 0.6) * 100 ? f[0] / 100 : f[1] !== FNO ? f[1] / 100 : GND; };   // the floor you can step onto here (up to 0.6 m up)
const floorAt = (x, z, foot) => { const a = [floor1(x, z, foot), floor1(x + 1, z, foot), floor1(x - 1, z, foot), floor1(x, z + 1, foot), floor1(x, z - 1, foot)].sort((p, q) => p - q); return a[2]; };   // the middle of 5 cells: a bench or railing next to you doesn't lift or drop you, ramps still do
const wetAt = (x, z) => { const k = tkey(x, z), Gr = ground.get(k); return !!Gr && Gr[Math.floor(z - kZ(k) * TILE) * TILE + Math.floor(x - kX(k) * TILE)] === 3 && !onRoadW(x, z) && !decked(x, z); };
function buildTile(k, lod) {
  const ox = kX(k) * TILE, oz = kZ(k) * TILE;
  const all = tilePlaces.get(k) || [], pieces = chunks.get(k) || [];
  const L2 = lod === 2, bk = b => L2 ? B_MAIND : b;
  const list = L2 ? all.filter(i => { if (PL.b[i] >= B_TEX) return false; const q = i * 12, m = PL.m, sc = Math.sqrt(m[q] ** 2 + m[q + 1] ** 2 + m[q + 2] ** 2); return shapes[PL.s[i]].r * sc >= BIG; })
    : lod ? all.filter(i => { const q = i * 12, m = PL.m, sc = Math.sqrt(m[q] ** 2 + m[q + 1] ** 2 + m[q + 2] ** 2); return keepFar(PL.b[i]) || shapes[PL.s[i]].r * sc >= SMALL; }) : all;
  const tiny = (P, t, lim = TINY) => { let e = 0; for (let j = 0; j < 3; j++) { const a = t * 3 + j * 3, b = t * 3 + ((j + 1) % 3) * 3; e = Math.max(e, Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2])); } return e < lim; };
  // count vertices per bucket
  const cnt = {}; const add = (b, n) => cnt[b] = (cnt[b] || 0) + n;
  const shapeFor = i => { const S = shapes[PL.s[i]]; return L2 ? (S.n > 12 ? lowShape(S, FARCELL, 'lo2') : S) : lod && !keepFar(PL.b[i]) && S.n > 24 ? lowShape(S) : S; };
  for (const i of list) add(bk(PL.b[i]), shapeFor(i).n);
  for (const p of pieces) { if (L2) { if (p.b >= B_TEX) continue; let n = 0; for (let t = 0; t < p.P.length / 3; t += 3) if (!tiny(p.P, t, TINY2)) n += 3; add(B_MAIND, n); continue; }
    if (!lod || keepFar(p.b)) { add(p.b, p.P.length / 3); continue; } let n = 0; for (let t = 0; t < p.P.length / 3; t += 3) if (!tiny(p.P, t)) n += 3; add(p.b, n); }
  const out = {};
  for (const b in cnt) out[b] = { P: new Int16Array(cnt[b] * 3), N: new Int8Array(cnt[b] * 3), C: new Uint8Array(cnt[b] * 3), U: +b >= B_TEX ? new Float32Array(cnt[b] * 2) : null, o: 0, far: [] };
  const glow = new Map(), addGlow = (x, y, z) => { const g = Math.round(x / 1.1) + ',' + Math.round(y / 1.1) + ',' + Math.round(z / 1.1); if (!glow.has(g)) glow.set(g, [x, y, z]); };
  const put = (b, ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1, r2, g2, b2, r3, g3, b3, u) => { const O = out[b]; const lx = [ax - ox, bx - ox, cx - ox], ly = [ay, by, cy], lz = [az - oz, bz - oz, cz - oz];
    if (lx.some(v => Math.abs(v) > 320) || lz.some(v => Math.abs(v) > 320) || ly.some(v => Math.abs(v) > 320)) { if (!L2) O.far.push([ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1]); return; }
    PA.set(bx - ax, by - ay, bz - az); PB.set(cx - ax, cy - ay, cz - az); NA.crossVectors(PA, PB).normalize();
    const n0 = Math.round(NA.x * 127), n1 = Math.round(NA.y * 127), n2 = Math.round(NA.z * 127), o = O.o;
    for (let j = 0; j < 3; j++) { const d = (o + j) * 3; O.P[d] = Math.round(lx[j] * 100); O.P[d + 1] = Math.round(ly[j] * 100); O.P[d + 2] = Math.round(lz[j] * 100); O.N[d] = n0; O.N[d + 1] = n1; O.N[d + 2] = n2; }
    O.C[o * 3] = r1; O.C[o * 3 + 1] = g1; O.C[o * 3 + 2] = b1; O.C[o * 3 + 3] = r2; O.C[o * 3 + 4] = g2; O.C[o * 3 + 5] = b2; O.C[o * 3 + 6] = r3; O.C[o * 3 + 7] = g3; O.C[o * 3 + 8] = b3;
    if (u && O.U) O.U.set(u, o * 2); O.o += 3;
    if ((b === B_GLASS || b === B_WARM) && (ay + by + cy) / 3 >= LOWGLASS || b === B_LAMP) addGlow((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3); };
  const UV = new Float32Array(6);
  const Gr = new Uint8Array(TILE * TILE), Hy = new Float32Array(TILE * TILE).fill(-9), F = L2 ? null : new Int16Array(FW * FW * 3).fill(FNO);
  if (!L2) for (const p of huge) { if (p.b === B_GLASS || p.b === B_WARM || p.b === B_LAMP) continue; const P = p.P; for (let t = 0; t < P.length / 3; t += 3) rasterFloor(F, ox, oz, P[t * 3], P[t * 3 + 1], P[t * 3 + 2], P[t * 3 + 3], P[t * 3 + 4], P[t * 3 + 5], P[t * 3 + 6], P[t * 3 + 7], P[t * 3 + 8], p.b === B_WATER); }
  if (!L2) for (const p of huge) { if (p.b >= B_TEX) continue; const P = p.P, C = p.C; for (let t = 0; t < P.length / 3; t += 3) rasterGround(Gr, Hy, ox, oz, P[t * 3], P[t * 3 + 1], P[t * 3 + 2], P[t * 3 + 3], P[t * 3 + 4], P[t * 3 + 5], P[t * 3 + 6], P[t * 3 + 7], P[t * 3 + 8], C[t * 3], C[t * 3 + 1], C[t * 3 + 2], p.b === B_WATER); }
  const put0 = put; const putG = (b, ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1, ...rest) => { if (b !== B_GLASS && b !== B_WARM && b !== B_LAMP) rasterFloor(F, ox, oz, ax, ay, az, bx, by, bz, cx, cy, cz, b === B_WATER); if (b === B_MAIN || b === B_MAIND || b === B_WATER) rasterGround(Gr, Hy, ox, oz, ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1, b === B_WATER); put0(b, ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1, ...rest); };
  for (const i of list) { const sid = PL.s[i], b = PL.b[i], rgb = PL.c[i], S = shapeFor(i), q = i * 12, m = PL.m; MM.set(m[q], m[q + 3], m[q + 6], m[q + 9], m[q + 1], m[q + 4], m[q + 7], m[q + 10], m[q + 2], m[q + 5], m[q + 8], m[q + 11], 0, 0, 0, 1); const flip = MM.determinant() < 0, e = MM.elements;
    const lc = L2 && L2C[b], R = lc ? lc[0] : rgb >> 16 & 255, G = lc ? lc[1] : rgb >> 8 & 255, Bc = lc ? lc[2] : rgb & 255, putP = L2 ? put0 : putG, bb = bk(b);
    for (let t = 0; t < S.n; t += 3) { const ia = t, ib = flip ? t + 2 : t + 1, ic = flip ? t + 1 : t + 2, P = S.P;
      const tr = (q, v) => { const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2]; v.set(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]); };
      tr(ia, PA); tr(ib, PB); tr(ic, PC); const ax = PA.x, ay = PA.y, az = PA.z, bx = PB.x, by = PB.y, bz = PB.z, cx = PC.x, cy = PC.y, cz = PC.z;
      const cc = (q, ch, base) => S.C ? Math.round(S.C[q * 3 + ch] * base / 255) : base;
      if (S.U) { UV[0] = S.U[ia * 2]; UV[1] = S.U[ia * 2 + 1]; UV[2] = S.U[ib * 2]; UV[3] = S.U[ib * 2 + 1]; UV[4] = S.U[ic * 2]; UV[5] = S.U[ic * 2 + 1]; }
      putP(bb, ax, ay, az, bx, by, bz, cx, cy, cz, cc(ia, 0, R), cc(ia, 1, G), cc(ia, 2, Bc), cc(ib, 0, R), cc(ib, 1, G), cc(ib, 2, Bc), cc(ic, 0, R), cc(ic, 1, G), cc(ic, 2, Bc), S.U ? UV : null); } }
  for (const p of pieces) { if (L2 && p.b >= B_TEX) continue; const P = p.P, C = L2 && L2C[p.b] ? new Uint8Array(P.length).map((_, i) => L2C[p.b][i % 3]) : p.C, skipTiny = lod && !keepFar(p.b);
    for (let t = 0; t < P.length / 3; t += 3) { if (L2 ? tiny(P, t, TINY2) : skipTiny && tiny(P, t)) continue; if (p.U && !L2) UV.set(p.U.subarray(t * 2, t * 2 + 6));
    (L2 ? put0 : putG)(bk(p.b), P[t * 3], P[t * 3 + 1], P[t * 3 + 2], P[t * 3 + 3], P[t * 3 + 4], P[t * 3 + 5], P[t * 3 + 6], P[t * 3 + 7], P[t * 3 + 8], C[t * 3], C[t * 3 + 1], C[t * 3 + 2], C[t * 3 + 3], C[t * 3 + 4], C[t * 3 + 5], C[t * 3 + 6], C[t * 3 + 7], C[t * 3 + 8], p.U && !L2 ? UV : null); } }
  const grp = new T.Group(); grp.position.set(ox, 0, oz); grp.scale.setScalar(0.01);
  for (const b in out) { const O = out[b]; if (!O.o) continue; const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(O.P.subarray(0, O.o * 3), 3)); g.setAttribute('normal', new T.BufferAttribute(O.N.subarray(0, O.o * 3), 3, true)); g.setAttribute('color', new T.BufferAttribute(O.C.subarray(0, O.o * 3), 3, true));
    if (O.U) g.setAttribute('uv', new T.BufferAttribute(O.U.subarray(0, O.o * 2), 2));
    g.computeBoundingSphere();
    if (+b === B_GLASS || +b === B_WARM) {   // glass low to the ground (car windscreens, things people hold) stays dark at night
      const lo = new Uint8Array(O.o / 3); let nlo = 0; for (let t = 0; t < O.o; t += 3) if ((O.P[t * 3 + 1] + O.P[t * 3 + 4] + O.P[t * 3 + 7]) / 300 < LOWGLASS) { lo[t / 3] = 1; nlo++; }
      if (nlo) { const split = (want) => { const n = (want ? nlo : O.o / 3 - nlo) * 3, P2 = new Int16Array(n * 3), N2 = new Int8Array(n * 3), C2 = new Uint8Array(n * 3); let q = 0;
          for (let t = 0; t < O.o / 3; t++) if (!!lo[t] === want) { P2.set(O.P.subarray(t * 9, t * 9 + 9), q * 9); N2.set(O.N.subarray(t * 9, t * 9 + 9), q * 9); C2.set(O.C.subarray(t * 9, t * 9 + 9), q * 9); q++; }
          const g2 = new T.BufferGeometry(); g2.setAttribute('position', new T.BufferAttribute(P2, 3)); g2.setAttribute('normal', new T.BufferAttribute(N2, 3, true)); g2.setAttribute('color', new T.BufferAttribute(C2, 3, true)); g2.computeBoundingSphere(); return g2; };
        grp.add(new T.Mesh(split(true), MS.glassLow)); if (O.o / 3 - nlo > 0) grp.add(new T.Mesh(split(false), MS[b])); continue; } }
    const mesh = new T.Mesh(g, MS[b]); mesh.castShadow = !L2 && (+b === B_MAIN || +b === B_MAIND); mesh.receiveShadow = !L2 && +b !== B_GLASS && +b !== B_WARM && +b !== B_LAMP; grp.add(mesh);
    if (O.far.length) { const F = new Float32Array(O.far.length * 9), FC = new Uint8Array(O.far.length * 9); O.far.forEach((f, q) => { F.set(f.slice(0, 9), q * 9); for (let j = 0; j < 3; j++) { FC[q * 9 + j * 3] = f[9]; FC[q * 9 + j * 3 + 1] = f[10]; FC[q * 9 + j * 3 + 2] = f[11]; } });
      const gf = new T.BufferGeometry(); gf.setAttribute('position', new T.BufferAttribute(F, 3)); gf.setAttribute('color', new T.BufferAttribute(FC, 3, true)); gf.computeVertexNormals(); const mf = new T.Mesh(gf, MS[b]); mf.receiveShadow = true; mf.userData.world = true; S3.add(mf); (tilesExtra.get(k) || tilesExtra.set(k, []).get(k)).push(mf); } }
  if (glow.size) { const gp = []; for (const [x, y, z] of glow.values()) gp.push((x - ox) * 100, y * 100, (z - oz) * 100); const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(gp, 3)); gg.computeBoundingSphere(); const pts = new T.Points(gg, glowMat); grp.add(pts); }
  grp.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); grp.updateMatrixWorld(true);
  if (!L2) { ground.set(k, Gr); floors.set(k, F); } else floors.delete(k);
  grp.userData.lod = lod; S3.add(grp); tiles.set(k, grp); built++;
}
const tilesExtra = new Map();
// nature is small, so it is only built close to you (the haze hides it further away)
const NVIEW = PHONE ? 95 : 140, natTiles = new Map();
function buildNature(k) { if (!ground.has(k)) return; const ox = kX(k) * TILE, oz = kZ(k) * TILE, tris = []; if (CZ.nature) CZ.nature(k, ox, oz, (...a) => tris.push(a)); if (!tris.length) { natTiles.set(k, null); return; }
  const n = tris.length * 3, P = new Int16Array(n * 3), N = new Int8Array(n * 3), C = new Uint8Array(n * 3);
  tris.forEach((a, t) => { PA.set(a[4] - a[1], a[5] - a[2], a[6] - a[3]); PB.set(a[7] - a[1], a[8] - a[2], a[9] - a[3]); NA.crossVectors(PA, PB).normalize();
    for (let j = 0; j < 3; j++) { const d = (t * 3 + j) * 3; P[d] = Math.round((a[1 + j * 3] - ox) * 100); P[d + 1] = Math.round(a[2 + j * 3] * 100); P[d + 2] = Math.round((a[3 + j * 3] - oz) * 100); N[d] = NA.x * 127; N[d + 1] = NA.y * 127; N[d + 2] = NA.z * 127; C[d] = a[10]; C[d + 1] = a[11]; C[d + 2] = a[12]; } });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3, true)); g.setAttribute('color', new T.BufferAttribute(C, 3, true)); g.computeBoundingSphere();
  const m = new T.Mesh(g, MS[B_MAIN]); m.position.set(ox, 0, oz); m.scale.setScalar(0.01); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); S3.add(m); natTiles.set(k, m); }
function streamNature(px, pz, all) { let n = 0; const r = Math.ceil(NVIEW / TILE) + 1, cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE), need = new Set();
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const x0 = (cx + i) * TILE, z0 = (cz + j) * TILE, d = Math.hypot(Math.max(x0 - px, 0, px - x0 - TILE), Math.max(z0 - pz, 0, pz - z0 - TILE)); if (d > NVIEW) continue; const k = kOf(cx + i, cz + j); need.add(k); if (!natTiles.has(k) && (all || n++ < 1)) buildNature(k); }
  for (const [k, m] of natTiles) { if (need.has(k)) continue; const d = Math.hypot(Math.max(kX(k) * TILE - px, 0, px - kX(k) * TILE - TILE), Math.max(kZ(k) * TILE - pz, 0, pz - kZ(k) * TILE - TILE)); if (d > NVIEW + 90) { if (m) { S3.remove(m); m.geometry.dispose(); } natTiles.delete(k); } } }
function dropTile(k) { ground.delete(k); floors.delete(k); const g = tiles.get(k); if (!g) return; S3.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); tiles.delete(k); (tilesExtra.get(k) || []).forEach(m => { S3.remove(m); m.geometry.dispose(); }); tilesExtra.delete(k); }
// giant triangles (the ground under everything, the sea): one mesh each, always drawn
huge.forEach(p => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p.P, 3)); g.setAttribute('color', new T.BufferAttribute(p.C, 3, true)); if (p.U) g.setAttribute('uv', new T.BufferAttribute(p.U, 2)); g.computeVertexNormals(); const m = new T.Mesh(g, MS[p.b] || MS[B_MAIN]); m.receiveShadow = true; S3.add(m); });
function wanted(px, pz) { const out = []; const r = Math.ceil(FAR / TILE) + 1, cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE);
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const x0 = (cx + i) * TILE, z0 = (cz + j) * TILE, dx = Math.max(x0 - px, 0, px - x0 - TILE), dz = Math.max(z0 - pz, 0, pz - z0 - TILE), d = Math.hypot(dx, dz); if (d < FAR) out.push([kOf(cx + i, cz + j), d]); }
  return out.sort((a, b) => a[1] - b[1]); }
let streamN = 0;
function stream(px, pz, all) { const w = wanted(px, pz), need = new Set(w.map(a => a[0])); let n = 0; streamN++;
  for (const [k, d] of w) { const want = d < NEAR ? 0 : d < VIEW ? 1 : 2, have = tiles.get(k);
    if (have === null || (have && have.userData.lod === want)) continue; if (!have && !tilePlaces.has(k) && !chunks.has(k)) { if (want === 2) continue; tiles.set(k, null); if (!ground.has(k)) { const ox = kX(k) * TILE, oz = kZ(k) * TILE, Gr = new Uint8Array(TILE * TILE), Hy = new Float32Array(TILE * TILE).fill(-9); for (const p of huge) { if (p.b >= B_TEX) continue; const P = p.P, C = p.C; for (let t = 0; t < P.length / 3; t += 3) rasterGround(Gr, Hy, ox, oz, P[t * 3], P[t * 3 + 1], P[t * 3 + 2], P[t * 3 + 3], P[t * 3 + 4], P[t * 3 + 5], P[t * 3 + 6], P[t * 3 + 7], P[t * 3 + 8], C[t * 3], C[t * 3 + 1], C[t * 3 + 2], p.b === B_WATER); } ground.set(k, Gr); } continue; }
    if (all && want === 2) continue;   // far squares come in one per frame after the start, so loading is not slower
    if (want === 2 && streamN % 3) break;   // and at most one every 3 frames, so walking doesn't stutter (everything nearer is already done: the list is nearest first)
    if (have) dropTile(k); buildTile(k, want); if (!all && ++n >= 1) break; }
  for (const k of [...tiles.keys()]) { const g = tiles.get(k); if (FARV && g) g.visible = need.has(k);   // squares past the haze stay ready but are not drawn
    if (need.has(k)) continue; const kx = kX(k), kz = kZ(k); const dx = Math.max(kx * TILE - px, 0, px - kx * TILE - TILE), dz = Math.max(kz * TILE - pz, 0, pz - kz * TILE - TILE); if (Math.hypot(dx, dz) > FAR + 140) { if (tiles.get(k)) dropTile(k); else tiles.delete(k); } } }

// ---------- 4b. nature on free land (Dev, 27 Nov) ----------
// Small things (flowers, grass tufts, bushes, rocks, lighter grass patches) on free grass, never on a road, a plaza, a garden
// or a home. Big trees only where no home can ever go (not on any plot, present or future), away from roads.
// It is made fresh from the live map every time, so when a new citizen gets a plot, the nature there makes way.
{
  const hash = (cell, list, pad) => { const H = new Map(); list.forEach(it => { const [x0, z0, x1, z1] = it; for (let i = Math.floor((x0 - pad) / cell); i <= Math.floor((x1 + pad) / cell); i++) for (let j = Math.floor((z0 - pad) / cell); j <= Math.floor((z1 + pad) / cell); j++) { const k = i * 100003 + j; (H.get(k) || H.set(k, []).get(k)).push(it); } }); return (x, z) => H.get(Math.floor(x / cell) * 100003 + Math.floor(z / cell)) || []; };
  const inBox = (list, x, z, pad) => list.some(([x0, z0, x1, z1]) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad);
  const roadBoxes = ROADS.map(([w, d, x, z]) => [x - w / 2, z - d / 2, x + w / 2, z + d / 2]), roadsAt = hash(16, roadBoxes, 6);
  const MD = window.VIN_MAPDATA || {}, paved = [...(MD.flat || []).filter(f => f[0] !== 'g').map(f => [f[1], f[2], f[1] + f[3], f[2] + f[4]]), ...(MD.places || []).filter(p => p[0]).map(p => [p[1], p[2], p[1] + p[3], p[2] + p[4]]), ...(MD.slots || []).map(([x, z]) => [x - 7, z - 7, x + 7, z + 7])], pavedAt = hash(16, paved, 2);
  const homeBoxes = homes.filter(h => h.status !== 'abandoned').map(h => [h.x - 6, h.z - 6, h.x + 6, h.z + 6]), homesAt = hash(16, homeBoxes, 1);
  const plotBoxes = (typeof PLOTS !== 'undefined' ? PLOTS : []).map(p => [p[0] - 7, p[1] - 7, p[0] + 7, p[1] + 7]), plotsAt = hash(16, plotBoxes, 1);
  const greenAt = (x, z) => { const k = tkey(x, z), Gr = ground.get(k); if (!Gr) return false; const i = Math.floor(x - kX(k) * TILE), j = Math.floor(z - kZ(k) * TILE); return Gr[j * TILE + i] < 2; };   // 0 = only the textured grass sheet underneath: grass
  CZ.greenAt = greenAt; CZ._hugeDbg = () => JSON.stringify(huge.map(p => { let mx = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9]; for (let i = 0; i < p.P.length; i += 3) { mx[0] = Math.min(mx[0], p.P[i]); mx[1] = Math.max(mx[1], p.P[i]); mx[2] = Math.min(mx[2], p.P[i + 1]); mx[3] = Math.max(mx[3], p.P[i + 1]); mx[4] = Math.min(mx[4], p.P[i + 2]); mx[5] = Math.max(mx[5], p.P[i + 2]); } return [p.b, p.P.length / 9, Array.from(p.C.slice(0, 3)), mx.map(Math.round)]; }).filter(h => h[3][2] > 0.1 || h[2][0] > 240)); CZ.pieceDbg = (x, z) => JSON.stringify((chunks.get(tkey(x, z)) || []).map(p => [p.b, p.P.length / 9, Array.from(p.C.slice(0, 9)), Array.from(p.P.slice(0, 3)).map(v => +v.toFixed(2))]).slice(0, 12)); CZ.groundStats = (x, z) => { const Gr = ground.get(tkey(x, z)); if (!Gr) return 'no ground'; let a = 0, b = 0, c = 0; Gr.forEach(v => v === 1 ? a++ : v === 2 ? b++ : c++); return { green: a, other: b, none: c }; };
  const okSmall = (x, z) => greenAt(x, z) && freeAt(x, z) && !inBox(roadsAt(x, z), x, z, 1.6) && !inBox(pavedAt(x, z), x, z, 0.5) && !inBox(homesAt(x, z), x, z, 0.5);
  const okTree = (x, z) => okSmall(x, z) && !inBox(roadsAt(x, z), x, z, 4.5) && !inBox(plotsAt(x, z), x, z, 2.5) && freeAt(x + 1.5, z) && freeAt(x - 1.5, z) && freeAt(x, z + 1.5) && freeAt(x, z - 1.5);
  // little shapes, built in code (the style guide's recipes): lists of [9 numbers, colour]
  const tri = (out, a, b, c, col) => out.push([a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col]);
  const box = (out, w, h, d, x, y, z, col) => { const X = [x - w / 2, x + w / 2], Y = [y, y + h], Zs = [z - d / 2, z + d / 2], v = (i, j, k) => [X[i], Y[j], Zs[k]];
    const f = (a, b, c, d2) => { tri(out, a, b, c, col); tri(out, a, c, d2, col); };
    f(v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)); f(v(1, 0, 0), v(0, 0, 0), v(0, 1, 0), v(1, 1, 0)); f(v(0, 1, 1), v(1, 1, 1), v(1, 1, 0), v(0, 1, 0)); f(v(1, 0, 1), v(1, 0, 0), v(1, 1, 0), v(1, 1, 1)); f(v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)); };
  const ICO = (() => { const g = new T.IcosahedronGeometry(1, 0), p = g.attributes.position, out = []; for (let i = 0; i < p.count; i += 3) out.push([p.getX(i), p.getY(i), p.getZ(i), p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1), p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)]); return out; })();
  const ball = (out, r, sy, x, y, z, col, jit) => ICO.forEach(t => { const q = t.slice(); for (let j = 0; j < 9; j += 3) { const w = jit ? 1 + (Math.sin(q[j] * 12.9 + q[j + 2] * 7.1) * jit) : 1; q[j] = q[j] * r * w + x; q[j + 1] = q[j + 1] * r * sy * w + y; q[j + 2] = q[j + 2] * r * w + z; } out.push([...q, col]); });
  const cone = (out, r, h, x, y, z, sides, col) => { for (let i = 0; i < sides; i++) { const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2; tri(out, [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x, y + h, z], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], col); tri(out, [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x, y, z], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], col); } };
  const cyl = (out, r, h, x, y, z, sides, col) => { for (let i = 0; i < sides; i++) { const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2, A = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], Bv = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], A2 = [A[0], y + h, A[2]], B2 = [Bv[0], y + h, Bv[2]]; tri(out, A, A2, B2, col); tri(out, A, B2, Bv, col); } };
  const disc = (out, r, x, y, z, col) => { for (let i = 0; i < 9; i++) { const a0 = i / 9 * Math.PI * 2, a1 = (i + 1) / 9 * Math.PI * 2; tri(out, [x, y, z], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], col); } };
  const FLOWER = [0xffd24a, 0xff7fa8, 0xffffff, 0xb48cff, 0xff9a4d];
  const S = {
    flowers: c => { const o = []; for (let i = 0; i < 5; i++) { const a = i * 1.26, r = 0.25 + (i % 2) * 0.2; cone(o, 0.04, 0.2, Math.cos(a) * r, 0, Math.sin(a) * r, 3, 0x4f8a3a); box(o, 0.15, 0.12, 0.15, Math.cos(a) * r, 0.18, Math.sin(a) * r, FLOWER[(c + i) % 5]); } return o; },
    tuft: () => { const o = []; [[0, 0], [0.18, 0.1], [-0.15, 0.12]].forEach(([x, z], i) => cone(o, 0.09, 0.34 + i * 0.06, x, 0, z, 4, i ? 0x6fae48 : 0x5f9e3e)); return o; },
    bush: () => { const o = []; ball(o, 0.7, 0.75, 0, 0.45, 0, 0x4f9a46, 0.06); ball(o, 0.45, 0.8, 0.5, 0.35, 0.2, 0x5fa848, 0.06); return o; },
    rock: () => { const o = []; ball(o, 0.45, 0.6, 0, 0.15, 0, 0xa19c94, 0.12); return o; },
    patch: c => { const o = []; disc(o, 1.4 + c * 0.2, 0, 0.035 + c * 0.012, 0, c % 2 ? 0x93c45d : 0x86b850); return o; },
    roundTree: () => { const o = []; cyl(o, 0.22, 1.7, 0, 0, 0, 6, 0x6b4a32); ball(o, 1.5, 0.85, 0, 2.6, 0, 0x5fa848, 0.07); ball(o, 0.9, 0.85, 0.9, 2.4, 0.5, 0x70b852, 0.07); return o; },
    fruitTree: () => { const o = []; cyl(o, 0.2, 1.5, 0, 0, 0, 6, 0x6b4a32); ball(o, 1.35, 0.85, 0, 2.35, 0, 0x5c9a44, 0.07); for (let i = 0; i < 7; i++) { const a = i * 0.9; box(o, 0.16, 0.16, 0.16, Math.cos(a) * 1.15, 2.1 + (i % 3) * 0.35, Math.sin(a) * 1.15, 0xe0402e); } return o; },
    pine: () => { const o = []; cyl(o, 0.2, 1.1, 0, 0, 0, 6, 0x6b4a32); [0x2f6b4f, 0x357656, 0x3d815e, 0x448a64].forEach((c, i) => cone(o, 1.45 - i * 0.3, 1.5, 0, 0.9 + i * 0.85, 0, 7, c)); return o; } };
  const shapesN = { flowers: [0, 1, 2, 3, 4].map(S.flowers), tuft: [S.tuft()], bush: [S.bush()], rock: [S.rock()], patch: [0, 1, 2, 3].map(S.patch), roundTree: [S.roundTree()], fruitTree: [S.fruitTree()], pine: [S.pine()] };
  const emit = (put, list, x, z, rot, s) => { const c = Math.cos(rot), sn = Math.sin(rot);
    for (const t of list) { const r = t[9] >> 16 & 255, g = t[9] >> 8 & 255, b = t[9] & 255, P = [];
      for (let j = 0; j < 9; j += 3) { const lx = t[j] * s, ly = t[j + 1] * s, lz = t[j + 2] * s; P.push(x + lx * c + lz * sn, ly, z - lx * sn + lz * c); }
      put(B_MAIN, P[0], P[1], P[2], P[3], P[4], P[5], P[6], P[7], P[8], r, g, b, r, g, b, r, g, b, null); } };
  // Where nature belongs (Dev, 27 Nov: random scatter on lawns looked post-apocalyptic):
  //  - parks and open countryside (no plot within 22 m): groves = a few trees together, bushes at their feet, wildflowers beside them
  //  - lawns in town: kept clean, with now and then one neat round flower bed
  const parkRects = (MD.flat || []).filter(f => f[0] === 'g').map(f => [f[1], f[2], f[1] + f[3], f[2] + f[4]]), parksAt = hash(32, parkRects, 0);
  const inPark = (x, z) => inBox(parksAt(x, z), x, z, -1);
  const CIVIC = /^(School|Library|Hospital|Mall|Parliament|Embassy|Central Bank|Police HQ|Fire Station|Transport Hub|Beach Resort|Vinland National Stadium)$/;
  const bigRects = (MD.places || []).filter(p => CIVIC.test(p[0])).map(p => [p[1], p[2], p[1] + p[3], p[2] + p[4]]), bigAt = hash(32, bigRects, 32);
  const wild = (x, z) => !inBox(plotsAt(x, z), x, z, 15) && !inBox(homesAt(x, z), x, z, 15);
  const kept = (x, z) => FARV && inBox(bigAt(x, z), x, z, 30);   // test link: land around the big civic buildings is a kept lawn, no wild groves
  CZ.groves = new Map();   // grove centres per square: where butterflies and fireflies gather
  const CELL = 15;
  CZ.nature = (k, ox, oz, put) => { let sd = (k * 2654435761) >>> 0 || 1; const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296; const groves = [];
    const tryPut = (kind, x, z, s, rot, tree) => { if (tree ? !okTree(x, z) : !okSmall(x, z)) return false; const set = shapesN[kind]; emit(put, set[Math.floor(rnd() * set.length)], x, z, rot == null ? rnd() * 6.283 : rot, s); return true; };
    for (let x = ox; x < ox + TILE; x += CELL) for (let z = oz; z < oz + TILE; z += CELL) {
      const cx = x + 2 + rnd() * (CELL - 4), cz = z + 2 + rnd() * (CELL - 4), roll = rnd();
      if (Math.abs(cx) > 7800 || cz < COAST.shore + 14 || !greenAt(cx, cz)) continue;
      const town = kept(cx, cz), park = !town && inPark(cx, cz), open = !town && !park && wild(cx, cz);
      if (park || open) {
        if (roll > (park ? 0.78 : 0.5)) continue;
        let trees = 0; const nT = 1 + Math.floor(rnd() * 3);
        for (let t = 0; t < nT; t++) { const a = rnd() * 6.283, r = t ? 3 + rnd() * 3 : 0, tx = cx + Math.cos(a) * r, tz = cz + Math.sin(a) * r, kind = rnd() < (open ? 0.5 : 0.3) ? 'pine' : rnd() < 0.85 ? 'roundTree' : 'fruitTree';
          if (tryPut(kind, tx, tz, 0.8 + rnd() * 0.45, null, true)) { trees++; for (let b = 0; b < 2; b++) { const ba = rnd() * 6.283, br = 1.8 + rnd() * 1.2; tryPut('bush', tx + Math.cos(ba) * br, tz + Math.sin(ba) * br, 0.7 + rnd() * 0.4); } } }
        if (!trees && !park) continue;
        const fa = rnd() * 6.283, fx = cx + Math.cos(fa) * 4.5, fz = cz + Math.sin(fa) * 4.5;   // wildflowers beside the grove
        for (let f = 0; f < 6; f++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 2.4; tryPut('flowers', fx + Math.cos(a) * r, fz + Math.sin(a) * r, 0.9); }
        for (let g = 0; g < 4; g++) { const a = rnd() * 6.283, r = 1 + rnd() * 3; tryPut('tuft', cx + Math.cos(a) * r, cz + Math.sin(a) * r, 0.9 + rnd() * 0.3); }
        if (rnd() < 0.25) tryPut('rock', cx + 2.2, cz - 1.4, 0.8 + rnd() * 0.4);
        groves.push([cx, cz, park ? 1 : 0]);
      } else if (roll < 0.06) {   // a lawn in town: one neat round flower bed, nothing else
        if (!okSmall(cx, cz) || !okSmall(cx + 1.6, cz) || !okSmall(cx - 1.6, cz)) continue;
        tryPut('bush', cx, cz, 0.6, 0);
        for (let f = 0; f < 10; f++) { const a = f / 10 * 6.283; tryPut('flowers', cx + Math.cos(a) * 1.3, cz + Math.sin(a) * 1.3, 0.75, a); }
      } }
    CZ.groves.set(k, groves); };
}

// ---------- 5. day and night (the style guide's table) ----------
const TOD = [
  [0, '#2a3566', '#151d40', '#0b1129', '#a9bdff', 0.42, '#4a5c98', '#1a1f30', 0.66, 1], [5.3, '#2c3466', '#151d40', '#0b112a', '#a9bdff', 0.40, '#4a5c98', '#1a1f30', 0.64, 1],
  [6.4, '#f2b08c', '#8a7fb0', '#33406e', '#ffb27a', 0.75, '#9aa5cc', '#4b4038', 0.60, 0.5], [7.4, '#f7dcc0', '#a9cdea', '#6f9fd2', '#ffd9ad', 1.10, '#c4d8ef', '#6b6b55', 0.62, 0.08],
  [9.5, '#eef4f2', '#b6d8ef', '#79acdd', '#fff3e0', 1.35, '#d8e9fb', '#6f7a55', 0.64, 0], [14, '#f1f4ee', '#b3d6ee', '#76a9dc', '#ffffff', 1.40, '#dcecff', '#6f7a55', 0.64, 0],
  [16, '#f6e6cc', '#b9d1e6', '#7fa6d4', '#ffe6c0', 1.25, '#d9e2f0', '#776d55', 0.62, 0], [17.0, '#ffc690', '#e8a9a2', '#7d84bf', '#ffad66', 1.00, '#cfc4da', '#6b5245', 0.58, 0.12],
  [17.8, '#f38a68', '#7a5c97', '#2c3468', '#ff8a5c', 0.60, '#a291bd', '#3f3240', 0.56, 0.5], [18.7, '#3b3f78', '#1d2550', '#0d1330', '#a9bdff', 0.42, '#4f5e99', '#1a1f30', 0.62, 0.9],
  [20, '#2a3566', '#151d40', '#0b1129', '#a9bdff', 0.42, '#4a5c98', '#1a1f30', 0.66, 1], [24, '#2a3566', '#151d40', '#0b1129', '#a9bdff', 0.42, '#4a5c98', '#1a1f30', 0.66, 1]];
const LIGHT = PH ? 0.8 : 0.78, SUND = new T.Vector3(0, 1, 0); let night = 0, fixedHour = null;
const mixHex = (a, b, t, out) => out.copy(lin(a)).lerp(lin(b), t);
function applyTime(h) { let i = 0; while (i < TOD.length - 2 && TOD[i + 1][0] <= h) i++; const A = TOD[i], B = TOD[i + 1], t = Math.min(1, Math.max(0, (h - A[0]) / (B[0] - A[0])));
  mixHex(A[1], B[1], t, skyU.bot.value); mixHex(A[2], B[2], t, skyU.mid.value); mixHex(A[3], B[3], t, skyU.top.value);
  mixHex(A[4], B[4], t, sun.color); sun.intensity = (A[5] + (B[5] - A[5]) * t) * LIGHT; mixHex(A[6], B[6], t, hemi.color); mixHex(A[7], B[7], t, hemi.groundColor); hemi.intensity = (A[8] + (B[8] - A[8]) * t) * LIGHT;
  night = A[9] + (B[9] - A[9]) * t; S3.fog.color.copy(skyU.bot.value).lerp(skyU.mid.value, 0.35);
  MS[B_GLASS].color.copy(lin('#2c3644')).lerp(lin('#ffcc73'), night); MS[B_WARM].color.copy(lin('#e8b45e')).lerp(lin('#ffd890'), night); MS[B_LAMP].color.copy(lin('#f6d27a')).lerp(lin('#fff0c0'), night); MS[B_WATER].color.setRGB(1, 1, 1).lerp(WNIGHT, night);
  glowMat.opacity = 0.12 + 0.88 * night; stars.material.opacity = Math.max(0, night - 0.3) / 0.7;
  if (FARV) { glowMat.visible = night > 0.04; stars.visible = stars.material.opacity > 0; }   // test link: by day the window glow and stars are not drawn at all (one less draw per square)
  const day = h > 6.2 && h < 18.1, a = Math.min(1, Math.max(0, (h - 6.4) / 11.5)) * Math.PI; SUND.set(day ? -Math.cos(a) : 0.35, day ? Math.max(0.12, Math.sin(a)) : 0.85, day ? 0.35 : -0.4).normalize();
  disc.material.color.set(day ? '#fff1c8' : '#dfe6ff'); disc.scale.setScalar(day ? 80 : 46);
  $('czIco').textContent = night > 0.6 ? '🌙' : (h > 16.5 && h < 18.5) || (h > 5.5 && h < 7.5) ? '🌇' : '☀️'; }
const hourNow = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
function tick() { const h = fixedHour == null ? hourNow() : fixedHour; applyTime(h); const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60), d = new Date();
  $('czCt').textContent = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + ((hh % 12) || 12) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm'); }
document.querySelectorAll('#czTimes button').forEach(b => b.onclick = () => { document.querySelectorAll('#czTimes button').forEach(x => x.setAttribute('aria-pressed', x === b)); fixedHour = b.dataset.h === 'live' ? null : +b.dataset.h; tick(); });
tick(); setInterval(tick, 5000);

// ---------- 6. you: a Kenney citizen, walking with the map's own rule ----------
lt.textContent = 'waking you up';
if (!window.loadGLB) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'kenney/glb.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
const DONORS = ['female-a', 'female-b', 'female-d', 'male-a', 'male-b', 'male-e'];
const lib = {}; await Promise.all(['anim', ...DONORS].map(async n => { lib[n] = await loadGLB(`kenney/chars/${n}.gltf.json`); }));
let ctex; lib.anim.scene.traverse(o => { if (o.isSkinnedMesh && !ctex) ctex = o.material.map; }); if (ctex) ctex.encoding = T.sRGBEncoding;
const cmat = PH ? new T.MeshLambertMaterial({ map: ctex, skinning: true }) : new T.MeshStandardMaterial({ map: ctex, skinning: true, roughness: 0.86, metalness: 0 });
const LOOK = { arm: 0.8, head: 0.78 };   // Dev chose option 3 (27 Nov): person-sized next to our homes, small arms, smaller head
const CLIPS = ['idle', 'walk', 'sprint', 'sit', 'emote-yes', 'interact-right', 'pick-up'], sizeOfDonor = {};
const blobG = new T.CircleGeometry(0.3, 14), blobM = new T.MeshBasicMaterial({ color: 0x1a2030, transparent: true, opacity: 0.22, depthWrite: false });
function makeCitizen(donor, shadow) { const base = lib.anim, r = base.scene.clone(true), bones = {}, old = []; r.traverse(o => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) old.push(o); }); old.forEach(o => o.parent.remove(o)); r.updateMatrixWorld(true);
  lib[donor].scene.traverse(o => { if (!o.isSkinnedMesh) return; const m = new T.SkinnedMesh(o.geometry, cmat); m.frustumCulled = false; m.castShadow = shadow && !PH; r.add(m); const sk = new T.Skeleton(o.skeleton.bones.map(b => bones[b.name])); sk.calculateInverses(); m.bind(sk, m.matrixWorld); });
  if (PH || !shadow) { const b = new T.Mesh(blobG, blobM); b.rotation.x = -Math.PI / 2; b.position.y = 0.02; r.add(b); }
  if (!sizeOfDonor[donor]) { r.updateMatrixWorld(true); let y0 = 1e9, y1 = -1e9; const vv = new T.Vector3(); r.traverse(o => { if (!o.isSkinnedMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) { vv.fromBufferAttribute(p, i); o.boneTransform(i, vv); vv.applyMatrix4(o.matrixWorld); y0 = Math.min(y0, vv.y); y1 = Math.max(y1, vv.y); } }); sizeOfDonor[donor] = Math.max(0.1, y1 - y0); }
  r.scale.setScalar(2.15 / sizeOfDonor[donor] * (1 + (1 - LOOK.head) * 0.35)); S3.add(r);
  const mixer = new T.AnimationMixer(r), acts = {}; for (const cl of base.animations) if (CLIPS.includes(cl.name)) acts[cl.name] = mixer.clipAction(cl);
  const sized = {}; r.traverse(o => { if (o.isBone && (o.name === 'arm-left' || o.name === 'arm-right' || o.name === 'head')) sized[o.name] = { b: o, rest: o.scale.clone(), k: o.name === 'head' ? LOOK.head : LOOK.arm }; });
  const step = dt => { for (const n in sized) sized[n].b.scale.copy(sized[n].rest); mixer.update(dt); for (const n in sized) sized[n].b.scale.multiplyScalar(sized[n].k); };   // reset, animate, then shrink once (no stacking)
  const c = { root: r, mixer, step, cur: null, busy: 0,
    play(n) { if (c.cur === n || !acts[n]) return; acts[n].reset().setLoop(T.LoopRepeat).fadeIn(0.2).play(); if (c.cur && acts[c.cur]) acts[c.cur].fadeOut(0.2); c.cur = n; },
    once(n) { const a = acts[n]; if (!a) return; if (c.cur && acts[c.cur]) acts[c.cur].fadeOut(0.15); a.reset().setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; a.fadeIn(0.15).play(); c.cur = n; c.busy = a.getClip().duration; } };
  c.play('idle'); return c; }
const me = makeCitizen('female-b', true);
let px = 0, pz = 30, yaw = Math.PI, pitch = FARV && innerWidth > innerHeight ? 0.42 : 0.72; me.root.rotation.y = Math.PI;
{ const want = (QS.get('visit') || '').replace(/^@/, '').toLowerCase(), h = want && homes.find(x => (x.user || '').toLowerCase() === want); if (h) { px = h.x; pz = h.z + 9; } const f = nearestFree(px, pz); px = f[0]; pz = f[1]; }
const keys = {}; addEventListener('blur', () => { for (const k in keys) keys[k] = false; });   // 27 Nov: a key held while you switch windows (or take a screenshot) no longer stays pressed
addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; keys[e.key.toLowerCase()] = true; }); addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);   // 28 Nov: typing a name in the menu does not walk you
const stick = $('czStick'), knob = $('czKnob'), joy = { x: 0, y: 0, id: null };
stick.addEventListener('pointerdown', e => { joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); mj(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === joy.id) mj(e); });
const ej = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }; stick.addEventListener('pointerup', ej); stick.addEventListener('pointercancel', ej);
function mj(e) { const r = stick.getBoundingClientRect(); let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2; const d = Math.hypot(dx, dy), m = r.width / 2 - 12; if (d > m) { dx *= m / d; dy *= m / d; } joy.x = dx / m; joy.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; }
let dragged = false; if (FARV) addEventListener('resize', () => { if (!dragged) pitch = innerWidth > innerHeight ? 0.42 : 0.72; });   // test link: turning the phone sideways gives the look-ahead camera
let look = null; R3.domElement.addEventListener('pointerdown', e => { look = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (!look || e.pointerId !== look.id) return; dragged = true; yaw -= (e.clientX - look.x) * 0.006; pitch = Math.min(1.15, Math.max(FARV ? 0.14 : 0.3, pitch + (e.clientY - look.y) * 0.004)); look.x = e.clientX; look.y = e.clientY; });
addEventListener('pointerup', e => { if (look && e.pointerId === look.id) look = null; });
let running = false; $('czRun').onclick = () => { running = !running; $('czRun').setAttribute('aria-pressed', running); };

// ---------- 6b. names over shops and homes near you (the same names the map shows) ----------
const tagCss = document.createElement('style'); tagCss.textContent = `#czTags { position: absolute; inset: 0; pointer-events: none; z-index: 2; overflow: hidden; }
#czTags div { position: absolute; left: 0; top: 0; white-space: nowrap; border-radius: 999px; padding: 2px 9px; font: 600 11px/1.3 Poppins, system-ui, sans-serif; background: rgba(255,250,240,.9); color: #14233f; will-change: transform; }
#czTags div.shop { background: #2f2b28; color: #fbf6ec; font-size: 12px; } #czTags div.shop b { font-weight: 700; margin-right: 4px; }`;
document.head.appendChild(tagCss);
const tagsEl = document.createElement('div'); tagsEl.id = 'czTags'; root.appendChild(tagsEl);
const labelled = [];
try { shops.forEach(s => s.lp && s.el && labelled.push({ x: s.lp.x, y: s.lp.y, z: s.lp.z, el: s.el, shop: true })); } catch (e) {}
homes.forEach(h => { if (h.lp && h.el && h.status === 'active' && !h.shopRef) labelled.push({ x: h.lp.x, y: Math.min(h.lp.y, 8.5), z: h.lp.z, el: h.el, shop: false }); });
const lgrid = new Map(); labelled.forEach(l => { const k = Math.floor(l.x / 40) * 100003 + Math.floor(l.z / 40); (lgrid.get(k) || lgrid.set(k, []).get(k)).push(l); });
const tagPool = []; for (let i = 0; i < 14; i++) { const d = document.createElement('div'); d.hidden = true; tagsEl.appendChild(d); tagPool.push(d); }
const PV = new T.Vector3();
function drawTags() { const near = [], gx = Math.floor(px / 40), gz = Math.floor(pz / 40);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) (lgrid.get((gx + i) * 100003 + gz + j) || []).forEach(l => { const d = Math.hypot(l.x - px, l.z - pz); if (d < (l.shop ? 70 : 42)) near.push([d * (l.shop ? 0.5 : 1), l]); });
  near.sort((a, b) => a[0] - b[0]); let k = 0;
  for (const [, l] of near) { if (k >= tagPool.length) break; PV.set(l.x, l.y, l.z).project(CAM); if (PV.z > 1 || Math.abs(PV.x) > 1.05 || Math.abs(PV.y) > 1.05 || (1 - PV.y) / 2 * innerHeight < 74) continue; /* 28 Nov: not under the top bar */
    const el = tagPool[k++]; if (el.dataset.src !== l.el.textContent) { el.dataset.src = l.el.textContent; el.textContent = ''; const kids = l.el.querySelectorAll('b, span');
      if (l.shop && kids.length) kids.forEach(c => { const n = document.createElement(c.tagName.toLowerCase()); n.textContent = c.textContent; el.appendChild(n); }); else el.textContent = l.el.textContent; }
    el.className = l.shop ? 'shop' : ''; el.hidden = false; el.style.transform = `translate(${((PV.x + 1) / 2 * innerWidth).toFixed(0)}px,${((1 - PV.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%,-100%)`; }
  for (; k < tagPool.length; k++) if (!tagPool[k].hidden) tagPool[k].hidden = true; }

// ---------- 6c. chimney smoke from the homes around you ----------
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const chimneys = []; for (let i = 0; i < chimTops.length; i += 3) chimneys.push([chimTops[i], chimTops[i + 1], chimTops[i + 2]]);
const PUFFS = 4, MAXCH = PH ? 10 : 18, smoke = new T.InstancedMesh(new T.IcosahedronGeometry(0.42, 0), MAT({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), MAXCH * PUFFS);
smoke.frustumCulled = false; smoke.count = 0; S3.add(smoke); let smokeT = 0, nearCh = [];
const SQ = new T.Quaternion(), SV = new T.Vector3(), SS = new T.Vector3();
function drawSmoke(dt) { if (RM) return; smokeT += dt;
  if (!nearCh.length || Math.floor(smokeT * 2) !== Math.floor((smokeT - dt) * 2)) nearCh = chimneys.map(c => [Math.hypot(c[0] - px, c[2] - pz), c]).filter(a => a[0] < 70).sort((a, b) => a[0] - b[0]).slice(0, MAXCH).map(a => a[1]);
  let n = 0; nearCh.forEach((c, ci) => { for (let p = 0; p < PUFFS; p++) { const life = ((smokeT * 0.4 + p / PUFFS + ci * 0.37) % 1), s = 0.5 + life * 1.3;
    smoke.setMatrixAt(n++, M4.compose(SV.set(c[0] + Math.sin(life * 3 + ci) * 0.5 + life * 0.8, c[1] + life * 3.2, c[2] + life * 0.5), SQ.identity(), SS.set(s, s, s))); } });
  smoke.count = n; smoke.instanceMatrix.needsUpdate = true; smoke.material.opacity = 0.5 - night * 0.25; }

// ---------- 6d. people: real citizens near you (Kenney), in the map's own places ----------
// Shop owners at their shop door, staff beside them, police in front of HQ, people on the map's own benches, walkers on pavements.
// A small pool is reused as you move, so a phone only ever animates a dozen people.
const hashS = t => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const donorOf = u => DONORS[hashS(u || 'x') % DONORS.length];
const UPV3 = new T.Vector3(0, 1, 0), spots = [];
try { shops.forEach(s => { if (!s.owner) return; const o = new T.Vector3(1.9, 0, 3.6).applyAxisAngle(UPV3, s.ry || 0); spots.push({ x: s.x + o.x, z: s.z + o.z, ry: (s.ry || 0) + 0.25, user: s.owner.user, role: s.job || 'Shop owner', pose: 'idle', own: !!s.el });
  (s.staff || []).forEach((w, j) => { const q = new T.Vector3(j ? 3.2 : -1.9, 0, j ? 4.2 : 3.6).applyAxisAngle(UPV3, s.ry || 0); spots.push({ x: s.x + q.x, z: s.z + q.z, ry: (s.ry || 0) - 0.3, user: w.user, role: 'works here', pose: 'idle' }); }); }); } catch (e) {}
try { (standers || []).forEach(st => spots.push({ x: st.x, z: st.z, ry: 0, user: st.h.user, role: 'Police', pose: 'idle' })); } catch (e) {}
const activeUsers = homes.filter(h => h.status === 'active' && h.user).map(h => h.user);
const pickUser = () => activeUsers[Math.floor(Math.random() * activeUsers.length)] || 'citizen';
try { const bp = new T.Vector3(), bq = new T.Quaternion(), bs = new T.Vector3(); (LIFE.mats && LIFE.mats.bench || []).forEach((m, i) => { m.decompose(bp, bq, bs); const ry = new T.Euler().setFromQuaternion(bq, 'YXZ').y;
  if (i % 3 === 0) spots.push({ x: bp.x, z: bp.z, ry, user: activeUsers[hashS('bench' + i) % Math.max(1, activeUsers.length)], role: '', pose: 'sit', y: 0.22 }); }); } catch (e) {}
const spotGrid = new Map(); spots.forEach(sp => { const k = Math.floor(sp.x / 50) * 100003 + Math.floor(sp.z / 50); (spotGrid.get(k) || spotGrid.set(k, []).get(k)).push(sp); });
const freeBy = {}; DONORS.forEach(d => freeBy[d] = []);
const take = d => freeBy[d].pop() || makeCitizen(d, false), give = (d, c) => { c.root.visible = false; freeBy[d].push(c); };
const STATIC_N = PH ? 6 : 12, WALK_N = PH ? 6 : 10, RD = ROADS.map(([w, d, x, z]) => ({ w, d, x, z, ax: w >= d, L: Math.max(w, d), W: Math.min(w, d) })).filter(r => r.L > 20 && r.W >= 4);
const placed = new Map(), walkersK = [];
function refreshPeople() { const gx = Math.floor(px / 50), gz = Math.floor(pz / 50), near = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) (spotGrid.get((gx + i) * 100003 + gz + j) || []).forEach(sp => { const d = Math.hypot(sp.x - px, sp.z - pz); if (d < 75) near.push([d, sp]); });
  near.sort((a, b) => a[0] - b[0]); const want = new Set(near.slice(0, STATIC_N).map(a => a[1]));
  for (const [sp, c] of placed) if (!want.has(sp)) { give(donorOf(sp.user), c); placed.delete(sp); }
  for (const sp of want) if (!placed.has(sp)) { if (sp.pose !== 'sit' && !sp.fixed) { const f = nearestFree(sp.x, sp.z); sp.x = f[0]; sp.z = f[1]; sp.fixed = true; } const c = take(donorOf(sp.user)); c.root.position.set(sp.x, sp.y || 0.12, sp.z); c.root.rotation.y = sp.ry; c.root.visible = true; c.play(sp.pose); c.spot = sp; placed.set(sp, c); }
  // walkers: each on a pavement near you, real names
  while (walkersK.length < WALK_N) walkersK.push({ c: null });
  for (const w of walkersK) { const far = !w.c || Math.hypot(w.c.root.position.x - px, w.c.root.position.z - pz) > 95;
    if (!far) continue; const rs = RD.filter(r => Math.abs(r.x - px) < 70 + r.w / 2 && Math.abs(r.z - pz) < 70 + r.d / 2); if (!rs.length) continue;
    if (w.c) give(w.d, w.c); w.user = pickUser(); w.d = donorOf(w.user); w.c = take(w.d); w.c.root.visible = true; w.r = rs[Math.floor(Math.random() * rs.length)]; w.s = Math.random() - 0.5; w.side = Math.random() < 0.5 ? 1 : -1; w.dir = Math.random() < 0.5 ? 1 : -1; w.v = 1.1 + Math.random() * 0.5; w.pause = 0; } }
function stepPeople(dt) {
  for (const w of walkersK) { if (!w.c) continue; const r = w.r, c = w.c;
    if (w.pause > 0) { w.pause -= dt; c.play('idle'); } else { const ns = w.s + w.dir * w.v * dt / r.L, off = w.side * (r.W / 2 + 0.9), along = ns * r.L, nx = r.ax ? r.x + along : r.x + off, nz = r.ax ? r.z + off : r.z + along;
      if (Math.abs(ns) > 0.48 || !freeAt(nx, nz)) { w.dir *= -1; w.pause = 1 + Math.random() * 3; } else w.s = ns; c.play('walk'); }
    const off = w.side * (r.W / 2 + 0.9), along = w.s * r.L; c.root.position.set(r.ax ? r.x + along : r.x + off, 0.12, r.ax ? r.z + off : r.z + along); c.root.rotation.y = r.ax ? (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (w.dir > 0 ? 0 : Math.PI);
    c.step(dt); }
  for (const c of placed.values()) { if (c.busy > 0) { c.busy -= dt; if (c.busy <= 0) c.play(c.spot.pose); } else if (c.spot.pose === 'idle' && Math.random() < dt * 0.04) c.once('emote-yes'); c.step(dt); } }
// names over people close to you
const ppl = document.createElement('style'); ppl.textContent = '#czTags div.npc { background: rgba(255,250,240,.85); font-size: 11px; font-weight: 600; } #czTags div.npc i { font-style: normal; opacity: .65; margin-left: 4px; }'; document.head.appendChild(ppl);
const npcPool = []; for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.className = 'npc'; d.hidden = true; tagsEl.appendChild(d); npcPool.push(d); }
function drawPeopleTags() { const list = [];
  for (const [sp, c] of placed) if (!(FARV && sp.own)) list.push([Math.hypot(sp.x - px, sp.z - pz), c.root.position, '@' + sp.user, sp.role]);
  for (const w of walkersK) if (w.c) list.push([Math.hypot(w.c.root.position.x - px, w.c.root.position.z - pz), w.c.root.position, '@' + w.user, '']);
  list.sort((a, b) => a[0] - b[0]); let k = 0;
  for (const [d, p, name, role] of list) { if (k >= npcPool.length || d > 26) break; PV.set(p.x, p.y + 2.6, p.z).project(CAM); if (PV.z > 1 || Math.abs(PV.x) > 1.05 || Math.abs(PV.y) > 1.05 || (1 - PV.y) / 2 * innerHeight < 74) continue;
    const el = npcPool[k++], key = name + '|' + role; if (el.dataset.k !== key) { el.dataset.k = key; el.textContent = name; if (role) { const i = document.createElement('i'); i.textContent = role; el.appendChild(i); } }
    el.hidden = false; el.style.transform = `translate(${((PV.x + 1) / 2 * innerWidth).toFixed(0)}px,${((1 - PV.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%,-100%)`; }
  for (; k < npcPool.length; k++) if (!npcPool[k].hidden) npcPool[k].hidden = true; }
let peopleT = 0, lifeT = 0;

// ---------- 6e. driving (Dev, 27 Nov): your own car on the real roads, with the map's own road rule ----------
const driveCss = document.createElement('style'); driveCss.textContent = `#czDrive { position: absolute; right: calc(24px + env(safe-area-inset-right)); bottom: 104px; height: 46px; padding: 0 16px; border: 0; border-radius: 999px; background: #fff; color: #1c2238; font: 800 15px Poppins, system-ui, sans-serif; box-shadow: 0 3px 0 rgba(0,0,0,.2); z-index: 3; cursor: pointer; }
#czDrive:active { transform: translateY(2px); } #czToast { position: absolute; left: 50%; top: calc(60px + env(safe-area-inset-top)); transform: translateX(-50%); background: rgba(20,26,44,.8); color: #fff; border-radius: 12px; padding: 6px 14px; font: 600 14px Poppins, system-ui, sans-serif; z-index: 4; opacity: 0; transition: opacity .3s; pointer-events: none; text-align: center; }
#czToast.on { opacity: 1; }`; document.head.appendChild(driveCss);
const driveBtn = $('czCarB');   // 28 Nov: the round car button on the game screen (section 6g)
const toastEl = document.createElement('div'); toastEl.id = 'czToast'; root.appendChild(toastEl); let toastT = 0;
const toast = t => { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2600); };
const carLib = await loadGLB('kenney/cars/sedan.gltf.json').catch(() => null);
let car = null; const CAR = { x: 0, z: 0, a: 0, v: 0, W: 2, L: 4.4 }; let driving = false;
function makeCar() { if (car || !carLib) return car; car = carLib.scene.clone(true);
  car.traverse(o => { if (!o.isMesh) return; const m0 = o.material; if (m0 && m0.map) m0.map.encoding = T.sRGBEncoding; o.material = PH ? new T.MeshLambertMaterial({ map: m0 && m0.map, color: m0 && m0.color }) : new T.MeshStandardMaterial({ map: m0 && m0.map, color: m0 && m0.color, roughness: 0.6, metalness: 0.05 }); o.castShadow = !PH; });
  const b = new T.Box3().setFromObject(car), sz = b.getSize(new T.Vector3()), long = Math.max(sz.x, sz.z), k = 4.4 / long; car.scale.setScalar(k);
  CAR.W = Math.min(sz.x, sz.z) * k; CAR.L = 4.4; car.userData.faceX = sz.x > sz.z;   // Kenney cars point along +z; if not, turn them
  if (PH) { const sh = new T.Mesh(new T.PlaneGeometry(CAR.W * 1.05 / k, 4.6 / k), blobM); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03 / k; car.add(sh); }
  S3.add(car); return car; }
const carOn = (x, z) => DRV.grid ? onRoad(x, z) : onRoadW(x, z);   // 27 Nov: the car drives where the map's car does: roads, the pavement beside them (Dev, 18 Nov), level crossings and the bridge decks
const corners = (x, z, a) => { const hw = CAR.W / 2 - 0.22, hl = CAR.L / 2 - 0.3, s = Math.sin(a), c = Math.cos(a);   // how many of the car's 4 corners are on the road
  return carOn(x + s * hl + c * hw, z + c * hl - s * hw) + carOn(x + s * hl - c * hw, z + c * hl + s * hw) + carOn(x - s * hl + c * hw, z - c * hl - s * hw) + carOn(x - s * hl - c * hw, z - c * hl + s * hw); };
const fits = (x, z, a) => corners(x, z, a) === 4;
function enterCar() { try { driveRoads(); } catch (e) {} if (!DRV.grid || !makeCar()) { toast('Driving is not ready here yet'); return; }
  if (!DRV.car) DRV.car = { userData: { W: CAR.W, L: CAR.L } };   // the map's nearestRoadSpot reads the car size from here
  const parked = car.visible && Math.hypot(CAR.x - px, CAR.z - pz) < 7 && car.userData.placed;
  if (!parked) { const sp = nearestRoadSpot(px, pz); if (!sp || Math.hypot(sp[0] - px, sp[1] - pz) > 28) { toast('Walk to a road first'); return; } CAR.x = sp[0]; CAR.z = sp[1]; CAR.a = sp[2]; }
  CAR.v = 0; car.userData.placed = true; car.visible = true; driving = true; me.root.visible = false; hudCar(true); $('czRun').hidden = true; toast('Up on the stick to drive, sideways to steer'); }
function leaveCar() { driving = false; CAR.v = 0; const s = Math.sin(CAR.a), c = Math.cos(CAR.a), f = nearestFree(CAR.x + c * 2.6, CAR.z - s * 2.6); px = f[0]; pz = f[1]; footY = carY; me.root.visible = true; hudCar(false); $('czRun').hidden = false; }
driveBtn.onclick = () => driving ? leaveCar() : enterCar();
function stepCar(dt, ix, iz) { const thr = -iz, steer = ix, MAX = 17, REV = -6;
  CAR.v += (thr > 0.1 ? thr * 9 : thr < -0.1 ? (CAR.v > 0.3 ? thr * 16 : thr * 5) : -Math.sign(CAR.v) * Math.min(Math.abs(CAR.v), 4 * dt) / dt) * dt;
  CAR.v = Math.max(REV, Math.min(MAX, CAR.v));
  if (Math.abs(CAR.v) > 0.5) { const fx = Math.sin(CAR.a) * Math.sign(CAR.v), fz = Math.cos(CAR.a) * Math.sign(CAR.v); let cap = 1e9;   // people on the pavement ahead: brake gently (nobody gets hit, ever)
    for (const w of walkersK) { if (!w.c) continue; const p = w.c.root.position, ox = p.x - CAR.x, oz = p.z - CAR.z, ahead = ox * fx + oz * fz;
      if (ahead > 0 && ahead < CAR.L / 2 + 6 && Math.abs(ox * fz - oz * fx) < 1.6) cap = Math.min(cap, Math.max(0, (ahead - CAR.L / 2 - 1.2) * 1.4)); }
    if (Math.abs(CAR.v) > cap) CAR.v = Math.sign(CAR.v) * cap; }
  // 27 Nov (Dev: "stuck on the bridge ... sticking when it touches the pavement"): steer only if the car still fits; at a kerb, slide along it and slow down a little (like the map's car)
  const na = Math.abs(CAR.v) > 0.2 ? CAR.a - steer * 1.6 * dt * Math.min(1, Math.abs(CAR.v) / 6) * Math.sign(CAR.v) : CAR.a;
  const nx = CAR.x + Math.sin(na) * CAR.v * dt, nz = CAR.z + Math.cos(na) * CAR.v * dt, here = corners(CAR.x, CAR.z, CAR.a);
  const ok = (x, z, a) => { const n = corners(x, z, a); return n === 4 || (here < 4 && n >= here); };   // a car already part off the road may make any move that is not worse, so it never gets stuck
  const scrape = ax => { const t = ax ? Math.round((CAR.a - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2 : Math.round(CAR.a / Math.PI) * Math.PI, d = t - CAR.a, sa = CAR.a + d * Math.min(1, dt * 4);   // scraping along a kerb: lose a little speed (more when you hit it steeply) and turn to run along it
    CAR.v *= 1 - Math.min(1, dt * 2.5 * Math.abs(Math.sin(d))); if (ok(CAR.x, CAR.z, sa)) CAR.a = sa; };
  if (ok(nx, nz, na)) { CAR.x = nx; CAR.z = nz; CAR.a = na; } else if (Math.abs(nx - CAR.x) > 1e-3 && ok(nx, CAR.z, CAR.a)) { CAR.x = nx; scrape(true); } else if (Math.abs(nz - CAR.z) > 1e-3 && ok(CAR.x, nz, CAR.a)) { CAR.z = nz; scrape(false); }
  else if (ok(CAR.x, CAR.z, na)) { CAR.a = na; CAR.v *= 0.5; } else CAR.v *= 0.3;
  carY += (floorAt(CAR.x, CAR.z, carY) - carY) * Math.min(1, dt * 8); car.position.set(CAR.x, 0.02 + Math.max(0, carY - GND), CAR.z); car.rotation.y = CAR.a + (car.userData.faceX ? Math.PI / 2 : 0);
  px = CAR.x; pz = CAR.z; let d = CAR.a - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * Math.min(1, dt * 2.5); }

// ---------- 6f. flags, butterflies and fireflies (Dev, 27 Nov: "flags and butterflies, in parks and natural dense areas more") ----------
// Bunting on poles around the plaza and along every park's edge, swaying in the wind (one mesh, moved by the GPU).
const ACCENT = [0xff6b57, 0x4b9bff, 0x3fca85, 0xb07cf0, 0xffd24a, 0xe85d9a, 0x2e9c8a];
const MDp = window.VIN_MAPDATA || {}, buntGroups = []; let buntP, buntC, buntS, buntD;
const newBuntGroup = () => { buntP = []; buntC = []; buntS = []; buntD = []; buntGroups.push({ P: buntP, C: buntC, S: buntS, D: buntD }); };
const btri = (a, b, c, col, sa, sb, sc, d) => { buntP.push(...a, ...b, ...c); for (let j = 0; j < 3; j++) buntC.push(col >> 16 & 255, col >> 8 & 255, col & 255); buntS.push(sa, sb, sc); for (let j = 0; j < 3; j++) buntD.push(...d); };
function pole(x, z, h) { const w = 0.07, col = 0x7a5233; [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dz], i) => { const [ex, ez] = [[0, 1], [-1, 0], [0, -1], [1, 0]][i]; const a = [x + dx * w + ex * w, 0, z + dz * w + ez * w], b = [x + dx * w - ex * w, 0, z + dz * w - ez * w];
  btri(a, b, [b[0], h, b[2]], col, 0, 0, 0, [0, 0, 0]); btri(a, [b[0], h, b[2]], [a[0], h, a[2]], col, 0, 0, 0, [0, 0, 0]); }); }
function bunting(x0, z0, x1, z1, h, seed) { const L = Math.hypot(x1 - x0, z1 - z0); if (L < 4) return; const ux = (x1 - x0) / L, uz = (z1 - z0) / L, d = [-uz, 0, ux], n = Math.max(3, Math.floor(L / 0.9)), sag = Math.min(1.1, L * 0.045);
  const at = t => [x0 + (x1 - x0) * t, h - sag * 4 * t * (1 - t), z0 + (z1 - z0) * t];
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, A = at(t0), B = at(t1);   // the string
    btri(A, B, [B[0], B[1] - 0.04, B[2]], 0xfbf6ec, 0, 0, 0.1, d); btri(A, [B[0], B[1] - 0.04, B[2]], [A[0], A[1] - 0.04, A[2]], 0xfbf6ec, 0, 0.1, 0.1, d);
    if (i % 1 === 0) { const m0 = at(t0 + 0.12 / n), m1 = at(t1 - 0.12 / n), tip = at((t0 + t1) / 2); tip[1] -= 0.5;   // a little flag hanging under it
      const col = ACCENT[(i + seed) % ACCENT.length]; btri(m0, m1, tip, col, 0, 0, 1, d); btri(m1, m0, tip, col, 0, 0, 1, d); } } }
function lineOfBunting(x0, z0, x1, z1, seed) { const L = Math.hypot(x1 - x0, z1 - z0), segs = Math.max(1, Math.round(L / 22)), H = 3.6;
  for (let i = 0; i <= segs; i++) { const t = i / segs, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (freeAt(x, z)) pole(x, z, H + 0.15); }
  for (let i = 0; i < segs; i++) { const a = i / segs, b = (i + 1) / segs; bunting(x0 + (x1 - x0) * a, z0 + (z1 - z0) * a, x0 + (x1 - x0) * b, z0 + (z1 - z0) * b, H, seed + i); } }
{ const pl = (MDp.places || []).find(p => /Citizens' Plaza/.test(p[0])); if (pl) { newBuntGroup(); const [, x, z, w, d] = pl, i = 1.2, X0 = x + i, X1 = x + w - i, Z0 = z + i, Z1 = z + d - i;
    lineOfBunting(X0, Z0, X1, Z0, 0); lineOfBunting(X1, Z0, X1, Z1, 2); lineOfBunting(X1, Z1, X0, Z1, 4); lineOfBunting(X0, Z1, X0, Z0, 6); } }
(MDp.flat || []).filter(f => f[0] === 'g' && f[3] > 14 && f[4] > 14).forEach(([, x, z, w, d], k) => { newBuntGroup(); const i = 1.5; lineOfBunting(x + i, z + i, x + w - i, z + i, k); lineOfBunting(x + i, z + d - i, x + w - i, z + d - i, k + 3);
  if (w * d < 9000) { lineOfBunting(x + i, z + i, x + i, z + d - i, k + 1); lineOfBunting(x + w - i, z + i, x + w - i, z + d - i, k + 5); } });
const buntU = { uT: { value: 0 } };
const buntMeshes = [];
const buntMat = PH ? new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }) : new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.9, flatShading: true });
buntMat.onBeforeCompile = sh => { sh.uniforms.uT = buntU.uT; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float sway;\nattribute vec3 sdir;\nuniform float uT;')
  .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += sdir * sin(uT * 2.6 + position.x * 0.35 + position.z * 0.35) * 0.22 * sway;')
  .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb = pow(color.rgb, vec3(2.2));\n#endif'); };
buntGroups.forEach(gr => { if (!gr.P.length) return; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(gr.P, 3)); g.setAttribute('color', new T.BufferAttribute(new Uint8Array(gr.C), 3, true)); g.setAttribute('sway', new T.Float32BufferAttribute(gr.S, 1)); g.setAttribute('sdir', new T.Float32BufferAttribute(gr.D, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new T.Mesh(g, buntMat); m.castShadow = !PH; m.matrixAutoUpdate = false; S3.add(m); buntMeshes.push(m); });   // one mesh per park: only the ones near you are drawn
CZ.bunting = buntGroups.reduce((a, g) => a + g.P.length / 9, 0);
// butterflies by day and fireflies at night, around the groves and in the parks near you
const BN = PH ? 14 : 26, wingG = new T.BufferGeometry();
wingG.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, -0.5, 0.03, 0.3, -0.48, 0.03, -0.32, 0, 0, 0, 0.48, 0.03, -0.32, 0.5, 0.03, 0.3], 3)); wingG.computeVertexNormals();
const flies = new T.InstancedMesh(wingG, new T.MeshBasicMaterial({ side: T.DoubleSide }), BN); flies.instanceColor = new T.InstancedBufferAttribute(new Float32Array(BN * 3).fill(1), 3); flies.frustumCulled = false; S3.add(flies);
for (let i = 0; i < BN; i++) flies.setColorAt(i, lin('#' + ([0xffd24a, 0xffffff, 0xff9a4d, 0x7fb8ff, 0xff7fa8][i % 5]).toString(16).padStart(6, '0')));
const FF = PH ? 24 : 44, ffG = new T.BufferGeometry(); ffG.setAttribute('position', new T.BufferAttribute(new Float32Array(FF * 3), 3));
const fireflies = new T.Points(ffG, new T.PointsMaterial({ map: GT, color: lin('#d9ff8a'), size: 1.3, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false })); fireflies.frustumCulled = false; S3.add(fireflies);
const anchors = []; let anchorT = 0;
const parkRects = (MDp.flat || []).filter(f => f[0] === 'g');
function refreshAnchors() { anchors.length = 0; const cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) (CZ.groves && CZ.groves.get(kOf(cx + i, cz + j)) || []).forEach(g => { if (Math.hypot(g[0] - px, g[1] - pz) < 80) anchors.push([g[0], g[1]]); });
  parkRects.forEach(([, x, z, w, d]) => { for (let k = 0; k < 4; k++) { const ax = x + w * (0.2 + 0.6 * ((k * 0.37) % 1)), az = z + d * (0.2 + 0.6 * ((k * 0.61) % 1)); if (Math.hypot(ax - px, az - pz) < 80) anchors.push([ax, az]); } });
  anchors.sort((a, b) => Math.hypot(a[0] - px, a[1] - pz) - Math.hypot(b[0] - px, b[1] - pz)); anchors.length = Math.min(anchors.length, 14); }
const FQ = new T.Quaternion(), FE = new T.Euler(), FS = new T.Vector3(), FV = new T.Vector3();
function stepLife(dt, t) { buntU.uT.value = t;
  if (anchorT <= dt) buntMeshes.forEach(m => { const c = m.geometry.boundingSphere.center; m.visible = Math.hypot(c.x - px, c.z - pz) - m.geometry.boundingSphere.radius < VIEW; });
  anchorT -= dt; if (anchorT <= 0) { anchorT = 2; refreshAnchors(); }
  const day = night < 0.5, n = anchors.length;
  flies.visible = day && n > 0; fireflies.material.opacity = n ? Math.max(0, night - 0.4) / 0.6 : 0;
  if (flies.visible) { for (let i = 0; i < BN; i++) { const a = anchors[i % n], ph = i * 1.7, r = 1.6 + (i % 4) * 0.6, s = t * (0.5 + (i % 3) * 0.15) + ph;
      const x = a[0] + Math.cos(s) * r + Math.sin(s * 2.3) * 0.6, z = a[1] + Math.sin(s * 1.3) * r, y = 0.8 + (i % 3) * 0.45 + Math.sin(s * 3.1) * 0.35, flap = 0.25 + Math.abs(Math.cos(t * 16 + ph)) * 0.75;
      flies.setMatrixAt(i, M4.compose(FV.set(x, y, z), FQ.setFromEuler(FE.set(0, -s + Math.PI / 2, 0)), FS.set(flap, 1, 1))); } flies.instanceMatrix.needsUpdate = true; }
  if (fireflies.material.opacity > 0) { const P = ffG.attributes.position.array; for (let i = 0; i < FF; i++) { const a = anchors[i % n], s = t * 0.3 + i * 2.1; P[i * 3] = a[0] + Math.cos(s + i) * (2 + (i % 5)); P[i * 3 + 1] = 0.6 + (i % 4) * 0.5 + Math.sin(t * 1.7 + i) * 0.4; P[i * 3 + 2] = a[1] + Math.sin(s * 1.2 + i) * (2 + (i % 4)); } ffG.attributes.position.needsUpdate = true; } }

// ---------- 6g. the sideways game screen (Dev chose it, 28 Nov): minimap, today's tasks, one big action button, menu with a free bus ----------
// Layout from the design canvas (GameHUD): joystick bottom left, big gold button bottom right with Run / Car / Photo round it, clock top middle,
// minimap top right, today's tasks top left under the menu. Nothing here gives coins yet: tasks are only ticked, until the coin system exists.
const TOUCH = matchMedia('(any-pointer: coarse)').matches; root.classList.toggle('touch', TOUCH);
const MDX = window.VIN_MAPDATA || { roads: [], flat: [], places: [], slots: [] };
const LS = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const findFree = (x, z) => { const ok = (a, b) => walkFree(a, b) && !wetAt(a, b); if (ok(x, z)) return [x, z];   // the nearest spot you can stand on (the player's own walking rule)
  for (let r = 0.75; r < 60; r += 0.75) for (let a = 0; a < 6.283; a += 0.6 / r) { const qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r; if (ok(qx, qz)) return [qx, qz]; } return nearestFree(x, z); };
// --- minimap: the same shapes as the phone Maps mode (mapdata.js), turned so that where you face is up
const mapC = $('czMapC'), mg = mapC.getContext('2d'), nEl = $('czN'), whereEl = $('czWhere');
const FCOL = { w: '#a5d3e8', g: '#c3dc9f', p: '#f1e8d2' }, homePts = homes.filter(h => h.status === 'active').map(h => [h.x, h.z]);
let mapT = 0, mapK = '';
function drawMap(force) { const W = mapC.clientWidth || 92, dpr = Math.min(2, devicePixelRatio || 1), P = Math.round(W * dpr), R = driving ? 170 : 105;
  const key = Math.round(px * 2) + ',' + Math.round(pz * 2) + ',' + Math.round(yaw * 60) + ',' + P + ',' + R; if (!force && key === mapK) return; mapK = key;
  if (mapC.width !== P) { mapC.width = mapC.height = P; }
  const k = P / 2 / R, cy = Math.cos(yaw), sy = Math.sin(yaw), a = -k * cy, b = -k * sy, c = k * sy, d = -k * cy, x0 = px - R * 1.45, x1 = px + R * 1.45, z0 = pz - R * 1.45, z1 = pz + R * 1.45;
  const g = mg; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#dde6c4'; g.fillRect(0, 0, P, P);
  g.setTransform(a, b, c, d, P / 2 - (a * px + c * pz), P / 2 - (b * px + d * pz));
  if (z0 < COAST.beach0) { g.fillStyle = '#f4e6bb'; g.fillRect(x0, z0, x1 - x0, COAST.beach0 - z0); g.fillStyle = '#a5d3e8'; g.fillRect(x0, z0, x1 - x0, COAST.shore - z0); }
  for (const f of MDX.flat) { if (f[1] > x1 || f[1] + f[3] < x0 || f[2] > z1 || f[2] + f[4] < z0) continue; g.fillStyle = FCOL[f[0]] || '#c3dc9f';
    if (f[7]) { g.beginPath(); g.arc(f[1] + f[3] / 2, f[2] + f[4] / 2, f[3] / 2, 0, 7); g.fill(); } else g.fillRect(f[1], f[2], f[3], f[4]); }
  const rd = (e, col) => { g.fillStyle = col; for (const r of MDX.roads) { const rx = r[2] - r[0] / 2, rz = r[3] - r[1] / 2; if (rx > x1 || rx + r[0] < x0 || rz > z1 || rz + r[1] < z0) continue; g.fillRect(rx - e, rz - e, r[0] + 2 * e, r[1] + 2 * e); } };
  rd(1.6, '#bfb49a'); rd(0, '#fffdf6');
  g.fillStyle = '#ead7ae'; for (const q of MDX.places) { if (q[1] > x1 || q[1] + q[3] < x0 || q[2] > z1 || q[2] + q[4] < z0) continue; g.fillRect(q[1], q[2], q[3], q[4]); }
  g.fillStyle = '#c9744f'; for (const h of homePts) { if (h[0] < x0 || h[0] > x1 || h[1] < z0 || h[1] > z1) continue; g.fillRect(h[0] - 2.2, h[1] - 2.2, 4.4, 4.4); }
  if (meHome) { g.fillStyle = '#2e9c8a'; g.beginPath(); g.arc(meHome.x, meHome.z, 6, 0, 7); g.fill(); }
  g.setTransform(1, 0, 0, 1, 0, 0); const m = P / 2, u = P / 92;   // you: a gold arrow in the middle, pointing where you face
  g.beginPath(); g.moveTo(m, m - 9 * u); g.lineTo(m + 7 * u, m + 7 * u); g.lineTo(m, m + 3.5 * u); g.lineTo(m - 7 * u, m + 7 * u); g.closePath(); g.fillStyle = '#FFC446'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = '#2B2420'; g.stroke();
  const rr = W / 2 - 11; nEl.style.transform = `translate(${(W / 2 - 9 - sy * rr).toFixed(1)}px,${(W / 2 - 9 + cy * rr).toFixed(1)}px)`; }   // north (towards the sea) on the rim
// --- where you are: the same names as the map (places, markets, the beach); nothing new is named here
const MKT = [['m', 'Market'], ['se', 'New Market'], ['beach', 'Beach shops']].map(([kk, t]) => { const l = MDX.slots.filter(q => q[2] === kk); return l.length ? { t, l, x: l[0][0], z: l[0][1] } : null; }).filter(Boolean);   // shop spots (Market 1-24 ring round the plaza, New Market, Beach shops); the bus stops at spot 1
const placeAt = (x, z) => MDX.places.find(q => q[0] && x > q[1] && x < q[1] + q[3] && z > q[2] && z < q[2] + q[4]);
function whereNow() { const q = placeAt(px, pz); if (q) return q[0]; if (pz < COAST.beach0 + 8) return 'Vinland Beach';
  for (const m of MKT) if (m.l.some(q => Math.hypot(q[0] - px, q[1] - pz) < 14)) return m.t; if (((px > 395 && px < 545) || (Math.abs(px) < 12 && pz > -582 && pz < -286)) && decked(px, pz)) return 'On a bridge'; /* only over the river or the canal */ return ''; }
let where = '';
// --- today's tasks: 4 a day from a small list, each one something you can really do in the game today. Ticked here, saved on this phone.
let sitting = null, wavedNear = false, photoTaken = false, visitedHome = false;
const TASKS = { plaza: ["Walk to Citizens' Plaza", () => where === "Citizens' Plaza", 'Menu, then Free bus to Citizens\' Plaza'], drive: ['Take a drive', () => driving, 'Walk to a road and tap the car button'],
  beach: ['Walk down to the beach', () => !driving && pz < COAST.beach0 + 2, 'Menu, then Free bus to Beach shops, and walk to the sand'], bridge: ['Cross the river on a bridge', () => px > 395 && px < 545 && decked(px, pz), 'The river is east of town: drive there and over a bridge'],
  bench: ['Sit on a bench', () => !!sitting, 'Walk right up to a bench: the big button turns into Sit'], wave: ['Wave to a citizen', () => wavedNear, 'Walk up to someone: the big button says Wave to @name'],
  market: ['Visit the Market', () => where === 'Market', 'Menu, then Free bus to Market'], photo: ['Take a photo', () => photoTaken, 'Tap the camera button'], home: ['Find a home and visit it', () => visitedHome, 'Menu, then type an Instagram name'],
  jump: ['Jump 3 times', () => jumps >= 3, 'Tap the jump button (space bar on a laptop)'] };
const NTASK = 6;
const dayKey = new Date().toLocaleDateString('en-CA');
let TD = LS.get('vin_today'); if (!TD || TD.d !== dayKey || !Array.isArray(TD.list)) { const ids = Object.keys(TASKS); let h = hashS(dayKey);
  for (let i = ids.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  TD = { d: dayKey, list: LS.get('vin_seen') ? ids.slice(0, NTASK) : ['plaza', 'bench', 'wave', 'jump', 'drive', 'photo'], done: [] }; LS.set('vin_today', TD); LS.set('vin_seen', 1); }
if (TD.list.length < NTASK) { for (const id of Object.keys(TASKS)) if (TD.list.length < NTASK && !TD.list.includes(id)) TD.list.push(id); LS.set('vin_today', TD); }   /* 28 Nov: 6 a day (was 4) */
const todayEl = $('czToday'), tasksEl = $('czTasks');
function renderTasks(fresh) { tasksEl.textContent = ''; [...TD.list.filter(id => !TD.done.includes(id)), ...TD.list.filter(id => TD.done.includes(id))].forEach(id => { const t = TASKS[id]; if (!t) return; const li = document.createElement('li'), sp = document.createElement('span'); sp.textContent = t[0]; li.appendChild(sp);
  li.title = t[2] || ''; li.onclick = () => toast(t[2] || t[0]); if (TD.done.includes(id)) li.className = 'ok' + (id === fresh ? ' new' : ''); tasksEl.appendChild(li); });   /* not done first; tap a task for how to do it */
  $('czTodayN').textContent = TD.done.length + ' of ' + TD.list.length + ' done'; }
renderTasks();
const setFold = f => { todayEl.classList.toggle('fold', f); $('czTodayH').setAttribute('aria-expanded', !f); };
setFold(LS.get('vin_fold') ?? (TOUCH && innerHeight > innerWidth));
$('czTodayH').onclick = () => { const f = !todayEl.classList.contains('fold'); setFold(f); LS.set('vin_fold', f); };
function checkTasks() { for (const id of TD.list) { if (TD.done.includes(id) || !TASKS[id] || !TASKS[id][1]()) continue; TD.done.push(id); LS.set('vin_today', TD); renderTasks(id);
  toast(TD.done.length === TD.list.length ? 'All done for today! New tasks tomorrow 🌙' : '✓ ' + TASKS[id][0]); break; } }
// --- you and the menu name: the home you found for yourself (saved on this phone, no login yet)
let meName = LS.get('vin_me'), meHome = null;
const homeOf = u => { u = String(u || '').trim().replace(/^@/, '').toLowerCase(); return u ? homes.find(h => h.status === 'active' && (h.user || '').toLowerCase() === u) : null; };
function showMe() { meHome = homeOf(meName); if (!meHome) meName = null; $('czMeName').textContent = meName ? '@' + meHome.user : 'Find your home'; $('czFindT').textContent = meName ? 'Find a friend\'s home' : 'Find your home'; renderBus(); }
// --- the big button: what you can do right here
const benches = []; try { const bp = new T.Vector3(), bq = new T.Quaternion(), bs = new T.Vector3(); (LIFE.mats && LIFE.mats.bench || []).forEach(m => { m.decompose(bp, bq, bs); benches.push({ x: bp.x, z: bp.z, ry: new T.Euler().setFromQuaternion(bq, 'YXZ').y }); }); } catch (e) {}
try { const bp = new T.Vector3(), bq = new T.Quaternion(), bs = new T.Vector3(), seen = new Set(benches.map(b => Math.round(b.x) + ',' + Math.round(b.z)));   /* 28 Nov (Dev: "I can't sit here", beach bench): every bench the map built, not only the street ones */
  (typeof BENCHES !== 'undefined' ? BENCHES : []).forEach(g => { g.updateWorldMatrix(true, false); g.matrixWorld.decompose(bp, bq, bs); const k = Math.round(bp.x) + ',' + Math.round(bp.z); if (seen.has(k)) return; seen.add(k); benches.push({ x: bp.x, z: bp.z, ry: new T.Euler().setFromQuaternion(bq, 'YXZ').y }); }); } catch (e) {}
const nearBench = () => { let b = null, bd = 3.6; for (const q of benches) { const d = Math.hypot(q.x - px, q.z - pz); if (d < bd && ![...placed.keys()].some(sp => sp.pose === 'sit' && Math.hypot(sp.x - q.x, sp.z - q.z) < 0.5)) { bd = d; b = q; } } return b; };
function nearPerson() { let best = null, bd = 5; for (const [sp, c] of placed) { const p = c.root.position, d = Math.hypot(p.x - px, p.z - pz); if (d < bd) { bd = d; best = { name: sp.user, c, sp }; } }
  for (const w of walkersK) { if (!w.c) continue; const p = w.c.root.position, d = Math.hypot(p.x - px, p.z - pz); if (d < bd) { bd = d; best = { name: w.user, c: null }; } } return best; }
let act = ['wave', 'Wave', ''], actK = '', actT = 0;
function pickAct() { if (driving) return ['out', 'Get out', 'of the car']; if (sitting) return ['stand', 'Stand up', ''];
  const b = nearBench(); if (b) return ['sit', 'Sit', 'on the bench', b]; const p = nearPerson(); return p ? ['wave', 'Wave', 'to @' + p.name, p] : ['wave', 'Wave', '']; }
function showAct() { const k = act[0] + act[2]; if (k === actK) return; actK = k; $('czActL').textContent = act[1]; $('czActS').textContent = act[2]; $('czAct').setAttribute('aria-label', (act[1] + ' ' + act[2]).trim()); }
function sitDown(b) { sitting = b; px = b.x; pz = b.z; me.root.rotation.y = b.ry; me.busy = 0; me.play('sit'); }
function standUp() { const b = sitting; sitting = null; if (!b) return; const f = findFree(b.x + Math.sin(b.ry) * 1.1, b.z + Math.cos(b.ry) * 1.1); px = f[0]; pz = f[1]; me.play('idle'); }
function doAct() { act = pickAct(); const [kind, , , o] = act;
  if (kind === 'out') leaveCar(); else if (kind === 'stand') standUp(); else if (kind === 'sit') sitDown(o);
  else { me.once('emote-yes'); if (o) { const p = o.c ? o.c.root.position : null; if (p) me.root.rotation.y = Math.atan2(p.x - px, p.z - pz);
      wavedNear = true; if (o.c && o.c.busy <= 0) { setTimeout(() => o.c.once('emote-yes'), 450); toast('@' + o.name + ' waves back 👋'); } } }
  actT = 0; }
$('czAct').onclick = doAct;
// --- car button (section 6e does the driving)
function hudCar(on) { driveBtn.innerHTML = (on ? IC.walk : IC.car) + '<kbd>C</kbd>'; driveBtn.setAttribute('aria-label', on ? 'Get out of the car' : 'Drive a car'); driveBtn.setAttribute('aria-pressed', on); if (on && sitting) standUp(); actT = 0; }
// --- photo: the 3D picture plus a small Vinland caption, then share (phones) or save (laptops)
function photo() { try { R3.render(S3, CAM); const src = R3.domElement, w = src.width, h = src.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(src, 0, 0);
    const fs = Math.round(Math.max(14, h * 0.032)), txt = 'Life in Vinland · @buildacountry'; g.font = `700 ${fs}px Poppins, system-ui, sans-serif`; const tw = g.measureText(txt).width, pad = fs * 0.7, bx = fs, by = h - fs * 2.6;
    g.fillStyle = 'rgba(251,246,236,.94)'; g.beginPath(); g.roundRect ? g.roundRect(bx, by, tw + pad * 2, fs * 1.8, fs * 0.9) : g.rect(bx, by, tw + pad * 2, fs * 1.8); g.fill(); g.fillStyle = '#2B2420'; g.textBaseline = 'middle'; g.fillText(txt, bx + pad, by + fs * 0.92);
    const fl = $('czFlash'); fl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => fl.classList.remove('on')));
    cv.toBlob(bl => { if (!bl) return; const file = typeof File === 'function' ? new File([bl], 'vinland.jpg', { type: 'image/jpeg' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(() => {});
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'vinland.jpg'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast('Photo saved'); } }, 'image/jpeg', 0.9);
    photoTaken = true; } catch (e) { toast('Could not take a photo here'); } }
$('czPhoto').onclick = photo;
// --- menu: find a home, free bus, time of day
const menuEl = $('czMenu'); let menuFor = '';
function openMenu(focus) { menuEl.hidden = false; $('czFindMsg').textContent = ''; for (const k in keys) keys[k] = false; if (focus) setTimeout(() => $('czFindI').focus(), 60); else $('czMenuX').focus(); }
const closeMenu = () => { menuEl.hidden = true; $('czFindI').blur(); };
$('czMe').onclick = () => openMenu(!meName); $('czMenuX').onclick = closeMenu; menuEl.addEventListener('pointerdown', e => { if (e.target === menuEl) closeMenu(); });
function busTo(x, z, label, then) { closeMenu(); if (driving) leaveCar(); if (sitting) standUp(); const fd = $('czFade'); fd.classList.add('on');
  setTimeout(() => { const f = findFree(x, z); px = f[0]; pz = f[1]; footY = floorAt(px, pz, GND); stream(px, pz, true); streamNature(px, pz, true); refreshPeople(); first = true; mapK = '';
    setTimeout(() => { fd.classList.remove('on'); toast(label); if (then) then(); }, 120); }, RM ? 0 : 360); }
const roadNear = (x, z) => { let best = [x, z], bd = 1e9; for (const r of MDX.roads) { const qx = Math.max(r[2] - r[0] / 2, Math.min(r[2] + r[0] / 2, x)), qz = Math.max(r[3] - r[1] / 2, Math.min(r[3] + r[1] / 2, z)), d = Math.hypot(qx - x, qz - z); if (d < bd) { bd = d; best = [qx, qz]; } } return best; };
const STOPS = [["Citizens' Plaza", "Citizens' Plaza"], ['Market', 'Market'], ['New Market', 'New Market'], ['Beach shops', 'Beach shops'], ['Mall', 'Mall'], ['Hospital', 'Hospital'], ['School', 'School'], ['Parliament', 'Parliament'], ['Vinland National Stadium', 'Stadium'], ['Beach Resort', 'Beach Resort']]
  .map(([n, t]) => { const q = MDX.places.find(q => q[0] === n); if (q) return { t, x: q[1] + q[3] / 2, z: q[2] + q[4] / 2, place: n }; const m = MKT.find(m => m.t === n); return m ? { t, x: m.x, z: m.z } : null; }).filter(Boolean);
function renderBus() { const box = $('czBus'); box.textContent = ''; const list = (meHome ? [{ t: 'My home', home: meHome }] : []).concat(STOPS);
  list.forEach(s => { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = s.t;
    bt.onclick = () => { if (s.home) return busTo(s.home.x, s.home.z + 9, 'Welcome home, @' + s.home.user); const p = s.place === "Citizens' Plaza" ? [0, 32] : roadNear(s.x, s.z); busTo(p[0], p[1], 'Free bus: ' + s.t); };
    box.appendChild(bt); }); }
$('czFind').onsubmit = e => { e.preventDefault(); const raw = $('czFindI').value.trim().replace(/^@/, ''), h = homeOf(raw), msg = $('czFindMsg');
  if (!raw) { msg.textContent = 'Type an Instagram name, like your own.'; return; }
  if (!h) { msg.textContent = 'No home for @' + raw.slice(0, 30) + ' yet. Follow @buildacountry and comment HOME to get yours.'; return; }
  const mine = !meName; if (mine) { meName = h.user; LS.set('vin_me', h.user); showMe(); }
  $('czFindI').value = ''; busTo(h.x, h.z + 9, mine ? 'Welcome home, @' + h.user : "This is @" + h.user + "'s home", () => { visitedHome = true; }); };
showMe();
// --- keys on laptops: E action, C car, P photo, M menu, Esc closes
addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Escape') closeMenu(); return; } if (e.repeat) return; const k = e.key.toLowerCase();
  if (k === 'escape' && !menuEl.hidden) closeMenu(); else if (k === 'm') menuEl.hidden ? openMenu(!meName) : closeMenu(); else if (!menuEl.hidden) return; else if (k === ' ') { e.preventDefault(); jump(); } else if (k === 'e' || (k === 'enter' && (e.target === document.body || e.target === R3.domElement))) { e.preventDefault(); doAct(); } else if (k === 'c') driveBtn.click(); else if (k === 'p') photo(); });
// --- phones held upright: a gentle hint to turn sideways (the game still works upright)
const turnEl = $('czTurn'); let turnT = 0;
function turnHint() { const up = TOUCH && innerHeight > innerWidth * 1.15; clearTimeout(turnT); turnEl.classList.toggle('off', !up); if (up) turnT = setTimeout(() => turnEl.classList.add('off'), 6000); }
addEventListener('resize', () => { turnHint(); mapK = ''; });
let hudT = 0, whereT = 0;
// --- jump (Dev, 28 Nov: "add jump, it gets stuck sometimes"): a hop that clears benches and kerbs; if you land somewhere you can't stand, you step out to the nearest free spot
let jumpT = 0, jumpD = 0, jumps = 0; const JUMP = 0.55;
function jump() { if (driving || jumpT > 0) return; if (sitting) standUp(); jumpT = JUMP; jumpD = 0; jumps++; me.busy = 0; }
function land() { jumpT = 0; if (!walkFree(px, pz) || wetAt(px, pz)) { const a = me.root.rotation.y, f = findFree(px + Math.sin(a) * 0.8, pz + Math.cos(a) * 0.8); px = f[0]; pz = f[1]; } }
const jumpY = () => { if (jumpT <= 0) return 0; const t = 1 - jumpT / JUMP; return 3.6 * t * (1 - t); };
$('czJump').onclick = jump;
function hudStep(dt) { mapT -= dt; if (mapT <= 0) { mapT = 0.12; drawMap(); }
  whereT -= dt; if (whereT <= 0) { whereT = 0.5; const w = whereNow(); if (w !== where) { where = w; whereEl.textContent = w; } if (meHome && Math.hypot(meHome.x - px, meHome.z - pz) < 14) visitedHome = true; }
  hudT -= dt; if (hudT <= 0) { hudT = 0.25; checkTasks(); }
  actT -= dt; if (actT <= 0) { actT = 0.2; act = pickAct(); showAct(); } }

// ---------- 7. first squares, then the loop ----------
lt.textContent = 'building the streets around you';
await wait(20); stream(px, pz, true); streamNature(px, pz, true);
const clock = new T.Clock(), camPos = new T.Vector3(), camLook = new T.Vector3(); let frames = 0, fpsT = 0, first = true, hidden = false;
let stuckT = 0, boxK = '', boxV = false, boxT = 0, footY = GND, carY = GND;   // footY / carY: the floor you (or the car) stand on, smoothed
function boxedIn(x, z) {   // 27 Nov: true when there is no way out within 2.5 m (0.25 m steps, same rules as walking)
  const key = Math.round(x * 4) + ',' + Math.round(z * 4), now = performance.now(); if (key === boxK && now - boxT < 300) return boxV; boxK = key; boxT = now;
  const S = 0.25, N = 12, wet = (i, j) => wetAt(x + i * S, z + j * S), seen = new Set(['0,0']), q = [[0, 0]];
  for (let h = 0; h < q.length; h++) { const [i, j] = q[h]; if (Math.hypot(i, j) * S >= 2.5) return boxV = false;
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { const k = a + ',' + b; if (seen.has(k) || Math.abs(a) > N || Math.abs(b) > N) continue; seen.add(k); if (walkFree(x + a * S, z + b * S) && !(wet(a, b) && !wet(i, j))) q.push([a, b]); } }
  return boxV = true; }
function sidestep(a, st, ok) {   // 27 Nov: blocked head-on by something small: if there is a way past within 1 m to one side, step that way (the nearer side first)
  const dx = Math.sin(a), dz = Math.cos(a), rx = dz, rz = -dx;
  for (let o = 0.25; o <= 1.001; o += 0.25) for (const sg of [1, -1]) { let k = 0.25;
    for (; k <= o + 1e-6; k += 0.25) if (!ok(px + rx * sg * k, pz + rz * sg * k)) break;
    if (k <= o + 1e-6) continue;   // something in the way on that side
    const ex = px + rx * sg * o, ez = pz + rz * sg * o; if (!ok(ex + dx * 0.25, ez + dz * 0.25) || !ok(ex + dx * 0.5, ez + dz * 0.5)) continue;   // no way past there
    const m = Math.min(st * 0.8, o), qx = px + rx * sg * m, qz = pz + rz * sg * m; if (ok(qx, qz)) return [qx, qz]; }
  return null; }
document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (!hidden) { clock.getDelta(); requestAnimationFrame(frame); } });
function frame() { if (hidden) return; requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const ix = joy.x + ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0), iz = joy.y + ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0), mag = Math.min(1, Math.hypot(ix, iz));
  if (sitting && mag > 0.1 && menuEl.hidden) standUp();   // 28 Nov: push the stick to stand up from a bench
  if (me.busy > 0) me.busy -= dt;
  if (jumpT > 0 && (jumpT -= dt) <= 0) land();
  if (driving) stepCar(dt, ix, iz);
  else if (mag > 0.1 && !sitting) { me.busy = 0; const run = running || keys.shift, a = Math.atan2(ix, iz) + yaw + Math.PI, s = (run ? 9 : 4.6) * mag, nx = px + Math.sin(a) * s * dt, nz = pz + Math.cos(a) * s * dt;
    const okAt = jumpT > 0 && jumpD < 1.6 ? (x, z) => x > BUILT.x0 && x < BUILT.x1 && z > COAST.shore + 6 && z < BUILT.z1 : !wetAt(px, pz) ? (x, z) => walkFree(x, z) && !wetAt(x, z) : walkFree;   // no walking on water (if you are somehow in it, you can walk out)
    const st = s * dt, ax = Math.abs(nx - px), az = Math.abs(nz - pz); let go = okAt(nx, nz) ? [nx, nz] : null;
    if (!go) { const sx = ax > 0.02 * st && okAt(nx, pz), sz = az > 0.02 * st && okAt(px, nz);   // slide along the wall
      go = sx && ax >= 0.4 * st ? [nx, pz] : sz && az >= 0.4 * st ? [px, nz] : sidestep(a, st, okAt) || (sx ? [nx, pz] : sz ? [px, nz] : null); }   // 27 Nov: walking straight into a lamp post, a bin or a corner: step round it
    if (go) { if (jumpT > 0) jumpD += Math.hypot(go[0] - px, go[1] - pz); px = go[0]; pz = go[1]; stuckT = 0; }
    else if ((stuckT += dt) > 0.5 && boxedIn(px, pz) && (walkFree(nx, nz) || !walkFree(px, pz))) { px = nx; pz = nz; }   // 27 Nov: never stuck. Pushing for half a second with no way out from here: he walks out
    let d = a - me.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); me.root.rotation.y += d * Math.min(1, dt * 12); me.play(run ? 'sprint' : 'walk'); } else if (!sitting && !(me.busy > 0)) me.play('idle');
  if (!driving) { footY += (floorAt(px, pz, footY) - footY) * Math.min(1, dt * 12); me.root.position.set(px, (sitting ? 0.22 : 0.12) + Math.max(0, footY - GND) + jumpY(), pz); me.step(dt); }
  stream(px, pz, false); streamNature(px, pz, false);
  const dist = (innerWidth > innerHeight ? (FARV ? LDIST : 24) : 30) * (driving ? 1.25 : 1), cp = Math.cos(pitch);
  const rise = Math.max(0, (driving ? carY : footY) - GND); camPos.set(px - Math.sin(yaw) * dist * cp, 1.5 + rise + Math.sin(pitch) * dist, pz - Math.cos(yaw) * dist * cp);
  if (first) { CAM.position.copy(camPos); first = false; } else CAM.position.lerp(camPos, Math.min(1, dt * 5));
  camLook.set(px, 1.6 + rise, pz); CAM.lookAt(camLook);
  sky.position.set(px, 0, pz); stars.position.copy(sky.position); disc.position.set(px + SUND.x * 520, SUND.y * 520, pz + SUND.z * 520);
  sun.position.set(px + SUND.x * 170, SUND.y * 170, pz + SUND.z * 170); sun.target.position.set(px, 0, pz); sun.target.updateMatrixWorld();
  peopleT -= dt; if (peopleT <= 0) { peopleT = 1; refreshPeople(); } stepPeople(dt);
  drawSmoke(dt); lifeT += dt; WT.value = WT.fix != null ? WT.fix : RM ? 0 : lifeT % 3600; if (!RM) stepLife(dt, lifeT); else buntU.uT.value = 0;
  R3.render(S3, CAM);
  drawTags(); drawPeopleTags(); hudStep(dt);
  frames++; fpsT += dt; if (fpsT > 1) { $('czFps').textContent = Math.round(frames / fpsT) + ' fps · ' + R3.info.render.calls + ' draws · ' + Math.round(R3.info.render.triangles / 1000) + 'k tris · ' + [...tiles.values()].filter(Boolean).length + ' squares'; frames = 0; fpsT = 0; } }
$('czLoad').style.opacity = 0; setTimeout(() => $('czLoad').remove(), 450);
CZ.phase = 'running'; turnHint(); drawMap(true);
frame();
CZ.dbg = () => JSON.stringify({ kinds: (() => { const k = {}; homes.forEach(h => { const key = String(h.kind) + (h.flat ? '/flat' : '') + (h.fp ? '/fp' : '') + (h.villa ? '/villa' : ''); k[key] = (k[key] || 0) + 1; }); return k; })(), looks: Object.keys(window.VLOOKS || {}).length, labelled: labelled.length, chimneys: chimneys.length, nearCh: nearCh.length, smoke: smoke.count, RM, homesActive: homes.filter(h => h.status === 'active').length, withLp: homes.filter(h => h.lp && h.el).length, sample: homes.slice(0, 3).map(h => [h.status, !!h.lp, !!h.el, h.flat ? 1 : 0, h.kind, h.villa ? 1 : 0]) });
CZ.inspect = (x, z) => { const k = tkey(x, z), list = tilePlaces.get(k) || [], pieces = chunks.get(k) || []; const bySize = {}, byB = {}; let pl = 0, pc = 0;
  for (const i of list) { const S = shapes[PL.s[i]], q = i * 12, m = PL.m, sc = Math.sqrt(m[q] ** 2 + m[q + 1] ** 2 + m[q + 2] ** 2), r = S.r * sc, bin = r < 0.5 ? '<0.5' : r < 1 ? '<1' : r < 2 ? '<2' : r < 5 ? '<5' : '5+'; bySize[bin] = (bySize[bin] || 0) + S.n / 3; pl += S.n / 3; }
  const pcs = pieces.map(p => [p.b, p.P.length / 9]); pieces.forEach(p => { pc += p.P.length / 9; byB[p.b] = (byB[p.b] || 0) + p.P.length / 9; });
  const topShapes = {}; for (const i of list) { const id = PL.s[i]; topShapes[id] = (topShapes[id] || 0) + shapes[id].n / 3; }
  const top = Object.entries(topShapes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, t]) => id + ':' + Math.round(t) + 't/' + shapes[id].n / 3 + 'per r' + shapes[id].r.toFixed(1));
  return JSON.stringify({ placeTris: Math.round(pl), pieceTris: Math.round(pc), places: list.length, bySize, piecesByBucket: byB, top }); };
CZ.api = { hud: () => ({ act: act.slice(0, 3), where, tasks: TD, me: meName, sitting: !!sitting, benches: benches.length, stops: STOPS.map(s => s.t) }), act: () => doAct(), jump: () => jump(), bench: i => benches[i] && [Math.round(benches[i].x * 10) / 10, Math.round(benches[i].z * 10) / 10, Math.round(benches[i].ry * 100) / 100], bus: i => STOPS[i] && $('czBus').children[i + (meHome ? 1 : 0)].click(), find: u => { $('czFindI').value = u; $('czFind').requestSubmit(); }, menu: o => o ? openMenu(false) : closeMenu(), pos: () => [Math.round(px * 10) / 10, Math.round(pz * 10) / 10], probe: (x, z) => (wetAt(x, z) ? 'W' : '') + (walkFree(x, z) ? '' : 'X') + (CZ.greenAt && CZ.greenAt(x, z) ? 'g' : '') + '.', pitch: v => { pitch = v; first = true; }, cam: (f, d) => { LFOV = f; LDIST = d; CAM.fov = camFov(); CAM.updateProjectionMatrix(); first = true; }, drive: () => enterCar(), out: () => leaveCar(), car: () => [Math.round(CAR.x * 10) / 10, Math.round(CAR.z * 10) / 10, Math.round(CAR.a * 100) / 100, Math.round(CAR.v * 10) / 10, Math.round(carY * 100)], carAt: (x, z, a) => { CAR.x = x; CAR.z = z; CAR.a = a; CAR.v = 0; }, keys, floor: (x, z) => { const f = fget(x, z); return f ? [f[0], f[1], f[2], Math.round(floorAt(x, z, footY) * 100)] : null; }, foot: () => Math.round(footY * 100), home: u => { const h = homes.find(h => h.user === u || h.n === u); return h ? [Math.round(h.x), Math.round(h.z), h.n] : null; }, go: (x, z, y) => { px = x; pz = z; if (y != null) yaw = y; first = true; stream(px, pz, true); streamNature(px, pz, true); }, setTime: h => { fixedHour = h; tick(); }, wt: v => { WT.fix = v; }, renderer: R3, tiles, scene: S3 };
})().catch(e => { console.error('cozy', e); const l = document.getElementById('czLt'); if (l) l.textContent = 'Could not build: ' + e.message; });
