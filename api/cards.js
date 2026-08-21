import { sql } from './_lib/db.js';
import { translateQuery, translateOrderBy, paginate } from './_lib/queryTranslator.js';

export default async function handler(req, res) {
  try {
    const { q, pageSize, page, orderBy } = req.query;
    const { where, params } = translateQuery(q);
    const order = translateOrderBy(orderBy);
    const { limit, offset, pageSize: ps, page: pg } = paginate(pageSize, page);

    const countRows = await sql.query(`SELECT COUNT(*) FROM cards WHERE ${where}`, params);
    const totalCount = parseInt(countRows[0].count, 10);

    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const dataRows = await sql.query(
      `SELECT data FROM cards WHERE ${where} ${order} LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, limit, offset]
    );

    res.status(200).json({
      data: dataRows.map(r => r.data),
      page: pg,
      pageSize: ps,
      count: dataRows.length,
      totalCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
