// ===================== RACE WEEKEND FLOW =====================
// Practice section removed entirely.
// Flow: Hub → Qualifying (3 stages) → Strategy approval → Race.

let WEEKEND = null;

function startWeekend(){
  const track = currentTrack();
  WEEKEND = {
    track,
    quali: null,
    qualiStage: null,
    qualiChaos: rollQualiChaos(track),
    strategy: {},
  };
  myTeam().drivers.forEach(d=>{
    WEEKEND.strategy[d.abbr] = { tyre: 'M', plan: '1-stop', orders: 'fight' };
  });
  showScreen('screen-weekend');
  renderWeekend();
}

// Determine how chaotic this quali session will be
function rollQualiChaos(track){
  const r = Math.random();
  if(track.baseline === 'wet-drying') return 'wet';
  if(track.rainChance > 0.5 && r < 0.5) return 'wet';
  if(r < 0.02) return 'chaotic';
  if(r < 0.20) return 'shuffled';
  return 'normal';
}

function renderWeekend(){
  const track = WEEKEND.track;
  document.getElementById('wkRound').textContent = `ROUND ${STATE.round+1} · SEASON ${STATE.season}`;
  document.getElementById('wkTrack').textContent = `${track.name} — ${track.country}`;
  document.getElementById('wkMeta').innerHTML = `${track.laps} laps · ${track.tempC}°C air / ${track.trackTempC}°C track · 💨 ${track.windKmh} km/h · ${track.character}`;
  const body = document.getElementById('wkBody');
  body.innerHTML = '';
  body.appendChild(buildQualiBlock());
  body.appendChild(buildStrategyBlock());
  body.appendChild(buildGoRacingBlock());
}

