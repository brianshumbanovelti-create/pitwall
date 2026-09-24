// ===================== STATIC GAME DATA =====================

const TEAMS = [
  { id:'mer', abbr:'MER', name:'Mercedes',        color:'#00D2BE', tier:'title',
    pace:96, reliability:95, budget:180,
    drivers:[ {name:'George Russell',  abbr:'RUS', skill:90, consistency:92},
              {name:'Kimi Antonelli',  abbr:'ANT', skill:82, consistency:84} ] },
  { id:'fer', abbr:'FER', name:'Ferrari',         color:'#E8002D', tier:'title',
    pace:95, reliability:90, budget:185,
    drivers:[ {name:'Charles Leclerc', abbr:'LEC', skill:93, consistency:88},
              {name:'Lewis Hamilton',  abbr:'HAM', skill:91, consistency:93} ] },
  { id:'mcl', abbr:'MCL', name:'McLaren',         color:'#FF8000', tier:'title',
    pace:96, reliability:94, budget:175,
    drivers:[ {name:'Lando Norris',    abbr:'NOR', skill:92, consistency:92},
              {name:'Oscar Piastri',   abbr:'PIA', skill:91, consistency:90} ] },
  { id:'rbr', abbr:'RBR', name:'Red Bull Racing', color:'#3671C6', tier:'title',
    pace:97, reliability:94, budget:190,
    drivers:[ {name:'Max Verstappen',  abbr:'VER', skill:98, consistency:95},
              {name:'Isack Hadjar',    abbr:'HAD', skill:82, consistency:82} ] },
  { id:'vcb', abbr:'VCB', name:'Racing Bulls',    color:'#6692FF', tier:'midfield',
    pace:78, reliability:87, budget:100,
    drivers:[ {name:'Liam Lawson',     abbr:'LAW', skill:80, consistency:80},
              {name:'Arvid Lindblad',  abbr:'LIN', skill:76, consistency:78} ] },
  { id:'alp', abbr:'ALP', name:'Alpine',          color:'#FF87BC', tier:'contender',
    pace:80, reliability:86, budget:115,
    drivers:[ {name:'Pierre Gasly',    abbr:'GAS', skill:84, consistency:86},
              {name:'Franco Colapinto',abbr:'COL', skill:76, consistency:78} ] },
  { id:'haa', abbr:'HAA', name:'Haas F1 Team',    color:'#B6BABD', tier:'midfield',
    pace:76, reliability:85, budget:95,
    drivers:[ {name:'Esteban Ocon',    abbr:'OCO', skill:82, consistency:84},
              {name:'Oliver Bearman',  abbr:'BEA', skill:79, consistency:80} ] },
  { id:'aud', abbr:'AUD', name:'Audi',            color:'#52E252', tier:'backmarker',
    pace:74, reliability:84, budget:90,
    drivers:[ {name:'Nico Hülkenberg', abbr:'HUL', skill:83, consistency:86},
              {name:'Gabriel Bortoleto',abbr:'BOR',skill:77, consistency:78} ] },
  { id:'wil', abbr:'WIL', name:'Williams',        color:'#64C4FF', tier:'contender',
    pace:82, reliability:88, budget:120,
    drivers:[ {name:'Carlos Sainz',    abbr:'SAI', skill:88, consistency:90},
              {name:'Alexander Albon', abbr:'ALB', skill:85, consistency:86} ] },
  { id:'amr', abbr:'AMR', name:'Aston Martin',    color:'#229971', tier:'contender',
    pace:88, reliability:90, budget:140,
    drivers:[ {name:'Fernando Alonso', abbr:'ALO', skill:92, consistency:94},
              {name:'Lance Stroll',    abbr:'STR', skill:74, consistency:78} ] },
  { id:'cad', abbr:'CAD', name:'Cadillac',        color:'#C8A75D', tier:'backmarker',
    pace:71, reliability:82, budget:85,
    drivers:[ {name:'Sergio Pérez',    abbr:'PER', skill:83, consistency:82},
              {name:'Valtteri Bottas', abbr:'BOT', skill:82, consistency:84} ] },
];

const TIER_OBJECTIVES = {
  title:      { label:'Win both championships',              conText:1,  drvText:1 },
  contender:  { label:'Best of the rest (P5+) with podiums', conText:5,  drvText:5 },
  midfield:   { label:'Finish top 7 in constructors',        conText:7,  drvText:8 },
  backmarker: { label:'Score points and avoid last place',   conText:9,  drvText:12 },
};

