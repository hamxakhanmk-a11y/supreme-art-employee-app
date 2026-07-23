// Quick introspection of the store DB — lists every table and column
// so we can see if there are image URLs anywhere we missed.
import { neon } from "@neondatabase/serverless";
const URL = process.env.STORE_DATABASE_URL;
if (!URL) { console.error("STORE_DATABASE_URL required"); process.exit(1); }
const sql = neon(URL);
const tables = await sql.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name
`);
const tList = (tables.rows ?? tables).map(r => r.table_name);
console.log("TABLES:", tList);
for (const t of tList) {
  const cols = await sql.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position
  `, [t]);
  const list = cols.rows ?? cols;
  console.log(`\n[${t}]`);
  for (const c of list) console.log(`  ${c.column_name}  ${c.data_type}`);
}
