// Routes dedicated to study endpoints.
const createStudyRoutes = ({ studyController }) => {
  const handle = async ({ route, method, req, res }) => {
    if (route === '/study-theme' && method === 'GET') {
      await studyController.getTheme(req, res);
      return true;
    }

    if (route === '/study-theme' && method === 'POST') {
      await studyController.saveTheme(req, res);
      return true;
    }

    if (route === '/study-status' && method === 'GET') {
      await studyController.getStatus(req, res);
      return true;
    }

    if (route === '/study-history' && method === 'GET') {
      await studyController.getHistory(req, res);
      return true;
    }

    if (route === '/study-session' && method === 'GET') {
      await studyController.getSession(req, res);
      return true;
    }

    if (route === '/study-explain' && method === 'GET') {
      await studyController.getExplanation(req, res);
      return true;
    }

    if (route === '/study-answer' && method === 'POST') {
      await studyController.submitAnswer(req, res);
      return true;
    }

    if (route === '/study-queue' && method === 'GET') {
      await studyController.getQueue(req, res);
      return true;
    }

    if (route === '/study-queue/move' && method === 'POST') {
      await studyController.moveQueueItem(req, res);
      return true;
    }

    if (route === '/study-queue/organize' && method === 'POST') {
      await studyController.organizeQueue(req, res);
      return true;
    }

    if (route === '/study-queue' && method === 'DELETE') {
      await studyController.deleteQueueItem(req, res);
      return true;
    }

    if (route === '/study-advance' && method === 'POST') {
      await studyController.advanceStudy(req, res);
      return true;
    }

    return false;
  };

  return { handle };
};

module.exports = {
  createStudyRoutes,
};
