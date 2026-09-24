// ===================== RACE WEEKEND FLOW =====================
let WEEKEND = null;

function startWeekend(){
  const track = currentTrack();
  WEEKEND = {
    track,
    fp: [],
    quali: null,
    qualiStage: null, // null | 'q1' | 'q2' | 'q3'
    strategy: {},
    stage: 'fp',
  };
  myTeam().drivers.forEach(d=>{
    WEEKEND.strategy[d.abbr] = { tyre: 'M', plan: '1-stop', orders: 'fight' };
  });
  showScreen('screen-weekend');
  renderWeekend();
}

function renderWeekend(){
  const track = WEEKEND.track;
  document.getElementById('wkRound').textContent = `ROUND ${STATE.round+1} · SEASON ${STATE.season}`;
  document.getElementById('wkTrack').textContent = `${track.name} — ${track.country}`;
  document.getElementById('wkMeta').innerHTML = `${track.laps} laps · ${track.tempC}°C air / ${track.trackTempC}°C track · 💨 ${track.windKmh} km/h · ${track.character}`;

  const body = document.getElementById('wkBody');
  body.innerHTML = '';
  body.appendChild(buildFpBlock());
  body.appendChild(buildQualiBlock());
  body.appendChild(buildStrategyBlock());
  body.appendChild(buildGoRacingBlock());
}

// ---------- Practice ----------
function buildFpBlock(){
  const done = WEEKEND.fp.length > 0;
  const el = document.createElement('div');
  el.className = 'wk-step' + (done?' done':'');
  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">01</span>Practice — FP1 / FP2 / FP3</span>
      <span>${done?'✓ Complete':''}</span></div>
    <div class="wk-step-body">
      <p class="dim small" style="margin-bottom:10px">Run practice to gather tyre data and reveal setup issues.</p>
      ${done ? `<div class="wk-log">${WEEKEND.fp.map(f=>`<div class="${f.cls}">${f.text}</div>`).join('')}</div>`
             : `<button class="btn btn-primary btn-sm" id="btnRunFp">Run practice</button>`}
    </div>
  `;
  if(!done) setTimeout(()=>document.getElementById('btnRunFp')?.addEventListener('click', runFp), 0);
  return el;
}
function runFp(){
  const track = WEEKEND.track;
  const log = [];
  ['FP1','FP2','FP3'].forEach(s=>{
    const shift = Math.round(randf(-3,3));
    log.push({ text:`${s}: green light. Track ${track.trackTempC + shift}°C.`, cls:'' });
    if(Math.random() < 0.2) log.push({ text:`${s}: rain spotted in sector ${rand(1,3)}.`, cls:'warn' });
    const someone = pick(TEAMS.flatMap(t=>t.drivers));
    if(Math.random() < 0.12) log.push({ text:`${s}: ${someone.abbr} spins at Turn ${rand(3,12)} — no damage.`, cls:'warn' });
    if(Math.random() < 0.05) log.push({ text:`${s}: ${someone.abbr} brings out a red flag briefly.`, cls:'bad' });
    if(s==='FP3'){
      const top = TEAMS.map(t=>({t, pace: t.pace + (t.id===STATE.myTeamId?STATE.carPaceBoost:0)})).sort((a,b)=>b.pace-a.pace).slice(0,3);
      log.push({ text:`FP3: pace order suggests ${top.map(x=>x.t.abbr).join(' > ')} at the front.`, cls:'good' });
    }
  });
  if(track.baseline==='wet-drying') log.push({ text:'Forecast: race starts WET and will dry out.', cls:'warn' });
  if(track.baseline==='dry-threat') log.push({ text:'Forecast: dry start, rain could arrive mid-race.', cls:'warn' });
  if(track.trackTempC < 18) log.push({ text:'Cold track — softer compounds may struggle for warm-up.', cls:'warn' });
  if(track.trackTempC > 40) log.push({ text:'Hot, abrasive surface — high degradation expected.', cls:'warn' });
  WEEKEND.fp = log;
  renderWeekend();
}

// ---------- Qualifying (3 stages) ----------
function buildQualiBlock(){
  // BUG FIX: 'completed' only becomes true once the final grid exists (end of Q3).
  // Previously we used `!!WEEKEND.quali`, which flipped true after Q1 and hid the Q2 button.
  const completed = !!(WEEKEND.quali && WEEKEND.quali.grid);
  const locked = WEEKEND.fp.length === 0;
  const el = document.createElement('div');
  el.className = 'wk-step' + (completed?' done':'') + (locked?' locked':'');

  let stageButton = '';
  if(!locked && !completed){
    if(!WEEKEND.qualiStage)          stageButton = `<button class="btn btn-primary btn-sm" id="btnRunQ1">Run Q1</button>`;
    else if(WEEKEND.qualiStage==='q1') stageButton = `<button class="btn btn-primary btn-sm" id="btnRunQ2">Run Q2</button>`;
    else if(WEEKEND.qualiStage==='q2') stageButton = `<button class="btn btn-primary btn-sm" id="btnRunQ3">Run Q3</button>`;
  }

  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">02</span>Qualifying — Q1 / Q2 / Q3</span>
      <span>${completed?'✓ Complete':locked?'Locked':''}</span></div>
    <div class="wk-step-body">
      <p class="dim small" style="margin-bottom:10px">Q1: 22 cars → 15 advance. Q2: 15 → 10. Q3: shootout for grid.</p>
      ${WEEKEND.qualiStage ? `<div class="wk-log" id="qualiLog">${renderQualiLog()}</div>` : ''}
      <div style="margin-top:10px">${stageButton}</div>
    </div>
  `;
  if(!locked && !completed){
    setTimeout(()=>{
      document.getElementById('btnRunQ1')?.addEventListener('click', ()=>runQualiStage('q1'));
      document.getElementById('btnRunQ2')?.addEventListener('click', ()=>runQualiStage('q2'));
      document.getElementById('btnRunQ3')?.addEventListener('click', ()=>runQualiStage('q3'));
    }, 0);
  }
  return el;
}

