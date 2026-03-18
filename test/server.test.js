const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createApp } = require('../src/server');

async function createFixture() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'linksaved-test-'));
  const dataDir = path.join(tempRoot, 'data');
  const linksFilePath = path.join(dataDir, 'links.json');
  const studyFilePath = path.join(dataDir, 'study-theme.json');

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    linksFilePath,
    JSON.stringify([{ name: 'Docs', url: 'https://example.com' }], null, 2)
  );
  await fs.writeFile(
    studyFilePath,
    JSON.stringify({ prompt: '', updatedAt: null, lesson: null, completionCount: 0 }, null, 2)
  );

  return {
    tempRoot,
    linksFilePath,
    studyFilePath,
    publicDir: path.join(__dirname, '..', 'src', 'public')
  };
}

function createGroqPayload() {
  return {
    explanation: 'Explicacao simulada sobre event loop.',
    questions: Array.from({ length: 10 }, (_, index) => ({
      question: `Pergunta ${index + 1}?`,
      options: ['Opcao A', 'Opcao B', 'Opcao C', 'Opcao D'],
      correctOptionIndex: 1
    }))
  };
}

async function startTestServer(overrides = {}) {
  const fixture = await createFixture();
  const app = createApp({
    publicDir: fixture.publicDir,
    linksFilePath: fixture.linksFilePath,
    studyFilePath: fixture.studyFilePath,
    ...overrides
  });

  await new Promise((resolve) => app.listen(0, resolve));
  const address = app.address();

  return {
    app,
    fixture,
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
      await fs.rm(fixture.tempRoot, { recursive: true, force: true });
    }
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
      body: JSON.stringify({ name: 'Node', url: 'https://nodejs.org' })
    });
    const payload = await response.json();
    const savedLinks = JSON.parse(await fs.readFile(server.fixture.linksFilePath, 'utf8'));

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
      body: JSON.stringify({ url: 'https://example.com' })
    });
    const payload = await response.json();
    const savedLinks = JSON.parse(await fs.readFile(server.fixture.linksFilePath, 'utf8'));

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
      body: JSON.stringify({ prompt: 'event loop e promises' })
    });
    const payload = await response.json();
    const savedTheme = JSON.parse(await fs.readFile(server.fixture.studyFilePath, 'utf8'));

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

test('POST /study-theme is blocked until 10 cycles are completed', async () => {
  const server = await startTestServer();

  try {
    await fs.writeFile(
      server.fixture.studyFilePath,
      JSON.stringify(
        {
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
              selectedOptionIndex: index < 3 ? 1 : null
            })),
            correctCount: 3,
            completed: false,
            generatedAt: '2026-03-17T00:00:00.000Z'
          }
        },
        null,
        2
      )
    );
        },
          completionCount: 3
    const response = await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'novo tema' })
    });
    const payload = await response.json();
    const savedTheme = JSON.parse(await fs.readFile(server.fixture.studyFilePath, 'utf8'));

    assert.equal(response.status, 409);
    assert.match(payload.error, /Conclua 10 ciclos/);
    assert.match(payload.error, /Faltam 7 ciclo/);
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
          choices: [
            {
              message: {
                content: JSON.stringify(createGroqPayload())
              }
            }
          ]
        };
      }
    })
  });

  try {
    await fs.writeFile(
      server.fixture.studyFilePath,
      JSON.stringify({ prompt: 'microtasks', updatedAt: '2026-03-17T00:00:00.000Z', lesson: null, completionCount: 0 }, null, 2)
    );

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
        selectedOptionIndex: null
      },
      {
        id: 2,
        question: 'Pergunta 2?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        solved: false,
        selectedOptionIndex: null
      }
    ],
    correctCount: 0,
    completed: false,
    generatedAt: '2026-03-17T00:00:00.000Z'
  };
  const server = await startTestServer();

  try {
    await fs.writeFile(
      server.fixture.studyFilePath,
      JSON.stringify({ prompt: 'event loop', updatedAt: '2026-03-17T00:00:00.000Z', lesson, completionCount: 0 }, null, 2)
    );

    const wrongResponse = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 1, optionIndex: 1 })
    });
    const wrongPayload = await wrongResponse.json();
    const correctResponse = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 1, optionIndex: 2 })
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
    await fs.writeFile(
      server.fixture.studyFilePath,
      JSON.stringify(
        {
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
              selectedOptionIndex: index < 9 ? 1 : null
            })),
            correctCount: 9,
            completed: false,
            generatedAt: '2026-03-17T00:00:00.000Z'
          }
        },
        null,
        2
      )
    );

    const answerResponse = await fetch(`${server.baseUrl}/study-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 10, optionIndex: 1 })
    });
    const answerPayload = await answerResponse.json();
    const saveResponse = await fetch(`${server.baseUrl}/study-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'novo tema liberado' })
    });
    const savePayload = await saveResponse.json();
    const savedTheme = JSON.parse(await fs.readFile(server.fixture.studyFilePath, 'utf8'));

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

test('GET /study-session regenerates only after all questions are solved', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  let fetchCalls = 0;
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        fetchCalls += 1;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify(createGroqPayload())
              }
            }
          ]
        };
      }
    })
  });

  try {
    await fs.writeFile(
      server.fixture.studyFilePath,
      JSON.stringify(
        {
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
              selectedOptionIndex: 1
            })),
            correctCount: 10,
            completed: true,
            generatedAt: '2026-03-17T00:00:00.000Z'
          },
          completionCount: 4
        },
        null,
        2
      )
    );

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
