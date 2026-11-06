const API_URL='https://api.football-data.org/v4/matches';
const $=id=>document.getElementById(id);
const state={matches:[],filter:'all'};
const dateFmt=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const timeFmt=new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});
$('today').textContent=dateFmt.format(new Date());
const savedKey=localStorage.getItem('goldPronosFootballKey')||'';
if(savedKey){$('api-key').value=savedKey;$('settings-message').textContent='Une clé API est enregistrée sur cet appareil.';$('source-status').textContent='CLÉ ENREGISTRÉE';$('source-detail').textContent='Prêt à charger le calendrier';}
function setStatus(message){$('match-status').textContent=message;}
function formatDate(value){const d=new Date(value);return dateFmt.format(d);}
function createMatchCard(match){
  const card=document.createElement('article');card.className='match-card';
  const top=document.createElement('div');top.className='match-top';
  const competition=document.createElement('span');competition.className='competition';competition.textContent=match.competition?.name||'Compétition';
  const status=document.createElement('span');status.textContent=match.status==='FINISHED'?'TERMINÉ':match.status==='IN_PLAY'?'EN COURS':match.status==='PAUSED'?'PAUSE':match.status==='POSTPONED'?'REPORTÉ':match.status==='CANCELLED'?'ANNULÉ':'À VENIR';
  top.append(competition,status);
  const teams=document.createElement('div');teams.className='match-teams';
  const home=document.createElement('span');home.textContent=match.homeTeam?.name||'Équipe domicile';
  const vs=document.createElement('span');vs.className='versus';vs.textContent=match.status==='FINISHED'||match.status==='IN_PLAY'?(match.score?.fullTime?.home??0)+' - '+(match.score?.fullTime?.away??0):'VS';
  const away=document.createElement('span');away.className='team-away';away.textContent=match.awayTeam?.name||'Équipe extérieure';
  teams.append(home,vs,away);
  const bottom=document.createElement('div');bottom.className='match-bottom';
  const date=document.createElement('span');date.textContent=formatDate(match.utcDate)+' · '+timeFmt.format(new Date(match.utcDate));
  const matchday=document.createElement('span');matchday.textContent=match.matchday?'Journée '+match.matchday:'Calendrier officiel';
  bottom.append(date,matchday);card.append(top,teams,bottom);return card;
}
function renderMatches(){
  const list=$('match-list');list.replaceChildren();
  const now=new Date();
  const filtered=state.matches.filter(m=>{
    if(state.filter==='finished')return m.status==='FINISHED';
    if(state.filter==='today')return new Date(m.utcDate).toDateString()===now.toDateString();
    return m.status!=='FINISHED'&&m.status!=='CANCELLED';
  }).sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
  $('match-count').textContent=String(filtered.length);
  $('match-period').textContent=state.filter==='today'?'Rencontres du jour':state.filter==='finished?'Résultats terminés':'Rencontres à venir';
  if(!filtered.length){const empty=document.createElement('div');empty.className='status-panel';empty.textContent=state.matches.length?'Aucun match dans ce filtre pour la période chargée.':'Aucune rencontre disponible pour le moment.';list.append(empty);return;}
  filtered.forEach(m=>list.append(createMatchCard(m)));
}
async function loadMatches(){
  const key=localStorage.getItem('goldPronosFootballKey');
  if(!key){$('source-status').textContent='NON CONNECTÉE';$('source-detail').textContent='Clé API nécessaire';setStatus('Pour afficher les vraies rencontres, ajoute une clé API football-data.org dans la rubrique Réglages.');return;}
  $('refresh-btn').disabled=true;$('refresh-btn').textContent='Chargement…';setStatus('Connexion à la source football…');
  const from=new Date();const to=new Date();to.setDate(to.getDate()+7);
  const iso=d=>d.toISOString().slice(0,10);
  try{
    const response=await fetch(API_URL+'?dateFrom='+iso(from)+'&dateTo='+iso(to),{headers:{'X-Auth-Token':key}});
    if(!response.ok){if(response.status===403||response.status===401)throw new Error('Clé API refusée ou accès non autorisé. Vérifie ta clé et les limites de ton compte.');if(response.status===429)throw new Error('Limite de requêtes atteinte. Réessaie plus tard.');throw new Error('La source football a répondu avec le code '+response.status+'.');}
    const data=await response.json();state.matches=Array.isArray(data.matches)?data.matches:[];
    $('source-status').textContent='CONNECTÉE';$('source-detail').textContent='football-data.org · calendrier';$('report-title').textContent=state.matches.length+' rencontre(s) reçue(s)';$('report-copy').textContent='Le calendrier est chargé. Les analyses détaillées et les cotes nécessitent des sources statistiques complémentaires.';
    setStatus('Calendrier récupéré depuis football-data.org. Les horaires sont affichés selon le fuseau de Paris.');renderMatches();
  }catch(error){state.matches=[];$('match-count').textContent='0';$('source-status').textContent='ERREUR';$('source-detail').textContent='Connexion à vérifier';setStatus(error.message+' Si le problème persiste, vérifie la clé API et la connexion Internet.');$('match-list').replaceChildren();}
  finally{$('refresh-btn').disabled=false;$('refresh-btn').textContent='Actualiser ↻';}
}
$('api-form').addEventListener('submit',async event=>{event.preventDefault();const key=$('api-key').value.trim();if(!key){$('settings-message').textContent='Colle une clé API avant de continuer.';return;}localStorage.setItem('goldPronosFootballKey',key);$('settings-message').textContent='Clé enregistrée sur cet appareil. Test de connexion…';await loadMatches();});
$('clear-key').addEventListener('click',()=>{localStorage.removeItem('goldPronosFootballKey');$('api-key').value='';state.matches=[];$('source-status').textContent='NON CONNECTÉE';$('source-detail').textContent='Configuration nécessaire';$('match-count').textContent='—';$('settings-message').textContent='Clé effacée de cet appareil.';setStatus('Connecte une source de données pour charger les rencontres réelles.');$('match-list').replaceChildren();});
$('refresh-btn').addEventListener('click',loadMatches);
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b===button));state.filter=button.dataset.filter;renderMatches();}));
document.querySelectorAll('.bottom-nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.bottom-nav a').forEach(b=>b.classList.toggle('active',b===a));}));
if(savedKey)loadMatches();
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}