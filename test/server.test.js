const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createApp } = require('../src/server');
const { createDatabase } = require('../src/db');

async function createFixture() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'linksaved-test-'));
  const dbPath = path.join(tempRoot, 'test.db');
  const db = createDatabase(dbPath);
  db.addLink({ name: 'Docs', url: 'https://example.com' });

  return {
    tempRoot,
    db,
    publicDir: path.join(__dirname, '..', 'src', 'public'),
  };
}

function createGroqPayload() {
  return {
    explanation: 'Explicacao simulada sobre event loop.',
    questions: Array.from({ length: 10 }, (_, index) => ({
      question: `Pergunta ${index + 1}?`,
      options: ['Opcao A', 'Opcao B', 'Opcao C', 'Opcao D'],
      correctOptionIndex: 1,
    })),
  };
}

async function startTestServer(overrides = {}) {
  const fixture = await createFixture();
  const app = createApp({
    publicDir: fixture.publicDir,
    db: fixture.db,
    ...overrides,
  });

  await new Promise((resolve) => app.listen(0, resolve));
  const address = app.address();

  return {
    app,
    fixture,
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      fixture.db.close();
      await new Promise((resolve, reject) =>
        app.close((error) => (error ? reject(error) : resolve()))
      );
      await fs.rm(fixture.tempRoot, { recursive: true, force: true });
    },
  };
}

test('GET / serves the links page', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Guardi[aã]o de Links/);
  } finally {
    await server.close();
  }
});

test('GET /links returns persisted links', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/links`);
    const links = await response.json();

    assert.equal(response.status, 200);
    assert.equal(links.length, 1);
    assert.equal(links[0].name, 'Docs');
  } finally {
    await server.close();
  }
});

test('POST /links persists a new link', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Node', url: 'https://nodejs.org' }),
    });
    const payload = await response.json();
    const savedLinks = server.fixture.db.readLinks();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { success: true });
    assert.equal(savedLinks.length, 2);
    assert.equal(savedLinks[1].url, 'https://nodejs.org');
  } finally {
    await server.close();
  }
});

test('DELETE /links removes a persisted link', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/links`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const payload = await response.json();
    const savedLinks = server.fixture.db.readLinks();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { success: true });
    assert.equal(savedLinks.length, 0);
  } finally {
    await server.close();
  }
});

test('POST /study-theme saves the study prompt', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'event loop e promises' }),
    });
    const payload = await response.json();
    const savedTheme = server.fixture.db.readStudyState();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.status.canSaveNewTheme, false);
    assert.equal(payload.data.status.remainingCycles, 10);
    assert.equal(savedTheme.prompt, 'event loop e promises');
    assert.ok(savedTheme.updatedAt);
    assert.equal(savedTheme.lesson, null);
    assert.equal(savedTheme.completionCount, 0);
  } finally {
    await server.close();
  }
});

test('POST /study-theme queues the prompt when cycles are not completed', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-03-17T00:00:00.000Z',
      lesson: {
        promptSnapshot: 'event loop',
        explanation: 'Resumo salvo.',
        questions: Array.from({ length: 10 }, (_, index) => ({
          id: index + 1,
          question: `Pergunta ${index + 1}?`,
          options: ['A', 'B', 'C', 'D'],
          correctOptionIndex: 1,
          solved: index < 3,
          selectedOptionIndex: index < 3 ? 1 : null,
        })),
        correctCount: 3,
        completed: false,
        generatedAt: '2026-03-17T00:00:00.000Z',
      },
      completionCount: 3,
    });

    const response = await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'novo tema' }),
    });
    const payload = await response.json();
    const savedTheme = server.fixture.db.readStudyState();
    const queue = server.fixture.db.listQueue();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.queued, true);
    assert.equal(payload.position, 1);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].prompt, 'novo tema');
    assert.equal(savedTheme.prompt, 'event loop');
  } finally {
    await server.close();
  }
});

