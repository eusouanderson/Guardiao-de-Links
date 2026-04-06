const assert = require('node:assert/strict');
const test = require('node:test');

const { createLinksRoutes } = require('./links.routes');

test('links routes dispatch GET /links to controller', async () => {
  let called = false;
  const linksRoutes = createLinksRoutes({
    linksController: {
      getLinks: async () => {
        called = true;
      },
      createLink: async () => {},
      deleteLink: async () => {},
    },
  });

  const handled = await linksRoutes.handle({ route: '/links', method: 'GET', req: {}, res: {} });
  assert.equal(handled, true);
  assert.equal(called, true);
});
