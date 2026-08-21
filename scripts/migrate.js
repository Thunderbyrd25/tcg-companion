// Run via `npm run migrate`. Applies db/migrations/*.sql in order, one statement at a time
// (the Neon HTTP driver doesn't support multi-statement queries in a single call).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from '../api/_lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

async function main() {
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    console.log(`Applying ${file}...`);
    const text = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = text.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) await sql.query(stmt);
  }
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
