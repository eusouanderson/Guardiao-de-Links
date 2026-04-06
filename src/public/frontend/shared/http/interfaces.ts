// HTTP contracts shared by feature-level API composables.
export interface ApiErrorPayload {
  error?: string;
  details?: string;
}

export interface ApiClient {
  requestJson: <TResponse>(input: RequestInfo, init?: RequestInit) => Promise<TResponse>;
}
