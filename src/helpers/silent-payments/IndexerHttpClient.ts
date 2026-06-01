import { fetchWithRetries } from '../../utils/fetch';

export class IndexerHttpClient {
  constructor(
    private baseUrl: string,
    private timeout: number = 30000,
  ) {}

  private async executeGet<T>(endpoint: string, errorContext: string): Promise<T> {
    try {
      const response = await fetchWithRetries(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`${errorContext}:`, error);
      throw new Error(`${errorContext}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async get<T>(endpoint: string, errorContext: string): Promise<T> {
    return this.executeGet<T>(endpoint, errorContext);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }
}
