import AsyncStorage from '@react-native-async-storage/async-storage';
import TcpSocket from 'react-native-tcp-socket';
import { Linking, NativeModules, Platform } from 'react-native';

const TOR_SETTINGS_KEY = '@tor_settings';
export const DEFAULT_SOCKS_HOST = '127.0.0.1';
const DEFAULT_SOCKS_PORT = 9050;
const ORBOT_PACKAGE = 'org.torproject.android';

export type TorStatus = 'disabled' | 'checking' | 'connected' | 'unavailable';

export interface TorSettings {
  enabled: boolean;
  socksPort: number;
  /** When true, requests fail if Tor is unavailable instead of falling back to clearnet */
  torOnly: boolean;
}

const DEFAULT_SETTINGS: TorSettings = {
  enabled: false,
  socksPort: DEFAULT_SOCKS_PORT,
  torOnly: false,
};

class TorManager {
  private static instance: TorManager;
  private _status: TorStatus = 'disabled';
  private _settings: TorSettings = { ...DEFAULT_SETTINGS };
  private _listeners: Set<(status: TorStatus) => void> = new Set();

  static getInstance(): TorManager {
    if (!TorManager.instance) {
      TorManager.instance = new TorManager();
    }
    return TorManager.instance;
  }

  get status(): TorStatus {
    return this._status;
  }

  get settings(): TorSettings {
    return { ...this._settings };
  }

  get socksPort(): number {
    return this._settings.socksPort;
  }

  get isReady(): boolean {
    return this._status === 'connected';
  }

  /** When true, clearnet fallback is blocked — requests must go through Tor or fail */
  get isTorOnly(): boolean {
    return this._settings.enabled && this._settings.torOnly;
  }

  async loadSettings(): Promise<TorSettings> {
    try {
      const stored = await AsyncStorage.getItem(TOR_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<TorSettings>;
        const port = parsed.socksPort;
        const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SETTINGS.enabled;
        const torOnly = enabled && (typeof parsed.torOnly === 'boolean' ? parsed.torOnly : DEFAULT_SETTINGS.torOnly);
        this._settings = {
          enabled,
          torOnly,
          socksPort: typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535 ? port : DEFAULT_SETTINGS.socksPort,
        };
      }
    } catch (e) {
      console.warn('[TorManager] Failed to load settings:', e);
    }

    if (this._settings.enabled) {
      await this.checkConnection();
    } else {
      this._setStatus('disabled');
    }

    return this._settings;
  }

  async saveSettings(settings: Partial<TorSettings>): Promise<void> {
    const next = { ...this._settings, ...settings };
    await AsyncStorage.setItem(TOR_SETTINGS_KEY, JSON.stringify(next));
    this._settings = next;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.saveSettings({ enabled });
      await this.checkConnection();
    } else {
      await this.saveSettings({ enabled, torOnly: false });
      this._setStatus('disabled');
    }
  }

  async setTorOnly(torOnly: boolean): Promise<void> {
    await this.saveSettings({ torOnly });
  }

  async setSocksPort(port: number): Promise<void> {
    await this.saveSettings({ socksPort: port });
    if (this._settings.enabled) {
      await this.checkConnection();
    }
  }

  async checkConnection(): Promise<boolean> {
    if (!this._settings.enabled) {
      this._setStatus('disabled');
      return false;
    }

    this._setStatus('checking');

    try {
      const available = await this._testSocksProxy();
      this._setStatus(available ? 'connected' : 'unavailable');
      return available;
    } catch {
      this._setStatus('unavailable');
      return false;
    }
  }

  markUnavailable(): void {
    if (this._status === 'connected') {
      this._setStatus('unavailable');
    }
  }

  /** Android only. On iOS, returns false — users must configure manually. */
  static async isOrbotInstalled(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const { RNShare } = NativeModules;
      if (!RNShare?.isPackageInstalled) return false;
      return await RNShare.isPackageInstalled(ORBOT_PACKAGE);
    } catch {
      return false;
    }
  }

  static openOrbotInstallPage(): void {
    if (Platform.OS === 'android') {
      Linking.openURL('https://guardianproject.info/releases/orbot-latest.apk');
    } else {
      Linking.openURL('https://apps.apple.com/app/orbot/id1609461599');
    }
  }

  private _testSocksProxy(): Promise<boolean> {
    return new Promise(resolve => {
      let resolved = false;
      let pending = Buffer.alloc(0);

      const finalize = (result: boolean) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        try {
          client.destroy();
        } catch {}
        resolve(result);
      };

      const timeout = setTimeout(() => finalize(false), 5000);

      const client = TcpSocket.createConnection({ host: DEFAULT_SOCKS_HOST, port: this._settings.socksPort }, () => {
        // Send SOCKS5 greeting: version 5, 1 method, no-auth
        const greeting = Buffer.from([0x05, 0x01, 0x00]);
        client.write(greeting);
      });

      client.on('data', (data: string | Buffer) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        pending = pending.length ? Buffer.concat([pending, buf]) : buf;
        // Valid SOCKS5 response: version 5, no auth method selected
        if (pending.length >= 2) {
          finalize(pending[0] === 0x05 && pending[1] === 0x00);
        }
      });

      client.on('error', () => finalize(false));
      client.on('close', () => finalize(false));
    });
  }

  private _setStatus(status: TorStatus): void {
    if (this._status !== status) {
      this._status = status;
      console.log(`[TorManager] Status: ${status}`);
      this._listeners.forEach(cb => cb(status));
    }
  }

  addStatusListener(listener: (status: TorStatus) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }
}

export default TorManager;
