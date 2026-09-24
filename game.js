// ===================== GAME STATE =====================
console.log('[debug] game.js top-level executing');
const STORAGE_KEY = 'pitwall_save_v1';

let STATE = null;

function newGameState(teamId){
  const team = TEAMS.find(t=>t.id===teamId);
  const engineers = {
    aero: makeStarterEngineer('aero', team.tier),
    reliability: makeStarterEngineer('reliability', team.tier),
    strategist: makeStarterEngineer('strategist', team.tier),
    perf: makeStarterEngineer('perf', team.tier),
  };
  const season = shuffleSchedule();
  return {
    myTeamId: teamId,
    round: 0, // index into season, 0-based; race not yet run for this round until played
    season, // array of track ids in order
    budget: team.budget,
    engineers,
    candidates: [],
    // per-team season points
    constructorsPoints: Object.fromEntries(TEAMS.map(t=>[t.id,0])),
    driversPoints: Object.fromEntries(TEAMS.flatMap(t=>t.drivers.map(d=>[d.abbr,0]))),
    driverTeam: Object.fromEntries(TEAMS.flatMap(t=>t.drivers.map(d=>[d.abbr,t.id]))),
    carPaceBoost: 0,       // cumulative from engineer hires
    carReliabilityBoost: 0,
    strategyBoost: 0,
    raceLog: [],           // summarized results per round
    objectiveState: 'on-track', // on-track | at-risk | failed | met (rough overall flag)
  };
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
    skill: base + rand(-4,4),
  };
}

function randName(){ return `${pick(ENGINEER_FIRST)} ${pick(ENGINEER_LAST)}`; }
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randf(min,max){ return Math.random()*(max-min)+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

function shuffleSchedule(){
  // Real tracks, shuffled once for a season order (deterministic-ish variety each new game).
  const ids = TRACKS.map(t=>t.id);
  for(let i=ids.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [ids[i],ids[j]] = [ids[j],ids[i]];
  }
  return ids;
}

function saveGame(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); }catch(e){}
}
function loadGame(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function clearSave(){ try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} }

// ===================== SCREEN MANAGEMENT =====================
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function closeModal(){
  document.getElementById('modalOverlay').classList.remove('active');
}
function openModal(html){
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('active');
}

// ===================== INTRO =====================
document.getElementById('btnGoTeamSelect').addEventListener('click', ()=>{
  console.log('[debug] Choose your team clicked');
  renderTeamSelect();
  showScreen('screen-teamselect');
});

// ===================== TEAM SELECT =====================
let selectedTeamId = null;

function renderTeamSelect(){
  console.log('[debug] renderTeamSelect called, TEAMS.length =', typeof TEAMS !== 'undefined' ? TEAMS.length : 'TEAMS UNDEFINED');
  const grid = document.getElementById('teamGrid');
  grid.innerHTML = '';
  TEAMS.forEach(team=>{
    const card = document.createElement('div');
    card.className = 'team-card';
    card.dataset.teamId = team.id;
    const obj = TIER_OBJECTIVES[team.tier];
    card.innerHTML = `
      <div class="team-card-top">
        <span class="team-abbr mono" style="color:${team.color}">${team.abbr}</span>
        <span class="team-tier tier-${team.tier}">${team.tier}</span>
      </div>
      <div class="team-name">${team.name}</div>
      <div class="team-drivers"><b>${team.drivers[0].abbr}</b> &middot; <b>${team.drivers[1].abbr}</b></div>
      <div class="team-stats">
        <span class="team-stat-mini">PACE <b>${team.pace}</b></span>
        <span class="team-stat-mini">RELIABILITY <b>${team.reliability}</b></span>
        <span class="team-stat-mini">BUDGET <b>$${team.budget}M</b></span>
      </div>
      <div class="team-drivers" style="margin-top:2px;">Board expects: ${obj.label}</div>
    `;
    card.addEventListener('click', ()=>{
      console.log('[debug] card clicked:', team.id);
      document.querySelectorAll('.team-card').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      selectedTeamId = team.id;
      document.getElementById('btnConfirmTeam').disabled = false;
      console.log('[debug] selectedTeamId set to', selectedTeamId, 'confirm btn disabled =', document.getElementById('btnConfirmTeam').disabled);
    });
    grid.appendChild(card);
  });
  console.log('[debug] renderTeamSelect finished, cards in grid:', grid.children.length);
}

document.getElementById('btnBackIntro').addEventListener('click', ()=>showScreen('screen-intro'));

document.getElementById('btnConfirmTeam').addEventListener('click', ()=>{
  if(!selectedTeamId) return;
  STATE = newGameState(selectedTeamId);
  saveGame();
  enterHub();
});

// ===================== HUB =====================
function myTeam(){ return TEAMS.find(t=>t.id===STATE.myTeamId); }
function teamById(id){ return TEAMS.find(t=>t.id===id); }

function enterHub(){
  renderHub();
  showScreen('screen-hub');
}

function currentTrack(){
  const trackId = STATE.season[STATE.round];
  return TRACKS.find(t=>t.id===trackId);
}

