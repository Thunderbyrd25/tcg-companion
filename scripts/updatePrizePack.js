#!/usr/bin/env node
// Fetches all Prize Pack Series Cards from TCGPlayer and writes src/data/prizePackLookup.json
// Usage: npm run update-prize-pack

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dir, '../src/data/prizePackLookup.json');

async function fetchAll() {
  const all = [];
  const pageSize = 50;
  let from = 0;
  let total = Infinity;

  while (all.length < total) {
    const res = await fetch('https://mp-search-api.tcgplayer.com/v1/search/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        size: pageSize,
        filters: {
          term: { productLineName: ['pokemon'], setName: ['Prize Pack Series Cards'] },
          range: {},
          match: {},
        },
        context: { shippingCountry: 'US' },
        settings: { useFuzzySearch: true },
        sort: {},
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} at from=${from}`);
    const d = await res.json();
    const page = d?.results?.[0];
    if (!page) throw new Error(`Unexpected response shape at from=${from}`);

    total = page.totalResults ?? 0;
    const items = page.results ?? [];
    all.push(...items);
    process.stdout.write(`\r  Fetched ${all.length}/${total}…`);

    if (items.length < pageSize) break;
    from += pageSize;
    await new Promise(r => setTimeout(r, 250)); // be polite
  }
  process.stdout.write('\n');
  return all;
}

console.log('Fetching Prize Pack Series Cards from TCGPlayer…');
fetchAll()
  .then(items => {
    const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const lookup = {};
    let skipped = 0;

    for (const p of items) {
      const name = norm(p.productName ?? '');
      const numStr = String(p.customAttributes?.number ?? '');
      const num = numStr.split('/')[0].replace(/^0+/, '');
      if (!name || !num) { skipped++; continue; }
      // value = market price (number) or null
      lookup[`${name}|${num}`] = p.marketPrice ?? null;
    }

    writeFileSync(OUTPUT, JSON.stringify(lookup), 'utf8');
    console.log(`Done: ${Object.keys(lookup).length} entries written to src/data/prizePackLookup.json`);
    if (skipped) console.log(`  (${skipped} entries skipped — missing name or number)`);
  })
  .catch(e => {
    console.error('Failed:', e.message);
    process.exit(1);
  });
