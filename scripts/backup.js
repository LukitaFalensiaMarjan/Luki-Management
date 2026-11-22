'use strict';
/**
 * LUKI MANAGEMENT - SQLite Database Backup Script
 * Uses VACUUM INTO for a safe, atomic, lock-free snapshot of SQLite.
 * Keeps the 7 most recent backups and prunes older ones.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'luki.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 7;

function pad(n) { return String(n).padStart(2, '0'); }

function getTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function runBackup() {
  if (!fs.existsSync(DB_FILE)) {
    console.error(`[BACKUP ERROR] Database file not found at ${DB_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const ts = getTimestamp();
  const backupFileName = `luki-backup-${ts}.db`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  console.log(`[BACKUP] Creating snapshot: ${backupFileName}...`);
  const start = Date.now();

  try {
    const db = new DatabaseSync(DB_FILE);
    // VACUUM INTO creates a defragmented, clean binary copy of the active database
    db.exec(`VACUUM INTO '${backupFilePath.replace(/\\/g, '/')}'`);
    db.close();

    const stats = fs.statSync(backupFilePath);
    const duration = Date.now() - start;
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[BACKUP SUCCESS] Snapshot created (${sizeMb} MB) in ${duration}ms -> ${backupFilePath}`);

    pruneOldBackups();
  } catch (err) {
    console.error(`[BACKUP FAILED]:`, err.message);
    process.exit(1);
  }
}

function pruneOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('luki-backup-') && f.endsWith('.db'))
    .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      fs.unlinkSync(f.path);
      console.log(`[BACKUP PRUNE] Removed old snapshot: ${f.name}`);
    }
  }
}

runBackup();
