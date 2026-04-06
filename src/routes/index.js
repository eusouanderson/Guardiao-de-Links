// Router composition executes route modules in order and stops on first match.
const createRouter = ({ routeModules }) => {
  const handle = async ({ route, method, req, res }) => {
    for (const routeModule of routeModules) {
      const handled = await routeModule.handle({ route, method, req, res });
      if (handled) {
        return true;
      }
    }

    return false;
  };

  return { handle };
};

module.exports = {
  createRouter,
};
