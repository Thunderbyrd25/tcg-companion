import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export const sql = {
  query: async (text, params) => (await pool.query(text, params)).rows,
};
