// ===================== STATIC GAME DATA =====================

// Team tiers set expectations and base car stats.
// abbr uses real-world-recognizable 3-letter codes without full names/logos.
const TEAMS = [
  { id:'mer', abbr:'MER', name:'Silver Arrow Racing',      color:'#00D2BE', tier:'title',      pace:96, reliability:92, budget:180,
    drivers:[ {name:'L. Hamsworth', abbr:'HAM', skill:94, consistency:90}, {name:'G. Russo', abbr:'RUS', skill:90, consistency:88} ] },
  { id:'rbr', abbr:'RBR', name:'Bull Dynamics',            color:'#3671C6', tier:'title',      pace:97, reliability:88, budget:190,
    drivers:[ {name:'M. Verstaad', abbr:'VER', skill:98, consistency:93}, {name:'S. Perico', abbr:'PER', skill:83, consistency:78} ] },
  { id:'fer', abbr:'FER', name:'Cavallo Corse',             color:'#E8002D', tier:'title',      pace:95, reliability:85, budget:185,
    drivers:[ {name:'C. Leclerre', abbr:'LEC', skill:93, consistency:85}, {name:'C. Sainzo', abbr:'SAI', skill:89, consistency:87} ] },
  { id:'mcl', abbr:'MCL', name:'Woking Motorsport',         color:'#FF8000', tier:'title',      pace:96, reliability:90, budget:175,
    drivers:[ {name:'L. Norrison', abbr:'NOR', skill:92, consistency:89}, {name:'O. Piastro', abbr:'PIA', skill:88, consistency:84} ] },
  { id:'am',  abbr:'AMR', name:'Green Valley F1',           color:'#229971', tier:'contender',  pace:88, reliability:83, budget:140,
    drivers:[ {name:'F. Alonzo', abbr:'ALO', skill:92, consistency:91}, {name:'L. Strollo', abbr:'STR', skill:74, consistency:70} ] },
  { id:'alp', abbr:'ALP', name:'Tricolore Racing',          color:'#0093CC', tier:'contender',  pace:82, reliability:80, budget:120,
    drivers:[ {name:'P. Gaslin', abbr:'GAS', skill:84, consistency:82}, {name:'E. Ocono', abbr:'OCO', skill:83, consistency:81} ] },
  { id:'wil', abbr:'WIL', name:'Grove Engineering',         color:'#64C4FF', tier:'midfield',   pace:78, reliability:78, budget:95,
    drivers:[ {name:'A. Albono', abbr:'ALB', skill:83, consistency:80}, {name:'F. Colapintez', abbr:'COL', skill:76, consistency:72} ] },
  { id:'rb',  abbr:'VCB', name:'Faenza Junior Team',        color:'#6692FF', tier:'midfield',   pace:80, reliability:79, budget:90,
    drivers:[ {name:'Y. Tsunodo', abbr:'TSU', skill:80, consistency:76}, {name:'I. Hadjaro', abbr:'HAD', skill:78, consistency:74} ] },
  { id:'haa', abbr:'HAA', name:'Kannapolis Racing',         color:'#B6BABD', tier:'backmarker', pace:74, reliability:76, budget:75,
    drivers:[ {name:'N. Hulkenbo', abbr:'HUL', skill:80, consistency:82}, {name:'O. Bearmano', abbr:'BEA', skill:75, consistency:73} ] },
  { id:'sau', abbr:'SAU', name:'Hinwil Motorsport',         color:'#52E252', tier:'backmarker', pace:71, reliability:73, budget:65,
    drivers:[ {name:'V. Bottaso', abbr:'BOT', skill:79, consistency:80}, {name:'G. Zhoulin', abbr:'ZHO', skill:74, consistency:75} ] },
];

const TIER_OBJECTIVES = {
  title:      { label:'Win both championships',        conText:1, drvText:1 },
  contender:  { label:'Best of the rest — beat all midfield/backmarker teams', conText:5, drvText:5 },
  midfield:   { label:'Finish top 7 in constructors',   conText:7, drvText:8 },
  backmarker: { label:'Score points and avoid last place', conText:9, drvText:12 },
};