test('GET /study-session returns 400 when no prompt is saved', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/study-session`);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /Nenhum tema salvo ainda/);
  } finally {
    await server.close();
  }
});

test('GET /study-session generates explanation and 10 questions only once while pending', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  let fetchCalls = 0;
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        fetchCalls += 1;
        return {
          choices: [{ message: { content: JSON.stringify(createGroqPayload()) } }],
        };
      },
    }),
  });

  try {
    server.fixture.db.writeStudyState({
      prompt: 'microtasks',
      updatedAt: '2026-03-17T00:00:00.000Z',
      lesson: null,
      completionCount: 0,
    });

    const firstResponse = await fetch(`${server.baseUrl}/study-session`);
    const firstPayload = await firstResponse.json();
    const secondResponse = await fetch(`${server.baseUrl}/study-session`);
    const secondPayload = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(firstPayload.prompt, 'microtasks');
    assert.equal(firstPayload.questions.length, 10);
    assert.equal(firstPayload.progress.correctCount, 0);
    assert.equal(secondResponse.status, 200);
    assert.equal(secondPayload.explanation, 'Explicacao simulada sobre event loop.');
    assert.equal(fetchCalls, 1);
  } finally {
    delete process.env.GROQ_API_KEY;
    await server.close();
  }
});

test('POST /study-answer marks progress and GET /study-status exposes pending study', async () => {
  const lesson = {
    promptSnapshot: 'event loop',
    explanation: 'Resumo salvo.',
    questions: [
      {
        id: 1,
        question: 'Pergunta 1?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 2,
        solved: false,
        selectedOptionIndex: null,
      },
      {
        id: 2,
        question: 'Pergunta 2?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        solved: false,
        selectedOptionIndex: null,
      },
    ],
    correctCount: 0,
    completed: false,
    generatedAt: '2026-03-17T00:00:00.000Z',
  };
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-03-17T00:00:00.000Z',
      lesson,
      completionCount: 0,
    });

    const wrongResponse = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 1, optionIndex: 1 }),
    });
    const wrongPayload = await wrongResponse.json();
    const correctResponse = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 1, optionIndex: 2 }),
    });
    const correctPayload = await correctResponse.json();
    const statusResponse = await fetch(`${server.baseUrl}/study-status`);
    const statusPayload = await statusResponse.json();

    assert.equal(wrongResponse.status, 200);
    assert.equal(wrongPayload.correct, false);
    assert.equal(correctResponse.status, 200);
    assert.equal(correctPayload.correct, true);
    assert.equal(correctPayload.session.progress.correctCount, 1);
    assert.equal(statusResponse.status, 200);
    assert.equal(statusPayload.pendingStudy, true);
    assert.equal(statusPayload.progress.correctCount, 1);
    assert.equal(statusPayload.canSaveNewTheme, false);
  } finally {
    await server.close();
  }
});

test('POST /study-answer unlocks a new prompt after the 10th completed cycle', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-03-17T00:00:00.000Z',
      completionCount: 9,
      lesson: {
        promptSnapshot: 'event loop',
        explanation: 'Resumo salvo.',
        questions: Array.from({ length: 10 }, (_, index) => ({
          id: index + 1,
          question: `Pergunta ${index + 1}?`,
          options: ['A', 'B', 'C', 'D'],
          correctOptionIndex: 1,
          solved: index < 9,
          selectedOptionIndex: index < 9 ? 1 : null,
        })),
        correctCount: 9,
        completed: false,
        generatedAt: '2026-03-17T00:00:00.000Z',
      },
    });

    const answerResponse = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 10, optionIndex: 1 }),
    });
    const answerPayload = await answerResponse.json();
    const saveResponse = await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'novo tema liberado' }),
    });
    const savePayload = await saveResponse.json();
    const savedTheme = server.fixture.db.readStudyState();

    assert.equal(answerResponse.status, 200);
    assert.equal(answerPayload.session.completionCount, 10);
    assert.equal(answerPayload.session.progress.completed, true);
    assert.equal(saveResponse.status, 200);
    assert.equal(savePayload.data.status.canSaveNewTheme, false);
    assert.equal(savedTheme.prompt, 'novo tema liberado');
    assert.equal(savedTheme.completionCount, 0);
  } finally {
    await server.close();
  }
});

test('POST /study-answer saves a history item when a cycle is completed', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-03-17T00:00:00.000Z',
      completionCount: 2,
      lesson: {
        promptSnapshot: 'event loop',
        explanation: 'Resumo salvo.',
        questions: [
          {
            id: 1,
            question: 'Pergunta 1?',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 1,
            solved: false,
            selectedOptionIndex: null,
          },
        ],
        correctCount: 0,
        completed: false,
        generatedAt: '2026-03-17T00:00:00.000Z',
      },
    });

    const answerResponse = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 1, optionIndex: 1 }),
    });
    const answerPayload = await answerResponse.json();
    const history = server.fixture.db.listStudyHistory();

    assert.equal(answerResponse.status, 200);
    assert.equal(answerPayload.session.progress.completed, true);
    assert.equal(answerPayload.session.completionCount, 3);
    assert.equal(history.length, 1);
    assert.equal(history[0].promptSnapshot, 'event loop');
    assert.equal(history[0].cycleNumber, 3);
    assert.equal(history[0].correctCount, 1);
    assert.equal(history[0].totalQuestions, 1);
    assert.ok(history[0].completedAt);
  } finally {
    await server.close();
  }
});

test('GET /study-session regenerates only after all questions are solved', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  let fetchCalls = 0;
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        fetchCalls += 1;
        return {
          choices: [{ message: { content: JSON.stringify(createGroqPayload()) } }],
        };
      },
    }),
  });

  try {
    server.fixture.db.writeStudyState({
      prompt: 'microtasks',
      updatedAt: '2026-03-17T00:00:00.000Z',
      lesson: {
        promptSnapshot: 'microtasks',
        explanation: 'Resumo antigo.',
        questions: Array.from({ length: 10 }, (_, index) => ({
          id: index + 1,
          question: `Pergunta ${index + 1}?`,
          options: ['A', 'B', 'C', 'D'],
          correctOptionIndex: 1,
          solved: true,
          selectedOptionIndex: 1,
        })),
        correctCount: 10,
        completed: true,
        generatedAt: '2026-03-17T00:00:00.000Z',
      },
      completionCount: 4,
    });

    const response = await fetch(`${server.baseUrl}/study-session`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.prompt, 'microtasks');
    assert.equal(payload.questions.length, 10);
    assert.equal(fetchCalls, 1);
    assert.equal(payload.completionCount, 4);
  } finally {
    delete process.env.GROQ_API_KEY;
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// Routes – edge cases not covered above
// ---------------------------------------------------------------------------

test('GET /estudos serves the estudos page', async () => {
  const server = await startTestServer();

  try {
    for (const p of ['/estudos', '/estudos.html', '/nova-pagina', '/nova-pagina.html']) {
      const response = await fetch(`${server.baseUrl}${p}`);
      const html = await response.text();
      assert.equal(response.status, 200, `expected 200 for ${p}`);
      assert.match(html, /Estudos|study|tema/i);
    }
  } finally {
    await server.close();
  }
});

test('GET /historico-estudos serves the history page', async () => {
  const server = await startTestServer();

  try {
    for (const p of ['/historico-estudos', '/historico-estudos.html']) {
      const response = await fetch(`${server.baseUrl}${p}`);
      const html = await response.text();
      assert.equal(response.status, 200, `expected 200 for ${p}`);
      assert.match(html, /Historico de Estudos/i);
    }
  } finally {
    await server.close();
  }
});

test('GET /links.html serves the links page', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/links.html`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Guardi[aã]o de Links/);
  } finally {
    await server.close();
  }
});

