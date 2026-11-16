// Vinland · CRICKET OVER (16 Nov). Opened from the National Stadium card, next to the penalty shootout. Single player.
// One over: 6 balls or 2 wickets. Supabase (`social` → game_start / game_play, game 'cricket') picks every ball and rolls the
// shot's luck from how early/late you swung, so runs can't be typed in. Without a login it is a practice over, marked "not counted".
// Tap to play a ground shot, swipe up to go big (more sixes, more catches). One small scene, drawn only while open.
(function () {
  const BALLS = 6, PITCH = 20.1, SLOW = 1.7;   // the ball flies at its real speed × 1/SLOW so a phone tap is fair
  const css = `#crk{position:fixed;inset:0;z-index:9000;background:#9fc7e8;font-family:Poppins,system-ui,sans-serif;color:#fff;touch-action:none;user-select:none;-webkit-user-select:none}
#crk *{box-sizing:border-box}#crk canvas{display:block;width:100%;height:100%}
#crk .ctop{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:8px;padding:12px 14px;background:linear-gradient(#1f2f5acc,#1f2f5a00)}
#crk .balls{display:flex;gap:5px;flex:1}#crk .b{min-width:24px;height:24px;border-radius:12px;border:2px solid #ffffffaa;font-size:12px;line-height:20px;text-align:center;font-weight:800;padding:0 4px}
#crk .b.r{background:#2f9a5a;border-color:#2f9a5a}#crk .b.z{background:#ffffff33}#crk .b.w{background:#c8463a;border-color:#c8463a}#crk .b.s{background:#e2b04a;border-color:#e2b04a;color:#1f2f5a}
#crk .runs{font-weight:900;font-size:18px;white-space:nowrap}
#crk .x{background:#ffffff22;border:0;color:#fff;font-size:20px;width:38px;height:38px;border-radius:50%;cursor:pointer}
#crk .tag{position:absolute;top:56px;right:14px;font-size:12px;font-weight:700;background:#e2b04a;color:#1f2f5a;padding:3px 8px;border-radius:20px}#crk .tag.p{background:#ffffff33;color:#fff}
#crk .speed{position:absolute;top:56px;left:14px;font-size:12px;font-weight:700;background:#1f2f5aaa;padding:3px 8px;border-radius:20px}
#crk .chint{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-weight:700;font-size:15px;text-shadow:0 1px 4px #0008;pointer-events:none}
#crk .cbig{position:absolute;left:0;right:0;top:34%;text-align:center;font-size:54px;font-weight:900;text-shadow:0 3px 12px #0009;pointer-events:none;transform:scale(.6);opacity:0;transition:transform .25s,opacity .25s}#crk .cbig.on{transform:scale(1);opacity:1}
#crk .cend{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1f2f5acc;padding:16px}
#crk .ccard{background:#fffaf0;color:#1f2a33;border-radius:18px;max-width:380px;width:100%;padding:18px;max-height:92vh;overflow:auto;box-shadow:0 10px 40px #0006}
#crk .ccard h2{margin:0 0 4px;font-size:22px;color:#1f2f5a}#crk .ccard .s{font-size:13px;color:#5b6570;margin:0 0 12px}
#crk .cscore{font-size:44px;font-weight:900;color:#1f2f5a;text-align:center;margin:6px 0}
#crk .ctabs{display:flex;gap:6px;margin:10px 0 6px}#crk .ctabs button{flex:1;border:1px solid #1f2f5a33;background:#fff;border-radius:10px;padding:7px;font-weight:700;color:#1f2f5a;cursor:pointer}#crk .ctabs button.on{background:#1f2f5a;color:#fff}
#crk ol{margin:0;padding:0;list-style:none;font-size:14px}#crk li{display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px solid #0000000d}#crk li.me{background:#e2b04a33;border-radius:6px}
#crk .cbtns{display:flex;gap:8px;margin-top:14px}#crk .cbtns button{flex:1;padding:12px;border-radius:12px;border:0;font-weight:800;font-size:15px;cursor:pointer}#crk .go{background:#1f2f5a;color:#fff}#crk .back{background:#e8e1d2;color:#1f2a33}`;
  const KC = { skins: ['#f1c9a5', '#e9b48a', '#c98e62', '#a8714a', '#8a5a3a'], hairs: ['#2f2b28', '#3a2a20', '#5a3a24', '#8a5a2b', '#c98b3a', '#9a958c'], tops: ['#3f7fbf', '#c8603f', '#2f7a68', '#6a4a8c', '#c9922e', '#47684a', '#b5543a', '#3f5866', '#d88fb0', '#f6f0e2'], bottoms: ['#3b3a46', '#4a3b2f', '#2f3e52', '#55504a', '#d9c49a'], hats: ['#c8603f', '#3f5866', '#f6f0e2', '#2f2b28', '#c9922e', '#47684a'] };
  const lookOpts = l => !l ? { top: '#f6f0e2', bottom: '#f6f0e2' } : { skin: KC.skins[l.skin || 0], hairStyle: l.hairStyle || 'short', hair: KC.hairs[l.hair || 0], outfit: l.outfit || 'tee', top: KC.tops[l.top || 0], bottom: KC.bottoms[l.bottom || 0], hat: l.hat || 'none', hatColor: KC.hats[l.hatColor || 0], acc: l.acc || 'none', accColor: KC.tops[l.top || 0] };
  const C = { on: false }, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  const delivery = () => ({ speed: 118 + Math.floor(Math.random() * 28), line: +(Math.random() * 0.9 - 0.45).toFixed(2), len: +(4 + Math.random() * 4).toFixed(1) });
  function shotLocal(t, aim) { const a = Math.abs(t), r = Math.random();   // the same table Supabase uses, for practice overs
    if (a > 260) return r < 0.25 ? -1 : 0; if (a > 150) return r < 0.12 ? -1 : r < 0.55 ? 0 : r < 0.85 ? 1 : 2; if (a > 70) return r < 0.06 ? -1 : r < 0.3 ? 1 : r < 0.6 ? 2 : r < 0.92 ? 4 : 6;
    return aim === 'lofted' ? (r < 0.12 ? -1 : r < 0.25 ? 2 : r < 0.5 ? 4 : 6) : (r < 0.03 ? -1 : r < 0.2 ? 2 : r < 0.8 ? 4 : 6); }

  function build(look) {
    const T = THREE, K = window.VinlandKit, sc = new T.Scene(); sc.background = new T.Color('#9fc7e8'); sc.fog = new T.Fog('#9fc7e8', 60, 140);
    sc.add(new T.HemisphereLight('#fff6e6', '#5c7a4a', 0.9)); const sun = new T.DirectionalLight('#fff0d6', 0.75); sun.position.set(-8, 16, -6); sc.add(sun);
    const M = c => new T.MeshLambertMaterial({ color: c }), box = (w, h, d, c, x, y, z, p = sc) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); p.add(m); return m; };
    const field = new T.Mesh(new T.CircleGeometry(70, 48), M('#5aa654')); field.rotation.x = -Math.PI / 2; field.position.z = 10; sc.add(field);
    const strip = new T.Mesh(new T.PlaneGeometry(3.1, 24), M('#b89a5e')); strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.01, PITCH / 2); sc.add(strip);
    [0, PITCH].forEach(z => { const c = new T.Mesh(new T.PlaneGeometry(3.1, 0.06), new T.MeshBasicMaterial({ color: '#ffffff' })); c.rotation.x = -Math.PI / 2; c.position.set(0, 0.02, z + (z ? -1.22 : 1.22)); sc.add(c); });
    const rope = new T.Mesh(new T.TorusGeometry(62, 0.15, 4, 64), M('#e2b04a')); rope.rotation.x = Math.PI / 2; rope.position.set(0, 0.1, 10); sc.add(rope);
    const stumps = z => { const g = new T.Group(); [-0.11, 0, 0.11].forEach(x => box(0.04, 0.71, 0.04, '#f4ecd8', x, 0.355, 0, g)); const bails = [-0.055, 0.055].map(x => box(0.11, 0.02, 0.02, '#c8603f', x, 0.72, 0, g)); g.position.z = z; sc.add(g); g.userData.bails = bails; return g; };
    const mine = stumps(-0.1); stumps(PITCH);
    // stands all round the far end, same navy and gold as the stadium
    const cc = document.createElement('canvas'); cc.width = 512; cc.height = 128; const y = cc.getContext('2d'); y.fillStyle = '#2a3a66'; y.fillRect(0, 0, 512, 128);
    const cols = ['#f1c9a5', '#c98e62', '#8a5a3a', '#e2b04a', '#ffffff', '#c8603f', '#3f7fbf', '#d88fb0']; for (let i = 0; i < 1400; i++) { y.fillStyle = cols[i % cols.length]; y.fillRect(Math.random() * 512, Math.random() * 128, 3, 3); }
    const crowd = new T.MeshLambertMaterial({ map: new T.CanvasTexture(cc) });
    for (let a = -3; a <= 3; a++) { const g = new T.Group(); for (let i = 0; i < 3; i++) { const m = new T.Mesh(new T.BoxGeometry(34, 3, 4), [M('#2a3a66'), M('#2a3a66'), M('#2a3a66'), M('#2a3a66'), crowd, M('#2a3a66')]); m.position.set(0, 2 + i * 3, i * 4); g.add(m); }
      const r = a * 0.42; g.position.set(Math.sin(r) * 68, 0, 10 + Math.cos(r) * 68); g.rotation.y = r + Math.PI; sc.add(g); }
    const ball = new T.Mesh(new T.SphereGeometry(0.08, 12, 10), M('#b8322a')); sc.add(ball);
    const bowler = K.make('person', { skin: '#a8714a', hairStyle: 'short', hair: '#2f2b28', outfit: 'tee', top: '#1f2f5a', bottom: '#f6f0e2' }); sc.add(bowler);
    const keeper = K.make('person', { skin: '#e9b48a', hairStyle: 'short', hair: '#3a2a20', outfit: 'tee', top: '#1f2f5a', bottom: '#f6f0e2' }); keeper.position.set(0.9, 0, -2.3); sc.add(keeper);
    const me = K.make('person', lookOpts(look)); sc.add(me);
    const bat = new T.Group(); box(0.11, 0.8, 0.05, '#e8cf94', 0, -0.55, 0, bat); box(0.035, 0.32, 0.035, '#2f2b28', 0, -0.02, 0, bat); me.userData.limbs.armR.add(bat); bat.position.set(0, -0.6, 0.08); bat.rotation.x = 0.5;
    return { sc, cam: new T.PerspectiveCamera(50, 1, 0.1, 300), ball, bowler, keeper, me, bat, mine };
  }

  function open(ctx) {
    if (C.on) return; C.on = true; C.ctx = ctx;
    if (!document.getElementById('crkCss')) { const s = el('style'); s.id = 'crkCss'; s.textContent = css; document.head.appendChild(s); }
    const root = el('div'); root.id = 'crk'; document.body.appendChild(root); C.root = root;
    const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer:coarse)').matches ? 1.5 : 2)); root.appendChild(R.domElement); C.R = R;
    const top = el('div', 'ctop', '<div class="balls"></div><span class="runs"></span><button class="x" aria-label="Close">✕</button>'); root.appendChild(top);
    C.ballsEl = top.querySelector('.balls'); C.runsEl = top.querySelector('.runs'); top.querySelector('.x').onclick = close;
    C.tag = el('span', 'tag'); root.appendChild(C.tag); C.speedEl = el('span', 'speed'); root.appendChild(C.speedEl);
    C.hint = el('div', 'chint', 'Tap to hit · swipe up to go big'); root.appendChild(C.hint); C.big = el('div', 'cbig'); root.appendChild(C.big);
    Object.assign(C, build(ctx.look));
    const fit = () => { const w = root.clientWidth, h = root.clientHeight; R.setSize(w, h, false); C.cam.aspect = w / h; C.cam.fov = w < h ? 64 : 46; C.cam.updateProjectionMatrix(); };
    fit(); C.fit = fit; window.addEventListener('resize', fit);
    const cv = R.domElement; let st = null;
    cv.addEventListener('pointerdown', e => { st = { y: e.clientY, t: performance.now() }; });
    cv.addEventListener('pointerup', e => { if (!st) return; const up = (st.y - e.clientY) / cv.clientHeight, t0 = st.t; st = null; swing(t0, up > 0.08 ? 'lofted' : 'ground'); });
    C.raf = requestAnimationFrame(loop); newOver();
  }
  function close() { if (!C.on) return; C.on = false; cancelAnimationFrame(C.raf); window.removeEventListener('resize', C.fit);
    C.sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    C.R.dispose(); C.root.remove(); if (C.ctx.onClose) C.ctx.onClose(); }
  function flash(t, col = '#fff', ms = 1100) { C.big.textContent = t; C.big.style.color = col; C.big.classList.add('on'); clearTimeout(C.ft); C.ft = setTimeout(() => C.big.classList.remove('on'), ms); }
  function hud() { C.ballsEl.innerHTML = ''; for (let i = 0; i < BALLS; i++) { const r = C.res[i]; C.ballsEl.appendChild(el('div', 'b' + (r === undefined ? '' : r < 0 ? ' w' : r >= 4 ? ' s' : r ? ' r' : ' z'), r === undefined ? '' : r < 0 ? 'W' : r === 0 ? '•' : String(r))); }
    C.runsEl.textContent = C.res.filter(r => r > 0).reduce((a, r) => a + r, 0) + '/' + C.res.filter(r => r < 0).length; }

  async function newOver() {
    C.res = []; C.id = null; C.practice = true; C.left = null; C.next = null; C.state = 'wait'; hud(); reset();
    const s = C.ctx.session; let why = '';
    if (s) { try { const r = await C.ctx.api({ action: 'game_start', game: 'cricket', token: s.token });
      if (r && r.ok) { C.id = r.id; C.practice = false; C.left = r.left; C.next = r.next; } else if (r && r.error === 'limit') why = r.msg || ''; } catch (e) {} }
    if (!C.next) C.next = delivery();
    C.tag.textContent = C.practice ? 'Practice · not counted' : 'Counts for the leaderboard'; C.tag.className = 'tag' + (C.practice ? ' p' : '');
    if (why) flash('3 overs done today', '#fff', 1600);
    setTimeout(bowl, 900);
  }
  function reset() { const { ball, bowler, me, mine } = C; bowler.position.set(0.5, 0, PITCH + 12); bowler.rotation.set(0, Math.PI, 0); ball.visible = false;
    me.position.set(-0.45, 0, 0.75); me.rotation.set(0, 0.35, 0); const l = me.userData.limbs; l.armR.rotation.set(-0.3, 0, 0.3); l.armL.rotation.set(-0.5, 0, -0.2); ['legL', 'legR'].forEach(k => l[k].rotation.x = 0);
    mine.rotation.set(0, 0, 0); mine.userData.bails.forEach((b, i) => b.position.set(i ? 0.055 : -0.055, 0.72, 0));
    C.cam.position.set(-1.7, 2.4, -3.3); C.cam.lookAt(0.3, 0.6, PITCH * 0.7); }
  function bowl() { if (!C.on) return; const d = C.next; C.ball0 = d; C.speedEl.textContent = d.speed + ' km/h';
    const v = d.speed / 3.6 / SLOW, flight = (PITCH - 1.2) / v;   // seconds from release to the hitting spot (1.2 m in front of the stumps)
    C.b = { t0: performance.now(), run: 1.1, flight, d, swung: null, hit: null, res: null }; C.state = 'bowl'; C.hint.style.opacity = 1; }

  function swing(t, aim) {
    if (C.state !== 'bowl' || !C.b || C.b.swung) return; const B = C.b, ideal = B.t0 + (B.run + B.flight) * 1000;
    if (t < B.t0 + B.run * 1000) return;   // too early: the ball is not even bowled
    const off = Math.round((t - ideal) / SLOW * 1.0);   // ms in real-speed terms, the same scale Supabase uses
    B.swung = { t, aim, off }; C.hint.style.opacity = 0;
    const s = C.ctx.session, ask = !C.practice && s ? C.ctx.api({ action: 'game_play', token: s.token, id: C.id, t: off, aim }).catch(() => null) : Promise.resolve(null);
    ask.then(r => { if (!r || !r.ok) { const runs = shotLocal(off, aim); r = { runs: Math.max(0, runs), wicket: runs < 0, next: delivery() }; if (!C.practice) { C.practice = true; C.tag.textContent = 'Practice · not counted'; C.tag.className = 'tag p'; } } B.res = r; });
  }

  function loop(now) {
    if (!C.on) return; C.raf = requestAnimationFrame(loop);
    const B = C.b, { ball, bowler, me, bat, mine, keeper } = C, l = me.userData.limbs;
    if (C.state === 'bowl' && B) {
      const t = (now - B.t0) / 1000;
      if (t < B.run) { const k = t / B.run; bowler.position.set(0.5, 0, PITCH + 12 - 11 * k); const sw = Math.sin(k * Math.PI * 6) * 0.7, bl = bowler.userData.limbs; bl.legL.rotation.x = sw; bl.legR.rotation.x = -sw; bl.armR.rotation.x = k > 0.8 ? -Math.PI * (k - 0.8) * 5 : 0; }
      else { const f = t - B.run, k = f / B.flight, d = B.d, bz = d.len, kb = (PITCH - bz) / (PITCH - 1.2);   // release → bounce → the bat
        ball.visible = true; const z = PITCH - (PITCH - 1.2) * k;
        const yy = k < kb ? 2.1 - 2.05 * (k / kb) : 0.05 + (0.75) * Math.sin(clamp((k - kb) / (1 - kb), 0, 1) * Math.PI * 0.5) * 1.05;
        if (!B.hit) ball.position.set(d.line * (k < kb ? k / kb : 1) + 0.0, Math.max(0.05, yy), z);
        // the swing itself
        if (B.swung) { const s = clamp((now - B.swung.t) / 220, 0, 1); l.armR.rotation.x = -0.3 - 2.4 * s; l.armL.rotation.x = -0.5 - 1.6 * s; me.rotation.y = 0.35 - 0.9 * s; }
        if (k >= 1 && !B.hit && (B.res || f > B.flight + 1.5)) { B.hit = { t: now, r: B.res || { runs: 0, wicket: true } }; }
        if (B.hit) { const h = B.hit, r = h.r, e = (now - h.t) / 1000;
          if (r.wicket && (!B.swung || Math.abs(B.swung.off) > 150 || (B.swung.aim === 'ground'))) {   // bowled: the ball carries on into the stumps
            ball.position.set(d.line * 0.4, 0.4, 1.2 - e * 8); if (e > 0.13) { mine.rotation.x = -0.25; mine.userData.bails.forEach((b, i) => b.position.set((i ? 0.3 : -0.3) * Math.min(1, e * 3), 0.72 + Math.sin(Math.min(1, e * 2) * Math.PI) * 0.5, -e * 1.5)); } }
          else if (r.wicket) { ball.position.set(-6 * Math.min(1, e), 0.8 + Math.sin(Math.min(1, e) * Math.PI) * 12, 1.2 + 26 * Math.min(1, e)); }   // lofted, caught in the deep
          else if (r.runs === 0) { ball.position.set(d.line, 0.6, 1.2 - e * 9); if (ball.position.z < -2.4) ball.visible = false; keeper.userData.limbs.armL.rotation.x = keeper.userData.limbs.armR.rotation.x = -1.4; }
          else { const dir = (B.swung && B.swung.off < 0 ? -1 : 1) * (0.25 + (Math.abs(B.swung ? B.swung.off : 0) % 50) / 100), dist = r.runs >= 6 ? 75 : r.runs === 4 ? 62 : 14 + r.runs * 6, k2 = Math.min(1, e / (r.runs >= 4 ? 1.4 : 1.1));
            ball.position.set(Math.sin(dir) * dist * k2, r.runs >= 6 ? 1 + Math.sin(k2 * Math.PI) * 22 : 0.08 + Math.abs(Math.sin(k2 * 9)) * 0.3 * (1 - k2), 1.2 + Math.cos(dir) * dist * k2); }
          if (!h.told) { h.told = true; const v = r.wicket ? -1 : r.runs; C.res.push(v); hud(); flash(r.wicket ? 'OUT!' : v === 6 ? 'SIX!' : v === 4 ? 'FOUR!' : v === 0 ? 'Dot ball' : v + (v === 1 ? ' run' : ' runs'), r.wicket ? '#ffffff' : v >= 4 ? '#ffd23f' : '#ffffff', 1200); C.next = r.next || delivery(); }
          if (e > 1.9) { C.b = null; const outs = C.res.filter(x => x < 0).length; if (C.res.length >= BALLS || outs >= 2) end(); else { reset(); C.state = 'wait'; setTimeout(bowl, 500); } } }
      }
    }
    C.R.render(C.sc, C.cam);
  }

  async function end() {
    C.state = 'end'; const runs = C.res.filter(r => r > 0).reduce((a, r) => a + r, 0), wk = C.res.filter(r => r < 0).length;
    const box = el('div', 'cend'), c = el('div', 'ccard'); box.appendChild(c); C.root.appendChild(box);
    c.innerHTML = `<h2>${runs >= 24 ? 'What an over! 🏏' : runs >= 12 ? 'Good over!' : 'Over done'}</h2>
      <p class="s">${C.practice ? 'Practice over: not counted.' + (C.ctx.session ? '' : ' Log in from the lobby (Me) to count your runs.') : 'Your runs count for you and your district this week.' + (C.left !== null ? ` Overs left today: ${C.left}.` : '')}</p>
      <div class="cscore">${runs} / ${wk}</div>
      <div class="ctabs"><button class="on" data-t="p">Top batters</button><button data-t="d">Districts</button></div><ol><li>Loading the leaderboard…</li></ol>
      <div class="cbtns"><button class="back">Back to the map</button><button class="go">${!C.practice && C.left === 0 ? 'Practice' : 'Bat again'}</button></div>`;
    c.querySelector('.back').onclick = close; c.querySelector('.go').onclick = () => { box.remove(); newOver(); };
    const list = c.querySelector('ol'), me = C.ctx.session ? String(C.ctx.session.user).toLowerCase() : ''; let B = null;
    try { const r = await C.ctx.api({ action: 'game_board', game: 'cricket' }); if (r && r.ok) B = r; } catch (e) {}
    const show = t => { c.querySelectorAll('.ctabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      if (!B) { list.innerHTML = '<li>The leaderboard opens soon.</li>'; return; }
      if (t === 'p') { list.innerHTML = B.top.length ? B.top.map((r, i) => `<li class="${r.user === me ? 'me' : ''}"><span>${i + 1}. @${r.user}</span><b>${r.v} runs</b></li>`).join('') : '<li>No runs yet this week. Be the first.</li>'; return; }
      const d = new Map(); Object.entries(B.scores || {}).forEach(([u, v]) => { const k = C.ctx.teamOf(u); if (k) d.set(k, (d.get(k) || 0) + v); });
      const myD = me && C.ctx.teamOf(me), rows = [...d.entries()].sort((a, b) => b[1] - a[1]);
      list.innerHTML = rows.length ? rows.map(([k, v], i) => `<li class="${k === myD ? 'me' : ''}"><span>${i + 1}. ${k}</span><b>${v} runs</b></li>`).join('') : '<li>No district runs yet this week.</li>'; };
    c.querySelectorAll('.ctabs button').forEach(b => b.onclick = () => show(b.dataset.t)); show('p');
  }
  window.VinCricket = { open, close, _s: () => C };
})();
