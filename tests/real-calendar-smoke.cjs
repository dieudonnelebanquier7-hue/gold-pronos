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
  // Home is the default active page; do not click a navigation control before checking its initial render.
  if (!response || !response.ok()) throw new Error('Application HTML did not load');
  const calendarResponse = await page.request.get('http://127.0.0.1:4173/matches.json');
  if (!calendarResponse.ok()) throw new Error('Generated matches.json is not available to the application: HTTP '+calendarResponse.status());
  const calendar = await calendarResponse.json();
  if (!Array.isArray(calendar.matches) || !calendar.matches.length) throw new Error('Generated real calendar is empty');
  const rendered = await page.evaluate(() => ({
    cards: document.querySelectorAll('#home-matches .match').length,
    homeText: document.querySelector('#home-matches')?.innerText || '',
    firstCard: document.querySelector('#home-matches .match')?.innerText || '',
    matchCount: document.querySelector('#match-count')?.textContent || '',
    updated: document.querySelector('#updated')?.textContent || '',
    now: Date.now()
  }));
  if (!rendered.cards || !rendered.firstCard) {
    throw new Error('Real calendar contains '+calendar.matches.length+' records but no rendered match card was found. Diagnostics: '+JSON.stringify(rendered));
  }
  const cards = rendered.cards;
  const firstCard = rendered.firstCard;
  // The application intentionally loads the verified rolling window (35 days back to 14 days ahead).
  // Compare the home counter with that eligible window, not with older/far-future archive rows.
  const minDate = rendered.now - 35 * 86400000;
  const maxDate = rendered.now + 14 * 86400000;
  const eligibleMatches = calendar.matches.filter(m => {
    const date = Date.parse(m.utcDate || '');
    return Number.isFinite(date) && date >= minDate && date <= maxDate &&
      String(m.homeTeam?.name || '').trim() && String(m.awayTeam?.name || '').trim();
  });
  if (Number(rendered.matchCount) !== eligibleMatches.length) throw new Error('Home match counter does not equal the complete eligible calendar window: '+rendered.matchCount+' / '+eligibleMatches.length+' (full archive: '+calendar.matches.length+').');
  let expandedCards=cards;
  if (calendar.matches.length > 350) {
    const more = page.locator('#home-matches button').filter({hasText:'Afficher'}).first();
    if (!(await more.count())) throw new Error('The full calendar has more than 350 fixtures but the progressive-load control is missing.');
    await more.click();
    expandedCards = await page.locator('#home-matches .match').count();
    if (expandedCards <= cards) throw new Error('The progressive-load control did not reveal additional fixtures.');
  }
  const result = {ok:true, generatedMatches:calendar.matches.length, eligibleMatches:eligibleMatches.length, visibleHomeCards:cards, expandedHomeCards:expandedCards, firstVisibleMatch:firstCard.slice(0,220), mobileWidth:await page.evaluate(()=>document.documentElement.clientWidth), pageErrors:errors};
  if (errors.length) throw new Error('Browser JavaScript errors with real calendar: '+errors.join(' | '));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
