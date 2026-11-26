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
#czClock { top: calc(10px + env(safe-area-inset-top)); left: calc(10px + env(safe-area-inset-left)); display: flex; gap: 8px; align-items: center; }
#czTimes { top: calc(10px + env(safe-area-inset-top)); right: calc(10px + env(safe-area-inset-right)); display: flex; gap: 4px; padding: 4px !important; }
#czTimes button { border: 0; border-radius: 10px; padding: 6px 10px; min-height: 36px; font: 700 14px Poppins, system-ui, sans-serif; background: transparent; color: #fff; cursor: pointer; }
#czTimes button[aria-pressed=true] { background: #fff; color: #1c2238; }
#czFps { bottom: 6px; left: 50%; transform: translateX(-50%); font-size: 11px; padding: 2px 10px !important; opacity: .85; }
#czStick { position: absolute; left: calc(24px + env(safe-area-inset-left)); bottom: 22px; width: 118px; height: 118px; border-radius: 50%; background: rgba(255,255,255,.18); border: 3px solid rgba(255,255,255,.75); z-index: 3; touch-action: none; }
#czKnob { position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%; background: rgba(255,255,255,.92); }
#czRun { position: absolute; right: calc(24px + env(safe-area-inset-right)); bottom: 26px; width: 66px; height: 66px; border-radius: 50%; border: 0; background: #2e9c8a; color: #fff; font: 800 15px Poppins, system-ui, sans-serif; box-shadow: 0 4px 0 #1f6b5f; z-index: 3; cursor: pointer; }
#czRun[aria-pressed=true] { background: #ffd24a; color: #1c2238; box-shadow: 0 4px 0 #a5801c; }
#czLoad { position: absolute; inset: 0; z-index: 9; display: grid; place-items: center; background: linear-gradient(#b6d8ef, #f1f4ee); color: #1c2238; font-size: 22px; font-weight: 800; text-align: center; transition: opacity .4s; }
#czLoad small { display: block; font-size: 14px; font-weight: 600; opacity: .7; }
@media (prefers-reduced-motion: reduce) { #czLoad { transition: none; } }`;
document.head.appendChild(css);
const root = document.createElement('div'); root.id = 'cozy';
root.innerHTML = `<div id="czLoad"><div>Building cozy Vinland…<small id="czLt">copying our homes, plaza and streets</small></div></div>
<div class="chip" id="czClock"><span id="czIco">☀️</span><span id="czCt">…</span></div>
<div class="chip" id="czTimes" role="group" aria-label="Time of day"><button data-h="live" aria-pressed="true">Live</button><button data-h="12" aria-pressed="false">Noon</button><button data-h="17.4" aria-pressed="false">Sunset</button><button data-h="21" aria-pressed="false">Night</button></div>
<div class="chip" id="czFps">…</div><div id="czStick"><div id="czKnob"></div></div><button id="czRun" aria-pressed="false">Run</button>`;
document.body.appendChild(root);
const $ = id => document.getElementById(id), lt = $('czLt');

// ---------- 1. wait until the map has built everything (homes, street life, downtown, looks) ----------
const t0 = performance.now();
while (!(LIFE.on || performance.now() - t0 > 9000)) await wait(250);
await wait(1200);
if (!WALK.grid) { try { buildWalkGrid(); } catch (e) { console.warn('cozy: walk grid', e); } }   // the map's own "where can you walk" rule, built before we take its meshes away
renderer.render = () => {};   // the map stops drawing: everything below is drawn by the cozy screen
renderer.domElement.style.visibility = 'hidden';
lt.textContent = 'cutting the country into squares';
await wait(30);

// ---------- 2. copy the map: each shape once, each place it stands, cut into squares ----------
const TILE = 128, KOFF = 1000, kOf = (ix, iz) => (ix + KOFF) * 10000 + (iz + KOFF), tkey = (x, z) => kOf(Math.floor(x / TILE), Math.floor(z / TILE)), kX = k => Math.floor(k / 10000) - KOFF, kZ = k => k % 10000 - KOFF;   // square numbers are always positive
const B_MAIN = 0, B_MAIND = 1, B_GLASS = 2, B_WARM = 3, B_LAMP = 4, B_WATER = 5, B_TEX = 16;
const GLASS = 0x3f5866, WARM = 0xf0c36a, LAMPS = new Set([0xf6d27a, 0xffd98a]), WATER = 0x5ab4d0;
const REMAP = { 0x86ab5c: 0x8fc25a, 0x76a052: 0x84b74f, 0x93b865: 0x9ccb63, 0x3f6f3a: 0x3f7a45, 0x45474d: 0x55585f };
const skip = new Set();   // things that move: walkers, cars, buses, trains, the ferry
try { const wb = walkers.batches || {}; Object.values(wb).forEach(list => (list || []).forEach(x => skip.add(x.im || x))); } catch (e) {}
try { LIFE.cars.forEach(c => (c.meshes || []).forEach(m => { skip.add(m); if (m.parent) skip.add(m.parent); })); ['carHatch', 'carSedan', 'carSUV', 'carTaxi', 'carVan', 'carPickup', 'carSports', 'scooter', 'autoRickshaw'].forEach(k => LIFE.inst && LIFE.inst[k] && skip.add(LIFE.inst[k])); } catch (e) {}
try { TRANSIT.list.forEach(l => l.cars.forEach(c => skip.add(c.m))); } catch (e) {}
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
const bucketOf = (rgb, m) => m.map ? B_TEX + texId(m) : rgb === GLASS ? B_GLASS : rgb === WARM ? B_WARM : LAMPS.has(rgb) ? B_LAMP : rgb === WATER ? B_WATER : m.side === T.DoubleSide ? B_MAIND : B_MAIN;
function texId(m) { const k = m.map.uuid + (m.transparent ? 't' : '') + (m.type === 'MeshBasicMaterial' ? 'b' : '') + (m.side === T.DoubleSide ? 'd' : ''); if (texOf.has(k)) return texOf.get(k);
  const id = textures.length; textures.push({ image: m.map.image, flipY: m.map.flipY, wrapS: m.map.wrapS, wrapT: m.map.wrapT, repeat: m.map.repeat.clone(), offset: m.map.offset.clone(), tr: m.transparent, op: m.opacity, basic: m.type === 'MeshBasicMaterial', ds: m.side === T.DoubleSide }); texOf.set(k, id); return id; }
function shapeId(g, gi, start, count, withUv) { const k = g.uuid + ':' + gi + ':' + (withUv ? 1 : 0); if (shapeOf.has(k)) return shapeOf.get(k);
  const pos = g.attributes.position, idx = g.index, col = g.attributes.color, uv = g.attributes.uv, P = new Float32Array(count * 3), C = col ? new Uint8Array(count * 3) : null, U = withUv && uv ? new Float32Array(count * 2) : null; const cs = colScale(col);
  for (let i = 0; i < count; i++) { const v = idx ? idx.getX(start + i) : start + i; P[i * 3] = pos.getX(v); P[i * 3 + 1] = pos.getY(v); P[i * 3 + 2] = pos.getZ(v);
    if (C) { C[i * 3] = Math.round(Math.min(1, col.getX(v) * cs) * 255); C[i * 3 + 1] = Math.round(Math.min(1, col.getY(v) * cs) * 255); C[i * 3 + 2] = Math.round(Math.min(1, col.getZ(v) * cs) * 255); }
    if (U) { U[i * 2] = uv.getX(v); U[i * 2 + 1] = uv.getY(v); } }
  let r2 = 0; for (let i = 0; i < count; i++) r2 = Math.max(r2, P[i * 3] ** 2 + P[i * 3 + 1] ** 2 + P[i * 3 + 2] ** 2);
  const id = shapes.length; shapes.push({ P, C, U, n: count, r: Math.sqrt(r2) }); shapeOf.set(k, id); return id; }
const V = new T.Vector3(), M4 = new T.Matrix4(), CL = new T.Color();
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
  for (const gr of groups) { const m = mats[gr.materialIndex] || mats[0]; if (!m || m.visible === false) continue; const cnt = Math.min(gr.count, total - gr.start); if (cnt < 3) continue;
    let rgb = m.color ? hex(m.color) : 0xffffff; rgb = REMAP[rgb] || rgb; const b = bucketOf(rgb, m);
    if (rad > 30) worldPieces(g, gr.start, cnt, o.matrixWorld, rgb, b, !!m.map);
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
const R3 = new T.WebGLRenderer({ antialias: !PH, powerPreference: 'high-performance' });
R3.setPixelRatio(Math.min(devicePixelRatio, PH ? 1.5 : 2)); R3.setSize(innerWidth, innerHeight);
R3.outputEncoding = T.sRGBEncoding; R3.toneMapping = T.NoToneMapping;
R3.shadowMap.enabled = !PH; R3.shadowMap.type = T.PCFSoftShadowMap;
root.prepend(R3.domElement);
const S3 = new T.Scene(), CAM = new T.PerspectiveCamera(innerWidth > innerHeight ? 40 : 46, innerWidth / innerHeight, 0.5, 900);
addEventListener('resize', () => { R3.setSize(innerWidth, innerHeight); CAM.aspect = innerWidth / innerHeight; CAM.fov = innerWidth > innerHeight ? 40 : 46; CAM.updateProjectionMatrix(); });
const lin = h => new T.Color(h).convertSRGBToLinear();
S3.fog = new T.Fog(0xb6d8ef, PH ? 85 : 110, PH ? 165 : 205);
const VIEW = PH ? 165 : 215;   // squares within this distance are built
// one material for everything solid; vertex colours are stored as small sRGB bytes and made linear in the shader
const srgbColors = m => { m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb = pow(color.rgb, vec3(2.2));\n#endif'); }; return m; };
const MAT = o => srgbColors(PH ? new T.MeshLambertMaterial(o) : new T.MeshStandardMaterial(Object.assign({ roughness: 0.86, metalness: 0, flatShading: true }, o)));
const MS = { [B_MAIN]: MAT({ vertexColors: true }), [B_MAIND]: MAT({ vertexColors: true, side: T.DoubleSide }),
  [B_GLASS]: new T.MeshBasicMaterial({ color: lin('#2c3644') }), glassLow: new T.MeshBasicMaterial({ color: lin('#3f5866') }), [B_WARM]: new T.MeshBasicMaterial({ color: lin('#e8b45e') }), [B_LAMP]: new T.MeshBasicMaterial({ color: lin('#f6d27a') }),
  [B_WATER]: srgbColors(new T.MeshStandardMaterial({ color: lin('#3fa3c4'), roughness: 0.28, metalness: 0.05, transparent: true, opacity: 0.95 })) };
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
function lowShape(S) {   // the same shape with its corners snapped to a 70 cm grid: details melt away, the outline and colours stay
  if (S.lo) return S.lo; const P = S.P, keep = [], q = v => Math.round(v / LOCELL) * LOCELL;
  for (let t = 0; t < S.n; t += 3) { const a = [q(P[t * 3]), q(P[t * 3 + 1]), q(P[t * 3 + 2])], b = [q(P[t * 3 + 3]), q(P[t * 3 + 4]), q(P[t * 3 + 5])], c = [q(P[t * 3 + 6]), q(P[t * 3 + 7]), q(P[t * 3 + 8])];
    const same = (u, v) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2]; if (same(a, b) || same(b, c) || same(a, c)) continue;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-4) continue;
    keep.push(t, a, b, c); }
  const n = keep.length / 4 * 3, P2 = new Float32Array(n * 3), C2 = S.C ? new Uint8Array(n * 3) : null; const seen = new Set(); let o = 0;
  for (let i = 0; i < keep.length; i += 4) { const t = keep[i], key = [keep[i + 1], keep[i + 2], keep[i + 3]].map(v => v.join(',')).sort().join('|'); if (seen.has(key)) continue; seen.add(key);
    for (let j = 0; j < 3; j++) { P2.set(keep[i + 1 + j], (o + j) * 3); if (C2) C2.set(S.C.subarray((t + j) * 3, (t + j) * 3 + 3), (o + j) * 3); } o += 3; }
  return (S.lo = { P: P2.subarray(0, o * 3), C: C2 ? C2.subarray(0, o * 3) : null, U: null, n: o, r: S.r }); }
// what the ground is, metre by metre, in each square: 1 = grass (green), 2 = anything else (sand, paving, plaza, water). Nature only grows on 1.
const ground = new Map();
function rasterGround(Gr, Hy, ox, oz, ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b) {
  if (Math.max(ay, by, cy) > 0.7) return; const ux = bx - ax, uz = bz - az, vx = cx - ax, vz = cz - az, den = ux * vz - uz * vx; if (Math.abs(den) < 1e-6) return;
  const ny = ((by - ay) * vz - (bz - az) * (cy - ay)); // only roughly flat faces matter; steep ones are walls
  if (Math.abs((by - ay)) > 0.3 || Math.abs(cy - ay) > 0.3) return;
  const grassy = g > r * 1.04 && g > b * 1.15 ? 1 : 2, y = (ay + by + cy) / 3;
  const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - ox)), i1 = Math.min(TILE - 1, Math.floor(Math.max(ax, bx, cx) - ox)), j0 = Math.max(0, Math.floor(Math.min(az, bz, cz) - oz)), j1 = Math.min(TILE - 1, Math.floor(Math.max(az, bz, cz) - oz));
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const px = ox + i + 0.5 - ax, pz = oz + j + 0.5 - az, s1 = (px * vz - pz * vx) / den, s2 = (ux * pz - uz * px) / den; if (s1 < -0.01 || s2 < -0.01 || s1 + s2 > 1.01) continue;
    const c = j * TILE + i; if (y >= Hy[c]) { Hy[c] = y; Gr[c] = grassy; } } }
