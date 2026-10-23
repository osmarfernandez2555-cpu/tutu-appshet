/* Glue: mundo 3D + panel de agente + chat con ruteo. */
(() => {
  const { AGENTS, AREAS, AREA_NAME, route, generic, hex } = window.APP_AGENTS;
  const $ = (s) => document.querySelector(s);
  const D = window.DATA;
  let current = null;

  // ---- Etiquetas flotantes sobre cada oficina ----
  const labelBox = $('#labels');
  const labels = {};
  AREAS.forEach((a) => {
    const el = document.createElement('div'); el.className = 'label3d';
    const ag = AGENTS[a.id];
    el.innerHTML = `<span class="dot" style="background:${hex(a.color)}"></span>${AREA_NAME[a.id]} · ${ag.name}`;
    el.onclick = () => openAgent(a.id);
    el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer';
    labelBox.appendChild(el); labels[a.id] = el;
  });
  function addStaffLabels() {
    (window.WORLD.staffMeta ? window.WORLD.staffMeta() : []).forEach((s) => {
      if (labels[s.id]) return;
      const el = document.createElement('div'); el.className = 'label3d staff';
      el.innerHTML = `<span class="dot" style="background:${hex(s.color)}"></span>${s.name}`;
      labelBox.appendChild(el); labels[s.id] = el;
    });
  }
  window.WORLD.onLabels((pos) => {
    for (const id in labels) { const p = pos[id]; const el = labels[id]; if (!p || !p.vis) { el.style.opacity = 0; } else { el.style.opacity = 1; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; } }
  });

  // ---- Panel de agente ----
  const agEl = $('#agent'), body = $('#agBody'), actions = $('#agActions');
  function openAgent(id, opening) {
    const a = AGENTS[id]; if (!a) return; current = id;
    window.WORLD.selectArea(id);
    agEl.classList.add('show');
    agEl.style.setProperty('--accent', a.color); agEl.style.setProperty('--accent-soft', a.soft);
    $('#agAv').style.background = a.color; $('#agAv').textContent = a.name[0];
    $('#agName').textContent = a.name; $('#agRole').textContent = a.role;
    actions.innerHTML = a.actions.map((ac, i) => `<button class="chip-btn" data-i="${i}">${ac[0]}</button>`).join('');
    actions.querySelectorAll('.chip-btn').forEach((b) => b.onclick = () => runAction(id, +b.dataset.i));
    if (opening !== false) { body.innerHTML = `<div class="msg">${a.hello}</div>`; }
  }
  function runAction(id, i, prefixMe) {
    const a = AGENTS[id]; let html;
    try { html = a.actions[i][1](); } catch (e) { html = `<div class="msg">No pude armar ese informe: ${e.message}</div>`; }
    if (prefixMe) body.insertAdjacentHTML('beforeend', `<div class="msg me">${prefixMe}</div>`);
    body.insertAdjacentHTML('beforeend', html);
    body.scrollTop = body.scrollHeight;
    if (window.lucide) {}
  }
  $('#agClose').onclick = () => { agEl.classList.remove('show'); window.WORLD.selectArea(null); current = null; };

  // Clic en el mundo 3D
  // (WORLD llama onSelect con el id del área)

  // ---- Chat ----
  const log = $('#chatLog'), input = $('#chatInput');
  function clBubble(txt, cls) { const d = document.createElement('div'); d.className = 'cl ' + cls; d.innerHTML = txt; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function ask(text) {
    text = text.trim(); if (!text) return;
    clBubble(escapeHtml(text), 'user'); input.value = '';
    const id = route(text) || 'direccion';
    const a = AGENTS[id];
    clBubble(`Te responde <b>${a.name}</b> <span style="color:${a.color}">●</span> ${AREA_NAME[id]} 👉 mirá el panel`, 'sys');
    openAgent(id, false);
    // responder: intención genérica o el informe que mejor matchee, si no la primera acción
    const g = generic(a, text);
    body.insertAdjacentHTML('beforeend', `<div class="msg me">${escapeHtml(text)}</div>`);
    if (g) { body.insertAdjacentHTML('beforeend', g); }
    else {
      const t = text.toLowerCase();
      const act = a.actions.find((ac) => t.includes(ac[0].toLowerCase().split(' ')[0]));
      body.insertAdjacentHTML('beforeend', act ? act[1]() : a.actions[0][1]());
    }
    body.scrollTop = body.scrollHeight;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  $('#chatSend').onclick = () => ask(input.value);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(input.value); });

  // Sugerencias rápidas
  const SUG = [
    ['¿Cómo van las ventas del mes?', 'ventas del mes'],
    ['Ranking de vendedores', 'ranking vendedores'],
    ['Créditos pendientes', 'creditos pendientes'],
    ['Autos sin fotos', 'fotos sin publicar'],
    ['Resumen general', 'resumen general de la agencia'],
    ['Entregas pendientes', 'entregas pendientes gestoria'],
    ['Ingresos y egresos', 'ingresos egresos caja'],
    ['Peritajes por realizar', 'peritajes por realizar'],
    ['¿Quiénes trabajan acá?', 'dotacion del equipo rrhh'],
  ];
  const sug = $('#suggest');
  SUG.forEach(([label, q]) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => ask(q); sug.appendChild(b); });

  // ---- Arranque del mundo ----
  window.WORLD.init($('#scene'), AREAS, (id) => openAgent(id));
  addStaffLabels();
  window.WORLD.resize();
  setTimeout(() => { $('#loading').classList.add('gone'); }, 600);
  // mensaje de bienvenida en el chat
  clBubble('¡Hola! Soy el recepcionista del galpón. Preguntame lo que quieras y te derivo al encargado: <b>Jorge</b> (ventas), <b>Fabricio</b> (créditos), <b>Ruth</b> (fotos), <b>Mariana</b> (gestoría), <b>Franco</b> (contable/taller), <b>Cone</b> (peritaje), <b>Piki</b> (RRHH) o <b>Adrián</b> (dirección).', 'sys');
})();
