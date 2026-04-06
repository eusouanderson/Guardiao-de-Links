const assert = require('node:assert/strict');
const test = require('node:test');

const { createLinksRepository } = require('./links.repository');

test('links repository delegates operations to db adapter', () => {
  const calls = [];
  const db = {
    readLinks: () => [{ name: 'A', url: 'https://a.com' }],
    addLink: (link) => calls.push(['addLink', link]),
    deleteLink: (url) => calls.push(['deleteLink', url]),
  };

  const repository = createLinksRepository({ db });
  const links = repository.listLinks();
  repository.addLink({ name: 'B', url: 'https://b.com' });
  repository.deleteLink('https://a.com');

  assert.equal(links.length, 1);
  assert.deepEqual(calls, [
    ['addLink', { name: 'B', url: 'https://b.com' }],
    ['deleteLink', 'https://a.com'],
  ]);
});
