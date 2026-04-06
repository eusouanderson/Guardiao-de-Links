# LinkSaved

Aplicação Node.js minimalista para salvar links e estudar temas com apoio de IA.

## Como rodar

1. Instale dependências:

```bash
npm install
```

2. Rode em desenvolvimento:

```bash
npm run dev
```

3. Rode em modo normal:

```bash
npm start
```

4. Acesse http://localhost:8000.

## Testes

```bash
npm test
```

## Nova arquitetura

```text
src/
	config/
		constants.js
		env.js
	controllers/
		links.controller.js
		links.controller.test.js
		static.controller.js
		study.controller.js
	database/
		db.js
		db.test.js
	repositories/
		links.repository.js
		links.repository.test.js
		study.repository.js
		study.repository.test.js
	routes/
		index.js
		links.routes.js
		links.routes.test.js
		static.routes.js
		study.routes.js
		study.routes.test.js
	server/
		bootstrap.js
		index.js
		index.test.js
	services/
		ai.service.js
		links.service.js
		links.service.test.js
		study.service.js
		study.service.test.js
	utils/
		http.utils.js
		study.utils.js
		study.utils.test.js
	data/
	public/
	db.js
	server.js
```

## Decisões de refatoração

- A camada HTTP foi separada em `routes` e `controllers`.
- Regras de negócio ficaram em `services`.
- SQL e persistência ficaram centralizados em `database` e `repositories`.
- Acesso a variáveis de ambiente foi isolado em `config/env.js`.
- Funções puras foram movidas para `utils/study.utils.js` e continuam exportadas por `src/server.js` para compatibilidade.
- Os arquivos `src/server.js` e `src/db.js` foram mantidos como wrappers compatíveis para não quebrar integrações existentes.

## Observações

- Defina `GROQ_API_KEY` no `.env` para funcionalidades de IA.
- O projeto continua sem frameworks pesados e sem ORM.
