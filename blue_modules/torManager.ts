import AsyncStorage from '@react-native-async-storage/async-storage';
import TcpSocket from 'react-native-tcp-socket';
import { Linking, NativeModules, Platform } from 'react-native';

const TOR_SETTINGS_KEY = '@tor_settings';
const DEFAULT_SOCKS_HOST = '127.0.0.1';
const DEFAULT_SOCKS_PORT = 9050;
const ORBOT_PACKAGE = 'org.torproject.android';

export type TorStatus = 'disabled' | 'checking' | 'connected' | 'unavailable';

export interface TorSettings {
  enabled: boolean;
  socksPort: number;
  /** When true, requests fail if Tor is unavailable instead of falling back to clearnet */
  torOnly: boolean;
  retryAttempts: number;
}

const DEFAULT_SETTINGS: TorSettings = {
  enabled: false,
  socksPort: DEFAULT_SOCKS_PORT,
  torOnly: false,
  retryAttempts: 3,
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

  get socksHost(): string {
    return DEFAULT_SOCKS_HOST;
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

  get retryAttempts(): number {
    return this._settings.retryAttempts;
  }

  async loadSettings(): Promise<TorSettings> {
    try {
      const stored = await AsyncStorage.getItem(TOR_SETTINGS_KEY);
      if (stored) {
        this._settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
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
    this._settings = { ...this._settings, ...settings };
    try {
      await AsyncStorage.setItem(TOR_SETTINGS_KEY, JSON.stringify(this._settings));
    } catch (e) {
      console.error('[TorManager] Failed to save settings:', e);
    }
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.saveSettings({ enabled });
    if (enabled) {
      await this.checkConnection();
    } else {
      this._setStatus('disabled');
    }
  }

  async setTorOnly(torOnly: boolean): Promise<void> {
    await this.saveSettings({ torOnly });
  }

  async setRetryAttempts(retryAttempts: number): Promise<void> {
    await this.saveSettings({ retryAttempts: Math.max(1, Math.min(retryAttempts, 10)) });
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

  /**
   * Check if Orbot is installed on the device (Android only).
   * On iOS, returns false — users must configure manually.
   */
  static async isOrbotInstalled(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const { PackageManager } = NativeModules;
      if (!PackageManager?.isPackageInstalled) return false;
      return await PackageManager.isPackageInstalled(ORBOT_PACKAGE);
    } catch {
      return false;
    }
  }

  /** Try to launch Orbot app (Android only) */
  static async launchOrbot(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const { PackageManager } = NativeModules;
      if (!PackageManager?.launchPackage) return false;
      return await PackageManager.launchPackage(ORBOT_PACKAGE);
    } catch {
      return false;
    }
  }

  /** Open Orbot's store listing for installation */
  static openOrbotInstallPage(): void {
    if (Platform.OS === 'android') {
      Linking.openURL('market://details?id=org.torproject.android').catch(() => {
        Linking.openURL('https://play.google.com/store/apps/details?id=org.torproject.android');
      });
    } else {
      Linking.openURL('https://apps.apple.com/app/orbot/id1609461599');
    }
  }

  private _testSocksProxy(): Promise<boolean> {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        try {
          client.destroy();
        } catch {}
        resolve(false);
      }, 5000);

      const client = TcpSocket.createConnection(
        { host: DEFAULT_SOCKS_HOST, port: this._settings.socksPort },
        () => {
          // Send SOCKS5 greeting: version 5, 1 method, no-auth
          const greeting = Buffer.from([0x05, 0x01, 0x00]);
          client.write(greeting);
        },
      );

      client.on('data', (data: string | Buffer) => {
        clearTimeout(timeout);
        try {
          client.destroy();
        } catch {}
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        // Valid SOCKS5 response: version 5, no auth method selected
        resolve(buf.length >= 2 && buf[0] === 0x05 && buf[1] === 0x00);
      });

      client.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
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
