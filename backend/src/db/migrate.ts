import fs from 'fs';
import path from 'path';
import pool from './connection';

export async function runMigrations(): Promise<void> {
  const migrationPath = path.join(__dirname, '..', 'migrations', '001_initial_schema.sql');

  console.log('[migrate] Reading migration file:', migrationPath);

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  const client = await pool.connect();
  try {
    console.log('[migrate] Running initial schema migration...');
    await client.query(sql);
    console.log('[migrate] Migration complete.');
  } catch (err) {
    console.error('[migrate] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
