/* Life in Vinland: Old Town (step 1, 24 Nov).
   Builds the street-level world for the centre of Vinland from the map's own exports:
   real kit houses on every plot, Market shops on the Market spots, footpaths with kerbs along every road,
   street lamps, electric poles with wires, zebra crossings, trees on the green patches and a fountain on the Plaza.
   Every kind of piece is baked once and drawn as instances (a few draw calls per kind), so phones stay fast.
   Nothing here moves a home, plot or road: positions come from vinland-static.js and mapdata.js.
   OldTown.build(...) returns { inTown(x, z), check() } — check() lists layout errors (overlaps, floating, off-road pieces). */
(function () {
  'use strict';
  const BOX = { x0: -300, x1: 300, z0: -300, z1: 270 };   // Old Town: the centre, from the West block to the East block
  const inTown = (x, z) => x > BOX.x0 && x < BOX.x1 && z > BOX.z0 && z < BOX.z1;
  const SHOP_KINDS = ['shopCafe', 'shopBakery', 'shopBooks', 'shopGrocery', 'shopPharmacy', 'shopBarber', 'shopFlorist', 'shopClothing'];

  function build(scene, K, D, S, solid) {
    const R = (x0, z0, x1, z1, kind, ref) => ({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), kind, ref });
    const hit = (a, b, pad) => { pad = pad || 0; return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad; };
    const roads = D.roads.map(([w, d, x, z]) => R(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'road', { w, d, x, z })).filter(r => hit(r, BOX));
    const places = D.places.filter(p => p[0]).map(([n, x, z, w, d]) => R(x, z, x + w, z + d, 'place', n));
    const plotsAll = S.plots.trim().split('\n').map(l => l.split(',')).map((a, i) => ({ x: +a[0], z: +a[1], a: a[2], i }));
    const plots = plotsAll.filter(p => inTown(p.x, p.z));
    const slots = (D.slots || []).filter(s => s[2] === 'm' && inTown(s[0], s[1]));
    const corner = D.places.filter(p => p[0] === 'Corner shop').map(([n, x, z, w, d]) => ({ x: x + w / 2, z: z + d / 2 }));

    // ---- occupancy grid: everything placed registers its footprint, so nothing overlaps
    const GRID = new Map(), CELL = 10, taken = [];
    const cells = r => { const out = []; for (let a = Math.floor(r.x0 / CELL); a <= Math.floor(r.x1 / CELL); a++) for (let b = Math.floor(r.z0 / CELL); b <= Math.floor(r.z1 / CELL); b++) out.push(a + ',' + b); return out; };
    const claim = r => { taken.push(r); cells(r).forEach(k => { if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(r); }); return r; };
    const free = (r, ignore, pad) => !cells(r).some(k => (GRID.get(k) || []).some(o => o !== ignore && !(ignore && ignore.includes && ignore.includes(o.kind)) && hit(r, o, pad || 0)));
    roads.forEach(claim);

    // ---- instancing: one baked drawing per kind of piece
    const kinds = new Map(), CH = 1e5, chunkOf = () => '0,0';   // one chunk: small pieces are cheap; houses get their own near/far switch below
    function put(key, opts, x, z, ry, sx, tint) {
      const ck = chunkOf(x, z), id = ck + '|' + key + JSON.stringify(opts || {});
      if (!kinds.has(id)) kinds.set(id, { key, opts: opts || {}, ck, mats: [], tints: [] });
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0), new THREE.Vector3(sx || 1, 1, 1));
      const k = kinds.get(id); k.mats.push(m); k.tints.push(tint || null);
    }
    const nearestRoad = (x, z) => { let best = null, bd = 1e9; roads.forEach(r => { const cx = Math.max(r.x0, Math.min(x, r.x1)), cz = Math.max(r.z0, Math.min(z, r.z1)), dd = Math.hypot(cx - x, cz - z); if (dd < bd) { bd = dd; best = [cx, cz]; } }); return best; };
    const faceTo = (x, z, tx, tz) => { const dx = tx - x, dz = tz - z; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI); };   // front = +z, turned to face the target

    // ---- homes: the kit's starter house on every Old Town plot, facing its nearest road, colours from the kit's sets
    const W = K.SETS.walls, RF = K.SETS.roofs;
    plots.forEach((p, i) => { const nr = nearestRoad(p.x, p.z), ry = nr ? faceTo(p.x, p.z, nr[0], nr[1]) : 0;
      p.tint = { wall: W[(i * 7) % W.length], roof: RF[(i * 3) % RF.length] };   // drawn below with the near/far switch
      claim(R(p.x - 5, p.z - 5, p.x + 5, p.z + 5, 'plot', p)); p.ry = ry; });

    // ---- Market shops (spots 1-24) and the 4 corner shops: they face the Plaza side
    const shopsOut = [];
    slots.forEach((s, i) => { const [x, z] = s, ry = Math.abs(z) >= Math.abs(x) ? (z > 0 ? Math.PI : 0) : (x > 0 ? -Math.PI / 2 : Math.PI / 2);
      put(SHOP_KINDS[i % SHOP_KINDS.length], {}, x, z, ry); claim(R(x - 5, z - 5, x + 5, z + 5, 'shop', i)); solid.push([x - 4.5, z - 4.5, x + 4.5, z + 4.5]); shopsOut.push({ n: i + 1, x, z, ry, kind: SHOP_KINDS[i % SHOP_KINDS.length] }); });
    corner.forEach((c, i) => { const nr = nearestRoad(c.x, c.z), ry = nr ? faceTo(c.x, c.z, nr[0], nr[1]) : 0, kind = SHOP_KINDS[(i + 3) % SHOP_KINDS.length];
      put(kind, {}, c.x, c.z, ry); claim(R(c.x - 5, c.z - 5, c.x + 5, c.z + 5, 'shop', 'corner')); solid.push([c.x - 4.5, c.z - 4.5, c.x + 4.5, c.z + 4.5]); });
    places.filter(p => hit(p, BOX) && p.ref !== 'Corner shop').forEach(p => claim(Object.assign({}, p)));

    // ---- footpaths with kerbs on both sides of every road, in 2.5 m pieces. A piece is left out where it would
    //      run into another road, a plot, a shop or a building, so junctions stay clean and nothing overlaps.
    const PW = 2.5, SEG = 2.5, paths = [];
    roads.forEach(r => { const along = r.ref.w >= r.ref.d, L = along ? r.ref.w : r.ref.d, half = (along ? r.ref.d : r.ref.w) / 2;
      [-1, 1].forEach(side => { const off = half + PW / 2, ry = along ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);   // kerb (+z of the piece) faces the road
        let run = null; const flush = () => { if (!run) return; const n = run.n, t = (run.t0 + run.t1) / 2, cx = along ? r.ref.x + t : r.ref.x + side * off, cz = along ? r.ref.z + side * off : r.ref.z + t;
          put('gsFootpath', { len: '2.5' }, cx, cz, ry, n); run = null; };   // one stretched piece per straight run: far fewer triangles
        for (let t = -L / 2 + SEG / 2; t < L / 2; t += SEG) {
          const cx = along ? r.ref.x + t : r.ref.x + side * off, cz = along ? r.ref.z + side * off : r.ref.z + t;
          const fr = along ? R(cx - SEG / 2, cz - PW / 2, cx + SEG / 2, cz + PW / 2, 'path') : R(cx - PW / 2, cz - SEG / 2, cx + PW / 2, cz + SEG / 2, 'path');
          if (!inTown(cx, cz) || !free(fr, null, -0.01)) { flush(); continue; }
          claim(fr); paths.push({ r, side, t, cx, cz, along });
          if (run) { run.n++; run.t1 = t + SEG / 2; } else run = { n: 1, t0: t - SEG / 2, t1: t + SEG / 2 }; }
        flush(); }); });

    // ---- street lamps (one side, every ~25 m) and electric poles with wires (other side, every ~30 m)
    const wires = [];
    roads.forEach(r => { const along = r.ref.w >= r.ref.d, L = along ? r.ref.w : r.ref.d; if (L < 20) return;
      const onPath = (side, t, inset) => { const half = (along ? r.ref.d : r.ref.w) / 2, off = half + inset; return along ? [r.ref.x + t, r.ref.z + side * off] : [r.ref.x + side * off, r.ref.z + t]; };
      const hasPath = (x, z) => taken.some(o => o.kind === 'path' && x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1);
      for (let t = -L / 2 + 12; t < L / 2 - 6; t += 25) { const [x, z] = onPath(1, t, 0.45); if (!inTown(x, z) || !hasPath(x, z)) continue;
        const fr = R(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 'lamp'); if (!free(fr, ['path'])) continue; put('streetLamp', {}, x, z, along ? Math.PI : -Math.PI / 2); claim(fr); solid.push([fr.x0, fr.z0, fr.x1, fr.z1]); }
      let prev = null;
      for (let t = -L / 2 + 6; t < L / 2 - 4; t += 30) { const [x, z] = onPath(-1, t, 2.2); if (!inTown(x, z) || !hasPath(x, z)) { prev = null; continue; }
        const fr = R(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 'pole'); if (!free(fr, ['path'])) { prev = null; continue; }
        put('gsElectricPole', { transformer: Math.round(t) % 4 === 0 ? 'yes' : 'no' }, x, z, along ? 0 : Math.PI / 2); claim(fr); solid.push([fr.x0, fr.z0, fr.x1, fr.z1]);
        const cur = { x, z, along }; if (prev) wires.push([prev, cur]); prev = cur; }
    });
    // wires: three sagging lines between neighbouring poles, one merged line mesh for the whole town
    const wp = [];
    wires.forEach(([a, b]) => [-0.8, 0, 0.8].forEach(o => { const ax = a.x + (a.along ? 0 : o), az = a.z + (a.along ? o : 0), bx = b.x + (b.along ? 0 : o), bz = b.z + (b.along ? o : 0);
      for (let k = 0; k < 8; k++) { const t0 = k / 8, t1 = (k + 1) / 8, y = t => 7.9 - 0.8 * Math.sin(Math.PI * t);
        wp.push(ax + (bx - ax) * t0, y(t0), az + (bz - az) * t0, ax + (bx - ax) * t1, y(t1), az + (bz - az) * t1); } }));
    if (wp.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#2f2b28' }))); }

    // ---- zebra crossings on the four roads that lead to the Plaza and Market (narrowed to the road's width)
    roads.forEach(r => { const along = r.ref.w >= r.ref.d, W2 = along ? r.ref.d : r.ref.w;
      if (Math.abs(along ? r.ref.z : r.ref.x) > 80 || (along ? r.ref.w : r.ref.d) < 60) return;
      const x = along ? 0 : r.ref.x, z = along ? r.ref.z : 0; if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) return;
      put('zebraCrossing', {}, x, z, along ? Math.PI / 2 : 0, (W2 - 0.4) / 7.8); });

    // ---- the Plaza: fountain in the middle, benches around it
    put('plazaFountain', {}, 0, 0, 0); solid.push([-8, -8, 8, 8]);
    [[0, 14, Math.PI], [0, -14, 0], [14, 0, -Math.PI / 2], [-14, 0, Math.PI / 2]].forEach(([x, z, ry]) => { put('bench', {}, x, z, ry); solid.push([x - 1, z - 0.4, x + 1, z + 0.4]); });

    // ---- trees on the green patches (D.flat 'g'), on a loose grid, never on a road, path or building
    let ti = 0;
    D.flat.filter(f => f[0] === 'g').forEach(([k, x, z, w, d]) => { if (!hit(R(x, z, x + w, z + d), BOX)) return;
      for (let a = x + 5; a < x + w - 4; a += 11) for (let b = z + 5; b < z + d - 4; b += 11) { const jx = a + ((ti * 37) % 5) - 2, jz = b + ((ti * 53) % 5) - 2; ti++;
        const fr = R(jx - 2.5, jz - 2.5, jx + 2.5, jz + 2.5, 'tree'); if (!inTown(jx, jz) || !free(fr)) continue;
        put(ti % 5 === 0 ? 'cypressTree' : 'parkTree', {}, jx, jz, (ti % 4) * Math.PI / 2); claim(fr); solid.push([jx - 0.5, jz - 0.5, jx + 0.5, jz + 0.5]); } });

    // ---- small life at the shops: a bin and a cycle stand at every 4th Market spot, cafe tables in front of cafes
    shopsOut.forEach((s, i) => { const fx = Math.sin(s.ry), fz = Math.cos(s.ry);   // the way the shop faces
      if (s.kind === 'shopCafe') return;   // the cafe front already has its own tables
      if (i % 4 === 1) { const x = s.x + fx * 6.2 + fz * 3.5, z = s.z + fz * 6.2 - fx * 3.5, fr = R(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 'bin'); if (free(fr, ['path'])) { put('dustbin', {}, x, z, s.ry); claim(fr); } } });

    // ---- draw: one instanced group per kind of piece
    let tris = 0, calls = 0; const bakedOf = new Map(), chunks = new Map();
    kinds.forEach((k, id) => { const kid = k.key + JSON.stringify(k.opts); let b = bakedOf.get(kid);
      if (!b) { const g = K.make ? K.make(k.key, k.opts) : K[k.key](k.opts); b = { baked: K.bake(g), tris: K.tris(g) }; bakedOf.set(kid, b); }
      const grp = K.instances(b.baked, k.mats, i => k.tints[i]); scene.add(grp); calls += grp.children.length; tris += b.tris * k.mats.length;
      if (!chunks.has(k.ck)) chunks.set(k.ck, { x0: -1e9, z0: -1e9, x1: 1e9, z1: 1e9, groups: [], plots: [], tris: 0, on: true });   // one chunk covering all of Old Town
      const ch = chunks.get(k.ck); ch.groups.push(grp); ch.tris += b.tris * k.mats.length; });
    // ---- houses: full kit house near you, the page's plain box house far away (same spot, same colours idea).
    //      Only the near houses keep their ink outlines; the outline mesh is rebuilt when you have walked a bit.
    const hg = K.make ? K.make('houseStarter', {}) : K.houseStarter({}), hb = K.bake(hg), htris = K.tris(hg), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
    const hmats = plots.map(p => new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0, p.z), Q.setFromAxisAngle(UP, p.ry).clone(), ONE));
    const hgrp = K.instances(hb, hmats, i => plots[i].tint); const hline = hgrp.children.find(c => c.isLineSegments); hgrp.remove(hline); scene.add(hgrp);
    const hmeshes = hgrp.children.filter(c => c.isInstancedMesh), hcols = hmeshes.map(m => m.instanceColor ? m.instanceColor.array.slice() : null);
    const lineMat = new THREE.LineBasicMaterial({ color: '#3a2a20', transparent: true, opacity: 0.55 }), hl = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat); hl.frustumCulled = false; scene.add(hl);
    calls += hmeshes.length + 1; tris += htris * plots.length;
    function houses(px, pz, rad, onSwap) { const near = [], far = [], v = new THREE.Vector3(), Lb = hb.lines;
      plots.forEach((p, i) => (Math.hypot(p.x - px, p.z - pz) < rad ? near : far).push(i));
      hmeshes.forEach((m, k) => { const col = hcols[k]; near.forEach((i, n) => { m.setMatrixAt(n, hmats[i]); if (col) m.instanceColor.array.set(col.subarray(i * 3, i * 3 + 3), n * 3); });
        m.count = near.length; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });   // only near houses are drawn at all
      const arr = new Float32Array(Lb.length * near.length); near.forEach((i, n) => { for (let k = 0; k < Lb.length; k += 3) { v.set(Lb[k], Lb[k + 1], Lb[k + 2]).applyMatrix4(hmats[i]); arr[n * Lb.length + k] = v.x; arr[n * Lb.length + k + 1] = v.y; arr[n * Lb.length + k + 2] = v.z; } });
      hl.geometry.dispose(); hl.geometry = new THREE.BufferGeometry(); hl.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      if (onSwap) { onSwap(near.map(i => plots[i].i), true); onSwap(far.map(i => plots[i].i), false); } return near.length * htris; }
    // show(px, pz, radius, onChunk): turns chunks on/off by distance; onChunk(plotIndexes, on) lets the page swap far homes for plain blocks
    function show(px, pz, rad, onChunk) { let vis = houses(px, pz, rad, onChunk); chunks.forEach(ch => { const dx = Math.max(ch.x0 - px, 0, px - ch.x1), dz = Math.max(ch.z0 - pz, 0, pz - ch.z1), on = Math.hypot(dx, dz) < rad;
        if (on !== ch.on) { ch.on = on; ch.groups.forEach(g => g.visible = on); } if (on) vis += ch.tris; }); return vis; }

    // ---- check: every piece's footprint is free of the others, and every road stays clear
    function check() { const errs = []; for (let i = 0; i < taken.length; i++) { const a = taken[i]; if (a.kind === 'road' || a.kind === 'place') continue;
        cells(a).forEach(c => (GRID.get(c) || []).forEach(o => { if (o === a || o.kind === 'place') return; const pad = -0.01;
          if (hit(a, o, pad) && !(a.kind === 'path' && o.kind === 'path') && !(['lamp', 'pole'].includes(a.kind) && o.kind === 'path') && !(['lamp', 'pole'].includes(o.kind) && a.kind === 'path') && !(a.kind === 'bin' && o.kind === 'path'))
            errs.push(a.kind + ' at ' + ((a.x0 + a.x1) / 2).toFixed(1) + ',' + ((a.z0 + a.z1) / 2).toFixed(1) + ' overlaps ' + o.kind); })); }
      return [...new Set(errs)]; }
    const stats = { homes: plots.length, shops: shopsOut.length + corner.length, paths: paths.length, poles: wires.length, kinds: kinds.size, tris, calls };
    return { inTown, check, stats, shops: shopsOut, plots, show, paths, taken };
  }
  window.OldTown = { build, inTown, BOX };
})();
