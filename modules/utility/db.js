// ============================================================
// modules/utility/db.js — High-Performance SQLite Database Engine
// Powered by node:sqlite (Node 22+) with WAL mode & ACID transactions.
// ============================================================

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { BOT_CONFIG, DEFAULT_COINS, LEGACY_OLD_CURRENCY_KEY, LEGACY_OLD_BALANCE_KEY, COOLDOWNS } = require('../../config');

// Ensure database & temp directory exist
const DB_DIR = path.resolve(process.cwd(), 'database');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(BOT_CONFIG.TEMP_DIR)) fs.mkdirSync(BOT_CONFIG.TEMP_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'wabot.db');
const db = new DatabaseSync(DB_PATH);

// Optimize SQLite for high-concurrency bot workloads
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Schema Initialization
db.exec(`
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    coins INTEGER DEFAULT 50,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guilds (
    name TEXT PRIMARY KEY,
    leader TEXT,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace (
    id TEXT PRIMARY KEY,
    seller TEXT,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bounties (
    target TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS banned_users (
    jid TEXT PRIMARY KEY,
    banned_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
    jid TEXT PRIMARY KEY,
    added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
`);

// Prepared Statements
const stmtGetPlayer = db.prepare('SELECT data FROM players WHERE id = ?');
const stmtUpsertPlayer = db.prepare(`
    INSERT INTO players (id, coins, data, updated_at) 
    VALUES (?, ?, ?, ?) 
    ON CONFLICT(id) DO UPDATE SET 
        coins = excluded.coins, 
        data = excluded.data, 
        updated_at = excluded.updated_at
`);
const stmtGetAllPlayers = db.prepare('SELECT id, data FROM players');

const stmtGetGuild = db.prepare('SELECT data FROM guilds WHERE name = ?');
const stmtUpsertGuild = db.prepare(`
    INSERT INTO guilds (name, leader, data, updated_at) 
    VALUES (?, ?, ?, ?) 
    ON CONFLICT(name) DO UPDATE SET 
        leader = excluded.leader, 
        data = excluded.data, 
        updated_at = excluded.updated_at
`);
const stmtDeleteGuild = db.prepare('DELETE FROM guilds WHERE name = ?');
const stmtGetAllGuilds = db.prepare('SELECT name, data FROM guilds');

const stmtGetAllMarket = db.prepare('SELECT data FROM marketplace');
const stmtClearMarket = db.prepare('DELETE FROM marketplace');
const stmtInsertMarket = db.prepare('INSERT INTO marketplace (id, seller, data, created_at) VALUES (?, ?, ?, ?)');

const stmtGetAllBounties = db.prepare('SELECT target, data FROM bounties');
const stmtUpsertBounty = db.prepare(`
    INSERT INTO bounties (target, data, updated_at) 
    VALUES (?, ?, ?) 
    ON CONFLICT(target) DO UPDATE SET 
        data = excluded.data, 
        updated_at = excluded.updated_at
`);
const stmtDeleteBounty = db.prepare('DELETE FROM bounties WHERE target = ?');

const stmtGetAllBanned = db.prepare('SELECT jid FROM banned_users');
const stmtInsertBanned = db.prepare('INSERT OR IGNORE INTO banned_users (jid, banned_at) VALUES (?, ?)');
const stmtDeleteBanned = db.prepare('DELETE FROM banned_users WHERE jid = ?');

const stmtGetAllAdmins = db.prepare('SELECT jid FROM admin_users');
const stmtInsertAdmin = db.prepare('INSERT OR IGNORE INTO admin_users (jid, added_at) VALUES (?, ?)');
const stmtDeleteAdmin = db.prepare('DELETE FROM admin_users WHERE jid = ?');

const stmtGetSession = db.prepare('SELECT data FROM sessions WHERE key = ?');
const stmtUpsertSession = db.prepare(`
    INSERT INTO sessions (key, data, updated_at) 
    VALUES (?, ?, ?) 
    ON CONFLICT(key) DO UPDATE SET 
        data = excluded.data, 
        updated_at = excluded.updated_at
`);

