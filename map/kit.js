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
  def({ key: 'houseStarter', name: 'Starter house', cat: 'Homes', part: 1, budget: 700, size: '1 plot \u00b7 10 \u00d7 10 m',
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
  def({ key: 'villa', name: 'Villa', cat: 'Homes', part: 1, budget: 1500, size: 'Villa Lane lot \u00b7 37 \u00d7 24 m',
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
  def({ key: 'mansion', name: 'Mansion', cat: 'Homes', part: 1, budget: 2500, size: '4 plots \u00b7 20 \u00d7 20 m',
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
  def({ key: 'penthouse', name: 'Penthouse tower', cat: 'Homes', part: 1, budget: 3500, size: 'Downtown \u00b7 20 \u00d7 20 m \u00b7 12 floors',
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
  def({ key: 'beachFlats', name: 'Beach Flats', cat: 'Homes', part: 2, budget: 1500, size: '1 plot \u00b7 10 \u00d7 10 m \u00b7 4 flats \u00b7 Riverside, Beach Lane', night: true,
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
  // the Vinland Tower's arrival plaza (avenue, pools, lamps, ring of trees, fountain, benches, Vinland flag), shared by both styles
  function towerPlaza(g, PAVE, TRIM) {
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
  }
  // Vinland Tower, 'glass' style (the 13 Nov look: silver-blue glass, gold ribbon crown, observation deck). Kept so nothing breaks.
  function glassTower(o) {
      const g = new THREE.Group(), tex = towerTextures();
      const GLASS = (() => { const k = 'vtGlass'; if (!mats[k]) { const m = toon('#c4deed'); if (tex) { m.map = tex.day; m.emissiveMap = tex.night; } m.userData.glow = '#ffffff'; mats[k] = m; } return mats[k]; })();
      const GOLD = (() => { const m = glowMat('#f0dcaa', '#f0b040'); m.side = THREE.DoubleSide; m.userData.dayGlow = '#241d0e'; m.emissive.set('#241d0e'); return m; })();   // light champagne, a soft sheen by day
      const WHITE = glowMat('#f7f5f0', '#8a8478'), SILVER = glowMat('#e9eff2', '#d8c49a'), OBS = glowMat('#a9d0e2', '#ffffff'), LOBBY = glowMat('#cfe0ea', '#f3d79a');
      const BEACON = glowMat('#ff4a30', '#ff3a20'), STONE = '#e9e1d2', PAVE = '#f3ede1', TRIM = PAL.sand2;
      const y0 = 12, H = 150, r0 = 19, r1 = 7.5, yTop = y0 + H, rAt = y => r1 + (r0 - r1) * Math.pow(1 - Math.min(1, Math.max(0, (y - y0) / H)), 1.5);
      towerPlaza(g, PAVE, TRIM);
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
  }
  // Vinland Tower, 'classic' style (15 Nov, default): warm stone art deco supertall that belongs with the Town Hall.
  // Cream / sand stone shaft with stepped setbacks, vertical window strips, copper-green bands, a big CLOCK on all 4 sides
  // near the top, a copper crown, a glowing lantern and a spire with a red beacon. Same plaza and footprint as before.
  function decoTower(o) {
    const g = new THREE.Group(), PAVE = '#f3ede1', TRIM = PAL.sand2;
    towerPlaza(g, PAVE, TRIM);
    const ST = glowMat(PAL.cream, '#6a5a40'), ST2 = glowMat(PAL.sand, '#5c4c34'), COP = PAL.copper, WIN = glowMat(PAL.glass, '#ffcf6a'), LANT = glowMat('#f6e3a8', '#fff0b8'), FACE = glowMat('#f6f3ea', '#fff3c4');
    const tier = (w, y0, h, cols, stone) => {                                                        // a stone block with window strips, fins and corner piers
      B(g, w, h, w, stone, 0, y0, 0);
      [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, w / 2);
        for (let i = 0; i < cols; i++) { const x = -w / 2 + (i + 0.5) * w / cols; P(s, w / cols * 0.42, h - 3, WIN, x, y0 + 1.5, 0.04); }   // tall window strips
        for (let i = 1; i < cols; i++) B(s, 0.7, h, 0.7, stone, -w / 2 + i * w / cols, y0, 0.1, { edge: false }); });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, w * 0.09, h + 1.2, w * 0.09, ST, a * w / 2, y0, b * w / 2, NE));   // corner piers
      B(g, w + 1, 0.9, w + 1, COP, 0, y0 + h, 0, NE);                                                  // copper band at each setback
    };
    // lobby podium: arched windows, copper canopy over the door
    B(g, 44, 14, 44, ST2, 0, 0.3, 0); B(g, 45, 1, 45, COP, 0, 14.3, 0, NE);
    [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, 22.03);
      for (let i = 0; i < 5; i++) { if (k === 0 && i === 2) continue; const x = -16 + i * 8; P(s, 4, 7, WIN, x, 2, 0); ARCH(s, 4, WIN, x, 9, 0); } });
    P(g, 6, 8, glowMat(PAL.glassWarm, '#ffcf6a'), 0, 0.3, 22.06); ARCH(g, 6, glowMat(PAL.glassWarm, '#ffcf6a'), 0, 8.3, 22.06);
    B(g, 16, 0.7, 6, COP, 0, 9.4, 25); [-7, 7].forEach(x => B(g, 0.5, 9, 0.5, COP, x, 0.3, 27.6, NE));
    // the shaft: four stone tiers stepping in, alternating cream and sand
    let y = 15.3; [[34, 92, 6, ST], [28, 44, 5, ST2], [22, 28, 4, ST]].forEach(([w, h, c, s]) => { tier(w, y, h, c, s); y += h + 0.9; });
    // clock tier: big clock face on all 4 sides
    B(g, 17, 20, 17, ST2, 0, y, 0);
    [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, 8.55);
      put(s, geo('clockface', () => new THREE.CircleGeometry(1, 12)), FACE, 0, y + 10, 0.03, { edge: true, s: [6.2, 6.2, 1], shadow: false });
      put(s, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), COP, 0, y + 10, 0.05, { edge: false, shadow: false, s: [6.6, 6.6, 1] });
      B(s, 0.35, 4.6, 0.1, BK.DARK, 0, y + 10, 0.08, FLAT); B(s, 3.2, 0.35, 0.1, BK.DARK, 1.6, y + 10, 0.08, FLAT); });   // hands at about 10:10... close enough
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 2, 22, 2, ST, a * 8.5, y, b * 8.5, NE));
    y += 20; B(g, 18.5, 1, 18.5, COP, 0, y, 0, NE); y += 1;
    // copper crown: stepped copper roof, lantern that glows at night, spire with a red beacon
    B(g, 13, 6, 13, COP, 0, y, 0); y += 6;
    HIP(g, 13.5, 8, 13.5, COP, 0, y, 0); y += 5;
    CYL(g, 2.6, 2.6, 6, 8, LANT, 0, y, 0); [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => { const a = i / 8 * Math.PI * 2 + Math.PI / 8; B(g, 0.35, 6, 0.35, COP, Math.sin(a) * 2.7, y, Math.cos(a) * 2.7, FLAT); });
    y += 6; CYL(g, 0.2, 3.2, 4, 8, COP, 0, y, 0); y += 4;
    CYL(g, 0.1, 0.45, 26, 6, COP, 0, y, 0); BALL(g, 0.9, glowMat('#ff4a30', '#ff3a20'), 0, y + 26.4, 0, NE);
    return g;
  }

  def({ key: 'vinlandTower', name: 'Vinland Tower', cat: 'Landmarks', part: 1, budget: 6000, size: 'Plaza 120 \u00d7 120 m \u00b7 250 m tall', night: true,
    opts: { style: choices('Style', ['campanile', 'empire', 'glass', 'classic']), state: choices('State', ['done', 'site']) },   // campanile = default; empire = 16 Nov try (deco setbacks + glass); glass = the 13 Nov look; classic = shelved art deco try
    make: o => (o.style === 'glass' ? glassTower(o) : o.style === 'classic' ? decoTower(o) : o.style === 'empire' ? empireTower(o) : campanile(o)) });
  // ---- cars (made-up shapes: no real brands, no logos, no badges) ----
  // Hatchback: small city car. Slot: body.
  def({ key: 'carHatch', name: 'Hatchback', cat: 'Cars', part: 1, budget: 400, size: '1.9 \u00d7 4.2 m',
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
  def({ key: 'carSedan', name: 'Sedan', cat: 'Cars', part: 1, budget: 400, size: '1.9 \u00d7 4.6 m', opts: { body: colours('Paint', ['#3f7fbf'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#3f7fbf');
      TAPER(g, 1.9, 0.68, 4.6, b, 0, 0.3, 0, { tw: 0.95, td: 0.97 });
      TAPER(g, 1.74, 0.6, 2.5, PAL.glass, 0, 0.98, -0.2, { tw: 0.82, td: 0.6 }, NE);
      B(g, 1.42, 0.08, 1.5, b, 0, 1.56, -0.2);
      carEnds(g, 1.9, 2.3, -2.3, 0.72); wheels4(g, 0.38, 0.28, 0.92, 1.45, -1.45); return g; } });

  // SUV: tall and boxy, roof rails. Slot: body.
  def({ key: 'carSUV', name: 'SUV', cat: 'Cars', part: 1, budget: 450, size: '2 \u00d7 4.6 m', opts: { body: colours('Paint', ['#9aa3a8'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#9aa3a8');
      TAPER(g, 2, 0.92, 4.6, b, 0, 0.38, 0, { tw: 0.97, td: 0.95 });
      TAPER(g, 1.88, 0.72, 3.3, PAL.glass, 0, 1.28, -0.35, { tw: 0.92, td: 0.86, tz: -0.03 }, NE);
      B(g, 1.74, 0.1, 2.85, b, 0, 2.0, -0.45);
      [-0.7, 0.7].forEach(x => B(g, 0.06, 0.1, 2.5, PAL.iron, x, 2.1, -0.45, NE));
      B(g, 2.06, 0.3, 4.3, PAL.iron, 0, 0.32, 0, NE);                                             // dark wheel-arch skirt
      carEnds(g, 2, 2.3, -2.3, 0.98); wheels4(g, 0.46, 0.32, 0.96, 1.5, -1.5); return g; } });

  // Pickup: cab in front, open bed at the back. Slot: body.
  def({ key: 'carPickup', name: 'Pickup', cat: 'Cars', part: 1, budget: 450, size: '2 \u00d7 5.2 m', opts: { body: colours('Paint', ['#2f7a68'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#2f7a68');
      TAPER(g, 2, 0.8, 5.2, b, 0, 0.38, 0, { tw: 0.97, td: 0.98 });
      TAPER(g, 1.86, 0.74, 1.9, PAL.glass, 0, 1.18, 0.55, { tw: 0.9, td: 0.72, tz: -0.04 }, NE);
      B(g, 1.66, 0.1, 1.4, b, 0, 1.9, 0.5);
      B(g, 1.8, 0.04, 2.3, PAL.iron, 0, 1.19, -1.35, FLAT);                                         // the bed
      [-0.95, 0.95].forEach(x => B(g, 0.1, 0.42, 2.4, b, x, 1.18, -1.35, NE)); B(g, 2, 0.42, 0.1, b, 0, 1.18, -2.55, NE); B(g, 2, 0.42, 0.1, b, 0, 1.18, -0.2, NE);
      carEnds(g, 2, 2.6, -2.6, 0.92); wheels4(g, 0.45, 0.32, 0.96, 1.75, -1.6); return g; } });

  // Sports car: low red wedge, rear spoiler (the Villa's car). Slot: body.
  def({ key: 'carSports', name: 'Sports car', cat: 'Cars', part: 1, budget: 450, size: '2.2 \u00d7 4.8 m', opts: { body: colours('Paint', ['#d8231f'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#d8231f');
      TAPER(g, 2.2, 0.55, 4.8, b, 0, 0.25, 0, { tw: 0.94, td: 0.96 });
      TAPER(g, 1.9, 0.2, 1.6, b, 0, 0.8, 1.5, { tw: 0.9, td: 0.8, tz: -0.1 });
      TAPER(g, 1.74, 0.46, 2.1, PAL.glass, 0, 0.8, -0.3, { tw: 0.76, td: 0.52, tz: -0.08 }, NE);
      B(g, 1.9, 0.08, 0.42, PAL.tyre, 0, 1.06, -2.15); [-0.7, 0.7].forEach(x => B(g, 0.08, 0.28, 0.16, PAL.tyre, x, 0.8, -2.15, NE));
      [-0.72, 0.72].forEach(x => { P(g, 0.48, 0.12, PAL.lampOn, x, 0.56, 2.41); P(g, 0.52, 0.12, PAL.tail, x, 0.62, -2.41, { ry: Math.PI }); });
      [[-1, 1.5, 0.42], [1, 1.5, 0.42], [-1, -1.5, 0.48], [1, -1.5, 0.48]].forEach(([s, z, r]) => WHEEL(g, r, 0.38, s * 1.06, z, 12)); return g; } });

  // Van: tall box with a sloped nose, sliding door. Slot: body.
  def({ key: 'carVan', name: 'Van', cat: 'Cars', part: 1, budget: 450, size: '2 \u00d7 4.9 m', opts: { body: colours('Paint', ['#f6f0e2'].concat(SETS.cars)) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#f6f0e2');
      TAPER(g, 2, 1.9, 4.9, b, 0, 0.32, -0.1, { tw: 0.96, td: 0.86, tz: -0.07 });
      put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), PAL.glass, 0, 1.75, 2.0, { rx: -0.42, s: [1.7, 0.9, 1], edge: false, shadow: false });
      [-1, 1].forEach(s => { P(g, 1.1, 0.6, PAL.glass, s * 0.97, 1.5, 1.2, { ry: s * Math.PI / 2 }); P(g, 2.0, 0.55, PAL.glass, s * 0.95, 1.55, -0.9, { ry: s * Math.PI / 2 });
        P(g, 0.04, 1.1, PAL.iron, s * 0.995, 0.75, 0.4, { ry: s * Math.PI / 2 }); });
      carEnds(g, 2, 2.35, -2.55, 0.85); wheels4(g, 0.4, 0.3, 0.94, 1.55, -1.65); return g; } });

  // Taxi: black and yellow city taxi (kaali-peeli), with a roof light. Slots: body, roof.
  def({ key: 'carTaxi', name: 'Taxi', cat: 'Cars', part: 1, budget: 450, size: '1.8 \u00d7 4.1 m', opts: { body: colours('Body', ['#2f2b28', '#e8b830', '#2f7a68']), roof: colours('Roof', ['#e8b830', '#2f2b28', '#f6f0e2']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#2f2b28'), r = slot('roof', o.roof || '#e8b830');
      TAPER(g, 1.8, 0.66, 4.1, b, 0, 0.32, 0, { tw: 0.95, td: 0.96 });
      TAPER(g, 1.66, 0.6, 2.4, PAL.glass, 0, 0.98, -0.15, { tw: 0.84, td: 0.66 }, NE);
      B(g, 1.4, 0.1, 1.6, r, 0, 1.56, -0.15);
      B(g, 0.8, 0.26, 0.34, glowMat(PAL.cream, '#e8c860'), 0, 1.66, 0, NE);
      carEnds(g, 1.8, 2.05, -2.05, 0.72); wheels4(g, 0.36, 0.26, 0.86, 1.3, -1.3); return g; } });

  // Scooter: step-through scooter, no brand. Slot: body.
  def({ key: 'scooter', name: 'Scooter', cat: 'Cars', part: 1, budget: 250, size: '0.7 \u00d7 1.8 m', opts: { body: colours('Paint', SETS.cars) },
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
  def({ key: 'autoRickshaw', name: 'Auto-rickshaw', cat: 'Cars', part: 1, budget: 450, size: '1.3 \u00d7 2.7 m', opts: { body: colours('Body', ['#2f7a68', '#2f2b28', '#e8b830', '#3f7fbf']), roof: colours('Roof', ['#e8b830', '#2f2b28', '#2f7a68']) },
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

  def({ key: 'busStop', name: 'Bus stop', cat: 'Street', part: 2, budget: 260, size: '4 \u00d7 1.6 m', night: true, opts: {},
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

  def({ key: 'zebraCrossing', name: 'Zebra crossing', cat: 'Street', part: 2, budget: 40, size: '8 \u00d7 3 m', opts: {},
    make() { const g = new THREE.Group(); for (let i = 0; i < 7; i++) put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), '#f6f0e2', -3.6 + i * 1.2, 0.03, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [0.6, 3, 1] })); return g; } });

  // Chai stall: a small tea cart with a canopy, a kettle on the stove and two stools.
  def({ key: 'chaiStall', name: 'Chai stall', cat: 'Street', part: 2, budget: 400, size: '2.4 \u00d7 1.4 m', night: true, opts: { canopy: colours('Canopy', [PAL.terra, '#2f7a68', '#e8b830', '#3f7fbf']) },
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
      put(g, geo('boatT', () => new THREE.TorusGeometry(1, 0.32, 4, 8)), '#e8473a', 0, 7.8, -0.4, { edge: false });   // lifebuoy on the roof
      [0, 1, 2, 3].forEach(i => B(g, 0.2, 0.68, 0.3, '#f6f0e2', Math.cos(i * Math.PI / 2 + 0.78) * 1, 7.8 + Math.sin(i * Math.PI / 2 + 0.78) * 1, -0.4, { rz: i * Math.PI / 2 + 0.78, edge: false })); } },
    { key: 'shopPharmacy', name: 'Pharmacy', sign: 'Pharmacy', awning: '#2f7a68', props(g) {
      const X = NEON('#3fbf6a'); B(g, 0.6, 2.0, 0.4, X, 0, 6.9, -0.6); B(g, 2.0, 0.6, 0.4, X, 0, 7.6, -0.6);   // green cross
      B(g, 0.12, 2.2, 0.12, PAL.iron, 3.4, 0.2, 2.8, NE); B(g, 0.9, 0.9, 0.12, X, 3.4, 2.2, 2.8, NE); } },
    { key: 'shopBarber', name: 'Barber', sign: 'Barber', awning: '#3f5866', props(g) {
      const p = grp(g, 3.25, 0, 1.75); CYL(p, 0.2, 0.2, 2, 8, '#f6f0e2', 0, 0.6, 0, { open: true });   // barber pole
      [0.8, 1.3, 1.8].forEach((y, i) => CYL(p, 0.21, 0.21, 0.22, 8, i === 1 ? '#3f7fbf' : '#d8231f', 0, y, 0, { open: true, edge: false }));
      CAP(p, 0.22, '#e2b04a', 0, 2.6, 0, NE);
      [-1, 1].forEach(s => B(g, 0.35, 2.6, 0.12, '#c9ced2', s * 0.3, 6.8, -0.6, { rz: s * 0.4 }));   // giant scissors
      [-1, 1].forEach(s => put(g, geo('boatT', () => new THREE.TorusGeometry(1, 0.32, 4, 8)), PAL.iron, s * 0.75, 6.75, -0.6, { s: [0.45, 0.45, 0.45], edge: false })); } },
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
  SHOPS.forEach(k => def({ key: k.key, name: k.name, cat: 'Shops', part: 2, budget: 1200, size: '1 shop spot \u00b7 10 \u00d7 10 m', night: true,
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
  def({ key: 'danceFloor', name: 'Dance floor', cat: 'Party', part: 2, budget: 150, size: '4 \u00d7 4 m', night: true, opts: {},
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
  def({ key: 'garden', name: 'Garden', cat: 'Coin Shop', part: 2, budget: 400, size: 'front garden \u00b7 10 \u00d7 4 m', opts: { style: choices('Style', ['flowers', 'vegetables', 'rock', 'fountain', 'swing']) },
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

  // ---- transport (made-up liveries, no real brands). Front = +z. Night: windows and headlights glow. ----
  const WIN_GLOW = () => glowMat(PAL.glass, '#ffd98a'), HEAD = () => glowMat(PAL.lampOn, '#fff3c4');
  function sideWindows(g, n, w, h, x0, len, y, zc, gap) {             // a row of windows on both sides of a vehicle
    const step = len / n, m = WIN_GLOW();
    for (let i = 0; i < n; i++) { const z = zc - len / 2 + step * (i + 0.5); [-1, 1].forEach(s => P(g, step - (gap || 0.25), h, m, s * (w / 2 + 0.01), y, z, { ry: s * Math.PI / 2 })); }
  }
  def({ key: 'bus', name: 'City bus', cat: 'Transport', part: 2, budget: 600, size: '2.5 \u00d7 11 m', night: true,
    opts: { body: colours('Paint', ['#2f7a68', PAL.terra, '#3f7fbf', '#e8b830']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#2f7a68');
      B(g, 2.5, 2.7, 11, b, 0, 0.45, 0);                                                          // body
      B(g, 2.54, 0.25, 11.04, '#f6f0e2', 0, 1.15, 0, NE);                                          // white stripe
      sideWindows(g, 6, 2.5, 1.0, 0, 8.2, 1.55, -0.9);
      P(g, 2.2, 1.3, WIN_GLOW(), 0, 1.45, 5.51); P(g, 1.7, 0.3, textMat('VINLAND', '#2f2b28', '#ffcf6a'), 0, 2.85, 5.52);   // windscreen + destination board
      P(g, 0.9, 2.0, PAL.iron, 1.26, 0.6, 3.9, { ry: Math.PI / 2 }); P(g, 0.9, 2.0, PAL.iron, 1.26, 0.6, -0.6, { ry: Math.PI / 2 });   // doors (kerb side)
      [-0.85, 0.85].forEach(x => { P(g, 0.4, 0.22, HEAD(), x, 0.8, 5.52); P(g, 0.36, 0.2, PAL.tail, x, 0.8, -5.52, { ry: Math.PI }); });
      B(g, 2.56, 0.3, 0.2, PAL.iron, 0, 0.45, 5.5, NE); B(g, 1.6, 0.3, 3, '#d9d6cf', 0, 3.15, -1.5);   // bumper, roof AC
      [[-1.1, 3.6], [1.1, 3.6], [-1.1, -3.4], [1.1, -3.4]].forEach(([x, z]) => WHEEL(g, 0.52, 0.34, x, z));
      return g; } });

  function bogie(g, z, gauge) { B(g, gauge + 0.2, 0.4, 2.6, PAL.iron, 0, 0.35, z, NE); [-0.85, 0.85].forEach(dz => [-1, 1].forEach(s => WHEEL(g, 0.45, 0.16, s * gauge / 2, z + dz, 8))); }
  def({ key: 'trainEngine', name: 'Train engine', cat: 'Transport', part: 2, budget: 800, size: '3 \u00d7 15 m', night: true,
    opts: { body: colours('Paint', [PAL.terra, '#2f7a68', '#3f5866', '#e8b830']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || PAL.terra);
      B(g, 2.9, 0.5, 14.2, PAL.iron, 0, 0.75, -0.3);                                               // frame
      B(g, 2.9, 2.6, 11.4, b, 0, 1.25, -1.7);                                                     // engine room
      TAPER(g, 2.9, 2.6, 2.8, b, 0, 1.25, 5.4, { tw: 1, td: 0.55, tz: -0.22 });                   // sloped cab nose
      B(g, 3.0, 0.3, 14.4, '#f6d27a', 0, 1.75, -0.3, NE);                                          // gold stripe
      P(g, 2.4, 0.9, WIN_GLOW(), 0, 2.7, 6.35, { rx: -0.5 });                                       // windscreen
      sideWindows(g, 1, 2.9, 0.8, 0, 1.6, 2.6, 5.2);
      [-1, 1].forEach(s => { for (let i = 0; i < 6; i++) P(g, 1.2, 0.5, PAL.iron, s * 1.46, 2.7, -6.4 + i * 1.8, { ry: s * Math.PI / 2 }); });   // grilles
      [-0.9, 0.9].forEach(x => P(g, 0.36, 0.3, HEAD(), x, 1.2, 6.81)); P(g, 0.5, 0.3, HEAD(), 0, 3.6, 5.7);
      B(g, 1.4, 0.4, 4, '#55504a', 0, 3.85, -3.5, NE); B(g, 0.12, 0.8, 0.12, PAL.iron, 0, 3.85, 2, NE); B(g, 1.6, 0.06, 0.1, PAL.iron, 0, 4.65, 2, NE);   // roof box, pantograph
      bogie(g, 3.8, 2.2); bogie(g, -5.2, 2.2); return g; } });
  def({ key: 'trainCoach', name: 'Train coach', cat: 'Transport', part: 2, budget: 800, size: '3 \u00d7 18 m', night: true,
    opts: { body: colours('Paint', ['#f6f0e2', PAL.terra, '#2f7a68', '#3f5866']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#f6f0e2');
      B(g, 2.9, 0.4, 17.6, PAL.iron, 0, 0.75, 0);
      B(g, 2.9, 2.5, 17.6, b, 0, 1.15, 0);
      TAPER(g, 2.9, 0.5, 17.6, '#9aa3a8', 0, 3.65, 0, { tw: 0.75, td: 1 });                         // curved-ish roof
      B(g, 2.94, 0.28, 17.64, PAL.terra, 0, 1.4, 0, NE);                                           // stripe
      sideWindows(g, 9, 2.9, 0.9, 0, 13, 2.1, 0, 0.35);
      [-1, 1].forEach(s => [-7.6, 7.6].forEach(z => P(g, 0.9, 2.0, PAL.iron, s * 1.46, 1.2, z, { ry: s * Math.PI / 2 })));   // doors
      [-8.85, 8.85].forEach(z => B(g, 1.6, 2.2, 0.3, PAL.iron, 0, 1.2, z, NE));                    // gangways
      bogie(g, 5.8, 2.2); bogie(g, -5.8, 2.2); return g; } });

  def({ key: 'tram', name: 'Tram', cat: 'Transport', part: 2, budget: 600, size: '2.4 \u00d7 14 m', night: true,
    opts: { body: colours('Paint', [PAL.terra, '#2f7a68', '#3f7fbf', '#e8b830']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || PAL.terra);
      B(g, 2.4, 1.2, 13.4, b, 0, 0.45, 0);                                                        // lower body (colour)
      B(g, 2.4, 1.6, 13.4, '#f6f0e2', 0, 1.65, 0);                                                 // upper body (cream)
      TAPER(g, 2.4, 0.4, 13.4, '#d9d6cf', 0, 3.25, 0, { tw: 0.8, td: 0.95 });
      sideWindows(g, 7, 2.4, 1.1, 0, 11.5, 1.9, 0, 0.3);
      [-1, 1].forEach(s => { P(g, 2.1, 1.2, WIN_GLOW(), 0, 1.9, s * 6.71, { ry: s > 0 ? 0 : Math.PI }); P(g, 0.4, 0.22, HEAD(), 0, 0.9, s * 6.72, { ry: s > 0 ? 0 : Math.PI }); });
      P(g, 1.4, 0.3, textMat('VINLAND', '#2f2b28', '#ffcf6a'), 0, 3.15, 6.72);
      const pg = grp(g, 0, 3.65, 0); [-0.5, 0.5].forEach(dz => B(pg, 0.08, 1.0, 0.08, PAL.iron, 0, 0, dz, { rx: dz > 0 ? -0.5 : 0.5, edge: false })); B(pg, 1.6, 0.06, 0.12, PAL.iron, 0, 0.9, 0, NE);   // pantograph
      [-4.4, 4.4].forEach(z => { B(g, 2.2, 0.4, 2.2, PAL.iron, 0, 0.3, z, NE); [-0.7, 0.7].forEach(dz => [-1, 1].forEach(s => WHEEL(g, 0.35, 0.14, s * 0.9, z + dz, 8))); });
      return g; } });

  def({ key: 'boat', name: 'Boat', cat: 'Transport', part: 2, budget: 400, size: '2.6 \u00d7 8 m',
    opts: { body: colours('Hull', ['#f6f0e2', PAL.terra, '#3f7fbf', '#2f7a68']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#f6f0e2');
      TAPER(g, 1.6, 1.2, 7.4, b, 0, 0, 0, { tw: 1.6, td: 1.08, tz: 0.02 });                        // hull, wider at the top
      B(g, 2.5, 0.14, 7.9, PAL.wood, 0, 1.2, 0.15, NE);                                            // deck rim
      B(g, 2.3, 0.04, 7.6, '#c8a374', 0, 1.18, 0.1, FLAT);
      B(g, 1.7, 1.3, 2.2, '#f6f0e2', 0, 1.2, -0.8); B(g, 1.9, 0.12, 2.6, '#3f5866', 0, 2.5, -0.8, NE);   // cabin
      P(g, 1.4, 0.6, PAL.glass, 0, 1.75, 0.31); [-1, 1].forEach(s => P(g, 1.6, 0.5, PAL.glass, s * 0.86, 1.8, -0.8, { ry: s * Math.PI / 2 }));
      B(g, 0.08, 2.2, 0.08, PAL.iron, 0, 2.6, -1.4, NE); B(g, 0.6, 0.36, 0.03, PAL.terra, 0.32, 4.4, -1.4, FLAT);   // mast + flag
      put(g, geo('boatT', () => new THREE.TorusGeometry(1, 0.32, 4, 8)), '#e8473a', 1.0, 1.75, -0.8, { ry: Math.PI / 2, s: [0.3, 0.3, 0.3], edge: false });
      return g; } });

  def({ key: 'ferry', name: 'Ferry', cat: 'Transport', part: 2, budget: 800, size: '8 \u00d7 24 m', night: true,
    opts: { body: colours('Stripe', ['#2f7a68', PAL.terra, '#3f7fbf', '#e8b830']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#2f7a68');
      TAPER(g, 6.4, 2.6, 22, '#f6f0e2', 0, 0, 0, { tw: 1.25, td: 1.05 });                          // hull
      TAPER(g, 6.5, 0.5, 22.1, b, 0, 2.0, 0, { tw: 1.25, td: 1.05 }, NE);                            // colour band
      B(g, 7.6, 0.2, 21.6, '#c8a374', 0, 2.6, 0, NE);                                              // main deck
      B(g, 6.6, 2.4, 15, '#f6f0e2', 0, 2.8, -1.4);                                                 // passenger deck
      sideWindows(g, 8, 6.6, 1.0, 0, 14, 3.4, -1.4, 0.4);
      B(g, 7.0, 0.2, 15.6, '#e9e3d6', 0, 5.2, -1.4, NE);
      B(g, 4.4, 2.0, 5, '#f6f0e2', 0, 5.4, 1.6); P(g, 3.8, 0.9, WIN_GLOW(), 0, 6.3, 4.11);         // bridge
      B(g, 4.8, 0.2, 5.4, b, 0, 7.4, 1.6, NE);
      CYL(g, 0.9, 1.1, 2.6, 8, b, 0, 5.4, -5.8); CYL(g, 0.92, 0.92, 0.5, 8, PAL.iron, 0, 8.0, -5.8, { edge: false, open: true });   // funnel
      rail(g, 21, -3.7, 2.8, 0, Math.PI / 2, 1, 2.2); rail(g, 21, 3.7, 2.8, 0, Math.PI / 2, 1, 2.2);
      [[-3.36, -4], [3.36, -4], [-3.36, 3]].forEach(([x, z]) => put(g, geo('boatT', () => new THREE.TorusGeometry(1, 0.32, 4, 8)), '#e8473a', x, 3.6, z, { ry: Math.PI / 2, s: [0.35, 0.35, 0.35], edge: false }));
      B(g, 0.1, 2.2, 0.1, PAL.iron, 0, 7.6, 1.6, NE); B(g, 1.0, 0.6, 0.03, PAL.terra, 0.52, 9.2, 1.6, FLAT);   // Vinland flag
      return g; } });

  def({ key: 'plane', name: 'Plane', cat: 'Transport', part: 2, budget: 1200, size: '28 m long \u00b7 26 m wingspan', night: true,
    opts: { body: colours('Livery', ['#2f7a68', PAL.terra, '#3f7fbf', '#d4af37']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#2f7a68'), WH = '#f4f2ee';
      const f = grp(g, 0, 3.2, 0); f.rotation.x = Math.PI / 2;                                     // fuselage along z
      CYL(f, 1.9, 1.9, 18, 12, WH, 0, -9, 0, { open: true });
      put(f, geo('noseCap', () => new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2)), WH, 0, 9, 0, { s: [1.9, 3.2, 1.9] });   // nose
      CYL(f, 1.9, 0.5, 7, 12, WH, 0, -16, 0, { open: true });                          // tail cone
      [-1, 1].forEach(s => { P(g, 15, 0.45, WIN_GLOW(), s * 1.91, 3.5, 0, { ry: s * Math.PI / 2 }); P(g, 18.5, 0.35, b, s * 1.92, 2.6, -0.5, { ry: s * Math.PI / 2 }); });   // window strip + livery line
      P(g, 2.2, 0.7, PAL.glass, 0, 4.0, 11.6, { rx: -0.9 });                                        // cockpit glass
      [-1, 1].forEach(s => { const w = grp(g, s * 1.6, 2.4, 0.5, 0);                                // wings
        TAPER(w, 11, 0.4, 4.6, WH, s * 5.5, 0, 0, { tw: 1, td: 0.4, tz: -0.35 }, { rz: s * 0.06 });
        CYL(g, 0.8, 0.8, 3.2, 10, '#c9ced2', s * 5.2, 0.3, 1.4, { rx: Math.PI / 2 }); B(g, 0.4, 0.8, 1.4, WH, s * 5.2, 2.0, 1.2, NE);   // engines
        TAPER(g, 4.6, 0.25, 2.6, WH, s * 2.6, 4.2, -14.2, { tw: 1, td: 0.45, tz: -0.3 }); });      // tail planes
      TAPER(g, 0.35, 5.2, 4.6, b, 0, 4.6, -13.4, { tw: 1, td: 0.45, tz: -0.4 });                     // tail fin in the livery colour
      oct(g, 0.55, '#f6d27a', 0, 7.4, -14.3, { s: [0.12, 0.55, 0.55], edge: true });                 // gold star on the tail
      [[0, 10], [-2.4, 0.4], [2.4, 0.4]].forEach(([x, z]) => { B(g, 0.15, 1.4, 0.15, '#55504a', x, 0.6, z, NE); WHEEL(g, 0.5, 0.3, x === 0 ? 0.01 : x, z, 8); });
      P(g, 0.3, 0.3, glowMat('#e8473a', '#ff3a20'), -12.5, 2.75, -0.6, { ry: -Math.PI / 2 }); P(g, 0.3, 0.3, glowMat('#5fbf6a', '#3fdf5a'), 12.5, 2.75, -0.6, { ry: Math.PI / 2 });   // wingtip lights
      return g; } });

  // ---- big buildings: sports + education. Night: floodlights / windows glow. ----
  const flat2 = (g, w, d, m, x, y, z, o) => put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), m, x, y, z, Object.assign({}, FLAT, o, { rx: -Math.PI / 2, s: [w, d, 1] }));
  const LINE = '#f6f3ea';
  function floodlight(g, x, z, h, face) {
    B(g, 0.5, h, 0.5, '#9aa3a8', x, 0, z, NE); const f = grp(g, x, h, z, face);
    B(f, 3, 1.6, 0.4, PAL.iron, 0, 0, 0, NE); P(f, 2.8, 1.4, glowMat('#f4f1e8', '#ffffff'), 0, 0.1, 0.21);
  }
  function stand(g, len, x, z, ry, rows, seat) {                         // stepped seats with a roof
    const s = grp(g, x, 0, z, ry);
    for (let i = 0; i < rows; i++) { B(s, len, 0.6 * (i + 1), 1.2, '#d9d2c4', 0, 0, -i * 1.2, NE); B(s, len, 0.12, 0.5, seat, 0, 0.6 * (i + 1), -i * 1.2 + 0.2, FLAT); }
    [-len / 2 + 0.3, len / 2 - 0.3].forEach(px => B(s, 0.25, 0.6 * rows + 2.4, 0.25, PAL.iron, px, 0, -(rows - 1) * 1.2, NE));
    TAPER(s, len + 0.6, 0.3, rows * 1.2 + 1, '#f6f0e2', 0, 0.6 * rows + 2.4, -(rows - 1) * 0.6 + 0.3, { tw: 1, td: 1 });
  }
  def({ key: 'footballGround', name: 'Football ground', cat: 'Sports', part: 2, budget: 1500, size: '76 \u00d7 110 m', night: true, opts: { seat: colours('Seats', [PAL.terra, '#2f7a68', '#3f7fbf', '#e8b830']) },
    make(o) { const g = new THREE.Group(), seat = slot('seat', o.seat || PAL.terra), W = 60, L = 95;
      B(g, 76, 0.2, 110, '#d8d2c6', 0, 0, 0, { shadow: false });
      for (let i = 0; i < 10; i++) flat2(g, W + 4, (L + 4) / 10, i % 2 ? '#6fa04a' : '#7fb156', 0, 0.26, -(L + 4) / 2 + (L + 4) / 10 * (i + 0.5));   // mown stripes
      [[W, 0.15, 0, L / 2], [W, 0.15, 0, -L / 2], [0.15, L, W / 2, 0], [0.15, L, -W / 2, 0], [W, 0.15, 0, 0]].forEach(([w, d, x, z]) => flat2(g, w, d, LINE, x, 0.3, z));
      put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), LINE, 0, 0.3, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [9, 9, 1] }));
      [-1, 1].forEach(s => { const z = s * L / 2;
        [[40, 0.15, 0, z - s * 16], [0.15, 16, 20, z - s * 8], [0.15, 16, -20, z - s * 8], [18, 0.15, 0, z - s * 5.5], [0.15, 5.5, 9, z - s * 2.75], [0.15, 5.5, -9, z - s * 2.75]].forEach(([w, d, x, zz]) => flat2(g, w, d, LINE, x, 0.3, zz));
        [-3.66, 3.66].forEach(x => B(g, 0.15, 2.44, 0.15, '#ffffff', x, 0.2, z, NE)); B(g, 7.47, 0.15, 0.15, '#ffffff', 0, 2.64, z, NE);   // goal
        P(g, 7.3, 2.4, '#e9eef0', 0, 0.2, z + s * 1.5, { ry: s > 0 ? Math.PI : 0, edge: true }); });
      stand(g, 70, -W / 2 - 4, 0, Math.PI / 2, 5, seat); stand(g, 70, W / 2 + 4, 0, -Math.PI / 2, 5, seat);
      [[-36, -52], [36, -52], [-36, 52], [36, 52]].forEach(([x, z]) => floodlight(g, x, z, 22, Math.atan2(-x, -z)));
      return g; } });

  def({ key: 'cricketGround', name: 'Cricket ground', cat: 'Sports', part: 2, budget: 2000, size: '110 \u00d7 120 m oval', night: true, opts: { seat: colours('Seats', ['#2f7a68', PAL.terra, '#3f7fbf', '#e8b830']) },
    make(o) { const g = new THREE.Group(), seat = slot('seat', o.seat || '#2f7a68');
      B(g, 110, 0.2, 120, '#d8d2c6', 0, 0, 0, { shadow: false });
      put(g, geo('oval', () => new THREE.CircleGeometry(1, 32)), '#7fb156', 0, 0.26, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [46, 52, 1] }));
      put(g, geo('oval', () => new THREE.CircleGeometry(1, 32)), '#76a94e', 0, 0.31, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [20, 24, 1] }));   // inner circle
      put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), LINE, 0, 0.36, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [44, 50, 1] }));   // boundary rope
      flat2(g, 3, 20, '#d9c49a', 0, 0.36, 0);                                                     // the pitch
      [-1, 1].forEach(s => { flat2(g, 3.6, 0.1, LINE, 0, 0.41, s * 8.8); flat2(g, 2.6, 0.1, LINE, 0, 0.41, s * 10);
        [-0.11, 0, 0.11].forEach(x => B(g, 0.04, 0.72, 0.04, '#f2e7cf', x, 0.22, s * 10, FLAT)); B(g, 0.26, 0.03, 0.03, '#c9922e', 0, 0.94, s * 10, FLAT);   // stumps + bails
        B(g, 12, 6, 0.4, '#f6f3ea', 0, 0.2, s * 54); });                                            // sight screens
      const pv = grp(g, -50, 0, 0, Math.PI / 2);                                                    // the pavilion
      B(pv, 22, 4, 9, '#f6f0e2', 0, 0.2, -2); B(pv, 22, 3.6, 7, '#f6f0e2', 0, 4.2, -3);
      B(pv, 23, 0.3, 4, PAL.sand2, 0, 4.1, 3.4); rail(pv, 23, 0, 4.4, 5.3, 0, 1, 1.5);
      for (let i = 0; i < 6; i++) { P(pv, 2.4, 2.2, WIN_GLOW(), -8.5 + i * 3.4, 1.0, 2.52); P(pv, 2.4, 2, WIN_GLOW(), -8.5 + i * 3.4, 5.0, 0.52); }
      HIP(pv, 24, 3, 10, PAL.terra, 0, 7.8, -2.5); B(pv, 3, 3, 0.3, '#f6f0e2', 0, 10.4, 1.6); put(pv, geo('dot', () => new THREE.CircleGeometry(1, 5)), PAL.iron, 0, 11.9, 1.8, { edge: false, s: [1, 1, 1] });   // clock
      const sb = grp(g, 50, 0, 0, -Math.PI / 2); B(sb, 0.6, 5, 0.6, PAL.iron, -5, 0, 0, NE); B(sb, 0.6, 5, 0.6, PAL.iron, 5, 0, 0, NE);   // scoreboard
      B(sb, 14, 5, 0.8, '#2f3e3a', 0, 5, 0); P(sb, 12, 1.2, textMat('VINLAND', '#2f3e3a', '#ffcf6a'), 0, 8.3, 0.42); P(sb, 12, 2, textMat('000 / 0', '#2f3e3a', '#f6f3ea'), 0, 5.8, 0.42);
      stand(g, 40, 0, -60 + 4, 0, 4, seat); stand(g, 40, 0, 60 - 4, Math.PI, 4, seat);
      [[-44, -48], [44, -48], [-44, 48], [44, 48]].forEach(([x, z]) => floodlight(g, x, z, 26, Math.atan2(-x, -z)));
      return g; } });

  def({ key: 'court', name: 'Sports court', cat: 'Sports', part: 2, budget: 700, size: '20 \u00d7 32 m', night: true, opts: { sport: choices('Sport', ['basketball', 'tennis']), floor: colours('Court', ['#3f7fbf', '#2f7a68', PAL.terra]) },
    make(o) { const g = new THREE.Group(), f = slot('floor', o.floor || '#3f7fbf'), sp = o.sport || 'basketball', W = sp === 'tennis' ? 11 : 15, L = sp === 'tennis' ? 24 : 28;
      B(g, 20, 0.2, 32, '#5a6b5e', 0, 0, 0, { shadow: false }); flat2(g, W + 2, L + 2, f, 0, 0.26, 0);
      [[W, 0.1, 0, L / 2], [W, 0.1, 0, -L / 2], [0.1, L, W / 2, 0], [0.1, L, -W / 2, 0], [W, 0.1, 0, 0]].forEach(([w, d, x, z]) => flat2(g, w, d, LINE, x, 0.3, z));
      if (sp === 'basketball') { put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), LINE, 0, 0.3, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [1.8, 1.8, 1] }));
        [-1, 1].forEach(s => { const z = s * (L / 2 - 1.2); B(g, 0.2, 3.05, 0.2, PAL.iron, 0, 0.2, z + s * 0.9, NE); B(g, 1.8, 1.05, 0.08, '#f6f3ea', 0, 2.9, z, NE);
          put(g, geo('boatT', () => new THREE.TorusGeometry(1, 0.32, 4, 8)), '#e8473a', 0, 3.05, z - s * 0.3, { rx: Math.PI / 2, s: [0.23, 0.23, 0.23], edge: false }); }); }
      else { [-1, 1].forEach(x => B(g, 0.1, 1.07, 0.1, PAL.iron, x * (W / 2 + 0.9), 0.2, 0, NE)); P(g, W + 1.8, 0.85, '#e9eef0', 0, 0.3, 0, { edge: true }); B(g, W + 1.8, 0.06, 0.06, '#ffffff', 0, 1.18, 0, FLAT); }
      [[20, 0, 16, 0], [20, 0, -16, 0], [32, -10, 0, Math.PI / 2], [32, 10, 0, Math.PI / 2]].forEach(([w, x, z, ry]) => { const r = grp(g, x, 0.2, z, ry);   // fence
        const n = Math.round(w / 6); for (let i = 0; i <= n; i++) B(r, 0.1, 3, 0.1, PAL.iron, -w / 2 + i * w / n, 0, 0, FLAT);
        B(r, w, 0.08, 0.08, PAL.iron, 0, 3, 0, FLAT); B(r, w, 0.06, 0.06, PAL.iron, 0, 1.5, 0, FLAT); });
      [[-10, -16], [10, 16]].forEach(([x, z]) => { B(g, 0.2, 7, 0.2, '#9aa3a8', x, 0, z, NE); B(g, 1.4, 0.3, 0.8, glowMat('#f4f1e8', '#ffffff'), x, 7, z, NE); });
      return g; } });

  // education
  function classBlock(g, w, floors, x, z, ry, W, R) {                   // a school wing: floors of windows, hip roof
    const s = grp(g, x, 0, z, ry), d = 10, h = 3.4;
    B(s, w, floors * h, d, W, 0, 0.2, 0);
    for (let f = 1; f < floors; f++) B(s, w + 0.3, 0.25, d + 0.3, PAL.sand2, 0, 0.2 + f * h - 0.12, 0, NE);
    const n = Math.floor(w / 3.2);
    for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) { const xx = -w / 2 + (i + 0.5) * w / n; P(s, 1.6, 1.8, WIN_GLOW(), xx, 0.2 + f * h + 0.9, d / 2 + 0.02); P(s, 1.6, 1.8, WIN_GLOW(), xx, 0.2 + f * h + 0.9, -d / 2 - 0.02, { ry: Math.PI }); }
    HIP(s, w + 1.4, 3, d + 1.4, R, 0, 0.2 + floors * h, 0);
    return s;
  }
  def({ key: 'school', name: 'School', cat: 'Education', part: 2, budget: 2500, size: '50 \u00d7 44 m', night: true, opts: { wall: colours('Wall', ['#f2e2c4', '#f6f0e2', '#f2cfb3']), roof: colours('Roof', SETS.roofs) },
    make(o) { const g = new THREE.Group(), W = slot('wall', o.wall || '#f2e2c4'), R = slot('roof', pick(o, 'roof', SETS.roofs));
      B(g, 50, 0.2, 44, '#d8d2c6', 0, 0, 0, { shadow: false });
      classBlock(g, 34, 2, 0, -12, 0, W, R); classBlock(g, 20, 2, -19, 2, Math.PI / 2, W, R);    // main block + side wing (an L)
      const e = grp(g, 0, 0, -6.6); B(e, 7, 9, 1.6, W, 0, 0.2, 0);                               // entrance tower
      GABLE(e, 7.6, 2.4, 2.2, R, 0, 9.2, 0);
      door(e, 0, 0.2, 0.81, 0, 2.2, 2.6, '#3f5866');
      P(e, 5.2, 0.8, textMat('SCHOOL', '#3f5866', '#f6d27a'), 0, 3.6, 0.82);
      put(e, geo('dot', () => new THREE.CircleGeometry(1, 5)), '#f6f3ea', 0, 6.6, 0.82, { edge: true, s: [0.9, 0.9, 1] });   // clock
      B(e, 0.08, 0.6, 0.02, PAL.iron, 0, 6.6, 0.84, FLAT); B(e, 0.5, 0.08, 0.02, PAL.iron, 0.25, 6.6, 0.84, FLAT);
      B(g, 0.12, 9, 0.12, '#c9ced2', 6, 0.2, 2, NE); B(g, 2.2, 1.4, 0.04, PAL.terra, 7.15, 7.6, 2, FLAT);   // flag pole + Vinland flag
      B(g, 22, 0.06, 16, '#c9b48a', 10, 0.2, 10, FLAT);                                             // playground
      [6, 12].forEach(x => { B(g, 0.12, 2.4, 0.12, PAL.iron, x - 1, 0.2, 14, NE); B(g, 0.12, 2.4, 0.12, PAL.iron, x + 1, 0.2, 14, NE); B(g, 2.3, 0.12, 0.12, PAL.iron, x, 2.6, 14, NE); B(g, 0.8, 0.08, 0.3, PAL.terra, x, 0.7, 14, NE); });   // swings
      TAPER(g, 0.8, 2.4, 4, '#e8b830', 17, 0.2, 6, { tw: 1, td: 0.2, tz: 0.4 }); B(g, 1, 2.4, 1, '#3f7fbf', 17, 0.2, 4.2, NE);   // slide
      B(g, 0.15, 3, 0.15, PAL.iron, 20, 0.2, 14, NE); B(g, 1.2, 0.8, 0.06, '#f6f3ea', 20, 3, 13.9, NE);   // hoop
      [[-22, 20], [-8, 20], [22, -20], [22, 20]].forEach(([x, z]) => tree(g, x, 0.2, z, 'canopy', 0.9));
      stoneWall(g, -25, 21.8, -2, 21.8, 1); stoneWall(g, 3, 21.8, 25, 21.8, 1); [-2.2, 3.2].forEach(x => B(g, 0.7, 2, 0.7, PAL.sand2, x, 0.2, 21.8));
      B(g, 4.6, 0.06, 28, PAL.sand, 0.5, 0.2, 7.6, FLAT);                                          // path to the door
      return g; } });

  def({ key: 'university', name: 'University', cat: 'Education', part: 2, budget: 4000, size: '90 \u00d7 80 m campus', night: true, opts: { wall: colours('Wall', ['#efe3c8', '#f6f0e2', '#e8d5b0']) },
    make(o) { const g = new THREE.Group(), W = slot('wall', o.wall || '#efe3c8'), R = PAL.terra, TR = PAL.sand2;
      B(g, 90, 0.2, 80, '#d8d2c6', 0, 0, 0, { shadow: false });
      flat2(g, 40, 34, PAL.grass, 0, 0.21, 12);                                                      // the quad
      [[4, 34, 0, 12], [40, 4, 0, 12]].forEach(([w, d, x, z]) => flat2(g, w, d, '#e6dccb', x, 0.22, z));
      // main hall: columns, pediment, copper dome
      const h = grp(g, 0, 0, -18);
      B(h, 30, 12, 14, W, 0, 0.2, 0); B(h, 30.6, 0.4, 14.6, TR, 0, 12.2, 0);
      for (let i = 0; i < 6; i++) { P(h, 2.2, 3.2, WIN_GLOW(), -12 + i * 4.8, 1.6, 7.02); P(h, 2.2, 3.2, WIN_GLOW(), -12 + i * 4.8, 6.8, 7.02); }
      B(h, 16, 0.6, 5, TR, 0, 0.2, 9.5); for (let i = 0; i < 3; i++) B(h, 18, 0.3, 1, TR, 0, 0.2 - 0.3 * i, 12.5 + i, NE);   // portico floor + steps
      for (let i = 0; i < 6; i++) CYL(h, 0.55, 0.65, 10.6, 8, '#f6f3ea', -6.5 + i * 2.6, 0.8, 11, { open: true });
      B(h, 17, 1, 5.4, '#f6f3ea', 0, 11.4, 9.4); GABLE(h, 17, 3, 5.6, '#f6f3ea', 0, 12.4, 9.4);
      P(h, 10, 0.9, textMat('VINLAND UNIVERSITY', '#f6f3ea', '#3f5866'), 0, 11.45, 12.12);
      CYL(h, 7, 7, 3, 12, W, 0, 12.6, -1, { open: true }); put(h, geo('dome', () => new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)), PAL.copper, 0, 15.6, -1, { s: [7.2, 6, 7.2] });
      CYL(h, 0.6, 0.6, 2, 8, '#f6f3ea', 0, 21.4, -1); BALL(h, 0.5, '#e2b04a', 0, 23.8, -1, NE);
      // two wings around the quad
      [-1, 1].forEach(s => { const w = classBlock(g, 34, 3, s * 27, 10, Math.PI / 2, W, R); });
      // clock tower
      const t = grp(g, 30, 0, -26); B(t, 5, 26, 5, W, 0, 0.2, 0); B(t, 5.6, 0.4, 5.6, TR, 0, 20, 0);
      [0, 1, 2, 3].forEach(k => { const f = grp(t, 0, 0, 0, k * Math.PI / 2); put(f, geo('dot', () => new THREE.CircleGeometry(1, 5)), '#f6f3ea', 0, 23, 2.52, { edge: true, s: [1.6, 1.6, 1] });
        B(f, 0.12, 1.2, 0.02, PAL.iron, 0, 23.3, 2.54, FLAT); B(f, 0.9, 0.12, 0.02, PAL.iron, 0.4, 23, 2.54, FLAT); });
      HIP(t, 6, 6, 6, PAL.copper, 0, 26.2, 0);
      // fountain, trees, benches, lamps
      CYL(g, 4, 4.3, 0.8, 12, TR, 0, 0.2, 12, { open: true }); CYL(g, 3.9, 3.9, 0.5, 12, PAL.water, 0, 0.25, 12, NE); CYL(g, 0.4, 0.6, 2.4, 6, TR, 0, 0.5, 12, NE);
      [[-14, 2], [14, 2], [-14, 22], [14, 22], [-38, -30], [38, 30], [-38, 32], [36, -6]].forEach(([x, z]) => tree(g, x, 0.2, z, 'canopy', 1));
      [[-8, 6], [8, 6], [-8, 18], [8, 18]].forEach(([x, z]) => { B(g, 2.4, 0.45, 0.7, PAL.wood, x, 0.2, z, NE); B(g, 0.15, 3.6, 0.15, PAL.iron, x + 2, 0.2, z, NE); BALL(g, 0.3, glowMat(PAL.lampOn, '#ffd98a'), x + 2, 4, z, NE); });
      stoneWall(g, -45, 39.8, -4, 39.8, 1); stoneWall(g, 4, 39.8, 45, 39.8, 1);
      [-4.3, 4.3].forEach(x => { B(g, 1.2, 4, 1.2, TR, x, 0.2, 39.8); BALL(g, 0.4, glowMat(PAL.lampOn, '#ffd98a'), x, 4.6, 39.8, NE); });   // gate
      B(g, 4, 0.06, 12, '#e6dccb', 0, 0.2, 34, FLAT);
      return g; } });

  def({ key: 'library', name: 'Library', cat: 'Education', part: 2, budget: 2000, size: '40 \u00d7 36 m', night: true, opts: { wall: colours('Wall', ['#f2e6cc', '#f6f0e2', '#e8d5b0']) },
    make(o) { const g = new THREE.Group(), W = slot('wall', o.wall || '#f2e6cc'), TR = PAL.sand2, COL = '#f6f3ea';
      B(g, 40, 0.2, 36, '#d8d2c6', 0, 0, 0, { shadow: false });
      B(g, 28, 1.2, 18, TR, 0, 0.2, -5);                                                             // plinth
      B(g, 26, 9, 16, W, 0, 1.4, -5.5); B(g, 26.8, 0.6, 16.8, TR, 0, 10.4, -5.5);
      for (let i = 0; i < 5; i++) { const x = -10.4 + i * 5.2; if (i === 2) continue; P(g, 2.4, 4.6, WIN_GLOW(), x, 2.8, 2.52); ARCH(g, 2.4, WIN_GLOW(), x, 7.4, 2.52); }
      [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) { P(g, 2.2, 4.4, WIN_GLOW(), s * 13.02, 2.8, -10 + i * 4.5, { ry: s * Math.PI / 2 }); } });
      B(g, 13, 0.4, 5, TR, 0, 1.4, 4.5); for (let i = 0; i < 4; i++) B(g, 14, 0.3 * (i + 1), 1, TR, 0, 0.2, 10.5 - i, NE);   // portico + steps
      for (let i = 0; i < 6; i++) CYL(g, 0.45, 0.5, 7.6, 8, COL, -5.5 + i * 2.2, 1.8, 6.4, { open: true });
      B(g, 13.6, 0.9, 5.4, COL, 0, 9.4, 4.6); GABLE(g, 13.6, 2.6, 5.6, COL, 0, 10.3, 4.6);
      P(g, 8, 0.75, textMat('LIBRARY', COL, '#3f5866'), 0, 9.48, 7.32);
      door(g, 0, 1.4, 2.52, 0, 2.6, 3.4, PAL.wood);
      B(g, 10, 1.4, 6, PAL.glass, 0, 11, -6, { edge: true }); B(g, 10.6, 0.2, 6.6, COL, 0, 12.4, -6, NE);   // glass reading-room skylight
      [[-14, 14], [14, 14]].forEach(([x, z]) => { flat2(g, 9, 7, PAL.grass, x, 0.21, z); B(g, 2.4, 0.45, 0.7, PAL.wood, x, 0.2, z + 1, NE); tree(g, x, 0.2, z - 1.5, x < 0 ? 'pink' : 'canopy', 0.8); });   // reading gardens
      [-7.5, 7.5].forEach(x => { B(g, 0.18, 3.8, 0.18, PAL.iron, x, 0.2, 12, NE); BALL(g, 0.32, glowMat(PAL.lampOn, '#ffd98a'), x, 4.2, 12, NE); });
      [[-18, -16], [18, -16]].forEach(([x, z]) => tree(g, x, 0.2, z, 'cypress', 1.2));
      B(g, 4.6, 0.06, 6, PAL.sand, 0, 0.2, 15, FLAT);
      return g; } });

  // ---- VINLAND STADIUM (restyled 15 Nov to the Vinland look; Dev OK'd the plan). One big multi-use bowl.
  // Outside: a cream arena wall with a ring of arches (old Italian arena feel), green-shuttered windows above (house style),
  // a sloped terracotta tile roof round the top of the stands, 4 cream corner towers (terracotta hip roof, Vinland flag,
  // floodlights on top), one big arched main gate at the front (+z) with a VINLAND STADIUM sign and a small plaza
  // (pink trees, street lamps, benches). Inside: calm two-tone stands (seat colour + cream walkways), screens at both ends.
  // Same key, footprint (about 250 x 270 m, field 116 x 144 m) and options as before: o.mode = 'football' | 'cricket' | 'concert', o.seat.
  // Night (setNight): floodlights, the field, arcade arches, gate lamps, screens; concert stage lights + beams.
  // Kit only: not on the map until the stadium is unlocked or voted. ----
  // ---- park planting (15 Nov): cheap pieces made to be repeated hundreds of times (riverfront look) ----
  def({ key: 'flowerBed', name: 'Flower bed', cat: 'Street', part: 2, budget: 60, size: '3.6 m round bed', opts: { colour: choices('Flowers', ['pink', 'purple', 'yellow', 'red', 'mix']) },
    make(o) { const g = new THREE.Group(), C = { pink: ['#e0457b', '#f08fb0'], purple: ['#a084c8', '#7d5fb8'], yellow: ['#f6d65a', '#f39c1f'], red: ['#d8402f', '#f39c1f'], mix: ['#e0457b', '#f6d65a'] }[o.colour || 'pink'];
      CYL(g, 1.8, 1.9, 0.4, 10, '#e2d3b2', 0, 0, 0, { edge: false }); CYL(g, 1.6, 1.6, 0.06, 10, '#6b4a30', 0, 0.4, 0, { edge: false });
      [[0, 0, 0], [0.9, 0.3, 1], [-0.8, 0.5, 1], [0.2, -0.95, 0], [-0.5, -0.6, 1], [0.7, -0.5, 0]].forEach(([x, z, k]) => ICO(g, 0.55, 0, C[k], x, 0.75, z, { edge: false }));
      return g; } });
  def({ key: 'bushClump', name: 'Bushes', cat: 'Street', part: 2, budget: 40, size: '3 m clump', opts: { kind: choices('Bushes', ['green', 'dark', 'flowering']) },
    make(o) { const g = new THREE.Group(), k = o.kind || 'green', A = k === 'dark' ? '#3f6e3a' : '#5e9a4e', Bc = k === 'flowering' ? '#e88fb4' : k === 'dark' ? '#4f7f45' : '#6fae5a';
      ICO(g, 1.2, 0, A, 0, 0.8, 0, { edge: false }); ICO(g, 0.95, 0, Bc, 1.1, 0.6, 0.4, { edge: false }); ICO(g, 0.85, 0, A, -0.9, 0.55, -0.5, { edge: false }); return g; } });
  def({ key: 'parkTree', name: 'Park tree', cat: 'Street', part: 2, budget: 50, size: '8 m round tree', opts: { kind: choices('Tree', ['green', 'dark', 'yellow']) },
    make(o) { const g = new THREE.Group(), c = { green: PAL.leaf2, dark: PAL.leaf, yellow: '#9cba52' }[o.kind || 'green'];
      CYL(g, 0.25, 0.35, 2.6, 6, PAL.wood, 0, 0, 0, { edge: false, open: true }); ICO(g, 2.6, 0, c, 0, 4.2, 0, { edge: false }); ICO(g, 1.7, 0, c, 1.2, 5.4, 0.6, { edge: false }); return g; } });
  def({ key: 'hedgeRow', name: 'Hedge', cat: 'Street', part: 2, budget: 30, size: '10 m long, 1.2 m tall', opts: {},
    make() { const g = new THREE.Group(); B(g, 10, 1.2, 1.2, '#4f7f45', 0, 0, 0, NE); return g; } });
  // ===== Vinland National Stadium complex (Dev's reference, 15 Nov): cream stone arena with a white roof on steel ribs, grand entrance with
  // pediment + navy/gold banners, and the pieces round it (sports hall, pool, courts, training pitch, café pavilions, compass plaza, roundabout).
  const NAVY = '#1f2f5a', GOLD = '#e2b04a', ROAD_C = '#55575d';
  const starMat = (bg, fg) => { if (typeof document === 'undefined') return mat(bg); const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
    x.translate(128, 128); x.fillStyle = fg; for (let k = 0; k < 8; k++) { const r = k % 2 ? 46 : 110; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos((k - 0.25) * Math.PI / 4) * 14, Math.sin((k - 0.25) * Math.PI / 4) * 14);
      x.lineTo(Math.cos(k * Math.PI / 4) * r, Math.sin(k * Math.PI / 4) * r); x.lineTo(Math.cos((k + 0.25) * Math.PI / 4) * 14, Math.sin((k + 0.25) * Math.PI / 4) * 14); x.closePath(); x.fill(); }
    x.strokeStyle = fg; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 70, 0, Math.PI * 2); x.stroke();
    const t = new THREE.CanvasTexture(c), m = toon('#ffffff'); m.map = t; m.emissiveMap = t; m.userData.glow = '#c8c8c8'; return m; };
  const STAR_NAVY = starMat(NAVY, GOLD), STAR_DISC = starMat('#d9c9a8', NAVY);
  def({ key: 'nationalStadium', name: 'Vinland National Stadium', cat: 'Landmarks', part: 2, budget: 9000, size: 'about 180 × 144 m · ring road · 34 m tall', night: true,
    opts: {},
    make() {
      const g = new THREE.Group(), RX = 60, RZ = 42, SQ = 3.4;
      const sgn = v => (v < 0 ? -1 : 1), E = (t, off) => { const s = Math.sin(t), c = Math.cos(t); return { x: sgn(s) * Math.pow(Math.abs(s), 2 / SQ) * (RX + off), z: sgn(c) * Math.pow(Math.abs(c), 2 / SQ) * (RZ + off) }; };
      const two = c => { const m = toon(c); m.side = THREE.DoubleSide; return m; };
      const STONE = two('#efe3c8'), STONE2 = two('#e2d3b2'), SEATS = two('#2c3f6e'), SEATS2 = two('#3a5288'), ROOF = two('#f7f4ec'), ROOFU = two('#d9d6cf'), ASPH = two('#55575d');
      const LIT = (c, n) => glowMat(c, n), GRASS = LIT('#7fb156', '#4f7a34'), GRASS2 = LIT('#6fa04a', '#456c2c'), WL = LIT(LINE, '#d8d8d0');
      const buckets = new Map(), N = 72, ring = (m, o1, y1, o2, y2) => { if (!buckets.has(m)) buckets.set(m, []); const pos = buckets.get(m);
        for (let i = 0; i < N; i++) { const t1 = i / N * Math.PI * 2, t2 = (i + 1) / N * Math.PI * 2, a1 = E(t1, o1), a2 = E(t2, o1), b1 = E(t1, o2), b2 = E(t2, o2);
          pos.push(a1.x, y1, a1.z, a2.x, y1, a2.z, b2.x, y2, b2.z, a1.x, y1, a1.z, b2.x, y2, b2.z, b1.x, y2, b1.z); } };
      ring(ASPH, 42, 0.08, 52, 0.08); ring(STONE2, 30, 0.07, 42, 0.07); ring(STONE2, 52, 0.07, 55, 0.07);    // ring road round the stadium + pavements
      ring(STONE2, 0, 0.3, 0, 2.2); ring(STONE2, 0, 2.2, 1.4, 2.2);
      ring(SEATS, 1.4, 2.2, 15, 10.8); ring(STONE2, 15, 10.8, 17, 11.4); ring(STONE2, 17, 11.4, 17, 13.6); ring(SEATS2, 17, 13.6, 27, 22.6); ring(STONE2, 27, 22.6, 29, 23.2);
      ring(STONE, 29, 0, 29, 24); ring(STONE2, 29, 11.6, 30, 11.6); ring(STONE, 29, 24, 30.2, 24.6); ring(STONE, 30.2, 24.6, 30.2, 26);      // cream stone wall, cornice, parapet
      ring(ROOF, 6, 31.5, 30, 26.5); ring(ROOFU, 6, 31.4, 30, 26.4);                                   // white roof over the stands (open in the middle)
      buckets.forEach((pos, m) => { const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.computeVertexNormals();
        const me = new THREE.Mesh(ge, m); me.castShadow = m === ROOF || m === STONE; me.receiveShadow = true; g.add(me); });
      // steel ribs over the roof (radial trusses), each a thin raised beam
      for (let i = 0; i < 36; i++) { const t = (i + 0.5) / 36 * Math.PI * 2, a = E(t, 6), b = E(t, 30), L = Math.hypot(b.x - a.x, b.z - a.z), s = grp(g, (a.x + b.x) / 2, 29.6, (a.z + b.z) / 2, Math.atan2(b.x - a.x, b.z - a.z));
        const bm = B(s, 0.5, 0.6, L + 1, '#c9ced2', 0, 0, 0, NE); bm.rotation.x = Math.atan2(5, L) ; B(s, 0.3, 4.2, 0.3, '#c9ced2', 0, -0.6, -L / 2 + 1, NE); }
      // two tiers of tall arches all round the wall (the front gets the grand entrance instead)
      const ARCHM = glowMat('#6a5644', '#f0c070'), NF = 56;
      for (let i = 0; i < NF; i++) { const t1 = i / NF * Math.PI * 2, t2 = (i + 1) / NF * Math.PI * 2, tm = (t1 + t2) / 2;
        if (Math.abs(Math.atan2(Math.sin(tm), Math.cos(tm))) < 0.3) continue;
        const a = E(t1, 29), b = E(t2, 29), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; let nx = b.z - a.z, nz = -(b.x - a.x); if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
        const L = Math.hypot(nx, nz), w = Math.min(5.2, Math.hypot(b.x - a.x, b.z - a.z) * 0.62), f = grp(g, mx + nx / L * 0.08, 0, mz + nz / L * 0.08, Math.atan2(nx, nz));
        P(f, w, 7.8, ARCHM, 0, 0.3, 0); ARCH(f, w, ARCHM, 0, 8.1, 0); P(f, w * 0.8, 6.2, ARCHM, 0, 13.2, 0); ARCH(f, w * 0.8, ARCHM, 0, 19.4, 0); }
      // grand entrance (front, +z): portico block, pediment, the name, navy banners with the gold star
      { const p = E(0, 29), s = grp(g, 0, 0, p.z, 0);
        B(s, 44, 26, 8, '#efe3c8', 0, 0, 1); B(s, 47, 1.4, 9, '#e2d3b2', 0, 26, 1, NE); GABLE(s, 30, 6, 9.4, '#efe3c8', 0, 27.4, 1);
        put(s, geo('pane', () => new THREE.PlaneGeometry(1, 1)), STAR_NAVY, 0, 30, 5.75, Object.assign({}, FLAT, { s: [3.6, 3.6, 1] }));
        B(s, 30, 3.4, 0.4, '#efe3c8', 0, 20.2, 5.05); P(s, 29, 3, textMat('VINLAND NATIONAL STADIUM', '#efe3c8', '#2a2a2a'), 0, 20.4, 5.3);
        for (let k = -2; k <= 2; k++) { P(s, 5.2, 14, ARCHM, k * 6.4, 0.3, 5.06); ARCH(s, 5.2, ARCHM, k * 6.4, 14.3, 5.06); }
        [-1, 1].forEach(sd => { B(s, 1.4, 26, 1.4, '#e2d3b2', sd * 22.6, 0, 5.2, NE);
          const bn = grp(s, sd * 27, 4, 5.4, 0); B(bn, 6.4, 19, 0.3, NAVY, 0, 0, 0, NE); put(bn, geo('pane', () => new THREE.PlaneGeometry(1, 1)), STAR_NAVY, 0, 12, 0.18, Object.assign({}, FLAT, { s: [5, 5, 1] })); B(bn, 6.4, 0.5, 0.35, GOLD, 0, 19, 0, NE); });
        // steps down to the plaza
        for (let k = 0; k < 2; k++) B(s, 40, 0.45 * (2 - k), 2, '#e2d3b2', 0, 0, 6 + k * 2, { shadow: false }); }
      // floodlights on the roof edge (glow at night)
      const FL = glowMat('#f4f1e8', '#ffffff');
      for (let i = 0; i < 12; i++) { const t = (i + 0.5) / 12 * Math.PI * 2, p = E(t, 8); const s = grp(g, p.x, 31.2, p.z, Math.atan2(-p.x, -p.z)); B(s, 6, 1.6, 0.6, '#c9ced2', 0, 0, 0, NE); P(s, 5.6, 1.3, FL, 0, 0.15, 0.32, { rx: -0.5 }); }
      // field
      flat2(g, 2 * RX, 2 * RZ, GRASS, 0, 0.3, 0);
      const W = 68, Lp = 105; for (let i = 0; i < 10; i++) flat2(g, Lp / 10, W, i % 2 ? GRASS2 : GRASS, -Lp / 2 + Lp / 10 * (i + 0.5), 0.34, 0);
      [[Lp, 0.15, 0, W / 2], [Lp, 0.15, 0, -W / 2], [0.15, W, Lp / 2, 0], [0.15, W, -Lp / 2, 0], [0.15, W, 0, 0]].forEach(([w, d, x, z]) => flat2(g, w, d, WL, x, 0.38, z));
      put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), WL, 0, 0.38, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [9.15, 9.15, 1] }));
      [-1, 1].forEach(sd => { const x = sd * Lp / 2; [[0.15, 40.3, x - sd * 16.5, 0], [16.5, 0.15, x - sd * 8.25, 20.15], [16.5, 0.15, x - sd * 8.25, -20.15]].forEach(([w, d, xx, z]) => flat2(g, w, d, WL, xx, 0.38, z));
        [-3.66, 3.66].forEach(z => B(g, 0.15, 2.44, 0.15, '#ffffff', x, 0.3, z, NE)); B(g, 0.15, 0.15, 7.47, '#ffffff', x, 2.74, 0, NE); });
      return g; } });
  def({ key: 'sportsHall', name: 'Sports hall', cat: 'Landmarks', part: 2, budget: 900, size: '60 × 40 m · curved metal roof', night: true, opts: {},
    make() { const g = new THREE.Group(), GL = glowMat('#7fa7bd', '#f2d28a');
      B(g, 60, 9, 40, '#e9e3d6', 0, 0, 0); P(g, 56, 6.5, GL, 0, 1, 20.06); B(g, 60, 0.6, 1.2, '#c9ced2', 0, 7.8, 20.4, NE);
      for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI, a1 = (k + 1) / 8 * Math.PI, y0 = 9 + Math.sin(a0) * 7, y1 = 9 + Math.sin(a1) * 7, z0 = -Math.cos(a0) * 21, z1 = -Math.cos(a1) * 21;
        const s = grp(g, 0, (y0 + y1) / 2, (z0 + z1) / 2, 0); const m = B(s, 62, 0.5, Math.hypot(z1 - z0, y1 - y0) + 0.2, k % 2 ? '#aeb6bf' : '#bcc4cc', 0, -0.25, 0, NE); m.rotation.x = -Math.atan2(y1 - y0, z1 - z0); }
      B(g, 22, 2.6, 0.4, NAVY, 0, 10.2, 20.5, NE); P(g, 21, 2.2, textMat('SPORTS HALL', NAVY, '#ffffff'), 0, 10.4, 20.75);
      return g; } });
  def({ key: 'poolDeck', name: 'Swimming pool', cat: 'Landmarks', part: 2, budget: 500, size: '34 × 70 m deck · 25 × 50 m pool', night: true, opts: {},
    make() { const g = new THREE.Group(), WAT = glowMat('#4fb4d8', '#2f8fc0');
      flat2(g, 34, 70, '#ece4d2', 0, 0.06, 0); flat2(g, 25, 50, WAT, 0, 0.1, -3);
      for (let k = 1; k < 8; k++) flat2(g, 0.25, 50, '#e8f6fb', -12.5 + k * 25 / 8, 0.12, -3);
      for (let k = 0; k < 6; k++) { B(g, 1, 0.35, 2.2, '#f6f0e2', -14, 0.06, -20 + k * 7, NE); CYL(g, 0.08, 0.08, 2.6, 6, '#c9ced2', -15.6, 0.06, -20 + k * 7, { edge: false }); put(g, geo('umb', () => new THREE.ConeGeometry(1.4, 0.7, 8, 1, true)), k % 2 ? PAL.terra : NAVY, -15.6, 2.9, -20 + k * 7, { edge: false }); }
      B(g, 30, 4, 7, '#e9e3d6', 0, 0, 29); B(g, 31, 0.5, 8, NAVY, 0, 4, 29, NE);
      return g; } });
  def({ key: 'sportsCourts', name: 'Basketball + tennis courts', cat: 'Landmarks', part: 2, budget: 400, size: '32 × 64 m', opts: {},
    make() { const g = new THREE.Group(), L = '#ffffff';
      flat2(g, 32, 64, '#5a7a5a', 0, 0.06, 0);
      flat2(g, 15, 28, '#c4553f', -7.6, 0.08, -15.5); flat2(g, 15, 28, '#3f62a8', 7.6, 0.08, -15.5);
      [-7.6, 7.6].forEach(x => { flat2(g, 15, 0.15, L, x, 0.1, -15.5); put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), L, x, 0.1, -15.5, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [1.8, 1.8, 1] }));
        [-29.3, -1.7].forEach(z => { B(g, 0.2, 3.4, 0.2, '#c9ced2', x, 0.06, z, NE); B(g, 1.8, 1.1, 0.1, '#ffffff', x, 3.2, z + (z < -15 ? 0.4 : -0.4), NE); }); });
      flat2(g, 30, 30, '#3f7fbf', 0, 0.08, 16); flat2(g, 11, 24, '#4f9a5a', 0, 0.09, 16); [[11, 0.12, 0, 4], [11, 0.12, 0, 28], [0.12, 24, 5.5, 16], [0.12, 24, -5.5, 16], [11, 0.12, 0, 16]].forEach(([w, d, x, z]) => flat2(g, w, d, L, x, 0.1, z));
      B(g, 12, 1, 0.08, '#2f2b28', 0, 0.06, 16, NE);
      [[32, 0, 32], [32, 0, -32]].forEach(([w, x, z]) => B(g, w, 3, 0.08, '#4a5a4a', x, 0.06, z, { shadow: false, edge: false }));
      [-16, 16].forEach(x => B(g, 0.08, 3, 64, '#4a5a4a', x, 0.06, 0, { shadow: false, edge: false }));
      return g; } });
  def({ key: 'trainingPitch', name: 'Training pitch', cat: 'Landmarks', part: 2, budget: 600, size: '64 × 96 m with floodlights', night: true, opts: {},
    make() { const g = new THREE.Group(), LIT = (c, n) => glowMat(c, n), G1 = LIT('#7fb156', '#4f7a34'), G2 = LIT('#6fa04a', '#456c2c'), WL = LIT(LINE, '#d8d8d0'), FL = glowMat('#f4f1e8', '#ffffff');
      flat2(g, 64, 96, '#5f8f48', 0, 0.05, 0); const W = 52, Lp = 84; for (let i = 0; i < 8; i++) flat2(g, W, Lp / 8, i % 2 ? G2 : G1, 0, 0.08, -Lp / 2 + Lp / 8 * (i + 0.5));
      [[W, 0.15, 0, Lp / 2], [W, 0.15, 0, -Lp / 2], [0.15, Lp, W / 2, 0], [0.15, Lp, -W / 2, 0], [W, 0.15, 0, 0]].forEach(([w, d, x, z]) => flat2(g, w, d, WL, x, 0.11, z));
      put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), WL, 0, 0.11, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [7, 7, 1] }));
      [-1, 1].forEach(sd => { const z = sd * Lp / 2; [-3, 3].forEach(x => B(g, 0.15, 2.2, 0.15, '#ffffff', x, 0.08, z, NE)); B(g, 6.15, 0.15, 0.15, '#ffffff', 0, 2.3, z, NE); });
      [[-30, -40], [30, -40], [-30, 40], [30, 40], [-30, 0], [30, 0]].forEach(([x, z]) => { const s = grp(g, x, 0, z, Math.atan2(-x, -z * 0.2)); B(s, 0.6, 18, 0.6, '#c9ced2', 0, 0, 0, NE); B(s, 4, 2, 0.5, '#c9ced2', 0, 18, 0.3, NE); P(s, 3.6, 1.7, FL, 0, 18.15, 0.58, { rx: -0.4 }); });
      [[64, 0, 48], [64, 0, -48]].forEach(([w, x, z]) => B(g, w, 2.6, 0.08, '#4a5a4a', x, 0.05, z, { shadow: false, edge: false })); [-32, 32].forEach(x => B(g, 0.08, 2.6, 96, '#4a5a4a', x, 0.05, 0, { shadow: false, edge: false }));
      return g; } });
  def({ key: 'cafePavilion', name: 'Café pavilion (curved)', cat: 'Landmarks', part: 2, budget: 500, size: '34 × 14 m', night: true, opts: {},
    make() { const g = new THREE.Group(), GL = glowMat('#8fb8cc', '#f2d28a'), R0 = 40;
      for (let k = 0; k < 7; k++) { const a = (k - 3) * 0.12, s = grp(g, Math.sin(a) * R0, 0, Math.cos(a) * R0 - R0, a);
        B(s, 5, 5.2, 10, '#efe3c8', 0, 0, 0); P(s, 4.4, 3.6, GL, 0, 0.8, 5.03); B(s, 5.4, 0.6, 11.4, '#9aa3ad', 0, 5.2, 0.4, NE); }
      for (let k = 0; k < 5; k++) { const x = (k - 2) * 6.4; CYL(g, 0.08, 0.08, 2.6, 6, '#c9ced2', x, 0.06, 7.5, { edge: false }); put(g, geo('umb', () => new THREE.ConeGeometry(1.4, 0.7, 8, 1, true)), '#f6f0e2', x, 2.9, 7.5, { edge: false });
        CYL(g, 0.7, 0.7, 0.1, 10, '#ffffff', x, 0.95, 7.5, { edge: false }); }
      return g; } });
  def({ key: 'compassPlaza', name: 'Compass plaza', cat: 'Landmarks', part: 2, budget: 200, size: '40 m paved circle with a navy and gold star', opts: {},
    make() { const g = new THREE.Group(); put(g, geo('disc32', () => new THREE.CircleGeometry(1, 40)), '#e2d3b2', 0, 0.07, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [20, 20, 1] }));
      put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), STAR_DISC, 0, 0.09, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [18, 18, 1] })); return g; } });
  def({ key: 'roundabout', name: 'Roundabout', cat: 'Street', part: 2, budget: 260, size: '44 m across · green island with the gold star', opts: {},
    make() { const g = new THREE.Group(), D = (r, c, y) => put(g, geo('disc32', () => new THREE.CircleGeometry(1, 40)), c, 0, y, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [r, r, 1] }));
      D(22, ROAD_C, 0.075); put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 32)), LINE, 0, 0.085, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [16.2, 16.2, 1] }));
      CYL(g, 10.6, 10.6, 0.3, 28, '#d8d2c6', 0, 0, 0, { edge: false }); D(10, '#7fae5c', 0.32);
      put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), STAR_NAVY, 0, 0.34, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [8, 8, 1] }));
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; ICO(g, 0.7, 0, k % 2 ? '#e0457b' : '#f6d65a', Math.cos(a) * 8.6, 0.8, Math.sin(a) * 8.6, { edge: false }); }
      return g; } });
  def({ key: 'trainingCentre', name: 'Training centre', cat: 'Landmarks', part: 2, budget: 400, size: '26 × 40 m · 2 floors', night: true, opts: {},
    make() { const g = new THREE.Group(), GL = glowMat('#7fa7bd', '#f2d28a'); B(g, 40, 8, 26, '#e9e3d6', 0, 0, 0); B(g, 41, 0.8, 27, '#9aa3ad', 0, 8, 0, NE);
      [1, 4.6].forEach(y => P(g, 36, 2.6, GL, 0, y, 13.03)); B(g, 18, 1.6, 0.3, NAVY, 0, 8.9, 13.2, NE); P(g, 17, 1.3, textMat('TRAINING CENTRE', NAVY, '#ffffff'), 0, 9.05, 13.36); return g; } });
  // ===== NEW DISTRICT homes (16 Nov, Dev: new house designs before anything is placed). Front = +z, plot 10 x 10 m (fourplex 18 x 12 m).
  // Shared bits: lawn, path, a low fence with a gate gap, a tree, flower pots. Wall + roof colours are slots (each home its own).
  const ndPlot = (g, w, d, fence, gateX) => { B(g, w, 0.2, d, PAL.grass, 0, 0, 0, { shadow: false });
    B(g, 1.3, 0.06, d / 2 - 1.5, '#e2d8c4', gateX, 0.2, d / 4 + 0.75, FLAT);
    const z = d / 2 - 0.1, segs = [[-w / 2, gateX - 0.8], [gateX + 0.8, w / 2]];
    segs.forEach(([a, b]) => { if (b - a < 0.3) return; if (fence === 'picket') { B(g, b - a, 0.1, 0.08, '#ffffff', (a + b) / 2, 0.75, z, NE); B(g, b - a, 0.1, 0.08, '#ffffff', (a + b) / 2, 0.4, z, NE);
        for (let x = a + 0.2; x <= b - 0.1; x += 0.55) B(g, 0.09, 0.95, 0.09, '#ffffff', x, 0.2, z, NE); }
      else if (fence === 'hedge') B(g, b - a, 0.8, 0.7, PAL.leaf, (a + b) / 2, 0.2, z - 0.3);
      else { B(g, b - a, 0.7, 0.3, '#d9cdb5', (a + b) / 2, 0.2, z); B(g, b - a, 0.1, 0.4, '#c9bca2', (a + b) / 2, 0.9, z, NE); } }); };
  const ndTree = (g, x, z, kind, s) => { if (kind === 'pink') { CYL(g, 0.12 * s, 0.16 * s, 1.4 * s, 6, PAL.wood, x, 0.2, z); ICO(g, 1.2 * s, 0, PAL.pink, x, 2.2 * s, z); }
    else { CYL(g, 0.12 * s, 0.16 * s, 1.4 * s, 6, PAL.wood, x, 0.2, z); ICO(g, 1.25 * s, 0, PAL.leaf2, x, 2.3 * s, z); } };
  const ndPots = (g, pts) => pts.forEach(([x, z, c]) => { B(g, 0.45, 0.4, 0.45, PAL.terra2, x, 0.2, z, NE); ICO(g, 0.32, 0, c, x, 0.78, z, NE); });

  // 1. Modern family house: two-storey white block, flat dark roof, wooden wing with a sloping roof, big windows, picket fence.
  def({ key: 'ndModern', name: 'Modern family house', cat: 'New District', part: 2, budget: 700, size: '10 × 10 m · 2 floors · 1 home',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Roof', ['#4a4f57', '#5b5f66', '#7a4f34']) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), R = slot('roof', pick(o, 'roof', ['#4a4f57'])), WOOD = '#b98a5e';
      ndPlot(g, 10, 10, 'picket', 0.6);
      B(g, 5.4, 6.0, 5.4, W, -1.4, 0.2, -1.4);
      B(g, 6.0, 0.4, 6.0, R, -1.4, 6.2, -1.4); B(g, 6.0, 0.5, 0.15, R, -1.4, 6.6, 1.55, NE);
      B(g, 3.6, 3.2, 4.8, WOOD, 2.9, 0.2, -1.6); for (let x = 1.4; x <= 4.6; x += 0.5) B(g, 0.06, 3.2, 0.06, '#9a6f48', x, 0.2, 0.82, NE);
      const r = B(g, 4.3, 0.3, 5.4, R, 2.9, 3.55, -1.6); r.rotation.z = 0.2;
      P(g, 1.1, 2.2, '#5b3a26', 0.4, 0.2, 1.31); B(g, 2.0, 0.15, 1.3, '#e2d8c4', 0.4, 2.55, 1.9, NE);
      P(g, 2.6, 1.9, PAL.glass, -2.4, 1.0, 1.32); P(g, 3.9, 1.5, PAL.glass, -1.5, 3.9, 1.32); P(g, 2.2, 1.6, PAL.glass, 2.9, 1.0, 0.83);
      B(g, 4.2, 0.12, 0.9, '#ffffff', -1.5, 3.65, 1.75, NE); B(g, 4.2, 0.9, 0.06, '#bfe0ea', -1.5, 3.77, 2.2, NE);   // small glass balcony
      ndTree(g, -3.8, 3.3, 'canopy', 0.8); ndPots(g, [[1.6, 2.4, PAL.pink], [-0.6, 2.4, '#e2b04a']]); B(g, 2.8, 0.7, 0.8, PAL.leaf, 3.2, 0.2, 3.7, NE);
      return g; } });

  // 2. Cottage: one and a half floors, steep slate roof with a dormer, wooden porch on posts, stone base, flower boxes, hedge.
  def({ key: 'ndCottage', name: 'Cottage', cat: 'New District', part: 2, budget: 700, size: '10 × 10 m · 1.5 floors · 1 home',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Roof', ['#5b5f66', '#4f6b7a', '#7a4a3a', '#3f5866']) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), R = slot('roof', pick(o, 'roof', ['#5b5f66']));
      ndPlot(g, 10, 10, 'hedge', -0.2);
      B(g, 7.2, 0.6, 5.4, '#b9ad98', 0, 0.2, -1.2); B(g, 7, 3.0, 5.2, W, 0, 0.8, -1.2);
      GABLE(g, 6.0, 3.6, 7.8, R, 0, 3.8, -1.2, { ry: Math.PI / 2 });                                      // steep roof, ridge along the street
      B(g, 2.0, 1.6, 1.6, W, 1.4, 4.4, 0.6); GABLE(g, 2.4, 1.0, 1.9, R, 1.4, 6.0, 0.6);                     // dormer
      P(g, 1.2, 1.0, PAL.glass, 1.4, 4.7, 1.41);
      B(g, 3.6, 0.25, 2.0, '#a07a52', -0.2, 0.8, 2.4); [-1.8, 1.4].forEach(x => B(g, 0.2, 2.6, 0.2, '#f6f0e2', x, 1.05, 3.25, NE));
      B(g, 3.9, 0.25, 2.3, R, -0.2, 3.6, 2.45);                                                               // porch roof
      P(g, 1.1, 2.1, '#3f6f8a', -0.2, 0.8, 1.41);
      [-2.4, 2.4].forEach(x => { P(g, 1.2, 1.3, PAL.glass, x, 1.7, 1.41); [-0.75, 0.75].forEach(d => P(g, 0.32, 1.3, PAL.shutter, x + d, 1.7, 1.42)); B(g, 1.4, 0.35, 0.4, PAL.wood, x, 1.3, 1.6, NE); ICO(g, 0.25, 0, PAL.pink, x - 0.35, 1.75, 1.62, NE); ICO(g, 0.25, 0, '#e2b04a', x + 0.35, 1.75, 1.62, NE); });
      B(g, 0.9, 1.6, 0.9, '#b9ad98', -2.6, 6.0, -2.2);                                                         // chimney
      ndTree(g, 3.6, 3.0, 'pink', 0.8); ndPots(g, [[1.2, 3.0, PAL.purple]]);
      return g; } });

  // 3. Indian bungalow: one wide floor, flat roof with a parapet and a roof terrace + pergola, a verandah on columns, jali screen, gate pillars.
  def({ key: 'ndBungalow', name: 'Bungalow', cat: 'New District', part: 2, budget: 750, size: '10 × 10 m · 1 floor + roof terrace · 1 home',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Trim', ['#c8603f', '#4f9a86', '#c9922e', '#7a4a3a']) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), T = slot('roof', pick(o, 'roof', ['#c8603f']));
      ndPlot(g, 10, 10, 'wall', 0);
      [-0.95, 0.95].forEach(x => { B(g, 0.6, 1.4, 0.6, '#efe4cc', x, 0.2, 4.9); B(g, 0.75, 0.15, 0.75, T, x, 1.6, 4.9, NE); });   // gate pillars
      B(g, 8.4, 3.4, 5.6, W, 0, 0.2, -1.6); B(g, 8.8, 0.3, 6.0, T, 0, 3.6, -1.6);                             // the house + roof band
      B(g, 8.8, 0.7, 0.2, W, 0, 3.9, 1.3, NE); B(g, 0.2, 0.7, 6.0, W, -4.3, 3.9, -1.6, NE); B(g, 0.2, 0.7, 6.0, W, 4.3, 3.9, -1.6, NE); B(g, 8.8, 0.7, 0.2, W, 0, 3.9, -4.5, NE);   // parapet
      B(g, 8.4, 0.3, 2.4, '#e9dcc0', 0, 0.2, 2.4); [-3.9, -1.3, 1.3, 3.9].forEach(x => B(g, 0.35, 2.9, 0.35, '#f6f0e2', x, 0.5, 3.4)); B(g, 8.8, 0.35, 2.7, T, 0, 3.4, 2.45);   // verandah
      P(g, 1.3, 2.3, '#7a4f34', 0, 0.5, 1.21); [-2.8, 2.8].forEach(x => P(g, 1.6, 1.4, PAL.glass, x, 1.3, 1.21));
      for (let i = 0; i < 6; i++) B(g, 0.1, 1.2, 0.08, '#ffffff', -3.4 + i * 0.25, 1.4, 3.42, NE);          // jali screen
      const pg = grp(g, 2.0, 4.2, -2.2); [-1.6, 1.6].forEach(x => [-1.2, 1.2].forEach(z => B(pg, 0.18, 2.0, 0.18, '#a07a52', x, 0, z, NE)));
      for (let x = -1.8; x <= 1.8; x += 0.6) B(pg, 0.12, 0.12, 2.8, '#a07a52', x, 2.0, 0, NE); B(pg, 3.6, 0.12, 0.12, '#a07a52', 0, 2.0, 1.2, NE);   // pergola
      ndPots(g, [[-1.8, 4.1, PAL.leaf], [1.8, 4.1, PAL.leaf], [-3.2, -0.3 + 4.0, PAL.pink], [-2.8, 4.6 - 0.6 + 0.2, '#e2b04a']]);
      ndTree(g, 3.8, 3.6, 'canopy', 0.75);
      return g; } });

  // 4. Fourplex: one building, 4 homes (2 up, 2 down), two front doors with their own steps, outside stairs to the upper homes,
  //    balconies, a shared garden. 18 x 12 m plot (two house plots).
  def({ key: 'ndFourplex', name: 'Fourplex (4 homes)', cat: 'New District', part: 2, budget: 1100, size: '18 × 12 m · 2 floors · 4 homes',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Roof', ['#c8603f', '#5b5f66', '#4f6b7a']) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), R = slot('roof', pick(o, 'roof', ['#c8603f'])), DOORS = ['#3f6f8a', '#c8603f', '#2f7a68', '#c9922e'];
      ndPlot(g, 18, 12, 'picket', 0);
      B(g, 13, 6.2, 6.4, W, 0, 0.2, -1.6); B(g, 13.6, 0.35, 7.0, R, 0, 6.4, -1.6);
      GABLE(g, 7.0, 2.4, 13.4, R, 0, 6.75, -1.6, { ry: Math.PI / 2 });
      B(g, 0.3, 6.2, 6.6, '#e2d8c4', 0, 0.2, -1.6, NE);                                                       // the wall line between the halves
      [-1, 1].forEach(sd => { const x0 = sd * 3.3;
        P(g, 1.1, 2.1, DOORS[sd < 0 ? 0 : 1], x0, 0.2, 1.61); P(g, 2.0, 1.4, PAL.glass, x0 + sd * 1.9, 1.0, 1.61);   // ground-floor homes
        B(g, 2.2, 0.15, 1.2, '#e2d8c4', x0, 2.4, 2.2, NE);
        const bx = x0 + sd * 1.5; B(g, 2.8, 0.2, 1.3, '#efe4cc', bx, 3.3, 2.25);                                  // upper balcony in front of the upper door
        B(g, 2.8, 0.08, 0.08, PAL.iron, bx, 4.35, 2.88, NE); for (let k = -1.3; k <= 1.31; k += 0.325) B(g, 0.05, 0.85, 0.05, PAL.iron, bx + k, 3.5, 2.88, NE);
        P(g, 1.0, 2.0, DOORS[sd < 0 ? 2 : 3], bx, 3.5, 1.61); P(g, 1.6, 1.3, PAL.glass, x0 - sd * 1.3, 4.0, 1.61);
        for (let i = 0; i < 8; i++) B(g, 1.0, 0.18, 0.35, '#d9cdb5', sd * (6.9 + 0.0), 0.2 + i * 0.4, 1.4 - i * 0.35 + 0.0, NE);   // outside stairs up
      });
      ndTree(g, -7.6, 4.2, 'pink', 0.8); ndTree(g, 7.6, 4.2, 'canopy', 0.8); ndPots(g, [[-1.0, 4.6, PAL.pink], [1.0, 4.6, '#e2b04a'], [-4.3, 2.6, PAL.purple], [4.3, 2.6, PAL.leaf]]);
      B(g, 5, 0.12, 2.2, '#e2d8c4', 0, 0.2, 4.6, FLAT);
      return g; } });

  // ===== NEW DISTRICT · Vinland style (16 Nov, Dev: "more matching our current vibe"): cream / peach walls, terracotta roofs,
  // green shutters, arches, stone garden walls, blossom trees. New shapes, not the town's house.
  const vlWin = (p, x, y, z, w = 1.1, h = 1.5, arch = false) => { P(p, w + 0.3, h + 0.3, PAL.cream, x, y - 0.15, z); P(p, w, h, PAL.glass, x, y, z + 0.01);
    if (arch) ARCH(p, w, PAL.glass, x, y + h, z + 0.01); [-1, 1].forEach(sd => P(p, w * 0.45, h, PAL.shutter, x + sd * w * 0.75, y, z + 0.02)); };
  const vlWall = (g, w, d, gateX) => { const z = d / 2 - 0.15; [[-w / 2, gateX - 0.9], [gateX + 0.9, w / 2]].forEach(([a, b]) => { if (b - a < 0.3) return;
      B(g, b - a, 0.8, 0.35, '#e3d2ae', (a + b) / 2, 0.2, z); B(g, b - a, 0.12, 0.45, '#d9c49a', (a + b) / 2, 1.0, z, NE); });
    [-1, 1].forEach(sd => B(g, 0.45, 1.3, 0.45, '#d9c49a', gateX + sd * 0.95, 0.2, z, NE)); };
  const vlBase = (g, w, d, gateX) => { B(g, w, 0.2, d, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 1.3, 0.06, d / 2 - 1.5, '#e9dcc0', gateX, 0.2, d / 4 + 0.75, FLAT); vlWall(g, w, d, gateX); };

  // 5. Vinland villa: two floors, terracotta hip roof, arched front door with a little canopy, green shutters, a balcony with plants.
  def({ key: 'vlVilla', name: 'Vinland villa', cat: 'New District', part: 2, budget: 750, size: '10 × 10 m · 2 floors · 1 home',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Roof', SETS.roofs) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), R = slot('roof', pick(o, 'roof', SETS.roofs));
      vlBase(g, 10, 10, 0);
      B(g, 7, 6, 5.6, W, 0, 0.2, -1.4); B(g, 7.3, 0.3, 5.9, PAL.cream, 0, 3.15, -1.4, NE); HIP(g, 8.2, 2.4, 6.8, R, 0, 6.2, -1.4);
      P(g, 1.2, 2.0, PAL.wood, 0, 0.2, 1.41); ARCH(g, 1.2, PAL.wood, 0, 2.2, 1.41); B(g, 2.0, 0.15, 1.0, R, 0, 2.95, 1.9, NE);
      vlWin(g, -2.3, 1.1, 1.41); vlWin(g, 2.3, 1.1, 1.41); vlWin(g, -2.3, 4.0, 1.41, 1.0, 1.4, true); vlWin(g, 2.3, 4.0, 1.41, 1.0, 1.4, true);
      B(g, 2.4, 0.2, 1.0, PAL.cream, 0, 3.7, 1.9); B(g, 2.4, 0.07, 0.07, PAL.iron, 0, 4.55, 2.38, NE); for (let x = -1.1; x <= 1.11; x += 0.275) B(g, 0.05, 0.7, 0.05, PAL.iron, x, 3.9, 2.38, NE); P(g, 1.0, 1.8, PAL.glass, 0, 3.75, 1.41); ARCH(g, 1.0, PAL.glass, 0, 5.55, 1.41);
      ICO(g, 0.3, 0, PAL.pink, -0.8, 4.8, 2.1, NE); ICO(g, 0.3, 0, PAL.leaf2, 0.8, 4.8, 2.1, NE);
      ndTree(g, -3.7, 3.2, 'pink', 0.85); B(g, 0.6, 2.6, 0.6, PAL.cypress, 3.9, 0.2, 3.4, NE); ndPots(g, [[-1.1, 2.0, PAL.pink], [1.1, 2.0, PAL.purple]]);
      return g; } });

  // 6. Loggia house: an arched loggia (open porch with three arches) on the ground floor, a terrace above it, terracotta gable roof.
  def({ key: 'vlLoggia', name: 'Loggia house', cat: 'New District', part: 2, budget: 800, size: '10 × 10 m · 2 floors · 1 home',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Roof', SETS.roofs) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), R = slot('roof', pick(o, 'roof', SETS.roofs));
      vlBase(g, 10, 10, 1.2);
      B(g, 7.2, 6.0, 4.4, W, 0, 0.2, -2.0); GABLE(g, 5.0, 2.2, 7.8, R, 0, 6.2, -2.0, { ry: Math.PI / 2 });
      B(g, 7.2, 3.0, 2.2, W, 0, 0.2, 1.3);                                                                   // loggia block
      const lg = grp(g, 0, 0, 2.42); [-2.4, 0, 2.4].forEach(x => { P(lg, 1.7, 1.7, '#5c4a3a', x, 0.2, 0); ARCH(lg, 1.7, '#5c4a3a', x, 1.9, 0); });   // three dark arches
      B(g, 7.4, 0.25, 2.4, PAL.cream, 0, 3.2, 1.3, NE); [[-3.6, 0], [3.6, 0]].forEach(([x]) => B(g, 0.15, 0.8, 2.3, PAL.cream, x, 3.45, 1.3, NE)); B(g, 7.3, 0.8, 0.15, PAL.cream, 0, 3.45, 2.42, NE);   // terrace rail
      vlWin(g, -2.2, 4.0, 0.21, 1.0, 1.5, true); P(g, 1.1, 2.0, PAL.glass, 1.4, 3.45, 0.21); ARCH(g, 1.1, PAL.glass, 1.4, 5.45, 0.21);
      [[-3.0, PAL.pink], [3.0, '#e2b04a']].forEach(([x, c]) => ndPots(g, [[x, 2.0 - 0.0 + 1.3 - 1.1, c]]));
      ndTree(g, 3.8, 3.8, 'canopy', 0.75); ndTree(g, -4.0, 3.6, 'pink', 0.7);
      return g; } });

  // 7. Tower house: a two-floor house with a little three-floor corner tower (a room with a view), terracotta roofs, a walled front garden.
  def({ key: 'vlTower', name: 'Tower house', cat: 'New District', part: 2, budget: 850, size: '10 × 10 m · 2–3 floors · 1 home',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Roof', SETS.roofs) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), R = slot('roof', pick(o, 'roof', SETS.roofs));
      vlBase(g, 10, 10, -0.8);
      B(g, 6.2, 5.8, 5.2, W, -1.0, 0.2, -1.6); GABLE(g, 5.6, 2.0, 6.8, R, -1.0, 6.0, -1.6, { ry: Math.PI / 2 });
      B(g, 3.0, 8.6, 3.0, W, 2.6, 0.2, -0.4); HIP(g, 3.8, 1.8, 3.8, R, 2.6, 8.8, -0.4);                        // the tower
      [-0.9, 0, 0.9].forEach(x => { P(g, 0.5, 1.0, PAL.glass, 2.6 + x, 7.3, 1.11); ARCH(g, 0.5, PAL.glass, 2.6 + x, 8.3, 1.11); });   // tower top windows
      vlWin(g, 2.6, 4.2, 1.11, 0.9, 1.4); P(g, 1.1, 2.1, PAL.wood, -1.0, 0.2, 1.01); ARCH(g, 1.1, PAL.wood, -1.0, 2.3, 1.01);
      vlWin(g, -3.0, 1.2, 1.01); vlWin(g, -2.2, 4.0, 1.01, 1.0, 1.4, true); vlWin(g, 0.2, 4.0, 1.01, 0.8, 1.3);
      B(g, 2.8, 0.5, 0.6, '#8a5a3a', -3.0, 0.9, 1.3, NE); ICO(g, 0.28, 0, PAL.pink, -3.6, 1.55, 1.3, NE); ICO(g, 0.28, 0, PAL.purple, -2.5, 1.55, 1.3, NE);
      ndTree(g, 3.9, 3.6, 'pink', 0.8); ndPots(g, [[-0.1, 2.2, PAL.leaf2]]);
      return g; } });

  // 8. Vinland fourplex: 4 homes round a shared front courtyard. Terracotta hip roof, an arched gateway, two front doors down,
  //    two upstairs homes reached by an inside stair (one door each on the gallery), green shutters everywhere.
  def({ key: 'vlFourplex', name: 'Vinland fourplex (4 homes)', cat: 'New District', part: 2, budget: 1200, size: '18 × 12 m · 2 floors · 4 homes',
    opts: { wall: colours('Wall', SETS.walls), roof: colours('Roof', SETS.roofs) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', SETS.walls)), R = slot('roof', pick(o, 'roof', SETS.roofs)), DOORS = ['#47684a', '#3f5866', '#7a4f34', '#b5543a'];
      vlBase(g, 18, 12, 0);
      B(g, 14, 6.2, 6.0, W, 0, 0.2, -2.2); B(g, 14.3, 0.3, 6.3, PAL.cream, 0, 3.25, -2.2, NE); HIP(g, 15.2, 2.6, 7.2, R, 0, 6.4, -2.2);
      [-1, 1].forEach(sd => { B(g, 3.2, 6.2, 3.2, W, sd * 5.4, 0.2, 2.0); HIP(g, 3.9, 1.6, 3.9, R, sd * 5.4, 6.4, 2.0);   // two front wings
        vlWin(g, sd * 5.4, 1.2, 3.61); vlWin(g, sd * 5.4, 4.0, 3.61, 1.0, 1.4, true);
        P(g, 1.1, 2.1, DOORS[sd < 0 ? 0 : 1], sd * 2.6, 0.2, 0.81); ARCH(g, 1.1, DOORS[sd < 0 ? 0 : 1], sd * 2.6, 2.3, 0.81);   // ground-floor homes
        P(g, 1.0, 2.0, DOORS[sd < 0 ? 2 : 3], sd * 2.6, 3.6, 0.81); });                                       // upstairs homes, on the gallery
      B(g, 7.6, 0.25, 1.4, PAL.cream, 0, 3.35, 1.5); B(g, 7.6, 0.07, 0.07, PAL.iron, 0, 4.4, 2.18, NE); for (let x = -3.6; x <= 3.6; x += 0.6) B(g, 0.05, 0.8, 0.05, PAL.iron, x, 3.6, 2.18, NE);   // gallery
      P(g, 1.4, 2.4, '#5c4a3a', 0, 0.2, 0.81); ARCH(g, 1.4, '#5c4a3a', 0, 2.6, 0.81);                         // arched way in to the stairs
      vlWin(g, -1.2, 4.0, 0.81, 0.8, 1.3); vlWin(g, 1.2, 4.0, 0.81, 0.8, 1.3);
      B(g, 2.2, 0.15, 2.2, '#e9dcc0', 0, 0.2, 2.6, FLAT); CYL(g, 0.8, 0.9, 0.6, 12, '#d9c49a', 0, 0.2, 2.6); CYL(g, 0.6, 0.6, 0.1, 12, PAL.water, 0, 0.8, 2.6, { edge: false });   // little fountain in the courtyard
      ndTree(g, -7.7, 4.3, 'pink', 0.8); ndTree(g, 7.7, 4.3, 'pink', 0.8); ndPots(g, [[-1.5, 3.4, PAL.pink], [1.5, 3.4, PAL.purple], [-3.6, 4.4, PAL.leaf2], [3.6, 4.4, '#e2b04a']]);
      return g; } });

  // ===== NEW DISTRICT suburb homes (16 Nov, Dev's picks from the Asset Kit look): cream / yellow walls, terracotta roofs, green shutters,
  // a red porch canopy, white picket fence, blossom tree. Wall + roof are slots (each home gets a slightly different shade).
  const sbFence = (g, gateX) => { const z = 4.9; [[-5, gateX - 0.8], [gateX + 0.8, 5]].forEach(([a, b]) => { if (b - a < 0.3) return;
      B(g, b - a, 0.1, 0.08, '#ffffff', (a + b) / 2, 0.75, z, NE); B(g, b - a, 0.1, 0.08, '#ffffff', (a + b) / 2, 0.42, z, NE);
      for (let x = a + 0.2; x <= b - 0.1; x += 0.5) B(g, 0.09, 0.9, 0.09, '#ffffff', x, 0.2, z, NE); }); };
  const sbWin = (p, x, y, z, w = 1.1, h = 1.3) => { P(p, w, h, PAL.glass, x, y, z); [-1, 1].forEach(sd => P(p, w * 0.42, h, PAL.shutter, x + sd * w * 0.73, y, z + 0.01)); };
  // 9. Suburb cottage: one and a half floors, terracotta gable roof with a dormer, a porch with a red canopy, picket fence.
  def({ key: 'sbCottage', name: 'Suburb cottage', cat: 'New District', part: 2, budget: 650, size: '10 × 10 m · 1.5 floors · 1 home',
    opts: { wall: colours('Wall', ['#f3e3b5', '#f6f0e2', '#f2cfb3', '#e8d5b0']), roof: colours('Roof', ['#c8603f', '#b5543a', '#d06a45']) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', ['#f3e3b5'])), R = slot('roof', pick(o, 'roof', ['#c8603f']));
      B(g, 10, 0.2, 10, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 1.3, 0.06, 3.4, '#efe4cc', 0.6, 0.2, 3.2, FLAT); sbFence(g, 0.6);
      B(g, 7, 3.0, 5.6, W, 0, 0.2, -1.4); GABLE(g, 6.4, 3.0, 7.6, R, 0, 3.2, -1.4, { ry: Math.PI / 2 });
      B(g, 2.0, 1.5, 1.4, W, -1.6, 3.9, 0.6); GABLE(g, 2.4, 1.0, 1.7, R, -1.6, 5.4, 0.6); P(g, 1.1, 0.9, PAL.glass, -1.6, 4.2, 1.31);   // dormer
      B(g, 3.0, 0.2, 1.8, '#efe4cc', 0.6, 0.2, 2.2, NE); B(g, 3.4, 0.2, 2.0, '#c8603f', 0.6, 2.7, 2.3); [-0.7, 1.9].forEach(x => B(g, 0.15, 2.5, 0.15, '#ffffff', x, 0.2, 3.1, NE));   // porch
      P(g, 1.0, 2.0, '#47684a', 0.6, 0.4, 1.41); sbWin(g, -2.2, 1.1, 1.41); sbWin(g, 2.6, 1.1, 1.41, 0.9, 1.2);
      P(g, 0.6, 0.5, '#3a2a20', 1.6, 0.9, 2.95); ICO(g, 1.0, 0, PAL.pink, -4.0, 2.6, 3.4); CYL(g, 0.13, 0.17, 1.6, 6, PAL.wood, -4.0, 0.2, 3.4);
      B(g, 0.8, 0.9, 0.6, '#3f6f3a', 3.6, 0.2, 3.9, NE); ICO(g, 0.3, 0, PAL.pink, -0.8, 0.5, 4.3, NE); ICO(g, 0.3, 0, '#e2b04a', 2.4, 0.5, 4.3, NE);
      return g; } });
  // 10. Suburb house: two floors, terracotta hip roof, rows of shuttered windows, a red porch canopy over the door, side steps, hedge.
  def({ key: 'sbHouse', name: 'Suburb house', cat: 'New District', part: 2, budget: 750, size: '10 × 10 m · 2 floors · 1 home',
    opts: { wall: colours('Wall', ['#f3d88a', '#f3e3b5', '#f2cfb3', '#f6f0e2']), roof: colours('Roof', ['#c8603f', '#b5543a', '#d06a45']) },
    make(o) { const g = new THREE.Group(), W = slot('wall', pick(o, 'wall', ['#f3d88a'])), R = slot('roof', pick(o, 'roof', ['#c8603f']));
      B(g, 10, 0.2, 10, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 1.3, 0.06, 3.4, '#efe4cc', 0, 0.2, 3.2, FLAT); sbFence(g, 0);
      B(g, 8, 5.6, 5.4, W, 0, 0.2, -1.6); B(g, 8.3, 0.25, 5.7, PAL.cream, 0, 2.95, -1.6, NE); HIP(g, 9.0, 2.4, 6.4, R, 0, 5.8, -1.6);
      [-2.8, -1.2, 1.2, 2.8].forEach(x => sbWin(g, x, 3.5, 1.11, 0.9, 1.3)); [-2.6, 2.6].forEach(x => sbWin(g, x, 0.9, 1.11, 1.1, 1.4));
      P(g, 1.6, 2.1, '#5c4a3a', 0, 0.3, 1.11); B(g, 3.0, 0.2, 1.6, '#c8603f', 0, 2.5, 1.9); B(g, 2.8, 0.3, 1.2, '#efe4cc', 0, 0.2, 1.7, NE);
      for (let i = 0; i < 4; i++) B(g, 1.0, 0.2, 0.4, '#efe4cc', -4.6, 0.2 + i * 0.35, 0.2 - i * 0.4, NE);
      B(g, 0.8, 1.1, 3.6, '#3f6f3a', -4.4, 0.2, 2.6, NE); ICO(g, 1.1, 0, PAL.pink, -2.6, 2.7, 3.4); CYL(g, 0.13, 0.17, 1.6, 6, PAL.wood, -2.6, 0.2, 3.4);
      ICO(g, 1.1, 0, PAL.leaf2, 3.5, 2.7, 3.3); CYL(g, 0.13, 0.17, 1.6, 6, PAL.wood, 3.5, 0.2, 3.3); B(g, 1.8, 0.4, 0.6, '#7a4f34', 2.0, 0.2, 2.4, NE);
      return g; } });
  // ndFourplex roof options gain terracotta so it sits with the suburb homes

  def({ key: 'cypressTree', name: 'Cypress tree', cat: 'Street', part: 2, budget: 40, size: '7 m tall', opts: {},
    make() { const g = new THREE.Group(); CYL(g, 0.18, 0.22, 1, 5, PAL.wood, 0, 0, 0, { edge: false, open: true }); put(g, geo('cyp', () => new THREE.ConeGeometry(1, 1, 6)), PAL.cypress, 0, 4, 0, { edge: false, s: [1.1, 6, 1.1] }); return g; } });
  // Vinland Field (Dev, 15 Nov): an American retro ballpark in Vinland colours. Rectangular bowl with rounded corners, terracotta-brick walls
  // with cream stone arches, dark-green steel light towers, a giant scoreboard showing the live citizen count, a brick entrance rotunda.
  def({ key: 'vinlandField', name: 'Vinland Field', cat: 'Landmarks', part: 2, budget: 9000, size: 'about 150 × 190 m · football pitch · 40 m tall', night: true,
    opts: { seat: colours('Seats', ['#3f8a5f', PAL.terra, '#3f7fbf']), screen: { label: 'Screen', choices: ['WELCOME TO VINLAND', 'VINLAND 2 - 1'] } },
    make(o) {
      const g = new THREE.Group(), RX = 42, RZ = 60, SQ = 4;                                    // inner edge of the stands; SQ: how square the corners are
      const sgn = v => (v < 0 ? -1 : 1), E = (t, off) => { const s = Math.sin(t), c = Math.cos(t); return { x: sgn(s) * Math.pow(Math.abs(s), 2 / SQ) * (RX + off), z: sgn(c) * Math.pow(Math.abs(c), 2 / SQ) * (RZ + off) }; };
      const two = c => { const m = toon(c); m.side = THREE.DoubleSide; return m; };
      const SEAT = slot('seat', o.seat || '#3f8a5f'), SEATM = (() => { const m = SEAT.clone(); m.side = THREE.DoubleSide; m.userData.slot = 'seat'; return m; })();
      const BRICK = two('#a9513a'), BRICK2 = two('#94452f'), CREAM2 = two(PAL.cream), STONE2 = two('#e6dac2'), CANOPY = two('#efe6d4');
      const LIT = (c, n) => glowMat(c, n), GRASS = LIT('#7fb156', '#4f7a34'), GRASS2 = LIT('#6fa04a', '#456c2c'), WL = LIT(LINE, '#d8d8d0');
      const buckets = new Map(), N = 64, ring = (m, o1, y1, o2, y2) => { if (!buckets.has(m)) buckets.set(m, []); const pos = buckets.get(m);
        for (let i = 0; i < N; i++) { const t1 = i / N * Math.PI * 2, t2 = (i + 1) / N * Math.PI * 2, a1 = E(t1, o1), a2 = E(t2, o1), b1 = E(t1, o2), b2 = E(t2, o2);
          pos.push(a1.x, y1, a1.z, a2.x, y1, a2.z, b2.x, y2, b2.z, a1.x, y1, a1.z, b2.x, y2, b2.z, b1.x, y2, b1.z); } };
      ring(STONE2, 0, 0.3, 0, 2.4); ring(STONE2, 0, 2.4, 1.5, 2.4);
      ring(SEATM, 1.5, 2.4, 17, 11.5); ring(STONE2, 17, 11.5, 19, 12.2);                       // lower bowl + aisle
      ring(STONE2, 19, 12.2, 19, 15); ring(two(PAL.terra), 19, 15, 31, 25.5); ring(STONE2, 31, 25.5, 34, 26.5);   // upper deck
      ring(BRICK, 34, 0, 34, 26.5); ring(STONE2, 34, 9.8, 35, 9.8); ring(STONE2, 34, 19.6, 35, 19.6); ring(CREAM2, 34, 26.5, 35.2, 26.5); ring(CREAM2, 35.2, 26.5, 35.2, 28.2);   // brick wall, cream cornices + parapet
      ring(CANOPY, 22, 33, 34, 29.5); ring(CANOPY, 22, 33, 22, 32.4);                          // green steel shade canopy over the upper deck (classic ballpark)
      buckets.forEach((pos, m) => { const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.computeVertexNormals();
        const me = new THREE.Mesh(ge, m); me.castShadow = m === BRICK || m === CANOPY; me.receiveShadow = true; g.add(me); });
      // cream stone arches on the brick wall (ground floor) and tall arched windows above
      const ARCHM = glowMat('#5e3f2c', '#e0a050'), NF = 44;
      for (let i = 0; i < NF; i++) { const t1 = i / NF * Math.PI * 2, t2 = (i + 1) / NF * Math.PI * 2, a = E(t1, 34), b = E(t2, 34), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        const tm = (t1 + t2) / 2; if (Math.abs(Math.atan2(Math.sin(tm), Math.cos(tm))) < 0.16) continue;   // the rotunda sits on the front
        let nx = b.z - a.z, nz = -(b.x - a.x); if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; } const L = Math.hypot(nx, nz), ry = Math.atan2(nx, nz), w = Math.hypot(b.x - a.x, b.z - a.z);
        const f = grp(g, mx + nx / L * 0.08, 0, mz + nz / L * 0.08, ry);
        P(f, Math.min(6.4, w * 0.62) + 1.2, 7.4, '#efe3c8', 0, 0, -0.02, { edge: true }); ARCH(f, Math.min(6.4, w * 0.62) + 1.2, '#efe3c8', 0, 7.4, -0.02);
        P(f, Math.min(6.4, w * 0.62), 6.8, ARCHM, 0, 0.2, 0); ARCH(f, Math.min(6.4, w * 0.62), ARCHM, 0, 7, 0);
        if (i % 2 === 0) win(f, 0, 14.2, 0, 0, 2.6, 4.4, { shutters: false });
      }
      // light towers: dark-green steel masts with big light banks (4 corners + 2 on the long sides), they blaze at night
      const FL = glowMat('#f4f1e8', '#ffffff'), STEEL = '#2f4a3c';
      [[Math.PI / 4, 46], [3 * Math.PI / 4, 46], [-Math.PI / 4, 46], [-3 * Math.PI / 4, 46], [Math.PI / 2, 38], [-Math.PI / 2, 38]].forEach(([t, off]) => { const p = E(t, off), s = grp(g, p.x, 0, p.z, Math.atan2(-p.x, -p.z));   // +z faces the field
        B(s, 2.2, 52, 2.2, STEEL, 0, 0, 0, NE); [-1.4, 1.4].forEach(x => B(s, 0.4, 52, 0.4, STEEL, x, 0, -1.2, NE));
        B(s, 14, 7, 1.2, STEEL, 0, 52, 0.6); P(s, 13, 6.2, FL, 0, 52.4, 1.25, { rx: -0.25 });
        B(s, 0.2, 7, 0.2, '#c9ced2', 0, 59, 0, NE); B(s, 3.6, 2.2, 0.06, PAL.terra, 1.9, 63.6, 0, FLAT); });   // Vinland flag on top
      // flags round the top of the wall
      for (let i = 0; i < 24; i++) { const t = (i + 0.5) / 24 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(t), Math.cos(t))) < 0.3) continue; const p = E(t, 34.6);
        B(g, 0.15, 4.5, 0.15, '#c9ced2', p.x, 28.2, p.z, NE); B(g, 1.8, 1.1, 0.05, i % 2 ? PAL.terra : '#e2b04a', p.x + 0.9, 31.4, p.z, FLAT); }
      // the giant scoreboard behind the far end (live citizen count is drawn on the map side; here a welcome)
      { const p = E(Math.PI, 30), s = grp(g, 0, 26, p.z - 2, 0);
        B(s, 4, 22, 4, STEEL, -20, -26, -2, NE); B(s, 4, 22, 4, STEEL, 20, -26, -2, NE);
        B(s, 48, 20, 3, '#1f2a24', 0, 0, -2); P(s, 45, 15, textMat(o.screen || 'WELCOME TO VINLAND', '#14233f', '#ffcf6a'), 0, 3.6, -0.45);
        B(s, 48, 3, 3, PAL.cream, 0, -3, -2); P(s, 30, 2.2, textMat('VINLAND FIELD', '#2f2b28', '#f6d27a'), 0, -2.6, -0.45); }
      // entrance rotunda (front, +z): a round brick hall with cream arches, a green dome, the big sign
      { const p = E(0, 34), s = grp(g, 0, 0, p.z + 4, 0);
        CYL(s, 15, 15, 24, 20, '#a9513a', 0, 0, 0); CYL(s, 15.6, 15.6, 1.2, 20, PAL.cream, 0, 24, 0); CYL(s, 15.6, 15.6, 0.8, 20, '#e6dac2', 0, 10, 0);
        put(s, geo('dome', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), '#4f9a86', 0, 25, 0, { s: [13.5, 7, 13.5] });
        for (let k = -3; k <= 3; k++) { const a = k * 0.36, f = grp(s, Math.sin(a) * 15.1, 0, Math.cos(a) * 15.1, a);
          P(f, 4.4, 8.2, '#efe3c8', 0, 0, -0.02, { edge: true }); ARCH(f, 4.4, '#efe3c8', 0, 8.2, -0.02); P(f, 3.6, 7.6, ARCHM, 0, 0.2, 0); ARCH(f, 3.6, ARCHM, 0, 7.8, 0); win(f, 0, 14.5, 0, 0, 2.2, 4, { shutters: false }); }
        B(s, 30, 4.4, 0.6, '#2f2b28', 0, 18.2, 15.2); P(s, 29, 3.6, textMat('VINLAND FIELD', '#2f2b28', '#f6d27a'), 0, 18.6, 15.55);
        B(s, 40, 0.12, 14, '#e6dccb', 0, 0, 20, { shadow: false }); }
      // seats spell VINLAND on the long side opposite the scoreboard view
      [1, -1].forEach(sd => { const a = E(sd * Math.PI / 2, 1.5), b = E(sd * Math.PI / 2, 17), ang = Math.atan2(11.5 - 2.4, Math.abs(b.x - a.x)), s = grp(g, (a.x + b.x) / 2 - sd * 0.4, (2.4 + 11.5) / 2 + 0.3, 0, -sd * Math.PI / 2);
        P(s, 84, 12, textMat('VINLAND', '#3f8a5f', '#f6f0e2'), 0, -6, 0, { rx: -(Math.PI / 2 - ang) }); });
      // ground + field
      put(g, geo('pad', () => new THREE.PlaneGeometry(1, 1)), '#d8d2c6', 0, 0.02, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [2 * (RX + 44), 2 * (RZ + 40), 1] }));
      flat2(g, 2 * RX, 2 * RZ, GRASS, 0, 0.3, 0);
      const W = 68, Lp = 105; for (let i = 0; i < 10; i++) flat2(g, W, Lp / 10, i % 2 ? GRASS2 : GRASS, 0, 0.34, -Lp / 2 + Lp / 10 * (i + 0.5));
      [[W, 0.15, 0, Lp / 2], [W, 0.15, 0, -Lp / 2], [0.15, Lp, W / 2, 0], [0.15, Lp, -W / 2, 0], [W, 0.15, 0, 0]].forEach(([w, d, x, z]) => flat2(g, w, d, WL, x, 0.38, z));
      put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), WL, 0, 0.38, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [9.15, 9.15, 1] }));
      [-1, 1].forEach(sd => { const z = sd * Lp / 2; [[40.3, 0.15, 0, z - sd * 16.5], [0.15, 16.5, 20.15, z - sd * 8.25], [0.15, 16.5, -20.15, z - sd * 8.25]].forEach(([w, d, x, zz]) => flat2(g, w, d, WL, x, 0.38, zz));
        [-3.66, 3.66].forEach(x => B(g, 0.15, 2.44, 0.15, '#ffffff', x, 0.3, z, NE)); B(g, 7.47, 0.15, 0.15, '#ffffff', 0, 2.74, z, NE); });
      return g; } });
  def({ key: 'stadium', name: 'Vinland Stadium', cat: 'Landmarks', part: 2, budget: 12000, size: 'about 250 × 270 m · field 116 × 144 m · 48 m tall', night: true,
    opts: { mode: choices('Mode', ['football', 'cricket', 'concert']), seat: colours('Seats', [PAL.terra, '#2f7a68', '#3f7fbf', '#c9922e']) },
    make(o) {
      const g = new THREE.Group(), mode = o.mode || 'football', SEAT = slot('seat', o.seat || PAL.terra);
      const RX = 58, RZ = 72, E = (t, off) => ({ x: Math.sin(t) * (RX + off), z: Math.cos(t) * (RZ + off) });
      const LIT = (c, n) => glowMat(c, n), GRASS = LIT('#7fb156', '#4f7a34'), GRASS2 = LIT('#6fa04a', '#456c2c'), WL = LIT(LINE, '#d8d8d0');   // under the floodlights the field glows at night
      const two = c => { const m = toon(c); m.side = THREE.DoubleSide; return m; };
      const SEATM = (() => { const m = SEAT.clone(); m.side = THREE.DoubleSide; m.userData.slot = 'seat'; return m; })();
      const CREAM2 = two(PAL.cream), STONE2 = two('#e6dac2'), ROOF1 = two(PAL.terra), ROOF2 = two(PAL.terra2);
      // swept rings round the oval (stands, roof, cornices): one merged mesh per colour
      const buckets = new Map(), ring = (m, o1, y1, o2, y2, N) => { if (!buckets.has(m)) buckets.set(m, []); const pos = buckets.get(m);
        for (let i = 0; i < N; i++) { const t1 = i / N * Math.PI * 2, t2 = (i + 1) / N * Math.PI * 2, a1 = E(t1, o1), a2 = E(t2, o1), b1 = E(t1, o2), b2 = E(t2, o2);
          pos.push(a1.x, y1, a1.z, a2.x, y1, a2.z, b2.x, y2, b2.z, a1.x, y1, a1.z, b2.x, y2, b2.z, b1.x, y2, b1.z); } };
      const NB = 32;                                                                                 // stands: calm two-tone, seat colour + cream walkways
      ring(CREAM2, 0, 0.3, 0, 3, NB); ring(CREAM2, 0, 3, 1.5, 3, NB);
      ring(SEATM, 1.5, 3, 20, 13.8, NB); ring(CREAM2, 20, 13.8, 22, 15, NB);                         // lower tier + walkway
      ring(STONE2, 22, 15, 25, 15, NB); ring(CREAM2, 25, 15, 25, 20, NB); ring(CREAM2, 25, 20, 26.5, 20, NB);   // concourse + front wall of the upper tier
      ring(SEATM, 26.5, 20, 41, 35.6, NB); ring(CREAM2, 41, 35.6, 46, 38.5, NB);                     // upper tier + top walkway
      // the arena wall outside, with two cornice bands
      const NF = 40; ring(CREAM2, 46, 0, 46, 38.5, NF); ring(STONE2, 46, 13.5, 47, 13.5, NF); ring(STONE2, 46, 27, 47, 27, NF);
      // the roof: sloped terracotta tiles round the top, high over the stands, low at the outer wall (two-tone rows)
      ring(ROOF1, 27, 45, 34, 43.4, NB); ring(ROOF2, 34, 43.4, 40, 41.9, NB); ring(ROOF1, 40, 41.9, 48, 39.6, NB);
      ring(CREAM2, 27, 45, 27, 43.8, NB);                                                             // cream fascia under the roof edge
      buckets.forEach((pos, m) => { const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.computeVertexNormals();
        const me = new THREE.Mesh(ge, m); me.castShadow = m === ROOF1 || m === ROOF2; me.receiveShadow = true; g.add(me); });
      // ring of arches (ground floor) and shuttered windows above, on each of the 40 wall faces (the front one is the main gate)
      const ARCHM = glowMat('#8a6a4c', '#e0a050');                                                    // arch openings glow warm at night
      for (let i = 0; i < NF; i++) { const t1 = i / NF * Math.PI * 2, t2 = (i + 1) / NF * Math.PI * 2, a = E(t1, 46), b = E(t2, 46), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        let nx = b.z - a.z, nz = -(b.x - a.x); if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; } const ry = Math.atan2(nx, nz), L = Math.hypot(nx, nz), ox = nx / L * 0.06, oz = nz / L * 0.06;
        const tm = (t1 + t2) / 2; if (Math.abs(Math.atan2(Math.sin(tm), Math.cos(tm))) < 0.12) continue;   // the main gate sits on the front face
        const f = grp(g, mx + ox, 0, mz + oz, ry);
        P(f, 7, 8.2, ARCHM, 0, 0.2, 0); ARCH(f, 7, ARCHM, 0, 8.4, 0);                                // arch
        win(f, 0, 17.4, 0, 0, 2.6, 4.2);                                                              // shuttered window (same as the houses)
        if (i % 2) win(f, 0, 30.2, 0, 0, 2, 3.2, { shutters: false });                                 // small top windows on every other face
      }
      // 4 corner towers: cream, terracotta hip roof, floodlights on top, a Vinland flag
      const FL = glowMat('#f4f1e8', '#ffffff');
      [Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4, -3 * Math.PI / 4].forEach(t => { const p = E(t, 50), s = grp(g, p.x, 0, p.z, t + Math.PI);   // local +z faces the field
        B(s, 10, 60, 10, PAL.cream, 0, 0, 0); B(s, 11, 1, 11, '#e6dac2', 0, 60, 0, NE);
        win(s, 0, 44, -5.02, Math.PI, 2.4, 3.6); win(s, 0, 20, -5.02, Math.PI, 2.4, 3.6, { shutters: false });                                                    // a shuttered window on the outside
        HIP(s, 12.4, 5, 12.4, PAL.terra, 0, 61, 0);
        [-4.5, 4.5].forEach(x => B(s, 0.5, 6, 0.5, PAL.iron, x, 63, 3, NE)); B(s, 13, 5, 1, PAL.iron, 0, 68, 3.4, NE); P(s, 12, 4.2, FL, 0, 68.4, 3.95, { rx: -0.3 });   // floodlights
        B(s, 0.25, 12, 0.25, '#c9ced2', 0, 66, -3, NE); B(s, 4.4, 2.6, 0.06, PAL.terra, 2.3, 74.6, -3, FLAT); oct(s, 0.35, '#e2b04a', 0, 78.3, -3); });   // Vinland flag
      // main gate (front, +z): one big arch with the sign, and a small plaza in front
      { const p = E(0, 46), s = grp(g, 0, 0, p.z, 0);
        B(s, 34, 31, 7, PAL.cream, 0, 0, 1.5); B(s, 36, 1.2, 8, '#e6dac2', 0, 31, 1.5, NE);
        GABLE(s, 22, 6, 8.4, PAL.terra, 0, 32.2, 1.5);                                                // terracotta pediment roof
        P(s, 14, 12, ARCHM, 0, 0.2, 5.06); ARCH(s, 14, ARCHM, 0, 12.2, 5.06);                          // the big arch
        P(s, 15.4, 13, '#e6dac2', 0, 0, 5.03, { edge: true }); ARCH(s, 16, '#e6dac2', 0, 12.6, 5.03);   // arch surround
        [-12, 12].forEach(x => win(s, x, 15, 5.06, 0, 3, 4.6));                                     // shuttered windows either side
        B(s, 26, 4, 0.5, '#2f2b28', 0, 23.4, 5.1); P(s, 25, 3.2, textMat('VINLAND STADIUM', '#2f2b28', '#f6d27a'), 0, 23.8, 5.37);   // the sign (Vinland sign style)
        // plaza: paving, pink trees, street lamps, benches
        B(s, 46, 0.12, 10, '#e6dccb', 0, 0, 10, { shadow: false });
        const LAMP = glowMat(PAL.lampOn, '#ffd98a');
        [-19, 19].forEach(x => { CYL(s, 0.28, 0.36, 2.6, 6, PAL.wood, x, 0.1, 11, { edge: false, open: true }); ICO(s, 2.6, 0, PAL.pink, x, 4.4, 11); });   // pink trees
        [-9, 9].forEach(x => { B(s, 0.2, 4.4, 0.2, PAL.iron, x, 0.1, 15.5, NE); B(s, 0.9, 0.12, 0.12, PAL.iron, x, 4.4, 15.5, NE); oct(s, 0.32, LAMP, x, 4.15, 15.5, { s: [0.3, 0.32, 0.3] }); });   // street lamps
        [-13.5, 13.5].forEach(x => { B(s, 3, 0.45, 0.8, PAL.wood, x, 0.1, 14.4, NE); B(s, 3, 0.6, 0.12, PAL.wood, x, 0.55, 14.8, NE); });   // benches
      }
      // ground round the outside (same oval as before, so the footprint does not change)
      put(g, geo('oval', () => new THREE.CircleGeometry(1, 32)), '#d8d2c6', 0, 0.02, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [RX + 62, RZ + 62, 1] }));
      // big screens at both ends (cream frames, on top of the upper tier, facing the field). One sign material for both.
      const screenText = { football: 'VINLAND  2 - 1', cricket: 'VINLAND  186 / 4', concert: 'LIVE IN VINLAND' }[mode], SCR = textMat(screenText, '#14233f', '#ffcf6a');
      [0, Math.PI].forEach(t => { const p = E(t, 39), s = grp(g, p.x, 36.5, p.z, t + Math.PI);
        B(s, 34, 13, 2, PAL.cream, 0, 0, -1); P(s, 32, 11, SCR, 0, 1, 0.02); HIP(s, 35, 2.4, 3, PAL.terra, 0, 13, -1); });
      // the field: one oval of grass
      put(g, geo('oval', () => new THREE.CircleGeometry(1, 32)), GRASS, 0, 0.3, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [RX, RZ, 1] }));
      if (mode === 'football') {
        const W = 68, L = 105;
        for (let i = 0; i < 10; i++) flat2(g, W, L / 10, i % 2 ? GRASS2 : GRASS, 0, 0.34, -L / 2 + L / 10 * (i + 0.5));
        [[W, 0.15, 0, L / 2], [W, 0.15, 0, -L / 2], [0.15, L, W / 2, 0], [0.15, L, -W / 2, 0], [W, 0.15, 0, 0]].forEach(([w, d, x, z]) => flat2(g, w, d, WL, x, 0.38, z));
        put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), WL, 0, 0.38, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [9.15, 9.15, 1] }));
        [-1, 1].forEach(s => { const z = s * L / 2;
          [[40.3, 0.15, 0, z - s * 16.5], [0.15, 16.5, 20.15, z - s * 8.25], [0.15, 16.5, -20.15, z - s * 8.25], [18.3, 0.15, 0, z - s * 5.5], [0.15, 5.5, 9.15, z - s * 2.75], [0.15, 5.5, -9.15, z - s * 2.75]].forEach(([w, d, x, zz]) => flat2(g, w, d, WL, x, 0.38, zz));
          [-3.66, 3.66].forEach(x => B(g, 0.15, 2.44, 0.15, '#ffffff', x, 0.3, z, NE)); B(g, 7.47, 0.15, 0.15, '#ffffff', 0, 2.74, z, NE);
          P(g, 7.3, 2.4, '#e9eef0', 0, 0.3, z + s * 1.5, { ry: s > 0 ? Math.PI : 0, edge: true }); });
      }
      if (mode === 'cricket') {
        put(g, geo('oval', () => new THREE.CircleGeometry(1, 32)), GRASS2, 0, 0.34, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [28, 30, 1] }));   // inner circle
        put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), WL, 0, 0.38, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [RX - 4, RZ - 4, 1] }));   // boundary rope
        flat2(g, 3, 20.1, LIT('#d9c49a', '#8a7a58'), 0, 0.38, 0);
        [-1, 1].forEach(s => { flat2(g, 3.6, 0.1, WL, 0, 0.42, s * 8.8); flat2(g, 2.6, 0.1, WL, 0, 0.42, s * 10.05);
          [-0.11, 0, 0.11].forEach(x => B(g, 0.05, 0.72, 0.05, '#f2e7cf', x, 0.38, s * 10.05, FLAT)); B(g, 0.26, 0.03, 0.03, '#c9922e', 0, 1.1, s * 10.05, FLAT);
          B(g, 14, 7, 0.5, '#f6f3ea', 0, 0.3, s * (RZ - 2)); });                                    // sight screens
      }
      if (mode === 'concert') {
        const zs = RZ - 14;
        const BEAM = c => { const k = 'beam' + c; if (!mats[k]) { const m = new THREE.MeshToonMaterial({ color: '#000000', gradientMap: grad, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
          m.userData.glow = c; mats[k] = m; } return mats[k]; };                                       // black by day (adds nothing), glows its colour at night
        B(g, 46, 2.6, 16, '#2f2b28', 0, 0.3, zs);                                                    // stage
        B(g, 12, 1.4, 22, '#2f2b28', 0, 0.3, zs - 18);                                               // catwalk into the crowd
        [-22, 22].forEach(x => { B(g, 1.2, 22, 1.2, '#55504a', x, 2.9, zs + 6, NE); B(g, 5, 9, 4, PAL.iron, x + Math.sign(x) * 5, 0.3, zs - 2); });   // truss legs + speaker stacks
        B(g, 46, 1.4, 1.4, '#55504a', 0, 24.9, zs + 6, NE); B(g, 46, 1.2, 1.2, '#55504a', 0, 22, zs - 4, NE);
        B(g, 30, 14, 1, PAL.iron, 0, 6.5, zs + 7.4); P(g, 28, 12, textMat('VINLAND', '#3a1f5a', '#f6d27a'), 0, 7.5, zs + 6.85, { ry: Math.PI });   // stage screen faces the crowd
        const STG = ['#e8473a', '#3f7fbf', '#a084c8', '#f2c14e', '#5fbf6a', '#d88fb0'];
        for (let i = 0; i < 12; i++) { const x = -19 + i * 3.45, c = STG[i % STG.length];
          B(g, 1.2, 0.8, 1.2, glowMat(c, c), x, 21.2, zs - 4, NE);                                   // stage lights on the front truss
          put(g, geo('beam', () => { const ge = new THREE.ConeGeometry(1, 1, 8, 1, true); ge.translate(0, -0.5, 0); return ge; }), BEAM(c), x, 21.2, zs - 4, { edge: false, shadow: false, s: [5, 26, 5], rx: -0.5 + (i % 3) * 0.15, rz: (i - 5.5) * 0.06 }); }
        // the crowd on the field: 560 people, merged into one mesh per shirt colour (no instancing, so the map can squash the whole stadium)
        const COLS = ['#c8603f', '#3f7fbf', '#2f7a68', '#f2c14e', '#f6f0e2', '#6a4a8c', '#d88fb0', '#2f2b28'], per = COLS.map(() => []);
        const pg = new THREE.OctahedronGeometry(1, 0); pg.scale(0.35, 0.9, 0.3); pg.translate(0, 1.2, 0); const base = pg.attributes.position.array;
        let seed = 11, n = 0; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let tries = 0; n < 560 && tries < 5000; tries++) { const x = (rnd() * 2 - 1) * (RX - 6), z = -RZ + 10 + rnd() * (zs - 8 + RZ - 10);
          if ((x * x) / ((RX - 6) * (RX - 6)) + (z * z) / ((RZ - 6) * (RZ - 6)) > 1 || (Math.abs(x) < 8 && z > zs - 30)) continue;
          const arr = per[n % COLS.length]; for (let k = 0; k < base.length; k += 3) arr.push(base[k] + x, base[k + 1], base[k + 2] + z); n++; }
        per.forEach((arr, i) => { const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); ge.computeVertexNormals();
          const me = new THREE.Mesh(ge, mat(COLS[i])); me.receiveShadow = true; g.add(me); });
      }
      return g;
    } });

  // ================= DOWNTOWN (Dev, 13 Nov) =================
  // Office towers, glass HQ, business lot sign, construction site kit, city centre pieces, transport hub.
  // Kit only: nothing goes on the map until it is placed in a build step. No brand names anywhere.

  // window grid for glass walls: day = pale grid (tinted by the glass colour), night = random lit windows.
  // cols x rows windows on one face. Textures are drawn once per size and reused.
  const winTex = {};
  function officeTex(cols, rows) {
    const key = cols + 'x' + rows; if (winTex[key] || typeof document === 'undefined') return winTex[key] || null;
    let seed = 13 + cols * 7 + rows; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const mk = draw => { const c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d'));
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(cols / 8, rows / 8); return t; };
    const day = mk(x => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j * 3) % 5 ? '#dfe8ee' : '#eef4f8'; x.fillRect(i * 32 + 3, j * 32 + 5, 26, 24); } });
    const night = mk(x => { x.fillStyle = '#000000'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const r = rnd(); if (r < 0.55) { x.fillStyle = r < 0.1 ? '#ffffff' : r < 0.38 ? '#ffe2a8' : '#cfe0ff'; x.fillRect(i * 32 + 4, j * 32 + 6, 24, 22); } } });
    return (winTex[key] = { day, night });
  }
  function glassWall(colour, cols, rows) {                              // a glass curtain wall material (slot 'glass')
    const m = slot('glass', colour), t = officeTex(Math.max(1, Math.round(cols)), Math.max(1, Math.round(rows)));
    if (t) { m.map = t.day; m.emissiveMap = t.night; } m.userData.glow = '#ffffff'; return m;
  }
  const STONES = ['#e9e3d6', '#f6f0e2', '#d9cfbd', '#c9ced2'], GLASSES = ['#8fb8cc', '#9cc7b8', '#b8c2cc', '#c9b08a'];
  const PAVE = '#ddd6c8', PAVE2 = '#cfc6b4';
  const strut = (g, a, b, t, m) => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), me = put(g, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { s: [t, d.length(), t], edge: false, shadow: false });
    me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return me; };   // a thin bar from point a to point b
  // live text: a sign whose words can change later. Returns { mat, set(text) }.
  function liveText(wpx, hpx, draw) {
    if (typeof document === 'undefined') { const m = mat('#14233f'); return { mat: m, set() {} }; }
    const c = document.createElement('canvas'); c.width = wpx; c.height = hpx; const x = c.getContext('2d'), t = new THREE.CanvasTexture(c);
    const m = toon('#ffffff'); m.map = t; m.emissiveMap = t; m.userData.glow = '#c8c8c8';
    return { mat: m, set(...a) { x.clearRect(0, 0, wpx, hpx); draw(x, wpx, hpx, ...a); t.needsUpdate = true; } };
  }
  const fitFont = (x, text, maxW, size, weight) => { const f = s => `${weight || 700} ${s}px Poppins, 'Segoe UI', sans-serif`; x.font = f(size); while (x.measureText(text).width > maxW && size > 10) x.font = f(size -= 2); return size; };

  // ---- 1. office towers (3 heights) ----
  function officeTower(o, floors, W, D, top, setback) {
    const g = new THREE.Group(), S = slot('wall', o.wall || STONES[0]), gc = o.glass || GLASSES[0], FH = 3.6, H = floors * FH, base = 0.2;
    const WARM = glowMat(PAL.glassWarm, '#ffcf6a');
    B(g, W + 12, 0.2, D + 12, PAVE, 0, 0, 0, { shadow: false });                                 // plaza pad
    const body = (w, d, y0, fl) => {                                                               // a block of floors: stone core, glass on 4 sides, corner piers, bands
      const h = fl * FH; B(g, w - 0.8, h, d - 0.8, S, 0, y0, 0, { edge: false });
      [[w, d, 0], [d, w, Math.PI / 2], [w, d, Math.PI], [d, w, -Math.PI / 2]].forEach(([fw, fd, ry]) => { const s = grp(g, 0, 0, 0, ry);
        P(s, fw - 1.4, h - 0.2, glassWall(gc, (fw - 1.4) / 3.2, fl), 0, y0 + 0.1, fd / 2 + 0.02);
        const n = Math.max(1, Math.round(fw / 8)); for (let i = 1; i < n; i++) B(s, 0.45, h, 0.5, S, -fw / 2 + i * fw / n, y0, fd / 2 - 0.1, { edge: false }); });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => B(g, 1.2, h, 1.2, S, sx * (w / 2 - 0.5), y0, sz * (d / 2 - 0.5)));
      for (let f = 4; f < fl; f += 4) B(g, w + 0.3, 0.45, d + 0.3, S, 0, y0 + f * FH - 0.22, 0, NE);
      B(g, w + 0.5, 0.7, d + 0.5, S, 0, y0 + h, 0);
    };
    // lobby: 2 tall floors of warm glass with a stone canopy over the door
    B(g, W - 1, 2 * FH, D - 1, S, 0, base, 0, { edge: false });
    [[W, D, 0], [D, W, Math.PI / 2], [W, D, Math.PI], [D, W, -Math.PI / 2]].forEach(([fw, fd, ry]) => { const s = grp(g, 0, 0, 0, ry); P(s, fw - 2.4, 2 * FH - 0.6, WARM, 0, base + 0.2, fd / 2 - 0.48); });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => B(g, 1.2, 2 * FH, 1.2, S, sx * (W / 2 - 0.5), base, sz * (D / 2 - 0.5)));
    B(g, 10, 0.5, 4, S, 0, base + 4.2, D / 2 + 1.6); P(g, 3, 3, PAL.iron, 0, base, D / 2 - 0.46);
    const upper = setback ? floors - 2 - setback : floors - 2;
    body(W, D, base + 2 * FH, upper);
    let yTop = base + 2 * FH + upper * FH + 0.7, tw = W, td = D;
    if (setback) { tw = W * 0.72; td = D * 0.72; body(tw, td, yTop, setback); yTop += setback * FH + 0.7; }
    // roof
    if (top === 'plant') { B(g, tw * 0.4, 2.6, td * 0.35, '#b9b2a4', -tw * 0.15, yTop, -td * 0.1); CYL(g, 1.6, 1.6, 3, 8, '#9aa3a8', tw * 0.25, yTop, td * 0.2); B(g, 3, 1.2, 3, '#9aa3a8', tw * 0.25, yTop, -td * 0.25, NE); }
    if (top === 'helipad') { CYL(g, tw * 0.38, tw * 0.38, 0.3, 16, '#3a3f45', 0, yTop, 0); put(g, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), '#f2c53d', 0, yTop + 0.32, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [tw * 0.3, tw * 0.3, 1] }));
      [[-1.2, 0, 0.5, 5], [1.2, 0, 0.5, 5], [0, 0, 2.4, 0.5]].forEach(([x, z, w, d]) => flat2(g, w, d, '#f6f3ea', x, yTop + 0.33, z));
      [0, 1, 2, 3].forEach(i => BALL(g, 0.25, glowMat('#e8473a', '#ff3a20'), Math.cos(i * Math.PI / 2) * tw * 0.38, yTop + 0.5, Math.sin(i * Math.PI / 2) * tw * 0.38, NE)); }
    if (top === 'crown') { B(g, tw * 0.6, 3, td * 0.6, S, 0, yTop, 0); B(g, tw * 0.35, 3, td * 0.35, S, 0, yTop + 3, 0);
      CYL(g, 0.15, 0.4, 14, 6, '#c9ced2', 0, yTop + 6, 0, NE); BALL(g, 0.45, glowMat('#e8473a', '#ff3a20'), 0, yTop + 20.2, 0, NE); }
    return g;
  }
  const officeOpts = { wall: colours('Stone', STONES), glass: colours('Glass', GLASSES) };
  def({ key: 'officeMid', name: 'Office (mid-rise)', cat: 'Downtown', part: 2, budget: 600, size: '26 \u00d7 22 m \u00b7 8 floors \u00b7 30 m', night: true, opts: officeOpts, make: o => officeTower(o, 8, 26, 22, 'plant') });
  def({ key: 'officeTall', name: 'Office (tall)', cat: 'Downtown', part: 2, budget: 1000, size: '26 \u00d7 26 m \u00b7 14 floors \u00b7 52 m', night: true, opts: officeOpts, make: o => officeTower(o, 14, 26, 26, 'helipad', 4) });
  def({ key: 'officeSlim', name: 'Office (slim tower)', cat: 'Downtown', part: 2, budget: 800, size: '18 \u00d7 18 m \u00b7 20 floors \u00b7 92 m', night: true, opts: officeOpts, make: o => officeTower(o, 20, 18, 18, 'crown', 5) });

  // ---- 2. glass HQ: wide low-rise headquarters, plaza entrance, blank sign slot (o.sign) ----
  def({ key: 'glassHQ', name: 'Glass HQ', cat: 'Downtown', part: 2, budget: 1400, size: '70 \u00d7 60 m lot \u00b7 4 floors \u00b7 18 m', night: true, opts: officeOpts,
    make(o) {
      const g = new THREE.Group(), S = slot('wall', o.wall || STONES[1]), gc = o.glass || GLASSES[0], W = 64, D = 30, FH = 4, fl = 4, H = fl * FH, z0 = -12;
      B(g, 70, 0.2, 60, PAVE, 0, 0, 0, { shadow: false });
      for (let i = 0; i < 6; i++) flat2(g, 10.5, 24, i % 2 ? PAVE2 : PAVE, -26.25 + i * 10.5, 0.22, 16);                  // plaza paving
      B(g, W, H, D, S, 0, 0.2, z0, { edge: false });
      [[W, D, 0], [D, W, Math.PI / 2], [W, D, Math.PI], [D, W, -Math.PI / 2]].forEach(([fw, fd, ry], k) => { const s = grp(g, 0, 0, z0, ry);
        P(s, fw - 1, H - 0.4, glassWall(gc, (fw - 1) / 3.2, fl), 0, 0.4, fd / 2 + 0.02);
        for (let i = 1; i < Math.round(fw / 8); i++) B(s, 0.35, H, 0.4, S, -fw / 2 + i * fw / Math.round(fw / 8), 0.2, fd / 2 - 0.1, { edge: false }); });
      for (let f = 1; f < fl; f++) B(g, W + 0.6, 0.35, D + 0.6, S, 0, 0.2 + f * FH - 0.17, z0, NE);
      B(g, W + 3, 1, D + 3, S, 0, 0.2 + H, z0);                                                       // roof slab with an overhang
      B(g, 20, 2.2, 8, '#b9b2a4', -14, 1.2 + H, z0 - 4); B(g, 10, 1.6, 6, '#b9b2a4', 16, 1.2 + H, z0 + 3, NE);
      B(g, 26, 0.8, 9, S, 0, 6.4, z0 + D / 2 + 4.5); [-11, 11].forEach(x => B(g, 0.6, 6.2, 0.6, S, x, 0.2, z0 + D / 2 + 8.4, NE));   // entrance canopy
      B(g, 24, 3, 0.5, '#2f2b28', 0, 7.2, z0 + D / 2 + 8.9);                                          // the sign board (text later)
      if (o.sign) P(g, 23, 2.4, textMat(o.sign.toUpperCase(), '#2f2b28', '#f6d27a'), 0, 7.5, z0 + D / 2 + 9.16);
      P(g, 10, 4.6, glowMat(PAL.glassWarm, '#ffcf6a'), 0, 0.2, z0 + D / 2 + 0.06);                   // doors
      [-22, -14, 14, 22].forEach(x => { B(g, 3.6, 0.8, 3.6, PAVE2, x, 0.2, 10); tree(g, x, 1.0, 10, 'canopy', 0.7); });   // planters
      [-4, 0, 4].forEach(x => { CYL(g, 0.08, 0.1, 10, 6, '#c9ced2', x, 0.2, 26, { edge: false, open: true }); B(g, 2.2, 1.4, 0.04, x ? '#2f7a68' : PAL.terra, x + 1.15, 8.6, 26, FLAT); });   // flags
      CYL(g, 4.2, 4.4, 0.6, 16, PAVE2, 0, 0.2, 18, { open: true }); CYL(g, 4.1, 4.1, 0.4, 16, glowMat(PAL.water, '#3f8fb0'), 0, 0.2, 18, NE);   // low pool
      return g;
    } });

  // a sign that wraps its words onto up to 3 lines (lot sign)
  function drawSign(x, w, h, text) {
    x.fillStyle = '#14233f'; x.fillRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#f6d27a';
    const words = String(text || '').split(/\s+/), lines = []; let cur = ''; x.font = `700 84px Poppins, 'Segoe UI', sans-serif`;
    words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (x.measureText(t).width > w - 60 && cur) { lines.push(cur); cur = wd; } else cur = t; }); if (cur) lines.push(cur);
    const L = lines.slice(0, 3), size = Math.min(84, Math.floor((h - 40) / L.length * 0.8)); L.forEach((ln, i) => { fitFont(x, ln, w - 60, size); x.fillText(ln, w / 2, h / 2 + (i - (L.length - 1) / 2) * size * 1.15); });
  }
  // ---- 3. business lot sign: board on posts with a text slot (o.text; change later with g.userData.setText) ----
  def({ key: 'lotSign', name: 'Business lot sign', cat: 'Downtown', part: 2, budget: 100, size: '4.4 m wide', night: true, opts: {},
    make(o) { const g = new THREE.Group(), lt = liveText(820, 340, drawSign); lt.set(o.text || 'RESERVED FOR \u2026');
      [-1.8, 1.8].forEach(x => B(g, 0.2, 3.4, 0.2, PAL.wood, x, 0, -0.18, NE));
      B(g, 4.4, 2, 0.16, '#f6f0e2', 0, 1.5, 0); P(g, 4.1, 1.7, lt.mat, 0, 1.65, 0.09); g.userData.setText = t => lt.set(t);
      B(g, 4.4, 0.2, 0.4, PAL.wood, 0, 3.5, 0.05, NE); [-1.2, 1.2].forEach(x => B(g, 0.4, 0.12, 0.3, glowMat(PAL.lampOn, '#ffd98a'), x, 3.42, 0.35, NE));
      return g; } });

  // ---- 4. construction site kit ----
  const HOARD = '#2f7a68';
  def({ key: 'sitePanel', name: 'Site fence panel', cat: 'Construction', part: 2, budget: 50, size: '4 m panel', opts: { text: { label: 'Banner', choices: ['VINLAND', 'COMING SOON', 'BUILDING VINLAND'] } },
    make(o) { const g = new THREE.Group(); B(g, 4, 2.4, 0.08, HOARD, 0, 0, 0); P(g, 3.6, 0.7, textMat(o.text || 'VINLAND', '#f6f0e2', HOARD), 0, 1.1, 0.05);
      [-2, 2].forEach(x => B(g, 0.12, 2.5, 0.12, '#9aa3a8', x, 0, 0, FLAT)); return g; } });
  def({ key: 'siteCorner', name: 'Site fence corner', cat: 'Construction', part: 2, budget: 80, size: '2 + 2 m corner', opts: { text: { label: 'Banner', choices: ['VINLAND', 'COMING SOON'] } },
    make(o) { const g = new THREE.Group(); B(g, 2, 2.4, 0.08, HOARD, -1, 0, 0); B(g, 0.08, 2.4, 2, HOARD, 0, 0, 1);
      P(g, 1.8, 0.55, textMat(o.text || 'VINLAND', '#f6f0e2', HOARD), -1, 1.15, 0.05); P(g, 1.8, 0.55, textMat(o.text || 'VINLAND', '#f6f0e2', HOARD), 0.05, 1.15, 1, { ry: Math.PI / 2 });
      [[-2, 0], [0, 0], [0, 2]].forEach(([x, z]) => B(g, 0.12, 2.5, 0.12, '#9aa3a8', x, 0, z, FLAT)); return g; } });
  def({ key: 'towerCrane', name: 'Tower crane', cat: 'Construction', part: 2, budget: 600, size: '48 m tall \u00b7 46 m jib', night: true, opts: {},
    make() { const g = new THREE.Group(), Y = '#e8b830', H = 44;
      B(g, 5, 1.2, 5, '#9aa3a8', 0, 0, 0);
      for (let i = 0; i < 11; i++) B(g, 2, 4, 2, Y, 0, 1.2 + i * 4, 0);                               // lattice mast (sections show as lines)
      B(g, 3, 2.6, 3, '#f6f0e2', 0, H, 1.6); P(g, 2.6, 1.4, PAL.glass, 0, H + 0.9, 3.12);              // cab
      TAPER(g, 2, 6, 2, Y, 0, H + 2.6, 0, { tw: 0.15, td: 0.15 });                                     // apex
      B(g, 1.6, 1.6, 34, Y, 0, H + 2.6, 18); B(g, 1.6, 1.4, 12, Y, 0, H + 2.6, -7);                   // jib + counter jib
      B(g, 2.4, 2.6, 3, '#9aa3a8', 0, H + 0.8, -11.5);                                                 // counterweight
      strut(g, [0, H + 8.6, 0], [0, H + 4.2, 30], 0.12, '#55504a'); strut(g, [0, H + 8.6, 0], [0, H + 4, -12], 0.12, '#55504a');   // tie lines
      B(g, 1.4, 0.8, 2, '#55504a', 0, H + 1.8, 24); B(g, 0.06, 18, 0.06, PAL.iron, 0, H - 16.2, 24, FLAT); B(g, 0.8, 0.9, 0.8, '#d8231f', 0, H - 17, 24, NE);   // trolley, cable, hook
      BALL(g, 0.35, glowMat('#e8473a', '#ff3a20'), 0, H + 8.9, 0, NE); BALL(g, 0.3, glowMat('#e8473a', '#ff3a20'), 0, H + 4.4, 34.8, NE);
      return g; } });
  def({ key: 'cementMixer', name: 'Cement mixer', cat: 'Construction', part: 2, budget: 450, size: '2.5 \u00d7 8 m', opts: { body: colours('Cab', ['#e8b830', PAL.terra, '#3f7fbf', '#f6f0e2']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#e8b830');
      B(g, 2.3, 0.5, 7.6, PAL.iron, 0, 0.7, 0);
      B(g, 2.4, 2.2, 2, b, 0, 1.2, 2.9); P(g, 2.0, 0.9, PAL.glass, 0, 2.3, 3.91); [-0.8, 0.8].forEach(x => P(g, 0.36, 0.2, HEAD(), x, 1.5, 3.91));
      const d = grp(g, 0, 2.5, -1); d.rotation.x = -(Math.PI / 2 - 0.25);                                 // drum axis: back and a little up
      CYL(d, 1.25, 0.7, 2.4, 10, '#f4f2ee', 0, -2.4, 0); CYL(d, 0.75, 1.25, 2.4, 10, '#f4f2ee', 0, 0, 0);
      [-0.9, 0.7].forEach(y => CYL(d, 1.17, 1.2, 0.3, 10, b, 0, y, 0, { edge: false, open: true }));
      TAPER(g, 0.8, 0.6, 1, '#9aa3a8', 0, 1.6, -3.8, { tw: 1.4, td: 1.4 });                            // chute
      [[-1.05, 2.9], [1.05, 2.9], [-1.05, -1.4], [1.05, -1.4], [-1.05, -2.8], [1.05, -2.8]].forEach(([x, z]) => WHEEL(g, 0.5, 0.36, x, z, 8));
      return g; } });
  def({ key: 'materials', name: 'Materials stack', cat: 'Construction', part: 2, budget: 400, size: '8 \u00d7 5 m', opts: {},
    make() { const g = new THREE.Group();
      [[-2.6, -1.2], [-1.2, -1.2]].forEach(([x, z]) => { B(g, 1.2, 0.15, 1.2, PAL.wood, x, 0, z, NE); B(g, 1.1, 0.9, 1.1, PAL.terra, x, 0.15, z); });   // brick pallets
      for (let i = 0; i < 6; i++) CYL(g, 0.2, 0.2, 4.5, 8, '#9aa3a8', 0.6 + (i % 3) * 0.42, 0.2 + Math.floor(i / 3) * 0.36, -1.2, { rx: Math.PI / 2, edge: false });   // pipes
      for (let i = 0; i < 4; i++) B(g, 4, 0.18, 0.5, '#c9a26a', 0.5, i * 0.18, 1.2 + (i % 2) * 0.1, NE);                // planks
      put(g, geo('cap', () => new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2.2)), '#d9c49a', -2.2, 0, 1.3, { s: [1.5, 1, 1.5] });   // sand pile
      B(g, 0.9, 0.9, 0.9, '#55504a', 3.3, 0, 1.2, NE);                                                  // cement bags
      return g; } });
  // milestone board: big board with LIVE text. o.text, e.g. 'Vinland Stadium \u00b7 opens at 2,000 citizens \u00b7 1,890 / 2,000'.
  // The last 'a / b' sets the progress bar. Change it later with g.userData.setText('\u2026').
  function drawMilestone(x, w, h, text) {
    x.fillStyle = '#14233f'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f6d27a'; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
    const parts = String(text || '').split('\u00b7').map(s => s.trim()).filter(Boolean), m = /([\d,]+)\s*\/\s*([\d,]+)/.exec(parts[parts.length - 1] || '');
    const num = s => +s.replace(/,/g, ''), have = m ? num(m[1]) : 0, need = m ? num(m[2]) : 0, title = parts[0] || '', mid = (m ? parts.slice(1, -1) : parts.slice(1)).join(' \u00b7 ');
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#f6d27a'; fitFont(x, title.toUpperCase(), w - 80, 84); x.fillText(title.toUpperCase(), w / 2, h * 0.24);
    x.fillStyle = '#f6f3ea'; fitFont(x, mid, w - 80, 50, 500); x.fillText(mid, w / 2, h * 0.47);
    if (m && need > 0) { const bx = 60, by = h * 0.64, bw = w - 120, bh = 56, p = Math.max(0, Math.min(1, have / need));
      x.fillStyle = '#2b3a5a'; x.fillRect(bx, by, bw, bh); x.fillStyle = '#5fbf6a'; x.fillRect(bx, by, bw * p, bh);
      x.fillStyle = '#f6f3ea'; fitFont(x, m[0], w - 80, 46); x.fillText(`${m[1]} / ${m[2]}  \u00b7  ${Math.round(p * 100)}%`, w / 2, by + bh + 52); }
  }
  def({ key: 'milestoneBoard', name: 'Milestone board', cat: 'Construction', part: 2, budget: 150, size: '12 \u00d7 6 m board', night: true, opts: { text: { label: 'Text', choices: ['Vinland Stadium \u00b7 opens at 2,000 citizens \u00b7 1,890 / 2,000', 'Vinland Tower \u00b7 opens at 10,000 citizens \u00b7 4,210 / 10,000'] } },
    make(o) { const g = new THREE.Group(), lt = liveText(1024, 512, drawMilestone); lt.set(o.text || 'Vinland Stadium \u00b7 opens at 2,000 citizens \u00b7 1,890 / 2,000');
      [-5, 5].forEach(x => B(g, 0.4, 9.5, 0.4, '#9aa3a8', x, 0, -0.1, NE));
      B(g, 12.4, 6.4, 0.4, PAL.iron, 0, 3.2, -0.1); P(g, 12, 6, lt.mat, 0, 3.4, 0.12);
      [-4, 0, 4].forEach(x => { B(g, 0.1, 0.6, 0.6, PAL.iron, x, 9.6, 0.2, NE); B(g, 0.6, 0.3, 0.4, glowMat(PAL.lampOn, '#fff3c4'), x, 9.9, 0.55, NE); });
      g.userData.setText = t => lt.set(t); return g; } });

  // ---- 5. city centre pieces ----
  def({ key: 'plazaFountain', name: 'Plaza fountain', cat: 'City centre', part: 2, budget: 700, size: '20 m across', night: true, opts: {},
    make() { const g = new THREE.Group(), ST = '#e2dccd', WATER = glowMat(PAL.water, '#3f8fb0'), SPRAY = glowMat('#cdeaf3', '#6ec3dc');
      CYL(g, 10, 10.4, 0.9, 24, ST, 0, 0, 0, { open: true }); CYL(g, 10.6, 10.6, 0.25, 24, ST, 0, 0.9, 0, { open: true, edge: false });   // basin + seat rim
      CYL(g, 9.9, 9.9, 0.7, 24, WATER, 0, 0.05, 0, NE);
      CYL(g, 2, 2.6, 3, 12, ST, 0, 0.6, 0); CYL(g, 5, 2, 1, 16, ST, 0, 3.6, 0); CYL(g, 4.8, 4.8, 0.3, 16, WATER, 0, 4.35, 0, NE);   // tier 2
      CYL(g, 0.9, 1.2, 2.2, 8, ST, 0, 4.6, 0); CYL(g, 2.4, 0.9, 0.7, 12, ST, 0, 6.8, 0); CYL(g, 2.3, 2.3, 0.2, 12, WATER, 0, 7.35, 0, NE);   // tier 3
      CYL(g, 0.3, 0.5, 1.4, 8, ST, 0, 7.5, 0); CYL(g, 0.08, 1.6, 2.6, 8, SPRAY, 0, 8.9, 0, { open: true, edge: false });     // top spout + spray
      return g; } });
  def({ key: 'plazaTile', name: 'Plaza paving tile', cat: 'City centre', part: 2, budget: 40, size: '10 \u00d7 10 m', opts: { pattern: choices('Pattern', ['grid', 'stripes', 'border']) },
    make(o) { const g = new THREE.Group(), p = o.pattern || 'grid'; B(g, 10, 0.2, 10, PAVE, 0, 0, 0, { shadow: false });
      if (p === 'grid') for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) flat2(g, 2.5, 2.5, PAVE2, -3.75 + i * 2.5, 0.21, -3.75 + j * 2.5);
      if (p === 'stripes') for (let i = 0; i < 5; i++) if (i % 2) flat2(g, 2, 10, PAVE2, -4 + i * 2, 0.21, 0);
      if (p === 'border') { flat2(g, 10, 0.8, PAVE2, 0, 0.21, 4.6); flat2(g, 10, 0.8, PAVE2, 0, 0.21, -4.6); flat2(g, 0.8, 8.4, PAVE2, 4.6, 0.21, 0); flat2(g, 0.8, 8.4, PAVE2, -4.6, 0.21, 0); }
      return g; } });
  def({ key: 'raisedPlanter', name: 'Raised planter', cat: 'City centre', part: 2, budget: 300, size: '4 \u00d7 4 m', opts: { kind: choices('Tree', ['canopy', 'pink', 'purple', 'cypress']) },
    make(o) { const g = new THREE.Group(); B(g, 4, 0.9, 4, '#e2dccd', 0, 0, 0); B(g, 3.5, 0.05, 3.5, '#6b4f3a', 0, 0.9, 0, FLAT);
      [[0, 2.05, 0], [0, -2.05, 0], [2.05, 0, Math.PI / 2], [-2.05, 0, Math.PI / 2]].forEach(([x, z, ry]) => B(g, 4.2, 0.1, 0.5, PAL.wood, x, 0.9, z, { ry, edge: false }));   // wooden seat edge
      tree(g, 0, 0.9, 0, o.kind || 'canopy', 0.9); [[-1.2, 1.2], [1.2, -1.2], [1.2, 1.2]].forEach(([x, z]) => ICO(g, 0.4, 0, PAL.leaf2, x, 1.25, z, NE));
      return g; } });
  def({ key: 'publicClock', name: 'Public clock', cat: 'City centre', part: 2, budget: 350, size: '7.5 m tall', night: true, opts: {},
    make() { const g = new THREE.Group(), IR = '#2f3e3a', FACE = glowMat('#f6f3ea', '#fff3c4');
      B(g, 1.6, 0.6, 1.6, '#e2dccd', 0, 0, 0); CYL(g, 0.18, 0.26, 5.2, 8, IR, 0, 0.6, 0, NE);
      B(g, 1.5, 1.5, 1.5, IR, 0, 5.8, 0); TAPER(g, 1.6, 0.9, 1.6, IR, 0, 7.3, 0, { tw: 0.2, td: 0.2 }); BALL(g, 0.18, '#e2b04a', 0, 8.3, 0, NE);
      [0, 1, 2, 3].forEach(k => { const s = grp(g, 0, 0, 0, k * Math.PI / 2);
        put(s, geo('clockface', () => new THREE.CircleGeometry(1, 12)), FACE, 0, 6.55, 0.77, { edge: true, s: [0.62, 0.62, 1], shadow: false });
        B(s, 0.06, 0.42, 0.02, PAL.iron, 0, 6.55, 0.79, FLAT); B(s, 0.34, 0.06, 0.02, PAL.iron, 0.17, 6.55, 0.79, FLAT); });    // 10:10-ish hands
      [['STADIUM', 0.3], ['BEACH', 2.2], ['CENTRAL', 4.1]].forEach(([t, a], i) => { const s = grp(g, 0, 3.0 + i * 0.6, 0, a);
        TAPER(s, 1.8, 0.4, 0.06, '#2f7a68', 1.0, 0, 0, { tw: 1, td: 1 }, NE); P(s, 1.6, 0.32, textMat(t, '#2f7a68', '#f6f3ea'), 1.0, 0.04, 0.04); });
      return g; } });

  // ---- 6. transport hub: metro / train station + covered bus bay ----
  def({ key: 'metroStation', name: 'Metro station', cat: 'Transport', part: 2, budget: 1200, size: '90 \u00d7 40 m', night: true, opts: { name: { label: 'Name', choices: ['VINLAND CENTRAL', 'DOWNTOWN', 'STADIUM'] } },
    make(o) { const g = new THREE.Group(), ST = '#e9e3d6', W = 34, D = 20, zH = 8;
      B(g, 90, 0.2, 40, PAVE, 0, 0, 0, { shadow: false });
      B(g, W, 9, D, ST, 0, 0.2, zH, { edge: false });                                                      // the hall
      [[W, D, 0], [W, D, Math.PI]].forEach(([fw, fd, ry]) => { const s = grp(g, 0, 0, zH, ry); P(s, fw - 4, 7.6, glassWall('#9cc7b8', (fw - 4) / 3, 3), 0, 0.6, fd / 2 + 0.02); });
      const roof = grp(g, 0, 9.2, zH); put(roof, geo('barrel', () => { const ge = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, -Math.PI / 2, Math.PI); ge.rotateZ(Math.PI / 2); return ge; }), glowMat('#9fc9dc', '#ffe2a8'), 0, 0, 0, { s: [W + 2, D / 2 + 1, D / 2 + 1], edge: true });   // glass barrel roof
      [-1, 1].forEach(s => B(g, 1.4, 10.4, D + 1, ST, s * (W / 2 + 0.2), 0.2, zH));
      B(g, 22, 2.2, 0.5, '#2f2b28', 0, 9.4 - 2.4, zH + D / 2 + 0.6); P(g, 21, 1.8, textMat(o.name || 'VINLAND CENTRAL', '#2f2b28', '#f6d27a'), 0, 7.2, zH + D / 2 + 0.87);
      P(g, 8, 4.6, glowMat(PAL.glassWarm, '#ffcf6a'), 0, 0.6, zH + D / 2 + 0.05);                       // doors
      CYL(g, 1.4, 1.4, 0.2, 10, '#2f7a68', 13, 4.4, zH + D / 2 + 1.2, { rx: Math.PI / 2 }); P(g, 1.6, 1.6, textMat('M', '#2f7a68', '#f6f3ea'), 13, 3.6, zH + D / 2 + 1.32);   // metro roundel
      // platform with a long canopy, two tracks
      const zp = -8; B(g, 86, 1.1, 7, '#d9d2c4', 0, 0.2, zp); flat2(g, 86, 0.4, '#f2c53d', 0, 1.31, zp + 3.2); flat2(g, 86, 0.4, '#f2c53d', 0, 1.31, zp - 3.2);
      for (let i = 0; i < 10; i++) { const x = -40 + i * 8.9; B(g, 0.35, 5, 0.35, '#55504a', x, 1.3, zp, NE); }
      TAPER(g, 86, 0.5, 9, '#f4f2ee', 0, 6.3, zp, { tw: 1, td: 0.85 });                                  // canopy
      for (let i = 0; i < 8; i++) B(g, 2.4, 0.15, 0.6, glowMat('#f4f1e8', '#ffffff'), -36 + i * 10.3, 6.15, zp, { edge: false, shadow: false });   // canopy lights
      [zp + 6, zp - 6].forEach(z => { [-0.75, 0.75].forEach(dz => B(g, 88, 0.16, 0.12, '#9aa3a8', 0, 0.3, z + dz, FLAT));
        for (let i = 0; i < 30; i++) flat2(g, 0.5, 2.4, '#7a5a3a', -43 + i * 2.95, 0.23, z); });             // rails + sleepers
      [-30, -10, 10, 30].forEach(x => B(g, 2.4, 0.45, 0.6, PAL.wood, x, 1.3, zp, NE));                      // benches
      [-20, 20].forEach(x => { B(g, 0.12, 3.2, 0.12, PAL.iron, x, 1.3, zp + 2, NE); B(g, 3, 0.7, 0.12, PAL.iron, x, 4.5, zp + 2, NE); P(g, 2.8, 0.5, textMat('PLATFORM ' + (x < 0 ? 1 : 2), '#14233f', '#f6d27a'), x, 4.6, zp + 2.07); });
      return g; } });
  def({ key: 'busBay', name: 'Covered bus bay', cat: 'Transport', part: 2, budget: 500, size: '44 \u00d7 20 m', night: true, opts: {},
    make() { const g = new THREE.Group();
      B(g, 44, 0.2, 20, '#45474d', 0, 0, 0, { shadow: false });                                            // bus lanes
      B(g, 40, 0.35, 5, '#d9d2c4', 0, 0.2, 0);                                                             // island platform
      [-1, 1].forEach(s => { flat2(g, 40, 0.25, '#f2c53d', 0, 0.21, s * 5.5); for (let i = 0; i < 3; i++) flat2(g, 0.25, 4, '#f6f3ea', -13 + i * 13, 0.21, s * 7.5); });
      for (let i = 0; i < 6; i++) B(g, 0.35, 4.2, 0.35, '#55504a', -17 + i * 6.8, 0.55, 0, NE);
      TAPER(g, 42, 0.5, 9, '#2f7a68', 0, 4.75, 0, { tw: 1, td: 0.88 });                                    // long canopy over both sides
      for (let i = 0; i < 6; i++) B(g, 2.4, 0.15, 0.6, glowMat('#f4f1e8', '#ffffff'), -17 + i * 6.8, 4.6, 0, { edge: false, shadow: false });
      [1, 2, 3].forEach((n, i) => { const x = -13 + i * 13; B(g, 0.1, 2.6, 0.1, PAL.iron, x, 0.55, 2.2, NE); B(g, 0.9, 0.9, 0.08, '#3f7fbf', x, 3.1, 2.2, NE); P(g, 0.8, 0.8, textMat(String(n), '#3f7fbf', '#f6f3ea'), x, 3.15, 2.25);
        B(g, 3, 0.45, 0.6, PAL.wood, x + 3, 0.55, -1.2, NE); P(g, 3.6, 2, '#bfe0ea', x + 3, 0.55, -1.7, { edge: true }); });
      return g; } });

  // ================= DOWNTOWN: "Brooklyn x Vinland" (Dev OK'd the direction, 15 Nov) =================
  // Brick rows, brownstones, warehouses and art deco stone in OUR colours. No textures, no new glass towers.
  // Everything uses shared cached materials, so 5+ copies batch into one draw in the layout.
  // Night: windows glow warm (setNight).
  const BK = {
    WIN: glowMat(PAL.glass, '#ffcf6a'), WINOFF: glowMat(PAL.glass, '#4a3f2c'), SHOPGL: glowMat('#5f7f86', '#ffd98a'), DOOR: PAL.shutter, FRAME: PAL.cream, DARK: '#3a2a20', IRON: '#2b2b2e',
    bricks: { brownstone: ['#8a5a3c', '#7a4a33', '#9a6848', '#6f4632'], red: ['#a8473a', '#96402f', '#b5583f', '#8c3b2e'], mixed: ['#8a5a3c', '#b5583f', '#7a4a33', '#a8473a'] },
    awnings: { mix: [PAL.terra, '#c9922e', PAL.shutter, PAL.terra2], terracotta: [PAL.terra, PAL.terra2, PAL.terra, PAL.terra2], mustard: ['#c9922e', '#d4a23a', '#c9922e', '#d4a23a'], green: [PAL.shutter, '#3f5e42', PAL.shutter, '#3f5e42'] }
  };
  const winAt = (x, y, z) => (Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1) < 0.72 ? BK.WIN : BK.WINOFF;   // about 7 in 10 windows lit at night (fixed pattern, shared materials)
  const awning = (p, w, c, x, y, z) => put(p, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), c, x, y, z, { rx: 0.4, s: [w, 0.12, 1.7] });   // sloped shop awning, top edge at the wall

  // 1. brownstoneRow: 4 attached brownstones, 4 floors, 24 x 12 m. Ground floor shop on/off.
  //    o.bricks: 'brownstone' | 'red' | 'mixed'; o.awnings: 'mix' | 'terracotta' | 'mustard' | 'green'; o.shop: 'on' | 'off';
  //    o.sign: one shop name (first house) or o.signs: ['A', 'B', 'C', 'D'] (one per house). Front = +z.
  def({ key: 'brownstoneRow', name: 'Brownstone row', cat: 'Shelved', part: 2, budget: 700, size: '4 houses · 24 × 12 m · 4 floors', night: true,
    opts: { bricks: choices('Bricks', ['brownstone', 'red', 'mixed']), awnings: choices('Awnings', ['mix', 'terracotta', 'mustard', 'green']), shop: choices('Shops', ['on', 'off']), sign: { label: 'Sign', choices: ['', 'CAFÉ', 'BAKERY', 'BOOKS'] } },
    make(o) {
      const g = new THREE.Group(), set = BK.bricks[o.bricks] || BK.bricks.brownstone, aw = BK.awnings[o.awnings] || BK.awnings.mix, shop = o.shop !== 'off';
      const signs = o.signs || (o.sign ? [o.sign] : []), W = 6, D = 12, FH = 3.3, H = 4 * FH + 0.4, zf = D / 2;
      for (let i = 0; i < 4; i++) { const x = -9 + i * W;
        B(g, W, H, D, set[i], x, 0, 0);                                                              // the house
        B(g, W + 0.2, 0.75, 0.7, BK.DARK, x, H - 0.1, zf - 0.15);                                    // dark cornice
        for (let f = 1; f < 4; f++) { const y = f * FH + 0.55;                                       // upper windows: cream frame, glass, lintel band
          [-1.4, 1.4].forEach(k => { P(g, 1.35, 2.0, BK.FRAME, x + k, y - 0.15, zf + 0.02); P(g, 1.0, 1.65, winAt(x + k, y, i), x + k, y, zf + 0.04); P(g, 1.0, 1.5, winAt(x - k, y, i + 9), x + k, y, -zf - 0.03, { ry: Math.PI }); });
          B(g, W - 0.6, 0.18, 0.18, BK.FRAME, x, y + 1.95, zf + 0.06, NE); }
        if (shop) {                                                                                  // shop: window, awning, sign board, door to the flats upstairs
          P(g, 3.9, 2.5, BK.FRAME, x - 0.75, 0.15, zf + 0.02); P(g, 3.6, 2.2, BK.SHOPGL, x - 0.75, 0.3, zf + 0.04);
          awning(g, 4.3, aw[i], x - 0.75, 3.0, zf + 0.75);
          B(g, 4.2, 0.55, 0.12, BK.DARK, x - 0.75, 3.35, zf + 0.06, NE);
          if (signs[i]) P(g, 4.0, 0.45, textMat(String(signs[i]).toUpperCase(), BK.DARK, '#f6d27a'), x - 0.75, 3.4, zf + 0.13);
          P(g, 1.0, 2.3, BK.DOOR, x + 2.15, 0.2, zf + 0.03);
        } else {                                                                                     // house: stoop up to a green front door
          TAPER(g, 1.5, 1.1, 2.4, '#b9a68a', x + 1.55, 0, zf + 1.2, { tw: 1, td: 0.12, tz: -0.44 });
          P(g, 1.4, 2.6, BK.FRAME, x + 1.55, 1.05, zf + 0.02); P(g, 1.05, 2.3, BK.DOOR, x + 1.55, 1.1, zf + 0.04);
          P(g, 1.35, 1.6, BK.FRAME, x - 1.4, 1.05, zf + 0.02); P(g, 1.0, 1.3, BK.WIN, x - 1.4, 1.2, zf + 0.04);
        }
      }
      return g;
    } });

  // 2. brickWarehouse: red-brick warehouse, 6 floors, arched window grid, café front + big doors, wooden water tower.
  //    o.brick: colour; o.waterTower: 'on' | 'off'. 30 x 22 m. Front = +z, windows also on the +x side.
  def({ key: 'brickWarehouse', name: 'Brick warehouse', cat: 'Shelved', part: 2, budget: 900, size: '30 × 22 m · 6 floors · water tower', night: true,
    opts: { brick: colours('Brick', ['#a8473a', '#8c3b2e', '#9a6848', '#b5583f']), waterTower: choices('Water tower', ['on', 'off']) },
    make(o) {
      const g = new THREE.Group(), BR = slot('brick', o.brick || '#a8473a'), W = 30, D = 22, FH = 3.8, H = 6 * FH;
      B(g, W, H, D, BR, 0, 0, 0);
      B(g, W + 0.5, 1, D + 0.5, BK.DARK, 0, H, 0); B(g, W + 0.3, 0.35, D + 0.3, BK.FRAME, 0, FH - 0.2, 0, NE);   // cornice, stone band over the ground floor
      const arched = (s, x, y) => { const m = winAt(x, y, s.parent.rotation.y); P(s, 2.0, 2.0, m, x, y, 0.03); ARCH(s, 2.0, m, x, y + 2.0, 0.03); };
      [[W, D / 2, 0, 6], [D, W / 2, Math.PI / 2, 4]].forEach(([fw, fz, ry, n]) => { const s = grp(g, 0, 0, 0, ry); const s2 = grp(s, 0, 0, fz);
        for (let f = 1; f < 6; f++) for (let i = 0; i < n; i++) arched(s2, -fw / 2 + (i + 0.5) * fw / n, f * FH + 0.5); });
      // ground: café on the left, big loading doors on the right
      P(g, 12, 2.8, BK.FRAME, -7, 0.15, D / 2 + 0.02); P(g, 11.4, 2.5, BK.SHOPGL, -7, 0.3, D / 2 + 0.04);
      awning(g, 12.4, PAL.shutter, -7, 3.15, D / 2 + 0.75);
      [-10, -4].forEach(x => { CYL(g, 0.5, 0.5, 0.05, 8, PAL.cream, x, 0.95, D / 2 + 2.2, NE); B(g, 0.1, 0.95, 0.1, BK.IRON, x, 0, D / 2 + 2.2, FLAT); });   // café tables
      [5.5, 10.5].forEach(x => { P(g, 3.6, 2.6, '#5a3c28', x, 0.2, D / 2 + 0.03); ARCH(g, 3.6, '#5a3c28', x, 2.8, D / 2 + 0.03); });   // loading doors
      B(g, 12, 0.9, 1.6, '#8a8076', 8, 0, D / 2 + 0.8, NE);                                        // loading dock
      B(g, 4, 2.6, 4, BR, -9, H + 1, -5);                                                          // stair hut on the roof
      if (o.waterTower !== 'off') { const t = grp(g, 6, H + 1, -3), WD = '#8a6a46';                 // the wooden water tower
        [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].forEach(([x, z]) => B(t, 0.2, 4, 0.2, BK.IRON, x, 0, z, FLAT));
        B(t, 4.2, 0.25, 4.2, BK.IRON, 0, 4, 0, NE);
        CYL(t, 2.1, 2.2, 4.4, 8, WD, 0, 4.25, 0, { open: true });
        [5.3, 7.4].forEach(y => CYL(t, 2.25, 2.25, 0.18, 8, BK.IRON, 0, y, 0, { open: true, edge: false }));
        CYL(t, 0.15, 2.5, 1.8, 8, BK.DARK, 0, 8.65, 0, { open: true }); }
      return g;
    } });

  // 3. brickCorner: corner brick block, 6 floors, 24 x 24 m. Shops with awnings on the two street faces (+z and +x),
  //    black zig-zag fire escapes on the +x side. o.brick, o.awning.
  def({ key: 'brickCorner', name: 'Brick corner block', cat: 'Shelved', part: 2, budget: 900, size: '24 × 24 m · 6 floors · fire escapes', night: true,
    opts: { brick: colours('Brick', ['#9a4a3a', '#8a5a3c', '#a8473a', '#7a4a33']), awning: colours('Awnings', [PAL.terra, '#c9922e', PAL.shutter, PAL.terra2]) },
    make(o) {
      const g = new THREE.Group(), BR = slot('brick', o.brick || '#9a4a3a'), AW = slot('awning', o.awning || PAL.terra), S = 24, FH = 3.4, H = 6 * FH;
      B(g, S, H, S, BR, 0, 0, 0); B(g, S + 0.5, 0.9, S + 0.5, BK.DARK, 0, H, 0); B(g, S + 0.3, 0.3, S + 0.3, BK.FRAME, 0, FH - 0.2, 0, NE);
      [0, Math.PI / 2].forEach(ry => { const s = grp(g, 0, 0, 0, ry), f2 = grp(s, 0, 0, S / 2);
        for (let f = 1; f < 6; f++) for (let i = 0; i < 6; i++) { const x = -S / 2 + (i + 0.5) * S / 6; P(f2, 1.7, 2.1, BK.FRAME, x, f * FH + 0.45, 0.02); P(f2, 1.35, 1.8, winAt(x, f, ry), x, f * FH + 0.6, 0.04); }
        for (let i = 0; i < 3; i++) { const x = -S / 2 + (i + 0.5) * S / 3; P(f2, 6.6, 2.5, BK.FRAME, x, 0.15, 0.02); P(f2, 6.2, 2.2, BK.SHOPGL, x, 0.3, 0.04); awning(f2, 7, AW, x, 3.0, 0.75); } });
      // fire escapes on the +x face: a platform, railing and a stair on each floor, zig-zagging down
      [-6, 6].forEach(zc => { const fe = grp(g, S / 2, 0, zc);
        for (let f = 1; f < 6; f++) { const y = f * FH + 0.2;
          B(fe, 1.4, 0.12, 4.6, BK.IRON, 0.7, y, 0, NE); P(fe, 4.6, 0.95, BK.IRON, 1.4, y + 0.12, 0, { ry: Math.PI / 2, edge: false });
          if (f > 1) strut(fe, [0.75, y, (f % 2 ? -1.9 : 1.9)], [0.75, y - FH + 0.12, (f % 2 ? 1.9 : -1.9)], 0.18, BK.IRON); }
        B(fe, 0.08, FH, 0.5, BK.IRON, 1.2, 0.2 + FH * 0.1, 1.6, FLAT); });                          // drop ladder
      return g;
    } });

  // 4. decoMidrise: art deco stone mid-rise, 8 / 10 / 12 floors, 22 x 22 m. Stepped setbacks, copper dome, deco fins,
  //    green shutters on the lower floors. o.floors, o.stone.
  def({ key: 'decoMidrise', name: 'Art deco mid-rise', cat: 'Shelved', part: 2, budget: 1100, size: '22 × 22 m · 8–12 floors', night: true,
    opts: { floors: choices('Floors', ['10', '8', '12']), stone: colours('Stone', [PAL.cream, PAL.sand, '#f0c9a8']) },
    make(o) {
      const g = new THREE.Group(), ST = slot('wall', o.stone || PAL.cream), n = Math.max(8, Math.min(12, +o.floors || 10)), FH = 3.5, W = 22, base = 5;
      const T1 = n - 3, h1 = T1 * FH, COP = PAL.copper;
      B(g, W, base, W, ST, 0, 0, 0); B(g, W + 0.6, 0.5, W + 0.6, COP, 0, base, 0, NE);             // tall ground floor + copper band
      P(g, 4, 3.6, glowMat(PAL.glassWarm, '#ffcf6a'), 0, 0.2, W / 2 + 0.03); B(g, 7, 0.4, 2.4, COP, 0, 4.1, W / 2 + 1.2);   // door + canopy
      [-7, 7].forEach(x => { P(g, 4, 3, BK.WIN, x, 1, W / 2 + 0.03); });
      const tier = (w, y0, fl, cols, shut) => {                                                      // a block of floors with deco fins and windows on 4 faces
        B(g, w, fl * FH, w, ST, 0, y0, 0);
        [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, w / 2);
          for (let i = 1; i < cols; i++) B(s, 0.55, fl * FH, 0.5, ST, -w / 2 + i * w / cols, y0, 0.05, { edge: false });   // vertical fins between window columns
          for (let f = 0; f < fl; f++) for (let i = 0; i < cols; i++) { const x = -w / 2 + (i + 0.5) * w / cols, y = y0 + f * FH + 0.7;
            P(s, w / cols - 1.3, 2.2, winAt(x, y, k), x, y, 0.03);
            if (shut && k === 0 && f < 3) [-1, 1].forEach(d => P(s, 0.55, 2.2, PAL.shutter, x + d * (w / cols - 1.3) / 2 + d * 0.32, y, 0.05)); } });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 1.1, fl * FH + 0.6, 1.1, ST, a * w / 2, y0, b * w / 2, NE));   // corner piers, a little proud
        B(g, w + 0.5, 0.45, w + 0.5, COP, 0, y0 + fl * FH, 0, NE);                                    // copper band at the setback
      };
      tier(W - 1, base + 0.5, T1, 4, true); let y = base + 0.95 + h1;
      tier(15, y, 2, 3, false); y += 2 * FH + 0.45;
      tier(9, y, 1, 2, false); y += FH + 0.45;
      put(g, geo('dome', () => new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)), COP, 0, y, 0, { s: [3.8, 3.4, 3.8] });   // copper dome
      CYL(g, 0.08, 0.3, 4, 6, COP, 0, y + 3.2, 0, NE);
      return g;
    } });

  // 6. streetTram: small two-part tram, teal body, mustard roof stripe, pole up to the overhead wire. Static prop. 2.4 x 19 m.
  def({ key: 'streetTram', name: 'Street tram', cat: 'Shelved', part: 2, budget: 400, size: '2.4 × 19 m · 2 cars', night: true, opts: {},
    make() { const g = new THREE.Group(), TEAL = PAL.teal, MUST = '#d4a23a', HL = glowMat(PAL.lampOn, '#fff3c4');
      [-4.9, 4.9].forEach((z, k) => { const c = grp(g, 0, 0, z);
        B(c, 2.4, 1.3, 8.6, TEAL, 0, 0.45, 0); B(c, 2.4, 1.2, 8.6, '#f3ead6', 0, 1.75, 0);              // teal lower body, cream window band
        [-1, 1].forEach(s => P(c, 7.8, 0.95, BK.WIN, s * 1.21, 1.9, 0, { ry: s * Math.PI / 2 }));       // windows
        B(c, 2.3, 0.3, 8.4, TEAL, 0, 2.95, 0); B(c, 2.0, 0.12, 8.2, MUST, 0, 3.25, 0, NE);            // roof + mustard stripe
        B(c, 2.0, 0.5, 6.4, '#2f2b28', 0, 0, 0, NE);                                                   // bogies
        const end = k ? 1 : -1; P(c, 2.0, 0.9, BK.WIN, 0, 1.95, end * 4.32, { ry: k ? 0 : Math.PI }); P(c, 0.35, 0.2, HL, end * 0, 0.95, end * 4.32, { ry: k ? 0 : Math.PI }); });
      B(g, 2.0, 2.6, 1.2, '#55504a', 0, 0.45, 0, NE);                                                  // the joint between the two cars
      B(g, 0.8, 0.4, 1.2, '#2f2b28', 0, 3.25, 3.5, NE); strut(g, [0, 3.6, 3.5], [0, 6.2, -1.2], 0.1, '#2f2b28');   // pole up to the overhead wire
      B(g, 0.06, 0.06, 6, '#2f2b28', 0, 6.25, -1.2, FLAT);                                              // a short bit of the wire
      return g; } });

  // 7. streetTree: tree in a square pavement pit, very cheap, for 100+ copies. o.kind: 'green' | 'pink'.
  def({ key: 'streetTree', name: 'Street tree', cat: 'Shelved', part: 2, budget: 80, size: '1.8 m pit · 6 m tall', opts: { kind: choices('Tree', ['green', 'pink']) },
    make(o) { const g = new THREE.Group(), leaf = o.kind === 'pink' ? PAL.pink : PAL.leaf;
      B(g, 1.8, 0.14, 1.8, '#bdb5a6', 0, 0, 0, { shadow: false }); put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), '#6b4f3a', 0, 0.15, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [1.4, 1.4, 1] }));
      CYL(g, 0.14, 0.2, 3, 5, PAL.wood, 0, 0.1, 0, { edge: false, open: true });
      ICO(g, 2.1, 0, leaf, 0, 4.4, 0); return g; } });

  // ================= DOWNTOWN: "Vinland Capital" (Dev OK'd, 15 Nov) =================
  // Our own old town grown into a capital: cream / peach / ochre walls, terracotta roofs, arches, green shutters,
  // blossom trees, canals. No glass towers. All materials are shared, so 5+ copies batch into one draw in the layout.
  // Night: windows glow warm (about 7 in 10 lit), string lights, lanterns and stage lights glow (setNight). Front = +z.
  const CP = {
    STONE: '#e6dac2', PAVE: '#e6dccb', SHADE: '#9a7a5c', ROOF: PAL.terra, IRON: '#2f2b28',
    BULB: glowMat('#fff0c0', '#ffd27a'), LAMP: glowMat(PAL.lampOn, '#ffd98a'),
    GLASS_SEE: (() => { const m = new THREE.MeshToonMaterial({ color: '#a8d4e2', gradientMap: grad, transparent: true, opacity: 0.35, depthWrite: false }); m.userData.glow = '#6a5a3a'; return m; })(),
    walls: { warm: [PAL.cream, '#f2cfb3', '#e8c27a', '#ecc3b0'], cream: [PAL.cream, '#f6f0e2', '#efe3c8', PAL.cream], peach: ['#f2cfb3', '#f0c4a4', '#f5d6bc', '#eebfa0'],
      ochre: ['#e8c27a', '#ddb066', '#e9cb8a', '#d9a85a'], pastel: [PAL.cream, '#f6d3bd', '#f3e2a0', '#cfe3c8'] },
    awnings: { mix: [PAL.terra, '#c9922e', PAL.shutter, '#d88fb0'], terracotta: [PAL.terra, PAL.terra2, PAL.terra, PAL.terra2], mustard: ['#c9922e', '#d4a23a', '#c9922e', '#d4a23a'],
      green: [PAL.shutter, '#3f5e42', PAL.shutter, '#3f5e42'], rose: ['#d88fb0', '#c97a9a', '#d88fb0', '#c97a9a'] }
  };
  // an arch panel: the wall above an opening, with a true round hole (see-through). w = opening width, T = height above the springline.
  const spGeo = (w, T) => geo('spand' + w + '_' + T, () => { const s = new THREE.Shape(), r = w / 2; s.moveTo(-r, 0); s.lineTo(-r, T); s.lineTo(r, T); s.lineTo(r, 0); s.absarc(0, 0, r, 0, Math.PI, false); return new THREE.ShapeGeometry(s, 6); });
  const SPAN = (p, w, T, m, x, y, z, o) => put(p, spGeo(w, T), m, x, y, z, Object.assign({ edge: true }, o));   // y = springline
  // window with a stone frame and green shutters (8 tris); glass from winAt so copies batch and about 7 in 10 glow at night
  const sWin = (p, x, y, z, w, h, shut) => { P(p, w + 0.3, h + 0.3, CP.STONE, x, y - 0.15, z + 0.02); P(p, w, h, winAt(x, y, z), x, y, z + 0.04);
    if (shut !== false) [-1, 1].forEach(s => P(p, w * 0.48, h, PAL.shutter, x + s * (w * 0.74 + 0.15), y, z + 0.05)); };
  const bar = (p, w, x, y, z, ry) => B(p, w, 0.07, 0.07, CP.IRON, x, y, z, Object.assign({}, FLAT, { ry }));   // a thin railing bar
  const plant = (p, x, y, z, c) => oct(p, 0.3, c || PAL.leaf2, x, y + 0.3, z, { s: [0.32, 0.3, 0.32] });
  const stripes = (p, w, n, c1, c2, x, y, z, d) => { for (let i = 0; i < n; i++) put(p, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), i % 2 ? c2 : c1, x - w / 2 + (i + 0.5) * w / n, y, z, { rx: 0.42, s: [w / n, 0.1, d || 1.6], edge: false }); };   // striped awning
  const signBoard = (p, w, text, x, y, z) => { B(p, w, 0.55, 0.1, BK.DARK, x, y, z, FLAT); if (text) P(p, w - 0.2, 0.45, textMat(String(text).toUpperCase(), BK.DARK, '#f6d27a'), x, y + 0.05, z + 0.06); };
  const signList = o => o.signs || [o.sign1, o.sign2, o.sign3, o.sign4].map(s => s || '');

  // 1. arcadeRow: 4 shop-houses, 24 x 12 m, covered arcade with real arches along the front, one shop per bay,
  //    homes above (floors 3 or 4 in total), balconies with plants, green shutters, string lights between the arches.
  //    o.walls: 'warm' | 'cream' | 'peach' | 'ochre'; o.signs: [4 names] (or sign1..sign4); o.lights: 'on' | 'off'; o.floors: '3' | '4'.
  def({ key: 'arcadeRow', name: 'Arcade row', cat: 'Downtown', part: 2, budget: 900, size: '4 shop-houses · 24 × 12 m · 3–4 floors', night: true,
    opts: { walls: choices('Walls', ['warm', 'cream', 'peach', 'ochre']), floors: choices('Floors', ['3', '4']), lights: choices('String lights', ['on', 'off']), sign1: { label: 'Shop sign', choices: ['', 'CAFÉ', 'BAKERY', 'TAILOR'] } },
    make(o) {
      const g = new THREE.Group(), set = CP.walls[o.walls] || CP.walls.warm, signs = signList(o), nUp = (+o.floors || 3) - 1, GF = 4.6, FH = 3.2, H = GF + nUp * FH, D = 12, zf = 6, zs = 3.2;
      B(g, 24, 0.12, zf - zs, CP.PAVE, 0, 0, (zf + zs) / 2, { shadow: false });                    // arcade floor
      for (let i = 0; i < 4; i++) { const x = -9 + i * 6, c = set[i];
        B(g, 6, nUp * FH, D, c, x, GF, 0);                                                           // homes above
        B(g, 6, GF, zs + zf, c, x, 0, (zs - zf) / 2);             // shop behind the arcade (front at zs)
        SPAN(g, 4.4, GF - 2.4, c, x, 2.4, zf);                                                       // the arch over this bay
        P(g, 2.8, 2.3, BK.SHOPGL, x - 0.8, 0.35, zs + 0.03); P(g, 1.0, 2.4, PAL.shutter, x + 1.8, 0.12, zs + 0.03);
        signBoard(g, 3.4, signs[i], x - 0.4, 2.85, zs + 0.04);
        for (let f = 0; f < nUp; f++) { const y = GF + f * FH + 0.75; [-1.45, 1.45].forEach(k => sWin(g, x + k, y, zf, 1.0, 1.7)); P(g, 1.0, 1.5, winAt(x, y, -1), x, y, -zf - 0.03, { ry: Math.PI }); }
        B(g, 4.2, 0.16, 0.9, CP.STONE, x, GF + 0.02, zf + 0.45, NE); bar(g, 4.2, x, GF + 0.95, zf + 0.86);   // balcony on the first floor
        plant(g, x - 1.6, GF + 0.18, zf + 0.5, i % 2 ? PAL.pink : PAL.leaf2); plant(g, x + 1.6, GF + 0.18, zf + 0.5);
        if (o.lights !== 'off') { for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4; oct(g, 0.09, CP.BULB, x - 2.1 + 4.2 * t, 2.45 - 0.35 * (1 - Math.pow(2 * t - 1, 2)), zf + 0.15); } }
      }
      for (let i = 0; i <= 4; i++) { const px = i === 0 ? -11.2 : i === 4 ? 11.2 : -12 + i * 6; B(g, 1.6, GF, 0.8, set[Math.min(3, i)], px, 0, zf - 0.4); }   // piers between the arches
      B(g, 24.2, 0.3, 0.4, CP.STONE, 0, GF, zf + 0.05, NE);                                          // band over the arcade
      B(g, 24.4, 0.45, D + 0.5, CP.STONE, 0, H, 0, NE);                                              // cornice
      GABLE(g, D + 0.8, 2.4, 24.6, CP.ROOF, 0, H + 0.45, 0, { ry: Math.PI / 2 });                     // terracotta roof
      return g;
    } });

  // 2. blossomShopHouse: 4 narrow terraced shop-houses for a walking street, 20 x 10 m, no arcade. Café / small shop with a
  //    striped awning and an outdoor table, homes above, flower balconies, pastel walls, two heights so the row steps.
  //    o.walls: 'pastel' | 'warm' | 'peach'; o.awnings: 'mix' | 'terracotta' | 'mustard' | 'green' | 'rose'; o.signs.
  def({ key: 'blossomShopHouse', name: 'Shop-houses (walking street)', cat: 'Downtown', part: 2, budget: 900, size: '4 shop-houses · 20 × 10 m · 3–4 floors', night: true,
    opts: { walls: choices('Walls', ['pastel', 'warm', 'peach']), awnings: choices('Awnings', ['mix', 'terracotta', 'mustard', 'green', 'rose']), sign1: { label: 'Shop sign', choices: ['', 'CAFÉ', 'FLOWERS', 'GELATO'] } },
    make(o) {
      const g = new THREE.Group(), set = CP.walls[o.walls] || CP.walls.pastel, aw = CP.awnings[o.awnings] || CP.awnings.mix, signs = signList(o), zf = 5, FH = 3.1, GF = 3.8;
      for (let i = 0; i < 4; i++) { const x = -7.5 + i * 5, c = set[i], fl = i % 2 ? 4 : 3, H = GF + (fl - 1) * FH;
        B(g, 5, H, 10, c, x, 0, 0);
        P(g, 2.6, 2.3, BK.SHOPGL, x - 0.7, 0.35, zf + 0.03); P(g, 0.95, 2.4, PAL.shutter, x + 1.6, 0.1, zf + 0.03);
        stripes(g, 4.4, 4, aw[i], PAL.cream, x, 2.95, zf + 0.72, 1.5);                              // striped awning
        signBoard(g, 3.2, signs[i], x - 0.4, 3.25, zf + 0.04);
        CYL(g, 0.45, 0.45, 0.05, 6, PAL.cream, x - 0.7, 0.8, zf + 2.3, { edge: false }); B(g, 0.08, 0.8, 0.08, CP.IRON, x - 0.7, 0, zf + 2.3, FLAT);   // outdoor table
        for (let f = 0; f < fl - 1; f++) { const y = GF + f * FH + 0.65; [-1.2, 1.2].forEach(k => sWin(g, x + k, y, zf, 0.9, 1.5, f < 2)); P(g, 0.9, 1.4, winAt(x, y, -2), x, y, -zf - 0.03, { ry: Math.PI }); }
        B(g, 3.6, 0.15, 0.7, CP.STONE, x, GF + 0.02, zf + 0.35, NE); bar(g, 3.6, x, GF + 0.9, zf + 0.68);   // flower balcony
        plant(g, x - 1.3, GF + 0.17, zf + 0.4, PAL.pink); plant(g, x + 1.3, GF + 0.17, zf + 0.4, '#f2c14e');
        B(g, 5.2, 0.35, 10.4, CP.STONE, x, H, 0, NE); GABLE(g, 10.6, 1.8, 5.2, CP.ROOF, x, H + 0.35, 0, { ry: Math.PI / 2 });
      }
      return g;
    } });

  // 3. palazzoBlock: courtyard apartment block, 50 x 50 m, 5-8 floors. A square ring of homes round an inner garden
  //    (blossom trees, a small fountain), one big arched gate (front, +z), terracotta roofs, cornice, balconies, shutters.
  def({ key: 'palazzoBlock', name: 'Palazzo block', cat: 'Downtown', part: 2, budget: 2500, size: '50 × 50 m · courtyard · 5–8 floors', night: true,
    opts: { floors: choices('Floors', ['6', '5', '7', '8']), wall: colours('Walls', [PAL.cream, '#f2cfb3', '#e8c27a', '#ecc3b0']) },
    make(o) {
      const g = new THREE.Group(), n = Math.max(5, Math.min(8, +o.floors || 6)), W = o.wall || PAL.cream, GF = 4.2, FH = 3.3, H = GF + (n - 1) * FH, S = 25, Dw = 12, gw = 7;
      const yOf = f => f === 0 ? 0.9 : GF + (f - 1) * FH + 0.75;
      B(g, (S - gw / 2) - 0, H, Dw, W, -(S + gw / 2) / 2, 0, S - Dw / 2); B(g, S - gw / 2, H, Dw, W, (S + gw / 2) / 2, 0, S - Dw / 2);   // front wing either side of the gate
      B(g, gw, H - 7.6, Dw, W, 0, 7.6, S - Dw / 2);                                                   // over the gate
      SPAN(g, gw, 3.6, W, 0, 4, S); SPAN(g, gw, 3.6, W, 0, 4, S - Dw, { ry: Math.PI });             // the big arched gate, both faces
      B(g, 2 * S, H, Dw, W, 0, 0, -S + Dw / 2); [-1, 1].forEach(s => B(g, Dw, H, 2 * S - 2 * Dw, W, s * (S - Dw / 2), 0, 0));   // back + side wings
      // outer windows: shutters on the front, glass + frame on the other faces; balconies on the front
      [[0, true], [Math.PI / 2, false], [Math.PI, false], [-Math.PI / 2, false]].forEach(([ry, front]) => { const s = grp(grp(g, 0, 0, 0, ry), 0, 0, S);
        for (let i = 0; i < 10; i++) { const x = -22.5 + i * 5; if (front && Math.abs(x) < 5) continue;
          for (let f = 0; f < n; f++) { const y = yOf(f);
            if (front) { sWin(s, x, y, 0, 1.2, f ? 1.8 : 2.2, true); if (f >= 1 && f <= 3 && i % 3 === 1) { B(s, 2.6, 0.15, 0.8, CP.STONE, x, y - 0.75, 0.4, NE); bar(s, 2.6, x, y + 0.15, 0.78); plant(s, x + 0.9, y - 0.6, 0.45, PAL.pink); } }
            else { P(s, 1.4, 2.0, CP.STONE, x, y - 0.12, 0.02); P(s, 1.1, f ? 1.75 : 2.1, winAt(x, y, ry), x, y, 0.04); } } } });
      // courtyard windows (glass only)
      [[0, S - Dw], [Math.PI / 2, S - Dw], [Math.PI, S - Dw], [-Math.PI / 2, S - Dw]].forEach(([ry, d]) => { const s = grp(grp(g, 0, 0, 0, ry), 0, 0, d);
        for (let i = 0; i < 5; i++) { const x = -10 + i * 5; if (ry === 0 && i === 2) continue; for (let f = 0; f < n; f++) P(s, 1.1, 1.7, winAt(x, f, ry + 7), x, yOf(f), -0.03, { ry: Math.PI }); } });
      // cornice + terracotta roofs
      B(g, 2 * S + 1, 0.5, Dw + 1, CP.STONE, 0, H, S - Dw / 2, NE); B(g, 2 * S + 1, 0.5, Dw + 1, CP.STONE, 0, H, -S + Dw / 2, NE);
      [-1, 1].forEach(s => B(g, Dw + 1, 0.5, 2 * S - 2 * Dw, CP.STONE, s * (S - Dw / 2), H, 0, NE));
      [1, -1].forEach(s => GABLE(g, Dw + 1.2, 3.2, 2 * S + 1.2, CP.ROOF, 0, H + 0.5, s * (S - Dw / 2), { ry: Math.PI / 2 }));
      [-1, 1].forEach(s => GABLE(g, Dw + 1.2, 3.2, 2 * S - 2 * Dw, CP.ROOF, s * (S - Dw / 2), H + 0.5, 0));
      B(g, 2 * S + 0.4, 0.4, 0.4, CP.STONE, 0, GF, S + 0.05, NE);                                      // band over the ground floor (front)
      // inner garden: grass, cross paths, fountain, blossom trees
      const C = S - Dw; flat2(g, 2 * C, 2 * C, PAL.grass, 0, 0.06, 0); flat2(g, 3, 2 * C, CP.PAVE, 0, 0.08, 0); flat2(g, 2 * C, 3, CP.PAVE, 0, 0.08, 0);
      CYL(g, 2.6, 2.8, 0.7, 12, CP.STONE, 0, 0, 0, { open: true }); CYL(g, 2.5, 2.5, 0.5, 12, glowMat(PAL.water, '#3f8fb0'), 0, 0.1, 0, NE); CYL(g, 0.3, 0.45, 1.8, 6, CP.STONE, 0, 0.6, 0, NE);
      [[-7, -7], [7, -7], [-7, 7], [7, 7]].forEach(([x, z], i) => { CYL(g, 0.18, 0.25, 2.2, 5, PAL.wood, x, 0, z, { edge: false, open: true }); ICO(g, 2.2, 0, i % 2 ? PAL.leaf : PAL.pink, x, 3.6, z); });
      return g;
    } });

  // 4. officePalazzo: a stone office building, 30 x 22 m, 6-10 floors. Rusticated base, tall windows between pilasters,
  //    a strong cornice, terracotta or copper roof, grand arched entrance with steps, sign board, two flag poles. No balconies.
  def({ key: 'officePalazzo', name: 'Office palazzo', cat: 'Downtown', part: 2, budget: 1100, size: '30 × 22 m · 6–10 floors', night: true,
    opts: { floors: choices('Floors', ['8', '6', '10']), wall: colours('Stone', [PAL.cream, '#f2cfb3', '#e8c27a']), roof: choices('Roof', ['terracotta', 'copper']), sign: { label: 'Sign', choices: ['', 'VINLAND BANK', 'VINLAND POST'] } },
    make(o) {
      const g = new THREE.Group(), n = Math.max(6, Math.min(10, +o.floors || 8)), W = 30, D = 22, GF = 6, FH = 3.6, H = GF + (n - 1) * FH, ST = o.wall || PAL.cream;
      B(g, W, GF, D, CP.STONE, 0, 0, 0); B(g, W, H - GF, D, ST, 0, GF, 0);
      [[W, D, 0, 7], [D, W, Math.PI / 2, 5], [W, D, Math.PI, 7], [D, W, -Math.PI / 2, 5]].forEach(([fw, fd, ry, cols], k) => { const s = grp(grp(g, 0, 0, 0, ry), 0, 0, fd / 2);
        for (let i = 1; i < cols; i++) B(s, 0.7, H - GF, 0.4, ST, -fw / 2 + i * fw / cols, GF, 0.1, { edge: false });   // pilasters
        for (let f = 1; f < n; f++) for (let i = 0; i < cols; i++) { const x = -fw / 2 + (i + 0.5) * fw / cols; P(s, 1.8, 2.7, winAt(x, f, k), x, GF + (f - 1) * FH + 0.45, 0.04); }
        for (let i = 0; i < cols; i++) { const x = -fw / 2 + (i + 0.5) * fw / cols; if (k === 0 && i === (cols - 1) / 2) continue; P(s, 2, 2.8, winAt(x, 0, k), x, 0.9, 0.04); ARCH(s, 2, winAt(x, 0, k), x, 3.7, 0.04); } });
      B(g, W + 1.2, 0.5, D + 1.2, ST, 0, GF - 0.25, 0, NE);                                              // band over the base
      B(g, W + 1.8, 1.1, D + 1.8, CP.STONE, 0, H, 0);                                                    // strong cornice
      HIP(g, W + 1.2, 4.5, D + 1.2, o.roof === 'copper' ? PAL.copper : CP.ROOF, 0, H + 1.1, 0);
      // grand entrance: arched doorway, steps, sign, flag poles
      const DOORG = glowMat(PAL.glassWarm, '#ffcf6a');
      P(g, 4.4, 5.2, CP.STONE, 0, 0.8, D / 2 + 0.05, { edge: true }); P(g, 3.4, 3.1, DOORG, 0, 0.8, D / 2 + 0.07); ARCH(g, 3.4, DOORG, 0, 3.9, D / 2 + 0.07);
      for (let i = 0; i < 3; i++) B(g, 9 - i * 1.2, 0.27, 1, CP.STONE, 0, i * 0.27, D / 2 + 2.4 - i, NE);
      B(g, 13, 0.85, 0.25, BK.DARK, 0, 5.75 - 0.1, D / 2 + 0.15, FLAT); if (o.sign) P(g, 12.6, 0.7, textMat(String(o.sign).toUpperCase(), BK.DARK, '#f6d27a'), 0, 5.72, D / 2 + 0.3);
      [-5.5, 5.5].forEach((x, i) => { CYL(g, 0.08, 0.1, 9, 6, '#c9ced2', x, 0.8, D / 2 + 3, { edge: false, open: true }); B(g, 2, 1.25, 0.04, i ? PAL.copper : PAL.terra, x + 1.05, 8.3, D / 2 + 3, FLAT); });
      return g;
    } });

  // 5. bigBusiness: one big-lot business, 40 x 30 m, 2-3 floors, warm stone + arches + terracotta. o.type: cinema | hotel |
  //    supermarket | carShowroom | gym | garage. o.sign = the name on the big sign (default: the type).
  const BIZ = { cinema: 'CINEMA', hotel: 'HOTEL', supermarket: 'MARKET', carShowroom: 'CAR SHOWROOM', gym: 'GYM', garage: 'GARAGE' };
  def({ key: 'bigBusiness', name: 'Big business', cat: 'Downtown', part: 2, budget: 900, size: '40 × 30 m · 2–3 floors', night: true,
    opts: { type: choices('Type', Object.keys(BIZ)), wall: colours('Stone', [PAL.cream, '#f2cfb3', '#e8c27a']), sign: { label: 'Sign', choices: ['', 'VINLAND'] } },
    make(o) {
      const g = new THREE.Group(), t = BIZ[o.type] ? o.type : 'cinema', ST = o.wall || PAL.cream, W = 40, D = 30, zf = 15, GF = 5.2, FH = 4, fl = t === 'hotel' ? 3 : 2, H = GF + (fl - 1) * FH;
      const glassFront = t === 'supermarket' || t === 'carShowroom', deep = t === 'carShowroom' ? 10 : 0;
      B(g, W, H, D - deep, ST, 0, 0, -deep / 2);                                                      // the building
      if (deep) { B(g, W, 0.3, deep, CP.PAVE, 0, 0, zf - deep / 2, { shadow: false }); B(g, W + 0.4, 0.6, deep + 0.4, CP.STONE, 0, H - 0.6, zf - deep / 2);   // showroom hall: floor, roof
        [-1, 1].forEach(s => B(g, 1, H - 0.6, deep, ST, s * (W / 2 - 0.5), 0, zf - deep / 2)); }
      // upper floors: shuttered windows on the front, glass on the sides
      for (let f = 1; f < fl; f++) for (let i = 0; i < 8; i++) { const x = -17.5 + i * 5; sWin(g, x, GF + (f - 1) * FH + 0.8, zf, 1.4, 2.2, t === 'hotel'); }
      [-1, 1].forEach(s => { const sd = grp(g, s * W / 2, 0, 0, s * Math.PI / 2); for (let f = 0; f < fl; f++) for (let i = 0; i < 5; i++) P(sd, 1.6, 2.3, winAt(i, f, s), -12 + i * 6, (f ? GF + (f - 1) * FH : 0) + 1.2, 0.04); });
      // ground floor front
      if (glassFront) { P(g, W - 3, GF - 0.8, t === 'carShowroom' ? CP.GLASS_SEE : BK.SHOPGL, 0, 0.3, zf + 0.04, { edge: true }); for (let i = 1; i < 6; i++) B(g, 0.3, GF - 0.6, 0.3, CP.STONE, -W / 2 + i * W / 6, 0, zf, FLAT); }
      else if (t === 'gym') { for (let i = 0; i < 6; i++) { const x = -16.5 + i * 6.6; P(g, 4, GF + FH - 2.6, BK.SHOPGL, x, 0.6, zf + 0.04); ARCH(g, 4, BK.SHOPGL, x, GF + FH - 2, zf + 0.04); } }
      else if (t === 'garage') { [-12, 0, 12].forEach((x, i) => { P(g, 8, 4.4, i === 2 ? '#3a3a3a' : '#9aa3a8', x, 0.1, zf + 0.04, { edge: true }); if (i < 2) [1.4, 2.6, 3.8].forEach(y => B(g, 8, 0.06, 0.05, '#7d858a', x, y, zf + 0.07, FLAT)); }); }
      else { for (let i = 0; i < 5; i++) { const x = -16 + i * 8; P(g, 4, 2.6, BK.SHOPGL, x, 0.5, zf + 0.04); ARCH(g, 4, BK.SHOPGL, x, 3.1, zf + 0.04); } }
      B(g, W + 0.8, 0.5, 0.5, CP.STONE, 0, GF - 0.25, zf + 0.1, NE);
      B(g, W + 1.4, 0.8, D + 1.4, CP.STONE, 0, H, 0, NE); HIP(g, W + 0.8, 2.6, D + 0.8, CP.ROOF, 0, H + 0.8, 0);   // cornice + roof
      // the big sign on the roof front
      const name = String(o.sign || BIZ[t]).toUpperCase(); B(g, 24, 3.2, 0.5, BK.DARK, 0, H + 0.6, zf - 0.6); P(g, 23, 2.6, textMat(name, BK.DARK, '#f6d27a'), 0, H + 0.9, zf - 0.33);
      [-10, 10].forEach(x => B(g, 0.3, 3, 0.3, CP.IRON, x, H + 0.6, zf - 1.2, FLAT));
      // type details
      if (t === 'cinema') { B(g, 28, 1.6, 4, '#7a3a2e', 0, GF - 1.6, zf + 2); for (let i = 0; i < 14; i++) oct(g, 0.14, CP.BULB, -13.5 + i * (27 / 13), GF - 1.75, zf + 4.05);   // marquee with bulbs
        [-14, 14].forEach(x => { B(g, 3, 4, 0.2, BK.DARK, x, 0.6, zf + 0.15, FLAT); P(g, 2.6, 3.6, glowMat('#d88fb0', '#a84a6a'), x, 0.8, zf + 0.27); }); }
      if (t === 'hotel') { B(g, 10, 0.4, 6, CP.STONE, 0, 3.6, zf + 3); [-4.5, 4.5].forEach(x => B(g, 0.3, 3.6, 0.3, CP.IRON, x, 0, zf + 5.7, FLAT)); P(g, 3, 3, glowMat(PAL.glassWarm, '#ffcf6a'), 0, 0.2, zf + 0.06);
        [-14, -10, 10, 14].forEach((x, i) => { CYL(g, 0.08, 0.1, 9, 6, '#c9ced2', x, 0, zf + 1.6, { edge: false, open: true }); B(g, 1.8, 1.1, 0.04, [PAL.terra, PAL.copper, '#c9922e', PAL.terra][i], x + 0.95, 7.6, zf + 1.6, FLAT); }); }
      if (t === 'supermarket') for (let i = 0; i < 4; i++) { const x = -15 + i * 1.1; B(g, 0.6, 0.55, 0.95, '#9aa3a8', x, 0.35, zf + 2.4, FLAT); B(g, 0.6, 0.06, 0.06, CP.IRON, x, 1.0, zf + 2.85, FLAT); }   // trolleys
      if (t === 'carShowroom') { const c1 = KIT.carSports({}), c2 = KIT.carSedan({}); c1.position.set(-8, 0.3, zf - 5); c1.rotation.y = 0.5; c2.position.set(8, 0.3, zf - 5); c2.rotation.y = -0.5; g.add(c1, c2); }
      if (t === 'garage') { const lift = grp(g, 12, 0, zf + 6); [-1.6, 1.6].forEach(x => B(lift, 0.4, 3.6, 0.4, '#c9922e', x, 0, 0, NE)); B(lift, 3.6, 0.2, 4.6, '#55504a', 0, 1.8, 0, NE);
        const car = KIT.carHatch({}); car.position.y = 2; lift.add(car); }
      return g;
    } });

  // 7. canal set: water channels with stone edges (water sits a bit below the edge), a stone footbridge and a rowing boat.
  const CANAL = { EDGE: '#e2d6bd', COPE: '#efe6d2', WATER: glowMat(PAL.water, '#2f6f8a') }, yW = 0.25, yE = 0.85;
  const waterPlane = (p, w, d, x, z) => put(p, geo('pane', () => new THREE.PlaneGeometry(1, 1)), CANAL.WATER, x, yW, z, { rx: -Math.PI / 2, s: [w, d, 1], edge: false, shadow: false });
  def({ key: 'canalStraight', name: 'Canal (straight)', cat: 'Downtown', part: 2, budget: 60, size: '10 × 24 m · 8 m of water', opts: {},
    make() { const g = new THREE.Group(); waterPlane(g, 8, 24, 0, 0);
      [-1, 1].forEach(s => { B(g, 1, yE, 24, CANAL.EDGE, s * 4.5, 0, 0); B(g, 1.3, 0.14, 24, CANAL.COPE, s * 4.6, yE, 0, NE); }); return g; } });
  def({ key: 'canalCorner', name: 'Canal (corner)', cat: 'Downtown', part: 2, budget: 80, size: '10 × 10 m · turns from -z to +x', opts: {},
    make() { const g = new THREE.Group(); waterPlane(g, 9, 9, 0.5, -0.5);
      B(g, 1, yE, 10, CANAL.EDGE, -4.5, 0, 0); B(g, 9, yE, 1, CANAL.EDGE, 0.5, 0, 4.5); B(g, 1, yE, 1, CANAL.EDGE, 4.5, 0, -4.5);   // outer walls + inner corner post
      B(g, 1.3, 0.14, 10, CANAL.COPE, -4.6, yE, 0, NE); B(g, 9.4, 0.14, 1.3, CANAL.COPE, 0.4, yE, 4.6, NE); B(g, 1.3, 0.14, 1.3, CANAL.COPE, 4.6, yE, -4.6, NE); return g; } });
  def({ key: 'stoneBridge', name: 'Stone footbridge', cat: 'Downtown', part: 2, budget: 180, size: '13 × 3 m · spans the canal (along x)', opts: {},
    make() { const g = new THREE.Group(), SB = '#e8dcc2', side = geo('bridgeSide', () => { const s = new THREE.Shape();
        s.moveTo(-6.5, 0); s.lineTo(-6.5, 1.0); s.lineTo(-2, 2.2); s.lineTo(2, 2.2); s.lineTo(6.5, 1.0); s.lineTo(6.5, 0); s.lineTo(4, 0); s.lineTo(4, 0.5);
        s.absellipse(0, 0.5, 4, 1.15, 0, Math.PI, false); s.lineTo(-4, 0); return new THREE.ShapeGeometry(s, 8); });
      put(g, side, SB, 0, 0, 1.5, { edge: true }); put(g, side, SB, 0, 0, -1.5, { edge: true, ry: Math.PI });
      const seg = (x1, y1, x2, y2, w, h, z, m) => put(g, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), m, (x1 + x2) / 2, (y1 + y2) / 2 - h / 2, z, { rz: Math.atan2(y2 - y1, x2 - x1), s: [Math.hypot(x2 - x1, y2 - y1) + 0.05, h, w], edge: false });
      [[-6.5, 1.0, -2, 2.2], [-2, 2.2, 2, 2.2], [2, 2.2, 6.5, 1.0]].forEach(([a, b, c, d]) => { seg(a, b, c, d, 3, 0.3, 0, '#ddd0b4'); [-1.35, 1.35].forEach(z => seg(a, b + 0.7, c, d + 0.7, 0.3, 0.7, z, SB)); });
      return g; } });
  def({ key: 'smallBoat', name: 'Small boat', cat: 'Downtown', part: 2, budget: 80, size: '1.4 × 3.8 m rowing boat', opts: { body: colours('Colour', [PAL.terra, '#3f7fbf', PAL.shutter, '#f6f0e2', '#e8b830']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || PAL.terra);
      TAPER(g, 1.0, 0.55, 3.4, b, 0, 0, 0, { tw: 1.35, td: 1.1 }); B(g, 1.25, 0.04, 3.4, '#8a6a46', 0, 0.42, 0, FLAT);
      [-0.7, 0.6].forEach(z => B(g, 1.3, 0.08, 0.35, '#b98b5e', 0, 0.5, z, NE));
      [-1, 1].forEach(s => strut(g, [s * 0.7, 0.62, 0.1], [s * 1.9, 0.18, -0.6], 0.06, '#b98b5e')); return g; } });

  // 8. market: stall + food cart
  const GOODS = { fruit: ['#e8473a', '#f2c14e', '#7fb069', '#e8873a', '#e8473a', '#7fb069'], flowers: [PAL.pink, '#f2c14e', '#f6f0e2', '#a084c8', PAL.pink, '#e8473a'],
    spices: ['#c9922e', '#b5543a', '#8a5a2b', '#e8b830', '#6b8a3a', '#c8603f'], clothes: ['#3f7fbf', PAL.terra, '#2f7a68', '#d88fb0'] };
  def({ key: 'marketStall', name: 'Market stall', cat: 'Downtown', part: 2, budget: 240, size: '3 × 1.8 m', opts: { canopy: colours('Canopy', [PAL.terra, '#2f7a68', '#c9922e', '#3f7fbf', '#d88fb0']), goods: choices('Goods', ['fruit', 'flowers', 'clothes', 'spices']) },
    make(o) { const g = new THREE.Group(), cn = slot('canopy', o.canopy || PAL.terra), gd = GOODS[o.goods] ? o.goods : 'fruit', G = GOODS[gd];
      B(g, 2.8, 0.9, 1.2, PAL.wood, 0, 0, 0); [[-1.35, -0.55], [1.35, -0.55], [-1.35, 0.55], [1.35, 0.55]].forEach(([x, z]) => B(g, 0.1, z < 0 ? 2.5 : 2.2, 0.1, '#5a3c28', x, 0, z, FLAT));
      for (let i = 0; i < 4; i++) put(g, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), i % 2 ? PAL.cream : cn, -1.2 + i * 0.8, 2.38, 0.05, { rx: 0.25, s: [0.8, 0.08, 1.9], edge: false });   // striped canopy
      if (gd === 'fruit') { [-0.8, 0.8].forEach(x => B(g, 1.1, 0.25, 0.9, '#b98b5e', x, 0.9, 0, NE)); G.forEach((c, i) => oct(g, 0.17, c, -1.15 + i * 0.46, 1.25, (i % 2) * 0.3 - 0.15)); }
      if (gd === 'flowers') G.forEach((c, i) => { const x = -1.1 + i * 0.44; CYL(g, 0.16, 0.13, 0.3, 6, '#9aa3a8', x, 0.9, 0.15, { edge: false, open: true }); oct(g, 0.2, c, x, 1.4, 0.15); });
      if (gd === 'spices') G.forEach((c, i) => CYL(g, 0.02, 0.22, 0.3, 6, c, -1.1 + i * 0.44, 0.9, 0, { edge: false, open: true }));
      if (gd === 'clothes') { B(g, 2.6, 0.05, 0.05, CP.IRON, 0, 2.0, 0.55, FLAT); G.forEach((c, i) => B(g, 0.5, 0.75, 0.06, c, -0.9 + i * 0.6, 1.2, 0.55, FLAT)); }
      return g; } });
  def({ key: 'foodCart', name: 'Food cart', cat: 'Downtown', part: 2, budget: 180, size: '1.8 × 1 m + umbrella', night: true, opts: { body: colours('Colour', ['#2f7a68', PAL.terra, '#e8b830', '#3f7fbf']) },
    make(o) { const g = new THREE.Group(), b = slot('body', o.body || '#2f7a68');
      B(g, 1.8, 0.85, 1, b, 0, 0.35, 0); B(g, 1.9, 0.08, 1.1, PAL.cream, 0, 1.2, 0, NE); WHEEL(g, 0.35, 0.1, -0.95, 0, 8); WHEEL(g, 0.35, 0.1, 0.95, 0, 8);
      B(g, 0.06, 0.06, 0.8, CP.IRON, 0.6, 0.95, -0.85, FLAT); B(g, 0.05, 2.0, 0.05, CP.IRON, 0, 1.28, 0, FLAT);
      CYL(g, 0.05, 1.3, 0.45, 8, PAL.cream, 0, 3.1, 0, { open: true }); oct(g, 0.1, CP.BULB, 0, 2.9, 0); B(g, 1.4, 0.3, 0.04, PAL.cream, 0, 0.75, 0.52, FLAT); return g; } });

  // 9. piazza: grand fountain + event stage
  def({ key: 'grandFountain', name: 'Grand fountain', cat: 'Downtown', part: 2, budget: 450, size: '14 m across', night: true, opts: {},
    make() { const g = new THREE.Group(), ST = '#e8dcc2', WT = glowMat(PAL.water, '#3f8fb0'), SPR = glowMat('#cdeaf3', '#6ec3dc');
      CYL(g, 7, 7.3, 0.9, 16, ST, 0, 0, 0, { open: true }); CYL(g, 7.4, 7.4, 0.2, 16, ST, 0, 0.9, 0, { open: true, edge: false }); CYL(g, 6.9, 6.9, 0.6, 16, WT, 0, 0.05, 0, NE);
      CYL(g, 1.6, 2.1, 2.4, 8, ST, 0, 0.6, 0); CYL(g, 3.6, 1.6, 0.8, 12, ST, 0, 3.0, 0); CYL(g, 3.4, 3.4, 0.2, 12, WT, 0, 3.65, 0, NE);
      CYL(g, 0.7, 1.0, 1.8, 8, ST, 0, 3.8, 0); CYL(g, 1.8, 0.7, 0.6, 10, ST, 0, 5.6, 0); CYL(g, 1.7, 1.7, 0.15, 10, WT, 0, 6.08, 0, NE);
      CYL(g, 0.25, 0.4, 1.2, 6, ST, 0, 6.2, 0); oct(g, 0.35, '#e2b04a', 0, 7.6, 0); CYL(g, 0.06, 1.3, 2, 8, SPR, 0, 7.8, 0, { open: true, edge: false }); return g; } });
  def({ key: 'eventStage', name: 'Event stage', cat: 'Downtown', part: 2, budget: 250, size: '12 × 7 m', night: true, opts: {},
    make() { const g = new THREE.Group(), ST = '#e8dcc2';
      B(g, 12, 1.2, 7, ST, 0, 0, 0); [0, 1, 2].forEach(i => B(g, 4, 0.4 * (3 - i), 0.5, ST, 0, 0, 3.75 + i * 0.5, NE));
      [-5.25, 5.25].forEach(x => B(g, 1.5, 7, 0.8, ST, x, 1.2, -3.1));                             // back wall: two piers + an arch with a lit backdrop
      SPAN(g, 9, 4.6, ST, 0, 3.6, -2.7); B(g, 12, 0.6, 1, PAL.terra, 0, 8.2, -3.1, NE);
      P(g, 9, 7, glowMat('#6a4a8c', '#a84a8a'), 0, 1.2, -3.2);
      [-5.6, 5.6].forEach(x => B(g, 0.25, 6, 0.25, CP.IRON, x, 1.2, 3.2, FLAT)); B(g, 11.6, 0.3, 0.3, CP.IRON, 0, 7.1, 3.2, FLAT);   // light truss
      ['#e8473a', '#f2c14e', '#3f7fbf', '#5fbf6a'].forEach((c, i) => B(g, 0.6, 0.5, 0.6, glowMat(c, c), -3.6 + i * 2.4, 6.6, 3.2, NE));
      [-5, 5].forEach(x => B(g, 1.1, 1.8, 0.9, CP.IRON, x, 1.2, 2.4)); return g; } });

  // 10. blossomTree: street tree in a square stone pit, very cheap (repeat 200+ times). o.kind: pink | white | green.
  def({ key: 'blossomTree', name: 'Blossom tree', cat: 'Downtown', part: 2, budget: 50, size: '1.8 m pit · 6 m tall', opts: { kind: choices('Tree', ['pink', 'white', 'green']) },
    make(o) { const g = new THREE.Group(), c = { pink: PAL.pink, white: '#f6eef0', green: PAL.leaf }[o.kind] || PAL.pink;
      B(g, 1.8, 0.14, 1.8, '#d2c7b2', 0, 0, 0, { shadow: false }); put(g, geo('pane', () => new THREE.PlaneGeometry(1, 1)), '#6b4f3a', 0, 0.15, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [1.4, 1.4, 1] }));
      CYL(g, 0.14, 0.2, 3, 5, PAL.wood, 0, 0.1, 0, { edge: false, open: true }); ICO(g, 2.1, 0, c, 0, 4.4, 0); return g; } });

  // 6. Vinland Tower, 'campanile' style (15 Nov, the new default): a tall square bell-and-clock tower in cream stone with
  //    terracotta-brick bands, clock faces on all 4 sides, an open belfry with arches and a bell, then a glowing lantern and a
  //    terracotta spire with a red beacon (about 262 m, still the tallest). o.state 'site' = the lower third built, scaffolding,
  //    a big crane and a sign (it opens at 10,000 citizens). Same plaza and footprint as the other styles.
  function campanile(o) {
    const g = new THREE.Group(), site = o.state === 'site';
    towerPlaza(g, '#f3ede1', PAL.sand2);
    const ST = glowMat(PAL.cream, '#6a5a40'), BR = glowMat(PAL.terra2, '#4a2a1c'), DARK = '#6a5a48', LANT = glowMat('#f6e3a8', '#fff0b8'), FACE = glowMat('#f6f3ea', '#fff3c4'), DOORG = glowMat(PAL.glassWarm, '#ffcf6a');
    const W = 24, y0 = 12, top = site ? 66 : 180;
    B(g, 36, y0, 36, CP.STONE, 0, 0.3, 0); B(g, 37, 1, 37, BR, 0, y0, 0, NE);                       // base with an arched door on each side
    [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, 18.03); P(s, 6, 6, DOORG, 0, 0.3, 0); ARCH(s, 6, DOORG, 0, 6.3, 0); });
    B(g, W, top - y0, W, ST, 0, y0 + 1, 0);                                                       // the shaft
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 2.2, top - y0, 2.2, ST, a * (W / 2 - 0.6), y0 + 1, b * (W / 2 - 0.6), NE));   // corner strips
    for (let y = y0 + 22; y < top - 4; y += 22) B(g, W + 1, 1.6, W + 1, BR, 0, y, 0, NE);         // terracotta-brick bands
    [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, W / 2 + 0.03);
      for (let y = y0 + 6; y < top - 8; y += 22) [-4.5, 4.5].forEach(x => { P(s, 1.6, 9, winAt(x, y, k), x, y, 0); ARCH(s, 1.6, winAt(x, y, k), x, y + 9, 0); }); });
    if (!site) {
      let y = top; B(g, W + 2, 20, W + 2, ST, 0, y, 0);                                            // clock stage
      [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, W / 2 + 1.03);
        put(s, geo('clockface', () => new THREE.CircleGeometry(1, 12)), FACE, 0, y + 10, 0, { edge: true, s: [7, 7, 1], shadow: false });
        put(s, geo('ring', () => new THREE.RingGeometry(0.96, 1, 24)), BR, 0, y + 10, 0.02, { edge: false, shadow: false, s: [7.6, 7.6, 1] });
        B(s, 0.4, 5, 0.1, BK.DARK, 0, y + 10, 0.05, FLAT); B(s, 3.6, 0.4, 0.1, BK.DARK, 1.8, y + 10, 0.05, FLAT); });
      y += 20; B(g, W + 4, 1.6, W + 4, BR, 0, y, 0); y += 1.6;
      // open belfry: 4 corner piers, an arch on each face, a bell inside
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 5, 22, 5, ST, a * 10, y, b * 10));
      B(g, W, 0.8, W, ST, 0, y, 0, NE);
      [0, 1, 2, 3].forEach(k => SPAN(grp(g, 0, 0, 0, k * Math.PI / 2), 15, 12, ST, 0, y + 10, W / 2, {}));
      CYL(g, 1.2, 3.6, 5, 10, '#a8864a', 0, y + 9, 0); CYL(g, 0.5, 0.5, 4, 6, DARK, 0, y + 14, 0, NE);
      B(g, W - 2, 0.4, W - 2, glowMat(PAL.cream, '#ffd98a'), 0, y + 21.4, 0, NE);                       // belfry ceiling, lit warm at night
      y += 22; B(g, W + 4, 1.4, W + 4, BR, 0, y, 0); y += 1.4;
      CYL(g, 6, 6, 9, 8, LANT, 0, y, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; B(g, 0.6, 8, 0.6, ST, Math.sin(a) * 6.1, y, Math.cos(a) * 6.1, FLAT); }   // lantern
      y += 9; CYL(g, 7, 7, 0.8, 8, BR, 0, y, 0, NE); y += 0.8;
      CYL(g, 0.25, 6.4, 26, 8, glowMat(CP.ROOF, '#6a2a14'), 0, y, 0); y += 26; oct(g, 0.7, '#e2b04a', 0, y + 0.4, 0); BALL(g, 0.9, glowMat('#ff4a30', '#ff3a20'), 0, y + 1.8, 0, NE);
    } else {
      // building site: ragged top, scaffolding on all 4 sides, a big tower crane, materials and a sign
      [[-6, 4], [5, 6], [-2, 3]].forEach(([x, h], i) => B(g, 6, h, 6, ST, x, top + 1, i === 1 ? 6 : -5, NE));
      const SC = '#8a8f94', NET = '#5f8a5a';
      [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, W / 2 + 1.6);
        [-12, -6, 0, 6, 12].forEach(x => B(s, 0.25, top + 8, 0.25, SC, x, 0.3, 0, FLAT));
        for (let y = y0 + 6; y <= top + 6; y += 8) B(s, 25, 0.25, 1.6, '#b98b5e', 0, y, -0.6, FLAT);
        P(s, 25, 10, NET, 0, top - 4, 0.15, { edge: true }); });
      const cr = KIT.towerCrane(); cr.scale.setScalar(2); cr.position.set(26, 0.3, -26); cr.rotation.y = -Math.PI * 0.75; g.add(cr);
      const mt = KIT.materials(); mt.position.set(24, 0.3, 14); g.add(mt);
      const bd = KIT.milestoneBoard({ text: o.boardText || 'Vinland Tower · opens at 10,000 citizens' }); bd.position.set(-14, 0.3, 30); g.add(bd); g.userData.setText = bd.userData.setText;
    }
    return g;
  }

  // ================= NEW DISTRICT LOOKS (Assets chat, 16 Nov): samples for Dev to choose a feel =================
  // Garden suburb (pastel cottages, picket fences, front gardens) and hill village (stone houses on terraces, stairs,
  // pergolas, olive + cypress). Each look has a home for 1 citizen and a home for 4 citizens living together.
  // Name plates: o.names = ['@a', '@b', '@c', '@d'] (blank brass plates if not given, so copies still batch). Night: windows glow.
  const ND = {
    suburb: { mint: ['#cfe3c8', PAL.shutter], butter: ['#f3e2a0', '#3f5866'], peach: ['#f6d3bd', PAL.terra2], sky: ['#cfe0ec', '#3f5866'] },
    stone: { warm: '#dccdb0', honey: '#e3cd9e', grey: '#cfc7b6', white: '#f2ede2' },
    PICKET: '#f6f3ea', BRASS: '#c9a24a', OLIVE: '#9aab7a', BASE: '#b8ab92'
  };
  const plates = (p, names, n, x, y, z, ry) => { const s = grp(p, x, y, z, ry); B(s, 0.9, 0.22 * n + 0.1, 0.06, '#5a3c28', 0, 0, 0, FLAT);
    for (let i = 0; i < n; i++) { const t = names && names[i]; P(s, 0.8, 0.18, t ? textMat(String(t), ND.BRASS, '#2f2b28') : ND.BRASS, 0, 0.06 + i * 0.22, 0.04); } };
  function picket(p, x1, x2, z) {                                       // white picket fence along x, from x1 to x2
    const L = x2 - x1, n = Math.max(2, Math.round(L / 0.55)); B(p, L, 0.08, 0.06, ND.PICKET, (x1 + x2) / 2, 0.75, z, FLAT); B(p, L, 0.08, 0.06, ND.PICKET, (x1 + x2) / 2, 0.4, z, FLAT);
    for (let i = 0; i <= n; i++) TAPER(p, 0.12, 1.0, 0.05, ND.PICKET, x1 + i * L / n, 0.2, z + 0.04, { tw: 0.15, td: 1 }, FLAT);
  }
  const olive = (p, x, y, z, s) => { s = s || 1; CYL(p, 0.16 * s, 0.26 * s, 1.6 * s, 5, '#7a6a52', x, y, z, { edge: false, open: true }); ICO(p, 1.5 * s, 0, ND.OLIVE, x, y + 2.3 * s, z, { s: [1.5 * s, 0.9 * s, 1.5 * s] }); };
  const ramp = (p, w, h, d, m, x, y, z, ry) => TAPER(grp(p, x, y, z, ry), w, h, d, m, 0, 0, 0, { tw: 1, td: 0.06, tz: -0.47 });   // a stair as one wedge, high end at -z
  const lilWin = (p, x, y, z, w, h) => { P(p, w + 0.24, h + 0.24, '#efe6d2', x, y - 0.12, z + 0.02); P(p, w, h, winAt(x, y, z), x, y, z + 0.04); [-1, 1].forEach(s => P(p, w * 0.5, h, PAL.shutter, x + s * (w * 0.75 + 0.12), y, z + 0.05)); };

  // --- Garden suburb, 1 citizen: pastel cottage, porch, dormer, front garden, picket fence, gate, letterbox. 10 x 10 m.
  def({ key: 'gsCottage', name: 'Suburb cottage (1 home)', cat: 'New District', part: 2, budget: 700, size: '10 × 10 m · 1.5 floors · 1 citizen', night: true,
    opts: { set: choices('Colours', Object.keys(ND.suburb)) },
    make(o) {
      const g = new THREE.Group(), [W, DR] = ND.suburb[o.set] || ND.suburb.mint, zf = 1.4;
      B(g, 10, 0.2, 10, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 1.3, 0.05, 3.4, PAL.sand, 0, 0.2, 3.2, FLAT);
      B(g, 7, 3.2, 5.6, W, 0, 0.2, -1.4); GABLE(g, 6.6, 2.6, 7.8, CP.ROOF, 0, 3.4, -1.4, { ry: Math.PI / 2 });
      B(g, 1.8, 1.3, 1.5, W, 0, 3.7, 0.7); GABLE(g, 2.1, 0.9, 1.9, CP.ROOF, 0, 5.0, 0.75); P(g, 1.0, 0.8, winAt(0, 4, 1), 0, 4.0, 1.47);   // dormer
      B(g, 3.4, 0.3, 1.9, '#efe6d2', 0, 0.2, zf + 0.95); [-1.5, 1.5].forEach(x => B(g, 0.18, 2.5, 0.18, ND.PICKET, x, 0.5, zf + 1.75, NE));   // porch
      put(g, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), CP.ROOF, 0, 3.05, zf + 1.0, { rx: 0.18, s: [3.8, 0.14, 2.2] });
      P(g, 1.0, 2.1, DR, 0, 0.5, zf + 0.03); [-2.4, 2.4].forEach(x => lilWin(g, x, 1.1, zf, 1.1, 1.4));
      [-1, 1].forEach(s => P(g, 1.1, 1.3, winAt(s, 1, 9), s * 3.51, 1.2, -1.4, { ry: s * Math.PI / 2 }));
      picket(g, -4.9, -0.8, 4.85); picket(g, 0.8, 4.9, 4.85); [-0.8, 0.8].forEach(x => B(g, 0.2, 1.2, 0.2, ND.PICKET, x, 0.2, 4.85, NE));
      B(g, 0.1, 1.1, 0.1, '#5a3c28', 1.3, 0.2, 4.4, FLAT); B(g, 0.45, 0.32, 0.3, DR, 1.3, 1.3, 4.4, NE); plates(g, o.names, 1, 1.3, 0.85, 4.47, 0);   // letterbox + name plate
      [[-3.6, 3.6], [-2.2, 3.9], [2.6, 3.8], [3.8, 3.5]].forEach(([x, z], i) => plant(g, x, 0.2, z, [PAL.pink, '#f2c14e', '#a084c8', PAL.pink][i]));
      CYL(g, 0.14, 0.2, 2.2, 5, PAL.wood, -3.8, 0.2, -4.2, { edge: false, open: true }); ICO(g, 1.7, 0, PAL.pink, -3.8, 3.4, -4.2);
      hedge(g, 0.8, 5, 4.6, -1.8);
      return g;
    } });

  // --- Garden suburb, 4 citizens: a big two-storey house split into 4 homes (2 down, 2 up by outside stairs), one shared
  //     garden, picket fence, 4 letterboxes + a name board by the gate. 20 x 16 m lot.
  def({ key: 'gsHouse4', name: 'Suburb house for 4', cat: 'New District', part: 2, budget: 1300, size: '20 × 16 m · 2 floors · 4 citizens', night: true,
    opts: { set: choices('Colours', Object.keys(ND.suburb)) },
    make(o) {
      const g = new THREE.Group(), [W, DR] = ND.suburb[o.set] || ND.suburb.butter, zb = -2.5, D = 8, zf = zb + D / 2, FH = 3.2;
      B(g, 20, 0.2, 16, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 1.6, 0.05, 6.4, PAL.sand, 0, 0.2, 4.6, FLAT);
      B(g, 13, 2 * FH, D, W, 0, 0.2, zb); B(g, 13.4, 0.22, D + 0.4, '#efe6d2', 0, 0.2 + FH - 0.1, zb, NE);
      HIP(g, 14.6, 3, D + 1.6, CP.ROOF, 0, 0.2 + 2 * FH, zb);
      // ground: two front doors under one porch, big windows either side
      B(g, 5.2, 0.3, 1.8, '#efe6d2', 0, 0.2, zf + 0.9); [-2.4, 2.4].forEach(x => B(g, 0.18, 2.5, 0.18, ND.PICKET, x, 0.5, zf + 1.7, NE));
      put(g, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), CP.ROOF, 0, 3.05, zf + 1.0, { rx: 0.18, s: [5.6, 0.14, 2.1] });
      [-1.1, 1.1].forEach(x => P(g, 0.95, 2.1, DR, x, 0.5, zf + 0.03)); [-4.4, 4.4].forEach(x => lilWin(g, x, 1.1, zf, 1.4, 1.5));
      // first floor: windows + two small balconies
      [-4.4, -1.7, 1.7, 4.4].forEach(x => lilWin(g, x, FH + 1.0, zf, 1.1, 1.4));
      [-1.7, 1.7].forEach(x => { B(g, 2.4, 0.14, 0.7, '#efe6d2', x, FH + 0.3, zf + 0.35, NE); bar(g, 2.4, x, FH + 1.15, zf + 0.68); plant(g, x + 0.8, FH + 0.44, zf + 0.4, PAL.pink); });
      // outside stairs on both sides to the upper homes
      [-1, 1].forEach(s => { ramp(g, 1.2, FH, 4.4, '#efe6d2', s * 7.1, 0.2, zb + 1.4, s > 0 ? 0 : 0); B(g, 1.6, 0.25, 1.6, '#efe6d2', s * 7.3, FH, zb - 1.6, NE);
        P(g, 0.95, 2.1, DR, s * 6.52, FH + 0.25, zb - 1.6, { ry: s * Math.PI / 2 }); bar(g, 4.4, s * 7.7, FH * 0.5 + 0.9, zb + 0.6, Math.PI / 2); });
      [-1, 1].forEach(s => P(g, 1.2, 1.3, winAt(s, 2, 8), s * 6.51, 1.2, zb + 1.8, { ry: s * Math.PI / 2 }));
      // fence, gate, 4 letterboxes + name board, shared garden
      picket(g, -9.9, -0.9, 7.85); picket(g, 0.9, 9.9, 7.85); [-0.9, 0.9].forEach(x => B(g, 0.22, 1.3, 0.22, ND.PICKET, x, 0.2, 7.85, NE));
      B(g, 2.2, 0.08, 0.08, '#5a3c28', 2.4, 1.1, 7.4, FLAT); [0, 1, 2, 3].forEach(i => B(g, 0.42, 0.3, 0.28, DR, 1.65 + i * 0.5, 1.15, 7.4, NE)); B(g, 0.1, 1.1, 0.1, '#5a3c28', 2.4, 0.2, 7.4, FLAT);
      plates(g, o.names, 4, -1.5, 0.75, 7.95, 0);
      [[-6, 5.5, PAL.pink], [6.5, 5.2, 'canopy']].forEach(([x, z, k]) => { CYL(g, 0.16, 0.22, 2.4, 5, PAL.wood, x, 0.2, z, { edge: false, open: true }); ICO(g, 1.9, 0, k === 'canopy' ? PAL.leaf : k, x, 3.7, z); });
      B(g, 2.2, 0.45, 0.6, PAL.wood, -4.2, 0.2, 3.6, NE); [[-8.6, 3.2], [-7.6, 3.4], [8.4, 3], [5.2, 6.6]].forEach(([x, z], i) => plant(g, x, 0.2, z, [PAL.pink, '#f2c14e', '#a084c8', PAL.pink][i]));
      hedge(g, 0.8, 9, -9.5, -3); hedge(g, 0.8, 9, 9.5, -3);
      return g;
    } });

  // --- Hill village, 1 citizen: a small stone house on a terrace (retaining wall + steps), outside stair to the upper door,
  //     pergola with a vine, olive and cypress. 10 x 10 m. The terrace is what makes a street of these "climb".
  def({ key: 'hvHouse', name: 'Hill village house (1 home)', cat: 'New District', part: 2, budget: 700, size: '10 × 12 m (steps to the street) · 2 floors on a terrace · 1 citizen', night: true,
    opts: { stone: choices('Stone', Object.keys(ND.stone)), terrace: choices('Terrace', ['1.5 m', 'none', '3 m']) },
    make(o) {
      const g = new THREE.Group(), ST = ND.stone[o.stone] || ND.stone.warm, T = o.terrace === 'none' ? 0 : o.terrace === '3 m' ? 3 : 1.5, y = T + 0.2;
      B(g, 10, T + 0.2, 10, ND.BASE, 0, 0, 0); B(g, 10.2, 0.14, 10.2, '#cfc3a8', 0, T + 0.2, 0, NE); B(g, 9.6, 0.05, 9.6, '#c9b896', 0, y, 0, FLAT);   // terrace
      if (T) for (let i = 0; i < Math.round(T / 0.3); i++) B(g, 1.6, 0.3 * (i + 1), 0.4, ND.BASE, 3.6, 0, 5.2 + (Math.round(T / 0.3) - 1 - i) * 0.4, NE);   // steps up to the terrace
      B(g, 6, 5.4, 5.4, ST, -1, y, -1.8); [[-4, 0.9], [2, 0.9]].forEach(([x, z]) => B(g, 0.5, 5.6, 0.5, '#e8dcc2', x, y, z, NE));   // house + corner stones
      GABLE(g, 6.2, 1.8, 7, CP.ROOF, -1, y + 5.4, -1.8, { ry: Math.PI / 2 });
      P(g, 1.2, 2.0, PAL.wood, -2.6, y, 0.93); ARCH(g, 1.2, PAL.wood, -2.6, y + 2.0, 0.93);       // arched door
      lilWin(g, 0.6, y + 0.9, 0.9, 0.9, 1.2); lilWin(g, -2.6, y + 3.4, 0.9, 0.9, 1.1);
      ramp(g, 1.0, 2.7, 3.2, '#cfc3a8', 2.6, y, -0.4, 0); B(g, 1.3, 0.2, 1.4, '#cfc3a8', 2.55, y + 2.6, -2.6, NE);   // outside stair to the upper door
      P(g, 0.9, 1.9, PAL.wood, 1.95, y + 2.75, -2.6, { ry: Math.PI / 2 });
      const pg = grp(g, -1, y, 2.8); [[-2.6, -0.8], [2.6, -0.8], [-2.6, 1.6], [2.6, 1.6]].forEach(([x, z]) => B(pg, 0.18, 2.4, 0.18, PAL.wood, x, 0, z, FLAT));   // pergola + vine
      [-0.8, 0.4, 1.6].forEach(z => B(pg, 5.6, 0.14, 0.14, PAL.wood, 0, 2.4, z, FLAT)); B(pg, 5.4, 0.12, 2.6, PAL.leaf2, 0, 2.56, 0.4, { edge: false });
      B(pg, 1.2, 0.05, 1.2, '#efe6d2', -1, 0.75, 0.4, FLAT); B(pg, 0.08, 0.75, 0.08, '#5a3c28', -1, 0, 0.4, FLAT);
      olive(g, 3.4, y, 3, 0.9); tree(g, -4.2, y, -4, 'cypress', 0.8);
      [[-4.3, 4.3], [4.4, 1.2]].forEach(([x, z]) => { B(g, 0.5, 0.45, 0.5, PAL.terra2, x, y, z, NE); plant(g, x, y + 0.35, z, PAL.pink); });
      plates(g, o.names, 1, -1.6, y + 1.3, 0.94, 0);
      return g;
    } });

  // --- Hill village, 4 citizens: two stepped stone houses. Lower house (2 homes) in front, upper house (2 homes) behind and
  //     1 terrace higher; the lower house's flat roof is the upper homes' shared terrace with a pergola. One shared stair,
  //     4 name plates at its foot. 16 x 16 m lot.
  def({ key: 'hvHouse4', name: 'Hill village house for 4', cat: 'New District', part: 2, budget: 1300, size: '16 × 16 m · stepped · 4 citizens', night: true,
    opts: { stone: choices('Stone', Object.keys(ND.stone)) },
    make(o) {
      const g = new THREE.Group(), ST = ND.stone[o.stone] || ND.stone.honey, L = '#cfc3a8', y1 = 1.4, y2 = 4.8;
      B(g, 16, y1, 16, ND.BASE, 0, 0, 0); B(g, 16.2, 0.12, 16.2, L, 0, y1, 0, NE);                  // bottom terrace
      B(g, 16, y2 - y1, 7, ND.BASE, 0, y1, -4.5);                                                     // upper terrace wall
      // lower house: 2 homes, flat roof = terrace
      B(g, 12, 3.2, 5, ST, 0.6, y1, 1.5); B(g, 12.4, 0.35, 5.4, L, 0.6, y1 + 3.2, 1.5, NE);
      [[-3.2, 'A'], [3.8, 'B']].forEach(([x]) => { P(g, 1.1, 2.0, PAL.wood, x, y1, 4.03); ARCH(g, 1.1, PAL.wood, x, y1 + 2.0, 4.03); lilWin(g, x + 1.9, y1 + 0.9, 4.0, 0.9, 1.2); });
      bar(g, 12.4, 0.6, y1 + 4.4, 4.15); [-5.4, 6.6].forEach(x => B(g, 0.1, 0.9, 0.1, CP.IRON, x, y1 + 3.55, 4.15, FLAT));
      // upper house: 2 homes, behind and higher, terracotta roof
      B(g, 13, 3.4, 5.6, ST, 0.4, y2, -4.6); GABLE(g, 6.4, 1.8, 13.6, CP.ROOF, 0.4, y2 + 3.4, -4.6, { ry: Math.PI / 2 });
      [[-3.4], [3.6]].forEach(([x]) => { P(g, 1.1, 2.0, PAL.wood, x, y2, -1.77); ARCH(g, 1.1, PAL.wood, x, y2 + 2.0, -1.77); lilWin(g, x + 1.9, y2 + 0.9, -1.8, 0.9, 1.2); lilWin(g, x - 1.9, y2 + 0.9, -1.8, 0.9, 1.2); });
      // shared stair on the left: street -> bottom terrace -> roof terrace -> upper homes
      ramp(g, 1.4, y1, 2.2, L, -6.9, 0, 7.6, 0); ramp(g, 1.4, y2 - y1 + 0.35, 4.4, L, -6.9, y1, 3.2, 0);
      // roof-terrace pergola + table for the upper homes
      const pg = grp(g, 1.2, y1 + 3.55, 1.5); [[-3, -1.8], [3, -1.8], [-3, 1.8], [3, 1.8]].forEach(([x, z]) => B(pg, 0.16, 2.3, 0.16, PAL.wood, x, 0, z, FLAT));
      [-1.8, 0, 1.8].forEach(z => B(pg, 6.4, 0.12, 0.12, PAL.wood, 0, 2.3, z, FLAT)); B(pg, 6.2, 0.1, 3.4, PAL.leaf2, 0, 2.44, 0, { edge: false });
      B(pg, 1.6, 0.05, 0.9, '#efe6d2', 0, 0.75, 0, FLAT); B(pg, 0.08, 0.75, 0.08, '#5a3c28', 0, 0, 0, FLAT);
      plates(g, o.names, 4, -5.6, 0.5, 8.03, 0);
      olive(g, 5.6, y1, 6, 0.9); tree(g, -6.6, y2, -6.6, 'cypress', 0.9); tree(g, 7, y2, -6.8, 'cypress', 0.75);
      [[-4.6, 6.6], [2.2, 6.8], [6.8, 3.6]].forEach(([x, z]) => { B(g, 0.5, 0.45, 0.5, PAL.terra2, x, y1, z, NE); plant(g, x, y1 + 0.35, z, PAL.pink); });
      return g;
    } });

  // ================= GARDEN DISTRICT (Dev, 16 Nov): an affordable middle-class European suburb in the Vinland colours =================
  // Practical and lived-in, not luxury: plain 2-storey houses, semis, a terrace row, flats, a shop parade, a school, a community centre,
  // a pocket park. Front = +z, centred on 0,0, ground y = 0. Walls / roof / doors are slots (each copy its own shade).
  // Windows use winAt (lit / unlit pattern at night, shared materials), so copies batch with bake() + instances().
  const GD = {
    walls: ['#f3e6cc', '#f3e2a0', '#f2cfb3', '#e3d8c4', '#efd9b4', '#e9e2d0'],          // cream, butter, peach, pale stone, sand, off-white
    roofs: [PAL.terra, '#5b5f66', PAL.terra2, '#8a5a3a'],                               // terracotta, slate, dark terracotta, brown tile
    doors: ['#47684a', '#3f5866', '#b5543a', '#c9922e', '#f6f3ea', '#7a4f34'],
    FRAME: '#f6f3ea', PAVE: '#e6dccb', BASE: '#cfc3a8', FENCE: '#b98a5e', HEDGE: PAL.leaf, BAL: '#efe6d2', RUBBER: '#c9734a', GLASS: BK.SHOPGL
  };
  const gdWin = (p, x, y, z, w, h, ry) => { const o = ry ? { ry } : {}, s = ry ? Math.sin(ry) : 0, c = ry ? Math.cos(ry) : 1;   // frame + glass, 4 triangles
    P(p, w + 0.3, h + 0.3, GD.FRAME, x, y - 0.15, z, o); P(p, w, h, winAt(x, y, z), x + s * 0.03, y, z + c * 0.03, o); };
  const gdShut = (p, x, y, z, w, h) => [-1, 1].forEach(s => P(p, w * 0.42, h, PAL.shutter, x + s * (w * 0.71 + 0.2), y, z + 0.05));
  const gdDoor = (p, x, y, z, D, glass) => { P(p, 1.3, 2.35, GD.FRAME, x, y, z); P(p, 1.0, 2.15, D, x, y, z + 0.03); if (glass) P(p, 0.5, 0.5, glass, x, y + 1.4, z + 0.05); };
  const gdTree = (p, x, y, z, s, c) => { s = s || 1; CYL(p, 0.15 * s, 0.22 * s, 2 * s, 5, PAL.wood, x, y, z, { edge: false, open: true });
    ICO(p, 1.5 * s, 0, c || PAL.leaf, x, y + 2.9 * s, z); ICO(p, 1.0 * s, 0, PAL.leaf2, x + 0.7 * s, y + 3.5 * s, z + 0.3 * s, NE); };
  const gdBench = (p, x, z, ry) => { const b = grp(p, x, 0.2, z, ry); B(b, 1.8, 0.45, 0.5, PAL.wood, 0, 0, 0, NE); B(b, 1.8, 0.5, 0.1, PAL.wood, 0, 0.45, -0.22, NE); };
  const gdLamp = (p, x, z) => { B(p, 0.12, 3.6, 0.12, CP.IRON, x, 0.2, z, FLAT); B(p, 0.4, 0.4, 0.4, CP.LAMP, x, 3.8, z, NE); };
  const gdNames = (o, i) => (o.names && o.names[i] ? [o.names[i]] : null);
  const gdOpts = { wall: colours('Walls', GD.walls), roof: colours('Roof', GD.roofs), door: colours('Door', GD.doors) };

  // 1. gdDetached: a plain 2-storey detached house, 8 x 9 m on a 10 x 14 m plot (3 m front garden, small back garden),
  //    low hedge + little gate, side fences, a bin, one tree. 1 home.
  def({ key: 'gdDetached', name: 'Detached house (1 home)', cat: 'Garden District', part: 2, budget: 500, size: '8 × 9 m house · 10 × 14 m plot · 2 floors · 1 home', night: true,
    opts: gdOpts,
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || GD.walls[0]), R = slot('roof', o.roof || GD.roofs[0]), D = slot('door', o.door || GD.doors[0]);
      const zc = -0.5, zf = 4, FH = 2.8, y0 = 0.2, top = y0 + 2 * FH + 0.2;
      B(g, 10, 0.2, 14, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 1.2, 0.04, 3, GD.PAVE, 1.9, 0.2, 5.5, FLAT);    // plot + path
      B(g, 8, 2 * FH + 0.2, 9, W, 0, y0, zc); B(g, 8.1, 0.35, 9.1, GD.BASE, 0, y0, zc, NE);                        // house + plinth
      GABLE(g, 9.8, 2.5, 8.6, R, 0, top, zc, { ry: Math.PI / 2 }); B(g, 0.7, 1.6, 0.7, GD.BASE, -2.6, top + 1.0, zc - 1.5);   // roof + chimney
      gdDoor(g, 1.9, y0 + 0.1, zf + 0.02, D, winAt(1.9, 1, zf)); B(g, 1.8, 0.12, 1.0, R, 1.9, y0 + 2.55, zf + 0.5, NE); B(g, 1.6, 0.15, 0.8, GD.BASE, 1.9, y0, zf + 0.4, NE);
      gdWin(g, -1.8, y0 + 0.9, zf + 0.02, 1.8, 1.4); gdShut(g, -1.8, y0 + 0.9, zf + 0.02, 1.8, 1.4);              // ground: big window + green shutters
      [-2.2, 1.9].forEach(x => gdWin(g, x, y0 + FH + 0.7, zf + 0.02, 1.3, 1.3));                                 // first floor
      [-1, 1].forEach(s => { gdWin(g, s * 4.02, y0 + 0.9, zc + 1.2, 1.1, 1.3, s * Math.PI / 2); gdWin(g, s * 4.02, y0 + FH + 0.7, zc - 1.6, 1.1, 1.2, s * Math.PI / 2); });
      [-2.4, 0.6, 2.6].forEach((x, i) => gdWin(g, x, y0 + (i === 1 ? FH + 0.7 : 0.9), zc - 4.52, 1.3, 1.3, Math.PI));
      B(g, 6.2, 0.8, 0.5, GD.HEDGE, -1.9, 0.2, 6.7); B(g, 2.4, 0.8, 0.5, GD.HEDGE, 3.8, 0.2, 6.7); B(g, 1.2, 0.9, 0.06, GD.FRAME, 1.9, 0.2, 6.85, NE);   // hedge + gate
      [-1, 1].forEach(s => B(g, 0.08, 1.0, 13.4, GD.FENCE, s * 4.96, 0.2, -0.2, NE)); B(g, 10, 1.4, 0.08, GD.FENCE, 0, 0.2, -6.96, NE);   // side + back fences
      B(g, 0.6, 1.0, 0.6, '#3f5e42', 4.2, 0.2, 4.6, NE); plates(g, gdNames(o, 0), 1, 3.0, 0.75, 6.98, 0);          // wheelie bin, name plate
      gdTree(g, -3.7, 0.2, 5.0, 0.75); [[-0.6, 4.6, PAL.pink], [3.4, 4.5, '#f2c14e'], [-3.2, 4.4, '#a084c8']].forEach(([x, z, c]) => plant(g, x, 0.2, z, c));
      return g;
    } });

  // 2. gdSemi: semi-detached pair, mirrored halves, 14 x 9 m on a 16 x 14 m plot. Each half its own wall + door colour
  //    (wall / wall2, door / door2), bay window, hedge, path, bin. 2 homes. o.names = ['@left', '@right'].
  def({ key: 'gdSemi', name: 'Semi-detached pair (2 homes)', cat: 'Garden District', part: 2, budget: 700, size: '14 × 9 m · 16 × 14 m plot · 2 floors · 2 homes', night: true,
    opts: { wall: colours('Left walls', GD.walls), wall2: colours('Right walls', GD.walls.slice(1).concat(GD.walls[0])), roof: colours('Roof', GD.roofs),
      door: colours('Left door', GD.doors), door2: colours('Right door', GD.doors.slice(2).concat(GD.doors.slice(0, 2))) },
    make(o) {
      const g = new THREE.Group(), R = slot('roof', o.roof || GD.roofs[1]), zc = -0.5, zf = 4, FH = 2.8, y0 = 0.2, top = y0 + 2 * FH + 0.2;
      const half = [[slot('wall', o.wall || GD.walls[0]), slot('door', o.door || GD.doors[0])], [slot('wall2', o.wall2 || GD.walls[1]), slot('door2', o.door2 || GD.doors[2])]];
      B(g, 16, 0.2, 14, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 14.1, 0.35, 9.1, GD.BASE, 0, y0, zc, NE);
      HIP(g, 15.4, 2.8, 10.2, R, 0, top, zc); B(g, 1.0, 1.4, 0.8, GD.BASE, 0, top + 1.8, zc);                      // one roof, shared chimney on the party wall
      [-1, 1].forEach((s, i) => { const [W, D] = half[i], xd = s * 5.6, xb = s * 2.3;
        B(g, 7, 2 * FH + 0.2, 9, W, s * 3.5, y0, zc);
        gdDoor(g, xd, y0 + 0.1, zf + 0.02, D, winAt(xd, 1, zf)); B(g, 1.8, 0.12, 1.0, R, xd, y0 + 2.55, zf + 0.5, NE);
        B(g, 2.8, 2.5, 0.8, W, xb, y0, zf + 0.4); B(g, 3.0, 0.15, 1.0, R, xb, y0 + 2.5, zf + 0.42, NE); gdWin(g, xb, y0 + 0.8, zf + 0.82, 2.2, 1.4);   // bay window
        gdWin(g, xb, y0 + FH + 0.7, zf + 0.02, 1.6, 1.3); gdWin(g, xd, y0 + FH + 0.8, zf + 0.02, 0.9, 1.1);
        gdWin(g, s * 7.02, y0 + FH + 0.7, zc, 1.0, 1.2, s * Math.PI / 2); [s * 1.8, s * 5.0].forEach((x, k) => gdWin(g, x, y0 + (k ? FH + 0.7 : 0.9), zc - 4.52, 1.4, 1.3, Math.PI));
        B(g, 1.2, 0.04, 2.6, GD.PAVE, xd, 0.2, 5.6, FLAT); B(g, 4.8, 0.8, 0.5, GD.HEDGE, s * 2.6, 0.2, 6.7); B(g, 1.4, 0.8, 0.5, GD.HEDGE, s * 7.3, 0.2, 6.7);
        B(g, 0.08, 1.0, 13.4, GD.FENCE, s * 7.96, 0.2, -0.2, NE); B(g, 0.55, 0.95, 0.55, '#3f5e42', s * 7.2, 0.2, 4.7, NE);
        plates(g, gdNames(o, i), 1, s * 6.6, 0.75, 6.98, 0); plant(g, s * 4.4, 0.2, 5.0, i ? '#f2c14e' : PAL.pink); });
      B(g, 0.4, 0.8, 2.4, GD.HEDGE, 0, 0.2, 5.5); B(g, 16, 1.4, 0.08, GD.FENCE, 0, 0.2, -6.96, NE); B(g, 0.08, 1.4, 2.0, GD.FENCE, 0, 0.2, -6, NE);   // garden divide, back fence
      return g;
    } });

  // 3. gdTerrace: a row of 6 terraced townhouses, 5.5 m each, 2 storeys (33 x 9 m on 36 x 13 m). Small front gardens with a
  //    low wall, different doors (door / door2 / door3), walls in 3 shades (wall / wall2 / wall3), a small step in the roof line.
  def({ key: 'gdTerrace', name: 'Terraced row (6 homes)', cat: 'Garden District', part: 2, budget: 1200, size: '33 × 9 m · 36 × 13 m plot · 2 floors · 6 homes', night: true,
    opts: { wall: colours('Walls 1', GD.walls), wall2: colours('Walls 2', GD.walls.slice(1).concat(GD.walls[0])), wall3: colours('Walls 3', GD.walls.slice(2).concat(GD.walls.slice(0, 2))),
      roof: colours('Roof', GD.roofs), door: colours('Doors 1', GD.doors), door2: colours('Doors 2', GD.doors.slice(1).concat(GD.doors[0])), door3: colours('Doors 3', GD.doors.slice(2).concat(GD.doors.slice(0, 2))) },
    make(o) {
      const g = new THREE.Group(), R = slot('roof', o.roof || GD.roofs[0]), zc = -1, zf = 3.5, FH = 2.8, y0 = 0.2;
      const WS = [slot('wall', o.wall || GD.walls[0]), slot('wall2', o.wall2 || GD.walls[2]), slot('wall3', o.wall3 || GD.walls[3])];
      const DS = [slot('door', o.door || GD.doors[0]), slot('door2', o.door2 || GD.doors[2]), slot('door3', o.door3 || GD.doors[1])];
      const STEP = [0, 0, 0.35, 0.35, 0.35, 0];
      B(g, 36, 0.2, 13, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 33.1, 0.35, 9.1, GD.BASE, 0, y0, zc, NE); B(g, 36, 1.2, 0.08, GD.FENCE, 0, 0.2, -6.46, NE);
      for (let i = 0; i < 6; i++) { const x = -13.75 + 5.5 * i, m = i % 2 ? 1 : -1, H = 2 * FH + 0.2 + STEP[i], W = WS[i % 3], D = DS[[0, 1, 2, 1, 0, 2][i]], xd = x + m * 1.6, xw = x - m * 0.9;
        B(g, 5.5, H, 9, W, x, y0, zc); GABLE(g, 9.8, 2.3, 5.5, R, x, y0 + H, zc, { ry: Math.PI / 2 });
        gdDoor(g, xd, y0 + 0.1, zf + 0.02, D, winAt(xd, 1, zf)); B(g, 1.6, 0.12, 0.8, GD.FRAME, xd, y0 + 2.55, zf + 0.4, NE);
        gdWin(g, xw, y0 + 0.9, zf + 0.02, 2.0, 1.4); if (i === 1 || i === 4) gdShut(g, xw, y0 + 0.9, zf + 0.02, 2.0, 1.4);
        [-1.2, 1.2].forEach(dx => gdWin(g, x + dx, y0 + FH + 0.7, zf + 0.02, 1.1, 1.3)); [-1.2, 1.2].forEach((dx, k) => gdWin(g, x + dx, y0 + (k ? 0.9 : FH + 0.7), zc - 4.52, 1.2, 1.3, Math.PI));
        B(g, 1.1, 0.04, 2.9, GD.PAVE, xd, 0.2, 4.95, FLAT);
        const a = x - 2.75, b = xd - 0.6, c = xd + 0.6, e = x + 2.75;                                               // low front wall with a gap for the path
        B(g, b - a, 0.6, 0.3, GD.BASE, (a + b) / 2, 0.2, 6.3, NE); B(g, e - c, 0.6, 0.3, GD.BASE, (c + e) / 2, 0.2, 6.3, NE);
        if (i < 5) B(g, 0.12, 0.8, 2.8, GD.FENCE, x + 2.75, 0.2, 4.95, NE);
        if (i % 2) B(g, 0.8, 1.3, 1.2, GD.BASE, x + 2.75, y0 + 2 * FH + 1.4, zc - 0.6);                             // chimney on the party wall
        plates(g, gdNames(o, i), 1, xd + m * 0.95, 0.4, 6.47, 0); plant(g, xw, 0.2, 5.2, [PAL.pink, '#f2c14e', '#a084c8'][i % 3]); }
      [-1, 1].forEach(s => [0.9, FH + 0.7].forEach(y => gdWin(g, s * 16.52, y0 + y, zc + 1, 1.0, 1.2, s * Math.PI / 2)));   // end-house side windows
      return g;
    } });

  // 4. gdApartment: a practical block of flats, 30 x 14 m, 4 / 5 / 6 floors, 4 flats a floor (ground floor too, either side of
  //    the hall). Stone ground floor, simple solid-front balconies, stair window column, entrance canopy, bins, bikes, 2 trees.
  def({ key: 'gdApartment', name: 'Apartment block', cat: 'Garden District', part: 2, budget: 1500, size: '30 × 14 m · 4–6 floors · 4 flats a floor', night: true,
    opts: { floors: choices('Floors', ['5', '4', '6']), wall: colours('Walls', GD.walls), roof: colours('Roof', GD.roofs) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || GD.walls[2]), R = slot('roof', o.roof || GD.roofs[0]), F = +(o.floors || 5), FH = 3, y0 = 0.2;
      const zc = -2, zf = 5, zb = -9, H = F * FH + 0.4, FX = [-11.25, -3.75, 3.75, 11.25];
      B(g, 34, 0.2, 22, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 34, 0.05, 4, GD.PAVE, 0, 0.2, 9, FLAT); B(g, 3.6, 0.05, 4, GD.PAVE, 0, 0.2, 7, FLAT);
      B(g, 30.1, FH, 14.1, GD.BASE, 0, y0, zc); B(g, 30, H - FH, 14, W, 0, y0 + FH, zc); B(g, 30.6, 0.35, 14.6, GD.FRAME, 0, y0 + H - 0.3, zc, NE);
      HIP(g, 31.2, 3.2, 15.2, R, 0, y0 + H, zc);
      // entrance: glass doors, canopy, house number
      P(g, 3.4, 2.6, GD.FRAME, 0, y0, zf + 0.02); P(g, 3.0, 2.4, GD.GLASS, 0, y0, zf + 0.05); B(g, 5, 0.25, 2.4, GD.FRAME, 0, y0 + 2.9, zf + 1.2);
      B(g, 0.9, 0.6, 0.06, '#3f5866', 2.4, y0 + 2.1, zf + 0.04, NE);
      for (let f = 0; f < F; f++) { const y = y0 + f * FH;
        if (f) gdWin(g, 0, y + 0.6, zf + 0.02, 1.0, 1.9);                                                          // stairwell
        FX.forEach(x => {
          if (!f) { [-1.6, 1.6].forEach(dx => gdWin(g, x + dx, y + 0.9, zf + 0.02, 1.6, 1.4)); }
          else { gdWin(g, x - 2.0, y + 0.9, zf + 0.02, 1.5, 1.5); P(g, 1.0, 2.1, winAt(x + 1.5, y, zf), x + 1.5, y + 0.1, zf + 0.03);   // window + balcony door
            B(g, 3.2, 1.05, 1.3, GD.BAL, x + 1.4, y, zf + 0.65); }                                                  // balcony
          [-1.8, 1.8].forEach(dx => gdWin(g, x + dx, y + 0.9, zb - 0.02, 1.4, 1.4, Math.PI)); });
        [-1, 1].forEach(s => [-2.5, 2.5].forEach(dz => gdWin(g, s * 15.02, y + 0.9, zc + dz, 1.3, 1.4, s * Math.PI / 2))); }
      B(g, 3.6, 1.4, 1.4, GD.BASE, -12, 0.2, 8.4, NE); [-1, 0, 1].forEach(k => B(g, 0.08, 0.8, 0.9, CP.IRON, 9 + k * 0.9, 0.2, 7.8, FLAT));   // bin store, bike rack
      gdTree(g, -6, 0.2, 7.6, 0.8); gdTree(g, 6, 0.2, 7.6, 0.8);
      return g;
    } });

  // 5. gdShopParade: 4 small shops on the ground floor (awnings, shop windows, sign panels) with 2 floors of flats above (8 flats).
  //    32 x 12 m + a 5 m pavement. o.signs = ['BAKERY', ...] (made-up names only); blank panels if not given, so copies batch.
  def({ key: 'gdShopParade', name: 'Shop parade + flats', cat: 'Garden District', part: 2, budget: 1200, size: '32 × 12 m · 4 shops + 8 flats · 3 floors', night: true,
    opts: { wall: colours('Walls', GD.walls), roof: colours('Roof', GD.roofs), awnings: choices('Awnings', Object.keys(CP.awnings)), signs: choices('Signs', ['blank', 'sample']) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || GD.walls[1]), R = slot('roof', o.roof || GD.roofs[0]), aw = CP.awnings[o.awnings] || CP.awnings.mix;
      const signs = o.signs === 'sample' ? ['BAKERY', 'FLORIST', 'BOOKS', 'CAF\u00c9'] : Array.isArray(o.signs) ? o.signs : [];
      const zc = -2, zf = 4, y0 = 0.2, GF = 4.2, FH = 3;
      B(g, 32, 0.2, 12, '#d8c7a0', 0, 0, zc, { shadow: false }); B(g, 32, 0.25, 5, GD.PAVE, 0, 0, 6.5, { shadow: false });
      B(g, 32, GF, 12, '#efe6d2', 0, y0, zc); B(g, 32, 2 * FH + 0.2, 12, W, 0, y0 + GF, zc); B(g, 32.4, 0.3, 12.4, GD.FRAME, 0, y0 + GF - 0.1, zc, NE);
      GABLE(g, 13, 2.8, 32.6, R, 0, y0 + GF + 2 * FH + 0.2, zc, { ry: Math.PI / 2 }); [-9, 9].forEach(x => B(g, 0.9, 1.4, 1.2, GD.BASE, x, y0 + GF + 2 * FH + 1.6, zc - 2));
      B(g, 32.2, 0.9, 0.3, '#3f5866', 0, y0 + 3.2, zf + 0.15, NE);                                                   // fascia
      for (let i = 0; i < 4; i++) { const x = -12 + 8 * i, s = signs[i];
        P(g, 5.4, 2.7, GD.FRAME, x - 0.8, y0 + 0.4, zf + 0.02); P(g, 5.0, 2.4, GD.GLASS, x - 0.8, y0 + 0.55, zf + 0.05);
        P(g, 1.2, 2.5, GD.GLASS, x + 2.6, y0 + 0.1, zf + 0.05); P(g, 1.5, 2.7, GD.FRAME, x + 2.6, y0, zf + 0.02);
        P(g, 6.4, 0.7, s ? textMat(s, aw[i], '#f6f3ea') : '#efe6d2', x, y0 + 3.3, zf + 0.32);                          // sign panel
        awning(g, 6.6, aw[i], x, y0 + 2.75, zf + 0.75);
        [-2, 2].forEach((dx, k) => [0, 1].forEach(f => gdWin(g, x + dx, y0 + GF + f * FH + 0.7, zf + 0.02, 1.4, 1.5)));
        [-2, 2].forEach(dx => [0, 1].forEach(f => gdWin(g, x + dx, y0 + GF + f * FH + 0.7, zc - 6.02, 1.3, 1.4, Math.PI)));
        [-2, 2].forEach(dx => bar(g, 1.6, x + dx, y0 + GF + FH + 1.2, zf + 0.12)); }
      for (let i = 0; i <= 4; i++) B(g, 0.5, GF, 0.3, GD.FRAME, -16 + 8 * i, y0, zf + 0.15, NE);                    // pilasters
      [-1, 1].forEach(s => { const sd = grp(g, s * 16.02, y0, zc + 2, s * Math.PI / 2); gdDoor(sd, 0, 0, 0, '#3f5866'); });   // side doors up to the flats
      [-1, 1].forEach(s => gdLamp(g, s * 13, 8.4)); gdBench(g, -4, 8.3, Math.PI); [-1, 1].forEach(s => { B(g, 1.2, 0.6, 0.6, GD.BASE, s * 7, 0.25, 8.5, NE); plant(g, s * 7, 0.85, 8.5, PAL.pink); });
      return g;
    } });

  // 6. gdSchool: a small primary school. U-shaped 2-storey building 40 x 24 m (main block + two wings round a paved courtyard),
  //    a fenced playground (slide tower, swings, sandpit) and a little sports court behind, on a 60 x 60 m block. o.name = the sign.
  def({ key: 'gdSchool', name: 'Primary school', cat: 'Garden District', part: 2, budget: 2000, size: '40 × 24 m building · 60 × 60 m block · 2 floors', night: true,
    opts: { wall: colours('Walls', GD.walls), roof: colours('Roof', GD.roofs) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || GD.walls[0]), R = slot('roof', o.roof || GD.roofs[0]), y0 = 0.2, FH = 3.2, H = 2 * FH + 0.2;
      B(g, 60, 0.2, 60, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 4, 0.05, 6, GD.PAVE, 0, 0.2, 27.5, FLAT); B(g, 20, 0.05, 12, GD.PAVE, 0, 0.2, 8, FLAT);
      // building: main block (z 14..26) + two wings (z 2..14)
      B(g, 40, H, 12, W, 0, y0, 20); B(g, 40.2, 0.4, 12.2, GD.BASE, 0, y0, 20, NE); HIP(g, 41.2, 2.6, 13.2, R, 0, y0 + H, 20);
      [-1, 1].forEach(s => { B(g, 10, H, 12, W, s * 15, y0, 8); B(g, 10.2, 0.4, 12.2, GD.BASE, s * 15, y0, 8, NE); GABLE(g, 10.8, 2.2, 12.4, R, s * 15, y0 + H, 7.6); });
      // entrance: glass doors, canopy on posts, school sign
      P(g, 4.4, 2.9, GD.FRAME, 0, y0, 26.02); P(g, 4.0, 2.7, GD.GLASS, 0, y0, 26.05); B(g, 7, 0.3, 2.6, GD.FRAME, 0, y0 + 3.0, 27.3);
      [-3.2, 3.2].forEach(x => B(g, 0.2, 3.0, 0.2, GD.FRAME, x, y0, 28.4, NE)); P(g, 9, 1.0, textMat(o.name || 'PRIMARY SCHOOL', '#3f5866', '#f6f3ea'), 0, y0 + 3.6, 26.05);
      gdWin(g, 0, y0 + FH + 0.9, 26.02, 2.4, 1.6);
      [-17, -13, -9, -5, 5, 9, 13, 17].forEach(x => [0, 1].forEach(f => gdWin(g, x, y0 + f * FH + 0.8, 26.02, 2.6, 1.7)));          // front
      [-7.5, -2.5, 2.5, 7.5].forEach(x => [0, 1].forEach(f => gdWin(g, x, y0 + f * FH + 0.8, 13.98, 2.6, 1.7, Math.PI)));          // courtyard side
      [-1, 1].forEach(s => { [4, 8, 12, 17, 21, 25].forEach(z => [0, 1].forEach(f => gdWin(g, s * 20.02, y0 + f * FH + 0.8, z - 0.6, 2.2, 1.7, s * Math.PI / 2)));
        [5, 10].forEach(z => [0, 1].forEach(f => gdWin(g, s * 9.98, y0 + f * FH + 0.8, z, 2.2, 1.7, -s * Math.PI / 2)));
        [0, 1].forEach(f => gdWin(g, s * 15, y0 + f * FH + 0.8, 1.98, 2.6, 1.7, Math.PI)); });
      // sports court (left, behind)
      B(g, 15, 0.08, 23, '#3f7fbf', -19, 0.2, -14, { shadow: false }); B(g, 13, 0.1, 21, '#4f9a86', -19, 0.2, -14, { shadow: false }); B(g, 13, 0.12, 0.15, GD.FRAME, -19, 0.2, -14, FLAT);
      [-1, 1].forEach(s => { B(g, 0.2, 3.2, 0.2, CP.IRON, -19, 0.2, -14 + s * 11.2, NE); B(g, 1.8, 1.1, 0.1, GD.FRAME, -19, 3.0, -14 + s * 10.9, NE); });
      // playground (right, behind): soft surface, slide tower, swings, sandpit
      B(g, 18, 0.06, 14, GD.RUBBER, 14, 0.2, -18, { shadow: false });
      B(g, 2, 1.8, 2, '#c9922e', 10, 0.2, -20); HIP(g, 2.6, 1.2, 2.6, PAL.terra, 10, 2.0, -20); TAPER(g, 0.9, 1.8, 3.4, '#3f7fbf', 10, 0.2, -17.3, { tw: 1, td: 0.06, tz: -0.47 });
      B(g, 0.8, 1.8, 0.2, PAL.wood, 10, 0.2, -21.1, NE);
      const sw = grp(g, 17, 0.2, -21); [-1.8, 1.8].forEach(x => TAPER(sw, 0.2, 2.4, 1.6, '#c8603f', x, 0, 0, { tw: 1, td: 0.1 })); B(sw, 3.8, 0.12, 0.12, '#c8603f', 0, 2.35, 0, NE);
      [-0.8, 0.8].forEach(x => { B(sw, 0.04, 1.8, 0.04, CP.IRON, x, 0.55, 0, FLAT); B(sw, 0.5, 0.06, 0.25, '#2f2b28', x, 0.5, 0, NE); });
      B(g, 4, 0.3, 4, PAL.wood, 18, 0.2, -14, NE); B(g, 3.6, 0.32, 3.6, PAL.sand, 18, 0.2, -14, FLAT);
      [[6, -10], [22, -10], [-10, -4]].forEach(([x, z]) => gdBench(g, x, z, Math.PI));
      // trees, bike shelter, fence with a front gate
      [[-27, 24], [27, 24], [-27, -27], [27, -27], [3, -6], [-6, 5], [6, 5]].forEach(([x, z]) => gdTree(g, x, 0.2, z, 0.9));
      B(g, 6, 0.15, 2.4, '#5b5f66', 25, 2.3, 6, NE); [-2.8, 2.8].forEach(x => B(g, 0.12, 2.1, 0.12, CP.IRON, 25 + x, 0.2, 6, FLAT));
      [[-29.9, 0, 0.2, 60], [29.9, 0, 0.2, 60], [0, -29.9, 60, 0.2], [-16, 29.9, 28, 0.2], [16, 29.9, 28, 0.2]].forEach(([x, z, w, d]) => {
        B(g, w || 0.2, 0.5, d || 0.2, GD.BASE, x, 0.2, z, NE); B(g, w || 0.06, 1.0, d || 0.06, '#47684a', x, 0.7, z, FLAT); });
      [-2, 2].forEach(x => B(g, 0.4, 1.8, 0.4, GD.BASE, x, 0.2, 29.9, NE));
      return g;
    } });

  // 7. gdCommunity: a community centre, 24 x 16 m: a 2-storey block with a glass entrance box + a single-storey hall with
  //    a gable to the street. Small paved forecourt with benches, planters, a notice board, bikes and lamps.
  def({ key: 'gdCommunity', name: 'Community centre', cat: 'Garden District', part: 2, budget: 1000, size: '24 × 16 m · 1–2 floors · forecourt', night: true,
    opts: { wall: colours('Walls', GD.walls), roof: colours('Roof', GD.roofs) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || GD.walls[3]), R = slot('roof', o.roof || GD.roofs[1]), y0 = 0.2, zc = -3, zf = 5;
      B(g, 28, 0.2, 26, PAL.grass, 0, 0, 1, { shadow: false }); B(g, 28, 0.05, 8, GD.PAVE, 0, 0.2, 9, FLAT);
      B(g, 14, 6.8, 16, W, -5, y0, zc); B(g, 14.3, 0.6, 16.3, GD.FRAME, -5, y0 + 6.6, zc, NE); B(g, 13.4, 0.05, 15.4, '#9a948a', -5, y0 + 7.2, zc, FLAT);   // 2-storey block
      B(g, 10, 5, 16, W, 7, y0, zc); GABLE(g, 10.6, 2.4, 16.6, R, 7, y0 + 5, zc);                                    // hall
      B(g, 5, 4, 2.4, GD.GLASS, -5, y0, zf + 1.2); B(g, 5.4, 0.4, 2.8, GD.FRAME, -5, y0 + 4, zf + 1.2, NE);         // glass entrance
      P(g, 9, 0.9, textMat(o.name || 'COMMUNITY CENTRE', '#47684a', '#f6f3ea'), -5, y0 + 4.9, zf + 0.04);
      [-10.5, 0.5].forEach(x => gdWin(g, x, y0 + 0.9, zf + 0.02, 1.6, 1.6)); [-10, -6.5, -3.5, 0].forEach(x => gdWin(g, x, y0 + 3.9, zf + 0.02, 1.6, 1.5));
      [4.6, 7, 9.4].forEach(x => gdWin(g, x, y0 + 0.8, zf + 0.02, 1.2, 3.0)); gdWin(g, 7, y0 + 5.5, zf + 0.02, 1.0, 1.0);
      [-1, 0, 1].forEach(k => { gdWin(g, -12.02, y0 + 0.9, zc + k * 5, 1.6, 1.6, -Math.PI / 2); gdWin(g, -12.02, y0 + 3.9, zc + k * 5, 1.6, 1.5, -Math.PI / 2);
        gdWin(g, 12.02, y0 + 0.8, zc + k * 5, 1.2, 3.0, Math.PI / 2); gdWin(g, -5 + k * 4, y0 + 0.9, zc - 8.02, 1.6, 1.6, Math.PI); gdWin(g, 7 + k * 3, y0 + 0.8, zc - 8.02, 1.2, 3.0, Math.PI); });
      [-1, 1].forEach(s => gdWin(g, -5 + s * 3, y0 + 3.9, zc - 8.02, 1.6, 1.5, Math.PI));
      gdBench(g, -9, 11.5, Math.PI); gdBench(g, 2, 11.5, Math.PI); gdBench(g, 9, 11.5, Math.PI);
      [-1, 1].forEach(s => { B(g, 1.6, 0.6, 1.6, GD.BASE, s * 11.5, 0.25, 8.4, NE); plant(g, s * 11.5, 0.85, 8.4, PAL.pink); gdLamp(g, s * 13, 12.5); });
      B(g, 1.6, 1.1, 0.1, '#47684a', 3.6, 1.0, 6.2, NE); B(g, 0.1, 1.0, 0.1, PAL.wood, 3.6, 0.2, 6.2, FLAT); P(g, 1.4, 0.9, '#f6f3ea', 3.6, 1.1, 6.26);   // notice board
      [-1, 0, 1].forEach(k => B(g, 0.08, 0.8, 0.9, CP.IRON, 6 + k * 0.9, 0.2, 7.6, FLAT));
      gdTree(g, -12.5, 0.2, 12, 0.8); gdTree(g, 12.5, 0.2, -2, 0.8);
      return g;
    } });

  // 8. gdPocketPark: a 24 x 24 m pocket park: crossing paths, hedge edge, a playground (swings, slide), sandpit,
  //    benches, 3 trees, a lamp and a bin.
  def({ key: 'gdPocketPark', name: 'Pocket park', cat: 'Garden District', part: 2, budget: 600, size: '24 × 24 m', night: true, opts: {},
    make() {
      const g = new THREE.Group();
      B(g, 24, 0.2, 24, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 24, 0.05, 2, GD.PAVE, 0, 0.2, 0, FLAT); B(g, 2, 0.05, 24, GD.PAVE, 0, 0.2, 0, FLAT);
      [[-6.5, 11.6, 9, 0.6], [6.5, 11.6, 9, 0.6], [-6.5, -11.6, 9, 0.6], [6.5, -11.6, 9, 0.6], [-11.6, -6.5, 0.6, 9], [-11.6, 6.5, 0.6, 9], [11.6, -6.5, 0.6, 9], [11.6, 6.5, 0.6, 9]]
        .forEach(([x, z, w, d]) => B(g, w, 0.8, d, GD.HEDGE, x, 0.2, z));
      B(g, 8.4, 0.06, 8.4, GD.RUBBER, 6, 0.2, -6, { shadow: false });                                              // playground corner
      const sw = grp(g, 4.6, 0.2, -6, Math.PI / 2); [-1.8, 1.8].forEach(x => TAPER(sw, 0.2, 2.4, 1.6, '#c8603f', x, 0, 0, { tw: 1, td: 0.1 }));
      B(sw, 3.8, 0.12, 0.12, '#c8603f', 0, 2.35, 0, NE); [-0.8, 0.8].forEach(x => { B(sw, 0.04, 1.8, 0.04, CP.IRON, x, 0.55, 0, FLAT); B(sw, 0.5, 0.06, 0.25, '#2f2b28', x, 0.5, 0, NE); });
      B(g, 1.6, 1.6, 1.6, '#c9922e', 8.4, 0.2, -8.4); HIP(g, 2.1, 1.0, 2.1, PAL.terra, 8.4, 1.8, -8.4); TAPER(g, 0.8, 1.6, 3.0, '#3f7fbf', 8.4, 0.2, -6.1, { tw: 1, td: 0.06, tz: -0.47 });
      B(g, 3.2, 0.3, 3.2, PAL.wood, -6.5, 0.2, -6.5, NE); B(g, 2.8, 0.32, 2.8, PAL.sand, -6.5, 0.2, -6.5, FLAT);   // sandpit
      gdBench(g, -6, 2.2, Math.PI); gdBench(g, 6, 2.2, Math.PI); gdBench(g, 2.2, -4, -Math.PI / 2);
      gdTree(g, -7, 0.2, 7, 1); gdTree(g, 7, 0.2, 7.5, 0.9, PAL.pink); gdTree(g, -8, 0.2, -2.6, 0.8);
      gdLamp(g, 1.6, 1.6); B(g, 0.5, 0.8, 0.5, '#47684a', -1.6, 0.2, 1.6, NE);
      return g;
    } });

  // ================= DISTRICT SERVICES, DOWNTOWN QUARTERS, VINLAND TOWER CONSTRUCTION (Dev OK'd, 16 Nov) =================
  // Same style as the gd* pieces: Vinland colours, toon look, walls / roof slots, winAt windows (lit at night), front = +z, centred.
  const SV = {
    WHITE: '#f6f3ea', BLUE: '#2f4a7a', GREEN: '#2f9a5a', ASPH: '#55524c', LINE: '#f6f3ea', STONE: '#efe6d2', STONE2: '#e2d6bb', CONC: '#b9b4aa', CONC2: '#a39e94',
    CROSS: glowMat('#2f9a5a', '#4fd08a'), BLUEL: glowMat('#3f7fdf', '#6fa8ff'), REDL: glowMat('#d8302a', '#ff5a3a'), GLASS: BK.SHOPGL, DARKGL: glowMat('#4a6470', '#ffd98a'),
    walls: ['#f6f3ea', '#efe6d2', '#e9e2d0', '#f3e6cc', '#e3d8c4', '#f2cfb3'], roofs: [PAL.terra, '#5b5f66', PAL.terra2, '#8a5a3a']
  };
  const svOpts = { wall: colours('Walls', SV.walls), roof: colours('Roof', SV.roofs) };
  const svSign = (p, text, bg, fg, w, h, x, y, z, ry) => P(p, w, h, textMat(text, bg, fg), x, y, z, ry ? { ry } : {});
  const svCross = (p, s, x, y, z) => { P(p, s, s, SV.WHITE, x, y, z); P(p, s * 0.22, s * 0.7, SV.CROSS, x, y + s * 0.15, z + 0.02); P(p, s * 0.7, s * 0.22, SV.CROSS, x, y + s * 0.39, z + 0.03); };
  const svFlag = (p, x, z, h) => { B(p, 0.14, h || 9, 0.14, '#c9ced2', x, 0.2, z, NE); B(p, 2.2, 1.4, 0.04, PAL.terra, x + 1.15, (h || 9) - 1.4, z, FLAT); };
  const svRoofFlat = (p, w, d, x, y, z) => { B(p, w + 0.4, 0.7, d + 0.4, SV.STONE, x, y, z, NE); B(p, w - 0.4, 0.06, d - 0.4, '#9a948a', x, y + 0.66, z, FLAT); };   // parapet + roof deck
  // a vehicle from the kit, parked: 'amb' (white van, red stripe, blue lights), 'police' (blue + white stripe, light bar)
  function svCar(p, kind, x, z, ry) {
    const c = kind === 'amb' ? KIT.carVan({ body: SV.WHITE }) : KIT.carSedan({ body: SV.BLUE }); c.position.set(x, 0.2, z); c.rotation.y = ry || 0; p.add(c);
    const b = new THREE.Box3().setFromObject(c), top = b.max.y - 0.2, L = kind === 'amb' ? 4.9 : 4.6, W = kind === 'amb' ? 2.04 : 1.94;
    B(c, W, 0.22, L - 0.6, kind === 'amb' ? '#c8303a' : SV.WHITE, 0, top * (kind === 'amb' ? 0.55 : 0.45), 0, NE);
    B(c, 1.0, 0.2, 0.32, SV.BLUEL, 0, top, kind === 'amb' ? 1.6 : 0, NE); if (kind === 'amb') B(c, 0.3, 0.2, 0.3, SV.REDL, 0.5, top, -2.0, NE);
    return c;
  }

  // ---------- SMALL DISTRICT SERVICES ----------
  // 1. svClinic: a neighbourhood clinic, 2 floors, 20 x 14 m, green cross signs, entrance canopy, covered ambulance bay + 1 ambulance. 32 x 26 m lot.
  def({ key: 'svClinic', name: 'Neighbourhood clinic', cat: 'District services', part: 2, budget: 1400, size: '20 × 14 m · 2 floors · 32 × 26 m lot', night: true, opts: svOpts,
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[0]), x0 = -5, zf = 4, H = 6.8;
      B(g, 32, 0.2, 26, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 32, 0.05, 8, CP.PAVE, 0, 0.2, 9, FLAT); B(g, 9, 0.05, 18, SV.ASPH, 11, 0.2, 1, FLAT);
      B(g, 20, H, 14, W, x0, 0.2, -3); B(g, 20.2, 0.45, 14.2, SV.STONE2, x0, 0.2, -3, NE); B(g, 20.1, 0.5, 14.1, '#4f9a86', x0, 3.4, -3, NE); svRoofFlat(g, 20, 14, x0, H + 0.2, -3);
      P(g, 3.6, 2.7, GD.FRAME, x0, 0.2, zf + 0.02); P(g, 3.2, 2.5, SV.GLASS, x0, 0.25, zf + 0.05); B(g, 6, 0.3, 2.6, SV.WHITE, x0, 3.0, zf + 1.3); [-2.6, 2.6].forEach(dx => B(g, 0.2, 2.9, 0.2, SV.WHITE, x0 + dx, 0.2, zf + 2.4, NE));
      svCross(g, 2.2, x0, 4.0, zf + 0.04); svSign(g, 'CLINIC', SV.GREEN, SV.WHITE, 6, 0.9, x0, 6.0, zf + 0.04);
      [-11.5, -8, 1.5].forEach(x => gdWin(g, x, 1.0, zf + 0.02, 2.0, 1.5)); [-12, -9, 0, 3].forEach(x => gdWin(g, x, 4.4, zf + 0.02, 1.8, 1.4));
      [-1, 1].forEach(s => [1.0, 4.4].forEach(y => [-6, -1].forEach(z => gdWin(g, x0 + s * 10.02, y, z, 1.8, 1.4, s * Math.PI / 2))));
      [-12, -7, -2, 2].forEach(x => [1.0, 4.4].forEach(y => gdWin(g, x, y, -10.02, 1.8, 1.4, Math.PI)));
      // ambulance bay: canopy on posts, bay lines, 1 ambulance
      B(g, 8, 0.35, 10, SV.WHITE, 11, 4.2, 0); [[7.4, -4.6], [14.6, -4.6], [7.4, 4.6], [14.6, 4.6]].forEach(([x, z]) => B(g, 0.3, 4.0, 0.3, SV.WHITE, x, 0.2, z, NE));
      B(g, 8.1, 0.36, 0.3, '#c8303a', 11, 4.2, 5, NE); svSign(g, 'AMBULANCE', '#c8303a', SV.WHITE, 5, 0.6, 11, 3.6, 5.2);
      [8, 14].forEach(x => B(g, 0.15, 0.03, 8, SV.LINE, x, 0.25, 0, FLAT)); svCar(g, 'amb', 11, 0.5, Math.PI);
      gdBench(g, -12, 8.5, 0); gdTree(g, -14, 0.2, 10.5, 0.8); gdTree(g, 3, 0.2, 10.5, 0.8); gdLamp(g, 7, 10);
      return g;
    } });

  // 2. svPolicePost: a small police station, 18 x 14 m, 2 floors, blue band, POLICE sign, blue lamp, flag, 2 police cars in the yard. 30 x 26 m lot.
  def({ key: 'svPolicePost', name: 'Police post', cat: 'District services', part: 2, budget: 1500, size: '18 × 14 m · 2 floors · 30 × 26 m lot', night: true, opts: svOpts,
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[2]), R = slot('roof', o.roof || SV.roofs[1]), x0 = -5, zf = 4, H = 6.6;
      B(g, 30, 0.2, 26, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 30, 0.05, 8, CP.PAVE, 0, 0.2, 9, FLAT); B(g, 9, 0.05, 20, SV.ASPH, 10, 0.2, 2, FLAT);
      B(g, 18, H, 14, W, x0, 0.2, -3); B(g, 18.2, 0.45, 14.2, SV.STONE2, x0, 0.2, -3, NE); B(g, 18.1, 0.55, 14.1, SV.BLUE, x0, 3.3, -3, NE);
      HIP(g, 19.4, 3.0, 15.4, R, x0, H + 0.2, -3);
      gdDoor(g, x0, 0.25, zf + 0.02, SV.BLUE, winAt(x0, 1, zf)); B(g, 3.4, 0.25, 1.6, SV.STONE, x0, 2.8, zf + 0.8, NE); B(g, 0.5, 0.6, 0.5, SV.BLUEL, x0, 3.05, zf + 1.3, NE);   // door, hood, blue lamp
      svSign(g, 'POLICE', SV.BLUE, SV.WHITE, 7, 1.1, x0, 4.0, zf + 0.04);
      [-11, -8, -2, 1].forEach(x => gdWin(g, x, 0.9, zf + 0.02, 1.6, 1.5)); [-11, -8, -2, 1].forEach(x => gdWin(g, x, 4.4, zf + 0.02, 1.4, 1.3));
      [-1, 1].forEach(s => [0.9, 4.4].forEach(y => [-6, -0.5].forEach(z => gdWin(g, x0 + s * 9.02, y, z, 1.4, 1.3, s * Math.PI / 2))));
      [-11, -6, -1].forEach(x => [0.9, 4.4].forEach(y => gdWin(g, x, y, -10.02, 1.4, 1.3, Math.PI)));
      svFlag(g, -15, 8.5, 9); B(g, 1.2, 0.3, 1.2, SV.STONE2, -15, 0.2, 8.5, NE);
      [-1, 1].forEach(s => B(g, 0.15, 0.03, 5.2, SV.LINE, 10 + s * 1.6, 0.25, -2, FLAT)); svCar(g, 'police', 8.4, -2, Math.PI); svCar(g, 'police', 11.6, 5.5, Math.PI);
      B(g, 0.12, 1.1, 18, CP.IRON, 14.9, 0.2, -1, FLAT); gdTree(g, 3.5, 0.2, 10.5, 0.8); gdLamp(g, -9, 10.5);
      return g;
    } });

  // 3. svBusStation: a small bus station, 40 x 20 m: 3 saw-tooth bays, a platform with a long canopy, benches, a ticket kiosk, 2 buses.
  def({ key: 'svBusStation', name: 'Bus station', cat: 'District services', part: 2, budget: 3000, size: '40 × 20 m · 3 bays · 2 buses', night: true,
    opts: { canopy: colours('Canopy', ['#2f7a68', PAL.terra, '#3f5866', '#c9922e']) },
    make(o) {
      const g = new THREE.Group(), C = slot('canopy', o.canopy || '#2f7a68');
      B(g, 40, 0.2, 20, SV.ASPH, 0, 0, 0, { shadow: false }); B(g, 40, 0.35, 4, CP.PAVE, 0, 0, 7.5); B(g, 40, 0.37, 0.25, '#e8b830', 0, 0, 5.6, NE);   // platform + yellow edge
      [-12, 0, 12].forEach((x, i) => { [-1, 1].forEach(s => B(g, 0.15, 0.03, 12, SV.LINE, x + s * 1.9, 0.21, -0.4, FLAT)); P(g, 1.0, 1.0, textMat(String(i + 1), '#3f5866', SV.WHITE), x, 3.2, 5.65); });
      // canopy: posts along the back of the platform, roof sloping to the buses
      for (let x = -18; x <= 18; x += 6) B(g, 0.3, 3.8, 0.3, CP.IRON, x, 0.35, 8.8, NE);
      put(g, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), C, 0, 4.25, 7.0, { rx: -0.12, s: [40, 0.3, 5.4] });
      B(g, 40.2, 0.5, 0.3, SV.WHITE, 0, 3.8, 4.4, NE); svSign(g, 'BUS STATION', '#3f5866', SV.WHITE, 9, 1.1, 0, 4.4, 4.27, Math.PI);
      svSign(g, 'BUS STATION', '#3f5866', SV.WHITE, 9, 1.1, 0, 3.6, 9.7);
      [-15, -6, 6, 15].forEach(x => gdBench(g, x, 8.4, Math.PI)); [-10, 10].forEach(x => gdLamp(g, x, 9.3));
      // ticket kiosk at the east end
      B(g, 4, 3, 3, SV.WHITE, 17.4, 0.35, -5); B(g, 4.6, 0.3, 3.6, C, 17.4, 3.35, -5, NE); P(g, 2.4, 1.2, SV.GLASS, 17.4, 1.4, -3.48); svSign(g, 'TICKETS', '#3f5866', SV.WHITE, 2.6, 0.5, 17.4, 2.75, -3.46);
      [-12, 0].forEach((x, i) => { const b = KIT.bus({ body: i ? PAL.terra : '#2f7a68' }); b.position.set(x, 0.2, -0.2); g.add(b); });
      return g;
    } });

  // 4. svShopRow: a single-storey row of 4 small shops, 32 x 12 m, awnings, shop windows, sign panels (blank unless o.signs is given).
  def({ key: 'svShopRow', name: 'Shop row (1 floor)', cat: 'District services', part: 2, budget: 900, size: '32 × 12 m · 4 shops · 1 floor', night: true,
    opts: { wall: colours('Walls', SV.walls), awnings: choices('Awnings', Object.keys(CP.awnings)), signs: choices('Signs', ['blank', 'sample']) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[3]), aw = CP.awnings[o.awnings] || CP.awnings.mix, zf = 4, H = 4.6;
      const signs = o.signs === 'sample' ? ['GROCER', 'PHARMACY', 'BARBER', 'BAKERY'] : Array.isArray(o.signs) ? o.signs : [];
      B(g, 32, 0.25, 5, CP.PAVE, 0, 0, 6.5, { shadow: false }); B(g, 32, H, 12, W, 0, 0.2, -2); svRoofFlat(g, 32, 12, 0, H + 0.2, -2);
      B(g, 32.2, 0.9, 0.3, '#3f5866', 0, 3.5, zf + 0.15, NE);
      for (let i = 0; i < 4; i++) { const x = -12 + 8 * i, s = signs[i];
        P(g, 5.4, 2.7, GD.FRAME, x - 0.8, 0.4, zf + 0.02); P(g, 5.0, 2.4, SV.GLASS, x - 0.8, 0.55, zf + 0.05); P(g, 1.5, 2.7, GD.FRAME, x + 2.6, 0.2, zf + 0.02); P(g, 1.2, 2.5, SV.GLASS, x + 2.6, 0.3, zf + 0.05);
        P(g, 6.4, 0.7, s ? textMat(s, aw[i], SV.WHITE) : '#efe6d2', x, 3.6, zf + 0.32); awning(g, 6.6, aw[i], x, 2.95, zf + 0.75);
        gdWin(g, x, 1.2, -8.02, 1.4, 1.3, Math.PI); }
      for (let i = 0; i <= 4; i++) B(g, 0.5, H, 0.3, GD.FRAME, -16 + 8 * i, 0.2, zf + 0.15, NE);
      [-1, 1].forEach(s => { gdLamp(g, s * 13, 8.4); B(g, 1.2, 0.6, 0.6, SV.STONE2, s * 5, 0.25, 8.5, NE); plant(g, s * 5, 0.85, 8.5, PAL.pink); }); gdBench(g, 0, 8.3, Math.PI);
      return g;
    } });

  // ---------- DOWNTOWN QUARTERS (mid-rise, 3-5 floors) ----------
  // a classical portico: podium steps, n round columns, entablature and a pediment, all in stone
  function dtPortico(p, w, n, H, z, ST) {
    for (let i = 0; i < 3; i++) B(p, w + 4 - i * 1.2, 0.5, 3.2 - i * 0.8, SV.STONE2, 0, i * 0.5, z + 1.6 - i * 0.4, NE);           // front steps
    const g = grp(p, 0, 1.5, z - 2.2);
    B(g, w, 0.3, 4.4, ST, 0, 0, 0, NE);
    for (let i = 0; i < n; i++) CYL(g, 0.55, 0.65, H, 8, ST, -w / 2 + 1 + i * (w - 2) / (n - 1), 0.3, 1.4);
    B(g, w + 0.6, 1.4, 4.8, ST, 0, H + 0.3, 0); GABLE(g, w + 0.6, 3.2, 4.8, ST, 0, H + 1.7, 0); return g;
  }
  // 5a. dtMuseum: Civic Square museum, 44 x 30 m, 2 tall floors on a podium, 6-column portico, pediment, tall windows, MUSEUM sign, hip roof.
  def({ key: 'dtMuseum', name: 'Museum', cat: 'Downtown quarters', part: 2, budget: 2000, size: '44 × 30 m · 2 tall floors (15 m)', night: true, opts: svOpts,
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[1]), R = slot('roof', o.roof || SV.roofs[1]), H = 13;
      B(g, 48, 1.5, 34, SV.STONE2, 0, 0, -1); B(g, 44, H, 30, W, 0, 1.5, -2); B(g, 44.8, 1.2, 30.8, SV.STONE, 0, 1.5 + H, -2, NE); HIP(g, 45, 4, 31, R, 0, 2.7 + H, -2);
      dtPortico(g, 20, 6, 10.5, 15, SV.STONE);
      P(g, 4, 5, '#5a3c28', 0, 1.8, 13.03); svSign(g, 'MUSEUM', '#2f2b28', '#e2b04a', 10, 1.3, 0, 12.6, 15.45);
      [-19, -15, 15, 19].forEach(x => [2.8, 8.6].forEach(y => gdWin(g, x, y, 13.02, 1.8, 3.2)));
      [-1, 1].forEach(s => [-12, -6, 0, 6].forEach(z => [2.8, 8.6].forEach(y => gdWin(g, s * 22.02, y, z, 1.8, 3.2, s * Math.PI / 2))));
      [-16, -8, 0, 8, 16].forEach(x => gdWin(g, x, 6, -17.02, 1.8, 3.2, Math.PI));
      [-1, 1].forEach(s => { B(g, 3, 1.2, 3, SV.STONE2, s * 16, 0, 19, NE); B(g, 1.6, 1.4, 2.4, '#c9ced2', s * 16, 1.2, 19); });   // two plinths with statues (abstract)
      return g;
    } });
  // 5b. dtLibrary: Civic Square library, 40 x 28 m, 3 floors, 4-column entrance, long arched windows, attic + a small dome.
  def({ key: 'dtLibrary', name: 'City library', cat: 'Downtown quarters', part: 2, budget: 2000, size: '40 × 28 m · 3 floors', night: true, opts: svOpts,
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[3]), R = slot('roof', o.roof || '#4f9a86'), H = 13.5;
      B(g, 44, 1.5, 32, SV.STONE2, 0, 0, -1); B(g, 40, H, 28, W, 0, 1.5, -2); B(g, 40.6, 0.8, 28.6, SV.STONE, 0, 1.5 + H, -2, NE); svRoofFlat(g, 40, 28, 0, 2.3 + H, -2);
      B(g, 18, 3, 14, W, 0, 3 + H, -3); CYL(g, 7, 7.2, 2, 12, SV.STONE, 0, 6 + H, -3); CAP(g, 6.8, R, 0, 8 + H, -3);   // attic + drum + dome
      dtPortico(g, 14, 4, 10.5, 14, SV.STONE);
      P(g, 3.6, 4.5, '#5a3c28', 0, 1.8, 12.03); svSign(g, 'LIBRARY', '#2f2b28', '#e2b04a', 9, 1.2, 0, 12.6, 14.45);
      [-17, -13, -9, 9, 13, 17].forEach(x => { gdWin(g, x, 2.6, 12.02, 1.8, 4.2); ARCH(g, 1.8, winAt(x, 7, 12), x, 6.8, 12.05); gdWin(g, x, 9.4, 12.02, 1.6, 2.4); });
      [-1, 1].forEach(s => [-10, -4, 2, 8].forEach(z => [2.6, 9.4].forEach(y => gdWin(g, s * 20.02, y, z, 1.6, 2.6, s * Math.PI / 2))));
      [-14, -7, 0, 7, 14].forEach(x => [2.6, 9.4].forEach(y => gdWin(g, x, y, -16.02, 1.6, 2.6, Math.PI)));
      gdTree(g, -19, 1.5, 14, 0.8); gdTree(g, 19, 1.5, 14, 0.8);
      return g;
    } });

  // 6a. dtRestaurants: a 3-floor row with 4 restaurants on the ground floor, glass fronts, awnings, and terraces in front with tables + umbrellas. 40 x 14 m + 7 m terrace.
  def({ key: 'dtRestaurants', name: 'Restaurant row', cat: 'Downtown quarters', part: 2, budget: 2200, size: '40 × 14 m · 3 floors · 4 restaurants + terraces', night: true,
    opts: { wall: colours('Walls', SV.walls), roof: colours('Roof', SV.roofs), umbrellas: choices('Umbrellas', ['mix', 'cream', 'terracotta']), signs: choices('Signs', ['blank', 'sample']) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[5]), R = slot('roof', o.roof || SV.roofs[0]), zf = 4, H = 11;
      const signs = o.signs === 'sample' ? ['TRATTORIA', 'SPICE HOUSE', 'NOODLE BAR', 'THE GRILL'] : Array.isArray(o.signs) ? o.signs : [];
      const UM = { mix: [PAL.terra, '#f6f3ea', '#2f7a68', '#c9922e'], cream: ['#f6f3ea', '#efe6d2', '#f6f3ea', '#efe6d2'], terracotta: [PAL.terra, PAL.terra2, PAL.terra, PAL.terra2] }[o.umbrellas] || [PAL.terra, '#f6f3ea', '#2f7a68', '#c9922e'];
      B(g, 40, 0.25, 8, CP.PAVE, 0, 0, 8, { shadow: false }); B(g, 40, H, 14, W, 0, 0.2, -3); B(g, 40.4, 0.4, 14.4, SV.STONE, 0, 4.2, -3, NE);
      GABLE(g, 15, 2.6, 40.6, R, 0, H + 0.2, -3, { ry: Math.PI / 2 });
      for (let i = 0; i < 4; i++) { const x = -15 + 10 * i, s = signs[i];
        P(g, 8.4, 3.0, GD.FRAME, x, 0.4, zf + 0.02); P(g, 8.0, 2.8, SV.GLASS, x, 0.5, zf + 0.05);
        P(g, 8, 0.8, s ? textMat(s, '#2f2b28', '#e2b04a') : '#efe6d2', x, 3.45, zf + 0.06); awning(g, 8.4, CP.awnings.mix[i], x, 3.0, zf + 0.8);
        [-2.8, 0, 2.8].forEach(dx => [4.8, 8.2].forEach(y => gdWin(g, x + dx, y, zf + 0.02, 1.4, 1.6))); [-2.5, 2.5].forEach(dx => bar(g, 1.6, x + dx, 5.6, zf + 0.12));
        [-2.5, 2.5].forEach(dx => [1, 4.8].forEach(y => gdWin(g, x + dx, y, -10.02, 1.4, 1.5, Math.PI)));
        // terrace: low planter edge, 3 tables with umbrellas
        B(g, 9, 0.6, 0.5, SV.STONE2, x, 0.25, 11.6, NE); plant(g, x - 3.5, 0.85, 11.6, PAL.pink); plant(g, x + 3.5, 0.85, 11.6, PAL.pink);
        [-3, 0, 3].forEach((dx, k) => { CYL(g, 0.6, 0.6, 0.75, 6, SV.WHITE, x + dx, 0.25, 8.2 + (k % 2) * 1.2, { edge: false });
          B(g, 0.08, 2.4, 0.08, '#2f2b28', x + dx, 0.25, 8.2 + (k % 2) * 1.2, FLAT); CYL(g, 0.02, 1.7, 0.7, 6, UM[(i + k) % 4], x + dx, 2.3, 8.2 + (k % 2) * 1.2); }); }
      [-1, 1].forEach(s => gdLamp(g, s * 19.5, 11.6));
      return g;
    } });
  // 6b. dtRetail: a small shopping arcade, 44 x 24 m, 3 floors: shops either side of a glass-roofed passage through the middle, ARCADE sign.
  def({ key: 'dtRetail', name: 'Shopping arcade', cat: 'Downtown quarters', part: 2, budget: 2000, size: '44 × 24 m · 3 floors · glass passage', night: true,
    opts: { wall: colours('Walls', SV.walls), roof: colours('Roof', SV.roofs), signs: choices('Signs', ['blank', 'sample']) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[1]), R = slot('roof', o.roof || SV.roofs[1]), zf = 10, H = 11.5;
      const signs = o.signs === 'sample' ? ['SHOES', 'BOOKS', 'GIFTS', 'TAILOR'] : Array.isArray(o.signs) ? o.signs : [];
      B(g, 48, 0.25, 6, CP.PAVE, 0, 0, 13, { shadow: false });
      [-1, 1].forEach(s => { B(g, 17, H, 20, W, s * 13.5, 0.2, 0); HIP(g, 18, 3, 21, R, s * 13.5, H + 0.2, 0); B(g, 17.2, 0.4, 20.2, SV.STONE, s * 13.5, 4.2, 0, NE); });
      // the arch over the passage + glass gable roof
      B(g, 10, 2.8, 20, W, 0, H - 2.6, 0); B(g, 10, 0.35, 20, SV.STONE, 0, 0.2, 0, NE); GABLE(g, 10, 3.2, 20.4, CP.GLASS_SEE, 0, H + 0.2, 0);
      B(g, 10.4, 0.8, 0.6, SV.STONE, 0, H - 2.6, zf + 0.1, NE); svSign(g, 'ARCADE', '#2f2b28', '#e2b04a', 6.4, 1.2, 0, H - 1.6, zf + 0.42);
      [-1, 1].forEach(s => { for (let k = 0; k < 2; k++) { const x = s * (7 + 4.5 + k * 9), i = (s < 0 ? 0 : 2) + k, t = signs[i];
          P(g, 7, 2.8, GD.FRAME, x, 0.4, zf + 0.02); P(g, 6.6, 2.6, SV.GLASS, x, 0.5, zf + 0.05); P(g, 7, 0.7, t ? textMat(t, '#3f5866', SV.WHITE) : '#efe6d2', x, 3.4, zf + 0.06);
          [-2.4, 0, 2.4].forEach(dx => [4.9, 8.2].forEach(y => gdWin(g, x + dx, y, zf + 0.02, 1.3, 1.6))); }
        [-6, -2, 2, 6].forEach(z => P(g, 2.4, 2.6, SV.GLASS, s * 5.02, 0.5, z, { ry: -s * Math.PI / 2 }));   // shop windows inside the passage
        [-6, 0, 6].forEach(z => [1, 4.9, 8.2].forEach(y => gdWin(g, s * 22.02, y, z, 1.4, 1.5, s * Math.PI / 2))); });
      [-18, -9, 9, 18].forEach(x => [1, 4.9, 8.2].forEach(y => gdWin(g, x, y, -10.02, 1.4, 1.5, Math.PI)));
      [-1, 1].forEach(s => { B(g, 1.4, 0.6, 1.4, SV.STONE2, s * 5.8, 0.25, 12.2, NE); gdTree(g, s * 5.8, 0.85, 12.2, 0.6); });
      return g;
    } });

  // 7a. dtHotel: a 5-floor hotel, 32 x 18 m, glass lobby, a canopy over the drop-off, HOTEL sign on the roof, flags, small balconies.
  def({ key: 'dtHotel', name: 'Hotel', cat: 'Downtown quarters', part: 2, budget: 2000, size: '32 × 18 m · 5 floors', night: true, opts: svOpts,
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[5]), R = slot('roof', o.roof || SV.roofs[0]), zf = 5, FH = 3.2, F = 5, H = F * FH + 1;
      B(g, 36, 0.25, 9, CP.PAVE, 0, 0, 9.5, { shadow: false }); B(g, 32, H, 18, W, 0, 0.2, -4); B(g, 32.2, 4.2, 18.2, SV.STONE, 0, 0.2, -4, NE);
      B(g, 32.6, 0.5, 18.6, SV.STONE, 0, H, -4, NE); HIP(g, 33.2, 3.4, 19.2, R, 0, H + 0.4, -4);
      P(g, 14, 3.3, GD.FRAME, 0, 0.4, zf + 0.02); P(g, 13.4, 3.1, SV.GLASS, 0, 0.5, zf + 0.05);                              // lobby glass
      B(g, 12, 0.45, 6.5, '#2f2b28', 0, 3.6, zf + 3.2); [-5.6, 5.6].forEach(x => B(g, 0.25, 3.4, 0.25, '#c9a24a', x, 0.25, zf + 6.2, NE));   // canopy
      B(g, 11, 0.04, 6, '#8a3a2e', 0, 0.26, zf + 3.0, FLAT);                                                                 // red carpet
      svSign(g, 'HOTEL', '#2f2b28', '#e2b04a', 7.2, 1.4, 0, 4.15, zf + 6.48); B(g, 12, 2.4, 0.4, '#2f2b28', 0, H + 0.4, zf - 0.6, NE);
      svSign(g, 'HOTEL', '#2f2b28', '#ffd98a', 11.4, 2.0, 0, H + 0.6, zf - 0.38);
      for (let f = 1; f < F; f++) { const y = 4.2 + (f - 1) * FH;
        [-13.5, -10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5, 13.5].forEach(x => gdWin(g, x, y + 0.7, zf + 0.02, 1.4, 1.7));
        [-12, -6, 6, 12].forEach(x => B(g, 2.2, 0.15, 0.7, SV.STONE, x, y + 0.2, zf + 0.35, NE));
        [-13.5, -7.5, -1.5, 4.5, 10.5].forEach(x => gdWin(g, x, y + 0.7, -13.02, 1.4, 1.7, Math.PI));
        [-1, 1].forEach(s => [-9, -3].forEach(z => gdWin(g, s * 16.02, y + 0.7, z, 1.4, 1.7, s * Math.PI / 2))); }
      [-12, 12].forEach(x => gdWin(g, x, 1.2, zf + 0.02, 3, 2));
      [-9, -7.5, -6].forEach(x => svFlag(g, x, 12.5, 8)); gdTree(g, 9, 0.25, 12.5, 0.8); gdTree(g, 14, 0.25, 12.5, 0.8);
      return g;
    } });
  // 7b. dtConvention: a low wide convention centre, 56 x 36 m, one tall hall (12 m), full-height glass front, wide canopy, clerestory, forecourt with flags.
  def({ key: 'dtConvention', name: 'Convention centre', cat: 'Downtown quarters', part: 2, budget: 1800, size: '56 × 36 m · 1 tall hall (12 m)', night: true, opts: svOpts,
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[1]), R = slot('roof', o.roof || SV.roofs[1]), zf = 12, H = 12;
      B(g, 60, 0.25, 14, CP.PAVE, 0, 0, 19, { shadow: false }); B(g, 56, H, 36, W, 0, 0.2, -6); svRoofFlat(g, 56, 36, 0, H + 0.2, -6);
      B(g, 30, 3, 20, W, 0, H + 0.9, -8); GABLE(g, 31, 2.4, 21, R, 0, H + 3.9, -8, { ry: Math.PI / 2 });
      [-14, -7, 0, 7, 14].forEach(x => P(g, 6, 2, SV.DARKGL, x, H + 1.4, 2.03));                                     // clerestory band
      P(g, 40, 10, GD.FRAME, 0, 0.6, zf + 0.02); P(g, 39, 9.6, SV.GLASS, 0, 0.7, zf + 0.05);
      for (let x = -18; x <= 18; x += 4.5) B(g, 0.25, 9.6, 0.2, '#f6f3ea', x, 0.7, zf + 0.12, FLAT);                  // glass mullions
      B(g, 44, 0.5, 6, SV.WHITE, 0, 10.2, zf + 3); [-20, -10, 0, 10, 20].forEach(x => B(g, 0.35, 10, 0.35, SV.WHITE, x, 0.25, zf + 5.6, NE));
      svSign(g, 'CONVENTION CENTRE', '#3f5866', SV.WHITE, 18, 1.6, 0, 10.0, zf + 6.03);
      [-1, 1].forEach(s => [-16, -6, 4].forEach(z => gdWin(g, s * 28.02, 2, z, 4, 3, s * Math.PI / 2)));
      for (let k = 0; k < 6; k++) svFlag(g, -25 + k * 2.4 + (k > 2 ? 40 : 0), 23, 9);
      [-14, 14].forEach(x => { B(g, 5, 0.6, 2, SV.STONE2, x, 0.25, 22, NE); plant(g, x - 1.5, 0.85, 22, PAL.pink); plant(g, x + 1.5, 0.85, 22, '#f2c14e'); });
      return g;
    } });

  // 8. dtOffice: a mid-rise office block, 32 x 20 m. o.variant 'A' = 5 floors, stone with horizontal glass ribbons, plant room on the roof;
  //    'B' = 4 floors, glass curtain wall in a stone frame with fins, an arcade at ground floor, roof terrace with a pergola.
  def({ key: 'dtOffice', name: 'Office block', cat: 'Downtown quarters', part: 2, budget: 1800, size: '32 × 20 m · 4–5 floors', night: true,
    opts: { variant: choices('Variant', ['A', 'B']), wall: colours('Walls', SV.walls) },
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[o.variant === 'B' ? 4 : 1]), B2 = o.variant === 'B', F = B2 ? 4 : 5, FH = 3.6, H = F * FH + 0.6, zf = 6;
      B(g, 36, 0.25, 6, CP.PAVE, 0, 0, 10, { shadow: false });
      if (!B2) {
        B(g, 32, H, 20, W, 0, 0.2, -4); B(g, 32.4, 0.6, 20.4, SV.STONE, 0, H + 0.2, -4, NE); B(g, 12, 2.6, 8, SV.CONC, 4, H + 0.8, -6);
        for (let f = 0; f < F; f++) { const y = 0.2 + f * FH + 1.0;
          for (let k = 0; k < 6; k++) { const x = -13.5 + k * 5.4; P(g, 5.0, 1.8, winAt(x, y, zf), x, y, zf + 0.03); P(g, 5.0, 1.6, winAt(x, y, -14), x, y, -14.03, { ry: Math.PI }); }
          [-1, 1].forEach(s => [-10, -4, 2].forEach(z => P(g, 5.0, 1.8, winAt(s, y, z), s * 16.03, y, z, { ry: s * Math.PI / 2 })));
          B(g, 32.2, 0.35, 0.3, SV.STONE, 0, y - 0.45, zf + 0.12, NE); }
        P(g, 6, 2.8, SV.GLASS, 0, 0.3, zf + 0.06); B(g, 7, 0.3, 2, SV.STONE, 0, 3.1, zf + 1, NE);
      } else {
        B(g, 32, H, 20, W, 0, 0.2, -4); B(g, 26, H - 4.4, 0.5, '#3f5866', 0, 4.4, zf + 0.1, NE);
        for (let f = 1; f < F; f++) { const y = 0.2 + f * FH + 0.4; for (let k = 0; k < 5; k++) { const x = -10.4 + k * 5.2; P(g, 4.8, 3.0, winAt(x, y, zf), x, y, zf + 0.4); }
          [-1, 1].forEach(s => [-10, -4, 2].forEach(z => gdWin(g, s * 16.02, y + 0.3, z, 2.4, 2.2, s * Math.PI / 2)));
          [-12, -6, 0, 6, 12].forEach(x => gdWin(g, x, y + 0.3, -14.02, 2.4, 2.2, Math.PI)); }
        for (let k = 0; k <= 5; k++) B(g, 0.4, H - 4.4, 0.8, SV.STONE, -13 + k * 5.2, 4.4, zf + 0.5, NE);                  // fins
        B(g, 32, 0.8, 1.2, SV.STONE, 0, 3.6, zf + 0.6, NE); for (let k = 0; k < 7; k++) B(g, 0.8, 3.4, 0.8, SV.STONE, -14 + k * 4.67, 0.2, zf + 0.5, NE);   // ground arcade
        P(g, 28, 2.8, SV.GLASS, 0, 0.4, zf - 1.9); B(g, 32.4, 0.6, 20.4, SV.STONE, 0, H + 0.2, -4, NE);
        const pg = grp(g, -6, H + 0.8, -4); [[-5, -3], [5, -3], [-5, 3], [5, 3]].forEach(([x, z]) => B(pg, 0.25, 2.6, 0.25, PAL.wood, x, 0, z, FLAT));
        [-3, 0, 3].forEach(z => B(pg, 10.4, 0.2, 0.2, PAL.wood, 0, 2.6, z, FLAT)); [8, -14].forEach(x => { B(g, 1.4, 0.6, 1.4, SV.STONE2, x, H + 0.8, -2, NE); plant(g, x, H + 1.4, -2, PAL.leaf2); });
      }
      [-15, 15].forEach(x => gdTree(g, x, 0.25, 10.5, 0.75));
      return g;
    } });

  // 9. dtHospital: a small city hospital, 40 x 24 m, 3 floors, entrance canopy, green cross, CITY HOSPITAL sign, covered ambulance bay + 2 ambulances.
  def({ key: 'dtHospital', name: 'City hospital (small)', cat: 'Downtown quarters', part: 2, budget: 2400, size: '40 × 24 m · 3 floors · 54 × 40 m lot', night: true, opts: svOpts,
    make(o) {
      const g = new THREE.Group(), W = slot('wall', o.wall || SV.walls[0]), x0 = -6, zf = 7, FH = 3.6, H = 3 * FH + 0.4;
      B(g, 54, 0.2, 40, PAL.grass, 0, 0, 0, { shadow: false }); B(g, 54, 0.05, 11, CP.PAVE, 0, 0.2, 14, FLAT); B(g, 12, 0.05, 30, SV.ASPH, 20, 0.2, 2, FLAT);
      B(g, 40, H, 24, W, x0, 0.2, -5); B(g, 40.2, 0.5, 24.2, SV.STONE2, x0, 0.2, -5, NE); svRoofFlat(g, 40, 24, x0, H + 0.2, -5);
      for (let f = 0; f < 3; f++) B(g, 40.1, 0.4, 24.1, '#4f9a86', x0, 0.2 + f * FH + 3.2, -5, NE);
      P(g, 8, 3, GD.FRAME, x0, 0.2, zf + 0.02); P(g, 7.4, 2.8, SV.GLASS, x0, 0.25, zf + 0.05); B(g, 12, 0.4, 5, SV.WHITE, x0, 3.4, zf + 2.5); [-5.4, 5.4].forEach(dx => B(g, 0.3, 3.2, 0.3, SV.WHITE, x0 + dx, 0.2, zf + 4.7, NE));
      svCross(g, 2.6, x0, 4.4, zf + 0.04); svSign(g, 'CITY HOSPITAL', SV.GREEN, SV.WHITE, 12, 1.3, x0, H - 1.6, zf + 0.04);
      for (let f = 0; f < 3; f++) { const y = 0.2 + f * FH + 1.0; [-24, -20, -16, 4, 8, 12].forEach(x => { if (f || Math.abs(x - x0) > 7) gdWin(g, x, y, zf + 0.02, 2.4, 1.6); });
        if (f) [-10, -6, -2].forEach(x => gdWin(g, x, y, zf + 0.02, 2.4, 1.6));
        [-24, -18, -12, -6, 0, 6, 12].forEach(x => gdWin(g, x, y, -17.02, 2.4, 1.6, Math.PI));
        [-1, 1].forEach(s => [-13, -7, -1, 5].forEach(z => gdWin(g, x0 + s * 20.02, y, z, 2.4, 1.6, s * Math.PI / 2))); }
      // ambulance bay on the east side
      B(g, 11, 0.4, 14, SV.WHITE, 20, 4.4, -1); [[15, -7.6], [25, -7.6], [15, 5.6], [25, 5.6]].forEach(([x, z]) => B(g, 0.35, 4.2, 0.35, SV.WHITE, x, 0.2, z, NE));
      B(g, 11.1, 0.42, 0.3, '#c8303a', 20, 4.4, 6, NE); svSign(g, 'AMBULANCE', '#c8303a', SV.WHITE, 6, 0.7, 20, 3.7, 6.2);
      svCar(g, 'amb', 17.5, -1, Math.PI); svCar(g, 'amb', 22.5, 0, Math.PI);
      [-22, -14, 6].forEach(x => gdBench(g, x, 13.5, 0)); [-25, 10].forEach(x => gdTree(g, x, 0.2, 17, 0.85)); gdLamp(g, -2, 18);
      return g;
    } });

  // ---------- VINLAND TOWER CONSTRUCTION ----------
  // 10. vtTowerBuild: the Vinland Tower going up, o.stage 0-10 (0 = dug site, 5 = about half, 10 = topped out). Same site as the map's
  //     tower site (72 x 72 m) and the same tower as the kit's campanile (36 x 36 m base, 24 m shaft, body up to 180 m).
  //     Concrete core, floor slabs, stone cladding below, scaffolding on the top floors, a climbing crane on the core (+ a ground crane early),
  //     site fence + hoarding with a blank sign panel (o.sign gives it words). Night: crane + site lights.
  def({ key: 'vtTowerBuild', name: 'Vinland Tower (construction)', cat: 'Construction', part: 2, budget: 4500, size: 'site 72 × 72 m · tower 36 m base, up to 180 m', night: true,
    opts: { stage: choices('Stage', ['5', '0', '1', '2', '3', '4', '6', '7', '8', '9', '10']), sign: { label: 'Sign', choices: ['', 'VINLAND TOWER · OPENS AT 10,000'] } },
    make(o) {
      const g = new THREE.Group(), st = Math.max(0, Math.min(10, +(o.stage === undefined ? 5 : o.stage))), FL = 4, TOP = 180, h = st ? 12 + (TOP - 12) * st / 10 : 0;
      const ST = glowMat(PAL.cream, '#6a5a40'), BR = PAL.terra2, SCAF = '#c98a3a', GLW = BK.WIN;
      B(g, 72, 0.2, 72, '#cdb98f', 0, 0, 0, { shadow: false }); B(g, 10, 0.06, 18, '#9a948a', 0, 0.2, 27, FLAT);           // site ground + gate road
      // fence + hoarding (gap for the gate at the front) and the sign panel
      [[0, -35.9, 72, 0.2], [-35.9, 0, 0.2, 72], [35.9, 0, 0.2, 72], [-20.5, 35.9, 31, 0.2], [20.5, 35.9, 31, 0.2]].forEach(([x, z, w, d]) => B(g, w, 2.6, d, '#e6dccb', x, 0.2, z, NE));
      [[-20.5, 36.02], [20.5, 36.02]].forEach(([x, z]) => B(g, 31, 0.3, 0.06, '#2f5d4a', x, 2.5, z, FLAT));
      B(g, 16, 4.4, 0.3, '#2f5d4a', -20, 0.2, 36.2, NE); P(g, 15.4, 3.8, o.sign ? textMat(o.sign, '#2f5d4a', '#f6f3ea') : '#f6f3ea', -20, 0.5, 36.37);
      [-5, 5].forEach(x => B(g, 0.4, 3, 0.4, '#2f5d4a', x, 0.2, 35.9, NE));
      [-34, 34].forEach(x => [-34, 34].forEach(z => { B(g, 0.15, 6, 0.15, CP.IRON, x, 0.2, z, FLAT); B(g, 0.6, 0.5, 0.6, CP.LAMP, x, 6.2, z, NE); }));
      if (!st) {                                                                                                          // stage 0: dug, piles, one crane
        B(g, 38, 0.3, 38, '#8a7458', 0, 0.05, 0, { shadow: false }); for (let i = 0; i < 16; i++) B(g, 0.8, 1.4, 0.8, SV.CONC, -15 + (i % 4) * 10, 0.3, -15 + ((i / 4) | 0) * 10, NE);
      } else {
        const podium = Math.min(h, 12), body = h - podium;
        B(g, 36, podium, 36, SV.CONC, 0, 0.2, 0); if (h >= 12) { B(g, 37, 1, 37, BR, 0, 12, 0, NE); P(g, 6, 7, '#6a5a48', 0, 0.4, 18.05); }
        if (body > 0) {
          const clad = Math.max(0, body - 3 * FL);                                                                        // clad up to 3 floors below the top
          if (clad > 0) { B(g, 24, clad, 24, ST, 0, 12.6, 0); for (let y = 30; y < 12 + clad; y += 30) B(g, 24.6, 1.2, 24.6, BR, 0, 12.6 + y - 12, 0, NE);
            for (let y = 16; y < 12 + clad - 3; y += 8) [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2; P(g, 3, 4, winAt(k, y, 1), Math.sin(a) * 12.05, y, Math.cos(a) * 12.05, { ry: a }); }); }
          const y0 = 12.6 + clad, open = h - y0;
          B(g, 10, open + 3, 10, SV.CONC2, 0, y0, 0);                                                                     // core above the cladding
          for (let y = y0; y <= h; y += FL) B(g, 24, 0.5, 24, SV.CONC, 0, y, 0, NE);                                    // open floor slabs
          [-11, 11].forEach(x => [-11, 11].forEach(z => B(g, 1, open, 1, SV.CONC, x, y0, z, NE)));                     // corner columns
          // scaffolding round the top floors (posts + rails + a safety net colour band)
          const sy = Math.max(12.6, h - 14), sh = h + 2 - sy;
          [-12.8, 12.8].forEach(x => [-12.8, -4.3, 4.3, 12.8].forEach(z => { B(g, 0.15, sh, 0.15, SCAF, x, sy, z, FLAT); B(g, 0.15, sh, 0.15, SCAF, z, sy, x, FLAT); }));
          for (let y = sy + 2; y < sy + sh; y += 4) [[0, -12.8, 25.8, 0.12], [0, 12.8, 25.8, 0.12], [-12.8, 0, 0.12, 25.8], [12.8, 0, 0.12, 25.8]].forEach(([x, z, w, d]) => B(g, w, 0.12, d, SCAF, x, y, z, FLAT));
          [[0, -13, 25.8, 0.05], [0, 13, 25.8, 0.05], [-13, 0, 0.05, 25.8], [13, 0, 0.05, 25.8]].forEach(([x, z, w, d]) => B(g, w, Math.min(6, sh), d, glowMat('#4f9a86', '#22332e'), x, sy + 0.5, z, FLAT));
        }
        B(g, 2, h, 2.6, '#e8b830', 14, 0.2, 9, NE); B(g, 2.4, 2.4, 2.6, '#f6f3ea', 15.4, Math.max(0.2, h - 6), 9, NE);   // goods hoist on the side
      }
      // cranes: a climbing crane on the core (stage 1+), a ground crane while the tower is low
      if (st) { const c = KIT.towerCrane(); c.position.set(0, Math.max(0, h - 30), 0); c.rotation.y = 0.6; g.add(c); }
      if (st <= 4) { const c = KIT.towerCrane(); c.position.set(-26, 0.2, -20); c.rotation.y = st ? 2.4 : 1.2; g.add(c); }
      // yard: site cabins, materials, a mixer
      [0, 1].forEach(k => { B(g, 6, 2.6, 2.6, k ? '#3f5866' : '#c9922e', 24, 0.2 + k * 2.6, 24, NE); P(g, 1.2, 0.9, winAt(24, k, 25), 24, 1.2 + k * 2.6, 25.32); });
      const mt = KIT.materials(); mt.position.set(-24, 0.2, 24); g.add(mt); const mx = KIT.cementMixer(); mx.position.set(-12, 0.2, 27); mx.rotation.y = 0.8; g.add(mx);
      return g;
    } });

  // Vinland Tower, 'empire' style (16 Nov try, Dev: "like the Empire State, in our look, a little glassy, it's downtown"):
  // an art deco setback skyscraper in cream stone. Wide podium, then 4 setbacks, each tier with tall stone piers and
  // vertical ribbons of silver-blue glass (lit like windows at night), terracotta bands at every setback, copper trim,
  // a stepped glass crown that glows at night, a glass observation deck, an octagonal mast and a needle with a red beacon
  // (about 262 m, same as the campanile). Same plaza and footprint. o.state 'site' = podium + first tier, scaffolding, crane, board.
  function empireTower(o) {
    const g = new THREE.Group(), site = o.state === 'site';
    towerPlaza(g, '#f3ede1', PAL.sand2);
    const ST = glowMat(PAL.cream, '#6a5a40'), BR = glowMat(PAL.terra2, '#4a2a1c'), CU = '#4f9a86', GOLD = '#e2b04a';
    const GL = glowMat('#8fb3c4', '#ffd27a'), GLO = glowMat('#8fb3c4', '#3a3a34'), DOORG = glowMat(PAL.glassWarm, '#ffcf6a');
    const CROWN = (() => { const m = glowMat('#cfe6ef', '#fff3c4'); m.userData.dayGlow = '#1c2a30'; return m; })();
    const lit = (x, y, k) => (Math.abs(Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453) % 1) < 0.7 ? GL : GLO;
    // one tier: a stone block of width w from y0 to y1, corner piers, and n glass ribbons a face in 10 m panels
    const tier = (w, y0, y1, n, seg) => {
      B(g, w, y1 - y0, w, ST, 0, y0, 0);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 1.6, y1 - y0, 1.6, ST, a * (w / 2 - 0.3), y0, b * (w / 2 - 0.3), NE));
      const sw = (w - 4) / n * 0.62;
      [0, 1, 2, 3].forEach(k => { const f = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, w / 2 + 0.04);
        for (let y = y0 + 1.5; y + seg - 1 <= y1 - 0.5; y += seg) for (let i = 0; i < n; i++) { const x = -(w - 4) / 2 + (i + 0.5) * (w - 4) / n; P(f, sw, seg - 1.2, lit(x, y, k), x, y, 0); } });
    };
    const band = (w, y, c, h) => B(g, w, h || 1.2, w, c || BR, 0, y, 0, NE);
    // podium (6 floors) with a tall deco entrance on each side
    tier(44, 0.3, 24, 6, 5.5); band(45, 24);
    [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, 22.06);
      P(s, 12, 12.5, '#e9dcc0', 0, 0.3, 0); P(s, 8, 9, DOORG, 0, 0.6, 0.03); P(s, 5, 2.4, DOORG, 0, 9.9, 0.03);
      B(s, 9.6, 0.6, 0.5, GOLD, 0, 9.6, 0.1, NE); B(s, 13, 0.8, 0.6, BR, 0, 12.8, 0.1, NE); });
    const top1 = site ? 54 : 66;
    tier(34, 25.2, top1, 6, 7);
    if (!site) {
      band(35, 66); tier(26, 67.2, 196, 5, 10); band(27, 196); B(g, 27.6, 0.4, 27.6, CU, 0, 197.2, 0, NE);
      tier(20, 197.6, 210, 3, 6); band(21, 210, CU, 0.8);
      tier(15, 210.8, 220, 3, 4.6); band(16, 220, GOLD, 0.6);
      // the stepped glass crown: three glowing glass tiers with gold ribs, then the observation deck
      let y = 220.6;
      [[12, 6], [9, 5], [6.6, 4]].forEach(([w, h]) => { B(g, w, h, w, CROWN, 0, y, 0);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 0.5, h, 0.5, GOLD, a * w / 2, y, b * w / 2, NE));
        B(g, w + 0.6, 0.4, w + 0.6, GOLD, 0, y + h, 0, NE); y += h + 0.4; });
      B(g, 9, 0.3, 9, ST, 0, y, 0, NE); B(g, 8, 3, 8, CROWN, 0, y + 0.3, 0); B(g, 9.2, 0.15, 9.2, PAL.iron, 0, y + 1.4, 0, FLAT); y += 3.3;   // observation deck
      CYL(g, 2.6, 3.4, 14, 8, ST, 0, y, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; B(g, 0.4, 13, 0.4, CU, Math.sin(a) * 3.1, y, Math.cos(a) * 3.1, FLAT); }   // mast
      y += 14; CYL(g, 3, 3, 0.6, 8, GOLD, 0, y, 0, NE); y += 0.6;
      CYL(g, 0.15, 0.9, 12.5, 6, '#c9ced2', 0, y, 0); y += 12.5; BALL(g, 0.7, glowMat('#ff4a30', '#ff3a20'), 0, y + 0.4, 0, NE);   // needle + red beacon
      // floodlit stone at night: warm lamps at the setbacks
      [66.6, 196.6, 210.4].forEach(yy => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const w = yy < 100 ? 34 : yy < 200 ? 26 : 20; BALL(g, 0.5, CP.LAMP, a * (w / 2 + 0.6), yy + 1.2, b * (w / 2 + 0.6), NE); }));
    } else {
      const SC = '#8a8f94', NET = '#5f8a5a';
      [0, 1, 2, 3].forEach(k => { const s = grp(grp(g, 0, 0, 0, k * Math.PI / 2), 0, 0, 18.6);
        [-16, -8, 0, 8, 16].forEach(x => B(s, 0.25, top1 - 16, 0.25, SC, x, 25.2, 0, FLAT));
        for (let y = 30; y <= top1 + 4; y += 8) B(s, 34, 0.25, 1.6, '#b98b5e', 0, y, -0.6, FLAT);
        P(s, 34, 10, NET, 0, top1 - 8, 0.15, { edge: true }); });
      const cr = KIT.towerCrane(); cr.scale.setScalar(2); cr.position.set(26, 0.3, -26); cr.rotation.y = -Math.PI * 0.75; g.add(cr);
      const mt = KIT.materials(); mt.position.set(28, 0.3, 14); g.add(mt);
      const bd = KIT.milestoneBoard({ text: o.boardText || 'Vinland Tower · opens at 10,000 citizens' }); bd.position.set(-14, 0.3, 30); g.add(bd); g.userData.setText = bd.userData.setText;
    }
    return g;
  }

  // ---------- tools ----------
  // how many triangles an asset has (outline lines are not counted)
  KIT.tris = function (g) { let n = 0; g.traverse(o => { if (o.isMesh) { const ge = o.geometry; n += (ge.index ? ge.index.count : ge.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } }); return Math.round(n); };
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
  KIT.setNight = (g, on) => g.traverse(m => { if (m.userData.beam) { m.visible = on; return; } if (m.isMesh && m.material.userData.glow) m.material.emissive.set(on ? m.material.userData.glow : m.material.userData.dayGlow || '#000000'); });   // light beams (concert) only at night

  // bake: squash an asset into one piece per colour, ready for InstancedMesh
  KIT.bake = function (g) {
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), M = new THREE.Matrix4(), parts = new Map(), lines = [];
    const cat = a => { const out = new Float32Array(a.reduce((t, x) => t + x.length, 0)); let k = 0; a.forEach(x => { out.set(x, k); k += x.length; }); return out; };
    g.traverse(o => {
      if (!o.isMesh && !o.isLineSegments) return; M.multiplyMatrices(inv, o.matrixWorld);
      if (o.isLineSegments) { const ge = o.geometry.clone(); ge.applyMatrix4(M); lines.push(ge.attributes.position.array); return; }
      const key = o.material.uuid + (o.castShadow ? 's' : 'n');
      const mm = o.material;
      if (!parts.has(key)) parts.set(key, { slot: mm.userData.slot || null, color: mm.color.clone(), shadow: o.castShadow, pos: [], nor: [], uv: [],
        map: mm.map || null, emissiveMap: mm.emissiveMap || null, glow: mm.userData.glow || null, dayGlow: mm.userData.dayGlow || null, side: mm.side, basic: !!mm.isMeshBasicMaterial, transparent: mm.transparent, opacity: mm.opacity, blending: mm.blending });
      const ge = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); ge.applyMatrix4(M);
      if (!ge.attributes.normal) ge.computeVertexNormals();
      const pt = parts.get(key); pt.pos.push(ge.attributes.position.array); pt.nor.push(ge.attributes.normal.array);
      pt.uv.push(ge.attributes.uv ? ge.attributes.uv.array : new Float32Array(ge.attributes.position.count * 2));   // keep UVs so window textures survive
    });
    const list = [...parts.values()].map(pt => { const ge = new THREE.BufferGeometry();
      ge.setAttribute('position', new THREE.BufferAttribute(cat(pt.pos), 3)); ge.setAttribute('normal', new THREE.BufferAttribute(cat(pt.nor), 3));
      if (pt.map || pt.emissiveMap) ge.setAttribute('uv', new THREE.BufferAttribute(cat(pt.uv), 2)); ge.computeBoundingSphere();
      return Object.assign({}, pt, { geo: ge, pos: undefined, nor: undefined, uv: undefined }); });
    return { parts: list, lines: cat(lines) };
  };
  // instances: draw many copies. matrices = array of THREE.Matrix4; tints(i) = { slotName: '#hex' } for copy i (optional).
  KIT.instances = function (baked, matrices, tints) {
    const out = new THREE.Group(), n = matrices.length, c = new THREE.Color();
    baked.parts.forEach(pt => {
      const m = pt.basic ? new THREE.MeshBasicMaterial({ color: '#ffffff' }) : toon('#ffffff');            // keeps textures, night glow, both-sided faces
      if (pt.map) m.map = pt.map; if (pt.emissiveMap && !pt.basic) m.emissiveMap = pt.emissiveMap;
      if (pt.glow) m.userData.glow = pt.glow; if (pt.dayGlow) { m.userData.dayGlow = pt.dayGlow; if (m.emissive) m.emissive.set(pt.dayGlow); }
      m.side = pt.side; if (pt.transparent) { m.transparent = true; m.opacity = pt.opacity; m.blending = pt.blending; m.depthWrite = false; }
      const im = new THREE.InstancedMesh(pt.geo, m, n);
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
