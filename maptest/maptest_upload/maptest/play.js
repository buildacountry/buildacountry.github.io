// Vinland PLAY MODE v1 (step 6, 13 Nov). Laptops only, logged-in citizens only. Loaded only when "Play" is pressed, so phones never download it.
// It runs INSIDE the 3D map (the map evals this file), so it reuses the walk and drive code, the roads check, the citizens and the shops.
// Rules: exploring, never crime. No typing anywhere: every choice is a fixed button. Nothing here can be bought and no car wins a time trial:
// trials always use the same white trial car. Supabase decides who you are and keeps the clock for trials, trips, shifts and the treasure.
(() => {
if (window.VPLAY) return;
const S5 = window.VSOC, KIT = window.VinlandKit, API = b => window.VSOC_API(b).catch(() => null);
const KMH = { own: 60, carHatch: 60, carSedan: 65, carSUV: 55, carPickup: 50, carSports: 90, carVan: 50, carTaxi: 60, scooter: 40, autoRickshaw: 35, police: 70, medic: 60, fire: 50, trial: 60 };
const CARNAME = { own: 'your car', carHatch: 'hatchback', carSedan: 'sedan', carSUV: 'SUV', carPickup: 'pickup', carSports: 'sports car', carVan: 'van', carTaxi: 'taxi', scooter: 'scooter', autoRickshaw: 'auto rickshaw', police: 'police car', medic: 'ambulance', fire: 'fire truck', trial: 'trial car' };
const P = { on: false, me: null, work: null, cars: [], own: null, borrowed: null, tcar: null, parked: null, trip: null, trial: null, ride: null, photo: null, hunt: null, huntT: 0, huntAt: [1e9, 1e9], shift: false, left: 3, panel: '', near: null, knock: null, lock: false, stops: null, routes: null, timer: 0 };
const fmt = ms => { const s = ms / 1000, m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0'); }, clock = s => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0');
const pos = () => P.photo ? P.photo.p : DRV.on ? [DRV.x, DRV.z, DRV.a] : [WALK.x, WALK.z, WALK.ang];

// ---------- HUD ----------
const css = document.createElement('style'); css.textContent = `
#playHud{position:fixed;inset:0;z-index:30;pointer-events:none;font-family:Poppins,system-ui,sans-serif;color:#14233f}#playHud[hidden],#playHud [hidden]{display:none!important}#playHud>*{pointer-events:auto}
#playHud button{font:600 13px Poppins,sans-serif;cursor:pointer}
.vpwho{position:absolute;left:14px;top:118px;background:#14233f;color:#fff;border:1.5px solid #c9a24a;border-radius:14px;padding:8px 12px;font-size:13px;max-width:260px}.vpwho b{color:#ecd9a4}.vpwho small{display:block;font-size:11.5px;opacity:.9}
.vpbar{position:absolute;right:14px;top:118px;display:flex;flex-direction:column;gap:8px}.vpbar button{background:#fffaf0;border:1.5px solid #14233f;border-radius:12px;padding:9px 12px;text-align:left;box-shadow:0 3px 0 #14233f;color:#14233f}.vpbar button:active{transform:translateY(2px);box-shadow:0 1px 0 #14233f}.vpbar kbd{float:right;margin-left:12px;font:600 11px Poppins;opacity:.6}
.vpobj{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:#14233f;color:#fff;border:1.5px solid #c9a24a;border-radius:14px;padding:9px 16px;font-size:14px;font-weight:600;display:flex;gap:12px;align-items:center;max-width:70vw}.vpobj button{background:none;border:1px solid #ecd9a4;color:#ecd9a4;border-radius:9px;padding:3px 9px;font-size:12px}
.vpprompt{position:absolute;left:50%;bottom:104px;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;align-items:center}.vpprompt div{background:rgba(255,250,240,.97);border:1.5px solid #14233f;border-radius:12px;padding:8px 14px;font-size:14px;font-weight:600;cursor:pointer}.vpprompt kbd{background:#14233f;color:#ecd9a4;border-radius:6px;padding:2px 8px;margin-right:8px;font:700 12px Poppins}
.vpmap{position:absolute;left:14px;bottom:14px;width:204px;background:#fffaf0;border:2px solid #14233f;border-radius:16px;overflow:hidden;box-shadow:0 4px 0 #14233f}.vpmap canvas{display:block;width:200px;height:200px}.vpmap small{display:block;font-size:10.5px;padding:3px 8px;background:#14233f;color:#ecd9a4}
.vppanel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,92vw);max-height:78vh;overflow:auto;background:#fffaf0;border:2px solid #14233f;border-radius:18px;padding:18px 20px;box-shadow:0 8px 0 #14233f}
.vppanel h3{font:700 21px Lora,Georgia,serif;margin:0 30px 4px 0}.vppanel p{font-size:13px;margin:4px 0 10px;color:#4b4638}.vppanel .x{position:absolute;right:10px;top:8px;border:0;background:none;font-size:24px;color:#14233f}
.vppanel .it{display:flex;gap:12px;align-items:center;border-top:1px solid #eadfbf;padding:10px 0;font-size:13.5px}.vppanel .it>span{flex:1;min-width:0}.vppanel .it b{display:block}.vppanel .it button,.vppanel .go{background:#c9a24a;border:0;border-radius:11px;padding:9px 14px;box-shadow:0 3px 0 #8f7026;color:#14233f}.vppanel .it button[disabled]{opacity:.45;box-shadow:none}
.vppanel ol{margin:4px 0 12px;padding-left:22px;font-size:13.5px}.vppanel h4{margin:12px 0 2px;font:600 14px Poppins}
.vptoast{position:absolute;left:50%;top:124px;transform:translateX(-50%);background:#fffaf0;border:2px solid #c9a24a;border-radius:14px;padding:10px 18px;font-size:15px;font-weight:600;text-align:center;max-width:60vw;box-shadow:0 6px 16px -8px #000}.vptoast.big{font-size:44px;padding:8px 34px;top:30vh}
.vptag{position:absolute;transform:translate(-50%,-100%);background:#14233f;color:#ecd9a4;border-radius:10px;padding:2px 9px;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none!important;z-index:0}.vppanel,.vptoast,.vpfade{z-index:3}
.vpphoto{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);display:flex;gap:10px;background:rgba(20,35,63,.92);border-radius:16px;padding:10px}.vpphoto button{background:#fffaf0;border:0;border-radius:11px;padding:10px 14px}.vpphoto .g{background:#c9a24a}
.vpfade{position:absolute;inset:0;background:#14233f;color:#ecd9a4;display:flex;align-items:center;justify-content:center;font:700 26px Lora,Georgia,serif;pointer-events:auto}
body.vinphoto #walkHud,body.vinphoto #driveHud,body.vinphoto #playHud>:not(#pPhoto):not(#pToast){display:none!important}body.vinphoto .topbar{visibility:hidden}body.vinphoto.pclean #pPhoto{opacity:0}
body.playing #walkExit,body.playing #driveExit{display:none}`; document.head.appendChild(css);
const hud = document.createElement('div'); hud.id = 'playHud'; hud.hidden = true; hud.innerHTML = `
<div class="vpwho"><b id="pWho"></b><small id="pJob"></small><small id="pHunt"></small></div>
<div class="vpobj" id="pObj" hidden><span id="pObjT"></span><button data-p="stop">Stop</button></div>
<div class="vpbar"><button data-p="trips">📦 Trips <kbd>M</kbd></button><button data-p="trials">⏱️ Time trials <kbd>T</kbd></button><button data-p="board">🏆 This week <kbd>B</kbd></button><button data-p="car">🚗 Bring my car <kbd>C</kbd></button><button data-p="photo">📷 Photo <kbd>P</kbd></button><button data-p="help">❔ Keys</button><button data-p="leave">✕ Leave Play</button></div>
<div class="vpprompt" id="pPrompt"></div>
<div class="vpmap"><canvas id="pMap" width="400" height="400"></canvas><small id="pXY"></small></div>
<div class="vppanel" id="pPanel" hidden></div><div class="vptoast" id="pToast" hidden></div><div class="vptag" id="pTag" hidden></div>
<div class="vpphoto" id="pPhoto" hidden><button data-p="selfie">🙂 Selfie</button><button data-p="clean">👁 Hide buttons</button><button class="g" data-p="snap">📸 Save photo</button><button data-p="photo">✕ Back</button></div>
<div class="vpfade" id="pFade" hidden></div>`; document.body.appendChild(hud);
const $ = id => document.getElementById(id), pPanel = $('pPanel'), pPrompt = $('pPrompt'), pObj = $('pObj'), pTag = $('pTag'), mapC = $('pMap').getContext('2d');
function toast(t, ms = 3600, big = false) { const el = $('pToast'); el.textContent = t; el.className = 'vptoast' + (big ? ' big' : ''); el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, ms); }
function intercom(bid) {   // apartment intercom: everyone in the building, by flat, each with Knock (no typing anywhere)
  const res = homes.filter(o => o.flat && o.flat.bid === bid && o.status === 'active' && o !== P.me).sort((a, c) => a.n - c.n);
  panel('<h3>🔔 Intercom</h3><p>Who lives in this building. Knock on any flat.</p>' + res.map(o => { const u = o.user.toLowerCase(), done = S5.knocked.has(u);
    return `<div class="it"><span><b>${esc(o.flat.label || 'Flat')}</b> · @${esc(o.user)}${S5.friends.has(u) ? ' 💛' : ''}</span>${done ? '<span>Knocked 👋</span>' : `<button data-p="iknock" data-u="${esc(u)}">👋 Knock</button>`}</div>`; }).join('')); }
function panel(html) { P.panel = html ? 'open' : ''; pPanel.innerHTML = html ? '<button class="x" data-p="close" aria-label="Close">×</button>' + html : ''; pPanel.hidden = !html; }

// ---------- you: your look, your car, your work ----------
function dress() { if (!WALK.parts) return; const k = hashStr(P.me.user), c = new THREE.Color(), UNI = { police: '#1f3a6e', fire: '#c0392b', medic: '#f4f4f0', teacher: '#47684a', shop: '#c9922e' }, uni = P.work && UNI[P.work.role];
  WALK.parts.body.forEach(b => { c.set(b.vary === 0 ? (uni || SHIRTS[k % SHIRTS.length]) : b.vary === 1 ? SKINS[(k >> 2) % SKINS.length] : b.vary === 2 ? HAIRS[(k >> 4) % HAIRS.length] : b.color); b.im.setColorAt(0, c); if (b.im.instanceColor) b.im.instanceColor.needsUpdate = true; }); }
function mkBody() { if (P.body) { scene.remove(P.body); P.body = null; } const l = lookOf(P.me.user); if (!l || !KIT || !KIT.person) return;
  const g = KIT.person({ skin: KITSET.skins[l.skin || 0], hairStyle: l.hairStyle || 'short', hair: KITSET.hairs[l.hair || 0], outfit: l.outfit || 'tee', top: KITSET.tops[l.top || 0], bottom: KITSET.bottoms[l.bottom || 0], hat: l.hat || 'none', hatColor: KITSET.hats[l.hatColor || 0], acc: l.acc || 'none' });
  g.scale.setScalar(0.95); P.body = g; P.bodyPh = 0; P.bodyAt = [WALK.x, WALK.z]; scene.add(g); }
function mkCar(kind, look, extra) { const mesh = buildCar(look); if (extra) extra(mesh.userData.body, { edge: false, shadow: false }); return { kind, mesh, vmax: KMH[kind] / 3.6, kmh: KMH[kind], x: 0, z: 0, a: 0 }; }
function mkKitCar(k, tint) { const body = KIT[k](tint || {}), mesh = new THREE.Group(); mesh.add(body); const s = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
  mesh.userData = { L: Math.max(2, s.z), W: Math.max(0.9, s.x), body, look: { model: k, colour: '' } }; return { kind: k, mesh, vmax: (KMH[k] || 60) / 3.6, x: 0, z: 0, a: 0 }; }
function park(c, x, z, a) { DRV.car = c.mesh; const sp = a === undefined ? nearestRoadSpot(x, z) : [x, z, a]; c.x = sp[0]; c.z = sp[1]; c.a = sp[2]; c.mesh.position.set(c.x, groundY(c.x, c.z) + 0.02, c.z); c.mesh.rotation.set(0, c.a, 0); if (!c.mesh.parent) scene.add(c.mesh); kick(600); }
function jobCar(role) { const NE = { edge: false, shadow: false };
  if (role === 'police') return mkCar('police', { model: 'sedan', colour: '#1f3a6e' }, b => { B(b, 1.84, 0.2, 1.2, '#f4f4f0', 0, 0.7, 1.5, NE); B(b, 0.5, 0.16, 0.3, '#3d6be0', -0.4, 1.46, -0.25, NE); B(b, 0.5, 0.16, 0.3, '#d23b2c', 0.4, 1.46, -0.25, NE); });
  if (role === 'medic') return mkCar('medic', { model: 'van', colour: '#f4f4f0' }, b => { B(b, 1.94, 0.3, 4.62, '#d23b2c', 0, 0.75, -0.05, NE); B(b, 0.5, 0.16, 0.3, '#d23b2c', 0, 1.92, 1.2, NE); });
  if (role === 'fire') return mkCar('fire', { model: 'van', colour: '#c0392b' }, b => { B(b, 0.3, 0.18, 3.6, '#cfc6b4', -0.5, 1.92, -0.3, NE); B(b, 0.3, 0.18, 3.6, '#cfc6b4', 0.5, 1.92, -0.3, NE); B(b, 0.5, 0.16, 0.3, '#d23b2c', 0, 1.92, 1.9, NE); });
  return null; }
function setWalkAt(x, z, a) { [WALK.x, WALK.z] = nearestFree(x, z); if (a !== undefined) { WALK.ang = a; WALK.yaw = a; } WALK.cd = 0; }
function enterCar(c) { if (DRV.on || P.lock) return; WALK.on = false; WALK.keys = {}; if (WALK.batches) WALK.batches.forEach(b => { b.im.count = 0; }); walkHud.hidden = true; walkNear.hidden = true; pTag.hidden = true;
  DRV.car = c.mesh; if (!carFits(c.x, c.z, c.a)) { const sp = nearestRoadSpot(c.x, c.z); c.x = sp[0]; c.z = sp[1]; c.a = sp[2]; }
  Object.assign(DRV, { x: c.x, z: c.z, a: c.a, v: 0, steer: 0, camYaw: c.a, lookOff: 0, cleared: {}, wait: 0, waitAt: null, near: null, tagT: 0, keys: {} }); DRV.y = groundY(c.x, c.z); DRV.camH = 4.6; DRV_VMAX = c.vmax; P.car = c;
  if (!DRV.tags.length) for (let i = 0; i < 16; i++) { const el = document.createElement('div'); el.className = 'lbl home drv'; el.hidden = true; driveTags.appendChild(el); DRV.tags.push(el); }
  document.body.classList.add('walking', 'driving'); driveHud.hidden = false; DRV.on = true; controls.enabled = false; kick(900);
  toast('You are in ' + (c.kind === 'own' ? 'your car' : 'the ' + CARNAME[c.kind]) + ' · top speed ' + (c.kmh || KMH[c.kind]) + ' km/h', 2600); }
function exitCar(quiet) { if (!DRV.on) return; const c = P.car; c.x = DRV.x; c.z = DRV.z; c.a = DRV.a; DRV.on = false; DRV.v = 0; DRV.keys = {}; driveHud.hidden = true; driveNear.hidden = true; DRV.tags.forEach(el => el.hidden = true); if (DRV.blink) DRV.blink.visible = false;
  document.body.classList.remove('driving'); setWalkAt(DRV.x + Math.cos(DRV.a) * 2.4, DRV.z - Math.sin(DRV.a) * 2.4, DRV.a); WALK.batches.forEach(b => { b.im.count = 1; }); walkHud.hidden = false; WALK.on = true; controls.enabled = false; kick(900); if (!quiet) toast('On foot. Your ' + (c.kind === 'own' ? 'car' : CARNAME[c.kind]) + ' waits here.', 2200); }
// parked street cars (the kit cars from "life on the streets"): you can take one for a drive; it goes back to its place when you take another
function parkedList() { if (P.parked) return P.parked; P.parked = []; if (!LIFE.mats) return P.parked;
  Object.keys(KMH).forEach(k => (LIFE.mats[k] || []).forEach((m, i) => P.parked.push({ k, i, m, x: m.elements[12], z: m.elements[14], a: Math.atan2(m.elements[8], m.elements[10]) }))); return P.parked; }
function showParked(p, on) { const g = LIFE.inst && LIFE.inst[p.k]; if (!g) return; const Z = new THREE.Matrix4().makeScale(0, 0, 0), n = LIFE.mats[p.k].length;
  g.children.forEach(ch => { if (ch.isInstancedMesh) { ch.setMatrixAt(p.i, on ? p.m : Z); ch.instanceMatrix.needsUpdate = true; }
    else if (ch.isLineSegments) { const at = ch.geometry.attributes.position, per = at.array.length / n; if (per % 3) return; const o = p.i * per; if (!on) { p.ink = p.ink || at.array.slice(o, o + per); at.array.fill(0, o, o + per); } else if (p.ink) at.array.set(p.ink, o); at.needsUpdate = true; } }); }
function returnBorrowed() { const b = P.borrowed; if (!b) return; scene.remove(b.mesh); try { showParked(b.p, true); } catch (e) {} P.cars = P.cars.filter(c => c !== b); P.borrowed = null; }
function borrow(p) { if (!KIT || !KIT[p.k]) return; returnBorrowed(); const tint = LIFE.tints && LIFE.tints[p.k] ? LIFE.tints[p.k][p.i] : null, c = mkKitCar(p.k, tint); c.p = p; try { showParked(p, false); } catch (e) {}
  c.x = p.x; c.z = p.z; c.a = p.a; c.mesh.position.set(p.x, 0.14, p.z); c.mesh.rotation.set(0, p.a, 0); scene.add(c.mesh); P.cars.push(c); P.borrowed = c; enterCar(c); }
function bringCar() { if (DRV.on) { toast('You are already driving.'); return; } const prev = DRV.car; park(P.own, WALK.x, WALK.z); DRV.car = prev || P.own.mesh; toast('Your car is parked beside you 🚗', 2200); }

// ---------- places: stops, trips, routes ----------
function roadSide(ax, az) { let bx = ax, bz = az, bd = 1e9; ROADS.forEach(([w, d, x, z]) => { const px = Math.max(x - w / 2, Math.min(ax, x + w / 2)), pz = Math.max(z - d / 2, Math.min(az, z + d / 2)), dd = Math.hypot(px - ax, pz - az); if (dd < bd) { bd = dd; bx = px; bz = pz; } });
  const l = Math.hypot(ax - bx, az - bz) || 1; return nearestFree(bx + (ax - bx) / l * 3, bz + (az - bz) / l * 3); }
const beachAnchor = () => { const l = homes.filter(h => h.flat && /^Beach Lane/.test(h.flat.label || '')); return l.length ? [l.reduce((a, h) => a + h.x, 0) / l.length, l.reduce((a, h) => a + h.z, 0) / l.length] : [0, BEACH.z + 60]; };
function places() { const b = beachAnchor(), m = marketSlots.filter(q => !q.area); const mk = m.length ? [m.reduce((a, q) => a + q.x, 0) / m.length, m.reduce((a, q) => a + q.z, 0) / m.length + 14] : [0, 60];
  return [['the Market', mk[0], mk[1]], ['Police HQ', POL.x, POL.z], ['the Hospital', HOSP_POS.x, HOSP_POS.z], ['the School', EDU.school.x, EDU.school.z], ['Beach Lane', b[0], b[1]], ['the Train Station', TRAIN.x, TRAIN.z], ['the Bus Station', BUS.x, BUS.z], ['the Mall', MALL_SIDE.cx, MALL_SIDE.cz], ['the Fire Station', FIRE.x, FIRE.z], ['the Embassy', EMB.x, EMB.z]]; }
function stops() { if (P.stops) return P.stops; const b = beachAnchor(), pl = places();
  P.stops = [['Bus Station', '🚌', 'bus', BUS.x, BUS.z], ['Train Station', '🚆', 'train', TRAIN.x, TRAIN.z], ['River Ferry', '⛴️', 'ferry', RS.riverE - 40, -60], ['Market', '🚌', 'bus', pl[0][1], pl[0][2]], ['Hospital', '🚌', 'bus', HOSP_POS.x, HOSP_POS.z], ['Beach Lane', '🚌', 'bus', b[0], b[1]]].map(([n, ic, v, x, z]) => { const p = roadSide(x, z); return { n, ic, v, x: p[0], z: p[1] }; }); return P.stops; }
function routes() { if (P.routes) return P.routes; const R = {}, br = (DRV.bridges || []).slice().sort((a, b) => a.bz - b.bz), prev = DRV.car; DRV.car = P.own.mesh;
  if (br.length) { const b0 = br[0], b1 = br[br.length - 1], e0 = [b0.x1 - 4, b0.bz], w0 = [b0.x0 + 4, b0.bz], w1 = [b1.x0 + 4, b1.bz], e1 = [b1.x1 - 4, b1.bz]; R.river = { name: 'River lap', pts: br.length > 1 ? [e0, w0, w1, e1, e0] : [e0, w0, e0] }; }
  const a = nearestRoadSpot(0, 43), b = nearestRoadSpot(...beachAnchor()); R.beach = { name: 'Central to Beach Lane', pts: [[a[0], a[1]], [b[0], b[1]]] }; DRV.car = prev; return P.routes = R; }
function offers() { let sd = hashStr(P.me.user + new Date().toDateString()) % 2147483646 + 1; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647, pick = l => l[Math.floor(rnd() * l.length)];
  const sh = shops.filter(s => s.owner && s.owner.status === 'active'), hs = homes.filter(h => h.status === 'active' && !h.flat && !h.founder && h !== P.me), pl = places();
  return [0, 1, 2].map(i => { if (i === 1 || !sh.length || !hs.length) { const a = pick(pl); let b = pick(pl); while (b === a) b = pick(pl); return { kind: 'taxi', icon: '🚕', a: { n: a[0], x: a[1], z: a[2] }, b: { n: b[0], x: b[1], z: b[2] }, title: 'Taxi ride', text: 'Pick up at ' + a[0] + ', drop at ' + b[0], timed: i === 2 }; }
    const s = pick(sh), h = pick(hs); return { kind: 'delivery', icon: '📦', a: { n: '@' + s.owner.user + "'s " + String(s.job).toLowerCase(), x: s.x, z: s.z }, b: { n: '@' + h.user + "'s home", x: h.x, z: h.z }, title: 'Delivery' + (i === 2 ? ' (with a timer)' : ''), text: 'From @' + s.owner.user + "'s " + String(s.job).toLowerCase() + ' to @' + h.user + "'s home", timed: i === 2 }; }); }

// ---------- beacon (where to go) and the treasure ----------
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 46, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#f2c14e', transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide })); beacon.visible = false; beacon.frustumCulled = false; scene.add(beacon);
const cup = new THREE.Group(); { const gold = new THREE.MeshBasicMaterial({ color: '#f2c14e' }); [[0.5, 0.3, 0.9, 1.5], [0.12, 0.12, 0.6, 0.75], [0.4, 0.45, 0.2, 0.35]].forEach(([r1, r2, h, y]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 12), gold); m.position.y = y; cup.add(m); });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); glow.position.y = 15; cup.add(glow); cup.visible = false; scene.add(cup); }
function target() { if (P.trial && P.trial.i < P.trial.r.pts.length) { const q = P.trial.r.pts[P.trial.i]; return { x: q[0], z: q[1] }; } if (P.trip) return P.trip.stage ? P.trip.B : P.trip.A; return null; }