// Automatic JSON Migration
function runJsonMigration() {
    try {
        const rowCount = db.prepare('SELECT COUNT(*) as count FROM players').get();
        if (rowCount && rowCount.count === 0 && fs.existsSync(BOT_CONFIG.PLAYER_DATA_FILE)) {
            console.log('[DB MIGRATE] Migrating player_data.json into SQLite...');
            const raw = JSON.parse(fs.readFileSync(BOT_CONFIG.PLAYER_DATA_FILE, 'utf-8'));
            const now = Date.now();
            for (const [id, player] of Object.entries(raw)) {
                const coins = Number(player.coins) || DEFAULT_COINS;
                stmtUpsertPlayer.run(id, coins, JSON.stringify(player), now);
            }
            console.log(`[DB MIGRATE] Migrated ${Object.keys(raw).length} players.`);
        }

        if (fs.existsSync(BOT_CONFIG.GUILD_DATA_FILE)) {
            const rawGuilds = JSON.parse(fs.readFileSync(BOT_CONFIG.GUILD_DATA_FILE, 'utf-8'));
            const now = Date.now();
            for (const [name, guild] of Object.entries(rawGuilds)) {
                stmtUpsertGuild.run(name.toLowerCase(), guild.leader || null, JSON.stringify(guild), now);
            }
        }

        if (fs.existsSync(BOT_CONFIG.BANNED_FILE)) {
            const rawBanned = JSON.parse(fs.readFileSync(BOT_CONFIG.BANNED_FILE, 'utf-8'));
            const now = Date.now();
            if (Array.isArray(rawBanned)) {
                for (const jid of rawBanned) stmtInsertBanned.run(jid, now);
            }
        }

        if (fs.existsSync(BOT_CONFIG.ADMIN_USERS_FILE)) {
            const rawAdmins = JSON.parse(fs.readFileSync(BOT_CONFIG.ADMIN_USERS_FILE, 'utf-8'));
            const now = Date.now();
            if (Array.isArray(rawAdmins)) {
                for (const jid of rawAdmins) stmtInsertAdmin.run(jid, now);
            }
        }
    } catch (err) {
        console.error('[DB MIGRATE ERROR]', err.message);
    }
}
runJsonMigration();

function loadPlayerData() {
    const rows = stmtGetAllPlayers.all();
    const result = {};
    for (const r of rows) {
        try { result[r.id] = JSON.parse(r.data); } catch (e) {}
    }
    return result;
}

function savePlayerData(data) {
    if (!data || typeof data !== 'object') return;
    for (const [id, info] of Object.entries(data)) updatePlayer(id, info);
}

function getPlayer(playerId) {
    const row = stmtGetPlayer.get(playerId);
    if (row) {
        try { return JSON.parse(row.data); } catch (e) {}
    }
    const newPlayer = {
        coins: DEFAULT_COINS,
        rpg: null,
        koleksi: [],
        displayName: null,
        lastDaily: null
    };
    stmtUpsertPlayer.run(playerId, DEFAULT_COINS, JSON.stringify(newPlayer), Date.now());
    return newPlayer;
}

function updatePlayer(playerId, playerInfo) {
    if (!playerInfo) return;
    const coins = Math.max(0, Math.floor(Number(playerInfo.coins) || 0));
    playerInfo.coins = coins;
    stmtUpsertPlayer.run(playerId, coins, JSON.stringify(playerInfo), Date.now());
}

function getDisplayName(playerId) {
    const player = getPlayer(playerId);
    return player.displayName || playerId.split('@')[0];
}

function normalizePlayerCurrency(player) {
    if (!player) return player;
    if (player[LEGACY_OLD_CURRENCY_KEY] !== undefined && player.coins === undefined) {
        player.coins = player[LEGACY_OLD_CURRENCY_KEY];
        delete player[LEGACY_OLD_CURRENCY_KEY];
    }
    if (player[LEGACY_OLD_BALANCE_KEY] !== undefined && player.coins === undefined) {
        player.coins = player[LEGACY_OLD_BALANCE_KEY];
        delete player[LEGACY_OLD_BALANCE_KEY];
    }
    if (player.coins === undefined) player.coins = DEFAULT_COINS;
    player.coins = Math.max(0, Math.floor(Number(player.coins) || 0));
    return player;
}

function loadBannedUsers() {
    return stmtGetAllBanned.all().map(r => r.jid);
}

function saveBannedUsers(list) {
    if (!Array.isArray(list)) return;
    db.exec('DELETE FROM banned_users');
    const now = Date.now();
    for (const jid of list) stmtInsertBanned.run(jid, now);
}

