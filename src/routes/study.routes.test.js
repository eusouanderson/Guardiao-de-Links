const assert = require('node:assert/strict');
const test = require('node:test');

const { createStudyRoutes } = require('./study.routes');

test('study routes dispatch GET /study-status to controller', async () => {
  let called = false;
  const studyRoutes = createStudyRoutes({
    studyController: {
      getTheme: async () => {},
      saveTheme: async () => {},
      getStatus: async () => {
        called = true;
      },
      getHistory: async () => {},
      getSession: async () => {},
      getExplanation: async () => {},
      submitAnswer: async () => {},
      getQueue: async () => {},
      moveQueueItem: async () => {},
      organizeQueue: async () => {},
      deleteQueueItem: async () => {},
    },
  });

  const handled = await studyRoutes.handle({
    route: '/study-status',
    method: 'GET',
    req: {},
    res: {},
  });

  assert.equal(handled, true);
  assert.equal(called, true);
});
