(()=>{'use strict';
const $=id=>document.getElementById(id);
const NATIONAL_COMPS=[
 ['fifa.world','Coupe du monde FIFA','FIFA'],['fifa.worldq.uefa','Qualifications Coupe du monde · UEFA','UEFA'],
 ['fifa.worldq.conmebol','Qualifications Coupe du monde · CONMEBOL','CONMEBOL'],['fifa.worldq.concacaf','Qualifications Coupe du monde · CONCACAF','CONCACAF'],
 ['fifa.worldq.afc','Qualifications Coupe du monde · AFC','AFC'],['fifa.worldq.caf','Qualifications Coupe du monde · CAF','CAF'],
 ['fifa.worldq.ofc','Qualifications Coupe du monde · OFC','OFC'],['fifa.friendly','Matchs amicaux internationaux','FIFA'],
 ['uefa.euro','Championnat d’Europe','UEFA'],['uefa.nations','Ligue des nations','UEFA'],['conmebol.copa','Copa América','CONMEBOL'],
 ['concacaf.gold','Gold Cup','CONCACAF'],['afc.asian','Coupe d’Asie','AFC'],['caf.nations','Coupe d’Afrique des nations','CAF'],
 ['fifa.wwc','Coupe du monde féminine','FIFA'],['fifa.friendly.w','Matchs amicaux féminins','FIFA'],
 ['conmebol.america.femenina','Copa América féminine','CONMEBOL'],['fifa.world.u20','Coupe du monde U20','FIFA'],
 ['fifa.world.u17','Coupe du monde U17','FIFA'],['fifa.wworld.u17','Coupe du monde U17 féminine','FIFA'],
 ['uefa.u21','Compétitions U21','UEFA']
];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const ESPN_HISTORY_CACHE_KEY='gold-pronos-espn-team-history-v4';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isNational=m=>{const code=String(m.code||m.competition?.code||'').replace(/^ESPN-/,'');const name=String(m.competition?.name||m.league||m.competition||'');const text=code+' '+name;return NATIONAL_COMPS.some(x=>x[0]===code)||/national team|international friendly|world cup|coupe du monde|qualif|nations league|ligue des nations|copa america|copa am[eé]rica|africa cup|coupe d.?afrique|gold cup|asian cup|championnat d.?europe|euro 20|women.?s world cup|fifa friendly|friendlies?/i.test(text)&&!/club\s+friendlies?/i.test(text)};
const dateFmt=v=>{try{return new Intl.DateTimeFormat('fr-FR',{timeZone:'Africa/Porto-Novo',weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch(_){return 'Date à confirmer'}};
let data=[],teams=[],selected='all',filter='upcoming',search='',busy=false;
function normalizeMatch(m){const status=String(m.status||'SCHEDULED').toUpperCase(),hasPublishedScore=status==='IN_PLAY'||status==='LIVE'||status==='FINISHED';return {id:String(m.id||''),code:String(m.competition?.code||'').replace(/^ESPN-/,'') ,competition:m.competition?.name||'Compétition internationale',home:m.homeTeam?.name||'',away:m.awayTeam?.name||'',homeId:String(m.homeTeam?.id||''),awayId:String(m.awayTeam?.id||''),homeLogo:m.homeTeam?.logo||'',awayLogo:m.awayTeam?.logo||'',date:m.utcDate,status,homeScore:hasPublishedScore?(m.score?.fullTime?.home??null):null,awayScore:hasPublishedScore?(m.score?.fullTime?.away??null):null,source:m.source||(String(m.competition?.code||'').startsWith('ESPN-')?'ESPN':''),scoreConflict:!!m.scoreConflict};}
function matchesForView(){const now=Date.now();return data.filter(m=>{const t=Date.parse(m.date);if(!Number.isFinite(t))return false;if(filter==='upcoming'&&!(t>=now-2*3600000&&m.status!=='FINISHED'))return false;if(filter==='live'&&m.status!=='IN_PLAY')return false;if(filter==='finished'&&m.status!=='FINISHED')return false;const q=norm(search);return !q||norm([m.home,m.away,m.competition].join(' ')).includes(q)}).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));}
function badge(status){return status==='IN_PLAY'?'<span class="nt-status live">EN DIRECT</span>':status==='FINISHED'?'<span class="nt-status done">TERMINÉ</span>':'<span class="nt-status">À VENIR</span>'}
function renderStats(){const upcoming=data.filter(m=>m.status!=='FINISHED'&&Date.parse(m.date)>=Date.now()).length,live=data.filter(m=>m.status==='IN_PLAY').length,comps=new Set(data.map(m=>m.competition)).size;const a=$('nt-stat-teams'),b=$('nt-stat-matches'),c=$('nt-stat-comps'),d=$('nt-stat-live');if(a)a.textContent=teams.length||'—';if(b)b.textContent=data.length;if(c)c.textContent=comps;if(d)d.textContent=live+' en direct · '+upcoming+' à venir';}
function renderTeams(){const box=$('nt-team-list');if(!box)return;const q=norm(search);const rows=teams.filter(t=>!q||norm(t.name+' '+t.country).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'fr'));box.innerHTML=rows.length?rows.map(t=>'<article class="nt-team-card"><div class="nt-flag">'+(t.logo?'<img loading="lazy" src="'+safe(t.logo)+'" alt="" onerror="this.remove()">':'🌍')+'</div><div><b>'+safe(t.name)+'</b><small>'+safe(t.country||'Sélection nationale')+'</small></div><span class="nt-team-source">'+safe(t.source||'ESPN')+'</span></article>').join(''):'<div class="notice">Aucune sélection ne correspond à cette recherche dans les répertoires consultés. Les équipes sont ajoutées lorsqu’une source publique les identifie.</div>';}
function renderCompetitions(){const box=$('nt-competition-list');if(!box)return;const counts=new Map();for(const m of data)counts.set(m.competition,(counts.get(m.competition)||0)+1);box.innerHTML=NATIONAL_COMPS.map(c=>{const n=counts.get(c[1])||0;return '<button type="button" class="nt-comp-card" data-nt-comp="'+safe(c[0])+'"><span>'+safe(c[2])+'</span><b>'+safe(c[1])+'</b><small>'+n+' rencontre(s) dans le calendrier chargé</small></button>'}).join('');box.querySelectorAll('[data-nt-comp]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.ntComp;const sel=$('nt-competition-filter');if(sel)sel.value=selected;renderFixtures();document.querySelector('[data-page="national-teams"]')?.scrollIntoView({behavior:'smooth',block:'start'})}));}
function renderFixtures(){const box=$('nt-fixtures');if(!box)return;let rows=matchesForView();if(selected!=='all')rows=rows.filter(m=>m.code===selected||NATIONAL_COMPS.find(c=>c[0]===selected)?.[1]===m.competition);if(!rows.length){box.innerHTML='<div class="notice">Aucune rencontre nationale vérifiée pour ce filtre dans le calendrier actuellement chargé. Cela ne signifie pas qu’aucun match n’existe : la couverture de la source peut être incomplète. Actualise les données ou élargis le filtre.</div>';return}box.innerHTML=rows.map(m=>'<article class="nt-fixture"><div class="nt-fixture-top"><span>'+safe(m.competition)+'</span>'+badge(m.status)+'</div><div class="nt-fixture-teams"><div><b>'+safe(m.home)+'</b></div><strong class="nt-score">'+(m.homeScore===null?'—':m.homeScore)+' : '+(m.awayScore===null?'—':m.awayScore)+'</strong><div><b>'+safe(m.away)+'</b></div></div><div class="nt-fixture-bottom"><span>'+safe(dateFmt(m.date))+'</span><small>Source : '+safe(m.source)+'</small></div></article>').join('');}
function verifiedFinishedResult(m,now=Date.now()){
 const date=Date.parse(m.date),home=Number(m.homeScore),away=Number(m.awayScore),source=String(m.source||'').toUpperCase();
 return m.status==='FINISHED'&&!m.scoreConflict&&['ESPN','SPORTSCORE','OPENLIGADB'].includes(source)&&Number.isFinite(date)&&date<now&&m.homeScore!==null&&m.awayScore!==null&&Number.isInteger(home)&&Number.isInteger(away)&&home>=0&&away>=0;
}
function mergeCachedEspnHistories(){
 const now=Date.now(),wanted=new Set(data.flatMap(m=>[m.home,m.away]).map(norm).filter(Boolean));
 let cache={};try{cache=JSON.parse(localStorage.getItem(ESPN_HISTORY_CACHE_KEY)||'{}')||{}}catch(_){return 0}
 const merged=new Map(data.map(m=>[m.id,m]));let added=0;
 for(const [key,entry] of Object.entries(cache)){
  const parts=key.split('|'),cacheCode=parts[0]||'',teamId=String(parts[1]||''),age=now-Number(entry?.at||0);
  if(!teamId||!Array.isArray(entry?.events)||!entry.events.length||!Number.isFinite(age)||age<0||age>6*3600000)continue;
  for(const item of entry.events){
   const event=item?.event||item,id=String(event?.id||event?.uid||'').trim(),timestamp=Date.parse(event?.date||''),competition=event?.competitions?.[0]||{},competitors=Array.isArray(competition.competitors)?competition.competitors:[];
   const home=competitors.find(x=>x.homeAway==='home')||competitors[0]||{},away=competitors.find(x=>x.homeAway==='away')||competitors[1]||{};
   const statusObject=competition.status||event?.status||{},status=statusObject.type||statusObject,state=String(status.state||'').toLowerCase(),statusName=String(status.name||status.description||'').toLowerCase();
   const finished=!!status.completed||state==='post'||/status_final|full.?time|after.?extra.?time|finalizado|termin[eé]/.test(statusName);
   const homeId=String(home.team?.id||home.id||''),awayId=String(away.team?.id||away.id||'');
   if(!id||!(homeId===teamId||awayId===teamId)||!finished||!Number.isFinite(timestamp)||timestamp>=now||timestamp<now-730*86400000)continue;
   const homeName=String(home.team?.displayName||home.team?.name||'').trim(),awayName=String(away.team?.displayName||away.team?.name||'').trim();
   if(!homeName||!awayName)continue; // L'identifiant ESPN vérifié ci-dessus suffit : les noms peuvent varier selon la compétition.
   const homeScore=home.score===null||home.score===undefined||home.score===''?null:Number(home.score),awayScore=away.score===null||away.score===undefined||away.score===''?null:Number(away.score);
   if(!Number.isInteger(homeScore)||!Number.isInteger(awayScore)||homeScore<0||awayScore<0)continue;
   const match={id:'espn-'+id,code:String(item?.code||cacheCode).replace(/^ESPN-/,''),competition:competition.name||'Compétition internationale',home:homeName,away:awayName,homeId,awayId,homeLogo:'',awayLogo:'',date:new Date(timestamp).toISOString(),status:'FINISHED',homeScore,awayScore,source:'ESPN',scoreConflict:false};
   if(!merged.has(match.id)){merged.set(match.id,match);added++;}
  }
 }
 if(added)data=[...merged.values()];
 return added;
}
function teamHistory(name,teamId){
 const wantedId=String(teamId||'').trim(),wantedName=norm(name);
 const sideMatches=(m,side)=>{
  const id=String(m[side+'Id']||'').trim(),sideName=norm(m[side]);
  // Les identifiants ESPN priment. Le nom ne sert de repli que si la source
  // n'a pas fourni d'identifiant pour ce côté du match.
  return wantedId?(id?id===wantedId:sideName===wantedName):sideName===wantedName;
 };
 return data.filter(m=>verifiedFinishedResult(m)&&(sideMatches(m,'home')||sideMatches(m,'away')))
  .sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,6).map(m=>{
   const home=sideMatches(m,'home');
   const forGoals=Number(home?m.homeScore:m.awayScore),against=Number(home?m.awayScore:m.homeScore);
   return {forGoals,against,result:forGoals>against?'W':forGoals===against?'D':'L'};
  });
}
function renderPredictions(){
 const box=$('nt-predictions');if(!box)return;
 const upcoming=data.filter(m=>m.status==='SCHEDULED'&&Date.parse(m.date)>Date.now()).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 if(!upcoming.length){box.innerHTML='<div class="notice">Aucun match international à venir confirmé dans le calendrier chargé.</div>';return}
 let predicted=0,pending=0;
 const cards=upcoming.map(m=>{
  const h=teamHistory(m.home,m.homeId),a=teamHistory(m.away,m.awayId);
  if(h.length<4||a.length<4){
   pending++;
   return '<article class="nt-pick pending"><span>'+safe(m.competition)+'</span><h4>'+safe(m.home)+' – '+safe(m.away)+'</h4><b>Analyse en attente · historique vérifié insuffisant</b><p>Aucun pronostic n’est publié tant que les deux sélections ne disposent pas d’au moins quatre résultats terminés et vérifiables.</p><small>Historique disponible : '+safe(m.home)+' '+h.length+'/4 · '+safe(m.away)+' '+a.length+'/4. Aucun choix artificiel.</small></article>';
  }
  const avg=x=>x.reduce((s,r)=>s+r.forGoals,0)/x.length;
  const points=x=>x.reduce((s,r)=>s+(r.result==='W'?3:r.result==='D'?1:0),0)/x.length;
  const hp=points(h),ap=points(a),hg=avg(h),ag=avg(a);
  let pick='Match équilibré · prudence',edge=Math.abs(hp-ap);
  if(hp>ap+.35)pick='Avantage statistique : '+m.home;
  else if(ap>hp+.35)pick='Avantage statistique : '+m.away;
  else if(Math.abs(hg-ag)<.25)pick='Tendance faible · éviter le 1N2';
  const sample=Math.min(h.length,a.length),confidence=edge>.8&&sample>=6?'Modérée':edge>.4?'Faible':'Très faible';
  predicted++;
  return '<article class="nt-pick"><span>'+safe(m.competition)+'</span><h4>'+safe(m.home)+' – '+safe(m.away)+'</h4><b>'+safe(pick)+'</b><p>Forme récente : '+safe(m.home)+' '+hp.toFixed(1)+' pts/match · '+hg.toFixed(1)+' but(s) marqué(s) ; '+safe(m.away)+' '+ap.toFixed(1)+' pts/match · '+ag.toFixed(1)+' but(s) marqué(s).</p><small>Échantillon : '+h.length+' et '+a.length+' matchs · confiance '+confidence+' · modèle indicatif, sans cote ni garantie.</small></article>';
 }).join('');
 box.innerHTML='<div class="notice"><b>Bilan des pronostics internationaux</b><br>'+predicted+' pronostic(s) calculé(s) · '+pending+' analyse(s) en attente sur '+upcoming.length+' rencontre(s) à venir.</div>'+cards;
}
function update(){renderStats();renderTeams();renderCompetitions();renderFixtures();renderPredictions();}
async function fetchTeamsForCompetition(code){const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+encodeURIComponent(code)+'/teams?limit=500';try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)return [];const d=await r.json();const found=[];const walk=(v,depth=0)=>{if(!v||depth>7)return;if(Array.isArray(v)){v.forEach(x=>walk(x,depth+1));return}if(typeof v!=='object')return;const t=v.team||v;if(t&&t.id&& (t.displayName||t.name)){const name=t.displayName||t.name;if(!found.some(x=>x.id===String(t.id)))found.push({id:String(t.id),name,country:t.location||t.country?.name||'',logo:t.logos?.[0]?.href||t.logo||'',source:'ESPN'});}for(const [k,x] of Object.entries(v))if(x&&typeof x==='object'&&k!=='logos')walk(x,depth+1)};walk(d);return found}catch(_){return []}}
async function load(){
 if(busy)return;
 busy=true;
 const box=$('nt-fixtures');
 if(box)box.innerHTML='<div class="loading">Chargement des calendriers internationaux vérifiés…</div>';
 try{
  const d=await fetch('./matches.json',{cache:'no-store'});
  if(!d.ok)throw Error('Le calendrier préchargé est indisponible');
  const json=await d.json();
  let archiveRows=[];
  try{const historyResponse=await fetch('./history.json',{cache:'no-store'});if(historyResponse.ok){const archive=await historyResponse.json();archiveRows=Array.isArray(archive.matches)?archive.matches:[];}}catch(error){console.warn('Archive historique nationale indisponible',error?.message||error)}
  const combinedRows=[...(json.matches||[]),...archiveRows],uniqueRows=new Map();
  for(const raw of combinedRows){const item=normalizeMatch(raw);if(item.id&&item.home&&item.away&&!uniqueRows.has(item.id))uniqueRows.set(item.id,item);}
  data=[...uniqueRows.values()].filter(m=>m.home&&m.away&&isNational(m));
  mergeCachedEspnHistories();
  const seen=new Map();
  data.forEach(m=>[['home',m.home,m.homeId],['away',m.away,m.awayId]].forEach(([side,name,providerId])=>{
   const k=String(providerId||'').trim()||norm(name),key=providerId?'espn:'+String(providerId):'name:'+norm(name);
   if(k&&!seen.has(key))seen.set(key,{id:k,providerId:String(providerId||''),name,country:'',logo:'',source:'Calendrier ESPN / SportScore'});
  }));
  teams=[...seen.values()];
  // Afficher immédiatement le calendrier et les analyses : l’enrichissement ESPN ne doit pas bloquer la rubrique.
  update();
  const status=$('nt-source-status');
  if(status)status.textContent='Calendrier généré le '+(json.generatedAt?dateFmt(json.generatedAt):'date inconnue')+' · '+data.length+' rencontres nationales détectées · '+teams.length+' sélections identifiées dans le calendrier. Enrichissement des répertoires ESPN en cours…';
  const codes=[...new Set(NATIONAL_COMPS.map(item=>item[0]))];
  const batches=[];
  for(let i=0;i<codes.length;i+=4)batches.push(codes.slice(i,i+4));
  for(const group of batches){
   const results=await Promise.all(group.map(fetchTeamsForCompetition));
   for(const list of results)for(const t of list){
    const k=norm(t.name),providerId=String(t.id||'');
    const old=teams.find(x=>providerId&&(String(x.providerId||'')===providerId||String(x.id||'')===providerId))||teams.find(x=>!x.providerId&&!providerId&&norm(x.name)===k);
    if(old){old.logo=old.logo||t.logo;old.providerId=old.providerId||providerId;old.source='ESPN'}
    else teams.push({...t,providerId});
   }
  }
  renderStats();
  renderTeams();
  if(status)status.textContent='Calendrier généré le '+(json.generatedAt?dateFmt(json.generatedAt):'date inconnue')+' · '+data.length+' rencontres nationales détectées · '+teams.length+' sélections identifiées dans les compétitions accessibles. Le catalogue dépend de la couverture publique des fournisseurs.';
 }catch(e){
  if(box)box.innerHTML='<div class="notice">Impossible de charger le calendrier national : '+safe(e.message)+'. Réessaie après actualisation.</div>';
 }finally{busy=false;}
}
window.addEventListener('gold-pronos-team-history-updated',()=>{
 if(!data.length)return;
 // Always refresh the prediction panel after a history-cache update. A cache
 // write can replace or confirm existing entries without increasing the number
 // of imported fixtures; the UI must still be brought back in sync.
 mergeCachedEspnHistories();
 renderPredictions();
});
$('nt-refresh')?.addEventListener('click',load);$('nt-search')?.addEventListener('input',e=>{search=e.target.value;renderTeams();renderFixtures()});$('nt-competition-filter')?.addEventListener('change',e=>{selected=e.target.value;renderFixtures()});$('nt-date-filter')?.addEventListener('change',e=>{filter=e.target.value;renderFixtures()});
document.querySelector('.tabs')?.addEventListener('click',event=>{const tab=event.target.closest('.tab[data-page="national-teams"]');if(tab&&!data.length)load()});
// Expose a deterministic entry point for browser smoke tests and load the independent
// national calendar once at startup, so it cannot remain indefinitely on its HTML placeholder.
window.GoldPronosNationalTeamsLoad=load;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
