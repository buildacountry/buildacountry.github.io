// VINLAND FORCES (Dev, 26 Nov 2026): one fenced zone on the empty west coast: Army base, Air Force airstrip, Navy harbour, gate, hills round it.
// Same land the army reel marked: x -2700..-1700, z -800..-210, sea on the north (z < -820), gate on the east fence at (-1700, -420).
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

  // ---------- the masterplan (generated from studio tools/forces/plan_v5.json; do not edit by hand) ----------
  const PLAN = {"OUTER": [-3500, -1700, -818, -60], "BASES": {"navy": {"name": "VINLAND NAVAL BASE", "fence": [-3480, -2360, -808, -452], "fill": "#a3a98c", "bld": "#3f5468"}, "army": {"name": "VINLAND ARMY BASE  (Cantonment)", "fence": [-2320, -1772, -808, -452], "fill": "#9aa06a", "bld": "#5d6b3a"}, "armyS": {"name": "ARMY BASE  (Vehicle + Training Area)", "fence": [-2320, -1772, -402, -78], "fill": "#9aa06a", "bld": "#5d6b3a"}, "air": {"name": "VINLAND AIR FORCE BASE", "fence": [-3480, -2360, -402, -78], "fill": "#b4b08a", "bld": "#6a6e74"}}, "ROADS": [[-1640, -900, -426, -414, "main"], [-3480, -1640, -430, -410, "blvd"], [-3494, -3488, -812, -66, "patrol"], [-3494, -1706, -72, -66, "patrol"], [-1712, -1706, -812, -66, "patrol"], [-2706, -2694, -452, -730, "main"], [-3440, -2380, -730, -720, "main"], [-3440, -2706, -655, -645, "serv"], [-3468, -3460, -730, -460, "serv"], [-3468, -2380, -468, -460, "serv"], [-2388, -2380, -730, -460, "serv"], [-2022, -1998, -452, -610, "avenue"], [-2308, -1780, -478, -470, "serv"], [-2308, -2300, -800, -470, "serv"], [-1788, -1780, -800, -470, "serv"], [-2308, -1780, -804, -796, "serv"], [-2300, -2100, -658, -650, "serv"], [-1920, -1788, -658, -650, "serv"], [-2106, -2098, -740, -478, "serv"], [-1922, -1914, -740, -478, "serv"], [-2016, -2004, -402, -95, "main"], [-2308, -1780, -394, -386, "serv"], [-2308, -2300, -394, -95, "serv"], [-1788, -1780, -394, -95, "serv"], [-2308, -1780, -103, -95, "serv"], [-2300, -1788, -236, -224, "main"], [-2426, -2414, -402, -300, "main"], [-2560, -2414, -306, -298, "serv"], [-2568, -2560, -400, -250, "serv"], [-3470, -2370, -88, -82, "patrol"], [-3470, -3464, -330, -82, "patrol"]], "ROUNDABOUT": [-2010, -420, 34, 15], "AIR": {"runway": [-3390, -2490, -168, -123], "resa": [[-3480, -3390, -168, -123], [-2490, -2400, -168, -123]], "strip": [-3480, -2400, -213, -78], "taxiway": [-3380, -2500, -245, -226], "links": [[-3380, -168, -226], [-2500, -168, -226]], "rapid": [[-3080, -2990], [-2840, -2750]], "apron": [-3200, -2600, -328, -245], "has_link": [-3440, -3220, -265, -245]}, "NAVY": {"basin": [[-3360, -1200], [-2760, -1200], [-2650, -1080], [-2660, -818], [-3360, -818]], "breakwaters": [[-3380, -3360, -1220, -818], [-3380, -2760, -1220, -1200], [-2660, -2640, -1080, -818]], "lights": [[-2760, -1210], [-2650, -1088]], "turning": [-3020, -1065, 125], "quay": [-3360, -2640, -818, -735], "piers": [[-3280, -3260, -940, -818, "Fuel + ammo pier"], [-3130, -3105, -960, -818, "Pier 2"], [-2960, -2935, -960, -818, "Pier 3"], [-2800, -2785, -900, -818, "Small craft"]], "drydock": [-2560, -2500, -818, -610]}, "GATES": [[-1730, -420, "MAIN ENTRY CONTROL POINT", [-1766, -1746, -470, -444]], [-2700, -452, "Navy gate", [-2730, -2712, -490, -470]], [-2010, -452, "Army gate", [-2050, -2030, -490, -470]], [-2010, -402, "Army depot gate", [-2050, -2030, -370, -350]], [-2420, -402, "Air Force gate", [-2460, -2440, -370, -350]]], "ECP": {"canopy": [-1765, -1725, -436, -404], "search": [-1765, -1715, -396, -366], "visitor": [-1690, -1640, -480, -446], "vpark": [-1690, -1640, -510, -486], "serpentine": [[-1680, -426], [-1666, -420], [-1652, -426], [-1638, -420], [-1624, -426]]}, "TOWERS": [[-3500, -818], [-3500, -500], [-3500, -60], [-3200, -60], [-2900, -60], [-2600, -60], [-2300, -60], [-2000, -60], [-1700, -60], [-1700, -250], [-1700, -600], [-1700, -818], [-1718, -446], [-1718, -394], [-3380, -1220], [-2640, -818], [-2360, -818]], "B": [[1, "army", "Army HQ: 160 x 45 m, 4 floors + 26 m flag tower, forecourt", -2090, -1930, -792, -747, 26], [2, "army", "Parade ground 160 x 115 m + reviewing stand", -2090, -1930, -730, -615, 0], [3, "army", "Barracks quad W1 (3 blocks, 3 floors, courtyard)", -2290, -2150, -790, -670, 10], [4, "army", "Barracks quad W2", -2290, -2150, -640, -490, 10], [5, "army", "Barracks quad E1", -1900, -1795, -790, -670, 10], [6, "army", "Barracks quad E2", -1900, -1795, -640, -490, 10], [7, "army", "Dining hall", -2140, -2110, -605, -545, 7], [8, "army", "Sports hall + gym", -1910, -1928, -605, -545, 9], [9, "army", "Medical centre", -2090, -2040, -540, -495, 7], [10, "army", "Admin + records", -1980, -1930, -540, -495, 7], [11, "armyS", "Vehicle sheds 260 x 20 m (open front)", -2290, -2030, -380, -360, 7], [12, "armyS", "Wheeled vehicle hardstand (trucks, APCs)", -2290, -2030, -355, -300, 0], [13, "armyS", "Tank sheds 200 x 22 m", -1990, -1795, -380, -358, 8], [14, "armyS", "Tank hardstand (2 rows, 8 m lanes)", -1990, -1795, -353, -300, 0], [15, "armyS", "Vehicle workshop 100 x 45 m", -2290, -2190, -290, -245, 14], [16, "armyS", "Wash rack + fuel point (exit side)", -2175, -2110, -290, -250, 6], [17, "armyS", "Equipment stores", -2095, -2030, -290, -245, 9], [18, "armyS", "Tank workshop", -1990, -1900, -290, -245, 14], [19, "armyS", "Armoury (earth berms)", -1880, -1800, -290, -250, 5], [20, "armyS", "Obstacle course", -2290, -2150, -215, -112, 0], [21, "armyS", "Drill field", -2140, -2030, -215, -112, 0], [22, "armyS", "Firing range + target berm", -1990, -1795, -215, -108, 0], [23, "air", "Hangar 1: 80 x 70 m, 22 m high", -3190, -3110, -400, -330, 22], [24, "air", "Hangar 2", -3085, -3005, -400, -330, 22], [25, "air", "Hangar 3", -2980, -2900, -400, -330, 22], [26, "air", "Hangar 4", -2875, -2795, -400, -330, 22], [27, "air", "Maintenance hangar 110 x 70 m", -2770, -2660, -400, -330, 24], [28, "air", "Control tower 38 m + ops base", -2595, -2570, -300, -275, 38], [29, "air", "Crash fire station (doors to taxiway)", -2560, -2495, -290, -250, 9], [30, "air", "Air Force HQ + squadron ops", -2550, -2440, -395, -345, 9], [31, "air", "Hardened aircraft shelters (4)", -3450, -3230, -320, -268, 10], [32, "air", "Fuel farm (bermed)", -3470, -3300, -400, -338, 9], [33, "air", "Radar tower", -2405, -2385, -280, -260, 24], [34, "air", "Airmen quarters", -2400, -2370, -395, -330, 10], [35, "navy", "Naval HQ 120 x 70 m (courtyard)", -2685, -2565, -545, -475, 12], [36, "navy", "Warehouse 1 (120 x 50 m, truck docks)", -3300, -3180, -712, -662, 12], [37, "navy", "Warehouse 2", -3160, -3040, -712, -662, 12], [38, "navy", "Warehouse 3", -3020, -2900, -712, -662, 12], [39, "navy", "Ship repair hall 110 x 110 m", -2490, -2390, -715, -610, 20], [40, "navy", "Dockyard workshops", -2490, -2390, -595, -530, 12], [41, "navy", "Harbour control + signal tower", -2630, -2600, -790, -760, 22], [42, "navy", "Sailors quarters (3 blocks, 4 floors)", -3300, -3020, -560, -480, 13], [43, "navy", "Helipad + drill square", -2990, -2880, -560, -480, 0], [44, "navy", "Fuel depot (pipe to fuel pier)", -3460, -3380, -712, -600, 9], [45, "navy", "Ammunition magazine (berms)", -3460, -3380, -580, -480, 5], [46, "navy", "Container yard + 2 portal cranes", -3200, -2900, -800, -745, 0], [47, "shared", "Visitor centre + pass office (+ parking)", -1690, -1640, -480, -446, 6], [48, "shared", "Truck search bay", -1765, -1715, -396, -366, 6]], "SHIPS": [["Destroyer", -3300, -890], ["Frigate", -3240, -895], ["Frigate", -3150, -900], ["Subs x2", -3085, -905], ["Landing ship", -2985, -905], ["Patrol boats", -2830, -870], ["Frigate in dock", -2540, -700]]};

  // ---------- v5 parts: real-size military architecture ----------
  // facade helper: a plan rectangle + the side its doors face -> centre, facade length w, depth d, rotation
  const fr = (x0, x1, z0, z1, face) => { const x = (x0 + x1) / 2, z = (z0 + z1) / 2, ew = face === 'E' || face === 'W';
    return { x, z, w: ew ? z1 - z0 : x1 - x0, d: ew ? x1 - x0 : z1 - z0, ry: { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[face || 'S'] }; };
  const blockB = (B, r, face, fl, wall, roof, ex, fast) => { const f = fr(...r, face); building(B, Object.assign({ x: f.x, z: f.z, w: f.w, d: f.d, ry: f.ry, fl, wall, roof }, ex || {}), fast); };
  function gambrelGeo(w, h, len) { const s = new T.Shape(), hw = h * 0.62; s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, hw); s.lineTo(w * 0.28, h); s.lineTo(-w * 0.28, h); s.lineTo(-w / 2, hw); s.lineTo(-w / 2, 0);
    return new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2); }
  // big aircraft hangar: gambrel roof, wall-to-wall door opening on the apron side, side annex with offices
  function bigHangar(B, x0, x1, z0, z1, h, fast) { const w = x1 - x0, len = z1 - z0, b = at((x0 + x1) / 2, G, (z0 + z1) / 2, 0), C = '#a7a194', DK = '#2d2f33';
    box(B, CONC, b, w + 1.2, 0.5, len + 1.2, 0, 0, 0); B.add(gambrelGeo(w, h, len), C, b, 0, 0.5, 0);
    B.add(gambrelGeo(w + 0.6, 1.2, len - 4), '#8c877c', b, 0, h * 0.62 + 0.5 - 1.2 + 0.0, 0, 1, 1, 1);                          // eave band
    box(B, '#1c1e21', b, w * 0.86, h * 0.62 - 1.5, 0.4, 0, 0.5, len / 2 - 0.15);                                                         // the open door (dark, recessed)
    box(B, '#6e6a62', b, w * 0.86 + 2, 1.4, 1.2, 0, h * 0.62 - 1.0, len / 2 - 0.4); [-1, 1].forEach(sd => box(B, '#6e6a62', b, 1.4, h * 0.62 - 0.5, 1.4, sd * (w * 0.43 + 0.7), 0.5, len / 2 - 0.4));
    for (let k = 0; k < 6; k++) box(B, '#8c877c', b, w * 0.86 / 6 - 0.6, h * 0.62 - 1.8, 0.3, -w * 0.43 + (k + 0.5) * w * 0.86 / 6, 0.5, len / 2 - 4.5 - (k % 2) * 2);   // folded door leaves inside
    if (!fast) for (let z = -len / 2 + 8; z < len / 2 - 6; z += 10) [-1, 1].forEach(sd => box(B, 'glass', b, 0.2, 1.2, 6, sd * (w / 2 + 0.05), h * 0.62 - 3, z));   // clerestory windows
    box(B, '#d9c398', b, 10, 7, len * 0.6, w / 2 + 5, 0.5, -len * 0.1); box(B, '#6c7177', b, 10.6, 0.5, len * 0.6 + 0.6, w / 2 + 5, 7.5, -len * 0.1);   // office annex
    box(B, '#3b2f26', b, 1.4, 2.4, 0.2, w / 2 + 5, 0.5, len * 0.2 + 0.05); for (let z = -len * 0.35; z < len * 0.15; z += 5) box(B, 'glass', b, 0.2, 1.3, 2.2, w / 2 + 10.05, 3.0, z);
    box(B, '#e2c44a', b, w * 0.86, 0.06, 0.6, 0, 0.5, len / 2 + 3); }
  function shelter(B, x, z, fast) { const b = at(x, G, z, 0); box(B, CONC, b, 30, 0.4, 44, 0, 0, 0); B.add(archGeo(26, 9.5, 40), '#9c988c', b, 0, 0.4, 0); box(B, '#5a5c58', b, 20, 6.8, 0.6, 0, 0.4, 19.8);
    B.add(archGeo(27, 10, 3), '#8a867a', b, 0, 0.4, 19); B.add(archGeo(27, 10, 3), '#8a867a', b, 0, 0.4, -19); }
  // control tower 38 m: two-storey ops base, square shaft, glass cab with a balcony, mast
  function bigTower(B, x0, x1, z0, z1) { const b = at((x0 + x1) / 2, G, (z0 + z1) / 2, 0), w = x1 - x0;
    box(B, '#a8a396', b, w + 1, 0.4, w + 1, 0, 0, 0); box(B, '#d9c398', b, w, 7, w, 0, 0.4, 0); box(B, '#6c7177', b, w + 0.8, 0.5, w + 0.8, 0, 7.4, 0);
    for (let k = -2; k <= 2; k++) { box(B, 'glass', b, 2, 1.4, 0.2, k * 4.4, 3.0, w / 2 + 0.02); box(B, 'glass', b, 2, 1.4, 0.2, k * 4.4, 3.0, -w / 2 - 0.02); }
    box(B, '#3b2f26', b, 1.8, 2.6, 0.2, 0, 0.4, w / 2 + 0.05); box(B, '#c9b48a', b, 7, 24, 7, 0, 7.9, 0); for (let y = 10; y < 31; y += 4) box(B, 'glass', b, 0.8, 1.6, 7.1, 0, y, 0);
    box(B, '#3b3d41', b, 12.5, 0.6, 12.5, 0, 31.9, 0); box(B, '#e6e1d3', b, 12.6, 0.9, 12.6, 0, 32.5, 0); box(B, 'glass', b, 11, 3.6, 11, 0, 33.4, 0); box(B, '#3b3d41', b, 12, 0.6, 12, 0, 37, 0);
    box(B, '#d6302a', b, 0.3, 6, 0.3, 0, 37.6, 0); box(B, '#e6e1d3', b, 2.4, 1.6, 2.4, 3, 37.6, 3); }
  // crash fire station: red trim, one bay door per 9 m facing the taxiway, watch room on top
  function fireStation(B, x0, x1, z0, z1, fast) { const w = x1 - x0, d = z1 - z0, b = at((x0 + x1) / 2, G, (z0 + z1) / 2, 0), RED = '#b8382e', n = Math.floor((w - 14) / 9);
    box(B, '#a8a396', b, w + 1, 0.4, d + 1, 0, 0, 0); box(B, '#ddd5c4', b, w, 8, d, 0, 0.4, 0); box(B, RED, b, w + 0.4, 0.9, d + 0.4, 0, 8.4, 0); box(B, '#8c8e8c', b, w - 0.6, 0.35, d - 0.6, 0, 9.05, 0);
    for (let k = 0; k < n; k++) { const px = -w / 2 + 5 + k * 9 + 4; box(B, RED, b, 7.4, 6.4, 0.2, px, 0.4, d / 2 + 0.02); box(B, '#c9c6bd', b, 6.6, 5.8, 0.3, px, 0.4, d / 2 + 0.06); for (let j = 0; j < 5; j++) box(B, '#a8a59c', b, 6.6, 0.08, 0.36, px, 1.4 + j * 1.0, d / 2 + 0.08); }
    box(B, '#ddd5c4', b, 9, 5, 9, w / 2 - 7, 9.3, 0); box(B, 'glass', b, 9.2, 1.5, 9.2, w / 2 - 7, 11.6, 0); box(B, RED, b, 9.6, 0.7, 9.6, w / 2 - 7, 14.3, 0);
    box(B, '#8c8e8c', b, w, 0.12, 12, 0, -0.05 + 0.18, d / 2 + 6.5); }
  // open-front vehicle shed: back wall, steel columns along the front, mono-pitch roof
  function shed(B, x0, x1, z0, z1, fast) { const w = x1 - x0, d = z1 - z0, b = at((x0 + x1) / 2, G, (z0 + z1) / 2, 0), S2 = '#6c7177';
    box(B, '#9a9c96', b, w, 0.25, d, 0, 0.0, 0); box(B, '#a8987a', b, w, 6.2, 0.6, 0, 0.25, -d / 2 + 0.3); [-1, 1].forEach(sd => box(B, '#a8987a', b, 0.6, 6.2, d, sd * (w / 2 - 0.3), 0.25, 0));
    for (let x = -w / 2 + 6; x < w / 2 - 3; x += 12) box(B, S2, b, 0.4, 7.0, 0.4, x, 0.25, d / 2 - 0.6);
    B.add(BOXC, '#7b7f84', b, 0, 7.0, 0, w + 1.2, 0.35, d + 2.0, -0.09, 0, 0); box(B, '#e2c44a', b, w, 0.05, 0.3, 0, 0.26, d / 2 + 0.5); }
  // warehouse with a loading dock (raised platform + roller doors) on the road side (north)
  function warehouse(B, x0, x1, z0, z1, h, fast) { const w = x1 - x0, d = z1 - z0, b = at((x0 + x1) / 2, G, (z0 + z1) / 2, Math.PI), WL = '#a8987a';
    box(B, '#a8a396', b, w + 1, 0.4, d + 1, 0, 0, 0); box(B, WL, b, w, h, d, 0, 0.4, 0); B.add(prismGeo(d + 1.4, 0.12 * (d + 1.4), w + 1.4), '#7b7f84', b, 0, 0.4 + h, 0, 1, 1, 1, 0, Math.PI / 2, 0);
    box(B, '#9a9c96', b, w - 6, 1.2, 4, 0, 0.4, d / 2 + 2); for (let k = 0; k < Math.floor(w / 15); k++) { const px = -w / 2 + 9 + k * 15; box(B, '#c9c6bd', b, 4.4, 4.6, 0.3, px, 1.6, d / 2 + 0.05); box(B, '#6c7177', b, 6, 0.3, 3, px, 6.6, d / 2 + 1.5); box(B, '#2a2c2e', b, 0.4, 1.1, 0.3, px - 2.6, 0.5, d / 2 + 4.05); box(B, '#2a2c2e', b, 0.4, 1.1, 0.3, px + 2.6, 0.5, d / 2 + 4.05); }
    if (!fast) for (let x = -w / 2 + 4; x < w / 2 - 3; x += 6) box(B, 'glass', b, 3.6, 1.0, 0.2, x, h - 1.6, -d / 2 - 0.02);
    box(B, '#3b2f26', b, 1.4, 2.4, 0.2, w / 2 - 4, 0.4, d / 2 + 0.05); }
  // big tall hall (workshops, ship repair): gable roof, giant door on one side, crane beam over the yard
  function hall(B, x0, x1, z0, z1, h, face, fast, col) { const f = fr(x0, x1, z0, z1, face), b = at(f.x, G, f.z, f.ry), w = f.w, d = f.d, WL = col || '#a8987a';
    box(B, '#a8a396', b, w + 1, 0.4, d + 1, 0, 0, 0); box(B, WL, b, w, h, d, 0, 0.4, 0); B.add(prismGeo(d + 1.4, 0.16 * (d + 1.4), w + 1.4), '#6c7177', b, 0, 0.4 + h, 0, 1, 1, 1, 0, Math.PI / 2, 0);
    const dw = Math.min(w * 0.55, 40), dh = Math.min(h - 3, 16); box(B, '#2d2f33', b, dw, dh, 0.3, 0, 0.4, d / 2 + 0.03); box(B, '#6e6a62', b, dw + 2, 1.2, 0.8, 0, dh + 0.4, d / 2 + 0.2);
    for (let k = 0; k < 4; k++) box(B, '#c9c6bd', b, dw / 4 - 0.4, dh - 0.6, 0.3, -dw / 2 + (k + 0.5) * dw / 4, 0.4, d / 2 - 2 - (k % 2));
    if (!fast) for (let x = -w / 2 + 4; x < w / 2 - 3; x += 5) { box(B, 'glass', b, 3.2, 1.6, 0.2, x, h - 3, -d / 2 - 0.02); }
    for (let z = -d / 2 + 4; z < d / 2 - 3; z += 6) [-1, 1].forEach(sd => box(B, 'glass', b, 0.2, 1.6, 3.6, sd * (w / 2 + 0.02), h - 3, z)); box(B, '#3b2f26', b, 1.4, 2.4, 0.2, w / 2 - 5, 0.4, d / 2 + 0.05); }
  // army HQ: H-plan, 4 floors, central portico + 26 m flag tower, wings either side
  function armyHQ(B, x0, x1, z0, z1, fast) { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W2 = x1 - x0, D = z1 - z0, STONE = '#d9c398', ROOFC = '#5b6066';
    building(B, { x: cx, z: cz, w: 64, d: D - 10, fl: 4, wall: STONE, roof: ROOFC, doors: 3, path: 4, flat: true }, fast);
    [-1, 1].forEach(sd => building(B, { x: cx + sd * (W2 / 2 - 24), z: cz, w: 48, d: D, fl: 3, wall: STONE, roof: ROOFC, doors: 2, path: 4 }, fast));
    [-1, 1].forEach(sd => building(B, { x: cx + sd * 38, z: cz - 6, w: 12, d: D - 20, fl: 3, wall: '#cdb78c', roof: ROOFC, doors: 0, win: false, flat: true }, fast));
    const b = at(cx, G, cz + (D - 10) / 2, 0); box(B, '#c9b48a', b, 26, 0.6, 9, 0, 0, 4.2); for (let k = 0; k < 6; k++) box(B, '#efe6d0', b, 1.3, 11.5, 1.3, -11 + k * 4.4, 0.6, 7.6); box(B, '#efe6d0', b, 27, 1.6, 9.5, 0, 12.1, 4.2); B.add(prismGeo(9.5, 3, 27), '#efe6d0', b, 0, 13.7, 4.2, 1, 1, 1, 0, Math.PI / 2, 0);
    const t = at(cx, G, cz - 4, 0); box(B, STONE, t, 9, 26, 9, 0, 0, 0); box(B, ROOFC, t, 10, 0.6, 10, 0, 26, 0); B.add(new T.ConeGeometry(6.6, 5, 4), ROOFC, t, 0, 29, 0, 1, 1, 1, 0, Math.PI / 4, 0); box(B, '#e9e4d8', t, 0.2, 9, 0.2, 0, 31, 0); box(B, '#4b5d32', t, 0.06, 2.4, 4, 0, 37.2, 2.0);
    [-1, 1].forEach(sd => box(B, '#2a2c2e', t, 0.2, 3.4, 3.4, sd * 4.52, 19, 0)); }
  // barracks quad: two long blocks + an end block round a courtyard, open on one side ('E' or 'W')
  function barracksQuad(B, x0, x1, z0, z1, open, fast, r) { const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, endX = open === 'E' ? x0 + 9 : x1 - 9, WL = WALL[(r() * 3) | 0];
    building(B, { x: cx, z: z0 + 8, w, d: 16, fl: 3, wall: WL, roof: ROOF, ry: 0, doors: 3, path: 6 }, fast);
    building(B, { x: cx, z: z1 - 8, w, d: 16, fl: 3, wall: WL, roof: ROOF, ry: Math.PI, doors: 3, path: 6 }, fast);
    building(B, { x: endX, z: (z0 + z1) / 2, w: d - 34, d: 18, fl: 3, wall: WL, roof: ROOF2, ry: open === 'E' ? Math.PI / 2 : -Math.PI / 2, doors: 2, path: 6 }, fast);
    slab(B, '#c2bba6', x0 + (open === 'E' ? 20 : 4), x1 - (open === 'E' ? 4 : 20), z0 + 22, z1 - 22, 0.3, 0.36);   // paved courtyard
    slab(B, '#7d9a55', cx - 16, cx + 16, (z0 + z1) / 2 - 10, (z0 + z1) / 2 + 10, 0.36, 0.42); }
  // gatehouse complex on a north-south entry road that crosses a fence at z = fz (dir +1: base lies north of the fence, -1: south)
  function entryGate(B, g, x, fz, dir, name, gh, fast) { const zc = fz - dir * 30, b = at(x, G, zc, 0);
    [-1, 1].forEach(sd => box(B, '#9c988c', b, 1.0, 6.6, 1.0, sd * 8, 0, -7)); [-1, 1].forEach(sd => box(B, '#9c988c', b, 1.0, 6.6, 1.0, sd * 8, 0, 7));
    box(B, '#e6e1d3', b, 19, 1.0, 17, 0, 6.6, 0); [-1, 1].forEach(sd => { box(B, '#b8382e', b, 19.2, 0.6, 0.3, 0, 6.8, sd * 8.55); box(B, '#b8382e', b, 0.3, 0.6, 17.2, sd * 9.55, 6.8, 0); });                                         // canopy over both lanes
    box(B, '#d9c398', b, 2.4, 3, 6, 0, 0.0, 0); box(B, 'glass', b, 2.5, 1.2, 5.6, 0, 1.4, 0);                                               // sentry island between lanes
    barrier(B, x - 7.4, zc - dir * 7.5, 6.6, Math.PI / 2); barrier(B, x + 7.4, zc + dir * 7.5, 6.6, -Math.PI / 2);
    if (dir > 0) jersey(B, x - 4, fz + 8, Math.PI / 2, 2);                                       // chicane outside
    const [a0, a1, c0, c1] = gh; building(B, { x: (a0 + a1) / 2, z: (c0 + c1) / 2, w: c1 - c0, d: a1 - a0, fl: 1, wall: '#d9c398', roof: '#5b6066', ry: Math.PI / 2 * (a1 < x ? 1 : -1), doors: 1, path: 3, flat: true }, fast);
    sandbags(B, x - 12, fz - dir * 8, 6, 0); sandbags(B, x + 12, fz - dir * 8, 6, 0);
    const sb = at(x, G, fz, 0); [-1, 1].forEach(sd => box(B, '#5b6066', sb, 1.2, 8.5, 1.2, sd * 10.5, 0, 0)); box(B, '#5b6066', sb, 22, 1.4, 1.0, 0, 7.8, 0);
    const tex = signTex([[name, 0.5, 0.52]], 1024, 120, '#1d2f4a', '#f3ead6');
    if (tex) [[0.52, 0], [-0.52, Math.PI]].forEach(([oz, ry]) => { const pm = new T.Mesh(new T.PlaneGeometry(20, 2.3), new T.MeshBasicMaterial({ map: tex })); pm.position.set(x, G + 6.4, fz + oz); pm.rotation.y = ry; g.add(pm); });
    box(B, '#5b6066', sb, 21, 2.6, 0.9, 0, 5.2, 0); }
  function breakwater(B, x0, x1, z0, z1, fast, r) { slab(B, '#9a968c', x0, x1, z0, z1, -2.0, 2.6); slab(B, '#b9b6ad', x0 + 2, x1 - 2, z0 + 2, z1 - 2, 2.6, 2.75);
    const along = (x1 - x0) > (z1 - z0), L = along ? x1 - x0 : z1 - z0, n = Math.floor(L / (fast ? 9 : 5));
    for (let i = 0; i < n; i++) [-1, 1].forEach(sd => { const t = (i + r()) / n, px = along ? x0 + t * L : (sd < 0 ? x0 - 1.5 : x1 + 1.5), pz = along ? (sd < 0 ? z0 - 1.5 : z1 + 1.5) : z0 + t * L, s = 1.6 + r() * 1.6;
      B.add(new T.IcosahedronGeometry(1, 0), r() < 0.5 ? '#8e8a80' : '#a29e94', null, px, 0.2, pz, s * 1.3, s * 0.8, s, r() * 3, r() * 3, 0); }); }
  function navLight(B, x, z, col) { const b = at(x, 2.75, z, 0); cyl(B, '#e9e4d8', b, 1.6, 6, 0, 0, 0); cyl(B, col, b, 1.7, 1.2, 0, 2.4, 0); cyl(B, col, b, 1.0, 1.6, 0, 6, 0); box(B, '#fff2c4', b, 1.0, 0.8, 1.0, 0, 6.6, 0); }
  function igloo(B, x, z) { const b = at(x, G, z, 0); B.add(archGeo(14, 6, 24), '#6f8a4a', b, 0, 0, 0); box(B, '#9c988c', b, 15, 6.8, 1.6, 0, 0, 12.4); box(B, '#5a5c58', b, 5, 4, 0.3, 0, 0, 13.3); B.add(wedgeGeo(15, 5, 6.5), '#6f8a4a', b, 0, 0, -12, 1, 1, 1, 0, Math.PI / 2, 0); }
  function berm(B, x0, x1, z0, z1) { const h = 3.2, run = 6; const W = (len, x, z, ry) => B.add(wedgeGeo(len, run, h), '#7f8a52', null, x, G, z, 1, 1, 1, 0, ry, 0);
    W(x1 - x0, (x0 + x1) / 2, z0, Math.PI / 2); W(x1 - x0, (x0 + x1) / 2, z1, -Math.PI / 2); W(z1 - z0, x0, (z0 + z1) / 2, Math.PI); W(z1 - z0, x1, (z0 + z1) / 2, 0); }
  function canopy(B, x0, x1, z0, z1, h, col) { const b = at((x0 + x1) / 2, G, (z0 + z1) / 2, 0), w = x1 - x0, d = z1 - z0;
    for (let x = -w / 2 + 2; x <= w / 2 - 2 + 0.01; x += Math.max(8, (w - 4) / Math.max(1, Math.round((w - 4) / 10)))) [-1, 1].forEach(sd => box(B, '#9c988c', b, 0.8, h, 0.8, x, 0, sd * (d / 2 - 2)));
    box(B, col || '#e6e1d3', b, w, 1.0, d, 0, h, 0); [-1, 1].forEach(sd => { box(B, '#b8382e', b, w + 0.2, 0.7, 0.3, 0, h + 0.15, sd * (d / 2 + 0.05)); box(B, '#b8382e', b, 0.3, 0.7, d + 0.2, sd * (w / 2 + 0.05), h + 0.15, 0); }); }
  // container portal crane (straddles a row of containers)
  function gantry(B, x, z, span, ry) { const b = at(x, 1.0, z, ry || 0), c = '#c9a24a';
    [-1, 1].forEach(sd => { box(B, c, b, 1.6, 20, 1.6, sd * span / 2, 0, -6); box(B, c, b, 1.6, 20, 1.6, sd * span / 2, 0, 6); box(B, c, b, 1.6, 1.4, 14, sd * span / 2, 20, 0); box(B, '#3b3d41', b, 2.4, 1.0, 16, sd * span / 2, 0, 0); });
    box(B, c, b, span + 2, 2.2, 3, 0, 20.6, -5); box(B, c, b, span + 2, 2.2, 3, 0, 20.6, 5); box(B, '#e6e1d3', b, 4, 3, 4, span / 2 - 6, 17.4, 0); box(B, '#3b3d41', b, 0.15, 8, 0.15, 0, 12.6, 0); box(B, '#3b3d41', b, 6, 0.8, 2.6, 0, 11.8, 0); }
  function landingShip(B, x, z) { const b = at(x, 0.3, z, 0), C = '#8d98a3'; B.add(hullGeo(120, 22, 2.4, 6), C, b, 0, 0, 0); box(B, '#6f7880', b, 20.5, 0.3, 80, 0, 6, 15);
    box(B, '#c8ced3', b, 18, 10, 22, 0, 6, -30); box(B, '#c8ced3', b, 12, 5, 12, 0, 16, -32); box(B, 'glass', b, 12.2, 1.4, 12.2, 0, 18.6, -32); box(B, '#3b3d41', b, 0.4, 14, 0.4, 0, 21, -32); B.add(new T.IcosahedronGeometry(1.8, 1), '#e9ecef', b, 0, 28, -32);
    box(B, '#f1ead6', b, 0.6, 0.05, 50, 0, 6.32, 20); cyl(B, '#e6e1d3', b, 6, 0.06, 0, 6.32, 40); box(B, '#59636c', b, 16, 8, 1.0, 0, 0, 59.6); }
  function trucksRow(B, x0, x1, z, dir, kind, gap, r, skip) { for (let x = x0; x <= x1; x += gap) { if (r() < skip) continue; kind(B, x + (r() - 0.5) * 0.4, z + (r() - 0.5) * 0.6, dir + (r() - 0.5) * 0.05); } }

  // ---------- the whole complex ----------
  function forces(o = {}) {
    const fast = !!o.fast; FASTMODE = fast; const g = new T.Group(), B = Batch(), r = rng(26112), APP = o.approachEnd == null ? -900 : o.approachEnd;
    const BASES = PLAN.BASES, inBase = (x, z) => Object.values(BASES).some(b => { const [a0, a1, c0, c1] = b.fence; return x > a0 && x < a1 && z > c0 && z < c1; });
    // ---- ground: mown olive grass inside each base, greener landscaped belts between them ----
    { const CELL = fast ? 30 : 20, nx = Math.round((Z.x1 - Z.x0) / CELL), nz = Math.round((Z.z1 - Z.z0) / CELL), pos = [], col = [], idx = [], c1 = new T.Color('#94a75c'), c2 = new T.Color('#b4a874'), belt = new T.Color('#7fa452'), cc = new T.Color();
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = Z.x0 + (Z.x1 - Z.x0) * i / nx, z = Z.z0 + (Z.z1 - Z.z0) * j / nz, n = noise(x / 90, z / 90, 5);
        pos.push(x, G, z); cc.copy(inBase(x, z) ? c1 : belt).lerp(c2, sst((n - 0.5) * 3.2) * (inBase(x, z) ? 0.6 : 0.25)); col.push(cc.r, cc.g, cc.b); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b2 = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b2, b2, c, d); }
      const G2 = new T.BufferGeometry(); G2.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G2.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G2.setIndex(idx); G2.computeVertexNormals();
      const lm = new T.Mesh(G2, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); lm.userData.ground = true; g.add(lm); }
    // ---- roads from the plan ----
    const RC = { blvd: '#4f5155', avenue: '#4f5155', main: '#56585c', serv: '#5f6165', patrol: '#a59b80' };
    PLAN.ROADS.forEach(([x0, x1, z0, z1, k]) => { if (k === 'main' && x1 === -900) { slab(B, RC.main, x0, APP, z0, z1, 0.3, 0.46); return; } slab(B, RC[k], Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1), 0.3, k === 'patrol' ? 0.4 : 0.46); });
    const dashX = (x0, x1, z, step, c) => { if (fast) step *= 2; for (let x = x0; x < x1; x += step) slab(B, c || '#f1ead6', x, x + step * 0.5, z - 0.15, z + 0.15, 0.3, 0.52); };
    const dashZ = (x, z0, z1, step, c) => { if (fast) step *= 2; for (let z = z0; z < z1; z += step) slab(B, c || '#f1ead6', x - 0.15, x + 0.15, z, z + step * 0.5, 0.3, 0.52); };
    // Forces Boulevard: raised planted median with kerbs, lane lines, edge lines
    slab(B, '#c9c6bd', -3480, -1640, -421.3, -418.7, 0.3, 0.62); slab(B, '#7d9a55', -3480, -1640, -421, -419, 0.3, 0.66);
    [-425.5, -414.5].forEach(z => dashX(-3476, -1650, z, 12)); [-429.3, -410.7].forEach(z => slab(B, '#f1ead6', -3480, -1640, z - 0.15, z + 0.15, 0.3, 0.52));
    dashX(-1636, APP - 6, -420, 12);
    // ceremonial avenue: planted median, flags
    slab(B, '#c9c6bd', -2011.3, -2008.7, -610, -452, 0.3, 0.62); slab(B, '#7d9a55', -2011, -2009, -610, -452, 0.3, 0.66);
    // centre lines on the main roads
    PLAN.ROADS.forEach(([x0, x1, z0, z1, k]) => { if (k !== 'main' || x1 === -900) return; const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0); if (ax) dashX(Math.min(x0, x1) + 4, Math.max(x0, x1) - 4, (z0 + z1) / 2, 10); else dashZ((x0 + x1) / 2, Math.min(z0, z1) + 4, Math.max(z0, z1) - 4, 10); });
    // roundabout at the army crossing
    { const [rx, rz, ro, ri] = PLAN.ROUNDABOUT; B.add(new T.CylinderGeometry(ro, ro, 0.17, 40), '#4f5155', null, rx, 0.385, rz); B.add(new T.CylinderGeometry(ri + 0.8, ri + 0.8, 0.4, 32), '#c9c6bd', null, rx, 0.62, rz); B.add(new T.CylinderGeometry(ri, ri, 0.5, 32), '#7d9a55', null, rx, 0.65, rz);
      flagpole(B, rx, rz, 16, '#4b5d32', 0.9); [[-5, 0], [5, 0]].forEach(([dx]) => flagpole(B, rx + dx, rz + 3, 11, dx < 0 ? '#3f5468' : '#6a6e74', 0.9)); }
    // ---- AIR FORCE: runway, safety areas, taxiway, rapid exits, apron, markings ----
    const A = PLAN.AIR;
    { const [x0, x1, z0, z1] = A.runway; slab(B, '#3a3c40', x0, x1, z0, z1, 0.3, 0.5); A.resa.forEach(([a, b2, c, d]) => slab(B, '#b9b59a', a, b2, c, d, 0.3, 0.4));
      for (let x = x0 + 70; x < x1 - 70; x += 40) slab(B, '#f3ead6', x, x + 20, -145.9, -145.1, 0.3, 0.56);
      [x0 + 4, x1 - 34].forEach(xx => { for (let k = 0; k < 8; k++) [-1, 1].forEach(sd => slab(B, '#f3ead6', xx, xx + 30, -145.5 + sd * (4 + k * 2.4) - 0.8, -145.5 + sd * (4 + k * 2.4) + 0.8, 0.3, 0.56)); });
      [x0 + 150, x1 - 180].forEach(xx => [-1, 1].forEach(sd => slab(B, '#f3ead6', xx, xx + 30, -145.5 + sd * 8 - 2, -145.5 + sd * 8 + 2, 0.3, 0.56)));      // touchdown blocks
      slab(B, '#f3ead6', x0, x1, z0 + 0.6, z0 + 1.2, 0.3, 0.56); slab(B, '#f3ead6', x0, x1, z1 - 1.2, z1 - 0.6, 0.3, 0.56);
      const [t0, t1, tz0, tz1] = A.taxiway; slab(B, '#55575b', t0, t1, tz0, tz1, 0.3, 0.5); slab(B, '#e2c44a', t0, t1, (tz0 + tz1) / 2 - 0.2, (tz0 + tz1) / 2 + 0.2, 0.3, 0.55);
      A.links.forEach(([lx, a, b2]) => { slab(B, '#55575b', lx - 10, lx + 10, Math.min(a, b2), Math.max(a, b2), 0.3, 0.5); slab(B, '#e2c44a', lx - 0.2, lx + 0.2, Math.min(a, b2), Math.max(a, b2), 0.3, 0.55); });
      A.rapid.forEach(([xa, xb]) => { const pts = [[xa, -226], [xa + 22, -226], [xb + 22, -168], [xb, -168]]; B.add(flatGeo(pts, 0.2), '#55575b', null, 0, 0.3, 0); });
      const [p0, p1, pz0, pz1] = A.apron; slab(B, '#a9a79e', p0, p1, pz0, pz1, 0.3, 0.54); slab(B, '#a9a79e', ...A.has_link, 0.3, 0.54);
      for (let x = p0 + 10; x < p1 - 10; x += 40) slab(B, '#e2c44a', x - 0.2, x + 0.2, -320, -262, 0.3, 0.58); slab(B, '#e2c44a', p0 + 5, p1 - 5, -262.2, -261.8, 0.3, 0.58);
      for (let x = p0 + 30; x < p1 - 10; x += 40) { slab(B, '#f1ead6', x - 6, x + 6, -300.2, -299.8, 0.3, 0.58); }
      // airside perimeter fence: south + west follow the base fence; north side = hangars + this fence line east of the apron
    }
    // ---- NAVY: breakwaters with rock armour + lights, quay (top 1.0), piers, dry dock ----
    const N = PLAN.NAVY;
    N.breakwaters.forEach(([a, b2, c, d]) => breakwater(B, a, b2, c, d, fast, r));
    { // angled east-breakwater head toward the mouth is open water: lights mark the entrance
      navLight(B, N.lights[0][0], N.lights[0][1], '#c8382e'); navLight(B, N.lights[1][0], N.lights[1][1], '#3f9a4a'); }
    { const [q0, q1, qz0, qz1] = N.quay; slab(B, '#a9a79e', q0, q1, qz0, qz1 - 5, -1.0, 1.0); slab(B, '#8d8b82', q0, q1, qz0 - 0.1, qz0 + 1.2, 1.0, 1.1);
      B.add(wedgeGeo(q1 - q0, 6, 0.7), '#a9a79e', null, (q0 + q1) / 2, 0.3, qz1 - 5, 1, 1, 1, 0, -Math.PI / 2, 0);
      if (!fast) for (let x = q0 + 4; x < q1 - 2; x += 9) { fender(B, x, qz0 - 0.3, 0); bollard(B, x + 4, qz0 + 2); } }
    N.piers.forEach(([a, b2, c, d, name]) => { slab(B, '#a9a79e', a, b2, c, d, -1.0, 1.0); slab(B, '#8d8b82', a, b2, c, c + 1.2, 1.0, 1.1);
      if (!fast) for (let z = c + 4; z < d - 3; z += 9) { fender(B, a - 0.25, z, Math.PI / 2); fender(B, b2 + 0.25, z, Math.PI / 2); bollard(B, a + 1.2, z + 3); bollard(B, b2 - 1.2, z + 3); }
      for (let z = c + 10; z < d - 5; z += 40) { lamp(B, a + 1, z, Math.PI / 2, 1.0); } });
    slab(B, '#3b3d41', -3272, -3268, -940, -818, 1.0, 1.6);   // fuel line along the fuel pier
    { const [a, b2, c, d] = N.drydock; slab(B, '#3f9cc2', a, b2, c, d, 0.3, 0.36); [[a - 6, a, c, d], [b2, b2 + 6, c, d], [a - 6, b2 + 6, d, d + 6]].forEach(([p, q, s0, s1]) => slab(B, '#a9a79e', p, q, s0, s1, -1.0, 1.4));
      slab(B, '#6c7177', a - 6, b2 + 6, c - 4, c, -1.0, 1.4);                                     // the caisson (dock gate) on the sea side
      [a - 3, b2 + 3].forEach(px => slab(B, '#3b3d41', px - 0.4, px + 0.4, c, d, 1.4, 1.6)); gantry(B, (a + b2) / 2, -680, b2 - a + 6, 0); gantry(B, (a + b2) / 2, -760, b2 - a + 6, 0); }
    // ---- MAIN ENTRY CONTROL POINT ----
    { const E2 = PLAN.ECP; canopy(B, ...E2.canopy, 7.5); const [c0, c1, cz0, cz1] = E2.canopy;
      for (let k = 0; k < 5; k++) { const z = cz0 + 4 + k * ((cz1 - cz0 - 8) / 4); booth(B, (c0 + c1) / 2, z, Math.PI / 2); if (k !== 2) barrier(B, c0 + 2, z + (k < 2 ? 1 : -1) * 1.6, 3.4, k < 2 ? 0 : Math.PI); }
      canopy(B, ...E2.search, 7, '#d6d2c6'); slab(B, '#a9a79e', E2.search[0], E2.search[1], E2.search[2], E2.search[3], 0.3, 0.5);
      building(B, { x: (E2.visitor[0] + E2.visitor[1]) / 2, z: (E2.visitor[2] + E2.visitor[3]) / 2, w: E2.visitor[1] - E2.visitor[0], d: E2.visitor[3] - E2.visitor[2], fl: 2, wall: '#d9c398', roof: '#5b6066', doors: 2, path: 4, flat: true }, fast);
      slab(B, '#6e7074', ...E2.vpark, 0.3, 0.46); for (let x = E2.vpark[0] + 3; x < E2.vpark[1] - 2; x += 3) slab(B, '#f1ead6', x - 0.1, x + 0.1, E2.vpark[2] + 1, E2.vpark[2] + 6, 0.3, 0.5);
      E2.serpentine.forEach(([x, z]) => jersey(B, x, z, 0, 3)); [-1, 1].forEach(sd => { watchtower(B, -1716, -420 + sd * 26, 0); sandbags(B, -1735, -420 + sd * 20, 8, 0); }); floodlight(B, -1745, -446); floodlight(B, -1745, -394);
      const sb = at(-1700, G, -420, Math.PI / 2); [-1, 1].forEach(sd => box(B, '#5b6066', sb, 1.6, 10, 1.6, sd * 14, 0, 0)); box(B, '#5b6066', sb, 30, 1.6, 1.4, 0, 9.4, 0); box(B, '#5b6066', sb, 29, 3, 1.1, 0, 6.2, 0);
      const tex = signTex([['VINLAND FORCES', 0.42, 0.36], ['MEMBERS ONLY', 0.3, 0.74]], 1024, 160, '#1d2f4a', '#f3ead6');
      if (tex) [[0.6, Math.PI / 2], [-0.6, -Math.PI / 2]].forEach(([ox, ry]) => { const pm = new T.Mesh(new T.PlaneGeometry(26, 2.8), new T.MeshBasicMaterial({ map: tex })); pm.position.set(-1700 + ox, G + 7.7, -420); pm.rotation.y = ry; g.add(pm); }); }
    // ---- base gates ----
    entryGate(B, g, -2700, -452, 1, 'VINLAND NAVAL BASE', PLAN.GATES[1][3], fast);
    entryGate(B, g, -2010, -452, 1, 'VINLAND ARMY BASE', PLAN.GATES[2][3], fast);
    entryGate(B, g, -2010, -402, -1, 'ARMY VEHICLE + TRAINING AREA', PLAN.GATES[3][3], fast);
    entryGate(B, g, -2420, -402, -1, 'VINLAND AIR FORCE BASE', PLAN.GATES[4][3], fast);
    // ---- buildings from the plan ----
    const R = id => PLAN.B.find(b => b[0] === id).slice(3, 7);
    // ARMY cantonment
    armyHQ(B, ...R(1), fast);
    { const [a, b2, c, d] = R(2); slab(B, '#5f6163', a, b2, c, d, 0.3, 0.46); for (let x = a + 10; x < b2 - 8; x += 12) slab(B, '#e9e4d8', x, x + 5, (c + d) / 2 - 1, (c + d) / 2 + 1, 0.3, 0.5);
      [c, d].forEach(z => slab(B, '#e9e4d8', a, b2, z - 0.5, z + 0.5, 0.3, 0.5)); const rb = at((a + b2) / 2, G, c - 0.5, 0); box(B, '#c9b48a', rb, 36, 1.4, 8, 0, 0, -4); box(B, '#6c7177', rb, 26, 0.5, 6, 0, 4.6, -4); [-12, 12].forEach(px => box(B, '#9c988c', rb, 0.6, 3.2, 0.6, px, 1.4, -1.5));
      for (let x = a + 20; x <= b2 - 20; x += 10) flagpole(B, x, R(1)[3] + 14, 10, x % 20 ? '#4b5d32' : '#3f5468'); }
    barracksQuad(B, ...R(3), 'E', fast, r); barracksQuad(B, ...R(4), 'E', fast, r); barracksQuad(B, ...R(5), 'W', fast, r); barracksQuad(B, ...R(6), 'W', fast, r);
    blockB(B, R(7), 'E', 1, '#c4ae84', ROOF, { doors: 2, path: 4 }, fast);
    { const [a, b2, c, d] = R(8); const hb = at((a + b2) / 2, G, (c + d) / 2, Math.PI / 2); box(B, CONC, hb, d - c + 1, 0.4, Math.abs(b2 - a) + 1, 0, 0, 0); B.add(archGeo(Math.abs(b2 - a), 10, d - c), '#9a9466', hb, 0, 0.4, 0); box(B, '#3b2f26', hb, 3, 3, 0.3, 0, 0.4, -(d - c) / 2 - 0.1); }
    blockB(B, R(9), 'E', 2, '#e4d8bc', ROOF, { doors: 1, path: 4 }, fast); blockB(B, R(10), 'W', 2, '#d9c398', ROOF2, { doors: 1, path: 4 }, fast);
    // ARMY vehicle + training area
    shed(B, ...R(11), fast); shed(B, ...R(13), fast);
    { const [a, b2, c, d] = R(12); slab(B, '#6a6c70', a, b2, c, d, 0.3, 0.46); for (let x = a + 3; x < b2; x += 6.5) [c + 1, d - 10].forEach(z => slab(B, '#e9e4d8', x - 0.1, x + 0.1, z, z + 9, 0.3, 0.5));
      trucksRow(B, a + 6, b2 - 6, c + 6, Math.PI, truck, 6.5, r, fast ? 0.5 : 0.1); trucksRow(B, a + 6, b2 - 6, d - 5, 0, apc, 6.5, r, fast ? 0.5 : 0.15);
      trucksRow(B, a + 6, b2 - 30, R(11)[2] + 12, Math.PI, truck, 13, r, 0.4); }
    { const [a, b2, c, d] = R(14); slab(B, '#6a6c70', a, b2, c, d, 0.3, 0.46); for (let x = a + 3; x < b2; x += 7) [c + 1, d - 10].forEach(z => slab(B, '#e9e4d8', x - 0.1, x + 0.1, z, z + 9, 0.3, 0.5));
      trucksRow(B, a + 6.5, b2 - 6, c + 6, Math.PI, tank, 7, r, fast ? 0.5 : 0.08); trucksRow(B, a + 6.5, b2 - 6, d - 5, 0, tank, 7, r, fast ? 0.5 : 0.2); trucksRow(B, a + 7, b2 - 40, R(13)[2] + 12, Math.PI, tank, 14, r, 0.3); }
    hall(B, ...R(15), 14, 'S', fast); hall(B, ...R(18), 14, 'S', fast);
    { const [a, b2, c, d] = R(16); slab(B, '#9a9c96', a, b2, c, d, 0.3, 0.46); canopy(B, a + 4, b2 - 4, c + 4, d - 4, 6, '#d6d2c6'); for (let k = 0; k < 3; k++) box(B, '#c9c6bd', null, 1.2, 1.8, 0.8, a + 14 + k * 16, 0.46, (c + d) / 2); fuelTank(B, b2 - 6, c - 8, 4); }
    warehouse(B, ...R(17), 9, fast);
    { const [a, b2, c, d] = R(19); berm(B, a, b2, c, d); igloo(B, (a + b2) / 2 - 18, (c + d) / 2); igloo(B, (a + b2) / 2 + 18, (c + d) / 2); }
    { const [a, b2, c, d] = R(20); slab(B, SAND, a, b2, c, d, 0.3, 0.38); const P2 = '#6a5a44';
      for (let i = 0; i < 6; i++) { const x = a + 12 + i * 22; box(B, P2, null, 6, 2.6, 0.5, x, 0.38, c + 18); } for (let i = 0; i < 4; i++) B.add(prismGeo(6, 3.6, 5), P2, at(a + 20 + i * 30, 0.38, c + 40, 0), 0, 0, 0);
      climbers(B, a + 30, c + 62, 0); climbers(B, a + 70, c + 62, 0); climbers(B, a + 110, c + 62, 0); for (let k = 0; k < 3; k++) slab(B, '#5c7d46', a + 10 + k * 42, a + 40 + k * 42, d - 22, d - 10, 0.38, 0.46);
      [[a + 120, c + 85]].forEach(([x, z]) => { [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([p, q]) => box(B, P2, null, 0.3, 12, 0.3, x + p, 0.38, z + q)); box(B, P2, null, 5, 0.3, 5, x, 12, z); }); }
    { const [a, b2, c, d] = R(21); for (let k = 0; k < 4; k++) slab(B, '#e9e4d8', a + 4, b2 - 4, c + 10 + k * 28, c + 10.6 + k * 28, 0.3, 0.36); }
    { const [a, b2, c, d] = R(22); slab(B, '#b9a36f', a, b2, c, d, 0.3, 0.36); slab(B, '#7f8a52', a, b2, d - 10, d, 0.3, 6.5); B.add(wedgeGeo(b2 - a, 8, 6.2), '#7f8a52', null, (a + b2) / 2, 0.3, d - 10, 1, 1, 1, 0, Math.PI / 2, 0);
      for (let k = 0; k < 10; k++) { const x = a + 10 + k * ((b2 - a - 20) / 9); slab(B, '#e9e4d8', x - 0.1, x + 0.1, c + 14, d - 12, 0.3, 0.38); box(B, '#e9e1cc', null, 1.4, 2.0, 0.12, x, 0.36, d - 13); }
      canopy(B, a + 2, b2 - 2, c + 2, c + 12, 3.6, '#d6d2c6'); }
    // AIR FORCE
    [23, 24, 25, 26].forEach(id => bigHangar(B, ...R(id), 22, fast)); bigHangar(B, ...R(27), 24, fast);
    bigTower(B, ...R(28)); fireStation(B, ...R(29), fast); blockB(B, R(30), 'E', 3, '#d9c398', '#5b6066', { doors: 2, path: 4, flat: true }, fast); blockB(B, R(34), 'W', 3, WALL[1], ROOF, { doors: 2, path: 4 }, fast);
    { const [a, b2, c, d] = R(31); for (let k = 0; k < 4; k++) shelter(B, a + 30 + k * 54, (c + d) / 2, fast); }
    { const [a, b2, c, d] = R(32); berm(B, a, b2, c, d); for (let k = 0; k < 6; k++) fuelTank(B, a + 22 + (k % 3) * 56, c + 18 + ((k / 3) | 0) * 26, 9); }
    radar(B, (R(33)[0] + R(33)[1]) / 2, (R(33)[2] + R(33)[3]) / 2);
    { // aircraft: one jet in each hangar door, a line of jets on the apron, two transports and helicopters
      const hx = [23, 24, 25, 26].map(id => (R(id)[0] + R(id)[1]) / 2);
      hx.forEach(x => jet(B, x, -334, 0)); hx.forEach(x => { jet(B, x - 18, -300, 0); jet(B, x + 18, -300, 0); });
      transport(B, -2690, -290, 0, 1.5); transport(B, -2640, -290, 0, 1.5); heli(B, -3185, -265, 0.3); heli(B, -3160, -262, -0.2);
      R(31) && [0, 1].forEach(k => jet(B, R(31)[0] + 30 + k * 54, -258, 0));
      firetruck(B, -2540, -244, 0); firetruck(B, -2515, -244, 0.05); tanker(B, -2620, -262, Math.PI / 2); tanker(B, -2860, -262, Math.PI / 2 + 0.05);
      [-3150, -2950, -2750].forEach(x => floodlight(B, x, -250)); box(B, '#e9e4d8', null, 0.15, 9, 0.15, -2470, G, -190); box(B, '#e6732a', null, 0.1, 0.9, 3.2, -2470, G + 7.4, -188.4); }
    // NAVY
    { const [a, b2, c, d] = R(35); const WL = '#d9c398', RF = '#5b6066'; building(B, { x: (a + b2) / 2, z: c + 8, w: b2 - a, d: 16, fl: 3, wall: WL, roof: RF, ry: Math.PI, doors: 2, path: 4 }, fast); building(B, { x: (a + b2) / 2, z: d - 8, w: b2 - a, d: 16, fl: 3, wall: WL, roof: RF, ry: 0, doors: 2, path: 4 }, fast);
      building(B, { x: a + 8, z: (c + d) / 2, w: d - c - 32, d: 16, fl: 3, wall: WL, roof: RF, ry: -Math.PI / 2, doors: 1, path: 10 }, fast); building(B, { x: b2 - 8, z: (c + d) / 2, w: d - c - 32, d: 16, fl: 3, wall: WL, roof: RF, ry: Math.PI / 2, doors: 1, path: 4 }, fast);
      slab(B, '#7d9a55', a + 18, b2 - 18, c + 18, d - 18, 0.3, 0.4); flagpole(B, a - 8, (c + d) / 2 - 8, 14, '#3f5468'); flagpole(B, a - 8, (c + d) / 2 + 8, 14, '#3f5468'); }
    [36, 37, 38].forEach(id => warehouse(B, ...R(id), 12, fast));
    hall(B, ...R(39), 20, 'W', fast, '#8d98a3'); hall(B, ...R(40), 12, 'W', fast);
    { const [a, b2, c, d] = R(41); const tb = at((a + b2) / 2, G, (c + d) / 2, 0); box(B, '#e4d8bc', tb, b2 - a, 8, d - c, 0, 0, 0); box(B, '#e4d8bc', tb, 8, 12, 8, 0, 8, 0); box(B, 'glass', tb, 9, 2.6, 9, 0, 18.5, 0); box(B, '#3b3d41', tb, 10, 0.6, 10, 0, 21.1, 0); box(B, '#3b3d41', tb, 0.3, 8, 0.3, 0, 21.7, 0); box(B, '#d6302a', tb, 3, 0.6, 0.3, 0, 28, 0); }
    { const [a, b2, c, d] = R(42); for (let k = 0; k < 3; k++) building(B, { x: a + 45 + k * 95, z: (c + d) / 2, w: 80, d: 18, fl: 4, wall: WALL[k % 3], roof: ROOF, ry: 0, doors: 3, path: 6 }, fast); }
    { const [a, b2, c, d] = R(43); slab(B, '#5f6163', a, b2, c, d, 0.3, 0.46); cyl(B, '#6f7a85', null, 14, 0.06, (a + b2) / 2, 0.46, (c + d) / 2); slab(B, '#f1ead6', (a + b2) / 2 - 6, (a + b2) / 2 - 4, (c + d) / 2 - 8, (c + d) / 2 + 8, 0.46, 0.53); slab(B, '#f1ead6', (a + b2) / 2 + 4, (a + b2) / 2 + 6, (c + d) / 2 - 8, (c + d) / 2 + 8, 0.46, 0.53); slab(B, '#f1ead6', (a + b2) / 2 - 6, (a + b2) / 2 + 6, (c + d) / 2 - 1, (c + d) / 2 + 1, 0.46, 0.53); heli(B, (a + b2) / 2 + 30, (c + d) / 2, 0.4); }
    { const [a, b2, c, d] = R(44); berm(B, a, b2, c, d); for (let k = 0; k < 4; k++) fuelTank(B, a + 22 + (k % 2) * 36, c + 26 + ((k / 2) | 0) * 52, 10); }
    { const [a, b2, c, d] = R(45); berm(B, a, b2, c, d); igloo(B, (a + b2) / 2 - 18, (c + d) / 2 - 18); igloo(B, (a + b2) / 2 + 18, (c + d) / 2 - 18); igloo(B, (a + b2) / 2 - 18, (c + d) / 2 + 22); igloo(B, (a + b2) / 2 + 18, (c + d) / 2 + 22); }
    { const [a, b2, c, d] = R(46); const CC = ['#9a5a3e', '#4f6478', '#7a7a52', '#8a4a3a', '#6b6f73'];
      for (let row = 0; row < 4; row++) for (let i = 0; i < Math.floor((b2 - a - 10) / 13); i++) { const h = 1 + ((i * 7 + row * 3) % 3); if (fast && (i + row) % 2) continue; for (let k = 0; k < h; k++) box(B, CC[(i + row + k) % 5], null, 12.2, 2.6, 2.44, a + 10 + i * 13, 1.0 + k * 2.6, c + 8 + row * 12); }
      gantry(B, a + 90, c + 26, 54, 0); gantry(B, a + 210, c + 26, 54, 0); crane(B, -3300, -800, Math.PI / 2); crane(B, -2700, -800, -Math.PI / 2);
      [[-3340, -760], [-2680, -760], [-3000, -770]].forEach(([x, z], i) => forklift(B, x, z, i)); truck(B, -3100, -748, Math.PI / 2, '#aeb4b8', 1.0); truck(B, -2950, -748, -Math.PI / 2, '#aeb4b8', 1.0); }
    // ships (bow to the sea)
    frigate(B, -3300, -890, 2.1); frigate(B, -3249, -888, 1.77); frigate(B, -3141, -888, 1.77); sub(B, -3097, -884, 1.4); sub(B, -3085, -884, 1.4);
    landingShip(B, -2973, -890); patrol(B, -2811, -858, 0, 2.1); patrol(B, -2811, -888, 0, 2.1); patrol(B, -2774, -858, 0, 2.1); patrol(B, -2774, -888, 0, 2.1);
    tug(B, -3020, -1010, 0.6, 1.3); frigate(B, -2530, -715, 1.77);
    // ---- lamps: boulevard both sides, base main roads ----
    for (let x = -3460; x < -1660; x += fast ? 100 : 50) { lamp(B, x, -432, Math.PI); lamp(B, x + 25, -408, 0); }
    PLAN.ROADS.forEach(([x0, x1, z0, z1, k]) => { if (k !== 'main' || x1 === -900 || fast) return; const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0); const L = ax ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
      for (let t = 20; t < L - 10; t += 45) { if (ax) lamp(B, Math.min(x0, x1) + t, Math.max(z0, z1) + 2, 0); else lamp(B, Math.max(x0, x1) + 2, Math.min(z0, z1) + t, Math.PI / 2); } });
    // ---- fences: double outer fence (open on the harbour), each base its own fence with a gap at its gate ----
    const st = fast ? 24 : 14, ist = fast ? 20 : 12;
    (fast ? [0] : [0, 3]).forEach(off => { fence(B, [[-3380, Z.z0 + off], [Z.x0 + off, Z.z0 + off], [Z.x0 + off, Z.z1 - off], [Z.x1 - off, Z.z1 - off], [Z.x1 - off, Z.z0 + off], [-2640, Z.z0 + off]], st, (x, z) => Math.abs(x - (Z.x1 - off)) < 0.5 && Math.abs(z + 420) < 16); });
    const GT = PLAN.GATES; const gapAt = (x, z) => GT.some(([gx, gz]) => Math.abs(x - gx) < 10 && Math.abs(z - gz) < 1);
    Object.entries(BASES).forEach(([k, b]) => { const [a, b2, c, d] = b.fence; const pts = k === 'navy' ? [[-3360, c], [a, c], [a, d], [b2, d], [b2, c], [-2640, c]] : [[a, c], [b2, c], [b2, d], [a, d], [a, c]];
      fence(B, pts, ist, gapAt); [[a, c], [b2, c], [a, d], [b2, d]].forEach(([x, z]) => watchtower(B, x, z, 0)); });
    PLAN.TOWERS.forEach(([x, z]) => { if (z > -1000) watchtower(B, x, z, 0); });
    // ---- props: crates and drums by warehouses and workshops, sandbags at gates ----
    [[-3240, -652], [-3100, -652], [-2960, -652], [-2240, -240], [-1950, -240]].forEach(([x, z], i) => { crates(B, x, z, i * 0.7); drums(B, x + 8, z + 1); });
    let tris = B.build(g);
    // ---- hills round the complex ----
    { const X0 = -4300, X1 = -1250, ZA = -800, ZB = 420, CELL = fast ? 44 : 30, nx = Math.round((X1 - X0) / CELL), nz = Math.round((ZB - ZA) / CELL), pos = [], col = [], idx = [], lo = new T.Color('#86ad5c'), hi = new T.Color('#5e8f45'), top = new T.Color('#9db86a'), dry = new T.Color('#a8a76a'), cc = new T.Color(), HH = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = X0 + (X1 - X0) * i / nx, z = ZA + (ZB - ZA) * j / nz, h = hillH(x, z); HH.push(h); pos.push(x, 0.34 + h, z); const k = h / 24; cc.copy(lo).lerp(k > 0.7 ? top : hi, Math.min(1, k * 1.2)).lerp(dry, sst((noise(x / 70, z / 70, 11) - 0.55) * 3) * 0.55); col.push(cc.r, cc.g, cc.b); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b2 = a + 1, c = a + nx + 1, d = c + 1; if (Math.max(HH[a], HH[b2], HH[c], HH[d]) < 0.05) continue; idx.push(a, c, b2, b2, c, d); }
      const G3 = new T.BufferGeometry(); G3.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G3.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G3.setIndex(idx); G3.computeVertexNormals(); tris += idx.length / 3;
      const hm = new T.Mesh(G3, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); hm.userData.ground = true; g.add(hm); }
    // ---- trees: groves in the green belts, a planted avenue, courtyards, woods on the hills outside ----
    { const TR = [], R2 = rng(808), onRoad = (x, z) => PLAN.ROADS.some(([x0, x1, z0, z1]) => x > Math.min(x0, x1) - 4 && x < Math.max(x0, x1) + 4 && z > Math.min(z0, z1) - 4 && z < Math.max(z0, z1) + 4);
      const add = (x, z, s, k) => { if (onRoad(x, z)) return; TR.push({ x, y: G + (inBase(x, z) ? 0 : 0) + hillH(x, z), z, r: R2() * 6.28, s: s || 1.1 + R2() * 0.9, k: k || (R2() < 0.5 ? 'p' : 'r'), c: (R2() * 4) | 0 }); };
      const grove = (cx, cz, n, rx, rz) => { for (let i = 0; i < (fast ? Math.ceil(n / 2) : n); i++) add(cx + (R2() - 0.5) * rx, cz + (R2() - 0.5) * rz); };
      for (let z = -790; z < -470; z += 45) grove(-2340, z, 4, 24, 30); for (let z = -390; z < -90; z += 45) grove(-2340, z, 4, 24, 30);              // belt between navy/air and army
      for (let x = -3450; x < -1800; x += 70) { grove(x, -441, 2, 40, 6); }                                                                          // belt north of the boulevard
      for (let x = -3460; x < -1750; x += 60) grove(x, -69, 2, 40, 6); for (let z = -780; z < -100; z += 60) grove(-3491, z, 2, 6, 40);
      for (let z = -600; z > -606; z -= 10) {} for (let z = -600; z < -460; z += 14) { add(-2026, z, 1.0, 'r'); add(-1994, z, 1.0, 'r'); }            // the ceremonial avenue
      [3, 4, 5, 6].forEach(id => { const [a, b2, c, d] = R(id); add((a + b2) / 2 - 12, (c + d) / 2 + 14, 1.2, 'r'); add((a + b2) / 2 + 12, (c + d) / 2 - 14, 1.2, 'r'); });
      { const [a, b2, c, d] = R(35); add((a + b2) / 2 - 10, (c + d) / 2, 1.2, 'r'); add((a + b2) / 2 + 10, (c + d) / 2, 1.2, 'r'); }
      const NT = fast ? 260 : 640; for (let i = 0; i < NT * 6 && TR.length < NT + 200; i++) { const x = -4250 + R2() * 2950, z = -790 + R2() * 1200; if (noise(x / 160, z / 160, 21) < 0.48) continue;
        const dx = Math.max(Z.x0 - x, x - Z.x1, 0), dz = Math.max(Z.z0 - z, z - Z.z1, 0); if (Math.hypot(dx, dz) < 18) continue; if (x > Z.x1 && Math.abs(z + 420) < 26) continue; if (z < -775) continue; add(x, z); }
      trees(g, TR, fast); g.userData.treeCount = TR.length; }
    g.traverse(m => { if (!m.isMesh) return; m.receiveShadow = !fast; m.castShadow = !fast && !m.userData.ground && !(m.material && m.material.transparent); });
    g.userData.tris = tris; g.userData.zone = Z; g.userData.gate = GATE; return g; }

  root.VinlandForces = { forces, Z, GATE, hillH, PLAN };
})(window);
