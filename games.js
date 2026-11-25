/* KUN 星站 · 游戏厅（Three.js 3D 小游戏） */
(function () {
  var app = document.getElementById('gamesApp');
  if (!app || !window.THREE) return;

  var GAMES = [
    { id: 'wish', name: '许愿树', en: 'WISH TREE', cat: 'heal', hot: true, cover: 'images/games/wish.jpg', c1: '#2b5f8f',
      chip: '治愈 · 互动', icon: '愿', tag: '3D 许愿', diff: '★',
      desc: '一棵可以转着看的蓝玫瑰树，写一句祝福就多开一朵花。',
      tags: ['3D 可旋转', '蓝玫瑰挂牌', '随手可玩'], go: '去许愿', link: '#wish' },
    { id: 'g5', name: '金海记忆剧场', en: 'GOLD SEA', cat: 'memory', c1: '#8a4a2f',
      chip: '记忆 · 剧场', cover: 'images/games/show.jpg', tag: '3D 记忆', diff: '★★★',
      desc: '金色灯海一盏盏亮起，按顺序点回去。播放速度可调，关卡往上无限叠。',
      tags: ['3D 剧场', '速度可调', '无限关卡'], go: '进入剧场',
      hint: '灯亮时别急，先记住第一个。' },
    { id: 'g6', name: '蓝玫瑰镜面迷宫', en: 'MIRROR MAZE', cat: 'puzzle', c1: '#2f6f74',
      chip: '解谜 · 无限关', cover: 'images/games/maze.jpg', tag: '3D 光路', diff: '★★★★',
      desc: '9×9 棋盘，第 1 关只有 1 朵蓝玫瑰，之后慢慢加到 2–3 朵，镜子越来越多。',
      tags: ['3D 光路', '无限关卡', '现场生成'], go: '进入镜厅',
      hint: '点镜子转 90°，跟着右下小地图走。' },
    { id: 'g7', name: '翻牌配对', en: 'FLIP PAIRS', cat: 'memory', c1: '#2F5CD4',
      chip: '记忆 · 翻牌', cover: 'images/games/flip.jpg', icon: '牌', tag: '记忆 · 翻牌', diff: '★★★',
      desc: '翻开两张，找出同一帧舞台照片。每关先亮牌几秒，记住位置；关卡越高牌越多。',
      tags: ['经典翻牌', '先看后翻', '关卡递增'], go: '开始翻牌',
      hint: '先记四角，再记中间，别急着点。' },
  ];

  function openWish() {
    if (location.hash !== '#wish') { location.hash = 'wish'; return; }
    document.querySelectorAll('.page').forEach(function (x) { x.classList.remove('active'); });
    var p = document.getElementById('wish');
    if (p) { p.classList.add('active'); window.scrollTo(0, 0); }
  }

  var stage = null, cur = null, toastEl = null;

  /* ---------- 公共 ---------- */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  function toast(msg, ms, anchor) {
    if (!stage) return;
    if (!toastEl) {
      toastEl = el('div', 'gx-toast');
      stage.appendChild(toastEl);
    }
    var node = toastEl;
    node.className = 'gx-toast' + (anchor ? ' at-hint' : '');
    node.textContent = msg;
    node.classList.add('show');
    clearTimeout(node._t);
    node._t = setTimeout(function () { if (node && node.classList) node.classList.remove('show'); }, ms || 2200);
  }

  function panel(title, body, onClose) {
    var mask = el('div', 'gx-panel-mask');
    var box = el('div', 'gx-panel');
    box.innerHTML = '<div class="gx-panel-h"><span>' + title + '</span><button class="gx-x">×</button></div>' +
      '<div class="gx-panel-b"></div>';
    box.querySelector('.gx-panel-b').appendChild(body);
    mask.appendChild(box);
    stage.appendChild(mask);
    var close = function () { if (mask.parentNode) mask.remove(); if (onClose) onClose(); };
    box.querySelector('.gx-x').onclick = close;
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    return { mask: mask, close: close, box: box };
  }

  function makeGL(canvas) {
    var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.32;
    if ('outputColorSpace' in r) r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  }

  function orbit(camera, dom, target, cfg) {
    cfg = cfg || {};
    var yaw = cfg.yaw != null ? cfg.yaw : 0.3, pitch = cfg.pitch != null ? cfg.pitch : 0.32, R = cfg.r || 6;
    var minPitch = cfg.minPitch != null ? cfg.minPitch : 0.06, maxPitch = cfg.maxPitch != null ? cfg.maxPitch : 1.1;
    var dragging = false, lx = 0, ly = 0;
    function apply() {
      camera.position.set(
        target.x + R * Math.sin(pitch) * Math.sin(yaw),
        target.y + R * Math.cos(pitch),
        target.z + R * Math.sin(pitch) * Math.cos(yaw)
      );
      camera.lookAt(target);
    }
    apply();
    if (dom) {
      dom.addEventListener('pointerdown', function (e) {
        dragging = true; lx = e.clientX; ly = e.clientY;
        try { dom.setPointerCapture(e.pointerId); } catch (err) {}
      });
      dom.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        yaw -= (e.clientX - lx) * 0.006;
        pitch = Math.max(minPitch, Math.min(maxPitch, pitch - (e.clientY - ly) * 0.004));
        lx = e.clientX; ly = e.clientY;
        apply();
      });
      function up() { dragging = false; }
      dom.addEventListener('pointerup', up);
      dom.addEventListener('pointercancel', up);
    }
    return { apply: apply, setR: function (v) { R = v; apply(); } };
  }

  function bgGrad(scene, top, bottom) {
    var c = document.createElement('canvas'); c.width = 8; c.height = 256;
    var g = c.getContext('2d');
    var lg = g.createLinearGradient(0, 0, 0, 256);
    lg.addColorStop(0, top); lg.addColorStop(1, bottom);
    g.fillStyle = lg; g.fillRect(0, 0, 8, 256);
    var tex = new THREE.CanvasTexture(c);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }

  function textTex(txt, opt) {
    opt = opt || {};
    var c = document.createElement('canvas'); c.width = opt.w || 512; c.height = opt.h || 256;
    var g = c.getContext('2d');
    if (opt.grad) {
      var lg = g.createLinearGradient(0, 0, 0, c.height);
      lg.addColorStop(0, opt.grad[0]); lg.addColorStop(1, opt.grad[1]);
      g.fillStyle = lg;
    } else {
      g.fillStyle = opt.bg || 'rgba(8,18,40,.9)';
    }
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = opt.fg || '#BFD8FF';
    g.font = (opt.weight || '700') + ' ' + (opt.size || 96) + 'px "PingFang SC","Songti SC",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, c.width / 2, c.height / 2);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function loop(g) {
    var raf = 0, last = 0;
    function tick(t) {
      raf = requestAnimationFrame(tick);
      var dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      g.update(dt, t / 1000);
      g.renderer.render(g.scene, g.camera);
    }
    raf = requestAnimationFrame(tick);
    return function () { cancelAnimationFrame(raf); };
  }

  function bar(a, b, radius, mat) {
    var dir = new THREE.Vector3().subVectors(b, a);
    var len = dir.length() || .001;
    var m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8, 1, false), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return m;
  }

  /* ---------- 5 金海记忆剧场 ---------- */
  function game5(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x16101C, 0.024);
    bgGrad(scene, '#2A1B34', '#0A0710');
    var camera = new THREE.PerspectiveCamera(50, 1, .1, 90);
    orbit(camera, canvas, new THREE.Vector3(0, .95, -0.4), { r: 16.2, yaw: 0.0, pitch: 1.18, minPitch: .95, maxPitch: 1.4 });

    scene.add(new THREE.AmbientLight(0xFFD9B6, 2.3));
    scene.add(new THREE.HemisphereLight(0xFFE6CC, 0x2A1622, 1.2));
    var spot = new THREE.SpotLight(0xFFE0B0, 12, 32, .62, .55); spot.position.set(0, 10, 4.5); scene.add(spot);
    var warm = new THREE.PointLight(0xFFB066, 4, 18); warm.position.set(-4, 4, 2); scene.add(warm);
    var teal = new THREE.PointLight(0x4FD6C8, 3, 16); teal.position.set(5, 3, 1.5); scene.add(teal);

    var floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0x2C1E27, roughness: .9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; scene.add(floor);
    [4.25, 5.6, 7.4].forEach(function (r0, i) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(r0, r0 + .06, 64), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xF2C14E : 0x8A6A2E, transparent: true, opacity: i === 1 ? .7 : .4, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .01; scene.add(ring);
    });

    var stageM = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 1.0, 56), new THREE.MeshStandardMaterial({ color: 0x6C3E4E, roughness: .45, metalness: .35 }));
    stageM.position.y = .5; scene.add(stageM);
    var stageFront = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.75, .28, 56), new THREE.MeshStandardMaterial({ color: 0x33202E, roughness: .7, metalness: .15 }));
    stageFront.position.y = .14; scene.add(stageFront);
    var stageRim = new THREE.Mesh(new THREE.TorusGeometry(2.2, .06, 10, 72), new THREE.MeshStandardMaterial({ color: 0xF2C14E, metalness: .85, roughness: .22, emissive: 0x6A4300, emissiveIntensity: .5 }));
    stageRim.rotation.x = Math.PI / 2; stageRim.position.y = 1.0; scene.add(stageRim);
    var pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshBasicMaterial({ color: 0xFFF3DC, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 1.015; scene.add(pool);
    var innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, .035, 8, 60), new THREE.MeshStandardMaterial({ color: 0xF2C14E, metalness: .9, roughness: .25, emissive: 0x5A3A00, emissiveIntensity: .6 }));
    innerRing.rotation.x = Math.PI / 2; innerRing.position.y = 1.02; scene.add(innerRing);
    var mic = new THREE.Mesh(new THREE.CylinderGeometry(.024, .024, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0xE0D6C2, metalness: .8, roughness: .25 }));
    mic.position.set(0, 1.8, 0); scene.add(mic);
    var micTop = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 10), new THREE.MeshStandardMaterial({ color: 0x241C26, metalness: .4, roughness: .5 }));
    micTop.position.set(0, 2.62, 0); scene.add(micTop);

    var back = new THREE.Mesh(new THREE.PlaneGeometry(12.4, 6.6), new THREE.MeshBasicMaterial({ map: textTex('', { grad: ['#3A2140', '#100A16'], w: 512, h: 256 }) }));
    back.position.set(0, 3.0, -5.6); scene.add(back);
    var kun = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.3), new THREE.MeshBasicMaterial({ map: textTex('KUN', { bg: 'rgba(0,0,0,0)', fg: '#F5D79A', size: 168, w: 512, h: 256 }), transparent: true }));
    kun.position.set(0, 3.9, -5.5); scene.add(kun);
    var sub = new THREE.Mesh(new THREE.PlaneGeometry(5.6, .95), new THREE.MeshBasicMaterial({ map: textTex('GOLD SEA · 记忆剧场', { bg: 'rgba(0,0,0,0)', fg: '#CFE3F5', size: 46, w: 768, h: 160 }), transparent: true, opacity: .85 }));
    sub.position.set(0, 2.55, -5.5); scene.add(sub);
    var kunGlow = new THREE.PointLight(0xFFD79A, 2.6, 12); kunGlow.position.set(0, 3.6, -4.8); scene.add(kunGlow);

    var curtMat = new THREE.MeshStandardMaterial({ color: 0x7C1E2E, roughness: .85, metalness: .05 });
    [-4.55, 4.55].forEach(function (x) {
      var c1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 4.8, .3), curtMat);
      c1.position.set(x, 2.35, -4.4); c1.rotation.y = x < 0 ? -.22 : .22; scene.add(c1);
      for (var f = 0; f < 3; f++) {
        var fold = new THREE.Mesh(new THREE.BoxGeometry(.16, 4.6, .34), new THREE.MeshStandardMaterial({ color: 0x5E1421, roughness: .9 }));
        fold.position.set(x - .55 + f * .55, 2.35, -4.28); scene.add(fold);
      }
    });
    var swag = new THREE.Mesh(new THREE.TorusGeometry(5.35, .3, 10, 44, Math.PI), curtMat);
    swag.position.set(0, 4.75, -4.6); swag.rotation.z = Math.PI; scene.add(swag);

    for (var f2 = 0; f2 < 11; f2++) {
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0xFFD9A0 }));
      bulb.position.set(-4.8 + f2 * .96, 3.2 + Math.sin(f2 / 10 * Math.PI) * .8, -4.1); scene.add(bulb);
    }

    var beamMat = new THREE.MeshBasicMaterial({ color: 0xFFDEB4, transparent: true, opacity: .08, side: THREE.DoubleSide, depthWrite: false });
    [-2.6, 0, 2.6].forEach(function (bx) {
      var cone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 8, 22, 1, true), beamMat);
      cone.position.set(bx, 7.4, -1.4); scene.add(cone);
    });

    var starGeo = new THREE.BufferGeometry();
    var starPos = [];
    for (var st = 0; st < 260; st++) {
      var sa = Math.random() * Math.PI * 2, sr = 2.4 + Math.random() * 6.2;
      starPos.push(Math.cos(sa) * sr, 1.2 + Math.random() * 5.2, Math.sin(sa) * sr * .55 - 2.2);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xFFD79A, size: .05, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(stars);

    var seats = [], seatMeshes = [];
    var seatGeo = new THREE.BoxGeometry(.54, .09, .48);
    var cushGeo = new THREE.BoxGeometry(.46, .1, .4);
    var backGeo = new THREE.BoxGeometry(.5, .5, .07);
    var legGeo = new THREE.CylinderGeometry(.022, .026, .42, 6);
    var ringR = [3.45, 4.35, 5.3], per = [8, 8, 8];
    var cols = [0x8C2B3C, 0x1F6E6A, 0xB08A3A];
    ringR.forEach(function (r, ri) {
      for (var i = 0; i < per[ri]; i++) {
        var a = (i / per[ri]) * Math.PI * 2 + ri * .36;
        var g = new THREE.Group();
        var legMat = new THREE.MeshStandardMaterial({ color: 0x2A2028, roughness: .55, metalness: .35 });
        [[-.2,-.18],[.2,-.18],[-.2,.18],[.2,.18]].forEach(function (lp) {
          var leg = new THREE.Mesh(legGeo, legMat); leg.position.set(lp[0], .21, lp[1]); g.add(leg);
        });
        var base = new THREE.Mesh(seatGeo, new THREE.MeshStandardMaterial({ color: 0x241C22, roughness: .7, metalness: .2 }));
        base.position.y = .45; g.add(base);
        var cushMat = new THREE.MeshStandardMaterial({ color: cols[(ri + i) % 3], roughness: .5, metalness: .12 });
        var cush = new THREE.Mesh(cushGeo, cushMat); cush.position.y = .51; g.add(cush);
        var backM = new THREE.Mesh(backGeo, cushMat); backM.position.set(0, .76, .21); backM.rotation.x = -.1; g.add(backM);
        g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        g.rotation.y = -a + Math.PI / 2;
        g.scale.setScalar(1.16);
        g.userData.idx = seats.length;
        scene.add(g);
        seats.push({ grp: g, mat: cushMat });
        seatMeshes.push(cush);
      }
    });

    var seq = [], input = [], level = 1, playing = false, speed = 1;
    var label = el('div', 'gx-score');
    host.appendChild(label);
    function refreshLabel() {
      label.innerHTML = '<b>第 ' + level + ' 关</b><span>' + (playing ? '看好灯的顺序…' : '轮到你了：' + input.length + ' / ' + seq.length) + '</span>';
    }
    refreshLabel();

    function flash(s, ms, hex) {
      s.mat.emissive.setHex(hex || 0xFFD98A); s.mat.emissiveIntensity = 1.5;
      s.grp.position.y = .07;
      setTimeout(function () {
        s.mat.emissiveIntensity = 0; s.mat.emissive.setHex(0x000000);
        s.grp.position.y = 0;
      }, ms || 460);
    }

    function newRound() {
      input = []; seq = [];
      var n = Math.min(3 + level, 11);
      for (var i = 0; i < n; i++) seq.push(Math.floor(Math.random() * seats.length));
      playing = true; refreshLabel();
      var i2 = 0;
      (function playSeq() {
        if (i2 >= seq.length) { playing = false; refreshLabel(); return; }
        flash(seats[seq[i2]], Math.max(180, 430 / speed));
        i2++;
        setTimeout(playSeq, 620 / speed);
      })();
    }

    var speedWrap = el('div', 'gx-speed',
      '<button data-s="0.6">慢</button><button data-s="1" aria-pressed="true">常速</button><button data-s="1.8">快</button>');
    host.appendChild(speedWrap);
    speedWrap.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      speed = parseFloat(b.dataset.s) || 1;
      Array.prototype.forEach.call(speedWrap.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      if (playing) return;
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(seatMeshes, false)[0];
      if (!hit) return;
      var idx = hit.object.parent.userData.idx;
      var s = seats[idx];
      if (s !== seats[seq[input.length]]) {
        flash(s, 520, 0xE2593C);
        toast('顺序不对，这一关重来');
        playing = true; input = [];
        setTimeout(function () { newRound(); }, 760);
        return;
      }
      flash(s, 360);
      input.push(s);
      if (input.length === seq.length) {
        toast('第 ' + level + ' 关通过 🎤');
        level++; playing = true;
        setTimeout(function () { newRound(); }, 900);
      } else refreshLabel();
    });

    function resize() { var w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>记住亮灯顺序并点回去</span><span class="gx-badge">3D 记忆</span>'));

    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      kun.material.opacity = .92 + Math.sin(t * 1.2) * .06;
      kunGlow.intensity = 2.4 + Math.sin(t * 1.6) * .5;
      stars.rotation.y = t * .05; stars.material.opacity = .7 + Math.sin(t * 1.1) * .18;
    }});
    setTimeout(newRound, 800);
    return { dispose: function () { stop(); renderer.dispose(); window.removeEventListener('resize', resize); } };
  }

  /* ---------- 6 蓝玫瑰镜面迷宫（无限关卡 · 多朵玫瑰） ---------- */
  function game6(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0A1322, 0.008);
    bgGrad(scene, '#182B4E', '#070C16');
    var camera = new THREE.PerspectiveCamera(50, 1, .1, 120);

    scene.add(new THREE.AmbientLight(0xFFE8CF, .48));
    scene.add(new THREE.HemisphereLight(0xFFF3E0, 0x1A2433, .5));
    var key = new THREE.SpotLight(0xFFDFB8, 1.4, 40, .8, .7); key.position.set(3, 16, 8); scene.add(key);
    var boardLit = new THREE.SpotLight(0xFFD9A8, 2.1, 34, 1.05, .85); boardLit.position.set(0, 13, 4); scene.add(boardLit); scene.add(boardLit.target);
    var cool = new THREE.PointLight(0x59C7C0, .85, 24); cool.position.set(-9, 6, -7); scene.add(cool);
    var warm2 = new THREE.PointLight(0xE8B44A, 1.1, 20); warm2.position.set(9, 5, 7); scene.add(warm2);

    /* 9×9 大棋盘 */
    var N = 9, TS = 1.04;
    function cellPos(cx, cz) { return new THREE.Vector3((cx - (N - 1) / 2) * TS, 0, (cz - (N - 1) / 2) * TS); }

    var hall = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ color: 0x18243A, roughness: .95, emissive: 0x101B2E, emissiveIntensity: .35 }));
    hall.rotation.x = -Math.PI / 2; hall.position.y = -.03; scene.add(hall);

    var C1 = 0xF1E7D6, C2 = 0xDECFB6;
    for (var ix = 0; ix < N; ix++) for (var iz = 0; iz < N; iz++) {
      var tile = new THREE.Mesh(new THREE.PlaneGeometry(TS * .985, TS * .985),
        new THREE.MeshStandardMaterial({ color: (ix + iz) % 2 ? C1 : C2, roughness: .52, metalness: .05 }));
      var p0 = cellPos(ix, iz); tile.rotation.x = -Math.PI / 2; tile.position.set(p0.x, .01, p0.z); scene.add(tile);
    }
    var wall6 = new THREE.Mesh(new THREE.PlaneGeometry(36, 16), new THREE.MeshStandardMaterial({ color: 0x1A2840, roughness: .95, emissive: 0x2A4066, emissiveIntensity: .5 }));
    wall6.position.set(0, 5.6, -10.5); scene.add(wall6);
    var arch6 = new THREE.Mesh(new THREE.TorusGeometry(5.6, .2, 8, 48, Math.PI), new THREE.MeshStandardMaterial({ color: 0xC79A4E, metalness: .85, roughness: .3, emissive: 0x3A2600, emissiveIntensity: .45 }));
    arch6.position.set(0, 2.4, -10); scene.add(arch6);
    var archGlow6 = new THREE.PointLight(0xE8B44A, 1.3, 18); archGlow6.position.set(0, 4.6, -8.4); scene.add(archGlow6);
    for (var pd6 = 0; pd6 < 3; pd6++) {
      var pz6 = -4.2, px6 = (pd6 - 1) * 4.2;
      var shade6 = new THREE.Mesh(new THREE.ConeGeometry(.5, .58, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xD0A256, metalness: .8, roughness: .3, side: THREE.DoubleSide, emissive: 0x6B4516, emissiveIntensity: .55 }));
      shade6.position.set(px6, 4.9, pz6); scene.add(shade6);
      var cord6 = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x2A2E38 }));
      cord6.position.set(px6, 5.9, pz6); scene.add(cord6);
      var bulb6 = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), new THREE.MeshBasicMaterial({ color: 0xFFE6BC }));
      bulb6.position.set(px6, 4.7, pz6); scene.add(bulb6);
      var pl6 = new THREE.PointLight(0xFFD3A0, 1.1, 16); pl6.position.set(px6, 4.5, pz6); scene.add(pl6);
    }
    var boardW = N * TS + .26;
    [[0, -boardW / 2, 0], [0, boardW / 2, 0], [-boardW / 2, 0, 1], [boardW / 2, 0, 1]].forEach(function (p) {
      var fr = new THREE.Mesh(new THREE.BoxGeometry(boardW + .2, .2, .2), new THREE.MeshStandardMaterial({ color: 0xC79A4E, metalness: .8, roughness: .3 }));
      fr.position.set(p[0], .1, p[1]); if (p[2]) fr.rotation.y = Math.PI / 2; scene.add(fr);
    });

    /* ---------- 立体蓝玫瑰（多朵可复用） ---------- */
    var stemMat = new THREE.MeshStandardMaterial({ color: 0x2E6B4A, roughness: .78 });
    var leafMat = new THREE.MeshStandardMaterial({ color: 0x357B55, roughness: .72 });
    var marble = new THREE.MeshStandardMaterial({ color: 0xEFE4CE, roughness: .45, metalness: .08 });
    var pedRingMat = new THREE.MeshStandardMaterial({ color: 0xE8B44A, metalness: .9, roughness: .25 });
    var pMatA = new THREE.MeshStandardMaterial({ color: 0x2F63D8, emissive: 0x1A3FA0, emissiveIntensity: .8, metalness: .4, roughness: .3 });
    var pMatB = new THREE.MeshStandardMaterial({ color: 0x5B93F2, emissive: 0x2A5EC8, emissiveIntensity: .95, metalness: .35, roughness: .28 });
    var petalGeo = new THREE.SphereGeometry(.18, 14, 10);
    var coreMat = new THREE.MeshStandardMaterial({ color: 0xB7D4FF, emissive: 0x3F74E0, emissiveIntensity: 1.6, roughness: .25 });

    var ROSE_URI = 'data:image/webp;base64,UklGRrhSAABXRUJQVlA4WAoAAAAQAAAAUwEAUwEAQUxQSCURAAAB90cmbdPWv/XtjojExTySgBxJkiIpszKWV3+Fh6rr4B3R/wnQPz+2Jdvrks0u9Pk60FUNNjQlHYZB24YsMFzIGvtcVVWfXfX7JXPyq+g4gzKASYa956Q6XOKqX02wLjqEzJFgUdU51kSnwaYrUSO0xG4RcC1Rfw1K7Iijr63myFtJZfvr3a6z4BojUTXnziChfz7DcdtIjiTlH/Z4nXlHxATwn1oFVEAJOoJ8Sy9e8y5evTVy7ssj32hHKblX9vmO4QJrQwYp6YKS38YPgABrpezrPWjxUI7FMpfI+hDHhSryUpn7djI3DCGFkBCq8yP9Yft/vpH/f9ftkaRJ2k6b1LbbsbV82bZt27Zt27ZtrW272Nl2msf9j7aznWceeT7zwvs9ETEBlrVtX+e2ed5/mJNVdmU+Bt7iCfQouuuO8QC4XYWZGUyNI9kWg0cUMQxZGo00PPN/F7JUK9b1+/2WETEBHPP/Mf//T3lVn+QAp+qSINOYAad0JMjuesVnX703C5ISEUzc48ffuXMw/+wL6x2Q7NTjoHPLvuk7yKXD8eErk5sdkLDTjczov8NMCiM7w+X5K0PXyzVA4CQjQc9kdxFDAEbg0urS5NLUVhcQUpVFgq7b3HNKhjjeIOjuXb86PF/a46iTqidy5E/83P4mTBy5MRkMyptzc5Xp0SLgdCuEVjE+RqlAMP3600uYWE+DgEFz6/cff97tioC0ikCGsbo4oZT85KD7UT9d8iXEuhsE3i+e94nHjgrkxOquvrPW0Ng5PE6AEp+ndvQ2W9MgTtcYMjgYfe0HFy5ByjV3pdzESMfGekN9enGyJsA6Ntsd2kFJTpDZetetjXiiaUsc/v3Xf7pmYDo/MO5SLUXWbJebANrQxhPu14JZYhNGy47bjAkpIoARpWsXGpvESpMZIHHSdEdjS1ZKZsKom9jZLzMRaYPAMASI1X0Ss9RgZpEkLidqd9x9Zz3laJhArLtAF12LJS4J6LvDHYcdqAwiKA5vaE4lKskB9XufsaPPmYkwmzKNk0VQIpJLOQH993nn6QtZjHDL09+9AZOSjVYYoEL7gXvtaBZeChiI3Ph4Fp9YhPCszBUL46NbhscKYIjg101vH0mBEodAmEGmLetzU/ummvqbMuAlKqCMnrvcsQuUJIQMDCg2NZ98fK3P97UJ8EhUzPzGyZaUWUIQYABq6BidmBktDORZaSZEJfVkZm7bjSm+CeFXW1nfXdMznR+c6WrNAAYmUXHlyMzsnqzBFNOEgdMqrq21/Q5784X2jABvkqjU5slP7p6qIa67/pa+mZytyEwMNnSmWOmFqOiSMXTX2zXFtJb73K+nsSnFCQ0iCAU1Y4PtQnFLTD7zXk2ArWEkAtKTn+7LELNlhcc8LVWSWFMEpkS6dbqIYhUcd98e74izgs6eAj5GyXIHukXcNfKtDQ7FJihOyBR3ANdZ9Cg+jYwQi0hlEDFZ1NxhhLhc01tEccjqPjFMHkYyOl0LI9Y/OpDDaOXWpnDwWK3Rkghotyo5AVwomIA25VPrwSPWLzfkgAJ2R2o4cPqvXiOsDYWrAwWNtHGxobBCqj9xPXD4aJU8sLA/elcKGVou9+TQyrPqL59G4EARt9kR4W2d+9PoPpBhh4eUe31XDi/oL10dvra8B2TYocGefxHsB6tjV5cWtnsgHBJO2dcvhZoFNG/MXxm6fuMAgWOD2PMvnwcaGGeQ7ywuf3ChDFJMEHVvXCw52ACbDChdfHW42MMpHujeF/hlAt8mg/LU2EgHoBjgoQlEDBqRFy+9crGCcIVT5fwNHAVgS+xcuvj+CpkqW290S8SjQdTP/ftc11cyR2l5QFwaMf/c6xlwFYud+VyOCzDqzN510pmpQuU3y4j4zDNmbrelBUOVR0o9xsSpoWb0TscXMFRpHPv+Rh4ngNF2/LaiwySpktDc6ItoFZ781nuc++wQyI6xQ2cO+yJqJRr2FC59VNjtDI5BgTOUenLUgAz6O4W11a2DI2oV1gLHg49jEcECeq3eEXojf0UBE/XB3TIxbCxx/L83oGBJqxfbmGj2MYM7LvXhwsV//ktGfFtT24P2q78R41bzuWkUrkE9jzGVag82hQv1Jm/g+EL092LhotQkxkXvOOEWzcMog0xt0FZncZRhAYPDGnHul4PWrw7k+DKuOC9kWW98V8TYpRejcMFeB8cXYFjIMhHhYqlE2GPMyk+5LmzVcoSh5pmLzsJl1goxxvqZhL3bijBTuTxwKMLE3TXVJ/jCeOCWZ00JrGN3jVfAtPj3WVnSkk/t7iRg5nT1IRIXYmoGC5cwJ5J4QzvhlpV6j6tHCUwKGO2P+sBj6xJZuEVq3+vffMcC1WSRutdfHl70VlUC3S0kUhMW0Z7GwmOMMdHu/GQtCo0QIKJduJEGQiuOiKh3Co6rMZjEnHsgyVls/GUC8BYYlq+0Ys8aLB7gM8TqTFXlyIPufIMztb+yi4n+wzI6UyYuOiP2zcrcmaLu2DpOAPV9fIb0FmskwTsyzk4xeT5PABbFwzOEfGZTjj+yG+/VMp8ZqnURKXB2BEcgRXcBkwCVX6uVAiFlnlZLAqY6jAgFB/4h0uD8JC4Qov3TyzgFqH9hHYVByj/rek8KNDNvdkUo732erwqY/PwsgZC2/NiXqgKoerklwuiV5T4mDV68zBmp/WeXRRK0qm+UMoeB2kIvEcDCCGej2N7LSITqfrgqnwVSemQfpwEz80aHs4ED6yRCq/vGrMyZuPP7fTkRMPN2V5yBjtFvlRBJ0Oq9NyWfBZRmuqRCa/ED7z1M+RvXanYqAOYb2zArN4xEUix0j+RRWTkEJAZLjbSBysiBTU5iMJxE+Yp6hEiNEjqcQuXCwCuMSJDGTXd2UnnU3vGbc5g0ab/diyuLmsef4z2p0i5V8efPMfILXyqlC/UL23z+xZ0vKy35ZAFU1nrZbTDzHe+rGaa8MLAjBmz94EWllKHBzNyAMmy420/zdIFUu1JV9AR7z9nJArM21ZdFDYmfr+BkAYOtItFDuuSqDNVLqz95haKHW74kl0XVCmDnrwtY5MRcoUfVDF9wNVLUoDSbcVbFwLzhUcTkrrypiaqm1LwBixj46xuyKGXYwJ1O6I6adNNyq0iabuCeD2pXtJC/vlhjScNwHfMFFCmzvYSShigxVE/UTfIUJSLfLfaVOEBRc9abrOHUUY7L2yRPl4qaWVtIHaJnEEULmlWUNqCrH4uWaU0f4MRx7ZVEXd5okjpXz4ocbO8kDnnhujJYX8EpwxwMz8ki1yyZtDk+ROSt1kQjc7owvXNL0UMutkgYqHi1L4scbGySMM3MLGVo1tdSRja4UlQZAHnCMKuX+7JyGHQShrg4iinHxnw3c6IwtU9rt4d6+zmp0hSnEWVoUWngNGHlkxvcrpOfkSq183wR3ybbyyhNmJlRMm7LXPXX1uUUYfWHi/LtgazuxF5fhRD+kjviKN8te4WqD7b8uc4yEumtA1Qh3Vm3QZSxNQ84lBps+J315QUpQElBuJOPR5S1YU44JUDtcFZlhsjWJYZs2gig0k0rITRP5VAAcLPbQalArR2Esr3VxClAGOEU7couiVAoFJhWHbDEJ8AIqET0G8vOCKzJ6yUs0ekvDSg4Ln/zMIm+9JYaCw3gTR9aSHSLLzAFSDT64FgzQi0yiYi3MAF2tAlX5yxQ6LF7Ig3LbC6awmQe7XRwlMFQB6EWe03I4qx/MlgYV4u5o2xDa7iA6jxZlGFBQ8ONyUuWfcU9cSGjftklL9oe1hU4sOstYcHm/YjAzx5qlWPKKPbnCX+xdxFFk0HDpiIKH0tX9ohjg+M6a6ISGocHfeTYscngml/+4FqsEiBc3gU7YowzaK7+6Ou/uBJRKdtbhToZKKHIe3/Nrz/x5F1NgKiUZrD06eghmEnJwzB36mceNtQASFRSsf3+W+Nb68GvJXMJgXz26buKgJyosJI3Pz54/Oae/FpJUSxf+tSBnETlzVGblvFd0+O9boXIFhOAzeHwdI5EpTYGquvuXMXlau9yi8U+oN8mo6JLmHGEk711cU/9FhIBKK3lU/fYFfc6sxuyQ+Ck4svfvS9XoBlQo1PKZYLzG18gzGwJ5p4AidCU7nj8IcLbCNyvXHjiAjYB6ns7NXBQWZBXC9eKi0NVAtU0GyagbSnfnR8antjqgBwoSMr32gomwfT7MxMLbZBswtVemusFU3f58lNX2iAwQWu8N7+JHDwW1edeKuyDMOHrqGx3DA4c6mMjjSARkwXFmToobHpTYwc4EZ/NYHFkzbJDplPOM2K2qI5P1ZEdLiLE1V8cWcsRDhLJBLmhMvLxYi7ZAWLIg+zoYOLVdxZyMjsoDAIR7KI59to7k3Uy7GAQuUEEvAS1Gx/33eu9977k44DFRkWYsJeAgYe+/9cXLPoYYGjszO1jgl8pwYaR27zoZ/MVz6I3s5FLxKAkQNt/jlU0i8ZntRoRKTlGf0KlX37nzQY4HpDyr5hDFa3xyT9W2sSluMvZ3oigoVDlL/x6UXdKiggx+C1fIqKmMA2e//1CP7cBSVFgFUeb4vRL3t949ZL3YbGRAcz/9VvTnc2y8y6AEgCt0W1O3/ibvvbo+7zqtzeHRcKsPl/PP1txe3ZtRz2JsDDH51Bc+bo+SN/53JyFJJ8fb9AyWUe6Kdvez1F7cek1TzjQlYl7Ym+tdWqGQeWJBeRo/uxQOEz7tQt33UlDf53Pb+4uzA9Er3ajd8/+fZta4t7BdEM+HVuUz0/nEEj3PgkrO2PAd+j1UY53mQ4nrGkrxDuxUea0MxpDl2bbCBDFzeCwMjKIo+pdmeCOHBDgIbuJ5Yj7jtYZTtWI3vy1q3uINUtnnHUIqTxsMqC/UzM6+N/WXRpwvEwkyinzuDK+ZTYZnbXLH26TcdLZU776rSuIvm1lQLc4O3x1B7jjHuJTAjPu8sZJ07oYk0Fr9oPbFUEcqQQtDz/FR8NHfEQC6hv7c9evTxcH3FSOCkms2nTwWQe5dQYE0FybGPpkHpy4lRLumTdGQ0du3qlszA2N71XrgHTEJh7lWFloc27byfuHEEdskHH0cLO8MTyysMctduw7A4tCd2DVV1vg1en5hUodEJgYTfduvNuLPjOWTvcUWE+3+jurM4XC9sEuSF4f0fddojj1RiWjcr0pqNeADIyJTyN/0mt+eubF182muOGcOZEdbLU1lF0+42pbLLSXV3bbAJkx66zUk+ZkR633/hw2x2bGxGr7S8+Zu/KXr3vYA42rz7nFWc1I11o2lvvSpe6gBSDAnKJj4DccrTxbWUUcb6JVtO2a/e3TbtufYn1bc5cAGRhz2tI7/uHs6FirTfBxUTv7h1duAXBuPSynW8Dmcyl++ol52VFRXnqYCBZ73vqY3jRIYn3liLAYvH2t6Sj4jlYhk+OHqWfeXiBCqeE+Z0cBdm+Q5fGTGe8FJ0Ipq93ZjY7G/IAYFiBCqvqFS0y3TIORu3EEgQir2bWnzgnfGnOwhfIoCq4o+fk2viWw0UBOMSBdOtMkuzUT92PSrJntrmyA/f9YzSkpTzQgUvs/fp33yz4ZzFw2CVei44k/v9nrRCY/N0faFRp//XkIH4dKw53MSQdB3cnvrqPjzPYS6dfB1YvzB+CbQLeTgJDjYOTdLW4uL+7i9AO52NjpWAYrX9gXaViwNb0vDB7kpGO/1Hq5x1R6+ZsSkuCUU5YQn/uQ0xFi/oJ//uWQLv4cSkcgzvtrQ375M/c4JQH5sRbO/K6Vlsjt7LJfPGalJXbt4kffJS2L7Ja+L/74QSslgbUO3fzPA1SZIPuNQ8/AOVWXOOnnX5+h6uxm3vTmLY15pSVouM2D77YpnZgE9W0NSkyIY/4/5v//axgAVlA4IGxBAADQ6wCdASpUAVQBPkkijkSioiEUOkVoKASEpu4XSOABm8LLt76y9hXtvy99nLj3tn+H/f/2h7V+ovs3y+ejPN5/z/Vr+rvYL/Wr9kevn5j/2+/aX3eP+b+4nvb/vP5QfAd/Qf9f/9uxR/yv/M9hL+a/5L/7ezt/4v3i+Ez+o/8T90vgE/lX93/9X5//IB6AHqH/wD9/+5H/x34k/rn8n/EP9J+SX7t+svmR+MfwnHQ7A81v5x+Sf53+S9QvBf516i/5Z/Rf9f6dEUTrN9l/5fUX9sPtX+2+4f4Fvz/ObxA/6R/WP+H5XH/S8kj1/9e/gA/oH9X/2f+N/Lj6YP8n/3f6j/XftP7of0T/Zf9//P/AJ/LP6f/vP79/j/2b+eb2PfuP/4fdC/Wz7/zZLDJl8vl8vl8vl8vl8vl8vlIX6GOvxnQqg0Gg0Gg0Gg0GMjsGPEDX003SnBnaLeml3P3Xd8d82/+vsUdZKpF04hP0tDfGSDiLTe/yJTk6VvINhsNhlI4HVBbKIQUyFUSyQ4QK3YeptuM30qUVtrFH++L9DHRXVFWemuiCuEvkBo4s1cEjo3rEV1NZ095r7ZFX13Fhl/TT6l9Pry+Xy+SuoAxCUhIfcosyhKugeB5h/Qo85FDlySk75HVWSt4kDqLFeLGmsLGIuMNQAyViAa0LSFPixxiluom5ufqYUziscBzDK955tuRLNIoozoEarHu5ph5BrzlmGdo34NMsurm2YuScXlHikHAkS0pKi0vg/mbqlx3kYiOadRc7Hou+B0zUrNHM1lvV06bicAYTnqw8T0KLJnlr1RWonDxzrrxhVtg/BfeMVFeMH7J4jKJXP4PlB7YZWkhvYwJhk9tMIBEy+v3IbmGo6c7fKNA/TojdD+JZOPrGff09Svq6ZIYh8z7wt7UZHHyP6NrwUYF+CLEwqTkInaUAUJ8DhDA1DqfLhJlk+pw+EpwUMTzKDxdx9wJkGi9bORa+gtpG1G+owlvH9ZJlW51HObOdmnGwn5Pu7OcXflknnzMcNwah0MEjgVTHwecmAGwe/HBcsRXtlCAEF1hDUkM+bYsffoteM7Fm5vHFFGs8pKxadY0OC8ifUquZOzHmqUHxkHsdRVFoynj4ng/x+mb0G9p9ojZE3FVbzXBs014B0UwR7IDQq9S6lhRWtIOrTsACJLRlGo+gGiDKcTTYM6OgZSmeOBnVAVyOpF9+xQOg7UVjrBEz1aM70nkNwL5oHjs314dv/HRD3dDFarra269Tn3yRihQep5fIP631xikR8nDI9uYt2UnU0MDjTWFvHwCVoeHLMw4KMV6qZ5MTRMPZHpXhy/jd1xLb8BaJiuAC2pWvHkuDwo3W8fCVPg/+4S///E9+vKesZUUzrlo6FzPJJWMwiFAP+PUDSbwvD3prwsF9i4R1AnqRbgaL7dju+3Mwu8KP5V7KYIOC/jQ1mftvNPM6hQL5xn7uWzdVCjbaNNI/do9xZYwnxtWaLxm1WsXoB3N2ERKptBMGOVAh0zHFu9m6iawqtNp39rR73iAZ/y6/BH7HLzrpEzZNRcsH10AjoARiFg5yylOL7bXS3lpitYnYKKrCLr/2PO2DFxyUYuhR9wPFpKMT/nYK+tVP+leqssVO3BOt73I3x+G01eJZX+kKs19+I2h5JOL4VkdXkHQYWfQEOoWXcslVw/R+Duh/35CYZ+tt9+0jW7YXkPUGoOA/Z80lm+GkHrIz+oj7l1eM20xuvEyqs5bu1Ebz4yCGmV9gS56em9sttNz5rlXZZHqneYc1NlJU0TQNz8B6o7wgNEO0ecaT/D50b7jY3NAuWlUl2elFYbGwAypq40OPEjaAY9G5qaE6nImzXLSlU3H1hs6ePozYwEcm7dJT8NcvuGCND25cvkvyz9gIiJ/WTnObic1EwWLRVOKfZixVgbxUon3ixZRa8CXEV4reXrh6LAiY8cPDYCP1pq+9n09O0ry4f+Hz5Qd5e8DiUREOR1n7iv8hrWamyBvx6iBo/UWSA8tY5S1OV5OnJ+NNV68pLhhUIDJ6vBGZYxhZZ7TD3Nj8oCiAaCd7RHWJSEXkkLnx2JXyzDAHY/Xae78W3XlrTsKJYACY9+/vU3s/+D91NeWH6G8ksDMhY3nC6JN1QrfPTcMnQjUrWgZ3ZmghXNn8784JFXKYWndsYbLqP9gcNiEjm/vN9Z4fm0w6w0+zBn8rDukr494N2L45sv88fLhWvBhjbGKsxLghRNGH6R6b5d18Qu8qPKH/wzIqYM0yQW1C29EfUTG8p3KhoET+lxpjz23wcy1wTLcOlHMlNEBNilfJkQW+P3nfftkaOtHyqT1sNtj5vzBpvHByculIz+mmaIDOQ7Lb+TabTabSxIzADmGmM8zzwC6efNC1LKPFE9P+zm9Oq88ODc2x82ASIy1RZFM/fd/F/+5DrkuHSm5s/n874uYqsTI2/n0HfNC/LgcfpbRGfnph7mz+fz+fz+fz+d4pJnx87vtc34Ds3Nn8/n8/n8/n8/n8/n8/n8/n8/n8/n8/n8/OAAD+/QXwAB/0ysYi4f1AXl5K7s/sNhjA/PwXVrS8M6DaNL0ReLUkMJUX7vJB2RT7wf6deyE5nBIUzArK5OY6KmtOgGgDTGZQmnRU5Df+fP5K6/7AXc4Wsiske5IXcW0vb7gyQp5gVluvC5ThoAvm63MiYz1m6g6+L9475Gf1TcQ+QHDEx3HK0iZ/6EzWFXYg2KyOg5YY3oWme6S+0rcBqS1U79v/T5/NjsxShgi8kLjz/Numv4T/YWrrgDvTCEZcnKRUr9YA67Txq/Y+BCKfPBNDrhrwgPWO545osMT1d/4Pjrz4qchLd6Ng3Blsur+LhPC73wY/8Z/vH+QI77ECJvsrWuh1JDzHDKSsu1Xk/ebcBYixOrkj1SQifGfR8eM5o7X09gR3YpdcMmfc9JASA93Dxj62Qx0FVB4ID+eV9N4VOwDOh0sDPqWUKUsImqUOWC0p+eucpbqPXDP91iDDyIva8a5Q1OX/pJbSDWRB41WL7RCsuyUHH4Z+9wTL689pze354IXddPyb7r4DIpF279c43clPUh43teaxlRklNsuWBxOBpJRVe8DnY1pWpfpEv7ct/jS4XjS7es9Zu9CsS1cEou98MNOUioOfksYNd95JjKOqlM6dJBIkFeEDTs7wJHwm/IsxKbSOmggRxLw+bNdM4UrQl9ZT0bcxDwsHaJ2KAE6eMZ/mvgPZNW7IEAyx8IoF+Ks3Tw2aSZdmL4SgB+ck3stXAw3Pq6K9Ms87xlc+0EAsq6Qd19814K3KUxha/ZXPY6P+YN4chnMuTmr+Us39tb/Ai0vZk+TUqxF2yujjQT4Efm3afoAnULOxP8zRuHWQ/JoMyjBIdTEAGC4RdxFRE9sfY/v49c8l1WUg/5UNIR3OZxfhItWpk5BQLX3a5ASyi2TBK91lfxBDMj52x1PbejZY1L/f6kL7WNBLwlqzo+7plWK6+1+WyftgP65gYJhtjtyS5l+GmBV3BtYd1CzdbCG9PEVPYkNVWJL97sBAWjL8rFZ8fXRsU/iu3yBxIbwTg5bL3yGgPheyYdgJieDBz9WMzu27A6WJ8d7bKz9fzz3BOROeaJJGyNjnCmcj56LAfi/rj0IWctglPDnz/EKCqbbbul9sis7d9s8sIhvD0CcNmeSSa8WMopQJQoVajzg3628eEO88ozwF/rJiTK6b26gs2MeeH+UnbIGSVJRctB/riuEg8otKHlV3p/WADcjyzVUErLSiV4m6on2kwbL+bq6c6iV3TIuZYHYYL5wrxzY6HABqjAnGEXCBF4O1aTQGzG560wMfZHT4JvNcOTxwzQfj4FC3Hti8XS+Ef+5/URuFm+aUBlw1tuwvA43A4Ydgh9J6EsgH/nQ4t9rKuI4/939DwM+kiQ6l9ZJm2kgLV8megLRdbCFd9tEdoykUw2AzdMjzuPAicNCqEDkQFSgWPD6zqHXjYORj+CxUbKbf9BTZuVp/3HwMElHZS8Sc566UTYxYpMKiPIYyu6iTJnqxIgvUEPufsRN71yf9vp1ZA5NU9kgE2WdsSjYzuSCe/5e2fBo3kwKfFTG1qspkpkqlwE0Qjajl88AIigxCH59lm73mIagwEeHfC6Y+R5qE1q+Xk+ZHIfGYVf++6/sdi/H7vH/URejLmcGczK5Jz7MpRcKGDaA30YR+fVwRBoXQO90mJxza8E22kUHdlMuYzHQVYhAVpptsDLuy8mqfk2A+8wStKgWq2CeuUXnV/HT8tr81czwQ73UFoRSpQzCpvtYayTyb5DtKDXgOYO70nyRsPV+gehDEMKgEV2EaReMjtmTnNthMAZCPlKT8RWY68UZp9et/382da6cPI9SzejubllmSodiQinWj54ahql/zQJV1iybirpEGyiS1POtDvRKIPV43Y/funii4tyEdBtOJN6yun3OMOyDZspaTXpLdmDRRD6BaNkKqvbjkrWmw1+m3qf2Qyn0XqRCMlq/4W96C7D+L2BP1gfencVA3bCu2KUrjivdpTHUmT3HCVO2WVGH58tcz9mSL5GgcRipyoP6Ac6pz7/SxgNg8CZ6ueUFV0oE55j19zDi6VpZzXp/kdWI3CDTt8/ZX+zzFew1We/r8fpvBC7Crb5iOjcMyC1S1TjMmkpRjJFrwNCKdqJajj7L6ES8BaflV0Tci49Y0fp13MU+85+Nsi6eRo3M6U3e50ZaryGtsQKvPHbvkNR0LRk5YaIfN0hu3HgR4Rw1o2Vo7J4mPXNkDJeBssm3Oa2FGDiju8wrZUF5xYb1zdpejxDVn3B7GJkQnrwE3nJIvn19Tt9pb/gqFEbD6WClrdUa9heJRa/x8Q78N/GQR9j7kjbSCTLd3SHC6ZFCOpcjjhYngk2U6OTYenkqa8FXxtaqGrbbRU3oFHRXVmbjzMHfJOXxQnbnIkWlFjLModrP+kQIJeKkP8axlXZhBtnwOLj0D8bcb5EeY7U0PYn3uinzMjhLDn56oQjfdX2SQB1b1IVZBOzBUa7danb90hPiywHRGANX8odrtNKCYPGEFCPtL5Vo7CMpLRnWt4lEYaeW3o+bQ9PNRwNhD4IVs7iJyllpEYkQS5k+bs+YuLgOgjqzOddpo4FlkolLVpioxUmza/bvY/GFDUr4TJAjQPluGHqNyfkYw2xVy1P25ru0nWJRTzeZECThlVi/sElnL8VdMNy3tAcuh3YBxYhuV/VP5vFXVmY4U1VEKf7kobzobk3I14o7tvIyFV9XX26n/58PGCksrCmLf7n6BlJxjOdBN6nM+1C3Wq5R3dO2dSWkMYPiwQBd7R2TXrtaGDISDAsLHQ/NyGb9WlyGe4QX8m5T9UpocUEEfESqp/JQyRwPffXQ/US1P/RceL60mwOU7Ikvnb6MLx3Nwa1b5H9tFk/lTPuhMWGbP/iuMvM3k1vS6T+Xr8nVhhTQFGMv4W4v6GTwZCkyI833Kd3PdJdDMIacAe5NlThoapmhCTrVU2X2ZrZUiupGSPsybr/PD22+HWlNEwJV2sYzHdbg2PLXQWXmmceNpyK4hRJVQ1OjaSMlXRj58zpjmeHSgAbTI3Tf0IXcxzUk1r7xndIZsVkQOVTA/8K3yW/ZAxqDmR8mVoWn9Pp2W9hL5THveQAAyb37V7f1dYR2h5hDeGK25HHjVkd1j7yPg1T6Z25nCF/nDETo3W3YxLJOuBDGVh6wK6fYOc/feFL3x01pVvmgbMfI0bO5YxqVyV77KfiW2+YUtk8A29sIJRgbXwm8/k83tgFURVyXEeMDW/36otz6EbjZbUEc+k9a+MADmX9/q6tpD1pC0a+/OG7Z7GOSvTdtoCicuTT3glnVMBOLpdNJv58qY8VjKMXPy49aJuxjZMk4w6QLRSVmvthFYp8Gjb4yrqGJbvRYxQSHUnjifaWjRXRXnNUqyAa1FO/XDx2btphhRP2kR2XBc1V1FL73t3ugd6K+iOORLhZQxkqfu+t6TdjB3HgfsEtKW5DS6Zp3CY6GFiez3s/Xb0I4OjpZDUFw0VSKYxgvdik9WdCIiXsdmpaVtarhNyRfMwl7CB1l1x10pLO60f5Vcaz9ql3RiGxbu3NMgmTOeuAtL8JIzX0iST2NRIK8wfPbYpqaKwOEcOFJLOnjKznWvnKQkKGWQ++febg3rU8i5yOuYghMmoXDn1E9ppK6B/Nj+r28wBbaGQTA7TUrkIF87nnmrrUIGuH5/kYfaTCscZH8OUTeUVNe3nLE4R67yoc1unNUt68dwiMVhYqXymgrxzDpkqwmNmmIjkvwDsf0zMzi6SO1Coz1kPA31ZeuEcdYrxI0N7HrjSh5yEngW96ixKKQItWSE6nbzw8PWUhVyMUU3Ex9Rri9xFzi0uRrWG+eACWQFhXRjP2oERfJAf8F1JVm4zoRN2AIXLucVLwkA+5Dwffl9//xQME+0peVrIVIvlAldcuplRH7aHYOOzBL2G3kI70I52/JfkavlZcofHEpjnthlw3eGxMRZzWc6+KwcJcsWVYo5RufSD2j5Vhw2GYXqxnq1LHhn/uGRaTqxIrAXg9dk2XmRAGxsumdbuBIqyLW4ePLRiCc5cozHRvR2jOwYEuPWRa+ubNH0HKbSdpInGZHLeli+IykWCPocseMKZyI5ndhas96HCpnZhfO+149aMidXHZbpnRpNu/hfadweBCWmES67yPFlF6vhyUvMwhBKZdmvUN+mhpN1yLfTz31TF14Qz4r1bKvrOLr69k5854a59/qAkZr7esoO1IqCColxCGnsO1G+9nHV+/E+I3P+hAsC+i3tUftE5YUUT2pT9EU7cMaxncb5PxYh66a7+bRlsQiSIGe1nnvJ+PY/gZD4k2yHFk4x8UzTvLw03MWmNbjVtMNwWCinQjiJNhJiOXj2WpMj4ugjyqhCcvP2i8SeJ6i3Xt/HDincqz/zj4DBVM661kHznMRik0HhgLOYs98wfal8zponnmRZbfmXssWNhWh90z3+L5rrRXqS9w0XLu29lZGtQnBaQJcuh8YXQ2WHUG5aDsZNbxqbGUtf9OFZJW2k9sZtN6kZyEUvDHU3EGTxUR/H2f9JHIpXyfz7ivFgcOgy5LBZ7bWvTKVQ+UMg3iIXjREhltVyxMze69yVfaSZ+v2JLZIX0NZYZj1mGUYSv5r3MaoikK8TBB32cUcSgVBqDNSSrReNBUHlBk+FA5i5Ax5sbs2v8CoQ5PLM/g8umXFm1mHfRGnvARgWZ+6lfw8CE0GHw2pIO9Wrl/Of0+rbQvAXMIH3osXu3/e54zX4L3wMagEHVe01I0ZIKHALIEa+CgMsic4RMtYOp/DIBJB5CZ7TSYZakMwsGr01HCeq3sCrcdlU4dIVD7bxGg8A8HtUFbuKKltejQ0GtdbVUvXLp3tQ5KUr0ML66o5kZm8tkN9ARymbqu17IdAc7/Uv2FbSOFpmGZwFNG5f0c5yTMiBc7P2JD3D9qrphgdPhwkeMTZ5Bi5OjQuXWzmxVygdh4WeYsVWKAOCQ3bry/IokfNycye4rTi+LonI5p4Ahg5tvAR6D8FOUPtl1yExe7xWWdmxgppo6q8ewiTmWIOUxrXpNwfKaWqIVenxQQlrOkga/pGneek6KOW6/NGdLrNrJYDxNc8AgtFQDqkDHXZADBI6ezW6QtMiyfHt7EtLTTLAY9i34dw06Zg3bHQLHymlMZkeUx/V2IE3F9MAU+jq/St6sW5BPTqfBfsi4lEt1ZVzdy9j+mSVRQrGKMp1fxOu5qv4V2hio+AxUF2hUJXHy8V4NWu9P0Rb7vVPW2cL5gooz4bIxHO7mgrzQU6ezkIPodv4z+YtX0HQn8FFkZeMo+cNujvZVs/NLpf6Lk6Wz+cY++pne0lKPTiGJBPYR7Zo1S4Z/96aeMj4874DWW4IFkkzHoHYtA9z2LrvRna7c2VhmqSd1Z8LdxD2UBDQv/svQOyUKAc5gHwZd7KwxZ8bTGagw5/aonxCvKlHJcS/1tPT+JGb2cZKXVWhTsMlkzJJf9Z+/1MC1Vzg+PSE7c2gC++klwM9F9FSHX7nFgJ+XqSGgAePZrk+atro+VIC6luUA9VFaa3QSfR0v4Kv9l6ZkCyQe3PGK1VFsF8GWagK2boId42HgDlhT/ahwhmbGyS66wzMScpFLEdICYu+bt2y09QwUo18VCdKU35RnpsIW04HQX8+u97mbPDKxIEflqeuRiFwwdG3mtkFDVBj99Etpz52kO7Z3PBgA+d5/VNNNmmWD+3mzs0xSmp77eGKNYobsZzjtaaxs3FPxgvuN3FzBMRXyoAVIyx3iXv+CoyczwypPzr/nG9SzN5P5kUbOECnE4L5kfF/Tb02r2zLMrubZg5DMoomjTPuZPM2W1TLVejC3fExGwFtqLRpFO8AAt0BG8WYXzB7aBa1DMPTxGe6n5LpsaYQyeC6GvFQtgTRgm1lSKIzqsYpp5NKRaghdYVEMH5uU7rK55XNIJB8hJnS9M0uWhS8QlNa1AbOWRElGSpKv08U7BR2cqBG9yan7e/s75Nd5GZ5FsIiarFWCvJQOfaGA46c/MhCGGs7YKdGhJNFQR9jkxsWKJRkmjLnJJa+6aeWkBGET3IldEI0VGstttcf2IzN41wqlejDy/Zvat6IZOJjnoQR91jFaf7aJCjCnxHq3FFzZEqP0IBXEiMlgfSFRCKvGxpHfddW3sT6N08Lr6y6W0Qu47YO3rmv9zgQjEKbkYL/rUl+0GRTyUSPBOdsJtiLRmgo+viFaoOgRHbiP4QvoLEaquVh/PDLBJiMy3EVQV8CpvOmnPtLOX0lxC1c6phtltKRUjRhDEfGZ2CdWu8cqZcokpYzof4BAT7d0fRawbPQhACPN0wk0j9aAyUh9SbHz78k6Er+5Cv7jvzKWq6Ec+gydtKNb/kJwHKGwk2sigah0S7fPcKnzLg6Zk1Y+qjFK5QyxLlt1Ae/OBH2ZL3fkoCILa/E39kDMF67Z72uuYjwYAJ1L4k4ON1WemzyNeGSnNKSfzhWZpiUYdrpWPbDvSsSaGseiQ62wlb1BYZuVIaSUIJsK7I2pEGtsYT8TkAXuU7qmYIMXScSyi3eqM5r55strvGsDQxO1s10CeBWri7esTcG4aYdKl3YAp/bMtaKTUjbcy4l5xaQgmIhAwvO4Rv0Av1n8kJdUk4Y4Jy2jOoZg06JLUJxY7esPlcWFuJaeHKBmqBgBNeklV8s0Sa43bMakiHWLO2AGe8DtlHcXualkF67HQN0d2OlpaEy6X+1fJSRo17d9a4cmjH2zxrnPRlx28fR6nTYwJSV2O9fgmrT4ubV0bUmwsqDuLMiuhq7digsIvNwZkAOYjE2WeIfSiml9Tum6OQTj0HLiuEunNWKd9ux6ABkjUpE27/s8J7zfavNU9D1irgvDHBfocPuGkEjOjJ26l9Z0DZEwoATKdMrvfvCFnlaPfuLY3p5fxmmEizY3D5lBrnr9vafyS5rXgrvus2mlxi/bQDU/RKn0ayD8Qc2vCGBoLkx+FH64c5oefjmv8D5Gs5T/jF5+lzHcifUcrwcCeEjKTisvBSXgOcgCIMPDZhdbCFyriEs6Mu1aBS4oxiwtImJKOS0KDXLm4J+lWHlkSBqnofYkdAK8cO9ZPkvVc7IqeZNeLXGTDh6LH4GDYivA8UGyOxhaoqb9hVI/YqHG5XoxmApOdw6kZBSDpB1FoCbZ7yPZKZJojIzzb0z9VssvjKu2pV4fdfvrjcuxzuzSCVm6ZQ5tVV8YMuzHu1tONuTKePR4IxqoakfhZ+SDUAxRdCHNkd61dCS2E5GCixsorPk+WV/vtzXcnrkuCwi7CWzHHMJls0lbCVLR9jUm9LMJWXdZzkKbYsEKx+kYyj4aXm34pvOwLZwXxHUWd8UCveJoEMfblZdYXRMBVR1pv1g4GUg85330Ok6x3bJOT9XTRuZnQk7I890NrcE5+vhRdiUjm6q95owm/YmgB5jFWaHY98PQFGSb91GwrCqHx5xfBgSUwi8c9mXGH4dbtpzFvGULDjXLtdMM7BkThnDeS8K+ZG56/7M4CEP9aQ1YgsqB4Rw9tUznF2aKopXvH1Fl3CkTWSwfjAC3PwyVgMYIo2N2SOLqGmiUecadFCY/a+MLgUdQG4IgZI9P5sc9At4NS0nLh0N5YTmnpR4lxXYRDltD6bTRH7ghPAiPnCxEu++i39JHs9NPbawdFjOQTf0TWFqWJtkj4/8O0V9coFkOzPaukjuwPgIXi5gccoXuPiA96LSoC6E9ZTZm3UoQvCKp94zY6QTIyZzOG4Dkhm9czoSTJb4RKpG6Quv6jI8Nh2Z6Mk8/uTQGy6f8LdZsitp7WfjbJe1rQcYf8saFEA3lRPe0tCCKvIvvoUETfXabvy4I6LgDwPAhRm6haW18MjXlqH25Hy2qWT7BldEh7sQrhzUlT6siXOhaescDx+k+KizISITpmzl19jpj8rAhP/O5bD/AxGuTNZgPVszUHdrXAKPhFvitBgZZwzmaLhGcBUeaeNN/GwP4v8kJp4oz9G8ZRzPuh/sw9XsNcHIZqnIw27y1a3AeVl8Vriq7GhCGzzVl1dR9WzUuzz7ZHpLrfKYx4nm5WnLBRooaGn2Xq4nCGmCF3fs2wWd0eKb1+EMw7HdIz9GrXWHq6P/BJ4vZYWoc2mPyOhLPSESqdNS+tCyBtDbQiOp3svkir2Rpf25COQwagZGhc8Yw6ucZwIZ9eeKPzfHBihBYACTWuHsi78rXMv0niFjBzrmpW916wCMRPGASxCTxPBb1kMtZ1dCXVbZ/1FxlumEIThHLImk4IlF+578JbDtoer6BooBdViPHHem175FeNKSEVUhJ/sgFuVzLqJdpGO9H7FqLoE2zOVKBAtEPI8DZR4bwcDGshnwz/Q0D26hXqshvjUmBoZnPRYB3+QU0k+RsoIb9opcT4Tt0eSD0uvDh2LfbtxWvhc5YSncXY57NeGrfH467Pbepha95bS0BnRaAJHsxEoncB/43zOFknSxabN90GpQbZ5oD/xnD3AYfQoL2cB8ueM4OXy5dIDRmRF81y9Ty1Pg8vj9K/IJnNnxSV5b9qvY+rJnIKeoBPY24FjA/XtSnKD0AHpV3ovhsY1itIYDi2HAuilAUqyTAUuEjydYUYFZ2bzUpyG9qUY1IOehE1wHcrteCCFYw1gzzLxNzxkKyeVhAOYUKcCOmOxBl+lN/CwHEnfJ4TJ0xszRcARIlNLbuj2ksfgDZ/RduVIIzZDh61ST6oFhoWW5p2+ncGIM0tSxrjOtksPQrdyT35xCqymZE3Iat0dcdYkqbXRUcf8sb4mMwK7St37zWOFwttFCT5B04eFKFKGrqpphqGKgI2wA8P5r0Gzm/F+PmgbiG8tTvbinYlfXyvMdM5h1yq+fYYJE0IuK2vj+T7gev+rJa1XSLq304LwUhe/1xQ1u0OOpmn7d+kdjxaFXQC7VH5kZJuFmETC0UGWHHkCLwm9ddqITvYMCSxV430AHvXRlK9JyFoSVHxcoKgwrUkTVjqxAa/Krj0pzfJmXKRbvViVm5Jcspjwwu1xNLXX8j5dtX5lJOEJb0rT/j1NQ2IEn+cZ/63q/Gxxxnz4+Kl1Zd/yZilX3QNPFlatpuWWdAIoStq6AZ4z+wR0nafmVcR/HevGlpAdqdzl0SXi2UKMOVASw/U+ZAwPQDifwQBb+ZTXta96EhBxw4/thdNHcxDwFJdhzwi6mN1gzFtrEpaJCkFojNrX9C94nUcpagsQPX5lxvQsFai8mxXecuwrg3jIjUD/pN0H51ZY1ZbKcTHovSYYxj16cCt+kcNtTrfP1gOVCdVaC+5H4h5Ox/M4V0olWwwd9oDqd3qv5Zvf2VI179eBo4zkww6o8XwZzpY7BuEep3ump8/GlKuvvaQdlPVFe20Gb19DPeKM7UOwMj2h6pMQjBiKcaeHMIgBFVDgh41vL+nzTTwafQkpk+dYr61490nl7oX3b2AUM3SGb9wL7KFpV3hnpZHwXUVa7MfWIVU+9lWGZsASb+pp2BF3QxUPRM2zqIyXTxCfVIv7F5xl1qylezEIxepLDYsz6ai4HUj/k8AcuRr+U1I9Ne/PZZ8DSOfIlHaSJWRbqVoFJB87gS3maMgVw4mrk2QxTueTiHVic6wiXfwrljxPIdGCjG0YUMpPx5vTVRhsaspQyuLWTntpjQFv6XBBm1OsSRtEIIWMRcwjA2kYxcqi/Ybb+S2fLJJD+yfvhVRjTzLEAxORZHsnD9dUBSYB51mkFfck9mk+bot868wRSgtE94hwh++NZfd9BFy86L/xfNPWK3S/wOGCUBhCiNvWEvHSAMLMlDRgyjEqmHRDAxGDhRUmXMyFCu5oxsXPzGfpIeYhnKWtOFOUKM+94pI1l4Z//E7IBXiJ4f05IglXVlWnGAJlzIPUUmjP1rEGcQANF+wVqtVJtx9r5y2HePiLw/MXSA/j8lCejdGpp1J1WSD5J5KOAo0UIBfPKYowd+/T9CEf8dZ/WZqZhL6eHxiOERZjRDpagnUwxzLNnmCC2huHEagSoR0tCfcqLvZUgfW30QgcttB/3w2VHrYs7FXk+Csr2iNwWukV+AoEYph3jKVRFiz3swgSZpBjuR1DCd1TmFKMfvXWuUN0tkE1To5eVGovw+eeo0HJ96awkBRtLgkYb43FbF98BNsMJt9saoYz9SFNlGFQc+/3qIXc+kHtT6+rZU45yLbxXwCSr7fVXKK2JWYfAh/j49WIACeY8KGqZL/0c/h5/y44ia/B9/j1cZhGOf3gnwxgpYhWoxWOhhXUbWQJKYzQFFLBOg4zqtS43s+FVLc2GvxgspA0nmYXW1xW6xfcmhbYIHlISQBdp+s53eJX5k52exOXRQs39ks6geaudJPmbrLUWoYfeIXo8uhpI+8+OL6IdPGvqDc/7GxpNQyRz0Jjaek7jVjh9zdoBz+LiDfoBlfmUri4Io+VipPgyY9nHV2u6TDYk/7c4oFXjSVlxrOqgghMW6g2BNGXKESHNqz8gA2eoHi1AYuoyvtncFIXeGaHOlIimIgq8b15KANBtw9Hi2sl7WWUxKnvl9Qog0uR4HS3SNd8Rrz2cVvJMJQbhadY6Cvb3Y+dAYJb1G9/EHPAP5ykr9y3mnTdSzS2pl7b9vCSR6dWkiEmWtwdAdsMeUFL9Bs3S5KP0LYT+A1ux7IXlMnDf1b72R2eCrliM7AAUVfDLF5ZulrseJVletGaDvhREkmO72e1W/0SqZIhafWTh4rJuJJMNpdZd25uRkguXn6hZXb95oAl6Vmk4iEbGFX9aaLq7t/Nw21HVlO1+JUwKGyTrqju6qNXUDhW1NwpEBrBayyQy2iJ2uM35UVnNn/rRos1JcLs3qQeu0toEzmMZ/a+7ouwprjDeQKlHqdmrD40GxT+DNFoKoIP8ZmGsQkFWDAxj4OH2J0MzIeL5qJEKD7b3iWtpmf7Vcjosg6QQ4P9Bqq8YH371qNte3lU0ZvKOTGkdPyyiUHjc8hPMRt9bkfPEx4lN0yeq8NRoUZXyH/ohi0Tuk9KgI2hBHoIbeN69LsGyPcxQD5alapkmOEul92GiPb+dEMMW2WgqgLNQFN4axAFVjNmklC4VhMzRFbhlrQeNbkZQNOemMFge4IW0qSznoff+9j07M87QpOd3HcQq85O4fYk7gjQraPLOd3ml7+Y9DR14xCkFMXggZ7IwKSaPj7sOMzZOzFpFUz0azepqQlFan3KHLfKzYT0zxRtpZF3etvKGN0Ww1AFMJ4+vBIR7CtA8JHmHATCZLz2BOA6jqpUny8kNOxbVAY+frYJzEURE+sLvXKKVfk9pJQSgDJMbh9EVWvuFXuHIrXygkaPcRKrcoJDtE0EBSpghLZJjtDXjfeX00WNu/fakG8sfAFMctNZNOuh7Stp8/wXrkTPB08xSPOitOzZs2e3D4h4dCMwHLs4dqU8CNfqOOR0n0CmqJ4FhEmzIHBus0aCbzA1PP0a0krZphrhB2d4BaoPw8007uURQd4k705yW2ydxSRUvWiy9DnOC8PnpvCfKLAiKzv5y3imUCJxaht+04SNb45R47GRivG8v5/Vme8gr/TRHrzBAzxVBmyVWaLFk49AjVNc6/hpRxKxuip1jdM8ciJ/waz6GoykxzIxOoxidlqAK1BOzrYbQwCrfzc3J3pNR/K4HSnpQEhKwpSfJ8a95Fm7i9aa4QOpTGPISadJ/CS1MfsmeccHZ2MrnpeeEGtt8y+1wymkz8EgBd0lju7jwchAAp/5JU3YjVu7Wly0fRrSTbjr8r6l8mgsnu4xEIB+Cx8iOGLXLbvK331nbR0PZgjrkrklJbl2RSlc6sOEOsRhLbVGJknCvbi8rbBqDBK/45VQCWsrF3KTastNEyJ8xteqthLey6Ov7MlhZaznR9jtOL6xRueIvuLuo71t7QR8BF2+iDNSjk//mhdORNyJgPVuNktdgjZcR8pXQGga8QQdOveczu9JHg88cbgsmHXd7+RD8M5QhxfwM31pGxFSkXn2qlCYLVQPZ+dbWZOvEP9b670db9wtsN8GpGb5H5JE4E34T8j66W1/GQwraf9myPPk938wiYSmd2BX/p7gzZyQ/7O3oGzAdOcDS5I60e9imUoMJPBVxdut/aOyxQf/pBO35g3aKQv/02YwJY0B+pOC4JKqLPTWmUSH6oXdWwgtCPkA3hbMtZLcn6zM6jsq+sG744ljxqyY4jt6c3QyihCy2kiRSLsdOf3oTOPE/soB/0nhUxJnDSpWgsz2TkZfWhw2UI6q1ohaaCm3sW7521tE5IbHE/jhyWFVABxo5RMAWgladXZHfRqAqhrqzhGpnz9ZTIF+uROAsgWGL2GAlWySYC2d0VzXccYX1Opu3L8N0CaxsrJV5p4GmaBpb+RYzMozOnBWitHY8LHNJbUybdTTDxrtGFvzoMhZ/VQvrVacwidE/T0HIzdJd/W6aZni5M6RwJQMVY2nIuV6PCmdRCb1ztWMvycms2SI1FJyPWsgypccaYNAOIMs4v6tN/4Jq38UeJTvG8+aGiP8AjrG6ubC8CZGfbRHUaFRL/Wsx0ymBD1AQ23vhyuaHAe32+lDsEvZWUn2/ndQj3NZDjGL0C1cWbsBaRv9/sBRMQ+dJHArys27RrwSdn4/xRhz8pfg+WvhDka46kkUUlIGzrYmLqbX1lXU8TMBWXYDQe8+ayrBpL5/q7oD/cQbbJaTSA6I0blhcNagN1h5w+oCy9+Y9ROPiQ0fD+CPA74xD3BCvCLz8yuhk4w4mX1eahu8L9ayMjI18b0OgmxR5MA9bK7wOwUB+b9TyLw17bdboss4dGXLO5goZ2i9UrQpveWBeISqEeaDhRnty6pSp7194wOMIwq7XF7i7WxN1v8mL/Exgu3zebUriCjx62M85hdtHsT27rTKz+rsVnd+I+v+AufkJPWv/6YvVFzMmEw8f5qZ9CPW6B7Gbm/6K3xrsXFx4+0awZD4ldeH7hdHM9IY9wE8QMVzSS41/TGd1lTn/o9wqR2Vvb4XpwLPP5r1wq9ZlSPUBstW6j50d2OJADLEG2RZRiY0TG/VeinX1429pMjKw5BHzBEv/I8CuQxz1VAU2LJ38fHp8vwPSp6Mj1bkIDE1wqsms62hAcoe93BHqM6RXTAiZUEV7ajqPS4IE4gl+gPUbLlJaE1RM5htoKS+Wk7J1XOA+Y3cXl2VeQuZLYyLz9GAVaJpr+qCJnOPg3ksDw3ytT/VDxtJS/190s5+F3x6398w83GS+pMadOPHxEmSiEH6A8MHB30A8AHwHlVhVe23bRC80cTterPPeCK0oEXRNGFCetjoQDqTW3jjkHhtCLV8GLyaPVWoYVkckYgnh/uk/3QGpUM6jqvVVS1P/PMv5fgpvC7fMRnaP4QObb3/XtFWJ+bvryW4pdXIu5F9td83C+0NeohCNu45hYfRYEPc/6Bfpt69J/I0jS4Lg/bpJM8hapGo2A+P7VOHeNCg6sSLufZbYPqRLzeTULoqFE+yS7zNZRjFnoyjNeFez2FsH+stDL7vlsB24+hzS+vMbWJ7kSfDtiwHeETv1hLZ9QUoiBBGzvq/VRtRIbkSHngsqqxSbUaT45uz0N7kpW2vzg4gpD1cClmGVFYlSyNyEfIUglhuMdvDugSVKy+jt8LchuCQljSnLCwCbrUkwSgULqxAcm+Cdabnr1pHPPCQvhbH4GzlHIXlT5dFsxNzY5t8JZ1vpMkR3ITF4zNKOPaagFCDohhtXiXhqZWztlYdAaV+KS3Tng5beJ7RwCav7jXImVSJqRM5o+2uuSymW6XwRZyNVVfQTu46rOF+ONe1W+qyOaAp3wZfT8pZlImcEhq1zjqFxk5DTFTJJI12TWpGxzhm2ZX5Ngdv/c+dPn5aVgk3I+UvvZrY5HEPHOm3sYRySWmsk/Zq7m4mdW/3/6y1HJnXm3Me2i5bCW+jiOjCTEJxrQC/bML9xIrEcrPFBMe5TVouE4p7orspkg1OqZsjrfmIShHG4do7HdNd7lrnwK7rFyqk+blw7/I/Iz9DRMQuJAS5wHLJoPVKckaMUneLL8kbDWjdkkIFEQWtAGcRX/e/ZlzX2T8iilQzQF5wrAXuBOEplNeivmPRKicr8nbkZFQyVgZmzHRkUh3YjlcSKUsH+dqp3yOgio6lg8NeO0M4P3N/E8JZsmK4ChpDIz/uc6RrArGrxV/y1KImyaW6SWICrVjW0+CIzIp0OhVwcHoV0SiD2zncEgERzlhdP4+dFtX9NcEQwnUY8uDa56MITQ8bZfzjT/U/NwOpzmPjs4eV5LLBRsXUD7qMFsOuoa0s3xiKkAA28L9oiJFPjR/4jGxYb84hc0igHKUbI3g6NWXUvRjNjU3G+NGvVRnGQbKJ2SdS+9b/YNfJHTBIQ3e8tHVJJLiQ/IoqokR1GcZD8Cpr92ohccDvZWOJSUSlpnVyfmqX2ij9nB0eoQ6QSO8Q3dhm0oVkH0SCd67RFwhOio1AP0QQVmYCldMFIer3JSVyX9PCJ4geXetrgTLJG6EXYH9MOGH/Ss4jPnpdEx8tRenb5DFC14lNnDrdR+VSzZQmLXxZDuzFNYic6OOL2Dz/IQioJNMC80RrTGldy+4hatAXhi1VfS1r9uaeix+yZOVhuLFycEFOkhemzVh/MoQidoAFF/MCuT+klKL2axqaSzfbTgR4FtCOMzB3ymiUvdoPcLhM3I8YmP+M8VoZvK8MLOY9fZJuNa5dWa4Xj7amvi10DXTbtngYbdpyz2WZwltmSxN3TUiqsj9p/smCpdynyfw6JyilWVG3uYD7K+64ccWbHxrn5tijLye058krW5eBSQAyU8AqaShp0/P2cnMF0rzP0Nfgpgf4BJIhl9tnblydS2WXTz/NBZ1Vn3tSFMlcLJZW7HaqHTBxF4Dzx43zybebsCK3ld3EGFTmjNMk68rv0Nd2w90C6d8EvvKK6fKhN8K9LMQfbbZuRT05LnO9cpPmDaqeRiv9dM/Roz4Xacjb84mrbjUhcYJr6LeB2WoQwcvEpSamsQLop8qtZsoNxg08OAvJy/WhyDe79SQ/Ea7B194AmUnsgeOwhrWKuaKuopgQNPS3KVOhxAvqtSCw7GvYDVi7jQlVmYXurDgprBokGEgXJkyFIlFWnilpXOmGvEVgis6Uyhg+cGiUWeIMMIRFJbRrhdqEWrx0Jxhq68ZfekUrnn0abhbKXt+qrcLbVHCPGEibi1/ddUpafp2JgnCGTcqt7sOIPyY9qGOWkOWg5X5UmtKfMUvXaPfCRKNenJLxfTUqte5TDfW0+ANwlywcnVqgNZFFcPoqdRD8AjedZV1lCD7P3dBg3wZt6exfCfpMEm/0Nwm4eZnYt+AoOWmEOwfGf27lFOzKnC0nKoZLC7PiCDiD2/JqfwXh+qhEdL0sBQltqbojnxBpLsqW/qywq452zjvhqcrZLCNjG2u3mHgVZfySN4CltG4dA5NSyZOd94UoKOLY0evUdS1eFOtHyhficEqb5ZTzhoBa4EE5LSTTz0eYKgZrCmqUNLxgusCHAtuJhHnYxZz6/dkxDrV14DdTDS4Eg6eAOU3ZnJLcAgVEuL17LRnLM/PM9fCrtuzV1QTMwd7wJdMLRivQnp/GtjzkBIx9c7a4HZ+Ytp1g9jwhZGH2yiIsT73U/5es6Q6+XOIWmFA6LymykdG7jr46zTVA1RNK+D+KPIC9oHsigEuwFEmXbHjy09H/X05hGGH0INRAAzWgFrPOGnra/QBSFWyh1d2x0K7FldBFeKDZGryI2barGcRrdcSax3IzcNXmwLxU+DEB7WZhm1hwnqFsMWsXmRlnuSfPXVHIXtJ8/p731t+IX71kArP6t47XwnePvJA0fAsEkXmc9VPDs9MJMbAm9Y1BTM28je0IFVA6I+DTTkKSoIYxzSWJS3hCigUzncuEuVr5dyjdSmSwL0b3iivhecda/qzoWhxNaDDSwQKmQtt9bhg76kQzV4tyY2ytgDXQCQmeRoFG9EZn/GKzMzsETTp9+rLGtacwooB+C0tFpcNQRxpv+9EylcLXKnSWB0oP1dB/6IQK9+21zNWcDC45rtJx0erSZt+KdPsTchsmmi2arWvtCD058jBg0A45T4V8ue5yDX6M2DJIqnXkqSa3XBdMif+PslN8H8/Mh+XxKJPqfEvHNf1Y/qTuAGv3r6520PnwhG86P43JFpUM1lkBppxhcveI0hBWVoIA4eE8EMP7RWj/zuYgmYg+oWIGXrc6ELnsnrNK/5RMj+AsAnECX2PMQm2J9mDlGUBWH0l0sJ/0rdissQFSNCe+pSFM53fc/D+A76cW5Ga8hb5wEnzQfEmiJzUXM/+ZrxJZEkifK/COCJHxVDxD0Qb84XicdBhnQxy60iK8OFZctubrD/WNjetlnTEUISKJbAkha7CO+eWfvcIS1OByq1ew79YLURu1C9PIUWN8Bg6zc7Cf7DNF4kTFamPsD3xFpeH7j+kzyOdFkxJoDokDt74ZMdJAbw/j5SPhXcQoQFGMHdX0s70FCQczOQ+K0lNephuEI9YwOlCazKMk18as6WcqqJycMw27GHFBfq8T7Z+eJlqofFSY11YdkjqOmpVf4d63y4fbOEQMZeR63ufeNLTYt4okeeOmT85yvyp+1eARsN/zhAX8F718OwXJo1ht59+uubtuP4vjN22eAw4toD+QI7CVEPmnRZIuQqRBiqp7btZ5fjqCgp7tuAf2hzFXAMcFbrfAjfx3ZA2bkrIwjDR7aEPv8uvR6EHYFEFHf58gflbYVRLLpLm1tDkYJELEs3FvvLMT1zgm8gebSgBsEB5XdJsF4L6QxATE7kX0OGGQqdLBkUgNnyBNXDAAA0RdIFsntRGo0slzbEfbnCinyNOxqom9Ur3O/AY+z22vKkv8iHM52kzG8UMCX5vv8as9kTvtZfzDBdjpXKROCUdAjFKglLc/6e3LFFr+8xcGNsh+Cwf76QPlvwrpdl1+nb9ajKvhQmiQmZb6IlYyS+XO/8hKbmBtiGEnC3R6X/e+q9C2+bc9LDUjuNRNGSyYYMI1rF6FKa0MHz+CEmG7jl4VYvw9FO+85ICSee5g5L9M7RQCnFP87cOF+yu5MDC9RaXD9X9xSIMyitDIqALivdYXEAyYXpMA5qm3VJt4ccpKKdyREkBZ2JJNgNU/blCSp5kfooqHi75KI5IUyz1nUrI+bDZZJ8PAEv9H+uhaecLac1pNTaAg70GJEqX/6vAHBs1hPx0nwTugXsm1oD7RvsALrTDMewA3hnNaN0p/r406Rkbu+7awk+n+1+uO6Cd9k4Ot6/aYPYYN7Nz0FhCX7d4QXHnlCDXcFFH7Ud2QqMQaT4eW7weSamDu41SNQi24eMWKT2rQWDmwm5AD6/Dm0m52EZTUapw8p0i3097/frOIAv47h8R9oCbk63LRAkPqeHOF1M2sDeJhw038zgb7E1j244HN8ivqQokB/7QRBLEUF42ybM8vU7HKDrPkM4gYyeNFMNMNvT3cWe+MCLK/pF0MkFr5uuVwLNlG2ZC10ML9XS+shIfQh1z9vZl/S1xHh/mYP6obsTXJhu/G/5FBByF5YRUBL/i7AEf0vto7M2Efj+OgOaQAAGsn+P2aXousr6MgOwJmi593pdEaQxG55BmaZd7ibkjoEw/6nYxZq/c7F88uBFToH27BMsIjG7ePbIvUBKvDTyhnBFbbDa2P0dKEOS+7wzAFPaKysCl7/LyWCjoRr//D0DcX4HP109dYpFhXeyLmimTZAajtwTY86cKlmq0xGxIwh/lLSqyAK15oOHAr/Q9nCYbVGHZGxdxC9HyNHEBNketf0Jbas5VTv/t229QA4fGdOMLlvTSV4+WEUdgYoZAPokQWpibMr8aFRe2Bs7Tfmj5LcjtcLJuAIunNTQgSU27EFRcpZh8oEx4QmUrNlRJh9bJogrJFcA69KgdW8k4IOnx+AjuOogtTTZ/8jXSCmIzQ3JUnNLXMWOFxj7SV5H78LCC+bCyBaia/rnyuAaAyDzLwnDHOyq4eDxqu4AuCRU9lHzMwzdzh5OVv46g3ayoRCiS1tRMLJBwzo3MAdBCkWp0MjPjFIKMNj46QGjuQIWAChaggAOWvkltK+rsDf6TJ2KqR9XCgoeSDRjukRABAgA7e5Ag3AQhwKGMVH6RIySqmBIQZlOAOHzmktYLduJsSXOTRfXqGeEQ+xuZJnAoPinSP/bmrZ4pOyurDpWEBicjntg9zRQ8FNmqCjv+5Pe7OUyDqw6XUHyFUsuJpSTvmau6SCFtdZhmsNcJsNjsxdEy6JI5wAbM2/yzVD8cHnzK+8sy90aKr0epqdRAsTtNnFy9RZ3+eeTiMk8VWk0H2JVNfQFmyBsiZD90S2X7DwTIxVLFYQXM3AyvwZzsr6ySg0+nsj3ghjfWjZOylCkuMv7093sbEzn7F5vUQtmeCZnz7c1r1uhVor9qlT4poWlQDyqPtfd5hHisbZQbLAASFKWsR5Y52zu9tLhuD/Hhu6SDY5vCDnhyPLyPJMsK33bK+4pMJURdgO3bApc6TfEV10ekEzig8g3ef/XqjIvih71o3ywBaWSa4NdW3lo99zMiz5v07CgqsmA/fkyAEx+E9NwCbPEvGOgZ0KZmfaNlWOORFdyTUjBtZ83g9UvTHS3Tvppjjr7+QKkfbuWyiD1YqggARxCNFZ8tGg2bYjy7He3oLSeLU9cKvadpLA1qICh9wRw74KVrV2jESxVp0whM6RKwnhs4qlOag8/jG8aksHY+AHezVcw74ZXexbYcn6zNuf+vub+/sOGoh3ADceRoxSzOaWH0Mdd4/atuF3qJ3Yh1+1ilmnkzuywEKgraHddHOZs/JjXLTTkiIuwmEq5Dy4lV0oYtYDn29jzRafzFoNgMGowuD6qBM5RAdh/5zitwqXY9W97YEgO5oQm0H9IWFMZ+xzYG7KaHH4loc46MQRHdXe3+VmKinTC8PnI4UZ8P6T4YPbJrmMzA9v880sTJVtcj4qPSWtnMO4gtfCoQcmzkNX4t2puE/XuyXvEvzz2P2mFxWauHGei+3/sSbkkAAC7VquqHWqzVniH3nopn5geIZQ220I2M9DDkmm6xPBMil908+iwoo8V8LJOGsV6d4oUP8KN/gb3fr47F+guhbanLeAy7hEUbCu3ralLcQ/ZXMigx1e/f8GL7ulrSSWAp39Ua5xNdqq+13rcYr8McvgkXz6AS3cIOhItfsNZ4zeut93q60+7QFbOUr6VQjivnoc5oglM4LTttKYAFEebHOfMcqEvqeke9+Q2XjI+hwzN2yAPTnBG3sBmq7DRAQetJHp8lw5UC/Xc2R/PvErmW8pwltPFu4+jSxHuzSWwv3rGhfBbCrp4aj+t1aTRzRe7wslZ/gYiq3gfXHyzY0zv+jL0LhypGvNmxqj3O7+nWTKxt1/8+oAJOF5rcdYmrt7fbKI/OImQBpRkHA4bVQ/0sjaClzQw5AypAPQy09NYmvHH/z/YB7lRJgKXSUW/+buZW73AG1B2QOKF6xX2/vldYpCgAAAGm36AGwpP1MOBDpfP6LwvOUBpqdSXjHPwP7rCA7wbaq6psf6D79/3RmTbW5mn7lfcKoYeCA5qyADxGm2jGUAfKICNBqjIcq54V4BJcxanfQocTZCoKSrN+dxzJtY64KmyJhrKtyBK/xdVcULjaIZBBCLv/GTVmHIbMELZEiWAepk/y/Be9ZvSP+PjzbWNfKiRYfjjvuCdpn3fhMNiv4AGkVEOn2iNSvG7Cn+ijYv7GnoB6ePfmXQV1lWFVNw4DwzWHc9dGHwAAADb6DBBfrtqgOtFjEEMVfIRC2G2Hao+2xi6WC3OqfA6Xo1mI107HyFt9zvOMwqEXrTy33uvxjJIAAAAAAAAA==';
    var roseTex = new THREE.TextureLoader().load(ROSE_URI);
    if ('colorSpace' in roseTex) roseTex.colorSpace = THREE.SRGBColorSpace;
    roseTex.anisotropy = 4;
    var rosePhotoMat = new THREE.MeshBasicMaterial({ map: roseTex, transparent: true, alphaTest: .18, side: THREE.DoubleSide, color: 0xFFFFFF });
    var haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 128;
    var hg = haloCanvas.getContext('2d'), hgrad = hg.createRadialGradient(64, 64, 4, 64, 64, 62);
    hgrad.addColorStop(0, 'rgba(120,175,255,.9)'); hgrad.addColorStop(.45, 'rgba(70,120,235,.45)'); hgrad.addColorStop(1, 'rgba(40,80,200,0)');
    hg.fillStyle = hgrad; hg.fillRect(0, 0, 128, 128);
    var haloTex = new THREE.CanvasTexture(haloCanvas);

    function makeRose(idx) {
      var g = new THREE.Group();
      var ped = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .5, 24), marble); ped.position.y = .25; g.add(ped);
      var pri = new THREE.Mesh(new THREE.TorusGeometry(.36, .03, 8, 32), pedRingMat); pri.rotation.x = Math.PI / 2; pri.position.y = .5; g.add(pri);
      var photoMat = new THREE.SpriteMaterial({ map: roseTex, transparent: true, alphaTest: .12, depthWrite: true, color: 0x4A5670 });
      var photo = new THREE.Sprite(photoMat);
      photo.position.set(0, 1.34, 0); photo.scale.set(1.5, 1.5, 1); photo.renderOrder = 2; g.add(photo);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      halo.position.set(0, 1.3, .05); halo.scale.set(2.2, 2.2, 1); halo.renderOrder = 3; g.add(halo);
      var glow = new THREE.PointLight(0x8FB8FF, 0, 10); glow.position.set(0, 1.3, 0); g.add(glow);
      var ring = new THREE.Mesh(new THREE.RingGeometry(.5, .62, 40), new THREE.MeshBasicMaterial({ color: 0x7FB2FF, transparent: true, opacity: .4, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .035; g.add(ring);
      g.userData.tag = null;
      scene.add(g);
      return { grp: g, bloom: photo, photoMat: photoMat, core: null, glow: glow, ring: ring, halo: halo, tag: null, lit: false };
    }

    /* ---------- 发射器 ---------- */
    var emitGrp = new THREE.Group();
    var eBody = new THREE.Mesh(new THREE.BoxGeometry(.64, .44, .9), new THREE.MeshStandardMaterial({ color: 0xC79A4E, metalness: .85, roughness: .3 }));
    emitGrp.add(eBody);
    var eLens = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .22, 20), new THREE.MeshStandardMaterial({ color: 0x9FF3EA, emissive: 0x35D8C8, emissiveIntensity: 1.8, metalness: .3, roughness: .2 }));
    eLens.rotation.x = Math.PI / 2; eLens.position.z = .5; emitGrp.add(eLens);
    var eGlow = new THREE.PointLight(0x59E6D8, 2.6, 8); eGlow.position.set(0, 0, .6); emitGrp.add(eGlow);
    emitGrp.rotation.y = Math.PI / 2; scene.add(emitGrp);

    /* ---------- 镜子（含隐形点击区，修复点不到） ---------- */
    var mirrorMat = new THREE.MeshStandardMaterial({ color: 0xEDF7FF, metalness: .55, roughness: .12, emissive: 0x7FB6D8, emissiveIntensity: .55 });
    var frameMat = new THREE.MeshStandardMaterial({ color: 0xF0C066, metalness: .8, roughness: .3, emissive: 0x3A2408, emissiveIntensity: .25 });
    var baseMat = new THREE.MeshStandardMaterial({ color: 0x6A4B28, metalness: .55, roughness: .45 });
    var hitMat6 = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide });
    function makeMirror(m) {
      var g = new THREE.Group();
      var base = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .14, 26), baseMat); base.position.y = .07; g.add(base);
      var frame = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.34, .08), frameMat); frame.position.y = .86; g.add(frame);
      var glass = new THREE.Mesh(new THREE.PlaneGeometry(.76, 1.14), mirrorMat); glass.position.set(0, .86, .05); g.add(glass);
      var backPlate = new THREE.Mesh(new THREE.BoxGeometry(.86, 1.28, .04), new THREE.MeshStandardMaterial({ color: 0x3A2E22, roughness: .8 }));
      backPlate.position.set(0, .86, -.04); g.add(backPlate);
      var knob = new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 10), new THREE.MeshStandardMaterial({ color: 0xF2CD82, metalness: .9, roughness: .25 }));
      knob.position.set(.44, .2, 0); g.add(knob);
      var hit = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.25), hitMat6); hit.position.set(0, 1.0, .02); g.add(hit);
      var tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex('↻', { bg: 'rgba(7,11,20,.0)', fg: '#F2CD82', size: 74, w: 150, h: 150 }), transparent: true, depthTest: false }));
      tag.position.set(0, 1.66, 0); tag.scale.set(.42, .42, 1); g.add(tag);
      g.userData.pick = m;
      m.grp = g; m.hit = hit;
      g.position.copy(cellPos(m.x, m.z));
      g.rotation.y = m.type === '/' ? -Math.PI / 4 : Math.PI / 4;
      scene.add(g);
      return g;
    }

    /* ---------- 机位 ---------- */
    var yaw = .02, pitch = .86, camR = 22;
    function applyCam() {
      var target = new THREE.Vector3(0, .2, 0);
      camera.position.set(target.x + camR * Math.sin(pitch) * Math.sin(yaw), target.y + camR * Math.cos(pitch), target.z + camR * Math.sin(pitch) * Math.cos(yaw));
      camera.lookAt(target);
    }
    var dragging = false, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', function (e) { dragging = true; lx = e.clientX; ly = e.clientY; });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      yaw -= (e.clientX - lx) * .006;
      pitch = Math.max(.55, Math.min(1.28, pitch - (e.clientY - ly) * .004));
      lx = e.clientX; ly = e.clientY; applyCam();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { canvas.addEventListener(ev, function () { dragging = false; }); });

    var hud = el('div', 'gx-score'); host.appendChild(hud);
    var miniWrap = el('div', 'gx-minimap');
    var mini = el('canvas', 'gx-mini-canvas'); mini.width = 240; mini.height = 240;
    miniWrap.appendChild(mini); host.appendChild(miniWrap);
    var miniCtx = mini.getContext('2d');

    var DIRS = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
    function reflect(dir, t) {
      var tab = t === '/' ? { E: 'N', N: 'E', W: 'S', S: 'W' } : { E: 'S', S: 'E', W: 'N', N: 'W' };
      return tab[dir];
    }
    function mirrorTypeFor(inDir, outDir) {
      return reflect(inDir, '/') === outDir ? '/' : '\\';
    }

    /* ---------- 状态 ---------- */
    var lv = 0, start = { x: 0, z: 4 }, mirrors = [], roses = [], solution = [], won = false, path = [], litNow = 0;
    var beamGrp = new THREE.Group(); scene.add(beamGrp);
    var roseGrpAll = new THREE.Group(); scene.add(roseGrpAll);
    var beamMat = new THREE.MeshStandardMaterial({ color: 0x6FF0E2, emissive: 0x38D8C8, emissiveIntensity: 2.0, roughness: .4, metalness: .2 });
    var glowMat = new THREE.MeshBasicMaterial({ color: 0x59E6D8, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false });
    var hitMat = new THREE.MeshBasicMaterial({ color: 0xD8FFF8 });

    function idxAt(x, z) { for (var i = 0; i < mirrors.length; i++) if (mirrors[i].x === x && mirrors[i].z === z) return i; return -1; }
    function roseAt(x, z) { for (var i = 0; i < roses.length; i++) if (roses[i].x === x && roses[i].z === z) return i; return -1; }

    function runTrace(orient) {
      var x = start.x, z = start.z, dir = 'E', pts = [], steps = 0, lit = [];
      var sp = cellPos(x, z); sp.x -= TS * .7; pts.push(sp.clone());
      while (steps++ < 90) {
        var mi = idxAt(x, z);
        if (mi >= 0 && orient[mi]) dir = reflect(dir, orient[mi]);
        var d = DIRS[dir]; x += d[0]; z += d[1];
        if (x < 0 || x >= N || z < 0 || z >= N) {
          var ep = cellPos(Math.max(-.7, Math.min(N - .3, x)), Math.max(-.7, Math.min(N - .3, z))); pts.push(ep); break;
        }
        pts.push(cellPos(x, z));
        var ri = roseAt(x, z); if (ri >= 0 && lit.indexOf(ri) < 0) lit.push(ri);
      }
      return { win: lit.length === roses.length, path: pts, lit: lit };
    }

    /* ---------- 关卡生成：先造一条必定穿过所有玫瑰的光路 ---------- */
    var usedSig = {};
    function levelCfg(i) {
      if (i === 0) return { m: 1, k: 1, f: 1 };
      if (i === 1) return { m: 2, k: 1, f: 1 };
      if (i === 2) return { m: 2, k: 1, f: 2 };
      if (i <= 4) return { m: 3, k: 2, f: 2 };
      if (i <= 6) return { m: 4, k: 2, f: 2 };
      if (i <= 9) return { m: 5, k: 2, f: 3 };
      if (i <= 14) return { m: 6, k: 3, f: 3 };
      return { m: 7, k: 3, f: 4 };
    }
    function genLevel(i) {
      var cfg = levelCfg(i);
      var m = cfg.m, k = cfg.k, minFlips = Math.min(cfg.f, m);
      for (var attempt = 0; attempt < 90; attempt++) {
        var z0 = 1 + Math.floor(Math.random() * (N - 2));
        var x = 0, z = z0, dir = 'E', cells = [{ x: x, z: z }], plan = [];
        var pre = 2 + Math.floor(Math.random() * 2);
        for (var q = 0; q < pre; q++) { x++; cells.push({ x: x, z: z }); }
        var guard = 0;
        while (plan.length < m && guard++ < 14) {
          var outs = (dir === 'E' || dir === 'W') ? ['N', 'S'] : ['E', 'W'];
          outs.sort(function () { return Math.random() - .5; });
          var pick = null;
          for (var oi = 0; oi < outs.length; oi++) {
            var dd = DIRS[outs[oi]], nx = x + dd[0], nz = z + dd[1];
            if (nx > 0 && nx < N - 1 && nz > 0 && nz < N - 1) { pick = outs[oi]; break; }
          }
          if (!pick) break;
          plan.push({ x: x, z: z, type: mirrorTypeFor(dir, pick) });
          dir = pick;
          var run = 2 + Math.floor(Math.random() * 3);
          if (plan.length === m) run = 3 + Math.floor(Math.random() * 3);
          for (var q2 = 0; q2 < run; q2++) {
            var d2 = DIRS[dir]; x += d2[0]; z += d2[1];
            if (x < 0 || x >= N || z < 0 || z >= N) { x -= d2[0]; z -= d2[1]; break; }
            cells.push({ x: x, z: z });
          }
        }
        if (plan.length < m) continue;

        var cand = cells.filter(function (c, ci) { return ci > 0 && !plan.some(function (p) { return p.x === c.x && p.z === c.z; }); });
        if (cand.length < k) continue;
        var roseCells = [], pickGuard = 0;
        while (roseCells.length < k && pickGuard++ < 60) {
          var rc = cand[Math.floor(Math.random() * cand.length)];
          if (roseCells.some(function (r) { return r.x === rc.x && r.z === rc.z; })) continue;
          if (Math.abs(rc.x - start.x) <= 1 && rc.z === z0) continue;
          if (roseCells.some(function (r) { return Math.max(Math.abs(r.x - rc.x), Math.abs(r.z - rc.z)) < 2; })) continue;
          if (plan.some(function (p) { return Math.max(Math.abs(p.x - rc.x), Math.abs(p.z - rc.z)) < 2; })) continue;
          roseCells.push({ x: rc.x, z: rc.z });
        }
        if (roseCells.length < k) continue;

        var sig = z0 + '|' + plan.map(function (p) { return p.x + ',' + p.z + p.type; }).join(';') + '|' + roseCells.map(function (r) { return r.x + ',' + r.z; }).join(';');
        if (usedSig[sig]) continue;

        start = { x: 0, z: z0 };
        roses = roseCells;
        mirrors = plan.map(function (p) { return { x: p.x, z: p.z, type: '/' }; });
        var sols = [];
        for (var mask = 0; mask < (1 << m); mask++) {
          var o = [];
          for (var b = 0; b < m; b++) o.push((mask >> b) & 1 ? '\\' : '/');
          if (runTrace(o).win) sols.push(o);
        }
        if (!sols.length) continue;
        var best = sols[0];
        var init = null, minD = Math.min(minFlips, m);
        for (var it = 0; it < 50; it++) {
          var candInit = [];
          for (var bi = 0; bi < m; bi++) candInit.push(Math.random() < .5 ? '/' : '\\');
          if (runTrace(candInit).win) continue;
          var d0 = 0; for (var b3 = 0; b3 < m; b3++) if (candInit[b3] !== best[b3]) d0++;
          if (d0 < minD) continue;
          init = candInit; break;
        }
        if (!init) {
          init = best.map(function (t) { return t === '/' ? '\\' : '/'; });
          while (runTrace(init).win) { init[0] = init[0] === '/' ? '\\' : '/'; }
        }
        usedSig[sig] = 1;
        solution = best;
        mirrors = plan.map(function (p, pi) { return { x: p.x, z: p.z, type: init[pi] }; });
        return true;
      }
      return false;
    }

    function clearBoard() {
      mirrors.forEach(function (m) { if (m.grp) scene.remove(m.grp); });
      roses.forEach(function (r) { if (r.grp) roseGrpAll.remove(r.grp); });
      mirrors = []; roses = [];
    }

    function loadLevel(i) {
      lv = i; won = false;
      clearBoard();
      var ok = false;
      for (var tries = 0; tries < 5 && !ok; tries++) ok = genLevel(i);
      if (!ok) {
        start = { x: 0, z: 4 };
        mirrors = [{ x: 4, z: 4, type: '/' }];
        roses = [{ x: 2, z: 4 }, { x: 6, z: 6 }];
        solution = ['/'];
      }
      mirrors.forEach(function (m) { makeMirror(m); });
      roses.forEach(function (r, ri) {
        var g = makeRose(ri);
        g.grp.position.copy(cellPos(r.x, r.z));
        g.grp.scale.setScalar(.92);
        r.grp = g.grp; r.bloom = g.bloom; r.photoMat = g.photoMat; r.core = g.core; r.glow = g.glow; r.ring = g.ring; r.halo = g.halo; r.tag = g.tag; r.lit = false;
        roseGrpAll.add(g.grp);
      });
      var sp2 = cellPos(start.x, start.z);
      emitGrp.position.set(sp2.x - TS * .72, .5, sp2.z);
      trace();
    }

    function trace() {
      var r = runTrace(mirrors.map(function (m) { return m.type; }));
      path = r.path; litNow = r.lit.length;
      roses.forEach(function (ro, ri) {
        ro.lit = r.lit.indexOf(ri) >= 0;
        if (ro.glow) ro.glow.intensity = ro.lit ? 5.6 : 0;
        if (ro.photoMat) { if (ro.lit) ro.photoMat.color.setRGB(1.65, 1.8, 2.05); else ro.photoMat.color.setRGB(.26, .3, .42); }
        if (ro.ring) { ro.ring.material.opacity = ro.lit ? .95 : .16; ro.ring.material.color.set(ro.lit ? 0xFFD79A : 0x6E88B8); }
        if (ro.halo) { ro.halo.material.opacity = ro.lit ? .58 : 0; ro.halo.scale.set(ro.lit ? 3.2 : 2.2, ro.lit ? 3.2 : 2.2, 1); }
        if (ro.tag) ro.tag.material.opacity = ro.lit ? .45 : 1;
      });
      won = r.win;
      drawBeam(); drawMini(); updateHud();
      if (won) win();
    }

    function drawBeam() {
      while (beamGrp.children.length) { var o = beamGrp.children.pop(); if (o.geometry) o.geometry.dispose(); }
      for (var i = 1; i < path.length; i++) {
        var a = path[i - 1].clone(); a.y = .64;
        var b = path[i].clone(); b.y = .64;
        beamGrp.add(bar(a, b, .05, beamMat));
        beamGrp.add(bar(a, b, .13, glowMat));
      }
      for (var j = 0; j < path.length - 1; j++) {
        var s2 = new THREE.Mesh(new THREE.SphereGeometry(.095, 10, 8), hitMat);
        s2.position.copy(path[j]); s2.position.y = .64; beamGrp.add(s2);
      }
      var endGlow = new THREE.PointLight(0x6FE8DC, 2.0, 7);
      endGlow.position.copy(path[path.length - 1]); endGlow.position.y = .8; beamGrp.add(endGlow);
    }

    function drawMini() {
      var S = 240, pad = 18, cell = (S - pad * 2) / N;
      miniCtx.clearRect(0, 0, S, S);
      miniCtx.fillStyle = 'rgba(7,11,20,.9)'; miniCtx.fillRect(0, 0, S, S);
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        miniCtx.fillStyle = (i + j) % 2 ? 'rgba(243,232,211,.18)' : 'rgba(225,207,174,.10)';
        miniCtx.fillRect(pad + i * cell, pad + j * cell, cell, cell);
      }
      miniCtx.strokeStyle = 'rgba(232,180,74,.55)'; miniCtx.lineWidth = 1; miniCtx.strokeRect(pad, pad, cell * N, cell * N);
      miniCtx.strokeStyle = '#6FF0E2'; miniCtx.lineWidth = 2; miniCtx.beginPath();
      for (var p = 0; p < path.length; p++) {
        var cx = pad + (path[p].x / TS + (N - 1) / 2 + .5) * cell;
        var cz = pad + (path[p].z / TS + (N - 1) / 2 + .5) * cell;
        if (p === 0) miniCtx.moveTo(cx, cz); else miniCtx.lineTo(cx, cz);
      }
      miniCtx.stroke();
      mirrors.forEach(function (m) {
        var mx = pad + (m.x + .5) * cell, mz = pad + (m.z + .5) * cell;
        miniCtx.strokeStyle = '#E8B44A'; miniCtx.lineWidth = 2.4;
        miniCtx.beginPath();
        var sgn = m.type === '/' ? 1 : -1;
        miniCtx.moveTo(mx - cell * .3, mz + sgn * cell * .3);
        miniCtx.lineTo(mx + cell * .3, mz - sgn * cell * .3);
        miniCtx.stroke();
      });
      roses.forEach(function (r) {
        miniCtx.fillStyle = r.lit ? '#FFD79A' : '#6FA8FF';
        miniCtx.beginPath(); miniCtx.arc(pad + (r.x + .5) * cell, pad + (r.z + .5) * cell, 5, 0, Math.PI * 2); miniCtx.fill();
        miniCtx.strokeStyle = r.lit ? 'rgba(255,215,154,.9)' : 'rgba(111,168,255,.8)';
        miniCtx.beginPath(); miniCtx.arc(pad + (r.x + .5) * cell, pad + (r.z + .5) * cell, 9, 0, Math.PI * 2); miniCtx.stroke();
      });
      miniCtx.fillStyle = '#59E6D8';
      miniCtx.fillRect(pad + (start.x) * cell - 4, pad + (start.z + .25) * cell, cell * .42, cell * .5);
    }

    function updateHud() {
      var left = roses.length - litNow;
      hud.innerHTML = '<b>第 ' + (lv + 1) + ' 关 · 无限</b><span>' + (won ? '蓝玫瑰全亮了' : '已点亮 ' + litNow + ' / ' + roses.length + ' 朵，还差 ' + left + ' 朵') + '</span>';
    }

    var winGuard = false;
    function win() {
      if (winGuard) return; winGuard = true;
      toast('第 ' + (lv + 1) + ' 关通过 · 玫瑰全亮');
      setTimeout(function () { winGuard = false; loadLevel(lv + 1); }, 2400);
    }

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      var best = null, bestD = 1e9, v = new THREE.Vector3();
      mirrors.forEach(function (mm) {
        v.copy(mm.grp.position); v.y = 1.0; v.project(camera);
        var sx = (v.x + 1) * .5 * r.width, sy = (1 - v.y) * .5 * r.height;
        var d = Math.sqrt((px - sx) * (px - sx) + (py - sy) * (py - sy));
        if (d < bestD) { bestD = d; best = mm; }
      });
      if (!best || bestD > Math.max(52, Math.min(r.width, r.height) * .12)) return;
      best.type = best.type === '/' ? '\\' : '/';
      best.grp.rotation.y = best.type === '/' ? -Math.PI / 4 : Math.PI / 4;
      trace();
    });

    var hintBtn = el('button', 'gx-hint', '提示');
    host.appendChild(hintBtn);
    hintBtn.onclick = function () {
      var need = [];
      mirrors.forEach(function (m, i) { if (solution[i] && solution[i] !== m.type) need.push('第' + (m.z + 1) + '排第' + (m.x + 1) + '列'); });
      if (!need.length) toast('朝向已经对了，转动视角看看光路');
      else toast('要转的是 ' + need.join(' / ') + '，共 ' + need.length + ' 面', 4600, true);
    };

    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      var half = (N * TS) / 2 + .9;
      var hf = Math.atan(Math.tan((camera.fov * Math.PI / 180) / 2) * camera.aspect);
      var need = half / Math.tan(hf) * 1.06;
      camR = Math.max(need, 15);
      applyCam();
    }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>转镜面，让光穿过每一朵蓝玫瑰</span><span class="gx-badge">3D 光路 · 无限关</span>'));

    applyCam();
    loadLevel(0);

    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      roses.forEach(function (ro, ri) {
        if (ro.ring) ro.ring.scale.setScalar(1 + Math.sin(t * 2 + ri) * .06);
        if (ro.grp) ro.grp.position.y = Math.sin(t * 1.1 + ri * 2) * .025;
      });
      eGlow.intensity = 1.9 + Math.sin(t * 3) * .4;
    }});
    return { dispose: function () { stop(); renderer.dispose(); window.removeEventListener('resize', resize); } };
  }

  /* ---------- 7 翻牌配对 ---------- */
  function game7(host) {
    host.classList.add('kf-host');
    var PHOTOS = [
      'images/hero-kotw.jpg', 'images/stage-opening.jpg', 'images/stage-main-mv.jpg',
      'images/goldsea-macau.jpg', 'images/hero-sg-live.jpg', 'images/portrait-black.jpg',
      'images/tour-feather.jpg', 'images/gallery-car.jpg', 'images/stage-macau3.jpg',
      'images/mu-sequin.jpg', 'images/gallery-suit.jpg', 'images/stage-white.jpg'
    ];
    var level = 0, pairs = 4, deck = [], first = null, lock = true, moves = 0, matched = 0, secs = 0, ended = false;
    var timeouts = [], tick = null, previewTick = null;

    var wrap = el('div', 'kf-wrap');
    wrap.innerHTML =
      '<div class="kf-hud">' +
        '<span class="kf-pill">第 <b data-lv>1</b> 关</span>' +
        '<span class="kf-pill">步数 <b data-moves>0</b></span>' +
        '<span class="kf-pill">配对 <b data-pairs>0/4</b></span>' +
        '<span class="kf-pill warn">用时 <b data-time>0:00</b></span>' +
      '</div>' +
      '<div class="kf-tip" data-tip>先记住位置 · <b>5</b> 秒</div>' +
      '<div class="kf-board" data-board></div>' +
      '<div class="kf-bar"><button type="button" data-again>重新洗牌</button></div>' +
      '<div class="kf-win" data-win><div class="kf-win-card">' +
        '<div class="kf-win-kicker">ALL MATCHED</div>' +
        '<h4 class="kf-win-title">全部配对成功</h4>' +
        '<p class="kf-win-sub">第 <b data-wlv>1</b> 关 · 走了 <b data-wmv>0</b> 步 · 用时 <b data-wtm>0:00</b></p>' +
        '<div class="kf-btn-row"><button class="kf-btn" type="button" data-next>下一关</button><button class="kf-btn ghost" type="button" data-replay>再玩一次</button></div>' +
      '</div></div>';
    host.appendChild(wrap);
    var board = wrap.querySelector('[data-board]'), tip = wrap.querySelector('[data-tip]'), win = wrap.querySelector('[data-win]');
    var lvEl = wrap.querySelector('[data-lv]'), mvEl = wrap.querySelector('[data-moves]'), prEl = wrap.querySelector('[data-pairs]'), tmEl = wrap.querySelector('[data-time]');

    function clearTimers() {
      timeouts.forEach(function (t) { clearTimeout(t); }); timeouts = [];
      if (tick) { clearInterval(tick); tick = null; }
      if (previewTick) { clearInterval(previewTick); previewTick = null; }
    }
    function after(fn, ms) { timeouts.push(setTimeout(fn, ms)); }
    function fmt(s) { var m = Math.floor(s / 60), ss = s % 60; return m + ':' + (ss < 10 ? '0' : '') + ss; }
    function pairsFor(l) { return Math.min(4 + l, PHOTOS.length); }
    function previewSecsFor(l) { return Math.max(2, 5 - Math.floor(l / 3)); }
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function colsFor() {
      var w = host.clientWidth;
      if (w < 520) return 4;
      if (w < 760) return pairs <= 6 ? 4 : 5;
      return pairs <= 4 ? 4 : (pairs <= 9 ? 5 : 6);
    }
    function updateHud() {
      lvEl.textContent = level + 1;
      mvEl.textContent = moves;
      prEl.textContent = matched + '/' + pairs;
      tmEl.textContent = fmt(secs);
    }
    function setTip(html) { tip.innerHTML = html; }

    function build() {
      clearTimers();
      pairs = pairsFor(level);
      deck = shuffle(PHOTOS.slice(0, pairs).concat(PHOTOS.slice(0, pairs)).map(function (p, i) { return { key: p, pid: i }; }));
      first = null; lock = true; moves = 0; matched = 0; secs = 0; ended = false;
      win.classList.remove('show');
      board.innerHTML = '';
      wrap.classList.toggle('dense', pairs >= 10);
      board.style.setProperty('--kf-cols', String(colsFor()));
      updateHud();
      deck.forEach(function (c) {
        var card = el('div', 'kf-card up');
        card.dataset.key = c.key;
        card.innerHTML = '<div class="kf-inner"><div class="kf-face kf-back"><span class="kf-mark">坤</span><span class="kf-logo">KUN · STAR</span></div>' +
          '<div class="kf-face kf-front"><img src="' + c.key + '" alt="舞台照片" decoding="async"></div></div>';
        card.addEventListener('click', function () { pick(card); });
        board.appendChild(card);
      });
      var secsLeft = previewSecsFor(level);
      setTip('先记住位置 · <b>' + secsLeft + '</b> 秒');
      previewTick = setInterval(function () {
        secsLeft--;
        if (secsLeft > 0) setTip('先记住位置 · <b>' + secsLeft + '</b> 秒');
      }, 1000);
      after(function () {
        if (previewTick) { clearInterval(previewTick); previewTick = null; }
        Array.prototype.forEach.call(board.querySelectorAll('.kf-card'), function (x) { x.classList.remove('up'); });
        setTip('翻开两张，找出同一张照片');
        lock = false;
        tick = setInterval(function () { if (!ended) { secs++; tmEl.textContent = fmt(secs); } }, 1000);
      }, secsLeft * 1000);
    }

    function pick(card) {
      if (lock || ended || card === first) return;
      if (card.classList.contains('matched') || card.classList.contains('up')) return;
      card.classList.add('up');
      if (!first) { first = card; return; }
      moves++; updateHud();
      if (card.dataset.key === first.dataset.key) {
        card.classList.add('matched'); first.classList.add('matched');
        first = null; matched++; updateHud();
        if (matched === pairs) finish();
      } else {
        lock = true;
        var a = first, b = card;
        b.classList.add('shake');
        after(function () { a.classList.remove('up'); b.classList.remove('up', 'shake'); first = null; lock = false; }, 760);
      }
    }

    function finish() {
      ended = true; if (tick) { clearInterval(tick); tick = null; }
      var key = 'kun_flip_best';
      try { localStorage.setItem(key, String(Math.max(+(localStorage.getItem(key) || 0), level + 1))); } catch (e) {}
      wrap.querySelector('[data-wlv]').textContent = level + 1;
      wrap.querySelector('[data-wmv]').textContent = moves;
      wrap.querySelector('[data-wtm]').textContent = fmt(secs);
      after(function () { win.classList.add('show'); }, 420);
    }

    wrap.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-again]')) { build(); return; }
      if (t.closest('[data-replay]')) { build(); return; }
      if (t.closest('[data-next]')) { level++; build(); }
    });
    function resize() { board.style.setProperty('--kf-cols', String(colsFor())); }
    window.addEventListener('resize', resize);
    build();
    return { dispose: function () { clearTimers(); window.removeEventListener('resize', resize); host.classList.remove('kf-host'); host.innerHTML = ''; } };
  }

  var factories = { g5: game5, g6: game6, g7: game7 };

  /* ---------- 游戏厅 UI ---------- */
  function buildHub() {
    app.innerHTML =
      '<div class="kw-top">' +
        '<nav class="kw-nav" id="gxNav">' +
          '<button data-cat="all" aria-pressed="true">全部</button>' +
          '<button data-cat="heal" aria-pressed="false">治愈</button>' +
          '<button data-cat="memory" aria-pressed="false">记忆</button>' +
          '<button data-cat="puzzle" aria-pressed="false">解谜</button>' +
        '</nav>' +
      '</div>' +
      '<section class="kw-hero">' +
        '<div class="kw-kicker">GAME LOBBY · 2026</div>' +
        '<h1>KUN <em>游戏厅</em></h1>' +
        '<p class="kw-sub">四个房间，四种心跳。许愿的、记灯海的、转镜子的、翻牌的，都从这里进。<br />解谜和翻牌关卡现场生成，每次进去都是新题，玩不完。</p>' +
        '<div class="kw-stats">' +
          '<div><b>4</b><span>款游戏</span></div>' +
          '<div><b>∞</b><span>解谜关卡</span></div>' +
          '<div><b>本机</b><span>进度存档</span></div>' +
        '</div>' +
      '</section>' +
      '<div class="kw-sec"><h2>全部游戏</h2><p>ALL ROOMS</p></div>' +
      '<div class="gx-grid" id="gxGrid"></div>' +
      '<div class="gx-empty" id="gxEmpty">这个分类暂时没有内容。</div>';

    var grid = app.querySelector('#gxGrid');
    GAMES.forEach(function (g, gi) {
      var card = el('article', 'gx-card');
      card.dataset.cat = g.cat;
      card.style.setProperty('--c1', g.c1 || '#22407a');
      var tagHtml = (g.tags || []).map(function (t, i) { return '<span class="gx-tag' + (i === 0 ? ' gold' : '') + '">' + t + '</span>'; }).join('');
      card.innerHTML =
        '<div class="gx-cover gx-cover-type">' +
          '<span class="gx-no">0' + (gi + 1) + ' / 04</span>' +
          '<div class="gx-cover-word"><b>' + (g.en || g.name) + '</b><small>' + g.name + '</small></div>' +
          '<span class="gx-chip' + (g.hot ? ' hot' : '') + '">' + (g.chip || g.tag) + '</span></div>' +
        '<div class="gx-body"><h3 class="gx-title">' + g.name + '<small>' + (g.en || '') + '</small></h3>' +
          '<p class="gx-desc">' + g.desc + '</p>' +
          '<div class="gx-meta">' + tagHtml + '<span class="gx-diff">' + g.diff + '</span></div>' +
          '<button class="gx-play"><span>' + (g.go || '进入房间') + '</span><i>→</i></button></div>';
      var go = function (e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        if (g.link) openWish(); else openGame(g);
      };
      card.querySelector('.gx-play').addEventListener('click', go);
      card.addEventListener('click', go);
      grid.appendChild(card);
    });

    var nav2 = app.querySelector('#gxNav');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.gx-card'));
    var empty = app.querySelector('#gxEmpty');
    nav2.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-cat]'); if (!b) return;
      Array.prototype.forEach.call(nav2.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var cat = b.dataset.cat, n = 0;
      cards.forEach(function (c) {
        var hit = cat === 'all' || c.dataset.cat === cat;
        c.classList.toggle('hide', !hit); if (hit) n++;
      });
      empty.style.display = n ? 'none' : 'block';
    });
  }

  var STEPS = {
    g5: ['座位会像灯海一样依次亮起，记住顺序；底部可切慢/常速/快。', '轮到你时，按同样顺序点座位；点错就重来这一关。', '每过一关序列更长，可以无限往上刷。'],
    g6: ['左边金色的装置是发射器，会射出青色激光。', '点镜子旋转 90°；第 1 关只有 1 朵玫瑰，穿过就亮，之后的关卡玫瑰会变多。', '全部点亮就过关；卡住了点「提示」，右下小地图有光路。'],
    g7: ['开局所有牌会先亮几秒，先记住同一张照片的位置。', '每次翻两张；一样的会留在场上，不一样的会翻回去。', '全部配对成功就进下一关，牌会越来越多，预览时间会变短。']
  };

  function openGame(info) {
    if (!factories[info.id]) { openWish(); return; }
    closeStage();
    stage = el('div', 'gx-stage');
    stage.innerHTML = '<div class="gx-stage-top"><button class="gx-back">← 返回游戏厅</button><div class="gx-title">' + info.name + '<em>' + info.tag + '</em></div></div><div class="gx-view"></div>';
    document.body.appendChild(stage);
    document.body.classList.add('gx-lock');
    stage.querySelector('.gx-back').onclick = closeStage;
    var view = stage.querySelector('.gx-view');
    try { cur = factories[info.id](view); }
    catch (err) { console.warn('game init fail', err); toast('这个游戏加载失败了，换一个试试'); }
    setTimeout(function () {
      var c = view.querySelector('.gx-canvas');
      if (c) { c.style.width = '100%'; c.style.height = '100%'; }
    }, 0);

    var body = el('div', 'gx-intro');
    var steps = STEPS[info.id] || [];
    body.innerHTML = '<p class="gx-tip">' + info.desc + '</p><ol class="gx-steps">' +
      steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
    var btn = el('button', 'gx-btn', '知道了，开始玩');
    body.appendChild(btn);
    var p = panel('怎么玩 · ' + info.name, body);
    btn.onclick = function () { p.close(); };
    toast('提示：' + (info.hint || '慢慢看，会有线索。'), 3000);
  }

  function closeStage() {
    if (cur) { try { cur.dispose(); } catch (e) {} cur = null; }
    if (stage) { stage.remove(); stage = null; }
    document.body.classList.remove('gx-lock');
    toastEl = null;
  }

  buildHub();
  window.addEventListener('hashchange', function () {
    if ((location.hash || '').replace('#', '') !== 'games') closeStage();
  });
})();
