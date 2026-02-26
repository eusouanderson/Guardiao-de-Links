const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erro interno do servidor');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
        res.end(data);
      }
    });
  } else if (req.url === '/favicon.ico') {
    fs.readFile(path.join(__dirname, 'favicon.ico'), (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'image/x-icon' });
        res.end();
      } else {
        res.writeHead(200, {
          'Content-Type': 'image/x-icon',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(data);
      }
    });
  } else if (req.url.match(/^\/([\w\-.]+\.js|css|png|jpg|jpeg|svg)$/)) {
    const ext = path.extname(req.url);
    const mime =
      {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      }[ext] || 'application/octet-stream';
    fs.readFile(path.join(__dirname, req.url), (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': mime });
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
        res.end(data);
      }
    });
  } else if (req.url === '/links' && req.method === 'GET') {
    fs.readFile(path.join(__dirname, 'links.json'), (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      }
    });
  } else if (req.url === '/links' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const newLink = JSON.parse(body);
        fs.readFile(path.join(__dirname, 'links.json'), (err, data) => {
          let links = [];
          if (!err && data) {
            links = JSON.parse(data);
          }
          links.push(newLink);
          fs.writeFile(
            path.join(__dirname, 'links.json'),
            JSON.stringify(links, null, 2),
            (err) => {
              if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Erro ao salvar link' }));
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              }
            }
          );
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Dados inválidos', details: e.message }));
      }
    });
  } else if (req.url === '/links' && req.method === 'DELETE') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { url } = JSON.parse(body);
        fs.readFile(path.join(__dirname, 'links.json'), (err, data) => {
          let links = [];
          if (!err && data) {
            links = JSON.parse(data);
          }
          const filtered = links.filter((link) => link.url !== url);
          fs.writeFile(
            path.join(__dirname, 'links.json'),
            JSON.stringify(filtered, null, 2),
            (err) => {
              if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Erro ao apagar link' }));
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              }
            }
          );
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Dados inválidos', details: e.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Página não encontrada');
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
