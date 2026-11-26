// KENNEY PREVIEW (preview_kenney.html only, the live map does not load this): swaps the people near the camera for Kenney mini characters
// in the map's own toon shading. Runs inside the map like life.js. Far-away walkers stay as the old instanced bodies.
(async () => {
if (window.KEN) return; window.KEN = {};

await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'kenney/glb.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
const T = THREE, N_NEAR = PHONE ? 6 : 14, N_STATIC = PHONE ? 3 : 10, R_IN = 55, R_OUT = 80, SCALE = 3.1;
KEN.ms = 0; KEN.built = 0; const tic = () => performance.now();
const HEADS = ['male-a', 'male-b', 'male-d', 'male-e', 'male-f', 'female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f'];
const BODIES = ['male-a', 'male-b', 'male-d', 'male-e', 'male-f', 'female-b', 'female-c', 'female-d', 'female-f'];
const SKINK = [19, 18, 16, 17], CLOTH = [8, 9, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31], HAIRK = [27, 17, 22, 21, 24, 10, 28];
const HEIGHTS = { small: [1, 1], regular: [1, 1], tall: [1, 1] }, SIZE = { small: 0.93, regular: 1, tall: 1.07 }, HIP = 0.17625, ARM = 0.1115, NECK = 0.167;
const lib = {}, base = await loadGLB('kenney/chars/anim.gltf.json');
await Promise.all([...new Set([...HEADS, ...BODIES, 'male-c'])].map(async n => { lib[n] = await loadGLB(`kenney/chars/${n}.gltf.json`); }));
let tex = null; base.scene.traverse(o => { if (o.isSkinnedMesh && !tex) tex = o.material.map; });
const toon = new T.MeshToonMaterial({ map: tex, gradientMap: grad, skinning: true });

// ---- the same mix-and-match logic as the "Make your citizen" page ----
const keyOf = (u, v) => Math.min(3, Math.floor(v * 4)) * 8 + Math.floor(Math.min(15, Math.floor(u * 16)) / 2);
function study(mesh) {
  const g = mesh.geometry, uv = g.attributes.uv.array, P = g.attributes.position.array, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array, idx = g.index.array;
  const names = mesh.skeleton.bones.map(b => b.name), n = uv.length / 2, keys = new Uint8Array(n), bone = [];
  for (let i = 0; i < n; i++) { keys[i] = keyOf(uv[i * 2], uv[i * 2 + 1]); let bi = 0; for (let k = 1; k < 4; k++) if (sw[i * 4 + k] > sw[i * 4 + bi]) bi = k; bone.push(names[si[i * 4 + bi]]); }
  const tris = [], a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), nr = new T.Vector3();
  for (let t = 0; t < idx.length; t += 3) { a.fromArray(P, idx[t] * 3); b.fromArray(P, idx[t + 1] * 3); c.fromArray(P, idx[t + 2] * 3); nr.subVectors(b, a).cross(c.clone().sub(a)); const area = nr.length() / 2; if (!area) continue; nr.normalize(); tris.push({ k: keys[idx[t]], area, x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3, z: (a.z + b.z + c.z) / 3, nz: nr.z, bone: bone[idx[t]] }); }
  return { mesh, names, uv0: Float32Array.from(uv), keys, bone, n, tris };
}
const wmode = (tris, test, skip = [], only = null) => { const c = {}; let best = null, w = 0; for (const t of tris) { if (!test(t) || skip.includes(t.k) || (only && !only.includes(t.k))) continue; c[t.k] = (c[t.k] || 0) + t.area; if (c[t.k] > w) { w = c[t.k]; best = t.k; } } return best; };
const info = {};
for (const n in lib) {
  const ms = {}; lib[n].scene.traverse(o => { if (o.isSkinnedMesh) ms[o.name] = o; });
  const bs = study(ms['body-mesh-m']), hs = study(ms['head-mesh-m']);
  let maxX = 0; for (const t of bs.tris) if (t.bone.startsWith('arm')) maxX = Math.max(maxX, Math.abs(t.x));
  const bskin = wmode(bs.tris, t => t.bone.startsWith('arm') && Math.abs(t.x) > maxX - 0.08, [], SKINK) ?? wmode(bs.tris, () => true, [], SKINK);
  const top = wmode(bs.tris, t => t.bone === 'torso', [bskin]), bot = wmode(bs.tris, t => t.bone.startsWith('leg') && t.y > 0.07, [bskin]);
  let topY = 0; for (const t of hs.tris) topY = Math.max(topY, t.y);
  const fskin = wmode(hs.tris, t => t.nz > 0.6 && t.y > 0.38 && t.y < 0.6, [], SKINK) ?? wmode(hs.tris, () => true, [], SKINK);
  info[n] = { bs, hs, bskin, top, bottom: bot === top ? null : bot, fskin, hair: wmode(hs.tris, t => t.y > topY - 0.1, [fskin]) };
}
const geoCache = new Map();
function partGeo(s, map, height) {
  const ck = s.mesh.uuid + JSON.stringify(map) + height; if (geoCache.has(ck)) return geoCache.get(ck);
  const g = s.mesh.geometry.clone(), uv = new Float32Array(s.uv0);
  for (let i = 0; i < s.n; i++) { const to = map[s.keys[i]]; if (to == null) continue; const fr = s.keys[i]; uv[i * 2] += ((to % 8) - (fr % 8)) / 8; uv[i * 2 + 1] += (Math.floor(to / 8) - Math.floor(fr / 8)) / 4; }
  g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  const [ls, ts] = HEIGHTS[height], P = g.attributes.position.array.slice(); g.setAttribute('position', new T.BufferAttribute(P, 3));
  if (ls !== 1 || ts !== 1) { const dA = HIP * (ls - 1) + ARM * (ts - 1), dH = HIP * (ls - 1) + NECK * (ts - 1), ta = 1 + (ts - 1) * 1.1;
    for (let i = 0; i < s.n; i++) { const bn = s.bone[i], y = P[i * 3 + 1];
      if (bn.startsWith('arm') && Math.abs(P[i * 3]) > 0.0999) { const sx = Math.sign(P[i * 3]) * 0.0999; P[i * 3] = sx + (P[i * 3] - sx) * ta; }
      P[i * 3 + 1] = bn.startsWith('leg') || bn === 'root' ? y * ls : bn === 'torso' ? HIP * ls + (y - HIP) * ts : bn.startsWith('arm') ? y + dA : y + dH; } }
  geoCache.set(ck, g); return g;
}
const clipCache = {};
function clipsFor(height) {
  if (clipCache[height]) return clipCache[height]; const [ls, ts] = HEIGHTS[height], out = {};
  for (const c of base.animations) { if (!['idle', 'walk', 'sprint', 'emote-yes', 'sit', 'pick-up', 'interact-right'].includes(c.name)) continue; const cl = c.clone();
    for (const tr of cl.tracks) { const [node, prop] = tr.name.split('.'); if (prop !== 'position') continue; const f = node.startsWith('leg') || node === 'torso' ? ls : node.startsWith('arm') || node === 'head' ? ts : 1; if (f !== 1) for (let i = 1; i < tr.values.length; i += 3) tr.values[i] *= f; }
    out[c.name] = cl; }
  return (clipCache[height] = out);
}
function makeCitizen(look) {
  const root = base.scene.clone(true), bones = {}; const old = [];
  root.traverse(o => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) old.push(o); }); old.forEach(o => o.parent.remove(o));
  const [ls, ts] = HEIGHTS[look.height];
  for (const n of ['leg-left', 'leg-right', 'torso']) bones[n].position.y *= ls; for (const n of ['arm-left', 'arm-right', 'head']) bones[n].position.y *= ts;
  root.updateMatrixWorld(true);
  const B = info[look.body], H = info[look.head], skin = look.skin ?? H.fskin;
  const bmap = {}; if (B.bskin != null) bmap[B.bskin] = skin; if (look.top != null && B.top != null) bmap[B.top] = look.top; if (look.bottom != null && B.bottom != null) bmap[B.bottom] = look.bottom;
  const hmap = {}; if (H.fskin != null) hmap[H.fskin] = skin; if (look.hair != null && H.hair != null) hmap[H.hair] = look.hair;
  for (const [s, map] of [[B.bs, bmap], [H.hs, hmap]]) {
    const m = new T.SkinnedMesh(partGeo(s, map, look.height), toon); m.castShadow = false; m.frustumCulled = false; root.add(m);
    const sk = new T.Skeleton(s.mesh.skeleton.bones.map(b => bones[b.name])); sk.calculateInverses(); m.bind(sk, m.matrixWorld);
  }
  root.scale.setScalar(SCALE * SIZE[look.height]);
  const mixer = new T.AnimationMixer(root), clips = clipsFor(look.height), acts = {}; for (const k in clips) acts[k] = mixer.clipAction(clips[k]);
  const c = { root, mixer, acts, cur: null, play(n, f = 0.25) { if (c.cur === n) return; acts[n].reset().fadeIn(f).play(); if (c.cur) acts[c.cur].fadeOut(f); c.cur = n; } };
  c.play('idle', 0); scene.add(root); KEN.built++; return c;
}
const pick = (a, h, sh) => a[(h >>> sh) % a.length];
function lookOf(user) { const h = hashStr(user) >>> 0; return { height: pick(['regular', 'tall', 'small', 'regular'], h, 1), head: pick(HEADS, h, 3), body: pick(BODIES, h, 7), skin: pick(SKINK, h, 11), hair: (h >>> 13) % 3 ? null : pick(HAIRK, h, 15), top: (h >>> 17) % 2 ? null : pick(CLOTH, h, 19), bottom: (h >>> 23) % 2 ? null : pick(CLOTH, h, 25) }; }
KEN.makeCitizen = makeCitizen; KEN.lookOf = lookOf;

