// AI service encapsulates Groq API interactions and payload validation.
const { DEFAULT_GROQ_MODEL, GROQ_API_URL } = require('../config/constants');
const { getGroqApiKey } = require('../config/env');
const {
  extractJsonFromModel,
  interleaveLanguageAndFramework,
  validateGeneratedQuestions,
  validateQueueOrder,
} = require('../utils/study.utils');

const createAiService = ({ fetchImpl = fetch, groqModel = DEFAULT_GROQ_MODEL } = {}) => {
  const generateStudyLesson = async (themePrompt) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      throw new Error('GROQ_API_KEY não foi configurada no .env');
    }

    const response = await fetchImpl(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'Você é um tutor didático em português do Brasil. Responda apenas com JSON válido, sem markdown. Estrutura: {"explanation":"texto","questions":[{"question":"texto","options":["opcao 1","opcao 2","opcao 3","opcao 4"],"correctOptionIndex":0}]}. Gere exatamente 10 perguntas objetivas de múltipla escolha com 4 opções cada e índice correto entre 0 e 3.',
          },
          {
            role: 'user',
            content: `Explique o seguinte tema e crie 10 perguntas objetivas sobre ele: ${themePrompt}`,
          },
        ],
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message || 'Falha ao consultar a API do Groq';
      throw new Error(message);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('A API do Groq não retornou conteúdo.');
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(extractJsonFromModel(content));
    } catch {
      throw new Error('A IA retornou um formato inválido para o estudo.');
    }

    const explanation =
      typeof parsedContent.explanation === 'string' ? parsedContent.explanation : '';
    if (!explanation.trim()) {
      throw new Error('A IA não retornou uma explicação válida.');
    }

    const questions = validateGeneratedQuestions(parsedContent.questions);
    return {
      promptSnapshot: themePrompt,
      explanation: explanation.trim(),
      questions,
      correctCount: 0,
      completed: false,
      generatedAt: new Date().toISOString(),
    };
  };

  const organizeQueueWithAi = async (queue, activePrompt) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      throw new Error('GROQ_API_KEY não foi configurada no .env');
    }

    const response = await fetchImpl(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Você é um tutor especialista em aprendizagem eficiente. Retorne apenas JSON válido, sem markdown, no formato {"orderedIds":[1,2],"rationale":"texto curto"}. Reordene os IDs em uma sequência pedagógica baseada em progressão de dificuldade, fundamentos antes de tópicos avançados e encadeamento de pré-requisitos.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              activePrompt,
              queue: queue.map((item) => ({
                id: item.id,
                prompt: item.prompt,
                createdAt: item.createdAt,
              })),
            }),
          },
        ],
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message || 'Falha ao consultar a API do Groq';
      throw new Error(message);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('A IA não retornou conteúdo para reorganizar a fila.');
    }

    let parsed;
    try {
      parsed = JSON.parse(extractJsonFromModel(content));
    } catch {
      throw new Error('A IA retornou formato inválido para organizar a fila.');
    }

    const orderedIds = Array.isArray(parsed?.orderedIds)
      ? parsed.orderedIds.map((id) => Number(id))
      : null;

    if (!validateQueueOrder(orderedIds, queue)) {
      throw new Error('A ordem retornada pela IA é inválida para a fila atual.');
    }

    return {
      orderedIds: interleaveLanguageAndFramework(orderedIds, queue),
      rationale: typeof parsed?.rationale === 'string' ? parsed.rationale.trim() : '',
    };
  };

  return {
    generateStudyLesson,
    organizeQueueWithAi,
  };
};

module.exports = {
  createAiService,
};
