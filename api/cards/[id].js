import { sql } from '../_lib/db.js';

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    const rows = await sql.query('SELECT data FROM cards WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.status(200).json({ data: rows[0].data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
