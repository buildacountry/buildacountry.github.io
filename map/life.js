// LIFE IN VINLAND (24 Nov): /map/?life (and /play) opens the REAL 3D map straight into walking, with the game's screen on top.
// It runs INSIDE the map (the map evals this file, like play.js and reel.js), so the world is always exactly the map:
// every home, villa, shop and road, the collisions, the other walkers (real people only) and the walk controls are the map's own.
// This file only adds: start at your own front door, the minimap, clock, coins, a Run button and the "go home" marker.
(() => {
if (window.VLIFE) return;
const LF = window.VLIFE = { home: null, mine: false, arrived: false };
const Q = new URLSearchParams(location.search), visit = (Q.get('visit') || '').replace(/^@/, '').toLowerCase();
let me = ''; try { const v = JSON.parse(localStorage.getItem('vin_session') || 'null'); if (v && v.user && v.token && (!v.exp || new Date(v.exp) > new Date())) me = String(v.user).toLowerCase(); } catch (e) {}
const want = visit || me;
LF.home = want ? homes.find(x => x.status === 'active' && x.user && x.user.toLowerCase() === want) || null : null;
LF.mine = !!LF.home && !!me && want === me;
// ---- the screen ----
const css = document.createElement('style'); css.textContent = `
body.life .topbar, body.life #walkCount, body.life #vtoast { display: none !important; }
#lifeHud { position: fixed; inset: 0; z-index: 8; pointer-events: none; font-family: Poppins, system-ui, sans-serif; }
#lifeHud > * { pointer-events: auto; }
#lifeMini { position: fixed; left: max(14px, env(safe-area-inset-left, 0px)); top: calc(12px + env(safe-area-inset-top, 0px)); width: 128px; height: 128px; border-radius: 50%; border: 4px solid #14233f; box-shadow: 0 2px 10px rgba(0,0,0,.3); background: #8fbf62; }
#lifeTop { position: fixed; right: max(16px, env(safe-area-inset-right, 0px)); top: calc(58px + env(safe-area-inset-top, 0px)); text-align: right; color: #fff; text-shadow: 0 2px 0 #14233f, 0 0 6px rgba(0,0,0,.5); pointer-events: none; }
#lifeClock { font: 800 1.7rem/1 Poppins, system-ui, sans-serif; } #lifeCoins { font: 800 1.45rem/1.2 Poppins, system-ui, sans-serif; color: #ffd447; } #lifeWho { font: 700 .95rem/1.3 Poppins, system-ui, sans-serif; }
#lifeObj { position: fixed; left: 50%; transform: translateX(-50%); top: calc(10px + env(safe-area-inset-top, 0px)); max-width: min(300px, 46vw); background: rgba(16,21,31,.82); color: #fff; border-left: 4px solid #ffd447; border-radius: 10px; padding: 8px 12px; font: 700 .95rem/1.25 Poppins, system-ui, sans-serif; pointer-events: none; }
#lifeObj small { display: block; color: #ffd447; font-weight: 600; font-size: .8rem; }
#lifeRun { position: fixed; right: calc(78px + env(safe-area-inset-right, 0px)); bottom: calc(22px + env(safe-area-inset-bottom, 0px)); width: 64px; height: 64px; border-radius: 50%; border: 0; background: #fff8ef; color: #14233f; font: 800 .85rem Poppins, system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
#lifeRun.on { background: #ffd447; }
@media (max-height: 460px) { #lifeMini { width: 104px; height: 104px; } #lifeTop { top: calc(54px + env(safe-area-inset-top, 0px)); } }`;
document.head.appendChild(css);
const hud = document.createElement('div'); hud.id = 'lifeHud';
hud.innerHTML = '<canvas id="lifeMini" width="256" height="256"></canvas><div id="lifeTop"><div id="lifeClock"></div><div id="lifeCoins"></div><div id="lifeWho"></div></div><div id="lifeObj"></div><button id="lifeRun">RUN</button>';
document.body.appendChild(hud); document.body.classList.add('life');
const $l = id => document.getElementById(id), objEl = $l('lifeObj'), runB = $l('lifeRun');
$l('lifeWho').textContent = me ? '@' + me : '';
{ const ex = document.getElementById('walkExit'); if (ex) ex.textContent = '🗺️ Map'; }
runB.onclick = () => { WALK.keys.shift = !WALK.keys.shift; runB.classList.toggle('on', !!WALK.keys.shift); };
addEventListener('keyup', e => { if (e.key === 'Shift') runB.classList.remove('on'); });
const clock = () => { $l('lifeClock').textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }); };
clock(); setInterval(clock, 15000);
if (me && window.VSOC_API) window.VSOC_API({ action: 'wallet' }).then(r => { if (r && r.ok) $l('lifeCoins').textContent = '🪙 ' + Number(r.coins || 0).toLocaleString('en-IN'); }).catch(() => {});
// ---- the minimap: roads (from mapdata.js, the same file the 2D map uses) and homes around you, turned so up is where you look ----
const mini = $l('lifeMini'), mc = mini.getContext('2d'); let MD = window.VIN_MAPDATA || null;
if (!MD) { const s = document.createElement('script'); s.src = 'mapdata.js'; s.onload = () => { MD = window.VIN_MAPDATA || null; }; document.head.appendChild(s); }
function drawMini() { const W = 256, sc = 1.1, px = WALK.x, pz = WALK.z; mc.save(); mc.clearRect(0, 0, W, W); mc.beginPath(); mc.arc(W / 2, W / 2, W / 2, 0, 7); mc.clip(); mc.fillStyle = '#8fbf62'; mc.fillRect(0, 0, W, W);
  mc.translate(W / 2, W / 2); mc.rotate(WALK.yaw - Math.PI); mc.scale(sc, sc); mc.translate(-px, -pz);
  if (MD) { mc.fillStyle = '#e6d9b8'; (MD.places || []).forEach(([n, x, z, w, d]) => { if (n && Math.abs(x - px) < 220 && Math.abs(z - pz) < 220) mc.fillRect(x, z, w, d); });
    mc.fillStyle = '#5d5a55'; (MD.roads || []).forEach(([w, d, x, z]) => { if (Math.abs(x - px) < 130 + w && Math.abs(z - pz) < 130 + d) mc.fillRect(x - w / 2, z - d / 2, w, d); }); }
  mc.fillStyle = '#f4e3c3'; homes.forEach(h => { if (h.x !== undefined && Math.abs(h.x - px) < 130 && Math.abs(h.z - pz) < 130) mc.fillRect(h.x - 3, h.z - 3, 6, 6); });
  mc.restore();
  if (LF.home) { const dx = LF.home.x - px, dz = LF.home.z - pz, r = WALK.yaw - Math.PI, c = Math.cos(r), s2 = Math.sin(r); let mx = (dx * c - dz * s2) * sc, my = (dx * s2 + dz * c) * sc; const m = Math.hypot(mx, my), lim = W / 2 - 22;
    if (m > lim) { mx *= lim / m; my *= lim / m; } mc.fillStyle = '#ffd447'; mc.beginPath(); mc.arc(W / 2 + mx, W / 2 + my, 17, 0, 7); mc.fill(); mc.font = '24px system-ui'; mc.textAlign = 'center'; mc.textBaseline = 'middle'; mc.fillText('🏠', W / 2 + mx, W / 2 + my + 1); }
  mc.save(); mc.translate(W / 2, W / 2); mc.rotate(WALK.yaw - WALK.ang); mc.fillStyle = '#e8473c'; mc.strokeStyle = '#fff'; mc.lineWidth = 3;
  mc.beginPath(); mc.moveTo(0, -14); mc.lineTo(10, 10); mc.lineTo(0, 5); mc.lineTo(-10, 10); mc.closePath(); mc.stroke(); mc.fill(); mc.restore(); }