function buildTile(k, lod) {
  const ox = kX(k) * TILE, oz = kZ(k) * TILE;
  const all = tilePlaces.get(k) || [], pieces = chunks.get(k) || [];
  const list = lod ? all.filter(i => { const q = i * 12, m = PL.m, sc = Math.sqrt(m[q] ** 2 + m[q + 1] ** 2 + m[q + 2] ** 2); return keepFar(PL.b[i]) || shapes[PL.s[i]].r * sc >= SMALL; }) : all;
  const tiny = (P, t) => { let e = 0; for (let j = 0; j < 3; j++) { const a = t * 3 + j * 3, b = t * 3 + ((j + 1) % 3) * 3; e = Math.max(e, Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2])); } return e < TINY; };
  // count vertices per bucket
  const cnt = {}; const add = (b, n) => cnt[b] = (cnt[b] || 0) + n;
  const shapeFor = i => { const S = shapes[PL.s[i]]; return lod && !keepFar(PL.b[i]) && S.n > 24 ? lowShape(S) : S; };
  for (const i of list) add(PL.b[i], shapeFor(i).n);
  for (const p of pieces) { if (!lod || keepFar(p.b)) { add(p.b, p.P.length / 3); continue; } let n = 0; for (let t = 0; t < p.P.length / 3; t += 3) if (!tiny(p.P, t)) n += 3; add(p.b, n); }
  const out = {};
  for (const b in cnt) out[b] = { P: new Int16Array(cnt[b] * 3), N: new Int8Array(cnt[b] * 3), C: new Uint8Array(cnt[b] * 3), U: +b >= B_TEX ? new Float32Array(cnt[b] * 2) : null, o: 0, far: [] };
  const glow = new Map(), addGlow = (x, y, z) => { const g = Math.round(x / 1.1) + ',' + Math.round(y / 1.1) + ',' + Math.round(z / 1.1); if (!glow.has(g)) glow.set(g, [x, y, z]); };
  const put = (b, ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1, r2, g2, b2, r3, g3, b3, u) => { const O = out[b]; const lx = [ax - ox, bx - ox, cx - ox], ly = [ay, by, cy], lz = [az - oz, bz - oz, cz - oz];
    if (lx.some(v => Math.abs(v) > 320) || lz.some(v => Math.abs(v) > 320) || ly.some(v => Math.abs(v) > 320)) { O.far.push([ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1]); return; }
    PA.set(bx - ax, by - ay, bz - az); PB.set(cx - ax, cy - ay, cz - az); NA.crossVectors(PA, PB).normalize();
    const n0 = Math.round(NA.x * 127), n1 = Math.round(NA.y * 127), n2 = Math.round(NA.z * 127), o = O.o;
    for (let j = 0; j < 3; j++) { const d = (o + j) * 3; O.P[d] = Math.round(lx[j] * 100); O.P[d + 1] = Math.round(ly[j] * 100); O.P[d + 2] = Math.round(lz[j] * 100); O.N[d] = n0; O.N[d + 1] = n1; O.N[d + 2] = n2; }
    O.C[o * 3] = r1; O.C[o * 3 + 1] = g1; O.C[o * 3 + 2] = b1; O.C[o * 3 + 3] = r2; O.C[o * 3 + 4] = g2; O.C[o * 3 + 5] = b2; O.C[o * 3 + 6] = r3; O.C[o * 3 + 7] = g3; O.C[o * 3 + 8] = b3;
    if (u && O.U) O.U.set(u, o * 2); O.o += 3;
    if ((b === B_GLASS || b === B_WARM) && (ay + by + cy) / 3 >= LOWGLASS || b === B_LAMP) addGlow((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3); };
  const UV = new Float32Array(6);
  const Gr = new Uint8Array(TILE * TILE), Hy = new Float32Array(TILE * TILE).fill(-9);
  for (const p of huge) { if (p.b >= B_TEX) continue; const P = p.P, C = p.C; for (let t = 0; t < P.length / 3; t += 3) rasterGround(Gr, Hy, ox, oz, P[t * 3], P[t * 3 + 1], P[t * 3 + 2], P[t * 3 + 3], P[t * 3 + 4], P[t * 3 + 5], P[t * 3 + 6], P[t * 3 + 7], P[t * 3 + 8], C[t * 3], C[t * 3 + 1], C[t * 3 + 2]); }
  const put0 = put; const putG = (b, ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1, ...rest) => { if (b === B_MAIN || b === B_MAIND || b === B_WATER) rasterGround(Gr, Hy, ox, oz, ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1); put0(b, ax, ay, az, bx, by, bz, cx, cy, cz, r1, g1, b1, ...rest); };
  for (const i of list) { const sid = PL.s[i], b = PL.b[i], rgb = PL.c[i], S = shapeFor(i), q = i * 12, m = PL.m; MM.set(m[q], m[q + 3], m[q + 6], m[q + 9], m[q + 1], m[q + 4], m[q + 7], m[q + 10], m[q + 2], m[q + 5], m[q + 8], m[q + 11], 0, 0, 0, 1); const flip = MM.determinant() < 0, e = MM.elements;
    const R = rgb >> 16 & 255, G = rgb >> 8 & 255, Bc = rgb & 255;
    for (let t = 0; t < S.n; t += 3) { const ia = t, ib = flip ? t + 2 : t + 1, ic = flip ? t + 1 : t + 2, P = S.P;
      const tr = (q, v) => { const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2]; v.set(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]); };
      tr(ia, PA); tr(ib, PB); tr(ic, PC); const ax = PA.x, ay = PA.y, az = PA.z, bx = PB.x, by = PB.y, bz = PB.z, cx = PC.x, cy = PC.y, cz = PC.z;
      const cc = (q, ch, base) => S.C ? Math.round(S.C[q * 3 + ch] * base / 255) : base;
      if (S.U) { UV[0] = S.U[ia * 2]; UV[1] = S.U[ia * 2 + 1]; UV[2] = S.U[ib * 2]; UV[3] = S.U[ib * 2 + 1]; UV[4] = S.U[ic * 2]; UV[5] = S.U[ic * 2 + 1]; }
      putG(b, ax, ay, az, bx, by, bz, cx, cy, cz, cc(ia, 0, R), cc(ia, 1, G), cc(ia, 2, Bc), cc(ib, 0, R), cc(ib, 1, G), cc(ib, 2, Bc), cc(ic, 0, R), cc(ic, 1, G), cc(ic, 2, Bc), S.U ? UV : null); } }
  for (const p of pieces) { const P = p.P, C = p.C, skipTiny = lod && !keepFar(p.b); for (let t = 0; t < P.length / 3; t += 3) { if (skipTiny && tiny(P, t)) continue; if (p.U) UV.set(p.U.subarray(t * 2, t * 2 + 6));
    putG(p.b, P[t * 3], P[t * 3 + 1], P[t * 3 + 2], P[t * 3 + 3], P[t * 3 + 4], P[t * 3 + 5], P[t * 3 + 6], P[t * 3 + 7], P[t * 3 + 8], C[t * 3], C[t * 3 + 1], C[t * 3 + 2], C[t * 3 + 3], C[t * 3 + 4], C[t * 3 + 5], C[t * 3 + 6], C[t * 3 + 7], C[t * 3 + 8], p.U ? UV : null); } }
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
    const mesh = new T.Mesh(g, MS[b]); mesh.castShadow = +b === B_MAIN || +b === B_MAIND; mesh.receiveShadow = +b !== B_GLASS && +b !== B_WARM && +b !== B_LAMP; grp.add(mesh);
    if (O.far.length) { const F = new Float32Array(O.far.length * 9), FC = new Uint8Array(O.far.length * 9); O.far.forEach((f, q) => { F.set(f.slice(0, 9), q * 9); for (let j = 0; j < 3; j++) { FC[q * 9 + j * 3] = f[9]; FC[q * 9 + j * 3 + 1] = f[10]; FC[q * 9 + j * 3 + 2] = f[11]; } });
      const gf = new T.BufferGeometry(); gf.setAttribute('position', new T.BufferAttribute(F, 3)); gf.setAttribute('color', new T.BufferAttribute(FC, 3, true)); gf.computeVertexNormals(); const mf = new T.Mesh(gf, MS[b]); mf.receiveShadow = true; mf.userData.world = true; S3.add(mf); (tilesExtra.get(k) || tilesExtra.set(k, []).get(k)).push(mf); } }
  if (glow.size) { const gp = []; for (const [x, y, z] of glow.values()) gp.push((x - ox) * 100, y * 100, (z - oz) * 100); const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(gp, 3)); gg.computeBoundingSphere(); const pts = new T.Points(gg, glowMat); grp.add(pts); }
  grp.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); grp.updateMatrixWorld(true);
  ground.set(k, Gr);
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
function dropTile(k) { ground.delete(k); const g = tiles.get(k); if (!g) return; S3.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); tiles.delete(k); (tilesExtra.get(k) || []).forEach(m => { S3.remove(m); m.geometry.dispose(); }); tilesExtra.delete(k); }
// giant triangles (the ground under everything, the sea): one mesh each, always drawn
huge.forEach(p => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p.P, 3)); g.setAttribute('color', new T.BufferAttribute(p.C, 3, true)); if (p.U) g.setAttribute('uv', new T.BufferAttribute(p.U, 2)); g.computeVertexNormals(); const m = new T.Mesh(g, MS[p.b] || MS[B_MAIN]); m.receiveShadow = true; S3.add(m); });
function wanted(px, pz) { const out = []; const r = Math.ceil(VIEW / TILE) + 1, cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE);
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const x0 = (cx + i) * TILE, z0 = (cz + j) * TILE, dx = Math.max(x0 - px, 0, px - x0 - TILE), dz = Math.max(z0 - pz, 0, pz - z0 - TILE), d = Math.hypot(dx, dz); if (d < VIEW) out.push([kOf(cx + i, cz + j), d]); }
  return out.sort((a, b) => a[1] - b[1]); }
