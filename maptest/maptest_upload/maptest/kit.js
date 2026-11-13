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
  def({ key: 'vinlandTower', name: 'Vinland Tower', cat: 'Landmarks', part: 1, budget: 6000, size: 'Plaza 120 \u00d7 120 m \u00b7 243 m tall', night: true,
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

  // ---- VINLAND STADIUM: one big multi-use bowl (American style). Oval field for football AND cricket, plus a concert mode.
  // Two tiers of seats all round, a suite band, roof canopy ring, big screens at both ends, 4 floodlight towers,
  // 'VINLAND STADIUM' on the outside (no brands). Modes: o.mode = 'football' | 'cricket' | 'concert'.
  // Night (setNight): floodlights, roof-rim lights, screens, suite windows; in concert mode stage lights + light beams.
  // About 250 x 270 m outside, field 116 x 144 m. Kit only: not on the map until the stadium is unlocked or voted. ----
  def({ key: 'stadium', name: 'Vinland Stadium', cat: 'Landmarks', part: 2, budget: 12000, size: 'about 250 \u00d7 270 m \u00b7 field 116 \u00d7 144 m \u00b7 48 m tall', night: true,
    opts: { mode: choices('Mode', ['football', 'cricket', 'concert']), seat: colours('Seats', [PAL.terra, '#2f7a68', '#3f7fbf', '#c9922e']) },
    make(o) {
      const g = new THREE.Group(), mode = o.mode || 'football', SEAT = slot('seat', o.seat || PAL.terra);
      const LIT = (c, n) => glowMat(c, n), GRASS = LIT('#7fb156', '#4f7a34'), GRASS2 = LIT('#6fa04a', '#456c2c'), WL = LIT(LINE, '#d8d8d0');   // under the floodlights the field glows at night
      const RX = 58, RZ = 72, N = 48, E = (t, off) => ({ x: Math.sin(t) * (RX + off), z: Math.cos(t) * (RZ + off) });
      const two = c => { const m = toon(c); m.side = THREE.DoubleSide; return m; };
      const SEATM = (() => { const m = SEAT.clone(); m.side = THREE.DoubleSide; m.userData.slot = 'seat'; return m; })();
      const AISLE = two('#d9d2c4'), CONC = two('#cfc6b4'), WALLM = two('#e9e3d6'), ROOF = two('#f4f2ee');
      const SUITE = (() => { const m = glowMat('#3f5866', '#ffd98a'); m.side = THREE.DoubleSide; return m; })();
      // the bowl: a cross-section (offset from the field edge, height) swept all round the oval
      const prof = [[0, 0.3, WALLM], [0, 3, CONC], [1.5, 3, null]];
      const band = (o1, y1, o2, y2, n) => { for (let i = 0; i < n; i++) prof.push([o1 + (o2 - o1) * (i + 1) / n, y1 + (y2 - y1) * (i + 1) / n, i % 2 ? AISLE : SEATM]); };
      prof[prof.length - 1][2] = WALLM;
      band(1.5, 3, 22, 15, 6);                                                                       // lower tier
      prof.push([25, 15, CONC]); prof.push([25, 20, SUITE]); prof.push([26, 20, WALLM]);           // concourse + suite band
      band(26, 20, 43, 37, 6);                                                                       // upper tier
      prof.push([45, 38.5, WALLM]); prof.push([46, 38.5, WALLM]);
      const buckets = new Map();
      for (let k = 1; k < prof.length; k++) { const [o1, y1] = prof[k - 1], [o2, y2, m] = prof[k]; if (!m) continue; if (!buckets.has(m)) buckets.set(m, []); const pos = buckets.get(m);
        for (let i = 0; i < N; i++) { const t1 = i / N * Math.PI * 2, t2 = (i + 1) / N * Math.PI * 2, a1 = E(t1, o1), a2 = E(t2, o1), b1 = E(t1, o2), b2 = E(t2, o2);
          pos.push(a1.x, y1, a1.z, a2.x, y1, a2.z, b2.x, y2, b2.z, a1.x, y1, a1.z, b2.x, y2, b2.z, b1.x, y2, b1.z); } }
      // outer wall (facade) down to the ground
      { const pos = []; for (let i = 0; i < N; i++) { const t1 = i / N * Math.PI * 2, t2 = (i + 1) / N * Math.PI * 2, a1 = E(t1, 46), a2 = E(t2, 46);
          pos.push(a1.x, 0, a1.z, a2.x, 0, a2.z, a2.x, 38.5, a2.z, a1.x, 0, a1.z, a2.x, 38.5, a2.z, a1.x, 38.5, a1.z); } buckets.set(two('#e2dccd'), pos); }
      // roof canopy ring over the upper tier
      { const pos = []; for (let i = 0; i < N; i++) { const t1 = i / N * Math.PI * 2, t2 = (i + 1) / N * Math.PI * 2, a1 = E(t1, 26), a2 = E(t2, 26), b1 = E(t1, 47), b2 = E(t2, 47);
          pos.push(a1.x, 46, a1.z, a2.x, 46, a2.z, b2.x, 48, b2.z, a1.x, 46, a1.z, b2.x, 48, b2.z, b1.x, 48, b1.z); } buckets.set(ROOF, pos); }
      buckets.forEach((pos, m) => { const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.computeVertexNormals();
        const me = new THREE.Mesh(ge, m); me.castShadow = m !== ROOF ? false : true; me.receiveShadow = true; g.add(me); });
      // facade fins that hold the roof, and lights along the roof's inner edge
      const FIN = '#f4f2ee', RIM = glowMat('#f4f1e8', '#ffffff');
      for (let i = 0; i < 32; i++) { const t = (i + 0.5) / 32 * Math.PI * 2, p = E(t, 46.6); B(g, 1.4, 48, 2.2, FIN, p.x, 0, p.z, { ry: t, edge: false }); }
      for (let i = 0; i < 24; i++) { const t = (i + 0.5) / 24 * Math.PI * 2, p = E(t, 26.5); B(g, 3, 0.6, 1, RIM, p.x, 45.2, p.z, { ry: t, edge: false, shadow: false }); }
      // 'VINLAND STADIUM' on the outside (both long sides) + 4 entrance gates
      [Math.PI / 2, -Math.PI / 2].forEach(t => { const p = E(t, 47.9), s = grp(g, p.x, 0, p.z, t); P(s, 46, 5.5, textMat('VINLAND STADIUM', '#2f2b28', '#f6d27a'), 0, 28, 0.05); });
      [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(t => { const p = E(t, 47.9), s = grp(g, p.x, 0, p.z, t);
        [-1, 1].forEach(k => P(s, 8, 9, glowMat('#3f5866', '#ffd98a'), k * 9, 0.2, 0.06)); B(s, 30, 1.2, 4, SEAT, 0, 10, 1.6, { edge: false }); });
      // plaza round the outside
      put(g, geo('oval', () => new THREE.CircleGeometry(1, 32)), '#d8d2c6', 0, 0.02, 0, Object.assign({}, FLAT, { rx: -Math.PI / 2, s: [RX + 62, RZ + 62, 1] }));
      // big screens at both ends (on top of the upper tier, facing the field)
      const screenText = { football: 'VINLAND  2 - 1', cricket: 'VINLAND  186 / 4', concert: 'LIVE IN VINLAND' }[mode];
      [0, Math.PI].forEach(t => { const p = E(t, 40), s = grp(g, p.x, 37, p.z, t + Math.PI);
        [-12, 12].forEach(x => B(s, 1, 8, 1, PAL.iron, x, 0, -1, NE)); B(s, 34, 13, 2, PAL.iron, 0, 7, -1);
        P(s, 32, 11, textMat(screenText, '#14233f', '#ffcf6a'), 0, 8, 0.02); });
      // 4 floodlight towers at the corners
      const FL = glowMat('#f4f1e8', '#ffffff');
      [Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4, -3 * Math.PI / 4].forEach(t => { const p = E(t, 52), s = grp(g, p.x, 0, p.z, t + Math.PI);
        TAPER(s, 3.2, 70, 3.2, '#9aa3a8', 0, 0, 0, { tw: 0.45, td: 0.45 }); B(s, 14, 8, 1.2, PAL.iron, 0, 68, 0.6, NE); P(s, 13, 7, FL, 0, 68.5, 1.25, { rx: -0.35 }); });
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
        const zs = RZ - 14, BEAM = (c) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); m.userData.beam = true; return m; };
        B(g, 46, 2.6, 16, '#2f2b28', 0, 0.3, zs);                                                    // stage
        B(g, 12, 1.4, 22, '#2f2b28', 0, 0.3, zs - 18);                                               // catwalk into the crowd
        [-22, 22].forEach(x => { B(g, 1.2, 22, 1.2, '#55504a', x, 2.9, zs + 6, NE); B(g, 5, 9, 4, PAL.iron, x + Math.sign(x) * 5, 0.3, zs - 2); });   // truss legs + speaker stacks
        B(g, 46, 1.4, 1.4, '#55504a', 0, 24.9, zs + 6, NE); B(g, 46, 1.2, 1.2, '#55504a', 0, 22, zs - 4, NE);
        B(g, 30, 14, 1, PAL.iron, 0, 6.5, zs + 7.4); P(g, 28, 12, textMat('VINLAND', '#3a1f5a', '#f6d27a'), 0, 7.5, zs + 6.85, { ry: Math.PI });   // stage screen faces the crowd
        const STG = ['#e8473a', '#3f7fbf', '#a084c8', '#f2c14e', '#5fbf6a', '#d88fb0'];
        for (let i = 0; i < 12; i++) { const x = -19 + i * 3.45, c = STG[i % STG.length];
          B(g, 1.2, 0.8, 1.2, glowMat(c, c), x, 21.2, zs - 4, NE);                                   // stage lights on the front truss
          const beam = put(g, geo('beam', () => { const ge = new THREE.ConeGeometry(1, 1, 8, 1, true); ge.translate(0, -0.5, 0); return ge; }), BEAM(c), x, 21.2, zs - 4, { edge: false, shadow: false, s: [5, 26, 5], rx: -0.5 + (i % 3) * 0.15, rz: (i - 5.5) * 0.06 });
          beam.visible = false; beam.userData.beam = true; }
        // the crowd on the field: one InstancedMesh, 600 people, random shirt colours
        const COLS = ['#c8603f', '#3f7fbf', '#2f7a68', '#f2c14e', '#f6f0e2', '#6a4a8c', '#d88fb0', '#2f2b28'];
        const pg = new THREE.OctahedronGeometry(1, 0); pg.scale(0.35, 0.9, 0.3); pg.translate(0, 0.9 + 0.3, 0);
        const crowd = new THREE.InstancedMesh(pg, toon('#ffffff'), 600), M = new THREE.Matrix4(), cc = new THREE.Color();
        let seed = 11, n = 0; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let tries = 0; n < 600 && tries < 5000; tries++) { const x = (rnd() * 2 - 1) * (RX - 6), z = -RZ + 10 + rnd() * (zs - 8 + RZ - 10);
          if ((x * x) / ((RX - 6) * (RX - 6)) + (z * z) / ((RZ - 6) * (RZ - 6)) > 1 || (Math.abs(x) < 8 && z > zs - 30)) continue;
          M.makeTranslation(x, 0, z); crowd.setMatrixAt(n, M); crowd.setColorAt(n, cc.set(COLS[n % COLS.length])); n++; }
        crowd.count = n; crowd.instanceMatrix.needsUpdate = true; crowd.frustumCulled = false; g.add(crowd);
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
