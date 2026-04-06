// Shared API client composable that normalizes JSON request/response handling.
import type { ApiClient, ApiErrorPayload } from './interfaces';

export const useApiClient = (): ApiClient => {
  const requestJson = async <TResponse>(
    input: RequestInfo,
    init?: RequestInit
  ): Promise<TResponse> => {
    const response = await fetch(input, init);
    const body = (await response.json().catch(() => ({}))) as TResponse | ApiErrorPayload;

    if (!response.ok) {
      const payload = body as ApiErrorPayload;
      throw new Error(payload.error || payload.details || 'Falha de comunicação com a API.');
    }

    return body as TResponse;
  };

  return { requestJson };
};
