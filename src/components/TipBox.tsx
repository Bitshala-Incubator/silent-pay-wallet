import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from './themes';
import { ShroudText } from '../components/ShroudComponents';

interface TipBoxProps {
  number?: string;
  title?: string;
  description?: string;
  additionalDescription?: string;
  containerStyle?: ViewStyle;
}

const TipBox: React.FC<TipBoxProps> = ({ number, title, description, additionalDescription, containerStyle }) => {
  const { colors } = useTheme();
  const stylesHook = StyleSheet.create({
    tipBox: {
      backgroundColor: colors.ballOutgoingExpired,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      ...containerStyle,
    },
    tipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: number || title ? 16 : 0,
    },
    tipHeaderText: {
      marginLeft: 4,
      flex: 1,
    },
    description: {
      marginBottom: additionalDescription ? 16 : 0,
    },
  });

  return (
    <View style={stylesHook.tipBox}>
      {(number || title) && (
        <View style={stylesHook.tipHeader}>
          {number && (
            <View style={styles.vaultKeyCircle}>
              <ShroudText style={styles.vaultKeyText}>{number}</ShroudText>
            </View>
          )}
          {title && (
            <ShroudText bold style={stylesHook.tipHeaderText}>
              {title}
            </ShroudText>
          )}
        </View>
      )}
      {description && <ShroudText style={stylesHook.description}>{description}</ShroudText>}
      {additionalDescription && <ShroudText>{additionalDescription}</ShroudText>}
    </View>
  );
};

const styles = StyleSheet.create({
  vaultKeyCircle: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vaultKeyText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default TipBox;
