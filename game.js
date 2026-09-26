// ===================== STATE =====================
const SAVE_PREFIX = 'pitwall_slot_';
const SAVE_SLOTS = 3;
const SAVE_VERSION = 14;

let STATE = null;
let activeSlot = 0;

function blankState(teamId){
  return {
    version: SAVE_VERSION,
    myTeamId: teamId,
    season: 1,
    round: 0,
    budget: 0,
    capUsed: 0,
    engineers: {},
    candidates: [],
    constructorsPoints: Object.fromEntries(TEAMS.map(t=>[t.id,0])),
    driversPoints: Object.fromEntries(TEAMS.flatMap(t=>t.drivers.map(d=>[d.abbr,0]))),
    driverTeam: Object.fromEntries(TEAMS.flatMap(t=>t.drivers.map(d=>[d.abbr,t.id]))),
    carPaceBoost: 0,
    carReliabilityBoost: 0,
    boardConf: 70,
    raceLog: [],
    seasonHistory: [],
    upgrades: { aero:0, pu:0, rel:0, strat:0 },
    pendingUpgrades: [],
    pendingGridPenalties: {},
    settings: { sound: true },
    marketOffers: [],
    form: {},
    driverSeasonStats: {},
    aduoReviewsDone: [],
    aduoHistory: [],
    wetWeekends: [],
    sponsors: null,
    tyreMgmtBonus: 0,     // Kurosu reward: reduce deg rate
    driverRatingBonus: {}, // HydroGlow: {abbr: +0.2}
  };
}
function newGameState(teamId){
  const team = TEAMS.find(t=>t.id===teamId);
  const s = blankState(teamId);
  s.budget = team.budget;
  s.engineers = {
    aero:        makeStarterEngineer('aero', team.tier),
    reliability: makeStarterEngineer('reliability', team.tier),
    strategist:  makeStarterEngineer('strategist', team.tier),
    perf:        makeStarterEngineer('perf', team.tier),
  };
  TEAMS.forEach(t=>{
    t.drivers.forEach(d=>{
      s.driverSeasonStats[d.abbr] = { points:0, wins:0, podiums:0, poles:0, fastestLaps:0, dnfs:0, ratings:[] };
    });
  });
  s.wetWeekends = rollWetWeekends();
  s.sponsors = {
    main: null,           // { id, name, annual, perRace, pacePenalty, renewalModifier }
    events: {
      kurosu:    { claimed:false, failed:false, progress:0 },
      hydroglow: { claimed:false, failed:false, progress:0 },
      novapay:   { claimed:false, failed:false, progress:0 },
    },
  };
  return s;
}
function rollWetWeekends(){
  const euroIndices = TRACKS
    .map((t,i)=>({ id:t.id, i }))
    .filter(x => EUROPEAN_LEG_IDS.includes(x.id))
    .map(x => x.i);
  const picked = [];
  const pool = [...euroIndices];
  while(picked.length < 3 && pool.length > 0){
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx,1)[0]);
  }
  return picked;
}
function makeStarterEngineer(roleKey, tier){
  const role = ENGINEER_ROLES.find(r=>r.key===roleKey);
  const base = { title:78, contender:68, midfield:58, backmarker:48 }[tier];
  return { id: roleKey+'_start', name: randName(), role: roleKey, roleLabel: role.label, affects: role.affects, skill: clamp(base + rand(-4,4), 20, 99) };
}
function randName(){ return `${pick(ENGINEER_FIRST)} ${pick(ENGINEER_LAST)}`; }
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randf(min,max){ return Math.random()*(max-min)+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

function fmtMoney(v){ return `$${(Math.round(v*10)/10).toFixed(1)}M`; }

const PRINCIPAL_STYLES = {
  mer:{pitBias:1.10}, fer:{pitBias:0.88}, mcl:{pitBias:1.05}, rbr:{pitBias:1.00},
  vcb:{pitBias:1.00}, alp:{pitBias:0.92}, haa:{pitBias:1.08}, aud:{pitBias:1.08},
  wil:{pitBias:1.00}, amr:{pitBias:0.90}, cad:{pitBias:1.10},
};

// ===================== PERSISTENCE =====================
function saveToSlot(slot){ try{ localStorage.setItem(SAVE_PREFIX+slot, JSON.stringify(STATE)); }catch(e){} }
function loadFromSlot(slot){
  try{
    const raw = localStorage.getItem(SAVE_PREFIX+slot);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(s.version !== SAVE_VERSION) return null;
    return s;
  }catch(e){ return null; }
}
function clearSlot(slot){ try{ localStorage.removeItem(SAVE_PREFIX+slot); }catch(e){} }
function hasAnySave(){ for(let i=0;i<SAVE_SLOTS;i++) if(loadFromSlot(i)) return true; return false; }

// ===================== SCREENS =====================
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function openModal(html){
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('active');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('active'); }

// ===================== INTRO =====================
document.getElementById('btnGoTeamSelect').addEventListener('click', ()=>{ renderTeamSelect(); showScreen('screen-teamselect'); });
document.getElementById('btnSprintRace').addEventListener('click', ()=>openSprintSetup());
document.getElementById('btnLoadGame').addEventListener('click', openSaveSlots);
document.getElementById('btnSaveSlots').addEventListener('click', openSaveSlots);
document.getElementById('btnSettings').addEventListener('click', openSettings);

// Highlight-on-tap for intro pills (mobile feedback)
document.querySelectorAll('.intro-pill').forEach(pill=>{
  pill.addEventListener('touchstart', ()=>pill.classList.add('highlight'), {passive:true});
  pill.addEventListener('touchend', ()=>setTimeout(()=>pill.classList.remove('highlight'), 180));
  pill.addEventListener('mouseenter', ()=>pill.classList.add('highlight'));
  pill.addEventListener('mouseleave', ()=>pill.classList.remove('highlight'));
});

function openSaveSlots(){
  const html = `
    <h2>Save slots</h2>
    ${[0,1,2].map(i=>{
      const s = loadFromSlot(i);
      const meta = s ? `Season ${s.season} · Round ${s.round+1}/24 · ${TEAMS.find(t=>t.id===s.myTeamId).name} · ${fmtMoney(s.budget)}` : 'Empty slot';
      return `<div class="save-slot">
        <div><div style="font-weight:700;margin-bottom:3px">Slot ${i+1}</div><div class="meta">${meta}</div></div>
        <div style="display:flex;gap:8px">
          ${s ? `<button class="btn btn-primary btn-sm" data-load="${i}">Load</button>
                 <button class="btn btn-danger btn-sm" data-del="${i}">Delete</button>`
               : `<span class="meta">No save</span>`}
        </div>
      </div>`;
    }).join('')}
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="btnCloseSave">Close</button></div>
  `;
  openModal(html);
  document.querySelectorAll('[data-load]').forEach(b=>b.addEventListener('click', ()=>{
    const s = loadFromSlot(parseInt(b.dataset.load));
    if(!s) return;
    STATE = s; activeSlot = parseInt(b.dataset.load);
    closeModal(); enterHub();
  }));
  document.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>{
    clearSlot(parseInt(b.dataset.del)); openSaveSlots();
  }));
  document.getElementById('btnCloseSave').addEventListener('click', closeModal);
}

function openSettings(){
  const s = STATE ? STATE.settings : { sound:true };
  openModal(`
    <h2>Settings</h2>
    <div style="display:flex;justify-content:space-between;padding:10px 0;">
      <span>Sound effects</span>
      <button class="btn btn-ghost btn-sm" id="btnToggleSound">${s.sound?'On':'Off'}</button>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="btnCloseSettings">Close</button></div>
  `);
  document.getElementById('btnToggleSound').addEventListener('click', ()=>{
    if(STATE){ STATE.settings.sound = !STATE.settings.sound; saveToSlot(activeSlot); }
    openSettings();
  });
  document.getElementById('btnCloseSettings').addEventListener('click', closeModal);
}

