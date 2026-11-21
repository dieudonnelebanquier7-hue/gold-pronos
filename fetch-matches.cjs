'use strict';
const fs=require('node:fs');
let leagues=[
 ['eng.1','Angleterre · Premier League'],['eng.2','Angleterre · Championship'],['eng.3','Angleterre · League One'],['eng.4','Angleterre · League Two'],
 ['esp.1','Espagne · LaLiga'],['esp.2','Espagne · Segunda'],
 ['ger.1','Allemagne · Bundesliga'],['ger.2','Allemagne · 2. Bundesliga'],['ger.3','Allemagne · 3. Liga'],['ita.1','Italie · Serie A'],['fra.1','France · Ligue 1'],['ita.2','Italie · Serie B'],['fra.2','France · Ligue 2'],['por.2','Portugal · Liga Portugal 2'],['ned.2','Pays-Bas · Eerste Divisie'],
 ['ned.1','Pays-Bas · Eredivisie'],['por.1','Portugal · Liga'],['tur.1','Turquie · Süper Lig'],
 ['nor.1','Norvège · Eliteserien'],['swe.1','Suède · Allsvenskan'],['sui.1','Suisse · Super League'],
 ['ksa.1','Arabie saoudite · Pro League'],['cze.1','Tchéquie · First League'],['usa.1','États-Unis · MLS'],
 ['rou.1','Roumanie · Liga I'],['rus.1','Russie · Premier League'],['chn.1','Chine · Super League'],
 ['jpn.1','Japon · J1 League'],['bra.1','Brésil · Série A'],['arg.1','Argentine · Liga Profesional'],
 ['mex.1','Mexique · Liga MX'],['bra.2','Brésil · Série B'],['arg.2','Argentine · Primera Nacional'],['bel.2','Belgique · Challenger Pro League'],['sco.2','Écosse · Championship'],['tur.2','Turquie · 1. Lig'],['ksa.2','Arabie saoudite · First Division'],['uefa.champions','UEFA · Ligue des champions'],
 ['uefa.europa','UEFA · Ligue Europa'],['uefa.europa.conf','UEFA · Ligue Conférence'],
 ['afc.champions','AFC · Ligue des champions'],['fifa.world','FIFA · Coupe du monde masculine'],
 ['fifa.worldq.uefa','FIFA · Qualifications Coupe du monde UEFA'],['fifa.worldq.conmebol','FIFA · Qualifications Coupe du monde CONMEBOL'],['fifa.worldq.concacaf','FIFA · Qualifications Coupe du monde CONCACAF'],['fifa.worldq.afc','FIFA · Qualifications Coupe du monde AFC'],['fifa.worldq.caf','FIFA · Qualifications Coupe du monde CAF'],['fifa.worldq.ofc','FIFA · Qualifications Coupe du monde OFC'],
 ['fifa.friendly','FIFA · Matchs amicaux masculins'],['uefa.euro','UEFA · Championnat d’Europe'],['uefa.nations','UEFA · Ligue des nations'],['conmebol.copa','CONMEBOL · Copa América'],['concacaf.gold','CONCACAF · Gold Cup'],['afc.asian','AFC · Coupe d’Asie'],['caf.nations','CAF · Coupe d’Afrique des nations'],['uefa.wchampions','UEFA · Ligue des championnes'],
 ['usa.nwsl','États-Unis · NWSL féminine'],
 ['usa.w.usl.1','États-Unis · USL Super League féminine'],
 ['eng.w.1','Angleterre · Women’s Super League'],
 ['esp.w.1','Espagne · Liga F féminine'],
 ['ger.w.1','Allemagne · Frauen-Bundesliga'],
 ['fra.w.1','France · Première Ligue féminine'],
 ['ita.w.1','Italie · Serie A féminine'],
 ['ned.w.1','Pays-Bas · Eredivisie féminine'],
 ['mex.w.1','Mexique · Liga MX féminine'],
 ['fifa.wwc','FIFA · Coupe du monde féminine'],
 ['fifa.friendly.w','FIFA · Matchs amicaux féminins'],
 ['conmebol.america.femenina','CONMEBOL · Copa América féminine'],
 ['fifa.world.u20','FIFA · Coupe du monde U20 masculine'],
 ['fifa.world.u17','FIFA · Coupe du monde U17 masculine'],
 ['fifa.wworld.u17','FIFA · Coupe du monde U17 féminine'],
 ['uefa.u21','UEFA · Compétitions U21'],
 ['uefa.youthleague','UEFA · Youth League']
];
leagues=[...new Map(leagues.map(item=>[item[0],item])).values()];
if(leagues.some(item=>!Array.isArray(item)||item.length!==2||!item[0]||!item[1]))throw new Error('Catalogue des compétitions invalide : chaque entrée doit contenir un code et un libellé.');
const today=new Date();today.setUTCHours(0,0,0,0);
const from=new Date(today);from.setUTCDate(from.getUTCDate()-30);
const historyFrom=new Date(today);historyFrom.setUTCDate(historyFrom.getUTCDate()-365);
const sportScoreHistoryFrom=new Date(today);sportScoreHistoryFrom.setUTCDate(sportScoreHistoryFrom.getUTCDate()-365);
const to=new Date(today);to.setUTCDate(to.getUTCDate()+14);
const ymd=d=>d.toISOString().slice(0,10).replace(/-/g,'');
function validTeamName(value){
 const name=String(value||'').trim();
 if(name.length<2||/^(?:tbd|unknown|to be announced|to be determined|équipe domicile|équipe extérieure)$/i.test(name))return false;
 // Certaines réponses SportScore contiennent des identifiants générés présentés à tort comme des noms de clubs.
 if(/^team\\s+[a-z0-9]{10,}$/i.test(name))return false;
 return true;
}
function teamLogo(team){
 const logos=Array.isArray(team?.logos)?team.logos:[];
 const item=logos.find(x=>x?.href&&(/default|full|primary/i.test((x.rel||[]).join(' '))||!x.rel))||logos.find(x=>x?.href);
 const url=item?.href||team?.logo||team?.crest||'';
 try{const parsed=new URL(url);return parsed.protocol==='https:'?parsed.href:''}catch(_){return ''}
}
async function fetchLeague(league,day){
 const [code,label]=league;
 const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+code+'/scoreboard?dates='+day+'&limit=1000&region=fr&lang=fr';
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'GOLD-PRONOS/1.0'}});
   if(!response.ok){if(response.status===400||response.status===403||response.status===404)return [];throw Error('HTTP '+response.status)}
   const data=await response.json();
   return (data.events||[]).map(event=>{
    const comp=event.competitions?.[0],teams=comp?.competitors||[];
    const home=teams.find(t=>t.homeAway==='home')||teams[0],away=teams.find(t=>t.homeAway==='away')||teams[1];
    if(!home||!away||!event.date)return null;
    const st=comp?.status?.type||event.status?.type||{},state=st.state;
    return {id:'espn-'+event.id,utcDate:event.date,status:st.completed||state==='post'?'FINISHED':state==='in'?'IN_PLAY':'SCHEDULED',
     competition:{name:label,code:'ESPN-'+code},
     homeTeam:{id:String(home.team?.id||home.id||''),name:home.team?.displayName||home.team?.name||'Équipe domicile',abbreviation:home.team?.abbreviation||home.team?.shortDisplayName||'',country:{name:home.team?.location||home.team?.displayName||home.team?.name||'',code:home.team?.abbreviation||''},logo:teamLogo(home.team)},
     awayTeam:{id:String(away.team?.id||away.id||''),name:away.team?.displayName||away.team?.name||'Équipe extérieure',abbreviation:away.team?.abbreviation||away.team?.shortDisplayName||'',country:{name:away.team?.location||away.team?.displayName||away.team?.name||'',code:away.team?.abbreviation||''},logo:teamLogo(away.team)},
     score:{fullTime:{home:home.score==null||String(home.score).trim()===''?null:Number(home.score),away:away.score==null||String(away.score).trim()===''?null:Number(away.score)}},source:'ESPN',providers:['ESPN']};
   }).filter(Boolean);
  }catch(e){if(attempt===1)console.log('Source indisponible '+code+': '+e.message)}
 }
 return [];
}


