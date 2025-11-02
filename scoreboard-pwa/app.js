(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const VIEWS = {
    config: $('#view-config'),
    ronda: $('#view-ronda'),
    final: $('#view-final'),
    historial: $('#view-historial'),
  };

  const els = {
    formConfig: $('#formConfig'),
    numJug: $('#numJugadores'),
    numRondas: $('#numRondas'),
    nombresContainer: $('#nombresContainer'),
    tituloRonda: $('#tituloRonda'),
    listaJugadores: $('#listaJugadores'),
    btnCerrarRonda: $('#btnCerrarRonda'),
    btnCancelarRonda: $('#btnCancelarRonda'),
    tablaPuntosRonda: $('#tablaPuntosRonda'),
    tablaAcumulado: $('#tablaAcumulado'),
    tablaFinal: $('#tablaFinal'),
    btnNueva: $('#btnNueva'),
    btnNuevaDesdeFinal: $('#btnNuevaDesdeFinal'),
    btnHistorial: $('#btnHistorial'),
    listaHistorial: $('#listaHistorial'),
    btnBorrarHistorial: $('#btnBorrarHistorial'),
    btnCopiarTexto: $('#btnCopiarTexto'),
    btnInstalar: $('#btnInstalar'),
  };

  const STORAGE_KEYS = {
    current: 'scoreboard_current',
    history: 'scoreboard_history'
  };

  let state = {
    jugadores: [], // [{id,name,total}]
    rondas: 6,
    rondaActual: 1,
    ordenRonda: [], // array de ids
    terminado: false,
  };

  let deferredPrompt = null;

  function show(view){
    Object.values(VIEWS).forEach(v=>v.classList.add('hidden'));
    view.classList.remove('hidden');
  }

  function defaultNames(n){
    return Array.from({length:n}, (_,i)=>`Jugador ${i+1}`);
  }

  function renderNombreInputs(){
    const n = clamp(parseInt(els.numJug.value||'0',10),2,12);
    els.nombresContainer.innerHTML = '';
    const names = defaultNames(n);
    for(let i=0;i<n;i++){
      const w = document.createElement('div');
      w.className='field';
      const id = `nombre_${i}`;
      w.innerHTML = `
        <label for="${id}">Nombre ${i+1}</label>
        <input id="${id}" type="text" placeholder="${names[i]}" />
      `;
      els.nombresContainer.appendChild(w);
    }
  }

  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

  function computePointsByPosition(n){
    // Regla: 1º = N, 2º = N-2, 3º = N-3, ..., último = 0
    const arr = new Array(n).fill(0);
    if(n >= 1) arr[0] = n;                 // primero
    if(n >= 2) arr[1] = Math.max(0, n-2);  // segundo
    for(let k=3; k<=n; k++){
      arr[k-1] = Math.max(0, n - k);
    }
    return arr;
  }

  function startGame({numJugadores, numRondas, nombres}){
    const pts = computePointsByPosition(numJugadores);
    state = {
      jugadores: nombres.map((name, idx)=>({id:String(idx+1), name: (name||`Jugador ${idx+1}`).trim()||`Jugador ${idx+1}`, total:0})),
      rondas: numRondas,
      rondaActual: 1,
      ordenRonda: Array.from({length:numJugadores}, (_,i)=>String(i+1)),
      terminado: false,
    };
    persistCurrent();
    renderRonda(pts);
    show(VIEWS.ronda);
  }

  function renderRonda(pointsMap){
    els.tituloRonda.textContent = `Ronda ${state.rondaActual} / ${state.rondas}`;
    // Render DnD list in current order
    els.listaJugadores.innerHTML = '';
    state.ordenRonda.forEach((id, idx)=>{
      const j = state.jugadores.find(x=>x.id===id);
      const li = document.createElement('li');
      li.className = 'dnd-item';
      li.dataset.id = id;
      li.innerHTML = `
        <div class="handle" aria-hidden="true">⇅</div>
        <div class="name">${j.name}</div>
        <div class="tag">Pos: ${idx+1}</div>
        <div class="nudger" aria-label="Reordenar">
          <button type="button" class="up" title="Subir" data-dir="up">▲</button>
          <button type="button" class="down" title="Bajar" data-dir="down">▼</button>
        </div>
      `;
      const handle = li.querySelector('.handle');
      if(handle){ handle.setAttribute('draggable','true'); }
      addDnDHandlers(li, handle);
      els.listaJugadores.appendChild(li);
    });
    // Render tablas
    renderTablaPuntosRonda(pointsMap);
    renderTablaAcumulado();
  }

  function renderTablaPuntosRonda(pointsMap){
    const n = state.ordenRonda.length;
    const series = pointsMap.slice(0, n).join(', ');
    const rows = state.ordenRonda.map((id, idx)=>{
      const j = state.jugadores.find(x=>x.id===id);
      const puntos = pointsMap[idx] || 0;
      const rankClass = idx===0?'rank-1': idx===1?'rank-2': idx===2?'rank-3':'';
      return `<tr class="${rankClass}"><td>${idx+1}º</td><td>${j.name}</td><td>${puntos}</td></tr>`;
    }).join('');
    els.tablaPuntosRonda.innerHTML = `
      <h3>Puntos de esta ronda</h3>
      <div class="muted" style="font-size:12px">Serie para N=${n}: ${series}</div>
      <table class="table"><thead><tr><th>Puesto</th><th>Jugador</th><th>Puntos</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  function renderTablaAcumulado(){
    const orden = [...state.jugadores].sort((a,b)=>b.total-a.total);
    const rows = orden.map((j, idx)=>{
      const rankClass = idx===0?'rank-1': idx===1?'rank-2': idx===2?'rank-3':'';
      return `<tr class="${rankClass}"><td>${idx+1}º</td><td>${j.name}</td><td>${j.total}</td></tr>`;
    }).join('');
    els.tablaAcumulado.innerHTML = `
      <h3>Clasificación acumulada</h3>
      <table class="table"><thead><tr><th>Pos</th><th>Jugador</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  function closeRound(){
    const pointsMap = computePointsByPosition(state.ordenRonda.length);
    state.ordenRonda.forEach((id, idx)=>{
      const j = state.jugadores.find(x=>x.id===id);
      j.total += (pointsMap[idx]||0);
    });
    if(state.rondaActual < state.rondas){
      state.rondaActual += 1;
      persistCurrent();
      renderRonda(pointsMap);
      return;
    }
    state.terminado = true;
    persistCurrent();
    renderFinal();
    show(VIEWS.final);
    saveToHistory();
  }

  function renderFinal(){
    const orden = [...state.jugadores].sort((a,b)=>b.total-a.total);
    // asignar posiciones con empates: 1º,1º,3º
    let pos=1, prev=null, count=0;
    const filas = orden.map((j, i)=>{
      count++;
      if(prev!==null && j.total===prev){
        // misma pos
      } else {
        pos = i+1;
        prev = j.total;
      }
      const rankClass = i===0?'rank-1': i===1?'rank-2': i===2?'rank-3':'';
      return `<tr class="${rankClass}"><td>${pos}º</td><td>${j.name}</td><td>${j.total}</td></tr>`;
    }).join('');
    els.tablaFinal.innerHTML = `
      <table class="table"><thead><tr><th>Pos</th><th>Jugador</th><th>Total</th></tr></thead>
      <tbody>${filas}</tbody></table>`;
  }

  function textSummary(){
    const orden = [...state.jugadores].sort((a,b)=>b.total-a.total);
    let out = `Marcador - ${new Date().toLocaleString()}\n`;
    out += `Rondas: ${state.rondas}\n`;
    out += `\nClasificación final:\n`;
    // posiciones con empates
    let pos=1, prev=null;
    orden.forEach((j, i)=>{
      if(prev!==null && j.total===prev){
        // keep pos
      } else {
        pos = i+1;
        prev = j.total;
      }
      out += `${pos}º - ${j.name}: ${j.total}\n`;
    });
    return out;
  }

  function copySummary(){
    const t = textSummary();
    navigator.clipboard.writeText(t).then(()=>{
      toast('Copiado al portapapeles');
    }).catch(()=>{
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      toast('Copiado');
    });
  }

  function toast(msg){
    const n = document.createElement('div');
    n.textContent = msg;
    n.style.position='fixed';n.style.bottom='16px';n.style.left='50%';n.style.transform='translateX(-50%)';
    n.style.background='#0ea5e9';n.style.color='white';n.style.padding='8px 12px';n.style.borderRadius='10px';n.style.zIndex='99';
    document.body.appendChild(n);
    setTimeout(()=>n.remove(),1500);
  }

  function persistCurrent(){
    try{localStorage.setItem(STORAGE_KEYS.current, JSON.stringify(state));}catch(e){}
  }

  function loadCurrent(){
    try{
      const s = localStorage.getItem(STORAGE_KEYS.current);
      if(!s) return null; return JSON.parse(s);
    }catch(e){return null}
  }

  function saveToHistory(){
    try{
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.history)||'[]');
      const entry = { when: Date.now(), jugadores: state.jugadores, rondas: state.rondas };
      list.unshift(entry);
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(list));
    }catch(e){}
  }

  function renderHistory(){
    const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.history)||'[]');
    els.listaHistorial.innerHTML = '';
    if(!list.length){
      els.listaHistorial.innerHTML = '<li class="history-item">Sin partidas guardadas</li>';
      return;
    }
    list.forEach((h,i)=>{
      const li = document.createElement('li');
      li.className='history-item';
      const fecha = new Date(h.when).toLocaleString();
      const top = [...h.jugadores].sort((a,b)=>b.total-a.total)[0];
      li.innerHTML = `<div><strong>${fecha}</strong> • Rondas: ${h.rondas}</div>
        <div class="muted">Ganador: ${top ? top.name+` (${top.total})` : '-'}</div>`;
      els.listaHistorial.appendChild(li);
    });
  }

  // Drag and Drop
  let dragSrcEl = null;
  function addDnDHandlers(li, handle){
    if(handle){
      handle.addEventListener('dragstart', (e)=>{
        dragSrcEl = li;
        li.classList.add('dragging');
        if(e.dataTransfer){
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', li.dataset.id);
        }
      });
      handle.addEventListener('dragend', ()=>{
        li.classList.remove('dragging');
      });
    }
    li.addEventListener('dragover', (e)=>{
      e.preventDefault();
      if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    });
    li.addEventListener('drop', (e)=>{
      e.preventDefault();
      const id = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
      if(!id) return;
      const src = els.listaJugadores.querySelector(`[data-id="${id}"]`);
      if(!src || src===li) return;
      els.listaJugadores.insertBefore(src, li);
      refreshOrderFromDOM();
    });
  }

  function refreshOrderFromDOM(){
    state.ordenRonda = $$('#listaJugadores .dnd-item').map(li=>li.dataset.id);
    // update position tags
    $$('#listaJugadores .dnd-item .tag').forEach((el, idx)=>{ el.textContent = `Pos: ${idx+1}`; });
    persistCurrent();
    renderTablaPuntosRonda(computePointsByPosition(state.ordenRonda.length));
  }

  function moveItemById(id, delta){
    const idx = state.ordenRonda.indexOf(id);
    if(idx<0) return;
    const newIdx = clamp(idx + delta, 0, state.ordenRonda.length-1);
    if(newIdx === idx) return;
    const arr = state.ordenRonda;
    const [it] = arr.splice(idx,1);
    arr.splice(newIdx,0,it);
    // update DOM to reflect new order
    const li = els.listaJugadores.querySelector(`[data-id="${id}"]`);
    const ref = els.listaJugadores.children[newIdx];
    if(ref){
      els.listaJugadores.insertBefore(li, ref);
    } else {
      els.listaJugadores.appendChild(li);
    }
    refreshOrderFromDOM();
  }

  // UI Handlers
  els.formConfig.addEventListener('submit', (e)=>{
    e.preventDefault();
    const nj = clamp(parseInt(els.numJug.value,10),2,12);
    const nr = clamp(parseInt(els.numRondas.value,10),1,24);
    const nombres = [];
    for(let i=0;i<nj;i++){
      const v = $(`#nombre_${i}`)?.value || '';
      nombres.push(v);
    }
    startGame({numJugadores:nj, numRondas:nr, nombres});
  });

  els.numJug.addEventListener('change', renderNombreInputs);
  $('#btnCerrarRonda').addEventListener('click', closeRound);
  $('#btnCancelarRonda').addEventListener('click', ()=>{ show(VIEWS.config); });

  $('#btnNueva').addEventListener('click', ()=>{ show(VIEWS.config); });
  $('#btnHistorial').addEventListener('click', ()=>{ renderHistory(); show(VIEWS.historial); });
  $('#btnBorrarHistorial').addEventListener('click', ()=>{
    if(confirm('¿Borrar historial?')){ localStorage.removeItem(STORAGE_KEYS.history); renderHistory(); }
  });
  $('#btnCopiarTexto').addEventListener('click', copySummary);
  $('#btnNuevaDesdeFinal').addEventListener('click', ()=>{ show(VIEWS.config); });

  // Event delegation for touch-friendly up/down buttons
  els.listaJugadores.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn || !btn.dataset.dir) return;
    e.preventDefault();
    e.stopPropagation();
    const li = e.target.closest('.dnd-item');
    if(!li) return;
    const id = li.dataset.id;
    if(btn.dataset.dir === 'up') moveItemById(id, -1);
    if(btn.dataset.dir === 'down') moveItemById(id, +1);
  });
  els.listaJugadores.addEventListener('touchstart', (e)=>{
    const btn = e.target.closest('button');
    if(!btn || !btn.dataset.dir) return;
    e.preventDefault();
    e.stopPropagation();
    const li = e.target.closest('.dnd-item');
    if(!li) return;
    const id = li.dataset.id;
    if(btn.dataset.dir === 'up') moveItemById(id, -1);
    if(btn.dataset.dir === 'down') moveItemById(id, +1);
  }, { passive: false });
  // pointerdown for broader iOS compatibility
  els.listaJugadores.addEventListener('pointerdown', (e)=>{
    const btn = e.target.closest('button');
    if(!btn || !btn.dataset.dir) return;
    e.preventDefault();
    e.stopPropagation();
    const li = e.target.closest('.dnd-item');
    if(!li) return;
    const id = li.dataset.id;
    if(btn.dataset.dir === 'up') moveItemById(id, -1);
    if(btn.dataset.dir === 'down') moveItemById(id, +1);
  });

  // Install prompt
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault(); deferredPrompt = e; els.btnInstalar.disabled = false; });
  els.btnInstalar.addEventListener('click', async ()=>{
    if(!deferredPrompt){ toast('Si no aparece, usa "Añadir a pantalla de inicio"'); return; }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice; deferredPrompt = null; els.btnInstalar.disabled = true;
  });

  // Service worker
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('./sw.js?v=5');
    });
  }

  // Init
  renderNombreInputs();
  // Reanudar si había partida
  const saved = loadCurrent();
  if(saved && !saved.terminado){
    state = saved;
    renderRonda(computePointsByPosition(state.ordenRonda.length));
    show(VIEWS.ronda);
  } else {
    show(VIEWS.config);
  }
})();
