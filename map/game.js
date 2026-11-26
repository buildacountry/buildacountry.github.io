// LIFE IN VINLAND, GAME LAYER (26 Nov, Dev OK'd the plan): /map/?life&game (the /world/ page sends you here).
// Runs INSIDE the real map, after life.js and kenney/kenney.js, so the world is exactly our map: same homes, plaza, shops, roads.
// This file only adds: no cars (Dev, 26 Nov: "remove cars"), three little troubles to solve, people on benches, birds and clouds,
// landscape on phones. It never builds anything on the map's land.
(async () => {
if (window.VG) return; const G = window.VG = { helped: 0 };
const wait = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 150 && !(window.KEN && KEN.makeCitizen && WALK.on); i++) await wait(200);
if (!(window.KEN && KEN.makeCitizen)) { console.error('game: Kenney citizens did not load'); return; }
const T = THREE, Kit = window.VinlandKit, UPV2 = new T.Vector3(0, 1, 0), M4g = new T.Matrix4(), V3g = new T.Vector3(), Qg = new T.Quaternion(), ONEg = new T.Vector3(1, 1, 1);
let sd = 2611; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;

// ---------- 1. no cars: driving and parked (scooters and autos too) ----------
const CAR_KINDS = ['carHatch', 'carSedan', 'carSUV', 'carTaxi', 'carVan', 'carPickup', 'carSports', 'scooter', 'autoRickshaw'];
for (let i = 0; i < 50 && !LIFE.on; i++) await wait(200);
if (LIFE.on) { LIFE.cars.forEach(c => { if (c.meshes[0] && c.meshes[0].parent) c.meshes[0].parent.visible = false; }); LIFE.cars.length = 0;
  CAR_KINDS.forEach(k => { if (LIFE.inst && LIFE.inst[k]) LIFE.inst[k].visible = false; }); }
{ const d = document.getElementById('driveBtn'); if (d) d.hidden = true; }

// ---------- 1b. phones: small pieces (fence posts, flowers, bins: thousands of them) are kept only near you; homes and big
//      buildings keep life.js's full distance. Measured 26 Nov: 1.3M -> far fewer triangles in the plaza view.
if (window.VLIFE && VLIFE.lite && VLIFE.inst) {
  // the game sees a street, not the whole country: a nearer horizon with the haze brought in, so the edge never shows
  const GFAR = 170; camera.far = GFAR + 40; camera.updateProjectionMatrix(); if (scene.fog) { scene.fog.near = 55; scene.fog.far = GFAR; }
  const mlist = [], mine = new Set(); scene.updateMatrixWorld(true);
  scene.traverse(o => { if (!(o.isMesh || o.isLineSegments || o.isPoints) || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry) return; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere; if (!bs || !isFinite(bs.radius)) return;
    const c = bs.center.clone().applyMatrix4(o.matrixWorld), r = bs.radius * o.matrixWorld.getMaxScaleOnAxis(); if (r > 150) return; const e = { o, x: c.x, z: c.z, r };
    if (!o.visible && Math.hypot(c.x - WALK.x, c.z - WALK.z) - r > 250) mine.add(o);   // hidden by life.js for being far: ours to manage now. Anything the map hid for its own reasons stays as it is.
    mlist.push(e); });
  VLIFE.cull = () => { const px = WALK.x, pz = WALK.z; mlist.forEach(e => { const far = Math.hypot(e.x - px, e.z - pz) - e.r > GFAR;
    if (far && e.o.visible) { e.o.visible = false; mine.add(e.o); } else if (!far && mine.has(e.o)) { e.o.visible = true; mine.delete(e.o); } }); };
  VLIFE.cull();
  const FAR = GFAR, ring = e => { const g = e.o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const r = g.boundingSphere ? g.boundingSphere.radius : 10; return r < 2.5 ? 95 : r < 8 ? 160 : FAR * 0.9; };
  VLIFE.inst.forEach(e => { e.R2 = ring(e) ** 2; });
  VLIFE.cullI = () => { const px = WALK.x, pz = WALK.z;
    VLIFE.inst.forEach(e => { if (e.dyn) return; const a = e.o.instanceMatrix.array; let k = 0;
      for (let i = 0; i < e.n; i++) { const dx = e.m[i * 16 + 12] - px, dz = e.m[i * 16 + 14] - pz; if (dx * dx + dz * dz > e.R2) continue;
        if (e.m[i * 16] === 0 && e.m[i * 16 + 5] === 0 && e.m[i * 16 + 10] === 0) continue;   // zero-size placeholders (things the map shows only sometimes): skip
        a.set(e.m.subarray(i * 16, i * 16 + 16), k * 16); if (e.c) e.o.instanceColor.array.set(e.c.subarray(i * 3, i * 3 + 3), k * 3); k++; }
      e.packed = true; e.o.count = k; e.o.visible = k > 0; e.o.instanceMatrix.needsUpdate = true; if (e.c) e.o.instanceColor.needsUpdate = true; }); };   // empty = not drawn at all
  const bigs = []; scene.traverse(o => { if ((o.isMesh || o.isLineSegments) && !o.isInstancedMesh && o.geometry && o.geometry.boundingSphere && o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 150) bigs.push(o); });
  const prevBig = VLIFE.cullBig; VLIFE.cullBig = () => { prevBig(); bigs.forEach(o => { const ix = o.geometry.index; if (ix) o.visible = ix.count > 0; }); };   // a district with nothing near you: no draw call
  VLIFE.cullI(); VLIFE.cullBig();
}

// ---------- 2. the screen: helped counter, the trouble card, the action button, landscape on phones ----------
const css = document.createElement('style'); css.textContent = `
#gTags { position: fixed; inset: 0; pointer-events: none; z-index: 7; overflow: hidden; }
.gt { position: absolute; left: 0; top: 0; white-space: nowrap; font: 700 12px/1.2 Poppins, system-ui, sans-serif; background: rgba(255,248,239,.92); color: #14233f; border-radius: 999px; padding: 2px 9px; will-change: transform; }
.gt.say { white-space: normal; max-width: 200px; text-align: center; border-radius: 12px; padding: 5px 10px; font-weight: 600; font-size: 13px; background: #fff; box-shadow: 0 2px 0 rgba(0,0,0,.15); }
.gt.bang { background: #ffd447; font-size: 19px; padding: 0 10px; border-radius: 10px; box-shadow: 0 2px 0 #a07510; }
.gt.goal { background: #e8473c; color: #fff; font-size: 15px; }
#gQuest { position: fixed; left: 50%; transform: translateX(-50%); top: calc(10px + env(safe-area-inset-top, 0px)); max-width: min(320px, 50vw); background: #fff8ef; color: #14233f; border-left: 4px solid #e8473c; border-radius: 10px; padding: 7px 12px; font: 600 .88rem/1.25 Poppins, system-ui, sans-serif; z-index: 9; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
#gQuest b { color: #c8553d; }
#gAct { position: fixed; right: calc(154px + env(safe-area-inset-right, 0px)); bottom: calc(28px + env(safe-area-inset-bottom, 0px)); min-width: 104px; height: 54px; padding: 0 18px; border: 0; border-radius: 999px; background: #e8473c; color: #fff; font: 800 1rem Poppins, system-ui, sans-serif; box-shadow: 0 4px 0 #a33a28; z-index: 9; cursor: pointer; }
#gAct:active { transform: translateY(3px); box-shadow: 0 1px 0 #a33a28; }
@media (hover: hover) { #gAct { right: calc(130px + env(safe-area-inset-right, 0px)); } #gAct::after { content: ' (E)'; font-weight: 600; font-size: .8rem; opacity: .8; } }
@media (pointer: coarse) { body.life #walkHud .wemo { bottom: calc(96px + env(safe-area-inset-bottom, 0px)) !important; } }   /* emoji + jump sit just above RUN, clear of the clock and coins */
#gHelped { font: 800 1.2rem/1.3 Poppins, system-ui, sans-serif; color: #ffb3b3; }
#gRotate { position: fixed; inset: 0; z-index: 70; display: none; place-items: center; background: #8fbf62; text-align: center; font: 800 22px/1.3 Poppins, system-ui, sans-serif; color: #14233f; padding: 24px; }
#gRotate small { display: block; font-weight: 600; font-size: 15px; opacity: .8; margin-top: 6px; }
#gRotate i { display: block; width: 64px; height: 104px; border: 6px solid #14233f; border-radius: 14px; margin: 0 auto 18px; animation: gturn 2.4s ease-in-out infinite; }
@keyframes gturn { 0%,20% { transform: rotate(0) } 50%,80% { transform: rotate(-90deg) } 100% { transform: rotate(0) } }
@media (orientation: portrait) and (pointer: coarse) { #gRotate { display: grid; } }
@media (prefers-reduced-motion: reduce) { #gRotate i { animation: none; } }`;
document.head.appendChild(css);
const tagsEl = document.createElement('div'); tagsEl.id = 'gTags'; document.body.appendChild(tagsEl);
const questEl = document.createElement('div'); questEl.id = 'gQuest'; questEl.hidden = true; document.body.appendChild(questEl);
const actBtn = document.createElement('button'); actBtn.id = 'gAct'; actBtn.hidden = true; document.body.appendChild(actBtn);
const rot = document.createElement('div'); rot.id = 'gRotate'; rot.innerHTML = '<div><i></i>Turn your phone sideways<small>Life in Vinland plays in landscape</small></div>'; document.body.appendChild(rot);
{ const top = document.getElementById('lifeTop'); if (top) { const h = document.createElement('div'); h.id = 'gHelped'; top.appendChild(h); } }
const helpedEl = () => document.getElementById('gHelped');
function setHelped() { const e = helpedEl(); if (e) e.textContent = G.helped ? '❤️ ' + G.helped + ' helped' : ''; }
if (PHONE) addEventListener('pointerdown', () => { const el = document.documentElement; if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {}); }, { once: true });
const say = t => walkToast(t);
// a small speed readout (preview only), so Dev can tell us how smooth it is on his phone
const fpsEl = document.createElement('div'); fpsEl.style.cssText = 'position:fixed;left:50%;bottom:4px;transform:translateX(-50%);z-index:9;font:600 11px Poppins,system-ui,sans-serif;background:rgba(255,248,239,.8);color:#14233f;border-radius:999px;padding:2px 9px;pointer-events:none'; document.body.appendChild(fpsEl);
let fpsN = 0, fpsT = performance.now(); (function fl() { fpsN++; const n = performance.now(); if (n - fpsT > 1000) { fpsEl.textContent = Math.round(fpsN * 1000 / (n - fpsT)) + ' fps · ' + renderer.info.render.calls + ' draws'; fpsN = 0; fpsT = n; } requestAnimationFrame(fl); })();

