// VINLAND AIR FORCE BASE (Dev, 28 Nov 2026): built one base at a time. Low-poly style from Dev's reference sheet: arched hangars, glass-cab tower,
// radar domes, dishes, red-white comms mast, wooden watchtowers, chain-link fence, camo trucks, deep forest round it. Navy + Army come later, one by one.
// Scale (map/index.html): citizen 2.2 m, jeep 4 m, storey 3.2 m, doors 1.4 x 2.4 m, fence 2.6 m. Everything is built in WORLD metres.
// Layers (so nothing flickers): ground 0 . farm paint 0.22 . lawn 0.30 . yards 0.38 . roads 0.46 . road marks 0.52 . plinths 0.30..0.70 . quay 1.0
// Returns one THREE.Group (merged meshes: ~30 draw calls) with userData.tris. Phones: fast = true (fewer posts, windows, vehicles, trees).
(function (root) {
  const T = root.THREE; let FASTMODE = false;
  const M = {}, mat = c => M[c] || (M[c] = new T.MeshLambertMaterial({ color: c, flatShading: true }));
  const glass = new T.MeshLambertMaterial({ color: '#a9cdd8', flatShading: true });
  const wire = new T.MeshLambertMaterial({ color: '#8d9690', transparent: true, opacity: 0.45, side: T.DoubleSide, depthWrite: false });
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const V = new T.Vector3(), Q = new T.Quaternion(), E = new T.Euler(), S = new T.Vector3();
  function Batch() { const m = new Map();
    return { add(geo, c, base, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
        const L = new T.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)), g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(base ? base.clone().multiply(L) : L);
        if (!m.has(c)) m.set(c, []); m.get(c).push(g); },
      build(group) { let tris = 0; m.forEach((list, c) => { let n = 0; list.forEach(g => { n += g.attributes.position.count; }); const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
          list.forEach(g => { g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
          const G = new T.BufferGeometry(); G.setAttribute('position', new T.BufferAttribute(pos, 3)); G.setAttribute('normal', new T.BufferAttribute(nor, 3)); G.computeBoundingSphere(); tris += n / 3;
          const me = new T.Mesh(G, c === 'glass' ? glass : c === 'wire' ? wire : mat(c)); me.receiveShadow = false; group.add(me); }); return tris; } }; }
  const atS = (x, y, z, ry, s) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry || 0), new T.Vector3(s, s, s));
  const at = (x, y, z, ry = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry), new T.Vector3(1, 1, 1));
  const BOX = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), PLANE = new T.PlaneGeometry(1, 1);            // unit box, pivot bottom-centre
  const box = (B, c, base, w, h, d, x, y, z, ry = 0, rx = 0) => B.add(BOX, c, base, x, y, z, w, h, d, rx, ry, 0);
  const slab = (B, c, x0, x1, z0, z1, y0, y1) => box(B, c, null, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2);   // axis-aligned block between two corners
  function prismGeo(w, h, d) { const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0); return new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); }
  function archGeo(w, h, len) { const s = new T.Shape(); s.moveTo(w / 2, 0); s.absellipse(0, 0, w / 2, h, 0, Math.PI, false, 0); s.lineTo(w / 2, 0); return new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -len / 2); }
  function wedgeGeo(len, run, rise) { const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(run, 0); s.lineTo(0, rise); s.lineTo(0, 0); return new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2); }   // right-angle ramp: tall face at x 0, slopes down to x = run
  function flatGeo(pts, th) { const s = new T.Shape(); pts.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z)); return new T.ExtrudeGeometry(s, { depth: th, bevelEnabled: false }).rotateX(-Math.PI / 2); }   // polygon in the x-z plane, th thick upwards
  const CYL = new T.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0), CYL8 = new T.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0);
  const cyl = (B, c, base, r, h, x, y, z, rx = 0, rz = 0, sx = 1, sz = 1) => B.add(CYL, c, base, x, y, z, r * sx, h, r * sz, rx, 0, rz);

  // ---------- the land ----------
  const Z = { x0: -3500, x1: -1700, z0: -818, z1: -60 }, GATE = { x: -1700, z: -420 }, SHORE = -820, G = 0.3, FL = 0.7;   // G = lawn, FL = floor of a building on its plinth
  const ROAD = '#5d5f63', DIRT = '#b79b6c', SAND = '#cdb88a', CONC = '#9a9c96', WALL = ['#8f8d5e', '#c4ae84', '#9a9466'], ROOF = '#6c7177', ROOF2 = '#7b7f84', STEEL = '#7c8791', SANDSTEEL = '#a7a194', CAMO = ['#8f7a52', '#cdb98a', '#7d7a4e'], DARK = '#3b3d41';
  const noise = (x, z, s) => { const f = v => v - Math.floor(v), h = (a, b) => f(Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453), xi = Math.floor(x), zi = Math.floor(z), u = f(x), v = f(z), a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1), uu = u * u * (3 - 2 * u), vv = v * v * (3 - 2 * v); return a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv; };
  const sst = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
  // low gentle hills ringing the base (never inside the fence, never on the approach road, never at the shore). Max about 26 m, wide and soft.
  const HILLS = [[-3850, -620, 280, 20], [-3800, -250, 300, 24], [-3650, 120, 280, 18], [-3100, 190, 300, 20], [-2500, 180, 280, 18], [-1950, 160, 240, 16], [-1450, 40, 200, 12], [-1470, -660, 170, 10]];
  const hillMask = (x, z) => { if (z < -770 || x > -1250) return 0; const dx = Math.max(Z.x0 - x, x - Z.x1, 0), dz = Math.max(Z.z0 - z, z - Z.z1, 0); let m = sst((Math.hypot(dx, dz) - 40) / 120);
    m *= sst((z + 770) / 60) * sst((-1250 - x) / 120); if (x > Z.x1) m *= sst((Math.abs(z - GATE.z) - 26) / 60); return m; };   // flat inside the fence, along the approach road and at the shore
  const hillH = (x, z) => { let h = 0; HILLS.forEach(([hx, hz, r, hh]) => { const d = Math.hypot(x - hx, (z - hz) * 1.15) / r; if (d < 1) h += hh * Math.pow(Math.cos(d * Math.PI / 2), 2); }); return h * (0.82 + 0.3 * noise(x / 110, z / 110, 3)) * hillMask(x, z); };

  // ---------- parts ----------
  function building(B, o, fast) {   // o: x, z, w (along local x), d, fl, wall, roof, ry (0 = door faces south, PI = north), doors, y0, flat, win
    const { x, z, w, d } = o, fl = o.fl || 1, FH = 3.2, H = fl * FH, y0 = o.y0 == null ? G : o.y0, base = at(x, y0, z, o.ry || 0), nd = o.doors || 1;
    box(B, '#a8a396', base, w + 0.6, 0.4, d + 0.6, 0, 0, 0);                                            // plinth 0.4
    box(B, o.wall, base, w, H, d, 0, 0.4, 0);                                                          // walls
    if (o.flat) { box(B, o.roof, base, w + 0.5, 0.4, d + 0.5, 0, 0.4 + H, 0); box(B, o.wall, base, w + 0.1, 0.5, d + 0.1, 0, 0.8 + H, 0); box(B, o.roof, base, w - 0.7, 0.55, d - 0.7, 0, 0.82 + H, 0);
      if (!fast) { for (let k = 0; k < Math.min(4, Math.floor(w / 12)); k++) { box(B, '#c9c6bd', base, 2.0, 1.1, 1.6, -w / 2 + 4 + k * 10, 1.27 + H, -d / 4); box(B, '#8c8e8c', base, 1.2, 0.12, 1.2, -w / 2 + 4 + k * 10, 2.37 + H, -d / 4); } box(B, '#5f646b', base, 0.1, 4.5, 0.1, w / 2 - 2, 1.27 + H, -d / 2 + 2); box(B, '#c9c6bd', base, 1.6, 1.8, 1.4, w / 2 - 4, 1.27 + H, d / 4); } }
    else { B.add(prismGeo(d + 1.4, 0.2 * (d + 1.4), w + 1.4), o.roof, base, 0, 0.4 + H, 0, 1, 1, 1, 0, Math.PI / 2, 0);   // gable roof, 20 deg, 0.7 m overhang, ridge along x
      if (false) { let cx = -w / 2 + 2 + ((Math.abs(o.x * 7 + o.z * 3) | 0) % 5); for (let k = 0; cx < w / 2 - 3 && k < 9; k++) { const cw = Math.min(3 + ((k * 7 + Math.abs(o.x | 0)) % 5), w / 2 + 0.7 - cx); B.add(prismGeo(d + 1.5, 0.2 * (d + 1.5), cw), CAMO[(k + Math.abs(o.z | 0)) % 3], base, cx + cw / 2, 0.4 + H - 0.02, 0, 1, 1, 1, 0, Math.PI / 2, 0); cx += cw + 3 + ((k * 5) % 6); } } }
    const dx = k => (k - (nd - 1) / 2) * Math.min(w / nd, 12), dxs = []; for (let k = 0; k < nd; k++) dxs.push(dx(k));
    dxs.forEach(px => { box(B, '#d8d0b8', base, 1.8, 2.7, 0.1, px, 0.4, d / 2 + 0.005); box(B, '#3b2f26', base, 1.4, 2.4, 0.15, px, 0.4, d / 2 + 0.03); box(B, '#a8a396', base, 2.4, 0.2, 1.0, px, 0, d / 2 + 0.5); box(B, '#b9b4a6', base, 2.4, 0.08, o.path || 6, px, 0, d / 2 + 1.0 + (o.path || 6) / 2 - 0.0); });   // door 1.4 x 2.4 + one step + a path from the door
    if (o.win !== false) for (let f = 0; f < fl; f++) for (let wx = -w / 2 + 3; wx <= w / 2 - 2.9; wx += 4) {
      const wy = 0.4 + f * FH + 1.0; [1, -1].forEach(sd => { if (sd < 0 && fast) return; if (sd > 0 && f === 0 && dxs.some(px => Math.abs(px - wx) < 1.8)) return;
        if (!fast) B.add(PLANE, '#d8d0b8', base, wx, wy + 0.65, sd * (d / 2 + 0.02), 1.4, 1.6, 1, 0, sd > 0 ? 0 : Math.PI, 0); B.add(PLANE, 'glass', base, wx, wy + 0.65, sd * (d / 2 + 0.05), 1.1, 1.3, 1, 0, sd > 0 ? 0 : Math.PI, 0); }); }
  }
  function hangar(B, x, z, w, len, ry, col) { const base = at(x, G, z, ry || 0);
    box(B, CONC, base, w + 1, 0.4, len + 1, 0, 0, 0); B.add(archGeo(w, 13, len), col || SANDSTEEL, base, 0, 0.4, 0);
    if (false) for (let k = 0; k < 6; k++) { const L = 4 + (k * 5) % 5, zc = -len / 2 + 5 + k * (len - 10) / 5; B.add(archGeo(w + 0.3, 13.15, L), CAMO[k % 3], base, 0, 0.38, zc); }                       // barrel roof: w wide, 13.4 m high at the crown
    box(B, DARK, base, w * 0.62, 8, 0.3, 0, 0.4, len / 2 + 0.02);                                                           // big door opening (shadowed), inside the arch
    [-1, 1].forEach(s => box(B, '#5f6a73', base, 0.8, 8.2, 0.5, s * w * 0.31, 0.4, len / 2 + 0.05)); box(B, '#5f6a73', base, w * 0.62 + 0.8, 0.8, 0.5, 0, 8.4, len / 2 + 0.05);
    box(B, '#d8d0b8', base, 1.8, 2.7, 0.1, w / 2 - 3, 0.4, len / 2 + 0.005); box(B, '#3b2f26', base, 1.4, 2.4, 0.15, w / 2 - 3, 0.4, len / 2 + 0.03); }   // side door 1.4 x 2.4
  function tower(B, x, z) { const b = at(x, G, z, 0);
    box(B, '#a8a396', b, 13, 0.4, 13, 0, 0, 0); box(B, '#e9e1cc', b, 12, 6.4, 12, 0, 0.4, 0); box(B, '#6b5f4a', b, 12.8, 0.5, 12.8, 0, 6.8, 0);
    box(B, '#d8d0b8', b, 1.8, 2.7, 0.1, 0, 0.4, 6.005); box(B, '#3b2f26', b, 1.4, 2.4, 0.15, 0, 0.4, 6.03);
    [-3.5, 3.5].forEach(wx => box(B, 'glass', b, 1.6, 1.5, 0.14, wx, 1.6, 6.01));
    box(B, '#d9d4c4', b, 4.4, 14, 4.4, 0, 7.3, 0);                                                                           // shaft
    box(B, '#3b3d41', b, 9.6, 0.5, 9.6, 0, 21.3, 0); box(B, 'glass', b, 9, 3.2, 9, 0, 21.8, 0); box(B, '#e9e1cc', b, 10.4, 0.5, 10.4, 0, 25.0, 0);   // glass cab 3.2 m
    box(B, '#d6302a', b, 0.3, 5, 0.3, 0, 25.5, 0); box(B, '#e9e1cc', b, 0.2, 3, 0.2, 2.5, 25.5, 2.5); }
  function watchtower(B, x, z, ry) { const b = at(x, G, z, ry || 0);
    [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].forEach(([a, c]) => box(B, '#6a5a44', b, 0.4, 7.2, 0.4, a, 0, c));
    box(B, '#6a5a44', b, 4.2, 0.3, 4.2, 0, 7.2, 0); box(B, '#7a8a5a', b, 3.8, 2.4, 3.8, 0, 7.5, 0); box(B, 'glass', b, 4.0, 1.0, 4.0, 0, 8.3, 0); box(B, '#4c5a3a', b, 4.9, 0.4, 4.9, 0, 9.9, 0);
    for (let i = 0; i < 6; i++) box(B, '#6a5a44', b, 0.9, 0.12, 0.35, 0, i * 1.2 + 0.4, 2.0); box(B, '#6a5a44', b, 0.1, 7, 0.1, -0.5, 0, 2.2); box(B, '#6a5a44', b, 0.1, 7, 0.1, 0.5, 0, 2.2); }
  function flagpole(B, x, z, h, col, y0) { box(B, '#e9e4d8', null, 0.16, h, 0.16, x, y0 == null ? G : y0, z); box(B, col, null, 0.05, 1.9, 3.0, x, (y0 == null ? G : y0) + h - 2.1, z + 1.6); box(B, '#e2c44a', null, 0.07, 0.35, 3.1, x, (y0 == null ? G : y0) + h - 1.2, z + 1.6); }
  function jeep(B, x, z, ry, col, y) { const b = at(x, y == null ? 0.46 : y, z, ry), c = col || '#b5a574';
    box(B, c, b, 1.9, 0.9, 4.0, 0, 0.5, 0); box(B, c, b, 1.8, 0.8, 1.6, 0, 1.4, -0.5); box(B, 'glass', b, 1.7, 0.5, 1.4, 0, 1.55, -0.5); [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]].forEach(([sx, sz]) => box(B, '#222', b, 0.3, 0.7, 0.7, sx * 0.9, 0, sz)); }
  function truck(B, x, z, ry, col, y) { const b = at(x, y == null ? 0.46 : y, z, ry), c = col || '#b5a574';
    box(B, c, b, 2.4, 1.2, 7.2, 0, 0.7, -0.4); box(B, c, b, 2.4, 1.5, 2.0, 0, 1.9, 2.4); box(B, 'glass', b, 2.2, 0.7, 0.2, 0, 2.3, 3.4); box(B, '#6f7a45', b, 2.5, 2.2, 4.6, 0, 1.9, -1.6);
    [[-1, 2.4], [1, 2.4], [-1, -0.6], [1, -0.6], [-1, -2.6], [1, -2.6]].forEach(([sx, sz]) => box(B, '#222', b, 0.4, 1.0, 1.0, sx * 1.2, 0, sz)); }
  function apc(B, x, z, ry, y) { const b = at(x, y == null ? 0.46 : y, z, ry);
    box(B, '#59623f', b, 2.7, 1.5, 6.2, 0, 0.7, 0); box(B, '#59623f', b, 2.2, 1.0, 3.2, 0, 2.1, -0.6); box(B, '#3b3d41', b, 0.5, 0.35, 3.0, 0, 2.6, 1.6); box(B, '#3b3d41', b, 0.5, 0.3, 6.6, -1.4, 0.2, 0); box(B, '#3b3d41', b, 0.5, 0.3, 6.6, 1.4, 0.2, 0); }
  function jet(B, x, z, ry) { const b = at(x, 0.54, z, ry), c = '#6f7a85';
    box(B, c, b, 1.3, 1.2, 11, 0, 1.3, 0); B.add(new T.ConeGeometry(0.65, 3.4, 6), c, b, 0, 1.9, 7.0, 1, 1, 1, Math.PI / 2, 0, 0); box(B, 'glass', b, 1.0, 0.7, 2.2, 0, 2.2, 3.4);
    [1, -1].forEach(s => { B.add(flatGeo(s > 0 ? [[0.6, 2.5], [5.4, -3.2], [5.4, -4.6], [0.6, -4.6]] : [[-0.6, -4.6], [-5.4, -4.6], [-5.4, -3.2], [-0.6, 2.5]], 0.22), c, b, 0, 1.6, 0);
      B.add(flatGeo(s > 0 ? [[0.6, -4.6], [2.6, -6.6], [2.6, -5.6], [0.6, -3.6]] : [[-0.6, -3.6], [-2.6, -5.6], [-2.6, -6.6], [-0.6, -4.6]], 0.2), c, b, 0, 1.7, 0); });
    box(B, '#59636c', b, 0.18, 2.2, 1.8, 0, 2.3, -4.6); box(B, '#2e353b', b, 0.9, 0.5, 1.6, 0, 1.0, -5.4); }
  function transport(B, x, z, ry, s) { const b = atS(x, 0.54, z, ry, s || 1), c = '#69747d';
    cyl(B, c, b, 1.9, 20, 0, 2.6, -10, Math.PI / 2, 0); B.add(new T.ConeGeometry(1.9, 4, 8), c, b, 0, 2.6, 12, 1, 1, 1, Math.PI / 2, 0, 0); B.add(new T.ConeGeometry(1.8, 6, 8), c, b, 0, 2.6, -13.5, 1, 1, 1, -Math.PI / 2, 0, 0);
    box(B, c, b, 26, 0.5, 4.6, 0, 4.7, 1.5); box(B, 'glass', b, 2.2, 0.9, 1.4, 0, 3.7, 9.6); box(B, c, b, 9, 0.35, 2.6, 0, 3.3, -12.4); box(B, '#59636c', b, 0.3, 5.0, 3.0, 0, 3.5, -12.2);
    [-7.5, -3.8, 3.8, 7.5].forEach(px => { cyl(B, '#3b3d41', b, 0.7, 2.4, px, 3.9, 2.4, Math.PI / 2, 0); box(B, '#3b3d41', b, 0.3, 1.5, 0.3, px, 1.0, 1.8); }); [-1, 1].forEach(sd => box(B, '#3b3d41', b, 0.6, 0.8, 1.8, sd * 2.0, -0.1, 0.8)); box(B, '#3b3d41', b, 0.4, 0.8, 0.4, 0, -0.1, 7.5); }
  function heli(B, x, z, ry) { const b = at(x, 0.54, z, ry), c = '#59636c';
    B.add(new T.IcosahedronGeometry(1.6, 0), c, b, 0, 2.2, 0.6, 1, 0.95, 1.5); box(B, 'glass', b, 2.2, 1.1, 1.6, 0, 2.2, 2.0); box(B, c, b, 0.6, 0.7, 6.8, 0, 2.4, -3.6); box(B, c, b, 0.15, 2.0, 1.0, 0, 2.5, -7.0);
    box(B, '#222', b, 0.3, 0.7, 0.3, 0, 3.6, 0.3); box(B, '#33383d', b, 11, 0.08, 0.5, 0, 4.25, 0.3); box(B, '#33383d', b, 0.5, 0.08, 11, 0, 4.2, 0.3);
    [-1, 1].forEach(s => { box(B, '#222', b, 0.14, 0.14, 4.2, s * 1.5, 0.15, 0.4); box(B, '#222', b, 0.1, 1.1, 0.1, s * 1.5, 0.2, 1.4); box(B, '#222', b, 0.1, 1.1, 0.1, s * 1.5, 0.2, -0.6); }); }
  function tank(B, x, z, ry, y) { const b = at(x, y == null ? 0.46 : y, z, ry), c = '#bda978';
    box(B, '#3b3d41', b, 1.0, 1.2, 8.2, -1.55, 0.0, 0); box(B, '#3b3d41', b, 1.0, 1.2, 8.2, 1.55, 0.0, 0); box(B, c, b, 3.2, 1.0, 7.6, 0, 0.5, 0.2); box(B, c, b, 2.7, 0.9, 3.6, 0, 1.5, -0.4); box(B, '#a8966a', b, 0.8, 0.5, 0.8, 0.7, 2.4, -0.9); box(B, '#3b3d41', b, 0.3, 0.3, 5.2, 0, 1.9, 4.2); box(B, c, b, 0.6, 0.6, 1.0, 0, 1.8, 1.4); }
  function radar(B, x, z) { [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]].forEach(([a, c]) => box(B, '#6f6a60', null, 0.35, 9.4, 0.35, x + a * 1.2, G, z + c * 1.2)); box(B, '#6f6a60', null, 6.2, 0.4, 6.2, x, G + 9, z); for (let k = 0; k < 3; k++) box(B, '#6f6a60', null, 4.4 - k * 0.2, 0.2, 0.2, x, G + 2.5 + k * 2.4, z + 2.3); B.add(new T.IcosahedronGeometry(4.6, 1), '#e6e1d3', null, x, G + 13.2, z); }
  function sandbags(B, x, z, len, ry) { const b = at(x, G, z, ry || 0), n = Math.max(2, Math.round(len / 1.2)); for (let r = 0; r < 3; r++) for (let i = 0; i < n - (r % 2); i++) box(B, r % 2 ? '#b99d6a' : '#c8ad7a', b, 1.1, 0.42, 0.7, -len / 2 + 0.6 + i * 1.2 + (r % 2) * 0.6, r * 0.4, 0); }
  function pole(B, x, z, ry) { const b = at(x, 0.3, z, ry || 0); box(B, '#6f5a42', b, 0.28, 9.2, 0.28, 0, 0, 0); box(B, '#6f5a42', b, 3.2, 0.18, 0.18, 0, 8.4, 0); box(B, '#6f5a42', b, 2.0, 0.14, 0.14, 0, 7.4, 0); box(B, '#4a4d52', b, 0.5, 0.9, 0.4, 0.3, 6.2, 0.3); }
  function crates(B, x, z, ry) { const b = at(x, G, z, ry || 0), c = ['#a07e4c', '#8f703f', '#b08c58']; [[0, 0, 0], [1.4, 0, 0.2], [0.7, 0, 1.4], [0.6, 1.2, 0.5], [-1.3, 0, 0.9]].forEach(([a, h, d], i) => box(B, c[i % 3], b, 1.3, 1.2, 1.3, a, h, d)); }
  function drums(B, x, z) { [[0, 0], [1, 0.1], [0.5, 0.9], [-0.5, 0.9], [1.5, 0.9], [2.1, 0.1]].forEach(([a, d], i) => cyl(B, i % 3 ? '#6b7040' : '#8a7a3a', null, 0.38, 0.95, x + a, G, z + d)); }
  function rock(B, x, y, z, s, col) { B.add(new T.IcosahedronGeometry(1, 0), col, null, x, y + s * 0.3, z, s * 1.2, s * 0.8, s, 0.3, x, 0.2); }
  function agave(B, x, y, z, s) { for (let k = 0; k < 6; k++) B.add(new T.ConeGeometry(0.22 * s, 1.5 * s, 4), '#7c8f4a', null, x + Math.cos(k) * 0.3 * s, y + 0.6 * s, z + Math.sin(k) * 0.3 * s, 1, 1, 1, Math.sin(k) * 0.5, 0, Math.cos(k) * 0.5); }
  function climbers(B, x, z, ry) { const b = at(x, 0.38, z, ry || 0), P = '#6a5a44'; [[-4, -1.5], [-4, 1.5], [4, -1.5], [4, 1.5]].forEach(([a, c]) => box(B, P, b, 0.25, 3.4, 0.25, a, 0, c)); [0, 1, 2].forEach(k => { box(B, P, b, 8.2, 0.14, 0.14, 0, 2.2 + k * 0.4, -1.5); box(B, P, b, 8.2, 0.14, 0.14, 0, 2.2 + k * 0.4, 1.5); }); for (let i = 0; i < 6; i++) box(B, P, b, 0.12, 0.12, 3.0, -3.5 + i * 1.4, 3.3, 0); }
  function hullGeo(L, Bm, depth, up) { const s = new T.Shape(), h = L / 2, w = Bm / 2; s.moveTo(-w, -h); s.lineTo(w, -h); s.lineTo(w, h * 0.45); s.lineTo(w * 0.55, h * 0.86); s.lineTo(0, h); s.lineTo(-w * 0.55, h * 0.86); s.lineTo(-w, h * 0.45); s.lineTo(-w, -h);
    return new T.ExtrudeGeometry(s, { depth: depth + up, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -depth, 0); }   // keel at -depth, deck at +up; bow toward -z (north)
  function frigate(B, x, z, s, ry) { const b = atS(x, 0.3, z, ry || 0, s || 1);
    B.add(hullGeo(62, 10, 1.8, 2.6), '#8d98a3', b, 0, 0, 0); box(B, '#59636c', b, 9.4, 0.15, 56, 0, 2.6, 2); box(B, '#c8ced3', b, 8, 4.6, 14, 0, 2.7, -4); box(B, 'glass', b, 7.4, 0.9, 0.2, 0, 5.2, -11.1); box(B, '#c8ced3', b, 5, 3, 8, 0, 7.3, -3);
    box(B, '#8d98a3', b, 3.0, 4.4, 3.0, 0, 2.7, 8); box(B, '#3b3d41', b, 3.4, 0.5, 3.4, 0, 7.1, 8); box(B, '#3b3d41', b, 0.2, 12, 0.2, 0, 10.3, -3); box(B, '#59636c', b, 0.1, 0.1, 4.0, 0, 20.5, -3); B.add(new T.IcosahedronGeometry(1.5, 1), '#e9ecef', b, 0, 15.6, -3); box(B, '#3b3d41', b, 3.2, 0.5, 0.6, 0, 18.5, -3);
    cyl(B, '#59636c', b, 1.8, 1.0, 0, 2.6, -21, 0, 0); box(B, '#3b3d41', b, 0.4, 0.4, 4.0, 0, 3.4, -24); box(B, '#d8d4c4', b, 6, 0.2, 6, 0, 2.7, 22);
    box(B, '#e9e1cc', b, 0.2, 0.9, 5, -5.01, 1.4, -2); box(B, '#e9e1cc', b, 0.2, 0.9, 5, 5.01, 1.4, -2); }
  function patrol(B, x, z, ry, s) { const b = atS(x, 0.3, z, ry || 0, s || 1);
    B.add(hullGeo(14, 4, 0.7, 1.1), '#a3adb6', b, 0, 0, 0); box(B, '#d6d9dc', b, 3, 1.8, 4.4, 0, 1.1, 0.8); box(B, 'glass', b, 3.1, 0.7, 2.6, 0, 1.6, 1.5); box(B, '#3b3d41', b, 0.1, 4, 0.1, 0, 2.9, 0.5); box(B, '#3b3d41', b, 0.25, 0.25, 1.6, 0, 1.4, -3.4); }
  function sub(B, x, z, s) { const b = atS(x, 0.3, z, 0, s || 1);
    B.add(new T.SphereGeometry(1, 12, 8), '#2e3842', b, 0, 0.2, 0, 3.0, 2.7, 27); box(B, '#2e3842', b, 2.2, 3.6, 7, 0, 0.5, 5); box(B, '#2e3842', b, 0.2, 2.2, 3, 0, 1.2, -25); box(B, '#2e3842', b, 7, 0.2, 2, 0, 0.5, -24.5); }
  const BOXC = new T.BoxGeometry(1, 1, 1);
  function crane(B, x, z, ry) { const b = at(x, 1.0, z, ry || 0), c = '#c9a24a', st = '#5f646b';
    [-5, 5].forEach(a => box(B, st, b, 0.5, 0.25, 30, a, 0, 0));                                                        // rails
    [[-5, -4], [5, -4], [-5, 4], [5, 4]].forEach(([a, d]) => { box(B, st, b, 1.2, 0.8, 2.2, a, 0, d); box(B, c, b, 0.9, 10, 0.9, a * 0.8, 0.8, d * 0.8); });
    [-1, 1].forEach(sd => { B.add(BOXC, c, b, sd * 4, 5.5, 0, 0.4, 0.4, 9.6, Math.atan2(8, 7), 0, 0); B.add(BOXC, c, b, 0, 5.5, sd * 3.2, 9.6, 0.4, 0.4, 0, 0, Math.atan2(7, 8)); });
    box(B, c, b, 10, 1.0, 9, 0, 10.8, 0); box(B, c, b, 4.4, 3.6, 5.6, 0, 11.8, 1.2); box(B, 'glass', b, 4.5, 1.2, 1.0, 0, 13.4, -1.4); box(B, st, b, 0.6, 3, 0.6, 0, 15.4, 2.6);
    const a = 0.55, L = 30, sy = 13, sz = -1.6, my = sy + Math.sin(a) * L / 2, mz = sz - Math.cos(a) * L / 2; B.add(BOXC, c, b, 0, my, mz, 1.1, 1.1, L, a, 0, 0);   // angled jib
    const ty = sy + Math.sin(a) * L, tz = sz - Math.cos(a) * L; box(B, '#3b3d41', b, 0.12, ty - 6, 0.12, 0, 6, tz); box(B, '#3b3d41', b, 1.6, 1.2, 1.6, 0, 4.8, tz); }
  function tug(B, x, z, ry, s) { const b = atS(x, 0.3, z, ry || 0, s || 1); B.add(hullGeo(18, 6.4, 1.0, 1.6), '#8a8658', b, 0, 0, 0); box(B, '#2a2c2e', b, 6.8, 0.6, 17, 0, 0.9, 0.4); box(B, '#e9e1cc', b, 4.2, 2.4, 5, 0, 1.6, 1.0); box(B, 'glass', b, 4.3, 0.8, 5.1, 0, 3.2, 1.0); box(B, '#e9e1cc', b, 3, 1.6, 2.6, 0, 4.0, 0.4); box(B, '#3b3d41', b, 1.2, 3, 1.2, 0, 3.2, 4.4); box(B, '#5f646b', b, 0.12, 5, 0.12, 0, 5.6, 0.4); }
  function fender(B, x, z, ry) { box(B, '#2a2c2e', at(x, 0.1, z, ry || 0), 1.8, 1.1, 0.5, 0, 0, 0); }
  function bollard(B, x, z, y) { box(B, '#3b3d41', null, 0.55, 0.6, 0.55, x, y == null ? 1.0 : y, z); box(B, '#3b3d41', null, 0.8, 0.14, 0.8, x, (y == null ? 1.0 : y) + 0.6, z); }
  function firestation(B, x, z, ry) { const b = at(x, G, z, ry || 0), RED = '#b8382e';
    box(B, '#a8a396', b, 25, 0.4, 17, 0, 0, 0); box(B, '#ddd5c4', b, 24, 7, 16, 0, 0.4, 0); box(B, RED, b, 24.4, 0.8, 16.4, 0, 7.4, 0); box(B, '#8c8e8c', b, 23.4, 0.3, 15.4, 0, 8.0, 0);
    [-6, 0].forEach(px => { box(B, RED, b, 5.2, 5.4, 0.2, px, 0.4, 8.0); box(B, '#c9c6bd', b, 4.4, 4.8, 0.3, px, 0.4, 8.05); for (let k = 0; k < 4; k++) box(B, '#a8a59c', b, 4.4, 0.08, 0.34, px, 1.4 + k * 1.1, 8.06); });
    box(B, '#3b2f26', b, 1.4, 2.4, 0.3, 7.5, 0.4, 8.05); box(B, 'glass', b, 3.0, 1.4, 0.2, 7.5, 3.6, 8.05); box(B, '#ddd5c4', b, 5, 4, 5, 6, 8.2, -2); box(B, RED, b, 5.4, 0.6, 5.4, 6, 12.2, -2); box(B, 'glass', b, 5.1, 1.2, 5.1, 6, 10.4, -2); box(B, '#8c8e8c', b, 24, 0.5, 6, 0, 0, 13.5); }
  function firetruck(B, x, z, ry) { const b = at(x, 0.54, z, ry || 0), RED = '#c23a2e'; box(B, RED, b, 2.6, 2.4, 9, 0, 0.6, 0); box(B, 'glass', b, 2.65, 0.9, 1.2, 0, 2.0, 3.6); box(B, '#e9e4d8', b, 2.7, 0.3, 9.1, 0, 1.5, 0); box(B, '#c9c6bd', b, 1.2, 0.5, 5, 0, 3.0, -1.2); box(B, '#3b6fd0', b, 1.6, 0.25, 0.4, 0, 3.0, 3.8); [-3, -1, 3].forEach(sz => [-1.2, 1.2].forEach(sx => box(B, '#222', b, 0.4, 1.0, 1.0, sx, 0, sz))); }
  function tanker(B, x, z, ry) { const b = at(x, 0.54, z, ry || 0); box(B, '#6f7a45', b, 2.4, 2.4, 2.4, 0, 0.7, 3.4); box(B, 'glass', b, 2.3, 0.8, 0.2, 0, 2.2, 4.6); box(B, '#3b3d41', b, 1.4, 0.4, 9, 0, 0.6, -1); cyl(B, '#b9bcbc', b, 1.25, 7, 0, 2.2, -4.6, Math.PI / 2, 0); [-4, -2.5, 3].forEach(sz => [-1.1, 1.1].forEach(sx => box(B, '#222', b, 0.4, 1.0, 1.0, sx, 0, sz))); }
  function forklift(B, x, z, ry, y) { const b = at(x, y == null ? 1.0 : y, z, ry || 0), c = '#d1a63a'; box(B, c, b, 1.3, 1.1, 2.2, 0, 0.3, 0); box(B, '#3b3d41', b, 1.2, 0.1, 1.3, 0, 2.3, -0.1); [[-0.55, -0.6], [0.55, -0.6], [-0.55, 0.5], [0.55, 0.5]].forEach(([a, d]) => box(B, '#3b3d41', b, 0.08, 2.0, 0.08, a, 1.3, d)); box(B, '#5f646b', b, 1.0, 2.6, 0.15, 0, 0.1, 1.2); box(B, '#5f646b', b, 0.2, 0.1, 1.1, -0.3, 0.15, 1.8); box(B, '#5f646b', b, 0.2, 0.1, 1.1, 0.3, 0.15, 1.8); [[-0.65, -0.6], [0.65, -0.6], [-0.65, 0.6], [0.65, 0.6]].forEach(([a, d]) => box(B, '#222', b, 0.25, 0.6, 0.6, a, 0, d)); }
  function radarTrailer(B, x, z, ry) { const b = at(x, G, z, ry || 0), c = '#6f7a45'; box(B, '#3b3d41', b, 2.2, 0.3, 4, 0, 0.6, 0); box(B, c, b, 2, 1.2, 2.4, 0, 0.9, 0.4); box(B, '#3b3d41', b, 0.15, 0.15, 2, 0, 0.6, 3); [-1, 1].forEach(sd => box(B, '#222', b, 0.3, 0.8, 0.8, sd * 1.15, 0, -0.6)); box(B, c, b, 0.3, 1.6, 0.3, 0, 2.1, 0.4); B.add(new T.CylinderGeometry(1.6, 1.0, 0.4, 10), c, b, 0, 4.0, 0.4, 1, 1, 1, -0.9, 0, 0); }
  function floodlight(B, x, z) { const b = at(x, G, z, 0), st = '#6f6a60'; [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(([a, d]) => box(B, st, b, 0.2, 18, 0.2, a * (1 - 0) , 0, d)); for (let k = 1; k < 6; k++) box(B, st, b, 1.9, 0.12, 0.12, 0, k * 3, 0.9); box(B, st, b, 3.6, 0.3, 1.2, 0, 18, 0); for (let i = 0; i < 4; i++) box(B, '#fff2c4', b, 0.7, 0.7, 0.3, -1.2 + i * 0.8, 18.5, 0.5); }
  function jersey(B, x, z, ry, n) { const b = at(x, G, z, ry || 0); for (let i = 0; i < (n || 4); i++) { box(B, '#bdb9ae', b, 0.7, 0.35, 2.9, 0, 0, i * 3.05); box(B, '#bdb9ae', b, 0.36, 0.5, 2.9, 0, 0.35, i * 3.05); } }
  function lighthouse(B, x, z) { const b = at(x, 1.0, z, 0);
    for (let i = 0; i < 4; i++) cyl(B, i % 2 ? '#d6302a' : '#f4efe2', b, 3.2 - i * 0.28, 5.4, 0, i * 5.4, 0);
    box(B, '#3b3d41', b, 7.4, 0.5, 7.4, 0, 21.6, 0); box(B, 'glass', b, 4, 2.4, 4, 0, 22.1, 0); B.add(new T.ConeGeometry(3.0, 2.6, 8), '#d6302a', b, 0, 25.9, 0); box(B, '#ffd27a', b, 1.4, 1.4, 1.4, 0, 22.7, 0); }
  function fuelTank(B, x, z, r) { cyl(B, '#d9dcd8', null, r, 6.5, x, G, z); cyl(B, '#9aa0a0', null, r * 1.02, 0.5, x, G + 6.5, z); box(B, '#9aa0a0', null, 0.6, 7, 0.4, x + r, G, z); }
  function dome(B, x, z) { box(B, '#d9dcd8', null, 6, 5, 6, x, G, z); B.add(new T.SphereGeometry(5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#f2f4f4', null, x, G + 5, z); }
  function lamp(B, x, z, ry, y0) { const b = at(x, y0 == null ? 0.46 : y0, z, ry || 0); box(B, '#4a4d52', b, 0.16, 5.4, 0.16, 0, 0, 0); box(B, '#4a4d52', b, 0.12, 0.12, 1.6, 0, 5.3, 0.7); box(B, '#ffe9a8', b, 0.5, 0.18, 0.9, 0, 5.15, 1.4); }
  function booth(B, x, z, ry) { const b = at(x, G, z, ry || 0); box(B, '#a8a396', b, 3.6, 0.3, 3.6, 0, 0, 0); box(B, '#e9e1cc', b, 3.0, 2.8, 3.0, 0, 0.3, 0); box(B, 'glass', b, 3.1, 1.0, 3.1, 0, 1.4, 0); box(B, '#4c5a3a', b, 4.0, 0.35, 4.0, 0, 3.1, 0); box(B, '#3b2f26', b, 1.0, 2.0, 0.12, 0, 0.3, 1.52); }
  function barrier(B, x, z, len, rot) { const b = at(x, G, z, rot || 0); box(B, '#3b3d41', b, 0.5, 1.3, 0.5, 0, 0, 0); for (let i = 0; i < 6; i++) box(B, i % 2 ? '#ffffff' : '#d6302a', b, 0.18, 0.2, len / 6, 0, 1.0, len / 12 + i * len / 6 + 0.25); }

  // fence: 2.6 m posts every 'step' m, two rails, a translucent mesh panel (so the line reads from the air without blocking the view)
  function fence(B, pts, step, skip) { for (let k = 0; k < pts.length - 1; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[k + 1], L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step));
      for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (skip && skip(x, z)) continue; box(B, '#59623f', null, 0.14, 2.7, 0.14, x, G, z); }
      const run = (a0, b0) => { const x = x0 + (x1 - x0) * (a0 + b0) / 2, z = z0 + (z1 - z0) * (a0 + b0) / 2, l = L * (b0 - a0); box(B, '#6b6f6a', null, 0.08, 0.08, l, x, G + 2.6, z, a); box(B, '#6b6f6a', null, 0.08, 0.08, l, x, G + 1.3, z, a); B.add(BOX, 'wire', null, x, G + 0.1, z, 0.03, 2.4, l, 0, a, 0); box(B, '#59606a', null, 0.28, 0.28, l, x, G + 2.7, z, a); };
      if (!skip) run(0, 1); else { let s0 = 0; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (skip(x, z)) { if (i > s0) run(s0 / n, (i - 1) / n); s0 = i + 1; } } if (s0 < n) run(s0 / n, 1); } } }

  function signTex(lines, w, h, bg, fg) { if (typeof document === 'undefined') return null; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
    c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = '#e2c44a'; c.lineWidth = h * 0.06; c.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach(([t, fs, y]) => { let f = fs * h; do { c.font = '800 ' + f + 'px Poppins, "Arial Black", Arial, sans-serif'; f -= 2; } while (c.measureText(t).width > w * 0.9 && f > 8); c.fillText(t, w / 2, y * h); });
    const tex = new T.CanvasTexture(cv); tex.anisotropy = 4; return tex; }
  function trees(g, list, fast) { if (!list.length) return; const O = new T.Object3D(), col = new T.Color();
    const make = (geo, L, f) => { if (!L.length) return; const im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), L.length); im.castShadow = false; im.receiveShadow = false;
      L.forEach((t, i) => { O.position.set(t.x, t.y, t.z); O.rotation.set(0, t.r, 0); O.scale.setScalar(t.s); O.updateMatrix(); im.setMatrixAt(i, O.matrix); im.setColorAt(i, col.set(f(t))); }); g.add(im); };
    const pine = list.filter(t => t.k === 'p'), round = list.filter(t => t.k === 'r'), PC = ['#3f7a3a', '#4a8a40', '#356b33'], RC = ['#6aa84f', '#7cb85a', '#5e9a45', '#8cc063'];
    make(new T.CylinderGeometry(0.25, 0.35, 1.8, 5, 1, true).translate(0, 0.6, 0), list, () => '#7a5236');
    make(new T.ConeGeometry(2.2, 3.6, 6, 1, true).translate(0, 2.9, 0), pine, t => PC[t.c % 3]); make(new T.ConeGeometry(1.6, 3.0, 6, 1, true).translate(0, 5.0, 0), pine, t => PC[(t.c + 1) % 3]);
    make(new T.IcosahedronGeometry(2.3, 0).translate(0, 3.5, 0), round, t => RC[t.c % 4]); }


  // ================= AIR FORCE BASE: low-poly kit (matches Dev's reference sheet, 28 Nov) =================
  const AB = { x0: -3470, x1: -2390, z0: -402, z1: -84 };                 // base fence
  const RW = { x0: -3360, x1: -2480, z0: -205, z1: -160 };                 // runway 880 x 45 m
  const TW = { x0: -3360, x1: -2480, z0: -262, z1: -239 };                 // parallel taxiway 23 m
  const NAP = { x0: -3315, x1: -2845, z0: -330, z1: -282 };                // north apron in front of the hangars
  const SAP = { x0: -3440, x1: -2440, z0: -146, z1: -94 };                 // south apron: helipads, fighter line, cargo
  const GATEX = -2440;                                                     // gate on the north fence
  const AS = '#56595d', CON = '#bcc3cb', CON2 = '#aeb5bd', WHITE = '#f2f1ea', YEL = '#e3b93a', BEIGE = '#cdbf9f', BEIGE2 = '#b9ab8a', DROOF = '#6d6a64', WOOD = '#7a5a3c', WOOD2 = '#5f4630';
  const finGeo = (pts, th) => { const s = new T.Shape(); pts.forEach(([z, y], i) => i ? s.lineTo(z, y) : s.moveTo(z, y)); return new T.ExtrudeGeometry(s, { depth: th, bevelEnabled: false }).translate(0, 0, -th / 2).rotateY(-Math.PI / 2); };   // profile in (z, y), th thick across x
  const ring = (B, c, x, y, z, r, w, n) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, L = 2 * Math.PI * r / n + 0.05; B.add(BOX, c, null, x + Math.sin(a) * r, y, z + Math.cos(a) * r, w, 0.06, L, 0, a + Math.PI / 2, 0); } };

  // --- aircraft (nose faces local +z) ---
  function fighter(B, x, z, ry, fast) { const b = at(x, 0.54, z, ry), C = '#b6bbc1', D = '#959ba2', K = '#2e3338';
    box(B, C, b, 1.8, 1.3, 11.5, 0, 1.1, -0.6); B.add(new T.ConeGeometry(0.9, 4.2, 4), C, b, 0, 1.75, 7.2, 1, 0.8, 1, Math.PI / 2, Math.PI / 4, 0);
    [-1, 1].forEach(s => { box(B, D, b, 1.0, 1.1, 4.6, s * 1.25, 0.95, 1.6); box(B, K, b, 0.8, 0.8, 0.2, s * 1.25, 1.1, 3.95); });
    B.add(flatGeo([[0, 4.6], [6.8, -3.0], [6.8, -4.4], [0, -3.6], [-6.8, -4.4], [-6.8, -3.0]], 0.26), C, b, 0, 1.45, 0);
    B.add(flatGeo([[0.9, -4.6], [3.6, -6.6], [3.6, -7.4], [0.9, -7.0]], 0.2), C, b, 0, 1.55, 0); B.add(flatGeo([[-0.9, -7.0], [-3.6, -7.4], [-3.6, -6.6], [-0.9, -4.6]], 0.2), C, b, 0, 1.55, 0);
    [-1, 1].forEach(s => B.add(finGeo([[-3.6, 0], [-6.6, 0], [-7.4, 2.9], [-5.6, 2.9]], 0.18), D, b, s * 1.25, 2.3, 0, 1, 1, 1, 0, 0, -s * 0.42));
    box(B, '#3e4f60', b, 0.95, 0.7, 2.8, 0, 2.35, 3.4); [-0.5, 0.5].forEach(px => box(B, K, b, 0.8, 0.8, 0.7, px, 1.2, -6.7));
    if (!fast) [[0, 5.5], [-1.4, -1.2], [1.4, -1.2]].forEach(([px, pz]) => box(B, K, b, 0.2, 1.1, 0.2, px, 0, pz)); }
  function cargoPlane(B, x, z, ry, fast) { const b = at(x, 0.54, z, ry), C = '#dcdedf', D = '#c4c7c9', K = '#33373b';
    box(B, C, b, 4.2, 4.2, 22, 0, 1.0, 0); B.add(new T.ConeGeometry(2.97, 5, 4), C, b, 0, 3.1, 13.5, 1.0, 1, 0.8, Math.PI / 2, Math.PI / 4, 0);
    B.add(wedgeGeo(4.2, 8, 3.2), C, b, 0, 2.0, -11, 1, 1, 1, 0, Math.PI / 2, 0); box(B, C, b, 4.2, 2.2, 8, 0, 3.0, -15);   // upswept tail
    box(B, '#3e4f60', b, 3.0, 0.9, 1.6, 0, 4.4, 11.6);
    B.add(flatGeo([[-20, 3.2], [20, 3.2], [20, 0.6], [-20, 0.6]], 0.6), C, b, 0, 5.2, 0);
    B.add(flatGeo([[-8, -14.5], [8, -14.5], [8, -17.5], [-8, -17.5]], 0.35), C, b, 0, 5.0, 0);
    B.add(finGeo([[-13, 0], [-18.6, 0], [-19.2, 7.4], [-16.4, 7.4]], 0.45), D, b, 0, 5.1, 0);
    [-11.5, -6, 6, 11.5].forEach(px => { box(B, D, b, 1.3, 1.4, 5.2, px, 4.2, 2.6); box(B, K, b, 0.25, 4.4, 0.12, px, 2.7, 5.3); box(B, K, b, 4.4, 0.25, 0.12, px, 4.8, 5.3); });
    [-1, 1].forEach(s => box(B, D, b, 1.0, 1.6, 7, s * 2.4, 0.6, 0)); if (!fast) [[-2.2, -1.5], [2.2, -1.5], [-2.2, 2], [2.2, 2], [0, 10]].forEach(([px, pz]) => box(B, K, b, 0.5, 0.9, 0.9, px, -0.0, pz)); }
  function helicopter(B, x, z, ry, fast) { const b = at(x, 0.54, z, ry), C = '#4d5440', D = '#3f4535', K = '#25282b';
    box(B, C, b, 2.4, 2.1, 6.4, 0, 0.7, 0); box(B, C, b, 2.0, 1.5, 2.0, 0, 0.9, 4.0); box(B, '#2f3a42', b, 2.05, 0.9, 1.8, 0, 1.75, 4.0); B.add(new T.ConeGeometry(1.0, 1.4, 4), C, b, 0, 1.35, 5.6, 1.4, 1, 1, Math.PI / 2, Math.PI / 4, 0);
    box(B, D, b, 1.6, 0.9, 3.4, 0, 2.8, -0.4); box(B, C, b, 0.75, 0.8, 7.5, 0, 2.0, -6.6); B.add(finGeo([[-9.6, 0], [-11, 0], [-11.6, 2.8], [-10.6, 2.8]], 0.2), D, b, 0, 2.2, 0);
    box(B, D, b, 3.2, 0.12, 0.9, 0, 2.2, -9.6); box(B, K, b, 0.08, 2.8, 0.3, 0.2, 2.6, -10.8);
    box(B, K, b, 0.35, 0.6, 0.35, 0, 3.7, 0); [0.25, 1.82, 3.4, 4.97].forEach(a => box(B, K, b, 0.55, 0.08, 16, 0, 4.25, 0, a));
    if (!fast) [[-1.3, 2.6], [1.3, 2.6], [0, -7.8]].forEach(([px, pz]) => box(B, K, b, 0.3, 0.7, 0.7, px, 0, pz)); }

  // --- buildings ---
  function archHangar(B, x, z, w, len, h, col, rib, fast) { const b = at(x, G, z, 0);     // door faces +z (south)
    box(B, '#b4b3ab', b, w + 6, 0.3, len + 4, 0, 0, 1); B.add(archGeo(w, h, len), col, b, 0, 0.3, 0);
    const nr = fast ? 3 : 5; for (let i = 0; i <= nr; i++) B.add(archGeo(w + 0.8, h + 0.4, 1.0), rib, b, 0, 0.3, -len / 2 + 0.5 + i * (len - 1) / nr);
    B.add(archGeo(w * 0.84, h * 0.84, 0.3), rib, b, 0, 0.3, len / 2 + 0.6); B.add(archGeo(w * 0.76, h * 0.77, 0.3), '#2a2d31', b, 0, 0.3, len / 2 + 0.75);
    box(B, '#9c9b95', b, w * 0.76, 0.2, 3, 0, 0.3, len / 2 + 2.4);
    if (!fast) { box(B, rib, b, 3.2, 3.2, 1.2, w / 2 - 2.6, 0.3, -len / 2 - 0.2); box(B, '#2a2d31', b, 1.2, 2.3, 0.2, w / 2 - 2.6, 0.3, -len / 2 - 0.85); } }
  function ctrlTower(B, x, z, fast) { const b = at(x, G, z, 0), GL = '#79aac4', K = '#3f4348';
    box(B, BEIGE2, b, 26, 7, 14, 4, 0, -12); box(B, DROOF, b, 26.6, 0.6, 14.6, 4, 7, -12);                 // ops block behind
    for (let i = 0; i < 6; i++) box(B, '#4f6576', b, 2.4, 1.6, 0.1, -6 + i * 4.2, 3.6, -4.95);
    box(B, '#b8aa8a', b, 10, 1.2, 10, 0, 0, 0); box(B, BEIGE, b, 7.5, 30, 7.5, 0, 1.2, 0);                 // shaft
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(a => box(B, '#4f6576', b, 1.2, 24, 0.12, Math.sin(a) * 3.8, 4, Math.cos(a) * 3.8, a));
    box(B, '#3b2f26', b, 1.6, 2.6, 0.12, 0, 1.2, 3.82);
    B.add(new T.CylinderGeometry(5.4, 4.2, 2.2, 8), BEIGE, b, 0, 32.3, 0); B.add(new T.CylinderGeometry(6.0, 5.4, 0.6, 8), K, b, 0, 33.7, 0);
    B.add(new T.CylinderGeometry(6.2, 5.6, 4.2, 8), GL, b, 0, 36.1, 0); B.add(new T.CylinderGeometry(6.9, 6.9, 0.9, 8), K, b, 0, 38.6, 0); B.add(new T.CylinderGeometry(4.0, 5.2, 0.9, 8), BEIGE, b, 0, 39.4, 0);
    if (!fast) for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; box(B, K, b, 0.25, 4.2, 0.25, Math.sin(a) * 5.9, 34.0, Math.cos(a) * 5.9); }
    box(B, '#5a5d61', b, 0.15, 5, 0.15, 2, 39.8, 1); box(B, '#5a5d61', b, 0.15, 3.5, 0.15, -1.6, 39.8, -1.4); box(B, '#d6302a', b, 0.4, 0.4, 0.4, 2, 44.8, 1); }
  function radome(B, x, z) { B.add(new T.CylinderGeometry(7.0, 7.6, 5, 8), BEIGE, null, x, G + 2.5, z); box(B, '#3b2f26', null, 1.3, 2.3, 0.2, x, G, z + 7.3);
    B.add(new T.IcosahedronGeometry(9.0, 1), '#eeefec', null, x, G + 11.0, z); }
  function satDish(B, x, z, ry) { const b = at(x, G, z, ry || 0);
    box(B, '#c4c3bc', b, 9, 0.5, 9, 0, 0, 0); box(B, '#d9d8d2', b, 2.6, 0.8, 3.4, 2.6, 0.5, -2.4); B.add(CYL8, '#d9d8d2', b, 0, 0.5, 0, 1.0, 3.6, 1.0);
    B.add(new T.ConeGeometry(4.2, 1.5, 12), '#f0f0ec', b, 0, 6.0, 0.6, 1, 1, 1, Math.PI - 0.95, 0, 0); box(B, '#cfcfca', b, 0.18, 3.6, 0.18, 0, 6.2, 1.7, 0, 0.75); box(B, '#9a9b98', b, 0.6, 0.6, 0.6, 0, 8.6, 4.0); }
  function commsMast(B, x, z, H, fast) { const b = at(x, G, z, 0), n = 8, sh = H / n; box(B, '#b9b8b0', b, 6, 0.5, 6, 0, 0, 0);
    for (let i = 0; i < n; i++) { const c = i % 2 ? '#f1eee6' : '#c7342a', w0 = 3.6 - 2.4 * i / n, w1 = 3.6 - 2.4 * (i + 1) / n, y0 = 0.5 + i * sh, wm = (w0 + w1) / 2;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, d]) => box(B, c, b, 0.3, sh + 0.05, 0.3, a * wm / 2, y0, d * wm / 2));
      if (!fast || i % 2 === 0) { const L = Math.hypot(wm, sh), ang = Math.atan2(wm, sh);
        [-1, 1].forEach(sd => { B.add(BOX, c, b, -wm / 2, y0, sd * wm / 2, 0.12, L, 0.12, 0, 0, -ang); B.add(BOX, c, b, sd * wm / 2, y0, wm / 2, 0.12, L, 0.12, ang, 0, 0); });
        box(B, c, b, wm, 0.14, 0.14, 0, y0 + sh, wm / 2); box(B, c, b, wm, 0.14, 0.14, 0, y0 + sh, -wm / 2); box(B, c, b, 0.14, 0.14, wm, wm / 2, y0 + sh, 0); box(B, c, b, 0.14, 0.14, wm, -wm / 2, y0 + sh, 0); } }
    box(B, '#c7342a', b, 0.2, 5, 0.2, 0, H + 0.5, 0); [[0.95, 0.35, 0.6], [-0.9, 0.55, 1.9], [0.2, 0.7, -2.2]].forEach(([a, f, ry]) => B.add(CYL, '#f0f0ec', b, Math.sin(ry) * 1.1, 0.5 + H * f, Math.cos(ry) * 1.1, 0.9, 0.35, 0.9, Math.PI / 2, ry, 0));
    for (let k = 0; k < 3; k++) box(B, '#f0f0ec', b, 0.5, 2.2, 0.3, Math.sin(k * 2.1) * 0.9, 0.5 + H * (0.75 + k * 0.06), Math.cos(k * 2.1) * 0.9, k * 2.1); }
  function woodTower(B, x, z, ry, fast) { const b = at(x, G, z, ry || 0), H = 11;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, d]) => B.add(BOX, WOOD, b, a * 2.0, 0, d * 2.0, 0.35, H + 0.2, 0.35, d * 0.08, 0, -a * 0.08));
    if (!fast) [2.2, 6.4].forEach(y0 => { const w = 4.0 - y0 * 0.13, L = Math.hypot(w, 4.2), ang = Math.atan2(w, 4.2);
      [-1, 1].forEach(sd => { B.add(BOX, WOOD2, b, -w / 2, y0, sd * w / 2, 0.16, L, 0.16, 0, 0, -ang); B.add(BOX, WOOD2, b, w / 2, y0, sd * w / 2, 0.16, L, 0.16, 0, 0, ang); B.add(BOX, WOOD2, b, sd * w / 2, y0, -w / 2, 0.16, L, 0.16, ang, 0, 0); B.add(BOX, WOOD2, b, sd * w / 2, y0, w / 2, 0.16, L, 0.16, -ang, 0, 0); }); });
    box(B, WOOD2, b, 4.6, 0.35, 4.6, 0, H, 0); box(B, WOOD, b, 3.4, 2.5, 3.4, 0, H + 0.35, 0); box(B, '#3c4a57', b, 3.5, 0.9, 3.5, 0, H + 1.4, 0);
    [-1, 1].forEach(sd => { box(B, WOOD2, b, 4.6, 1.0, 0.12, 0, H + 0.35, sd * 2.25); box(B, WOOD2, b, 0.12, 1.0, 4.6, sd * 2.25, H + 0.35, 0); });
    B.add(new T.ConeGeometry(3.6, 1.8, 4), '#6a5c4c', b, 0, H + 3.75, 0, 1, 1, 1, 0, Math.PI / 4, 0); }
  function guardhouse(B, x, z, ry) { const b = at(x, G, z, ry || 0);
    box(B, '#b4b3ab', b, 6.5, 0.3, 5.5, 0, 0, 0); box(B, '#d0c6aa', b, 5, 3, 4, 0, 0.3, 0); box(B, '#6f6a62', b, 6.2, 0.4, 5.2, 0, 3.3, 0);
    box(B, '#4f6576', b, 3.6, 1.1, 4.06, -0.3, 1.6, 0); box(B, '#4f6576', b, 5.06, 1.1, 2.4, 0, 1.6, 0.2); box(B, '#3b2f26', b, 1.0, 2.2, 0.1, 1.7, 0.3, 2.02); }
  function boom(B, x, z, len, ry) { const b = at(x, G, z, ry || 0); box(B, '#d0c6aa', b, 0.7, 1.2, 0.7, 0, 0, 0); for (let i = 0; i < 8; i++) box(B, i % 2 ? '#f2f1ea' : '#d6302a', b, len / 8, 0.22, 0.22, 0.5 + len / 16 + i * len / 8, 1.0, 0); box(B, '#d6302a', b, 0.22, 2.6, 0.22, 0.2, 0, 0.6); }
  function adminBlock(B, x, z, w, d, fl, ry, fast) { const b = at(x, G, z, ry || 0), H = fl * 3.4;
    box(B, '#b4b3ab', b, w + 2, 0.35, d + 2, 0, 0, 0); box(B, BEIGE, b, w, H, d, 0, 0.35, 0); box(B, '#bcae8e', b, w + 0.4, 0.5, d + 0.4, 0, 0.35 + H, 0); box(B, DROOF, b, w - 0.6, 0.6, d - 0.6, 0, 0.4 + H, 0);
    for (let f = 0; f < fl; f++) for (let wx = -w / 2 + 2.5; wx <= w / 2 - 2.4; wx += 3.4) { if (f === 0 && Math.abs(wx) < 3) continue; [1, -1].forEach(sd => { if (sd < 0 && fast) return; B.add(PLANE, '#56697a', b, wx, 0.35 + f * 3.4 + 1.8, sd * (d / 2 + 0.03), 1.6, 1.5, 1, 0, sd > 0 ? 0 : Math.PI, 0); }); }
    box(B, '#56697a', b, 4, 2.6, 0.12, 0, 0.35, d / 2 + 0.02); box(B, '#9a968c', b, 7, 0.35, 3, 0, 3.1, d / 2 + 1.5); [-3.2, 3.2].forEach(px => box(B, '#d9d6cc', b, 0.3, 2.8, 0.3, px, 0.35, d / 2 + 2.8));
    if (!fast) { box(B, '#c9c6bd', b, 3, 1.2, 2, w / 4, 1.0 + H, 0); box(B, '#c9c6bd', b, 2, 1.0, 2, -w / 4, 1.0 + H, -1); } }
  function smallBlock(B, x, z, w, d, h, ry, col, roof) { const b = at(x, G, z, ry || 0); box(B, '#b4b3ab', b, w + 1, 0.3, d + 1, 0, 0, 0); box(B, col || BEIGE2, b, w, h, d, 0, 0.3, 0); box(B, roof || DROOF, b, w + 0.6, 0.45, d + 0.6, 0, 0.3 + h, 0);
    for (let wx = -w / 2 + 2.5; wx <= w / 2 - 2.4; wx += 4) B.add(PLANE, '#56697a', b, wx, 0.3 + h * 0.55, d / 2 + 0.03, 1.6, 1.3, 1, 0, 0, 0); box(B, '#3b2f26', b, 1.4, 2.3, 0.12, 0, 0.3, d / 2 + 0.02); }
  function fireHouse(B, x, z, fast) { const b = at(x, G, z, 0), RED = '#c23a2e';
    box(B, '#b4b3ab', b, 40, 0.3, 22, 0, 0, 0); box(B, BEIGE, b, 38, 8, 18, 0, 0.3, 0); box(B, DROOF, b, 38.6, 0.5, 18.6, 0, 8.3, 0); box(B, RED, b, 38.1, 0.8, 18.1, 0, 7.0, 0);
    for (let i = 0; i < 4; i++) { box(B, RED, b, 6.4, 5.4, 0.15, -12.6 + i * 8.4, 0.3, 9.02); for (let k = 1; k < 5; k++) box(B, '#9c2e25', b, 6.4, 0.12, 0.17, -12.6 + i * 8.4, 0.3 + k * 1.08, 9.03); }
    box(B, BEIGE, b, 4, 12, 4, 17, 0.3, -6); box(B, DROOF, b, 4.6, 0.5, 4.6, 17, 12.3, -6); }
  function fuelTankH(B, x, z, ry) { const b = at(x, G, z, ry || 0); [-3.5, 3.5].forEach(pz => box(B, '#9a9b98', b, 3.4, 1.4, 0.8, 0, 0, pz)); B.add(CYL, '#e9e9e4', b, 0, 2.9, -6, 1.7, 12, 1.7, Math.PI / 2, 0, 0); box(B, '#9a9b98', b, 0.6, 0.6, 0.6, 0, 4.4, 2); }
  // --- vehicles ---
  function camoTruck(B, x, z, ry) { const b = at(x, 0.54, z, ry), Y = '#c9b45c', GR = '#6e7a3a', K = '#25282b';
    box(B, '#8a7f4a', b, 2.4, 0.6, 7.6, 0, 0.6, 0); box(B, Y, b, 2.4, 1.9, 2.1, 0, 1.0, 2.6); box(B, '#3c4a57', b, 2.2, 0.7, 0.12, 0, 2.0, 3.66); box(B, Y, b, 2.5, 2.4, 4.8, 0, 1.2, -1.3);
    box(B, GR, b, 2.56, 1.0, 1.6, 0, 2.0, -0.4); box(B, GR, b, 1.2, 0.08, 2.0, 0.5, 3.6, -2.4); box(B, GR, b, 2.56, 0.9, 1.2, 0, 1.4, -3.0); box(B, GR, b, 2.46, 0.7, 0.9, 0, 2.3, 2.2);
    [[-1, 2.6], [1, 2.6], [-1, -0.9], [1, -0.9], [-1, -2.5], [1, -2.5]].forEach(([sx, sz]) => box(B, K, b, 0.45, 1.1, 1.1, sx * 1.15, 0, sz)); }
  function fuelTruck(B, x, z, ry) { const b = at(x, 0.54, z, ry), GR = '#6c7a40', K = '#25282b';
    box(B, '#3f4535', b, 2.2, 0.6, 7.8, 0, 0.6, 0); box(B, GR, b, 2.4, 1.9, 2.1, 0, 1.0, 2.7); box(B, '#3c4a57', b, 2.2, 0.7, 0.12, 0, 2.0, 3.76); B.add(CYL, GR, b, 0, 2.3, -3.3, 1.2, 5.2, 1.2, Math.PI / 2, 0, 0); box(B, '#c9b45c', b, 2.42, 0.4, 3, 0, 2.1, -1.0);
    [[-1, 2.7], [1, 2.7], [-1, -1.2], [1, -1.2], [-1, -2.6], [1, -2.6]].forEach(([sx, sz]) => box(B, K, b, 0.45, 1.1, 1.1, sx * 1.1, 0, sz)); }
  function pickup(B, x, z, ry) { const b = at(x, 0.54, z, ry), C = '#b9a65a', K = '#25282b'; box(B, C, b, 2.0, 0.9, 5.0, 0, 0.5, 0); box(B, C, b, 1.9, 0.9, 2.0, 0, 1.4, 0.6); box(B, '#3c4a57', b, 1.8, 0.55, 2.06, 0, 1.55, 0.6);
    [[-1, 1.6], [1, 1.6], [-1, -1.6], [1, -1.6]].forEach(([sx, sz]) => box(B, K, b, 0.35, 0.8, 0.8, sx * 0.95, 0, sz)); }
  function tug(B, x, z, ry) { const b = at(x, 0.54, z, ry); box(B, '#d9b13a', b, 2.0, 1.0, 3.6, 0, 0.4, 0); box(B, '#3c4a57', b, 1.6, 0.9, 1.0, 0, 1.4, -0.8); [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => box(B, '#25282b', b, 0.3, 0.7, 0.7, sx * 0.95, 0, sz * 1.1)); }
  function bus(B, x, z, ry) { const b = at(x, 0.46, z, ry); box(B, '#c9b45c', b, 2.5, 2.6, 11, 0, 0.5, 0); box(B, '#3c4a57', b, 2.56, 0.9, 9.6, 0, 1.9, -0.3); box(B, '#3c4a57', b, 2.3, 1.1, 0.1, 0, 1.7, 5.5); [[-1, 3.6], [1, 3.6], [-1, -3.4], [1, -3.4]].forEach(([sx, sz]) => box(B, '#25282b', b, 0.4, 1.0, 1.0, sx * 1.2, 0, sz)); }
  function chainFence(B, pts, step, gap) { const P = '#8f9294';
    for (let k = 0; k < pts.length - 1; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[k + 1], L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step)); let s0 = -1;
      const run = (t0, t1) => { if (t1 <= t0) return; const x = x0 + (x1 - x0) * (t0 + t1) / 2, z = z0 + (z1 - z0) * (t0 + t1) / 2, l = L * (t1 - t0); box(B, P, null, 0.08, 0.08, l, x, G + 2.7, z, a); B.add(BOX, 'wire', null, x, G + 0.05, z, 0.03, 2.65, l, 0, a, 0); };
      for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, in_ = gap && gap(x, z); if (!in_) { box(B, P, null, 0.16, 3.0, 0.16, x, G, z); if (s0 < 0) s0 = t; } else if (s0 >= 0) { run(s0, (i - 1) / n); s0 = -1; } }
      if (s0 >= 0) run(s0, 1); } }

  function forces(o = {}) {
    const fast = !!o.fast; FASTMODE = fast; const g = new T.Group(), B = Batch(), r = rng(28111), APP = o.approachEnd == null ? -900 : o.approachEnd;
    const inAB = (x, z, m) => x > AB.x0 - m && x < AB.x1 + m && z > AB.z0 - m && z < AB.z1 + m;
    // ---- the approach road: winds in from the main road through the forest to the gate on the north fence ----
    const curve = new T.CatmullRomCurve3([[APP, -420], [-1400, -420], [-1650, -428], [-1850, -458], [-2050, -476], [-2230, -462], [-2350, -440], [GATEX, -424], [GATEX, -403]].map(([x, z]) => new T.Vector3(x, 0, z)), false, 'catmullrom', 0.4);
    const RP = curve.getSpacedPoints(fast ? 70 : 120).map(v => [v.x, v.z]);
    // ---- dirt patrol track round the base (outside the fence) ----
    const TK = { x0: AB.x0 - 16, x1: AB.x1 + 16, z0: AB.z0 - 16, z1: AB.z1 + 16 };
    const nearRoad = (x, z, d) => { for (let i = 0; i < RP.length; i += 1) if (Math.abs(RP[i][0] - x) < d + 14 && Math.hypot(RP[i][0] - x, RP[i][1] - z) < d) return true; return false; };
    // ---- ground ----
    { const CELL = fast ? 30 : 20, nx = Math.round((Z.x1 - Z.x0) / CELL), nz = Math.round((Z.z1 - Z.z0) / CELL), pos = [], col = [], idx = [], cin = new T.Color('#97b05a'), cout = new T.Color('#86a64f'), dry = new T.Color('#a9ad66'), cc = new T.Color();
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = Z.x0 + (Z.x1 - Z.x0) * i / nx, z = Z.z0 + (Z.z1 - Z.z0) * j / nz, n = noise(x / 90, z / 90, 5);
        pos.push(x, G, z); cc.copy(inAB(x, z, 0) ? cin : cout).lerp(dry, sst((n - 0.55) * 3) * 0.35); col.push(cc.r, cc.g, cc.b); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b2 = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b2, b2, c, d); }
      const G2 = new T.BufferGeometry(); G2.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G2.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G2.setIndex(idx); G2.computeVertexNormals();
      const lm = new T.Mesh(G2, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); lm.userData.ground = true; g.add(lm); }
    // road: dark asphalt with a dashed centre line; round joints keep the bends smooth
    for (let i = 0; i < RP.length - 1; i++) { const [x0, z0] = RP[i], [x1, z1] = RP[i + 1], L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
      box(B, '#5b5e62', null, 9, 0.16, L + 0.6, (x0 + x1) / 2, 0.3, (z0 + z1) / 2, a); if (i % 2 === 0) box(B, WHITE, null, 0.3, 0.2, L * 0.5, (x0 + x1) / 2, 0.3, (z0 + z1) / 2, a);
      B.add(CYL8, '#5b5e62', null, x1, 0.3, z1, 4.5, 0.16, 4.5); }
    { const tk = (x0, x1, z0, z1) => slab(B, '#b39a6c', x0, x1, z0, z1, 0.3, 0.38); tk(TK.x0 - 3, TK.x1 + 3, TK.z0 - 3, TK.z0 + 3); tk(TK.x0 - 3, TK.x1 + 3, TK.z1 - 3, TK.z1 + 3); tk(TK.x0 - 3, TK.x0 + 3, TK.z0, TK.z1); tk(TK.x1 - 3, TK.x1 + 3, TK.z0, TK.z1); }

    // ---- airfield pavements ----
    const pave = (R, c, top) => slab(B, c, R.x0, R.x1, R.z0, R.z1, 0.3, top);
    const mark = (x0, x1, z0, z1, c, top) => slab(B, c || WHITE, x0, x1, z0, z1, 0.3, top || 0.53);
    pave(RW, AS, 0.5); pave(TW, AS, 0.5);
    slab(B, '#c9c4b0', RW.x0 - 60, RW.x0, RW.z0 + 4, RW.z1 - 4, 0.3, 0.42); slab(B, '#c9c4b0', RW.x1, RW.x1 + 60, RW.z0 + 4, RW.z1 - 4, 0.3, 0.42);   // blast pads
    for (let k = 0; k < 4; k++) { mark(RW.x0 - 56 + k * 14, RW.x0 - 50 + k * 14, -184.5, -180.5, YEL, 0.45); mark(RW.x1 + 44 - k * 14, RW.x1 + 50 - k * 14, -184.5, -180.5, YEL, 0.45); }   // chevrons (simple)
    const zc = (RW.z0 + RW.z1) / 2;
    mark(RW.x0, RW.x1, RW.z0 + 1, RW.z0 + 1.9); mark(RW.x0, RW.x1, RW.z1 - 1.9, RW.z1 - 1); // edge lines
    for (let x = RW.x0 + 110; x < RW.x1 - 110; x += (fast ? 60 : 50)) mark(x, x + 30, zc - 0.5, zc + 0.5);
    [RW.x0, RW.x1].forEach((ex, e) => { const s = e ? -1 : 1, X = d => ex + s * d, xs = (d0, d1) => [Math.min(X(d0), X(d1)), Math.max(X(d0), X(d1))];
      for (let k = 0; k < 6; k++) [-1, 1].forEach(sd => { const zz = zc + sd * (3.2 + k * 3.3); mark(...xs(6, 40), zz - 0.9, zz + 0.9); });                     // piano keys
      [-1, 1].forEach(sd => { mark(...xs(150, 195), zc + sd * 5 - 2, zc + sd * 5 + 2); [100, 250].forEach(d => [0, 1].forEach(k => mark(...xs(d, d + 22), zc + sd * (13 + k * 3.2) - 0.8, zc + sd * (13 + k * 3.2) + 0.8))); });
      // runway number (7-segment, reads from the approach): 09 at the west end, 27 at the east end
      const seg = { 0: 'abcdef', 2: 'abged', 7: 'abc', 9: 'abcdfg' }, digit = (dg, u0, v0) => { const W = 7, H = 14, t = 1.4, put = (u, v, du, dv) => { const ax = ex + s * (v0 + v), az = zc + s * (u0 + u); mark(Math.min(ax, ax + s * dv), Math.max(ax, ax + s * dv), Math.min(az, az + s * du), Math.max(az, az + s * du)); };
        const S = seg[dg]; if (S.includes('a')) put(0, H - t, W, t); if (S.includes('g')) put(0, H / 2 - t / 2, W, t); if (S.includes('d')) put(0, 0, W, t); if (S.includes('f')) put(0, H / 2, t, H / 2); if (S.includes('e')) put(0, 0, t, H / 2); if (S.includes('b')) put(W - t, H / 2, t, H / 2); if (S.includes('c')) put(W - t, 0, t, H / 2); };
      const nums = e ? [2, 7] : [0, 9]; digit(nums[0], -9, 52); digit(nums[1], 2, 52); });
    // taxiway: yellow centre line + edges; links to the runway (both ends + middle) with hold lines
    mark(TW.x0 + 10, TW.x1 - 10, -250.8, -250.2, YEL); mark(TW.x0, TW.x1, TW.z0 + 0.6, TW.z0 + 1.0, YEL); mark(TW.x0, TW.x1, TW.z1 - 1.0, TW.z1 - 0.6, YEL);
    [RW.x0 + 15, -2920, RW.x1 - 15].forEach(lx => { slab(B, AS, lx - 11.5, lx + 11.5, TW.z1, RW.z0, 0.3, 0.5); mark(lx - 0.3, lx + 0.3, TW.z1 - 1, RW.z0 + 4, YEL);
      for (let k = 0; k < 4; k++) mark(lx - 11, lx + 11, -216 + k * 1.1, -215.6 + k * 1.1, YEL); });
    // north apron + links to the taxiway
    pave(NAP, CON, 0.54); [-3240, -3030, -2880].forEach(lx => { slab(B, CON2, lx - 10, lx + 10, NAP.z1, TW.z0, 0.3, 0.52); mark(lx - 0.25, lx + 0.25, NAP.z1 - 6, TW.z0 + 1, YEL, 0.56); });
    mark(NAP.x0 + 4, NAP.x1 - 4, NAP.z1 - 12.3, NAP.z1 - 11.8, YEL, 0.57);
    // south apron + three links over to the runway
    pave(SAP, CON, 0.54); [-3300, -2980, -2600].forEach(lx => { slab(B, CON2, lx - 10, lx + 10, RW.z1, SAP.z0, 0.3, 0.52); mark(lx - 0.25, lx + 0.25, RW.z1 + 1, SAP.z0 + 8, YEL, 0.56); });
    mark(SAP.x0 + 4, SAP.x1 - 4, SAP.z0 + 8.2, SAP.z0 + 8.7, YEL, 0.57);
    // approach lights in the grass beyond each end
    [[RW.x0, -1], [RW.x1, 1]].forEach(([ex, s]) => { for (let k = 1; k <= (fast ? 3 : 6); k++) { const x = ex + s * (60 + k * 13); box(B, '#5a5d61', null, 0.3, 1.6, 0.3, x, G, zc); box(B, '#5a5d61', null, 0.2, 0.2, 12, x, G + 1.6, zc); if (!fast) for (let q = -2; q <= 2; q++) box(B, '#fff2c4', null, 0.5, 0.4, 0.5, x, G + 1.8, zc + q * 2.8); } });

    // ---- hangar row (doors south onto the north apron), control tower between them ----
    const HG = [[-3270, '#6b6e72', '#7d8084'], [-3195, '#bab3a1', '#cbc4b2'], [-3120, '#6f8696', '#8299a8'], [-2965, '#6f8696', '#8299a8'], [-2890, '#b0a994', '#c4bda8']];
    HG.forEach(([hx, c, rb]) => archHangar(B, hx, -357, 58, 50, 21, c, rb, fast));
    ctrlTower(B, -3043, -345, fast);
    // fighters in front of the hangars + support vehicles (desktop shows more)
    [[-3285, -315, 0.25], [-3200, -312, -0.2], [-3115, -318, 0.15], [-2975, -314, -0.25], [-2895, -316, 0.2]].forEach(([x, z, a], i) => { fighter(B, x, z, Math.PI + a + Math.PI, fast); if (!fast || i % 2 === 0) camoTruck(B, x + 18, z - 4, Math.PI / 2); if (!fast) tug(B, x - 14, z + 6, 0.4); });
    [[-3250, -298], [-3080, -300], [-2930, -298]].forEach(([x, z]) => fighter(B, x, z, Math.PI / 2, fast));
    // ---- radar + comms corner (north-east) ----
    radome(B, -2815, -378); radome(B, -2785, -348); satDish(B, -2760, -378, 0.6); satDish(B, -2740, -350, -0.4); satDish(B, -2715, -380, 0.2);
    commsMast(B, -2810, -310, 42, fast); smallBlock(B, -2760, -312, 18, 10, 4, 0, '#d3cdbb'); smallBlock(B, -2725, -312, 12, 8, 3.5, 0, '#c9c3b0');
    [-2700, -2688].forEach((x, i) => fuelTankH(B, x, -360 + i * 0, 0)); fuelTankH(B, -2676, -360, 0);
    // ---- fire station by the taxiway ----
    fireHouse(B, -2660, -300, fast); [-2672, -2655].forEach(x => firetruck(B, x, -280, 0));
    // ---- admin quarter: HQ block, ops + mess, parking with buses and trucks; gate road + back road ----
    adminBlock(B, -2520, -372, 54, 16, 3, 0, fast); smallBlock(B, -2585, -372, 26, 14, 4.5, 0); smallBlock(B, -2585, -330, 26, 14, 4.5, 0, '#c9bc9a');
    smallBlock(B, -2420, -312, 18, 12, 4, Math.PI / 2, '#c9bc9a');
    slab(B, '#5b5e62', -2555, -2470, -350, -310, 0.3, 0.46); for (let x = -2550; x < -2475; x += 6) mark(x, x + 0.25, -350, -340, WHITE, 0.5);
    [-2545, -2533, -2521].forEach(x => bus(B, x, -320, Math.PI / 2)); [-2505, -2490].forEach(x => camoTruck(B, x, -322, -Math.PI / 2)); if (!fast) [-2545, -2533, -2509, -2497, -2485].forEach(x => pickup(B, x, -345, 0));
    slab(B, '#5b5e62', GATEX - 6, GATEX + 6, AB.z0, -300, 0.3, 0.46); slab(B, '#5b5e62', -3440, GATEX + 6, -396, -388, 0.3, 0.46); slab(B, '#5b5e62', GATEX - 6, -2470, -334, -326, 0.3, 0.46);
    slab(B, '#5b5e62', -2740, GATEX - 6, -300, -292, 0.3, 0.46);
    // gate: guardhouse, boom barriers, a lattice watchtower, a small sign
    guardhouse(B, GATEX + 11, -394, -Math.PI / 2); boom(B, GATEX + 6.5, -398, 11, Math.PI); boom(B, GATEX - 6.5, -405, 11, 0);
    { const tex = signTex([['VINLAND AIR FORCE BASE', 0.36, 0.42], ['AUTHORISED ENTRY ONLY', 0.2, 0.78]], 1024, 256, '#2e3f55', '#f4efe2'); box(B, '#8f9294', null, 0.3, 4.5, 0.3, GATEX - 16, G, -405); box(B, '#8f9294', null, 0.3, 4.5, 0.3, GATEX - 32, G, -405);
      if (tex) { const sm = new T.Mesh(new T.PlaneGeometry(16, 4), new T.MeshLambertMaterial({ map: tex })); sm.position.set(GATEX - 24, G + 4.6, -405.3); sm.rotation.y = Math.PI; g.add(sm); } box(B, '#2e3f55', null, 16.2, 4.2, 0.2, GATEX - 24, G + 2.5, -405.15); }
    // ---- south apron: helipads (west), fighter line (middle), cargo planes (east) ----
    [-3420, -3385, -3350].forEach((x, i) => { slab(B, CON2, x - 15, x + 15, SAP.z0 + 12, SAP.z1 - 4, 0.3, 0.57); ring(B, YEL, x, 0.57, -116, 11, 0.7, fast ? 16 : 24);
      mark(x - 4, x - 2.6, -122, -110, WHITE, 0.6); mark(x + 2.6, x + 4, -122, -110, WHITE, 0.6); mark(x - 2.6, x + 2.6, -116.7, -115.3, WHITE, 0.6); if (i < (fast ? 2 : 3)) helicopter(B, x, -116, Math.PI + (i - 1) * 0.15, fast); });
    for (let k = 0; k < (fast ? 6 : 9); k++) { const x = -3250 + k * (fast ? 70 : 48); fighter(B, x, -116, Math.PI, fast);
      mark(x - 9, x + 9, -127.6, -127.2, WHITE, 0.57); mark(x - 9, x - 8.6, -127.6, -102, WHITE, 0.57); mark(x + 8.6, x + 9, -127.6, -102, WHITE, 0.57);
      if (!fast && k % 3 === 1) fuelTruck(B, x + 22, -112, Math.PI); if (!fast && k % 3 === 2) camoTruck(B, x + 22, -110, 0); }
    [-2740, -2640].forEach(x => { cargoPlane(B, x, -120, Math.PI, fast); }); camoTruck(B, -2690, -106, Math.PI / 2); fuelTruck(B, -2595, -112, Math.PI); if (!fast) { pickup(B, -2690, -132, -Math.PI / 2); tug(B, -2760, -100, 0); }
    // a vehicle shed on the east side of the south apron
    { const b = at(-2480, G, -120, 0); box(B, '#b4b3ab', b, 64, 0.3, 26, 0, 0, 0); for (let i = 0; i <= 6; i++) { box(B, '#8f9294', b, 0.4, 6, 0.4, -30 + i * 10, 0.3, 10); box(B, BEIGE2, b, 0.3, 6, 22, -30 + i * 10, 0.3, -1); } box(B, BEIGE2, b, 60, 6, 0.4, 0, 0.3, -12); box(B, DROOF, b, 62, 0.5, 26, 0, 6.3, -0.5);
      for (let i = 0; i < 6; i++) (i % 2 ? fuelTruck : camoTruck)(B, -2505 + i * 10, -118, Math.PI); }
    // ---- fence + wooden watchtowers on the corners and along the long sides ----
    const gp = (x, z) => Math.abs(x - GATEX) < 7 && Math.abs(z - AB.z0) < 1;
    chainFence(B, [[AB.x0, AB.z0], [AB.x1, AB.z0], [AB.x1, AB.z1], [AB.x0, AB.z1], [AB.x0, AB.z0]], fast ? 18 : 10, gp);
    [[AB.x0, AB.z0], [AB.x1, AB.z0], [AB.x1, AB.z1], [AB.x0, AB.z1], [-2930, AB.z0], [-2930, AB.z1], [GATEX - 14, AB.z0 + 6]].forEach(([x, z]) => woodTower(B, x + (x < -2930 ? 4 : x > -2930 ? -4 : 0), z + (z < -200 ? 4 : -4), 0, fast));
    // lamps along the gate road and back road
    for (let x = -3420; x < GATEX; x += 60) lamp(B, x, -386, 0); for (let z = -390; z < -300; z += 30) lamp(B, GATEX + 8, z, Math.PI / 2);
    if (!fast) { [[-3020, -330], [-2850, -340], [-2600, -300]].forEach(([x, z], i) => { crates(B, x, z, i); drums(B, x + 6, z); }); }
    let tris = B.build(g);
    // ---- hills round the land (outside the forest edge) ----
    { const X0 = -4300, X1 = -1250, ZA = -800, ZB = 420, CELL = fast ? 44 : 30, nx = Math.round((X1 - X0) / CELL), nz = Math.round((ZB - ZA) / CELL), pos = [], col = [], idx = [], lo = new T.Color('#86a64f'), hi = new T.Color('#6f9445'), top = new T.Color('#a3a873'), dry = new T.Color('#a8a76a'), cc = new T.Color(), HH = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = X0 + (X1 - X0) * i / nx, z = ZA + (ZB - ZA) * j / nz, h = hillH(x, z); HH.push(h); pos.push(x, 0.34 + h, z); const k = h / 24; cc.copy(lo).lerp(k > 0.7 ? top : hi, Math.min(1, k * 1.2)).lerp(dry, sst((noise(x / 70, z / 70, 11) - 0.55) * 3) * 0.4); col.push(cc.r, cc.g, cc.b); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b2 = a + 1, c = a + nx + 1, d = c + 1; if (Math.max(HH[a], HH[b2], HH[c], HH[d]) < 0.05) continue; idx.push(a, c, b2, b2, c, d); }
      const G3 = new T.BufferGeometry(); G3.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G3.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G3.setIndex(idx); G3.computeVertexNormals(); tris += idx.length / 3;
      const hm = new T.Mesh(G3, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); hm.userData.ground = true; g.add(hm); }
    // ---- forest: dense pines + round yellow-green trees all round, clearings by noise, never on the road, track or inside the fence ----
    { const TR = [], R2 = rng(909), N = fast ? 800 : 2800;
      const ok = (x, z) => !inAB(x, z, 26) && !nearRoad(x, z, 13) && z > -780 && !(x > -1300 && Math.abs(z + 420) < 30);
      const dB = (x, z) => Math.hypot(Math.max(AB.x0 - x, x - AB.x1, 0), Math.max(AB.z0 - z, z - AB.z1, 0));
      const put = (x, z) => { const pine = R2() < 0.6; TR.push({ x, y: G + hillH(x, z), z, r: R2() * 6.28, s: (pine ? 1.5 : 1.3) + R2() * 0.9, k: pine ? 'p' : 'r', c: (R2() * 4) | 0 }); };
      for (let i = 0; i < N * 10 && TR.length < N * 0.6; i++) { const x = AB.x0 - 260 + R2() * (AB.x1 - AB.x0 + 520), z = AB.z0 - 260 + R2() * (AB.z1 - AB.z0 + 420), d = dB(x, z); if (d < 26 || d > 260) continue; if (noise(x / 60, z / 60, 7) < 0.3) continue; if (ok(x, z)) put(x, z); }   // thick woods hugging the base
      for (let i = 0; i < N * 10 && TR.length < N; i++) { const x = -4250 + R2() * 3000, z = -780 + R2() * 1190, n = noise(x / 140, z / 140, 21); if (n < 0.4) continue; if (R2() > 0.3 + n) continue; if (!ok(x, z)) continue; put(x, z); }
      [[-2600, -260, 10], [-2420, -250, 8], [-3440, -260, 10], [-2700, -395, 6]].forEach(([cx, cz, n]) => { for (let i = 0; i < (fast ? n / 2 : n); i++) TR.push({ x: cx + (R2() - 0.5) * 30, y: G, z: cz + (R2() - 0.5) * 24, r: R2() * 6.28, s: 1.1 + R2() * 0.5, k: R2() < 0.5 ? 'p' : 'r', c: (R2() * 4) | 0 }); });
      const O = new T.Object3D(), col = new T.Color(), make = (geo, L, f) => { if (!L.length) return; const im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), L.length); im.castShadow = !fast; im.receiveShadow = false;
        L.forEach((t, i) => { O.position.set(t.x, t.y, t.z); O.rotation.set(0, t.r, 0); O.scale.setScalar(t.s); O.updateMatrix(); im.setMatrixAt(i, O.matrix); im.setColorAt(i, col.set(f(t))); }); im.userData.trees = true; g.add(im); };
      const pine = TR.filter(t => t.k === 'p'), round = TR.filter(t => t.k === 'r'), PC = ['#2f5f2e', '#3b6e34', '#28552a', '#447a3a'], RC = ['#9bb043', '#aabb4c', '#86a33e', '#b7c25a'];
      make(new T.CylinderGeometry(0.22, 0.32, 1.6, 5, 1, true).translate(0, 0.8, 0), TR, () => '#6e4c32');
      make(new T.ConeGeometry(2.0, 3.4, 6, 1, true).translate(0, 2.9, 0), pine, t => PC[t.c]); make(new T.ConeGeometry(1.55, 2.9, 6, 1, true).translate(0, 4.6, 0), pine, t => PC[(t.c + 1) % 4]); make(new T.ConeGeometry(1.0, 2.2, 6, 1, true).translate(0, 6.1, 0), pine, t => PC[(t.c + 2) % 4]);
      make(new T.IcosahedronGeometry(2.1, 0).translate(0, 3.6, 0), round, t => RC[t.c]); if (!fast) make(new T.IcosahedronGeometry(1.5, 0).translate(1.0, 5.0, 0.4), round, t => RC[(t.c + 1) % 4]);
      g.userData.treeCount = TR.length; }
    g.traverse(m => { if (!m.isMesh || m.userData.trees) return; m.receiveShadow = !fast; m.castShadow = !fast && !m.userData.ground && !(m.material && m.material.transparent); });
    g.userData.tris = tris; g.userData.zone = Z; g.userData.gate = GATE; return g; }

  root.VinlandForces = { forces, Z, GATE, hillH, AB };
})(window);
