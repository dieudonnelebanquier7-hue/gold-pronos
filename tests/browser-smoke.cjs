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
    {id:'future-1',utcDate:new Date(now+3*3600000).toISOString(),status:'SCHEDULED',competition:{name:'Premier League',code:'ESPN-eng.1'},homeTeam:{id:'101',name:'Test FC'},awayTeam:{id:'102',name:'United Test'},score:{fullTime:{home:null,away:null}}}
  ];
  await page.route('**/matches.json', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({generatedAt:new Date().toISOString(),matches:fixtures})}));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({status:200,contentType:'application/javascript',body:'/* mocked Supabase CDN */'}));
  await page.route('https://site.api.espn.com/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events:[],articles:[],items:[],leaders:[],children:[],entries:[]})}));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/', {waitUntil:'networkidle'});
  await page.locator('#home-matches .match').first().waitFor({state:'visible',timeout:15000});
  if (!(await page.locator('#home-matches .match').count())) throw new Error('Home page did not render match cards');
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
