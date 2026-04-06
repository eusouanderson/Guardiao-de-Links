// Environment utilities keep process.env access in one place.
const getGroqApiKey = () => process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.API_KEY;

module.exports = {
  getGroqApiKey,
};
