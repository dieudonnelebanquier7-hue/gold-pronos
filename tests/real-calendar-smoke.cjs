'use strict';
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const failedRequests = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('gold-pronos-onboarding-v1', JSON.stringify({ completed: true })));
  await context.addInitScript(() => {
    const originalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='gold-pronos-espn-team-history-v4'&&window.__goldPronosSeedHistory){
        try{const merged=JSON.parse(value||'{}');Object.assign(merged,window.__goldPronosSeedHistory);value=JSON.stringify(merged)}catch(_){}
      }
      return originalSetItem.call(this,key,value);
    };
  });
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
  const historyResponse = await page.request.get('http://127.0.0.1:4173/history.json');
  if (!historyResponse.ok()) throw new Error('Verified history archive is not available: HTTP '+historyResponse.status());
  const historyArchive = await historyResponse.json();
  const historyRows = Array.isArray(historyArchive.matches) ? historyArchive.matches : [];
  const invalidCalendarRows = calendar.matches.filter(m => {
    const date = Date.parse(m.utcDate || '');
    return !m.id || !m.homeTeam?.name || !m.awayTeam?.name || !m.competition?.name ||
      !m.competition?.code || !Number.isFinite(date);
  });
  if (invalidCalendarRows.length) throw new Error('Competition-by-competition audit found '+invalidCalendarRows.length+' fixture(s) with missing identity, competition or kickoff data.');
  const competitionAudit = new Map();
  for (const fixture of calendar.matches) {
    const code = String(fixture.competition.code);
    competitionAudit.set(code, (competitionAudit.get(code) || 0) + 1);
  }
  if (!Number.isInteger(calendar.sources?.competitions) || calendar.sources.competitions < 1) throw new Error('Competition catalogue provenance is missing from matches.json.');
  const coverage = calendar.sources?.competitionCoverage;
  if (!Array.isArray(coverage) || coverage.length !== calendar.sources.competitions) throw new Error('Per-competition coverage report is missing or incomplete.');
  const invalidCoverage = coverage.filter(item => !item.code || !item.label || !Number.isInteger(item.daysRequested) ||
    item.daysRequested < 7 || !Number.isInteger(item.daysWithMatches) || item.daysWithMatches < 0 ||
    item.daysWithMatches > item.daysRequested || !Number.isInteger(item.fixtures) || item.fixtures < 0);
  if (invalidCoverage.length) throw new Error('Per-competition audit contains '+invalidCoverage.length+' invalid record(s).');
  console.log('Competition-by-competition coverage: '+coverage.length+' competitions queried; '+coverage.filter(item => item.fixtures > 0).length+' with fixtures; '+coverage.filter(item => item.fixtures === 0).length+' with no confirmed fixtures in this window.');
  console.log('Competition audit: '+competitionAudit.size+' competitions represented · '+calendar.matches.length+' fixtures checked.');
  const invalidHistoryRows = historyRows.filter(m => m.status !== 'FINISHED' || m.scoreConflict === true || !['SportScore','ESPN','OpenLigaDB'].includes(m.source) ||
    !Number.isInteger(Number(m.score?.fullTime?.home)) || !Number.isInteger(Number(m.score?.fullTime?.away)) ||
    Number(m.score.fullTime.home) < 0 || Number(m.score.fullTime.away) < 0 || !m.homeTeam?.name || !m.awayTeam?.name ||
    Date.parse(m.utcDate||'') < Date.now()-366*86400000 || Date.parse(m.utcDate||'') >= Date.now());
  if (invalidHistoryRows.length) throw new Error('Historical archive contains '+invalidHistoryRows.length+' incomplete or non-finished result(s).');
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
  const generatedFrom = Date.parse(calendar.range?.from || '');
  const generatedTo = Date.parse(calendar.range?.to || '');
  const minDate = Number.isFinite(generatedFrom) ? generatedFrom : rendered.now - 35 * 86400000;
  const maxDate = Number.isFinite(generatedTo) ? generatedTo : rendered.now + 14 * 86400000;
  const eligibleMatches = calendar.matches.filter(m => {
    const date = Date.parse(m.utcDate || '');
    return Number.isFinite(date) && date >= minDate && date <= maxDate &&
      String(m.homeTeam?.name || '').trim() && String(m.awayTeam?.name || '').trim();
  });
  if (Number(rendered.matchCount) !== eligibleMatches.length) throw new Error('Home match counter does not equal the complete eligible calendar window: '+rendered.matchCount+' / '+eligibleMatches.length+' (full archive: '+calendar.matches.length+').');
  const normalizeTeam = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const importance = value => {
    const name = String(value || '').toLowerCase();
    if (/champions league|ligue des champions|world cup|coupe du monde|european championship|championnat d.?europe|africa cup|coupe d.?afrique|copa america|gold cup|europa league|ligue europa|conference league|nations league|ligue des nations/.test(name)) return 100;
    if (/premier league|laliga|la liga|bundesliga|serie a|ligue 1|eredivisie|primeira liga|süper lig|super lig|mls|major league soccer|saudi pro league/.test(name)) return 85;
    if (/championship|segunda|serie b|2\. bundesliga|ligue 2|segunda division|first division|super league/.test(name)) return 65;
    if (/u(?:-)?(?:15|16|17|18|19|20|21|23)|youth|junior|women|feminin|féminin/.test(name)) return 35;
    return 45;
  };
  const firstFixture = eligibleMatches.find(m => {
    const home = normalizeTeam(m.homeTeam?.name), away = normalizeTeam(m.awayTeam?.name);
    const firstCardText = normalizeTeam(firstCard);
    return home && away && firstCardText.includes(home) && firstCardText.includes(away);
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
  // Measure predictions only after the verified archive has been merged into the main statistics index.
  await page.waitForFunction(() => /archive historique : \d+ résultat/i.test(document.querySelector('#updated')?.textContent||''), null, {timeout:30000});
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
    if (typeof window.GoldPronosNationalTeamsLoad !== 'function') throw new Error('National-team loader was not initialized.');
    // Start the loader without awaiting optional ESPN team-directory enrichment; the calendar render is awaited below.
    void window.GoldPronosNationalTeamsLoad();
  });
  try {
    // The national calendar is rendered before the optional ESPN team-directory
    // enrichment. Do not make this smoke test wait for all 15 directory requests:
    // they are supplementary and can take longer than the calendar itself.
    await page.waitForFunction(() => {
      const status = document.querySelector('#nt-source-status')?.textContent || '';
      const cards = document.querySelectorAll('#nt-fixtures .nt-fixture').length;
      const notice = document.querySelector('#nt-fixtures .notice')?.innerText || '';
      return (/Calendrier généré le/.test(status) && (cards > 0 || !!notice)) ||
        /Impossible de charger le calendrier national/i.test(notice);
    }, null, {timeout:15000});
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

  // Seed only test-local ESPN history for one real upcoming national fixture.
  // This verifies that the independent national page consumes the same verified-history cache as the main app.
  const nationalCodes = ['fifa.world','fifa.worldq.uefa','fifa.worldq.conmebol','fifa.worldq.concacaf','fifa.worldq.afc','fifa.worldq.caf','fifa.worldq.ofc','fifa.friendly','fifa.friendly.w','uefa.euro','uefa.nations','conmebol.copa','concacaf.gold','afc.asian','caf.nations','fifa.wwc','conmebol.america.femenina','fifa.world.u20','fifa.world.u17','fifa.wworld.u17','uefa.u21'];
  const nationalFixture = calendar.matches.find(m => {
    const code = String(m.competition?.code || '').replace(/^ESPN-/, '');
    const name = String(m.competition?.name || '');
    const national = nationalCodes.includes(code) || /national team|international friendly|world cup|coupe du monde|qualif|nations league|ligue des nations|copa america|copa am[eé]rica|africa cup|coupe d.?afrique|gold cup|asian cup|championnat d.?europe|euro 20|women.?s world cup|fifa friendly/i.test(name);
    return national && m.source === 'ESPN' && m.status === 'SCHEDULED' && Date.parse(m.utcDate) > Date.now() && m.homeTeam?.id && m.awayTeam?.id;
  });
  if (!nationalFixture) throw new Error('No upcoming national ESPN fixture with stable team IDs is available for the history-cache test.');
  const nationalCode = String(nationalFixture.competition.code).replace(/^ESPN-/, '');
  const makeHistory = (team, teamId, tag) => Array.from({length:4}, (_,i) => {
    const opponentId = 'test-opponent-' + tag + '-' + i;
    const event = {
      id:'test-national-history-' + tag + '-' + i,
      date:new Date(Date.now() - (i + 2) * 86400000).toISOString(),
      competitions:[{
        name:'International Friendly',
        competitors:[
          {homeAway:'home',id:'competitor-home-' + tag + '-' + i,team:{id:String(teamId),displayName:team},score:String(i % 2 ? 1 : 2)},
          {homeAway:'away',id:'competitor-away-' + tag + '-' + i,team:{id:opponentId,displayName:'Test Opponent ' + tag + ' ' + i},score:String(i % 2)}
        ],
        status:{type:{completed:true,state:'post',name:'STATUS_FINAL'}}
      }]
    };
    return {event,code:nationalCode};
  });
  const seededHistory = {
    [nationalCode + '|' + String(nationalFixture.homeTeam.id)]:{at:Date.now(),events:makeHistory(nationalFixture.homeTeam.name,nationalFixture.homeTeam.id,'home')},
    [nationalCode + '|' + String(nationalFixture.awayTeam.id)]:{at:Date.now(),events:makeHistory(nationalFixture.awayTeam.name,nationalFixture.awayTeam.id,'away')}
  };
  await page.evaluate(entries => {
    // Keep the deterministic test history available to the Storage.setItem guard above.
    // The main app may refresh its real cache while this test is running; merge the
    // test entries into every subsequent write so the race cannot erase this fixture.
    window.__goldPronosSeedHistory = entries;
    const key='gold-pronos-espn-team-history-v4';
    const cache=JSON.parse(localStorage.getItem(key)||'{}');
    Object.assign(cache,entries);
    localStorage.setItem(key,JSON.stringify(cache));
    window.dispatchEvent(new Event('gold-pronos-team-history-updated'));
  }, seededHistory);
  // Trigger a refresh, but do not wait for the optional ESPN team-directory
  // enrichment. The assertion below waits for the synthetic cache entry to produce
  // a national prediction card, which is the behavior this test is intended to verify.
  await page.evaluate(() => {
    const refresh = document.querySelector('#nt-refresh');
    if (!refresh) throw new Error('National-team refresh control is missing after history seeding.');
    refresh.click();
  });
  const placeholderScores = await page.evaluate(() => {
    const isZeroZero = value => /^0\s*[:\-]\s*0$/.test(String(value || '').trim());
    const home = [...document.querySelectorAll('#home-matches .match')].filter(card => {
      const state = card.querySelector('.state')?.textContent || '';
      return !/EN DIRECT|TERMINÉ/.test(state) && isZeroZero(card.querySelector('.score')?.textContent);
    }).length;
    const national = [...document.querySelectorAll('#nt-fixtures .nt-fixture')].filter(card => {
      const state = card.querySelector('.nt-status')?.textContent || '';
      return /À VENIR/.test(state) && isZeroZero(card.querySelector('.nt-score')?.textContent);
    }).length;
    return {home,national};
  });
  if (placeholderScores.home || placeholderScores.national) {
    throw new Error('A scheduled fixture is displaying a 0-0 placeholder as a real score: '+JSON.stringify(placeholderScores));
  }
  try {
    await page.waitForFunction(() => {
      const section = document.querySelector('#page-national-teams');
      const notice = document.querySelector('#nt-predictions .notice');
      if (!section?.classList.contains('active') || getComputedStyle(section).display === 'none' || !notice) return false;
      const noticeStyle = getComputedStyle(notice);
      return noticeStyle.display !== 'none' &&
        noticeStyle.visibility !== 'hidden' &&
        notice.textContent.trim().length > 0;
    }, null, {timeout:15000});
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const section = document.querySelector('#page-national-teams');
      const box = document.querySelector('#nt-predictions');
      const notice = box?.querySelector('.notice');
      return {
        tabActive: document.querySelector('.tab[data-page="national-teams"]')?.classList.contains('active') || false,
        pageClass: section?.className || '',
        pageDisplay: section ? getComputedStyle(section).display : 'missing',
        predictionBoxExists: !!box,
        predictionChildren: box?.childElementCount || 0,
        noticeText: notice?.textContent || '',
        noticeDisplay: notice ? getComputedStyle(notice).display : 'missing',
        noticeVisibility: notice ? getComputedStyle(notice).visibility : 'missing',
        noticeRects: notice ? notice.getClientRects().length : 0,
        predictionBoxDisplay: box ? getComputedStyle(box).display : 'missing',
        fixtureCards: document.querySelectorAll('#nt-fixtures .nt-fixture').length
      };
    });
    throw new Error('National predictions panel did not become visible: '+JSON.stringify({diagnostic,error:error.message}));
  }
  // A real calendar may legitimately have no verified history for some or all
  // upcoming national fixtures. That must be reported as "Analyse en attente",
  // not treated as a site-wide deployment failure. The checks below still require
  // a visible summary and exact agreement between its counts and the rendered cards.
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
    historicalArchiveMatches:historyRows.length,
    historicalArchiveTeams:Number(historyArchive.sources?.teamsWithHistory||0),
    historicalArchiveTeamsWithFourHistory:Number(historyArchive.sources?.teamsWithFourHistory||0),
    nationalTeamsWithFourHistory:Number(historyArchive.sources?.nationalTeamsWithFourHistory||0),
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
    nationalHistoryCacheFixture:nationalFixture.homeTeam.name+' – '+nationalFixture.awayTeam.name,
    nationalHistorySource:'HISTORIQUE SYNTHÉTIQUE INJECTÉ UNIQUEMENT POUR TEST',
    nationalSyntheticHistoryMatches:8,
    firstVisibleMatch:firstCard.slice(0,220),
    mobileWidth:await page.evaluate(()=>document.documentElement.clientWidth),
    pageErrors:errors
  };
  if (errors.length) throw new Error('Browser JavaScript errors with real calendar: '+errors.join(' | '));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
