import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Switch, TextInput, ActivityIndicator, Platform } from 'react-native';
import { BlueCard, BlueText } from '../../BlueComponents';
import { useSettings } from '../../hooks/context/useSettings';
import { useTheme } from '../../components/themes';
import Button from '../../components/Button';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';
import { BlueSpacing20 } from '../../components/BlueSpacing';
import TorManager from '../../blue_modules/torManager';

const TorSettings: React.FC = () => {
  const { colors } = useTheme();
  const { isTorEnabled, setIsTorEnabled, isTorOnly, setIsTorOnly, torSocksPort, setTorSocksPort, torStatus } = useSettings();
  const [portInput, setPortInput] = useState(String(torSocksPort));
  const [isChecking, setIsChecking] = useState(false);
  const [orbotInstalled, setOrbotInstalled] = useState<boolean | null>(null);

  const stylesHook = StyleSheet.create({
    inputContainer: {
      borderColor: colors.formBorder,
      borderBottomColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
    },
    input: {
      color: colors.foregroundColor,
    },
  });

  useEffect(() => {
    TorManager.isOrbotInstalled()
      .then(setOrbotInstalled)
      .catch(() => setOrbotInstalled(null));
  }, []);

  const statusColor = torStatus === 'connected' ? '#4caf50' : torStatus === 'unavailable' ? '#f44336' : colors.foregroundColor;
  const statusLabel =
    torStatus === 'disabled'
      ? 'Disabled'
      : torStatus === 'checking'
        ? 'Checking...'
        : torStatus === 'connected'
          ? 'Connected to Orbot'
          : 'Orbot Unavailable';

  const handleToggle = useCallback(
    async (value: boolean) => {
      await setIsTorEnabled(value);
    },
    [setIsTorEnabled],
  );

  const handleTorOnlyToggle = useCallback(
    async (value: boolean) => {
      await setIsTorOnly(value);
    },
    [setIsTorOnly],
  );

  const handleSavePort = useCallback(async () => {
    const port = parseInt(portInput, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      return;
    }
    await setTorSocksPort(port);
  }, [portInput, setTorSocksPort]);

  const handleTestConnection = useCallback(async () => {
    setIsChecking(true);
    await TorManager.getInstance().checkConnection();
    setIsChecking(false);
  }, []);

  const handleLaunchOrbot = useCallback(async () => {
    await TorManager.launchOrbot();
  }, []);

  const handleInstallOrbot = useCallback(async () => {
    await TorManager.openOrbotInstallPage();
  }, []);

  return (
    <SafeAreaScrollView>
      <BlueCard>
        <BlueText style={styles.label}>Use Orbot (Tor)</BlueText>
        <BlueText style={styles.description}>
          Route indexer requests through Orbot&apos;s SOCKS5 proxy. When enabled, the app will try to connect to the .onion address first
          and fall back to clearnet if Tor is unavailable.
        </BlueText>
        <View style={styles.row}>
          <BlueText>Enable Tor</BlueText>
          <Switch value={isTorEnabled} onValueChange={handleToggle} />
        </View>

        {isTorEnabled && (
          <>
            <View style={styles.row}>
              <View style={styles.torOnlyLabel}>
                <BlueText>Tor-Only Mode</BlueText>
                <BlueText style={styles.torOnlyWarning}>Blocks all clearnet fallback</BlueText>
              </View>
              <Switch value={isTorOnly} onValueChange={handleTorOnlyToggle} />
            </View>
          </>
        )}

        <BlueSpacing20 />

        <View style={styles.statusRow}>
          <BlueText>Status: </BlueText>
          <BlueText style={{ color: statusColor, fontWeight: '600' }}>{statusLabel}</BlueText>
          {torStatus === 'checking' && <ActivityIndicator size="small" style={styles.spinner} />}
        </View>

        {Platform.OS === 'android' && orbotInstalled !== null && (
          <>
            <BlueSpacing20 />
            <View style={styles.statusRow}>
              <BlueText>Orbot: </BlueText>
              <BlueText style={{ color: orbotInstalled ? '#4caf50' : '#f44336', fontWeight: '600' }}>
                {orbotInstalled ? 'Installed' : 'Not Installed'}
              </BlueText>
            </View>
          </>
        )}

        <BlueSpacing20 />

        <BlueText style={styles.label}>SOCKS5 Port</BlueText>
        <BlueText style={styles.description}>Default: 9050 (Orbot), 9150 (Tor Browser). Change only if you have a custom configuration.</BlueText>
        <View style={[styles.inputContainer, stylesHook.inputContainer]}>
          <TextInput
            style={[styles.input, stylesHook.input]}
            value={portInput}
            onChangeText={setPortInput}
            keyboardType="numeric"
            placeholder="9050"
            placeholderTextColor={colors.alternativeTextColor}
            editable={isTorEnabled}
            maxLength={5}
          />
        </View>

        <BlueSpacing20 />

        {isTorEnabled && (
          <View style={styles.buttons}>
            <Button title="Save Port" onPress={handleSavePort} />
            <View style={styles.buttonSpacer} />
            <Button title={isChecking ? 'Checking...' : 'Test Connection'} onPress={handleTestConnection} disabled={isChecking} />
          </View>
        )}

        <BlueSpacing20 />

        <BlueText style={styles.sectionLabel}>Orbot</BlueText>
        <View style={styles.buttons}>
          {orbotInstalled === false && <Button title="Install Orbot" onPress={handleInstallOrbot} />}
          {orbotInstalled !== false && (
            <Button title="Open Orbot" onPress={handleLaunchOrbot} />
          )}
        </View>

        <BlueSpacing20 />

        <BlueText style={styles.hint}>
          Make sure Orbot is installed and running before enabling Tor. On Android, you can install Orbot from the Play Store or F-Droid.
        </BlueText>
        {isTorOnly && (
          <BlueText style={[styles.hint, { color: '#f44336' }]}>
            Warning: Tor-Only mode will block all network requests if Orbot is not running. Your wallet will not sync until Tor is available.
          </BlueText>
        )}
      </BlueCard>
    </SafeAreaScrollView>
  );
};

const styles = StyleSheet.create({
  label: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  sectionLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    marginBottom: 12,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  torOnlyLabel: {
    flex: 1,
  },
  torOnlyWarning: {
    fontSize: 12,
    opacity: 0.6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginLeft: 8,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  input: {
    fontSize: 16,
    paddingVertical: 10,
  },
  buttons: {
    flexDirection: 'row',
  },
  buttonSpacer: {
    width: 12,
  },
  hint: {
    fontSize: 12,
    opacity: 0.5,
    fontStyle: 'italic',
    marginBottom: 4,
  },
});

export default TorSettings;
