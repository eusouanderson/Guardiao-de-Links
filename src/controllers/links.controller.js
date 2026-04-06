// Links controller maps HTTP payloads to links service operations.
const createLinksController = ({ linksService, sendJson, parseJsonBody }) => {
  const getLinks = async (_req, res) => {
    const links = linksService.listLinks();
    sendJson(res, 200, links);
  };

  const createLink = async (req, res) => {
    try {
      const newLink = await parseJsonBody(req);
      linksService.createLink(newLink);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
    }
  };

  const deleteLink = async (req, res) => {
    try {
      const parsed = await parseJsonBody(req);
      const url = typeof parsed.url === 'string' ? parsed.url : '';
      linksService.removeLink(url);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
    }
  };

  return {
    getLinks,
    createLink,
    deleteLink,
  };
};

module.exports = {
  createLinksController,
};
