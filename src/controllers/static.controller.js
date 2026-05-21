const fs = require('node:fs');
const path = require('node:path');
const { MIME_TYPES } = require('../config/constants');

const createStaticController = ({ publicDir, sendText }) => {
  const serveHtml = async (res, fileName) => {
    const filePath = path.join(publicDir, fileName);

    try {
      const data = await fs.promises.readFile(filePath);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch {
      sendText(res, 500, 'Erro interno do servidor');
    }
  };

  const serveStaticAsset = async (res, route) => {
    const normalizedRoute = path.normalize(route).replace(/^[/\\]+/, '');
    if (!normalizedRoute || normalizedRoute.startsWith('..')) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end();
      return;
    }

    const filePath = path.join(publicDir, normalizedRoute);
    const extension = path.extname(filePath);
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

  return {
    serveHtml,
    serveStaticAsset,
  };
};

module.exports = {
  createStaticController,
};
