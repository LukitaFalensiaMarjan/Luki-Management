'use strict';
/**
 * LUKI MANAGEMENT - SQLite Database Restore Utility
 * Restores a selected snapshot from data/backups/ to data/luki.db
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'luki.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('luki-backup-') && f.endsWith('.db'))
    .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
}

function restore(targetName) {
  const backups = listBackups();
  if (backups.length === 0) {
    console.error('[RESTORE ERROR] No backup files found in data/backups/');
    process.exit(1);
  }

  let chosen = null;
  if (!targetName) {
    chosen = backups[0]; // Most recent
    console.log(`[RESTORE] No backup specified. Using most recent: ${chosen.name}`);
  } else {
    chosen = backups.find(b => b.name === targetName || b.name.includes(targetName));
    if (!chosen) {
      console.error(`[RESTORE ERROR] Backup "${targetName}" not found. Available backups:`);
      backups.forEach(b => console.log(` - ${b.name}`));
      process.exit(1);
    }
  }

  // Safety backup of current database
  if (fs.existsSync(DB_FILE)) {
    const safetyFile = path.join(DATA_DIR, `pre-restore-safety-${Date.now()}.db`);
    fs.copyFileSync(DB_FILE, safetyFile);
    console.log(`[RESTORE SAFETY] Current database backed up to ${path.basename(safetyFile)}`);
  }

  fs.copyFileSync(chosen.path, DB_FILE);
  console.log(`[RESTORE SUCCESS] Database restored successfully from ${chosen.name}`);
}

const target = process.argv[2];
restore(target);
