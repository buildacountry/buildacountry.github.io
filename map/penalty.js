// Vinland · PENALTY SHOOTOUT (16 Nov). Opened from the National Stadium card. Single player, 5 kicks a round.
// The keeper's dive comes from Supabase (`social` → game_start / game_play, game 'pen'), so a score can't be typed in. Without a login
// (or before the server part is live) it runs as a practice round with the same keeper rules, clearly marked "not counted".
// One small scene, drawn only while open; the map's own loop sleeps meanwhile. Works with touch (swipe) and mouse (drag).
(function () {
  const GW = 3.66, GH = 2.44, SPOT = 11, ROUND = 5;
  const css = `#pen *{box-sizing:border-box}#pen{position:fixed;inset:0;z-index:9000;background:#9fc7e8;font-family:Poppins,system-ui,sans-serif;color:#fff;touch-action:none;user-select:none;-webkit-user-select:none}
#pen canvas{display:block;width:100%;height:100%}
#pen .ptop{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(#1f2f5acc,#1f2f5a00)}
#pen .dots{display:flex;gap:6px;flex:1}#pen .dot{width:22px;height:22px;border-radius:50%;border:2px solid #ffffffaa;font-size:12px;line-height:18px;text-align:center;font-weight:800}
#pen .dot.g{background:#2f9a5a;border-color:#2f9a5a}#pen .dot.m{background:#c8463a;border-color:#c8463a}
#pen .x{background:#ffffff22;border:0;color:#fff;font-size:20px;width:38px;height:38px;border-radius:50%;cursor:pointer}
#pen .tag{font-size:12px;font-weight:700;background:#e2b04a;color:#1f2f5a;padding:3px 8px;border-radius:20px;white-space:nowrap}
#pen .tag.p{background:#ffffff33;color:#fff}
#pen .phint{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-weight:700;font-size:15px;text-shadow:0 1px 4px #0008;pointer-events:none}
#pen .pbig{position:absolute;left:0;right:0;top:36%;text-align:center;font-size:54px;font-weight:900;letter-spacing:1px;text-shadow:0 3px 12px #0009;pointer-events:none;transform:scale(.6);opacity:0;transition:transform .25s,opacity .25s}
#pen .pbig.on{transform:scale(1);opacity:1}
#pen .pend{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1f2f5acc;padding:16px}
#pen .pcard{background:#fffaf0;color:#1f2a33;border-radius:18px;max-width:380px;width:100%;padding:18px;max-height:92vh;overflow:auto;box-shadow:0 10px 40px #0006}
#pen .pcard h2{margin:0 0 4px;font-size:22px;color:#1f2f5a}#pen .pcard .s{font-size:13px;color:#5b6570;margin:0 0 12px}
#pen .pscore{font-size:44px;font-weight:900;color:#1f2f5a;text-align:center;margin:6px 0}
#pen .ptabs{display:flex;gap:6px;margin:10px 0 6px}#pen .ptabs button{flex:1;border:1px solid #1f2f5a33;background:#fff;border-radius:10px;padding:7px;font-weight:700;color:#1f2f5a;cursor:pointer}
#pen .ptabs button.on{background:#1f2f5a;color:#fff}
#pen ol{margin:0;padding:0;list-style:none;font-size:14px}#pen li{display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px solid #0000000d}#pen li.me{background:#e2b04a33;border-radius:6px}
#pen .pbtns{display:flex;gap:8px;margin-top:14px}#pen .pbtns button{flex:1;padding:12px;border-radius:12px;border:0;font-weight:800;font-size:15px;cursor:pointer}
#pen .go{background:#1f2f5a;color:#fff}#pen .back{background:#e8e1d2;color:#1f2a33}#pen .go:disabled{opacity:.45}`;

  const P = { on: false };
  // the same colour lists as My look (lobby) and the map's walkers
  const KC = { skins: ['#f1c9a5', '#e9b48a', '#c98e62', '#a8714a', '#8a5a3a'], hairs: ['#2f2b28', '#3a2a20', '#5a3a24', '#8a5a2b', '#c98b3a', '#9a958c'], tops: ['#3f7fbf', '#c8603f', '#2f7a68', '#6a4a8c', '#c9922e', '#47684a', '#b5543a', '#3f5866', '#d88fb0', '#f6f0e2'], bottoms: ['#3b3a46', '#4a3b2f', '#2f3e52', '#55504a', '#d9c49a'], hats: ['#c8603f', '#3f5866', '#f6f0e2', '#2f2b28', '#c9922e', '#47684a'] };
  function lookOpts(l) { const T = KC; if (!l || !T) return { top: '#c8603f', bottom: '#f6f0e2' };
    return { skin: T.skins[l.skin || 0], hairStyle: l.hairStyle || 'short', hair: T.hairs[l.hair || 0], outfit: l.outfit || 'tee', top: T.tops[l.top || 0], bottom: T.bottoms[l.bottom || 0],
      hat: l.hat || 'none', hatColor: (T.hats || T.tops)[l.hatColor || 0], acc: l.acc || 'none', accColor: T.tops[l.top || 0] }; }
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function scene3d(look) {
    const K = window.VinlandKit, T = THREE, sc = new T.Scene();
    sc.background = new T.Color('#9fc7e8'); sc.fog = new T.Fog('#9fc7e8', 40, 90);
    sc.add(new T.HemisphereLight('#fff6e6', '#5c7a4a', 0.9)); const sun = new T.DirectionalLight('#fff0d6', 0.75); sun.position.set(-6, 14, 10); sc.add(sun);
    const M = c => new T.MeshLambertMaterial({ color: c }), box = (w, h, d, c, x, y, z, p = sc) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); p.add(m); return m; };
    // pitch with mowing stripes + the box lines
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const x = cv.getContext('2d');
    for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#4f9a4a' : '#5aa654'; x.fillRect(0, i * 32, 256, 32); }
    const pitch = new T.Mesh(new T.PlaneGeometry(60, 70), new T.MeshLambertMaterial({ map: new T.CanvasTexture(cv) })); pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0, 18); sc.add(pitch);
    const W = '#f4f1e6', line = (w, d, px, pz) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: W })); m.rotation.x = -Math.PI / 2; m.position.set(px, 0.01, pz); sc.add(m); };
    line(40, 0.12, 0, 0); line(18.3, 0.12, 0, 5.5); line(0.12, 5.5, -9.15, 2.75); line(0.12, 5.5, 9.15, 2.75);
    line(40.3, 0.12, 0, 16.5); line(0.12, 16.5, -20.15, 8.25); line(0.12, 16.5, 20.15, 8.25);
    const spot = new T.Mesh(new T.CircleGeometry(0.12, 12), new T.MeshBasicMaterial({ color: W })); spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.012, SPOT); sc.add(spot);
    // goal: posts, bar, net
    const post = '#ffffff', r = 0.06; [-GW, GW].forEach(px => box(r * 2, GH, r * 2, post, px, GH / 2, 0)); box(GW * 2 + r * 2, r * 2, r * 2, post, 0, GH, 0);
    const net = new T.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.45 });
    const back = new T.Mesh(new T.PlaneGeometry(GW * 2, GH, 22, 8), net); back.position.set(0, GH / 2, -1.8); sc.add(back);
    const roof = new T.Mesh(new T.PlaneGeometry(GW * 2, 1.8, 22, 6), net); roof.rotation.x = -Math.PI / 2; roof.position.set(0, GH, -0.9); sc.add(roof);
    [-GW, GW].forEach(px => { const s = new T.Mesh(new T.PlaneGeometry(1.8, GH, 6, 8), net); s.rotation.y = Math.PI / 2; s.position.set(px, GH / 2, -0.9); sc.add(s); });
    // stands behind the goal: navy tiers + a crowd of dots, gold band, the stadium name
    const cc = document.createElement('canvas'); cc.width = 512; cc.height = 128; const y = cc.getContext('2d'); y.fillStyle = '#2a3a66'; y.fillRect(0, 0, 512, 128);
    const cols = ['#f1c9a5', '#c98e62', '#8a5a3a', '#e2b04a', '#ffffff', '#c8603f', '#3f7fbf', '#d88fb0'];
    for (let i = 0; i < 1400; i++) { y.fillStyle = cols[i % cols.length]; y.fillRect(Math.random() * 512, Math.random() * 128, 3, 3); }
    const crowd = new T.MeshLambertMaterial({ map: new T.CanvasTexture(cc) });
    for (let i = 0; i < 4; i++) { const m = new T.Mesh(new T.BoxGeometry(70, 2.2, 3), [M('#2a3a66'), M('#2a3a66'), M('#2a3a66'), M('#2a3a66'), crowd, M('#2a3a66')]); m.position.set(0, 2.2 + i * 2.2, -9 - i * 3); sc.add(m); }
    box(70, 1.1, 0.4, '#1f2f5a', 0, 0.55, -7);
    const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 64; const z = bc.getContext('2d'); z.fillStyle = '#e2b04a'; z.fillRect(0, 0, 1024, 64);
    z.fillStyle = '#1f2f5a'; z.font = '900 40px Poppins, sans-serif'; z.textAlign = 'center'; z.textBaseline = 'middle'; z.fillText('★  VINLAND NATIONAL STADIUM  ★', 512, 34);
    const band = new T.Mesh(new T.PlaneGeometry(30, 1.9), new T.MeshBasicMaterial({ map: new T.CanvasTexture(bc) })); band.position.set(0, 0.95, -6.78); sc.add(band);
    // ball
    const bt = document.createElement('canvas'); bt.width = 128; bt.height = 64; const q = bt.getContext('2d'); q.fillStyle = '#fff'; q.fillRect(0, 0, 128, 64); q.fillStyle = '#1f2a33';
    [[0.22, 0], [0.78, 0.1]].forEach(([v, o]) => { for (let i = 0; i < 5; i++) { q.beginPath(); q.ellipse(((i / 5 + o) % 1) * 128, v * 64, 6, 4.5, 0, 0, 7); q.fill(); } }); q.fillRect(0, 0, 128, 3); q.fillRect(0, 61, 128, 3);
    const ball = new T.Mesh(new T.SphereGeometry(0.11, 16, 12), new T.MeshLambertMaterial({ map: new T.CanvasTexture(bt) })); sc.add(ball);
    // keeper (navy + gold kit) and you (your own look)
    const keeper = K.make('person', { skin: '#c98e62', hairStyle: 'short', hair: '#2f2b28', outfit: 'tee', top: '#1f2f5a', bottom: '#e2b04a', hat: 'none' }); sc.add(keeper);
    keeper.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const me = K.make('person', lookOpts(look)); sc.add(me);
    const cam = new T.PerspectiveCamera(50, 1, 0.1, 200);
    return { sc, cam, ball, keeper, me };
  }

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

  async function open(ctx) {
    if (P.on) return; P.on = true; P.ctx = ctx;
    if (!document.getElementById('penCss')) { const s = el('style'); s.id = 'penCss'; s.textContent = css; document.head.appendChild(s); }
    const root = el('div'); root.id = 'pen'; document.body.appendChild(root); P.root = root;
    const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer:coarse)').matches ? 1.5 : 2)); root.appendChild(R.domElement); P.R = R;
    const top = el('div', 'ptop'); top.innerHTML = '<div class="dots"></div><span class="tag"></span><button class="x" aria-label="Close">✕</button>'; root.appendChild(top);
    P.dots = top.querySelector('.dots'); P.tag = top.querySelector('.tag'); top.querySelector('.x').onclick = close;
    P.hint = el('div', 'phint', 'Swipe up from the ball to shoot'); root.appendChild(P.hint);
    P.big = el('div', 'pbig'); root.appendChild(P.big);
    Object.assign(P, scene3d(ctx.look));
    const fit = () => { const w = root.clientWidth, h = root.clientHeight; R.setSize(w, h, false); P.cam.aspect = w / h; P.cam.fov = w < h ? 62 : 45; P.cam.updateProjectionMatrix(); };
    fit(); P.fit = fit; window.addEventListener('resize', fit);
    const cv = R.domElement; let st = null;
    cv.addEventListener('pointerdown', e => { if (P.state !== 'aim') return; st = { x: e.clientX, y: e.clientY, t: performance.now() }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointerup', e => { if (!st || P.state !== 'aim') { st = null; return; } const W = cv.clientWidth, H = cv.clientHeight, dx = e.clientX - st.x, dy = e.clientY - st.y; st = null;
      const up = -dy / H; if (up < 0.07) { flash('Swipe UP towards the goal', '#fff', 900); return; }
      // across: a full-width swipe ≈ 10 m; height: a short swipe keeps it low, a long one lifts it (too long = over the bar)
      const tx = clamp(dx / W * 10 + (Math.random() - 0.5) * 0.2, -9, 9), ty = clamp((up - 0.1) * 5.2 + (Math.random() - 0.5) * 0.12, 0.11, 5);
      shoot(tx, ty); });
    P.raf = requestAnimationFrame(loop);
    newRound();
  }

  function close() { if (!P.on) return; P.on = false; cancelAnimationFrame(P.raf); window.removeEventListener('resize', P.fit);
    P.sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    P.R.dispose(); P.root.remove(); if (P.ctx.onClose) P.ctx.onClose(); }

  function flash(t, col = '#fff', ms = 1100) { P.big.textContent = t; P.big.style.color = col; P.big.classList.add('on'); clearTimeout(P.ft); P.ft = setTimeout(() => P.big.classList.remove('on'), ms); }

  function dotsDraw() { P.dots.innerHTML = ''; for (let i = 0; i < ROUND; i++) { const r = P.res[i], d = el('div', 'dot' + (r === undefined ? '' : r ? ' g' : ' m'), r === undefined ? '' : r ? '✓' : '✕'); P.dots.appendChild(d); } }

  function place() {   // everyone back on their marks
    const { ball, keeper, me } = P; ball.position.set(0, 0.11, SPOT); ball.rotation.set(0, 0, 0);
    keeper.position.set(0, 0, 0.35); keeper.rotation.set(0, 0, 0); const kl = keeper.userData.limbs; kl.armL.rotation.set(0, 0, -0.5); kl.armR.rotation.set(0, 0, 0.5);
    me.position.set(-1.3, 0, SPOT + 1.8); me.rotation.set(0, Math.PI - 0.45, 0); const ml = me.userData.limbs; ['legL', 'legR', 'armL', 'armR'].forEach(k => ml[k].rotation.x = 0);
    P.cam.position.set(0.4, 3.3, SPOT + 7.5); P.cam.lookAt(0, 0.9, 0); P.state = 'aim'; P.hint.style.opacity = 1; }

  async function newRound() {
    P.res = []; P.id = null; P.practice = true; P.left = null; dotsDraw(); place(); P.state = 'wait';
    const s = P.ctx.session;
    if (s) { try { const r = await P.ctx.api({ action: 'game_start', game: 'pen', token: s.token });
        if (r && r.ok) { P.id = r.id; P.practice = false; P.left = r.left; }
        else if (r && r.error === 'limit') { P.why = r.msg || 'That is 3 rounds today. Come back tomorrow.'; }
        else if (r && r.error === 'not a citizen') P.why = 'Only citizens can score for the leaderboard. Practice round.';
      } catch (e) {} }
    P.tag.textContent = P.practice ? 'Practice · not counted' : 'Counts for the leaderboard'; P.tag.className = 'tag' + (P.practice ? ' p' : '');
    if (P.practice && P.why) flash(P.why.length > 40 ? 'Practice round' : P.why, '#fff', 1600);
    P.state = 'aim'; }

  function keeperLocal(x, y) {   // the same rules Supabase uses, for practice rounds
    const out = Math.abs(x) > 3.55 || y > 2.35 || y < 0, r = Math.random(), dive = r < 0.38 ? 'L' : r < 0.62 ? 'C' : 'R', zone = x < -1.1 ? 'L' : x > 1.1 ? 'R' : 'C';
    const corner = Math.abs(x) > 2.7 && y > 1.7, saved = !out && dive === zone && (!corner || Math.random() < 0.35);
    return { ok: true, out, saved, goal: !out && !saved, dive }; }

  function shoot(tx, ty) {
    P.state = 'kick'; P.hint.style.opacity = 0;
    const s = P.ctx.session, ask = !P.practice && s ? P.ctx.api({ action: 'game_play', token: s.token, id: P.id, x: +tx.toFixed(2), y: +ty.toFixed(2) }).catch(() => null) : Promise.resolve(keeperLocal(tx, ty));
    P.anim = { t0: performance.now(), tx, ty, res: null, phase: 'run' };
    ask.then(r => { if (!r || !r.ok) { r = keeperLocal(tx, ty); if (!P.practice) { P.practice = true; P.tag.textContent = 'Practice · not counted'; P.tag.className = 'tag p'; } } P.anim.res = r; });
  }

  function loop(now) {
    if (!P.on) return; P.raf = requestAnimationFrame(loop);
    const A = P.anim, { ball, keeper, me } = P;
    if (P.state === 'aim' || P.state === 'wait') { const b = Math.sin(now / 300) * 0.03; keeper.position.x = Math.sin(now / 700) * 0.35; keeper.position.y = Math.max(0, b); }
    if (P.state === 'kick' && A) {
      const t = (now - A.t0) / 1000, ml = me.userData.limbs;
      if (A.phase === 'run') { const k = Math.min(1, t / 0.45);   // run-up: three steps to the ball (also hides the wait for Supabase)
        me.position.set(-1.3 + 0.95 * k, 0, SPOT + 1.8 - 1.45 * k); const sw = Math.sin(k * Math.PI * 3) * 0.7; ml.legL.rotation.x = sw; ml.legR.rotation.x = -sw; ml.armL.rotation.x = -sw * 0.6; ml.armR.rotation.x = sw * 0.6;
        if (k >= 1 && A.res) { A.phase = 'fly'; A.t1 = now; ml.legR.rotation.x = -1.1; } }
      else if (A.phase === 'fly') { const f = (now - A.t1) / 1000, D = 0.62, k = Math.min(1, f / D), R = A.res;
        if (f < 0.15) ml.legR.rotation.x = -1.1 + f * 6;
        // where the ball goes after the line: into the net, off the keeper's gloves, or away past the goal
        const ex = R.saved ? A.tx * 0.6 + (A.tx < 0 ? -1.5 : 1.5) : A.tx * 1.15, ey = R.saved ? 0.4 : R.out ? A.ty + 1.2 : Math.max(0.12, A.ty * 0.5), ez = R.saved ? 5 : R.out ? -8 : -1.6;
        if (k < 1) { ball.position.set(A.tx * k, 0.11 + (A.ty - 0.11) * k + Math.sin(k * Math.PI) * 0.35, SPOT * (1 - k)); ball.rotation.x -= 0.4; }
        else { const k2 = Math.min(1, (f - D) / 0.5); ball.position.set(A.tx + (ex - A.tx) * k2, A.ty + (ey - A.ty) * k2 - (R.out ? 0 : Math.sin(k2 * Math.PI) * -0.2), ez * k2); }
        // keeper reacts a beat after the kick
        const kd = clamp((f - 0.12) / 0.42, 0, 1), e = ease(kd), kl = keeper.userData.limbs, dir = R.dive === 'L' ? -1 : R.dive === 'R' ? 1 : 0;
        if (dir) { keeper.position.set(dir * 2.3 * e, Math.sin(kd * Math.PI) * 0.75 + (A.ty > 1.4 ? 0.4 * e : 0), 0.35); keeper.rotation.z = -dir * 1.25 * e; kl.armL.rotation.z = -0.5 - 2.4 * e; kl.armR.rotation.z = 0.5 + 2.4 * e; }
        else { keeper.position.set(0, Math.sin(kd * Math.PI) * 0.55, 0.35); kl.armL.rotation.z = -0.5 - 2.2 * e; kl.armR.rotation.z = 0.5 + 2.2 * e; }
        if (f > D && !A.told) { A.told = true; const g = R.goal; P.res.push(g); dotsDraw(); flash(g ? 'GOAL!' : R.out ? (A.ty > 2.3 ? 'Over the bar!' : 'Wide!') : 'SAVED!', g ? '#ffd23f' : '#ffffff', 1200); }
        if (f > D + 1.4) { P.anim = null; if (P.res.length >= ROUND) end(); else place(); } }
    }
    P.R.render(P.sc, P.cam);
  }

  async function end() {
    P.state = 'end'; const goals = P.res.filter(Boolean).length;
    const box = el('div', 'pend'), c = el('div', 'pcard'); box.appendChild(c); P.root.appendChild(box);
    const left = P.practice ? null : P.left;
    c.innerHTML = `<h2>${goals === 5 ? 'Perfect round! ⚽' : goals >= 3 ? 'Good round!' : 'Round over'}</h2>
      <p class="s">${P.practice ? 'Practice round: not counted.' + (P.ctx.session ? '' : ' Log in from the lobby (Me) to count your goals.') : 'Your goals count for you and your district this week.' + (left !== null ? ` Rounds left today: ${left}.` : '')}</p>
      <div class="pscore">${goals} / ${ROUND}</div>
      <div class="ptabs"><button class="on" data-t="p">Top players</button><button data-t="d">Districts</button></div><ol><li>Loading the leaderboard…</li></ol>
      <div class="pbtns"><button class="back">Back to the map</button><button class="go">Play again</button></div>`;
    c.querySelector('.back').onclick = close; c.querySelector('.go').onclick = () => { box.remove(); newRound(); };
    if (!P.practice && left === 0) { const g = c.querySelector('.go'); g.textContent = 'Practice'; }
    const list = c.querySelector('ol'), me = P.ctx.session ? String(P.ctx.session.user).toLowerCase() : '';
    let B = null; try { const r = await P.ctx.api({ action: 'game_board', game: 'pen' }); if (r && r.ok) B = r; } catch (e) {}
    const show = t => { c.querySelectorAll('.ptabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      if (!B) { list.innerHTML = '<li>The leaderboard opens soon.</li>'; return; }
      if (t === 'p') { list.innerHTML = B.top.length ? B.top.map((r, i) => `<li class="${r.user === me ? 'me' : ''}"><span>${i + 1}. @${r.user}</span><b>${r.v} ⚽</b></li>`).join('') : '<li>No goals yet this week. Be the first.</li>'; return; }
      const d = new Map(); Object.entries(B.scores || {}).forEach(([u, g]) => { const k = P.ctx.teamOf(u); if (k) d.set(k, (d.get(k) || 0) + g); });
      const myD = me && P.ctx.teamOf(me), rows = [...d.entries()].sort((a, b) => b[1] - a[1]);
      list.innerHTML = rows.length ? rows.map(([k, g], i) => `<li class="${k === myD ? 'me' : ''}"><span>${i + 1}. ${k}</span><b>${g} pts</b></li>`).join('') : '<li>No district points yet this week.</li>'; };
    c.querySelectorAll('.ptabs button').forEach(b => b.onclick = () => show(b.dataset.t)); show('p');
  }

  window.VinPenalty = { open, close };
})();
