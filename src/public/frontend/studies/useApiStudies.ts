// API composable dedicated to studies endpoints.
import { useApiClient } from '../shared/http/useApiClient';
import type { StudyQueueItem, StudyStatus } from './interfaces';

export const useApiStudies = () => {
  const { requestJson } = useApiClient();

  const fetchStatus = () => requestJson<StudyStatus>('/study-status');
  const fetchQueue = async () => {
    const payload = await requestJson<StudyQueueItem[]>('/study-queue');
    return Array.isArray(payload) ? payload : [];
  };

  return {
    fetchStatus,
    fetchQueue,
  };
};