function renderHub(){
  const team = myTeam();
  document.getElementById('hubTeamLabel').innerHTML = `<b style="color:${team.color}">${team.abbr}</b> &middot; ${team.name}`;
  document.getElementById('hubBudget').textContent = `$${STATE.budget}M`;
  document.getElementById('hubRound').textContent = Math.min(STATE.round+1, STATE.season.length);
  document.getElementById('hubTotalRounds').textContent = STATE.season.length;

  // side: objective
  renderObjectiveBox();

  // side: championship position
  const consStandings = getConstructorsStandings();
  const myConsPos = consStandings.findIndex(s=>s.teamId===team.id)+1;
  document.getElementById('sideConsPos').textContent = myConsPos ? `P${myConsPos}` : '—';

  const drivStandings = getDriversStandings();
  const myDriverEntries = drivStandings.filter(s=>STATE.driverTeam[s.abbr]===team.id);
  const bestMine = myDriverEntries[0];
  const bestMinePos = bestMine ? drivStandings.indexOf(bestMine)+1 : null;
  document.getElementById('sideDrivPos').textContent = bestMinePos ? `P${bestMinePos}` : '—';

  document.getElementById('sidePace').textContent = team.pace + STATE.carPaceBoost;
  document.getElementById('sideReli').textContent = team.reliability + STATE.carReliabilityBoost;

  renderHubMain();
}

function renderObjectiveBox(){
  const team = myTeam();
  const obj = TIER_OBJECTIVES[team.tier];
  const consStandings = getConstructorsStandings();
  const myConsPos = consStandings.findIndex(s=>s.teamId===team.id)+1 || TEAMS.length;
  const racesRun = STATE.round;
  const racesLeft = STATE.season.length - racesRun;

  let status = 'on-track', statusLabel = 'On track';
  if(myConsPos <= obj.conText){ status='met'; statusLabel='Meeting expectations'; }
  else if(myConsPos <= obj.conText + 2){ status='at-risk'; statusLabel='At risk'; }
  else if(racesLeft < 4 && myConsPos > obj.conText + 2){ status='failed'; statusLabel='Falling short'; }
  else { status='at-risk'; statusLabel='Behind target'; }

  if(racesRun===0){ status='on-track'; statusLabel='Season not yet started'; }

  document.getElementById('objectiveBox').innerHTML = `
    <div class="obj-item ${status}">
      <div class="obj-title">${obj.label}</div>
      <div class="obj-status">Currently P${myConsPos} in constructors &middot; ${statusLabel}</div>
    </div>
  `;
}

function getConstructorsStandings(){
  return TEAMS.map(t=>({ teamId:t.id, points: STATE.constructorsPoints[t.id] }))
    .sort((a,b)=>b.points-a.points);
}
function getDriversStandings(){
  const arr = Object.entries(STATE.driversPoints).map(([abbr,points])=>({abbr,points}));
  return arr.sort((a,b)=>b.points-a.points);
}

function renderHubMain(){
  const main = document.getElementById('hubMain');
  const seasonDone = STATE.round >= STATE.season.length;

  if(seasonDone){
    main.innerHTML = renderSeasonEndHTML();
    document.getElementById('btnNewSeason')?.addEventListener('click', ()=>{
      clearSave();
      showScreen('screen-intro');
    });
    return;
  }

  const track = currentTrack();
  const team = myTeam();

  main.innerHTML = `
    <div class="hub-section">
      <div class="hub-section-title">Next race</div>
      <div class="hub-section-sub">Round ${STATE.round+1} of ${STATE.season.length}</div>
      <div class="next-race-card">
        <div class="nrc-left">
          <div class="nrc-round">ROUND ${STATE.round+1}</div>
          <div class="nrc-name">${track.name} &mdash; ${track.country}</div>
          <div class="nrc-meta">
            <span>🌡 ${track.tempC}°C air / ${track.trackTempC}°C track</span>
            <span>💨 ${track.windKmh} km/h wind</span>
            <span>${weatherLabel(track)}</span>
          </div>
        </div>
        <button class="btn btn-primary" id="btnStartRace">Go to pit wall</button>
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
      <div class="hub-section-sub">Hiring boosts your car's underlying stats going into every race.</div>
      <div class="roster-grid" id="rosterGrid"></div>
      <div style="margin-top:14px;">
        <button class="btn btn-ghost btn-sm" id="btnOpenHiring">View candidates</button>
      </div>
    </div>
  `;

  document.getElementById('btnStartRace').addEventListener('click', startRace);

  const consBody = document.getElementById('consTableBody');
  getConstructorsStandings().forEach((s,i)=>{
    const t = teamById(s.teamId);
    const tr = document.createElement('tr');
    if(t.id===STATE.myTeamId) tr.className='me';
    tr.innerHTML = `<td class="pos">${i+1}</td><td><span class="team-pill" style="background:${t.color}"></span>${t.abbr}</td><td class="pts">${s.points}</td>`;
    consBody.appendChild(tr);
  });

  const rosterGrid = document.getElementById('rosterGrid');
  Object.values(STATE.engineers).forEach(e=>{
    const card = document.createElement('div');
    card.className = 'eng-card';
    card.innerHTML = `
      <div class="eng-card-top">
        <span class="eng-name">${e.name}</span>
      </div>
      <div class="eng-role" style="margin-bottom:8px;">${e.roleLabel}</div>
      <div class="eng-bars">
        <div class="eng-bar-row"><span style="width:50px;">Skill</span><div class="eng-bar-track"><div class="eng-bar-fill" style="width:${e.skill}%; background:${skillColor(e.skill)}"></div></div><span>${e.skill}</span></div>
      </div>
    `;
    rosterGrid.appendChild(card);
  });

  document.getElementById('btnOpenHiring').addEventListener('click', openHiringModal);
}