// ---- walkers near the camera become Kenney citizens; their old instanced body is hidden ----
const pool = [], ZERO = new T.Matrix4().makeScale(0, 0, 0), M4 = new T.Matrix4(), PV = new T.Vector3(), QV = new T.Quaternion(), SV = new T.Vector3(), EU = new T.Euler();
let assigned = new Map(), lastPick = 0; const byUser = new Map();
function hideIdx(i) { const { body, legL, legR } = walkers.batches; [...body, ...legL, ...legR].forEach(b => b.im.setMatrixAt(i, ZERO)); }
function posOf(i) { walkers.batches.body[0].im.getMatrixAt(i, M4); return PV.setFromMatrixPosition(M4); }
function citizenFor(u) { let c = byUser.get(u); if (!c) { c = makeCitizen(lookOf(u)); c.user = u; byUser.set(u, c); } c.root.visible = true; return c; }
const origUpdate = updatePeople;
updatePeople = function (dt, now) {
  origUpdate(dt, now);
  if (!walkers.batches) return; const t0 = tic();
  const tg = WALK.on ? { x: WALK.x, z: WALK.z } : controls.target;
  if (now - lastPick > 700) { lastPick = now;
    for (const [i, c] of assigned) { const p = posOf(i); if ((p.x - tg.x) ** 2 + (p.z - tg.z) ** 2 > R_OUT * R_OUT) { c.root.visible = false; assigned.delete(i); } }   // drop only when well away
    if (assigned.size < N_NEAR) { const cand = []; walkers.forEach((w, i) => { if (assigned.has(i)) return; const p = posOf(i), d = (p.x - tg.x) ** 2 + (p.z - tg.z) ** 2; if (d < R_IN * R_IN) cand.push([i, d]); });
      cand.sort((a, b) => a[1] - b[1]).slice(0, Math.min(2, N_NEAR - assigned.size)).forEach(([i]) => assigned.set(i, citizenFor(walkers[i].h.user))); } }   // at most 2 new people per check: no stutter
  for (const [i, c] of assigned) {
    const p = posOf(i); M4.decompose(PV, QV, SV);
    if (SV.x > 0.01) { EU.setFromQuaternion(QV, 'YXZ'); c.root.position.set(PV.x, 0.14, PV.z); c.root.rotation.y = EU.y; }
    hideIdx(i); c.play('walk'); c.mixer.update(Math.min(dt, 0.1) * Math.min(1.6, walkers[i].speed));
  }
  if (assigned.size) { const { body, legL, legR } = walkers.batches; [...body, ...legL, ...legR].forEach(b => b.im.instanceMatrix.needsUpdate = true); }
  KEN.ms += tic() - t0;
};