function stream(px, pz, all) { const w = wanted(px, pz), need = new Set(w.map(a => a[0])); let n = 0;
  for (const [k, d] of w) { const want = d < NEAR ? 0 : 1, have = tiles.get(k);
    if (have === null || (have && have.userData.lod === want)) continue; if (!have && !tilePlaces.has(k) && !chunks.has(k)) { tiles.set(k, null); if (!ground.has(k)) { const ox = kX(k) * TILE, oz = kZ(k) * TILE, Gr = new Uint8Array(TILE * TILE), Hy = new Float32Array(TILE * TILE).fill(-9); for (const p of huge) { if (p.b >= B_TEX) continue; const P = p.P, C = p.C; for (let t = 0; t < P.length / 3; t += 3) rasterGround(Gr, Hy, ox, oz, P[t * 3], P[t * 3 + 1], P[t * 3 + 2], P[t * 3 + 3], P[t * 3 + 4], P[t * 3 + 5], P[t * 3 + 6], P[t * 3 + 7], P[t * 3 + 8], C[t * 3], C[t * 3 + 1], C[t * 3 + 2]); } ground.set(k, Gr); } continue; }
    if (have) dropTile(k); buildTile(k, want); if (!all && ++n >= 1) break; }
  for (const k of [...tiles.keys()]) { if (need.has(k)) continue; const kx = kX(k), kz = kZ(k); const dx = Math.max(kx * TILE - px, 0, px - kx * TILE - TILE), dz = Math.max(kz * TILE - pz, 0, pz - kz * TILE - TILE); if (Math.hypot(dx, dz) > VIEW + 140) { if (tiles.get(k)) dropTile(k); else tiles.delete(k); } } }

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
  const greenAt = (x, z) => { const k = tkey(x, z), Gr = ground.get(k); if (!Gr) return false; const i = Math.floor(x - kX(k) * TILE), j = Math.floor(z - kZ(k) * TILE); return Gr[j * TILE + i] !== 2; };   // 0 = only the textured grass sheet underneath: grass
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
  const NATURE_STEP = PH ? 3.4 : 2.8;
  CZ.nature = (k, ox, oz, put) => { let sd = (k * 2654435761) >>> 0 || 1; const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let x = ox + 1; x < ox + TILE; x += NATURE_STEP) for (let z = oz + 1; z < oz + TILE; z += NATURE_STEP) {
      const jx = x + rnd() * NATURE_STEP * 0.8, jz = z + rnd() * NATURE_STEP * 0.8, roll = rnd(), rot = rnd() * 6.283, s = 0.75 + rnd() * 0.55;
      if (Math.abs(jx) > 7800 || jz < COAST.shore + 12) continue;
      if (roll < 0.035) { if (okTree(jx, jz)) emit(put, shapesN[rnd() < 0.45 ? 'pine' : rnd() < 0.85 ? 'roundTree' : 'fruitTree'][0], jx, jz, rot, s); continue; }
      if (roll > 0.6) continue;   // most of the grass stays plain grass
      if (!okSmall(jx, jz)) continue;
      const kind = roll < 0.06 ? 'patch' : roll < 0.28 ? 'tuft' : roll < 0.42 ? 'flowers' : roll < 0.52 ? 'bush' : 'rock';
      const set = shapesN[kind]; emit(put, set[Math.floor(rnd() * set.length)], jx, jz, rot, kind === 'patch' ? 1 : s); } };
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
  MS[B_GLASS].color.copy(lin('#2c3644')).lerp(lin('#ffcc73'), night); MS[B_WARM].color.copy(lin('#e8b45e')).lerp(lin('#ffd890'), night); MS[B_LAMP].color.copy(lin('#f6d27a')).lerp(lin('#fff0c0'), night); MS[B_WATER].color.copy(lin('#3fa3c4')).lerp(lin('#1f4a78'), night);
  glowMat.opacity = 0.12 + 0.88 * night; stars.material.opacity = Math.max(0, night - 0.3) / 0.7;
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
const lib = {}; await Promise.all(['anim', 'female-b'].map(async n => { lib[n] = await loadGLB(`kenney/chars/${n}.gltf.json`); }));
let ctex; lib.anim.scene.traverse(o => { if (o.isSkinnedMesh && !ctex) ctex = o.material.map; }); if (ctex) ctex.encoding = T.sRGBEncoding;
const cmat = PH ? new T.MeshLambertMaterial({ map: ctex, skinning: true }) : new T.MeshStandardMaterial({ map: ctex, skinning: true, roughness: 0.86, metalness: 0 });
const LOOK = { arm: 0.8, head: 0.78 };   // Dev chose option 3 (27 Nov)
const me = (() => { const base = lib.anim, r = base.scene.clone(true), bones = {}, old = []; r.traverse(o => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) old.push(o); }); old.forEach(o => o.parent.remove(o)); r.updateMatrixWorld(true);
  lib['female-b'].scene.traverse(o => { if (!o.isSkinnedMesh) return; const m = new T.SkinnedMesh(o.geometry, cmat); m.frustumCulled = false; m.castShadow = !PH; r.add(m); const sk = new T.Skeleton(o.skeleton.bones.map(b => bones[b.name])); sk.calculateInverses(); m.bind(sk, m.matrixWorld); });
  if (PH) { const s = new T.Mesh(new T.CircleGeometry(0.3, 14), new T.MeshBasicMaterial({ color: 0x1a2030, transparent: true, opacity: 0.22, depthWrite: false })); s.rotation.x = -Math.PI / 2; s.position.y = 0.02; r.add(s); }
  // size (Dev, 27 Nov, option 3): person-sized next to our homes, small arms, smaller head. Measured on the real skinned shape.
  r.updateMatrixWorld(true); let y0 = 1e9, y1 = -1e9; const vv = new T.Vector3(); r.traverse(o => { if (!o.isSkinnedMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) { vv.fromBufferAttribute(p, i); o.boneTransform(i, vv); vv.applyMatrix4(o.matrixWorld); y0 = Math.min(y0, vv.y); y1 = Math.max(y1, vv.y); } });
  r.scale.setScalar(2.15 / Math.max(0.1, y1 - y0) * (1 + (1 - LOOK.head) * 0.35)); S3.add(r); const mixer = new T.AnimationMixer(r), acts = {}; for (const c of base.animations) if (['idle', 'walk', 'sprint'].includes(c.name)) acts[c.name] = mixer.clipAction(c);
  const sized = {}; r.traverse(o => { if (o.isBone && (o.name === 'arm-left' || o.name === 'arm-right' || o.name === 'head')) sized[o.name] = { b: o, rest: o.scale.clone(), k: o.name === 'head' ? LOOK.head : LOOK.arm }; });
  const step = dt => { for (const n in sized) sized[n].b.scale.copy(sized[n].rest); mixer.update(dt); for (const n in sized) sized[n].b.scale.multiplyScalar(sized[n].k); };   // reset, animate, then shrink once (no stacking)
  const c = { root: r, mixer, step, cur: null, play(n) { if (c.cur === n || !acts[n]) return; acts[n].reset().fadeIn(0.2).play(); if (c.cur) acts[c.cur].fadeOut(0.2); c.cur = n; } }; c.play('idle'); return c; })();
