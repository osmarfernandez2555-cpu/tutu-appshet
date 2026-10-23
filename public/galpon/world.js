/* Mundo 3D del galpón con Three.js (r128). Cámara orbital, oficinas con gente sentada
   trabajando, y personal operativo animado (limpieza, mecánica, lavado). */
(function (root) {
  const T = root.THREE;
  let scene, camera, renderer, raycaster, canvas;
  let picks = [];
  const areaObjs = {};
  const staff = [];          // personal animado (limpieza, mecánica, lavado)
  const staffMeta = [];      // etiquetas de ese personal
  let onSelect = () => {};
  let hovered = null, selected = null;
  const clock = { t: 0 };

  const cam = { target: new T.Vector3(6, 1.5, 0), r: 42, theta: -Math.PI / 4, phi: 1.02, minR: 16, maxR: 80 };
  function applyCam() {
    cam.phi = Math.max(0.35, Math.min(1.45, cam.phi));
    cam.r = Math.max(cam.minR, Math.min(cam.maxR, cam.r));
    camera.position.set(
      cam.target.x + cam.r * Math.sin(cam.phi) * Math.cos(cam.theta),
      cam.target.y + cam.r * Math.cos(cam.phi),
      cam.target.z + cam.r * Math.sin(cam.phi) * Math.sin(cam.theta)
    );
    camera.lookAt(cam.target);
  }
  function mat(color, o = {}) { return new T.MeshStandardMaterial({ color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0.05, transparent: o.transparent || false, opacity: o.opacity ?? 1, emissive: o.emissive || 0x000000, emissiveIntensity: o.ei || 0 }); }

  // Personita estilizada con brazos (para animar tipeo / tareas)
  function persona(genero, color) {
    const g = new T.Group();
    const skin = 0xe8b894;
    const ropa = color || (genero === 'F' ? 0xd94f8a : 0x3b6ea5);
    if (genero === 'F') { const sk = new T.Mesh(new T.ConeGeometry(0.42, 0.7, 12), mat(ropa)); sk.position.y = 0.55; sk.castShadow = true; g.add(sk); }
    else { const l1 = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 0.6, 8), mat(0x2b3a52)); const l2 = l1.clone(); l1.position.set(-0.13, 0.4, 0); l2.position.set(0.13, 0.4, 0); l1.castShadow = l2.castShadow = true; g.add(l1, l2); }
    const torsoY = genero === 'F' ? 1.08 : 1.05;
    const torso = new T.Mesh(new T.CylinderGeometry(0.26, 0.32, 0.72, 12), mat(ropa)); torso.position.y = torsoY; torso.castShadow = true; g.add(torso);
    const head = new T.Mesh(new T.SphereGeometry(0.24, 16, 16), mat(skin)); head.position.y = torsoY + 0.52; head.castShadow = true; g.add(head);
    const peloCol = genero === 'F' ? 0x4a2c1a : 0x2a2018;
    if (genero === 'F') {
      const pelo = new T.Mesh(new T.SphereGeometry(0.27, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.72), mat(peloCol)); pelo.position.y = head.position.y + 0.03; g.add(pelo);
      const cola = new T.Mesh(new T.SphereGeometry(0.16, 10, 10), mat(peloCol)); cola.position.set(0, head.position.y - 0.05, -0.22); cola.scale.set(1, 1.5, 1); g.add(cola);
    } else { const pelo = new T.Mesh(new T.SphereGeometry(0.255, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(peloCol)); pelo.position.y = head.position.y + 0.07; g.add(pelo); }
    // brazos (pivote en el hombro)
    const arms = [];
    for (const sx of [-1, 1]) {
      const pivot = new T.Group(); pivot.position.set(sx * 0.3, torsoY + 0.22, 0);
      const arm = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.5, 6), mat(ropa)); arm.position.set(0, -0.2, 0.08); arm.rotation.x = -0.5; pivot.add(arm); g.add(pivot); arms.push(pivot);
    }
    g.scale.setScalar(0.9); g.userData.arms = arms; g.userData.head = head;
    return g;
  }

  function makeCar(color) {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(3.6, 0.7, 1.6), mat(color, { metal: 0.5, rough: 0.4 })); body.position.y = 0.75; body.castShadow = true; g.add(body);
    const cabin = new T.Mesh(new T.BoxGeometry(1.9, 0.6, 1.45), mat(color, { metal: 0.5, rough: 0.4 })); cabin.position.set(-0.15, 1.25, 0); cabin.castShadow = true; g.add(cabin);
    const glass = new T.Mesh(new T.BoxGeometry(1.8, 0.5, 1.35), mat(0x0e141d, { metal: 0.3, rough: 0.1 })); glass.position.set(-0.15, 1.27, 0); g.add(glass);
    for (const sx of [-1.15, 1.15]) for (const sz of [-0.8, 0.8]) { const wh = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.26, 16), mat(0x14171c)); wh.rotation.x = Math.PI / 2; wh.position.set(sx, 0.36, sz); g.add(wh); }
    return g;
  }

  function galpon(W, D) {
    const grp = new T.Group();
    const floor = new T.Mesh(new T.BoxGeometry(W, 0.4, D), mat(0x8a8f98, { rough: 0.95 })); floor.position.y = -0.2; floor.receiveShadow = true; grp.add(floor);
    const grid = new T.GridHelper(Math.max(W, D), Math.max(W, D) / 2, 0x5a5f68, 0x6a6f78); grid.position.y = 0.02; grid.material.opacity = 0.35; grid.material.transparent = true; grp.add(grid);
    const wallMat = mat(0xb8bcc4, { rough: 0.9 }); const wh = 1.1, tw = 0.3;
    const mk = (w, h, d, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), wallMat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
    grp.add(mk(W, wh, tw, 0, wh / 2, -D / 2), mk(W, wh, tw, 0, wh / 2, D / 2), mk(tw, wh, D, -W / 2, wh / 2, 0), mk(tw, wh, D, W / 2, wh / 2, 0));
    const steel = mat(0x4b5563, { metal: 0.4, rough: 0.5 });
    for (let sx = -1; sx <= 1; sx += 2) for (let z = -D / 2 + 3; z <= D / 2 - 3; z += 7) { const col = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 7, 8), steel); col.position.set(sx * (W / 2 - 0.5), 3.5, z); col.castShadow = true; grp.add(col); }
    for (let z = -D / 2 + 3; z <= D / 2 - 3; z += 7) { const bl = new T.Mesh(new T.BoxGeometry(W * 0.56, 0.18, 0.18), steel); bl.position.set(-W * 0.26, 7.6, z); bl.rotation.z = 0.28; grp.add(bl); const br = bl.clone(); br.position.x = W * 0.26; br.rotation.z = -0.28; grp.add(br); }
    const roofMat = mat(0x9fb4d6, { transparent: true, opacity: 0.12, metal: 0.3, rough: 0.3 });
    const rl = new T.Mesh(new T.BoxGeometry(W * 0.58, 0.1, D), roofMat); rl.position.set(-W * 0.27, 7.7, 0); rl.rotation.z = 0.28; grp.add(rl); const rr = rl.clone(); rr.position.x = W * 0.27; rr.rotation.z = -0.28; grp.add(rr);
    return grp;
  }

  function oficina(a) {
    const grp = new T.Group(); grp.position.set(a.pos.x, 0, a.pos.z);
    const { w, d } = a.size;
    const base = new T.Mesh(new T.BoxGeometry(w, 0.12, d), mat(a.color, { rough: 0.7, emissive: a.color, ei: 0.06 })); base.position.y = 0.08; base.receiveShadow = true; grp.add(base);
    const rug = new T.Mesh(new T.BoxGeometry(w - 0.6, 0.14, d - 0.6), mat(a.color, { rough: 0.6, emissive: a.color, ei: 0.14 })); rug.position.y = 0.1; grp.add(rug);
    const glass = mat(a.color, { transparent: true, opacity: 0.16, metal: 0.2, rough: 0.1, emissive: a.color, ei: 0.1 }); const gh = 1.5, tw = 0.08;
    const wall = (ww, dd, x, z) => { const m = new T.Mesh(new T.BoxGeometry(ww, gh, dd), glass); m.position.set(x, gh / 2 + 0.1, z); grp.add(m); const top = new T.Mesh(new T.BoxGeometry(ww || tw, 0.06, dd || tw), mat(a.color, { emissive: a.color, ei: 0.25 })); top.position.set(x, gh + 0.12, z); grp.add(top); };
    wall(w, tw, 0, -d / 2); wall(tw, d, -w / 2, 0); wall(tw, d, w / 2, 0);
    // escritorio largo contra el fondo + sillas + gente sentada trabajando
    const n = a.people.length;
    const deskW = Math.min(w - 1.0, Math.max(2.2, n * 1.2));
    const deskZ = -d * 0.12;
    const desk = new T.Mesh(new T.BoxGeometry(deskW, 0.1, 0.72), mat(0x6b4e37, { rough: 0.6 })); desk.position.set(0, 0.82, deskZ); desk.castShadow = true; grp.add(desk);
    for (const sx of [-1, 1]) { const leg = new T.Mesh(new T.BoxGeometry(0.08, 0.72, 0.08), mat(0x4a3526)); leg.position.set(sx * deskW * 0.45, 0.4, deskZ); grp.add(leg); }
    const people = [];
    a.people.forEach((p, i) => {
      const px = n === 1 ? 0 : -deskW / 2 + 0.6 + ((deskW - 1.2) / (n - 1)) * i;
      const mon = new T.Mesh(new T.BoxGeometry(0.42, 0.3, 0.05), mat(0x0b1018, { emissive: a.color, ei: 0.5 })); mon.position.set(px, 1.08, deskZ - 0.2); grp.add(mon);
      const seat = new T.Mesh(new T.BoxGeometry(0.4, 0.08, 0.4), mat(0x222a38)); seat.position.set(px, 0.46, deskZ + 0.55); grp.add(seat);
      const back = new T.Mesh(new T.BoxGeometry(0.4, 0.5, 0.08), mat(0x222a38)); back.position.set(px, 0.72, deskZ + 0.74); grp.add(back);
      const per = persona(p.genero, p.color); per.position.set(px, -0.28, deskZ + 0.5); per.rotation.y = Math.PI; // mira al monitor
      per.userData.base = -0.28; per.userData.work = true; grp.add(per); people.push(per);
      if (p.name) staffMeta.push({ id: 'p-' + a.id + '-' + i, mesh: per, name: p.name, color: a.color });
    });
    // Encargado caminando por la oficina (ej: Jorge en Ventas)
    if (a.walker) {
      const wk = persona(a.walker.genero, a.walker.color || a.color); wk.position.set(0, 0, d * 0.28); grp.add(wk);
      const mx = w / 2 - 1.2, fz = d * 0.32, bz = d * 0.06;
      staff.push({ mesh: wk, type: 'walk', wps: [[-mx, fz], [mx, fz], [mx, bz], [-mx, bz]], wi: 0 });
      staffMeta.push({ id: 'walker-' + a.id, mesh: wk, name: a.walker.name, color: a.walker.color || a.color });
    }
    const pick = new T.Mesh(new T.BoxGeometry(w, 3, d), new T.MeshBasicMaterial({ visible: false })); pick.position.y = 1.5; pick.userData.area = a.id; grp.add(pick); picks.push(pick);
    scene.add(grp);
    areaObjs[a.id] = { group: grp, base, rug, center: new T.Vector3(a.pos.x, 1.5, a.pos.z), people, color: a.color };
  }

  function buildStaff() {
    // Zona taller en el frente del galpón principal
    const car1 = makeCar(0x3b82f6); car1.position.set(-5, 0, 11.6); car1.rotation.y = 0.35; scene.add(car1);
    const maxi = persona('M', 0x9aa3af); maxi.position.set(-7.2, 0, 11.6); maxi.rotation.y = Math.PI / 2; scene.add(maxi);
    staff.push({ mesh: maxi, type: 'mec' }); staffMeta.push({ id: 'maxi', mesh: maxi, name: 'Maxi · Mecánica', color: 0x94a3b8 });

    const car2 = makeCar(0xef4444); car2.position.set(7, 0, 12); car2.rotation.y = -0.25; scene.add(car2);
    const mercau = persona('M', 0x38bdf8); mercau.position.set(9.3, 0, 12); mercau.rotation.y = -Math.PI / 2; scene.add(mercau);
    // balde
    const balde = new T.Mesh(new T.CylinderGeometry(0.22, 0.18, 0.3, 10), mat(0x2563eb)); balde.position.set(9.9, 0.15, 12.6); scene.add(balde);
    staff.push({ mesh: mercau, type: 'wash' }); staffMeta.push({ id: 'mercau', mesh: mercau, name: 'Mercau · Lavado', color: 0x38bdf8 });

    // Limpieza: Mariana barriendo todo el salón (recorre el pasillo central)
    const mari = persona('F', 0x22c55e); mari.position.set(-14, 0, 1); scene.add(mari);
    const broom = new T.Group(); broom.position.set(0.32, 0.5, 0.25);
    const palo = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.5, 6), mat(0x8b5a2b)); palo.rotation.z = 0.6; palo.position.y = 0.1; broom.add(palo);
    const cerdas = new T.Mesh(new T.BoxGeometry(0.12, 0.1, 0.5), mat(0xe2c290)); cerdas.position.set(0.62, -0.6, 0); broom.add(cerdas); mari.add(broom);
    const wps = [[-14, 1], [14, 1], [14, -3], [-14, -3]];
    staff.push({ mesh: mari, type: 'clean', broom, wps, wi: 0 });
    staffMeta.push({ id: 'mariana-lmp', mesh: mari, name: 'Mariana · Limpieza', color: 0x22c55e });
  }

  function init(cv, areas, selectCb) {
    canvas = cv; onSelect = selectCb || onSelect;
    scene = new T.Scene(); scene.background = new T.Color(0x070b14); scene.fog = new T.Fog(0x070b14, 55, 110);
    camera = new T.PerspectiveCamera(50, 1, 0.1, 500);
    renderer = new T.WebGLRenderer({ canvas, antialias: true }); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene.add(new T.HemisphereLight(0xcfe0ff, 0x202838, 0.65));
    const sun = new T.DirectionalLight(0xfff2e0, 1.15); sun.position.set(24, 32, 16); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 110; sun.shadow.camera.left = -55; sun.shadow.camera.right = 55; sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55; scene.add(sun);
    const fill = new T.PointLight(0xdb2777, 0.5, 70); fill.position.set(-15, 10, -15); scene.add(fill);
    raycaster = new T.Raycaster();
    scene.add(galpon(40, 28));
    const g2 = galpon(18, 18); g2.position.set(29, 0, 4); scene.add(g2);
    const cartel = new T.Mesh(new T.BoxGeometry(6, 1, 0.2), mat(0x14b8a6, { emissive: 0x14b8a6, ei: 0.4 })); cartel.position.set(29, 3.2, 4 - 9); scene.add(cartel);
    areas.forEach(oficina);
    buildStaff();
    resize(); applyCam(); bind(); animate();
    requestAnimationFrame(resize); setTimeout(resize, 300);
  }

  function resize() {
    if (!canvas || !renderer) return;
    const chatEl = document.getElementById('chat'); const chatH = chatEl ? chatEl.offsetHeight : 150;
    const w = Math.max(1, window.innerWidth); const h = Math.max(1, window.innerHeight - chatH);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h, true);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', () => resize());
  window.addEventListener('load', () => resize());

  let drag = null, moved = 0, pinch = 0;
  function pointer(e) { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1, cx: e.clientX, cy: e.clientY }; }
  function bind() {
    canvas.addEventListener('pointerdown', (e) => { drag = pointer(e); moved = 0; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { const p = pointer(e); if (drag) { const dx = e.clientX - drag.cx, dy = e.clientY - drag.cy; moved += Math.abs(dx) + Math.abs(dy); cam.theta += dx * 0.008; cam.phi -= dy * 0.006; drag = { ...drag, cx: e.clientX, cy: e.clientY }; applyCam(); } else hover(p); });
    canvas.addEventListener('pointerup', (e) => { if (drag && moved < 6) click(pointer(e)); drag = null; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.r += e.deltaY * 0.02; applyCam(); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) { cam.r += (pinch - d) * 0.05; applyCam(); } pinch = d; } }, { passive: true });
    canvas.addEventListener('touchend', () => { pinch = 0; });
  }
  function hover(p) { raycaster.setFromCamera(p, camera); const hit = raycaster.intersectObjects(picks, false)[0]; const id = hit ? hit.object.userData.area : null; if (id !== hovered) { hovered = id; canvas.style.cursor = id ? 'pointer' : 'grab'; } }
  function click(p) { raycaster.setFromCamera(p, camera); const hit = raycaster.intersectObjects(picks, false)[0]; if (hit) { const id = hit.object.userData.area; selectArea(id); onSelect(id); } }
  function selectArea(id) {
    selected = id;
    for (const k in areaObjs) { const o = areaObjs[k]; const on = k === id; o.base.material.emissiveIntensity = on ? 0.3 : 0.06; o.rug.material.emissiveIntensity = on ? 0.4 : 0.14; }
    if (id && areaObjs[id]) { const c = areaObjs[id].center; cam.target.lerp(new T.Vector3(c.x, 1.2, c.z), 0.6); applyCam(); }
  }

  let labelCb = null;
  function onLabels(cb) { labelCb = cb; }
  const _v = new T.Vector3();
  function proj(v3, yAdd) { _v.copy(v3); _v.y += yAdd || 0; _v.project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (_v.x * 0.5 + 0.5) * r.width, y: r.top + (-_v.y * 0.5 + 0.5) * r.height, vis: _v.z < 1 }; }

  function animate() {
    requestAnimationFrame(animate); const t = clock.t += 0.016;
    // gente de oficina: tipeo + leve balanceo
    for (const k in areaObjs) { areaObjs[k].people.forEach((per, i) => { per.position.y = per.userData.base + Math.sin(t * 3 + i) * 0.012 + (k === selected ? Math.abs(Math.sin(t * 3)) * 0.05 : 0); const ar = per.userData.arms; if (ar) { ar[0].rotation.x = -0.5 + Math.sin(t * 7 + i) * 0.25; ar[1].rotation.x = -0.5 + Math.sin(t * 7 + i + 1.4) * 0.25; } }); }
    // personal operativo
    for (const s of staff) {
      const ar = s.mesh.userData.arms;
      if (s.type === 'mec' && ar) { ar[0].rotation.x = -1.1 + Math.sin(t * 5) * 0.4; ar[1].rotation.x = -1.1 + Math.sin(t * 5 + 0.6) * 0.4; s.mesh.position.y = Math.sin(t * 2) * 0.02; }
      else if (s.type === 'wash' && ar) { ar[0].rotation.x = -1.2 + Math.sin(t * 8) * 0.5; ar[1].rotation.x = -1.2 + Math.cos(t * 8) * 0.5; }
      else if (s.type === 'walk') {
        const tgt = s.wps[s.wi]; const dx = tgt[0] - s.mesh.position.x, dz = tgt[1] - s.mesh.position.z; const dist = Math.hypot(dx, dz);
        if (dist < 0.3) { s.wi = (s.wi + 1) % s.wps.length; } else { const sp = 0.035; s.mesh.position.x += (dx / dist) * sp; s.mesh.position.z += (dz / dist) * sp; s.mesh.rotation.y = Math.atan2(dx, dz); }
        s.mesh.position.y = Math.abs(Math.sin(t * 6)) * 0.05;
        if (ar) { ar[0].rotation.x = Math.sin(t * 6) * 0.5; ar[1].rotation.x = -Math.sin(t * 6) * 0.5; }
      }
      else if (s.type === 'clean') {
        const tgt = s.wps[s.wi]; const dx = tgt[0] - s.mesh.position.x, dz = tgt[1] - s.mesh.position.z; const dist = Math.hypot(dx, dz);
        if (dist < 0.3) { s.wi = (s.wi + 1) % s.wps.length; } else { const sp = 0.04; s.mesh.position.x += (dx / dist) * sp; s.mesh.position.z += (dz / dist) * sp; s.mesh.rotation.y = Math.atan2(dx, dz); }
        if (s.broom) s.broom.rotation.y = Math.sin(t * 6) * 0.5;
        if (ar) { ar[0].rotation.x = -0.8; ar[1].rotation.x = -0.6; }
      }
    }
    renderer.render(scene, camera);
    if (labelCb) {
      const out = {};
      for (const k in areaObjs) out[k] = proj(areaObjs[k].center, 1.5);
      for (const s of staffMeta) { const wp = new T.Vector3(); s.mesh.getWorldPosition(wp); out[s.id] = proj(wp, 2.2); }
      labelCb(out);
    }
  }

  root.WORLD = { init, selectArea, onLabels, resize, staffMeta: () => staffMeta.map((s) => ({ id: s.id, name: s.name, color: s.color })) };
})(typeof window !== 'undefined' ? window : globalThis);
