const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'linksaved.db');
const LEGACY_LINKS_JSON = path.join(__dirname, 'data', 'links.json');
const LEGACY_STUDY_JSON = path.join(__dirname, 'data', 'study-theme.json');

const createDatabase = (dbPath) => {
  const resolvedPath = dbPath || DEFAULT_DB_PATH;
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url  TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS study_state (
      id               INTEGER PRIMARY KEY CHECK (id = 1),
      prompt           TEXT    NOT NULL DEFAULT '',
      updated_at       TEXT,
      lesson           TEXT,
      completion_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  if (!dbPath) {
    const linksCount = db.prepare('SELECT COUNT(*) as c FROM links').get().c;
    if (linksCount === 0) {
      try {
        const rows = JSON.parse(fs.readFileSync(LEGACY_LINKS_JSON, 'utf8'));
        const insert = db.prepare('INSERT OR IGNORE INTO links (name, url) VALUES (?, ?)');
        db.transaction((items) => items.forEach((r) => insert.run(r.name, r.url)))(
          Array.isArray(rows) ? rows : []
        );
      } catch {}
    }

    const studyRowCount = db.prepare('SELECT COUNT(*) as c FROM study_state').get().c;
    if (studyRowCount === 0) {
      try {
        const state = JSON.parse(fs.readFileSync(LEGACY_STUDY_JSON, 'utf8'));
        db.prepare(
          'INSERT INTO study_state (id, prompt, updated_at, lesson, completion_count) VALUES (1, ?, ?, ?, ?)'
        ).run(
          state.prompt || '',
          state.updatedAt || null,
          state.lesson ? JSON.stringify(state.lesson) : null,
          state.completionCount || 0
        );
      } catch {}
    }
  }

  const studyRowExists = db.prepare('SELECT COUNT(*) as c FROM study_state').get().c;
  if (studyRowExists === 0) {
    db.prepare(
      "INSERT INTO study_state (id, prompt, updated_at, lesson, completion_count) VALUES (1, '', NULL, NULL, 0)"
    ).run();
  }

  const readLinks = () => db.prepare('SELECT name, url FROM links ORDER BY id').all();

  const addLink = (link) =>
    db.prepare('INSERT OR IGNORE INTO links (name, url) VALUES (?, ?)').run(link.name, link.url);

  const deleteLink = (url) => db.prepare('DELETE FROM links WHERE url = ?').run(url);

  const readStudyState = () => {
    const row = db.prepare('SELECT * FROM study_state WHERE id = 1').get();
    if (!row) return { prompt: '', updatedAt: null, lesson: null, completionCount: 0 };
    return {
      prompt: row.prompt,
      updatedAt: row.updated_at,
      lesson: row.lesson ? JSON.parse(row.lesson) : null,
      completionCount: row.completion_count
    };
  };

  const writeStudyState = (state) => {
    db.prepare(`
      INSERT INTO study_state (id, prompt, updated_at, lesson, completion_count)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        prompt           = excluded.prompt,
        updated_at       = excluded.updated_at,
        lesson           = excluded.lesson,
        completion_count = excluded.completion_count
    `).run(
      state.prompt || '',
      state.updatedAt || null,
      state.lesson ? JSON.stringify(state.lesson) : null,
      state.completionCount || 0
    );
  };

  const close = () => db.close();

  return { readLinks, addLink, deleteLink, readStudyState, writeStudyState, close };
};

module.exports = { createDatabase };
