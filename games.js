/* KUN 星站 · 游戏厅（Three.js 3D 小游戏） */
(function () {
  var app = document.getElementById('gamesApp');
  if (!app || !window.THREE) return;

  var GAMES = [
    { id: 'wish', name: '祝福树', en: 'WISH TREE', cat: 'heal', hot: true, c1: '#2b5f8f',
      chip: '治愈 · 互动', icon: '愿', tag: '3D 许愿', diff: '★',
      desc: '一棵可以转着看的蓝玫瑰树，写一句祝福就多开一朵花。',
      tags: ['3D 可旋转', '蓝玫瑰挂牌', '随手可玩'], go: '去许愿', link: '#wish' },
    { id: 'g5', name: '金海记忆剧场', en: 'GOLD SEA', cat: 'memory', c1: '#8a4a2f',
      chip: '记忆 · 剧场', icon: '灯', tag: '3D 记忆', diff: '★★★',
      desc: '金色灯海一盏盏亮起，按顺序点回去。播放速度可调，关卡往上无限叠。',
      tags: ['3D 剧场', '速度可调', '无限关卡'], go: '进入剧场',
      hint: '灯亮时别急，先记住第一个。' },
    { id: 'g6', name: '蓝玫瑰镜面迷宫', en: 'MIRROR MAZE', cat: 'puzzle', c1: '#2f6f74',
      chip: '解谜 · 无限关', icon: '镜', tag: '3D 光路', diff: '★★★★',
      desc: '转动镜面，把光送进立体蓝玫瑰。关卡现场生成，每关解法都不一样。',
      tags: ['3D 光路', '无限关卡', '现场生成'], go: '进入镜厅',
      hint: '点镜子转 90°，跟着右下小地图走。' },
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

  function toast(msg, ms) {
    if (!stage) return;
    if (!toastEl) {
      toastEl = el('div', 'gx-toast');
      stage.appendChild(toastEl);
    }
    var node = toastEl;
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

  /* ---------- 6 蓝玫瑰镜面迷宫（无限关卡） ---------- */
  function game6(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0B1220, 0.022);
    bgGrad(scene, '#122036', '#05070D');
    var camera = new THREE.PerspectiveCamera(50, 1, .1, 120);

    scene.add(new THREE.AmbientLight(0xFFE6C8, 2.0));
    scene.add(new THREE.HemisphereLight(0xFFF1DA, 0x1A2234, 1.2));
    var key = new THREE.SpotLight(0xFFE2BC, 10, 40, .7, .55); key.position.set(4, 15, 8); scene.add(key);
    var cool = new THREE.PointLight(0x59C7C0, 3, 22); cool.position.set(-8, 6, -6); scene.add(cool);
    var warm2 = new THREE.PointLight(0xE8B44A, 3, 18); warm2.position.set(8, 4, 6); scene.add(warm2);

    var N = 7, TS = 1.2;
    function cellPos(cx, cz) { return new THREE.Vector3((cx - (N - 1) / 2) * TS, 0, (cz - (N - 1) / 2) * TS); }

    var hall = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x0C1220, roughness: .95 }));
    hall.rotation.x = -Math.PI / 2; hall.position.y = -.03; scene.add(hall);

    var C1 = 0xF3E8D3, C2 = 0xE1CFAE;
    for (var ix = 0; ix < N; ix++) for (var iz = 0; iz < N; iz++) {
      var tile = new THREE.Mesh(new THREE.PlaneGeometry(TS * .985, TS * .985),
        new THREE.MeshStandardMaterial({ color: (ix + iz) % 2 ? C1 : C2, roughness: .45, metalness: .06 }));
      var p0 = cellPos(ix, iz); tile.rotation.x = -Math.PI / 2; tile.position.set(p0.x, .01, p0.z); scene.add(tile);
    }
    var wall6 = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ color: 0x121B2C, roughness: .95 }));
    wall6.position.set(0, 5, -9); scene.add(wall6);
    var arch6 = new THREE.Mesh(new THREE.TorusGeometry(4.6, .17, 8, 44, Math.PI), new THREE.MeshStandardMaterial({ color: 0xB78B3E, metalness: .85, roughness: .32, emissive: 0x3A2600, emissiveIntensity: .4 }));
    arch6.position.set(0, 2.2, -8.6); scene.add(arch6);
    var archGlow6 = new THREE.PointLight(0xE8B44A, 3.6, 16); archGlow6.position.set(0, 4.2, -7); scene.add(archGlow6);
    for (var pd6 = 0; pd6 < 3; pd6++) {
      var pz6 = -3.4, px6 = (pd6 - 1) * 3.6;
      var shade6 = new THREE.Mesh(new THREE.ConeGeometry(.42, .5, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xC79A4E, metalness: .8, roughness: .3, side: THREE.DoubleSide }));
      shade6.position.set(px6, 4.3, pz6); scene.add(shade6);
      var cord6 = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 2, 6), new THREE.MeshStandardMaterial({ color: 0x2A2E38 }));
      cord6.position.set(px6, 5.2, pz6); scene.add(cord6);
      var bulb6 = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 10), new THREE.MeshBasicMaterial({ color: 0xFFE0AE }));
      bulb6.position.set(px6, 4.1, pz6); scene.add(bulb6);
      var pl6 = new THREE.PointLight(0xFFD3A0, 3.4, 15); pl6.position.set(px6, 3.9, pz6); scene.add(pl6);
    }
    var boardW = N * TS + .3;
    [[0, -boardW / 2, 0], [0, boardW / 2, 0], [-boardW / 2, 0, 1], [boardW / 2, 0, 1]].forEach(function (p) {
      var fr = new THREE.Mesh(new THREE.BoxGeometry(boardW + .22, .18, .18), new THREE.MeshStandardMaterial({ color: 0xB78B3E, metalness: .8, roughness: .3 }));
      fr.position.set(p[0], .09, p[1]); if (p[2]) fr.rotation.y = Math.PI / 2; scene.add(fr);
    });

    /* 立体蓝玫瑰 */
    var roseGrp = new THREE.Group();
    var marble = new THREE.MeshStandardMaterial({ color: 0xEFE4CE, roughness: .45, metalness: .08 });
    var ped = new THREE.Mesh(new THREE.CylinderGeometry(.32, .4, .62, 24), marble);
    ped.position.y = .31; roseGrp.add(ped);
    var pedRing = new THREE.Mesh(new THREE.TorusGeometry(.34, .03, 8, 32), new THREE.MeshStandardMaterial({ color: 0xE8B44A, metalness: .9, roughness: .25 }));
    pedRing.rotation.x = Math.PI / 2; pedRing.position.y = .62; roseGrp.add(pedRing);
    var stemMat = new THREE.MeshStandardMaterial({ color: 0x2E6B4A, roughness: .78 });
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(.038, .05, .95, 10), stemMat);
    stem.position.y = 1.1; roseGrp.add(stem);
    [[.55, .5], [-.62, -.4], [.72, -.2]].forEach(function (lf, li) {
      var leaf = new THREE.Mesh(new THREE.SphereGeometry(.19, 12, 8), new THREE.MeshStandardMaterial({ color: 0x357B55, roughness: .72 }));
      leaf.scale.set(1.5, .18, .7);
      leaf.position.set(lf[0] * .28, 1.12 + li * .16, lf[1] * .2);
      leaf.rotation.y = lf[0] * .8; leaf.rotation.z = -.4 * lf[0];
      roseGrp.add(leaf);
    });
    var blossom = new THREE.Group(); blossom.position.y = 1.86; blossom.scale.setScalar(1.45); roseGrp.add(blossom);
    var pMatA = new THREE.MeshStandardMaterial({ color: 0x2F63D8, emissive: 0x102E86, emissiveIntensity: .95, metalness: .35, roughness: .32 });
    var pMatB = new THREE.MeshStandardMaterial({ color: 0x4C86F0, emissive: 0x1B4CB0, emissiveIntensity: 1.1, metalness: .32, roughness: .3 });
    var petalGeo = new THREE.SphereGeometry(.18, 14, 10);
    var rings = [
      { n: 7, r: .30, tilt: -.95, s: 1.0, mat: pMatA, y: .06 },
      { n: 6, r: .235, tilt: -.7, s: .92, mat: pMatB, y: .15 },
      { n: 5, r: .16, tilt: -.42, s: .8, mat: pMatA, y: .26 },
      { n: 4, r: .095, tilt: -.16, s: .66, mat: pMatB, y: .35 }
    ];
    rings.forEach(function (ring, ri) {
      for (var k = 0; k < ring.n; k++) {
        var aa = (k / ring.n) * Math.PI * 2 + ri * .5;
        var p = new THREE.Mesh(petalGeo, ring.mat);
        p.position.set(Math.cos(aa) * ring.r, ring.y, Math.sin(aa) * ring.r);
        p.rotation.y = -aa;
        p.rotation.x = ring.tilt;
        p.rotation.z = Math.sin(aa) * .12;
        p.scale.set(1.35 * ring.s, 1.05 * ring.s, .45 * ring.s);
        blossom.add(p);
      }
    });
    var bud = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), pMatB);
    bud.scale.set(1, 1.15, 1); bud.position.y = .42; blossom.add(bud);
    var core = new THREE.Mesh(new THREE.SphereGeometry(.09, 14, 12), new THREE.MeshStandardMaterial({ color: 0x9CC4FF, emissive: 0x2A5FD0, emissiveIntensity: 1.9, roughness: .25 }));
    core.position.y = .5; blossom.add(core);
    var coreSwirl = new THREE.Mesh(new THREE.TorusGeometry(.07, .02, 8, 20), pMatB);
    coreSwirl.rotation.x = Math.PI / 2.2; coreSwirl.position.y = .5; blossom.add(coreSwirl);
    for (var sp = 0; sp < 5; sp++) {
      var aa2 = sp / 5 * Math.PI * 2;
      var sepal = new THREE.Mesh(new THREE.ConeGeometry(.055, .24, 8), stemMat);
      sepal.position.set(Math.cos(aa2) * .2, -.02, Math.sin(aa2) * .2);
      sepal.rotation.z = Math.cos(aa2) * .95; sepal.rotation.x = -Math.sin(aa2) * .95;
      blossom.add(sepal);
    }
    var roseGlow = new THREE.PointLight(0x5A93FF, 3.2, 10); roseGlow.position.set(0, 1.8, 0); roseGrp.add(roseGlow);
    var roseRing = new THREE.Mesh(new THREE.RingGeometry(.62, .74, 44), new THREE.MeshBasicMaterial({ color: 0x7FB2FF, transparent: true, opacity: .55, side: THREE.DoubleSide }));
    roseRing.rotation.x = -Math.PI / 2; roseRing.position.y = .035; roseGrp.add(roseRing);
    var roseTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex('蓝玫瑰 · 目标', { bg: 'rgba(7,11,20,.9)', fg: '#F2CD82', size: 40, w: 320, h: 84 }), transparent: true, depthTest: false }));
    roseTag.position.set(0, 2.95, 0); roseTag.scale.set(1.75, .43, 1); roseGrp.add(roseTag);
    scene.add(roseGrp);

    /* 发射器 */
    var emitGrp = new THREE.Group();
    var eBody = new THREE.Mesh(new THREE.BoxGeometry(.6, .4, .84), new THREE.MeshStandardMaterial({ color: 0xB78B3E, metalness: .85, roughness: .3 }));
    emitGrp.add(eBody);
    var eLens = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .2, 20), new THREE.MeshStandardMaterial({ color: 0x9FF3EA, emissive: 0x35D8C8, emissiveIntensity: 1.7, metalness: .3, roughness: .2 }));
    eLens.rotation.x = Math.PI / 2; eLens.position.z = .46; emitGrp.add(eLens);
    var eGlow = new THREE.PointLight(0x59E6D8, 2.6, 8); eGlow.position.set(0, 0, .6); emitGrp.add(eGlow);
    emitGrp.rotation.y = Math.PI / 2;
    scene.add(emitGrp);

    /* 镜面：加大画框 + 地面提示牌 */
    var mirrorMat = new THREE.MeshStandardMaterial({ color: 0xD8ECF6, metalness: .86, roughness: .06, emissive: 0x2A5C74, emissiveIntensity: .35 });
    var frameMat = new THREE.MeshStandardMaterial({ color: 0xE8B44A, metalness: .85, roughness: .28 });
    var baseMat = new THREE.MeshStandardMaterial({ color: 0x6A4B28, metalness: .55, roughness: .45 });
    function makeMirror(m) {
      var g = new THREE.Group();
      var base = new THREE.Mesh(new THREE.CylinderGeometry(.36, .44, .12, 26), baseMat); base.position.y = .06; g.add(base);
      var frame = new THREE.Mesh(new THREE.BoxGeometry(1.16, 1.4, .1), frameMat); frame.position.y = .9; g.add(frame);
      var glass = new THREE.Mesh(new THREE.PlaneGeometry(.98, 1.2), mirrorMat); glass.position.set(0, .9, .062); g.add(glass);
      var backPlate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.34, .04), new THREE.MeshStandardMaterial({ color: 0x3A2E22, roughness: .8 }));
      backPlate.position.set(0, .9, -.05); g.add(backPlate);
      var knob = new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 10), new THREE.MeshStandardMaterial({ color: 0xF2CD82, metalness: .9, roughness: .25 }));
      knob.position.set(.54, .21, 0); g.add(knob);
      var tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex('点我转 90° ↻', { bg: 'rgba(7,11,20,.92)', fg: '#F2CD82', size: 48, w: 460, h: 118 }), transparent: true, depthTest: false }));
      tag.position.set(0, 1.9, 0); tag.scale.set(1.35, .34, 1); g.add(tag);
      g.userData.pick = m;
      m.grp = g; m.glass = glass;
      g.position.copy(cellPos(m.x, m.z));
      g.rotation.y = m.type === '/' ? -Math.PI / 4 : Math.PI / 4;
      scene.add(g);
      return g;
    }

    /* 机位：按屏幕比例自动拉远，保证棋盘不出画 */
    var yaw = .02, pitch = .62, camR = 20;
    function applyCam() {
      var target = new THREE.Vector3(0, .1, 0);
      camera.position.set(target.x + camR * Math.sin(pitch) * Math.sin(yaw), target.y + camR * Math.cos(pitch), target.z + camR * Math.sin(pitch) * Math.cos(yaw));
      camera.lookAt(target);
    }
    var dragging = false, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', function (e) { dragging = true; lx = e.clientX; ly = e.clientY; });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      yaw -= (e.clientX - lx) * .006;
      pitch = Math.max(.55, Math.min(1.3, pitch - (e.clientY - ly) * .004));
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

    var lv = 0, start = { x: 0, z: 3, dir: 'E' }, rose = { x: 6, z: 1 }, mirrors = [], won = false, path = [], solution = [];
    var beamGrp = new THREE.Group(); scene.add(beamGrp);
    var beamMat = new THREE.MeshStandardMaterial({ color: 0x6FF0E2, emissive: 0x38D8C8, emissiveIntensity: 1.9, roughness: .4, metalness: .2 });
    var glowMat = new THREE.MeshBasicMaterial({ color: 0x59E6D8, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false });
    var hitMat = new THREE.MeshBasicMaterial({ color: 0xD8FFF8 });

    function idxAt(x, z) { for (var i = 0; i < mirrors.length; i++) if (mirrors[i].x === x && mirrors[i].z === z) return i; return -1; }
    function runTrace(orient) {
      var x = start.x, z = start.z, dir = start.dir, pts = [], steps = 0;
      var sp = cellPos(x, z); sp.x -= TS * .68; pts.push(sp.clone());
      while (steps++ < 64) {
        if (x === rose.x && z === rose.z) return { win: true, path: pts };
        var mi = idxAt(x, z);
        if (mi >= 0) dir = reflect(dir, orient[mi]);
        var d = DIRS[dir]; x += d[0]; z += d[1];
        if (x < 0 || x >= N || z < 0 || z >= N) {
          var ep = cellPos(Math.max(-.75, Math.min(N - .25, x)), Math.max(-.75, Math.min(N - .25, z))); pts.push(ep); break;
        }
        pts.push(cellPos(x, z));
      }
      return { win: false, path: pts };
    }

    /* 关卡生成：随机布镜 + 校验可解 + 限制最少步数 + 不重复 */
    var usedSig = {};
    function genLevel(i) {
      var m = Math.min(2 + Math.floor(i / 2), 6);
      var minFlips = Math.min(2 + Math.floor(i / 3), 4);
      for (var attempt = 0; attempt < 300; attempt++) {
        var s0 = { x: 0, z: 1 + Math.floor(Math.random() * (N - 2)), dir: 'E' };
        var r0 = { x: N - 1 - Math.floor(Math.random() * 2), z: 1 + Math.floor(Math.random() * (N - 2)) };
        if (r0.z === s0.z) r0.z = (r0.z + 2) % N;
        var ms = [], guard = 0;
        while (ms.length < m && guard++ < 400) {
          var mx = 1 + Math.floor(Math.random() * (N - 2)), mz = 1 + Math.floor(Math.random() * (N - 2));
          if ((mx === s0.x && mz === s0.z) || (mx === r0.x && mz === r0.z)) continue;
          if (ms.some(function (q) { return Math.abs(q.x - mx) <= 1 && Math.abs(q.z - mz) <= 1; })) continue;
          if (Math.abs(mx - s0.x) <= 1 && Math.abs(mz - s0.z) <= 1) continue;
          if (Math.abs(mx - r0.x) <= 1 && Math.abs(mz - r0.z) <= 1) continue;
          ms.push({ x: mx, z: mz });
        }
        if (ms.length < m) continue;
        var init = ms.map(function () { return Math.random() < .5 ? '/' : '\\'; });
        var sig = s0.x + ',' + s0.z + '|' + r0.x + ',' + r0.z + '|' + ms.map(function (q, k) { return q.x + q.z + init[k]; }).join(';');
        if (usedSig[sig]) continue;

        mirrors = ms.map(function (q, k) { return { x: q.x, z: q.z, type: init[k] }; });
        start = s0; rose = r0;
        var best = null, bestD = 99, sols = 0;
        for (var mask = 0; mask < (1 << m); mask++) {
          var o = [];
          for (var b = 0; b < m; b++) o.push((mask >> b) & 1 ? '\\' : '/');
          var r = runTrace(o);
          if (r.win) {
            var dist = 0; for (var b2 = 0; b2 < m; b2++) if (o[b2] !== init[b2]) dist++;
            sols++;
            if (dist < bestD) { bestD = dist; best = o; }
          }
        }
        if (!best || bestD < minFlips || bestD > m) continue;
        usedSig[sig] = 1;
        solution = best;
        return true;
      }
      return false;
    }

    function loadLevel(i) {
      lv = i;
      mirrors.forEach(function (m) { if (m.grp) scene.remove(m.grp); });
      mirrors = [];
      var ok = false;
      for (var tries = 0; tries < 4 && !ok; tries++) ok = genLevel(i);
      if (!ok) { mirrors = [{ x: 3, z: 3, type: '/' }]; start = { x: 0, z: 3, dir: 'E' }; rose = { x: 6, z: 1 }; solution = ['\\']; }
      mirrors.forEach(function (m) { makeMirror(m); });
      roseGrp.position.copy(cellPos(rose.x, rose.z));
      var sp2 = cellPos(start.x, start.z);
      emitGrp.position.set(sp2.x - TS * .68, .48, sp2.z);
      trace();
    }

    function trace() {
      var r = runTrace(mirrors.map(function (m) { return m.type; }));
      path = r.path; won = r.win;
      drawBeam(); drawMini(); updateHud();
      if (won) win();
    }

    function drawBeam() {
      while (beamGrp.children.length) { var o = beamGrp.children.pop(); if (o.geometry) o.geometry.dispose(); }
      for (var i = 1; i < path.length; i++) {
        var a = path[i - 1].clone(); a.y = .62;
        var b = path[i].clone(); b.y = .62;
        beamGrp.add(bar(a, b, .05, beamMat));
        beamGrp.add(bar(a, b, .13, glowMat));
      }
      for (var j = 0; j < path.length - 1; j++) {
        var s2 = new THREE.Mesh(new THREE.SphereGeometry(.095, 10, 8), hitMat);
        s2.position.copy(path[j]); s2.position.y = .62; beamGrp.add(s2);
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
        miniCtx.strokeStyle = '#E8B44A'; miniCtx.lineWidth = 2.6;
        miniCtx.beginPath();
        var sgn = m.type === '/' ? 1 : -1;
        miniCtx.moveTo(mx - cell * .32, mz + sgn * cell * .32);
        miniCtx.lineTo(mx + cell * .32, mz - sgn * cell * .32);
        miniCtx.stroke();
      });
      miniCtx.fillStyle = '#6FA8FF';
      miniCtx.beginPath(); miniCtx.arc(pad + (rose.x + .5) * cell, pad + (rose.z + .5) * cell, 5, 0, Math.PI * 2); miniCtx.fill();
      miniCtx.strokeStyle = 'rgba(111,168,255,.8)'; miniCtx.beginPath(); miniCtx.arc(pad + (rose.x + .5) * cell, pad + (rose.z + .5) * cell, 9, 0, Math.PI * 2); miniCtx.stroke();
      miniCtx.fillStyle = '#59E6D8';
      miniCtx.fillRect(pad + (start.x) * cell - 4, pad + (start.z + .25) * cell, cell * .42, cell * .5);
    }

    function updateHud() {
      hud.innerHTML = '<b>第 ' + (lv + 1) + ' 关 · 无限</b><span>' + (won ? '光束照到蓝玫瑰了' : '点镜面旋转 90°，把光送到蓝玫瑰') + '</span>';
    }

    function win() {
      toast('第 ' + (lv + 1) + ' 关通过 🌹');
      roseGlow.intensity = 7; roseRing.material.opacity = 1;
      setTimeout(function () { loadLevel(lv + 1); }, 1500);
    }

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(mirrors.map(function (m) { return m.glass; }), false)[0];
      if (!hit) return;
      var mm = hit.object.parent.userData.pick;
      mm.type = mm.type === '/' ? '\\' : '/';
      mm.grp.rotation.y = mm.type === '/' ? -Math.PI / 4 : Math.PI / 4;
      trace();
    });

    var hintBtn = el('button', 'gx-hint', '提示');
    host.appendChild(hintBtn);
    hintBtn.onclick = function () {
      var need = [];
      mirrors.forEach(function (m, i) { if (solution[i] && solution[i] !== m.type) need.push('第 ' + (m.z + 1) + ' 排第 ' + (m.x + 1) + ' 列'); });
      if (!need.length) toast('当前已经是对的，光只差一点点');
      else toast('要转的是：' + need.join('、') + '（共 ' + need.length + ' 面）', 4200);
    };

    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      var half = (N * TS) / 2 + .95;
      var hf = Math.atan(Math.tan((camera.fov * Math.PI / 180) / 2) * camera.aspect);
      var need = half / Math.tan(hf) * 1.08;
      camR = Math.max(need, 13);
      applyCam();
    }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>点镜面旋转，光束到玫瑰即过关</span><span class="gx-badge">3D 光路 · 无限关</span>'));

    applyCam();
    loadLevel(0);

    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      roseRing.scale.setScalar(1 + Math.sin(t * 2) * .06);
      core.rotation.y += dt * .9;
      coreSwirl.rotation.z += dt * 1.4;
      roseGlow.intensity = won ? 6 + Math.sin(t * 4) * 1.2 : 3 + Math.sin(t * 1.4) * .6;
      eGlow.intensity = 1.9 + Math.sin(t * 3) * .4;
    }});
    return { dispose: function () { stop(); renderer.dispose(); window.removeEventListener('resize', resize); } };
  }

  var factories = { g5: game5, g6: game6 };

  /* ---------- 游戏厅 UI ---------- */
  function buildHub() {
    app.innerHTML =
      '<div class="kw-top">' +
        '<div class="kw-brand"><div class="kw-mark">坤</div><div><b>KUN 星站</b><span>GAME LOBBY · IKUN</span></div></div>' +
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
        '<p class="kw-sub">三个房间，三种心跳。许愿的、记灯海的、转镜子的，都从这里进。<br />解谜关卡现场生成，每次进去都是新题，玩不完。</p>' +
        '<div class="kw-stats">' +
          '<div><b>3</b><span>款游戏</span></div>' +
          '<div><b>∞</b><span>解谜关卡</span></div>' +
          '<div><b>本机</b><span>进度存档</span></div>' +
        '</div>' +
      '</section>' +
      '<div class="kw-sec"><h2>全部游戏</h2><p>ALL ROOMS</p></div>' +
      '<div class="gx-grid" id="gxGrid"></div>' +
      '<div class="gx-empty" id="gxEmpty">这个分类暂时没有内容。</div>';

    var grid = app.querySelector('#gxGrid');
    GAMES.forEach(function (g) {
      var card = el('article', 'gx-card');
      card.dataset.cat = g.cat;
      card.style.setProperty('--c1', g.c1 || '#22407a');
      var tagHtml = (g.tags || []).map(function (t, i) { return '<span class="gx-tag' + (i === 0 ? ' gold' : '') + '">' + t + '</span>'; }).join('');
      card.innerHTML =
        '<div class="gx-cover"><span class="gx-chip' + (g.hot ? ' hot' : '') + '">' + (g.chip || g.tag) + '</span>' +
          '<span class="gx-ico">' + g.icon + '</span></div>' +
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
    g5: ['座位会像灯海一样依次亮起，记住顺序。', '轮到你时，按同样顺序点座位；点错就重来这一关。', '每过一关序列更长，可以无限往上刷。'],
    g6: ['左边金色的装置是发射器，会射出青色激光。', '点任意一面镜子，它就会旋转 90°，改变光束方向。', '把光束引到那朵蓝玫瑰上就过关；右下角小地图会实时画出光路。']
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
