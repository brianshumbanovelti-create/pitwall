// ===================== STATE =====================
const SAVE_PREFIX = 'pitwall_slot_';
const SAVE_SLOTS = 3;
const SAVE_VERSION = 3;

let STATE = null;
let activeSlot = 0;

function blankState(teamId){
  return {
    version: SAVE_VERSION,
    myTeamId: teamId,
    season: 1,
    round: 0,
    budget: 0,
    engineers: {},
    candidates: [],
    constructorsPoints: Object.fromEntries(TEAMS.map(t=>[t.id,0])),
    driversPoints: Object.fromEntries(TEAMS.flatMap(t=>t.drivers.map(d=>[d.abbr,0]))),
    driverTeam: Object.fromEntries(TEAMS.flatMap(t=>t.drivers.map(d=>[d.abbr,t.id]))),
    carPaceBoost: 0,
    carReliabilityBoost: 0,
    strategyBoost: 0,
    boardConf: 70,
    raceLog: [],
    seasonArchive: [],
    upgrades: { aero:0, pu:0, rel:0, strat:0 },
    settings: { sound: true },
    achievements: {},
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
  return s;
}

function makeStarterEngineer(roleKey, tier){
  const role = ENGINEER_ROLES.find(r=>r.key===roleKey);
  const base = { title:78, contender:68, midfield:58, backmarker:48 }[tier];
  return {
    id: roleKey+'_start',
    name: randName(),
    role: roleKey,
    roleLabel: role.label,
    affects: role.affects,
    skill: clamp(base + rand(-4,4), 20, 99),
  };
}
function randName(){ return `${pick(ENGINEER_FIRST)} ${pick(ENGINEER_LAST)}`; }
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randf(min,max){ return Math.random()*(max-min)+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

// ===================== PERSISTENCE =====================
function saveToSlot(slot){
  try{ localStorage.setItem(SAVE_PREFIX+slot, JSON.stringify(STATE)); }catch(e){}
}
function loadFromSlot(slot){
  try{
    const raw = localStorage.getItem(SAVE_PREFIX+slot);
    if(!raw) return null;
    const s = JSON.parse(raw);
    // Migrate older saves minimally
    if(!s.boardConf) s.boardConf = 70;
    if(!s.upgrades) s.upgrades = {aero:0,pu:0,rel:0,strat:0};
    if(!s.settings) s.settings = { sound:true };
    if(!s.achievements) s.achievements = {};
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
document.getElementById('btnGoTeamSelect').addEventListener('click', ()=>{
  renderTeamSelect();
  showScreen('screen-teamselect');
});
document.getElementById('btnLoadGame').addEventListener('click', openSaveSlots);
document.getElementById('btnSaveSlots').addEventListener('click', openSaveSlots);
document.getElementById('btnSettings').addEventListener('click', openSettings);

function openSaveSlots(){
  const html = `
    <h2>Save slots</h2>
    ${[0,1,2].map(i=>{
      const s = loadFromSlot(i);
      const meta = s
        ? `Season ${s.season} · Round ${s.round+1}/24 · ${TEAMS.find(t=>t.id===s.myTeamId).abbr} · $${s.budget}M`
        : 'Empty slot';
      return `<div class="save-slot">
        <div>
          <div style="font-weight:700;margin-bottom:3px">Slot ${i+1}</div>
          <div class="meta">${meta}</div>
        </div>
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
    closeModal();
    enterHub();
  }));
  document.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>{
    clearSlot(parseInt(b.dataset.del));
    openSaveSlots();
  }));
  document.getElementById('btnCloseSave').addEventListener('click', closeModal);
}

