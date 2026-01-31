const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db = null;
let dbReady = null;

// Ensure data directory exists
const dbPath = config.database.path;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
async function initDatabase() {
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
    setInterval(saveDatabase, 30000);

    console.log('📦 Database initialized');
    return db;
}

// Save database to file
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

// Get database instance (waits for initialization)
async function getDb() {
    if (!dbReady) {
        dbReady = initDatabase();
    }
    return dbReady;
}

// Get last insert rowid
function getLastInsertRowid() {
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
        get(...params) {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return row;
            }
            stmt.free();
            return null;
        },
        all(...params) {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        },
        run(...params) {
            db.run(sql, params);
            const lastId = getLastInsertRowid();
            const changes = db.getRowsModified();
            saveDatabase(); // Auto-save after writes
            return {
                lastInsertRowid: lastId,
                changes: changes,
            };
        },
    };
}

module.exports = {
    getDb,
    prepare,
    saveDatabase,
};
