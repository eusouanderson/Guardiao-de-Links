// Runtime API composable dedicated to history endpoints.
import { useApiClient } from '../shared/http/useApiClient.js';

export const useApiHistory = () => {
  const { requestJson } = useApiClient();

  const fetchStudyHistory = async () => {
    const payload = await requestJson('/study-history');
    return Array.isArray(payload) ? payload : [];
  };

  return { fetchStudyHistory };
};
