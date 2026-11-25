// VINLAND FORCES (Dev, 26 Nov 2026): one fenced zone on the empty west coast: Army base, Air Force airstrip, Navy harbour, gate, hills round it.
// Same land the army reel marked: x -2700..-1700, z -800..-210, sea on the north (z < -820), gate on the east fence at (-1700, -420).
// Scale (map/index.html): citizen 2.2 m, jeep 4 m, storey 3.2 m, doors 1.4 x 2.4 m, fence 2.6 m. Everything is built in WORLD metres.
// Layers (so nothing flickers): ground 0 . farm paint 0.22 . lawn 0.30 . yards 0.38 . roads 0.46 . road marks 0.52 . plinths 0.30..0.70 . quay 1.0
// Returns one THREE.Group (merged meshes: ~30 draw calls) with userData.tris. Phones: fast = true (fewer posts, windows, vehicles, trees).
(function (root) {
  const T = root.THREE;
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
  const at = (x, y, z, ry = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry), new T.Vector3(1, 1, 1));
  const BOX = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);            // unit box, pivot bottom-centre
  const box = (B, c, base, w, h, d, x, y, z, ry = 0, rx = 0) => B.add(BOX, c, base, x, y, z, w, h, d, rx, ry, 0);
  const slab = (B, c, x0, x1, z0, z1, y0, y1) => box(B, c, null, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2);   // axis-aligned block between two corners
  function prismGeo(w, h, d) { const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0); return new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); }
  function archGeo(w, h, len) { const s = new T.Shape(); s.moveTo(w / 2, 0); s.absellipse(0, 0, w / 2, h, 0, Math.PI, false, 0); s.lineTo(w / 2, 0); return new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -len / 2); }
  function wedgeGeo(len, run, rise) { const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(run, 0); s.lineTo(0, rise); s.lineTo(0, 0); return new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2); }   // right-angle ramp: tall face at x 0, slopes down to x = run
  function flatGeo(pts, th) { const s = new T.Shape(); pts.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z)); return new T.ExtrudeGeometry(s, { depth: th, bevelEnabled: false }).rotateX(-Math.PI / 2); }   // polygon in the x-z plane, th thick upwards
  const CYL = new T.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0), CYL8 = new T.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0);
  const cyl = (B, c, base, r, h, x, y, z, rx = 0, rz = 0, sx = 1, sz = 1) => B.add(CYL, c, base, x, y, z, r * sx, h, r * sz, rx, 0, rz);

  // ---------- the land ----------
  const Z = { x0: -2700, x1: -1700, z0: -800, z1: -210 }, GATE = { x: -1700, z: -420 }, SHORE = -820, G = 0.3, FL = 0.7;   // G = lawn, FL = floor of a building on its plinth
  const ROAD = '#5d5f63', DIRT = '#b79b6c', SAND = '#cdb88a', CONC = '#9a9c96', WALL = ['#cfc5a3', '#c2b88f', '#b9b894'], ROOF = '#5c6b43', ROOF2 = '#6b5f4a', STEEL = '#7c8791', DARK = '#3b3d41';
  const noise = (x, z, s) => { const f = v => v - Math.floor(v), h = (a, b) => f(Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453), xi = Math.floor(x), zi = Math.floor(z), u = f(x), v = f(z), a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1), uu = u * u * (3 - 2 * u), vv = v * v * (3 - 2 * v); return a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv; };
  const sst = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
  // low gentle hills ringing the base (never inside the fence, never on the approach road, never at the shore). Max about 26 m, wide and soft.
  const HILLS = [[-3000, -640, 230, 22], [-2930, -300, 270, 26], [-2750, -20, 240, 20], [-2250, 40, 280, 22], [-1850, 20, 230, 18], [-1420, -90, 200, 14], [-1460, -620, 170, 12], [-3180, -80, 220, 18]];
  const hillMask = (x, z) => { if (z < -770 || x > -1250) return 0; const dx = Math.max(Z.x0 - x, x - Z.x1, 0), dz = Math.max(Z.z0 - z, z - Z.z1, 0); let m = sst((Math.hypot(dx, dz) - 40) / 120);
    m *= sst((z + 770) / 60) * sst((-1250 - x) / 120); if (x > Z.x1) m *= sst((Math.abs(z - GATE.z) - 26) / 60); return m; };   // flat inside the fence, along the approach road and at the shore
  const hillH = (x, z) => { let h = 0; HILLS.forEach(([hx, hz, r, hh]) => { const d = Math.hypot(x - hx, (z - hz) * 1.15) / r; if (d < 1) h += hh * Math.pow(Math.cos(d * Math.PI / 2), 2); }); return h * (0.82 + 0.3 * noise(x / 110, z / 110, 3)) * hillMask(x, z); };

  // ---------- parts ----------
  function building(B, o, fast) {   // o: x, z, w (along local x), d, fl, wall, roof, ry (0 = door faces south, PI = north), doors, y0, flat, win
    const { x, z, w, d } = o, fl = o.fl || 1, FH = 3.2, H = fl * FH, y0 = o.y0 == null ? G : o.y0, base = at(x, y0, z, o.ry || 0), nd = o.doors || 1;
    box(B, '#a8a396', base, w + 0.6, 0.4, d + 0.6, 0, 0, 0);                                            // plinth 0.4
    box(B, o.wall, base, w, H, d, 0, 0.4, 0);                                                          // walls
    if (o.flat) { box(B, o.roof, base, w + 0.5, 0.4, d + 0.5, 0, 0.4 + H, 0); box(B, o.wall, base, w + 0.1, 0.5, d + 0.1, 0, 0.8 + H, 0); box(B, o.roof, base, w - 0.7, 0.45, d - 0.7, 0, 0.82 + H, 0); }
    else B.add(prismGeo(d + 1.4, 0.2 * (d + 1.4), w + 1.4), o.roof, base, 0, 0.4 + H, 0, 1, 1, 1, 0, Math.PI / 2, 0);   // gable roof, 20 deg, 0.7 m overhang, ridge along x
    const dx = k => (k - (nd - 1) / 2) * Math.min(w / nd, 12), dxs = []; for (let k = 0; k < nd; k++) dxs.push(dx(k));
    dxs.forEach(px => { box(B, '#d8d0b8', base, 1.8, 2.7, 0.1, px, 0.4, d / 2 + 0.005); box(B, '#3b2f26', base, 1.4, 2.4, 0.15, px, 0.4, d / 2 + 0.03); box(B, '#a8a396', base, 2.4, 0.2, 1.0, px, 0, d / 2 + 0.5); box(B, '#cbbd9f', base, 2.4, 0.08, o.path || 6, px, 0, d / 2 + 1.0 + (o.path || 6) / 2 - 0.0); });   // door 1.4 x 2.4 + one step + a path from the door
    if (o.win !== false) for (let f = 0; f < fl; f++) for (let wx = -w / 2 + 3; wx <= w / 2 - 2.9; wx += 4) {
      const wy = 0.4 + f * FH + 1.0; [1, -1].forEach(sd => { if (sd < 0 && fast) return; if (sd > 0 && f === 0 && dxs.some(px => Math.abs(px - wx) < 1.8)) return;
        box(B, '#d8d0b8', base, 1.4, 1.6, 0.1, wx, wy - 0.15, sd * d / 2); box(B, 'glass', base, 1.1, 1.3, 0.14, wx, wy, sd * d / 2 + sd * 0.01); }); }
  }
  function hangar(B, x, z, w, len, ry) { const base = at(x, G, z, ry || 0);
    box(B, CONC, base, w + 1, 0.4, len + 1, 0, 0, 0); B.add(archGeo(w, 13, len), STEEL, base, 0, 0.4, 0);                       // barrel roof: w wide, 13.4 m high at the crown
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
  function jeep(B, x, z, ry, col, y) { const b = at(x, y == null ? 0.46 : y, z, ry), c = col || '#6b7550';
    box(B, c, b, 1.9, 0.9, 4.0, 0, 0.5, 0); box(B, c, b, 1.8, 0.8, 1.6, 0, 1.4, -0.5); box(B, 'glass', b, 1.7, 0.5, 1.4, 0, 1.55, -0.5); [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]].forEach(([sx, sz]) => box(B, '#222', b, 0.3, 0.7, 0.7, sx * 0.9, 0, sz)); }
  function truck(B, x, z, ry, col, y) { const b = at(x, y == null ? 0.46 : y, z, ry), c = col || '#6b7550';
    box(B, c, b, 2.4, 1.2, 7.2, 0, 0.7, -0.4); box(B, c, b, 2.4, 1.5, 2.0, 0, 1.9, 2.4); box(B, 'glass', b, 2.2, 0.7, 0.2, 0, 2.3, 3.4); box(B, '#8a8466', b, 2.5, 2.2, 4.6, 0, 1.9, -1.6);
    [[-1, 2.4], [1, 2.4], [-1, -0.6], [1, -0.6], [-1, -2.6], [1, -2.6]].forEach(([sx, sz]) => box(B, '#222', b, 0.4, 1.0, 1.0, sx * 1.2, 0, sz)); }
  function apc(B, x, z, ry, y) { const b = at(x, y == null ? 0.46 : y, z, ry);
    box(B, '#59623f', b, 2.7, 1.5, 6.2, 0, 0.7, 0); box(B, '#59623f', b, 2.2, 1.0, 3.2, 0, 2.1, -0.6); box(B, '#3b3d41', b, 0.5, 0.35, 3.0, 0, 2.6, 1.6); box(B, '#3b3d41', b, 0.5, 0.3, 6.6, -1.4, 0.2, 0); box(B, '#3b3d41', b, 0.5, 0.3, 6.6, 1.4, 0.2, 0); }
  function jet(B, x, z, ry) { const b = at(x, 0.54, z, ry), c = '#6f7a85';
    box(B, c, b, 1.3, 1.2, 11, 0, 1.3, 0); B.add(new T.ConeGeometry(0.65, 3.4, 6), c, b, 0, 1.9, 7.0, 1, 1, 1, Math.PI / 2, 0, 0); box(B, 'glass', b, 1.0, 0.7, 2.2, 0, 2.2, 3.4);
    [1, -1].forEach(s => { B.add(flatGeo(s > 0 ? [[0.6, 2.5], [5.4, -3.2], [5.4, -4.6], [0.6, -4.6]] : [[-0.6, -4.6], [-5.4, -4.6], [-5.4, -3.2], [-0.6, 2.5]], 0.22), c, b, 0, 1.6, 0);
      B.add(flatGeo(s > 0 ? [[0.6, -4.6], [2.6, -6.6], [2.6, -5.6], [0.6, -3.6]] : [[-0.6, -3.6], [-2.6, -5.6], [-2.6, -6.6], [-0.6, -4.6]], 0.2), c, b, 0, 1.7, 0); });
    box(B, '#59636c', b, 0.18, 2.2, 1.8, 0, 2.3, -4.6); box(B, '#2e353b', b, 0.9, 0.5, 1.6, 0, 1.0, -5.4); }
  function transport(B, x, z, ry) { const b = at(x, 0.54, z, ry), c = '#69747d';
    cyl(B, c, b, 1.9, 20, 0, 2.6, -10, Math.PI / 2, 0); B.add(new T.ConeGeometry(1.9, 4, 8), c, b, 0, 2.6, 12, 1, 1, 1, Math.PI / 2, 0, 0); B.add(new T.ConeGeometry(1.8, 6, 8), c, b, 0, 2.6, -13.5, 1, 1, 1, -Math.PI / 2, 0, 0);
    box(B, c, b, 26, 0.5, 4.6, 0, 4.7, 1.5); box(B, 'glass', b, 2.2, 0.9, 1.4, 0, 3.7, 9.6); box(B, c, b, 9, 0.35, 2.6, 0, 3.3, -12.4); box(B, '#59636c', b, 0.3, 5.0, 3.0, 0, 3.5, -12.2);
    [-7.5, -3.8, 3.8, 7.5].forEach(px => { cyl(B, '#3b3d41', b, 0.7, 2.4, px, 3.9, 2.4, Math.PI / 2, 0); box(B, '#3b3d41', b, 0.3, 1.5, 0.3, px, 1.0, 1.8); }); [-1, 1].forEach(sd => box(B, '#3b3d41', b, 0.6, 0.8, 1.8, sd * 2.0, -0.1, 0.8)); box(B, '#3b3d41', b, 0.4, 0.8, 0.4, 0, -0.1, 7.5); }
  function heli(B, x, z, ry) { const b = at(x, 0.54, z, ry), c = '#59636c';
    B.add(new T.IcosahedronGeometry(1.6, 0), c, b, 0, 2.2, 0.6, 1, 0.95, 1.5); box(B, 'glass', b, 2.2, 1.1, 1.6, 0, 2.2, 2.0); box(B, c, b, 0.6, 0.7, 6.8, 0, 2.4, -3.6); box(B, c, b, 0.15, 2.0, 1.0, 0, 2.5, -7.0);
    box(B, '#222', b, 0.3, 0.7, 0.3, 0, 3.6, 0.3); box(B, '#33383d', b, 11, 0.08, 0.5, 0, 4.25, 0.3); box(B, '#33383d', b, 0.5, 0.08, 11, 0, 4.2, 0.3);
    [-1, 1].forEach(s => { box(B, '#222', b, 0.14, 0.14, 4.2, s * 1.5, 0.15, 0.4); box(B, '#222', b, 0.1, 1.1, 0.1, s * 1.5, 0.2, 1.4); box(B, '#222', b, 0.1, 1.1, 0.1, s * 1.5, 0.2, -0.6); }); }
  function hullGeo(L, Bm, depth, up) { const s = new T.Shape(), h = L / 2, w = Bm / 2; s.moveTo(-w, -h); s.lineTo(w, -h); s.lineTo(w, h * 0.45); s.lineTo(w * 0.55, h * 0.86); s.lineTo(0, h); s.lineTo(-w * 0.55, h * 0.86); s.lineTo(-w, h * 0.45); s.lineTo(-w, -h);
    return new T.ExtrudeGeometry(s, { depth: depth + up, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -depth, 0); }   // keel at -depth, deck at +up; bow toward -z (north)
  function frigate(B, x, z) { const b = at(x, 0.3, z, 0);
    B.add(hullGeo(62, 10, 1.8, 2.6), '#8d98a3', b, 0, 0, 0); box(B, '#59636c', b, 9.4, 0.15, 56, 0, 2.6, 2); box(B, '#c8ced3', b, 8, 4.6, 14, 0, 2.7, -4); box(B, 'glass', b, 7.4, 0.9, 0.2, 0, 5.2, -11.1); box(B, '#c8ced3', b, 5, 3, 8, 0, 7.3, -3);
    box(B, '#8d98a3', b, 3.0, 4.4, 3.0, 0, 2.7, 8); box(B, '#3b3d41', b, 3.4, 0.5, 3.4, 0, 7.1, 8); box(B, '#3b3d41', b, 0.2, 12, 0.2, 0, 10.3, -3); box(B, '#59636c', b, 0.1, 0.1, 4.0, 0, 20.5, -3);
    cyl(B, '#59636c', b, 1.8, 1.0, 0, 2.6, -21, 0, 0); box(B, '#3b3d41', b, 0.4, 0.4, 4.0, 0, 3.4, -24); box(B, '#d8d4c4', b, 6, 0.2, 6, 0, 2.7, 22);
    box(B, '#e9e1cc', b, 0.2, 0.9, 5, -5.01, 1.4, -2); box(B, '#e9e1cc', b, 0.2, 0.9, 5, 5.01, 1.4, -2); }
  function patrol(B, x, z, ry) { const b = at(x, 0.3, z, ry || 0);
    B.add(hullGeo(14, 4, 0.7, 1.1), '#a3adb6', b, 0, 0, 0); box(B, '#d6d9dc', b, 3, 1.8, 4.4, 0, 1.1, 0.8); box(B, 'glass', b, 3.1, 0.7, 2.6, 0, 1.6, 1.5); box(B, '#3b3d41', b, 0.1, 4, 0.1, 0, 2.9, 0.5); box(B, '#3b3d41', b, 0.25, 0.25, 1.6, 0, 1.4, -3.4); }
  function sub(B, x, z) { const b = at(x, 0.3, z, 0);
    B.add(new T.SphereGeometry(1, 12, 8), '#2e3842', b, 0, 0.2, 0, 3.0, 2.7, 27); box(B, '#2e3842', b, 2.2, 3.6, 7, 0, 0.5, 5); box(B, '#2e3842', b, 0.2, 2.2, 3, 0, 1.2, -25); box(B, '#2e3842', b, 7, 0.2, 2, 0, 0.5, -24.5); }
  function crane(B, x, z, ry) { const b = at(x, 1.0, z, ry || 0), c = '#e08a2e';
    [[-6, -5], [6, -5], [-6, 5], [6, 5]].forEach(([a, d]) => box(B, c, b, 1.0, 13, 1.0, a, 0, d)); box(B, c, b, 14, 1.2, 12, 0, 13, 0); box(B, c, b, 4.2, 3.2, 4.2, 4.5, 14.2, -3); box(B, c, b, 3.0, 1.4, 38, 0, 14.4, -16); box(B, '#3b3d41', b, 0.2, 7, 0.2, 0, 7.4, -30); box(B, '#3b3d41', b, 3, 0.5, 1.5, 0, 6.9, -30); }
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
      const run = (a0, b0) => { const x = x0 + (x1 - x0) * (a0 + b0) / 2, z = z0 + (z1 - z0) * (a0 + b0) / 2, l = L * (b0 - a0); box(B, '#6b6f6a', null, 0.08, 0.08, l, x, G + 2.6, z, a); box(B, '#6b6f6a', null, 0.08, 0.08, l, x, G + 1.3, z, a); B.add(BOX, 'wire', null, x, G + 0.1, z, 0.03, 2.4, l, 0, a, 0); };
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

  // ---------- the whole zone ----------
  function forces(o = {}) {
    const fast = !!o.fast, g = new T.Group(), B = Batch(), r = rng(26112), W = () => WALL[(r() * 3) | 0];
    // ---- lawn (mown grass with dry khaki patches), one grid at y 0.30 ----
    { const CELL = fast ? 30 : 20, nx = Math.round((Z.x1 - Z.x0) / CELL), nz = Math.round((Z.z1 - Z.z0) / CELL), pos = [], col = [], idx = [], c1 = new T.Color('#8fb561'), c2 = new T.Color('#a8aa6a'), c3 = new T.Color('#7ea856'), cc = new T.Color();
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = Z.x0 + (Z.x1 - Z.x0) * i / nx, z = Z.z0 + (Z.z1 - Z.z0) * j / nz, n = noise(x / 90, z / 90, 5), m = noise(x / 40, z / 40, 9);
        pos.push(x, G, z); cc.copy(c1).lerp(c2, sst((n - 0.45) * 3.2) * 0.85).lerp(c3, sst((m - 0.62) * 4) * 0.5); col.push(cc.r, cc.g, cc.b); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b2 = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b2, b2, c, d); }
      const G2 = new T.BufferGeometry(); G2.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G2.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G2.setIndex(idx); G2.computeVertexNormals();
      g.add(new T.Mesh(G2, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }))); }
    // ---- roads (asphalt 12 m / 10 m), dirt roads inside the army base, sand yards, concrete aprons ----
    const road = (x0, x1, z0, z1, c, top) => slab(B, c || ROAD, x0, x1, z0, z1, 0.3, top || 0.46), APP = o.approachEnd == null ? -900 : o.approachEnd;
    road(Z.x1, APP, -426, -414); road(-2195, Z.x1, -426, -414); road(-2200, -2190, -770, -240); road(-2440, -2200, -430, -420); road(-2300, -2200, -745, -735);
    const dash = (x0, x1, z, step) => { for (let x = x0; x < x1; x += step) slab(B, '#f1ead6', x, x + step * 0.5, z - 0.15, z + 0.15, 0.3, 0.52); };
    dash(-2190, Z.x1 - 6, -420, 12); dash(Z.x1 + 6, APP - 6, -420, 12);
    for (let z = -765; z < -245; z += 14) slab(B, '#f1ead6', -2195.15, -2194.85, z, z + 7, 0.3, 0.52);
    // army base (x -2150..-1790, z -640..-300) inside its own fence (x -2160..-1780, z -650..-292)
    const dirt = (x0, x1, z0, z1) => slab(B, DIRT, x0, x1, z0, z1, 0.3, 0.46);
    dirt(-2079, -1901, -614, -606); dirt(-2079, -2071, -606, -426); dirt(-1909, -1901, -606, -426);                                  // ring road round the parade ground (its south side is the avenue)
    dirt(-2152, -1788, -646, -638); dirt(-2152, -1788, -302, -294); [[-2152, -2144], [-1796, -1788]].forEach(([x0, x1]) => { dirt(x0, x1, -638, -426); dirt(x0, x1, -414, -302); });   // track just inside the inner fence
    slab(B, '#5f6163', -2060, -1920, -548, -480, 0.3, 0.46);                                              // parade ground 140 x 68
    for (let x = -2052; x < -1928; x += 12) slab(B, '#e9e4d8', x, x + 5, -515, -513, 0.3, 0.5); slab(B, '#e9e4d8', -2060, -1920, -549, -548, 0.3, 0.5); slab(B, '#e9e4d8', -2060, -1920, -480, -479, 0.3, 0.5);
    slab(B, SAND, -1880, -1800, -636, -584, 0.3, 0.38); slab(B, SAND, -2145, -2090, -636, -600, 0.3, 0.38);   // training yards (obstacle course, drill yard)
    slab(B, ROAD, -1850, -1796, -408, -306, 0.3, 0.46);                                                    // motor pool lot
    // ---- air force: runway 400 x 30 along x, taxiway 14 m, apron, links ----
    slab(B, DARK, -2650, -2250, -340, -310, 0.3, 0.5); for (let x = -2640; x < -2262; x += 24) slab(B, '#f3ead6', x, x + 12, -325.3, -324.7, 0.3, 0.56);
    for (let k = 0; k < 8; k++) { slab(B, '#f3ead6', -2646, -2638, -338 + k * 3.6 - 0.0, -337.0 + k * 3.6, 0.3, 0.56); slab(B, '#f3ead6', -2262, -2254, -338 + k * 3.6, -337.0 + k * 3.6, 0.3, 0.56); }
    slab(B, '#e2c44a', -2650, -2250, -340.4, -340, 0.3, 0.55); slab(B, '#e2c44a', -2650, -2250, -310, -309.6, 0.3, 0.55);
    slab(B, '#4a4c50', -2640, -2260, -392, -378, 0.3, 0.5); slab(B, '#e2c44a', -2640, -2260, -385.2, -384.8, 0.3, 0.55);
    [-2625, -2450, -2275].forEach(x => slab(B, '#4a4c50', x - 7, x + 7, -378, -340, 0.3, 0.5));
    slab(B, '#8d8f8a', -2620, -2350, -500, -392, 0.3, 0.54); [-2600, -2565, -2530, -2405].forEach(x => slab(B, '#e2c44a', x - 0.2, x + 0.2, -470, -400, 0.3, 0.58));
    slab(B, '#8d8f8a', -2345, -2315, -455, -425, 0.3, 0.54); cyl(B, '#6f7a85', null, 13, 0.06, -2330, 0.54, -440); slab(B, '#f1ead6', -2336, -2334, -447, -433, 0.54, 0.6); slab(B, '#f1ead6', -2326, -2324, -447, -433, 0.54, 0.6); slab(B, '#f1ead6', -2336, -2324, -441, -439, 0.54, 0.6);   // helipad + H
    // ---- navy: raised quay platform on the shore, 4 piers into the sea ----
    slab(B, '#a9a79e', -2650, -2300, -836, -716, -1.0, 1.0); slab(B, '#8d8b82', -2650, -2300, -836, -832, -1.0, 1.1);        // quay wall goes down into the water, platform top 1.0 (0.7 above the lawn)
    const wedge = (len, run, rise, x, z, ry) => B.add(wedgeGeo(len, run, rise), '#a9a79e', null, x, 0.3, z, 1, 1, 1, 0, ry, 0);                // 6 m ramps up from the lawn on the south, west and east sides
    wedge(350, 6, 0.7, -2475, -716, -Math.PI / 2); wedge(114, 6, 0.7, -2650, -779, Math.PI); wedge(104, 6, 0.7, -2300, -784, 0);
    for (let i = 0; i < 4; i++) { const px = -2600 + i * 80; slab(B, '#a9a79e', px - 5, px + 5, -906, -836, 0.5, 1.0); if (!fast) for (let z = -904; z < -836; z += 7) [-4.4, 4.4].forEach(s => slab(B, '#4a3f35', px + s - 0.3, px + s + 0.3, z - 0.3, z + 0.3, -1.6, 0.5)); }
    slab(B, ROAD, -2640, -2306, -800, -790, 1.0, 1.06); for (let x = -2636; x < -2312; x += 10) slab(B, '#e2c44a', x, x + 5, -795.1, -794.9, 1.06, 1.1);   // road behind the quay edge
    slab(B, ROAD, -2640, -2300, -748, -738, 1.0, 1.06); slab(B, ROAD, -2300, -2200, -748, -738, 0.3, 0.46);                                       // yard road + the road in from the Cross Avenue
    // ---- gate (outer fence, east) ----
    { const gx = GATE.x, gz = GATE.z;
      slab(B, '#8d8f8a', gx - 14, gx + 14, gz - 8, gz + 8, 0.3, 0.5); slab(B, '#a9a79e', gx - 3, gx + 3, gz - 2, gz + 2, 0.3, 0.7);
      booth(B, gx, gz, 0); [[gz - 2, -1], [gz + 2, 1]].forEach(([z, s]) => barrier(B, gx + 0.8, z, 4.2, s > 0 ? 0 : Math.PI));
      [gz - 8.5, gz + 8.5].forEach(z => { box(B, '#6a5a44', null, 1.6, 8, 1.6, gx, G, z); }); box(B, '#6a5a44', null, 1.2, 1.2, 19, gx, G + 7.4, gz);
      const tex = signTex([['VINLAND FORCES', 0.42, 0.36], ['MEMBERS ONLY', 0.3, 0.74]], 1024, 160, '#1d2f4a', '#f3ead6');
      if (tex) [[0.65, Math.PI / 2], [-0.65, -Math.PI / 2]].forEach(([ox, ry]) => { const pm = new T.Mesh(new T.PlaneGeometry(15, 2.2), new T.MeshBasicMaterial({ map: tex })); pm.position.set(gx + ox, G + 6.1, gz); pm.rotation.y = ry; g.add(pm); });
      flagpole(B, gx + 3, gz - 12, 12, '#4b5d32'); flagpole(B, gx + 3, gz + 12, 12, '#4b5d32'); watchtower(B, gx - 4, gz - 24, 0); watchtower(B, gx - 4, gz + 24, 0); }
    // ---- army: buildings ----
    const bl = (x, z, w, d, wall, roof, extra) => building(B, Object.assign({ x, z, w, d, wall, roof }, extra), fast);
    bl(-1990, -592, 40, 16, '#cfc5a3', ROOF, { fl: 2, doors: 2 }); flagpole(B, -1990, -541, 18, '#4b5d32', 0.46);                                        // HQ + flag
    bl(-2118, -552, 30, 14, W(), ROOF2, { fl: 1, doors: 2 }); bl(-2118, -592, 18, 12, '#e6e9ea', ROOF, { fl: 1 });                                      // mess hall, aid post
    bl(-1850, -565, 36, 18, W(), ROOF2, { fl: 1, doors: 2 });
    [-2100, -2030, -1960, -1890].forEach(x => bl(x, -380, 48, 14, W(), ROOF, { fl: 2, doors: 2, ry: Math.PI, path: 26 }));                                         // 4 barracks, doors to the avenue
    bl(-2100, -332, 24, 14, '#8f8a78', '#4a4a46', { fl: 1, flat: true, win: false, doors: 1 }); bl(-1990, -332, 40, 18, W(), ROOF2, { fl: 1, doors: 2, win: false });   // armoury, depot
    bl(-1880, -332, 24, 12, '#8f8a78', ROOF2, { fl: 1, doors: 1, win: false });                                                                         // garage by the motor pool
    for (let k = 0; k < (fast ? 10 : 18); k++) { const col = k % 4, row = (k / 4) | 0; if (row > 3 + (fast ? 0 : 1)) break; const vx = -1843 + col * 0 + (k % 2) * 22 - 0, vz = -396 + ((k / 2) | 0) * 11;
      [jeep, truck, apc][k % 3](B, vx, vz, Math.PI / 2 * (k % 2 ? 1 : -1)); }
    // obstacle course props
    [[-1870, -622], [-1850, -610], [-1832, -625], [-1816, -600]].forEach(([x, z], i) => { box(B, '#6a5a44', null, 4, 1.8 + (i % 2) * 0.8, 0.4, x, 0.38, z); box(B, '#6a5a44', null, 0.3, 3, 0.3, x - 2, 0.38, z); box(B, '#6a5a44', null, 0.3, 3, 0.3, x + 2, 0.38, z); });
    for (let i = 0; i < 6; i++) box(B, '#33383d', null, 1.4, 0.5, 1.4, -1876 + i * 2, 0.38, -592);
    flagpole(B, -2118, -625, 12, '#4b5d32');
    // inner fence round the army base + two gates on the avenue + corner towers
    fence(B, [[-2160, -650], [-1780, -650], [-1780, -292], [-2160, -292], [-2160, -650]], fast ? 16 : 8, (x, z) => (Math.abs(x + 1780) < 0.5 || Math.abs(x + 2160) < 0.5) && Math.abs(z - GATE.z) < 7);
    [[-2160, -650], [-1780, -650], [-1780, -292], [-2160, -292]].forEach(([x, z]) => watchtower(B, x, z, 0));
    [-2160, -1780].forEach(x => { booth(B, x, -434, 0); barrier(B, x, -428, 4.2, 0); barrier(B, x, -412, 4.2, Math.PI); box(B, '#6a5a44', null, 1.2, 4.4, 1.2, x, G, -426.2); box(B, '#6a5a44', null, 1.2, 4.4, 1.2, x, G, -413.8); });
    // ---- air force: buildings, aircraft ----
    hangar(B, -2575, -515, 38, 56, 0); hangar(B, -2490, -515, 38, 56, 0); tower(B, -2400, -455);
    bl(-2570, -582, 40, 14, W(), ROOF, { fl: 2, doors: 2 }); bl(-2480, -575, 30, 14, W(), ROOF2, { fl: 1, doors: 2 }); bl(-2350, -545, 22, 14, '#c9705a', '#6b3f33', { fl: 1, doors: 1, win: false });
    [-2605, -2570, -2535].forEach(x => jet(B, x, -445, 0.0)); [-2605, -2570].forEach(x => jet(B, x, -420, 0.0)); transport(B, -2450, -430, 0); heli(B, -2330, -440, 0.5); heli(B, -2360, -415, -0.3);
    for (let i = 0; i < 4; i++) fuelTank(B, -2290 + (i % 2) * 14, -585 + ((i / 2) | 0) * 14, 5); dome(B, -2300, -560); dome(B, -2278, -562); box(B, '#e9e4d8', null, 0.15, 9, 0.15, -2262, G, -300); box(B, '#e6732a', null, 0.1, 0.9, 3.2, -2262, G + 7.4, -298.4);   // windsock
    // ---- navy: yard, buildings, ships ----
    const nb = (x, z, w, d, wall, roof, extra) => building(B, Object.assign({ x, z, w, d, wall, roof, y0: 1.0 }, extra), fast);
    nb(-2625, -770, 40, 16, W(), ROOF, { fl: 2, doors: 2, ry: Math.PI }); nb(-2540, -775, 50, 22, '#8d98a3', '#5f6a73', { fl: 1, doors: 2, win: false, ry: Math.PI }); nb(-2470, -775, 50, 22, '#8d98a3', '#5f6a73', { fl: 1, doors: 2, win: false, ry: Math.PI });
    nb(-2380, -775, 40, 18, W(), ROOF2, { fl: 1, doors: 2, ry: Math.PI }); nb(-2620, -728, 40, 14, W(), ROOF, { fl: 2, doors: 2 });
    for (let i = 0; i < 8; i++) box(B, ['#c9703a', '#3a6f9a', '#b84a3a', '#5a8a5a'][i % 4], null, 6, 2.6, 2.4, -2340 + (i % 4) * 7, 1.0 + ((i / 4) | 0) * 2.6, -808 - 0);   // stacked containers on the quay
    crane(B, -2360, -820, 0); lighthouse(B, -2644, -832);
    frigate(B, -2588.5, -872); frigate(B, -2451.5, -872); sub(B, -2430, -870); [[-2528.5, -870], [-2511.5, -880], [-2511.5, -862]].forEach(([x, z]) => patrol(B, x, z, 0)); patrol(B, -2351, -866, 0);
    // ---- street lamps (5 m poles, light over the road) and quay bollards ----
    const lampsAlong = (x0, x1, z, step, off, y0) => { for (let x = x0; x <= x1; x += step) { lamp(B, x, z - off, Math.PI, y0); lamp(B, x + step / 2, z + off, 0, y0); } };
    lampsAlong(-2170, -1740, GATE.z, 60, 8); lampsAlong(Z.x1 + 30, APP - 20, GATE.z, 70, 8);
    for (let z = -745; z < -260; z += 70) { lamp(B, -2186, z, -Math.PI / 2); lamp(B, -2204, z + 35, Math.PI / 2); }
    for (let x = -2620; x < -2320; x += 50) lamp(B, x, -792, 0, 1.06);
    if (!fast) for (let x = -2646; x < -2300; x += 9) [-1.2].forEach(() => box(B, '#3b3d41', null, 0.45, 0.55, 0.45, x, 1.0, -834.5));
    [[-2640, -742, 0], [-2560, -742, Math.PI], [-2500, -794, 0.2], [-2420, -742, Math.PI]].forEach(([x, z, ry]) => truck(B, x, z, ry, '#aeb4b8', 1.06));
    jeep(B, -2600, -742, Math.PI / 2, '#6b7550', 1.06); jeep(B, -2335, -742, -Math.PI / 2, '#6b7550', 1.06);
    // ---- outer fence (west, south, east; the sea is the north side) + patrol track inside it ----
    fence(B, [[Z.x0, Z.z0], [Z.x0, Z.z1], [Z.x1, Z.z1], [Z.x1, Z.z0]], fast ? 16 : 10, (x, z) => Math.abs(x - Z.x1) < 0.5 && Math.abs(z - GATE.z) < 9);
    slab(B, '#c2b28a', Z.x0 + 3, Z.x0 + 8, Z.z0, Z.z1 - 3, 0.3, 0.38); slab(B, '#c2b28a', Z.x0 + 3, Z.x1 - 3, Z.z1 - 8, Z.z1 - 3, 0.3, 0.38); slab(B, '#c2b28a', Z.x1 - 8, Z.x1 - 3, Z.z0, GATE.z - 8, 0.3, 0.38); slab(B, '#c2b28a', Z.x1 - 8, Z.x1 - 3, GATE.z + 8, Z.z1 - 3, 0.3, 0.38);
    [[Z.x0, Z.z0 + 4], [Z.x0, Z.z1], [Z.x1, Z.z1], [Z.x0, -420], [(Z.x0 + Z.x1) / 2, Z.z1], [Z.x1, -700]].forEach(([x, z]) => watchtower(B, x, z, 0));
    let tris = B.build(g);
    // ---- hills round the base (flat-shaded, same greens as the country hills) ----
    { const X0 = -3400, X1 = -1250, ZA = -800, ZB = -40, CELL = fast ? 40 : 28, nx = Math.round((X1 - X0) / CELL), nz = Math.round((ZB - ZA) / CELL), pos = [], col = [], idx = [], lo = new T.Color('#86ad5c'), hi = new T.Color('#5e8f45'), top = new T.Color('#9db86a'), dry = new T.Color('#a8a76a'), cc = new T.Color(), HH = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = X0 + (X1 - X0) * i / nx, z = ZA + (ZB - ZA) * j / nz, h = hillH(x, z); HH.push(h); pos.push(x, 0.34 + h, z); const k = h / 24; cc.copy(lo).lerp(k > 0.7 ? top : hi, Math.min(1, k * 1.2)).lerp(dry, sst((noise(x / 70, z / 70, 11) - 0.55) * 3) * 0.55); col.push(cc.r, cc.g, cc.b); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b2 = a + 1, c = a + nx + 1, d = c + 1; if (Math.max(HH[a], HH[b2], HH[c], HH[d]) < 0.05) continue;
        const cx = X0 + (X1 - X0) * (i + 0.5) / nx, cz = ZA + (ZB - ZA) * (j + 0.5) / nz; if (cx > Z.x0 - 30 && cx < Z.x1 + 30 && cz > Z.z0 - 30 && cz < Z.z1 + 30) continue; idx.push(a, c, b2, b2, c, d); }
      const G3 = new T.BufferGeometry(); G3.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G3.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G3.setIndex(idx); G3.computeVertexNormals(); tris += idx.length / 3;
      g.add(new T.Mesh(G3, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }))); }
    // ---- trees: groves on the hills and in the gaps round the fence, a few windbreak lines ----
    { const TR = [], NT = fast ? 240 : 560, R2 = rng(808);
      for (let i = 0; i < NT * 6 && TR.length < NT; i++) { const x = -3350 + R2() * 2050, z = -790 + R2() * 740; if (noise(x / 160, z / 160, 21) < 0.5) continue;
        const dx = Math.max(Z.x0 - x, x - Z.x1, 0), dz = Math.max(Z.z0 - z, z - Z.z1, 0); if (Math.hypot(dx, dz) < 18) continue; if (x > Z.x1 && Math.abs(z - GATE.z) < 24) continue; if (z < -770) continue;
        TR.push({ x, y: 0.3 + hillH(x, z), z, r: R2() * 6.28, s: 1.4 + R2() * 1.1, k: R2() < 0.55 ? 'p' : 'r', c: (R2() * 4) | 0 }); }
      for (let x = Z.x0 + 20; x < Z.x1 - 20; x += 34) if (R2() < 0.7) TR.push({ x, y: G, z: Z.z1 - 22, r: R2() * 6, s: 1.3, k: 'r', c: (R2() * 4) | 0 });
      trees(g, TR, fast); g.userData.treeCount = TR.length; }
    g.userData.tris = tris; g.userData.zone = Z; g.userData.gate = GATE; return g; }

  root.VinlandForces = { forces, Z, GATE, hillH };
})(window);
