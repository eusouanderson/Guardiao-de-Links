const assert = require('node:assert/strict');
const test = require('node:test');

const { createLinksService } = require('./links.service');

test('links service delegates list/create/remove to repository', () => {
  const calls = [];
  const linksRepository = {
    listLinks: () => [{ name: 'Docs', url: 'https://example.com' }],
    addLink: (link) => calls.push(['addLink', link]),
    deleteLink: (url) => calls.push(['deleteLink', url]),
  };

  const service = createLinksService({ linksRepository });
  const list = service.listLinks();
  service.createLink({ name: 'Node', url: 'https://nodejs.org' });
  service.removeLink('https://example.com');

  assert.equal(list.length, 1);
  assert.deepEqual(calls, [
    ['addLink', { name: 'Node', url: 'https://nodejs.org' }],
    ['deleteLink', 'https://example.com'],
  ]);
});
