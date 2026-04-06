// Runtime shared API client used by browser modules.
export const useApiClient = () => {
  const requestJson = async (input, init) => {
    const response = await fetch(input, init);
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || body.details || 'Falha de comunicacao com a API.');
    }

    return body;
  };

  return { requestJson };
};