function isBanned(jid) {
    if (!jid) return false;
    const key = jid.split('@')[0];
    return loadBannedUsers().some(b => b.split('@')[0] === key);
}

function banUser(jid) {
    if (!jid || isBanned(jid)) return;
    stmtInsertBanned.run(jid, Date.now());
}

function unbanUser(jid) {
    if (!jid) return;
    const key = jid.split('@')[0];
    for (const r of stmtGetAllBanned.all()) {
        if (r.jid.split('@')[0] === key) stmtDeleteBanned.run(r.jid);
    }
}

function loadAdmins() {
    return stmtGetAllAdmins.all().map(r => r.jid);
}

function saveAdmins(list) {
    if (!Array.isArray(list)) return;
    db.exec('DELETE FROM admin_users');
    const now = Date.now();
    for (const jid of list) stmtInsertAdmin.run(jid, now);
}

function isBotAdmin(jid) {
    return loadAdmins().some(a => a === jid) || (BOT_CONFIG.ADMIN_NUMBERS || []).map(normalizeJid).includes(jid);
}

function isOwner(jid) {
    if (!jid) return false;
    const parts = jid.split('@');
    const beforeAt = parts[0].split(':')[0];
    const ownerClean = (BOT_CONFIG.OWNER_NUMBER || '').split('@')[0];
    const ownerLid = (BOT_CONFIG.OWNER_LID || '').split('@')[0];
    const ownerNumbers = Array.isArray(BOT_CONFIG.OWNER_NUMBERS) ? BOT_CONFIG.OWNER_NUMBERS : [];
    return Boolean(
        (ownerClean && beforeAt === ownerClean) ||
        (ownerLid && beforeAt === ownerLid) ||
        ownerNumbers.includes(beforeAt) ||
        (BOT_CONFIG.OWNER_NUMBER && jid === BOT_CONFIG.OWNER_NUMBER) ||
        (BOT_CONFIG.OWNER_LID && jid === BOT_CONFIG.OWNER_LID)
    );
}

function isPrivileged(jid) {
    return isOwner(jid) || isBotAdmin(jid);
}

function normalizeJid(jid) {
    if (!jid) return '';
    jid = jid.trim();
    if (!jid.includes('@')) return jid + '@s.whatsapp.net';
    return jid;
}

function jidKey(jid) { return (jid || '').split('@')[0]; }
function sameJid(a, b) { return normalizeJid(a) === normalizeJid(b); }

function loadGuildData() {
    const rows = stmtGetAllGuilds.all();
    const result = {};
    for (const r of rows) {
        try { result[r.name.toLowerCase()] = JSON.parse(r.data); } catch (e) {}
    }
    return result;
}

function saveGuildData(data) {
    if (!data) return;
    for (const [name, g] of Object.entries(data)) saveGuild(name, g);
}

function getGuild(name) {
    if (!name) return null;
    const row = stmtGetGuild.get(name.toLowerCase());
    if (row) {
        try { return JSON.parse(row.data); } catch (e) {}
    }
    return null;
}

function saveGuild(name, data) {
    if (!name || !data) return;
    stmtUpsertGuild.run(name.toLowerCase(), data.leader || null, JSON.stringify(data), Date.now());
}

function deleteGuild(name) {
    if (!name) return;
    stmtDeleteGuild.run(name.toLowerCase());
}

function findPlayerGuild(playerId) {
    const all = loadGuildData();
    for (const [name, g] of Object.entries(all)) {
        if (g.leader === playerId) return { name, ...g };
        if ((g.members || []).includes(playerId)) return { name, ...g };
    }
    return null;
}

function loadMarketData() {
    const rows = stmtGetAllMarket.all();
    const result = [];
    for (const r of rows) {
        try { result.push(JSON.parse(r.data)); } catch (e) {}
    }
    return result;
}

function saveMarketData(data) {
    if (!Array.isArray(data)) return;
    stmtClearMarket.run();
    const now = Date.now();
    for (const item of data) {
        const id = item.id || `m_${Math.random().toString(36).substring(2, 9)}`;
        stmtInsertMarket.run(id, item.seller || null, JSON.stringify(item), now);
    }
}

function loadBountyData() {
    const rows = stmtGetAllBounties.all();
    const result = {};
    for (const r of rows) {
        try { result[r.target] = JSON.parse(r.data); } catch (e) {}
    }
    return result;
}

