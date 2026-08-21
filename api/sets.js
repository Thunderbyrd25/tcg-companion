import { sql } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    const { pageSize } = req.query;
    const limit = Math.min(parseInt(pageSize, 10) || 250, 250);
    const rows = await sql.query('SELECT data FROM sets ORDER BY release_date DESC NULLS LAST LIMIT $1', [limit]);
    res.status(200).json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
