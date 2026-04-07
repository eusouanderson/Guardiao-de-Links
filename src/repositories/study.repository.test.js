const assert = require('node:assert/strict');
const test = require('node:test');

const { createStudyRepository } = require('./study.repository');

test('study repository delegates queue calls to db adapter', () => {
  const calls = [];
  const db = {
    readStudyState: () => ({
      prompt: '',
      difficulty: 'medium',
      updatedAt: null,
      lesson: null,
      completionCount: 0,
    }),
    writeStudyState: (state) => calls.push(['writeStudyState', state]),
    enqueueStudy: (item) => calls.push(['enqueueStudy', item]),
    dequeueNextStudy: () => null,
    listQueue: () => [{ id: 1, prompt: 'topic', difficulty: 'easy', createdAt: '2026-01-01' }],
    deleteFromQueue: (id) => calls.push(['deleteFromQueue', id]),
    moveQueueItem: (id, direction) => calls.push(['moveQueueItem', id, direction]),
    reorderQueue: (orderedIds) => calls.push(['reorderQueue', orderedIds]),
    addStudyHistory: (entry) => calls.push(['addStudyHistory', entry]),
    listStudyHistory: () => [],
  };

  const repository = createStudyRepository({ db });
  repository.enqueueStudy({ prompt: 'javascript', difficulty: 'hard' });
  const queue = repository.listQueue();

  assert.equal(queue.length, 1);
  assert.deepEqual(calls[0], ['enqueueStudy', { prompt: 'javascript', difficulty: 'hard' }]);
});