// ===================== TEAM SELECT =====================
let selectedTeamId = null;
function renderTeamSelect(){
  const grid = document.getElementById('teamGrid');
  grid.innerHTML = '';
  TEAMS.forEach(team=>{
    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div class="team-card-body">
        <div class="team-abbr" style="color:${team.color}">${team.abbr}</div>
        <div class="team-name">${team.name}</div>
        <div class="team-stats-row">
          <span class="drivers">${team.drivers[0].abbr} · ${team.drivers[1].abbr}</span>
          <span class="stat">PACE <b>${team.pace}</b></span>
          <span class="stat">RELI <b>${team.reliability}</b></span>
          <span class="stat">$<b>${team.budget}M</b></span>
        </div>
        <div class="team-board">Board: ${TIER_OBJECTIVES[team.tier].label}</div>
      </div>
      <div class="chevron-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
      </div>
    `;
    card.addEventListener('click', ()=>{
      document.querySelectorAll('.team-card').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      selectedTeamId = team.id;
      document.getElementById('btnConfirmTeam').disabled = false;
    });
    grid.appendChild(card);
  });
}
document.getElementById('btnBackIntro').addEventListener('click', ()=>showScreen('screen-intro'));
document.getElementById('btnBackIntroBottom').addEventListener('click', ()=>showScreen('screen-intro'));

// ===================== SPONSOR SELECT =====================
let selectedSponsorId = null;
document.getElementById('btnConfirmTeam').addEventListener('click', ()=>{
  if(!selectedTeamId) return;
  renderSponsorSelect();
  showScreen('screen-sponsorselect');
});
function renderSponsorSelect(){
  const grid = document.getElementById('sponsorGrid');
  grid.innerHTML = '';
  MAIN_SPONSORS.forEach(sp=>{
    const card = document.createElement('div');
    card.className = 'sponsor-option';
    card.dataset.sponsor = sp.id;
    card.innerHTML = `
      <div class="so-top">
        <div class="so-name">${sp.name}</div>
        <div class="so-pay">${fmtMoney(sp.annual)}/season</div>
      </div>
      <div class="so-meta">
        Per race: <b>${fmtMoney(sp.perRace)}</b><br>
        Pace penalty: <b style="color:${sp.pacePenalty>0?'var(--red)':'var(--green)'}">${sp.pacePenalty>0?'-'+sp.pacePenalty:'none'}</b>
      </div>
    `;
    card.addEventListener('click', ()=>{
      document.querySelectorAll('.sponsor-option').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      selectedSponsorId = sp.id;
      document.getElementById('btnConfirmSponsor').disabled = false;
    });
    grid.appendChild(card);
  });
}
document.getElementById('btnSponsorBack').addEventListener('click', ()=>showScreen('screen-teamselect'));
document.getElementById('btnSponsorBackBottom').addEventListener('click', ()=>showScreen('screen-teamselect'));
document.getElementById('btnConfirmSponsor').addEventListener('click', ()=>{
  if(!selectedTeamId || !selectedSponsorId) return;
  STATE = newGameState(selectedTeamId);
  const sp = MAIN_SPONSORS.find(x=>x.id===selectedSponsorId);
  STATE.sponsors.main = { ...sp, renewalModifier: 1.0 };
  activeSlot = 0;
  for(let i=0;i<SAVE_SLOTS;i++){ if(!loadFromSlot(i)){ activeSlot = i; break; } }
  saveToSlot(activeSlot);
  enterHub();
});

// ===================== SPRINT SETUP =====================
let SPRINT = null;

function openSprintSetup(){
  SPRINT = { trackId: null, teamId: null, revealed: false };
  showScreen('screen-sprintsetup');
  renderSprintSetup();
}

function renderSprintSetup(){
  const grid = document.getElementById('sprintTrackGrid');
  const reveal = document.getElementById('sprintReveal');
  const picker = document.getElementById('sprintTrackPicker');
  const contBtn = document.getElementById('btnSprintContinue');

  if(SPRINT.revealed){
    picker.style.display = 'none';
    const t = TEAMS.find(x=>x.id===SPRINT.teamId);
    const track = TRACKS.find(x=>x.id===SPRINT.trackId);
    reveal.classList.remove('hidden');
    reveal.innerHTML = `
      <div class="sp-team-reveal">
        <div class="label">Your car</div>
        <div class="team" style="color:${t.color}">${t.name}</div>
        <div class="drivers">${t.drivers[0].name} · ${t.drivers[1].name}</div>
      </div>
      <div style="text-align:center;color:var(--dim);font-size:13px;margin-bottom:16px">
        Track: <b style="color:var(--text)">${track.name} — ${track.country}</b><br>
        Reverse grid · 1 mandatory stop · Half distance (${sprintLapCount(track)} laps)
      </div>
    `;
    contBtn.disabled = false;
    contBtn.textContent = 'Start qualifying';
    return;
  }

  picker.style.display = 'block';
  reveal.classList.add('hidden');
  contBtn.disabled = !SPRINT.trackId;
  contBtn.textContent = 'Continue';

  grid.innerHTML = TRACKS.map(t=>`
    <div class="sp-track ${SPRINT.trackId===t.id?'selected':''}" data-track="${t.id}">
      <div class="sp-track-name">${t.name}</div>
      <div class="sp-track-country">${t.country}</div>
      <div class="sp-track-meta">${sprintLapCount(t)} laps · ${t.trackTempC}°C</div>
    </div>
  `).join('');

  grid.querySelectorAll('[data-track]').forEach(el=>{
    el.addEventListener('click', ()=>{
      SPRINT.trackId = el.dataset.track;
      renderSprintSetup();
    });
  });
}

function sprintLapCount(track){
  return Math.max(SPRINT_CONSTANTS.minimumLaps, Math.round(track.laps * SPRINT_CONSTANTS.raceHalfRounded));
}

document.getElementById('btnSprintBack').addEventListener('click', ()=>{
  if(SPRINT && SPRINT.revealed){
    SPRINT.revealed = false;
    SPRINT.teamId = null;
    renderSprintSetup();
  } else {
    showScreen('screen-intro');
  }
});

document.getElementById('btnSprintContinue').addEventListener('click', ()=>{
  if(!SPRINT) return;
  if(!SPRINT.revealed){
    SPRINT.teamId = pick(TEAMS).id;
    SPRINT.revealed = true;
    renderSprintSetup();
    return;
  }
  startSprintWeekend();
});

function startSprintWeekend(){
  const track = TRACKS.find(x=>x.id===SPRINT.trackId);
  const team = TEAMS.find(x=>x.id===SPRINT.teamId);
  STATE = newGameState(team.id);
  STATE.season = 0;
  STATE.round = 0;

  const qualiGrid = simulateSprintQuali(track);
  const reversedGrid = [...qualiGrid].reverse();
  SPRINT.qualiGrid = qualiGrid;
  SPRINT.reversedGrid = reversedGrid;
  SPRINT.track = track;
  SPRINT.team = team;

  showSprintStrategyModal();
}

function simulateSprintQuali(track){
  const entries = [];
  TEAMS.forEach(team=>{
    const effPace = team.pace;
    team.drivers.forEach(drv=>{
      const form = randf(-2.5, 2.5) * tierFormScale(team.tier) * (1 - drv.skill/180);
      const q = effPace*0.6 + drv.skill*0.4 + form + randf(-2,2);
      entries.push({ abbr:drv.abbr, name:drv.name, num:drv.num, teamId:team.id, skill:drv.skill, consistency:drv.consistency, effPace, qualiScore:q });
    });
  });
  entries.sort((a,b)=>b.qualiScore-a.qualiScore);
  return entries;
}

function tierFormScale(tier){
  return { title:0.7, contender:1.0, midfield:1.3, backmarker:1.5 }[tier] || 1.0;
}

function showSprintStrategyModal(){
  const track = SPRINT.track;
  const team = SPRINT.team;
  const myDrivers = team.drivers;
  const strategy = {};
  myDrivers.forEach(d=>{ strategy[d.abbr] = { tyre: 'M', mode: 'balanced' }; });

  const renderBody = ()=> myDrivers.map(d=>{
    const gridPos = SPRINT.reversedGrid.findIndex(g=>g.abbr===d.abbr) + 1;
    const s = strategy[d.abbr];
    return `
    <div class="driver-strat">
      <div class="driver-strat-name">
        <span>${d.name}</span>
        <span style="color:var(--dim);font-size:11px">Grid P${gridPos}</span>
      </div>
      <div class="section-label">Starting tyre</div>
      <div class="tyre-select">
        ${['S','M','H'].map(c=>`
          <button class="tyre-btn compact ${s.tyre===c?'active':''}" data-abbr="${d.abbr}" data-tyre="${c}">
            <span class="tyre-circle tyre-${c}">${c}</span>
          </button>
        `).join('')}
      </div>
      <div class="section-label">Drive mode</div>
      <div class="mode-select">
        ${['attack','balanced','save'].map(m=>`
          <button class="mode-btn ${m} ${s.mode===m?'active':''}" data-abbr="${d.abbr}" data-mode="${m}">${m}</button>
        `).join('')}
      </div>
    </div>
    `;
  }).join('');

  openModal(`
    <h2>Sprint — ${track.name}</h2>
    <p style="font-size:12px;margin-bottom:12px">
      <b>Reverse grid</b> · <b>${sprintLapCount(track)} laps</b> · <b>1 mandatory stop</b>
    </p>
    <div class="warn-banner">⚠ <span>Sprint race: you must pit at least once, and must use a different compound than your start tyre.</span></div>
    <div id="sprintStratBody">${renderBody()}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="btnSprintSetupCancel">Cancel</button>
      <button class="btn btn-primary" id="btnSprintGo">Go racing</button>
    </div>
  `);
  const refresh = ()=>{ document.getElementById('sprintStratBody').innerHTML = renderBody(); bind(); };
  const bind = ()=>{
    document.querySelectorAll('#sprintStratBody .tyre-btn').forEach(b=>b.addEventListener('click', ()=>{
      strategy[b.dataset.abbr].tyre = b.dataset.tyre;
      refresh();
    }));
    document.querySelectorAll('#sprintStratBody .mode-btn').forEach(b=>b.addEventListener('click', ()=>{
      strategy[b.dataset.abbr].mode = b.dataset.mode;
      refresh();
    }));
  };
  bind();

  document.getElementById('btnSprintSetupCancel').addEventListener('click', ()=>{
    closeModal();
    showScreen('screen-intro');
  });

  document.getElementById('btnSprintGo').addEventListener('click', ()=>{
    closeModal();
    launchSprintRace(track, SPRINT.reversedGrid, strategy);
  });
}

function launchSprintRace(track, grid, strategy){
  RACE = buildRaceState(track, grid, { isSprint: true });
  RACE.drivers.forEach(d=>{
    d.usedCompounds = new Set();
    const s = strategy[d.abbr];
    d.tyre = s ? s.tyre : 'M';
    d.engineMode = s ? (s.mode || 'balanced') : 'balanced';
    d.usedCompounds.add(d.tyre);
    d.mustPit = true;
    d.hasPitted = false;
    d.nextPitLap = Math.round(RACE.laps * randf(0.42, 0.58));
  });
  RACE.drivers.forEach((d,i)=>{ d.startPosition = i+1; d.position = i+1; });
  trackAnimTime = 0;
  lapProgress = 0;
  showScreen('screen-race');
  initRaceUI(track);
  renderTower(); renderStrip(); renderPitBox();
  raceSpeed = 1; racePaused = false;
  updateSpeedButtons();
  lastSimTime = performance.now();
  startRenderLoop();
}

// ===================== HUB =====================
function myTeam(){ return TEAMS.find(t=>t.id===STATE.myTeamId); }
function teamById(id){ return TEAMS.find(t=>t.id===id); }
function driverByAbbr(abbr){
  for(const t of TEAMS){
    const d = t.drivers.find(x=>x.abbr===abbr);
    if(d) return { ...d, teamId: t.id, teamName: t.name, teamColor: t.color };
  }
  return null;
}
function currentTrack(){ return TRACKS[STATE.round] || null; }

function enterHub(){ renderHub(); showScreen('screen-hub'); }

function renderHub(){
  const team = myTeam();
  document.getElementById('hubTeamLabel').innerHTML = `<b style="color:${team.color}">${team.name}</b>`;
  document.getElementById('hubBudget').textContent = fmtMoney(STATE.budget);
  document.getElementById('hubSeason').textContent = STATE.season;
  document.getElementById('hubRound').textContent = Math.min(STATE.round+1, TRACKS.length);
  document.getElementById('hubTotalRounds').textContent = TRACKS.length;
  document.getElementById('btnSeasonHistory').onclick = openSeasonHistory;

  renderConfBox();
  renderObjectiveBox();

  const cons = getConstructorsStandings();
  const myConsPos = cons.findIndex(s=>s.teamId===team.id)+1;
  document.getElementById('sideConsPos').textContent = myConsPos ? `P${myConsPos}` : '—';
  const driv = getDriversStandings();
  const mine = driv.filter(d=>STATE.driverTeam[d.abbr]===team.id);
  document.getElementById('sideDrivPos').textContent = mine[0] ? `P${driv.indexOf(mine[0])+1}` : '—';
  document.getElementById('sidePace').textContent = effectiveTeamPace(team);
  document.getElementById('sideReli').textContent = team.reliability + STATE.carReliabilityBoost + STATE.upgrades.rel*2;
  document.getElementById('sideCap').textContent = `${fmtMoney(STATE.capUsed)} / ${fmtMoney(costCapForRaces(TRACKS.length))}`;

  renderHubMain();
}

function effectiveTeamPace(team){
  const base = team.pace + STATE.carPaceBoost + (STATE.upgrades.aero+STATE.upgrades.pu)*2;
  const sp = STATE.sponsors && STATE.sponsors.main;
  if(team.id === STATE.myTeamId && sp) return Math.round((base - sp.pacePenalty)*10)/10;
  return base;
}

function renderConfBox(){
  const c = STATE.boardConf;
  const col = c>60?'var(--green)':c>35?'var(--amber)':'var(--red)';
  const label = c>75?'Delighted':c>50?'Content':c>30?'Concerned':c>10?'Warning':'Critical';
  document.getElementById('confBox').innerHTML = `
    <div style="font-size:24px;font-weight:700;color:${col};font-family:'JetBrains Mono',monospace">${Math.round(c)}%</div>
    <div style="font-size:11.5px;color:var(--dim);margin-top:2px">${label}</div>
    <div class="conf-bar"><div class="conf-fill" style="width:${c}%;background:${col}"></div></div>
  `;
}
function renderObjectiveBox(){
  const team = myTeam();
  const obj = TIER_OBJECTIVES[team.tier];
  const cons = getConstructorsStandings();
  const myPos = cons.findIndex(s=>s.teamId===team.id)+1 || TEAMS.length;
  const racesLeft = TRACKS.length - STATE.round;
  let status='on-track', label='On track';
  if(STATE.round===0){ status='on-track'; label='Season not started'; }
  else if(myPos <= obj.conText){ status='met'; label='Meeting expectations'; }
  else if(myPos <= obj.conText+2){ status='at-risk'; label='At risk'; }
  else if(racesLeft<4){ status='failed'; label='Falling short'; }
  else { status='at-risk'; label='Behind target'; }
  document.getElementById('objectiveBox').innerHTML = `
    <div class="obj-item ${status}">
      <div class="obj-title">${obj.label}</div>
      <div class="obj-status">P${myPos} in constructors · ${label}</div>
    </div>
  `;
}
function getConstructorsStandings(){
  return TEAMS.map(t=>({teamId:t.id, points:STATE.constructorsPoints[t.id]||0})).sort((a,b)=>b.points-a.points);
}
function getDriversStandings(){
  return Object.entries(STATE.driversPoints).map(([abbr,points])=>({abbr,points})).sort((a,b)=>b.points-a.points);
}

function renderHubMain(){
  const main = document.getElementById('hubMain');
  if(STATE.round >= TRACKS.length){ main.innerHTML = renderSeasonEndHTML(); bindSeasonEnd(); return; }
  const track = currentTrack();
  const aduo = latestAduoResult();
  const isWetWeekend = STATE.wetWeekends && STATE.wetWeekends.includes(STATE.round);

  main.innerHTML = `
    ${aduo ? `
      <div class="aduo-card">
        <div class="label">ADUO Review — Round ${aduo.round}</div>
        <div class="headline">${aduo.myTeamMessage}</div>
        <div class="detail">${aduo.detail}</div>
      </div>
    ` : ''}

    <div class="hub-section">
      <div class="next-race-card">
        <div class="nrc-left">
          <div class="nrc-line-1">
            <span class="nrc-round">ROUND ${STATE.round+1}</span>
            <span class="nrc-name">${track.name} — ${track.country}</span>
            ${isWetWeekend ? '<span class="team-tier tier-midfield" style="font-size:9px">🌧 WET WEEKEND</span>' : ''}
          </div>
          <div class="nrc-meta">
            <span>🌡 ${track.tempC}°C / ${track.trackTempC}°C</span>
            <span>💨 ${track.windKmh} km/h</span>
            <span>${weatherLabel(track, isWetWeekend)}</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="btnStartWeekend">Go to pit wall</button>
      </div>
    </div>

    <div class="hub-section">
      <div class="hub-section-title">Sponsors</div>
      ${renderSponsorCards()}
    </div>

    <div class="hub-section">
      <div class="hub-section-title">Standings</div>
      <div class="standings-toggle">
        <button data-view="constructors" class="active">Constructors</button>
        <button data-view="drivers">Drivers</button>
      </div>
      <div id="standingsBox"></div>
    </div>

    <div class="hub-section">
      <div class="hub-section-title">Engineering staff</div>
      <div class="roster-grid" id="rosterGrid"></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="btnOpenHiring">Candidates</button>
        <button class="btn btn-ghost btn-sm" id="btnOpenUpgrades">Develop car</button>
        <button class="btn btn-ghost btn-sm" id="btnOpenMarket">Driver market</button>
      </div>
    </div>
  `;

  document.getElementById('btnStartWeekend').addEventListener('click', ()=>startWeekend());
  document.getElementById('btnOpenHiring').addEventListener('click', openHiringModal);
  document.getElementById('btnOpenUpgrades').addEventListener('click', openUpgradesModal);
  document.getElementById('btnOpenMarket').addEventListener('click', openMarketModal);

  document.querySelectorAll('.standings-toggle button').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('.standings-toggle button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    renderStandings(b.dataset.view);
  }));
  renderStandings('constructors');

  const rosterGrid = document.getElementById('rosterGrid');
  Object.values(STATE.engineers).forEach(e=>{
    const card = document.createElement('div');
    card.className = 'eng-card';
    card.innerHTML = `
      <div class="eng-name">${e.name}</div>
      <div class="eng-role">${e.roleLabel}</div>
      <div class="eng-bars">
        <div class="eng-bar-row"><span style="width:44px;">Skill</span>
          <div class="eng-bar-track"><div class="eng-bar-fill" style="width:${e.skill}%;background:${skillColor(e.skill)}"></div></div>
          <span>${e.skill}</span>
        </div>
      </div>
    `;
    rosterGrid.appendChild(card);
  });
}

function renderSponsorCards(){
  const sp = STATE.sponsors;
  if(!sp || !sp.main) return '';
  const spDef = MAIN_SPONSORS.find(x=>x.id===sp.main.id) || sp.main;
  const renewalPct = Math.round((sp.main.renewalModifier || 1) * 100);
  const renewalNote = renewalPct < 100 ? ` · <span style="color:var(--red)">renewal at ${renewalPct}%</span>` : '';
  let mainCard = `
    <div class="sponsor-card">
      <div class="sc-top">
        <div class="sc-name">${spDef.name}</div>
        <div class="sc-amount">${fmtMoney(spDef.perRace)}/race</div>
      </div>
      <div class="sc-task">
        Pace penalty: <b>${spDef.pacePenalty>0?'-'+spDef.pacePenalty:'none'}</b>${renewalNote}<br>
        Season task fires at the final round: both cars must finish in the points, or renewal drops 40%.
      </div>
    </div>
  `;
  const events = EVENT_SPONSORS.map(ev=>{
    const s = sp.events[ev.id];
    if(!s) return '';
    const cls = s.claimed ? 'claimed' : s.failed ? 'failed' : '';
    const status = s.claimed ? '<span style="color:var(--green);font-weight:700">Claimed ✓</span>'
                 : s.failed ? '<span style="color:var(--red);font-weight:700">Failed</span>'
                 : '<span style="color:var(--dim)">Pending</span>';
    return `
      <div class="sponsor-card ${cls}">
        <div class="sc-top">
          <div class="sc-name">${ev.name}</div>
          <div style="font-size:11.5px;color:var(--dim)">${status}</div>
        </div>
        <div class="sc-task"><b>${ev.task}</b> — ${ev.reward}</div>
      </div>
    `;
  }).join('');
  return mainCard + events;
}

function latestAduoResult(){
  if(!STATE.aduoHistory || STATE.aduoHistory.length === 0) return null;
  return STATE.aduoHistory[STATE.aduoHistory.length - 1];
}

function runAduoReviewIfNeeded(){
  const roundNum = STATE.round + 1;
  if(!ADUO_REVIEW_ROUNDS.includes(roundNum)) return;
  if(!STATE.aduoReviewsDone) STATE.aduoReviewsDone = [];
  if(STATE.aduoReviewsDone.includes(roundNum)) return;
  STATE.aduoReviewsDone.push(roundNum);

  const teams = TEAMS.map(t => ({ id: t.id, pace: t.pace + (t.id===STATE.myTeamId ? STATE.carPaceBoost : 0) }));
  const leader = teams.reduce((a,b) => a.pace > b.pace ? a : b);

  const results = [];
  teams.forEach(t => {
    const gapPct = (1 - t.pace / leader.pace) * 100;
    if(gapPct >= 2){
      const tier = ADUO_TIERS.find(x => gapPct >= x.min);
      if(!tier) return;
      results.push({ teamId: t.id, gapPct, allowance: tier.allowance, upgrades: tier.upgrades });
      if(t.id === STATE.myTeamId){
        STATE.budget += tier.allowance;
        STATE.upgrades.pu += tier.upgrades;
      } else {
        const team = TEAMS.find(x => x.id === t.id);
        if(team) team.pace += tier.upgrades * 0.4;
      }
    }
  });

  let myTeamMessage = 'No ADUO — you are the benchmark.';
  let detail = `${results.length} team(s) received development allowances.`;
  const mine = results.find(r => r.teamId === STATE.myTeamId);
  if(mine){
    myTeamMessage = `You qualified for ADUO (+${fmtMoney(mine.allowance)}, +${mine.upgrades} PU upgrade)`;
    detail = `Gap to benchmark: ${mine.gapPct.toFixed(2)}%. Allowance added to your budget.`;
  }

  STATE.aduoHistory.push({ round: roundNum, results, myTeamMessage, detail });
}

// ===================== STANDINGS RENDER =====================
function renderStandings(view){
  const box = document.getElementById('standingsBox');
  if(!box) return;
  if(view === 'constructors'){
    const cons = getConstructorsStandings();
    box.innerHTML = `
      <table class="standings-table">
        <thead><tr><th>Pos</th><th>Team</th><th>Points</th></tr></thead>
        <tbody>
          ${cons.map((s,i)=>{
            const t = teamById(s.teamId);
            return `<tr class="${t.id===STATE.myTeamId?'me':''}">
              <td class="pos">${i+1}</td>
              <td><span class="team-pill" style="background:${t.color}"></span>${t.name}</td>
              <td class="pts">${s.points}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } else {
    const driv = getDriversStandings();
    box.innerHTML = `
      <table class="standings-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Points</th></tr></thead>
        <tbody>
          ${driv.map((s,i)=>{
            const d = driverByAbbr(s.abbr);
            if(!d) return '';
            const isMe = d.teamId === STATE.myTeamId;
            return `<tr class="clickable ${isMe?'me':''}" data-driver="${s.abbr}">
              <td class="pos">${i+1}</td>
              <td>${d.name}</td>
              <td><span class="team-pill" style="background:${d.teamColor}"></span>${d.teamName}</td>
              <td class="pts">${s.points}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
    box.querySelectorAll('[data-driver]').forEach(tr=>{
      tr.addEventListener('click', ()=>openDriverProfile(tr.dataset.driver));
    });
  }
}

function skillColor(s){ return s>=85?'var(--green)':s>=65?'var(--cyan)':s>=45?'var(--amber)':'var(--red)'; }
function weatherLabel(t, isWetWeekend){
  if(isWetWeekend) return '🌧 Wet weekend forecast';
  if(t.baseline==='wet-drying') return '🌧 Starts wet, drying';
  if(t.baseline==='dry-threat') return '⛅ Rain forecast arriving';
  return '☀️ Dry forecast';
}

function renderSeasonEndHTML(){
  const cons = getConstructorsStandings();
  const myPos = cons.findIndex(s=>s.teamId===STATE.myTeamId)+1;
  const obj = TIER_OBJECTIVES[myTeam().tier];
  const met = myPos <= obj.conText;
  return `
    <div class="hub-section">
      <div class="hub-section-title">Season ${STATE.season} complete</div>
      <div class="next-race-card" style="border-color:${met?'var(--green)':'var(--red)'}">
        <div class="nrc-left">
          <div class="nrc-line-1">
            <span class="nrc-round" style="color:${met?'var(--green)':'var(--red)'}">${met?'OBJECTIVE MET':'OBJECTIVE MISSED'}</span>
            <span class="nrc-name">Finished P${myPos} — ${obj.label}</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="btnNextSeason">Start season ${STATE.season+1}</button>
      </div>
    </div>
    <div class="hub-section">
      <div class="hub-section-title">Final standings</div>
      <table class="standings-table">
        <thead><tr><th>Pos</th><th>Team</th><th>Points</th></tr></thead>
        <tbody>
          ${cons.map((s,i)=>{
            const t = teamById(s.teamId);
            return `<tr class="${t.id===STATE.myTeamId?'me':''}"><td class="pos">${i+1}</td><td><span class="team-pill" style="background:${t.color}"></span>${t.name}</td><td class="pts">${s.points}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
function bindSeasonEnd(){
  document.getElementById('btnNextSeason')?.addEventListener('click', advanceSeason);
}
function advanceSeason(){
  finalizeSeasonHistory();
  STATE.season++;
  STATE.round = 0;
  STATE.capUsed = 0;
  STATE.constructorsPoints = Object.fromEntries(TEAMS.map(t=>[t.id,0]));
  STATE.driversPoints = Object.fromEntries(TEAMS.flatMap(t=>t.drivers.map(d=>[d.abbr,0])));
  STATE.pendingGridPenalties = {};
  STATE.budget += (SEASON_END_BONUS[myTeam().tier] || 40);
  Object.values(STATE.engineers).forEach(e=>{ e.skill = clamp(e.skill + rand(0,3), 20, 99); });
  TEAMS.forEach(t=>{
    t.drivers.forEach(d=>{
      STATE.driverSeasonStats[d.abbr] = { points:0, wins:0, podiums:0, poles:0, fastestLaps:0, dnfs:0, ratings:[] };
    });
  });
  STATE.aduoReviewsDone = [];
  STATE.wetWeekends = rollWetWeekends();
  // Reset event sponsors for new season
  if(STATE.sponsors && STATE.sponsors.events){
    Object.keys(STATE.sponsors.events).forEach(k=>{
      STATE.sponsors.events[k] = { claimed:false, failed:false, progress:0 };
    });
  }
  // Apply renewal modifier from previous season's finale if it was triggered
  if(STATE.sponsors && STATE.sponsors.main){
    const spDef = MAIN_SPONSORS.find(x=>x.id===STATE.sponsors.main.id);
    if(spDef){
      const mod = STATE.sponsors.main.renewalModifier || 1.0;
      STATE.sponsors.main = {
        ...spDef,
        annual: spDef.annual * mod,
        perRace: spDef.perRace * mod,
        renewalModifier: 1.0,
      };
    }
  }
  recalcCarBoosts();
  saveToSlot(activeSlot);
  renderHub();
}

// ===================== SEASON HISTORY =====================
function ensureCurrentSeasonEntry(){
  if(!STATE.seasonHistory) STATE.seasonHistory = [];
  const idx = STATE.season - 1;
  if(!STATE.seasonHistory[idx]){
    STATE.seasonHistory[idx] = {
      season: STATE.season,
      races: new Array(TRACKS.length).fill(null),
      championTeam: null,
      championDriver: null,
      finalStandings: null,
    };
  }
  return STATE.seasonHistory[idx];
}
function finalizeSeasonHistory(){
  const entry = ensureCurrentSeasonEntry();
  entry.championTeam = getConstructorsStandings()[0].teamId;
  entry.championDriver = getDriversStandings()[0].abbr;
  entry.finalStandings = {
    constructors: getConstructorsStandings(),
    drivers: getDriversStandings(),
  };
}
function openSeasonHistory(){
  document.getElementById('seasonHistory').classList.add('active');
  renderSeasonTabs();
  renderSeasonRaces(STATE.season - 1);
  document.getElementById('btnCloseSeasonHistory').onclick = ()=>{
    document.getElementById('seasonHistory').classList.remove('active');
  };
}
function renderSeasonTabs(){
  const tabs = document.getElementById('shTabs');
  const completedSeasons = (STATE.seasonHistory || []).filter(Boolean).length;
  const totalSeasons = Math.max(completedSeasons, STATE.season - 1) + 1;
  let html = '';
  for(let i=0; i<totalSeasons; i++){
    const sNum = i + 1;
    const isActive = (i === STATE.season - 1);
    html += `<button class="sh-tab ${isActive?'active':''}" data-season-idx="${i}">Season ${sNum}</button>`;
  }
  tabs.innerHTML = html;
  tabs.querySelectorAll('[data-season-idx]').forEach(b=>b.addEventListener('click', ()=>{
    tabs.querySelectorAll('.sh-tab').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    renderSeasonRaces(parseInt(b.dataset.seasonIdx));
  }));
}
function renderSeasonRaces(seasonIdx){
  const body = document.getElementById('shBody');
  const entry = (STATE.seasonHistory || [])[seasonIdx];
  const isCurrent = seasonIdx === STATE.season - 1;
  const rows = TRACKS.map((track, i)=>{
    const race = entry && entry.races ? entry.races[i] : null;
    const roundNum = i + 1;
    if(race){
      const winnerName = driverByAbbr(race.winnerAbbr)?.name || race.winnerAbbr;
      const yourBestName = race.yourBestAbbr ? (driverByAbbr(race.yourBestAbbr)?.name || race.yourBestAbbr) : '—';
      return `
        <div class="sh-race clickable" data-season-idx="${seasonIdx}" data-race-idx="${i}">
          <span class="sh-race-round">R${roundNum}</span>
          <span class="sh-race-name">${track.name}</span>
          <span class="sh-race-meta">
            <span>Winner: <b>${winnerName}</b></span>
            <span>Your best: <b>${yourBestName}</b>${race.yourBestPos?' (P'+race.yourBestPos+')':''}</span>
          </span>
        </div>
      `;
    } else if(isCurrent && i === STATE.round){
      return `
        <div class="sh-race">
          <span class="sh-race-round">R${roundNum}</span>
          <span class="sh-race-name">${track.name}</span>
          <span class="sh-race-meta"><span style="color:var(--cyan)">Next race</span></span>
        </div>
      `;
    } else {
      return `
        <div class="sh-race pending">
          <span class="sh-race-round">R${roundNum}</span>
          <span class="sh-race-name">${track.name}</span>
          <span class="sh-race-meta"><span>Upcoming</span></span>
        </div>
      `;
    }
  }).join('');
  body.innerHTML = rows;
  body.querySelectorAll('[data-race-idx]').forEach(el=>{
    el.addEventListener('click', ()=>{
      openRaceDetail(parseInt(el.dataset.seasonIdx), parseInt(el.dataset.raceIdx));
    });
  });
}
function openRaceDetail(seasonIdx, raceIdx){
  const entry = (STATE.seasonHistory || [])[seasonIdx];
  if(!entry || !entry.races[raceIdx]) return;
  const race = entry.races[raceIdx];
  const rows = race.classification.map(c=>{
    const ratingClass = c.rating >= 7.5 ? 'rating-high' : c.rating >= 5 ? 'rating-mid' : 'rating-low';
    const isMe = c.teamId === STATE.myTeamId;
    return `
      <div class="rd-row ${isMe?'me':''} ${c.retired?'dnf':''}">
        <span class="rd-pos">${c.retired ? 'DNF' : 'P'+c.pos}</span>
        <div>
          <div class="rd-name">${c.name}</div>
          <div class="rd-team">${c.teamName}</div>
        </div>
        <span class="rd-rating ${ratingClass}">${c.rating.toFixed(1)}</span>
      </div>
    `;
  }).join('');
  openModal(`
    <h2>${race.trackName} — Round ${raceIdx+1}</h2>
    <p style="font-size:12px;margin-bottom:8px">
      <b>Fastest lap:</b> ${race.fastestLapName || '—'} &nbsp;·&nbsp;
      <b>Biggest mover:</b> ${race.biggestMoverName || '—'} ${race.biggestMoverPlaces?'('+race.biggestMoverPlaces+' places)':''}
    </p>
    <div class="race-detail-classification">${rows}</div>
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="btnRaceDetailClose">Close</button></div>
  `);
  document.getElementById('btnRaceDetailClose').addEventListener('click', closeModal);
}

// ===================== DRIVER PROFILE =====================
function openDriverProfile(abbr){
  const d = driverByAbbr(abbr);
  if(!d) return;
  const stats = STATE.driverSeasonStats[abbr] || { points:0, wins:0, podiums:0, poles:0, fastestLaps:0, dnfs:0, ratings:[] };
  const ratings = stats.ratings || [];
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0) / ratings.length) : 0;
  const last5 = ratings.slice(-5);
  const formDots = last5.map(r=>{
    const col = r >= 7.5 ? 'var(--green)' : r >= 5 ? 'var(--amber)' : 'var(--red)';
    const bg = r >= 7.5 ? 'rgba(95,184,120,0.18)' : r >= 5 ? 'rgba(232,169,58,0.18)' : 'rgba(196,69,61,0.18)';
    return `<span style="background:${bg};color:${col};width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace">${r.toFixed(1)}</span>`;
  }).join('');
  openModal(`
    <div class="driver-profile">
      <div class="dp-header">
        <div class="dp-name">${d.name}</div>
        <div class="dp-sub">#${d.num} · <span style="color:${d.teamColor}">${d.teamName}</span></div>
      </div>
      <div class="dp-rating-big">
        <div>
          <div class="l">Average rating this season</div>
          <div class="v" style="color:${avg>=7.5?'var(--green)':avg>=5?'var(--amber)':'var(--red)'}">${avg.toFixed(1)}</div>
        </div>
        <div>
          <div class="l">Races rated</div>
          <div class="v">${ratings.length}</div>
        </div>
      </div>
      <div class="dp-stats">
        <div class="dp-stat"><div class="v">${stats.points}</div><div class="l">Points</div></div>
        <div class="dp-stat"><div class="v">${stats.wins}</div><div class="l">Wins</div></div>
        <div class="dp-stat"><div class="v">${stats.podiums}</div><div class="l">Podiums</div></div>
        <div class="dp-stat"><div class="v">${stats.poles}</div><div class="l">Poles</div></div>
        <div class="dp-stat"><div class="v">${stats.fastestLaps}</div><div class="l">Fastest laps</div></div>
        <div class="dp-stat"><div class="v">${stats.dnfs}</div><div class="l">DNFs</div></div>
      </div>
      ${last5.length ? `
        <div>
          <div style="font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:0.4px;font-weight:700;margin-bottom:6px">Last 5 races</div>
          <div style="display:flex;gap:6px">${formDots}</div>
        </div>
      ` : ''}
      <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="btnDriverProfileClose">Close</button></div>
    </div>
  `);
  document.getElementById('btnDriverProfileClose').addEventListener('click', closeModal);
}

// ===================== HIRING =====================
function generateCandidates(){
  const team = myTeam();
  const tierBase = { title:70, contender:58, midfield:48, backmarker:38 }[team.tier];
  const list = [];
  for(let i=0;i<5;i++){
    const role = pick(ENGINEER_ROLES);
    const skill = clamp(tierBase + rand(-10,28), 20, 99);
    const cost = Math.round(8 + skill*0.9 + rand(-4,6));
    list.push({ id:'cand_'+Date.now()+'_'+i, name: randName(), role: role.key, roleLabel: role.label, affects: role.affects, skill, cost: Math.max(5,cost) });
  }
  return list;
}
function openHiringModal(){
  if(STATE.candidates.length===0) STATE.candidates = generateCandidates();
  renderHiringModal();
}
function renderHiringModal(){
  openModal(`
    <h2>Engineering candidates</h2>
    <p>Budget: <b style="color:var(--amber)">${fmtMoney(STATE.budget)}</b>. Hiring replaces your current engineer in that role.</p>
    <div id="candidateList"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="btnRefreshCandidates">Refresh ($5M)</button>
      <button class="btn btn-primary btn-sm" id="btnCloseHiring">Done</button>
    </div>
  `);
  const list = document.getElementById('candidateList');
  STATE.candidates.forEach(c=>{
    const cur = STATE.engineers[c.role];
    const upgrade = c.skill > cur.skill;
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.innerHTML = `
      <div class="candidate-info">
        <div class="candidate-name">${c.name}</div>
        <div class="candidate-role">${c.roleLabel}</div>
        <div class="candidate-stats">
          <span class="team-stat-mini">SKILL <b style="color:${skillColor(c.skill)}">${c.skill}</b></span>
          <span class="team-stat-mini">CURRENT <b>${cur.skill}</b></span>
          <span class="candidate-cost">$${c.cost}M</span>
        </div>
      </div>
      <button class="btn btn-sm ${upgrade?'btn-primary':'btn-ghost'}" data-cand="${c.id}" ${STATE.budget<c.cost?'disabled':''}>Hire</button>
    `;
    list.appendChild(card);
  });
  list.querySelectorAll('button[data-cand]').forEach(b=>b.addEventListener('click', ()=>hireCandidate(b.dataset.cand)));
  document.getElementById('btnCloseHiring').addEventListener('click', ()=>{ closeModal(); renderHub(); });
  document.getElementById('btnRefreshCandidates').addEventListener('click', ()=>{
    if(STATE.budget < 5) return;
    STATE.budget -= 5;
    STATE.candidates = generateCandidates();
    saveToSlot(activeSlot);
    renderHiringModal();
  });
}
function hireCandidate(id){
  const c = STATE.candidates.find(x=>x.id===id);
  if(!c || STATE.budget < c.cost) return;
  STATE.budget -= c.cost;
  STATE.engineers[c.role] = { id:c.id, name:c.name, role:c.role, roleLabel:c.roleLabel, affects:c.affects, skill:c.skill };
  recalcCarBoosts();
  STATE.candidates = STATE.candidates.filter(x=>x.id!==id);
  saveToSlot(activeSlot);
  renderHiringModal();
}
function recalcCarBoosts(){
  const a = STATE.engineers.aero.skill;
  const p = STATE.engineers.perf.skill;
  const r = STATE.engineers.reliability.skill;
  STATE.carPaceBoost = Math.round(((a-60)+(p-60))/2 / 6);
  STATE.carReliabilityBoost = Math.round((r-60)/6);
}

// ===================== UPGRADES =====================
function openUpgradesModal(){
  const slots = ['aero','pu','rel','strat'];
  const labels = { aero:'Aero Package', pu:'Power Unit', rel:'Reliability', strat:'Strategy Dept' };
  const cost = lvl => 15 + lvl*10;
  const cap = costCapForRaces(TRACKS.length);
  const render = ()=> openModal(`
    <h2>Car development</h2>
    <p>Budget: <b style="color:var(--amber)">${fmtMoney(STATE.budget)}</b> · Cost cap used <b>${fmtMoney(STATE.capUsed)} / ${fmtMoney(cap)}</b></p>
    <p style="font-size:11.5px">Upgrades take 2 races to arrive. New engines may trigger a grid penalty.</p>
    ${STATE.pendingUpgrades.map(u=>`<div class="save-slot"><div><div style="font-weight:700">${labels[u.slot]} +2</div><div class="meta">Arrives in ${u.arrivesInRace - STATE.round} races</div></div></div>`).join('')}
    ${slots.map(s=>{
      const lvl = STATE.upgrades[s];
      const c = cost(lvl);
      const canDo = STATE.budget >= c && STATE.capUsed + c <= cap;
      const reason = STATE.capUsed + c > cap ? 'Cost cap hit' : (STATE.budget < c ? 'No budget' : '');
      const warning = (s==='pu') ? ' ⚠ may incur grid penalty' : '';
      return `<div class="save-slot">
        <div>
          <div style="font-weight:700">${labels[s]}${warning}</div>
          <div class="meta">Level ${lvl} · Next: $${c}M ${reason?`(${reason})`:''}</div>
        </div>
        <button class="btn btn-sm ${canDo?'btn-primary':'btn-ghost'}" data-up="${s}" ${canDo?'':'disabled'}>Develop +2</button>
      </div>`;
    }).join('')}
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="btnCloseUpgrades">Close</button></div>
  `);
  render();
  const bind = ()=>{
    document.querySelectorAll('[data-up]').forEach(b=>b.addEventListener('click', ()=>{
      const s = b.dataset.up;
      const c = cost(STATE.upgrades[s]);
      if(STATE.budget < c || STATE.capUsed + c > cap) return;
      STATE.budget -= c;
      STATE.capUsed += c;
      STATE.pendingUpgrades.push({ slot:s, arrivesInRace: STATE.round + 2, amount: 2 });
      if(s==='pu' && Math.random() < 0.6){
        const t = myTeam();
        t.drivers.forEach(drv=>{
          STATE.pendingGridPenalties[drv.abbr] = (STATE.pendingGridPenalties[drv.abbr] || 0) + 5;
        });
      }
      saveToSlot(activeSlot);
      render(); bind();
    }));
    document.getElementById('btnCloseUpgrades').addEventListener('click', ()=>{ closeModal(); renderHub(); });
  };
  bind();
}
function applyPendingUpgrades(){
  STATE.pendingUpgrades = STATE.pendingUpgrades.filter(u=>{
    if(STATE.round >= u.arrivesInRace){ STATE.upgrades[u.slot] += u.amount; return false; }
    return true;
  });
}

// ===================== DRIVER MARKET =====================
function openMarketModal(){
  if(STATE.marketOffers.length===0) STATE.marketOffers = generateMarketOffers();
  openModal(`
    <h2>Driver market</h2>
    <p>Swap one of your drivers for a free agent.</p>
    <div id="marketList"></div>
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="btnCloseMarket">Close</button></div>
  `);
  const list = document.getElementById('marketList');
  STATE.marketOffers.forEach(o=>{
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.innerHTML = `
      <div class="candidate-info">
        <div class="candidate-name">${o.name}</div>
        <div class="candidate-role">Free agent · ${o.skill} skill</div>
        <div class="candidate-stats">
          <span class="team-stat-mini">CONSISTENCY <b>${o.consistency}</b></span>
          <span class="candidate-cost">$${o.cost}M</span>
        </div>
      </div>
      <button class="btn btn-sm ${STATE.budget>=o.cost?'btn-primary':'btn-ghost'}" data-offer="${o.id}" ${STATE.budget<o.cost?'disabled':''}>Sign</button>
    `;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-offer]').forEach(b=>b.addEventListener('click', ()=>{
    const o = STATE.marketOffers.find(x=>x.id===b.dataset.offer);
    if(!o || STATE.budget < o.cost) return;
    const team = myTeam();
    const weakest = team.drivers.slice().sort((a,b)=>a.skill-b.skill)[0];
    if(!confirm(`Replace ${weakest.name} with ${o.name}?`)) return;
    STATE.budget -= o.cost;
    const idx = team.drivers.indexOf(weakest);
    team.drivers[idx] = { name:o.name, abbr:o.abbr, num:o.num, skill:o.skill, consistency:o.consistency };
    delete STATE.driversPoints[weakest.abbr];
    STATE.driversPoints[o.abbr] = 0;
    STATE.driverTeam[o.abbr] = team.id;
    delete STATE.driverTeam[weakest.abbr];
    STATE.driverSeasonStats[o.abbr] = { points:0, wins:0, podiums:0, poles:0, fastestLaps:0, dnfs:0, ratings:[] };
    STATE.marketOffers = STATE.marketOffers.filter(x=>x.id!==o.id);
    saveToSlot(activeSlot);
    closeModal(); renderHub();
  }));
  document.getElementById('btnCloseMarket').addEventListener('click', closeModal);
}
function generateMarketOffers(){
  const pool = [
    { name:'Daniel Ricciardo', abbr:'RIC', num:9,  skill:82, consistency:82, cost:18 },
    { name:'Mick Schumacher',  abbr:'MSC', num:47, skill:76, consistency:76, cost:12 },
    { name:'Zhou Guanyu',      abbr:'ZHO', num:24, skill:77, consistency:78, cost:13 },
    { name:'Kevin Magnussen',  abbr:'MAG', num:20, skill:79, consistency:79, cost:14 },
    { name:'Jack Doohan',      abbr:'DOO', num:7,  skill:74, consistency:74, cost:10 },
    { name:'Theo Pourchaire',  abbr:'POU', num:98, skill:73, consistency:73, cost:9  },
    { name:'Robert Shwartzman',abbr:'SHW', num:35, skill:75, consistency:76, cost:11 },
    { name:'Felipe Drugovich', abbr:'DRU', num:34, skill:75, consistency:75, cost:11 },
  ];
  return pool.sort(()=>Math.random()-0.5).slice(0,4).map((p,i)=>({ ...p, id:'off_'+Date.now()+'_'+i }));
}

// ===================== DRIVER RATING =====================
function computeDriverRating(entry){
  if(entry.retired) return 1.0;
  let r = 10 - (entry.finishPos - 1) * 0.4;
  const gained = entry.startPos - entry.finishPos;
  if(gained >= 5) r += 1.0;
  else if(gained <= -5) r -= 1.0;
  if(entry.hadContact) r -= 2.0;
  if(entry.fastestLap) r += 0.5;
  return clamp(r, 1.0, 10.0);
}

// ===================== RACE SIM =====================
const POINTS_TABLE = [25,18,15,12,10,8,6,4,2,1];
const BASE_LAP = 90;

let RACE = null;
let rafId = null;
let raceSpeed = 1;
let racePaused = false;
let lastSimTime = 0;
let lapProgress = 0;
const BASE_LAPS_PER_SEC = 0.105;

let trackAnimTime = 0;
let lastAnimFrame = 0;

const PACE_SCALE = 0.20;
const TRACK_POINT_CACHE = {};

// ============ SVG PARSING + STRAIGHT DETECTION ============
function sampleSvgPath(dString, numSamples){
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '500');
  svg.setAttribute('height', '500');
  svg.setAttribute('viewBox', '0 0 500 500');
  svg.style.position = 'absolute';
  svg.style.left = '-9999px';
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', dString);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const totalLength = path.getTotalLength();
  const pts = [];
  for(let i=0; i<numSamples; i++){
    const pt = path.getPointAtLength((i / numSamples) * totalLength);
    pts.push({ x: pt.x, y: pt.y });
  }
  document.body.removeChild(svg);
  return pts;
}
function normalisePoints(points, padding){
  padding = padding || 0.08;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for(const p of points){
    if(p.x < minX) minX = p.x;
    if(p.x > maxX) maxX = p.x;
    if(p.y < minY) minY = p.y;
    if(p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX, h = maxY - minY;
  const size = Math.max(w, h);
  const offX = (size - w) / 2;
  const offY = (size - h) / 2;
  return points.map(p => ({
    x: padding + ((p.x - minX + offX) / size) * (1 - padding * 2),
    y: padding + ((p.y - minY + offY) / size) * (1 - padding * 2),
  }));
}
function buildCumulativePoints(points){
  let total = 0;
  const cum = [0];
  for(let i=1; i<points.length; i++){
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    total += Math.hypot(dx, dy);
    cum.push(total);
  }
  const dx = points[0].x - points[points.length-1].x;
  const dy = points[0].y - points[points.length-1].y;
  total += Math.hypot(dx, dy);
  cum.push(total);
  return { cum, total };
}
// Find the longest collinear run of points = start/finish straight
function findLongestStraight(points){
  const N = points.length;
  if(N < 8) return { start:0, end:0 };
  let bestLen = 0, bestStart = 0;
  let runStart = 0;
  for(let i = 1; i < N; i++){
    const p0 = points[runStart];
    const p1 = points[i];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    let collinear = true;
    if(len > 0){
      const ux = dx/len, uy = dy/len;
      // Check middle points stay within a small cross-track tolerance
      for(let j = runStart+1; j < i; j++){
        const pj = points[j];
        const vx = pj.x - p0.x, vy = pj.y - p0.y;
        const cross = Math.abs(vx * uy - vy * ux);
        if(cross > 0.012){ collinear = false; break; }
      }
    }
    if(!collinear){
      if(i - runStart > bestLen){ bestLen = i - runStart; bestStart = runStart; }
      runStart = i - 1;
    }
  }
  if(N - runStart > bestLen){ bestLen = N - runStart; bestStart = runStart; }
  return { start: bestStart, end: bestStart + bestLen };
}
function getTrackData(track){
  if(TRACK_POINT_CACHE[track.id]) return TRACK_POINT_CACHE[track.id];
  if(!track.svgPath){ TRACK_POINT_CACHE[track.id] = null; return null; }
  const raw = sampleSvgPath(track.svgPath, 400);
  const norm = normalisePoints(raw, 0.08);
  const { cum, total } = buildCumulativePoints(norm);
  const straight = findLongestStraight(norm);
  const sfIndex = straight.start;
  const sfFraction = cum[sfIndex] / total;
  const result = { points: norm, cum, total, sfFraction, sfIndex };
  TRACK_POINT_CACHE[track.id] = result;
  return result;
}
function positionAtFraction(points, cum, total, frac){
  frac = ((frac % 1) + 1) % 1;
  const target = frac * total;
  for(let i=1; i<cum.length; i++){
    if(cum[i] >= target){
      const segStart = cum[i-1];
      const segLen = cum[i] - segStart;
      const t = segLen > 0 ? (target - segStart) / segLen : 0;
      const a = points[i-1];
      const b = points[i] || points[0];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return points[points.length - 1];
}

// ============ WEATHER ============
function buildWeather(track, laps, isWetWeekend, isSprint){
  const curve = [];
  let pattern = 'dry';
  const radarAt = [];

  if(isSprint){
    if(isWetWeekend){
      const r = Math.random();
      if(r < 0.5){
        pattern = 'wet_drying';
        for(let l=0;l<laps;l++) curve.push(clamp(1 - (l/(laps*0.55)), 0, 1));
      } else {
        pattern = 'dry_wet';
        const rainLap = Math.floor(laps * randf(0.3, 0.6));
        for(let l=0;l<laps;l++){
          if(l < rainLap) curve.push(0);
          else curve.push(clamp((l-rainLap)/3, 0, 0.9));
        }
        radarAt.push(Math.max(0, rainLap - 3));
      }
    } else {
      for(let l=0;l<laps;l++) curve.push(0);
    }
    return { curve, pattern, radarAt };
  }

  const flipCapable = FLIP_CAPABLE_IDS.includes(track.id);

  if(isWetWeekend){
    const r = Math.random();
    if(r < 0.45){
      pattern = 'wet_drying';
      const dryAt = Math.max(6, Math.floor(laps * randf(0.2, 0.4)));
      for(let l=0;l<laps;l++) curve.push(clamp(1 - l/dryAt, 0, 1));
    } else if(r < 0.80){
      pattern = 'dry_wet';
      const rainLap = Math.floor(laps * randf(0.2, 0.55));
      for(let l=0;l<laps;l++){
        if(l < rainLap) curve.push(0);
        else curve.push(clamp((l-rainLap)/3, 0, 0.9));
      }
      radarAt.push(Math.max(0, rainLap - 3));
    } else {
      pattern = 'full_wet';
      for(let l=0;l<laps;l++) curve.push(randf(0.65, 0.9));
    }
    return { curve, pattern, radarAt };
  }

  if(track.baseline === 'wet-drying'){
    pattern = 'wet_drying';
    for(let l=0;l<laps;l++) curve.push(clamp(1 - (l/laps)/0.55, 0, 1));
    return { curve, pattern, radarAt };
  }

  if(track.baseline === 'dry-threat'){
    const arrives = Math.random() < track.rainChance * 1.3;
    if(!arrives){
      for(let l=0;l<laps;l++) curve.push(0);
      return { curve, pattern: 'dry', radarAt };
    }
    const rainLap = Math.floor(laps * randf(0.3, 0.75));
    pattern = flipCapable ? 'dry_wet' : 'dry_threat';
    const ramp = flipCapable ? 4 : Math.max(6, laps*0.2);
    for(let l=0;l<laps;l++){
      if(l < rainLap) curve.push(0);
      else curve.push(clamp((l-rainLap)/ramp, 0, 0.85));
    }
    radarAt.push(Math.max(0, rainLap - 3));
    return { curve, pattern, radarAt };
  }

  const arrives = Math.random() < track.rainChance * 0.5;
  if(!arrives){
    for(let l=0;l<laps;l++) curve.push(0);
    return { curve, pattern: 'dry', radarAt };
  }
  const rainLap = Math.floor(laps * randf(0.4, 0.8));
  pattern = 'dry_threat';
  for(let l=0;l<laps;l++){
    if(l < rainLap) curve.push(0);
    else curve.push(clamp((l-rainLap)/(laps*0.15), 0, 0.7));
  }
  radarAt.push(Math.max(0, rainLap - 3));
  return { curve, pattern, radarAt };
}

// ============ RACE SETUP ============
function startRace(gridOverride, strategyOverride){
  const track = currentTrack();
  const isWetWeekend = STATE.wetWeekends && STATE.wetWeekends.includes(STATE.round);
  RACE = buildRaceState(track, gridOverride, { isSprint: false, isWetWeekend });
  RACE.drivers.forEach(d=>{
    d.usedCompounds = new Set();
    const s = strategyOverride && strategyOverride[d.abbr];
    if(s){
      if(s.tyre) d.tyre = s.tyre;
      d.engineMode = s.mode || 'balanced';
    } else {
      d.tyre = aiStartTyre(track, isWetWeekend);
    }
    d.usedCompounds.add(d.tyre);
    d.nextPitLap = Math.round(track.laps * randf(0.35, 0.55));
    d.mustPit = false;
    d.hasPitted = false;
  });
  Object.entries(STATE.pendingGridPenalties || {}).forEach(([abbr, places])=>{
    const d = RACE.drivers.find(x=>x.abbr===abbr);
    if(d){
      d.startPosition = clamp(d.startPosition + places, 1, RACE.drivers.length);
      pushMsg('rc', 'RC:', `${abbr} drops ${places} grid places (engine penalty).`);
    }
  });
  RACE.drivers.sort((a,b)=>a.startPosition-b.startPosition);
  RACE.drivers.forEach((d,i)=>{ d.position = i+1; d.startPosition = i+1; });
  STATE.pendingGridPenalties = {};

  trackAnimTime = 0;
  lapProgress = 0;
  showScreen('screen-race');
  initRaceUI(track);
  renderTower(); renderStrip(); renderPitBox();
  raceSpeed = 1; racePaused = false;
  updateSpeedButtons();
  lastSimTime = performance.now();
  startRenderLoop();
}

function buildRaceState(track, gridOverride, opts){
  opts = opts || {};
  const laps = opts.isSprint ? sprintLapCount(track) : track.laps;
  const weather = buildWeather(track, laps, !!opts.isWetWeekend, !!opts.isSprint);
  const grid = gridOverride || buildDefaultGrid();
  const drivers = grid.map((g,i)=>({
    abbr:g.abbr, name:g.name, teamId:g.teamId, skill:g.skill, consistency:g.consistency, num:g.num,
    position:i+1, startPosition:i+1,
    totalTime: 0, gapToLeader: 0, interval: 0,
    tyre:'M', tyreAge:0, pitStops:0, pitHistory:[],
    retired:false, retiredReason:null, retiredLap:null,
    damage:0, penaltyLapsLeft:0,
    fuel: 100, battery: 60,
    engineMode: 'balanced',
    attackLapsUsed: 0,
    radioEffect: null, boostEffect: null,
    bestSector: [0,0,0], lastSector: [0,0,0],
    lapTimes: [],
    pitFlashUntilLap: 0, penaltyFlashUntilLap: 0,
    _pitTimer: 0, _pendingTyre: null, _pendingRepair: 0,
    _justPitted: false, _puncture: false,
    _armedPit: false, _armedTyre: null, _armedRepair: 0,
    _lastMessageLap: {},
    _hadContact: false, _lastLapTime: 0,
    _overtakeActive: false,
    _yellowOffences: 0, _yellowWarned: false,
    _yellowBankedPenalty: 0,
    mustPit: false, hasPitted: false,
    rechargeUntilLap: 0, rechargeCooldownUntilLap: 0,
    _radioOpen: false,
    _crossoverDeadlineLap: 0,
    _radarWarned: false,
    _lastWetDir: 0,
    _giveBackPending: 0,
    _stopGoPending: 0,
  }));
  return {
    track, laps, wetness: weather.curve, weatherPattern: weather.pattern, radarAt: weather.radarAt, lap:0,
    flag:'green',
    sectors: ['green','green','green'],
    sectorYellowUntil: [0,0,0],
    vscLapsRemaining: 0, scLapsRemaining: 0,
    redFlagActive: false, redFlagModalPending: false,
    redFlagCount: 0, incidentCount: 0,
    scheduledVscLap: 0, scheduledVscFired: false,
    drivers, finished:false,
    messages: [],
    myTeamId: STATE.myTeamId,
    fastestLapHolder: null, fastestLapTime: null,
    _lastWetBand: undefined,
    _lastWetDir: 0,
    _radarFired: false,
    isSprint: !!opts.isSprint,
    isWetWeekend: !!opts.isWetWeekend,
  };
}

function buildDefaultGrid(){
  const entries = [];
  TEAMS.forEach(team=>{
    const effPace = effectiveTeamPace(team);
    team.drivers.forEach(drv=>{
      const form = (STATE.form && STATE.form[drv.abbr]) || 0;
      const q = effPace*0.6 + drv.skill*0.4 + form + randf(-2,2);
      entries.push({ abbr:drv.abbr, name:drv.name, num:drv.num, teamId:team.id, skill:drv.skill, consistency:drv.consistency, effPace, qualiScore:q });
    });
  });
  entries.sort((a,b)=>b.qualiScore-a.qualiScore);
  return entries;
}
function aiStartTyre(track, isWetWeekend){
  const r = Math.random();
  if(isWetWeekend && r < 0.3) return r < 0.15 ? 'W' : 'I';
  const t = track.trackTempC;
  if(track.baseline==='wet-drying' && r<0.4) return 'I';
  if(track.rainChance>0.4 && r<0.15) return 'I';
  if(t>38) return r<0.7?'M':'H';
  if(t<18) return r<0.5?'S':'M';
  return r<0.4?'M':(r<0.75?'S':'H');
}

function initRaceUI(track){
  document.getElementById('raceTrackName').textContent = `${track.name} — ${track.country}`;
  document.getElementById('raceTrackMeta').textContent = track.character;
  document.getElementById('lapTotal').textContent = RACE.laps;
  document.getElementById('lapNow').textContent = 0;
  setFlagUI();
  renderSectorLegend();
  pushMsg('strat', 'STRAT:', `Green flag at ${track.name}.`);
  resizeTrackCanvas();
  setRaceTab('tower');

  if(!RACE.isSprint){
    const windowLow = Math.floor(RACE.laps * 0.25);
    const windowHigh = Math.floor(RACE.laps * 0.70);
    RACE.scheduledVscLap = windowLow + Math.floor(Math.random() * Math.max(1, windowHigh - windowLow));
  }
}
function resizeTrackCanvas(){
  const canvas = document.getElementById('trackCanvas');
  if(!canvas) return;
  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, rect.width * dpr);
  canvas.height = Math.max(240, rect.height * dpr);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
}
window.addEventListener('resize', ()=>{ if(RACE) resizeTrackCanvas(); });

function setFlagUI(){
  let overall = 'green';
  const redCount = RACE.sectors.filter(s=>s==='red').length;
  const yellowCount = RACE.sectors.filter(s=>s==='yellow').length;
  if(RACE.redFlagActive) overall = 'red';
  else if(redCount >= 2) overall = 'red';
  else if(RACE.scLapsRemaining > 0) overall = 'sc';
  else if(RACE.vscLapsRemaining > 0) overall = 'vsc';
  else if(redCount >= 1 || yellowCount >= 1) overall = 'yellow';
  RACE.flag = overall;
  const el = document.getElementById('flagIndicator');
  if(!el) return;
  el.className = 'flag-indicator flag-'+overall;
  el.textContent = {green:'Green',yellow:'Yellow',vsc:'VSC',sc:'Safety Car',red:'Red Flag',checkered:'Finished'}[overall] || overall;
  renderSectorLegend();
}
function renderSectorLegend(){
  const el = document.getElementById('sectorLegend');
  if(!el) return;
  const s = RACE.sectors;
  el.innerHTML = `
    <div class="row"><span class="dot ${s[0]}"></span> S1</div>
    <div class="row"><span class="dot ${s[1]}"></span> S2</div>
    <div class="row"><span class="dot ${s[2]}"></span> S3</div>
  `;
}
function flashBanner(text, kind){
  const b = document.getElementById('bannerFlash');
  b.textContent = text;
  b.className = 'banner-flash show banner-'+kind;
  setTimeout(()=>b.classList.remove('show'), 2200);
}
let audioCtx = null;
function beep(kind){
  if(!STATE || !STATE.settings.sound) return;
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const f = { green:440, yellow:330, vsc:330, sc:330, red:220, checkered:660, pit:600, radio:520 }[kind] || 440;
    o.frequency.value = f; g.gain.value = 0.04;
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    o.stop(audioCtx.currentTime + 0.25);
  }catch(e){}
}

// ============ TABS ============
function setRaceTab(tab){
  const towerBtn = document.getElementById('tabTower');
  const trackBtn = document.getElementById('tabTrack');
  const towerWrap = document.getElementById('towerWrap');
  const trackWrap = document.getElementById('trackWrap');
  if(!towerBtn || !trackBtn || !towerWrap || !trackWrap) return;
  towerBtn.classList.toggle('active', tab === 'tower');
  trackBtn.classList.toggle('active', tab === 'track');
  towerWrap.style.display = tab === 'tower' ? 'block' : 'none';
  trackWrap.style.display = tab === 'track' ? 'flex' : 'none';
  if(tab === 'track'){ resizeTrackCanvas(); drawTrackView(); }
}
document.getElementById('tabTower').addEventListener('click', ()=>setRaceTab('tower'));
document.getElementById('tabTrack').addEventListener('click', ()=>setRaceTab('track'));

// ============ SPEED ============
function updateSpeedButtons(){
  document.getElementById('speedPause').classList.toggle('active', racePaused);
  document.getElementById('speed2').classList.toggle('active', !racePaused && raceSpeed===2);
}
document.getElementById('speedPause').addEventListener('click', ()=>{ racePaused = !racePaused; updateSpeedButtons(); });
document.getElementById('speed2').addEventListener('click', ()=>{
  racePaused = false;
  raceSpeed = raceSpeed === 2 ? 1 : 2;
  updateSpeedButtons();
});
document.getElementById('speedSkip').addEventListener('click', ()=>{
  if(!RACE || RACE.finished) return;
  racePaused = true;
  const safety = RACE.laps * 3;
  let guard = 0;
  while(!RACE.finished && guard++ < safety) simulateLap(true);
  lapProgress = RACE.laps;
  renderTower(); renderStrip(); renderPitBox();
  if(RACE.finished){
    stopRenderLoop();
    setTimeout(showRaceResults, 500);
  }
});

// ============ EXIT RACE ============
document.getElementById('exitRace').addEventListener('click', ()=>{
  if(!RACE) return;
  const wasPaused = racePaused;
  racePaused = true;
  updateSpeedButtons();
  openModal(`
    <h2>Exit race</h2>
    <p>Leave the race and return to the menu. Choose whether to keep your progress.</p>
    <div class="modal-actions" style="flex-direction:column; align-items:stretch">
      <button class="btn btn-primary" id="exitSave">Save and exit</button>
      <button class="btn btn-ghost" id="exitNoSave">Exit without saving</button>
      <button class="btn btn-ghost btn-sm" id="exitCancel">Cancel</button>
    </div>
  `);
  document.getElementById('exitSave').addEventListener('click', ()=>{
    saveToSlot(activeSlot); closeModal(); stopRenderLoop(); RACE = null; showScreen('screen-intro');
  });
  document.getElementById('exitNoSave').addEventListener('click', ()=>{
    closeModal(); stopRenderLoop(); RACE = null; showScreen('screen-intro');
  });
  document.getElementById('exitCancel').addEventListener('click', ()=>{
    closeModal(); racePaused = wasPaused; updateSpeedButtons();
  });
});

// ============ SIM + RENDER LOOP ============
function startRenderLoop(){
  stopRenderLoop();
  lastAnimFrame = performance.now();
  _pitTickAccum = 0;
  const loop = ()=>{
    rafId = requestAnimationFrame(loop);
    if(!RACE || RACE.finished) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastAnimFrame) / 1000);
    lastAnimFrame = now;

    if(!racePaused && !RACE.redFlagModalPending){
      const flagMult = RACE.scLapsRemaining > 0 ? 1/1.55
                     : RACE.vscLapsRemaining > 0 ? 1/1.35
                     : 1.0;
      const rate = BASE_LAPS_PER_SEC * raceSpeed * flagMult;
      const prevLapFloor = Math.floor(lapProgress);
      lapProgress += dt * rate;
      if(lapProgress >= RACE.laps) lapProgress = RACE.laps;

      tickPitTimers(dt);

      const newLapFloor = Math.floor(lapProgress);
      for(let l = prevLapFloor; l < newLapFloor && !RACE.finished; l++){
        simulateLap(false);
      }

      document.getElementById('lapNow').textContent = Math.min(newLapFloor, RACE.laps);

      if(!RACE.finished){
        renderTower(); renderStrip(); renderPitBox();
      }
      if(RACE.finished){
        stopRenderLoop();
        setTimeout(showRaceResults, 800);
        return;
      }
    }

    trackAnimTime = lapProgress % 1;
    if(document.getElementById('trackWrap').style.display !== 'none') drawTrackView();
  };
  loop();
}
function stopRenderLoop(){ if(rafId){ cancelAnimationFrame(rafId); rafId = null; } }

let _pitTickAccum = 0;
function tickPitTimers(dt){
  _pitTickAccum += dt;
  if(_pitTickAccum < 0.05) return;
  const step = _pitTickAccum;
  _pitTickAccum = 0;
  RACE.drivers.forEach(d=>{
    if(d._pitTimer > 0){
      d._pitTimer = Math.max(0, d._pitTimer - step);
      if(d._pitTimer === 0){
        d.tyre = d._pendingTyre || d.tyre;
        d.tyreAge = 0;
        if(d._pendingRepair){ d.damage = Math.max(0, d.damage - d._pendingRepair); }
        d._pendingTyre = null;
        d._pendingRepair = 0;
        d._justPitted = true;
        d.pitFlashUntilLap = RACE.lap + 2;
        pushMsg('pit', 'PIT:', `${d.abbr} rejoins on ${COMPOUNDS[d.tyre].name}.`);
      }
    }
  });
}

// ===================== LAP SIM =====================
function simulateLap(silent){
  if(RACE.redFlagActive || RACE.finished) return;

  RACE.drivers.forEach(d=>{
    if(d._armedPit && d._pitTimer === 0) executePit(d, d._armedTyre || d.tyre, d._armedRepair || 0);
  });

  RACE.lap++;
  const track = RACE.track;
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  const prevWet = RACE.lap > 1 ? (RACE.wetness[Math.min(RACE.lap-2, RACE.wetness.length-1)] || 0) : wet;
  const wetTrend = wet - prevWet;

  if(!silent) document.getElementById('lapNow').textContent = RACE.lap;

  for(let s=0;s<3;s++){
    if(RACE.sectorYellowUntil[s] && RACE.lap >= RACE.sectorYellowUntil[s]){
      if(RACE.sectors[s] === 'yellow') RACE.sectors[s] = 'green';
      RACE.sectorYellowUntil[s] = 0;
    }
  }

  if(RACE.scLapsRemaining > 0){
    RACE.scLapsRemaining--;
    if(RACE.scLapsRemaining===0) pushMsg('rc', 'RC:', 'Green flag. Racing resumes.');
  }
  if(RACE.vscLapsRemaining > 0){
    RACE.vscLapsRemaining--;
    if(RACE.vscLapsRemaining===0) pushMsg('rc', 'RC:', 'Green flag. Racing resumes.');
  }
  setFlagUI();
  announceWeatherShift(wet);

  if(RACE.radarAt && RACE.radarAt.includes(RACE.lap) && !RACE._radarFired){
    RACE._radarFired = true;
    pushMsg('wu', 'WU:', 'Radar: rain in 3 laps. Prepare for changeable conditions.');
    flashBanner('Rain incoming', 'yellow');
  }

  if(!RACE.isSprint && !RACE.scheduledVscFired && RACE.scheduledVscLap > 0 && RACE.lap >= RACE.scheduledVscLap){
    if(RACE.lap < RACE.laps - 3 && RACE.incidentCount < 3
       && RACE.scLapsRemaining === 0 && RACE.vscLapsRemaining === 0 && !RACE.redFlagActive){
      RACE.scheduledVscFired = true;
      RACE.incidentCount++;
      pushMsg('rc', 'RC:', 'Virtual Safety Car — debris on track.');
      flashBanner('Virtual Safety Car', 'yellow');
      RACE.vscLapsRemaining = rand(2,3);
    } else {
      RACE.scheduledVscLap += 2;
    }
  }

  const active = RACE.drivers.filter(d=>!d.retired);
  const sorted = [...active].sort((a,b)=>a.totalTime-b.totalTime);

  // Battery, overtake, recharge, yellow flag enforcement
  const anyYellow = RACE.sectors.some(s=>s==='yellow' || s==='red');
  const exemptFlags = RACE.scLapsRemaining > 0 || RACE.vscLapsRemaining > 0 || RACE.redFlagActive;
  const lastLap = RACE.lap >= RACE.laps;

  active.forEach((d)=>{
    const position = sorted.indexOf(d);
    const carAhead = position > 0 ? sorted[position - 1] : null;
    const gapAhead = carAhead ? (d.totalTime - carAhead.totalTime) : Infinity;
    d._overtakeActive = (carAhead && gapAhead < 1.0);

    const mode = ENGINE_MODES[d.engineMode] || ENGINE_MODES.balanced;
    let drain = 2.0 + mode.batteryDrain;
    if(d.boostEffect && RACE.lap <= d.boostEffect.untilLap) drain += 4.0;
    if(d._overtakeActive) drain += 1.5;

    let regen = 0;
    if(RACE.scLapsRemaining > 0) regen = 5.0;
    else if(RACE.vscLapsRemaining > 0) regen = 3.0;
    else if(RACE.redFlagActive) regen = 6.0;
    else regen = 2.5;
    if(d.engineMode === 'save') regen += 2.0;
    d.battery = clamp(d.battery - drain + regen, 0, 100);

    if(d.rechargeUntilLap && RACE.lap > d.rechargeUntilLap){
      d.battery = 100;
      d.rechargeUntilLap = 0;
      if(d.teamId === STATE.myTeamId){
        pushMsg('cmd', 'CMD:', `${d.abbr} battery full — normal pace resumes.`);
      }
    }

    if(d.engineMode === 'attack') d.attackLapsUsed = (d.attackLapsUsed || 0) + 1;
    if(d.radioEffect && RACE.lap >= d.radioEffect.untilLap) d.radioEffect = null;
    if(d.boostEffect && RACE.lap > d.boostEffect.untilLap) d.boostEffect = null;

    // ---- Yellow flag enforcement ----
    if(anyYellow && !exemptFlags && !lastLap && !d.retired){
      const isInYellow = RACE.sectors.some(s=>s==='yellow' || s==='red');
      if(isInYellow){
        const modeKey = d.engineMode;
        let chance = 0;
        if(modeKey === 'attack') chance = 0.35;
        else if(modeKey === 'balanced') chance = 0.15;
        // save = 0
        if(chance > 0 && Math.random() < chance){
          d._yellowOffences++;
          if(d._yellowOffences === 1){
            d._yellowWarned = true;
            pushMsg('rc', 'RC:', `${d.abbr}: MARSHAL WARNING — slow under yellow.`);
          } else if(d._yellowOffences === 2){
            d.penaltyLapsLeft = (d.penaltyLapsLeft || 0) + 1;
            d.penaltyFlashUntilLap = RACE.lap + 5;
            pushMsg('rc', 'RC:', `${d.abbr}: +5s penalty — speeding under yellow.`);
          } else {
            d._stopGoPending = 1;
            pushMsg('rc', 'RC:', `${d.abbr}: STOP AND GO — repeated yellow flag breaches.`);
          }
        }
      }
    }
    // Reset yellow offence ladder when all sectors green
    if(!anyYellow && d._yellowOffences > 0){
      d._yellowOffences = 0;
      d._yellowWarned = false;
    }
  });

  // AI yellow compliance — 80% switch to save
  active.forEach(d=>{
    if(d.teamId === STATE.myTeamId) return;
    if(!anyYellow || exemptFlags) return;
    // Once per yellow period, roll
    if(!d._yellowComplianceChecked){
      d._yellowComplianceChecked = true;
      const inFight = d._overtakeActive;
      const compliant = Math.random() < 0.8 || !inFight;
      if(compliant){
        d.engineMode = 'save';
        d._yellowRestoreMode = d._yellowRestoreMode || 'balanced';
      }
    }
  });
  if(!anyYellow){
    active.forEach(d=>{
      if(d._yellowComplianceChecked){
        d._yellowComplianceChecked = false;
        if(d._yellowRestoreMode){ d.engineMode = d._yellowRestoreMode; d._yellowRestoreMode = null; }
      }
    });
  }

  active.forEach(d=>{
    const lapTime = computeLapTime(d, track, wet, wetTrend);
    d.totalTime += lapTime;
    d.tyreAge++;
    d.lapTimes.push(lapTime);
    d._lastLapTime = lapTime;
    d.fuel = Math.max(0, d.fuel - (100 / RACE.laps));
    applyCarWear(d);
    if(d.penaltyFlashUntilLap && RACE.lap > d.penaltyFlashUntilLap) d.penaltyFlashUntilLap = 0;
  });

  // Punctures
  active.forEach(d=>{
    const life = tyreLifePercent(d);
    if(life <= 10 && !d._puncture && !d.retired){
      if(Math.random() < 0.06){
        d._puncture = true;
        pushMsg('danger', 'RC:', `${d.abbr} PUNCTURE!`);
        if(d.teamId===STATE.myTeamId) flashBanner('Puncture!','red');
        d.totalTime += 28 + randf(-3,5);
        if(d._pitTimer===0) executePit(d, d.tyre, 0);
        if(Math.random() < 0.08 && !d.retired) retireDriver(d, 'crash');
      }
    }
  });

  active.forEach(d=>{
    if(d.retired) return;
    if(d.damage >= 6){
      const dnfChance = d.damage >= 8 ? 0.08 : 0.04;
      if(Math.random() < dnfChance){
        pushMsg('danger', 'RC:', `${d.abbr} car failure — OUT.`);
        if(d.teamId===STATE.myTeamId) flashBanner('Car Failure','red');
        retireDriver(d, 'mechanical');
      }
    }
  });

  // Racing incidents — give place back / lose 1 spot / stop & go
  active.forEach(d=>{
    if(d.retired) return;
    if(Math.random() < 0.0008){
      // off-track advantage — give place back pending
      if(!d._giveBackPending){
        d._giveBackPending = 2;
        pushMsg('rc', 'RC:', `${d.abbr}: gained an advantage off track — give the position back.`);
      }
    }
    if(d._giveBackPending > 0){
      d._giveBackPending--;
      if(d._giveBackPending === 0){
        d.penaltyLapsLeft = (d.penaltyLapsLeft || 0) + 1;
        d.penaltyFlashUntilLap = RACE.lap + 3;
        pushMsg('rc', 'RC:', `${d.abbr}: failed to give position back — 5s penalty.`);
      }
    }
    // pit lane speeding roll
    if(d._pitTimer > 0 && Math.random() < 0.05){
      d._stopGoPending = 1;
      pushMsg('rc', 'RC:', `${d.abbr}: STOP AND GO 5s — speeding in the pit lane.`);
    }
  });

  const fastest = active.slice().sort((a,b)=>a._lastLapTime-b._lastLapTime)[0];
  if(fastest && (!RACE.fastestLapTime || fastest._lastLapTime < RACE.fastestLapTime)){
    RACE.fastestLapTime = fastest._lastLapTime;
    RACE.fastestLapHolder = fastest.abbr;
  }

  checkIncidents(active, wet);

  if(wet >= 0.6 && RACE.redFlagCount < 1 && !RACE.redFlagActive){
    if(Math.random() < 0.02){
      pushMsg('danger', 'RC:', 'Standing water — session stopped.');
      startRedFlag();
    }
  }

  RACE.drivers.sort((a,b)=>{
    if(a.retired && !b.retired) return 1;
    if(!a.retired && b.retired) return -1;
    if(a.retired && b.retired) return (a.retiredLap||0)-(b.retiredLap||0);
    return a.totalTime-b.totalTime;
  });
  const leader = RACE.drivers.find(d=>!d.retired);
  const leaderTime = leader ? leader.totalTime : 0;
  let prevTime = null;
  RACE.drivers.forEach((d,i)=>{
    d.position = i+1;
    if(!d.retired){
      d.gapToLeader = d.totalTime - leaderTime;
      d.interval = prevTime!==null ? (d.totalTime - prevTime) : 0;
      prevTime = d.totalTime;
    }
  });

  if(RACE.scLapsRemaining > 0){
    active.forEach(d=>{
      if(d.teamId === STATE.myTeamId) return;
      if(d._pitTimer > 0) return;
      if(d.retired) return;
      if(d.nextPitLap && d.nextPitLap - RACE.lap <= 6 && d.nextPitLap - RACE.lap > 0){
        if((RACE.laps - RACE.lap) > 3) maybeAIPitStop(d, track, wet, true);
      }
    });
  }

  active.forEach(d=>{
    if(d.retired) return;
    maybeAIPitStop(d, track, wet, false);
  });
  runEngineerRadio();

  if(RACE.lap >= RACE.laps) finishRace();
}

function tyreLifePercent(d){
  const comp = COMPOUNDS[d.tyre];
  const bonus = STATE.tyreMgmtBonus || 0;
  const baseDeg = comp.degRate * 6 * (1 - bonus);
  return Math.max(0, 100 - (d.tyreAge * baseDeg));
}
function carHealthPercent(d){ return Math.max(0, 100 - (d.damage / 8) * 100); }
function applyCarWear(d){
  let wear = 0.15;
  if(d.engineMode === 'attack') wear += 0.8;
  if(d.engineMode === 'save')   wear -= 0.05;
  if(d.radioEffect && d.radioEffect.paceBonus > 0) wear += 0.5;
  if(d.radioEffect && d.radioEffect.paceBonus < 0) wear -= 0.1;
  if(d.boostEffect) wear += 0.9;
  if(d.rechargeUntilLap && RACE.lap <= d.rechargeUntilLap) wear -= 0.1;
  d.damage = clamp(d.damage + wear * 0.05, 0, 8);
}

function computeLapTime(d, track, wet, wetTrend){
  const team = teamById(d.teamId);
  const effPace = effectiveTeamPace(team);
  const comp = COMPOUNDS[d.tyre];
  const life = tyreLifePercent(d);

  const paceDelta = (100 - effPace) * PACE_SCALE * 0.28;
  const skillDelta = (100 - d.skill) * PACE_SCALE * 0.22;
  let base = BASE_LAP + paceDelta + skillDelta;

  let ageLoss = Math.pow(1 - life/100, 1.8) * 7.0;
  if(life < 25) ageLoss *= 2.5;
  const compoundOffset = (100 - comp.gripBase) * 0.06;

  let tempPenalty = 0;
  if(track.trackTempC < comp.tempMin) tempPenalty = (comp.tempMin-track.trackTempC)*0.04;
  else if(track.trackTempC > comp.tempMax) tempPenalty = (track.trackTempC-comp.tempMax)*0.03;
  if(track.trackTempC < 18 && d.tyreAge < 3 && !comp.wet) tempPenalty += (3-d.tyreAge)*0.15;

  let wetPenalty = 0;
  if(wet > 0.6 && !comp.wet){
    wetPenalty = wet * 8;
  } else if(wet > 0.15 && !comp.wet){
    wetPenalty = wet * 5;
  } else if(wet <= 0.15 && comp.wet){
    wetPenalty = 4.5;
  } else if(wet > 0.15 && comp.wet){
    if(d.tyre==='I' && wet>0.6) wetPenalty = (wet-0.6)*6;
    if(d.tyre==='W' && wet<0.35) wetPenalty = 2.0;
    if(d.tyre==='I' && wet<0.1) wetPenalty = 2.5;
  }
  const wrongTyre = (wet > 0.4 && !comp.wet) || (wet < 0.2 && comp.wet);
  const trendingAway = (wetTrend > 0.03 && comp.wet === true) || (wetTrend < -0.03 && comp.wet !== true);
  if(wrongTyre && trendingAway) wetPenalty *= 1.3;

  const fuelPenalty = (d.fuel - 50) * 0.01;
  const mode = ENGINE_MODES[d.engineMode] || ENGINE_MODES.balanced;
  const modeBonus = -mode.paceBonus * 20;
  let radioBonus = 0;
  if(d.radioEffect) radioBonus = -(d.radioEffect.paceBonus || 0) * 20;
  const dmgPenalty = d.damage * 0.45;

  let freshBonus = 0;
  if(d.tyreAge <= 3) freshBonus = -(3 - d.tyreAge) * 0.35;

  let boostBonus = 0;
  if(d.boostEffect && RACE.lap <= d.boostEffect.untilLap) boostBonus = -0.6;

  let overtakeBonus = 0;
  if(d._overtakeActive && track.hasDRS) overtakeBonus = -0.55;

  let rechargePenalty = 0;
  if(d.rechargeUntilLap && RACE.lap <= d.rechargeUntilLap) rechargePenalty = 15.0;

  let modeLimitPenalty = 0;
  if(d.engineMode === 'attack' && d.attackLapsUsed > 10){
    modeLimitPenalty = 0.3 + (d.attackLapsUsed - 10) * 0.05;
  }

  let flagMult = 1;
  if(RACE.scLapsRemaining > 0) flagMult = 1.55;
  else if(RACE.vscLapsRemaining > 0) flagMult = 1.35;

  let t = base + ageLoss + compoundOffset + tempPenalty + wetPenalty + fuelPenalty + modeBonus + radioBonus + dmgPenalty + freshBonus + boostBonus + overtakeBonus + rechargePenalty + modeLimitPenalty;
  t += randf(-0.3, 0.3) * (1 - d.consistency/140);

  let penalty = 0;
  if(d.penaltyLapsLeft > 0){ penalty = 5; d.penaltyLapsLeft--; }

  return (t + penalty) * flagMult;
}

function announceWeatherShift(wet){
  if(RACE._lastWetBand===undefined) RACE._lastWetBand = wet>0.5?'wet':(wet>0.1?'damp':'dry');
  const band = wet>0.5?'wet':(wet>0.1?'damp':'dry');
  if(band!==RACE._lastWetBand){
    if(band==='wet'){ pushMsg('wu', 'WU:', `Rain intensifying — track is wet.`); flashBanner('Rain Falling','yellow'); }
    else if(band==='damp' && RACE._lastWetBand==='dry'){ pushMsg('wu', 'WU:', `Spots of rain on track.`); flashBanner('Rain Starting','yellow'); }
    else if(band==='damp' && RACE._lastWetBand==='wet'){ pushMsg('wu', 'WU:', `Track beginning to dry.`); }
    else if(band==='dry'){ pushMsg('wu', 'WU:', `Track fully dry now.`); }
    RACE._lastWetBand = band;
  }
}

function checkIncidents(active, wet){
  active.forEach(d=>{
    if(d.retired) return;
    const team = teamById(d.teamId);
    const effReli = team.reliability + (team.id===STATE.myTeamId?STATE.carReliabilityBoost:0) + (team.id===STATE.myTeamId?STATE.upgrades.rel*2:0);
    const mode = ENGINE_MODES[d.engineMode] || ENGINE_MODES.balanced;
    const failChance = ((100-effReli) * 0.00018) * mode.reliabilityRisk * (1 + d.damage*0.15);
    const baseCrash = (100-d.consistency)*0.00006;
    const wetRisk = wet * (wet > 0.5 ? 0.0018 : 0.0006);
    const wearRisk = d.tyreAge > 28 ? 0.0003 : 0;
    const crashChance = (baseCrash + wetRisk + wearRisk) * (d.damage > 4 ? 1.8 : 1.0);
    const roll = Math.random();
    if(roll < failChance){
      retireDriver(d, 'mechanical');
    } else if(roll < failChance + crashChance){
      if(Math.random() < 0.72){
        d.damage = clamp(d.damage + rand(1,3), 0, 8);
        d._hadContact = true;
        pushMsg('danger', 'RC:', `${d.abbr} picks up damage after contact.`);
        if(d.teamId===STATE.myTeamId) flashBanner('Damage!','yellow');
        triggerSectorYellow();
        if(Math.random() < 0.3){
          const other = pick(active.filter(x=>x!==d && !x.retired));
          if(other){
            // Tier 2 — lose one spot: shuffle them backward
            other.penaltyLapsLeft = 1;
            other.penaltyFlashUntilLap = RACE.lap + 3;
            pushMsg('danger', 'RC:', `${other.abbr} given 5s penalty for causing a collision.`);
          }
        }
      } else {
        retireDriver(d, 'crash', wet);
        if(wet >= 0.5 && RACE.scLapsRemaining === 0) startSafetyCar();
        triggerSectorYellow();
      }
    }
    d._justPitted = false;
  });
}
function triggerSectorYellow(){
  const s = rand(0,2);
  RACE.sectors[s] = 'yellow';
  RACE.sectorYellowUntil[s] = RACE.lap + rand(2,4);
  const yc = RACE.sectors.filter(x=>x==='yellow').length;
  if(yc >= 2){
    RACE.sectors[s] = 'red';
    RACE.sectorYellowUntil[s] = RACE.lap + rand(1,3);
  }
  setFlagUI();
}
function retireDriver(d, reason, wet){
  d.retired = true;
  d.retiredReason = reason;
  d.retiredLap = RACE.lap;
  const label = reason==='mechanical' ? 'retires (mechanical)' : 'crashes out';
  pushMsg('danger', 'RC:', `${d.abbr} ${label}!`);
  if(d.teamId===STATE.myTeamId) flashBanner(reason==='crash'?'Crash!':'Mechanical','red');
  const wetness = wet !== undefined ? wet : (RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0);
  if(reason==='crash'){
    const r = Math.random();
    let redChance = 0.15;
    if(wetness >= 0.6) redChance = 0.55;
    else if(wetness >= 0.4) redChance = 0.40;
    else if(wetness >= 0.2) redChance = 0.25;

    if(r < redChance && RACE.redFlagCount < 1 && RACE.incidentCount < 3){
      startRedFlag();
    } else if(r < redChance + 0.35 && RACE.incidentCount < 3){
      startSafetyCar();
    } else if(RACE.incidentCount < 3){
      startVSC();
    } else {
      triggerSectorYellow();
    }
  } else {
    if(Math.random() < 0.2 && RACE.incidentCount < 3) startVSC();
    else triggerSectorYellow();
  }
}
function startVSC(){
  if(RACE.redFlagActive) return;
  RACE.vscLapsRemaining = rand(2,3);
  RACE.incidentCount++;
  pushMsg('rc', 'RC:', 'Virtual Safety Car deployed.');
  flashBanner('Virtual Safety Car','yellow');
  setFlagUI();
}
function startSafetyCar(){
  if(RACE.redFlagActive) return;
  RACE.scLapsRemaining = rand(3,5);
  RACE.incidentCount++;
  pushMsg('rc', 'RC:', 'Safety Car deployed.');
  flashBanner('Safety Car','yellow');
  const active = RACE.drivers.filter(d=>!d.retired).sort((a,b)=>a.position-b.position);
  if(active.length){
    const leaderTime = active[0].totalTime;
    active.forEach((d,i)=>{ d.totalTime = leaderTime + i * 1.5; });
  }
  setFlagUI();
}
function startRedFlag(){
  if(RACE.redFlagActive) return;
  RACE.redFlagActive = true;
  RACE.redFlagModalPending = true;
  RACE.redFlagCount++;
  pushMsg('danger', 'RC:', 'RED FLAG — session stopped.');
  flashBanner('Red Flag','red');
  setFlagUI();
  racePaused = true; updateSpeedButtons();
  renderPitBox();
  openRedFlagResumeModal();
}
function openRedFlagResumeModal(){
  const myDrivers = myTeam().drivers;
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  const defaultTyre = wet > 0.4 ? 'W' : null;
  openModal(`
    <h2 style="color:var(--red)">🔴 Red Flag</h2>
    <p>Race stopped. All cars pit. Choose tyres for the restart. Race resumes behind the Safety Car.</p>
    ${myDrivers.map(d=>{
      const dd = RACE.drivers.find(x=>x.abbr===d.abbr);
      if(!dd) return '';
      const currentTyre = defaultTyre || dd.tyre;
      return `
      <div class="driver-strat" data-abbr="${d.abbr}">
        <div class="driver-strat-name">
          <span>${d.name}</span>
          <span style="color:var(--dim);font-size:11px">Current: ${dd.tyre}</span>
        </div>
        <div class="tyre-select">
          ${['S','M','H','I','W'].map(c=>`
            <button class="tyre-btn compact rf-tyre ${currentTyre===c?'active':''}" data-abbr="${d.abbr}" data-tyre="${c}">
              <span class="tyre-circle tyre-${c}">${c}</span>
            </button>
          `).join('')}
        </div>
      </div>`;
    }).join('')}
    <div class="modal-actions"><button class="btn btn-primary" id="btnRedFlagResume">Restart race</button></div>
  `);
  const sel = {};
  myDrivers.forEach(d=>{
    const dd = RACE.drivers.find(x=>x.abbr===d.abbr);
    if(dd) sel[d.abbr] = defaultTyre || dd.tyre;
  });
  document.querySelectorAll('.rf-tyre').forEach(b=>b.addEventListener('click', ()=>{
    sel[b.dataset.abbr] = b.dataset.tyre;
    document.querySelectorAll(`.rf-tyre[data-abbr="${b.dataset.abbr}"]`).forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  }));
  document.getElementById('btnRedFlagResume').addEventListener('click', ()=>{
    RACE.drivers.forEach(d=>{
      const chosen = sel[d.abbr];
      if(chosen && chosen !== d.tyre){
        d.tyre = chosen;
        d.tyreAge = 0;
        d.usedCompounds.add(chosen);
        d.pitStops++;
        d.pitHistory.push({lap:RACE.lap, tyre:chosen, reason:'redflag'});
      }
      d._puncture = false;
      d.damage = Math.max(0, d.damage - 2);
    });
    RACE.drivers.forEach(d=>{
      if(d.teamId === STATE.myTeamId) return;
      if(d.retired) return;
      const used = d.usedCompounds || new Set();
      let newT = null;
      if(wet > 0.4) newT = wet > 0.6 ? 'W' : 'I';
      else {
        const preference = ['H','M','S'];
        const avail = preference.filter(c => !used.has(c));
        if(avail.length > 0) newT = avail[0];
      }
      if(newT){
        d.tyre = newT;
        d.tyreAge = 0;
        d.usedCompounds.add(newT);
        d.pitStops++;
        d.pitHistory.push({lap:RACE.lap, tyre:newT, reason:'redflag'});
      }
      d._puncture = false;
      d.damage = Math.max(0, d.damage - 2);
    });
    RACE.redFlagActive = false;
    RACE.redFlagModalPending = false;
    RACE.scLapsRemaining = 2;
    RACE.sectors = ['green','green','green'];
    RACE.incidentCount++;
    racePaused = false; updateSpeedButtons();
    closeModal();
    pushMsg('rc', 'RC:', 'Race restarts behind the Safety Car.');
    setFlagUI();
    renderStrip();
    renderPitBox();
  });
}
function maybeAIPitStop(d, track, wet, scRush){
  if(d.teamId===STATE.myTeamId) return;
  if(RACE.lap < 3 || d._pitTimer > 0) return;
  const style = PRINCIPAL_STYLES[d.teamId] || PRINCIPAL_STYLES.rbr;
  const comp = COMPOUNDS[d.tyre];
  const life = tyreLifePercent(d);
  const wantsWet = wet>0.35 && !comp.wet;
  const wantsSlickBack = wet<0.12 && comp.wet;
  const tyreWorn = life < (25 * style.pitBias);
  const duePlanned = d.nextPitLap && RACE.lap >= d.nextPitLap;

  const crossedUp   = wet > 0.35 && !comp.wet;
  const crossedDown = wet < 0.35 && comp.wet;
  if((crossedUp || crossedDown)){
    if(!d._crossoverDeadlineLap) d._crossoverDeadlineLap = RACE.lap + 2;
    if(RACE.lap >= d._crossoverDeadlineLap){
      let newTyre = null;
      const used = d.usedCompounds || new Set();
      if(wet > 0.5) newTyre = 'W';
      else if(wet > 0.25) newTyre = 'I';
      else {
        const pref = ['M','H','S'];
        const avail = pref.filter(c => !used.has(c));
        newTyre = avail[0] || 'M';
      }
      if(newTyre && newTyre !== d.tyre){
        executePit(d, newTyre, d.damage >= 3 ? Math.min(d.damage, 5) : 0);
        d._crossoverDeadlineLap = 0;
        d.nextPitLap = 99999;
        return;
      }
    }
  } else {
    d._crossoverDeadlineLap = 0;
  }

  if((RACE.laps-RACE.lap) < 3) return;
  if(!scRush && !(wantsWet || wantsSlickBack || tyreWorn || duePlanned)) return;
  if(scRush && !(wantsWet || wantsSlickBack || tyreWorn || duePlanned)){
    if(!(d.nextPitLap && RACE.lap <= d.nextPitLap)) return;
  }
  const used = d.usedCompounds || new Set();
  let newTyre = null;
  if(wantsWet){
    newTyre = wet > 0.6 ? 'W' : 'I';
  } else if(wantsSlickBack){
    const pref = ['M','H','S'];
    const avail = pref.filter(c => !used.has(c));
    newTyre = avail[0] || 'M';
  } else {
    const preference = ['H','M','S'];
    const available = preference.filter(c => !used.has(c));
    if(available.length > 0) newTyre = available[0];
    else if(wet > 0.3) newTyre = 'I';
  }
  if(!newTyre || newTyre === d.tyre) return;
  executePit(d, newTyre, d.damage >= 3 ? Math.min(d.damage, 5) : 0);
  d.nextPitLap = 99999;
}
function executePit(d, newTyre, repairAmount){
  if(d._pitTimer > 0) return;
  const used = d.usedCompounds || (d.usedCompounds = new Set());
  const flagMult = RACE.scLapsRemaining > 0 ? 0.55
                 : RACE.vscLapsRemaining > 0 ? 0.75
                 : 1.0;
  let pitLoss = (18 + randf(0, 6)) * flagMult;
  const repairTime = (repairAmount || 0) * 6;
  // Stop and go penalty
  if(d._stopGoPending){
    d._stopGoPending = 0;
    pitLoss += 5;
    d.totalTime += 5;
    pushMsg('pit', 'PIT:', `${d.abbr} serves stop-and-go (+5s).`);
  }
  d._pitTimer = 0.6;
  d._pendingTyre = newTyre;
  d._pendingRepair = repairAmount || 0;
  d.pitStops++;
  d.usedCompounds.add(newTyre);
  d.pitHistory.push({lap:RACE.lap, tyre:newTyre, repair: repairAmount||0});
  d.totalTime += pitLoss + repairTime;
  // Nova Pay task check
  const crewTime = randf(1.8, 3.2);
  d._lastCrewTime = crewTime;
  if(crewTime < 2.2 && d.teamId === STATE.myTeamId){
    onFastPitStop();
  }
  let msg = `${d.abbr} pits — ${COMPOUNDS[newTyre].name}`;
  if(repairAmount) msg += ` + 🔧 repair`;
  msg += ` (${crewTime.toFixed(1)}s crew)`;
  if(Math.random() < 0.15){
    d.totalTime += 1.5;
    msg += ' · slow stop +1.5s';
  }
  pushMsg('pit', 'PIT:', msg);
  if(d.teamId===STATE.myTeamId){
    flashBanner('Box box box','blue');
    d.hasPitted = true;
  }
  d._armedPit = false;
  d._armedTyre = null;
  d._armedRepair = 0;
}
function onFastPitStop(){
  const s = STATE.sponsors && STATE.sponsors.events && STATE.sponsors.events.novapay;
  if(!s || s.claimed) return;
  s.claimed = true;
  STATE.budget += 8;
  pushMsg('cmd', 'NOVA PAY:', 'Fast Lane complete — $8M bonus.');
  flashBanner('Nova Pay: +$8M','green');
}
function armPit(driver, tyre, repair){
  if(!driver || driver.retired) return;
  driver._armedPit = true;
  driver._armedTyre = tyre;
  driver._armedRepair = repair || 0;
  pushMsg('cmd', 'CMD:', `Box this lap — ${COMPOUNDS[tyre].name}${repair?` + 🔧 repair`:''}.`);
  setTimeout(()=>pushMsg('driver', driver.abbr+':', 'Boxing this lap.'), 400);
}
function cancelPit(driver){
  if(!driver) return;
  driver._armedPit = false;
  driver._armedTyre = null;
  driver._armedRepair = 0;
  pushMsg('cmd', 'CMD:', 'Cancel the pit. Stay out.');
  setTimeout(()=>pushMsg('driver', driver.abbr+':', 'Understood, staying out.'), 400);
}
function engineerSay(driver, text, key){
  const k = key || text;
  const last = driver._lastMessageLap[k] || -999;
  if(RACE.lap - last < 4) return;
  driver._lastMessageLap[k] = RACE.lap;
  pushMsg('strat', 'STRAT:', text);
  beep('radio');
}
function runEngineerRadio(){
  const mine = RACE.drivers.filter(d=> d.teamId===STATE.myTeamId && !d.retired);
  mine.forEach(d=>{
    const life = tyreLifePercent(d);
    if(life < 40 && life > 25) engineerSay(d, `${d.name}: tyres at ${Math.round(life)}% — plan a stop soon.`, 'tyrewarn1_'+d.abbr);
    if(life < 25 && life > 15) engineerSay(d, `${d.name}: tyres going off, box this lap.`, 'tyrewarn2_'+d.abbr);
    if(d.damage >= 3 && d.damage < 5) engineerSay(d, `${d.name}: floor damage — we can repair at the next stop.`, 'dmgwarn1_'+d.abbr);
    if(d.damage >= 5) engineerSay(d, `${d.name}: car is heavily damaged — repair now or we risk failure.`, 'dmgwarn2_'+d.abbr);
    const wet = RACE.wetness[Math.min(RACE.lap, RACE.wetness.length-1)] || 0;
    if(wet > 0.2 && !COMPOUNDS[d.tyre].wet) engineerSay(d, `${d.name}: it's raining — inters may be needed.`, 'rain1_'+d.abbr);
    if(wet > 0.6 && d.tyre === 'I') engineerSay(d, `${d.name}: heavy rain — full wets would be faster.`, 'rain2_'+d.abbr);
    if(wet < 0.2 && COMPOUNDS[d.tyre].wet) engineerSay(d, `${d.name}: track is dry enough for slicks.`, 'rain3_'+d.abbr);
    if(d._overtakeActive) engineerSay(d, `${d.name}: in overtake range — use it.`, 'ovr_'+d.abbr);
  });
}

// ============ MESSAGES ============
function pushMsg(kind, tag, text){
  if(!RACE) return;
  RACE.messages.push({ kind, tag, text, lap: RACE.lap });
  renderRibbon();
}
function renderRibbon(){
  if(!RACE) return;
  const last = RACE.messages[RACE.messages.length-1];
  const rib = document.getElementById('msgRibbon');
  const txt = document.getElementById('ribbonText');
  if(!rib || !txt) return;
  if(!last){
    txt.innerHTML = 'Race feed initialising…';
    document.getElementById('ribbonPips').innerHTML = '';
    return;
  }
  const cls = {
    strat:'ribbon-strat', rc:'ribbon-rc', wu:'ribbon-wu',
    pit:'ribbon-pit', cmd:'ribbon-cmd', driver:'ribbon-driver'
  }[last.kind] || 'ribbon-strat';
  txt.innerHTML = `<span class="${cls}">${last.tag}</span> ${last.text}`;
  const pips = [];
  if(RACE.wetness){
    const cur = RACE.wetness[Math.min(RACE.lap, RACE.wetness.length-1)] || 0;
    for(let i=1;i<=5;i++){
      const wi = RACE.wetness[Math.min(RACE.lap+i, RACE.wetness.length-1)] || 0;
      if(wi > cur + 0.15){ pips.push('<span class="pip">🌧</span>'); break; }
    }
  }
  if(RACE.scLapsRemaining>0) pips.push('<span class="pip" style="color:var(--amber)">🏁</span>');
  if(RACE.vscLapsRemaining>0) pips.push('<span class="pip" style="color:var(--amber)">🏁</span>');
  document.getElementById('ribbonPips').innerHTML = pips.join('');
  rib.classList.remove('flash');
  void rib.offsetWidth;
  rib.classList.add('flash');
}

// ============ TOWER ============
const BATTERY_SVG = (pct) => {
  const fillW = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 13);
  const col = pct > 60 ? 'var(--green)' : pct > 30 ? 'var(--amber)' : 'var(--red)';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round">
    <rect x="2" y="7" width="17" height="10" rx="2"/>
    <line x1="22" y1="11" x2="22" y2="13"/>
    <rect class="battery-fill-rect" x="4" y="9" width="${fillW}" height="6" fill="${col}" stroke="none"/>
  </svg>`;
};

function renderBatteryChip(d){
  const pct = Math.round(d.battery);
  const arrow = d.engineMode === 'attack' ? '▼' : (RACE.scLapsRemaining>0 || RACE.vscLapsRemaining>0 || d.engineMode === 'save') ? '▲' : '';
  const col = pct > 60 ? 'var(--green)' : pct > 30 ? 'var(--amber)' : 'var(--red)';
  return `<span class="battery-chip" style="color:${col}" title="Battery">
    ${BATTERY_SVG(pct)}
    <span>${pct}%${arrow}</span>
  </span>`;
}

function hasOnlyOneCompound(d){
  const used = d.usedCompounds || new Set();
  const dryUsed = new Set();
  used.forEach(c=>{ if(['S','M','H'].includes(c)) dryUsed.add(c); });
  return dryUsed.size < 2;
}

function renderTower(){
  const body = document.getElementById('towerBody');
  if(!body || !RACE) return;
  body.innerHTML = '';
  const myTeamId = STATE.myTeamId;
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  const isWetRace = wet > 0.2;
  const leaderTime = RACE.drivers.find(d=>!d.retired)?.totalTime || 0;

  RACE.drivers.forEach(d=>{
    const team = teamById(d.teamId);
    const row = document.createElement('div');
    let cls = 'tt-row';
    if(d.teamId===myTeamId) cls += ' me';
    if(d.retired) cls += ' retired';
    row.className = cls;

    const crown = (RACE.fastestLapHolder===d.abbr) ? ' <span class="crown">♛</span>' : '';
    const lapped = !d.retired && ((d.totalTime - leaderTime) / BASE_LAP) >= 1;
    const lapCount = lapped ? Math.floor((d.totalTime - leaderTime) / BASE_LAP) : 0;
    let gapText;
    if(d.retired) gapText = (d.retiredReason==='crash'?'DNF-CR':'DNF-MEC');
    else if(d.position===1) gapText = 'LEADER';
    else gapText = '+'+d.interval.toFixed(1)+'s';
    const life = d.retired ? 0 : Math.round(tyreLifePercent(d));

    const chips = [];
    if(d.retired) chips.push('<span class="chip">DNF</span>');
    if(lapped) chips.push(`<span class="chip lapped">+${lapCount} LAP${lapCount>1?'S':''}</span>`);
    if(!d.retired && d.engineMode === 'attack') chips.push('<span class="chip attack">ATTACK</span>');
    if(!d.retired && d.engineMode === 'save') chips.push('<span class="chip save">SAVE</span>');
    if(!d.retired && d.rechargeUntilLap && RACE.lap <= d.rechargeUntilLap) chips.push('<span class="chip" style="background:rgba(95,184,120,0.24);color:var(--green)">🔌</span>');
    if(!d.retired && d.damage >= 4) chips.push('<span class="chip damage">🔧</span>');
    if(!d.retired && d.penaltyLapsLeft > 0) chips.push('<span class="chip penalty">+5s</span>');
    if(!d.retired && d._stopGoPending) chips.push('<span class="chip penalty">S&G</span>');
    if(!d.retired && d._pitTimer > 0) chips.push('<span class="chip pit">PIT</span>');
    if(!d.retired && RACE.fastestLapHolder === d.abbr) chips.push('<span class="chip fastest">FL</span>');
    if(!d.retired && d._overtakeActive) chips.push('<span class="chip overtake">OVR</span>');
    if(!d.retired && !isWetRace && !RACE.isSprint && RACE.lap > 5 && hasOnlyOneCompound(d)){
      chips.push('<span class="chip compound-warn">1 COMPOUND</span>');
    }
    // Yellow sector indicator
    const anyYellow = RACE.sectors.some(s=>s==='yellow' || s==='red');
    const exemptFlags = RACE.scLapsRemaining > 0 || RACE.vscLapsRemaining > 0 || RACE.redFlagActive;
    if(!d.retired && anyYellow && !exemptFlags && (d.engineMode==='balanced'||d.engineMode==='attack')){
      chips.push('<span class="chip yellow-sector">⚠ YELLOW</span>');
    }
    if(!d.retired) chips.push(renderBatteryChip(d));

    row.innerHTML = `
      <span class="tt-pos">${d.position}</span>
      <span class="tt-driver"><span class="tt-team-pill" style="background:${team.color}"></span><span class="tt-driver-abbr">${d.abbr}</span>${crown}</span>
      <span class="tt-gap">${gapText}</span>
      <span class="tt-tyre tyre-${d.tyre}">${d.tyre}</span>
      <span class="tt-life">${d.retired?'':life+'%'}</span>
      <span class="tt-actions">${chips.join('')}</span>
    `;
    row.addEventListener('click', ()=>openDriverDetail(d));
    body.appendChild(row);
  });
}

function openDriverDetail(d){
  const team = teamById(d.teamId);
  const comp = COMPOUNDS[d.tyre];
  const life = Math.round(tyreLifePercent(d));
  const health = Math.round(carHealthPercent(d));
  const pitHistory = d.pitHistory.length ? d.pitHistory.map(p=>`L${p.lap} → ${p.tyre}`).join('<br>') : 'No stops yet';
  openModal(`
    <h2>${d.name}</h2>
    <p style="font-size:12px">${team.name} · #${d.num}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
      <div style="background:var(--panel2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="font-size:10px;color:var(--dimmer);text-transform:uppercase">Position</div><div style="font-size:15px;font-weight:700">${d.retired?'DNF':'P'+d.position}</div></div>
      <div style="background:var(--panel2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="font-size:10px;color:var(--dimmer);text-transform:uppercase">Interval</div><div style="font-size:15px;font-weight:700">${d.position===1?'—':'+'+d.interval.toFixed(1)+'s'}</div></div>
      <div style="background:var(--panel2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="font-size:10px;color:var(--dimmer);text-transform:uppercase">Tyre</div><div style="font-size:15px;font-weight:700">${comp.name} · ${d.tyreAge}L</div></div>
      <div style="background:var(--panel2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="font-size:10px;color:var(--dimmer);text-transform:uppercase">Life</div><div style="font-size:15px;font-weight:700">${life}%</div></div>
      <div style="background:var(--panel2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="font-size:10px;color:var(--dimmer);text-transform:uppercase">Fuel</div><div style="font-size:15px;font-weight:700">${Math.round(d.fuel)}%</div></div>
      <div style="background:var(--panel2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="font-size:10px;color:var(--dimmer);text-transform:uppercase">Battery</div><div style="font-size:15px;font-weight:700">${Math.round(d.battery)}%</div></div>
      <div style="background:var(--panel2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="font-size:10px;color:var(--dimmer);text-transform:uppercase">Health</div><div style="font-size:15px;font-weight:700">${health}%</div></div>
    </div>
    <div style="margin-top:14px"><div style="font-size:11px;color:var(--dim);text-transform:uppercase;margin-bottom:6px">Pit history</div><div style="font-size:12px;color:var(--dim);line-height:1.6">${pitHistory}</div></div>
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="ddClose">Close</button></div>
  `);
  document.getElementById('ddClose').addEventListener('click', closeModal);
}

// ============ STRIP ============
const HEADSET_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`;

function renderStrip(){
  const strip = document.getElementById('mystrip');
  if(!strip || !RACE) return;
  const myDrivers = RACE.drivers.filter(d => d.teamId === STATE.myTeamId);
  const allOnTrack = [...RACE.drivers].filter(d => !d.retired).sort((a,b) => a.totalTime - b.totalTime);
  const leaderTime = allOnTrack[0]?.totalTime ?? 0;

  strip.innerHTML = myDrivers.map(d=>{
    const pos = allOnTrack.indexOf(d) + 1;
    const gap = d.totalTime - leaderTime;
    const gapText = pos === 1 ? 'LEADER' : `+${gap.toFixed(1)}s`;
    const tyreColors = { S:'#ef4444', M:'#fbbf24', H:'#e5e7eb', I:'#22c55e', W:'#3b82f6' };
    const life = d.retired ? 0 : Math.round(tyreLifePercent(d));
    const posText = d.retired ? 'DNF' : 'P'+pos;
    const armedClass = d._armedPit ? 'armed' : '';
    const btnLabel = d._armedPit ? 'BOX' : 'PIT';
    const inPit = d._pitTimer > 0 ? ' · IN PIT' : '';
    const batPct = Math.round(d.battery);
    const batCol = batPct > 60 ? 'var(--green)' : batPct > 30 ? 'var(--amber)' : 'var(--red)';

    const boostDisabled = d.retired || d._pitTimer > 0 || d.battery < 25;
    const rechargeDisabled = d.retired || d._pitTimer > 0
      || RACE.scLapsRemaining > 0 || RACE.vscLapsRemaining > 0
      || RACE.redFlagActive
      || (d.rechargeCooldownUntilLap && RACE.lap < d.rechargeCooldownUntilLap)
      || (d.rechargeUntilLap && RACE.lap <= d.rechargeUntilLap);
    const boostActive = d.boostEffect && RACE.lap <= d.boostEffect.untilLap;
    const rechargeActive = d.rechargeUntilLap && RACE.lap <= d.rechargeUntilLap;

    return `
      <div class="myrow" data-abbr="${d.abbr}">
        <span class="pos">${posText}</span>
        <span class="num" style="background:${teamById(d.teamId).color}">${d.num}</span>
        <span class="gap">${d.retired?'—':gapText + inPit}</span>
        <span class="tyre">
          <span class="circle" style="border-color:${tyreColors[d.tyre]}; color:${tyreColors[d.tyre]}">${d.tyre}</span>
          <span class="life">${life}%</span>
          <span class="battery-wrap" title="Battery">${BATTERY_SVG(batPct)}<span style="color:${batCol};font-size:10px;margin-left:2px">${batPct}%</span></span>
        </span>
        <button class="icon-btn ${d._radioOpen?'active':''}" data-radio-abbr="${d.abbr}" title="Radio">${HEADSET_SVG}</button>
        <button class="pbtn ${armedClass}" data-pit-abbr="${d.abbr}">${btnLabel}</button>
        <button class="icon-btn boost ${boostActive?'active':''}" data-boost-abbr="${d.abbr}" title="Boost ⚡" ${boostDisabled?'disabled':''}>⚡</button>
        <button class="icon-btn recharge ${rechargeActive?'active':''}" data-recharge-abbr="${d.abbr}" title="Recharge 🔌" ${rechargeDisabled?'disabled':''}>🔌</button>
        <div class="radio-panel ${d._radioOpen?'active':''}" data-radio-panel="${d.abbr}">
          <div class="radio-panel-title">Radio — ${d.name}</div>
          <div class="radio-buttons">
            ${RADIO_COMMANDS.map(c=>`
              <button class="btn btn-ghost btn-sm" data-radio-cmd="${c.key}" data-radio-target="${d.abbr}">${c.label}</button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  strip.querySelectorAll('.pbtn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const drv = RACE.drivers.find(x=>x.abbr===b.dataset.pitAbbr);
      openPitMenu(drv);
    });
  });
  strip.querySelectorAll('[data-radio-abbr]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const abbr = b.dataset.radioAbbr;
      const drv = RACE.drivers.find(x=>x.abbr===abbr);
      RACE.drivers.forEach(x=>{ if(x.abbr !== abbr) x._radioOpen = false; });
      if(drv) drv._radioOpen = !drv._radioOpen;
      strip.querySelectorAll('.radio-panel').forEach(p=>{
        p.classList.toggle('active', p.dataset.radioPanel === abbr && drv?._radioOpen);
      });
      strip.querySelectorAll('[data-radio-abbr]').forEach(x=>{
        x.classList.toggle('active', x.dataset.radioAbbr === abbr && drv?._radioOpen);
      });
    });
  });
  strip.querySelectorAll('[data-radio-cmd]').forEach(b=>{
    b.addEventListener('click', ()=>{
      sendRadioFor(b.dataset.radioTarget, b.dataset.radioCmd);
    });
  });
  strip.querySelectorAll('[data-boost-abbr]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const drv = RACE.drivers.find(x=>x.abbr===b.dataset.boostAbbr);
      sendBoost(drv);
      renderStrip();
    });
  });
  strip.querySelectorAll('[data-recharge-abbr]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const drv = RACE.drivers.find(x=>x.abbr===b.dataset.rechargeAbbr);
      sendRecharge(drv);
      renderStrip();
    });
  });
}

