const initSqlJs = require('sql.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db = null;
let dbReady = null;
let isPostgres = false;
let pgPool = null;

// Check if we're using PostgreSQL (production) or SQLite (local dev)
const usePostgres = !!config.database.url;

// ================================================
// PostgreSQL Implementation
// ================================================
async function initPostgres() {
    isPostgres = true;

    pgPool = new Pool({
        connectionString: config.database.url,
        ssl: {
            rejectUnauthorized: false // Required for Render
        }
    });

    // Create tables if they don't exist
    const client = await pgPool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS videos (
                id SERIAL PRIMARY KEY,
                channel_id TEXT NOT NULL,
                message_ts TEXT NOT NULL,
                thread_ts TEXT,
                uploader_id TEXT NOT NULL,
                video_url TEXT,
                video_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(channel_id, message_ts)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                timestamp_seconds INTEGER NOT NULL,
                comment_text TEXT NOT NULL,
                attachment_url TEXT,
                resolved INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Add attachment_url column if it doesn't exist (for existing databases)
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE comments ADD COLUMN IF NOT EXISTS attachment_url TEXT;
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
        `);

        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_videos_message ON videos(channel_id, message_ts)
        `);

        console.log('📦 PostgreSQL database initialized');
    } finally {
        client.release();
    }

    return pgPool;
}

// ================================================
// SQLite Implementation (for local development)
// ================================================
async function initSqlite() {
    isPostgres = false;

    // Ensure data directory exists
    const dbPath = config.database.path;
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Run schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.run(schema);

    // Save database periodically
    setInterval(saveSqliteDatabase, 30000);

    console.log('📦 SQLite database initialized');
    return db;
}

// Save SQLite database to file
function saveSqliteDatabase() {
    if (db && !isPostgres) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(config.database.path, buffer);
    }
}

// ================================================
// Initialize Database (auto-detect type)
// ================================================
async function initDatabase() {
    if (usePostgres) {
        return initPostgres();
    } else {
        return initSqlite();
    }
}

// Get database instance (waits for initialization)
async function getDb() {
    if (!dbReady) {
        dbReady = initDatabase();
    }
    return dbReady;
}

// ================================================
// Unified Query Interface
// ================================================

// Get last insert rowid (SQLite only)
function getLastInsertRowid() {
    if (isPostgres) return null;

    const stmt = db.prepare('SELECT last_insert_rowid() as id');
    if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result.id;
    }
    stmt.free();
    return null;
}

// Prepare and run a statement that returns rows
function prepare(sql) {
    return {
        async get(...params) {
            if (isPostgres) {
                // Convert ? placeholders to $1, $2, etc.
                const pgSql = convertPlaceholders(sql);
                const result = await pgPool.query(pgSql, params);
                return result.rows[0] || null;
            } else {
                const stmt = db.prepare(sql);
                stmt.bind(params);
                if (stmt.step()) {
                    const row = stmt.getAsObject();
                    stmt.free();
                    return row;
                }
                stmt.free();
                return null;
            }
        },

        async all(...params) {
            if (isPostgres) {
                const pgSql = convertPlaceholders(sql);
                const result = await pgPool.query(pgSql, params);
                return result.rows;
            } else {
                const stmt = db.prepare(sql);
                stmt.bind(params);
                const results = [];
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                stmt.free();
                return results;
            }
        },

        async run(...params) {
            if (isPostgres) {
                // For INSERT, add RETURNING id to get the inserted ID
                let pgSql = convertPlaceholders(sql);
                let result;

                if (sql.trim().toUpperCase().startsWith('INSERT')) {
                    pgSql = pgSql.replace(/;?\s*$/, '') + ' RETURNING id';
                    result = await pgPool.query(pgSql, params);
                    return {
                        lastInsertRowid: result.rows[0]?.id || null,
                        changes: result.rowCount,
                    };
                } else {
                    result = await pgPool.query(pgSql, params);
                    return {
                        lastInsertRowid: null,
                        changes: result.rowCount,
                    };
                }
            } else {
                db.run(sql, params);
                const lastId = getLastInsertRowid();
                const changes = db.getRowsModified();
                saveSqliteDatabase(); // Auto-save after writes
                return {
                    lastInsertRowid: lastId,
                    changes: changes,
                };
            }
        },
    };
}

// Convert ? placeholders to PostgreSQL $1, $2, etc.
function convertPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
}

// Check if using PostgreSQL
function isUsingPostgres() {
    return isPostgres;
}

module.exports = {
    getDb,
    prepare,
    saveSqliteDatabase,
    isUsingPostgres,
};
