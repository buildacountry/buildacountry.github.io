/* Vinland asset kit (assets/kit.js)
   three.js r128, no other libraries. Load three.min.js first, then this file.

   - One function per asset: VinlandKit.<key>(options) returns a THREE.Group.
   - Units are metres, the same as the map. Ground is y = 0. Front faces +z.
   - Same look as the map: toon shading, ink outlines, the map's colours.
   - Colours that change from copy to copy are "slots" (wall, roof, body, skin...).
   - VinlandKit.bake(group) + VinlandKit.instances(baked, matrices, tints) draws many copies
     as a few InstancedMesh batches, the same way the map draws its homes.
   - VinlandKit.list is the catalogue (name, category, triangle budget, options). The gallery reads it.

   Nothing in here touches the map. An asset goes on the map only when it is real (voted / unlocked) and Dev says OK. */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  if (!THREE) { console.error('VinlandKit: load three.js r128 before kit.js'); return; }

  // ---------- colours (copied from the map so everything matches) ----------
  const PAL = {
    sand: '#e8d5b0', sand2: '#d9c49a', white: '#f6f0e2', cream: '#f7ecd6', terra: '#c8603f', terra2: '#b5543a', copper: '#4f9a86',
    glass: '#3f5866', glassWarm: '#f0c36a', shutter: '#47684a', wood: '#7a4f34', iron: '#2f2b28', grass: '#86ab5c', grass2: '#76a052',
    leaf: '#4f8a42', leaf2: '#5e9a4e', cypress: '#3d6b3a', pink: '#d88fb0', purple: '#a084c8', water: '#5ab4d0', teal: '#3f8f8a',
    tyre: '#1e1e22', lampOn: '#fff3c4', tail: '#ff5a3a', hub: '#c9ced2', slate: '#5b5f66', ink: '#3a2a20'
  };
  const SETS = {
    walls: ['#f6f0e2', '#f2cfb3', '#c9d8b6', '#c8dbe6', '#e8d5b0'],
    roofs: ['#c8603f', '#b5543a', '#4f9a86', '#5b5f66', '#8a5a3a'],
    cars: ['#c8603f', '#3f7fbf', '#f6f0e2', '#2f2b28', '#c9922e', '#2f7a68', '#d88fb0', '#9aa3a8'],
    skins: ['#f1c9a5', '#e9b48a', '#c98e62', '#a8714a', '#8a5a3a'],
    hairs: ['#2f2b28', '#3a2a20', '#5a3a24', '#8a5a2b', '#c98b3a', '#9a958c'],
    tops: ['#3f7fbf', '#c8603f', '#2f7a68', '#6a4a8c', '#c9922e', '#47684a', '#b5543a', '#3f5866', '#d88fb0', '#f6f0e2'],
    bottoms: ['#3b3a46', '#4a3b2f', '#2f3e52', '#55504a', '#d9c49a'],
    hats: ['#c8603f', '#3f5866', '#f6f0e2', '#2f2b28', '#c9922e', '#47684a']
  };

  // ---------- the look: toon shading + ink outlines ----------
  const grad = new THREE.DataTexture(new Uint8Array([105, 165, 215]), 3, 1, THREE.LuminanceFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  const toon = c => new THREE.MeshToonMaterial({ color: c, gradientMap: grad });
  const mats = {};
  const mat = c => mats[c] || (mats[c] = toon(c));                     // one shared material per colour
  const slot = (name, c) => { const m = toon(c); m.userData.slot = name; return m; };   // a colour that changes per copy
  const glows = {};                                                   // materials that light up at night (VinlandKit.setNight)
  const glowMat = (c, glow) => glows[c + glow] || (glows[c + glow] = (() => { const m = toon(c); m.userData.glow = glow; return m; })());
  const ink = new THREE.LineBasicMaterial({ color: PAL.ink, transparent: true, opacity: 0.55 });

  // ---------- shapes: a few unit shapes, reused everywhere (scaled per piece) ----------
  const geos = {}, edgeOf = new Map();
  const geo = (k, f) => geos[k] || (geos[k] = f());
  function flat(tris) {                                               // triangles from corner points, flat shaded
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([].concat(...tris)), 3));
    g.computeVertexNormals(); return g;
  }
  function put(p, g, m, x, y, z, o) {
    o = o || {};
    const mesh = new THREE.Mesh(g, typeof m === 'string' ? mat(m) : m);
    mesh.position.set(x, y, z); if (o.s) mesh.scale.set(o.s[0], o.s[1], o.s[2]);
    if (o.rx) mesh.rotation.x = o.rx; if (o.ry) mesh.rotation.y = o.ry; if (o.rz) mesh.rotation.z = o.rz;
    mesh.castShadow = o.shadow !== false; mesh.receiveShadow = true;
    if (o.edge !== false) { let e = edgeOf.get(g); if (!e) { e = new THREE.EdgesGeometry(g, 25); edgeOf.set(g, e); } mesh.add(new THREE.LineSegments(e, ink)); }
    p.add(mesh); return mesh;
  }
  const NE = { edge: false }, FLAT = { edge: false, shadow: false };
  const grp = (p, x, y, z, ry) => { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (ry) g.rotation.y = ry; p.add(g); return g; };
  // box: x, z = centre, y = bottom (12 triangles)
  const B = (p, w, h, d, m, x, y, z, o) => put(p, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), m, x, y + h / 2, z, Object.assign({}, o, { s: [w, h, d] }));
  // flat panel facing +z: x = centre, y = bottom (2 triangles). Windows, doors, lights.
  const P = (p, w, h, m, x, y, z, o) => put(p, geo('pane', () => new THREE.PlaneGeometry(1, 1)), m, x, y + h / 2, z, Object.assign({}, FLAT, o, { s: [w, h, 1] }));
  // half circle facing +z, for arches (6 triangles)
  const ARCH = (p, w, m, x, y, z) => put(p, geo('arch', () => new THREE.CircleGeometry(0.5, 6, 0, Math.PI)), m, x, y, z, { edge: false, shadow: false, s: [w, w, 1] });
  // cylinder standing up: y = bottom. rt / rb = top / bottom radius.
  function CYL(p, rt, rb, h, seg, m, x, y, z, o) {
    const k = 'cyl' + seg + '_' + (rt / rb).toFixed(2) + (o && o.open ? 'o' : '');
    return put(p, geo(k, () => new THREE.CylinderGeometry(rt / rb, 1, 1, seg, 1, !!(o && o.open))), m, x, y + h / 2, z, Object.assign({}, o, { s: [rb, h, rb] }));
  }
  // wheel: axle along x, sits on the ground at y = 0
  const WHEEL = (p, r, w, x, z, seg) => { put(p, geo('wheel' + (seg || 10), () => new THREE.CylinderGeometry(1, 1, 1, seg || 10)), PAL.tyre, x, r, z, { rz: Math.PI / 2, edge: false, s: [r, w, r] });
    put(p, geo('hub', () => new THREE.CircleGeometry(1, 6)), PAL.hub, x + (x < 0 ? -1 : 1) * (w / 2 + 0.01), r, z, { ry: (x < 0 ? -1 : 1) * Math.PI / 2, edge: false, shadow: false, s: [r * 0.5, r * 0.5, 1] }); };
  const ICO = (p, r, detail, m, x, y, z, o) => put(p, geo('ico' + detail, () => new THREE.IcosahedronGeometry(1, detail)), m, x, y, z, Object.assign({}, o, { s: [r, r, r] }));
  const BALL = (p, r, m, x, y, z, o) => put(p, geo('ball', () => new THREE.SphereGeometry(1, 8, 6)), m, x, y, z, Object.assign({}, o, { s: [r, r, r] }));
  const CAP = (p, r, m, x, y, z, o) => put(p, geo('cap', () => new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2.2)), m, x, y, z, Object.assign({}, o, { s: [r, r, r] }));
  // gable roof: ridge runs front to back, y = bottom (6 triangles)
  const GABLE = (p, w, h, d, m, x, y, z, o) => put(p, geo('gable', () => { const a = [-.5, 0, .5], b = [.5, 0, .5], t = [0, 1, .5], a2 = [-.5, 0, -.5], b2 = [.5, 0, -.5], t2 = [0, 1, -.5];
    return flat([[...a, ...b, ...t], [...b2, ...a2, ...t2], [...a2, ...a, ...t], [...a2, ...t, ...t2], [...b, ...b2, ...t2], [...b, ...t2, ...t]]); }), m, x, y, z, Object.assign({}, o, { s: [w, h, d] }));
  // hip roof: a 4-sided pyramid, y = bottom (4 triangles)
  const HIP = (p, w, h, d, m, x, y, z, o) => put(p, geo('hip', () => { const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true); g.rotateY(Math.PI / 4); g.translate(0, 0.5, 0); return g; }), m, x, y, z, Object.assign({}, o, { s: [w, h, d] }));
  // box with a smaller top (car bodies, skirts, hulls): tw / td = top size as a part of the bottom, tz = top pushed forward (part of d). y = bottom.
  function TAPER(p, w, h, d, m, x, y, z, t, o) {
    const tw = t.tw == null ? 1 : t.tw, td = t.td == null ? 1 : t.td, tz = t.tz || 0, k = 'taper' + tw + '_' + td + '_' + tz;
    return put(p, geo(k, () => { const b = [[-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5]], u = b.map(c => [c[0] * tw, 1, c[2] * td + tz]);
      const q = (a, b2, c, e) => [[...a, ...b2, ...c], [...a, ...c, ...e]];
      return flat([...q(u[0], u[3], u[2], u[1]), ...q(b[0], b[1], b[2], b[3]), ...q(b[3], b[2], u[2], u[3]), ...q(b[1], b[0], u[0], u[1]), ...q(b[2], b[1], u[1], u[2]), ...q(b[0], b[3], u[3], u[0])]); }),
      m, x, y, z, Object.assign({}, o, { s: [w, h, d] }));
  }

  // ---------- small parts shared by many assets ----------
  function win(p, x, y, z, ry, w, h, o) {                              // arched window with shutters, 14 triangles
    w = w || 1.1; h = h || 1.5; o = o || {}; const g = grp(p, x, y, z, ry), gl = o.warm ? PAL.glassWarm : PAL.glass;
    P(g, w + 0.3, h + w / 2 + 0.25, PAL.sand2, 0, -0.12, 0.02, { edge: true });
    P(g, w, h, gl, 0, 0, 0.05); ARCH(g, w, gl, 0, h, 0.05);
    if (o.shutters !== false) { P(g, w * 0.5, h, PAL.shutter, -w * 0.78, 0, 0.07); P(g, w * 0.5, h, PAL.shutter, w * 0.78, 0, 0.07); }
    return g;
  }
  function door(p, x, y, z, ry, w, h, col) {                           // arched door, 10 triangles
    w = w || 1.3; h = h || 2.1; const g = grp(p, x, y, z, ry);
    P(g, w + 0.35, h + w / 2 + 0.2, PAL.sand2, 0, 0, 0.02, { edge: true });
    P(g, w, h, col || PAL.wood, 0, 0, 0.05); ARCH(g, w, col || PAL.wood, 0, h, 0.05);
    return g;
  }
  function rail(p, w, x, y, z, ry, h, gap) {                                // iron railing
    h = h || 0.9; const g = grp(p, x, y, z, ry), n = Math.max(1, Math.round(w / (gap || 0.6)));
    B(g, w, 0.08, 0.08, PAL.iron, 0, h, 0, FLAT);
    for (let i = 0; i <= n; i++) B(g, 0.05, h, 0.05, PAL.iron, -w / 2 + i * w / n, 0, 0, FLAT);
  }
  function balcony(p, w, dp, x, y, z) {
    const g = grp(p, x, y, z); B(g, w, 0.22, dp, PAL.sand2, 0, 0, dp / 2);
    rail(g, w, 0, 0.22, dp - 0.05); rail(g, dp, -w / 2 + 0.04, 0.22, dp / 2, Math.PI / 2); rail(g, dp, w / 2 - 0.04, 0.22, dp / 2, Math.PI / 2);
  }
  function pot(p, x, y, z, s, flower) { s = s || 1; B(p, 0.5 * s, 0.45 * s, 0.5 * s, PAL.terra2, x, y, z, NE); ICO(p, 0.42 * s, 0, flower ? PAL.pink : PAL.leaf2, x, y + 0.7 * s, z, NE); }
  function tree(p, x, y, z, kind, s) {
    s = s || 1;
    if (kind === 'cypress') { B(p, 0.25 * s, 0.6 * s, 0.25 * s, PAL.wood, x, y, z, NE); CYL(p, 0.001, 0.9 * s, 5 * s, 7, PAL.cypress, x, y + 0.5 * s, z, { open: true }); return; }
    const col = kind === 'pink' ? PAL.pink : kind === 'purple' ? PAL.purple : PAL.leaf;
    CYL(p, 0.18 * s, 0.26 * s, 2.4 * s, 6, PAL.wood, x, y, z, { edge: false, open: true });
    ICO(p, 1.7 * s, 1, col, x, y + 3.3 * s, z); ICO(p, 1.1 * s, 0, kind === 'pink' || kind === 'purple' ? col : PAL.leaf2, x + 0.9 * s, y + 3.9 * s, z + 0.4 * s, NE);
  }
  const hedge = (p, w, d, x, z) => B(p, w, 0.9, d, PAL.leaf, x, 0.2, z);
  const stoneWall = (p, x1, z1, x2, z2, h) => B(p, Math.hypot(x2 - x1, z2 - z1), h || 0.7, 0.35, PAL.sand2, (x1 + x2) / 2, 0.2, (z1 + z2) / 2, { ry: Math.atan2(-(z2 - z1), x2 - x1) });
  const pad = (p, w, d) => B(p, w, 0.2, d, PAL.grass, 0, 0, 0, { shadow: false });

  // ---------- the catalogue ----------
  const KIT = { PAL, SETS, list: [] };
  const pick = (o, k, set) => (o && o[k]) || set[0];
  function def(e) { KIT.list.push(e); KIT[e.key] = o => { const g = e.make(o || {}); g.name = e.key; g.userData.asset = e.key; return g; }; }
  const colours = (label, set) => ({ label, colors: set });
  const choices = (label, set) => ({ label, choices: set });

  // ================= PART 1 =================

  // ---- homes ----
  // Starter house: the map's normal home (1 plot, 10 x 10 m): two storeys, terracotta gable roof, arched windows with
  // green shutters, a small balcony, front garden behind a low stone wall. Slots: wall, roof.
  def({ key: 'houseStarter', name: 'Starter house', cat: 'Homes', part: 1, budget: 700, size: '1 plot · 10 × 10 m',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Roof', SETS.roofs) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), R = slot('roof', pick(o, 'roof', SETS.roofs));
      pad(g, 10, 10);
      B(g, 1.4, 0.06, 4, PAL.sand, 0, 0.2, 3, FLAT);                                        // path
      stoneWall(g, -5, 4.9, -0.9, 4.9); stoneWall(g, 0.9, 4.9, 5, 4.9); stoneWall(g, -4.9, -5, -4.9, 5); stoneWall(g, 4.9, -5, 4.9, 5);
      B(g, 0.15, 1.2, 0.15, PAL.iron, -0.9, 0.2, 4.9, NE); B(g, 0.15, 1.2, 0.15, PAL.iron, 0.9, 0.2, 4.9, NE);   // gate posts
      B(g, 6, 6.2, 5.6, W, 0, 0.2, -1);                                                     // the house
      B(g, 6.3, 0.25, 5.9, PAL.sand2, 0, 3.25, -1);                                         // floor band
      GABLE(g, 7, 2.7, 6.4, R, 0, 6.4, -1);
      B(g, 0.7, 1.6, 0.7, PAL.sand2, 1.8, 7.2, -2);                                         // chimney
      door(g, 0, 0.2, 1.81, 0);
      win(g, -1.9, 1.3, 1.81, 0); win(g, 1.9, 1.3, 1.81, 0);
      win(g, -1.9, 4.2, 1.81, 0); win(g, 1.9, 4.2, 1.81, 0); win(g, 0, 4.2, 1.81, 0, 1.0, 1.7, { shutters: false });
      balcony(g, 2.4, 0.8, 0, 3.95, 1.8);
      [1, -1].forEach(s => { win(g, s * 3.01, 1.3, -1, s * Math.PI / 2); win(g, s * 3.01, 4.2, -1, s * Math.PI / 2); });
      pot(g, -1.1, 0.2, 2.3, 1, true); pot(g, 1.1, 0.2, 2.3, 1);
      tree(g, -3.4, 0.2, 2.9, 'pink', 0.8); hedge(g, 2.6, 0.8, 3.2, 3.6); tree(g, 3.6, 0.2, -3.8, 'cypress', 0.8);
      return g;
    } });

  // Villa: the same Villa as on Villa Lane (wide house, columned veranda with a balcony, garage with a roof terrace,
  // red sports car, pool). Lot 37 x 24 m. Slots: wall, roof, body (the car).
  def({ key: 'villa', name: 'Villa', cat: 'Homes', part: 1, budget: 1500, size: 'Villa Lane lot · 37 × 24 m',
    opts: { wall: colours('Wall', ['#f3e6cc', '#f2cfb3', '#c9d8b6', '#c8dbe6', '#f6f0e2']), roof: colours('Roof', SETS.roofs), car: colours('Car', ['#d8231f'].concat(SETS.cars)) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || '#f3e6cc'), R = slot('roof', pick(o, 'roof', SETS.roofs)), TRIM = '#e6d3b0', COL = '#fbf4e6', WIN = '#3d5a5e', SH = '#5c7a5c';
      B(g, 37, 0.2, 24, '#9cc06b', 0, 0, 0, { shadow: false });                                   // lawn
      const h = grp(g, 1, 0, 0); h.scale.set(1.12, 1.16, 1.12);
      B(h, 17, 7.6, 9, W, -2.5, 0.2, -4.5);                                                        // main house, two tall floors
      B(h, 17.3, 0.35, 9.3, TRIM, -2.5, 3.9, -4.5);
      HIP(h, 18.6, 3.4, 10.6, R, -2.5, 7.8, -4.5);
      B(h, 1.1, 2.6, 1.1, TRIM, -8, 9.2, -6.5);
      [-9.2, -6.4, 1.4, 4.2].forEach(x => [1.4, 5.1].forEach(y => { P(h, 1.6, 2, WIN, x, y, 0.05); P(h, 0.45, 2, SH, x - 1.05, y, 0.07); P(h, 0.45, 2, SH, x + 1.05, y, 0.07); }));
      [-1, 1].forEach(s => P(h, 1.4, 2, WIN, -2.5 + s * 8.52, 4.9, -4.5, { ry: s * Math.PI / 2 }));
      B(h, 9.4, 0.4, 4.2, TRIM, -2.5, 0.15, 2.2);                                                  // porch
      [-6.4, -3.8, -1.2, 1.4].forEach(x => CYL(h, 0.34, 0.38, 6.9, 8, COL, x, 0.45, 3.7, { open: true }));
      B(h, 10, 0.5, 4.6, TRIM, -2.5, 7.3, 2.3);                                                    // balcony on the columns
      rail(h, 10, -2.5, 7.8, 4.5, 0, 1, 1.6); rail(h, 4.6, -7.45, 7.8, 2.3, Math.PI / 2, 1, 2.3); rail(h, 4.6, 2.45, 7.8, 2.3, Math.PI / 2, 1, 2.3);
      P(h, 2.2, 3, '#7a4a2a', -2.5, 0.55, 0.05); B(h, 2.6, 0.5, 0.18, TRIM, -2.5, 3.6, 0.08, NE);  // big front door
      P(h, 2, 2.4, WIN, -2.5, 4.6, 0.05);
      B(h, 5, 0.3, 1.2, TRIM, -2.5, 0, 4.9); B(h, 5.6, 0.15, 1.1, TRIM, -2.5, 0, 5.9);              // steps
      B(h, 7.2, 3.4, 9, W, 9.6, 0.2, -4.5);                                                        // garage wing
      P(h, 5, 2.5, '#c98a52', 9.6, 0.2, 0.05);
      B(h, 7.4, 0.3, 9.2, TRIM, 9.6, 3.6, -4.5);
      rail(h, 7.4, 9.6, 3.9, -0.05, 0, 0.95, 1.6); rail(h, 9.2, 13.25, 3.9, -4.5, Math.PI / 2, 0.95, 2.3);
      [[7, -7.5, '#e07a8a'], [12, -7.6, '#7fb069'], [12, -2, '#f2c14e']].forEach(([x, z, c]) => { B(h, 0.9, 0.6, 0.9, '#c98a52', x, 3.9, z, NE); ICO(h, 0.75, 0, c, x, 4.95, z, NE); });
      B(h, 2.2, 0.15, 2.2, '#e8d9b8', 10.8, 6.0, -4.5); B(h, 0.12, 2, 0.12, '#7a5a3a', 10.8, 3.9, -4.5, NE);   // terrace parasol
      B(h, 3.2, 0.06, 7.4, '#d9c7a5', 9.6, 0.2, 8.2, FLAT);                                        // driveway
      const car = KIT.carSports({ body: o.car || '#d8231f' }); car.position.set(9.6, 0.2, 6.4); h.add(car);
      B(g, 8, 0.25, 11, '#e9dcc0', -14, 0.2, 2.5, { shadow: false });                               // pool deck
      B(g, 5.4, 0.3, 8, '#3fb6d8', -14, 0.25, 2.5, FLAT);
      [-1.9, 1.9].forEach(dz => B(g, 0.9, 0.3, 2, '#ffffff', -10.8, 0.45, 2.5 + dz, NE));
      B(g, 2.6, 0.06, 5.6, '#e6d6b2', -2.5, 0.2, 9.2, FLAT);                                       // front path, lamps
      [-4.3, -0.7].forEach(x => { B(g, 0.18, 3, 0.18, PAL.ink, x, 0.2, 8.6, NE); BALL(g, 0.35, PAL.lampOn, x, 3.4, 8.6, NE); });
      [[-11.6, 15], [6.6, 12.6]].forEach(([x, w]) => B(g, w, 0.9, 0.5, TRIM, x, 0.15, 12.3));       // garden wall
      [-18.8, 18.8].forEach(x => B(g, 0.5, 0.9, 24.6, TRIM, x, 0.15, 0));
      CYL(g, 0.3, 0.36, 2.6, 6, PAL.wood, -15.5, 0.2, -8, { edge: false, open: true }); ICO(g, 2.8, 0, PAL.purple, -15.5, 4.3, -8);   // the purple tree
      [[-7.6, 6.3], [2.6, 6.3], [16.5, -9], [16.5, 1], [-17, 9]].forEach(([x, z]) => tree(g, x, 0.2, z, 'cypress', 0.95));
      return g;
    } });

  // Mansion: three storeys, columned entrance, a copper-domed tower, a pool and an iron gate. 4 plots, 20 x 20 m. Slots: wall, roof.
  def({ key: 'mansion', name: 'Mansion', cat: 'Homes', part: 1, budget: 2500, size: '4 plots · 20 × 20 m',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Roof', SETS.roofs) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), R = slot('roof', pick(o, 'roof', SETS.roofs)), TRIM = PAL.sand2;
      pad(g, 20, 20);
      B(g, 3.6, 0.06, 10.2, PAL.sand, -1, 0.2, 4.9, FLAT);                                        // drive
      stoneWall(g, -10, 9.85, -2.9, 9.85, 1); stoneWall(g, 0.9, 9.85, 10, 9.85, 1);                // front wall, iron gate between pillars
      stoneWall(g, -9.85, -10, -9.85, 10, 1); stoneWall(g, 9.85, -10, 9.85, 10, 1); stoneWall(g, -10, -9.85, 10, -9.85, 1);
      [-3.2, 1.2].forEach(x => { B(g, 0.7, 2.3, 0.7, TRIM, x, 0.2, 9.85); BALL(g, 0.3, PAL.lampOn, x, 2.8, 9.85, NE); });
      rail(g, 3.7, -1, 0.2, 9.85, 0, 1.9, 0.45);
      B(g, 14, 9.6, 8, W, -1, 0.2, -4.5);                                                          // the house
      [3.3, 6.5].forEach(y => B(g, 14.3, 0.25, 8.3, TRIM, -1, y, -4.5));
      HIP(g, 15.4, 3.6, 9.4, R, -1, 9.8, -4.5);
      B(g, 0.8, 2.2, 0.8, TRIM, -6, 11, -6.5); B(g, 0.8, 2.2, 0.8, TRIM, 4, 11, -6.5);
      [-6.1, -3.6, 1.6, 4.1].forEach(x => [1.1, 4.2, 7.3].forEach(y => win(g, x, y, -0.48, 0, 1.0, 1.4)));
      win(g, -1, 4.2, -0.48, 0, 1.1, 1.5, { shutters: false }); win(g, -1, 7.3, -0.48, 0, 1.1, 1.5);
      [-1, 1].forEach(s => [-6.3, -2.7].forEach(z => [1.1, 4.2, 7.3].forEach(y => { if (s > 0 && z > -3) return; win(g, -1 + s * 7.01, y, z, s * Math.PI / 2, 1.0, 1.4); })));
      [-2.6, 0.6].forEach(x => CYL(g, 0.26, 0.3, 3.1, 8, PAL.cream, x, 0.2, 1.5, { open: true }));   // entrance columns, balcony and pediment
      B(g, 4.6, 0.3, 2.4, TRIM, -1, 3.3, 0.7); rail(g, 4.6, -1, 3.6, 1.85, 0, 0.9, 0.8);
      B(g, 4.6, 0.2, 2.4, TRIM, -1, 0, 0.7, { shadow: false });
      door(g, -1, 0.2, -0.47, 0, 1.6, 2.2);
      const t = grp(g, 7.2, 0, -1.6);                                                              // the tower with a copper dome
      CYL(t, 2.3, 2.3, 13, 8, W, 0, 0.2, 0, { open: true });
      [3.3, 6.5, 9.7].forEach(y => CYL(t, 2.45, 2.45, 0.25, 8, TRIM, 0, y, 0, { open: true }));
      [1.2, 4.3, 7.4, 10.4].forEach(y => { P(t, 0.8, 1.3, PAL.glass, 0, y, 2.15); ARCH(t, 0.8, PAL.glass, 0, y + 1.3, 2.15); });
      CYL(t, 2.6, 2.6, 0.35, 8, TRIM, 0, 13.2, 0);
      put(t, geo('dome', () => new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)), PAL.copper, 0, 13.55, 0, { s: [2.3, 2.3, 2.3] });
      CYL(t, 0.06, 0.1, 1.6, 6, PAL.iron, 0, 15.8, 0, NE); BALL(t, 0.22, PAL.copper, 0, 17.5, 0, NE);
      B(g, 7.6, 0.25, 5.4, '#e9dcc0', -6, 0.2, 5.6, { shadow: false });                             // pool
      B(g, 5.6, 0.3, 3.6, '#3fb6d8', -6, 0.22, 5.6, FLAT);
      [-7.6, -4.4].forEach(x => B(g, 0.9, 0.3, 1.9, '#ffffff', x, 0.45, 8.3, NE));
      hedge(g, 0.8, 6, 3.4, 5.4); hedge(g, 4.2, 0.8, 7.6, 3.2);
      [[-9, -8.6], [9, -8.6], [8.8, 8.6], [-9, 8.6]].forEach(([x, z]) => tree(g, x, 0.2, z, 'cypress', 1));
      tree(g, 6.6, 0.2, 6.6, 'canopy', 0.9); tree(g, -9, 0.2, -1.5, 'pink', 0.8);
      return g;
    } });

  // Penthouse tower: a downtown apartment tower with shops at the base. The top floor is the penthouse:
  // glass rooms on a roof garden with a pool and a pergola. 20 x 20 m. Slot: wall.
  def({ key: 'penthouse', name: 'Penthouse tower', cat: 'Homes', part: 1, budget: 3500, size: 'Downtown · 20 × 20 m · 12 floors',
    opts: { wall: colours('Wall', SETS.walls) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), TRIM = PAL.sand2, FL = 3, N = 10, top = 4.6 + N * FL;
      B(g, 20, 0.2, 20, '#d8d2c6', 0, 0, 0, { shadow: false });
      B(g, 16, 4.4, 16, TRIM, 0, 0.2, 0);                                                         // shop podium
      [0, 1, 2, 3].forEach(k => { const s = grp(g, 0, 0, 0, k * Math.PI / 2);
        P(s, 13, 2.8, PAL.glassWarm, 0, 0.6, 8.02); B(s, 16.2, 0.3, 0.3, PAL.cream, 0, 3.5, 8.05, NE);
        if (k === 0) [[-4.5, PAL.terra], [0, PAL.teal], [4.5, PAL.pink]].forEach(([x, c]) => TAPER(s, 3.8, 0.7, 1.4, c, x, 3.4, 8.7, { tw: 1, td: 0.25, tz: -0.37 })); });
      B(g, 13, N * FL, 13, W, 0, 4.6, 0);                                                         // the tower
      for (let i = 1; i <= N; i++) B(g, 13.5, 0.22, 13.5, PAL.cream, 0, 4.6 + i * FL - 0.11, 0, NE);
      for (let i = 0; i < N; i++) [0, 1, 2, 3].forEach(k => { const s = grp(g, 0, 0, 0, k * Math.PI / 2);
        P(s, 10.4, 1.7, PAL.glass, 0, 4.6 + i * FL + 0.75, 6.52);
        if (k === 0 && i % 2 === 1) { B(s, 5, 0.18, 1.2, PAL.cream, 0, 4.6 + i * FL, 7.1); P(s, 5, 0.9, '#bfe0ea', 0, 4.6 + i * FL + 0.18, 7.68, { edge: true }); } });
      [0, 1, 2, 3].forEach(k => { const s = grp(g, 0, 0, 0, k * Math.PI / 2); [-6.2, -2.1, 2.1, 6.2].forEach(x => B(s, 0.6, N * FL, 0.4, W, x, 4.6, 6.6, NE)); });   // piers
      B(g, 14, 0.4, 14, PAL.cream, 0, top, 0);                                                    // roof garden level
      const ph = grp(g, -2.2, top + 0.4, -1.8);                                                   // the penthouse: glass rooms
      B(ph, 7.6, 3.2, 7, PAL.glass, 0, 0, 0, { edge: true }); B(ph, 8.6, 0.3, 8, PAL.white, 0, 3.2, 0);
      P(ph, 6.6, 2.4, PAL.glassWarm, 0, 0.3, 3.52); P(ph, 6, 2.4, PAL.glassWarm, 3.82, 0.3, 0, { ry: Math.PI / 2 });
      B(g, 2.6, 0.3, 6, '#3fb6d8', 4.4, top + 0.4, -1.8, FLAT);                                    // pool, loungers, pergola, trees
      B(g, 3.4, 0.15, 6.8, '#e9dcc0', 4.4, top + 0.4, -1.8, { shadow: false, edge: false });
      [-0.9, 0.9].forEach(dz => B(g, 0.8, 0.28, 1.8, '#ffffff', 4.4 + dz * 1.0, top + 0.4, 3.4, NE));
      [[-5.6, 3.6], [-1.2, 3.6], [-5.6, 6], [-1.2, 6]].forEach(([x, z]) => B(g, 0.15, 2.6, 0.15, PAL.wood, x, top + 0.4, z, NE));
      [3.8, 4.6, 5.4].forEach(z => B(g, 4.8, 0.12, 0.2, PAL.wood, -3.4, top + 3, z, NE));
      tree(g, 5.2, top + 0.4, 5.6, 'canopy', 0.6); tree(g, -6, top + 0.4, -5.8, 'cypress', 0.6); tree(g, 5.8, top + 0.4, -6, 'cypress', 0.6);
      [0, 1, 2, 3].forEach(k => { const s = grp(g, 0, 0, 0, k * Math.PI / 2); P(s, 14, 1, '#bfe0ea', 0, top + 0.4, 7, { edge: true }); });   // glass parapet
      return g;
    } });

  // Beach Flats: a small seaside building for 4 citizens on the last lane of Riverside, next to the beach. 1 plot, 10 x 10 m.
  // 2 floors x 2 flats (left + right). Front (+z) faces the sea: every flat has its own glass wall and balcony with a glass railing.
  // Shared entrance in the middle (steps up to one door) with 4 name plates: o.names = ['@a', '@b', '@c', '@d']
  // (ground left, ground right, upper left, upper right). Shared roof terrace with umbrellas, loungers and plants.
  // Slots: wall, accent (door, umbrellas, cushions, trim lines). Night: windows glow.
  SETS.beachSets = [['Teal', '#fbfaf5', '#2f9aa0'], ['Coral', '#f3e4cf', '#e8735a'], ['Sand', '#e6cfa6', '#b98b5e'], ['White-blue', '#f4f8fa', '#3f7fbf']];
  function palm(p, x, y, z, s, lean) {
    const g = grp(p, x, y, z); g.scale.setScalar(s || 1); let px = 0, py = 0;
    for (let i = 0; i < 3; i++) { const a = (lean || 0.18) * (i + 1); CYL(g, 0.16 - i * 0.03, 0.2 - i * 0.03, 1.5, 5, '#9a7a52', px, py, 0, { rz: -a, edge: false, open: true }); px += Math.sin(a) * 1.5; py += Math.cos(a) * 1.5; }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, f = grp(g, px, py, 0, a);
      TAPER(f, 0.75, 0.08, 2.0, i % 2 ? PAL.leaf2 : PAL.leaf, 0, 0, 1.0, { tw: 0.15, td: 0.3, tz: 0.3 }, { rx: 0.7, edge: false }); }
  }
  def({ key: 'beachFlats', name: 'Beach Flats', cat: 'Homes', part: 2, budget: 1500, size: '1 plot · 10 × 10 m · 4 flats · Riverside, Beach Lane', night: true,
    opts: { set: choices('Colours', SETS.beachSets.map(s => s[0])) },
    make(o) {
      const s = SETS.beachSets.find(x => x[0] === o.set) || SETS.beachSets[0];
      const g = new THREE.Group(), W = slot('wall', o.wall || s[1]), A = slot('accent', o.accent || s[2]);
      const GL = glowMat('#6fb3cc', '#ffd98a'), RAIL = '#b4dbe8', WOOD = '#b98b5e', SLAB = '#e9e3d6', F = 3.3, base = 0.9, zf = 1.0, zb = 2.5, zm = 1.5;   // wall front, balcony front, middle fin front
      const names = o.names || ['@citizen', '@citizen', '@citizen', '@citizen'];
      B(g, 10, 0.2, 10, '#ecdcb6', 0, 0, 0, { shadow: false });                                    // sandy plot
      B(g, 9.6, 0.16, 3.4, WOOD, 0, 0.2, 3.3, { shadow: false });                                 // wooden deck
      [-3.2, -1.6, 1.6, 3.2].forEach(x => B(g, 0.04, 0.02, 3.4, '#8a6a46', x, 0.36, 3.3, FLAT));
      B(g, 9.2, base, 6.6, SLAB, 0, 0.2, -2.1);                                                   // plinth (ground flats sit a little up)
      B(g, 9.0, F * 2, 6.2, W, 0, 0.2 + base, -2.1);                                             // the building
      B(g, 9.4, 0.25, 6.6, SLAB, 0, 0.2 + base + F - 0.12, -2.1);                                 // floor line
      B(g, 9.8, 0.35, 7.0, SLAB, 0, 0.2 + base + F * 2, -2.1);                                    // roof slab
      // the middle bay: shared entrance below, stair window above
      const yb = 0.2 + base;
      B(g, 1.7, F * 2 + base, 0.5, W, 0, 0.2, zm - 0.25);                                             // middle fin, a little forward
      P(g, 1.0, 2.1, A, 0, yb, zm + 0.02);                                                     // the shared door
      B(g, 1.9, 0.12, 0.9, SLAB, 0, yb + 2.35, zm + 0.45, NE);                                 // little canopy
      for (let i = 0; i < 3; i++) B(g, 1.5, base / 3 * (i + 1), 0.4, SLAB, 0, 0.2, zm + 0.2 + (2 - i) * 0.4, NE);   // steps
      P(g, 0.7, 1.4, GL, 0, yb + F + 0.7, zm + 0.02);                                          // stair window
      names.slice(0, 4).forEach((n, i) => P(g, 0.62, 0.18, textMat(n, '#d4af37', '#2f2b28'), (i % 2 ? 1 : -1) * 0.38, yb + 1.0 - Math.floor(i / 2) * 0.24, zm + 0.03));   // 4 name plates by the door
      // 4 flats: glass wall + own balcony
      [-1, 1].forEach(sd => [0, 1].forEach(fl => {
        const x = sd * 2.65, y = yb + fl * F;
        P(g, 3.2, 2.4, GL, x, y + 0.35, zf + 0.02);
        B(g, 3.6, 0.22, zb - zf, SLAB, x, y + 0.02, (zf + zb) / 2);                                // balcony floor
        B(g, 3.6, 0.1, 0.06, A, x, y + 0.05, zb + 0.01, FLAT);                                  // colour line
        [[3.6, 0, 0, zb - 0.03], [zb - zf, sd * 1.78, Math.PI / 2, (zf + zb) / 2]].forEach(([w, dx, ry, z]) => { const r = grp(g, x + dx, y + 0.24, z, ry);
          P(r, w, 0.95, RAIL, 0, 0, 0, { edge: true }); B(r, w, 0.06, 0.08, PAL.iron, 0, 0.95, 0, FLAT); });
        B(g, 0.9, 0.4, 0.5, A, x - sd * 0.8, y + 0.24, zf + 0.4, NE);                           // a cushion seat on each balcony
        ICO(g, 0.3, 0, PAL.leaf2, x + sd * 1.3, y + 0.55, zf + 0.5, NE);
      }));
      // shared roof terrace
      const yr = 0.2 + base + F * 2 + 0.35;
      [[9.6, 0, 0, 1.25], [9.6, 0, 0, -5.45], [6.8, -4.75, Math.PI / 2, -2.1], [6.8, 4.75, Math.PI / 2, -2.1]].forEach(([w, x, ry, z]) => { const r = grp(g, x, yr, z, ry);
        P(r, w, 0.95, RAIL, 0, 0, 0, { edge: true }); P(r, w, 0.95, RAIL, 0, 0, 0, { ry: Math.PI }); B(r, w, 0.06, 0.08, PAL.iron, 0, 0.95, 0, FLAT); });
      B(g, 1.9, 2.4, 1.9, W, 0, yr, -4.3); B(g, 2.1, 0.15, 2.1, SLAB, 0, yr + 2.4, -4.3);          // stair hut
      P(g, 0.9, 1.9, A, 0, yr, -3.33);
      [-2.8, 2.8].forEach(x => { B(g, 0.08, 2.2, 0.08, PAL.iron, x, yr, -1.4, NE); CYL(g, 0.05, 1.5, 0.5, 8, A, x, yr + 2.0, -1.4, { open: true });   // umbrellas + loungers
        B(g, 0.7, 0.25, 1.7, '#f6f0e2', x - 0.6, yr, -0.6, NE); B(g, 0.7, 0.25, 1.7, '#f6f0e2', x + 0.6, yr, -0.6, NE); });
      [[-4.1, 0.7], [4.1, 0.7], [-4.1, -4.9], [4.1, -4.9]].forEach(([x, z]) => { B(g, 0.6, 0.45, 0.6, SLAB, x, yr, z, NE); ICO(g, 0.42, 0, PAL.leaf2, x, yr + 0.85, z, NE); });
      // garden: palms + plants + surfboard
      palm(g, 4.3, 0.2, 4.3, 0.95, 0.2); palm(g, -4.4, 0.2, -4.4, 0.85, 0.16);
      B(g, 0.55, 2.2, 0.1, A, -4.4, 0.36, 3.6, { rz: 0.16, ry: 0.3, edge: false });                 // surfboard by the deck
      return g;
    } });

  // ---- landmark ----
  // Vinland Tower (the 10K landmark): a supertall with a wide base and a smooth taper, light silver-blue glass,
  // 4 champagne-gold ribbons wrapping the shaft that carry on past the top floor and twist together into the needle
  // (the ribbon crown), a glass public observation deck band just below where they meet, a red light on the tip. Arrival plaza: avenue, fountain, benches, trees, the Vinland flag.
  // Night: VinlandKit.setNight(g, true) lights the windows, the gold ribbons up into the point, the deck and the beacon.
  let towerTex = null;
  function towerTextures() {                                            // window grid (day) + lit windows (night), drawn once
    if (towerTex || typeof document === 'undefined') return towerTex;
    const mk = draw => { const c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d'));
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 0.75); return t; };
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const day = mk(x => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 3 ? '#e6eef3' : '#f3f7fa'; x.fillRect(i * 32 + 2, 0, 28, 256); }   // glass panes, a few brighter
      x.fillStyle = '#ffffff'; for (let j = 0; j < 8; j++) x.fillRect(0, j * 32, 256, 3); });                            // floor lines
    const night = mk(x => { x.fillStyle = '#000000'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const r = rnd(); if (r < 0.58) { x.fillStyle = r < 0.12 ? '#ffffff' : r < 0.4 ? '#ffe2a8' : '#c9b48a'; x.fillRect(i * 32 + 4, j * 32 + 6, 24, 22); } } });
    return (towerTex = { day, night });
  }
  function ribbonGeo(P, n) {                                          // a smooth band along a path: P(t) gives height, radius, angle, width, thickness
    const at = t => { const q = P(Math.min(1, Math.max(0, t))); return { q, p: new THREE.Vector3(Math.sin(q.a) * q.r, q.y, Math.cos(q.a) * q.r) }; }, pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, { q, p } = at(t), tan = at(t + 0.5 / n).p.sub(at(t - 0.5 / n).p).normalize();
      const out = new THREE.Vector3(Math.sin(q.a), 0, Math.cos(q.a)), b = new THREE.Vector3().crossVectors(tan, out).normalize().multiplyScalar(q.w / 2), inn = out.clone().multiplyScalar(-q.th);
      pts.push([p.clone().add(b), p.clone().sub(b), p.clone().add(b).add(inn), p.clone().sub(b).add(inn)]); }
    const tris = [], v = q => [q.x, q.y, q.z];
    for (let i = 0; i < n; i++) { const [U, D, Ui, Di] = pts[i], [U2, D2, Ui2, Di2] = pts[i + 1];
      tris.push([...v(U), ...v(D), ...v(D2)], [...v(U), ...v(D2), ...v(U2)], [...v(U), ...v(U2), ...v(Ui2)], [...v(U), ...v(Ui2), ...v(Ui)], [...v(D), ...v(Di2), ...v(D2)], [...v(D), ...v(Di), ...v(Di2)]); }
    return flat(tris);
  }
  def({ key: 'vinlandTower', name: 'Vinland Tower', cat: 'Landmarks', part: 1, budget: 6000, size: 'Plaza 120 × 120 m · 243 m tall', night: true,
    opts: {},
    make(o) {
      const g = new THREE.Group(), tex = towerTextures();
      const GLASS = (() => { const k = 'vtGlass'; if (!mats[k]) { const m = toon('#c4deed'); if (tex) { m.map = tex.day; m.emissiveMap = tex.night; } m.userData.glow = '#ffffff'; mats[k] = m; } return mats[k]; })();
      const GOLD = (() => { const m = glowMat('#f0dcaa', '#f0b040'); m.side = THREE.DoubleSide; m.userData.dayGlow = '#241d0e'; m.emissive.set('#241d0e'); return m; })();   // light champagne, a soft sheen by day
      const WHITE = glowMat('#f7f5f0', '#8a8478'), SILVER = glowMat('#e9eff2', '#d8c49a'), OBS = glowMat('#a9d0e2', '#ffffff'), LOBBY = glowMat('#cfe0ea', '#f3d79a');
      const BEACON = glowMat('#ff4a30', '#ff3a20'), STONE = '#e9e1d2', PAVE = '#f3ede1', TRIM = PAL.sand2;
      const y0 = 12, H = 150, r0 = 19, r1 = 7.5, yTop = y0 + H, rAt = y => r1 + (r0 - r1) * Math.pow(1 - Math.min(1, Math.max(0, (y - y0) / H)), 1.5);
      // --- plaza ---
      B(g, 120, 0.3, 120, '#e3d8c4', 0, 0, 0, { shadow: false });
      CYL(g, 34, 34, 0.3, 16, PAVE, 0, 0.3, 0, { shadow: false });
      B(g, 16, 0.08, 30, PAVE, 0, 0.3, 45, FLAT);                                                   // the avenue in
      [-1, 1].forEach(s => { B(g, 7, 0.34, 26, PAL.water, s * 20, 0.3, 45, FLAT);                    // reflecting pools
        [34, 44, 54].forEach(z => { B(g, 0.22, 4.4, 0.22, PAL.iron, s * 9, 0.6, z, NE); ICO(g, 0.42, 0, glowMat(PAL.lampOn, '#ffd98a'), s * 9, 5.1, z, NE); }); });
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) > 0) continue;   // ring of trees, open at the avenue
        const x = Math.sin(a) * 46, z = Math.cos(a) * 46; CYL(g, 0.3, 0.4, 2.6, 6, PAL.wood, x, 0.3, z, { edge: false, open: true }); ICO(g, 2.6, 0, i % 4 ? PAL.leaf : PAL.pink, x, 4.6, z); }
      [[-54, -54], [54, -54], [-54, 54], [54, 54]].forEach(([x, z]) => tree(g, x, 0.3, z, 'cypress', 1.3));
      const fz = 48;                                                                                // fountain where the avenue meets the plaza
      CYL(g, 7, 7.4, 0.9, 16, TRIM, 0, 0.3, fz, { open: true }); CYL(g, 6.9, 6.9, 0.6, 16, PAL.water, 0, 0.4, fz, NE);
      CYL(g, 1.2, 1.6, 2.6, 8, TRIM, 0, 1.2, fz); CYL(g, 3, 1.2, 0.7, 12, TRIM, 0, 3.8, fz); CYL(g, 0.5, 0.8, 1.6, 8, TRIM, 0, 4.5, fz);
      CYL(g, 0.1, 2.4, 2.8, 8, glowMat('#cdeaf3', '#6ec3dc'), 0, 6.1, fz, { open: true, edge: false });   // the spray
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, s = grp(g, Math.sin(a) * 11, 0.3, fz + Math.cos(a) * 11, a + Math.PI);   // benches facing the fountain
        B(s, 3, 0.45, 0.8, PAL.wood, 0, 0, 0); B(s, 3, 0.7, 0.14, PAL.wood, 0, 0.45, -0.34); }
      { const f = grp(g, -12, 0.3, 58);                                                             // the Vinland flag
        CYL(f, 1.4, 1.6, 0.6, 8, TRIM, 0, 0, 0); CYL(f, 0.16, 0.22, 16, 6, PAL.iron, 0, 0.6, 0, { edge: false, open: true });
        ICO(f, 0.45, 0, '#e2b04a', 0, 16.8, 0, NE); B(f, 6, 3.6, 0.12, PAL.terra, 3.1, 12.4, 0, NE); }
      // --- lobby podium ---
      CYL(g, 23, 24, 11.4, 16, LOBBY, 0, 0.6, 0, { open: true });
      CYL(g, 25.5, 25.5, 1, 16, WHITE, 0, 11.6, 0);
      B(g, 16, 0.7, 9, GOLD, 0, 7.6, 27.5); [-7, 7].forEach(x => B(g, 0.5, 7, 0.5, GOLD, x, 0.6, 31.4, NE));   // gold entrance canopy
      // --- the shaft: 8 sections following the curve, silver-blue glass ---
      for (let i = 0; i < 8; i++) { const ya = y0 + i * H / 8, yb = ya + H / 8;
        CYL(g, rAt(yb), rAt(ya), H / 8, 16, GLASS, 0, ya, 0, { open: true });
        if (i) CYL(g, rAt(ya) + 0.25, rAt(ya) + 0.25, 0.6, 16, SILVER, 0, ya - 0.3, 0, { open: true, edge: false }); }
      // --- the ribbon crown: the 4 gold ribbons leave the top floor and twist together into the needle ---
      const CH = 56, yMeet = yTop + CH, ys = y0 + 2, rate = Math.PI * 1.05 / (H - 6), rTop = rAt(yTop) + 0.35;   // same twist rate where shaft and crown join
      const crownR = c => rTop * (1 - Math.pow(c, 2.6)) + 0.35 * c;   // stays wide, then closes like a flame
      const ribbon = a0 => t => { const y = ys + (yMeet - ys) * t;
        if (y <= yTop) return { y, r: rAt(y) + 0.35, a: a0 + rate * (y - ys), w: 3.6, th: 0.6 };
        const c = (y - yTop) / CH;                                                                   // 0 at the top floor, 1 where they meet
        return { y, r: crownR(c), a: a0 + rate * (yTop - ys) + rate * CH * c + Math.PI * 0.35 * c * c, w: 3.6 * (1 - 0.82 * c), th: 0.6 - 0.35 * c }; };
      for (let k = 0; k < 4; k++) put(g, ribbonGeo(ribbon(k * Math.PI / 2), 72), GOLD, 0, 0, 0, { edge: false });
      CYL(g, r1 + 0.8, r1 + 0.8, 0.9, 16, WHITE, 0, yTop, 0);                                       // roof of the top floor
      CYL(g, 0.6, 2.4, CH - 2, 8, WHITE, 0, yTop + 0.9, 0);                                         // slim core inside the crown
      // public observation deck: a wide glass ring on a white disc, with an outer terrace and railing (seen from far)
      const yd = yTop + 24, R = 11, DECK = glowMat('#f7f5f0', '#f2efe6');
      CYL(g, R + 2.4, R + 1.2, 1, 24, DECK, 0, yd - 1, 0);                                          // the disc
      CYL(g, R, R, 4.6, 24, OBS, 0, yd, 0, { open: true });                                         // glass ring
      CYL(g, R + 0.5, R - 1.5, 0.8, 24, DECK, 0, yd + 4.6, 0);                                      // roof
      CYL(g, R + 2.2, R + 2.2, 1.1, 24, '#d7ebf2', 0, yd, 0, { open: true, edge: false, shadow: false });   // glass railing
      CYL(g, R + 2.25, R + 2.25, 0.12, 24, PAL.iron, 0, yd + 1.1, 0, { open: true, edge: false });
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; B(g, 0.1, 1.1, 0.1, PAL.iron, Math.sin(a) * (R + 2.2), yd, Math.cos(a) * (R + 2.2), FLAT); }
      CYL(g, 0.12, 0.75, 26, 8, WHITE, 0, yMeet - 2, 0);                                            // the needle and its red light
      BALL(g, 1.2, BEACON, 0, yMeet + 24.4, 0, NE);
      return g;
    } });

  // ---- cars (made-up shapes: no real brands, no logos, no badges) ----
  // Hatchback: small city car. Slot: body.
  def({ key: 'carHatch', name: 'Hatchback', cat: 'Cars', part: 1, budget: 400, size: '1.9 × 4.2 m',
    opts: { body: colours('Paint', SETS.cars) },
    make(o) {
      const g = new THREE.Group(), body = slot('body', pick(o, 'body', SETS.cars));
      TAPER(g, 1.9, 0.72, 4.2, body, 0, 0.3, 0, { tw: 0.94, td: 0.97 });                    // lower body
      TAPER(g, 1.72, 0.66, 2.7, PAL.glass, 0, 1.02, -0.45, { tw: 0.84, td: 0.7, tz: -0.06 }, NE);   // glass cabin
      B(g, 1.5, 0.08, 1.95, body, 0, 1.66, -0.6);                                           // roof
      B(g, 1.94, 0.1, 0.9, body, 0, 0.98, 1.5, NE);                                         // bonnet lip
      B(g, 1.96, 0.2, 0.22, PAL.iron, 0, 0.3, 2.04, NE); B(g, 1.96, 0.2, 0.22, PAL.iron, 0, 0.3, -2.04, NE);    // bumpers
      [-0.62, 0.62].forEach(x => { P(g, 0.42, 0.18, PAL.lampOn, x, 0.66, 2.11); P(g, 0.4, 0.16, PAL.tail, x, 0.7, -2.11, { ry: Math.PI }); });
      P(g, 0.7, 0.14, PAL.iron, 0, 0.56, 2.11);                                             // grille
      [[-0.92, 1.3], [0.92, 1.3], [-0.92, -1.3], [0.92, -1.3]].forEach(([x, z]) => WHEEL(g, 0.4, 0.3, x, z));
      return g;
    } });

  function carEnds(g, w, zf, zb, y) {                                  // bumpers, head and tail lights, grille
    B(g, w + 0.06, 0.2, 0.22, PAL.iron, 0, y - 0.32, zf - 0.07, NE); B(g, w + 0.06, 0.2, 0.22, PAL.iron, 0, y - 0.32, zb + 0.07, NE);
    [-1, 1].forEach(s => { P(g, 0.4, 0.16, PAL.lampOn, s * (w / 2 - 0.32), y, zf + 0.01); P(g, 0.38, 0.15, PAL.tail, s * (w / 2 - 0.32), y + 0.02, zb - 0.01, { ry: Math.PI }); });
    P(g, 0.7, 0.14, PAL.iron, 0, y - 0.1, zf + 0.01);
  }
  const wheels4 = (g, r, w, x, zf, zb) => [[-x, zf], [x, zf], [-x, zb], [x, zb]].forEach(([a, b]) => WHEEL(g, r, w, a, b));

  // Sedan: three-box family car. Slot: body.
  def({ key: 'carSedan', name: 'Sedan', cat: 'Cars', part: 1, budget: 400, size: '1.9 × 4.6 m', opts: { body: colours('Paint', ['#3f7fbf'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#3f7fbf');
      TAPER(g, 1.9, 0.68, 4.6, b, 0, 0.3, 0, { tw: 0.95, td: 0.97 });
      TAPER(g, 1.74, 0.6, 2.5, PAL.glass, 0, 0.98, -0.2, { tw: 0.82, td: 0.6 }, NE);
      B(g, 1.42, 0.08, 1.5, b, 0, 1.56, -0.2);
      carEnds(g, 1.9, 2.3, -2.3, 0.72); wheels4(g, 0.38, 0.28, 0.92, 1.45, -1.45); return g; } });

  // SUV: tall and boxy, roof rails. Slot: body.
  def({ key: 'carSUV', name: 'SUV', cat: 'Cars', part: 1, budget: 450, size: '2 × 4.6 m', opts: { body: colours('Paint', ['#9aa3a8'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#9aa3a8');
      TAPER(g, 2, 0.92, 4.6, b, 0, 0.38, 0, { tw: 0.97, td: 0.95 });
      TAPER(g, 1.88, 0.72, 3.3, PAL.glass, 0, 1.28, -0.35, { tw: 0.92, td: 0.86, tz: -0.03 }, NE);
      B(g, 1.74, 0.1, 2.85, b, 0, 2.0, -0.45);
      [-0.7, 0.7].forEach(x => B(g, 0.06, 0.1, 2.5, PAL.iron, x, 2.1, -0.45, NE));
      B(g, 2.06, 0.3, 4.3, PAL.iron, 0, 0.32, 0, NE);                                             // dark wheel-arch skirt
      carEnds(g, 2, 2.3, -2.3, 0.98); wheels4(g, 0.46, 0.32, 0.96, 1.5, -1.5); return g; } });

  // Pickup: cab in front, open bed at the back. Slot: body.
  def({ key: 'carPickup', name: 'Pickup', cat: 'Cars', part: 1, budget: 450, size: '2 × 5.2 m', opts: { body: colours('Paint', ['#2f7a68'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#2f7a68');
      TAPER(g, 2, 0.8, 5.2, b, 0, 0.38, 0, { tw: 0.97, td: 0.98 });
      TAPER(g, 1.86, 0.74, 1.9, PAL.glass, 0, 1.18, 0.55, { tw: 0.9, td: 0.72, tz: -0.04 }, NE);
      B(g, 1.66, 0.1, 1.4, b, 0, 1.9, 0.5);
      B(g, 1.8, 0.04, 2.3, PAL.iron, 0, 1.19, -1.35, FLAT);                                         // the bed
      [-0.95, 0.95].forEach(x => B(g, 0.1, 0.42, 2.4, b, x, 1.18, -1.35, NE)); B(g, 2, 0.42, 0.1, b, 0, 1.18, -2.55, NE); B(g, 2, 0.42, 0.1, b, 0, 1.18, -0.2, NE);
      carEnds(g, 2, 2.6, -2.6, 0.92); wheels4(g, 0.45, 0.32, 0.96, 1.75, -1.6); return g; } });

  // Sports car: low red wedge, rear spoiler (the Villa's car). Slot: body.
  def({ key: 'carSports', name: 'Sports car', cat: 'Cars', part: 1, budget: 450, size: '2.2 × 4.8 m', opts: { body: colours('Paint', ['#d8231f'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#d8231f');
      TAPER(g, 2.2, 0.55, 4.8, b, 0, 0.25, 0, { tw: 0.94, td: 0.96 });
      TAPER(g, 1.9, 0.2, 1.6, b, 0, 0.8, 1.5, { tw: 0.9, td: 0.8, tz: -0.1 });
      TAPER(g, 1.74, 0.46, 2.1, PAL.glass, 0, 0.8, -0.3, { tw: 0.76, td: 0.52, tz: -0.08 }, NE);
      B(g, 1.9, 0.08, 0.42, PAL.tyre, 0, 1.06, -2.15); [-0.7, 0.7].forEach(x => B(g, 0.08, 0.28, 0.16, PAL.tyre, x, 0.8, -2.15, NE));
      [-0.72, 0.72].forEach(x => { P(g, 0.48, 0.12, PAL.lampOn, x, 0.56, 2.41); P(g, 0.52, 0.12, PAL.tail, x, 0.62, -2.41, { ry: Math.PI }); });
      [[-1, 1.5, 0.42], [1, 1.5, 0.42], [-1, -1.5, 0.48], [1, -1.5, 0.48]].forEach(([s, z, r]) => WHEEL(g, r, 0.38, s * 1.06, z, 12)); return g; } });

  // Van: tall box with a sloped nose, sliding door. Slot: body.
  def({ key: 'carVan', name: 'Van', cat: 'Cars', part: 1, budget: 450, size: '2 × 4.9 m', opts: { body: colours('Paint', ['#f6f0e2'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#f6f0e2');
      TAPER(g, 2, 1.9, 4.9, b, 0, 0.32, -0.1, { tw: 0.96, td: 0.86, tz: -0.07 });
      put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), PAL.glass, 0, 1.75, 2.0, { rx: -0.42, s: [1.7, 0.9, 1], edge: false, shadow: false });
      [-1, 1].forEach(s => { P(g, 1.1, 0.6, PAL.glass, s * 0.97, 1.5, 1.2, { ry: s * Math.PI / 2 }); P(g, 2.0, 0.55, PAL.glass, s * 0.95, 1.55, -0.9, { ry: s * Math.PI / 2 });
        P(g, 0.04, 1.1, PAL.iron, s * 0.995, 0.75, 0.4, { ry: s * Math.PI / 2 }); });
      carEnds(g, 2, 2.35, -2.55, 0.85); wheels4(g, 0.4, 0.3, 0.94, 1.55, -1.65); return g; } });

  // Taxi: black and yellow city taxi (kaali-peeli), with a roof light. Slots: body, roof.
  def({ key: 'carTaxi', name: 'Taxi', cat: 'Cars', part: 1, budget: 450, size: '1.8 × 4.1 m', opts: { body: colours('Body', ['#2f2b28', '#e8b830', '#2f7a68']), roof: colours('Roof', ['#e8b830', '#2f2b28', '#f6f0e2']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#2f2b28'), r = slot('roof', o.roof || '#e8b830');
      TAPER(g, 1.8, 0.66, 4.1, b, 0, 0.32, 0, { tw: 0.95, td: 0.96 });
      TAPER(g, 1.66, 0.6, 2.4, PAL.glass, 0, 0.98, -0.15, { tw: 0.84, td: 0.66 }, NE);
      B(g, 1.4, 0.1, 1.6, r, 0, 1.56, -0.15);
      B(g, 0.8, 0.26, 0.34, glowMat(PAL.cream, '#e8c860'), 0, 1.66, 0, NE);
      carEnds(g, 1.8, 2.05, -2.05, 0.72); wheels4(g, 0.36, 0.26, 0.86, 1.3, -1.3); return g; } });

  // Scooter: step-through scooter, no brand. Slot: body.
  def({ key: 'scooter', name: 'Scooter', cat: 'Cars', part: 1, budget: 250, size: '0.7 × 1.8 m', opts: { body: colours('Paint', SETS.cars) },
    make(o) { const g = new THREE.Group(), b = slot('body', pick(o, 'body', SETS.cars));
      WHEEL(g, 0.27, 0.14, 0, 0.62, 8); WHEEL(g, 0.27, 0.16, 0, -0.6, 8);
      B(g, 0.38, 0.1, 0.72, PAL.iron, 0, 0.28, 0.02, NE);                                         // floor board
      TAPER(g, 0.52, 0.48, 0.92, b, 0, 0.36, -0.44, { tw: 0.82, td: 0.86, tz: 0.03 });             // rear body
      B(g, 0.36, 0.12, 0.72, PAL.tyre, 0, 0.84, -0.38, NE);                                       // seat
      TAPER(g, 0.5, 0.82, 0.2, b, 0, 0.3, 0.46, { tw: 0.72, td: 1, tz: -0.4 });                     // front apron
      B(g, 0.2, 0.08, 0.42, b, 0, 0.58, 0.62, NE);                                                 // mudguard
      CYL(g, 0.04, 0.04, 0.44, 6, PAL.iron, 0, 0.98, 0.4, NE);
      B(g, 0.26, 0.18, 0.16, b, 0, 1.3, 0.42, NE); B(g, 0.66, 0.05, 0.06, PAL.iron, 0, 1.36, 0.38, NE);
      [-0.24, 0.24].forEach(x => B(g, 0.03, 0.18, 0.03, PAL.iron, x, 1.41, 0.38, NE));
      P(g, 0.16, 0.1, PAL.lampOn, 0, 1.34, 0.51); P(g, 0.2, 0.08, PAL.tail, 0, 0.62, -0.91, { ry: Math.PI }); return g; } });

  // Auto-rickshaw: three wheels, open sides, canvas roof. Slots: body, roof.
  def({ key: 'autoRickshaw', name: 'Auto-rickshaw', cat: 'Cars', part: 1, budget: 450, size: '1.3 × 2.7 m', opts: { body: colours('Body', ['#2f7a68', '#2f2b28', '#e8b830', '#3f7fbf']), roof: colours('Roof', ['#e8b830', '#2f2b28', '#2f7a68']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#2f7a68'), r = slot('roof', o.roof || '#e8b830'), SEAT = '#3a2a20';
      WHEEL(g, 0.27, 0.16, 0, 0.98, 8); WHEEL(g, 0.27, 0.16, -0.6, -0.8, 8); WHEEL(g, 0.27, 0.16, 0.6, -0.8, 8);
      B(g, 1.24, 0.14, 2.1, PAL.iron, 0, 0.34, -0.08, NE);                                        // floor
      TAPER(g, 0.92, 0.78, 0.6, b, 0, 0.48, 0.92, { tw: 0.7, td: 0.6, tz: -0.14 });               // front cowl
      B(g, 1.3, 0.56, 1.1, b, 0, 0.48, -0.72);                                                    // rear body
      B(g, 1.12, 0.16, 0.52, SEAT, 0, 1.04, -0.74, NE); B(g, 1.12, 0.52, 0.12, SEAT, 0, 1.12, -1.18, NE);
      B(g, 0.42, 0.12, 0.4, SEAT, 0, 0.9, 0.3, NE);
      [[-0.6, 0.62], [0.6, 0.62], [-0.6, -1.22], [0.6, -1.22]].forEach(([x, z]) => B(g, 0.05, 0.92, 0.05, PAL.iron, x, 1.04, z, NE));
      TAPER(g, 1.4, 0.34, 2.3, r, 0, 1.94, -0.28, { tw: 0.9, td: 0.88 });                          // canvas roof
      P(g, 1.04, 0.66, PAL.glass, 0, 1.26, 0.78, { edge: true });                                  // windscreen
      B(g, 0.6, 0.05, 0.05, PAL.iron, 0, 1.12, 0.7, NE);
      P(g, 0.16, 0.14, PAL.lampOn, 0, 1.0, 1.23); [-0.5, 0.5].forEach(x => P(g, 0.14, 0.1, PAL.tail, x, 0.86, -1.28, { ry: Math.PI })); return g; } });

  // ---- characters ----
  // Citizen: same size as the walkers on the map (about 2 m). Legs and arms are their own groups
  // (g.userData.limbs = { legL, legR, armL, armR }, pivots at the hips and shoulders) so walk mode can swing them.
  // Slots: skin, hair, top, bottom, hat. Choices: outfit, hair style, hat.
  def({ key: 'person', name: 'Citizen', cat: 'Characters', part: 1, budget: 400,   // 350 without an accessory size: '2 m tall',
    opts: { skin: colours('Skin', SETS.skins), hairStyle: choices('Hair', ['short', 'long', 'bun', 'bald']), hair: colours('Hair colour', SETS.hairs),
      outfit: choices('Outfit', ['tee', 'shirt', 'kurta', 'dress', 'saree']), top: colours('Top', SETS.tops), bottom: colours('Bottom', SETS.bottoms),
      hat: choices('Hat', ['none', 'cap', 'sunhat', 'beanie', 'tophat', 'turban']), hatColor: colours('Hat colour', SETS.hats),
      acc: choices('Accessory', ['none', 'glasses', 'sunglasses', 'scarf', 'backpack', 'necklace']), accColor: colours('Accessory colour', SETS.tops) },
    make(o) {
      const g = new THREE.Group(), outfit = o.outfit || 'tee', hs = o.hairStyle || 'short', hat = o.hat || 'none';
      const sk = slot('skin', pick(o, 'skin', SETS.skins)), hr = slot('hair', pick(o, 'hair', SETS.hairs)), tp = slot('top', pick(o, 'top', SETS.tops)),
        bt = slot('bottom', pick(o, 'bottom', SETS.bottoms)), ht = slot('hat', pick(o, 'hatColor', SETS.hats));
      const saree = outfit === 'saree', dress = outfit === 'dress', long = outfit === 'shirt' || outfit === 'kurta', limbs = {}, acc = o.acc || 'none', ac = slot('acc', pick(o, 'accColor', SETS.tops));
      [['legL', -0.15], ['legR', 0.15]].forEach(([k, x]) => { const l = limbs[k] = grp(g, x, 0.72, 0);
        if (!saree) B(l, 0.22, 0.72, 0.24, dress ? sk : bt, 0, -0.72, 0, NE); B(l, 0.26, 0.12, 0.34, PAL.iron, 0, -0.72, 0.05, NE); });
      TAPER(g, 0.62, 0.72, 0.36, tp, 0, 0.7, 0, { tw: 1.06, td: 1 }, NE);                        // body, a little wider at the shoulders
      if (dress) TAPER(g, 0.86, 0.42, 0.56, tp, 0, 0.3, 0, { tw: 0.72, td: 0.64 }, NE);           // skirt
      if (outfit === 'kurta') B(g, 0.64, 0.3, 0.38, tp, 0, 0.42, 0, NE);                          // the kurta hangs lower
      if (saree) { TAPER(g, 0.7, 0.66, 0.46, tp, 0, 0.06, 0, { tw: 1.05, td: 1 }, NE);              // saree: long skirt, a drape across the chest, the pallu behind
        B(g, 0.2, 0.92, 0.05, bt, 0.02, 0.62, 0.2, { rz: 0.55, edge: false }); B(g, 0.22, 0.8, 0.05, bt, -0.24, 0.6, -0.2, NE); }
      [['armL', -1], ['armR', 1]].forEach(([k, s]) => { const a = limbs[k] = grp(g, s * 0.41, 1.38, 0); a.rotation.z = s * 0.05;
        const sleeve = long ? 0.5 : 0.28;
        B(a, 0.17, sleeve + 0.06, 0.19, tp, 0, -sleeve, 0, NE); B(a, 0.14, 0.62 - sleeve, 0.16, sk, 0, -0.62, 0, NE); });
      put(g, geo('head', () => new THREE.SphereGeometry(1, 9, 7)), sk, 0, 1.74, 0, { edge: false, s: [0.31, 0.31, 0.31] });   // round head
      [-1, 1].forEach(s => put(g, geo('dot', () => new THREE.CircleGeometry(1, 5)), PAL.iron, s * 0.1, 1.73, 0.298, { edge: false, shadow: false, ry: s * 0.34, s: [0.042, 0.055, 1] }));   // eyes, flat on the face
      if (hs !== 'bald') CAP(g, 0.33, hr, 0, 1.78, -0.02, NE);
      if (hs === 'long') B(g, 0.52, 0.5, 0.14, hr, 0, 1.3, -0.24, NE);
      if (hs === 'bun' && hat === 'none') ICO(g, 0.13, 0, hr, 0, 2.08, -0.12, NE);
      if (hat === 'cap') { CAP(g, 0.345, ht, 0, 1.82, 0, NE); B(g, 0.36, 0.04, 0.26, ht, 0, 1.86, 0.36, NE); }
      if (hat === 'beanie') { CAP(g, 0.35, ht, 0, 1.82, 0, NE); oct(g, 0.09, ht, 0, 2.19, 0); }
      if (hat === 'sunhat') { CYL(g, 0.56, 0.56, 0.04, 8, ht, 0, 1.94, 0, NE); CYL(g, 0.26, 0.3, 0.2, 6, ht, 0, 1.96, 0, NE); }
      if (hat === 'turban') { put(g, geo('cap', () => new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2.2)), ht, 0, 1.78, 0, { edge: false, s: [0.37, 0.46, 0.37] }); ICO(g, 0.09, 0, ht, 0, 2.06, 0.3, NE); }
      if (acc === 'glasses' || acc === 'sunglasses') { [-1, 1].forEach(s => B(g, 0.14, 0.1, 0.03, acc === 'glasses' ? '#cfe6f0' : PAL.iron, s * 0.1, 1.69, 0.3, NE)); B(g, 0.36, 0.025, 0.03, PAL.iron, 0, 1.78, 0.305, FLAT); }
      if (acc === 'scarf') { CYL(g, 0.25, 0.27, 0.14, 8, ac, 0, 1.33, 0, { edge: false, open: true }); B(g, 0.12, 0.45, 0.05, ac, 0.13, 0.92, 0.2, NE); }
      if (acc === 'backpack') { B(g, 0.46, 0.55, 0.2, ac, 0, 0.75, -0.28, NE); [-0.17, 0.17].forEach(x => B(g, 0.06, 0.5, 0.02, PAL.iron, x, 0.9, 0.19, FLAT)); }
      if (acc === 'necklace') { CYL(g, 0.19, 0.24, 0.05, 8, '#e2b04a', 0, 1.36, 0.02, { open: true, edge: false }); oct(g, 0.05, '#e2b04a', 0, 1.24, 0.2); }
      if (hat === 'tophat') { CYL(g, 0.42, 0.42, 0.04, 8, ht, 0, 1.98, 0, NE); CYL(g, 0.27, 0.27, 0.42, 6, ht, 0, 2.0, 0, NE); }
      g.userData.limbs = limbs;
      return g;
    } });

  // ================= PART 2 =================

  // ---- street kit: small pieces that make a street feel lived in. Night: lamps and lights glow. ----
  const LAMP = () => glowMat('#fff1c8', '#ffd98a');
  def({ key: 'streetLamp', name: 'Street lamp', cat: 'Street', part: 2, budget: 80, size: '4.6 m tall', night: true, opts: {},
    make() { const g = new THREE.Group();
      B(g, 0.4, 0.3, 0.4, PAL.iron, 0, 0, 0, NE); CYL(g, 0.08, 0.12, 4.2, 6, PAL.iron, 0, 0.3, 0, { edge: false, open: true });
      B(g, 0.62, 0.14, 0.62, PAL.iron, 0, 4.5, 0, NE); TAPER(g, 0.5, 0.5, 0.5, LAMP(), 0, 4.0, 0, { tw: 1.2, td: 1.2 }, NE); return g; } });

  def({ key: 'bench', name: 'Bench', cat: 'Street', part: 2, budget: 100, size: '2 m long', opts: { wood: colours('Wood', [PAL.wood, '#3f5866', '#47684a']) },
    make(o) { const g = new THREE.Group(), w = slot('wood', o.wood || PAL.wood);
      B(g, 2, 0.1, 0.5, w, 0, 0.45, 0); B(g, 2, 0.45, 0.08, w, 0, 0.62, -0.26);
      [-0.85, 0.85].forEach(x => { B(g, 0.08, 0.45, 0.46, PAL.iron, x, 0, 0, NE); B(g, 0.08, 0.5, 0.08, PAL.iron, x, 0.55, -0.26, NE); }); return g; } });

  def({ key: 'dustbin', name: 'Dustbin', cat: 'Street', part: 2, budget: 60, size: '1 m tall', opts: { body: colours('Colour', ['#47684a', '#3f5866', '#c8603f']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#47684a');
      CYL(g, 0.32, 0.27, 0.85, 8, b, 0, 0, 0, { open: true }); CYL(g, 0.36, 0.36, 0.1, 8, PAL.iron, 0, 0.85, 0, NE); return g; } });

  def({ key: 'busStop', name: 'Bus stop', cat: 'Street', part: 2, budget: 260, size: '4 × 1.6 m', night: true, opts: {},
    make() { const g = new THREE.Group();
      B(g, 4.4, 0.12, 1.8, '#d8d2c6', 0, 0, 0, { shadow: false });
      [-1.9, 1.9].forEach(x => B(g, 0.12, 2.6, 0.12, PAL.iron, x, 0.12, -0.6, NE));
      P(g, 3.8, 1.8, '#bfe0ea', 0, 0.6, -0.72, { edge: true });                                    // glass back
      TAPER(g, 4.4, 0.18, 1.8, PAL.terra, 0, 2.72, -0.1, { tw: 1, td: 1 });                        // roof
      B(g, 2.4, 0.08, 0.4, PAL.wood, 0, 0.6, -0.45); [-1, 1].forEach(x => B(g, 0.06, 0.48, 0.06, PAL.iron, x, 0.12, -0.45, NE));
      B(g, 0.1, 2.9, 0.1, PAL.iron, 2.4, 0.12, 0.6, NE); B(g, 0.7, 0.7, 0.08, glowMat('#3f7fbf', '#3f7fbf'), 2.4, 2.6, 0.6, NE);   // the bus sign
      B(g, 1.2, 0.08, 0.3, LAMP(), 0, 2.66, -0.1, NE); return g; } });

  def({ key: 'trafficLight', name: 'Traffic light', cat: 'Street', part: 2, budget: 120, size: '3.6 m tall', night: true, opts: {},
    make() { const g = new THREE.Group();
      CYL(g, 0.08, 0.1, 3.0, 6, PAL.iron, 0, 0, 0, { edge: false, open: true }); B(g, 0.42, 1.2, 0.34, PAL.iron, 0, 2.7, 0);
      [['#e8473a', 3.6], ['#f2c14e', 3.3], ['#5fbf6a', 3.0]].forEach(([c, y]) => put(g, geo('dot', () => new THREE.CircleGeometry(1, 5)), glowMat(c, c), 0, y, 0.18, { edge: false, shadow: false, s: [0.12, 0.12, 1] }));
      B(g, 0.5, 0.06, 0.2, PAL.iron, 0, 3.86, 0.1, NE); return g; } });

  def({ key: 'signpost', name: 'Signpost', cat: 'Street', part: 2, budget: 80, size: '3 m tall', opts: {},
    make() { const g = new THREE.Group();
      B(g, 0.12, 3, 0.12, PAL.iron, 0, 0, 0, NE);
      TAPER(g, 1.6, 0.36, 0.08, '#2f7a68', 0.75, 2.5, 0, { tw: 1, td: 1 }); TAPER(g, 1.4, 0.36, 0.08, '#3f5866', -0.65, 2.05, 0, { tw: 1, td: 1 });
      return g; } });

  def({ key: 'planterTree', name: 'Planter tree', cat: 'Street', part: 2, budget: 150, size: '1.6 m box', opts: { kind: choices('Tree', ['canopy', 'pink', 'purple', 'cypress']) },
    make(o) { const g = new THREE.Group(); B(g, 1.6, 0.6, 1.6, PAL.sand2, 0, 0, 0); B(g, 1.4, 0.05, 1.4, '#6b4f3a', 0, 0.6, 0, FLAT);
      tree(g, 0, 0.6, 0, o.kind || 'canopy', 0.8); return g; } });

  def({ key: 'bollard', name: 'Bollard', cat: 'Street', part: 2, budget: 70, size: '0.9 m', opts: {},
    make() { const g = new THREE.Group(); CYL(g, 0.14, 0.16, 0.8, 6, PAL.iron, 0, 0, 0, { open: true }); CYL(g, 0.17, 0.17, 0.1, 6, '#e2b04a', 0, 0.62, 0, { edge: false, open: true }); CAP(g, 0.14, PAL.iron, 0, 0.8, 0, NE); return g; } });

  def({ key: 'postBox', name: 'Post box', cat: 'Street', part: 2, budget: 80, size: '1.3 m tall', opts: {},
    make() { const g = new THREE.Group(); CYL(g, 0.32, 0.34, 1.1, 8, PAL.terra, 0, 0.1, 0, { open: true }); B(g, 0.8, 0.1, 0.8, PAL.iron, 0, 0, 0, NE);
      CAP(g, 0.34, PAL.terra, 0, 1.2, 0, NE); P(g, 0.36, 0.06, PAL.iron, 0, 0.95, 0.335); return g; } });

  def({ key: 'hydrant', name: 'Fire hydrant', cat: 'Street', part: 2, budget: 90, size: '0.8 m', opts: {},
    make() { const g = new THREE.Group(); CYL(g, 0.16, 0.18, 0.6, 8, '#d8231f', 0, 0, 0, { open: true }); CAP(g, 0.17, '#d8231f', 0, 0.6, 0, NE);
      CYL(g, 0.07, 0.07, 0.46, 6, '#d8231f', 0, 0.28, 0, { rz: Math.PI / 2, edge: false }); return g; } });

  def({ key: 'zebraCrossing', name: 'Zebra crossing', cat: 'Street', part: 2, budget: 40, size: '8 × 3 m', opts: {},
    make() { const g = new THREE.Group(); for (let i = 0; i < 7; i++) put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), '#f6f0e2', -3.6 + i * 1.2, 0.03, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [0.6, 3, 1] })); return g; } });

  // Chai stall: a small tea cart with a canopy, a kettle on the stove and two stools.
  def({ key: 'chaiStall', name: 'Chai stall', cat: 'Street', part: 2, budget: 400, size: '2.4 × 1.4 m', night: true, opts: { canopy: colours('Canopy', [PAL.terra, '#2f7a68', '#e8b830', '#3f7fbf']) },
    make(o) { const g = new THREE.Group(), c = slot('canopy', o.canopy || PAL.terra);
      B(g, 2.2, 0.9, 1.1, PAL.wood, 0, 0.3, 0); B(g, 2.3, 0.08, 1.2, PAL.sand, 0, 1.2, 0);
      WHEEL(g, 0.3, 0.1, -1.15, 0, 8); WHEEL(g, 0.3, 0.1, 1.15, 0, 8);
      [[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.5], [1.05, 0.5]].forEach(([x, z]) => B(g, 0.06, 1.3, 0.06, PAL.iron, x, 1.28, z, NE));
      TAPER(g, 2.6, 0.4, 1.6, c, 0, 2.58, 0, { tw: 0.2, td: 0.4 });                                 // canopy
      CYL(g, 0.18, 0.2, 0.12, 8, PAL.iron, -0.5, 1.28, 0); CYL(g, 0.1, 0.16, 0.28, 8, '#9aa3a8', -0.5, 1.4, 0, NE);   // stove + kettle
      [0.2, 0.45, 0.7].forEach(x => CYL(g, 0.05, 0.04, 0.1, 6, '#f6f0e2', x, 1.28, 0.25, { edge: false }));         // glasses
      B(g, 0.9, 0.3, 0.06, LAMP(), 0, 2.2, 0.62, NE);                                             // little sign light
      [-0.7, 0.7].forEach(x => CYL(g, 0.18, 0.18, 0.45, 6, '#c9922e', x, 0, 1.2, { edge: false })); return g; } });

  // ---- shop fronts: one shared front (same size and look as the map's Market shops, 10 x 10 m plot),
  // the sign, the awning colour and the props change with the kind of shop. o.name = the owner's shop name on the sign.
  // Market spots are SMALL shops only (CLAUDE.md rule 2b). Night: windows and the sign glow. ----
  function textMat(text, bg, fg) {                                      // a sign with words on it (made-up shop names only, no brands)
    if (typeof document === 'undefined') return mat(bg);
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 512, 96); let size = 56; const font = s => `700 ${s}px Poppins, 'Segoe UI', sans-serif`;
    x.font = font(size); while (x.measureText(text).width > 460 && size > 14) x.font = font(size -= 2);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50);
    const t = new THREE.CanvasTexture(c), m = toon('#ffffff'); m.map = t; m.emissiveMap = t; m.userData.glow = '#c8c8c8'; return m;
  }
  const NEON = c => glowMat(c, c);
  function shopFront(o, kind) {
    const g = new THREE.Group(), A = slot('awning', o.awning || kind.awning), W = slot('wall', o.wall || '#f2e6cc'), WARM = glowMat(PAL.glassWarm, '#ffcf6a');
    B(g, 10, 0.2, 10, '#d8c7a0', 0, 0, 0, { shadow: false });
    B(g, 7.4, 3.6, 5.8, W, 0, 0.2, -1.4);                                                         // shop floor
    B(g, 7.4, 2.6, 5.8, '#ead6b0', 0, 3.8, -1.4);                                                 // upstairs
    B(g, 7.8, 0.3, 6.2, PAL.sand2, 0, 6.4, -1.4); B(g, 7.8, 0.6, 0.3, PAL.sand2, 0, 6.7, 1.45);   // roof slab, parapet
    B(g, 6, 0.95, 0.16, PAL.iron, 0, 2.72, 1.55, { shadow: false });                              // sign board
    P(g, 5.6, 0.75, textMat((o.name || kind.sign).toUpperCase(), '#2f2b28', kind.ink || '#f6d27a'), 0, 2.82, 1.64);
    put(g, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), A, 0, 2.45, 2.35, { rx: 0.38, s: [7.6, 0.14, 1.9] });   // awning
    P(g, 2.3, 1.6, WARM, -2.3, 0.75, 1.52); P(g, 2.3, 1.6, WARM, 2.3, 0.75, 1.52);               // shop windows
    P(g, 1.2, 2, PAL.wood, 0, 0.2, 1.52);                                                        // door
    win(g, -2.4, 4.5, 1.52, 0, 0.9, 1.1); win(g, 0, 4.5, 1.52, 0, 0.9, 1.1); win(g, 2.4, 4.5, 1.52, 0, 0.9, 1.1);
    kind.props(g, o);
    return g;
  }
  const crate = (g, x, z, fill) => { B(g, 1, 0.5, 0.7, PAL.wood, x, 0.2, z); fill.forEach((c, i) => ICO(g, 0.16, 0, c, x - 0.3 + (i % 3) * 0.3, 0.8, z - 0.15 + Math.floor(i / 3) * 0.3, NE)); };
  const SHOPS = [
    { key: 'shopCafe', name: 'Caf\u00e9', sign: 'Caf\u00e9', awning: '#2f7a68', props(g) {
      [-2.9, -0.7].forEach(x => { CYL(g, 0.5, 0.5, 0.06, 8, PAL.cream, x, 0.95, 3.6); CYL(g, 0.05, 0.05, 0.75, 6, PAL.iron, x, 0.2, 3.6, { edge: false, open: true });
        CYL(g, 0.05, 0.05, 1.9, 6, PAL.iron, x, 1.0, 3.6, { edge: false, open: true }); CYL(g, 0.02, 1.2, 0.5, 8, x < -2 ? PAL.terra : PAL.cream, x, 2.7, 3.6, { open: true });
        [-0.7, 0.7].forEach(d => B(g, 0.4, 0.45, 0.4, PAL.wood, x + d, 0.2, 3.6, NE)); });
      CYL(g, 1.3, 1.3, 0.1, 10, PAL.cream, 0, 6.7, -0.6); CYL(g, 0.9, 0.7, 1.2, 10, PAL.cream, 0, 6.8, -0.6);   // giant cup on the roof
      B(g, 0.2, 0.6, 0.6, PAL.cream, 1.0, 7.1, -0.6, NE); CYL(g, 0.8, 0.8, 0.04, 10, '#6b4f3a', 0, 7.96, -0.6, NE); } },
    { key: 'shopBakery', name: 'Bakery', sign: 'Bakery', awning: '#c9922e', props(g) {
      B(g, 2.6, 0.8, 0.8, PAL.wood, -2.4, 0.2, 2.6);                                              // bread table
      for (let i = 0; i < 4; i++) put(g, geo('cap', () => new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2.2)), '#c98a4a', -3.3 + i * 0.6, 1.0, 2.6, { edge: false, s: [0.26, 0.18, 0.18] });
      put(g, geo('cap', () => new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2.2)), '#c98a4a', 0, 6.7, -0.6, { s: [1.8, 0.9, 0.9] });   // giant loaf
      [-0.8, 0, 0.8].forEach(x => B(g, 0.1, 0.06, 0.9, '#f3e1b8', x, 7.48, -0.6, FLAT)); } },
    { key: 'shopBooks', name: 'Bookshop', sign: 'Bookshop', awning: '#3f5866', props(g) {
      B(g, 2.4, 0.9, 0.7, PAL.wood, -2.6, 0.2, 2.6); WHEEL(g, 0.2, 0.08, -3.85, 2.6, 6);
      ['#c8603f', '#2f7a68', '#c9922e', '#6a4a8c', '#3f7fbf', '#d88fb0', '#47684a', '#b5543a'].forEach((c, i) => B(g, 0.22, 0.42 + (i % 3) * 0.06, 0.5, c, -3.6 + i * 0.28, 1.1, 2.6, NE));
      [-1, 1].forEach(s => { B(g, 1.6, 0.14, 2.1, '#6a4a8c', s * 0.8, 6.85, -0.6, { rz: -s * 0.22 }); B(g, 1.5, 0.08, 2, '#f7f0e1', s * 0.78, 7.0, -0.6, { rz: -s * 0.22, edge: false }); }); } },
    { key: 'shopGrocery', name: 'Grocery', sign: 'Grocery', awning: '#47684a', props(g) {
      crate(g, -3.4, 2.8, Array(6).fill('#e8873a')); crate(g, -2.2, 2.8, Array(6).fill('#7fb069')); crate(g, -1.0, 2.8, Array(6).fill('#d8231f'));
      ICO(g, 1.2, 1, '#d8231f', 0, 7.9, -0.6); B(g, 0.12, 0.5, 0.12, PAL.wood, 0, 8.9, -0.6, NE); B(g, 0.6, 0.1, 0.3, PAL.leaf, 0.35, 9.15, -0.6, { rz: 0.4, edge: false }); } },
    { key: 'shopBoats', name: 'Boat shop', sign: 'Boats', awning: '#3f7fbf', props(g) {
      [-3.6, -1.6].forEach(x => B(g, 0.15, 0.7, 1.2, PAL.wood, x, 0.2, 3.3, NE));                  // trestles + a rowboat for sale
      TAPER(g, 1.1, 0.5, 3, '#c8603f', -2.6, 0.9, 3.3, { tw: 1.3, td: 1.05 }); B(g, 1.2, 0.06, 2.9, '#f6f0e2', -2.6, 1.38, 3.3, NE);
      put(g, geo('boatT', () => new THREE.TorusGeometry(1, 0.32, 6, 10)), '#e8473a', 0, 7.8, -0.4, { edge: false });   // lifebuoy on the roof
      [0, 1, 2, 3].forEach(i => B(g, 0.2, 0.68, 0.3, '#f6f0e2', Math.cos(i * Math.PI / 2 + 0.78) * 1, 7.8 + Math.sin(i * Math.PI / 2 + 0.78) * 1, -0.4, { rz: i * Math.PI / 2 + 0.78, edge: false })); } },
    { key: 'shopPharmacy', name: 'Pharmacy', sign: 'Pharmacy', awning: '#2f7a68', props(g) {
      const X = NEON('#3fbf6a'); B(g, 0.6, 2.0, 0.4, X, 0, 6.9, -0.6); B(g, 2.0, 0.6, 0.4, X, 0, 7.6, -0.6);   // green cross
      B(g, 0.12, 2.2, 0.12, PAL.iron, 3.4, 0.2, 2.8, NE); B(g, 0.9, 0.9, 0.12, X, 3.4, 2.2, 2.8, NE); } },
    { key: 'shopBarber', name: 'Barber', sign: 'Barber', awning: '#3f5866', props(g) {
      const p = grp(g, 3.25, 0, 1.75); CYL(p, 0.2, 0.2, 2, 8, '#f6f0e2', 0, 0.6, 0, { open: true });   // barber pole
      [0.8, 1.3, 1.8].forEach((y, i) => CYL(p, 0.21, 0.21, 0.22, 8, i === 1 ? '#3f7fbf' : '#d8231f', 0, y, 0, { open: true, edge: false }));
      CAP(p, 0.22, '#e2b04a', 0, 2.6, 0, NE);
      [-1, 1].forEach(s => B(g, 0.35, 2.6, 0.12, '#c9ced2', s * 0.3, 6.8, -0.6, { rz: s * 0.4 }));   // giant scissors
      [-1, 1].forEach(s => put(g, geo('boatT', () => new THREE.TorusGeometry(1, 0.32, 6, 10)), PAL.iron, s * 0.75, 6.75, -0.6, { s: [0.45, 0.45, 0.45], edge: false })); } },
    { key: 'shopFlorist', name: 'Florist', sign: 'Flowers', awning: '#d88fb0', props(g) {
      ['#d88fb0', '#a084c8', '#f2c14e', '#e8473a', '#f6f0e2'].forEach((c, i) => { CYL(g, 0.28, 0.22, 0.5, 6, '#9aa3a8', -3.6 + i * 0.6, 0.2, 2.6, { open: true, edge: false }); ICO(g, 0.3, 0, c, -3.6 + i * 0.6, 0.95, 2.6, NE); });
      [-2.3, 2.3].forEach(x => { B(g, 2.3, 0.3, 0.4, PAL.wood, x, 0.45, 1.75, NE); [-0.7, 0, 0.7].forEach(d => ICO(g, 0.22, 0, PAL.pink, x + d, 0.85, 1.75, NE)); });
      ICO(g, 0.5, 0, '#f2c14e', 0, 7.7, -0.6, NE);                                                  // giant flower
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(g, geo('ico0', () => new THREE.IcosahedronGeometry(1, 0)), PAL.pink, Math.cos(a) * 0.9, 7.7 + Math.sin(a) * 0.9, -0.7, { s: [0.6, 0.6, 0.25], edge: false }); }
      B(g, 0.12, 1.0, 0.12, PAL.leaf, 0, 6.7, -0.6, NE); } },
    { key: 'shopClothing', name: 'Clothing', sign: 'Clothing', awning: '#6a4a8c', props(g) {
      const m1 = KIT.person({ outfit: 'dress', top: '#d88fb0', skin: '#f6f0e2', hairStyle: 'bald' }), m2 = KIT.person({ outfit: 'shirt', top: '#3f5866', skin: '#f6f0e2', hairStyle: 'bald', hat: 'cap' });
      m1.position.set(-3.4, 0.2, 2.8); m2.position.set(-2.4, 0.2, 2.8); g.add(m1, m2);              // two mannequins
      B(g, 2.2, 0.06, 0.06, PAL.iron, -0.4, 1.9, 3.4, NE); [-1.2, 0.4].forEach(x => B(g, 0.06, 1.7, 0.06, PAL.iron, x, 0.2, 3.4, NE));
      ['#c8603f', '#2f7a68', '#c9922e', '#3f7fbf'].forEach((c, i) => B(g, 0.08, 0.8, 0.5, c, -1.0 + i * 0.4, 1.05, 3.4, NE));
      const t = grp(g, 0, 7.2, -0.6); B(t, 1.4, 1.5, 0.3, '#3f7fbf', 0, -0.2, 0);                  // giant T-shirt
      [-1, 1].forEach(s => B(t, 0.8, 0.5, 0.3, '#3f7fbf', s * 0.85, 0.8, 0, { rz: -s * 0.5 })); } },
  ];
  SHOPS.forEach(k => def({ key: k.key, name: k.name, cat: 'Shops', part: 2, budget: 1200, size: '1 shop spot · 10 × 10 m', night: true,
    opts: { awning: colours('Awning', [k.awning, PAL.terra, '#2f7a68', '#3f5866', '#c9922e', '#d88fb0', '#6a4a8c']), wall: colours('Wall', ['#f2e6cc', '#f2cfb3', '#c9d8b6', '#c8dbe6']) },
    make: o => shopFront(o, k) }));

  // ---- party kit (Night: everything lights up) ----
  const oct = (p, r, m, x, y, z, o) => put(p, geo('oct', () => new THREE.OctahedronGeometry(1, 0)), m, x, y, z, Object.assign({ edge: false, shadow: false, s: [r, r, r] }, o));
  const BULBS = ['#ffd98a', '#e8473a', '#5fbf6a', '#3f7fbf', '#f2c14e', '#d88fb0'];
  const sagLine = (g, x1, x2, y, sag, n, f) => { for (let i = 0; i <= n; i++) { const t = i / n; f(x1 + (x2 - x1) * t, y - sag * (1 - Math.pow(2 * t - 1, 2)), i); } };
  const wire = (g, x1, x2, y, sag) => sagLine(g, x1, x2, y, sag, 8, (x, yy, i) => { if (i === 8) return; const t2 = (i + 1) / 8, x2b = x1 + (x2 - x1) * t2, y2 = y - sag * (1 - Math.pow(2 * t2 - 1, 2));
    B(g, Math.hypot(x2b - x, y2 - yy) + 0.02, 0.03, 0.03, PAL.iron, (x + x2b) / 2, (yy + y2) / 2 - 0.015, 0, { rz: Math.atan2(y2 - yy, x2b - x), edge: false, shadow: false }); });
  const posts = (g, x1, x2, h) => [x1, x2].forEach(x => { B(g, 0.14, h, 0.14, PAL.wood, x, 0, 0, NE); B(g, 0.4, 0.1, 0.4, PAL.iron, x, 0, 0, NE); });
  def({ key: 'fairyLights', name: 'Fairy lights', cat: 'Party', part: 2, budget: 400, size: '6 m string', night: true, opts: {},
    make() { const g = new THREE.Group(); posts(g, -3, 3, 3.2); wire(g, -3, 3, 3.1, 0.8);
      sagLine(g, -3, 3, 3.05, 0.8, 18, (x, y, i) => oct(g, 0.09, NEON(BULBS[i % BULBS.length]), x, y - 0.08, 0)); return g; } });
  def({ key: 'lanterns', name: 'Lanterns', cat: 'Party', part: 2, budget: 450, size: '6 m string', night: true, opts: {},
    make() { const g = new THREE.Group(); posts(g, -3, 3, 3.4); wire(g, -3, 3, 3.3, 0.6);
      sagLine(g, -3, 3, 3.3, 0.6, 6, (x, y, i) => { if (!i || i === 6) return; const c = ['#e8473a', '#f2c14e', '#e8873a', '#d88fb0', '#e8473a'][i - 1];
        CYL(g, 0.3, 0.3, 0.55, 8, glowMat(c, c), x, y - 0.75, 0, { edge: false, shadow: false }); CYL(g, 0.18, 0.18, 0.06, 6, PAL.iron, x, y - 0.2, 0, { edge: false, open: true }); CYL(g, 0.18, 0.18, 0.06, 6, PAL.iron, x, y - 0.82, 0, { edge: false, open: true }); }); return g; } });
  def({ key: 'balloons', name: 'Balloons', cat: 'Party', part: 2, budget: 300, size: '2.6 m tall', opts: {},
    make() { const g = new THREE.Group(); B(g, 0.3, 0.2, 0.3, PAL.iron, 0, 0, 0, NE);
      [[0, 2.5, 0, '#e8473a'], [-0.45, 2.2, 0.2, '#f2c14e'], [0.45, 2.25, -0.1, '#3f7fbf'], [-0.2, 2.0, -0.4, '#d88fb0'], [0.3, 1.95, 0.4, '#5fbf6a'], [-0.5, 2.6, -0.3, '#a084c8'], [0.5, 2.7, 0.3, '#f6f0e2']].forEach(([x, y, z, c]) => {
        put(g, geo('ico0', () => new THREE.IcosahedronGeometry(1, 0)), c, x, y, z, { s: [0.32, 0.4, 0.32], edge: false }); const L = Math.hypot(x, y - 0.2, z);
        put(g, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), '#f6f0e2', x / 2, (y + 0.2) / 2 - 0.15, z / 2, { s: [0.015, L - 0.3, 0.015], rz: -Math.atan2(x, y), rx: Math.atan2(z, y), edge: false, shadow: false }); }); return g; } });
  def({ key: 'speaker', name: 'Speaker', cat: 'Party', part: 2, budget: 120, size: '1.6 m tall', night: true, opts: {},
    make() { const g = new THREE.Group(); B(g, 0.8, 1.5, 0.7, PAL.iron, 0, 0, 0);
      [[1.05, 0.26], [0.45, 0.2]].forEach(([y, r]) => { put(g, geo('dot', () => new THREE.CircleGeometry(1, 5)), '#55504a', 0, y, 0.36, { edge: false, shadow: false, s: [r, r, 1] });
        CYL(g, r + 0.04, r + 0.04, 0.03, 10, NEON('#a084c8'), 0, y, 0.355, { rx: Math.PI / 2, open: true, edge: false, shadow: false }); }); return g; } });
  def({ key: 'danceFloor', name: 'Dance floor', cat: 'Party', part: 2, budget: 150, size: '4 × 4 m', night: true, opts: {},
    make() { const g = new THREE.Group(); B(g, 4.4, 0.2, 4.4, PAL.iron, 0, 0, 0, { shadow: false }); const C4 = ['#e8473a', '#f2c14e', '#3f7fbf', '#d88fb0', '#5fbf6a', '#a084c8'];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), NEON(C4[(i * 3 + j * 2) % C4.length]), -1.5 + i, 0.21, -1.5 + j, { rx: -Math.PI / 2, s: [0.94, 0.94, 1], edge: false, shadow: false });
      return g; } });
  def({ key: 'diwaliLights', name: 'Diwali lights', cat: 'Party', part: 2, budget: 500, size: '6 m', night: true, opts: {},
    make() { const g = new THREE.Group(); const FL = NEON('#ffb340');
      [[2.2, '#e8473a'], [1.6, '#f2c14e'], [1.0, '#d88fb0'], [0.45, '#f6f0e2']].forEach(([r, c], i) => put(g, geo('rang', () => new THREE.CircleGeometry(1, 12)), c, 0, 0.02 + i * 0.005, 1.6, { rx: -Math.PI / 2, s: [r, r, 1], edge: false, shadow: false }));   // rangoli
      B(g, 6, 0.3, 0.8, PAL.sand2, 0, 0, -0.6);                                                    // a step with a row of diyas
      for (let i = 0; i < 9; i++) { const x = -2.6 + i * 0.65; CYL(g, 0.14, 0.09, 0.1, 6, PAL.terra2, x, 0.3, -0.6, { edge: false, open: true }); oct(g, 0.06, FL, x, 0.5, -0.6, { s: [0.05, 0.11, 0.05] }); }
      posts(g, -3, 3, 3.2); sagLine(g, -3, 3, 3.15, 0.5, 16, (x, y, i) => oct(g, 0.13, glowMat(i % 2 ? '#e8873a' : '#f2c14e', '#a85a10'), x, y - 0.1, 0));   // marigold toran
      oct(g, 0.55, NEON('#f2c14e'), 0, 2.0, 0, { edge: true }); B(g, 0.02, 0.5, 0.02, PAL.iron, 0, 2.55, 0, FLAT);   // akash kandil (star lantern)
      [-0.15, 0.15].forEach(x => B(g, 0.03, 0.5, 0.03, '#e8473a', x, 0.95, 0, FLAT)); return g; } });

  // ---- Coin Shop looks: cosmetics only (never homes, votes, jobs, titles, spots or power). ----
  SETS.homeSets = [['Classic', '#f6f0e2', '#c8603f'], ['Rose', '#f2cfb3', '#b5543a'], ['Mint', '#c9d8b6', '#4f9a86'], ['Sky', '#c8dbe6', '#5b5f66'],
    ['Saffron', '#f3dfa2', '#c8603f'], ['Lavender', '#d9cfe6', '#6a4a8c'], ['Midnight', '#3f5866', '#2f2b28'], ['Royal gold', '#f6f0e2', '#c9a24a']];
  def({ key: 'homeColours', name: 'Home colour sets', cat: 'Coin Shop', part: 2, budget: 700, size: 'wall + roof, on any home', opts: { set: choices('Set', SETS.homeSets.map(s => s[0])) },
    make(o) { const s = SETS.homeSets.find(x => x[0] === o.set) || SETS.homeSets[0]; return KIT.houseStarter({ wall: s[1], roof: s[2] }); } });

  // garden: the front strip of a home plot (10 x 4 m)
  def({ key: 'garden', name: 'Garden', cat: 'Coin Shop', part: 2, budget: 400, size: 'front garden · 10 × 4 m', opts: { style: choices('Style', ['flowers', 'vegetables', 'rock', 'fountain', 'swing']) },
    make(o) { const g = new THREE.Group(), s = o.style || 'flowers'; B(g, 10, 0.2, 4, PAL.grass, 0, 0, 0, { shadow: false });
      if (s === 'flowers') [-3.4, 3.4].forEach(x => { B(g, 2.8, 0.25, 2.6, '#6b4f3a', x, 0.2, 0, NE); ['#d88fb0', '#f2c14e', '#a084c8', '#e8473a', '#f6f0e2', '#d88fb0'].forEach((c, i) => ICO(g, 0.3, 0, c, x - 0.9 + (i % 3) * 0.9, 0.7, -0.6 + Math.floor(i / 3) * 1.2, NE)); });
      if (s === 'vegetables') [-3.4, 3.4].forEach(x => { B(g, 2.8, 0.3, 2.6, '#6b4f3a', x, 0.2, 0, NE); for (let i = 0; i < 8; i++) ICO(g, 0.22, 0, i % 4 === 3 ? '#e8473a' : PAL.leaf2, x - 1.05 + (i % 4) * 0.7, 0.65, -0.5 + Math.floor(i / 4) * 1.0, NE); });
      if (s === 'rock') { B(g, 7, 0.06, 3, '#d9d2c4', 0, 0.2, 0, FLAT); [[-2.5, 0.6, 0.7], [-1.6, -0.4, 0.45], [2.4, 0.3, 0.8], [1.4, -0.6, 0.35]].forEach(([x, z, r]) => put(g, geo('rock', () => new THREE.DodecahedronGeometry(1, 0)), '#b9b2a4', x, 0.2 + r * 0.4, z, { s: [r, r * 0.7, r] }));
        tree(g, 0, 0.2, 0, 'cypress', 0.5); }
      if (s === 'fountain') { B(g, 4, 0.06, 3.4, '#e6dccb', 0, 0.2, 0, FLAT); CYL(g, 1.2, 1.3, 0.5, 10, PAL.sand2, 0, 0.2, 0, { open: true }); CYL(g, 1.15, 1.15, 0.36, 10, PAL.water, 0, 0.2, 0, NE);
        CYL(g, 0.18, 0.25, 1.1, 6, PAL.sand2, 0, 0.5, 0, NE); CYL(g, 0.6, 0.2, 0.2, 8, PAL.sand2, 0, 1.6, 0, NE); [-3.4, 3.4].forEach(x => hedge(g, 2.6, 2.6, x, 0)); }
      if (s === 'swing') { [-1.2, 1.2].forEach(x => B(g, 0.15, 2.4, 0.15, PAL.wood, x, 0.2, 0, NE)); B(g, 2.6, 0.15, 0.15, PAL.wood, 0, 2.6, 0, NE);
        [-0.4, 0.4].forEach(x => B(g, 0.03, 1.8, 0.03, PAL.iron, x, 0.85, 0, FLAT)); B(g, 1.0, 0.08, 0.4, PAL.terra, 0, 0.8, 0, NE); tree(g, -3.6, 0.2, 0, 'pink', 0.7); tree(g, 3.6, 0.2, 0, 'canopy', 0.7); }
      return g; } });

  // fence: one 10 m side of a plot
  def({ key: 'fence', name: 'Fence', cat: 'Coin Shop', part: 2, budget: 400, size: '10 m side', opts: { style: choices('Style', ['picket', 'hedge', 'stone', 'iron', 'bamboo']) },
    make(o) { const g = new THREE.Group(), s = o.style || 'picket';
      if (s === 'picket') { B(g, 10, 0.1, 0.08, '#f4efe4', 0, 0.55, 0, NE); B(g, 10, 0.1, 0.08, '#f4efe4', 0, 0.25, 0, NE); for (let i = 0; i <= 16; i++) TAPER(g, 0.14, 0.95, 0.06, '#f4efe4', -5 + i * 0.625, 0, 0.04, { tw: 0.2, td: 1 }, NE); }
      if (s === 'hedge') B(g, 10, 1.1, 0.8, PAL.leaf, 0, 0, 0);
      if (s === 'stone') { B(g, 10, 0.8, 0.4, PAL.sand2, 0, 0, 0); B(g, 10.1, 0.1, 0.5, PAL.sand, 0, 0.8, 0, NE); }
      if (s === 'iron') { rail(g, 10, 0, 0, 0, 0, 1.2, 0.42); [-5, 5].forEach(x => B(g, 0.3, 1.4, 0.3, PAL.sand2, x, 0, 0, NE)); }
      if (s === 'bamboo') { for (let i = 0; i <= 24; i++) CYL(g, 0.07, 0.07, 1.1 + (i % 3) * 0.1, 5, '#c9b46a', -5 + i * 10 / 24, 0, 0, { open: true, edge: false }); B(g, 10, 0.06, 0.18, '#8a6a3a', 0, 0.8, 0, NE); }
      return g; } });

  def({ key: 'gate', name: 'Gate', cat: 'Coin Shop', part: 2, budget: 300, size: '2 m opening', opts: { style: choices('Style', ['wooden', 'iron', 'arch']) },
    make(o) { const g = new THREE.Group(), s = o.style || 'wooden'; [-1.2, 1.2].forEach(x => B(g, 0.4, 1.4, 0.4, PAL.sand2, x, 0, 0));
      if (s === 'wooden') [-0.5, 0.5].forEach(x => { B(g, 0.95, 1.0, 0.08, PAL.wood, x, 0.15, 0); B(g, 0.95, 0.1, 0.1, '#5a3a24', x, 0.75, 0.02, NE); });
      if (s === 'iron') { rail(g, 2, 0, 0.1, 0, 0, 1.4, 0.18); [-1.2, 1.2].forEach(x => ICO(g, 0.16, 0, '#e2b04a', x, 1.6, 0, NE)); }
      if (s === 'arch') { [-1.2, 1.2].forEach(x => B(g, 0.2, 2.6, 0.2, '#f4efe4', x, 1.4, 0, NE)); B(g, 2.8, 0.2, 0.3, '#f4efe4', 0, 3.9, 0, NE);
        for (let i = 0; i < 7; i++) ICO(g, 0.2, 0, i % 2 ? PAL.pink : PAL.leaf2, -1.2 + i * 0.4, 4.15, 0, NE); [-1.2, 1.2].forEach(x => [2, 3].forEach(y => ICO(g, 0.2, 0, PAL.pink, x, y, 0.15, NE))); }
      return g; } });

  // pets
  const FUR = ['#c98a4a', '#2f2b28', '#f6f0e2', '#8a5a3a', '#d9c49a', '#9a958c'];
  def({ key: 'dog', name: 'Dog', cat: 'Coin Shop', part: 2, budget: 180, size: 'medium dog', opts: { fur: colours('Fur', FUR), size: choices('Size', ['medium', 'small', 'big']) },
    make(o) { const g = new THREE.Group(), f = slot('fur', o.fur || FUR[0]), k = { small: 0.7, big: 1.3 }[o.size] || 1, d = grp(g); d.scale.setScalar(k);
      B(d, 0.36, 0.34, 0.8, f, 0, 0.32, 0, NE);                                                    // body
      [[-0.12, 0.28], [0.12, 0.28], [-0.12, -0.28], [0.12, -0.28]].forEach(([x, z]) => B(d, 0.1, 0.34, 0.1, f, x, 0, z, NE));
      B(d, 0.3, 0.3, 0.32, f, 0, 0.58, 0.5, NE); B(d, 0.16, 0.13, 0.18, f, 0, 0.6, 0.73, NE); B(d, 0.07, 0.06, 0.04, PAL.iron, 0, 0.69, 0.82, NE);   // head, snout, nose
      [-1, 1].forEach(s => { B(d, 0.08, 0.16, 0.1, f, s * 0.13, 0.82, 0.45, { rz: s * 0.4, edge: false }); put(d, geo('dot', () => new THREE.CircleGeometry(1, 5)), PAL.iron, s * 0.08, 0.76, 0.665, { edge: false, shadow: false, s: [0.03, 0.03, 1] }); });
      B(d, 0.06, 0.3, 0.06, f, 0, 0.6, -0.42, { rx: -0.6, edge: false }); B(d, 0.3, 0.05, 0.05, PAL.terra, 0, 0.58, 0.36, NE);   // tail, collar
      return g; } });
  def({ key: 'cat', name: 'Cat', cat: 'Coin Shop', part: 2, budget: 160, size: 'house cat', opts: { fur: colours('Fur', ['#e8873a', '#2f2b28', '#f6f0e2', '#9a958c', '#c98a4a']) },
    make(o) { const g = new THREE.Group(), f = slot('fur', o.fur || '#e8873a');
      B(g, 0.24, 0.24, 0.55, f, 0, 0.22, 0, NE); [[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]].forEach(([x, z]) => B(g, 0.07, 0.24, 0.07, f, x, 0, z, NE));
      B(g, 0.24, 0.22, 0.22, f, 0, 0.4, 0.33, NE);
      [-1, 1].forEach(s => { TAPER(g, 0.08, 0.1, 0.05, f, s * 0.07, 0.62, 0.34, { tw: 0.05, td: 0.5 }, NE); put(g, geo('dot', () => new THREE.CircleGeometry(1, 5)), '#5fbf6a', s * 0.055, 0.53, 0.445, { edge: false, shadow: false, s: [0.025, 0.03, 1] }); });
      B(g, 0.05, 0.4, 0.05, f, 0, 0.38, -0.3, { rx: -0.35, edge: false }); B(g, 0.05, 0.14, 0.05, f, 0, 0.74, -0.37, { rx: 0.6, edge: false }); return g; } });

  // car paints: special paints for any car (shown on the hatchback)
  SETS.carPaints = [['Gold', '#d4af37'], ['Rose gold', '#d8a28f'], ['Pearl', '#f4f1ea'], ['Midnight', '#1f2a44'], ['Racing green', '#1f4d3a'], ['Chrome', '#c9ced2'], ['Flame', '#e8473a'], ['Lilac', '#b9a2d8']];
  def({ key: 'carPaints', name: 'Car paints', cat: 'Coin Shop', part: 2, budget: 400, size: 'any car', opts: { paint: choices('Paint', SETS.carPaints.map(p => p[0])) },
    make(o) { const p = SETS.carPaints.find(x => x[0] === o.paint) || SETS.carPaints[0]; return KIT.carHatch({ body: p[1] }); } });

  // gold name tag: floats over a home or a citizen
  def({ key: 'nameTag', name: 'Gold name tag', cat: 'Coin Shop', part: 2, budget: 80, size: '3 m wide', night: true, opts: {},
    make(o) { const g = new THREE.Group(), GOLDT = glowMat('#d4af37', '#8a6a1a'), name = o.name || '@citizen';
      B(g, 3.2, 0.9, 0.16, GOLDT, 0, 0, 0); [1, -1].forEach(s => P(g, 2.9, 0.65, textMat(name, '#3a2a20', '#f6d27a'), 0, 0.12, s * 0.085, { ry: s > 0 ? 0 : Math.PI }));
      oct(g, 0.18, NEON('#f6d27a'), 0, 1.15, 0, { edge: true }); return g; } });

  // ---------- tools ----------
  // how many triangles an asset has (outline lines are not counted)
  KIT.tris = function (g) { let n = 0; g.traverse(o => { if (o.isMesh) { const ge = o.geometry; n += (ge.index ? ge.index.count : ge.attributes.position.count) / 3; } }); return Math.round(n); };
  KIT.make = (key, o) => KIT[key](o);
  // passport portrait: the citizen's head and shoulders, straight on, on the passport's pale blue.
  // VinlandKit.portrait({ skin, hairStyle, hair, outfit, top, hat, hatColor }, { w: 220, h: 280, bg }) returns a PNG data URL
  // (same 110 x 140 shape as the passport photo box). Drawn in the browser, nothing is uploaded.
  let pr = null;
  KIT.portrait = function (o, size) {
    size = size || {}; const w = size.w || 220, h = size.h || 280;
    if (!pr) { const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }), s = new THREE.Scene();
      s.add(new THREE.HemisphereLight('#fff6e8', '#8a7a64', 0.8)); const l = new THREE.DirectionalLight('#fff0dc', 0.55); l.position.set(-1.2, 2.2, 3); s.add(l);
      pr = { r, s, cam: new THREE.PerspectiveCamera(13, 1, 0.1, 50) }; }
    pr.r.setPixelRatio(1); pr.r.setSize(w, h, false); pr.s.background = new THREE.Color(size.bg || '#d8e2e6');
    const p = KIT.person(o || {}); pr.s.add(p);
    pr.cam.aspect = w / h; pr.cam.position.set(0, 1.78, 4.6); pr.cam.lookAt(0, 1.7, 0); pr.cam.updateProjectionMatrix();
    pr.r.render(pr.s, pr.cam); const url = pr.r.domElement.toDataURL('image/png'); pr.s.remove(p); return url;
  };
  // night: windows, ribbons and lights glow (for assets with night: true in the list)
  KIT.setNight = (g, on) => g.traverse(m => { if (m.isMesh && m.material.userData.glow) m.material.emissive.set(on ? m.material.userData.glow : m.material.userData.dayGlow || '#000000'); });

  // bake: squash an asset into one piece per colour, ready for InstancedMesh
  KIT.bake = function (g) {
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), M = new THREE.Matrix4(), parts = new Map(), lines = [];
    const cat = a => { const out = new Float32Array(a.reduce((t, x) => t + x.length, 0)); let k = 0; a.forEach(x => { out.set(x, k); k += x.length; }); return out; };
    g.traverse(o => {
      if (!o.isMesh && !o.isLineSegments) return; M.multiplyMatrices(inv, o.matrixWorld);
      if (o.isLineSegments) { const ge = o.geometry.clone(); ge.applyMatrix4(M); lines.push(ge.attributes.position.array); return; }
      const key = o.material.uuid + (o.castShadow ? 's' : 'n');
      if (!parts.has(key)) parts.set(key, { slot: o.material.userData.slot || null, color: o.material.color.clone(), shadow: o.castShadow, pos: [], nor: [] });
      const ge = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); ge.applyMatrix4(M);
      const pt = parts.get(key); pt.pos.push(ge.attributes.position.array); pt.nor.push(ge.attributes.normal.array);
    });
    const list = [...parts.values()].map(pt => { const ge = new THREE.BufferGeometry();
      ge.setAttribute('position', new THREE.BufferAttribute(cat(pt.pos), 3)); ge.setAttribute('normal', new THREE.BufferAttribute(cat(pt.nor), 3)); ge.computeBoundingSphere();
      return { slot: pt.slot, color: pt.color, shadow: pt.shadow, geo: ge }; });
    return { parts: list, lines: cat(lines) };
  };
  // instances: draw many copies. matrices = array of THREE.Matrix4; tints(i) = { slotName: '#hex' } for copy i (optional).
  KIT.instances = function (baked, matrices, tints) {
    const out = new THREE.Group(), n = matrices.length, c = new THREE.Color();
    baked.parts.forEach(pt => { const im = new THREE.InstancedMesh(pt.geo, toon('#ffffff'), n);
      for (let i = 0; i < n; i++) { im.setMatrixAt(i, matrices[i]); const t = pt.slot && tints && tints(i); im.setColorAt(i, t && t[pt.slot] ? c.set(t[pt.slot]) : c.copy(pt.color)); }
      im.castShadow = pt.shadow; im.receiveShadow = true; im.frustumCulled = false; out.add(im); });
    const L = baked.lines, all = new Float32Array(L.length * n), v = new THREE.Vector3();
    matrices.forEach((m, i) => { for (let k = 0; k < L.length; k += 3) { v.set(L[k], L[k + 1], L[k + 2]).applyMatrix4(m); all[i * L.length + k] = v.x; all[i * L.length + k + 1] = v.y; all[i * L.length + k + 2] = v.z; } });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(all, 3));
    const ls = new THREE.LineSegments(lg, ink); ls.frustumCulled = false; out.add(ls);
    return out;
  };

  root.VinlandKit = KIT;
})(typeof window !== 'undefined' ? window : this);
