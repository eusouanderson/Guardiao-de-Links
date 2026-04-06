const assert = require('node:assert/strict');
const test = require('node:test');

const { createStudyService } = require('./study.service');

const createBaseService = () => {
  const state = {
    prompt: 'event loop',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lesson: {
      promptSnapshot: 'event loop',
      explanation: 'Resumo',
      questions: [
        {
          id: 1,
          question: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          correctOptionIndex: 1,
          solved: false,
          selectedOptionIndex: null,
        },
      ],
      correctCount: 0,
      completed: false,
      generatedAt: '2026-01-01T00:00:00.000Z',
    },
    completionCount: 0,
  };

  const studyRepository = {
    readStudyState: () => state,
    writeStudyState: (nextState) => Object.assign(state, nextState),
    enqueueStudy: () => {},
    dequeueNextStudy: () => null,
    listQueue: () => [],
    deleteFromQueue: () => {},
    moveQueueItem: () => false,
    reorderQueue: () => false,
    addStudyHistory: () => {},
    listStudyHistory: () => [],
  };

  const aiService = {
    generateStudyLesson: async () => null,
    organizeQueueWithAi: async () => ({ orderedIds: [], rationale: '' }),
  };

  return createStudyService({ studyRepository, aiService });
};

test('study service: submitAnswer marks correct answer and returns session payload', () => {
  const service = createBaseService();
  const result = service.submitAnswer({ questionId: 1, optionIndex: 1 });

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.correct, true);
  assert.equal(result.payload.session.progress.correctCount, 1);
});
