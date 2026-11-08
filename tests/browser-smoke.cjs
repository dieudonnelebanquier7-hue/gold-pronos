'use strict';
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('gold-pronos-onboarding-v1', JSON.stringify({ completed: true })));
  const page = await context.newPage();
  const now = Date.now();
  const fixtures = [
    {id:'old-1',utcDate:new Date(now-3*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'101',name:'Test FC'},awayTeam:{id:'102',name:'United Test'},score:{fullTime:{home:2,away:0}}},
    {id:'old-2',utcDate:new Date(now-2*86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'102',name:'United Test'},awayTeam:{id:'103',name:'City Test'},score:{fullTime:{home:1,away:1}}},
    {id:'old-3',utcDate:new Date(now-86400000).toISOString(),status:'FINISHED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'103',name:'City Test'},awayTeam:{id:'101',name:'Test FC'},score:{fullTime:{home:0,away:1}}},
    {id:'future-1',utcDate:new Date(now+3*3600000).toISOString(),status:'SCHEDULED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'101',name:'Test FC',logo:'https://example.com/test-fc.png'},awayTeam:{id:'102',name:'United Test',logo:'https://example.com/united-test.png'},score:{fullTime:{home:null,away:null}}},
    {id:'national-1',utcDate:new Date(now+4*3600000).toISOString(),status:'SCHEDULED',competition:{name:'Coupe d’Afrique',code:'ESPN-caf.nations'},homeTeam:{id:'201',name:'Bénin',abbreviation:'BEN'},awayTeam:{id:'202',name:'Nigeria',abbreviation:'NGA'},score:{fullTime:{home:null,away:null}}}
  ];
  await page.route('**/matches.json', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({generatedAt:new Date().toISOString(),matches:fixtures})}));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({status:200,contentType:'application/javascript',body:'/* mocked Supabase CDN */'}));
  await page.route('https://site.api.espn.com/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events:[],articles:[],items:[],leaders:[],children:[],entries:[]})}));
  await page.route('**/summary?event=*', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    header:{competitions:[{competitors:[{homeAway:'home',score:'1',team:{displayName:'Test FC'}},{homeAway:'away',score:'0',team:{displayName:'United Test'}}],status:{type:{state:'in',displayClock:'12:00',period:1,detail:'1st Half'}}}]},
    boxscore:{teams:[
      {team:{displayName:'Test FC'},statistics:[{name:'fouls',label:'Fouls',displayValue:'4'},{name:'wonCorners',label:'Corner Kicks',displayValue:'3'}]},
      {team:{displayName:'United Test'},statistics:[{name:'fouls',label:'Fouls',displayValue:'2'},{name:'wonCorners',label:'Corner Kicks',displayValue:'1'}]}
    ]},commentary:{items:[]}
  })}));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/', {waitUntil:'networkidle'});
  await page.locator('#home-matches .match').first().waitFor({state:'visible',timeout:15000});
  if (!(await page.locator('#home-matches .match').count())) throw new Error('Home page did not render match cards');
  const clubCard = page.locator('#home-matches .match').filter({hasText:'Test FC'}).first();
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
  const detailCrests = await page.locator('#match-detail .detail-crest').count();
  if (detailCrests!==2) throw new Error('Match detail must show exactly two aligned club crests: '+detailCrests);
  const detailScore = await page.locator('#match-detail .md-score').first().innerText();
  if (!detailScore.includes('1 – 0')) throw new Error('Match detail did not refresh score from official summary: '+detailScore);
  await page.locator('#match-detail [data-md-tab="stats"]').click();
  const statsText = await page.locator('#match-detail [data-md-panel="stats"]').innerText();
  if (!statsText.includes('Fautes') || !statsText.includes('Corners') || statsText.includes('Fouls') || statsText.includes('Corner Kicks')) throw new Error('Match statistics are not displayed in French: '+statsText);
  await page.locator('#close-modal').click();
  await page.evaluate(() => { const el=document.createElement('div'); el.id='dynamic-translation-check'; el.textContent='Fouls · Corner Kicks · Yellow Cards'; document.body.appendChild(el); });
  await page.waitForFunction(() => document.querySelector('#dynamic-translation-check')?.textContent === 'Fautes · Corners · Cartons jaunes');
  await page.locator('#dynamic-translation-check').evaluate(el=>el.remove());
  const pages = await page.locator('.tab[data-page]').evaluateAll(nodes => nodes.map(node => node.dataset.page));
  for (const name of pages) {
    await page.locator('.tab[data-page="'+name+'"]').click();
    await page.locator('#page-'+name+'.active').waitFor({state:'visible',timeout:5000});
  }
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
