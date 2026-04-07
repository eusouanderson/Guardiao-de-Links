// Study service orchestrates study session lifecycle and business rules.
const { REQUIRED_COMPLETION_COUNT } = require('../config/constants');
const {
  buildSessionPayload,
  countCorrectAnswers,
  normalizeStudyDifficulty,
  normalizeStudyState,
} = require('../utils/study.utils');

const createStudyService = ({
  studyRepository,
  aiService,
  requiredCompletionCount = REQUIRED_COMPLETION_COUNT,
}) => {
  const readStudyState = () => normalizeStudyState(studyRepository.readStudyState());

  const writeStudyState = (state) => {
    studyRepository.writeStudyState(state);
  };

  const getStudyStatus = (studyState) => {
    const lesson = studyState.lesson;
    const hasPrompt = Boolean(studyState.prompt);
    const totalQuestions = lesson?.questions.length || (hasPrompt ? 10 : 0);
    const correctCount = lesson?.correctCount || 0;
    const completionCount = studyState.completionCount || 0;
    const remainingCycles = Math.max(requiredCompletionCount - completionCount, 0);
    const pendingStudy =
      hasPrompt && (!lesson || !lesson.completed || lesson.promptSnapshot !== studyState.prompt);
    const canSaveNewTheme = !hasPrompt || completionCount >= requiredCompletionCount;

    return {
      hasPrompt,
      pendingStudy,
      canSaveNewTheme,
      prompt: studyState.prompt,
      difficulty: normalizeStudyDifficulty(studyState.difficulty),
      updatedAt: studyState.updatedAt,
      completionCount,
      requiredCompletionCount,
      remainingCycles,
      queueLength: studyRepository.listQueue().length,
      progress: {
        correctCount,
        totalQuestions,
        completed: Boolean(lesson?.completed),
      },
    };
  };

  const saveStudyTheme = ({ prompt, difficulty }) => {
    const currentState = readStudyState();
    const payload = {
      ...currentState,
      prompt,
      difficulty: normalizeStudyDifficulty(difficulty),
      updatedAt: new Date().toISOString(),
      lesson: null,
      completionCount: 0,
    };

    writeStudyState(payload);
    return payload;
  };

  const saveOrQueueTheme = ({ prompt, difficulty, force }) => {
    const currentState = readStudyState();
    const currentStatus = getStudyStatus(currentState);
    const normalizedDifficulty = normalizeStudyDifficulty(difficulty);

    if (force || currentStatus.canSaveNewTheme) {
      const saved = saveStudyTheme({ prompt, difficulty: normalizedDifficulty });
      return {
        statusCode: 200,
        payload: {
          success: true,
          activated: true,
          data: {
            prompt: saved.prompt,
            difficulty: saved.difficulty,
            updatedAt: saved.updatedAt,
            status: getStudyStatus(saved),
          },
        },
      };
    }

    studyRepository.enqueueStudy({ prompt, difficulty: normalizedDifficulty });
    const queue = studyRepository.listQueue();
    return {
      statusCode: 200,
      payload: {
        success: true,
        queued: true,
        position: queue.length,
        queue,
      },
    };
  };

  const ensureStudySession = async () => {
    const studyState = readStudyState();

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

    const lesson = await aiService.generateStudyLesson({
      themePrompt: studyState.prompt,
      difficulty: normalizeStudyDifficulty(studyState.difficulty),
    });
    const updatedState = {
      ...studyState,
      lesson,
    };

    writeStudyState(updatedState);
    return { studyState: updatedState, generated: true };
  };

  const submitAnswer = ({ questionId, optionIndex }) => {
    const studyState = readStudyState();
    if (!studyState.lesson || studyState.lesson.promptSnapshot !== studyState.prompt) {
      return { statusCode: 400, payload: { error: 'Nenhuma sessão de estudo ativa encontrada.' } };
    }

    const question = studyState.lesson.questions.find((item) => item.id === questionId);
    if (!question) {
      return { statusCode: 404, payload: { error: 'Pergunta não encontrada.' } };
    }

    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
      return { statusCode: 400, payload: { error: 'Resposta inválida.' } };
    }

    if (question.solved) {
      return {
        statusCode: 200,
        payload: {
          success: true,
          correct: true,
          alreadySolved: true,
          session: buildSessionPayload(studyState),
        },
      };
    }

    const correct = question.correctOptionIndex === optionIndex;
    question.selectedOptionIndex = optionIndex;
    if (correct) {
      question.solved = true;
    }

    studyState.lesson.correctCount = countCorrectAnswers(studyState.lesson.questions);
    const justCompleted =
      !studyState.lesson.completed &&
      studyState.lesson.correctCount === studyState.lesson.questions.length;

    studyState.lesson.completed =
      studyState.lesson.correctCount === studyState.lesson.questions.length;

    if (justCompleted) {
      studyState.completionCount = (studyState.completionCount || 0) + 1;
      studyRepository.addStudyHistory({
        promptSnapshot: studyState.lesson.promptSnapshot || studyState.prompt,
        explanation: studyState.lesson.explanation || '',
        cycleNumber: studyState.completionCount,
        totalQuestions: studyState.lesson.questions.length,
        correctCount: studyState.lesson.correctCount,
        completedAt: new Date().toISOString(),
      });
    }

    writeStudyState(studyState);

    let advanced = false;
    let nextPrompt = null;
    if (justCompleted && studyState.completionCount >= requiredCompletionCount) {
      const queueSnapshot = studyRepository.listQueue();
      const nextQueuedItem = queueSnapshot[0] || null;
      const dequeued = studyRepository.dequeueNextStudy();
      if (dequeued) {
        const nextPromptValue = typeof dequeued === 'string' ? dequeued : dequeued.prompt;
        const nextDifficultyValue =
          typeof dequeued === 'string'
            ? nextQueuedItem?.difficulty
            : dequeued.difficulty || nextQueuedItem?.difficulty;

        writeStudyState({
          prompt: nextPromptValue,
          difficulty: normalizeStudyDifficulty(nextDifficultyValue),
          updatedAt: new Date().toISOString(),
          lesson: null,
          completionCount: 0,
        });
        advanced = true;
        nextPrompt = nextPromptValue;
      }
    }

    return {
      statusCode: 200,
      payload: {
        success: true,
        correct,
        ...(advanced ? { advanced: true, nextPrompt } : {}),
        session: buildSessionPayload(studyState),
      },
    };
  };

  const organizeQueue = async () => {
    const queue = studyRepository.listQueue();
    if (queue.length < 2) {
      return {
        statusCode: 200,
        payload: {
          success: true,
          unchanged: true,
          message: 'A fila precisa de pelo menos 2 itens para ser reorganizada.',
          queue,
        },
      };
    }

    const currentState = readStudyState();
    const result = await aiService.organizeQueueWithAi(queue, currentState.prompt || '');
    studyRepository.reorderQueue(result.orderedIds);

    return {
      statusCode: 200,
      payload: {
        success: true,
        rationale: result.rationale,
        queue: studyRepository.listQueue(),
      },
    };
  };

  return {
    readStudyState,
    writeStudyState,
    getStudyStatus,
    saveOrQueueTheme,
    ensureStudySession,
    submitAnswer,
    listQueue: () => studyRepository.listQueue(),
    deleteFromQueue: (id) => studyRepository.deleteFromQueue(id),
    moveQueueItem: (id, direction) => studyRepository.moveQueueItem(id, direction),
    listStudyHistory: () => studyRepository.listStudyHistory(),
    organizeQueue,
  };
};

module.exports = {
  createStudyService,
};
