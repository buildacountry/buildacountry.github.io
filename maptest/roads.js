/* Vinland roads (assets/roads.js)
   three.js r128. Load three.min.js first (and kit.js before this if you want the demo in the gallery).

   Lays a whole road network in one go and keeps it phone-light:
   - roads at ANY angle, plus bends (polylines) and roundabouts. Corners and bends become smooth curves (radius `curve`, 8 m)
   - roads that meet end to end (a turn) become one road, so the asphalt and both pavements go round the corner with no gap
   - junctions are found by itself: corners and T-joins are filled, centre dashes, lamps and pavements stop at junctions
   - zebra crossings next to each junction (optional), pavements with a kerb (optional)
   - everything is merged: 1 asphalt mesh, 1 pavement mesh, 1 island mesh, and InstancedMesh for dashes, zebra stripes
     and lamps (pole, arm, bulb). A big network is about 8 draw calls.
   Same look as the map's roads today: asphalt #45474d, 5 m wide, yellow dashes 2.1 m every 4.5 m, lamps every 26 m on
   alternating sides (same pole / arm / bulb shapes as roadDress() in the map).

   Use:
     const net = VinlandRoads.build({
       roads: [ { from: [-40, 0], to: [40, 0] },                  // straight, 5 m wide by default
                { from: [0, 0], to: [0, 40], width: 7 } ],        // T-join found by itself
       paths: [ { points: [[40, 0], [60, 10], [60, 40]] } ],      // a bending road
       roundabouts: [ { x: 0, z: -40, r: 9 } ]                    // roads that end inside it are cut at its edge
     }, { pavement: 1.6, crossings: true, lamps: true });
     scene.add(net.group);
     STREETLAMPS.push(...net.lamps);                                // bulb positions [x, y, z, ...] for the night glow
   VinlandRoads.fromMapBoxes(ROADS) turns the map's road boxes [w, d, x, z] into { roads: [...] }.

   Nothing here touches the map. Putting it on the map is a Builder job, only after Dev says OK. */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  if (!THREE) { console.error('VinlandRoads: load three.js r128 first'); return; }

  const DEF = {
    y: 0.14,                // top of the asphalt (the map's roads sit at 0.04 + 0.1)
    thick: 0.1,
    width: 5,
    asphalt: '#45474d', dash: '#f2c53d', zebra: '#f4f1e8', pavementColor: '#d9cfbd', kerb: '#bdb2a0', island: '#86ab5c',
    dashLen: 2.1, dashGap: 4.5, dashW: 0.26,
    pavement: 0,            // pavement width each side (0 = none, like the map today)
    crossings: true,        // zebra crossings next to junctions
    lamps: true, lampEvery: 26,
    minDashRoad: 14,        // short stubs get no dashes or lamps (same rule as the map)
    snap: 3.5,              // pull a road end onto a road it stops just short of (m); 0 = off
    curve: 8                // corners and bends become smooth curves with this radius (m); 0 = sharp corners
  };

  // the map's toon look (falls back to Lambert if no gradient wanted)
  const grad = new THREE.DataTexture(new Uint8Array([105, 165, 215]), 3, 1, THREE.LuminanceFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  const toon = (c, both) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, side: both ? THREE.DoubleSide : THREE.FrontSide });

  const V = (x, z) => ({ x, z });
  const sub = (a, b) => V(a.x - b.x, a.z - b.z), add = (a, b) => V(a.x + b.x, a.z + b.z), mul = (a, k) => V(a.x * k, a.z * k);
  const len = a => Math.hypot(a.x, a.z), dot = (a, b) => a.x * b.x + a.z * b.z, cross = (a, b) => a.x * b.z - a.z * b.x;
  const near = (a, b, e) => len(sub(a, b)) < (e || 0.5);

  // segment-segment meeting point (touching ends count). Returns { t, u, p } or null.
  function meet(A, B, C, D) {
    const r = sub(B, A), s = sub(D, C), den = cross(r, s), e = 0.5;
    if (Math.abs(den) < 1e-9) return null;                                // parallel
    const t = cross(sub(C, A), s) / den, u = cross(sub(C, A), r) / den, LA = len(r), LC = len(s);
    if (t < -e / LA || t > 1 + e / LA || u < -e / LC || u > 1 + e / LC) return null;
    return { t: Math.min(1, Math.max(0, t)), u: Math.min(1, Math.max(0, u)), p: add(A, mul(r, t)) };
  }

  // quad (top + 4 sides) from 4 corners, pushed into a position array
  function slab(pos, c, y0, y1, walls) {                                  // c = 4 corners in order, walls from y0 up to y1 (walls = which of the 4 edges get a wall)
    const P = (q, y) => [q.x, y, q.z], t = c.map(q => P(q, y1)), b = c.map(q => P(q, y0));
    pos.push(...t[0], ...t[2], ...t[1], ...t[0], ...t[3], ...t[2]);
    for (let i = 0; i < 4; i++) { if (walls && !walls[i]) continue; const j = (i + 1) % 4; pos.push(...b[i], ...b[j], ...t[j], ...b[i], ...t[j], ...t[i]); }
  }
  function disc(pos, c, r, y0, y1, n) { n = n || 12;                    // a round patch (fills the corner at a bend or an L-join)
    for (let i = 0; i < n; i++) { const a1 = i / n * Math.PI * 2, a2 = (i + 1) / n * Math.PI * 2, p = (rr, a) => V(c.x + Math.sin(a) * rr, c.z + Math.cos(a) * rr);
      slab(pos, [c, c, p(r, a2), p(r, a1)], y0, y1, [0, 0, 1, 0]); }
  }
  function meshFrom(pos, m) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const me = new THREE.Mesh(g, m); me.receiveShadow = true; me.frustumCulled = false; return me; }

  // round the inside corners of a line: each corner becomes a smooth curve (radius r, smaller if the road pieces are short)
  function roundCorners(pts, r) {
    if (!(r > 0) || pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const P = pts[i], A = pts[i - 1], C = pts[i + 1], u1 = sub(P, A), u2 = sub(C, P), l1 = len(u1), l2 = len(u2);
      const turn = Math.acos(Math.max(-1, Math.min(1, dot(u1, u2) / (l1 * l2))));
      if (turn < 0.09 || l1 < 0.5 || l2 < 0.5) { out.push(P); continue; }
      const d = Math.min(r * Math.tan(turn / 2), l1 * 0.45, l2 * 0.45), T1 = sub(P, mul(u1, d / l1)), T2 = add(P, mul(u2, d / l2)), n = Math.max(3, Math.ceil(turn / 0.2));
      for (let k = 0; k <= n; k++) { const t = k / n; out.push(add(add(mul(T1, (1 - t) * (1 - t)), mul(P, 2 * (1 - t) * t)), mul(T2, t * t))); }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // offset direction at a joint between two road pieces (a "miter"), so the road and pavements meet with no gap and no overlap
  function miter(n1, n2) { const m = add(n1, n2), l = len(m); if (l < 1e-6) return n1; const mm = mul(m, 1 / l); return mul(mm, Math.min(3, 1 / Math.max(0.2, dot(mm, n1)))); }

  function build(spec, options) {
    const o = Object.assign({}, DEF, options || {}), group = new THREE.Group(); group.name = 'vinlandRoads';
    // 1. lines: every road is a line of points (a straight road has 2)
    let lines = [];
    (spec.roads || []).forEach(r => lines.push({ pts: [V(r.from[0], r.from[1]), V(r.to[0], r.to[1])], w: r.width || o.width }));
    (spec.paths || []).forEach(p => lines.push({ pts: p.points.map(q => V(q[0], q[1])), w: p.width || o.width }));
    const rings = (spec.roundabouts || []).map(r => ({ c: V(r.x, r.z), r: r.r || 9, w: r.width || o.width }));
    const endOf = (l, k) => k === 'a' ? l.pts[0] : l.pts[l.pts.length - 1], setEnd = (l, k, q) => { if (k === 'a') l.pts[0] = q; else l.pts[l.pts.length - 1] = q; };
    const nextIn = (l, k) => k === 'a' ? l.pts[1] : l.pts[l.pts.length - 2];
    // 2. roundabouts: any part of a road inside one is cut away (a road drawn straight through it becomes two roads that meet its edge)
    rings.forEach(R => { const ro = R.r + R.w / 2 - 0.3, inside = q => len(sub(q, R.c)) < ro, out = [];
      lines.forEach(l => { let cur = null; const P = l.pts, push = () => { if (cur && cur.pts.length > 1) out.push(cur); cur = null; };
        if (!P.some(inside) && !P.some((q, i) => i && (() => { const d = sub(q, P[i - 1]), f = sub(P[i - 1], R.c), A2 = dot(d, d), B2 = 2 * dot(f, d), C2 = dot(f, f) - ro * ro, D = B2 * B2 - 4 * A2 * C2;
          if (D <= 0) return false; const t1 = (-B2 - Math.sqrt(D)) / (2 * A2), t2 = (-B2 + Math.sqrt(D)) / (2 * A2); return (t1 > 0 && t1 < 1) || (t2 > 0 && t2 < 1); })())) { out.push(l); return; }
        for (let i = 0; i < P.length; i++) {
          if (i) { const a0 = P[i - 1], d = sub(P[i], a0), f = sub(a0, R.c), A2 = dot(d, d), B2 = 2 * dot(f, d), C2 = dot(f, f) - ro * ro, D = B2 * B2 - 4 * A2 * C2;
            if (D > 0 && A2 > 1e-9) { const ts = [(-B2 - Math.sqrt(D)) / (2 * A2), (-B2 + Math.sqrt(D)) / (2 * A2)].filter(t => t > 1e-6 && t < 1 - 1e-6);
              ts.forEach(t => { const hit = add(a0, mul(d, t)); if (cur) { cur.pts.push(hit); cur.bRing = true; push(); } else { cur = { pts: [hit], w: l.w, aRing: true }; } }); } }
          if (!inside(P[i])) { if (!cur) cur = { pts: [], w: l.w, aRing: i === 0 ? l.aRing : true }; cur.pts.push(P[i]); if (i === P.length - 1) { cur.bRing = l.bRing; push(); } }
          else if (cur) push(); }
        push(); });
      lines = out; });
    // 3. snap: an end that stops just short of another road is carried straight on to it
    const allSegs = () => { const s = []; lines.forEach(l => { for (let i = 0; i + 1 < l.pts.length; i++) s.push({ l, a: l.pts[i], b: l.pts[i + 1] }); }); return s; };
    if (o.snap > 0) { const S = allSegs(); lines.forEach(l => ['a', 'b'].forEach(k => { if (l[k + 'Ring']) return; const q = endOf(l, k), dl = len(sub(q, nextIn(l, k))); if (dl < 1e-6) return;
      const dir = mul(sub(q, nextIn(l, k)), 1 / dl); let best = null;
      S.forEach(t => { if (t.l === l) return; const td = sub(t.b, t.a), tl = len(td), den = cross(dir, td); if (tl < 1e-6 || Math.abs(den) < 1e-6) return;
        const go = cross(sub(t.a, q), td) / den, at = cross(sub(t.a, q), dir) / den; if (go < 0.05 || go > o.snap || at < -o.snap / tl || at > 1 + o.snap / tl) return; if (best === null || go < best) best = go; });
      if (best !== null) setEnd(l, k, add(q, mul(dir, best))); })); }
    // 4. join roads that meet end to end (and nothing else there) into one line, so a turn is one continuous road
    const touches = (p, skip) => allSegs().some(t => { if (skip.includes(t.l)) return false; const td = sub(t.b, t.a), tl = len(td); if (tl < 1e-6) return false;
      const along = Math.max(0, Math.min(tl, dot(sub(p, t.a), td) / tl)); return len(sub(add(t.a, mul(td, along / tl)), p)) < Math.max(0.6, t.l.w / 2 - 0.1); });
    for (let changed = true; changed;) { changed = false;
      outer: for (let i = 0; i < lines.length; i++) for (let j = 0; j < lines.length; j++) { if (i === j) continue; const A = lines[i], C = lines[j];
        if (Math.abs(A.w - C.w) > 0.01) continue;
        for (let flip = 0; flip < 2; flip++) { if (flip) { A.pts.reverse(); [A.aRing, A.bRing] = [A.bRing, A.aRing]; }
        if (A.bRing) continue;
        const pa = endOf(A, 'b');
        for (const k of ['a', 'b']) { if (!near(pa, endOf(C, k))) continue; if (touches(pa, [A, C])) continue;
          const others = lines.filter(l => l !== A && l !== C && (near(endOf(l, 'a'), pa) || near(endOf(l, 'b'), pa))); if (others.length) continue;
          if ((k === 'a' && C.aRing) || (k === 'b' && C.bRing)) continue;
          const cp = k === 'a' ? C.pts : C.pts.slice().reverse(); A.pts = A.pts.concat(cp.slice(1)); A.bRing = k === 'a' ? C.bRing : C.aRing; lines.splice(j, 1); changed = true; break outer; } } } }
    // a road that comes back to where it started (like the map's ring) becomes a closed loop: start it half way along its first piece
    lines.forEach(l => { const p = l.pts; if (p.length > 3 && near(p[0], p[p.length - 1]) && !touches(p[0], [l])) { const mid = mul(add(p[0], p[1]), 0.5); l.pts = [mid].concat(p.slice(1, -1), [p[0], mid]); l.closed = true; } });
    // 5. curves at the corners
    lines.forEach(l => { l.pts = roundCorners(l.pts, o.curve); });
    // 6. pieces (segments) with their joints
    const segs = [];
    lines.forEach((l, li) => { const n = l.pts.length - 1; let run = 0;
      for (let i = 0; i < n; i++) { const a = l.pts[i], b = l.pts[i + 1], d = sub(b, a), L = len(d); if (L < 1e-4) continue;
        segs.push({ l, li, i, a, b, d, L, u: mul(d, 1 / L), w: l.w, first: i === 0, last: i === n - 1, aRing: i === 0 && l.aRing, bRing: i === n - 1 && l.bRing, start: run, stops: [] }); run += L; }
      l.length = run; });
    for (let i = 0; i < segs.length; i++) { const s = segs[i]; s.n = V(-s.u.z, s.u.x); }
    for (let i = 0; i < segs.length; i++) { const s = segs[i], p = segs[i - 1], q = segs[i + 1];
      s.m0 = !s.first && p && p.li === s.li ? miter(p.n, s.n) : s.n; s.m1 = !s.last && q && q.li === s.li ? miter(s.n, q.n) : s.n; }
    // 7. junctions: where pieces of different roads meet
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const A = segs[i], C = segs[j]; if (A.li === C.li) continue; const m = meet(A.a, A.b, C.a, C.b); if (!m) continue;
      const ang = Math.abs(cross(A.u, C.u)); if (ang < 0.05) continue;
      const sideOf = (S, T, tu) => tu < 0.6 / T.L && T.first ? Math.sign(dot(sub(T.b, m.p), S.n)) : tu > 1 - 0.6 / T.L && T.last ? Math.sign(dot(sub(T.a, m.p), S.n)) : 0;
      A.stops.push({ s: m.t * A.L, half: C.w / 2 / Math.max(0.35, ang), side: sideOf(A, C, m.u) });
      C.stops.push({ s: m.u * C.L, half: A.w / 2 / Math.max(0.35, ang), side: sideOf(C, A, m.t) });
      if (A.first && m.t * A.L < 0.6) A.endA = true; if (A.last && m.t * A.L > A.L - 0.6) A.endB = true;
      if (C.first && m.u * C.L < 0.6) C.endA = true; if (C.last && m.u * C.L > C.L - 0.6) C.endB = true;
    }
    // a junction near the end of a piece also blocks the neighbouring piece of the same road (short curve pieces)
    const lineStops = segs.map(() => []); segs.forEach(s => s.stops.forEach(st => segs.forEach((t, k) => { if (t.li === s.li) lineStops[k].push({ s: s.start + st.s - t.start, half: st.half, side: st.side }); })));
    segs.forEach((s, k) => { s.allStops = lineStops[k]; });
    const blocked = (s, x, pad, side) => s.allStops.some(st => (!side || !st.side || st.side === side) && Math.abs(x - st.s) < st.half + (pad || 0));

    const asphalt = [], pave = [], dashes = [], zebras = [], lamps = [], island = [], bushes = [];
    const yA = o.y, y0 = o.y - o.thick, yP = o.y + 0.12;
    segs.forEach(s => {
      const ea = s.first && s.endA && !s.aRing ? s.w / 2 : 0, eb = s.last && s.endB && !s.bRing ? s.w / 2 : 0, hw = s.w / 2;
      const A = sub(s.a, mul(s.u, ea)), Bp = add(s.b, mul(s.u, eb));
      slab(asphalt, [sub(A, mul(s.m0, hw)), add(A, mul(s.m0, hw)), add(Bp, mul(s.m1, hw)), sub(Bp, mul(s.m1, hw))], y0, yA, [s.first ? 1 : 0, 1, s.last ? 1 : 0, 1]);
      if (s.first && s.endA && !s.aRing) disc(asphalt, s.a, hw, y0, yA - 0.002); if (s.last && s.endB && !s.bRing) disc(asphalt, s.b, hw, y0, yA - 0.002);
      // pavements: follow the road round corners and curves, break only where another road comes in
      if (o.pavement > 0) [-1, 1].forEach(side => {
        const step = Math.min(1, s.L / 4), L = s.L; let x = 0;
        const corner = (xx, d) => xx <= 1e-6 ? add(s.a, mul(s.m0, side * d)) : xx >= L - 1e-6 ? add(s.b, mul(s.m1, side * d)) : add(add(s.a, mul(s.u, xx)), mul(s.n, side * d));
        while (x < L - 1e-6) { if (blocked(s, x + step / 2, o.pavement, side)) { x += step; continue; }
          let x2 = x; while (x2 < L - 1e-6 && !blocked(s, x2 + step / 2, o.pavement, side)) x2 += step; x2 = Math.min(L, x2);
          const i1 = corner(x, hw), o1 = corner(x, hw + o.pavement), i2 = corner(x2, hw), o2 = corner(x2, hw + o.pavement);
          slab(pave, side > 0 ? [i1, o1, o2, i2] : [o1, i1, i2, o2], y0, yP); x = x2; }
      });
      // zebra crossings just outside each junction
      if (o.crossings) s.stops.forEach(st => [-1, 1].forEach(sd => { const x = st.s + sd * (st.half + o.pavement + 2.2); if (x < 1.6 || x > s.L - 1.6 || blocked(s, x, 1.4)) return;
        const ry = Math.atan2(-s.u.z, s.u.x); for (let k = -s.w / 2 + 0.6; k <= s.w / 2 - 0.5; k += 1.0) { const p = add(add(s.a, mul(s.u, x)), mul(s.n, k)); zebras.push([p.x, p.z, ry]); } }));
    });
    // dashes and lamps walk along each whole road, so curves get them too
    lines.forEach((l, li) => { if (l.length < o.minDashRoad) return; const mine = segs.filter(s => s.li === li);
      const at = x => { let s = mine[mine.length - 1]; for (const t of mine) if (x <= t.start + t.L) { s = t; break; } return { s, lx: x - s.start }; };
      for (let x = 2; x <= l.length - 2; x += o.dashGap) { const { s, lx } = at(x); if (blocked(s, lx, 1.2)) continue; const p = add(s.a, mul(s.u, lx)); dashes.push([p.x, p.z, Math.atan2(-s.u.z, s.u.x)]); }
      if (o.lamps) { let k = 0; for (let x = 6; x <= l.length - 6; x += o.lampEvery, k++) { const { s, lx } = at(x); if (blocked(s, lx, 3)) continue; const sd = k % 2 ? 1 : -1, p = add(add(s.a, mul(s.u, lx)), mul(s.n, sd * (s.w / 2 + o.pavement + 0.9)));
        lamps.push([p.x, p.z, Math.atan2(-sd * s.n.x, -sd * s.n.z)]); } }
    });
    // roundabouts: asphalt ring, grass island with a bush, dashes round the ring
    rings.forEach(R => { const n = 24, ri = R.r - R.w / 2, ro = R.r + R.w / 2;
      // roads coming in (their ends were cut at this ring): where they join, the pavement ring and lamps leave a gap
      const arms = []; segs.forEach(s => [['a', s.first && s.aRing], ['b', s.last && s.bRing]].forEach(([k, on]) => { if (!on) return; const e = s[k]; if (Math.abs(len(sub(e, R.c)) - ro) > 1.5) return;
        arms.push({ ang: Math.atan2(e.x - R.c.x, e.z - R.c.z), half: Math.asin(Math.min(1, (s.w / 2) / (ro + o.pavement / 2))) + 0.02, s, k }); }));
      const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))), inArm = (a, pad) => arms.some(m => angDiff(a, m.ang) < m.half + (pad || 0));
      if (o.pavement > 0) { const np = 48;                                                     // pavement ring for walkers, open at each road
        for (let i = 0; i < np; i++) { const a1 = i / np * Math.PI * 2, a2 = (i + 1) / np * Math.PI * 2; if (inArm((a1 + a2) / 2)) continue;
          const p = (r2, a) => V(R.c.x + Math.sin(a) * r2, R.c.z + Math.cos(a) * r2);
          slab(pave, [p(ro, a1), p(ro, a2), p(ro + o.pavement, a2), p(ro + o.pavement, a1)], y0, yP, [inArm(a1 - 0.07) ? 1 : 0, 1, inArm(a2 + 0.07) ? 1 : 0, 1]); } }
      if (o.crossings) arms.forEach(m => { const s = m.s, x = m.k === 'b' ? s.L - (o.pavement + 2.2) : o.pavement + 2.2; if (x < 1.6 || x > s.L - 1.6) return;   // a crossing on each road just before the roundabout
        const ry = Math.atan2(-s.u.z, s.u.x); for (let k = -s.w / 2 + 0.6; k <= s.w / 2 - 0.5; k += 1.0) { const p = add(add(s.a, mul(s.u, x)), mul(s.n, k)); zebras.push([p.x, p.z, ry]); } });
      if (o.lamps) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; if (inArm(a, 0.3)) continue; const rr = ro + o.pavement + 0.9;   // 4 lamps round it, facing in
        lamps.push([R.c.x + Math.sin(a) * rr, R.c.z + Math.cos(a) * rr, a + Math.PI]); }
      for (let i = 0; i < n; i++) { const a1 = i / n * Math.PI * 2, a2 = (i + 1) / n * Math.PI * 2, p = (r, a) => V(R.c.x + Math.sin(a) * r, R.c.z + Math.cos(a) * r);
        slab(asphalt, [p(ri, a1), p(ri, a2), p(ro, a2), p(ro, a1)], y0, yA, [1, 0, 1, 0]);
        slab(island, [R.c, R.c, p(ri, a2), p(ri, a1)], y0, yP, [0, 0, 1, 0]);
        if (i % 2 === 0) { const m2 = p(R.r, (a1 + a2) / 2); dashes.push([m2.x, m2.z, (a1 + a2) / 2]); } }
      bushes.push([R.c.x, R.c.z, 0]); });

    const keep = m => { group.add(m); return m; };
    if (asphalt.length) keep(meshFrom(asphalt, o.material || toon(o.asphalt, true)));
    if (pave.length) keep(meshFrom(pave, toon(o.pavementColor, true)));
    if (island.length) keep(meshFrom(island, toon(o.island, true)));
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
    const inst = (geo, mat, list, y, shadow) => { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, z, r], i) => { Q.setFromAxisAngle(UP, r || 0); M.compose(new THREE.Vector3(x, y, z), Q, ONE); im.setMatrixAt(i, M); });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.castShadow = !!shadow; return keep(im); };
    inst(new THREE.BoxGeometry(o.dashLen, 0.02, o.dashW), new THREE.MeshBasicMaterial({ color: o.dash }), dashes, yA + 0.018);
    inst(new THREE.BoxGeometry(2.8, 0.02, 0.5), new THREE.MeshBasicMaterial({ color: o.zebra }), zebras, yA + 0.016);
    if (bushes.length) { const bg = new THREE.IcosahedronGeometry(1.6, 0); bg.translate(0, yP + 1.2, 0); inst(bg, toon('#4f8a42'), bushes, 0, true); }
    const bulbs = [];
    if (lamps.length) {                                                   // same shapes as the map's street lamps
      const pole = new THREE.CylinderGeometry(0.09, 0.12, 4.4, 6); pole.translate(0, 2.2, 0);
      const arm = new THREE.BoxGeometry(0.08, 0.08, 0.9); arm.translate(0, 4.35, 0.4);
      const bulb = new THREE.SphereGeometry(0.26, 8, 6); bulb.translate(0, 4.2, 0.8);
      const ironM = toon('#2f2b28'), bulbM = new THREE.MeshBasicMaterial({ color: '#ffe3a3' });
      inst(pole, ironM, lamps, 0, true); inst(arm, ironM, lamps, 0, true); inst(bulb, bulbM, lamps, 0, false);
      lamps.forEach(([x, z, r]) => { const off = new THREE.Vector3(0, 4.2, 0.8).applyAxisAngle(UP, r); bulbs.push(x + off.x, off.y, z + off.z); });
    }
    let tris = 0; group.traverse(m => { if (m.isMesh) { const n = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; tris += n * (m.isInstancedMesh ? m.count : 1); } });
    return { group, lamps: bulbs, stats: { roads: lines.length, pieces: segs.length, junctions: segs.reduce((t, s) => t + s.stops.length, 0) / 2, dashes: dashes.length, crossings: zebras.length, lamps: lamps.length, tris: Math.round(tris), drawCalls: group.children.length } };
  }

  // the map's road boxes [w, d, x, z] (axis-aligned) -> { roads: [...] }
  function fromMapBoxes(boxes) {
    return { roads: boxes.map(([w, d, x, z]) => w >= d ? { from: [x - w / 2, z], to: [x + w / 2, z], width: d } : { from: [x, z - d / 2], to: [x, z + d / 2], width: w }) };
  }

  const API = { build, fromMapBoxes, defaults: DEF };
  root.VinlandRoads = API;

  // demo for the asset gallery: a crossroads, a T-join, a bend and a roundabout
  const K = root.VinlandKit;
  if (K && K.list) {
    const make = o => { const net = build({
        roads: [{ from: [-45, 0], to: [45, 0] }, { from: [0, -45], to: [0, 30] }, { from: [-45, 0], to: [-45, 32] }, { from: [20, 0], to: [20, -24], width: 4 }],
        paths: [{ points: [[45, 0], [58, 9], [62, 26]] }],
        roundabouts: [{ x: 0, z: 40, r: 9 }]
      }, { pavement: o.pavement === 'none' ? 0 : 1.6, crossings: o.crossings !== 'off', lamps: true, curve: o.bends === 'sharp' ? 0 : 8 });
      const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(120, 0.12, 96), toon('#e6d6b2')).translateY(0.02).translateX(8).translateZ(4)); g.children[0].receiveShadow = true;
      g.add(net.group); g.userData.roadStats = net.stats; g.name = 'roadsDemo'; g.userData.asset = 'roadsDemo'; return g; };
    K.list.push({ key: 'roadsDemo', name: 'Road network', cat: 'Roads', part: 2, budget: 4000, size: 'demo · 120 × 96 m', night: false,
      opts: { bends: { label: 'Bends', choices: ['curved', 'sharp'] }, pavement: { label: 'Pavement', choices: ['1.6 m', 'none'] }, crossings: { label: 'Crossings', choices: ['on', 'off'] } }, make });
    K.roadsDemo = make;
  }
})(typeof window !== 'undefined' ? window : this);
