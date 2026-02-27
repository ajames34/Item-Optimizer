'use strict';
/**
 * db/client.js — Dual-mode database adapter
 *
 * • When DATABASE_URL is set  → uses pg (PostgreSQL / Neon / Supabase)
 * • When DATABASE_URL is unset → uses better-sqlite3 (local file, zero-config)
 *
 * Public API (both modes return the same shapes):
 *   query(sql, params?)          → Promise<{ rows: Row[] }>
 *   transaction(async fn(q))    → Promise<ReturnType of fn>
 *
 * SQL dialect:
 *   • Always write $1, $2 … params (pg style)
 *   • Always use RETURNING id on INSERT
 *   • Never use datetime('now') — pass new Date().toISOString() instead
 *   The SQLite shim converts $N → ? and strips RETURNING automatically.
 */

const isPg = !!process.env.DATABASE_URL;

// ── Lazy singletons ────────────────────────────────────────────
let _pool = null;
let _sqlite = null;

function getPgPool() {
    if (!_pool) {
        const { Pool } = require('pg');
        _pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            // Neon and most cloud PG providers require SSL
            ssl: process.env.NODE_ENV === 'production'
                ? { rejectUnauthorized: false }
                : (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
                    ? { rejectUnauthorized: false }
                    : false),
            max: 10,
            idleTimeoutMillis: 30_000,
        });
        _pool.on('error', (err) => console.error('PG pool error:', err.message));
    }
    return _pool;
}

function getSqliteDb() {
    if (!_sqlite) {
        const Database = require('better-sqlite3');
        const path = require('path');
        const fs = require('fs');
        const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/inventory.sqlite');
        const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
        _sqlite = new Database(DB_PATH);
        _sqlite.pragma('journal_mode = WAL');
        _sqlite.pragma('foreign_keys = ON');
        _sqlite.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    }
    return _sqlite;
}

// ── SQLite helpers ─────────────────────────────────────────────
// Convert pg-style $1,$2 positional params → SQLite-style ?
function pgToSqlite(sql) {
    return sql.replace(/\$\d+/g, '?');
}

function sqliteQuery(db, sql, params = []) {
    const sqliteSql = pgToSqlite(sql);
    const upper = sql.trim().toUpperCase();

    // SELECT / WITH → return all rows
    if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
        const rows = db.prepare(sqliteSql).all(params);
        return Promise.resolve({ rows });
    }

    // INSERT … RETURNING id  →  strip RETURNING, use lastInsertRowid
    if (upper.includes('RETURNING')) {
        const noReturn = sqliteSql.replace(/\s*RETURNING\s+[\w\s,*]+$/i, '').trim();
        const info = db.prepare(noReturn).run(params);
        const table = sql.match(/INTO\s+(\w+)/i)?.[1];
        if (table && info.lastInsertRowid) {
            const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
            return Promise.resolve({ rows: row ? [row] : [{ id: info.lastInsertRowid }] });
        }
        return Promise.resolve({ rows: [{ id: info.lastInsertRowid }] });
    }

    // UPDATE / DELETE / plain INSERT
    const info = db.prepare(sqliteSql).run(params);
    return Promise.resolve({ rows: [], rowCount: info.changes });
}

// ── Public: query ──────────────────────────────────────────────
async function query(sql, params = []) {
    if (isPg) return getPgPool().query(sql, params);
    return sqliteQuery(getSqliteDb(), sql, params);
}

// ── Public: transaction ────────────────────────────────────────
// fn receives a query function (q) scoped to the transaction.
// If any await inside fn rejects, the transaction is rolled back.
async function transaction(fn) {
    if (isPg) {
        const client = await getPgPool().connect();
        try {
            await client.query('BEGIN');
            const result = await fn((sql, params) => client.query(sql, params));
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } else {
        // SQLite: manual BEGIN/COMMIT (safe — Node.js is single-threaded, no
        // concurrent queries can interleave since our sqliteQuery is synchronous)
        const db = getSqliteDb();
        db.exec('BEGIN');
        try {
            const result = await fn((sql, params) => sqliteQuery(db, sql, params));
            db.exec('COMMIT');
            return result;
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }
    }
}

// ── Graceful shutdown ──────────────────────────────────────────
async function close() {
    if (_pool) { await _pool.end(); _pool = null; }
    if (_sqlite) { _sqlite.close(); _sqlite = null; }
}

module.exports = { query, transaction, close, isPg };
