const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeQuestion, validateQueueOrder } = require('./study.utils');

test('study utils: normalizeQuestion applies defaults', () => {
  const question = normalizeQuestion(null, 2);
  assert.equal(question.id, 3);
  assert.equal(question.question, '');
  assert.deepEqual(question.options, []);
});

test('study utils: validateQueueOrder validates id set', () => {
  const queue = [{ id: 1 }, { id: 2 }];
  assert.equal(validateQueueOrder([2, 1], queue), true);
  assert.equal(validateQueueOrder([2, 3], queue), false);
});