// ---------- 3. people: three neighbours on the plaza, and people sitting on the map's own benches ----------
const anims = c => c.acts;
function once(c, name) { const a = c.acts[name]; if (!a) return; if (c.cur && c.acts[c.cur]) c.acts[c.cur].fadeOut(0.15); a.reset().setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; a.fadeIn(0.15).play(); c.cur = name; c.busy = a.getClip().duration; }
function citizen(seedName, x, z, ry) { const c = KEN.makeCitizen(KEN.lookOf(seedName)); c.root.position.set(x, 0.14, z); c.root.rotation.y = ry; c.busy = 0; return c; }
const spot = (x, z) => nearestFree(x, z);
const NEIGH = [['nbr-cat-7', 'Neighbour', 13, 13, 'cat'], ['nbr-chai-3', 'Chai seller', -13, 13, 'chai'], ['nbr-post-5', 'Postman', 15, -6, 'letter']];
const givers = NEIGH.map(([seed, label, x, z, q]) => { const [px, pz] = spot(x, z), c = citizen(seed, px, pz, Math.atan2(-px, -pz)); return Object.assign(c, { label, quest: q, qstate: 'open' }); });
// benches: the map's own benches (street life). The nearest few get someone sitting on them.
const benches = (LIFE.mats && LIFE.mats.bench || []).map(m => { const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(); m.decompose(p, q, s); return { x: p.x, z: p.z, ry: new T.Euler().setFromQuaternion(q, 'YXZ').y }; });
const SIT_N = PHONE ? 3 : 6, sitters = [];
for (let i = 0; i < SIT_N; i++) { const c = citizen('sitter-' + i, 0, -9999, 0); c.root.visible = false; c.bench = null; sitters.push(c); }
function seatSitters(force) { const px = WALK.x, pz = WALK.z;
  for (const c of sitters) { if (c.keep) continue; if (!force && c.bench && (c.bench.x - px) ** 2 + (c.bench.z - pz) ** 2 < 110 * 110) continue; c.bench = null; c.root.visible = false; }
  const used = new Set(sitters.map(c => c.bench).filter(Boolean));
  const free = benches.filter(b => !used.has(b)).map(b => [b, (b.x - px) ** 2 + (b.z - pz) ** 2]).filter(a => a[1] < 80 * 80).sort((a, b) => a[1] - b[1]);
  for (const c of sitters) { if (c.bench || c.keep || !free.length) continue; const [b] = free.splice(Math.floor(rnd() * Math.min(4, free.length)), 1)[0];
    c.bench = b; c.root.position.set(b.x, 0.2, b.z); c.root.rotation.y = b.ry; c.root.visible = true; c.play('sit', 0); } }
