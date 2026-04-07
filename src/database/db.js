// SQLite gateway responsible only for persistence and schema management.
const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_STUDY_DIFFICULTY } = require('../config/constants');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'linksaved.db');
const LEGACY_LINKS_JSON = path.join(__dirname, '..', 'data', 'links.json');
const LEGACY_STUDY_JSON = path.join(__dirname, '..', 'data', 'study-theme.json');

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
      difficulty       TEXT    NOT NULL DEFAULT 'medium',
			updated_at       TEXT,
			lesson           TEXT,
			completion_count INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS study_queue (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			prompt     TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'medium',
			created_at TEXT NOT NULL,
			sort_order REAL NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS study_history (
			id              INTEGER PRIMARY KEY AUTOINCREMENT,
			prompt_snapshot TEXT    NOT NULL,
			explanation     TEXT    NOT NULL,
			cycle_number    INTEGER NOT NULL,
			total_questions INTEGER NOT NULL,
			correct_count   INTEGER NOT NULL,
			completed_at    TEXT    NOT NULL
		);
	`);

  const queueColumns = db.prepare("PRAGMA table_info('study_queue')").all();
  const hasSortOrder = queueColumns.some((column) => column.name === 'sort_order');
  const hasQueueDifficulty = queueColumns.some((column) => column.name === 'difficulty');
  if (!hasSortOrder) {
    db.exec('ALTER TABLE study_queue ADD COLUMN sort_order REAL NOT NULL DEFAULT 0');
  }
  if (!hasQueueDifficulty) {
    db.exec(
      `ALTER TABLE study_queue ADD COLUMN difficulty TEXT NOT NULL DEFAULT '${DEFAULT_STUDY_DIFFICULTY}'`
    );
  }
  db.exec('UPDATE study_queue SET sort_order = id WHERE sort_order = 0');

  const stateColumns = db.prepare("PRAGMA table_info('study_state')").all();
  const hasStateDifficulty = stateColumns.some((column) => column.name === 'difficulty');
  if (!hasStateDifficulty) {
    db.exec(
      `ALTER TABLE study_state ADD COLUMN difficulty TEXT NOT NULL DEFAULT '${DEFAULT_STUDY_DIFFICULTY}'`
    );
  }

  if (!dbPath) {
    const linksCount = db.prepare('SELECT COUNT(*) AS c FROM links').get().c;
    if (linksCount === 0) {
      try {
        const rows = JSON.parse(fs.readFileSync(LEGACY_LINKS_JSON, 'utf8'));
        const insert = db.prepare('INSERT OR IGNORE INTO links (name, url) VALUES (?, ?)');
        db.transaction((items) => items.forEach((row) => insert.run(row.name, row.url)))(
          Array.isArray(rows) ? rows : []
        );
      } catch {
        // Ignore invalid legacy JSON input.
      }
    }

    const studyRowCount = db.prepare('SELECT COUNT(*) AS c FROM study_state').get().c;
    if (studyRowCount === 0) {
      try {
        const state = JSON.parse(fs.readFileSync(LEGACY_STUDY_JSON, 'utf8'));
        db.prepare(
          'INSERT INTO study_state (id, prompt, difficulty, updated_at, lesson, completion_count) VALUES (1, ?, ?, ?, ?, ?)'
        ).run(
          state.prompt || '',
          state.difficulty || DEFAULT_STUDY_DIFFICULTY,
          state.updatedAt || null,
          state.lesson ? JSON.stringify(state.lesson) : null,
          state.completionCount || 0
        );
      } catch {
        // Ignore invalid legacy JSON input.
      }
    }
  }

  const studyRowExists = db.prepare('SELECT COUNT(*) AS c FROM study_state').get().c;
  if (studyRowExists === 0) {
    db.prepare(
      `INSERT INTO study_state (id, prompt, difficulty, updated_at, lesson, completion_count)
       VALUES (1, '', '${DEFAULT_STUDY_DIFFICULTY}', NULL, NULL, 0)`
    ).run();
  }

  const readLinks = () => db.prepare('SELECT name, url FROM links ORDER BY id').all();

  const addLink = (link) =>
    db.prepare('INSERT OR IGNORE INTO links (name, url) VALUES (?, ?)').run(link.name, link.url);

  const deleteLink = (url) => db.prepare('DELETE FROM links WHERE url = ?').run(url);

  const readStudyState = () => {
    const row = db.prepare('SELECT * FROM study_state WHERE id = 1').get();
    if (!row) {
      return {
        prompt: '',
        difficulty: DEFAULT_STUDY_DIFFICULTY,
        updatedAt: null,
        lesson: null,
        completionCount: 0,
      };
    }

    return {
      prompt: row.prompt,
      difficulty: row.difficulty || DEFAULT_STUDY_DIFFICULTY,
      updatedAt: row.updated_at,
      lesson: row.lesson ? JSON.parse(row.lesson) : null,
      completionCount: row.completion_count,
    };
  };

  const writeStudyState = (state) => {
    db.prepare(
      `
      INSERT INTO study_state (id, prompt, difficulty, updated_at, lesson, completion_count)
			VALUES (1, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				prompt           = excluded.prompt,
				difficulty       = excluded.difficulty,
				updated_at       = excluded.updated_at,
				lesson           = excluded.lesson,
				completion_count = excluded.completion_count
		`
    ).run(
      state.prompt || '',
      state.difficulty || DEFAULT_STUDY_DIFFICULTY,
      state.updatedAt || null,
      state.lesson ? JSON.stringify(state.lesson) : null,
      state.completionCount || 0
    );
  };

  const enqueueStudy = (item) => {
    const prompt = typeof item === 'string' ? item : item?.prompt;
    const difficulty =
      typeof item === 'string'
        ? DEFAULT_STUDY_DIFFICULTY
        : item?.difficulty || DEFAULT_STUDY_DIFFICULTY;
    const nextSortOrder = db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextSortOrder FROM study_queue')
      .get().nextSortOrder;

    return db
      .prepare(
        'INSERT INTO study_queue (prompt, difficulty, created_at, sort_order) VALUES (?, ?, ?, ?)'
      )
      .run(prompt, difficulty, new Date().toISOString(), nextSortOrder);
  };

  const dequeueNextStudy = () => {
    const row = db.prepare('SELECT * FROM study_queue ORDER BY sort_order, id LIMIT 1').get();
    if (!row) {
      return null;
    }

    db.prepare('DELETE FROM study_queue WHERE id = ?').run(row.id);
    return row.prompt;
  };

  const listQueue = () =>
    db
      .prepare(
        `SELECT
          id,
          prompt,
          difficulty,
          created_at AS createdAt
         FROM study_queue
         ORDER BY sort_order, id`
      )
      .all();

  const deleteFromQueue = (id) => db.prepare('DELETE FROM study_queue WHERE id = ?').run(id);

  const moveQueueItem = (id, direction) => {
    const current = db.prepare('SELECT id, sort_order FROM study_queue WHERE id = ?').get(id);
    if (!current) {
      return false;
    }

    const neighbor =
      direction === 'up'
        ? db
            .prepare(
              `SELECT id, sort_order
							 FROM study_queue
							 WHERE sort_order < ? OR (sort_order = ? AND id < ?)
							 ORDER BY sort_order DESC, id DESC
							 LIMIT 1`
            )
            .get(current.sort_order, current.sort_order, current.id)
        : db
            .prepare(
              `SELECT id, sort_order
							 FROM study_queue
							 WHERE sort_order > ? OR (sort_order = ? AND id > ?)
							 ORDER BY sort_order ASC, id ASC
							 LIMIT 1`
            )
            .get(current.sort_order, current.sort_order, current.id);

    if (!neighbor) {
      return false;
    }

    db.transaction(() => {
      db.prepare('UPDATE study_queue SET sort_order = ? WHERE id = ?').run(
        neighbor.sort_order,
        current.id
      );
      db.prepare('UPDATE study_queue SET sort_order = ? WHERE id = ?').run(
        current.sort_order,
        neighbor.id
      );
    })();

    return true;
  };

  const reorderQueue = (orderedIds) => {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return false;
    }

    const queueRows = db.prepare('SELECT id FROM study_queue').all();
    const queueIds = queueRows.map((row) => row.id);

    if (queueIds.length !== orderedIds.length) {
      return false;
    }

    const queueSet = new Set(queueIds);
    const providedSet = new Set(orderedIds);
    if (queueSet.size !== providedSet.size) {
      return false;
    }

    for (const id of orderedIds) {
      if (!queueSet.has(id)) {
        return false;
      }
    }

    db.transaction(() => {
      const update = db.prepare('UPDATE study_queue SET sort_order = ? WHERE id = ?');
      orderedIds.forEach((id, index) => {
        update.run(index + 1, id);
      });
    })();

    return true;
  };

  const addStudyHistory = (entry) =>
    db
      .prepare(
        `INSERT INTO study_history
				(prompt_snapshot, explanation, cycle_number, total_questions, correct_count, completed_at)
				VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.promptSnapshot,
        entry.explanation,
        entry.cycleNumber,
        entry.totalQuestions,
        entry.correctCount,
        entry.completedAt
      );

  const listStudyHistory = () =>
    db
      .prepare(
        `SELECT
					id,
					prompt_snapshot AS promptSnapshot,
					explanation,
					cycle_number AS cycleNumber,
					total_questions AS totalQuestions,
					correct_count AS correctCount,
					completed_at AS completedAt
				FROM study_history
				ORDER BY id DESC`
      )
      .all();

  const close = () => db.close();

  return {
    readLinks,
    addLink,
    deleteLink,
    readStudyState,
    writeStudyState,
    enqueueStudy,
    dequeueNextStudy,
    listQueue,
    deleteFromQueue,
    moveQueueItem,
    reorderQueue,
    addStudyHistory,
    listStudyHistory,
    close,
  };
};

module.exports = {
  createDatabase,
};