async function fetchOpenLigaSeason(shortcut,season){
 const url='https://api.openligadb.de/getmatchdata/'+encodeURIComponent(shortcut)+'/'+encodeURIComponent(String(season));
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'GOLD-PRONOS/1.0'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const rows=await response.json();
  if(!Array.isArray(rows))return [];
  return rows.map(row=>{
   const home=row.team1||{},away=row.team2||{},date=Date.parse(row.matchDateTimeUTC||row.matchDateTime||'');
   const results=Array.isArray(row.matchResults)?row.matchResults:[];
   const finalResult=results.find(x=>Number(x.resultTypeID)===2||String(x.resultName||'').toLowerCase().includes('endergebnis')||String(x.resultTypeKind||'').toLowerCase()==='after90minutes');
   if(!row.matchIsFinished||!Number.isFinite(date)||!home.teamName||!away.teamName||!finalResult)return null;
   const hs=Number(finalResult.pointsTeam1),as=Number(finalResult.pointsTeam2);
   if(!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0)return null;
   return {id:'openligadb-'+String(row.matchID||row.matchId||shortcut+'-'+season+'-'+date),utcDate:new Date(date).toISOString(),status:'FINISHED',
    competition:{name:String(row.leagueName||shortcut.toUpperCase()),code:'openligadb:'+shortcut},
    homeTeam:{id:String(home.teamId||''),name:String(home.teamName),abbreviation:String(home.shortName||home.tla||''),country:{name:'Allemagne',code:'DE'},logo:home.teamIconUrl||''},
    awayTeam:{id:String(away.teamId||''),name:String(away.teamName),abbreviation:String(away.shortName||away.tla||''),country:{name:'Allemagne',code:'DE'},logo:away.teamIconUrl||''},
    score:{fullTime:{home:hs,away:as}},source:'OpenLigaDB',providers:['OpenLigaDB']};
  }).filter(Boolean);
 }catch(error){console.log('OpenLigaDB indisponible '+shortcut+'/'+season+': '+(error?.message||error));return [];}
}
async function fetchOpenLigaHistory(){
 const year=new Date().getUTCFullYear(),tasks=[];
 for(const shortcut of ['bl1','bl2','bl3','dfb'])for(const season of [year,year-1])tasks.push({shortcut,season});
 const results=new Array(tasks.length);let cursor=0;
 const workers=Array.from({length:3},async()=>{while(true){const i=cursor++;if(i>=tasks.length)break;const t=tasks[i];results[i]=await fetchOpenLigaSeason(t.shortcut,t.season);}});
 await Promise.all(workers);
 return results.flat();
}
const NATIONAL_CONFEDERATION_COUNTRIES={
 uefa:'albania andorra armenia austria azerbaijan belarus belgium bosnia and herzegovina bulgaria croatia cyprus czech republic czechia denmark england estonia faroe islands finland france georgia germany gibraltar greece hungary iceland israel italy kazakhstan kosovo latvia liechtenstein lithuania luxembourg malta moldova montenegro netherlands north macedonia northern ireland norway poland portugal republic of ireland romania russia san marino scotland serbia slovakia slovenia spain sweden switzerland turkey ukraine wales',
 caf:'algeria angola benin botswana burkina faso burundi cameroon cape verde central african republic chad comoros congo dr congo democratic republic of the congo ivory coast cote d ivoire cote divoire djibouti egypt equatorial guinea eritrea eswatini ethiopia gabon gambia ghana guinea guinea bissau kenya lesotho liberia libya madagascar malawi mali mauritania mauritius morocco mozambique namibia niger nigeria rwanda sao tome senegal seychelles sierra leone somalia south africa south sudan sudan tanzania togo tunisia uganda zambia zimbabwe',
 conmebol:'argentina bolivia brazil brasil chile colombia ecuador paraguay peru uruguay venezuela',
 concacaf:'antigua and barbuda aruba bahamas barbados belize bermuda british virgin islands canada cayman islands costa rica cuba curacao dominica dominican republic el salvador grenada guatemala guyana haiti honduras jamaica mexico montserrat nicaragua panama puerto rico saint kitts and nevis saint lucia saint vincent and the grenadines suriname trinidad and tobago united states usa',
 afc:'afghanistan australia bahrain bangladesh bhutan brunei cambodia china chinese taipei guam hong kong india indonesia iran iraq japan jordan kuwait kyrgyzstan laos lebanon macau malaysia maldives mongolia myanmar nepal north korea oman pakistan palestine philippines qatar saudi arabia singapore south korea sri lanka syria tajikistan thailand timor leste turkmenistan united arab emirates uae uzbekistan vietnam yemen',
 ofc:'american samoa cook islands fiji new caledonia new zealand papua new guinea samoa solomon islands tahiti tonga vanuatu'
};
function nationalHistoryCodes(team){
 const value=String(team?.code||'').replace(/^ESPN-/,'').toLowerCase();
 if(value.includes('uefa'))return ['uefa.nations','fifa.worldq.uefa','fifa.friendly','uefa.euro','fifa.world'];
 if(value.includes('caf'))return ['caf.nations','fifa.worldq.caf','fifa.friendly','fifa.world'];
 if(value.includes('conmebol'))return ['conmebol.copa','fifa.worldq.conmebol','fifa.friendly','fifa.world'];
 if(value.includes('concacaf'))return ['concacaf.gold','fifa.worldq.concacaf','fifa.friendly','fifa.world'];
 if(value.includes('afc'))return ['afc.asian','fifa.worldq.afc','fifa.friendly','fifa.world'];
 if(value.includes('ofc'))return ['fifa.worldq.ofc','fifa.friendly','fifa.world'];
 const name=String(team?.name||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\\s+/g,' ').trim();
 for(const [confed,countries] of Object.entries(NATIONAL_CONFEDERATION_COUNTRIES)){
  if((' '+countries+' ').includes(' '+name+' ')){
   if(confed==='uefa')return ['uefa.nations','fifa.worldq.uefa','fifa.friendly','uefa.euro','fifa.world'];
   if(confed==='caf')return ['caf.nations','fifa.worldq.caf','fifa.friendly','fifa.world'];
   if(confed==='conmebol')return ['conmebol.copa','fifa.worldq.conmebol','fifa.friendly','fifa.world'];
   if(confed==='concacaf')return ['concacaf.gold','fifa.worldq.concacaf','fifa.friendly','fifa.world'];
   if(confed==='afc')return ['afc.asian','fifa.worldq.afc','fifa.friendly','fifa.world'];
   return ['fifa.worldq.ofc','fifa.friendly','fifa.world'];
  }
 }
 return [value,'fifa.friendly','fifa.world'];
}
async function fetchEspnNationalTeamHistory(team){
 const codes=[...new Set(nationalHistoryCodes(team))],year=new Date().getUTCFullYear(),requests=[];
 for(const code of codes){const seasons=code===String(team.code).replace(/^ESPN-/,'')?[year,year-1]:[year];for(const season of seasons)requests.push({code,season});}
 const results=await Promise.allSettled(requests.map(async request=>{
  const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+request.code+'/teams/'+encodeURIComponent(team.id)+'/schedule?season='+request.season+'&region=fr&lang=fr';
  const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'GOLD-PRONOS/1.0'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const payload=await response.json();
  return (payload.events||payload.items||[]).map(event=>({event,code:request.code}));
 }));
 const byId=new Map();
 for(const result of results)if(result.status==='fulfilled')for(const item of result.value){const id=String(item.event?.id||item.event?.uid||'');if(id&&!byId.has(id))byId.set(id,item);}
 const matches=[...byId.values()].map(({event,code})=>{
  const comp=event.competitions?.[0]||{},competitors=comp.competitors||[],home=competitors.find(x=>x.homeAway==='home')||competitors[0],away=competitors.find(x=>x.homeAway==='away')||competitors[1];
  const status=comp.status?.type||event.status?.type||{},state=status.state;
  if(!home||!away||!(status.completed||state==='post'))return null;
  const hs=home.score===null||home.score===undefined||home.score===''?NaN:Number(home.score),as=away.score===null||away.score===undefined||away.score===''?NaN:Number(away.score),date=Date.parse(event.date||'');
  if(!Number.isFinite(date)||date>=Date.now()||!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0)return null;
  const homeTeam=home.team||{},awayTeam=away.team||{};
  return {id:'espn-'+String(event.id||event.uid),utcDate:new Date(date).toISOString(),status:'FINISHED',
   competition:{name:String(comp.name||event.name||code),code:'ESPN-'+code},
   homeTeam:{id:String(homeTeam.id||home.id||''),name:String(homeTeam.displayName||homeTeam.name||''),abbreviation:String(homeTeam.abbreviation||''),country:{name:String(homeTeam.location||''),code:''},logo:''},
   awayTeam:{id:String(awayTeam.id||away.id||''),name:String(awayTeam.displayName||awayTeam.name||''),abbreviation:String(awayTeam.abbreviation||''),country:{name:String(awayTeam.location||''),code:''},logo:''},
   score:{fullTime:{home:hs,away:as}},source:'ESPN',providers:['ESPN']};
 }).filter(Boolean);
 return {matches,requests:requests.length};
}
async function fetchEspnNationalHistories(teams){
 const unique=[...teams.values()].filter(x=>x.id).slice(0,100),results=new Array(unique.length);let cursor=0,completed=0;
 const workers=Array.from({length:4},async()=>{while(true){const i=cursor++;if(i>=unique.length)break;try{results[i]=await fetchEspnNationalTeamHistory(unique[i]);}catch(error){console.log('Historique national ESPN indisponible '+unique[i].name+': '+(error?.message||error));const codes=[...new Set(nationalHistoryCodes(unique[i]))];results[i]={matches:[],requests:codes.reduce((sum,code)=>sum+(code===String(unique[i].code).replace(/^ESPN-/,'')?2:1),0)};}completed++;if(completed%10===0||completed===unique.length)console.log('Historiques ESPN des sélections '+completed+'/'+unique.length);}});
 await Promise.all(workers);
 return {matches:results.flatMap(x=>x?.matches||[]),requests:results.reduce((sum,x)=>sum+Number(x?.requests||0),0),teams:unique.length};
}

