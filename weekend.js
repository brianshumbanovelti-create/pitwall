function buildFpBlock(){
  const done = WEEKEND.fp.length > 0;
  const el = document.createElement('div');
  el.className = 'wk-step' + (done?' done':'');
  el.innerHTML = `
    <div class="wk-step-header"><span><span class="step-num">01</span>Practice — FP1 / FP2 / FP3</span>
      <span>${done?'✓ Complete':''}</span></div>
    <div class="wk-step-body">
      <p class="dim small" style="margin-bottom:10px">Run practice to gather tyre data and reveal setup issues.</p>
      ${done
        ? `<div class="wk-log">${WEEKEND.fp.map(f=>`<div class="${f.cls}">${f.text}</div>`).join('')}</div>
           ${buildStrategyPreview()}`
        : `<button class="btn btn-primary btn-sm" id="btnRunFp">Run practice</button>`}
    </div>
  `;
  const btn = el.querySelector('#btnRunFp');
  if(btn) btn.addEventListener('click', runFp);
  return el;
}

function buildStrategyPreview(){
  const track = WEEKEND.track;
  const totalLaps = track.laps;
  // Derive recommended strategies from track characteristics
  const hot = track.trackTempC > 38;
  const cold = track.trackTempC < 18;
  const wetRace = track.baseline === 'wet-drying';
  const rainLikely = track.rainChance > 0.4;

  const strategies = [];

  if(wetRace){
    strategies.push({ label:'Wet start', sub:'Start on inters, switch when dry', stints:[['I', 0.5], ['M', 0.5]], rec:true });
    strategies.push({ label:'Full wet start', sub:'Maximum grip at start', stints:[['W', 0.35], ['I', 0.35], ['M', 0.30]] });
    strategies.push({ label:'Gamble on slicks', sub:'Risk it if you think it dries fast', stints:[['S', 0.3], ['M', 0.7]] });
  } else if(rainLikely){
    strategies.push({ label:'Medium start', sub:'Build flex, ready to switch to inters if rain comes', stints:[['M', 0.6], ['M', 0.4]], rec:true });
    strategies.push({ label:'Two-stop', sub:'Aggressive if it stays dry', stints:[['S', 0.35], ['M', 0.35], ['S', 0.30]] });
    strategies.push({ label:'Hard long run', sub:'Track position play', stints:[['H', 0.55], ['M', 0.45]] });
  } else if(hot){
    strategies.push({ label:'Two-stop', sub:'Hot track chews tyres — plan two stops', stints:[['S', 0.35], ['M', 0.35], ['S', 0.30]], rec:true });
    strategies.push({ label:'One-stop H→M', sub:'Manage deg on the hard', stints:[['H', 0.55], ['M', 0.45]] });
    strategies.push({ label:'One-stop M→M', sub:'Balanced', stints:[['M', 0.5], ['M', 0.5]] });
  } else if(cold){
    strategies.push({ label:'One-stop M→M', sub:'Cold track favours fewer stops', stints:[['M', 0.5], ['M', 0.5]], rec:true });
    strategies.push({ label:'Two-stop S→M→S', sub:'Aggressive if you can warm the softs', stints:[['S', 0.35], ['M', 0.35], ['S', 0.30]] });
    strategies.push({ label:'Soft start', sub:'Grip off the line', stints:[['S', 0.4], ['M', 0.6]] });
  } else {
    strategies.push({ label:'One-stop M→H', sub:'Balanced, safest option', stints:[['M', 0.5], ['H', 0.5]], rec:true });
    strategies.push({ label:'One-stop S→M', sub:'Softer first stint, quick start', stints:[['S', 0.4], ['M', 0.6]] });
    strategies.push({ label:'Two-stop S→M→S', sub:'Aggressive', stints:[['S', 0.35], ['M', 0.35], ['S', 0.30]] });
    strategies.push({ label:'Long first stint M→S', sub:'Track position play', stints:[['M', 0.65], ['S', 0.35]] });
  }

  const rows = strategies.map((s, i)=>{
    const rec = s.rec ? ' recommended' : '';
    const bars = s.stints.map(([t, frac])=>`
      <div class="strat-seg ${t}" style="flex:${frac}">${t}</div>
    `).join('');
    return `
      <div class="strat-row${rec}">
        <div class="strat-label">${s.label}${s.rec?' <span style="color:var(--cyan)">● recommended</span>':''}</div>
        <div class="strat-sub">${s.sub}</div>
        <div class="strat-bar">${bars}</div>
        <div class="strat-pick">
          <button class="btn btn-ghost btn-sm" data-strat="${i}">Use this</button>
        </div>
      </div>
    `;
  }).join('');

  // Lap scale ticks
  const ticks = [];
  for(let i=0;i<=totalLaps;i+=Math.max(5, Math.round(totalLaps/10))){
    ticks.push(i);
  }

  return `
    <div style="margin-top:18px">
      <div style="font-size:12.5px;font-weight:700;margin-bottom:8px">Strategy preview</div>
      <div class="strategy-preview" id="stratPreview">${rows}</div>
      <div class="strat-scale">
        ${ticks.map(t=>`<span>${t}</span>`).join('')}
      </div>
    </div>
  `;
}

// Hook: when user clicks "Use this", apply to both drivers' default plan
document.addEventListener('click', (e)=>{
  const b = e.target.closest('[data-strat]');
  if(!b) return;
  const stratIdx = parseInt(b.dataset.strat);
  // Populate WEEKEND.strategy with a canned plan for both drivers
  myTeam().drivers.forEach(d=>{
    if(!WEEKEND.strategy[d.abbr]) WEEKEND.strategy[d.abbr] = {};
    WEEKEND.strategy[d.abbr].tyre = 'M';
    WEEKEND.strategy[d.abbr].plan = '1-stop';
    WEEKEND.strategy[d.abbr].orders = 'fight';
  });
  // Re-render the strategy block below so the picks are reflected
  renderWeekend();
});
