const assert = require('node:assert/strict');
const test = require('node:test');

const { createStudyRepository } = require('./study.repository');

test('study repository delegates queue calls to db adapter', () => {
  const calls = [];
  const db = {
    readStudyState: () => ({ prompt: '', updatedAt: null, lesson: null, completionCount: 0 }),
    writeStudyState: (state) => calls.push(['writeStudyState', state]),
    enqueueStudy: (prompt) => calls.push(['enqueueStudy', prompt]),
    dequeueNextStudy: () => null,
    listQueue: () => [{ id: 1, prompt: 'topic', createdAt: '2026-01-01' }],
    deleteFromQueue: (id) => calls.push(['deleteFromQueue', id]),
    moveQueueItem: (id, direction) => calls.push(['moveQueueItem', id, direction]),
    reorderQueue: (orderedIds) => calls.push(['reorderQueue', orderedIds]),
    addStudyHistory: (entry) => calls.push(['addStudyHistory', entry]),
    listStudyHistory: () => [],
  };

  const repository = createStudyRepository({ db });
  repository.enqueueStudy('javascript');
  const queue = repository.listQueue();

  assert.equal(queue.length, 1);
  assert.deepEqual(calls[0], ['enqueueStudy', 'javascript']);
});
