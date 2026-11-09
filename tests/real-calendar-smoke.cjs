'use strict';
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('gold-pronos-onboarding-v1', JSON.stringify({ completed: true })));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://site.api.espn.com/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events:[],articles:[],items:[],leaders:[],children:[],entries:[]})}));
  await page.route('https://sportscore.com/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({fixtures:[],updated:new Date().toISOString()})}));
  await page.route('https://v3.football.api-sports.io/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({response:[]})}));
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({status:200,contentType:'application/javascript',body:'/* optional CDN disabled in real calendar smoke */'}));
  const response = await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded'});
  if (!response || !response.ok()) throw new Error('Application HTML did not load');
  const calendarResponse = await page.request.get('http://127.0.0.1:4173/matches.json');
  if (!calendarResponse.ok()) throw new Error('Generated matches.json is not available to the application: HTTP '+calendarResponse.status());
  const calendar = await calendarResponse.json();
  if (!Array.isArray(calendar.matches) || !calendar.matches.length) throw new Error('Generated real calendar is empty');
  await page.locator('#home-matches .match').first().waitFor({state:'visible',timeout:20000});
  const cards = await page.locator('#home-matches .match').count();
  if (!cards) throw new Error('Real calendar contains '+calendar.matches.length+' records but the home page displays no match card. Home text: '+(await page.locator('#home-matches').innerText()));
  const firstCard = await page.locator('#home-matches .match').first().innerText();
  const result = {ok:true, generatedMatches:calendar.matches.length, visibleHomeCards:cards, firstVisibleMatch:firstCard.slice(0,220), mobileWidth:await page.evaluate(()=>document.documentElement.clientWidth), pageErrors:errors};
  if (errors.length) throw new Error('Browser JavaScript errors with real calendar: '+errors.join(' | '));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