test('GET /unknown-route returns 404', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/nao-existe`);
    assert.equal(response.status, 404);
  } finally {
    await server.close();
  }
});

test('GET /study-theme returns current prompt and status', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'closures',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: null,
      completionCount: 2,
    });

    const response = await fetch(`${server.baseUrl}/study-theme`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.prompt, 'closures');
    assert.equal(payload.updatedAt, '2026-01-01T00:00:00.000Z');
    assert.ok(payload.status);
    assert.equal(payload.status.completionCount, 2);
    assert.equal(payload.status.hasPrompt, true);
  } finally {
    await server.close();
  }
});

test('GET /study-status returns status without prompt', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/study-status`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.hasPrompt, false);
    assert.equal(payload.canSaveNewTheme, true);
    assert.equal(payload.completionCount, 0);
  } finally {
    await server.close();
  }
});

test('GET /study-history returns recorded history rows', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.addStudyHistory({
      promptSnapshot: 'promises',
      explanation: 'Resumo',
      cycleNumber: 1,
      totalQuestions: 10,
      correctCount: 10,
      completedAt: '2026-03-17T00:00:00.000Z',
    });

    const response = await fetch(`${server.baseUrl}/study-history`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.length, 1);
    assert.equal(payload[0].promptSnapshot, 'promises');
    assert.equal(payload[0].cycleNumber, 1);
  } finally {
    await server.close();
  }
});

