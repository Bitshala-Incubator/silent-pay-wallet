import { fetchWithRetries } from '../../util/fetch';
import { socks5Fetch } from '../../blue_modules/socks5Fetch';
import TorManager from '../../blue_modules/torManager';

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

    // Try Tor/onion route first when available
    if (torManager.settings.enabled && this.onionUrl) {
      const retryAttempts = torManager.retryAttempts;

      for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        if (torManager.isReady) {
          try {
            const response = await socks5Fetch(`${this.onionUrl}${endpoint}`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              timeout: this.timeout,
              socksHost: torManager.socksHost,
              socksPort: torManager.socksPort,
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
          } catch (torError) {
            const message = torError instanceof Error ? torError.message : String(torError);
            console.warn(
              `[IndexerHttpClient] Tor attempt ${attempt}/${retryAttempts} failed: ${message}`,
            );

            // Exponential backoff between retries
            if (attempt < retryAttempts) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
              await new Promise(resolve => setTimeout(resolve, delay));
              // Re-check connection before next attempt
              await torManager.checkConnection();
            }
          }
        } else if (attempt < retryAttempts) {
          // Tor not ready yet — wait and re-check
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          await new Promise(resolve => setTimeout(resolve, delay));
          await torManager.checkConnection();
        }
      }

      // All Tor attempts exhausted
      if (torManager.isTorOnly) {
        throw new Error(
          `${errorContext}: Tor-only mode is enabled but all ${retryAttempts} Tor attempts failed. ` +
          'Clearnet fallback is blocked. Ensure Orbot is running.',
        );
      }

      console.warn('[IndexerHttpClient] Tor exhausted, falling back to clearnet');
    } else if (torManager.isTorOnly) {
      // Tor enabled in tor-only mode but no onion URL configured
      throw new Error(
        `${errorContext}: Tor-only mode is enabled but no .onion URL is configured. ` +
        'Set an onion URL or disable Tor-only mode.',
      );
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