async function fetchSportScoreDay(day){
 const date=day.slice(0,4)+'-'+day.slice(4,6)+'-'+day.slice(6,8);
 const url='https://sportscore.com/api/v1/fixtures/?sport=football&date='+date+'&limit=200&src=gold-pronos';
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'GOLD-PRONOS/1.0'}});
  if(!response.ok){console.log('SportScore indisponible '+date+': HTTP '+response.status);return [];}
  const data=await response.json();
  const rows=Array.isArray(data.matches)?data.matches:Array.isArray(data.fixtures)?data.fixtures:Array.isArray(data.events)?data.events:Array.isArray(data.data)?data.data:[];
  return rows.map(row=>{
   const home=String(typeof row.home==='string'?row.home:row.home?.name||row.home_team?.name||row.teams?.home?.name||'').trim();
   const away=String(typeof row.away==='string'?row.away:row.away?.name||row.away_team?.name||row.teams?.away?.name||'').trim();
   const kickoff=row.time||row.date||row.utcDate||row.kickoff||row.fixture?.date||'';
   const timestamp=Date.parse(kickoff);
   if(!validTeamName(home)||!validTeamName(away)||!Number.isFinite(timestamp))return null;
   const rawStatus=String(row.status?.short||row.status?.type||row.status||row.status_text||'').toLowerCase();
   const status=/live|in.?play|in.?progress|playing|1st half|2nd half|half.?time|extra time|penalt/.test(rawStatus)?'IN_PLAY':/finish|full.?time|ended|^ft$|^aet$|^pen$/.test(rawStatus)?'FINISHED':'SCHEDULED';
   const score=value=>value===null||value===undefined||value===''?null:Number(value);
   const competition=String(typeof row.competition==='string'?row.competition:row.competition?.name||row.competition_name||row.league?.name||row.tournament?.name||'Compétitions internationales');
   const slug=String(row.slug||row.id||date+'-'+home+'-'+away).slice(0,180);
   return {
    id:'sportscore-'+slug,utcDate:new Date(timestamp).toISOString(),status,
    competition:{name:competition,code:'sportscore:'+String(row.competition_slug||row.competition?.slug||row.league?.slug||competition.toLowerCase().replace(/[^a-z0-9]+/g,'-'))},
    homeTeam:{id:'',name:home,abbreviation:'',country:{name:'',code:''},logo:row.home_logo||row.teams?.home?.logo||''},
    awayTeam:{id:'',name:away,abbreviation:'',country:{name:'',code:''},logo:row.away_logo||row.teams?.away?.logo||''},
    score:{fullTime:{home:score(row.home_score??row.score?.home??row.scores?.home),away:score(row.away_score??row.score?.away??row.scores?.away)}},
    source:'SportScore',providers:['SportScore'],sportScoreSlug:String(row.slug||'')
   };
  }).filter(Boolean);
 }catch(error){console.log('SportScore indisponible '+date+': '+(error?.message||error));return [];}
}

