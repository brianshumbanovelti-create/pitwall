// ===================== STATE =====================
const SAVE_PREFIX = 'pitwall_slot_';
const SAVE_SLOTS = 3;
const SAVE_VERSION = 11;
const COST_CAP = 200;

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
  return s;
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

// ===================== PRINCIPAL STYLES =====================
const PRINCIPAL_STYLES = {
  mer: { style:'conservative', pitBias: 1.10 },
  fer: { style:'aggressive',   pitBias: 0.88 },
  mcl: { style:'tyre-whisperer',pitBias:1.05 },
  rbr: { style:'balanced',     pitBias: 1.00 },
  vcb: { style:'balanced',     pitBias: 1.00 },
  alp: { style:'aggressive',   pitBias: 0.92 },
  haa: { style:'conservative', pitBias: 1.08 },
  aud: { style:'conservative', pitBias: 1.08 },
  wil: { style:'balanced',     pitBias: 1.00 },
  amr: { style:'aggressive',   pitBias: 0.90 },
  cad: { style:'conservative', pitBias: 1.10 },
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
document.getElementById('btnLoadGame').addEventListener('click', openSaveSlots);
document.getElementById('btnSaveSlots').addEventListener('click', openSaveSlots);
document.getElementById('btnSettings').addEventListener('click', openSettings);

function openSaveSlots(){
  const html = `
    <h2>Save slots</h2>
    ${[0,1,2].map(i=>{
      const s = loadFromSlot(i);
      const meta = s ? `Season ${s.season} · Round ${s.round+1}/24 · ${TEAMS.find(t=>t.id===s.myTeamId).name} · $${s.budget}M` : 'Empty slot';
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
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)">
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
      <div class="team-drivers" style="margin-top:2px;">Board: ${TIER_OBJECTIVES[team.tier].label}</div>
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
  for(let i=0;i<SAVE_SLOTS;i++){ if(!loadFromSlot(i)){ activeSlot = i; break; } }
  saveToSlot(activeSlot);
  enterHub();
});

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
  document.getElementById('hubBudget').textContent = `$${STATE.budget}M`;
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
  document.getElementById('sidePace').textContent = team.pace + STATE.carPaceBoost + (STATE.upgrades.aero+STATE.upgrades.pu)*2;
  document.getElementById('sideReli').textContent = team.reliability + STATE.carReliabilityBoost + STATE.upgrades.rel*2;
  document.getElementById('sideCap').textContent = `$${STATE.capUsed}M / $${COST_CAP}M`;

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

  main.innerHTML = `
    <div class="hub-section">
      <div class="next-race-card">
        <div class="nrc-left">
          <div class="nrc-line-1">
            <span class="nrc-round">ROUND ${STATE.round+1}</span>
            <span class="nrc-name">${track.name} — ${track.country}</span>
          </div>
          <div class="nrc-meta">
            <span>🌡 ${track.tempC}°C / ${track.trackTempC}°C</span>
            <span>💨 ${track.windKmh} km/h</span>
            <span>${weatherLabel(track)}</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="btnStartWeekend">Go to pit wall</button>
      </div>
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
    return `<span class="dot" style="background:${bg};color:${col};width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace">${r.toFixed(1)}</span>`;
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
          <div class="dp-form" style="display:flex;gap:6px">${formDots}</div>
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
  STATE.carPaceBoost = Math.round(((a-60)+(p-60))/2 / 6);
  STATE.carReliabilityBoost = Math.round((r-60)/6);
}

// ===================== UPGRADES =====================
function openUpgradesModal(){
  const slots = ['aero','pu','rel','strat'];
  const labels = { aero:'Aero Package', pu:'Power Unit', rel:'Reliability', strat:'Strategy Dept' };
  const cost = lvl => 15 + lvl*10;
  const render = ()=> openModal(`
    <h2>Car development</h2>
    <p>Budget: <b style="color:var(--amber)">$${STATE.budget}M</b> · Cost cap used <b>$${STATE.capUsed}M / $${COST_CAP}M</b></p>
    <p style="font-size:11.5px">Upgrades take 2 races to arrive. New engines may trigger a grid penalty.</p>
    ${STATE.pendingUpgrades.map(u=>`<div class="save-slot"><div><div style="font-weight:700">${labels[u.slot]} +2</div><div class="meta">Arrives in ${u.arrivesInRace - STATE.round} races</div></div></div>`).join('')}
    ${slots.map(s=>{
      const lvl = STATE.upgrades[s];
      const c = cost(lvl);
      const canDo = STATE.budget >= c && STATE.capUsed + c <= COST_CAP;
      const reason = STATE.capUsed + c > COST_CAP ? 'Cost cap hit' : (STATE.budget < c ? 'No budget' : '');
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
      if(STATE.budget < c || STATE.capUsed + c > COST_CAP) return;
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
const LAP_TIME_APPROX = 20;
let RACE = null;
let simTimer = null;
let rafId = null;
let raceSpeed = 1;
let racePaused = false;
let lastSimTime = 0;
let simIntervalMs = 5000;

const PACE_SCALE = 0.20;
const BASE_LAP   = 90;
const TRACK_POINT_CACHE = {};

// ============ SVG PATH PARSING ============
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

function getTrackData(track){
  if(TRACK_POINT_CACHE[track.id]) return TRACK_POINT_CACHE[track.id];
  if(!track.svgPath){
    TRACK_POINT_CACHE[track.id] = null;
    return null;
  }
  const raw = sampleSvgPath(track.svgPath, 400);
  const norm = normalisePoints(raw, 0.08);
  const { cum, total } = buildCumulativePoints(norm);
  const result = { points: norm, cum, total };
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

// ============ RACE SETUP ============
function startRace(gridOverride, strategyOverride){
  const track = currentTrack();
  RACE = buildRaceState(track, gridOverride);
  RACE.drivers.forEach(d=>{
    d.usedCompounds = new Set();
    const s = strategyOverride && strategyOverride[d.abbr];
    if(s){
      if(s.tyre) d.tyre = s.tyre;
      d.pitPlan = s.plan || '1-stop';
      d.orders = s.orders || 'fight';
    } else {
      d.tyre = aiStartTyre(track);
      d.pitPlan = Math.random()<0.5?'1-stop':'2-stop';
    }
    d.usedCompounds.add(d.tyre);
    d.nextPitLap = d.pitPlan==='2-stop' ? Math.round(track.laps*randf(0.28,0.36)) : Math.round(track.laps*randf(0.42,0.58));
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

  showScreen('screen-race');
  initRaceUI(track);
  renderStrip();
  renderPitBox();
  raceSpeed = 1; racePaused = false;
  updateSpeedButtons();
  simIntervalMs = (5*60*1000)/track.laps;
  lastSimTime = performance.now();
  startSimLoop();
  startRenderLoop();
}

function buildRaceState(track, gridOverride){
  const laps = track.laps;
  const wetness = computeWetnessCurve(track, laps);
  const grid = gridOverride || buildDefaultGrid();
  const drivers = grid.map((g,i)=>({
    abbr:g.abbr, name:g.name, teamId:g.teamId, skill:g.skill, consistency:g.consistency, num:g.num,
    position:i+1, startPosition:i+1,
    totalTime: 0,
    gapToLeader: 0, interval: 0,
    tyre:'M', tyreAge:0, pitStops:0, pitHistory:[],
    retired:false, retiredReason:null, retiredLap:null,
    damage:0, penaltyLapsLeft:0,
    fuel: 100,
    ers: 'balanced',
    radioEffect: null,
    bestSector: [0,0,0],
    lastSector: [0,0,0],
    lapTimes: [],
    pitFlashUntilLap: 0,
    penaltyFlashUntilLap: 0,
    _pitTimer: 0,
    _pendingTyre: null,
    _pendingRepair: 0,
    _justPitted: false,
    _puncture: false,
    _armedPit: false,
    _armedTyre: null,
    _armedRepair: 0,
    _lastMessageLap: {},
    _hadContact: false,
    _lastLapTime: 0,
  }));
  return {
    track, laps, wetness, lap:0,
    flag:'green',
    sectors: ['green','green','green'],
    sectorYellowUntil: [0,0,0],
    vscLapsRemaining: 0,
    scLapsRemaining: 0,
    redFlagActive: false,
    redFlagModalPending: false,
    drivers, finished:false,
    messages: [],
    myTeamId: STATE.myTeamId,
    fastestLapHolder: null,
    fastestLapTime: null,
    wallStartMs: Date.now(),
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
      const q = effPace*0.6 + drv.skill*0.4 + randf(-3,3);
      entries.push({ abbr:drv.abbr, name:drv.name, num:drv.num, teamId:team.id, skill:drv.skill, consistency:drv.consistency, effPace, qualiScore:q });
    });
  });
  entries.sort((a,b)=>b.qualiScore-a.qualiScore);
  return entries;
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
  setFlagUI();
  renderSectorLegend();
  pushMsg('strat', 'STRAT:', `Green flag at ${track.name}.`);
  resizeTrackCanvas();
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

function updateSpeedButtons(){
  document.getElementById('speedPause').classList.toggle('active', racePaused);
  document.getElementById('speed2').classList.toggle('active', !racePaused && raceSpeed===2);
}
document.getElementById('speedPause').addEventListener('click', ()=>{
  racePaused = !racePaused;
  updateSpeedButtons();
});
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
  renderStrip();
  if(RACE.finished){
    stopSimLoop(); stopRenderLoop();
    setTimeout(showRaceResults, 500);
  }
});

function startSimLoop(){
  stopSimLoop();
  simTimer = setInterval(()=>{
    if(racePaused || RACE.redFlagModalPending) return;
    for(let i=0;i<raceSpeed;i++){
      if(RACE.finished) break;
      simulateLap(false);
    }
    lastSimTime = performance.now();
    renderStrip();
    renderPitBox();
    if(RACE.finished){
      stopSimLoop(); stopRenderLoop();
      setTimeout(showRaceResults, 800);
    }
  }, simIntervalMs);
}
function stopSimLoop(){ if(simTimer){ clearInterval(simTimer); simTimer = null; } }
function startRenderLoop(){
  stopRenderLoop();
  const loop = ()=>{
    rafId = requestAnimationFrame(loop);
    if(!RACE || RACE.finished) return;
    drawTrackView();
  };
  loop();
}
function stopRenderLoop(){ if(rafId){ cancelAnimationFrame(rafId); rafId = null; } }

// ===================== LAP SIM =====================
function simulateLap(silent){
  if(RACE.redFlagActive || RACE.finished) return;

  RACE.drivers.forEach(d=>{
    if(d._pitTimer > 0){
      d._pitTimer--;
      if(d._pitTimer===0){
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

  RACE.drivers.forEach(d=>{
    if(d._armedPit && d._pitTimer === 0) executePit(d);
  });

  RACE.lap++;
  const track = RACE.track;
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
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

  const active = RACE.drivers.filter(d=>!d.retired);

  active.forEach(d=>{
    const lapTime = computeLapTime(d, track, wet);
    d.totalTime += lapTime;
    d.tyreAge++;
    d.lapTimes.push(lapTime);
    d._lastLapTime = lapTime;
    d.fuel = Math.max(0, d.fuel - (100 / RACE.laps));
    applyCarWear(d);
    if(d.radioEffect && RACE.lap >= d.radioEffect.untilLap) d.radioEffect = null;
    if(d.penaltyFlashUntilLap && RACE.lap > d.penaltyFlashUntilLap) d.penaltyFlashUntilLap = 0;
  });

  active.forEach(d=>{
    const life = tyreLifePercent(d);
    if(life <= 10 && !d._puncture && !d.retired){
      if(Math.random() < 0.06){
        d._puncture = true;
        pushMsg('danger', 'RC:', `${d.abbr} PUNCTURE!`);
        if(d.teamId===STATE.myTeamId) flashBanner('Puncture!','red');
        d.totalTime += 28 + randf(-3,5);
        if(d._pitTimer===0){
          const used = d.usedCompounds || new Set();
          const dryLeft = ['S','M','H'].filter(c => !used.has(c));
          if(dryLeft.length === 0){
            pushMsg('danger', 'RC:', `${d.abbr} punctures with no tyres left — OUT.`);
            if(d.teamId===STATE.myTeamId) flashBanner('Puncture — no tyres','red');
            retireDriver(d, 'mechanical');
          } else {
            executePit(d, dryLeft[0], 0);
          }
        }
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

  const fastest = active.slice().sort((a,b)=>a._lastLapTime-b._lastLapTime)[0];
  if(fastest && (!RACE.fastestLapTime || fastest._lastLapTime < RACE.fastestLapTime)){
    RACE.fastestLapTime = fastest._lastLapTime;
    RACE.fastestLapHolder = fastest.abbr;
  }

  checkIncidents(active);

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

  active.forEach(d=>{
    if(d.retired) return;
    maybeAIPitStop(d, track, wet);
  });
  runEngineerRadio();

  if(RACE.lap >= RACE.laps) finishRace();
}

function tyreLifePercent(d){
  const comp = COMPOUNDS[d.tyre];
  const baseDeg = comp.degRate * 3;
  return Math.max(0, 100 - (d.tyreAge * baseDeg));
}
function carHealthPercent(d){
  return Math.max(0, 100 - (d.damage / 8) * 100);
}
function applyCarWear(d){
  let wear = 0.15;
  if(d.ers === 'attack') wear += 0.8;
  if(d.ers === 'save')   wear -= 0.05;
  if(d.radioEffect && d.radioEffect.paceBonus > 0) wear += 0.5;
  if(d.radioEffect && d.radioEffect.paceBonus < 0) wear -= 0.1;
  d.damage = clamp(d.damage + wear * 0.05, 0, 8);
}

function computeLapTime(d, track, wet){
  const team = teamById(d.teamId);
  const effPace = team.pace + (team.id===STATE.myTeamId?STATE.carPaceBoost:0) + (team.id===STATE.myTeamId?(STATE.upgrades.aero+STATE.upgrades.pu)*2:0);
  const comp = COMPOUNDS[d.tyre];
  const life = tyreLifePercent(d);

  const paceDelta = (100 - effPace) * PACE_SCALE * 0.28;
  const skillDelta = (100 - d.skill) * PACE_SCALE * 0.22;
  let base = BASE_LAP + paceDelta + skillDelta;
  const ageLoss = Math.pow(1 - life/100, 1.8) * 3.5;
  const compoundOffset = (100 - comp.gripBase) * 0.06;

  let tempPenalty = 0;
  if(track.trackTempC < comp.tempMin) tempPenalty = (comp.tempMin-track.trackTempC)*0.04;
  else if(track.trackTempC > comp.tempMax) tempPenalty = (track.trackTempC-comp.tempMax)*0.03;
  if(track.trackTempC < 18 && d.tyreAge < 3 && !comp.wet) tempPenalty += (3-d.tyreAge)*0.15;

  let wetPenalty = 0;
  if(wet > 0.15 && !comp.wet) wetPenalty = wet*3.2;
  else if(wet <= 0.1 && comp.wet) wetPenalty = 1.4;
  else if(comp.wet && wet>0.15){
    if(d.tyre==='I' && wet>0.6) wetPenalty = (wet-0.6)*2.0;
    if(d.tyre==='W' && wet<0.35) wetPenalty = (wet-0.35)*2.5;
  }

  const fuelPenalty = (d.fuel - 50) * 0.01;
  const ers = ERS_MODES[d.ers] || ERS_MODES.balanced;
  const ersBonus = -ers.paceBonus * 20;
  let radioBonus = 0;
  if(d.radioEffect) radioBonus = -(d.radioEffect.paceBonus || 0) * 20;
  const dmgPenalty = d.damage * 0.45;

  let freshBonus = 0;
  if(d.tyreAge <= 3) freshBonus = -(3 - d.tyreAge) * 0.35;

  let flagMult = 1;
  if(RACE.scLapsRemaining > 0) flagMult = 1.55;
  else if(RACE.vscLapsRemaining > 0) flagMult = 1.35;

  let t = base + ageLoss + compoundOffset + tempPenalty + wetPenalty + fuelPenalty + ersBonus + radioBonus + dmgPenalty + freshBonus;
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

function checkIncidents(active){
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  active.forEach(d=>{
    if(d.retired) return;
    const team = teamById(d.teamId);
    const effReli = team.reliability + (team.id===STATE.myTeamId?STATE.carReliabilityBoost:0) + (team.id===STATE.myTeamId?STATE.upgrades.rel*2:0);
    const ers = ERS_MODES[d.ers] || ERS_MODES.balanced;
    const failChance = ((100-effReli) * 0.00018) * ers.reliabilityRisk * (1 + d.damage*0.15);
    const baseCrash = (100-d.consistency)*0.00006;
    const wetRisk = wet * 0.0006;
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
            other.penaltyLapsLeft = 1;
            other.penaltyFlashUntilLap = RACE.lap + 3;
            pushMsg('danger', 'RC:', `${other.abbr} given 5s penalty for causing a collision.`);
          }
        }
      } else {
        retireDriver(d, 'crash');
        if(Math.random() < 0.4) startSafetyCar(); else startVSC();
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

function retireDriver(d, reason){
  d.retired = true;
  d.retiredReason = reason;
  d.retiredLap = RACE.lap;
  const label = reason==='mechanical' ? 'retires (mechanical)' : 'crashes out';
  pushMsg('danger', 'RC:', `${d.abbr} ${label}!`);
  if(d.teamId===STATE.myTeamId) flashBanner(reason==='crash'?'Crash!':'Mechanical','red');
  if(reason==='crash'){
    const r = Math.random();
    if(r < 0.15) startRedFlag();
    else if(r < 0.40) startSafetyCar();
    else if(r < 0.70) startVSC();
    else triggerSectorYellow();
  } else {
    if(Math.random() < 0.2) startVSC();
    else triggerSectorYellow();
  }
}

function startVSC(){
  if(RACE.redFlagActive) return;
  RACE.vscLapsRemaining = rand(2,3);
  pushMsg('rc', 'RC:', 'Virtual Safety Car deployed.');
  flashBanner('Virtual Safety Car','yellow');
  setFlagUI();
}
function startSafetyCar(){
  if(RACE.redFlagActive) return;
  RACE.scLapsRemaining = rand(3,5);
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
  pushMsg('danger', 'RC:', 'RED FLAG — session stopped.');
  flashBanner('Red Flag','red');
  setFlagUI();
  racePaused = true; updateSpeedButtons();
  openRedFlagResumeModal();
}

function openRedFlagResumeModal(){
  const myDrivers = myTeam().drivers;
  openModal(`
    <h2 style="color:var(--red)">🔴 Red Flag</h2>
    <p>Race stopped. Choose tyres for the restart. Race resumes behind the Safety Car.</p>
    <p style="font-size:11.5px;color:var(--dimmer)">Dry compounds can only be used once per race. Wets always available.</p>
    ${myDrivers.map(d=>{
      const dd = RACE.drivers.find(x=>x.abbr===d.abbr);
      const used = dd.usedCompounds || new Set();
      return `
      <div class="driver-strat" data-abbr="${d.abbr}">
        <div class="driver-strat-name">
          <span>${d.name}</span>
          <span class="dim" style="font-size:11px">Current: ${dd.tyre}</span>
        </div>
        <div class="tyre-select">
          ${['S','M','H','I','W'].map(c=>{
            const isCurrent = dd.tyre === c;
            const isWet = COMPOUNDS[c].wet;
            const isUsed = used.has(c) && !isWet;
            const disabled = isUsed && !isCurrent;
            return `
            <button class="tyre-btn rf-tyre ${isCurrent?'active':''}" data-abbr="${d.abbr}" data-tyre="${c}" ${disabled?'disabled':''}>
              <span class="tyre-dot ${c}"></span>${COMPOUNDS[c].name}
              ${isCurrent?'<span class="used-tag">current</span>':''}
              ${disabled?'<span class="used-tag">used</span>':''}
            </button>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
    <div class="modal-actions"><button class="btn btn-primary" id="btnRedFlagResume">Restart race</button></div>
  `);
  const sel = {};
  myDrivers.forEach(d=>{
    const dd = RACE.drivers.find(x=>x.abbr===d.abbr);
    sel[d.abbr] = dd.tyre;
  });
  document.querySelectorAll('.rf-tyre').forEach(b=>b.addEventListener('click', ()=>{
    if(b.disabled) return;
    sel[b.dataset.abbr] = b.dataset.tyre;
    document.querySelectorAll(`.rf-tyre[data-abbr="${b.dataset.abbr}"]`).forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  }));
  document.getElementById('btnRedFlagResume').addEventListener('click', ()=>{
    RACE.drivers.forEach(d=>{
      const chosen = sel[d.abbr];
      if(chosen && chosen !== d.tyre){
        const isWet = COMPOUNDS[chosen].wet;
        const alreadyUsed = d.usedCompounds.has(chosen) && !isWet;
        if(!alreadyUsed){
          d.tyre = chosen;
          d.tyreAge = 0;
          d.usedCompounds.add(chosen);
          d.pitStops++;
          d.pitHistory.push({lap:RACE.lap, tyre:chosen, reason:'redflag'});
        }
      }
      d._puncture = false;
      d.damage = Math.max(0, d.damage - 2);
    });
    RACE.redFlagActive = false;
    RACE.redFlagModalPending = false;
    RACE.scLapsRemaining = 2;
    RACE.sectors = ['green','green','green'];
    racePaused = false; updateSpeedButtons();
    closeModal();
    pushMsg('rc', 'RC:', 'Race restarts behind the Safety Car.');
    setFlagUI();
    renderStrip();
  });
}

function maybeAIPitStop(d, track, wet){
  if(d.teamId===STATE.myTeamId) return;
  if(RACE.lap < 3 || d._pitTimer > 0) return;
  const style = PRINCIPAL_STYLES[d.teamId] || PRINCIPAL_STYLES.rbr;
  const comp = COMPOUNDS[d.tyre];
  const life = tyreLifePercent(d);
  const wantsWet = wet>0.35 && !comp.wet;
  const wantsSlickBack = wet<0.12 && comp.wet;
  const tyreWorn = life < (25 * style.pitBias);
  const duePlanned = d.nextPitLap && RACE.lap >= d.nextPitLap && d.pitStops < (d.pitPlan==='2-stop'?2:1);
  if((track.laps-RACE.lap) < 3) return;
  if(!(wantsWet || wantsSlickBack || tyreWorn || duePlanned)) return;

  const used = d.usedCompounds || new Set();
  let newTyre = null;

  if(wantsWet){
    newTyre = wet > 0.6 ? 'W' : 'I';
  } else {
    const preference = ['H','M','S'];
    const available = preference.filter(c => !used.has(c));
    if(available.length > 0) newTyre = available[0];
    else if(wet > 0.3) newTyre = 'I';
  }

  if(!newTyre) return;

  executePit(d, newTyre, d.damage >= 3 ? Math.min(d.damage, 5) : 0);
  if(d.pitPlan==='2-stop' && d.pitStops===1) d.nextPitLap = RACE.lap + Math.round(track.laps*randf(0.25,0.4));
  else d.nextPitLap = 99999;
}

function executePit(d, newTyre, repairAmount){
  if(d._pitTimer > 0) return;
  const used = d.usedCompounds || (d.usedCompounds = new Set());
  const isWet = COMPOUNDS[newTyre] && COMPOUNDS[newTyre].wet;

  if(used.has(newTyre) && !isWet){
    const dryLeft = ['S','M','H'].filter(c => !used.has(c));
    if(dryLeft.length === 0){
      pushMsg('strat', 'STRAT:', `${d.abbr}: no compounds left — repair only.`);
      newTyre = d.tyre;
    } else {
      newTyre = dryLeft[0];
      pushMsg('strat', 'STRAT:', `${d.abbr}: ${COMPOUNDS[newTyre].name} fitted instead.`);
    }
  }

  const pitLoss = 18 + randf(0, 6);
  const repairTime = (repairAmount || 0) * 6;
  d._pitTimer = 2;
  d._pendingTyre = newTyre;
  d._pendingRepair = repairAmount || 0;
  d.pitStops++;
  d.usedCompounds.add(newTyre);
  d.pitHistory.push({lap:RACE.lap, tyre:newTyre, repair: repairAmount||0});
  d.totalTime += pitLoss + repairTime;
  let msg = `${d.abbr} pits — ${COMPOUNDS[newTyre].name}`;
  if(repairAmount) msg += ` + 🔧 repair`;
  msg += ` (~${(pitLoss + repairTime).toFixed(1)}s)`;
  if(Math.random() < 0.15){
    d.totalTime += 1.5;
    msg += ' · slow stop +1.5s';
  }
  pushMsg('pit', 'PIT:', msg);
  if(d.teamId===STATE.myTeamId) flashBanner('Box box box','blue');
  d._armedPit = false;
  d._armedTyre = null;
  d._armedRepair = 0;
}

function armPit(driver, tyre, repair){
  if(!driver || driver.retired) return;
  const used = driver.usedCompounds || new Set();
  const isWet = COMPOUNDS[tyre] && COMPOUNDS[tyre].wet;
  if(used.has(tyre) && !isWet && tyre !== driver.tyre){
    pushMsg('strat', 'STRAT:', `${driver.abbr}: ${COMPOUNDS[tyre].name} already used — pick a different compound.`);
    return;
  }
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
  });
}

// ============ RACE UI: STRIP / PITBOX / RIBBON ============
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

const HEADSET_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`;

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
    return `
      <div class="myrow" data-abbr="${d.abbr}">
        <span class="pos">${posText}</span>
        <span class="num" style="background:${teamById(d.teamId).color}">${d.num}</span>
        <span class="gap">${d.retired?'—':gapText + inPit}</span>
        <span class="tyre">
          <span class="circle" style="border-color:${tyreColors[d.tyre]}; color:${tyreColors[d.tyre]}">${d.tyre}</span>
          <span class="life">${life}%</span>
        </span>
        <button class="radio-btn" data-radio-abbr="${d.abbr}" title="Radio">${HEADSET_SVG}</button>
        <button class="pbtn ${armedClass}" data-pit-abbr="${d.abbr}">${btnLabel}</button>
        <div class="radio-panel" data-radio-panel="${d.abbr}">
          <div class="radio-panel-title">Radio — ${d.name}</div>
          <div class="radio-buttons">
            ${RADIO_COMMANDS.filter(c=>!c.effect.boxNow).map(c=>`
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

  strip.querySelectorAll('.radio-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const abbr = b.dataset.radioAbbr;
      const panel = strip.querySelector(`[data-radio-panel="${abbr}"]`);
      strip.querySelectorAll('.radio-panel').forEach(p=>{
        if(p !== panel) p.classList.remove('active');
      });
      strip.querySelectorAll('.radio-btn').forEach(x=>x.classList.remove('active'));
      const wasActive = panel.classList.contains('active');
      if(wasActive){
        panel.classList.remove('active');
      } else {
        panel.classList.add('active');
        b.classList.add('active');
      }
    });
  });

  strip.querySelectorAll('[data-radio-cmd]').forEach(b=>{
    b.addEventListener('click', ()=>{
      sendRadioFor(b.dataset.radioTarget, b.dataset.radioCmd);
    });
  });
}

function renderPitBox(){
  const box = document.getElementById('pitbox');
  if(!box || !RACE) return;
  const pitting = RACE.drivers.filter(d => d._pitTimer > 0);
  if(pitting.length === 0){
    box.innerHTML = '<span class="label">PIT BOX</span><span class="empty">— no cars in pit —</span>';
    return;
  }
  box.innerHTML = '<span class="label">PIT BOX</span>' + pitting.map(d=>{
    const pct = 1 - (d._pitTimer / 2);
    return `
      <div class="slot">
        <div class="cell" style="background:${teamById(d.teamId).color}">${d.num}</div>
        <div class="bar"><div style="width:${pct*100}%"></div></div>
      </div>
    `;
  }).join('');
}

function openPitMenu(driver){
  if(!driver || driver.retired) return;
  if(driver._armedPit){ cancelPit(driver); renderStrip(); return; }
  const life = Math.round(tyreLifePercent(driver));
  const health = Math.round(carHealthPercent(driver));
  const used = driver.usedCompounds || new Set();
  const compounds = ['S','M','H','I','W'];
  openModal(`
    <h2>Pit call — ${driver.name}</h2>
    <p style="font-size:12px">Current: ${COMPOUNDS[driver.tyre].name} · Tyres ${life}% · Car ${health}%</p>
    <div style="font-size:11.5px;color:var(--dim);margin:14px 0 4px">New tyres</div>
    <div class="tyre-select" id="pitTyreRow">
      ${compounds.map(c=>{
        const isCurrent = c === driver.tyre;
        const isWet = COMPOUNDS[c].wet;
        const isUsed = used.has(c) && !isWet;
        const disabled = isUsed && !isCurrent;
        return `
        <button class="tyre-btn pit-tyre ${isCurrent?'active':''}" data-tyre="${c}" ${disabled?'disabled':''}>
          <span class="tyre-dot ${c}"></span>${COMPOUNDS[c].name}
          ${isCurrent?'<span class="used-tag">current</span>':''}
          ${disabled?'<span class="used-tag">used</span>':''}
        </button>`;
      }).join('')}
    </div>
    <div style="font-size:11.5px;color:var(--dim);margin:14px 0 4px">Repairs (optional)</div>
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
    if(b.disabled) return;
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
  const strip = document.getElementById('mystrip');
  strip.querySelectorAll('.radio-panel').forEach(p=>p.classList.remove('active'));
  strip.querySelectorAll('.radio-btn').forEach(x=>x.classList.remove('active'));
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

  const { points, cum, total } = trackData;
  const pad = 30;
  const trackW = w - pad * 2;
  const trackH = h - pad * 2;

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
  ctx.strokeStyle = '#1a1f28';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2A2F38';
  ctx.stroke();

  const sfX = pad + points[0].x * trackW;
  const sfY = pad + points[0].y * trackH;
  ctx.beginPath();
  ctx.arc(sfX, sfY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#EDEAE2';
  ctx.fill();

  const active = RACE.drivers.filter(d => !d.retired && d._pitTimer === 0);
  const leader = active.reduce((a,b)=> a.totalTime < b.totalTime ? a : b, active[0]);
  const leaderTime = leader ? leader.totalTime : 0;

  const drawOrder = active.slice().sort((a,b)=>{
    const aMine = a.teamId === STATE.myTeamId ? 1 : 0;
    const bMine = b.teamId === STATE.myTeamId ? 1 : 0;
    return aMine - bMine;
  });

  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  drawOrder.forEach(d=>{
    const gap = d.totalTime - leaderTime;
    const frac = ((gap / LAP_TIME_APPROX) % 1 + 1) % 1;
    const pt = positionAtFraction(points, cum, total, 1 - frac);
    const x = pad + pt.x * trackW;
    const y = pad + pt.y * trackH;
    const isMine = d.teamId === STATE.myTeamId;
    const radius = isMine ? 12 : 10;
    const teamColor = teamById(d.teamId).color;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = teamColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = isMine ? '#ffffff' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = isMine ? 2 : 1;
    ctx.stroke();

    ctx.fillStyle = '#0B0D10';
    ctx.font = `bold ${isMine ? 11 : 10}px ui-monospace, monospace`;
    ctx.fillText(String(d.num), x, y + 1);

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

// ============ FINISH & RESULTS ============
function finishRace(){
  RACE.finished = true;
  const el = document.getElementById('flagIndicator');
  el.className = 'flag-indicator flag-checkered';
  el.textContent = 'Finished';
  pushMsg('rc', 'RC:', 'Chequered flag.');
}

function showRaceResults(){
  stopSimLoop();
  stopRenderLoop();

  const classified = RACE.drivers.filter(d=>!d.retired);
  const dnfs = RACE.drivers.filter(d=>d.retired);
  const results = [...classified, ...dnfs];

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
    const rating = computeDriverRating({
      finishPos: retired ? 22 : pos,
      startPos: d.startPosition,
      retired,
      fastestLap: d.abbr === RACE.fastestLapHolder,
      hadContact: d._hadContact,
    });
    return {
      abbr: d.abbr,
      name: d.name,
      num: d.num,
      teamId: d.teamId,
      teamName: teamById(d.teamId).name,
      pos: retired ? null : pos,
      retired,
      rating,
      startPos: d.startPosition,
    };
  });

  let myPrize = 0;
  const myResults = [];
  results.forEach((d,i)=>{
    const pts = i<POINTS_TABLE.length && !d.retired ? POINTS_TABLE[i] : 0;
    STATE.driversPoints[d.abbr] = (STATE.driversPoints[d.abbr]||0) + pts;
    STATE.constructorsPoints[d.teamId] = (STATE.constructorsPoints[d.teamId]||0) + pts;

    const stats = STATE.driverSeasonStats[d.abbr] || (STATE.driverSeasonStats[d.abbr] = { points:0, wins:0, podiums:0, poles:0, fastestLaps:0, dnfs:0, ratings:[] });
    stats.points += pts;
    if(i === 0 && !d.retired) stats.wins++;
    if(i <= 2 && !d.retired) stats.podiums++;
    if(d.abbr === RACE.fastestLapHolder) stats.fastestLaps++;
    if(d.retired) stats.dnfs++;
    const rating = classification.find(c=>c.abbr === d.abbr)?.rating || 5;
    stats.ratings.push(rating);

    if(d.teamId === STATE.myTeamId){
      myPrize += PRIZE_BY_POS[i] || PRIZE_BY_POS[PRIZE_BY_POS.length-1];
      myResults.push({ abbr:d.abbr, name:d.name, pos:i+1, retired:d.retired });
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

  const seasonEntry = ensureCurrentSeasonEntry();
  const track = RACE.track;
  seasonEntry.races[STATE.round] = {
    trackId: track.id,
    trackName: track.name,
    classification,
    winnerAbbr: results[0]?.abbr || null,
    yourBestAbbr: myResults.filter(r=>!r.retired).sort((a,b)=>a.pos-b.pos)[0]?.abbr || null,
    yourBestPos: myResults.filter(r=>!r.retired).sort((a,b)=>a.pos-b.pos)[0]?.pos || null,
    fastestLapAbbr: RACE.fastestLapHolder,
    fastestLapName: fastest ? fastest.name : null,
    biggestMoverAbbr: biggestMover?.abbr || null,
    biggestMoverName: biggestMover?.name || null,
    biggestMoverPlaces: biggestMove,
  };

  const bestPos = myResults.filter(r=>!r.retired).sort((a,b)=>a.pos-b.pos)[0]?.pos || 20;
  const expected = { title:3, contender:6, midfield:9, backmarker:12 }[myTeam().tier];
  const delta = clamp((expected - bestPos) * 1.2, -12, 14);
  STATE.boardConf = clamp(STATE.boardConf + delta, 0, 100);
  STATE.budget += myPrize;

  STATE.round++;
  applyPendingUpgrades();
  saveToSlot(activeSlot);

  if(STATE.boardConf <= 5 && STATE.round < TRACKS.length){ renderFiredModal(); return; }

  renderResultsModal(results, myResults, myPrize, delta, classification);
}

function renderResultsModal(results, myResults, myPrize, delta, classification){
  const rows = results.map((d,i)=>{
    const t = teamById(d.teamId);
    const pts = i<POINTS_TABLE.length && !d.retired ? POINTS_TABLE[i] : 0;
    const c = classification.find(x=>x.abbr===d.abbr);
    const rating = c ? c.rating.toFixed(1) : '—';
    const ratingClass = c && c.rating >= 7.5 ? 'rating-high' : c && c.rating >= 5 ? 'rating-mid' : 'rating-low';
    return `<div class="rd-row ${d.teamId===STATE.myTeamId?'me':''} ${d.retired?'dnf':''}">
      <span class="rd-pos">${d.retired ? 'DNF' : 'P'+(i+1)}</span>
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
      <span class="team-stat-mini">PRIZE <b style="color:var(--amber)">$${myPrize.toFixed(1)}M</b></span>
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
