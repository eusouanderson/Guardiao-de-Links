// API composable dedicated to history endpoints.
import { useApiClient } from '../shared/http/useApiClient';
import type { StudyHistoryItem } from './interfaces';

export const useApiHistory = () => {
  const { requestJson } = useApiClient();

  const fetchStudyHistory = async (): Promise<StudyHistoryItem[]> => {
    const payload = await requestJson<StudyHistoryItem[]>('/study-history');
    return Array.isArray(payload) ? payload : [];
  };

  return {
    fetchStudyHistory,
  };
};
