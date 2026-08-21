import { sql } from './_lib/db.js';
import { translateQuery, translateOrderBy, paginate } from './_lib/queryTranslator.js';

export default async function handler(req, res) {
  try {
    const { q, pageSize, page, orderBy } = req.query;
    const { where, params } = translateQuery(q);
    const order = translateOrderBy(orderBy);
    const { limit, offset, pageSize: ps, page: pg } = paginate(pageSize, page);

    // COUNT(*) OVER() rides along with the data query so this is a single round-trip
    // to the DB instead of two -- meaningful latency win given Neon's per-query overhead.
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const dataRows = await sql.query(
      `SELECT data, COUNT(*) OVER() AS total_count FROM cards WHERE ${where} ${order} LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, limit, offset]
    );

    res.status(200).json({
      data: dataRows.map(r => r.data),
      page: pg,
      pageSize: ps,
      count: dataRows.length,
      totalCount: dataRows.length ? parseInt(dataRows[0].total_count, 10) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