function renderPitBox(){
  const box = document.getElementById('pitbox');
  if(!box || !RACE) return;

  if(RACE.redFlagActive){
    const active = RACE.drivers.filter(d => !d.retired);
    box.innerHTML = '<span class="label">PIT BOX — RED FLAG</span>' +
      active.map(d=>`
        <div class="slot">
          <div class="cell" style="background:${teamById(d.teamId).color}">${d.num}</div>
          <div class="bar"><div style="width:100%"></div></div>
        </div>
      `).join('');
    return;
  }

  const pitting = RACE.drivers.filter(d => d._pitTimer > 0);
  if(pitting.length === 0){
    box.innerHTML = '<span class="label">PIT BOX</span><span class="empty">— no cars in pit —</span>';
    return;
  }
  box.innerHTML = '<span class="label">PIT BOX</span>' + pitting.map(d=>{
    const pct = 1 - (d._pitTimer / 0.6);
    return `
      <div class="slot">
        <div class="cell" style="background:${teamById(d.teamId).color}">${d.num}</div>
        <div class="bar"><div style="width:${clamp(pct*100, 0, 100)}%"></div></div>
      </div>
    `;
  }).join('');
}

function openPitMenu(driver){
  if(!driver || driver.retired) return;
  if(driver._armedPit){ cancelPit(driver); renderStrip(); return; }
  const life = Math.round(tyreLifePercent(driver));
  const health = Math.round(carHealthPercent(driver));
  const compounds = ['S','M','H','I','W'];
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  const isWetRace = wet > 0.2;
  const warnCompound = (!isWetRace && !RACE.isSprint && hasOnlyOneCompound(driver))
    ? '<div class="warn-banner">⚠ <span>Dry race rule: you must use at least 2 different dry compounds, or you will be disqualified.</span></div>'
    : '';
  const warnSprint = (RACE.isSprint && !driver.hasPitted)
    ? '<div class="warn-banner">⚠ <span>Sprint race: you must make at least 1 pit stop on a different compound.</span></div>'
    : '';

  openModal(`
    <h2>Pit call — ${driver.name}</h2>
    <p style="font-size:12px">Current: ${COMPOUNDS[driver.tyre].name} · Tyres ${life}% · Car ${health}%</p>
    ${warnCompound}
    ${warnSprint}
    <div style="font-size:11.5px;color:var(--dim);margin:14px 0 6px">New tyres</div>
    <div class="tyre-select" id="pitTyreRow">
      ${compounds.map(c=>{
        const isCurrent = c === driver.tyre;
        return `
        <button class="tyre-btn compact pit-tyre ${isCurrent?'active':''}" data-tyre="${c}">
          <span class="tyre-circle tyre-${c}">${c}</span>
        </button>`;
      }).join('')}
    </div>
    <div style="font-size:11.5px;color:var(--dim);margin:14px 0 6px">Repairs (optional)</div>
    <div class="tyre-select" id="pitRepairRow">
      <button class="tyre-btn pit-repair active" data-repair="0"><span class="spanner">🔧</span>None</button>
      <button class="tyre-btn pit-repair" data-repair="2" ${driver.damage < 1 ? 'disabled' : ''}><span class="spanner">🔧</span>Minor +12s</button>
      <button class="tyre-btn pit-repair" data-repair="5" ${driver.damage < 3 ? 'disabled' : ''}><span class="spanner">🔧</span>Major +30s</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="btnPitCancel">Cancel</button>
      <button class="btn btn-primary btn-sm" id="btnPitConfirm">Confirm box</button>
    </div>
  `);
  let chosenTyre = driver.tyre;
  let chosenRepair = 0;
  document.querySelectorAll('.pit-tyre').forEach(b=>b.addEventListener('click', ()=>{
    chosenTyre = b.dataset.tyre;
    document.querySelectorAll('.pit-tyre').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  }));
  document.querySelectorAll('.pit-repair').forEach(b=>b.addEventListener('click', ()=>{
    if(b.disabled) return;
    chosenRepair = parseInt(b.dataset.repair);
    document.querySelectorAll('.pit-repair').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  }));
  document.getElementById('btnPitCancel').addEventListener('click', closeModal);
  document.getElementById('btnPitConfirm').addEventListener('click', ()=>{
    armPit(driver, chosenTyre, chosenRepair);
    closeModal();
    renderStrip();
  });
}

