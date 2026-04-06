// Feature-level composable for history state, computed stats, and loading flow.
import { computed, ref } from 'vue';
import { useDateFormatter } from '../shared/formatters/useDateFormatter';
import type { HistoryStats, StudyHistoryItem, UseHistoryState } from './interfaces';
import { useApiHistory } from './useApiHistory';

export const useHistory = (): UseHistoryState => {
  const history = ref<StudyHistoryItem[]>([]);
  const isLoading = ref(false);
  const errorMessage = ref('');

  const { fetchStudyHistory } = useApiHistory();
  const { formatDate } = useDateFormatter();

  const stats = computed<HistoryStats>(() => {
    const totalCycles = history.value.length;
    const totalThemes = new Set(history.value.map((item) => item.promptSnapshot)).size;
    const lastCompletion = totalCycles ? formatDate(history.value[0]?.completedAt) : '-';

    return {
      totalCycles,
      totalThemes,
      lastCompletion,
    };
  });

  const loadHistory = async (): Promise<void> => {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      history.value = await fetchStudyHistory();
    } catch (error) {
      history.value = [];
      errorMessage.value = error instanceof Error ? error.message : 'Erro ao carregar historico.';
    } finally {
      isLoading.value = false;
    }
  };

  return {
    history,
    isLoading,
    errorMessage,
    stats,
    loadHistory,
  };
};
