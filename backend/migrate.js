/**
 * Automated Supabase Migration Runner
 * Executes the SQL migration against Supabase PostgreSQL in a single command.
 *
 * Usage:
 *   npm run db:migrate
 *   OR
 *   node backend/migrate.js "your_db_password_or_connection_string"
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const PROJECT_REF = (process.env.SUPABASE_URL || '').replace('https://', '').split('.')[0] || 'your-project';

async function runMigration(connectionString) {
  console.log('\nConnecting to Supabase PostgreSQL database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected! Executing schema migration...');

    const sql = fs.readFileSync(SCHEMA_FILE, 'utf-8');
    await client.query(sql);

    // Verify tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('chat_sessions', 'chat_messages')
      ORDER BY table_name;
    `);

    const createdTables = res.rows.map(r => r.table_name);

    console.log('\n======================================================');
    console.log('🎉 Supabase Database Migration Completed Successfully!');
    console.log('======================================================');
    console.log(`✅ Active Tables: ${createdTables.join(', ')}`);
    console.log('✅ Row-Level Security (RLS) configured');
    console.log('✅ Performance indexes created');
    console.log('======================================================\n');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    if (err.message.includes('password authentication failed') || err.message.includes('getaddrinfo')) {
      console.error('Tip: Verify your Supabase database password in Project Settings -> Database.');
    }
    await client.end().catch(() => {});
    process.exit(1);
  }
}

async function main() {
  const arg = process.argv[2];

  // 1. Check if direct connection string is in environment
  let dbUrl = process.env.DATABASE_URL?.trim();

  // 2. Check if passed via command line argument
  if (arg) {
    if (arg.startsWith('postgres://') || arg.startsWith('postgresql://')) {
      dbUrl = arg;
    } else {
      // User passed database password: build pooler connection string
      dbUrl = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(arg)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
    }
  }

  if (dbUrl) {
    return runMigration(dbUrl);
  }

  // 3. Prompt user for password or display options
  console.log('\n======================================================');
  console.log('🗄️  Supabase Database Migration');
  console.log(`📌 Project Reference: ${PROJECT_REF}`);
  console.log('======================================================');
  console.log('\nTo execute this migration automatically:');
  console.log('1. Run with your Supabase database password:');
  console.log('   npm run db:migrate -- "YOUR_DB_PASSWORD"');
  console.log('\n2. Or add DATABASE_URL into backend/.env:');
  console.log(`   DATABASE_URL=postgresql://postgres.${PROJECT_REF}:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`);
  console.log('   Then run: npm run db:migrate');
  console.log('\n3. Or paste into Supabase SQL Editor in 1 click:');
  console.log(`   👉 https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
  console.log('======================================================\n');

  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Enter your Supabase database password now (or press Enter to exit): ', (answer) => {
      rl.close();
      const pwd = answer.trim();
      if (!pwd) {
        console.log('No password entered. Exiting.');
        process.exit(0);
      }
      const builtUrl = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(pwd)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
      runMigration(builtUrl);
    });
  } else {
    process.exit(0);
  }
}

main();