// ---------- trips: deliveries and taxi rides (max 3 a day, Supabase counts) ----------
function tripsPanel() { const off = offers(); P.off = off; panel(`<h3>Trips</h3><p>Real shops, real homes, real places. Go by car. ${P.left} of 3 left today. Rewards are stamps, never money.</p>` + off.map((o, i) => `<div class="it"><span><b>${o.icon} ${esc(o.title)}</b>${esc(o.text)}</span><button data-p="trip" data-i="${i}"${P.left < 1 || P.trip || P.trial ? ' disabled' : ''}>Start</button></div>`).join('') + (P.left < 1 ? '<p>That is 3 trips today. More tomorrow.</p>' : '')); }
async function tripStart(i) { const o = P.off && P.off[i]; if (!o || P.trip || P.trial) return; panel(''); const r = await API({ action: 'trip_start', kind: o.kind });
  if (!r || !r.ok) { toast(r && r.msg ? r.msg : 'That trip could not start. Try again.'); return; } const prev = DRV.car; DRV.car = P.own.mesh; const A = nearestRoadSpot(o.a.x, o.a.z), B2 = nearestRoadSpot(o.b.x, o.b.z); DRV.car = prev || P.own.mesh;
  P.trip = { id: r.id, o, stage: 0, A: { x: A[0], z: A[1], n: o.a.n }, B: { x: B2[0], z: B2[1], n: o.b.n }, end: 0 }; toast(o.icon + ' Drive to ' + o.a.n, 3200); }
