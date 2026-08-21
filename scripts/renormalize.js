// Run via `npm run renormalize`. Re-derives `data`/name/legalities/regulation_mark
// for every stored card from its saved raw_scrydex payload -- no Scrydex calls, no
// credits spent. Use this whenever normalize.js's mapping logic changes (e.g. the
// "Basic X Energy" -> "X Energy" name fix) so already-backfilled rows pick it up
// without a full re-backfill.
import { sql } from '../api/_lib/db.js';
import { cardToRow } from '../api/_lib/normalize.js';

async function main() {
  const rows = await sql.query('SELECT id, raw_scrydex FROM cards', []);
  console.log(`Re-normalizing ${rows.length} cards...`);
  let changed = 0;
  for (const row of rows) {
    const r = cardToRow(row.raw_scrydex);
    await sql.query(
      `UPDATE cards SET name=$1, legalities_standard=$2, legalities_expanded=$3, regulation_mark=$4, data=$5
       WHERE id=$6`,
      [r.name, r.legalities_standard, r.legalities_expanded, r.regulation_mark, r.data, row.id]
    );
    changed++;
    if (changed % 1000 === 0) console.log(`  ${changed}/${rows.length}`);
  }
  console.log(`Done. ${changed} cards re-normalized.`);
}

main().catch(err => { console.error(err); process.exit(1); });
