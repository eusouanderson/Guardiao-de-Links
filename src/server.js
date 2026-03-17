const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

const DEFAULT_PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_DATA_DIR = path.join(__dirname, 'data');
const DEFAULT_LINKS_FILE_PATH = path.join(DEFAULT_DATA_DIR, 'links.json');
const DEFAULT_STUDY_FILE_PATH = path.join(DEFAULT_DATA_DIR, 'study-theme.json');
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
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
}

const sendText = (res, statusCode, message) => {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

const readRequestBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const readJsonFile = async (filePath, fallbackValue) => {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

const writeJsonFile = async (filePath, payload) => {
  await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2));
}

const createApp = (options = {}) => {
  const publicDir = options.publicDir || DEFAULT_PUBLIC_DIR;
  const linksFilePath = options.linksFilePath || DEFAULT_LINKS_FILE_PATH;
  const studyFilePath = options.studyFilePath || DEFAULT_STUDY_FILE_PATH;
  const groqModel = options.groqModel || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
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
  }

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
  }

  const readLinks = async () => {
    const links = await readJsonFile(linksFilePath, []);
    return Array.isArray(links) ? links : [];
  }

  const readStudyTheme = async () => {
    const parsed = await readJsonFile(studyFilePath, { prompt: '', updatedAt: null });
    return {
      prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
      updatedAt: parsed.updatedAt || null
    };
  }

  const saveStudyTheme = async (prompt) => {
    const payload = {
      prompt,
      updatedAt: new Date().toISOString()
    };
    await writeJsonFile(studyFilePath, payload);
    return payload;
  }

  const getGroqExplanation = async (themePrompt) => {
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
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'Você é um tutor didático em português do Brasil. Explique de forma clara, com exemplos práticos e um pequeno resumo final.'
          },
          {
            role: 'user',
            content: `Explique os seguintes temas de estudo: ${themePrompt}`
          }
        ]
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message || 'Falha ao consultar a API do Groq';
      throw new Error(message);
    }

    const explanation = data?.choices?.[0]?.message?.content;
    if (!explanation) {
      throw new Error('A API do Groq não retornou explicação.');
    }

    return explanation;
  }

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
      const themeData = await readStudyTheme();
      sendJson(res, 200, themeData);
      return;
    }

    if (route === '/study-theme' && req.method === 'POST') {
      try {
        const body = await readRequestBody(req);
        const parsed = JSON.parse(body || '{}');
        const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';

        if (!prompt) {
          sendJson(res, 400, { error: 'Informe um tema para estudo.' });
          return;
        }

        const saved = await saveStudyTheme(prompt);
        sendJson(res, 200, { success: true, data: saved });
      } catch (error) {
        sendJson(res, 400, { error: 'Dados inválidos', details: error.message });
      }
      return;
    }

    if (route === '/study-explain' && req.method === 'GET') {
      try {
        const themeData = await readStudyTheme();
        if (!themeData.prompt) {
          sendJson(res, 400, { error: 'Nenhum tema salvo ainda. Envie um tema para começar.' });
          return;
        }

        const explanation = await getGroqExplanation(themeData.prompt);
        sendJson(res, 200, {
          prompt: themeData.prompt,
          updatedAt: themeData.updatedAt,
          explanation
        });
      } catch (error) {
        sendJson(res, 500, { error: 'Erro ao consultar a IA', details: error.message });
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
        const links = await readLinks();
        links.push(newLink);
        await writeJsonFile(linksFilePath, links);
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
        const links = await readLinks();
        const filtered = links.filter((link) => link.url !== url);
        await writeJsonFile(linksFilePath, filtered);
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
}

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
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer
};
