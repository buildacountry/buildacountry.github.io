/* Vinland Downtown kit (assets/downtown.js, 24 Nov 2026). Load after kit.js.
   Residential towers + low apartments, Times Square pieces, office district, street extras.
   Rules (Dev's directive): metres, ground y = 0, pivot bottom-centre, front faces +z, nothing floating,
   doors at ground (1.6+ m wide x 2.6 m glass doors for lobbies, citizen is 2.2 m), storeys 3.2 m (homes) / 3.6 m (offices).
   No brands: screens and signs show Vinland things only. Every asset has e.dt = true so the Downtown kit page lists only these. */
(function (root) {
  'use strict';
  const K = root.VinlandKit, THREE = root.THREE;
  if (!K || !K._h) { console.error('downtown.js: load kit.js (with KIT._h) first'); return; }
  if (K.dtResClad) return;   // already added
  const { B, P, CYL, ICO, BALL, GABLE, grp, tree, def: def0, colours, choices, glowMat, slot, toon, NE, FLAT, PAL } = K._h;
  const def = e => def0(Object.assign({ dt: true, part: 3 }, e));
  const FH = 3.2, OF = 3.6;
  const CONC = '#cfcac0', CONC2 = '#b9b3a8', DARK = '#3a4048', STEEL = '#5b5f66', GLASS = '#3f5866', RAILG = '#2f2b28';

  // ---------- materials ----------
  const lit = glowMat('#4a6a80', '#f0c36a'), unlit = toon('#3f5866');          // windows: some light up at night
  const glassL = toon('#5f86a6'), warm = glowMat('#f0c36a', '#ffcf6a');                                    // shop glass, lobby glass
  const railGlass = (() => { const m = toon('#b8d6dc'); m.transparent = true; m.opacity = 0.55; m.side = THREE.DoubleSide; return m; })();
  const cvCache = {};
  // a picture / text material from a canvas. screen = lights up (and stays bright by day, like a real screen)
  function cmat(key, w, h, draw, screen) {
    if (cvCache[key]) return cvCache[key];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; const m = toon('#ffffff'); m.map = t;
    if (screen) { m.emissiveMap = t; m.userData.glow = '#ffffff'; m.userData.dayGlow = '#8a8a8a'; m.emissive.set('#8a8a8a'); }
    return (cvCache[key] = m);
  }
  const font = (px, w) => `${w || 800} ${px}px Poppins, system-ui, sans-serif`;
  function signMat(text, bg, fg, w, h, screen) {
    return cmat('s|' + text + bg + fg + w + h + !!screen, w, h, (c) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
      let px = h * 0.62; c.font = font(px); while (c.measureText(text).width > w * 0.9 && px > 8) { px -= 2; c.font = font(px); } c.fillText(text, w / 2, h / 2 + 2); }, screen);
  }
  // Times Square screens: Vinland news, never ads
  const SCREENS = {
    count: (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1f3f8a'); g.addColorStop(1, '#7a2a8c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd54a'; c.textAlign = 'center'; c.font = font(h * 0.16); c.fillText('VINLAND', w / 2, h * 0.3); c.fillStyle = '#fff'; c.font = font(h * 0.2); c.fillText('6,845', w / 2, h * 0.58);
      c.font = font(h * 0.08, 600); c.fillText('citizens and counting', w / 2, h * 0.75); c.fillStyle = '#7ee0ff'; c.fillText('Comment HOME to join', w / 2, h * 0.9); },
    welcome: (c, w, h) => { c.fillStyle = '#0f6b5c'; c.fillRect(0, 0, w, h); c.fillStyle = '#f7d046'; for (let i = 0; i < 40; i++) { c.globalAlpha = 0.35; c.beginPath(); c.arc((i * 97) % w, (i * 53) % h, 6 + (i % 5) * 4, 0, 7); c.fill(); }
      c.globalAlpha = 1; c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = font(h * 0.12); c.fillText('WELCOME HOME', w / 2, h * 0.38); c.fillStyle = '#ffd54a'; c.font = font(h * 0.14); c.fillText('@newest_citizen', w / 2, h * 0.62);
      c.fillStyle = '#d8f3ea'; c.font = font(h * 0.07, 600); c.fillText('Market Street, home 6,846', w / 2, h * 0.82); },
    art: (c, w, h) => { c.fillStyle = '#f7e24a'; c.fillRect(0, 0, w, h); [['#e8473a', .2, .3, .22], ['#3f7fbf', .7, .25, .2], ['#2f9a6a', .45, .75, .25], ['#d86fb0', .85, .8, .14], ['#ff9a3a', .1, .85, .12]].forEach(([col, x, y, r]) => { c.fillStyle = col; c.beginPath(); c.arc(x * w, y * h, r * Math.min(w, h), 0, 7); c.fill(); }); },
    theatre: (c, w, h) => { c.fillStyle = '#5a1f3e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffcf6a'; c.lineWidth = Math.max(4, w * 0.02); c.strokeRect(w * 0.05, h * 0.06, w * 0.9, h * 0.88);
      c.fillStyle = '#ffd9ec'; c.textAlign = 'center'; c.font = font(h * 0.1, 600); c.fillText('TONIGHT', w / 2, h * 0.3); c.fillStyle = '#fff'; c.font = font(h * 0.13); c.fillText('VINLAND', w / 2, h * 0.52); c.fillText('THEATRE', w / 2, h * 0.7); },
    vert: (c, w, h) => { c.fillStyle = '#1b1530'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff5ad1'; c.textAlign = 'center'; c.font = font(w * 0.7); 'VINLAND'.split('').forEach((l, i) => c.fillText(l, w / 2, h * (0.13 + i * 0.125))); },
    tower: (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ff8a3a'); g.addColorStop(1, '#c8343a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = font(h * 0.1); c.fillText('VINLAND TOWER', w / 2, h * 0.35); c.font = font(h * 0.16); c.fillText('FLOOR 6', w / 2, h * 0.6); c.font = font(h * 0.07, 600); c.fillText('rises with every 1,000 citizens', w / 2, h * 0.8); },
    ticker: (c, w, h) => { c.fillStyle = '#121418'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff4a3a'; c.font = font(h * 0.62); c.textBaseline = 'middle';
      c.fillText('VINLAND NEWS  ·  Introvert Island is open  ·  Tower floor 6 is up  ·  Comment HOME to join  ·', 10, h / 2 + 2); }
  };
  const screenMat = (k, w, h) => cmat('scr|' + k + w + h, w, h, SCREENS[k], true);
  // a glass curtain wall as one texture (offices): rows = floors, cols = window bays
  const curtain = (rows, cols, glass, frame, key) => cmat('cw|' + key + rows + cols, 256, 512, (c, w, h) => { c.fillStyle = frame; c.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { c.fillStyle = (r * 7 + k * 3) % 9 === 0 ? '#6f93ad' : glass; c.fillRect(k * w / cols + 2, r * h / rows + 3, w / cols - 4, h / rows - 6); } });

  // ---------- building helpers ----------
  // run fn on each of the 4 faces: a group sitting on that face, its +z pointing outwards. fn(group, faceLength, index 0 front, 1 back, 2 right, 3 left)
  function faces(g, W, D, fn, only) { [[0, D / 2, 0, W], [0, -D / 2, Math.PI, W], [W / 2, 0, Math.PI / 2, D], [-W / 2, 0, -Math.PI / 2, D]].forEach(([x, z, ry, len], i) => { if (!only || only.includes(i)) fn(grp(g, x, 0, z, ry), len, i); }); }
  // windows on a face: floors x cols, skip(f, c) leaves a gap
  function windows(s, len, y0, floors, fh, cols, o) {
    o = o || {}; const ww = o.w || len / cols * 0.6, wh = o.h || fh * 0.55, z = o.z || 0.04;
    for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) { if (o.skip && o.skip(f, k)) continue;
      const x = -len / 2 + (k + 0.5) * len / cols; P(s, ww, wh, (f * 5 + k * 3 + (o.seed || 0)) % 7 < 3 ? lit : unlit, x, y0 + f * fh + (o.sill || fh * 0.25), z);
      if (o.frame) B(s, ww + 0.3, 0.14, 0.25, o.frame, x, y0 + f * fh + (o.sill || fh * 0.25) - 0.14, z + 0.06, FLAT); }
  }
  // a stacked glass balcony: slab + glass + top rail. On a face group, at x, floor bottom y, w wide, d deep.
  function balc(s, x, y, w, d, slabCol) {
    B(s, w, 0.2, d, slabCol || '#dcd7ce', x, y, d / 2); P(s, w, 1.05, railGlass, x, y + 0.2, d - 0.02);
    P(s, d, 1.05, railGlass, x - w / 2 + 0.02, y + 0.2, d / 2, { ry: Math.PI / 2 }); P(s, d, 1.05, railGlass, x + w / 2 - 0.02, y + 0.2, d / 2, { ry: Math.PI / 2 });
    B(s, w, 0.06, 0.08, RAILG, x, y + 1.25, d - 0.03, FLAT);
  }
  // lobby: glass doors at ground, frame, a canopy over them. Doors 2.6 m tall (citizen 2.2 m).
  function lobby(s, x, w, o) {
    o = o || {}; B(s, w + 0.6, 3.2, 0.3, o.frame || DARK, x, 0, 0.02); P(s, w, 2.8, warm, x, 0.05, 0.2);
    for (let i = 1; i < 3; i++) B(s, 0.08, 2.8, 0.06, RAILG, x - w / 2 + i * w / 3, 0.05, 0.22, FLAT);
    B(s, w + 2.4, 0.25, 2.4, o.canopy || DARK, x, 3.4, 1.2);                                              // canopy (held by the wall)
    if (o.sign) P(s, w + 1.6, 0.55, signMat(o.sign, o.signBg || '#2f2b28', '#f6f0e2', 512, 96), x, 3.66, 2.42);
  }
  // shop front: glass + door + sign board (+ awning)
  function shop(s, x, w, h, text, bg, fg, o) {
    o = o || {}; B(s, w + 0.4, h + 1.2, 0.25, o.frame || DARK, x, 0, 0.02); P(s, w, h - 0.4, warm, x, 0.4, 0.17); B(s, w, 0.4, 0.3, CONC2, x, 0, 0.05, FLAT);
    B(s, 0.1, h - 0.4, 0.08, RAILG, x + w / 4, 0.4, 0.2, FLAT);
    P(s, w, 0.85, signMat(text, bg, fg, 512, 110), x, h + 0.15, 0.17);
    if (o.awning) { B(s, w + 0.2, 0.12, 1.6, o.awning, x, h - 0.35, 0.9, NE); }
  }
  // roof kit: parapet, lift + stair box, AC units, a water tank
  function roof(g, W, D, y, o) {
    o = o || {}; const pc = o.parapet || CONC2, t = 0.3;
    B(g, W, 1.0, t, pc, 0, y, D / 2 - t / 2); B(g, W, 1.0, t, pc, 0, y, -D / 2 + t / 2); B(g, t, 1.0, D - 2 * t, pc, W / 2 - t / 2, y, 0); B(g, t, 1.0, D - 2 * t, pc, -W / 2 + t / 2, y, 0);
    B(g, W - 0.6, 0.1, D - 0.6, o.floor || '#8f8a82', 0, y, 0, FLAT);
    if (o.core !== false) { B(g, 4.2, 3.4, 4.6, o.coreCol || CONC, -W / 4, y, -D / 4); P(grp(g, -W / 4, y, -D / 4 + 2.3), 1.2, 2.3, DARK, 0, 0, 0.02); }
    const ac = o.ac == null ? 3 : o.ac;
    for (let i = 0; i < ac; i++) { const ax = W / 6 + i * 2.0 - 1, az = D / 5; B(g, 1.6, 1.0, 1.1, '#d6d6d2', ax, y + 0.1, az); CYL(g, 0.42, 0.42, 0.06, 10, '#5b5f66', ax, y + 1.1, az, NE); }
    if (o.tank) { [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 0.2, 2.4, 0.2, STEEL, W / 4 + a * 1.2, y, -D / 4 + b * 1.2, NE)); CYL(g, 1.7, 1.7, 2.6, 10, '#8a5a3a', W / 4, y + 2.4, -D / 4); CYL(g, 0.01, 1.8, 0.9, 10, '#6a4a30', W / 4, y + 5.0, -D / 4); }
  }

  // ======================= RESIDENTIAL (downtown homes) =======================
  const CLAD = [['Blue + orange', '#5b7fa6', '#c8683a'], ['Green + sand', '#5f8f6e', '#d9a66a'], ['Grey + red', '#8a8f96', '#b5543a'], ['Teal + cream', '#3f8f8a', '#e8d5b0']];
  // A: the city tower. Two colour bands, corner balconies, café + market on the ground floor.
  def({ key: 'dtResClad', name: 'Residential tower (two-tone)', cat: 'Downtown homes', budget: 9000, size: '20 × 18 m · 13 floors + shops · 48 m', night: true,
    opts: { set: choices('Colours', CLAD.map(c => c[0])) },
    make(o) { const g = new THREE.Group(), S = CLAD.find(c => c[0] === o.set) || CLAD[0], A = slot('wall', S[1]), Bc = slot('roof', S[2]);
      const W = 20, D = 18, base = 5.2, N = o.floors || 13, top = base + N * FH;
      B(g, W, base, D, CONC2, 0, 0, 0); B(g, W - 0.6, N * FH, D - 0.6, CONC, 0, base, 0); B(g, W + 0.2, 0.35, D + 0.2, CONC2, 0, base, 0);
      faces(g, W - 0.6, D - 0.6, (s, len, i) => {
        P(s, len * 0.3, N * FH, A, -len * 0.33, base, 0.02); P(s, len * 0.22, N * FH, Bc, len * 0.18, base, 0.02);   // the two colour bands
        windows(s, len, base, N, FH, 5, { seed: i });
        if (i < 2) for (let f = 0; f < N; f++) { balc(s, -len / 2 + 2.4, base + f * FH, 4.4, 1.5); balc(s, len / 2 - 2.4, base + f * FH, 4.4, 1.5); }
      });
      faces(g, W, D, (s, len, i) => { if (i === 0) { shop(s, -6, 6.4, 4.2, 'CAFE', '#3a2a20', '#f7ecd6', { awning: '#c8603f' }); lobby(s, 0, 2.8, { sign: 'RESIDENCES' }); shop(s, 6, 6.4, 4.2, 'MARKET', '#2f7a68', '#f6f0e2'); }
        else if (i === 1) { P(s, 3.4, 2.6, STEEL, -5, 0.05, 0.03); P(s, 1.4, 2.4, DARK, 4, 0.05, 0.03); }                                   // back: bin store door + fire exit
        else windows(s, len, 0, 1, 5.2, 3, { h: 3.2, sill: 0.8 }); });
      roof(g, W - 0.6, D - 0.6, top, { tank: true });
      return g; } });

  // B: brown wood-panel tower with full-width front balconies
  def({ key: 'dtResWood', name: 'Residential tower (wood panels)', cat: 'Downtown homes', budget: 8000, size: '18 × 16 m · 12 floors · 43 m', night: true,
    opts: { wood: colours('Panels', ['#b06a3c', '#8a5a3a', '#c98b52', '#6f4a34']) },
    make(o) { const g = new THREE.Group(), WD = slot('wall', o.wood || '#b06a3c'), W = 18, D = 16, base = 4.6, N = o.floors || 12, top = base + N * FH;
      B(g, W, base, D, '#bdb7ac', 0, 0, 0); B(g, W - 0.4, N * FH, D - 0.4, '#d8d3c9', 0, base, 0);
      faces(g, W - 0.4, D - 0.4, (s, len, i) => {
        P(s, len * 0.36, N * FH, WD, i < 2 ? 0 : len * 0.22, base, 0.02);
        windows(s, len, base, N, FH, 4, { seed: i + 2, frame: i < 2 ? null : '#a49e93' });
        if (i < 2) for (let f = 0; f < N; f++) { balc(s, -len * 0.27, base + f * FH, 6.2, 1.6); balc(s, len * 0.27, base + f * FH, 6.2, 1.6); }
      });
      faces(g, W, D, (s, len, i) => { if (i === 0) { lobby(s, 0, 3.0, { canopy: '#6f4a34' }); windows(s, len, 0, 1, 4.6, 4, { h: 2.6, sill: 1.0, skip: (f, k) => k === 1 || k === 2 }); }
        else if (i === 1) P(s, 1.4, 2.4, DARK, 0, 0.05, 0.03); else windows(s, len, 0, 1, 4.6, 3, { h: 2.6, sill: 1.0 }); });
      roof(g, W - 0.4, D - 0.4, top, { ac: 2 });
      return g; } });

  // C: glass tower, dark frame, roof terrace + penthouse
  def({ key: 'dtResGlass', name: 'Residential tower (glass)', cat: 'Downtown homes', budget: 9000, size: '18 × 18 m · 14 floors + penthouse · 53 m', night: true,
    make(o) { const g = new THREE.Group(), W = 18, D = 18, base = 4.4, N = o.floors || 14, top = base + N * FH;
      B(g, W, base, D, DARK, 0, 0, 0); B(g, W - 0.8, N * FH, D - 0.8, '#6b7782', 0, base, 0);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 1.0, N * FH + 0.4, 1.0, DARK, a * (W / 2 - 0.5), base, b * (D / 2 - 0.5)));   // corner columns
      faces(g, W - 0.8, D - 0.8, (s, len, i) => { for (let f = 0; f < N; f++) { P(s, len - 1.4, FH * 0.72, (f + i) % 3 ? glassL : lit, 0, base + f * FH + 0.5, 0.05); B(s, len, 0.35, 0.3, DARK, 0, base + f * FH, 0.1, FLAT); }
        if (i === 0) for (let f = 0; f < N; f += 1) balc(s, len / 2 - 3.2, base + f * FH, 5.2, 1.4, '#9aa0a6'); });
      faces(g, W, D, (s, len, i) => { if (i === 0) lobby(s, 0, 3.4, { canopy: '#2f2b28', sign: 'THE GLASSHOUSE', signBg: '#3a4048' }); else if (i === 1) P(s, 1.4, 2.4, '#2b3036', 3, 0.05, 0.03);
        else P(s, len - 3, 2.8, warm, 0, 0.6, 0.03); });
      // roof terrace: glass rail round the edge, planters, a pergola, the penthouse
      const y = top; B(g, W - 0.8, 0.15, D - 0.8, '#b79b7a', 0, y, 0, FLAT);
      faces(g, W - 0.8, D - 0.8, (s, len) => { P(s, len, 1.1, railGlass, 0, y + 0.15, -0.05); B(s, len, 0.06, 0.08, RAILG, 0, y + 1.25, -0.05, FLAT); });
      B(g, 9, 3.4, 7.5, DARK, -2.5, y + 0.15, -3.5); P(grp(g, -2.5, y + 0.15, 0.26), 8, 2.8, warm, 0, 0.1, 0); B(g, 10, 0.3, 8.5, '#2b3036', -2.5, y + 3.55, -3.5);
      [[5, 5], [5, -5], [-6, 6]].forEach(([x, z]) => { B(g, 2.4, 0.7, 1.0, '#8a7a66', x, y + 0.15, z); ICO(g, 0.7, 0, PAL.leaf2, x - 0.5, y + 1.1, z, NE); ICO(g, 0.7, 0, PAL.leaf, x + 0.5, y + 1.1, z, NE); });
      [[3, 1], [7, 1], [3, 3.6], [7, 3.6]].forEach(([x, z]) => B(g, 0.15, 2.6, 0.15, '#6f4a34', x, y + 0.15, z, NE)); for (let k = 0; k < 6; k++) B(g, 0.12, 0.12, 3.2, '#6f4a34', 2.6 + k * 0.9, y + 2.75, 2.3, NE);
      return g; } });

  // D: Art-deco apartments, 4 floors, rounded corners, a stepped entrance with fins
  const DECO = { Cream: ['#f2e6c4', '#d9c79a', '#8fb0a8'], Pink: ['#efc9c0', '#d8a79c', '#7fb3a8'], Mint: ['#cfe3d0', '#a9c7ae', '#c8603f'], Sky: ['#d3e2ec', '#a9c0d0', '#c9922e'] };
  def({ key: 'dtMidDeco', name: 'Art-deco apartments', cat: 'Downtown homes', budget: 4000, size: '24 × 16 m · 4 floors · 15 m', night: true,
    opts: { colour: choices('Colour', Object.keys(DECO)) },
    make(o) { const g = new THREE.Group(), C = DECO[o.colour] || DECO.Cream, WL = slot('wall', C[0]), TR = C[1], W = 24, D = 16, R = 2.4, fh = 3.3, N = 4, top = 0.5 + N * fh;
      B(g, W + 0.4, 0.5, D + 0.4, TR, 0, 0, 0);
      B(g, W - 2 * R, N * fh, D, WL, 0, 0.5, 0); B(g, W, N * fh, D - 2 * R, WL, 0, 0.5, 0);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => CYL(g, R, R, N * fh, 14, WL, a * (W / 2 - R), 0.5, b * (D / 2 - R), NE));
      for (let f = 1; f <= N; f++) { B(g, W - 2 * R, 0.22, D + 0.3, TR, 0, 0.5 + f * fh - 0.3, 0, FLAT); B(g, W + 0.3, 0.22, D - 2 * R, TR, 0, 0.5 + f * fh - 0.3, 0, FLAT);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => CYL(g, R + 0.15, R + 0.15, 0.22, 14, TR, a * (W / 2 - R), 0.5 + f * fh - 0.3, b * (D / 2 - R), FLAT)); }
      faces(g, W, D, (s, len, i) => windows(s, len - 2 * R, 0.5, N, fh, i < 2 ? 6 : 3, { z: 0.05, seed: i, frame: TR, skip: i === 0 ? (f, k) => k === 2 || k === 3 : null }));
      const e = grp(g, 0, 0, D / 2);                                                         // the entrance bay
      B(e, 6.4, top + 2.2, 1.6, WL, 0, 0, 0.8); [-2.2, 0, 2.2].forEach(x => B(e, 0.5, top + 3.4, 0.5, TR, x, 0, 1.75));
      P(e, 2.0, 2.7, warm, 0, 0.5, 1.62); B(e, 3.4, 0.25, 0.9, TR, 0, 3.4, 2.0); for (let k = 0; k < N - 1; k++) P(e, 2.4, 1.6, (k % 2) ? lit : unlit, 0, 0.5 + (k + 1) * fh + 0.8, 1.62);
      B(e, 4.0, 0.25, 1.2, TR, 0, 0, 2.2); B(e, 3.6, 0.25, 0.6, TR, 0, 0.25, 1.9);
      P(e, 4.2, 0.5, signMat('DECO HOUSE', C[2], '#ffffff', 512, 64), 0, 4.25, 1.62);
      roof(g, W - 2 * R, D - 0.4, top, { parapet: TR, ac: 2, core: false });
      return g; } });

  // E: three townhouses with stoops (raised ground floor, steps up, porch), dark roofs
  def({ key: 'dtRowhouses', name: 'Townhouses (row of 3)', cat: 'Downtown homes', budget: 3500, size: '20 × 12 m · 3 floors · 13 m', night: true,
    make() { const g = new THREE.Group(), cols = ['#5d4a42', '#c9b79a', '#46494f'], trims = ['#e8dcc4', '#6f5a48', '#d9d4cc'], w = 6.6, d = 11, fh = 3.1, rise = 1.1;
      cols.forEach((c, k) => { const x = (k - 1) * w, u = grp(g, x, 0, 0);
        B(u, w - 0.05, rise + 3 * fh, d, c, 0, 0, 0); GABLE(u, w + 0.3, 2.6, d + 0.4, '#3a3d42', 0, rise + 3 * fh, 0);
        const s = grp(u, 0, 0, d / 2);
        for (let f = 0; f < 3; f++) { P(s, 1.5, 1.8, (f + k) % 2 ? lit : unlit, 1.4, rise + f * fh + 0.7, 0.04); B(s, 1.9, 0.15, 0.3, trims[k], 1.4, rise + f * fh + 0.55, 0.1, FLAT); if (f) P(s, 1.5, 1.8, (f + k) % 3 ? unlit : lit, -1.6, rise + f * fh + 0.7, 0.04); }
        P(s, 1.4, 2.4, '#2f2b28', -1.6, rise, 0.04); B(s, 2.4, 0.2, 1.4, trims[k], -1.6, rise + 2.8, 0.7);       // front door + porch roof
        [-2.35, -0.85].forEach(px => B(s, 0.12, 2.8, 0.12, trims[k], px, rise, 1.15, NE));
        for (let st = 0; st < 5; st++) B(s, 1.6, rise / 5 * (st + 1), 0.32, '#b9b3a8', -1.6, 0, 1.4 + (4 - st) * 0.32);   // the stoop: 5 steps up to the door
        B(s, 1.8, rise, 1.25, '#b9b3a8', -1.6, 0, 0.62);                                                       // landing at the door
        [-2.45, -0.75].forEach(px => { B(s, 0.06, 0.06, 1.95, RAILG, px, rise / 2 + 0.85, 2.05, { rx: Math.atan2(rise, 1.6), edge: false }); B(s, 0.06, 0.9, 0.06, RAILG, px, 0.2, 2.8, FLAT); B(s, 0.06, 0.9, 0.06, RAILG, px, rise, 1.25, FLAT); });
        P(s, 1.8, 0.8, unlit, 1.4, 0.15, 0.04);                                                                  // basement window
        P(grp(u, 0, 0, -d / 2, Math.PI), 1.4, 2.4, '#2f2b28', 0, rise, 0.04); });
      return g; } });

  // F: brick / concrete loft, big factory windows, dark steel corner
  const factoryWin = cmat('factorywin', 128, 160, (c, w, h) => { c.fillStyle = '#2f3338'; c.fillRect(0, 0, w, h); c.fillStyle = '#5a7a90'; for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) c.fillRect(6 + k * 40, 6 + r * 38, 36, 34); });
  def({ key: 'dtLoft', name: 'Loft apartments', cat: 'Downtown homes', budget: 3500, size: '22 × 18 m · 4 floors · 17 m', night: true,
    opts: { wall: colours('Wall', ['#a9a49b', '#9b4d3a', '#c9b79a']) },
    make(o) { const g = new THREE.Group(), WL = slot('wall', o.wall || '#a9a49b'), W = 22, D = 18, fh = 4, N = 4, top = N * fh;
      B(g, W, top, D, WL, 0, 0, 0); B(g, 7, top + 0.6, 0.6, '#3b3f44', W / 2 - 3.5, 0, D / 2); B(g, 0.6, top + 0.6, 7, '#3b3f44', W / 2, 0, D / 2 - 3.5);
      faces(g, W, D, (s, len, i) => { const n = i < 2 ? 4 : 3; for (let f = 0; f < N; f++) for (let k = 0; k < n; k++) { if (i === 0 && f === 0 && k === 1) continue; const x = -len / 2 + (k + 0.5) * len / n - (i === 0 ? 1.5 : 0);
          P(s, 3.0, 3.0, factoryWin, x, f * fh + 0.6, 0.06); B(s, 3.4, 0.18, 0.35, '#7a756c', x, f * fh + 0.45, 0.1, FLAT); } });
      const f0 = grp(g, 0, 0, D / 2); P(f0, 2.4, 2.7, warm, -4.75, 0.05, 0.08); B(f0, 4.6, 0.2, 2.0, '#3b3f44', -4.75, 3.2, 1.0); [-6.8, -2.7].forEach(x => B(f0, 0.12, 3.2, 0.12, '#3b3f44', x, 0, 1.9, NE));
      P(f0, 3.6, 0.5, signMat('THE MILL', '#3b3f44', '#f0c36a', 512, 72), -4.75, 3.45, 2.02);
      roof(g, W, D, top, { tank: true, ac: 2 }); for (let k = 0; k < 3; k++) GABLE(g, 2.2, 1.0, 5, '#8fb7c8', 3 + k * 2.6, top + 0.1, 3, { ry: Math.PI / 2 });
      return g; } });

  // ======================= TIMES SQUARE (the commercial blocks by the Tower) =======================
  // big screen tower: dark glass, 3 screens + a vertical one, a news ticker all round, shops below
  def({ key: 'dtScreenTower', name: 'Screen tower', cat: 'Times Square', budget: 9000, size: '22 × 22 m · 18 floors · 67 m', night: true,
    make() { const g = new THREE.Group(), W = 22, D = 22, base = 6.8, N = 17, fh = 3.5, top = base + N * fh;
      B(g, W, base, D, '#2b3036', 0, 0, 0); B(g, W - 1, N * fh, D - 1, '#454e58', 0, base, 0);
      faces(g, W - 1, D - 1, (s, len, i) => { for (let f = 0; f < N; f++) { P(s, len - 0.8, fh * 0.6, (f * 3 + i) % 4 ? unlit : lit, 0, base + f * fh + 0.7, 0.04); } });
      // screens on frames, held off the wall by steel brackets (nothing floats)
      const scr = (s, w, h, y, x, k, z) => { z = z || 0.9; B(s, w + 0.8, h + 0.8, 0.6, '#1c1f24', x, y - 0.4, z - 0.3); P(s, w, h, screenMat(k, 512, Math.round(512 * h / w)), x, y, z + 0.02);
        [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([a, b]) => B(s, 0.3, 0.3, z, STEEL, x + a * w * 0.35, y + h / 2 + b * h * 0.35, z / 2 - 0.4, NE)); };
      faces(g, W - 1, D - 1, (s, len, i) => { if (i === 0) scr(s, 16, 20, 14, 0, 'count'); if (i === 2) scr(s, 14, 16, 22, 0, 'welcome'); if (i === 3) scr(s, 14, 10, 30, 0, 'art'); });
      { const s = grp(g, -(W - 1) / 2, 0, (D - 1) / 2, -Math.PI / 4); B(s, 4.4, 34, 1.4, '#1c1f24', 0, base + 8, 0.7); P(s, 3.6, 32, screenMat('vert', 128, 1024), 0, base + 9, 1.42); }
      faces(g, W, D, (s, len) => { B(s, len + 0.2, 1.8, 0.5, '#121418', 0, base - 0.2, 0.25); P(s, len, 1.4, screenMat('ticker', 2048, 96), 0, base, 0.51); });   // ticker band
      faces(g, W, D, (s, len, i) => { if (i === 0) { shop(s, -6.5, 6.5, 4.6, 'VINLAND STORE', '#c8343a', '#ffffff'); lobby(s, 2, 2.8); shop(s, 7.5, 4.2, 4.6, 'SNACKS', '#f2c14e', '#2f2b28'); }
        else if (i === 1) { P(s, 4, 3.6, STEEL, -4, 0.05, 0.03); P(s, 1.4, 2.4, DARK, 5, 0.05, 0.03); } else shop(s, 0, len - 4, 4.6, i === 2 ? 'GAMES' : 'BOOKS', i === 2 ? '#6a4a8c' : '#2f7a68', '#ffffff'); });
      roof(g, W - 1, D - 1, top, { ac: 4, parapet: '#2b3036' }); B(g, 0.4, 14, 0.4, STEEL, 3, top, -3, NE); BALL(g, 0.5, glowMat('#ff4a3a', '#ff4a3a'), 3, top + 14.4, -3, NE);
      return g; } });

  // mid-size corner block with stacked, offset screens and a blade sign
  def({ key: 'dtScreenCorner', name: 'Corner screens block', cat: 'Times Square', budget: 5000, size: '16 × 16 m · 9 floors · 33 m', night: true,
    make() { const g = new THREE.Group(), W = 16, D = 16, base = 5, N = 8, fh = 3.5, top = base + N * fh;
      B(g, W, base, D, '#2f3338', 0, 0, 0); B(g, W - 0.6, N * fh, D - 0.6, '#5a5f66', 0, base, 0);
      faces(g, W - 0.6, D - 0.6, (s, len, i) => windows(s, len, base, N, fh, 4, { z: 0.04, seed: i, h: 2.0 }));
      const scr = (s, w, h, y, x, k) => { B(s, w + 0.6, h + 0.6, 0.6, '#1c1f24', x, y - 0.3, 0.3); P(s, w, h, screenMat(k, 512, Math.round(512 * h / w)), x, y, 0.62); };
      faces(g, W - 0.6, D - 0.6, (s, len, i) => { if (i === 0) { scr(s, 10, 7, 8, -2, 'theatre'); scr(s, 9, 8, 17, 2.5, 'tower'); } if (i === 2) { scr(s, 11, 9, 12, 0, 'art'); } });
      { const s = grp(g, (W - 0.6) / 2, 0, (D - 0.6) / 2, Math.PI / 4); B(s, 0.4, 0.4, 2.0, STEEL, 0, 9, 1.0, NE); B(s, 0.4, 0.4, 2.0, STEEL, 0, 20, 1.0, NE); B(s, 0.6, 12, 2.4, '#1b1530', 0, 8.5, 2.2);
        P(grp(s, 0.31, 0, 2.2, Math.PI / 2), 2.2, 11.4, screenMat('vert', 128, 1024), 0, 8.8, 0); P(grp(s, -0.31, 0, 2.2, -Math.PI / 2), 2.2, 11.4, screenMat('vert', 128, 1024), 0, 8.8, 0); }
      faces(g, W, D, (s, len, i) => { if (i === 0) { shop(s, -3.5, 7, 4.0, 'PIZZA', '#c8343a', '#fff', { awning: '#2f7a68' }); lobby(s, 4.5, 2.4); } if (i === 2) shop(s, 0, 10, 4.0, 'ICE CREAM', '#d86fb0', '#fff', { awning: '#f6f0e2' }); });
      roof(g, W - 0.6, D - 0.6, top, { ac: 3, parapet: '#2f3338' });
      return g; } });

  // cinema with a lit marquee, a blade sign, posters
  def({ key: 'dtCinema', name: 'Cinema', cat: 'Times Square', budget: 4500, size: '24 × 20 m · 3 floors · 14 m', night: true,
    make() { const g = new THREE.Group(), W = 24, D = 20, H = 14;
      B(g, W, H, D, '#9b4d3a', 0, 0, 0); B(g, W + 0.4, 0.8, D + 0.4, '#e8d5b0', 0, H, 0); B(g, W - 1, 0.1, D - 1, '#8f8a82', 0, H + 0.8, 0, FLAT);
      const f = grp(g, 0, 0, D / 2);
      P(f, 16, 3.0, warm, 0, 0.05, 0.05); for (let k = 0; k < 5; k++) B(f, 0.1, 3.0, 0.08, RAILG, -6.4 + k * 3.2, 0.05, 0.08, FLAT);
      B(f, 20, 2.6, 3.0, '#2f2b28', 0, 3.8, 1.5);                                                           // the marquee (bracketed into the wall)
      P(f, 18, 1.8, signMat('NOW SHOWING · THE FIRST VOTE', '#fff6dc', '#2f2b28', 1024, 100), 0, 4.2, 3.02);
      B(f, 20.2, 0.25, 3.2, glowMat('#ffcf6a', '#ffcf6a'), 0, 3.6, 1.5, NE); B(f, 20.2, 0.25, 3.2, glowMat('#ffcf6a', '#ffcf6a'), 0, 6.4, 1.5, NE);
      P(f, 12, 2.4, signMat('CINEMA', '#c8343a', '#ffe9a8', 512, 100, true), 0, 7.2, 0.06);
      [-9, 9].forEach(x => { B(f, 2.4, 3.6, 0.15, '#2f2b28', x, 8.5, 0.1); P(f, 2.0, 3.2, screenMat(x < 0 ? 'art' : 'theatre', 128, 200), x, 8.7, 0.2); });
      const bl = grp(g, W / 2 - 2, 0, D / 2); B(bl, 0.3, 0.3, 1.2, STEEL, 0, 8, 0.6, NE); B(bl, 0.3, 0.3, 1.2, STEEL, 0, 13, 0.6, NE); B(bl, 0.7, 8, 2.2, '#c8343a', 0, 6.5, 2.2);
      [0.36, -0.36].forEach(dx => P(grp(bl, dx, 0, 2.2, dx > 0 ? Math.PI / 2 : -Math.PI / 2), 2.0, 7.6, cmat('blade', 64, 256, (c, w, h) => { c.fillStyle = '#c8343a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe9a8'; c.textAlign = 'center'; c.font = font(40); 'CINEMA'.split('').forEach((l, i) => c.fillText(l, w / 2, 40 + i * 40)); }, true), 0, 6.7, 0));
      P(grp(g, W / 2, 0, -D / 4, Math.PI / 2), 1.4, 2.4, DARK, 0, 0.05, 0.03); P(grp(g, 0, 0, -D / 2, Math.PI), 3.6, 3.2, STEEL, 4, 0.05, 0.03);   // exits + loading door
      return g; } });

  // red steps: a seating stair to sit and watch the screens. Side walls, rails, lamps at the top.
  def({ key: 'dtRedSteps', name: 'Red steps (seating)', cat: 'Times Square', budget: 1500, size: '16 × 13 m · 5.4 m high', night: true,
    make() { const g = new THREE.Group(), n = 12, sh = 0.45, sd = 1.05, W = 16, RED = '#c8343a';
      for (let k = 0; k < n; k++) { B(g, W, sh * (k + 1), sd, k % 2 ? RED : '#b52e33', 0, 0, n * sd / 2 - (k + 0.5) * sd); }
      [-1, 1].forEach(a => { B(g, 0.6, n * sh + 1.1, n * sd, '#8f8a82', a * (W / 2 + 0.3), 0, 0); });
      [-W / 4, W / 4].forEach(x => { for (let k = 0; k < n; k++) B(g, 0.06, 0.9, 0.06, RAILG, x, sh * (k + 1), n * sd / 2 - (k + 0.5) * sd, FLAT); B(g, 0.08, 0.08, n * sd * 1.03, RAILG, x, n * sh / 2 + 0.9, 0, { rx: Math.atan(sh / sd), edge: false }); });
      B(g, W + 1.2, 1.1, 0.25, '#8f8a82', 0, n * sh, -n * sd / 2 + 0.12);                                    // back wall at the top
      [-W / 2 + 0.3, W / 2 - 0.3].forEach(x => { B(g, 0.2, 4.5, 0.2, STEEL, x, n * sh + 1.1, -n * sd / 2 + 0.6, NE); BALL(g, 0.4, glowMat('#fff3c4', '#fff3c4'), x, n * sh + 5.8, -n * sd / 2 + 0.6, NE); });
      return g; } });

  // metro entrance: stairs going down between low walls, under a glass canopy
  def({ key: 'dtMetroEntrance', name: 'Metro entrance', cat: 'Times Square', budget: 900, size: '5 × 9 m · canopy 3.4 m', night: true,
    make() { const g = new THREE.Group(), W = 4.2, L = 8.4;
      B(g, W, 0.04, L, '#16181c', 0, 0, 0, FLAT); for (let k = 0; k < 10; k++) B(g, W - 0.2, 0.03, 0.12, k < 5 ? '#6b6e74' : '#3a3d42', 0, 0.04, L / 2 - 0.6 - k * 0.7, FLAT);   // the stairs going down (painted into the opening)
      [-1, 1].forEach(a => { B(g, 0.35, 1.05, L + 0.35, '#b9b3a8', a * (W / 2 + 0.17), 0, -0.17); rail(a); }); B(g, W + 0.7, 1.05, 0.35, '#b9b3a8', 0, 0, -L / 2 - 0.17);
      function rail(a) { B(g, 0.06, 0.06, L, STEEL, a * (W / 2 + 0.17), 1.4, -0.17, FLAT); for (let k = 0; k < 4; k++) B(g, 0.05, 0.35, 0.05, STEEL, a * (W / 2 + 0.17), 1.05, L / 2 - 0.5 - k * 2.4, FLAT); }
      [[-1, -1], [1, -1], [-1, 0.6], [1, 0.6]].forEach(([a, b]) => B(g, 0.16, 3.4, 0.16, STEEL, a * (W / 2 + 0.17), 0, b * L / 2.2, NE));
      const cg = (() => { const m = toon('#9fd0e0'); m.transparent = true; m.opacity = 0.45; m.side = THREE.DoubleSide; return m; })();
      B(g, W + 1.2, 0.12, L * 0.85, cg, 0, 3.4, -0.7, NE); B(g, W + 1.3, 0.2, 0.2, STEEL, 0, 3.4, L * 0.21 + 0.1, NE);
      P(g, 3, 0.7, signMat('METRO', '#2e4c86', '#ffffff', 256, 64, true), 0, 2.6, L * 0.27);
      return g; } });

  // colourful bus shelter
  def({ key: 'dtShelter', name: 'Colour bus shelter', cat: 'Times Square', budget: 400, size: '6 × 1.8 m · 2.8 m', night: true,
    make() { const g = new THREE.Group(), cg = railGlass;
      [-2.8, 2.8].forEach(x => { B(g, 0.14, 2.7, 0.14, STEEL, x, 0, -0.75, NE); B(g, 0.14, 2.7, 0.14, STEEL, x, 0, 0.75, NE); });
      ['#e8473a', '#f2c14e', '#2f9a6a', '#3f7fbf', '#8a5ab0'].forEach((c, k) => B(g, 1.2, 0.14, 2.0, c, -2.4 + k * 1.2, 2.7, 0, NE));
      P(g, 5.4, 2.0, cg, 0, 0.4, -0.75); P(grp(g, -2.8, 0, 0, -Math.PI / 2), 1.4, 2.0, cg, 0, 0.4, 0); B(g, 3.2, 0.1, 0.45, '#7a4f34', -0.6, 0.45, -0.45); B(g, 0.1, 0.45, 0.4, STEEL, -2, 0, -0.45, NE); B(g, 0.1, 0.45, 0.4, STEEL, 0.8, 0, -0.45, NE);
      B(g, 1.2, 2.0, 0.2, '#2f2b28', 2.1, 0.3, -0.75); P(g, 1.05, 1.8, screenMat('welcome', 128, 220), 2.1, 0.4, -0.64);
      B(g, 0.1, 3.0, 0.1, STEEL, 3.3, 0, 0.9, NE); P(g, 0.6, 0.6, signMat('BUS', '#2e4c86', '#fff', 64, 64), 3.3, 2.5, 0.96);
      return g; } });

  // digital info pillar + ticket machine
  def({ key: 'dtInfoPillar', name: 'Info pillar + ticket machine', cat: 'Times Square', budget: 300, size: '0.9 × 0.5 m · 2.4 m', night: true,
    make() { const g = new THREE.Group();
      B(g, 0.9, 2.4, 0.5, '#2f3338', -0.7, 0, 0); P(g, 0.7, 1.3, screenMat('tower', 128, 230), -0.7, 0.9, 0.26); P(g, 0.7, 0.3, signMat('i  CITY MAP', '#2e4c86', '#fff', 128, 48), -0.7, 2.0, 0.26);
      B(g, 0.8, 1.7, 0.6, '#2e4c86', 0.6, 0, 0); P(g, 0.5, 0.4, screenMat('ticker', 128, 96), 0.6, 1.15, 0.31); B(g, 0.4, 0.06, 0.15, '#c9ced2', 0.6, 0.8, 0.35, FLAT); B(g, 0.9, 0.08, 0.7, '#1c1f24', 0.6, 1.7, 0);
      return g; } });

  // crowd barriers (two colours)
  def({ key: 'dtBarrier', name: 'Crowd barriers', cat: 'Times Square', budget: 300, size: '2.4 m each · 1.1 m', opts: { body: colours('Colour', ['#c9ced2', '#f2c14e', '#c8343a', '#3f7fbf']) },
    make(o) { const g = new THREE.Group(), C = slot('body', o.body || '#c9ced2');
      [-1.3, 1.3].forEach((x0, n) => { const u = grp(g, x0, 0, 0, n ? 0.25 : -0.1); [-1.15, 1.15].forEach(x => { B(u, 0.06, 1.1, 0.06, C, x, 0, 0, FLAT); B(u, 0.08, 0.04, 0.7, C, x, 0, 0, FLAT); });
        B(u, 2.3, 0.05, 0.05, C, 0, 1.08, 0, FLAT); B(u, 2.3, 0.05, 0.05, C, 0, 0.2, 0, FLAT); for (let k = 0; k < 9; k++) B(u, 0.03, 0.88, 0.03, C, -1.0 + k * 0.25, 0.2, 0, FLAT); });
      return g; } });

  // a set of neon signs to hang on shop fronts: blade, hanging board, "OPEN"
  def({ key: 'dtNeonSigns', name: 'Neon signs (set)', cat: 'Times Square', budget: 400, size: 'blade 1 × 4 m · board 3 × 1.2 m', night: true,
    make() { const g = new THREE.Group();
      B(g, 0.3, 6, 0.3, STEEL, -3, 0, 0, NE); B(g, 1.4, 0.15, 0.15, STEEL, -2.4, 5.6, 0, NE); B(g, 0.25, 4, 1.0, '#1b1530', -1.9, 1.6, 0);
      P(grp(g, -1.77, 0, 0, Math.PI / 2), 0.9, 3.8, screenMat('vert', 128, 540), 0, 1.7, 0);
      B(g, 0.2, 4.6, 0.2, STEEL, 0.5, 0, 0, NE); B(g, 0.2, 4.6, 0.2, STEEL, 3.5, 0, 0, NE); B(g, 3.4, 1.4, 0.2, '#1c1f24', 2, 3.2, 0);
      P(g, 3.1, 1.15, signMat('CITY LIGHTS', '#1c1f24', '#7ee0ff', 512, 190, true), 2, 3.32, 0.11);
      B(g, 3.0, 0.7, 0.12, '#1c1f24', 2, 1.6, 0); P(g, 1.4, 0.55, signMat('OPEN', '#1c1f24', '#ff5ad1', 256, 100, true), 2, 1.67, 0.07);
      return g; } });

  // ======================= OFFICE DISTRICT =======================
  // the tallest office: stone base with a revolving door, glass shaft, a helipad on the roof
  def({ key: 'dtOfficeHeli', name: 'Office tower (helipad)', cat: 'Office district', budget: 6000, size: '28 × 28 m · 26 floors · 106 m', night: true,
    make() { const g = new THREE.Group(), W = 28, base = 8, N = 26, top = base + N * OF;
      B(g, W, base, W, '#d9d2c4', 0, 0, 0); for (let k = 0; k < 6; k++) [0, 1, 2, 3].forEach(i => { const s = grp(g, 0, 0, 0, i * Math.PI / 2); B(s, 0.9, base, 0.6, '#ece6da', -W / 2 + 2.5 + k * 4.6, 0, W / 2 + 0.3); });
      const cw = curtain(N, 8, '#3f6a85', '#2b3540', 'heli');
      B(g, W - 2, N * OF, W - 2, '#2b3540', 0, base, 0); faces(g, W - 2, W - 2, s => P(s, W - 2.2, N * OF - 0.4, cw, 0, base + 0.2, 0.03));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 0.8, N * OF + 2, 0.8, '#c9ced2', a * (W / 2 - 1.4), base, b * (W / 2 - 1.4), NE));
      faces(g, W, W, (s, len, i) => { if (i === 0) { P(s, 14, 5.6, warm, 0, 0.6, 0.03); B(s, 16, 0.4, 3.6, '#d9d2c4', 0, 6.2, 1.8);
          CYL(s, 1.6, 1.6, 2.8, 16, (() => { const m = toon('#9fd0e0'); m.transparent = true; m.opacity = 0.6; return m; })(), 0, 0, 1.6); CYL(s, 1.7, 1.7, 0.3, 16, STEEL, 0, 2.8, 1.6, NE);
          P(s, 8, 0.8, signMat('VINLAND TRADE CENTRE', '#2b3540', '#f0c36a', 1024, 100), 0, 7.0, 0.62); }
        else P(s, len - 6, 4, warm, 0, 1.6, 0.03); });
      B(g, W - 1.6, 1.6, W - 1.6, '#c9ced2', 0, top, 0);                                                     // crown
      const y = top + 1.6; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 0.5, 1.6, 0.5, STEEL, a * 6, y, b * 6, NE));
      CYL(g, 9.5, 9.5, 0.4, 24, '#5b5f66', 0, y + 1.6, 0);
      P(grp(g, 0, y + 2.02, 0), 16, 16, cmat('helipad', 256, 256, (c, w, h) => { c.fillStyle = '#5b5f66'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f2c14e'; c.lineWidth = 10; c.beginPath(); c.arc(w / 2, h / 2, w * 0.4, 0, 7); c.stroke();
        c.fillStyle = '#f6f0e2'; c.font = font(140); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', w / 2, h / 2 + 8); }), 0, -8, 0, { rx: -Math.PI / 2 });
      for (let k = 0; k < 8; k++) BALL(g, 0.25, glowMat('#7ee07e', '#7ee07e'), Math.cos(k * Math.PI / 4) * 9.2, y + 2.05, Math.sin(k * Math.PI / 4) * 9.2, NE);
      return g; } });

  // six-sided glass tower that widens, a garden terrace, solar roof
  def({ key: 'dtOfficeSolar', name: 'Office tower (solar crown)', cat: 'Office district', budget: 3000, size: '24 m wide · 15 floors · 58 m', night: true,
    make() { const g = new THREE.Group(), cw = curtain(9, 12, '#4f8fa8', '#2f3e4a', 'solar'), cw2 = curtain(5, 12, '#4f8fa8', '#2f3e4a', 'solar2');
      CYL(g, 12, 12, 1.0, 6, '#c9ced2', 0, 0, 0, { ry: Math.PI / 6 }); CYL(g, 10.6, 10.6, 5, 6, '#2f3e4a', 0, 1, 0, { ry: Math.PI / 6 }); P(grp(g, 0, 0, 9.2), 9, 4, warm, 0, 1.2, 0);      // lobby
      CYL(g, 12, 9.5, 9 * OF, 6, cw, 0, 6, 0, { ry: Math.PI / 6 }); CYL(g, 12.6, 12.6, 0.5, 6, '#c9ced2', 0, 6 + 9 * OF, 0, { ry: Math.PI / 6 });
      const y1 = 6.5 + 9 * OF; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; B(g, 3, 0.7, 1.2, '#8a7a66', Math.cos(a) * 10.4, y1, Math.sin(a) * 10.4, { ry: -a + Math.PI / 2 }); ICO(g, 0.8, 0, PAL.leaf, Math.cos(a) * 10.4, y1 + 1.3, Math.sin(a) * 10.4, NE); }
      CYL(g, 9, 9, 5 * OF, 6, cw2, 0, y1, 0, { ry: Math.PI / 6 }); const y2 = y1 + 5 * OF; CYL(g, 9.6, 9.6, 0.8, 6, '#c9ced2', 0, y2, 0, { ry: Math.PI / 6 });
      for (let r = -2; r <= 2; r++) for (let k = -2; k <= 2; k++) { if (Math.hypot(r, k) > 2.4) continue; B(g, 2.6, 0.1, 2.2, '#22344f', r * 2.9, y2 + 1.4, k * 2.6, { rx: -0.35 }); B(g, 0.15, 1.2, 0.15, STEEL, r * 2.9, y2 + 0.8, k * 2.6 + 0.6, NE); }
      return g; } });

  // stepped offices with roof terraces (umbrellas, tables, planters)
  def({ key: 'dtOfficeTerrace', name: 'Offices with roof terraces', cat: 'Office district', budget: 4500, size: '30 × 26 m · 6 + 9 floors · 34 m', night: true,
    make() { const g = new THREE.Group(), cw = curtain(6, 10, '#4a7590', '#33383f', 'terrA'), cw2 = curtain(9, 6, '#4a7590', '#33383f', 'terrB');
      const A = { W: 30, D: 16, N: 6, x: 0, z: 5 }, Bk = { W: 14, D: 14, N: 9, x: -8, z: -6 };
      [[A, cw], [Bk, cw2]].forEach(([b, m]) => { const h = b.N * OF + 1; B(g, b.W, h, b.D, '#33383f', b.x, 0, b.z); const s = grp(g, b.x, 0, b.z); faces(s, b.W, b.D, (f, len) => P(f, len - 0.4, h - 1.6, m, 0, 1.4, 0.03)); });
      faces(grp(g, 0, 0, 5), 30, 16, (s, len, i) => { if (i === 0) { P(s, 10, 3.2, warm, 0, 0.1, 0.05); B(s, 12, 0.3, 2.6, '#c9ced2', 0, 3.4, 1.3); P(s, 6, 0.6, signMat('NORTH STAR OFFICES', '#33383f', '#f6f0e2', 512, 64), 0, 3.75, 2.62); } });
      const y = A.N * OF + 1, ty = (() => { const m = toon('#b79b7a'); return m; })();
      B(g, 15, 0.15, 15.4, ty, 7, y, 5, FLAT); faces(grp(g, 7, 0, 5), 15, 15.4, (s, len) => { P(s, len, 1.1, railGlass, 0, y + 0.15, -0.1); });
      [[3, 2], [10, 2], [6.5, 8]].forEach(([x, z], ui) => { B(g, 0.1, 2.3, 0.1, STEEL, x, y, z, NE); CYL(g, 0.01, 1.6, 0.6, 8, ['#e8473a', '#f6f0e2', '#2f7a68'][ui], x, y + 2.3, z, NE); CYL(g, 0.6, 0.6, 0.06, 10, '#f6f0e2', x, y + 0.75, z, NE); B(g, 0.1, 0.75, 0.1, STEEL, x, y, z, NE);
        [[-1, 0], [1, 0]].forEach(([a]) => B(g, 0.45, 0.45, 0.45, '#7a4f34', x + a * 1.0, y, z, NE)); });
      [[0.5, -2.2], [13.5, -2.2], [13.5, 11.8]].forEach(([x, z]) => { B(g, 1.0, 0.8, 1.0, '#8a7a66', x, y, z); ICO(g, 0.7, 0, PAL.leaf2, x, y + 1.3, z, NE); });
      roof(grp(g, -8, 0, -6), 14, 14, Bk.N * OF + 1, { ac: 2, parapet: '#33383f' });
      return g; } });

  // glass box on columns: open, shaded ground floor with a lobby core
  def({ key: 'dtOfficeStilts', name: 'Offices on columns', cat: 'Office district', budget: 3000, size: '26 × 18 m · 5 floors on 6 m columns · 27 m', night: true,
    make() { const g = new THREE.Group(), W = 26, D = 18, lift = 6, N = 5, cw = curtain(5, 10, '#5a8ca8', '#2f3e4a', 'stilts');
      B(g, W, 0.2, D, '#c9c4ba', 0, 0, 0, FLAT);
      for (let a = -1; a <= 1; a++) [-1, 1].forEach(b => B(g, 1.0, lift, 1.0, '#e4e1da', a * (W / 2 - 3), 0.2, b * (D / 2 - 2.5)));
      B(g, 8, lift - 0.2, 6, '#2f3e4a', 0, 0.2, 0); P(grp(g, 0, 0, 3.02), 6.5, 3.2, warm, 0, 0.25, 0); P(grp(g, 0, 0, 3.02), 4, 0.6, signMat('LOBBY', '#2f3e4a', '#fff', 256, 64), 0, 3.8, 0.01);
      B(g, W, 0.8, D, '#e4e1da', 0, lift, 0); B(g, W - 0.4, N * OF, D - 0.4, '#2f3e4a', 0, lift + 0.8, 0); faces(g, W - 0.4, D - 0.4, (s, len) => P(s, len - 0.2, N * OF - 0.3, cw, 0, lift + 0.95, 0.03));
      roof(g, W - 0.4, D - 0.4, lift + 0.8 + N * OF, { ac: 3, parapet: '#e4e1da' });
      return g; } });

  // multi-storey car park: open decks, P signs, a barrier at the gate, cars on the roof
  def({ key: 'dtCarPark', name: 'Car park (4 decks)', cat: 'Office district', budget: 6000, size: '36 × 26 m · 4 decks + roof · 13 m', night: true,
    make() { const g = new THREE.Group(), W = 36, D = 26, N = 4, fh = 3.0, C = '#d8d3c9';
      for (let f = 0; f <= N; f++) { B(g, W, 0.4, D, C, 0, f * fh, 0); if (f) faces(g, W, D, (s, len, i) => { if (!(i === 0 && f === 0)) B(s, len, 1.1, 0.25, '#e8e4db', 0, f * fh + 0.4, 0.12); }); }
      for (let a = -3; a <= 3; a++) [-1, 0, 1].forEach(b => B(g, 0.6, N * fh, 0.6, '#c9c4ba', a * 5.5, 0.4, b * 10.5));
      B(g, 4, N * fh + 3.6, 5, '#2e4c86', W / 2 - 2, 0, -D / 2 + 2.5); P(grp(g, W / 2 - 2, 0, -D / 2 + 5.01), 1.3, 2.4, warm, 0, 0.4, 0);   // stair + lift tower
      P(grp(g, W / 2 + 0.01, 0, -D / 2 + 2.5, Math.PI / 2), 3, 3, signMat('P', '#2e4c86', '#ffffff', 128, 128, true), 0, N * fh, 0);
      const top = N * fh + 0.4; for (let k = -6; k <= 6; k++) { B(g, 0.15, 0.02, 5, '#f6f0e2', k * 2.6, top, -7, FLAT); B(g, 0.15, 0.02, 5, '#f6f0e2', k * 2.6, top, 7, FLAT); }
      [[-6.5, -7, 'carSedan', '#3f7fbf'], [1.3, -7, 'carHatch', '#c8603f'], [-3.9, 7, 'carSUV', '#2f2b28'], [6.5, 7, 'carSedan', '#f6f0e2']].forEach(([x, z, k, c]) => { if (K[k]) { const car = K[k]({ body: c }); car.position.set(x, top, z); car.rotation.y = z < 0 ? 0 : Math.PI; g.add(car); } });
      [-W / 2 + 3, W / 2 - 8].forEach(x => { B(g, 0.15, 5, 0.15, STEEL, x, top, 0, NE); B(g, 0.9, 0.25, 0.4, glowMat('#fff3c4', '#fff3c4'), x, top + 5, 0, NE); });
      const e = grp(g, -W / 2 + 6, 0, D / 2); B(e, 1.6, 2.4, 1.6, '#2e4c86', -4, 0, 1.8); P(e, 1.0, 0.7, warm, -4, 1.3, 2.62);           // gate booth + barrier
      B(e, 0.4, 1.1, 0.4, '#2f2b28', -2.8, 0, 1.8); for (let k = 0; k < 5; k++) B(e, 0.9, 0.12, 0.12, k % 2 ? '#c8343a' : '#f6f0e2', -2.2 + k * 0.9, 1.0, 1.8, FLAT);
      B(e, 0.12, 3.2, 0.12, STEEL, 3.8, 0, 2.0, NE); P(e, 1.2, 1.2, signMat('P', '#2e4c86', '#fff', 128, 128), 3.8, 2.4, 2.07);
      return g; } });

  // office plaza: paving, a square fountain, planter benches with trees, café tables, a sculpture
  def({ key: 'dtOfficePlaza', name: 'Office plaza + fountain', cat: 'Office district', budget: 3500, size: '30 × 30 m', night: true,
    make() { const g = new THREE.Group(), S = 30;
      B(g, S, 0.15, S, '#d9d2c4', 0, 0, 0, FLAT); for (let k = -3; k <= 3; k++) { B(g, S, 0.02, 0.25, '#c4bba9', 0, 0.15, k * 4.2, FLAT); B(g, 0.25, 0.02, S, '#c4bba9', k * 4.2, 0.15, 0, FLAT); }
      B(g, 9, 0.6, 9, '#b9b3a8', 0, 0.15, 0); B(g, 8.2, 0.1, 8.2, (() => { const m = toon('#6fb3cc'); return m; })(), 0, 0.6, 0, FLAT);
      [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, 0]].forEach(([x, z], k) => CYL(g, 0.15, 0.35, k === 4 ? 3.4 : 1.8, 8, glowMat('#cfeef7', '#bfe6ff'), x, 0.7, z, NE));
      [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(([x, z]) => { B(g, 5, 0.55, 1.6, '#b9b3a8', x, 0.15, z); B(g, 4.6, 0.1, 1.2, PAL.grass, x, 0.7, z, FLAT); tree(g, x, 0.7, z, 'leaf', 0.8); B(g, 5, 0.08, 0.5, '#7a4f34', x, 0.6, z + (z < 0 ? 1.05 : -1.05), FLAT); });
      [[-10, 0], [10, 0]].forEach(([x, z]) => { B(g, 0.1, 2.3, 0.1, STEEL, x, 0.15, z, NE); CYL(g, 0.01, 1.5, 0.5, 8, '#2f7a68', x, 2.45, z, NE); CYL(g, 0.55, 0.55, 0.06, 10, '#f6f0e2', x, 0.85, z, NE); B(g, 0.1, 0.7, 0.1, STEEL, x, 0.15, z, NE);
        [-1, 1].forEach(a => B(g, 0.45, 0.45, 0.45, '#7a4f34', x + a, 0.15, z, NE)); });
      const sc = grp(g, 0, 0.15, -12); B(sc, 1.6, 1.0, 1.6, '#e9e4da', 0, 0, 0); B(sc, 0.7, 2.4, 0.7, '#c9922e', -0.2, 1.0, 0, { rz: 0.25 }); B(sc, 0.7, 2.2, 0.7, '#c9922e', 0.3, 2.9, 0.1, { rz: -0.35 }); BALL(sc, 0.5, '#c9922e', 0.1, 5.4, 0);
      return g; } });

  // flags (Vinland colours only), boom gate, EV chargers, a stone sign
  def({ key: 'dtFlags', name: 'Flag poles (Vinland)', cat: 'Office district', budget: 300, size: '3 poles · 10 m', make() { const g = new THREE.Group();
      [['#2f7a68', '#f6f0e2'], ['#c8603f', '#f7ecd6'], ['#2e4c86', '#f2c14e']].forEach(([a, b], k) => { const x = (k - 1) * 2.4; B(g, 0.8, 0.3, 0.8, '#b9b3a8', x, 0, 0); CYL(g, 0.06, 0.09, 10, 8, '#c9ced2', x, 0.3, 0, NE); BALL(g, 0.14, '#c9922e', x, 10.35, 0, NE);
        P(g, 2.4, 1.5, cmat('flag' + k, 96, 60, (c, w, h) => { c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b; c.fillRect(0, h * 0.4, w, h * 0.2); c.beginPath(); c.arc(w * 0.3, h / 2, h * 0.22, 0, 7); c.fill(); }), x + 1.25, 8.4, 0, { ry: 0 }); });
      return g; } });
  def({ key: 'dtBoomGate', name: 'Barrier gate + booth', cat: 'Office district', budget: 300, size: '6 m arm · booth 2 × 2 m', night: true,
    make() { const g = new THREE.Group(); B(g, 2, 2.6, 2, '#e4e1da', -3.4, 0, 0); P(g, 1.4, 0.9, warm, -3.4, 1.2, 1.01); B(g, 2.4, 0.2, 2.4, '#2f3e4a', -3.4, 2.6, 0);
      B(g, 0.4, 1.1, 0.4, '#2f2b28', -2, 0, 0); for (let k = 0; k < 6; k++) B(g, 0.9, 0.12, 0.12, k % 2 ? '#c8343a' : '#f6f0e2', -1.4 + k * 0.9, 0.95, 0, FLAT); B(g, 0.2, 0.9, 0.2, STEEL, 3.6, 0, 0, NE); return g; } });
  def({ key: 'dtEvCharger', name: 'EV chargers', cat: 'Office district', budget: 300, size: '2 chargers · 1.6 m', night: true,
    make() { const g = new THREE.Group(); B(g, 3.4, 0.15, 1.2, '#c9c4ba', 0, 0, 0, FLAT);
      [-0.9, 0.9].forEach(x => { B(g, 0.55, 1.6, 0.35, '#e4e1da', x, 0.15, 0); P(g, 0.36, 0.3, screenMat('welcome', 64, 54), x, 1.1, 0.18); B(g, 0.6, 0.08, 0.4, '#2f9a6a', x, 1.75, 0, FLAT); B(g, 0.08, 0.6, 0.08, '#2f2b28', x + 0.2, 0.55, 0.22, FLAT); });
      [-1.6, 1.6].forEach(x => CYL(g, 0.1, 0.1, 0.9, 8, '#f2c14e', x, 0.15, 0.4, NE)); return g; } });
  def({ key: 'dtStoneSign', name: 'Office park sign', cat: 'Office district', budget: 200, size: '3 × 0.5 m · 1.6 m',
    make() { const g = new THREE.Group(); B(g, 3.2, 0.25, 0.8, '#b9b3a8', 0, 0, 0); B(g, 3.0, 1.4, 0.5, '#e9e4da', 0, 0.25, 0); P(g, 2.6, 0.7, signMat('OFFICE DISTRICT', '#e9e4da', '#2f3e4a', 512, 120), 0, 0.55, 0.26);
      B(g, 3.6, 0.5, 1.0, PAL.leaf, 0, 0, -0.9, NE); return g; } });

  // ======================= STREET (extras; the rest comes from the kit: lights, lamps, hydrants, crossings, bins, benches) =======================
  def({ key: 'dtTwinLamp', name: 'Twin street lamp', cat: 'Downtown street', budget: 150, size: '8 m tall', night: true,
    make() { const g = new THREE.Group(), on = glowMat('#fff3c4', '#fff3c4'); B(g, 0.5, 0.4, 0.5, STEEL, 0, 0, 0, NE); CYL(g, 0.09, 0.14, 8, 8, STEEL, 0, 0.4, 0, NE);
      [-1, 1].forEach(a => { B(g, 1.6, 0.1, 0.1, STEEL, a * 0.8, 8.2, 0, NE); B(g, 0.7, 0.18, 0.35, STEEL, a * 1.6, 8.0, 0, NE); B(g, 0.6, 0.06, 0.28, on, a * 1.6, 7.95, 0, NE); }); return g; } });
  def({ key: 'dtRecycleBins', name: 'Recycling bins', cat: 'Downtown street', budget: 150, size: '2 bins · 1.2 m',
    make() { const g = new THREE.Group(); [['#2e4c86', -0.45], ['#2f7a68', 0.45]].forEach(([c, x]) => { B(g, 0.75, 1.05, 0.8, c, x, 0.08, 0); B(g, 0.8, 0.08, 0.86, c, x, 1.13, -0.02);
      CYL(g, 0.08, 0.08, 0.06, 8, '#1e1e22', x - 0.25, 0, -0.35, NE); CYL(g, 0.08, 0.08, 0.06, 8, '#1e1e22', x + 0.25, 0, -0.35, NE); B(g, 0.2, 0.08, 0.6, '#1e1e22', x, 0, 0.2, FLAT); }); return g; } });
  def({ key: 'dtRoadSigns', name: 'Road signs (set)', cat: 'Downtown street', budget: 150, size: '3 signs · 2.6 m',
    make() { const g = new THREE.Group(); [['noentry', -1.2], ['warn', 0], ['park', 1.2]].forEach(([k, x]) => { B(g, 0.08, 2.6, 0.08, STEEL, x, 0, 0, NE);
      P(g, 0.75, 0.75, cmat('road' + k, 96, 96, (c, w) => { c.clearRect(0, 0, w, w);
        if (k === 'noentry') { c.fillStyle = '#c8343a'; c.beginPath(); c.arc(48, 48, 46, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(16, 40, 64, 16); }
        if (k === 'warn') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, w); c.fillStyle = '#c8343a'; c.beginPath(); c.moveTo(48, 4); c.lineTo(92, 88); c.lineTo(4, 88); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(48, 24); c.lineTo(76, 78); c.lineTo(20, 78); c.fill(); c.fillStyle = '#2f2b28'; c.fillRect(44, 40, 8, 22); c.fillRect(44, 66, 8, 7); }
        if (k === 'park') { c.fillStyle = '#2e4c86'; c.fillRect(0, 0, w, w); c.fillStyle = '#fff'; c.font = font(70); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 48, 52); } }), x, 2.1, 0.05); });
      g.traverse(m => { if (m.isMesh && m.material.map && !m.material.alphaTest) { m.material.transparent = true; m.material.alphaTest = 0.5; m.material.side = THREE.DoubleSide; } });
      return g; } });
  def({ key: 'dtStreetTree', name: 'Street tree in grate', cat: 'Downtown street', budget: 300, size: '1.6 m grate · 6 m tree',
    make() { const g = new THREE.Group(); B(g, 1.6, 0.05, 1.6, '#3a3d42', 0, 0, 0, FLAT); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(g, 0.06, 1.1, 0.06, STEEL, a * 0.6, 0.05, b * 0.6, FLAT)); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b]) => B(g, a ? 0.05 : 1.26, 0.06, b ? 0.05 : 1.26, STEEL, a * 0.6, 1.1, b * 0.6, FLAT)); tree(g, 0, 0.05, 0, 'leaf', 1.05); return g; } });
  def({ key: 'dtPlanterBench', name: 'Planter bench', cat: 'Downtown street', budget: 250, size: '3.6 × 1.2 m',
    make() { const g = new THREE.Group(); B(g, 3.6, 0.55, 1.2, '#b9b3a8', 0, 0, 0); B(g, 3.3, 0.12, 0.9, PAL.grass, 0, 0.55, 0, FLAT); ICO(g, 0.5, 0, PAL.leaf, -1.1, 0.95, 0, NE); ICO(g, 0.6, 0, PAL.leaf2, 0, 1.0, 0, NE); ICO(g, 0.5, 0, PAL.leaf, 1.1, 0.95, 0, NE);
      B(g, 3.6, 0.08, 0.45, '#7a4f34', 0, 0.48, 0.8, FLAT); [-1.5, 1.5].forEach(x => B(g, 0.1, 0.48, 0.35, STEEL, x, 0, 0.8, NE)); return g; } });

  // pieces from the main kit that Downtown uses as they are (listed so Dev can check them here too)
  [['dtUseTrafficLight', 'trafficLight', 'Traffic light (kit)'], ['dtUseLamp', 'streetLamp', 'Street lamp (kit)'], ['dtUseCrossing', 'zebraCrossing', 'Zebra crossing (kit)'], ['dtUseHydrant', 'hydrant', 'Hydrant (kit)'],
   ['dtUseBusStop', 'busStop', 'Bus stop (kit)'], ['dtUseBench', 'bench', 'Bench (kit)'], ['dtUseBin', 'dustbin', 'Dustbin (kit)'], ['dtUseFoodCart', 'foodCart', 'Food cart (kit)'], ['dtUseKiosk', 'bmKiosk', 'News kiosk (kit)'], ['dtUseTaxi', 'carTaxi', 'Taxi (kit)'], ['dtUseBus', 'bus', 'Bus (kit)']]
    .forEach(([key, src, name]) => { const e = K.list.find(x => x.key === src); if (e) def(Object.assign({}, e, { key, name, cat: 'Downtown street (from the kit)' })); });
})(typeof window !== 'undefined' ? window : this);