test('POST /study-theme returns 400 when prompt is empty', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /tema para estudo/);
  } finally {
    await server.close();
  }
});

test('POST /study-theme returns 400 when body is invalid JSON', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.ok(payload.error);
  } finally {
    await server.close();
  }
});

test('GET /study-explain returns 400 when no prompt is saved', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/study-explain`);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /Nenhum tema salvo ainda/);
  } finally {
    await server.close();
  }
});

test('GET /study-explain returns explanation when session is active', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { choices: [{ message: { content: JSON.stringify(createGroqPayload()) } }] };
      },
    }),
  });

  try {
    server.fixture.db.writeStudyState({
      prompt: 'closures',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: null,
      completionCount: 0,
    });

    const response = await fetch(`${server.baseUrl}/study-explain`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.prompt, 'closures');
    assert.equal(payload.explanation, 'Explicacao simulada sobre event loop.');
    assert.ok(payload.progress);
  } finally {
    delete process.env.GROQ_API_KEY;
    await server.close();
  }
});

test('POST /study-answer returns 400 when no active session exists', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 1, optionIndex: 0 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /sessão de estudo ativa/);
  } finally {
    await server.close();
  }
});

test('POST /study-answer returns 404 when question is not found', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: {
        promptSnapshot: 'event loop',
        explanation: 'Exp.',
        questions: [
          {
            id: 1,
            question: 'Q?',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 0,
            solved: false,
            selectedOptionIndex: null,
          },
        ],
        correctCount: 0,
        completed: false,
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      completionCount: 0,
    });

    const response = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 999, optionIndex: 0 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.match(payload.error, /Pergunta não encontrada/);
  } finally {
    await server.close();
  }
});

test('POST /study-answer returns 400 for invalid optionIndex', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: {
        promptSnapshot: 'event loop',
        explanation: 'Exp.',
        questions: [
          {
            id: 1,
            question: 'Q?',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 0,
            solved: false,
            selectedOptionIndex: null,
          },
        ],
        correctCount: 0,
        completed: false,
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      completionCount: 0,
    });

    for (const bad of [4, -1]) {
      const response = await fetch(`${server.baseUrl}/study-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 1, optionIndex: bad }),
      });
      const payload = await response.json();
      assert.equal(response.status, 400, `expected 400 for optionIndex=${bad}`);
      assert.match(payload.error, /inválida/i);
    }
  } finally {
    await server.close();
  }
});

test('POST /study-answer returns alreadySolved=true when question was already correct', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: {
        promptSnapshot: 'event loop',
        explanation: 'Exp.',
        questions: [
          {
            id: 1,
            question: 'Q?',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 0,
            solved: true,
            selectedOptionIndex: 0,
          },
        ],
        correctCount: 1,
        completed: true,
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      completionCount: 1,
    });

    const response = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 1, optionIndex: 0 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.correct, true);
    assert.equal(payload.alreadySolved, true);
  } finally {
    await server.close();
  }
});

test('GET /study-session returns 500 when Groq API returns a non-ok response', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: false,
      async json() {
        return { error: { message: 'Rate limit exceeded' } };
      },
    }),
  });

  try {
    server.fixture.db.writeStudyState({
      prompt: 'closures',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: null,
      completionCount: 0,
    });

    const response = await fetch(`${server.baseUrl}/study-session`);
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.match(payload.details, /Rate limit exceeded/);
  } finally {
    delete process.env.GROQ_API_KEY;
    await server.close();
  }
});

test('GET /study-session returns 500 when Groq API returns invalid JSON structure', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { choices: [{ message: { content: 'isso nao e json valido { ' } }] };
      },
    }),
  });

  try {
    server.fixture.db.writeStudyState({
      prompt: 'closures',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: null,
      completionCount: 0,
    });

    const response = await fetch(`${server.baseUrl}/study-session`);
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.ok(payload.error);
  } finally {
    delete process.env.GROQ_API_KEY;
    await server.close();
  }
});

test('GET /study-session returns 500 when GROQ_API_KEY is not set', async () => {
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_KEY;
  delete process.env.API_KEY;
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'closures',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lesson: null,
      completionCount: 0,
    });

    const response = await fetch(`${server.baseUrl}/study-session`);
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.match(payload.details, /GROQ_API_KEY/);
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// Queue feature
// ---------------------------------------------------------------------------

