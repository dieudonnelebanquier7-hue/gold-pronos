const $=id=>document.getElementById(id);
const state={matches:[],filter:'all'};
const dateFmt=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const timeFmt=new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'});
$('today').textContent=dateFmt.format(new Date());
function setStatus(message){$('match-status').textContent=message;}
function formatDate(value){return dateFmt.format(new Date(value));}
function createMatchCard(match){
  const card=document.createElement('article');card.className='match-card';
  const top=document.createElement('div');top.className='match-top';
  const competition=document.createElement('span');competition.className='competition';competition.textContent=match.competition?.name||'Compétition';
  const status=document.createElement('span');status.textContent=match.status==='FINISHED'?'TERMINÉ':match.status==='IN_PLAY'?'EN COURS':match.status==='PAUSED'?'PAUSE':match.status==='POSTPONED'?'REPORTÉ':match.status==='CANCELLED'?'ANNULÉ':'À VENIR';
  top.append(competition,status);
  const teams=document.createElement('div');teams.className='match-teams';
  const home=document.createElement('span');home.textContent=match.homeTeam?.name||'Équipe domicile';
  const vs=document.createElement('span');vs.className='versus';vs.textContent=['FINISHED','IN_PLAY','PAUSED'].includes(match.status)?(match.score?.fullTime?.home??match.score?.halfTime?.home??0)+' - '+(match.score?.fullTime?.away??match.score?.halfTime?.away??0):'VS';
  const away=document.createElement('span');away.className='team-away';away.textContent=match.awayTeam?.name||'Équipe extérieure';
  teams.append(home,vs,away);
  const bottom=document.createElement('div');bottom.className='match-bottom';
  const date=new Date(match.utcDate);const dateLabel=document.createElement('span');dateLabel.textContent=formatDate(match.utcDate)+' · '+timeFmt.format(date);
  const matchday=document.createElement('span');matchday.textContent=match.matchday?'Journée '+match.matchday:'Calendrier officiel';
  bottom.append(dateLabel,matchday);card.append(top,teams,bottom);return card;
}
function renderMatches(){
  const list=$('match-list');list.replaceChildren();
  const now=new Date();
  const filtered=state.matches.filter(m=>{
    if(state.filter==='finished')return m.status==='FINISHED';
    if(state.filter==='today')return new Date(m.utcDate).toDateString()===now.toDateString();
    return !['FINISHED','CANCELLED'].includes(m.status);
  }).sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
  $('match-count').textContent=String(filtered.length);
  $('match-period').textContent=state.filter==='today'?'Rencontres du jour':state.filter==='finished?'Résultats terminés':'Rencontres à venir';
  if(!filtered.length){const empty=document.createElement('div');empty.className='status-panel';empty.textContent=state.matches.length?'Aucun match dans ce filtre pour la période chargée.':'Aucune rencontre disponible pour le moment.';list.append(empty);return;}
  filtered.forEach(m=>list.append(createMatchCard(m)));
}
async function loadMatches(){
  const button=$('refresh-btn');button.disabled=true;button.textContent='Chargement…';setStatus('Chargement du calendrier officiel…');
  try{
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);let response;try{response=await fetch('./matches.json?v='+Date.now(),{cache:'no-store',signal:controller.signal});}finally{clearTimeout(timeout);}
    if(!response.ok)throw new Error('Le fichier des matchs est introuvable (HTTP '+response.status+').');
    const data=await response.json();
    if(data.error)throw new Error(data.message||'La source des matchs a signalé une erreur.');
    state.matches=Array.isArray(data.matches)?data.matches:[];
    $('source-status').textContent='CONNECTÉE';$('source-detail').textContent='football-data.org · mise à jour automatique';
    $('report-title').textContent=state.matches.length+' rencontre(s) reçue(s)';
    $('report-copy').textContent='Calendrier officiel chargé. Les cotes ne sont pas incluses dans la source actuelle.';
    $('settings-message').textContent='La clé API est protégée dans GitHub. Les matchs sont actualisés automatiquement.';
    setStatus(state.matches.length+' match(s) chargés depuis football-data.org. Horaires affichés selon l’heure de ton téléphone.');
    renderMatches();
  }catch(error){
    state.matches=[];$('match-count').textContent='0';$('source-status').textContent='INDISPONIBLE';$('source-detail').textContent='Données à vérifier';
    setStatus(error.name==='AbortError'?'La source met trop de temps à répondre. Appuie sur Actualiser dans quelques instants.':error.message);$('match-list').replaceChildren();$('settings-message').textContent='Source indisponible pour le moment. Réessaie avec Actualiser.';
  }finally{button.disabled=false;button.textContent='Actualiser ↻';}
}
$('refresh-btn').addEventListener('click',loadMatches);
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b===button));state.filter=button.dataset.filter;renderMatches();}));
document.querySelectorAll('.bottom-nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.bottom-nav a').forEach(b=>b.classList.toggle('active',b===a));}));
loadMatches();
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}