function saveBountyData(data) {
    if (!data || typeof data !== 'object') return;
    const existing = loadBountyData();
    for (const target of Object.keys(existing)) {
        if (!data[target]) stmtDeleteBounty.run(target);
    }
    const now = Date.now();
    for (const [target, b] of Object.entries(data)) {
        stmtUpsertBounty.run(target, JSON.stringify(b), now);
    }
}

const CUSTOM_ITEMS_FILE = './database/custom_items.json';

function loadCustomItems() {
    try {
        if (fs.existsSync(CUSTOM_ITEMS_FILE)) {
            const data = JSON.parse(fs.readFileSync(CUSTOM_ITEMS_FILE, 'utf-8'));
            const { RPG_WEAPONS, RPG_ARMORS, RPG_ITEMS } = require('../../config');
            if (data.weapons) Object.assign(RPG_WEAPONS, data.weapons);
            if (data.armors) Object.assign(RPG_ARMORS, data.armors);
            if (data.items) Object.assign(RPG_ITEMS, data.items);
            return data;
        }
    } catch (e) {
        console.error('[DB ERROR] loadCustomItems:', e.message);
    }
    return { weapons: {}, armors: {}, items: {} };
}

function saveCustomItems(data) {
    try {
        if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
        fs.writeFileSync(CUSTOM_ITEMS_FILE, JSON.stringify(data, null, 2));
        loadCustomItems();
    } catch (e) {
        console.error('[DB ERROR] saveCustomItems:', e.message);
    }
}

const playerCooldowns = {};

function checkCooldown(playerId, action) {
    if (!playerCooldowns[playerId]) playerCooldowns[playerId] = {};
    const last = playerCooldowns[playerId][action] || 0;
    const cd = COOLDOWNS[action] || 0;
    const remaining = cd - (Date.now() - last);
    if (remaining > 0) return remaining;
    playerCooldowns[playerId][action] = Date.now();
    return 0;
}

function formatCooldown(ms) {
    if (ms >= 60000) return `${Math.ceil(ms / 60000)}m`;
    return `${Math.ceil(ms / 1000)}s`;
}

const activeDuels = {};
const activeRaids = {};
const activeGambles = {};
let activeWorldBoss = null;
let activeDemonInvasion = null;

function saveSession(key, data) {
    try {
        stmtUpsertSession.run(key, JSON.stringify(data), Date.now());
    } catch (e) {
        console.error(`[DB ERROR] saveSession (${key}):`, e.message);
    }
}

function loadSession(key) {
    try {
        const row = stmtGetSession.get(key);
        if (row) return JSON.parse(row.data);
    } catch (e) {
        console.error(`[DB ERROR] loadSession (${key}):`, e.message);
    }
    return null;
}

const sessionTimer = setInterval(() => {
    saveSession('activeDuels', activeDuels);
    saveSession('activeRaids', activeRaids);
    saveSession('activeGambles', activeGambles);
    if (activeWorldBoss) saveSession('activeWorldBoss', activeWorldBoss);
    if (activeDemonInvasion) saveSession('activeDemonInvasion', activeDemonInvasion);
}, 30000);
if (sessionTimer.unref) sessionTimer.unref();

Object.assign(activeDuels, loadSession('activeDuels') || {});
Object.assign(activeRaids, loadSession('activeRaids') || {});
Object.assign(activeGambles, loadSession('activeGambles') || {});
const savedBoss = loadSession('activeWorldBoss');
const savedInvasion = loadSession('activeDemonInvasion');
if (savedBoss) activeWorldBoss = savedBoss;
if (savedInvasion) activeDemonInvasion = savedInvasion;

module.exports = {
    getPlayer, updatePlayer, getDisplayName,
    normalizePlayerCurrency,
    loadBannedUsers, saveBannedUsers, isBanned, banUser, unbanUser,
    loadAdmins, saveAdmins, isBotAdmin, isOwner, isPrivileged,
    normalizeJid, jidKey, sameJid,
    getGuild, saveGuild, deleteGuild, findPlayerGuild,
    loadMarketData, saveMarketData,
    loadBountyData, saveBountyData,
    loadCustomItems, saveCustomItems,
    checkCooldown, formatCooldown,
    playerCooldowns, activeDuels, activeRaids, activeGambles, activeWorldBoss, activeDemonInvasion,
    saveSession, loadSession,
    loadPlayerData, savePlayerData,
    db
};

loadCustomItems();
