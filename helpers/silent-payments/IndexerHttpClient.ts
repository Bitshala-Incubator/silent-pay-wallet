import { fetchWithRetries } from '../../util/fetch';
import { socks5Fetch } from '../../blue_modules/socks5Fetch';
import TorManager, { DEFAULT_SOCKS_HOST } from '../../blue_modules/torManager';

const RETRY_ATTEMPTS = 3;

export class IndexerHttpClient {
  private onionUrl?: string;

  constructor(
    private baseUrl: string,
    private timeout: number = 30000,
    onionUrl?: string,
  ) {
    this.onionUrl = onionUrl?.replace(/\/$/, '');
  }

  private async executeGet<T>(endpoint: string, errorContext: string): Promise<T> {
    const torManager = TorManager.getInstance();

    if (torManager.settings.enabled && this.onionUrl && torManager.isReady) {
      for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        let response;
        try {
          response = await socks5Fetch(`${this.onionUrl}${endpoint}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: this.timeout,
            socksHost: DEFAULT_SOCKS_HOST,
            socksPort: torManager.socksPort,
          });
        } catch (torError) {
          const message = torError instanceof Error ? torError.message : String(torError);
          console.warn(`[IndexerHttpClient] Tor attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${message}`);

          if (attempt < RETRY_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          continue;
        }

        if (!response.ok) {
          throw new Error(`${errorContext}: HTTP error! status: ${response.status}`);
        }
        try {
          return (await response.json()) as T;
        } catch (parseError) {
          const message = parseError instanceof Error ? parseError.message : String(parseError);
          console.warn(`[IndexerHttpClient] Tor attempt ${attempt}/${RETRY_ATTEMPTS} JSON parse failed: ${message}`);
          if (attempt < RETRY_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          continue;
        }
      }

      torManager.markUnavailable();
    }

    if (torManager.isTorOnly) {
      throw new Error(
        this.onionUrl
          ? `${errorContext}: Tor-only mode is enabled but Tor is unavailable. ` + 'Clearnet fallback is blocked. Ensure Orbot is running.'
          : `${errorContext}: Tor-only mode is enabled but no .onion URL is configured. ` + 'Set an onion URL or disable Tor-only mode.',
      );
    }

    if (torManager.settings.enabled && this.onionUrl) {
      console.warn('[IndexerHttpClient] Tor unavailable, falling back to clearnet');
    }

    // Clearnet fallback
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

  getOnionUrl(): string | undefined {
    return this.onionUrl;
  }

  setOnionUrl(url: string | undefined): void {
    this.onionUrl = url?.replace(/\/$/, '');
  }
}