function skillColor(skill){
  if(skill>=85) return 'var(--green)';
  if(skill>=65) return 'var(--cyan)';
  if(skill>=45) return 'var(--amber)';
  return 'var(--red)';
}

function weatherLabel(track){
  if(track.baseline==='wet-drying') return '🌧 Starts wet, drying through race';
  if(track.baseline==='dry-threat') return '⛅ Rain forecast to arrive';
  return '☀️ Dry forecast';
}

function renderSeasonEndHTML(){
  const consStandings = getConstructorsStandings();
  const team = myTeam();
  const myPos = consStandings.findIndex(s=>s.teamId===team.id)+1;
  const obj = TIER_OBJECTIVES[team.tier];
  const met = myPos <= obj.conText;
  return `
    <div class="hub-section">
      <div class="hub-section-title">Season complete</div>
      <div class="hub-section-sub">${met ? 'The board is satisfied with the results.' : 'The board is reviewing your position.'}</div>
      <div class="next-race-card" style="border-color:${met?'var(--green)':'var(--red)'}">
        <div class="nrc-left">
          <div class="nrc-round" style="color:${met?'var(--green)':'var(--red)'}">${met?'OBJECTIVE MET':'OBJECTIVE MISSED'}</div>
          <div class="nrc-name">Finished P${myPos} in Constructors &mdash; ${obj.label}</div>
        </div>
        <button class="btn btn-primary" id="btnNewSeason">Start new season</button>
      </div>
    </div>
    <div class="hub-section">
      <div class="hub-section-title">Final Constructors' Championship</div>
      <table class="standings-table">
        <thead><tr><th>Pos</th><th>Team</th><th>Points</th></tr></thead>
        <tbody>
          ${consStandings.map((s,i)=>{
            const t = teamById(s.teamId);
            return `<tr class="${t.id===STATE.myTeamId?'me':''}"><td class="pos">${i+1}</td><td><span class="team-pill" style="background:${t.color}"></span>${t.abbr}</td><td class="pts">${s.points}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
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
    list.push({
      id: 'cand_'+Date.now()+'_'+i,
      name: randName(),
      role: role.key,
      roleLabel: role.label,
      affects: role.affects,
      skill,
      cost: Math.max(5,cost),
    });
  }
  return list;
}

function openHiringModal(){
  if(STATE.candidates.length===0){
    STATE.candidates = generateCandidates();
  }
  renderHiringModal();
}

function renderHiringModal(){
  const html = `
    <h2>Engineering candidates</h2>
    <p>Budget available: <b style="color:var(--amber)">$${STATE.budget}M</b>. Hiring a candidate replaces your current engineer in that role and adds their skill to your car.</p>
    <div id="candidateList"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="btnRefreshCandidates">Refresh list ($5M)</button>
      <button class="btn btn-primary btn-sm" id="btnCloseHiring">Done</button>
    </div>
  `;
  openModal(html);
  const list = document.getElementById('candidateList');
  STATE.candidates.forEach(c=>{
    const current = STATE.engineers[c.role];
    const upgrade = c.skill > current.skill;
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.innerHTML = `
      <div class="candidate-info">
        <div class="candidate-name">${c.name}</div>
        <div class="candidate-role">${c.roleLabel}</div>
        <div class="candidate-stats">
          <span class="team-stat-mini">SKILL <b style="color:${skillColor(c.skill)}">${c.skill}</b></span>
          <span class="team-stat-mini">CURRENT <b>${current.skill}</b></span>
          <span class="candidate-cost">$${c.cost}M</span>
        </div>
      </div>
      <button class="btn btn-sm ${upgrade?'btn-primary':'btn-ghost'}" data-cand="${c.id}" ${STATE.budget<c.cost?'disabled':''}>${upgrade?'Hire':'Hire anyway'}</button>
    `;
    list.appendChild(card);
  });
  list.querySelectorAll('button[data-cand]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      hireCandidate(btn.dataset.cand);
    });
  });
  document.getElementById('btnCloseHiring').addEventListener('click', ()=>{
    closeModal();
    renderHub();
  });
  document.getElementById('btnRefreshCandidates').addEventListener('click', ()=>{
    if(STATE.budget < 5) return;
    STATE.budget -= 5;
    STATE.candidates = generateCandidates();
    saveGame();
    renderHiringModal();
  });
}