const SAY = ['Namaste!', 'Lovely day in Vinland', 'Did you vote this week?', 'Chai at the plaza?', 'Welcome, neighbour!', 'Have you found your home yet?', 'I love the blossom trees', 'Going to the market', 'Tell your friends: comment HOME!', 'This bench is the best seat in town'];
const speech = new Map();   // citizen -> [text, seconds left]
function speak(c, t, s = 3.2) { speech.set(c, [t, s]); }

// ---------- 4. the little troubles ----------
function bakeOne(key, tint) { if (!Kit || !Kit[key]) return null; const baked = Kit.bake(Kit[key]({})), g = Kit.instances(baked, [new T.Matrix4()], tint ? () => tint : null); g.visible = false; scene.add(g); return g; }
function showAt(g, x, z, ry = 0, s = 1) { if (!g) return; g.children.forEach(m => { if (m.isInstancedMesh) { m.setMatrixAt(0, M4g.compose(V3g.set(x, 0.14, z), Qg.setFromAxisAngle(UPV2, ry), new T.Vector3(s, s, s))); m.instanceMatrix.needsUpdate = true; } else m.visible = false; }); g.visible = true; }
const catG = bakeOne('cat', { fur: '#e8873a' }), postG = bakeOne('postBox');
const parks = (window.VIN_MAPDATA && VIN_MAPDATA.flat || []).filter(f => f[0] === 'g' && f[3] > 10 && f[4] > 10).map(f => ({ x: f[1] + f[3] / 2, z: f[2] + f[4] / 2, f }));
const ROADS_MD = (window.VIN_MAPDATA && VIN_MAPDATA.roads) || [], onRoad = (x, z) => ROADS_MD.some(([w, d, rx, rz]) => Math.abs(x - rx) < w / 2 + 1.5 && Math.abs(z - rz) < d / 2 + 1.5);
function parkSpot(p) { const f = p.f; for (let i = 0; i < 80; i++) { const x = f[1] + 3 + rnd() * (f[3] - 6), z = f[2] + 3 + rnd() * (f[4] - 6); if (freeAt(x, z) && !onRoad(x, z)) return [x, z]; } return spot(p.x, p.z); }   // on the park's grass, never on a road
let active = null, carrying = null;
const Q = {
  cat: { ask: 'My cat Biscuit ran off! She loves the parks. Can you find her?', start(c) { const far = parks.filter(p => { const d = Math.hypot(p.x - c.root.position.x, p.z - c.root.position.z); return d > 50 && d < 320; });
      const p = far.length ? far[Math.floor(rnd() * far.length)] : { x: c.root.position.x + 60, z: c.root.position.z + 40 }; const [x, z] = p.f ? parkSpot(p) : spot(p.x, p.z); c.target = { x, z }; showAt(catG, x, z, rnd() * 6, 1.6); return 'Find <b>Biscuit the cat</b> in a park nearby. Follow the red ▼'; },
    back: c => `Bring Biscuit back to the <b>${c.label}</b> at the plaza`, thanks: 'Biscuit! You found her! Thank you so much!' },
  chai: { ask: 'Someone is sitting on a bench all alone. Could you take them this chai?', start(c) { const px = c.root.position.x, pz = c.root.position.z;
      const b = benches.map(b => [b, Math.hypot(b.x - px, b.z - pz)]).filter(a => a[1] > 30 && a[1] < 150).sort((a, b) => a[1] - b[1])[Math.floor(rnd() * 4)];
      const s = sitters.find(x => !x.keep) || sitters[0]; if (b) { s.bench = b[0]; s.root.position.set(b[0].x, 0.2, b[0].z); s.root.rotation.y = b[0].ry; s.root.visible = true; s.play('sit', 0); } s.keep = true; c.deliverTo = s; carrying = 'chai';
      return 'Take the <b>chai</b> to the person on the bench. Follow the red ▼'; },
    back: c => `Tell the <b>${c.label}</b> the chai arrived`, thanks: 'Garam chai delivered! You are the best.' },
  letter: { ask: 'Please post my letter. It is for the Cup committee!', start(c) { const px = c.root.position.x, pz = c.root.position.z; const [x, z] = spot(px + 30, pz + 22); c.target = { x, z }; showAt(postG, x, z, Math.atan2(px - x, pz - z), 1.3); carrying = 'letter';
      return 'Post the <b>letter</b> in the red postbox. Follow the red ▼'; },
    back: c => `Tell the <b>${c.label}</b> the letter is posted`, thanks: 'Posted! Thank you, neighbour.' }
};
function setQuest(h) { questEl.innerHTML = h || ''; questEl.hidden = !h; const o = document.getElementById('lifeObj'); if (o) o.style.visibility = h ? 'hidden' : ''; }   // one card at a time
let near = null;
function act() { if (!near) return; const { type, c } = near;
  if (type === 'talk') { speak(c, SAY[Math.floor(rnd() * SAY.length)]); return; }
  if (type === 'quest') { const q = Q[c.quest];
    if (c.qstate === 'open' && !active) { active = c; c.qstate = 'doing'; speak(c, q.ask, 5); setQuest(q.start(c)); once(c, 'emote-yes'); }
    else if (c === active && c.qstate === 'return') { c.qstate = 'done'; active = null; carrying = null; speak(c, q.thanks, 4); once(c, 'emote-yes'); G.helped++; setHelped(); setQuest('');
      if (c.quest === 'cat' && catG) catG.visible = false; if (c.quest === 'letter' && postG) postG.visible = false; if (c.deliverTo) { c.deliverTo.keep = false; }
      say('Little trouble solved! ❤️ ' + G.helped + ' helped' + (givers.every(g => g.qstate === 'done') ? '. You helped everyone on the plaza today!' : '')); }
    else if (c.qstate === 'done') speak(c, 'Thanks again, neighbour!', 2.5); else speak(c, 'Finish your other errand first!', 2.5); return; }
  if (type === 'pickcat') { carrying = 'cat'; if (catG) catG.visible = false; active.qstate = 'return'; setQuest(Q.cat.back(active)); say('You picked up Biscuit 🐱'); }
  if (type === 'givechai') { speak(c, 'For me? Thank you!', 3); carrying = null; active.qstate = 'return'; setQuest(Q.chai.back(active)); }
  if (type === 'post') { carrying = null; active.qstate = 'return'; setQuest(Q.letter.back(active)); say('Letter posted ✉️'); } }
