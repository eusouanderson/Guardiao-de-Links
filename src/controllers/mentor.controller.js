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

  const chatStream = async (req, res) => {
    try {
      const parsed = await parseJsonBody(req);
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      let closed = false;
      req.on('close', () => {
        closed = true;
      });

      for await (const token of aiService.generateMentorResponseStream({ messages })) {
        if (closed) break;
        res.write(`data: ${JSON.stringify(token)}\n\n`);
      }

      if (!closed) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (error) {
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Erro ao transmitir resposta', details: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  };

  return { chat, chatStream };
};

module.exports = { createMentorController };