const dates=[];
for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1))dates.push(ymd(d));
const historyExtraDates=[];
for(let d=new Date(sportScoreHistoryFrom);d<from;d.setUTCDate(d.getUTCDate()+1))historyExtraDates.push(ymd(d));
async function discoverEspnLeagues(){
 try{
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer',{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'GOLD-PRONOS/1.0'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json(),found=[];
  const walk=(value,depth=0)=>{
   if(!value||depth>5)return;
   if(Array.isArray(value)){value.forEach(x=>walk(x,depth+1));return}
   if(typeof value!=='object')return;
   const slug=String(value.slug||value.abbreviation||value.shortName||'').trim();
   const name=String(value.name||value.displayName||value.shortName||'').trim();
   const country=String(value.country?.name||value.countryName||value.location||'').trim();
   if(slug&&name&&/^[a-z0-9]+(?:\.[a-z0-9]+){1,3}$/i.test(slug)&&slug.toLowerCase()!=='soccer')found.push([slug,(country?country+' · ':'')+name]);
   for(const [key,item] of Object.entries(value))if(item&&typeof item==='object'&&key!=='logos')walk(item,depth+1);
  };
  walk(data);
  const merged=new Map(leagues.map(x=>[x[0],x]));
  for(const item of found)if(!merged.has(item[0]))merged.set(item[0],item);
  // Garde les compétitions prioritaires, puis ajoute un échantillon mondial découvert.
  // Cette limite évite une explosion du nombre de requêtes sur la source publique.
  leagues=[...merged.values()].slice(0,150);
  console.log('Répertoire ESPN : '+found.length+' compétitions découvertes, '+leagues.length+' retenues (maximum 150).');
 }catch(error){console.log('Répertoire ESPN indisponible, catalogue prioritaire conservé : '+error.message)}
}
(async()=>{
 await discoverEspnLeagues();
 // ESPN sert de source de contrôle pour les rencontres du jour. SportScore fournit le calendrier mondial sur toute la fenêtre.
 // Le calendrier préchargé doit couvrir les 14 prochains jours, pas seulement aujourd’hui.
 // Les 30 jours passés restent collectés par SportScore ; ESPN complète les rencontres à venir.
 // Les 15 jours de calendrier restent prioritaires ; le budget restant sert aux historiques
 // ESPN des sélections nationales, identifiés par leurs ID d'équipe.
 const espnHistoryDays=0;
 const espnDates=dates.filter(day=>day>=ymd(today)&&day<=ymd(to));
 const tasks=leagues.flatMap(league=>espnDates.map(day=>({league,day})));
 console.log('Collecte ESPN : 15 jour(s) de calendrier, '+tasks.length+' requêtes ; budget historique réservé aux sélections.');
 const results=new Array(tasks.length);let cursor=0,completed=0,nonEmpty=0;
 const workers=Array.from({length:10},async()=>{while(true){
  const i=cursor++;if(i>=tasks.length)break;
  const task=tasks[i];results[i]=await fetchLeague(task.league,task.day);
  if(results[i].length)nonEmpty++;
  completed++;
  if(completed%100===0||completed===tasks.length)console.log('Collecte '+completed+'/'+tasks.length+' · '+nonEmpty+' journées avec rencontres');
 }});
 await Promise.all(workers);
 const competitionCoverageMap=new Map(leagues.map(([code,label])=>[code,{code,label,daysRequested:0,daysWithMatches:0,fixtures:0}]));
 for(let i=0;i<tasks.length;i++){
  const item=tasks[i],entry=competitionCoverageMap.get(item.league[0]),rows=Array.isArray(results[i])?results[i]:[];
  if(!entry)continue;
  entry.daysRequested++;entry.fixtures+=rows.length;if(rows.length)entry.daysWithMatches++;
 }
 const competitionCoverage=[...competitionCoverageMap.values()];
 const espnMatches=results.flat();
 // SportScore complète le calendrier mondial, sans remplacer les scores ESPN.
 // Trois requêtes simultanées restent largement sous la limite publique annoncée.
 const sportDates=dates;
 const sportResults=new Array(sportDates.length);let sportCursor=0;
 const sportWorkers=Array.from({length:3},async()=>{while(true){const i=sportCursor++;if(i>=sportDates.length)break;sportResults[i]=await fetchSportScoreDay(sportDates[i]);}});
 await Promise.all(sportWorkers);
 const sportMatches=sportResults.flat();
 // Archive complémentaire sur 365 jours : seules les dernières rencontres vérifiées
 // des équipes ayant un match à venir seront conservées dans history.json.
 const historyExtraResults=new Array(historyExtraDates.length);let historyCursor=0,historyCompleted=0;
 const historyWorkers=Array.from({length:1},async()=>{while(true){
  const i=historyCursor++;if(i>=historyExtraDates.length)break;
  historyExtraResults[i]=await fetchSportScoreDay(historyExtraDates[i]);historyCompleted++;
  // SportScore répond fréquemment HTTP 429 lorsque l'archive quotidienne est aspirée trop vite.
  // Un débit inférieur à 60 requêtes/minute évite de perdre presque tout l'historique.
  if(i<historyExtraDates.length-1)await new Promise(resolve=>setTimeout(resolve,1100));
  if(historyCompleted%50===0||historyCompleted===historyExtraDates.length)console.log('Historique SportScore '+historyCompleted+'/'+historyExtraDates.length+' journées collectées');
 }});
 await Promise.all(historyWorkers);
 const historyExtraMatches=historyExtraResults.flat();
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const combined=[...espnMatches];
 for(const item of sportMatches){
  const home=normalize(item.homeTeam.name),away=normalize(item.awayTeam.name),time=Date.parse(item.utcDate);
  const duplicate=combined.find(existing=>normalize(existing.homeTeam?.name)===home&&normalize(existing.awayTeam?.name)===away&&Math.abs(Date.parse(existing.utcDate)-time)<=6*60*60*1000);
  if(duplicate){
    const a=duplicate.score?.fullTime,b=item.score?.fullTime;
    if(a?.home!==null&&a?.home!==undefined&&a?.away!==null&&a?.away!==undefined&&b?.home!==null&&b?.home!==undefined&&b?.away!==null&&b?.away!==undefined&&
       (Number(a.home)!==Number(b.home)||Number(a.away)!==Number(b.away)))duplicate.scoreConflict=true;
    duplicate.providers=[...new Set([...(duplicate.providers||['ESPN']),'SportScore'])];
   }
  else combined.push(item);
 }
 const unique=new Map(combined.map(m=>[m.id,m]));
 const matches=[...unique.values()].sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
 if(!matches.length)throw new Error('Aucune rencontre reçue après '+tasks.length+' requêtes ESPN et '+dates.length+' requêtes SportScore. Le calendrier existant ne sera pas remplacé.');
 const now=Date.now(),futureLimit=now+14*86400000,upcomingTeams=new Set(),upcomingIdentityById=new Map(),nationalUpcomingNames=new Set(),nationalUpcomingTeams=new Map();
 const isNationalCode=code=>/^(?:fifa\.|uefa\.(?:euro|nations|u21)|conmebol\.(?:copa|america\.femenina)|concacaf\.gold|afc\.asian|caf\.nations)/i.test(String(code||''));
 const isNationalFixture=m=>{
  const code=String(m.competition?.code||'').replace(/^ESPN-/,'');
  const name=String(m.competition?.name||'');
  if(/\bclub\b|\bcwc\b/i.test(code+' '+name))return false;
  return isNationalCode(code)||/national team|international|world cup|coupe du monde|qualif|nations league|ligue des nations|copa america|copa am[eé]rica|africa cup|coupe d.?afrique|gold cup|asian cup|championnat d.?europe|euro 20|women.?s world cup|friendlies?/i.test(name);
 };
 for(const m of matches){
  const kickoff=Date.parse(m.utcDate);if(m.status!=='SCHEDULED'||!Number.isFinite(kickoff)||kickoff<=now||kickoff>futureLimit)continue;
  const national=isNationalFixture(m);
  for(const side of ['home','away']){
   const team=m[side+'Team'],name=team?.name,key=normalize(name);if(!validTeamName(name))continue;
   upcomingTeams.add(key);if(team?.id)upcomingIdentityById.set(String(team.id),key);
   if(national){nationalUpcomingNames.add(key);if(team?.id&&!nationalUpcomingTeams.has(String(team.id)))nationalUpcomingTeams.set(String(team.id),{id:String(team.id),name:String(name),code:String(m.competition?.code||'').replace(/^ESPN-/,'')});}
  }
 }
 const [espnNationalHistoryResult,openLigaHistory]=await Promise.all([fetchEspnNationalHistories(nationalUpcomingTeams),fetchOpenLigaHistory()]);
 const espnNationalHistory=espnNationalHistoryResult.matches,historyScheduleRequests=espnNationalHistoryResult.requests;
 console.log('Sources historiques complémentaires : ESPN sélections '+espnNationalHistory.length+' résultats · '+historyScheduleRequests+' requêtes de calendrier pour '+espnNationalHistoryResult.teams+' sélections · OpenLigaDB '+openLigaHistory.length+' résultats.');
 const canonicalTeamKey=team=>{const name=normalize(team?.name);return upcomingTeams.has(name)?name:upcomingIdentityById.get(String(team?.id||''))||name;};
 const historyCandidatesByKey=new Map(),historyConflicts=new Set();
 for(const m of [...matches,...historyExtraMatches,...espnNationalHistory,...openLigaHistory]){
  const kickoff=Date.parse(m.utcDate),home=canonicalTeamKey(m.homeTeam),away=canonicalTeamKey(m.awayTeam);
  const homeScore=m.score?.fullTime?.home,awayScore=m.score?.fullTime?.away;
  if(m.status!=='FINISHED'||m.scoreConflict||!Number.isFinite(kickoff)||kickoff>=now||kickoff<historyFrom.getTime()||
     !home||!away||homeScore===null||homeScore===undefined||awayScore===null||awayScore===undefined||
     !Number.isInteger(Number(homeScore))||!Number.isInteger(Number(awayScore))||Number(homeScore)<0||Number(awayScore)<0)continue;
  const key=home+'|'+away+'|'+Math.round(kickoff/(6*60*60*1000)),previous=historyCandidatesByKey.get(key);
  if(historyConflicts.has(key))continue;
  if(previous){
   const sameScore=Number(previous.score.fullTime.home)===Number(homeScore)&&Number(previous.score.fullTime.away)===Number(awayScore);
   if(!sameScore){historyCandidatesByKey.delete(key);historyConflicts.add(key);continue;}
   const preferred=m.source==='ESPN'&&previous.source!=='ESPN'?m:previous;
   preferred.providers=[...new Set([...(previous.providers||[previous.source]),...(m.providers||[m.source])].filter(Boolean))];
   historyCandidatesByKey.set(key,preferred);
  }else historyCandidatesByKey.set(key,m);
 }
 const candidates=[...historyCandidatesByKey.values()];
 const byTeam=new Map();
 for(const m of candidates){for(const side of ['home','away']){const key=canonicalTeamKey(m[side+'Team']);if(!upcomingTeams.has(key))continue;if(!byTeam.has(key))byTeam.set(key,[]);byTeam.get(key).push(m);}}
 const selectedHistory=new Map();
 for(const rows of byTeam.values()){rows.sort((a,b)=>Date.parse(b.utcDate)-Date.parse(a.utcDate));for(const m of rows.slice(0,8)){if(Date.parse(m.utcDate)>=from.getTime())continue;selectedHistory.set(String(m.id),m);}}
 const archivedMatches=[...selectedHistory.values()].sort((a,b)=>Date.parse(a.utcDate)-Date.parse(b.utcDate));
 const teamsWithFourHistory=[...byTeam.entries()].filter(([,rows])=>rows.length>=4).length;
 const nationalTeamsWithFourHistory=[...byTeam.entries()].filter(([name,rows])=>nationalUpcomingNames.has(name)&&rows.length>=4).length;
 const historyOutput={generatedAt:new Date().toISOString(),range:{from:historyFrom.toISOString(),to:new Date(from.getTime()-1).toISOString()},sources:{providers:['ESPN','SportScore','OpenLigaDB'],sportScoreRequestedDays:historyExtraDates.length,sportScoreMatches:historyExtraMatches.length,espnNationalTeamsDetected:nationalUpcomingTeams.size,espnNationalTeamsRequested:espnNationalHistoryResult.teams,espnNationalMatches:espnNationalHistory.length,espnNationalScheduleRequests:historyScheduleRequests,openLigaMatches:openLigaHistory.length,upcomingTeams:upcomingTeams.size,teamsWithHistory:byTeam.size,teamsWithFourHistory,nationalUpcomingTeams:nationalUpcomingNames.size,nationalTeamsWithHistory:[...byTeam.keys()].filter(name=>nationalUpcomingNames.has(name)).length,nationalTeamsWithFourHistory},matches:archivedMatches};
 fs.writeFileSync('history.json',JSON.stringify(historyOutput));
 console.log('Archive historique : '+archivedMatches.length+' résultats terminés vérifiés · '+teamsWithFourHistory+' équipes avec au moins 4 résultats · '+nationalTeamsWithFourHistory+'/'+nationalUpcomingNames.size+' sélections avec au moins 4 résultats · '+historyExtraDates.length+' journées SportScore.');
 const output={generatedAt:new Date().toISOString(),range:{from:from.toISOString(),to:to.toISOString()},sources:{espn:espnMatches.length,sportscore:sportMatches.length,competitions:leagues.length,days:dates.length,espnDays:espnDates.length,espnCompetitions:leagues.length,espnRequests:tasks.length,historyScheduleRequests,sportscoreRequests:sportDates.length,historyRequests:historyExtraDates.length,competitionCoverage},matches};
 fs.writeFileSync('matches.json',JSON.stringify(output));
 console.log('Calendrier : '+matches.length+' rencontres uniques · ESPN '+espnMatches.length+' sur '+espnDates.length+' jours et '+leagues.length+' compétitions · SportScore '+sportMatches.length+' sur '+dates.length+' jours.');
})().catch(error=>{console.error(error);process.exit(1)});
