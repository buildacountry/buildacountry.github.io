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

  // ---------- THE ISLAND GROUP (Dev, 24-25 Nov): natural islands round Introvert Island, room for ~1,000 more cottages ----------
  // Built the way real island groups look (Phi Phi, Bora Bora, the Maldives, El Nido): clear size steps, clustered, never a ring.
  //  · the jungle island (east): hill, rock cliff on the open-sea side, sandy cove, sand spit;
  //  · the palm island (south-west): low, palms, a sandbar to two tiny cays;
  //  · West Island: long and low, a sheltered bay facing Introvert Island, a lobe reaching toward the palm island;
  //  · North Island: the biggest, behind Introvert Island: two bays on its south side, a headland, a low ridge with rocky tops,
  //    cliffs on its north (open-sea) side;
  //  · a few sea stacks; every island sits on a turquoise shelf that fades into the sea, deep channels in between.
  // Coasts come from noise at two scales (coves, headlands), never ovals. Cottage spots are scattered like on Introvert Island:
  // each in its own clearing, closer together near a village (a bay), sparser inland, never on beaches, cliffs or steep ground.
  // A village grows from its jetty: spots are numbered island by island (jungle, palm, West, North), nearest the jetty first.
  // Only taken spots get a cottage, a levelled pad, a cleared garden and a footpath; an island gets its jetty with its first cottage.
  // o.filled = how many of these spots are taken (counted from the first). Spots never change with phone/desktop or o.filled.
  function isletWorld() {
    const hsh = (i, j, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vn = (x, z, s) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
      const a = hsh(i, j, s), b = hsh(i + 1, j, s), c = hsh(i, j + 1, s), d = hsh(i + 1, j + 1, s); return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1; };
    const fbm = (x, z, s) => vn(x, z, s) * 0.55 + vn(x * 2.07, z * 2.07, s + 7) * 0.27 + vn(x * 4.3, z * 4.3, s + 13) * 0.12 + vn(x * 8.9, z * 8.9, s + 29) * 0.06;
    const sst = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const smin = (a, b, k) => { const hh = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - hh * hh * k / 4; };
    const smax = (a, b, k) => -smin(-a, -b, k);
    // kind: 'big' (ridge + cliffs), 'hill' (one hill + a cliff), 'low' (palms), 'cay' (sand + a palm or two). a / b: half length / width,
    // rot: long axis (radians, +x toward +z), sea: the open-sea side, H: hill height (m), lobes: [x, z, a, b, rot] peninsulas, coves: [x, z, r] bays,
    // vil: village centres (the first one is the harbour with the jetty)
    const ISL = [
      { kind: 'hill', x: 462, z: 34, a: 132, b: 64, rot: 1.40, H: 11, sea: [1, -0.25], s: 11, coves: [[404, 44, 34]], vil: [[425, 52]] },
      { kind: 'low', x: -330, z: 320, a: 86, b: 48, rot: 0.62, H: 3.6, sea: [-0.6, 0.8], s: 23, vil: [[-318, 300]] },
      { kind: 'big', x: -850, z: -60, a: 370, b: 185, rot: 1.45, H: 7, sea: [-1, 0], s: 63, lobes: [[-720, 215, 150, 100, 0.9]], coves: [[-665, -120, 75]], vil: [[-775, -120], [-750, 180], [-860, -330], [-910, 60]] },
      { kind: 'big', x: 60, z: -780, a: 530, b: 245, rot: -0.12, H: 12, sea: [0.1, -1], s: 51, lobes: [[-370, -730, 210, 145, 0.6], [520, -900, 195, 88, -0.5]], coves: [[-120, -560, 95], [300, -605, 55]], vil: [[-110, -705], [290, -715], [-370, -720], [60, -800], [510, -880]] },
      { kind: 'cay', x: -202, z: 432, a: 23, b: 13, rot: 0.35, H: 0, s: 37 },
      { kind: 'cay', x: -134, z: 462, a: 14, b: 9, rot: 0.15, H: 0, s: 41 } ];
    ISL.forEach(I => { I.sea = I.sea || [1, 0]; const n = Math.hypot(I.sea[0], I.sea[1]); I.c = Math.cos(I.rot); I.sn = Math.sin(I.rot); I.sx = I.sea[0] / n; I.sz = I.sea[1] / n;
      I.W = Math.min(I.b * 0.5, 40); I.far = Math.max(I.a, ...(I.lobes || []).map(([lx, lz, la]) => Math.hypot(lx - I.x, lz - I.z) + la)) + I.W + 70; });
    const BARS = [[-184, 438, -144, 457, 5.5], [-268, 372, -214, 424, 4.5], [478, 150, 452, 206, 6.5], [-640, 326, -592, 352, 5]];   // sandbars (x0, z0, x1, z1, half width)
    const STACKS = [[500, -150, 9, 14], [527, -121, 6, 9], [-154, -338, 7, 8], [-372, 262, 5, 6], [-1085, -180, 8, 11], [-470, -950, 9, 12], [705, -1010, 7, 9]];   // sea stacks: x, z, radius, height
    const oval = (x, z, cx, cz, a, b, rot, s, W) => { const dx = x - cx + fbm(x / 70, z / 70, s) * W, dz = z - cz + fbm(x / 70 + 31, z / 70 - 17, s + 3) * W, c = Math.cos(rot), sn = Math.sin(rot);
      return (1 - Math.hypot((dx * c + dz * sn) / a, (-dx * sn + dz * c) / b)) * b; };
    const dIsl = (I, x, z) => { const R0 = Math.hypot(x - I.x, z - I.z); if (R0 > I.far) return I.far - 70 - R0 - 40;
      let d = oval(x, z, I.x, I.z, I.a, I.b, I.rot, I.s, I.W);
      (I.lobes || []).forEach(([lx, lz, la, lb, lr], k) => { d = smax(d, oval(x, z, lx, lz, la, lb, lr, I.s + 50 + k, Math.min(lb * 0.5, 40)), 30); });
      d += fbm(x / 22, z / 22, I.s + 5) * Math.min(5, I.b * 0.12) + (I.kind === 'big' ? fbm(x / 55, z / 55, I.s + 71) * 8 : 0);
      (I.coves || []).forEach(([cx, cz, cr], k) => { const wx = x + fbm(x / 45, z / 45, I.s + 90 + k) * cr * 0.45, wz = z + fbm(x / 45 + 13, z / 45 - 7, I.s + 95 + k) * cr * 0.45;   // bays wander too: never a perfect circle
        d = smin(d, Math.hypot((wx - cx) * 0.85, (wz - cz) * 1.15) - cr, 18); });
      return d; };
    const dBar = ([x0, z0, x1, z1, w], x, z) => { if (x < Math.min(x0, x1) - 60 || x > Math.max(x0, x1) + 60 || z < Math.min(z0, z1) - 60 || z > Math.max(z0, z1) + 60) return -60; const px = x - x0, pz = z - z0, bx = x1 - x0, bz = z1 - z0, t = Math.max(0, Math.min(1, (px * bx + pz * bz) / (bx * bx + bz * bz)));
      return w - Math.hypot(px - bx * t, pz - bz * t) + fbm(x / 14, z / 14, 99) * 1.6; };
    const at2 = (x, z) => { let L = -1e9, I = null; for (const J of ISL) { const d = dIsl(J, x, z); if (d > L) { L = d; I = J; } }
      let bar = -1e9; for (const b of BARS) bar = Math.max(bar, dBar(b, x, z));
      let y, t, cl = 0;                                                                                  // t: 0 water, 1 sand, 2 green
      if (L < 0) { y = L > -6.7 ? 0.9 + L * 0.12 : 0.1 + Math.max(L + 6.7, -50) * 0.06; t = 0; }   // the beach slopes on under the water: a smooth waterline
      else { const dx = x - I.x, dz = z - I.z; cl = I.kind === 'hill' || I.kind === 'big' ? sst(((dx * I.sx + dz * I.sz) / I.b - 0.25) / 0.6) : 0;   // 0 sheltered .. 1 open-sea side
        const sw = I.kind === 'cay' ? 1e9 : 14 - 11 * cl;
        if (L < sw) { y = 0.9 + 0.5 * Math.min(1, L / Math.min(sw, 12)); t = 1; }
        else { const k = L - sw, big = I.kind === 'big', ramp = (big ? 75 : I.b * 0.85) * (1 - cl) + 13 * cl;   // open-sea side: the land rises in ~13 m = a rock cliff
          y = 1.4 + I.H * sst(k / ramp) * (big ? 0.65 + 0.7 * (fbm(x / 120, z / 120, I.s + 21) * 0.5 + 0.5) : 1)
            + (big ? I.H * 0.7 * Math.max(0, fbm(x / 140, z / 140, I.s + 33)) * sst(k / 90) : 0) + fbm(x / 30, z / 30, I.s + 9) * 0.7 * Math.min(1, k / 8); t = 2; } }
      const yb = bar < 0 ? 0.78 + Math.max(bar, -8) * 0.12 : 0.78 + Math.min(0.32, bar * 0.07); if (yb > y) { y = yb; t = bar < 0 ? 0 : 1; L = Math.max(L, bar); }
      return { y, t, L: Math.max(L, bar), I, cl }; };
    const stackD = (x, z) => { let d = -1e9; for (const [sx, sz, sr] of STACKS) d = Math.max(d, (sr - Math.hypot(x - sx, z - sz)) * 3.3); return d; };   // stacks: a small pale ring
    const mainD = (x, z) => { const k = 50, a = 300 - Math.hypot(x, z * 1.25), b = Math.hypot(x, z - 270) - 205, hh = Math.max(k - Math.abs(a - b), 0) / k;   // Introvert Island's outline (as introvertIsland5)
      return Math.min(a, b) - hh * hh * k / 4 + 5 * Math.sin(x * 0.021 + 0.4) * Math.cos(z * 0.017) + 3 * Math.sin(x * 0.05 + z * 0.04); };
    return { ISL, BARS, STACKS, at2, dIsl, stackD, mainD, fbm, sst, smin };
  }
  function isletHarbours(Wd) { const { ISL, at2 } = Wd; ISL.forEach(I => { if (!I.vil) return; const [vx, vz] = I.vil[0], dl = Math.hypot(vx, vz), ux = -vx / dl, uz = -vz / dl; let lx = vx, lz = vz;
      for (let t = 0; t < 400; t += 1) { lx = vx + ux * t; lz = vz + uz * t; if (at2(lx, lz).L < -1) break; } I.jt = { x: lx, z: lz, ux, uz }; }); }
  // Cottage spots (slow: thousands of tries). Run tools/island_spots.js after ANY change to the island shapes; the map reads ISLET_SPOTS.
  function isletSpots(Wd) { Wd = Wd || isletWorld(); isletHarbours(Wd); const { ISL, at2, dIsl, sst } = Wd, spots = [];
    ISL.forEach((I, ii) => { if (!I.vil) return; const rh = rng(9001 + ii * 131), homes = [], HS = new Map(), hk = (x, z) => Math.floor(x / 30) * 100003 + Math.floor(z / 30);
      // the island's extent (coarse scan)
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let x = I.x - I.far; x < I.x + I.far; x += 12) for (let z = I.z - I.far; z < I.z + I.far; z += 12) if (dIsl(I, x, z) > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const JT = I.jt;
      const dmin = (x, z) => { let dv = 1e9; for (const [ax, az] of I.vil) dv = Math.min(dv, Math.hypot(x - ax, z - az)); return 12.5 + 7.5 * sst(dv / 170); };   // 12.5 m apart in a village, ~20 m out in the woods
      const free = (x, z, m) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = HS.get(hk(x + i * 30, z + j * 30)); if (L && L.some(p => Math.hypot(p.x - x, p.z - z) < m)) return false; } return true; };
      const tries = I.kind === 'big' ? 320000 : 30000;
      for (let t = 0; t < tries; t++) { const x = x0 + rh() * (x1 - x0), z = z0 + rh() * (z1 - z0), P = at2(x, z); if (P.I !== I || P.t !== 2 || P.cl > 0.55 || P.L < 14 - 11 * P.cl + 8) continue;
        if (Math.hypot(x - JT.x, z - JT.z) < 22) continue;
        const gx = (at2(x + 3, z).y - at2(x - 3, z).y) / 6, gz = (at2(x, z + 3).y - at2(x, z - 3).y) / 6; if (Math.max(Math.abs(gx), Math.abs(gz)) > 0.16) continue;
        const m = dmin(x, z); if (!free(x, z, m)) continue;
        let ry = Math.hypot(gx, gz) > 0.03 ? Math.atan2(-gx, -gz) : Math.atan2(JT.x - x, JT.z - z); ry += (rh() - 0.5) * 0.6;   // faces downhill (the view), or toward the harbour
        const p = { x, z, y: P.y + 0.1, ry, isl: ii }; homes.push(p); const k = hk(x, z); if (!HS.has(k)) HS.set(k, []); HS.get(k).push(p); }
      homes.sort((p, q) => Math.hypot(p.x - JT.x, p.z - JT.z) - Math.hypot(q.x - JT.x, q.z - JT.z));
      homes.forEach((p, k) => { const n = spots.length; p.type = n % 5 === 2 ? 'a' : n % 5 === 4 ? 'c' : 'l'; const fwd = p.type === 'a' ? 8 : p.type === 'c' ? 6.5 : 7;
        p.door = { x: p.x + Math.sin(p.ry) * fwd, z: p.z + Math.cos(p.ry) * fwd }; spots.push(p); }); });
    return spots.map(p => [Math.round(p.x * 10), Math.round(p.z * 10), Math.round(p.ry * 100), p.isl]);
  }
  const ISLET_SPOTS = { n: 1112, d: [4603,706,-246,0,4697,428,-114,0,4639,270,-111,0,4535,896,-126,0,4453,81,-97,0,4765,561,-178,0,4755,704,-243,0,4757,167,-150,0,4324,-102,-150,0,4760,893,123,0,4604,1044,-108,0,4888,424,-74,0,4634,-4,-278,0,4484,-112,-324,0,4919,755,73,0,4788,1048,96,0,4405,-243,-250,0,5037,518,-166,0,4245,-282,-207,0,4754,-137,-207,0,4581,-275,177,0,4479,-438,-304,0,-3096,2935,287,1,-3016,3082,205,1,-3186,3024,-322,1,-2894,3134,-307,1,-3360,2953,233,1,-3182,3165,197,1,-3023,3268,91,1,-3461,2876,299,1,-3397,3094,298,1,-3169,3298,3,1,-3508,3014,-283,1,-3099,3429,-20,1,-3618,2862,-292,1,-3301,3358,-65,1,-3457,3251,-51,1,-3656,3006,-101,1,-3591,3215,-32,1,-7562,-799,268,2,-7706,-1276,129,2,-7749,-1143,166,2,-7728,-972,169,2,-7647,-1440,149,2,-7825,-1318,56,2,-7603,-1616,79,2,-7749,-762,-314,2,-7439,-564,326,2,-7875,-1020,120,2,-7648,-647,231,2,-7815,-1446,143,2,-7845,-859,231,2,-7179,-522,-320,2,-7731,-1570,86,2,-7952,-1122,163,2,-7939,-1262,187,2,-7507,-1763,148,2,-7329,-448,-308,2,-7580,-479,199,2,-7819,-626,199,2,-7988,-867,189,2,-7750,-1728,155,2,-8013,-1373,80,2,-7940,-727,234,2,-7381,-1896,183,2,-7132,-362,252,2,-8098,-1175,188,2,-7889,-1673,131,2,-8088,-977,79,2,-8002,-1526,187,2,-7683,-1878,168,2,-8083,-728,208,2,-7819,-392,172,2,-7541,-2009,121,2,-7889,-1836,-59,2,-8018,-546,271,2,-8224,-1069,146,2,-8187,-1415,171,2,-6952,-251,279,2,-8130,-1606,238,2,-7574,-190,258,2,-8049,-1764,-273,2,-7125,-140,239,2,-7791,-2006,150,2,-7373,-121,178,2,-8306,-1240,150,2,-7345,-2146,35,2,-8286,-818,120,2,-8198,-609,181,2,-8367,-988,88,2,-7963,-1994,40,2,-8349,-1527,107,2,-6828,-100,186,2,-7788,-103,-218,2,-7980,-220,184,2,-7487,-2266,172,2,-8126,-328,206,2,-8363,-674,203,2,-7893,-2147,32,2,-7669,-2266,242,2,-8491,-1251,116,2,-8134,-1995,73,2,-7424,73,241,2,-8299,-444,234,2,-8478,-1435,27,2,-7319,-2381,205,2,-8550,-1064,161,2,-6929,91,126,2,-8334,-1899,67,2,-8549,-779,209,2,-7761,90,-78,2,-7204,173,-316,2,-8514,-1612,-154,2,-8443,-1770,-39,2,-7948,20,-152,2,-7871,-2329,213,2,-8216,-166,28,2,-8039,-2251,85,2,-8495,-491,246,2,-7496,-2491,203,2,-8652,-1408,138,2,-7604,223,-283,2,-8693,-1156,-46,2,-7727,-2480,-61,2,-8633,-610,126,2,-8493,-305,-78,2,-8198,28,258,2,-8675,-1645,-34,2,-6826,276,106,2,-7050,340,129,2,-8786,-1298,-107,2,-8773,-818,203,2,-8013,-2461,218,2,-8549,-1981,303,2,-7994,217,294,2,-8362,-2222,-299,2,-8189,-2387,-190,2,-8674,-1836,-7,2,-8858,-1001,-306,2,-7439,445,275,2,-7656,410,305,2,-8703,-369,138,2,-7856,371,286,2,-8492,-56,174,2,-8825,-611,170,2,-8645,-210,242,2,-8324,145,250,2,-7230,529,157,2,-7567,-2769,188,2,-7814,-2720,281,2,-6858,489,184,2,-8932,-1509,117,2,-8880,-1706,13,2,-8111,-2613,56,2,-8669,-2129,228,2,-8963,-792,195,2,-8208,317,271,2,-9012,-1282,-14,2,-8800,-1977,286,2,-8875,-429,225,2,-7984,-2715,308,2,-8064,426,264,2,-8495,-2408,72,2,-8296,-2575,-160,2,-8678,-40,198,2,-8546,116,238,2,-7604,618,269,2,-8830,-189,165,2,-9090,-939,112,2,-7940,558,284,2,-8663,-2314,219,2,-7153,700,139,2,-8468,282,264,2,-7630,-2942,257,2,-9073,-632,195,2,-8212,-2734,279,2,-8989,-1896,139,2,-6793,675,169,2,-7908,-2905,301,2,-9123,-1585,77,2,-9053,-427,-289,2,-7366,770,151,2,-8770,76,153,2,-8870,-2210,127,2,-8988,-226,227,2,-8206,561,213,2,-8445,-2675,66,2,-7741,754,286,2,-8427,444,251,2,-8635,-2543,91,2,-7780,-3025,243,2,-9236,-1415,-22,2,-9258,-1201,-178,2,-8947,-57,227,2,-8637,327,244,2,-9170,-1776,130,2,-8095,704,277,2,-8825,-2426,286,2,-7526,863,-11,2,-7916,792,-263,2,-7072,878,93,2,-8195,-2940,189,2,-8773,252,44,2,-9049,-2147,-217,2,-9309,-833,195,2,-8406,-2858,217,2,-6816,870,84,2,-9177,-299,178,2,-7280,929,93,2,-9286,-594,177,2,-8040,-3056,246,2,-8546,-2795,48,2,-8335,687,-20,2,-7920,-3151,-327,2,-8533,592,281,2,-9010,122,242,2,-9307,-419,197,2,-8838,-2604,275,2,-7828,938,304,2,-9360,-1673,104,2,-8668,510,244,2,-9285,-1938,125,2,-9181,-94,200,2,-8349,-3008,121,2,-8875,341,246,2,-8739,-2745,-218,2,-8071,893,265,2,-8231,-3090,214,2,-9467,-1227,181,2,-8978,-2512,73,2,-6914,1025,-283,2,-7474,1053,105,2,-7683,1026,102,2,-9148,-2322,128,2,-8114,-3178,268,2,-9493,-909,181,2,-9481,-1490,38,2,-7083,1080,151,2,-7317,1097,95,2,-8635,-2928,-189,2,-8487,773,239,2,-8502,-3023,-264,2,-9213,53,222,2,-8862,490,-243,2,-9318,-2135,139,2,-9380,-230,115,2,-8775,595,-266,2,-8310,914,297,2,-8369,-3143,225,2,-7938,1068,-216,2,-9164,196,198,2,-8778,-2883,-143,2,-8630,739,132,2,-9029,379,-29,2,-9486,-386,188,2,-9551,-586,188,2,-7613,1170,135,2,-9149,-2537,267,2,-9347,-18,233,2,-8123,-3322,227,2,-7788,1161,57,2,-9518,-1906,-208,2,-8988,509,254,2,-8996,-2761,-308,2,-8635,-3072,-254,2,-8514,-3169,-309,2,-7097,1247,54,2,-7367,1258,84,2,-9297,-2454,126,2,-8330,-3299,304,2,-8831,720,274,2,-8766,-3035,88,2,-8924,-2902,-199,2,-9216,341,293,2,-8622,894,233,2,-9305,229,90,2,-9531,-161,129,2,-8516,995,278,2,-9464,-2272,123,2,-9152,-2732,198,2,-8976,664,-306,2,-9118,540,118,2,-8081,-3475,225,2,-8485,-3307,335,2,-8179,1196,249,2,-7551,1349,184,2,-7708,1347,120,2,-7933,1300,119,2,-8640,-3253,-284,2,-7231,1385,102,2,-9522,48,183,2,-9235,493,210,2,-8792,-3172,305,2,-9355,-2619,-327,2,-7362,1421,168,2,-8766,955,262,2,-9093,-2949,-224,2,-8213,-3524,309,2,-9430,305,208,2,-9350,418,208,2,-8985,811,239,2,-8434,1186,293,2,-8392,-3473,314,2,-9550,198,189,2,-9151,735,130,2,-8918,941,188,2,-8959,-3170,290,2,-7117,1501,198,2,-8688,1113,289,2,-8092,1389,112,2,-9529,-2544,-227,2,-8781,-3320,-309,2,-7654,1494,193,2,-8286,1344,289,2,-8598,-3462,234,2,-9290,-2907,-276,2,-9122,-3096,-238,2,-7336,1555,257,2,-9273,689,239,2,-7483,1552,219,2,-7929,1483,182,2,-8846,1110,-79,2,-9465,-2783,-317,2,-8588,1273,279,2,-9447,561,197,2,-7776,1565,316,2,-8461,-3608,227,2,-8304,-3686,63,2,-9544,459,240,2,-8935,-3347,-267,2,-9186,899,29,2,-9061,1016,-85,2,-9282,-3077,-183,2,-9404,699,-234,2,-8797,-3485,-256,2,-7623,1653,44,2,-9128,-3261,-269,2,-9323,819,-236,2,-6891,1656,226,2,-8426,1480,288,2,-8217,1573,165,2,-8641,-3653,248,2,-7320,1736,282,2,-7117,1737,-304,2,-8009,1653,139,2,-8867,1277,-174,2,-7768,1708,-12,2,-9530,-2954,-250,2,-9547,687,253,2,-9092,-3399,-207,2,-8409,-3804,108,2,-9073,1161,-90,2,-7523,1763,-195,2,-8792,-3618,-272,2,-8690,1434,-115,2,-9455,845,254,2,-8556,-3782,175,2,-9460,-3124,-44,2,-6789,1778,282,2,-8955,-3582,-305,2,-9354,-3265,288,2,-8370,1641,-12,2,-9300,1065,46,2,-7206,1842,-333,2,-7393,1845,-133,2,-7872,1804,60,2,-8169,1731,284,2,-9275,-3416,-208,2,-9227,1202,263,2,-8803,-3768,-324,2,-7711,1882,0,2,-7573,1900,-80,2,-8855,1493,-104,2,-6972,1912,263,2,-8037,1844,66,2,-9516,990,221,2,-9188,-3555,-87,2,-7317,1952,-184,2,-8722,1609,-51,2,-6661,1893,195,2,-7446,1966,-120,2,-8722,-3888,320,2,-8341,1804,286,2,-7097,1978,-318,2,-9058,-3699,-333,2,-9133,1386,-53,2,-9540,-3305,-172,2,-8951,-3803,-280,2,-7660,2007,-122,2,-7863,1993,95,2,-9487,1176,215,2,-8572,1800,-65,2,-6907,2061,173,2,-9441,-3526,-248,2,-7547,2083,-147,2,-7344,2092,-124,2,-9031,1586,-17,2,-9389,1322,73,2,-9270,-3682,-261,2,-8083,2012,96,2,-7165,2108,-310,2,-8254,1969,14,2,-6567,2049,186,2,-8873,-3985,-264,2,-7762,2101,52,2,-9106,-3851,-286,2,-7040,2191,-283,2,-8767,1882,-119,2,-7270,2226,-77,2,-8977,1782,-91,2,-7534,2225,-181,2,-8540,1995,263,2,-9037,-4008,32,2,-6870,2219,142,2,-9418,-3763,-121,2,-9270,-3893,309,2,-8348,2104,35,2,-9161,1714,-88,2,-9323,1601,47,2,-9550,1420,208,2,-7921,2240,-56,2,-6503,2238,225,2,-8165,2222,59,2,-6713,2290,182,2,-7398,2363,-65,2,-7690,2347,-97,2,-7231,2396,-19,2,-9529,1602,27,2,-8756,2088,-151,2,-6884,2381,33,2,-7849,2375,-133,2,-9157,1931,-139,2,-8581,2215,-76,2,-7061,2472,-10,2,-8323,2331,0,2,-9436,1808,63,2,-7472,2520,-7,2,-9029,2092,-83,2,-6581,2470,183,2,-8132,2461,66,2,-7898,2518,271,2,-7675,2570,-112,2,-7251,2602,-20,2,-8908,2252,-121,2,-6777,2618,86,2,-8531,2446,-53,2,-7083,2650,-24,2,-9344,2063,286,2,-8322,2523,285,2,-7905,2701,315,2,-7464,2746,52,2,-8725,2485,-148,2,-7648,2751,16,2,-7257,2775,-22,2,-6956,2762,-27,2,-6636,2750,63,2,-8481,2626,260,2,-6922,2970,-71,2,-6730,3064,-299,2,-960,-6546,-286,3,-793,-6533,70,3,-885,-6668,-69,3,-1067,-6741,-46,3,-689,-6692,56,3,-536,-6674,-63,3,-1167,-6848,-65,3,-759,-6856,125,3,-903,-6899,-199,3,-1046,-6903,-62,3,-332,-6550,-74,3,-1375,-6860,83,3,-188,-6439,-110,3,-797,-7032,-41,3,-1557,-6815,135,3,-974,-7069,10,3,-1262,-7023,-52,3,-1133,-7062,93,3,-1708,-6691,21,3,-392,-6879,-93,3,-93,-6198,-136,3,-1510,-7010,55,3,-1381,-7088,-19,3,-140,-6679,-89,3,-542,-7089,-6,3,-725,-7162,-116,3,-1084,-7199,64,3,-1280,-7172,-78,3,-932,-7239,29,3,-1920,-6591,32,3,-1762,-6870,-1,3,-386,-7065,-68,3,23,-6502,11,3,-1874,-6748,69,3,-1187,-7286,-133,3,-135,-6904,-36,3,68,-5936,6,3,-1483,-7220,15,3,-794,-7334,-273,3,-506,-7245,-36,3,-921,-7392,-306,3,-1806,-7041,133,3,-1655,-7174,-42,3,-297,-7217,-112,3,230,-6222,-48,3,-665,-7405,-232,3,-1097,-7444,246,3,131,-6746,-56,3,-2189,-6329,53,3,-2110,-6685,107,3,55,-6936,-45,3,-106,-7134,-101,3,-1611,-7315,-257,3,-812,-7491,-224,3,144,-5646,-168,3,-1477,-7415,-339,3,-1306,-7485,-318,3,-546,-7495,-227,3,298,-6624,-131,3,-1771,-7306,-221,3,-2100,-6953,-61,3,-2326,-6168,111,3,-164,-7330,-266,3,-1616,-7466,54,3,-2019,-7147,67,3,363,-5877,208,3,-871,-7638,-27,3,-1027,-7642,210,3,422,-6075,-226,3,232,-6974,159,3,-323,-7497,-156,3,-2350,-6602,-196,3,-1220,-7669,18,3,-2402,-5976,53,3,-1440,-7626,22,3,474,-6480,-63,3,20,-7321,270,3,-723,-7691,-7,3,146,-7208,157,3,-1772,-7508,32,3,346,-5529,81,3,-1917,-7409,74,3,-2350,-6900,-19,3,-1603,-7634,243,3,-932,-7776,-9,3,497,-6728,199,3,419,-6918,-115,3,-2523,-6402,99,3,512,-5713,22,3,-2484,-6764,-8,3,-2576,-6184,10,3,632,-6185,-79,3,-60,-7566,283,3,76,-7468,279,3,-1085,-7853,-276,3,-1249,-7837,25,3,308,-7239,118,3,-486,-7796,-141,3,-1408,-7812,208,3,-305,-7736,-61,3,-2114,-7430,-233,3,-666,-7866,-27,3,-1967,-7569,-60,3,-2342,-7185,-194,3,-1740,-7727,258,3,-2612,-5847,63,3,251,-7413,-51,3,-146,-7725,-297,3,680,-6633,288,3,466,-7152,251,3,610,-6879,103,3,-1572,-7847,238,3,-2546,-7002,-67,3,-2722,-6330,58,3,-2699,-6534,262,3,-2687,-6726,98,3,209,-7573,-229,3,808,-6314,-312,3,-785,-8021,-123,3,457,-7323,130,3,-959,-8036,-105,3,17,-7742,-6,3,-1325,-8019,324,3,-222,-7895,-43,3,-2789,-6094,-5,3,-1732,-7897,50,3,-2356,-7429,-273,3,-519,-8011,-73,3,-1157,-8067,15,3,-2527,-7223,159,3,-2032,-7769,-286,3,825,-5724,-6,3,374,-7544,-100,3,-1590,-8017,172,3,752,-6989,-138,3,-2273,-7632,105,3,245,-7717,-97,3,-75,-7945,44,3,151,-7821,-46,3,-2892,-6542,75,3,-2912,-6368,-23,3,933,-6661,-14,3,-2841,-6820,90,3,-2894,-5824,-5,3,712,-7251,-138,3,-239,-8065,-239,3,982,-6466,-249,3,1006,-6208,86,3,-391,-8152,-148,3,-591,-8204,-318,3,-2606,-7400,170,3,577,-7508,-72,3,-2753,-7164,94,3,947,-6856,-222,3,-2995,-6176,35,3,-2851,-6992,278,3,446,-7683,-51,3,-2056,-7973,263,3,-1083,-8281,-47,3,-2525,-7574,203,3,-868,-8283,-210,3,356,-7804,48,3,152,-7962,9,3,871,-7155,-111,3,-2241,-7882,45,3,-2998,-6692,254,3,-3033,-5982,-79,3,-1430,-8277,23,3,774,-7398,29,3,-76,-8143,-47,3,-1625,-8259,26,3,1006,-7024,-206,3,666,-7612,341,3,1099,-5679,66,3,-1898,-8181,61,3,90,-8115,-149,3,-3124,-6425,0,3,-2803,-7394,73,3,-333,-8317,-150,3,-2898,-7259,29,3,400,-7937,166,3,-3029,-6989,86,3,-1241,-8421,-178,3,-3169,-6114,-36,3,-623,-8411,-166,3,540,-7837,72,3,-3147,-6632,32,3,802,-7572,-229,3,1188,-6777,-160,3,-2503,-7871,290,3,988,-7317,-51,3,917,-7450,-76,3,1248,-5849,112,3,1276,-6433,84,3,328,-8085,83,3,-158,-8359,22,3,-3150,-6888,145,3,692,-7785,-78,3,1104,-7174,-186,3,-2377,-8043,-217,3,1191,-6990,-176,3,-3079,-7147,144,3,-3250,-5945,-78,3,-2754,-7693,253,3,-1776,-8394,20,3,-792,-8533,213,3,-2870,-7550,-294,3,-2170,-8211,-297,3,188,-8233,-49,3,473,-8044,148,3,-3284,-6462,-112,3,-3266,-6767,98,3,-1120,-8590,186,3,957,-7590,261,3,-1423,-8561,-290,3,679,-7948,-54,3,1404,-6258,38,3,885,-7727,-69,3,69,-8381,-82,3,-3369,-6323,44,3,1362,-5684,87,3,-340,-8556,-186,3,-559,-8606,-201,3,-2072,-8386,-147,3,-3384,-6098,11,3,-1622,-8570,54,3,316,-8290,-38,3,1155,-7399,130,3,-3159,-7302,133,3,1281,-7150,-248,3,-3092,-7452,261,3,-3290,-7016,226,3,1384,-6925,-247,3,530,-8193,80,3,672,-8089,218,3,-2349,-8302,76,3,-3372,-6872,-30,3,-2524,-8177,-6,3,1465,-6727,-59,3,1105,-7611,-134,3,-2782,-7961,73,3,1501,-5840,26,3,-3443,-6675,35,3,-765,-8743,179,3,41,-8544,-21,3,804,-8026,-54,3,911,-7915,-278,3,-2922,-7855,289,3,1548,-6509,85,3,-3328,-7189,177,3,-3057,-7690,285,3,-1990,-8571,306,3,-966,-8786,238,3,-3530,-6237,55,3,494,-8341,82,3,217,-8510,-290,3,-1178,-8800,314,3,-3427,-7011,27,3,676,-8221,113,3,1381,-7299,256,3,-114,-8680,-205,3,-3201,-7565,202,3,1102,-7796,-101,3,-1388,-8803,-243,3,-3334,-7326,240,3,-3567,-6021,2,3,797,-8159,-103,3,376,-8484,216,3,-1775,-8733,327,3,1331,-7523,87,3,1044,-7948,-100,3,-3552,-6856,58,3,-568,-8863,-105,3,-3625,-6422,-13,3,-2356,-8518,321,3,-310,-8822,-182,3,-2557,-8391,-204,3,969,-8075,-220,3,-3342,-7490,144,3,1659,-6737,52,3,677,-8356,126,3,-3636,-6622,-52,3,1721,-6298,93,3,50,-8737,-317,3,-3015,-8005,-209,3,-2880,-8151,-216,3,-3506,-7183,284,3,-3239,-7732,268,3,535,-8496,-69,3,-3569,-7044,-3,3,-3467,-7320,142,3,1708,-5792,-15,3,1733,-6557,99,3,1569,-7233,326,3,-3163,-7881,-327,3,924,-8212,-86,3,300,-8663,216,3,1284,-7788,-82,3,-3716,-6246,-41,3,-2139,-8730,303,3,-1957,-8816,-212,3,-2766,-8338,-221,3,1791,-6031,58,3,-1299,-8994,30,3,838,-8347,-111,3,-830,-9018,300,3,-3702,-6789,-167,3,454,-8647,262,3,-1569,-8977,222,3,1511,-7535,204,3,1730,-6978,203,3,-1786,-8936,-144,3,-3712,-6946,-61,3,774,-8479,-92,3,-3812,-6069,-35,3,-281,-9009,-171,3,-3390,-7765,194,3,-3569,-7436,121,3,-13,-8939,-301,3,1299,-7992,39,3,663,-8600,151,3,-3495,-7617,253,3,1149,-8178,-173,3,-3724,-7088,-105,3,1910,-6237,139,3,-550,-9107,-71,3,-1059,-9138,-26,3,-2572,-8673,320,3,-3840,-6778,-231,3,-3709,-7263,123,3,-2345,-8821,-238,3,421,-8823,252,3,1071,-8375,289,3,267,-8923,249,3,1910,-6901,75,3,1562,-7766,-98,3,1954,-5798,72,3,570,-8768,-316,3,-3938,-6224,-70,3,-2188,-8954,-200,3,-1478,-9170,-175,3,-3714,-7416,137,3,1803,-7359,89,3,-3553,-7771,279,3,898,-8584,-86,3,-3352,-8069,250,3,-3189,-8268,-306,3,-1727,-9151,-268,3,-3896,-6957,-61,3,1902,-7125,305,3,-3864,-7083,-56,3,1484,-7982,149,3,-3477,-7917,292,3,-2813,-8628,-118,3,1759,-7542,-135,3,2049,-6048,95,3,-3984,-6684,-26,3,-3703,-7600,296,3,-268,-9211,-151,3,1340,-8234,-105,3,729,-8781,-158,3,-41,-9154,324,3,-3879,-7215,-6,3,-862,-9305,-30,3,-3009,-8543,-219,3,-3845,-7343,86,3,2102,-6313,104,3,-2075,-9127,272,3,-4065,-6343,-60,3,1261,-8386,-302,3,-472,-9304,-254,3,2093,-6734,54,3,2130,-6484,153,3,-3820,-7512,237,3,194,-9132,-274,3,-1059,-9359,-22,3,-2422,-9006,140,3,1053,-8617,187,3,2061,-6987,56,3,901,-8748,-49,3,-2745,-8830,-192,3,1783,-7764,114,3,1514,-8172,85,3,-1289,-9384,1,3,-4035,-7029,48,3,-3376,-8299,-214,3,-4102,-6791,28,3,-3632,-7992,285,3,1985,-7460,199,3,598,-9035,-74,3,-4040,-7185,43,3,-3988,-7367,-60,3,-1544,-9409,-247,3,-3745,-7883,296,3,-1757,-9371,-160,3,-3835,-7736,228,3,1935,-7642,103,3,-4202,-6475,-60,3,-3230,-8576,-275,3,402,-9183,-62,3,1289,-8582,-244,3,2282,-6348,108,3,-3921,-7625,302,3,1068,-8788,200,3,-2018,-9335,-147,3,2184,-7099,158,3,1804,-7974,220,3,2283,-6579,119,3,-4184,-6931,134,3,1538,-8355,167,3,2145,-7275,-278,3,927,-8925,255,3,-2694,-9089,266,3,-4179,-7150,-96,3,-2500,-9208,219,3,1987,-7820,-83,3,-3470,-8483,-293,3,-4131,-7377,-145,3,-3622,-8321,213,3,-3777,-8125,269,3,1781,-8197,-71,3,837,-9098,238,3,-3073,-8902,-117,3,-4363,-6409,-83,3,-4117,-7533,-198,3,-3937,-7916,-291,3,-2353,-9353,244,3,2128,-7665,-113,3,2302,-7236,193,3,-4044,-7763,-274,3,1377,-8750,-101,3,1717,-8397,127,3,1548,-8592,-85,3,1226,-8898,-213,3,-4355,-6930,-64,3,2273,-7455,-109,3,1960,-8096,-112,3,-4336,-7122,94,3,-4299,-7283,-84,3,-4253,-7456,128,3,-3947,-8121,-280,3,2454,-7059,70,3,2170,-7844,-46,3,2390,-7366,-264,3,-4206,-7705,-310,3,2293,-7635,-111,3,2451,-7230,-50,3,2578,-6645,30,3,1116,-9144,-58,3,-3020,-9189,-212,3,-3834,-8414,-302,3,2157,-8033,-123,3,2587,-6857,-69,3,-4104,-8046,-281,3,-4422,-7412,-145,3,-4478,-7233,115,3,2451,-7499,-290,3,-4218,-7909,-295,3,2059,-8310,-109,3,-4630,-6605,-85,3,1903,-8564,72,3,1575,-8923,-95,3,1719,-8784,182,3,-4349,-7777,-257,3,2356,-7893,-107,3,2466,-7719,-64,3,2739,-6749,20,3,1433,-9113,-251,3,2651,-7211,26,3,2714,-6939,87,3,-4473,-7651,-284,3,2627,-7394,-108,3,2557,-7597,10,3,2341,-8084,-191,3,-4583,-7421,-109,3,2254,-8263,-174,3,-4718,-7048,-93,3,-4798,-6683,-53,3,2833,-6872,23,3,-4174,-8397,282,3,2765,-7312,154,3,2548,-7911,-35,3,-4723,-7310,-167,3,1806,-8987,152,3,2748,-7457,-127,3,2709,-7586,-22,3,-4077,-8646,243,3,2665,-7726,-128,3,-4434,-8127,245,3,-4610,-7777,-271,3,-4539,-7956,-192,3,2254,-8531,218,3,2892,-7138,4,3,2974,-6715,-54,3,2107,-8762,203,3,-4710,-7620,-213,3,2892,-7270,48,3,2530,-8178,-272,3,2408,-8386,74,3,2974,-6928,-32,3,2709,-7894,-127,3,2880,-7490,-101,3,2649,-8054,-134,3,-4999,-6841,-26,3,2866,-7624,-143,3,-4356,-8550,232,3,3126,-6586,-11,3,3033,-7173,110,3,2989,-7354,125,3,-4791,-7811,-260,3,-4501,-8388,237,3,-4659,-8112,-179,3,2068,-9045,139,3,3124,-6833,11,3,-4920,-7500,-251,3,-4991,-7312,-124,3,2864,-7864,-124,3,-5093,-7086,-68,3,2295,-8909,-61,3,3219,-6735,-85,3,3111,-7306,42,3,2852,-8029,44,3,3168,-7092,-9,3,2468,-8715,-251,3,3226,-6935,-54,3,3090,-7548,143,3,-4872,-7997,-177,3,2651,-8539,-90,3,-4732,-8349,-231,3,3072,-7798,-99,3,2805,-8368,-124,3,2910,-8189,-113,3,3216,-7418,-26,3,3303,-7074,-24,3,-4576,-8694,271,3,-5065,-7792,-253,3,3387,-6656,45,3,-5288,-7081,-73,3,3375,-6938,-91,3,2487,-8967,-250,3,3060,-8026,-227,3,3349,-7281,25,3,2651,-8819,-74,3,3424,-7141,-49,3,3224,-7842,-118,3,-5307,-7454,-167,3,3356,-7478,-130,3,3495,-6829,24,3,-4977,-8313,-177,3,3303,-7685,-125,3,3095,-8213,-68,3,-5387,-7266,-222,3,3544,-6612,-55,3,-4902,-8517,-261,3,3026,-8405,-117,3,-4793,-8744,-311,3,-5150,-8160,-238,3,2913,-8695,-108,3,-5337,-7700,-120,3,3582,-7013,-16,3,-5291,-7948,-246,3,3466,-7612,-205,3,3676,-6428,-86,3,3651,-6822,-72,3,3547,-7401,15,3,3401,-7919,-87,3,3339,-8100,-38,3,2852,-8965,-157,3,3263,-8297,-114,3,3569,-7732,132,3,3803,-6618,-3,3,3815,-6894,-38,3,3684,-7556,-231,3,3750,-7301,-115,3,3864,-6439,73,3,3253,-8651,-139,3,3578,-7982,8,3,3139,-8894,-81,3,3461,-8325,-142,3,3575,-8168,-43,3,3963,-6730,4,3,3932,-7026,-91,3,3777,-7707,-127,3,3754,-7910,-114,3,3941,-7460,183,3,3984,-7273,122,3,4091,-6590,26,3,3424,-8791,-162,3,3586,-8546,-117,3,3785,-8117,90,3,3772,-8364,124,3,4030,-7676,112,3,4162,-7149,113,3,4012,-7907,-116,3,4240,-6941,86,3,4280,-6645,35,3,4207,-7340,131,3,3623,-8882,-131,3,4219,-7534,-262,3,3920,-8517,-100,3,4040,-8266,29,3,3860,-8709,32,3,4155,-8089,-116,3,4292,-7759,56,3,4441,-7490,125,3,4325,-7975,-150,3,4091,-8622,-249,3,4196,-8414,-2,3,4573,-7175,69,3,4605,-6975,88,3,4061,-8811,-81,3,4316,-8260,24,3,4271,-8567,27,3,4510,-7991,109,3,4600,-7789,126,3,4709,-7365,134,3,4410,-8417,65,3,4510,-8169,96,3,4288,-8736,-316,3,4712,-7610,45,3,4446,-8684,-85,3,4604,-8371,99,3,4719,-8050,1,3,4917,-7273,21,3,4895,-7515,72,3,4560,-8580,42,3,4694,-8245,176,3,4860,-7885,103,3,4620,-8761,-130,3,4867,-8125,85,3,4740,-8518,-5,3,5071,-7407,211,3,4822,-8354,124,3,4715,-8655,-38,3,5019,-7756,97,3,4983,-7991,71,3,4970,-8289,90,3,5048,-8148,88,3,5207,-7563,-160,3,4856,-8750,-114,3,4954,-8541,-12,3,5162,-8022,133,3,5225,-7858,161,3,5112,-8281,88,3,5061,-8462,109,3,4998,-8671,52,3,5402,-7731,188,3,5303,-8108,184,3,5201,-8739,-277,3,5385,-8346,27,3,5306,-8648,-63,3,5431,-8689,170,3,5687,-8519,93,3] };   // ISLET_SPOTS (written by tools/island_spots.js on 2026-11-24: 1112 spots)
  function islets(o = {}) {
    const fast = !!o.fast, g = new T.Group(), B = Batch(), TR = [], r = rng(o.seed || 4242), filled = Math.max(0, o.filled | 0);
    const Wd = isletWorld(), { ISL, BARS, STACKS, at2, stackD, mainD, fbm, sst } = Wd; isletHarbours(Wd);
    // the saved cottage spots (tools/island_spots.js); if they don't match the shapes any more, work them out here (slow)
    const raw = (typeof ISLET_SPOTS !== 'undefined' && ISLET_SPOTS.d.length) ? ISLET_SPOTS.d : [].concat(...isletSpots(Wd)), spots = [];
    for (let i = 0; i < raw.length; i += 4) { const x = raw[i] / 10, z = raw[i + 1] / 10, ry = raw[i + 2] / 100, isl = raw[i + 3], n = spots.length, type = n % 5 === 2 ? 'a' : n % 5 === 4 ? 'c' : 'l', fwd = type === 'a' ? 8 : type === 'c' ? 6.5 : 7;
      spots.push({ x, z, y: at2(x, z).y + 0.1, ry, isl, type, door: { x: x + Math.sin(ry) * fwd, z: z + Math.cos(ry) * fwd } }); }
    const mine = spots.slice(0, filled), PH = new Map(), pk = (x, z) => Math.floor(x / 20) * 100003 + Math.floor(z / 20);
    mine.forEach(p => { const k = pk(p.x, p.z); if (!PH.has(k)) PH.set(k, []); PH.get(k).push(p); });
    const pad = (x, z, y) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = PH.get(pk(x + i * 20, z + j * 20)); if (!L) continue;
        for (const p of L) { const q = Math.hypot(x - p.x, z - p.z); if (q < 10) { const kk = sst((q - 6) / 4); y = p.y + (y - p.y) * kk; } } } return y; };   // levelled pads under taken cottages
    const h = (x, z) => pad(x, z, at2(x, z).y);
    // ---- the ground: one grid over everything; only the cells near land are worked out (coarse pass first) ----
    const CELL = fast ? 6 : 4, SHELF = 46, CO = 20;
    let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
    ISL.forEach(I => { X0 = Math.min(X0, I.x - I.far); X1 = Math.max(X1, I.x + I.far); Z0 = Math.min(Z0, I.z - I.far); Z1 = Math.max(Z1, I.z + I.far); });
    STACKS.forEach(([x, z]) => { X0 = Math.min(X0, x - 70); X1 = Math.max(X1, x + 70); Z0 = Math.min(Z0, z - 70); Z1 = Math.max(Z1, z + 70); });
    X0 = Math.floor(X0 / CO) * CO; Z0 = Math.floor(Z0 / CO) * CO; const CX = Math.ceil((X1 - X0) / CO), CZ = Math.ceil((Z1 - Z0) / CO), near = new Uint8Array((CX + 1) * (CZ + 1));
    for (let j = 0; j <= CZ; j++) for (let i = 0; i <= CX; i++) { const x = X0 + i * CO, z = Z0 + j * CO; if (Math.max(at2(x, z).L, stackD(x, z)) > -SHELF - 4) near[j * (CX + 1) + i] = 1; }
    const NX = Math.ceil(CX * CO / CELL), NZ = Math.ceil(CZ * CO / CELL), id = (i, j) => j * (NX + 1) + i;
    const isNear = (x, z) => { const ci = Math.floor((x - X0) / CO), cj = Math.floor((z - Z0) / CO); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = ci + a, jj = cj + b; if (ii >= 0 && jj >= 0 && ii <= CX && jj <= CZ && near[jj * (CX + 1) + ii]) return true; } return false; };
    const GY = new Float32Array((NX + 1) * (NZ + 1)), GT = new Uint8Array(GY.length), GL = new Float32Array(GY.length).fill(-999), GS = new Float32Array(GY.length).fill(-999), GI = new Int8Array(GY.length).fill(-1), GC = new Float32Array(GY.length);
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = X0 + i * CELL, z = Z0 + j * CELL, k = id(i, j); if (!isNear(x, z)) { GY[k] = -2; continue; }
      const P = at2(x, z); GY[k] = filled ? pad(x, z, P.y) : P.y; GT[k] = P.t; GL[k] = P.L; GC[k] = P.cl; if (P.L > -3) GI[k] = ISL.indexOf(P.I); GS[k] = Math.max(P.L, stackD(x, z)) + fbm(x / 40, z / 40, 77) * 7; }
    // one indexed mesh from the grid: keep(q, i, j) picks the cells, yOf / colOf give each grid point its height and colour
    const mesh = (keep, yOf, colOf) => { const vm = new Int32Array(GY.length).fill(-1), pos = [], cc = [], idx = [];
      const vid = k => { if (vm[k] < 0) { vm[k] = pos.length / 3; const c = colOf(k); pos.push(X0 + (k % (NX + 1)) * CELL, yOf(k), Z0 + ((k / (NX + 1)) | 0) * CELL); cc.push(c.r, c.g, c.b); } return vm[k]; };
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const q = [id(i, j), id(i + 1, j), id(i, j + 1), id(i + 1, j + 1)]; if (!keep(q, i, j)) continue;
        const A = vid(q[0]), Bq = vid(q[1]), C = vid(q[2]), Dq = vid(q[3]); idx.push(A, C, Bq, Bq, C, Dq); }
      const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); G.setAttribute('color', new T.Float32BufferAttribute(cc, 3)); G.setIndex(idx); G.computeVertexNormals(); return G; };
    { const SAND = new T.Color('#f0dca6'), SAND2 = new T.Color('#e8cf92'), WET = new T.Color('#d9bf86'), GR = [new T.Color('#6f9a45'), new T.Color('#79a64c'), new T.Color('#668f40')], ROCK = new T.Color('#8f877b'), ROCK2 = new T.Color('#7d756a');
      const col = k => { const i = k % (NX + 1), j = (k / (NX + 1)) | 0;
        if (GT[k] === 0) return WET; if (GT[k] === 1) return (i + j) % 4 ? SAND : SAND2;
        const sl = Math.max(Math.abs(GY[id(Math.min(i + 1, NX), j)] - GY[id(Math.max(i - 1, 0), j)]), Math.abs(GY[id(i, Math.min(j + 1, NZ))] - GY[id(i, Math.max(j - 1, 0))])) / (2 * CELL);
        return sl > 0.42 ? ((i * 7 + j * 3) % 3 ? ROCK : ROCK2) : GR[(Math.floor(i * CELL / 8) * 7 + Math.floor(j * CELL / 8) * 3 & 7) % 3]; };
      const G = mesh((q) => Math.max(GL[q[0]], GL[q[1]], GL[q[2]], GL[q[3]]) >= -3, k => GY[k], col);
      const m = new T.Mesh(G, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.receiveShadow = true; g.add(m); }
    // ---- the shelf: pale turquoise at the sand, deeper turquoise, then the sea's own colour at the edge (no hard line) ----
    { const cA = new T.Color('#b8efe6'), cB = new T.Color('#62d0d8'), cC = new T.Color('#3fb2cc'), SEA = new T.Color('#3f9cc2'), tmp = new T.Color();
      const col = d => { const f = Math.max(0, -d) / SHELF; return f < 0.35 ? tmp.copy(cA).lerp(cB, f / 0.35) : f < 0.75 ? tmp.copy(cB).lerp(cC, (f - 0.35) / 0.4) : tmp.copy(cC).lerp(SEA, Math.min(1, (f - 0.75) / 0.25)); };
      const G = mesh((q, i, j) => !(Math.max(GS[q[0]], GS[q[1]], GS[q[2]], GS[q[3]]) < -SHELF || Math.min(GL[q[0]], GL[q[1]], GL[q[2]], GL[q[3]]) > 3) && mainD(X0 + (i + 0.5) * CELL, Z0 + (j + 0.5) * CELL) <= -60,   // none far out, none under dry land, none on Introvert Island's lagoon sheet
        () => 0.6, k => col(GS[k]));
      const m = new T.Mesh(G, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); m.receiveShadow = true; g.add(m); }
    // ---- rocks: sea stacks, boulders at the foot of the cliffs, a few on the ridges ----
    const DOD = new T.DodecahedronGeometry(1, 0), RC = ['#8f877b', '#7d756a', '#a39a8c'];
    STACKS.forEach(([x, z, R, Hh], si) => { const n = 3 + (si % 2);
      for (let k = 0; k < n; k++) { const a = r() * 6.28, d = k ? R * (0.35 + r() * 0.4) : 0, s = k ? R * (0.4 + r() * 0.25) : R * 0.7;
        B.add(DOD, RC[(si + k) % 3], null, x + Math.cos(a) * d, k ? 0.2 : Hh * 0.35, z + Math.sin(a) * d, s, k ? s * (0.8 + r() * 0.6) : Hh * 0.62, s * (0.8 + r() * 0.3), r() * 0.4, r() * 6, r() * 0.4); }
      if (Hh > 7) TR.push({ k: 'bush', x: x + 0.5, z: z - 0.4, y: Hh * 0.85, r: r() * 6, s: 0.8 + R * 0.04, c: si }); });
    const boulder = (x, z, s, c) => { B.add(DOD, RC[c % 3], null, x, h(x, z) - s * 0.35, z, s * (0.9 + r() * 0.4), s * (0.6 + r() * 0.4), s * (0.9 + r() * 0.4), r() * 0.5, r() * 6, r() * 0.5); };
    ISL.forEach((I, ii) => { if (I.kind === 'cay') return; const n = I.kind === 'big' ? 420 : I.kind === 'hill' ? 160 : 40, span = I.far - 70;
      for (let k = 0; k < n; k++) { const x = I.x + (r() * 2 - 1) * span, z = I.z + (r() * 2 - 1) * span, P = at2(x, z);
        if (P.I !== I || P.L < -2 || P.L > 6 || (I.kind === 'low' ? ((x - I.x) * I.sx + (z - I.z) * I.sz) / I.b < 0.5 : P.cl < 0.45)) continue; boulder(x, z, 1.2 + r() * 2.6, ii + k); } });
    // ---- the harbours (only on islands with cottages): a jetty from the beach out into the water ----
    const used = new Set(mine.map(p => p.isl));
    ISL.forEach((I, ii) => { if (!used.has(ii)) return; const J = I.jt, ry = Math.atan2(J.ux, J.uz), L = 26, base = at(J.x - J.ux * 8, 0, J.z - J.uz * 8, ry);
      box(B, '#b08055', base, 3, 0.25, L, 0, 1.3, L / 2); for (let z = 2; z <= L; z += 4) [-1.35, 1.35].forEach(x => box(B, '#7a5236', base, 0.3, 4.5, 0.3, x, -3, z));
      [[3.2, L * 0.65, 0.1], [-3.2, L * 0.85, -0.15]].forEach(([x, z, rr], kk) => { const bb = base.clone().multiply(at(x, 0, z, rr)); box(B, ['#f6f0e2', '#3f6fa8', '#c8603f'][(ii + kk) % 3], bb, 1.6, 0.8, 4.6, 0, 0.3, 0); box(B, '#b08055', bb, 1.4, 0.08, 4.2, 0, 1.05, 0); }); });
    // ---- cottages + sandy footpaths (shortest tree from each harbour to every taken cottage's door), like Introvert Island ----
    const PATHPTS = [];
    { const pos = [];
      ISL.forEach((I, ii) => { if (!used.has(ii)) return; const J = I.jt, nodes = [{ x: J.x - J.ux * 10, z: J.z - J.uz * 10 }].concat(mine.filter(p => p.isl === ii).map(p => p.door)), n = nodes.length;
        const inT = new Uint8Array(n), best = new Float64Array(n).fill(1e18), par = new Int32Array(n).fill(-1); best[0] = 0;
        for (let it = 0; it < n; it++) { let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i; inT[u] = 1;
          if (par[u] >= 0) { const A = nodes[par[u]], Bn = nodes[u], L = Math.hypot(Bn.x - A.x, Bn.z - A.z), nx = -(Bn.z - A.z) / (L || 1), nz = (Bn.x - A.x) / (L || 1), bend = (r() - 0.5) * L * 0.25;
            const cur = new T.QuadraticBezierCurve(new T.Vector2(A.x, A.z), new T.Vector2((A.x + Bn.x) / 2 + nx * bend, (A.z + Bn.z) / 2 + nz * bend), new T.Vector2(Bn.x, Bn.z)), pts = cur.getSpacedPoints(Math.max(2, Math.round(L / 2.5)));
            pts.forEach(p => PATHPTS.push(p));
            for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.y - p.y, l = Math.hypot(dx, dz) || 1, ox = -dz / l * 0.9, oz = dx / l * 0.9;
              const v = [[p.x + ox, p.y + oz], [p.x - ox, p.y - oz], [q.x + ox, q.y + oz], [q.x - ox, q.y - oz]].map(([x, z]) => [x, h(x, z) + 0.12, z]); pos.push(...v[0], ...v[2], ...v[1], ...v[1], ...v[2], ...v[3]); } }
          for (let v = 0; v < n; v++) if (!inT[v]) { const d = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z); if (d < best[v]) { best[v] = d; par[v] = u; } } } });
      if (pos.length) { const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); B.add(G, '#e3cf9c', null); } }
    mine.forEach(p => { const base = at(p.x, p.y, p.z, p.ry), b2 = at(p.x, p.y + 0.2, p.z, p.ry);
      if (p.type === 'c') { cottage(B, base, r, true); return; }
      box(B, '#a39a8c', base, p.type === 'a' ? 8 : 7.8, 1.2, p.type === 'a' ? 8.6 : 6.8, 0, -1.0, p.type === 'a' ? 0 : -0.2);
      if (p.type === 'a') aFrame(B, b2, r); else logCabin(B, b2, r, fast);
      box(B, '#a39a8c', base, 2.0, 0.12, 0.7, 0, 0, p.type === 'a' ? 6.75 : 5.55); });
    // ---- trees: palms along the beaches leaning out to sea, jungle inland (palms + bushy trees) with open meadows here and there,
    //      nothing on rock faces, gardens cleared round taken cottages, paths and jetties kept clear ----
    const PT = new Map(); PATHPTS.forEach(p => { const k = pk(p.x, p.y); if (!PT.has(k)) PT.set(k, []); PT.get(k).push(p); });
    const clear = (x, z) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const k = pk(x + i * 20, z + j * 20), L = PH.get(k), Q = PT.get(k);
        if (L && L.some(p => Math.hypot(p.x - x, p.z - z) < 9.5)) return true; if (Q && Q.some(p => Math.hypot(p.x - x, p.y - z) < 2.4)) return true; } return false; };
    ISL.forEach(I => { if (I.kind !== 'cay') return; const n = I.a > 18 ? 3 : 1; for (let k = 0; k < n; k++) { const a = r() * 6.28, d = r() * I.b * 0.4, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d;
        TR.push({ k: 'palm', x, z, y: at2(x, z).y - 0.3, r: r() * 6, s: 0.75 + r() * 0.3, c: (r() * 9) | 0, lx: (r() - 0.5) * 0.3, lz: (r() - 0.5) * 0.3 }); } });
    // the rest come straight off the ground grid (cheap): beach palms near every edge vertex, the jungle on every few inland vertices
    const gy = (x, z) => { const fi = (x - X0) / CELL, fj = (z - Z0) / CELL, i = Math.max(0, Math.min(NX - 1, Math.floor(fi))), j = Math.max(0, Math.min(NZ - 1, Math.floor(fj))), u = fi - i, v = fj - j;
      return GY[id(i, j)] * (1 - u) * (1 - v) + GY[id(i + 1, j)] * u * (1 - v) + GY[id(i, j + 1)] * (1 - u) * v + GY[id(i + 1, j + 1)] * u * v; };
    for (let j = 1; j < NZ; j++) for (let i = 1; i < NX; i++) { const k = id(i, j); if (GI[k] < 0 || GT[k] === 0) continue; const I = ISL[GI[k]]; if (I.kind === 'cay') continue;
      const L = GL[k], cl = GC[k], sw = 14 - 11 * cl, big = I.kind === 'big'; if (L < sw - 5) continue;
      const edge = L < sw + 6, S = Math.max(1, Math.round((big ? (fast ? 14 : 10) : (fast ? 7 : 5)) / CELL));
      if (edge ? r() > (fast ? 0.45 : 0.6) : (i % S || j % S)) continue;
      const sl = Math.max(Math.abs(GY[k + 1] - GY[k - 1]), Math.abs(GY[k + NX + 1] - GY[k - NX - 1])) / (2 * CELL); if (sl > 0.38) continue;   // bare rock
      const sp = edge ? CELL : CELL * S, tx = X0 + i * CELL + (r() - 0.5) * sp * 0.9, tz = Z0 + j * CELL + (r() - 0.5) * sp * 0.9;
      if (big && !edge && L > sw + 10 && fbm(tx / 75, tz / 75, I.s + 41) < -0.18) continue;                       // open meadows
      if (!edge && r() < (I.kind === 'hill' ? 0.18 : 0.25)) continue; if (filled && clear(tx, tz)) continue; const y = gy(tx, tz) - 0.3;
      if (edge || r() < (I.kind === 'low' ? 0.42 : 0.33)) { const out = Math.atan2(tx - I.x, tz - I.z);
        TR.push({ k: 'palm', x: tx, z: tz, y, r: r() * 6, s: 0.8 + r() * 0.45, c: (r() * 9) | 0, lx: edge ? Math.cos(out) * 0.18 : (r() - 0.5) * 0.12, lz: edge ? -Math.sin(out) * 0.18 : (r() - 0.5) * 0.12 }); }
      else TR.push({ k: 'bush', x: tx, z: tz, y, r: r() * 6, s: big ? (fast ? 1.9 : 1.6) + r() * 1.1 : 1.0 + r() * 0.9, c: (r() * 9) | 0 }); }
    B.build(g, !fast); jungle(g, TR, fast);
    g.userData.spots = spots.map(({ x, y, z, ry, type }) => ({ x, y, z, ry, type })); g.userData.islands = ISL; g.userData.treeCount = TR.length;
    g.userData.at = at2; g.userData.mainD = mainD; g.userData.shelfD = (x, z) => Math.max(at2(x, z).L, stackD(x, z)); g.userData.spotIsl = spots.map(p => p.isl);
    return g;
  }
  root.VinlandDistricts3 = { introvertIsland3, introvertIsland4, introvertIsland5, islets, isletWorld, isletSpots, napValley3, napValley4, cottage, logCabin, aFrame, CT };
})(window);