// Tracks with real-world weather/temp character.
// tempC = typical air temp, trackTempC = typical asphalt temp, windKmh, rainChance (0-1),
// rainState: 'dry' | 'wet-drying' | 'dry-threat' (rain may arrive)
const TRACKS = [
  { id:'bhr', name:'Sakhir Circuit', country:'Bahrain', laps:57, tempC:31, trackTempC:44, windKmh:18, rainChance:0.02, character:'hot, abrasive, high tyre deg', baseline:'dry' },
  { id:'jed', name:'Corniche Circuit', country:'Saudi Arabia', laps:50, tempC:29, trackTempC:38, windKmh:12, rainChance:0.0, character:'hot night race, low deg, high speed', baseline:'dry' },
  { id:'mel', name:'Albert Park', country:'Australia', laps:58, tempC:22, trackTempC:31, windKmh:22, rainChance:0.25, character:'mild, gusty winds', baseline:'dry' },
  { id:'suz', name:'Suzuka Circuit', country:'Japan', laps:53, tempC:19, trackTempC:27, windKmh:15, rainChance:0.35, character:'cool, technical, changeable', baseline:'dry' },
  { id:'sha', name:'Shanghai Circuit', country:'China', laps:56, tempC:18, trackTempC:24, windKmh:14, rainChance:0.3, character:'overcast, moderate deg', baseline:'dry' },
  { id:'mia', name:'Miami Circuit', country:'USA', laps:57, tempC:30, trackTempC:47, windKmh:16, rainChance:0.15, character:'hot and humid, bumpy', baseline:'dry' },
  { id:'imo', name:'Imola Circuit', country:'Italy', laps:63, tempC:20, trackTempC:29, windKmh:10, rainChance:0.45, character:'European spring, rain risk building', baseline:'dry-threat' },
  { id:'mon', name:'Monte Carlo', country:'Monaco', laps:78, tempC:21, trackTempC:32, windKmh:8, rainChance:0.4, character:'street circuit, low deg, high SC chance', baseline:'dry-threat' },
  { id:'can', name:'Île Circuit', country:'Canada', laps:70, tempC:20, trackTempC:28, windKmh:14, rainChance:0.3, character:'wall-lined, high SC/VSC chance', baseline:'dry' },
  { id:'sil', name:'Silverstone Circuit', country:'Great Britain', laps:52, tempC:17, trackTempC:23, windKmh:24, rainChance:0.55, character:'classic British weather, starts wet drying out', baseline:'wet-drying' },
  { id:'hun', name:'Hungaroring', country:'Hungary', laps:70, tempC:29, trackTempC:42, windKmh:9, rainChance:0.2, character:'hot, twisty, high tyre wear', baseline:'dry' },
  { id:'spa', name:'Circuit de Wallonie', country:'Belgium', laps:44, tempC:16, trackTempC:22, windKmh:20, rainChance:0.6, character:'microclimates, rain forecast building through race', baseline:'dry-threat' },
  { id:'zan', name:'Zandvoort Circuit', country:'Netherlands', laps:72, tempC:17, trackTempC:24, windKmh:26, rainChance:0.4, character:'coastal wind, banked corners', baseline:'dry' },
  { id:'mnz', name:'Autodromo Nazionale', country:'Italy', laps:53, tempC:24, trackTempC:33, windKmh:12, rainChance:0.2, character:'low downforce, low deg', baseline:'dry' },
  { id:'bak', name:'City Circuit', country:'Azerbaijan', laps:51, tempC:25, trackTempC:34, windKmh:19, rainChance:0.1, character:'street circuit, walls, high SC chance', baseline:'dry' },
  { id:'sin', name:'Marina Bay Circuit', country:'Singapore', laps:62, tempC:30, trackTempC:34, windKmh:6, rainChance:0.5, character:'humid night race, tropical downpour risk', baseline:'dry-threat' },
  { id:'aus', name:'Red Bull Ring', country:'Austria', laps:71, tempC:23, trackTempC:34, windKmh:11, rainChance:0.3, character:'short lap, high SC frequency', baseline:'dry' },
  { id:'cota', name:'Circuit of the Americas', country:'USA', laps:56, tempC:26, trackTempC:36, windKmh:15, rainChance:0.25, character:'undulating, moderate deg', baseline:'dry' },
  { id:'mex', name:'Rodríguez Circuit', country:'Mexico', laps:71, tempC:20, trackTempC:28, windKmh:9, rainChance:0.15, character:'high altitude, low downforce load', baseline:'dry' },
  { id:'sao', name:'Interlagos', country:'Brazil', laps:71, tempC:24, trackTempC:31, windKmh:13, rainChance:0.5, character:'unpredictable weather, rain common', baseline:'dry-threat' },
  { id:'lv',  name:'Las Vegas Strip Circuit', country:'USA', laps:50, tempC:11, trackTempC:14, windKmh:17, rainChance:0.05, character:'cold desert night, tyres struggle to warm', baseline:'dry' },
  { id:'qat', name:'Lusail Circuit', country:'Qatar', laps:57, tempC:27, trackTempC:36, windKmh:20, rainChance:0.02, character:'hot, windy, high-speed, high deg', baseline:'dry' },
  { id:'abu', name:'Yas Marina Circuit', country:'Abu Dhabi', laps:58, tempC:27, trackTempC:33, windKmh:13, rainChance:0.02, character:'day-to-night, low deg', baseline:'dry' },
];

// Tyre compounds. gripBase 0-100, degRate per-lap wear at reference temp, tempWindow describes optimal trackTempC range.
const COMPOUNDS = {
  S: { name:'Soft',      code:'S', gripBase:100, degRate:2.6, tempMin:20, tempMax:50 },
  M: { name:'Medium',    code:'M', gripBase:95,  degRate:1.7, tempMin:15, tempMax:45 },
  H: { name:'Hard',      code:'H', gripBase:90,  degRate:1.1, tempMin:15, tempMax:50 },
  I: { name:'Intermediate', code:'I', gripBase:80, degRate:1.4, tempMin:5, tempMax:30, wet:true },
  W: { name:'Wet',       code:'W', gripBase:70, degRate:1.0, tempMin:0, tempMax:25, wet:true },
};

// Engineer candidate pool — generated fresh but drawn from these name/flavor seeds.
const ENGINEER_FIRST = ['Marco','Elena','Kofi','Priya','Sven','Hana','Diego','Freya','Tariq','Naledi','Lars','Yuki','Ana','Bram','Chidi','Ines','Otto','Mei','Rowan','Sanjay'];
const ENGINEER_LAST = ['Bianchi','Novak','Adeyemi','Mehta','Larsen','Tanaka','Reyes','Nilsson','Haddad','Dlamini','Voss','Kobayashi','Marchetti','de Groot','Okafor','Moreau','Schulz','Lindqvist','Petrov','Castillo'];
const ENGINEER_ROLES = [
  { key:'aero', label:'Aerodynamicist', affects:'pace' },
  { key:'reliability', label:'Reliability Engineer', affects:'reliability' },
  { key:'strategist', label:'Race Strategist', affects:'strategy' },
  { key:'perf', label:'Performance Engineer', affects:'pace' },
];
 
