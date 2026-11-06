(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { matches: [], filter: 'upcoming', generatedAt: null, sources: {}, openAnalysis: null, pickFilter: 'all', liveMatches: [], liveReady: false, goalAlerts: false, knownScores: {}, settings: { threshold: 0.65, minimumHistory: 5 } };
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
  function renderMatches() {
    const list=$('match-list');if(!list)return;list.replaceChildren();const now=new Date();
    const isLive=m=>['IN_PLAY','PAUSED','LIVE','HALFTIME','EXTRA_TIME','PENALTY_SHOOTOUT'].includes(String(m.status||'').toUpperCase());
    const filtered=state.matches.filter(m=>{const d=new Date(m.utcDate);if(state.filter==='live')return isLive(m);if(state.filter==='finished')return m.status==='FINISHED'&&hasFinalScore(m);if(state.filter==='upcoming')return !isLive(m)&&!['FINISHED','CANCELLED','POSTPONED','SUSPENDED'].includes(m.status);if(state.filter==='today')return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate()&&!isLive(m)&&m.status!=='FINISHED';return !['FINISHED','CANCELLED'].includes(m.status);}).sort((a,b)=>competitionOrder(a)-competitionOrder(b)||competitionName(a).localeCompare(competitionName(b),'fr')||(state.filter==='finished'?new Date(b.utcDate)-new Date(a.utcDate):new Date(a.utcDate)-new Date(b.utcDate)));
    setText('match-count',String(filtered.length));setText('match-period',state.filter==='live'?'Matchs en direct':state.filter==='today'?'Rencontres du jour':state.filter==='finished'?'Résultats par championnat':'Calendrier des matchs à venir');
    if(!filtered.length){const e=document.createElement('div');e.className='status-panel';e.textContent=state.filter==='live'?'Aucun match en direct actuellement dans les données reçues.':state.filter==='finished'?'Aucun résultat terminé avec score disponible dans les données reçues.':state.matches.length?'Aucun match dans ce filtre pour la période chargée.':'Aucune rencontre disponible pour le moment.';list.append(e);return;}
    let currentCompetition='';
    filtered.forEach(m=>{
      const group=competitionName(m);
      if(group!==currentCompetition){
        currentCompetition=group;
        const heading=document.createElement('h3');
        heading.className='competition-heading';
        heading.textContent=group;
        list.append(heading);
      }
      list.append(createMatchCard(m));
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
  function showPage(id) {
    const pageId=['page-accueil','page-matches','page-live','page-news','page-analysis','page-settings'].includes(id)?id:'page-accueil';
    document.querySelectorAll('.app-page').forEach(page=>page.classList.toggle('active',page.id===pageId));
    document.querySelectorAll('.bottom-nav a[data-page]').forEach(link=>link.classList.toggle('active',link.dataset.page===pageId));
    if(pageId==='page-live')fetchLiveScores();
    if(pageId==='page-news')loadFootballNews();
    if(pageId==='page-analysis')renderAnalysisPicker();
    if(pageId==='page-matches')renderFeaturedPicks();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function updateSourceDetails() {
    const count=state.matches.length,fd=Number(state.sources.footballData||0),espn=Number(state.sources.espn||0),history=Number(state.sources.historyMatches||0);
    setText('source-status',count?'DONNÉES CHARGÉES':'AUCUN MATCH');setText('source-detail',fd+' football-data.org · '+espn+' ESPN · '+history+' résultats historiques');
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
      updateSourceDetails();renderAnalysisPicker();renderFeaturedPicks();setText('match-status',state.matches.length+' rencontre(s) chargée(s) · '+state.matches.filter(m=>['IN_PLAY','PAUSED','LIVE','HALFTIME','EXTRA_TIME','PENALTY_SHOOTOUT'].includes(String(m.status||'').toUpperCase())).length+' en direct · '+state.matches.filter(m=>m.status==='FINISHED'&&hasFinalScore(m)).length+' résultats. Les horaires suivent le fuseau de ton téléphone.');renderMatches();
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
    ['fifa.world','Compétitions FIFA']
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
      teams.append(home,score,away);card.append(top,teams);host.append(card);
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
            return {id:String(event.id),utcDate:event.date,status,statusDetail:comp.status?.displayClock||statusType.detail||statusType.description||'EN DIRECT',competition:{name:event.league?.name||data.leagues?.[0]?.name||label},homeTeam:{name:h.team?.displayName||h.team?.name||'Domicile'},awayTeam:{name:a.team?.displayName||a.team?.name||'Extérieur'},score:{fullTime:{home:h.score==null?0:Number(h.score),away:a.score==null?0:Number(a.score)}}};
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
    setText('news-status',newsText('news_loading'));
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
      const articles=responses.flat().filter(a=>a.headline).sort((a,b)=>new Date(b.published||0)-new Date(a.published||0)).slice(0,24);
      host.replaceChildren();
      if(!articles.length){setText('news-status',newsText('news_empty'));return;}
      // Translate titles and summaries before rendering: English source text is never silently shown in another selected language.
      const translated=await Promise.all(articles.map(async article=>{
        const originalTitle=article.headline;
        const originalDescription=article.description||article.summary||'';
        const combined=[originalTitle,originalDescription].filter(Boolean).join('\n');
        const localized=await translateNewsText(combined,language);
        const parts=localized?localized.split('\n'):[];
        return {...article,localizedTitle:parts[0]||'',localizedDescription:parts.slice(1).join('\n').trim()};
      }));
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
  const liveRefresh=$('refresh-live');if(liveRefresh)liveRefresh.addEventListener('click',fetchLiveScores);
  const newsRefresh=$('refresh-news');if(newsRefresh)newsRefresh.addEventListener('click',loadFootballNews);
  const alertButton=$('enable-goal-alerts');if(alertButton)alertButton.addEventListener('click',toggleGoalAlerts);
  try{state.goalAlerts=localStorage.getItem('gold-goal-alerts')==='on';}catch(e){}
  updateAlertButton();
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));state.filter=b.dataset.filter||'all';state.openAnalysis=null;renderMatches();}));
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