function hireCandidate(candId){
  const c = STATE.candidates.find(x=>x.id===candId);
  if(!c || STATE.budget < c.cost) return;
  STATE.budget -= c.cost;
  STATE.engineers[c.role] = { id:c.id, name:c.name, role:c.role, roleLabel:c.roleLabel, affects:c.affects, skill:c.skill };
  recalcCarBoosts();
  STATE.candidates = STATE.candidates.filter(x=>x.id!==candId);
  saveGame();
  renderHiringModal();
}

function recalcCarBoosts(){
  // Boosts derived from engineer skill relative to a baseline of 60.
  const aero = STATE.engineers.aero.skill;
  const perf = STATE.engineers.perf.skill;
  const reli = STATE.engineers.reliability.skill;
  const strat = STATE.engineers.strategist.skill;
  STATE.carPaceBoost = Math.round(((aero-60)+(perf-60))/2 / 6); // small integer boost
  STATE.carReliabilityBoost = Math.round((reli-60)/6);
  STATE.strategyBoost = Math.round((strat-60)/8); // affects decision hinting quality
}

// ===================== RACE SIMULATION =====================
let RACE = null; // transient race state
let raceInterval = null;
let raceSpeed = 1;
let racePaused = false;

function startRace(){
  const track = currentTrack();
  RACE = buildRaceState(track);
  showScreen('screen-race');
  initRaceUI(track);
  renderTower();
  raceSpeed = 1;
  racePaused = false;
  setSpeedButtons();
  runRaceLoop();
}

function buildRaceState(track){
  // weather progression: array of "wetness" 0 (dry) to 1 (full wet) across laps, plus per-lap trackTemp
  const laps = track.laps;
  const wetness = computeWetnessCurve(track, laps);

  const grid = buildGrid();

  const drivers = grid.map((g,i)=>({
    abbr:g.abbr, name:g.name, teamId:g.teamId, skill:g.skill, consistency:g.consistency,
    position:i+1, startPosition:i+1,
    gapToLeader:0, // seconds
    lapTimeBase: 90 - (g.effPace-70)*0.15, // rough seconds per lap baseline, tuned in sim
    tyre:'M', tyreAge:0, pitStops:0, pitHistory:[],
    retired:false, retiredReason:null,
    totalTime:0,
    lastLapDelta:0,
    strategyPending:null, // set when awaiting a decision for this driver
  }));

  return {
    track, laps, wetness,
    lap:0,
    flag:'green', // green | yellow | vsc | sc | red | checkered
    flagLapsRemaining:0,
    drivers,
    finished:false,
    feed:[],
    myTeamId: STATE.myTeamId,
    pendingDecision:null,
    decisionQueue:[],
    view:'tower',
  };
}

function computeWetnessCurve(track, laps){
  const curve = [];
  if(track.baseline==='wet-drying'){
    // starts wet (1.0), dries to 0 by ~55% race distance
    for(let l=0;l<laps;l++){
      const t = l/laps;
      curve.push(clamp(1 - t/0.55, 0, 1));
    }
  } else if(track.baseline==='dry-threat'){
    // dry start, rain may arrive randomly between 30-75% distance
    const rainArrives = Math.random() < track.rainChance*1.4;
    const rainLap = rainArrives ? Math.floor(laps*randf(0.3,0.75)) : null;
    for(let l=0;l<laps;l++){
      if(rainLap===null || l<rainLap) curve.push(0);
      else{
        const t = (l-rainLap)/Math.max(6, laps*0.2);
        curve.push(clamp(t, 0, 0.85));
      }
    }
  } else{
    const rainArrives = Math.random() < track.rainChance*0.5;
    if(rainArrives){
      const rainLap = Math.floor(laps*randf(0.4,0.8));
      for(let l=0;l<laps;l++){
        if(l<rainLap) curve.push(0);
        else curve.push(clamp((l-rainLap)/(laps*0.15), 0, 0.7));
      }
    } else {
      for(let l=0;l<laps;l++) curve.push(0);
    }
  }
  return curve;
}

function buildGrid(){
  // quali-lite: order by pace + skill + small randomness
  const entries = [];
  TEAMS.forEach(team=>{
    const effPace = team.pace + (team.id===STATE.myTeamId ? STATE.carPaceBoost : 0);
    team.drivers.forEach(drv=>{
      const qualiScore = effPace*0.6 + drv.skill*0.4 + randf(-3,3);
      entries.push({ abbr:drv.abbr, name:drv.name, teamId:team.id, skill:drv.skill, consistency:drv.consistency, effPace, qualiScore });
    });
  });
  entries.sort((a,b)=>b.qualiScore-a.qualiScore);
  return entries;
}

function initRaceUI(track){
  document.getElementById('raceTrackName').textContent = `${track.name} — ${track.country}`;
  document.getElementById('raceTrackMeta').textContent = `${track.character}`;
  document.getElementById('lapTotal').textContent = track.laps;
  document.getElementById('lapNow').textContent = 0;
  updateWeatherChip();
  setFlag('green');
  document.getElementById('feedScroll').innerHTML = '';
  pushFeed(0, `Lights out at ${track.name}.`, 'good');
  document.getElementById('decisionBar').classList.remove('active');
}

