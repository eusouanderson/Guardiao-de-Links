const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createDatabase } = require('../src/db');

async function withDb(fn) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'linksaved-db-test-'));
  const dbPath = path.join(tempRoot, 'test.db');
  const db = createDatabase(dbPath);
  try {
    await fn(db);
  } finally {
    db.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

test('db: readLinks returns empty array when no links exist', async () => {
  await withDb((db) => {
    assert.deepEqual(db.readLinks(), []);
  });
});

test('db: addLink inserts a link and readLinks returns it', async () => {
  await withDb((db) => {
    db.addLink({ name: 'Node', url: 'https://nodejs.org' });
    const links = db.readLinks();
    assert.equal(links.length, 1);
    assert.equal(links[0].name, 'Node');
    assert.equal(links[0].url, 'https://nodejs.org');
  });
});

test('db: addLink ignores duplicate URLs (INSERT OR IGNORE)', async () => {
  await withDb((db) => {
    db.addLink({ name: 'Node', url: 'https://nodejs.org' });
    db.addLink({ name: 'Node Duplicado', url: 'https://nodejs.org' });
    const links = db.readLinks();
    assert.equal(links.length, 1);
    assert.equal(links[0].name, 'Node');
  });
});

test('db: addLink preserves insertion order', async () => {
  await withDb((db) => {
    db.addLink({ name: 'Alpha', url: 'https://alpha.com' });
    db.addLink({ name: 'Beta', url: 'https://beta.com' });
    db.addLink({ name: 'Gamma', url: 'https://gamma.com' });
    const names = db.readLinks().map((l) => l.name);
    assert.deepEqual(names, ['Alpha', 'Beta', 'Gamma']);
  });
});

test('db: addLink stores only name and url (no extra columns)', async () => {
  await withDb((db) => {
    db.addLink({ name: 'Node', url: 'https://nodejs.org' });
    const link = db.readLinks()[0];
    assert.deepEqual(Object.keys(link), ['name', 'url']);
  });
});

test('db: deleteLink removes a link by URL', async () => {
  await withDb((db) => {
    db.addLink({ name: 'Node', url: 'https://nodejs.org' });
    db.deleteLink('https://nodejs.org');
    assert.deepEqual(db.readLinks(), []);
  });
});

test('db: deleteLink does nothing for non-existent URL', async () => {
  await withDb((db) => {
    db.addLink({ name: 'Node', url: 'https://nodejs.org' });
    db.deleteLink('https://naoexiste.com');
    assert.equal(db.readLinks().length, 1);
  });
});

test('db: deleteLink removes only the targeted URL', async () => {
  await withDb((db) => {
    db.addLink({ name: 'A', url: 'https://a.com' });
    db.addLink({ name: 'B', url: 'https://b.com' });
    db.deleteLink('https://a.com');
    const links = db.readLinks();
    assert.equal(links.length, 1);
    assert.equal(links[0].url, 'https://b.com');
  });
});

// ---------------------------------------------------------------------------
// Study state
// ---------------------------------------------------------------------------

test('db: readStudyState returns default state on fresh database', async () => {
  await withDb((db) => {
    const state = db.readStudyState();
    assert.equal(state.prompt, '');
    assert.equal(state.updatedAt, null);
    assert.equal(state.lesson, null);
    assert.equal(state.completionCount, 0);
  });
});

test('db: writeStudyState persists and readStudyState returns values', async () => {
  await withDb((db) => {
    db.writeStudyState({
      prompt: 'closures',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: null,
      completionCount: 3
    });
    const state = db.readStudyState();
    assert.equal(state.prompt, 'closures');
    assert.equal(state.updatedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(state.lesson, null);
    assert.equal(state.completionCount, 3);
  });
});

test('db: writeStudyState serializes and deserializes lesson as JSON', async () => {
  await withDb((db) => {
    const lesson = {
      promptSnapshot: 'closures',
      explanation: 'Closures capturam escopo.',
      questions: [
        {
          id: 1,
          question: 'Q?',
          options: ['A', 'B', 'C', 'D'],
          correctOptionIndex: 0,
          solved: false,
          selectedOptionIndex: null
        }
      ],
      correctCount: 0,
      completed: false,
      generatedAt: '2026-01-01T00:00:00.000Z'
    };
    db.writeStudyState({ prompt: 'closures', updatedAt: null, lesson, completionCount: 0 });
    const state = db.readStudyState();
    assert.deepEqual(state.lesson, lesson);
  });
});

test('db: writeStudyState overwrites previous state on second call', async () => {
  await withDb((db) => {
    db.writeStudyState({ prompt: 'closures', updatedAt: null, lesson: null, completionCount: 0 });
    db.writeStudyState({
      prompt: 'promises',
      updatedAt: '2026-01-02T00:00:00.000Z',
      lesson: null,
      completionCount: 5
    });
    const state = db.readStudyState();
    assert.equal(state.prompt, 'promises');
    assert.equal(state.completionCount, 5);
  });
});

test('db: writeStudyState treats undefined prompt as empty string', async () => {
  await withDb((db) => {
    db.writeStudyState({ updatedAt: null, lesson: null, completionCount: 0 });
    const state = db.readStudyState();
    assert.equal(state.prompt, '');
  });
});

test('db: writeStudyState treats undefined completionCount as 0', async () => {
  await withDb((db) => {
    db.writeStudyState({ prompt: 'x', updatedAt: null, lesson: null });
    const state = db.readStudyState();
    assert.equal(state.completionCount, 0);
  });
});

test('db: multiple addLink and deleteLink calls keep state consistent', async () => {
  await withDb((db) => {
    db.addLink({ name: 'A', url: 'https://a.com' });
    db.addLink({ name: 'B', url: 'https://b.com' });
    db.addLink({ name: 'C', url: 'https://c.com' });
    db.deleteLink('https://b.com');
    db.addLink({ name: 'D', url: 'https://d.com' });
    const links = db.readLinks();
    assert.equal(links.length, 3);
    assert.deepEqual(
      links.map((l) => l.name),
      ['A', 'C', 'D']
    );
  });
});
