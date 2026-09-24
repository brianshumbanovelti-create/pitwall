// ===================== STATE =====================
const SAVE_PREFIX = 'pitwall_slot_';
const SAVE_SLOTS = 3;
const SAVE_VERSION = 8;
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
    seasonArchive: [],
    upgrades: { aero:0, pu:0, rel:0, strat:0 },
    pendingUpgrades: [],
    pendingGridPenalties: {},
    settings: { sound: true },
    marketOffers: [],
    form: {},
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
  return { id: roleKey+'_start', name: randName(), role: roleKey, roleLabel: role.label, affects: role.affects, skill: clamp(base + rand(-4,4), 20, 99) };
}
function randName(){ return `${pick(ENGINEER_FIRST)} ${pick(ENGINEER_LAST)}`; }
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randf(min,max){ return Math.random()*(max-min)+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

// ===================== PRINCIPAL STYLES =====================
const PRINCIPAL_STYLES = {
  mer: { style:'conservative', pitBias: 1.10, label:'Conservative' },
  fer: { style:'aggressive',   pitBias: 0.88, label:'Aggressive' },
  mcl: { style:'tyre-whisperer',pitBias:1.05, label:'Tyre-whisperer' },
  rbr: { style:'balanced',     pitBias: 1.00, label:'Balanced' },
  vcb: { style:'balanced',     pitBias: 1.00, label:'Balanced' },
  alp: { style:'aggressive',   pitBias: 0.92, label:'Aggressive' },
  haa: { style:'conservative', pitBias: 1.08, label:'Conservative' },
  aud: { style:'conservative', pitBias: 1.08, label:'Conservative' },
  wil: { style:'balanced',     pitBias: 1.00, label:'Balanced' },
  amr: { style:'aggressive',   pitBias: 0.90, label:'Aggressive' },
  cad: { style:'conservative', pitBias: 1.10, label:'Conservative' },
};

// ===================== PERSISTENCE =====================
function saveToSlot(slot){ try{ localStorage.setItem(SAVE_PREFIX+slot, JSON.stringify(STATE)); }catch(e){} }
function loadFromSlot(slot){
  try{
    const raw = localStorage.getItem(SAVE_PREFIX+slot);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s.boardConf) s.boardConf = 70;
    if(!s.upgrades) s.upgrades = {aero:0,pu:0,rel:0,strat:0};
    if(!s.settings) s.settings = { sound:true };
    if(!s.pendingUpgrades) s.pendingUpgrades = [];
    if(!s.pendingGridPenalties) s.pendingGridPenalties = {};
    if(!s.marketOffers) s.marketOffers = [];
    if(!s.form) s.form = {};
    if(s.capUsed===undefined) s.capUsed = 0;
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
      const meta = s ? `Season ${s.season} · Round ${s.round+1}/24 · ${TEAMS.find(t=>t.id===s.myTeamId).abbr} · $${s.budget}M` : 'Empty slot';
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
function currentTrack(){ return TRACKS[STATE.round] || null; }

function enterHub(){ renderHub(); showScreen('screen-hub'); }

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
      <div class="hub-section-title">Teammate head-to-head</div>
      <div class="hub-section-sub">Season record in qualifying and races.</div>
      <div id="h2hBox" style="font-size:12.5px;color:var(--dim)"></div>
    </div>

    <div class="hub-section">
      <div class="hub-section-title">Engineering staff</div>
      <div class="hub-section-sub">Skill above 60 boosts your car.</div>
      <div class="roster-grid" id="rosterGrid"></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="btnOpenHiring">Candidates</button>
        <button class="btn btn-ghost btn-sm" id="btnOpenUpgrades">Develop car</button>
        <button class="btn btn-ghost btn-sm" id="btnOpenMarket">Driver market</button>
        <button class="btn btn-ghost btn-sm" id="btnOpenArchive">Season archive</button>
      </div>
    </div>
  `;
  document.getElementById('btnStartWeekend').addEventListener('click', ()=>startWeekend());
  document.getElementById('btnOpenHiring').addEventListener('click', openHiringModal);
  document.getElementById('btnOpenUpgrades').addEventListener('click', openUpgradesModal);
  document.getElementById('btnOpenMarket').addEventListener('click', openMarketModal);
  document.getElementById('btnOpenArchive').addEventListener('click', openArchiveModal);

  const consBody = document.getElementById('consTableBody');
  getConstructorsStandings().forEach((s,i)=>{
    const t = teamById(s.teamId);
    const tr = document.createElement('tr');
    if(t.id===STATE.myTeamId) tr.className='me';
    tr.innerHTML = `<td class="pos">${i+1}</td><td><span class="team-pill" style="background:${t.color}"></span>${t.abbr} <span class="dim" style="font-size:11px">${t.name}</span></td><td class="pts">${s.points}</td>`;
    consBody.appendChild(tr);
  });

  const h2h = document.getElementById('h2hBox');
  const t = myTeam();
  const [d1, d2] = t.drivers;
  const f1 = STATE.form[d1.abbr] || { pointsThisSeason: 0, raceWins: 0, qualiWins: 0 };
  const f2 = STATE.form[d2.abbr] || { pointsThisSeason: 0, raceWins: 0, qualiWins: 0 };
  h2h.innerHTML = `
    <div class="side-row"><span>${d1.abbr} pts</span><b>${f1.pointsThisSeason || 0}</b></div>
    <div class="side-row"><span>${d2.abbr} pts</span><b>${f2.pointsThisSeason || 0}</b></div>
    <div class="side-row"><span>Race h2h</span><b>${f1.raceWins || 0} – ${f2.raceWins || 0}</b></div>
    <div class="side-row"><span>Quali h2h</span><b>${f1.qualiWins || 0} – ${f2.qualiWins || 0}</b></div>
  `;

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
  document.getElementById('btnNextSeason')?.addEventListener('click', advanceSeason);
}
function advanceSeason(){
  STATE.seasonArchive.push({
    season: STATE.season,
    championTeam: getConstructorsStandings()[0].teamId,
    championDriver: getDriversStandings()[0].abbr,
    myPos: getConstructorsStandings().findIndex(s=>s.teamId===STATE.myTeamId)+1,
  });
  STATE.season++;
  STATE.round = 0;
  STATE.capUsed = 0;
  STATE.constructorsPoints = Object.fromEntries(TEAMS.map(t=>[t.id,0]));
  STATE.driversPoints = Object.fromEntries(TEAMS.flatMap(t=>t.drivers.map(d=>[d.abbr,0])));
  STATE.pendingGridPenalties = {};
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
    team.drivers[idx] = { name:o.name, abbr:o.abbr, skill:o.skill, consistency:o.consistency };
    delete STATE.driversPoints[weakest.abbr];
    STATE.driversPoints[o.abbr] = 0;
    STATE.driverTeam[o.abbr] = team.id;
    delete STATE.driverTeam[weakest.abbr];
    STATE.marketOffers = STATE.marketOffers.filter(x=>x.id!==o.id);
    saveToSlot(activeSlot);
    closeModal(); renderHub();
  }));
  document.getElementById('btnCloseMarket').addEventListener('click', closeModal);
}
function generateMarketOffers(){
  const pool = [
    { name:'Daniel Ricciardo', abbr:'RIC', skill:82, consistency:82, cost:18 },
    { name:'Mick Schumacher',  abbr:'MSC', skill:76, consistency:76, cost:12 },
    { name:'Zhou Guanyu',      abbr:'ZHO', skill:77, consistency:78, cost:13 },
    { name:'Kevin Magnussen',  abbr:'MAG', skill:79, consistency:79, cost:14 },
    { name:'Jack Doohan',      abbr:'DOO', skill:74, consistency:74, cost:10 },
    { name:'Theo Pourchaire',  abbr:'POU', skill:73, consistency:73, cost:9  },
    { name:'Robert Shwartzman',abbr:'SHW', skill:75, consistency:76, cost:11 },
    { name:'Felipe Drugovich', abbr:'DRU', skill:75, consistency:75, cost:11 },
  ];
  return pool.sort(()=>Math.random()-0.5).slice(0,4).map((p,i)=>({ ...p, id:'off_'+Date.now()+'_'+i }));
}

// ===================== ARCHIVE =====================
function openArchiveModal(){
  const rows = STATE.seasonArchive.map(a=>`
    <div class="save-slot">
      <div>
        <div style="font-weight:700">Season ${a.season}</div>
        <div class="meta">Champion: ${teamById(a.championTeam).name} · Driver: ${a.championDriver} · You finished P${a.myPos}</div>
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

function formatClock(ms){
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function startRace(gridOverride, strategyOverride){
  const track = currentTrack();
  RACE = buildRaceState(track, gridOverride);
  RACE.drivers.forEach(d=>{
    const s = strategyOverride && strategyOverride[d.abbr];
    if(s){
      if(s.tyre) d.tyre = s.tyre;
      d.pitPlan = s.plan || '1-stop';
      d.orders = s.orders || 'fight';
    } else {
      d.tyre = aiStartTyre(track);
      d.pitPlan = Math.random()<0.5?'1-stop':'2-stop';
    }
    d.usedCompounds = new Set([d.tyre]);
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
  renderTower();
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
    abbr:g.abbr, name:g.name, teamId:g.teamId, skill:g.skill, consistency:g.consistency,
    position:i+1, startPosition:i+1,
    totalTime: 0,
    gapToLeader: 0, interval: 0,
    tyre:'M', tyreAge:0, pitStops:0, pitHistory:[],
    usedCompounds: new Set(['M']),
    retired:false, retiredReason:null, retiredLap:null,
    damage:0, penaltyLapsLeft:0,
    distanceCovered: 0,
    fuel: 100,
    ers: 'balanced',
    radioEffect: null,
    bestSector: [0,0,0],
    lastSectors: [0,0,0],
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
    dsq: false,
    dsqReason: null,
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
    unreadCount: 0,
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
      entries.push({ abbr:drv.abbr, name:drv.name, teamId:team.id, skill:drv.skill, consistency:drv.consistency, effPace, qualiScore:q });
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
  document.getElementById('radioPanel').style.display = 'none';
  const sel = document.getElementById('radioDriver');
  sel.innerHTML = myTeam().drivers.map(d=>`<option value="${d.abbr}">${d.name} (${d.abbr})</option>`).join('');
  const wrap = document.getElementById('radioButtons');
  wrap.innerHTML = RADIO_COMMANDS.map(c=>`<button class="btn btn-ghost btn-sm" data-radio="${c.key}">${c.label}</button>`).join('');
  wrap.querySelectorAll('[data-radio]').forEach(b=>b.addEventListener('click', ()=>sendRadio(b.dataset.radio)));
  document.getElementById('radioClose').addEventListener('click', ()=>{
    document.getElementById('radioPanel').style.display = 'none';
  });
  renderSectorLegend();
  pushMsg('strat', 'STRAT:', `Radio link open. Green flag at ${track.name}.`);
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
    <div class="row"><span class="dot ${s[0]}"></span> Sector 1</div>
    <div class="row"><span class="dot ${s[1]}"></span> Sector 2</div>
    <div class="row"><span class="dot ${s[2]}"></span> Sector 3</div>
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

document.getElementById('tabTower').addEventListener('click', ()=>setRaceTab('tower'));
document.getElementById('tabTrack').addEventListener('click', ()=>setRaceTab('track'));
function setRaceTab(t){
  document.getElementById('tabTower').classList.toggle('active', t==='tower');
  document.getElementById('tabTrack').classList.toggle('active', t==='track');
  document.getElementById('towerWrap').style.display = t==='tower'?'block':'none';
  document.getElementById('trackWrap').style.display = t==='track'?'flex':'none';
  if(t==='track'){ resizeTrackCanvas(); drawTrackView(); }
}

function updateSpeedButtons(){
  document.getElementById('speedPause').classList.toggle('active', racePaused);
  document.getElementById('speed2').classList.toggle('active', !racePaused && raceSpeed===2);
  document.getElementById('speed4').classList.toggle('active', !racePaused && raceSpeed===4);
}
document.getElementById('speedPause').addEventListener('click', ()=>{
  racePaused = !racePaused;
  updateSpeedButtons();
});
document.getElementById('speed2').addEventListener('click', ()=>{
  racePaused = false; raceSpeed = 2; updateSpeedButtons();
});
document.getElementById('speed4').addEventListener('click', ()=>{
  racePaused = false; raceSpeed = 4; updateSpeedButtons();
});
document.getElementById('speedSkip').addEventListener('click', ()=>{
  if(!RACE || RACE.finished) return;
  racePaused = true;
  const safety = RACE.laps * 3;
  let guard = 0;
  while(!RACE.finished && guard++ < safety) simulateLap(true);
  renderTower();
  if(RACE.finished){
    stopSimLoop();
    stopRenderLoop();
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
    renderTower();
    if(RACE.finished){
      stopSimLoop();
      stopRenderLoop();
      setTimeout(showRaceResults, 800);
    }
  }, simIntervalMs);
}
function stopSimLoop(){
  if(simTimer){ clearInterval(simTimer); simTimer = null; }
}
function startRenderLoop(){
  stopRenderLoop();
  const loop = ()=>{
    rafId = requestAnimationFrame(loop);
    if(!RACE || RACE.finished) return;
    if(document.getElementById('trackWrap').style.display !== 'none'){
      drawTrackView();
    }
  };
  loop();
}
function stopRenderLoop(){
  if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
}

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
  if(!silent){
    document.getElementById('lapNow').textContent = RACE.lap;
  }

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
    const sectors = computeSectors(d, track, wet);
    d.lastSectors = sectors;
    for(let s=0;s<3;s++){
      if(!d.bestSector[s] || sectors[s] < d.bestSector[s]) d.bestSector[s] = sectors[s];
    }
    const lapTime = sectors[0]+sectors[1]+sectors[2];
    d.totalTime += lapTime;
    d.tyreAge++;
    d.distanceCovered += 1;
    d.lapTimes.push(lapTime);
    d.fuel = Math.max(0, d.fuel - 1.6);
    applyCarWear(d);
    if(d.radioEffect && RACE.lap >= d.radioEffect.untilLap) d.radioEffect = null;
    if(d.penaltyFlashUntilLap && RACE.lap > d.penaltyFlashUntilLap) d.penaltyFlashUntilLap = 0;
  });

  active.forEach(d=>{
    const life = tyreLifePercent(d);
    if(life <= 10 && !d._puncture && !d.retired){
      if(Math.random() < 0.06){
        d._puncture = true;
        pushMsg('rc', 'RC:', `${d.abbr} PUNCTURE!`);
        if(d.teamId===STATE.myTeamId) flashBanner('Puncture!','red');
        d.totalTime += 28 + randf(-3,5);
        if(d._pitTimer===0){
          const newTyre = pickAllowedCompounds(d, wet);
          if(newTyre) executePit(d, newTyre, 0);
        }
        if(Math.random() < 0.08) retireDriver(d, 'crash');
      }
    }
  });

  active.forEach(d=>{
    if(d.retired) return;
    if(d.damage >= 6){
      const dnfChance = d.damage >= 8 ? 0.08 : 0.04;
      if(Math.random() < dnfChance){
        pushMsg('rc', 'RC:', `${d.abbr} car failure — OUT.`);
        if(d.teamId===STATE.myTeamId) flashBanner('Car Failure','red');
        retireDriver(d, 'mechanical');
      }
    }
  });

  const fastest = active.slice().sort((a,b)=>a.lastLapTime-b.lastLapTime)[0];
  if(fastest && (!RACE.fastestLapTime || fastest.lastLapTime < RACE.fastestLapTime)){
    RACE.fastestLapTime = fastest.lastLapTime;
    RACE.fastestLapHolder = fastest.abbr;
    pushMsg('strat', 'STRAT:', `${fastest.abbr} fastest lap of the race.`);
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

function computeSectors(d, track, wet){
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
    if(d.tyre==='W' && wet<0.35) wetPenalty = (0.35-wet)*2.5;
  }

  const fuelPenalty = (d.fuel - 50) * 0.01;
  const ers = ERS_MODES[d.ers] || ERS_MODES.balanced;
  const ersBonus = -ers.paceBonus * 20;
  let radioBonus = 0;
  if(d.radioEffect) radioBonus = -(d.radioEffect.paceBonus || 0) * 20;
  const dmgPenalty = d.damage * 0.45;

  let freshBonus = 0;
  if(d.tyreAge <= 3) freshBonus = -(3 - d.tyreAge) * 0.35;

  const sectorList = [];
  for(let s=0;s<3;s++){
    let t = (base + ageLoss + compoundOffset + tempPenalty + wetPenalty + fuelPenalty + ersBonus + radioBonus + dmgPenalty + freshBonus) / 3;
    t += randf(-0.3, 0.3) * (1 - d.consistency/140);
    if(RACE.sectors[s]==='yellow') t += 0.5;
    if(RACE.sectors[s]==='red')    t += 1.5;
    if(RACE.scLapsRemaining>0) t *= 1.55;
    else if(RACE.vscLapsRemaining>0) t *= 1.35;
    sectorList.push(t);
  }
  if(d.penaltyLapsLeft > 0){ sectorList[0] += 5; d.penaltyLapsLeft--; }
  return sectorList;
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
        pushMsg('rc', 'RC:', `${d.abbr} picks up damage after contact.`);
        if(d.teamId===STATE.myTeamId) flashBanner('Damage!','yellow');
        triggerSectorYellow();
        if(Math.random() < 0.3){
          const other = pick(active.filter(x=>x!==d && !x.retired));
          if(other){
            other.penaltyLapsLeft = 1;
            other.penaltyFlashUntilLap = RACE.lap + 3;
            pushMsg('rc', 'RC:', `${other.abbr} given 5s penalty for causing a collision.`);
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
  const label = reason==='mechanical' ? 'retires with mechanical failure' : 'crashes out';
  pushMsg('rc', 'RC:', `${d.abbr} ${label}!`);
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
  pushMsg('rc', 'RC:', 'RED FLAG — session stopped.');
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
    ${myDrivers.map(d=>{
      const dd = RACE.drivers.find(x=>x.abbr===d.abbr);
      return `
      <div class="driver-strat" data-abbr="${d.abbr}">
        <div class="driver-strat-name">${d.name} <span class="dim" style="font-size:11px">(${d.abbr})</span></div>
        <div class="tyre-select">
          ${['S','M','H','I','W'].map(c=>{
            const used = dd.usedCompounds && dd.usedCompounds.has(c) && !COMPOUNDS[c].wet;
            return `
            <button class="tyre-btn rf-tyre" data-abbr="${d.abbr}" data-tyre="${c}" ${used?'disabled':''}>
              <span class="tyre-dot ${c}"></span>${COMPOUNDS[c].name}
              ${used?'<span class="used-tag">used</span>':''}
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
  }));
  document.getElementById('btnRedFlagResume').addEventListener('click', ()=>{
    RACE.drivers.forEach(d=>{
      if(sel[d.abbr]){
        d.tyre = sel[d.abbr]; d.tyreAge = 0;
        d.usedCompounds.add(d.tyre);
        d._puncture = false; d.pitStops++;
        d.pitHistory.push({lap:RACE.lap, tyre:d.tyre, reason:'redflag'});
      }
    });
    RACE.drivers.forEach(d=>{ d.damage = Math.max(0, d.damage - 2); });
    RACE.redFlagActive = false;
    RACE.redFlagModalPending = false;
    RACE.scLapsRemaining = 2;
    RACE.sectors = ['green','green','green'];
    racePaused = false; updateSpeedButtons();
    closeModal();
    pushMsg('rc', 'RC:', 'Race restarts behind the Safety Car.');
    setFlagUI();
  });
}

function pickAllowedCompounds(d, wet){
  const used = d.usedCompounds || new Set();
  const options = [];
  if(wet > 0.3){
    options.push('I');
    if(wet > 0.6) options.push('W');
  }
  ['S','M','H'].forEach(c=>{
    if(!used.has(c)) options.push(c);
  });
  options.push('I','W');
  const unique = [...new Set(options)];
  return unique.length ? pick(unique) : 'W';
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
  if(wantsWet || wantsSlickBack || tyreWorn || duePlanned){
    const used = d.usedCompounds || new Set();
    let newTyre;
    if(wantsWet){
      newTyre = wet>0.6?'W':'I';
    } else {
      const available = ['M','H','S'].filter(c=>!used.has(c));
      newTyre = available.length ? pick(available) : (wantsSlickBack ? 'H' : 'W');
    }
    executePit(d, newTyre, d.damage >= 3 ? Math.min(d.damage, 5) : 0);
    if(d.pitPlan==='2-stop' && d.pitStops===1) d.nextPitLap = RACE.lap + Math.round(track.laps*randf(0.25,0.4));
    else d.nextPitLap = 99999;
  }
}

function executePit(d, newTyre, repairAmount){
  if(d._pitTimer > 0) return;
  const pitLoss = 18 + randf(0, 6);
  const repairTime = (repairAmount || 0) * 6;
  d._pitTimer = 2;
  d._pendingTyre = newTyre || d.tyre;
  d._pendingRepair = repairAmount || 0;
  d.pitStops++;
  d.usedCompounds.add(d._pendingTyre);
  d.pitHistory.push({lap:RACE.lap, tyre:d._pendingTyre, repair: repairAmount||0});
  d.totalTime += pitLoss + repairTime;
  let msg = `${d.abbr} pits — ${COMPOUNDS[d._pendingTyre].name}`;
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
    if(life < 40 && life > 25) engineerSay(d, `${d.abbr}: tyres at ${Math.round(life)}% — plan a stop soon.`, 'tyrewarn1_'+d.abbr);
    if(life < 25 && life > 15) engineerSay(d, `${d.abbr}: tyres going off, box this lap.`, 'tyrewarn2_'+d.abbr);
    if(d.damage >= 3 && d.damage < 5) engineerSay(d, `${d.abbr}: floor damage — we can repair at the next stop.`, 'dmgwarn1_'+d.abbr);
    if(d.damage >= 5) engineerSay(d, `${d.abbr}: car is heavily damaged — repair now or we risk failure.`, 'dmgwarn2_'+d.abbr);
    const wet = RACE.wetness[Math.min(RACE.lap, RACE.wetness.length-1)] || 0;
    if(wet > 0.2 && !COMPOUNDS[d.tyre].wet) engineerSay(d, `${d.abbr}: it's raining — inters may be needed.`, 'rain1_'+d.abbr);
    if(wet > 0.6 && d.tyre === 'I') engineerSay(d, `${d.abbr}: heavy rain — full wets would be faster.`, 'rain2_'+d.abbr);
    const used = d.usedCompounds || new Set();
    const dryLeft = ['S','M','H'].filter(c=>!used.has(c));
    if(!COMPOUNDS[d.tyre].wet){
      if(dryLeft.length === 1) engineerSay(d, `${d.abbr}: only ${COMPOUNDS[dryLeft[0]].name} left in dry compounds.`, 'tyrecap1_'+d.abbr);
      if(dryLeft.length === 0) engineerSay(d, `${d.abbr}: no dry compounds left — you must stay out.`, 'tyrecap0_'+d.abbr);
    }
    // Two-compound rule warning
    const usedDry = ['S','M','H'].filter(c=>used.has(c));
    const totalLaps = RACE.laps;
    const remaining = totalLaps - RACE.lap;
    if(usedDry.length < 2 && remaining <= 12 && RACE.wetness[Math.min(RACE.lap, RACE.wetness.length-1)] < 0.1){
      engineerSay(d, `${d.abbr}: you must use two compounds — pit for a different tyre or face DSQ.`, 'twocomp_'+d.abbr);
    }
  });
}

function sendRadio(key){
  const cmd = RADIO_COMMANDS.find(c=>c.key===key);
  if(!cmd || !RACE) return;
  const abbr = document.getElementById('radioDriver').value;
  const driver = RACE.drivers.find(d=>d.abbr===abbr);
  if(!driver || driver.retired) return;
  if(cmd.effect.boxNow){ openPitMenu(driver); return; }
  driver.radioEffect = {
    paceBonus: cmd.effect.paceBonus || 0,
    degMult: cmd.effect.degMult || 1,
    untilLap: RACE.lap + (cmd.effect.durationLaps || 3),
  };
  if(cmd.effect.teamOrder) driver.orders = cmd.effect.teamOrder;
  pushMsg('cmd', 'CMD:', cmd.label);
  setTimeout(()=>pushMsg('driver', driver.abbr+':', cmd.reply), 500);
  beep('radio');
}

// ---- Messages ----
function pushMsg(kind, tag, text){
  if(!RACE) return;
  const lap = RACE.lap;
  const entry = { kind, tag, text, lap };
  RACE.messages.push(entry);
  RACE.unreadCount = (RACE.unreadCount || 0) + 1;
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
  if(RACE.unreadCount > 0) pips.push(`<span class="pip unread">● ${RACE.unreadCount}</span>`);
  document.getElementById('ribbonPips').innerHTML = pips.join('');
  rib.classList.remove('flash');
  void rib.offsetWidth;
  rib.classList.add('flash');
}

document.getElementById('msgRibbon').addEventListener('click', openMessageLog);
function openMessageLog(){
  if(!RACE) return;
  RACE.unreadCount = 0;
  renderRibbon();
  const rows = RACE.messages.map(m=>`
    <div class="msg-log-row ${m.kind}">
      <span class="msg-tag">${m.tag}</span>
      <span class="msg-log-text">${m.text}</span>
    </div>
  `).join('');
  openModal(`
    <h2>Message log</h2>
    <div class="msg-log">${rows || '<p class="meta">No messages yet.</p>'}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="btnExportMsg">Copy log</button>
      <button class="btn btn-primary btn-sm" id="btnCloseMsg">Close</button>
    </div>
  `);
  document.getElementById('btnCloseMsg').addEventListener('click', closeModal);
  document.getElementById('btnExportMsg').addEventListener('click', ()=>{
    const txt = RACE.messages.map(m=>`${m.tag} ${m.text}`).join('\n');
    navigator.clipboard?.writeText(txt).then(()=>{
      const b = document.getElementById('btnExportMsg');
      b.textContent = 'Copied!';
      setTimeout(()=>b.textContent = 'Copy log', 1500);
    });
  });
}

// ---- Pit menu ----
function openPitMenu(driver){
  if(!driver || driver.retired) return;
  if(driver._armedPit){ cancelPit(driver); renderTower(); return; }
  const life = Math.round(tyreLifePercent(driver));
  const health = Math.round(carHealthPercent(driver));
  const used = driver.usedCompounds || new Set();
  const currentWet = COMPOUNDS[driver.tyre].wet;
  const compounds = ['S','M','H','I','W'];
  openModal(`
    <h2>Pit call — ${driver.name}</h2>
    <p style="font-size:12px">Current: ${COMPOUNDS[driver.tyre].name} · Tyres ${life}% · Car ${health}%</p>
    <div style="font-size:11.5px;color:var(--dim);margin:14px 0 4px">New tyres</div>
    <div class="tyre-select" id="pitTyreRow">
      ${compounds.map(c=>{
        const isUsed = used.has(c) && !COMPOUNDS[c].wet;
        const disabled = isUsed && c !== driver.tyre;
        return `
        <button class="tyre-btn pit-tyre ${c===driver.tyre?'active':''}" data-tyre="${c}" ${disabled?'disabled':''}>
          <span class="tyre-dot ${c}"></span>${COMPOUNDS[c].name}
          ${isUsed?'<span class="used-tag">used</span>':''}
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
    renderTower();
  });
}

// ---- SVG: tyre circle with diminishing wipe ----
function tyreSvg(compound, lifePct){
  // Colour of the wipe: compound colour at high life, amber mid, red low
  let fillColor;
  if(lifePct > 55) fillColor = compoundColor(compound);
  else if(lifePct > 25) fillColor = '#E8A93A';
  else fillColor = '#C4453D';

  // Pie slice path: 100% = full circle, 0% = nothing
  const size = 22;
  const cx = size/2, cy = size/2, r = 8;
  const pct = clamp(lifePct, 0, 100) / 100;
  const angle = pct * Math.PI * 2;

  let path = '';
  if(pct >= 0.999){
    // Full circle
    path = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillColor}"/>`;
  } else if(pct <= 0.001){
    path = '';
  } else {
    // Pie from 12 o'clock, clockwise
    const startAngle = -Math.PI/2;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    path = `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${fillColor}"/>`;
  }

  // Text colour: contrast against fill
  const textColor = (lifePct > 25) ? '#0B0D10' : '#EDEAE2';

  return `<span class="tyre-svg-wrap">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0a0d14" stroke="#2A2F38" stroke-width="1.5"/>
      ${path}
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="JetBrains Mono, monospace"
        font-size="10" font-weight="700" fill="${textColor}">${compound}</text>
    </svg>
  </span>`;
}
function compoundColor(c){
  return { S:'#ef4444', M:'#fbbf24', H:'#e5e7eb', I:'#22c55e', W:'#3b82f6' }[c] || '#e5e7eb';
}

// ---- SVG: car health triangle ----
function healthTriangleSvg(damage){
  // 0 = outline only, 8 = fully red
  const pct = clamp(damage / 8, 0, 1);
  const size = 22;
  const col = damage >= 6 ? 'var(--red)' : damage >= 4 ? 'var(--amber)' : 'var(--green)';
  const fillY = 19 - (17 * pct); // triangle spans y=2..19 (roughly)

  // Clip a rectangle over the triangle to fill from bottom up
  const clipId = 'hc_'+Math.random().toString(36).slice(2,8);
  return `<span class="health-triangle">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <clipPath id="${clipId}">
          <polygon points="11,2 20,20 2,20"/>
        </clipPath>
      </defs>
      <polygon points="11,2 20,20 2,20" fill="#0a0d14" stroke="#2A2F38" stroke-width="1.5"/>
      ${pct > 0 ? `<rect x="0" y="${fillY}" width="${size}" height="${size}" fill="${col}" clip-path="url(#${clipId})"/>` : ''}
      <polygon points="11,2 20,20 2,20" fill="none" stroke="#2A2F38" stroke-width="1.5"/>
    </svg>
  </span>`;
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
    else if(d.damage>2) cls += ' damaged';
    if(d.penaltyFlashUntilLap > RACE.lap) cls += ' penalty';
    if(d.pitFlashUntilLap > RACE.lap) cls += ' pitted';
    row.className = cls;

    const crown = (RACE.fastestLapHolder===d.abbr) ? ' <span class="crown">♛</span>' : '';
    const gapText = d.retired
      ? (d.retiredReason==='crash'?'DNF-CR':'DNF-MEC')
      : (d.position===1 ? 'LEADER' : '+'+d.interval.toFixed(1)+'s');
    const life = d.retired ? 0 : Math.round(tyreLifePercent(d));
    const isMine = d.teamId===STATE.myTeamId;

    const inPit = d._pitTimer > 0 ? '<span class="in-pit-indicator">◉</span>' : '';

    let actionHtml = '';
    if(isMine){
      const pitBtnClass = d._armedPit ? 'pit-btn-armed' : 'pit-btn-idle';
      const pitBtnLabel = d._armedPit ? 'BOX' : 'PIT';
      actionHtml = `
        <button class="radio-btn" data-radio-abbr="${d.abbr}" title="Radio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        </button>
        <button class="pit-btn ${pitBtnClass}" data-pit-abbr="${d.abbr}">${pitBtnLabel}</button>
      `;
    }

    row.innerHTML = `
      <span class="tt-pos">${d.position}</span>
      <span class="tt-driver"><span class="tt-team-pill" style="background:${team.color}"></span><span class="tt-driver-abbr">${d.abbr}</span>${crown}</span>
      <span class="tt-gap">${gapText}</span>
      <span class="tt-action">${actionHtml}</span>
      <span class="tt-bars">
        ${d.retired ? '' : tyreSvg(d.tyre, life)}
        ${d.retired ? '' : healthTriangleSvg(d.damage)}
      </span>
      <span class="tt-pitcol">${inPit}</span>
      <span class="tt-pits">${d.pitStops}</span>
    `;
    row.addEventListener('click', (e)=>{
      if(e.target.closest('.pit-btn') || e.target.closest('.radio-btn')) return;
      openDriverDetail(d);
    });
    body.appendChild(row);
  });

  document.querySelectorAll('.pit-btn').forEach(b=>b.addEventListener('click', (e)=>{
    e.stopPropagation();
    const drv = RACE.drivers.find(x=>x.abbr===b.dataset.pitAbbr);
    openPitMenu(drv);
  }));
  document.querySelectorAll('.radio-btn').forEach(b=>b.addEventListener('click', (e)=>{
    e.stopPropagation();
    const abbr = b.dataset.radioAbbr;
    const panel = document.getElementById('radioPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    document.getElementById('radioDriver').value = abbr;
  }));
}

function openDriverDetail(d){
  const team = teamById(d.teamId);
  const comp = COMPOUNDS[d.tyre];
  const life = Math.round(tyreLifePercent(d));
  const health = Math.round(carHealthPercent(d));
  const gapAhead = d.position>1 ? (()=>{
    const ahead = RACE.drivers.find(x=>x.position === d.position-1);
    return ahead && !ahead.retired ? (d.totalTime - ahead.totalTime) : 0;
  })() : 0;
  const behind = RACE.drivers.find(x=>x.position === d.position+1);
  const gapBehind = behind && !behind.retired ? (behind.totalTime - d.totalTime) : 0;
  const pitHistory = d.pitHistory.length ? d.pitHistory.map(p=>`L${p.lap} → ${p.tyre}${p.repair?` 🔧${p.repair}`:''}`).join('<br>') : 'No stops yet';

  const fieldBest = [0,1,2].map(i=> Math.min(...RACE.drivers.filter(x=>!x.retired).map(x=>x.bestSector[i]||999)));
  const sectorColour = (i)=>{
    const v = d.bestSector[i];
    if(!v) return 'var(--dim)';
    if(v <= fieldBest[i] + 0.001) return 'var(--purple)';
    if(v <= fieldBest[i] + 0.4) return 'var(--green)';
    return 'var(--amber)';
  };

  openModal(`
    <div class="driver-detail">
      <div class="dd-header">
        <div>
          <div class="dd-name">${d.name}</div>
          <div class="dd-team">${team.name} · ${d.abbr}</div>
        </div>
        <div class="dd-headset" id="ddHeadset" title="Radio this driver">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
        </div>
      </div>

      <div class="dd-grid">
        <div class="dd-cell"><div class="l">Position</div><div class="v">P${d.position}</div></div>
        <div class="dd-cell"><div class="l">Gap to leader</div><div class="v">${d.position===1?'—':'+'+d.gapToLeader.toFixed(1)+'s'}</div></div>
        <div class="dd-cell"><div class="l">Ahead</div><div class="v">${d.position>1?'+'+gapAhead.toFixed(1)+'s':'—'}</div></div>
        <div class="dd-cell"><div class="l">Behind</div><div class="v">${behind?'-'+gapBehind.toFixed(1)+'s':'—'}</div></div>
        <div class="dd-cell"><div class="l">Tyre</div><div class="v">${comp.name} · ${d.tyreAge}L · ${life}%</div></div>
        <div class="dd-cell"><div class="l">Fuel</div><div class="v">${Math.round(d.fuel)}%</div></div>
        <div class="dd-cell"><div class="l">Car health</div><div class="v">${health}%</div></div>
        <div class="dd-cell"><div class="l">Pit stops</div><div class="v">${d.pitStops}</div></div>
      </div>

      <div>
        <div style="font-size:11px;color:var(--dim);margin-bottom:4px">Sector bests</div>
        <div class="dd-grid">
          <div class="dd-cell"><div class="l">S1</div><div class="v" style="color:${sectorColour(0)}">${d.bestSector[0]?d.bestSector[0].toFixed(2):'—'}</div></div>
          <div class="dd-cell"><div class="l">S2</div><div class="v" style="color:${sectorColour(1)}">${d.bestSector[1]?d.bestSector[1].toFixed(2):'—'}</div></div>
          <div class="dd-cell"><div class="l">S3</div><div class="v" style="color:${sectorColour(2)}">${d.bestSector[2]?d.bestSector[2].toFixed(2):'—'}</div></div>
        </div>
      </div>

      <div>
        <div style="font-size:11px;color:var(--dim);margin-bottom:4px">ERS mode</div>
        <div class="tyre-select">
          ${Object.entries(ERS_MODES).map(([k,v])=>`
            <button class="tyre-btn ers-btn" data-abbr="${d.abbr}" data-mode="${k}" style="${d.ers===k?'border-color:var(--cyan)':''}">${v.label}</button>
          `).join('')}
        </div>
      </div>

      <div>
        <div style="font-size:11px;color:var(--dim);margin-bottom:4px">Pit history</div>
        <div style="font-size:11.5px;color:var(--dim);line-height:1.6">${pitHistory}</div>
      </div>

      <div class="modal-actions"><button class="btn btn-ghost btn-sm" id="ddClose">Close</button></div>
    </div>
  `);
  document.getElementById('ddClose').addEventListener('click', closeModal);
  document.getElementById('ddHeadset').addEventListener('click', ()=>{
    closeModal();
    const panel = document.getElementById('radioPanel');
    panel.style.display = 'block';
    document.getElementById('radioDriver').value = d.abbr;
  });
  document.querySelectorAll('.ers-btn').forEach(b=>b.addEventListener('click', ()=>{
    const drv = RACE.drivers.find(x=>x.abbr===b.dataset.abbr);
    if(drv) drv.ers = b.dataset.mode;
    closeModal();
  }));
}

// ---- Track view: S-shape, both lines used, live position ----
function drawTrackView(){
  const canvas = document.getElementById('trackCanvas');
  if(!canvas || !RACE) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pad = 28;
  const usableH = h - pad * 2;
  // 3 sectors, each with 2 lines + a small gap = 6 visual rows + pit box row
  const rowH = usableH / 7.4;
  const barW = w - pad * 2;

  // Y coordinates for each sector's top and bottom line
  const sectorsY = {
    3: { top: pad,              bot: pad + rowH * 0.65 },           // Sector 3 (top of screen)
    2: { top: pad + rowH * 2.2, bot: pad + rowH * 2.85 },           // Sector 2 (middle)
    1: { top: pad + rowH * 4.4, bot: pad + rowH * 5.05 },           // Sector 1 (bottom of screen)
  };
  const pitY = pad + rowH * 6.5;

  const sectorColors = { green:'#2f7a4a', yellow:'#c9922a', red:'#a13b34' };

  const drawSectorBand = (num)=>{
    const { top: topY, bot: botY } = sectorsY[num];
    const flag = RACE.sectors[num-1] || 'green';
    const color = sectorColors[flag] || sectorColors.green;

    // Top line
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pad, topY);
    ctx.lineTo(pad + barW, topY);
    ctx.stroke();

    // Arrow L→R on top line
    drawArrow(ctx, pad + barW/2, topY - 10, 'right', color);

    // Bottom line
    ctx.beginPath();
    ctx.moveTo(pad, botY);
    ctx.lineTo(pad + barW, botY);
    ctx.stroke();

    // Arrow R→L on bottom line
    drawArrow(ctx, pad + barW/2, botY + 14, 'left', color);

    // Sector label
    ctx.fillStyle = '#8B92A0';
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    ctx.fillText(`SECTOR ${num}`, pad, topY - 12);

    // Flag label right
    ctx.fillStyle = color;
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    const label = flag.toUpperCase();
    const labelW = ctx.measureText(label).width;
    ctx.fillText(label, pad + barW - labelW, topY - 12);
  };

  drawSectorBand(3);
  drawSectorBand(2);
  drawSectorBand(1);

  // S/F marker (right end of Sector 1)
  const sfX = pad + barW;
  const sfY = sectorsY[1].bot;
  ctx.fillStyle = '#EDEAE2';
  ctx.beginPath(); ctx.arc(sfX, sfY, 5, 0, Math.PI*2); ctx.fill();
  ctx.font = 'bold 10px JetBrains Mono, monospace';
  ctx.fillStyle = '#EDEAE2';
  ctx.fillText('S/F', sfX - 26, sfY + 4);

  // Pit box row
  ctx.strokeStyle = '#2A2F38';
  ctx.lineWidth = 1;
  ctx.setLineDash([4,4]);
  ctx.beginPath();
  ctx.moveTo(pad, pitY);
  ctx.lineTo(pad + barW, pitY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#565D6A';
  ctx.font = 'bold 10px JetBrains Mono, monospace';
  ctx.fillText('PIT BOX', pad, pitY - 6);

  // Sort active by position
  const active = RACE.drivers.filter(d=>!d.retired);
  if(active.length === 0) return;

  const leader = active.reduce((a,b)=> a.totalTime < b.totalTime ? a : b);

  // Draw each car
  active.forEach(d=>{
    // Pitting cars go in pit box
    if(d._pitTimer > 0){
      const pitting = RACE.drivers.filter(x=>x._pitTimer>0);
      const idx = pitting.indexOf(d);
      const px = pad + 30 + idx * 90;
      const py = pitY + 22;
      ctx.fillStyle = teamById(d.teamId).color;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#EDEAE2';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.fillText(`${d.abbr} · ${d.tyre}`, px + 14, py + 4);
      return;
    }

    // Race fraction from gapToLeader (fresh every frame)
    const gap = d.totalTime - leader.totalTime;
    const frac = ((gap / LAP_TIME_APPROX) % 1 + 1) % 1;

    // Which sector (1, 2, or 3)
    let sectorNum, intra;
    if(frac < 1/3){
      sectorNum = 1;
      intra = frac / (1/3);
    } else if(frac < 2/3){
      sectorNum = 2;
      intra = (frac - 1/3) / (1/3);
    } else {
      sectorNum = 3;
      intra = (frac - 2/3) / (1/3);
    }

    const band = sectorsY[sectorNum];
    // First half of sector: top line L→R
    // Second half of sector: bottom line R→L
    let x, y;
    if(intra < 0.5){
      x = pad + (intra / 0.5) * barW;
      y = band.top;
    } else {
      x = pad + barW - ((intra - 0.5) / 0.5) * barW;
      y = band.bot;
    }

    const isMine = d.teamId === STATE.myTeamId;

    // Car dot
    ctx.beginPath();
    ctx.arc(x, y, isMine ? 9 : 7, 0, Math.PI*2);
    ctx.fillStyle = teamById(d.teamId).color;
    ctx.fill();
    if(isMine){ ctx.strokeStyle='#fff'; ctx.lineWidth = 1.6; ctx.stroke(); }

    // Tyre ring around the car
    ctx.beginPath();
    ctx.arc(x, y, isMine ? 13 : 11, 0, Math.PI*2);
    ctx.strokeStyle = compoundColor(d.tyre);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#EDEAE2';
    ctx.font = 'bold 13px JetBrains Mono, monospace';
    ctx.fillText(d.abbr, x + (isMine ? 16 : 14), y + 4);

    // Armed indicator (green triangle above)
    if(d._armedPit){
      ctx.fillStyle = '#5FB878';
      ctx.beginPath();
      ctx.moveTo(x, y - 22);
      ctx.lineTo(x + 6, y - 16);
      ctx.lineTo(x - 6, y - 16);
      ctx.closePath();
      ctx.fill();
    }

    // Damage marker
    if(d.damage >= 5){
      ctx.fillStyle = '#C4453D';
      ctx.beginPath();
      ctx.arc(x - 14, y - 12, 4, 0, Math.PI*2);
      ctx.fill();
    }
  });

  // Header
  ctx.fillStyle = '#565D6A';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(`${RACE.track.name} — Lap ${RACE.lap}/${RACE.laps}`, pad, h - 8);
}

function drawArrow(ctx, x, y, dir, color){
  ctx.fillStyle = color;
  ctx.beginPath();
  if(dir === 'right'){
    ctx.moveTo(x + 7, y);
    ctx.lineTo(x - 5, y - 6);
    ctx.lineTo(x - 5, y + 6);
  } else {
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 5, y - 6);
    ctx.lineTo(x + 5, y + 6);
  }
  ctx.closePath();
  ctx.fill();
}