// ---- people who stand still (shop owners, staff, the police line): the ones near the camera become Kenney citizens ----
const wset = new Set([...walkers.batches.body, ...walkers.batches.legL, ...walkers.batches.legR].map(b => b.im)), groups = [];
for (const o of peopleObjs) { if (wset.has(o.im) || !o.im.count) continue; o.im.getMatrixAt(0, M4); const key = o.im.count + ':' + M4.elements.map(v => v.toFixed(2)).join(','); const last = groups[groups.length - 1];
  if (last && last.key === key) last.parts.push(o.im); else groups.push({ key, parts: [o.im] }); }
const statics = [];
groups.forEach((g, gi) => { for (let i = 0; i < g.parts[0].count; i++) { const m = new T.Matrix4(); g.parts[0].getMatrixAt(i, m); const p = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3(); m.decompose(p, q, sc); const e = new T.Euler().setFromQuaternion(q, 'YXZ');
  const cop = standers.find(s => Math.abs(s.x - p.x) < 0.2 && Math.abs(s.z - p.z) < 0.2); statics.push({ g, i, m, x: p.x, z: p.z, ry: e.y, user: cop ? cop.h.user : 'static' + gi + '-' + i, cop: !!cop }); } });
let sAssigned = new Map(), sLast = 0; const sBuilt = new Map();
function staticsFrame(dt, now) {
  const t0 = tic(), tg = WALK.on ? { x: WALK.x, z: WALK.z } : controls.target;
  if (now - sLast > 900) { sLast = now;
    for (const [k, c] of sAssigned) { const s = statics[k]; if ((s.x - tg.x) ** 2 + (s.z - tg.z) ** 2 > R_OUT * R_OUT) { c.root.visible = false; s.g.parts.forEach(im => { im.setMatrixAt(s.i, s.m); im.instanceMatrix.needsUpdate = true; }); sAssigned.delete(k); } }
    if (sAssigned.size < N_STATIC) { const cand = statics.map((s, k) => [k, (s.x - tg.x) ** 2 + (s.z - tg.z) ** 2]).filter(x => !sAssigned.has(x[0]) && x[1] < R_IN * R_IN).sort((a, b) => a[1] - b[1]).slice(0, Math.min(2, N_STATIC - sAssigned.size));
      for (const [k] of cand) { const s = statics[k]; let c = sBuilt.get(k);
        if (!c) { const lk = lookOf(s.user); if (s.cop) Object.assign(lk, { head: 'male-c', body: 'male-c', top: null, bottom: null, hair: null }); c = makeCitizen(lk); c.root.position.set(s.x, 0.14, s.z); c.root.rotation.y = s.ry; sBuilt.set(k, c); }
        c.root.visible = true; s.g.parts.forEach(im => { im.setMatrixAt(s.i, ZERO); im.instanceMatrix.needsUpdate = true; }); sAssigned.set(k, c); } } }
  for (const c of sAssigned.values()) c.mixer.update(Math.min(dt, 0.1));
  KEN.ms += tic() - t0;
}
const prevUP = updatePeople; updatePeople = function (dt, now) { prevUP(dt, now); staticsFrame(dt, now); };

