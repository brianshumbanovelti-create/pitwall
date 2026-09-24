// ===================== STATIC GAME DATA =====================
// Teams use recognizable 3-letter codes; full names are original to avoid trademarks.
// Tiers: 'title' (expect P1) | 'contender' (P5) | 'midfield' (P7) | 'backmarker' (P9)

const TEAMS = [
  { id:'rbr', abbr:'RBR', name:'Bull Dynamics',           color:'#3671C6', tier:'title',
    pace:97, reliability:88, budget:190,
    drivers:[ {name:'M. Verstaad', abbr:'VER', skill:98, consistency:93},
              {name:'I. Hadjaro',  abbr:'HAD', skill:82, consistency:76} ] },
  { id:'mer', abbr:'MER', name:'Silver Arrow Racing',      color:'#00D2BE', tier:'title',
    pace:96, reliability:92, budget:180,
    drivers:[ {name:'G. Russo',    abbr:'RUS', skill:90, consistency:88},
              {name:'K. Antonellio',abbr:'ANT',skill:82, consistency:78} ] },
  { id:'fer', abbr:'FER', name:'Cavallo Corse',            color:'#E8002D', tier:'title',
    pace:95, reliability:85, budget:185,
    drivers:[ {name:'C. Leclerre', abbr:'LEC', skill:93, consistency:85},
              {name:'L. Hamsworth',abbr:'HAM', skill:91, consistency:90} ] },
  { id:'mcl', abbr:'MCL', name:'Woking Motorsport',        color:'#FF8000', tier:'title',
    pace:96, reliability:90, budget:175,
    drivers:[ {name:'L. Norrison', abbr:'NOR', skill:92, consistency:89},
              {name:'O. Piastro',  abbr:'PIA', skill:91, consistency:87} ] },
  { id:'amr', abbr:'AMR', name:'Green Valley F1',          color:'#229971', tier:'contender',
    pace:88, reliability:83, budget:140,
    drivers:[ {name:'F. Alonzo',   abbr:'ALO', skill:92, consistency:91},
              {name:'L. Strollo',  abbr:'STR', skill:74, consistency:70} ] },
  { id:'wil', abbr:'WIL', name:'Grove Engineering',        color:'#64C4FF', tier:'contender',
    pace:82, reliability:80, budget:120,
    drivers:[ {name:'A. Albono',   abbr:'ALB', skill:85, consistency:82},
              {name:'C. Sainzo',   abbr:'SAI', skill:88, consistency:87} ] },
  { id:'alp', abbr:'ALP', name:'Tricolore Racing',         color:'#FF87BC', tier:'contender',
    pace:80, reliability:78, budget:115,
    drivers:[ {name:'P. Gaslin',   abbr:'GAS', skill:84, consistency:82},
              {name:'F. Colapintez',abbr:'COL',skill:76, consistency:72} ] },
  { id:'vcb', abbr:'VCB', name:'Faenza Junior Team',       color:'#6692FF', tier:'midfield',
    pace:78, reliability:79, budget:100,
    drivers:[ {name:'L. Lawsono',  abbr:'LAW', skill:80, consistency:76},
              {name:'A. Lindblado',abbr:'LIN', skill:76, consistency:74} ] },
  { id:'haa', abbr:'HAA', name:'Kannapolis Racing',        color:'#B6BABD', tier:'midfield',
    pace:76, reliability:76, budget:95,
    drivers:[ {name:'E. Ocono',    abbr:'OCO', skill:82, consistency:81},
              {name:'O. Bearmano', abbr:'BEA', skill:79, consistency:77} ] },
  { id:'aud', abbr:'AUD', name:'Ingolstadt Motorsport',    color:'#52E252', tier:'backmarker',
    pace:74, reliability:75, budget:90,
    drivers:[ {name:'N. Hulkenbo', abbr:'HUL', skill:83, consistency:82},
              {name:'G. Bortoletto',abbr:'BOR',skill:77, consistency:74} ] },
  { id:'cad', abbr:'CAD', name:'Cadillac Racing',          color:'#C8A75D', tier:'backmarker',
    pace:71, reliability:73, budget:85,
    drivers:[ {name:'S. Perico',   abbr:'PER', skill:83, consistency:78},
              {name:'V. Bottaso',  abbr:'BOT', skill:82, consistency:80} ] },
];

const TIER_OBJECTIVES = {
  title:      { label:'Win both championships',                       conText:1,  drvText:1 },
  contender:  { label:'Best of the rest (P5+) with podiums',          conText:5,  drvText:5 },
  midfield:   { label:'Finish top 7 in constructors',                 conText:7,  drvText:8 },
  backmarker: { label:'Score points and avoid last place',            conText:9,  drvText:12 },
};

