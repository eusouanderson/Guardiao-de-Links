const assert = require('node:assert/strict');
const test = require('node:test');

const { createLinksController } = require('./links.controller');

test('links controller returns links payload', async () => {
  const sent = [];
  const controller = createLinksController({
    linksService: { listLinks: () => [{ name: 'Docs', url: 'https://example.com' }] },
    sendJson: (_res, status, payload) => sent.push({ status, payload }),
    parseJsonBody: async () => ({}),
  });

  await controller.getLinks({}, {});
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].payload.length, 1);
});
