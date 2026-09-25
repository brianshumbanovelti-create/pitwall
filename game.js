// ===================== STATE =====================
const SAVE_PREFIX = 'pitwall_slot_';
const SAVE_SLOTS = 3;
const SAVE_VERSION = 5;
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
    settings: { sound: true },
    marketOffers: [],
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
    if(!s.marketOffers) s.marketOffers = [];
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
    <p style="font-size:11.5px">Upgrades take 2 races to arrive.</p>
    ${STATE.pendingUpgrades.map(u=>`<div class="save-slot"><div><div style="font-weight:700">${labels[u.slot]} +2</div><div class="meta">Arrives in ${u.arrivesInRace - STATE.round} races</div></div></div>`).join('')}
    ${slots.map(s=>{
      const lvl = STATE.upgrades[s];
      const c = cost(lvl);
      const canDo = STATE.budget >= c && STATE.capUsed + c <= COST_CAP;
      const reason = STATE.capUsed + c > COST_CAP ? 'Cost cap hit' : (STATE.budget < c ? 'No budget' : '');
      return `<div class="save-slot">
        <div>
          <div style="font-weight:700">${labels[s]}</div>
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
let RACE = null;
let raceInterval = null;
let raceSpeed = 1;
let racePaused = false;

// --- Pace tuning ---
// Lower PACE_SCALE means tighter field. 0.20 → fastest vs slowest ~0.5-0.7s/lap.
const PACE_SCALE = 0.20;
const BASE_LAP   = 90;    // reference lap time in seconds (compressed)
const TYRE_LIFE  = 100;   // percent

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
    d.nextPitLap = d.pitPlan==='2-stop' ? Math.round(track.laps*randf(0.28,0.36)) : Math.round(track.laps*randf(0.42,0.58));
  });
  showScreen('screen-race');
  initRaceUI(track);
  renderTower();
  raceSpeed = 1; racePaused = false;
  setSpeedButtons();
  runRaceLoop();
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
    retired:false, retiredReason:null, retiredLap:null,
    damage:0, penaltyLapsLeft:0, penaltyApplied: false,
    distanceCovered: 0,
    fuel: 100,
    ers: 'balanced',
    radioEffect: null,
    bestSector: [0,0,0],
    lastSectors: [0,0,0],
    fastestLap: null,
    lapTimes: [],
    pitFlashUntilLap: 0,
    penaltyFlashUntilLap: 0,
    _pitTimer: 0,
    _pendingTyre: null,
    _pitRequested: false,
    _requestedTyre: null,
    _justPitted: false,
    _puncture: false,
    _lastPitGap: null,
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
    drivers, finished:false, feed:[],
    myTeamId: STATE.myTeamId,
    _lastWetBand: undefined,
    fastestLapHolder: null,
    fastestLapTime: null,
    _scGapSnapshot: null,
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
  updateWeatherChip();
  setFlagUI();
  document.getElementById('feedScroll').innerHTML = '';
  document.getElementById('msgScroll').innerHTML = '';
  pushFeed(0, `Lights out at ${track.name}.`, 'good');
  pushMsg('system', 'Pit Wall', `Radio link open. Commands active all race.`);
  const sel = document.getElementById('radioDriver');
  sel.innerHTML = myTeam().drivers.map(d=>`<option value="${d.abbr}">${d.name} (${d.abbr})</option>`).join('');
  const wrap = document.getElementById('radioButtons');
  wrap.innerHTML = RADIO_COMMANDS.map(c=>`<button class="btn btn-ghost btn-sm" data-radio="${c.key}">${c.label}</button>`).join('');
  wrap.querySelectorAll('[data-radio]').forEach(b=>b.addEventListener('click', ()=>sendRadio(b.dataset.radio)));
  renderSectorLegend();
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
    o.frequency.value = f;
    g.gain.value = 0.04;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    o.stop(audioCtx.currentTime + 0.25);
  }catch(e){}
}

document.getElementById('tabTower').addEventListener('click', ()=>setRaceTab('tower'));
document.getElementById('tabTrack').addEventListener('click', ()=>setRaceTab('track'));
document.getElementById('tabMessages').addEventListener('click', ()=>setRaceTab('messages'));
function setRaceTab(t){
  ['Tower','Track','Messages'].forEach(x=>{
    document.getElementById('tab'+x).classList.toggle('active', x.toLowerCase()===t);
  });
  document.getElementById('towerWrap').style.display = t==='tower'?'block':'none';
  document.getElementById('trackWrap').style.display = t==='track'?'flex':'none';
  document.getElementById('messagesWrap').style.display = t==='messages'?'flex':'none';
  if(t==='track') drawTrackView();
  if(t==='messages') document.getElementById('msgBadge').style.display='none';
}

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
document.getElementById('speedSkip').addEventListener('click', ()=>{
  if(!RACE || RACE.finished) return;
  racePaused = true;
  const safety = RACE.laps * 3;
  let guard = 0;
  while(!RACE.finished && guard++ < safety) simulateLap(true);
  renderTower();
  if(RACE.finished){
    if(raceInterval) clearInterval(raceInterval);
    setTimeout(showRaceResults, 500);
  }
});

function runRaceLoop(){
  if(raceInterval) clearInterval(raceInterval);
  const totalMs = 5*60*1000;
  const baseTickMs = totalMs/RACE.track.laps;
  raceInterval = setInterval(()=>{
    if(racePaused || RACE.redFlagModalPending) return;
    for(let i=0;i<raceSpeed;i++){
      if(RACE.finished) break;
      simulateLap(false);
    }
    renderTower();
    if(document.getElementById('trackWrap').style.display!=='none') drawTrackView();
    if(RACE.finished){
      clearInterval(raceInterval);
      setTimeout(showRaceResults, 800);
    }
  }, baseTickMs);
}

// ===================== LAP SIM =====================
function simulateLap(silent){
  if(RACE.redFlagActive || RACE.finished) return;

  // Fire any player-requested pit stops that are due to start this lap
  RACE.drivers.forEach(d=>{
    if(d._pitRequested && d._pitTimer===0){
      d._pitRequested = false;
      beginPitStop(d, d._requestedTyre);
      d._requestedTyre = null;
    }
  });

  // Advance pit timers
  RACE.drivers.forEach(d=>{
    if(d._pitTimer > 0){
      d._pitTimer--;
      if(d._pitTimer===0){
        d.tyre = d._pendingTyre || 'M';
        d._pendingTyre = null;
        d.tyreAge = 0;
        d._justPitted = true;
        d.pitFlashUntilLap = RACE.lap + 2;
        pushFeed(RACE.lap, `<b>${d.abbr}</b> rejoins on ${COMPOUNDS[d.tyre].name}.`, 'pit');
      }
    }
  });

  RACE.lap++;
  const track = RACE.track;
  const wet = RACE.wetness[Math.min(RACE.lap-1, RACE.wetness.length-1)] || 0;
  if(!silent){
    document.getElementById('lapNow').textContent = RACE.lap;
    updateWeatherChip();
  }

  // Sector decay
  for(let s=0;s<3;s++){
    if(RACE.sectorYellowUntil[s] && RACE.lap >= RACE.sectorYellowUntil[s]){
      if(RACE.sectors[s] === 'yellow') RACE.sectors[s] = 'green';
      RACE.sectorYellowUntil[s] = 0;
    }
  }

  // SC / VSC countdown
  if(RACE.scLapsRemaining > 0){
    RACE.scLapsRemaining--;
    if(RACE.scLapsRemaining===0){
      pushFeed(RACE.lap, `Green flag. Racing resumes.`, 'good');
      // Gaps were snapshotted on SC deploy — SC wipe already applied at deploy.
    }
  }
  if(RACE.vscLapsRemaining > 0){
    RACE.vscLapsRemaining--;
    if(RACE.vscLapsRemaining===0) pushFeed(RACE.lap, `Green flag. Racing resumes.`, 'good');
  }
  setFlagUI();
  announceWeatherShift(wet);

  const active = RACE.drivers.filter(d=>!d.retired);

  // Compute lap times
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
    d.lastLapTime = lapTime;
    d.lapTimes.push(lapTime);
    d.fuel = Math.max(0, d.fuel - 1.6);

    // Tyre wear — compounds wear based on age + push level + track temp
    applyTyreWear(d, track);

    // Car health — high push wears car
    applyCarWear(d);

    // Radio effect expiry
    if(d.radioEffect && RACE.lap >= d.radioEffect.untilLap) d.radioEffect = null;
    if(d.penaltyFlashUntilLap && RACE.lap > d.penaltyFlashUntilLap) d.penaltyFlashUntilLap = 0;
  });

  // Puncture check (below 10% life)
  active.forEach(d=>{
    const life = tyreLifePercent(d);
    if(life <= 10 && !d._puncture && !d.retired){
      if(Math.random() < 0.06){ // ~6% per lap below 10%
        d._puncture = true;
        pushFeed(RACE.lap, `⚠ <b>${d.abbr}</b> PUNCTURE!`, 'danger');
        if(d.teamId===STATE.myTeamId) flashBanner('Puncture!','red');
        // Big time loss
        d.totalTime += 28 + randf(-3,5);
        // Forced pit
        if(d._pitTimer===0){
          const newTyre = pick(['M','H']);
          beginPitStop(d, newTyre, true);
        }
        // Small chance of suspension DNF
        if(Math.random() < 0.08){
          retireDriver(d, 'crash');
        }
      }
    }
  });

  // Fastest lap
  const fastest = active.slice().sort((a,b)=>a.lastLapTime-b.lastLapTime)[0];
  if(fastest && (!RACE.fastestLapTime || fastest.lastLapTime < RACE.fastestLapTime)){
    RACE.fastestLapTime = fastest.lastLapTime;
    RACE.fastestLapHolder = fastest.abbr;
    pushFeed(RACE.lap, `⏱ <b>${fastest.abbr}</b> sets the fastest lap.`, 'good');
  }

  checkIncidents(active);

  // Re-order
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

  if(RACE.lap >= RACE.laps) finishRace();
}

function tyreLifePercent(d){
  const comp = COMPOUNDS[d.tyre];
  // Effective deg rate per lap (base * modifiers applied in applyTyreWear)
  const baseDeg = comp.degRate * 3; // ~7-8 laps per soft, 15+ on hard
  const life = Math.max(0, 100 - (d.tyreAge * baseDeg));
  return life;
}

function applyTyreWear(d, track){
  const comp = COMPOUNDS[d.tyre];
  const ers = ERS_MODES[d.ers] || ERS_MODES.balanced;
  let mult = 1;
  // Attacking wears more
  if(d.ers === 'attack') mult *= 1.35;
  if(d.ers === 'save')   mult *= 0.75;
  // Radio effect
  if(d.radioEffect && d.radioEffect.degMult) mult *= d.radioEffect.degMult;
  // Track temp effect
  if(track.trackTempC > 40) mult *= 1.15;
  if(track.trackTempC < 15) mult *= 1.10; // cold can also wear
  // Base deg already baked into life calc; here we optionally consume extra
  // We track a separate internal wear that affects lap time — d.tyreAge covers time, this is fine
  d._tyreWearMult = mult;
}

function applyCarWear(d){
  let wear = 0.05; // baseline
  if(d.ers === 'attack') wear += 0.35;
  if(d.ers === 'save')   wear -= 0.02;
  if(d.radioEffect && d.radioEffect.paceBonus > 0) wear += 0.25;
  if(d.radioEffect && d.radioEffect.paceBonus < 0) wear -= 0.05;
  // Random mechanic niggles
  d.damage = clamp(d.damage + wear * 0.08, 0, 8);
}

function computeSectors(d, track, wet){
  const team = teamById(d.teamId);
  const effPace = team.pace + (team.id===STATE.myTeamId?STATE.carPaceBoost:0) + (team.id===STATE.myTeamId?(STATE.upgrades.aero+STATE.upgrades.pu)*2:0);
  const comp = COMPOUNDS[d.tyre];
  const life = tyreLifePercent(d);

  // Base lap: PACE_SCALE compresses the field. Top car ~0.5-0.7s faster than bottom.
  const paceDelta = (100 - effPace) * PACE_SCALE * 0.28; // seconds penalty vs the field
  const skillDelta = (100 - d.skill) * PACE_SCALE * 0.22;
  let base = BASE_LAP + paceDelta + skillDelta;

  // Tyre age penalty — worse as life drops
  const ageLoss = Math.pow(1 - life/100, 1.8) * 3.5;

  // Compound offset (soft faster, hard slower)
  const compoundOffset = (100 - comp.gripBase) * 0.06;

  // Temp window
  let tempPenalty = 0;
  if(track.trackTempC < comp.tempMin) tempPenalty = (comp.tempMin-track.trackTempC)*0.04;
  else if(track.trackTempC > comp.tempMax) tempPenalty = (track.trackTempC-comp.tempMax)*0.03;
  if(track.trackTempC < 18 && d.tyreAge < 3 && !comp.wet) tempPenalty += (3-d.tyreAge)*0.15;

  // Wet mismatch
  let wetPenalty = 0;
  if(wet > 0.15 && !comp.wet) wetPenalty = wet*3.2;
  else if(wet <= 0.1 && comp.wet) wetPenalty = 1.4;
  else if(comp.wet && wet>0.15){
    if(d.tyre==='I' && wet>0.6) wetPenalty = (wet-0.6)*2.0;
    if(d.tyre==='W' && wet<0.35) wetPenalty = (0.35-wet)*2.5;
  }

  // Fuel
  const fuelPenalty = (d.fuel - 50) * 0.01;

  // ERS
  const ers = ERS_MODES[d.ers] || ERS_MODES.balanced;
  const ersBonus = -ers.paceBonus * 20;

  // Radio effect
  let radioBonus = 0;
  if(d.radioEffect) radioBonus = -(d.radioEffect.paceBonus || 0) * 20;

  // Damage penalty
  const dmgPenalty = d.damage * 0.45;

  // Fresh tyre "new rubber" bonus — first 3 laps on a fresh set, real pace
  let freshBonus = 0;
  if(d.tyreAge <= 3) freshBonus = -(3 - d.tyreAge) * 0.35;

  // Sector splits (with yellow/red slowdowns)
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

  // Penalty
  if(d.penaltyApplied) d.penaltyApplied = false;
  if(d.penaltyLapsLeft > 0){ sectorList[0] += 5; d.penaltyLapsLeft--; }

  return sectorList;
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
        pushFeed(RACE.lap, `<b>${d.abbr}</b> picks up damage after contact.`, 'danger');
        if(d.teamId===STATE.myTeamId) flashBanner('Damage!','yellow');
        triggerSectorYellow();
        if(Math.random() < 0.3){
          const other = pick(active.filter(x=>x!==d && !x.retired));
          if(other){
            other.penaltyLapsLeft = 1;
            other.penaltyFlashUntilLap = RACE.lap + 3;
            pushFeed(RACE.lap, `<b>${other.abbr}</b> given 5s penalty for causing a collision.`, 'danger');
          }
        }
      } else {
        retireDriver(d, 'crash');
        if(Math.random() < 0.4) startSafetyCar(); else startVSC();
        triggerSectorYellow();
      }
    }
    if(d._justPitted && Math.random() < 0.01){
      pushFeed(RACE.lap, `<b>${d.abbr}</b> — slow pit stop.`, 'danger');
      d.totalTime += 1; // occasionally +1s
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
  pushFeed(RACE.lap, `<b>${d.abbr}</b> ${label}!`, 'danger');
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
  pushFeed(RACE.lap, `Virtual Safety Car deployed.`, 'flag');
  flashBanner('Virtual Safety Car','yellow');
  setFlagUI();
}
function startSafetyCar(){
  if(RACE.redFlagActive) return;
  RACE.scLapsRemaining = rand(3,5);
  pushFeed(RACE.lap, `Safety Car deployed.`, 'flag');
  flashBanner('Safety Car','yellow');

  // SC wipes the gap: cars bunch up. Preserve order but compress time gaps.
  const active = RACE.drivers.filter(d=>!d.retired).sort((a,b)=>a.position-b.position);
  if(active.length){
    const leaderTime = active[0].totalTime;
    // Ensure each car is roughly 1.5s behind the one ahead
    let runningTime = leaderTime;
    active.forEach((d,i)=>{
      if(i===0){ d.totalTime = leaderTime; return; }
      runningTime = Math.max(runningTime + 1.5, d.totalTime * 0.5 + (runningTime+1.5)*0.5);
      // Actually compress hard: new gap = 1.5s per car position
      d.totalTime = leaderTime + i * 1.5;
    });
  }
  setFlagUI();
}
function startRedFlag(){
  if(RACE.redFlagActive) return;
  RACE.redFlagActive = true;
  RACE.redFlagModalPending = true;
  pushFeed(RACE.lap, `RED FLAG — session stopped.`, 'danger');
  flashBanner('Red Flag','red');
  setFlagUI();
  racePaused = true;
  setSpeedButtons();
  openRedFlagResumeModal();
}

function openRedFlagResumeModal(){
  const myDrivers = myTeam().drivers;
  openModal(`
    <h2 style="color:var(--red)">🔴 Red Flag</h2>
    <p>Race stopped. Choose tyres for the restart. Race resumes behind the Safety Car.</p>
    ${myDrivers.map(d=>`
      <div class="driver-strat" data-abbr="${d.abbr}">
        <div class="driver-strat-name">${d.name} <span class="dim" style="font-size:11px">(${d.abbr})</span></div>
        <div class="tyre-select">
          ${['S','M','H','I','W'].map(c=>`
            <button class="tyre-btn rf-tyre" data-abbr="${d.abbr}" data-tyre="${c}">
              <span class="tyre-dot ${c}"></span>${COMPOUNDS[c].name}
            </button>
          `).join('')}
        </div>
        <div style="font-size:11px;color:var(--dim);margin-top:6px" id="rfSel-${d.abbr}">Selected: M</div>
      </div>
    `).join('')}
    <div class="modal-actions">
      <button class="btn btn-primary" id="btnRedFlagResume">Restart race</button>
    </div>
  `);
  const sel = {};
  myDrivers.forEach(d=> sel[d.abbr] = 'M');
  document.querySelectorAll('.rf-tyre').forEach(b=>b.addEventListener('click', ()=>{
    sel[b.dataset.abbr] = b.dataset.tyre;
    document.getElementById('rfSel-'+b.dataset.abbr).textContent = 'Selected: '+b.dataset.tyre;
  }));
  document.getElementById('btnRedFlagResume').addEventListener('click', ()=>{
    RACE.drivers.forEach(d=>{
      if(sel[d.abbr]){
        d.tyre = sel[d.abbr];
        d.tyreAge = 0;
        d._puncture = false;
        d.pitStops++;
        d.pitHistory.push({lap:RACE.lap, tyre:d.tyre, reason:'redflag'});
      }
    });
    RACE.drivers.forEach(d=>{ d.damage = Math.max(0, d.damage - 2); });
    RACE.redFlagActive = false;
    RACE.redFlagModalPending = false;
    RACE.scLapsRemaining = 2;
    RACE.sectors = ['green','green','green'];
    racePaused = false;
    setSpeedButtons();
    closeModal();
    pushFeed(RACE.lap, `Race restarts behind the Safety Car.`, 'good');
    setFlagUI();
  });
}

// ---- Pit stops ----
function maybeAIPitStop(d, track, wet){
  if(d.teamId===STATE.myTeamId) return;
  if(RACE.lap < 3) return;
  if(d._pitTimer > 0) return;
  const comp = COMPOUNDS[d.tyre];
  const life = tyreLifePercent(d);
  const wantsWet = wet>0.35 && !comp.wet;
  const wantsSlickBack = wet<0.12 && comp.wet;
  const tyreWorn = life < 25; // box around 25% left
  const duePlanned = d.nextPitLap && RACE.lap >= d.nextPitLap && d.pitStops < (d.pitPlan==='2-stop'?2:1);
  if((track.laps-RACE.lap) < 3) return;
  if(wantsWet || wantsSlickBack || tyreWorn || duePlanned){
    const newTyre = wantsWet ? (wet>0.6?'W':'I') : (wantsSlickBack ? pick(['M','H']) : pick(['M','H']));
    beginPitStop(d, newTyre);
    if(d.pitPlan==='2-stop' && d.pitStops===1) d.nextPitLap = RACE.lap + Math.round(track.laps*randf(0.25,0.4));
    else d.nextPitLap = 99999;
  }
}

function beginPitStop(d, newTyre, forced){
  // Real pit loss: 18-24s including pitlane travel + stationary time
  // Cars "in the pit" for 2 sim laps where they are slow + carry the penalty
  const pitLoss = 18 + randf(0, 6);
  d._pitTimer = 2;
  d._pendingTyre = newTyre;
  d.pitStops++;
  d.pitHistory.push({lap:RACE.lap, tyre:newTyre, forced: !!forced});
  d.totalTime += pitLoss;
  // Occasional slow stop +1s
  if(Math.random() < 0.15){
    d.totalTime += 1.5;
    pushFeed(RACE.lap, `<b>${d.abbr}</b> — slow pit stop (+1.5s).`, 'pit');
  }
  pushFeed(RACE.lap, `<b>${d.abbr}</b> pits — fits ${COMPOUNDS[newTyre].name}. Pit loss ~${pitLoss.toFixed(1)}s.`, 'pit');
  if(d.teamId===STATE.myTeamId) flashBanner('Box box box','blue');
}

// ---- Player-initiated pit calls ----
// The player taps "Pit" on their own driver's timing row at any time, picks a
// tyre from the popover, and the stop is queued for the next lap. It stays
// cancelable right up until it actually begins (RACE.drivers[].tyreAge resets
// only once _pitTimer starts counting down in simulateLap).
function tyreChoicesForConditions(wet, currentTyre){
  if(wet > 0.3){
    const choices = [{code:'I', label:'Inters'}];
    if(wet > 0.6) choices.push({code:'W', label:'Wets'});
    return choices;
  }
  return [
    {code:'S', label:'Softs'},
    {code:'M', label:'Mediums'},
    {code:'H', label:'Hards'},
  ];
}
function requestPitStop(abbr, tyreCode){
  const d = RACE.drivers.find(x=>x.abbr===abbr);
  if(!d || d.retired || d.teamId!==STATE.myTeamId) return;
  if(d._pitTimer>0 || d._pitRequested) return;
  d._pitRequested = true;
  d._requestedTyre = tyreCode;
  pushFeed(RACE.lap, `<b>${d.abbr}</b> pit call queued — ${COMPOUNDS[tyreCode].name} on next lap.`, 'pit');
  renderTower();
}
function cancelPitStop(abbr){
  const d = RACE.drivers.find(x=>x.abbr===abbr);
  if(!d || !d._pitRequested) return;
  d._pitRequested = false;
  d._requestedTyre = null;
  pushFeed(RACE.lap, `<b>${d.abbr}</b> pit call cancelled — stays out.`, null);
  renderTower();
}

// ---- Radio ----
function sendRadio(key){
  const cmd = RADIO_COMMANDS.find(c=>c.key===key);
  if(!cmd || !RACE) return;
  const abbr = document.getElementById('radioDriver').value;
  const driver = RACE.drivers.find(d=>d.abbr===abbr);
  if(!driver || driver.retired) return;
  if(cmd.effect.boxNow){
    if(driver._pitTimer===0){
      const life = tyreLifePercent(driver);
      const newTyre = life > 60 ? 'H' : (life > 30 ? 'M' : 'S');
      beginPitStop(driver, newTyre);
    }
  } else {
    driver.radioEffect = {
      paceBonus: cmd.effect.paceBonus || 0,
      degMult: cmd.effect.degMult || 1,
      untilLap: RACE.lap + (cmd.effect.durationLaps || 3),
    };
    if(cmd.effect.teamOrder) driver.orders = cmd.effect.teamOrder;
  }
  pushMsg('you', 'You → '+driver.name, cmd.label);
  setTimeout(()=>pushMsg('driver', driver.name, cmd.reply), 500);
  beep('radio');
}

function pushMsg(kind, who, text){
  const scroll = document.getElementById('msgScroll');
  if(!scroll) return;
  const div = document.createElement('div');
  div.className = 'msg-bubble ' + (kind==='driver'?'driver':(kind==='you'?'you':''));
  div.innerHTML = `<div class="msg-head">${who}</div>${text}`;
  scroll.appendChild(div);
  scroll.scrollTop = scroll.scrollHeight;
  if(kind==='driver') document.getElementById('msgBadge').style.display='inline';
}

// ---- Rendering ----
function pushFeed(lap, html, kind){
  RACE.feed.push({lap, html, kind});
  const scroll = document.getElementById('feedScroll');
  const item = document.createElement('div');
  item.className = 'feed-item' + (kind ? ' '+kind : '');
  item.innerHTML = `<span class="feed-lap">L${lap}</span>${html}`;
  scroll.appendChild(item);
  if(scroll.children.length>150) scroll.removeChild(scroll.firstChild);
}

function tyreArcSvg(percent){
  // Small inline SVG tyre with coloured arc showing remaining life
  const r = 8;
  const circ = 2 * Math.PI * r;
  const arc = circ * clamp(percent,0,100) / 100;
  const col = percent > 55 ? 'var(--green)' : percent > 25 ? 'var(--amber)' : 'var(--red)';
  return `<svg width="22" height="22" viewBox="0 0 22 22" style="vertical-align:middle">
    <circle cx="11" cy="11" r="8" fill="#0a0d14" stroke="#2A2F38" stroke-width="1.5"/>
    <circle cx="11" cy="11" r="8" fill="none" stroke="${col}" stroke-width="2.5"
      stroke-dasharray="${arc} ${circ}" transform="rotate(-90 11 11)" stroke-linecap="round"/>
  </svg>`;
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
    const gapText = d.retired ? (d.retiredReason==='crash'?'DNF-CR':'DNF-MEC') :
      (d.position===1 ? 'LEADER' : '+'+d.interval.toFixed(1)+'s');
    const life = d.retired ? 0 : tyreLifePercent(d);
    const damageColor = d.damage>4 ? 'var(--red)' : d.damage>2 ? 'var(--amber)' : 'var(--dim)';
    const isMine = d.teamId===STATE.myTeamId;

    let pitCell = '';
    if(!d.retired){
      if(d._pitTimer>0){
        pitCell = `<span class="pit-indicator-active">◉ PIT</span>`;
      } else if(isMine && d._pitRequested){
        pitCell = `<button class="pit-btn requested" data-cancel-pit="${d.abbr}">Cancel</button>`;
      } else if(isMine){
        pitCell = `<button class="pit-btn" data-open-pit="${d.abbr}">Pit</button>`;
      }
    }

    row.innerHTML = `
      <span class="tt-pos">${d.position}</span>
      <span class="tt-driver"><span class="tt-team-pill" style="background:${team.color}"></span><span class="tt-driver-abbr">${d.abbr}</span>${crown}</span>
      <span class="tt-gap">${gapText}</span>
      <span class="tt-pitcol">${pitCell}</span>
      <span style="display:flex;align-items:center;gap:4px">
        <span class="tt-tyre tyre-${d.tyre}">${d.tyre}</span>
        ${tyreArcSvg(life)}
      </span>
      <span class="tt-tyreage" style="color:${damageColor}">${d.retired?'':d.tyreAge+'L · '+Math.round(life)+'%'}</span>
      <span class="tt-pits">${d.pitStops}</span>
      <span style="color:${damageColor};font-size:10px">H${Math.round(8-d.damage)}</span>
    `;

    row.addEventListener('click', (e)=>{
      if(e.target.closest('[data-open-pit]') || e.target.closest('[data-cancel-pit]') || e.target.closest('.pit-popover')) return;
      openDriverDetail(d);
    });

    const openBtn = row.querySelector('[data-open-pit]');
    if(openBtn) openBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      togglePitPopover(row, d);
    });
    const cancelBtn = row.querySelector('[data-cancel-pit]');
    if(cancelBtn) cancelBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      cancelPitStop(d.abbr);
    });

    body.appendChild(row);
  });
}

function togglePitPopover(row, d){
  const existing = row.querySelector('.pit-popover');
  if(existing){ existing.remove(); return; }
  document.querySelectorAll('.pit-popover').forEach(p=>p.remove());
  const wet = RACE ? (RACE.wetness[Math.min(RACE.lap, RACE.wetness.length-1)] || 0) : 0;
  const choices = tyreChoicesForConditions(wet, d.tyre);
  const pop = document.createElement('div');
  pop.className = 'pit-popover';
  pop.innerHTML = choices.map(c=>`<button data-choose-tyre="${c.code}">${c.label}</button>`).join('');
  pop.addEventListener('click', (e)=>{
    e.stopPropagation();
    const btn = e.target.closest('[data-choose-tyre]');
    if(!btn) return;
    requestPitStop(d.abbr, btn.getAttribute('data-choose-tyre'));
    pop.remove();
  });
  row.appendChild(pop);
}
document.addEventListener('click', ()=>{
  document.querySelectorAll('.pit-popover').forEach(p=>p.remove());
});

function openDriverDetail(d){
  const team = teamById(d.teamId);
  const comp = COMPOUNDS[d.tyre];
  const life = tyreLifePercent(d);
  const tyreColor = life > 55 ? 'var(--green)' : life > 25 ? 'var(--amber)' : 'var(--red)';
  const health = 8 - d.damage;
  const healthColor = health > 5 ? 'var(--green)' : health > 3 ? 'var(--amber)' : 'var(--red)';
  const gapAhead = d.position>1 ? (()=>{
    const ahead = RACE.drivers.find(x=>x.position === d.position-1);
    return ahead && !ahead.retired ? (d.totalTime - ahead.totalTime) : 0;
  })() : 0;
  const behind = RACE.drivers.find(x=>x.position === d.position+1);
  const gapBehind = behind && !behind.retired ? (behind.totalTime - d.totalTime) : 0;
  const pitHistory = d.pitHistory.length ? d.pitHistory.map(p=>`L${p.lap} → ${p.tyre}${p.forced?' (puncture)':''}`).join('<br>') : 'No stops yet';

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
        <div class="dd-cell"><div class="l">Tyre</div><div class="v">${comp.name} · ${d.tyreAge}L</div></div>
        <div class="dd-cell"><div class="l">Fuel</div><div class="v">${Math.round(d.fuel)}%</div></div>
        <div class="dd-cell"><div class="l">Car health</div><div class="v" style="color:${healthColor}">${health}/8</div></div>
        <div class="dd-cell"><div class="l">Pit stops</div><div class="v">${d.pitStops}</div></div>
      </div>

      <div>
        <div style="font-size:11px;color:var(--dim);margin-bottom:4px">Tyre life remaining</div>
        <div class="dd-bar"><div class="dd-bar-fill" style="width:${life}%;background:${tyreColor}"></div></div>
        <div style="font-size:11.5px;color:var(--dim);margin-top:3px">${Math.round(life)}% left</div>
      </div>

      <div>
        <div style="font-size:11px;color:var(--dim);margin-bottom:4px">Car health</div>
        <div class="dd-bar"><div class="dd-bar-fill" style="width:${(health/8)*100}%;background:${healthColor}"></div></div>
        <div style="font-size:11.5px;color:var(--dim);margin-top:3px">${health}/8</div>
      </div>

      <div>
        <div style="font-size:11px;color:var(--dim);margin-bottom:4px">Best sectors</div>
        <div class="dd-grid">
          <div class="dd-cell"><div class="l">S1</div><div class="v">${d.bestSector[0]?d.bestSector[0].toFixed(2):'—'}</div></div>
          <div class="dd-cell"><div class="l">S2</div><div class="v">${d.bestSector[1]?d.bestSector[1].toFixed(2):'—'}</div></div>
          <div class="dd-cell"><div class="l">S3</div><div class="v">${d.bestSector[2]?d.bestSector[2].toFixed(2):'—'}</div></div>
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

      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" id="ddClose">Close</button>
      </div>
    </div>
  `);

  document.getElementById('ddClose').addEventListener('click', closeModal);
  document.getElementById('ddHeadset').addEventListener('click', ()=>{
    closeModal(); setRaceTab('messages');
    document.getElementById('radioDriver').value = d.abbr;
  });
  document.querySelectorAll('.ers-btn').forEach(b=>b.addEventListener('click', ()=>{
    const drv = RACE.drivers.find(x=>x.abbr===b.dataset.abbr);
    if(drv) drv.ers = b.dataset.mode;
    closeModal();
  }));
}

// ---- Track view — cars spread by TIME GAP (not lap distance) ----
function drawTrackView(){
  const canvas = document.getElementById('trackCanvas');
  if(!canvas || !RACE) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const cx = w/2, cy = h/2;
  const rx = w * 0.42;
  const ry = h * 0.40 * (RACE.track.shape || 0.6) + h * 0.10;
  const tilt = RACE.track.tilt || 0;
  const kink = RACE.track.kink || 0.05;

  const N = 180;
  const pts = [];
  for(let i=0;i<N;i++){
    // Negative angle so increasing index sweeps anti-clockwise on screen
    // (leader moves anti-clockwise as race progress/phase increases).
    const t = -(i/N) * Math.PI * 2;
    const kx = Math.sin(t*2) * kink * rx * 0.15;
    const ky = Math.cos(t*3) * kink * ry * 0.15;
    let x = Math.cos(t) * rx + kx;
    let y = Math.sin(t) * ry + ky;
    const xr = x * Math.cos(tilt) - y * Math.sin(tilt);
    const yr = x * Math.sin(tilt) + y * Math.cos(tilt);
    pts.push({ x: cx + xr, y: cy + yr });
  }

  const sectorRanges = [[0, Math.floor(N/3)], [Math.floor(N/3), Math.floor(2*N/3)], [Math.floor(2*N/3), N]];
  const sectorColors = { green:'#2f7a4a', yellow:'#c9922a', red:'#a13b34' };

  sectorRanges.forEach((range, sIdx)=>{
    const color = sectorColors[RACE.sectors[sIdx]] || sectorColors.green;
    ctx.strokeStyle = color;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for(let i=range[0]; i<=range[1]; i++){
      const p = pts[i % N];
      if(i===range[0]) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6,8]);
  ctx.beginPath();
  for(let i=0;i<=N;i++){
    const p = pts[i % N];
    if(i===0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const sf = pts[0];
  ctx.fillStyle = '#EDEAE2';
  ctx.beginPath();
  ctx.arc(sf.x, sf.y, 5, 0, Math.PI*2);
  ctx.fill();
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillText('S/F', sf.x+10, sf.y-6);

  const pointAt = (f)=>{
    f = ((f % 1) + 1) % 1;
    const idx = f * N;
    const i0 = Math.floor(idx);
    const i1 = (i0+1) % N;
    const t = idx - i0;
    const a = pts[i0], b = pts[i1];
    return { x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t };
  };

  // Position cars by their TIME-BASED race progress, so they spread by actual gap
  // Convert each driver's totalTime to a 0..1 race fraction that cycles each lap.
  // Use the leader's totalTime * lapLength-ratio as the reference cycle.
  const active = RACE.drivers.filter(d=>!d.retired);
  if(active.length === 0) return;
  const leader = active.reduce((a,b)=> a.totalTime < b.totalTime ? a : b);
  // Track "spread": map each car's relative time gap to a lap-fraction offset
  // Lap time ≈ 90s, so a 90s gap = one full lap behind = same visual position, one cycle back
  const LAP_TIME_APPROX = 90;
  active.forEach(d=>{
    const gap = d.totalTime - leader.totalTime;
    // Convert absolute total time to fraction around the lap: leader sits at (its lap time mod LAP_TIME)/LAP_TIME
    // Simpler: each car's "on-track phase" is (d.totalTime mod LAP_TIME_APPROX)/LAP_TIME_APPROX
    // This makes every car move around the loop every ~90s of race time, spread by their own phase.
    const phase = (d.totalTime % LAP_TIME_APPROX) / LAP_TIME_APPROX;
    const pt = pointAt(phase);
    const team = teamById(d.teamId);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, d.teamId===STATE.myTeamId?7:5, 0, Math.PI*2);
    ctx.fillStyle = team.color;
    ctx.fill();
    if(d.teamId===STATE.myTeamId){ ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke(); }
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, d.teamId===STATE.myTeamId?10:8, 0, Math.PI*2);
    ctx.strokeStyle = { S:'#ef4444', M:'#fbbf24', H:'#e5e7eb', I:'#22c55e', W:'#3b82f6' }[d.tyre];
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#EDEAE2';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(d.abbr, pt.x+11, pt.y+3);
    if(d._pitTimer > 0){
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(pt.x-8, pt.y-15, 16, 4);
    }
  });

  ctx.fillStyle = '#565D6A';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(`${RACE.track.name} — Lap ${RACE.lap}/${RACE.laps}`, 14, 22);
}

// ---- Finish ----
function finishRace(){
  RACE.finished = true;
  const el = document.getElementById('flagIndicator');
  el.className = 'flag-indicator flag-checkered';
  el.textContent = 'Finished';
  pushFeed(RACE.lap, `Checkered flag.`, 'good');
}

function showRaceResults(){
  const classified = RACE.drivers.filter(d=>!d.retired);
  const dnfs = RACE.drivers.filter(d=>d.retired);
  const results = [...classified, ...dnfs];

  let myPrize = 0;
  const myResults = [];
  results.forEach((d,i)=>{
    const pts = i<POINTS_TABLE.length && !d.retired ? POINTS_TABLE[i] : 0;
    STATE.driversPoints[d.abbr] = (STATE.driversPoints[d.abbr]||0) + pts;
    STATE.constructorsPoints[d.teamId] = (STATE.constructorsPoints[d.teamId]||0) + pts;
    if(d.teamId===STATE.myTeamId){
      myPrize += PRIZE_BY_POS[i] || PRIZE_BY_POS[PRIZE_BY_POS.length-1];
      myResults.push({abbr:d.abbr, name:d.name, pos:i+1, retired:d.retired});
    }
  });

  if(RACE.fastestLapHolder){
    const fl = RACE.drivers.find(d=>d.abbr===RACE.fastestLapHolder);
    if(fl && !fl.retired && fl.position <= 10){
      STATE.driversPoints[fl.abbr] = (STATE.driversPoints[fl.abbr]||0) + 1;
      STATE.constructorsPoints[fl.teamId] = (STATE.constructorsPoints[fl.teamId]||0) + 1;
    }
  }

  STATE.raceLog.push({
    season: STATE.season,
    round: STATE.round+1,
    track: RACE.track.id,
    results: results.map((d,i)=>({abbr:d.abbr, pos:i+1, retired:d.retired})),
  });

  const bestPos = myResults.filter(r=>!r.retired).sort((a,b)=>a.pos-b.pos)[0]?.pos || 20;
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
    const statusText = d.retired ? (d.retiredReason==='crash'?'DNF (crash)':'DNF (mec)') : `P${i+1}`;
    const pts = i<POINTS_TABLE.length && !d.retired ? POINTS_TABLE[i] : 0;
    const crown = (RACE.fastestLapHolder===d.abbr) ? ' ♛' : '';
    return `<div class="side-row" style="border-bottom:1px solid var(--line);padding:7px 0;">
      <span><span class="team-pill" style="background:${t.color}"></span>${d.abbr}${crown} ${t.id===STATE.myTeamId?'←':''}</span>
      <b>${statusText}${pts?` (+${pts})`:''}</b>
    </div>`;
  }).join('');
  const deltaText = delta>0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
  const deltaColor = delta>0?'var(--green)':delta<0?'var(--red)':'var(--dim)';

  const biggestMover = RACE.drivers.filter(d=>!d.retired).slice().sort((a,b)=>(a.startPosition-a.position)-(b.startPosition-b.position)).pop();
  const yourBest = myResults.filter(r=>!r.retired).sort((a,b)=>a.pos-b.pos)[0];

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
  document.getElementById('btnLoadGame').disabled = !hasAnySave();
  showScreen('screen-intro');
})();
