# LinkSavedgit

## Como usar com Docker

1. Instale o Docker e o Docker Compose.
2. No diretório do projeto, execute:

```
docker compose up --build -d
```

3. Acesse http://localhost:8000 no navegador.

## Visualizando a estrutura do projeto

Para ver a estrutura de arquivos, execute:

```
tree
```

Isso mostrará todos os arquivos e pastas do projeto.

## Como rodar

### Via Node.js

1. Instale o Node.js se ainda não tiver.
2. Execute:

```
npm start
```

Acesse http://localhost:3000 no navegador.

### Via Docker Compose (recomendado para produção)

1. Instale o Docker e o Docker Compose.
2. Execute:

```
docker compose up --build -d
```

Acesse http://localhost:3000 no navegador.

## Estrutura

- package.json
- server.js
- index.html
- links.json
- Dockerfile
- docker-compose.yml

Pronto para adicionar novas dependências via npm ou rodar de forma otimizada com Docker.
