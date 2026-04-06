const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createDatabase } = require('./db');

const withDb = async (callback) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'linksaved-db-layer-'));
  const dbPath = path.join(tempRoot, 'test.db');
  const db = createDatabase(dbPath);

  try {
    await callback(db);
  } finally {
    db.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

test('database: persists and reads links', async () => {
  await withDb((db) => {
    db.addLink({ name: 'Node', url: 'https://nodejs.org' });
    assert.equal(db.readLinks().length, 1);
  });
});

test('database: persists and reads study state', async () => {
  await withDb((db) => {
    db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: null,
      completionCount: 2,
    });

    const state = db.readStudyState();
    assert.equal(state.prompt, 'event loop');
    assert.equal(state.completionCount, 2);
  });
});
