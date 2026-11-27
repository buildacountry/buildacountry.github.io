// VINLAND AIR FORCE BASE (Dev, 28 Nov 2026): built one base at a time. Uses ONLY Dev's own low-poly assets (airkit.js, from his .glb pack), laid out like
// Dev's reference picture, on the coast land Dev marked west of the old forces strip. Navy + Army come later, one by one.
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


  // ================= AIR FORCE BASE v2 (Dev, 28 Nov): Dev's own .glb assets only (map/airkit.js), laid out like Dev's reference picture, on the land Dev marked =================
  // Spot: the empty coast land west of the old forces strip, between the sea (z -830) and the farms (z > 545). Centre C; local x along the runway (east +), local z south +.
  const C = { x: -6350, z: 130 };
  const KIT = {}; const dec = b => { const s = atob(b), a = new Int16Array(s.length / 2); for (let i = 0; i < a.length; i++) a[i] = (s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8)) << 16 >> 16; return a; };
  function kit(name) { if (KIT[name]) return KIT[name]; const parts = (root.AIRKIT && root.AIRKIT[name]) || [];
    return KIT[name] = parts.map(p => { const a = dec(p.p), f = new Float32Array(a.length); for (let j = 0; j < a.length; j++) f[j] = a[j] / 1000; const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(f, 3)); return { c: p.c, n: p.n, g }; }); }
  // place one asset (baked into the merged batch). k = scale, ry = turn, recol = { partName: colour }
  const put = (B, name, x, z, ry, k, recol, y, sy) => kit(name).forEach(p => B.add(p.g, (recol && recol[p.n]) || p.c, null, C.x + x, y == null ? 0.3 : y, C.z + z, k, k * (sy || 1), k, 0, ry || 0, 0));
  // many copies of one asset as instanced meshes (trees, fence)
  function many(g, name, list, fast, shadow) { kit(name).forEach(p => { const geo = p.g.clone(); geo.computeVertexNormals(); const im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: p.c, flatShading: true }), list.length), O = new T.Object3D();
      list.forEach((t, i) => { O.position.set(t.x, t.y == null ? 0.3 : t.y, t.z); O.rotation.set(0, t.r || 0, 0); O.scale.set(t.sx || t.s, t.sy || t.s, t.sz || t.s); O.updateMatrix(); im.setMatrixAt(i, O.matrix); });
      im.castShadow = !!shadow && !fast; im.receiveShadow = false; im.userData.inst = true; g.add(im); }); return list.length; }

  // ---- copied from Dev's reference picture (28 Nov): two grey runways with grass islands between, hangars on the east half with the tower in
  //      front of hangar 3, radar + comms corner north-east, the big fighter apron south-west with helipads, gate south-west, fenced support yard south-east ----
  const ASPH = '#6c6f73', PAVE = '#c4c7c9', PAVE2 = '#b3b7ba', WHITE = '#f4f3ee', YEL = '#e3b93a', LAWN = '#8fae55';
  const KJ = 2.6, KC = 3.0, KHE = 2.6, KH = 6.0, KTW = 4.6, KT = 1.6;
  const RW1 = [-240, 250, -28, 2], RW2 = [-255, 230, -98, -72], NAP = [-40, 262, -200, -118], SAP = [-262, 92, 15, 128], SEC = [112, 262, 28, 132];
  const FX0 = -275, FX1 = 275, FZ0 = -245, FZ1 = 140, GATE2 = [-120, 140];
  const inFence = (x, z, m) => x > FX0 - m && x < FX1 + m && z > FZ0 - m && z < FZ1 + m;

  function forces(o = {}) {
    const fast = !!o.fast; FASTMODE = fast; const g = new T.Group(), B = Batch(), R2 = rng(909);
    const L = (x0, x1, z0, z1, c, y1) => slab(B, c, C.x + x0, C.x + x1, C.z + z0, C.z + z1, 0.3, y1), M = (x0, x1, z0, z1, c, y) => L(x0, x1, z0, z1, c || WHITE, y || 0.53);
    // ---- road from the old forces strip west along the coast, round the woods, into the south-west gate ----
    const curve = new T.CatmullRomCurve3([[-900, -420], [-1700, -430], [-2600, -440], [-3500, -420], [-4100, -300], [-4700, -80], [-5250, 200], [-5700, 420], [-6100, 470], [-6380, 400], [C.x + GATE2[0], C.z + 200], [C.x + GATE2[0], C.z + GATE2[1] + 1]].map(([x, z]) => new T.Vector3(x, 0, z)), false, 'catmullrom', 0.4);
    const RP = curve.getSpacedPoints(fast ? 140 : 260).map(v => [v.x, v.z]);
    const nearRoad = (x, z, d) => RP.some(([a, b]) => Math.abs(a - x) < d && Math.hypot(a - x, b - z) < d);
    for (let i = 0; i < RP.length - 1; i++) { const [x0, z0] = RP[i], [x1, z1] = RP[i + 1], Ln = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
      box(B, '#5f6266', null, 9, 0.16, Ln + 0.6, (x0 + x1) / 2, 0.3, (z0 + z1) / 2, a); if (i % 2 === 0) box(B, WHITE, null, 0.3, 0.2, Ln * 0.5, (x0 + x1) / 2, 0.3, (z0 + z1) / 2, a); B.add(CYL8, '#5f6266', null, x1, 0.3, z1, 4.5, 0.16, 4.5); }
    // ---- lawn inside, dirt ring track outside ----
    L(FX0, FX1, FZ0, FZ1, LAWN, 0.34);
    { const t = (x0, x1, z0, z1) => L(x0, x1, z0, z1, '#bda077', 0.36); t(FX0 - 26, FX1 + 26, FZ0 - 26, FZ0 - 18); t(FX0 - 26, FX1 + 26, FZ1 + 18, FZ1 + 26); t(FX0 - 26, FX0 - 18, FZ0 - 26, FZ1 + 26); t(FX1 + 18, FX1 + 26, FZ0 - 26, FZ1 + 26); }
    // ---- two runways: piano keys at both ends of both, numbers and centre lines ----
    const runway = (R, w, big) => { L(R[0], R[1], R[2], R[3], ASPH, 0.5); const zc = (R[2] + R[3]) / 2, hw = (R[3] - R[2]) / 2;
      M(R[0], R[1], R[2] + 0.7, R[2] + 1.3); M(R[0], R[1], R[3] - 1.3, R[3] - 0.7); for (let x = R[0] + 50; x < R[1] - 50; x += fast ? 34 : 26) M(x, x + 14, zc - 0.35, zc + 0.35);
      [R[0], R[1]].forEach((ex, e) => { const s = e ? -1 : 1, X = d => ex + s * d, xs = (d0, d1) => [Math.min(X(d0), X(d1)), Math.max(X(d0), X(d1))];
        const n = Math.floor((hw - 2) / 2.4); for (let k = 0; k < n; k++) [-1, 1].forEach(sd => { const zz = zc + sd * (2.2 + k * 2.4); M(...xs(3, 20), zz - 0.7, zz + 0.7); });
        if (big) { [-1, 1].forEach(sd => M(...xs(60, 78), zc + sd * 3.6 - 1.4, zc + sd * 3.6 + 1.4));
          const seg = { 0: 'abcdef', 2: 'abged', 7: 'abc', 9: 'abcdfg' }, digit = (dg, u0, v0) => { const W = 3.8, H = 8, t = 0.9, P = (u, v, du, dv) => { const ax = ex + s * (v0 + v), az = zc + s * (u0 + u); M(Math.min(ax, ax + s * dv), Math.max(ax, ax + s * dv), Math.min(az, az + s * du), Math.max(az, az + s * du)); };
            const S = seg[dg]; if (S.includes('a')) P(0, H - t, W, t); if (S.includes('g')) P(0, H / 2 - t / 2, W, t); if (S.includes('d')) P(0, 0, W, t); if (S.includes('f')) P(0, H / 2, t, H / 2); if (S.includes('e')) P(0, 0, t, H / 2); if (S.includes('b')) P(W - t, H / 2, t, H / 2); if (S.includes('c')) P(W - t, 0, t, H / 2); };
          const nums = e ? [2, 7] : [0, 9]; digit(nums[0], -5, 26); digit(nums[1], 1.2, 26); } }); };
    runway(RW1, 30, true); runway(RW2, 26, false);
    // grass islands between the runways: five connectors with yellow centre lines and hold bars
    [-215, -120, -20, 80, 180].forEach(lx => { L(lx - 7, lx + 7, RW2[3], RW1[2], ASPH, 0.5); M(lx - 0.22, lx + 0.22, RW2[3], RW1[2], YEL); [RW2[3] + 4, RW1[2] - 5].forEach(hz => M(lx - 7, lx + 7, hz, hz + 0.5, YEL)); });
    // ---- north apron round the hangars (east half), connectors down to the upper runway ----
    L(NAP[0], NAP[1], NAP[2], NAP[3], PAVE, 0.54); [10, 110, 205].forEach(lx => { L(lx - 7, lx + 7, NAP[3], RW2[2], PAVE2, 0.52); M(lx - 0.22, lx + 0.22, NAP[3] - 6, RW2[2], YEL, 0.56); });
    M(NAP[0] + 3, NAP[1] - 3, NAP[3] - 7, NAP[3] - 6.6, YEL, 0.57); for (let x = NAP[0] + 22; x < NAP[1] - 10; x += 34) M(x, x + 0.4, NAP[3] - 30, NAP[3] - 7, YEL, 0.57);
    [[-10, -192, '#5d6064', '#3d4044'], [38, -192, '#b6b1a4', '#8c8778'], [86, -192, '#7c8f9b', '#56646e'], [178, -176, '#5e8099', '#3d566b']].forEach(([hx, hz, c1, c2]) => put(B, 'hangar', hx, hz, 0, KH, { hangar_blue: c1, hangar_trim: c2 }, 0.54));
    put(B, 'control_tower', 130, -160, 0, KTW, null, 0.54); put(B, 'admin_building', 222, -150, 0, 1.6, null, 0.54);
    [[-10, -150, 0.15], [38, -148, -0.1], [86, -152, 0.2], [178, -136, -0.15], [60, -128, Math.PI / 2 + 0.3], [150, -128, Math.PI / 2]].forEach(([x, z, a]) => put(B, 'jet_fighter', x, z, a, KJ, null, 0.54));
    [[12, -160, 0], [20, -160, 0], [62, -158, 0], [108, -140, Math.PI / 2], [120, -132, Math.PI / 2], [200, -140, 0], [-20, -130, Math.PI / 2], [240, -130, 0]].forEach(([x, z, a], i) => { if (!fast || i % 2 === 0) put(B, i % 3 === 1 ? 'support_truck_fuel' : 'support_truck_cargo', x, z, a, KT, null, 0.54); });
    // ---- radar + comms corner (north-east, along the back fence) and the admin building at the east end ----
    put(B, 'radar_dome', 122, -232, 0, 3.0); put(B, 'radar_dome', 214, -232, 0, 2.6); put(B, 'radar_dome', 244, -206, 0, 2.2);
    put(B, 'satellite_dish', 150, -228, 0.4, 2.4); put(B, 'satellite_dish', 178, -230, -0.3, 2.4); put(B, 'satellite_dish', 262, -180, -0.8, 2.0);
    put(B, 'comms_tower', 196, -232, 0, 3.4); put(B, 'comms_tower', 262, -150, 0.4, 3.0); L(230, 270, -112, -76, PAVE2, 0.42); put(B, 'admin_building', 252, -94, -Math.PI / 2, 2.8, null, 0.42);
    // ---- the big fighter apron (south-west): helipads at the west end, two rows of fighters angled to the runway, trucks between ----
    L(SAP[0], SAP[1], SAP[2], SAP[3], PAVE, 0.54); [-200, -60, 60].forEach(lx => { L(lx - 7, lx + 7, RW1[3], SAP[2], PAVE2, 0.52); M(lx - 0.22, lx + 0.22, RW1[3], SAP[2] + 6, YEL, 0.56); });
    M(SAP[0] + 3, SAP[1] - 3, SAP[2] + 5, SAP[2] + 5.4, YEL, 0.57);
    [[-240, 40], [-240, 78]].forEach(([x, z], i) => { M(x - 12, x + 12, z - 12, z - 11.6, WHITE, 0.58); M(x - 12, x + 12, z + 11.6, z + 12, WHITE, 0.58); M(x - 12, x - 11.6, z - 12, z + 12, WHITE, 0.58); M(x + 11.6, x + 12, z - 12, z + 12, WHITE, 0.58); put(B, 'helicopter', x, z, Math.PI + 0.6, KHE, null, 0.54); });
    const NOSE = Math.PI + 0.6; for (let row = 0; row < 2; row++) for (let k = 0; k < (fast ? 4 : 6); k++) { const x = -190 + k * (fast ? 52 : 36) + row * 14, z = 42 + row * 44;
      put(B, 'jet_fighter', x, z, NOSE, KJ, null, 0.54); M(x - 9, x + 9, z + 10, z + 10.4, WHITE, 0.58); M(x - 9, x - 8.6, z - 10, z + 10.4, WHITE, 0.58); M(x + 8.6, x + 9, z - 10, z + 10.4, WHITE, 0.58);
      if (!fast || k % 2 === 0) put(B, (k + row) % 3 === 0 ? 'support_truck_fuel' : 'support_truck_cargo', x + 14, z + 18, NOSE, KT, null, 0.54); }
    put(B, 'cargo_plane', 50, 70, NOSE, KC, null, 0.54);
    // ---- fenced support yard (south-east): workshop, two blocks, yellow trucks in a row ----
    L(SEC[0], SEC[1], SEC[2], SEC[3], PAVE2, 0.46); put(B, 'hangar', 170, 75, -Math.PI / 2, KH * 0.85, { hangar_blue: '#6a6c70', hangar_trim: '#45474b' }, 0.46);
    put(B, 'admin_building', 236, 52, 0, 2.2, null, 0.46); put(B, 'admin_building', 240, 106, -Math.PI / 2, 1.8, null, 0.46);
    for (let i = 0; i < (fast ? 3 : 5); i++) put(B, 'support_truck_cargo', 200 + i * 7, 122, 0, KT, null, 0.46);
    // ---- gate (south-west corner of the apron): Dev's guardhouse + barrier, the sign by the road ----
    L(GATE2[0] - 5, GATE2[0] + 5, SAP[3], GATE2[1] + 2, '#5f6266', 0.46); put(B, 'guardhouse', GATE2[0] + 9, GATE2[1] - 3, Math.PI, 1.7);
    { const tex = signTex([['VINLAND AIR FORCE BASE', 0.36, 0.42], ['AUTHORISED ENTRY ONLY', 0.2, 0.78]], 1024, 256, '#2e3f55', '#f4efe2'), gx = C.x + GATE2[0] - 18, gz = C.z + GATE2[1] + 7;
      box(B, '#8f9294', null, 0.3, 4.2, 0.3, gx - 6, 0.3, gz); box(B, '#8f9294', null, 0.3, 4.2, 0.3, gx + 6, 0.3, gz); box(B, '#2e3f55', null, 12.2, 3.1, 0.2, gx, 2.2, gz - 0.15);
      if (tex) { const sm = new T.Mesh(new T.PlaneGeometry(12, 3), new T.MeshLambertMaterial({ map: tex })); sm.position.set(gx, 3.75, gz + 0.02); g.add(sm); } }
    // ---- watchtowers: corners, mid-sides, by the gate ----
    [[FX0, FZ0], [FX1, FZ0], [FX1, FZ1], [FX0, FZ1], [0, FZ0], [FX0, -50], [FX1, -50], [GATE2[0] - 14, FZ1], [110, FZ1], [110, 28]].forEach(([x, z]) => put(B, 'watchtower', x + (x <= FX0 ? 4 : x >= FX1 ? -4 : 0), z + (z <= FZ0 ? 4 : z >= FZ1 ? -4 : 0), 0, 1.8));
    let tris = B.build(g);
    // ---- fence: Dev's panel along the outer line + the support yard's own fence (instanced), gap at the gate ----
    { const F = [], step = fast ? 24 : 12.5, lines = [[[FX0, FZ0], [FX1, FZ0], [FX1, FZ1], [FX0, FZ1], [FX0, FZ0]], [[105, FZ1], [105, 22], [FX1, 22]]];
      lines.forEach(P => { for (let k = 0; k < P.length - 1; k++) { const [x0, z0] = P[k], [x1, z1] = P[k + 1], Ln = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(Ln / step)), a = Math.atan2(z0 - z1, x1 - x0);
        for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (Math.abs(x - GATE2[0]) < 8 && Math.abs(z - GATE2[1]) < 1) continue; if (Math.abs(x - 105) < 1 && Math.abs(z - 60) < 9) continue; F.push({ x: C.x + x, z: C.z + z, r: a, sx: (Ln / n) / 6.11, sy: 1.15, sz: 1 }); } } });
      many(g, 'fencing', F, fast, false); tris += F.length * 276; }
    // ---- forest: Dev's pines + broadleaf trees in thick clumps all round, like the picture ----
    { const TP = [], TB = [], N = fast ? 350 : 2300;
      const dB = (x, z) => { const lx = x - C.x, lz = z - C.z; return Math.hypot(Math.max(FX0 - lx, lx - FX1, 0), Math.max(FZ0 - lz, lz - FZ1, 0)); };
      const ok = (x, z) => !inFence(x - C.x, z - C.z, 34) && !nearRoad(x, z, 12) && z > -775 && !(z > 520 && x > -6650 && x < -5200);
      for (let i = 0; i < N * 20 && TP.length + TB.length < N; i++) { const x = C.x - 560 + R2() * 1120, z = C.z - 540 + R2() * 1000, d = dB(x, z); if (d < 34 || d > 250) continue; if (noise(x / 45, z / 45, 7) < 0.22 + d / 1000) continue; if (!ok(x, z)) continue;
        (R2() < 0.62 ? TP : TB).push({ x, z, r: R2() * 6.28, s: 2.3 + R2() * 1.0 }); }
      [[-150, -175, 40, 30], [-230, -160, 20, 30], [-255, 0, 14, 60]].forEach(([cx, cz, rx, rz]) => { for (let i = 0; i < (fast ? 5 : 14); i++) { const x = cx + (R2() - 0.5) * rx * 2, z = cz + (R2() - 0.5) * rz * 2; (R2() < 0.6 ? TP : TB).push({ x: C.x + x, z: C.z + z, r: R2() * 6.28, s: 1.8 + R2() * 0.6 }); } });
      many(g, 'pine_tree', TP, fast, true); many(g, 'broadleaf_tree', TB, fast, true); tris += TP.length * 108 + TB.length * 144; g.userData.treeCount = TP.length + TB.length; }
    g.traverse(m => { if (!m.isMesh || m.userData.inst) return; m.receiveShadow = !fast; m.castShadow = !fast && !(m.material && m.material.transparent); });
    g.userData.tris = tris; g.userData.zone = Z; g.userData.gate = GATE; return g; }

  root.VinlandForces = { forces, Z, GATE, hillH, C };
})(window);