function updateWeatherChip(){
  const track = RACE.track;
  const wet = RACE.wetness[Math.min(RACE.lap, RACE.wetness.length-1)] || 0;
  let label;
  if(wet>0.6) label = `🌧 Heavy rain &middot; ${track.trackTempC}°C track`;
  else if(wet>0.15) label = `🌦 Damp, drying &middot; ${track.trackTempC}°C track`;
  else label = `☀️ Dry &middot; ${track.trackTempC}°C track &middot; ${track.windKmh}km/h wind`;
  document.getElementById('weatherChip').innerHTML = label;
}

function setFlag(flag){
  RACE.flag = flag;
  const el = document.getElementById('flagIndicator');
  el.className = 'flag-indicator flag-'+flag;
  const labels = {green:'Green',yellow:'Yellow',vsc:'VSC',sc:'Safety Car',red:'Red Flag',checkered:'Finished'};
  el.textContent = labels[flag] || flag;
}

function flashBanner(text, kind){
  const b = document.getElementById('bannerFlash');
  b.textContent = text;
  b.className = 'banner-flash show banner-'+kind;
  setTimeout(()=>{ b.classList.remove('show'); }, 2200);
}

// ---- view toggle ----
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

// ---- speed controls ----
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
  // Total race compressed to ~5 minutes of real time at 1x => tick interval scales with lap count.
  const track = RACE.track;
  const totalMs = 5*60*1000;
  const baseTickMs = totalMs/track.laps;
  raceInterval = setInterval(()=>{
    if(racePaused || RACE.pendingDecision){ return; }
    for(let i=0;i<raceSpeed;i++){
      if(RACE.finished) break;
      simulateLap();
    }
    renderTower();
    if(document.getElementById('trackWrap').style.display!=='none') drawTrackView();
    if(RACE.finished){
      clearInterval(raceInterval);
      setTimeout(showRaceResults, 700);
    }
  }, baseTickMs); // fixed tick rate; raceSpeed controls how many laps simulate per tick
}

// ===================== LAP SIMULATION =====================
function simulateLap(){
  // During a red flag, the field is stopped: don't advance the lap counter or age tyres,
  // just let the flagLapsRemaining/resume timer (set in startRedFlag) play out.
  if(RACE.flag==='red') return;

  RACE.lap++;
  const track = RACE.track;
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  document.getElementById('lapNow').textContent = RACE.lap;
  updateWeatherChip();

  // Handle flag countdowns
  if(RACE.flag==='vsc' || RACE.flag==='sc' || RACE.flag==='yellow'){
    RACE.flagLapsRemaining--;
    if(RACE.flagLapsRemaining<=0){
      setFlag('green');
      pushFeed(RACE.lap, `Track clear. Green flag.`, 'good');
      flashBanner('Green Flag', 'green');
    }
  }

  // Wet/dry transition announcement
  announceWeatherShift(wet);

  const active = RACE.drivers.filter(d=>!d.retired);

  // compute lap times
  active.forEach(d=>{
    d.lastLapDelta = computeLapTime(d, track, wet);
    d.totalTime += d.lastLapDelta;
    d.tyreAge++;
  });

  // reliability / crash incidents
  checkIncidents(active);

  // reorder by totalTime
  RACE.drivers.sort((a,b)=>{
    if(a.retired && !b.retired) return 1;
    if(!a.retired && b.retired) return -1;
    if(a.retired && b.retired) return (a.retiredLap||0)-(b.retiredLap||0);
    return a.totalTime-b.totalTime;
  });
  const leaderTime = RACE.drivers.find(d=>!d.retired)?.totalTime || 0;
  RACE.drivers.forEach((d,i)=>{
    const prevPos = d.position;
    d.position = i+1;
    d.moveDir = d.retired ? null : (d.position<prevPos?'up':(d.position>prevPos?'down':null));
    if(!d.retired) d.gapToLeader = d.totalTime-leaderTime;
  });

  // AI pit stops for non-player-controlled cars (simple heuristic)
  active.forEach(d=>{
    if(d.retired) return;
    maybeAIPitStop(d, track, wet);
  });

  // player strategy decision hooks
  maybeQueuePlayerDecision(active, track, wet);

  // random VSC/SC/red flag triggers not tied to a specific car (track-based)
  maybeRandomFlagEvent(track);

  if(RACE.lap >= RACE.laps){
    finishRace();
  }
}

function announceWeatherShift(wet){
  if(RACE._lastWetBand===undefined) RACE._lastWetBand = wet>0.5?'wet':(wet>0.1?'damp':'dry');
  const band = wet>0.5?'wet':(wet>0.1?'damp':'dry');
  if(band!==RACE._lastWetBand){
    if(band==='wet') { pushFeed(RACE.lap, `Rain intensifying — track is wet.`, 'flag'); flashBanner('Rain Falling', 'yellow'); }
    else if(band==='damp' && RACE._lastWetBand==='dry'){ pushFeed(RACE.lap, `Spots of rain on track.`, 'flag'); flashBanner('Rain Starting', 'yellow'); }
    else if(band==='damp' && RACE._lastWetBand==='wet'){ pushFeed(RACE.lap, `Track beginning to dry.`, 'good'); }
    else if(band==='dry'){ pushFeed(RACE.lap, `Track fully dry now.`, 'good'); }
    RACE._lastWetBand = band;
  }
}

