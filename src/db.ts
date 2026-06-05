import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

fs.mkdirSync("data", { recursive: true });

export const db = new DatabaseSync("data/drifterai.sqlite");
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS verified_members (
    discord_id TEXT PRIMARY KEY,
    rsi_handle TEXT NOT NULL,
    verified_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_fleet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    ship_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(discord_id, ship_name)
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward TEXT NOT NULL,
    role_needed TEXT NOT NULL,
    max_players INTEGER NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contract_members (
    contract_id INTEGER NOT NULL,
    discord_id TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY(contract_id, discord_id)
  );

  CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    time TEXT NOT NULL,
    description TEXT NOT NULL,
    max_players INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mission_members (
    mission_id INTEGER NOT NULL,
    discord_id TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY(mission_id, discord_id)
  );

  CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function nowIso() {
  return new Date().toISOString();
}

export function getSetting(key: string) {
  return db.prepare("SELECT value FROM bot_settings WHERE key = ?").get(key) as { value: string } | undefined;
}

export function setSetting(key: string, value: string) {
  db.prepare(`
    INSERT INTO bot_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}
