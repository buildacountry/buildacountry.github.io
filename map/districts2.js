// VINLAND · SECOND HOME COAST (Dev, 23 Nov): personality districts in a softer low-poly "diorama" style (no ink outlines, flat shading).
// Each builder returns a THREE.Group centred on (0, 0, 0), metres, ground at y = 0, plus .userData.homes = [{x, z, ry}] (where homes go).
// Not on the map yet: preview first, Dev OKs, then the map loads this file and places the districts in the countryside.
(function (root) {
  const T = root.THREE;
  const M = {}, mat = c => M[c] || (M[c] = new T.MeshLambertMaterial({ color: c, flatShading: true }));
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function mesh(g, geo, c, x = 0, y = 0, z = 0, o = {}) { const m = new T.Mesh(geo, typeof c === 'string' ? mat(c) : c); m.position.set(x, y, z);
    if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; if (o.s) m.scale.set(...o.s); m.castShadow = o.shadow !== false; m.receiveShadow = true; g.add(m); return m; }
  const box = (g, w, h, d, c, x, y, z, o) => mesh(g, new T.BoxGeometry(w, h, d).translate(0, h / 2, 0), c, x, y, z, o);
  function prism(g, w, h, d, c, x, y, z, o) { const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
    return mesh(g, new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), c, x, y, z, o); }
  // a flat ribbon along a smooth curve (paths, streams)
  function ribbon(g, pts, w, c, y, closed) { const cur = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], 0, p[1])), !!closed), n = Math.max(8, Math.round(cur.getLength() / 2)), P = cur.getSpacedPoints(n), pos = [], idx = [];
    P.forEach((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
      pos.push(p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz); if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } });
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new T.Mesh(geo, mat(c)); m.receiveShadow = true; g.add(m); return P; }
  // instanced trees: chunky two-tier pines + round blob trees, a little colour variety
  function forest(g, list, fast) {
    const pine = list.filter(t => t.k === 'p'), round = list.filter(t => t.k === 'r'), O = new T.Object3D(), col = new T.Color();
    const make = (geo, c, L, f) => { const im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), L.length); im.castShadow = !fast; im.receiveShadow = true;
      L.forEach((t, i) => { O.position.set(t.x, t.y || 0, t.z); O.rotation.set(0, t.r, 0); O.scale.setScalar(t.s); O.updateMatrix(); im.setMatrixAt(i, O.matrix); im.setColorAt(i, col.set(f ? f(t) : c)); }); g.add(im); };
    const trunk = new T.CylinderGeometry(0.25, 0.35, 1.6, 6).translate(0, 0.8, 0);
    make(trunk, '#7a5236', pine.concat(round));
    const pg = new T.ConeGeometry(2.2, 3.6, 7).translate(0, 2.9, 0); pg.merge ? 0 : 0;
    const pg2 = new T.ConeGeometry(1.6, 3.0, 7).translate(0, 5.0, 0);
    const PC = ['#3f7a3a', '#4a8a40', '#356b33'], RC = ['#6aa84f', '#7cb85a', '#5e9a45', '#8cc063'];
    make(pg, null, pine, t => PC[t.c % 3]); make(pg2, null, pine, t => PC[(t.c + 1) % 3]);
    make(new T.IcosahedronGeometry(2.3, 0).translate(0, 3.6, 0), null, round, t => RC[t.c % 4]);
  }
  // ---------- the cabin (introvert style: wooden, warm, its own little clearing) ----------
  function cabin(g, x, z, ry, r) {
    const c = new T.Group(); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c);
    const WOOD = ['#a8683f', '#9a5f3a', '#b5774a'][(r() * 3) | 0], ROOF = ['#a8432f', '#8f3a2a', '#b5543a', '#6b4a3a'][(r() * 4) | 0];
    box(c, 7.4, 0.5, 6.4, '#8a8278', 0, 0, 0);                                   // stone footing
    box(c, 7, 3.6, 6, WOOD, 0, 0.5, 0);
    for (let k = 0; k < 4; k++) box(c, 7.1, 0.12, 6.1, '#7a4a2c', 0, 1.1 + k * 0.8, 0, { shadow: false });   // log lines
    prism(c, 8.4, 3.2, 7.2, ROOF, 0, 4.1, 0);                                    // gable roof
    box(c, 1.2, 2.2, 0.2, '#5a3a24', 1.6, 0.5, 3.05); box(c, 1.3, 1.1, 0.15, '#ffd27a', -1.6, 1.9, 3.05);   // door + warm window
    box(c, 7, 0.25, 2.2, '#b98a5a', 0, 0.35, 4.1); [-3.2, 3.2].forEach(dx => box(c, 0.25, 2.4, 0.25, '#7a4a2c', dx, 0.5, 5.0));   // porch
    prism(c, 7.6, 0.9, 2.4, ROOF, 0, 2.9, 4.1, { s: [1, 0.6, 1] });
    box(c, 1, 2.4, 1, '#8a8278', 2.2, 5.0, -1.2);                                // chimney
    if (r() < 0.6) { box(c, 0.9, 0.5, 0.5, '#7a4a2c', -2.6, 0.5, 4.6); }         // a little bench on the porch
    return c;
  }
  // ---------- INTROVERT ISLAND: an island in a lake, cabins far apart, no roads (only paths), docks with rowboats ----------
  function introvertIsland(o = {}) {
    const r = rng(o.seed || 731), g = new T.Group(), R = o.radius || 140, N = o.homes || 24, fast = !!o.fast;
    const rad = a => R * (1 + 0.13 * Math.sin(3 * a + 1.1) + 0.07 * Math.sin(5 * a + 0.4) + 0.04 * Math.sin(9 * a));
    const outline = k => { const pts = []; for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2, rr = rad(a) * k; pts.push(new T.Vector2(Math.cos(a) * rr, -Math.sin(a) * rr)); } return new T.Shape(pts); };
    const inside = (x, z, m = 0) => Math.hypot(x, z) < rad(Math.atan2(-z, x)) - m;
    // water (the lake) + sand rim + the island (green top, earthy cliff)
    mesh(g, new T.CircleGeometry(R * 2.1, 48).rotateX(-Math.PI / 2), '#4f9fc4', 0, -2.2, 0, { shadow: false });
    mesh(g, new T.CircleGeometry(R * 1.35, 48).rotateX(-Math.PI / 2), '#6db4d4', 0, -2.15, 0, { shadow: false });
    mesh(g, new T.ExtrudeGeometry(outline(1.07), { depth: 1.8, bevelEnabled: false }).rotateX(-Math.PI / 2), [mat('#e8d39a'), mat('#cdb27a')], 0, -2.4, 0, { shadow: false });
    mesh(g, new T.ExtrudeGeometry(outline(1.0), { depth: 3.2, bevelEnabled: false }).rotateX(-Math.PI / 2), [mat('#7cb34f'), mat('#8a6a4a')], 0, -3.2, 0, { shadow: false });
    // the stream: from the north shore, winding south-east to the sea side, with sandy banks
    const S = [[-R * 0.12, -R * 0.82], [-R * 0.05, -R * 0.55], [-R * 0.25, -R * 0.15], [R * 0.05, R * 0.2], [R * 0.4, R * 0.35], [R * 0.62, R * 0.55], [R * 0.74, R * 0.72]];
    ribbon(g, S, 14, '#d8c48f', 0.04); const SP = ribbon(g, S, 9, '#5fb3d9', 0.08);
    const nearStream = (x, z, m) => SP.some(p => Math.hypot(p.x - x, p.z - z) < m);
    // home spots: far apart (Poisson-ish), on land, away from the stream
    const homes = []; for (let i = 0; i < 4000 && homes.length < N; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!inside(x, z, 16) || nearStream(x, z, 18) || homes.some(h => Math.hypot(h.x - x, h.z - z) < 30)) continue; homes.push({ x, z, ry: Math.atan2(-x, -z) + (r() - 0.5) * 0.6 }); }
    // docks on the shore (4) + rowboats
    const docks = [0.6, 2.2, 3.7, 5.2].map(a => { const rr = rad(a), x = Math.cos(a) * rr, z = -Math.sin(a) * rr; return { x, z, a }; });
    docks.forEach(({ x, z, a }) => { const d = new T.Group(); d.position.set(x, 0, z); d.rotation.y = Math.PI / 2 - a; g.add(d);
      for (let k = 0; k < 7; k++) box(d, 3.4, 0.25, 1.5, k % 2 ? '#b98a5a' : '#a87a4a', 0, 0.1, 2 + k * 1.6); [-1.6, 1.6].forEach(dx => [4, 9, 13].forEach(dz => box(d, 0.35, 2.6, 0.35, '#7a4a2c', dx, -2.2, dz, { shadow: false })));
      const b = new T.Group(); b.position.set(3.4, -1.9, 11); b.rotation.y = 0.3; d.add(b); box(b, 1.8, 0.6, 4.2, '#a8683f', 0, 0, 0); box(b, 1.4, 0.2, 3.6, '#7a4a2c', 0, 0.45, 0); box(b, 1.5, 0.12, 0.4, '#c9a46a', 0, 0.62, 0.2); });
    // paths: every cabin to its nearest neighbour or dock (a little web, no roads), drawn as winding dirt ribbons
    const nodes = homes.map(h => [h.x, h.z]).concat(docks.map(d => [d.x * 0.9, d.z * 0.9])), used = [nodes[0]], left = nodes.slice(1), edges = [];
    while (left.length) { let bi = 0, bj = 0, bd = 1e9; left.forEach((p, i) => used.forEach((q, j) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; bi = i; bj = j; } })); edges.push([left[bi], used[bj]]); used.push(left[bi]); left.splice(bi, 1); }
    const bridges = [];
    edges.forEach(([a, b]) => { const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * 14, mz = (a[1] + b[1]) / 2 + (r() - 0.5) * 14; const P = ribbon(g, [a, [mx, mz], b], 3.2, '#c9a46a', 0.06);
      const cross = P.find(p => nearStream(p.x, p.z, 4.5)); if (cross && !bridges.some(q => Math.hypot(q.x - cross.x, q.z - cross.z) < 25)) bridges.push(cross); });
    bridges.slice(0, 4).forEach(p => { const i = SP.reduce((bi, q, k) => Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(SP[bi].x - p.x, SP[bi].z - p.z) ? k : bi, 0), q = SP[i], q2 = SP[Math.min(SP.length - 1, i + 1)];
      const ang = Math.atan2(q2.x - q.x, q2.z - q.z), br = new T.Group(); br.position.set(q.x, 0, q.z); br.rotation.y = ang + Math.PI / 2; g.add(br);
      for (let k = -3; k <= 3; k++) box(br, 3.6, 0.3, 1.6, k % 2 ? '#b98a5a' : '#a87a4a', 0, 0.25 + (9 - k * k) * 0.08, k * 1.7); [-1.8, 1.8].forEach(dx => box(br, 0.2, 0.9, 12, '#7a4a2c', dx, 0.9, 0)); });
    // cabins + each one's clearing and props (bench, hammock, tent, campfire, lantern)
    homes.forEach(h => { mesh(g, new T.CircleGeometry(13, 12).rotateX(-Math.PI / 2), '#93c25e', h.x, 0.03, h.z, { shadow: false }); cabin(g, h.x, h.z, h.ry, r);
      const side = r() < 0.5 ? -1 : 1, px = h.x + Math.cos(h.ry) * 8 * side, pz = h.z - Math.sin(h.ry) * 8 * side, k = r();
      if (k < 0.35) { mesh(g, new T.CylinderGeometry(1.1, 1.3, 0.4, 8), '#8a8278', px, 0, pz); [0, 1.2, 2.4].forEach(a => box(g, 0.3, 0.3, 1.6, '#7a4a2c', px + Math.cos(a) * 0.4, 0.3, pz + Math.sin(a) * 0.4, { ry: a })); mesh(g, new T.ConeGeometry(0.6, 1.2, 5), '#f2a03a', px, 0.9, pz); }   // campfire
      else if (k < 0.6) prism(g, 3.6, 2.6, 3.8, ['#d88a3a', '#3f8f8a', '#c8603f'][(r() * 3) | 0], px, 0, pz, { ry: h.ry });   // tent
      else if (k < 0.8) { [-1.6, 1.6].forEach(dx => box(g, 0.25, 1.8, 0.25, '#7a4a2c', px + dx, 0, pz)); box(g, 3.2, 0.12, 1.0, '#e8e1cf', px, 1.0, pz, { rz: 0.06 }); }   // hammock
      else { box(g, 2.2, 0.15, 0.6, '#a87a4a', px, 0.6, pz, { ry: h.ry }); }   // a bench facing nowhere in particular
      box(g, 0.15, 2.2, 0.15, '#3a2f28', h.x + Math.sin(h.ry) * 7 + 3, 0, h.z + Math.cos(h.ry) * 7, { shadow: false }); mesh(g, new T.SphereGeometry(0.4, 6, 4), new T.MeshBasicMaterial({ color: '#ffd27a' }), h.x + Math.sin(h.ry) * 7 + 3, 2.4, h.z + Math.cos(h.ry) * 7, { shadow: false }); });
    // rocks along the shore
    for (let i = 0; i < 34; i++) { const a = r() * Math.PI * 2, rr = rad(a) * (0.98 + r() * 0.1); mesh(g, new T.DodecahedronGeometry(1 + r() * 2.2, 0), r() < 0.5 ? '#9a958c' : '#b4ab9b', Math.cos(a) * rr, -0.6, -Math.sin(a) * rr, { ry: r() * 3 }); }
    // the forest: dense, everywhere except clearings, paths and the stream
    const trees = [], NT = fast ? 380 : 700;
    for (let i = 0; i < NT * 6 && trees.length < NT; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!inside(x, z, 5) || nearStream(x, z, 9) || homes.some(h => Math.hypot(h.x - x, h.z - z) < 14)) continue; trees.push({ x, z, r: r() * 6, s: 0.8 + r() * 0.7, k: r() < 0.6 ? 'p' : 'r', c: (r() * 12) | 0 }); }
    forest(g, trees, fast);
    g.userData.homes = homes; g.userData.radius = R * 1.15; return g;
  }

  // =====================================================================================================================
  // INTROVERT ISLAND v2 (Dev, 23 Nov 23:20): a real island IN THE SEA off the south coast, ~1 km long, like Dev's reference renders:
  // rocky cliffs + beach coves, a hill with a lookout tower, a lighthouse on a rocky point, a plaza (gazebo + fountain), a greenhouse
  // garden, a sports court, a harbour with boats, a stream with ponds and bridges, cottages + A-frame cabins along winding paths.
  // Everything static is MERGED by colour (a handful of draw calls, fast on phones); trees are instanced. Local frame: long axis = z.
  // =====================================================================================================================
  const GEO = {}, gget = (k, f) => GEO[k] || (GEO[k] = f());
  const UB = () => gget('box', () => new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const UP = () => gget('prism', () => { const s = new T.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0); return new T.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5); });
  const UC = n => gget('cyl' + n, () => new T.CylinderGeometry(1, 1, 1, n).translate(0, 0.5, 0));
  const UK = n => gget('cone' + n, () => new T.ConeGeometry(1, 1, n).translate(0, 0.5, 0));
  const glass = new T.MeshLambertMaterial({ color: '#cfe8ee', transparent: true, opacity: 0.55 }), glow = new T.MeshBasicMaterial({ color: '#ffd27a' });
  function Batch() { const m = new Map(), V = new T.Vector3(), Q = new T.Quaternion(), E = new T.Euler(), S = new T.Vector3();
    const api = { add(geo, c, base, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
        const L = new T.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)), g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(base ? base.clone().multiply(L) : L);
        if (!m.has(c)) m.set(c, []); m.get(c).push(g); },
      build(group, shadow) { m.forEach((list, c) => { let n = 0; list.forEach(g => { n += g.attributes.position.count; }); const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
        list.forEach(g => { g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
        const G = new T.BufferGeometry(); G.setAttribute('position', new T.BufferAttribute(pos, 3)); G.setAttribute('normal', new T.BufferAttribute(nor, 3));
        const me = new T.Mesh(G, c === 'glass' ? glass : c === 'glow' ? glow : mat(c)); me.castShadow = shadow && c !== 'glass'; me.receiveShadow = true; group.add(me); }); } };
    return api; }
  const at = (x, y, z, ry = 0, s = 1) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry), new T.Vector3(s, s, s));
  function introvertIsland2(o = {}) {
    const r = rng(o.seed || 2311), g = new T.Group(), Wd = o.width || 420, Ln = o.length || 980, fast = !!o.fast, B = Batch();
    const hw = Wd / 2, hl = Ln / 2, rN = a => 1 + 0.09 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(5 * a + 2.1) + 0.035 * Math.sin(9 * a + 0.3) + 0.02 * Math.sin(15 * a);
    const qOf = (x, z) => { const u = x / hw, v = z / hl; return Math.hypot(u, v) / rN(Math.atan2(v, u)); };
    const dist = (x, z) => (1 - qOf(x, z)) * hw;                                   // ~metres inland (negative = sea)
    const cliffy = (x, z) => Math.sin(Math.atan2(z / hl, x / hw) * 4 + 0.9) > -0.15;   // most of the shore is cliff, the rest are beach coves
    const HILL = [0, hl * 0.42, 110, 160, 50], BUMPS = [[-hw * 0.35, -hl * 0.25, 60, 9], [hw * 0.3, -hl * 0.05, 70, 7], [hw * 0.2, -hl * 0.55, 60, 8], [-hw * 0.2, hl * 0.05, 55, 6]];
    const hRaw = (x, z) => { const d = dist(x, z); let base;
      if (d < 0) base = -4 + Math.max(-10, d * 0.25);
      else if (cliffy(x, z)) base = Math.min(9, d < 3 ? d * 0.6 : 1.8 + (d - 3) * 1.6); else base = Math.min(9, d * 0.22);
      if (d > 4) { const [hx, hz, rx, rz, hh] = HILL, k = Math.exp(-((x - hx) ** 2 / rx ** 2 + (z - hz) ** 2 / rz ** 2)); base += hh * k * Math.min(1, d / 40);
        BUMPS.forEach(([bx, bz, br, bh]) => { base += bh * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / br ** 2); }); base += 0.8 * Math.sin(x * 0.07) * Math.cos(z * 0.06); }
      return base; };
    // the plaza sits on FLAT ground (Dev 23 Nov: no floating disc): level circle r 36, smooth slope back to the hill by r 62
    const PLZ = [-hw * 0.08, -hl * 0.02], PL = hRaw(PLZ[0], PLZ[1]);
    const h = (x, z) => { const q = Math.hypot(x - PLZ[0], z - PLZ[1]); if (q > 62) return hRaw(x, z); const t = Math.max(0, (q - 36) / 26), k = t * t * (3 - 2 * t); return PL + (hRaw(x, z) - PL) * k; };
    // ---- terrain: one height-mapped grid, vertex colours (grass / sand / rock / sea floor) ----
    { const gw = Wd * 1.25, gl = Ln * 1.18, nx = fast ? 90 : 140, nz = fast ? 200 : 300, G = new T.PlaneGeometry(gw, gl, nx, nz).rotateX(-Math.PI / 2), P = G.attributes.position, col = [];
      const GR = [new T.Color('#86c25a'), new T.Color('#79b651'), new T.Color('#92ca63')], SAND = new T.Color('#ecd49a'), ROCK = new T.Color('#9c8f80'), ROCK2 = new T.Color('#8a7f72'), DEEP = new T.Color('#c9b98e');
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = h(x, z), d = dist(x, z); P.setY(i, y);
        const sl = Math.abs(h(x + 1.5, z) - h(x - 1.5, z)) + Math.abs(h(x, z + 1.5) - h(x, z - 1.5)); let c;
        if (d < -2) c = DEEP; else if (sl > 2.6 && d < 30) c = (i % 3 ? ROCK : ROCK2); else if (d < 9 && y < 3.2) c = SAND; else c = GR[(Math.floor(x / 9) + Math.floor(z / 9)) % 3 & 3] || GR[0];
        if (y > 30) c = c.clone().lerp(new T.Color('#a7c46e'), 0.4); col.push(c.r, c.g, c.b); }
      G.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G.computeVertexNormals();
      const m = new T.Mesh(G, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.receiveShadow = true; g.add(m); }
    // ---- the stream from the hill to the sea, with two ponds ----
    const SPTS = [[hw * 0.05, hl * 0.22], [-hw * 0.12, hl * 0.06], [-hw * 0.02, -hl * 0.12], [hw * 0.22, -hl * 0.24], [hw * 0.12, -hl * 0.42], [hw * 0.36, -hl * 0.62], [hw * 0.62, -hl * 0.74]];
    const cur = new T.CatmullRomCurve3(SPTS.map(p => new T.Vector3(p[0], 0, p[1]))), SP = o.stream ? cur.getSpacedPoints(120).filter(p => dist(p.x, p.z) > 1) : [];   // Dev 23 Nov: no stream on this island   // stops at the beach
    const nearStream = (x, z, m) => SP.some(p => Math.hypot(p.x - x, p.z - z) < m);
    const drape = (pts, w, c, lift) => { const pos = [], idx = []; pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
        pos.push(p.x + nx, h(p.x + nx, p.z + nz) + lift, p.z + nz, p.x - nx, h(p.x - nx, p.z - nz) + lift, p.z - nz); if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } });
      const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G.setIndex(idx); G.computeVertexNormals(); B.add(G, c, null); };
    if (o.stream) { drape(SP, 13, '#d8c48f', 0.25); drape(SP, 8, '#5fb3d9', 0.45); }
    if (o.stream) [[SPTS[0][0], SPTS[0][1], 11], [SPTS[2][0], SPTS[2][1], 16], [SPTS[4][0], SPTS[4][1], 13]].forEach(([x, z, rr]) => { B.add(UC(16), '#d8c48f', null, x, h(x, z) + 0.2, z, rr + 4, 0.3, rr * 0.8 + 4); B.add(UC(16), '#5fb3d9', null, x, h(x, z) + 0.45, z, rr, 0.3, rr * 0.8); });
    // ---- landmarks ----
    const top = [HILL[0], HILL[1]], ty = h(top[0], top[1]);
    if (o.extras) { const M = at(top[0], ty, top[1]); [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([dx, dz]) => B.add(UB(), '#7a4a2c', M, dx, 0, dz, 0.5, 11, 0.5));   // LOOKOUT TOWER
      B.add(UB(), '#a87a4a', M, 0, 11, 0, 6.4, 0.5, 6.4); [-3, 3].forEach(d => { B.add(UB(), '#7a4a2c', M, d, 11.5, 0, 0.3, 1.4, 6.4); B.add(UB(), '#7a4a2c', M, 0, 11.5, d, 6.4, 1.4, 0.3); });
      B.add(UK(4), '#8a3a2a', M, 0, 14.6, 0, 5.2, 3, 5.2, 0, Math.PI / 4); [-2.8, 2.8].forEach(d => [-2.8, 2.8].forEach(e => B.add(UB(), '#7a4a2c', M, d, 11.5, e, 0.3, 3.2, 0.3)));
      B.add(UB(), '#7a4a2c', M, 0, 17.4, 0, 0.15, 3, 0.15); B.add(UB(), '#c8402f', M, 0.8, 19.4, 0, 1.6, 1, 0.08);
      for (let k = 0; k < 7; k++) B.add(UB(), '#b98a5a', M, 3.4 + k * 1.1, 0, -1 + k * 0.6, 1.4, 0.3 + k * 1.5, 1.2); }   // stairs
    let lh = null; { let best = -1e9; for (let a = 0; a < 6.283; a += 0.05) { const rr = rN(a), x = Math.cos(a) * hw * rr * 0.96, z = Math.sin(a) * hl * rr * 0.96; if (z * 0.6 - x > best && cliffy(x, z)) { best = z * 0.6 - x; lh = [x, z]; } } }
    { const [x, z] = lh, y = h(x, z), M = at(x, y, z, 0, 1.7); B.add(UC(10), '#8a8278', M, 0, -1, 0, 5.2, 2, 5.2);            // LIGHTHOUSE on its rocky point
      for (let k = 0; k < 6; k++) B.add(UC(12), k % 2 ? '#d23b2c' : '#f6f0e2', M, 0, 1 + k * 3.2, 0, 3.4 - k * 0.22, 3.2, 3.4 - k * 0.22);
      B.add(UC(12), '#2f2b28', M, 0, 20.2, 0, 2.6, 0.5, 2.6); B.add(UC(10), 'glow', M, 0, 20.7, 0, 1.6, 2.2, 1.6); B.add(UK(10), '#d23b2c', M, 0, 22.9, 0, 2.2, 2.4, 2.2);
      B.add(UB(), '#f6f0e2', M, 5, 0, 2, 6, 3.4, 5); B.add(UP(), '#d23b2c', M, 5, 3.4, 2, 6.8, 2.2, 5.6, 0, Math.PI / 2); }
    const plaza = [-hw * 0.08, -hl * 0.02], pY = h(plaza[0], plaza[1]);
    { const M = at(plaza[0], pY, plaza[1]); B.add(UC(24), '#dcc9a2', M, 0, -0.3, 0, 26, 0.55, 26); B.add(UC(24), '#cdb68a', M, 0, -0.28, 0, 18, 0.55, 18);   // PLAZA
      { const Hm = at(plaza[0], pY, plaza[1] + 4, 0);   // THE HALL (the island's one building until people move in)
        B.add(UB(), '#9a8f80', Hm, 0, -0.6, 0, 26, 1.6, 15); B.add(UB(), '#b9ad98', Hm, 0, 0, -9, 10, 0.5, 4);      // stone base + front steps
        B.add(UB(), '#f2e6d6', Hm, 0, 1, 0, 24, 7, 13); B.add(UP(), '#7a3a2a', Hm, 0, 8, 0, 26, 6.5, 15, 0, Math.PI / 2);   // walls + big roof
        B.add(UB(), '#a87a4a', Hm, 0, 1, -6.6, 24.2, 0.5, 0.3); B.add(UB(), '#a87a4a', Hm, 0, 7.6, -6.6, 24.2, 0.5, 0.4);
        for (let k = -5; k <= 5; k += 2) { B.add(UB(), '#f6f0e2', Hm, k * 2, 2.4, -6.6, 1.8, 3.4, 0.2); B.add(UB(), 'glow', Hm, k * 2, 2.6, -6.7, 1.3, 3, 0.15); }
        B.add(UB(), '#5a3a24', Hm, 0, 1, -6.8, 3, 5, 0.3); B.add(UP(), '#f2e6d6', Hm, 0, 8, -7.1, 6, 3, 0.4);            // big door + gable
        [-4, 4].forEach(dx => B.add(UC(8), '#f6f0e2', Hm, dx, 0.6, -8.4, 0.45, 7.4, 0.45)); B.add(UB(), '#7a3a2a', Hm, 0, 8, -8.4, 9.6, 0.5, 3.6);   // porch
        B.add(UB(), '#f2e6d6', Hm, 0, 14, 3, 3.4, 4.4, 3.4); B.add(UB(), '#3f4a52', Hm, 0, 15.4, 1.28, 1.6, 2, 0.1); B.add(UK(4), '#7a3a2a', Hm, 0, 18.4, 3, 3.2, 4.2, 3.2, 0, Math.PI / 4);   // bell tower
        B.add(UB(), '#2f2b28', Hm, 0, 22.6, 3, 0.15, 2.6, 0.15); B.add(UB(), '#3f7fbf', Hm, 0.7, 24.2, 3, 1.4, 0.9, 0.08); }
      const F = at(plaza[0], pY, plaza[1] - 16); B.add(UC(16), '#e9e1cf', F, 0, 0, 0, 5, 1, 5); B.add(UC(16), '#5fb3d9', F, 0, 0.6, 0, 4.3, 0.5, 4.3); B.add(UC(10), '#e9e1cf', F, 0, 0.6, 0, 0.8, 2.6, 0.8); B.add(UC(12), '#e9e1cf', F, 0, 3.0, 0, 2.1, 0.5, 2.1); B.add(UC(12), '#7fc6e2', F, 0, 3.3, 0, 1.8, 0.4, 1.8);   // FOUNTAIN
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; B.add(UB(), '#a87a4a', M, Math.cos(a) * 21, 0, Math.sin(a) * 21, 3, 0.6, 1, 0, -a + Math.PI / 2); B.add(UB(), '#2f2b28', M, Math.cos(a + 0.5) * 23, 0, Math.sin(a + 0.5) * 23, 0.2, 3.6, 0.2); B.add(UC(6), 'glow', M, Math.cos(a + 0.5) * 23, 3.6, Math.sin(a + 0.5) * 23, 0.5, 0.6, 0.5); }
    }
    const gh = [-hw * 0.4, hl * 0.08]; if (o.extras) { const y = h(gh[0], gh[1]), M = at(gh[0], y, gh[1], 0.3);                       // GREENHOUSE + vegetable garden
      B.add(UB(), '#f6f0e2', M, 0, 0, 0, 12.4, 0.5, 8.4); B.add(UB(), 'glass', M, 0, 0.5, 0, 12, 4, 8); B.add(UP(), 'glass', M, 0, 4.5, 0, 8, 2.6, 12, 0, Math.PI / 2);
      for (let k = -2; k <= 2; k++) B.add(UB(), '#f6f0e2', M, k * 3, 0.5, 4.05, 0.2, 4, 0.2);
      for (let row = 0; row < 6; row++) { B.add(UB(), '#7a5236', M, -2 + row * 3.2, 0, 14, 2, 0.4, 12); for (let k = 0; k < 5; k++) B.add(UC(6), row % 2 ? '#5e9a45' : '#8cc063', M, -2 + row * 3.2, 0.4, 9.5 + k * 2.3, 0.9, 0.9, 0.9); } }
    const ct = [hw * 0.42, hl * 0.1]; if (o.extras) { const y = h(ct[0], ct[1]), M = at(ct[0], y, ct[1], -0.2);                       // SPORTS COURT
      B.add(UB(), '#9a8f80', M, 0, -4, 0, 23, 4, 33); B.add(UB(), '#3f8f5a', M, 0, -0.2, 0, 22, 0.6, 32); B.add(UB(), '#c8603f', M, 0, -0.15, 0, 16, 0.6, 26); B.add(UB(), '#f6f0e2', M, 0, 0.2, 0, 16, 0.1, 0.3); [-11.5, 11.5].forEach(d => { B.add(UB(), '#5b5f66', M, 0, 0, d, 0.3, 4, 0.3); B.add(UB(), '#f6f0e2', M, 0, 3.6, d * 0.95, 2, 1.4, 0.15); });
      [-11, 11].forEach(d => B.add(UB(), '#9aa3a8', M, d, 0, 0, 0.12, 3, 32)); B.add(UB(), '#a87a4a', M, -12.5, 0, 0, 1.2, 0.8, 10); }
    let hb = null; { let best = -1e9; for (let a = 0; a < 6.283; a += 0.04) { const rr = rN(a), x = Math.cos(a) * hw * rr, z = Math.sin(a) * hl * rr; const sc = x - Math.abs(z + hl * 0.3) * 0.5; if (!cliffy(x * 0.98, z * 0.98) && sc > best) { best = sc; hb = [x, z, a]; } } }
    if (!hb) hb = [hw, -hl * 0.3, 0];
    { const [x, z, a] = hb, nx = Math.cos(a), nz = Math.sin(a) * hw / hl, l = Math.hypot(nx, nz), M = at(x - nx / l * 6, 0, z - nz / l * 6, Math.atan2(nx, nz));   // HARBOUR: an L-shaped pier, boats, a boat house
      for (let k = 0; k < 14; k++) { B.add(UB(), k % 2 ? '#b98a5a' : '#a87a4a', M, 0, 0.6, 2 + k * 2, 4, 0.35, 2); if (k % 3 === 0) [-1.9, 1.9].forEach(dx => B.add(UB(), '#7a4a2c', M, dx, -3, 2 + k * 2, 0.4, 3.8, 0.4)); }
      for (let k = 0; k < 9; k++) B.add(UB(), k % 2 ? '#b98a5a' : '#a87a4a', M, 3 + k * 2, 0.6, 29, 2, 0.35, 4);
      [[6, 23, 0.2, '#a8683f'], [12, 24, -0.1, '#f6f0e2'], [9, 35, 0.4, '#3f7fbf']].forEach(([bx, bz, ry, c]) => { B.add(UB(), c, M, bx, -0.4, bz, 2.2, 1, 5.5, 0, ry); B.add(UB(), '#7a4a2c', M, bx, 0.5, bz, 1.8, 0.2, 4.6, 0, ry); });
      const S2 = at(0, 0, 0); B.add(UB(), '#f6f0e2', M, 22, -0.4, 36, 2.8, 1.4, 8); B.add(UB(), '#c8a46a', M, 22, 1.0, 36, 0.25, 12, 0.25); B.add(UP(), '#ffffff', M, 22, 1.8, 35, 6, 9, 0.15, 0, Math.PI / 2);   // sailboat
      const bh = at(x - nx / l * 16, h(x - nx / l * 16, z - nz / l * 16), z - nz / l * 16, Math.atan2(nx, nz)); B.add(UB(), '#a8683f', bh, 0, 0, 0, 9, 4, 7); B.add(UP(), '#6b3f2c', bh, 0, 4, 0, 10, 3, 8, 0, Math.PI / 2); B.add(UB(), '#5a3a24', bh, 0, 0, 3.55, 3, 3, 0.2); }
    // ---- homes: cottages + A-frames, spread out, on gentle ground ----
    const N = o.homes || 110, homes = [], busy = [[plaza[0], plaza[1], 50], [lh[0], lh[1], 30], [hb[0], hb[1], 40]].concat(o.extras ? [[gh[0], gh[1] + 6, 26], [ct[0], ct[1], 28], [top[0], top[1], 26]] : []);
    for (let i = 0; i < 20000 && homes.length < N; i++) { const x = (r() * 2 - 1) * hw, z = (r() * 2 - 1) * hl, d = dist(x, z); if (d < 22) continue;
      const y = h(x, z), sl = Math.abs(h(x + 4, z) - h(x - 4, z)) + Math.abs(h(x, z + 4) - h(x, z - 4)); if (sl > 3.2 || nearStream(x, z, 16) || busy.some(([bx, bz, br]) => Math.hypot(bx - x, bz - z) < br) || homes.some(q => Math.hypot(q.x - x, q.z - z) < 27)) continue;
      const ry = Math.atan2(plaza[0] - x, plaza[1] - z) + (r() - 0.5) * 0.9; homes.push({ x, y, z, ry, k: r() < 0.72 ? 'c' : 'a' }); }
    const WALL = ['#f4ecdc', '#efe2c6', '#f2e6d6', '#e8dcc6'], ROOF = ['#8a4a32', '#6b3f2c', '#9a5a3a', '#5a4a42', '#7a3a2a'], WOOD = ['#a8683f', '#9a5f3a', '#b5774a'];
    const built = homes.slice(0, o.built == null ? 0 : o.built);   // Dev 23 Nov: no houses yet: a house is added when a citizen moves in
    built.forEach(H => { const M = at(H.x, H.y, H.z, H.ry), v = (r() * 100) | 0;
      B.add(UC(12), '#9fd06c', M, 0, -0.35, 0, 12, 0.5, 11);                                                                    // garden lawn
      if (H.k === 'c') { const Wc = WALL[v % 4], Rc = ROOF[v % 5];
        B.add(UB(), '#9a8f80', M, 0, -0.8, 0, 8.6, 1.4, 6.6); B.add(UB(), Wc, M, 0, 0.6, 0, 8, 4, 6); B.add(UP(), Rc, M, 0, 4.6, 0, 9.6, 3.6, 7.4);
        B.add(UB(), Wc, M, -2.4, 4.6, 1.4, 2.2, 2.2, 2.4); B.add(UP(), Rc, M, -2.4, 6.8, 1.6, 2.8, 1.6, 2.6, 0, Math.PI / 2);   // dormer
        B.add(UB(), '#8a7a6a', M, 2.6, 6, -1.2, 1, 3.2, 1); B.add(UB(), '#6b4a32', M, 1.6, 0.6, 3.02, 1.3, 2.5, 0.15);
        [-1.6, 3.4].forEach((dx, i) => { if (!(i && Math.abs(dx - 1.6) < 1.5)) { B.add(UB(), '#f6f0e2', M, dx === 3.4 ? -3.2 : -1.6 + (i ? 0 : 0), 1.8, 3.02, 1.5, 1.5, 0.12); B.add(UB(), v % 3 ? '#3f4a52' : 'glow', M, dx === 3.4 ? -3.2 : -1.6, 1.95, 3.06, 1.1, 1.1, 0.12); } });
        [-4.02, 4.02].forEach(sx2 => { B.add(UB(), '#3f4a52', M, sx2, 1.9, 0, 0.12, 1.2, 1.2); });
        B.add(UB(), '#b9ad98', M, 1.6, 0, 3.6, 2.4, 0.6, 1.2); }
      else { const Wd2 = WOOD[v % 3], Rc = v % 2 ? '#3f5a3a' : '#6b3f2c';                                                       // A-frame cabin
        B.add(UB(), '#9a8f80', M, 0, -0.8, 0, 7.6, 1.4, 8.6); B.add(UP(), Rc, M, 0, 0.6, 0, 8, 8, 8); B.add(UP(), Wd2, M, 0, 0.6, 4.05, 6.6, 6.6, 0.15);
        B.add(UP(), 'glow', M, 0, 2.4, 4.15, 3.2, 3.6, 0.1); B.add(UB(), '#5a3a24', M, 0, 0.6, 4.2, 1.3, 2.3, 0.12); B.add(UB(), '#b98a5a', M, 0, 0.3, 5.6, 7, 0.3, 2.6); }
      for (let k = 0; k < 3; k++) { const a = r() * 6.283, d = 5.5 + r() * 2; B.add(UK(6), ['#d88fb0', '#f2c14e', '#e8473a', '#a084c8'][(v + k) % 4], M, Math.cos(a) * d, 0, Math.sin(a) * d - 1, 0.7, 0.9, 0.7); }
      if (v % 4 === 0) { B.add(UB(), '#a87a4a', M, 5.5, 0, 3, 2.4, 0.5, 0.8); }
      else if (v % 4 === 1) { B.add(UC(8), '#8a8278', M, -6, -0.1, 3, 1.4, 0.4, 1.4); B.add(UK(5), '#f2a03a', M, -6, 0.3, 3, 0.7, 1.2, 0.7); } });
    // ---- paths: a web from every home to its nearest neighbour or a landmark, plus a ring round the plaza; bridges over the stream ----
    const nodes = built.map(q => [q.x, q.z]).concat([[plaza[0], plaza[1] - 26], [lh[0] * 0.92, lh[1] * 0.92], [hb[0] * 0.9, hb[1] * 0.9]], o.extras ? [[gh[0] + 6, gh[1] - 6], [ct[0] - 14, ct[1]], [top[0] + 10, top[1] - 6]] : []);
    const used = [nodes[built.length]], left = nodes.filter(n => n !== used[0]), edges = [];
    while (left.length) { let bi = 0, bj = 0, bd = 1e9; for (let i = 0; i < left.length; i++) for (let j = 0; j < used.length; j++) { const d = Math.hypot(left[i][0] - used[j][0], left[i][1] - used[j][1]); if (d < bd) { bd = d; bi = i; bj = j; } } edges.push([left[bi], used[bj]]); used.push(left[bi]); left.splice(bi, 1); }
    const bridges = [];
    edges.forEach(([a, b]) => { const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * 18, mz = (a[1] + b[1]) / 2 + (r() - 0.5) * 18, P = new T.CatmullRomCurve3([a, [mx, mz], b].map(p => new T.Vector3(p[0], 0, p[1]))).getSpacedPoints(Math.max(6, Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) / 3)));
      drape(P, 3.4, '#d9b98a', 0.3); const c = P.find(p => nearStream(p.x, p.z, 4)); if (c && !bridges.some(q => Math.hypot(q.x - c.x, q.z - c.z) < 30)) bridges.push(c); });
    { const ring = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * 6.283; ring.push(new T.Vector3(plaza[0] + Math.cos(a) * 30, 0, plaza[1] + Math.sin(a) * 30)); } drape(ring, 4, '#d9b98a', 0.3); }
    bridges.slice(0, 6).forEach(p => { let bi = 0; SP.forEach((q, k) => { if (Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(SP[bi].x - p.x, SP[bi].z - p.z)) bi = k; });
      const q = SP[bi], q2 = SP[Math.min(SP.length - 1, bi + 1)], M = at(q.x, h(q.x, q.z) + 0.4, q.z, Math.atan2(q2.x - q.x, q2.z - q.z) + Math.PI / 2);
      for (let k = -4; k <= 4; k++) B.add(UB(), k % 2 ? '#b98a5a' : '#a87a4a', M, 0, (16 - k * k) * 0.06, k * 1.5, 3.8, 0.3, 1.4); [-1.9, 1.9].forEach(dx => B.add(UB(), '#7a4a2c', M, dx, 1.2, 0, 0.2, 0.8, 13)); });
    // ---- shore rocks (big boulders at the cliffs, small ones on the beaches) ----
    for (let i = 0; i < (fast ? 90 : 160); i++) { const a = r() * 6.283, rr = rN(a) * (1.0 + r() * 0.06), x = Math.cos(a) * hw * rr, z = Math.sin(a) * hl * rr, big = cliffy(x, z);
      B.add(gget('rock', () => new T.DodecahedronGeometry(1, 0)), r() < 0.5 ? '#9c8f80' : '#b0a492', null, x, h(x, z) - (big ? 2 : 0.6), z, (big ? 5 : 1.6) + r() * (big ? 5 : 1.6), (big ? 4 : 1.2) + r() * (big ? 4 : 1.2), (big ? 5 : 1.6) + r() * (big ? 4 : 1.6), r(), r() * 3, r()); }
    B.build(g, !fast);
    // ---- trees (instanced): dense woods everywhere that isn't a garden, path, stream, beach or landmark ----
    const trees = [], NT = fast ? 1600 : 3200;
    for (let i = 0; i < NT * 8 && trees.length < NT; i++) { const x = (r() * 2 - 1) * hw, z = (r() * 2 - 1) * hl, d = dist(x, z); if (d < 9) continue;
      const y = h(x, z); if (nearStream(x, z, 9) || busy.some(([bx, bz, br]) => Math.hypot(bx - x, bz - z) < br * 0.8) || built.some(q => Math.hypot(q.x - x, q.z - z) < 11)) continue;
      trees.push({ x, y, z, r: r() * 6, s: 0.9 + r() * 0.8, k: y > 26 || r() < 0.55 ? 'p' : 'r', c: (r() * 12) | 0 }); }
    forest(g, trees, fast);
    g.userData = { homes: built, spots: homes, length: Ln, width: Wd, height: h };
    return g;
  }

  // =====================================================================================================================
  // NAP VALLEY v2 (Dev, 24 Nov: "realistic, logical, like a good city builder"). The valley between the new hills west of the city.
  // Layout follows what is really there: the old village road crosses the valley; the Dream Lodge faces it with a driveway; a footpath runs
  // the length of the valley; lavender fields + windmill to the north; a fenced sheep pasture + hay field to the south; the hammock grove
  // behind the lodge; a NAP VALLEY sign where the road comes in. NO houses yet: spots are saved along the footpath (o.built builds them).
  // o.ground(x, z) = the map's hill height at a LOCAL point, so nothing floats or sinks. Local frame: long axis = z.
  // =====================================================================================================================
  function napValley(o = {}) {
    const r = rng(o.seed || 2411), g = new T.Group(), fast = !!o.fast, B = Batch(), G = o.ground || (() => 0);
    const gy = (x, z) => Math.max(0.3, G(x, z) + 0.06), slope = (x, z) => Math.abs(G(x + 4, z) - G(x - 4, z)) + Math.abs(G(x, z + 4) - G(x, z - 4));
    const P0 = [0, -156], D = [-0.715, 0.699], NN = [0.699, 0.715], roadAt = t => [P0[0] + D[0] * t, P0[1] + D[1] * t];   // the village road (painted by the map)
    const roadDist = (x, z) => Math.abs((x - P0[0]) * NN[0] + (z - P0[1]) * NN[1]);
    const rects = [], inRect = (x, z, m = 0) => rects.some(([cx, cz, w, d, ry]) => { const dx = x - cx, dz = z - cz, c = Math.cos(ry), s2 = Math.sin(ry), u = dx * c - dz * s2, v = dx * s2 + dz * c; return Math.abs(u) < w / 2 + m && Math.abs(v) < d / 2 + m; });
    const drape = (pts, w, c, lift) => { const pos = [], idx = []; pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
        pos.push(p.x + nx, gy(p.x + nx, p.z + nz) + lift, p.z + nz, p.x - nx, gy(p.x - nx, p.z - nz) + lift, p.z - nz); if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } });
      const Gm = new T.BufferGeometry(); Gm.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); Gm.setIndex(idx); B.add(Gm, c, null); };
    const curve = (pts, n) => new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], 0, p[1]))).getSpacedPoints(n);
    // ---- the footpath: south end → crosses the road → north end (keeps to the flat west side of the valley in the north) ----
    const FP = curve([[-40, -620], [-50, -400], [-20, -250], [0, -156], [-45, 20], [-60, 200], [-55, 380], [-75, 600]], 220);
    drape(FP, 2.8, '#c4b48c', 0.04); const nearPath = (x, z, m) => FP.some(p => Math.hypot(p.x - x, p.z - z) < m);
    // ---- THE DREAM LODGE, 38 m off the road, front + porch facing it, gravel forecourt + driveway ----
    const L = [P0[0] + NN[0] * 38, P0[1] + NN[1] * 38], LRY = Math.atan2(NN[0], NN[1]), LY = gy(L[0], L[1]); rects.push([L[0], L[1], 40, 40, -LRY]);
    { const M = at(L[0], LY, L[1], LRY);
      B.add(UB(), '#9a8f80', M, 0, -1.2, 0, 30, 1.9, 14); B.add(UB(), '#b5774a', M, 0, 0.7, 0, 28, 6, 12); B.add(UP(), '#4a5a7a', M, 0, 6.7, 0, 31, 6, 15, 0, Math.PI / 2);
      for (let k = -3; k <= 3; k++) if (k) { B.add(UB(), '#f6f0e2', M, k * 3.6, 2.2, -6.05, 2, 2.4, 0.2); B.add(UB(), 'glow', M, k * 3.6, 2.35, -6.12, 1.5, 1.9, 0.12); }
      B.add(UB(), '#5a3a24', M, 0, 0.7, -6.15, 2.6, 4, 0.2); B.add(UB(), '#f6f0e2', M, 0, 4.7, -6.15, 3.2, 0.3, 0.25);
      B.add(UB(), '#a87a4a', M, 0, 0.3, -9, 30, 0.4, 6); B.add(UB(), '#4a5a7a', M, 0, 5.6, -9.2, 30, 0.4, 6.6, -0.18);
      for (let k = -2; k <= 2; k++) B.add(UB(), '#7a4a2c', M, k * 7, 0.7, -11.6, 0.5, 5, 0.5);
      [-10, -6, 6, 10].forEach(dx => { B.add(UB(), '#7a4a2c', M, dx, 0.7, -8.5, 1.4, 1, 1.4); B.add(UB(), '#7a4a2c', M, dx, 1.7, -7.9, 1.4, 1.6, 0.2); });
      B.add(UB(), '#8a7a6a', M, 11, 6, 2, 1.6, 7, 1.6);
      B.add(UC(16), '#f4e7a1', M, 0, 9.4, -7.7, 1.5, 0.3, 1.5, Math.PI / 2); B.add(UC(16), '#b5774a', M, 0.7, 9.6, -7.8, 1.3, 0.35, 1.3, Math.PI / 2);   // moon on the gable
      B.add(UB(), '#cfc2a4', M, 0, -0.25, -18, 26, 0.4, 12);                                                          // gravel forecourt
      [[-9, -18, '#c8402f'], [-3, -19, '#3f7fbf']].forEach(([cx, cz, c]) => { B.add(UB(), c, M, cx, 0, cz, 2.2, 1.3, 4.4); B.add(UB(), c, M, cx, 1.3, cz + 0.3, 2, 0.9, 2.4); });   // two parked cars
      for (let k = 0; k < 6; k++) B.add(UK(6), ['#9b7fd1', '#f2c14e', '#e8473a'][k % 3], M, -13 + k * 1.2 + (k > 2 ? 22 : 0), 0, -12.4, 0.8, 1, 0.8); }   // flower beds
    drape(curve([[P0[0] + NN[0] * 3, P0[1] + NN[1] * 3], [L[0] - NN[0] * 24, L[1] - NN[1] * 24]], 12), 5, '#cfc2a4', 0.05);   // driveway
    // ---- the HAMMOCK GROVE behind the lodge: a shady clump of big round trees, hammocks slung between pairs ----
    const trees = [], HG = [L[0] + NN[0] * 40 - D[0] * 14, L[1] + NN[1] * 40 - D[1] * 14];
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283, cx = HG[0] + Math.cos(a) * 17, cz = HG[1] + Math.sin(a) * 17, ry = a + Math.PI / 2, dx = Math.cos(ry) * 4.6, dz = Math.sin(ry) * 4.6;
      trees.push({ x: cx - dx, y: gy(cx - dx, cz - dz), z: cz - dz, r: r() * 6, s: 1.5, k: 'r', c: k }, { x: cx + dx, y: gy(cx + dx, cz + dz), z: cz + dz, r: r() * 6, s: 1.5, k: 'r', c: k + 1 });
      const M = at(cx, gy(cx, cz), cz, -ry); B.add(UB(), ['#e8473a', '#f2c14e', '#3f7fbf', '#a084c8', '#f6f0e2', '#5fb39a', '#f28b5a'][k], M, 0, 1.2, 0, 6.8, 0.3, 1.8); B.add(UB(), '#d9c6a0', M, -3.9, 1.5, 0, 1.2, 0.12, 0.12); B.add(UB(), '#d9c6a0', M, 3.9, 1.5, 0, 1.2, 0.12, 0.12); }
    for (let k = 0; k < 14; k++) { const a = r() * 6.283, d = 26 + r() * 10; trees.push({ x: HG[0] + Math.cos(a) * d, y: 0, z: HG[1] + Math.sin(a) * d, r: r() * 6, s: 1.3 + r() * 0.4, k: 'r', c: k }); }
    B.add(UC(12), '#7a5a3a', null, HG[0], gy(HG[0], HG[1]) - 0.2, HG[1], 2.2, 0.5, 2.2); B.add(UC(8), '#3a3330', null, HG[0], gy(HG[0], HG[1]) + 0.1, HG[1], 1.4, 0.4, 1.4);   // fire pit
    rects.push([HG[0], HG[1], 60, 60, 0]);
    // ---- NORTH: two lavender fields either side of the footpath, a hedgerow behind them, the windmill + a lavender shed ----
    const field = (cx, cz, w, d, ry, rowC, soil) => { rects.push([cx, cz, w, d, -ry]); const M = at(cx, gy(cx, cz) - 0.15, cz, ry); B.add(UB(), soil, M, 0, -0.4, 0, w, 0.7, d);
      for (let z2 = -d / 2 + 2.5; z2 < d / 2 - 1; z2 += 3.6) { B.add(UB(), '#6f8a4e', M, 0, 0.2, z2, w - 3, 0.5, 1.7); B.add(UB(), rowC[(z2 * 7 | 0) & 1], M, 0, 0.6, z2, w - 4, 0.8, 1.3); } };
    field(-112, 230, 52, 110, 0, ['#9b7fd1', '#8a6cc4'], '#a8875a'); field(-5, 230, 58, 110, 0, ['#8a6cc4', '#a68ae0'], '#a8875a');
    field(-112, 360, 52, 80, 0, ['#9b7fd1', '#8a6cc4'], '#a8875a');
    for (let x = -138; x <= 24; x += 7) trees.push({ x, y: 0, z: 405 + r() * 3, r: r() * 6, s: 0.9 + r() * 0.3, k: 'r', c: (r() * 12) | 0 });   // hedgerow
    { const W0 = [-20, 470], y = gy(W0[0], W0[1]), M = at(W0[0], y, W0[1], 0.5); rects.push([W0[0], W0[1], 30, 30, 0]);            // WINDMILL (stone tower, cap, 4 sails facing the valley)
      B.add(UC(10), '#efe2c6', M, 0, -0.5, 0, 5.2, 16, 5.2); B.add(UK(10), '#8a4a32', M, 0, 15.5, 0, 6, 5, 6); B.add(UB(), '#5a3a24', M, 0, 0, 5.1, 2, 3.4, 0.3); B.add(UB(), '#3f4a52', M, 0, 8, 4.6, 1.2, 1.4, 0.3);
      const S = M.clone().multiply(new T.Matrix4().makeTranslation(0, 14, 6));
      for (let k = 0; k < 4; k++) { const R2 = S.clone().multiply(new T.Matrix4().makeRotationZ(k * Math.PI / 2 + 0.35)); B.add(UB(), '#7a4a2c', R2, 0, 0, 0, 0.4, 13, 0.3); B.add(UB(), '#f6f0e2', R2, 1.3, 2.5, 0, 2.4, 10, 0.12); }
      B.add(UC(8), '#7a4a2c', S, 0, 0, -0.6, 0.9, 1.2, 0.9, Math.PI / 2); }
    { const M = at(36, gy(36, 200), 200, 0); rects.push([36, 200, 14, 12, 0]); B.add(UB(), '#a8683f', M, 0, 0, 0, 9, 4, 7); B.add(UP(), '#6b3f2c', M, 0, 4, 0, 10, 3, 8, 0, Math.PI / 2); B.add(UB(), '#5a3a24', M, -4.6, 0, 0, 0.2, 3, 2.6); }   // lavender shed
    // ---- SOUTH: hay field (bales in rows) + fenced sheep pasture with a shelter and a trough ----
    { const cx = -100, cz = -300, w = 64, d = 80; rects.push([cx, cz, w, d, 0]); const M = at(cx, gy(cx, cz) - 0.1, cz, 0); B.add(UB(), '#d9c27a', M, 0, -0.4, 0, w, 0.6, d);
      for (let z2 = -d / 2 + 4; z2 < d / 2; z2 += 5) B.add(UB(), '#cdb366', M, 0, 0.2, z2, w - 2, 0.1, 2);
      for (let k = 0; k < 12; k++) { const bx = -24 + (k % 4) * 16, bz = -28 + ((k / 4) | 0) * 26 + (k % 2) * 4; B.add(UC(10), '#e6c86a', M, bx, 1.3, bz, 1.3, 2.4, 1.3, Math.PI / 2, 0.3); } }
    { const cx = 58, cz = -470, w = 100, d = 110; rects.push([cx, cz, w, d, 0]); const by = gy(cx, cz);   // pasture EAST of the footpath (the path never goes through it)
      for (let k = 0; k <= 2 * (w + d) / 6; k++) { let t = k * 6, x, z; if (t < w) { x = cx - w / 2 + t; z = cz - d / 2; } else if ((t -= w) < d) { x = cx + w / 2; z = cz - d / 2 + t; } else if ((t -= d) < w) { x = cx + w / 2 - t; z = cz + d / 2; } else { t -= w; x = cx - w / 2; z = cz + d / 2 - t; }
        if (Math.hypot(x - (cx - w / 2), z - (cz + 10)) < 4) continue; const y = gy(x, z); B.add(UB(), '#7a5236', null, x, y, z, 0.3, 1.5, 0.3); }   // posts (gate gap on the path side)
      [[cx, cz - d / 2, w, 0.15], [cx, cz + d / 2, w, 0.15], [cx + w / 2, cz, 0.15, d], [cx - w / 2, cz - 17, 0.15, d / 2 - 14], [cx - w / 2, cz + 37, 0.15, d / 2 - 14]].forEach(([x, z, sx, sz]) => { [0.6, 1.2].forEach(h2 => B.add(UB(), '#a87a4a', null, x, by + h2, z, Math.max(sx, 0.15), 0.12, Math.max(sz, 0.15))); });
      const SH = at(cx + 40, gy(cx + 40, cz + 35), cz + 35, Math.PI); B.add(UB(), '#a8683f', SH, 0, 0, 0, 12, 3.2, 6); B.add(UB(), '#6b3f2c', SH, 0, 3.2, -0.5, 13, 0.4, 7.4, 0.12); B.add(UB(), '#3a2a20', SH, 0, 0.3, -3.05, 10, 2.5, 0.2);
      B.add(UB(), '#8a8278', null, cx + 20, by, cz - 20, 4, 0.8, 1.2); B.add(UB(), '#5fb3d9', null, cx + 20, by + 0.5, cz - 20, 3.6, 0.35, 0.9);
      for (let k = 0; k < 22; k++) { const x = cx + (r() - 0.5) * (w - 14), z = cz + (r() - 0.5) * (d - 14), M = at(x, gy(x, z), z, r() * 6.283);
        B.add(UB(), '#f6f3ea', M, 0, 0.6, 0, 1.3, 1.1, 2); B.add(UB(), '#3a3330', M, 0, 1.0, 1.2, 0.7, 0.7, 0.7); [-0.4, 0.4].forEach(a => [-0.6, 0.6].forEach(b => B.add(UB(), '#3a3330', M, a, 0, b, 0.2, 0.7, 0.2))); } }
    // ---- the NAP VALLEY sign where the road comes in from the city + benches along the footpath ----
    { const sp = roadAt(-185), x = sp[0] + NN[0] * 9, z = sp[1] + NN[1] * 9, ry = Math.atan2(-D[0], -D[1]) + Math.PI, y = gy(x, z), M = at(x, y, z, ry);
      [-3.6, 3.6].forEach(dx => B.add(UB(), '#7a4a2c', M, dx, 0, 0, 0.5, 4.6, 0.5)); B.add(UB(), '#5a3a24', M, 0, 2.2, 0, 8.4, 2.6, 0.4);
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const c = cv.getContext('2d'); c.fillStyle = '#3a4a6a'; c.fillRect(0, 0, 512, 160); c.fillStyle = '#f4e7a1';
      c.beginPath(); c.arc(70, 80, 42, 0, 7); c.fill(); c.fillStyle = '#3a4a6a'; c.beginPath(); c.arc(90, 66, 38, 0, 7); c.fill(); c.fillStyle = '#f6f0e2'; c.font = 'bold 64px sans-serif'; c.textBaseline = 'middle'; c.fillText('NAP VALLEY', 130, 84);
      const sg = new T.Mesh(new T.PlaneGeometry(8, 2.5), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv) })); sg.applyMatrix4(M.clone().multiply(new T.Matrix4().makeTranslation(0, 3.5, -0.22).multiply(new T.Matrix4().makeRotationY(Math.PI)))); g.add(sg);
      const sg2 = sg.clone(); sg2.applyMatrix4(new T.Matrix4()); sg2.geometry = sg.geometry; sg2.position.copy(sg.position); sg2.quaternion.copy(sg.quaternion); sg2.rotateY(Math.PI); sg2.translateZ(-0.46); g.add(sg2); }
    for (let k = 14; k < FP.length - 10; k += 24) { const p = FP[k], q = FP[k + 1], x = p.x + 4.5, M = at(x, gy(x, p.z), p.z, Math.atan2(q.x - p.x, q.z - p.z) + Math.PI / 2); B.add(UB(), '#a87a4a', M, 0, 0.6, 0, 3, 0.3, 1); B.add(UB(), '#7a4a2c', M, 0, 0, 0, 2.6, 0.6, 0.8); B.add(UB(), '#a87a4a', M, 0, 0.9, 0.45, 3, 0.8, 0.15); }
    // ---- an avenue of round trees along the road through the valley ----
    for (let t = -230; t <= 210; t += 17) [-7.5, 7.5].forEach(o2 => { const [x0, z0] = roadAt(t), x = x0 + NN[0] * o2, z = z0 + NN[1] * o2; if (slope(x, z) > 2 || G(x, z) > 4 || inRect(x, z, 3) || nearPath(x, z, 4)) return; trees.push({ x, y: 0, z, r: r() * 6, s: 1.1, k: 'r', c: (t / 17 | 0) & 3 }); });
    // ---- home spots for later: lanes of cottages along the footpath (nothing built yet) ----
    const spots = []; for (let k = 6; k < FP.length - 4; k += 6) { const p = FP[k], q = FP[k + 1], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
      [-1, 1].forEach(sd => { const x = p.x - dz / l * 17 * sd, z = p.z + dx / l * 17 * sd; if (inRect(x, z, 6) || roadDist(x, z) < 18 || slope(x, z) > 2.5 || nearPath(x, z, 12) || spots.some(s2 => Math.hypot(s2.x - x, s2.z - z) < 22)) return; spots.push({ x, z, ry: Math.atan2(p.x - x, p.z - z) }); }); }
    // ---- woods: natural clumps in what is left (never on a field, the pasture, a road, the path or a home spot), thicker on the slopes ----
    const free = (x, z, m) => !inRect(x, z, m) && roadDist(x, z) > 8 + m && !nearPath(x, z, 5 + m) && !spots.some(s2 => Math.hypot(s2.x - x, s2.z - z) < 12);
    for (let c2 = 0; c2 < (fast ? 28 : 46); c2++) { const cx = (r() * 2 - 1) * 190, cz = (r() * 2 - 1) * 640, rad = 14 + r() * 26, n = 6 + (r() * 16 | 0);
      for (let k = 0; k < n; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!free(x, z, 2)) continue; trees.push({ x, y: 0, z, r: r() * 6, s: 0.9 + r() * 0.6, k: G(x, z) > 6 || r() < 0.4 ? 'p' : 'r', c: (r() * 12) | 0 }); } }
    trees.forEach(t => { if (!t.y) t.y = gy(t.x, t.z) - 0.05; });
    B.build(g, !fast); forest(g, trees, fast);
    g.userData = { homes: [], spots, lodge: L };
    return g;
  }
  root.VinlandDistricts = { introvertIsland, introvertIsland2, napValley };
})(typeof window !== 'undefined' ? window : globalThis);