// ---------- Qualifying ----------
function buildQualiBlock(){
  const completed = !!(WEEKEND.quali && WEEKEND.quali.grid);
  const el = document.createElement('div');
  el.className = 'wk-step' + (completed?' done':'');

  let stageButton = '';
  if(!completed){
    if(!WEEKEND.qualiStage)            stageButton = `<button class="btn btn-primary btn-sm" id="btnRunQ1">Run Q1</button>`;
    else if(WEEKEND.qualiStage==='q1') stageButton = `<button class="btn btn-primary btn-sm" id="btnRunQ2">Run Q2</button>`;
    else if(WEEKEND.qualiStage==='q2') stageButton = `<button class="btn btn-primary btn-sm" id="btnRunQ3">Run Q3</button>`;
  }

  const chaosLabel = {
    normal:   'Dry, predictable session',
    shuffled: 'Mixed conditions expected — upsets possible',
    wet:      'Wet session — expect chaos',
    chaotic:  'Chaotic session — anything can happen',
  }[WEEKEND.qualiChaos];

  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">01</span>Qualifying — Q1 / Q2 / Q3</span>
      <span>${completed?'✓ Complete':''}</span></div>
    <div class="wk-step-body">
      <p class="dim small" style="margin-bottom:10px">${chaosLabel}. Q1: 22 → 15. Q2: 15 → 10. Q3: shootout.</p>
      ${WEEKEND.qualiStage ? `<div class="wk-log">${renderQualiLog()}</div>` : ''}
      <div style="margin-top:10px">${stageButton}</div>
    </div>
  `;
  if(!completed){
    const q1 = el.querySelector('#btnRunQ1');
    const q2 = el.querySelector('#btnRunQ2');
    const q3 = el.querySelector('#btnRunQ3');
    if(q1) q1.addEventListener('click', ()=>runQualiStage('q1'));
    if(q2) q2.addEventListener('click', ()=>runQualiStage('q2'));
    if(q3) q3.addEventListener('click', ()=>runQualiStage('q3'));
  }
  return el;
}

function renderQualiLog(){
  if(!WEEKEND.qualiStage) return '';
  if(!WEEKEND.quali) return '<div>Awaiting stage results...</div>';
  return WEEKEND.quali.log || '';
}

// Chaos variance applied to a driver's quali time. Lower time = faster.
function applyQualiChaos(baseTime, driver, teamTier){
  const chaos = WEEKEND.qualiChaos;
  const tierMul = { title:0.8, contender:1.0, midfield:1.2, backmarker:1.4 }[teamTier] || 1.0;
  let variance = 0;
  switch(chaos){
    case 'normal':   variance = randf(-1.2, 1.2) * tierMul * (1 - driver.skill/200); break;
    case 'shuffled': variance = randf(-2.5, 2.5) * tierMul * (1 - driver.skill/180); break;
    case 'wet':      variance = randf(-3.5, 3.5) * tierMul * (1 - driver.skill/150); break;
    case 'chaotic':  variance = randf(-4.5, 4.5) * tierMul * (1 - driver.skill/140); break;
  }
  return baseTime - variance;
}

function runQualiStage(stage){
  const allDrivers = TEAMS.flatMap(t=>t.drivers.map(d=>({
    ...d, teamId: t.id, teamTier: t.tier,
    teamPace: t.pace + (t.id===STATE.myTeamId?STATE.carPaceBoost:0) + (t.id===STATE.myTeamId?(STATE.upgrades.aero+STATE.upgrades.pu)*2:0),
  })));
  const lines = [];

  if(stage==='q1'){
    const times = allDrivers.map(d=>{
      const base = 100 - (d.teamPace*0.35 + d.skill*0.25);
      const withChaos = applyQualiChaos(base, d, d.teamTier);
      return { ...d, time: withChaos };
    }).sort((a,b)=>a.time-b.time);
    const advancing = times.slice(0,15);
    const out = times.slice(15);
    lines.push(`<div class="good">Q1 complete. ${out.length} eliminated.</div>`);
    out.forEach(d=> lines.push(`<div class="bad">OUT: P${times.indexOf(d)+1} ${d.name} ${d.time.toFixed(2)}</div>`));
    advancing.slice(0,5).forEach((d,i)=> lines.push(`<div>P${i+1} ${d.name} ${d.time.toFixed(2)}</div>`));
    lines.push('<div class="dim">…top 15 advance.</div>');
    WEEKEND.qualiStage = 'q1';
    WEEKEND.quali = { q1Advancing: advancing, q1All: times, log: lines.join('') };
    renderWeekend();
    return;
  }
  if(stage==='q2'){
    if(!WEEKEND.quali || !WEEKEND.quali.q1Advancing) return;
    const pool = WEEKEND.quali.q1Advancing.map(d=>{
      const base = 100 - (d.teamPace*0.35 + d.skill*0.25);
      const withChaos = applyQualiChaos(base, d, d.teamTier);
      return { ...d, time: withChaos };
    }).sort((a,b)=>a.time-b.time);
    const advancing = pool.slice(0,10);
    const out = pool.slice(10);
    lines.push(`<div class="good">Q2 complete. 5 eliminated.</div>`);
    out.forEach(d=> lines.push(`<div class="bad">OUT: P${pool.indexOf(d)+11} ${d.name} ${d.time.toFixed(2)}</div>`));
    advancing.slice(0,5).forEach((d,i)=> lines.push(`<div>P${i+1} ${d.name} ${d.time.toFixed(2)}</div>`));
    lines.push('<div class="dim">…top 10 advance.</div>');
    WEEKEND.qualiStage = 'q2';
    WEEKEND.quali.q2Advancing = advancing;
    WEEKEND.quali.q2All = pool;
    WEEKEND.quali.log = (WEEKEND.quali.log || '') + lines.join('');
    renderWeekend();
    return;
  }
  if(stage==='q3'){
    if(!WEEKEND.quali || !WEEKEND.quali.q2Advancing) return;
    const pool = WEEKEND.quali.q2Advancing.map(d=>{
      const base = 100 - (d.teamPace*0.35 + d.skill*0.25);
      const withChaos = applyQualiChaos(base, d, d.teamTier);
      return { ...d, time: withChaos };
    }).sort((a,b)=>a.time-b.time);
    lines.push(`<div class="good">Q3 complete. Grid set.</div>`);
    pool.forEach((d,i)=> lines.push(`<div>${i+1}. ${d.name} ${d.time.toFixed(2)}</div>`));
    const eliminatedQ2 = WEEKEND.quali.q2All.slice(10);
    const eliminatedQ1 = WEEKEND.quali.q1All.slice(15);
    const grid = [...pool, ...eliminatedQ2, ...eliminatedQ1];
    WEEKEND.qualiStage = 'q3';
    WEEKEND.quali.grid = grid;
    WEEKEND.quali.log = (WEEKEND.quali.log || '') + lines.join('');
    renderWeekend();
    return;
  }
}

// ---------- Strategy approval ----------
function buildStrategyBlock(){
  const locked = !(WEEKEND.quali && WEEKEND.quali.grid);
  const el = document.createElement('div');
  el.className = 'wk-step' + (locked?' locked':'');
  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">02</span>Race strategy approval</span>
      <span>${locked?'Locked':''}</span></div>
    <div class="wk-step-body">
      <p class="dim small" style="margin-bottom:12px">Approve each driver's starting tyre, pit plan and team orders.</p>
      <div id="strategyDrivers"></div>
    </div>
  `;
  if(!locked){
    const wrap = el.querySelector('#strategyDrivers');
    if(wrap){
      wrap.innerHTML = myTeam().drivers.map(d=>driverStratHtml(d)).join('');
      bindStrategyControls(wrap);
    }
  }
  return el;
}
function driverStratHtml(d){
  const s = WEEKEND.strategy[d.abbr];
  const gridPos = WEEKEND.quali && WEEKEND.quali.grid
    ? (WEEKEND.quali.grid.findIndex(g=>g.abbr===d.abbr)+1) : '—';
  return `
    <div class="driver-strat" data-abbr="${d.abbr}">
      <div class="driver-strat-name">
        <span>${d.name}</span>
        <span class="dim" style="font-size:11px">Grid P${gridPos}</span>
      </div>
      <div style="font-size:11px;color:var(--dim);margin-bottom:4px">Starting tyre</div>
      <div class="tyre-select">
        ${['S','M','H','I','W'].map(c=>`
          <button class="tyre-btn ${s.tyre===c?'active':''}" data-abbr="${d.abbr}" data-tyre="${c}">
            <span class="tyre-dot ${c}"></span>${COMPOUNDS[c].name}
          </button>
        `).join('')}
      </div>
      <div style="font-size:11px;color:var(--dim);margin:10px 0 4px">Pit plan</div>
      <div class="tyre-select">
        ${['1-stop','2-stop','free'].map(p=>`
          <button class="tyre-btn ${s.plan===p?'active':''}" data-abbr="${d.abbr}" data-plan="${p}">${p}</button>
        `).join('')}
      </div>
      <div style="font-size:11px;color:var(--dim);margin:10px 0 4px">Team orders</div>
      <div class="tyre-select">
        ${['fight','hold','lead'].map(o=>`
          <button class="tyre-btn ${s.orders===o?'active':''}" data-abbr="${d.abbr}" data-orders="${o}">${o}</button>
        `).join('')}
      </div>
    </div>
  `;
}
function bindStrategyControls(scope){
  const root = scope || document;
  root.querySelectorAll('[data-tyre]').forEach(b=>b.addEventListener('click', ()=>{
    WEEKEND.strategy[b.dataset.abbr].tyre = b.dataset.tyre;
    refreshStrategyBlock();
  }));
  root.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click', ()=>{
    WEEKEND.strategy[b.dataset.abbr].plan = b.dataset.plan;
    refreshStrategyBlock();
  }));
  root.querySelectorAll('[data-orders]').forEach(b=>b.addEventListener('click', ()=>{
    WEEKEND.strategy[b.dataset.abbr].orders = b.dataset.orders;
    refreshStrategyBlock();
  }));
}
function refreshStrategyBlock(){
  const wrap = document.getElementById('strategyDrivers');
  if(!wrap) return;
  wrap.innerHTML = myTeam().drivers.map(d=>driverStratHtml(d)).join('');
  bindStrategyControls(wrap);
}

function buildGoRacingBlock(){
  const ready = !!(WEEKEND.quali && WEEKEND.quali.grid);
  const el = document.createElement('div');
  el.className = 'wk-step';
  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">03</span>Lights out</span></div>
    <div class="wk-step-body" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="dim small">${ready?'Grid set. Approve your strategy, then go racing.':'Complete qualifying first.'}</div>
      <button class="btn btn-primary" id="btnGoRace" ${ready?'':'disabled'}>🏁 Go racing</button>
    </div>
  `;
  const btn = el.querySelector('#btnGoRace');
  if(btn && ready) btn.addEventListener('click', ()=>{
    if(!WEEKEND.quali || !WEEKEND.quali.grid) return;
    startRace(WEEKEND.quali.grid, WEEKEND.strategy);
  });
  return el;
}

document.getElementById('wkBackBtn').addEventListener('click', ()=>enterHub());