async function tripStep() { const t = P.trip; if (!t.stage) { t.stage = 1; if (t.o.timed) t.end = performance.now() + (Math.hypot(t.A.x - t.B.x, t.A.z - t.B.z) / 6 + 40) * 1000; toast((t.o.kind === 'taxi' ? '🚕 Passenger is in. Drive to ' : '📦 Parcel picked up. Drive to ') + t.B.n, 3200); return; }
  P.trip = null; const r = await API({ action: 'trip_done', id: t.id }); if (!r || !r.ok) { toast(r && r.msg ? r.msg : 'That trip did not count. Try again.'); return; } P.left = r.left;
  toast((t.o.kind === 'taxi' ? '🚕 Dropped at ' : '📦 Delivered to ') + t.B.n + ' ✅' + (r.stamp === 'driver' ? ' · New stamp: First trip!' : r.stamp === 'driver10' ? ' · New stamp: 10 trips!' : ' · ' + r.total + ' trips so far'), 5200); track('play-trip'); }

// ---------- time trials: the same white trial car for everyone; Supabase keeps the clock ----------
function trialsPanel() { const R = routes(); panel(`<h3>Time trials</h3><p>Everyone drives the same trial car (60 km/h), so nothing you own can win. Best time of the week goes on the board.</p>` + Object.keys(R).map(k => `<div class="it"><span><b>⏱️ ${esc(R[k].name)}</b>${R[k].pts.length - 1} checkpoint${R[k].pts.length > 2 ? 's' : ''}</span><button data-p="trial" data-k="${k}"${P.trip || P.trial ? ' disabled' : ''}>Start</button></div>`).join('')); }
function trialStart(k) { const r = routes()[k]; if (!r || P.trial || P.trip) return; panel(''); if (DRV.on) exitCar(true);
  if (!P.tcar) P.tcar = mkCar('trial', { model: 'hatch', colour: '#f4efe4' }, (b, NE) => { B(b, 0.5, 0.03, 3.72, '#14233f', 0, 0.92, 0, NE); });
  const a = Math.atan2(r.pts[1][0] - r.pts[0][0], r.pts[1][1] - r.pts[0][1]); DRV.car = P.tcar.mesh; if (carFits(r.pts[0][0], r.pts[0][1], a)) park(P.tcar, r.pts[0][0], r.pts[0][1], a); else park(P.tcar, r.pts[0][0], r.pts[0][1]);
  P.trial = { k, r, i: 1, id: null, t0: 0 }; enterCar(P.tcar); P.lock = true; let n = 3; toast('3', 900, true);
  const tick = setInterval(async () => { if (!P.trial) { clearInterval(tick); return; } n--; if (n > 0) { toast(String(n), 900, true); return; } clearInterval(tick);
    const res = await API({ action: 'trial_start', route: k }); if (!P.trial) return; if (!res || !res.ok) { trialEnd('The run could not start. Try again.'); return; }
    P.trial.id = res.id; P.trial.t0 = performance.now(); P.lock = false; toast('GO!', 900, true); }, 1000); }
