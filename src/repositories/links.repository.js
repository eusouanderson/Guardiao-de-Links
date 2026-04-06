// Links repository isolates persistence operations for links.
const createLinksRepository = ({ db }) => ({
  listLinks: () => db.readLinks(),
  addLink: (link) => db.addLink(link),
  deleteLink: (url) => db.deleteLink(url),
});

module.exports = {
  createLinksRepository,
};
