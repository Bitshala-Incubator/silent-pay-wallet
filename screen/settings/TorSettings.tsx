import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Switch, TextInput, ActivityIndicator, Platform, TouchableOpacity, AppState } from 'react-native';
import { BlueCard, BlueText } from '../../BlueComponents';
import { useSettings } from '../../hooks/context/useSettings';
import { useTheme } from '../../components/themes';
import Button from '../../components/Button';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';
import { BlueSpacing20 } from '../../components/BlueSpacing';
import TorManager, { type TorStatus } from '../../blue_modules/torManager';
import loc from '../../loc';

const TorSettings: React.FC = () => {
  const { colors } = useTheme();
  const { isTorEnabled, setIsTorEnabled, isTorOnly, setIsTorOnly, torSocksPort, setTorSocksPort, torStatus, settingsInitialized } =
    useSettings();
  const statusLabels: Record<TorStatus, string> = {
    disabled: loc.settings.tor_status_disabled,
    checking: loc.settings.tor_status_checking,
    connected: loc.settings.tor_status_connected,
    unavailable: loc.settings.tor_status_unavailable,
  };
  const [portInput, setPortInput] = useState(String(torSocksPort));
  const [orbotInstalled, setOrbotInstalled] = useState<boolean | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [portError, setPortError] = useState<string | null>(null);
  const [portSaved, setPortSaved] = useState(false);

  const stylesHook = useMemo(
    () => ({
      inputContainer: {
        borderColor: colors.formBorder,
        borderBottomColor: colors.formBorder,
        backgroundColor: colors.inputBackgroundColor,
      },
      input: {
        color: colors.foregroundColor,
      },
    }),
    [colors],
  );

  useEffect(() => {
    const check = () => {
      TorManager.isOrbotInstalled()
        .then(setOrbotInstalled)
        .catch(() => setOrbotInstalled(null));
    };
    check();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setPortInput(String(torSocksPort));
  }, [torSocksPort]);

  const statusColors: Record<TorStatus, string> = {
    disabled: colors.foregroundColor,
    checking: colors.foregroundColor,
    connected: colors.successColor,
    unavailable: colors.redText,
  };

  const parsedPort = parseInt(portInput, 10);
  const isPortValid = !isNaN(parsedPort) && parsedPort >= 1 && parsedPort <= 65535;

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
    if (!isPortValid) {
      setPortError(loc.settings.tor_port_invalid);
      setPortSaved(false);
      return;
    }
    setPortError(null);
    const ok = await setTorSocksPort(parsedPort);
    if (!ok) {
      setPortError(loc.settings.tor_save_failed);
      return;
    }
    setPortSaved(true);
  }, [isPortValid, parsedPort, setTorSocksPort]);

  useEffect(() => {
    if (!portSaved) return;
    const t = setTimeout(() => setPortSaved(false), 2000);
    return () => clearTimeout(t);
  }, [portSaved]);

  const handlePortChange = useCallback((value: string) => {
    setPortInput(value);
    setPortError(null);
    setPortSaved(false);
  }, []);

  const handleTestConnection = useCallback(() => {
    TorManager.getInstance().checkConnection();
  }, []);

  const handleInstallOrbot = useCallback(() => {
    TorManager.openOrbotInstallPage();
  }, []);

  return (
    <SafeAreaScrollView>
      <BlueCard>
        <BlueText style={styles.label}>{loc.settings.tor_use_tor}</BlueText>
        <BlueText style={styles.description}>{loc.settings.tor_description}</BlueText>
        <View style={styles.row}>
          <BlueText>{loc.settings.tor_enable}</BlueText>
          {!settingsInitialized ? <ActivityIndicator size="small" /> : <Switch value={isTorEnabled} onValueChange={handleToggle} />}
        </View>

        {isTorEnabled && (
          <View style={styles.row}>
            <View style={styles.torOnlyLabel}>
              <BlueText>{loc.settings.tor_only_mode}</BlueText>
              <BlueText style={styles.torOnlyWarning}>{loc.settings.tor_only_mode_description}</BlueText>
            </View>
            <Switch value={isTorOnly} onValueChange={handleTorOnlyToggle} />
          </View>
        )}

        {isTorEnabled && (
          <>
            <BlueSpacing20 />

            {Platform.OS === 'android' && orbotInstalled !== null && (
              <View style={styles.statusRow}>
                <BlueText>{loc.settings.tor_orbot_label}</BlueText>
                <BlueText style={[styles.statusValue, { color: orbotInstalled ? colors.successColor : colors.redText }]}>
                  {orbotInstalled ? loc.settings.tor_orbot_installed : loc.settings.tor_orbot_not_installed}
                </BlueText>
              </View>
            )}

            <BlueSpacing20 />

            <View style={styles.statusRow}>
              <BlueText>{loc.settings.tor_status_label}</BlueText>
              <BlueText style={[styles.statusValue, { color: statusColors[torStatus] }]}>{statusLabels[torStatus]}</BlueText>
              {torStatus === 'checking' && <ActivityIndicator size="small" style={styles.spinner} />}
            </View>

            <BlueSpacing20 />

            <View style={styles.buttons}>
              <Button
                title={torStatus === 'checking' ? loc.settings.tor_status_checking : loc.settings.tor_test_connection}
                onPress={handleTestConnection}
                disabled={torStatus === 'checking'}
              />
            </View>
          </>
        )}

        {Platform.OS === 'android' && orbotInstalled === false && (
          <>
            <BlueSpacing20 />
            <BlueText style={styles.sectionLabel}>{loc.settings.tor_orbot}</BlueText>
            <View style={styles.buttons}>
              <Button title={loc.settings.tor_install_orbot} onPress={handleInstallOrbot} />
            </View>
          </>
        )}

        <BlueSpacing20 />

        <TouchableOpacity onPress={() => setShowAdvanced(s => !s)}>
          <BlueText style={styles.advancedToggle}>
            {showAdvanced ? '▼ ' : '▸ '}
            {loc.settings.tor_advanced}
          </BlueText>
        </TouchableOpacity>

        {showAdvanced && (
          <>
            <BlueSpacing20 />
            <BlueText style={styles.label}>{loc.settings.tor_socks_port}</BlueText>
            <BlueText style={styles.description}>{loc.settings.tor_socks_port_description}</BlueText>
            <View style={[styles.inputContainer, stylesHook.inputContainer]}>
              <TextInput
                style={[styles.input, stylesHook.input]}
                value={portInput}
                onChangeText={handlePortChange}
                keyboardType="numeric"
                placeholder="9050"
                placeholderTextColor={colors.alternativeTextColor}
                editable={isTorEnabled}
                maxLength={5}
              />
            </View>
            {portError && <BlueText style={[styles.inlineMessage, { color: colors.redText }]}>{portError}</BlueText>}
            {portSaved && <BlueText style={[styles.inlineMessage, { color: colors.successColor }]}>{loc.settings.tor_saved}</BlueText>}

            <BlueSpacing20 />

            {isTorEnabled && (
              <View style={styles.buttons}>
                <Button title={loc.settings.tor_save_port} onPress={handleSavePort} disabled={!isPortValid} />
              </View>
            )}
          </>
        )}

        <BlueSpacing20 />

        {Platform.OS === 'android' && <BlueText style={styles.hint}>{loc.settings.tor_hint_install_running}</BlueText>}
        {isTorEnabled && orbotInstalled === true && torStatus === 'unavailable' && (
          <BlueText style={styles.hint}>{loc.settings.tor_hint_not_running}</BlueText>
        )}
        {isTorOnly && <BlueText style={[styles.hint, { color: colors.redText }]}>{loc.settings.tor_only_warning}</BlueText>}
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
  statusValue: {
    fontWeight: '600',
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
  advancedToggle: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
  },
  inlineMessage: {
    fontSize: 13,
    marginTop: 6,
  },
  hint: {
    fontSize: 12,
    opacity: 0.5,
    fontStyle: 'italic',
    marginBottom: 4,
  },
});

export default TorSettings;
