import { IndexerHttpClient } from '../../helpers/silent-payments/IndexerHttpClient';
import TorManager from '../../blue_modules/torManager';
import { socks5Fetch } from '../../blue_modules/socks5Fetch';
import { fetchWithRetries } from '../../util/fetch';

jest.mock('../../blue_modules/torManager', () => ({
  __esModule: true,
  default: { getInstance: jest.fn() },
  DEFAULT_SOCKS_HOST: '127.0.0.1',
}));
jest.mock('../../blue_modules/socks5Fetch', () => ({
  __esModule: true,
  socks5Fetch: jest.fn(),
}));
jest.mock('../../util/fetch', () => ({
  __esModule: true,
  fetchWithRetries: jest.fn(),
}));

const torManagerGetInstance = TorManager.getInstance as jest.Mock;
const mockedSocks5Fetch = socks5Fetch as jest.Mock;
const mockedFetchWithRetries = fetchWithRetries as jest.Mock;

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

const torState = (overrides: Partial<{ enabled: boolean; isReady: boolean; isTorOnly: boolean; socksPort: number }> = {}) => ({
  settings: { enabled: overrides.enabled ?? true },
  isReady: overrides.isReady ?? true,
  isTorOnly: overrides.isTorOnly ?? false,
  socksPort: overrides.socksPort ?? 9050,
  markUnavailable: jest.fn(),
});

describe('IndexerHttpClient routing', () => {
  const baseUrl = 'https://indexer.example';
  const onionUrl = 'http://indexer.onion';
  const endpoint = '/silent-block/latest-height';
  const errCtx = 'Error fetching latest block height';

  beforeEach(() => {
    jest.useFakeTimers();
    mockedSocks5Fetch.mockReset();
    mockedFetchWithRetries.mockReset();
    torManagerGetInstance.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses Tor path when enabled + ready + onionUrl set', async () => {
    torManagerGetInstance.mockReturnValue(torState());
    mockedSocks5Fetch.mockResolvedValue(okResponse({ height: 900000 }));

    const client = new IndexerHttpClient(baseUrl, 30000, onionUrl);
    const result = await client.get<{ height: number }>(endpoint, errCtx);

    expect(result).toEqual({ height: 900000 });
    expect(mockedSocks5Fetch).toHaveBeenCalledTimes(1);
    expect(mockedSocks5Fetch).toHaveBeenCalledWith(
      `${onionUrl}${endpoint}`,
      expect.objectContaining({ socksHost: '127.0.0.1', socksPort: 9050 }),
    );
    expect(mockedFetchWithRetries).not.toHaveBeenCalled();
  });

  it('falls back to clearnet after all Tor retries fail', async () => {
    torManagerGetInstance.mockReturnValue(torState());
    mockedSocks5Fetch.mockRejectedValue(new Error('SOCKS5 timeout'));
    mockedFetchWithRetries.mockResolvedValue(okResponse({ height: 900001 }));

    const client = new IndexerHttpClient(baseUrl, 30000, onionUrl);
    const promise = client.get<{ height: number }>(endpoint, errCtx);
    // Backoff waits 1s between attempts 1→2, 2s between 2→3; advance through both.
    await jest.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result).toEqual({ height: 900001 });
    expect(mockedSocks5Fetch).toHaveBeenCalledTimes(3);
    expect(mockedFetchWithRetries).toHaveBeenCalledTimes(1);
    expect(mockedFetchWithRetries).toHaveBeenCalledWith(`${baseUrl}${endpoint}`, expect.any(Object));
  });

  it('throws without clearnet fallback when tor-only and all Tor retries fail', async () => {
    torManagerGetInstance.mockReturnValue(torState({ isTorOnly: true }));
    mockedSocks5Fetch.mockRejectedValue(new Error('SOCKS5 timeout'));

    const client = new IndexerHttpClient(baseUrl, 30000, onionUrl);
    const caught = client.get(endpoint, errCtx).catch(e => e);
    await jest.advanceTimersByTimeAsync(3000);
    const err = await caught;

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/Tor-only mode is enabled but Tor is unavailable/);
    expect(mockedSocks5Fetch).toHaveBeenCalledTimes(3);
    expect(mockedFetchWithRetries).not.toHaveBeenCalled();
  });

  it('skips Tor retry loop and goes to clearnet when proxy is not ready', async () => {
    torManagerGetInstance.mockReturnValue(torState({ isReady: false }));
    mockedFetchWithRetries.mockResolvedValue(okResponse({ height: 900002 }));

    const client = new IndexerHttpClient(baseUrl, 30000, onionUrl);
    const result = await client.get<{ height: number }>(endpoint, errCtx);

    expect(result).toEqual({ height: 900002 });
    expect(mockedSocks5Fetch).not.toHaveBeenCalled();
    expect(mockedFetchWithRetries).toHaveBeenCalledTimes(1);
  });

  it('throws when tor-only but no onion URL is configured', async () => {
    torManagerGetInstance.mockReturnValue(torState({ isTorOnly: true }));

    const client = new IndexerHttpClient(baseUrl, 30000); // no onion URL
    await expect(client.get(endpoint, errCtx)).rejects.toThrow(/Tor-only mode is enabled but no \.onion URL is configured/);
    expect(mockedSocks5Fetch).not.toHaveBeenCalled();
    expect(mockedFetchWithRetries).not.toHaveBeenCalled();
  });

  it('goes straight to clearnet when Tor is disabled', async () => {
    torManagerGetInstance.mockReturnValue(torState({ enabled: false, isReady: false }));
    mockedFetchWithRetries.mockResolvedValue(okResponse({ height: 900003 }));

    const client = new IndexerHttpClient(baseUrl, 30000, onionUrl);
    const result = await client.get<{ height: number }>(endpoint, errCtx);

    expect(result).toEqual({ height: 900003 });
    expect(mockedSocks5Fetch).not.toHaveBeenCalled();
    expect(mockedFetchWithRetries).toHaveBeenCalledTimes(1);
  });

  it('propagates HTTP status errors from onion without retry, markUnavailable, or clearnet fallback', async () => {
    const state = torState();
    torManagerGetInstance.mockReturnValue(state);
    mockedSocks5Fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const client = new IndexerHttpClient(baseUrl, 30000, onionUrl);
    await expect(client.get(endpoint, errCtx)).rejects.toThrow(/HTTP error! status: 500/);

    expect(mockedSocks5Fetch).toHaveBeenCalledTimes(1);
    expect(state.markUnavailable).not.toHaveBeenCalled();
    expect(mockedFetchWithRetries).not.toHaveBeenCalled();
  });

  it('marks Tor unavailable after exhausting retries so subsequent calls skip the loop', async () => {
    const state = torState();
    torManagerGetInstance.mockReturnValue(state);
    mockedSocks5Fetch.mockRejectedValue(new Error('SOCKS5 timeout'));
    mockedFetchWithRetries.mockResolvedValue(okResponse({ height: 900004 }));

    const client = new IndexerHttpClient(baseUrl, 30000, onionUrl);
    const promise = client.get<{ height: number }>(endpoint, errCtx);
    await jest.advanceTimersByTimeAsync(3000);
    await promise;

    expect(state.markUnavailable).toHaveBeenCalledTimes(1);
  });
});
