// Routes dedicated to static files and html pages.
const createStaticRoutes = ({ staticController }) => {
  const handle = async ({ route, req, res }) => {
    if (route === '/' || route === '/links.html') {
      await staticController.serveHtml(res, 'links.html');
      return true;
    }

    if (
      route === '/estudos' ||
      route === '/estudos.html' ||
      route === '/nova-pagina' ||
      route === '/nova-pagina.html'
    ) {
      await staticController.serveHtml(res, 'estudos.html');
      return true;
    }

    if (route === '/historico-estudos' || route === '/historico-estudos.html') {
      await staticController.serveHtml(res, 'historico-estudos.html');
      return true;
    }

    if (route === '/mentor-freire' || route === '/mentor-freire.html') {
      await staticController.serveHtml(res, 'mentor-freire.html');
      return true;
    }

    if (route === '/favicon.ico') {
      await staticController.serveStaticAsset(res, '/link-da-web.png');
      return true;
    }

    if (/^\/[\w./-]+\.(js|css|png|jpg|jpeg|svg|ico)$/.test(route)) {
      await staticController.serveStaticAsset(res, route);
      return true;
    }

    return false;
  };

  return { handle };
};

module.exports = {
  createStaticRoutes,
};
