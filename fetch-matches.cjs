'use strict';
const fs=require('node:fs');
let leagues=[
 ['eng.1','Angleterre · Premier League'],['eng.2','Angleterre · Championship'],
 ['esp.1','Espagne · LaLiga'],['esp.2','Espagne · Segunda'],
 ['ger.1','Allemagne · Bundesliga'],['ita.1','Italie · Serie A'],['fra.1','France · Ligue 1'],
 ['ned.1','Pays-Bas · Eredivisie'],['por.1','Portugal · Liga'],['tur.1','Turquie · Süper Lig'],
 ['nor.1','Norvège · Eliteserien'],['swe.1','Suède · Allsvenskan'],['sui.1','Suisse · Super League'],
 ['ksa.1','Arabie saoudite · Pro League'],['cze.1','Tchéquie · First League'],['usa.1','États-Unis · MLS'],
 ['rou.1','Roumanie · Liga I'],['rus.1','Russie · Premier League'],['chn.1','Chine · Super League'],
 ['jpn.1','Japon · J1 League'],['bra.1','Brésil · Série A'],['arg.1','Argentine · Liga Profesional'],
 ['mex.1','Mexique · Liga MX'],['uefa.champions','UEFA · Ligue des champions'],
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
const today=new Date();today.setUTCHours(0,0,0,0);
const from=new Date(today);from.setUTCDate(from.getUTCDate()-30);
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
     score:{fullTime:{home:home.score==null?null:Number(home.score),away:away.score==null?null:Number(away.score)}},source:'ESPN',providers:['ESPN']};
   }).filter(Boolean);
  }catch(e){if(attempt===1)console.log('Source indisponible '+code+': '+e.message)}
 }
 return [];
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
  leagues=[...merged.values()].slice(0,100);
  console.log('Répertoire ESPN : '+found.length+' compétitions découvertes, '+leagues.length+' retenues (maximum 100).');
 }catch(error){console.log('Répertoire ESPN indisponible, catalogue prioritaire conservé : '+error.message)}
}
(async()=>{
 await discoverEspnLeagues();
 // ESPN sert de source de contrôle pour les rencontres du jour. SportScore fournit le calendrier mondial sur toute la fenêtre.
 // Le calendrier préchargé doit couvrir les 14 prochains jours, pas seulement aujourd’hui.
 // Les 30 jours passés restent collectés par SportScore ; ESPN complète les rencontres à venir.
 const espnDates=dates.filter(day=>day>=ymd(today)&&day<=ymd(to));
 const tasks=leagues.flatMap(league=>espnDates.map(day=>({league,day})));
 const results=new Array(tasks.length);let cursor=0,completed=0,nonEmpty=0;
 const workers=Array.from({length:10},async()=>{while(true){
  const i=cursor++;if(i>=tasks.length)break;
  const task=tasks[i];results[i]=await fetchLeague(task.league,task.day);
  if(results[i].length)nonEmpty++;
  completed++;
  if(completed%100===0||completed===tasks.length)console.log('Collecte '+completed+'/'+tasks.length+' · '+nonEmpty+' journées avec rencontres');
 }});
 await Promise.all(workers);
 const espnMatches=results.flat();
 // SportScore complète le calendrier mondial, sans remplacer les scores ESPN.
 // Trois requêtes simultanées restent largement sous la limite publique annoncée.
 const sportDates=dates;
 const sportResults=new Array(sportDates.length);let sportCursor=0;
 const sportWorkers=Array.from({length:3},async()=>{while(true){const i=sportCursor++;if(i>=sportDates.length)break;sportResults[i]=await fetchSportScoreDay(sportDates[i]);}});
 await Promise.all(sportWorkers);
 const sportMatches=sportResults.flat();
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const combined=[...espnMatches];
 for(const item of sportMatches){
  const home=normalize(item.homeTeam.name),away=normalize(item.awayTeam.name),time=Date.parse(item.utcDate);
  const duplicate=combined.find(existing=>normalize(existing.homeTeam?.name)===home&&normalize(existing.awayTeam?.name)===away&&Math.abs(Date.parse(existing.utcDate)-time)<=6*60*60*1000);
  if(duplicate){duplicate.providers=[...new Set([...(duplicate.providers||['ESPN']),'SportScore'])];}
  else combined.push(item);
 }
 const unique=new Map(combined.map(m=>[m.id,m]));
 const matches=[...unique.values()].sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
 if(!matches.length)throw new Error('Aucune rencontre reçue après '+tasks.length+' requêtes ESPN et '+dates.length+' requêtes SportScore. Le calendrier existant ne sera pas remplacé.');
 const output={generatedAt:new Date().toISOString(),range:{from:from.toISOString(),to:to.toISOString()},sources:{espn:espnMatches.length,sportscore:sportMatches.length,competitions:leagues.length,days:dates.length,espnDays:espnDates.length,espnCompetitions:leagues.length,espnRequests:tasks.length,sportscoreRequests:sportDates.length},matches};
 fs.writeFileSync('matches.json',JSON.stringify(output));
 console.log('Calendrier : '+matches.length+' rencontres uniques · ESPN '+espnMatches.length+' sur '+espnDates.length+' jours et '+leagues.length+' compétitions · SportScore '+sportMatches.length+' sur '+dates.length+' jours.');
})().catch(error=>{console.error(error);process.exit(1)});
