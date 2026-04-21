import pg from "pg";

const connectionString =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DIRECT_URL;

if (!connectionString) {
  console.error("No DATABASE_URL found in environment");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function migrate() {
  await client.connect();
  console.log("Connected to database");

  try {
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    console.log("Added columns to users table");

    const result = await client.query(`
      UPDATE users u
      SET
        nickname     = COALESCE(p.nickname, u.username),
        country      = COALESCE(p.country, 'Other'),
        avatar_color = COALESCE(p.avatar_color, '#3b82f6'),
        avatar_url   = p.avatar_url,
        updated_at   = COALESCE(p.updated_at, NOW())
      FROM user_profiles p
      WHERE p.user_id = u.id::text
    `);
    console.log(`Merged ${result.rowCount} profiles into users table`);

    await client.query(`
      UPDATE users
      SET
        nickname     = COALESCE(nickname, username),
        country      = COALESCE(country, 'Other'),
        avatar_color = COALESCE(avatar_color, '#3b82f6'),
        updated_at   = COALESCE(updated_at, NOW())
      WHERE nickname IS NULL OR country IS NULL OR avatar_color IS NULL
    `);
    console.log("Set defaults for remaining users");

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate().catch((e) => { console.error(e); process.exit(1); });