function computeLapTime(d, track, wet){
  const team = teamById(d.teamId);
  const effPace = team.pace + (team.id===STATE.myTeamId ? STATE.carPaceBoost : 0);
  const comp = COMPOUNDS[d.tyre];

  // base pace: higher effPace/skill = lower lap time
  let base = 100 - (effPace*0.35 + d.skill*0.25);

  // tyre grip falloff with age
  const degPenalty = comp.degRate * d.tyreAge * 0.045;

  // temperature window mismatch penalty
  let tempPenalty = 0;
  const trackTemp = track.trackTempC;
  if(trackTemp < comp.tempMin) tempPenalty = (comp.tempMin-trackTemp)*0.04;
  else if(trackTemp > comp.tempMax) tempPenalty = (trackTemp-comp.tempMax)*0.03;

  // Las Vegas / cold track special case: tyres struggle to warm up early in stint
  if(track.trackTempC < 18 && d.tyreAge < 3 && !comp.wet){
    tempPenalty += (3-d.tyreAge)*0.15;
  }

  // wet mismatch: slicks on wet track = huge penalty; wets on dry = moderate penalty
  let wetPenalty = 0;
  if(wet > 0.15 && !comp.wet){
    wetPenalty = wet*3.2; // slicks in the rain, severe
  } else if(wet <= 0.1 && comp.wet){
    wetPenalty = 1.4; // wets on a drying/dry track, overheat and slow
  } else if(comp.wet && wet>0.15){
    // right tyre for conditions, small penalty if not ideal wet tyre for wetness level
    if(d.tyre==='I' && wet>0.6) wetPenalty = (wet-0.6)*2.0; // inters in heavy rain
    if(d.tyre==='W' && wet<0.35) wetPenalty = (0.35-wet)*2.5; // full wets on light dampness
  }

  // driving randomness (consistency lowers variance)
  const variance = randf(-1,1) * (1 - d.consistency/140);

  // flag state
  let flagMult = 1;
  if(RACE.flag==='vsc') flagMult = 1.35;
  else if(RACE.flag==='sc') flagMult = 1.55;
  // red flag: simulateLap() returns early before this is ever called

  let lapTime = (base + degPenalty + tempPenalty + wetPenalty + variance);
  lapTime *= flagMult;
  return Math.max(lapTime, 5);
}

function checkIncidents(active){
  const team0 = myTeam();
  active.forEach(d=>{
    if(d.retired) return;
    const team = teamById(d.teamId);
    const effReli = team.reliability + (team.id===STATE.myTeamId?STATE.carReliabilityBoost:0);
    // Mechanical DNF chance per lap, higher for lower reliability
    const failChance = (100-effReli) * 0.0006;
    // Crash chance influenced by low consistency + wet conditions + old tyres
    const wet = RACE.wetness[Math.min(RACE.lap-1,RACE.wetness.length-1)]||0;
    const crashChance = (100-d.consistency)*0.00025 + wet*0.0022 + (d.tyreAge>28?0.0012:0);

    const roll = Math.random();
    if(roll < failChance){
      retireDriver(d, 'mechanical');
    } else if(roll < failChance + crashChance){
      retireDriver(d, 'crash');
    }
  });
}

function retireDriver(d, reason){
  d.retired = true;
  d.retiredReason = reason;
  d.retiredLap = RACE.lap;
  const label = reason==='mechanical' ? 'retires with mechanical failure' : 'crashes out';
  pushFeed(RACE.lap, `<b>${d.abbr}</b> ${label}!`, 'danger');
  flashBanner(reason==='crash' ? 'Crash!' : 'Mechanical Failure', 'red');

  // trigger flag response
  triggerFlagForIncident(reason);
}

