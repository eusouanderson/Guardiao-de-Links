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

// ---------------------------------------------------------------------------
// Study queue
// ---------------------------------------------------------------------------

test('db: listQueue returns empty array when queue is empty', async () => {
  await withDb((db) => {
    assert.deepEqual(db.listQueue(), []);
  });
});

test('db: enqueueStudy adds a prompt and listQueue returns it', async () => {
  await withDb((db) => {
    db.enqueueStudy('closures');
    const queue = db.listQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].prompt, 'closures');
    assert.ok(queue[0].id);
    assert.ok(queue[0].createdAt);
  });
});

test('db: listQueue returns items in FIFO insertion order', async () => {
  await withDb((db) => {
    db.enqueueStudy('closures');
    db.enqueueStudy('promises');
    db.enqueueStudy('event loop');
    const prompts = db.listQueue().map((r) => r.prompt);
    assert.deepEqual(prompts, ['closures', 'promises', 'event loop']);
  });
});

test('db: dequeueNextStudy returns the first prompt and removes it', async () => {
  await withDb((db) => {
    db.enqueueStudy('closures');
    db.enqueueStudy('promises');
    const next = db.dequeueNextStudy();
    assert.equal(next, 'closures');
    const queue = db.listQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].prompt, 'promises');
  });
});

test('db: dequeueNextStudy returns null when queue is empty', async () => {
  await withDb((db) => {
    assert.equal(db.dequeueNextStudy(), null);
  });
});

test('db: dequeueNextStudy leaves queue empty after last item is dequeued', async () => {
  await withDb((db) => {
    db.enqueueStudy('closures');
    db.dequeueNextStudy();
    assert.deepEqual(db.listQueue(), []);
  });
});

test('db: deleteFromQueue removes a specific item by id', async () => {
  await withDb((db) => {
    db.enqueueStudy('closures');
    db.enqueueStudy('promises');
    const queue = db.listQueue();
    db.deleteFromQueue(queue[0].id);
    const remaining = db.listQueue();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].prompt, 'promises');
  });
});

test('db: deleteFromQueue does nothing for non-existent id', async () => {
  await withDb((db) => {
    db.enqueueStudy('closures');
    db.deleteFromQueue(9999);
    assert.equal(db.listQueue().length, 1);
  });
});

test('db: multiple enqueue and dequeue calls keep order intact', async () => {
  await withDb((db) => {
    db.enqueueStudy('A');
    db.enqueueStudy('B');
    db.enqueueStudy('C');
    assert.equal(db.dequeueNextStudy(), 'A');
    db.enqueueStudy('D');
    assert.equal(db.dequeueNextStudy(), 'B');
    const prompts = db.listQueue().map((r) => r.prompt);
    assert.deepEqual(prompts, ['C', 'D']);
  });
});

test('db: moveQueueItem moves an item up', async () => {
  await withDb((db) => {
    db.enqueueStudy('A');
    db.enqueueStudy('B');
    db.enqueueStudy('C');
    const queue = db.listQueue();

    const moved = db.moveQueueItem(queue[2].id, 'up');
    const prompts = db.listQueue().map((item) => item.prompt);

    assert.equal(moved, true);
    assert.deepEqual(prompts, ['A', 'C', 'B']);
  });
});

test('db: moveQueueItem moves an item down', async () => {
  await withDb((db) => {
    db.enqueueStudy('A');
    db.enqueueStudy('B');
    db.enqueueStudy('C');
    const queue = db.listQueue();

    const moved = db.moveQueueItem(queue[0].id, 'down');
    const prompts = db.listQueue().map((item) => item.prompt);

    assert.equal(moved, true);
    assert.deepEqual(prompts, ['B', 'A', 'C']);
  });
});

test('db: moveQueueItem returns false when item is already first', async () => {
  await withDb((db) => {
    db.enqueueStudy('A');
    db.enqueueStudy('B');
    const queue = db.listQueue();

    const moved = db.moveQueueItem(queue[0].id, 'up');

    assert.equal(moved, false);
    assert.deepEqual(
      db.listQueue().map((item) => item.prompt),
      ['A', 'B']
    );
  });
});

// ---------------------------------------------------------------------------
// Study history
// ---------------------------------------------------------------------------

test('db: listStudyHistory returns empty array when there is no history', async () => {
  await withDb((db) => {
    assert.deepEqual(db.listStudyHistory(), []);
  });
});

test('db: addStudyHistory persists entries and listStudyHistory returns newest first', async () => {
  await withDb((db) => {
    db.addStudyHistory({
      promptSnapshot: 'closures',
      explanation: 'Resumo 1',
      cycleNumber: 1,
      totalQuestions: 10,
      correctCount: 10,
      completedAt: '2026-03-01T10:00:00.000Z'
    });

    db.addStudyHistory({
      promptSnapshot: 'promises',
      explanation: 'Resumo 2',
      cycleNumber: 2,
      totalQuestions: 10,
      correctCount: 10,
      completedAt: '2026-03-02T10:00:00.000Z'
    });

    const history = db.listStudyHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].promptSnapshot, 'promises');
    assert.equal(history[0].cycleNumber, 2);
    assert.equal(history[1].promptSnapshot, 'closures');
    assert.equal(history[1].cycleNumber, 1);
  });
});

test('db: reorderQueue reorders queue by provided id sequence', async () => {
  await withDb((db) => {
    db.enqueueStudy('A');
    db.enqueueStudy('B');
    db.enqueueStudy('C');
    const queue = db.listQueue();

    const reordered = db.reorderQueue([queue[2].id, queue[0].id, queue[1].id]);
    const prompts = db.listQueue().map((item) => item.prompt);

    assert.equal(reordered, true);
    assert.deepEqual(prompts, ['C', 'A', 'B']);
  });
});

test('db: reorderQueue returns false for invalid ids', async () => {
  await withDb((db) => {
    db.enqueueStudy('A');
    db.enqueueStudy('B');
    const queue = db.listQueue();

    const reordered = db.reorderQueue([queue[0].id, 9999]);
    const prompts = db.listQueue().map((item) => item.prompt);

    assert.equal(reordered, false);
    assert.deepEqual(prompts, ['A', 'B']);
  });
});

