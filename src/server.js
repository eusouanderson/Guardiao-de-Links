// Backward-compatible entrypoint exposing server factories and pure study helpers.
const { createApp, startServer } = require('./server/index');
const {
  buildSessionPayload,
  countCorrectAnswers,
  extractJsonFromModel,
  normalizeLesson,
  normalizeQuestion,
  normalizeStudyState,
  validateGeneratedQuestions,
  validateQueueOrder,
} = require('./utils/study.utils');

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
  normalizeQuestion,
  countCorrectAnswers,
  normalizeLesson,
  normalizeStudyState,
  buildSessionPayload,
  extractJsonFromModel,
  validateGeneratedQuestions,
  validateQueueOrder,
};
