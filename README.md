# LinkSaved

Aplicação Node.js simples para salvar links e consultar uma área de estudos com IA.

## Como rodar

### Via Node.js

1. Instale as dependências:

```bash
npm install
```

2. Inicie em desenvolvimento:

```bash
npm run dev
```

3. Ou inicie em modo normal:

```bash
npm start
```

4. Acesse http://localhost:8000 no navegador.

### Via Docker Compose

1. Execute:

```bash
docker compose up --build -d
```

2. Acesse http://localhost:8000 no navegador.

## Estrutura do projeto

```text
.
├── src
│   ├── data
│   │   ├── links.json
│   │   └── study-theme.json
│   ├── public
│   │   ├── estudos.html
│   │   ├── link-da-web.png
│   │   └── links.html
│   └── server.js
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## Observações

- A chave da API do Groq deve estar no .env.
- O servidor principal agora fica em src/server.js.
- Os arquivos estáticos ficam em src/public.
- Os dados persistidos ficam em src/data.
