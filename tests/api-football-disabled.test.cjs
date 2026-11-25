'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');

assert.match(source, /const API_FOOTBALL_TEMPORARILY_DISABLED=true/);
for (const [name, cacheKey] of [
  ['loadApiFootballLive', 'API_FOOTBALL_LIVE_CACHE_KEY'],
  ['loadApiFootballFixtures', 'API_FOOTBALL_CACHE_KEY']
]) {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, `${name} closes`);
  const body = source.slice(start, end);
  const guard = body.indexOf('if(API_FOOTBALL_TEMPORARILY_DISABLED)return [];');
  const cacheRead = body.indexOf(`localStorage.getItem(${cacheKey})`);
  assert.ok(guard >= 0 && cacheRead >= 0 && guard < cacheRead,
    `${name} must stop before reading a legacy cache`);
}
console.log('API-Football disabled-cache regression test: OK');