let px = 0, pz = 30, yaw = Math.PI, pitch = 0.72; me.root.rotation.y = Math.PI;
{ const want = (QS.get('visit') || '').replace(/^@/, '').toLowerCase(), h = want && homes.find(x => (x.user || '').toLowerCase() === want); if (h) { px = h.x; pz = h.z + 9; } const f = nearestFree(px, pz); px = f[0]; pz = f[1]; }
const keys = {}; addEventListener('keydown', e => keys[e.key.toLowerCase()] = true); addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
const stick = $('czStick'), knob = $('czKnob'), joy = { x: 0, y: 0, id: null };
stick.addEventListener('pointerdown', e => { joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); mj(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === joy.id) mj(e); });
const ej = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }; stick.addEventListener('pointerup', ej); stick.addEventListener('pointercancel', ej);
function mj(e) { const r = stick.getBoundingClientRect(); let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2; const d = Math.hypot(dx, dy), m = r.width / 2 - 12; if (d > m) { dx *= m / d; dy *= m / d; } joy.x = dx / m; joy.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; }
let look = null; R3.domElement.addEventListener('pointerdown', e => { look = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (!look || e.pointerId !== look.id) return; yaw -= (e.clientX - look.x) * 0.006; pitch = Math.min(1.15, Math.max(0.3, pitch + (e.clientY - look.y) * 0.004)); look.x = e.clientX; look.y = e.clientY; });
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
  for (const [, l] of near) { if (k >= tagPool.length) break; PV.set(l.x, l.y, l.z).project(CAM); if (PV.z > 1 || Math.abs(PV.x) > 1.05 || Math.abs(PV.y) > 1.05) continue;
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

// ---------- 7. first squares, then the loop ----------
lt.textContent = 'building the streets around you';
await wait(20); stream(px, pz, true); streamNature(px, pz, true);
const clock = new T.Clock(), camPos = new T.Vector3(), camLook = new T.Vector3(); let frames = 0, fpsT = 0, first = true, hidden = false;
document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (!hidden) { clock.getDelta(); requestAnimationFrame(frame); } });
function frame() { if (hidden) return; requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const ix = joy.x + ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0), iz = joy.y + ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0), mag = Math.min(1, Math.hypot(ix, iz));
  if (mag > 0.1) { const run = running || keys.shift, a = Math.atan2(ix, iz) + yaw + Math.PI, s = (run ? 9 : 4.6) * mag, nx = px + Math.sin(a) * s * dt, nz = pz + Math.cos(a) * s * dt;
    if (freeAt(nx, nz)) { px = nx; pz = nz; } else if (freeAt(nx, pz)) px = nx; else if (freeAt(px, nz)) pz = nz;
    let d = a - me.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); me.root.rotation.y += d * Math.min(1, dt * 12); me.play(run ? 'sprint' : 'walk'); } else me.play('idle');
  me.root.position.set(px, 0.12, pz); me.step(dt);
  stream(px, pz, false); streamNature(px, pz, false);
  const dist = innerWidth > innerHeight ? 24 : 30, cp = Math.cos(pitch);
  camPos.set(px - Math.sin(yaw) * dist * cp, 1.5 + Math.sin(pitch) * dist, pz - Math.cos(yaw) * dist * cp);
  if (first) { CAM.position.copy(camPos); first = false; } else CAM.position.lerp(camPos, Math.min(1, dt * 5));
  camLook.set(px, 1.6, pz); CAM.lookAt(camLook);
  sky.position.set(px, 0, pz); stars.position.copy(sky.position); disc.position.set(px + SUND.x * 520, SUND.y * 520, pz + SUND.z * 520);
  sun.position.set(px + SUND.x * 170, SUND.y * 170, pz + SUND.z * 170); sun.target.position.set(px, 0, pz); sun.target.updateMatrixWorld();
  drawSmoke(dt);
  R3.render(S3, CAM);
  drawTags();
  frames++; fpsT += dt; if (fpsT > 1) { $('czFps').textContent = Math.round(frames / fpsT) + ' fps · ' + R3.info.render.calls + ' draws · ' + Math.round(R3.info.render.triangles / 1000) + 'k tris · ' + [...tiles.values()].filter(Boolean).length + ' squares'; frames = 0; fpsT = 0; } }