// ---- Finish ----
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

  // Two-compound rule check
  RACE.drivers.forEach(d=>{
    if(d.retired) return;
    const usedDry = ['S','M','H'].filter(c=>d.usedCompounds.has(c));
    if(usedDry.length < 2){
      d.dsq = true;
      d.dsqReason = 'Only 1 dry compound used';
      pushMsg('rc', 'RC:', `${d.abbr} DISQUALIFIED — must use 2 different dry compounds.`);
    }
  });

  const classified = RACE.drivers.filter(d=>!d.retired && !d.dsq);
  const dnfs = RACE.drivers.filter(d=>d.retired);
  const dsqs = RACE.drivers.filter(d=>d.dsq);
  const results = [...classified, ...dnfs, ...dsqs];

  let myPrize = 0;
  const myResults = [];
  results.forEach((d,i)=>{
    const pts = i<POINTS_TABLE.length && !d.retired && !d.dsq ? POINTS_TABLE[i] : 0;
    STATE.driversPoints[d.abbr] = (STATE.driversPoints[d.abbr]||0) + pts;
    STATE.constructorsPoints[d.teamId] = (STATE.constructorsPoints[d.teamId]||0) + pts;
    if(!STATE.form[d.abbr]) STATE.form[d.abbr] = { pointsThisSeason:0, raceWins:0, qualiWins:0 };
    STATE.form[d.abbr].pointsThisSeason = (STATE.form[d.abbr].pointsThisSeason||0) + pts;
    if(d.teamId===STATE.myTeamId){
      myPrize += PRIZE_BY_POS[i] || PRIZE_BY_POS[PRIZE_BY_POS.length-1];
      myResults.push({abbr:d.abbr, name:d.name, pos:i+1, retired:d.retired, dsq:d.dsq});
    }
  });

  const t = myTeam();
  const [d1, d2] = t.drivers;
  const p1 = RACE.drivers.find(x=>x.abbr===d1.abbr);
  const p2 = RACE.drivers.find(x=>x.abbr===d2.abbr);
  if(p1 && p2 && !p1.retired && !p2.retired && !p1.dsq && !p2.dsq){
    const w = p1.position < p2.position ? d1 : d2;
    if(!STATE.form[w.abbr]) STATE.form[w.abbr] = { pointsThisSeason:0, raceWins:0, qualiWins:0 };
    STATE.form[w.abbr].raceWins = (STATE.form[w.abbr].raceWins||0)+1;
  }

  if(RACE.fastestLapHolder){
    const fl = RACE.drivers.find(d=>d.abbr===RACE.fastestLapHolder);
    if(fl && !fl.retired && !fl.dsq && fl.position <= 10){
      STATE.driversPoints[fl.abbr] = (STATE.driversPoints[fl.abbr]||0) + 1;
      STATE.constructorsPoints[fl.teamId] = (STATE.constructorsPoints[fl.teamId]||0) + 1;
    }
  }

  STATE.raceLog.push({
    season: STATE.season,
    round: STATE.round+1,
    track: RACE.track.id,
    results: results.map((d,i)=>({abbr:d.abbr, pos:i+1, retired:d.retired, dsq:d.dsq})),
  });

  const bestPos = myResults.filter(r=>!r.retired && !r.dsq).sort((a,b)=>a.pos-b.pos)[0]?.pos || 20;
  const expected = { title:3, contender:6, midfield:9, backmarker:12 }[myTeam().tier];
  const delta = clamp((expected - bestPos) * 1.2, -12, 14);
  STATE.boardConf = clamp(STATE.boardConf + delta, 0, 100);
  STATE.budget += myPrize;

  STATE.round++;
  applyPendingUpgrades();
  saveToSlot(activeSlot);

  if(STATE.boardConf <= 5 && STATE.round < TRACKS.length){ renderFiredModal(); return; }

  renderResultsModal(results, myResults, myPrize, delta);
}

