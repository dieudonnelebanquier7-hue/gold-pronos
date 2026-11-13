'use strict';
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('gold-pronos-onboarding-v1', JSON.stringify({ completed: true, club: 'Test FC' })));
  const page = await context.newPage();
  const now = Date.now();
  const fixtures = [
    {id:'old-1',utcDate:new Date(now-3*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'101',name:'Test FC'},awayTeam:{id:'102',name:'United Test'},score:{fullTime:{home:2,away:0}}},
    {id:'old-2',utcDate:new Date(now-2*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'102',name:'United Test'},awayTeam:{id:'103',name:'City Test'},score:{fullTime:{home:1,away:1}}},
    {id:'old-3',utcDate:new Date(now-86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'103',name:'City Test'},awayTeam:{id:'101',name:'Test FC'},score:{fullTime:{home:0,away:1}}},
    {id:'old-4',utcDate:new Date(now-4*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'101',name:'Test FC'},awayTeam:{id:'103',name:'City Test'},score:{fullTime:{home:1,away:0}}},
    {id:'old-5',utcDate:new Date(now-5*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'103',name:'City Test'},awayTeam:{id:'102',name:'United Test'},score:{fullTime:{home:0,away:2}}},
    {id:'old-6',utcDate:new Date(now-6*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'101',name:'Test FC'},awayTeam:{id:'103',name:'City Test'},score:{fullTime:{home:2,away:1}}},
    {id:'old-7',utcDate:new Date(now-7*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'102',name:'United Test'},awayTeam:{id:'103',name:'City Test'},score:{fullTime:{home:2,away:0}}},
    {id:'old-8',utcDate:new Date(now-8*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'103',name:'City Test'},awayTeam:{id:'101',name:'Test FC'},score:{fullTime:{home:1,away:1}}},
    {id:'old-9',utcDate:new Date(now-9*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'103',name:'City Test'},awayTeam:{id:'102',name:'United Test'},score:{fullTime:{home:1,away:1}}},
    {id:'old-10',utcDate:new Date(now-10*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'101',name:'Test FC'},awayTeam:{id:'103',name:'City Test'},score:{fullTime:{home:1,away:2}}},
    {id:'old-11',utcDate:new Date(now-11*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'102',name:'United Test'},awayTeam:{id:'101',name:'Test FC'},score:{fullTime:{home:0,away:0}}},
    {id:'old-12',utcDate:new Date(now-12*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'101',name:'Test FC'},awayTeam:{id:'102',name:'United Test'},score:{fullTime:{home:3,away:1}}},
    {id:'live-1',utcDate:new Date(now-45*60000).toISOString(),status:'IN_PLAY',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'301',name:'Live Test FC'},awayTeam:{id:'302',name:'Live United'},score:{fullTime:{home:1,away:0}}},
    {id:'future-1',utcDate:new Date(now+15*60000).toISOString(),status:'SCHEDULED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'101',name:'Test FC',logo:'https://example.com/test-fc.png'},awayTeam:{id:'102',name:'United Test',logo:'https://example.com/united-test.png'},score:{fullTime:{home:null,away:null}}},
    {id:'national-1',utcDate:new Date(now+30*60000).toISOString(),status:'SCHEDULED',competition:{name:'Coupe d’Afrique',code:'ESPN-caf.nations'},homeTeam:{id:'201',name:'Bénin',abbreviation:'BEN'},awayTeam:{id:'202',name:'Nigeria',abbreviation:'NGA'},score:{fullTime:{home:null,away:null}}}
  ];
  await page.route('**/matches.json', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({generatedAt:new Date().toISOString(),matches:fixtures})}));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({status:200,contentType:'application/javascript',body:"\nwindow.supabase={createClient:()=>({\n  functions:{invoke:async(name,options={})=>{\n    const body=options.body||{};\n    if(name==='football-data-hub'&&body.action==='fixtures')return {data:{configured:true,fixtures:[{\n      fixture:{id:99001,date:new Date(Date.now()+60*60*1000).toISOString(),status:{short:'NS',long:'Not Started'}},\n      league:{id:990,name:'Friendlies',country:'World'},\n      teams:{home:{id:901,name:'APIGoldAlpha'},away:{id:902,name:'APIGoldBeta'}},\n      goals:{home:null,away:null}\n    }]},error:null};\n    if(name==='football-data-hub'&&body.action==='team-history')return {data:{configured:true,teams:(body.teams||[]).map((item,index)=>{\n      const teamName=item.name,teamId=Number(item.apiFootballId)||(9000+index);\n      const fixtures=Array.from({length:5},(_,i)=>{\n        const teamHome=i%2===0,opponent={id:teamId+100+i,name:'Opponent '+teamName+' '+i};\n        return {\n          fixture:{id:700000+teamId*10+i,date:new Date(Date.now()-(i+2)*86400000).toISOString(),status:{short:'FT',long:'Match Finished'}},\n          league:{id:991,name:'Friendlies',country:'World'},\n          teams:{home:teamHome?{id:teamId,name:teamName}:opponent,away:teamHome?opponent:{id:teamId,name:teamName}},\n          goals:teamHome?{home:2,away:1}:{home:0,away:1}\n        };\n      });\n      return {name:teamName,resolved:true,teamId:String(teamId),fixtures};\n    })},error:null};\n    return {data:{matches:[]},error:null};\n  }},\n  auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null}})}\n})};\n"}));
  await page.route('https://site.api.espn.com/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events:[],articles:[],items:[],leaders:[],children:[],entries:[]})}));
  await page.route('https://sportscore.com/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({fixtures:[{id:'ss-live-1',slug:'global-live-fc-vs-world-live-united',home:'Global United FC',away:'World Athletic Club',home_score:2,away_score:1,status:'live',status_text:'30\u2032',time:new Date(now-50*60000).toISOString(),competition:'International Cup'}],updated:new Date().toISOString()})}));
  await page.route('**/summary?event=*', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    header:{competitions:[{competitors:[{homeAway:'home',score:'1',team:{displayName:'Test FC'}},{homeAway:'away',score:'0',team:{displayName:'United Test'}}],status:{type:{state:'pre',detail:'Scheduled'}}}]},
    boxscore:{teams:[
      {team:{displayName:'Test FC'},statistics:[{name:'fouls',label:'Fouls',displayValue:'4'},{name:'wonCorners',label:'Corner Kicks',displayValue:'3'}]},
      {team:{displayName:'United Test'},statistics:[{name:'fouls',label:'Fouls',displayValue:'2'},{name:'wonCorners',label:'Corner Kicks',displayValue:'1'}]}
    ],players:[
      {team:{displayName:'Test FC'},statistics:[{athletes:[{athlete:{displayName:'Player Stats Test',position:{abbreviation:'FW'}},stats:['90','1','0']}]}]},
      {team:{displayName:'United Test'},statistics:[{athletes:[{athlete:{displayName:'United Player Stats'},stats:['90','0','0']}]}]}
    ]},
    lineups:[
      {team:{name:'Test FC'},formation:'4-3-3',coach:{name:'Coach Test FC'},startXI:Array.from({length:11},(_,i)=>({player:{id:'home-'+i,name:'Test FC Player '+(i+1),number:i+1,pos:'MID'}})),substitutes:[{player:{id:'home-sub',name:'Test FC Substitute',number:12,pos:'DEF'}}]},
      {team:{name:'United Test'},formation:'4-4-2',coach:{name:'Coach United Test'},startXI:Array.from({length:11},(_,i)=>({player:{id:'away-'+i,name:'United Test Player '+(i+1),number:i+1,pos:'DEF'}})),substitutes:[{player:{id:'away-sub',name:'United Test Substitute',number:12,pos:'MID'}}]}
    ],
    commentary:{items:[]}
  })}));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/', {waitUntil:'networkidle'});
  await page.locator('#home-matches .match').first().waitFor({state:'visible',timeout:15000});
  if (!(await page.locator('#home-matches .match').count())) throw new Error('Home page did not render match cards');
  const liveCard = page.locator('#live-matches .match').first();
  if (!(await liveCard.count())) throw new Error('Live page did not show the mocked live fixture. Home: '+(await page.locator('#home-matches').innerText())+' | Live page: '+(await page.locator('#live-matches').innerText()));
  const liveMinuteText = await liveCard.locator('.state').innerText();
  if (!/~45:\d{2}/.test(liveMinuteText)) throw new Error('Live clock must show minute and seconds for the elapsed 45th minute: '+liveMinuteText);
  await page.locator('.tab[data-page="pronos"]').click();
  const nationalPick=page.locator('#picks .pick-card').filter({hasText:'Bénin'}).filter({hasText:'Nigeria'});
  await nationalPick.waitFor({state:'visible',timeout:10000});
  const nationalPickText=await nationalPick.innerText();
  if(nationalPickText.includes('Analyse en attente')||!nationalPickText.includes('5 matchs récents')) throw new Error('National-team prediction must recover five verified API-Football results: '+nationalPickText);
  const apiOnlyPick=page.locator('#picks .pick-card').filter({hasText:'APIGoldAlpha'}).filter({hasText:'APIGoldBeta'});
  await apiOnlyPick.waitFor({state:'visible',timeout:10000});
  const apiOnlyText=await apiOnlyPick.innerText();
  if(apiOnlyText.includes('Analyse en attente')||!apiOnlyText.includes('5 matchs récents')) throw new Error('API-only fixture must recover team history and become analyzable: '+apiOnlyText);
  const liveText = await page.locator('#live-matches').innerText();
  if (!liveText.includes('Global United FC') || !liveText.includes('World Athletic Club')) throw new Error('Live page must add live fixtures supplied outside the ESPN calendar: '+liveText);
  await page.locator('#personalized-home .personalized-matches > div').first().waitFor({state:'visible',timeout:5000});
  const favoriteFirst = await page.locator('#personalized-home .personalized-matches > div').first().innerText();
  if (!favoriteFirst.includes('Test FC') || !favoriteFirst.includes('United Test')) throw new Error('Personalized home must prioritize the upcoming favorite-team fixture: '+favoriteFirst);
  const clubCard = page.locator('#home-matches .match').filter({hasText:'Test FC'}).filter({hasText:'United Test'}).last();
  const clubCrest = clubCard.locator('.match-crest').first();
  await clubCrest.waitFor({state:'visible'});
  const clubBox = await clubCrest.boundingBox();
  if (!clubBox || Math.abs(clubBox.width-clubBox.height)>2 || clubBox.width<20 || clubBox.width>40) throw new Error('Club crest sizing/alignment failed: '+JSON.stringify(clubBox));
  const nationalCard = page.locator('#home-matches .match').filter({hasText:'Bénin'}).first();
  const nationalFlag = nationalCard.locator('.match-flag').first();
  await nationalFlag.waitFor({state:'visible'});
  const flagBox = await nationalFlag.boundingBox();
  if (!flagBox || flagBox.width/flagBox.height<1.35 || flagBox.width/flagBox.height>1.65) throw new Error('National flag aspect ratio failed: '+JSON.stringify(flagBox));
  const sideAlignment = await clubCard.locator('.home-side').evaluate(el => ({display:getComputedStyle(el).display,align:getComputedStyle(el).alignItems,crest:el.querySelector('.gp-crest').getBoundingClientRect().height,name:el.querySelector('.team-name').getBoundingClientRect().height}));
  if (sideAlignment.display!=='flex' || sideAlignment.align!=='center' || sideAlignment.crest<20 || sideAlignment.name<10) throw new Error('Team logo/name alignment failed: '+JSON.stringify(sideAlignment));
  await clubCard.click();
  await page.locator('#match-modal:not([hidden])').waitFor({state:'visible',timeout:5000});
  await page.waitForFunction(() => !document.querySelector('[data-md-panel="overview"] .md-loading'), {timeout:10000});
  const detailCrests = await page.locator('#match-detail .detail-crest').count();
  if (detailCrests!==2) throw new Error('Match detail must show exactly two aligned club crests: '+detailCrests);
  const detailScore = await page.locator('#match-detail .md-score').first().innerText();
  if (!detailScore.includes('1 – 0')) throw new Error('Match detail did not refresh score from official summary: '+detailScore);
  const calendarScore = await clubCard.locator('.score').innerText();
  if (!calendarScore.includes('1 - 0')) throw new Error('Calendar card did not synchronize with the verified match detail score: '+calendarScore);
  await page.locator('#match-detail [data-md-tab="lineups"]').click();
  const lineupText = await page.locator('#match-detail [data-md-panel="lineups"]').innerText();
  if (!lineupText.includes('Compositions officielles') || !lineupText.includes('Test FC') || !lineupText.includes('United Test') || !/(?:Joueur|Player) 11/.test(lineupText) || !lineupText.includes('Remplaçants') || !lineupText.includes('Formation : 4-3-3')) throw new Error('Official pre-match starting XIs were not parsed and displayed: '+lineupText);
  const lineupCardState = await clubCard.locator('.state').innerText();
  if (!lineupCardState.includes('XI officiels')) throw new Error('Match card did not signal that official starting XIs are available: '+lineupCardState);
  await page.locator('#match-detail [data-md-tab="stats"]').click();
  const statsText = await page.locator('#match-detail [data-md-panel="stats"]').innerText();
  if (!statsText.includes('Fautes') || !statsText.includes('Corners') || statsText.includes('Fouls') || statsText.includes('Corner Kicks')) throw new Error('Match statistics are not displayed in French: '+statsText);
  await page.locator('#match-detail [data-md-tab="form"]').click();
  const formPanel = await page.locator('#match-detail [data-md-panel="form"]').innerText();
  if (!formPanel.includes('Forme récente')) throw new Error('Recent team form panel is missing: '+formPanel);
  await page.locator('#match-detail [data-md-tab="h2h"]').click();
  const h2hPanel = await page.locator('#match-detail [data-md-panel="h2h"]').innerText();
  if (!h2hPanel.includes('Confrontations disponibles') || !/(?:0 – 0|3 – 1|2 – 0)/.test(h2hPanel)) throw new Error('Verified head-to-head history was not loaded for the matching teams: '+h2hPanel);
  await page.locator('#match-detail [data-md-tab="players"]').click();
  const playerPanel = await page.locator('#match-detail [data-md-panel="players"]').innerText();
  if (!playerPanel.includes('Player Stats Test')) throw new Error('Individual player statistics panel did not render the available official player data: '+playerPanel);
  await page.locator('#close-modal').click();
  await nationalCard.click();
  await page.locator('#match-modal:not([hidden])').waitFor({state:'visible',timeout:5000});
  await page.waitForFunction(() => !document.querySelector('[data-md-panel="overview"] .md-loading'), {timeout:10000});
  const mismatchedScore = await page.locator('#match-detail .md-score').first().innerText();
  if (mismatchedScore.includes('1 – 0')) throw new Error('Mismatched ESPN summary was incorrectly applied to another fixture: '+mismatchedScore);
  await page.locator('#match-detail [data-md-tab="lineups"]').click();
  const mismatchedLineups = await page.locator('#match-detail [data-md-panel="lineups"]').innerText();
  if (mismatchedLineups.includes('Test FC Player') || mismatchedLineups.includes('United Test Player')) throw new Error('Lineups from another fixture were incorrectly attached to the national match: '+mismatchedLineups);
  await page.locator('#close-modal').click();
  await page.evaluate(() => {
    window.__cornerCalls = 0;
    window.GoldSupabase = {functions:{invoke:async(name,args)=>{window.__cornerCalls++;return {data:{matches:(args.body.matches||[]).map(m=>({...m,verified:false,reason:'Statistiques non publiées'}))},error:null}}}};
  });
  await page.locator('.tab[data-page="pronos"]').click();
  await page.locator('#picks .pick-card').first().waitFor({state:'visible',timeout:5000});
  const predictionCards = page.locator('#picks .pick-card');
  const predictionCard = predictionCards.filter({hasText:'Test FC'}).first();
  const predictionText = await predictionCard.innerText();
  if (!predictionText.includes('À domicile') || !predictionText.includes('À l’extérieur') || !predictionText.includes('Les deux équipes marquent')) throw new Error('Prediction engine did not use venue-specific samples and BTTS evidence: '+predictionText);
  const insufficientText = await predictionCards.filter({hasText:'Bénin'}).first().innerText();
  if (!insufficientText.includes('Analyse en attente') || insufficientText.includes('Double chance')) throw new Error('Prediction engine must refuse to generate picks from insufficient history: '+insufficientText);
  await page.waitForFunction(() => document.querySelector('#picks .pick-card [data-corners] strong')?.textContent === 'Non disponible', {timeout:5000});
  const cornerCallsBefore = await page.evaluate(() => window.__cornerCalls);
  await page.locator('.tab[data-page="home"]').click();
  await page.locator('.tab[data-page="pronos"]').click();
  await page.waitForFunction(() => document.querySelector('#picks .pick-card [data-corners] strong')?.textContent === 'Non disponible', {timeout:5000});
  const cornerCallsAfter = await page.evaluate(() => window.__cornerCalls);
  if (cornerCallsBefore!==1 || cornerCallsAfter!==cornerCallsBefore) throw new Error('Unavailable corner statistics should be negatively cached to avoid repeat source calls: '+cornerCallsBefore+' -> '+cornerCallsAfter);
  await page.evaluate(() => { delete window.GoldSupabase; });
  await page.evaluate(() => { const el=document.createElement('div'); el.id='dynamic-translation-check'; el.textContent='Fouls · Corner Kicks · Yellow Cards'; document.body.appendChild(el); });
  await page.waitForFunction(() => document.querySelector('#dynamic-translation-check')?.textContent === 'Fautes · Corners · Cartons jaunes');
  await page.locator('#dynamic-translation-check').evaluate(el=>el.remove());
  const pages = await page.locator('.tab[data-page]').evaluateAll(nodes => nodes.map(node => node.dataset.page));
  for (const name of pages) {
    await page.locator('.tab[data-page="'+name+'"]').click();
    await page.locator('#page-'+name+'.active').waitFor({state:'visible',timeout:5000});
  }
  const nationalCompetitionCodes = await page.locator('#teams-competition option').evaluateAll(nodes => nodes.map(node => node.value));
  for (const code of ['fifa.worldq.caf','fifa.worldq.uefa','fifa.friendly','fifa.wwc','fifa.world.u20','fifa.world.u17','uefa.u21']) {
    if (!nationalCompetitionCodes.includes(code)) throw new Error('National teams selector is missing competition: '+code);
  }
  await page.evaluate(() => {
    window.GoldSupabase = {functions:{invoke:async(name,args) => name==='teams-catalog' ? {data:{teams:[{id:'ben-1',displayName:'Bénin',abbreviation:'BEN',country:{name:'Bénin',code:'BEN'},nationalFlag:'https://example.com/benin.png'}]},error:null} : {data:null,error:null}}};
  });
  await page.locator('.tab[data-page="teams"]').click();
  await page.locator('#teams-competition').selectOption('fifa.worldq.caf');
  await page.locator('#teams-list .team-tile').filter({hasText:'Bénin'}).waitFor({state:'visible',timeout:5000});
  const nationalTeamsText = await page.locator('#teams-list').innerText();
  if (!nationalTeamsText.includes('Bénin')) throw new Error('National team catalog did not render the mocked official selection: '+nationalTeamsText);
  await page.locator('#account-open').click();
  await page.locator('#page-account.active').waitFor({state:'visible',timeout:5000});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.tab[data-page="home"]').click();
  const mobile = await page.evaluate(() => ({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,heroDirection:getComputedStyle(document.querySelector('.hero')).flexDirection,page:document.querySelector('#page-home').getBoundingClientRect().toJSON()}));
  if (mobile.scrollWidth > mobile.width+1) throw new Error('Mobile horizontal overflow: '+JSON.stringify(mobile));
  if (mobile.heroDirection !== 'column') throw new Error('Mobile hero is not stacked vertically');
  if (mobile.page.width > mobile.width+1) throw new Error('Mobile page exceeds viewport width');
  await page.setViewportSize({width:1365,height:900});
  const desktop = await page.evaluate(() => ({tabs:document.querySelector('.tabs').getBoundingClientRect().toJSON(),page:document.querySelector('#page-home').getBoundingClientRect().toJSON(),mainDisplay:getComputedStyle(document.querySelector('main')).display}));
  if (desktop.mainDisplay !== 'grid' || desktop.page.left < desktop.tabs.right-2) throw new Error('Desktop dashboard layout failed: '+JSON.stringify(desktop));
  if (errors.length) throw new Error('Browser JavaScript errors: '+errors.join(' | '));
  console.log(JSON.stringify({ok:true,pagesChecked:pages.length+1,mobile,desktop},null,2));
  await browser.close();
})().catch(error => {console.error(error);process.exit(1)});
