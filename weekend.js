// ===================== RACE WEEKEND FLOW =====================
// FP1/FP2/FP3 → Qualifying → Strategy approval → Race

let WEEKEND = null;

function startWeekend(){
  const track = currentTrack();
  WEEKEND = {
    track,
    fp: [],
    quali: null,
    strategy: {}, // abbr -> { tyre, plan, orders }
    stage: 'fp',
  };
  // init default strategies for player drivers
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

  // FP block
  body.appendChild(buildFpBlock());
  // Quali block
  body.appendChild(buildQualiBlock());
  // Strategy block
  body.appendChild(buildStrategyBlock());
  // Go racing
  body.appendChild(buildGoRacingBlock());
}

function buildFpBlock(){
  const done = WEEKEND.fp.length > 0;
  const el = document.createElement('div');
  el.className = 'wk-step' + (done?' done':'');
  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">01</span>Practice — FP1 / FP2 / FP3</span>
      <span>${done?'✓ Complete':''}</span></div>
    <div class="wk-step-body">
      <p class="dim small" style="margin-bottom:10px">Run practice to gather tyre data and reveal setup issues. 2 seconds per session.</p>
      ${done ? `
        <div class="wk-log">
          ${WEEKEND.fp.map(f=>`<div class="${f.cls}">${f.text}</div>`).join('')}
        </div>
      ` : `<button class="btn btn-primary btn-sm" id="btnRunFp">Run practice</button>`}
    </div>
  `;
  if(!done){
    setTimeout(()=>{
      document.getElementById('btnRunFp')?.addEventListener('click', runFp);
    }, 0);
  }
  return el;
}

function runFp(){
  const track = WEEKEND.track;
  const log = [];
  const sessions = ['FP1','FP2','FP3'];
  sessions.forEach(s=>{
    // Track evolution over sessions
    const tempShift = Math.round(randf(-3,3));
    log.push({ text:`${s}: green light. Track ${track.trackTempC + tempShift}°C.`, cls:'' });
    if(Math.random() < 0.2){
      log.push({ text:`${s}: rain spotted in sector ${rand(1,3)}.`, cls:'warn' });
    }
    // Occasional incident
    const someone = pick(RACE_drivers_flat());
    if(Math.random() < 0.12){
      log.push({ text:`${s}: ${someone.abbr} spins at Turn ${rand(3,12)} — no damage.`, cls:'warn' });
    }
    if(Math.random() < 0.06){
      log.push({ text:`${s}: ${someone.abbr} causes a red flag after stopping on track.`, cls:'bad' });
    }
    // Reveal useful info: top pace per team
    if(s==='FP3'){
      const top = TEAMS.map(t=>({t, pace: t.pace + (t.id===STATE.myTeamId?STATE.carPaceBoost:0)})).sort((a,b)=>b.pace-a.pace).slice(0,3);
      log.push({ text:`FP3: pace order suggests ${top.map(x=>x.t.abbr).join(' > ')} at the front.`, cls:'good' });
    }
  });
  // Wet-drying forecast hint
  if(track.baseline==='wet-drying') log.push({ text:'Forecast: race starts WET and will dry out.', cls:'warn' });
  if(track.baseline==='dry-threat') log.push({ text:'Forecast: dry start, rain could arrive mid-race.', cls:'warn' });
  if(track.trackTempC < 18) log.push({ text:'Cold track — softer compounds may struggle for warm-up.', cls:'warn' });
  if(track.trackTempC > 40) log.push({ text:'Hot, abrasive surface — high degradation expected.', cls:'warn' });

  WEEKEND.fp = log;
  renderWeekend();
}

function RACE_drivers_flat(){
  return TEAMS.flatMap(t=>t.drivers);
}

function buildQualiBlock(){
  const done = !!WEEKEND.quali;
  const locked = WEEKEND.fp.length === 0;
  const el = document.createElement('div');
  el.className = 'wk-step' + (done?' done':'') + (locked?' locked':'');
  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">02</span>Qualifying — Q1 / Q2 / Q3</span>
      <span>${done?'✓ Complete':locked?'Locked':''}</span></div>
    <div class="wk-step-body">
      <p class="dim small" style="margin-bottom:10px">Full quali simulation. Sets the grid for the race.</p>
      ${done ? `
        <div class="wk-log" style="max-height:280px">
          <div class="good">Grid set.</div>
          ${WEEKEND.quali.grid.slice(0,10).map((g,i)=>`<div>P${i+1} ${g.abbr} (${teamById(g.teamId).abbr})</div>`).join('')}
          <div style="margin-top:6px;color:var(--dimmer)">…and so on back to P22.</div>
        </div>
      ` : `<button class="btn btn-primary btn-sm" id="btnRunQuali" ${locked?'disabled':''}>Run qualifying</button>`}
    </div>
  `;
  if(!done && !locked){
    setTimeout(()=>{
      document.getElementById('btnRunQuali')?.addEventListener('click', runQuali);
    }, 0);
  }
  return el;
}

function runQuali(){
  // Build grid with slight quali-specific randomness
  const entries = [];
  TEAMS.forEach(team=>{
    const effPace = team.pace + (team.id===STATE.myTeamId?STATE.carPaceBoost:0) + (team.id===STATE.myTeamId?(STATE.upgrades.aero+STATE.upgrades.pu)*2:0);
    team.drivers.forEach(drv=>{
      const score = effPace*0.65 + drv.skill*0.35 + randf(-4,4);
      entries.push({ abbr:drv.abbr, name:drv.name, teamId:team.id, skill:drv.skill, consistency:drv.consistency, effPace, qualiScore:score });
    });
  });
  entries.sort((a,b)=>b.qualiScore-a.qualiScore);
  WEEKEND.quali = { grid: entries };
  renderWeekend();
}

function buildStrategyBlock(){
  const locked = !WEEKEND.quali;
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
  const gridPos = WEEKEND.quali ? (WEEKEND.quali.grid.findIndex(g=>g.abbr===d.abbr)+1) : '—';
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
    WEEKEND.strategy[b.dataset.abbr].tyre = b.dataset.tyre;
    refreshStrategyBlock();
  }));
  document.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click', ()=>{
    WEEKEND.strategy[b.dataset.abbr].plan = b.dataset.plan;
    refreshStrategyBlock();
  }));
  document.querySelectorAll('[data-orders]').forEach(b=>b.addEventListener('click', ()=>{
    WEEKEND.strategy[b.dataset.abbr].orders = b.dataset.orders;
    refreshStrategyBlock();
  }));
}

function refreshStrategyBlock(){
  const wrap = document.getElementById('strategyDrivers');
  if(!wrap) return;
  wrap.innerHTML = myTeam().drivers.map(d=>driverStratHtml(d)).join('');
  bindStrategyControls();
}

function buildGoRacingBlock(){
  const ready = WEEKEND.quali;
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
      const grid = WEEKEND.quali.grid;
      startRace(grid, WEEKEND.strategy);
    });
  }, 0);
  return el;
}

document.getElementById('wkBackBtn').addEventListener('click', ()=>{
  enterHub();
}); 
