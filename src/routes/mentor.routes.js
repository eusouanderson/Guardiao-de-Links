// Routes dedicated to the Paulo Freire mentor chat endpoint.
const createMentorRoutes = ({ mentorController }) => {
  const handle = async ({ route, method, req, res }) => {
    if (route === '/mentor-chat' && method === 'POST') {
      await mentorController.chat(req, res);
      return true;
    }

    if (route === '/mentor-chat-stream' && method === 'POST') {
      await mentorController.chatStream(req, res);
      return true;
    }

    return false;
  };

  return { handle };
};

module.exports = { createMentorRoutes };