// Simplified ovals — each track gets slightly different shape & tilt so they feel distinct.
// `shape` controls the ellipse rx/ry ratio; `tilt` rotates it (radians); `kink` adds a small
// notch so it isn't a perfect ellipse.
const TRACKS = [
  { id:'bhr', name:'Sakhir',            country:'Bahrain',     laps:57, tempC:31, trackTempC:44, windKmh:18, rainChance:0.02, character:'hot, abrasive, high deg',           baseline:'dry',       shape:0.62, tilt: 0.0,  kink:0.06 },
  { id:'jed', name:'Jeddah Corniche',   country:'Saudi Arabia',laps:50, tempC:29, trackTempC:38, windKmh:12, rainChance:0.00, character:'hot night race, fast, low deg',      baseline:'dry',       shape:0.42, tilt: 0.1,  kink:0.10 },
  { id:'aus', name:'Albert Park',       country:'Australia',   laps:58, tempC:22, trackTempC:31, windKmh:22, rainChance:0.25, character:'mild, gusty winds',                  baseline:'dry',       shape:0.70, tilt:-0.08, kink:0.05 },
  { id:'suz', name:'Suzuka',            country:'Japan',       laps:53, tempC:19, trackTempC:27, windKmh:15, rainChance:0.35, character:'cool, technical, changeable',        baseline:'dry',       shape:0.55, tilt: 0.15, kink:0.12 },
  { id:'sha', name:'Shanghai',          country:'China',       laps:56, tempC:18, trackTempC:24, windKmh:14, rainChance:0.30, character:'overcast, moderate deg',             baseline:'dry',       shape:0.72, tilt:-0.10, kink:0.08 },
  { id:'mia', name:'Miami',             country:'USA',         laps:57, tempC:30, trackTempC:47, windKmh:16, rainChance:0.15, character:'hot, humid, bumpy',                  baseline:'dry',       shape:0.58, tilt: 0.06, kink:0.07 },
  { id:'imo', name:'Imola',             country:'Italy',       laps:63, tempC:20, trackTempC:29, windKmh:10, rainChance:0.45, character:'European spring, rain risk building',baseline:'dry-threat',shape:0.68, tilt: 0.04, kink:0.09 },
  { id:'mon', name:'Monaco',            country:'Monaco',      laps:78, tempC:21, trackTempC:32, windKmh: 8, rainChance:0.40, character:'street circuit, low deg, high SC chance', baseline:'dry-threat', shape:0.80, tilt: 0.20, kink:0.14 },
  { id:'esp', name:'Barcelona',         country:'Spain',       laps:66, tempC:28, trackTempC:38, windKmh:11, rainChance:0.10, character:'hot, high deg, abrasive',            baseline:'dry',       shape:0.66, tilt: 0.02, kink:0.06 },
  { id:'can', name:'Gilles Villeneuve', country:'Canada',      laps:70, tempC:20, trackTempC:28, windKmh:14, rainChance:0.30, character:'wall-lined, high SC chance',         baseline:'dry',       shape:0.60, tilt:-0.14, kink:0.10 },
  { id:'aut', name:'Spielberg',         country:'Austria',     laps:71, tempC:23, trackTempC:34, windKmh:11, rainChance:0.30, character:'short lap, high SC frequency',       baseline:'dry',       shape:0.74, tilt:-0.05, kink:0.05 },
  { id:'gbr', name:'Silverstone',       country:'Britain',     laps:52, tempC:17, trackTempC:23, windKmh:24, rainChance:0.55, character:'classic British weather, starts wet drying out', baseline:'wet-drying', shape:0.64, tilt: 0.03, kink:0.08 },
  { id:'bel', name:'Spa-Francorchamps', country:'Belgium',     laps:44, tempC:16, trackTempC:22, windKmh:20, rainChance:0.60, character:'microclimates, rain building',       baseline:'dry-threat', shape:0.48, tilt: 0.18, kink:0.14 },
  { id:'hun', name:'Hungaroring',       country:'Hungary',     laps:70, tempC:29, trackTempC:42, windKmh: 9, rainChance:0.20, character:'hot, twisty, high tyre wear',        baseline:'dry',       shape:0.72, tilt: 0.08, kink:0.07 },
  { id:'ned', name:'Zandvoort',         country:'Netherlands', laps:72, tempC:17, trackTempC:24, windKmh:26, rainChance:0.40, character:'coastal wind, banked corners',       baseline:'dry',       shape:0.56, tilt:-0.12, kink:0.11 },
  { id:'ita', name:'Monza',             country:'Italy',       laps:53, tempC:24, trackTempC:33, windKmh:12, rainChance:0.20, character:'low downforce, low deg',             baseline:'dry',       shape:0.38, tilt: 0.00, kink:0.04 },
  { id:'aze', name:'Baku',              country:'Azerbaijan',  laps:51, tempC:25, trackTempC:34, windKmh:19, rainChance:0.10, character:'street circuit, walls, high SC chance', baseline:'dry',      shape:0.46, tilt: 0.12, kink:0.10 },
  { id:'sgp', name:'Marina Bay',        country:'Singapore',   laps:62, tempC:30, trackTempC:34, windKmh: 6, rainChance:0.50, character:'humid night race, tropical downpour risk', baseline:'dry-threat', shape:0.78, tilt: 0.15, kink:0.12 },
  { id:'usa', name:'COTA',              country:'USA',         laps:56, tempC:26, trackTempC:36, windKmh:15, rainChance:0.25, character:'undulating, moderate deg',           baseline:'dry',       shape:0.62, tilt:-0.07, kink:0.09 },
  { id:'mex', name:'Hermanos Rodríguez',country:'Mexico',      laps:71, tempC:20, trackTempC:28, windKmh: 9, rainChance:0.15, character:'high altitude, low downforce load',  baseline:'dry',       shape:0.70, tilt: 0.05, kink:0.06 },
  { id:'bra', name:'Interlagos',        country:'Brazil',      laps:71, tempC:24, trackTempC:31, windKmh:13, rainChance:0.50, character:'unpredictable weather, rain common', baseline:'dry-threat', shape:0.60, tilt:-0.09, kink:0.11 },
  { id:'lv',  name:'Las Vegas Strip',   country:'USA',         laps:50, tempC:11, trackTempC:14, windKmh:17, rainChance:0.05, character:'cold desert night, tyres struggle to warm', baseline:'dry', shape:0.36, tilt: 0.02, kink:0.05 },
  { id:'qat', name:'Lusail',            country:'Qatar',       laps:57, tempC:27, trackTempC:36, windKmh:20, rainChance:0.02, character:'hot, windy, high-speed, high deg',   baseline:'dry',       shape:0.52, tilt: 0.04, kink:0.10 },
  { id:'abu', name:'Yas Marina',        country:'Abu Dhabi',   laps:58, tempC:27, trackTempC:33, windKmh:13, rainChance:0.02, character:'day-to-night, low deg',              baseline:'dry',       shape:0.66, tilt: 0.11, kink:0.07 },
];

