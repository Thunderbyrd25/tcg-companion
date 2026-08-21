// One-off, run via `npm run backfill -- [--limit-credits=N]`
// (loads .env.local via Node's --env-file flag, see package.json).
// Mirrors Scrydex's paper-only Pokemon card pool into our Postgres DB.
// Idempotent (upserts on id) and resumable via scripts/.backfill-progress.json
// (gitignored) — safe to re-run if interrupted or if credit budget runs out mid-run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from '../api/_lib/db.js';
import { setToRow, cardToRow } from '../api/_lib/normalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCRYDEX_BASE = 'https://api.scrydex.com/pokemon/v1/en';
const PROGRESS_FILE = path.join(__dirname, '.backfill-progress.json');
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const STANDARD_LOOKBACK_MS = 365 * DAY_MS;

const creditLimit = parseInt((process.argv.find(a => a.startsWith('--limit-credits=')) || '').split('=')[1] || '0', 10);
let creditsUsed = 0;

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { completedSets: [] };
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
}
function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function scrydexGet(pathAndQuery) {
  if (creditLimit && creditsUsed >= creditLimit) throw new Error('CREDIT_LIMIT_REACHED');
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${SCRYDEX_BASE}${pathAndQuery}`, {
      headers: {
        'X-Api-Key': process.env.SCRYDEX_API_KEY,
        'X-Team-ID': process.env.SCRYDEX_TEAM_ID,
      },
    });
    creditsUsed++;
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    throw new Error(`Scrydex ${res.status}: ${await res.text()}`);
  }
  throw new Error('Scrydex request failed after retries');
}

async function fetchAllExpansions() {
  let page = 1;
  const all = [];
  while (true) {
    const body = await scrydexGet(`/expansions?pageSize=100&page=${page}`);
    all.push(...body.data);
    if (all.length >= body.total_count) break;
    page++;
  }
  return all.filter(e => !e.is_online_only);
}

async function upsertSet(exp) {
  const row = setToRow(exp);
  await sql.query(
    `INSERT INTO sets (id, scrydex_id, name, ptcgo_code, series, total, printed_total, release_date, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET name=$3, ptcgo_code=$4, series=$5, total=$6, printed_total=$7, release_date=$8, data=$9`,
    [row.id, row.scrydex_id, row.name, row.ptcgo_code, row.series, row.total, row.printed_total, row.release_date, row.data]
  );
}

async function upsertCard(card) {
  const row = cardToRow(card);
  await sql.query(
    `INSERT INTO cards (id, scrydex_id, name, set_id, ptcgo_code, number, release_date,
       national_pokedex_numbers, legalities_standard, legalities_expanded, regulation_mark, data, raw_scrydex)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET name=$3, set_id=$4, ptcgo_code=$5, number=$6, release_date=$7,
       national_pokedex_numbers=$8, legalities_standard=$9, legalities_expanded=$10, regulation_mark=$11,
       data=$12, raw_scrydex=$13, updated_at=now()`,
    [row.id, row.scrydex_id, row.name, row.set_id, row.ptcgo_code, row.number, row.release_date,
      row.national_pokedex_numbers, row.legalities_standard, row.legalities_expanded, row.regulation_mark,
      row.data, row.raw_scrydex]
  );

  const tier = (row.legalities_standard === 'Legal'
    || (row.release_date && Date.now() - new Date(row.release_date).getTime() < STANDARD_LOOKBACK_MS))
    ? 'daily' : 'monthly';
  const nextDue = new Date(Date.now() + (tier === 'daily' ? DAY_MS : MONTH_MS));
  await sql.query(
    `INSERT INTO refresh_metadata (card_id, scrydex_id, tier, last_refreshed_at, next_due_at)
     VALUES ($1,$2,$3,now(),$4)
     ON CONFLICT (card_id) DO UPDATE SET tier=$3, last_refreshed_at=now(), next_due_at=$4`,
    [row.id, row.scrydex_id, tier, nextDue.toISOString()]
  );
}

async function backfillSet(exp) {
  let page = 1;
  while (true) {
    const body = await scrydexGet(`/cards?q=${encodeURIComponent(`expansion.id:${exp.id}`)}&include=prices&pageSize=250&page=${page}`);
    for (const card of body.data) await upsertCard(card);
    console.log(`  ${exp.id}: page ${page}, ${body.data.length} cards`);
    if (page * 250 >= body.total_count) break;
    page++;
  }
}

async function main() {
  const progress = loadProgress();
  const done = new Set(progress.completedSets);

  console.log('Fetching expansions...');
  const sets = await fetchAllExpansions();
  sets.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
  console.log(`${sets.length} paper sets found.`);

  for (const exp of sets) {
    await upsertSet(exp);
    if (done.has(exp.id)) continue;

    console.log(`Backfilling ${exp.name} (${exp.id})...`);
    try {
      await backfillSet(exp);
      done.add(exp.id);
      saveProgress({ completedSets: [...done] });
    } catch (err) {
      if (err.message === 'CREDIT_LIMIT_REACHED') {
        console.log(`Credit limit (${creditLimit}) reached. Progress saved — re-run to continue.`);
        saveProgress({ completedSets: [...done] });
        process.exit(0);
      }
      throw err;
    }
  }

  console.log(`Done. ${creditsUsed} Scrydex requests made this run.`);
}

main().catch(err => { console.error(err); process.exit(1); });