function triggerFlagForIncident(reason){
  if(RACE.flag==='red') return;
  const roll = Math.random();
  if(reason==='crash'){
    if(roll < 0.18){
      startRedFlag();
    } else if(roll < 0.55){
      startSafetyCar();
    } else {
      startVSC();
    }
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
  flashBanner('Virtual Safety Car', 'yellow');
}
function startSafetyCar(){
  setFlag('sc');
  RACE.flagLapsRemaining = rand(3,6);
  pushFeed(RACE.lap, `Safety Car deployed.`, 'flag');
  flashBanner('Safety Car', 'yellow');
}
function startRedFlag(){
  setFlag('red');
  RACE.flagLapsRemaining = 1;
  pushFeed(RACE.lap, `RED FLAG — session stopped.`, 'danger');
  flashBanner('Red Flag', 'red');
  // resume as SC restart next tick
  setTimeout(()=>{
    if(RACE.finished) return;
    setFlag('sc');
    RACE.flagLapsRemaining = 2;
    pushFeed(RACE.lap, `Race resumes behind the Safety Car.`, 'good');
  }, 1800);
}

function maybeRandomFlagEvent(track){
  if(RACE.flag!=='green') return;
  // Some circuits carry inherent SC/VSC frequency (street circuits, walls) independent of crashes
  const streetFactor = /street|wall/i.test(track.character) ? 0.004 : 0.0012;
  if(Math.random() < streetFactor){
    if(Math.random()<0.3) startSafetyCar(); else startVSC();
    pushFeed(RACE.lap, `Debris on track triggers a caution.`, 'flag');
  }
}

// ===================== PIT STOPS & STRATEGY =====================
function maybeAIPitStop(d, track, wet){
  if(d.teamId===STATE.myTeamId) return; // player cars handled via decisions
  if(RACE.lap < 3) return;
  const comp = COMPOUNDS[d.tyre];
  const stintLen = d.tyreAge;
  const wantsWet = wet>0.35 && !comp.wet;
  const wantsSlickBack = wet<0.12 && comp.wet;
  const tyreWorn = stintLen > (comp.degRate>1.8 ? rand(14,20) : rand(22,32));
  const lastLapsNoPit = (track.laps - RACE.lap) < 3;

  if(lastLapsNoPit) return;

  if(wantsWet || wantsSlickBack || tyreWorn){
    const newTyre = wantsWet ? (wet>0.6?'W':'I') : (wantsSlickBack ? pick(['M','H']) : pick(['M','H']));
    doPitStop(d, newTyre, track);
  }
}

function doPitStop(d, newTyre, track){
  d.pitStops++;
  d.tyre = newTyre;
  d.tyreAge = 0;
  d.pitHistory.push({lap:RACE.lap, tyre:newTyre});
  // pit loss time baked into totalTime as a one-off penalty next lap calc
  d.totalTime += 21 + randf(-1.5,2.5); // pitlane loss seconds
  pushFeed(RACE.lap, `<b>${d.abbr}</b> pits — fits ${COMPOUNDS[newTyre].name}.`, null);
}

// ---- Player decision system ----
function maybeQueuePlayerDecision(active, track, wet){
  if(RACE.pendingDecision) return;
  if(RACE.lap < 3) return;
  const myDrivers = active.filter(d=>d.teamId===STATE.myTeamId && !d.strategyPending);
  if(myDrivers.length===0) return;

  const lastLapsNoPit = (track.laps - RACE.lap) < 3;
  if(lastLapsNoPit) return;

  for(const d of myDrivers){
    const comp = COMPOUNDS[d.tyre];
    const wantsWetChange = (wet>0.3 && !comp.wet) || (wet<0.12 && comp.wet);
    const tyreCliff = d.tyreAge > (comp.degRate>1.8 ? rand(16,20) : rand(24,30));
    const randomCall = Math.random() < 0.006; // occasional proactive strategy check-in

    if(wantsWetChange || tyreCliff || randomCall){
      queueDecision(d, track, wet, wantsWetChange ? 'weather' : (tyreCliff ? 'wear' : 'routine'));
      break; // one at a time
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
    weather: wet>0.3 ? 'Track is wetting up — race engineer wants a call on tyres.' : 'Track is drying — time to consider slicks.',
    wear: `${COMPOUNDS[driver.tyre].name} tyres on lap ${driver.tyreAge} are dropping off.`,
    routine: `Strategy window open for ${driver.abbr}.`,
  };
  document.getElementById('decisionTitle').textContent = `${driver.abbr} — Pit Wall Call`;
  document.getElementById('decisionSub').textContent = reasonText[reason];

  const options = buildDecisionOptions(driver, track, wet);
  const wrap = document.getElementById('decisionOptions');
  wrap.innerHTML = '';
  options.forEach(opt=>{
    const btn = document.createElement('button');
    btn.className = 'decision-opt';
    btn.innerHTML = `<div class="decision-opt-title">${opt.title}</div><div class="decision-opt-desc">${opt.desc}</div>`;
    btn.addEventListener('click', ()=>resolveDecision(driver, opt));
    wrap.appendChild(btn);
  });
}

function buildDecisionOptions(driver, track, wet){
  const opts = [];
  if(wet>0.3){
    opts.push({ title:'Box for Intermediates', desc:'Balanced grip for a damp/wet track.', action:'pit', tyre:'I' });
    if(wet>0.6) opts.push({ title:'Box for Full Wets', desc:'Maximum wet-weather grip, slower in the dry.', action:'pit', tyre:'W' });
    opts.push({ title:'Stay out', desc:'Risk it on current tyres — could be costly if rain builds.', action:'stay' });
  } else if(wet<0.12 && COMPOUNDS[driver.tyre].wet){
    opts.push({ title:'Box for Mediums', desc:'Balanced slick tyre for the now-dry track.', action:'pit', tyre:'M' });
    opts.push({ title:'Box for Hards', desc:'Durable, slower out the gate, better long run.', action:'pit', tyre:'H' });
    opts.push({ title:'Stay out', desc:'Risk it if you think more rain is coming.', action:'stay' });
  } else {
    opts.push({ title:'Box for Softs', desc:'Fast but short-lived — good for a late attack.', action:'pit', tyre:'S' });
    opts.push({ title:'Box for Mediums', desc:'Balanced pace and durability.', action:'pit', tyre:'M' });
    opts.push({ title:'Box for Hards', desc:'Track position play — go long.', action:'pit', tyre:'H' });
    opts.push({ title:'Stay out', desc:'Extend the stint on current tyres.', action:'stay' });
  }
  return opts;
}

function resolveDecision(driver, opt){
  RACE.pendingDecision = null;
  driver.strategyPending = false;
  document.getElementById('decisionBar').classList.remove('active');
  if(opt.action==='pit'){
    doPitStop(driver, opt.tyre, RACE.track);
  } else {
    pushFeed(RACE.lap, `<b>${driver.abbr}</b> stays out on ${COMPOUNDS[driver.tyre].name}.`, null);
  }
}

// ===================== RENDERING: TOWER / FEED / TRACK =====================
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
    row.className = 'tt-row' + (d.teamId===STATE.myTeamId?' me':'') + (d.retired?' retired':'') + (d.moveDir==='up'?' moved-up':d.moveDir==='down'?' moved-down':'');
    const gapText = d.retired ? (d.retiredReason==='crash'?'DNF-CR':'DNF-MEC') : (d.position===1 ? 'LEADER' : '+'+d.gapToLeader.toFixed(1)+'s');
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

  // Simple oval-ish track path (stylized, not geographically accurate)
  const cx=w/2, cy=h/2, rx=w*0.36, ry=h*0.32;
  ctx.strokeStyle = '#2A2F38';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  ctx.stroke();

  ctx.strokeStyle = '#12151A';
  ctx.lineWidth = 2;
  ctx.setLineDash([8,8]);
  ctx.beginPath();
  ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  ctx.stroke();
  ctx.setLineDash([]);

  const active = RACE.drivers.filter(d=>!d.retired);
  const maxGap = Math.max(1, ...active.map(d=>d.gapToLeader));
  active.forEach(d=>{
    const team = teamById(d.teamId);
    // place car around ellipse based on gap fraction (leader at top, others trailing around)
    const frac = maxGap>0 ? (d.gapToLeader/maxGap) : 0;
    const angle = -Math.PI/2 + frac*Math.PI*1.7 + (d.position*0.02);
    const x = cx + rx*Math.cos(angle);
    const y = cy + ry*Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x,y,d.teamId===STATE.myTeamId?7:5,0,Math.PI*2);
    ctx.fillStyle = team.color;
    ctx.fill();
    if(d.teamId===STATE.myTeamId){
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#EDEAE2';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(d.abbr, x+9, y+3);
  });

  ctx.fillStyle = '#565D6A';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(`${RACE.track.name} — Lap ${RACE.lap}/${RACE.laps}`, 14, 20);
}

// ===================== RACE FINISH =====================
const POINTS_TABLE = [25,18,15,12,10,8,6,4,2,1];

function finishRace(){
  RACE.finished = true;
  setFlag('checkered');
  pushFeed(RACE.lap, `Checkered flag.`, 'good');
}

function showRaceResults(){
  const classified = RACE.drivers.filter(d=>!d.retired);
  const dnf = RACE.drivers.filter(d=>d.retired);
  const results = [...classified, ...dnf];

  // award points
  results.forEach((d,i)=>{
    const pts = i<POINTS_TABLE.length && !d.retired ? POINTS_TABLE[i] : 0;
    STATE.driversPoints[d.abbr] = (STATE.driversPoints[d.abbr]||0) + pts;
    STATE.constructorsPoints[d.teamId] = (STATE.constructorsPoints[d.teamId]||0) + pts;
  });

  STATE.raceLog.push({
    track: RACE.track.id,
    results: results.map((d,i)=>({abbr:d.abbr, pos:i+1, retired:d.retired})),
  });

  STATE.round++;
  saveGame();

  renderResultsModal(results);
}

function renderResultsModal(results){
  const team = myTeam();
  const rows = results.map((d,i)=>{
    const t = teamById(d.teamId);
    const statusText = d.retired ? (d.retiredReason==='crash'?'DNF (crash)':'DNF (mechanical)') : `P${i+1}`;
    const pts = i<POINTS_TABLE.length && !d.retired ? POINTS_TABLE[i] : 0;
    return `<div class="side-row" style="border-bottom:1px solid var(--line); padding:8px 0;">
      <span><span class="team-pill" style="background:${t.color}"></span>${d.abbr} ${t.id===STATE.myTeamId?'&larr;':''}</span>
      <b>${statusText}${pts?` (+${pts})`:''}</b>
    </div>`;
  }).join('');

  const html = `
    <h2>Race Result — ${RACE.track.name}</h2>
    <div style="max-height:340px; overflow-y:auto; margin:14px 0;">${rows}</div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-sm" id="btnBackToHub">Back to pit wall</button>
    </div>
  `;
  openModal(html);
  document.getElementById('btnBackToHub').addEventListener('click', ()=>{
    closeModal();
    if(raceInterval) clearInterval(raceInterval);
    enterHub();
  });
}

// ===================== BOOT =====================
(function boot(){
  const saved = loadGame();
  if(saved){
    STATE = saved;
    enterHub();
  } else {
    showScreen('screen-intro');
  }
})();
