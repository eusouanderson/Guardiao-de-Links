const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeQuestion,
  countCorrectAnswers,
  normalizeLesson,
  normalizeStudyState,
  buildSessionPayload,
  extractJsonFromModel,
  validateGeneratedQuestions
} = require('../src/server');

// ---------------------------------------------------------------------------
// normalizeQuestion
// ---------------------------------------------------------------------------

test('normalizeQuestion: returns all fields for a valid question', () => {
  const question = {
    id: 3,
    question: 'O que é closure?',
    options: ['A', 'B', 'C', 'D'],
    correctOptionIndex: 2,
    solved: true,
    selectedOptionIndex: 2
  };
  const result = normalizeQuestion(question, 0);
  assert.equal(result.id, 3);
  assert.equal(result.question, 'O que é closure?');
  assert.deepEqual(result.options, ['A', 'B', 'C', 'D']);
  assert.equal(result.correctOptionIndex, 2);
  assert.equal(result.solved, true);
  assert.equal(result.selectedOptionIndex, 2);
});

test('normalizeQuestion: uses index+1 when id is not a number', () => {
  const result = normalizeQuestion({ question: 'Q?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }, 4);
  assert.equal(result.id, 5);
});

test('normalizeQuestion: defaults question to empty string when missing', () => {
  const result = normalizeQuestion({ options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }, 0);
  assert.equal(result.question, '');
});

test('normalizeQuestion: defaults options to empty array when missing', () => {
  const result = normalizeQuestion({ question: 'Q?' }, 0);
  assert.deepEqual(result.options, []);
});

test('normalizeQuestion: filters out non-string options', () => {
  const result = normalizeQuestion({ question: 'Q?', options: ['A', 42, null, 'D', 'E'] }, 0);
  assert.deepEqual(result.options, ['A', 'D', 'E'].slice(0, 4));
});

test('normalizeQuestion: limits options to 4', () => {
  const result = normalizeQuestion({ question: 'Q?', options: ['A', 'B', 'C', 'D', 'E', 'F'] }, 0);
  assert.equal(result.options.length, 4);
});

test('normalizeQuestion: defaults correctOptionIndex to -1 when not an integer', () => {
  const result = normalizeQuestion({ question: 'Q?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 'x' }, 0);
  assert.equal(result.correctOptionIndex, -1);
});

test('normalizeQuestion: defaults solved to false when missing', () => {
  const result = normalizeQuestion({ id: 1, question: 'Q?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }, 0);
  assert.equal(result.solved, false);
});

test('normalizeQuestion: defaults selectedOptionIndex to null when not an integer', () => {
  const result = normalizeQuestion({ id: 1, question: 'Q?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0, selectedOptionIndex: 'bad' }, 0);
  assert.equal(result.selectedOptionIndex, null);
});

test('normalizeQuestion: handles null/undefined input without throwing', () => {
  const result = normalizeQuestion(null, 2);
  assert.equal(result.id, 3);
  assert.equal(result.question, '');
  assert.deepEqual(result.options, []);
});

// ---------------------------------------------------------------------------
// countCorrectAnswers
// ---------------------------------------------------------------------------

test('countCorrectAnswers: returns 0 when no questions are solved', () => {
  const questions = [
    { solved: false },
    { solved: false }
  ];
  assert.equal(countCorrectAnswers(questions), 0);
});

test('countCorrectAnswers: counts only solved === true', () => {
  const questions = [
    { solved: true },
    { solved: false },
    { solved: true },
    { solved: true }
  ];
  assert.equal(countCorrectAnswers(questions), 3);
});

test('countCorrectAnswers: returns 0 for empty array', () => {
  assert.equal(countCorrectAnswers([]), 0);
});

test('countCorrectAnswers: ignores truthy non-boolean values', () => {
  const questions = [{ solved: 1 }, { solved: 'yes' }, { solved: true }];
  assert.equal(countCorrectAnswers(questions), 3);
});

// ---------------------------------------------------------------------------
// normalizeLesson
// ---------------------------------------------------------------------------

test('normalizeLesson: returns null for null input', () => {
  assert.equal(normalizeLesson(null), null);
});

test('normalizeLesson: returns null for non-object input', () => {
  assert.equal(normalizeLesson('string'), null);
  assert.equal(normalizeLesson(42), null);
});

test('normalizeLesson: returns null when questions array is empty', () => {
  assert.equal(normalizeLesson({ questions: [] }), null);
});

test('normalizeLesson: returns null when questions is not an array', () => {
  assert.equal(normalizeLesson({ questions: 'not an array' }), null);
});

test('normalizeLesson: normalizes a valid lesson', () => {
  const lesson = {
    promptSnapshot: 'closures',
    explanation: 'Closures capturam escopo.',
    questions: [
      { id: 1, question: 'Q1?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0, solved: true, selectedOptionIndex: 0 },
      { id: 2, question: 'Q2?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 1, solved: false, selectedOptionIndex: null }
    ],
    correctCount: 0,
    completed: false,
    generatedAt: '2026-01-01T00:00:00.000Z'
  };
  const result = normalizeLesson(lesson);
  assert.ok(result);
  assert.equal(result.promptSnapshot, 'closures');
  assert.equal(result.explanation, 'Closures capturam escopo.');
  assert.equal(result.questions.length, 2);
  assert.equal(result.correctCount, 1);
  assert.equal(result.completed, false);
  assert.equal(result.generatedAt, '2026-01-01T00:00:00.000Z');
});

test('normalizeLesson: sets completed=true when all questions are solved', () => {
  const lesson = {
    questions: [
      { id: 1, question: 'Q?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0, solved: true }
    ],
    completed: false
  };
  const result = normalizeLesson(lesson);
  assert.equal(result.completed, true);
});

test('normalizeLesson: defaults explanation to empty string when missing', () => {
  const lesson = {
    questions: [{ id: 1, question: 'Q?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0, solved: false }]
  };
  const result = normalizeLesson(lesson);
  assert.equal(result.explanation, '');
});

test('normalizeLesson: defaults promptSnapshot to empty string when missing', () => {
  const lesson = {
    questions: [{ id: 1, question: 'Q?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0, solved: false }]
  };
  const result = normalizeLesson(lesson);
  assert.equal(result.promptSnapshot, '');
});

// ---------------------------------------------------------------------------
// normalizeStudyState
// ---------------------------------------------------------------------------

test('normalizeStudyState: returns base state for null input', () => {
  const state = normalizeStudyState(null);
  assert.equal(state.prompt, '');
  assert.equal(state.updatedAt, null);
  assert.equal(state.lesson, null);
  assert.equal(state.completionCount, 0);
});

test('normalizeStudyState: returns base state for non-object input', () => {
  const state = normalizeStudyState('invalid');
  assert.equal(state.prompt, '');
});

test('normalizeStudyState: normalizes a valid state', () => {
  const state = normalizeStudyState({
    prompt: 'event loop',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lesson: null,
    completionCount: 4
  });
  assert.equal(state.prompt, 'event loop');
  assert.equal(state.updatedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(state.lesson, null);
  assert.equal(state.completionCount, 4);
});

test('normalizeStudyState: defaults prompt to empty string when not a string', () => {
  const state = normalizeStudyState({ prompt: 42, updatedAt: null, lesson: null, completionCount: 0 });
  assert.equal(state.prompt, '');
});

test('normalizeStudyState: defaults completionCount to 0 when not an integer', () => {
  const state = normalizeStudyState({ prompt: '', updatedAt: null, lesson: null, completionCount: 'x' });
  assert.equal(state.completionCount, 0);
});

test('normalizeStudyState: normalizes lesson when present', () => {
  const state = normalizeStudyState({
    prompt: 'x',
    updatedAt: null,
    completionCount: 0,
    lesson: {
      promptSnapshot: 'x',
      explanation: 'Exp.',
      questions: [
        { id: 1, question: 'Q?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0, solved: false }
      ],
      completed: false,
      generatedAt: null
    }
  });
  assert.ok(state.lesson);
  assert.equal(state.lesson.promptSnapshot, 'x');
  assert.equal(state.lesson.questions.length, 1);
});

// ---------------------------------------------------------------------------
// buildSessionPayload
// ---------------------------------------------------------------------------

test('buildSessionPayload: returns all expected fields', () => {
  const studyState = {
    prompt: 'closures',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completionCount: 2,
    lesson: {
      explanation: 'Closures capturam escopo.',
      generatedAt: '2026-01-01T00:00:00.000Z',
      correctCount: 1,
      completed: false,
      questions: [
        { id: 1, question: 'Q1?', options: ['A', 'B', 'C', 'D'], solved: true, selectedOptionIndex: 0, correctOptionIndex: 0 },
        { id: 2, question: 'Q2?', options: ['A', 'B', 'C', 'D'], solved: false, selectedOptionIndex: null, correctOptionIndex: 1 }
      ]
    }
  };
  const payload = buildSessionPayload(studyState);
  assert.equal(payload.prompt, 'closures');
  assert.equal(payload.updatedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(payload.explanation, 'Closures capturam escopo.');
  assert.equal(payload.completionCount, 2);
  assert.equal(payload.questions.length, 2);
  assert.equal(payload.progress.correctCount, 1);
  assert.equal(payload.progress.totalQuestions, 2);
  assert.equal(payload.progress.completed, false);
});

test('buildSessionPayload: questions omit correctOptionIndex', () => {
  const studyState = {
    prompt: 'x',
    updatedAt: null,
    completionCount: 0,
    lesson: {
      explanation: '',
      generatedAt: null,
      correctCount: 0,
      completed: false,
      questions: [
        { id: 1, question: 'Q?', options: ['A', 'B', 'C', 'D'], solved: false, selectedOptionIndex: null, correctOptionIndex: 2 }
      ]
    }
  };
  const payload = buildSessionPayload(studyState);
  assert.equal('correctOptionIndex' in payload.questions[0], false);
});

test('buildSessionPayload: returns empty questions and zero totals when no lesson', () => {
  const studyState = {
    prompt: 'x',
    updatedAt: null,
    completionCount: 0,
    lesson: null
  };
  const payload = buildSessionPayload(studyState);
  assert.deepEqual(payload.questions, []);
  assert.equal(payload.progress.correctCount, 0);
  assert.equal(payload.progress.totalQuestions, 0);
  assert.equal(payload.progress.completed, false);
});

// ---------------------------------------------------------------------------
// extractJsonFromModel
// ---------------------------------------------------------------------------

test('extractJsonFromModel: returns plain JSON string unchanged (trimmed)', () => {
  const json = '{"key":"value"}';
  assert.equal(extractJsonFromModel(`  ${json}  `), json);
});

test('extractJsonFromModel: strips ```json fenced block', () => {
  const input = '```json\n{"key":"value"}\n```';
  assert.equal(extractJsonFromModel(input), '{"key":"value"}');
});

test('extractJsonFromModel: strips ``` fenced block without language tag', () => {
  const input = '```\n{"key":"value"}\n```';
  assert.equal(extractJsonFromModel(input), '{"key":"value"}');
});

test('extractJsonFromModel: handles multi-line JSON inside fence', () => {
  const inner = '{\n  "a": 1,\n  "b": 2\n}';
  const input = `\`\`\`json\n${inner}\n\`\`\``;
  assert.equal(extractJsonFromModel(input), inner);
});

// ---------------------------------------------------------------------------
// validateGeneratedQuestions
// ---------------------------------------------------------------------------

function makeQuestions(count = 10, overrides = {}) {
  return Array.from({ length: count }, (_, i) => ({
    question: `Pergunta ${i + 1}?`,
    options: ['A', 'B', 'C', 'D'],
    correctOptionIndex: 0,
    ...overrides
  }));
}

test('validateGeneratedQuestions: returns 10 normalized questions for valid input', () => {
  const result = validateGeneratedQuestions(makeQuestions());
  assert.equal(result.length, 10);
  result.forEach((q) => {
    assert.equal(q.solved, false);
    assert.equal(q.selectedOptionIndex, null);
  });
});

test('validateGeneratedQuestions: throws when fewer than 10 questions', () => {
  assert.throws(
    () => validateGeneratedQuestions(makeQuestions(9)),
    /10 perguntas/
  );
});

test('validateGeneratedQuestions: throws when more than 10 questions', () => {
  assert.throws(
    () => validateGeneratedQuestions(makeQuestions(11)),
    /10 perguntas/
  );
});

test('validateGeneratedQuestions: throws when input is not an array', () => {
  assert.throws(() => validateGeneratedQuestions(null), /10 perguntas/);
  assert.throws(() => validateGeneratedQuestions('string'), /10 perguntas/);
});

test('validateGeneratedQuestions: throws when question text is empty', () => {
  const questions = makeQuestions(10, { question: '' });
  assert.throws(() => validateGeneratedQuestions(questions), /inválida/);
});

test('validateGeneratedQuestions: throws when options count is not 4', () => {
  const questions = makeQuestions(10, { options: ['A', 'B', 'C'] });
  assert.throws(() => validateGeneratedQuestions(questions), /inválida/);
});

test('validateGeneratedQuestions: throws when correctOptionIndex is out of range', () => {
  const questions = makeQuestions(10, { correctOptionIndex: 5 });
  assert.throws(() => validateGeneratedQuestions(questions), /inválida/);
});

test('validateGeneratedQuestions: throws when correctOptionIndex is negative', () => {
  const questions = makeQuestions(10, { correctOptionIndex: -1 });
  assert.throws(() => validateGeneratedQuestions(questions), /inválida/);
});

test('validateGeneratedQuestions: forces solved=false and selectedOptionIndex=null', () => {
  const questions = makeQuestions(10, { solved: true, selectedOptionIndex: 2 });
  const result = validateGeneratedQuestions(questions);
  result.forEach((q) => {
    assert.equal(q.solved, false);
    assert.equal(q.selectedOptionIndex, null);
  });
});