test('GET /study-queue returns empty array initially', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/study-queue`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, []);
  } finally {
    await server.close();
  }
});

test('GET /study-queue returns queued studies', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.enqueueStudy('closures');
    server.fixture.db.enqueueStudy('promises');

    const response = await fetch(`${server.baseUrl}/study-queue`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.length, 2);
    assert.equal(payload[0].prompt, 'closures');
    assert.equal(payload[1].prompt, 'promises');
  } finally {
    await server.close();
  }
});

test('DELETE /study-queue removes a study by id', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.enqueueStudy('closures');
    server.fixture.db.enqueueStudy('promises');
    const queue = server.fixture.db.listQueue();

    const response = await fetch(`${server.baseUrl}/study-queue`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: queue[0].id }),
    });
    const payload = await response.json();
    const remaining = server.fixture.db.listQueue();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { success: true });
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].prompt, 'promises');
  } finally {
    await server.close();
  }
});

test('DELETE /study-queue returns 400 for invalid id', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/study-queue`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'abc' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /ID inválido/);
  } finally {
    await server.close();
  }
});

test('POST /study-queue/move reorders queue items', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.enqueueStudy('closures');
    server.fixture.db.enqueueStudy('promises');
    server.fixture.db.enqueueStudy('event loop');
    const queue = server.fixture.db.listQueue();

    const response = await fetch(`${server.baseUrl}/study-queue/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: queue[2].id, direction: 'up' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.moved, true);
    assert.deepEqual(
      payload.queue.map((item) => item.prompt),
      ['closures', 'event loop', 'promises']
    );
  } finally {
    await server.close();
  }
});

test('POST /study-queue/move returns 400 for invalid direction', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.enqueueStudy('closures');
    const queue = server.fixture.db.listQueue();

    const response = await fetch(`${server.baseUrl}/study-queue/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: queue[0].id, direction: 'left' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /Direção inválida/);
  } finally {
    await server.close();
  }
});

test('POST /study-theme with force=true activates immediately ignoring cycle count', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-03-17T00:00:00.000Z',
      lesson: null,
      completionCount: 3,
    });

    const response = await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'tema urgente', force: true }),
    });
    const payload = await response.json();
    const savedTheme = server.fixture.db.readStudyState();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.activated, true);
    assert.equal(savedTheme.prompt, 'tema urgente');
    assert.equal(savedTheme.completionCount, 0);
  } finally {
    await server.close();
  }
});

test('POST /study-theme queues multiple prompts in order', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-03-17T00:00:00.000Z',
      lesson: null,
      completionCount: 1,
    });

    await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'closures' }),
    });
    await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'promises' }),
    });
    const lastResponse = await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'async/await' }),
    });
    const lastPayload = await lastResponse.json();
    const queue = server.fixture.db.listQueue();

    assert.equal(lastPayload.position, 3);
    assert.equal(queue.length, 3);
    assert.deepEqual(
      queue.map((r) => r.prompt),
      ['closures', 'promises', 'async/await']
    );
  } finally {
    await server.close();
  }
});

test('POST /study-answer auto-advances to next queued study after completing cycles', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.enqueueStudy('promises');
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-03-17T00:00:00.000Z',
      completionCount: 9,
      lesson: {
        promptSnapshot: 'event loop',
        explanation: 'Resumo salvo.',
        questions: Array.from({ length: 10 }, (_, index) => ({
          id: index + 1,
          question: `Pergunta ${index + 1}?`,
          options: ['A', 'B', 'C', 'D'],
          correctOptionIndex: 1,
          solved: index < 9,
          selectedOptionIndex: index < 9 ? 1 : null,
        })),
        correctCount: 9,
        completed: false,
        generatedAt: '2026-03-17T00:00:00.000Z',
      },
    });

    const response = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 10, optionIndex: 1 }),
    });
    const payload = await response.json();
    const newState = server.fixture.db.readStudyState();
    const queue = server.fixture.db.listQueue();

    assert.equal(response.status, 200);
    assert.equal(payload.advanced, true);
    assert.equal(payload.nextPrompt, 'promises');
    assert.equal(payload.session.completionCount, 10);
    assert.equal(payload.session.progress.completed, true);
    assert.equal(newState.prompt, 'promises');
    assert.equal(newState.completionCount, 0);
    assert.equal(newState.lesson, null);
    assert.equal(queue.length, 0);
  } finally {
    await server.close();
  }
});

