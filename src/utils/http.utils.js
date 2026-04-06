// Shared HTTP helpers for response serialization and request body parsing.
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

const parseJsonBody = async (req) => {
  const rawBody = await readRequestBody(req);
  return JSON.parse(rawBody || '{}');
};

module.exports = {
  sendJson,
  sendText,
  readRequestBody,
  parseJsonBody,
};