function sendRadioFor(abbr, key){
  const cmd = RADIO_COMMANDS.find(c=>c.key===key);
  if(!cmd || !RACE) return;
  const driver = RACE.drivers.find(d=>d.abbr===abbr);
  if(!driver || driver.retired) return;

  driver.radioEffect = {
    paceBonus: cmd.effect.paceBonus || 0,
    degMult: cmd.effect.degMult || 1,
    untilLap: RACE.lap + (cmd.effect.durationLaps || 3),
  };
  if(cmd.effect.teamOrder) driver.orders = cmd.effect.teamOrder;
  pushMsg('cmd', 'CMD:', cmd.label);
  setTimeout(()=>pushMsg('driver', abbr+':', cmd.reply), 500);
  beep('radio');
  driver._radioOpen = false;
  const strip = document.getElementById('mystrip');
  strip.querySelectorAll('.radio-panel').forEach(p=>p.classList.remove('active'));
  strip.querySelectorAll('[data-radio-abbr]').forEach(x=>x.classList.remove('active'));
}

// ============ BOOST ============
function sendBoost(driver){
  if(!driver || driver.retired) return;
  if(driver._pitTimer > 0) return;
  if(driver.battery < 25){
    pushMsg('strat', 'STRAT:', `${driver.name}: battery too low for boost.`);
    return;
  }
  driver.battery = Math.max(0, driver.battery - 25);
  driver.boostEffect = { untilLap: RACE.lap + 2 };
  pushMsg('cmd', 'CMD:', `Boost — deploying full power.`);
  setTimeout(()=>pushMsg('driver', driver.abbr+':', 'Deploying full power!'), 400);
  beep('radio');
}

