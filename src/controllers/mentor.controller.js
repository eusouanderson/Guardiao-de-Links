// Mentor controller translates HTTP requests into AI mentor chat calls.
const createMentorController = ({ aiService, sendJson, parseJsonBody }) => {
  const chat = async (req, res) => {
    try {
      const parsed = await parseJsonBody(req);
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];

      const content = await aiService.generateMentorResponse({ messages });
      sendJson(res, 200, { message: content });
    } catch (error) {
      sendJson(res, 500, { error: 'Erro ao contatar a IA', details: error.message });
    }
  };

  return { chat };
};

module.exports = { createMentorController };
