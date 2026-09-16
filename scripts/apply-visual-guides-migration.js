import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  const client = new Client({
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.zmfwtidtilghminwirjx',
    password: 'Aadarsh9310@',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL pooler.');

    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260917000002_exercise_visual_guides.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 20260917000002_exercise_visual_guides.sql...');
    await client.query(sql);
    console.log('Migration executed successfully.');

    // Verify columns on public.exercises
    const res = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'exercises'
      AND column_name IN ('demo_video_url', 'demo_image_url', 'thumbnail_url', 'instruction_steps', 'common_mistakes');
    `);

    console.log('Verified columns on public.exercises:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