if (!window.VGAME) {   // the game (?game) has no cars at all (Dev, 26 Nov)
// ---- cars: the moving and parked cars become Kenney cars, in the map's toon shading ----
const CARMAP = { carHatch: 'hatchback-sports', carSedan: 'sedan', carSUV: 'suv', carTaxi: 'taxi', carVan: 'van', carPickup: 'truck', carSports: 'sedan-sports' }, CAR_SCALE = 1.7;
const carLib = {}; await Promise.all([...new Set(Object.values(CARMAP))].map(async n => { carLib[n] = await loadGLB(`kenney/cars/${n}.gltf.json`); }));
let carTex = null; Object.values(carLib).forEach(g => g.scene.traverse(o => { if (o.isMesh && !carTex) carTex = o.material.map; }));
const carMat = new T.MeshToonMaterial({ map: carTex, gradientMap: grad }), SCM = new T.Matrix4().makeScale(CAR_SCALE, CAR_SCALE, CAR_SCALE);
function carInst(name, n) { const g = carLib[name].scene, out = []; g.updateMatrixWorld(true);
  g.traverse(o => { if (!o.isMesh) return; const geo = o.geometry.clone().applyMatrix4(o.matrixWorld); const im = new T.InstancedMesh(geo, carMat, Math.max(1, n)); im.count = n; im.castShadow = !FAST; im.frustumCulled = false; scene.add(im); out.push(im); });
  return out; }
const VK = window.VinlandKit || {}, TYPES = (FAST ? ['carHatch'] : ['carHatch', 'carSedan', 'carSUV', 'carTaxi', 'autoRickshaw', 'scooter', 'carVan', 'carPickup', 'carSports']).filter(k => VK[k]);
const typeOrder = []; LIFE.cars.forEach(c => { if (!typeOrder.includes(c.meshes)) typeOrder.push(c.meshes); });
const moving = []; const byModel = {};
LIFE.cars.forEach(c => { const kind = TYPES[typeOrder.indexOf(c.meshes)], model = CARMAP[kind]; if (!model) return; (byModel[model] = byModel[model] || []).push(c); });
for (const model in byModel) { const ims = carInst(model, byModel[model].length); byModel[model].forEach((c, j) => moving.push({ c, ims, j })); }
for (const kind in CARMAP) { const list = LIFE.mats && LIFE.mats[kind]; if (!list || !list.length || !LIFE.inst[kind]) continue; LIFE.inst[kind].visible = false;
  const ims = carInst(CARMAP[kind], list.length); list.forEach((m, j) => { M4.multiplyMatrices(m, SCM); ims.forEach(im => im.setMatrixAt(j, M4)); }); ims.forEach(im => im.instanceMatrix.needsUpdate = true); }
const prevTraffic = updateTraffic;
updateTraffic = function (dt) { prevTraffic(dt); const t0 = tic();
  for (const { c, ims, j } of moving) { c.meshes[0].getMatrixAt(c.i, M4); if (M4.elements[0] === 0 && M4.elements[5] === 0) continue; const mm = M4.clone().multiply(SCM); ims.forEach(im => { im.setMatrixAt(j, mm); im.instanceMatrix.needsUpdate = true; }); c.meshes.forEach(m => { m.setMatrixAt(c.i, ZERO); m.instanceMatrix.needsUpdate = true; }); } KEN.ms += tic() - t0; };

}
// ---- you, in walk mode ----
let me = null; const myLook = (() => { try { return JSON.parse(localStorage.getItem('vinland-look')); } catch (e) { return null; } })();
const prevTick = PLAYHOOK.tick;
PLAYHOOK.tick = (dt, now) => { if (prevTick) prevTick(dt, now);
  if (!me) { const ml = myLook && info[myLook.head] ? Object.assign({}, myLook) : lookOf(WALK.me || 'me'); if (!SIZE[ml.height]) ml.height = 'regular'; me = makeCitizen(ml); }
  me.root.visible = true; me.root.position.set(WALK.x, 0.14 + (WALK.jy || 0), WALK.z); me.root.rotation.y = WALK.ang + (WALK.spin || 0);
  me.play(WALK.moving ? (WALK.keys.shift ? 'sprint' : 'walk') : 'idle'); me.mixer.update(dt);
  // a higher, further camera, like the look test: you see yourself, the street and the sky
  { const want = wrap.clientWidth < wrap.clientHeight ? 15 : 12, pt = Math.max(WALK.pitch, 0.34) + 0.12, cp = Math.cos(pt), bx = -Math.sin(WALK.yaw), bz = -Math.cos(WALK.yaw);
    let d = 1.5; while (d < want && !blockedAt(WALK.x + bx * d * cp, WALK.z + bz * d * cp)) d += 0.25; KEN.cd = KEN.cd ? (d < KEN.cd ? d : KEN.cd + (d - KEN.cd) * Math.min(1, dt * 3)) : d;
    camera.position.set(WALK.x + bx * KEN.cd * cp, 1.4 + Math.sin(pt) * KEN.cd, WALK.z + bz * KEN.cd * cp); camera.lookAt(WALK.x, 2.4, WALK.z); }
  WALK.parts.body.concat(WALK.parts.legL, WALK.parts.legR).forEach(b => { b.im.setMatrixAt(0, ZERO); b.im.instanceMatrix.needsUpdate = true; });
};
const prevStop = PLAYHOOK.onStop; PLAYHOOK.onStop = () => { if (prevStop) prevStop(); if (me) me.root.visible = false; };
console.log('kenney citizens on');
if (!window.VGAME) { const b = document.createElement('div'); b.textContent = 'Preview: Kenney citizens + cars'; b.style.cssText = 'position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:60;background:#1f8a8a;color:#fff;font:700 13px/1 Poppins,system-ui,sans-serif;padding:7px 12px;border-radius:999px;pointer-events:none'; document.body.appendChild(b); }
})().catch(e => console.error('kenney', e));
