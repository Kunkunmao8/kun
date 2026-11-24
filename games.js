/* KUN 星站 · 游戏厅（Three.js 3D 小游戏） */
(function () {
  var app = document.getElementById('gamesApp');
  if (!app || !window.THREE) return;

  var GAMES = [
    { id: 'g5', name: '金海记忆剧场', tag: '3D 记忆挑战', diff: '★★★', color: '#F2C14E',
      desc: '记住灯海亮起的顺序，一层层复现，座位永无止境。', hint: '灯亮时别急，先记第一个。' },
    { id: 'g6', name: '蓝玫瑰镜面迷宫', tag: '3D 光路解谜', diff: '★★★★', color: '#59C7C0',
      desc: '转动镜面，把镭射光束送进那朵蓝玫瑰。右下小地图会实时显示光路。', hint: '点镜子它就转 90°，看小地图最快。' },
    { id: 'g8', name: '行李箱 404', tag: '3D 空间收纳', diff: '★★★', color: '#E4694F',
      desc: '巡演前把 11 件日常行李塞进箱子，6×4 格要刚好塞满。', hint: '先放大的，再用小的补缝。' }
  ];

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
    return { apply: apply };
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

    var seq = [], input = [], level = 1, playing = false;
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
        flash(seats[seq[i2]], 430);
        i2++;
        setTimeout(playSeq, 620);
      })();
    }

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

  /* ---------- 6 蓝玫瑰镜面迷宫 ---------- */
  function game6(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1A1418, 0.02);
    bgGrad(scene, '#2A2230', '#0B080E');
    var camera = new THREE.PerspectiveCamera(50, 1, .1, 90);
    orbit(camera, canvas, new THREE.Vector3(0, .5, 0), { r: 18.2, yaw: 0.02, pitch: .92, minPitch: .5, maxPitch: 1.22 });

    scene.add(new THREE.AmbientLight(0xFFE8D2, 1.5));
    scene.add(new THREE.HemisphereLight(0xFFF2DE, 0x221A24, 1.1));
    var key = new THREE.SpotLight(0xFFE2BC, 7, 30, .7, .5); key.position.set(2, 12, 5); scene.add(key);
    var cool = new THREE.PointLight(0x59C7C0, 2.4, 18); cool.position.set(-6, 4, -4); scene.add(cool);

    var N = 7, TS = 1.0;
    function cellPos(cx, cz) { return new THREE.Vector3((cx - (N - 1) / 2) * TS, 0, (cz - (N - 1) / 2) * TS); }

    var hall = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x1E1A22, roughness: .92 }));
    hall.rotation.x = -Math.PI / 2; hall.position.y = -.03; scene.add(hall);

    var C1 = 0xF1E7D6, C2 = 0xDECFB6;
    for (var ix = 0; ix < N; ix++) for (var iz = 0; iz < N; iz++) {
      var tile = new THREE.Mesh(new THREE.PlaneGeometry(TS * .985, TS * .985),
        new THREE.MeshStandardMaterial({ color: (ix + iz) % 2 ? C1 : C2, roughness: .5, metalness: .05 }));
      var p0 = cellPos(ix, iz); tile.rotation.x = -Math.PI / 2; tile.position.set(p0.x, .01, p0.z); scene.add(tile);
    }
    var boardW = N * TS + .3;
    [[0, -boardW / 2, 0], [0, boardW / 2, 0], [-boardW / 2, 0, 1], [boardW / 2, 0, 1]].forEach(function (p) {
      var fr = new THREE.Mesh(new THREE.BoxGeometry(boardW + .2, .16, .16), new THREE.MeshStandardMaterial({ color: 0x8A6A3A, metalness: .7, roughness: .35 }));
      fr.position.set(p[0], .08, p[1]); if (p[2]) fr.rotation.y = Math.PI / 2; scene.add(fr);
    });

    var wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), new THREE.MeshStandardMaterial({ color: 0x3A2B26, roughness: .95 }));
    wall.position.set(0, 4.6, -7.2); scene.add(wall);
    var arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, .16, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0xD9A83C, metalness: .8, roughness: .35, emissive: 0x4A3208, emissiveIntensity: .5 }));
    arch.position.set(0, 1.6, -7.0); scene.add(arch);
    var archGlow = new THREE.PointLight(0xFFC98A, 3.2, 14); archGlow.position.set(0, 3.2, -5.6); scene.add(archGlow);

    for (var pd = 0; pd < 3; pd++) {
      var px = (pd - 1) * 3.1, pz = -2.2;
      var shade = new THREE.Mesh(new THREE.ConeGeometry(.42, .5, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xC79A4E, metalness: .8, roughness: .3, side: THREE.DoubleSide }));
      shade.position.set(px, 3.4, pz); scene.add(shade);
      var cord = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x2A221C }));
      cord.position.set(px, 4.3, pz); scene.add(cord);
      var bulbP = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), new THREE.MeshBasicMaterial({ color: 0xFFE0AE }));
      bulbP.position.set(px, 3.25, pz); scene.add(bulbP);
      var pl = new THREE.PointLight(0xFFCF9A, 3.4, 13); pl.position.set(px, 3.1, pz); scene.add(pl);
    }

    var pedestalMat = new THREE.MeshStandardMaterial({ color: 0xE3D4BA, roughness: .6 });
    [[-4.3, 4.3], [4.3, 4.3], [-4.3, -4.3], [4.3, -4.3]].forEach(function (pp) {
      var ped2 = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, .9, 18), pedestalMat);
      ped2.position.set(pp[0], .45, pp[1]); scene.add(ped2);
      var orb = new THREE.Mesh(new THREE.SphereGeometry(.1, 14, 12), new THREE.MeshBasicMaterial({ color: 0xF6D69C }));
      orb.position.set(pp[0], 1.02, pp[1]); scene.add(orb);
    });

    var roseGrp = new THREE.Group();
    var ped = new THREE.Mesh(new THREE.CylinderGeometry(.24, .3, .5, 20), new THREE.MeshStandardMaterial({ color: 0xE8DCC6, roughness: .4, metalness: .1 }));
    ped.position.y = .25; roseGrp.add(ped);
    var pedRing = new THREE.Mesh(new THREE.TorusGeometry(.26, .025, 8, 28), new THREE.MeshStandardMaterial({ color: 0xD9A83C, metalness: .9, roughness: .25 }));
    pedRing.rotation.x = Math.PI / 2; pedRing.position.y = .5; roseGrp.add(pedRing);
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(.03, .036, .62, 8), new THREE.MeshStandardMaterial({ color: 0x2E6B4A, roughness: .8 }));
    stem.position.y = .78; roseGrp.add(stem);
    var petalMat = new THREE.MeshStandardMaterial({ color: 0x3F7BE8, emissive: 0x123C90, emissiveIntensity: 1.0, metalness: .3, roughness: .38 });
    var petalMat2 = new THREE.MeshStandardMaterial({ color: 0x5C93F2, emissive: 0x1B47A8, emissiveIntensity: 1.2, metalness: .3, roughness: .34 });
    var blossom = new THREE.Group(); blossom.position.y = 1.12; blossom.scale.setScalar(1.3); roseGrp.add(blossom);
    var petalGeo = new THREE.SphereGeometry(.12, 12, 10);
    var rings = [{ n: 6, r: .155, tilt: .95, s: 1.0 }, { n: 5, r: .105, tilt: .62, s: .85 }, { n: 4, r: .06, tilt: .35, s: .7 }];
    rings.forEach(function (ring) {
      for (var k = 0; k < ring.n; k++) {
        var aa = (k / ring.n) * Math.PI * 2 + ring.r * 6;
        var p = new THREE.Mesh(petalGeo, ring === rings[0] ? petalMat : petalMat2);
        p.position.set(Math.cos(aa) * ring.r, ring.r * .55 * ring.tilt, Math.sin(aa) * ring.r);
        p.scale.set(1.55 * ring.s, .62 * ring.s, 1.0 * ring.s);
        p.rotation.y = -aa;
        p.rotation.x = -ring.tilt * .5;
        blossom.add(p);
      }
    });
    var roseCore = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 12), new THREE.MeshStandardMaterial({ color: 0x8FBDFF, emissive: 0x2A5FD0, emissiveIntensity: 1.5, roughness: .3 }));
    roseCore.position.y = .11; blossom.add(roseCore);
    for (var sp = 0; sp < 5; sp++) {
      var ang2 = sp / 5 * Math.PI * 2;
      var sepal = new THREE.Mesh(new THREE.ConeGeometry(.05, .18, 8), new THREE.MeshStandardMaterial({ color: 0x2E6B4A, roughness: .8 }));
      sepal.position.set(Math.cos(ang2) * .13, -.02, Math.sin(ang2) * .13);
      sepal.rotation.z = Math.cos(ang2) * .8; sepal.rotation.x = -Math.sin(ang2) * .8;
      blossom.add(sepal);
    }
    var roseGlow = new THREE.PointLight(0x4A8CFF, 3, 8); roseGlow.position.set(0, 1.2, 0); roseGrp.add(roseGlow);
    var roseRing = new THREE.Mesh(new THREE.RingGeometry(.5, .58, 40), new THREE.MeshBasicMaterial({ color: 0x6FB4FF, transparent: true, opacity: .6, side: THREE.DoubleSide }));
    roseRing.rotation.x = -Math.PI / 2; roseRing.position.y = .04; roseGrp.add(roseRing);
    var roseTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex('蓝玫瑰 · 目标', { bg: 'rgba(10,20,40,.85)', fg: '#9FD0FF', size: 40, w: 320, h: 80 }), transparent: true, depthTest: false }));
    roseTag.position.set(0, 2.05, 0); roseTag.scale.set(1.45, .36, 1); roseGrp.add(roseTag);
    scene.add(roseGrp);

    var emitGrp = new THREE.Group();
    var emitBody = new THREE.Mesh(new THREE.BoxGeometry(.5, .34, .7), new THREE.MeshStandardMaterial({ color: 0x8C6A3A, metalness: .85, roughness: .3 }));
    emitGrp.add(emitBody);
    var emitLens = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .18, 18), new THREE.MeshStandardMaterial({ color: 0x9FF3EA, emissive: 0x35D8C8, emissiveIntensity: 1.6, metalness: .3, roughness: .2 }));
    emitLens.rotation.x = Math.PI / 2; emitLens.position.z = .38; emitGrp.add(emitLens);
    var emitGlow = new THREE.PointLight(0x59E6D8, 2.2, 6); emitGlow.position.set(0, 0, .5); emitGrp.add(emitGlow);
    emitGrp.rotation.y = Math.PI / 2;
    scene.add(emitGrp);

    var mirrorMat = new THREE.MeshStandardMaterial({ color: 0xCFEAF6, metalness: .85, roughness: .08, emissive: 0x2A5C74, emissiveIntensity: .4 });
    var frameMat = new THREE.MeshStandardMaterial({ color: 0xD9A83C, metalness: .8, roughness: .3 });
    var baseMat = new THREE.MeshStandardMaterial({ color: 0x6A4B28, metalness: .5, roughness: .5 });

    function makeMirror(m) {
      var g = new THREE.Group();
      var base = new THREE.Mesh(new THREE.CylinderGeometry(.3, .36, .1, 22), baseMat); base.position.y = .05; g.add(base);
      var frame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.2, .08), frameMat); frame.position.y = .68; g.add(frame);
      var glass = new THREE.Mesh(new THREE.PlaneGeometry(.86, 1.04), mirrorMat); glass.position.set(0, .68, .052); g.add(glass);
      var backPlate = new THREE.Mesh(new THREE.BoxGeometry(.98, 1.16, .03), new THREE.MeshStandardMaterial({ color: 0x3A2A1E, roughness: .8 }));
      backPlate.position.set(0, .68, -.03); g.add(backPlate);
      var tag = new THREE.Mesh(new THREE.PlaneGeometry(.62, .17), new THREE.MeshBasicMaterial({ map: textTex('点我转 ↻', { bg: 'rgba(30,22,10,.88)', fg: '#F2C14E', size: 40, w: 300, h: 84 }), transparent: true }));
      tag.rotation.x = -Math.PI / 2; tag.rotation.z = .0; tag.position.set(0, .028, .62); g.add(tag);
      g.userData.pick = m;
      m.grp = g; m.glass = glass;
      g.position.copy(cellPos(m.x, m.z));
      g.rotation.y = m.type === '/' ? -Math.PI / 4 : Math.PI / 4;
      scene.add(g);
      return g;
    }

    var LEVELS = [
      { start: { x: 0, z: 3, dir: 'E' }, rose: { x: 6, z: 1 },
        mirrors: [{ x: 3, z: 3, type: '/' }, { x: 3, z: 1, type: '/' }],
        init: ['\\', '\\'],
        tip: '光束从左边射进来。先让它在第 4 排拐个弯。' },
      { start: { x: 0, z: 1, dir: 'E' }, rose: { x: 5, z: 2 },
        mirrors: [{ x: 3, z: 1, type: '\\' }, { x: 3, z: 4, type: '\\' }, { x: 5, z: 4, type: '/' }],
        init: ['/', '/', '\\'],
        tip: '三条镜子都在错的角度，跟着右下小地图一格一格转。' },
      { start: { x: 0, z: 6, dir: 'E' }, rose: { x: 6, z: 5 },
        mirrors: [{ x: 2, z: 6, type: '/' }, { x: 2, z: 3, type: '/' }, { x: 4, z: 3, type: '\\' }, { x: 4, z: 5, type: '\\' }],
        init: ['\\', '\\', '/', '/'],
        tip: '四面镜子，光束要走一条 Z 字形的路才能照到玫瑰。' }
    ];

    var lv = 0, mirrors = [], beamGrp = new THREE.Group(); scene.add(beamGrp);
    var beamMat = new THREE.MeshStandardMaterial({ color: 0x7FF0E4, emissive: 0x3FD8C8, emissiveIntensity: 1.8, roughness: .4, metalness: .2 });
    var hitMat = new THREE.MeshBasicMaterial({ color: 0xBFF8F2 });

    var hud = el('div', 'gx-score');
    host.appendChild(hud);
    var miniWrap = el('div', 'gx-minimap');
    var mini = el('canvas', 'gx-mini-canvas'); mini.width = 240; mini.height = 240;
    miniWrap.appendChild(mini);
    host.appendChild(miniWrap);
    var miniCtx = mini.getContext('2d');

    var DIRS = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
    function reflect(dir, t) {
      var tab = t === '/' ? { E: 'N', N: 'E', W: 'S', S: 'W' } : { E: 'S', S: 'E', W: 'N', N: 'W' };
      return tab[dir];
    }

    var path = [], won = false;

    function loadLevel(i) {
      lv = i;
      while (mirrors.length) { scene.remove(mirrors.pop().grp); }
      var L = LEVELS[i % LEVELS.length];
      mirrors = L.mirrors.map(function (m, k) {
        var mm = { x: m.x, z: m.z, type: L.init[k] };
        makeMirror(mm); return mm;
      });
      roseGrp.position.copy(cellPos(L.rose.x, L.rose.z));
      var sp = cellPos(L.start.x, L.start.z);
      emitGrp.position.set(sp.x - TS * .62, .42, sp.z);
      trace();
    }

    function trace() {
      var L = LEVELS[lv % LEVELS.length];
      var pos = { x: L.start.x, z: L.start.z }, dir = L.start.dir;
      path = [];
      var startP = cellPos(pos.x, pos.z); startP.x -= TS * .62; startP.z += 0; path.push(startP.clone());
      won = false;
      for (var step = 0; step < 80; step++) {
        if (pos.x === L.rose.x && pos.z === L.rose.z) { won = true; break; }
        for (var k = 0; k < mirrors.length; k++) if (mirrors[k].x === pos.x && mirrors[k].z === pos.z) { dir = reflect(dir, mirrors[k].type); break; }
        var d = DIRS[dir];
        pos = { x: pos.x + d[0], z: pos.z + d[1] };
        if (pos.x < 0 || pos.x >= N || pos.z < 0 || pos.z >= N) {
          var edge = cellPos(Math.max(-.6, Math.min(N - .4, pos.x)), Math.max(-.6, Math.min(N - .4, pos.z)));
          path.push(edge); break;
        }
        path.push(cellPos(pos.x, pos.z));
      }
      drawBeam(); drawMini(); updateHud();
      if (won) win();
    }

    function drawBeam() {
      while (beamGrp.children.length) { var o = beamGrp.children.pop(); if (o.geometry) o.geometry.dispose(); }
      for (var i = 1; i < path.length; i++) {
        var a = path[i - 1].clone(); a.y = .55;
        var b = path[i].clone(); b.y = .55;
        beamGrp.add(bar(a, b, .045, beamMat));
      }
      for (var j = 0; j < path.length - 1; j++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), hitMat);
        s.position.copy(path[j]); s.position.y = .55; beamGrp.add(s);
      }
      var endGlow = new THREE.PointLight(0x6FE8DC, 1.8, 6);
      endGlow.position.copy(path[path.length - 1]); endGlow.position.y = .7; beamGrp.add(endGlow);
    }

    function drawMini() {
      var L = LEVELS[lv % LEVELS.length], S = 240, pad = 18, cell = (S - pad * 2) / N;
      miniCtx.clearRect(0, 0, S, S);
      miniCtx.fillStyle = 'rgba(10,14,20,.85)'; miniCtx.fillRect(0, 0, S, S);
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        miniCtx.fillStyle = (i + j) % 2 ? 'rgba(241,231,214,.16)' : 'rgba(222,207,182,.09)';
        miniCtx.fillRect(pad + i * cell, pad + j * cell, cell, cell);
      }
      miniCtx.strokeStyle = 'rgba(217,168,60,.5)'; miniCtx.lineWidth = 1; miniCtx.strokeRect(pad, pad, cell * N, cell * N);
      miniCtx.strokeStyle = '#7FF0E4'; miniCtx.lineWidth = 2; miniCtx.beginPath();
      for (var p = 0; p < path.length; p++) {
        var cx = pad + (path[p].x / TS + (N - 1) / 2 + .5) * cell;
        var cz = pad + (path[p].z / TS + (N - 1) / 2 + .5) * cell;
        if (p === 0) miniCtx.moveTo(cx, cz); else miniCtx.lineTo(cx, cz);
      }
      miniCtx.stroke();
      mirrors.forEach(function (m) {
        var mx = pad + (m.x + .5) * cell, mz = pad + (m.z + .5) * cell;
        miniCtx.strokeStyle = '#F2C14E'; miniCtx.lineWidth = 2.4;
        miniCtx.beginPath();
        var sgn = m.type === '/' ? 1 : -1;
        miniCtx.moveTo(mx - cell * .3, mz + sgn * cell * .3);
        miniCtx.lineTo(mx + cell * .3, mz - sgn * cell * .3);
        miniCtx.stroke();
      });
      miniCtx.fillStyle = '#6FA8FF';
      miniCtx.beginPath(); miniCtx.arc(pad + (L.rose.x + .5) * cell, pad + (L.rose.z + .5) * cell, 5, 0, Math.PI * 2); miniCtx.fill();
      miniCtx.strokeStyle = 'rgba(111,168,255,.75)'; miniCtx.beginPath(); miniCtx.arc(pad + (L.rose.x + .5) * cell, pad + (L.rose.z + .5) * cell, 9, 0, Math.PI * 2); miniCtx.stroke();
      miniCtx.fillStyle = '#59E6D8';
      miniCtx.fillRect(pad + (L.start.x) * cell - 4, pad + (L.start.z + .25) * cell, cell * .4, cell * .5);
    }

    function updateHud() {
      hud.innerHTML = '<b>第 ' + (lv + 1) + ' / ' + LEVELS.length + ' 关</b><span>' + (won ? '光束照到玫瑰了' : '点镜子旋转 90°，把光送到蓝玫瑰') + '</span>';
    }

    function win() {
      toast('光束照进蓝玫瑰了 🌹');
      roseRing.material.opacity = 1; roseGlow.intensity = 6;
      setTimeout(function () {
        if (lv + 1 < LEVELS.length) loadLevel(lv + 1);
        else { loadLevel(0); toast('三关都通了，从头再来一遍'); }
      }, 1600);
    }

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var glasses = mirrors.map(function (m) { return m.glass; });
      var hit = raycaster.intersectObjects(glasses, false)[0];
      if (!hit) return;
      var mm = hit.object.parent.userData.pick;
      mm.type = mm.type === '/' ? '\\' : '/';
      mm.grp.rotation.y = mm.type === '/' ? -Math.PI / 4 : Math.PI / 4;
      trace();
    });

    var hintBtn = el('button', 'gx-hint', '提示');
    host.appendChild(hintBtn);
    hintBtn.onclick = function () { toast(LEVELS[lv % LEVELS.length].tip, 3600); };

    function resize() { var w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>点镜面旋转，光束到玫瑰即过关</span><span class="gx-badge">3D 光路</span>'));

    loadLevel(0);

    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      roseRing.scale.setScalar(1 + Math.sin(t * 2) * .05);
      roseCore.rotation.y += dt * .8;
      roseGlow.intensity = won ? 5.5 + Math.sin(t * 4) * 1 : 2.6 + Math.sin(t * 1.4) * .5;
      emitGlow.intensity = 1.8 + Math.sin(t * 3) * .4;
    }});
    return { dispose: function () { stop(); renderer.dispose(); window.removeEventListener('resize', resize); } };
  }

  /* ---------- 8 行李箱 404 ---------- */
  function game8(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1A1410, 0.03);
    bgGrad(scene, '#2A2118', '#0C0906');
    var camera = new THREE.PerspectiveCamera(48, 1, .1, 80);
    orbit(camera, canvas, new THREE.Vector3(0, .42, .35), { r: 10.8, yaw: .06, pitch: 1.02, minPitch: .5, maxPitch: 1.2 });

    scene.add(new THREE.AmbientLight(0xFFEBD8, 1.9));
    scene.add(new THREE.HemisphereLight(0xFFF4E6, 0x2A2018, 1.2));
    var key = new THREE.SpotLight(0xFFE2BC, 8, 26, .75, .5); key.position.set(3, 9, 7); scene.add(key);
    var fill = new THREE.PointLight(0xFFC98A, 2.6, 16); fill.position.set(-5, 3, 3); scene.add(fill);

    var floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x2B2118, roughness: .95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; scene.add(floor);
    var table = new THREE.Mesh(new THREE.BoxGeometry(11.4, .12, 8.4), new THREE.MeshStandardMaterial({ color: 0xA9865C, roughness: .62, metalness: .06 }));
    table.position.set(0, -.045, .9); scene.add(table);
    var mat = new THREE.Mesh(new THREE.BoxGeometry(7.4, .03, 5.4), new THREE.MeshStandardMaterial({ color: 0x463226, roughness: .95 }));
    mat.position.set(0, .005, .9); scene.add(mat);

    var W = 6, H = 4, CELL = .46;
    var CW = W * CELL, CH = H * CELL;

    var caseGrp = new THREE.Group();
    var leather = new THREE.MeshStandardMaterial({ color: 0x2E4E48, roughness: .58, metalness: .14 });
    var leather2 = new THREE.MeshStandardMaterial({ color: 0x223A36, roughness: .68, metalness: .1 });
    var metal = new THREE.MeshStandardMaterial({ color: 0xC6D0D6, metalness: .85, roughness: .28 });
    var liningMat = new THREE.MeshStandardMaterial({ color: 0xE9DCC2, roughness: .88 });

    var baseShell = new THREE.Mesh(new THREE.BoxGeometry(CW + .46, .26, CH + .46), leather);
    baseShell.position.y = .13; caseGrp.add(baseShell);
    var walls = [
      { w: CW + .46, d: .08, x: 0, z: -(CH + .46) / 2 + .04 },
      { w: CW + .46, d: .08, x: 0, z: (CH + .46) / 2 - .04 },
      { w: .08, d: CH + .46, x: -(CW + .46) / 2 + .04, z: 0 },
      { w: .08, d: CH + .46, x: (CW + .46) / 2 - .04, z: 0 }
    ];
    walls.forEach(function (wl) {
      var wallM = new THREE.Mesh(new THREE.BoxGeometry(wl.w, .42, wl.d), leather2);
      wallM.position.set(wl.x, .47, wl.z); caseGrp.add(wallM);
    });
    var lining = new THREE.Mesh(new THREE.BoxGeometry(CW + .06, .02, CH + .06), liningMat);
    lining.position.y = .27; caseGrp.add(lining);
    for (var gl = 1; gl < W; gl++) {
      var lv1 = new THREE.Mesh(new THREE.BoxGeometry(.016, .008, CH), new THREE.MeshStandardMaterial({ color: 0xC0A87E }));
      lv1.position.set(-CW / 2 + gl * CELL, .285, 0); caseGrp.add(lv1);
    }
    for (var gl2 = 1; gl2 < H; gl2++) {
      var lh = new THREE.Mesh(new THREE.BoxGeometry(CW, .008, .016), new THREE.MeshStandardMaterial({ color: 0xC0A87E }));
      lh.position.set(0, .285, -CH / 2 + gl2 * CELL); caseGrp.add(lh);
    }
    var zip = new THREE.Mesh(new THREE.BoxGeometry(CW + .44, .028, .05), metal);
    zip.position.set(0, .67, (CH + .46) / 2 - .04); caseGrp.add(zip);
    var luggageTag = new THREE.Mesh(new THREE.BoxGeometry(.34, .2, .02), new THREE.MeshStandardMaterial({ color: 0x1B2A28, roughness: .5 }));
    luggageTag.position.set(CW * .18, .42, (CH + .46) / 2 + .05); caseGrp.add(luggageTag);
    var tagTxt = new THREE.Mesh(new THREE.PlaneGeometry(.3, .17), new THREE.MeshBasicMaterial({ map: textTex('KUN', { bg: 'rgba(0,0,0,0)', fg: '#F2C14E', size: 56, w: 200, h: 110 }), transparent: true }));
    tagTxt.position.set(CW * .18, .42, (CH + .46) / 2 + .065); caseGrp.add(tagTxt);
    [-CW / 2 + .3, CW / 2 - .3].forEach(function (x) {
      var wheelB = new THREE.Mesh(new THREE.BoxGeometry(.2, .14, .16), leather2);
      wheelB.position.set(x, .07, -(CH + .46) / 2 + .02); caseGrp.add(wheelB);
      var wheel = new THREE.Mesh(new THREE.CylinderGeometry(.115, .115, .1, 18), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: .85 }));
      wheel.rotation.z = Math.PI / 2; wheel.position.set(x, .03, -(CH + .46) / 2 - .02); caseGrp.add(wheel);
    });
    var lidGrp = new THREE.Group();
    var lid = new THREE.Mesh(new THREE.BoxGeometry(CW + .46, .06, CH + .46), leather);
    lid.position.set(0, 0, -(CH + .46) / 2 + 0); lidGrp.add(lid);
    var lidInner = new THREE.Mesh(new THREE.BoxGeometry(CW + .34, .015, CH + .34), liningMat);
    lidInner.position.set(0, .04, -(CH + .46) / 2); lidGrp.add(lidInner);
    var lidPocket = new THREE.Mesh(new THREE.BoxGeometry(CW + .2, .02, CH * .3), new THREE.MeshStandardMaterial({ color: 0xD9C9AC, roughness: .9 }));
    lidPocket.position.set(0, .055, -(CH + .46) / 2 + CH * .18); lidGrp.add(lidPocket);
    [-CW * .22, CW * .22].forEach(function (x) {
      var strap = new THREE.Mesh(new THREE.BoxGeometry(.1, .025, CH * .82), new THREE.MeshStandardMaterial({ color: 0xC4513E, roughness: .7 }));
      strap.position.set(x, .06, -(CH + .46) / 2); lidGrp.add(strap);
      var buckle = new THREE.Mesh(new THREE.BoxGeometry(.14, .03, .1), new THREE.MeshStandardMaterial({ color: 0xD9A83C, metalness: .8, roughness: .3 }));
      buckle.position.set(x, .075, -(CH + .46) / 2 + CH * .3); lidGrp.add(buckle);
    });
    var lidSticker = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .5), new THREE.MeshBasicMaterial({ map: textTex('KUN TOUR · 404', { bg: 'rgba(20,24,22,.9)', fg: '#F2C14E', size: 34, w: 512, h: 160 }), transparent: true }));
    lidSticker.rotation.x = -Math.PI / 2; lidSticker.position.set(0, .085, -(CH + .46) / 2 - CH * .16); lidGrp.add(lidSticker);
    lidGrp.position.set(0, .7, -(CH + .46) / 2);
    lidGrp.rotation.x = 1.66;
    caseGrp.add(lidGrp);
    var plateTxt = new THREE.Mesh(new THREE.PlaneGeometry(.34, .17), new THREE.MeshBasicMaterial({ map: textTex('404', { bg: 'rgba(0,0,0,0)', fg: '#F2C14E', size: 64, w: 256, h: 128 }), transparent: true }));
    plateTxt.rotation.x = -Math.PI / 2; plateTxt.position.set(0, .296, -CH / 2 + .2); caseGrp.add(plateTxt);
    var cornerMat = new THREE.MeshStandardMaterial({ color: 0x8F9AA0, metalness: .8, roughness: .35 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (sg) {
      var cap = new THREE.Mesh(new THREE.BoxGeometry(.16, .2, .16), cornerMat);
      cap.position.set(sg[0] * (CW + .46) / 2, .1, sg[1] * (CH + .46) / 2); caseGrp.add(cap);
    });
    var shadowC = document.createElement('canvas'); shadowC.width = 256; shadowC.height = 256;
    var sg2 = shadowC.getContext('2d');
    var rg = sg2.createRadialGradient(128, 128, 10, 128, 128, 120);
    rg.addColorStop(0, 'rgba(0,0,0,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    sg2.fillStyle = rg; sg2.fillRect(0, 0, 256, 256);
    var shadowTex = new THREE.CanvasTexture(shadowC);
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.0), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(.1, .012, -.8); scene.add(shadow);
    caseGrp.position.set(0, 0, -.9);
    scene.add(caseGrp);

    var P = { coral: 0xE4694F, denim: 0x4A6E96, cream: 0xEDE0CA, mint: 0x59B9A5, tan: 0xC49A63, coal: 0x3A3A44, gold: 0xD9A83C, maroon: 0x8C3B44, sand: 0xD8C49E };
    function std(color, rough, metal) {
      return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? .55 : rough, metalness: metal || .08 });
    }
    function buildItem(kind, w, h, color) {
      var g = new THREE.Group();
      var iw = w * CELL * .88, ih = h * CELL * .88;
      if (kind === 'hoodie') {
        var body = new THREE.Mesh(new THREE.BoxGeometry(iw, .17, ih * .66), std(color, .85)); body.position.y = .085; g.add(body);
        var hood = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10), std(color, .9));
        hood.scale.set(1.5, .7, 1.1); hood.position.set(0, .14, -ih * .3); g.add(hood);
        [-1, 1].forEach(function (sd) {
          var sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.055, iw * .3, 6, 12), std(color, .85));
          sleeve.rotation.z = Math.PI / 2; sleeve.position.set(sd * iw * .38, .1, ih * .22); g.add(sleeve);
          var cuff = new THREE.Mesh(new THREE.TorusGeometry(.055, .018, 6, 14), std(0xF2E6D8, .9));
          cuff.rotation.y = Math.PI / 2; cuff.position.set(sd * iw * .5, .1, ih * .22); g.add(cuff);
        });
        var zipLine = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, ih * .5), std(0xE8DED0, .6));
        zipLine.position.set(0, .175, -.02); g.add(zipLine);
        var fold = new THREE.Mesh(new THREE.BoxGeometry(iw * .9, .05, ih * .15), std(0xF2E6D8, .9)); fold.position.set(0, .18, ih * .26); g.add(fold);
      } else if (kind === 'jeans') {
        var jb = new THREE.Mesh(new THREE.BoxGeometry(iw, .11, ih * .74), std(color, .8)); jb.position.y = .06; g.add(jb);
        [-.28, .28].forEach(function (z) {
          var roll = new THREE.Mesh(new THREE.CylinderGeometry(ih * .16, ih * .16, iw * .96, 14), std(0x3D5C80, .85));
          roll.rotation.z = Math.PI / 2; roll.position.set(0, .11, z * ih); g.add(roll);
        });
        var seam = new THREE.Mesh(new THREE.BoxGeometry(.03, .02, ih * .7), std(0xC9A66B, .7)); seam.position.set(0, .12, 0); g.add(seam);
      } else if (kind === 'pouch') {
        var pouch = new THREE.Mesh(new THREE.BoxGeometry(iw, .18, ih * .8), std(color, .4, .1)); pouch.position.y = .09; g.add(pouch);
        var strap = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, ih * .82), std(0x2E2A26, .6)); strap.position.y = .1; g.add(strap);
      } else if (kind === 'shoes') {
        [-.24, .24].forEach(function (z) {
          var sole = new THREE.Mesh(new THREE.BoxGeometry(iw * .9, .05, ih * .4), std(0xF4F0E8, .6)); sole.position.set(0, .025, z * ih); g.add(sole);
          var up = new THREE.Mesh(new THREE.BoxGeometry(iw * .82, .1, ih * .32), std(color, .55)); up.position.set(0, .1, z * ih); g.add(up);
          var toe = new THREE.Mesh(new THREE.SphereGeometry(ih * .17, 14, 10), std(color, .55)); toe.scale.set(1.6, .8, 1); toe.position.set(iw * .34, .08, z * ih); g.add(toe);
        });
      } else if (kind === 'dryer') {
        var barrel = new THREE.Mesh(new THREE.CylinderGeometry(.11, .13, ih * .72, 16), std(color, .4, .3)); barrel.rotation.x = Math.PI / 2; barrel.position.y = .13; g.add(barrel);
        var nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.075, .095, .26, 16), std(color, .4, .3)); nozzle.rotation.x = Math.PI / 2; nozzle.position.set(0, .13, ih * .45); g.add(nozzle);
        var cable = new THREE.Mesh(new THREE.TorusGeometry(.12, .02, 6, 20, Math.PI * 1.8), std(0x2A2A30, .7)); cable.rotation.x = Math.PI / 2; cable.position.set(0, .04, -ih * .3); g.add(cable);
      } else if (kind === 'camera') {
        var camBody = new THREE.Mesh(new THREE.BoxGeometry(iw * .85, .13, ih * .75), std(color, .5, .2)); camBody.position.y = .07; g.add(camBody);
        var lens = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, .16, 18), std(0x1E1E24, .35, .4)); lens.rotation.x = Math.PI / 2; lens.position.set(0, .09, ih * .36); g.add(lens);
        var ringL = new THREE.Mesh(new THREE.TorusGeometry(.085, .014, 8, 20), std(0xD9D2C4, .3, .6)); ringL.position.set(0, .09, ih * .44); g.add(ringL);
      } else if (kind === 'bottle') {
        var bot = new THREE.Mesh(new THREE.CylinderGeometry(.085, .08, .3, 16), std(color, .3, .5)); bot.position.y = .15; g.add(bot);
        var cap = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .07, 16), std(0x2E2E36, .5, .3)); cap.position.y = .33; g.add(cap);
      } else if (kind === 'buds') {
        var bc = new THREE.Mesh(new THREE.BoxGeometry(.2, .09, .17), std(color, .35, .05)); bc.position.y = .05; g.add(bc);
        var dot = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .06, 10), std(0xE8E2D4)); dot.position.set(.03, .05, .05); g.add(dot);
      } else if (kind === 'passport') {
        var pp = new THREE.Mesh(new THREE.BoxGeometry(.22, .03, .3), std(color, .5, .1)); pp.position.y = .03; g.add(pp);
        var emblem = new THREE.Mesh(new THREE.CircleGeometry(.055, 16), std(0xD9A83C, .35, .7)); emblem.rotation.x = -Math.PI / 2; emblem.position.set(0, .05, 0); g.add(emblem);
      } else if (kind === 'hat') {
        var crown = new THREE.Mesh(new THREE.CylinderGeometry(.11, .13, .13, 18), std(color, .8)); crown.position.y = .1; g.add(crown);
        var brim = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .025, 22), std(color, .85)); brim.position.y = .04; g.add(brim);
      } else {
        [-.18, .18].forEach(function (z) {
          var sole2 = new THREE.Mesh(new THREE.CapsuleGeometry(.06, ih * .5, 6, 12), std(color, .8));
          sole2.rotation.z = Math.PI / 2; sole2.position.set(0, .075, z); g.add(sole2);
          var toe2 = new THREE.Mesh(new THREE.SphereGeometry(.062, 10, 8), std(color, .8)); toe2.position.set(iw * .32, .075, z); g.add(toe2);
        });
      }
      return g;
    }

    var items = [
      { kind: 'hoodie', w: 3, h: 2, color: P.coral, name: '卫衣' },
      { kind: 'jeans', w: 2, h: 2, color: P.denim, name: '牛仔裤' },
      { kind: 'pouch', w: 2, h: 1, color: P.cream, name: '洗漱包' },
      { kind: 'shoes', w: 2, h: 1, color: P.sand, name: '运动鞋' },
      { kind: 'dryer', w: 1, h: 2, color: P.coal, name: '吹风机' },
      { kind: 'camera', w: 2, h: 1, color: P.coal, name: '相机' },
      { kind: 'bottle', w: 1, h: 1, color: P.mint, name: '水杯' },
      { kind: 'buds', w: 1, h: 1, color: P.mint, name: '耳机盒' },
      { kind: 'passport', w: 1, h: 1, color: P.maroon, name: '护照' },
      { kind: 'hat', w: 1, h: 2, color: P.tan, name: '帽子' },
      { kind: 'sock', w: 1, h: 1, color: P.gold, name: '袜子' }
    ];

    var occ = {}, placed = 0, total = W * H, selected = null;
    var tray = new THREE.Group(); scene.add(tray);
    var rowZ = [.95, 1.75, 2.55], colX = [-1.42, -.47, .47, 1.42];
    var itemMeshes = [];

    items.forEach(function (it, i) {
      var mesh = buildItem(it.kind, it.w, it.h, it.color);
      mesh.userData.item = it; mesh.userData.i = i;
      var tx = colX[i % 4], tz = rowZ[Math.floor(i / 4)];
      mesh.position.set(tx, .02, tz);
      var lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(it.name, { bg: 'rgba(24,16,10,.9)', fg: '#F6E7CF', size: 36, w: 260, h: 70 }), transparent: true, depthTest: false }));
      lab.position.set(0, .34, 0); lab.scale.set(.42, .13, 1); mesh.add(lab);
      mesh.userData.label = lab;
      mesh.userData.home = new THREE.Vector3(tx, .02, tz);
      mesh.userData.placed = false;
      tray.add(mesh); itemMeshes.push(mesh);
    });

    var hud = el('div', 'gx-score');
    host.appendChild(hud);
    function updateHud() {
      hud.innerHTML = '<b>已放置 ' + placed + ' / ' + total + '</b><span>' + (placed === total ? '刚好塞满，合上箱子出发 ✈' : '点物件选中，再点箱子里的格子放下') + '</span>';
    }
    updateHud();

    function cellsFor(it, cx, cz) {
      var list = [];
      for (var a = 0; a < it.w; a++) for (var b = 0; b < it.h; b++) list.push([cx + a, cz + b]);
      return list;
    }
    function canPlace(it, cx, cz) {
      if (cx < 0 || cz < 0 || cx + it.w > W || cz + it.h > H) return false;
      var list = cellsFor(it, cx, cz);
      for (var i = 0; i < list.length; i++) if (occ[list[i][0] + ',' + list[i][1]]) return false;
      return true;
    }
    function cellFromEvent(e) {
      var r = canvas.getBoundingClientRect();
      var ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      var ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.28);
      var p = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, p)) return null;
      return { cx: Math.floor((p.x + CW / 2) / CELL), cz: Math.floor((p.z + .9 + CH / 2) / CELL) };
    }

    function rootOf(obj, flag) {
      var o = obj;
      while (o && !o.userData[flag]) o = o.parent;
      return o;
    }

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);

      var hitT = raycaster.intersectObjects(itemMeshes, true)[0] || null;
      if (hitT) {
        var root2 = rootOf(hitT.object, 'item');
        if (root2 && !root2.userData.placed) {
          if (selected === root2) { root2.scale.setScalar(1); selected = null; return; }
          if (selected) selected.scale.setScalar(1);
          selected = root2; selected.scale.setScalar(1.05);
          toast('已选中：' + root2.userData.item.name + '，再点箱子里的格子', 1800);
          return;
        }
      }

      var hitP = raycaster.intersectObjects(caseGrp.children, true)[0] || null;
      var rootP = hitP ? rootOf(hitP.object, 'placed') : null;
      if (rootP) {
        var itp = rootP.userData.item;
        cellsFor(itp, rootP.userData.cx, rootP.userData.cz).forEach(function (c) { delete occ[c[0] + ',' + c[1]]; });
        placed--; caseGrp.remove(rootP);
        rootP.userData.placed = false;
        rootP.position.copy(rootP.userData.home); rootP.rotation.y = 0;
        if (rootP.userData.label) rootP.userData.label.visible = true;
        tray.add(rootP); itemMeshes.push(rootP);
        updateHud(); toast('拿回来了：' + itp.name);
        return;
      }

      if (!selected) return;
      var cell = cellFromEvent(e);
      if (!cell) return;
      var it = selected.userData.item;
      if (!canPlace(it, cell.cx, cell.cz)) { toast('这个位置放不下，换个地方'); return; }
      cellsFor(it, cell.cx, cell.cz).forEach(function (c) { occ[c[0] + ',' + c[1]] = true; });
      var idx = itemMeshes.indexOf(selected); if (idx >= 0) itemMeshes.splice(idx, 1);
      var grp = selected; selected = null;
      grp.scale.setScalar(1);
      tray.remove(grp);
      if (grp.userData.label) grp.userData.label.visible = false;
      grp.position.set((cell.cx + it.w / 2 - W / 2) * CELL, .28, (cell.cz + it.h / 2 - H / 2) * CELL - .9);
      grp.rotation.y = 0;
      grp.userData.placed = true; grp.userData.cx = cell.cx; grp.userData.cz = cell.cz;
      caseGrp.add(grp);
      placed++; updateHud();
      if (placed === total) toast('24 格刚好塞满，合上箱子出发 ✈', 3000);
    });

    function resize() { var w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>6×4 格，塞满 24 格</span><span class="gx-badge">3D 收纳</span>'));

    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      if (selected) selected.rotation.y = Math.sin(t * 2) * .12;
    }});
    return { dispose: function () { stop(); renderer.dispose(); window.removeEventListener('resize', resize); } };
  }

  var factories = { g5: game5, g6: game6, g8: game8 };

  /* ---------- 游戏厅 UI ---------- */
  function buildHub() {
    var grid = el('div', 'gx-grid');
    GAMES.forEach(function (g) {
      var icon = g.id === 'g5' ? '💡' : g.id === 'g6' ? '🪞' : '🧳';
      var card = el('article', 'gx-card');
      card.innerHTML =
        '<div class="gx-cover" style="--c:' + g.color + '"><span class="gx-ico">' + icon + '</span></div>' +
        '<div class="gx-body"><h3>' + g.name + '</h3><p>' + g.desc + '</p>' +
        '<div class="gx-meta"><span class="gx-tag">' + g.tag + '</span><span class="gx-diff">' + g.diff + '</span></div>' +
        '<button class="gx-play">进去看看 →</button></div>';
      card.querySelector('.gx-play').addEventListener('click', function () { openGame(g); });
      grid.appendChild(card);
    });
    app.innerHTML = '';
    var head = el('div', 'gx-head');
    head.innerHTML = '<p class="gx-kicker">KUN 星站 · 游戏厅</p><h2>3 个能一直玩的 3D 小游戏</h2>' +
      '<p class="gx-sub">立体场景，手指滑动可绕看四周。记忆、光路、收纳三种玩法，慢慢更新。</p>';
    app.appendChild(head); app.appendChild(grid);
  }

  var STEPS = {
    g5: ['座位会像灯海一样依次亮起，记住顺序。', '轮到你时，按同样顺序点座位；点错就重来这一关。', '每过一关序列更长，可以无限往上刷。'],
    g6: ['左边金色的装置是发射器，会射出青色激光。', '点任意一面镜子，它就会旋转 90°，改变光束方向。', '把光束引到那朵蓝玫瑰上就过关；右下角小地图会实时画出光路。'],
    g8: ['行李箱里是 6×4 共 24 格，要刚好塞满。', '点下方桌上的物件选中，再点箱子里的格子放下。', '大件先放、小件补缝；点已经放进去的物件可以拿回来。']
  };

  function openGame(info) {
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