function trialEnd(msg) { P.trial = null; P.lock = false; if (DRV.on && P.car === P.tcar) exitCar(true); if (P.tcar) scene.remove(P.tcar.mesh); if (msg) toast(msg, 6000); if (P.on && !DRV.on) { const prev = DRV.car; park(P.own, WALK.x, WALK.z); DRV.car = prev || P.own.mesh; } }
async function trialFinish() { const t = P.trial; P.lock = true; t.done = true; const r = await API({ action: 'trial_done', id: t.id });
  trialEnd(r && r.ok ? `🏁 ${t.r.name}: ${fmt(r.ms)} · your best this week ${fmt(r.best)}` : (r && r.msg) || 'That run did not count.'); track('play-trial'); }
async function boardPanel() { panel('<h3>This week in Vinland</h3><p>Loading…</p>'); const r = await API({ action: 'board' }), R = routes(); if (!P.panel) return; if (!r || !r.ok) { panel('<h3>This week in Vinland</h3><p>The board could not load. Try again.</p>'); return; }
  const list = (l, f) => l && l.length ? '<ol>' + l.map(f).join('') + '</ol>' : '<p>Nobody yet. Be the first.</p>';
  panel('<h3>This week in Vinland</h3><p>Starts fresh every Monday.</p>' + Object.keys(R).map(k => `<h4>⏱️ ${esc(R[k].name)}</h4>` + list(r.trials[k], x => `<li>@${esc(x.user)} · ${fmt(x.ms)}</li>`)).join('') + '<h4>💼 Most shifts</h4>' + list(r.shifts, x => `<li>@${esc(x.user)} · ${x.n} shift${x.n > 1 ? 's' : ''}</li>`)); }

