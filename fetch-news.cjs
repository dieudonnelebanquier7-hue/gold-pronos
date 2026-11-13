const fs = require('node:fs');

const FEEDS = [
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { name: 'Sky Sports', url: 'https://www.skysports.com/rss/11095' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/football/rss' },
  { name: 'ESPN', url: 'https://www.espn.com/espn/rss/soccer/news' },
  { name: 'Reuters via Google News', url: 'https://news.google.com/rss/search?q=when:7d+site:reuters.com/sports/soccer&hl=en-US&gl=US&ceid=US:en' },
  { name: 'Mercato francophone · Google News', url: 'https://news.google.com/rss/search?q=football+mercato+OR+transfert+football&hl=fr&gl=FR&ceid=FR:fr' },
  { name: 'Médias français · Google News', url: 'https://news.google.com/rss/search?q=site:lequipe.fr+OR+site:rmcsport.bfmtv.com+OR+site:eurosport.fr+football&hl=fr&gl=FR&ceid=FR:fr' },
  { name: 'Football africain · Google News', url: 'https://news.google.com/rss/search?q=football+Afrique+CAF+CAN&hl=fr&gl=BJ&ceid=BJ:fr' },
  { name: 'Football européen · Google News', url: 'https://news.google.com/rss/search?q=football+Ligue+des+Champions+Europe&hl=fr&gl=FR&ceid=FR:fr' },
  { name: 'Football mondial · Google News', url: 'https://news.google.com/rss/search?q=football+international+résultats+actualité&hl=fr&gl=FR&ceid=FR:fr' },
  { name: 'Blessures et effectifs · Google News', url: 'https://news.google.com/rss/search?q=football+blessure+joueur+effectif&hl=fr&gl=FR&ceid=FR:fr' },
  { name: 'Transferts internationaux · Google News', url: 'https://news.google.com/rss/search?q=transfert+football+international+mercato&hl=fr&gl=FR&ceid=FR:fr' }
];

function decode(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  const escaped = name.replace(':', '\\:');
  const match = block.match(new RegExp('<' + escaped + '\\b[^>]*>([\\s\\S]*?)<\\/' + escaped + '\\s*>', 'i'));
  return match ? decode(match[1]) : '';
}

function getLink(block) {
  const atom = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atom) return atom[1].replace(/&amp;/g, '&');
  return tag(block, 'link');
}

function parseFeed(xml, source) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  return blocks.map((match) => {
    const b = match[2];
    const title = tag(b, 'title');
    const description = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content');
    const rawDate = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const link = getLink(b);
    const date = rawDate && !Number.isNaN(Date.parse(rawDate)) ? new Date(rawDate).toISOString() : null;
    let host = '';
    try { host = new URL(link).hostname.replace(/^www\./, ''); } catch (_) {}
    return { title, description: description.slice(0, 1800), link, date, source, domain: host };
  }).filter(x => x.title && /^https?:\/\//i.test(x.link));
}

async function translateToFrench(value) {
  if (!value || !/[a-zA-Z]/.test(value)) return value;
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=' + encodeURIComponent(value.slice(0, 4500));
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'Mozilla/5.0 GOLD-PRONOS' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const translated = (data[0] || []).map(part => part[0] || '').join('').trim();
      if (translated) return translated;
    } catch (error) {
      if (attempt === 1) return '';
    }
  }
  return '';
}

async function translateArticlesToFrench(items) {
  const translated = [];
  let cursor = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      const title = await translateToFrench(item.title);
      const description = item.description
        ? await translateToFrench(item.description)
        : 'Aucun résumé détaillé n’a été fourni par le média.';
      if (!title || (item.description && !description)) {
        console.warn('Article ignoré : traduction française indisponible pour', item.source);
        continue;
      }
      translated.push({
        ...item,
        title,
        description,
        language: 'fr'
      });
    }
  });
  await Promise.all(workers);
  return translated;
}

async function main() {
  const results = await Promise.all(FEEDS.map(async feed => {
    try {
      const response = await fetch(feed.url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'GOLD-PRONOS-NewsBot/1.0 (+https://github.com/dieudonnelebanquier7-hue/gold-pronos)' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const xml = await response.text();
      if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error('Réponse RSS invalide');
      return { feed, articles: parseFeed(xml, feed.name), error: null };
    } catch (error) {
      return { feed, articles: [], error: String(error.message || error).slice(0, 180) };
    }
  }));

  const now = Date.now();
  const minDate = now - 14 * 24 * 60 * 60 * 1000;
  const all = results.flatMap(x => x.articles).filter(x => !x.date || Date.parse(x.date) >= minDate);
  const seen = new Set();
  const articles = all.filter(item => {
    const key = item.link.replace(/[?#].*$/, '').toLowerCase() || item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (Date.parse(b.date || 0) || 0) - (Date.parse(a.date || 0) || 0)).slice(0, 120);

  const frenchArticles = await translateArticlesToFrench(articles);

  const output = {
    updatedAt: new Date().toISOString(),
    articleCount: frenchArticles.length,
    language: 'fr',
    note: 'Titres et résumés traduits en français. Les articles complets restent la propriété de leurs médias éditeurs.',
    feeds: results.map(x => ({ source: x.feed.name, ok: !x.error, count: x.articles.length, error: x.error })),
    articles: frenchArticles
  };
  fs.writeFileSync('news.json', JSON.stringify(output, null, 2) + '\n');
  console.log('Football news generated:', articles.length, 'articles from', results.filter(x => !x.error).length, '/', FEEDS.length, 'feeds');
  for (const result of results) console.log(result.feed.name + ': ' + (result.error || result.articles.length + ' article(s)'));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