$('czLoad').style.opacity = 0; setTimeout(() => $('czLoad').remove(), 450);
CZ.phase = 'running';
frame();
CZ.dbg = () => JSON.stringify({ kinds: (() => { const k = {}; homes.forEach(h => { const key = String(h.kind) + (h.flat ? '/flat' : '') + (h.fp ? '/fp' : '') + (h.villa ? '/villa' : ''); k[key] = (k[key] || 0) + 1; }); return k; })(), looks: Object.keys(window.VLOOKS || {}).length, labelled: labelled.length, chimneys: chimneys.length, nearCh: nearCh.length, smoke: smoke.count, RM, homesActive: homes.filter(h => h.status === 'active').length, withLp: homes.filter(h => h.lp && h.el).length, sample: homes.slice(0, 3).map(h => [h.status, !!h.lp, !!h.el, h.flat ? 1 : 0, h.kind, h.villa ? 1 : 0]) });
CZ.inspect = (x, z) => { const k = tkey(x, z), list = tilePlaces.get(k) || [], pieces = chunks.get(k) || []; const bySize = {}, byB = {}; let pl = 0, pc = 0;
  for (const i of list) { const S = shapes[PL.s[i]], q = i * 12, m = PL.m, sc = Math.sqrt(m[q] ** 2 + m[q + 1] ** 2 + m[q + 2] ** 2), r = S.r * sc, bin = r < 0.5 ? '<0.5' : r < 1 ? '<1' : r < 2 ? '<2' : r < 5 ? '<5' : '5+'; bySize[bin] = (bySize[bin] || 0) + S.n / 3; pl += S.n / 3; }
  const pcs = pieces.map(p => [p.b, p.P.length / 9]); pieces.forEach(p => { pc += p.P.length / 9; byB[p.b] = (byB[p.b] || 0) + p.P.length / 9; });
  const topShapes = {}; for (const i of list) { const id = PL.s[i]; topShapes[id] = (topShapes[id] || 0) + shapes[id].n / 3; }
  const top = Object.entries(topShapes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, t]) => id + ':' + Math.round(t) + 't/' + shapes[id].n / 3 + 'per r' + shapes[id].r.toFixed(1));
  return JSON.stringify({ placeTris: Math.round(pl), pieceTris: Math.round(pc), places: list.length, bySize, piecesByBucket: byB, top }); };
CZ.api = { go: (x, z, y) => { px = x; pz = z; if (y != null) yaw = y; first = true; stream(px, pz, true); streamNature(px, pz, true); }, setTime: h => { fixedHour = h; tick(); }, renderer: R3, tiles, scene: S3 };
})().catch(e => { console.error('cozy', e); const l = document.getElementById('czLt'); if (l) l.textContent = 'Could not build: ' + e.message; });
