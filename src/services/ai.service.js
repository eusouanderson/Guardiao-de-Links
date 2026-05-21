// AI service encapsulates Groq API interactions and payload validation.
const { DEFAULT_GROQ_MODEL, GROQ_API_URL } = require('../config/constants');
const { getGroqApiKey } = require('../config/env');
const {
  extractJsonFromModel,
  interleaveLanguageAndFramework,
  validateGeneratedQuestions,
  validateQueueOrder,
} = require('../utils/study.utils');

const sanitizeMentorResponse = (content) =>
  content.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const createAiService = ({ fetchImpl = fetch, groqModel = DEFAULT_GROQ_MODEL } = {}) => {
  const generateStudyLesson = async ({ themePrompt, difficulty }) => {
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
              'RESPEITE ESSA ESPECIFICAÇÃO: Você é um tutor didático em português do Brasil. Responda apenas com JSON válido, sem markdown. Estrutura: {"explanation":"texto","questions":[{"question":"texto","options":["opcao 1","opcao 2","opcao 3","opcao 4"],"correctOptionIndex":0}]}. Gere exatamente 10 perguntas objetivas de múltipla escolha com 4 opções cada e índice correto entre 0 e 3. Respeite o nível de dificuldade solicitado pelo usuário.',
          },
          {
            role: 'user',
            content: `Explique o seguinte tema e crie 10 perguntas objetivas sobre ele no nível de dificuldade ${difficulty}: ${themePrompt}`,
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
    } catch (err) {
      const preview = content.slice(0, 200).replace(/\n/g, ' ');
      throw new Error(`A IA retornou um formato inválido para o estudo. Preview: "${preview}"`);
    }

    const explanation =
      typeof parsedContent.explanation === 'string' ? parsedContent.explanation : '';
    if (!explanation.trim()) {
      throw new Error('A IA não retornou uma explicação válida.');
    }

    const questions = validateGeneratedQuestions(parsedContent.questions);
    return {
      promptSnapshot: themePrompt,
      difficulty,
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

  const MENTOR_SYSTEM_PROMPT = `Você é um sistema educacional baseado no método de Paulo Freire, combinado com aprendizagem ativa e ciclos repetitivos de fixação.

Seu objetivo é ensinar qualquer tema de forma contextual, crítica e progressiva, usando perguntas e repetição até o domínio completo.

## 📌 REGRAS GERAIS

1. NUNCA ensine de forma passiva.
2. Sempre parta da realidade do aluno (contexto prático).
3. Use linguagem simples, direta e progressiva.
4. Ensine através de PERGUNTAS, não explicações longas.
5. Estimule raciocínio, não memorização cega.
6. Reforce erros até o aluno acertar naturalmente.

---

## 🧩 ESTRUTURA DO ESTUDO

### 1. Tema Gerador

Ao iniciar, defina um tema central baseado no objetivo do usuário.

Exemplo:
"Event Loop", "Promises", "Reatividade no Vue", etc.

---

### 2. Palavras Geradoras

Extraia de 3 a 5 conceitos-chave do tema.

Exemplo:

* callback
* fila
* microtask
* async
* stack

---

### 3. Ciclo de Aprendizagem (10 perguntas por ciclo)

Para cada ciclo:

* Gere EXATAMENTE 10 perguntas
* Misture níveis:

  * 4 fáceis
  * 4 médias
  * 2 difíceis

Tipos de perguntas:

* múltipla escolha
* completar código
* verdadeiro/falso
* cenário prático

---

## 🔁 LÓGICA DE REPETIÇÃO (ESSENCIAL)

* O ciclo só termina quando o usuário acertar 10/10
* Perguntas erradas DEVEM voltar nos próximos ciclos
* Reformule a pergunta quando repetir (não idêntica)
* Aumente a dificuldade gradualmente

---

## 🧠 APRENDIZADO ATIVO (ESTILO FREIRE)

Após cada resposta:

Se acertar:

* Reforce brevemente o porquê (1–2 linhas)

Se errar:

* NÃO dê a resposta direta imediatamente
* Faça uma pergunta guia para levar ao raciocínio
* Se errar novamente, explique de forma simples

---

## 🔄 CONTEXTO REAL

Sempre conecte com situações reais, como:

* código JavaScript
* problemas do dia a dia de dev
* bugs comuns
* comportamento do navegador

---

## 📊 CONTROLE DE PROGRESSO

Sempre retornar no formato:

Pergunta X/10
Ciclo atual: Y

Perguntas certas: A/10
Ciclos concluídos: B

---

## ⚠️ REGRAS IMPORTANTES

* Nunca avance de tema sem 100% de acerto
* Nunca repita perguntas exatamente iguais
* Nunca explique demais antes do erro
* Priorize aprendizado por tentativa

---

## 🎯 OBJETIVO FINAL

Levar o aluno a:

* Entender profundamente
* Conseguir explicar o conceito
* Aplicar na prática (código real)

---

## FORMATO DE SAÍDA

Use markdown para formatar suas respostas:
- **negrito** para termos importantes
- \`código inline\` para nomes de funções, variáveis e snippets curtos
- Blocos de código cercados por três crases para exemplos maiores
- Listas com - para enumerações
- Títulos com ## para seções quando necessário

## 🚀 INÍCIO

Pergunte primeiro:

"Qual tema você quer aprender e em qual nível você se considera (iniciante, intermediário, avançado)?"

Depois inicie o ciclo 1.`;

  const generateMentorResponse = async ({ messages }) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      throw new Error('GROQ_API_KEY não foi configurada no .env');
    }

    const safeMessages = messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({
        role: m.role,
        content:
          m.content === '__init__'
            ? 'Inicie apresentando sua pergunta inicial ao aluno.'
            : m.content.slice(0, 8000),
      }));

    const response = await fetchImpl(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.7,
        messages: [{ role: 'system', content: MENTOR_SYSTEM_PROMPT }, ...safeMessages],
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message || 'Falha ao consultar a API do Groq';
      throw new Error(message);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('A IA não retornou conteúdo.');
    }

    return sanitizeMentorResponse(content);
  };

  const buildSafeMessages = (messages) =>
    messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({
        role: m.role,
        content:
          m.content === '__init__'
            ? 'Inicie apresentando sua pergunta inicial ao aluno.'
            : m.content.slice(0, 8000),
      }));

  async function* generateMentorResponseStream({ messages }) {
    const apiKey = getGroqApiKey();
    if (!apiKey) throw new Error('GROQ_API_KEY não foi configurada no .env');

    const response = await fetchImpl(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.7,
        stream: true,
        messages: [{ role: 'system', content: MENTOR_SYSTEM_PROMPT }, ...buildSafeMessages(messages)],
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error?.message || 'Falha ao consultar a API do Groq');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const chunk = JSON.parse(data);
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {}
      }
    }
  }

  return {
    generateStudyLesson,
    organizeQueueWithAi,
    generateMentorResponse,
    generateMentorResponseStream,
  };
};

module.exports = {
  createAiService,
};
