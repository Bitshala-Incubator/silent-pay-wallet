import React from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { ShroudCard } from '../../components/ShroudComponents';
import ListItem from '../../components/ListItem';
import { useTheme } from '../../components/themes';
import loc, { formatStringAddTwoWhiteSpaces } from '../../loc';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';

const About: React.FC = () => {
  const { colors } = useTheme();

  const stylesHook = StyleSheet.create({
    textBackup: {
      color: colors.foregroundColor,
    },
  });

  const handleOnDiscordPress = () => {
    Linking.openURL('https://discord.com/invite/STeQFVEWf9');
  };

  const handleOnGithubPress = () => {
    Linking.openURL('https://github.com/Bitshala-Incubator/silent-pay-wallet');
  };

  return (
    <SafeAreaScrollView testID="AboutScrollView" contentInsetAdjustmentBehavior="automatic" automaticallyAdjustContentInsets>
      <ShroudCard>
        <View style={styles.center}>
          <Image style={styles.logo} source={require('../../img/icon.png')} />
          <Text style={styles.textFree}>{loc.settings.about_free}</Text>
          <Text style={[styles.textBackup, stylesHook.textBackup]}>{formatStringAddTwoWhiteSpaces(loc.settings.warning)}</Text>
        </View>
        <ListItem
          leftIcon={{
            name: 'discord',
            type: 'font-awesome-5',
            color: '#7289da',
          }}
          onPress={handleOnDiscordPress}
          title={loc.settings.about_sm_discord}
        />
        <ListItem
          leftIcon={{
            name: 'github',
            type: 'font-awesome-5',
            color: '#000000',
          }}
          onPress={handleOnGithubPress}
          title={loc.settings.about_sm_github}
        />
      </ShroudCard>
    </SafeAreaScrollView>
  );
};

export default About;

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 54,
  },
  logo: {
    width: 50,
    height: 50,
  },
  textFree: {
    maxWidth: 260,
    marginVertical: 24,
    color: '#9AA0AA',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  textBackup: {
    maxWidth: 260,
    marginBottom: 40,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
});