// ---- your home: the yellow marker at the door, and the objective ----
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd447', transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false })); beam.visible = false; scene.add(beam);
function objective() { const h = LF.home;
  if (!h) { objEl.innerHTML = me ? 'Explore Vinland<small>Your home is not on the map yet. Comment HOME on our latest reel.</small>' : 'Explore Vinland<small>Comment HOME on our latest reel, then DM KEY to log in and start at your own home</small>'; return; }
  const dd = Math.round(Math.hypot(beam.position.x - WALK.x, beam.position.z - WALK.z)), who = LF.mine ? 'your home' : '@' + h.user + "'s home", where = h.villa ? (h.villa >= 101 ? 'Mansion ' : 'Villa ') + h.villa : h.area || '';
  beam.visible = dd >= 3;
  if (dd < 3) { if (!LF.arrived) { LF.arrived = true; walkToast(LF.mine ? 'You are at your front door 🏡' : 'You are at @' + h.user + "'s door"); } objEl.innerHTML = (LF.mine ? 'Your home' : '@' + h.user + "'s home") + '<small>' + esc(where) + '</small>'; }
  else { LF.arrived = false; objEl.innerHTML = 'Go to ' + esc(who) + '<small>' + dd + ' m · follow the yellow marker</small>'; } }
// ---- PHONES: the map draws the whole country every frame. In the game you only see the street around you, so phones
//      (or ?lite on a laptop) get: a near horizon with soft haze, far things switched off, sharp-enough resolution, fewer tag updates.
LF.lite = (PHONE || /[?&]lite\b/.test(location.search)) && !/[?&]full\b/.test(location.search);
if (LF.lite) {
  const FAR = 260; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1)); renderer.setSize(wrap.clientWidth, wrap.clientHeight, false);
  camera.far = FAR + 40; camera.updateProjectionMatrix(); if (scene.fog) { scene.fog.near = 90; scene.fog.far = FAR; }
  // far things off: every static mesh gets its world bounding sphere once; every half second, what is out of reach is hidden
  const hidden = new Set(), list = [], big = []; scene.updateMatrixWorld(true);
  scene.traverse(o => { if (!(o.isMesh || o.isLineSegments || o.isPoints) || o.isInstancedMesh || !o.geometry) return; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere; if (!bs || !isFinite(bs.radius)) return;
    const c = bs.center.clone().applyMatrix4(o.matrixWorld), r = bs.radius * o.matrixWorld.getMaxScaleOnAxis(); if (r > 3000) return;
    if (r > 150 && !o.isPoints) big.push({ o, g }); list.push({ o, x: c.x, z: c.z, r }); });
  // big merged meshes (a whole district baked into one): draw only their triangles / outline segments near you, through an index list
  big.forEach(e => { const g = e.g, pos = g.attributes.position, per = e.o.isLineSegments ? 2 : 3, src = g.index ? g.index.array : null, np = (src ? src.length : pos.count) / per, M = e.o.matrixWorld, v = new THREE.Vector3();
    e.cx = new Float32Array(np); e.cz = new Float32Array(np); e.per = per; e.src = src; e.np = np;
    for (let t = 0; t < np; t++) { let x = 0, z = 0; for (let k = 0; k < per; k++) { const vi = src ? src[t * per + k] : t * per + k; v.fromBufferAttribute(pos, vi).applyMatrix4(M); x += v.x; z += v.z; } e.cx[t] = x / per; e.cz[t] = z / per; } });
  let bx = 1e9, bz = 1e9;
  LF.cullBig = () => { const px = WALK.x, pz = WALK.z; if (Math.hypot(px - bx, pz - bz) < 40) return; bx = px; bz = pz; const R2 = (FAR + 30) ** 2, L2 = 150 * 150;
    big.forEach(e => { const out = [], lim = e.per === 2 ? L2 : R2; for (let t = 0; t < e.np; t++) { const dx = e.cx[t] - px, dz = e.cz[t] - pz; if (dx * dx + dz * dz > lim) continue; for (let k = 0; k < e.per; k++) out.push(e.src ? e.src[t * e.per + k] : t * e.per + k); }
      e.g.setIndex(new THREE.BufferAttribute(e.g.attributes.position.count > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1)); }); };   // an empty list draws nothing
  LF.cull = () => { const px = WALK.x, pz = WALK.z; let n = 0; list.forEach(e => { const far = Math.hypot(e.x - px, e.z - pz) - e.r > FAR;
    if (far && e.o.visible) { e.o.visible = false; hidden.add(e.o); } else if (!far && hidden.has(e.o)) { e.o.visible = true; hidden.delete(e.o); } if (!e.o.visible) n++; }); return n; };
  // instanced things (homes, trees, lamps…) are drawn all at once by the map: keep only the instances near you, packed at the front
  const skipI = new Set([...(WALK.batches || []).map(b => b.im), ...((walkers && walkers.batches) ? Object.values(walkers.batches).flat().map(b => b.im) : [])]), inst = [];
  scene.traverse(o => { if (o.isInstancedMesh && !skipI.has(o) && o.count > 8) inst.push({ o, m: o.instanceMatrix.array.slice(0, o.count * 16), c: o.instanceColor ? o.instanceColor.array.slice(0, o.count * 3) : null, n: o.count }); });
  const sum = a => { let t = 0; for (let i = 12; i < a.length; i += 16) t += a[i] * 1.3 + a[i + 2]; return t; };
  inst.forEach(e => { e.s = sum(e.m); });
  LF.inst = inst;
  LF.cullI = () => { const px = WALK.x, pz = WALK.z, R2 = (FAR * 0.9) ** 2;
    inst.forEach(e => { if (e.dyn) return; const a = e.o.instanceMatrix.array;
      if (!e.packed && Math.abs(sum(a.subarray(0, e.n * 16)) - e.s) > 1e-3) { e.dyn = true; return; }   // something the map moves itself (cars, people): leave it alone
      let k = 0; for (let i = 0; i < e.n; i++) { const dx = e.m[i * 16 + 12] - px, dz = e.m[i * 16 + 14] - pz; if (dx * dx + dz * dz > R2) continue;
        if (k !== i || e.packed) { a.set(e.m.subarray(i * 16, i * 16 + 16), k * 16); if (e.c) e.o.instanceColor.array.set(e.c.subarray(i * 3, i * 3 + 3), k * 3); } k++; }
      e.packed = true; e.o.count = k; e.o.instanceMatrix.needsUpdate = true; if (e.c) e.o.instanceColor.needsUpdate = true; }); };
  // the map's name tags are hidden while walking anyway: update them 4 times a second instead of every frame
  const slow = f => { let t = 0; return function () { const n = performance.now(); if (n - t < 250) return; t = n; return f.apply(this, arguments); }; };
  updateLabels = slow(updateLabels); updateLayoutLabels = slow(updateLayoutLabels); updateEduLabels = slow(updateEduLabels); updateSupTags = slow(updateSupTags);
}
// ---- start walking: from your front door (the map's own walk start puts you outside it, looking at it) ----
const prevTick = PLAYHOOK.tick; let t0 = 0;
let tc = performance.now() + 1500;   // first pass after the cars have moved a little, so they are known as moving
PLAYHOOK.tick = (dt, now) => { if (prevTick) prevTick(dt, now); if (LF.cull && now - tc > 500) { tc = now; LF.cull(); if (WALK.on) { LF.cullI(); LF.cullBig(); } } if (now - t0 < 120) return; t0 = now; drawMini(); objective(); beam.rotation.y += 0.02; };
if (/[?&]perf\b/.test(location.search)) window.__lifeR = { renderer, scene, camera };   // headless speed tests only
document.getElementById('walkExit').onclick = () => { location.href = './' + (LF.home ? '?home=' + encodeURIComponent(LF.home.user) : ''); };
startWalk(LF.home || undefined);
setTimeout(() => { if (LF.home) { const h = LF.home, dx = WALK.x - h.x, dz = WALK.z - h.z, m = Math.hypot(dx, dz) || 1, k = Math.min(m - 1, h.villa ? (isMansion(h.villa) ? 20 : 9) : 5.5);
  beam.position.set(h.x + dx / m * k, 1.2, h.z + dz / m * k); beam.visible = true;
  // walk you up close to your door (the map starts walkers across the road, where roadside trees can hide you from the camera)
  if (!(h.villa && isMansion(h.villa))) for (let k = 0; k < 60; k++) { const bx = beam.position.x - WALK.x, bz = beam.position.z - WALK.z, l = Math.hypot(bx, bz); if (l < 4.5) break; const nx = WALK.x + bx / l * 0.5, nz = WALK.z + bz / l * 0.5; if (!freeAt(nx, nz)) break; WALK.x = nx; WALK.z = nz; }
  WALK.ang = WALK.yaw = Math.atan2(beam.position.x - WALK.x, beam.position.z - WALK.z); } WALK.pitch = 0.45; }, 400);
if (LF.home) walkToast((LF.mine ? 'Welcome home' : 'Visiting @' + LF.home.user) + '. Use the joystick to walk. Drag to look around.');
})();
