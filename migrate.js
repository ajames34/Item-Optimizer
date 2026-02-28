#!/usr/bin/env node
/**
 * migrate.js — One-shot PostgreSQL schema migration
 *
 * Usage:
 *   DATABASE_URL=postgres://... node src/db/migrate.js
 *
 * Or with a .env file already containing DATABASE_URL:
 *   node src/db/migrate.js
 *
 * This script is idempotent (CREATE TABLE IF NOT EXISTS) — safe to re-run.
 */
'use strict';
require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error('\n❌  DATABASE_URL is not set.\n');
        console.error('    Add it to backend/.env:\n');
        console.error('    DATABASE_URL=postgres://user:pass@host/db?sslmode=require\n');
        process.exit(1);
    }

    console.log('🔗  Connecting to PostgreSQL …');
    const pool = new Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10_000,
    });

    // Verify connectivity before running DDL
    const client = await pool.connect().catch((err) => {
        console.error(`\n❌  Connection failed: ${err.message}\n`);
        process.exit(1);
    });

    try {
        console.log('📋  Running schema migration …');
        const schema = fs.readFileSync(
            path.join(__dirname, 'schema.postgres.sql'),
            'utf8'
        );
        await client.query(schema);
        console.log('\n✅  Migration complete!\n');
        console.log('    Tables created (or already exist):');
        console.log('      • inventory');
        console.log('      • sales');
        console.log('    Indexes: idx_inventory_status, idx_sales_inventory_id,');
        console.log('             idx_sales_platform, idx_sales_date_sold\n');
    } catch (err) {
        console.error(`\n❌  Migration failed: ${err.message}\n`);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