function renderResultsModal(results, myResults, myPrize, delta){
  const rows = results.map((d,i)=>{
    const t = teamById(d.teamId);
    const statusText = d.retired ? (d.retiredReason==='crash'?'DNF (crash)':'DNF (mec)')
                      : d.dsq ? 'DSQ'
                      : `P${i+1}`;
    const pts = i<POINTS_TABLE.length && !d.retired && !d.dsq ? POINTS_TABLE[i] : 0;
    const crown = (RACE.fastestLapHolder===d.abbr) ? ' ♛' : '';
    return `<div class="side-row" style="border-bottom:1px solid var(--line);padding:7px 0;">
      <span><span class="team-pill" style="background:${t.color}"></span>${d.abbr}${crown} ${t.id===STATE.myTeamId?'←':''}</span>
      <b>${statusText}${pts?` (+${pts})`:''}</b>
    </div>`;
  }).join('');
  const deltaText = delta>0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
  const deltaColor = delta>0?'var(--green)':delta<0?'var(--red)':'var(--dim)';
  const biggestMover = RACE.drivers.filter(d=>!d.retired && !d.dsq).slice().sort((a,b)=>(a.startPosition-a.position)-(b.startPosition-b.position)).pop();
  const yourBest = myResults.filter(r=>!r.retired && !r.dsq).sort((a,b)=>a.pos-b.pos)[0];

  openModal(`
    <h2>Race Result — ${RACE.track.name}</h2>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px">
      <span class="team-stat-mini">PRIZE <b style="color:var(--amber)">$${myPrize.toFixed(1)}M</b></span>
      <span class="team-stat-mini">BOARD <b style="color:${deltaColor}">${deltaText}%</b></span>
      <span class="team-stat-mini">CONFIDENCE <b>${Math.round(STATE.boardConf)}%</b></span>
    </div>
    <div style="background:var(--panel2);padding:10px;border-radius:3px;margin-bottom:12px;font-size:12px;line-height:1.7">
      <div><b>Fastest lap:</b> ${RACE.fastestLapHolder || '—'}</div>
      <div><b>Biggest mover:</b> ${biggestMover ? biggestMover.abbr + ' (' + (biggestMover.startPosition - biggestMover.position) + ' places)' : '—'}</div>
      <div><b>Your best:</b> ${yourBest ? yourBest.name + ' (P' + yourBest.pos + ')' : 'No finishers'}</div>
    </div>
    <div style="max-height:340px;overflow-y:auto;margin:8px 0">${rows}</div>
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