// ---------- work: Start shift at your real workplace ----------
async function shift(on) { const r = await API({ action: 'shift', on }); if (!r || !r.ok) { toast(r && r.msg ? r.msg : 'That did not work. Try again.'); return; } P.shift = !!r.on;
  toast(r.on ? '🟢 You are on shift at ' + P.work.name + '. Everyone can see you working' + (P.work.role === 'shop' && P.me.shopRef ? ' and your sign says OPEN.' : '.') : 'Shift over. Well done 👏', 4200); if (window.VSOC_LOAD) window.VSOC_LOAD(); track(r.on ? 'play-shift' : 'play-shift-end'); }

// ---------- bus, train, ferry: every 5 minutes on the clock ----------
const nextDep = () => (Math.floor(Date.now() / 3e5) + 1) * 3e5;
function stopsPanel(s) { panel(`<h3>${s.ic} ${esc(s.n)}</h3><p>Leaves every 5 minutes (at :00, :05, :10…). Next one in ${clock((nextDep() - Date.now()) / 1000)}. Pick where to go, then wait here.</p>` + stops().filter(q => q !== s).map(q => `<div class="it"><span><b>${q.ic} ${esc(q.n)}</b></span><button data-p="ride" data-n="${esc(q.n)}">Go here</button></div>`).join('')); P.at = s; }
function rideGo() { const r = P.ride, f = $('pFade'); r.going = true; WALK.on = false; if (P.body) P.body.visible = false; WALK.batches.forEach(b => { b.im.count = 0; });
  const done = () => { clearInterval(r.cam); setWalkAt(r.to.x, r.to.z); f.hidden = true; P.ride = null; WALK.batches.forEach(b => { b.im.count = 1; }); if (P.on) { WALK.on = true; kick(900); toast('You are at ' + r.to.n + ' ' + r.to.ic, 2600); track('play-ride'); } };
  const v = window.VTRANSIT && window.VTRANSIT.list.find(q => q.kind === r.from.v), home = { bus: 'Bus Station', train: 'Train Station', ferry: 'River Ferry' }[r.from.v] === r.from.n;
  if (v && home && v.at) { toast(r.from.ic + ' On the ' + r.from.v + ' to ' + r.to.n + '…', 8000);   // ride along: the camera follows the real moving bus / train / ferry for a few seconds
    r.cam = setInterval(() => { if (!v.at) return; const [x, z, a] = v.at, d = r.from.v === 'bus' ? 16 : 30; camera.position.set(x - Math.sin(a) * d + Math.cos(a) * 7, d * 0.5, z - Math.cos(a) * d - Math.sin(a) * 7); camera.lookAt(x, 2, z); kick(200); }, 33); setTimeout(done, 8000); return; }
  f.textContent = r.from.ic + ' On the ' + r.from.v + ' to ' + r.to.n + '…'; f.hidden = false; setTimeout(done, 3200); }

// ---------- photo mode ----------
function photo(on) { if (on === !!P.photo) return; if (on) { if (P.lock || P.ride) return; P.photo = { walk: WALK.on, drive: DRV.on, p: pos(), min: controls.minDistance }; controls.minDistance = 2; WALK.on = DRV.on = false; controls.enabled = true; controls.target.set(P.photo.p[0], 1.4, P.photo.p[1]); controls.update(); document.body.classList.add('vinphoto'); $('pPhoto').hidden = false; pTag.hidden = true; toast('Photo mode: drag to turn, scroll to zoom.', 2600); }
  else { const ph = P.photo; P.photo = null; controls.minDistance = ph.min; document.body.classList.remove('vinphoto', 'pclean'); $('pPhoto').hidden = true; controls.enabled = false; WALK.on = ph.walk; DRV.on = ph.drive; } kick(900); }
function selfie() { const [x, z, a0] = P.photo.p, car = P.photo.drive, y = car ? 1.5 : 1.75, d = car ? 7 : 4.6; let a = a0;   // stand the camera in front of you, where no wall is in the way
  if (!car) { for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) { const t = a0 + k * Math.PI / 4, cx = x + Math.sin(t) * d, cz = z + Math.cos(t) * d; if (!blockedAt(cx, cz) && !blockedAt((x + cx) / 2, (z + cz) / 2)) { a = t; break; } }
    WALK.ang = a; P.photo.p[2] = a; if (P.body) P.body.rotation.y = a; else { poseSlot(0, x, z, a, 0, 1.1); WALK.batches.forEach(b => { b.im.instanceMatrix.needsUpdate = true; }); } }
  camera.position.set(x + Math.sin(a) * d, y + 0.35, z + Math.cos(a) * d); controls.target.set(x, y - 0.25, z); controls.update(); kick(900); }