// Real 2026-style calendar in fixed order. Track character is real-world inspired.
// path: simplified SVG-style polyline used for the track map (auto-scaled).
const TRACKS = [
  { id:'bhr', name:'Sakhir', country:'Bahrain', laps:57, tempC:31, trackTempC:44, windKmh:18, rainChance:0.02, character:'hot, abrasive, high deg', baseline:'dry',
    path:[[0.10,0.55],[0.14,0.32],[0.30,0.20],[0.52,0.22],[0.62,0.35],[0.72,0.28],[0.86,0.34],[0.90,0.55],[0.82,0.72],[0.62,0.82],[0.42,0.80],[0.24,0.78],[0.10,0.72]] },
  { id:'jed', name:'Jeddah Corniche', country:'Saudi Arabia', laps:50, tempC:29, trackTempC:38, windKmh:12, rainChance:0, character:'hot night race, fast, low deg', baseline:'dry',
    path:[[0.10,0.30],[0.28,0.20],[0.50,0.18],[0.72,0.24],[0.88,0.40],[0.86,0.62],[0.68,0.70],[0.48,0.66],[0.30,0.72],[0.14,0.82],[0.08,0.66],[0.10,0.44]] },
  { id:'aus', name:'Albert Park', country:'Australia', laps:58, tempC:22, trackTempC:31, windKmh:22, rainChance:0.25, character:'mild, gusty winds', baseline:'dry',
    path:[[0.12,0.42],[0.28,0.28],[0.48,0.30],[0.60,0.20],[0.74,0.26],[0.88,0.40],[0.84,0.60],[0.70,0.72],[0.50,0.76],[0.34,0.72],[0.20,0.78],[0.10,0.68],[0.08,0.52]] },
  { id:'suz', name:'Suzuka', country:'Japan', laps:53, tempC:19, trackTempC:27, windKmh:15, rainChance:0.35, character:'cool, technical, changeable', baseline:'dry',
    path:[[0.12,0.30],[0.30,0.22],[0.48,0.30],[0.62,0.24],[0.78,0.30],[0.86,0.48],[0.78,0.62],[0.62,0.58],[0.52,0.66],[0.40,0.76],[0.26,0.78],[0.14,0.66],[0.10,0.48]] },
  { id:'sha', name:'Shanghai', country:'China', laps:56, tempC:18, trackTempC:24, windKmh:14, rainChance:0.3, character:'overcast, moderate deg', baseline:'dry',
    path:[[0.10,0.44],[0.22,0.30],[0.36,0.24],[0.48,0.32],[0.44,0.46],[0.56,0.52],[0.68,0.42],[0.82,0.38],[0.90,0.52],[0.82,0.66],[0.64,0.72],[0.46,0.70],[0.30,0.74],[0.16,0.66],[0.10,0.58]] },
  { id:'mia', name:'Miami', country:'USA', laps:57, tempC:30, trackTempC:47, windKmh:16, rainChance:0.15, character:'hot, humid, bumpy', baseline:'dry',
    path:[[0.10,0.50],[0.20,0.30],[0.38,0.22],[0.54,0.26],[0.64,0.18],[0.78,0.28],[0.88,0.46],[0.80,0.62],[0.62,0.70],[0.46,0.78],[0.30,0.76],[0.16,0.68],[0.08,0.60]] },
  { id:'imo', name:'Imola', country:'Italy', laps:63, tempC:20, trackTempC:29, windKmh:10, rainChance:0.45, character:'European spring, rain risk building', baseline:'dry-threat',
    path:[[0.14,0.32],[0.30,0.22],[0.46,0.28],[0.58,0.22],[0.72,0.30],[0.82,0.44],[0.74,0.58],[0.58,0.62],[0.46,0.70],[0.32,0.76],[0.18,0.70],[0.10,0.56],[0.12,0.42]] },
  { id:'mon', name:'Monaco', country:'Monaco', laps:78, tempC:21, trackTempC:32, windKmh:8, rainChance:0.4, character:'street circuit, low deg, high SC chance', baseline:'dry-threat',
    path:[[0.18,0.30],[0.34,0.22],[0.50,0.26],[0.62,0.22],[0.76,0.30],[0.82,0.44],[0.74,0.52],[0.82,0.62],[0.72,0.72],[0.58,0.70],[0.50,0.78],[0.36,0.78],[0.24,0.70],[0.20,0.56],[0.14,0.44]] },
  { id:'esp', name:'Barcelona', country:'Spain', laps:66, tempC:28, trackTempC:38, windKmh:11, rainChance:0.1, character:'hot, high deg, abrasive', baseline:'dry',
    path:[[0.10,0.40],[0.24,0.24],[0.42,0.20],[0.58,0.24],[0.66,0.36],[0.58,0.46],[0.66,0.56],[0.80,0.60],[0.88,0.72],[0.74,0.80],[0.56,0.76],[0.42,0.72],[0.26,0.78],[0.12,0.70],[0.08,0.54]] },
  { id:'can', name:'Gilles Villeneuve', country:'Canada', laps:70, tempC:20, trackTempC:28, windKmh:14, rainChance:0.3, character:'wall-lined, high SC/VSC chance', baseline:'dry',
    path:[[0.10,0.34],[0.24,0.22],[0.42,0.24],[0.58,0.20],[0.72,0.28],[0.86,0.42],[0.80,0.58],[0.66,0.62],[0.56,0.72],[0.42,0.80],[0.26,0.78],[0.14,0.66],[0.08,0.50]] },
  { id:'aut', name:'Spielberg', country:'Austria', laps:71, tempC:23, trackTempC:34, windKmh:11, rainChance:0.3, character:'short lap, high SC frequency', baseline:'dry',
    path:[[0.12,0.42],[0.24,0.26],[0.42,0.20],[0.58,0.24],[0.72,0.18],[0.86,0.28],[0.88,0.46],[0.76,0.58],[0.62,0.60],[0.52,0.72],[0.36,0.78],[0.20,0.70],[0.10,0.58]] },
  { id:'gbr', name:'Silverstone', country:'Britain', laps:52, tempC:17, trackTempC:23, windKmh:24, rainChance:0.55, character:'classic British weather, starts wet drying out', baseline:'wet-drying',
    path:[[0.10,0.36],[0.24,0.22],[0.44,0.20],[0.60,0.24],[0.74,0.20],[0.88,0.32],[0.88,0.52],[0.76,0.62],[0.64,0.56],[0.54,0.66],[0.44,0.78],[0.28,0.80],[0.14,0.70],[0.08,0.52]] },
  { id:'bel', name:'Spa-Francorchamps', country:'Belgium', laps:44, tempC:16, trackTempC:22, windKmh:20, rainChance:0.6, character:'microclimates, rain forecast building', baseline:'dry-threat',
    path:[[0.10,0.30],[0.30,0.22],[0.52,0.28],[0.66,0.22],[0.80,0.32],[0.88,0.50],[0.80,0.68],[0.62,0.74],[0.48,0.68],[0.36,0.78],[0.22,0.76],[0.12,0.62],[0.08,0.44]] },
  { id:'hun', name:'Hungaroring', country:'Hungary', laps:70, tempC:29, trackTempC:42, windKmh:9, rainChance:0.2, character:'hot, twisty, high tyre wear', baseline:'dry',
    path:[[0.14,0.36],[0.30,0.24],[0.48,0.28],[0.58,0.20],[0.74,0.26],[0.84,0.40],[0.78,0.54],[0.64,0.60],[0.56,0.72],[0.42,0.80],[0.26,0.78],[0.14,0.68],[0.10,0.52]] },
  { id:'ned', name:'Zandvoort', country:'Netherlands', laps:72, tempC:17, trackTempC:24, windKmh:26, rainChance:0.4, character:'coastal wind, banked corners', baseline:'dry',
    path:[[0.12,0.34],[0.24,0.22],[0.42,0.24],[0.52,0.16],[0.68,0.24],[0.82,0.34],[0.86,0.50],[0.74,0.58],[0.60,0.60],[0.48,0.70],[0.36,0.80],[0.22,0.76],[0.12,0.64],[0.08,0.48]] },
  { id:'ita', name:'Monza', country:'Italy', laps:53, tempC:24, trackTempC:33, windKmh:12, rainChance:0.2, character:'low downforce, low deg', baseline:'dry',
    path:[[0.10,0.50],[0.16,0.30],[0.34,0.22],[0.54,0.22],[0.72,0.28],[0.86,0.40],[0.88,0.58],[0.74,0.68],[0.56,0.70],[0.40,0.76],[0.24,0.74],[0.12,0.66]] },
  { id:'aze', name:'Baku', country:'Azerbaijan', laps:51, tempC:25, trackTempC:34, windKmh:19, rainChance:0.1, character:'street circuit, walls, high SC chance', baseline:'dry',
    path:[[0.10,0.42],[0.20,0.28],[0.36,0.24],[0.50,0.30],[0.60,0.24],[0.76,0.22],[0.90,0.34],[0.90,0.54],[0.78,0.60],[0.66,0.54],[0.56,0.62],[0.46,0.76],[0.30,0.80],[0.16,0.70],[0.08,0.56]] },
  { id:'sgp', name:'Marina Bay', country:'Singapore', laps:62, tempC:30, trackTempC:34, windKmh:6, rainChance:0.5, character:'humid night race, tropical downpour risk', baseline:'dry-threat',
    path:[[0.16,0.30],[0.30,0.22],[0.44,0.28],[0.54,0.22],[0.68,0.28],[0.80,0.38],[0.78,0.54],[0.68,0.60],[0.58,0.56],[0.50,0.68],[0.40,0.78],[0.26,0.80],[0.14,0.68],[0.12,0.50]] },
  { id:'usa', name:'Circuit of the Americas', country:'USA', laps:56, tempC:26, trackTempC:36, windKmh:15, rainChance:0.25, character:'undulating, moderate deg', baseline:'dry',
    path:[[0.10,0.34],[0.24,0.22],[0.42,0.22],[0.54,0.30],[0.64,0.22],[0.78,0.28],[0.88,0.42],[0.82,0.58],[0.66,0.60],[0.54,0.70],[0.42,0.78],[0.26,0.76],[0.14,0.68],[0.08,0.50]] },
  { id:'mex', name:'Hermanos Rodríguez', country:'Mexico', laps:71, tempC:20, trackTempC:28, windKmh:9, rainChance:0.15, character:'high altitude, low downforce load', baseline:'dry',
    path:[[0.10,0.42],[0.22,0.26],[0.40,0.22],[0.56,0.24],[0.70,0.30],[0.84,0.40],[0.84,0.58],[0.70,0.66],[0.56,0.70],[0.44,0.78],[0.28,0.78],[0.14,0.68],[0.08,0.54]] },
  { id:'bra', name:'Interlagos', country:'Brazil', laps:71, tempC:24, trackTempC:31, windKmh:13, rainChance:0.5, character:'unpredictable weather, rain common', baseline:'dry-threat',
    path:[[0.12,0.30],[0.28,0.22],[0.46,0.26],[0.58,0.20],[0.72,0.28],[0.82,0.42],[0.74,0.56],[0.60,0.58],[0.48,0.68],[0.36,0.78],[0.22,0.78],[0.10,0.66],[0.08,0.48]] },
  { id:'lv',  name:'Las Vegas Strip', country:'USA', laps:50, tempC:11, trackTempC:14, windKmh:17, rainChance:0.05, character:'cold desert night, tyres struggle to warm', baseline:'dry',
    path:[[0.10,0.44],[0.20,0.28],[0.36,0.22],[0.52,0.26],[0.66,0.20],[0.82,0.28],[0.90,0.44],[0.88,0.62],[0.74,0.72],[0.58,0.70],[0.42,0.74],[0.26,0.80],[0.12,0.68]] },
  { id:'qat', name:'Lusail', country:'Qatar', laps:57, tempC:27, trackTempC:36, windKmh:20, rainChance:0.02, character:'hot, windy, high-speed, high deg', baseline:'dry',
    path:[[0.10,0.46],[0.22,0.30],[0.42,0.22],[0.58,0.28],[0.72,0.22],[0.86,0.34],[0.86,0.54],[0.72,0.62],[0.58,0.58],[0.46,0.68],[0.34,0.78],[0.20,0.76],[0.10,0.62]] },
  { id:'abu', name:'Yas Marina', country:'Abu Dhabi', laps:58, tempC:27, trackTempC:33, windKmh:13, rainChance:0.02, character:'day-to-night, low deg', baseline:'dry',
    path:[[0.10,0.42],[0.22,0.26],[0.38,0.22],[0.54,0.26],[0.68,0.20],[0.82,0.30],[0.88,0.46],[0.82,0.62],[0.68,0.70],[0.52,0.72],[0.38,0.78],[0.24,0.76],[0.12,0.66],[0.08,0.52]] },
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

// Prize money by finishing position (millions).
const PRIZE_BY_POS = [12,10,8.5,7,6,5,4,3.5,3,2.5,2,1.8,1.6,1.4,1.2,1,0.9,0.8,0.7,0.6,0.5,0.4];

// Season start budget boost per tier (paid at season end).
const SEASON_END_BONUS = { title:80, contender:60, midfield:45, backmarker:35 };
