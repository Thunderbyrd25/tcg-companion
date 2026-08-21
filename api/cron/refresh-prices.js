import { sql } from '../_lib/db.js';
import { normalizeCard } from '../_lib/normalize.js';

const SCRYDEX_BASE = 'https://api.scrydex.com/pokemon/v1/en';
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

async function fetchScrydexCard(scrydexId) {
  const res = await fetch(`${SCRYDEX_BASE}/cards/${scrydexId}?include=prices`, {
    headers: {
      'X-Api-Key': process.env.SCRYDEX_API_KEY,
      'X-Team-ID': process.env.SCRYDEX_TEAM_ID,
    },
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.data;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const batchSize = Math.min(parseInt(process.env.REFRESH_BATCH_SIZE, 10) || 150, 500);

  try {
    const due = await sql.query(
      'SELECT card_id, scrydex_id, tier FROM refresh_metadata WHERE next_due_at <= now() ORDER BY next_due_at LIMIT $1',
      [batchSize]
    );

    let refreshed = 0;
    let failed = 0;
    for (const row of due) {
      const raw = await fetchScrydexCard(row.scrydex_id);
      if (!raw) { failed++; continue; }
      const normalized = normalizeCard(raw);
      const nextDue = new Date(Date.now() + (row.tier === 'daily' ? DAY_MS : MONTH_MS));
      await sql.query(
        `UPDATE cards SET data = $1, legalities_standard = $2, legalities_expanded = $3,
           regulation_mark = $4, updated_at = now() WHERE id = $5`,
        [normalized, normalized.legalities.standard || null, normalized.legalities.expanded || null,
          raw.regulation_mark || null, row.card_id]
      );
      await sql.query(
        'UPDATE refresh_metadata SET last_refreshed_at = now(), next_due_at = $1 WHERE card_id = $2',
        [nextDue.toISOString(), row.card_id]
      );
      refreshed++;
    }

    res.status(200).json({ due: due.length, refreshed, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
