// Feature composable for studies status/queue read operations.
import { ref } from 'vue';
import type { StudyQueueItem, StudyStatus, UseStudiesState } from './interfaces';
import { useApiStudies } from './useApiStudies';

export const useStudies = (): UseStudiesState => {
  const status = ref<StudyStatus | null>(null);
  const queue = ref<StudyQueueItem[]>([]);
  const { fetchStatus, fetchQueue } = useApiStudies();

  const loadStatus = async () => {
    status.value = await fetchStatus();
  };

  const loadQueue = async () => {
    queue.value = await fetchQueue();
  };

  return { status, queue, loadStatus, loadQueue };
};
