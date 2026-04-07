// Pure study-session helpers used by services and tests.
const {
  DEFAULT_STUDY_DIFFICULTY,
  FRAMEWORK_KEYWORDS,
  LANGUAGE_KEYWORDS,
  STUDY_DIFFICULTIES,
} = require('../config/constants');

const createEmptyStudyState = () => ({
  prompt: '',
  difficulty: DEFAULT_STUDY_DIFFICULTY,
  updatedAt: null,
  lesson: null,
  completionCount: 0,
});

const normalizeStudyDifficulty = (difficulty) => {
  if (typeof difficulty !== 'string') {
    return DEFAULT_STUDY_DIFFICULTY;
  }

  const normalized = difficulty.trim().toLowerCase();
  return STUDY_DIFFICULTIES.includes(normalized) ? normalized : DEFAULT_STUDY_DIFFICULTY;
};

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
      : null,
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
    generatedAt: lesson.generatedAt || null,
  };
};

const normalizeStudyState = (parsed) => {
  const baseState = createEmptyStudyState();
  if (!parsed || typeof parsed !== 'object') {
    return baseState;
  }

  return {
    prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
    difficulty: normalizeStudyDifficulty(parsed.difficulty),
    updatedAt: parsed.updatedAt || null,
    lesson: normalizeLesson(parsed.lesson),
    completionCount: Number.isInteger(parsed.completionCount) ? parsed.completionCount : 0,
  };
};

const buildSessionPayload = (studyState) => {
  const lesson = studyState.lesson;
  const totalQuestions = lesson?.questions.length || 0;
  const correctCount = lesson?.correctCount || 0;

  return {
    prompt: studyState.prompt,
    difficulty: normalizeStudyDifficulty(studyState.difficulty),
    updatedAt: studyState.updatedAt,
    explanation: lesson?.explanation || '',
    generatedAt: lesson?.generatedAt || null,
    questions: (lesson?.questions || []).map((question) => ({
      id: question.id,
      question: question.question,
      options: question.options,
      solved: question.solved,
      selectedOptionIndex: question.selectedOptionIndex,
    })),
    progress: {
      correctCount,
      totalQuestions,
      completed: Boolean(lesson?.completed),
    },
    completionCount: studyState.completionCount || 0,
  };
};

const extractJsonFromModel = (content) => {
  const trimmed = content.trim();

  // 1. Try fenced code block first
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  // 2. Try to extract the outermost JSON object { ... }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
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
      selectedOptionIndex: null,
    };
  });
};

const validateQueueOrder = (orderedIds, queue) => {
  if (!Array.isArray(orderedIds)) {
    return false;
  }

  const queueIds = queue.map((item) => item.id);
  if (queueIds.length !== orderedIds.length) {
    return false;
  }

  const queueSet = new Set(queueIds);
  const orderedSet = new Set(orderedIds);
  if (queueSet.size !== orderedSet.size) {
    return false;
  }

  for (const id of orderedIds) {
    if (!Number.isInteger(id) || !queueSet.has(id)) {
      return false;
    }
  }

  return true;
};

const classifyStudyPrompt = (prompt) => {
  if (typeof prompt !== 'string') {
    return 'other';
  }

  const normalized = prompt.toLowerCase();
  const hasFramework = FRAMEWORK_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const hasLanguage = LANGUAGE_KEYWORDS.some((keyword) => normalized.includes(keyword));

  if (hasFramework && !hasLanguage) {
    return 'framework';
  }

  if (hasLanguage && !hasFramework) {
    return 'language';
  }

  return 'other';
};

const interleaveLanguageAndFramework = (orderedIds, queue) => {
  const queueMap = new Map(queue.map((item) => [item.id, item]));
  const languageIds = [];
  const frameworkIds = [];
  const otherIds = [];

  orderedIds.forEach((id) => {
    const queueItem = queueMap.get(id);
    const type = classifyStudyPrompt(queueItem?.prompt);

    if (type === 'language') {
      languageIds.push(id);
      return;
    }

    if (type === 'framework') {
      frameworkIds.push(id);
      return;
    }

    otherIds.push(id);
  });

  if (!languageIds.length || !frameworkIds.length) {
    return orderedIds;
  }

  const interleaved = [];
  const firstTypedIndex = orderedIds.findIndex((id) => {
    const queueItem = queueMap.get(id);
    const type = classifyStudyPrompt(queueItem?.prompt);
    return type === 'language' || type === 'framework';
  });

  let nextType =
    firstTypedIndex >= 0
      ? classifyStudyPrompt(queueMap.get(orderedIds[firstTypedIndex])?.prompt)
      : 'language';

  while (languageIds.length || frameworkIds.length) {
    if (nextType === 'language') {
      if (languageIds.length) {
        interleaved.push(languageIds.shift());
      } else {
        interleaved.push(frameworkIds.shift());
      }
      nextType = 'framework';
      continue;
    }

    if (frameworkIds.length) {
      interleaved.push(frameworkIds.shift());
    } else {
      interleaved.push(languageIds.shift());
    }
    nextType = 'language';
  }

  return [...interleaved, ...otherIds];
};

module.exports = {
  createEmptyStudyState,
  normalizeQuestion,
  countCorrectAnswers,
  normalizeLesson,
  normalizeStudyState,
  buildSessionPayload,
  extractJsonFromModel,
  validateGeneratedQuestions,
  validateQueueOrder,
  classifyStudyPrompt,
  interleaveLanguageAndFramework,
  normalizeStudyDifficulty,
};