function renderQualiLog(){
  if(!WEEKEND.qualiStage) return '';
  if(!WEEKEND.quali) return '<div>Awaiting stage results...</div>';
  return WEEKEND.quali.log || '';
}

function runQualiStage(stage){
  const track = WEEKEND.track;
  const lines = [];
  const allDrivers = TEAMS.flatMap(t=>t.drivers.map(d=>({
    ...d,
    teamId: t.id,
    teamPace: t.pace + (t.id===STATE.myTeamId?STATE.carPaceBoost:0) + (t.id===STATE.myTeamId?(STATE.upgrades.aero+STATE.upgrades.pu)*2:0),
  })));

  if(stage==='q1'){
    const times = allDrivers
      .map(d=>({ ...d, time: 100 - (d.teamPace*0.35 + d.skill*0.25) + randf(-0.6,0.6) }))
      .sort((a,b)=>a.time-b.time);
    const advancing = times.slice(0,15);
    const out = times.slice(15);
    lines.push(`<div class="good">Q1 complete. ${out.length} eliminated.</div>`);
    out.forEach(d=> lines.push(`<div class="bad">OUT: P${times.indexOf(d)+1} ${d.abbr} (${d.teamId.toUpperCase()}) ${d.time.toFixed(2)}</div>`));
    advancing.slice(0,5).forEach((d,i)=> lines.push(`<div>P${i+1} ${d.abbr} ${d.time.toFixed(2)}</div>`));
    lines.push('<div class="dim">…top 15 advance to Q2.</div>');
    WEEKEND.qualiStage = 'q1';
    WEEKEND.quali = { q1Advancing: advancing, q1All: times, log: lines.join('') };
    renderWeekend();
    return;
  }

  if(stage==='q2'){
    if(!WEEKEND.quali || !WEEKEND.quali.q1Advancing) return;
    const pool = WEEKEND.quali.q1Advancing
      .map(d=>({ ...d, time: 100 - (d.teamPace*0.35 + d.skill*0.25) + randf(-0.6,0.6) }))
      .sort((a,b)=>a.time-b.time);
    const advancing = pool.slice(0,10);
    const out = pool.slice(10);
    lines.push(`<div class="good">Q2 complete. 5 more eliminated.</div>`);
    out.forEach(d=> lines.push(`<div class="bad">OUT: P${pool.indexOf(d)+11} ${d.abbr} ${d.time.toFixed(2)}</div>`));
    advancing.slice(0,5).forEach((d,i)=> lines.push(`<div>P${i+1} ${d.abbr} ${d.time.toFixed(2)}</div>`));
    lines.push('<div class="dim">…top 10 advance to Q3.</div>');
    WEEKEND.qualiStage = 'q2';
    WEEKEND.quali.q2Advancing = advancing;
    WEEKEND.quali.q2All = pool;
    WEEKEND.quali.log = (WEEKEND.quali.log || '') + lines.join('');
    renderWeekend();
    return;
  }

  if(stage==='q3'){
    if(!WEEKEND.quali || !WEEKEND.quali.q2Advancing) return;
    const pool = WEEKEND.quali.q2Advancing
      .map(d=>({ ...d, time: 100 - (d.teamPace*0.35 + d.skill*0.25) + randf(-0.4,0.4) }))
      .sort((a,b)=>a.time-b.time);
    lines.push(`<div class="good">Q3 complete. Grid set.</div>`);
    pool.forEach((d,i)=> lines.push(`<div>${i+1}. ${d.abbr} (${d.teamId.toUpperCase()}) ${d.time.toFixed(2)}</div>`));

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

// ---------- Strategy ----------
function buildStrategyBlock(){
  // Locked until the grid exists (end of Q3).
  const locked = !(WEEKEND.quali && WEEKEND.quali.grid);
  const el = document.createElement('div');
  el.className = 'wk-step' + (locked?' locked':'');
  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">03</span>Race strategy approval</span>
      <span>${locked?'Locked':''}</span></div>
    <div class="wk-step-body">
      <p class="dim small" style="margin-bottom:12px">Approve each driver's starting tyre, pit plan and team orders.</p>
      <div id="strategyDrivers"></div>
    </div>
  `;
  setTimeout(()=>{
    const wrap = document.getElementById('strategyDrivers');
    if(!wrap) return;
    wrap.innerHTML = myTeam().drivers.map(d=>driverStratHtml(d)).join('');
    bindStrategyControls();
  }, 0);
  return el;
}

function driverStratHtml(d){
  const s = WEEKEND.strategy[d.abbr];
  const gridPos = WEEKEND.quali && WEEKEND.quali.grid
    ? (WEEKEND.quali.grid.findIndex(g=>g.abbr===d.abbr)+1)
    : '—';
  return `
    <div class="driver-strat" data-abbr="${d.abbr}">
      <div class="driver-strat-name">
        <span>${d.name} <span class="dim" style="font-size:11px">(${d.abbr})</span></span>
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

function bindStrategyControls(){
  document.querySelectorAll('[data-tyre]').forEach(b=>b.addEventListener('click', ()=>{
    WEEKEND.strategy[b.dataset.abbr].tyre = b.dataset.tyre; refreshStrategyBlock();
  }));
  document.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click', ()=>{
    WEEKEND.strategy[b.dataset.abbr].plan = b.dataset.plan; refreshStrategyBlock();
  }));
  document.querySelectorAll('[data-orders]').forEach(b=>b.addEventListener('click', ()=>{
    WEEKEND.strategy[b.dataset.abbr].orders = b.dataset.orders; refreshStrategyBlock();
  }));
}

function refreshStrategyBlock(){
  const wrap = document.getElementById('strategyDrivers');
  if(!wrap) return;
  wrap.innerHTML = myTeam().drivers.map(d=>driverStratHtml(d)).join('');
  bindStrategyControls();
}

function buildGoRacingBlock(){
  const ready = !!(WEEKEND.quali && WEEKEND.quali.grid);
  const el = document.createElement('div');
  el.className = 'wk-step';
  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">04</span>Lights out</span></div>
    <div class="wk-step-body" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="dim small">${ready?'Grid set. Approve your strategy, then go racing.':'Complete quali first.'}</div>
      <button class="btn btn-primary" id="btnGoRace" ${ready?'':'disabled'}>🏁 Go racing</button>
    </div>
  `;
  setTimeout(()=>{
    document.getElementById('btnGoRace')?.addEventListener('click', ()=>{
      if(!WEEKEND.quali || !WEEKEND.quali.grid) return;
      startRace(WEEKEND.quali.grid, WEEKEND.strategy);
    });
  }, 0);
  return el;
}

document.getElementById('wkBackBtn').addEventListener('click', ()=>enterHub());
