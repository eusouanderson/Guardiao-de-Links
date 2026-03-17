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
    JSON.stringify({ prompt: '', updatedAt: null }, null, 2)
  );

  return {
    tempRoot,
    linksFilePath,
    studyFilePath,
    publicDir: path.join(__dirname, '..', 'src', 'public')
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
    assert.equal(savedTheme.prompt, 'event loop e promises');
    assert.ok(savedTheme.updatedAt);
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

test('GET /study-explain returns explanation from mocked Groq client', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  const server = await startTestServer({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: 'Explicacao simulada sobre o tema salvo.'
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
      JSON.stringify({ prompt: 'microtasks', updatedAt: '2026-03-17T00:00:00.000Z' }, null, 2)
    );

    const response = await fetch(`${server.baseUrl}/study-explain`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.prompt, 'microtasks');
    assert.equal(payload.explanation, 'Explicacao simulada sobre o tema salvo.');
  } finally {
    delete process.env.GROQ_API_KEY;
    await server.close();
  }
});
