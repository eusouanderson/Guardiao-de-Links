const { buildSessionPayload } = require('../utils/study.utils');
const { normalizeStudyDifficulty } = require('../utils/study.utils');

const createStudyController = ({ studyService, sendJson, parseJsonBody }) => {
  const getTheme = async (_req, res) => {
    const studyState = studyService.readStudyState();
    sendJson(res, 200, {
      prompt: studyState.prompt,
      difficulty: studyState.difficulty,
      updatedAt: studyState.updatedAt,
      status: studyService.getStudyStatus(studyState),
    });
  };

  const saveTheme = async (req, res) => {
    try {
      const parsed = await parseJsonBody(req);
      const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
      const difficulty = normalizeStudyDifficulty(parsed.difficulty);
      const force = Boolean(parsed.force);

      if (!prompt) {
        sendJson(res, 400, { error: 'Informe um tema para estudo.' });
        return;
      }

      const result = studyService.saveOrQueueTheme({ prompt, difficulty, force });
      sendJson(res, result.statusCode, result.payload);
    } catch (error) {
      sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
    }
  };

  const getStatus = async (_req, res) => {
    const studyState = studyService.readStudyState();
    sendJson(res, 200, studyService.getStudyStatus(studyState));
  };

  const getHistory = async (_req, res) => {
    sendJson(res, 200, studyService.listStudyHistory());
  };

  const getSession = async (_req, res) => {
    try {
      const { studyState } = await studyService.ensureStudySession();
      if (!studyState.prompt) {
        sendJson(res, 400, { error: 'Nenhum tema salvo ainda. Envie um tema para começar.' });
        return;
      }

      sendJson(res, 200, buildSessionPayload(studyState));
    } catch (error) {
      sendJson(res, 500, { error: 'Erro ao consultar a IA', details: error.message });
    }
  };

  const getExplanation = async (_req, res) => {
    try {
      const { studyState } = await studyService.ensureStudySession();
      if (!studyState.prompt) {
        sendJson(res, 400, { error: 'Nenhum tema salvo ainda. Envie um tema para começar.' });
        return;
      }

      const sessionPayload = buildSessionPayload(studyState);
      sendJson(res, 200, {
        prompt: sessionPayload.prompt,
        updatedAt: sessionPayload.updatedAt,
        explanation: sessionPayload.explanation,
        progress: sessionPayload.progress,
      });
    } catch (error) {
      sendJson(res, 500, { error: 'Erro ao consultar a IA', details: error.message });
    }
  };

  const submitAnswer = async (req, res) => {
    try {
      const parsed = await parseJsonBody(req);
      const result = studyService.submitAnswer({
        questionId: Number(parsed.questionId),
        optionIndex: Number(parsed.optionIndex),
      });

      sendJson(res, result.statusCode, result.payload);
    } catch (error) {
      sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
    }
  };

  const getQueue = async (_req, res) => {
    sendJson(res, 200, studyService.listQueue());
  };

  const moveQueueItem = async (req, res) => {
    try {
      const parsed = await parseJsonBody(req);
      const id = Number(parsed.id);
      const direction =
        parsed.direction === 'up' || parsed.direction === 'down' ? parsed.direction : null;

      if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { error: 'ID inválido.' });
        return;
      }

      if (!direction) {
        sendJson(res, 400, { error: 'Direção inválida. Use "up" ou "down".' });
        return;
      }

      const moved = studyService.moveQueueItem(id, direction);
      sendJson(res, 200, {
        success: true,
        moved,
        queue: studyService.listQueue(),
      });
    } catch (error) {
      sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
    }
  };

  const organizeQueue = async (_req, res) => {
    try {
      const result = await studyService.organizeQueue();
      sendJson(res, result.statusCode, result.payload);
    } catch (error) {
      sendJson(res, 500, { error: 'Erro ao organizar fila com IA', details: error.message });
    }
  };

  const deleteQueueItem = async (req, res) => {
    try {
      const parsed = await parseJsonBody(req);
      const id = Number(parsed.id);
      if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { error: 'ID inválido.' });
        return;
      }

      studyService.deleteFromQueue(id);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
    }
  };

  const advanceStudy = async (_req, res) => {
    const result = studyService.advanceToNextStudy();
    sendJson(res, result.statusCode, result.payload);
  };

  return {
    getTheme,
    saveTheme,
    getStatus,
    getHistory,
    getSession,
    getExplanation,
    submitAnswer,
    advanceStudy,
    getQueue,
    moveQueueItem,
    organizeQueue,
    deleteQueueItem,
  };
};

module.exports = {
  createStudyController,
};