actBtn.onclick = act;
addEventListener('keydown', e => { if (WALK.on && (e.key === 'e' || e.key === 'E') && !(e.target.closest && e.target.closest('input,textarea'))) act(); });

// ---------- 5. birds and clouds ----------
const clouds = new T.InstancedMesh(new T.IcosahedronGeometry(7, 0), new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }), 42); clouds.frustumCulled = false; scene.add(clouds);
const cl = []; for (let i = 0; i < 14; i++) { const cx = -320 + rnd() * 640, cz = -320 + rnd() * 640, y = 70 + rnd() * 25; for (let j = 0; j < 3; j++) cl.push([cx + j * 9 - 9, y + rnd() * 3, cz + rnd() * 6, 0.8 + rnd() * 0.6]); }
const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(new Float32Array([-0.9, 0, -0.2, 0, 0, 0.3, 0, 0.12, -0.3, 0.9, 0, -0.2, 0, 0, 0.3, 0, 0.12, -0.3]), 3)); bg.computeVertexNormals();
const birds = new T.InstancedMesh(bg, new T.MeshBasicMaterial({ color: 0x3a3440, side: T.DoubleSide }), 15); birds.frustumCulled = false; scene.add(birds);
const SC = new T.Vector3(), EUg = new T.Euler();

// ---------- 6. tags over heads (a small pool of labels) ----------
const pool = []; for (let i = 0; i < 16; i++) { const d = document.createElement('div'); d.className = 'gt'; d.hidden = true; tagsEl.appendChild(d); pool.push(d); }
const PV = new T.Vector3();
function drawTags(list) { list.sort((a, b) => a[0] - b[0]); let k = 0; const W = innerWidth, H = innerHeight;
  for (const [, x, y, z, text, cls] of list) { if (k >= pool.length) break; PV.set(x, y, z).project(camera); if (PV.z > 1 || Math.abs(PV.x) > 1.05 || Math.abs(PV.y) > 1.05) continue;
    const el = pool[k++]; if (el.textContent !== text) el.textContent = text; const cn = 'gt ' + cls; if (el.className !== cn) el.className = cn; el.hidden = false;
    let sy = (1 - PV.y) / 2 * H; if (cls === 'bang' || cls === 'goal' || cls === 'say') sy = Math.max(sy, 96); el.style.transform = `translate(${((PV.x + 1) / 2 * W).toFixed(0)}px,${sy.toFixed(0)}px) translate(-50%,-100%)`; }
  for (; k < pool.length; k++) if (!pool[k].hidden) pool[k].hidden = true; }

