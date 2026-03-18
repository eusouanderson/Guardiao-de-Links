const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { createDatabase } = require('./db');

dotenv.config();

const DEFAULT_PUBLIC_DIR = path.join(__dirname, 'public');
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUIRED_COMPLETION_COUNT = 10;
const MIME_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const sendText = (res, statusCode, message) => {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
};

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const createEmptyStudyState = () => ({
  prompt: '',
  updatedAt: null,
  lesson: null,
  completionCount: 0
});

const normalizeQuestion = (question, index) => {
  const options = Array.isArray(question?.options)
    ? question.options.filter((option) => typeof option === 'string').slice(0, 4)
    : [];

  return {
    id: Number(question?.id) || index + 1,
    question: typeof question?.question === 'string' ? question.question : '',
    options,
    correctOptionIndex: Number.isInteger(question?.correctOptionIndex)
      ? question.correctOptionIndex
      : -1,
    solved: Boolean(question?.solved),
    selectedOptionIndex: Number.isInteger(question?.selectedOptionIndex)
      ? question.selectedOptionIndex
      : null
  };
};

const countCorrectAnswers = (questions) => questions.filter((question) => question.solved).length;

const normalizeLesson = (lesson) => {
  if (!lesson || typeof lesson !== 'object') {
    return null;
  }

  const questions = Array.isArray(lesson.questions)
    ? lesson.questions.map((question, index) => normalizeQuestion(question, index))
    : [];

  if (!questions.length) {
    return null;
  }

  const correctCount = countCorrectAnswers(questions);

  return {
    promptSnapshot: typeof lesson.promptSnapshot === 'string' ? lesson.promptSnapshot : '',
    explanation: typeof lesson.explanation === 'string' ? lesson.explanation : '',
    questions,
    correctCount,
    completed: Boolean(lesson.completed) || correctCount === questions.length,
    generatedAt: lesson.generatedAt || null
  };
};

const normalizeStudyState = (parsed) => {
  const baseState = createEmptyStudyState();
  if (!parsed || typeof parsed !== 'object') {
    return baseState;
  }

  return {
    prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
    updatedAt: parsed.updatedAt || null,
    lesson: normalizeLesson(parsed.lesson),
    completionCount: Number.isInteger(parsed.completionCount) ? parsed.completionCount : 0
  };
};

const buildSessionPayload = (studyState) => {
  const lesson = studyState.lesson;
  const totalQuestions = lesson?.questions.length || 0;
  const correctCount = lesson?.correctCount || 0;

  return {
    prompt: studyState.prompt,
    updatedAt: studyState.updatedAt,
    explanation: lesson?.explanation || '',
    generatedAt: lesson?.generatedAt || null,
    questions: (lesson?.questions || []).map((question) => ({
      id: question.id,
      question: question.question,
      options: question.options,
      solved: question.solved,
      selectedOptionIndex: question.selectedOptionIndex
    })),
    progress: {
      correctCount,
      totalQuestions,
      completed: Boolean(lesson?.completed)
    },
    completionCount: studyState.completionCount || 0
  };
};

const extractJsonFromModel = (content) => {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
};

const validateGeneratedQuestions = (questions) => {
  if (!Array.isArray(questions) || questions.length !== 10) {
    throw new Error('A IA não retornou 10 perguntas válidas.');
  }

  return questions.map((question, index) => {
    const normalized = normalizeQuestion(question, index);
    if (!normalized.question || normalized.options.length !== 4) {
      throw new Error('Uma das perguntas geradas pela IA está inválida.');
    }
    if (normalized.correctOptionIndex < 0 || normalized.correctOptionIndex > 3) {
      throw new Error('A resposta correta de uma pergunta gerada pela IA está inválida.');
    }

    return {
      ...normalized,
      solved: false,
      selectedOptionIndex: null
    };
  });
};

