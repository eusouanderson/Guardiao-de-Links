// Runtime feature-level composable for history state and loading lifecycle.
import { computed, ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { useDateFormatter } from '../shared/formatters/useDateFormatter.js';
import { useApiHistory } from './useApiHistory.js';

export const useHistory = () => {
  const history = ref([]);
  const isLoading = ref(false);
  const errorMessage = ref('');

  const { fetchStudyHistory } = useApiHistory();
  const { formatDate } = useDateFormatter();

  const stats = computed(() => {
    const totalCycles = history.value.length;
    const totalThemes = new Set(history.value.map((item) => item.promptSnapshot)).size;
    const lastCompletion = totalCycles ? formatDate(history.value[0]?.completedAt) : '-';

    return {
      totalCycles,
      totalThemes,
      lastCompletion,
    };
  });

  const loadHistory = async () => {
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