test('POST /study-answer does not auto-advance when queue is empty', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.writeStudyState({
      prompt: 'event loop',
      updatedAt: '2026-03-17T00:00:00.000Z',
      completionCount: 9,
      lesson: {
        promptSnapshot: 'event loop',
        explanation: 'Resumo.',
        questions: Array.from({ length: 10 }, (_, index) => ({
          id: index + 1,
          question: `Pergunta ${index + 1}?`,
          options: ['A', 'B', 'C', 'D'],
          correctOptionIndex: 1,
          solved: index < 9,
          selectedOptionIndex: index < 9 ? 1 : null,
        })),
        correctCount: 9,
        completed: false,
        generatedAt: '2026-03-17T00:00:00.000Z',
      },
    });

    const response = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 10, optionIndex: 1 }),
    });
    const payload = await response.json();
    const state = server.fixture.db.readStudyState();

    assert.equal(response.status, 200);
    assert.equal(payload.advanced, undefined);
    assert.equal(state.prompt, 'event loop');
    assert.equal(state.completionCount, 10);
  } finally {
    await server.close();
  }
});

test('GET /study-status exposes queueLength', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.enqueueStudy('closures');
    server.fixture.db.enqueueStudy('promises');

    const response = await fetch(`${server.baseUrl}/study-status`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.queueLength, 2);
  } finally {
    await server.close();
  }
});

test('POST /study-queue/organize reorders queue based on IA response', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  orderedIds: [3, 1, 2],
                  rationale: 'Comecar por fundamentos intercalando com vue e depois avançar.',
                }),
              },
            },
          ],
        };
      },
    }),
  });

  try {
    server.fixture.db.enqueueStudy('Topico 1');
    server.fixture.db.enqueueStudy('Topico 2');
    server.fixture.db.enqueueStudy('Topico 3');

    const queue = server.fixture.db.listQueue();
    const response = await fetch(`${server.baseUrl}/study-queue/organize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.match(payload.rationale, /fundamentos/i);
    assert.deepEqual(
      payload.queue.map((item) => item.id),
      [queue[2].id, queue[0].id, queue[1].id]
    );
  } finally {
    delete process.env.GROQ_API_KEY;
    await server.close();
  }
});

test('POST /study-queue/organize alternates language and framework topics', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  orderedIds: [1, 2, 3, 4],
                  rationale: 'Intercalar linguagem e framework.',
                }),
              },
            },
          ],
        };
      },
    }),
  });

  try {
    server.fixture.db.enqueueStudy('javascript fundamentos');
    server.fixture.db.enqueueStudy('typescript generics');
    server.fixture.db.enqueueStudy('react hooks');
    server.fixture.db.enqueueStudy('vue composables');

    const queue = server.fixture.db.listQueue();
    const response = await fetch(`${server.baseUrl}/study-queue/organize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(
      payload.queue.map((item) => item.id),
      [queue[0].id, queue[2].id, queue[1].id, queue[3].id]
    );
  } finally {
    delete process.env.GROQ_API_KEY;
    await server.close();
  }
});

test('POST /study-queue/organize returns unchanged for queue with less than two items', async () => {
  const server = await startTestServer();

  try {
    server.fixture.db.enqueueStudy('Apenas um tema');
    const response = await fetch(`${server.baseUrl}/study-queue/organize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.unchanged, true);
    assert.equal(payload.queue.length, 1);
  } finally {
    await server.close();
  }
});

test('POST /study-queue/organize returns 500 when IA order is invalid', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({ orderedIds: [999, 1], rationale: 'ordem inválida' }),
              },
            },
          ],
        };
      },
    }),
  });

  try {
    server.fixture.db.enqueueStudy('Tema 1');
    server.fixture.db.enqueueStudy('Tema 2');

    const response = await fetch(`${server.baseUrl}/study-queue/organize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.match(payload.error, /organizar fila com IA/i);
    assert.match(payload.details, /ordem retornada pela IA é inválida/i);
  } finally {
    delete process.env.GROQ_API_KEY;
    await server.close();
  }
});
