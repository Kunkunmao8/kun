/* KUN 星站 · 游戏厅（Three.js 3D 小游戏合集） */
(function () {
  var app = document.getElementById('gamesApp');
  if (!app || !window.THREE) return;

  var GAMES = [
    { id: 'g1', name: '蓝玫瑰密室 · 后台 13 号', tag: '3D 密室解谜', diff: '★★★★', color: '#4C86F2',
      desc: '后台化妆间被反锁，找线索、调灯光、开音箱，拿到那朵蓝玫瑰。', hint: '先看看墙上的海报，再碰灯光台。' },
    { id: 'g4', name: '录音棚 · 声纹保险箱', tag: '3D 听觉解谜', diff: '★★★★', color: '#7FB2FF',
      desc: '四段共鸣频率对上波形，保险箱才会打开。', hint: '每根推子靠近目标时会变绿。' },
    { id: 'g5', name: '金海记忆剧场', tag: '3D 记忆挑战', diff: '★★★', color: '#F2C14E',
      desc: '记住灯海亮起的顺序，一层层复现，永无止境。', hint: '灯亮时别急，先记第一个。' },
    { id: 'g6', name: '蓝玫瑰镜面迷宫', tag: '3D 光路解谜', diff: '★★★', color: '#8FD3FF',
      desc: '转动镜子，把激光引到玫瑰，沿途收集花瓣。', hint: '点镜子它就会转 90°。' },
    { id: 'g7', name: '天台夜行 · 猫的密语', tag: '3D 寻物解谜', diff: '★★★', color: '#FFB565',
      desc: '在霓虹天台找齐 5 条线索，猫会给你提示，最后拼出密码。', hint: '发光的球都可以点。' },
    { id: 'g8', name: '行李箱 404', tag: '3D 空间收纳', diff: '★★★', color: '#F08A3C',
      desc: '巡演前把应援物塞进 6×4 的箱子，一格都不能浪费。', hint: '先放大的，再用小的填缝。' },
    { id: 'g10', name: 'KUN 星图 · 轨道拼图', tag: '3D 星图解谜', diff: '★★★★', color: '#B79BFF',
      desc: '拖动星球对齐轨道上的暗星，连成 KUN 星座。', hint: '靠近目标时会自己吸附。' }
  ];

  var CSS = '';
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
    var close = function () { mask.remove(); if (onClose) onClose(); };
    box.querySelector('.gx-x').onclick = close;
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    return { mask: mask, close: close, box: box };
  }

  function makeGL(canvas) {
    var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.28;
    if ('outputColorSpace' in r) r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  }

  /* 相机绕目标拖拽 */
  function orbit(camera, dom, target, cfg) {
    cfg = cfg || {};
    var yaw = cfg.yaw || 0.3, pitch = cfg.pitch || 0.32, R = cfg.r || 6;
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

  function starTex(size, inner, outer) {
    var c = document.createElement('canvas'); c.width = c.height = size || 128;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(c.width / 2, c.height / 2, 2, c.width / 2, c.height / 2, c.width / 2);
    rg.addColorStop(0, inner || 'rgba(255,255,255,.95)');
    rg.addColorStop(0.45, outer || 'rgba(140,190,255,.25)');
    rg.addColorStop(1, 'rgba(120,170,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, c.width, c.height);
    return new THREE.CanvasTexture(c);
  }

  function textTex(txt, opt) {
    opt = opt || {};
    var c = document.createElement('canvas'); c.width = opt.w || 512; c.height = opt.h || 256;
    var g = c.getContext('2d');
    g.fillStyle = opt.bg || 'rgba(8,18,40,.9)'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = opt.fg || '#BFD8FF';
    g.font = (opt.weight || '700') + ' ' + (opt.size || 96) + 'px "PingFang SC","Songti SC",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, c.width / 2, c.height / 2);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
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

  function dome(scene, inner, outer, r) {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(128, 132, 6, 128, 128, 178);
    rg.addColorStop(0, inner); rg.addColorStop(1, outer);
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Mesh(new THREE.SphereGeometry(r || 42, 24, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false }));
    scene.add(sp);
    return sp;
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

  /* ---------- 1 蓝玫瑰密室 ---------- */
  function game1(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081020);
    scene.fog = new THREE.FogExp2(0x081020, 0.022);
    var camera = new THREE.PerspectiveCamera(70, 1, 0.1, 60);
    var target = new THREE.Vector3(0, 1.5, -2.55);
    orbit(camera, canvas, target, { r: 5.3, yaw: 0.06, pitch: 1.50, minPitch: 1.2, maxPitch: 1.55 });

    scene.add(new THREE.AmbientLight(0x8FAEE0, 2.5));
    var hemi = new THREE.HemisphereLight(0xA8C8FF, 0x1A2438, 1.2); scene.add(hemi);
    var lamp = new THREE.PointLight(0xFFD6A6, 4.2, 14); lamp.position.set(0, 2.8, -0.6); scene.add(lamp);
    var spot = new THREE.SpotLight(0xBFD8FF, 6, 20, 0.8, 0.5); spot.position.set(1.5, 3.6, 2.6); spot.target.position.set(0, 1, -1); scene.add(spot); scene.add(spot.target);

    var pickables = [];
    function addPick(mesh, id) { mesh.userData.pick = id; pickables.push(mesh); scene.add(mesh); }

    // 地板 / 墙
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshStandardMaterial({ color: 0x2E4060, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    var ledMat = new THREE.MeshStandardMaterial({ color: 0x2F6BFF, emissive: 0x2F6BFF, emissiveIntensity: 1.8, roughness: .4 });
    var ledWall = new THREE.Mesh(new THREE.BoxGeometry(6.2, .07, .07), ledMat); ledWall.position.set(0, .12, -3.14); scene.add(ledWall);
    var wallMat = new THREE.MeshStandardMaterial({ color: 0x2C3E5E, roughness: 0.9 });
    var back = new THREE.Mesh(new THREE.BoxGeometry(6.6, 4.6, 0.2), wallMat); back.position.set(0, 2.3, -3.3); scene.add(back);
    var left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.6, 7), wallMat); left.position.set(-3.3, 2.3, 0); scene.add(left);
    var right = left.clone(); right.position.x = 3.3; scene.add(right);
    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 7), new THREE.MeshStandardMaterial({ color: 0x101A2C, roughness: .95 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.55, 0); scene.add(ceil);

    // 化妆台
    var desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0x3A4E70, roughness: .75 }));
    desk.position.set(0, 1.05, -2.35); scene.add(desk);
    var legGeo = new THREE.BoxGeometry(0.1, 1.05, 0.1);
    [[-1.2, -1.9], [1.2, -1.9], [-1.2, -2.8], [1.2, -2.8]].forEach(function (p) {
      var l = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x1A2436 })); l.position.set(p[0], 0.52, p[1]); scene.add(l);
    });

    // 灯光台（可点）
    var consoleMat = new THREE.MeshStandardMaterial({ color: 0x24344E, emissive: 0x0, roughness: .5 });
    var consoleM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.5), consoleMat);
    consoleM.position.set(-0.5, 1.16, -2.1); addPick(consoleM, 'console');
    var knobs = [];
    for (var k = 0; k < 3; k++) {
      var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 14), new THREE.MeshStandardMaterial({ color: 0x9FB6D8, metalness: .7, roughness: .3 }));
      knob.position.set(-0.75 + k * 0.22, 1.22, -2.1); scene.add(knob); knobs.push(knob);
    }

    // 音箱（可点）
    var spk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.92, 0.38), new THREE.MeshStandardMaterial({ color: 0x24344E, roughness: .8 }));
    spk.position.set(1.32, 0.66, -2.95); scene.add(spk);
    var spkFace = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshStandardMaterial({ color: 0x3A527A, emissive: 0x12305A, emissiveIntensity: .8, roughness: .6 }));
    spkFace.position.set(1.32, 0.74, -2.75); addPick(spkFace, 'speaker');

    // 镜子
    var mir = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.7), new THREE.MeshStandardMaterial({ color: 0x6E8FBE, metalness: .35, roughness: .22, emissive: 0x1B3358, emissiveIntensity: .9 }));
    mir.position.set(1.55, 1.95, -3.16); addPick(mir, 'mirror');
    var mirFrame = new THREE.Mesh(new THREE.BoxGeometry(.92, 1.82, .06), new THREE.MeshStandardMaterial({ color: 0x8FA8CC, metalness: .6, roughness: .3, emissive: 0x2A4A78, emissiveIntensity: .5 }));
    mirFrame.position.set(1.55, 1.95, -3.21); scene.add(mirFrame);

    // 门
    var door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x49648E, roughness: .65 }));
    door.position.set(0, 1.1, -3.16); addPick(door, 'door');
    var lockPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0x0C1526, emissive: 0x2C5BA8, emissiveIntensity: .8 }));
    lockPanel.position.set(0.26, 1.25, -3.1); scene.add(lockPanel);

    // 墙上海报（提示 3914）
    var poster = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .62), new THREE.MeshStandardMaterial({ map: textTex('演出 SPEC 3914', { bg: '#0E1B33', fg: '#9FC0F0', size: 52 }), roughness: .9 }));
    poster.position.set(-1.62, 2.35, -3.18); scene.add(poster);

    // 衣架（后台感）
    var rackMat = new THREE.MeshStandardMaterial({ color: 0x9AB2D4, metalness: .7, roughness: .3 });
    var rp1 = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.1, 10), rackMat); rp1.position.set(-2.35, 1.05, -1.5); scene.add(rp1);
    var rp2 = rp1.clone(); rp2.position.x = -1.45; scene.add(rp2);
    var rbar = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .95, 10), rackMat); rbar.rotation.z = Math.PI / 2; rbar.position.set(-1.9, 2.05, -1.5); scene.add(rbar);
    [0x1E6BE0, 0x7FA8E0, 0x30456E].forEach(function (cc, gi) {
      var cloth = new THREE.Mesh(new THREE.BoxGeometry(.3, 1.0, .12), new THREE.MeshStandardMaterial({ color: cc, roughness: .85 }));
      cloth.position.set(-2.18 + gi * .3, 1.5, -1.5); scene.add(cloth);
    });

    // 蓝玫瑰（胜利后出现）
    var rose = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), new THREE.MeshStandardMaterial({ color: 0x1E6BE0, metalness: .35, roughness: .35, emissive: 0x0B2A78, emissiveIntensity: .9 }));
    rose.position.set(0, 1.35, -2.35); rose.visible = false; scene.add(rose);
    var roseLight = new THREE.PointLight(0x3E82FF, 0, 5); roseLight.position.copy(rose.position); scene.add(roseLight);

    var state = { light: false, speaker: false, mirror: false, doorOpen: false };

    function win() {
      if (state.doorOpen) return;
      state.doorOpen = true;
      rose.visible = true; roseLight.intensity = 2.2;
      var t0 = performance.now();
      (function animDoor() {
        if (door.position.y < 2.4) { door.position.y += 0.03; requestAnimationFrame(animDoor); }
      })();
      toast('门开了。那朵蓝玫瑰在等你 🎤');
    }

    function checkDoor() {
      var body = el('div', 'gx-tune');
      body.innerHTML = '<p class="gx-tip">输入门锁的 4 位密码</p><input class="gx-code" maxlength="4" inputmode="numeric" placeholder="····">' +
        '<div class="gx-row"><button class="gx-btn">开锁</button><button class="gx-btn ghost">取消</button></div>';
      var p = panel('门锁 · 13 号房', body);
      body.querySelector('.gx-btn.ghost').onclick = p.close;
      body.querySelector('.gx-btn:not(.ghost)').onclick = function () {
        var v = body.querySelector('.gx-code').value.trim();
        if (v === '3914') { p.close(); if (!state.light) toast('灯没亮，先搞定灯光台吧'); else win(); }
        else { toast('密码不对，墙上和音箱里都藏着数'); }
      };
      setTimeout(function () { var i = body.querySelector('.gx-code'); if (i) i.focus(); }, 100);
    }

    function openConsole() {
      var body = el('div', 'gx-tune');
      body.innerHTML = '<p class="gx-tip">把三路灯光调成应援蓝（R 30 / G 120 / B 255）</p>' +
        ['R', 'G', 'B'].map(function (n, i) { return '<label class="gx-sl"><span>' + n + '</span><input type="range" min="0" max="255" value="' + [255, 180, 90][i] + '" data-i="' + i + '"><b>0</b></label>'; }).join('') +
        '<div class="gx-row"><button class="gx-btn">确认</button><button class="gx-btn ghost">取消</button></div>';
      var p = panel('灯光控制台', body);
      var inputs = body.querySelectorAll('input');
      function refresh() { inputs.forEach(function (x) { x.parentNode.querySelector('b').textContent = x.value; }); }
      inputs.forEach(function (x) { x.addEventListener('input', refresh); }); refresh();
      body.querySelector('.gx-btn.ghost').onclick = p.close;
      body.querySelector('.gx-btn:not(.ghost)').onclick = function () {
        var v = [].map.call(inputs, function (x) { return +x.value; });
        var ok = Math.abs(v[0] - 30) < 22 && Math.abs(v[1] - 120) < 28 && Math.abs(v[2] - 255) < 30;
        if (ok) {
          state.light = true;
          consoleMat.emissive.setHex(0x2F6BFF); consoleMat.emissiveIntensity = 1.1;
          knobs.forEach(function (kk) { kk.material.emissive = new THREE.Color(0x2F6BFF); kk.material.emissiveIntensity = .8; });
          lamp.color.setHex(0x4A8CFF); lamp.intensity = 3;
          p.close(); toast('灯亮了，墙上浮出一个数字：13');
        } else toast('颜色不对，再往蓝色靠一点');
      };
    }

    function openSpeaker() {
      var body = el('div', 'gx-tune');
      body.innerHTML = '<p class="gx-tip">音箱面板锁住了，需要 4 位演出编号</p><input class="gx-code" maxlength="4" placeholder="SPEC-____">' +
        '<div class="gx-row"><button class="gx-btn">解锁</button><button class="gx-btn ghost">取消</button></div>';
      var p = panel('监听音箱', body);
      body.querySelector('.gx-btn.ghost').onclick = p.close;
      body.querySelector('.gx-btn:not(.ghost)').onclick = function () {
        var v = body.querySelector('.gx-code').value.trim();
        if (v === '3914') { state.speaker = true; spkFace.material.emissive.setHex(0x2F6BFF); spkFace.material.emissiveIntensity = 1; p.close(); toast('音箱开了：密码是 3914'); }
        else toast('编号不对，抬头看看墙上那张演出单');
      };
    }

    var raycaster = new THREE.Raycaster(); var ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(pickables, false)[0];
      if (!hit) return;
      var id = hit.object.userData.pick;
      if (id === 'console') openConsole();
      else if (id === 'speaker') openSpeaker();
      else if (id === 'mirror') { state.mirror = true; toast('镜子里写着：灯亮起来才看得见门。'); }
      else if (id === 'door') checkDoor();
    });

    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>点击：灯光台 / 音箱 / 镜子 / 门</span><span class="gx-badge">3D 密室</span>'));

    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      rose.rotation.y += dt * 0.6;
      rose.position.y = 1.35 + Math.sin(t * 1.4) * 0.05;
      roseLight.intensity = state.doorOpen ? 1.6 + Math.sin(t * 3) * 0.6 : 0;
    }});
    return { dispose: function () { stop(); renderer.dispose(); } };
  }

  /* ---------- 4 录音棚声纹保险箱 ---------- */
  function game4(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x070E1A);
    scene.fog = new THREE.FogExp2(0x070E1A, 0.025);
    var camera = new THREE.PerspectiveCamera(52, 1, 0.1, 60);
    orbit(camera, canvas, new THREE.Vector3(0, 1.5, -2.3), { r: 6.6, yaw: 0.08, pitch: 1.42, minPitch: 1.2, maxPitch: 1.55 });
    scene.add(new THREE.AmbientLight(0x8FAEE0, 2.4));
    scene.add(new THREE.HemisphereLight(0xB8D4FF, 0x1A2438, 1.1));
    var key = new THREE.PointLight(0xFFD6A6, 4.5, 14); key.position.set(-1, 3.4, 2.6); scene.add(key);
    var rim = new THREE.PointLight(0x4C86F2, 3.2, 12); rim.position.set(2.4, 2.2, -2.6); scene.add(rim);
    var safeSpot = new THREE.SpotLight(0xCBDDFF, 9, 14, .5, .55); safeSpot.position.set(0, 4.2, 1.6); safeSpot.target.position.set(0, 2.0, -3.2); scene.add(safeSpot); scene.add(safeSpot.target);

    var floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x243652, roughness: .85 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    var wall = new THREE.Mesh(new THREE.BoxGeometry(8, 4.4, .2), new THREE.MeshStandardMaterial({ color: 0x2A3C58, roughness: .9 }));
    wall.position.set(0, 2.2, -3.6); scene.add(wall);
    // 吸音板装饰
    [-2.6, -1.8, 1.8, 2.6].forEach(function (x) {
      var pnl = new THREE.Mesh(new THREE.BoxGeometry(.62, 1.9, .06), new THREE.MeshStandardMaterial({ color: 0x1C2A44, roughness: .95 }));
      pnl.position.set(x, 2.15, -3.48); scene.add(pnl);
    });

    // 调音台
    var desk = new THREE.Mesh(new THREE.BoxGeometry(3, .12, 1.2), new THREE.MeshStandardMaterial({ color: 0x22314C, roughness: .75 }));
    desk.position.set(0, 1.0, -2.2); scene.add(desk);
    for (var i = 0; i < 4; i++) {
      var strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.8), new THREE.MeshStandardMaterial({ color: 0x3A527A, emissive: 0x1B3560, emissiveIntensity: .6 }));
      strip.position.set(-1.0 + i * .65, 1.08, -2.2); scene.add(strip);
    }
    for (var f = 0; f < 8; f++) {
      var fader = new THREE.Mesh(new THREE.BoxGeometry(.035, .08, .04), new THREE.MeshStandardMaterial({ color: 0xD8E4F6, metalness: .5, roughness: .4, emissive: 0x2A4A80, emissiveIntensity: .3 }));
      fader.position.set(-1.25 + f * .33, 1.12, -2.05); scene.add(fader);
    }
    // 音箱
    [-1.9, 1.9].forEach(function (x) {
      var s = new THREE.Mesh(new THREE.BoxGeometry(.6, 1.2, .5), new THREE.MeshStandardMaterial({ color: 0x0D1626, roughness: .9 }));
      s.position.set(x, .8, -2.9); scene.add(s);
    });

    var onAir = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .36), new THREE.MeshBasicMaterial({ map: textTex('ON AIR', { bg: '#1A0F14', fg: '#FF8FA8', size: 48, w: 512, h: 128 }), transparent: true }));
    onAir.position.set(-2.15, 3.15, -3.48); scene.add(onAir);
    var airGlow = new THREE.PointLight(0xFF6E93, 1.6, 6); airGlow.position.set(-2.15, 3.0, -3.2); scene.add(airGlow);

    // 保险箱（可点）
    var safe = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, .8), new THREE.MeshStandardMaterial({ color: 0x45628E, metalness: .45, roughness: .42 }));
    safe.add(body);
    var doorM = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.0, .1), new THREE.MeshStandardMaterial({ color: 0x5878A6, metalness: .55, roughness: .3 }));
    doorM.position.set(0, 0, .36); safe.add(doorM);
    var dial = new THREE.Mesh(new THREE.TorusGeometry(.19, .045, 12, 28), new THREE.MeshStandardMaterial({ color: 0xF5DCA4, metalness: .85, roughness: .22, emissive: 0x6B4A10, emissiveIntensity: .5 }));
    dial.position.set(0, 0, .42); safe.add(dial);
    // 箱体棱边 + 把手 + 键盘
    var edgeMat = new THREE.MeshStandardMaterial({ color: 0x9DB6DA, metalness: .7, roughness: .28, emissive: 0x2E5A96, emissiveIntensity: .45 });
    var topEdge = new THREE.Mesh(new THREE.BoxGeometry(1.34, .06, .84), edgeMat); topEdge.position.set(0, .62, 0); safe.add(topEdge);
    var botEdge = new THREE.Mesh(new THREE.BoxGeometry(1.34, .06, .84), edgeMat); botEdge.position.set(0, -.62, 0); safe.add(botEdge);
    var handle = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .22, 10), edgeMat);
    handle.rotation.z = Math.PI / 2; handle.position.set(.38, -.05, .44); safe.add(handle);
    var keypad = new THREE.Mesh(new THREE.PlaneGeometry(.26, .3), new THREE.MeshStandardMaterial({ color: 0x0F1A2C, emissive: 0x2F6BFF, emissiveIntensity: .5 }));
    keypad.position.set(.33, .22, .415); safe.add(keypad);
    safe.position.set(0, 1.94, -3.22); scene.add(safe);
    var safeTag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .34), new THREE.MeshBasicMaterial({ map: textTex('SAFE · 13', { bg: '#0C1728', fg: '#9FC0F0', size: 42, w: 512, h: 128 }), transparent: true }));
    safeTag.position.set(0, 2.72, -3.16); scene.add(safeTag);
    doorM.userData.pick = 'safe'; body.userData.pick = 'safe'; dial.userData.pick = 'safe';

    // 目标波形
    var TARGET = [420, 660, 880, 1180], CUR = [300, 300, 300, 300], LOCK = [false, false, false, false];
    var waveCv = el('canvas', 'gx-wave'); waveCv.width = 620; waveCv.height = 150;
    var g2d = waveCv.getContext('2d');
    function drawWave() {
      g2d.clearRect(0, 0, 620, 150);
      g2d.strokeStyle = 'rgba(120,170,255,.25)'; g2d.lineWidth = 1;
      for (var x = 0; x < 620; x += 20) { g2d.beginPath(); g2d.moveTo(x, 0); g2d.lineTo(x, 150); g2d.stroke(); }
      g2d.strokeStyle = 'rgba(140,190,255,.55)'; g2d.lineWidth = 2;
      g2d.beginPath();
      for (var px = 0; px < 620; px++) {
        var y = 75;
        for (var i2 = 0; i2 < 4; i2++) {
          var cxp = 70 + i2 * 150, sig = 16;
          y -= Math.exp(-Math.pow((px - cxp) / sig, 2)) * (TARGET[i2] / 45);
        }
        if (px === 0) g2d.moveTo(px, y); else g2d.lineTo(px, y);
      }
      g2d.stroke();
      g2d.strokeStyle = '#F2C14E'; g2d.lineWidth = 2.4;
      g2d.beginPath();
      for (var px2 = 0; px2 < 620; px2++) {
        var y2 = 75;
        for (var j = 0; j < 4; j++) {
          var cxp2 = 70 + j * 150, sig2 = 16;
          y2 -= Math.exp(-Math.pow((px2 - cxp2) / sig2, 2)) * (CUR[j] / 48);
        }
        if (px2 === 0) g2d.moveTo(px2, y2); else g2d.lineTo(px2, y2);
      }
      g2d.stroke();
    }
    drawWave();

    var solved = false;
    function openSafePanel() {
      if (solved) { toast('保险箱已经开了'); return; }
      var body = el('div', 'gx-tune');
      body.appendChild(waveCv);
      body.appendChild(el('p', 'gx-tip', '把金色波形贴到蓝色波峰上，然后逐个锁定'));
      var sliders = [];
      TARGET.forEach(function (tv, i3) {
        var row = el('label', 'gx-sl');
        row.innerHTML = '<span>' + (i3 + 1) + '</span><input type="range" min="260" max="1400" value="' + CUR[i3] + '"><b>' + CUR[i3] + 'Hz</b><button class="gx-mini">锁定</button>';
        body.appendChild(row);
        var inp = row.querySelector('input'), b = row.querySelector('b'), btn = row.querySelector('.gx-mini');
        sliders.push(inp);
        inp.addEventListener('input', function () {
          CUR[i3] = +inp.value; b.textContent = CUR[i3] + 'Hz';
          var close = Math.abs(CUR[i3] - tv) < 26;
          b.style.color = close ? '#7CE0A8' : '#F2C14E';
          drawWave();
        });
        btn.onclick = function () {
          if (Math.abs(CUR[i3] - tv) < 26) { LOCK[i3] = true; inp.disabled = true; btn.textContent = '已锁定'; btn.classList.add('on'); toast('第 ' + (i3 + 1) + ' 段共鸣对上'); }
          else toast('还没对上，继续微调');
          if (LOCK.every(Boolean)) openNow();
        };
      });
      var p = panel('声纹保险箱', body);
      body.querySelectorAll('input').forEach(function (x) { x.addEventListener('input', function () { drawWave(); }); });
    }
    function openNow() {
      solved = true;
      doorM.rotation.y = -1.2; doorM.position.z = .62;
      var rose = new THREE.Mesh(new THREE.SphereGeometry(.26, 20, 16), new THREE.MeshStandardMaterial({ color: 0x1E6BE0, emissive: 0x0B2A78, emissiveIntensity: 1, metalness: .3, roughness: .35 }));
      rose.position.set(0, 2.05, -2.95); scene.add(rose);
      toast('四个频率锁定了，箱子里是那朵蓝玫瑰 🌹');
    }

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects([body, doorM, dial], false);
      if (hits.length) openSafePanel();
    });

    function resize() { var w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>点击保险箱调频率</span><span class="gx-badge">3D 听觉解谜</span>'));
    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function () { dial.rotation.z += 0.01; } });
    return { dispose: function () { stop(); renderer.dispose(); } };
  }

  /* ---------- 5 金海记忆剧场 ---------- */
  function game5(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x050A16);
    scene.fog = new THREE.FogExp2(0x07101F, 0.014);
    var camera = new THREE.PerspectiveCamera(50, 1, .1, 80);
    orbit(camera, canvas, new THREE.Vector3(0, 1.35, -1.0), { r: 15.5, yaw: 0.32, pitch: 1.16, minPitch: .75, maxPitch: 1.35 });

    scene.add(new THREE.AmbientLight(0x7391C4, 1.8));
    var hemi = new THREE.HemisphereLight(0xA8C8FF, 0x101C30, 1.1); scene.add(hemi);
    var spot = new THREE.SpotLight(0xFFE2B0, 6, 26, .7, .5); spot.position.set(0, 9, 3); scene.add(spot);

    var stage = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, .4, 40), new THREE.MeshStandardMaterial({ color: 0x21375C, emissive: 0x123560, emissiveIntensity: 1.0, roughness: .55 }));
    stage.position.y = .2; scene.add(stage);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, .05, 10, 60), new THREE.MeshStandardMaterial({ color: 0xF2C14E, metalness: .9, roughness: .2, emissive: 0x6A3D00, emissiveIntensity: .6 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = .42; scene.add(ring);

    // 舞台背景板
    var backPanel = new THREE.Mesh(new THREE.PlaneGeometry(13, 6), new THREE.MeshStandardMaterial({ color: 0x0C1830, roughness: .9 }));
    backPanel.position.set(0, 2.4, -4.6); scene.add(backPanel);
    var kun = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshBasicMaterial({ map: textTex('KUN', { bg: '#081426', fg: '#9FC8FF', size: 150, w: 512, h: 256 }), transparent: true, opacity: .95 }));
    kun.position.set(0, 3.5, -4.55); scene.add(kun);
    var sub = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1), new THREE.MeshBasicMaterial({ map: textTex('GOLD SEA · 记忆剧场', { bg: '#081426', fg: '#F2C14E', size: 54, w: 768, h: 192 }), transparent: true, opacity: .9 }));
    sub.position.set(0, 2.1, -4.55); scene.add(sub);
    var micStand = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0xB8C4D8, metalness: .8, roughness: .3 }));
    micStand.position.set(0, 1.1, 0); scene.add(micStand);
    var micTop = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), new THREE.MeshStandardMaterial({ color: 0x1B2436, metalness: .5, roughness: .4 }));
    micTop.position.set(0, 1.72, 0); scene.add(micTop);
    var pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: 0xF2C14E, transparent: true, opacity: .16 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, .42, 0); scene.add(pool);
    var beamMat = new THREE.MeshBasicMaterial({ color: 0x3C7BE0, transparent: true, opacity: .10, side: THREE.DoubleSide, depthWrite: false });
    [-2.2, 0, 2.2].forEach(function (bx) {
      var cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 7, 20, 1, true), beamMat);
      cone.position.set(bx, 6.6, -1.2); scene.add(cone);
    });

    // 座位
    var seats = [], seatMeshes = [];
    var seatGeo = new THREE.BoxGeometry(.46, .34, .4);
    var ringR = [2.9, 3.6, 4.3], per = [14, 18, 22];
    ringR.forEach(function (r, ri) {
      for (var i = 0; i < per[ri]; i++) {
        var a = (i / per[ri]) * Math.PI * 2 + ri * .12;
        var m = new THREE.Mesh(seatGeo, new THREE.MeshStandardMaterial({ color: 0x3A557F, emissive: 0x000000, roughness: .6 }));
        m.position.set(Math.cos(a) * r, .5, Math.sin(a) * r);
        m.userData.idx = seats.length;
        scene.add(m); seats.push({ mesh: m, a: a, r: r, y: .5 }); seatMeshes.push(m);
        var back = new THREE.Mesh(new THREE.BoxGeometry(.42, .34, .07), new THREE.MeshStandardMaterial({ color: 0x2E476E, roughness: .7 }));
        back.position.set(Math.cos(a) * (r + .2), .74, Math.sin(a) * (r + .2)); back.rotation.y = -a; scene.add(back);
      }
    });

    var seq = [], input = [], level = 1, playing = false, score = 0;
    var label = el('div', 'gx-score');
    label.innerHTML = '<b>第 1 关</b><span>点亮的座位顺序，照着重放一遍</span>';
    host.appendChild(label);
    function refreshLabel() { label.innerHTML = '<b>第 ' + level + ' 关</b><span>' + (playing ? '看好灯的顺序…' : '轮到你了：' + input.length + ' / ' + seq.length) + '</span>'; }

    function flash(mesh, ms) {
      mesh.material.emissive.setHex(0x4C86F2); mesh.material.emissiveIntensity = 1.6;
      setTimeout(function () { mesh.material.emissiveIntensity = 0; mesh.material.emissive.setHex(0x000000); }, ms || 420);
    }
    function newRound() {
      input = []; seq = [];
      var n = Math.min(3 + level, 12);
      for (var i = 0; i < n; i++) seq.push(Math.floor(Math.random() * seats.length));
      playing = true; refreshLabel();
      var t = 0;
      seq.forEach(function (idx) {
        setTimeout(function () { flash(seats[idx].mesh, 460); }, 500 + t * 620); t++;
      });
      setTimeout(function () { playing = false; refreshLabel(); }, 500 + t * 620 + 500);
    }
    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      if (playing) return;
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(seatMeshes, false)[0];
      if (!hit) return;
      var idx = hit.object.userData.idx;
      flash(seats[idx].mesh, 300);
      input.push(idx);
      refreshLabel();
      var pos = input.length - 1;
      if (input[pos] !== seq[pos]) {
        toast('顺序错了，重来这一关');
        setTimeout(newRound, 400); return;
      }
      if (input.length === seq.length) {
        score += level * 10; level++;
        toast('过！第 ' + level + ' 关来了');
        setTimeout(newRound, 700);
      }
    });
    function resize() { var w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>记住亮灯顺序并点回去</span><span class="gx-badge">3D 记忆</span>'));
    setTimeout(newRound, 1200);
    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      ring.rotation.z += dt * .25;
      stage.material.emissiveIntensity = .6 + Math.sin(t * 2) * .25;
    }});
    return { dispose: function () { stop(); renderer.dispose(); } };
  }

  /* ---------- 6 蓝玫瑰镜面迷宫 ---------- */
  function game6(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x061019);
    scene.fog = new THREE.FogExp2(0x061019, 0.022);
    var camera = new THREE.PerspectiveCamera(46, 1, .1, 60);
    orbit(camera, canvas, new THREE.Vector3(0, 0.15, 0), { r: 19.5, yaw: 0.03, pitch: .90, minPitch: .7, maxPitch: 1.3 });
    scene.add(new THREE.AmbientLight(0x5A8CB8, 1.05));
    window.__g6cam = camera;
    scene.add(new THREE.HemisphereLight(0x8FD3FF, 0x06121C, .6));
    var light = new THREE.PointLight(0x8FD3FF, 2.2, 16); light.position.set(0, 6, 4); scene.add(light);

    var N = 7, TS = 1.28;
    var board = new THREE.Mesh(new THREE.BoxGeometry(N * TS, .12, N * TS), new THREE.MeshStandardMaterial({ color: 0x1B3A55, roughness: .6, metalness: .25 }));
    board.position.y = -.06; scene.add(board);
    var grid = new THREE.GridHelper(N * TS, N, 0x59A8D8, 0x2A6A94); grid.position.y = .01; scene.add(grid);
    // 展厅地面与立柱（提供纵深）
    bgGrad(scene, '#1B3B62', '#04070E');
    scene.fog = new THREE.FogExp2(0x081422, 0.035);
    var hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: 0x0E2033, roughness: .95, metalness: .1 }));
    hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.y = -.25; scene.add(hallFloor);
    var pillarMat = new THREE.MeshStandardMaterial({ color: 0x122A44, roughness: .7, metalness: .3 });
    var pillarTrim = new THREE.MeshStandardMaterial({ color: 0x4F9BDC, emissive: 0x2A6FA8, emissiveIntensity: 1.4 });
    [[-5.4, -5.4], [5.4, -5.4], [-5.4, 5.4], [5.4, 5.4]].forEach(function (p) {
      var col = new THREE.Mesh(new THREE.CylinderGeometry(.34, .4, 7.2, 12), pillarMat);
      col.position.set(p[0], 3.4, p[1]); scene.add(col);
      var band = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .08, 12), pillarTrim);
      band.position.set(p[0], 5.6, p[1]); scene.add(band);
      var band2 = band.clone(); band2.position.y = 1.2; scene.add(band2);
    });

    // 玫瑰目标
    var rose = new THREE.Mesh(new THREE.SphereGeometry(.34, 22, 18), new THREE.MeshStandardMaterial({ color: 0x2E7BE8, metalness: .35, roughness: .28, emissive: 0x1B4FD0, emissiveIntensity: 1.6 }));
    rose.position.set(0, .55, 0); scene.add(rose);

    function cellPos(cx, cy) { return new THREE.Vector3((cx - (N - 1) / 2) * TS, 0, (cy - (N - 1) / 2) * TS); }

    var mirrors = [], beamLine = null, petals = [], level = 1;
    var levels = [
      { em: [0, 3], dir: 'E', mirrors: [{ x: 3, y: 3, t: 0 }, { x: 3, y: 5, t: 1 }], goal: [6, 1] },
      { em: [0, 0], dir: 'E', mirrors: [{ x: 2, y: 0, t: 0 }, { x: 2, y: 4, t: 1 }, { x: 5, y: 4, t: 0 }], goal: [5, 0] },
      { em: [0, 6], dir: 'E', mirrors: [{ x: 2, y: 6, t: 1 }, { x: 2, y: 2, t: 0 }, { x: 4, y: 2, t: 1 }, { x: 4, y: 5, t: 0 }], goal: [6, 5] }
    ];

    function buildLevel(idx) {
      level = idx;
      mirrors.forEach(function (m) { scene.remove(m.mesh); });
      mirrors = [];
      var L = levels[idx];
      L.mirrors.forEach(function (mm) {
        var mk = new THREE.Group();
        var plate = new THREE.Mesh(new THREE.BoxGeometry(TS * .78, .5, .05), new THREE.MeshStandardMaterial({ color: 0xEAF8FF, metalness: .95, roughness: .06, emissive: 0x3E86C8, emissiveIntensity: .75 }));
        plate.position.y = .3;
        var base = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .08, 12), new THREE.MeshStandardMaterial({ color: 0x2A5E86 }));
        base.position.y = .04;
        mk.add(plate); mk.add(base);
        mk.position.copy(cellPos(mm.x, mm.y));
        mk.rotation.y = mm.t === 0 ? Math.PI / 4 : -Math.PI / 4;
        mk.userData.mirror = mm;
        plate.userData.mirror = mm;
        scene.add(mk);
        mm.obj = mk; mm.plate = plate;
        mirrors.push(mm);
        plate.userData.pick = true;
      });
      // 发射器
      if (window.__g6em) scene.remove(window.__g6em);
      var em = new THREE.Group();
      var eb = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), new THREE.MeshStandardMaterial({ color: 0x1B3B5C, metalness: .6, roughness: .3 }));
      eb.position.y = .3; em.add(eb);
      var ecore = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), new THREE.MeshStandardMaterial({ color: 0x8FD3FF, emissive: 0x8FD3FF, emissiveIntensity: 2 }));
      ecore.position.set(0, .3, 0); em.add(ecore);
      em.position.copy(cellPos(levels[idx].em[0], levels[idx].em[1])); em.position.x -= .8;
      scene.add(em); window.__g6em = em;

      // 花瓣
      petals.forEach(function (p) { scene.remove(p); }); petals = [];
      for (var i = 0; i < 5; i++) {
        var pet = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4C86F2, emissive: 0x2F6BFF, emissiveIntensity: 1.2 }));
        var pos = cellPos(Math.floor(Math.random() * N), Math.floor(Math.random() * N));
        pet.position.set(pos.x, .35, pos.z); scene.add(pet); petals.push(pet);
      }
      var goalP = cellPos(levels[idx].goal[0], levels[idx].goal[1]);
      rose.position.set(goalP.x, .55, goalP.z);
      computeBeam();
      toast('第 ' + (idx + 1) + ' 关：点镜子转 90°，把光引到玫瑰');
    }

    function computeBeam() {
      var L = levels[level];
      var dir = L.dir, x = L.em[0], y = L.em[1];
      var path = [cellPos(x, y)], steps = 0, hitGoal = false;
      var visited = {};
      var dx = dir === 'E' ? 1 : dir === 'W' ? -1 : 0, dy = dir === 'S' ? 1 : dir === 'N' ? -1 : 0;
      while (steps++ < 40) {
        x += dx; y += dy;
        if (x < 0 || y < 0 || x >= N || y >= N) break;
        path.push(cellPos(x, y));
        var mk = mirrors.filter(function (m) { return m.x === x && m.y === y; })[0];
        if (mk) {
          if (mk.t === 0) { if (dx === 1) { dx = 0; dy = -1; } else if (dx === -1) { dx = 0; dy = 1; } else if (dy === 1) { dx = 1; dy = 0; } else { dx = -1; dy = 0; } }
          else { if (dx === 1) { dx = 0; dy = 1; } else if (dx === -1) { dx = 0; dy = -1; } else if (dy === 1) { dx = -1; dy = 0; } else { dx = 1; dy = 0; } }
          if (visited[x + ',' + y]) break; visited[x + ',' + y] = 1;
        }
        var goal = levels[level].goal;
        if (x === goal[0] && y === goal[1]) { hitGoal = true; break; }
      }
      // 光束
      if (beamLine) { scene.remove(beamLine); beamLine.geometry.dispose(); }
      var pts = [];
      path.forEach(function (p, i) { pts.push(new THREE.Vector3(p.x, .42, p.z)); });
      var g = new THREE.BufferGeometry().setFromPoints(pts);
      var mat = new THREE.LineBasicMaterial({ color: hitGoal ? 0x8FFFC8 : 0x7FE0FF, transparent: true, opacity: .95 });
      beamLine = new THREE.Line(g, mat); scene.add(beamLine);
      // 花瓣收集
      petals.forEach(function (pet) {
        path.forEach(function (p) {
          if (pet.position.distanceTo(new THREE.Vector3(p.x, .42, p.z)) < .5 && pet.visible) {
            pet.visible = false; toast('花瓣 +1');
          }
        });
      });
      if (hitGoal) {
        var all = petals.every(function (p) { return !p.visible; });
        if (level < levels.length - 1) {
          toast('打中了！进入第 ' + (level + 2) + ' 关');
          setTimeout(function () { buildLevel(level + 1); }, 900);
        } else {
          rose.scale.setScalar(1.6);
          rose.material.emissiveIntensity = 2;
          toast('全部通关，蓝玫瑰盛开了 🌹');
        }
      }
    }

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(mirrors.map(function (m) { return m.plate; }), false)[0];
      if (!hit) return;
      var mm = hit.object.userData.mirror;
      mm.t = mm.t === 0 ? 1 : 0;
      mm.obj.rotation.y = mm.t === 0 ? Math.PI / 4 : -Math.PI / 4;
      computeBeam();
    });

    function resize() { var w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>点镜子旋转，光束到玫瑰即过关</span><span class="gx-badge">3D 光路</span>'));
    buildLevel(0);
    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      rose.rotation.y += dt * .7;
      petals.forEach(function (p, i) { if (p.visible) p.position.y = .35 + Math.sin(t * 2 + i) * .04; });
    }});
    return { dispose: function () { stop(); renderer.dispose(); } };
  }

  /* ---------- 7 天台夜行 · 猫的密语 ---------- */
  function game7(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x060B14);
    scene.fog = new THREE.FogExp2(0x0E1C30, 0.020);
    var camera = new THREE.PerspectiveCamera(46, 1, .1, 80);
    orbit(camera, canvas, new THREE.Vector3(0, 1.05, 0), { r: 15, yaw: .18, pitch: 1.26, minPitch: .9, maxPitch: 1.38 });
    scene.add(new THREE.AmbientLight(0x8AA8D2, 2.8));
    scene.add(new THREE.HemisphereLight(0xA8C8F5, 0x1C2A42, 1.8));
    var moon = new THREE.PointLight(0xFFD9A8, 7, 44); moon.position.set(-6, 12, -4); scene.add(moon);
    var neonPink = new THREE.PointLight(0xFF7BA8, 4.5, 16); neonPink.position.set(5, 3, -2.6); scene.add(neonPink);
    var neonBlue = new THREE.PointLight(0x5AA8FF, 4.5, 16); neonBlue.position.set(-5, 2.4, -2.8); scene.add(neonBlue);

    bgGrad(scene, '#1A2C46', '#03060C');
    var starGeo = new THREE.BufferGeometry(); var starPos = [];
    for (var si = 0; si < 400; si++) {
      var th = Math.random() * Math.PI * 2, ph = Math.random() * .55, rr2 = 40;
      starPos.push(Math.cos(th) * Math.cos(ph) * rr2, Math.sin(ph) * rr2 + 2, Math.sin(th) * Math.cos(ph) * rr2);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xCBD8F2, size: .22, transparent: true, opacity: .55, depthWrite: false })));

    var floor = new THREE.Mesh(new THREE.BoxGeometry(34, .2, 34), new THREE.MeshStandardMaterial({ color: 0x39465E, roughness: .85 }));
    floor.position.y = -.1; scene.add(floor);
    // 城市楼群
    for (var i = 0; i < 40; i++) {
      var h = 3 + Math.random() * 14;
      var b = new THREE.Mesh(new THREE.BoxGeometry(1.5 + Math.random() * 2, h, 1.5 + Math.random() * 2), new THREE.MeshStandardMaterial({ color: 0x18263C, roughness: 1 }));
      var a = Math.random() * Math.PI * 2, rr = 24 + Math.random() * 20;
      b.position.set(Math.cos(a) * rr, h / 2 - 1, Math.sin(a) * rr); scene.add(b);
      for (var w = 0; w < 9; w++) {
        var win = new THREE.Mesh(new THREE.PlaneGeometry(.12, .18), new THREE.MeshBasicMaterial({ color: Math.random() < .6 ? 0xFFD79A : 0x8FD3FF, transparent: true, opacity: .65 }));
        win.position.set(b.position.x + (Math.random() - .5) * 1.6, 1 + Math.random() * (h - 2), b.position.z + 1.2);
        scene.add(win);
      }
    }
    // 地面灯带
    var stripMat = new THREE.MeshStandardMaterial({ color: 0x2F6BFF, emissive: 0x2F6BFF, emissiveIntensity: .55 });
    [2.0, -2.0].forEach(function (zz) {
      var st = new THREE.Mesh(new THREE.BoxGeometry(9, .03, .04), stripMat);
      st.position.set(0, .02, zz); scene.add(st);
    });

    // 栏杆
    for (var r = 0; r < 24; r++) {
      var ang = r / 24 * Math.PI * 2;
      var post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .9, 6), new THREE.MeshStandardMaterial({ color: 0x2C3A4E, metalness: .6, roughness: .4 }));
      post.position.set(Math.cos(ang) * 5.6, .45, Math.sin(ang) * 5.6); scene.add(post);
    }
    // 霓虹牌
    var signs = [];
    [[4.9, 3.0, -2.9, 'KUN', 0xFF7BA8], [-4.9, 2.8, -3.1, '13', 0x5AA8FF]].forEach(function (s) {
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: textTex(s[3], { bg: '#101A2A', fg: '#FFFFFF', size: 120 }), transparent: true }));
      sign.position.set(s[0], s[1], s[2]); sign.rotation.y = 0.22; scene.add(sign); signs.push(sign);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(128, 'rgba(255,255,255,.6)', 'rgba(255,120,160,.25)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.copy(sign.position); halo.scale.set(2.4, 1.7, 1); scene.add(halo);
    });

    // 猫
    var cat = new THREE.Group();
    var bodyC = new THREE.Mesh(new THREE.SphereGeometry(.32, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5A6478, roughness: .8 }));
    bodyC.scale.set(1.5, 1, 1); cat.add(bodyC);
    var head = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 12), new THREE.MeshStandardMaterial({ color: 0x6C7690 }));
    head.position.set(.38, .22, 0); cat.add(head);
    var earGeo = new THREE.ConeGeometry(.07, .14, 4);
    [-.1, .15].forEach(function (z) { var ear = new THREE.Mesh(earGeo, new THREE.MeshStandardMaterial({ color: 0x363F52 })); ear.position.set(.4, .38, z); cat.add(ear); });
    var tail = new THREE.Mesh(new THREE.CylinderGeometry(.03, .05, .6, 6), new THREE.MeshStandardMaterial({ color: 0x2A3242 }));
    tail.position.set(-.4, .28, 0); tail.rotation.z = 1.1; cat.add(tail);
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xFFE9A8 });
    [-.07, .07].forEach(function (zz) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), eyeMat);
      eye.position.set(.5, .26, zz); cat.add(eye);
    });
    cat.position.set(1.9, .22, -0.2); cat.rotation.y = -0.7; cat.scale.setScalar(1.0); scene.add(cat);

    // 线索球
    var clues = [];
    for (var c = 0; c < 5; c++) {
      var sp = new THREE.Mesh(new THREE.SphereGeometry(.16, 14, 12), new THREE.MeshStandardMaterial({ color: 0xBFD8FF, emissive: 0x4C86F2, emissiveIntensity: 1.8, transparent: true, opacity: .95 }));
      var a2 = c / 5 * Math.PI * 2 + .3;
      sp.position.set(Math.cos(a2) * (2.2 + c * .6), 1.1 + Math.random() * 1.4, Math.sin(a2) * (2.2 + c * .6));
      sp.userData.digit = ['8', '2', '1', '9', '3'][c];
      sp.userData.idx = c;
      scene.add(sp); clues.push(sp);
      var halo2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(64, 'rgba(190,220,255,.9)', 'rgba(90,150,255,.3)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo2.position.copy(sp.position); halo2.scale.set(.75, .75, 1); scene.add(halo2); sp.userData.halo = halo2;
    }
    var found = 0;
    var hud = el('div', 'gx-score');
    hud.innerHTML = '<b>线索 0 / 5</b><span>点发光的球，猫在旁边看着你</span>';
    host.appendChild(hud);

    function openCode() {
      var body = el('div', 'gx-tune');
      body.innerHTML = '<p class="gx-tip">5 条线索各有一个数字，按“第 1 位 → 第 5 位”拼成 5 位数</p><input class="gx-code" maxlength="5" placeholder="·····"><div class="gx-row"><button class="gx-btn">验证</button><button class="gx-btn ghost">取消</button></div>';
      var p = panel('天台密码锁', body);
      body.querySelector('.gx-btn.ghost').onclick = p.close;
      body.querySelector('.gx-btn:not(.ghost)').onclick = function () {
        var v = body.querySelector('.gx-code').value.trim();
        if (v === '82193') {
          p.close(); toast('密码对了，整座天台都亮了');
          signs.forEach(function (s) { s.material.color.setHex(0x9FE0FF); });
          moon.intensity = 5;
        } else toast('不对，再对着线索的顺序数一遍');
      };
    }

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(clues, false)[0];
      if (!hit) {
        var catHit = raycaster.intersectObject(cat, true)[0];
        if (catHit) toast('猫：先找会发光的那几个球。');
        return;
      }
      var obj = hit.object;
      if (obj.userData.taken) return;
      obj.userData.taken = true; obj.visible = false;
      if (obj.userData.halo) obj.userData.halo.visible = false;
      found++;
      hud.innerHTML = '<b>线索 ' + found + ' / 5</b><span>第 ' + (obj.userData.idx + 1) + ' 位 = ' + obj.userData.digit + '</span>';
      toast('第 ' + (obj.userData.idx + 1) + ' 位线索：' + obj.userData.digit);
      if (found === 5) setTimeout(openCode, 900);
    });

    function resize() { var w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>找齐 5 个发光线索球</span><span class="gx-badge">3D 寻物</span>'));
    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      cat.rotation.y = -0.7 + Math.sin(t * .8) * .15;
      cat.position.y = .2 + Math.abs(Math.sin(t * 1.6)) * .08;
      clues.forEach(function (c, i) { if (c.visible) { c.position.y += Math.sin(t * 2 + i) * .01; c.rotation.y += dt; } });
    }});
    return { dispose: function () { stop(); renderer.dispose(); } };
  }

  /* ---------- 8 行李箱 404 ---------- */
  function game8(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x080F1B);
    var camera = new THREE.PerspectiveCamera(46, 1, .1, 60);
    orbit(camera, canvas, new THREE.Vector3(0, .3, .72), { r: 12.6, yaw: .08, pitch: .97, minPitch: .7, maxPitch: 1.35 });
    scene.add(new THREE.AmbientLight(0x8FAEE0, 2.2));
    scene.add(new THREE.HemisphereLight(0xB8D4FF, 0x141F32, 1.1));
    var key = new THREE.PointLight(0xFFD9A0, 6, 20); key.position.set(2, 5.5, 4); scene.add(key);

    var CASE_W = 6, CASE_H = 4, CELL = .62;
    var caseGroup = new THREE.Group();
    var shell = new THREE.Mesh(new THREE.BoxGeometry(CASE_W * CELL + .2, .16, CASE_H * CELL + .2), new THREE.MeshStandardMaterial({ color: 0x23324C, metalness: .5, roughness: .5 }));
    shell.position.y = .08; caseGroup.add(shell);
    for (var cw = 0; cw < CASE_W; cw++) for (var ch = 0; ch < CASE_H; ch++) {
      var tile = new THREE.Mesh(new THREE.PlaneGeometry(CELL * .94, CELL * .94), new THREE.MeshStandardMaterial({ color: 0x22385A, roughness: .7, emissive: 0x0E2340, emissiveIntensity: .6 }));
      tile.rotation.x = -Math.PI / 2; tile.position.set(-(CASE_W - 1) * CELL / 2 + cw * CELL, .17, -(CASE_H - 1) * CELL / 2 + ch * CELL);
      tile.userData.cell = [cw, ch]; caseGroup.add(tile);
    }
    var rim = new THREE.Mesh(new THREE.BoxGeometry(CASE_W * CELL + .3, .5, .08), new THREE.MeshStandardMaterial({ color: 0x2C3F60, metalness: .4, roughness: .5 }));
    rim.position.set(0, .3, CASE_H * CELL / 2 + .1); caseGroup.add(rim);
    scene.add(caseGroup);

    var items = [
      { w: 3, h: 2, color: 0x4C86F2, name: '应援横幅' },
      { w: 2, h: 2, color: 0xF2C14E, name: '灯牌箱' },
      { w: 2, h: 1, color: 0xFF7BA8, name: '玫瑰盒' },
      { w: 2, h: 1, color: 0x8FD3FF, name: '应援棒×6' },
      { w: 1, h: 2, color: 0xFFB565, name: '相册' },
      { w: 1, h: 1, color: 0xB79BFF, name: '耳返' },
      { w: 1, h: 1, color: 0x9FE0C8, name: '护照' },
      { w: 1, h: 1, color: 0xE0E8F5, name: '充电线' },
      { w: 1, h: 1, color: 0xF08A3C, name: '猫罐头' }
    ];
    var occ = {}, placedCount = 0, total = CASE_W * CASE_H, selected = null;
    var layout = []; // {mesh, w,h,x,y,idx}
    var tray = new THREE.Group(); tray.position.set(0, .3, CASE_H * CELL / 2 + 1.05); scene.add(tray);

    items.forEach(function (it, i) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(it.w * CELL * .92, .16, it.h * CELL * .92), new THREE.MeshStandardMaterial({ color: it.color, metalness: .35, roughness: .45, emissive: it.color, emissiveIntensity: .12 }));
      m.userData.item = it; m.userData.i = i;
      var tw = 4, tx = (i % tw - (tw - 1) / 2) * 1.02, ty = Math.floor(i / tw) * .52;
      m.position.set(tx, ty, 0);
      var lb = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(it.w, 3) * CELL * .86, .26),
        new THREE.MeshBasicMaterial({ map: textTex(it.name, { bg: '#101B2C', fg: '#D8E6FF', size: 32, w: 256, h: 64 }) }));
      lb.rotation.x = -Math.PI / 2; lb.position.set(0, .085, 0); m.add(lb);
      m.userData.tray = new THREE.Vector3(tx, ty, 0);
      tray.add(m);
    });

    var info = el('div', 'gx-score');
    info.innerHTML = '<b>已放置 0 / ' + total + '</b><span>点托盘里的物件，再点箱子格子放下</span>';
    host.appendChild(info);

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function updateInfo(txt) { info.innerHTML = '<b>已放置 ' + placedCount + ' / ' + total + '</b><span>' + (txt || '点物件 → 点格子') + '</span>'; }

    canvas.addEventListener('pointerdown', function (e) {
      if (selected) return;
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(tray.children, false)[0];
      if (hit) {
        selected = hit.object;
        selected.material.emissiveIntensity = .6;
        updateInfo('已选：' + selected.userData.item.name + '，点格子放下');
      }
    });
    canvas.addEventListener('click', function (e) {
      if (!selected) return;
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(caseGroup.children, false)[0];
      if (!hit || !hit.object.userData.cell) return;
      var cx = hit.object.userData.cell[0], cy = hit.object.userData.cell[1];
      var it = selected.userData.item;
      var ok = cx + it.w <= CASE_W && cy + it.h <= CASE_H;
      for (var dx = 0; dx < it.w && ok; dx++) for (var dy = 0; dy < it.h; dy++) if (occ[(cx + dx) + ',' + (cy + dy)]) ok = false;
      if (!ok) { toast('放不下，挪个空位或换小件'); return; }
      for (var dx2 = 0; dx2 < it.w; dx2++) for (var dy2 = 0; dy2 < it.h; dy2++) occ[(cx2 = cx + dx2) + ',' + (cy + dy2)] = 1;
      var pos = new THREE.Vector3(-(CASE_W - 1) * CELL / 2 + cx * CELL + (it.w - 1) * CELL / 2, .25, -(CASE_H - 1) * CELL / 2 + cy * CELL + (it.h - 1) * CELL / 2);
      selected.position.copy(pos); tray.remove(selected); scene.add(selected);
      selected.material.emissiveIntensity = .15;
      placedCount += it.w * it.h;
      selected = null;
      updateInfo();
      if (placedCount >= total) setTimeout(function () { toast('箱子满了，合上就能出发 ✈️'); }, 300);
    });

    function resize() { var w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>6×4 格，塞满 24 格</span><span class="gx-badge">3D 收纳</span>'));
    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      tray.children.forEach(function (m, i) { m.position.y = m.userData.tray.y + Math.sin(t * 1.6 + i) * .03; });
    }});
    return { dispose: function () { stop(); renderer.dispose(); } };
  }

  /* ---------- 10 KUN 星图轨道拼图 ---------- */
  function game10(host) {
    var canvas = el('canvas', 'gx-canvas'); host.appendChild(canvas);
    var renderer = makeGL(canvas);
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x04070F);
    var camera = new THREE.PerspectiveCamera(46, 1, .1, 100);
    camera.position.set(0, 8.4, 9.2); camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0x2A3E62, .8));
    var core = new THREE.PointLight(0xFFD9A0, 2.6, 30); core.position.set(0, 0, 0); scene.add(core);

    // 星野
    var stars = new THREE.BufferGeometry(), arr = [];
    for (var i = 0; i < 900; i++) {
      var r = 8 + Math.random() * 22, th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI;
      arr.push(Math.cos(th) * Math.sin(ph) * r, Math.cos(ph) * r * .5, Math.sin(th) * Math.sin(ph) * r);
    }
    stars.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xBED4FF, size: .08, transparent: true, opacity: .8 })));

    var sun = new THREE.Mesh(new THREE.SphereGeometry(.5, 24, 18), new THREE.MeshStandardMaterial({ color: 0xFFE0A0, emissive: 0xFFB44F, emissiveIntensity: 1.6 }));
    scene.add(sun);
    var sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(256, 'rgba(255,240,200,.95)', 'rgba(255,180,90,.3)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sunGlow.scale.set(3.4, 3.4, 1); scene.add(sunGlow);

    var R = [2.6, 3.4, 4.2, 5.0, 5.8];
    var targetAng = [0.4, 1.7, 2.8, 4.0, 5.1];
    var planets = [];
    var pColors = [0x8FD3FF, 0xB79BFF, 0xFFB565, 0x7FE0C8, 0xFF8FB8];
    R.forEach(function (r, i) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(r, .015, 6, 90), new THREE.MeshBasicMaterial({ color: 0x2A4A7A, transparent: true, opacity: .55 }));
      ring.rotation.x = Math.PI / 2; scene.add(ring);
      // 目标暗星
      var ghost = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5A7FB0, transparent: true, opacity: .8 }));
      ghost.position.set(Math.cos(targetAng[i]) * r, 0, Math.sin(targetAng[i]) * r); scene.add(ghost);
      var gh = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(64, 'rgba(160,200,255,.7)', 'rgba(80,130,220,.15)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      gh.position.copy(ghost.position); gh.scale.set(1.1, 1.1, 1); scene.add(gh);

      var planet = new THREE.Mesh(new THREE.SphereGeometry(.24 - i * .02, 18, 14), new THREE.MeshStandardMaterial({ color: pColors[i], metalness: .4, roughness: .35, emissive: pColors[i], emissiveIntensity: .35 }));
      var a = Math.random() * Math.PI * 2;
      planet.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      planet.userData = { r: r, idx: i, ang: a, done: false, ghost: ghost };
      scene.add(planet); planets.push(planet);
    });

    var lines = new THREE.Group(); scene.add(lines);
    function drawConstellation() {
      while (lines.children.length) { var o = lines.children.pop(); lines.remove(o); if (o.geometry) o.geometry.dispose(); }
      var pts = planets.map(function (p) { return p.position.clone(); });
      for (var i = 1; i < pts.length; i++) {
        var g = new THREE.BufferGeometry().setFromPoints([pts[i - 1], pts[i]]);
        lines.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xF2C14E, transparent: true, opacity: .9 })));
      }
    }
    var doneCount = 0;
    var hud = el('div', 'gx-score');
    hud.innerHTML = '<b>对齐 0 / 5</b><span>拖动星球靠近暗星，会自动吸附</span>';
    host.appendChild(hud);

    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), dragging = null;
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    canvas.addEventListener('pointerdown', function (e) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(planets, false)[0];
      if (hit) { dragging = hit.object; dispatchEvent(new Event('gx-drag')); }
    });
    function movePlanet(e) {
      if (!dragging) return;
      var r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var p = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, p)) {
        var ang = Math.atan2(p.z, p.x);
        var pl = dragging, rad = pl.userData.r;
        var ta = targetAng[pl.userData.idx];
        var diff = Math.atan2(Math.sin(ang - ta), Math.cos(ang - ta));
        if (Math.abs(diff) < .18) { ang = ta; if (!pl.userData.done) { pl.userData.done = true; doneCount++; hud.innerHTML = '<b>对齐 ' + doneCount + ' / 5</b><span>' + (doneCount === 5 ? 'KUN 星座亮了' : '继续拖下一颗') + '</span>'; if (doneCount === 5) { drawConstellation(); toast('KUN 星座连成了 ✨'); } } }
        else { if (pl.userData.done) { pl.userData.done = false; doneCount--; hud.innerHTML = '<b>对齐 ' + doneCount + ' / 5</b><span>又松开了，再对齐一次</span>'; drawConstellation(); } }
        pl.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
        pl.rotation.y = -ang;
      }
    }
    canvas.addEventListener('pointermove', movePlanet);
    canvas.addEventListener('pointerup', function () { dragging = null; });
    canvas.addEventListener('pointercancel', function () { dragging = null; });

    function resize() { var w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    resize(); window.addEventListener('resize', resize);
    host.appendChild(el('div', 'gx-hud', '<span>拖星球对齐 5 颗暗星</span><span class="gx-badge">3D 星图</span>'));
    var stop = loop({ renderer: renderer, scene: scene, camera: camera, update: function (dt, t) {
      sun.rotation.y += dt * .2; sunGlow.material.opacity = .85 + Math.sin(t * 1.6) * .1;
      planets.forEach(function (p, i) { if (!dragging || dragging !== p) p.rotation.y += dt * .05; });
    }});
    return { dispose: function () { stop(); renderer.dispose(); } };
  }

  var factories = { g1: game1, g4: game4, g5: game5, g6: game6, g7: game7, g8: game8, g10: game10 };

  /* ---------- 游戏厅 UI ---------- */
  function buildHub() {
    var grid = el('div', 'gx-grid');
    GAMES.forEach(function (g) {
      var card = el('article', 'gx-card');
      card.innerHTML =
        '<div class="gx-cover" style="--c:' + g.color + '"><span class="gx-ico">' + (g.id === 'g1' ? '🗝' : g.id === 'g4' ? '🎚' : g.id === 'g5' ? '💡' : g.id === 'g6' ? '🪞' : g.id === 'g7' ? '🐈' : g.id === 'g8' ? '🧳' : '🪐') + '</span></div>' +
        '<div class="gx-body"><h3>' + g.name + '</h3><p>' + g.desc + '</p>' +
        '<div class="gx-meta"><span class="gx-tag">' + g.tag + '</span><span class="gx-diff">' + g.diff + '</span></div>' +
        '<button class="gx-play">进去看看 →</button></div>';
      card.querySelector('.gx-play').addEventListener('click', function () { openGame(g); });
      grid.appendChild(card);
    });
    app.innerHTML = '';
    var head = el('div', 'gx-head');
    head.innerHTML = '<p class="gx-kicker">KUN 星站 · 游戏厅</p><h2>7 个能一直玩的 3D 小游戏</h2><p class="gx-sub">全部是立体场景，鼠标拖拽看四周，手机手指滑动；解谜、记忆、光路、收纳、星图，慢慢更新。</p>';
    app.appendChild(head); app.appendChild(grid);
  }

  function openGame(info) {
    closeStage();
    stage = el('div', 'gx-stage');
    stage.innerHTML = '<div class="gx-stage-top"><button class="gx-back">← 返回游戏厅</button><div class="gx-title">' + info.name + '<em>' + info.tag + '</em></div></div><div class="gx-view"></div>';
    app.appendChild(stage);
    document.body.classList.add('gx-lock');
    stage.querySelector('.gx-back').onclick = closeStage;
    var view = stage.querySelector('.gx-view');
    toast('提示：' + (info.hint || '慢慢看，会有线索。'), 3000);
    try { cur = factories[info.id](view); }
    catch (err) { console.warn('game init fail', err); toast('这个游戏加载失败了，换一个试试'); }
    setTimeout(function () { var c = view.querySelector('.gx-canvas'); if (c) { c.style.width = '100%'; c.style.height = '100%'; } }, 0);
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