function snap() { renderer.render(scene, camera); const src = renderer.domElement, c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const g = c.getContext('2d');
  const sc = Math.max(1080 / src.width, 1920 / src.height), w = src.width * sc, h = src.height * sc; g.drawImage(src, (1080 - w) / 2, (1920 - h) / 2, w, h);
  const gr = g.createLinearGradient(0, 1500, 0, 1920); gr.addColorStop(0, 'rgba(20,35,63,0)'); gr.addColorStop(1, 'rgba(20,35,63,.94)'); g.fillStyle = gr; g.fillRect(0, 1500, 1080, 420);
  g.textAlign = 'center'; g.fillStyle = '#ecd9a4'; g.font = '700 76px Lora, Georgia, serif'; g.fillText('V I N L A N D', 540, 1730); g.fillStyle = '#fff'; g.font = '600 40px Poppins, sans-serif'; g.fillText('@' + P.me.user + ' · Home № ' + P.me.n, 540, 1800);
  g.fillStyle = '#c9a24a'; g.font = '500 30px Poppins, sans-serif'; g.fillText('Every follower gets a home · @buildacountry', 540, 1856);
  c.toBlob(async b => { if (!b) return; const f = new File([b], 'vinland-' + P.me.user + '.jpg', { type: 'image/jpeg' });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Photo saved. Share it to your story 📸', 3200); }, 'image/jpeg', 0.92); track('play-photo'); P.lastShot = c; }

// ---------- the loop: prompts, objectives, minimap (10 times a second) ----------
function ui() { if (!P.on) return; const now = performance.now(), [x, z, a] = pos(); const lines = []; P.near = null; P.knock = null;
  if (!P.photo && !(P.ride && P.ride.going)) {
    if (DRV.on) { if (!P.lock && Math.abs(DRV.v) < 1.2 && !P.trial) lines.push(['E', 'Get out']); }
    else if (WALK.on) { let best = null, bd = 4.6; P.cars.forEach(c => { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = { t: 'car', c }; } });
      if (!best) { bd = 4.2; parkedList().forEach(p => { if (P.borrowed && P.borrowed.p === p) return; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = { t: 'parked', p }; } }); }
      const st = stops().find(s => Math.hypot(s.x - x, s.z - z) < 12);
      if (best) { P.near = best; lines.push(['E', best.t === 'car' ? (best.c.kind === 'own' ? 'Get in your car' : 'Get in the ' + CARNAME[best.c.kind]) : 'Drive this ' + CARNAME[best.p.k] + ' (' + KMH[best.p.k] + ' km/h)']); }
      else if (P.work && Math.hypot(P.work.x - x, P.work.z - z) < P.work.r) { P.near = { t: 'work' }; lines.push(['E', P.shift ? 'End shift' : 'Start shift at ' + P.work.name]); }
      else if (st && !P.ride) { P.near = { t: 'stop', s: st }; lines.push(['E', st.ic + ' ' + st.n + ' · next in ' + clock((nextDep() - Date.now()) / 1000)]); }
      const h = WALK.near; if (h && h.flat) { const n = homes.filter(o => o.flat && o.flat.bid === h.flat.bid && o.status === 'active' && o !== P.me).length; if (n) { P.knock = { bid: h.flat.bid }; lines.push(['K', '🔔 Intercom · ' + n + (n === 1 ? ' flat' : ' flats') + ' in this building']); } }
      else if (h && h.status === 'active' && h !== P.me) { const u = h.user.toLowerCase(); if (S5.friends.has(u) && S5.knocked.has(u)) lines.push(['💛', 'Your friend @' + h.user + ' · knocked today']); else if (S5.knocked.has(u)) lines.push(['👋', 'You knocked on @' + h.user + "'s door"]); else { P.knock = u; lines.push(['K', 'Knock on @' + h.user + "'s door" + (S5.friends.has(u) ? ' 💛' : '')]); } } } }
  const html = lines.map(l => `<div data-p="${l[0] === 'E' ? 'use' : l[0] === 'K' ? 'knock' : ''}"><kbd>${l[0]}</kbd>${esc(l[1])}</div>`).join(''); if (html !== P.promptH) { P.promptH = html; pPrompt.innerHTML = html; }
  // objectives
  let obj = '';
  if (P.trial) { const t = P.trial, tg = target(); if (t.t0 && !t.done) { obj = `⏱️ ${t.r.name} · checkpoint ${Math.min(t.i, t.r.pts.length - 1)}/${t.r.pts.length - 1} · ${fmt(now - t.t0)}`; if (tg && Math.hypot(tg.x - x, tg.z - z) < 10) { t.i++; if (t.i >= t.r.pts.length) trialFinish(); } } else obj = t.done ? '🏁 Finish!' : '⏱️ ' + t.r.name + ' · get ready'; }
  else if (P.trip) { const t = P.trip, tg = target(), d = Math.hypot(tg.x - x, tg.z - z); obj = `${t.o.icon} ${t.stage ? 'To' : 'Pick up at'} ${tg.n} · ${Math.round(d)} m` + (t.end ? ' · ⏳ ' + clock((t.end - now) / 1000) : '');
    if (t.end && now > t.end) { P.trip = null; toast('Too slow this time, so it did not count. Start another trip.', 4200); } else if (d < 9) { if (DRV.on) { if (Math.abs(DRV.v) < 5) tripStep(); } else obj += ' · come by car'; } }
  else if (P.ride) { const r = P.ride, left = (r.at - Date.now()) / 1000; if (!r.going) { if (Math.hypot(r.from.x - x, r.from.z - z) > 26 || DRV.on) { P.ride = null; toast('You left the stop, so the ' + r.from.v + ' went without you.', 3200); } else if (left <= 0) rideGo(); else obj = `${r.from.ic} ${r.from.v[0].toUpperCase() + r.from.v.slice(1)} to ${r.to.n} leaves in ${clock(left)} · wait at the stop`; } }
  else if (P.shift) obj = '🟢 On shift at ' + P.work.name;
  if (obj !== P.objH) { P.objH = obj; $('pObjT').textContent = obj; pObj.hidden = !obj; }
  if (P.shift && P.work && Math.hypot(P.work.x - x, P.work.z - z) > P.work.r + 60) { P.shift = false; shift(false); }
  const tg = target(); beacon.visible = !!tg; if (tg) beacon.position.set(tg.x, 23, tg.z);
  // treasure: ask only while moving, at most every 10 s, and stop once someone has found it
  if (P.hunt && !P.hunt.found_by && now - P.huntT > 10000 && Math.hypot(x - P.huntAt[0], z - P.huntAt[1]) > 12) { P.huntT = now; P.huntAt = [x, z]; API({ action: 'hunt', x: Math.round(x), z: Math.round(z) }).then(r => { if (!r || !r.ok || !r.hunt || !P.on) return; const was = P.hunt; P.hunt = r.hunt;
    if (r.hunt.at && !r.hunt.found_by) { cup.position.set(r.hunt.at.x, 0.2, r.hunt.at.z); cup.visible = true; } else if (r.hunt.found_by) cup.visible = false;
    if (r.hunt.first) { toast('🏆 You found the ' + r.hunt.item + ' first! New stamp in your passport.', 7000); track('play-treasure'); } else if (r.hunt.warm === 'hot' && (!was || was.warm !== 'hot') && !r.hunt.found_by) toast('🔥 The ' + r.hunt.item + ' is very close. Look for the golden light.', 4200); }); }
  const hn = P.hunt ? (P.hunt.found_by ? '🏆 ' + P.hunt.item + ': found by @' + P.hunt.found_by + ' this week' : '🏆 Find the ' + P.hunt.item + (P.hunt.hint ? ' · ' + P.hunt.hint : '') + (P.hunt.warm ? ' · ' + ({ cold: '❄️ cold', warm: '🌤️ warm', hot: '🔥 hot' })[P.hunt.warm] : '')) : ''; if (hn !== P.huntH) { P.huntH = hn; $('pHunt').textContent = hn; }
  if (now - (P.mapT || 0) > 180) { P.mapT = now; minimap(x, z, a); }
}
function minimap(mx, mz, ma) { const g = mapC, S = 400, c = S / 2, sc = 0.9; g.fillStyle = '#cfe0b8'; g.fillRect(0, 0, S, S); const X = x => c + (x - mx) * sc, Y = z => c + (z - mz) * sc;
  g.fillStyle = '#fffaf0'; (DRV.rects || []).forEach(r => { const x0 = X(r.x0), y0 = Y(r.z0), w = (r.x1 - r.x0) * sc, h = (r.z1 - r.z0) * sc; if (x0 > S || y0 > S || x0 + w < 0 || y0 + h < 0) return; g.fillRect(x0, y0, Math.max(2, w), Math.max(2, h)); });
  const dot = (x, z, col, r, txt) => { let px = X(x), py = Y(z); const dx = px - c, dy = py - c, l = Math.hypot(dx, dy), lim = c - 16; if (l > lim) { px = c + dx / l * lim; py = c + dy / l * lim; }   // far things sit on the rim, in their direction
    g.beginPath(); g.arc(px, py, r, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); if (txt) { g.font = '22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, px, py + 1); } };
  stops().forEach(s => { if (Math.hypot(s.x - mx, s.z - mz) < 230) dot(s.x, s.z, '#3f7fbf', 9); });
  S5.friends.forEach(u => { const h = homes.find(q => q.status === 'active' && q.user.toLowerCase() === u); if (h) dot(h.x, h.z, '#c9a24a', 9); });
  (S5.parties || []).forEach(p => { const t = Date.parse(p.start); if (t > Date.now() || t + 36e5 < Date.now()) return; const h = homes.find(q => q.status === 'active' && q.user.toLowerCase() === p.host); if (h) dot(h.x, h.z, '#d88fb0', 12, '🎉'); });
  if (P.work) dot(P.work.x, P.work.z, '#2f7a68', 11, '💼'); dot(P.me.x, P.me.z, '#14233f', 12, '🏠'); if (!DRV.on || P.car !== P.own) dot(P.own.x, P.own.z, '#c8603f', 7);
  if (cup.visible) dot(cup.position.x, cup.position.z, '#f2c14e', 11, '🏆'); const tg = target(); if (tg) dot(tg.x, tg.z, '#e8473a', 10 + (Math.floor(performance.now() / 400) % 2) * 3);
  g.save(); g.translate(c, c); g.rotate(Math.atan2(Math.sin(ma), -Math.cos(ma))); g.beginPath(); g.moveTo(0, -17); g.lineTo(12, 13); g.lineTo(0, 6); g.lineTo(-12, 13); g.closePath(); g.fillStyle = '#c2552d'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.restore();
  g.fillStyle = '#14233f'; g.font = '700 22px Poppins, sans-serif'; g.textAlign = 'center'; g.fillText('N', c, 20); $('pXY').textContent = 'x ' + Math.round(mx) + ' · z ' + Math.round(mz); }
const ZERO4 = new THREE.Matrix4().makeScale(0, 0, 0);
const PLAYHOOK_TICK = (dt, now) => { if (!P.on) return; if (P.lock && DRV.on) DRV.v = 0;
  if (P.body) { P.body.visible = WALK.on; if (WALK.on) { WALK.batches.forEach(b => { b.im.setMatrixAt(0, ZERO4); b.im.instanceMatrix.needsUpdate = true; });   // your own kit citizen stands in for the plain walker
      const d = Math.hypot(WALK.x - P.bodyAt[0], WALK.z - P.bodyAt[1]); P.bodyAt = [WALK.x, WALK.z]; P.bodyPh += d * 2.6; const sw = d > 0.002 ? Math.sin(P.bodyPh) * 0.7 : 0, lm = P.body.userData.limbs || {};
      if (lm.legL) { lm.legL.rotation.x = sw; lm.legR.rotation.x = -sw; } if (lm.armL) { lm.armL.rotation.x = -sw * 0.8; lm.armR.rotation.x = sw * 0.8; }
      P.body.position.set(WALK.x, groundY(WALK.x, WALK.z) + 0.02, WALK.z); P.body.rotation.y = WALK.ang; } }
  if (WALK.on) { vv.set(WALK.x, 2.75, WALK.z).project(camera); pTag.hidden = vv.z >= 1; pTag.style.left = ((vv.x + 1) / 2 * wrap.clientWidth) + 'px'; pTag.style.top = ((1 - vv.y) / 2 * wrap.clientHeight) + 'px'; } else pTag.hidden = true;
  if (cup.visible) cup.rotation.y = now / 700; };

// ---------- buttons and keys ----------
function act(p, el) {
  if (p === 'close') panel(''); else if (p === 'use') use(); else if (p === 'knock') { if (P.knock && P.knock.bid) intercom(P.knock.bid); else if (P.knock) window.VSOC_DO({ action: 'knock', to: P.knock }); }
  else if (p === 'iknock') { const u = el.dataset.u; el.textContent = 'Knocked 👋'; el.disabled = true; window.VSOC_DO({ action: 'knock', to: u }); }
  else if (p === 'trips') (P.panel ? panel('') : tripsPanel()); else if (p === 'trials') (P.panel ? panel('') : trialsPanel()); else if (p === 'board') (P.panel ? panel('') : boardPanel());
  else if (p === 'trip') tripStart(+el.dataset.i); else if (p === 'trial') trialStart(el.dataset.k);
  else if (p === 'ride') { const to = stops().find(s => s.n === el.dataset.n); if (to && P.at) { P.ride = { from: P.at, to, at: nextDep() }; panel(''); toast(P.at.ic + ' Wait here. It leaves in ' + clock((P.ride.at - Date.now()) / 1000) + '.', 3200); } }
  else if (p === 'car') bringCar(); else if (p === 'photo') photo(!P.photo); else if (p === 'selfie') selfie(); else if (p === 'snap') snap();
  else if (p === 'clean') { document.body.classList.add('pclean'); setTimeout(() => document.body.classList.remove('pclean'), 6000); }
  else if (p === 'stop') { if (P.trial) trialEnd('Run stopped.'); else if (P.trip) { P.trip = null; toast('Trip stopped. It did not count.'); } else if (P.ride) { P.ride = null; toast('You are not waiting any more.'); } else if (P.shift) shift(false); }
  else if (p === 'help') panel('<h3>Keys</h3><ol style="list-style:none;padding:0"><li><b>W A S D</b> or arrows: walk and drive · <b>Shift</b>: run · <b>Space</b>: brake · <b>H</b>: horn</li><li><b>E</b>: get in or out of a car, start a shift, use a stop</li><li><b>K</b>: knock on the door of the home you stand at</li><li><b>M</b> trips · <b>T</b> time trials · <b>B</b> this week · <b>C</b> bring my car · <b>P</b> photo</li><li><b>Esc</b>: leave Play</li></ol><p>Basic car 60 km/h. Scooter 40, auto rickshaw 35, van and pickup 50, SUV 55, sedan 65, sports car 90. Time trials always use the same trial car.</p>');
  else if (p === 'leave') leave(); }
function use() { if (P.photo || (P.ride && P.ride.going)) return; if (DRV.on) { if (P.lock || P.trial) return; if (Math.abs(DRV.v) > 1.2) { toast('Stop the car first.', 1600); return; } exitCar(); return; }
  const n = P.near; if (!n) return; if (n.t === 'car') enterCar(n.c); else if (n.t === 'parked') borrow(n.p); else if (n.t === 'work') shift(!P.shift); else if (n.t === 'stop') stopsPanel(n.s); }
hud.addEventListener('click', e => { const el = e.target.closest('[data-p]'); if (el && el.dataset.p) act(el.dataset.p, el); });
addEventListener('keydown', e => { if (!P.on || e.repeat || e.ctrlKey || e.metaKey || (e.target.closest && e.target.closest('input,textarea'))) return; const k = e.key.toLowerCase();
  if (k === 'escape') { if (P.photo) { photo(false); e.stopImmediatePropagation(); } else if (P.panel) { panel(''); e.stopImmediatePropagation(); } return; }
  const m = { e: 'use', k: 'knock', m: 'trips', t: 'trials', b: 'board', p: 'photo', c: 'car' }[k]; if (m && !(P.photo && m !== 'photo')) act(m); }, true);

// ---------- start / leave ----------
function start() { if (P.on) return; const me = S5 && S5.user ? homes.find(h => h.status === 'active' && h.user.toLowerCase() === S5.user) : null; if (!me) return;
  P.on = true; P.me = me; P.work = workOf(me); P.parked = null; hud.hidden = false; document.body.classList.add('playing'); PLAYHOOK.tick = PLAYHOOK_TICK; PLAYHOOK.onStop = cleanup;
  $('pWho').textContent = '@' + me.user; $('pJob').textContent = (me.job ? me.job + ' · ' : '') + (P.work ? 'works at ' + P.work.name : 'Home № ' + me.n); pTag.textContent = '@' + me.user;
  driveRoads(); { const lk = lookOf(me.user) || {}, kind = lk.car && lk.car !== 'carHatch' && KIT && KIT[lk.car] && KMH[lk.car] ? lk.car : '', paint = lk.paint && KITSET.paints[lk.paint], key = kind + '|' + (paint || '');   // "the car you chose" (Vinland Shop) with its paint
    if (!P.own || P.ownKey !== key) { if (P.own) scene.remove(P.own.mesh); P.ownKey = key; const base = carLook(me.user);
      if (kind) { P.own = mkKitCar(kind, { body: paint || base.colour }); P.own.kind = 'own'; P.own.kmh = KMH[kind]; P.own.vmax = KMH[kind] / 3.6; } else P.own = mkCar('own', paint ? Object.assign({}, base, { colour: paint }) : base); } }
  P.cars = [P.own]; park(P.own, me.x, me.z);
  const jc = P.work && jobCar(P.work.role); if (jc) { park(jc, P.own.x + Math.sin(P.own.a) * 7.5, P.own.z + Math.cos(P.own.a) * 7.5); if (Math.hypot(jc.x - P.own.x, jc.z - P.own.z) < 4) park(jc, P.own.x - Math.sin(P.own.a) * 7.5, P.own.z - Math.cos(P.own.a) * 7.5); P.cars.push(jc); }
  DRV.car = P.own.mesh; startWalk(me); const wait = setInterval(() => { if (!WALK.on) return; clearInterval(wait); dress(); mkBody(); stops(); toast('Welcome home, @' + me.user + '. Your car is parked outside. Press E next to it to drive.', 5200); }, 60);
  clearInterval(P.timer); P.timer = setInterval(ui, 100); track('play-start');
  API({ action: 'play' }).then(r => { if (!r || !r.ok || !P.on) { if (r && r.error === 'no session') toast('Please log in again: DM KEY to @buildacountry.', 5200); return; } P.left = r.tripsLeft; P.shift = !!r.myShift; P.hunt = r.hunt; if (r.hunt && r.hunt.found_by) cup.visible = false; }); }
function cleanup() { if (!P.on) return; P.on = false; PLAYHOOK.tick = null; PLAYHOOK.onStop = null; clearInterval(P.timer); if (P.photo) { const ph = P.photo; P.photo = null; controls.minDistance = ph.min; WALK.on = ph.walk; DRV.on = ph.drive; controls.enabled = false; }
  document.body.classList.remove('playing', 'vinphoto', 'pclean'); hud.hidden = true; panel(''); beacon.visible = false; cup.visible = false; $('pFade').hidden = true; P.trip = P.trial = P.ride = null; P.lock = false;
  if (P.shift) { P.shift = false; API({ action: 'shift', on: false }).then(() => window.VSOC_LOAD && window.VSOC_LOAD()); }
  if (P.body) { scene.remove(P.body); P.body = null; } const driving = DRV.on ? DRV.car : null; returnBorrowed(); P.cars.concat(P.tcar ? [P.tcar] : []).forEach(c => { if (c.mesh !== driving) scene.remove(c.mesh); }); DRV_VMAX = 11.2; if (!driving) DRV.car = null; kick(600); }
function leave() { if (!P.on) return; if (P.photo) photo(false); if (!WALK.on && !DRV.on) WALK.on = true; if (DRV.on) stopDrive(); else stopWalk(); }
window.VPLAY = { start, leave, state: P, use, act, ui };
})();