function openSettings(){
  const s = STATE ? STATE.settings : { sound:true };
  const html = `
    <h2>Settings</h2>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)">
      <span>Sound effects</span>
      <button class="btn btn-ghost btn-sm" id="btnToggleSound">${s.sound?'On':'Off'}</button>
    </div>
    <p style="margin-top:14px;font-size:12px">Sound is procedural (WebAudio beeps) — no external files.</p>
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="btnCloseSettings">Close</button></div>
  `;
  openModal(html);
  document.getElementById('btnToggleSound').addEventListener('click', ()=>{
    const cur = STATE ? STATE.settings : s;
    cur.sound = !cur.sound;
    if(STATE){ saveToSlot(activeSlot); }
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
    const obj = TIER_OBJECTIVES[team.tier];
    card.innerHTML = `
      <div class="team-card-top">
        <span class="team-abbr mono" style="color:${team.color}">${team.abbr}</span>
        <span class="team-tier tier-${team.tier}">${team.tier}</span>
      </div>
      <div class="team-name">${team.name}</div>
      <div class="team-drivers"><b>${team.drivers[0].abbr}</b> · <b>${team.drivers[1].abbr}</b></div>
      <div class="team-stats">
        <span class="team-stat-mini">PACE <b>${team.pace}</b></span>
        <span class="team-stat-mini">RELI <b>${team.reliability}</b></span>
        <span class="team-stat-mini">$ <b>${team.budget}M</b></span>
      </div>
      <div class="team-drivers" style="margin-top:2px;">Board: ${obj.label}</div>
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
document.getElementById('btnConfirmTeam').addEventListener('click', ()=>{
  if(!selectedTeamId) return;
  STATE = newGameState(selectedTeamId);
  activeSlot = 0;
  // find first empty slot
  for(let i=0;i<SAVE_SLOTS;i++){ if(!loadFromSlot(i)){ activeSlot = i; break; } }
  saveToSlot(activeSlot);
  enterHub();
});

// ===================== HUB =====================
function myTeam(){ return TEAMS.find(t=>t.id===STATE.myTeamId); }
function teamById(id){ return TEAMS.find(t=>t.id===id); }
function currentTrack(){ return TRACKS[STATE.round] || null; }

function enterHub(){
  renderHub();
  showScreen('screen-hub');
}

function renderHub(){
  const team = myTeam();
  document.getElementById('hubTeamLabel').innerHTML = `<b style="color:${team.color}">${team.abbr}</b> · ${team.name}`;
  document.getElementById('hubBudget').textContent = `$${STATE.budget}M`;
  document.getElementById('hubSeason').textContent = STATE.season;
  document.getElementById('hubRound').textContent = Math.min(STATE.round+1, TRACKS.length);
  document.getElementById('hubTotalRounds').textContent = TRACKS.length;

  renderConfBox();
  renderObjectiveBox();

  const cons = getConstructorsStandings();
  const myConsPos = cons.findIndex(s=>s.teamId===team.id)+1;
  document.getElementById('sideConsPos').textContent = myConsPos ? `P${myConsPos}` : '—';
  const driv = getDriversStandings();
  const mine = driv.filter(d=>STATE.driverTeam[d.abbr]===team.id);
  document.getElementById('sideDrivPos').textContent = mine[0] ? `P${driv.indexOf(mine[0])+1}` : '—';
  document.getElementById('sidePace').textContent = team.pace + STATE.carPaceBoost + (STATE.upgrades.aero+STATE.upgrades.pu)*2;
  document.getElementById('sideReli').textContent = team.reliability + STATE.carReliabilityBoost + STATE.upgrades.rel*2;

  renderHubMain();
}

function renderConfBox(){
  const c = STATE.boardConf;
  const col = c>60?'var(--green)':c>35?'var(--amber)':'var(--red)';
  const label = c>75?'Delighted':c>50?'Content':c>30?'Concerned':c>10?'Warning':'Critical';
  document.getElementById('confBox').innerHTML = `
    <div style="font-size:22px;font-weight:700;color:${col}">${Math.round(c)}%</div>
    <div style="font-size:11.5px;color:var(--dim)">${label}</div>
    <div class="conf-bar"><div class="conf-fill" style="width:${c}%;background:${col}"></div></div>
  `;
}

function renderObjectiveBox(){
  const team = myTeam();
  const obj = TIER_OBJECTIVES[team.tier];
  const cons = getConstructorsStandings();
  const myPos = cons.findIndex(s=>s.teamId===team.id)+1 || TEAMS.length;
  const racesLeft = TRACKS.length - STATE.round;

  let status = 'on-track', label = 'On track';
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
  return TEAMS.map(t=>({teamId:t.id, points:STATE.constructorsPoints[t.id]||0}))
    .sort((a,b)=>b.points-a.points);
}
function getDriversStandings(){
  return Object.entries(STATE.driversPoints).map(([abbr,points])=>({abbr,points}))
    .sort((a,b)=>b.points-a.points);
}

function renderHubMain(){
  const main = document.getElementById('hubMain');
  if(STATE.round >= TRACKS.length){ main.innerHTML = renderSeasonEndHTML(); bindSeasonEnd(); return; }
  const track = currentTrack();
  const team = myTeam();

  main.innerHTML = `
    <div class="hub-section">
      <div class="hub-section-title">Next race</div>
      <div class="hub-section-sub">Round ${STATE.round+1} of ${TRACKS.length} · Season ${STATE.season}</div>
      <div class="next-race-card">
        <div>
          <div class="nrc-round">ROUND ${STATE.round+1}</div>
          <div class="nrc-name">${track.name} — ${track.country}</div>
          <div class="nrc-meta">
            <span>🌡 ${track.tempC}°C air / ${track.trackTempC}°C track</span>
            <span>💨 ${track.windKmh} km/h</span>
            <span>${weatherLabel(track)}</span>
          </div>
        </div>
        <button class="btn btn-primary" id="btnStartWeekend">Go to pit wall</button>
      </div>
    </div>

    <div class="hub-section">
      <div class="hub-section-title">Constructors' Championship</div>
      <table class="standings-table">
        <thead><tr><th>Pos</th><th>Team</th><th>Points</th></tr></thead>
        <tbody id="consTableBody"></tbody>
      </table>
    </div>

    <div class="hub-section">
      <div class="hub-section-title">Engineering staff</div>
      <div class="hub-section-sub">Skill above 60 boosts your car's pace or reliability.</div>
      <div class="roster-grid" id="rosterGrid"></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="btnOpenHiring">View candidates</button>
        <button class="btn btn-ghost btn-sm" id="btnOpenUpgrades">Develop car</button>
        <button class="btn btn-ghost btn-sm" id="btnOpenArchive">Season archive</button>
      </div>
    </div>
  `;

  document.getElementById('btnStartWeekend').addEventListener('click', ()=>startWeekend());
  document.getElementById('btnOpenHiring').addEventListener('click', openHiringModal);
  document.getElementById('btnOpenUpgrades').addEventListener('click', openUpgradesModal);
  document.getElementById('btnOpenArchive').addEventListener('click', openArchiveModal);

  const consBody = document.getElementById('consTableBody');
  getConstructorsStandings().forEach((s,i)=>{
    const t = teamById(s.teamId);
    const tr = document.createElement('tr');
    if(t.id===STATE.myTeamId) tr.className='me';
    tr.innerHTML = `<td class="pos">${i+1}</td><td><span class="team-pill" style="background:${t.color}"></span>${t.abbr} <span class="dim" style="font-size:11px">${t.name}</span></td><td class="pts">${s.points}</td>`;
    consBody.appendChild(tr);
  });

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

function skillColor(s){ return s>=85?'var(--green)':s>=65?'var(--cyan)':s>=45?'var(--amber)':'var(--red)'; }
function weatherLabel(t){
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
        <div>
          <div class="nrc-round" style="color:${met?'var(--green)':'var(--red)'}">${met?'OBJECTIVE MET':'OBJECTIVE MISSED'}</div>
          <div class="nrc-name">Finished P${myPos} — ${obj.label}</div>
          <div class="nrc-meta" style="margin-top:6px"><span>Board confidence: ${Math.round(STATE.boardConf)}%</span></div>
        </div>
        <button class="btn btn-primary" id="btnNextSeason">Start season ${STATE.season+1}</button>
      </div>
    </div>
    <div class="hub-section">
      <div class="hub-section-title">Final standings</div>
      <table class="standings-table">
        <thead><tr><th>Pos</th><th>Team</th><th>Points</th></tr></thead>
        <tbody>
          ${cons.map((s,i)=>{
            const t = teamById(s.teamId);
            return `<tr class="${t.id===STATE.myTeamId?'me':''}"><td class="pos">${i+1}</td><td><span class="team-pill" style="background:${t.color}"></span>${t.abbr}</td><td class="pts">${s.points}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
function bindSeasonEnd(){
  const btn = document.getElementById('btnNextSeason');
  if(btn) btn.addEventListener('click', advanceSeason);
}

function advanceSeason(){
  // Archive
  STATE.seasonArchive.push({
    season: STATE.season,
    championTeam: getConstructorsStandings()[0].teamId,
    championDriver: getDriversStandings()[0].abbr,
    myPos: getConstructorsStandings().findIndex(s=>s.teamId===STATE.myTeamId)+1,
  });
  // Reset season
  STATE.season++;
  STATE.round = 0;
  STATE.constructorsPoints = Object.fromEntries(TEAMS.map(t=>[t.id,0]));
  STATE.driversPoints = Object.fromEntries(TEAMS.flatMap(t=>t.drivers.map(d=>[d.abbr,0])));
  // End-of-season bonus + engineer growth
  STATE.budget += (SEASON_END_BONUS[myTeam().tier] || 40);
  Object.values(STATE.engineers).forEach(e=>{ e.skill = clamp(e.skill + rand(0,3), 20, 99); });
  recalcCarBoosts();
  saveToSlot(activeSlot);
  renderHub();
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
    <p>Budget: <b style="color:var(--amber)">$${STATE.budget}M</b>. Hiring replaces your current engineer in that role.</p>
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
  const s = STATE.engineers.strategist.skill;
  STATE.carPaceBoost = Math.round(((a-60)+(p-60))/2 / 6);
  STATE.carReliabilityBoost = Math.round((r-60)/6);
  STATE.strategyBoost = Math.round((s-60)/8);
}

// ===================== UPGRADES =====================
function openUpgradesModal(){
  const slots = ['aero','pu','rel','strat'];
  const labels = { aero:'Aero Package', pu:'Power Unit', rel:'Reliability', strat:'Strategy Dept' };
  const cost = lvl => 15 + lvl*10;
  const render = ()=> openModal(`
    <h2>Car development</h2>
    <p>Budget: <b style="color:var(--amber)">$${STATE.budget}M</b>. Each upgrade adds +2 to a performance stat.</p>
    ${slots.map(s=>{
      const lvl = STATE.upgrades[s];
      const c = cost(lvl);
      const canDo = STATE.budget >= c;
      return `<div class="save-slot">
        <div>
          <div style="font-weight:700">${labels[s]}</div>
          <div class="meta">Level ${lvl} · Next: $${c}M</div>
        </div>
        <button class="btn btn-sm ${canDo?'btn-primary':'btn-ghost'}" data-up="${s}" ${canDo?'':'disabled'}>Upgrade +2</button>
      </div>`;
    }).join('')}
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="btnCloseUpgrades">Close</button></div>
  `);
  render();
  const bind = ()=>{
    document.querySelectorAll('[data-up]').forEach(b=>b.addEventListener('click', ()=>{
      const s = b.dataset.up;
      const c = cost(STATE.upgrades[s]);
      if(STATE.budget < c) return;
      STATE.budget -= c;
      STATE.upgrades[s]++;
      saveToSlot(activeSlot);
      render(); bind();
    }));
    document.getElementById('btnCloseUpgrades').addEventListener('click', ()=>{ closeModal(); renderHub(); });
  };
  bind();
}

// ===================== ARCHIVE =====================
function openArchiveModal(){
  const rows = STATE.seasonArchive.map(a=>`
    <div class="save-slot">
      <div>
        <div style="font-weight:700">Season ${a.season}</div>
        <div class="meta">Champion: ${a.championTeam.toUpperCase()} · Driver: ${a.championDriver} · You finished P${a.myPos}</div>
      </div>
    </div>
  `).join('') || '<p class="meta">No seasons archived yet.</p>';
  openModal(`
    <h2>Season archive</h2>
    ${rows}
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="btnCloseArchive">Close</button></div>
  `);
  document.getElementById('btnCloseArchive').addEventListener('click', closeModal);
}

// ===================== RACE SIM (called from weekend.js) =====================
const POINTS_TABLE = [25,18,15,12,10,8,6,4,2,1];
let RACE = null;
let raceInterval = null;
let raceSpeed = 1;
let racePaused = false;

function buildRaceState(track, gridOverride){
  const laps = track.laps;
  const wetness = computeWetnessCurve(track, laps);
  const grid = gridOverride || buildDefaultGrid();
  const drivers = grid.map((g,i)=>({
    abbr:g.abbr, name:g.name, teamId:g.teamId, skill:g.skill, consistency:g.consistency,
    position:i+1, startPosition:i+1,
    totalTime: 0,
    gapToLeader: 0, interval: 0,
    tyre:'M', tyreAge:0, pitStops:0, pitHistory:[],
    retired:false, retiredReason:null, retiredLap:null,
    damage:0, penaltyPending:0, penaltyServed:false,
    strategyPending:false,
    finishPos:null,
  }));
  return {
    track, laps, wetness, lap:0,
    flag:'green', flagLapsRemaining:0,
    drivers, finished:false, feed:[],
    myTeamId: STATE.myTeamId,
    pendingDecision:null,
    _lastWetBand: undefined,
  };
}

function computeWetnessCurve(track, laps){
  const curve = [];
  if(track.baseline==='wet-drying'){
    for(let l=0;l<laps;l++) curve.push(clamp(1 - (l/laps)/0.55, 0, 1));
  } else if(track.baseline==='dry-threat'){
    const arrives = Math.random() < track.rainChance*1.3;
    const rainLap = arrives ? Math.floor(laps*randf(0.3,0.75)) : null;
    for(let l=0;l<laps;l++){
      if(rainLap===null || l<rainLap) curve.push(0);
      else curve.push(clamp((l-rainLap)/Math.max(6,laps*0.2), 0, 0.85));
    }
  } else {
    const arrives = Math.random() < track.rainChance*0.5;
    const rainLap = arrives ? Math.floor(laps*randf(0.4,0.8)) : null;
    for(let l=0;l<laps;l++){
      if(rainLap===null || l<rainLap) curve.push(0);
      else curve.push(clamp((l-rainLap)/(laps*0.15), 0, 0.7));
    }
  }
  return curve;
}

function buildDefaultGrid(){
  const entries = [];
  TEAMS.forEach(team=>{
    const effPace = team.pace + (team.id===STATE.myTeamId?STATE.carPaceBoost:0) + (team.id===STATE.myTeamId?(STATE.upgrades.aero+STATE.upgrades.pu)*2:0);
    team.drivers.forEach(drv=>{
      const qualiScore = effPace*0.6 + drv.skill*0.4 + randf(-3,3);
      entries.push({ abbr:drv.abbr, name:drv.name, teamId:team.id, skill:drv.skill, consistency:drv.consistency, effPace, qualiScore });
    });
  });
  entries.sort((a,b)=>b.qualiScore-a.qualiScore);
  return entries;
}

function startRace(gridOverride, strategyOverride){
  const track = currentTrack();
  RACE = buildRaceState(track, gridOverride);
  // Apply player strategy to their cars
  if(strategyOverride){
    RACE.drivers.forEach(d=>{
      const s = strategyOverride[d.abbr];
      if(s){
        if(s.tyre) d.tyre = s.tyre;
        if(s.plan) d.pitPlan = s.plan;
        if(s.orders) d.orders = s.orders;
      } else {
        // AI starting tyres
        d.tyre = aiStartTyre(track);
      }
    });
  } else {
    RACE.drivers.forEach(d=>{ d.tyre = aiStartTyre(track); });
  }
  showScreen('screen-race');
  initRaceUI(track);
  renderTower();
  raceSpeed = 1; racePaused = false;
  setSpeedButtons();
  runRaceLoop();
}

function aiStartTyre(track){
  const t = track.trackTempC;
  const r = Math.random();
  if(track.baseline==='wet-drying' && r<0.6) return 'I';
  if(track.rainChance>0.4 && r<0.15) return 'I';
  if(t>38) return r<0.7?'M':'H';
  if(t<18) return r<0.5?'S':'M';
  return r<0.4?'M':(r<0.75?'S':'H');
}

function initRaceUI(track){
  document.getElementById('raceTrackName').textContent = `${track.name} — ${track.country}`;
  document.getElementById('raceTrackMeta').textContent = track.character;
  document.getElementById('lapTotal').textContent = track.laps;
  document.getElementById('lapNow').textContent = 0;
  updateWeatherChip();
  setFlag('green');
  document.getElementById('feedScroll').innerHTML = '';
  pushFeed(0, `Lights out at ${track.name}.`, 'good');
  document.getElementById('decisionBar').classList.remove('active');
}

function updateWeatherChip(){
  const t = RACE.track;
  const w = RACE.wetness[Math.min(RACE.lap, RACE.wetness.length-1)] || 0;
  let label;
  if(w>0.6) label = `🌧 Heavy rain · ${t.trackTempC}°C track`;
  else if(w>0.15) label = `🌦 Damp · ${t.trackTempC}°C track`;
  else label = `☀️ Dry · ${t.trackTempC}°C · ${t.windKmh}km/h`;
  document.getElementById('weatherChip').innerHTML = label;
}

function setFlag(flag){
  RACE.flag = flag;
  const el = document.getElementById('flagIndicator');
  el.className = 'flag-indicator flag-'+flag;
  el.textContent = {green:'Green',yellow:'Yellow',vsc:'VSC',sc:'Safety Car',red:'Red Flag',checkered:'Finished'}[flag] || flag;
  if(STATE.settings.sound) beep(flag);
}

function flashBanner(text, kind){
  const b = document.getElementById('bannerFlash');
  b.textContent = text;
  b.className = 'banner-flash show banner-'+kind;
  setTimeout(()=>b.classList.remove('show'), 2200);
}

// ---- WebAudio beep ----
let audioCtx = null;
function beep(kind){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const f = { green:440, yellow:330, vsc:330, sc:330, red:220, checkered:660 }[kind] || 440;
    o.frequency.value = f;
    g.gain.value = 0.05;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
    o.stop(audioCtx.currentTime + 0.3);
  }catch(e){}
}

// view toggle
document.getElementById('viewTowerBtn').addEventListener('click', ()=>{
  document.getElementById('viewTowerBtn').classList.add('active');
  document.getElementById('viewTrackBtn').classList.remove('active');
  document.getElementById('towerWrap').style.display='block';
  document.getElementById('trackWrap').style.display='none';
});
document.getElementById('viewTrackBtn').addEventListener('click', ()=>{
  document.getElementById('viewTrackBtn').classList.add('active');
  document.getElementById('viewTowerBtn').classList.remove('active');
  document.getElementById('towerWrap').style.display='none';
  document.getElementById('trackWrap').style.display='flex';
  drawTrackView();
});

function setSpeedButtons(){
  ['speedPause','speed1','speed2','speed4'].forEach(id=>document.getElementById(id).classList.remove('active'));
  if(racePaused) document.getElementById('speedPause').classList.add('active');
  else if(raceSpeed===1) document.getElementById('speed1').classList.add('active');
  else if(raceSpeed===2) document.getElementById('speed2').classList.add('active');
  else if(raceSpeed===4) document.getElementById('speed4').classList.add('active');
}
document.getElementById('speedPause').addEventListener('click', ()=>{ racePaused=true; setSpeedButtons(); });
document.getElementById('speed1').addEventListener('click', ()=>{ racePaused=false; raceSpeed=1; setSpeedButtons(); });
document.getElementById('speed2').addEventListener('click', ()=>{ racePaused=false; raceSpeed=2; setSpeedButtons(); });
document.getElementById('speed4').addEventListener('click', ()=>{ racePaused=false; raceSpeed=4; setSpeedButtons(); });

function runRaceLoop(){
  if(raceInterval) clearInterval(raceInterval);
  const totalMs = 5*60*1000;
  const baseTickMs = totalMs/RACE.track.laps;
  raceInterval = setInterval(()=>{
    if(racePaused || RACE.pendingDecision) return;
    for(let i=0;i<raceSpeed;i++){
      if(RACE.finished) break;
      simulateLap();
    }
    renderTower();
    if(document.getElementById('trackWrap').style.display!=='none') drawTrackView();
    if(RACE.finished){
      clearInterval(raceInterval);
      setTimeout(showRaceResults, 800);
    }
  }, baseTickMs);
}

function simulateLap(){
  if(RACE.flag==='red') return;
  RACE.lap++;
  const track = RACE.track;
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  document.getElementById('lapNow').textContent = RACE.lap;
  updateWeatherChip();

  if(RACE.flag==='vsc' || RACE.flag==='sc' || RACE.flag==='yellow'){
    RACE.flagLapsRemaining--;
    if(RACE.flagLapsRemaining<=0){
      setFlag('green');
      pushFeed(RACE.lap, `Track clear. Green flag.`, 'good');
      flashBanner('Green Flag', 'green');
    }
  }

  announceWeatherShift(wet);

  const active = RACE.drivers.filter(d=>!d.retired);
  active.forEach(d=>{
    d.lastLapDelta = computeLapTime(d, track, wet);
    d.totalTime += d.lastLapDelta;
    d.tyreAge++;
  });

  checkIncidents(active);

  // Sort by total time (retired at bottom)
  RACE.drivers.sort((a,b)=>{
    if(a.retired && !b.retired) return 1;
    if(!a.retired && b.retired) return -1;
    if(a.retired && b.retired) return (a.retiredLap||0)-(b.retiredLap||0);
    return a.totalTime-b.totalTime;
  });
  const leader = RACE.drivers.find(d=>!d.retired);
  const leaderTime = leader ? leader.totalTime : 0;
  let prevTime = 0;
  RACE.drivers.forEach((d,i)=>{
    d.position = i+1;
    if(!d.retired){
      d.gapToLeader = d.totalTime - leaderTime;
      d.interval = prevTime ? (d.totalTime - prevTime) : 0;
      prevTime = d.totalTime;
    } else {
      d.gapToLeader = 0; d.interval = 0;
    }
  });

  active.forEach(d=>{
    if(d.retired) return;
    maybeAIPitStop(d, track, wet);
  });

  maybeQueuePlayerDecision(active, track, wet);
  maybeRandomFlagEvent(track);

  if(RACE.lap >= RACE.laps) finishRace();
}

function announceWeatherShift(wet){
  if(RACE._lastWetBand===undefined) RACE._lastWetBand = wet>0.5?'wet':(wet>0.1?'damp':'dry');
  const band = wet>0.5?'wet':(wet>0.1?'damp':'dry');
  if(band!==RACE._lastWetBand){
    if(band==='wet'){ pushFeed(RACE.lap, `Rain intensifying — track is wet.`, 'flag'); flashBanner('Rain Falling','yellow'); }
    else if(band==='damp' && RACE._lastWetBand==='dry'){ pushFeed(RACE.lap, `Spots of rain on track.`, 'flag'); flashBanner('Rain Starting','yellow'); }
    else if(band==='damp' && RACE._lastWetBand==='wet'){ pushFeed(RACE.lap, `Track beginning to dry.`, 'good'); }
    else if(band==='dry'){ pushFeed(RACE.lap, `Track fully dry now.`, 'good'); }
    RACE._lastWetBand = band;
  }
}

function computeLapTime(d, track, wet){
  const team = teamById(d.teamId);
  const effPace = team.pace + (team.id===STATE.myTeamId?STATE.carPaceBoost:0) + (team.id===STATE.myTeamId?(STATE.upgrades.aero+STATE.upgrades.pu)*2:0);
  const comp = COMPOUNDS[d.tyre];

  let base = 100 - (effPace*0.35 + d.skill*0.25);
  const degPenalty = comp.degRate * d.tyreAge * 0.045;

  let tempPenalty = 0;
  if(track.trackTempC < comp.tempMin) tempPenalty = (comp.tempMin-track.trackTempC)*0.04;
  else if(track.trackTempC > comp.tempMax) tempPenalty = (track.trackTempC-comp.tempMax)*0.03;
  if(track.trackTempC < 18 && d.tyreAge < 3 && !comp.wet) tempPenalty += (3-d.tyreAge)*0.15;

  let wetPenalty = 0;
  if(wet > 0.15 && !comp.wet) wetPenalty = wet*3.2;
  else if(wet <= 0.1 && comp.wet) wetPenalty = 1.4;
  else if(comp.wet && wet>0.15){
    if(d.tyre==='I' && wet>0.6) wetPenalty = (wet-0.6)*2.0;
    if(d.tyre==='W' && wet<0.35) wetPenalty = (0.35-wet)*2.5;
  }

  let dmgPenalty = d.damage * 0.6;

  const variance = randf(-1,1) * (1 - d.consistency/140);

  let flagMult = 1;
  if(RACE.flag==='vsc') flagMult = 1.35;
  else if(RACE.flag==='sc') flagMult = 1.55;

  let penalty = 0;
  if(d.penaltyPending > 0){ penalty = 5; d.penaltyPending--; }

  return Math.max((base + degPenalty + tempPenalty + wetPenalty + dmgPenalty + variance + penalty) * flagMult, 5);
}

function checkIncidents(active){
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  active.forEach(d=>{
    if(d.retired) return;
    const team = teamById(d.teamId);
    const effReli = team.reliability + (team.id===STATE.myTeamId?STATE.carReliabilityBoost:0) + (team.id===STATE.myTeamId?STATE.upgrades.rel*2:0);
    const failChance = (100-effReli) * 0.0006;
    const crashChance = (100-d.consistency)*0.00025 + wet*0.0022 + (d.tyreAge>28?0.0012:0) + d.damage*0.001;

    const roll = Math.random();
    if(roll < failChance){
      retireDriver(d, 'mechanical');
    } else if(roll < failChance + crashChance){
      // Damage but not always out
      if(Math.random() < 0.35){
        d.damage = clamp(d.damage + rand(1,3), 0, 5);
        pushFeed(RACE.lap, `<b>${d.abbr}</b> picks up damage after contact.`, 'danger');
        if(d.teamId===STATE.myTeamId) flashBanner('Damage!','red');
      } else {
        retireDriver(d, 'crash');
      }
    }
    // Pit crew error chance
    if(d._justPitted && Math.random() < 0.02){
      pushFeed(RACE.lap, `<b>${d.abbr}</b> — slow pit stop (unsafe release check).`, 'danger');
      d.totalTime += 4;
    }
    d._justPitted = false;
  });
}

function retireDriver(d, reason){
  d.retired = true;
  d.retiredReason = reason;
  d.retiredLap = RACE.lap;
  const label = reason==='mechanical' ? 'retires (mechanical)' : 'crashes out';
  pushFeed(RACE.lap, `<b>${d.abbr}</b> ${label}!`, 'danger');
  if(d.teamId===STATE.myTeamId) flashBanner(reason==='crash'?'Crash!':'Mechanical','red');
  triggerFlagForIncident(reason);
}

function triggerFlagForIncident(reason){
  if(RACE.flag==='red') return;
  const roll = Math.random();
  if(reason==='crash'){
    if(roll < 0.18) startRedFlag();
    else if(roll < 0.55) startSafetyCar();
    else startVSC();
  } else {
    if(roll < 0.35) startVSC();
    else pushFeed(RACE.lap, `Yellow flag in the affected sector.`, 'flag');
  }
}

function startVSC(){
  if(RACE.flag==='sc'||RACE.flag==='red') return;
  setFlag('vsc');
  RACE.flagLapsRemaining = rand(2,4);
  pushFeed(RACE.lap, `Virtual Safety Car deployed.`, 'flag');
  flashBanner('Virtual Safety Car','yellow');
}
function startSafetyCar(){
  setFlag('sc');
  RACE.flagLapsRemaining = rand(3,6);
  pushFeed(RACE.lap, `Safety Car deployed.`, 'flag');
  flashBanner('Safety Car','yellow');
}
function startRedFlag(){
  setFlag('red');
  RACE.flagLapsRemaining = 1;
  pushFeed(RACE.lap, `RED FLAG — session stopped.`, 'danger');
  flashBanner('Red Flag','red');
  setTimeout(()=>{
    if(!RACE || RACE.finished) return;
    setFlag('sc');
    RACE.flagLapsRemaining = 2;
    pushFeed(RACE.lap, `Race resumes behind the Safety Car.`, 'good');
  }, 1800);
}

function maybeRandomFlagEvent(track){
  if(RACE.flag!=='green') return;
  const streetFactor = /street|wall/i.test(track.character) ? 0.004 : 0.0012;
  if(Math.random() < streetFactor){
    if(Math.random()<0.3) startSafetyCar(); else startVSC();
    pushFeed(RACE.lap, `Debris on track triggers a caution.`, 'flag');
  }
}

// ---- AI pit ----
function maybeAIPitStop(d, track, wet){
  if(d.teamId===STATE.myTeamId) return;
  if(RACE.lap < 3) return;
  const comp = COMPOUNDS[d.tyre];
  const wantsWet = wet>0.35 && !comp.wet;
  const wantsSlickBack = wet<0.12 && comp.wet;
  const tyreWorn = d.tyreAge > (comp.degRate>1.8 ? rand(14,20) : rand(22,32));
  if((track.laps-RACE.lap) < 3) return;
  if(wantsWet || wantsSlickBack || tyreWorn){
    const newTyre = wantsWet ? (wet>0.6?'W':'I') : (wantsSlickBack ? pick(['M','H']) : pick(['M','H']));
    doPitStop(d, newTyre);
  }
}

function doPitStop(d, newTyre){
  d.pitStops++;
  d.tyre = newTyre;
  d.tyreAge = 0;
  d._justPitted = true;
  d.pitHistory.push({lap:RACE.lap, tyre:newTyre});
  d.totalTime += 21 + randf(-1.5,2.5);
  pushFeed(RACE.lap, `<b>${d.abbr}</b> pits — fits ${COMPOUNDS[newTyre].name}.`, null);
}

// ---- Player strategy decisions ----
function maybeQueuePlayerDecision(active, track, wet){
  if(RACE.pendingDecision) return;
  if(RACE.lap < 3) return;
  const mine = active.filter(d=>d.teamId===STATE.myTeamId && !d.strategyPending);
  if(mine.length===0) return;
  if((track.laps-RACE.lap) < 3) return;

  for(const d of mine){
    const comp = COMPOUNDS[d.tyre];
    const wantsWetChange = (wet>0.3 && !comp.wet) || (wet<0.12 && comp.wet);
    const tyreCliff = d.tyreAge > (comp.degRate>1.8 ? rand(16,20) : rand(24,30));
    const randomCall = Math.random() < 0.006;
    if(wantsWetChange || tyreCliff || randomCall){
      queueDecision(d, track, wet, wantsWetChange?'weather':(tyreCliff?'wear':'routine'));
      break;
    }
  }
}
function queueDecision(driver, track, wet, reason){
  driver.strategyPending = true;
  RACE.pendingDecision = { driver, track, wet, reason };
  renderDecisionBar();
}
function renderDecisionBar(){
  const { driver, track, wet, reason } = RACE.pendingDecision;
  const bar = document.getElementById('decisionBar');
  bar.classList.add('active');
  const reasonText = {
    weather: wet>0.3 ? 'Track wetting up — need a call on tyres.' : 'Track drying — consider slicks.',
    wear: `${COMPOUNDS[driver.tyre].name} tyres on lap ${driver.tyreAge} are dropping off.`,
    routine: `Strategy window open for ${driver.abbr}.`,
  };
  document.getElementById('decisionTitle').textContent = `${driver.abbr} — Pit Wall Call`;
  document.getElementById('decisionSub').textContent = reasonText[reason];
  const opts = buildDecisionOptions(driver, track, wet);
  const wrap = document.getElementById('decisionOptions');
  wrap.innerHTML = '';
  opts.forEach(opt=>{
    const b = document.createElement('button');
    b.className = 'decision-opt';
    b.innerHTML = `<div class="decision-opt-title">${opt.title}</div><div class="decision-opt-desc">${opt.desc}</div>`;
    b.addEventListener('click', ()=>resolveDecision(driver, opt));
    wrap.appendChild(b);
  });
}
function buildDecisionOptions(driver, track, wet){
  const opts = [];
  if(wet>0.3){
    opts.push({title:'Box for Inters', desc:'Balanced grip for damp/wet.', action:'pit', tyre:'I'});
    if(wet>0.6) opts.push({title:'Box for Full Wets', desc:'Maximum wet grip.', action:'pit', tyre:'W'});
    opts.push({title:'Stay out', desc:'Risk it on current tyres.', action:'stay'});
  } else if(wet<0.12 && COMPOUNDS[driver.tyre].wet){
    opts.push({title:'Box for Mediums', desc:'Balanced slick.', action:'pit', tyre:'M'});
    opts.push({title:'Box for Hards', desc:'Durable, slower warm-up.', action:'pit', tyre:'H'});
    opts.push({title:'Stay out', desc:'Wait for more rain.', action:'stay'});
  } else {
    opts.push({title:'Box for Softs', desc:'Fast but short.', action:'pit', tyre:'S'});
    opts.push({title:'Box for Mediums', desc:'Balanced.', action:'pit', tyre:'M'});
    opts.push({title:'Box for Hards', desc:'Go long.', action:'pit', tyre:'H'});
    opts.push({title:'Stay out', desc:'Extend the stint.', action:'stay'});
  }
  return opts;
}
function resolveDecision(driver, opt){
  RACE.pendingDecision = null;
  driver.strategyPending = false;
  document.getElementById('decisionBar').classList.remove('active');
  if(opt.action==='pit') doPitStop(driver, opt.tyre);
  else pushFeed(RACE.lap, `<b>${driver.abbr}</b> stays out on ${COMPOUNDS[driver.tyre].name}.`, null);
}

// ---- Render ----
function pushFeed(lap, html, kind){
  RACE.feed.push({lap, html, kind});
  const scroll = document.getElementById('feedScroll');
  const item = document.createElement('div');
  item.className = 'feed-item' + (kind ? ' '+kind : '');
  item.innerHTML = `<span class="feed-lap">L${lap}</span>${html}`;
  scroll.appendChild(item);
  if(scroll.children.length>150) scroll.removeChild(scroll.firstChild);
}

function renderTower(){
  const body = document.getElementById('towerBody');
  body.innerHTML = '';
  RACE.drivers.forEach(d=>{
    const team = teamById(d.teamId);
    const row = document.createElement('div');
    let cls = 'tt-row';
    if(d.teamId===STATE.myTeamId) cls += ' me';
    if(d.retired) cls += ' retired';
    else if(d.damage>0) cls += ' damaged';
    row.className = cls;
    const gapText = d.retired ? (d.retiredReason==='crash'?'DNF-CR':'DNF-MEC') :
      (d.position===1 ? 'LEADER' : '+'+d.interval.toFixed(1)+'s');
    row.innerHTML = `
      <span class="tt-pos">${d.position}</span>
      <span class="tt-driver"><span class="tt-team-pill" style="background:${team.color}"></span><span class="tt-driver-abbr">${d.abbr}</span></span>
      <span class="tt-gap">${gapText}</span>
      <span class="tt-tyre tyre-${d.tyre}">${d.tyre}</span>
      <span class="tt-tyreage">${d.retired?'':d.tyreAge+'L'}</span>
      <span class="tt-pits">${d.pitStops}</span>
      <span></span>
    `;
    body.appendChild(row);
  });
}

function drawTrackView(){
  const canvas = document.getElementById('trackCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const path = RACE.track.path;
  const pad = 40;
  const X = x => pad + x*(w-pad*2);
  const Y = y => pad + y*(h-pad*2);

  // Track ribbon
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2A2F38';
  ctx.beginPath();
  path.forEach((p,i)=>{ i? ctx.lineTo(X(p[0]),Y(p[1])) : ctx.moveTo(X(p[0]),Y(p[1])); });
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = '#12151A';
  ctx.lineWidth = 2;
  ctx.setLineDash([6,8]);
  ctx.beginPath();
  path.forEach((p,i)=>{ i? ctx.lineTo(X(p[0]),Y(p[1])) : ctx.moveTo(X(p[0]),Y(p[1])); });
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Build cumulative lengths for spline positioning
  const pts = path.map(p=>({x:X(p[0]), y:Y(p[1])}));
  const segs = [];
  let total = 0;
  for(let i=0;i<pts.length;i++){
    const a = pts[i], b = pts[(i+1)%pts.length];
    const len = Math.hypot(b.x-a.x, b.y-a.y);
    segs.push({a,b,len,start:total});
    total += len;
  }
  const posAt = (frac)=>{
    let d = frac*total;
    for(const s of segs){
      if(d <= s.start+s.len){
        const t = (d-s.start)/s.len;
        return { x: s.a.x + (s.b.x-s.a.x)*t, y: s.a.y + (s.b.y-s.a.y)*t };
      }
    }
    return {x:pts[0].x, y:pts[0].y};
  };

  const active = RACE.drivers.filter(d=>!d.retired);
  const maxGap = Math.max(0.5, ...active.map(d=>d.gapToLeader));
  active.forEach(d=>{
    const team = teamById(d.teamId);
    const frac = maxGap>0 ? (d.gapToLeader/maxGap)*0.9 : 0;
    const pt = posAt(clamp(frac,0,0.98));
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, d.teamId===STATE.myTeamId?7:5, 0, Math.PI*2);
    ctx.fillStyle = team.color;
    ctx.fill();
    if(d.teamId===STATE.myTeamId){ ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke(); }
    ctx.fillStyle = '#EDEAE2';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(d.abbr, pt.x+9, pt.y+3);
  });

  ctx.fillStyle = '#565D6A';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(`${RACE.track.name} — Lap ${RACE.lap}/${RACE.laps}`, 14, 22);
}

// ---- Finish ----
function finishRace(){
  RACE.finished = true;
  setFlag('checkered');
  pushFeed(RACE.lap, `Checkered flag.`, 'good');
}

function showRaceResults(){
  const classified = RACE.drivers.filter(d=>!d.retired);
  const dnfs = RACE.drivers.filter(d=>d.retired);
  const results = [...classified, ...dnfs];

  // Points & prize
  let myPrize = 0;
  const myResults = [];
  results.forEach((d,i)=>{
    const pts = i<POINTS_TABLE.length && !d.retired ? POINTS_TABLE[i] : 0;
    STATE.driversPoints[d.abbr] = (STATE.driversPoints[d.abbr]||0) + pts;
    STATE.constructorsPoints[d.teamId] = (STATE.constructorsPoints[d.teamId]||0) + pts;
    if(d.teamId===STATE.myTeamId){
      myPrize += PRIZE_BY_POS[i] || PRIZE_BY_POS[PRIZE_BY_POS.length-1];
      myResults.push({abbr:d.abbr, pos:i+1, retired:d.retired});
    }
  });

  // Save log
  STATE.raceLog.push({
    season: STATE.season,
    round: STATE.round+1,
    track: RACE.track.id,
    results: results.map((d,i)=>({abbr:d.abbr, pos:i+1, retired:d.retired})),
  });

  // Board confidence update
  const bestPos = myResults.filter(r=>!r.retired).sort((a,b)=>a.pos-b.pos)[0]?.pos || 20;
  const expected = { title:3, contender:6, midfield:9, backmarker:12 }[myTeam().tier];
  const delta = clamp((expected - bestPos) * 1.2, -12, 14);
  STATE.boardConf = clamp(STATE.boardConf + delta, 0, 100);
  STATE.budget += myPrize;

  STATE.round++;
  saveToSlot(activeSlot);

  // Fired check
  if(STATE.boardConf <= 5 && STATE.round < TRACKS.length){
    renderFiredModal();
    return;
  }

  renderResultsModal(results, myResults, myPrize, delta);
}

function renderResultsModal(results, myResults, myPrize, delta){
  const rows = results.map((d,i)=>{
    const t = teamById(d.teamId);
    const statusText = d.retired ? (d.retiredReason==='crash'?'DNF (crash)':'DNF (mec)') : `P${i+1}`;
    const pts = i<POINTS_TABLE.length && !d.retired ? POINTS_TABLE[i] : 0;
    return `<div class="side-row" style="border-bottom:1px solid var(--line);padding:7px 0;">
      <span><span class="team-pill" style="background:${t.color}"></span>${d.abbr} ${t.id===STATE.myTeamId?'←':''}</span>
      <b>${statusText}${pts?` (+${pts})`:''}</b>
    </div>`;
  }).join('');
  const deltaText = delta>0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
  const deltaColor = delta>0?'var(--green)':delta<0?'var(--red)':'var(--dim)';
  openModal(`
    <h2>Race Result — ${RACE.track.name}</h2>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px">
      <span class="team-stat-mini">PRIZE <b style="color:var(--amber)">$${myPrize.toFixed(1)}M</b></span>
      <span class="team-stat-mini">BOARD <b style="color:${deltaColor}">${deltaText}%</b></span>
      <span class="team-stat-mini">CONFIDENCE <b>${Math.round(STATE.boardConf)}%</b></span>
    </div>
    <div style="max-height:340px;overflow-y:auto;margin:8px 0">${rows}</div>
    <div class="modal-actions"><button class="btn btn-primary btn-sm" id="btnBackToHub">Back to pit wall</button></div>
  `);
  document.getElementById('btnBackToHub').addEventListener('click', ()=>{
    closeModal();
    if(raceInterval) clearInterval(raceInterval);
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
    if(raceInterval) clearInterval(raceInterval);
  });
}

// ===================== BOOT =====================
(function boot(){
  if(hasAnySave()){
    document.getElementById('btnLoadGame').disabled = false;
  } else {
    document.getElementById('btnLoadGame').disabled = true;
  }
  showScreen('screen-intro');
})();
