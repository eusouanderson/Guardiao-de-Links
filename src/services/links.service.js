// Links service contains link-related business rules.
const createLinksService = ({ linksRepository }) => ({
  listLinks: () => linksRepository.listLinks(),
  createLink: (link) => linksRepository.addLink(link),
  removeLink: (url) => linksRepository.deleteLink(url),
});

module.exports = {
  createLinksService,
};