// ============ RECHARGE ============
function sendRecharge(driver){
  if(!driver || driver.retired) return;
  if(driver._pitTimer > 0) return;
  if(RACE.scLapsRemaining > 0 || RACE.vscLapsRemaining > 0 || RACE.redFlagActive){
    pushMsg('strat', 'STRAT:', `Cannot recharge under caution.`);
    return;
  }
  if(driver.rechargeCooldownUntilLap && RACE.lap < driver.rechargeCooldownUntilLap){
    pushMsg('strat', 'STRAT:', `${driver.name}: recharge on cooldown.`);
    return;
  }
  if(driver.rechargeUntilLap && RACE.lap <= driver.rechargeUntilLap){
    pushMsg('strat', 'STRAT:', `${driver.name} already recharging.`);
    return;
  }
  driver.rechargeUntilLap = RACE.lap + 1;
  driver.rechargeCooldownUntilLap = RACE.lap + 4;
  pushMsg('cmd', 'CMD:', `Recharge mode — you'll lose time this lap.`);
  setTimeout(()=>pushMsg('driver', driver.abbr+':', 'Copy. Plugging in.'), 400);
  beep('radio');
}

// ============ TRACK VIEW ============
function drawTrackView(){
  const canvas = document.getElementById('trackCanvas');
  if(!canvas || !RACE) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const trackData = getTrackData(RACE.track);
  if(!trackData){
    ctx.fillStyle = '#565D6A';
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No track data available', w/2, h/2);
    return;
  }

  const { points, cum, total, sfFraction } = trackData;
  const pad = 30;
  const trackW = w - pad * 2;
  const trackH = h - pad * 2;

  const isSC = RACE.scLapsRemaining > 0 || RACE.vscLapsRemaining > 0;
  const isRed = RACE.redFlagActive;
  const ribbonColor = isRed ? '#5a1a1a' : isSC ? '#4a3a12' : '#1a1f28';
  const outlineColor = isRed ? '#C4453D' : isSC ? '#E8A93A' : '#2A2F38';

  ctx.beginPath();
  for(let i=0; i<=points.length; i++){
    const p = points[i % points.length];
    const x = pad + p.x * trackW;
    const y = pad + p.y * trackH;
    if(i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.lineWidth = 16;
  ctx.strokeStyle = ribbonColor;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.lineWidth = isRed || isSC ? 3 : 2;
  ctx.strokeStyle = outlineColor;
  ctx.stroke();

  // S/F marker on the longest straight
  const sfPt = positionAtFraction(points, cum, total, sfFraction);
  const sfX = pad + sfPt.x * trackW;
  const sfY = pad + sfPt.y * trackH;
  ctx.beginPath();
  ctx.arc(sfX, sfY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#EDEAE2';
  ctx.fill();

  const active = RACE.drivers.filter(d => !d.retired && d._pitTimer === 0);
  if(active.length === 0) return;

  const drawOrder = active.slice().sort((a,b)=>{
    const aMine = a.teamId === STATE.myTeamId ? 1 : 0;
    const bMine = b.teamId === STATE.myTeamId ? 1 : 0;
    return aMine - bMine;
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const leaderTotalTime = drawOrder.reduce((min,d)=> d.totalTime < min ? d.totalTime : min, Infinity);
  const glowPhase = (performance.now() % 1600) / 1600;
  const glowAlpha = 0.4 + 0.3 * Math.sin(glowPhase * Math.PI * 2);

  drawOrder.forEach(d=>{
    const lapsBehindLeader = (d.totalTime - leaderTotalTime) / BASE_LAP;
    const baseLaps = RACE.lap - lapsBehindLeader;
    const visualLaps = baseLaps + trackAnimTime;
    // Offset visual progress by SF position so cars cross the S/F line at lap transitions
    const phase = ((visualLaps + sfFraction) % 1 + 1) % 1;

    const pt = positionAtFraction(points, cum, total, phase);
    const x = pad + pt.x * trackW;
    const y = pad + pt.y * trackH;
    const isMine = d.teamId === STATE.myTeamId;
    const radius = isMine ? 8.5 : 8;
    const font = isMine ? 10 : 9;
    const teamColor = teamById(d.teamId).color;
    const lapped = Math.floor(lapsBehindLeader) >= 1;

    // Player glow
    if(isMine){
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.9, 0, Math.PI * 2);
      ctx.fillStyle = teamColor;
      ctx.globalAlpha = lapped ? glowAlpha * 0.5 : glowAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if(lapped){
      // Hollow ring for lapped cars
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = teamColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = teamColor;
      ctx.fill();

      ctx.fillStyle = '#0B0D10';
      ctx.font = `bold ${font}px ui-monospace, monospace`;
      ctx.fillText(String(d.num), x, y + 1);
    }

    if(d._armedPit){
      ctx.fillStyle = '#5FB878';
      ctx.beginPath();
      ctx.moveTo(x, y - radius - 4);
      ctx.lineTo(x + 5, y - radius - 10);
      ctx.lineTo(x - 5, y - radius - 10);
      ctx.closePath();
      ctx.fill();
    }
  });

  ctx.fillStyle = '#8B92A0';
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${RACE.track.name} — Lap ${RACE.lap}/${RACE.laps}`, pad, 10);
}

// ============ FINISH =====================
function finishRace(){
  RACE.finished = true;
  const el = document.getElementById('flagIndicator');
  if(el){
    el.className = 'flag-indicator flag-checkered';
    el.textContent = 'Finished';
  }
  pushMsg('rc', 'RC:', 'Chequered flag.');
}

function showRaceResults(){
  stopRenderLoop();

  const classified = RACE.drivers.filter(d=>!d.retired);
  const dnfs = RACE.drivers.filter(d=>d.retired);
  const results = [...classified, ...dnfs];

  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  const isWetRace = wet > 0.2 || RACE.weatherPattern === 'full_wet' || RACE.weatherPattern === 'wet_drying';

  RACE.drivers.forEach(d=>{
    if(d.retired) return;
    if(RACE.isSprint){
      if(!d.hasPitted){
        d.dsqSprint = true;
        pushMsg('rc', 'RC:', `${d.abbr} DISQUALIFIED — mandatory stop not taken.`);
      }
      return;
    }
    if(isWetRace) return;
    const dryUsed = new Set();
    (d.usedCompounds || new Set()).forEach(c=>{ if(['S','M','H'].includes(c)) dryUsed.add(c); });
    if(dryUsed.size < 2){
      d.dsqSprint = true;
      const usedList = Array.from(dryUsed).map(c=>COMPOUNDS[c].name).join(', ') || 'none';
      pushMsg('rc', 'RC:', `${d.abbr} DISQUALIFIED — only used ${list}.`);
    }
  });

  // HydroGlow — check late surge
  if(!RACE.isSprint){
    RACE.drivers.forEach(d=>{
      if(d.retired) return;
      const finalPos = RACE.drivers.filter(x=>!x.retired).sort((a,b)=>a.totalTime-b.totalTime).indexOf(d) + 1;
      const posAtLap5 = d._posAtLap5;
      if(posAtLap5 && (posAtLap5 - finalPos) >= 3){
        if(d.teamId === STATE.myTeamId){
          const bonus = STATE.driverRatingBonus[d.abbr] || 0;
          if(bonus < 0.2){
            STATE.driverRatingBonus[d.abbr] = bonus + 0.2;
            STATE.sponsors.events.hydroglow.claimed = true;
            pushMsg('cmd', 'HYDROGLOW:', `${d.abbr} late surge bonus — +0.2 rating.`);
          }
        }
      }
    });
  }

  const fastest = RACE.drivers.find(d=>d.abbr === RACE.fastestLapHolder && !d.retired);
  let biggestMover = null, biggestMove = 0;
  results.forEach((d, i)=>{
    if(d.retired) return;
    const move = d.startPosition - (i+1);
    if(move > biggestMove){ biggestMove = move; biggestMover = d; }
  });

  const classification = results.map((d, i)=>{
    const pos = i + 1;
    const retired = d.retired;
    const dsq = !!d.dsqSprint;
    const rating = computeDriverRating({
      finishPos: retired ? 22 : pos,
      startPos: d.startPosition,
      retired: retired || dsq,
      fastestLap: d.abbr === RACE.fastestLapHolder,
      hadContact: d._hadContact,
    });
    return {
      abbr: d.abbr, name: d.name, num: d.num,
      teamId: d.teamId, teamName: teamById(d.teamId).name,
      pos: (retired || dsq) ? null : pos,
      retired, dsq, rating,
      startPos: d.startPosition,
    };
  });

  if(RACE.isSprint){
    renderSprintResults(results, classification);
    return;
  }

  let myPrize = 0;
  const myResults = [];
  results.forEach((d,i)=>{
    const pts = i<POINTS_TABLE.length && !d.retired && !d.dsqSprint ? POINTS_TABLE[i] : 0;
    STATE.driversPoints[d.abbr] = (STATE.driversPoints[d.abbr]||0) + pts;
    STATE.constructorsPoints[d.teamId] = (STATE.constructorsPoints[d.teamId]||0) + pts;
    const stats = STATE.driverSeasonStats[d.abbr] || (STATE.driverSeasonStats[d.abbr] = { points:0, wins:0, podiums:0, poles:0, fastestLaps:0, dnfs:0, ratings:[] });
    stats.points += pts;
    if(i === 0 && !d.retired && !d.dsqSprint) stats.wins++;
    if(i <= 2 && !d.retired && !d.dsqSprint) stats.podiums++;
    if(d.abbr === RACE.fastestLapHolder) stats.fastestLaps++;
    if(d.retired) stats.dnfs++;
    const rating = classification.find(c=>c.abbr === d.abbr)?.rating || 5;
    stats.ratings.push(rating);
    if(d.teamId === STATE.myTeamId){
      myPrize += PRIZE_BY_POS[i] || PRIZE_BY_POS[PRIZE_BY_POS.length-1];
      myResults.push({ abbr:d.abbr, name:d.name, pos:i+1, retired:d.retired, dsq:d.dsqSprint });
    }
  });

  RACE.drivers.forEach(d=>{
    if(d.startPosition === 1){
      const stats = STATE.driverSeasonStats[d.abbr];
      if(stats) stats.poles++;
    }
  });

  if(fastest && fastest.position <= 10){
    STATE.driversPoints[fastest.abbr] = (STATE.driversPoints[fastest.abbr]||0) + 1;
    STATE.constructorsPoints[fastest.teamId] = (STATE.constructorsPoints[fastest.teamId]||0) + 1;
    const stats = STATE.driverSeasonStats[fastest.abbr];
    if(stats) stats.points += 1;
  }

  // Main sponsor per-race income
  if(STATE.sponsors && STATE.sponsors.main){
    const perRace = STATE.sponsors.main.perRace || 0;
    STATE.budget += perRace;
  }

  // Kurosu — check longest stint on dry tyre with life >= 30%
  if(!isWetRace && !STATE.sponsors.events.kurosu.claimed){
    const dryStints = [];
    RACE.drivers.forEach(d=>{
      if(d.teamId !== STATE.myTeamId) return;
      let stintStart = 0;
      let stintTyre = null;
      for(let l = 0; l < d.pitHistory.length; l++){
        // Not tracked per lap in this version — skip narrative, mark as pending
      }
    });
    // Simplified: check if any of my drivers completed 25+ laps without pitting (approximation)
    const maxStint = Math.max(...RACE.drivers.filter(d=>d.teamId===STATE.myTeamId).map(d=>{
      const h = d.pitHistory;
      if(h.length === 0) return RACE.laps;
      let maxGap = h[0].lap;
      for(let i=1;i<h.length;i++) maxGap = Math.max(maxGap, h[i].lap - h[i-1].lap);
      maxGap = Math.max(maxGap, RACE.laps - h[h.length-1].lap);
      return maxGap;
    }), 0);
    if(maxStint >= 25){
      STATE.sponsors.events.kurosu.claimed = true;
      STATE.tyreMgmtBonus = (STATE.tyreMgmtBonus || 0) + 0.02;
      pushMsg('cmd', 'KUROSU:', `The Long Stint complete — +1 Tyre Management.`);
    }
  }

  const seasonEntry = ensureCurrentSeasonEntry();
  const track = RACE.track;
  seasonEntry.races[STATE.round] = {
    trackId: track.id, trackName: track.name, classification,
    winnerAbbr: results[0]?.abbr || null,
    yourBestAbbr: myResults.filter(r=>!r.retired && !r.dsq).sort((a,b)=>a.pos-b.pos)[0]?.abbr || null,
    yourBestPos: myResults.filter(r=>!r.retired && !r.dsq).sort((a,b)=>a.pos-b.pos)[0]?.pos || null,
    fastestLapAbbr: RACE.fastestLapHolder,
    fastestLapName: fastest ? fastest.name : null,
    biggestMoverAbbr: biggestMover?.abbr || null,
    biggestMoverName: biggestMover?.name || null,
    biggestMoverPlaces: biggestMove,
  };

  const bestPos = myResults.filter(r=>!r.retired && !r.dsq).sort((a,b)=>a.pos-b.pos)[0]?.pos || 20;
  const expected = { title:3, contender:6, midfield:9, backmarker:12 }[myTeam().tier];
  const delta = clamp((expected - bestPos) * 1.2, -12, 14);
  STATE.boardConf = clamp(STATE.boardConf + delta, 0, 100);

  // Nova Pay — Executive Ultimatum at last race of season
  if(STATE.round === TRACKS.length - 1 && STATE.sponsors.main){
    const myPointsFinishers = myResults.filter(r=>!r.retired && !r.dsq && r.pos <= 10).length;
    if(myPointsFinishers < 2){
      STATE.sponsors.main.renewalModifier = 0.6;
      pushMsg('rc', 'NOVA PAY:', `Executive Ultimatum failed — renewal clause drops 40%.`);
    } else {
      pushMsg('rc', 'NOVA PAY:', `Executive Ultimatum satisfied — full renewal.`);
    }
  }

  STATE.round++;
  applyPendingUpgrades();
  runAduoReviewIfNeeded();
  saveToSlot(activeSlot);

  if(STATE.boardConf <= 5 && STATE.round < TRACKS.length){ renderFiredModal(); return; }

  renderResultsModal(results, myResults, myPrize, delta, classification);
}

function renderSprintResults(results, classification){
  const rows = results.map((d,i)=>{
    const t = teamById(d.teamId);
    const c = classification.find(x=>x.abbr===d.abbr);
    const status = c.dsq ? 'DSQ' : (d.retired ? (d.retiredReason==='crash'?'DNF (crash)':'DNF (mec)') : `P${i+1}`);
    const rating = c ? c.rating.toFixed(1) : '—';
    const ratingClass = c && c.rating >= 7.5 ? 'rating-high' : c && c.rating >= 5 ? 'rating-mid' : 'rating-low';
    return `<div class="rd-row ${d.teamId===STATE.myTeamId?'me':''} ${d.retired?'dnf':''}">
      <span class="rd-pos">${status}</span>
      <div>
        <div class="rd-name">${d.name}</div>
        <div class="rd-team">${t.name}</div>
      </div>
      <span class="rd-rating ${ratingClass}">${rating}</span>
      <span></span>
    </div>`;
  }).join('');

  openModal(`
    <h2>Sprint Result — ${RACE.track.name}</h2>
    <p style="font-size:12px">Reverse grid · 1 mandatory stop</p>
    <div style="max-height:420px;overflow-y:auto;margin:8px 0">
      <div class="race-detail-classification">${rows}</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="btnSprintAnother">Race another sprint</button>
      <button class="btn btn-primary btn-sm" id="btnSprintBack">Back to intro</button>
    </div>
  `);
  document.getElementById('btnSprintBack').addEventListener('click', ()=>{
    closeModal();
    window.SPRINT = null;
    showScreen('screen-intro');
  });
  document.getElementById('btnSprintAnother').addEventListener('click', ()=>{
    closeModal();
    SPRINT = { trackId: RACE.track.id, teamId: null, revealed: false };
    showScreen('screen-sprintsetup');
    renderSprintSetup();
  });
}

function renderResultsModal(results, myResults, myPrize, delta, classification){
  const rows = results.map((d,i)=>{
    const t = teamById(d.teamId);
    const c = classification.find(x=>x.abbr===d.abbr);
    const pts = i<POINTS_TABLE.length && !d.retired && !d.dsqSprint ? POINTS_TABLE[i] : 0;
    const rating = c ? c.rating.toFixed(1) : '—';
    const ratingClass = c && c.rating >= 7.5 ? 'rating-high' : c && c.rating >= 5 ? 'rating-mid' : 'rating-low';
    const posLabel = c.dsq ? 'DSQ' : (d.retired ? 'DNF' : 'P'+(i+1));
    return `<div class="rd-row ${d.teamId===STATE.myTeamId?'me':''} ${d.retired?'dnf':''}">
      <span class="rd-pos">${posLabel}</span>
      <div>
        <div class="rd-name">${d.name}</div>
        <div class="rd-team">${t.name}</div>
      </div>
      <span class="rd-rating ${ratingClass}">${rating}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--dim);min-width:32px;text-align:right">${pts?'+'+pts:''}</span>
    </div>`;
  }).join('');

  const deltaText = delta>0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
  const deltaColor = delta>0?'var(--green)':delta<0?'var(--red)':'var(--dim)';

  openModal(`
    <h2>Race Result — ${RACE.track.name}</h2>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px">
      <span class="team-stat-mini">PRIZE <b style="color:var(--amber)">${fmtMoney(myPrize)}</b></span>
      <span class="team-stat-mini">SPONSOR <b style="color:var(--amber)">${fmtMoney((STATE.sponsors.main && STATE.sponsors.main.perRace) || 0)}</b></span>
      <span class="team-stat-mini">BOARD <b style="color:${deltaColor}">${deltaText}%</b></span>
      <span class="team-stat-mini">CONFIDENCE <b>${Math.round(STATE.boardConf)}%</b></span>
    </div>
    <div style="max-height:420px;overflow-y:auto;margin:8px 0">
      <div class="race-detail-classification">${rows}</div>
    </div>
    <div class="modal-actions"><button class="btn btn-primary btn-sm" id="btnBackToHub">Back to pit wall</button></div>
  `);
  document.getElementById('btnBackToHub').addEventListener('click', ()=>{
    closeModal();
    enterHub();
  });
}

function renderFiredModal(){
  openModal(`
    <h2 style="color:var(--red)">You have been fired</h2>
    <p>The board has lost confidence in your leadership. Your seat is gone.</p>
    <p>You ran ${STATE.round} races this season before being dismissed.</p>
    <div class="modal-actions">
      <button class="btn btn-danger btn-sm" id="btnFiredRestart">Start a new career</button>
    </div>
  `);
  document.getElementById('btnFiredRestart').addEventListener('click', ()=>{
    clearSlot(activeSlot);
    closeModal();
    showScreen('screen-intro');
  });
}

// ===================== BOOT =====================
(function boot(){
  document.getElementById('btnLoadGame').disabled = !hasAnySave();
  showScreen('screen-intro');
})();
