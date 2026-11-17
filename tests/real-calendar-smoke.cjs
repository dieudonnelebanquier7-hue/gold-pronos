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
    const moreExists = await page.locator('#home-matches button').filter({hasText:'Afficher'}).count();
    if (!moreExists) throw new Error('The full calendar has more than 350 fixtures but the progressive-load control is missing.');
    // The app refreshes scores in the background; use the real DOM click handler
    // without Playwright's stability wait, which can time out during a live rerender.
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('#home-matches button')].find(node => /Afficher/.test(node.textContent || ''));
      if (!button) throw new Error('Progressive-load button disappeared before click.');
      button.click();
    });
    await page.waitForFunction(previous => document.querySelectorAll('#home-matches .match').length > previous, cards, {timeout:10000});
    expandedCards = await page.locator('#home-matches .match').count();
    if (expandedCards <= cards) throw new Error('The progressive-load control did not reveal additional fixtures.');
  }
  await page.locator('.tab[data-page="pronos"]').click();
  await page.locator('#picks .pick-card').first().waitFor({state:'attached',timeout:15000});
  const predictionCards = await page.locator('#picks .pick-card').count();
  const predictionPendingCards = await page.locator('#picks .pick-card').filter({hasText:'Analyse en attente'}).count();
  const predictionCalculatedCards = predictionCards - predictionPendingCards;

  await page.locator('.tab[data-page="national-teams"]').click();
  await page.locator('#nt-fixtures .nt-fixture').first().waitFor({state:'visible',timeout:15000});
  await page.locator('#nt-predictions .notice').first().waitFor({state:'visible',timeout:15000});
  const nationalSummaryText = await page.locator('#nt-predictions .notice').first().innerText();
  const nationalCounts = nationalSummaryText.match(/(\d+) pronostic\(s\) calculé\(s\) · (\d+) analyse\(s\) en attente sur (\d+) rencontre\(s\) à venir/);
  if (!nationalCounts) throw new Error('National prediction summary is missing or unreadable: '+nationalSummaryText);
  const nationalPredictionCards = await page.locator('#nt-predictions .nt-pick').count();
  const nationalPendingCards = await page.locator('#nt-predictions .nt-pick.pending').count();
  const nationalCalculatedCards = nationalPredictionCards - nationalPendingCards;
  if (nationalPredictionCards !== Number(nationalCounts[3]) || nationalPendingCards !== Number(nationalCounts[2]) || nationalCalculatedCards !== Number(nationalCounts[1])) {
    throw new Error('National prediction cards do not match the visible summary: '+JSON.stringify({nationalCounts:nationalCounts.slice(1),nationalPredictionCards,nationalPendingCards,nationalCalculatedCards}));
  }
  const result = {
    ok:true,
    generatedMatches:calendar.matches.length,
    eligibleMatches:eligibleMatches.length,
    visibleHomeCards:cards,
    expandedHomeCards:expandedCards,
    predictionCards,
    predictionCalculatedCards,
    predictionPendingCards,
    nationalPredictionCards,
    nationalCalculatedCards,
    nationalPendingCards,
    nationalUpcomingMatches:Number(nationalCounts[3]),
    firstVisibleMatch:firstCard.slice(0,220),
    mobileWidth:await page.evaluate(()=>document.documentElement.clientWidth),
    pageErrors:errors
  };
  if (errors.length) throw new Error('Browser JavaScript errors with real calendar: '+errors.join(' | '));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
