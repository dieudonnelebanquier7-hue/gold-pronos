(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { matches: [], filter: 'all', selectedCompetition: 'all', selectedDate: new Date().toLocaleDateString('en-CA'), generatedAt: null, sources: {}, openAnalysis: null, pickFilter: 'all', liveMatches: [], liveReady: false, goalAlerts: false, knownScores: {}, settings: { threshold: 0.65, minimumHistory: 5 } };
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour:'2-digit', minute:'2-digit' });
  const setText = (id,value) => { const el=$(id); if(el) el.textContent=value; };
  function formatDate(value) { const d=new Date(value); return Number.isNaN(d.getTime())?'Date non disponible':dateFmt.format(d); }
  function validMatch(m) { return m && typeof m==='object' && typeof m.utcDate==='string' && !Number.isNaN(new Date(m.utcDate).getTime()) && m.homeTeam && m.awayTeam; }
  const teamName = t => String(t?.name || '');
  const normalizeName = value => String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const teamAliases = {
    'hamburger sv':'hamburg',
    'hamburg':'hamburg',
    'hamburger sport verein':'hamburg',
    'borussia monchengladbach':'gladbach',
    'borussia moenchengladbach':'gladbach',
    'borussia mgladbach':'gladbach',
    'b monchengladbach':'gladbach',
    'gladbach':'gladbach'
  };
  const canonicalTeam = name => {
    const normalized=normalizeName(name);
    return teamAliases[normalized] || normalized;
  };
  const sameTeam = (a,b) => canonicalTeam(a)===canonicalTeam(b);
  function hasFinalScore(m) {
    const h=m.score?.fullTime?.home, a=m.score?.fullTime?.away;
    return h!==null && h!==undefined && a!==null && a!==undefined && Number.isFinite(Number(h)) && Number.isFinite(Number(a));
  }
  function resultRows(name, before) {
    const target=normalizeName(name);
    return state.matches.filter(m => m.status==='FINISHED' && new Date(m.utcDate)<before && hasFinalScore(m) &&
      (canonicalTeam(teamName(m.homeTeam))===canonicalTeam(name) || canonicalTeam(teamName(m.awayTeam))===canonicalTeam(name)))
      .sort((a,b)=>new Date(b.utcDate)-new Date(a.utcDate)).slice(0,10).map(m=>{
        const home=sameTeam(teamName(m.homeTeam),name);
        const gf=Number(m.score.fullTime[home?'home':'away']), ga=Number(m.score.fullTime[home?'away':'home']);
        const cornersFor=readCorners(m,home),cornersAgainst=readCorners(m,!home);
        return {gf,ga,home,date:m.utcDate,opponent:teamName(home?m.awayTeam:m.homeTeam),form:gf>ga?'V':gf===ga?'N':'D',cornersFor,cornersAgainst};
      });
  }
  function average(rows,key) { return rows.reduce((s,r)=>s+r[key],0)/rows.length; }
  function poisson(lambda,k) { let p=Math.exp(-lambda); for(let i=1;i<=k;i++) p*=lambda/i; return p; }
  function poissonAtLeast(lambda,minimum) {
    let term=Math.exp(-lambda), cumulative=term;
    for(let k=1;k<minimum;k++){term*=lambda/k;cumulative+=term;}
    return Math.max(0,Math.min(1,1-cumulative));
  }
  function buildProbabilities(homeLambda,awayLambda) {
    const h=Array.from({length:21},(_,i)=>poisson(homeLambda,i)), a=Array.from({length:21},(_,i)=>poisson(awayLambda,i));
    let home=0,draw=0,away=0,btts=0;
    for(let i=0;i<21;i++) for(let j=0;j<21;j++) {
      const p=h[i]*a[j]; if(i>j)home+=p; else if(i===j)draw+=p; else away+=p;
      if(i>0&&j>0)btts+=p;
    }
    const totalLambda=homeLambda+awayLambda;
    return {home,draw,away,btts,over15:poissonAtLeast(totalLambda,2),over25:poissonAtLeast(totalLambda,3),over35:poissonAtLeast(totalLambda,4),expectedGoals:totalLambda};
  }
  function readCorners(match,homeSide) {
    const direct=match.statistics?.[homeSide?'homeCorners':'awayCorners'];
    if(direct!==null&&direct!==undefined&&Number.isFinite(Number(direct)))return Number(direct);
    return null;
  }
  function pct(v) { return Math.round(v*100)+' %'; }
  function loadSettings() {
    try {
      const saved=JSON.parse(localStorage.getItem('gold-pronos-settings')||'{}');
      const threshold=Number(saved.threshold), minimumHistory=Number(saved.minimumHistory);
      if([0.60,0.65,0.70,0.75,0.80].includes(threshold))state.settings.threshold=threshold;
      if([3,5,8,10].includes(minimumHistory))state.settings.minimumHistory=minimumHistory;
    } catch(_) {}
    const t=$('probability-threshold'), h=$('minimum-history');
    if(t)t.value=String(state.settings.threshold);
    if(h)h.value=String(state.settings.minimumHistory);
  }
  function saveSettings() {
    const t=$('probability-threshold'), h=$('minimum-history');
    state.settings.threshold=t?Number(t.value):0.65;
    state.settings.minimumHistory=h?Number(h.value):5;
    try{localStorage.setItem('gold-pronos-settings',JSON.stringify(state.settings));}catch(_){}
    state.openAnalysis=null;
    renderMatches();
    renderFeaturedPicks();
    setText('settings-message','Réglages enregistrés sur cet appareil. Seuil : '+pct(state.settings.threshold)+' · Historique minimum : '+state.settings.minimumHistory+' matchs par équipe.');
  }
  function analyze(match) {
    const kickoff=new Date(match.utcDate), hn=teamName(match.homeTeam), an=teamName(match.awayTeam);
    const homeRows=resultRows(hn,kickoff), awayRows=resultRows(an,kickoff);
    if(homeRows.length<state.settings.minimumHistory || awayRows.length<state.settings.minimumHistory) return {ready:false,homeRows,awayRows,reason:'Historique insuffisant : au moins '+state.settings.minimumHistory+' scores terminés vérifiés par équipe sont nécessaires. La collecte historique est en cours ou la compétition n’est pas couverte.'};
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
    const homeCornerRows=homeRows.filter(r=>Number.isFinite(r.cornersFor)&&Number.isFinite(r.cornersAgainst));
    const awayCornerRows=awayRows.filter(r=>Number.isFinite(r.cornersFor)&&Number.isFinite(r.cornersAgainst));
    let cornerMarkets=null;
    if(homeCornerRows.length>=5&&awayCornerRows.length>=5) {
      const hFor=average(homeCornerRows,'cornersFor'), hAgainst=average(homeCornerRows,'cornersAgainst');
      const aFor=average(awayCornerRows,'cornersFor'), aAgainst=average(awayCornerRows,'cornersAgainst');
      const expectedHomeCorners=(hFor+aAgainst)/2, expectedAwayCorners=(aFor+hAgainst)/2;
      const expectedTotalCorners=expectedHomeCorners+expectedAwayCorners;
      cornerMarkets={expectedHomeCorners,expectedAwayCorners,expectedTotalCorners,over75:poissonAtLeast(expectedTotalCorners,8),over85:poissonAtLeast(expectedTotalCorners,9),over95:poissonAtLeast(expectedTotalCorners,10),over105:poissonAtLeast(expectedTotalCorners,11),sample:homeCornerRows.length+awayCornerRows.length};
    }
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
      ((sameTeam(teamName(m.homeTeam),hn)&&sameTeam(teamName(m.awayTeam),an))||
       (sameTeam(teamName(m.homeTeam),an)&&sameTeam(teamName(m.awayTeam),hn))))
      .sort((a,b)=>new Date(b.utcDate)-new Date(a.utcDate)).slice(0,5);
    return {ready:true,homeRows,awayRows,homeLambda,awayLambda,probs,markets,cornerMarkets,best,confidence,h2h,sample,homeVenueCount:homeVenue.length,awayVenueCount:awayVenue.length};
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
    const quick=document.createElement('div');quick.className='analysis-quick-summary';
    const quickLabel=document.createElement('span');quickLabel.className='quick-label';quickLabel.textContent='RÉSUMÉ RAPIDE';quick.append(quickLabel);
    const quickPick=document.createElement('strong');quickPick.className='quick-pick';
    const best=result.best;
    if(best&&best[1]>=state.settings.threshold) quickPick.textContent=best[0]+' · '+pct(best[1]);
    else quickPick.textContent='Aucun signal ne dépasse le seuil choisi';
    quick.append(quickPick);
    const quickMeta=document.createElement('span');quickMeta.className='quick-meta';quickMeta.textContent='Confiance '+result.confidence+' · '+result.homeRows.length+' / '+result.awayRows.length+' matchs analysés';quick.append(quickMeta);
    panel.append(quick);
    const details=document.createElement('details');details.className='analysis-details';
    const summary=document.createElement('summary');summary.textContent='Voir l’analyse détaillée';details.append(summary);
    const intro=document.createElement('p');intro.className='analysis-intro';intro.textContent='Estimation statistique indicative basée sur '+result.homeRows.length+' matchs de '+teamName(match.homeTeam)+' et '+result.awayRows.length+' de '+teamName(match.awayTeam)+'.';details.append(intro);
    const grid=document.createElement('div');grid.className='analysis-stats';
    addLine(grid,'Buts moyens domicile (équipe 1)',result.homeRows.length?average(result.homeRows,'gf').toFixed(2):'—');
    addLine(grid,'Buts encaissés moyens (équipe 1)',average(result.homeRows,'ga').toFixed(2));
    addLine(grid,'Buts moyens (équipe 2)',average(result.awayRows,'gf').toFixed(2));
    addLine(grid,'Buts encaissés moyens (équipe 2)',average(result.awayRows,'ga').toFixed(2));
    details.append(grid);
    const expected=document.createElement('p');expected.className='analysis-intro';expected.textContent='Buts attendus par le modèle : '+result.homeLambda.toFixed(2)+' – '+result.awayLambda.toFixed(2)+' (total '+result.probs.expectedGoals.toFixed(2)+'). Le +2,5 est calculé sur le total attendu, pas sur une cote bookmaker.';details.append(expected);
    const markets=document.createElement('div');markets.className='probability-grid';
    [['1',result.markets.home],['N',result.markets.draw],['2',result.markets.away],['1X',result.markets.homeOrDraw],['X2',result.markets.awayOrDraw],['12',result.markets.noDraw],['+1,5 buts',result.markets.over15],['+2,5 buts',result.markets.over25],['+3,5 buts',result.markets.over35],['BTTS',result.markets.btts]].forEach(([label,value])=>{const cell=document.createElement('div');cell.className='probability-cell';const strong=document.createElement('strong');strong.textContent=pct(value);const small=document.createElement('span');small.textContent=label;cell.append(strong,small);markets.append(cell);});
    details.append(markets);
    const picks=document.createElement('div');picks.className='analysis-picks';
    const picksTitle=document.createElement('h4');picksTitle.textContent='MARCHÉS À ÉTUDIER';picks.append(picksTitle);
    const pickOptions=[
      ['1X · '+teamName(match.homeTeam)+' ou nul',result.markets.homeOrDraw],
      ['X2 · '+teamName(match.awayTeam)+' ou nul',result.markets.awayOrDraw],
      ['12 · Pas de match nul',result.markets.noDraw],
      ['Plus de 1,5 but',result.markets.over15],['Plus de 2,5 buts',result.markets.over25],
      ['Plus de 3,5 buts',result.markets.over35],['Victoire '+teamName(match.homeTeam),result.markets.home],
      ['Match nul',result.markets.draw],['Victoire '+teamName(match.awayTeam),result.markets.away]
    ].filter(x=>x[1]>=state.settings.threshold).sort((a,b)=>b[1]-a[1]);
    if(pickOptions.length)pickOptions.forEach(([label,value])=>addLine(picks,label,pct(value)+' · seuil choisi : '+pct(state.settings.threshold)));
    else {const none=document.createElement('p');none.className='analysis-warning';none.textContent='Aucun marché ne dépasse le seuil indicatif de 65 %.';picks.append(none);}
    if(result.cornerMarkets) {
      const c=result.cornerMarkets;
      [['Corners attendus (domicile)',c.expectedHomeCorners],['Corners attendus (extérieur)',c.expectedAwayCorners],['Total corners attendu',c.expectedTotalCorners],['+7,5 corners',c.over75],['+8,5 corners',c.over85],['+9,5 corners',c.over95],['+10,5 corners',c.over105]].forEach(([label,value])=>addLine(picks,label,typeof value==='number'&&value<=1?pct(value):Number(value).toFixed(2)));
      const note=document.createElement('p');note.className='analysis-warning';note.textContent='Estimation corners issue de '+c.sample+' observations récentes avec statistiques disponibles. À interpréter avec prudence.';picks.append(note);
    } else {
      const cornerNote=document.createElement('p');cornerNote.className='analysis-warning';cornerNote.textContent='Corners : la source ne fournit pas encore au moins 5 matchs avec statistiques complètes pour chaque équipe. Aucun pourcentage corners ne sera inventé.';picks.append(cornerNote);
    }
    details.append(picks);
    const form=document.createElement('p');form.className='analysis-intro';form.textContent='Forme sur les '+result.homeRows.length+' derniers matchs : '+teamName(match.homeTeam)+' ('+result.homeRows.slice(0,5).map(r=>r.form).join(' · ')+') ; '+teamName(match.awayTeam)+' ('+result.awayRows.slice(0,5).map(r=>r.form).join(' · ')+').';details.append(form);
    const recent=document.createElement('div');recent.className='analysis-recent';
    const recentTitle=document.createElement('h4');recentTitle.textContent='DERNIERS RÉSULTATS VÉRIFIÉS';recent.append(recentTitle);
    [[teamName(match.homeTeam),result.homeRows],[teamName(match.awayTeam),result.awayRows]].forEach(([name,rows])=>{
      const teamTitle=document.createElement('p');teamTitle.className='analysis-team-title';teamTitle.textContent=name;recent.append(teamTitle);
      rows.slice(0,5).forEach(r=>addLine(recent,formatDate(r.date)+' · '+(r.home?'Domicile':'Extérieur')+' vs '+r.opponent,r.gf+' – '+r.ga+' ('+r.form+')'));
    });
    details.append(recent);
    const venue=document.createElement('p');venue.className='analysis-intro';venue.textContent='Échantillons domicile/extérieur utilisés : '+result.homeVenueCount+' match(s) à domicile pour '+teamName(match.homeTeam)+' et '+result.awayVenueCount+' à l’extérieur pour '+teamName(match.awayTeam)+'.';details.append(venue);
    const pick=document.createElement('p');pick.className='analysis-pick';pick.textContent=pickOptions.length?'Marchés à examiner classés par probabilité estimée ; aucun pari n’est garanti.':'Aucun signal ne dépasse le seuil retenu pour cette rencontre.';details.append(pick);
    const caution=document.createElement('p');caution.className='analysis-warning';caution.textContent='Confiance : '+result.confidence+'. Modèle Poisson simplifié fondé sur les scores historiques chargés. Il ne connaît pas automatiquement blessures, compositions, xG ni cotes. Probabilités indicatives, non garanties ; elles ne constituent pas une garantie de gain.';details.append(caution);
    if(result.h2h.length){const h=document.createElement('p');h.className='analysis-intro';h.textContent='Confrontations directes récentes : '+result.h2h.length+'.';details.append(h);}
    panel.append(details);
    return panel;
  }
  function createMatchCard(match) {
    const card=document.createElement('article');const statusKey=String(match.status||'').toUpperCase();card.className='match-card '+(['IN_PLAY','LIVE','HALFTIME','PAUSED','EXTRA_TIME','PENALTY_SHOOTOUT'].includes(statusKey)?'status-live':statusKey==='FINISHED'?'status-finished':'status-upcoming');
    const top=document.createElement('div');top.className='match-top';
    const competition=document.createElement('span');competition.className='competition';competition.textContent=match.competition?.name||'Compétition non précisée';if(competitionOrder(match)<=5 || /champions league|ligue des champions|europa league|conference league|world cup|coupe du monde|africa cup of nations|afcon|copa libertadores/.test(normalizeName(match.competition?.name||''))){const featured=document.createElement('span');featured.className='featured-label';featured.textContent='GRAND RENDEZ-VOUS';top.append(competition,featured);}else top.append(competition);
    const status=document.createElement('span');const labels={FINISHED:'TERMINÉ',IN_PLAY:'EN COURS',LIVE:'EN DIRECT',HALFTIME:'MI-TEMPS',PAUSED:'MI-TEMPS',EXTRA_TIME:'PROLONGATION',PENALTY_SHOOTOUT:'TIRS AU BUT',POSTPONED:'REPORTÉ',CANCELLED:'ANNULÉ',SUSPENDED:'SUSPENDU',SCHEDULED:'À VENIR'};status.textContent=labels[match.status]||'PROGRAMMÉ';top.append(status);
    const teams=document.createElement('div');teams.className='match-teams';
    const home=document.createElement('span');home.textContent=teamName(match.homeTeam)||'Équipe domicile';
    const score=document.createElement('span');score.className='versus';const hs=match.score?.fullTime?.home??match.score?.halfTime?.home,as=match.score?.fullTime?.away??match.score?.halfTime?.away;
    score.textContent=['FINISHED','IN_PLAY','LIVE','HALFTIME','PAUSED','EXTRA_TIME','PENALTY_SHOOTOUT'].includes(String(match.status||'').toUpperCase())&&hs!=null&&as!=null?hs+' - '+as:'VS';
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
  function competitionOrder(match) {
    const name=normalizeName(match.competition?.name||'');
    // Priorité éditoriale : grands championnats, grandes compétitions, puis autres ligues.
    const eliteLeagues=[
      /premier league/, /la liga|laliga|primera division/, /serie a/, /bundesliga/, /ligue 1/
    ];
    const continental=[
      /champions league|ligue des champions/, /europa league|ligue europa/,
      /conference league|ligue conference/, /world cup|coupe du monde|uefa euro|european championship/,
      /africa cup of nations|afcon|coupe d afrique des nations|copa america|asian cup|gold cup/,
      /copa libertadores|afc champions|caf champions|concacaf champions|club world cup|olympic football|jeux olympiques/
    ];
    const otherStrong=[
      /eredivisie/, /primeira liga|liga portugal/, /pro league|jupiler/, /saudi pro league/,
      /scottish premiership/, /mls|major league soccer/, /brasileirao|brasileiro serie a|brazilian serie a/,
      /argentina liga profesional|liga profesional argentina/, /super lig/, /eliteserien/,
      /allsvenskan/, /swiss super league/, /czech first league/, /russian premier league/,
      /chinese super league/, /j1 league/, /liga mx/
    ];
    const secondTiers=[
      /ligue 2/, /championship/, /segunda division|la liga 2/
    ];
    let index=eliteLeagues.findIndex(pattern=>pattern.test(name));
    if(index>=0)return index;
    index=continental.findIndex(pattern=>pattern.test(name));
    if(index>=0)return 5+index;
    index=otherStrong.findIndex(pattern=>pattern.test(name));
    if(index>=0)return 20+index;
    index=secondTiers.findIndex(pattern=>pattern.test(name));
    if(index>=0)return 60+index;
    return 100;
  }
  function competitionName(match) {
    return (match.competition?.name||'Autres compétitions').trim();
  }
  function renderFeaturedPicks() {
    const host=$('featured-picks');if(!host)return;host.replaceChildren();
    const now=new Date();
    const today=state.matches.filter(m=>{
      const d=new Date(m.utcDate);
      return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate()&&
        !['IN_PLAY','LIVE','HALFTIME','PAUSED','EXTRA_TIME','PENALTY_SHOOTOUT','FINISHED','CANCELLED','POSTPONED','SUSPENDED'].includes(String(m.status||'').toUpperCase());
    });
    const groups={
      all:['1N2','double','goals','btts','corners'],
      result:['1N2'],double:['double'],goals:['goals'],btts:['btts'],corners:['corners']
    };
    const picks=[];
    today.forEach(match=>{
      const result=analyze(match);if(!result.ready)return;
      const markets=[
        {label:'1 · Victoire domicile',p:result.markets.home,type:'1N2'},
        {label:'N · Match nul',p:result.markets.draw,type:'1N2'},
        {label:'2 · Victoire extérieur',p:result.markets.away,type:'1N2'},
        {label:'1X · Double chance domicile',p:result.markets.homeOrDraw,type:'double'},
        {label:'X2 · Double chance extérieur',p:result.markets.awayOrDraw,type:'double'},
        {label:'12 · Pas de match nul',p:result.markets.noDraw,type:'double'},
        {label:'Plus de 1,5 buts',p:result.markets.over15,type:'goals'},
        {label:'Moins de 1,5 buts',p:1-result.markets.over15,type:'goals'},
        {label:'Plus de 2,5 buts',p:result.markets.over25,type:'goals'},
        {label:'Moins de 2,5 buts',p:1-result.markets.over25,type:'goals'},
        {label:'Plus de 3,5 buts',p:result.markets.over35,type:'goals'},
        {label:'Moins de 3,5 buts',p:1-result.markets.over35,type:'goals'},
        {label:'Les deux équipes marquent',p:result.markets.btts,type:'btts'}
      ];
      if(result.cornerMarkets)markets.push(
        {label:'Plus de 7,5 corners',p:result.cornerMarkets.over75,type:'corners'},
        {label:'Plus de 8,5 corners',p:result.cornerMarkets.over85,type:'corners'},
        {label:'Plus de 9,5 corners',p:result.cornerMarkets.over95,type:'corners'},
        {label:'Plus de 10,5 corners',p:result.cornerMarkets.over105,type:'corners'}
      );
      const allowed=groups[state.pickFilter]||groups.all;
      const best=markets.filter(x=>allowed.includes(x.type)&&Number.isFinite(x.p)&&x.p>=state.settings.threshold).sort((a,b)=>b.p-a.p)[0];
      if(best)picks.push({match,label:best.label,probability:best.p,confidence:result.confidence,type:best.type});
    });
    picks.sort((a,b)=>b.probability-a.probability||new Date(a.match.utcDate)-new Date(b.match.utcDate));
    const title=document.createElement('h3');title.textContent='PRONOSTICS FOOTBALL DU JOUR';host.append(title);
    const sub=document.createElement('p');sub.className='featured-picks-subtitle';sub.textContent=today.length+' rencontre(s) programmée(s) · Sélections calculées sur les historiques disponibles';host.append(sub);
    const filters=document.createElement('div');filters.className='pick-market-filters';
    [['all','Tous'],['result','1N2'],['double','Double chance'],['goals','Moins / Plus'],['btts','Les 2 marquent'],['corners','Corners']].forEach(([key,label])=>{
      const b=document.createElement('button');b.type='button';b.className='pick-filter'+(state.pickFilter===key?' active':'');b.dataset.market=key;b.textContent=label;
      b.addEventListener('click',()=>{state.pickFilter=key;renderFeaturedPicks();});filters.append(b);
    });
    host.append(filters);
    if(!picks.length){
      const empty=document.createElement('p');empty.className='featured-picks-empty';
      empty.textContent=today.length?'Aucun pronostic ne passe le seuil de '+pct(state.settings.threshold)+' avec les données historiques disponibles pour ce type de pari.':'Aucune rencontre programmée aujourd’hui dans les données chargées.';
      host.append(empty);return;
    }
    const conviction=document.createElement('article');conviction.className='daily-conviction';
    const kicker=document.createElement('span');kicker.textContent='CONVICTION DU JOUR';
    const best=picks[0];const fixture=document.createElement('strong');fixture.textContent=teamName(best.match.homeTeam)+' – '+teamName(best.match.awayTeam);
    const choice=document.createElement('b');choice.textContent=best.label+' · '+pct(best.probability);
    const detail=document.createElement('small');detail.textContent=competitionName(best.match)+' · '+timeFmt.format(new Date(best.match.utcDate))+' · Confiance '+best.confidence;
    conviction.append(kicker,fixture,choice,detail);host.append(conviction);
    const list=document.createElement('div');list.className='daily-picks-list';
    picks.slice(0,20).forEach((pick,index)=>{
      const card=document.createElement('article');card.className='daily-pick-card';
      const meta=document.createElement('small');meta.textContent=timeFmt.format(new Date(pick.match.utcDate))+' · '+competitionName(pick.match);
      const teams=document.createElement('strong');teams.textContent=teamName(pick.match.homeTeam)+' – '+teamName(pick.match.awayTeam);
      const market=document.createElement('span');market.className='daily-pick-market';market.textContent=pick.label;
      const probability=document.createElement('b');probability.className='daily-pick-probability';probability.textContent=pct(pick.probability);
      const button=document.createElement('button');button.type='button';button.className='daily-pick-detail';button.textContent='Voir l’analyse';
      button.addEventListener('click',()=>{showPage('page-analysis');const select=$('analysis-match-select');if(select){select.value=String(pick.match.id);renderAnalysisPicker();}window.scrollTo({top:0,behavior:'smooth'});});
      card.append(meta,teams,market,probability,button);list.append(card);
    });
    host.append(list);
    const note=document.createElement('p');note.className='featured-picks-note';note.textContent='Probabilités indicatives du modèle, et non des cotes bookmaker. Les matchs sans historique suffisant et les statistiques corners absentes sont exclus. Aucun pari n’est garanti.';
    host.append(note);
  }
  function updateMatchCompetitionOptions() {
    const select=$('match-competition-select');if(!select)return;
    const previous=state.selectedCompetition;
    const catalogue=typeof LEAGUE_LIST!=='undefined'?LEAGUE_LIST:[];
    const options=new Map(catalogue.map(([code,name])=>[name,{code,name}]));
    state.matches.forEach(m=>{const name=competitionName(m);if(!options.has(name))options.set(name,{code:'',name});});
    const names=[...options.values()].sort((a,b)=>competitionOrder({competition:{name:a.name}})-competitionOrder({competition:{name:b.name}})||a.name.localeCompare(b.name,'fr'));
    select.replaceChildren();
    const all=document.createElement('option');all.value='all';all.textContent='Toutes les compétitions';select.append(all);
    const africa=document.createElement('optgroup');africa.label='AFRIQUE · CAF ET CHAMPIONNATS NATIONAUX';
    const africanNames=names.filter(x=>/caf|africa|afcon|afrique|south africa|nigeria|ghana|egypt|morocco|tunisia|algeria|senegal|ivory coast|cameroon|tanzania|angola/i.test(x.name+' '+x.code));
    africanNames.forEach(x=>{const o=document.createElement('option');o.value=x.name;o.textContent=x.name;africa.append(o);});
    if(africa.children.length)select.append(africa);
    const other=document.createElement('optgroup');other.label='EUROPE · AMÉRIQUES · ASIE · INTERNATIONAL';
    names.filter(x=>!africanNames.includes(x)).forEach(x=>{const o=document.createElement('option');o.value=x.name;o.textContent=x.name;other.append(o);});
    if(other.children.length)select.append(other);
    select.value=names.some(x=>x.name===previous)?previous:'all';state.selectedCompetition=select.value;
  }
  function localDateKey(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function shiftMatchDate(days){
    const input=$('match-date');const base=new Date((state.selectedDate||localDateKey(new Date()))+'T12:00:00');base.setDate(base.getDate()+days);
    state.selectedDate=localDateKey(base);if(input)input.value=state.selectedDate;renderMatches();
  }
  function competitionRegion(match){
    const raw=String(match.competition?.code||'').replace(/^ESPN-/,'').toLowerCase();
    const prefix=raw.split('.')[0];
    const regions={eng:'Angleterre',esp:'Espagne',ger:'Allemagne',ita:'Italie',fra:'France',ned:'Pays-Bas',por:'Portugal',tur:'Turquie',nor:'Norvège',swe:'Suède',sui:'Suisse',ksa:'Arabie saoudite',cze:'Tchéquie',usa:'États-Unis',rou:'Roumanie',rus:'Russie',chn:'Chine',jpn:'Japon',bra:'Brésil',arg:'Argentine',mex:'Mexique',rsa:'Afrique du Sud',nga:'Nigeria',gha:'Ghana',egy:'Égypte',mar:'Maroc',tun:'Tunisie',sen:'Sénégal',caf:'Afrique · CAF',uefa:'Europe · UEFA',conmebol:'Amérique du Sud',concacaf:'Amérique du Nord',afc:'Asie · AFC',fifa:'International'};
    if(regions[prefix])return regions[prefix];
    const name=competitionName(match);
    if(/caf|africa|afcon|afrique/i.test(name))return 'Afrique · CAF';
    if(/uefa|champions league|europa league|conference league/i.test(name))return 'Europe · UEFA';
    return 'Autres compétitions';
  }
  function renderMatches() {
    const list=$('match-list');if(!list)return;list.replaceChildren();
    const isLive=m=>['IN_PLAY','PAUSED','LIVE','HALFTIME','EXTRA_TIME','PENALTY_SHOOTOUT'].includes(String(m.status||'').toUpperCase());
    const day=state.selectedDate||localDateKey(new Date());
    const filtered=state.matches.filter(m=>{
      if(localDateKey(m.utcDate)!==day)return false;
      if(state.filter==='live')return isLive(m);
      if(state.filter==='finished')return m.status==='FINISHED'&&hasFinalScore(m);
      if(state.filter==='upcoming')return !isLive(m)&&!['FINISHED','CANCELLED','POSTPONED','SUSPENDED'].includes(String(m.status||'').toUpperCase());
      return !['CANCELLED','POSTPONED','SUSPENDED'].includes(String(m.status||'').toUpperCase());
    }).filter(m=>state.selectedCompetition==='all'||competitionName(m)===state.selectedCompetition)
      .sort((a,b)=>competitionOrder(a)-competitionOrder(b)||competitionName(a).localeCompare(competitionName(b),'fr')||new Date(a.utcDate)-new Date(b.utcDate));
    const liveCount=filtered.filter(isLive).length, upcomingCount=filtered.filter(m=>!isLive(m)&&!['FINISHED','CANCELLED','POSTPONED','SUSPENDED'].includes(String(m.status||'').toUpperCase())).length, finishedCount=filtered.filter(m=>m.status==='FINISHED'&&hasFinalScore(m)).length;
    setText('match-count',String(filtered.length));
    setText('match-period',state.filter==='live'?'En direct':state.filter==='today'?'Aujourd’hui':state.filter==='finished'?'Terminés':state.filter==='upcoming'?'À venir':'Tous les matchs');
    setText('match-live-count',String(liveCount));setText('match-upcoming-count',String(upcomingCount));setText('match-finished-count',String(finishedCount));
    const dateLabel=$('match-date-label');if(dateLabel){const d=new Date(day+'T12:00:00');dateLabel.textContent=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});}
    if(!filtered.length){const e=document.createElement('div');e.className='status-panel';e.textContent=state.filter==='live'?'Aucun match en direct détecté pour cette date dans les données reçues.':state.filter==='finished'?'Aucun résultat terminé disponible pour cette date.':state.matches.length?'Aucun match disponible pour cette date ou cette compétition.':'Le calendrier est en cours de chargement.';list.append(e);return;}
    const regions=new Map();filtered.forEach(m=>{const region=competitionRegion(m);if(!regions.has(region))regions.set(region,new Map());const leagues=regions.get(region),name=competitionName(m);if(!leagues.has(name))leagues.set(name,[]);leagues.get(name).push(m);});
    regions.forEach((leagues,region)=>{
      if(regions.size>1){const country=document.createElement('h3');country.className='region-heading';country.textContent=region;list.append(country);}
      leagues.forEach((matches,name)=>{
        const heading=document.createElement('h4');heading.className='competition-heading';heading.textContent=name+' · '+matches.length;list.append(heading);
        matches.forEach(m=>list.append(createMatchCard(m)));
      });
    });
  }
  function renderAnalysisPicker() {
    const select=$('analysis-match-select'), output=$('daily-analysis-result');
    if(!select||!output)return;
    const upcoming=state.matches.filter(m=>!['FINISHED','CANCELLED','POSTPONED','SUSPENDED'].includes(m.status))
      .sort((a,b)=>competitionOrder(a)-competitionOrder(b)||new Date(a.utcDate)-new Date(b.utcDate));
    const previous=select.value;select.replaceChildren();
    const first=document.createElement('option');first.value='';first.textContent='— Choisir une rencontre —';select.append(first);
    upcoming.forEach(match=>{const option=document.createElement('option');option.value=String(match.id);option.textContent=(match.competition?.name||'Autre')+' · '+teamName(match.homeTeam)+' - '+teamName(match.awayTeam)+' · '+timeFmt.format(new Date(match.utcDate));select.append(option);});
    if(upcoming.some(m=>String(m.id)===previous))select.value=previous;else if(upcoming.length)select.value=String(upcoming[0].id);
    const selected=upcoming.find(m=>String(m.id)===select.value);output.replaceChildren();
    if(selected)output.append(createAnalysis(selected));else{const empty=document.createElement('div');empty.className='status-panel';empty.textContent='Aucune rencontre à analyser dans le calendrier chargé.';output.append(empty);}
  }

  const LEAGUE_LIST=[['caf.champions','Ligue des champions CAF'],['caf.confed','Coupe de la Confédération CAF'],['caf.nations','Coupe d’Afrique des nations'],['fifa.worldq.caf','Qualifications Coupe du monde – Afrique'],['rsa.1','Premier Soccer League (Afrique du Sud)'],['nga.1','Nigeria Premier League'],['gha.1','Ghana Premier League'],['eng.1','Premier League'],['eng.2','Championship'],['esp.1','La Liga'],['esp.2','Segunda División'],['ger.1','Bundesliga'],['ita.1','Serie A'],['fra.1','Ligue 1'],['ned.1','Eredivisie'],['por.1','Primeira Liga'],['tur.1','Süper Lig'],['nor.1','Eliteserien'],['swe.1','Allsvenskan'],['sui.1','Swiss Super League'],['ksa.1','Saudi Pro League'],['cze.1','Czech First League'],['usa.1','MLS'],['rou.1','Liga I'],['rus.1','Russian Premier League'],['chn.1','Chinese Super League'],['jpn.1','J1 League'],['bra.1','Brasileirão'],['arg.1','Liga Profesional Argentina'],['mex.1','Liga MX'],['uefa.champions','Ligue des champions'],['uefa.europa','Ligue Europa'],['uefa.europa.conf','Ligue Conférence']];
  async function leagueJson(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(14000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
  function leagueEntries(x,out=[]){if(!x||typeof x!=='object')return out;if(Array.isArray(x.entries))out.push(...x.entries);if(Array.isArray(x.children))x.children.forEach(v=>leagueEntries(v,out));if(x.standings)leagueEntries(x.standings,out);return out;}
  function leagueStat(entry,keys){for(const s of entry.stats||[]){const n=String(s.name||s.abbreviation||s.displayName||'').toLowerCase();if(keys.some(k=>n.includes(k)))return s.displayValue??s.value??'—';}return '—';}
  function renderLeagueTable(data,hostId='league-standings'){
    const host=$(hostId);if(!host)return;host.replaceChildren();const entries=leagueEntries(data.standings||data);
    if(!entries.length){host.textContent='Classement indisponible pour cette compétition.';return;}
    const table=document.createElement('table');table.className='league-standings-table';table.innerHTML='<thead><tr><th>#</th><th>Équipe</th><th>MJ</th><th>V</th><th>N</th><th>D</th><th>BP</th><th>BC</th><th>Diff.</th><th>Pts</th></tr></thead>';
    const body=document.createElement('tbody');entries.forEach((e,i)=>{const tr=document.createElement('tr');if(i===0)tr.className='league-first';const team=e.team||{};const vals=[i+1,team.displayName||team.name||e.name||'Équipe',leagueStat(e,['gamesplayed','played','gp']),leagueStat(e,['wins','win']),leagueStat(e,['ties','draw']),leagueStat(e,['losses','loss']),leagueStat(e,['pointsfor','goalsfor','gf']),leagueStat(e,['pointsagainst','goalsagainst','ga']),leagueStat(e,['pointdifferential','goaldifference','gd']),leagueStat(e,['points','pts'])];vals.forEach((v,j)=>{const td=document.createElement('td');td.textContent=v;if(j===1)td.className='team-cell';tr.append(td);});body.append(tr);});table.append(body);host.append(table);
  }
  async function renderLeagueLeaders(data,type){
    const host=$(type==='goals'?'league-scorers':'league-assists');host.replaceChildren();
    const cats=Array.isArray(data.categories)?data.categories:Object.values(data.categories||data.leaders||{});
    const cat=cats.find(x=>{const n=String(x.name||x.displayName||x.abbreviation||'').toLowerCase();return type==='goals'?/goal|scor|but/.test(n):/assist|pass/.test(n);});
    const leaders=(cat?.leaders||cat?.items||[]).slice(0,5);
    if(!leaders.length){host.textContent='Statistiques non publiées par la source.';return;}
    for(let i=0;i<leaders.length;i++){
      const item=leaders[i];let athlete=item.athlete||item.player||{};
      try{if(typeof athlete==='string')athlete=await leagueJson(athlete);else if(athlete.$ref)athlete=await leagueJson(athlete.$ref);}catch(_){}
      const row=document.createElement('div');row.className='leader-row';const rank=document.createElement('b');rank.textContent=String(i+1).padStart(2,'0');const name=document.createElement('strong');name.textContent=athlete.displayName||athlete.fullName||athlete.name||'Joueur';const value=document.createElement('b');value.className='leader-value';value.textContent=item.displayValue||item.value||'—';row.append(rank,name,value);host.append(row);
    }
  }
  async function loadLeagueHub(){
    const select=$('league-select');if(!select)return;
    if(!select.options.length)LEAGUE_LIST.forEach(([id,name])=>{const o=document.createElement('option');o.value=id;o.textContent=name;select.append(o);});
    const league=LEAGUE_LIST.find(x=>x[0]===select.value)||LEAGUE_LIST[0];setText('league-updated','Chargement de '+league[1]+'…');
    const results=await Promise.allSettled([leagueJson('https://site.api.espn.com/apis/v2/sports/soccer/'+league[0]+'/standings'),leagueJson('https://sports.core.api.espn.com/v2/sports/soccer/leagues/'+league[0]+'/leaders?limit=100')]);
    if(results[0].status==='fulfilled')renderLeagueTable(results[0].value);else $('league-standings').textContent='Classement indisponible actuellement.';
    if(results[1].status==='fulfilled')await Promise.all([renderLeagueLeaders(results[1].value,'goals'),renderLeagueLeaders(results[1].value,'assists')]);else{$('league-scorers').textContent='Buteurs indisponibles.';$('league-assists').textContent='Passeurs indisponibles.';}
    setText('league-updated',league[1]+' · Dernière vérification : '+timeFmt.format(new Date())+'. Les données absentes ne sont pas estimées.');
  }


  const CLUB_COMPETITIONS=[...LEAGUE_LIST,['fifa.world','Coupe du monde'],['uefa.euro','Euro'],['caf.nations','Coupe d’Afrique des nations'],['conmebol.copa','Copa América'],['concacaf.gold','Gold Cup'],['afc.asian.cup','Coupe d’Asie'],['uefa.nations','Ligue des nations']];
  const NATIONAL_COMPETITIONS=['fifa.world','uefa.euro','caf.nations','conmebol.copa','concacaf.gold','afc.asian.cup','uefa.nations'];
  const CLUB_ESPN='https://site.api.espn.com/apis/site/v2/sports/soccer/';
  async function clubFetch(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(14000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
  function getTeamArray(data){const groups=data?.sports?.[0]?.leagues||data?.leagues||[];for(const group of groups){if(Array.isArray(group.teams))return group.teams.map(x=>x.team||x);}if(Array.isArray(data?.teams))return data.teams.map(x=>x.team||x);return [];}
  function renderClubProfile(team,competition,rosterData){
    const host=$('club-results');
    const name=team.displayName||team.name||team.shortDisplayName||'Équipe';
    const country=team.country?.name||team.country?.displayName||team.nationality||team.location||team.address?.city||'Nationalité / pays non communiqué';
    const coaches=team.coaches||team.coach?[...(team.coaches||[]),...(team.coach?[team.coach]:[])]:[];
    const logo=team.logos?.[0]?.href||team.logo||team.logos?.[0]?.url||'';
    const card=document.createElement('article');card.className='club-profile-card';
    if(logo){const img=document.createElement('img');img.src=logo;img.alt='Emblème '+name;img.loading='lazy';card.append(img);}
    const title=document.createElement('h3');title.textContent=name;card.append(title);
    const comp=document.createElement('p');comp.className='club-meta';comp.textContent='Compétition : '+competition;card.append(comp);
    const countryLine=document.createElement('p');countryLine.textContent='Pays / nationalité : '+country;card.append(countryLine);
    const nickname=document.createElement('p');nickname.textContent='Surnom : '+(team.nickname||team.alternateNames?.[0]||'Non communiqué');card.append(nickname);
    const coachTitle=document.createElement('h4');coachTitle.textContent='Entraîneur et nationalité';card.append(coachTitle);
    if(!coaches.length){const p=document.createElement('p');p.className='small-note';p.textContent='Nom de l’entraîneur et nationalité non publiés par la source pour cette fiche.';card.append(p);}
    coaches.slice(0,4).forEach(coach=>{
      const row=document.createElement('div');row.className='staff-profile-row';
      const portrait=document.createElement('img');portrait.loading='lazy';portrait.alt='Photo de '+(coach.displayName||coach.fullName||coach.name||'l’entraîneur');
      const photo=coach.headshot?.href||coach.headshot?.url||coach.photo||coach.image?.href||'';
      if(photo){portrait.src=photo;portrait.onerror=()=>{portrait.removeAttribute('src');portrait.classList.add('photo-unavailable');};}else portrait.className='photo-unavailable';
      const info=document.createElement('div');info.className='player-roster-info';
      const p=document.createElement('strong');p.textContent=coach.displayName||coach.fullName||coach.name||'Entraîneur';
      const nationality=document.createElement('small');nationality.textContent=coach.nationality||coach.citizenship||coach.country?.name||coach.birthPlace?.country||'Nationalité non communiquée';
      info.append(p,nationality);row.append(portrait,info);card.append(row);
    });
    const details=document.createElement('p');details.className='club-meta';details.textContent='Fondation : '+(team.founded||'Non communiquée')+' · Stade : '+(team.venue?.fullName||team.venue?.name||'Non communiqué');card.append(details);
    const caveat=document.createElement('p');caveat.className='data-caveat';caveat.textContent='Fiche établie à partir des champs fournis par ESPN. Les champs absents ne sont pas déduits.';card.append(caveat);
    const rosterTitle=document.createElement('h4');rosterTitle.className='player-roster-title';rosterTitle.textContent='Effectif et photos des joueurs';card.append(rosterTitle);
    const rosterHost=document.createElement('div');rosterHost.className='player-roster-grid';
    const athletes=[];
    const collect=list=>{if(Array.isArray(list))list.forEach(item=>{if(item&&typeof item==='object'&&(item.fullName||item.displayName||item.name))athletes.push(item);if(item?.athletes)collect(item.athletes);if(item?.items)collect(item.items);});};
    collect(rosterData?.athletes);collect(rosterData?.items);(rosterData?.groups||[]).forEach(group=>collect(group.athletes));
    const unique=athletes.filter((player,index)=>athletes.findIndex(x=>String(x.id||x.fullName||x.name)===String(player.id||player.fullName||player.name))===index);
    if(unique.length){
      unique.slice(0,60).forEach(player=>{
        const item=document.createElement('div');item.className='player-roster-item';
        const image=document.createElement('img');image.loading='lazy';image.alt='Photo de '+(player.fullName||player.displayName||player.name);
        const headshot=player.headshot?.href||player.headshot?.url||player.photo||'';
        if(headshot){image.src=headshot;image.onerror=()=>{image.removeAttribute('src');image.classList.add('photo-unavailable');};}
        else image.className='photo-unavailable';
        const info=document.createElement('div');info.className='player-roster-info';
        const playerName=document.createElement('strong');playerName.textContent=player.fullName||player.displayName||player.name;info.append(playerName);
        const meta=document.createElement('small');meta.textContent=[player.position?.abbreviation||player.position?.name,player.jersey?('#'+player.jersey):'',player.citizenship||player.nationality||''].filter(Boolean).join(' · ')||'Informations non communiquées';info.append(meta);
        item.append(image,info);rosterHost.append(item);
      });
    } else {const empty=document.createElement('p');empty.className='small-note';empty.textContent='Effectif ou photos indisponibles pour cette équipe dans la source consultée.';rosterHost.append(empty);}
    card.append(rosterHost);host.append(card);
  }
  async function searchClubTeam(){
    const select=$('club-competition'),input=$('club-search'),host=$('club-results');if(!select||!input||!host)return;
    const code=select.value,query=input.value.trim().toLocaleLowerCase();if(!query){setText('club-status','Saisis le nom d’un club ou d’une sélection.');return;}
    const comp=CLUB_COMPETITIONS.find(x=>x[0]===code)?.[1]||code;setText('club-status','Recherche dans '+comp+'…');host.replaceChildren();
    try{
      const data=await clubFetch(CLUB_ESPN+code+'/teams?limit=500');
      const teams=getTeamArray(data);
      const found=teams.filter(t=>[t.displayName,t.name,t.shortDisplayName,t.abbreviation].some(v=>String(v||'').toLocaleLowerCase().includes(query)));
      if(!found.length){setText('club-status','Aucune équipe trouvée dans cette compétition. Essaie une autre compétition ou vérifie l’orthographe.');return;}
      const profiles=await Promise.all(found.slice(0,8).map(async team=>{
        const id=team.id;if(!id)return {team,roster:null};
        try{
          const detail=await clubFetch(CLUB_ESPN+code+'/teams/'+id);
          const profile=detail.team||detail;
          let roster=null;
          try{roster=await clubFetch(CLUB_ESPN+code+'/teams/'+id+'/roster');}catch(_){}
          return {team:profile,roster};
        }catch(_){return {team,roster:null};}
      }));
      profiles.forEach(profile=>renderClubProfile(profile.team,comp,profile.roster));
      setText('club-status',profiles.length+' fiche(s) trouvée(s) · Effectifs et photos selon disponibilité ESPN · '+timeFmt.format(new Date()));
    }catch(error){setText('club-status','Impossible de charger cette compétition actuellement ('+error.message+').');}
  }
  async function loadNationalCompetitionCards(){
    const host=$('national-competitions');if(!host)return;host.replaceChildren();
    for(const code of NATIONAL_COMPETITIONS){
      const item=CLUB_COMPETITIONS.find(x=>x[0]===code);if(!item)continue;
      const card=document.createElement('button');card.type='button';card.className='national-competition-card';card.textContent=item[1]+' · Voir les équipes et le classement';
      card.addEventListener('click',()=>{$('club-competition').value=code;$('club-search').value='';$('club-results').textContent='Sélectionne une nation ou consulte le classement via la compétition.';loadNationalStandings(code,item[1]);});
      host.append(card);
    }
  }
  async function loadNationalStandings(code,name){
    const host=$('club-results');host.replaceChildren();setText('club-status','Chargement du classement de '+name+'…');
    try{const data=await clubFetch('https://site.api.espn.com/apis/v2/sports/soccer/'+code+'/standings');renderLeagueTable(data,'club-results');setText('club-status','Classement disponible pour '+name+' · '+timeFmt.format(new Date()));}
    catch(_){host.textContent='Classement ou groupes non disponibles auprès de la source pour cette compétition.';setText('club-status','Données de classement indisponibles.');}
  }
  function initClubHub(){
    const select=$('club-competition');if(!select)return;
    if(!select.options.length)CLUB_COMPETITIONS.forEach(([code,name])=>{const option=document.createElement('option');option.value=code;option.textContent=name;select.append(option);});
    loadNationalCompetitionCards();
  }
  function renderNewsRendezvous(){
    const host=$('news-rendezvous');if(!host)return;host.replaceChildren();
    const now=Date.now(),upcoming=state.matches.filter(m=>new Date(m.utcDate).getTime()>now&&!['CANCELLED','POSTPONED','SUSPENDED'].includes(String(m.status||'').toUpperCase())).sort((a,b)=>competitionOrder(a)-competitionOrder(b)||new Date(a.utcDate)-new Date(b.utcDate)).slice(0,6);
    if(!upcoming.length){host.textContent='Aucun grand rendez-vous à venir dans le calendrier actuellement chargé.';return;}
    const title=document.createElement('h3');title.textContent='Les prochains rendez-vous';host.append(title);
    upcoming.forEach(match=>{const row=document.createElement('div');row.className='rendezvous-row';const meta=document.createElement('small');meta.textContent=competitionName(match)+' · '+new Date(match.utcDate).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});const teams=document.createElement('strong');teams.textContent=teamName(match.homeTeam)+' – '+teamName(match.awayTeam);row.append(meta,teams);host.append(row);});
  }

  function showPage(id) {
    const pageId=['page-accueil','page-matches','page-live','page-leagues','page-clubs','page-news','page-analysis','page-vip','page-settings'].includes(id)?id:'page-accueil';
    document.querySelectorAll('.app-page').forEach(page=>page.classList.toggle('active',page.id===pageId));
    document.querySelectorAll('.bottom-nav a[data-page]').forEach(link=>link.classList.toggle('active',link.dataset.page===pageId));
    if(pageId==='page-live')fetchLiveScores();
    if(pageId==='page-leagues')loadLeagueHub();
    if(pageId==='page-clubs')initClubHub();
    if(pageId==='page-news')loadFootballNews();
    if(pageId==='page-analysis')renderAnalysisPicker();
    if(pageId==='page-matches')renderFeaturedPicks();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function updateSourceDetails() {
    const count=state.matches.length,fd=Number(state.sources.footballData||0),espn=Number(state.sources.espn||0),api=Number(state.sources.apiFootball||0),history=Number(state.sources.historyMatches||0);
    setText('source-status',count?'DONNÉES CHARGÉES':'AUCUN MATCH');setText('source-detail',fd+' football-data.org · '+espn+' ESPN · '+api+' API-Football · '+history+' résultats historiques');
    const generated=state.generatedAt?new Date(state.generatedAt):null;
    const label=generated&&!Number.isNaN(generated.getTime())?'Dernière collecte : '+dateFmt.format(generated)+' à '+timeFmt.format(generated)+'. ':'';
    setText('report-title',count+' rencontre(s) disponibles');
    setText('report-copy',label+'Ouvre une rencontre pour consulter les statistiques disponibles. '+history+' résultats terminés avec score sont chargés. Les cotes bookmakers ne sont pas intégrées.');
    setText('settings-message','Données préparées par GitHub Actions sur une fenêtre historique pouvant atteindre 365 jours. La profondeur réelle varie selon les compétitions et les sources.');
  }
  async function loadMatches() {
    const button=$('refresh-btn');if(button){button.disabled=true;button.textContent='Chargement…';}setText('match-status','Chargement du calendrier…');
    try {
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let response;
      try{response=await fetch('./matches.json?v='+Date.now(),{cache:'no-store',signal:controller.signal});}finally{clearTimeout(timeout);}
      if(!response.ok)throw new Error('Fichier des rencontres inaccessible (HTTP '+response.status+').');
      const data=await response.json();if(!data||!Array.isArray(data.matches))throw new Error('Format du calendrier invalide : liste des matchs absente.');
      state.matches=data.matches.filter(validMatch);state.generatedAt=data.generatedAt||null;state.sources=data.sources||{};
      updateSourceDetails();updateMatchCompetitionOptions();renderAnalysisPicker();renderFeaturedPicks();setText('match-status',state.matches.length+' rencontre(s) chargée(s) · '+state.matches.filter(m=>['IN_PLAY','PAUSED','LIVE','HALFTIME','EXTRA_TIME','PENALTY_SHOOTOUT'].includes(String(m.status||'').toUpperCase())).length+' en direct · '+state.matches.filter(m=>m.status==='FINISHED'&&hasFinalScore(m)).length+' résultats. Les horaires suivent le fuseau de ton téléphone.');renderMatches();
    } catch(error) {
      state.matches=[];setText('match-count','0');setText('source-status','INDISPONIBLE');setText('source-detail','Données à vérifier');
      setText('match-status',error.name==='AbortError'?'La source met trop de temps à répondre. Réessaie.':error.message||'Erreur inconnue.');
      const list=$('match-list');if(list)list.replaceChildren();setText('report-title','Données indisponibles');setText('report-copy','Aucune analyse sans calendrier valide.');setText('settings-message','Vérifie le déploiement GitHub Pages puis réessaie.');
    } finally {if(button){button.disabled=false;button.textContent='Actualiser ↻';}}
  }

  // Centre live : flux ESPN public, actualisé périodiquement. Cette source peut être retardée ou indisponible.
  const LIVE_LEAGUES = [
    ['eng.1','Premier League'],['eng.2','Championship'],['esp.1','La Liga'],['esp.2','Segunda División'],
    ['ger.1','Bundesliga'],['ita.1','Serie A'],['fra.1','Ligue 1'],['ned.1','Eredivisie'],['por.1','Primeira Liga'],
    ['tur.1','Süper Lig'],['nor.1','Eliteserien'],['swe.1','Allsvenskan'],['sui.1','Swiss Super League'],
    ['ksa.1','Saudi Pro League'],['cze.1','Czech First League'],['usa.1','MLS'],['rou.1','Liga I'],
    ['rus.1','Russian Premier League'],['chn.1','Chinese Super League'],['jpn.1','J1 League'],['bra.1','Brasileirão'],
    ['arg.1','Liga Profesional Argentina'],['mex.1','Liga MX'],['uefa.champions','Ligue des champions'],
    ['uefa.europa','Ligue Europa'],['uefa.europa.conf','Ligue Conférence'],['afc.champions','Ligue des champions AFC'],
    ['caf.champions','Ligue des champions CAF'],['caf.confed','Coupe de la Confédération CAF'],['caf.nations','Coupe d’Afrique des nations'],['fifa.worldq.caf','Qualifications Coupe du monde Afrique'],['rsa.1','Afrique du Sud · Premier Soccer League'],['nga.1','Nigeria · Premier League'],['gha.1','Ghana · Premier League'],['fifa.world','Compétitions FIFA']
  ];
  const ESPN_BASE='https://site.api.espn.com/apis/site/v2/sports/soccer/';
  const isLiveStatus=status=>['IN_PLAY','LIVE','HALFTIME','PAUSED','EXTRA_TIME','PENALTY_SHOOTOUT'].includes(String(status||'').toUpperCase());
  function soundGoal() {
    if(!state.goalAlerts)return;
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      const ctx=new Audio();const now=ctx.currentTime;
      [660,880,1046].forEach((freq,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.0001,now+i*.16);gain.gain.exponentialRampToValueAtTime(.16,now+i*.16+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.16+.14);osc.connect(gain);gain.connect(ctx.destination);osc.start(now+i*.16);osc.stop(now+i*.16+.15);});
      setTimeout(()=>ctx.close().catch(()=>{}),900);
    } catch(e) { console.warn('Sonnerie indisponible',e); }
  }
  function notifyGoal(match,home,away) {
    soundGoal();
    if('Notification'in window && Notification.permission==='granted' && document.visibilityState==='visible') {
      try { new Notification('⚽ BUT ! '+teamName(match.homeTeam)+' – '+teamName(match.awayTeam),{body:home+' - '+away,tag:'goal-'+match.id,icon:'./icon.svg'}); } catch(e) {}
    }
  }
  function renderLiveMatches() {
    const host=$('live-list');if(!host)return;host.replaceChildren();
    const live=state.liveMatches.filter(m=>isLiveStatus(m.status));
    if(!live.length){const empty=document.createElement('div');empty.className='status-panel';empty.textContent=state.liveReady?'Aucun match en direct détecté dans les compétitions suivies.':'Connexion à la source des scores en direct…';host.append(empty);return;}
    live.sort((a,b)=>competitionOrder(a)-competitionOrder(b)||new Date(a.utcDate)-new Date(b.utcDate));
    live.forEach(m=>{
      const card=document.createElement('article');card.className='live-score-card';
      const top=document.createElement('div');top.className='live-score-meta';
      const comp=document.createElement('span');comp.textContent=m.competition?.name||'Football';
      const minute=document.createElement('b');minute.textContent=m.statusDetail||'EN DIRECT';
      top.append(comp,minute);
      const teams=document.createElement('div');teams.className='live-score-teams';
      const home=document.createElement('strong');home.textContent=teamName(m.homeTeam);
      const score=document.createElement('b');score.className='live-score-value';score.textContent=(m.score?.fullTime?.home??0)+' – '+(m.score?.fullTime?.away??0);
      const away=document.createElement('strong');away.textContent=teamName(m.awayTeam);
      teams.append(home,score,away);card.append(top,teams);
      const officials=(m.officials||[]).filter(o=>o.name);
      if(officials.length){
        const officialBox=document.createElement('div');officialBox.className='live-officials';
        officials.slice(0,4).forEach(o=>{
          const line=document.createElement('div');line.className='staff-profile-row';
          const portrait=document.createElement('img');portrait.loading='lazy';portrait.alt='Photo de '+o.name;
          if(o.headshot){portrait.src=o.headshot;portrait.onerror=()=>{portrait.removeAttribute('src');portrait.classList.add('photo-unavailable');};}else portrait.className='photo-unavailable';
          const info=document.createElement('div');info.className='player-roster-info';
          const n=document.createElement('strong');n.textContent=o.name;
          const meta=document.createElement('small');meta.textContent=[o.role,o.nationality].filter(Boolean).join(' · ');
          info.append(n,meta);line.append(portrait,info);officialBox.append(line);
        });
        card.append(officialBox);
      }
      host.append(card);
    });
  }
  async function fetchLiveScores() {
    if(document.visibilityState==='hidden')return;
    const today=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const collected=[];
    for(let i=0;i<LIVE_LEAGUES.length;i+=7) {
      const batch=await Promise.all(LIVE_LEAGUES.slice(i,i+7).map(async ([code,label])=>{
        try {
          const response=await fetch(ESPN_BASE+code+'/scoreboard?dates='+today,{cache:'no-store',signal:AbortSignal.timeout(10000)});
          if(!response.ok)return [];
          const data=await response.json();
          return (data.events||[]).map(event=>{
            const comp=event.competitions?.[0],teams=comp?.competitors||[];
            const h=teams.find(t=>t.homeAway==='home')||teams[0],a=teams.find(t=>t.homeAway==='away')||teams[1];
            if(!h||!a)return null;
            const statusType=comp.status?.type||event.status?.type||{};
            const status=statusType.completed?'FINISHED':statusType.state==='in'?'IN_PLAY':statusType.state==='post'?'FINISHED':'SCHEDULED';
            return {id:String(event.id),utcDate:event.date,status,statusDetail:comp.status?.displayClock||statusType.detail||statusType.description||'EN DIRECT',competition:{name:event.league?.name||data.leagues?.[0]?.name||label},officials:(comp.officials||[]).map(o=>({name:o.fullName||o.displayName||o.name||'Arbitre',role:o.position?.name||o.position||o.displayName||'Officiel',nationality:o.nationality||o.country?.name||'',headshot:o.headshot?.href||o.headshot?.url||''})),homeTeam:{name:h.team?.displayName||h.team?.name||'Domicile'},awayTeam:{name:a.team?.displayName||a.team?.name||'Extérieur'},score:{fullTime:{home:h.score==null?0:Number(h.score),away:a.score==null?0:Number(a.score)}}};
          }).filter(Boolean);
        } catch(e){return [];}
      }));
      collected.push(...batch.flat());
    }
    const current={};
    collected.forEach(m=>{
      const h=Number(m.score.fullTime.home)||0,a=Number(m.score.fullTime.away)||0;
      current[m.id]={home:h,away:a,match:m};
      const previous=state.knownScores[m.id];
      if(previous && (h>previous.home||a>previous.away))notifyGoal(m,h,a);
    });
    // Ne pas sonner au premier chargement : il sert de référence initiale.
    state.knownScores=current;
    state.liveMatches=collected;state.liveReady=true;
    renderLiveMatches();
    setText('live-updated','Dernière vérification : '+timeFmt.format(new Date())+' · actualisation automatique environ toutes les 90 secondes');
    const liveCount=collected.filter(m=>isLiveStatus(m.status)).length;
    setText('live-count',String(liveCount));
  }
  const NEWS_LANGS={fr:'fr',en:'en',es:'es',pt:'pt',de:'de',it:'it',ar:'ar'};
  const NEWS_SECTION_KEYS={'Football international':'news_international','Espagne':'news_spain','France':'news_france','Allemagne':'news_germany','Italie':'news_italy','Ligue des champions':'news_champions'};
  const newsTranslationCache=new Map();
  const newsText=key=>window.GoldI18n?.t(key)||key;
  async function translateNewsText(value,language) {
    const textValue=String(value||'').trim();
    if(!textValue)return '';
    if(language==='en')return textValue;
    const cacheKey=language+'|'+textValue;
    if(newsTranslationCache.has(cacheKey))return newsTranslationCache.get(cacheKey);
    try {
      const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+encodeURIComponent(language)+'&dt=t&q='+encodeURIComponent(textValue);
      const response=await fetch(url,{cache:'force-cache',signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error('translation_http_'+response.status);
      const data=await response.json();
      const translated=Array.isArray(data?.[0])?data[0].map(part=>part?.[0]||'').join('').trim():'';
      if(!translated)throw new Error('empty_translation');
      newsTranslationCache.set(cacheKey,translated);
      return translated;
    } catch(error) {
      console.warn('Traduction actualité indisponible',error);
      return '';
    }
  }
  async function loadFootballNews() {
    const host=$('news-list');if(!host)return;
    const language=NEWS_LANGS[window.GoldI18n?.getLanguage?.()||'fr']||'fr';
    setText('news-status',newsText('news_loading'));renderNewsRendezvous();if(($('news-filter')?.value||'all')==='big'){setText('news-status','Sélection des grands rendez-vous affichée ci-dessous.');host.replaceChildren();return;}
    const leagues=[['eng.1','Football international'],['esp.1','Espagne'],['fra.1','France'],['ger.1','Allemagne'],['ita.1','Italie'],['uefa.champions','Ligue des champions']];
    try {
      const responses=await Promise.all(leagues.map(async ([code,label])=>{
        try {
          const r=await fetch(ESPN_BASE+code+'/news',{cache:'no-store',signal:AbortSignal.timeout(10000)});
          if(!r.ok)return [];
          const data=await r.json();
          return (data.articles||[]).map(article=>({...article,section:label}));
        } catch(e){return [];}
      }));
      const allArticles=responses.flat().filter(a=>a.headline).sort((a,b)=>new Date(b.published||0)-new Date(a.published||0));
      const filter=$('news-filter')?.value||'all';
      const transferPattern=/transfer|transferred|signing|signed|loan|loaned|deal agreed|medical|mercato|transfert|recrut|prêt|pret|contrat|arrivée|arrivee|départ|depart|fichaje|traspaso|transferencia|contratação|transferência|wechsel|verpflichtet/i;
      const articles=(filter==='big'?[]:filter==='transfers'?allArticles.filter(a=>transferPattern.test([a.headline,a.description,a.summary].join(' '))):allArticles).slice(0,24);
      host.replaceChildren();
      if(!articles.length){setText('news-status',filter==='transfers'?'Aucune actualité de transfert détectée dans les articles récents de la source.':newsText('news_empty'));return;}
      // Translate titles and summaries before rendering: English source text is never silently shown in another selected language.
      const translated=[];
      for(let i=0;i<articles.length;i+=4) {
        const batch=await Promise.all(articles.slice(i,i+4).map(async article=>{
          const originalTitle=article.headline;
          const originalDescription=article.description||article.summary||'';
          const combined=[originalTitle,originalDescription].filter(Boolean).join('\n');
          const localized=await translateNewsText(combined,language);
          const parts=localized?localized.split('\n'):[];
          return {...article,localizedTitle:parts[0]||'',localizedDescription:parts.slice(1).join('\n').trim()};
        }));
        translated.push(...batch);
      }
      translated.forEach(article=>{
        const card=document.createElement('article');card.className='news-card';
        const category=document.createElement('small');category.textContent=newsText(NEWS_SECTION_KEYS[article.section]||'news_section');
        const title=document.createElement('h3');title.textContent=article.localizedTitle||newsText('news_translation_error');
        const desc=document.createElement('p');desc.textContent=article.localizedDescription||'';
        const meta=document.createElement('div');meta.className='news-meta';
        const locale=language==='ar'?'ar':language+'-'+language.toUpperCase();
        meta.textContent=article.published?new Date(article.published).toLocaleString(locale,{dateStyle:'medium',timeStyle:'short'}):newsText('news_recent');
        card.append(category,title);
        if(desc.textContent)card.append(desc);
        card.append(meta);
        const href=article.links?.web?.href||article.links?.api?.news?.href;
        if(href){const link=document.createElement('a');link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=newsText('news_source');card.append(link);}
        host.append(card);
      });
      const translatedCount=translated.filter(a=>a.localizedTitle).length;
      setText('news-status',translatedCount+' / '+articles.length+' '+newsText('news_count_suffix'));
    } catch(e){setText('news-status',newsText('news_unavailable'));}
  }
  function enableGoalAlerts() {
    state.goalAlerts=true;
    try{localStorage.setItem('gold-goal-alerts','on');}catch(e){}
    if('Notification'in window && Notification.permission==='default')Notification.requestPermission().then(()=>updateAlertButton());
    updateAlertButton();soundGoal();
  }
  function updateAlertButton() {
    const button=$('enable-goal-alerts'),status=$('goal-alert-status');
    if(button)button.textContent=state.goalAlerts?'Désactiver la sonnerie':'Activer la sonnerie des buts';
    if(status)status.textContent=state.goalAlerts?'Sonnerie activée sur cet appareil. Les alertes fonctionnent lorsque l’application est ouverte et connectée.':'Alertes désactivées.';
  }
  function toggleGoalAlerts() {
    state.goalAlerts=!state.goalAlerts;
    try{localStorage.setItem('gold-goal-alerts',state.goalAlerts?'on':'off');}catch(e){}
    if(state.goalAlerts && 'Notification'in window && Notification.permission==='default')Notification.requestPermission().then(()=>updateAlertButton());
    updateAlertButton();if(state.goalAlerts)soundGoal();
  }

  window.addEventListener('error',e=>{setText('source-status','ERREUR JAVASCRIPT');setText('match-status','Erreur JavaScript : '+(e.message||'inconnue'));});
  window.addEventListener('unhandledrejection',e=>{setText('source-status','ERREUR APPLICATION');setText('match-status','Opération échouée : '+String(e.reason?.message||e.reason||'inconnue'));});
  document.addEventListener('gold-language-change',()=>{if(document.getElementById('page-news')?.classList.contains('active'))loadFootballNews();});
  loadSettings();
  const thresholdControl=$('probability-threshold'),historyControl=$('minimum-history');
  if(thresholdControl)thresholdControl.addEventListener('change',saveSettings);
  if(historyControl)historyControl.addEventListener('change',saveSettings);
  const resetSettings=$('reset-settings');
  if(resetSettings)resetSettings.addEventListener('click',()=>{state.settings={threshold:0.65,minimumHistory:5};loadSettings();saveSettings();});
  const refresh=$('refresh-btn');if(refresh)refresh.addEventListener('click',loadMatches);
  const matchDate=$('match-date');if(matchDate){matchDate.value=state.selectedDate;matchDate.addEventListener('change',()=>{state.selectedDate=matchDate.value||localDateKey(new Date());renderMatches();});}
  const prevMatchDay=$('match-date-prev');if(prevMatchDay)prevMatchDay.addEventListener('click',()=>shiftMatchDate(-1));
  const nextMatchDay=$('match-date-next');if(nextMatchDay)nextMatchDay.addEventListener('click',()=>shiftMatchDate(1));
  const todayMatchDay=$('match-date-today');if(todayMatchDay)todayMatchDay.addEventListener('click',()=>{state.selectedDate=localDateKey(new Date());if(matchDate)matchDate.value=state.selectedDate;renderMatches();});
  const matchCompetitionSelect=$('match-competition-select');if(matchCompetitionSelect)matchCompetitionSelect.addEventListener('change',()=>{state.selectedCompetition=matchCompetitionSelect.value;renderMatches();});
  const liveRefresh=$('refresh-live');if(liveRefresh)liveRefresh.addEventListener('click',fetchLiveScores);
  const leagueSelect=$('league-select');if(leagueSelect)leagueSelect.addEventListener('change',loadLeagueHub);
  const leagueRefresh=$('refresh-leagues');if(leagueRefresh)leagueRefresh.addEventListener('click',loadLeagueHub);
  const newsRefresh=$('refresh-news');if(newsRefresh)newsRefresh.addEventListener('click',loadFootballNews);
  const clubSearchButton=$('club-search-button');if(clubSearchButton)clubSearchButton.addEventListener('click',searchClubTeam);
  const clubSearch=$('club-search');if(clubSearch)clubSearch.addEventListener('keydown',event=>{if(event.key==='Enter')searchClubTeam();});
  const clubRefresh=$('refresh-clubs');if(clubRefresh)clubRefresh.addEventListener('click',searchClubTeam);
  const newsFilter=$('news-filter');if(newsFilter)newsFilter.addEventListener('change',()=>{if(newsFilter.value==='big'){renderNewsRendezvous();const list=$('news-list');if(list)list.replaceChildren();setText('news-status','Affichage des grands rendez-vous du calendrier.');}else loadFootballNews();});
  const alertButton=$('enable-goal-alerts');if(alertButton)alertButton.addEventListener('click',toggleGoalAlerts);
  try{state.goalAlerts=localStorage.getItem('gold-goal-alerts')==='on';}catch(e){}
  updateAlertButton();
  document.querySelectorAll('.scoreboard-filter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.scoreboard-filter').forEach(x=>x.classList.toggle('active',x===b));state.filter=b.dataset.filter||'all';state.openAnalysis=null;renderMatches();}));
  document.querySelectorAll('.bottom-nav a[data-page]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();const id=link.dataset.page;history.pushState({page:id},'', '#'+id);showPage(id);}));
  window.addEventListener('popstate',()=>showPage(location.hash.slice(1)));
  const analysisSelect=$('analysis-match-select');if(analysisSelect)analysisSelect.addEventListener('change',renderAnalysisPicker);
  showPage(location.hash.slice(1)||'page-accueil');
  setText('today',dateFmt.format(new Date()));loadMatches();fetchLiveScores();loadFootballNews();
  setInterval(fetchLiveScores,90000);
  setInterval(loadFootballNews,900000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){fetchLiveScores();}});
  if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
})();