const COMPOUNDS = {
  S:{name:'Soft',    code:'S', gripBase:100, degRate:2.6, tempMin:20, tempMax:50},
  M:{name:'Medium',  code:'M', gripBase:95,  degRate:1.7, tempMin:15, tempMax:45},
  H:{name:'Hard',    code:'H', gripBase:90,  degRate:1.1, tempMin:15, tempMax:50},
  I:{name:'Inter',   code:'I', gripBase:80,  degRate:1.4, tempMin:5,  tempMax:30, wet:true},
  W:{name:'Wet',     code:'W', gripBase:70,  degRate:1.0, tempMin:0,  tempMax:25, wet:true},
};

const ENGINEER_FIRST = ['Marco','Elena','Kofi','Priya','Sven','Hana','Diego','Freya','Tariq','Naledi','Lars','Yuki','Ana','Bram','Chidi','Ines','Otto','Mei','Rowan','Sanjay'];
const ENGINEER_LAST = ['Bianchi','Novak','Adeyemi','Mehta','Larsen','Tanaka','Reyes','Nilsson','Haddad','Dlamini','Voss','Kobayashi','Marchetti','de Groot','Okafor','Moreau','Schulz','Lindqvist','Petrov','Castillo'];
const ENGINEER_ROLES = [
  { key:'aero',         label:'Aerodynamicist',      affects:'pace' },
  { key:'reliability',  label:'Reliability Engineer',affects:'reliability' },
  { key:'strategist',   label:'Race Strategist',     affects:'strategy' },
  { key:'perf',         label:'Performance Engineer',affects:'pace' },
];

const PRIZE_BY_POS = [12,10,8.5,7,6,5,4,3.5,3,2.5,2,1.8,1.6,1.4,1.2,1,0.9,0.8,0.7,0.6,0.5,0.4];
const SEASON_END_BONUS = { title:80, contender:60, midfield:45, backmarker:35 };

// ERS / engine modes. Multipliers apply for the rest of the current stint.
const ERS_MODES = {
  attack:   { label:'Attack',   paceBonus: 0.025, reliabilityRisk: 1.6, degMult: 1.15 },
  balanced: { label:'Balanced', paceBonus: 0.0,   reliabilityRisk: 1.0, degMult: 1.00 },
  save:     { label:'Save',     paceBonus:-0.02,  reliabilityRisk: 0.6, degMult: 0.90 },
};

// Radio commands. Effect applies to the target driver for `durationLaps` laps.
const RADIO_COMMANDS = [
  { key:'push',    label:'Push now',        effect:{ paceBonus: 0.03,  degMult: 1.5, durationLaps: 4 }, reply:'Copy, pushing now.' },
  { key:'save',    label:'Save tyres',      effect:{ paceBonus:-0.02,  degMult: 0.6, durationLaps: 5 }, reply:'Understood, saving the tyres.' },
  { key:'fuel',    label:'Lift and coast',  effect:{ paceBonus:-0.03,  degMult: 0.9, durationLaps: 4 }, reply:'Copy, lifting and coasting.' },
  { key:'manage',  label:'Manage gap',      effect:{ paceBonus:-0.015, degMult: 0.85,durationLaps: 4 }, reply:'Copy, managing the gap.' },
  { key:'reassure',label:'Good job',        effect:{ paceBonus: 0.01,  degMult: 1.0, durationLaps: 3 }, reply:'Thanks. I\'ll keep at it.' },
  { key:'box',     label:'Box this lap',    effect:{ boxNow:true },                                     reply:'Boxing this lap.' },
  { key:'hold',    label:'Hold position',   effect:{ teamOrder:'hold',  durationLaps:6 },                reply:'Understood. Holding position.' },
  { key:'attack',  label:'Free to attack',  effect:{ teamOrder:'fight', durationLaps:6 },                reply:'Copy — I\'ll go for it.' },
];
