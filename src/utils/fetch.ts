const DEFAULT_TIMEOUT = 10000; // default timeout in ms

// protection against calling itself recursively
const nativeFetch = globalThis.fetch.bind(globalThis);

export function fetch(input: RequestInfo | URL, init: RequestInit & { timeout?: number } = {}): Promise<Response> {
  if (__DEV__) {
    console.log('fetch wrapper: ', input, init);
  }
  const { timeout = DEFAULT_TIMEOUT, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return nativeFetch(input, { ...rest, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function fetchWithRetries(
  input: RequestInfo | URL,
  init: RequestInit & { timeout?: number } = {},
  retries: number = 3,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (retries === 0) {
      throw error;
    }
    return fetchWithRetries(input, init, retries - 1);
  }
}
