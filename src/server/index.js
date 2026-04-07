// Server composition root wires infrastructure, services, controllers, and routes.
const http = require('node:http');
const dotenv = require('dotenv');

const { DEFAULT_GROQ_MODEL, DEFAULT_PUBLIC_DIR } = require('../config/constants');
const { createLinksController } = require('../controllers/links.controller');
const { createMentorController } = require('../controllers/mentor.controller');
const { createStaticController } = require('../controllers/static.controller');
const { createStudyController } = require('../controllers/study.controller');
const { createDatabase } = require('../database/db');
const { createLinksRepository } = require('../repositories/links.repository');
const { createStudyRepository } = require('../repositories/study.repository');
const { createRouter } = require('../routes');
const { createLinksRoutes } = require('../routes/links.routes');
const { createMentorRoutes } = require('../routes/mentor.routes');
const { createStaticRoutes } = require('../routes/static.routes');
const { createStudyRoutes } = require('../routes/study.routes');
const { createAiService } = require('../services/ai.service');
const { createLinksService } = require('../services/links.service');
const { createStudyService } = require('../services/study.service');
const { parseJsonBody, sendJson, sendText } = require('../utils/http.utils');

dotenv.config();

const createApp = (options = {}) => {
  const publicDir = options.publicDir || DEFAULT_PUBLIC_DIR;
  const db = options.db || createDatabase();
  const fetchImpl = options.fetchImpl || fetch;
  const groqModel = options.groqModel || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  const linksRepository = createLinksRepository({ db });
  const studyRepository = createStudyRepository({ db });

  const linksService = createLinksService({ linksRepository });
  const aiService = createAiService({ fetchImpl, groqModel });
  const studyService = createStudyService({ studyRepository, aiService });

  const linksController = createLinksController({ linksService, sendJson, parseJsonBody });
  const mentorController = createMentorController({ aiService, sendJson, parseJsonBody });
  const studyController = createStudyController({ studyService, sendJson, parseJsonBody });
  const staticController = createStaticController({ publicDir, sendText });

  const router = createRouter({
    routeModules: [
      createStaticRoutes({ staticController }),
      createMentorRoutes({ mentorController }),
      createStudyRoutes({ studyController }),
      createLinksRoutes({ linksController }),
    ],
  });

  return http.createServer(async (req, res) => {
    const route = req.url ? req.url.split('?')[0] : '/';
    const method = req.method;

    const handled = await router.handle({ route, method, req, res });
    if (!handled) {
      sendText(res, 404, 'Página não encontrada');
    }
  });
};

const startServer = (options = {}) => {
  const port = options.port || process.env.PORT || 8000;
  const server = createApp(options);

  server.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`A porta ${port} já está em uso.`);
      return;
    }

    console.error('Erro no servidor:', error.message);
  });

  return server;
};

module.exports = {
  createApp,
  startServer,
};
