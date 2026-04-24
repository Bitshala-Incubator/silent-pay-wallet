import TcpSocket from 'react-native-tcp-socket';

const DEFAULT_SOCKS_HOST = '127.0.0.1';
const DEFAULT_SOCKS_PORT = 9050;
const DEFAULT_TIMEOUT = 30000;

interface Socks5FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  socksHost?: string;
  socksPort?: number;
}

interface Socks5Response {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

function parseUrl(url: string): { host: string; port: number; path: string } {
  if (url.startsWith('https://')) {
    throw new Error(
      'HTTPS URLs are not supported by socks5Fetch; use http:// (onion services are reached over plain HTTP through the Tor tunnel)',
    );
  }
  const match = url.match(/^http:\/\/([^/:]+)(?::(\d+))?(\/.*)?$/);
  if (!match) {
    throw new Error(`Invalid URL: ${url}`);
  }
  const host = match[1];
  const port = match[2] ? parseInt(match[2], 10) : 80;
  const path = match[3] || '/';
  return { host, port, path };
}

function decodeChunked(data: string): string {
  let result = '';
  let remaining = data;

  while (remaining.length > 0) {
    const lineEnd = remaining.indexOf('\r\n');
    if (lineEnd === -1) break;

    const chunkSizeStr = remaining.substring(0, lineEnd).trim();
    if (!chunkSizeStr) break;

    const chunkSize = parseInt(chunkSizeStr, 16);
    if (isNaN(chunkSize) || chunkSize === 0) break;

    const chunkStart = lineEnd + 2;
    const chunkData = remaining.substring(chunkStart, chunkStart + chunkSize);
    result += chunkData;
    remaining = remaining.substring(chunkStart + chunkSize + 2); // +2 for trailing \r\n
  }

  return result;
}

/**
 * Make an HTTP request through a SOCKS5 proxy (e.g., Orbot).
 * This enables connecting to .onion addresses via Tor.
 */
export function socks5Fetch(url: string, options: Socks5FetchOptions = {}): Promise<Socks5Response> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    socksHost = DEFAULT_SOCKS_HOST,
    socksPort = DEFAULT_SOCKS_PORT,
  } = options;

  const { host, port, path } = parseUrl(url);

  return new Promise((resolve, reject) => {
    let resolved = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const chunks: Buffer[] = [];

    const finish = (fn: () => void) => {
      if (resolved) return;
      resolved = true;
      if (timer) clearTimeout(timer);
      fn();
    };

    timer = setTimeout(() => {
      finish(() => {
        try {
          client.destroy();
        } catch {}
        reject(new Error(`SOCKS5 request timeout after ${timeout}ms`));
      });
    }, timeout);

    const client = TcpSocket.createConnection({ host: socksHost, port: socksPort }, () => {
      // Phase 1: SOCKS5 greeting - version 5, 1 auth method, no auth
      client.write(Buffer.from([0x05, 0x01, 0x00]));
    });

    let phase: 'greeting' | 'connect' | 'http' = 'greeting';
    let pending = Buffer.alloc(0);

    // Returns the full length of a SOCKS5 CONNECT reply in `buf`, or null if
    // more bytes are needed to determine it, or -1 if the address type is unknown.
    const getSocks5ConnectReplyLength = (buf: Buffer): number | null => {
      if (buf.length < 5) return null;
      const atyp = buf[3];
      if (atyp === 0x01) return 10; // IPv4: VER+REP+RSV+ATYP + 4 + PORT(2)
      if (atyp === 0x04) return 22; // IPv6: VER+REP+RSV+ATYP + 16 + PORT(2)
      if (atyp === 0x03) {
        const domainLength = buf[4];
        return buf.length >= 5 + domainLength + 2 ? 5 + domainLength + 2 : null;
      }
      return -1;
    };

    client.on('data', (data: string | Buffer) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      pending = pending.length ? Buffer.concat([pending, buf]) : buf;

      while (pending.length > 0) {
        if (phase === 'greeting') {
          if (pending.length < 2) return;

          // Verify SOCKS5 server accepted no-auth
          if (pending[0] !== 0x05 || pending[1] !== 0x00) {
            finish(() => {
              client.destroy();
              reject(new Error('SOCKS5 authentication negotiation failed'));
            });
            return;
          }
          pending = pending.subarray(2);

          // Phase 2: Send CONNECT request with domain name
          phase = 'connect';
          const domainBuf = Buffer.from(host, 'ascii');
          const req = Buffer.alloc(7 + domainBuf.length);
          req[0] = 0x05; // SOCKS version
          req[1] = 0x01; // CONNECT command
          req[2] = 0x00; // Reserved
          req[3] = 0x03; // Address type: domain name
          req[4] = domainBuf.length; // Domain length
          domainBuf.copy(req, 5);
          req.writeUInt16BE(port, 5 + domainBuf.length); // Port
          client.write(req);
        } else if (phase === 'connect') {
          const replyLength = getSocks5ConnectReplyLength(pending);
          if (replyLength === null) return;

          if (replyLength < 0 || pending[0] !== 0x05 || pending[1] !== 0x00) {
            const errorCode = pending.length >= 2 ? pending[1] : -1;
            finish(() => {
              client.destroy();
              reject(new Error(`SOCKS5 CONNECT failed (code: ${errorCode})`));
            });
            return;
          }
          pending = pending.subarray(replyLength);

          // Phase 3: Tunnel established - send HTTP request
          phase = 'http';
          const requestHeaders: Record<string, string> = {
            Host: host,
            Connection: 'close',
            Accept: 'application/json',
            ...headers,
          };

          let httpRequest = `${method} ${path} HTTP/1.1\r\n`;
          for (const [key, value] of Object.entries(requestHeaders)) {
            httpRequest += `${key}: ${value}\r\n`;
          }
          if (body) {
            httpRequest += `Content-Length: ${Buffer.byteLength(body)}\r\n`;
          }
          httpRequest += '\r\n';
          if (body) {
            httpRequest += body;
          }

          client.write(Buffer.from(httpRequest));
        } else if (phase === 'http') {
          chunks.push(pending);
          pending = Buffer.alloc(0);
        }
      }
    });

    client.on('close', () => {
      finish(() => {
        try {
          const rawResponse = Buffer.concat(chunks).toString('utf-8');
          const headerEnd = rawResponse.indexOf('\r\n\r\n');
          if (headerEnd === -1) {
            reject(new Error('Invalid HTTP response: no header terminator'));
            return;
          }

          const headerPart = rawResponse.substring(0, headerEnd);
          const bodyPart = rawResponse.substring(headerEnd + 4);

          // Parse status line
          const statusLine = headerPart.split('\r\n')[0];
          const statusMatch = statusLine.match(/HTTP\/[\d.]+\s+(\d+)\s*(.*)/);
          const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
          const statusText = statusMatch ? statusMatch[2] : '';

          // Parse headers
          const responseHeaders: Record<string, string> = {};
          const headerLines = headerPart.split('\r\n').slice(1);
          for (const line of headerLines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
              const key = line.substring(0, colonIndex).trim().toLowerCase();
              const value = line.substring(colonIndex + 1).trim();
              responseHeaders[key] = value;
            }
          }

          // Handle chunked transfer encoding
          let responseBody = bodyPart;
          if (responseHeaders['transfer-encoding']?.includes('chunked')) {
            responseBody = decodeChunked(bodyPart);
          }

          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText,
            headers: responseHeaders,
            json: async () => JSON.parse(responseBody),
            text: async () => responseBody,
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : String(error)}`));
        }
      });
    });

    client.on('error', (error: Error) => {
      finish(() => {
        reject(new Error(`SOCKS5 connection error: ${error.message}`));
      });
    });
  });
}