// ---------- 7. every frame, inside the map's walk loop ----------
let seatT = 0, chatT = 3, t = 0;
const prevTick = PLAYHOOK.tick;
PLAYHOOK.tick = (dt, now) => { if (prevTick) prevTick(dt, now); try { frame(Math.min(dt, 0.1), now); } catch (e) { console.error('game', e); } };
function frame(dt, now) {
  t += dt; const px = WALK.x, pz = WALK.z, tags = [];
  if (now - seatT > 1500) { seatT = now; seatSitters(false); }
  near = null; let best = 4 * 4;
  for (const c of [...givers, ...sitters]) { if (!c.root.visible) continue; const q = c.root.position, d2 = (q.x - px) ** 2 + (q.z - pz) ** 2;
    if (d2 < 85 * 85) { c.busy > 0 ? (c.busy -= dt) : c.cur !== (c.bench ? 'sit' : 'idle') && c.play(c.bench ? 'sit' : 'idle'); c.mixer.update(dt); }
    if (d2 < 40 * 40) { if (c.label) tags.push([d2 / 3 + 5, q.x, 7.2, q.z, c.label, '']);
      const sp = speech.get(c); if (sp) { sp[1] -= dt; if (sp[1] <= 0) speech.delete(c); else tags.push([0, q.x, c.bench ? 6.6 : 8.6, q.z, sp[0], 'say']); }
      if (c.quest && ((c.qstate === 'open' && !active) || (c === active && c.qstate === 'return'))) tags.push([1, q.x, 9.4, q.z, c.qstate === 'return' ? '★' : '!', 'bang']); }
    const sc = c.quest ? d2 * 0.3 : d2; if (sc < best) { best = sc; near = { type: c.quest ? 'quest' : 'talk', c }; if (active && active.quest === 'chai' && carrying === 'chai' && c === active.deliverTo) near = { type: 'givechai', c }; } }
  if (active && active.qstate === 'doing') { const tg = active.quest === 'chai' ? active.deliverTo && active.deliverTo.root.position : active.target;
    if (tg) { const d2 = (tg.x - px) ** 2 + (tg.z - pz) ** 2; if (d2 < 4 * 4 && active.quest === 'cat') near = { type: 'pickcat' }; if (d2 < 4 * 4 && active.quest === 'letter') near = { type: 'post' };
      tags.push([0.5, tg.x, active.quest === 'chai' ? 8 : 4.2, tg.z, '▼', 'goal']); } }
  // a far errand: the marker shows on screen anyway, so you can always find the way
  const lbl = !near ? '' : near.type === 'quest' ? (near.c.qstate === 'open' && !active ? 'Help' : near.c === active && near.c.qstate === 'return' ? 'Done!' : 'Talk') : { talk: 'Say hi', pickcat: 'Pick up', givechai: 'Give chai', post: 'Post it' }[near.type];
  actBtn.hidden = !near; if (near && actBtn.textContent !== lbl) actBtn.textContent = lbl;
  chatT -= dt; if (chatT <= 0) { chatT = 3 + rnd() * 3; const cand = sitters.filter(c => c.root.visible && !speech.has(c) && (c.root.position.x - px) ** 2 + (c.root.position.z - pz) ** 2 < 30 * 30); if (cand.length) speak(cand[Math.floor(rnd() * cand.length)], SAY[Math.floor(rnd() * SAY.length)]); }
  cl.forEach((c, i) => { c[0] += dt * 2.2; if (c[0] > 340) c[0] = -340; clouds.setMatrixAt(i, M4g.compose(V3g.set(c[0], c[1], c[2]), Qg.identity(), SC.set(c[3], c[3] * 0.55, c[3]))); }); clouds.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < 15; i++) { const g = Math.floor(i / 5), j = i % 5, a = t * 0.22 + g * 2.1, R = 45 + g * 14; birds.setMatrixAt(i, M4g.compose(V3g.set(px + Math.cos(a) * R + (j % 3) * 2.2, 28 + g * 5 + Math.sin(t + i) * 0.6, pz + Math.sin(a) * R + Math.floor(j / 3) * 2.4 - j), Qg.setFromEuler(EUg.set(0, -a, Math.sin(t * 9 + i) * 0.15)), ONEg)); }
  birds.instanceMatrix.needsUpdate = true;
  drawTags(tags);
}
const prevStop = PLAYHOOK.onStop; PLAYHOOK.onStop = () => { if (prevStop) prevStop(); tagsEl.innerHTML = ''; actBtn.hidden = true; };
seatSitters(true); setHelped();
setTimeout(() => say('Three neighbours at Citizens\' Plaza need a hand. Look for the yellow !'), 2600);
G.debug = { givers, sitters, benches, Q, act: () => act(), near: () => near, W: WALK, free: (x, z) => freeAt(x, z) };
console.log('game layer on');
})().catch(e => console.error('game', e));
