const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createDatabase } = require('../database/db');
const { createApp } = require('./index');

test('server createApp: serves links endpoint', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'linksaved-server-layer-'));
  const dbPath = path.join(tempRoot, 'test.db');
  const db = createDatabase(dbPath);
  db.addLink({ name: 'Docs', url: 'https://example.com' });

  const server = createApp({
    db,
    publicDir: path.join(__dirname, '..', 'public'),
  });

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/links`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.length, 1);
  } finally {
    db.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
