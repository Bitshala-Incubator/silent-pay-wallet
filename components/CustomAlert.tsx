import React, { useCallback, useImperativeHandle, useState, forwardRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, AlertButton, AlertOptions, Appearance } from 'react-native';
import { BlueDefaultTheme, BlueDarkTheme } from './themes';

export interface CustomAlertHandle {
  show: (title: string | undefined, message: string | undefined, buttons: AlertButton[], options: AlertOptions) => void;
}

const CustomAlert = forwardRef<CustomAlertHandle>((_, ref) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState<string | undefined>();
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<AlertButton[]>([]);
  const [options, setOptions] = useState<AlertOptions>({});

  const isDark = Appearance.getColorScheme() === 'dark';
  const colors = isDark ? BlueDarkTheme.colors : BlueDefaultTheme.colors;

  const dismiss = useCallback(() => setVisible(false), []);

  useImperativeHandle(ref, () => ({
    show: (t, m, b, o) => {
      setTitle(t);
      setMessage(m ?? '');
      setButtons(b);
      setOptions(o);
      setVisible(true);
    },
  }));

  const handlePress = useCallback(
    (onPress?: () => void) => {
      dismiss();
      onPress?.();
    },
    [dismiss],
  );

  const getButtonTextStyle = (style?: string) => {
    switch (style) {
      case 'destructive':
        return { color: colors.redText, fontWeight: '600' as const };
      case 'cancel':
        return { color: colors.foregroundColor, fontWeight: '600' as const };
      default:
        return { color: colors.primary };
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={options.cancelable ? dismiss : undefined}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.elevated }]}>
          {title ? <Text style={[styles.title, { color: colors.foregroundColor }]}>{title}</Text> : null}
          <Text style={[styles.message, { color: colors.foregroundColor }]}>{message}</Text>
          <View style={[styles.buttonRow, { borderTopColor: colors.lightBorder }]}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                accessibilityRole="button"
                accessibilityLabel={button.text}
                style={[
                  styles.button,
                  index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.lightBorder },
                ]}
                onPress={() => handlePress(button.onPress ?? undefined)}
              >
                <Text style={[styles.buttonText, getButtonTextStyle(button.style)]}>{button.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    borderRadius: 14,
    paddingTop: 20,
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
  },
});

export default CustomAlert;