const createApp = (options = {}) => {
  const publicDir = options.publicDir || DEFAULT_PUBLIC_DIR;
  const db = options.db || createDatabase();
  const groqModel = options.groqModel || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const fetchImpl = options.fetchImpl || fetch;

  const serveHtml = async (res, fileName) => {
    const filePath = path.join(publicDir, fileName);
    try {
      const data = await fs.promises.readFile(filePath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch {
      sendText(res, 500, 'Erro interno do servidor');
    }
  };

  const serveStaticAsset = async (res, route) => {
    const safeName = path.basename(route);
    const filePath = path.join(publicDir, safeName);
    const extension = path.extname(safeName);
    const mimeType = MIME_TYPES[extension] || 'application/octet-stream';

    try {
      const data = await fs.promises.readFile(filePath);
      res.writeHead(200, { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=86400' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': mimeType });
      res.end();
    }
  };

  const readLinks = async () => db.readLinks();

  const readStudyState = async () => normalizeStudyState(db.readStudyState());

  const writeStudyState = async (studyState) => { db.writeStudyState(studyState); };

  const saveStudyTheme = async (prompt) => {
    const currentState = await readStudyState();
    const payload = {
      ...currentState,
      prompt,
      updatedAt: new Date().toISOString(),
      lesson: null,
      completionCount: 0
    };
    await writeStudyState(payload);
    return payload;
  };

  const generateStudyLesson = async (themePrompt) => {
    const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY não foi configurada no .env');
    }

    const response = await fetchImpl(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'Você é um tutor didático em português do Brasil. Responda apenas com JSON válido, sem markdown. Estrutura: {"explanation":"texto","questions":[{"question":"texto","options":["opcao 1","opcao 2","opcao 3","opcao 4"],"correctOptionIndex":0}]}. Gere exatamente 10 perguntas objetivas de múltipla escolha com 4 opções cada e índice correto entre 0 e 3.'
          },
          {
            role: 'user',
            content: `Explique o seguinte tema e crie 10 perguntas objetivas sobre ele: ${themePrompt}`
          }
        ]
      })
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

    const explanation = typeof parsedContent.explanation === 'string' ? parsedContent.explanation : '';
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
      generatedAt: new Date().toISOString()
    };
  };

  const ensureStudySession = async () => {
    const studyState = await readStudyState();

    if (!studyState.prompt) {
      return { studyState, generated: false };
    }

    const shouldGenerate =
      !studyState.lesson ||
      studyState.lesson.completed ||
      studyState.lesson.promptSnapshot !== studyState.prompt;

    if (!shouldGenerate) {
      return { studyState, generated: false };
    }

    const lesson = await generateStudyLesson(studyState.prompt);
    const updatedState = {
      ...studyState,
      lesson
    };
    await writeStudyState(updatedState);

    return { studyState: updatedState, generated: true };
  };

  const getStudyStatus = (studyState) => {
    const lesson = studyState.lesson;
    const hasPrompt = Boolean(studyState.prompt);
    const totalQuestions = lesson?.questions.length || (hasPrompt ? 10 : 0);
    const correctCount = lesson?.correctCount || 0;
    const completionCount = studyState.completionCount || 0;
    const remainingCycles = Math.max(REQUIRED_COMPLETION_COUNT - completionCount, 0);
    const pendingStudy = hasPrompt && (!lesson || !lesson.completed || lesson.promptSnapshot !== studyState.prompt);
    const canSaveNewTheme = !hasPrompt || completionCount >= REQUIRED_COMPLETION_COUNT;

    return {
      hasPrompt,
      pendingStudy,
      canSaveNewTheme,
      prompt: studyState.prompt,
      updatedAt: studyState.updatedAt,
      completionCount,
      requiredCompletionCount: REQUIRED_COMPLETION_COUNT,
      remainingCycles,
      progress: {
        correctCount,
        totalQuestions,
        completed: Boolean(lesson?.completed)
      }
    };
  };

  return http.createServer(async (req, res) => {
    const route = req.url ? req.url.split('?')[0] : '/';

    if (route === '/' || route === '/links.html') {
      await serveHtml(res, 'links.html');
      return;
    }

    if (
      route === '/estudos' ||
      route === '/estudos.html' ||
      route === '/nova-pagina' ||
      route === '/nova-pagina.html'
    ) {
      await serveHtml(res, 'estudos.html');
      return;
    }

    if (route === '/study-theme' && req.method === 'GET') {
      const studyState = await readStudyState();
      sendJson(res, 200, {
        prompt: studyState.prompt,
        updatedAt: studyState.updatedAt,
        status: getStudyStatus(studyState)
      });
      return;
    }

    if (route === '/study-theme' && req.method === 'POST') {
      try {
        const body = await readRequestBody(req);
        const parsed = JSON.parse(body || '{}');
        const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
        const currentState = await readStudyState();
        const currentStatus = getStudyStatus(currentState);

        if (!prompt) {
          sendJson(res, 400, { error: 'Informe um tema para estudo.' });
          return;
        }

        if (!currentStatus.canSaveNewTheme) {
          sendJson(res, 409, {
            error: `Conclua ${currentStatus.requiredCompletionCount} ciclos do tema atual antes de salvar um novo tema. Faltam ${currentStatus.remainingCycles} ciclo(s).`
          });
          return;
        }

        const saved = await saveStudyTheme(prompt);
        sendJson(res, 200, {
          success: true,
          data: {
            prompt: saved.prompt,
            updatedAt: saved.updatedAt,
            status: getStudyStatus(saved)
          }
        });
      } catch (error) {
        sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
      }
      return;
    }

    if (route === '/study-status' && req.method === 'GET') {
      const studyState = await readStudyState();
      sendJson(res, 200, getStudyStatus(studyState));
      return;
    }

    if (route === '/study-session' && req.method === 'GET') {
      try {
        const { studyState } = await ensureStudySession();
        if (!studyState.prompt) {
          sendJson(res, 400, { error: 'Nenhum tema salvo ainda. Envie um tema para começar.' });
          return;
        }

        sendJson(res, 200, buildSessionPayload(studyState));
      } catch (error) {
        sendJson(res, 500, { error: 'Erro ao consultar a IA', details: error.message });
      }
      return;
    }

    if (route === '/study-explain' && req.method === 'GET') {
      try {
        const { studyState } = await ensureStudySession();
        if (!studyState.prompt) {
          sendJson(res, 400, { error: 'Nenhum tema salvo ainda. Envie um tema para começar.' });
          return;
        }

        const payload = buildSessionPayload(studyState);
        sendJson(res, 200, {
          prompt: payload.prompt,
          updatedAt: payload.updatedAt,
          explanation: payload.explanation,
          progress: payload.progress
        });
      } catch (error) {
        sendJson(res, 500, { error: 'Erro ao consultar a IA', details: error.message });
      }
      return;
    }

    if (route === '/study-answer' && req.method === 'POST') {
      try {
        const body = await readRequestBody(req);
        const parsed = JSON.parse(body || '{}');
        const questionId = Number(parsed.questionId);
        const optionIndex = Number(parsed.optionIndex);
        const studyState = await readStudyState();

        if (!studyState.lesson || studyState.lesson.promptSnapshot !== studyState.prompt) {
          sendJson(res, 400, { error: 'Nenhuma sessão de estudo ativa encontrada.' });
          return;
        }

        const question = studyState.lesson.questions.find((item) => item.id === questionId);
        if (!question) {
          sendJson(res, 404, { error: 'Pergunta não encontrada.' });
          return;
        }

        if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
          sendJson(res, 400, { error: 'Resposta inválida.' });
          return;
        }

        if (question.solved) {
          sendJson(res, 200, {
            success: true,
            correct: true,
            alreadySolved: true,
            session: buildSessionPayload(studyState)
          });
          return;
        }

        const correct = question.correctOptionIndex === optionIndex;
        question.selectedOptionIndex = optionIndex;
        if (correct) {
          question.solved = true;
        }

        studyState.lesson.correctCount = countCorrectAnswers(studyState.lesson.questions);
        const justCompleted = !studyState.lesson.completed &&
          studyState.lesson.correctCount === studyState.lesson.questions.length;
        studyState.lesson.completed =
          studyState.lesson.correctCount === studyState.lesson.questions.length;

        if (justCompleted) {
          studyState.completionCount = (studyState.completionCount || 0) + 1;
        }

        await writeStudyState(studyState);

        sendJson(res, 200, {
          success: true,
          correct,
          session: buildSessionPayload(studyState)
        });
      } catch (error) {
        sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
      }
      return;
    }

    if (route === '/links' && req.method === 'GET') {
      const links = await readLinks();
      sendJson(res, 200, links);
      return;
    }

    if (route === '/links' && req.method === 'POST') {
      try {
        const body = await readRequestBody(req);
        const newLink = JSON.parse(body || '{}');
        db.addLink(newLink);
        sendJson(res, 200, { success: true });
      } catch (error) {
        sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
      }
      return;
    }

    if (route === '/links' && req.method === 'DELETE') {
      try {
        const body = await readRequestBody(req);
        const parsed = JSON.parse(body || '{}');
        const url = typeof parsed.url === 'string' ? parsed.url : '';
        db.deleteLink(url);
        sendJson(res, 200, { success: true });
      } catch (error) {
        sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
      }
      return;
    }

    if (route === '/favicon.ico') {
      await serveStaticAsset(res, '/link-da-web.png');
      return;
    }

    if (/^\/[\w.-]+\.(js|css|png|jpg|jpeg|svg|ico)$/.test(route)) {
      await serveStaticAsset(res, route);
      return;
    }

    sendText(res, 404, 'Página não encontrada');
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
    } else {
      console.error('Erro no servidor:', error.message);
    }
  });

  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
  // pure helpers exported for unit testing
  normalizeQuestion,
  countCorrectAnswers,
  normalizeLesson,
  normalizeStudyState,
  buildSessionPayload,
  extractJsonFromModel,
  validateGeneratedQuestions
};
