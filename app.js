(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { matches: [], filter: 'upcoming', generatedAt: null, sources: {}, openAnalysis: null, settings: { threshold: 0.65, minimumHistory: 5 } };
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
      ((normalizeName(teamName(m.homeTeam))===normalizeName(hn)&&normalizeName(teamName(m.awayTeam))===normalizeName(an))||
       (normalizeName(teamName(m.homeTeam))===normalizeName(an)&&normalizeName(teamName(m.awayTeam))===normalizeName(hn))))
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
    const intro=document.createElement('p');intro.className='analysis-intro';intro.textContent='Estimation statistique indicative basée sur '+result.homeRows.length+' matchs de '+teamName(match.homeTeam)+' et '+result.awayRows.length+' de '+teamName(match.awayTeam)+'.';panel.append(intro);
    const grid=document.createElement('div');grid.className='analysis-stats';
    addLine(grid,'Buts moyens domicile (équipe 1)',result.homeRows.length?average(result.homeRows,'gf').toFixed(2):'—');
    addLine(grid,'Buts encaissés moyens (équipe 1)',average(result.homeRows,'ga').toFixed(2));
    addLine(grid,'Buts moyens (équipe 2)',average(result.awayRows,'gf').toFixed(2));
    addLine(grid,'Buts encaissés moyens (équipe 2)',average(result.awayRows,'ga').toFixed(2));
    panel.append(grid);
    const expected=document.createElement('p');expected.className='analysis-intro';expected.textContent='Buts attendus par le modèle : '+result.homeLambda.toFixed(2)+' – '+result.awayLambda.toFixed(2)+' (total '+result.probs.expectedGoals.toFixed(2)+'). Le +2,5 est calculé sur le total attendu, pas sur une cote bookmaker.';panel.append(expected);
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
    const picks=[];
    today.forEach(match=>{
      const result=analyze(match);if(!result.ready)return;
      const markets=[
        ['1 · Victoire domicile',result.markets.home],['N · Match nul',result.markets.draw],['2 · Victoire extérieur',result.markets.away],
        ['1X · Double chance domicile',result.markets.homeOrDraw],
        ['X2 · Double chance extérieur',result.markets.awayOrDraw],['12 · Pas de match nul',result.markets.noDraw],
        ['+1,5 buts',result.markets.over15],['+2,5 buts',result.markets.over25],
        ['+3,5 buts',result.markets.over35],['BTTS · Les deux marquent',result.markets.btts]
      ];
      if(result.cornerMarkets){
        markets.push(['+7,5 corners',result.cornerMarkets.over75],['+8,5 corners',result.cornerMarkets.over85],
          ['+9,5 corners',result.cornerMarkets.over95],['+10,5 corners',result.cornerMarkets.over105]);
      }
      const best=markets.filter(x=>Number.isFinite(x[1])&&x[1]>=state.settings.threshold).sort((a,b)=>b[1]-a[1])[0];
      if(best)picks.push({match,label:best[0],probability:best[1],confidence:result.confidence});
    });
    picks.sort((a,b)=>b.probability-a.probability);
    const heading=document.createElement('div');heading.className='featured-picks-heading';
    const title=document.createElement('h3');title.textContent='LES SÉLECTIONS STATISTIQUES DU JOUR';
    const sub=document.createElement('p');sub.textContent='Marchés dépassant ton seuil de '+pct(state.settings.threshold)+' · classement par probabilité estimée';
    heading.append(title,sub);host.append(heading);
    if(!picks.length){
      const empty=document.createElement('p');empty.className='featured-picks-empty';
      empty.textContent=today.length?'Aucune sélection ne franchit le seuil avec un historique suffisant. Les matchs restent consultables dans le calendrier.':'Aucune rencontre programmée aujourd’hui dans les données chargées.';
      host.append(empty);return;
    }
    picks.slice(0,5).forEach((pick,index)=>{
      const card=document.createElement('article');card.className='featured-pick-card';
      const rank=document.createElement('span');rank.className='featured-pick-rank';rank.textContent=String(index+1).padStart(2,'0');
      const info=document.createElement('div');info.className='featured-pick-info';
      const comp=document.createElement('small');comp.textContent=competitionName(pick.match)+' · '+timeFmt.format(new Date(pick.match.utcDate));
      const fixture=document.createElement('strong');fixture.textContent=teamName(pick.match.homeTeam)+' – '+teamName(pick.match.awayTeam);
      const market=document.createElement('span');market.className='featured-pick-market';market.textContent=pick.label;
      info.append(comp,fixture,market);
      const probability=document.createElement('strong');probability.className='featured-pick-probability';probability.textContent=pct(pick.probability);
      card.append(rank,info,probability);host.append(card);
    });
    const note=document.createElement('p');note.className='featured-picks-note';note.textContent='Estimations du modèle statistique, pas des cotes bookmaker ni des garanties de résultat. Les rencontres sans historique suffisant sont écartées.';host.append(note);
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
    const pageId=['page-accueil','page-matches','page-analysis','page-settings'].includes(id)?id:'page-accueil';
    document.querySelectorAll('.app-page').forEach(page=>page.classList.toggle('active',page.id===pageId));
    document.querySelectorAll('.bottom-nav a[data-page]').forEach(link=>link.classList.toggle('active',link.dataset.page===pageId));
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
      updateSourceDetails();renderAnalysisPicker();renderFeaturedPicks();setText('match-status',state.matches.length+' rencontre(s) chargée(s) · '+state.matches.filter(m=>['IN_PLAY','PAUSED','LIVE','HALFTIME','EXTRA_TIME','PENALTY_SHOOTOUT'].includes(String(m.status||'').toUpperCase())).length+' en direct · '+state.matches.filter(m=>m.status==='FINISHED'&&hasFinalScore(m)).length+' résultats. Les horaires suivent le fuseau de ton téléphone.');renderMatches();
    } catch(error) {
      state.matches=[];setText('match-count','0');setText('source-status','INDISPONIBLE');setText('source-detail','Données à vérifier');
      setText('match-status',error.name==='AbortError'?'La source met trop de temps à répondre. Réessaie.':error.message||'Erreur inconnue.');
      const list=$('match-list');if(list)list.replaceChildren();setText('report-title','Données indisponibles');setText('report-copy','Aucune analyse sans calendrier valide.');setText('settings-message','Vérifie le déploiement GitHub Pages puis réessaie.');
    } finally {if(button){button.disabled=false;button.textContent='Actualiser ↻';}}
  }
  window.addEventListener('error',e=>{setText('source-status','ERREUR JAVASCRIPT');setText('match-status','Erreur JavaScript : '+(e.message||'inconnue'));});
  window.addEventListener('unhandledrejection',e=>{setText('source-status','ERREUR APPLICATION');setText('match-status','Opération échouée : '+String(e.reason?.message||e.reason||'inconnue'));});
  loadSettings();
  const thresholdControl=$('probability-threshold'),historyControl=$('minimum-history');
  if(thresholdControl)thresholdControl.addEventListener('change',saveSettings);
  if(historyControl)historyControl.addEventListener('change',saveSettings);
  const resetSettings=$('reset-settings');
  if(resetSettings)resetSettings.addEventListener('click',()=>{state.settings={threshold:0.65,minimumHistory:5};loadSettings();saveSettings();});
  const refresh=$('refresh-btn');if(refresh)refresh.addEventListener('click',loadMatches);
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));state.filter=b.dataset.filter||'all';state.openAnalysis=null;renderMatches();}));
  document.querySelectorAll('.bottom-nav a[data-page]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();const id=link.dataset.page;history.pushState({page:id},'', '#'+id);showPage(id);}));
  window.addEventListener('popstate',()=>showPage(location.hash.slice(1)));
  const analysisSelect=$('analysis-match-select');if(analysisSelect)analysisSelect.addEventListener('change',renderAnalysisPicker);
  showPage(location.hash.slice(1)||'page-accueil');
  setText('today',dateFmt.format(new Date()));loadMatches();
  if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
})();