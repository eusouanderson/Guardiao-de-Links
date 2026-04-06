// Routes dedicated to links endpoints.
const createLinksRoutes = ({ linksController }) => {
  const handle = async ({ route, method, req, res }) => {
    if (route === '/links' && method === 'GET') {
      await linksController.getLinks(req, res);
      return true;
    }

    if (route === '/links' && method === 'POST') {
      await linksController.createLink(req, res);
      return true;
    }

    if (route === '/links' && method === 'DELETE') {
      await linksController.deleteLink(req, res);
      return true;
    }

    return false;
  };

  return { handle };
};

module.exports = {
  createLinksRoutes,
};
