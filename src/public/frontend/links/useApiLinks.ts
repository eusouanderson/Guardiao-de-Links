// API composable dedicated to links endpoints.
import { useApiClient } from '../shared/http/useApiClient';
import type { LinkItem } from './interfaces';

export const useApiLinks = () => {
  const { requestJson } = useApiClient();

  const fetchLinks = async (): Promise<LinkItem[]> => {
    const payload = await requestJson<LinkItem[]>('/links');
    return Array.isArray(payload) ? payload : [];
  };

  const postLink = async (payload: LinkItem): Promise<void> => {
    await requestJson('/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const deleteLink = async (url: string): Promise<void> => {
    await requestJson('/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  };

  return { fetchLinks, postLink, deleteLink };
};
