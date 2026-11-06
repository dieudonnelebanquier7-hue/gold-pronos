(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { matches: [], filter: 'all', generatedAt: null, sources: {}, openAnalysis: null };
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour:'2-digit', minute:'2-digit' });
  const setText = (id,value) => { const el=$(id); if(el) el.textContent=value; };
  function formatDate(value) { const d=new Date(value); return Number.isNaN(d.getTime())?'Date non disponible':dateFmt.format(d); }
  function validMatch(m) { return m && typeof m==='object' && typeof m.utcDate==='string' && !Number.isNaN(new Date(m.utcDate).getTime()) && m.homeTeam && m.awayTeam; }
  const teamName = t => String(t?.name || '');
  const normalizeName = value => String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  function hasFinalScore(m) {
    const h=m.score?.fullTime?.home, a=m.score?.fullTime?.away;
    return h!==null && h!==undefined && a!==null && a!==undefined && Number.isFinite(Number(h)) && Number.isFinite(Number(a));
  }
  function resultRows(name, before) {
    const target=normalizeName(name);
    return state.matches.filter(m => m.status==='FINISHED' && new Date(m.utcDate)<before && hasFinalScore(m) &&
      (normalizeName(teamName(m.homeTeam))===target || normalizeName(teamName(m.awayTeam))===target))
      .sort((a,b)=>new Date(b.utcDate)-new Date(a.utcDate)).slice(0,10).map(m=>{
        const home=normalizeName(teamName(m.homeTeam))===target;
        const gf=Number(m.score.fullTime[home?'home':'away']), ga=Number(m.score.fullTime[home?'away':'home']);
        return {gf,ga,home,date:m.utcDate,opponent:teamName(home?m.awayTeam:m.homeTeam),form:gf>ga?'V':gf===ga?'N':'D'};
      });
  }
  function average(rows,key) { return rows.reduce((s,r)=>s+r[key],0)/rows.length; }
  function poisson(lambda,k) { let p=Math.exp(-lambda); for(let i=1;i<=k;i++) p*=lambda/i; return p; }
  function buildProbabilities(homeLambda,awayLambda) {
    const h=Array.from({length:13},(_,i)=>poisson(homeLambda,i)), a=Array.from({length:13},(_,i)=>poisson(awayLambda,i));
    let home=0,draw=0,away=0,btts=0,over15=0,over25=0,over35=0;
    for(let i=0;i<9;i++) for(let j=0;j<9;j++) {
      const p=h[i]*a[j]; if(i>j)home+=p; else if(i===j)draw+=p; else away+=p;
      if(i>0&&j>0)btts+=p; if(i+j>=2)over15+=p; if(i+j>=3)over25+=p; if(i+j>=4)over35+=p;
    }
    return {home,draw,away,btts,over15,over25,over35};
  }
  function pct(v) { return Math.round(v*100)+' %'; }
  function analyze(match) {
    const kickoff=new Date(match.utcDate), hn=teamName(match.homeTeam), an=teamName(match.awayTeam);
    const homeRows=resultRows(hn,kickoff), awayRows=resultRows(an,kickoff);
    if(homeRows.length<3 || awayRows.length<3) return {ready:false,homeRows,awayRows,reason:'Historique insuffisant : au moins 3 scores terminés vérifiés par équipe sont nécessaires. La collecte historique est en cours ou la compétition n’est pas couverte.'};
    const homeVenue=homeRows.filter(r=>r.home), awayVenue=awayRows.filter(r=>!r.home);
    const homeAttack=homeVenue.length>=2?homeVenue:homeRows;
    const homeDefence=homeVenue.length>=2?homeVenue:homeRows;
    const awayAttack=awayVenue.length>=2?awayVenue:awayRows;
    const awayDefence=awayVenue.length>=2?awayVenue:awayRows;
    const homeScored=average(homeAttack,'gf'), homeConceded=average(homeDefence,'ga');
    const awayScored=average(awayAttack,'gf'), awayConceded=average(awayDefence,'ga');
    const homeLambda=Math.max(.15,Math.min(3.5,(homeScored+awayConceded)/2));
    const awayLambda=Math.max(.15,Math.min(3.5,(awayScored+homeConceded)/2));
    const probs=buildProbabilities(homeLambda,awayLambda);
    const markets={
      home:probs.home,draw:probs.draw,away:probs.away,
      homeOrDraw:probs.home+probs.draw,awayOrDraw:probs.away+probs.draw,noDraw:probs.home+probs.away,
      over15:probs.over15,over25:probs.over25,over35:probs.over35,btts:probs.btts
    };
    const candidates=[
      ['1 · Victoire '+hn,markets.home],['N · Match nul',markets.draw],['2 · Victoire '+an,markets.away],
      ['1X · '+hn+' ou nul',markets.homeOrDraw],['X2 · '+an+' ou nul',markets.awayOrDraw],['12 · Pas de nul',markets.noDraw],
      ['Plus de 1,5 but',markets.over15],['Plus de 2,5 buts',markets.over25],['Plus de 3,5 buts',markets.over35],
      ['Les deux équipes marquent',markets.btts]
    ].sort((a,b)=>b[1]-a[1]);
    const sample=homeRows.length+awayRows.length, best=candidates[0];
    const confidence=homeRows.length>=8&&awayRows.length>=8?'Modérée':homeRows.length>=5&&awayRows.length>=5?'Faible à modérée':'Faible';
    const h2h=state.matches.filter(m=>m.status==='FINISHED'&&new Date(m.utcDate)<kickoff&&hasFinalScore(m)&&
      ((normalizeName(teamName(m.homeTeam))===normalizeName(hn)&&normalizeName(teamName(m.awayTeam))===normalizeName(an))||
       (normalizeName(teamName(m.homeTeam))===normalizeName(an)&&normalizeName(teamName(m.awayTeam))===normalizeName(hn))))
      .sort((a,b)=>new Date(b.utcDate)-new Date(a.utcDate)).slice(0,5);
    return {ready:true,homeRows,awayRows,homeLambda,awayLambda,probs,markets,best,confidence,h2h,sample,homeVenueCount:homeVenue.length,awayVenueCount:awayVenue.length};
  }
  function addLine(parent,label,value) { const row=document.createElement('div'); row.className='analysis-stat'; const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=value;row.append(a,b);parent.append(row); }
  function createAnalysis(match) {
    const panel=document.createElement('section');panel.className='match-analysis';panel.setAttribute('aria-label','Analyse du match');
    const title=document.createElement('h3');title.textContent='ANALYSE · '+teamName(match.homeTeam)+' – '+teamName(match.awayTeam);panel.append(title);
    const result=analyze(match);
    if(!result.ready) {
      const msg=document.createElement('p');msg.className='analysis-warning';msg.textContent=result.reason+' Aucun pronostic ne sera inventé. La collecte actuelle ne fournit pas encore un historique assez long.';panel.append(msg);
      addLine(panel,'Résultats récents disponibles',result.homeRows.length+' · '+result.awayRows.length);
      return panel;
    }
    const intro=document.createElement('p');intro.className='analysis-intro';intro.textContent='Estimation statistique indicative basée sur '+result.homeRows.length+' matchs de '+teamName(match.homeTeam)+' et '+result.awayRows.length+' de '+teamName(match.awayTeam)+'.';panel.append(intro);
    const grid=document.createElement('div');grid.className='analysis-stats';
    addLine(grid,'Buts moyens domicile (équipe 1)',result.homeRows.length?average(result.homeRows,'gf').toFixed(2):'—');
    addLine(grid,'Buts encaissés moyens (équipe 1)',average(result.homeRows,'ga').toFixed(2));
    addLine(grid,'Buts moyens (équipe 2)',average(result.awayRows,'gf').toFixed(2));
    addLine(grid,'Buts encaissés moyens (équipe 2)',average(result.awayRows,'ga').toFixed(2));
    panel.append(grid);
    const markets=document.createElement('div');markets.className='probability-grid';
    [['1',result.markets.home],['N',result.markets.draw],['2',result.markets.away],['1X',result.markets.homeOrDraw],['X2',result.markets.awayOrDraw],['12',result.markets.noDraw],['+1,5 buts',result.markets.over15],['+2,5 buts',result.markets.over25],['+3,5 buts',result.markets.over35],['BTTS',result.markets.btts]].forEach(([label,value])=>{const cell=document.createElement('div');cell.className='probability-cell';const strong=document.createElement('strong');strong.textContent=pct(value);const small=document.createElement('span');small.textContent=label;cell.append(strong,small);markets.append(cell);});
    panel.append(markets);
    const picks=document.createElement('div');picks.className='analysis-picks';
    const picksTitle=document.createElement('h4');picksTitle.textContent='MARCHÉS À ÉTUDIER';picks.append(picksTitle);
    const pickOptions=[
      ['1X · '+teamName(match.homeTeam)+' ou nul',result.markets.homeOrDraw],
      ['X2 · '+teamName(match.awayTeam)+' ou nul',result.markets.awayOrDraw],
      ['12 · Pas de match nul',result.markets.noDraw],
      ['Plus de 1,5 but',result.markets.over15],['Plus de 2,5 buts',result.markets.over25],
      ['Plus de 3,5 buts',result.markets.over35],['Victoire '+teamName(match.homeTeam),result.markets.home],
      ['Match nul',result.markets.draw],['Victoire '+teamName(match.awayTeam),result.markets.away]
    ].filter(x=>x[1]>=.65).sort((a,b)=>b[1]-a[1]);
    if(pickOptions.length)pickOptions.forEach(([label,value])=>addLine(picks,label,pct(value)+' · signal ≥ 65 %'));
    else {const none=document.createElement('p');none.className='analysis-warning';none.textContent='Aucun marché ne dépasse le seuil indicatif de 65 %.';picks.append(none);}
    const cornerNote=document.createElement('p');cornerNote.className='analysis-warning';cornerNote.textContent='Corners : données historiques non disponibles dans la source actuelle ; aucun total ne sera inventé.';picks.append(cornerNote);
    panel.append(picks);
    const form=document.createElement('p');form.className='analysis-intro';form.textContent='Forme sur les '+result.homeRows.length+' derniers matchs : '+teamName(match.homeTeam)+' ('+result.homeRows.slice(0,5).map(r=>r.form).join(' · ')+') ; '+teamName(match.awayTeam)+' ('+result.awayRows.slice(0,5).map(r=>r.form).join(' · ')+').';panel.append(form);
    const recent=document.createElement('div');recent.className='analysis-recent';
    const recentTitle=document.createElement('h4');recentTitle.textContent='DERNIERS RÉSULTATS VÉRIFIÉS';recent.append(recentTitle);
    [[teamName(match.homeTeam),result.homeRows],[teamName(match.awayTeam),result.awayRows]].forEach(([name,rows])=>{
      const teamTitle=document.createElement('p');teamTitle.className='analysis-team-title';teamTitle.textContent=name;recent.append(teamTitle);
      rows.slice(0,5).forEach(r=>addLine(recent,formatDate(r.date)+' · '+(r.home?'Domicile':'Extérieur')+' vs '+r.opponent,r.gf+' – '+r.ga+' ('+r.form+')'));
    });
    panel.append(recent);
    const venue=document.createElement('p');venue.className='analysis-intro';venue.textContent='Échantillons domicile/extérieur utilisés : '+result.homeVenueCount+' match(s) à domicile pour '+teamName(match.homeTeam)+' et '+result.awayVenueCount+' à l’extérieur pour '+teamName(match.awayTeam)+'.';panel.append(venue);
    const pick=document.createElement('p');pick.className='analysis-pick';pick.textContent=pickOptions.length?'Marchés à examiner classés par probabilité estimée ; aucun pari n’est garanti.':'Aucun signal ne dépasse le seuil retenu pour cette rencontre.';panel.append(pick);
    const caution=document.createElement('p');caution.className='analysis-warning';caution.textContent='Confiance : '+result.confidence+'. Modèle Poisson simplifié fondé sur les scores historiques chargés. Il ne connaît pas automatiquement blessures, compositions, xG ni cotes. Probabilités indicatives, non garanties ; elles ne constituent pas une garantie de gain.';panel.append(caution);
    if(result.h2h.length){const h=document.createElement('p');h.className='analysis-intro';h.textContent='Confrontations directes récentes : '+result.h2h.length+'.';panel.append(h);}
    return panel;
  }
  function createMatchCard(match) {
    const card=document.createElement('article');card.className='match-card';
    const top=document.createElement('div');top.className='match-top';
    const competition=document.createElement('span');competition.className='competition';competition.textContent=match.competition?.name||'Compétition non précisée';if(competitionPriority(match)<=2){const featured=document.createElement('span');featured.className='featured-label';featured.textContent='GRAND RENDEZ-VOUS';top.append(competition,featured);}else top.append(competition);
    const status=document.createElement('span');const labels={FINISHED:'TERMINÉ',IN_PLAY:'EN COURS',PAUSED:'PAUSE',POSTPONED:'REPORTÉ',CANCELLED:'ANNULÉ',SCHEDULED:'À VENIR'};status.textContent=labels[match.status]||'PROGRAMMÉ';top.append(status);
    const teams=document.createElement('div');teams.className='match-teams';
    const home=document.createElement('span');home.textContent=teamName(match.homeTeam)||'Équipe domicile';
    const score=document.createElement('span');score.className='versus';const hs=match.score?.fullTime?.home??match.score?.halfTime?.home,as=match.score?.fullTime?.away??match.score?.halfTime?.away;
    score.textContent=['FINISHED','IN_PLAY','PAUSED'].includes(match.status)&&hs!=null&&as!=null?hs+' - '+as:'VS';
    const away=document.createElement('span');away.className='team-away';away.textContent=teamName(match.awayTeam)||'Équipe extérieure';teams.append(home,score,away);
    const bottom=document.createElement('div');bottom.className='match-bottom';const d=new Date(match.utcDate);
    const dateLabel=document.createElement('span');dateLabel.textContent=formatDate(match.utcDate)+' · '+(Number.isNaN(d.getTime())?'--:--':timeFmt.format(d));
    const source=document.createElement('span');source.textContent=match.matchday?'Journée '+match.matchday:(match.source||'Calendrier');bottom.append(dateLabel,source);
    const button=document.createElement('button');button.className='analysis-button';button.type='button';button.textContent=state.openAnalysis===String(match.id)?'Masquer l’analyse':'Analyser le match';
    card.append(top,teams,bottom,button);
    if(state.openAnalysis===String(match.id))card.append(createAnalysis(match));
    button.addEventListener('click',()=>{state.openAnalysis=state.openAnalysis===String(match.id)?null:String(match.id);renderMatches();});
    return card;
  }
  function competitionPriority(match) {
    const name=normalizeName(match.competition?.name||'');
    const elite=[
      /uefa champions league|champions league|copa libertadores|afc champions league|caf champions league|concacaf champions cup|fifa world cup|world cup|coupe du monde|uefa euro|european championship|africa cup of nations|afcon|coupe d afrique des nations|copa america|asian cup|gold cup|olympic football/
    ];
    const continental=[
      /uefa europa league|europa league|uefa conference league|conference league|caf confederation cup|copa sudamericana|afc cup|concacaf central american cup| nations league|uefa nations league/
    ];
    const majorLeagues=[
      /premier league|la liga|laliga|serie a|bundesliga|ligue 1|eredivisie|primeira liga|liga portugal|brasileirao|brasileiro serie a|argentina liga profesional|mls|major league soccer|saudi pro league/
    ];
    if(elite.some(re=>re.test(name))) return 0;
    if(continental.some(re=>re.test(name))) return 1;
    if(majorLeagues.some(re=>re.test(name))) return 2;
    if(/cup|copa|coupe|championship|super league|division 1|first division/.test(name)) return 3;
    return 4;
  }
  function renderMatches() {
    const list=$('match-list');if(!list)return;list.replaceChildren();const now=new Date();
    const filtered=state.matches.filter(m=>{const d=new Date(m.utcDate);if(state.filter==='finished')return m.status==='FINISHED';if(state.filter==='today')return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();return !['FINISHED','CANCELLED'].includes(m.status);}).sort((a,b)=>competitionPriority(a)-competitionPriority(b)||new Date(a.utcDate)-new Date(b.utcDate));
    setText('match-count',String(filtered.length));setText('match-period',state.filter==='today'?'Rencontres du jour':state.filter==='finished'?'Résultats terminés':'Rencontres à venir');
    if(!filtered.length){const e=document.createElement('div');e.className='status-panel';e.textContent=state.filter==='finished'?'Aucun résultat terminé dans la période fournie par la source.':state.matches.length?'Aucun match dans ce filtre pour la période chargée.':'Aucune rencontre disponible pour le moment.';list.append(e);return;}
    filtered.forEach(m=>list.append(createMatchCard(m)));
  }
  function updateSourceDetails() {
    const count=state.matches.length,fd=Number(state.sources.footballData||0),espn=Number(state.sources.espn||0),history=Number(state.sources.historyMatches||0);
    setText('source-status',count?'DONNÉES CHARGÉES':'AUCUN MATCH');setText('source-detail',fd+' football-data.org · '+espn+' ESPN · '+history+' résultats historiques');
    const generated=state.generatedAt?new Date(state.generatedAt):null;
    const label=generated&&!Number.isNaN(generated.getTime())?'Dernière collecte : '+dateFmt.format(generated)+' à '+timeFmt.format(generated)+'. ':'';
    setText('report-title',count+' rencontre(s) disponibles');
    setText('report-copy',label+'Ouvre une rencontre pour consulter les statistiques disponibles. '+history+' résultats terminés avec score sont chargés. Les cotes bookmakers ne sont pas intégrées.');
    setText('settings-message','Données préparées par GitHub Actions. Les analyses utilisent les résultats terminés vérifiés des 60 derniers jours présents dans le calendrier ; si l’échantillon est trop faible, aucun pronostic ne sera affiché.');
  }
  async function loadMatches() {
    const button=$('refresh-btn');if(button){button.disabled=true;button.textContent='Chargement…';}setText('match-status','Chargement du calendrier…');
    try {
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let response;
      try{response=await fetch('./matches.json?v='+Date.now(),{cache:'no-store',signal:controller.signal});}finally{clearTimeout(timeout);}
      if(!response.ok)throw new Error('Fichier des rencontres inaccessible (HTTP '+response.status+').');
      const data=await response.json();if(!data||!Array.isArray(data.matches))throw new Error('Format du calendrier invalide : liste des matchs absente.');
      state.matches=data.matches.filter(validMatch);state.generatedAt=data.generatedAt||null;state.sources=data.sources||{};
      updateSourceDetails();setText('match-status',state.matches.length+' rencontre(s) chargée(s). Les horaires suivent le fuseau de ton téléphone.');renderMatches();
    } catch(error) {
      state.matches=[];setText('match-count','0');setText('source-status','INDISPONIBLE');setText('source-detail','Données à vérifier');
      setText('match-status',error.name==='AbortError'?'La source met trop de temps à répondre. Réessaie.':error.message||'Erreur inconnue.');
      const list=$('match-list');if(list)list.replaceChildren();setText('report-title','Données indisponibles');setText('report-copy','Aucune analyse sans calendrier valide.');setText('settings-message','Vérifie le déploiement GitHub Pages puis réessaie.');
    } finally {if(button){button.disabled=false;button.textContent='Actualiser ↻';}}
  }
  window.addEventListener('error',e=>{setText('source-status','ERREUR JAVASCRIPT');setText('match-status','Erreur JavaScript : '+(e.message||'inconnue'));});
  window.addEventListener('unhandledrejection',e=>{setText('source-status','ERREUR APPLICATION');setText('match-status','Opération échouée : '+String(e.reason?.message||e.reason||'inconnue'));});
  const refresh=$('refresh-btn');if(refresh)refresh.addEventListener('click',loadMatches);
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));state.filter=b.dataset.filter||'all';state.openAnalysis=null;renderMatches();}));
  document.querySelectorAll('.bottom-nav a').forEach(link=>link.addEventListener('click',()=>document.querySelectorAll('.bottom-nav a').forEach(x=>x.classList.toggle('active',x===link))));
  setText('today',dateFmt.format(new Date()));loadMatches();
  if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
})();