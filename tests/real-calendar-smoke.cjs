'use strict';
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const failedRequests = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('gold-pronos-onboarding-v1', JSON.stringify({ completed: true })));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedRequests.push(request.url()+' · '+(request.failure()?.errorText||'échec réseau')));
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
  const normalizeTeam = value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const importance = value => {
    const name = String(value || '').toLowerCase();
    if (/champions league|ligue des champions|world cup|coupe du monde|european championship|championnat d.?europe|africa cup|coupe d.?afrique|copa america|gold cup|europa league|ligue europa|conference league|nations league|ligue des nations/.test(name)) return 100;
    if (/premier league|laliga|la liga|bundesliga|serie a|ligue 1|eredivisie|primeira liga|süper lig|super lig|mls|major league soccer|saudi pro league/.test(name)) return 85;
    if (/championship|segunda|serie b|2\\. bundesliga|ligue 2|segunda division|first division|super league/.test(name)) return 65;
    if (/u(?:-)?(?:15|16|17|18|19|20|21|23)|youth|junior|women|feminin|féminin/.test(name)) return 35;
    return 45;
  };
  const firstFixture = eligibleMatches.find(m => {
    const home = normalizeTeam(m.homeTeam?.name), away = normalizeTeam(m.awayTeam?.name);
    return home && away && firstCard.includes(m.homeTeam.name) && firstCard.includes(m.awayTeam.name);
  });
  if (!firstFixture) throw new Error('The first homepage card could not be matched to the generated calendar.');
  const activeFixtures = eligibleMatches.filter(m => {
    const date = Date.parse(m.utcDate || '');
    const status = String(m.status || '').toUpperCase();
    const live = /^(IN_PLAY|LIVE|IN PROGRESS)$/.test(status);
    const finished = /^(FINISHED|POST|FT|AET|PEN)$/.test(status);
    return !finished && (live || date >= rendered.now);
  });
  if (activeFixtures.length) {
    const highestImportance = Math.max(...activeFixtures.map(m => importance(m.competition?.name || m.league || m.competition)));
    const firstImportance = importance(firstFixture.competition?.name || firstFixture.league || firstFixture.competition);
    if (firstImportance < highestImportance) throw new Error('Homepage did not prioritize a major active competition: first='+(firstFixture.competition?.name || firstFixture.league)+' ('+firstImportance+'), highest='+highestImportance+'.');
  }
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
  // renderPicks() runs during the initial calendar load; inspect its hidden DOM without a second heavy rerender.
  await page.waitForFunction(() => document.querySelectorAll('#picks .pick-card').length > 0, null, {timeout:15000});
  const predictionCards = await page.locator('#picks .pick-card').count();
  const predictionPendingCards = await page.locator('#picks .pick-card').filter({hasText:'Analyse en attente'}).count();
  const predictionCalculatedCards = predictionCards - predictionPendingCards;

  // Use the real navigation handler without Playwright's stability wait during live background refreshes.
  await page.evaluate(() => {
    const tab = document.querySelector('.tab[data-page="national-teams"]');
    if (!tab) throw new Error('Independent national-team tab is missing.');
    tab.click();
  });
  // Trigger the visible refresh control as a deterministic fallback while the tab activation loads the section.
  await page.evaluate(() => {
    const refresh = document.querySelector('#nt-refresh');
    if (!refresh) throw new Error('National-team refresh control is missing.');
    refresh.click();
  });
  try {
    await page.waitForFunction(() => {
      const status = document.querySelector('#nt-source-status')?.textContent || '';
      const notice = document.querySelector('#nt-fixtures .notice')?.innerText || '';
      return /rencontres nationales détectées/.test(status) || /Impossible de charger le calendrier national/i.test(notice);
    }, null, {timeout:20000});
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      status: document.querySelector('#nt-source-status')?.textContent || '',
      fixtures: document.querySelector('#nt-fixtures')?.innerText || '',
      tabActive: document.querySelector('.tab[data-page="national-teams"]')?.classList.contains('active') || false,
      scriptLoaded: performance.getEntriesByType('resource').some(x => x.name.includes('national-teams.js'))
    }));
    throw new Error('National calendar did not finish loading: '+JSON.stringify({diagnostic,failedRequests,error:error.message}));
  }
  const nationalFixtureState = await page.evaluate(() => ({
    cards: document.querySelectorAll('#nt-fixtures .nt-fixture').length,
    notice: document.querySelector('#nt-fixtures .notice')?.innerText || ''
  }));
  if (!nationalFixtureState.cards && !nationalFixtureState.notice) throw new Error('National fixture list rendered neither fixtures nor an explicit status notice.');
  if (/Impossible de charger le calendrier national/i.test(nationalFixtureState.notice)) throw new Error('National calendar failed to load: '+nationalFixtureState.notice);
  await page.locator('#nt-predictions .notice').first().waitFor({state:'visible',timeout:15000});
  const nationalSummaryText = await page.locator('#nt-predictions .notice').first().innerText();
  const nationalCounts = nationalSummaryText.match(/(\d+) pronostic\(s\) calculé\(s\) · (\d+) analyse\(s\) en attente sur (\d+) rencontre\(s\) à venir/);
  const nationalPredictionCards = await page.locator('#nt-predictions .nt-pick').count();
  const nationalPendingCards = await page.locator('#nt-predictions .nt-pick.pending').count();
  const nationalCalculatedCards = nationalPredictionCards - nationalPendingCards;
  let nationalUpcomingMatches = 0;
  if (nationalCounts) {
    nationalUpcomingMatches = Number(nationalCounts[3]);
    if (nationalPredictionCards !== nationalUpcomingMatches || nationalPendingCards !== Number(nationalCounts[2]) || nationalCalculatedCards !== Number(nationalCounts[1])) {
      throw new Error('National prediction cards do not match the visible summary: '+JSON.stringify({nationalCounts:nationalCounts.slice(1),nationalPredictionCards,nationalPendingCards,nationalCalculatedCards}));
    }
  } else if (/Aucun match international à venir confirmé dans le calendrier chargé/i.test(nationalSummaryText)) {
    if (nationalPredictionCards !== 0) throw new Error('National prediction cards exist although the page reports no confirmed upcoming international match.');
  } else {
    throw new Error('National prediction summary is missing or unreadable: '+nationalSummaryText);
  }
  const nationalFixtureCards = await page.locator('#nt-fixtures .nt-fixture').count();
  const nationalCompetitionCards = await page.locator('#nt-competition-list .nt-comp-card').count();
  if (!nationalCompetitionCards) throw new Error('The independent national competition catalogue did not render.');
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
    nationalUpcomingMatches,
    nationalFixtureCards,
    nationalCompetitionCards,
    firstVisibleMatch:firstCard.slice(0,220),
    mobileWidth:await page.evaluate(()=>document.documentElement.clientWidth),
    pageErrors:errors
  };
  if (errors.length) throw new Error('Browser JavaScript errors with real calendar: '+errors.join(' | '));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
