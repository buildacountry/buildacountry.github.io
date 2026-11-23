// VINLAND · SECOND HOMES v3 (Dev, 24 Nov): Introvert Island rebuilt from Dev's reference (terraced stone cottages, harbour, lighthouse, hall).
// Scale (map/index.html): citizen 2.2 m, car 3.7-4.6 m, storey ~3.1 m. Doors here are 1.4 x 2.4 m (taller than a citizen).
// Every builder returns a THREE.Group centred on (0, 0, 0), metres, sea surface y 0.3, plus .userData.spots = [{x, y, z, ry}] (200 homes).
// Rules: everything stands on flat ground (terraces held by stone walls), doors open onto paths, no river on the island (Dev).
(function (root) {
  const T = root.THREE;
  const M = {}, mat = c => M[c] || (M[c] = new T.MeshLambertMaterial({ color: c, flatShading: true }));
  const glass = new T.MeshLambertMaterial({ color: '#9fc4cf', flatShading: true }), glow = new T.MeshBasicMaterial({ color: '#ffd27a' });
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const V = new T.Vector3(), Q = new T.Quaternion(), E = new T.Euler(), S = new T.Vector3();
  // ---- one merged mesh per colour: the whole island is ~15 draw calls ----
  function Batch() { const m = new Map();
    return { add(geo, c, base, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
        const L = new T.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)), g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(base ? base.clone().multiply(L) : L);
        if (!m.has(c)) m.set(c, []); m.get(c).push(g); },
      build(group, shadow) { m.forEach((list, c) => { let n = 0; list.forEach(g => { n += g.attributes.position.count; }); const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
          list.forEach(g => { g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
          const G = new T.BufferGeometry(); G.setAttribute('position', new T.BufferAttribute(pos, 3)); G.setAttribute('normal', new T.BufferAttribute(nor, 3)); G.computeBoundingSphere();
          const me = new T.Mesh(G, c === 'glass' ? glass : c === 'glow' ? glow : mat(c)); me.castShadow = shadow && c !== 'glow'; me.receiveShadow = true; group.add(me); }); } }; }
  const at = (x, y, z, ry = 0, s = 1) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry), new T.Vector3(s, s, s));
  const BOX = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);           // unit box, pivot bottom-centre
  const box = (B, c, base, w, h, d, x, y, z, ry = 0, rx = 0) => B.add(BOX, c, base, x, y, z, w, h, d, rx, ry, 0);
  function prismGeo(w, h, d) { const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
    return new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); }
  // instanced trees (pines + round trees), each stands on its own ground height t.y
  function trees(g, list, fast) {
    if (!list.length) return; const O = new T.Object3D(), col = new T.Color();
    const make = (geo, L, f) => { if (!L.length) return; const im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), L.length); im.castShadow = !fast; im.receiveShadow = true;
      L.forEach((t, i) => { O.position.set(t.x, t.y, t.z); O.rotation.set(0, t.r, 0); O.scale.setScalar(t.s); O.updateMatrix(); im.setMatrixAt(i, O.matrix); im.setColorAt(i, col.set(f(t))); }); g.add(im); };
    const pine = list.filter(t => t.k === 'p'), round = list.filter(t => t.k === 'r');
    make(new T.CylinderGeometry(0.25, 0.35, 1.8, 5, 1, true).translate(0, 0.6, 0), list, () => '#7a5236');   // open-ended: no hidden caps   // trunk sunk 0.3 m into the ground
    const PC = ['#3f7a3a', '#4a8a40', '#356b33'], RC = ['#6aa84f', '#7cb85a', '#5e9a45', '#8cc063'];
    make(new T.ConeGeometry(2.2, 3.6, 6, 1, true).translate(0, 2.9, 0), pine, t => PC[t.c % 3]); make(new T.ConeGeometry(1.6, 3.0, 6, 1, true).translate(0, 5.0, 0), pine, t => PC[(t.c + 1) % 3]);
    make(new T.IcosahedronGeometry(2.3, 0).translate(0, 3.5, 0), round, t => RC[t.c % 4]);
  }

  // ---------- THE COTTAGE (pivot: bottom-centre of the plinth, ground y 0; door faces +z) ----------
  // Plinth 6.4 x 0.3 x 5.4 stone. Walls 6 x 4.2 x 5 (ground floor 3.1 + attic knee wall). Roof 55 deg, 0.5 m overhang all round, ridge 8.1 m (+ cap 8.35).
  // Door 1.4 x 2.4 at floor level (0.3), one 0.15 m stone step. Front garden to a picket fence at z 5.9 with a gate gap. Chimney through the roof.
  const CT = { W: 6, D: 5, WALL: 4.2, PL: 0.3, RISE: 3.6, OV: 0.5, FENCE: 5.9 };
  function cottage(B, base, r, fast) {
    const WALLC = ['#f3ead8', '#efe2c8', '#f6efe2'][(r() * 3) | 0], ROOF = ['#c8603f', '#b5543a', '#d0714a'][(r() * 3) | 0], STONE = '#a39a8c', TRIM = '#e6d8b8', WOOD = '#6e4a32';
    const { W, D, WALL, PL, RISE, OV } = CT, top = PL + WALL;
    box(B, STONE, base, W + 0.4, PL, D + 0.4, 0, 0, 0);                                  // plinth on the flat terrace
    box(B, WALLC, base, W, WALL, D, 0, PL, 0);                                           // walls
    B.add(prismGeo(D, RISE, W), WALLC, base, 0, top, 0, 1, 1, 1, 0, Math.PI / 2, 0);      // gable ends (fill under the roof)
    const a = Math.atan2(RISE, D / 2), half = D / 2 + OV, len = half / Math.cos(a), th = 0.25;
    const SLAB = new T.BoxGeometry(1, 1, 1);                                              // centred box for the slabs
    [-1, 1].forEach(sd => {                                                              // two roof slabs, underside resting on the wall top edge
      const mz = sd * half / 2, my = top + RISE - (half / 2) * Math.tan(a);
      B.add(SLAB, ROOF, base, 0, my + th / 2 * Math.cos(a), mz + sd * th / 2 * Math.sin(a), W + 2 * OV, th, len, sd * a, 0, 0); });
    box(B, '#9c4630', base, W + 2 * OV + 0.1, 0.25, 0.4, 0, top + RISE - 0.05, 0);       // ridge cap
    box(B, STONE, base, 0.8, 3.0, 0.8, 1.9, top + 1.2, -1.0);                             // chimney: base hidden in the attic, top 0.6 m over the ridge
    box(B, '#6f665c', base, 0.95, 0.2, 0.95, 1.9, top + 4.2, -1.0);
    // front (z = +2.5): door + two windows; attic window in each gable
    box(B, TRIM, base, 1.8, 2.85, 0.1, 0, PL, D / 2);                                    // door frame
    box(B, WOOD, base, 1.4, 2.4, 0.12, 0, PL, D / 2 + 0.02);                              // door 1.4 x 2.4
    box(B, '#d9b55a', base, 0.1, 0.1, 0.08, 0.5, PL + 1.1, D / 2 + 0.1);                  // handle
    box(B, STONE, base, 2.0, 0.15, 0.8, 0, 0, D / 2 + 0.6);                               // step (ground 0 -> 0.15 -> floor 0.3)
    box(B, WOOD, base, 2.2, 0.15, 1.0, 0, PL + 2.95, D / 2 + 0.45);                       // little canopy over the door
    const win = (x, y, z, ry) => { const m = base.clone().multiply(at(x, 0, z, ry)); box(B, TRIM, m, 1.3, 1.6, 0.1, 0, y - 0.15, 0); box(B, 'glass', m, 1.0, 1.3, 0.12, 0, y, 0.01); };
    win(-1.9, PL + 0.9, D / 2, 0); win(1.9, PL + 0.9, D / 2, 0);                            // front windows (sill 1.2 m)
    if (!fast) { win(-1.5, PL + 0.9, -D / 2, Math.PI); win(1.5, PL + 0.9, -D / 2, Math.PI); }   // back
    [-1, 1].forEach(s => { win(s * W / 2, PL + 0.9, 0, s * Math.PI / 2); win(s * W / 2, top + 0.4, 0, s * Math.PI / 2); });   // sides + attic gables
    // flower box under the front windows
    [-1.9, 1.9].forEach(x => { box(B, WOOD, base, 1.2, 0.3, 0.35, x, PL + 0.5, D / 2 + 0.18); box(B, ['#d65a7a', '#f0c24a', '#c84a3a'][(r() * 3) | 0], base, 1.0, 0.2, 0.25, x, PL + 0.8, D / 2 + 0.18); });
    // front garden: stone path door -> gate, picket fence with a gate gap, a veg patch or flower bed
    box(B, '#cbbd9f', base, 1.2, 0.05, CT.FENCE - D / 2 - 1.0, 0, 0.02, (CT.FENCE + D / 2 + 1.0) / 2);
    [-1, 1].forEach(s => { const x0 = s * 0.9, x1 = s * 4.6, cx = (x0 + x1) / 2, w = Math.abs(x1 - x0), FC = '#f1e8d6';
      if (fast) { box(B, FC, base, w, 0.9, 0.1, cx, 0, CT.FENCE); box(B, FC, base, 0.1, 0.9, CT.FENCE - 0.5, x1, 0, CT.FENCE / 2 + 0.25); return; }   // phones: solid low fence
      box(B, FC, base, w, 0.08, 0.08, cx, 0.8, CT.FENCE); box(B, FC, base, 0.08, 0.08, CT.FENCE - 0.5, x1, 0.8, CT.FENCE / 2 + 0.25);   // top rails (front, side)
      [x0, cx, x1].forEach(x => box(B, FC, base, 0.12, 1.0, 0.12, x, 0, CT.FENCE)); box(B, FC, base, 0.12, 1.0, 0.12, x1, 0, 0.5); box(B, FC, base, 0.12, 1.0, 0.12, x1, 0, CT.FENCE / 2 + 0.25); });
    if (r() < 0.55) { box(B, '#7a5a3a', base, 2.2, 0.18, 1.3, -3.0, 0, 4.2); for (let i = 0; i < 3; i++) box(B, '#5e9a45', base, 0.45, 0.4, 0.45, -3.7 + i * 0.7, 0.18, 4.2); }
    else { box(B, '#7a5a3a', base, 1.6, 0.18, 1.0, 3.0, 0, 4.4); box(B, '#d88fb0', base, 1.3, 0.35, 0.7, 3.0, 0.18, 4.4); }
  }

  // ---------- INTROVERT ISLAND v3 ----------
  // Layout (s = "contour metres": real radius = s * f(angle), so the terraces follow a soft natural outline, not a perfect circle):
  //   crown (pines, no homes) s < 42 · 6 terraces, each 16 m deep, 3 m apart (y 20 .. 5), stone retaining wall at the back of each
  //   lowland s 138 .. coast-18 at y 2.0 (harbour square, hall, trees) · beach down to the sea (y 0.3) · sea floor
  //   3 stairways (harbour side + 2 more) climb every wall. Harbour faces +z (the mainland).
  function introvertIsland3(o = {}) {
    const r = rng(o.seed || 2411), g = new T.Group(), fast = !!o.fast, B = Batch(), TR = [], HOMES = o.homes || 200;
    const f = a => 1 + 0.07 * Math.sin(2 * a + 0.9) + 0.04 * Math.sin(3 * a + 2.0);
    const CS = a => 222 * (1 + 0.045 * Math.sin(3 * a + 0.4) + 0.03 * Math.sin(7 * a + 1.3) - 0.05 * Math.exp(-((a - Math.PI / 2) ** 2) / 0.08));   // coast (a cove at the harbour)
    const NT = 7, DEP = 16, A0 = 42, LOW = 2.0, yT = k => LOW + 3 * (NT - k), aK = k => A0 + k * DEP, bK = k => A0 + (k + 1) * DEP, CROWN = yT(0) + 3;
    const EX = 1.22, CZ = -28;                                                            // island longer east-west; the hill sits back from the harbour
    const P = (s, a) => [s * f(a) * EX * Math.cos(a), CZ + s * f(a) * Math.sin(a)];
    const inv = (x, z) => { const u = x / EX, v = z - CZ, a = Math.atan2(v, u); return [Math.hypot(u, v) / f(a), a]; };   // world -> (s, a)
    const nrm = (s, a) => { const [x0, z0] = P(s, a - 0.001), [x1, z1] = P(s, a + 0.001), l = Math.hypot(x1 - x0, z1 - z0); return [(z1 - z0) / l, -(x1 - x0) / l]; };   // outward normal
    const HA = Math.PI / 2, STAIRS = [HA, HA + 2 * Math.PI / 3, HA - 2 * Math.PI / 3];
    const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
    const nearStair = (s, a, m) => STAIRS.some(t => Math.abs(angDiff(a, t)) * s * f(a) < m);
    const N = fast ? 160 : 240;                                                           // segments round the island
    // ---- sea floor + lowland + beach: one height grid (vertex colours) ----
    const hLow = (x, z) => { const [s, a] = inv(x, z), c = CS(a);
      if (s <= c - 18) return LOW; if (s <= c) return LOW * (c - s) / 18; return Math.max(-4, -(s - c) * 0.22); };
    { const SZ = 640, n = fast ? 110 : 150, G = new T.PlaneGeometry(SZ, SZ, n, n).rotateX(-Math.PI / 2), Pp = G.attributes.position, col = [];
      const GR = [new T.Color('#86ab5c'), new T.Color('#7ea455'), new T.Color('#8db263')], SAND = new T.Color('#ecd49a'), WET = new T.Color('#d9bf86'), DEEP = new T.Color('#c9b98e');
      for (let i = 0; i < Pp.count; i++) { const x = Pp.getX(i), z = Pp.getZ(i), y = hLow(x, z); Pp.setY(i, y);
        const c = y >= LOW - 0.01 ? GR[(Math.floor(x / 11) * 7 + Math.floor(z / 11) * 3 & 7) % 3] : y > 0.6 ? SAND : y > -0.6 ? WET : DEEP; col.push(c.r, c.g, c.b); }
      G.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G.computeVertexNormals();
      const m = new T.Mesh(G, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.receiveShadow = true; g.add(m); }
    // ---- terraces (flat rings), retaining walls (vertical), parapets (low wall on each terrace edge), the crown dome ----
    const ring = (s0, s1, y, c) => { const pos = []; for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, [x0, z0] = P(s0, a0), [x1, z1] = P(s0, a1), [x2, z2] = P(s1, a0), [x3, z3] = P(s1, a1);
        pos.push(x0, y, z0, x1, y, z1, x2, y, z2, x2, y, z2, x1, y, z1, x3, y, z3); } const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); B.add(G, c, null); };
    const wall = (s, y0, y1, c) => { const pos = []; for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, [x0, z0] = P(s, a0), [x1, z1] = P(s, a1);
        pos.push(x0, y0, z0, x0, y1, z0, x1, y0, z1, x1, y0, z1, x0, y1, z0, x1, y1, z1); } const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); B.add(G, c, null); };
    const WALLC = '#9c8f80', CAP = '#b3a898', GRASS = '#86ab5c', PATH = '#d8c49a';
    for (let k = 0; k < NT; k++) {
      ring(aK(k), bK(k), yT(k), GRASS);
      wall(aK(k), yT(k), k ? yT(k - 1) : CROWN, WALLC);                                  // back wall: up to the terrace above (or the crown)
      // the ring path near the front edge (2.5 m), raised 4 cm so it never flickers
      ring(bK(k) - 3.5, bK(k) - 1.0, yT(k) + 0.04, PATH);
    }
    wall(bK(NT - 1), LOW, yT(NT - 1), WALLC);                                             // the outer wall, down to the lowland
    // parapets: 0.55 m stone wall on the edge of every terrace (gaps where the stairs come up), so no one walks off a 3 m drop
    for (let k = 0; k < NT; k++) { const s = bK(k) - 0.25, y = yT(k), n = N;
      for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; if (nearStair(s, a, 2.4)) continue; const [x0, z0] = P(s, i / n * Math.PI * 2), [x1, z1] = P(s, (i + 1) / n * Math.PI * 2), l = Math.hypot(x1 - x0, z1 - z0);
        box(B, CAP, null, l + 0.06, 0.55, 0.45, (x0 + x1) / 2, y, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0)); } }
    // crown: a gentle dome of grass with pines (the island's wild top)
    { const pos = [], RN = 8, dome = (t) => CROWN + 14 * (1 - t * t);
      for (let j = 0; j < RN; j++) for (let i = 0; i < N; i++) { const t0 = j / RN, t1 = (j + 1) / RN, a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
        const p = (t, a) => { const [x, z] = P(A0 * t, a); return [x, dome(t), z]; }, q00 = p(t0, a0), q01 = p(t0, a1), q10 = p(t1, a0), q11 = p(t1, a1);
        pos.push(...q00, ...q01, ...q10, ...q10, ...q01, ...q11); }
      const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); B.add(G, '#7ea455', null);
      for (let i = 0; i < 70; i++) { const t = Math.sqrt(r()) * 0.9, a = r() * Math.PI * 2, [x, z] = P(A0 * t, a); TR.push({ k: r() < 0.75 ? 'p' : 'r', x, z, y: dome(t) - 0.1, r: r() * 6, s: 0.8 + r() * 0.5, c: (r() * 9) | 0 }); } }
    // ---- stairways: solid stone steps (0.2 rise, 0.3 run) against each wall, from the lower level up; 2.6 m wide (4 m on the harbour side) ----
    STAIRS.forEach((ta, si) => { const W = si ? 2.6 : 4;
      for (let k = 1; k <= NT; k++) { const sW = k < NT ? aK(k) : bK(NT - 1), yLo = k < NT ? yT(k) : LOW, yHi = k < NT ? yT(k - 1) : yT(NT - 1);
        const [wx, wz] = P(sW, ta), [nx, nz] = nrm(sW, ta), ry = Math.atan2(nx, nz), nSteps = Math.round((yHi - yLo) / 0.2), run = nSteps * 0.3;
        for (let i = 0; i < nSteps; i++) { const d = -0.1 + i * 0.3 + 0.15, h = yHi - yLo - i * 0.2;   // step i stands on the lower level, top = its tread
          box(B, '#b0a493', null, W, h, 0.3, wx + nx * d, yLo, wz + nz * d, ry); }
        [-1, 1].forEach(sd => box(B, WALLC, null, 0.3, yHi - yLo + 0.55, run, wx + nx * run / 2 + sd * nz * (W / 2 + 0.15), yLo, wz + nz * run / 2 - sd * nx * (W / 2 + 0.15), ry));   // side walls
        // a short path from the stair foot to the ring path on the level below
        const fx = wx + nx * run, fz = wz + nz * run, [tx, tz] = k < NT ? P(bK(k) - 2.2, ta) : [fx + nx * 10, fz + nz * 10], l = Math.hypot(tx - fx, tz - fz);
        if (l > 0.5) box(B, PATH, null, W, 0.05, l, (fx + tx) / 2, yLo + 0.01, (fz + tz) / 2, Math.atan2(tx - fx, tz - fz)); } });
    // ---- the cottages: along each terrace, 13 m apart, doors facing the sea, harbour side fills first ----
    const spots = [], greens = [];
    for (let k = 0; k < NT; k++) { const sc = aK(k) + 6.5; let acc = 6.5, a = 0, prev = P(sc, 0), nRing = k * 2; const da = 0.002;
      for (a = da; a < Math.PI * 2; a += da) { const cur = P(sc, a); acc += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); prev = cur; if (acc < 13) continue;
        if (nearStair(sc, a, 9)) continue; acc = 0; const [x, z] = cur, [nx, nz] = nrm(sc, a), ry = Math.atan2(nx, nz);
        if (++nRing % 6 === 0) { greens.push({ x, y: yT(k), z }); continue; }                 // every 6th plot: a pocket green, so the rings read as little neighbourhoods
        spots.push({ x, y: yT(k), z, ry, k, d: Math.abs(angDiff(a, HA)) * 100 + k * 30 }); } }
    spots.sort((p, q) => p.d - q.d); const used = spots.slice(0, HOMES), free = spots.slice(HOMES);
    const filled = o.filled == null ? used.length : Math.min(o.filled, used.length);
    used.slice(0, filled).forEach(sp => cottage(B, at(sp.x, sp.y, sp.z, sp.ry), r, fast));
    greens.forEach(sp => { for (let i = 0; i < 3; i++) TR.push({ k: i ? 'r' : 'p', x: sp.x + (r() - 0.5) * 7, z: sp.z + (r() - 0.5) * 4, y: sp.y, r: r() * 6, s: 0.6 + r() * 0.3, c: (r() * 9) | 0 }); });
    free.forEach(sp => { if (r() < 0.7) TR.push({ k: 'r', x: sp.x, z: sp.z, y: sp.y, r: r() * 6, s: 0.7 + r() * 0.3, c: (r() * 9) | 0 }); });   // spare spots = little orchards
    // back-yard trees between neighbours (behind the houses, clear of the paths)
    used.forEach((sp, i) => { if (i % 3) return; const a = inv(sp.x, sp.z)[1], s = aK(sp.k) + 2.2; const da = 6.5 / (s * f(a) * 1.1); const [x, z] = P(s, a + da);
      TR.push({ k: 'r', x, z, y: sp.y, r: r() * 6, s: 0.55, c: (r() * 9) | 0 }); });
    // ---- harbour square, the hall, the pier, boats, the lighthouse ----
    const HS = CS(HA) - 18, [hx, hz] = P(HS - 12, HA);                                         // square centre on the lowland, 12 m back from the beach
    { const sq = new T.CircleGeometry(17, 28).rotateX(-Math.PI / 2); B.add(sq, '#c9bfae', null, hx, LOW + 0.04, hz);
      const [px0, pz0] = P(bK(NT - 1) + 4.5, HA); box(B, PATH, null, 4, 0.05, Math.hypot(hx - px0, hz - pz0) - 15, px0, LOW + 0.01, (pz0 + hz - 17) / 2, 0);   // stair foot -> square
      // the hall: 14 x 10 m, 2 storeys (7 m walls), on a 0.45 m stone base, doors face the sea; sits on the west side of the square
      const hb = at(hx - 11, LOW, hz - 1, 0);
      box(B, '#a39a8c', hb, 15, 0.45, 11, 0, 0, 0); box(B, '#efe2c8', hb, 14, 7, 10, 0, 0.45, 0);
      B.add(prismGeo(10, 4.2, 14.8), '#b5543a', hb, 0, 7.45, 0, 1, 1, 1, 0, Math.PI / 2, 0); box(B, '#9c4630', hb, 15.2, 0.3, 0.5, 0, 11.55, 0);
      [-4.5, -1.5, 1.5, 4.5].forEach(x => { box(B, '#6e4a32', hb, 0.25, 7, 0.2, x * 1.4 > 6.9 ? 6.8 : x * 1.4, 0.45, 5.05); });   // timber posts
      box(B, '#e6d8b8', hb, 3.0, 3.3, 0.1, 0, 0.45, 5.02); box(B, '#6e4a32', hb, 2.4, 2.8, 0.12, 0, 0.45, 5.06);   // double door 2.4 x 2.8
      box(B, '#a39a8c', hb, 3.6, 0.22, 1.2, 0, 0, 5.6); box(B, '#a39a8c', hb, 3.6, 0.45, 0.6, 0, 0, 5.3);         // 2 steps up to the floor
      [-3.6, 3.6].forEach(x => { box(B, 'glass', hb, 1.6, 1.6, 0.12, x, 1.6, 5.02); box(B, 'glass', hb, 1.6, 1.6, 0.12, x, 4.6, 5.02); }); box(B, 'glass', hb, 1.6, 1.6, 0.12, 0, 4.6, 5.02);
      box(B, '#2f4a3c', hb, 4.4, 0.9, 0.12, 0, 3.75, 5.08);                                  // name board over the door
      // benches + lamp posts round the square
      for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + i * 0.14) + Math.PI * 0.05; const bx = hx + Math.cos(a) * 14, bz = hz + Math.sin(a) * 14;
        box(B, '#7a5236', null, 1.8, 0.45, 0.5, bx, LOW + 0.04, bz, -a + Math.PI / 2); box(B, '#2f2b28', null, 0.12, 3.2, 0.12, hx + Math.cos(a + 0.12) * 15.5, LOW, hz + Math.sin(a + 0.12) * 15.5);
        box(B, 'glow', null, 0.4, 0.4, 0.4, hx + Math.cos(a + 0.12) * 15.5, LOW + 3.2, hz + Math.sin(a + 0.12) * 15.5); } }
    // pier: 4 m deck at y 2.0 (level with the square), on posts every 4 m down into the sea floor; T-head 16 x 4 m
    { const z0 = hz + 15, z1 = P(CS(HA) + 46, HA)[1], L = z1 - z0, DY = LOW;
      box(B, '#b08055', null, 4, 0.3, L, hx, DY - 0.3, z0 + L / 2); box(B, '#b08055', null, 16, 0.3, 4, hx, DY - 0.3, z1 + 2);
      for (let z = z0 + 2; z <= z1 + 3; z += 4) [-1.8, 1.8].forEach(dx => box(B, '#7a5236', null, 0.35, DY + 3.7, 0.35, hx + dx, -4, z));
      for (let x = -7.5; x <= 7.6; x += 3) box(B, '#7a5236', null, 0.35, DY + 3.7, 0.35, hx + x, -4, z1 + 3.8);
      for (let z = z0 + 6; z < z1; z += 8) [-1.85, 1.85].forEach(dx => box(B, '#2f2b28', null, 0.3, 0.5, 0.3, hx + dx, DY, z));   // bollards
      // boats moored along the pier (hull sits in the water: keel below 0.3)
      [[-5, z0 + L * 0.55, 0], [5, z0 + L * 0.75, 0], [-5, z0 + L * 0.85, 0.1], [9, z1 + 7, 1.5]].forEach(([dx, bz, rr], i) => { const bb = at(hx + dx, 0, bz, rr);
        box(B, ['#f6f0e2', '#3f6fa8', '#c8603f', '#f6f0e2'][i], bb, 2.2, 1.1, 6, 0, -0.3, 0); box(B, '#b08055', bb, 2.0, 0.1, 5.6, 0, 0.75, 0);
        if (i % 2 === 0) box(B, '#7a5236', bb, 0.15, 6, 0.15, 0, 0.8, 0.4); }); }
    // lighthouse: on a rocky point east of the harbour. Stone plinth on the lowland, tower 18 m, gallery, lamp, red cap
    { const la = HA - 0.42, [lx, lz] = P(CS(la) - 12, la), Y = LOW;
      box(B, '#a39a8c', null, 8, 0.6, 8, lx, Y - 0.2, lz);
      B.add(new T.CylinderGeometry(2.2, 3.0, 16, 12).translate(0, 8, 0), '#f6f0e2', null, lx, Y + 0.4, lz);
      [4, 9, 14].forEach(y => B.add(new T.CylinderGeometry(2.95 - y * 0.05, 3.0 - y * 0.05, 1.2, 12).translate(0, 0.6, 0), '#c8603f', null, lx, Y + 0.4 + y - 0.6, lz));
      B.add(new T.CylinderGeometry(3.0, 3.0, 0.35, 12), '#2f2b28', null, lx, Y + 16.6, lz); B.add(new T.CylinderGeometry(1.5, 1.5, 2.2, 10).translate(0, 1.1, 0), 'glow', null, lx, Y + 16.8, lz);
      B.add(new T.ConeGeometry(2.0, 1.8, 12).translate(0, 0.9, 0), '#c8603f', null, lx, Y + 19.0, lz);
      box(B, '#6e4a32', null, 1.4, 2.4, 0.2, lx + Math.cos(la) * -0.0, Y + 0.4, lz + 2.75);  // door at the base, facing the square side
      // the rocks round the point (each sunk a third into the ground)
      for (let i = 0; i < 14; i++) { const a = la + (r() - 0.5) * 0.35, s = CS(a) - 6 + r() * 14, [x, z] = P(s, a), sc = 1.5 + r() * 3;
        B.add(new T.IcosahedronGeometry(1, 0), i % 2 ? '#8a7f72' : '#9c8f80', null, x, hLow(x, z) + sc * 0.3, z, sc, sc * 0.75, sc, r(), r() * 6, 0); } }
    // ---- trees on the lowland: natural clusters, never on the square, the pier line, the paths, the beach or the lighthouse ----
    const clear = (x, z) => { const [s, a] = inv(x, z); if (s < bK(NT - 1) + 3 || s > CS(a) - 20) return false;
      if (Math.hypot(x - hx, z - hz) < 24 || (Math.abs(x - hx) < 6 && z > hz)) return false; if (nearStair(s, a, 6)) return false;
      if (Math.abs(angDiff(a, HA - 0.42)) * s < 20) return false; return true; };
    for (let c = 0; c < (fast ? 26 : 40); c++) { const a = r() * Math.PI * 2, s = bK(NT - 1) + 8 + r() * (CS(a) - bK(NT - 1) - 30), [cx, cz] = P(s, a), n = 3 + ((r() * 6) | 0), pine = r() < 0.4;
      for (let i = 0; i < n; i++) { const x = cx + (r() - 0.5) * 16, z = cz + (r() - 0.5) * 16; if (clear(x, z)) TR.push({ k: pine ? 'p' : 'r', x, z, y: LOW - 0.05, r: r() * 6, s: 0.8 + r() * 0.5, c: (r() * 9) | 0 }); } }
    B.build(g, !fast); trees(g, TR, fast);
    g.userData.spots = used.map(({ x, y, z, ry }) => ({ x, y, z, ry })); g.userData.radius = 300; g.userData.hall = { x: hx - 11, z: hz - 1 };
    return g;
  }
  // ---------- WOODLAND HOMES (pivot: bottom-centre at floor-pad level y 0, door faces +z) ----------
  // Log cabin: 7 x 6 m, walls 3.4 m (one storey), 40 deg gable, 0.5 m overhang, ridge 6.3 m. Porch deck 7 x 2.2 m with 2 posts + roof.
  function logCabin(B, base, r, fast) {
    const WOOD = ['#9a5f3a', '#a8683f', '#8a5434'][(r() * 3) | 0], ROOF = ['#5f4a3e', '#6b3f2e', '#4f5a4a'][(r() * 3) | 0], DARK = '#5a3a24', TRIM = '#e6d8b8';
    const W = 7, D = 6, WALL = 3.4, top = WALL, RISE = 2.5, OV = 0.5;
    box(B, WOOD, base, W, WALL, D, 0, 0, 0);
    if (!fast) for (let k = 0; k < 4; k++) box(B, DARK, base, W + 0.08, 0.1, D + 0.08, 0, 0.6 + k * 0.75, 0);   // log lines
    B.add(prismGeo(D, RISE, W), WOOD, base, 0, top, 0, 1, 1, 1, 0, Math.PI / 2, 0);
    const a = Math.atan2(RISE, D / 2), half = D / 2 + OV, len = half / Math.cos(a), th = 0.25, SLAB = new T.BoxGeometry(1, 1, 1);
    [-1, 1].forEach(sd => { const mz = sd * half / 2, my = top + RISE - (half / 2) * Math.tan(a); B.add(SLAB, ROOF, base, 0, my + th / 2 * Math.cos(a), mz + sd * th / 2 * Math.sin(a), W + 2 * OV, th, len, sd * a, 0, 0); });
    box(B, '#8a8278', base, 0.9, 2.6, 0.9, -2.3, top + 0.9, -1.4);                          // stone chimney, 0.6 m over the ridge line
    box(B, TRIM, base, 1.7, 2.7, 0.1, 1.4, 0, D / 2); box(B, DARK, base, 1.4, 2.4, 0.12, 1.4, 0, D / 2 + 0.02);   // door 1.4 x 2.4
    box(B, 'glow', base, 1.3, 1.1, 0.12, -1.6, 1.0, D / 2 + 0.02); box(B, TRIM, base, 1.5, 0.12, 0.2, -1.6, 0.9, D / 2 + 0.1);
    [-1, 1].forEach(s => box(B, 'glass', base, 0.12, 1.1, 1.3, s * (W / 2 + 0.02), 1.0, 0));
    // porch: deck at floor level (sits on the pad), two posts, a lean-to roof; a bench
    box(B, '#b98a5a', base, W, 0.24, 2.2, 0, -0.2, D / 2 + 1.1);                          // deck: solid down to the pad, top 4 cm over the floor
    [-3.2, 3.2].forEach(x => box(B, DARK, base, 0.22, 2.8, 0.22, x, 0, D / 2 + 2.0));
    box(B, ROOF, base, W + 0.4, 0.18, 2.6, 0, 2.8, D / 2 + 1.2, 0, 0.18);
    box(B, DARK, base, 1.6, 0.45, 0.5, -1.8, 0, D / 2 + 1.5);
  }
  // A-frame: 7.4 wide x 8 deep, roof slabs from the pad up to a 7.6 m ridge, glass gable with the door in it, small deck.
  function aFrame(B, base, r) {
    const ROOF = ['#4f5a4a', '#5f4a3e', '#3f4f5a'][(r() * 3) | 0], WOOD = '#b5774a', DARK = '#5a3a24';
    const HW = 3.7, H = 7.6, D = 8, a = Math.atan2(H, HW), len = Math.hypot(H, HW) + 0.3, th = 0.3, SLAB = new T.BoxGeometry(1, 1, 1);
    [-1, 1].forEach(sd => B.add(SLAB, ROOF, base, sd * (HW / 2 + 0.1), H / 2, 0, th, len, D + 0.6, 0, 0, sd * (Math.PI / 2 - a)));
    [-1, 1].forEach(sd => B.add(prismGeo(HW * 2 - 0.2, H - 0.2, 0.15), sd > 0 ? 'glass' : WOOD, base, 0, 0, sd * (D / 2 - 0.1)));   // gables: glass front, wood back
    box(B, WOOD, base, 0.15, H - 0.6, 0.12, 0, 0, D / 2 - 0.02); box(B, WOOD, base, HW * 2 * (1 - 3.35 / H) - 0.3, 0.15, 0.12, 0, 3.2, D / 2 - 0.02);   // cross bar, kept inside the roof line   // mullions
    box(B, DARK, base, 1.4, 2.4, 0.12, 1.4, 0, D / 2 + 0.02);                                 // door 1.4 x 2.4
    box(B, '#b98a5a', base, HW * 2 + 1, 0.24, 2.4, 0, -0.2, D / 2 + 1.2);                     // deck
    box(B, DARK, base, 1.6, 0.45, 0.5, -1.8, 0, D / 2 + 1.6);
  }

  // ---------- INTROVERT ISLAND v4 (Dev, 24 Nov: "a quiet peaceful island", forest reference) ----------
  // 900 x 700 m, forest everywhere, rocky cliffs with 4 sandy coves (a jetty in each), soft hills up to ~28 m. No river, no roads.
  // Homes: 200 spots, 34 m+ apart, each on its own flat pad in a clearing (terrain is levelled under it, stone plinth round the base).
  // Winding footpaths join every door (shortest-path tree), plus the hall in the middle, the lighthouse on the cliff and the jetties.
  function introvertIsland4(o = {}) {
    const r = rng(o.seed || 4207), g = new T.Group(), fast = !!o.fast, B = Batch(), TR = [], HOMES = o.homes || 200;
    const hw = 450, hl = 350, rN = a => 1 + 0.08 * Math.sin(3 * a + 0.7) + 0.05 * Math.sin(5 * a + 2.1) + 0.03 * Math.sin(9 * a + 0.3) + 0.015 * Math.sin(17 * a);
    const qOf = (x, z) => { const u = x / hw, v = z / hl; return Math.hypot(u, v) / rN(Math.atan2(v, u)); };
    const dist = (x, z) => (1 - qOf(x, z)) * hl;                                          // ~metres inland (negative = sea)
    const COVES = [Math.PI / 2 - 0.15, -0.35, Math.PI + 0.5, -Math.PI / 2 - 0.6];           // harbour cove faces +z (the mainland)
    const angOf = (x, z) => Math.atan2(z / hl, x / hw), aD = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
    const coveF = (x, z) => COVES.reduce((m, c) => Math.max(m, Math.exp(-((aD(angOf(x, z), c) / 0.09) ** 2))), 0);
    const BUMPS = [[-170, -60, 150, 22], [140, -110, 130, 18], [40, 90, 110, 10], [-260, 120, 110, 12], [290, 80, 100, 9], [-40, -200, 120, 14]];
    const hRaw = (x, z) => { const d = dist(x, z), cf = coveF(x, z) * (1 - Math.min(1, Math.max(0, (d - 25) / 40)));
      if (d < 0) return Math.max(-6, (cf > 0.5 ? -0.2 : -1.2) + d * 0.3);
      const cliff = Math.min(6, -1.2 + d * 1.5), cove = Math.min(2.4, d * 0.12), base = cliff * (1 - cf) + cove * cf;
      let hh = 0; BUMPS.forEach(([bx, bz, br, bh]) => { hh += bh * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / br ** 2); });
      return base + (hh + 1.2 * Math.sin(x * 0.05) * Math.cos(z * 0.045)) * Math.min(1, Math.max(0, (d - 8) / 50)); };
    // ---- pick the places first (hall, lighthouse, jetties, 200 homes), then level the ground under each ----
    const PADS = [];                                                                       // {x, z, y, r0 flat, r1 blend}
    const HALL = { x: 10, z: 40 }; HALL.y = hRaw(HALL.x, HALL.z); PADS.push({ x: HALL.x, z: HALL.z, y: HALL.y, r0: 20, r1: 34 });
    // lighthouse: the cliff point nearest the harbour side, 12 m in from the edge
    let LH = null; for (let a = 0.35; a < 1.3; a += 0.02) { const k = (1 - 12 / hl) / rN(a), x = Math.cos(a) * hw * k, z = Math.sin(a) * hl * k; if (coveF(x, z) < 0.05) { LH = { x, z, a }; break; } }
    LH.y = hRaw(LH.x, LH.z); PADS.push({ x: LH.x, z: LH.z, y: LH.y, r0: 7, r1: 12 });
    const JET = COVES.map(c => { let k = 1; const u = Math.cos(c), v = Math.sin(c); while (k > 0.5 && hRaw(u * hw * k * rN(c), v * hl * k * rN(c)) < 0.9) k -= 0.004;
      const x = u * hw * k * rN(c), z = v * hl * k * rN(c), l = Math.hypot(u * hw, v * hl); return { x, z, dx: u * hw / l, dz: v * hl / l, y: hRaw(x, z) }; });
    const homes = [], far = (x, z, m) => homes.every(p => Math.hypot(p.x - x, p.z - z) > m);
    for (let tries = 0, gap = 36; homes.length < HOMES && tries < 60000; tries++) { if (tries % 15000 === 14999) gap -= 3;
      const x = (r() * 2 - 1) * hw, z = (r() * 2 - 1) * hl, d = dist(x, z); if (d < 28) continue;
      if (Math.hypot(x - HALL.x, z - HALL.z) < 50 || Math.hypot(x - LH.x, z - LH.z) < 34 || JET.some(j => Math.hypot(x - j.x, z - j.z) < 34) || !far(x, z, gap)) continue;
      const y = hRaw(x, z), sl = Math.abs(hRaw(x + 6, z) - hRaw(x - 6, z)) + Math.abs(hRaw(x, z + 6) - hRaw(x, z - 6)); if (sl > 5) continue;
      homes.push({ x, z, y: y + 0.15 }); }
    homes.forEach(p => PADS.push({ x: p.x, z: p.z, y: p.y, r0: 9, r1: 17 }));
    const sstep = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const h = (x, z) => { let y = hRaw(x, z); for (const p of PADS) { const q = Math.hypot(x - p.x, z - p.z); if (q < p.r1) { const k = sstep((q - p.r0) / (p.r1 - p.r0)); y = p.y + (y - p.y) * k; } } return y; };
    // ---- terrain: one height grid with vertex colours (grass, forest floor, rock on cliffs, sand in coves, sea floor) ----
    { const gw = hw * 2.3, gl = hl * 2.4, cell = fast ? 7.5 : 5, nx = Math.round(gw / cell), nz = Math.round(gl / cell), G = new T.PlaneGeometry(gw, gl, nx, nz).rotateX(-Math.PI / 2), P = G.attributes.position, col = [];
      const GR = [new T.Color('#7ea455'), new T.Color('#86ab5c'), new T.Color('#76a052')], ROCK = new T.Color('#9c8f80'), ROCK2 = new T.Color('#8a7f72'), SAND = new T.Color('#ecd49a'), DEEP = new T.Color('#c9b98e');
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = h(x, z), d = dist(x, z); P.setY(i, y);
        let c; if (d < -3) c = DEEP; else if (coveF(x, z) > 0.45 && y < 2.6 && d < 40) c = SAND; else if (d < 7) c = (i % 3 ? ROCK : ROCK2); else c = GR[(Math.floor(x / 13) * 7 + Math.floor(z / 13) * 3 & 7) % 3];
        col.push(c.r, c.g, c.b); }
      G.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G.computeVertexNormals();
      const m = new T.Mesh(G, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.receiveShadow = true; g.add(m); }
    // ---- homes: face downhill-ish (toward the view), cabins / A-frames / stone cottages; door point = where the path ends ----
    const doors = [];
    homes.forEach((p, i) => { const gx = hRaw(p.x + 8, p.z) - hRaw(p.x - 8, p.z), gz = hRaw(p.x, p.z + 8) - hRaw(p.x, p.z - 8);
      p.ry = (Math.abs(gx) + Math.abs(gz) > 0.4 ? Math.atan2(-gx, -gz) : r() * Math.PI * 2) + (r() - 0.5) * 0.6; p.type = i % 5 === 2 ? 'a' : i % 5 === 4 ? 'c' : 'l';
      const fwd = p.type === 'a' ? 8 : p.type === 'c' ? 6.5 : 7; p.door = { x: p.x + Math.sin(p.ry) * fwd, z: p.z + Math.cos(p.ry) * fwd }; });
    homes.sort((a, b) => Math.hypot(a.x - HALL.x, a.z - HALL.z) - Math.hypot(b.x - HALL.x, b.z - HALL.z));   // fill order: nearest the hall first
    const filled = o.filled == null ? homes.length : Math.min(o.filled, homes.length);
    homes.forEach((p, i) => { const base = at(p.x, p.y, p.z, p.ry);
      if (i >= filled) return; const b2 = at(p.x, p.y + 0.2, p.z, p.ry);
      if (p.type === 'c') { cottage(B, base, r, true); return; }                         // the cottage brings its own plinth, step and garden
      box(B, '#a39a8c', base, p.type === 'a' ? 8 : 7.8, 1.2, p.type === 'a' ? 8.6 : 6.8, 0, -1.0, p.type === 'a' ? 0 : -0.2);   // stone plinth: 1 m into the pad, 0.2 m above
      if (p.type === 'a') aFrame(B, b2, r); else logCabin(B, b2, r, fast);
      box(B, '#a39a8c', base, 2.0, 0.12, 0.7, 0, 0, p.type === 'a' ? 6.75 : 5.55); });   // a step off the deck onto the pad
    // ---- footpaths: a shortest-path tree over doors + hall + lighthouse + jetty heads, gently curved, draped on the ground ----
    const nodes = [{ x: HALL.x, z: HALL.z + 16 }, { x: LH.x - Math.cos(LH.a) * 8, z: LH.z - Math.sin(LH.a) * 8 }].concat(JET.map(j => ({ x: j.x - j.dx * 4, z: j.z - j.dz * 4 })), homes.map(p => p.door));
    const n = nodes.length, inT = new Uint8Array(n), best = new Float64Array(n).fill(1e18), par = new Int32Array(n).fill(-1); best[0] = 0; const edges = [];
    for (let it = 0; it < n; it++) { let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i; inT[u] = 1; if (par[u] >= 0) edges.push([par[u], u]);
      for (let v = 0; v < n; v++) if (!inT[v]) { const d = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z); if (d < best[v]) { best[v] = d; par[v] = u; } } }
    const PATHPTS = [], PW = 2.0, pos = [];
    edges.forEach(([a, b], ei) => { const A = nodes[a], Bn = nodes[b], L = Math.hypot(Bn.x - A.x, Bn.z - A.z), nx = -(Bn.z - A.z) / L, nz = (Bn.x - A.x) / L, bend = (r() - 0.5) * L * 0.25;
      const cur = new T.QuadraticBezierCurve(new T.Vector2(A.x, A.z), new T.Vector2((A.x + Bn.x) / 2 + nx * bend, (A.z + Bn.z) / 2 + nz * bend), new T.Vector2(Bn.x, Bn.z));
      const pts = cur.getSpacedPoints(Math.max(2, Math.round(L / 2.5))); pts.forEach(p => PATHPTS.push(p));
      for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.y - p.y, l = Math.hypot(dx, dz) || 1, ox = -dz / l * PW / 2, oz = dx / l * PW / 2;
        const v = [[p.x + ox, p.y + oz], [p.x - ox, p.y - oz], [q.x + ox, q.y + oz], [q.x - ox, q.y - oz]].map(([x, z]) => [x, h(x, z) + 0.12, z]);
        pos.push(...v[0], ...v[2], ...v[1], ...v[1], ...v[2], ...v[3]); } });
    { const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); B.add(G, '#cdb88f', null); }
    const PH = new Map(), key = (x, z) => Math.floor(x / 8) * 10007 + Math.floor(z / 8); PATHPTS.forEach(p => { const k = key(p.x, p.y); if (!PH.has(k)) PH.set(k, []); PH.get(k).push(p); });
    const nearPath = (x, z, m) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = PH.get(key(x + i * 8, z + j * 8)); if (L && L.some(p => Math.hypot(p.x - x, p.y - z) < m)) return true; } return false; };
    // ---- the hall (14 x 10 m, timber, on its pad), a little square in front with benches ----
    { const hb = at(HALL.x, HALL.y, HALL.z - 3, 0);
      B.add(new T.CircleGeometry(13, 24).rotateX(-Math.PI / 2), '#c9bfae', null, HALL.x, HALL.y + 0.06, HALL.z + 9);
      box(B, '#a39a8c', hb, 15, 1.4, 11, 0, -0.9, 0); box(B, '#9a5f3a', hb, 14, 6.5, 10, 0, 0.5, 0);
      B.add(prismGeo(10, 4.0, 14.8), '#5f4a3e', hb, 0, 7.0, 0, 1, 1, 1, 0, Math.PI / 2, 0); box(B, '#4a3a30', hb, 15.2, 0.3, 0.5, 0, 10.9, 0);
      box(B, '#e6d8b8', hb, 3.0, 3.3, 0.1, 0, 0.5, 5.02); box(B, '#5a3a24', hb, 2.4, 2.8, 0.12, 0, 0.5, 5.06);
      box(B, '#a39a8c', hb, 3.6, 0.25, 1.0, 0, 0, 5.5); [-3.8, 3.8].forEach(x => { box(B, 'glow', hb, 1.6, 1.6, 0.12, x, 1.8, 5.02); box(B, 'glass', hb, 1.6, 1.4, 0.12, x, 4.4, 5.02); });
      box(B, '#2f4a3c', hb, 4.4, 0.9, 0.12, 0, 3.9, 5.08);
      for (let i = 0; i < 4; i++) { const a = Math.PI * (0.2 + i * 0.2); box(B, '#7a5236', null, 1.8, 0.45, 0.5, HALL.x + Math.cos(a) * 11, HALL.y, HALL.z + 9 + Math.sin(a) * 11, -a + Math.PI / 2); } }
    // ---- the lighthouse on its cliff pad ----
    { const { x: lx, z: lz, y: Y } = LH; box(B, '#a39a8c', null, 8, 1.4, 8, lx, Y - 1.0, lz);
      B.add(new T.CylinderGeometry(2.0, 2.8, 14, 12).translate(0, 7, 0), '#f6f0e2', null, lx, Y + 0.4, lz);
      [4, 9].forEach(y => B.add(new T.CylinderGeometry(2.55 - y * 0.05, 2.6 - y * 0.05, 1.2, 12).translate(0, 0.6, 0), '#c8603f', null, lx, Y + 0.4 + y - 0.6, lz));
      B.add(new T.CylinderGeometry(2.8, 2.8, 0.35, 12), '#2f2b28', null, lx, Y + 14.6, lz); B.add(new T.CylinderGeometry(1.4, 1.4, 2.0, 10).translate(0, 1.0, 0), 'glow', null, lx, Y + 14.8, lz);
      B.add(new T.ConeGeometry(1.9, 1.7, 12).translate(0, 0.85, 0), '#c8603f', null, lx, Y + 16.8, lz);
      const ry = Math.atan2(-Math.cos(LH.a), -Math.sin(LH.a)); box(B, '#5a3a24', at(lx, Y + 0.4, lz, ry), 1.4, 2.4, 0.2, 0, 0, 2.45); }
    // ---- jetties: 3 m wide decks at y 1.2 on posts into the sea floor, 24 m out; two rowboats each ----
    JET.forEach((j, ji) => { const ry = Math.atan2(j.dx, j.dz), L = ji ? 24 : 34, base = at(j.x, 0, j.z, ry);
      box(B, '#b08055', base, 3, 0.25, L, 0, 1.0, L / 2 - 2); for (let z = 0; z <= L - 2; z += 4) [-1.35, 1.35].forEach(x => box(B, '#7a5236', base, 0.3, 6, 0.3, x, -4.8, z));
      [[-3.2, L * 0.55, 0.1], [3.2, L * 0.8, -0.1]].forEach(([x, z, rr], k) => { const bb = base.clone().multiply(at(x, 0, z, rr));
        box(B, ['#f6f0e2', '#3f6fa8', '#c8603f'][(ji + k) % 3], bb, 1.6, 0.8, 4.6, 0, -0.2, 0); box(B, '#b08055', bb, 1.4, 0.08, 4.2, 0, 0.55, 0); }); });
    // ---- rocks along the cliffs (sunk a third into the ground), a few on the beaches ----
    for (let i = 0; i < (fast ? 70 : 130); i++) { const a = r() * Math.PI * 2, k = 1 + (r() - 0.2) * 0.03, x = Math.cos(a) * hw * rN(a) * k, z = Math.sin(a) * hl * rN(a) * k, s = 1.5 + r() * 3.5;
      if (JET.some(j => Math.hypot(x - j.x, z - j.z) < 18)) continue; B.add(new T.IcosahedronGeometry(1, 0), i % 2 ? '#8a7f72' : '#9c8f80', null, x, Math.max(-1, h(x, z)) + s * 0.25, z, s, s * 0.7, s, r(), r() * 6, 0); }
    // ---- the forest: thick, natural (jittered grid + clumps), clear of pads, paths, beaches and cliff edges ----
    const padClear = (x, z) => PADS.some(p => Math.hypot(x - p.x, z - p.z) < p.r0 + 2.5);
    const step = fast ? 9 : 6.5;
    for (let x = -hw * 1.1; x < hw * 1.1; x += step) for (let z = -hl * 1.1; z < hl * 1.1; z += step) {
      const tx = x + (r() - 0.5) * step * 0.9, tz = z + (r() - 0.5) * step * 0.9, d = dist(tx, tz); if (d < 9 || coveF(tx, tz) > 0.4 && d < 45) continue;
      const dens = 0.55 + 0.45 * Math.sin(tx * 0.013 + 1.3) * Math.cos(tz * 0.017); if (r() > 0.45 + dens * 0.55) continue;   // thicker and thinner patches
      if (padClear(tx, tz) || nearPath(tx, tz, 3.2)) continue;
      TR.push({ k: r() < 0.55 ? 'p' : 'r', x: tx, z: tz, y: h(tx, tz) - 0.15, r: r() * 6, s: 0.8 + r() * 0.6, c: (r() * 9) | 0 }); }
    homes.forEach(p => { if (r() < 0.6) { const a = r() * Math.PI * 2; const x = p.x + Math.cos(a) * 12, z = p.z + Math.sin(a) * 12; if (!nearPath(x, z, 3)) TR.push({ k: 'r', x, z, y: h(x, z) - 0.15, r: r() * 6, s: 0.6, c: (r() * 9) | 0 }); } });
    B.build(g, !fast); trees(g, TR, fast);
    g.userData.spots = homes.map(({ x, y, z, ry, type }) => ({ x, y, z, ry, type })); g.userData.radius = 520; g.userData.hall = HALL; g.userData.treeCount = TR.length;
    return g;
  }
  // ---------- tropical trees: palms (trunk + 7 drooping fronds) and bushy jungle canopy, all instanced ----------
  function jungle(g, list, fast) {
    if (!list.length) return; const O = new T.Object3D(), col = new T.Color();
    const make = (geo, L, f, side) => { if (!L.length) return; const im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true, side: side || T.FrontSide }), L.length);
      im.castShadow = !fast; im.receiveShadow = true;
      L.forEach((t, i) => { O.position.set(t.x, t.y, t.z); O.rotation.set(t.lx || 0, t.r, t.lz || 0); O.scale.setScalar(t.s); O.updateMatrix(); im.setMatrixAt(i, O.matrix); im.setColorAt(i, col.set(f(t))); }); g.add(im); };
    const palms = list.filter(t => t.k === 'palm'), bush = list.filter(t => t.k === 'bush');
    make(new T.CylinderGeometry(0.22, 0.34, 8.4, 5, 1, true).translate(0, 3.9, 0), palms, () => '#8a6a48');   // trunk, 0.3 m into the ground
    const fr = []; for (let i = 0; i < 7; i++) { const p = new T.PlaneGeometry(1.0, 4.2, 1, 3); const a = p.attributes.position;
      for (let k = 0; k < a.count; k++) { const y = a.getY(k) + 2.1; a.setY(k, y); a.setX(k, a.getX(k) * (1 - 0.85 * y / 4.2)); a.setZ(k, -0.16 * y * y); }   // tapered, drooping frond
      p.rotateX(-Math.PI / 2 + 0.35).rotateY(i / 7 * Math.PI * 2).translate(0, 8.1, 0); fr.push(p); }
    const pos = []; fr.forEach(p => { const q = p.toNonIndexed(); pos.push(...q.attributes.position.array); });
    const crown = new T.BufferGeometry(); crown.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); crown.computeVertexNormals();
    const LC = ['#4f9a3a', '#5fa844', '#468a34', '#6bb04a'];
    make(crown, palms, t => LC[t.c % 4], T.DoubleSide);
    make(new T.IcosahedronGeometry(2.6, 0).scale(1, 0.8, 1).translate(0, 2.3, 0), bush, t => ['#3f8a32', '#4c9a3a', '#5aa843', '#357a2c', '#62ad48'][t.c % 5]);
  }

  // ---------- INTROVERT ISLAND v5 (Dev, 24 Nov: bean-shaped tropical island, his reference) ----------
  // Bean shape (big circle minus an offset circle, tips rounded), about 600 x 420 m. Wide sand on the inner curve, a turquoise lagoon
  // inside the curve closed by a reef with surf. Thick jungle of palms + bushy trees on a low dome (beach 0.4-1.6 m, top ~9 m).
  // 200 homes about 22 m apart, each in a small clearing on a levelled pad, linked by sandy footpaths. Hall near the lagoon beach,
  // two jetties into the lagoon (harbour side faces +z, the mainland), lighthouse on the east tip. No river, no roads, no cliffs.
  function introvertIsland5(o = {}) {
    const r = rng(o.seed || 5150), g = new T.Group(), fast = !!o.fast, B = Batch(), TR = [], HOMES = o.homes || 200;
    const R1 = 300, C2 = [0, 270], R2 = 205, k = 50;
    const smin = (a, b) => { const hh = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - hh * hh * k / 4; };
    const wob = (x, z) => 5 * Math.sin(x * 0.021 + 0.4) * Math.cos(z * 0.017) + 3 * Math.sin(x * 0.05 + z * 0.04);
    const dA = (x, z) => R1 - Math.hypot(x, z * 1.25), dB = (x, z) => Math.hypot(x - C2[0], z - C2[1]) - R2;   // outer edge / inner (lagoon) edge
    const dist = (x, z) => smin(dA(x, z), dB(x, z)) + wob(x, z);                                     // ~metres inland
    const inner = (x, z) => dB(x, z) < dA(x, z);                                                      // nearest edge is the lagoon side
    const sandW = (x, z) => inner(x, z) ? 42 : 13;
    const DOME = [[0, -150, 190, 7], [-170, -40, 110, 4], [170, -40, 110, 4]];
    const hRaw = (x, z) => { const d = dist(x, z); if (d < 0) return Math.max(-3, 0.1 + d * 0.06);
      const sw = sandW(x, z); if (d < sw) return 0.9 + 0.9 * d / sw;
      let hh = 0; DOME.forEach(([bx, bz, br, bh]) => { hh += bh * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / br ** 2); });
      return 1.8 + hh * Math.min(1, (d - sw) / 40) + 0.5 * Math.sin(x * 0.06) * Math.cos(z * 0.05) * Math.min(1, (d - sw) / 20); };
    const isSand = (x, z) => { const d = dist(x, z); return d >= -2 && d < sandW(x, z); };
    // ---- places: hall (jungle edge above the lagoon beach), jetties, lighthouse (east tip), homes ----
    const PADS = [];
    let HALL = { x: 0, z: 0 }; for (let z = 100; z > -200; z -= 2) { const x = 0; if (dist(x, z) > sandW(x, z) + 8) { HALL = { x, z: z - 10 }; break; } }   // walk inland from the lagoon beach
    HALL.y = hRaw(HALL.x, HALL.z); PADS.push({ x: HALL.x, z: HALL.z, y: HALL.y, r0: 17, r1: 28 });
    const shoreIn = x => { let z = 330; while (dist(x, z) < 0.5 && z > -300) z -= 1; return z; };   // the lagoon-side water line at this x (walking in from the lagoon)
    const JET = [-110, 110].map(x => { const z = shoreIn(x); return { x, z: z - 3, dx: 0, dz: 1, y: hRaw(x, z - 3) }; });
    let LH = null; for (let x = 320; x > 0; x -= 2) { const z = -40 + 0.0; let best = null; for (let zz = -150; zz < 250; zz += 3) { const d = dist(x, zz); if (d > 10 && d < 16) { best = zz; break; } } if (best != null) { LH = { x: x - 6, z: best + 8 }; break; } }
    LH.y = hRaw(LH.x, LH.z); PADS.push({ x: LH.x, z: LH.z, y: LH.y, r0: 6, r1: 10 });
    const homes = [], far = (x, z, m) => homes.every(p => Math.hypot(p.x - x, p.z - z) > m);
    for (let tries = 0, gap = 23; homes.length < HOMES && tries < 80000; tries++) { if (tries % 20000 === 19999) gap -= 1.5;
      const x = (r() * 2 - 1) * R1, z = -R1 / 1.25 + r() * (R1 / 1.25 + 180), d = dist(x, z); if (d < sandW(x, z) + 9) continue;
      if (Math.hypot(x - HALL.x, z - HALL.z) < 38 || Math.hypot(x - LH.x, z - LH.z) < 24 || !far(x, z, gap)) continue;
      homes.push({ x, z, y: hRaw(x, z) + 0.1 }); }
    homes.forEach(p => PADS.push({ x: p.x, z: p.z, y: p.y, r0: 7, r1: 12 }));
    const sstep = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const h = (x, z) => { let y = hRaw(x, z); for (const p of PADS) { const q = Math.hypot(x - p.x, z - p.z); if (q < p.r1) { const kk = sstep((q - p.r0) / (p.r1 - p.r0)); y = p.y + (y - p.y) * kk; } } return y; };
    // ---- terrain ----
    { const gw = 720, gl = 620, cell = fast ? 6 : 4, nx = Math.round(gw / cell), nz = Math.round(gl / cell), G = new T.PlaneGeometry(gw, gl, nx, nz).rotateX(-Math.PI / 2).translate(0, 0, 10), P = G.attributes.position, col = [];
      const GR = [new T.Color('#6f9a45'), new T.Color('#79a64c'), new T.Color('#668f40')], SAND = new T.Color('#f0dca6'), SAND2 = new T.Color('#e8cf92'), WET = new T.Color('#d9bf86');
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = h(x, z), d = dist(x, z); P.setY(i, y);
        const c = d < 0 ? WET : d < sandW(x, z) ? (i % 4 ? SAND : SAND2) : GR[(Math.floor(x / 9) * 7 + Math.floor(z / 9) * 3 & 7) % 3]; col.push(c.r, c.g, c.b); }
      G.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G.computeVertexNormals();
      const m = new T.Mesh(G, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.receiveShadow = true; g.add(m); }
    // ---- the lagoon + shallows: a turquoise sheet just above the map's sea top (0.35): y 0.6 (0.25 m clear of it: no flicker from far away), pale at the sand, deeper to the reef; surf ring on the reef ----
    // (Dev 24 Nov: "around the island with some space", not a huge disc): the sheet reaches ~48 m past the outermost shore on every bearing
    { const RC = [0, -40], RN = fast ? 12 : 18, SN = fast ? 120 : 180, pos = [], col = [], GAP = 48;
      const raw = []; for (let i = 0; i < SN; i++) { const a = i / SN * Math.PI * 2; let last = 0; for (let t = 0; t < 600; t += 2) if (dist(RC[0] + Math.cos(a) * t, RC[1] + Math.sin(a) * t) > 0) last = t; raw.push(last + GAP); }
      const sm = raw.map((v, i) => { let s2 = 0; for (let k = -4; k <= 4; k++) s2 += raw[(i + k + SN) % SN]; return s2 / 9; });   // smooth, so the reef curves gently
      const rr = a => { const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * SN, i0 = Math.floor(f) % SN, i1 = (i0 + 1) % SN, u = f - Math.floor(f); return sm[i0] * (1 - u) + sm[i1] * u; };
      const cA = new T.Color('#b8efe6'), cB = new T.Color('#62d0d8'), cC = new T.Color('#3fb2cc');
      const vtx = (t, a) => { const x = RC[0] + Math.cos(a) * rr(a) * t, z = RC[1] + Math.sin(a) * rr(a) * t, d = -dist(x, z), c = d < 18 ? cA.clone().lerp(cB, Math.max(0, d) / 18) : cB.clone().lerp(cC, Math.min(1, (d - 18) / 40));
        return [x, 0.6, z, c]; };
      for (let j = 0; j < RN; j++) for (let i = 0; i < SN; i++) { const t0 = j / RN, t1 = (j + 1) / RN, a0 = i / SN * Math.PI * 2, a1 = (i + 1) / SN * Math.PI * 2;
        const q = [vtx(t0, a0), vtx(t0, a1), vtx(t1, a0), vtx(t1, a1)]; [0, 2, 1, 1, 2, 3].forEach(n => { pos.push(q[n][0], q[n][1], q[n][2]); col.push(q[n][3].r, q[n][3].g, q[n][3].b); }); }
      const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G.computeVertexNormals();
      const m = new T.Mesh(G, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); m.receiveShadow = true; g.add(m);
      }   // (Dev 24 Nov) no white surf line round the shallows
    // ---- homes ----
    homes.forEach((p, i) => { const toL = Math.atan2(HALL.x - p.x, HALL.z + 60 - p.z);   // face roughly toward the lagoon side
      p.ry = toL + (r() - 0.5) * 1.2; p.type = i % 5 === 2 ? 'a' : i % 5 === 4 ? 'c' : 'l';
      const fwd = p.type === 'a' ? 8 : p.type === 'c' ? 6.5 : 7; p.door = { x: p.x + Math.sin(p.ry) * fwd, z: p.z + Math.cos(p.ry) * fwd }; });
    homes.sort((a, b) => Math.hypot(a.x - HALL.x, a.z - HALL.z) - Math.hypot(b.x - HALL.x, b.z - HALL.z));
    const filled = o.filled == null ? homes.length : Math.min(o.filled, homes.length);
    homes.forEach((p, i) => { if (i >= filled) return; const base = at(p.x, p.y, p.z, p.ry), b2 = at(p.x, p.y + 0.2, p.z, p.ry);
      if (p.type === 'c') { cottage(B, base, r, true); return; }
      box(B, '#a39a8c', base, p.type === 'a' ? 8 : 7.8, 1.2, p.type === 'a' ? 8.6 : 6.8, 0, -1.0, p.type === 'a' ? 0 : -0.2);
      if (p.type === 'a') aFrame(B, b2, r); else logCabin(B, b2, r, fast);
      box(B, '#a39a8c', base, 2.0, 0.12, 0.7, 0, 0, p.type === 'a' ? 6.75 : 5.55); });
    // ---- sandy footpaths (shortest-path tree over doors, hall, jetties, lighthouse) ----
    const nodes = [{ x: HALL.x, z: HALL.z + 15 }, { x: LH.x - 6, z: LH.z }].concat(JET.map(j => ({ x: j.x, z: j.z - 6 })), homes.slice(0, Math.max(filled, 0)).map(p => p.door));
    const n = nodes.length, inT = new Uint8Array(n), best = new Float64Array(n).fill(1e18), par = new Int32Array(n).fill(-1); best[0] = 0; const edges = [];
    for (let it = 0; it < n; it++) { let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i; inT[u] = 1; if (par[u] >= 0) edges.push([par[u], u]);
      for (let v = 0; v < n; v++) if (!inT[v]) { const d = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z); if (d < best[v]) { best[v] = d; par[v] = u; } } }
    const PATHPTS = [], PW = 1.8, pos = [];
    edges.forEach(([a, b]) => { const A = nodes[a], Bn = nodes[b], L = Math.hypot(Bn.x - A.x, Bn.z - A.z), nx = -(Bn.z - A.z) / L, nz = (Bn.x - A.x) / L, bend = (r() - 0.5) * L * 0.3;
      const cur = new T.QuadraticBezierCurve(new T.Vector2(A.x, A.z), new T.Vector2((A.x + Bn.x) / 2 + nx * bend, (A.z + Bn.z) / 2 + nz * bend), new T.Vector2(Bn.x, Bn.z));
      const pts = cur.getSpacedPoints(Math.max(2, Math.round(L / 2.5))); pts.forEach(p => PATHPTS.push(p));
      for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.y - p.y, l = Math.hypot(dx, dz) || 1, ox = -dz / l * PW / 2, oz = dx / l * PW / 2;
        const v = [[p.x + ox, p.y + oz], [p.x - ox, p.y - oz], [q.x + ox, q.y + oz], [q.x - ox, q.y - oz]].map(([x, z]) => [x, h(x, z) + 0.12, z]);
        pos.push(...v[0], ...v[2], ...v[1], ...v[1], ...v[2], ...v[3]); } });
    if (pos.length) { const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); B.add(G, '#e3cf9c', null); }
    const PH = new Map(), key = (x, z) => Math.floor(x / 8) * 10007 + Math.floor(z / 8); PATHPTS.forEach(p => { const kk = key(p.x, p.y); if (!PH.has(kk)) PH.set(kk, []); PH.get(kk).push(p); });
    const nearPath = (x, z, m) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = PH.get(key(x + i * 8, z + j * 8)); if (L && L.some(p => Math.hypot(p.x - x, p.y - z) < m)) return true; } return false; };
    // ---- the hall (14 x 10 m timber, thatch-brown roof), facing the lagoon ----
    { const hb = at(HALL.x, HALL.y, HALL.z - 3, 0);
      B.add(new T.CircleGeometry(12, 24).rotateX(-Math.PI / 2), '#e3cf9c', null, HALL.x, HALL.y + 0.06, HALL.z + 9);
      box(B, '#a39a8c', hb, 15, 1.4, 11, 0, -0.9, 0); box(B, '#b5774a', hb, 14, 6, 10, 0, 0.5, 0);
      B.add(prismGeo(11, 4.2, 15.6), '#8a6a3a', hb, 0, 6.5, 0, 1, 1, 1, 0, Math.PI / 2, 0); box(B, '#6e5230', hb, 16, 0.3, 0.5, 0, 10.6, 0);
      box(B, '#e6d8b8', hb, 3.0, 3.3, 0.1, 0, 0.5, 5.02); box(B, '#5a3a24', hb, 2.4, 2.8, 0.12, 0, 0.5, 5.06); box(B, '#a39a8c', hb, 3.6, 0.25, 1.0, 0, 0, 5.5);
      [-3.8, 3.8].forEach(x => box(B, 'glow', hb, 1.6, 1.6, 0.12, x, 1.8, 5.02)); box(B, '#2f4a3c', hb, 4.4, 0.9, 0.12, 0, 3.9, 5.08); }
    // ---- lighthouse on the east tip ----
    { const { x: lx, z: lz, y: Y } = LH; box(B, '#a39a8c', null, 7, 1.4, 7, lx, Y - 1.0, lz);
      B.add(new T.CylinderGeometry(1.8, 2.5, 13, 12).translate(0, 6.5, 0), '#f6f0e2', null, lx, Y + 0.4, lz);
      [4, 9].forEach(y => B.add(new T.CylinderGeometry(2.25 - y * 0.05, 2.3 - y * 0.05, 1.1, 12).translate(0, 0.55, 0), '#c8603f', null, lx, Y + 0.4 + y - 0.55, lz));
      B.add(new T.CylinderGeometry(2.5, 2.5, 0.35, 12), '#2f2b28', null, lx, Y + 13.6, lz); B.add(new T.CylinderGeometry(1.3, 1.3, 1.9, 10).translate(0, 0.95, 0), 'glow', null, lx, Y + 13.8, lz);
      B.add(new T.ConeGeometry(1.8, 1.6, 12).translate(0, 0.8, 0), '#c8603f', null, lx, Y + 15.7, lz); box(B, '#5a3a24', at(lx, Y + 0.4, lz, -Math.PI / 2), 1.4, 2.4, 0.2, 0, 0, 2.2); }
    // ---- jetties into the lagoon (3 m deck at 1.2 m on posts), rowboats ----
    JET.forEach((j, ji) => { const L = 30, base = at(j.x, 0, j.z, 0);
      box(B, '#b08055', base, 3, 0.25, L, 0, 1.3, L / 2 - 2); for (let z = 0; z <= L - 2; z += 4) [-1.35, 1.35].forEach(x => box(B, '#7a5236', base, 0.3, 4.5, 0.3, x, -3, z));
      [[-3.2, L * 0.6, 0.1], [3.2, L * 0.85, -0.15]].forEach(([x, z, rr], kk) => { const bb = base.clone().multiply(at(x, 0, z, rr));
        box(B, ['#f6f0e2', '#3f6fa8', '#c8603f'][(ji + kk) % 3], bb, 1.6, 0.8, 4.6, 0, 0.3, 0); box(B, '#b08055', bb, 1.4, 0.08, 4.2, 0, 1.05, 0); }); });
    // a few loungers + umbrellas on the lagoon beach, some driftwood rocks
    for (let i = 0; i < 6; i++) { const x = -150 + i * 60 + (r() - 0.5) * 20; let z = shoreIn(x) - 14; if (!isSand(x, z)) continue; const y = h(x, z);
      box(B, '#f6f0e2', null, 0.8, 0.35, 2.0, x, y, z); box(B, '#7a5236', null, 0.08, 2.4, 0.08, x + 1.4, y, z); B.add(new T.ConeGeometry(1.5, 0.6, 8).translate(0, 0.3, 0), ['#d65a5a', '#f0c24a', '#3f8fc8'][i % 3], null, x + 1.4, y + 2.3, z); }
    // ---- the jungle: thick palms + bushy trees, palms leaning out over the beaches ----
    const padClear = (x, z) => PADS.some(p => Math.hypot(x - p.x, z - p.z) < p.r0 + 1.5);
    const step = fast ? 6.2 : 4.6;
    for (let x = -R1 - 10; x < R1 + 10; x += step) for (let z = -R1 / 1.25 - 10; z < 220; z += step) {
      const tx = x + (r() - 0.5) * step, tz = z + (r() - 0.5) * step, d = dist(tx, tz), sw = sandW(tx, tz); if (d < sw - 3) continue;
      if (padClear(tx, tz) || nearPath(tx, tz, 2.2)) continue;
      if (d > sw + 6 && r() < 0.3) continue;                                           // (Dev 24 Nov) a bit thinner: 30% fewer inland trees
      const edge = d < sw + 6, palm = edge || r() < 0.38, y = h(tx, tz) - 0.3;
      if (palm) { const out = Math.atan2(tx, tz * 1.25); TR.push({ k: 'palm', x: tx, z: tz, y, r: r() * 6, s: 0.8 + r() * 0.45, c: (r() * 9) | 0, lx: edge ? Math.cos(out) * 0.18 : (r() - 0.5) * 0.12, lz: edge ? -Math.sin(out) * 0.18 : (r() - 0.5) * 0.12 }); }
      else TR.push({ k: 'bush', x: tx, z: tz, y, r: r() * 6, s: 1.0 + r() * 0.9, c: (r() * 9) | 0 }); }
    B.build(g, !fast); jungle(g, TR, fast);
    g.userData.spots = homes.map(({ x, y, z, ry, type }) => ({ x, y, z, ry, type })); g.userData.radius = 400; g.userData.hall = HALL; g.userData.treeCount = TR.length;
    return g;
  }
  // ---------- NAP VALLEY v3 (Dev, 24 Nov: his reference image) ----------
  // Local frame: centre of the old Nap Valley box (map x -2360, z 1330), valley runs north (-z) to south (+z), 400 m wide floor, 1300 m long.
  // Floor slopes 4.6 m (north) -> 0.9 m (south). Hills both sides (|x| 200..420) and at the north end; everything fades to the map's ground (y 0)
  // by |x| 420 / |z| 760, and triangles that would sit under 0.25 m are dropped so nothing fights the map's own ground.
  // The village road (straight line, P0 + t*D) crosses the valley in a gap between the hills; the stream runs from a spring at the north
  // foot of the hills, always downhill, under a wooden bridge at the road, into the lake in the south.
  function napValley3(o = {}) {
    const r = rng(o.seed || 7341), g = new T.Group(), fast = !!o.fast, B = Batch(), TR = [], HOMES = o.homes || 200;
    const P0 = [0, -156], D = [-0.715, 0.699], NN = [0.699, 0.715], roadDist = (x, z) => Math.abs((x - P0[0]) * NN[0] + (z - P0[1]) * NN[1]);
    const sst = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const floorY = z => 0.6 + 4 * (0.5 - Math.max(-650, Math.min(650, z)) / 1300);
    // stream: spring at the north foot of the hills, gentle bends, ends in the lake (all z increasing -> always downhill)
    const LAKE = { x: 20, z: 540, rx: 120, rz: 75, y: 0.62 };
    const SP = []; for (let z = -600; z <= LAKE.z - 40; z += 4) SP.push({ x: 35 * Math.sin(z / 130 + 0.6) + 18 * Math.sin(z / 47), z });
    const streamD = (x, z) => { let m = 1e9; for (let i = 0; i < SP.length; i += 2) { const d = Math.hypot(x - SP[i].x, z - SP[i].z); if (d < m) m = d; } return m; };
    const lakeQ = (x, z) => Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
    const hills = (x, z) => { const ax = Math.abs(x), side = x < 0 ? 34 : 24;
      let hh = side * 1.35 * sst((ax - 180) / 140) * (1 - sst((ax - 340) / 80)) * (0.8 + 0.2 * Math.sin(z / 90 + (x < 0 ? 1 : 3)));
      hh += 34 * sst((-z - 620) / 90) * (1 - sst((-z - 700) / 60)) * (1 - sst((ax - 320) / 80));                       // north end
      return hh * sst((roadDist(x, z) - 25) / 70); };                                                                   // the gap for the road
    const edgeF = (x, z) => (1 - sst((Math.abs(x) - 340) / 80)) * (1 - sst((Math.abs(z) - 690) / 70));
    const hRaw = (x, z) => { let y = (floorY(z) + 0.4 * Math.sin(x * 0.05) * Math.cos(z * 0.04)) * edgeF(x, z) + hills(x, z);
      const sd = streamD(x, z); if (sd < 9 && z < LAKE.z) { const bed = floorY(z) - 1.1; y = bed + (y - bed) * sst((sd - 3.5) / 5.5); }
      const lq = lakeQ(x, z); if (lq < 1.35) { const bed = LAKE.y - 1.6; y = bed + (y - bed) * sst((lq - 0.85) / 0.5); }
      return y; };
    // ---- places ----
    const FEAT = [], PADS = [];
    const LODGE = { x: 70, z: -10 }; LODGE.y = hRaw(LODGE.x, LODGE.z) + 0.1; PADS.push({ x: LODGE.x, z: LODGE.z, y: LODGE.y, r0: 24, r1: 36 }); FEAT.push([LODGE.x, LODGE.z, 40]);
    const MILL = { x: -125, z: -300 }; MILL.y = hRaw(MILL.x, MILL.z); PADS.push({ x: MILL.x, z: MILL.z, y: MILL.y, r0: 8, r1: 14 }); FEAT.push([MILL.x, MILL.z, 22]);
    const LAV = [[-110, -170, 80, 44, 0.25], [-55, -255, 64, 34, -0.15]], SHEEP = [110, 230, 96, 64, -0.1];
    const inRect = (x, z, [cx, cz, w, d, ry], m = 0) => { const dx = x - cx, dz = z - cz, c = Math.cos(ry), s = Math.sin(ry), u = dx * c - dz * s, v = dx * s + dz * c; return Math.abs(u) < w / 2 + m && Math.abs(v) < d / 2 + m; };
    const busy = (x, z, m) => LAV.some(R => inRect(x, z, R, m)) || inRect(x, z, SHEEP, m) || FEAT.some(([fx, fz, fr]) => Math.hypot(x - fx, z - fz) < fr + m) || lakeQ(x, z) < 1.25 + m / 80;
    const homes = [], far = (x, z, m) => homes.every(p => Math.hypot(p.x - x, p.z - z) > m);
    for (let tries = 0, gap = 24; homes.length < HOMES && tries < 90000; tries++) { if (tries % 22000 === 21999) gap -= 2;
      const x = (r() * 2 - 1) * 270, z = -600 + r() * 1180; if (busy(x, z, 8) || streamD(x, z) < 16 || roadDist(x, z) < 12 || !far(x, z, gap)) continue;
      const y = hRaw(x, z), sl = Math.abs(hRaw(x + 6, z) - hRaw(x - 6, z)) + Math.abs(hRaw(x, z + 6) - hRaw(x, z - 6)); if (sl > 4 || edgeF(x, z) < 0.9) continue;
      homes.push({ x, z, y: y + 0.1 }); }
    homes.forEach(p => PADS.push({ x: p.x, z: p.z, y: p.y, r0: 8, r1: 13 }));
    const h = (x, z) => { let y = hRaw(x, z); for (const p of PADS) { const q = Math.hypot(x - p.x, z - p.z); if (q < p.r1) { const k = sst((q - p.r0) / (p.r1 - p.r0)); y = p.y + (y - p.y) * k; } } return y; };
    // ---- terrain (grid, vertex colours; triangles fully under 0.25 m are left out) ----
    { const gw = 860, gl = 1540, cell = fast ? 9 : 6, nx = Math.round(gw / cell), nz = Math.round(gl / cell), pos = [], col = [];
      const GR = [new T.Color('#86ab5c'), new T.Color('#83a95a'), new T.Color('#88ad5e')], HILL = new T.Color('#7ba352'), BANK = new T.Color('#b9a676');
      const V = []; for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = -gw / 2 + i * cell, z = -gl / 2 + j * cell, y = h(x, z), sd = streamD(x, z);
        const c = sd < 6 && z < LAKE.z ? BANK : lakeQ(x, z) < 1.1 ? BANK : y > floorY(z) + 6 ? HILL : GR[(Math.floor(x / 15) * 7 + Math.floor(z / 15) * 3 & 7) % 3]; V.push([x, y, z, c]); }
      const at2 = (i, j) => V[j * (nx + 1) + i];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = at2(i, j), b = at2(i + 1, j), c = at2(i, j + 1), d = at2(i + 1, j + 1);
        [[a, c, b], [b, c, d]].forEach(t => { if (t.every(v => v[1] < 0.25)) return; t.forEach(v => { pos.push(v[0], v[1], v[2]); col.push(v[3].r, v[3].g, v[3].b); }); }); }
      const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G.setAttribute('color', new T.Float32BufferAttribute(col, 3)); G.computeVertexNormals();
      const m = new T.Mesh(G, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.receiveShadow = true; g.add(m); }
    // ---- water: the stream (5 m ribbon, 0.45 under the floor line, always going down) and the lake ----
    const ribbon = (pts, w, yOf, c) => { const pos = []; for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1, ox = -dz / l * w / 2, oz = dx / l * w / 2;
        const v = [[p.x + ox, yOf(p), p.z + oz], [p.x - ox, yOf(p), p.z - oz], [q.x + ox, yOf(q), q.z + oz], [q.x - ox, yOf(q), q.z - oz]]; pos.push(...v[0], ...v[2], ...v[1], ...v[1], ...v[2], ...v[3]); }
      const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); B.add(G, c, null); };
    ribbon(SP.filter(p => lakeQ(p.x, p.z) > 0.97), 5, p => Math.max(LAKE.y + 0.02, floorY(p.z) - 0.5), '#5aa8cf');   // stops at the lake edge
    B.add(new T.CircleGeometry(1, 48).rotateX(-Math.PI / 2), '#5aa8cf', null, LAKE.x, LAKE.y, LAKE.z, LAKE.rx * 1.02, 1, LAKE.rz * 1.02);
    // ---- the village road through the gap (5 m dirt ribbon over our ground), and a wooden bridge where it meets the stream ----
    let cross = null; for (let t = -700; t < 700; t += 1) { const x = P0[0] + D[0] * t, z = P0[1] + D[1] * t; if (streamD(x, z) < 1.2) { cross = t; break; } }
    { const pts = []; for (let t = -620; t <= 620; t += 3) { if (cross != null && Math.abs(t - cross) < 9) { if (pts.length) { ribbon(pts, 5, p => p.y, '#c9b48a'); pts.length = 0; } continue; }
        const x = P0[0] + D[0] * t, z = P0[1] + D[1] * t, y = h(x, z); if (y < 0.25) continue; pts.push({ x, z, y: y + 0.1 }); }
      if (pts.length > 1) ribbon(pts, 5, p => p.y, '#c9b48a'); }
    if (cross != null) { const cx = P0[0] + D[0] * cross, cz = P0[1] + D[1] * cross, ry = Math.atan2(D[0], D[1]), dy = Math.max(h(cx + D[0] * 9, cz + D[1] * 9), h(cx - D[0] * 9, cz - D[1] * 9)) + 0.1, bb = at(cx, 0, cz, ry);
      box(B, '#a0703f', bb, 5.4, 0.35, 18, 0, dy - 0.2, 0); [-1, 1].forEach(s => { box(B, '#7a5236', bb, 0.2, 1.0, 18, s * 2.6, dy + 0.15, 0); box(B, '#8a8278', bb, 6, dy + 1.5, 1.6, 0, -1.5, s * 8.2); }); }
    // ---- cabins (log cabin + porch + a hammock), facing the valley centre ----
    homes.forEach(p => { p.ry = Math.atan2(-p.x, (LODGE.z - p.z) * 0.3) + (r() - 0.5) * 0.8; p.door = { x: p.x + Math.sin(p.ry) * 7, z: p.z + Math.cos(p.ry) * 7 }; });
    homes.sort((a, b) => Math.hypot(a.x - LODGE.x, a.z - LODGE.z) - Math.hypot(b.x - LODGE.x, b.z - LODGE.z));
    const filled = o.filled == null ? homes.length : Math.min(o.filled, homes.length);
    homes.slice(0, filled).forEach(p => { const base = at(p.x, p.y, p.z, p.ry), b2 = at(p.x, p.y + 0.2, p.z, p.ry);
      box(B, '#a39a8c', base, 7.8, 1.2, 6.8, 0, -1.0, -0.2); logCabin(B, b2, r, fast); box(B, '#a39a8c', base, 2.0, 0.12, 0.7, 0, 0, 5.55);
      const hm = at(p.x, p.y, p.z, p.ry).multiply(at(7.6, 0, 0.5, 0));                        // hammock in the side yard: two posts 3.4 m apart, 2.6 m clear of the wall
      box(B, '#5a3a24', hm, 0.18, 2.0, 0.18, 0, 0, -1.7); box(B, '#5a3a24', hm, 0.18, 2.0, 0.18, 0, 0, 1.7);
      box(B, ['#e8c45a', '#d65a5a', '#5a8ad6', '#f1e8d6'][(r() * 4) | 0], hm, 0.9, 0.06, 2.6, 0, 0.75, 0);
      [-1, 1].forEach(sd => B.add(new T.BoxGeometry(0.05, 0.05, 1.15), '#d9c49a', hm, 0, 1.3, sd * 1.5, 1, 1, 1, sd * 1.05, 0, 0)); });   // ropes: post top -> cloth end
    // ---- lanes: shortest-path tree over porches, the lodge, the mill and points on the road ----
    const nodes = [{ x: LODGE.x, z: LODGE.z + 20 }, { x: MILL.x + 9, z: MILL.z }];
    for (let t = -560; t <= 560; t += 70) { const x = P0[0] + D[0] * t, z = P0[1] + D[1] * t; if (edgeF(x, z) > 0.9 && (cross == null || Math.abs(t - cross) > 20)) nodes.push({ x, z }); }
    const nRoad = nodes.length; homes.slice(0, filled).forEach(p => nodes.push(p.door));
    const n = nodes.length, inT = new Uint8Array(n), best = new Float64Array(n).fill(1e18), par = new Int32Array(n).fill(-1), edges = [];
    for (let i = 2; i < nRoad; i++) best[i] = 0; best[0] = 0;
    for (let it = 0; it < n; it++) { let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i; inT[u] = 1; if (par[u] >= 0) edges.push([par[u], u]);
      for (let v = 0; v < n; v++) if (!inT[v]) { const a = nodes[u], b = nodes[v], d = Math.hypot(a.x - b.x, a.z - b.z) * (streamCross(a, b) ? 4 : 1); if (d < best[v]) { best[v] = d; par[v] = u; } } }
    function streamCross(a, b) { for (let k = 1; k < 10; k++) { const x = a.x + (b.x - a.x) * k / 10, z = a.z + (b.z - a.z) * k / 10; if (streamD(x, z) < 4 && z < LAKE.z) return true; } return false; }
    const LP = [];
    edges.forEach(([a, b]) => { const A = nodes[a], Bn = nodes[b], L = Math.hypot(Bn.x - A.x, Bn.z - A.z); if (L < 1) return; const nx = -(Bn.z - A.z) / L, nz = (Bn.x - A.x) / L, bend = (r() - 0.5) * L * 0.2;
      const cur = new T.QuadraticBezierCurve(new T.Vector2(A.x, A.z), new T.Vector2((A.x + Bn.x) / 2 + nx * bend, (A.z + Bn.z) / 2 + nz * bend), new T.Vector2(Bn.x, Bn.z));
      const pts = cur.getSpacedPoints(Math.max(2, Math.round(L / 3))).map(p => ({ x: p.x, z: p.y, y: h(p.x, p.y) + 0.12 })); pts.forEach(p => LP.push(p)); ribbon(pts, 2.6, p => p.y, '#cdb88f');
      // a footbridge where a lane crosses the stream
      for (let i = 0; i < pts.length - 1; i++) if (streamD(pts[i].x, pts[i].z) < 2 && pts[i].z < LAKE.z) { const q = pts[i], ry = Math.atan2(Bn.x - A.x, Bn.z - A.z), y = floorY(q.z) + 0.3;
        box(B, '#a0703f', at(q.x, 0, q.z, ry), 2.8, 0.25, 11, 0, y, 0); break; } });
    const LH = new Map(), key = (x, z) => Math.floor(x / 8) * 10007 + Math.floor(z / 8); LP.forEach(p => { const k = key(p.x, p.z); if (!LH.has(k)) LH.set(k, []); LH.get(k).push(p); });
    const nearLane = (x, z, m) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = LH.get(key(x + i * 8, z + j * 8)); if (L && L.some(p => Math.hypot(p.x - x, p.z - z) < m)) return true; } return false; };
    // ---- the Dream Lodge: 24 x 14 m, two storeys of logs, wrap-around porch, big gable with a balcony, stone chimneys ----
    { const lb = at(LODGE.x, LODGE.y, LODGE.z, 0), W = '#9a5f3a', DK = '#5a3a24', RF = '#6b3f2e';
      box(B, '#a39a8c', lb, 25, 1.4, 15, 0, -1.0, 0); box(B, W, lb, 24, 7.2, 14, 0, 0.4, 0);
      if (!fast) for (let k = 0; k < 8; k++) box(B, DK, lb, 24.1, 0.12, 14.1, 0, 1.0 + k * 0.8, 0);
      const a = Math.atan2(4.5, 7), half = 7 + 0.7, len = half / Math.cos(a), SL = new T.BoxGeometry(1, 1, 1);
      B.add(prismGeo(14, 4.5, 24), W, lb, 0, 7.6, 0, 1, 1, 1, 0, Math.PI / 2, 0);
      [-1, 1].forEach(sd => B.add(SL, RF, lb, 0, 7.6 + 4.5 - (half / 2) * Math.tan(a) + 0.15 * Math.cos(a), sd * half / 2 + sd * 0.15 * Math.sin(a), 25.4, 0.3, len, sd * a, 0, 0));
      box(B, '#b98a5a', lb, 27, 0.3, 3.4, 0, 0.1, 8.7); for (let x = -13; x <= 13; x += 3.25) box(B, DK, lb, 0.3, 3.2, 0.3, x, 0.4, 10.2);   // porch on the pad + posts
      box(B, RF, lb, 27.6, 0.25, 4.2, 0, 3.6, 8.9, 0, 0.2);
      box(B, '#e6d8b8', lb, 3.4, 3.4, 0.1, 0, 0.4, 7.02); box(B, DK, lb, 2.6, 2.8, 0.12, 0, 0.4, 7.06);                                // double door
      [-8, -4.5, 4.5, 8].forEach(x => { box(B, 'glow', lb, 1.6, 1.5, 0.12, x, 1.4, 7.02); box(B, 'glass', lb, 1.6, 1.5, 0.12, x, 4.6, 7.02); });
      box(B, '#2f4a3c', lb, 6, 1.0, 0.12, 0, 5.2, 7.08);                                                                                 // name board
      [-1, 1].forEach(s => { box(B, '#8a8278', lb, 1.6, 13.5, 1.6, s * 12.8, -0.5, 0); });                                                  // chimneys at both ends
      box(B, '#a39a8c', lb, 6, 0.2, 1.2, 0, 0, 11.0);                                                                                     // stone step off the porch
      for (let i = 0; i < 4; i++) box(B, '#7a5236', null, 1.8, 0.45, 0.6, LODGE.x - 6 + i * 4, LODGE.y, LODGE.z + 18); }
    // ---- windmill: stone tower 13 m, cap, 4 sails (pivot on its pad) ----
    { const mb = at(MILL.x, MILL.y, MILL.z, 0.5);
      B.add(new T.CylinderGeometry(3.0, 4.2, 13, 10).translate(0, 6.5, 0), '#d9cdb4', mb); B.add(new T.ConeGeometry(3.6, 3.4, 10).translate(0, 1.7, 0), '#6b3f2e', mb, 0, 13, 0);
      box(B, '#5a3a24', mb, 1.4, 2.4, 0.2, 0, 0, 4.1); box(B, '#5a3a24', mb, 0.5, 0.5, 1.4, 0, 12.6, 3.6);
      for (let k = 0; k < 4; k++) { const sm = mb.clone().multiply(new T.Matrix4().makeTranslation(0, 12.8, 4.3)).multiply(new T.Matrix4().makeRotationZ(k * Math.PI / 2 + 0.3));
        box(B, '#7a5236', sm, 0.3, 9, 0.15, 0, 0, 0); box(B, '#f1e8d6', sm, 1.8, 7, 0.08, 1.05, 1.6, 0.05); } }
    // ---- lavender fields: purple rows with soil between ----
    LAV.forEach(([cx, cz, w, d, ry]) => { const fb = at(cx, 0, cz, ry), y = h(cx, cz);
      box(B, '#8a6a4a', fb, w, 0.12, d, 0, y - 0.02, 0); for (let v = -d / 2 + 1.2; v < d / 2 - 0.6; v += 2.4) box(B, ['#9a7fd0', '#a68ad8', '#8f74c4'][Math.abs(Math.round(v)) % 3], fb, w - 2, 0.7, 1.2, 0, y, v); });
    // ---- sheep meadow: post-and-rail fence with a gate, sheep grazing ----
    { const [cx, cz, w, d, ry] = SHEEP, sb = at(cx, 0, cz, ry), y = h(cx, cz);
      const side = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n2 = Math.round(L / 4), a2 = Math.atan2(x1 - x0, z1 - z0);
        for (let i = 0; i <= n2; i++) { const x = x0 + (x1 - x0) * i / n2, z = z0 + (z1 - z0) * i / n2; if (Math.abs(x) < 2.2 && z > 0) continue; box(B, '#7a5236', sb, 0.2, 1.3, 0.2, x, y - 0.2, z); }
        box(B, '#9a6a3a', sb.clone().multiply(at((x0 + x1) / 2, 0, (z0 + z1) / 2, a2)), 0.1, 0.12, L, 0, y + 0.85, 0); };
      side(-w / 2, -d / 2, w / 2, -d / 2); side(-w / 2, -d / 2, -w / 2, d / 2); side(w / 2, -d / 2, w / 2, d / 2); side(-w / 2, d / 2, -2.2, d / 2); side(2.2, d / 2, w / 2, d / 2);
      for (let i = 0; i < 16; i++) { const x = (r() - 0.5) * (w - 10), z = (r() - 0.5) * (d - 10), sh = sb.clone().multiply(at(x, y, z, r() * 6));
        box(B, '#f4f0e6', sh, 0.9, 0.75, 1.4, 0, 0.45, 0); box(B, '#2f2b28', sh, 0.45, 0.45, 0.5, 0, 0.9, 0.85); [-0.3, 0.3].forEach(lx => [-0.45, 0.45].forEach(lz => box(B, '#2f2b28', sh, 0.14, 0.45, 0.14, lx, 0, lz))); } }
    // ---- trees: groves on the hillsides + a few in the valley, never on lanes, fields, water or pads ----
    const padClear = (x, z) => PADS.some(p => Math.hypot(x - p.x, z - p.z) < p.r0 + 2);
    const groves = []; for (let i = 0; i < (fast ? 60 : 95); i++) { const s = r() < 0.5 ? -1 : 1; groves.push([s * (195 + r() * 150), -680 + r() * 1340, 16 + r() * 30]); }
    for (let i = 0; i < 22; i++) groves.push([(r() - 0.5) * 360, -560 + r() * 1050, 10 + r() * 10]);
    groves.forEach(([gx, gz, gr]) => { const nT = Math.round(gr * gr / (fast ? 40 : 26)); for (let i = 0; i < nT; i++) { const a = r() * Math.PI * 2, q = Math.sqrt(r()) * gr, x = gx + Math.cos(a) * q, z = gz + Math.sin(a) * q;
      if (edgeF(x, z) < 0.25 || busy(x, z, 3) || streamD(x, z) < 7 || roadDist(x, z) < 6 || padClear(x, z) || nearLane(x, z, 3)) continue; const y = h(x, z); if (y < 0.3) continue;
      TR.push({ k: r() < (Math.abs(x) > 200 ? 0.55 : 0.2) ? 'p' : 'r', x, z, y: y - 0.15, r: r() * 6, s: 0.8 + r() * 0.5, c: (r() * 9) | 0 }); } });
    B.build(g, !fast); trees(g, TR, fast);
    g.userData.spots = homes.map(({ x, y, z, ry }) => ({ x, y, z, ry })); g.userData.lodge = LODGE; g.userData.treeCount = TR.length;
    return g;
  }
  // ---------- NAP VALLEY v4 (Dev, 24 Nov: "be logical" + his sketch) ----------
  // The valley itself is made by the MAP: two mountain ridges from the coast inland (map/index.html RIDGES, part of the country's own hills),
  // a small mountain closing the inland end. This builder only puts the district on the valley floor (local frame, centre o.centre):
  // the stream (o.stream: local points from the spring to the sea, flowing past a small lake), cabins, lanes, lodge, windmill, lavender,
  // sheep, groves. Ground = o.ground (the map's hill height) + 0.22 (the map's painted land). No terrain of its own: nothing to look pasted.
  function napValley4(o = {}) {
    const r = rng(o.seed || 7341), g = new T.Group(), fast = !!o.fast, B = Batch(), TR = [], HOMES = o.homes || 200;
    const P0 = o.road ? o.road.p : [0, -468], D = o.road ? o.road.d : [-0.715, 0.699], NN = [D[1], -D[0]], roadDist = (x, z) => Math.abs((x - P0[0]) * NN[0] + (z - P0[1]) * NN[1]);
    const GR0 = o.ground || (() => 0), gy = (x, z) => Math.max(0, GR0(x, z)) + 0.22, HW = o.halfW || 220, HL = o.halfL || 760;
    const sst = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const SP = (o.stream || []).map(([x, z]) => ({ x, z }));
    const LAKE = o.lake || { x: 0, z: 480, rx: 90, rz: 55 };
    const streamD = (x, z) => { let m = 1e9; for (let i = 0; i < SP.length; i++) { const d = Math.hypot(x - SP[i].x, z - SP[i].z); if (d < m) m = d; } return m; };
    const lakeQ = (x, z) => Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
    const edgeF = (x, z) => (Math.abs(x - AX(z)) < HW && Math.abs(z) < HL && GR0(x, z) < 3) ? 1 : 0;
    const hRaw = gy, AX = o.axis || (() => 0);
    const wAt = z => { const z0 = SP.length ? SP[0].z : 1, z1 = SP.length ? SP[SP.length - 1].z : 0, k = Math.min(1, Math.max(0, (z0 - z) / (z0 - z1 || 1))); return 6 + 12 * k; };   // water width: 6 m at the spring, 18 m at the sea
    const sAt = z => { let b = null, m = 1e9; SP.forEach(p => { const d = Math.abs(p.z - z); if (d < m) { m = d; b = p; } }); return b ? b.x : AX(z); };
    const away = (z, d) => AX(z) + (sAt(z) > AX(z) ? -d : d);   // a spot on the side of the valley away from the stream

    // ---- places ----
    const FEAT = [], PADS = [];
    const LODGE = { x: away(-200, 58), z: -200 }; LODGE.y = hRaw(LODGE.x, LODGE.z) + 0.1; PADS.push({ x: LODGE.x, z: LODGE.z, y: LODGE.y, r0: 24, r1: 36 }); FEAT.push([LODGE.x, LODGE.z, 40]);
    const MILL = { x: away(320, 52), z: 320 }; MILL.y = hRaw(MILL.x, MILL.z); PADS.push({ x: MILL.x, z: MILL.z, y: MILL.y, r0: 8, r1: 14 }); FEAT.push([MILL.x, MILL.z, 22]);
    const LAV = [[away(-480, 52), -480, 34, 72, 0.05], [away(140, 55), 140, 30, 60, -0.05]], SHEEP = [away(700, 58), 700, 46, 84, 0];
    const inRect = (x, z, [cx, cz, w, d, ry], m = 0) => { const dx = x - cx, dz = z - cz, c = Math.cos(ry), s = Math.sin(ry), u = dx * c - dz * s, v = dx * s + dz * c; return Math.abs(u) < w / 2 + m && Math.abs(v) < d / 2 + m; };
    const busy = (x, z, m) => LAV.some(R => inRect(x, z, R, m)) || inRect(x, z, SHEEP, m) || FEAT.some(([fx, fz, fr]) => Math.hypot(x - fx, z - fz) < fr + m) || lakeQ(x, z) < 1.25 + m / 80;
    const homes = [], far = (x, z, m) => homes.every(p => Math.hypot(p.x - x, p.z - z) > m);
    for (let tries = 0, gap = 24; homes.length < HOMES && tries < 90000; tries++) { if (tries % 22000 === 21999) gap -= 2;
      const z = (r() * 2 - 1) * HL, x = AX(z) + (r() * 2 - 1) * HW; if (busy(x, z, 8) || streamD(x, z) < 12 + wAt(z) / 2 || roadDist(x, z) < 14 || !far(x, z, gap)) continue;
      const y = hRaw(x, z), sl = Math.abs(hRaw(x + 6, z) - hRaw(x - 6, z)) + Math.abs(hRaw(x, z + 6) - hRaw(x, z - 6)); if (sl > 1.5 || edgeF(x, z) < 1) continue;
      homes.push({ x, z, y: y + 0.1 }); }
    homes.forEach(p => PADS.push({ x: p.x, z: p.z, y: p.y, r0: 8, r1: 13 }));
    const h = (x, z) => { let y = hRaw(x, z); for (const p of PADS) { const q = Math.hypot(x - p.x, z - p.z); if (q < p.r1) { const k = sst((q - p.r0) / (p.r1 - p.r0)); y = p.y + (y - p.y) * k; } } return y; };
    // ---- water: the stream (5 m ribbon, 0.45 under the floor line, always going down) and the lake ----
    const ribbon = (pts, w, yOf, c) => { const pos = [], W = typeof w === 'function' ? w : () => w; for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1, ox = -dz / l / 2, oz = dx / l / 2, wp = W(p), wq = W(q);
        const v = [[p.x + ox * wp, yOf(p), p.z + oz * wp], [p.x - ox * wp, yOf(p), p.z - oz * wp], [q.x + ox * wq, yOf(q), q.z + oz * wq], [q.x - ox * wq, yOf(q), q.z - oz * wq]]; pos.push(...v[0], ...v[2], ...v[1], ...v[1], ...v[2], ...v[3]); }
      const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); B.add(G, c, null); };
    { const pts = SP.filter(p => lakeQ(p.x, p.z) > 0.95); let run = [];
      const flush = () => { if (run.length > 1) { ribbon(run, p => wAt(p.z) + 7, p => gy(p.x, p.z) + 0.04, '#c9b48a'); ribbon(run, p => wAt(p.z), p => gy(p.x, p.z) + 0.09, '#5aa8cf'); } run = []; };
      pts.forEach((p, i) => { if (i && Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 12) flush(); run.push(p); }); flush(); }
    B.add(new T.CircleGeometry(1, 48).rotateX(-Math.PI / 2), '#d9c49a', null, LAKE.x, gy(LAKE.x, LAKE.z) + 0.03, LAKE.z, LAKE.rx * 1.12, 1, LAKE.rz * 1.15);   // sandy rim
    B.add(new T.CircleGeometry(1, 48).rotateX(-Math.PI / 2), '#5aa8cf', null, LAKE.x, gy(LAKE.x, LAKE.z) + 0.09, LAKE.z, LAKE.rx, 1, LAKE.rz);
    // ---- the village road through the gap (5 m dirt ribbon over our ground), and a wooden bridge where it meets the stream ----
    let cross = null; for (let t = -2000; t < 2000; t += 1) { const x = P0[0] + D[0] * t, z = P0[1] + D[1] * t; if (streamD(x, z) < 1.2 && edgeF(x, z)) { cross = t; break; } }
    if (cross != null) { const cx = P0[0] + D[0] * cross, cz = P0[1] + D[1] * cross, ry = Math.atan2(D[0], D[1]), dy = gy(cx, cz) + 0.8, bb = at(cx, 0, cz, ry);
      const BL = wAt(cz) + 12; box(B, '#a0703f', bb, 5.4, 0.35, BL, 0, dy - 0.2, 0); [-1, 1].forEach(s => { box(B, '#7a5236', bb, 0.2, 1.0, BL, s * 2.6, dy + 0.15, 0); box(B, '#8a8278', bb, 6, dy + 0.5, 1.6, 0, -0.5, s * (BL / 2 - 0.8)); }); }
    // ---- cabins (log cabin + porch + a hammock), facing the valley centre ----
    homes.forEach(p => { p.ry = Math.atan2(AX(p.z) - p.x, (LODGE.z - p.z) * 0.05) + (r() - 0.5) * 0.8; p.door = { x: p.x + Math.sin(p.ry) * 7, z: p.z + Math.cos(p.ry) * 7 }; });
    homes.sort((a, b) => Math.hypot(a.x - LODGE.x, a.z - LODGE.z) - Math.hypot(b.x - LODGE.x, b.z - LODGE.z));
    const filled = o.filled == null ? homes.length : Math.min(o.filled, homes.length);
    homes.slice(0, filled).forEach(p => { const base = at(p.x, p.y, p.z, p.ry), b2 = at(p.x, p.y + 0.2, p.z, p.ry);
      box(B, '#a39a8c', base, 7.8, 1.2, 6.8, 0, -1.0, -0.2); logCabin(B, b2, r, fast); box(B, '#a39a8c', base, 2.0, 0.12, 0.7, 0, 0, 5.55);
      const hm = at(p.x, p.y, p.z, p.ry).multiply(at(7.6, 0, 0.5, 0));                        // hammock in the side yard: two posts 3.4 m apart, 2.6 m clear of the wall
      box(B, '#5a3a24', hm, 0.18, 2.0, 0.18, 0, 0, -1.7); box(B, '#5a3a24', hm, 0.18, 2.0, 0.18, 0, 0, 1.7);
      box(B, ['#e8c45a', '#d65a5a', '#5a8ad6', '#f1e8d6'][(r() * 4) | 0], hm, 0.9, 0.06, 2.6, 0, 0.75, 0);
      [-1, 1].forEach(sd => B.add(new T.BoxGeometry(0.05, 0.05, 1.15), '#d9c49a', hm, 0, 1.3, sd * 1.5, 1, 1, 1, sd * 1.05, 0, 0)); });   // ropes: post top -> cloth end
    // ---- lanes: shortest-path tree over porches, the lodge, the mill and points on the road ----
    const nodes = [{ x: LODGE.x, z: LODGE.z + 20 }, { x: MILL.x + 9, z: MILL.z }];
    for (let t = -2000; t <= 2000; t += 70) { const x = P0[0] + D[0] * t, z = P0[1] + D[1] * t; if (edgeF(x, z) > 0.9 && (cross == null || Math.abs(t - cross) > 20)) nodes.push({ x, z }); }
    const nRoad = nodes.length; homes.slice(0, filled).forEach(p => nodes.push(p.door));
    const n = nodes.length, inT = new Uint8Array(n), best = new Float64Array(n).fill(1e18), par = new Int32Array(n).fill(-1), edges = [];
    for (let i = 2; i < nRoad; i++) best[i] = 0; best[0] = 0;
    for (let it = 0; it < n; it++) { let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i; inT[u] = 1; if (par[u] >= 0) edges.push([par[u], u]);
      for (let v = 0; v < n; v++) if (!inT[v]) { const a = nodes[u], b = nodes[v], d = Math.hypot(a.x - b.x, a.z - b.z) * (streamCross(a, b) ? 4 : 1); if (d < best[v]) { best[v] = d; par[v] = u; } } }
    function streamCross(a, b) { for (let k = 1; k < 10; k++) { const x = a.x + (b.x - a.x) * k / 10, z = a.z + (b.z - a.z) * k / 10; if (streamD(x, z) < 4) return true; } return false; }
    const LP = [];
    edges.forEach(([a, b]) => { const A = nodes[a], Bn = nodes[b], L = Math.hypot(Bn.x - A.x, Bn.z - A.z); if (L < 1) return; const nx = -(Bn.z - A.z) / L, nz = (Bn.x - A.x) / L, bend = (r() - 0.5) * L * 0.2;
      const cur = new T.QuadraticBezierCurve(new T.Vector2(A.x, A.z), new T.Vector2((A.x + Bn.x) / 2 + nx * bend, (A.z + Bn.z) / 2 + nz * bend), new T.Vector2(Bn.x, Bn.z));
      const pts = cur.getSpacedPoints(Math.max(2, Math.round(L / 3))).map(p => ({ x: p.x, z: p.y, y: h(p.x, p.y) + 0.12 })); pts.forEach(p => LP.push(p)); ribbon(pts, 2.6, p => p.y, '#cdb88f');
      // a footbridge where a lane crosses the stream
      for (let i = 0; i < pts.length - 1; i++) if (streamD(pts[i].x, pts[i].z) < 2) { const q = pts[i], ry = Math.atan2(Bn.x - A.x, Bn.z - A.z), y = gy(q.x, q.z) + 0.35;
        box(B, '#a0703f', at(q.x, 0, q.z, ry), 2.8, 0.25, wAt(q.z) + 7, 0, y, 0); break; } });
    const LH = new Map(), key = (x, z) => Math.floor(x / 8) * 10007 + Math.floor(z / 8); LP.forEach(p => { const k = key(p.x, p.z); if (!LH.has(k)) LH.set(k, []); LH.get(k).push(p); });
    const nearLane = (x, z, m) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = LH.get(key(x + i * 8, z + j * 8)); if (L && L.some(p => Math.hypot(p.x - x, p.z - z) < m)) return true; } return false; };
    // ---- the Dream Lodge: 24 x 14 m, two storeys of logs, wrap-around porch, big gable with a balcony, stone chimneys ----
    { const lb = at(LODGE.x, LODGE.y, LODGE.z, 0), W = '#9a5f3a', DK = '#5a3a24', RF = '#6b3f2e';
      box(B, '#a39a8c', lb, 25, 1.4, 15, 0, -1.0, 0); box(B, W, lb, 24, 7.2, 14, 0, 0.4, 0);
      if (!fast) for (let k = 0; k < 8; k++) box(B, DK, lb, 24.1, 0.12, 14.1, 0, 1.0 + k * 0.8, 0);
      const a = Math.atan2(4.5, 7), half = 7 + 0.7, len = half / Math.cos(a), SL = new T.BoxGeometry(1, 1, 1);
      B.add(prismGeo(14, 4.5, 24), W, lb, 0, 7.6, 0, 1, 1, 1, 0, Math.PI / 2, 0);
      [-1, 1].forEach(sd => B.add(SL, RF, lb, 0, 7.6 + 4.5 - (half / 2) * Math.tan(a) + 0.15 * Math.cos(a), sd * half / 2 + sd * 0.15 * Math.sin(a), 25.4, 0.3, len, sd * a, 0, 0));
      box(B, '#b98a5a', lb, 27, 0.3, 3.4, 0, 0.1, 8.7); for (let x = -13; x <= 13; x += 3.25) box(B, DK, lb, 0.3, 3.2, 0.3, x, 0.4, 10.2);   // porch on the pad + posts
      box(B, RF, lb, 27.6, 0.25, 4.2, 0, 3.6, 8.9, 0, 0.2);
      box(B, '#e6d8b8', lb, 3.4, 3.4, 0.1, 0, 0.4, 7.02); box(B, DK, lb, 2.6, 2.8, 0.12, 0, 0.4, 7.06);                                // double door
      [-8, -4.5, 4.5, 8].forEach(x => { box(B, 'glow', lb, 1.6, 1.5, 0.12, x, 1.4, 7.02); box(B, 'glass', lb, 1.6, 1.5, 0.12, x, 4.6, 7.02); });
      box(B, '#2f4a3c', lb, 6, 1.0, 0.12, 0, 5.2, 7.08);                                                                                 // name board
      [-1, 1].forEach(s => { box(B, '#8a8278', lb, 1.6, 13.5, 1.6, s * 12.8, -0.5, 0); });                                                  // chimneys at both ends
      box(B, '#a39a8c', lb, 6, 0.2, 1.2, 0, 0, 11.0);                                                                                     // stone step off the porch
      for (let i = 0; i < 4; i++) box(B, '#7a5236', null, 1.8, 0.45, 0.6, LODGE.x - 6 + i * 4, LODGE.y, LODGE.z + 18); }
    // ---- windmill: stone tower 13 m, cap, 4 sails (pivot on its pad) ----
    { const mb = at(MILL.x, MILL.y, MILL.z, 0.5);
      B.add(new T.CylinderGeometry(3.0, 4.2, 13, 10).translate(0, 6.5, 0), '#d9cdb4', mb); B.add(new T.ConeGeometry(3.6, 3.4, 10).translate(0, 1.7, 0), '#6b3f2e', mb, 0, 13, 0);
      box(B, '#5a3a24', mb, 1.4, 2.4, 0.2, 0, 0, 4.1); box(B, '#5a3a24', mb, 0.5, 0.5, 1.4, 0, 12.6, 3.6);
      for (let k = 0; k < 4; k++) { const sm = mb.clone().multiply(new T.Matrix4().makeTranslation(0, 12.8, 4.3)).multiply(new T.Matrix4().makeRotationZ(k * Math.PI / 2 + 0.3));
        box(B, '#7a5236', sm, 0.3, 9, 0.15, 0, 0, 0); box(B, '#f1e8d6', sm, 1.8, 7, 0.08, 1.05, 1.6, 0.05); } }
    // ---- lavender fields: purple rows with soil between ----
    LAV.forEach(([cx, cz, w, d, ry]) => { const fb = at(cx, 0, cz, ry), y = h(cx, cz);
      box(B, '#8a6a4a', fb, w, 0.12, d, 0, y - 0.02, 0); for (let v = -d / 2 + 1.2; v < d / 2 - 0.6; v += 2.4) box(B, ['#9a7fd0', '#a68ad8', '#8f74c4'][Math.abs(Math.round(v)) % 3], fb, w - 2, 0.7, 1.2, 0, y, v); });
    // ---- sheep meadow: post-and-rail fence with a gate, sheep grazing ----
    { const [cx, cz, w, d, ry] = SHEEP, sb = at(cx, 0, cz, ry), y = h(cx, cz);
      const side = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n2 = Math.round(L / 4), a2 = Math.atan2(x1 - x0, z1 - z0);
        for (let i = 0; i <= n2; i++) { const x = x0 + (x1 - x0) * i / n2, z = z0 + (z1 - z0) * i / n2; if (Math.abs(x) < 2.2 && z > 0) continue; box(B, '#7a5236', sb, 0.2, 1.3, 0.2, x, y - 0.2, z); }
        box(B, '#9a6a3a', sb.clone().multiply(at((x0 + x1) / 2, 0, (z0 + z1) / 2, a2)), 0.1, 0.12, L, 0, y + 0.85, 0); };
      side(-w / 2, -d / 2, w / 2, -d / 2); side(-w / 2, -d / 2, -w / 2, d / 2); side(w / 2, -d / 2, w / 2, d / 2); side(-w / 2, d / 2, -2.2, d / 2); side(2.2, d / 2, w / 2, d / 2);
      for (let i = 0; i < 16; i++) { const x = (r() - 0.5) * (w - 10), z = (r() - 0.5) * (d - 10), sh = sb.clone().multiply(at(x, y, z, r() * 6));
        box(B, '#f4f0e6', sh, 0.9, 0.75, 1.4, 0, 0.45, 0); box(B, '#2f2b28', sh, 0.45, 0.45, 0.5, 0, 0.9, 0.85); [-0.3, 0.3].forEach(lx => [-0.45, 0.45].forEach(lz => box(B, '#2f2b28', sh, 0.14, 0.45, 0.14, lx, 0, lz))); } }
    // ---- trees: groves on the hillsides + a few in the valley, never on lanes, fields, water or pads ----
    const padClear = (x, z) => PADS.some(p => Math.hypot(x - p.x, z - p.z) < p.r0 + 2);
    const groves = []; for (let i = 0; i < (fast ? 34 : 54); i++) { const z = (r() * 2 - 1) * HL; groves.push([AX(z) + (r() * 2 - 1) * HW, z, 10 + r() * 14]); }
    groves.forEach(([gx, gz, gr]) => { const nT = Math.round(gr * gr / (fast ? 40 : 26)); for (let i = 0; i < nT; i++) { const a = r() * Math.PI * 2, q = Math.sqrt(r()) * gr, x = gx + Math.cos(a) * q, z = gz + Math.sin(a) * q;
      if (edgeF(x, z) < 1 || busy(x, z, 3) || streamD(x, z) < 5 + wAt(z) / 2 || roadDist(x, z) < 6 || padClear(x, z) || nearLane(x, z, 3)) continue; const y = h(x, z);
      TR.push({ k: r() < 0.25 ? 'p' : 'r', x, z, y: y - 0.15, r: r() * 6, s: 0.8 + r() * 0.5, c: (r() * 9) | 0 }); } });
    B.build(g, !fast); trees(g, TR, fast);
    g.userData.spots = homes.map(({ x, y, z, ry }) => ({ x, y, z, ry })); g.userData.lodge = LODGE; g.userData.treeCount = TR.length;   // v4
    return g;
  }
  root.VinlandDistricts3 = { introvertIsland3, introvertIsland4, introvertIsland5, napValley3, napValley4, cottage, logCabin, aFrame, CT };
})(window);
